use serde::Deserialize;
use std::collections::HashMap;
use std::env;
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

const PROCESS_EXECUTABLE_ENV: &str = "FOUNDRY_DESKTOP_PROCESS_EXECUTABLE";
const PROCESS_ARGS_ENV: &str = "FOUNDRY_DESKTOP_PROCESS_ARGS_JSON";

#[derive(Debug, Clone)]
struct ProcessCommand {
    executable: String,
    args: Vec<String>,
}

#[derive(Debug)]
struct ManagedProcess {
    child: Child,
    command: ProcessCommand,
    started_at_epoch_ms: u128,
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct ProcessMetadata {
    pub pid: u32,
    pub started_at_epoch_ms: u128,
}

#[derive(Debug, Default, Clone, Copy)]
pub struct ProcessManager;

static PROCESS_REGISTRY: OnceLock<Mutex<HashMap<String, ManagedProcess>>> = OnceLock::new();

impl ProcessManager {
    fn registry(&self) -> &'static Mutex<HashMap<String, ManagedProcess>> {
        PROCESS_REGISTRY.get_or_init(|| Mutex::new(HashMap::new()))
    }

    pub async fn spawn_for_session(&self, session_id: &str) -> Result<(), String> {
        let session_id = normalized_session_id(session_id)?;
        let command = ProcessCommand::from_environment()?;
        let mut registry = self
            .registry()
            .lock()
            .map_err(|_| "process registry lock is unavailable".to_string())?;

        if let Some(existing) = registry.get_mut(session_id) {
            match existing.child.try_wait() {
                Ok(Some(exit_status)) => {
                    registry.remove(session_id);
                    eprintln!(
                        "replacing exited process for session `{session_id}` (status: {exit_status})"
                    );
                }
                Ok(None) => {
                    let uptime_ms = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis()
                        .saturating_sub(existing.started_at_epoch_ms);
                    return Err(format!(
                        "session `{session_id}` already has a running process (pid {}, command `{}`, uptime {}ms)",
                        existing.child.id(),
                        existing.command.describe(),
                        uptime_ms,
                    ));
                }
                Err(error) => {
                    return Err(format!(
                        "failed to inspect existing process for session `{session_id}`: {error}"
                    ));
                }
            }
        }

        let child = Command::new(&command.executable)
            .args(&command.args)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|error| {
                format!(
                    "failed to spawn process for session `{session_id}` using `{}`: {error}",
                    command.describe()
                )
            })?;

        let pid = child.id();
        let started_at_epoch_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        registry.insert(
            session_id.to_string(),
            ManagedProcess {
                child,
                command,
                started_at_epoch_ms,
            },
        );
        eprintln!("spawned managed process {pid} for session `{session_id}`");

        Ok(())
    }

    pub async fn kill_for_session(&self, session_id: &str) -> Result<(), String> {
        let session_id = normalized_session_id(session_id)?;
        let mut registry = self
            .registry()
            .lock()
            .map_err(|_| "process registry lock is unavailable".to_string())?;

        let mut managed = registry
            .remove(session_id)
            .ok_or_else(|| format!("no managed process found for session `{session_id}`"))?;

        match managed.child.try_wait() {
            Ok(Some(_)) => Ok(()),
            Ok(None) => {
                managed.child.kill().map_err(|error| {
                    format!(
                        "failed to kill process {} for session `{session_id}`: {error}",
                        managed.child.id()
                    )
                })?;
                managed.child.wait().map_err(|error| {
                    format!(
                        "failed to wait for process {} after kill for session `{session_id}`: {error}",
                        managed.child.id()
                    )
                })?;
                Ok(())
            }
            Err(error) => Err(format!(
                "failed to inspect process for session `{session_id}` before kill: {error}"
            )),
        }
    }
}

pub(crate) fn tracked_process_metadata(session_id: &str) -> Option<ProcessMetadata> {
    let session_id = normalized_session_id(session_id).ok()?;
    let registry = PROCESS_REGISTRY.get_or_init(|| Mutex::new(HashMap::new()));
    let mut guard = registry.lock().ok()?;

    let (remove_entry, metadata) = {
        let managed = guard.get_mut(session_id)?;
        let remove_entry = match managed.child.try_wait() {
            Ok(Some(_)) => true,
            Ok(None) => false,
            Err(_) => true,
        };
        let metadata = ProcessMetadata {
            pid: managed.child.id(),
            started_at_epoch_ms: managed.started_at_epoch_ms,
        };
        (remove_entry, metadata)
    };

    if remove_entry {
        guard.remove(session_id);
        None
    } else {
        Some(metadata)
    }
}

impl ProcessCommand {
    fn from_environment() -> Result<Self, String> {
        let executable = match env::var(PROCESS_EXECUTABLE_ENV) {
            Ok(value) => value.trim().to_string(),
            Err(env::VarError::NotPresent) => return Self::default_noop(),
            Err(error) => {
                return Err(format!(
                    "failed to read `{PROCESS_EXECUTABLE_ENV}`: {error}"
                ));
            }
        };

        if executable.is_empty() {
            return Err(format!(
                "`{PROCESS_EXECUTABLE_ENV}` cannot be empty when set"
            ));
        }

        let args = parse_command_args_from_env()?;
        Ok(Self { executable, args })
    }

    fn default_noop() -> Result<Self, String> {
        #[cfg(target_os = "windows")]
        {
            return Ok(Self {
                executable: "cmd".to_string(),
                args: vec![
                    "/C".to_string(),
                    "timeout".to_string(),
                    "/T".to_string(),
                    "3600".to_string(),
                    "/NOBREAK".to_string(),
                ],
            });
        }

        #[cfg(not(target_os = "windows"))]
        {
            return Ok(Self {
                executable: "sleep".to_string(),
                args: vec!["3600".to_string()],
            });
        }
    }

