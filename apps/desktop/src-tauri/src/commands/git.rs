use crate::commands::types::{
    CheckoutBranchRequest, CommitPushRequest, DraftPrRequest, GitOperationResult,
};
use std::env;
use std::io;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

#[tauri::command]
pub async fn commit_push(request: CommitPushRequest) -> Result<GitOperationResult, String> {
    if request.session_id.trim().is_empty() {
        return Err("sessionId cannot be empty".to_string());
    }

    if request.message.trim().is_empty() {
        return Err("message cannot be empty".to_string());
    }

    let repo_path = resolve_git_path(&request.session_id)?;
    let add_result = run_git(&repo_path, ["add", "-A"])?;
    if !add_result.success {
        return Ok(GitOperationResult {
            operation: "commit_push".to_string(),
            success: false,
            details: render_step("git add -A", &add_result),
        });
    }

    let commit_result = run_git(&repo_path, ["commit", "-m", request.message.as_str()])?;
    if !commit_result.success {
        return Ok(GitOperationResult {
            operation: "commit_push".to_string(),
            success: false,
            details: format!(
                "{}\n\n{}",
                render_step("git add -A", &add_result),
                render_step("git commit -m <message>", &commit_result)
            ),
        });
    }

    let remote = request
        .remote
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("origin");
    let push_result = run_git(&repo_path, ["push", remote, "HEAD"])?;

    Ok(GitOperationResult {
        operation: "commit_push".to_string(),
        success: add_result.success && commit_result.success && push_result.success,
        details: format!(
            "{}\n\n{}\n\n{}",
            render_step("git add -A", &add_result),
            render_step("git commit -m <message>", &commit_result),
            render_step(&format!("git push {remote} HEAD"), &push_result)
        ),
    })
}

#[tauri::command]
pub async fn create_draft_pr(request: DraftPrRequest) -> Result<GitOperationResult, String> {
    if request.session_id.trim().is_empty() {
        return Err("sessionId cannot be empty".to_string());
    }

    if request.title.trim().is_empty() {
        return Err("title cannot be empty".to_string());
    }

    if request.base_branch.trim().is_empty() {
        return Err("baseBranch cannot be empty".to_string());
    }

    let repo_path = resolve_git_path(&request.session_id)?;
    ensure_github_integration(&repo_path)?;

    let mut args = vec![
        "pr".to_string(),
        "create".to_string(),
        "--draft".to_string(),
        "--title".to_string(),
        request.title.clone(),
        "--base".to_string(),
        request.base_branch.clone(),
    ];
    if let Some(body) = request.body.as_deref() {
        args.push("--body".to_string());
        args.push(body.to_string());
    }

    let pr_result = run_gh(&repo_path, &args)?;
    Ok(GitOperationResult {
        operation: "create_draft_pr".to_string(),
        success: pr_result.success,
        details: render_step("gh pr create --draft", &pr_result),
    })
}

#[tauri::command]
pub async fn checkout_branch(request: CheckoutBranchRequest) -> Result<GitOperationResult, String> {
    if request.session_id.trim().is_empty() {
        return Err("sessionId cannot be empty".to_string());
    }

    if request.branch.trim().is_empty() {
        return Err("branch cannot be empty".to_string());
    }

    let repo_path = resolve_git_path(&request.session_id)?;
    let checkout_result = run_git(&repo_path, ["checkout", request.branch.as_str()])?;

    Ok(GitOperationResult {
        operation: "checkout_branch".to_string(),
        success: checkout_result.success,
        details: render_step(
            &format!("git checkout {}", request.branch.trim()),
            &checkout_result,
        ),
    })
}

#[derive(Debug)]
struct CommandResult {
    success: bool,
    exit_code: Option<i32>,
    stdout: String,
    stderr: String,
}

fn resolve_git_path(session_id: &str) -> Result<PathBuf, String> {
    let normalized_session = session_id.trim();
    if normalized_session.is_empty() {
        return Err("sessionId cannot be empty".to_string());
    }

    let workspace_root =
        env::current_dir().map_err(|error| format!("Failed to resolve workspace root: {error}"))?;
    let worktree_candidate = workspace_root
        .join(".foundry")
        .join("worktrees")
        .join(sanitize_segment(normalized_session));

    if worktree_candidate.exists() && is_git_repo(&worktree_candidate) {
        return Ok(worktree_candidate);
    }

    if is_git_repo(&workspace_root) {
        return Ok(workspace_root);
    }

    Err(format!(
        "Unable to resolve git repository path for session `{normalized_session}`. Expected worktree at `{}` or a git repo in current workspace.",
        worktree_candidate.display()
    ))
}

fn is_git_repo(path: &Path) -> bool {
    Command::new("git")
        .arg("-C")
        .arg(path)
        .args(["rev-parse", "--is-inside-work-tree"])
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn run_git<'a, I>(cwd: &Path, args: I) -> Result<CommandResult, String>
where
    I: IntoIterator<Item = &'a str>,
{
    let output = Command::new("git")
        .current_dir(cwd)
        .args(args)
        .output()
        .map_err(|error| command_spawn_error("git", error))?;

    Ok(command_result(output))
}

fn run_gh(cwd: &Path, args: &[String]) -> Result<CommandResult, String> {
    let output = Command::new("gh")
        .current_dir(cwd)
        .args(args)
        .output()
        .map_err(|error| command_spawn_error("gh", error))?;

    Ok(command_result(output))
}

fn ensure_github_integration(repo_path: &Path) -> Result<(), String> {
    let version_output = Command::new("gh").arg("--version").output();
    match version_output {
        Ok(output) if output.status.success() => {}
        Ok(_) | Err(_) => {
            return Err(
                "GitHub integration is not configured. Install GitHub CLI (`gh`) and run `gh auth login`."
                    .to_string(),
            )
        }
    }

    let auth_output = Command::new("gh")
        .current_dir(repo_path)
        .args(["auth", "status"])
        .output()
        .map_err(|error| command_spawn_error("gh", error))?;
    if !auth_output.status.success() {
        return Err(
            "GitHub integration is not configured for this machine. Run `gh auth login` first."
                .to_string(),
        );
    }

    Ok(())
}

fn command_result(output: Output) -> CommandResult {
    CommandResult {
        success: output.status.success(),
        exit_code: output.status.code(),
        stdout: String::from_utf8_lossy(&output.stdout).trim().to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
    }
}

fn command_spawn_error(program: &str, error: io::Error) -> String {
    if error.kind() == io::ErrorKind::NotFound {
        format!("Command `{program}` is not available on PATH")
    } else {
        format!("Failed to run `{program}`: {error}")
    }
}

fn render_step(step: &str, result: &CommandResult) -> String {
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
