use crate::commands::types::{SessionConfig, SessionInfo, SessionStatus};
use crate::streaming::log_buffer::{LogBuffer, LogEntry};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{OnceLock, RwLock, RwLockReadGuard, RwLockWriteGuard};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone)]
pub struct TerminalSessionAccess {
    pub session_id: String,
    pub token: String,
}

#[derive(Debug, Clone)]
struct RuntimeSession {
    status: SessionStatus,
    terminal_token: String,
    worktree_path: Option<String>,
    logs: LogBuffer,
}

#[derive(Debug, Default)]
struct RuntimeSessionStoreInner {
    sessions: HashMap<String, RuntimeSession>,
    token_to_session_id: HashMap<String, String>,
}

#[derive(Debug, Default, Clone, Copy)]
pub struct RuntimeSessionStore;

static RUNTIME_STORE: OnceLock<RwLock<RuntimeSessionStoreInner>> = OnceLock::new();
static ID_COUNTER: AtomicU64 = AtomicU64::new(1);
#[cfg(test)]
static RUNTIME_TEST_LOCK: OnceLock<std::sync::Mutex<()>> = OnceLock::new();

impl RuntimeSessionStore {
    fn store(&self) -> &'static RwLock<RuntimeSessionStoreInner> {
        RUNTIME_STORE.get_or_init(|| RwLock::new(RuntimeSessionStoreInner::default()))
    }

    fn read_store(&self) -> Result<RwLockReadGuard<'static, RuntimeSessionStoreInner>, String> {
        self.store()
            .read()
            .map_err(|_| "runtime session store is unavailable".to_string())
    }

    fn write_store(&self) -> Result<RwLockWriteGuard<'static, RuntimeSessionStoreInner>, String> {
        self.store()
            .write()
            .map_err(|_| "runtime session store is unavailable".to_string())
    }

    #[cfg(test)]
    pub(crate) fn acquire_test_lock() -> std::sync::MutexGuard<'static, ()> {
        RUNTIME_TEST_LOCK
            .get_or_init(|| std::sync::Mutex::new(()))
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    #[cfg(test)]
    pub(crate) fn reset_for_tests(&self) {
        if let Some(store) = RUNTIME_STORE.get() {
            let mut store = store
                .write()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            store.sessions.clear();
            store.token_to_session_id.clear();
        }

        ID_COUNTER.store(1, Ordering::Relaxed);
    }

    pub fn create_session(&self, config: &SessionConfig) -> Result<SessionInfo, String> {
        let session_id = next_identifier("session");
        self.create_session_internal(session_id, config, false)
    }

    pub fn create_session_with_id(
        &self,
        session_id: &str,
        config: &SessionConfig,
    ) -> Result<SessionInfo, String> {
        let normalized = session_id.trim();
        if normalized.is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }

        self.create_session_internal(normalized.to_string(), config, true)
    }

    fn create_session_internal(
        &self,
        session_id: String,
        config: &SessionConfig,
        allow_existing: bool,
    ) -> Result<SessionInfo, String> {
        if config.repository_path.trim().is_empty() {
            return Err("repositoryPath cannot be empty".to_string());
        }

        let runtime = config.runtime.clone();
        let existing_status = {
            let store = self.read_store()?;
            store
                .sessions
                .get(&session_id)
                .map(|session| session.status.clone())
        };

        if let Some(status) = existing_status {
            if allow_existing {
                return Ok(SessionInfo {
                    session_id,
                    status,
                    runtime,
                });
            }

            return Err(format!("session {session_id} already exists"));
        }

        let terminal_token = next_identifier("terminal");

        let mut store = self.write_store()?;
        let mut logs = LogBuffer::default();
        logs.push(format!("Session created for project {}", config.project_id));
        store
            .token_to_session_id
            .insert(terminal_token.clone(), session_id.clone());
        store.sessions.insert(
            session_id.clone(),
            RuntimeSession {
                status: SessionStatus::Queued,
                terminal_token,
                worktree_path: Some(config.repository_path.trim().to_string()),
                logs,
            },
        );

        Ok(SessionInfo {
            session_id,
            status: SessionStatus::Queued,
            runtime,
        })
    }

    pub fn ensure_session_exists(&self, session_id: &str) -> Result<(), String> {
        if session_id.trim().is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }

        let store = self.read_store()?;
        if store.sessions.contains_key(session_id) {
            Ok(())
        } else {
            Err(format!("session {session_id} not found"))
        }
    }

    pub fn get_status(&self, session_id: &str) -> Result<SessionStatus, String> {
        if session_id.trim().is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }

        let store = self.read_store()?;
        store
            .sessions
            .get(session_id)
            .map(|session| session.status.clone())
            .ok_or_else(|| format!("session {session_id} not found"))
    }

    pub fn set_status(&self, session_id: &str, status: SessionStatus) -> Result<(), String> {
        if session_id.trim().is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }

        let mut store = self.write_store()?;
        let session = store
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("session {session_id} not found"))?;
        session.status = status;

        Ok(())
    }

    pub fn cancel_session(&self, session_id: &str) -> Result<(), String> {
        if session_id.trim().is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }

        let mut store = self.write_store()?;
        let session = store
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("session {session_id} not found"))?;

        match session.status {
            SessionStatus::Completed | SessionStatus::Cancelled | SessionStatus::Failed => {
                Err(format!(
                    "cannot cancel session in {} status",
                    status_label(&session.status)
                ))
            }
            _ => {
                session.status = SessionStatus::Cancelled;
                session.logs.push("Session cancelled".to_string());
                Ok(())
            }
        }
    }

    pub fn restart_session(&self, session_id: &str) -> Result<(), String> {
        if session_id.trim().is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }

        let mut store = self.write_store()?;
        let session = store
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("session {session_id} not found"))?;

        match session.status {
            SessionStatus::Running | SessionStatus::Preparing => {
                Err("cannot restart a session while it is active".to_string())
            }
            _ => {
                session.status = SessionStatus::Queued;
                session.logs.push("Session restarted".to_string());
                Ok(())
            }
        }
    }

    pub fn terminal_access(&self, session_id: &str) -> Result<TerminalSessionAccess, String> {
        if session_id.trim().is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }

        let store = self.read_store()?;
        let session = store
            .sessions
            .get(session_id)
            .ok_or_else(|| format!("session {session_id} not found"))?;

        Ok(TerminalSessionAccess {
            session_id: session_id.to_string(),
            token: session.terminal_token.clone(),
        })
    }

    pub fn validate_terminal_access(&self, session_id: &str, token: &str) -> Result<(), String> {
        let normalized_session_id = session_id.trim();
        if normalized_session_id.is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }

        let normalized_token = token.trim();
        if normalized_token.is_empty() {
            return Err("token cannot be empty".to_string());
        }

        let store = self.read_store()?;
        infer_session_id(&store, Some(normalized_session_id), Some(normalized_token))
            .map(|_| ())
            .ok_or_else(|| "terminal access denied".to_string())
    }

    pub fn append_log(&self, session_id: &str, message: impl Into<String>) -> Result<(), String> {
        if session_id.trim().is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }

        let mut store = self.write_store()?;
        let session = store
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("session {session_id} not found"))?;
        session.logs.push(message.into());

        Ok(())
    }

    pub fn set_worktree_path(
        &self,
        session_id: &str,
        worktree_path: Option<String>,
    ) -> Result<(), String> {
        if session_id.trim().is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }

        let normalized = worktree_path.map(|path| path.trim().to_string());
        if normalized.as_ref().is_some_and(|path| path.is_empty()) {
            return Err("worktreePath cannot be empty".to_string());
        }

        let mut store = self.write_store()?;
        let session = store
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("session {session_id} not found"))?;
        session.worktree_path = normalized;

        Ok(())
    }

    pub fn get_worktree_path(&self, session_id: &str) -> Result<Option<String>, String> {
        if session_id.trim().is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }

        let store = self.read_store()?;
        let session = store
            .sessions
            .get(session_id)
            .ok_or_else(|| format!("session {session_id} not found"))?;
        Ok(session.worktree_path.clone())
    }

    pub fn append_log_with_context(
        &self,
        session_hint: Option<&str>,
        token_hint: Option<&str>,
        message: String,
    ) -> Option<String> {
        let session_hint =
            session_hint.and_then(|value| (!value.trim().is_empty()).then_some(value.to_string()));
        let token_hint =
            token_hint.and_then(|value| (!value.trim().is_empty()).then_some(value.to_string()));

        let mut store = self.write_store().ok()?;
        let inferred_session_id =
            infer_session_id(&store, session_hint.as_deref(), token_hint.as_deref())?;
        let session = store.sessions.get_mut(&inferred_session_id)?;
        session.logs.push(message);

        Some(inferred_session_id)
    }

    pub fn entries_after(&self, session_id: &str, cursor: u64) -> Result<Vec<LogEntry>, String> {
        if session_id.trim().is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }

        let store = self.read_store()?;
        let session = store
            .sessions
            .get(session_id)
            .ok_or_else(|| format!("session {session_id} not found"))?;

        Ok(session.logs.entries_after(cursor))
    }
}

