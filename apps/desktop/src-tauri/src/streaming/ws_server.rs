use crate::runtime::RuntimeSessionStore;
use futures_util::{SinkExt, StreamExt};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Deserialize;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::{Arc, Mutex, OnceLock};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{mpsc, Mutex as AsyncMutex};
use tokio::task::JoinHandle;
use tokio_tungstenite::accept_hdr_async;
use tokio_tungstenite::tungstenite::handshake::server::{ErrorResponse, Request, Response};
use tokio_tungstenite::tungstenite::http::{Response as HttpResponse, StatusCode};
use tokio_tungstenite::tungstenite::protocol::Message;
use tokio_tungstenite::WebSocketStream;

const DEFAULT_PTY_COLS: u16 = 80;
const DEFAULT_PTY_ROWS: u16 = 24;
const PTY_READ_BUFFER_SIZE: usize = 8192;

#[derive(Debug, Clone, Copy, Default)]
pub struct WebSocketServer;

#[derive(Debug)]
struct WebSocketServerState {
    port: OnceLock<u16>,
    startup_lock: AsyncMutex<()>,
}

impl Default for WebSocketServerState {
    fn default() -> Self {
        Self {
            port: OnceLock::new(),
            startup_lock: AsyncMutex::new(()),
        }
    }
}

static SERVER_STATE: OnceLock<WebSocketServerState> = OnceLock::new();

#[derive(Debug, Clone, Default)]
struct ConnectionContext {
    session_id: Option<String>,
    token: Option<String>,
}

#[derive(Debug, Clone)]
struct AuthenticatedConnectionContext {
    session_id: String,
    token: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct TerminalResize {
    cols: u16,
    rows: u16,
}

#[derive(Debug, PartialEq, Eq)]
enum TextProtocolMessage {
    Input(Vec<u8>),
    Resize(TerminalResize),
}

#[derive(Debug, Deserialize)]
struct ResizeMessage {
    #[serde(default, rename = "type")]
    kind: Option<String>,
    #[serde(default)]
    event: Option<String>,
    #[serde(default)]
    action: Option<String>,
    #[serde(default, alias = "columns", alias = "width")]
    cols: Option<u16>,
    #[serde(default, alias = "height")]
    rows: Option<u16>,
}

struct PtySession {
    master: Box<dyn MasterPty + Send>,
    input_writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
    output_receiver: mpsc::UnboundedReceiver<Vec<u8>>,
    output_task: JoinHandle<()>,
}

impl PtySession {
    fn spawn(cwd: Option<&str>) -> Result<Self, String> {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: DEFAULT_PTY_ROWS,
                cols: DEFAULT_PTY_COLS,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|error| format!("failed to create terminal PTY: {error}"))?;

        let shell = default_shell();
        let mut command = CommandBuilder::new(shell.clone());
        command.env("TERM", "xterm-256color");
        if let Some(directory) = cwd.map(str::trim).filter(|value| !value.is_empty()) {
            command.cwd(directory);
        }
        if should_use_interactive_flag(&shell) {
            command.arg("-i");
        }
        if should_use_login_flag(&shell) {
            command.arg("-l");
        }

        let child = pair
            .slave
            .spawn_command(command)
            .map_err(|error| format!("failed to spawn terminal shell: {error}"))?;
        drop(pair.slave);

        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|error| format!("failed to create terminal reader: {error}"))?;
        let input_writer = pair
            .master
            .take_writer()
            .map_err(|error| format!("failed to create terminal writer: {error}"))?;

        let (output_sender, output_receiver) = mpsc::unbounded_channel();
        let output_task = tokio::task::spawn_blocking(move || {
            pump_pty_output(reader, output_sender);
        });

        Ok(Self {
            master: pair.master,
            input_writer,
            child,
            output_receiver,
            output_task,
        })
    }

    fn write_input(&mut self, payload: &[u8]) -> Result<(), String> {
        self.input_writer
            .write_all(payload)
            .map_err(|error| format!("terminal PTY write failed: {error}"))?;
        self.input_writer
            .flush()
            .map_err(|error| format!("terminal PTY flush failed: {error}"))?;
        Ok(())
    }

    fn resize(&mut self, resize: TerminalResize) -> Result<(), String> {
        self.master
            .resize(PtySize {
                rows: resize.rows,
                cols: resize.cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|error| format!("terminal PTY resize failed: {error}"))
    }

    async fn shutdown(self) {
        let output_task = self.output_task;
        let mut child = self.child;
        drop(self.input_writer);
        drop(self.master);

        let _ = tokio::task::spawn_blocking(move || {
            let _ = child.kill();
            let _ = child.wait();
        })
        .await;

        let _ = output_task.await;
    }
}

