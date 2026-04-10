use crate::sync::payloads::DesktopLogEntry;
use crate::sync::session_sync::SessionSync;

#[derive(Debug, Clone)]
pub struct BatchSender {
    pub max_batch_size: usize,
}

impl Default for BatchSender {
    fn default() -> Self {
        Self { max_batch_size: 50 }
    }
}

impl BatchSender {
    pub async fn flush(&self, session_id: &str, logs: Vec<String>) -> Result<Vec<String>, String> {
        if session_id.trim().is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }

        if logs.len() <= self.max_batch_size {
            return Ok(logs);
        }

        Ok(logs.into_iter().take(self.max_batch_size).collect())
    }

    pub async fn flush_to_sync(
        &self,
        session_id: &str,
        logs: Vec<String>,
        sync: &SessionSync,
    ) -> Result<(), String> {
        if session_id.trim().is_empty() {
            return Err("sessionId cannot be empty".to_string());
        }

        if logs.is_empty() {
            return Ok(());
        }

        for chunk in logs.chunks(self.max_batch_size) {
            let entries = chunk
                .iter()
                .cloned()
                .map(DesktopLogEntry::stdout)
                .collect::<Vec<_>>();
            sync.append_log_batch(session_id, &entries).await?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::BatchSender;
    use crate::runtime::RuntimeSessionStore;
    use crate::sync::session_sync::SessionSync;
    use std::collections::HashMap;
    use std::env;

    const SYNC_ENV_KEYS: [&str; 5] = [
        "FOUNDRY_CONVEX_URL",
        "CONVEX_URL",
        "NEXT_PUBLIC_CONVEX_URL",
        "FOUNDRY_CONVEX_AUTH_TOKEN",
        "CONVEX_AUTH_TOKEN",
    ];

    struct EnvGuard {
        original: HashMap<String, Option<String>>,
    }

    impl EnvGuard {
        fn unset(keys: &[&str]) -> Self {
            let mut original = HashMap::with_capacity(keys.len());
            for key in keys {
                original.insert((*key).to_string(), env::var(key).ok());
                env::remove_var(key);
            }

            Self { original }
        }
    }

    impl Drop for EnvGuard {
        fn drop(&mut self) {
            for (key, value) in &self.original {
                if let Some(value) = value {
                    env::set_var(key, value);
                } else {
                    env::remove_var(key);
                }
            }
        }
    }

    #[tokio::test]
    async fn flush_rejects_empty_session_id() {
        let sender = BatchSender { max_batch_size: 3 };

        let error = sender
            .flush("  ", vec!["line-1".to_string()])
            .await
            .expect_err("empty session id should fail");
        assert_eq!(error, "sessionId cannot be empty");
    }

    #[tokio::test]
    async fn flush_truncates_to_max_batch_size_and_preserves_order() {
        let sender = BatchSender { max_batch_size: 3 };
        let logs = vec![
            "line-1".to_string(),
            "line-2".to_string(),
            "line-3".to_string(),
            "line-4".to_string(),
        ];

        let flushed = sender
            .flush("session-1", logs)
            .await
            .expect("flush should succeed");
        assert_eq!(
            flushed,
            vec![
                "line-1".to_string(),
                "line-2".to_string(),
                "line-3".to_string()
            ]
        );
    }

    #[tokio::test]
    async fn flush_returns_all_logs_when_under_limit() {
        let sender = BatchSender { max_batch_size: 5 };
        let logs = vec![
            "line-1".to_string(),
            "line-2".to_string(),
            "line-3".to_string(),
        ];

        let flushed = sender
            .flush("session-1", logs.clone())
            .await
            .expect("flush should return all logs when under the limit");
        assert_eq!(flushed, logs);
    }

    #[tokio::test]
    async fn flush_to_sync_returns_success_for_empty_logs() {
        let sender = BatchSender { max_batch_size: 2 };
        let sync = SessionSync::default();

        sender
            .flush_to_sync("session-1", Vec::new(), &sync)
            .await
            .expect("empty log batches should be ignored successfully");
    }

    #[tokio::test]
    async fn flush_to_sync_returns_success_when_sync_is_disabled_with_chunks() {
        let _test_lock = RuntimeSessionStore::acquire_test_lock();
        let _env_guard = EnvGuard::unset(&SYNC_ENV_KEYS);
        let sender = BatchSender { max_batch_size: 2 };
        let sync = SessionSync::default();

        let logs = vec![
            "line-1".to_string(),
            "line-2".to_string(),
            "line-3".to_string(),
            "line-4".to_string(),
            "line-5".to_string(),
        ];

        sender
            .flush_to_sync("session-1", logs, &sync)
            .await
            .expect("disabled sync mode should no-op successfully for all chunks");
    }
}
