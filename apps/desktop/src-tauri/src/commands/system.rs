use crate::commands::types::{
    ConfigureConvexSyncRequest, ConfigureConvexSyncResponse, PrerequisiteCheck, PrerequisitesReport,
};
use rfd::FileDialog;
use std::env;
use std::io;
use std::process::Command;

const FOUNDRY_CONVEX_URL: &str = "FOUNDRY_CONVEX_URL";
const FOUNDRY_CONVEX_AUTH_TOKEN: &str = "FOUNDRY_CONVEX_AUTH_TOKEN";
const FOUNDRY_LOCAL_DEVICE_ID: &str = "FOUNDRY_LOCAL_DEVICE_ID";
const FOUNDRY_LOCAL_DEVICE_NAME: &str = "FOUNDRY_LOCAL_DEVICE_NAME";

#[tauri::command]
pub async fn check_prerequisites() -> Result<PrerequisitesReport, String> {
    Ok(PrerequisitesReport {
        checks: probe_required_tools(),
    })
}

#[tauri::command]
pub fn configure_convex_sync(
    request: ConfigureConvexSyncRequest,
) -> Result<ConfigureConvexSyncResponse, String> {
    apply_env_update(FOUNDRY_CONVEX_URL, request.base_url.as_deref());
    apply_env_update(FOUNDRY_CONVEX_AUTH_TOKEN, request.auth_token.as_deref());
    apply_env_update(FOUNDRY_LOCAL_DEVICE_ID, request.local_device_id.as_deref());
    apply_env_update(
        FOUNDRY_LOCAL_DEVICE_NAME,
        request.local_device_name.as_deref(),
    );

    Ok(ConfigureConvexSyncResponse {
        base_url_configured: env_var_is_configured(FOUNDRY_CONVEX_URL),
        auth_token_configured: env_var_is_configured(FOUNDRY_CONVEX_AUTH_TOKEN),
    })
}

#[tauri::command]
pub async fn pick_directory() -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(|| {
        Ok::<Option<String>, String>(
            FileDialog::new()
                .pick_folder()
                .map(|path| path.to_string_lossy().to_string()),
        )
    })
    .await
    .map_err(|error| format!("Directory picker task failed: {error}"))?
}

fn apply_env_update(key: &str, candidate: Option<&str>) {
    let Some(candidate) = candidate else {
        return;
    };

    let trimmed = candidate.trim();
    if trimmed.is_empty() {
        env::remove_var(key);
    } else {
        env::set_var(key, trimmed);
    }
}

fn env_var_is_configured(key: &str) -> bool {
    env::var(key)
        .ok()
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
}

pub(crate) fn probe_required_tools() -> Vec<PrerequisiteCheck> {
    vec![probe_tool("git"), probe_tool("node"), probe_tool("bun")]
}

