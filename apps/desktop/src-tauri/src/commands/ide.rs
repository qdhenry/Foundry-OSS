use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;

fn validate_path(path: &str) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("path cannot be empty".to_string());
    }

    if !Path::new(path).exists() {
        return Err(format!("path does not exist: {path}"));
    }

    Ok(())
}

#[tauri::command]
pub async fn open_in_vscode(path: String) -> Result<(), String> {
    validate_path(&path)?;
    let launch_path = resolve_launch_path(&path)?;
    launch_editor("code", &launch_path)
}

#[tauri::command]
pub async fn open_in_cursor(path: String) -> Result<(), String> {
    validate_path(&path)?;
    let launch_path = resolve_launch_path(&path)?;
    launch_editor("cursor", &launch_path)
}

fn resolve_launch_path(path: &str) -> Result<PathBuf, String> {
    let raw_path = PathBuf::from(path.trim());
    raw_path
        .canonicalize()
        .map_err(|error| format!("Failed to resolve path `{path}`: {error}"))
}

fn launch_editor(binary: &str, path: &Path) -> Result<(), String> {
    Command::new(binary)
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|error| {
            if error.kind() == io::ErrorKind::NotFound {
                format!("Editor binary `{binary}` was not found on PATH")
            } else {
                format!(
                    "Failed to launch `{binary}` for `{}`: {error}",
                    path.display()
                )
            }
        })
}
