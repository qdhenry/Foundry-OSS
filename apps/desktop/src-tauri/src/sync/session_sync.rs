use crate::commands::types::SessionStatus;
use crate::sync::convex_client::{ConvexClient, ConvexSyncError};
use crate::sync::payloads::{
    DesktopLogEntry, LocalCompletionReport, LocalCompletionStatus, SetupProgressState,
    UpdateRuntimeModePayload, UpdateSetupProgressPayload,
};

#[derive(Debug, Clone)]
enum SessionSyncMode {
    Disabled,
    Enabled(ConvexClient),
    Misconfigured(String),
}

#[derive(Debug, Clone)]
pub struct SessionSync {
    mode: SessionSyncMode,
}

impl Default for SessionSync {
    fn default() -> Self {
        match ConvexClient::from_env() {
            Ok(Some(client)) => Self {
                mode: SessionSyncMode::Enabled(client),
            },
            Ok(None) => Self {
                mode: SessionSyncMode::Disabled,
            },
            Err(error) => Self {
                mode: SessionSyncMode::Misconfigured(error),
            },
        }
    }
}

impl SessionSync {
    pub async fn append_log_batch(
        &self,
        session_id: &str,
        entries: &[DesktopLogEntry],
    ) -> Result<(), String> {
        if session_id.trim().is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }

        if entries.is_empty() {
            return Ok(());
        }

        match &self.mode {
            SessionSyncMode::Disabled => Ok(()),
            SessionSyncMode::Misconfigured(error) => Err(error.clone()),
            SessionSyncMode::Enabled(client) => {
                let payload = client.build_append_batch_payload(session_id, entries.to_vec());
                client
                    .append_batch_from_desktop(&payload)
                    .await
                    .map(|_| ())
                    .map_err(map_convex_error)
            }
        }
    }

    pub async fn report_local_completion(
        &self,
        report: LocalCompletionReport,
    ) -> Result<(), String> {
        if report.session_id.trim().is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }

        match &self.mode {
            SessionSyncMode::Disabled => Ok(()),
            SessionSyncMode::Misconfigured(error) => Err(error.clone()),
            SessionSyncMode::Enabled(client) => {
                let payload = client.build_report_local_completion_payload(report);
                client
                    .report_local_completion(&payload)
                    .await
                    .map(|_| ())
                    .map_err(map_convex_error)
            }
        }
    }

    pub async fn report_stage_progress(
        &self,
        session_id: &str,
        stage: &str,
        state: SetupProgressState,
    ) -> Result<(), String> {
        if session_id.trim().is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }
        if stage.trim().is_empty() {
            return Err("stage cannot be empty".to_string());
        }

        match &self.mode {
            SessionSyncMode::Disabled => Ok(()),
            SessionSyncMode::Misconfigured(error) => Err(error.clone()),
            SessionSyncMode::Enabled(client) => {
                let payload = UpdateSetupProgressPayload {
                    session_id: session_id.to_string(),
                    stage: stage.to_string(),
                    state,
                };
                client
                    .update_setup_progress(&payload)
                    .await
                    .map_err(map_convex_error)
            }
        }
    }

    pub async fn update_runtime_mode(&self, session_id: &str, mode: &str) -> Result<(), String> {
        if session_id.trim().is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }
        if mode.trim().is_empty() {
            return Err("mode cannot be empty".to_string());
        }

        match &self.mode {
            SessionSyncMode::Disabled => Ok(()),
            SessionSyncMode::Misconfigured(error) => Err(error.clone()),
            SessionSyncMode::Enabled(client) => {
                let payload = UpdateRuntimeModePayload {
                    session_id: session_id.to_string(),
                    runtime_mode: mode.to_string(),
                };
                client
                    .update_runtime_mode(&payload)
                    .await
                    .map_err(map_convex_error)
            }
        }
    }

    pub async fn sync_status(&self, session_id: &str, status: SessionStatus) -> Result<(), String> {
        if session_id.trim().is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }

        match status {
            SessionStatus::Completed => {
                self.report_local_completion(LocalCompletionReport::completed(
                    session_id.to_string(),
                ))
                .await
            }
            SessionStatus::Failed => {
                self.report_local_completion(LocalCompletionReport {
                    session_id: session_id.to_string(),
                    status: Some(LocalCompletionStatus::Failed),
                    error: Some("Local runtime reported failure".to_string()),
                    ..LocalCompletionReport::default()
                })
                .await
            }
            _ => Ok(()),
        }
    }
}

