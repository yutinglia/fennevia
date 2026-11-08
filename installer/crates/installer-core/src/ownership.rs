// SPDX-License-Identifier: MPL-2.0
use crate::{Error, Result, paths};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
};
use uuid::Uuid;

pub const OWNERSHIP: &str = ".fennevia/ownership.json";
pub const ENABLED: &str = "defaults/pref/fennevia.js";
pub const DISABLED: &str = "defaults/pref/fennevia.js.disabled";
pub const PROFILE_PREFIX: &str = "chrome/fennevia/";
const RECORD_LIMIT: u64 = 1024 * 1024;
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Scope {
    Program,
    Profile,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum State {
    Enabled,
    Disabled,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OwnedFile {
    pub scope: Scope,
    pub path: String,
    pub installed_path: String,
    pub sha256: String,
}
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Directory {
    pub scope: Scope,
    pub path: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Ownership {
    pub schema_version: u32,
    pub owner: String,
    pub package_id: String,
    pub installation_id: Uuid,
    pub package_version: String,
    pub state: State,
    pub source_manifest_sha256: String,
    pub files: Vec<OwnedFile>,
    pub created_directories: Vec<Directory>,
}
pub fn valid_hash(hash: &str) -> bool {
    hash.len() == 64
        && hash
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
pub fn valid_version(version: &str) -> bool {
    !version.is_empty()
        && version.len() <= 64
        && version.as_bytes()[0].is_ascii_alphanumeric()
        && version
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b".-".contains(&b))
}
pub fn approved(scope: Scope, path: &str) -> Result<()> {
    paths::relative(path)?;
    let allowed = match scope {
        Scope::Program => [ENABLED, DISABLED, "fennevia.cfg"].contains(&path),
        Scope::Profile => path.starts_with(PROFILE_PREFIX),
    };
    if allowed {
        Ok(())
    } else {
        Err(Error::InvalidData)
    }
}
impl Ownership {
    pub fn parse(bytes: &[u8]) -> Result<Self> {
        if bytes.len() as u64 > RECORD_LIMIT {
            return Err(Error::LimitExceeded);
        }
        let mut record: Self = serde_json::from_slice(bytes)?;
        record.validate()?;
        // Data equality is serializer-independent. Paired-root byte comparison
        // still happens before parsing, and survivor bytes remain untouched.
        record
            .files
            .sort_by(|a, b| (a.scope, &a.path).cmp(&(b.scope, &b.path)));
        record.created_directories.sort();
        Ok(record)
    }
    pub fn validate(&self) -> Result<()> {
        if self.schema_version != 1
            || self.owner != "fennevia"
            || self.package_id != "fennevia"
            || self.installation_id.is_nil()
            || !valid_version(&self.package_version)
            || !valid_hash(&self.source_manifest_sha256)
            || self.files.is_empty()
            || self.files.len() > 4096
            || self.created_directories.len() > 4096
        {
            return Err(Error::InvalidData);
        }
        let mut logical = HashSet::new();
        let mut installed = HashSet::new();
        for file in &self.files {
            approved(file.scope, &file.path)?;
            approved(file.scope, &file.installed_path)?;
            if !valid_hash(&file.sha256)
                || !logical.insert((file.scope, file.path.to_ascii_lowercase()))
                || !installed.insert((file.scope, file.installed_path.to_ascii_lowercase()))
            {
                return Err(Error::InvalidData);
            }
            let expected = if file.scope == Scope::Program
                && file.path == ENABLED
                && self.state == State::Disabled
            {
                DISABLED
            } else {
                &file.path
            };
            if file.installed_path != expected || file.path == DISABLED {
                return Err(Error::InvalidData);
            }
        }
        let mut directories = HashSet::new();
        for directory in &self.created_directories {
            paths::relative(&directory.path)?;
            if directory.scope != Scope::Profile
                || !(directory.path == "chrome"
                    || directory.path == "chrome/fennevia"
                    || directory.path.starts_with(PROFILE_PREFIX))
                || !directories.insert(directory.path.to_ascii_lowercase())
            {
                return Err(Error::InvalidData);
            }
        }
        Ok(())
    }
}

pub struct Pair {
    pub record: Option<Ownership>,
    pub bytes: Option<Vec<u8>>,
    pub present: [bool; 2],
}
#[derive(Clone, Debug)]
pub struct Roots {
    pub program: PathBuf,
    pub profile: PathBuf,
}
impl Roots {
    pub fn get(&self, scope: Scope) -> &Path {
        match scope {
            Scope::Program => &self.program,
            Scope::Profile => &self.profile,
        }
    }
    pub fn resolve(&self, scope: Scope, path: &str) -> Result<PathBuf> {
        paths::join(self.get(scope), path)
    }
    pub fn read_ownership(&self) -> Result<Pair> {
        let mut bytes: [Option<Vec<u8>>; 2] = [None, None];
        for (index, scope) in [Scope::Program, Scope::Profile].into_iter().enumerate() {
            let root = self.get(scope);
            paths::no_reparse(root)?;
            for (index, entry) in fs::read_dir(root)?.enumerate() {
                if index >= 4096 {
                    return Err(Error::LimitExceeded);
                }
                let entry = entry?;
                if entry
                    .file_name()
                    .to_string_lossy()
                    .to_ascii_lowercase()
                    .starts_with(".fennevia-transaction-")
                {
                    return Err(Error::Busy);
                }
            }
            let metadata = paths::join(root, ".fennevia")?;
            if !metadata.try_exists()? {
                continue;
            }
            let mut entries = fs::read_dir(&metadata)?;
            let entry = entries.next().ok_or(Error::InvalidData)??;
            if entry.file_name() != "ownership.json" || entries.next().is_some() {
                return Err(Error::Conflict);
            }
            bytes[index] = Some(paths::bounded_read(&entry.path(), RECORD_LIMIT)?);
        }
        if let (Some(a), Some(b)) = (&bytes[0], &bytes[1])
            && a != b
        {
            return Err(Error::Conflict);
        }
        let present = [bytes[0].is_some(), bytes[1].is_some()];
        let bytes = bytes[0].take().or(bytes[1].take());
        let record = bytes.as_ref().map(|b| Ownership::parse(b)).transpose()?;
        Ok(Pair {
            record,
            bytes,
            present,
        })
    }
    pub fn verify_file(&self, file: &OwnedFile, allow_missing: bool) -> Result<bool> {
        approved(file.scope, &file.installed_path)?;
        let path = self.resolve(file.scope, &file.installed_path)?;
        match paths::bounded_read(&path, paths::MAX_TEXT) {
            Ok(bytes) if paths::hash(&bytes) == file.sha256 => Ok(true),
            Ok(_) => Err(Error::Conflict),
            Err(Error::Missing) if allow_missing => Ok(false),
            Err(e) => Err(e),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub state: &'static str,
    pub version: Option<String>,
    pub missing_files: usize,
    pub changed_files: usize,
    pub incomplete: bool,
}
pub fn status(roots: &Roots) -> Result<Status> {
    let pair = roots.read_ownership()?;
    let mut result = Status {
        state: "absent",
        version: None,
        missing_files: 0,
        changed_files: 0,
        incomplete: pair.present[0] != pair.present[1],
    };
    if let Some(record) = pair.record {
        result.version = Some(record.package_version.clone());
        result.state = match record.state {
            State::Enabled => "enabled",
            State::Disabled => "disabled",
        };
        for file in record.files {
            match roots.verify_file(&file, true) {
                Ok(true) => {}
                Ok(false) => result.missing_files += 1,
                Err(Error::Conflict) => result.changed_files += 1,
                Err(e) => return Err(e),
            }
        }
    } else {
        for (scope, path) in [
            (Scope::Program, ENABLED),
            (Scope::Program, DISABLED),
            (Scope::Program, "fennevia.cfg"),
            (Scope::Profile, "chrome/fennevia"),
        ] {
            if roots.resolve(scope, path)?.try_exists()? {
                return Err(Error::Conflict);
            }
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> Ownership {
        Ownership {
            schema_version: 1,
            owner: "fennevia".into(),
            package_id: "fennevia".into(),
            installation_id: Uuid::new_v4(),
            package_version: "0.19.0-beta.1".into(),
            state: State::Enabled,
            source_manifest_sha256: "a".repeat(64),
            files: vec![OwnedFile {
                scope: Scope::Program,
                path: ENABLED.into(),
                installed_path: ENABLED.into(),
                sha256: "b".repeat(64),
            }],
            created_directories: vec![],
        }
    }
    #[test]
    fn rejects_ownership_escape_duplicate_and_disabled_mismatch() {
        let mut record = fixture();
        record.files[0].installed_path = "other.cfg".into();
        assert!(record.validate().is_err());
        let mut record = fixture();
        record.files.push(record.files[0].clone());
        assert!(record.validate().is_err());
        let mut record = fixture();
        record.state = State::Disabled;
        assert!(record.validate().is_err());
        record.files[0].installed_path = DISABLED.into();
        assert!(record.validate().is_ok());
        record.created_directories.push(Directory {
            scope: Scope::Profile,
            path: "chrome/unrelated".into(),
        });
        assert!(record.validate().is_err());
    }
    #[test]
    fn parses_crlf_and_rejects_unknown_fields() {
        let record = fixture();
        let bytes = (serde_json::to_string_pretty(&record)
            .unwrap()
            .replace('\n', "\r\n")
            + "\r\n")
            .into_bytes();
        assert_eq!(Ownership::parse(&bytes).unwrap(), record);
        let mut value = serde_json::to_value(&record).unwrap();
        value["unknown"] = true.into();
        assert!(Ownership::parse(&serde_json::to_vec(&value).unwrap()).is_err());
    }
}
