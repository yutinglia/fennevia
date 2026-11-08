// SPDX-License-Identifier: MPL-2.0
use crate::{
    Error, Result, paths,
    release::{File, file_hash},
};
use serde::Deserialize;
use std::{
    collections::{BTreeMap, BTreeSet},
    path::Path,
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Distribution {
    schema_version: u32,
    platform: String,
    architecture: String,
    webview2_version: String,
    files: Vec<File>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Runtime {
    version: String,
    architecture: String,
    source: String,
    sha256: String,
    files: Vec<File>,
}

/// The runtime inventory comes from the reviewed, committed Microsoft CAB pin.
/// Native application hashes are covered by the release checksum, not a signature.
pub fn validate(root: &Path) -> Result<BTreeSet<String>> {
    let runtime: Runtime = serde_json::from_str(include_str!("../../../runtime/webview2.json"))?;
    let manifest: Distribution = serde_json::from_slice(&paths::bounded_read(
        &root.join("INSTALLER-MANIFEST.json"),
        1024 * 1024,
    )?)?;
    if manifest.schema_version != 1
        || manifest.platform != "windows"
        || manifest.architecture != "x64"
        || manifest.webview2_version != runtime.version
        || runtime.architecture != "x64"
        || !runtime
            .source
            .starts_with("https://msedge.sf.dl.delivery.mp.microsoft.com/")
        || !crate::ownership::valid_hash(&runtime.sha256)
    {
        return Err(Error::InvalidData);
    }
    let pinned: BTreeMap<_, _> = runtime.files.iter().map(|f| (f.path.clone(), f)).collect();
    let mut expected: BTreeSet<String> = pinned.keys().cloned().collect();
    expected.extend(
        [
            "FenneviaSetup.exe",
            "fennevia-installer-worker.exe",
            "INSTALLER-NOTICES.txt",
            "WEBVIEW2-LICENSE.txt",
            "WEBVIEW2-INVENTORY.json",
        ]
        .map(String::from),
    );
    if manifest.files.len() != expected.len() {
        return Err(Error::InvalidData);
    }
    if paths::bounded_read(&root.join("WEBVIEW2-INVENTORY.json"), 1024 * 1024)?
        != include_bytes!("../../../runtime/webview2.json")
    {
        return Err(Error::Conflict);
    }
    let mut seen = BTreeSet::new();
    for file in manifest.files {
        if !expected.contains(&file.path)
            || !seen.insert(file.path.clone())
            || !crate::ownership::valid_hash(&file.sha256)
            || pinned
                .get(&file.path)
                .is_some_and(|pin| pin.sha256 != file.sha256 || pin.size != file.size)
        {
            return Err(Error::InvalidData);
        }
        if file_hash(&crate::release::release_path(root, &file.path)?, file.size)? != file.sha256 {
            return Err(Error::Conflict);
        }
    }
    // Do not allow the runtime to load unrecorded DLLs or extension files.
    let mut actual = BTreeSet::new();
    inventory(&root.join("WebView2"), "WebView2/", &mut actual, 0)?;
    if actual != pinned.keys().cloned().collect() {
        return Err(Error::Conflict);
    }
    Ok(expected)
}

// Inventory is compared with an exact allowlist by both callers. Do not use this
// broader traversal for installed Firefox/ownership paths.
pub(crate) fn inventory(
    root: &Path,
    prefix: &str,
    found: &mut BTreeSet<String>,
    depth: usize,
) -> Result<()> {
    if depth > 32 {
        return Err(Error::LimitExceeded);
    }
    paths::no_reparse(root)?;
    for (index, entry) in std::fs::read_dir(root)?.enumerate() {
        if index > 4096 || found.len() >= 4096 {
            return Err(Error::LimitExceeded);
        }
        let entry = entry?;
        paths::no_reparse(&entry.path())?;
        let name = entry
            .file_name()
            .into_string()
            .map_err(|_| Error::InvalidPath)?;
        let relative = format!("{prefix}{name}");
        if entry.file_type()?.is_dir() {
            inventory(&entry.path(), &(relative + "/"), found, depth + 1)?;
        } else if entry.file_type()?.is_file() {
            found.insert(relative);
        } else {
            return Err(Error::InvalidPath);
        }
    }
    Ok(())
}
