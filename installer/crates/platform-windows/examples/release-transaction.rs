// SPDX-License-Identifier: MPL-2.0
//! Local validation harness; never shipped in the installer distribution.
use fennevia_installer_core::{
    Error, Result, discovery,
    ownership::{Roots, status},
    package::Package,
    paths,
    planning::Action,
    release,
};
use fennevia_platform_windows::{security, worker};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};
use uuid::Uuid;

fn inventory(root: &Path, current: &Path, files: &mut BTreeMap<PathBuf, String>) -> Result<()> {
    if files.len() > 20000 {
        return Err(Error::LimitExceeded);
    }
    paths::no_reparse(current)?;
    for entry in fs::read_dir(current)? {
        let entry = entry?;
        if entry.file_type()?.is_dir() {
            inventory(root, &entry.path(), files)?;
        } else {
            files.insert(
                entry
                    .path()
                    .strip_prefix(root)
                    .map_err(|_| Error::InvalidPath)?
                    .into(),
                release::file_hash(&entry.path(), entry.metadata()?.len())?,
            );
        }
    }
    Ok(())
}
fn copy_tree(from: &Path, to: &Path) -> Result<()> {
    paths::no_reparse(from)?;
    fs::create_dir(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        paths::no_reparse(&entry.path())?;
        if entry.file_type()?.is_dir() {
            copy_tree(&entry.path(), &to.join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), to.join(entry.file_name()))?;
        }
    }
    Ok(())
}
fn run() -> Result<()> {
    let arguments: Vec<_> = std::env::args_os().skip(1).collect();
    if arguments.len() != 2 {
        return Err(Error::InvalidData);
    }
    let package = Package::read(Path::new(&arguments[0]))?;
    release::validate(&package)?;
    let firefox = discovery::firefox(Path::new(&arguments[1]))?;
    let program = firefox.path.parent().ok_or(Error::InvalidProgram)?;
    if program.join("fennevia.cfg").exists() || program.join(".fennevia").exists() {
        return Err(Error::Conflict);
    }
    let temp = fs::canonicalize(std::env::temp_dir())?;
    let root = PathBuf::from(
        temp.to_str()
            .ok_or(Error::InvalidPath)?
            .trim_start_matches(r"\\?\"),
    )
    .join(format!("fennevia-release-e2e-{}", Uuid::new_v4()));
    fs::create_dir(&root)?;
    let roots = Roots {
        program: root.join("Firefox"),
        profile: root.join("Fennevia Test Profile"),
    };
    copy_tree(program, &roots.program)?;
    fs::create_dir(&roots.profile)?;
    fs::write(
        roots.profile.join("user-sentinel.txt"),
        b"preserve this unrelated file",
    )?;
    let data = root.join("AppData/Mozilla/Firefox");
    fs::create_dir_all(&data)?;
    fs::write(
        data.join("profiles.ini"),
        format!(
            "[Profile0]\nName=Transaction test\nIsRelative=0\nPath={}\nDefault=1\n",
            roots.profile.display()
        ),
    )?;
    // This standalone test process changes its own environment before spawning anything.
    unsafe {
        std::env::set_var("APPDATA", root.join("AppData"));
    }
    let mut before = BTreeMap::new();
    inventory(&root, &root, &mut before)?;
    let execute = |action| -> Result<_> {
        let mut request = worker::Request {
            schema_version: 1,
            nonce: Uuid::new_v4(),
            created: worker::now()?,
            user_sid: security::user_sid()?,
            program: roots.program.clone(),
            profile: roots.profile.clone(),
            source: Some(package.root.clone()),
            action,
            installation_id: Uuid::new_v4(),
            digest: String::new(),
            target_identity: worker::identity(&roots)?,
            default_confirmed: true,
        };
        request.digest = worker::prepare(&request)?.digest;
        let result = worker::run(&request)?;
        if result.error.is_some() {
            return Err(Error::Io);
        }
        println!(
            "action={action:?} state={} mutations={}",
            result.state, result.mutations
        );
        Ok(result)
    };
    execute(Action::Install)?;
    if status(&roots)?.state != "enabled" {
        return Err(Error::Conflict);
    }
    if execute(Action::Update)?.mutations != 0 {
        return Err(Error::Conflict);
    }
    execute(Action::Disable)?;
    execute(Action::Enable)?;
    fs::remove_file(roots.program.join("fennevia.cfg"))?;
    // Update restores individually missing owned files; Repair deliberately
    // requires one complete owned side to be absent, matching the PS contract.
    execute(Action::Update)?;
    fs::remove_file(roots.program.join("fennevia.cfg"))?;
    fs::remove_file(roots.program.join("defaults/pref/fennevia.js"))?;
    fs::remove_file(
        roots
            .program
            .join(fennevia_installer_core::ownership::OWNERSHIP),
    )?;
    fs::remove_dir(roots.program.join(".fennevia"))?;
    execute(Action::Repair)?;
    execute(Action::Uninstall)?;
    let mut after = BTreeMap::new();
    inventory(&root, &root, &mut after)?;
    if before != after {
        return Err(Error::Conflict);
    }
    println!(
        "release lifecycle restored original file inventory; Firefox {} {}",
        firefox.version, firefox.build_id
    );
    // Only the UUID fixture created by this test is removed. Never the input tree.
    fs::remove_dir_all(root)?;
    Ok(())
}
fn main() {
    if let Err(error) = run() {
        eprintln!("RELEASE_TRANSACTION_FAILED: {error}");
        std::process::exit(1);
    }
}
