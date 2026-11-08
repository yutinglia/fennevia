// SPDX-License-Identifier: MPL-2.0
use crate::{
    Error, Result,
    ownership::{self, ENABLED, PROFILE_PREFIX, Scope},
    paths,
};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Path, PathBuf},
    sync::OnceLock,
};

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Manifest {
    pub schema_version: u32,
    pub package_id: String,
    pub package_version: String,
    pub expected_files: Vec<String>,
    pub files: Vec<File>,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct File {
    pub scope: Scope,
    pub path: String,
    pub sha256: String,
}
pub struct Package {
    pub root: PathBuf,
    pub manifest: Manifest,
    pub digest: String,
    pub contents: BTreeMap<(Scope, String), Vec<u8>>,
}
impl Manifest {
    pub fn parse(bytes: &[u8]) -> Result<Self> {
        if bytes.len() > 1024 * 1024 {
            return Err(Error::LimitExceeded);
        }
        let value: Self = serde_json::from_slice(bytes)?;
        if value.schema_version != 1
            || value.package_id != "fennevia"
            || !ownership::valid_version(&value.package_version)
            || value.files.len() > 4096
            || value.expected_files.is_empty()
            || value.expected_files.len() > 4096
        {
            return Err(Error::InvalidData);
        }
        let mut expected = BTreeSet::new();
        for path in &value.expected_files {
            paths::relative(path)?;
            if !expected.insert(path.to_ascii_lowercase()) {
                return Err(Error::InvalidData);
            }
        }
        let mut keys = BTreeSet::new();
        let mut actual = BTreeSet::new();
        let mut program = BTreeSet::new();
        for file in &value.files {
            ownership::approved(file.scope, &file.path)?;
            if !ownership::valid_hash(&file.sha256)
                || !keys.insert((file.scope, file.path.to_ascii_lowercase()))
            {
                return Err(Error::InvalidData);
            }
            match file.scope {
                Scope::Profile => {
                    actual.insert(file.path[PROFILE_PREFIX.len()..].to_ascii_lowercase());
                }
                Scope::Program => {
                    program.insert(file.path.as_str());
                }
            }
        }
        if actual != expected || program != BTreeSet::from([ENABLED, "fennevia.cfg"]) {
            return Err(Error::InvalidData);
        }
        Ok(value)
    }
}
impl Package {
    /// Source-package inspection only. Release-container verification is a separate gate.
    pub fn read(root: &Path) -> Result<Self> {
        let root = paths::absolute(root.to_str().ok_or(Error::InvalidPath)?)?;
        let bytes = paths::bounded_read(&root.join("package-manifest.json"), 1024 * 1024)?;
        let manifest = Manifest::parse(&bytes)?;
        let mut contents = BTreeMap::new();
        let mut total = 0usize;
        for file in &manifest.files {
            let scope = match file.scope {
                Scope::Program => "program",
                Scope::Profile => "profile",
            };
            let source = paths::join(&root.join(scope), &file.path)?;
            let content = paths::bounded_read(&source, paths::MAX_TEXT)?;
            total = total
                .checked_add(content.len())
                .ok_or(Error::LimitExceeded)?;
            if total > 128 * 1024 * 1024 {
                return Err(Error::LimitExceeded);
            }
            if paths::hash(&content) != file.sha256 {
                return Err(Error::Conflict);
            }
            validate_artifact(&file.path, &content)?;
            contents.insert((file.scope, file.path.clone()), content);
        }
        for scope in [Scope::Program, Scope::Profile] {
            let (directory, prefix) = match scope {
                Scope::Program => (root.join("program"), ""),
                Scope::Profile => (root.join("profile/chrome/fennevia"), PROFILE_PREFIX),
            };
            let mut found = BTreeSet::new();
            inventory(&directory, prefix, &mut found, 0)?;
            let expected = manifest
                .files
                .iter()
                .filter(|f| f.scope == scope)
                .map(|f| f.path.clone())
                .collect();
            if found != expected {
                return Err(Error::Conflict);
            }
        }
        Ok(Self {
            root,
            manifest,
            digest: paths::hash(&bytes),
            contents,
        })
    }
}
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
    for (index, entry) in fs::read_dir(root)?.enumerate() {
        if index > 4096 || found.len() >= 4096 {
            return Err(Error::LimitExceeded);
        }
        let entry = entry?;
        paths::no_reparse(&entry.path())?;
        let name = entry
            .file_name()
            .into_string()
            .map_err(|_| Error::InvalidPath)?;
        paths::relative(&name)?;
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
fn validate_artifact(path: &str, bytes: &[u8]) -> Result<()> {
    let extension = path.rsplit('.').next().unwrap_or("");
    if !["cfg", "js", "mjs", "css", "manifest", "txt"].contains(&extension)
        || path
            .split('/')
            .any(|p| ["node_modules", "src", "tests", "test", ".git"].contains(&p))
    {
        return Err(Error::InvalidData);
    }
    let text = std::str::from_utf8(bytes).map_err(|_| Error::InvalidData)?;
    // The production policy permits quoted XML namespace identifiers, never endpoints.
    let mut endpoints = text.to_owned();
    for namespace in [
        "http://www.w3.org/1998/Math/MathML",
        "http://www.w3.org/1999/xhtml",
        "http://www.w3.org/2000/svg",
        "http://www.w3.org/1999/xlink",
        "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
    ] {
        for quote in ['\'', '"', '`'] {
            endpoints = endpoints.replace(&format!("{quote}{namespace}{quote}"), "\"namespace\"");
        }
    }
    static RULES: OnceLock<Vec<Regex>> = OnceLock::new();
    let rules = RULES.get_or_init(|| [
        r"(?i)\b(?:https?|wss?):(?:\\?/){2}|(?:\\?/){2}(?:localhost|127\.0\.0\.1|[a-z0-9.-]+\.[a-z]{2,})[:/\\]",
        r"(?i)\b(?:fetch|WebSocket|EventSource|XMLHttpRequest|importScripts)\s*\(|navigator\.sendBeacon\s*\(",
        r"(?i)/@vite/(?:client|env)|import\.meta\.hot|createHotContext|__VITE_HMR|webpackHotUpdate|module\.hot\b",
        r"(?i)import\.meta\.env\.(?:DEV|MODE)|process\.env\.NODE_ENV|__DEV__|localhost|127\.0\.0\.1|debugger\s*;",
        r"(?i)(?:sourceMappingURL|sourceURL)\s*=|\bimport\s*\(|\beval\s*\(|\bnew\s+Function\s*\(",
    ].iter().map(|p| Regex::new(p).expect("fixed artifact policy regex")).collect());
    for (index, rule) in rules.iter().enumerate() {
        if rule.is_match(if index == 0 { &endpoints } else { text }) {
            return Err(Error::InvalidData);
        }
    }
    static IMPORTS: OnceLock<Regex> = OnceLock::new();
    let imports = IMPORTS.get_or_init(|| {
        Regex::new(r#"(?im)\b(?:import|export)\s+(?:[^'"\r\n]*?\s+from\s*)?["']([^"']+)["']"#)
            .expect("fixed import regex")
    });
    for matched in imports.captures_iter(text) {
        let specifier = &matched[1];
        if !["./", "../", "/", "chrome://", "resource://"]
            .iter()
            .any(|p| specifier.starts_with(p))
        {
            return Err(Error::InvalidData);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_executable_and_network_artifacts() {
        for bytes in [
            b"fetch('/local')".as_slice(),
            b"import('module')",
            b"eval('x')",
            b"https://example.test/x",
            b"import x from 'npm'",
        ] {
            assert!(validate_artifact("content/a.js", bytes).is_err());
        }
        assert!(validate_artifact("content/a.exe", b"binary").is_err());
        assert!(
            validate_artifact("content/a.js", b"const ns = 'http://www.w3.org/2000/svg';").is_ok()
        );
        assert!(
            validate_artifact(
                "content/a.js",
                b"const ns = 'http://www.w3.org/2000/svg/exfil';"
            )
            .is_err()
        );
    }
    #[test]
    fn reads_repository_package_without_mutation() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR"))
            .ancestors()
            .nth(3)
            .unwrap();
        let manifest =
            Manifest::parse(&std::fs::read(root.join("package-manifest.json")).unwrap()).unwrap();
        for file in &manifest.files {
            let scope = if file.scope == Scope::Program {
                "program"
            } else {
                "profile"
            };
            let bytes = std::fs::read(root.join(scope).join(&file.path)).unwrap();
            assert!(
                validate_artifact(&file.path, &bytes).is_ok(),
                "artifact policy: {}",
                file.path
            );
        }
        let package = Package::read(root).unwrap();
        assert_eq!(package.contents.len(), package.manifest.files.len());
    }
}
