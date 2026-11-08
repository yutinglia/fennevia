// SPDX-License-Identifier: MPL-2.0
#![windows_subsystem = "windows"]
mod execution;
mod targets;
mod webview_privacy;
use std::sync::Mutex;
use tauri::Manager;
fn local_page(url: &tauri::Url) -> bool {
    url.scheme() == "http"
        && url.host_str() == Some("tauri.localhost")
        && url.port().is_none()
        && url.username().is_empty()
        && url.password().is_none()
        && matches!(url.path(), "/" | "/index.html")
        && url.query().is_none()
        && url.fragment().is_none()
}
#[tauri::command]
async fn frontend_ready(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
) -> fennevia_installer_core::Result<()> {
    if window.label() != "main"
        || !local_page(
            &window
                .url()
                .map_err(|_| fennevia_installer_core::Error::Permission)?,
        )
    {
        return Err(fennevia_installer_core::Error::Permission);
    }
    if std::env::args_os().any(|argument| argument == "--smoke-test") {
        app.exit(0);
    }
    Ok(())
}
fn main() {
    let arguments: Vec<_> = std::env::args_os().skip(1).collect();
    let smoke = arguments.len() == 1 && arguments[0] == "--smoke-test";
    let worker_smoke = arguments.len() == 1 && arguments[0] == "--worker-smoke-test";
    if !arguments.is_empty() && !smoke && !worker_smoke {
        std::process::exit(1);
    }
    if fennevia_platform_windows::security::is_elevated() != Ok(false) {
        rfd::MessageDialog::new()
            .set_title("Fennevia Setup")
            .set_description(
                "Start Fennevia Setup as a standard user.\n請以一般使用者權限啟動 Fennevia Setup。",
            )
            .set_level(rfd::MessageLevel::Error)
            .show();
        std::process::exit(1);
    }
    // Development builds may use the host's installed runtime. Distributed builds
    // require the pinned offline runtime and fail before starting a WebView.
    let image = fennevia_platform_windows::security::current_image()
        .unwrap_or_else(|_| std::process::exit(1));
    let root = image.parent().unwrap_or_else(|| std::process::exit(1));
    if !cfg!(debug_assertions) || root.join("INSTALLER-MANIFEST.json").exists() {
        if fennevia_installer_core::distribution::validate(root).is_err() {
            if smoke || worker_smoke {
                std::process::exit(1);
            }
            rfd::MessageDialog::new().set_title("Fennevia Setup")
                .set_description("Installer files are missing or changed. Extract the complete package again.\n安裝器檔案缺失或變更，請重新解壓縮完整套件。")
                .set_level(rfd::MessageLevel::Error).show();
            std::process::exit(1);
        }
        // Windows environment mutation is safe here, before the runtime/threads.
        unsafe {
            std::env::set_var("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER", root.join("WebView2"));
        }
    }
    if worker_smoke {
        std::process::exit(if execution::worker_smoke() == Ok(()) {
            0
        } else {
            1
        });
    }
    let result = tauri::Builder::default()
        .manage(Mutex::new(targets::Session::default()))
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<Mutex<targets::Session>>();
                if state.lock().map(|s| s.execution.busy).unwrap_or(true) {
                    api.prevent_close();
                }
            }
        })
        .setup(move |app| {
            if smoke {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(25));
                    handle.exit(1);
                });
            }
            let mut configuration = app.config().app.windows[0].clone();
            configuration.url = tauri::WebviewUrl::External("about:blank".parse()?);
            let ready = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
            let navigation_ready = ready.clone();
            let window = tauri::WebviewWindowBuilder::from_config(app, &configuration)?
                .on_navigation(move |url| {
                    local_page(url)
                        || (!navigation_ready.load(std::sync::atomic::Ordering::Acquire)
                            && url.as_str() == "about:blank")
                })
                .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
                .incognito(true)
                .visible(false)
                .build()?;
            let configured_window = window.clone();
            window.with_webview(move |webview| {
                if webview_privacy::configure(webview).is_err() {
                    configured_window.app_handle().exit(1);
                    return;
                }
                ready.store(true, std::sync::atomic::Ordering::Release);
                // Window dispatch is synchronous; do not call it while holding
                // Wry's UI-thread WebView callback. Return before dispatching it.
                tauri::async_runtime::spawn_blocking(move || {
                    if configured_window
                        .navigate(
                            "http://tauri.localhost/index.html"
                                .parse()
                                .expect("fixed app URL"),
                        )
                        .is_err()
                        || (!smoke && configured_window.show().is_err())
                    {
                        configured_window.app_handle().exit(1);
                    }
                });
            })?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            frontend_ready,
            targets::scan_targets,
            targets::pick_target,
            targets::save_target,
            targets::forget_target,
            targets::clear_targets,
            targets::inspect_targets,
            targets::pick_package,
            targets::bundled_package,
            targets::preview_action,
            execution::apply_action,
            execution::installation_progress
        ])
        .run(tauri::generate_context!());
    if result.is_err() {
        if !smoke {
            rfd::MessageDialog::new().set_title("Fennevia Setup")
                .set_description("The installer window could not start. Extract the complete package to a local folder, or use scripts/fennevia.ps1.\n無法啟動安裝視窗。請重新解壓縮至本機資料夾，或使用 scripts/fennevia.ps1 備援。")
                .set_level(rfd::MessageLevel::Error).show();
        }
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn navigation_is_limited_to_the_embedded_document() {
        for url in [
            "http://tauri.localhost/",
            "http://tauri.localhost/index.html",
        ] {
            assert!(local_page(&url.parse().unwrap()));
        }
        for url in [
            "https://example.test/",
            "http://tauri.localhost.example.test/",
            "http://tauri.localhost:8080/",
            "http://user@tauri.localhost/",
            "http://tauri.localhost/?command=write",
            "http://tauri.localhost/other",
            "file:///C:/private",
            "data:text/html,test",
        ] {
            assert!(!local_page(&url.parse().unwrap()));
        }
    }
}
