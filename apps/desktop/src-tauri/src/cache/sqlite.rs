use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone)]
pub struct SqliteCache {
    pub path: String,
}

impl SqliteCache {
    pub fn new(path: impl Into<String>) -> Self {
        Self { path: path.into() }
    }

    pub async fn initialize(&self) -> Result<(), String> {
        if self.path.trim().is_empty() {
            return Err("cache path cannot be empty".to_string());
        }

        let cache_path = resolve_cache_path(&self.path)?;
        if let Some(parent) = cache_path.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!(
                    "Failed to create cache directory `{}`: {error}",
                    parent.display()
                )
            })?;
        }

        if cache_path.exists() {
            let metadata = fs::metadata(&cache_path).map_err(|error| {
                format!(
                    "Failed to inspect cache file `{}`: {error}",
                    cache_path.display()
                )
            })?;
            if !metadata.is_file() {
                return Err(format!(
                    "Cache path `{}` is not a file",
                    cache_path.display()
                ));
            }
        } else {
            OpenOptions::new()
                .create(true)
                .write(true)
                .open(&cache_path)
                .map_err(|error| {
                    format!(
                        "Failed to create cache file `{}`: {error}",
                        cache_path.display()
                    )
                })?;
        }

        persist_marker(&cache_path)?;

        Ok(())
    }
}

fn resolve_cache_path(path: &str) -> Result<PathBuf, String> {
    let raw = PathBuf::from(path.trim());
    if raw.is_absolute() {
        Ok(raw)
    } else {
        let cwd = std::env::current_dir()
            .map_err(|error| format!("Failed to resolve current directory: {error}"))?;
        Ok(cwd.join(raw))
    }
}

fn marker_path(cache_path: &Path) -> PathBuf {
    PathBuf::from(format!("{}.meta.json", cache_path.to_string_lossy()))
}

fn persist_marker(cache_path: &Path) -> Result<(), String> {
    let marker_file = marker_path(cache_path);
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let marker = serde_json::json!({
        "marker": "foundry_sqlite_cache_initialized",
        "version": 1,
        "cachePath": cache_path.to_string_lossy(),
        "updatedAtMs": now
    });

    let serialized = serde_json::to_string_pretty(&marker)
        .map_err(|error| format!("Failed to serialize marker: {error}"))?;
    let mut file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&marker_file)
        .map_err(|error| {
            format!(
                "Failed to write cache marker `{}`: {error}",
                marker_file.display()
            )
        })?;
    file.write_all(serialized.as_bytes()).map_err(|error| {
        format!(
            "Failed to write cache marker `{}`: {error}",
            marker_file.display()
        )
    })?;
    file.sync_all().map_err(|error| {
        format!(
            "Failed to flush cache marker `{}`: {error}",
            marker_file.display()
        )
    })?;

    Ok(())
}
