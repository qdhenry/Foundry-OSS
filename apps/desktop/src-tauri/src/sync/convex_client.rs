use crate::commands::types::SessionStatus;
use crate::sync::payloads::{
    AppendBatchFromDesktopPayload, AppendBatchFromDesktopResponse, DesktopLogEntry,
    LocalCompletionReport, LocalDeviceIdentity, ReportLocalCompletionPayload,
    ReportLocalCompletionResponse, UpdateRuntimeModePayload, UpdateSetupProgressPayload,
};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::env;
use std::fmt;
use std::time::Duration;

const CONVEX_UDF_ERROR_STATUS: u16 = 560;
const CONVEX_AUTH_EXPIRED_STATUS: u16 = 401;
const CONVEX_MUTATION_APPEND_BATCH_FROM_DESKTOP: &str = "sandbox/logs:appendBatchFromDesktop";
const CONVEX_MUTATION_UPDATE_SETUP_PROGRESS: &str = "sandbox/sessions:updateSetupProgress";
const CONVEX_MUTATION_SET_RUNTIME_MODE: &str = "sandbox/sessions:setRuntimeMode";
const CONVEX_ACTION_REPORT_LOCAL_COMPLETION: &str = "sandbox/orchestrator:reportLocalCompletion";
const CONVEX_HTTP_TIMEOUT_SECS: u64 = 8;
const CONVEX_HTTP_CONNECT_TIMEOUT_SECS: u64 = 3;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConvexSyncError {
    SyncAuthExpired,
    Message(String),
}

impl ConvexSyncError {
    fn message(message: impl Into<String>) -> Self {
        Self::Message(message.into())
    }
}

impl fmt::Display for ConvexSyncError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::SyncAuthExpired => write!(
                formatter,
                "SyncAuthExpired: Convex auth token expired (HTTP 401). Refresh authentication and retry sync."
            ),
            Self::Message(message) => write!(formatter, "{message}"),
        }
    }
}

#[derive(Debug, Clone)]
pub struct ConvexClient {
    pub base_url: String,
    auth_token: String,
    local_device: LocalDeviceIdentity,
    http_client: reqwest::Client,
}

impl Default for ConvexClient {
    fn default() -> Self {
        Self {
            base_url: String::new(),
            auth_token: String::new(),
            local_device: LocalDeviceIdentity::from_env(),
            http_client: default_http_client(),
        }
    }
}

impl ConvexClient {
    pub fn from_env() -> Result<Option<Self>, String> {
        let base_url =
            first_non_empty_env(&["FOUNDRY_CONVEX_URL", "CONVEX_URL", "NEXT_PUBLIC_CONVEX_URL"]);
        let auth_token = first_non_empty_env(&["FOUNDRY_CONVEX_AUTH_TOKEN", "CONVEX_AUTH_TOKEN"]);

        match (base_url, auth_token) {
            (None, None) => Ok(None),
            (Some(_), None) => Err(
                "Convex sync is partially configured: missing auth token. Set FOUNDRY_CONVEX_AUTH_TOKEN to enable desktop->Convex sync."
                    .to_string(),
            ),
            (None, Some(_)) => Err(
                "Convex sync is partially configured: missing base URL. Set FOUNDRY_CONVEX_URL (or CONVEX_URL) to enable desktop->Convex sync."
                    .to_string(),
            ),
            (Some(base_url), Some(auth_token)) => Ok(Some(Self {
                base_url,
                auth_token,
                local_device: LocalDeviceIdentity::from_env(),
                http_client: default_http_client(),
            })),
        }
    }

    pub fn build_append_batch_payload(
        &self,
        session_id: &str,
        entries: Vec<DesktopLogEntry>,
    ) -> AppendBatchFromDesktopPayload {
        AppendBatchFromDesktopPayload {
            session_id: session_id.to_string(),
            local_device_id: self.local_device.id.clone(),
            entries,
        }
    }

    pub fn build_report_local_completion_payload(
        &self,
        report: LocalCompletionReport,
    ) -> ReportLocalCompletionPayload {
        ReportLocalCompletionPayload {
            session_id: report.session_id,
            status: report.status,
            local_device_id: self.local_device.id.clone(),
            commit_sha: report.commit_sha,
            files_changed: report.files_changed,
            pr_url: report.pr_url,
            pr_number: report.pr_number,
            tokens_used: report.tokens_used,
            error: report.error,
        }
    }

