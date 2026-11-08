// SPDX-License-Identifier: MPL-2.0
use fennevia_installer_core::{
    Error, discovery,
    ownership::{
        self, DISABLED, Directory, ENABLED, OWNERSHIP, OwnedFile, Ownership, Roots, Scope, State,
    },
    package::{Manifest, Package},
    paths,
    planning::{self, Action, Kind},
    saved::SavedTargets,
};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};
use uuid::Uuid;

#[test]
fn reads_actual_powershell_51_and_7_ownership_fixtures() {
    for (state, files) in [
        (
            State::Enabled,
            [
                include_bytes!("../../../tests/fixtures/ownership-enabled-ps5.json").as_slice(),
                include_bytes!("../../../tests/fixtures/ownership-enabled-ps7.json").as_slice(),
            ],
        ),
        (
            State::Disabled,
            [
                include_bytes!("../../../tests/fixtures/ownership-disabled-ps5.json").as_slice(),
                include_bytes!("../../../tests/fixtures/ownership-disabled-ps7.json").as_slice(),
            ],
        ),
    ] {
        let first = Ownership::parse(files[0]).unwrap();
        let second = Ownership::parse(files[1]).unwrap();
        assert_eq!(first, second);
        assert_eq!(first.state, state);
        assert_eq!(first.files.len(), 2);
    }
}

