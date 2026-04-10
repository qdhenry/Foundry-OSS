use std::collections::BTreeMap;
use std::env;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SandboxConfig {
    pub worktree_path: String,
    pub env: BTreeMap<String, String>,
}

#[derive(Debug, Default, Clone, Copy)]
pub struct SandboxEnvironment;

impl SandboxEnvironment {
    pub fn apply(&self, config: &SandboxConfig) -> Result<(), String> {
        let _ = self.sanitized_env(config)?;
        Ok(())
    }

    pub fn sanitized_env(
        &self,
        config: &SandboxConfig,
    ) -> Result<BTreeMap<String, String>, String> {
        let worktree = canonical_worktree_path(&config.worktree_path)?;
        let mut env_map = BTreeMap::new();

        for key in passthrough_env_keys() {
            if let Ok(value) = env::var(key) {
                if !value.trim().is_empty() {
                    env_map.insert((*key).to_string(), value);
                }
            }
        }

        env_map.insert("FOUNDRY_WORKTREE_PATH".to_string(), worktree.clone());
        env_map.insert("PWD".to_string(), worktree);

        for (raw_key, raw_value) in &config.env {
            let key = sanitize_env_key(raw_key)?;
            let value = sanitize_env_value(raw_value);
            env_map.insert(key, value);
        }

        Ok(env_map)
    }
}

fn canonical_worktree_path(worktree_path: &str) -> Result<String, String> {
    let trimmed = worktree_path.trim();
    if trimmed.is_empty() {
        return Err("worktreePath cannot be empty".to_string());
    }

    let path = PathBuf::from(trimmed);
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("worktreePath `{trimmed}` is not accessible: {error}"))?;
    let metadata = canonical
        .metadata()
        .map_err(|error| format!("failed to read worktree metadata: {error}"))?;
    if !metadata.is_dir() {
        return Err(format!(
            "worktreePath `{}` must be a directory",
            canonical.display()
        ));
    }

    Ok(canonical.to_string_lossy().to_string())
}

fn sanitize_env_key(raw_key: &str) -> Result<String, String> {
    let trimmed = raw_key.trim();
    if trimmed.is_empty() {
        return Err("environment variable key cannot be empty".to_string());
    }

    let mut chars = trimmed.chars();
    let first = chars
        .next()
        .ok_or_else(|| "environment variable key cannot be empty".to_string())?;
    if !(first.is_ascii_alphabetic() || first == '_') {
        return Err(format!(
            "environment variable key `{trimmed}` must start with a letter or underscore"
        ));
    }

    let mut sanitized = String::with_capacity(trimmed.len());
    sanitized.push(first.to_ascii_uppercase());
    for ch in chars {
        if !(ch.is_ascii_alphanumeric() || ch == '_') {
            return Err(format!(
                "environment variable key `{trimmed}` contains unsupported character `{ch}`"
            ));
        }
        sanitized.push(ch.to_ascii_uppercase());
    }

    Ok(sanitized)
}

fn sanitize_env_value(raw_value: &str) -> String {
    raw_value.chars().filter(|ch| *ch != '\0').collect()
}

