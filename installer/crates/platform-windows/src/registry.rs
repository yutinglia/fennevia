// SPDX-License-Identifier: MPL-2.0
use fennevia_installer_core::{
    Error, Result,
    discovery::{self, Firefox, Profile},
    paths,
};
use serde::Serialize;
use std::{collections::BTreeMap, path::PathBuf};
use winreg::{RegKey, enums::*};

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Inventory {
    pub programs: Vec<Firefox>,
    pub profiles: Vec<Profile>,
    pub warnings: Vec<Error>,
}
pub fn data_root() -> Result<PathBuf> {
    let appdata = std::env::var("APPDATA").map_err(|_| Error::Missing)?;
    Ok(paths::absolute(&appdata)?.join("Mozilla/Firefox"))
}
pub fn broad_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    for name in [
        "USERPROFILE",
        "APPDATA",
        "LOCALAPPDATA",
        "PROGRAMDATA",
        "ProgramFiles",
        "ProgramFiles(x86)",
        "SystemRoot",
    ] {
        if let Ok(value) = std::env::var(name)
            && let Ok(root) = paths::absolute(&value)
        {
            roots.push(root.clone());
            if name.ends_with("APPDATA") {
                roots.push(root.join("Mozilla/Firefox"));
                roots.push(root.join("Mozilla/Firefox/Profiles"));
            }
        }
    }
    roots
}
pub fn scan() -> Result<Inventory> {
    let mut result = Inventory::default();
    let mut paths_to_try = Vec::new();
    for hive in [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE] {
        for view in [KEY_WOW64_64KEY, KEY_WOW64_32KEY] {
            let key = match RegKey::predef(hive)
                .open_subkey_with_flags("SOFTWARE\\Mozilla\\Mozilla Firefox", KEY_READ | view)
            {
                Ok(key) => key,
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => continue,
                Err(_) => {
                    result.warnings.push(Error::AccessDenied);
                    continue;
                }
            };
            for (index, item) in key.enum_keys().enumerate() {
                if index >= 256 {
                    result.warnings.push(Error::LimitExceeded);
                    break;
                }
                let name = match item {
                    Ok(v) => v,
                    Err(_) => {
                        result.warnings.push(Error::AccessDenied);
                        continue;
                    }
                };
                match key
                    .open_subkey_with_flags(format!("{name}\\Main"), KEY_READ | view)
                    .and_then(|main| main.get_value::<String, _>("PathToExe"))
                {
                    Ok(path) => paths_to_try.push(PathBuf::from(path)),
                    Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                    Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => {
                        result.warnings.push(Error::AccessDenied)
                    }
                    Err(_) => result.warnings.push(Error::InvalidData),
                }
            }
        }
    }
    for name in ["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"] {
        if let Ok(root) = std::env::var(name) {
            paths_to_try.push(PathBuf::from(root).join("Mozilla Firefox/firefox.exe"));
        }
    }
    let mut unique = BTreeMap::new();
    for path in paths_to_try {
        match discovery::firefox(&path) {
            Ok(program) => {
                unique.insert(paths::key(&program.path), program);
            }
            Err(Error::Missing | Error::InvalidProgram) => {}
            Err(e) => result.warnings.push(e),
        }
    }
    result.programs = unique.into_values().collect();
    match discovery::scan_profiles(&data_root()?) {
        Ok(scan) => {
            result.profiles = scan.profiles;
            result.warnings.extend(scan.warnings);
        }
        Err(e) => result.warnings.push(e),
    }
    result.warnings.sort_by_key(|e| format!("{e:?}"));
    result.warnings.dedup();
    Ok(result)
}
