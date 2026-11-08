// SPDX-License-Identifier: MPL-2.0
use crate::{Error, Result, paths};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    path::{Path, PathBuf},
};
const INI_LIMIT: u64 = 256 * 1024;
const ENTRY_LIMIT: usize = 256;
pub type Section = BTreeMap<String, String>;

pub fn parse_ini(value: &str) -> Result<Vec<(String, Section)>> {
    if value.len() as u64 > INI_LIMIT {
        return Err(Error::LimitExceeded);
    }
    let mut sections: Vec<(String, Section)> = Vec::new();
    for raw in value.trim_start_matches('\u{feff}').lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with([';', '#']) {
            continue;
        }
        if line.starts_with('[') && line.ends_with(']') {
            if sections.len() >= ENTRY_LIMIT {
                return Err(Error::LimitExceeded);
            }
            let name = line[1..line.len() - 1].to_owned();
            if sections.iter().any(|(n, _)| *n == name) {
                return Err(Error::InvalidData);
            }
            sections.push((name, Section::new()));
        } else if let Some((k, v)) = line.split_once('=') {
            let (_, section) = sections.last_mut().ok_or(Error::InvalidData)?;
            if section.len() >= ENTRY_LIMIT
                || section
                    .insert(k.trim().to_owned(), v.trim().to_owned())
                    .is_some()
            {
                return Err(Error::InvalidData);
            }
        } else {
            return Err(Error::InvalidData);
        }
    }
    Ok(sections)
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Firefox {
    pub path: PathBuf,
    pub version: String,
    pub build_id: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Profile {
    pub path: PathBuf,
    pub name: String,
    pub is_default: bool,
}
pub fn firefox(path: &Path) -> Result<Firefox> {
    let path = paths::absolute(path.to_str().ok_or(Error::InvalidPath)?)?;
    if path.file_name().and_then(|s| s.to_str()) != Some("firefox.exe") || !path.is_file() {
        return Err(Error::InvalidProgram);
    }
    let root = path.parent().ok_or(Error::InvalidProgram)?;
    if !root.join("defaults/pref").is_dir() {
        return Err(Error::InvalidProgram);
    }
    paths::no_reparse(&root.join("defaults/pref"))?;
    let ini = parse_ini(&paths::text(&root.join("application.ini"), INI_LIMIT)?)?;
    let (_, app) = ini
        .iter()
        .find(|(n, _)| n == "App")
        .ok_or(Error::InvalidProgram)?;
    let version = app.get("Version").ok_or(Error::InvalidProgram)?;
    let build_id = app.get("BuildID").ok_or(Error::InvalidProgram)?;
    if app.get("Name").map(String::as_str) != Some("Firefox")
        || version.is_empty()
        || version.len() > 64
        || !version
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b".-".contains(&b))
        || build_id.len() != 14
        || !build_id.bytes().all(|b| b.is_ascii_digit())
    {
        return Err(Error::InvalidProgram);
    }
    Ok(Firefox {
        path,
        version: version.clone(),
        build_id: build_id.clone(),
    })
}

/// Discovery returns unavailable entries as candidates; selection revalidates them.
pub fn profiles(data_root: &Path) -> Result<Vec<Profile>> {
    Ok(scan_profiles(data_root)?.profiles)
}
#[derive(Default)]
pub struct ProfileScan {
    pub profiles: Vec<Profile>,
    pub warnings: Vec<Error>,
}
pub fn scan_profiles(data_root: &Path) -> Result<ProfileScan> {
    paths::no_reparse(data_root)?;
    let mut entries = BTreeMap::<String, Profile>::new();
    let mut warnings = Vec::new();
    for file in ["profiles.ini", "installs.ini"] {
        let contents = match paths::text(&data_root.join(file), INI_LIMIT) {
            Ok(v) => v,
            Err(Error::Missing) => continue,
            Err(e) => {
                warnings.push(e);
                continue;
            }
        };
        let sections = match parse_ini(&contents) {
            Ok(v) => v,
            Err(e) => {
                warnings.push(e);
                continue;
            }
        };
        for (name, section) in sections {
            let profile_section = file == "profiles.ini" && name.starts_with("Profile");
            let candidate = if profile_section {
                section.get("Path")
            } else if file == "installs.ini" || name.starts_with("Install") {
                section.get("Default")
            } else {
                None
            };
            let Some(candidate) = candidate else {
                continue;
            };
            let parsed = (|| -> Result<Profile> {
                let relative = section.get("IsRelative").map(String::as_str);
                if profile_section && !matches!(relative, Some("0" | "1")) {
                    return Err(Error::InvalidData);
                }
                let is_absolute = Path::new(candidate).is_absolute();
                if profile_section
                    && ((relative == Some("0") && !is_absolute)
                        || (relative == Some("1") && is_absolute))
                {
                    return Err(Error::InvalidPath);
                }
                let candidate = if is_absolute {
                    PathBuf::from(candidate)
                } else {
                    data_root.join(candidate)
                };
                let path = paths::absolute(candidate.to_str().ok_or(Error::InvalidPath)?)?;
                let is_default =
                    !profile_section || section.get("Default").map(String::as_str) == Some("1");
                let label = section
                    .get("Name")
                    .cloned()
                    .unwrap_or_else(|| "Firefox profile".to_owned());
                if label.len() > 512 || label.chars().any(char::is_control) {
                    return Err(Error::InvalidData);
                }
                Ok(Profile {
                    path,
                    name: label,
                    is_default,
                })
            })();
            let profile = match parsed {
                Ok(p) => p,
                Err(e) => {
                    warnings.push(e);
                    continue;
                }
            };
            let path = &profile.path;
            let key = paths::key(path);
            if let Some(existing) = entries.get_mut(&key) {
                existing.is_default |= profile.is_default;
            } else if entries.len() == ENTRY_LIMIT {
                warnings.push(Error::LimitExceeded);
                break;
            } else {
                entries.insert(key, profile);
            }
        }
    }
    warnings.sort_by_key(|e| format!("{e:?}"));
    warnings.dedup();
    Ok(ProfileScan {
        profiles: entries.into_values().collect(),
        warnings,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parses_spaces_unicode_and_only_first_equals() {
        let ini =
            parse_ini("\u{feff}[Profile0]\nName=工作 Profile\nPath=Profiles/a=b\nIsRelative=1\n")
                .unwrap();
        assert_eq!(ini[0].1["Name"], "工作 Profile");
        assert_eq!(ini[0].1["Path"], "Profiles/a=b");
    }
    #[test]
    fn ambiguous_and_unbounded_ini_is_rejected() {
        assert!(parse_ini("[App]\nName=Firefox\nName=Other").is_err());
        assert!(parse_ini("[App]\n[App]").is_err());
        assert_eq!(
            parse_ini(&"a".repeat(INI_LIMIT as usize + 1)),
            Err(Error::LimitExceeded)
        );
    }
}