    pub async fn append_batch_from_desktop(
        &self,
        payload: &AppendBatchFromDesktopPayload,
    ) -> Result<AppendBatchFromDesktopResponse, ConvexSyncError> {
        if payload.session_id.trim().is_empty() {
            return Err(ConvexSyncError::message("sessionId cannot be empty"));
        }

        if payload.entries.is_empty() {
            return Ok(AppendBatchFromDesktopResponse { inserted: 0 });
        }

        self.ensure_enabled()?;
        self.call_mutation(CONVEX_MUTATION_APPEND_BATCH_FROM_DESKTOP, payload)
            .await
    }

    pub async fn report_local_completion(
        &self,
        payload: &ReportLocalCompletionPayload,
    ) -> Result<ReportLocalCompletionResponse, ConvexSyncError> {
        if payload.session_id.trim().is_empty() {
            return Err(ConvexSyncError::message("sessionId cannot be empty"));
        }

        self.ensure_enabled()?;
        self.call_action(CONVEX_ACTION_REPORT_LOCAL_COMPLETION, payload)
            .await
    }

    pub async fn update_setup_progress(
        &self,
        payload: &UpdateSetupProgressPayload,
    ) -> Result<(), ConvexSyncError> {
        if payload.session_id.trim().is_empty() {
            return Err(ConvexSyncError::message("sessionId cannot be empty"));
        }
        if payload.stage.trim().is_empty() {
            return Err(ConvexSyncError::message("stage cannot be empty"));
        }

        self.ensure_enabled()?;
        self.call_mutation::<_, Value>(CONVEX_MUTATION_UPDATE_SETUP_PROGRESS, payload)
            .await
            .map(|_| ())
    }

    pub async fn update_runtime_mode(
        &self,
        payload: &UpdateRuntimeModePayload,
    ) -> Result<(), ConvexSyncError> {
        if payload.session_id.trim().is_empty() {
            return Err(ConvexSyncError::message("sessionId cannot be empty"));
        }
        if payload.runtime_mode.trim().is_empty() {
            return Err(ConvexSyncError::message("runtimeMode cannot be empty"));
        }

        self.ensure_enabled()?;
        self.call_mutation::<_, Value>(CONVEX_MUTATION_SET_RUNTIME_MODE, payload)
            .await
            .map(|_| ())
    }

    pub async fn append_logs(
        &self,
        session_id: &str,
        logs: &[String],
    ) -> Result<(), ConvexSyncError> {
        if session_id.trim().is_empty() {
            return Err(ConvexSyncError::message("sessionId cannot be empty"));
        }

        if logs.is_empty() {
            return Ok(());
        }

        let entries = logs
            .iter()
            .map(|line| DesktopLogEntry::stdout(line.clone()))
            .collect::<Vec<_>>();
        let payload = self.build_append_batch_payload(session_id, entries);
        self.append_batch_from_desktop(&payload).await.map(|_| ())
    }

    pub async fn report_status(
        &self,
        session_id: &str,
        status: SessionStatus,
    ) -> Result<(), ConvexSyncError> {
        if session_id.trim().is_empty() {
            return Err(ConvexSyncError::message("sessionId cannot be empty"));
        }

        match status {
            SessionStatus::Completed => {
                let report = LocalCompletionReport::completed(session_id.to_string());
                let payload = self.build_report_local_completion_payload(report);
                self.report_local_completion(&payload).await.map(|_| ())
            }
            SessionStatus::Failed => {
                let report = LocalCompletionReport::failed(
                    session_id.to_string(),
                    "Local runtime reported failure",
                );
                let payload = self.build_report_local_completion_payload(report);
                self.report_local_completion(&payload).await.map(|_| ())
            }
            _ => Ok(()),
        }
    }

    fn ensure_enabled(&self) -> Result<(), ConvexSyncError> {
        if self.base_url.trim().is_empty() || self.auth_token.trim().is_empty() {
            return Err(ConvexSyncError::message(
                "Convex sync client is disabled. Set both FOUNDRY_CONVEX_URL and FOUNDRY_CONVEX_AUTH_TOKEN to enable desktop sync.",
            ));
        }

        Ok(())
    }

    async fn call_mutation<TPayload, TResponse>(
        &self,
        path: &str,
        payload: &TPayload,
    ) -> Result<TResponse, ConvexSyncError>
    where
        TPayload: Serialize,
        TResponse: DeserializeOwned,
    {
        self.call_function("mutation", path, payload).await
    }

