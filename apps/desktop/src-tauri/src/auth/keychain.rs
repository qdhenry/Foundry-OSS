use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Default, Clone, Copy)]
pub struct KeychainStore;

impl KeychainStore {
    pub async fn get_api_key(&self, provider: &str) -> Result<Option<String>, String> {
        let provider = validate_provider(provider)?;
        let store_path = keychain_path()?;
        let entries = load_entries(&store_path)?;

        Ok(entries.get(&provider).cloned())
    }

    pub async fn set_api_key(&self, provider: &str, api_key: &str) -> Result<(), String> {
        let provider = validate_provider(provider)?;
        let api_key = validate_api_key(api_key)?;
        let store_path = keychain_path()?;
        let mut entries = load_entries(&store_path)?;
        entries.insert(provider, api_key);
        persist_entries(&store_path, &entries)?;

        Ok(())
    }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KeyStoreFile {
    #[serde(default)]
    keys: HashMap<String, String>,
}

fn keychain_path() -> Result<PathBuf, String> {
    Ok(app_support_dir()?
        .join("foundry-desktop")
        .join("keychain.json"))
}

fn app_support_dir() -> Result<PathBuf, String> {
    if cfg!(target_os = "windows") {
        if let Some(app_data) = env::var_os("APPDATA") {
            return Ok(PathBuf::from(app_data));
        }
    } else if cfg!(target_os = "macos") {
        let home = home_dir()?;
        return Ok(home.join("Library").join("Application Support"));
    } else if let Some(config_home) = env::var_os("XDG_CONFIG_HOME") {
        return Ok(PathBuf::from(config_home));
    }

    Ok(home_dir()?.join(".config"))
}

fn home_dir() -> Result<PathBuf, String> {
    env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .ok_or_else(|| "Unable to resolve a home directory for keychain storage".to_string())
}

fn load_entries(path: &Path) -> Result<HashMap<String, String>, String> {
    if !path.exists() {
        return Ok(HashMap::new());
    }

    let raw = fs::read_to_string(path).map_err(|error| {
        format!(
            "Failed to read keychain store `{}`: {error}",
            path.display()
        )
    })?;
    if raw.trim().is_empty() {
        return Ok(HashMap::new());
    }

    let parsed: KeyStoreFile = serde_json::from_str(&raw).map_err(|error| {
        format!(
            "Failed to parse keychain store `{}` as JSON: {error}",
            path.display()
        )
    })?;
    Ok(parsed.keys)
}

fn persist_entries(path: &Path, entries: &HashMap<String, String>) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to create keychain directory `{}`: {error}",
                parent.display()
            )
        })?;
    }

    let payload = KeyStoreFile {
        keys: entries.clone(),
    };
    let serialized = serde_json::to_string_pretty(&payload)
        .map_err(|error| format!("JSON encode failed: {error}"))?;

    let temporary_path = path.with_extension("tmp");
    fs::write(&temporary_path, serialized).map_err(|error| {
        format!(
            "Failed to write temporary keychain file `{}`: {error}",
            temporary_path.display()
        )
    })?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&temporary_path, fs::Permissions::from_mode(0o600));
    }

    fs::rename(&temporary_path, path).map_err(|error| {
        format!(
            "Failed to finalize keychain file `{}`: {error}",
            path.display()
        )
    })?;

    Ok(())
}

fn validate_provider(provider: &str) -> Result<String, String> {
    let normalized = provider.trim();
    if normalized.is_empty() {
        return Err("provider cannot be empty".to_string());
    }

    if normalized.len() > 128 {
        return Err("provider is too long".to_string());
    }

    if !normalized.chars().all(|character| {
        character.is_ascii_alphanumeric()
            || character == '-'
            || character == '_'
            || character == '.'
    }) {
        return Err(
            "provider contains invalid characters; use letters, numbers, `.`, `_`, or `-`"
                .to_string(),
        );
    }

    Ok(normalized.to_string())
}

fn validate_api_key(api_key: &str) -> Result<String, String> {
    let normalized = api_key.trim();
    if normalized.is_empty() {
        return Err("apiKey cannot be empty".to_string());
    }

    if normalized.len() > 16_384 {
        return Err("apiKey is too long".to_string());
    }

    if normalized.contains('\0') {
        return Err("apiKey contains invalid null bytes".to_string());
    }

    Ok(normalized.to_string())
}
