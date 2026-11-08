// SPDX-License-Identifier: MPL-2.0
use crate::{Error, Result, paths};
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, path::PathBuf};
use uuid::Uuid;
pub const LIMIT: u64 = 64 * 1024;
pub const MAX_TARGETS: usize = 10;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SavedTarget {
    pub id: Uuid,
    pub firefox_path: PathBuf,
    pub profile_path: PathBuf,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SavedTargets {
    pub schema_version: u32,
    pub targets: Vec<SavedTarget>,
}
impl Default for SavedTargets {
    fn default() -> Self {
        Self {
            schema_version: 1,
            targets: Vec::new(),
        }
    }
}
impl SavedTargets {
    pub fn parse(bytes: &[u8]) -> Result<Self> {
        if bytes.len() as u64 > LIMIT {
            return Err(Error::LimitExceeded);
        }
        let result: Self = serde_json::from_slice(bytes)?;
        if result.schema_version != 1 || result.targets.len() > MAX_TARGETS {
            return Err(Error::InvalidData);
        }
        let mut ids = HashSet::new();
        let mut pairs = HashSet::new();
        for item in &result.targets {
            if item.id.is_nil()
                || !ids.insert(item.id)
                || !pairs.insert((
                    paths::key(&item.firefox_path),
                    paths::key(&item.profile_path),
                ))
            {
                return Err(Error::InvalidData);
            }
            // Structural path validation only: missing/moved entries remain removable.
            for path in [&item.firefox_path, &item.profile_path] {
                let normalized = paths::absolute_syntax(path.to_str().ok_or(Error::InvalidPath)?)?;
                if paths::key(&normalized) != paths::key(path) {
                    return Err(Error::InvalidPath);
                }
            }
        }
        Ok(result)
    }
    pub fn add(&mut self, firefox_path: PathBuf, profile_path: PathBuf) -> Result<()> {
        if self.targets.iter().any(|t| {
            paths::same(&t.firefox_path, &firefox_path)
                && paths::same(&t.profile_path, &profile_path)
        }) {
            return Ok(());
        }
        if self.targets.len() >= MAX_TARGETS {
            return Err(Error::LimitExceeded);
        }
        self.targets.push(SavedTarget {
            id: Uuid::new_v4(),
            firefox_path,
            profile_path,
        });
        Ok(())
    }
    pub fn bytes(&self) -> Result<Vec<u8>> {
        let bytes = serde_json::to_vec_pretty(self)?;
        if bytes.len() as u64 > LIMIT {
            return Err(Error::LimitExceeded);
        }
        Ok(bytes)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn closed_schema_and_size_are_enforced() {
        assert!(SavedTargets::parse(br#"{"schemaVersion":2,"targets":[]}"#).is_err());
        assert!(
            SavedTargets::parse(br#"{"schemaVersion":1,"targets":[],"command":"execute"}"#)
                .is_err()
        );
        assert!(SavedTargets::parse(&vec![b' '; LIMIT as usize + 1]).is_err());
        assert_eq!(
            SavedTargets::parse(&SavedTargets::default().bytes().unwrap())
                .unwrap()
                .targets
                .len(),
            0
        );
    }
}