fn passthrough_env_keys() -> &'static [&'static str] {
    &[
        "HOME",
        "PATH",
        "USER",
        "LOGNAME",
        "SHELL",
        "TMPDIR",
        "TEMP",
        "SYSTEMROOT",
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_path(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        env::temp_dir().join(format!(
            "foundry-sandbox-{label}-{}-{nonce}",
            std::process::id()
        ))
    }

    #[test]
    fn canonical_worktree_path_rejects_empty_path() {
        let error = canonical_worktree_path("   ").expect_err("empty worktree path should fail");
        assert_eq!(error, "worktreePath cannot be empty");
    }

    #[test]
    fn canonical_worktree_path_resolves_existing_directory() {
        let root = unique_temp_path("canonical-dir");
        let nested = root.join("nested");
        fs::create_dir_all(&nested).expect("test directory should be created");
        let raw_path = root.join("nested").join("..");

        let canonical = canonical_worktree_path(raw_path.to_string_lossy().as_ref())
            .expect("existing directory should canonicalize");
        assert_eq!(
            canonical,
            root.canonicalize()
                .expect("canonical path should resolve")
                .to_string_lossy()
                .to_string()
        );

        fs::remove_dir_all(root).expect("temporary directory should be removed");
    }

    #[test]
    fn canonical_worktree_path_rejects_files() {
        let root = unique_temp_path("canonical-file");
        fs::create_dir_all(&root).expect("test directory should be created");
        let file_path = root.join("sample.txt");
        fs::write(&file_path, "test").expect("test file should be written");

        let error = canonical_worktree_path(file_path.to_string_lossy().as_ref())
            .expect_err("file path should be rejected");
        assert!(error.contains("must be a directory"));

        fs::remove_dir_all(root).expect("temporary directory should be removed");
    }

    #[test]
    fn sanitize_env_key_accepts_and_uppercases_valid_keys() {
        assert_eq!(
            sanitize_env_key("foundry_path_1").expect("valid key should pass"),
            "FOUNDRY_PATH_1"
        );
    }

    #[test]
    fn sanitize_env_key_rejects_invalid_keys() {
        let bad_prefix =
            sanitize_env_key("1INVALID").expect_err("key with numeric prefix should fail");
        assert!(bad_prefix.contains("must start with a letter or underscore"));

        let bad_character =
            sanitize_env_key("HAS-DASH").expect_err("key with unsupported character should fail");
        assert!(bad_character.contains("unsupported character"));
    }

    #[test]
    fn sanitize_env_value_strips_nul_bytes() {
        assert_eq!(sanitize_env_value("abc\0def\0"), "abcdef");
    }

    #[test]
    fn sanitized_env_adds_worktree_and_custom_variables() {
        let root = unique_temp_path("sanitized-env");
        fs::create_dir_all(&root).expect("test directory should be created");
        let canonical_root = root
            .canonicalize()
            .expect("canonical path should resolve")
            .to_string_lossy()
            .to_string();

        let mut custom_env = BTreeMap::new();
        custom_env.insert("custom_key".to_string(), "value\0with-nul".to_string());
        custom_env.insert("_lower".to_string(), "ok".to_string());

        let config = SandboxConfig {
            worktree_path: root.to_string_lossy().to_string(),
            env: custom_env,
        };
        let env_map = SandboxEnvironment
            .sanitized_env(&config)
            .expect("sandbox env should be produced");

        assert_eq!(
            env_map
                .get("FOUNDRY_WORKTREE_PATH")
                .expect("worktree key should exist"),
            &canonical_root
        );
        assert_eq!(
            env_map.get("PWD").expect("PWD key should exist"),
            &canonical_root
        );
        assert_eq!(
            env_map
                .get("CUSTOM_KEY")
                .expect("custom key should be uppercased"),
            "valuewith-nul"
        );
        assert_eq!(
            env_map
                .get("_LOWER")
                .expect("underscore key should be uppercased"),
            "ok"
        );

        fs::remove_dir_all(root).expect("temporary directory should be removed");
    }

    #[test]
    fn sanitized_env_rejects_invalid_custom_key() {
        let root = unique_temp_path("invalid-custom-key");
        fs::create_dir_all(&root).expect("test directory should be created");

        let mut custom_env = BTreeMap::new();
        custom_env.insert("bad-key".to_string(), "value".to_string());
        let config = SandboxConfig {
            worktree_path: root.to_string_lossy().to_string(),
            env: custom_env,
        };
        let error = SandboxEnvironment
            .sanitized_env(&config)
            .expect_err("invalid key should be rejected");
        assert!(error.contains("unsupported character"));

        fs::remove_dir_all(root).expect("temporary directory should be removed");
    }

    #[test]
    fn apply_returns_error_for_invalid_worktree_path() {
        let config = SandboxConfig {
            worktree_path: "   ".to_string(),
            env: BTreeMap::new(),
        };
        let error = SandboxEnvironment
            .apply(&config)
            .expect_err("invalid worktree should bubble up");
        assert_eq!(error, "worktreePath cannot be empty");
    }
}
