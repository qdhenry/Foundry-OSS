use crate::commands::types::{WatchChangesRequest, WatchHandle};
use crate::runtime::RuntimeSessionStore;
use crate::streaming::file_watcher::FileWatcher;
use serde::Serialize;
use std::fs;
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SandboxFileEntry {
    pub name: String,
    #[serde(rename = "type")]
    pub entry_type: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListFilesResponse {
    pub cwd: String,
    pub entries: Vec<SandboxFileEntry>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadFileResponse {
    pub path: String,
    pub content: String,
}

#[tauri::command]
pub async fn list_files(
    session_id: String,
    path: Option<String>,
) -> Result<ListFilesResponse, String> {
    if session_id.trim().is_empty() {
        return Err("sessionId cannot be empty".to_string());
    }

    let normalized_path = normalize_relative_path(path.as_deref().unwrap_or("."));
    let target_path = resolve_workspace_path(&session_id, &normalized_path)?;
    let metadata = fs::metadata(&target_path)
        .map_err(|error| format!("Failed to access `{normalized_path}`: {error}"))?;
    if !metadata.is_dir() {
        return Err(format!("`{normalized_path}` is not a directory"));
    }

    let mut entries = fs::read_dir(&target_path)
        .map_err(|error| format!("Failed to list `{normalized_path}`: {error}"))?
        .map(|entry_result| {
            let entry =
                entry_result.map_err(|error| format!("Failed to read directory entry: {error}"))?;
            let metadata = entry
                .metadata()
                .map_err(|error| format!("Failed to read file metadata: {error}"))?;
            let entry_type = if metadata.is_dir() {
                "directory"
            } else if metadata.is_file() {
                "file"
            } else {
                "other"
            };
            let size = if metadata.is_file() {
                metadata.len()
            } else {
                0
            };

            Ok::<SandboxFileEntry, String>(SandboxFileEntry {
                name: entry.file_name().to_string_lossy().to_string(),
                entry_type: entry_type.to_string(),
                size,
            })
        })
        .collect::<Result<Vec<_>, _>>()?;

    entries.sort_by(|left, right| left.name.cmp(&right.name));

    Ok(ListFilesResponse {
        cwd: normalized_path,
        entries,
    })
}

#[tauri::command]
pub async fn read_file(session_id: String, path: String) -> Result<ReadFileResponse, String> {
    if session_id.trim().is_empty() {
        return Err("sessionId cannot be empty".to_string());
    }

    let normalized_path = normalize_relative_path(path.as_str());
    if normalized_path == "." {
        return Err("path cannot be empty".to_string());
    }

    let target_path = resolve_workspace_path(&session_id, &normalized_path)?;
    let metadata = fs::metadata(&target_path)
        .map_err(|error| format!("Failed to access `{normalized_path}`: {error}"))?;
    if !metadata.is_file() {
        return Err(format!("`{normalized_path}` is not a file"));
    }

    let content = fs::read_to_string(&target_path)
        .map_err(|error| format!("Failed to read `{normalized_path}`: {error}"))?;

    Ok(ReadFileResponse {
        path: normalized_path,
        content,
    })
}

#[tauri::command]
pub async fn write_file(session_id: String, path: String, content: String) -> Result<(), String> {
    if session_id.trim().is_empty() {
        return Err("sessionId cannot be empty".to_string());
    }

    let normalized_path = normalize_relative_path(path.as_str());
    if normalized_path == "." {
        return Err("path cannot be empty".to_string());
    }

    let target_path = resolve_workspace_path(&session_id, &normalized_path)?;
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create parent directories: {error}"))?;
    }

    fs::write(&target_path, content)
        .map_err(|error| format!("Failed to write `{normalized_path}`: {error}"))?;

    Ok(())
}

#[tauri::command]
pub async fn watch_changes(request: WatchChangesRequest) -> Result<WatchHandle, String> {
    if request.session_id.trim().is_empty() {
        return Err("sessionId cannot be empty".to_string());
    }

    if request.path.trim().is_empty() {
        return Err("path cannot be empty".to_string());
    }

    let watch_id = FileWatcher::default()
        .watch(&request.session_id, &request.path)
        .await?;

    Ok(WatchHandle { watch_id })
}

fn normalize_relative_path(path: &str) -> String {
    let normalized = path
        .replace('\\', "/")
        .split('/')
        .filter(|segment| !segment.trim().is_empty() && *segment != ".")
        .collect::<Vec<_>>()
        .join("/");

    if normalized.is_empty() {
        ".".to_string()
    } else {
        normalized
    }
}

fn resolve_workspace_path(session_id: &str, relative_path: &str) -> Result<PathBuf, String> {
    let path = Path::new(relative_path);
    if path.is_absolute() {
        return Err("absolute paths are not supported".to_string());
    }

    if path
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err("path cannot contain `..`".to_string());
    }

    let workspace_root = resolve_session_root(session_id)?;
    if relative_path == "." {
        Ok(workspace_root)
    } else {
        Ok(workspace_root.join(path))
    }
}