fn infer_session_id(
    store: &RuntimeSessionStoreInner,
    session_hint: Option<&str>,
    token_hint: Option<&str>,
) -> Option<String> {
    match (session_hint, token_hint) {
        (Some(session_id), Some(token)) => {
            let session_by_token = store.token_to_session_id.get(token)?;
            (session_by_token == session_id && store.sessions.contains_key(session_id))
                .then_some(session_id.to_string())
        }
        (Some(session_id), None) => store
            .sessions
            .contains_key(session_id)
            .then_some(session_id.to_string()),
        (None, Some(token)) => store.token_to_session_id.get(token).cloned(),
        (None, None) => None,
    }
}

fn next_identifier(prefix: &str) -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let counter = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{prefix}-{millis:x}-{counter:x}")
}

fn status_label(status: &SessionStatus) -> &'static str {
    match status {
        SessionStatus::Queued => "queued",
        SessionStatus::Preparing => "preparing",
        SessionStatus::Running => "running",
        SessionStatus::Completed => "completed",
        SessionStatus::Cancelled => "cancelled",
        SessionStatus::Failed => "failed",
    }
}

#[cfg(test)]
mod tests {
    use super::RuntimeSessionStore;
    use crate::commands::types::{RuntimeKind, SessionConfig, SessionStatus};

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
    fn create_session_sets_queued_status_and_creation_log() {
        let _guard = RuntimeSessionStore::acquire_test_lock();
        let store = RuntimeSessionStore::default();
        store.reset_for_tests();

        let session = store
            .create_session(&sample_config())
            .expect("session should be created");
        let status = store
            .get_status(&session.session_id)
            .expect("session status should be readable");
        assert!(matches!(status, SessionStatus::Queued));

        let access = store
            .terminal_access(&session.session_id)
            .expect("terminal token should exist");
        assert_eq!(access.session_id, session.session_id);
        assert!(!access.token.trim().is_empty());

        let entries = store
            .entries_after(&session.session_id, 0)
            .expect("session logs should be readable");
        assert!(entries.iter().any(|entry| entry
            .message
            .contains("Session created for project project-test")));
    }

