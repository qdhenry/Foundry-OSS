use crate::commands::types::{
    ChatMessageRequest, ExecutionHandle, LaunchLocalSessionRequest, LaunchLocalSessionResult,
    RuntimeKind, SessionConfig, SessionStatus, StartExecutionRequest,
};
use crate::execution::engine::LocalExecutionEngine;
use crate::execution::hooks::AutoCommitHook;
use crate::execution::pipeline::{LocalPipeline, PipelineContext};
use crate::runtime::RuntimeSessionStore;
use std::path::PathBuf;
use std::process::Command;

#[tauri::command]
pub async fn start_execution(request: StartExecutionRequest) -> Result<ExecutionHandle, String> {
    LocalExecutionEngine::default().start(&request).await
}

#[tauri::command]
pub async fn launch_local_session(
    request: LaunchLocalSessionRequest,
) -> Result<LaunchLocalSessionResult, String> {
    validate_launch_request(&request)?;

    let store = RuntimeSessionStore::default();
    let config = SessionConfig {
        org_id: "local".to_string(),
        project_id: "local".to_string(),
        repository_path: request.repository_path.clone(),
        base_branch: request.base_branch.clone(),
        runtime: RuntimeKind::Local,
    };
    let session_info = store.create_session_with_id(&request.convex_session_id, &config)?;
    let local_session_id = session_info.session_id.clone();
    let repository_root = request.repository_path.trim().to_string();
    store.set_status(&local_session_id, SessionStatus::Queued)?;
    store.set_worktree_path(&local_session_id, Some(repository_root))?;

    if should_spawn_background_launch_task() {
        let local_session_id_for_task = local_session_id.clone();
        let convex_session_id_for_task = request.convex_session_id.clone();
        let repository_path_for_task = request.repository_path.clone();
        let prompt_for_task = request.prompt.clone();
        let model_for_task = request.model.clone();
        let max_turns_for_task = request.max_turns;
        let worktree_branch_for_task = request.worktree_branch.clone();
        let base_branch_for_task = request.base_branch.clone();
        let mcp_server_overrides_for_task = request.mcp_server_overrides.clone();
        let workspace_customization_for_task = request.workspace_customization.clone();

        tokio::spawn(async move {
            let mut context = PipelineContext {
                local_session_id: local_session_id_for_task.clone(),
                convex_session_id: convex_session_id_for_task.clone(),
                worktree_branch: worktree_branch_for_task,
                repository_path: repository_path_for_task.clone(),
                base_branch: base_branch_for_task,
                prompt: prompt_for_task.clone(),
                model: model_for_task.clone(),
                max_turns: max_turns_for_task,
                mcp_server_overrides: mcp_server_overrides_for_task,
                workspace_customization: workspace_customization_for_task,
                worktree_path: None,
            };

            match LocalPipeline::default().execute(&mut context).await {
                Ok(result) => {
                    let execution_request = StartExecutionRequest {
                        session_id: local_session_id_for_task.clone(),
                        prompt: prompt_for_task,
                        model: model_for_task,
                        max_turns: max_turns_for_task,
                        working_directory: Some(result.worktree_path.clone()),
                    };

                    if let Err(error) = LocalExecutionEngine::default()
                        .start(&execution_request)
                        .await
                    {
                        handle_launch_failure(
                            &local_session_id_for_task,
                            &repository_path_for_task,
                            Some(result.worktree_path),
                            format!("Local execution engine failed after setup: {error}"),
                        )
                        .await;
                    }
                }
                Err(error) => {
                    handle_launch_failure(
                        &local_session_id_for_task,
                        &repository_path_for_task,
                        error
                            .worktree_path
                            .clone()
                            .or_else(|| context.worktree_path.clone()),
                        error.to_string(),
                    )
                    .await;
                }
            }
        });
    }

    Ok(LaunchLocalSessionResult {
        local_session_id,
        convex_session_id: request.convex_session_id,
        status: "pipeline_started".to_string(),
    })
}