    async fn call_action<TPayload, TResponse>(
        &self,
        path: &str,
        payload: &TPayload,
    ) -> Result<TResponse, ConvexSyncError>
    where
        TPayload: Serialize,
        TResponse: DeserializeOwned,
    {
        self.call_function("action", path, payload).await
    }

    async fn call_function<TPayload, TResponse>(
        &self,
        function_type: &str,
        path: &str,
        payload: &TPayload,
    ) -> Result<TResponse, ConvexSyncError>
    where
        TPayload: Serialize,
        TResponse: DeserializeOwned,
    {
        let endpoint = format!(
            "{}/api/{}",
            self.base_url.trim_end_matches('/'),
            function_type
        );

        let request_body = ConvexFunctionRequest {
            path,
            format: "convex_encoded_json",
            args: [payload],
        };

        let response = self
            .http_client
            .post(endpoint)
            .bearer_auth(self.auth_token.as_str())
            .json(&request_body)
            .send()
            .await
            .map_err(|error| {
                ConvexSyncError::message(format!(
                    "Failed to call Convex {} `{}`: {}",
                    function_type, path, error
                ))
            })?;

        let status = response.status();
        let body = response.text().await.map_err(|error| {
            ConvexSyncError::message(format!("Failed to read Convex response body: {error}"))
        })?;

        if status.as_u16() == CONVEX_AUTH_EXPIRED_STATUS {
            return Err(ConvexSyncError::SyncAuthExpired);
        }

        if !status.is_success() && status.as_u16() != CONVEX_UDF_ERROR_STATUS {
            return Err(ConvexSyncError::message(format!(
                "Convex {} `{}` failed with HTTP {}: {}",
                function_type, path, status, body
            )));
        }

        let parsed =
            serde_json::from_str::<ConvexFunctionResponse<TResponse>>(&body).map_err(|error| {
                ConvexSyncError::message(format!(
                    "Failed to parse Convex {} `{}` response (status {}): {}",
                    function_type, path, status, error
                ))
            })?;

        match parsed {
            ConvexFunctionResponse::Success { value } => Ok(value),
            ConvexFunctionResponse::Error { error_message } => {
                Err(ConvexSyncError::message(format!(
                    "Convex {} `{}` returned an application error: {}",
                    function_type, path, error_message
                )))
            }
        }
    }
}

#[derive(Debug, Serialize)]
struct ConvexFunctionRequest<'a, TPayload> {
    path: &'a str,
    format: &'static str,
    args: [&'a TPayload; 1],
}

#[derive(Debug, Deserialize)]
#[serde(tag = "status", rename_all = "lowercase")]
enum ConvexFunctionResponse<T> {
    Success {
        value: T,
    },
    Error {
        #[serde(rename = "errorMessage")]
        error_message: String,
    },
}

fn first_non_empty_env(keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        env::var(key).ok().and_then(|value| {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        })
    })
}

fn default_http_client() -> reqwest::Client {
    build_http_client(
        Duration::from_secs(CONVEX_HTTP_TIMEOUT_SECS),
        Duration::from_secs(CONVEX_HTTP_CONNECT_TIMEOUT_SECS),
    )
}

