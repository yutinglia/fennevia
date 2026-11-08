// SPDX-License-Identifier: MPL-2.0
use super::*;
use fennevia_installer_core::{
    ownership::{self, State},
    package::Package,
    planning::{self, Action},
};
use std::collections::BTreeMap;
struct Fixture {
    root: PathBuf,
    roots: Roots,
    package: Package,
    id: Uuid,
}
impl Fixture {
    fn new() -> Self {
        let canonical = fs::canonicalize(std::env::temp_dir()).unwrap();
        let temp = PathBuf::from(canonical.to_str().unwrap().trim_start_matches(r"\\?\"));
        let root = temp.join(format!("fennevia-tx-{}", Uuid::new_v4()));
        let roots = Roots {
            program: root.join("Firefox"),
            profile: root.join("Profile"),
        };
        fs::create_dir_all(roots.program.join("defaults/pref")).unwrap();
        fs::create_dir(&roots.profile).unwrap();
        let source = root.join("Source");
        let mut files = Vec::new();
        for (scope, path, content) in [
            (
                "program",
                "defaults/pref/fennevia.js",
                "pref('general.config.filename', 'fennevia.cfg');",
            ),
            ("program", "fennevia.cfg", "// fixture"),
            (
                "profile",
                "chrome/fennevia/chrome.manifest",
                "content fennevia content/",
            ),
            (
                "profile",
                "chrome/fennevia/content/Bootstrap.sys.mjs",
                "export const fixture = true;",
            ),
        ] {
            let full = source.join(scope).join(path);
            fs::create_dir_all(full.parent().unwrap()).unwrap();
            fs::write(full, content).unwrap();
            files.push(serde_json::json!({"scope":scope,"path":path,"sha256":paths::hash(content.as_bytes())}));
        }
        fs::write(source.join("package-manifest.json"),serde_json::to_vec(&serde_json::json!({"schemaVersion":1,"packageId":"fennevia","packageVersion":"0.19.0-beta.1","expectedFiles":["chrome.manifest","content/Bootstrap.sys.mjs"],"files":files})).unwrap()).unwrap();
        let package = Package::read(&source).unwrap();
        Self {
            root,
            roots,
            package,
            id: Uuid::new_v4(),
        }
    }
    fn plan(&self, action: Action) -> Preview {
        planning::preview(&self.roots, action, Some(&self.package), self.id).unwrap()
    }
    fn apply(&self, action: Action) -> Outcome {
        let digest = self.plan(action).digest;
        execute(&self.roots, &digest, || Ok(self.plan(action))).unwrap()
    }
}

fn powershell(f: &Fixture, shell: &str, action: &str) -> std::process::Output {
    use std::os::windows::process::CommandExt;
    fs::write(f.roots.program.join("firefox.exe"), b"fixture only").unwrap();
    fs::write(
        f.roots.program.join("application.ini"),
        "[App]\nName=Firefox\nVersion=157.0\nBuildID=20260924084938\n",
    )
    .unwrap();
    fs::write(
        f.roots.profile.join(".fennevia-dev-profile.json"),
        r#"{"schemaVersion":1,"owner":"fennevia","profileName":"fennevia-dev"}"#,
    )
    .unwrap();
    std::process::Command::new(shell)
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
        ])
        .arg(Path::new(env!("CARGO_MANIFEST_DIR")).join("../../tests/cross-engine.ps1"))
        .arg(action)
        .env("FENNEVIA_TEST_PROGRAM", f.roots.program.join("firefox.exe"))
        .env("FENNEVIA_TEST_PROFILE", &f.roots.profile)
        .env("FENNEVIA_TEST_SOURCE", &f.package.root)
        .env_remove("PSModulePath")
        .creation_flags(windows_sys::Win32::System::Threading::CREATE_NO_WINDOW)
        .output()
        .unwrap()
}
fn ps_ok(f: &Fixture, shell: &str, action: &str) -> serde_json::Value {
    let output = powershell(f, shell, action);
    assert!(
        output.status.success(),
        "{shell} {action} failed: {}",
        String::from_utf8_lossy(&output.stdout)
    );
    serde_json::from_slice(&output.stdout).unwrap()
}
#[test]
fn powershell_51_and_7_share_lifecycle_and_locks_with_rust() {
    for shell in ["powershell.exe", "pwsh.exe"] {
        let f = Fixture::new();
        assert_eq!(f.apply(Action::Install).state, "committed");
        assert_eq!(ps_ok(&f, shell, "Install")["Applied"], false);
        fs::remove_file(f.roots.program.join("fennevia.cfg")).unwrap();
        ps_ok(&f, shell, "Update");
        ps_ok(&f, shell, "Disable");
        assert_eq!(f.apply(Action::Enable).state, "committed");
        fs::remove_dir_all(f.roots.profile.join("chrome")).unwrap();
        fs::remove_dir_all(f.roots.profile.join(".fennevia")).unwrap();
        ps_ok(&f, shell, "Repair");
        assert_eq!(f.apply(Action::Disable).state, "committed");
        ps_ok(&f, shell, "Enable");
        ps_ok(&f, shell, "Uninstall");
        ps_ok(&f, shell, "Install");
        assert_eq!(f.apply(Action::Install).state, "unchanged");
        assert_eq!(f.apply(Action::Update).state, "unchanged");
        fs::remove_file(f.roots.program.join("fennevia.cfg")).unwrap();
        assert_eq!(f.apply(Action::Update).state, "committed");
        assert_eq!(f.apply(Action::Disable).state, "committed");
        ps_ok(&f, shell, "Enable");
        fs::remove_dir_all(f.roots.profile.join("chrome")).unwrap();
        fs::remove_dir_all(f.roots.profile.join(".fennevia")).unwrap();
        assert_eq!(f.apply(Action::Repair).state, "committed");
        let lock = Lock::acquire(&format!("target:{}", paths::key(&f.roots.program))).unwrap();
        let output = powershell(&f, shell, "Uninstall");
        assert!(!output.status.success());
        assert!(String::from_utf8_lossy(&output.stdout).contains("FENNEVIA_INSTALL_BUSY"));
        drop(lock);
        assert_eq!(f.apply(Action::Uninstall).state, "committed");
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        assert_eq!(
            fs::canonicalize(self.root.parent().unwrap()).unwrap(),
            fs::canonicalize(std::env::temp_dir()).unwrap()
        );
        assert!(
            self.root
                .file_name()
                .unwrap()
                .to_string_lossy()
                .starts_with("fennevia-tx-")
        );
        fs::remove_dir_all(&self.root).unwrap();
    }
}
fn tree(root: &Path) -> BTreeMap<PathBuf, Vec<u8>> {
    let mut out = BTreeMap::new();
    fn visit(base: &Path, path: &Path, out: &mut BTreeMap<PathBuf, Vec<u8>>) {
        for entry in fs::read_dir(path).unwrap() {
            let path = entry.unwrap().path();
            let key = path.strip_prefix(base).unwrap().to_owned();
            if path.is_dir() {
                out.insert(key, Vec::new());
                visit(base, &path, out);
            } else {
                out.insert(key, fs::read(path).unwrap());
            }
        }
    }
    visit(root, root, &mut out);
    out
}
#[test]
fn lifecycle_commits_and_preserves_unrelated_files() {
    let f = Fixture::new();
    let before = tree(&f.roots.program);
    assert_eq!(f.apply(Action::Install).state, "committed");
    assert_eq!(f.apply(Action::Install).state, "unchanged");
    assert_eq!(f.apply(Action::Disable).state, "committed");
    assert_eq!(
        f.roots.read_ownership().unwrap().record.unwrap().state,
        State::Disabled
    );
    assert_eq!(f.apply(Action::Enable).state, "committed");
    fs::remove_file(f.roots.program.join("fennevia.cfg")).unwrap();
    assert_eq!(f.apply(Action::Update).state, "committed");
    fs::write(f.roots.profile.join("chrome/userChrome.css"), "user").unwrap();
    assert_eq!(f.apply(Action::Uninstall).state, "committed");
    assert_eq!(tree(&f.roots.program), before);
    assert_eq!(
        fs::read(f.roots.profile.join("chrome/userChrome.css")).unwrap(),
        b"user"
    );
    assert_eq!(ownership::status(&f.roots).unwrap().state, "absent");
}

