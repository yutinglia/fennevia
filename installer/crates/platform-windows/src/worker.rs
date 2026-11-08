// SPDX-License-Identifier: MPL-2.0
use crate::{
    registry,
    security::{self, Handle},
    transaction::{self, Outcome},
};
use fennevia_installer_core::{
    Error, Result, discovery,
    ownership::Roots,
    package::Package,
    paths,
    planning::{self, Action, Preview},
};
use serde::{Deserialize, Serialize};
use std::{
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};
use uuid::Uuid;
use windows_sys::Win32::{Foundation::*, Storage::FileSystem::*, System::Diagnostics::ToolHelp::*};

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Request {
    pub schema_version: u32,
    pub nonce: Uuid,
    pub created: u64,
    pub user_sid: String,
    pub program: PathBuf,
    pub profile: PathBuf,
    pub source: Option<PathBuf>,
    pub action: Action,
    pub installation_id: Uuid,
    pub digest: String,
    pub target_identity: String,
    pub default_confirmed: bool,
}
pub fn now() -> Result<u64> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| Error::Stale)?
        .as_secs())
}
impl Request {
    pub fn validate(&self) -> Result<()> {
        let time = now()?;
        if self.schema_version != 1
            || self.nonce.is_nil()
            || self.installation_id.is_nil()
            || self.created > time
            || time - self.created > 900
            || self.user_sid != security::user_sid()?
        {
            return Err(Error::Stale);
        }
        if !fennevia_installer_core::ownership::valid_hash(&self.target_identity)
            || (!self.digest.is_empty()
                && !fennevia_installer_core::ownership::valid_hash(&self.digest))
        {
            return Err(Error::InvalidData);
        }
        Ok(())
    }
    pub fn roots(&self) -> Result<Roots> {
        let program = paths::absolute(self.program.to_str().ok_or(Error::InvalidPath)?)?;
        let profile = paths::absolute(self.profile.to_str().ok_or(Error::InvalidPath)?)?;
        let broad = registry::broad_roots();
        paths::root_allowed(&program, &broad)?;
        paths::root_allowed(&profile, &broad)?;
        if paths::same(&program, &profile)
            || paths::within(&program, &profile)
            || paths::within(&profile, &program)
        {
            return Err(Error::OverlappingRoots);
        }
        discovery::firefox(&program.join("firefox.exe"))?;
        Ok(Roots { program, profile })
    }
}
fn marker(path: &std::path::Path, field: &str, expected: &str) -> bool {
    let result = (|| -> Result<bool> {
        let value: serde_json::Value = serde_json::from_slice(&paths::bounded_read(path, 4096)?)?;
        Ok(value["schemaVersion"] == 1 && value["owner"] == "fennevia" && value[field] == expected)
    })();
    result == Ok(true)
}
pub fn development(roots: &Roots) -> bool {
    if registry::broad_roots().iter().any(|root| {
        root.ends_with("Mozilla/Firefox/Profiles") && paths::within(&roots.profile, root)
    }) || registry::data_root()
        .and_then(|root| discovery::profiles(&root))
        .map_or(true, |profiles| {
            profiles
                .iter()
                .any(|profile| paths::same(&profile.path, &roots.profile))
        })
    {
        return false;
    }
    marker(
        &roots.profile.join(".fennevia-dev-profile.json"),
        "profileName",
        "fennevia-dev",
    ) && marker(
        &roots.program.join(".fennevia-program-spike.json"),
        "purpose",
        "firefox-identity-regression",
    ) && marker(
        &roots.program.join(".fennevia-program-spike.json"),
        "state",
        "ready",
    )
}
pub fn prepare(request: &Request) -> Result<Preview> {
    request.validate()?;
    let roots = request.roots()?;
    if identity(&roots)? != request.target_identity {
        return Err(Error::Stale);
    }
    if !request.default_confirmed
        && discovery::profiles(&registry::data_root()?)?
            .iter()
            .any(|profile| profile.is_default && paths::same(&profile.path, &roots.profile))
    {
        return Err(Error::Cancelled);
    }
    let recovery = matches!(request.action, Action::Disable | Action::Uninstall);
    if !recovery {
        let browser = discovery::firefox(&roots.program.join("firefox.exe"))?;
        if browser
            .version
            .split('.')
            .next()
            .and_then(|v| v.parse::<u32>().ok())
            .is_none_or(|major| major < 153)
            || !browser
                .version
                .bytes()
                .all(|b| b.is_ascii_digit() || b == b'.')
        {
            return Err(Error::InvalidProgram);
        }
    }
    let pair = roots.read_ownership()?;
    let development = development(&roots);
    let registered = discovery::profiles(&registry::data_root()?)?
        .iter()
        .any(|p| paths::same(&p.path, &roots.profile));
    if !development && !registered && !(pair.record.is_some() && pair.present == [true, true]) {
        return Err(Error::UnregisteredProfile);
    }
    let mut package = if recovery {
        None
    } else {
        Some(Package::read(
            request.source.as_deref().ok_or(Error::Missing)?,
        )?)
    };
    if let Some(package) = &mut package {
        if package.root.join("RELEASE-MANIFEST.json").try_exists()? {
            let release_digest = fennevia_installer_core::release::validate(package)?;
            package.digest = paths::hash(format!("{}:{release_digest}", package.digest).as_bytes());
            crate::firefox::supported(&roots.program)?;
        } else if !development {
            return Err(Error::DevelopmentOnly);
        }
    }
    planning::preview(
        &roots,
        request.action,
        package.as_ref(),
        request.installation_id,
    )
}
pub fn identity(roots: &Roots) -> Result<String> {
    use crate::handles::HeldFile;
    let program = HeldFile::open(&roots.program, true, false)?;
    let profile = HeldFile::open(&roots.profile, true, false)?;
    let executable = HeldFile::open(&roots.program.join("firefox.exe"), false, false)?;
    let ini =
        HeldFile::open(&roots.program.join("application.ini"), false, false)?.bytes(256 * 1024)?;
    Ok(paths::hash(&serde_json::to_vec(&(
        program.identity()?,
        profile.identity()?,
        executable.identity()?,
        paths::hash(&ini),
    ))?))
}
pub fn firefox_closed() -> Result<()> {
    unsafe {
        let raw = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if raw == INVALID_HANDLE_VALUE {
            return Err(Error::Io);
        }
        let snapshot = Handle(raw);
        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = size_of::<PROCESSENTRY32W>() as u32;
        if Process32FirstW(snapshot.0, &mut entry) == 0 {
            return Err(Error::Io);
        }
        loop {
            let len = entry
                .szExeFile
                .iter()
                .position(|v| *v == 0)
                .unwrap_or(entry.szExeFile.len());
            if String::from_utf16_lossy(&entry.szExeFile[..len]).eq_ignore_ascii_case("firefox.exe")
            {
                return Err(Error::Busy);
            }
            if Process32NextW(snapshot.0, &mut entry) == 0 {
                if GetLastError() != ERROR_NO_MORE_FILES {
                    return Err(Error::Io);
                }
                break;
            }
        }
    }
    Ok(())
}
struct ProfileLock {
    file: crate::handles::HeldFile,
    created: bool,
}
impl ProfileLock {
    fn finish(self) -> Result<()> {
        if self.created {
            self.file.remove().map_err(|_| Error::Cleanup)
        } else {
            Ok(())
        }
    }
}
fn profile_lock(roots: &Roots) -> Result<ProfileLock> {
    use crate::handles::HeldFile;
    use std::os::windows::fs::OpenOptionsExt;
    let path = roots.profile.join("parent.lock");
    match HeldFile::create(&path, false, false) {
        Ok(file) => Ok(ProfileLock {
            file,
            created: true,
        }),
        Err(Error::Conflict) => {
            paths::no_reparse(&path)?;
            let file = HeldFile(
                std::fs::OpenOptions::new()
                    .access_mode(GENERIC_READ | GENERIC_WRITE)
                    .share_mode(0)
                    .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT)
                    .open(&path)
                    .map_err(|_| Error::Busy)?,
            );
            file.validate(&path, false, true)?;
            Ok(ProfileLock {
                file,
                created: false,
            })
        }
        Err(error) => Err(error),
    }
}
pub fn program_writable(request: &Request) -> Result<()> {
    let roots = request.roots()?;
    let mut pins = crate::handles::DirectoryPins::new();
    pins.pin(&roots.program)?;
    let path = roots
        .program
        .join(format!(".fennevia-write-probe-{}", Uuid::new_v4().simple()));
    crate::handles::HeldFile::create(&path, true, true)?
        .remove()
        .map_err(|_| Error::Cleanup)
}
pub fn run(request: &Request) -> Result<Outcome> {
    run_report(request, |_| Ok(()))
}
pub fn run_report(
    request: &Request,
    acknowledge: impl FnOnce(&Outcome) -> Result<()>,
) -> Result<Outcome> {
    run_progress(request, acknowledge, |_| {})
}
pub fn run_progress(
    request: &Request,
    acknowledge: impl FnOnce(&Outcome) -> Result<()>,
    progress: impl FnMut(transaction::Progress),
) -> Result<Outcome> {
    request.validate()?;
    let roots = request.roots()?;
    // Validate source and profile proof before creating even a temporary lock.
    let plan = prepare(request)?;
    if plan.digest != request.digest {
        return Err(Error::Stale);
    }
    firefox_closed()?;
    let mut pins = crate::handles::DirectoryPins::new();
    pins.pin(&roots.program)?;
    pins.pin(&roots.profile)?;
    let profile_lock = profile_lock(&roots)?;
    let result = transaction::execute_progress(
        &roots,
        &request.digest,
        || {
            firefox_closed()?;
            prepare(request)
        },
        acknowledge,
        progress,
    );
    profile_lock.finish()?;
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn request_rejects_expiry_other_user_and_unknown_fields() {
        let mut request = Request {
            schema_version: 1,
            nonce: Uuid::new_v4(),
            created: now().unwrap(),
            user_sid: security::user_sid().unwrap(),
            program: "C:/fixture/Firefox".into(),
            profile: "C:/fixture/Profile".into(),
            source: None,
            action: Action::Uninstall,
            installation_id: Uuid::new_v4(),
            digest: "a".repeat(64),
            target_identity: "b".repeat(64),
            default_confirmed: false,
        };
        request.validate().unwrap();
        request.created -= 901;
        assert_eq!(request.validate(), Err(Error::Stale));
        request.created = now().unwrap() + 60;
        assert_eq!(request.validate(), Err(Error::Stale));
        request.created = now().unwrap();
        request.user_sid = "S-1-0-0".into();
        assert_eq!(request.validate(), Err(Error::Stale));
        let mut value = serde_json::to_value(request).unwrap();
        value["operations"] = serde_json::json!([]);
        assert!(serde_json::from_value::<Request>(value).is_err());
    }
    #[test]
    fn profile_lock_blocks_a_second_writer_and_preserves_an_existing_file() {
        let canonical = std::fs::canonicalize(std::env::temp_dir()).unwrap();
        let parent = PathBuf::from(canonical.to_str().unwrap().trim_start_matches(r"\\?\"));
        let path = parent.join(format!("fennevia-worker-lock-{}", Uuid::new_v4()));
        std::fs::create_dir(&path).unwrap();
        let roots = Roots {
            program: path.clone(),
            profile: path.clone(),
        };
        let lock = profile_lock(&roots).unwrap();
        assert!(profile_lock(&roots).is_err());
        lock.finish().unwrap();
        assert!(!path.join("parent.lock").exists());
        std::fs::write(path.join("parent.lock"), b"existing").unwrap();
        let lock = profile_lock(&roots).unwrap();
        assert!(profile_lock(&roots).is_err());
        lock.finish().unwrap();
        assert_eq!(
            std::fs::read(path.join("parent.lock")).unwrap(),
            b"existing"
        );
        std::fs::remove_file(path.join("parent.lock")).unwrap();
        std::fs::remove_dir(path).unwrap();
    }
}
