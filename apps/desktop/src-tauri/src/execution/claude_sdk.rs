use crate::execution::jsonl_parser::{parse_output_bytes, RunnerExecutionResult, RunnerStream};
use std::env;
use std::io::ErrorKind;
use std::path::PathBuf;
use std::process::{Command, Stdio};

const DEFAULT_NODE_BINARY: &str = "node";
const NODE_BINARY_ENV_KEYS: [&str; 2] = ["FOUNDRY_AGENT_SDK_NODE_BINARY", "FOUNDRY_NODE_BINARY"];
const RUNNER_PATH_ENV: &str = "FOUNDRY_AGENT_SDK_RUNNER_PATH";
const RUNNER_RELATIVE_PATH: &str = "resources/agent-sdk-runner.mjs";

#[derive(Debug, Default, Clone, Copy)]
pub struct ClaudeSdkRunner;

impl ClaudeSdkRunner {
    pub fn runtime_accessibility_check() -> Result<String, String> {
        let node_binary = first_non_empty_env(&NODE_BINARY_ENV_KEYS)
            .unwrap_or_else(|| DEFAULT_NODE_BINARY.to_string());
        let node_check = Command::new(&node_binary)
            .arg("--version")
            .output()
            .map_err(|error| format!("Failed to run `{node_binary} --version`: {error}"))?;
        let node_result = command_result(node_check);
        if !node_result.success {
            return Err(format!(
                "Node.js runtime check failed.\n{}",
                render_command_result(&format!("{node_binary} --version"), &node_result)
            ));
        }

        let node_version = first_non_empty_line(&node_result.stdout)
            .or_else(|| first_non_empty_line(&node_result.stderr))
            .unwrap_or_else(|| "version output unavailable".to_string());
        let runner_path = resolve_runner_path()?;

        Ok(format!(
            "node `{}` ({node_version}), runner `{}`",
            node_binary,
            runner_path.display()
        ))
    }

    pub async fn spawn(
        &self,
        prompt: &str,
        model: Option<&str>,
        max_turns: Option<u16>,
        working_directory: Option<&str>,
    ) -> Result<RunnerExecutionResult, String> {
        if prompt.trim().is_empty() {
            return Err("Claude SDK runner cannot start: prompt cannot be empty".to_string());
        }

        let node_binary = first_non_empty_env(&NODE_BINARY_ENV_KEYS)
            .unwrap_or_else(|| DEFAULT_NODE_BINARY.to_string());
        let runner_path = resolve_runner_path()?;
        let args = build_args(prompt, model, max_turns, &runner_path);
        let command_preview = render_command(&node_binary, &args);
        let working_directory = working_directory
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string);

        tokio::task::spawn_blocking(move || {
            run_command(node_binary, args, command_preview, working_directory)
        })
        .await
        .map_err(|error| format!("Claude SDK runner task failed unexpectedly: {error}"))?
    }
}

fn build_args(
    prompt: &str,
    model: Option<&str>,
    max_turns: Option<u16>,
    runner_path: &PathBuf,
) -> Vec<String> {
    let mut args = vec![
        runner_path.to_string_lossy().to_string(),
        "--prompt".to_string(),
        prompt.trim().to_string(),
    ];

    if let Some(trimmed) = model.map(str::trim).filter(|value| !value.is_empty()) {
        args.push("--model".to_string());
        args.push(trimmed.to_string());
    }

    if let Some(turns) = max_turns.filter(|value| *value > 0) {
        args.push("--max-turns".to_string());
        args.push(turns.to_string());
    }

    args
}

fn run_command(
    node_binary: String,
    args: Vec<String>,
    command_preview: String,
    working_directory: Option<String>,
) -> Result<RunnerExecutionResult, String> {
    let mut command = Command::new(&node_binary);
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
                "Node.js binary '{node_binary}' was not found. Install Node.js or set {}.",
                NODE_BINARY_ENV_KEYS[0]
            ),
            _ => format!("Failed to start Claude SDK command `{command_preview}`: {error}"),
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

#[derive(Debug)]
struct CommandResult {
    success: bool,
    exit_code: Option<i32>,
    stdout: String,
    stderr: String,
}

fn command_result(output: std::process::Output) -> CommandResult {
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

fn resolve_runner_path() -> Result<PathBuf, String> {
    if let Some(path) = first_non_empty_env(&[RUNNER_PATH_ENV]) {
        let candidate = PathBuf::from(&path);
        if candidate.is_file() {
            return Ok(candidate);
        }

        return Err(format!(
            "Agent SDK runner script configured via {RUNNER_PATH_ENV} was not found at {path}."
        ));
    }

    let mut candidates = Vec::new();
    push_candidate(
        &mut candidates,
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(RUNNER_RELATIVE_PATH),
    );

    if let Ok(current_dir) = env::current_dir() {
        push_candidate(&mut candidates, current_dir.join(RUNNER_RELATIVE_PATH));
    }

    if let Ok(current_exe) = env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            push_candidate(&mut candidates, parent.join(RUNNER_RELATIVE_PATH));
            push_candidate(
                &mut candidates,
                parent.join("resources").join("agent-sdk-runner.mjs"),
            );

            if let Some(contents_dir) = parent.parent() {
                push_candidate(
                    &mut candidates,
                    contents_dir.join("Resources").join("agent-sdk-runner.mjs"),
                );
            }
        }
    }

    if let Some(path) = candidates
        .iter()
        .find(|candidate| candidate.is_file())
        .cloned()
    {
        return Ok(path);
    }

    let attempted = candidates
        .iter()
        .map(|candidate| candidate.display().to_string())
        .collect::<Vec<_>>()
        .join(", ");

    Err(format!(
        "Unable to locate agent SDK runner script. Checked: {attempted}. Set {RUNNER_PATH_ENV} to an absolute script path."
    ))
}

fn push_candidate(candidates: &mut Vec<PathBuf>, candidate: PathBuf) {
    if !candidates.iter().any(|existing| existing == &candidate) {
        candidates.push(candidate);
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

fn first_non_empty_line(value: &str) -> Option<String> {
    value
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(str::to_string)
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