    #[test]
    fn create_session_with_id_is_idempotent_for_existing_sessions() {
        let _guard = RuntimeSessionStore::acquire_test_lock();
        let store = RuntimeSessionStore::default();
        store.reset_for_tests();

        let session = store
            .create_session_with_id("convex-session-1", &sample_config())
            .expect("session should be created with explicit id");
        assert_eq!(session.session_id, "convex-session-1");

        store
            .set_status("convex-session-1", SessionStatus::Running)
            .expect("status should update");
        let reused = store
            .create_session_with_id("convex-session-1", &sample_config())
            .expect("existing explicit session should be reusable");
        assert_eq!(reused.session_id, "convex-session-1");
        assert!(matches!(reused.status, SessionStatus::Running));
    }

    #[test]
    fn worktree_path_can_be_set_and_retrieved_per_session() {
        let _guard = RuntimeSessionStore::acquire_test_lock();
        let store = RuntimeSessionStore::default();
        store.reset_for_tests();

        let session = store
            .create_session(&sample_config())
            .expect("session should be created");
        assert_eq!(
            store
                .get_worktree_path(&session.session_id)
                .expect("getter should succeed"),
            Some(".".to_string())
        );

        store
            .set_worktree_path(&session.session_id, Some("/tmp/worktree-a".to_string()))
            .expect("setter should persist worktree path");
        assert_eq!(
            store
                .get_worktree_path(&session.session_id)
                .expect("getter should succeed"),
            Some("/tmp/worktree-a".to_string())
        );

        store
            .set_worktree_path(&session.session_id, None)
            .expect("setter should allow clearing worktree path");
        assert_eq!(
            store
                .get_worktree_path(&session.session_id)
                .expect("getter should succeed"),
            None
        );
    }

    #[test]
    fn cancel_and_restart_follow_expected_lifecycle() {
        let _guard = RuntimeSessionStore::acquire_test_lock();
        let store = RuntimeSessionStore::default();
        store.reset_for_tests();

        let session = store
            .create_session(&sample_config())
            .expect("session should be created");

        store
            .cancel_session(&session.session_id)
            .expect("queued session should be cancellable");
        assert!(matches!(
            store
                .get_status(&session.session_id)
                .expect("status should exist after cancel"),
            SessionStatus::Cancelled
        ));

        store
            .restart_session(&session.session_id)
            .expect("cancelled session should restart to queued");
        assert!(matches!(
            store
                .get_status(&session.session_id)
                .expect("status should exist after restart"),
            SessionStatus::Queued
        ));

        store
            .set_status(&session.session_id, SessionStatus::Completed)
            .expect("status update should succeed");
        let error = store
            .cancel_session(&session.session_id)
            .expect_err("completed session should not be cancellable");
        assert!(error.contains("cannot cancel session in completed status"));

        let logs = store
            .entries_after(&session.session_id, 0)
            .expect("logs should be readable");
        assert!(logs
            .iter()
            .any(|entry| entry.message == "Session cancelled"));
        assert!(logs
            .iter()
            .any(|entry| entry.message == "Session restarted"));
    }