impl WebSocketServer {
    fn state(&self) -> &'static WebSocketServerState {
        SERVER_STATE.get_or_init(WebSocketServerState::default)
    }

    pub async fn ensure_started(&self) -> Result<u16, String> {
        if let Some(port) = self.state().port.get() {
            return Ok(*port);
        }

        let _guard = self.state().startup_lock.lock().await;
        if let Some(port) = self.state().port.get() {
            return Ok(*port);
        }

        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .map_err(|error| format!("failed to bind local websocket server: {error}"))?;
        let port = listener
            .local_addr()
            .map_err(|error| format!("failed to inspect local websocket port: {error}"))?
            .port();

        self.state()
            .port
            .set(port)
            .map_err(|_| "failed to initialize websocket server port".to_string())?;

        tokio::spawn(async move {
            run_accept_loop(listener).await;
        });

        Ok(port)
    }

    pub async fn port(&self) -> Result<u16, String> {
        self.ensure_started().await
    }

    pub async fn start(&self) -> Result<(), String> {
        self.ensure_started().await.map(|_| ())
    }
}

async fn run_accept_loop(listener: TcpListener) {
    loop {
        match listener.accept().await {
            Ok((stream, _)) => {
                tokio::spawn(async move {
                    if let Err(error) = handle_connection(stream).await {
                        eprintln!("terminal websocket connection failed: {error}");
                    }
                });
            }
            Err(error) => {
                eprintln!("terminal websocket accept failed: {error}");
            }
        }
    }
}

async fn handle_connection(stream: TcpStream) -> Result<(), String> {
    let context_store = Arc::new(Mutex::new(None::<AuthenticatedConnectionContext>));
    let context_writer = Arc::clone(&context_store);

    let ws_stream = accept_hdr_async(stream, move |request: &Request, response: Response| {
        let context = parse_connection_context(request);
        match authorize_connection(context) {
            Ok(authenticated) => {
                if let Ok(mut slot) = context_writer.lock() {
                    *slot = Some(authenticated);
                }
                Ok(response)
            }
            Err(reason) => Err(handshake_rejection_response(&reason)),
        }
    })
    .await
    .map_err(|error| format!("terminal websocket handshake failed: {error}"))?;

    let context = context_store
        .lock()
        .ok()
        .and_then(|slot| slot.clone())
        .ok_or_else(|| "terminal websocket handshake missing auth context".to_string())?;

    let cwd = RuntimeSessionStore::default().get_worktree_path(&context.session_id)?;
    let mut pty_session = PtySession::spawn(cwd.as_deref())?;
    let result = process_messages(ws_stream, context, &mut pty_session).await;
    pty_session.shutdown().await;
    result
}

async fn process_messages(
    ws_stream: WebSocketStream<TcpStream>,
    context: AuthenticatedConnectionContext,
    pty_session: &mut PtySession,
) -> Result<(), String> {
    let (mut writer, mut reader) = ws_stream.split();

    loop {
        tokio::select! {
            outbound = pty_session.output_receiver.recv() => {
                let Some(chunk) = outbound else {
                    break;
                };

                let _ = RuntimeSessionStore::default().append_log_with_context(
                    Some(&context.session_id),
                    Some(&context.token),
                    format!("terminal outbound: <{} bytes binary>", chunk.len()),
                );

                writer
                    .send(Message::Binary(chunk.into()))
                    .await
                    .map_err(|error| format!("terminal websocket write failed: {error}"))?;
            }
            inbound = reader.next() => {
                let Some(inbound) = inbound else {
                    break;
                };
                let message =
                    inbound.map_err(|error| format!("terminal websocket read failed: {error}"))?;

                if let Some(content) = inbound_log_line(&message) {
                    let _ = RuntimeSessionStore::default().append_log_with_context(
                        Some(&context.session_id),
                        Some(&context.token),
                        format!("terminal inbound: {content}"),
                    );
                }

                match message {
                    Message::Text(payload) => {
                        match parse_text_protocol_message(payload.as_ref()) {
                            Ok(TextProtocolMessage::Input(input)) => {
                                pty_session.write_input(&input)?;
                            }
                            Ok(TextProtocolMessage::Resize(resize)) => {
                                pty_session.resize(resize)?;
                                let _ = RuntimeSessionStore::default().append_log_with_context(
                                    Some(&context.session_id),
                                    Some(&context.token),
                                    format!("terminal resize: cols={} rows={}", resize.cols, resize.rows),
                                );
                            }
                            Err(error) => {
                                let _ = RuntimeSessionStore::default().append_log_with_context(
                                    Some(&context.session_id),
                                    Some(&context.token),
                                    format!("terminal protocol warning: {error}"),
                                );
                            }
                        }
                    }
                    Message::Binary(payload) => {
                        pty_session.write_input(payload.as_ref())?;
                    }
                    Message::Ping(payload) => {
                        writer
                            .send(Message::Pong(payload))
                            .await
                            .map_err(|error| format!("terminal websocket pong failed: {error}"))?;
                    }
                    Message::Close(_) => {
                        break;
                    }
                    _ => {}
                }
            }
        }
    }

    let _ = writer.send(Message::Close(None)).await;
    Ok(())
}