#[test]
fn real_progress_reports_mutation_and_rollback_without_paths() {
    let f = Fixture::new();
    let original = tree(&f.roots.program);
    let plan = f.plan(Action::Install);
    let mut progress = Vec::new();
    let result = execute_controlled(
        &f.roots,
        &plan.digest,
        || Ok(f.plan(Action::Install)),
        |count| if count == 2 { Err(Error::Io) } else { Ok(()) },
        |_| Ok(()),
        |value| progress.push(value),
    )
    .unwrap();
    assert_eq!(result.state, "rolledBack");
    assert_eq!(tree(&f.roots.program), original);
    assert!(
        progress
            .iter()
            .any(|v| matches!(v.phase, Phase::Applying) && v.completed == 2)
    );
    assert!(
        progress
            .iter()
            .any(|v| matches!(v.phase, Phase::RollingBack))
    );
    assert!(matches!(progress.last().unwrap().phase, Phase::Finishing));
    assert!(
        progress
            .iter()
            .all(|v| v.completed <= v.total && v.total == plan.operations.len())
    );
}
#[test]
fn every_operation_boundary_restores_the_original_tree() {
    for action in [
        Action::Install,
        Action::Update,
        Action::Disable,
        Action::Enable,
        Action::Repair,
        Action::Uninstall,
    ] {
        let setup = |f: &mut Fixture| {
            if action != Action::Install {
                assert_eq!(f.apply(Action::Install).state, "committed");
            }
            if action == Action::Enable {
                assert_eq!(f.apply(Action::Disable).state, "committed");
            }
            if action == Action::Repair {
                fs::remove_dir_all(f.roots.profile.join(".fennevia")).unwrap();
                fs::remove_dir_all(f.roots.profile.join("chrome")).unwrap();
            }
            if action == Action::Update {
                let key = (Scope::Program, "fennevia.cfg".to_owned());
                let bytes = b"// updated fixture".to_vec();
                let hash = paths::hash(&bytes);
                f.package.contents.insert(key, bytes);
                f.package
                    .manifest
                    .files
                    .iter_mut()
                    .find(|file| file.path == "fennevia.cfg")
                    .unwrap()
                    .sha256 = hash;
                f.package.digest = "d".repeat(64);
            }
        };
        let mut probe = Fixture::new();
        setup(&mut probe);
        let count = probe.plan(action).operations.len();
        drop(probe);
        for fail in 0..=count {
            let mut f = Fixture::new();
            setup(&mut f);
            let before = tree(&f.root);
            let digest = f.plan(action).digest;
            let result = execute_inner(
                &f.roots,
                &digest,
                || Ok(f.plan(action)),
                |step| if step == fail { Err(Error::Io) } else { Ok(()) },
            )
            .unwrap();
            assert_eq!(result.state, "rolledBack", "{action:?} at {fail}");
            assert!(
                tree(&f.root) == before,
                "tree differs: {action:?} at {fail}"
            );
        }
    }
}
#[test]
fn stale_preview_and_hardlinks_are_rejected_before_mutation() {
    let f = Fixture::new();
    let before = tree(&f.root);
    assert!(matches!(
        execute(&f.roots, &"a".repeat(64), || Ok(f.plan(Action::Install))),
        Err(Error::Stale)
    ));
    assert_eq!(tree(&f.root), before);
    f.apply(Action::Install);
    fs::hard_link(
        f.roots.program.join("fennevia.cfg"),
        f.root.join("outside.cfg"),
    )
    .unwrap();
    let before = tree(&f.root);
    let digest = f.plan(Action::Uninstall).digest;
    let result = execute(&f.roots, &digest, || Ok(f.plan(Action::Uninstall))).unwrap();
    assert_eq!(result.state, "rolledBack");
    assert_eq!(tree(&f.root), before);
}