fn map_convex_error(error: ConvexSyncError) -> String {
    match error {
        ConvexSyncError::SyncAuthExpired => {
            "SyncAuthExpired: Convex auth token expired (HTTP 401). Refresh authentication in desktop settings."
                .to_string()
        }
        ConvexSyncError::Message(message) => message,
    }
}

#[cfg(test)]
mod tests {
    use super::SessionSync;
    use crate::commands::types::SessionStatus;
    use crate::runtime::RuntimeSessionStore;
    use crate::sync::payloads::{DesktopLogEntry, LocalCompletionReport, SetupProgressState};
    use std::collections::HashMap;
    use std::env;

    const SYNC_ENV_KEYS: [&str; 5] = [
        "FOUNDRY_CONVEX_URL",
        "CONVEX_URL",
        "NEXT_PUBLIC_CONVEX_URL",
        "FOUNDRY_CONVEX_AUTH_TOKEN",
        "CONVEX_AUTH_TOKEN",
    ];

    struct EnvGuard {
        original: HashMap<String, Option<String>>,
    }

    impl EnvGuard {
        fn unset(keys: &[&str]) -> Self {
            let mut original = HashMap::with_capacity(keys.len());
            for key in keys {
                original.insert((*key).to_string(), env::var(key).ok());
                env::remove_var(key);
            }

            Self { original }
        }
    }

    impl Drop for EnvGuard {
        fn drop(&mut self) {
            for (key, value) in &self.original {
                if let Some(value) = value {
                    env::set_var(key, value);
                } else {
                    env::remove_var(key);
                }
            }
        }
    }

    #[tokio::test]
    async fn append_log_batch_rejects_empty_session_id() {
        let _test_lock = RuntimeSessionStore::acquire_test_lock();
        let _env_guard = EnvGuard::unset(&SYNC_ENV_KEYS);
        let sync = SessionSync::default();

        let error = sync
            .append_log_batch("  ", &[DesktopLogEntry::stdout("hello")])
            .await
            .expect_err("empty session id should fail");
        assert_eq!(error, "sessionId cannot be empty");
    }

    #[tokio::test]
    async fn report_local_completion_rejects_empty_session_id() {
        let _test_lock = RuntimeSessionStore::acquire_test_lock();
        let _env_guard = EnvGuard::unset(&SYNC_ENV_KEYS);
        let sync = SessionSync::default();

        let error = sync
            .report_local_completion(LocalCompletionReport::completed("   "))
            .await
            .expect_err("empty session id should fail");
        assert_eq!(error, "sessionId cannot be empty");
    }

    #[tokio::test]
    async fn sync_status_rejects_empty_session_id() {
        let _test_lock = RuntimeSessionStore::acquire_test_lock();
        let _env_guard = EnvGuard::unset(&SYNC_ENV_KEYS);
        let sync = SessionSync::default();

        let error = sync
            .sync_status(" ", SessionStatus::Completed)
            .await
            .expect_err("empty session id should fail");
        assert_eq!(error, "sessionId cannot be empty");
    }

