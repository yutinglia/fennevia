// SPDX-License-Identifier: MPL-2.0
use crate::security::{self, Lock};
use fennevia_installer_core::{
    Error, Result, paths,
    saved::{LIMIT, SavedTargets},
};
use std::{fs, path::PathBuf};
use uuid::Uuid;

pub struct Store {
    root: PathBuf,
}
pub struct Snapshot {
    pub value: SavedTargets,
    pub revision: String,
}
impl Store {
    pub fn current_user() -> Result<Self> {
        let local = std::env::var("LOCALAPPDATA").map_err(|_| Error::Missing)?;
        Ok(Self {
            root: paths::absolute(&local)?.join("Fennevia/Setup"),
        })
    }
    pub fn load(&self) -> Result<Snapshot> {
        paths::no_reparse(&self.root)?;
        if !self.root.exists() {
            return Ok(Snapshot {
                value: SavedTargets::default(),
                revision: "absent".into(),
            });
        }
        security::check_private(&self.root)?;
        let path = self.root.join("targets.json");
        if !path.exists() {
            return Ok(Snapshot {
                value: SavedTargets::default(),
                revision: "absent".into(),
            });
        }
        security::check_private(&path)?;
        let bytes = paths::bounded_read(&path, LIMIT)?;
        Ok(Snapshot {
            value: SavedTargets::parse(&bytes)?,
            revision: paths::hash(&bytes),
        })
    }
    fn prepare(&self) -> Result<()> {
        let parent = self.root.parent().ok_or(Error::InvalidPath)?;
        paths::no_reparse(parent)?;
        if !parent.exists() {
            security::private_directory(parent)?;
        }
        // The Fennevia parent may also hold established development environments.
        if !parent.is_dir() {
            return Err(Error::InvalidPath);
        }
        security::private_directory(&self.root)
    }
    pub fn save(&self, value: &SavedTargets, revision: &str) -> Result<Snapshot> {
        let _lock = Lock::acquire(&format!("preferences:{}", security::user_sid()?))?;
        if self.load()?.revision != revision {
            return Err(Error::Stale);
        }
        let bytes = value.bytes()?;
        SavedTargets::parse(&bytes)?;
        self.prepare()?;
        let temp = self.root.join(format!("targets-{}.tmp", Uuid::new_v4()));
        security::private_file(&temp, &bytes)?;
        let result = security::replace(&temp, &self.root.join("targets.json"));
        if result.is_err() && temp.exists() {
            fs::remove_file(&temp).map_err(|_| Error::Cleanup)?;
        }
        result?;
        self.load()
    }
    pub fn clear(&self) -> Result<()> {
        let _lock = Lock::acquire(&format!("preferences:{}", security::user_sid()?))?;
        paths::no_reparse(&self.root)?;
        if !self.root.exists() {
            return Ok(());
        }
        security::check_private(&self.root)?;
        let path = self.root.join("targets.json");
        if path.exists() {
            security::check_private(&path)?;
            fs::remove_file(path)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    // Production preferences have one per-user OS mutex, even when fixtures use
    // distinct directories. Serialize these fixtures rather than weakening it.
    static SERIAL: std::sync::Mutex<()> = std::sync::Mutex::new(());
    #[test]
    fn powershell_51_and_7_read_and_write_native_preferences() {
        use std::os::windows::process::CommandExt;
        let _serial = SERIAL.lock().unwrap();
        for shell in ["powershell.exe", "pwsh.exe"] {
            let root =
                std::env::temp_dir().join(format!("fennevia-store-cross-{}", Uuid::new_v4()));
            fs::create_dir(&root).unwrap();
            for directory in ["Firefox", "First Profile", "Second Profile"] {
                fs::create_dir(root.join(directory)).unwrap();
            }
            fs::write(root.join("Firefox/firefox.exe"), b"fixture").unwrap();
            let store = Store {
                root: root.join("Fennevia/Setup"),
            };
            let mut value = SavedTargets::default();
            value
                .add(root.join("Firefox/firefox.exe"), root.join("First Profile"))
                .unwrap();
            store.save(&value, "absent").unwrap();
            let output = std::process::Command::new(shell)
                .args([
                    "-NoProfile",
                    "-NonInteractive",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-File",
                ])
                .arg(
                    std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                        .join("../../tests/cross-preferences.ps1"),
                )
                .env("LOCALAPPDATA", &root)
                .env_remove("PSModulePath")
                .creation_flags(0x08000000)
                .output()
                .unwrap();
            assert!(
                output.status.success(),
                "{shell}: {}",
                String::from_utf8_lossy(&output.stderr)
            );
            let result = store.load().unwrap();
            assert_eq!(result.value.targets.len(), 2);
            assert!(paths::same(
                &result.value.targets[1].profile_path,
                &root.join("Second Profile")
            ));
            store.clear().unwrap();
            fs::remove_dir_all(root).unwrap();
        }
    }
    #[test]
    fn private_atomic_save_stale_guard_and_clear() {
        let _serial = SERIAL.lock().unwrap();
        let root = std::env::temp_dir().join(format!("fennevia-store-test-{}", Uuid::new_v4()));
        security::private_directory(&root).unwrap();
        let store = Store {
            root: root.join("Setup"),
        };
        let first = store.load().unwrap();
        assert!(!store.root.exists());
        let second = store.save(&first.value, &first.revision).unwrap();
        assert_ne!(second.revision, first.revision);
        let mut changed = second.value.clone();
        changed
            .add(root.join("firefox.exe"), root.join("Moved Profile"))
            .unwrap();
        let third = store.save(&changed, &second.revision).unwrap();
        assert_eq!(third.value.targets.len(), 1);
        assert_ne!(third.revision, second.revision);
        assert_eq!(fs::read_dir(&store.root).unwrap().count(), 1);
        assert!(matches!(
            store.save(&first.value, &first.revision),
            Err(Error::Stale)
        ));
        fs::write(store.root.join("targets.json"), b"invalid").unwrap();
        assert!(store.load().is_err());
        store.clear().unwrap();
        assert_eq!(store.load().unwrap().revision, "absent");
        fs::remove_dir(&store.root).unwrap();
        fs::remove_dir(&root).unwrap();
    }
    #[test]
    fn refuses_shared_preferences_without_overwriting_them() {
        let _serial = SERIAL.lock().unwrap();
        let root = std::env::temp_dir().join(format!("fennevia-store-test-{}", Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let store = Store {
            root: root.join("Setup"),
        };
        fs::create_dir(&store.root).unwrap();
        let file = store.root.join("targets.json");
        let bytes = SavedTargets::default().bytes().unwrap();
        fs::write(&file, &bytes).unwrap();
        assert!(matches!(store.load(), Err(Error::Permission)));
        assert!(store.save(&SavedTargets::default(), "absent").is_err());
        assert_eq!(fs::read(&file).unwrap(), bytes);
        assert!(store.clear().is_err());
        fs::remove_file(file).unwrap();
        fs::remove_dir(&store.root).unwrap();
        fs::remove_dir(&root).unwrap();
    }
}
