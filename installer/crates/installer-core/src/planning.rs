// SPDX-License-Identifier: MPL-2.0
//! Read-only lifecycle planning. A Preview is never authority to write files.
use crate::{
    Error, Result,
    ownership::{
        self, DISABLED, Directory, ENABLED, OWNERSHIP, OwnedFile, Ownership, Pair, Roots, Scope,
        State,
    },
    package::Package,
    paths,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
};
use uuid::Uuid;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Action {
    Install,
    Update,
    Repair,
    Disable,
    Enable,
    Uninstall,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub enum Kind {
    CreateDirectory,
    CreateFile,
    ReplaceFile,
    RemoveFile,
    MoveFile,
    RemoveDirectoryIfEmpty,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Operation {
    pub kind: Kind,
    pub scope: Scope,
    pub path: String,
    pub destination_path: String,
    pub expected_hash: String,
    pub existing_hash: String,
    #[serde(skip)]
    pub content: Option<Vec<u8>>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Preview {
    pub action: Action,
    pub state: State,
    pub version: Option<String>,
    pub operations: Vec<Operation>,
    pub digest: String,
    pub executable: bool,
}
fn op(kind: Kind, scope: Scope, path: &str) -> Operation {
    Operation {
        kind,
        scope,
        path: path.into(),
        destination_path: String::new(),
        expected_hash: String::new(),
        existing_hash: String::new(),
        content: None,
    }
}
fn absent(roots: &Roots, scope: Scope, path: &str) -> Result<()> {
    if roots.resolve(scope, path)?.try_exists()? {
        return Err(Error::Conflict);
    }
    Ok(())
}
fn complete(pair: &Pair) -> Result<&Ownership> {
    if pair.present != [true, true] {
        return Err(Error::Conflict);
    }
    pair.record.as_ref().ok_or(Error::Missing)
}
fn desired(package: &Package, state: State) -> Vec<OwnedFile> {
    let mut files: Vec<_> = package
        .manifest
        .files
        .iter()
        .map(|f| OwnedFile {
            scope: f.scope,
            path: f.path.clone(),
            installed_path: if f.scope == Scope::Program
                && f.path == ENABLED
                && state == State::Disabled
            {
                DISABLED.into()
            } else {
                f.path.clone()
            },
            sha256: f.sha256.clone(),
        })
        .collect();
    files.sort_by(|a, b| (a.scope, &a.path).cmp(&(b.scope, &b.path)));
    files
}
fn directories(roots: &Roots, files: &[OwnedFile]) -> Result<Vec<Directory>> {
    let mut found = BTreeSet::new();
    for file in files {
        let mut parent = file.installed_path.as_str();
        while let Some((path, _)) = parent.rsplit_once('/') {
            let full = roots.resolve(file.scope, path)?;
            if full.try_exists()? {
                if !full.is_dir() {
                    return Err(Error::Conflict);
                }
            } else {
                found.insert(Directory {
                    scope: file.scope,
                    path: path.into(),
                });
            }
            parent = path;
        }
    }
    let mut found: Vec<_> = found.into_iter().collect();
    found.sort_by_key(|d| (d.path.matches('/').count(), d.scope, d.path.clone()));
    Ok(found)
}
fn foreign_autoconfig(roots: &Roots, record: Option<&Ownership>) -> Result<()> {
    let owned = record.is_some_and(|r| {
        r.files
            .iter()
            .any(|f| f.scope == Scope::Program && f.installed_path == ENABLED)
    });
    let folder = roots.resolve(Scope::Program, "defaults/pref")?;
    for (index, entry) in fs::read_dir(folder)?.enumerate() {
        if index >= 4096 {
            return Err(Error::LimitExceeded);
        }
        let entry = entry?;
        let name = entry.file_name();
        if !name.to_string_lossy().to_ascii_lowercase().ends_with(".js")
            || (owned && name == "fennevia.js")
        {
            continue;
        }
        let text = paths::text(&entry.path(), paths::MAX_TEXT)?;
        if text.to_lowercase().contains("general.config.filename") {
            return Err(Error::Conflict);
        }
    }
    Ok(())
}
fn write_file(
    operations: &mut Vec<Operation>,
    scope: Scope,
    path: &str,
    bytes: Vec<u8>,
    old: Option<&str>,
) {
    let mut item = op(
        if old.is_some() {
            Kind::ReplaceFile
        } else {
            Kind::CreateFile
        },
        scope,
        path,
    );
    item.expected_hash = paths::hash(&bytes);
    item.existing_hash = old.unwrap_or("").into();
    item.content = Some(bytes);
    operations.push(item);
}
fn metadata(
    roots: &Roots,
    pair: &Pair,
    record: &Ownership,
    operations: &mut Vec<Operation>,
    scopes: &[Scope],
) -> Result<()> {
    record.validate()?;
    if pair.record.as_ref() == Some(record) && pair.present == [true, true] {
        return Ok(());
    }
    let bytes = if pair.record.as_ref() == Some(record) {
        pair.bytes.clone().ok_or(Error::InvalidData)?
    } else {
        serde_json::to_vec_pretty(record)?
    };
    for &scope in scopes {
        let present = pair.present[if scope == Scope::Program { 0 } else { 1 }];
        if !present {
            absent(roots, scope, ".fennevia")?;
            operations.push(op(Kind::CreateDirectory, scope, ".fennevia"));
        }
        let old = if present {
            pair.bytes.as_ref().map(|b| paths::hash(b))
        } else {
            None
        };
        write_file(operations, scope, OWNERSHIP, bytes.clone(), old.as_deref());
    }
    Ok(())
}
fn matches_package(record: &Ownership, package: &Package) -> bool {
    let mut actual = record.files.clone();
    actual.sort_by(|a, b| (a.scope, &a.path).cmp(&(b.scope, &b.path)));
    record.source_manifest_sha256 == package.digest
        && record.package_version == package.manifest.package_version
        && actual == desired(package, record.state)
}

pub fn preview(
    roots: &Roots,
    action: Action,
    package: Option<&Package>,
    installation_id: Uuid,
) -> Result<Preview> {
    if let Some(package) = package {
        for root in [&roots.program, &roots.profile] {
            if paths::same(root, &package.root)
                || paths::within(root, &package.root)
                || paths::within(&package.root, root)
            {
                return Err(Error::OverlappingRoots);
            }
        }
    }
    let pair = roots.read_ownership()?;
    let mut operations = Vec::new();
    let mut state = pair
        .record
        .as_ref()
        .map(|r| r.state)
        .unwrap_or(State::Enabled);
    let mut version = pair.record.as_ref().map(|r| r.package_version.clone());
    match action {
        Action::Install | Action::Update => {
            let package = package.ok_or(Error::Missing)?;
            if action == Action::Update {
                complete(&pair)?;
            }
            if pair.record.is_some() {
                complete(&pair)?;
            }
            if action == Action::Install && pair.record.is_none() {
                // Refuse an existing unowned package directory, even with no colliding file names.
                ownership::status(roots)?;
            }
            if state == State::Enabled {
                foreign_autoconfig(roots, pair.record.as_ref())?;
            }
            absent(
                roots,
                Scope::Program,
                if state == State::Enabled {
                    DISABLED
                } else {
                    ENABLED
                },
            )?;
            let mut old = BTreeMap::new();
            if let Some(record) = &pair.record {
                for file in &record.files {
                    old.insert(
                        (file.scope, file.path.clone()),
                        (file, roots.verify_file(file, action == Action::Update)?),
                    );
                }
                if action == Action::Install && !matches_package(record, package) {
                    return Err(Error::Conflict);
                }
            }
            let files = desired(package, state);
            let dirs = directories(roots, &files)?;
            for dir in &dirs {
                operations.push(op(Kind::CreateDirectory, dir.scope, &dir.path));
            }
            for ((scope, path), (file, exists)) in &old {
                if *exists && !files.iter().any(|f| f.scope == *scope && &f.path == path) {
                    let mut item = op(Kind::RemoveFile, *scope, &file.installed_path);
                    item.expected_hash = file.sha256.clone();
                    operations.push(item);
                }
            }
            for file in &files {
                let existing = old.get(&(file.scope, file.path.clone()));
                let previous = match existing {
                    Some((old_file, true)) => {
                        if old_file.installed_path != file.installed_path {
                            return Err(Error::Conflict);
                        }
                        if old_file.sha256 == file.sha256 {
                            continue;
                        }
                        Some(old_file.sha256.as_str())
                    }
                    _ => {
                        absent(roots, file.scope, &file.installed_path)?;
                        None
                    }
                };
                let bytes = package
                    .contents
                    .get(&(file.scope, file.path.clone()))
                    .ok_or(Error::InvalidData)?
                    .clone();
                write_file(
                    &mut operations,
                    file.scope,
                    &file.installed_path,
                    bytes,
                    previous,
                );
            }
            let mut created: BTreeSet<_> = pair
                .record
                .as_ref()
                .map(|r| r.created_directories.iter().cloned().collect())
                .unwrap_or_default();
            created.extend(dirs.into_iter().filter(|d| d.scope == Scope::Profile));
            let record = Ownership {
                schema_version: 1,
                owner: "fennevia".into(),
                package_id: "fennevia".into(),
                installation_id: pair
                    .record
                    .as_ref()
                    .map(|r| r.installation_id)
                    .unwrap_or(installation_id),
                package_version: package.manifest.package_version.clone(),
                state,
                source_manifest_sha256: package.digest.clone(),
                files,
                created_directories: created.into_iter().collect(),
            };
            metadata(
                roots,
                &pair,
                &record,
                &mut operations,
                &[Scope::Program, Scope::Profile],
            )?;
            version = Some(record.package_version);
        }
        Action::Disable | Action::Enable => {
            let record = complete(&pair)?;
            let next = if action == Action::Disable {
                State::Disabled
            } else {
                State::Enabled
            };
            if next != state {
                if action == Action::Enable {
                    let package = package.ok_or(Error::Missing)?;
                    if !matches_package(record, package) {
                        return Err(Error::Conflict);
                    }
                    for file in &record.files {
                        roots.verify_file(file, false)?;
                    }
                    foreign_autoconfig(roots, Some(record))?;
                }
                let mut record = record.clone();
                let preference = record
                    .files
                    .iter_mut()
                    .find(|f| f.scope == Scope::Program && f.path == ENABLED)
                    .ok_or(Error::InvalidData)?;
                let exists = roots.verify_file(preference, action == Action::Disable)?;
                let target = if next == State::Disabled {
                    DISABLED
                } else {
                    ENABLED
                };
                absent(roots, Scope::Program, target)?;
                if exists {
                    let mut item = op(Kind::MoveFile, Scope::Program, &preference.installed_path);
                    item.destination_path = target.into();
                    item.expected_hash = preference.sha256.clone();
                    operations.push(item);
                }
                preference.installed_path = target.into();
                record.state = next;
                metadata(
                    roots,
                    &pair,
                    &record,
                    &mut operations,
                    &[Scope::Program, Scope::Profile],
                )?;
                state = next;
            }
        }
        Action::Repair => {
            let record = pair.record.as_ref().ok_or(Error::Missing)?;
            if pair.present == [true, true] {
                for file in &record.files {
                    roots.verify_file(file, false)?;
                }
            } else {
                let package = package.ok_or(Error::Missing)?;
                if !matches_package(record, package) {
                    return Err(Error::Conflict);
                }
                let missing = if pair.present[0] {
                    Scope::Profile
                } else {
                    Scope::Program
                };
                let files: Vec<_> = record
                    .files
                    .iter()
                    .filter(|f| f.scope == missing)
                    .cloned()
                    .collect();
                if files.is_empty() || !record.files.iter().any(|f| f.scope != missing) {
                    return Err(Error::InvalidData);
                }
                for file in record.files.iter().filter(|f| f.scope != missing) {
                    roots.verify_file(file, false)?;
                }
                for file in &files {
                    absent(roots, file.scope, &file.installed_path)?;
                }
                if missing == Scope::Profile {
                    absent(roots, missing, "chrome/fennevia")?;
                } else {
                    absent(
                        roots,
                        missing,
                        if state == State::Enabled {
                            DISABLED
                        } else {
                            ENABLED
                        },
                    )?;
                    if state == State::Enabled {
                        foreign_autoconfig(roots, None)?;
                    }
                }
                for dir in directories(roots, &files)? {
                    if !record.created_directories.contains(&dir) {
                        return Err(Error::Conflict);
                    }
                    operations.push(op(Kind::CreateDirectory, dir.scope, &dir.path));
                }
                for file in &files {
                    write_file(
                        &mut operations,
                        file.scope,
                        &file.installed_path,
                        package.contents[&(file.scope, file.path.clone())].clone(),
                        None,
                    );
                }
                metadata(roots, &pair, record, &mut operations, &[missing])?;
            }
        }
        Action::Uninstall => {
            if let Some(record) = &pair.record {
                for file in &record.files {
                    if roots.verify_file(file, true)? {
                        let mut item = op(Kind::RemoveFile, file.scope, &file.installed_path);
                        item.expected_hash = file.sha256.clone();
                        operations.push(item);
                    }
                }
                for (index, scope) in [Scope::Program, Scope::Profile].into_iter().enumerate() {
                    if pair.present[index] {
                        let mut item = op(Kind::RemoveFile, scope, OWNERSHIP);
                        item.expected_hash =
                            paths::hash(pair.bytes.as_ref().ok_or(Error::InvalidData)?);
                        operations.push(item);
                        operations.push(op(Kind::RemoveDirectoryIfEmpty, scope, ".fennevia"));
                    }
                }
                let mut dirs = record.created_directories.clone();
                dirs.sort_by_key(|d| std::cmp::Reverse(d.path.matches('/').count()));
                for dir in dirs {
                    roots.resolve(dir.scope, &dir.path)?;
                    operations.push(op(Kind::RemoveDirectoryIfEmpty, dir.scope, &dir.path));
                }
            } else {
                ownership::status(roots)?;
            }
        }
    }
    let mut preview = Preview {
        action,
        state,
        version,
        operations,
        digest: String::new(),
        executable: false,
    };
    // Absolute roots enter the private digest only, never the renderer's operation list.
    let identity = serde_json::to_vec(&(
        paths::key(&roots.program),
        paths::key(&roots.profile),
        pair.bytes.as_ref().map(|b| paths::hash(b)),
        package.map(|p| &p.digest),
        &preview,
    ))?;
    preview.digest = paths::hash(&identity);
    Ok(preview)
}