    #[tokio::test]
    async fn operations_are_noop_success_when_sync_is_disabled() {
        let _test_lock = RuntimeSessionStore::acquire_test_lock();
        let _env_guard = EnvGuard::unset(&SYNC_ENV_KEYS);
        let sync = SessionSync::default();

        sync.append_log_batch("session-1", &[DesktopLogEntry::stdout("line")])
            .await
            .expect("append should be a no-op success when sync is disabled");
        sync.report_local_completion(LocalCompletionReport::completed("session-1"))
            .await
            .expect("report should be a no-op success when sync is disabled");
        sync.sync_status("session-1", SessionStatus::Completed)
            .await
            .expect("sync_status should be a no-op success when sync is disabled");
        sync.report_stage_progress("session-1", "systemSetup", SetupProgressState::Pending)
            .await
            .expect("setup progress should be a no-op success when sync is disabled");
        sync.update_runtime_mode("session-1", "executing")
            .await
            .expect("runtime mode should be a no-op success when sync is disabled");
    }

    #[tokio::test]
    async fn operations_return_misconfiguration_error_when_partially_configured() {
        let _test_lock = RuntimeSessionStore::acquire_test_lock();
        let _env_guard = EnvGuard::unset(&SYNC_ENV_KEYS);
        env::set_var("FOUNDRY_CONVEX_URL", "https://example.convex.cloud");
        let sync = SessionSync::default();

        let append_error = sync
            .append_log_batch("session-1", &[DesktopLogEntry::stdout("line")])
            .await
            .expect_err("append should fail for misconfigured sync");
        assert!(
            append_error.contains("missing auth token"),
            "unexpected append error: {append_error}"
        );

        let report_error = sync
            .report_local_completion(LocalCompletionReport::completed("session-1"))
            .await
            .expect_err("report should fail for misconfigured sync");
        assert!(
            report_error.contains("missing auth token"),
            "unexpected report error: {report_error}"
        );

        let status_error = sync
            .sync_status("session-1", SessionStatus::Completed)
            .await
            .expect_err("sync_status should fail for misconfigured sync");
        assert!(
            status_error.contains("missing auth token"),
            "unexpected status error: {status_error}"
        );
    }

    #[tokio::test]
    async fn sync_status_non_terminal_statuses_return_success_without_sync_call() {
        let _test_lock = RuntimeSessionStore::acquire_test_lock();
        let _env_guard = EnvGuard::unset(&SYNC_ENV_KEYS);
        env::set_var("FOUNDRY_CONVEX_URL", "https://example.convex.cloud");
        let sync = SessionSync::default();

        sync.sync_status("session-1", SessionStatus::Running)
            .await
            .expect("non-terminal statuses should be treated as no-op success");
    }

    #[tokio::test]
    async fn report_stage_progress_rejects_empty_inputs() {
        let _test_lock = RuntimeSessionStore::acquire_test_lock();
        let _env_guard = EnvGuard::unset(&SYNC_ENV_KEYS);
        let sync = SessionSync::default();

        let missing_session = sync
            .report_stage_progress(" ", "systemSetup", SetupProgressState::Pending)
            .await
            .expect_err("empty session id should fail");
        assert_eq!(missing_session, "sessionId cannot be empty");

        let missing_stage = sync
            .report_stage_progress("session-1", " ", SetupProgressState::Pending)
            .await
            .expect_err("empty stage should fail");
        assert_eq!(missing_stage, "stage cannot be empty");
    }

    #[tokio::test]
    async fn update_runtime_mode_rejects_empty_inputs() {
        let _test_lock = RuntimeSessionStore::acquire_test_lock();
        let _env_guard = EnvGuard::unset(&SYNC_ENV_KEYS);
        let sync = SessionSync::default();

        let missing_session = sync
            .update_runtime_mode(" ", "executing")
            .await
            .expect_err("empty session id should fail");
        assert_eq!(missing_session, "sessionId cannot be empty");

        let missing_mode = sync
            .update_runtime_mode("session-1", " ")
            .await
            .expect_err("empty mode should fail");
        assert_eq!(missing_mode, "mode cannot be empty");
    }
}
