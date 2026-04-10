use crate::commands::types::{CreateWorktreeRequest, WorktreeInfo};
use std::env;
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};
use std::process::{Command, Output};

#[derive(Debug, Default, Clone, Copy)]
pub struct WorktreeManager;

impl WorktreeManager {
    pub async fn create(&self, request: &CreateWorktreeRequest) -> Result<WorktreeInfo, String> {
        if request.session_id.trim().is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }

        if request.branch.trim().is_empty() {
            return Err("branch cannot be empty".to_string());
        }

        let repo_root = resolve_repo_root()?;
        let target_path = resolve_target_path(&repo_root, request)?;
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!("Failed to create worktree parent directories: {error}")
            })?;
        }

        let target_display = target_path.to_string_lossy().to_string();
        let add_result = run_git(
            &repo_root,
            [
                "worktree",
                "add",
                target_display.as_str(),
                request.branch.trim(),
            ],
        )?;

        if !add_result.success {
            let create_branch_result = run_git(
                &repo_root,
                [
                    "worktree",
                    "add",
                    "-b",
                    request.branch.trim(),
                    target_display.as_str(),
                ],
            )?;

            if !create_branch_result.success {
                return Err(format!(
                    "Failed to create worktree.\n{}\n\n{}",
                    render_command_result("git worktree add <path> <branch>", &add_result),
                    render_command_result(
                        "git worktree add -b <branch> <path>",
                        &create_branch_result
                    ),
                ));
            }
        }

        let absolute_path = canonicalize_lossy(&target_path);

        Ok(WorktreeInfo {
            worktree_id: format!("wt-{}", request.session_id),
            session_id: Some(request.session_id.clone()),
            path: absolute_path,
            branch: request.branch.clone(),
        })
    }

    pub async fn cleanup(&self, id: &str) -> Result<(), String> {
        let normalized_id = id.trim();
        if normalized_id.is_empty() {
            return Err("id cannot be empty".to_string());
        }

        let repo_root = resolve_repo_root()?;
        let worktree_entries = list_worktrees_internal(&repo_root)?;
        let target = resolve_cleanup_target(normalized_id, &repo_root, &worktree_entries)?;

        let repo_root_canonical =
            fs::canonicalize(&repo_root).unwrap_or_else(|_| repo_root.clone());
        let target_canonical = fs::canonicalize(&target).unwrap_or_else(|_| target.clone());
        if target_canonical == repo_root_canonical {
            return Err("Refusing to remove the repository's primary working tree".to_string());
        }

        let target_display = target.to_string_lossy().to_string();
        let remove_result = run_git(
            &repo_root,
            ["worktree", "remove", "--force", target_display.as_str()],
        )?;
        if !remove_result.success {
            return Err(format!(
                "Failed to remove worktree.\n{}",
                render_command_result("git worktree remove --force <path>", &remove_result)
            ));
        }

        Ok(())
    }

    pub async fn list(&self) -> Result<Vec<WorktreeInfo>, String> {
        let repo_root = resolve_repo_root()?;
        list_worktrees_internal(&repo_root)
    }
}

#[derive(Debug)]
struct CommandResult {
    success: bool,
    exit_code: Option<i32>,
    stdout: String,
    stderr: String,
}

fn resolve_repo_root() -> Result<PathBuf, String> {
    let cwd = env::current_dir()
        .map_err(|error| format!("Failed to resolve current directory: {error}"))?;
    let output = Command::new("git")
        .current_dir(&cwd)
        .args(["rev-parse", "--show-toplevel"])
        .output()
        .map_err(|error| command_spawn_error("git", error))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Failed to resolve git repository root from current workspace".to_string()
        } else {
            format!("Failed to resolve git repository root: {stderr}")
        });
    }

    let root = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if root.is_empty() {
        return Err("Git returned an empty repository root".to_string());
    }

    Ok(PathBuf::from(root))
}

fn resolve_target_path(
    repo_root: &Path,
    request: &CreateWorktreeRequest,
) -> Result<PathBuf, String> {
    if let Some(target_dir) = request.target_dir.as_deref() {
        let trimmed = target_dir.trim();
        if trimmed.is_empty() {
            return Err("targetDir cannot be empty when provided".to_string());
        }

        let candidate = PathBuf::from(trimmed);
        if candidate.is_absolute() {
            Ok(candidate)
        } else {
            validate_relative_path(&candidate)?;
            Ok(repo_root.join(candidate))
        }
    } else {
        Ok(default_worktree_path(repo_root, &request.session_id))
    }
}

fn default_worktree_path(repo_root: &Path, session_id: &str) -> PathBuf {
    repo_root
        .join(".foundry")
        .join("worktrees")
        .join(sanitize_segment(session_id))
}

fn validate_relative_path(path: &Path) -> Result<(), String> {
    if path
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err("targetDir cannot contain `..`".to_string());
    }
    Ok(())
}