fn inbound_log_line(message: &Message) -> Option<String> {
    if message.is_text() {
        return message.to_text().ok().map(ToString::to_string);
    }

    if message.is_binary() {
        return Some(format!("<{} bytes binary>", message.len()));
    }

    None
}

fn parse_connection_context(request: &Request) -> ConnectionContext {
    let mut context = ConnectionContext::default();
    let query = request.uri().query().unwrap_or_default();
    context.session_id = parse_session_from_path(request.uri().path());

    for (key, value) in parse_query_pairs(query) {
        match key {
            "sessionId" | "session_id" => context.session_id = Some(value.to_string()),
            "token" | "terminalToken" => context.token = Some(value.to_string()),
            _ => {}
        }
    }

    context
}

fn authorize_connection(
    context: ConnectionContext,
) -> Result<AuthenticatedConnectionContext, String> {
    let session_id = context
        .session_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "sessionId is required".to_string())?;
    let token = context
        .token
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "token is required".to_string())?;

    RuntimeSessionStore::default().validate_terminal_access(session_id, token)?;

    Ok(AuthenticatedConnectionContext {
        session_id: session_id.to_string(),
        token: token.to_string(),
    })
}

fn handshake_rejection_response(message: &str) -> ErrorResponse {
    HttpResponse::builder()
        .status(StatusCode::UNAUTHORIZED)
        .body(Some(message.to_string()))
        .unwrap_or_else(|_| HttpResponse::new(Some("terminal access denied".to_string())))
}

fn parse_query_pairs(query: &str) -> impl Iterator<Item = (&str, &str)> {
    query.split('&').filter_map(|pair| {
        let (key, value) = pair.split_once('=')?;
        Some((key, value))
    })
}

fn parse_session_from_path(path: &str) -> Option<String> {
    let trimmed = path.trim_matches('/');
    let mut parts = trimmed.split('/');
    if parts.next()? != "terminal" {
        return None;
    }

    let session_id = parts.next()?;
    if session_id.trim().is_empty() {
        return None;
    }

    Some(session_id.to_string())
}

fn parse_text_protocol_message(message: &str) -> Result<TextProtocolMessage, String> {
    if let Some(resize) = parse_resize_message(message)? {
        return Ok(TextProtocolMessage::Resize(resize));
    }

    Ok(TextProtocolMessage::Input(message.as_bytes().to_vec()))
}

fn parse_resize_message(message: &str) -> Result<Option<TerminalResize>, String> {
    let payload: ResizeMessage = match serde_json::from_str(message) {
        Ok(payload) => payload,
        Err(_) => return Ok(None),
    };

    if !is_resize_event(
        payload.kind.as_deref(),
        payload.event.as_deref(),
        payload.action.as_deref(),
    ) {
        return Ok(None);
    }

    let cols = payload
        .cols
        .ok_or_else(|| "resize message missing cols".to_string())?;
    let rows = payload
        .rows
        .ok_or_else(|| "resize message missing rows".to_string())?;
    if cols == 0 || rows == 0 {
        return Err("resize rows and cols must be greater than zero".to_string());
    }

    Ok(Some(TerminalResize { cols, rows }))
}

fn is_resize_event(kind: Option<&str>, event: Option<&str>, action: Option<&str>) -> bool {
    [kind, event, action]
        .into_iter()
        .flatten()
        .any(|value| value.eq_ignore_ascii_case("resize"))
}

fn default_shell() -> String {
    #[cfg(target_os = "windows")]
    {
        std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("SHELL")
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "/bin/zsh".to_string())
    }
}

fn should_use_login_flag(shell: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        let _ = shell;
        false
    }

    #[cfg(not(target_os = "windows"))]
    {
        matches!(shell_binary_name(shell), "bash" | "zsh" | "sh" | "fish")
    }
}

