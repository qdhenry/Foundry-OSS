use crate::execution::jsonl_parser::{parse_output_bytes, RunnerExecutionResult, RunnerStream};
use std::env;
use std::io::ErrorKind;
use std::process::{Command, Stdio};

const DEFAULT_CLAUDE_BINARY: &str = "claude";
const CLAUDE_BINARY_ENV_KEYS: [&str; 2] = ["FOUNDRY_CLAUDE_CLI_BINARY", "FOUNDRY_CLAUDE_BINARY"];

#[derive(Debug, Default, Clone, Copy)]
pub struct ClaudeCliRunner;

impl ClaudeCliRunner {
    pub fn configured_binary() -> String {
        first_non_empty_env(&CLAUDE_BINARY_ENV_KEYS)
            .unwrap_or_else(|| DEFAULT_CLAUDE_BINARY.to_string())
    }

    pub fn configured_binary_available() -> bool {
        command_is_available(&Self::configured_binary())
    }

    pub async fn spawn(
        &self,
        prompt: &str,
        model: Option<&str>,
        max_turns: Option<u16>,
        working_directory: Option<&str>,
    ) -> Result<RunnerExecutionResult, String> {
        if prompt.trim().is_empty() {
            return Err("Claude CLI runner cannot start: prompt cannot be empty".to_string());
        }

        let binary = Self::configured_binary();
        let args = build_args(prompt, model, max_turns);
        let command_preview = render_command(&binary, &args);
        let working_directory = working_directory
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string);

        tokio::task::spawn_blocking(move || {
            run_command(binary, args, command_preview, working_directory)
        })
        .await
        .map_err(|error| format!("Claude CLI runner task failed unexpectedly: {error}"))?
    }
}

fn build_args(prompt: &str, model: Option<&str>, max_turns: Option<u16>) -> Vec<String> {
    let mut args = vec![
        "--print".to_string(),
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--verbose".to_string(),
    ];

    if let Some(trimmed) = model.map(str::trim).filter(|value| !value.is_empty()) {
        args.push("--model".to_string());
        args.push(trimmed.to_string());
    }

    if let Some(turns) = max_turns.filter(|value| *value > 0) {
        args.push("--max-turns".to_string());
        args.push(turns.to_string());
    }

    args.push("-p".to_string());
    args.push(prompt.trim().to_string());

    args
}

fn run_command(
    binary: String,
    args: Vec<String>,
    command_preview: String,
    working_directory: Option<String>,
) -> Result<RunnerExecutionResult, String> {
    let mut command = Command::new(&binary);
    if let Some(working_directory) = working_directory.as_deref() {
        command.current_dir(working_directory);
    }

    let output = command
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|error| match error.kind() {
            ErrorKind::NotFound => format!(
                "Claude CLI binary '{binary}' was not found. Install Claude Code CLI or set {}.",
                CLAUDE_BINARY_ENV_KEYS[0]
            ),
            _ => format!("Failed to start Claude CLI command `{command_preview}`: {error}"),
        })?;

    let mut parsed_output = parse_output_bytes(&output.stdout, RunnerStream::Stdout);
    parsed_output.extend(parse_output_bytes(&output.stderr, RunnerStream::Stderr));

    Ok(RunnerExecutionResult {
        command: command_preview,
        success: output.status.success(),
        exit_code: output.status.code(),
        output: parsed_output,
    })
}

fn command_is_available(binary: &str) -> bool {
    Command::new(binary)
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok()
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

fn render_command(binary: &str, args: &[String]) -> String {
    let mut parts = Vec::with_capacity(args.len() + 1);
    parts.push(binary.to_string());
    parts.extend(args.iter().map(|arg| escape_argument(arg)));
    parts.join(" ")
}

fn escape_argument(argument: &str) -> String {
    if argument.chars().any(|character| character.is_whitespace()) {
        format!("{argument:?}")
    } else {
        argument.to_string()
    }
}
