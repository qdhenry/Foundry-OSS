use crate::auth::keychain::KeychainStore;
use crate::commands::system::probe_required_tools;
use crate::commands::types::{SessionStatus, WorkspaceCustomizationPayload};
use crate::execution::claude_cli::ClaudeCliRunner;
use crate::execution::claude_sdk::ClaudeSdkRunner;
use crate::runtime::RuntimeSessionStore;
use crate::sync::batch_sender::BatchSender;
use crate::sync::payloads::SetupProgressState;
use crate::sync::session_sync::SessionSync;
use serde::{Deserialize, Serialize};
use serde_json::{Map as JsonMap, Value as JsonValue};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::time::{SystemTime, UNIX_EPOCH};

const CLAUDE_SETTINGS_RELATIVE_PATH: &str = ".claude/settings.json";
const CLAUDE_SETTINGS_LOCAL_RELATIVE_PATH: &str = ".claude/settings.local.json";
const WORKSPACE_CUSTOMIZATION_SCRIPT_RELATIVE_PATH: &str = ".foundry/workspace-customization.sh";
const WORKSPACE_CUSTOMIZATION_JSON_RELATIVE_PATH: &str = ".foundry/workspace-customization.json";
const MCP_CONFIG_RELATIVE_PATHS: [&str; 2] = [".mcp.json", ".foundry/mcp.json"];
const DEP_INSTALL_MARKER_RELATIVE_PATH: &str = ".foundry/pipeline/deps-installed.marker";
const DEFAULT_CLAUDE_SETTINGS_JSON: &str = concat!(
    "{\n",
    "  \"foundry\": {\n",
    "    \"managedBy\": \"foundry_desktop_tauri\",\n",
    "    \"schemaVersion\": 1\n",
    "  }\n",
    "}\n"
);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PipelineStage {
    WorktreeSetup,
    EnvValidation,
    AuthSetup,
    ClaudeConfig,
    GitCheckout,
    DepsInstall,
    McpInstall,
    WorkspaceCustomization,
    HealthCheck,
    Ready,
}

impl PipelineStage {
    pub fn convex_key(&self) -> &'static str {
        match self {
            Self::WorktreeSetup => "containerProvision",
            Self::EnvValidation => "systemSetup",
            Self::AuthSetup => "authSetup",
            Self::ClaudeConfig => "claudeConfig",
            Self::GitCheckout => "gitClone",
            Self::DepsInstall => "depsInstall",
            Self::McpInstall => "mcpInstall",
            Self::WorkspaceCustomization => "workspaceCustomization",
            Self::HealthCheck => "healthCheck",
            Self::Ready => "ready",
        }
    }

    fn label(&self) -> &'static str {
        match self {
            Self::WorktreeSetup => "Worktree setup",
            Self::EnvValidation => "Environment validation",
            Self::AuthSetup => "Auth setup",
            Self::ClaudeConfig => "Claude config",
            Self::GitCheckout => "Git checkout",
            Self::DepsInstall => "Dependency install",
            Self::McpInstall => "MCP install",
            Self::WorkspaceCustomization => "Workspace customization",
            Self::HealthCheck => "Health check",
            Self::Ready => "Ready",
        }
    }
}

#[derive(Debug, Clone)]
pub struct PipelineContext {
    pub local_session_id: String,
    pub convex_session_id: String,
    pub worktree_branch: String,
    pub repository_path: String,
    pub base_branch: String,
    pub prompt: String,
    pub model: Option<String>,
    pub max_turns: Option<u16>,
    pub mcp_server_overrides: Option<Vec<String>>,
    pub workspace_customization: Option<WorkspaceCustomizationPayload>,
    pub worktree_path: Option<String>,
}

#[derive(Debug, Clone)]
pub struct PipelineResult {
    pub worktree_path: String,
    pub stages_completed: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct PipelineError {
    pub stage: String,
    pub error: String,
    pub worktree_path: Option<String>,
}

impl std::fmt::Display for PipelineError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            formatter,
            "Pipeline stage `{}` failed: {}",
            self.stage, self.error
        )
    }
}

impl std::error::Error for PipelineError {}

#[derive(Debug)]
enum StageOutcome {
    Completed(String),
    Skipped(String),
}

#[derive(Debug, Default, Clone, Copy)]
pub struct LocalPipeline;

impl LocalPipeline {
    pub async fn planned_stages(&self) -> Result<Vec<PipelineStage>, String> {
        Ok(vec![
            PipelineStage::WorktreeSetup,
            PipelineStage::EnvValidation,
            PipelineStage::AuthSetup,
            PipelineStage::ClaudeConfig,
            PipelineStage::GitCheckout,
            PipelineStage::DepsInstall,
            PipelineStage::McpInstall,
            PipelineStage::WorkspaceCustomization,
            PipelineStage::HealthCheck,
            PipelineStage::Ready,
        ])
    }

    pub async fn execute(
        &self,
        context: &mut PipelineContext,
    ) -> Result<PipelineResult, PipelineError> {
        validate_context(context).map_err(|error| PipelineError {
            stage: "validation".to_string(),
            error,
            worktree_path: context.worktree_path.clone(),
        })?;

        let store = RuntimeSessionStore::default();
        store
            .ensure_session_exists(&context.local_session_id)
            .map_err(|error| PipelineError {
                stage: "validation".to_string(),
                error,
                worktree_path: context.worktree_path.clone(),
            })?;
        store
            .set_status(&context.local_session_id, SessionStatus::Preparing)
            .map_err(|error| PipelineError {
                stage: "validation".to_string(),
                error,
                worktree_path: context.worktree_path.clone(),
            })?;

        let sync = SessionSync::default();
        let batch_sender = BatchSender::default();
        self.append_stage_log(
            context,
            &store,
            &sync,
            &batch_sender,
            "Local setup pipeline started".to_string(),
        )
        .await
        .map_err(|error| PipelineError {
            stage: "validation".to_string(),
            error,
            worktree_path: context.worktree_path.clone(),
        })?;

        let stages = self.planned_stages().await.map_err(|error| PipelineError {
            stage: "validation".to_string(),
            error,
            worktree_path: context.worktree_path.clone(),
        })?;
        let mut stages_completed = Vec::with_capacity(stages.len());

        for stage in stages {
            let stage_key = stage.convex_key();
            let started_at = current_timestamp_ms();
            let _ = sync
                .report_stage_progress(
                    &context.convex_session_id,
                    stage_key,
                    SetupProgressState::Running { started_at },
                )
                .await;

            match self.run_stage(&stage, context, &store).await {
                Ok(StageOutcome::Completed(message)) => {
                    stages_completed.push(stage_key.to_string());
                    let _ = sync
                        .report_stage_progress(
                            &context.convex_session_id,
                            stage_key,
                            SetupProgressState::Completed {
                                started_at,
                                completed_at: current_timestamp_ms(),
                            },
                        )
                        .await;

                    self.append_stage_log(
                        context,
                        &store,
                        &sync,
                        &batch_sender,
                        format!("{} completed: {message}", stage.label()),
                    )
                    .await
                    .map_err(|error| PipelineError {
                        stage: stage_key.to_string(),
                        error,
                        worktree_path: context.worktree_path.clone(),
                    })?;
                }
                Ok(StageOutcome::Skipped(reason)) => {
                    stages_completed.push(stage_key.to_string());
                    let _ = sync
                        .report_stage_progress(
                            &context.convex_session_id,
                            stage_key,
                            SetupProgressState::Skipped {
                                reason: reason.clone(),
                            },
                        )
                        .await;

                    self.append_stage_log(
                        context,
                        &store,
                        &sync,
                        &batch_sender,
                        format!("{} skipped: {reason}", stage.label()),
                    )
                    .await
                    .map_err(|error| PipelineError {
                        stage: stage_key.to_string(),
                        error,
                        worktree_path: context.worktree_path.clone(),
                    })?;
                }
                Err(error) => {
                    let _ = sync
                        .report_stage_progress(
                            &context.convex_session_id,
                            stage_key,
                            SetupProgressState::Failed {
                                started_at,
                                failed_at: current_timestamp_ms(),
                                error: error.clone(),
                            },
                        )
                        .await;
                    let _ = store.set_status(&context.local_session_id, SessionStatus::Failed);
                    let _ = sync
                        .sync_status(&context.convex_session_id, SessionStatus::Failed)
                        .await;
                    let _ = sync
                        .update_runtime_mode(&context.convex_session_id, "idle")
                        .await;
                    let _ = self
                        .append_stage_log(
                            context,
                            &store,
                            &sync,
                            &batch_sender,
                            format!("{} failed: {error}", stage.label()),
                        )
                        .await;

                    return Err(PipelineError {
                        stage: stage_key.to_string(),
                        error,
                        worktree_path: context.worktree_path.clone(),
                    });
                }
            }
        }

        let worktree_path = context.worktree_path.clone().ok_or_else(|| PipelineError {
            stage: "ready".to_string(),
            error: "pipeline completed without a resolved worktreePath".to_string(),
            worktree_path: None,
        })?;

        Ok(PipelineResult {
            worktree_path,
            stages_completed,
        })
    }

