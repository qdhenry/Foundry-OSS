use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    pub cursor: u64,
    pub message: String,
}

#[derive(Debug, Clone)]
pub struct LogBuffer {
    entries: Vec<LogEntry>,
    capacity: usize,
}

impl Default for LogBuffer {
    fn default() -> Self {
        Self {
            entries: Vec::new(),
            capacity: 1_000,
        }
    }
}

impl LogBuffer {
    pub fn push(&mut self, message: String) {
        let cursor = self
            .entries
            .last()
            .map(|entry| entry.cursor + 1)
            .unwrap_or(1);
        self.entries.push(LogEntry { cursor, message });

        if self.entries.len() > self.capacity {
            let overflow = self.entries.len() - self.capacity;
            self.entries.drain(0..overflow);
        }
    }

    pub fn entries_after(&self, cursor: u64) -> Vec<LogEntry> {
        self.entries
            .iter()
            .filter(|entry| entry.cursor > cursor)
            .cloned()
            .collect()
    }
}