fn resolve_session_root(session_id: &str) -> Result<PathBuf, String> {
    let runtime_store = RuntimeSessionStore::default();
    let worktree_path = runtime_store.get_worktree_path(session_id).map_err(|error| {
        format!(
            "Unable to resolve local workspace for session `{session_id}`: {error}. Relaunch the local implementation session."
        )
    })?;
    if let Some(path) = worktree_path {
        let normalized = path.trim();
        if !normalized.is_empty() {
            return Ok(PathBuf::from(normalized));
        }
    }

    Err(format!(
        "Unable to resolve local workspace for session `{session_id}`: workspace path is empty. Relaunch the local implementation session."
    ))
}

#[cfg(test)]
mod tests {
    use super::{
        list_files, normalize_relative_path, read_file, resolve_workspace_path, write_file,
    };
    use crate::commands::types::{RuntimeKind, SessionConfig};
    use crate::runtime::RuntimeSessionStore;
    use std::env;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_workspace_path(label: &str) -> String {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be valid")
            .as_nanos();
        format!(".tmp-filesystem-tests/{label}-{nanos}")
    }

    fn absolute_path_string(path: &str) -> String {
        env::current_dir()
            .expect("cwd should resolve")
            .join(path)
            .to_string_lossy()
            .to_string()
    }

    #[test]
    fn normalize_relative_path_collapses_slashes_and_current_segments() {
        assert_eq!(
            normalize_relative_path("./src//nested/./file.txt"),
            "src/nested/file.txt"
        );
        assert_eq!(
            normalize_relative_path(r".\src\\nested\file.txt"),
            "src/nested/file.txt"
        );
        assert_eq!(normalize_relative_path("////"), ".");
    }

    #[test]
    fn resolve_workspace_path_blocks_absolute_and_parent_paths() {
        let absolute_error =
            resolve_workspace_path("session-test", &absolute_path_string("Cargo.toml"))
                .expect_err("absolute path should be rejected");
        assert_eq!(absolute_error, "absolute paths are not supported");

        let traversal_error = resolve_workspace_path("session-test", "../outside.txt")
            .expect_err("parent traversal should fail");
        assert_eq!(traversal_error, "path cannot contain `..`");
    }

    #[test]
    fn resolve_workspace_path_joins_relative_path_to_session_root() {
        let _guard = RuntimeSessionStore::acquire_test_lock();
        let runtime_store = RuntimeSessionStore::default();
        runtime_store.reset_for_tests();
        let cwd = env::current_dir().expect("cwd should resolve");
        runtime_store
            .create_session_with_id(
                "session-test",
                &SessionConfig {
                    org_id: "org-test".to_string(),
                    project_id: "project-test".to_string(),
                    repository_path: cwd.to_string_lossy().to_string(),
                    base_branch: "main".to_string(),
                    runtime: RuntimeKind::Local,
                },
            )
            .expect("session should be created");

        let resolved =
            resolve_workspace_path("session-test", "src").expect("relative path should resolve");
        assert_eq!(resolved, cwd.join("src"));

        let dot = resolve_workspace_path("session-test", ".").expect("dot should resolve");
        assert_eq!(dot, cwd);
    }

    #[test]
    fn resolve_workspace_path_rejects_unknown_sessions() {
        let _guard = RuntimeSessionStore::acquire_test_lock();
        let runtime_store = RuntimeSessionStore::default();
        runtime_store.reset_for_tests();

        let error = resolve_workspace_path("missing-session", ".")
            .expect_err("unknown session should be rejected");
        assert!(error.contains("Unable to resolve local workspace for session `missing-session`"));
        assert!(error.contains("Relaunch the local implementation session"));
    }