    async fn append_stage_log(
        &self,
        context: &PipelineContext,
        store: &RuntimeSessionStore,
        sync: &SessionSync,
        batch_sender: &BatchSender,
        message: String,
    ) -> Result<(), String> {
        store.append_log(&context.local_session_id, message.clone())?;
        let _ = batch_sender
            .flush_to_sync(&context.convex_session_id, vec![message], sync)
            .await;
        Ok(())
    }

    async fn run_stage(
        &self,
        stage: &PipelineStage,
        context: &mut PipelineContext,
        store: &RuntimeSessionStore,
    ) -> Result<StageOutcome, String> {
        match stage {
            PipelineStage::WorktreeSetup => run_worktree_setup(context, store).await,
            PipelineStage::EnvValidation => run_env_validation(),
            PipelineStage::AuthSetup => run_auth_setup().await,
            PipelineStage::ClaudeConfig => run_claude_config(context),
            PipelineStage::GitCheckout => run_git_checkout(context),
            PipelineStage::DepsInstall => run_deps_install(context),
            PipelineStage::McpInstall => run_mcp_install(context),
            PipelineStage::WorkspaceCustomization => run_workspace_customization(context),
            PipelineStage::HealthCheck => run_health_check(context),
            PipelineStage::Ready => {
                store.set_status(&context.local_session_id, SessionStatus::Running)?;
                if let Some(worktree_path) = context.worktree_path.as_ref() {
                    store.set_worktree_path(
                        &context.local_session_id,
                        Some(worktree_path.to_string()),
                    )?;
                }
                Ok(StageOutcome::Completed(
                    "Session is ready for execution".to_string(),
                ))
            }
        }
    }
}

async fn run_worktree_setup(
    context: &mut PipelineContext,
    store: &RuntimeSessionStore,
) -> Result<StageOutcome, String> {
    let repo_root = canonical_repository_path(&context.repository_path)?;
    let worktree_path = repo_root
        .join(".foundry")
        .join("worktrees")
        .join(sanitize_segment(&context.local_session_id));
    let branch = context.worktree_branch.trim();

    if branch.is_empty() {
        return Err("worktreeBranch cannot be empty".to_string());
    }

    if !worktree_path.exists() {
        if let Some(parent) = worktree_path.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!("Failed to create worktree parent directories: {error}")
            })?;
        }

        let display = worktree_path.to_string_lossy().to_string();
        let _ = run_command(&repo_root, "git", ["worktree", "prune"]);
        let add_result = run_command(
            &repo_root,
            "git",
            ["worktree", "add", display.as_str(), branch],
        )?;

        let mut initial_add_failed = None;
        if !add_result.success {
            let create_branch_result = run_command(
                &repo_root,
                "git",
                ["worktree", "add", "-b", branch, display.as_str()],
            )?;

            if !create_branch_result.success {
                initial_add_failed = Some((add_result, create_branch_result));
            }
        }

        if let Some((add_result, create_branch_result)) = initial_add_failed {
            let _ = run_command(&repo_root, "git", ["worktree", "prune"]);
            let retry_add_result = run_command(
                &repo_root,
                "git",
                ["worktree", "add", display.as_str(), branch],
            )?;
            if !retry_add_result.success {
                return Err(format!(
                    "Failed to create worktree.\n{}\n\n{}\n\n{}",
                    render_command_result("git worktree add <path> <branch>", &add_result),
                    render_command_result(
                        "git worktree add -b <branch> <path>",
                        &create_branch_result
                    ),
                    render_command_result(
                        "git worktree add <path> <branch> (after prune)",
                        &retry_add_result
                    ),
                ));
            }
        }
    } else if !is_registered_worktree(&repo_root, &worktree_path)? {
        return Err(format!(
            "Worktree path `{}` already exists but is not registered in `git worktree list`",
            worktree_path.display()
        ));
    }

    if !worktree_path.exists() {
        return Err(format!(
            "Worktree setup did not create `{}` on disk.",
            worktree_path.display()
        ));
    }

    let canonical_worktree = canonicalize_lossy(&worktree_path);
    context.worktree_path = Some(canonical_worktree.clone());
    store.set_worktree_path(&context.local_session_id, Some(canonical_worktree.clone()))?;

    Ok(StageOutcome::Completed(format!(
        "Prepared worktree at {}",
        canonical_worktree
    )))
}

fn run_env_validation() -> Result<StageOutcome, String> {
    let checks = probe_required_tools();
    let missing = checks
        .into_iter()
        .filter(|check| !check.available)
        .map(|check| check.name)
        .collect::<Vec<_>>();

    if missing.is_empty() {
        Ok(StageOutcome::Completed(
            "Verified git, node, and bun prerequisites".to_string(),
        ))
    } else {
        Err(format!(
            "Missing required tools on PATH: {}",
            missing.join(", ")
        ))
    }
}

