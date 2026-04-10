use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RuntimeKind {
    Cloud,
    Local,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    Queued,
    Preparing,
    Running,
    Completed,
    Cancelled,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionConfig {
    pub org_id: String,
    pub project_id: String,
    pub repository_path: String,
    pub base_branch: String,
    pub runtime: RuntimeKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub session_id: String,
    pub status: SessionStatus,
    pub runtime: RuntimeKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStatusResponse {
    pub session_id: String,
    pub status: SessionStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartExecutionRequest {
    pub session_id: String,
    pub prompt: String,
    pub model: Option<String>,
    pub max_turns: Option<u16>,
    pub working_directory: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionHandle {
    pub execution_id: String,
    pub session_id: String,
    pub accepted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessageRequest {
    pub session_id: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceCustomizationDotfile {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceCustomizationShellAlias {
    pub name: String,
    pub command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceCustomizationDevToolConfig {
    pub tool: String,
    pub config: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceCustomizationSetupScript {
    pub name: String,
    pub script: String,
    pub run_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceCustomizationPayload {
    pub dotfiles: Option<Vec<WorkspaceCustomizationDotfile>>,
    pub shell_aliases: Option<Vec<WorkspaceCustomizationShellAlias>>,
    pub dev_tool_configs: Option<Vec<WorkspaceCustomizationDevToolConfig>>,
    pub setup_scripts: Option<Vec<WorkspaceCustomizationSetupScript>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchLocalSessionRequest {
    pub convex_session_id: String,
    pub worktree_branch: String,
    pub repository_path: String,
    pub base_branch: String,
    pub prompt: String,
    pub model: Option<String>,
    pub max_turns: Option<u16>,
    pub mcp_server_overrides: Option<Vec<String>>,
    pub workspace_customization: Option<WorkspaceCustomizationPayload>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchLocalSessionResult {
    pub local_session_id: String,
    pub convex_session_id: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorktreeRequest {
    pub session_id: String,
    pub branch: String,
    pub target_dir: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeInfo {
    pub worktree_id: String,
    pub session_id: Option<String>,
    pub path: String,
    pub branch: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitPushRequest {
    pub session_id: String,
    pub message: String,
    pub remote: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftPrRequest {
    pub session_id: String,
    pub title: String,
    pub body: Option<String>,
    pub base_branch: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckoutBranchRequest {
    pub session_id: String,
    pub branch: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitOperationResult {
    pub operation: String,
    pub success: bool,
    pub details: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyResponse {
    pub provider: String,
    pub api_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetApiKeyRequest {
    pub provider: String,
    pub api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListFilesRequest {
    pub session_id: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadFileRequest {
    pub session_id: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchChangesRequest {
    pub session_id: String,
    pub path: String,
    pub recursive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub path: String,
    pub is_dir: bool,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchHandle {
    pub watch_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrerequisiteCheck {
    pub name: String,
    pub available: bool,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrerequisitesReport {
    pub checks: Vec<PrerequisiteCheck>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigureConvexSyncRequest {
    pub base_url: Option<String>,
    pub auth_token: Option<String>,
    pub local_device_id: Option<String>,
    pub local_device_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigureConvexSyncResponse {
    pub base_url_configured: bool,
    pub auth_token_configured: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WsPortResponse {
    pub port: u16,
}

#[cfg(test)]
mod tests {
    use super::{
        LaunchLocalSessionRequest, LaunchLocalSessionResult, StartExecutionRequest,
        WorkspaceCustomizationPayload,
    };

    #[test]
    fn launch_local_session_request_and_result_are_constructible() {
        let request = LaunchLocalSessionRequest {
            convex_session_id: "session-abc".to_string(),
            worktree_branch: "foundry/task-123".to_string(),
            repository_path: "/Users/dev/my-repo".to_string(),
            base_branch: "main".to_string(),
            prompt: "Implement the login form".to_string(),
            model: Some("claude-sonnet-4-5-20250514".to_string()),
            max_turns: Some(25),
            mcp_server_overrides: Some(vec!["filesystem".to_string(), "github".to_string()]),
            workspace_customization: Some(WorkspaceCustomizationPayload {
                dotfiles: None,
                shell_aliases: None,
                dev_tool_configs: None,
                setup_scripts: None,
            }),
        };
        assert_eq!(request.convex_session_id, "session-abc");
        assert_eq!(request.repository_path, "/Users/dev/my-repo");
        assert_eq!(
            request
                .mcp_server_overrides
                .as_ref()
                .map(|overrides| overrides.len()),
            Some(2)
        );

        let result = LaunchLocalSessionResult {
            local_session_id: "local-001".to_string(),
            convex_session_id: "session-abc".to_string(),
            status: "pipeline_started".to_string(),
        };
        assert_eq!(result.status, "pipeline_started");
    }

    #[test]
    fn start_execution_request_accepts_optional_working_directory() {
        let request = StartExecutionRequest {
            session_id: "session-1".to_string(),
            prompt: "run".to_string(),
            model: None,
            max_turns: Some(1),
            working_directory: Some("/tmp/worktree".to_string()),
        };
        assert_eq!(request.working_directory.as_deref(), Some("/tmp/worktree"));
    }
}