fn build_http_client(timeout: Duration, connect_timeout: Duration) -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(timeout)
        .connect_timeout(connect_timeout)
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sync::payloads::{
        DesktopLogLevel, LocalCompletionStatus, SetupProgressState, UpdateRuntimeModePayload,
        UpdateSetupProgressPayload,
    };
    use serde_json::Value;
    use std::collections::HashMap;
    use std::env;
    use std::io::{Read, Write};
    use std::net::{TcpListener, TcpStream};
    use std::sync::mpsc::{self, Receiver};
    use std::sync::{Mutex, OnceLock};
    use std::thread;
    use std::time::{Duration, Instant};

    static ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    static HTTP_LOCK: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();

    const CONVEX_ENV_KEYS: [&str; 9] = [
        "FOUNDRY_CONVEX_URL",
        "CONVEX_URL",
        "NEXT_PUBLIC_CONVEX_URL",
        "FOUNDRY_CONVEX_AUTH_TOKEN",
        "CONVEX_AUTH_TOKEN",
        "FOUNDRY_LOCAL_DEVICE_ID",
        "FOUNDRY_DESKTOP_DEVICE_ID",
        "COMPUTERNAME",
        "HOSTNAME",
    ];

    struct EnvSnapshot {
        values: Vec<(&'static str, Option<String>)>,
    }

    impl EnvSnapshot {
        fn capture(keys: &[&'static str]) -> Self {
            let values = keys
                .iter()
                .map(|key| (*key, env::var(key).ok()))
                .collect::<Vec<_>>();
            Self { values }
        }
    }

    impl Drop for EnvSnapshot {
        fn drop(&mut self) {
            for (key, value) in &self.values {
                if let Some(value) = value {
                    env::set_var(key, value);
                } else {
                    env::remove_var(key);
                }
            }
        }
    }

    fn with_env_lock<T>(run: impl FnOnce() -> T) -> T {
        let _guard = ENV_LOCK
            .get_or_init(|| Mutex::new(()))
            .lock()
            .expect("env lock should be available");
        let _snapshot = EnvSnapshot::capture(&CONVEX_ENV_KEYS);
        run()
    }

    async fn acquire_http_test_lock() -> tokio::sync::MutexGuard<'static, ()> {
        HTTP_LOCK
            .get_or_init(|| tokio::sync::Mutex::new(()))
            .lock()
            .await
    }

    fn clear_convex_env() {
        for key in CONVEX_ENV_KEYS {
            env::remove_var(key);
        }
    }

    struct CapturedRequest {
        method: String,
        path: String,
        headers: HashMap<String, String>,
        body: String,
    }

    struct TestServer {
        base_url: String,
        request_rx: Receiver<Vec<u8>>,
        handle: Option<thread::JoinHandle<()>>,
    }

    impl TestServer {
        fn spawn(status_code: u16, reason_phrase: &str, body: &str) -> Self {
            let listener =
                TcpListener::bind("127.0.0.1:0").expect("test server should bind to localhost");
            listener
                .set_nonblocking(true)
                .expect("test server listener should support nonblocking mode");

            let address = listener
                .local_addr()
                .expect("test server should expose local address");
            let response = format!(
                "HTTP/1.1 {status_code} {reason_phrase}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            );

            let (request_tx, request_rx) = mpsc::channel();
            let handle = thread::spawn(move || {
                let start = Instant::now();
                let mut stream = loop {
                    match listener.accept() {
                        Ok((stream, _peer)) => break stream,
                        Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                            if start.elapsed() > Duration::from_secs(5) {
                                panic!("test server timed out waiting for connection");
                            }
                            thread::sleep(Duration::from_millis(10));
                        }
                        Err(error) => panic!("test server failed to accept connection: {error}"),
                    }
                };

                stream
                    .set_read_timeout(Some(Duration::from_secs(5)))
                    .expect("test server should set read timeout");
                let request_bytes =
                    read_http_request(&mut stream).expect("test server should capture request");
                request_tx
                    .send(request_bytes)
                    .expect("test server should publish captured request");

                stream
                    .write_all(response.as_bytes())
                    .expect("test server should write response");
                stream.flush().expect("test server should flush response");
            });

            Self {
                base_url: format!("http://{}", address),
                request_rx,
                handle: Some(handle),
            }
        }

        fn captured_request(&self) -> CapturedRequest {
            let bytes = self
                .request_rx
                .recv_timeout(Duration::from_secs(5))
                .expect("test server should receive request bytes");
            parse_http_request(&bytes)
        }
    }

    impl Drop for TestServer {
        fn drop(&mut self) {
            if let Some(handle) = self.handle.take() {
                let _ = handle.join();
            }
        }
    }

    struct HangingServer {
        base_url: String,
        handle: Option<thread::JoinHandle<()>>,
    }

    impl HangingServer {
        fn spawn(hold_for: Duration) -> Self {
            let listener =
                TcpListener::bind("127.0.0.1:0").expect("hanging server should bind to localhost");
            listener
                .set_nonblocking(true)
                .expect("hanging server listener should support nonblocking mode");

            let address = listener
                .local_addr()
                .expect("hanging server should expose local address");
            let handle = thread::spawn(move || {
                let start = Instant::now();
                let _stream = loop {
                    match listener.accept() {
                        Ok((stream, _peer)) => break stream,
                        Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                            if start.elapsed() > Duration::from_secs(5) {
                                panic!("hanging server timed out waiting for connection");
                            }
                            thread::sleep(Duration::from_millis(10));
                        }
                        Err(error) => panic!("hanging server failed to accept connection: {error}"),
                    }
                };

                thread::sleep(hold_for);
            });

            Self {
                base_url: format!("http://{}", address),
                handle: Some(handle),
            }
        }
    }

    impl Drop for HangingServer {
        fn drop(&mut self) {
            if let Some(handle) = self.handle.take() {
                let _ = handle.join();
            }
        }
    }

    fn read_http_request(stream: &mut TcpStream) -> std::io::Result<Vec<u8>> {
        let mut request_bytes = Vec::new();
        let mut chunk = [0_u8; 1024];
        let mut expected_total_len = None;
        let start = Instant::now();

        loop {
            let bytes_read = match stream.read(&mut chunk) {
                Ok(bytes_read) => bytes_read,
                Err(error)
                    if matches!(
                        error.kind(),
                        std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                    ) =>
                {
                    if let Some(expected_total_len) = expected_total_len {
                        if request_bytes.len() >= expected_total_len {
                            break;
                        }
                    }

                    if start.elapsed() > Duration::from_secs(5) {
                        return Err(error);
                    }

                    thread::sleep(Duration::from_millis(10));
                    continue;
                }
                Err(error) => return Err(error),
            };
            if bytes_read == 0 {
                break;
            }

            request_bytes.extend_from_slice(&chunk[..bytes_read]);

            if expected_total_len.is_none() {
                if let Some(header_end) = find_bytes(&request_bytes, b"\r\n\r\n") {
                    let header_text = String::from_utf8_lossy(&request_bytes[..header_end + 4]);
                    let content_length = header_text
                        .lines()
                        .find_map(|line| {
                            let (name, value) = line.split_once(':')?;
                            if name.trim().eq_ignore_ascii_case("content-length") {
                                value.trim().parse::<usize>().ok()
                            } else {
                                None
                            }
                        })
                        .unwrap_or(0);
                    expected_total_len = Some(header_end + 4 + content_length);
                }
            }

            if let Some(expected_total_len) = expected_total_len {
                if request_bytes.len() >= expected_total_len {
                    break;
                }
            }
        }

        Ok(request_bytes)
    }

    fn find_bytes(haystack: &[u8], needle: &[u8]) -> Option<usize> {
        haystack
            .windows(needle.len())
            .position(|window| window == needle)
    }

    fn parse_http_request(request_bytes: &[u8]) -> CapturedRequest {
        let request_text = String::from_utf8(request_bytes.to_vec())
            .expect("captured HTTP request should be UTF-8");
        let (head, body) = request_text
            .split_once("\r\n\r\n")
            .expect("captured request should include headers and body");

        let mut lines = head.lines();
        let request_line = lines
            .next()
            .expect("captured request should include request line");
        let mut request_parts = request_line.split_whitespace();

        let method = request_parts
            .next()
            .expect("request line should include method")
            .to_string();
        let path = request_parts
            .next()
            .expect("request line should include path")
            .to_string();

        let mut headers = HashMap::new();
        for line in lines {
            if let Some((name, value)) = line.split_once(':') {
                headers.insert(name.trim().to_ascii_lowercase(), value.trim().to_string());
            }
        }

        CapturedRequest {
            method,
            path,
            headers,
            body: body.to_string(),
        }
    }

    fn test_client(base_url: String, auth_token: &str, local_device_id: &str) -> ConvexClient {
        ConvexClient {
            base_url,
            auth_token: auth_token.to_string(),
            local_device: LocalDeviceIdentity {
                id: local_device_id.to_string(),
                name: None,
            },
            http_client: default_http_client(),
        }
    }

    fn test_log_entry(message: &str) -> DesktopLogEntry {
        DesktopLogEntry {
            timestamp: None,
            level: DesktopLogLevel::Info,
            message: message.to_string(),
            metadata: None,
        }
    }

    #[test]
    fn from_env_returns_none_when_convex_is_not_configured() {
        with_env_lock(|| {
            clear_convex_env();
            let client = ConvexClient::from_env().expect("empty Convex env should be valid");
            assert!(client.is_none(), "client should be disabled by default");
        });
    }

    #[test]
    fn from_env_returns_error_when_only_base_url_is_set() {
        with_env_lock(|| {
            clear_convex_env();
            env::set_var("FOUNDRY_CONVEX_URL", "https://convex.example");

            let error =
                ConvexClient::from_env().expect_err("missing auth token should be misconfigured");
            assert!(error.contains("missing auth token"));
        });
    }

    #[test]
    fn from_env_returns_error_when_only_auth_token_is_set() {
        with_env_lock(|| {
            clear_convex_env();
            env::set_var("FOUNDRY_CONVEX_AUTH_TOKEN", "token-123");

            let error =
                ConvexClient::from_env().expect_err("missing base URL should be misconfigured");
            assert!(error.contains("missing base URL"));
        });
    }

    #[test]
    fn from_env_returns_enabled_client_with_trimmed_values() {
        with_env_lock(|| {
            clear_convex_env();
            env::set_var("FOUNDRY_CONVEX_URL", "  https://convex.example/  ");
            env::set_var("FOUNDRY_CONVEX_AUTH_TOKEN", "  token-123  ");

            let client = ConvexClient::from_env()
                .expect("valid Convex env should parse")
                .expect("valid Convex env should enable client");
            assert_eq!(client.base_url, "https://convex.example/");
            assert_eq!(client.auth_token, "token-123");
        });
    }

    #[tokio::test]
    async fn append_batch_from_desktop_rejects_empty_session_id() {
        let client = ConvexClient::default();
        let payload = AppendBatchFromDesktopPayload {
            session_id: "   ".to_string(),
            local_device_id: "desktop-test".to_string(),
            entries: vec![test_log_entry("line 1")],
        };

        let error = client
            .append_batch_from_desktop(&payload)
            .await
            .expect_err("empty session IDs should be rejected");
        assert!(matches!(
            error,
            ConvexSyncError::Message(message) if message == "sessionId cannot be empty"
        ));
    }

    #[tokio::test]
    async fn append_batch_from_desktop_returns_zero_for_empty_entries() {
        let client = ConvexClient::default();
        let payload = AppendBatchFromDesktopPayload {
            session_id: "session-123".to_string(),
            local_device_id: "desktop-test".to_string(),
            entries: Vec::new(),
        };

        let response = client
            .append_batch_from_desktop(&payload)
            .await
            .expect("empty batches should short-circuit to success");
        assert_eq!(response.inserted, 0);
    }

    #[tokio::test]
    async fn update_runtime_mode_rejects_empty_runtime_mode_field() {
        let client = ConvexClient::default();
        let payload = UpdateRuntimeModePayload {
            session_id: "session-mode".to_string(),
            runtime_mode: " ".to_string(),
        };

        let error = client
            .update_runtime_mode(&payload)
            .await
            .expect_err("empty runtimeMode should be rejected");
        assert!(matches!(
            error,
            ConvexSyncError::Message(message) if message == "runtimeMode cannot be empty"
        ));
    }

    #[tokio::test]
    async fn append_batch_from_desktop_posts_expected_mutation_request() {
        let _lock = acquire_http_test_lock().await;
        let server = TestServer::spawn(200, "OK", r#"{"status":"success","value":{"inserted":1}}"#);
        let client = test_client(server.base_url.clone(), "convex-token", "desktop-local");
        let payload =
            client.build_append_batch_payload("session-abc", vec![test_log_entry("hello world")]);

        let response = client
            .append_batch_from_desktop(&payload)
            .await
            .expect("mutation request should succeed");
        assert_eq!(response.inserted, 1);

        let captured_request = server.captured_request();
        assert_eq!(captured_request.method, "POST");
        assert_eq!(captured_request.path, "/api/mutation");
        assert_eq!(
            captured_request.headers.get("authorization"),
            Some(&"Bearer convex-token".to_string())
        );

        let request_json: Value =
            serde_json::from_str(&captured_request.body).expect("request body should be JSON");
        assert_eq!(
            request_json["path"],
            CONVEX_MUTATION_APPEND_BATCH_FROM_DESKTOP
        );
        assert_eq!(request_json["format"], "convex_encoded_json");

        let args = request_json["args"]
            .as_array()
            .expect("request args should be an array");
        assert_eq!(args.len(), 1);

        let arg = &args[0];
        assert_eq!(arg["sessionId"], "session-abc");
        assert_eq!(arg["localDeviceId"], "desktop-local");
        assert_eq!(arg["entries"][0]["level"], "info");
        assert_eq!(arg["entries"][0]["message"], "hello world");
        assert!(arg.get("session_id").is_none());
        assert!(arg.get("local_device_id").is_none());
    }

    #[tokio::test]
    async fn report_local_completion_posts_expected_action_request() {
        let _lock = acquire_http_test_lock().await;
        let server = TestServer::spawn(
            200,
            "OK",
            r#"{"status":"success","value":{"sessionId":"session-xyz","status":"recorded"}}"#,
        );
        let client = test_client(server.base_url.clone(), "action-token", "desktop-local");
        let payload = client
            .build_report_local_completion_payload(LocalCompletionReport::completed("session-xyz"));

        let response = client
            .report_local_completion(&payload)
            .await
            .expect("action request should succeed");
        assert_eq!(response.session_id, "session-xyz");
        assert_eq!(response.status, "recorded");

        let captured_request = server.captured_request();
        assert_eq!(captured_request.method, "POST");
        assert_eq!(captured_request.path, "/api/action");
        assert_eq!(
            captured_request.headers.get("authorization"),
            Some(&"Bearer action-token".to_string())
        );

        let request_json: Value =
            serde_json::from_str(&captured_request.body).expect("request body should be JSON");
        assert_eq!(request_json["path"], CONVEX_ACTION_REPORT_LOCAL_COMPLETION);

        let args = request_json["args"]
            .as_array()
            .expect("request args should be an array");
        assert_eq!(args.len(), 1);

        let arg = &args[0];
        assert_eq!(arg["sessionId"], "session-xyz");
        assert_eq!(arg["status"], "completed");
        assert_eq!(arg["localDeviceId"], "desktop-local");
        assert!(arg.get("session_id").is_none());
        assert!(arg.get("local_device_id").is_none());
    }

    #[tokio::test]
    async fn append_batch_from_desktop_reports_non_udf_http_errors() {
        let _lock = acquire_http_test_lock().await;
        let server = TestServer::spawn(
            500,
            "Internal Server Error",
            r#"{"message":"service unavailable"}"#,
        );
        let client = test_client(server.base_url.clone(), "token-500", "desktop-local");
        let payload =
            client.build_append_batch_payload("session-500", vec![test_log_entry("line")]);

        let error = client
            .append_batch_from_desktop(&payload)
            .await
            .expect_err("non-success HTTP statuses should return errors");
        assert!(error.to_string().contains(
            "Convex mutation `sandbox/logs:appendBatchFromDesktop` failed with HTTP 500"
        ));
        assert!(error.to_string().contains("service unavailable"));
    }

    #[tokio::test]
    async fn append_batch_from_desktop_surfaces_udf_application_errors() {
        let _lock = acquire_http_test_lock().await;
        let server = TestServer::spawn(
            CONVEX_UDF_ERROR_STATUS,
            "Convex UDF Error",
            r#"{"status":"error","errorMessage":"cannot append batch"}"#,
        );
        let client = test_client(server.base_url.clone(), "token-560", "desktop-local");
        let payload =
            client.build_append_batch_payload("session-560", vec![test_log_entry("line")]);

        let error = client
            .append_batch_from_desktop(&payload)
            .await
            .expect_err("Convex application errors should return error details");
        assert!(error
            .to_string()
            .contains("returned an application error: cannot append batch"));
    }

    #[tokio::test]
    async fn append_batch_from_desktop_reports_invalid_json_response() {
        let _lock = acquire_http_test_lock().await;
        let server = TestServer::spawn(200, "OK", "this is not json");
        let client = test_client(server.base_url.clone(), "token-json", "desktop-local");
        let payload =
            client.build_append_batch_payload("session-json", vec![test_log_entry("line")]);

        let error = client
            .append_batch_from_desktop(&payload)
            .await
            .expect_err("invalid JSON should return parse errors");
        assert!(error.to_string().contains(
            "Failed to parse Convex mutation `sandbox/logs:appendBatchFromDesktop` response"
        ));
    }

    #[tokio::test]
    async fn update_setup_progress_posts_expected_mutation_request() {
        let _lock = acquire_http_test_lock().await;
        let server = TestServer::spawn(200, "OK", r#"{"status":"success","value":{"ok":true}}"#);
        let client = test_client(server.base_url.clone(), "token-setup", "desktop-local");
        let payload = UpdateSetupProgressPayload {
            session_id: "session-setup".to_string(),
            stage: "systemSetup".to_string(),
            state: SetupProgressState::Completed {
                started_at: 100,
                completed_at: 250,
            },
        };

        client
            .update_setup_progress(&payload)
            .await
            .expect("setup progress mutation should succeed");

        let captured_request = server.captured_request();
        assert_eq!(captured_request.path, "/api/mutation");
        let request_json: Value =
            serde_json::from_str(&captured_request.body).expect("request body should be JSON");
        assert_eq!(request_json["path"], CONVEX_MUTATION_UPDATE_SETUP_PROGRESS);
        assert_eq!(request_json["args"][0]["sessionId"], "session-setup");
        assert_eq!(request_json["args"][0]["stage"], "systemSetup");
        assert_eq!(request_json["args"][0]["state"]["status"], "completed");
        assert_eq!(request_json["args"][0]["state"]["startedAt"], 100);
        assert_eq!(request_json["args"][0]["state"]["completedAt"], 250);
    }

    #[tokio::test]
    async fn update_runtime_mode_posts_expected_mutation_request() {
        let _lock = acquire_http_test_lock().await;
        let server = TestServer::spawn(200, "OK", r#"{"status":"success","value":{"ok":true}}"#);
        let client = test_client(server.base_url.clone(), "token-mode", "desktop-local");
        let payload = UpdateRuntimeModePayload {
            session_id: "session-mode".to_string(),
            runtime_mode: "executing".to_string(),
        };

        client
            .update_runtime_mode(&payload)
            .await
            .expect("runtime mode mutation should succeed");

        let captured_request = server.captured_request();
        assert_eq!(captured_request.path, "/api/mutation");
        let request_json: Value =
            serde_json::from_str(&captured_request.body).expect("request body should be JSON");
        assert_eq!(request_json["path"], CONVEX_MUTATION_SET_RUNTIME_MODE);
        assert_eq!(request_json["args"][0]["sessionId"], "session-mode");
        assert_eq!(request_json["args"][0]["runtimeMode"], "executing");
        assert!(request_json["args"][0].get("mode").is_none());
    }

    #[tokio::test]
    async fn append_batch_from_desktop_returns_sync_auth_expired_for_http_401() {
        let _lock = acquire_http_test_lock().await;
        let server = TestServer::spawn(401, "Unauthorized", r#"{"message":"expired"}"#);
        let client = test_client(server.base_url.clone(), "token-expired", "desktop-local");
        let payload =
            client.build_append_batch_payload("session-auth", vec![test_log_entry("line")]);

        let error = client
            .append_batch_from_desktop(&payload)
            .await
            .expect_err("401 responses should map to SyncAuthExpired");
        assert!(matches!(error, ConvexSyncError::SyncAuthExpired));
    }

    #[tokio::test]
    async fn append_batch_from_desktop_times_out_when_server_stalls() {
        let _lock = acquire_http_test_lock().await;
        let server = HangingServer::spawn(Duration::from_secs(2));
        let client = ConvexClient {
            base_url: server.base_url.clone(),
            auth_token: "token-timeout".to_string(),
            local_device: LocalDeviceIdentity {
                id: "desktop-local".to_string(),
                name: None,
            },
            http_client: build_http_client(Duration::from_millis(200), Duration::from_millis(200)),
        };
        let payload =
            client.build_append_batch_payload("session-timeout", vec![test_log_entry("line")]);
        let started_at = Instant::now();

        let error = client
            .append_batch_from_desktop(&payload)
            .await
            .expect_err("stalled responses should time out");
        assert!(
            started_at.elapsed() < Duration::from_secs(2),
            "HTTP timeout should occur before the server closes the connection"
        );

        let message = error.to_string().to_ascii_lowercase();
        assert!(
            message.contains("timeout")
                || message.contains("timed out")
                || message.contains("deadline has elapsed"),
            "unexpected timeout message: {}",
            error
        );
    }

    #[test]
    fn report_payload_builder_includes_local_device_id() {
        let client = test_client(
            "http://localhost:1234".to_string(),
            "token",
            "desktop-local",
        );
        let payload = client
            .build_report_local_completion_payload(LocalCompletionReport::completed("session-1"));

        assert_eq!(payload.session_id, "session-1");
        assert!(matches!(
            payload.status,
            Some(LocalCompletionStatus::Completed)
        ));
        assert_eq!(payload.local_device_id, "desktop-local");
    }
}