async fn run_auth_setup() -> Result<StageOutcome, String> {
    let env_key = env::var("ANTHROPIC_API_KEY")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    if env_key.is_some() {
        return Ok(StageOutcome::Completed(
            "Found ANTHROPIC_API_KEY in environment".to_string(),
        ));
    }

    let keychain_key = KeychainStore::default().get_api_key("anthropic").await?;
    if keychain_key
        .as_deref()
        .map(str::trim)
        .is_some_and(|value| !value.is_empty())
    {
        return Ok(StageOutcome::Completed(
            "Found Anthropic API key in desktop keychain".to_string(),
        ));
    }

    if let Some(email) = detect_claude_code_oauth_identity() {
        return Ok(StageOutcome::Completed(format!(
            "Detected Claude Code OAuth session{}",
            email
                .as_deref()
                .map(|value| format!(" for `{value}`"))
                .unwrap_or_default()
        )));
    }

    Err(
        "Missing Claude authentication. Sign in with `claude auth login`, or set ANTHROPIC_API_KEY in your environment or desktop keychain."
            .to_string(),
    )
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClaudeCodeOAuthConfig {
    #[serde(default)]
    oauth_account: Option<ClaudeCodeOAuthAccount>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClaudeCodeOAuthAccount {
    #[serde(default)]
    email_address: Option<String>,
}

fn detect_claude_code_oauth_identity() -> Option<Option<String>> {
    let home_dir = env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .map(PathBuf::from)?;
    let claude_config_path = home_dir.join(".claude.json");
    let raw = fs::read_to_string(claude_config_path).ok()?;
    let parsed = serde_json::from_str::<ClaudeCodeOAuthConfig>(&raw).ok()?;
    let oauth_account = parsed.oauth_account?;
    let email = oauth_account
        .email_address
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    Some(email)
}

fn run_claude_config(context: &PipelineContext) -> Result<StageOutcome, String> {
    let worktree_path = resolve_worktree_path(context)?;
    ensure_directory(&worktree_path, "worktree")?;

    let (settings_path, wrote_settings) = ensure_claude_settings_file(&worktree_path)?;
    let runner = detect_runner_availability()?;
    let verb = if wrote_settings { "Wrote" } else { "Verified" };

    Ok(StageOutcome::Completed(format!(
        "{verb} deterministic Claude settings at `{}` ({})",
        settings_path.display(),
        runner.summary()
    )))
}

fn run_git_checkout(context: &PipelineContext) -> Result<StageOutcome, String> {
    let worktree_path = resolve_worktree_path(context)?;
    ensure_directory(&worktree_path, "worktree")?;
    ensure_git_worktree(&worktree_path)?;

    let target_branch = context.worktree_branch.trim();
    let base_branch = context.base_branch.trim();
    if target_branch.is_empty() {
        return Err("worktreeBranch cannot be empty".to_string());
    }
    if base_branch.is_empty() {
        return Err("baseBranch cannot be empty".to_string());
    }

    let fetch_result = run_command(&worktree_path, "git", ["fetch", "--prune", "origin"])?;
    let fetch_warning = if fetch_result.success {
        None
    } else {
        Some(render_command_result(
            "git fetch --prune origin",
            &fetch_result,
        ))
    };

    let target_remote_ref = format!("refs/remotes/origin/{target_branch}");
    let target_local_ref = format!("refs/heads/{target_branch}");
    let base_remote_ref = format!("refs/remotes/origin/{base_branch}");
    let base_local_ref = format!("refs/heads/{base_branch}");

    let target_remote_exists = git_ref_exists(&worktree_path, &target_remote_ref)?;
    let target_local_exists = git_ref_exists(&worktree_path, &target_local_ref)?;
    let base_remote_exists = git_ref_exists(&worktree_path, &base_remote_ref)?;
    let base_local_exists = git_ref_exists(&worktree_path, &base_local_ref)?;

    let (checkout_result, checkout_step, checkout_detail) = if target_remote_exists {
        let remote_target = format!("origin/{target_branch}");
        (
            run_command(
                &worktree_path,
                "git",
                ["checkout", "-B", target_branch, remote_target.as_str()],
            )?,
            format!("git checkout -B {target_branch} {remote_target}"),
            format!("checked out from `{remote_target}`"),
        )
    } else if target_local_exists {
        (
            run_command(&worktree_path, "git", ["checkout", target_branch])?,
            format!("git checkout {target_branch}"),
            "checked out local branch".to_string(),
        )
    } else if base_remote_exists {
        let remote_base = format!("origin/{base_branch}");
        (
            run_command(
                &worktree_path,
                "git",
                ["checkout", "-B", target_branch, remote_base.as_str()],
            )?,
            format!("git checkout -B {target_branch} {remote_base}"),
            format!("created from fallback `{remote_base}`"),
        )
    } else if base_local_exists {
        (
            run_command(
                &worktree_path,
                "git",
                ["checkout", "-B", target_branch, base_branch],
            )?,
            format!("git checkout -B {target_branch} {base_branch}"),
            format!("created from fallback `{base_branch}`"),
        )
    } else {
        let mut message = format!(
            "Unable to checkout `{target_branch}`. It does not exist locally or on `origin`, and fallback base branch `{base_branch}` is also unavailable.\n\
             Next steps: create `{target_branch}` or `{base_branch}`, or update the launch request with a valid baseBranch."
        );
        if let Some(fetch_warning) = fetch_warning.as_ref() {
            message.push_str("\n\nOrigin fetch also failed:\n");
            message.push_str(fetch_warning);
        }
        return Err(message);
    };

    if !checkout_result.success {
        let mut message = format!(
            "Failed to ensure checkout on `{target_branch}`.\n{}",
            render_command_result(&checkout_step, &checkout_result)
        );
        if let Some(fetch_warning) = fetch_warning.as_ref() {
            message.push_str("\n\nOrigin fetch warning:\n");
            message.push_str(fetch_warning);
        }
        return Err(message);
    }

    let branch = current_branch(&worktree_path)?;
    if branch != target_branch {
        return Err(format!(
            "Worktree branch mismatch after checkout. Expected `{target_branch}`, found `{branch}`."
        ));
    }

    let mut message = format!("Checked out branch `{branch}` ({checkout_detail})");
    if fetch_warning.is_some() {
        message.push_str("; origin fetch was unavailable, so local refs were used");
    }

    Ok(StageOutcome::Completed(message))
}

fn run_deps_install(context: &PipelineContext) -> Result<StageOutcome, String> {
    let worktree_path = resolve_worktree_path(context)?;
    if !worktree_path.join("package.json").is_file() {
        return Ok(StageOutcome::Skipped(
            "No package.json found; dependency install skipped".to_string(),
        ));
    }

    let install = run_command(&worktree_path, "bun", ["install"])?;
    if !install.success {
        return Err(format!(
            "Dependency install failed.\n{}",
            render_command_result("bun install", &install)
        ));
    }

    let marker_path = dependency_marker_path(&worktree_path);
    if let Some(parent) = marker_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create dependency marker directory: {error}"))?;
    }
    fs::write(&marker_path, b"bun install completed\n")
        .map_err(|error| format!("Failed to write dependency marker: {error}"))?;

    Ok(StageOutcome::Completed(format!(
        "Installed dependencies with bun install (marker: `{}`)",
        marker_path.display()
    )))
}

fn run_mcp_install(context: &PipelineContext) -> Result<StageOutcome, String> {
    let worktree_path = resolve_worktree_path(context)?;
    ensure_directory(&worktree_path, "worktree")?;

    let Some(config_path) = resolve_first_existing_path(&worktree_path, &MCP_CONFIG_RELATIVE_PATHS)
    else {
        return Ok(StageOutcome::Completed(
            "No MCP configuration provided; nothing to apply".to_string(),
        ));
    };

    let raw = fs::read_to_string(&config_path).map_err(|error| {
        format!(
            "Failed to read MCP config `{}`: {error}",
            config_path.display()
        )
    })?;
    let parsed: JsonValue = serde_json::from_str(&raw).map_err(|error| {
        format!(
            "Invalid MCP config JSON in `{}`: {error}",
            config_path.display()
        )
    })?;
    let mcp_servers = extract_mcp_servers(&parsed)?;
    if mcp_servers.is_empty() {
        return Ok(StageOutcome::Completed(format!(
            "MCP config `{}` has no `mcpServers` entries; nothing to apply",
            config_path.display()
        )));
    }

    let requested_overrides = context
        .mcp_server_overrides
        .as_ref()
        .map(|overrides| {
            overrides
                .iter()
                .map(|item| item.trim())
                .filter(|item| !item.is_empty())
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let (selected_servers, missing_overrides) =
        select_mcp_servers(&mcp_servers, &requested_overrides);
    if selected_servers.is_empty() {
        if requested_overrides.is_empty() {
            return Ok(StageOutcome::Completed(
                "No MCP servers resolved from configuration; nothing to apply".to_string(),
            ));
        }

        return Ok(StageOutcome::Completed(format!(
            "MCP overrides were provided ({}) but none matched `{}`; nothing to apply",
            requested_overrides.join(", "),
            config_path.display()
        )));
    }

    let _ = ensure_claude_settings_file(&worktree_path)?;
    let settings_path = worktree_path.join(CLAUDE_SETTINGS_LOCAL_RELATIVE_PATH);
    if let Some(parent) = settings_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to create Claude local settings directory `{}`: {error}",
                parent.display()
            )
        })?;
    }

    let mut settings = read_json_object_file(&settings_path)?;
    settings.insert(
        "mcpServers".to_string(),
        JsonValue::Object(selected_servers.clone()),
    );
    let rendered = render_deterministic_json(&JsonValue::Object(settings))?;
    let existing = fs::read_to_string(&settings_path).unwrap_or_default();
    let updated = existing != rendered;
    if updated {
        fs::write(&settings_path, rendered).map_err(|error| {
            format!(
                "Failed to update Claude settings with MCP servers at `{}`: {error}",
                settings_path.display()
            )
        })?;
    }

    let suffix = if updated {
        "updated"
    } else {
        "already current"
    };
    let mut message = format!(
        "Applied {} MCP server(s) from `{}` to `{}` ({suffix})",
        selected_servers.len(),
        config_path.display(),
        settings_path.display()
    );
    if !requested_overrides.is_empty() {
        message.push_str(&format!(
            "; requested overrides: {}",
            requested_overrides.join(", ")
        ));
    }
    if !missing_overrides.is_empty() {
        message.push_str(&format!(
            "; missing overrides: {}",
            missing_overrides.join(", ")
        ));
    }

    Ok(StageOutcome::Completed(message))
}

