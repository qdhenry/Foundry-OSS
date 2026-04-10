use crate::commands::types::{SessionConfig, SessionInfo, SessionStatusResponse};
use crate::runtime::RuntimeSessionStore;
use crate::streaming::ws_server::WebSocketServer;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalConnectionInfo {
    pub ws_url: String,
    pub token: String,
    pub sandbox_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
}

fn build_terminal_connection_info(
    session_id: String,
    token: String,
    port: u16,
    cwd: Option<String>,
) -> TerminalConnectionInfo {
    TerminalConnectionInfo {
        ws_url: format!("ws://127.0.0.1:{port}/terminal/{session_id}"),
        token,
        sandbox_id: session_id,
        cwd,
    }
}

#[tauri::command]
pub async fn create_session(config: SessionConfig) -> Result<SessionInfo, String> {
    RuntimeSessionStore::default().create_session(&config)
}

#[tauri::command]
pub async fn cancel_session(session_id: String) -> Result<(), String> {
    RuntimeSessionStore::default().cancel_session(&session_id)
}

#[tauri::command]
pub async fn restart_session(session_id: String) -> Result<(), String> {
    RuntimeSessionStore::default().restart_session(&session_id)
}

#[tauri::command]
pub async fn get_session_status(session_id: String) -> Result<SessionStatusResponse, String> {
    let status = RuntimeSessionStore::default().get_status(&session_id)?;

    Ok(SessionStatusResponse { session_id, status })
}

#[tauri::command]
pub async fn get_terminal_connection_info(
    session_id: String,
) -> Result<TerminalConnectionInfo, String> {
    let store = RuntimeSessionStore::default();
    #[cfg(debug_assertions)]
    eprintln!(
        "[desktop:terminal-session] Resolving terminal connection info for session `{session_id}`"
    );

    let access = store.terminal_access(&session_id)?;
    let cwd = store.get_worktree_path(&access.session_id)?;
    let port = WebSocketServer::default().ensure_started().await?;

    #[cfg(debug_assertions)]
    eprintln!(
        "[desktop:terminal-session] Resolved terminal connection info session=`{}` cwd=`{}` wsPort={}",
        access.session_id,
        cwd.as_deref().unwrap_or("<none>"),
        port
    );

    Ok(build_terminal_connection_info(
        access.session_id,
        access.token,
        port,
        cwd,
    ))
}

#[cfg(test)]
mod tests {
    use super::{
        build_terminal_connection_info, cancel_session, create_session, get_session_status,
        restart_session, TerminalConnectionInfo,
    };
    use crate::commands::types::{RuntimeKind, SessionConfig, SessionStatus};
    use crate::runtime::RuntimeSessionStore;

    fn sample_config() -> SessionConfig {
        SessionConfig {
            org_id: "org-test".to_string(),
            project_id: "project-test".to_string(),
            repository_path: ".".to_string(),
            base_branch: "main".to_string(),
            runtime: RuntimeKind::Local,
        }
    }

    #[tokio::test]
    async fn create_session_and_get_status_round_trip() {
        let _guard = RuntimeSessionStore::acquire_test_lock();
        let store = RuntimeSessionStore::default();
        store.reset_for_tests();

        let created = create_session(sample_config())
            .await
            .expect("session should be created");
        let status = get_session_status(created.session_id.clone())
            .await
            .expect("session status should be returned");

        assert_eq!(status.session_id, created.session_id);
        assert!(matches!(status.status, SessionStatus::Queued));
    }

    #[tokio::test]
    async fn cancel_and_restart_commands_delegate_to_runtime_store() {
        let _guard = RuntimeSessionStore::acquire_test_lock();
        let store = RuntimeSessionStore::default();
        store.reset_for_tests();

        let created = create_session(sample_config())
            .await
            .expect("session should be created");

        cancel_session(created.session_id.clone())
            .await
            .expect("cancel command should succeed");
        let cancelled_status = get_session_status(created.session_id.clone())
            .await
            .expect("status should be returned");
        assert!(matches!(cancelled_status.status, SessionStatus::Cancelled));

        restart_session(created.session_id.clone())
            .await
            .expect("restart command should succeed");
        let restarted_status = get_session_status(created.session_id)
            .await
            .expect("status should be returned");
        assert!(matches!(restarted_status.status, SessionStatus::Queued));
    }

    #[test]
    fn terminal_connection_info_includes_cwd_and_existing_ws_fields() {
        let _guard = RuntimeSessionStore::acquire_test_lock();
        let store = RuntimeSessionStore::default();
        store.reset_for_tests();

        let created = store
            .create_session(&sample_config())
            .expect("session should be created");
        store
            .set_worktree_path(&created.session_id, Some("/tmp/worktree-path".to_string()))
            .expect("worktree path should be set");
        let access = store
            .terminal_access(&created.session_id)
            .expect("terminal access should be available");
        let cwd = store
            .get_worktree_path(&created.session_id)
            .expect("worktree path lookup should succeed");

        let payload = build_terminal_connection_info(access.session_id, access.token, 3000, cwd);

        assert_eq!(payload.sandbox_id, created.session_id);
        assert_eq!(payload.cwd.as_deref(), Some("/tmp/worktree-path"));
        assert!(!payload.token.trim().is_empty());
        assert_eq!(
            payload.ws_url,
            format!("ws://127.0.0.1:3000/terminal/{}", payload.sandbox_id)
        );
    }

    #[test]
    fn terminal_connection_info_serializes_as_camel_case() {
        let payload = TerminalConnectionInfo {
            ws_url: "ws://127.0.0.1:3000/terminal/session-1".to_string(),
            token: "terminal-token".to_string(),
            sandbox_id: "session-1".to_string(),
            cwd: Some("/tmp/worktree-path".to_string()),
        };

        let value = serde_json::to_value(payload).expect("serialization should succeed");
        assert_eq!(
            value.get("wsUrl").and_then(|field| field.as_str()),
            Some("ws://127.0.0.1:3000/terminal/session-1")
        );
        assert_eq!(
            value.get("token").and_then(|field| field.as_str()),
            Some("terminal-token")
        );
        assert_eq!(
            value.get("sandboxId").and_then(|field| field.as_str()),
            Some("session-1")
        );
        assert_eq!(
            value.get("cwd").and_then(|field| field.as_str()),
            Some("/tmp/worktree-path")
        );
    }

    #[test]
    fn terminal_connection_info_omits_cwd_when_absent() {
        let payload = TerminalConnectionInfo {
            ws_url: "ws://127.0.0.1:3000/terminal/session-1".to_string(),
            token: "terminal-token".to_string(),
            sandbox_id: "session-1".to_string(),
            cwd: None,
        };

        let value = serde_json::to_value(payload).expect("serialization should succeed");
        assert!(value.get("cwd").is_none());
    }
}
