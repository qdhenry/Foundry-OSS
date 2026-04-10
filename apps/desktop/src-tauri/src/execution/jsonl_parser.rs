use serde_json::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RunnerStream {
    Stdout,
    Stderr,
}

#[derive(Debug, Clone)]
pub enum RunnerPayload {
    Json(Value),
    Text(String),
}

#[derive(Debug, Clone)]
pub struct RunnerOutputLine {
    pub stream: RunnerStream,
    pub payload: RunnerPayload,
}

impl RunnerOutputLine {
    pub fn as_log_message(&self) -> String {
        let content = match &self.payload {
            RunnerPayload::Json(value) => value.to_string(),
            RunnerPayload::Text(text) => text.clone(),
        };

        match self.stream {
            RunnerStream::Stdout => content,
            RunnerStream::Stderr => format!("[stderr] {content}"),
        }
    }

    pub fn as_error_detail(&self) -> String {
        match &self.payload {
            RunnerPayload::Json(value) => value.to_string(),
            RunnerPayload::Text(text) => text.clone(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct RunnerExecutionResult {
    pub command: String,
    pub success: bool,
    pub exit_code: Option<i32>,
    pub output: Vec<RunnerOutputLine>,
}

impl RunnerExecutionResult {
    pub fn first_stderr_detail(&self) -> Option<String> {
        self.output
            .iter()
            .find(|line| line.stream == RunnerStream::Stderr)
            .map(RunnerOutputLine::as_error_detail)
    }
}

pub fn parse_line(line: &str) -> Result<Option<Value>, String> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    serde_json::from_str::<Value>(trimmed)
        .map(Some)
        .map_err(|error| format!("invalid JSONL event: {error}"))
}

pub fn parse_output_bytes(bytes: &[u8], stream: RunnerStream) -> Vec<RunnerOutputLine> {
    String::from_utf8_lossy(bytes)
        .lines()
        .filter_map(|line| parse_output_line(line, stream))
        .collect()
}

fn parse_output_line(line: &str, stream: RunnerStream) -> Option<RunnerOutputLine> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    let payload = match parse_line(trimmed) {
        Ok(Some(value)) => RunnerPayload::Json(value),
        Ok(None) => return None,
        Err(_) => RunnerPayload::Text(trimmed.to_string()),
    };

    Some(RunnerOutputLine { stream, payload })
}

#[cfg(test)]
mod tests {
    use super::{
        parse_line, parse_output_bytes, RunnerExecutionResult, RunnerOutputLine, RunnerPayload,
        RunnerStream,
    };

    #[test]
    fn parse_line_accepts_json_and_skips_blank_lines() {
        assert!(parse_line("   ")
            .expect("blank parse should succeed")
            .is_none());
        let parsed = parse_line(r#"{"type":"ready","ok":true}"#)
            .expect("json line should parse")
            .expect("line should contain a value");
        assert_eq!(parsed["type"], "ready");
        assert_eq!(parsed["ok"], true);
    }

    #[test]
    fn parse_line_rejects_invalid_json() {
        let error = parse_line("{not-json").expect_err("invalid json should fail");
        assert!(error.starts_with("invalid JSONL event:"));
    }

    #[test]
    fn parse_output_bytes_handles_json_and_fallback_text() {
        let output = parse_output_bytes(
            b"{\"kind\":\"json\"}\nplain text line\n\n",
            RunnerStream::Stdout,
        );

        assert_eq!(output.len(), 2);
        assert!(matches!(output[0].payload, RunnerPayload::Json(_)));
        assert!(matches!(output[1].payload, RunnerPayload::Text(_)));
        assert_eq!(output[1].as_log_message(), "plain text line");
    }

    #[test]
    fn stderr_lines_include_prefix_and_error_detail() {
        let line = RunnerOutputLine {
            stream: RunnerStream::Stderr,
            payload: RunnerPayload::Text("failure details".to_string()),
        };
        assert_eq!(line.as_log_message(), "[stderr] failure details");
        assert_eq!(line.as_error_detail(), "failure details");
    }

    #[test]
    fn first_stderr_detail_returns_first_stderr_entry() {
        let result = RunnerExecutionResult {
            command: "runner".to_string(),
            success: false,
            exit_code: Some(1),
            output: vec![
                RunnerOutputLine {
                    stream: RunnerStream::Stdout,
                    payload: RunnerPayload::Text("ok".to_string()),
                },
                RunnerOutputLine {
                    stream: RunnerStream::Stderr,
                    payload: RunnerPayload::Text("first error".to_string()),
                },
                RunnerOutputLine {
                    stream: RunnerStream::Stderr,
                    payload: RunnerPayload::Text("second error".to_string()),
                },
            ],
        };

        assert_eq!(result.first_stderr_detail().as_deref(), Some("first error"));
    }
}