fn should_use_interactive_flag(shell: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        let _ = shell;
        false
    }

    #[cfg(not(target_os = "windows"))]
    {
        matches!(shell_binary_name(shell), "bash" | "zsh" | "sh" | "fish")
    }
}

fn shell_binary_name(shell: &str) -> &str {
    Path::new(shell)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
}

fn pump_pty_output(
    mut reader: Box<dyn Read + Send>,
    output_sender: mpsc::UnboundedSender<Vec<u8>>,
) {
    let mut buffer = [0_u8; PTY_READ_BUFFER_SIZE];
    loop {
        match reader.read(&mut buffer) {
            Ok(0) => break,
            Ok(read_bytes) => {
                if output_sender.send(buffer[..read_bytes].to_vec()).is_err() {
                    break;
                }
            }
            Err(error) if error.kind() == std::io::ErrorKind::Interrupted => {
                continue;
            }
            Err(_) => break,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        authorize_connection, inbound_log_line, is_resize_event, parse_connection_context,
        parse_query_pairs, parse_resize_message, parse_session_from_path,
        parse_text_protocol_message, shell_binary_name, should_use_interactive_flag,
        should_use_login_flag, ConnectionContext, TerminalResize, TextProtocolMessage,
    };
    use crate::commands::types::{RuntimeKind, SessionConfig};
    use crate::runtime::RuntimeSessionStore;
    use tokio_tungstenite::tungstenite::handshake::server::Request;
    use tokio_tungstenite::tungstenite::protocol::Message;

    fn sample_config() -> SessionConfig {
        SessionConfig {
            org_id: "org-test".to_string(),
            project_id: "project-test".to_string(),
            repository_path: ".".to_string(),
            base_branch: "main".to_string(),
            runtime: RuntimeKind::Local,
        }
    }

    #[test]
    fn parse_session_from_path_reads_terminal_segment() {
        assert_eq!(
            parse_session_from_path("/terminal/session-123"),
            Some("session-123".to_string())
        );
        assert_eq!(
            parse_session_from_path("terminal/session-123/extra"),
            Some("session-123".to_string())
        );
    }

    #[test]
    fn parse_session_from_path_rejects_invalid_paths() {
        assert_eq!(parse_session_from_path("/not-terminal/session"), None);
        assert_eq!(parse_session_from_path("/terminal"), None);
        assert_eq!(parse_session_from_path("/terminal/"), None);
    }

    #[test]
    fn parse_query_pairs_ignores_invalid_segments() {
        let pairs =
            parse_query_pairs("sessionId=abc&token=xyz&missing&key_only=").collect::<Vec<_>>();
        assert_eq!(
            pairs,
            vec![("sessionId", "abc"), ("token", "xyz"), ("key_only", "")]
        );
    }

    #[test]
    fn parse_connection_context_prefers_query_session_and_token() {
        let request = Request::builder()
            .uri("/terminal/path-session?sessionId=query-session&token=secret-token")
            .body(())
            .expect("request should build");

        let context = parse_connection_context(&request);

        assert_eq!(context.session_id.as_deref(), Some("query-session"));
        assert_eq!(context.token.as_deref(), Some("secret-token"));
    }

    #[test]
    fn parse_connection_context_supports_snake_case_query_keys() {
        let request = Request::builder()
            .uri("/terminal/path-session?session_id=from-query&terminalToken=abc123")
            .body(())
            .expect("request should build");

        let context = parse_connection_context(&request);

        assert_eq!(context.session_id.as_deref(), Some("from-query"));
        assert_eq!(context.token.as_deref(), Some("abc123"));
    }

    #[test]
    fn parse_connection_context_reads_session_from_path_when_query_missing() {
        let request = Request::builder()
            .uri("/terminal/path-session?token=secret-token")
            .body(())
            .expect("request should build");

        let context = parse_connection_context(&request);

        assert_eq!(context.session_id.as_deref(), Some("path-session"));
        assert_eq!(context.token.as_deref(), Some("secret-token"));
    }

    #[test]
    fn inbound_log_line_formats_text_and_binary_payloads() {
        assert_eq!(
            inbound_log_line(&Message::Text("hello".to_string().into())),
            Some("hello".to_string())
        );
        assert_eq!(
            inbound_log_line(&Message::Binary(vec![1, 2, 3].into())),
            Some("<3 bytes binary>".to_string())
        );
    }

    #[test]
    fn inbound_log_line_skips_non_content_frames() {
        assert_eq!(inbound_log_line(&Message::Ping(vec![1, 2].into())), None);
        assert_eq!(inbound_log_line(&Message::Close(None)), None);
    }

    #[test]
    fn parse_resize_message_extracts_resize_payload() {
        let resize = parse_resize_message(r#"{"type":"resize","cols":120,"rows":40}"#)
            .expect("resize payload should parse");
        assert_eq!(
            resize,
            Some(TerminalResize {
                cols: 120,
                rows: 40
            })
        );
    }

    #[test]
    fn parse_resize_message_requires_non_zero_dimensions() {
        let error = parse_resize_message(r#"{"type":"resize","cols":0,"rows":24}"#)
            .expect_err("zero columns should fail");
        assert_eq!(error, "resize rows and cols must be greater than zero");
    }

    #[test]
    fn parse_resize_message_ignores_non_resize_json() {
        let message = parse_resize_message(r#"{"type":"input","cols":120,"rows":30}"#)
            .expect("non-resize payload should not error");
        assert_eq!(message, None);
    }

    #[test]
    fn parse_text_protocol_message_routes_resize_messages() {
        let message = parse_text_protocol_message(r#"{"event":"resize","cols":90,"rows":20}"#)
            .expect("resize protocol message should parse");
        assert_eq!(
            message,
            TextProtocolMessage::Resize(TerminalResize { cols: 90, rows: 20 })
        );
    }

    #[test]
    fn parse_text_protocol_message_preserves_plain_input() {
        let message =
            parse_text_protocol_message("echo hello").expect("plain terminal input should parse");
        assert_eq!(message, TextProtocolMessage::Input(b"echo hello".to_vec()));
    }

    #[test]
    fn is_resize_event_matches_any_supported_discriminator() {
        assert!(is_resize_event(Some("resize"), None, None));
        assert!(is_resize_event(None, Some("resize"), None));
        assert!(is_resize_event(None, None, Some("resize")));
        assert!(!is_resize_event(Some("input"), None, None));
    }

    #[test]
    fn parse_resize_message_supports_alias_dimensions() {
        let resize = parse_resize_message(r#"{"event":"resize","columns":140,"height":44}"#)
            .expect("resize payload with aliases should parse");
        assert_eq!(
            resize,
            Some(TerminalResize {
                cols: 140,
                rows: 44
            })
        );
    }

    #[test]
    fn shell_binary_name_extracts_filename_from_path() {
        assert_eq!(shell_binary_name("/bin/zsh"), "zsh");
        assert_eq!(shell_binary_name("bash"), "bash");
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn shell_flags_enable_interactive_and_login_for_common_shells() {
        assert!(should_use_interactive_flag("/bin/zsh"));
        assert!(should_use_login_flag("/bin/zsh"));
        assert!(should_use_interactive_flag("/usr/bin/fish"));
        assert!(should_use_login_flag("/usr/bin/fish"));
        assert!(!should_use_interactive_flag("/usr/bin/python"));
        assert!(!should_use_login_flag("/usr/bin/python"));
    }

    #[test]
    fn authorize_connection_requires_token() {
        let error = authorize_connection(ConnectionContext {
            session_id: Some("session-1".to_string()),
            token: None,
        })
        .expect_err("missing token should fail auth");
        assert_eq!(error, "token is required");
    }

    #[test]
    fn authorize_connection_accepts_matching_session_and_token() {
        let _guard = RuntimeSessionStore::acquire_test_lock();
        let store = RuntimeSessionStore::default();
        store.reset_for_tests();

        let session = store
            .create_session(&sample_config())
            .expect("session should be created");
        let access = store
            .terminal_access(&session.session_id)
            .expect("terminal access should exist");

        let authenticated = authorize_connection(ConnectionContext {
            session_id: Some(session.session_id.clone()),
            token: Some(access.token),
        })
        .expect("matching session and token should authorize");
        assert_eq!(authenticated.session_id, session.session_id);
    }

    #[test]
    fn authorize_connection_rejects_mismatched_session_and_token() {
        let _guard = RuntimeSessionStore::acquire_test_lock();
        let store = RuntimeSessionStore::default();
        store.reset_for_tests();

        let first = store
            .create_session(&sample_config())
            .expect("first session should be created");
        let second = store
            .create_session(&sample_config())
            .expect("second session should be created");
        let first_access = store
            .terminal_access(&first.session_id)
            .expect("first terminal access should exist");

        let error = authorize_connection(ConnectionContext {
            session_id: Some(second.session_id),
            token: Some(first_access.token),
        })
        .expect_err("mismatched token should fail auth");
        assert_eq!(error, "terminal access denied");
    }
}