fn run_workspace_customization(context: &PipelineContext) -> Result<StageOutcome, String> {
    let worktree_path = resolve_worktree_path(context)?;
    ensure_directory(&worktree_path, "worktree")?;

    let script_path = worktree_path.join(WORKSPACE_CUSTOMIZATION_SCRIPT_RELATIVE_PATH);
    let json_path = worktree_path.join(WORKSPACE_CUSTOMIZATION_JSON_RELATIVE_PATH);

    let mut executed_steps = 0usize;
    let mut details = Vec::new();

    if let Some(customization) = context.workspace_customization.as_ref() {
        let payload_details = apply_workspace_customization_payload(&worktree_path, customization)?;
        executed_steps += payload_details.executed_steps;
        details.extend(payload_details.details);
    }

    if json_path.is_file() {
        let raw = fs::read_to_string(&json_path).map_err(|error| {
            format!(
                "Failed to read workspace customization config `{}`: {error}",
                json_path.display()
            )
        })?;
        let commands = parse_workspace_customization_commands(&raw).map_err(|error| {
            format!(
                "Invalid workspace customization config `{}`: {error}",
                json_path.display()
            )
        })?;
        for (index, command) in commands.iter().enumerate() {
            let result = run_shell_command(&worktree_path, command)?;
            if !result.success {
                return Err(format!(
                    "Workspace customization command {} failed.\n{}",
                    index + 1,
                    render_command_result(&format!("sh -lc {command:?}"), &result)
                ));
            }
            executed_steps += 1;
        }

        details.push(format!(
            "{} command(s) from `{}`",
            commands.len(),
            json_path.display()
        ));
    }

    if script_path.is_file() {
        let script = script_path.to_string_lossy().to_string();
        let result = run_command(&worktree_path, "bash", [script.as_str()])?;
        if !result.success {
            return Err(format!(
                "Workspace customization script failed.\n{}",
                render_command_result(&format!("bash {}", script_path.display()), &result)
            ));
        }

        executed_steps += 1;
        details.push(format!("script `{}`", script_path.display()));
    }

    if executed_steps == 0 {
        return Ok(StageOutcome::Completed(
            "No workspace customization config provided; nothing to apply".to_string(),
        ));
    }

    Ok(StageOutcome::Completed(format!(
        "Applied workspace customization ({})",
        details.join(", ")
    )))
}

fn run_health_check(context: &PipelineContext) -> Result<StageOutcome, String> {
    let worktree_path = resolve_worktree_path(context)?;
    ensure_directory(&worktree_path, "worktree")?;
    ensure_git_worktree(&worktree_path)?;

    let repo_root = canonical_repository_path(&context.repository_path)?;
    if !is_registered_worktree(&repo_root, &worktree_path)? {
        return Err(format!(
            "Worktree `{}` is not registered in `git worktree list` for repo `{}`.",
            worktree_path.display(),
            repo_root.display()
        ));
    }

    let branch = current_branch(&worktree_path)?;
    let expected_branch = context.worktree_branch.trim();
    if branch != expected_branch {
        return Err(format!(
            "Health check detected unexpected branch. Expected `{expected_branch}`, found `{branch}`."
        ));
    }

    let status = run_command(
        &worktree_path,
        "git",
        ["status", "--porcelain", "--untracked-files=no"],
    )?;
    if !status.success {
        return Err(format!(
            "Health check could not evaluate git status.\n{}",
            render_command_result("git status --porcelain --untracked-files=no", &status)
        ));
    }
    if !status.stdout.trim().is_empty() {
        let preview = status.stdout.lines().take(5).collect::<Vec<_>>().join("\n");
        return Err(format!(
            "Worktree has uncommitted tracked changes:\n{}\n\nCommit, stash, or reset these changes before launching.",
            preview
        ));
    }

    if worktree_path.join("package.json").is_file() {
        let has_marker = dependency_marker_path(&worktree_path).is_file();
        let has_node_modules = worktree_path.join("node_modules").is_dir();
        let has_lockfile = [
            "bun.lock",
            "bun.lockb",
            "package-lock.json",
            "yarn.lock",
            "pnpm-lock.yaml",
        ]
        .iter()
        .any(|path| worktree_path.join(path).is_file());
        if !(has_marker || has_node_modules || has_lockfile) {
            return Err(format!(
                "Dependencies appear unprepared for `{}`: expected dependency marker (`{}`), `node_modules`, or a lockfile after depsInstall.",
                worktree_path.display(),
                dependency_marker_path(&worktree_path).display()
            ));
        }
    }

    let runner = detect_runner_availability()?;

    Ok(StageOutcome::Completed(format!(
        "Health checks passed for local worktree (`{branch}`; {})",
        runner.summary()
    )))
}

fn ensure_claude_settings_file(worktree_path: &Path) -> Result<(PathBuf, bool), String> {
    let settings_path = worktree_path.join(CLAUDE_SETTINGS_RELATIVE_PATH);
    if let Some(parent) = settings_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to create Claude settings directory `{}`: {error}",
                parent.display()
            )
        })?;
    }

    if settings_path.is_file() {
        return Ok((settings_path, false));
    }

    fs::write(&settings_path, DEFAULT_CLAUDE_SETTINGS_JSON).map_err(|error| {
        format!(
            "Failed to write deterministic Claude settings file `{}`: {error}",
            settings_path.display()
        )
    })?;

    Ok((settings_path, true))
}

fn dependency_marker_path(worktree_path: &Path) -> PathBuf {
    worktree_path.join(DEP_INSTALL_MARKER_RELATIVE_PATH)
}

fn ensure_directory(path: &Path, label: &str) -> Result<(), String> {
    let metadata =
        fs::metadata(path).map_err(|error| format!("Unable to read {label} metadata: {error}"))?;
    if !metadata.is_dir() {
        return Err(format!(
            "{label} path `{}` is not a directory",
            path.display()
        ));
    }
    Ok(())
}

fn ensure_git_worktree(worktree_path: &Path) -> Result<(), String> {
    let inside = run_command(worktree_path, "git", ["rev-parse", "--is-inside-work-tree"])?;
    if !inside.success || inside.stdout.trim() != "true" {
        return Err(format!(
            "Path `{}` is not a valid git worktree.\n{}",
            worktree_path.display(),
            render_command_result("git rev-parse --is-inside-work-tree", &inside)
        ));
    }
    Ok(())
}

fn git_ref_exists(worktree_path: &Path, reference: &str) -> Result<bool, String> {
    let probe = run_command(
        worktree_path,
        "git",
        ["show-ref", "--verify", "--quiet", reference],
    )?;
    match probe.exit_code {
        Some(0) => Ok(true),
        Some(1) => Ok(false),
        Some(_) | None => Err(format!(
            "Failed to inspect git reference `{reference}`.\n{}",
            render_command_result(
                &format!("git show-ref --verify --quiet {reference}"),
                &probe
            )
        )),
    }
}

fn resolve_first_existing_path(worktree_path: &Path, relative_paths: &[&str]) -> Option<PathBuf> {
    relative_paths
        .iter()
        .map(|relative| worktree_path.join(relative))
        .find(|candidate| candidate.is_file())
}

fn extract_mcp_servers(config: &JsonValue) -> Result<JsonMap<String, JsonValue>, String> {
    let root = config
        .as_object()
        .ok_or_else(|| "MCP config root must be a JSON object".to_string())?;
    let Some(mcp_servers) = root.get("mcpServers") else {
        return Ok(JsonMap::new());
    };
    let mcp_servers_object = mcp_servers
        .as_object()
        .ok_or_else(|| "`mcpServers` must be a JSON object".to_string())?;

    let mut keys = mcp_servers_object.keys().cloned().collect::<Vec<_>>();
    keys.sort();

    let mut normalized = JsonMap::new();
    for key in keys {
        if let Some(value) = mcp_servers_object.get(&key) {
            normalized.insert(key, normalize_json(value.clone()));
        }
    }

    Ok(normalized)
}

fn read_json_object_file(path: &Path) -> Result<JsonMap<String, JsonValue>, String> {
    if !path.is_file() {
        return Ok(JsonMap::new());
    }

    let raw = fs::read_to_string(path)
        .map_err(|error| format!("Failed to read JSON file `{}`: {error}", path.display()))?;
    if raw.trim().is_empty() {
        return Ok(JsonMap::new());
    }

    let parsed: JsonValue = serde_json::from_str(&raw)
        .map_err(|error| format!("Invalid JSON in `{}`: {error}", path.display()))?;
    parsed
        .as_object()
        .cloned()
        .ok_or_else(|| format!("JSON root in `{}` must be an object", path.display()))
}