#[tauri::command]
pub async fn send_chat_message(
    session_id: String,
    content: String,
    role: Option<String>,
) -> Result<(), String> {
    let role_label = role
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("user");
    let request = ChatMessageRequest {
        session_id,
        content: format!("[role:{role_label}] {content}"),
    };

    LocalExecutionEngine::default().send_message(&request).await
}

fn validate_launch_request(request: &LaunchLocalSessionRequest) -> Result<(), String> {
    if request.convex_session_id.trim().is_empty() {
        return Err("convexSessionId cannot be empty".to_string());
    }
    if request.worktree_branch.trim().is_empty() {
        return Err("worktreeBranch cannot be empty".to_string());
    }
    if request.repository_path.trim().is_empty() {
        return Err("repositoryPath cannot be empty".to_string());
    }
    if request.base_branch.trim().is_empty() {
        return Err("baseBranch cannot be empty".to_string());
    }
    if request.prompt.trim().is_empty() {
        return Err("prompt cannot be empty".to_string());
    }

    Ok(())
}

async fn handle_launch_failure(
    session_id: &str,
    repository_path: &str,
    worktree_path: Option<String>,
    error: String,
) {
    let store = RuntimeSessionStore::default();
    let _ = store.append_log(session_id, format!("Local launch failed: {error}"));
    let _ = store.set_status(session_id, SessionStatus::Failed);
    let _ = AutoCommitHook::default()
        .report_failure(session_id, error.clone())
        .await;

    if let Some(worktree_path) = worktree_path {
        let _ = cleanup_worktree(repository_path, &worktree_path).await;
    }

    let fallback_root = repository_path.trim();
    if fallback_root.is_empty() {
        let _ = store.set_worktree_path(session_id, None);
    } else {
        let _ = store.set_worktree_path(session_id, Some(fallback_root.to_string()));
    }
}

async fn cleanup_worktree(repository_path: &str, worktree_path: &str) -> Result<(), String> {
    let repo = repository_path.trim().to_string();
    let worktree = worktree_path.trim().to_string();
    if repo.is_empty() || worktree.is_empty() {
        return Ok(());
    }

    tokio::task::spawn_blocking(move || cleanup_worktree_blocking(&repo, &worktree))
        .await
        .map_err(|error| format!("Failed to join worktree cleanup task: {error}"))?
}

fn cleanup_worktree_blocking(repository_path: &str, worktree_path: &str) -> Result<(), String> {
    let repo = PathBuf::from(repository_path);
    let worktree = PathBuf::from(worktree_path);
    if !repo.is_dir() || !worktree.exists() {
        return Ok(());
    }

    let output = Command::new("git")
        .current_dir(&repo)
        .args([
            "worktree",
            "remove",
            "--force",
            worktree.to_string_lossy().as_ref(),
        ])
        .output()
        .map_err(|error| format!("Failed to run git worktree cleanup: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(format!(
            "git worktree cleanup failed for `{}`: {}",
            worktree.display(),
            if stderr.is_empty() {
                "unknown error".to_string()
            } else {
                stderr
            }
        ));
    }

    Ok(())
}

#[cfg(not(test))]
fn should_spawn_background_launch_task() -> bool {
    // Runtime launches should always execute in desktop builds.
    true
}

#[cfg(test)]
fn should_spawn_background_launch_task() -> bool {
    !matches!(
        std::env::var("FOUNDRY_SKIP_LOCAL_LAUNCH_TASK")
            .ok()
            .as_deref()
            .map(str::trim),
        Some("1") | Some("true") | Some("TRUE")
    )
}

#[cfg(test)]
mod tests {
    use super::{
        handle_launch_failure, launch_local_session, should_spawn_background_launch_task,
        LaunchLocalSessionRequest,
    };
    use crate::commands::types::{RuntimeKind, SessionConfig};
    use crate::runtime::RuntimeSessionStore;
    use std::collections::HashMap;
    use std::env;

