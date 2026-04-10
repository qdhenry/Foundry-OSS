use crate::commands::types::{CreateWorktreeRequest, WorktreeInfo};
use crate::worktree::manager::WorktreeManager;

#[tauri::command]
pub async fn create_worktree(request: CreateWorktreeRequest) -> Result<WorktreeInfo, String> {
    WorktreeManager::default().create(&request).await
}

#[tauri::command]
pub async fn cleanup_worktree(id: String) -> Result<(), String> {
    WorktreeManager::default().cleanup(&id).await
}

#[tauri::command]
pub async fn list_worktrees() -> Result<Vec<WorktreeInfo>, String> {
    WorktreeManager::default().list().await
}