fn normalize_json(value: JsonValue) -> JsonValue {
    match value {
        JsonValue::Object(map) => {
            let mut entries = map.into_iter().collect::<Vec<_>>();
            entries.sort_by(|(left, _), (right, _)| left.cmp(right));
            let mut normalized = JsonMap::new();
            for (key, child) in entries {
                normalized.insert(key, normalize_json(child));
            }
            JsonValue::Object(normalized)
        }
        JsonValue::Array(values) => {
            JsonValue::Array(values.into_iter().map(normalize_json).collect::<Vec<_>>())
        }
        other => other,
    }
}

fn render_deterministic_json(value: &JsonValue) -> Result<String, String> {
    serde_json::to_string_pretty(&normalize_json(value.clone()))
        .map(|rendered| format!("{rendered}\n"))
        .map_err(|error| format!("Failed to render deterministic JSON: {error}"))
}

fn parse_workspace_customization_commands(raw: &str) -> Result<Vec<String>, String> {
    let parsed: JsonValue =
        serde_json::from_str(raw).map_err(|error| format!("invalid JSON: {error}"))?;
    let root = parsed
        .as_object()
        .ok_or_else(|| "config root must be an object".to_string())?;

    let Some(commands) = root.get("commands") else {
        return Ok(Vec::new());
    };
    let commands_array = commands
        .as_array()
        .ok_or_else(|| "`commands` must be an array of strings".to_string())?;

    let mut result = Vec::with_capacity(commands_array.len());
    for command in commands_array {
        let raw_command = command
            .as_str()
            .ok_or_else(|| "`commands` must contain only strings".to_string())?;
        let trimmed = raw_command.trim();
        if !trimmed.is_empty() {
            result.push(trimmed.to_string());
        }
    }

    Ok(result)
}

fn run_shell_command(cwd: &Path, command: &str) -> Result<CommandResult, String> {
    let output = Command::new("sh")
        .current_dir(cwd)
        .args(["-lc", command])
        .output()
        .map_err(|error| {
            format!(
                "Failed to run shell command in `{}`: {error}",
                cwd.display()
            )
        })?;
    Ok(command_result(output))
}

fn select_mcp_servers(
    mcp_servers: &JsonMap<String, JsonValue>,
    requested_overrides: &[String],
) -> (JsonMap<String, JsonValue>, Vec<String>) {
    if requested_overrides.is_empty() {
        return (mcp_servers.clone(), Vec::new());
    }

    let mut selected = JsonMap::new();
    let mut missing = Vec::new();

    for override_name in requested_overrides {
        if let Some(server) = mcp_servers.get(override_name) {
            selected.insert(override_name.clone(), server.clone());
        } else {
            missing.push(override_name.clone());
        }
    }

    (selected, missing)
}

#[derive(Debug, Default)]
struct WorkspaceCustomizationResult {
    executed_steps: usize,
    details: Vec<String>,
}

fn apply_workspace_customization_payload(
    worktree_path: &Path,
    customization: &WorkspaceCustomizationPayload,
) -> Result<WorkspaceCustomizationResult, String> {
    let mut result = WorkspaceCustomizationResult::default();

    if let Some(dotfiles) = customization.dotfiles.as_ref() {
        let mut applied = 0usize;
        for dotfile in dotfiles {
            let target = resolve_workspace_relative_path(worktree_path, &dotfile.path)?;
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    format!(
                        "Failed to create dotfile parent directory `{}`: {error}",
                        parent.display()
                    )
                })?;
            }
            fs::write(&target, dotfile.content.as_bytes()).map_err(|error| {
                format!("Failed to write dotfile `{}`: {error}", target.display())
            })?;
            applied += 1;
        }

        if applied > 0 {
            result.executed_steps += applied;
            result.details.push(format!("{applied} payload dotfile(s)"));
        }
    }

    if let Some(shell_aliases) = customization.shell_aliases.as_ref() {
        let aliases = shell_aliases
            .iter()
            .filter_map(|alias| {
                let name = alias.name.trim();
                let command = alias.command.trim();
                if name.is_empty() || command.is_empty() {
                    None
                } else {
                    Some((name.to_string(), command.to_string()))
                }
            })
            .collect::<Vec<_>>();
        if !aliases.is_empty() {
            let alias_script = worktree_path.join(".foundry/shell-aliases.sh");
            if let Some(parent) = alias_script.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    format!(
                        "Failed to create shell alias directory `{}`: {error}",
                        parent.display()
                    )
                })?;
            }

            let mut lines = vec!["# Generated by Foundry local pipeline".to_string()];
            for (name, command) in aliases.iter() {
                if !name.chars().all(|character| {
                    character.is_ascii_alphanumeric() || character == '_' || character == '-'
                }) {
                    return Err(format!(
                        "Shell alias name `{name}` is invalid. Use only letters, numbers, `_`, or `-`."
                    ));
                }
                lines.push(format!(
                    "alias {name}='{}'",
                    command.replace('\'', "'\"'\"'")
                ));
            }
            fs::write(&alias_script, format!("{}\n", lines.join("\n"))).map_err(|error| {
                format!(
                    "Failed to write shell aliases file `{}`: {error}",
                    alias_script.display()
                )
            })?;

            result.executed_steps += aliases.len();
            result
                .details
                .push(format!("{} payload shell alias(es)", aliases.len()));
        }
    }

    if let Some(dev_tool_configs) = customization.dev_tool_configs.as_ref() {
        let mut applied = 0usize;
        for config in dev_tool_configs {
            if config.tool.trim().is_empty() {
                return Err("Workspace customization dev tool name cannot be empty".to_string());
            }
            let tool = sanitize_segment(&config.tool);

            let target = worktree_path
                .join(".foundry")
                .join("dev-tool-configs")
                .join(format!("{tool}.json"));
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    format!(
                        "Failed to create dev tool config directory `{}`: {error}",
                        parent.display()
                    )
                })?;
            }
            fs::write(&target, config.config.as_bytes()).map_err(|error| {
                format!(
                    "Failed to write dev tool config `{}`: {error}",
                    target.display()
                )
            })?;
            applied += 1;
        }

        if applied > 0 {
            result.executed_steps += applied;
            result
                .details
                .push(format!("{applied} payload dev-tool config(s)"));
        }
    }

    if let Some(setup_scripts) = customization.setup_scripts.as_ref() {
        let mut scripts = setup_scripts
            .iter()
            .filter_map(|script| {
                let script_body = script.script.trim();
                if script_body.is_empty() {
                    None
                } else {
                    Some((
                        script.run_order,
                        script.name.trim().to_string(),
                        script_body.to_string(),
                    ))
                }
            })
            .collect::<Vec<_>>();
        scripts.sort_by(|left, right| left.0.cmp(&right.0).then(left.1.cmp(&right.1)));

        let mut applied = 0usize;
        for (_, name, script_body) in scripts {
            let result_for_script = run_shell_command(worktree_path, &script_body)?;
            if !result_for_script.success {
                return Err(format!(
                    "Workspace setup script `{}` failed.\n{}",
                    name,
                    render_command_result(&format!("sh -lc {script_body:?}"), &result_for_script)
                ));
            }
            applied += 1;
        }

        if applied > 0 {
            result.executed_steps += applied;
            result
                .details
                .push(format!("{applied} payload setup script(s)"));
        }
    }

    Ok(result)
}

fn resolve_workspace_relative_path(
    worktree_path: &Path,
    raw_path: &str,
) -> Result<PathBuf, String> {
    let trimmed = raw_path.trim();
    if trimmed.is_empty() {
        return Err("Workspace customization path cannot be empty".to_string());
    }
    if trimmed.contains('\0') {
        return Err("Workspace customization path contains invalid null bytes".to_string());
    }

    let candidate = PathBuf::from(trimmed);
    if candidate.is_absolute() {
        return Err(format!(
            "Workspace customization path `{trimmed}` must be relative to the worktree root"
        ));
    }
    if candidate
        .components()
        .any(|component| matches!(component, std::path::Component::ParentDir))
    {
        return Err(format!(
            "Workspace customization path `{trimmed}` cannot contain `..` segments"
        ));
    }

    Ok(worktree_path.join(candidate))
}