    struct EnvGuard {
        original: HashMap<String, Option<String>>,
    }

    impl EnvGuard {
        fn capture(keys: &[&str]) -> Self {
            let mut original = HashMap::with_capacity(keys.len());
            for key in keys {
                original.insert((*key).to_string(), env::var(key).ok());
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

    fn sample_request() -> LaunchLocalSessionRequest {
        LaunchLocalSessionRequest {
            convex_session_id: "session-local-1".to_string(),
            worktree_branch: "foundry/task-1".to_string(),
            repository_path: ".".to_string(),
            base_branch: "main".to_string(),
            prompt: "Implement feature".to_string(),
            model: None,
            max_turns: Some(1),
            mcp_server_overrides: None,
            workspace_customization: None,
        }
    }

    #[tokio::test]
    async fn launch_local_session_rejects_missing_required_fields() {
        let mut request = sample_request();
        request.convex_session_id = " ".to_string();
        let convex_error = launch_local_session(request)
            .await
            .expect_err("empty convex session id should fail");
        assert_eq!(convex_error, "convexSessionId cannot be empty");

        let mut request = sample_request();
        request.repository_path = " ".to_string();
        let path_error = launch_local_session(request)
            .await
            .expect_err("empty repository path should fail");
        assert_eq!(path_error, "repositoryPath cannot be empty");

        let mut request = sample_request();
        request.prompt = " ".to_string();
        let prompt_error = launch_local_session(request)
            .await
            .expect_err("empty prompt should fail");
        assert_eq!(prompt_error, "prompt cannot be empty");
    }

    #[tokio::test]
    async fn launch_local_session_returns_pipeline_started_and_reuses_convex_id() {
        let _runtime_guard = RuntimeSessionStore::acquire_test_lock();
        let store = RuntimeSessionStore::default();
        store.reset_for_tests();
        let _env_guard = EnvGuard::capture(&["FOUNDRY_SKIP_LOCAL_LAUNCH_TASK"]);
        env::set_var("FOUNDRY_SKIP_LOCAL_LAUNCH_TASK", "1");
        assert!(!should_spawn_background_launch_task());

        let response = launch_local_session(sample_request())
            .await
            .expect("valid local launch request should return immediately");
        assert_eq!(response.local_session_id, "session-local-1");
        assert_eq!(response.convex_session_id, "session-local-1");
        assert_eq!(response.status, "pipeline_started");
        store
            .ensure_session_exists("session-local-1")
            .expect("session should exist in runtime store");
        assert_eq!(
            store
                .get_worktree_path("session-local-1")
                .expect("worktree path should be readable"),
            Some(".".to_string())
        );
    }

    #[tokio::test]
    async fn handle_launch_failure_restores_repository_path_for_editor_access() {
        let _runtime_guard = RuntimeSessionStore::acquire_test_lock();
        let store = RuntimeSessionStore::default();
        store.reset_for_tests();

        store
            .create_session_with_id(
                "session-local-restore",
                &SessionConfig {
                    org_id: "local".to_string(),
                    project_id: "local".to_string(),
                    repository_path: "/tmp/repo-root".to_string(),
                    base_branch: "main".to_string(),
                    runtime: RuntimeKind::Local,
                },
            )
            .expect("session should be created");
        store
            .set_worktree_path("session-local-restore", Some("/tmp/worktree".to_string()))
            .expect("worktree path should be set");

        handle_launch_failure(
            "session-local-restore",
            "/tmp/repo-root",
            None,
            "synthetic launch failure".to_string(),
        )
        .await;

        assert_eq!(
            store
                .get_worktree_path("session-local-restore")
                .expect("worktree path should be readable"),
            Some("/tmp/repo-root".to_string())
        );
    }
}