    fn describe(&self) -> String {
        if self.args.is_empty() {
            self.executable.clone()
        } else {
            format!("{} {}", self.executable, self.args.join(" "))
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(transparent)]
struct ProcessArgs(Vec<String>);

fn parse_command_args_from_env() -> Result<Vec<String>, String> {
    let raw_args = match env::var(PROCESS_ARGS_ENV) {
        Ok(value) => value,
        Err(env::VarError::NotPresent) => return Ok(Vec::new()),
        Err(error) => return Err(format!("failed to read `{PROCESS_ARGS_ENV}`: {error}")),
    };

    if raw_args.trim().is_empty() {
        return Ok(Vec::new());
    }

    let parsed: ProcessArgs = serde_json::from_str(&raw_args).map_err(|error| {
        format!(
            "`{PROCESS_ARGS_ENV}` must be a JSON string array, e.g. [\"--flag\",\"value\"]: {error}"
        )
    })?;

    if parsed.0.iter().any(|arg| arg.contains('\0')) {
        return Err(format!("`{PROCESS_ARGS_ENV}` cannot contain NUL bytes"));
    }

    Ok(parsed.0)
}

fn normalized_session_id(session_id: &str) -> Result<&str, String> {
    let trimmed = session_id.trim();
    if trimmed.is_empty() {
        Err("sessionId cannot be empty".to_string())
    } else {
        Ok(trimmed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::sync::{Mutex, OnceLock};

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

    fn with_env_vars<T>(run: impl FnOnce() -> T) -> T {
        let _guard = ENV_LOCK
            .get_or_init(|| Mutex::new(()))
            .lock()
            .expect("env lock should be available");
        let _snapshot = EnvSnapshot::capture(&[PROCESS_EXECUTABLE_ENV, PROCESS_ARGS_ENV]);
        run()
    }

    #[test]
    fn normalized_session_id_rejects_empty_values() {
        assert_eq!(
            normalized_session_id("  ").expect_err("empty session IDs should fail"),
            "sessionId cannot be empty"
        );
    }

    #[test]
    fn normalized_session_id_trims_surrounding_whitespace() {
        assert_eq!(
            normalized_session_id("  session-42  ").expect("trimmed ID should be valid"),
            "session-42"
        );
    }

    #[test]
    fn parse_command_args_from_env_defaults_to_empty_when_not_set() {
        with_env_vars(|| {
            env::remove_var(PROCESS_ARGS_ENV);
            assert_eq!(
                parse_command_args_from_env().expect("missing args env should be allowed"),
                Vec::<String>::new()
            );
        });
    }

    #[test]
    fn parse_command_args_from_env_allows_blank_values() {
        with_env_vars(|| {
            env::set_var(PROCESS_ARGS_ENV, "   ");
            assert_eq!(
                parse_command_args_from_env().expect("blank args env should be treated as empty"),
                Vec::<String>::new()
            );
        });
    }

    #[test]
    fn parse_command_args_from_env_parses_json_array() {
        with_env_vars(|| {
            env::set_var(PROCESS_ARGS_ENV, r#"["--flag","value"]"#);
            assert_eq!(
                parse_command_args_from_env().expect("valid JSON args should parse"),
                vec!["--flag".to_string(), "value".to_string()]
            );
        });
    }

    #[test]
    fn parse_command_args_from_env_rejects_invalid_json() {
        with_env_vars(|| {
            env::set_var(PROCESS_ARGS_ENV, r#"{"not":"an array"}"#);
            let error =
                parse_command_args_from_env().expect_err("non-array JSON should be rejected");
            assert!(error.contains(PROCESS_ARGS_ENV));
            assert!(error.contains("JSON string array"));
        });
    }

    #[test]
    fn parse_command_args_from_env_rejects_nul_bytes() {
        with_env_vars(|| {
            env::set_var(PROCESS_ARGS_ENV, r#"["ok","bad\u0000value"]"#);
            let error =
                parse_command_args_from_env().expect_err("NUL bytes in args should be rejected");
            assert!(error.contains("cannot contain NUL bytes"));
        });
    }

    #[test]
    fn process_command_from_environment_uses_default_when_not_overridden() {
        with_env_vars(|| {
            env::remove_var(PROCESS_EXECUTABLE_ENV);
            env::remove_var(PROCESS_ARGS_ENV);

            let command = ProcessCommand::from_environment()
                .expect("default command should be available when env is missing");
            assert!(!command.executable.trim().is_empty());
            assert!(!command.args.is_empty());
        });
    }

    #[test]
    fn process_command_from_environment_rejects_empty_executable() {
        with_env_vars(|| {
            env::set_var(PROCESS_EXECUTABLE_ENV, "   ");
            let error = ProcessCommand::from_environment()
                .expect_err("empty executable override should fail");
            assert!(error.contains(PROCESS_EXECUTABLE_ENV));
            assert!(error.contains("cannot be empty"));
        });
    }

    #[test]
    fn process_command_from_environment_uses_env_overrides() {
        with_env_vars(|| {
            env::set_var(PROCESS_EXECUTABLE_ENV, "echo");
            env::set_var(PROCESS_ARGS_ENV, r#"["hello","world"]"#);

            let command = ProcessCommand::from_environment()
                .expect("explicit executable and args should parse");
            assert_eq!(command.executable, "echo");
            assert_eq!(command.args, vec!["hello".to_string(), "world".to_string()]);
            assert_eq!(command.describe(), "echo hello world");
        });
    }
}
