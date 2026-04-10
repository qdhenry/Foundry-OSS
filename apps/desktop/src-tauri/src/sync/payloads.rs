use std::env;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DesktopLogLevel {
    Info,
    Stdout,
    Stderr,
    System,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLogEntry {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<i64>,
    pub level: DesktopLogLevel,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<Value>,
}

impl DesktopLogEntry {
    pub fn stdout(message: impl Into<String>) -> Self {
        Self {
            timestamp: Some(current_timestamp_ms()),
            level: DesktopLogLevel::Stdout,
            message: message.into(),
            metadata: None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppendBatchFromDesktopPayload {
    pub session_id: String,
    pub local_device_id: String,
    pub entries: Vec<DesktopLogEntry>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppendBatchFromDesktopResponse {
    pub inserted: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LocalCompletionStatus {
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportLocalCompletionPayload {
    pub session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<LocalCompletionStatus>,
    pub local_device_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub commit_sha: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub files_changed: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pr_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pr_number: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tokens_used: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportLocalCompletionResponse {
    pub session_id: String,
    pub status: String,
}

#[derive(Debug, Clone, Default)]
pub struct LocalCompletionReport {
    pub session_id: String,
    pub status: Option<LocalCompletionStatus>,
    pub commit_sha: Option<String>,
    pub files_changed: Option<u32>,
    pub pr_url: Option<String>,
    pub pr_number: Option<u32>,
    pub tokens_used: Option<u32>,
    pub error: Option<String>,
}

impl LocalCompletionReport {
    pub fn completed(session_id: impl Into<String>) -> Self {
        Self {
            session_id: session_id.into(),
            status: Some(LocalCompletionStatus::Completed),
            ..Self::default()
        }
    }

    pub fn failed(session_id: impl Into<String>, error: impl Into<String>) -> Self {
        Self {
            session_id: session_id.into(),
            status: Some(LocalCompletionStatus::Failed),
            error: Some(error.into()),
            ..Self::default()
        }
    }
}

#[derive(Debug, Clone)]
pub struct LocalDeviceIdentity {
    pub id: String,
    pub name: Option<String>,
}

impl LocalDeviceIdentity {
    pub fn from_env() -> Self {
        let id = first_non_empty_env(&["FOUNDRY_LOCAL_DEVICE_ID", "FOUNDRY_DESKTOP_DEVICE_ID"])
            .or_else(|| first_non_empty_env(&["COMPUTERNAME", "HOSTNAME"]))
            .map(|value| normalize_device_id(&value))
            .unwrap_or_else(|| "desktop-unknown".to_string());

        let name =
            first_non_empty_env(&["FOUNDRY_LOCAL_DEVICE_NAME", "FOUNDRY_DESKTOP_DEVICE_NAME"])
                .or_else(|| first_non_empty_env(&["COMPUTERNAME", "HOSTNAME"]));

        Self { id, name }
    }
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

fn normalize_device_id(value: &str) -> String {
    let mut normalized = String::with_capacity(value.len());

    for character in value.chars() {
        if character.is_ascii_alphanumeric() {
            normalized.push(character.to_ascii_lowercase());
        } else if matches!(character, '-' | '_' | '.') {
            normalized.push(character);
        } else {
            normalized.push('-');
        }
    }

    let normalized = normalized.trim_matches('-');
    if normalized.is_empty() {
        "desktop-unknown".to_string()
    } else {
        normalized.to_string()
    }
}

fn current_timestamp_ms() -> i64 {
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_millis() as i64,
        Err(_) => 0,
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSetupProgressPayload {
    pub session_id: String,
    pub stage: String,
    pub state: SetupProgressState,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum SetupProgressState {
    Pending,
    #[serde(rename_all = "camelCase")]
    Running {
        started_at: i64,
    },
    #[serde(rename_all = "camelCase")]
    Completed {
        started_at: i64,
        completed_at: i64,
    },
    #[serde(rename_all = "camelCase")]
    Failed {
        started_at: i64,
        failed_at: i64,
        error: String,
    },
    #[serde(rename_all = "camelCase")]
    Skipped {
        reason: String,
    },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRuntimeModePayload {
    pub session_id: String,
    pub runtime_mode: String,
}

#[cfg(test)]
mod tests {
    use super::{SetupProgressState, UpdateRuntimeModePayload, UpdateSetupProgressPayload};

    #[test]
    fn update_setup_progress_payload_serializes_with_camel_case_fields() {
        let payload = UpdateSetupProgressPayload {
            session_id: "session-1".to_string(),
            stage: "systemSetup".to_string(),
            state: SetupProgressState::Running { started_at: 1_234 },
        };

        let json = serde_json::to_value(payload).expect("serialization should succeed");
        assert_eq!(json["sessionId"], "session-1");
        assert_eq!(json["stage"], "systemSetup");
        assert_eq!(json["state"]["status"], "running");
        assert_eq!(json["state"]["startedAt"], 1_234);
    }

    #[test]
    fn update_runtime_mode_payload_serializes_with_camel_case_fields() {
        let payload = UpdateRuntimeModePayload {
            session_id: "session-1".to_string(),
            runtime_mode: "executing".to_string(),
        };

        let json = serde_json::to_value(payload).expect("serialization should succeed");
        assert_eq!(json["sessionId"], "session-1");
        assert_eq!(json["runtimeMode"], "executing");
        assert!(json.get("mode").is_none());
    }
}