pub(crate) fn probe_tool(name: &str) -> PrerequisiteCheck {
    let result = Command::new(name).arg("--version").output();

    match result {
        Ok(output) => {
            let version_output = if output.stdout.is_empty() {
                String::from_utf8_lossy(&output.stderr).trim().to_string()
            } else {
                String::from_utf8_lossy(&output.stdout).trim().to_string()
            };
            let version = version_output
                .lines()
                .next()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .map(str::to_string);

            PrerequisiteCheck {
                name: name.to_string(),
                available: output.status.success(),
                version,
            }
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => PrerequisiteCheck {
            name: name.to_string(),
            available: false,
            version: None,
        },
        Err(_) => PrerequisiteCheck {
            name: name.to_string(),
            available: false,
            version: None,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::{
        check_prerequisites, configure_convex_sync, probe_tool, FOUNDRY_CONVEX_AUTH_TOKEN,
        FOUNDRY_CONVEX_URL, FOUNDRY_LOCAL_DEVICE_ID, FOUNDRY_LOCAL_DEVICE_NAME,
    };
    use crate::commands::types::ConfigureConvexSyncRequest;
    use std::env;
    use std::sync::{Mutex, OnceLock};

    const CONVEX_SYNC_ENV_KEYS: [&str; 4] = [
        FOUNDRY_CONVEX_URL,
        FOUNDRY_CONVEX_AUTH_TOKEN,
        FOUNDRY_LOCAL_DEVICE_ID,
        FOUNDRY_LOCAL_DEVICE_NAME,
    ];
    static ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

    struct EnvSnapshot {
        values: Vec<(&'static str, Option<String>)>,
    }

    impl EnvSnapshot {
        fn capture(keys: &[&'static str]) -> Self {
            let values = keys
                .iter()
                .map(|key| (*key, env::var(key).ok()))
                .collect::<Vec<_>>();
            Self { values }
        }
    }

    impl Drop for EnvSnapshot {
        fn drop(&mut self) {
            for (key, value) in &self.values {
                if let Some(value) = value {
                    env::set_var(key, value);
                } else {
                    env::remove_var(key);
                }
            }
        }
    }

    fn with_env_lock<T>(run: impl FnOnce() -> T) -> T {
        let _guard = ENV_LOCK
            .get_or_init(|| Mutex::new(()))
            .lock()
            .expect("env lock should be available");
        let _snapshot = EnvSnapshot::capture(&CONVEX_SYNC_ENV_KEYS);
        run()
    }

    fn clear_convex_sync_env() {
        for key in CONVEX_SYNC_ENV_KEYS {
            env::remove_var(key);
        }
    }

    #[test]
    fn probe_tool_reports_missing_binary() {
        let check = probe_tool("__foundry_missing_tool_for_test__");
        assert_eq!(check.name, "__foundry_missing_tool_for_test__");
        assert!(!check.available);
        assert!(check.version.is_none());
    }

    #[tokio::test]
    async fn check_prerequisites_returns_expected_tool_order() {
        let report = check_prerequisites()
            .await
            .expect("prerequisite report should be returned");
        let names = report
            .checks
            .iter()
            .map(|check| check.name.as_str())
            .collect::<Vec<_>>();
        assert_eq!(names, vec!["git", "node", "bun"]);
        assert_eq!(report.checks.len(), 3);
    }

    #[test]
    fn configure_convex_sync_sets_trimmed_values_when_provided() {
        with_env_lock(|| {
            clear_convex_sync_env();

            let response = configure_convex_sync(ConfigureConvexSyncRequest {
                base_url: Some("  https://example.convex.cloud/  ".to_string()),
                auth_token: Some("  token-123  ".to_string()),
                local_device_id: Some("  desktop-alpha  ".to_string()),
                local_device_name: Some("  Quinn's MacBook  ".to_string()),
            })
            .expect("convex sync config should be applied");

            assert_eq!(
                env::var(FOUNDRY_CONVEX_URL).ok().as_deref(),
                Some("https://example.convex.cloud/")
            );
            assert_eq!(
                env::var(FOUNDRY_CONVEX_AUTH_TOKEN).ok().as_deref(),
                Some("token-123")
            );
            assert_eq!(
                env::var(FOUNDRY_LOCAL_DEVICE_ID).ok().as_deref(),
                Some("desktop-alpha")
            );
            assert_eq!(
                env::var(FOUNDRY_LOCAL_DEVICE_NAME).ok().as_deref(),
                Some("Quinn's MacBook")
            );
            assert!(response.base_url_configured);
            assert!(response.auth_token_configured);
        });
    }

    #[test]
    fn configure_convex_sync_removes_values_when_empty_strings_are_provided() {
        with_env_lock(|| {
            env::set_var(FOUNDRY_CONVEX_URL, "https://example.convex.cloud");
            env::set_var(FOUNDRY_CONVEX_AUTH_TOKEN, "token-123");
            env::set_var(FOUNDRY_LOCAL_DEVICE_ID, "desktop-alpha");
            env::set_var(FOUNDRY_LOCAL_DEVICE_NAME, "Desktop Alpha");

            let response = configure_convex_sync(ConfigureConvexSyncRequest {
                base_url: Some("   ".to_string()),
                auth_token: Some("\n\t".to_string()),
                local_device_id: Some("".to_string()),
                local_device_name: Some("   ".to_string()),
            })
            .expect("convex sync config should be applied");

            assert!(env::var(FOUNDRY_CONVEX_URL).is_err());
            assert!(env::var(FOUNDRY_CONVEX_AUTH_TOKEN).is_err());
            assert!(env::var(FOUNDRY_LOCAL_DEVICE_ID).is_err());
            assert!(env::var(FOUNDRY_LOCAL_DEVICE_NAME).is_err());
            assert!(!response.base_url_configured);
            assert!(!response.auth_token_configured);
        });
    }

    #[test]
    fn configure_convex_sync_leaves_env_unchanged_when_fields_are_omitted() {
        with_env_lock(|| {
            env::set_var(FOUNDRY_CONVEX_URL, "https://unchanged.convex.cloud");
            env::set_var(FOUNDRY_CONVEX_AUTH_TOKEN, "unchanged-token");
            env::set_var(FOUNDRY_LOCAL_DEVICE_ID, "desktop-unchanged");
            env::set_var(FOUNDRY_LOCAL_DEVICE_NAME, "Desktop Unchanged");

            let response = configure_convex_sync(ConfigureConvexSyncRequest {
                base_url: None,
                auth_token: None,
                local_device_id: None,
                local_device_name: None,
            })
            .expect("convex sync config should be applied");

            assert_eq!(
                env::var(FOUNDRY_CONVEX_URL).ok().as_deref(),
                Some("https://unchanged.convex.cloud")
            );
            assert_eq!(
                env::var(FOUNDRY_CONVEX_AUTH_TOKEN).ok().as_deref(),
                Some("unchanged-token")
            );
            assert_eq!(
                env::var(FOUNDRY_LOCAL_DEVICE_ID).ok().as_deref(),
                Some("desktop-unchanged")
            );
            assert_eq!(
                env::var(FOUNDRY_LOCAL_DEVICE_NAME).ok().as_deref(),
                Some("Desktop Unchanged")
            );
            assert!(response.base_url_configured);
            assert!(response.auth_token_configured);
        });
    }
}