#[derive(Debug, Clone)]
enum RunnerAvailability {
    Cli {
        version: String,
    },
    Sdk {
        detail: String,
        cli_warning: Option<String>,
    },
}

impl RunnerAvailability {
    fn summary(&self) -> String {
        match self {
            Self::Cli { version } => format!("runner: Claude CLI ({version})"),
            Self::Sdk {
                detail,
                cli_warning: None,
            } => format!("runner: SDK fallback ({detail})"),
            Self::Sdk {
                detail,
                cli_warning: Some(warning),
            } => format!("runner: SDK fallback ({detail}; CLI warning: {warning})"),
        }
    }
}

fn detect_runner_availability() -> Result<RunnerAvailability, String> {
    let mut cli_warning = None;

    if ClaudeCliRunner::configured_binary_available() {
        match probe_claude_cli_version() {
            Ok(version) => return Ok(RunnerAvailability::Cli { version }),
            Err(error) => cli_warning = Some(error),
        }
    }

    match ClaudeSdkRunner::runtime_accessibility_check() {
        Ok(detail) => Ok(RunnerAvailability::Sdk { detail, cli_warning }),
        Err(sdk_error) => match cli_warning {
            Some(cli_warning) => Err(format!(
                "Neither Claude CLI nor SDK fallback is usable.\n\
                 Claude CLI warning: {cli_warning}\n\
                 SDK fallback error: {sdk_error}\n\
                 Install Claude CLI, or set a valid `FOUNDRY_AGENT_SDK_RUNNER_PATH` and Node.js runtime."
            )),
            None => Err(format!(
                "Claude CLI was not detected and SDK fallback is unavailable: {sdk_error}\n\
                 Install Claude CLI or configure SDK fallback with `FOUNDRY_AGENT_SDK_RUNNER_PATH`."
            )),
        },
    }
}

fn probe_claude_cli_version() -> Result<String, String> {
    let binary = ClaudeCliRunner::configured_binary();
    let output = Command::new(&binary)
        .arg("--version")
        .output()
        .map_err(|error| format!("Failed to run `{binary} --version`: {error}"))?;
    let result = command_result(output);
    if !result.success {
        return Err(format!(
            "Claude CLI version check failed.\n{}",
            render_command_result("claude --version", &result)
        ));
    }

    Ok(first_non_empty_line(&result.stdout)
        .or_else(|| first_non_empty_line(&result.stderr))
        .unwrap_or_else(|| "version output unavailable".to_string()))
}

fn validate_context(context: &PipelineContext) -> Result<(), String> {
    if context.local_session_id.trim().is_empty() {
        return Err("localSessionId cannot be empty".to_string());
    }
    if context.convex_session_id.trim().is_empty() {
        return Err("convexSessionId cannot be empty".to_string());
    }
    if context.repository_path.trim().is_empty() {
        return Err("repositoryPath cannot be empty".to_string());
    }
    if context.worktree_branch.trim().is_empty() {
        return Err("worktreeBranch cannot be empty".to_string());
    }
    if context.base_branch.trim().is_empty() {
        return Err("baseBranch cannot be empty".to_string());
    }
    Ok(())
}

fn resolve_worktree_path(context: &PipelineContext) -> Result<PathBuf, String> {
    let worktree_path = context
        .worktree_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "worktreePath has not been initialized".to_string())?;
    Ok(PathBuf::from(worktree_path))
}

fn canonical_repository_path(repository_path: &str) -> Result<PathBuf, String> {
    let trimmed = repository_path.trim();
    if trimmed.is_empty() {
        return Err("repositoryPath cannot be empty".to_string());
    }

    let canonical = PathBuf::from(trimmed)
        .canonicalize()
        .map_err(|error| format!("repositoryPath `{trimmed}` is not accessible: {error}"))?;
    let metadata = canonical
        .metadata()
        .map_err(|error| format!("failed to read repository metadata: {error}"))?;
    if !metadata.is_dir() {
        return Err(format!(
            "repositoryPath `{}` must be a directory",
            canonical.display()
        ));
    }

    Ok(canonical)
}

fn current_branch(worktree_path: &Path) -> Result<String, String> {
    let branch = run_command(worktree_path, "git", ["rev-parse", "--abbrev-ref", "HEAD"])?;
    if !branch.success {
        return Err(format!(
            "Unable to resolve current branch.\n{}",
            render_command_result("git rev-parse --abbrev-ref HEAD", &branch)
        ));
    }

    let value = branch.stdout.trim();
    if value.is_empty() {
        return Err("Git returned an empty branch name".to_string());
    }

    Ok(value.to_string())
}

fn is_registered_worktree(repo_root: &Path, worktree_path: &Path) -> Result<bool, String> {
    let listed = run_command(repo_root, "git", ["worktree", "list", "--porcelain"])?;
    if !listed.success {
        return Err(format!(
            "Failed to list existing worktrees.\n{}",
            render_command_result("git worktree list --porcelain", &listed)
        ));
    }

    let canonical_target =
        fs::canonicalize(worktree_path).unwrap_or_else(|_| worktree_path.to_path_buf());
    for line in listed.stdout.lines() {
        if let Some(raw_path) = line.strip_prefix("worktree ") {
            let candidate = PathBuf::from(raw_path.trim());
            let canonical_candidate = fs::canonicalize(&candidate).unwrap_or(candidate);
            if canonical_candidate == canonical_target {
                return Ok(true);
            }
        }
    }

    Ok(false)
}

#[derive(Debug)]
struct CommandResult {
    success: bool,
    exit_code: Option<i32>,
    stdout: String,
    stderr: String,
}

fn run_command<'a, I>(cwd: &Path, program: &str, args: I) -> Result<CommandResult, String>
where
    I: IntoIterator<Item = &'a str>,
{
    let output = Command::new(program)
        .current_dir(cwd)
        .args(args)
        .output()
        .map_err(|error| format!("Failed to run `{program}` in `{}`: {error}", cwd.display()))?;
    Ok(command_result(output))
}

fn command_result(output: Output) -> CommandResult {
    CommandResult {
        success: output.status.success(),
        exit_code: output.status.code(),
        stdout: String::from_utf8_lossy(&output.stdout).trim().to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
    }
}

fn render_command_result(step: &str, result: &CommandResult) -> String {
    let stdout = if result.stdout.is_empty() {
        "<empty>"
    } else {
        result.stdout.as_str()
    };
    let stderr = if result.stderr.is_empty() {
        "<empty>"
    } else {
        result.stderr.as_str()
    };

    format!(
        "step: {step}\nsuccess: {}\nexit_code: {}\nstdout:\n{stdout}\nstderr:\n{stderr}",
        result.success,
        result
            .exit_code
            .map(|value| value.to_string())
            .unwrap_or_else(|| "unknown".to_string())
    )
}

fn sanitize_segment(input: &str) -> String {
    let sanitized = input
        .trim()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();

    if sanitized.is_empty() {
        "session".to_string()
    } else {
        sanitized
    }
}

fn current_timestamp_ms() -> i64 {
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_millis() as i64,
        Err(_) => 0,
    }
}

fn canonicalize_lossy(path: &Path) -> String {
    fs::canonicalize(path)
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
        .to_string()
}

