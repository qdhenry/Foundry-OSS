use crate::commands::types::{
    ChatMessageRequest, ExecutionHandle, SessionStatus, StartExecutionRequest,
};
use crate::execution::claude_cli::ClaudeCliRunner;
use crate::execution::claude_sdk::ClaudeSdkRunner;
use crate::execution::hooks::AutoCommitHook;
use crate::execution::jsonl_parser::RunnerExecutionResult;
use crate::runtime::RuntimeSessionStore;
use crate::sync::batch_sender::BatchSender;
use crate::sync::session_sync::SessionSync;
use std::env;
use std::mem;
use std::time::Duration;

const EXECUTION_MODE_ENV: &str = "FOUNDRY_EXECUTION_MODE";
const RUNNER_HEARTBEAT_INTERVAL: Duration = Duration::from_secs(15);
#[cfg(test)]
static TEST_RUNNER_OVERRIDE: std::sync::OnceLock<
    std::sync::Mutex<Option<Result<RunnerExecutionResult, String>>>,
> = std::sync::OnceLock::new();

#[derive(Debug, Default, Clone, Copy)]
pub struct LocalExecutionEngine;

#[derive(Debug, Clone, Copy)]
enum ExecutionMode {
    Cli,
    Sdk,
}

impl ExecutionMode {
    fn resolve() -> Result<Self, String> {
        if let Ok(raw_value) = env::var(EXECUTION_MODE_ENV) {
            let normalized = raw_value.trim().to_ascii_lowercase();
            if normalized.is_empty() {
                return Err(format!(
                    "{EXECUTION_MODE_ENV} is set but empty. Use 'cli' or 'sdk'."
                ));
            }

            return match normalized.as_str() {
                "cli" => Ok(Self::Cli),
                "sdk" => Ok(Self::Sdk),
                _ => Err(format!(
                    "Unsupported {EXECUTION_MODE_ENV} value '{raw_value}'. Allowed values: cli, sdk."
                )),
            };
        }

        if ClaudeCliRunner::configured_binary_available() {
            Ok(Self::Cli)
        } else {
            Ok(Self::Sdk)
        }
    }

    fn label(&self) -> &'static str {
        match self {
            Self::Cli => "cli",
            Self::Sdk => "sdk",
        }
    }
}

impl LocalExecutionEngine {
    pub async fn start(&self, request: &StartExecutionRequest) -> Result<ExecutionHandle, String> {
        if request.session_id.trim().is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }

        let store = RuntimeSessionStore::default();
        store.ensure_session_exists(&request.session_id)?;
        let session_sync = SessionSync::default();
        if let Some(worktree_path) = request
            .working_directory
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            store.set_worktree_path(&request.session_id, Some(worktree_path.to_string()))?;
        }

        if request.prompt.trim().is_empty() {
            let error = "prompt cannot be empty".to_string();
            self.fail_execution(&store, &session_sync, &request.session_id, &error)
                .await;
            return Err(error);
        }

        let mode = match ExecutionMode::resolve() {
            Ok(mode) => mode,
            Err(error) => {
                self.fail_execution(&store, &session_sync, &request.session_id, &error)
                    .await;
                return Err(error);
            }
        };

        let log_sender = BatchSender::default();
        store.set_status(&request.session_id, SessionStatus::Running)?;
        let _ = session_sync
            .update_runtime_mode(&request.session_id, "executing")
            .await;

        let started_log = format!("Local execution started (runner: {})", mode.label());
        if let Err(error) = self
            .append_and_sync(
                &store,
                &log_sender,
                &session_sync,
                &request.session_id,
                started_log,
            )
            .await
        {
            let terminal_error = format!("Unable to persist local start log: {error}");
            self.fail_execution(&store, &session_sync, &request.session_id, &terminal_error)
                .await;
            return Err(terminal_error);
        }

        let heartbeat_handle = self.spawn_runner_heartbeat(
            store,
            log_sender.clone(),
            session_sync.clone(),
            request.session_id.clone(),
            mode,
        );
        let execution_result = self.spawn_runner(mode, request).await;
        heartbeat_handle.abort();
        let _ = heartbeat_handle.await;

        let execution_result = match execution_result {
            Ok(result) => result,
            Err(error) => {
                self.fail_execution(&store, &session_sync, &request.session_id, &error)
                    .await;
                return Err(error);
            }
        };

        if let Err(error) = self
            .append_and_sync(
                &store,
                &log_sender,
                &session_sync,
                &request.session_id,
                format!("Local execution command: {}", execution_result.command),
            )
            .await
        {
            let terminal_error = format!("Unable to persist execution command log: {error}");
            self.fail_execution(&store, &session_sync, &request.session_id, &terminal_error)
                .await;
            return Err(terminal_error);
        }

        if let Err(error) = self
            .record_runner_output(
                &store,
                &log_sender,
                &session_sync,
                &request.session_id,
                &execution_result,
            )
            .await
        {
            let terminal_error = format!("Unable to persist execution output: {error}");
            self.fail_execution(&store, &session_sync, &request.session_id, &terminal_error)
                .await;
            return Err(terminal_error);
        }

        if !execution_result.success {
            let error = self.process_failure_message(mode, &execution_result);
            self.fail_execution(&store, &session_sync, &request.session_id, &error)
                .await;
            return Err(error);
        }

        let completed_log = format!(
            "Local execution completed (runner: {}, exit code: {})",
            mode.label(),
            format_exit_code(execution_result.exit_code)
        );
        if let Err(error) = self
            .append_and_sync(
                &store,
                &log_sender,
                &session_sync,
                &request.session_id,
                completed_log,
            )
            .await
        {
            let terminal_error = format!("Unable to persist local completion log: {error}");
            self.fail_execution(&store, &session_sync, &request.session_id, &terminal_error)
                .await;
            return Err(terminal_error);
        }

        store.set_status(&request.session_id, SessionStatus::Completed)?;
        let _ = session_sync
            .sync_status(&request.session_id, SessionStatus::Completed)
            .await;
        let _ = session_sync
            .update_runtime_mode(&request.session_id, "idle")
            .await;

        if let Err(error) = AutoCommitHook::default()
            .schedule(&request.session_id)
            .await
        {
            let warning = format!("Post-execution completion hook failed: {error}");
            let _ = self
                .append_and_sync(
                    &store,
                    &log_sender,
                    &session_sync,
                    &request.session_id,
                    warning,
                )
                .await;
        }

        Ok(ExecutionHandle {
            execution_id: format!("exec-{}", request.session_id),
            session_id: request.session_id.clone(),
            accepted: true,
        })
    }

    pub async fn send_message(&self, request: &ChatMessageRequest) -> Result<(), String> {
        if request.session_id.trim().is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }

        if request.content.trim().is_empty() {
            return Err("content cannot be empty".to_string());
        }

        let store = RuntimeSessionStore::default();
        store.ensure_session_exists(&request.session_id)?;
        let message = format!("chat inbound: {}", request.content);
        store.append_log(&request.session_id, message.clone())?;

        BatchSender::default()
            .flush_to_sync(&request.session_id, vec![message], &SessionSync::default())
            .await?;

        Ok(())
    }

    async fn fail_execution(
        &self,
        store: &RuntimeSessionStore,
        sync: &SessionSync,
        session_id: &str,
        error: &str,
    ) {
        let failure_log = format!("Local execution failed: {error}");
        let _ = store.append_log(session_id, failure_log.clone());
        let _ = store.set_status(session_id, SessionStatus::Failed);
        let _ = BatchSender::default()
            .flush_to_sync(session_id, vec![failure_log], sync)
            .await;
        let _ = sync.sync_status(session_id, SessionStatus::Failed).await;
        let _ = sync.update_runtime_mode(session_id, "idle").await;
        self.report_failure_if_possible(session_id, error).await;
    }

    async fn append_and_sync(
        &self,
        store: &RuntimeSessionStore,
        log_sender: &BatchSender,
        sync: &SessionSync,
        session_id: &str,
        message: String,
    ) -> Result<(), String> {
        store.append_log(session_id, message.clone())?;
        if let Err(error) = log_sender
            .flush_to_sync(session_id, vec![message], sync)
            .await
        {
            self.record_sync_warning(store, session_id, "failed to flush log batch", &error)?;
        }
        Ok(())
    }

    async fn record_runner_output(
        &self,
        store: &RuntimeSessionStore,
        log_sender: &BatchSender,
        sync: &SessionSync,
        session_id: &str,
        result: &RunnerExecutionResult,
    ) -> Result<(), String> {
        let mut pending = Vec::new();
        let mut saw_output = false;

        for line in &result.output {
            saw_output = true;
            let message = line.as_log_message();
            store.append_log(session_id, message.clone())?;
            pending.push(message);

            if pending.len() >= log_sender.max_batch_size {
                let batch = mem::take(&mut pending);
                if let Err(error) = log_sender.flush_to_sync(session_id, batch, sync).await {
                    self.record_sync_warning(
                        store,
                        session_id,
                        "failed to flush runner output batch",
                        &error,
                    )?;
                }
            }
        }

        if !saw_output {
            let no_output = "Runner emitted no output".to_string();
            store.append_log(session_id, no_output.clone())?;
            pending.push(no_output);
        }

        if !pending.is_empty() {
            if let Err(error) = log_sender.flush_to_sync(session_id, pending, sync).await {
                self.record_sync_warning(
                    store,
                    session_id,
                    "failed to flush runner output batch",
                    &error,
                )?;
            }
        }

        Ok(())
    }

    fn record_sync_warning(
        &self,
        store: &RuntimeSessionStore,
        session_id: &str,
        context: &str,
        error: &str,
    ) -> Result<(), String> {
        store.append_log(session_id, format!("Sync warning ({context}): {error}"))
    }

    fn spawn_runner_heartbeat(
        &self,
        store: RuntimeSessionStore,
        log_sender: BatchSender,
        sync: SessionSync,
        session_id: String,
        mode: ExecutionMode,
    ) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(RUNNER_HEARTBEAT_INTERVAL);
            interval.tick().await;

            loop {
                interval.tick().await;
                let message = format!(
                    "Local execution is still running (runner: {}). Waiting for Claude output...",
                    mode.label()
                );
                let _ = store.append_log(&session_id, message.clone());
                if let Err(error) = log_sender
                    .flush_to_sync(&session_id, vec![message], &sync)
                    .await
                {
                    let _ = store.append_log(
                        &session_id,
                        format!("Sync warning (failed to flush runner heartbeat): {error}"),
                    );
                }
            }
        })
    }

    async fn spawn_runner(
        &self,
        mode: ExecutionMode,
        request: &StartExecutionRequest,
    ) -> Result<RunnerExecutionResult, String> {
        #[cfg(test)]
        if let Some(result) = Self::take_test_runner_override() {
            return result;
        }

        match mode {
            ExecutionMode::Cli => {
                ClaudeCliRunner::default()
                    .spawn(
                        &request.prompt,
                        request.model.as_deref(),
                        request.max_turns,
                        request.working_directory.as_deref(),
                    )
                    .await
            }
            ExecutionMode::Sdk => {
                ClaudeSdkRunner::default()
                    .spawn(
                        &request.prompt,
                        request.model.as_deref(),
                        request.max_turns,
                        request.working_directory.as_deref(),
                    )
                    .await
            }
        }
    }

    #[cfg(test)]
    pub(crate) fn set_test_runner_override(result: Result<RunnerExecutionResult, String>) {
        let store = TEST_RUNNER_OVERRIDE
            .get_or_init(|| std::sync::Mutex::new(None))
            .lock();
        let mut store = store.unwrap_or_else(|poisoned| poisoned.into_inner());
        *store = Some(result);
    }

    #[cfg(test)]
    fn take_test_runner_override() -> Option<Result<RunnerExecutionResult, String>> {
        let store = TEST_RUNNER_OVERRIDE
            .get_or_init(|| std::sync::Mutex::new(None))
            .lock();
        let mut store = store.unwrap_or_else(|poisoned| poisoned.into_inner());
        store.take()
    }

    fn process_failure_message(
        &self,
        mode: ExecutionMode,
        result: &RunnerExecutionResult,
    ) -> String {
        let detail = result
            .first_stderr_detail()
            .unwrap_or_else(|| "No stderr output was captured.".to_string());

        format!(
            "Local {} runner exited unsuccessfully (exit code: {}). Command: {}. Detail: {}",
            mode.label(),
            format_exit_code(result.exit_code),
            result.command,
            detail
        )
    }

    async fn report_failure_if_possible(&self, session_id: &str, error: &str) {
        if session_id.trim().is_empty() {
            return;
        }

        let _ = AutoCommitHook::default()
            .report_failure(session_id, error.to_string())
            .await;
    }
}

