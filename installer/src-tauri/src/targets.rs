// SPDX-License-Identifier: MPL-2.0
use fennevia_installer_core::{
    Error, Result, discovery,
    ownership::{self, Roots},
    package::Package,
    paths,
    planning::{self, Action},
    saved::SavedTargets,
};
use fennevia_platform_windows::{preferences::Store, registry, worker};
use serde::Serialize;
use std::{
    collections::{BTreeMap, HashMap},
    path::PathBuf,
    sync::Mutex,
};
use uuid::Uuid;

#[derive(Default)]
pub struct Session {
    pub execution: crate::execution::Execution,
    candidates: HashMap<Uuid, Candidate>,
    saved: SavedTargets,
    revision: Option<String>,
    package: Option<(Uuid, PathBuf)>,
    manual_programs: Vec<PathBuf>,
    manual_profiles: Vec<PathBuf>,
}
enum Candidate {
    Firefox(PathBuf),
    Profile(PathBuf),
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Choice {
    token: Uuid,
    label: String,
    detail: String,
    available: bool,
    is_default: bool,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedChoice {
    id: Uuid,
    firefox: Choice,
    profile: Choice,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Scan {
    programs: Vec<Choice>,
    profiles: Vec<Choice>,
    saved: Vec<SavedChoice>,
    warnings: Vec<Error>,
    saved_error: Option<Error>,
}
impl Session {
    fn program(&mut self, path: PathBuf) -> Choice {
        let token = Uuid::new_v4();
        let data = discovery::firefox(&path);
        let label = data
            .as_ref()
            .map(|p| format!("Firefox {} · {}", p.version, p.build_id))
            .unwrap_or_else(|_| "Firefox".into());
        self.candidates
            .insert(token, Candidate::Firefox(path.clone()));
        Choice {
            token,
            label,
            detail: path.to_string_lossy().into_owned(),
            available: data.is_ok(),
            is_default: false,
        }
    }
    fn profile(&mut self, path: PathBuf, profiles: &[discovery::Profile]) -> Choice {
        let token = Uuid::new_v4();
        let registered = profiles.iter().find(|p| paths::same(&p.path, &path));
        let available = path.is_dir() && paths::absolute(path.to_str().unwrap_or("")).is_ok();
        let label = registered
            .map(|p| p.name.clone())
            .unwrap_or_else(|| "Firefox profile".into());
        self.candidates
            .insert(token, Candidate::Profile(path.clone()));
        Choice {
            token,
            label,
            detail: path.to_string_lossy().into_owned(),
            available,
            is_default: registered.is_some_and(|p| p.is_default),
        }
    }
    fn scan(&mut self) -> Result<Scan> {
        self.execution.invalidate();
        let inventory = registry::scan()?;
        self.candidates.clear();
        let mut saved_error = None;
        match Store::current_user()?.load() {
            Ok(snapshot) => {
                self.saved = snapshot.value;
                self.revision = Some(snapshot.revision);
            }
            Err(e) => {
                self.saved = SavedTargets::default();
                self.revision = None;
                saved_error = Some(e);
            }
        }
        let mut program_paths: BTreeMap<_, _> = inventory
            .programs
            .into_iter()
            .map(|p| (paths::key(&p.path), p.path))
            .collect();
        let mut profile_paths: BTreeMap<_, _> = inventory
            .profiles
            .iter()
            .map(|p| (paths::key(&p.path), p.path.clone()))
            .collect();
        for path in self
            .manual_programs
            .iter()
            .chain(self.saved.targets.iter().map(|p| &p.firefox_path))
        {
            program_paths.insert(paths::key(path), path.clone());
        }
        for path in self
            .manual_profiles
            .iter()
            .chain(self.saved.targets.iter().map(|p| &p.profile_path))
        {
            profile_paths.insert(paths::key(path), path.clone());
        }
        let programs = program_paths
            .into_values()
            .map(|p| self.program(p))
            .collect();
        let profiles = profile_paths
            .into_values()
            .map(|p| self.profile(p, &inventory.profiles))
            .collect();
        let saved = self
            .saved
            .targets
            .clone()
            .into_iter()
            .map(|item| SavedChoice {
                id: item.id,
                firefox: self.program(item.firefox_path),
                profile: self.profile(item.profile_path, &inventory.profiles),
            })
            .collect();
        Ok(Scan {
            programs,
            profiles,
            saved,
            warnings: inventory.warnings,
            saved_error,
        })
    }
}
pub fn lock(state: &Mutex<Session>) -> Result<std::sync::MutexGuard<'_, Session>> {
    let session = state.lock().map_err(|_| Error::Busy)?;
    if session.execution.busy || session.execution.uncertain {
        return Err(Error::Busy);
    }
    Ok(session)
}

fn selected(session: &Session, firefox: Uuid, profile: Uuid) -> Result<Roots> {
    let program = match session.candidates.get(&firefox) {
        Some(Candidate::Firefox(p)) => p,
        _ => return Err(Error::Stale),
    };
    let profile = match session.candidates.get(&profile) {
        Some(Candidate::Profile(p)) => p,
        _ => return Err(Error::Stale),
    };
    let program = discovery::firefox(program)?;
    let root = program.path.parent().ok_or(Error::InvalidProgram)?;
    let broad = registry::broad_roots();
    paths::root_allowed(root, &broad)?;
    paths::root_allowed(profile, &broad)?;
    if paths::same(root, profile) || paths::within(root, profile) || paths::within(profile, root) {
        return Err(Error::OverlappingRoots);
    }
    let roots = Roots {
        program: root.to_owned(),
        profile: profile.clone(),
    };
    let pair = roots.read_ownership()?;
    if !discovery::profiles(&registry::data_root()?)?
        .iter()
        .any(|p| paths::same(&p.path, profile))
        && pair.present != [true, true]
        && !worker::development(&roots)
    {
        return Err(Error::UnregisteredProfile);
    }
    Ok(roots)
}

#[tauri::command]
pub async fn inspect_targets(
    firefox: Uuid,
    profile: Uuid,
    state: tauri::State<'_, Mutex<Session>>,
) -> Result<ownership::Status> {
    let session = lock(&state)?;
    ownership::status(&selected(&session, firefox, profile)?)
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageChoice {
    token: Uuid,
    version: String,
    file_count: usize,
}
#[tauri::command]
pub async fn bundled_package(
    state: tauri::State<'_, Mutex<Session>>,
) -> Result<Option<PackageChoice>> {
    let image = fennevia_platform_windows::security::current_image()?;
    let root = image.parent().ok_or(Error::InvalidPath)?.to_path_buf();
    if !root.join("RELEASE-MANIFEST.json").try_exists()? {
        return Ok(None);
    }
    let package = tauri::async_runtime::spawn_blocking(move || -> Result<Package> {
        let package = Package::read(&root)?;
        fennevia_installer_core::release::validate(&package)?;
        Ok(package)
    })
    .await
    .map_err(|_| Error::Io)??;
    let token = Uuid::new_v4();
    let choice = PackageChoice {
        token,
        version: package.manifest.package_version.clone(),
        file_count: package.manifest.files.len(),
    };
    let mut session = lock(&state)?;
    session.execution.invalidate();
    session.package = Some((token, package.root));
    Ok(Some(choice))
}
#[tauri::command]
pub async fn pick_package(
    state: tauri::State<'_, Mutex<Session>>,
) -> Result<Option<PackageChoice>> {
    let Some(folder) = rfd::AsyncFileDialog::new().pick_folder().await else {
        return Ok(None);
    };
    let package = tauri::async_runtime::spawn_blocking(move || Package::read(folder.path()))
        .await
        .map_err(|_| Error::Io)??;
    let token = Uuid::new_v4();
    let choice = PackageChoice {
        token,
        version: package.manifest.package_version.clone(),
        file_count: package.manifest.files.len(),
    };
    let mut session = lock(&state)?;
    session.execution.invalidate();
    session.package = Some((token, package.root));
    Ok(Some(choice))
}
#[tauri::command]
pub async fn preview_action(
    firefox: Uuid,
    profile: Uuid,
    action: Action,
    package: Option<Uuid>,
    default_confirmed: bool,
    state: tauri::State<'_, Mutex<Session>>,
) -> Result<crate::execution::Review> {
    let (roots, source, generation) = {
        let mut session = lock(&state)?;
        session.execution.invalidate();
        let roots = selected(&session, firefox, profile)?;
        if !default_confirmed
            && discovery::profiles(&registry::data_root()?)?
                .iter()
                .any(|p| p.is_default && paths::same(&p.path, &roots.profile))
        {
            return Err(Error::Cancelled);
        }
        let source = match package {
            Some(token) => Some(
                session
                    .package
                    .as_ref()
                    .filter(|(id, _)| *id == token)
                    .ok_or(Error::Stale)?
                    .1
                    .clone(),
            ),
            None => None,
        };
        (roots, source, session.execution.generation)
    };
    let (mut review, request) = tauri::async_runtime::spawn_blocking(move || {
        let mut request = worker::Request {
            target_identity: worker::identity(&roots)?,
            default_confirmed,
            schema_version: 1,
            nonce: Uuid::new_v4(),
            created: worker::now()?,
            user_sid: fennevia_platform_windows::security::user_sid()?,
            program: roots.program.clone(),
            profile: roots.profile.clone(),
            source,
            action,
            installation_id: Uuid::new_v4(),
            digest: String::new(),
        };
        let (preview, executable) = match worker::prepare(&request) {
            Ok(preview) => (preview, true),
            Err(Error::DevelopmentOnly) => {
                let package = if matches!(action, Action::Disable | Action::Uninstall) {
                    None
                } else {
                    request.source.as_deref().map(Package::read).transpose()?
                };
                (
                    planning::preview(&roots, action, package.as_ref(), request.installation_id)?,
                    false,
                )
            }
            Err(error) => return Err(error),
        };
        request.digest = preview.digest.clone();
        Ok((
            crate::execution::Review {
                preview,
                approval: None,
            },
            if executable { Some(request) } else { None },
        ))
    })
    .await
    .map_err(|_| Error::Io)??;
    let mut session = lock(&state)?;
    if session.execution.generation != generation {
        return Err(Error::Stale);
    }
    if let Some(request) = request {
        review.approval = Some(session.execution.prepare(request));
    }
    Ok(review)
}

#[tauri::command]
pub async fn scan_targets(state: tauri::State<'_, Mutex<Session>>) -> Result<Scan> {
    // Tauri async commands run off the UI thread. Only bounded work is performed.
    lock(&state)?.scan()
}
#[tauri::command]
pub async fn pick_target(
    kind: String,
    state: tauri::State<'_, Mutex<Session>>,
) -> Result<Option<Choice>> {
    let picked = match kind.as_str() {
        "firefox" => {
            rfd::AsyncFileDialog::new()
                .add_filter("Firefox", &["exe"])
                .pick_file()
                .await
        }
        "profile" => rfd::AsyncFileDialog::new().pick_folder().await,
        _ => return Err(Error::InvalidData),
    };
    let Some(picked) = picked else {
        return Ok(None);
    };
    let path = paths::absolute(picked.path().to_str().ok_or(Error::InvalidPath)?)?;
    let mut session = lock(&state)?;
    session.execution.invalidate();
    if session.candidates.len() >= 2048 {
        return Err(Error::LimitExceeded);
    }
    match kind.as_str() {
        "firefox" => {
            discovery::firefox(&path)?;
            if session.manual_programs.len() >= 128 {
                return Err(Error::LimitExceeded);
            }
            if !session
                .manual_programs
                .iter()
                .any(|p| paths::same(p, &path))
            {
                session.manual_programs.push(path.clone());
            }
            Ok(Some(session.program(path)))
        }
        _ => {
            let profiles = discovery::profiles(&registry::data_root()?)?;
            if session.manual_profiles.len() >= 128 {
                return Err(Error::LimitExceeded);
            }
            if !session
                .manual_profiles
                .iter()
                .any(|p| paths::same(p, &path))
            {
                session.manual_profiles.push(path.clone());
            }
            Ok(Some(session.profile(path, &profiles)))
        }
    }
}
#[tauri::command]
pub async fn save_target(
    firefox: Uuid,
    profile: Uuid,
    state: tauri::State<'_, Mutex<Session>>,
) -> Result<Scan> {
    let mut session = lock(&state)?;
    let roots = selected(&session, firefox, profile)?;
    let pair = roots.read_ownership()?;
    if pair.present[0] != pair.present[1] {
        return Err(Error::Conflict);
    }
    let revision = session.revision.clone().ok_or(Error::InvalidData)?;
    let mut saved = session.saved.clone();
    saved.add(roots.program.join("firefox.exe"), roots.profile)?;
    Store::current_user()?.save(&saved, &revision)?;
    session.scan()
}
#[tauri::command]
pub async fn forget_target(id: Uuid, state: tauri::State<'_, Mutex<Session>>) -> Result<Scan> {
    let mut session = lock(&state)?;
    let revision = session.revision.clone().ok_or(Error::InvalidData)?;
    let mut saved = session.saved.clone();
    if !saved.targets.iter().any(|t| t.id == id) {
        return Err(Error::Stale);
    }
    saved.targets.retain(|t| t.id != id);
    Store::current_user()?.save(&saved, &revision)?;
    session.scan()
}
#[tauri::command]
pub async fn clear_targets(
    confirmed: bool,
    state: tauri::State<'_, Mutex<Session>>,
) -> Result<Scan> {
    if !confirmed {
        return Err(Error::Cancelled);
    }
    Store::current_user()?.clear()?;
    lock(&state)?.scan()
}