fn first_non_empty_line(value: &str) -> Option<String> {
    value
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::{
        current_branch, ensure_claude_settings_file, extract_mcp_servers,
        parse_workspace_customization_commands, run_auth_setup, run_git_checkout, run_health_check,
        run_mcp_install, run_workspace_customization, run_worktree_setup, LocalPipeline,
        PipelineContext, PipelineStage, StageOutcome, DEFAULT_CLAUDE_SETTINGS_JSON,
    };
    use crate::commands::types::{
        RuntimeKind, SessionConfig, WorkspaceCustomizationDotfile, WorkspaceCustomizationPayload,
        WorkspaceCustomizationSetupScript,
    };
    use crate::runtime::RuntimeSessionStore;
    use serde_json::json;
    use std::collections::HashMap;
    use std::env;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::process::Command;
    use std::time::{SystemTime, UNIX_EPOCH};

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

    fn unique_temp_dir(prefix: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be valid")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("foundry-pipeline-{prefix}-{nonce}"));
        fs::create_dir_all(&path).expect("temp dir should be created");
        path
    }

    fn run_git(cwd: &Path, args: &[&str]) {
        let output = Command::new("git")
            .current_dir(cwd)
            .args(args)
            .output()
            .expect("git command should run");
        if !output.status.success() {
            panic!(
                "git {:?} failed:\nstdout:\n{}\nstderr:\n{}",
                args,
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            );
        }
    }

    fn init_git_repo(path: &Path, branch: &str) {
        run_git(path, &["init", "-b", branch]);
        run_git(path, &["config", "user.name", "Foundry Test"]);
        run_git(path, &["config", "user.email", "foundry-tests@example.com"]);
        fs::write(path.join("README.md"), "hello\n").expect("readme should be written");
        run_git(path, &["add", "README.md"]);
        run_git(path, &["commit", "-m", "initial"]);
    }

    fn test_context(
        worktree_path: &Path,
        worktree_branch: &str,
        base_branch: &str,
    ) -> PipelineContext {
        PipelineContext {
            local_session_id: "session-test".to_string(),
            convex_session_id: "session-test".to_string(),
            worktree_branch: worktree_branch.to_string(),
            repository_path: worktree_path.to_string_lossy().to_string(),
            base_branch: base_branch.to_string(),
            prompt: "prompt".to_string(),
            model: None,
            max_turns: None,
            mcp_server_overrides: None,
            workspace_customization: None,
            worktree_path: Some(worktree_path.to_string_lossy().to_string()),
        }
    }

    fn ensure_runtime_session(store: &RuntimeSessionStore, context: &PipelineContext) {
        store
            .create_session_with_id(
                &context.local_session_id,
                &SessionConfig {
                    org_id: "local".to_string(),
                    project_id: "local".to_string(),
                    repository_path: context.repository_path.clone(),
                    base_branch: context.base_branch.clone(),
                    runtime: RuntimeKind::Local,
                },
            )
            .expect("runtime session should be created");
    }

    #[test]
    fn planned_stage_keys_match_convex_stage_constants() {
        let stages = [
            (PipelineStage::WorktreeSetup, "containerProvision"),
            (PipelineStage::EnvValidation, "systemSetup"),
            (PipelineStage::AuthSetup, "authSetup"),
            (PipelineStage::ClaudeConfig, "claudeConfig"),
            (PipelineStage::GitCheckout, "gitClone"),
            (PipelineStage::DepsInstall, "depsInstall"),
            (PipelineStage::McpInstall, "mcpInstall"),
            (
                PipelineStage::WorkspaceCustomization,
                "workspaceCustomization",
            ),
            (PipelineStage::HealthCheck, "healthCheck"),
            (PipelineStage::Ready, "ready"),
        ];

        for (stage, expected_key) in stages {
            assert_eq!(stage.convex_key(), expected_key);
        }
    }

    #[tokio::test]
    async fn execute_rejects_missing_runtime_session() {
        let _guard = RuntimeSessionStore::acquire_test_lock();
        let store = RuntimeSessionStore::default();
        store.reset_for_tests();

        let mut context = PipelineContext {
            local_session_id: "session-does-not-exist".to_string(),
            convex_session_id: "session-does-not-exist".to_string(),
            worktree_branch: "foundry/task".to_string(),
            repository_path: ".".to_string(),
            base_branch: "main".to_string(),
            prompt: "hello".to_string(),
            model: None,
            max_turns: None,
            mcp_server_overrides: None,
            workspace_customization: None,
            worktree_path: None,
        };

        let error = LocalPipeline::default()
            .execute(&mut context)
            .await
            .expect_err("missing session should fail before running stages");
        assert_eq!(error.stage, "validation");
        assert!(error
            .error
            .contains("session session-does-not-exist not found"));
    }

    #[test]
    fn ensure_claude_settings_file_creates_deterministic_content() {
        let dir = unique_temp_dir("claude-settings");
        let (settings_path, wrote_settings) =
            ensure_claude_settings_file(&dir).expect("settings file should be ensured");
        assert!(wrote_settings);
        assert!(settings_path.is_file());
        let content = fs::read_to_string(settings_path).expect("settings file should be readable");
        assert_eq!(content, DEFAULT_CLAUDE_SETTINGS_JSON);
    }

    #[test]
    fn extract_mcp_servers_accepts_standard_config_shape() {
        let config = json!({
            "mcpServers": {
                "zeta": { "command": "npx", "args": ["server-z"] },
                "alpha": { "command": "npx", "args": ["server-a"] }
            }
        });
        let servers = extract_mcp_servers(&config).expect("mcp config should parse");
        let keys = servers.keys().cloned().collect::<Vec<_>>();
        assert_eq!(keys, vec!["alpha".to_string(), "zeta".to_string()]);
    }

    #[test]
    fn parse_workspace_customization_commands_filters_empty_commands() {
        let commands = parse_workspace_customization_commands(
            r#"{
                "commands": ["  echo first  ", "", "   ", "echo second"]
            }"#,
        )
        .expect("workspace customization config should parse");

        assert_eq!(
            commands,
            vec!["echo first".to_string(), "echo second".to_string()]
        );
    }

    #[tokio::test]
    async fn run_auth_setup_accepts_claude_code_oauth_session_without_api_key() {
        let temp_home = unique_temp_dir("auth-oauth");
        fs::write(
            temp_home.join(".claude.json"),
            r#"{
                "oauthAccount": {
                    "emailAddress": "developer@example.com"
                }
            }"#,
        )
        .expect("claude oauth config should be written");
        let _env_guard = EnvGuard::capture(&["ANTHROPIC_API_KEY", "HOME", "USERPROFILE"]);
        env::remove_var("ANTHROPIC_API_KEY");
        env::set_var("HOME", temp_home.to_string_lossy().to_string());
        env::set_var("USERPROFILE", temp_home.to_string_lossy().to_string());

        let outcome = run_auth_setup()
            .await
            .expect("oauth-authenticated setups should pass auth stage");

        match outcome {
            StageOutcome::Completed(message) => {
                assert!(message.contains("Detected Claude Code OAuth session"));
                assert!(message.contains("developer@example.com"));
            }
            StageOutcome::Skipped(reason) => panic!("unexpected skip: {reason}"),
        }
    }

    #[tokio::test]
    async fn run_auth_setup_reports_actionable_error_without_any_auth_source() {
        let temp_home = unique_temp_dir("auth-missing");
        let _env_guard = EnvGuard::capture(&["ANTHROPIC_API_KEY", "HOME", "USERPROFILE"]);
        env::remove_var("ANTHROPIC_API_KEY");
        env::set_var("HOME", temp_home.to_string_lossy().to_string());
        env::set_var("USERPROFILE", temp_home.to_string_lossy().to_string());

        let error = run_auth_setup()
            .await
            .expect_err("missing auth should fail with a remediation hint");
        assert!(error.contains("Missing Claude authentication"));
        assert!(error.contains("claude auth login"));
    }

    #[test]
    fn run_mcp_install_completes_when_no_config_is_present() {
        let dir = unique_temp_dir("mcp-empty");
        let context = test_context(&dir, "main", "main");
        let outcome = run_mcp_install(&context).expect("stage should complete");
        match outcome {
            StageOutcome::Completed(message) => {
                assert!(message.contains("No MCP configuration provided"));
            }
            StageOutcome::Skipped(reason) => {
                panic!("unexpected skip: {reason}");
            }
        }
    }

    #[test]
    fn run_mcp_install_applies_servers_to_claude_settings() {
        let dir = unique_temp_dir("mcp-apply");
        fs::write(
            dir.join(".mcp.json"),
            r#"{
                "mcpServers": {
                    "cloudflare": { "command": "npx", "args": ["mcp-remote", "https://docs.mcp.cloudflare.com/mcp"] }
                }
            }"#,
        )
        .expect("mcp config should be written");

        let context = test_context(&dir, "main", "main");
        let outcome = run_mcp_install(&context).expect("stage should complete");
        match outcome {
            StageOutcome::Completed(message) => {
                assert!(message.contains("Applied 1 MCP server(s)"));
            }
            StageOutcome::Skipped(reason) => panic!("unexpected skip: {reason}"),
        }

        let settings = fs::read_to_string(dir.join(".claude/settings.local.json"))
            .expect("settings file should be written");
        let parsed: serde_json::Value =
            serde_json::from_str(&settings).expect("settings should remain valid JSON");
        assert!(parsed
            .get("mcpServers")
            .and_then(|value| value.get("cloudflare"))
            .is_some());
    }

    #[test]
    fn run_mcp_install_honors_requested_overrides() {
        let dir = unique_temp_dir("mcp-overrides");
        fs::write(
            dir.join(".mcp.json"),
            r#"{
                "mcpServers": {
                    "cloudflare": { "command": "npx", "args": ["mcp-remote", "https://docs.mcp.cloudflare.com/mcp"] },
                    "github": { "command": "npx", "args": ["@modelcontextprotocol/server-github"] }
                }
            }"#,
        )
        .expect("mcp config should be written");

        let mut context = test_context(&dir, "main", "main");
        context.mcp_server_overrides = Some(vec!["github".to_string()]);

        let outcome = run_mcp_install(&context).expect("stage should complete");
        match outcome {
            StageOutcome::Completed(message) => {
                assert!(message.contains("requested overrides: github"));
            }
            StageOutcome::Skipped(reason) => panic!("unexpected skip: {reason}"),
        }

        let settings = fs::read_to_string(dir.join(".claude/settings.local.json"))
            .expect("settings file should be written");
        let parsed: serde_json::Value =
            serde_json::from_str(&settings).expect("settings should remain valid JSON");
        let mcp_servers = parsed
            .get("mcpServers")
            .and_then(|value| value.as_object())
            .expect("mcpServers object should exist");
        assert_eq!(mcp_servers.len(), 1);
        assert!(mcp_servers.get("github").is_some());
    }

    #[test]
    fn run_workspace_customization_completes_without_config() {
        let dir = unique_temp_dir("workspace-custom-empty");
        let context = test_context(&dir, "main", "main");
        let outcome = run_workspace_customization(&context).expect("stage should complete");
        match outcome {
            StageOutcome::Completed(message) => {
                assert!(message.contains("No workspace customization config provided"));
            }
            StageOutcome::Skipped(reason) => panic!("unexpected skip: {reason}"),
        }
    }

    #[test]
    fn run_workspace_customization_executes_json_commands() {
        let dir = unique_temp_dir("workspace-custom-json");
        let foundry_dir = dir.join(".foundry");
        fs::create_dir_all(&foundry_dir).expect("foundry directory should exist");
        fs::write(
            foundry_dir.join("workspace-customization.json"),
            r#"{
                "commands": [
                    "mkdir -p .foundry/custom",
                    "printf customized > .foundry/custom/result.txt"
                ]
            }"#,
        )
        .expect("customization config should be written");

        let context = test_context(&dir, "main", "main");
        let outcome = run_workspace_customization(&context).expect("stage should complete");
        match outcome {
            StageOutcome::Completed(message) => {
                assert!(message.contains("Applied workspace customization"));
            }
            StageOutcome::Skipped(reason) => panic!("unexpected skip: {reason}"),
        }

        let result_path = dir.join(".foundry/custom/result.txt");
        assert!(result_path.is_file());
        let result = fs::read_to_string(result_path).expect("result file should be readable");
        assert_eq!(result, "customized");
    }

    #[test]
    fn run_workspace_customization_applies_payload_when_present() {
        let dir = unique_temp_dir("workspace-custom-payload");
        let mut context = test_context(&dir, "main", "main");
        context.workspace_customization = Some(WorkspaceCustomizationPayload {
            dotfiles: Some(vec![WorkspaceCustomizationDotfile {
                path: ".foundry/payload.env".to_string(),
                content: "HELLO=world\n".to_string(),
            }]),
            shell_aliases: None,
            dev_tool_configs: None,
            setup_scripts: Some(vec![WorkspaceCustomizationSetupScript {
                name: "touch-file".to_string(),
                script: "printf payload > .foundry/payload-script.txt".to_string(),
                run_order: 1,
            }]),
        });

        let outcome = run_workspace_customization(&context).expect("stage should complete");
        match outcome {
            StageOutcome::Completed(message) => {
                assert!(message.contains("payload"));
            }
            StageOutcome::Skipped(reason) => panic!("unexpected skip: {reason}"),
        }

        assert_eq!(
            fs::read_to_string(dir.join(".foundry/payload.env"))
                .expect("payload dotfile should be written"),
            "HELLO=world\n"
        );
        assert_eq!(
            fs::read_to_string(dir.join(".foundry/payload-script.txt"))
                .expect("payload script output should be written"),
            "payload"
        );
    }

    #[test]
    fn run_git_checkout_uses_base_branch_fallback_when_target_missing() {
        let dir = unique_temp_dir("git-checkout-fallback");
        init_git_repo(&dir, "main");

        let context = test_context(&dir, "foundry/task-1", "main");
        let outcome = run_git_checkout(&context).expect("git checkout should succeed");
        let branch = current_branch(&dir).expect("branch should be readable");

        assert_eq!(branch, "foundry/task-1");
        match outcome {
            StageOutcome::Completed(message) => {
                assert!(message.contains("fallback"));
                assert!(message.contains("origin fetch was unavailable"));
            }
            StageOutcome::Skipped(reason) => panic!("unexpected skip: {reason}"),
        }
    }

    #[tokio::test]
    async fn run_worktree_setup_recovers_from_stale_branch_registration() {
        let _guard = RuntimeSessionStore::acquire_test_lock();
        let store = RuntimeSessionStore::default();
        store.reset_for_tests();

        let repo = unique_temp_dir("worktree-stale-registration");
        init_git_repo(&repo, "main");

        let mut context = PipelineContext {
            local_session_id: "stale-registration-session".to_string(),
            convex_session_id: "stale-registration-session".to_string(),
            worktree_branch: "agent/stale-registration".to_string(),
            repository_path: repo.to_string_lossy().to_string(),
            base_branch: "main".to_string(),
            prompt: "prompt".to_string(),
            model: None,
            max_turns: None,
            mcp_server_overrides: None,
            workspace_customization: None,
            worktree_path: None,
        };
        ensure_runtime_session(&store, &context);

        let stale_worktree_path = repo
            .join(".foundry")
            .join("worktrees")
            .join("stale-registration-session");
        if let Some(parent) = stale_worktree_path.parent() {
            fs::create_dir_all(parent).expect("worktree parent directory should exist");
        }
        run_git(
            &repo,
            &[
                "worktree",
                "add",
                "-b",
                "agent/stale-registration",
                stale_worktree_path.to_string_lossy().as_ref(),
            ],
        );
        fs::remove_dir_all(&stale_worktree_path)
            .expect("stale worktree directory should be removed to simulate interruption");

        let outcome = run_worktree_setup(&mut context, &store)
            .await
            .expect("stale worktree registration should be pruned and recreated");
        match outcome {
            StageOutcome::Completed(message) => {
                assert!(message.contains("Prepared worktree"));
            }
            StageOutcome::Skipped(reason) => panic!("unexpected skip: {reason}"),
        }
        assert!(stale_worktree_path.is_dir());
        assert!(store
            .get_worktree_path(&context.local_session_id)
            .expect("worktree path should be tracked")
            .is_some());
    }

    #[test]
    fn run_health_check_reports_dirty_tracked_worktree() {
        let dir = unique_temp_dir("health-dirty");
        init_git_repo(&dir, "main");
        fs::write(dir.join("README.md"), "dirty change\n")
            .expect("tracked file should be modified");

        let context = test_context(&dir, "main", "main");
        let error = run_health_check(&context).expect_err("dirty tracked file should fail health");
        assert!(error.contains("uncommitted tracked changes"));
    }

    #[test]
    fn run_health_check_requires_dependency_artifact_when_package_json_exists() {
        let dir = unique_temp_dir("health-deps");
        init_git_repo(&dir, "main");
        fs::write(
            dir.join("package.json"),
            r#"{"name":"deps-check","version":"1.0.0"}"#,
        )
        .expect("package manifest should be written");

        let context = test_context(&dir, "main", "main");
        let error = run_health_check(&context)
            .expect_err("missing dependency artifacts should fail health");
        assert!(error.contains("Dependencies appear unprepared"));
    }
}