fn run_git<'a, I>(repo_root: &Path, args: I) -> Result<CommandResult, String>
where
    I: IntoIterator<Item = &'a str>,
{
    let output = Command::new("git")
        .current_dir(repo_root)
        .args(args)
        .output()
        .map_err(|error| command_spawn_error("git", error))?;

    Ok(command_result(output))
}

fn list_worktrees_internal(repo_root: &Path) -> Result<Vec<WorktreeInfo>, String> {
    let output = run_git(repo_root, ["worktree", "list", "--porcelain"])?;
    if !output.success {
        return Err(format!(
            "Failed to list worktrees.\n{}",
            render_command_result("git worktree list --porcelain", &output)
        ));
    }

    let mut worktrees = Vec::new();
    let foundry_root = repo_root.join(".foundry").join("worktrees");
    let mut current_path: Option<PathBuf> = None;
    let mut current_branch = String::from("detached");

    for line in output.stdout.lines() {
        if line.trim().is_empty() {
            if let Some(path) = current_path.take() {
                worktrees.push(build_worktree_info(path, &current_branch, &foundry_root));
                current_branch = String::from("detached");
            }
            continue;
        }

        if let Some(raw_path) = line.strip_prefix("worktree ") {
            current_path = Some(PathBuf::from(raw_path.trim()));
        } else if let Some(raw_branch) = line.strip_prefix("branch ") {
            current_branch = parse_branch(raw_branch);
        }
    }

    if let Some(path) = current_path.take() {
        worktrees.push(build_worktree_info(path, &current_branch, &foundry_root));
    }

    Ok(worktrees)
}

fn build_worktree_info(path: PathBuf, branch: &str, foundry_root: &Path) -> WorktreeInfo {
    let session_id = infer_session_id(&path, foundry_root);
    let worktree_id = session_id
        .as_ref()
        .map(|value| format!("wt-{value}"))
        .unwrap_or_else(|| {
            let fallback = path
                .file_name()
                .and_then(|value| value.to_str())
                .map(sanitize_segment)
                .unwrap_or_else(|| "unknown".to_string());
            format!("wt-{fallback}")
        });

    WorktreeInfo {
        worktree_id,
        session_id,
        path: path.to_string_lossy().to_string(),
        branch: branch.to_string(),
    }
}

fn resolve_cleanup_target(
    id: &str,
    repo_root: &Path,
    known_worktrees: &[WorktreeInfo],
) -> Result<PathBuf, String> {
    let id_path = Path::new(id);

    if id_path.is_absolute() || id.contains('/') || id.contains('\\') {
        let candidate = if id_path.is_absolute() {
            PathBuf::from(id)
        } else {
            repo_root.join(id_path)
        };
        return ensure_known_worktree(candidate, known_worktrees);
    }

    if let Some(session_id) = id.strip_prefix("wt-") {
        let candidate = default_worktree_path(repo_root, session_id);
        return ensure_known_worktree(candidate, known_worktrees);
    }

    let by_id = known_worktrees
        .iter()
        .find(|entry| entry.worktree_id == id || entry.session_id.as_deref() == Some(id))
        .map(|entry| PathBuf::from(entry.path.clone()));
    if let Some(path) = by_id {
        return Ok(path);
    }

    let candidate = default_worktree_path(repo_root, id);
    ensure_known_worktree(candidate, known_worktrees)
}

fn ensure_known_worktree(
    candidate: PathBuf,
    known_worktrees: &[WorktreeInfo],
) -> Result<PathBuf, String> {
    let candidate_text = candidate.to_string_lossy().to_string();
    let is_known = known_worktrees.iter().any(|entry| {
        if entry.path == candidate_text {
            return true;
        }

        let entry_canonical = fs::canonicalize(&entry.path).ok();
        let candidate_canonical = fs::canonicalize(&candidate).ok();
        entry_canonical.is_some() && entry_canonical == candidate_canonical
    });

    if is_known {
        Ok(candidate)
    } else {
        Err(format!(
            "Worktree `{}` is not registered in `git worktree list`",
            candidate.display()
        ))
    }
}

fn infer_session_id(path: &Path, foundry_root: &Path) -> Option<String> {
    let relative = path.strip_prefix(foundry_root).ok()?;
    let first = relative.components().next()?;
    match first {
        Component::Normal(value) => value.to_str().map(|text| text.to_string()),
        _ => None,
    }
}

fn parse_branch(raw_branch: &str) -> String {
    let trimmed = raw_branch.trim();
    if let Some(stripped) = trimmed.strip_prefix("refs/heads/") {
        if !stripped.trim().is_empty() {
            return stripped.to_string();
        }
    }

    if trimmed.is_empty() {
        "detached".to_string()
    } else {
        trimmed.to_string()
    }
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

fn canonicalize_lossy(path: &Path) -> String {
    fs::canonicalize(path)
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
        .to_string()
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