fn format_exit_code(exit_code: Option<i32>) -> String {
    exit_code
        .map(|value| value.to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

#[cfg(test)]
mod tests {
    use super::{LocalExecutionEngine, EXECUTION_MODE_ENV};
    use crate::commands::types::{
        ChatMessageRequest, RuntimeKind, SessionConfig, SessionStatus, StartExecutionRequest,
    };
    use crate::execution::jsonl_parser::RunnerExecutionResult;
    use crate::runtime::RuntimeSessionStore;
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

    fn sample_session_config() -> SessionConfig {
        SessionConfig {
            org_id: "org-test".to_string(),
            project_id: "project-test".to_string(),
            repository_path: ".".to_string(),
            base_branch: "main".to_string(),
            runtime: RuntimeKind::Local,
        }
    }

    fn create_session_id(store: &RuntimeSessionStore) -> String {
        store
            .create_session(&sample_session_config())
            .expect("session should be created")
            .session_id
    }

    #[tokio::test]
    async fn start_rejects_empty_session_id() {
        let request = StartExecutionRequest {
            session_id: "  ".to_string(),
            prompt: "hello".to_string(),
            model: None,
            max_turns: None,
            working_directory: None,
        };

        let error = LocalExecutionEngine::default()
            .start(&request)
            .await
            .expect_err("empty session id should fail");
        assert_eq!(error, "sessionId cannot be empty");
    }

    #[tokio::test]
    async fn start_with_empty_prompt_marks_session_as_failed() {
        let _guard = RuntimeSessionStore::acquire_test_lock();
        let _env_guard = EnvGuard::unset(&[
            EXECUTION_MODE_ENV,
            SYNC_ENV_KEYS[0],
            SYNC_ENV_KEYS[1],
            SYNC_ENV_KEYS[2],
            SYNC_ENV_KEYS[3],
            SYNC_ENV_KEYS[4],
        ]);
        let store = RuntimeSessionStore::default();
        store.reset_for_tests();
        let session_id = create_session_id(&store);

        let request = StartExecutionRequest {
            session_id: session_id.clone(),
            prompt: "   ".to_string(),
            model: None,
            max_turns: None,
            working_directory: None,
        };

        let error = LocalExecutionEngine::default()
            .start(&request)
            .await
            .expect_err("empty prompt should fail");
        assert_eq!(error, "prompt cannot be empty");

        assert!(matches!(
            store
                .get_status(&session_id)
                .expect("status should be readable"),
            SessionStatus::Failed
        ));

        let logs = store
            .entries_after(&session_id, 0)
            .expect("logs should be readable");
        assert!(logs.iter().any(|entry| entry
            .message
            .contains("Local execution failed: prompt cannot be empty")));
    }

    #[tokio::test]
    async fn send_message_validates_input_and_appends_log() {
        let _guard = RuntimeSessionStore::acquire_test_lock();
        let _env_guard = EnvGuard::unset(&SYNC_ENV_KEYS);
        let store = RuntimeSessionStore::default();
        store.reset_for_tests();
        let session_id = create_session_id(&store);
        let engine = LocalExecutionEngine::default();

        let missing_session_id = engine
            .send_message(&ChatMessageRequest {
                session_id: " ".to_string(),
                content: "hello".to_string(),
            })
            .await
            .expect_err("empty session id should fail");
        assert_eq!(missing_session_id, "sessionId cannot be empty");

        let missing_content = engine
            .send_message(&ChatMessageRequest {
                session_id: session_id.clone(),
                content: " ".to_string(),
            })
            .await
            .expect_err("empty content should fail");
        assert_eq!(missing_content, "content cannot be empty");

        engine
            .send_message(&ChatMessageRequest {
                session_id: session_id.clone(),
                content: "hello from test".to_string(),
            })
            .await
            .expect("valid message should be accepted");

        let logs = store
            .entries_after(&session_id, 0)
            .expect("logs should be readable");
        assert!(logs
            .iter()
            .any(|entry| entry.message == "chat inbound: hello from test"));
    }

    #[tokio::test]
    async fn start_success_path_sets_completed_status_and_handle() {
        let _guard = RuntimeSessionStore::acquire_test_lock();
        let _env_guard = EnvGuard::unset(&[
            EXECUTION_MODE_ENV,
            SYNC_ENV_KEYS[0],
            SYNC_ENV_KEYS[1],
            SYNC_ENV_KEYS[2],
            SYNC_ENV_KEYS[3],
            SYNC_ENV_KEYS[4],
        ]);
        let store = RuntimeSessionStore::default();
        store.reset_for_tests();
        let session_id = create_session_id(&store);

        LocalExecutionEngine::set_test_runner_override(Ok(RunnerExecutionResult {
            command: "mock-runner --ok".to_string(),
            success: true,
            exit_code: Some(0),
            output: Vec::new(),
        }));

        let request = StartExecutionRequest {
            session_id: session_id.clone(),
            prompt: "Run deterministic test".to_string(),
            model: None,
            max_turns: Some(1),
            working_directory: None,
        };

        let handle = LocalExecutionEngine::default()
            .start(&request)
            .await
            .expect("start should complete successfully");

        assert_eq!(handle.execution_id, format!("exec-{session_id}"));
        assert_eq!(handle.session_id, session_id);
        assert!(handle.accepted);

        assert!(matches!(
            store
                .get_status(&handle.session_id)
                .expect("status should be readable"),
            SessionStatus::Completed
        ));

        let logs = store
            .entries_after(&handle.session_id, 0)
            .expect("logs should be readable");
        assert!(logs.iter().any(|entry| entry
            .message
            .starts_with("Local execution started (runner: ")));
        assert!(logs
            .iter()
            .any(|entry| entry.message == "Local execution command: mock-runner --ok"));
        assert!(logs
            .iter()
            .any(|entry| entry.message == "Runner emitted no output"));
        assert!(logs.iter().any(|entry| entry
            .message
            .starts_with("Local execution completed (runner: ")));
    }

    #[tokio::test]
    async fn start_succeeds_when_sync_is_misconfigured_with_runner_override() {
        let _guard = RuntimeSessionStore::acquire_test_lock();
        let _env_guard = EnvGuard::unset(&[
            EXECUTION_MODE_ENV,
            SYNC_ENV_KEYS[0],
            SYNC_ENV_KEYS[1],
            SYNC_ENV_KEYS[2],
            SYNC_ENV_KEYS[3],
            SYNC_ENV_KEYS[4],
        ]);
        env::set_var("FOUNDRY_CONVEX_URL", "https://example.convex.cloud");
        let store = RuntimeSessionStore::default();
        store.reset_for_tests();
        let session_id = create_session_id(&store);

        LocalExecutionEngine::set_test_runner_override(Ok(RunnerExecutionResult {
            command: "mock-runner --ok".to_string(),
            success: true,
            exit_code: Some(0),
            output: Vec::new(),
        }));

        let request = StartExecutionRequest {
            session_id: session_id.clone(),
            prompt: "Run despite sync misconfiguration".to_string(),
            model: None,
            max_turns: Some(1),
            working_directory: None,
        };

        let handle = LocalExecutionEngine::default()
            .start(&request)
            .await
            .expect("local start should succeed when sync is misconfigured");

        assert_eq!(handle.execution_id, format!("exec-{session_id}"));
        assert_eq!(handle.session_id, session_id);
        assert!(handle.accepted);

        assert!(matches!(
            store
                .get_status(&handle.session_id)
                .expect("status should be readable"),
            SessionStatus::Completed
        ));

        let logs = store
            .entries_after(&handle.session_id, 0)
            .expect("logs should be readable");
        assert!(logs.iter().any(|entry| entry
            .message
            .starts_with("Local execution started (runner: ")));
        assert!(logs
            .iter()
            .any(|entry| entry.message.starts_with("Sync warning (failed to flush")));
        assert!(logs
            .iter()
            .any(|entry| entry.message.contains("missing auth token")));
        assert!(logs.iter().any(|entry| entry
            .message
            .starts_with("Local execution completed (runner: ")));
    }
}