    #[tokio::test]
    async fn write_read_and_list_files_in_workspace() {
        let _guard = RuntimeSessionStore::acquire_test_lock();
        let runtime_store = RuntimeSessionStore::default();
        runtime_store.reset_for_tests();

        let root = unique_workspace_path("rw");
        let nested = format!("{root}/nested");
        let file_path = format!("{nested}/note.txt");
        let absolute_root =
            PathBuf::from(env::current_dir().expect("cwd should resolve").join(&root));
        if absolute_root.exists() {
            fs::remove_dir_all(&absolute_root).expect("stale test directory should be removable");
        }

        runtime_store
            .create_session_with_id(
                "session-test",
                &SessionConfig {
                    org_id: "org-test".to_string(),
                    project_id: "project-test".to_string(),
                    repository_path: env::current_dir()
                        .expect("cwd should resolve")
                        .to_string_lossy()
                        .to_string(),
                    base_branch: "main".to_string(),
                    runtime: RuntimeKind::Local,
                },
            )
            .expect("session should be created");

        write_file(
            "session-test".to_string(),
            file_path.clone(),
            "hello filesystem".to_string(),
        )
        .await
        .expect("write should succeed");

        let read = read_file("session-test".to_string(), file_path.clone())
            .await
            .expect("read should succeed");
        assert_eq!(read.path, file_path);
        assert_eq!(read.content, "hello filesystem");

        let listed = list_files("session-test".to_string(), Some(nested.clone()))
            .await
            .expect("list should succeed");
        assert_eq!(listed.cwd, nested);
        assert_eq!(listed.entries.len(), 1);
        assert_eq!(listed.entries[0].name, "note.txt");
        assert_eq!(listed.entries[0].entry_type, "file");
        assert_eq!(listed.entries[0].size, "hello filesystem".len() as u64);

        fs::remove_dir_all(&absolute_root).expect("test directory should be removable");
    }

    #[tokio::test]
    async fn read_and_write_reject_traversal_paths() {
        let write_error = write_file(
            "session-test".to_string(),
            "../outside.txt".to_string(),
            "blocked".to_string(),
        )
        .await
        .expect_err("write traversal should be blocked");
        assert_eq!(write_error, "path cannot contain `..`");

        let read_error = read_file("session-test".to_string(), "../outside.txt".to_string())
            .await
            .expect_err("read traversal should be blocked");
        assert_eq!(read_error, "path cannot contain `..`");
    }

    #[tokio::test]
    async fn filesystem_commands_use_session_worktree_root_when_available() {
        let _guard = RuntimeSessionStore::acquire_test_lock();
        let runtime_store = RuntimeSessionStore::default();
        runtime_store.reset_for_tests();
        let session = runtime_store
            .create_session(&SessionConfig {
                org_id: "org-test".to_string(),
                project_id: "project-test".to_string(),
                repository_path: ".".to_string(),
                base_branch: "main".to_string(),
                runtime: RuntimeKind::Local,
            })
            .expect("session should be created");

        let root = unique_workspace_path("session-root");
        let absolute_root =
            PathBuf::from(env::current_dir().expect("cwd should resolve").join(&root));
        if absolute_root.exists() {
            fs::remove_dir_all(&absolute_root).expect("stale test directory should be removable");
        }
        fs::create_dir_all(&absolute_root).expect("test root should be created");
        runtime_store
            .set_worktree_path(
                &session.session_id,
                Some(absolute_root.to_string_lossy().to_string()),
            )
            .expect("worktree path should be set");

        write_file(
            session.session_id.clone(),
            "nested/inside.txt".to_string(),
            "session scoped".to_string(),
        )
        .await
        .expect("write should succeed in session worktree");

        let expected_file = absolute_root.join("nested").join("inside.txt");
        assert!(expected_file.is_file(), "expected file in session root");
        let content = fs::read_to_string(&expected_file).expect("written file should be readable");
        assert_eq!(content, "session scoped");

        let listed = list_files(session.session_id.clone(), Some("nested".to_string()))
            .await
            .expect("list should resolve from session worktree");
        assert_eq!(listed.entries.len(), 1);
        assert_eq!(listed.entries[0].name, "inside.txt");

        fs::remove_dir_all(&absolute_root).expect("test directory should be removable");
    }
}
