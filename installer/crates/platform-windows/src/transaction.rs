// SPDX-License-Identifier: MPL-2.0
//! Same-volume staging and undo, retaining PS-compatible journals on interruption.
use crate::{
    handles::{DirectoryPins, HeldFile},
    security::Lock,
};
use fennevia_installer_core::{
    Error, Result,
    ownership::{OWNERSHIP, Roots, Scope},
    paths,
    planning::{Kind, Preview},
};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeSet,
    fs,
    io::Write,
    path::{Path, PathBuf},
};
use uuid::Uuid;
#[cfg(test)]
#[path = "transaction_tests.rs"]
mod tests;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Outcome {
    pub state: String,
    pub mutations: usize,
    pub error: Option<Error>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Progress {
    pub phase: Phase,
    pub completed: usize,
    pub total: usize,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Phase {
    Preparing,
    Applying,
    RollingBack,
    Finishing,
}
struct Area {
    scope: Scope,
    path: PathBuf,
    files: Vec<PathBuf>,
}
enum Undo {
    NewFile(PathBuf, String),
    OldFile(PathBuf, PathBuf, String),
    Move(PathBuf, PathBuf, String),
    NewDir(PathBuf),
    RemovedDir(PathBuf, PathBuf),
}
fn put(path: &Path, bytes: &[u8]) -> Result<()> {
    paths::no_reparse(path)?;
    let mut file = HeldFile::create(path, false, false)?.0;
    file.write_all(bytes)?;
    file.sync_all()?;
    Ok(())
}
fn approved(kind: Kind, scope: Scope, path: &str) -> Result<()> {
    paths::relative(path)?;
    if matches!(kind, Kind::CreateDirectory | Kind::RemoveDirectoryIfEmpty) {
        if path == ".fennevia"
            || (scope == Scope::Profile
                && (path == "chrome"
                    || path == "chrome/fennevia"
                    || path.starts_with("chrome/fennevia/")))
        {
            return Ok(());
        }
        return Err(Error::InvalidPath);
    }
    if path == OWNERSHIP {
        Ok(())
    } else {
        fennevia_installer_core::ownership::approved(scope, path)
    }
}
fn held(path: &Path, hash: &str) -> Result<HeldFile> {
    let mut file = HeldFile::open(path, false, true)?;
    if paths::hash(&file.bytes(paths::MAX_TEXT)?) != hash {
        return Err(Error::Conflict);
    }
    Ok(file)
}
fn cleanup(areas: &[Area], pins: &mut DirectoryPins) -> Result<()> {
    for area in areas {
        for path in area.files.iter().rev() {
            paths::no_reparse(path)?;
            if path.try_exists()? {
                HeldFile::open(path, fs::symlink_metadata(path)?.is_dir(), true)?.remove()?;
            }
        }
        pins.release(&area.path);
        HeldFile::open(&area.path, true, true)?.remove()?;
    }
    Ok(())
}
fn undo(items: &mut Vec<Undo>, pins: &mut DirectoryPins) -> Result<()> {
    let mut failure = false;
    while let Some(item) = items.pop() {
        let restored = (|| -> Result<()> {
            match item {
                Undo::NewFile(path, hash) => {
                    held(&path, &hash)?.remove()?;
                }
                Undo::OldFile(path, backup, hash) => {
                    let file = held(&backup, &hash)?;
                    file.rename(&path)?;
                }
                Undo::Move(from, to, hash) => {
                    let file = held(&to, &hash)?;
                    file.rename(&from)?;
                }
                Undo::NewDir(path) => {
                    pins.release(&path);
                    HeldFile::open(&path, true, true)?.remove()?;
                }
                Undo::RemovedDir(path, stash) => {
                    HeldFile::open(&stash, true, true)?.rename(&path)?;
                    pins.pin(&path)?;
                }
            }
            Ok(())
        })();
        if restored.is_err() {
            failure = true;
        }
    }
    if failure {
        Err(Error::RollbackIncomplete)
    } else {
        Ok(())
    }
}

/// Caller supplies a fresh backend-only plan builder; no deserialized operations.
pub fn execute(
    roots: &Roots,
    digest: &str,
    rebuild: impl FnOnce() -> Result<Preview>,
) -> Result<Outcome> {
    execute_inner(roots, digest, rebuild, |_| Ok(()))
}
pub fn execute_report(
    roots: &Roots,
    digest: &str,
    rebuild: impl FnOnce() -> Result<Preview>,
    acknowledge: impl FnOnce(&Outcome) -> Result<()>,
) -> Result<Outcome> {
    execute_progress(roots, digest, rebuild, acknowledge, |_| {})
}
pub fn execute_progress(
    roots: &Roots,
    digest: &str,
    rebuild: impl FnOnce() -> Result<Preview>,
    acknowledge: impl FnOnce(&Outcome) -> Result<()>,
    progress: impl FnMut(Progress),
) -> Result<Outcome> {
    execute_controlled(roots, digest, rebuild, |_| Ok(()), acknowledge, progress)
}
fn execute_inner(
    roots: &Roots,
    digest: &str,
    rebuild: impl FnOnce() -> Result<Preview>,
    checkpoint: impl FnMut(usize) -> Result<()>,
) -> Result<Outcome> {
    execute_controlled(roots, digest, rebuild, checkpoint, |_| Ok(()), |_| {})
}
fn execute_controlled(
    roots: &Roots,
    digest: &str,
    rebuild: impl FnOnce() -> Result<Preview>,
    mut checkpoint: impl FnMut(usize) -> Result<()>,
    acknowledge: impl FnOnce(&Outcome) -> Result<()>,
    mut progress: impl FnMut(Progress),
) -> Result<Outcome> {
    let mut pins = DirectoryPins::new();
    pins.pin(&roots.program)?;
    pins.pin(&roots.profile)?;
    let mut names = [
        format!("target:{}", paths::key(&roots.program)),
        format!("target:{}", paths::key(&roots.profile)),
    ];
    names.sort();
    let _locks = [Lock::acquire(&names[0])?, Lock::acquire(&names[1])?];
    let plan = rebuild()?;
    if plan.digest != digest {
        return Err(Error::Stale);
    }
    let total = plan.operations.len();
    progress(Progress {
        phase: Phase::Preparing,
        completed: 0,
        total,
    });
    if plan.operations.is_empty() {
        return Ok(Outcome {
            state: "unchanged".into(),
            mutations: 0,
            error: None,
        });
    }
    let txid = Uuid::new_v4().simple().to_string();
    let mut areas = Vec::new();
    let mut undo_items = Vec::new();
    let mut mutations = 0;
    let attempt = (|| -> Result<()> {
        for scope in [Scope::Program, Scope::Profile] {
            let path = roots
                .get(scope)
                .join(format!(".fennevia-transaction-{txid}"));
            drop(HeldFile::create(&path, true, true)?);
            areas.push(Area {
                scope,
                path,
                files: Vec::new(),
            });
            let area = areas.last_mut().ok_or(Error::Io)?;
            pins.pin(&area.path)?;
            let marker = area.path.join("transaction.json");
            area.files.push(marker.clone());
            put(
                &marker,
                &serde_json::to_vec(
                    &serde_json::json!({"schemaVersion":1,"owner":"fennevia-installer-transaction","transactionId":txid,"scope":scope}),
                )?,
            )?;
        }
        let mut staged = Vec::new();
        let mut snapshots = [Vec::new(), Vec::new()];
        let mut directories = [Vec::new(), Vec::new()];
        let mut seen = BTreeSet::new();
        for (index, op) in plan.operations.iter().enumerate() {
            approved(op.kind, op.scope, &op.path)?;
            let slot = if op.scope == Scope::Program { 0 } else { 1 };
            let area = &mut areas[slot];
            let path = roots.resolve(op.scope, &op.path)?;
            pins.pin(path.parent().ok_or(Error::InvalidPath)?)?;
            let stage = area.path.join(format!("stage-{index:04}.bin"));
            if matches!(op.kind, Kind::CreateFile | Kind::ReplaceFile) {
                let content = op.content.as_ref().ok_or(Error::InvalidData)?;
                if paths::hash(content) != op.expected_hash {
                    return Err(Error::InvalidData);
                }
                area.files.push(stage.clone());
                put(&stage, content)?;
            }
            staged.push(stage);
            if matches!(
                op.kind,
                Kind::CreateDirectory | Kind::RemoveDirectoryIfEmpty
            ) {
                directories[slot]
                    .push(serde_json::json!({"path":op.path,"existed":path.try_exists()?}));
                continue;
            }
            for (relative, hash) in [
                (
                    &op.path,
                    if matches!(op.kind, Kind::RemoveFile | Kind::MoveFile) {
                        &op.expected_hash
                    } else {
                        &op.existing_hash
                    },
                ),
                (&op.destination_path, &String::new()),
            ] {
                if relative.is_empty() || !seen.insert((slot, relative.clone())) {
                    continue;
                }
                let target = roots.resolve(op.scope, relative)?;
                if hash.is_empty() {
                    if target.try_exists()? {
                        return Err(Error::Conflict);
                    }
                    snapshots[slot].push(serde_json::json!({"path":relative,"existed":false,"backup":"","backupSha256":""}));
                } else {
                    let mut file = held(&target, hash)?;
                    let name = format!("backup-{:04}.bin", seen.len());
                    let backup = area.path.join(&name);
                    area.files.push(backup.clone());
                    put(&backup, &file.bytes(paths::MAX_TEXT)?)?;
                    snapshots[slot].push(serde_json::json!({"path":relative,"existed":true,"backup":name,"backupSha256":hash}));
                }
            }
        }
        for (slot, area) in areas.iter_mut().enumerate() {
            let operations:Vec<_>=plan.operations.iter().filter(|op|op.scope==area.scope).map(|op|serde_json::json!({"kind":op.kind,"path":op.path,"destinationPath":op.destination_path,"expectedHash":op.expected_hash,"existingHash":op.existing_hash})).collect();
            let journal = area.path.join("journal.json");
            area.files.push(journal.clone());
            put(
                &journal,
                &serde_json::to_vec_pretty(
                    &serde_json::json!({"schemaVersion":1,"owner":"fennevia-installer-transaction","transactionId":txid,"scope":area.scope,"state":"prepared","files":snapshots[slot],"directories":directories[slot],"operations":operations}),
                )?,
            )?;
        }
        checkpoint(0)?;
        progress(Progress {
            phase: Phase::Applying,
            completed: 0,
            total,
        });
        for (index, op) in plan.operations.iter().enumerate() {
            let path = roots.resolve(op.scope, &op.path)?;
            pins.pin(path.parent().ok_or(Error::InvalidPath)?)?;
            let slot = if op.scope == Scope::Program { 0 } else { 1 };
            match op.kind {
                Kind::CreateDirectory => {
                    drop(HeldFile::create(&path, true, false)?);
                    undo_items.push(Undo::NewDir(path.clone()));
                    pins.pin(&path)?;
                }
                Kind::CreateFile | Kind::ReplaceFile => {
                    let stage = held(&staged[index], &op.expected_hash)?;
                    if op.kind == Kind::ReplaceFile {
                        let original = held(&path, &op.existing_hash)?;
                        let stash = areas[slot].path.join(format!("undo-{index:04}.bin"));
                        areas[slot].files.push(stash.clone());
                        original.rename(&stash)?;
                        undo_items.push(Undo::OldFile(
                            path.clone(),
                            stash,
                            op.existing_hash.clone(),
                        ));
                        checkpoint(usize::MAX - index)?;
                    }
                    stage.rename(&path)?;
                    undo_items.push(Undo::NewFile(path.clone(), op.expected_hash.clone()));
                    crate::security::inherit_file_permissions(&path)?;
                }
                Kind::RemoveFile => {
                    let file = held(&path, &op.expected_hash)?;
                    let stash = areas[slot].path.join(format!("undo-{index:04}.bin"));
                    areas[slot].files.push(stash.clone());
                    file.rename(&stash)?;
                    undo_items.push(Undo::OldFile(path, stash, op.expected_hash.clone()));
                }
                Kind::MoveFile => {
                    approved(Kind::CreateFile, op.scope, &op.destination_path)?;
                    let to = roots.resolve(op.scope, &op.destination_path)?;
                    pins.pin(to.parent().ok_or(Error::InvalidPath)?)?;
                    held(&path, &op.expected_hash)?.rename(&to)?;
                    undo_items.push(Undo::Move(path, to, op.expected_hash.clone()));
                }
                Kind::RemoveDirectoryIfEmpty => {
                    if !path.try_exists()? {
                        continue;
                    }
                    pins.release(&path);
                    let directory = HeldFile::open(&path, true, true)?;
                    if fs::read_dir(&path)?.next().is_some() {
                        drop(directory);
                        pins.pin(&path)?;
                        continue;
                    }
                    let stash = areas[slot].path.join(format!("directory-{index:04}"));
                    areas[slot].files.push(stash.clone());
                    directory.rename(&stash)?;
                    undo_items.push(Undo::RemovedDir(path, stash));
                }
            }
            mutations += 1;
            progress(Progress {
                phase: Phase::Applying,
                completed: mutations,
                total,
            });
            checkpoint(mutations)?;
        }
        for op in &plan.operations {
            let path = roots.resolve(op.scope, &op.path)?;
            match op.kind {
                Kind::CreateFile | Kind::ReplaceFile => {
                    held(&path, &op.expected_hash)?;
                }
                Kind::MoveFile => {
                    if path.try_exists()? {
                        return Err(Error::Conflict);
                    }
                    held(
                        &roots.resolve(op.scope, &op.destination_path)?,
                        &op.expected_hash,
                    )?;
                }
                Kind::RemoveFile if path.try_exists()? => return Err(Error::Conflict),
                _ => {}
            }
        }
        Ok(())
    })();
    let outcome = if let Err(error) = attempt {
        progress(Progress {
            phase: Phase::RollingBack,
            completed: mutations,
            total,
        });
        if undo(&mut undo_items, &mut pins).is_err() {
            return Err(Error::RollbackIncomplete);
        }
        Outcome {
            state: "rolledBack".into(),
            mutations,
            error: Some(error),
        }
    } else {
        Outcome {
            state: "committed".into(),
            mutations,
            error: None,
        }
    };
    let cleanup_error = if outcome.state == "committed" {
        Error::CommittedCleanup
    } else {
        Error::Cleanup
    };
    progress(Progress {
        phase: Phase::Finishing,
        completed: mutations,
        total,
    });
    // A durable receipt distinguishes completed mutations from an interrupted
    // prepared journal. Never clear backups until the GUI acknowledges receipt.
    for area in &mut areas {
        let receipt = area.path.join("result.json");
        area.files.push(receipt.clone());
        put(&receipt, &serde_json::to_vec(&outcome)?).map_err(|_| cleanup_error)?;
    }
    acknowledge(&outcome).map_err(|_| cleanup_error)?;
    cleanup(&areas, &mut pins).map_err(|_| cleanup_error)?;
    Ok(outcome)
}
