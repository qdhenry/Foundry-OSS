use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

#[derive(Debug, Default, Clone, Copy)]
pub struct FileWatcher;

static WATCH_COUNTER: AtomicU64 = AtomicU64::new(1);

impl FileWatcher {
    pub async fn watch(&self, session_id: &str, path: &str) -> Result<String, String> {
        let session_id = session_id.trim();
        if session_id.is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }

        let canonical_path = canonical_watch_path(path)?;
        let sequence = WATCH_COUNTER.fetch_add(1, Ordering::Relaxed);
        Ok(stable_watch_id(session_id, &canonical_path, sequence))
    }
}

fn canonical_watch_path(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("path cannot be empty".to_string());
    }

    let raw_path = Path::new(trimmed);
    let resolved = if raw_path.is_absolute() {
        raw_path.to_path_buf()
    } else {
        let workspace_root = env::current_dir()
            .map_err(|error| format!("failed to resolve workspace root: {error}"))?;
        workspace_root.join(raw_path)
    };

    let canonical = fs::canonicalize(&resolved).map_err(|error| {
        format!(
            "path `{}` is not accessible from workspace: {error}",
            resolved.display()
        )
    })?;
    let metadata = fs::metadata(&canonical).map_err(|error| {
        format!(
            "failed to read metadata for `{}`: {error}",
            canonical.display()
        )
    })?;
    if !metadata.is_file() && !metadata.is_dir() {
        return Err(format!(
            "path `{}` must be a file or directory",
            canonical.display()
        ));
    }

    Ok(canonical)
}

fn stable_watch_id(session_id: &str, canonical_path: &Path, sequence: u64) -> String {
    let session_hash = fnv1a64(session_id.as_bytes());
    let path_hash = fnv1a64(canonical_path.to_string_lossy().as_bytes());
    format!("watch-{session_hash:016x}-{path_hash:016x}-{sequence:08x}")
}

fn fnv1a64(bytes: &[u8]) -> u64 {
    const OFFSET_BASIS: u64 = 0xcbf29ce484222325;
    const PRIME: u64 = 0x100000001b3;

    let mut hash = OFFSET_BASIS;
    for byte in bytes {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(PRIME);
    }
    hash
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_workspace_path(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        env::current_dir()
            .expect("workspace root should resolve")
            .join(format!(
                ".tmp-file-watcher-{label}-{}-{nonce}",
                std::process::id()
            ))
    }

    #[test]
    fn canonical_watch_path_rejects_empty_input() {
        let error = canonical_watch_path("  ").expect_err("empty path should fail");
        assert_eq!(error, "path cannot be empty");
    }

    #[test]
    fn canonical_watch_path_resolves_relative_paths() {
        let root = unique_workspace_path("relative");
        fs::create_dir_all(&root).expect("temporary directory should be created");
        let file_path = root.join("stream.log");
        fs::write(&file_path, "hello").expect("temporary file should be created");

        let workspace = env::current_dir().expect("workspace root should resolve");
        let relative = file_path
            .strip_prefix(&workspace)
            .expect("temporary file should be under workspace")
            .to_string_lossy()
            .to_string();

        let canonical = canonical_watch_path(&relative).expect("relative file should resolve");
        assert_eq!(
            canonical,
            file_path
                .canonicalize()
                .expect("canonical file path should resolve")
        );

        fs::remove_dir_all(root).expect("temporary directory should be removed");
    }

    #[test]
    fn canonical_watch_path_rejects_nonexistent_paths() {
        let path = unique_workspace_path("missing");
        let error = canonical_watch_path(path.to_string_lossy().as_ref())
            .expect_err("missing path should fail");
        assert!(error.contains("is not accessible from workspace"));
    }

    #[test]
    fn stable_watch_id_is_deterministic_for_same_inputs() {
        let path = Path::new("/tmp/foundry-watch-path");
        let id1 = stable_watch_id("session-a", path, 42);
        let id2 = stable_watch_id("session-a", path, 42);
        let id3 = stable_watch_id("session-a", path, 43);

        assert_eq!(id1, id2);
        assert_ne!(id1, id3);
    }

    #[test]
    fn fnv1a64_matches_known_test_vectors() {
        assert_eq!(fnv1a64(b""), 0xcbf29ce484222325);
        assert_eq!(fnv1a64(b"a"), 0xaf63dc4c8601ec8c);
        assert_eq!(fnv1a64(b"hello"), 0xa430d84680aabd0b);
    }

    #[tokio::test]
    async fn watch_rejects_empty_session_id() {
        let watcher = FileWatcher;
        let error = watcher
            .watch("   ", ".")
            .await
            .expect_err("empty session ID should fail");
        assert_eq!(error, "sessionId cannot be empty");
    }

    #[tokio::test]
    async fn watch_returns_formatted_id_for_existing_path() {
        let root = unique_workspace_path("watch");
        fs::create_dir_all(&root).expect("temporary directory should be created");

        let watcher = FileWatcher;
        let id1 = watcher
            .watch("session-1", root.to_string_lossy().as_ref())
            .await
            .expect("watch should succeed");
        let id2 = watcher
            .watch("session-1", root.to_string_lossy().as_ref())
            .await
            .expect("watch should succeed");

        let parts1 = id1.split('-').collect::<Vec<_>>();
        let parts2 = id2.split('-').collect::<Vec<_>>();
        assert_eq!(parts1.len(), 4);
        assert_eq!(parts1[0], "watch");
        assert_eq!(parts1[1].len(), 16);
        assert_eq!(parts1[2].len(), 16);
        assert_eq!(parts1[3].len(), 8);
        assert_eq!(parts2[3].len(), 8);
        assert_eq!(parts1[1], parts2[1]);
        assert_eq!(parts1[2], parts2[2]);
        assert_ne!(parts1[3], parts2[3]);
        assert!(u32::from_str_radix(parts1[3], 16).is_ok());
        assert!(u32::from_str_radix(parts2[3], 16).is_ok());

        fs::remove_dir_all(root).expect("temporary directory should be removed");
    }
}
