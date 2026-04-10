use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeConfig {
    pub repository_path: String,
    pub default_parent_dir: Option<String>,
    pub reuse_existing: bool,
}

impl Default for WorktreeConfig {
    fn default() -> Self {
        Self {
            repository_path: String::new(),
            default_parent_dir: None,
            reuse_existing: true,
        }
    }
}
