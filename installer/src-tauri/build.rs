// SPDX-License-Identifier: MPL-2.0
fn main() {
    println!("cargo:rerun-if-env-changed=FENNEVIA_WORKER_SHA256");
    if let Ok(hash) = std::env::var("FENNEVIA_WORKER_SHA256") {
        assert!(hash.len() == 64 && hash.bytes().all(|v| v.is_ascii_hexdigit()));
        println!("cargo:rustc-env=FENNEVIA_WORKER_SHA256={hash}");
    }
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "frontend_ready",
            "scan_targets",
            "pick_target",
            "save_target",
            "forget_target",
            "clear_targets",
            "inspect_targets",
            "pick_package",
            "bundled_package",
            "preview_action",
            "apply_action",
            "installation_progress",
        ]),
    ))
    .expect("installer build configuration failed");
}