struct Fixture {
    root: PathBuf,
    roots: Roots,
    package: Package,
}
impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!("fennevia-contract-{}", Uuid::new_v4()));
        let roots = Roots {
            program: root.join("Firefox"),
            profile: root.join("工作 Profile"),
        };
        fs::create_dir_all(roots.program.join("defaults/pref")).unwrap();
        fs::create_dir(&roots.profile).unwrap();
        let package = Package::read(
            Path::new(env!("CARGO_MANIFEST_DIR"))
                .ancestors()
                .nth(3)
                .unwrap(),
        )
        .unwrap();
        Self {
            root,
            roots,
            package,
        }
    }
    fn installed(&self, state: State) -> Ownership {
        let mut files = Vec::new();
        for file in &self.package.manifest.files {
            let installed_path =
                if state == State::Disabled && file.scope == Scope::Program && file.path == ENABLED
                {
                    DISABLED
                } else {
                    &file.path
                };
            let path = self.roots.resolve(file.scope, installed_path).unwrap();
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(
                path,
                &self.package.contents[&(file.scope, file.path.clone())],
            )
            .unwrap();
            files.push(OwnedFile {
                scope: file.scope,
                path: file.path.clone(),
                installed_path: installed_path.into(),
                sha256: file.sha256.clone(),
            });
        }
        let created_directories = [
            "chrome",
            "chrome/fennevia",
            "chrome/fennevia/content",
            "chrome/fennevia/content/firefox",
            "chrome/fennevia/content/runtime",
            "chrome/fennevia/content/shell",
        ]
        .iter()
        .map(|p| Directory {
            scope: Scope::Profile,
            path: (*p).into(),
        })
        .collect();
        let record = Ownership {
            schema_version: 1,
            owner: "fennevia".into(),
            package_id: "fennevia".into(),
            installation_id: Uuid::new_v4(),
            package_version: self.package.manifest.package_version.clone(),
            state,
            source_manifest_sha256: self.package.digest.clone(),
            files,
            created_directories,
        };
        self.record(&record);
        record
    }
    fn record(&self, record: &Ownership) {
        let bytes = serde_json::to_vec_pretty(record).unwrap();
        for scope in [Scope::Program, Scope::Profile] {
            let path = self.roots.resolve(scope, OWNERSHIP).unwrap();
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, &bytes).unwrap();
        }
    }
    fn preview(&self, action: Action) -> fennevia_installer_core::Result<planning::Preview> {
        planning::preview(&self.roots, action, Some(&self.package), Uuid::new_v4())
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        assert_eq!(self.root.parent(), Some(std::env::temp_dir().as_path()));
        assert!(
            self.root
                .file_name()
                .unwrap()
                .to_string_lossy()
                .starts_with("fennevia-contract-")
        );
        fs::remove_dir_all(&self.root).unwrap();
    }
}
fn tree(root: &Path) -> BTreeMap<PathBuf, Option<Vec<u8>>> {
    fn visit(root: &Path, base: &Path, result: &mut BTreeMap<PathBuf, Option<Vec<u8>>>) {
        for entry in fs::read_dir(root).unwrap() {
            let path = entry.unwrap().path();
            let key = path.strip_prefix(base).unwrap().to_owned();
            if path.is_dir() {
                result.insert(key, None);
                visit(&path, base, result);
            } else {
                result.insert(key, Some(fs::read(path).unwrap()));
            }
        }
    }
    let mut result = BTreeMap::new();
    visit(root, root, &mut result);
    result
}
#[test]
fn install_preview_is_read_only_and_redacted() {
    let fixture = Fixture::new();
    let before = tree(&fixture.root);
    let preview = fixture.preview(Action::Install).unwrap();
    assert!(!preview.executable);
    assert_eq!(
        preview
            .operations
            .iter()
            .filter(|o| o.kind == Kind::CreateFile)
            .count(),
        fixture.package.manifest.files.len() + 2
    );
    assert_eq!(tree(&fixture.root), before);
    let output = serde_json::to_string(&preview).unwrap();
    assert!(!output.contains("content\":"));
    assert!(!output.contains(&fixture.root.to_string_lossy().replace('\\', "\\\\")));
}
#[test]
fn exact_package_is_noop_and_update_preserves_disabled_state() {
    let fixture = Fixture::new();
    fixture.installed(State::Disabled);
    assert!(
        fixture
            .preview(Action::Install)
            .unwrap()
            .operations
            .is_empty()
    );
    assert!(
        fixture
            .preview(Action::Update)
            .unwrap()
            .operations
            .is_empty()
    );
    fs::remove_file(fixture.roots.program.join(DISABLED)).unwrap();
    let preview = fixture.preview(Action::Update).unwrap();
    assert_eq!(preview.state, State::Disabled);
    assert_eq!(preview.operations.len(), 1);
    assert_eq!(preview.operations[0].path, DISABLED);
    assert_eq!(preview.operations[0].kind, Kind::CreateFile);
}
#[test]
fn changed_owned_file_blocks_update_and_uninstall_but_disable_remains_available() {
    let fixture = Fixture::new();
    fixture.installed(State::Enabled);
    fs::write(
        fixture
            .roots
            .profile
            .join("chrome/fennevia/chrome.manifest"),
        b"broken",
    )
    .unwrap();
    assert!(matches!(
        fixture.preview(Action::Update),
        Err(Error::Conflict)
    ));
    assert!(matches!(
        fixture.preview(Action::Uninstall),
        Err(Error::Conflict)
    ));
    let preview = fixture.preview(Action::Disable).unwrap();
    assert_eq!(preview.state, State::Disabled);
    assert_eq!(
        preview
            .operations
            .iter()
            .filter(|o| o.kind == Kind::MoveFile)
            .count(),
        1
    );
    assert_eq!(ownership::status(&fixture.roots).unwrap().changed_files, 1);
}
#[test]
fn altered_preference_blocks_disable_and_enable_requires_matching_source() {
    let mut fixture = Fixture::new();
    fixture.installed(State::Disabled);
    fixture.package.digest = "a".repeat(64);
    assert!(matches!(
        fixture.preview(Action::Enable),
        Err(Error::Conflict)
    ));
    fixture.installed(State::Enabled);
    fs::write(fixture.roots.program.join(ENABLED), b"foreign").unwrap();
    assert!(matches!(
        fixture.preview(Action::Disable),
        Err(Error::Conflict)
    ));
}
#[test]
fn repair_only_reconstructs_wholly_missing_side_and_preserves_record_bytes() {
    let fixture = Fixture::new();
    fixture.installed(State::Enabled);
    fs::remove_file(fixture.roots.profile.join(OWNERSHIP)).unwrap();
    assert!(fixture.preview(Action::Repair).is_err());
    fs::remove_dir(fixture.roots.profile.join(".fennevia")).unwrap();
    assert!(fixture.preview(Action::Repair).is_err());
    fs::remove_dir_all(fixture.roots.profile.join("chrome/fennevia")).unwrap();
    let before = tree(&fixture.root);
    let preview = fixture.preview(Action::Repair).unwrap();
    assert!(preview.operations.iter().all(|o| o.scope == Scope::Profile));
    let metadata = preview
        .operations
        .iter()
        .find(|o| o.path == OWNERSHIP)
        .unwrap();
    assert_eq!(
        metadata.content.as_ref().unwrap(),
        &fs::read(fixture.roots.program.join(OWNERSHIP)).unwrap()
    );
    assert_eq!(tree(&fixture.root), before);
}
#[test]
fn mismatched_pair_and_interrupted_transaction_are_rejected() {
    let fixture = Fixture::new();
    let mut record = fixture.installed(State::Enabled);
    record.installation_id = Uuid::new_v4();
    fs::write(
        fixture.roots.profile.join(OWNERSHIP),
        serde_json::to_vec(&record).unwrap(),
    )
    .unwrap();
    assert!(matches!(
        fixture.preview(Action::Uninstall),
        Err(Error::Conflict)
    ));
    fixture.record(&record);
    fs::create_dir(
        fixture
            .roots
            .program
            .join(".fennevia-transaction-interrupted"),
    )
    .unwrap();
    assert!(matches!(fixture.preview(Action::Install), Err(Error::Busy)));
}
#[test]
fn unmanaged_package_and_foreign_autoconfig_are_not_overwritten() {
    let fixture = Fixture::new();
    fs::create_dir_all(fixture.roots.profile.join("chrome/fennevia")).unwrap();
    assert!(matches!(
        fixture.preview(Action::Install),
        Err(Error::Conflict)
    ));
    fs::remove_dir(fixture.roots.profile.join("chrome/fennevia")).unwrap();
    fs::write(
        fixture.roots.program.join("defaults/pref/custom.js"),
        b"pref('general.config.filename', 'custom.cfg');",
    )
    .unwrap();
    assert!(matches!(
        fixture.preview(Action::Install),
        Err(Error::Conflict)
    ));
}
#[test]
fn uninstall_lists_only_proven_files_and_empty_directory_removals() {
    let fixture = Fixture::new();
    let record = fixture.installed(State::Enabled);
    fs::write(
        fixture.roots.profile.join("chrome/userChrome.css"),
        b"user customization",
    )
    .unwrap();
    fs::remove_file(fixture.roots.program.join(ENABLED)).unwrap();
    let before = tree(&fixture.root);
    let preview = fixture.preview(Action::Uninstall).unwrap();
    assert_eq!(
        preview
            .operations
            .iter()
            .filter(|o| o.kind == Kind::RemoveFile)
            .count(),
        record.files.len() + 1
    );
    assert!(
        !preview
            .operations
            .iter()
            .any(|o| o.path.contains("userChrome"))
    );
    assert!(
        preview
            .operations
            .iter()
            .all(|o| matches!(o.kind, Kind::RemoveFile | Kind::RemoveDirectoryIfEmpty))
    );
    assert_eq!(tree(&fixture.root), before);
}
#[test]
fn profile_scan_survives_bad_entries_and_deduplicates_default_install() {
    let fixture = Fixture::new();
    fs::write(fixture.root.join("profiles.ini"), "[Profile0]\nName=工作 Profile\nPath=工作 Profile\nIsRelative=1\n[Profile1]\nPath=../escape\nIsRelative=1\n[Profile2]\nPath=missing\nName=Moved\nIsRelative=1\n").unwrap();
    fs::write(
        fixture.root.join("installs.ini"),
        "[INSTALLHASH]\nDefault=工作 Profile\n",
    )
    .unwrap();
    let found = discovery::scan_profiles(&fixture.root).unwrap();
    assert_eq!(found.profiles.len(), 2);
    assert_eq!(found.warnings, vec![Error::InvalidPath]);
    let profile = found
        .profiles
        .iter()
        .find(|p| paths::same(&p.path, &fixture.roots.profile))
        .unwrap();
    assert!(profile.is_default);
    assert_eq!(profile.name, "工作 Profile");
}
#[test]
fn saved_locations_retain_moved_entries_enforce_limits_and_do_not_execute_values() {
    let fixture = Fixture::new();
    let mut saved = SavedTargets::default();
    for i in 0..10 {
        saved
            .add(
                fixture.root.join(format!("Firefox{i}/firefox.exe")),
                fixture.roots.profile.clone(),
            )
            .unwrap();
    }
    assert_eq!(
        SavedTargets::parse(&saved.bytes().unwrap())
            .unwrap()
            .targets
            .len(),
        10
    );
    saved
        .add(
            fixture.root.join("Firefox0/firefox.exe"),
            fixture.roots.profile.clone(),
        )
        .unwrap();
    assert!(matches!(
        saved.add(
            fixture.root.join("another/firefox.exe"),
            fixture.roots.profile.clone()
        ),
        Err(Error::LimitExceeded)
    ));
    let mut bad = serde_json::to_value(&saved).unwrap();
    bad["targets"][0]["profilePath"] = "powershell -Command anything".into();
    assert!(SavedTargets::parse(&serde_json::to_vec(&bad).unwrap()).is_err());
}
#[test]
fn manifest_rejects_unknown_fields_duplicate_inventory_and_disabled_source_path() {
    let fixture = Fixture::new();
    let mut data = serde_json::to_value(&fixture.package.manifest).unwrap();
    data["unknown"] = true.into();
    assert!(Manifest::parse(&serde_json::to_vec(&data).unwrap()).is_err());
    let mut data = fixture.package.manifest.clone();
    data.expected_files.push(data.expected_files[0].clone());
    assert!(Manifest::parse(&serde_json::to_vec(&data).unwrap()).is_err());
    let mut data = fixture.package.manifest.clone();
    data.files[0].path = DISABLED.into();
    assert!(Manifest::parse(&serde_json::to_vec(&data).unwrap()).is_err());
}
