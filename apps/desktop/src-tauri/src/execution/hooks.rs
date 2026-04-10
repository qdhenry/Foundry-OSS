use crate::sync::payloads::LocalCompletionReport;
use crate::sync::session_sync::SessionSync;

#[derive(Debug, Default, Clone, Copy)]
pub struct AutoCommitHook;

impl AutoCommitHook {
    pub async fn schedule(&self, session_id: &str) -> Result<(), String> {
        if session_id.trim().is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }

        SessionSync::default()
            .report_local_completion(LocalCompletionReport::completed(session_id.to_string()))
            .await
    }

    pub async fn report_failure(
        &self,
        session_id: &str,
        error: impl Into<String>,
    ) -> Result<(), String> {
        if session_id.trim().is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }

        SessionSync::default()
            .report_local_completion(LocalCompletionReport::failed(session_id.to_string(), error))
            .await
    }
}
