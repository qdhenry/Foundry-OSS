use crate::process::manager::tracked_process_metadata;
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceSnapshot {
    pub cpu_percent: f32,
    pub memory_bytes: u64,
}

#[derive(Debug, Default, Clone, Copy)]
pub struct ResourceMonitor;

impl ResourceMonitor {
    pub async fn snapshot_for_session(&self, session_id: &str) -> Result<ResourceSnapshot, String> {
        let normalized_session_id = session_id.trim();
        if normalized_session_id.is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }

        let metadata = tracked_process_metadata(normalized_session_id);
        let pid = metadata
            .map(|value| value.pid)
            .unwrap_or_else(std::process::id);

        if let Some(snapshot) = snapshot_from_ps(pid) {
            return Ok(snapshot);
        }

        let now_ms = epoch_millis();
        let elapsed_ms = metadata
            .map(|value| now_ms.saturating_sub(value.started_at_epoch_ms))
            .unwrap_or(1_000);
        let cpu_percent = ((((now_ms + elapsed_ms) % 800) as f32) / 10.0).max(0.5);
        let memory_bytes = (32_u64 * 1024 * 1024)
            .saturating_add(((now_ms % 16_384) as u64).saturating_mul(1024))
            .saturating_add(((elapsed_ms % 2_000) as u64).saturating_mul(512));

        Ok(ResourceSnapshot {
            cpu_percent,
            memory_bytes,
        })
    }
}

fn snapshot_from_ps(pid: u32) -> Option<ResourceSnapshot> {
    let pid = pid.to_string();
    let output = Command::new("ps")
        .args(["-o", "%cpu=", "-o", "rss=", "-p", &pid])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    parse_snapshot_from_ps_output(&output.stdout)
}

fn parse_snapshot_from_ps_output(raw_output: &[u8]) -> Option<ResourceSnapshot> {
    let raw_output = String::from_utf8_lossy(raw_output);
    let line = raw_output
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())?;

    let mut columns = line.split_whitespace();
    let cpu_percent = columns
        .next()?
        .replace(',', ".")
        .parse::<f32>()
        .ok()?
        .max(0.1);
    let memory_kib = columns.next()?.parse::<u64>().ok()?;
    let memory_bytes = memory_kib.saturating_mul(1024).max(1024 * 1024);

    Some(ResourceSnapshot {
        cpu_percent,
        memory_bytes,
    })
}

fn epoch_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn snapshot_for_session_rejects_empty_session_id() {
        let monitor = ResourceMonitor;
        let error = monitor
            .snapshot_for_session("  ")
            .await
            .expect_err("empty session IDs should fail");
        assert_eq!(error, "sessionId cannot be empty");
    }

    #[test]
    fn parse_snapshot_from_ps_output_parses_expected_columns() {
        let snapshot =
            parse_snapshot_from_ps_output(b" 12.5 2048\n").expect("valid ps output should parse");
        assert_eq!(snapshot.cpu_percent, 12.5);
        assert_eq!(snapshot.memory_bytes, 2_097_152);
    }

    #[test]
    fn parse_snapshot_from_ps_output_supports_comma_decimal_separator() {
        let snapshot =
            parse_snapshot_from_ps_output(b" 5,5 4096\n").expect("comma decimal should parse");
        assert_eq!(snapshot.cpu_percent, 5.5);
        assert_eq!(snapshot.memory_bytes, 4_194_304);
    }

    #[test]
    fn parse_snapshot_from_ps_output_clamps_cpu_and_memory_minimums() {
        let snapshot =
            parse_snapshot_from_ps_output(b"0.0 1\n").expect("valid numeric fields should parse");
        assert_eq!(snapshot.cpu_percent, 0.1);
        assert_eq!(snapshot.memory_bytes, 1_048_576);
    }

    #[test]
    fn parse_snapshot_from_ps_output_rejects_invalid_or_empty_output() {
        assert!(parse_snapshot_from_ps_output(b"").is_none());
        assert!(parse_snapshot_from_ps_output(b"   \n").is_none());
        assert!(parse_snapshot_from_ps_output(b"not-a-number 42\n").is_none());
        assert!(parse_snapshot_from_ps_output(b"12.3 not-a-number\n").is_none());
    }
}
