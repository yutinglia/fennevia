// SPDX-License-Identifier: MPL-2.0
//! Extracted release validation. Hashes establish integrity, not publisher identity.
use crate::{
    Error, Result,
    ownership::{Scope, valid_hash, valid_version},
    package::Package,
    paths,
};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{collections::BTreeSet, fs, io::Read, path::Path};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Manifest {
    schema_version: u32,
    package_id: String,
    license: String,
    version: String,
    tag: String,
    prerelease: bool,
    source: Source,
    release: Artifact,
    package_manifest_sha256: String,
    firefox_compatibility: Vec<Compatibility>,
    compatibility_record: String,
    known_limitations: Vec<String>,
    files: Vec<File>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Source {
    repository: String,
    commit: String,
    archive: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Artifact {
    archive: String,
    checksum: String,
    platform: String,
    tested_architecture: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Compatibility {
    version: String,
    build_id: String,
    channel: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct File {
    pub path: String,
    pub sha256: String,
    pub size: u64,
}

const STATIC: &[&str] = &[
    "INSTALL.md",
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
    "FenneviaSetup.exe",
    "package-manifest.json",
    "scripts/fennevia.ps1",
    "scripts/fennevia-gui.ps1",
    "scripts/fennevia-package.ps1",
    "scripts/verify-release.ps1",
    "scripts/gui/FenneviaSetup.cs",
    "scripts/lib/FenneviaConsole.psm1",
    "scripts/lib/FenneviaGui.psm1",
    "scripts/lib/FenneviaTui.psm1",
    "scripts/lib/FenneviaInstaller.psm1",
    "scripts/lib/FenneviaRelease.psm1",
    "scripts/lib/SecurityChecks.psm1",
    "scripts/lib/installer/Common.ps1",
    "scripts/lib/installer/Discovery.ps1",
    "scripts/lib/installer/Ownership.ps1",
    "scripts/lib/installer/Planning.ps1",
    "scripts/lib/installer/Transaction.ps1",
    "scripts/lib/installer/Public.ps1",
];
const LOCATIONS: &[&str] = &[
    "scripts/lib/FenneviaLocations.psm1",
    "scripts/lib/ConsoleLocations.ps1",
];

pub fn file_hash(path: &Path, size: u64) -> Result<String> {
    paths::no_reparse(path)?;
    if size > 512 * 1024 * 1024 {
        return Err(Error::LimitExceeded);
    }
    let mut file = fs::File::open(path)?;
    if !file.metadata()?.is_file() || file.metadata()?.len() != size {
        return Err(Error::Conflict);
    }
    let mut hash = Sha256::new();
    let mut buffer = [0u8; 65536];
    let mut read = 0u64;
    loop {
        let count = file.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        read += count as u64;
        if read > size {
            return Err(Error::Conflict);
        }
        hash.update(&buffer[..count]);
    }
    if read != size {
        return Err(Error::Conflict);
    }
    Ok(hash
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

pub fn validate(package: &Package) -> Result<String> {
    for required in [
        "chrome/fennevia/chrome.manifest",
        "chrome/fennevia/content/Bootstrap.sys.mjs",
    ] {
        if !package
            .manifest
            .files
            .iter()
            .any(|f| f.scope == Scope::Profile && f.path == required)
        {
            return Err(Error::InvalidData);
        }
    }
    let root = &package.root;
    let bytes = paths::bounded_read(&root.join("RELEASE-MANIFEST.json"), 4 * 1024 * 1024)?;
    let manifest: Manifest = serde_json::from_slice(&bytes)?;
    let version = &manifest.version;
    let repository = "https://github.com/yutinglia/fennevia";
    let archive = format!("fennevia-{version}-windows.zip");
    if manifest.schema_version != 1
        || manifest.package_id != "fennevia"
        || manifest.license != "MPL-2.0"
        || !valid_version(version)
        || version != &package.manifest.package_version
        || manifest.tag != format!("v{version}")
        || manifest.prerelease != version.contains('-')
        || manifest.source.repository != repository
        || manifest.source.commit.len() != 40
        || !manifest
            .source
            .commit
            .bytes()
            .all(|v| v.is_ascii_digit() || (b'a'..=b'f').contains(&v))
        || manifest.source.archive != format!("{repository}/archive/refs/tags/v{version}.zip")
        || manifest.release.archive != archive
        || manifest.release.checksum != format!("{archive}.sha256")
        || manifest.release.platform != "windows"
        || manifest.release.tested_architecture != "x64"
        || manifest.package_manifest_sha256 != package.digest
        || manifest.firefox_compatibility.is_empty()
        || manifest.firefox_compatibility.len() > 256
        || manifest.known_limitations.is_empty()
        || manifest.known_limitations.len() > 256
        || manifest
            .known_limitations
            .iter()
            .any(|v| v.is_empty() || v.len() > 8192)
    {
        return Err(Error::InvalidData);
    }
    paths::relative(&manifest.compatibility_record)?;
    if !manifest.compatibility_record.starts_with("docs/research/")
        || !manifest.compatibility_record.ends_with(".md")
    {
        return Err(Error::InvalidData);
    }
    let mut compatibility = BTreeSet::new();
    for item in manifest.firefox_compatibility {
        let segments: Vec<_> = item.version.split('.').collect();
        if !(2..=4).contains(&segments.len())
            || segments
                .iter()
                .any(|p| p.is_empty() || !p.bytes().all(|b| b.is_ascii_digit()))
            || item.build_id.len() != 14
            || !item.build_id.bytes().all(|b| b.is_ascii_digit())
            || item.channel != "release"
            || !compatibility.insert((item.version, item.build_id))
        {
            return Err(Error::InvalidData);
        }
    }
    let mut expected: BTreeSet<String> = STATIC.iter().map(|p| (*p).into()).collect();
    if LOCATIONS.iter().any(|p| root.join(p).exists()) {
        expected.extend(LOCATIONS.iter().map(|p| (*p).into()));
    }
    if root.join("scripts/lib/NativeDistribution.ps1").exists() {
        expected.insert("scripts/lib/NativeDistribution.ps1".into());
    }
    for item in &package.manifest.files {
        let scope = if item.scope == Scope::Program {
            "program"
        } else {
            "profile"
        };
        if !expected.insert(format!("{scope}/{}", item.path)) {
            return Err(Error::InvalidData);
        }
    }
    if root.join("INSTALLER-MANIFEST.json").try_exists()? {
        expected.insert("INSTALLER-MANIFEST.json".into());
        expected.extend(crate::distribution::validate(root)?);
    }
    if manifest.files.len() != expected.len() {
        return Err(Error::Conflict);
    }
    let mut recorded = BTreeSet::new();
    let mut total = 0u64;
    for item in manifest.files {
        if !expected.contains(&item.path)
            || !recorded.insert(item.path.clone())
            || !valid_hash(&item.sha256)
        {
            return Err(Error::InvalidData);
        }
        total = total.checked_add(item.size).ok_or(Error::LimitExceeded)?;
        if total > 2 * 1024 * 1024 * 1024 {
            return Err(Error::LimitExceeded);
        }
        let path = release_path(root, &item.path)?;
        if file_hash(&path, item.size)? != item.sha256 {
            return Err(Error::Conflict);
        }
        text_policy(&path, &item.path)?;
    }
    text_policy(&root.join("RELEASE-MANIFEST.json"), "RELEASE-MANIFEST.json")?;
    expected.insert("RELEASE-MANIFEST.json".into());
    let mut actual = BTreeSet::new();
    crate::distribution::inventory(root, "", &mut actual, 0)?;
    if actual != expected {
        return Err(Error::Conflict);
    }
    Ok(paths::hash(&bytes))
}

fn text_policy(path: &Path, name: &str) -> Result<()> {
    static NAMES: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
    if NAMES.get_or_init(|| regex::Regex::new(r"(?i)(^|/)(?:\.env(?:\.|$)|id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?$|credentials?(?:\.json)?$|secrets?(?:\.|$)|[^/]+\.(?:pfx|p12|pem|key)$)").expect("fixed credential name pattern")).is_match(name) { return Err(Error::InvalidData); }
    let extension = path
        .extension()
        .and_then(|v| v.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if name != "LICENSE"
        && ![
            "cfg", "cs", "css", "html", "js", "json", "manifest", "md", "mjs", "ps1", "psm1",
            "txt", "xhtml",
        ]
        .contains(&extension.as_str())
    {
        return Ok(());
    }
    let bytes = paths::bounded_read(path, paths::MAX_TEXT)?;
    let text = std::str::from_utf8(&bytes).map_err(|_| Error::InvalidData)?;
    static PATTERNS: std::sync::OnceLock<Vec<regex::Regex>> = std::sync::OnceLock::new();
    let patterns = PATTERNS.get_or_init(|| {
        [
            r"(?i)-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----",
            r"(?i)github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}",
            r"(?i)AKIA[0-9A-Z]{16}",
            r"(?i)\b[A-Z]:[\\/](?:Users|works)[\\/]",
        ]
        .iter()
        .map(|v| regex::Regex::new(v).expect("fixed release pattern"))
        .collect()
    });
    if patterns.iter().any(|p| p.is_match(text)) {
        return Err(Error::InvalidData);
    }
    Ok(())
}

/// Microsoft ships this exact directory with spaces. Only the release container
/// accepts it; installed Firefox/ownership paths retain the original grammar.
pub(crate) fn release_path(root: &Path, name: &str) -> Result<std::path::PathBuf> {
    let checked = name.replacen(
        "WebView2/Trust Protection Lists/",
        "WebView2/TrustProtectionLists/",
        1,
    );
    paths::relative(&checked)?;
    let path = root.join(name);
    if !paths::within(&path, root) {
        return Err(Error::InvalidPath);
    }
    paths::no_reparse(&path)?;
    Ok(path)
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    #[test]
    fn fixed_runtime_paths_do_not_relax_installed_path_rules() {
        let root = Path::new("C:/fennevia-nonexistent-fixture");
        let name = "WebView2/Trust Protection Lists/Mu/Advertising";
        assert!(release_path(root, name).is_ok());
        assert!(paths::relative(name).is_err());
        for invalid in [
            "WebView2/Other Folder/a",
            "WebView2/Trust Protection Lists/../a",
            "WebView2/Trust Protection Lists/a:key",
            "../WebView2/Trust Protection Lists/a",
            "WebView2/Trust Protection Lists/CON",
        ] {
            assert!(release_path(root, invalid).is_err(), "{invalid}");
        }
        let pin: serde_json::Value =
            serde_json::from_str(include_str!("../../../runtime/webview2.json")).unwrap();
        for file in pin["files"].as_array().unwrap() {
            assert!(release_path(root, file["path"].as_str().unwrap()).is_ok());
        }
    }
}
