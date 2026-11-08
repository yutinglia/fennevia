// SPDX-License-Identifier: MPL-2.0
use fennevia_installer_core::{package::Package, paths, release};
use serde_json::json;
use std::{fs, path::Path};

#[test]
fn release_inventory_hashes_metadata_and_text_policy_are_enforced() {
    let source = Path::new(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .nth(3)
        .unwrap();
    let root = std::env::temp_dir().join(format!("fennevia-release-test-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&root).unwrap();
    let package = Package::read(source).unwrap();
    let mut paths_to_copy: Vec<String> = [
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
        "scripts/lib/FenneviaLocations.psm1",
        "scripts/lib/ConsoleLocations.ps1",
        "scripts/lib/NativeDistribution.ps1",
    ]
    .map(String::from)
    .to_vec();
    for file in &package.manifest.files {
        let scope = if file.scope == fennevia_installer_core::ownership::Scope::Program {
            "program"
        } else {
            "profile"
        };
        paths_to_copy.push(format!("{scope}/{}", file.path));
    }
    let mut files = Vec::new();
    for path in paths_to_copy {
        let bytes = if path == "FenneviaSetup.exe" {
            b"fixture container entry; never executed".to_vec()
        } else {
            fs::read(source.join(if path == "INSTALL.md" {
                "release/INSTALL.md"
            } else {
                &path
            }))
            .unwrap()
        };
        fs::create_dir_all(root.join(&path).parent().unwrap()).unwrap();
        fs::write(root.join(&path), &bytes).unwrap();
        files.push(json!({"path":path,"sha256":paths::hash(&bytes),"size":bytes.len()}));
    }
    let version = package.manifest.package_version;
    let manifest = json!({
        "schemaVersion":1,"packageId":"fennevia","license":"MPL-2.0","version":version,"tag":format!("v{version}"),"prerelease":true,
        "source":{"repository":"https://github.com/yutinglia/fennevia","commit":"1".repeat(40),"archive":format!("https://github.com/yutinglia/fennevia/archive/refs/tags/v{version}.zip")},
        "release":{"archive":format!("fennevia-{version}-windows.zip"),"checksum":format!("fennevia-{version}-windows.zip.sha256"),"platform":"windows","testedArchitecture":"x64"},
        "packageManifestSha256":package.digest,
        "firefoxCompatibility":[{"version":"157.0","buildId":"20260924084938","channel":"release"}],
        "compatibilityRecord":"docs/research/fixture.md","knownLimitations":["test only"],"files":files
    });
    let write = |value: &serde_json::Value| {
        fs::write(
            root.join("RELEASE-MANIFEST.json"),
            serde_json::to_vec(value).unwrap(),
        )
        .unwrap()
    };
    write(&manifest);
    let package = Package::read(&root).unwrap();
    assert!(release::validate(&package).is_ok());
    for (field, value) in [
        ("schemaVersion", json!(2)),
        ("packageManifestSha256", json!("0".repeat(64))),
        ("tag", json!("v0.0.0")),
        ("prerelease", json!(false)),
        ("unknown", json!(true)),
    ] {
        let mut changed = manifest.clone();
        changed[field] = value;
        write(&changed);
        assert!(release::validate(&package).is_err(), "{field}");
    }
    write(&manifest);
    fs::write(root.join("unexpected.txt"), b"extra").unwrap();
    assert!(release::validate(&package).is_err());
    fs::remove_file(root.join("unexpected.txt")).unwrap();
    fs::write(root.join("LICENSE"), b"tampered").unwrap();
    assert!(release::validate(&package).is_err());
    // Even a rehashed release is rejected for leaked machine-specific data.
    let secret = b"C:\\Users\\private-fixture\\profile";
    fs::write(root.join("LICENSE"), secret).unwrap();
    let mut changed = manifest.clone();
    for file in changed["files"].as_array_mut().unwrap() {
        if file["path"] == "LICENSE" {
            file["sha256"] = json!(paths::hash(secret));
            file["size"] = json!(secret.len());
        }
    }
    write(&changed);
    assert!(release::validate(&package).is_err());
    fs::remove_dir_all(root).unwrap();
}