#[test]
fn failure_between_replacement_renames_restores_bytes_and_directories() {
    let f = Fixture::new();
    f.apply(Action::Install);
    let before = tree(&f.root);
    let plan = f.plan(Action::Disable);
    let index = plan
        .operations
        .iter()
        .position(|op| op.kind == Kind::ReplaceFile)
        .unwrap();
    let result = execute_inner(
        &f.roots,
        &plan.digest,
        || Ok(f.plan(Action::Disable)),
        |step| {
            if step == usize::MAX - index {
                Err(Error::Io)
            } else {
                Ok(())
            }
        },
    )
    .unwrap();
    assert_eq!(result.state, "rolledBack");
    assert!(tree(&f.root) == before);
}
#[test]
fn lost_acknowledgement_retains_receipts_and_blocks_both_engines() {
    let f = Fixture::new();
    let plan = f.plan(Action::Install);
    let result = execute_report(
        &f.roots,
        &plan.digest,
        || Ok(f.plan(Action::Install)),
        |_| Err(Error::Io),
    );
    assert!(matches!(result, Err(Error::CommittedCleanup)));
    assert!(matches!(f.roots.read_ownership(), Err(Error::Busy)));
    for root in [&f.roots.program, &f.roots.profile] {
        let area = fs::read_dir(root)
            .unwrap()
            .map(|entry| entry.unwrap().path())
            .find(|path| {
                path.file_name()
                    .unwrap()
                    .to_string_lossy()
                    .starts_with(".fennevia-transaction-")
            })
            .unwrap();
        assert!(area.join("journal.json").is_file());
        let outcome: Outcome =
            serde_json::from_slice(&fs::read(area.join("result.json")).unwrap()).unwrap();
        assert_eq!(outcome.state, "committed");
    }
    let output = powershell(&f, "pwsh.exe", "Uninstall");
    assert!(!output.status.success());
    assert!(
        String::from_utf8_lossy(&output.stdout)
            .contains("FENNEVIA_INSTALL_INTERRUPTED_TRANSACTION")
    );
}