    #[test]
    fn restart_rejects_active_statuses() {
        let _guard = RuntimeSessionStore::acquire_test_lock();
        let store = RuntimeSessionStore::default();
        store.reset_for_tests();

        let session = store
            .create_session(&sample_config())
            .expect("session should be created");

        for status in [SessionStatus::Running, SessionStatus::Preparing] {
            store
                .set_status(&session.session_id, status)
                .expect("status update should succeed");
            let error = store
                .restart_session(&session.session_id)
                .expect_err("active session should not restart");
            assert!(error.contains("cannot restart a session while it is active"));
        }
    }

    #[test]
    fn append_log_with_context_maps_token_and_session_hints() {
        let _guard = RuntimeSessionStore::acquire_test_lock();
        let store = RuntimeSessionStore::default();
        store.reset_for_tests();

        let first = store
            .create_session(&sample_config())
            .expect("session should be created");
        let second = store
            .create_session(&sample_config())
            .expect("session should be created");
        let access = store
            .terminal_access(&first.session_id)
            .expect("terminal token should exist");

        let by_both = store.append_log_with_context(
            Some(&first.session_id),
            Some(&access.token),
            "first context log".to_string(),
        );
        let by_token =
            store.append_log_with_context(None, Some(&access.token), "token only log".to_string());
        let mismatched = store.append_log_with_context(
            Some(&second.session_id),
            Some(&access.token),
            "should not append".to_string(),
        );
        let no_context = store.append_log_with_context(None, None, "ignored".to_string());

        assert_eq!(by_both, Some(first.session_id.clone()));
        assert_eq!(by_token, Some(first.session_id.clone()));
        assert!(mismatched.is_none());
        assert!(no_context.is_none());

        let logs = store
            .entries_after(&first.session_id, 0)
            .expect("logs should exist");
        assert!(logs
            .iter()
            .any(|entry| entry.message == "first context log"));
        assert!(logs.iter().any(|entry| entry.message == "token only log"));
    }

    #[test]
    fn validate_terminal_access_accepts_matching_session_and_token() {
        let _guard = RuntimeSessionStore::acquire_test_lock();
        let store = RuntimeSessionStore::default();
        store.reset_for_tests();

        let session = store
            .create_session(&sample_config())
            .expect("session should be created");
        let access = store
            .terminal_access(&session.session_id)
            .expect("terminal access should exist");

        store
            .validate_terminal_access(&session.session_id, &access.token)
            .expect("matching terminal credentials should validate");
    }

    #[test]
    fn validate_terminal_access_rejects_mismatched_tokens() {
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

        let error = store
            .validate_terminal_access(&second.session_id, &first_access.token)
            .expect_err("mismatched token should fail validation");
        assert_eq!(error, "terminal access denied");
    }

    #[test]
    fn validate_terminal_access_rejects_empty_token() {
        let _guard = RuntimeSessionStore::acquire_test_lock();
        let store = RuntimeSessionStore::default();
        store.reset_for_tests();

        let session = store
            .create_session(&sample_config())
            .expect("session should be created");
        let error = store
            .validate_terminal_access(&session.session_id, "   ")
            .expect_err("empty token should fail validation");
        assert_eq!(error, "token cannot be empty");
    }

    #[test]
    fn entries_after_filters_using_cursor() {
        let _guard = RuntimeSessionStore::acquire_test_lock();
        let store = RuntimeSessionStore::default();
        store.reset_for_tests();

        let session = store
            .create_session(&sample_config())
            .expect("session should be created");
        store
            .append_log(&session.session_id, "line one")
            .expect("line one should append");
        store
            .append_log(&session.session_id, "line two")
            .expect("line two should append");

        let all = store
            .entries_after(&session.session_id, 0)
            .expect("all logs should be readable");
        let from_second = store
            .entries_after(&session.session_id, all[1].cursor)
            .expect("filtered logs should be readable");

        assert!(all.len() >= 3);
        assert_eq!(from_second.len(), all.len() - 2);
        assert_eq!(
            from_second.first().map(|entry| entry.message.as_str()),
            Some("line two")
        );
    }
}
