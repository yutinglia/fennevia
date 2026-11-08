# Fennevia privacy patch

Upstream: `wravery/webview2-rs`, commit
`edc2caf886175ccaebe86078c9cfe1ae2a187328`, crate `webview2-com` 0.39.1,
path `crates/webview2-com`. License: MIT, Copyright (c) 2021 Bill Avery;
see `LICENSE`, retrieved from that exact commit.

The published crate's source and normalized Cargo manifest are retained.
The sole implementation change is the default value of
`is_custom_crash_reporting_enabled` in `src/options.rs`: `false` to `true`.
This calls the WebView2 option that prevents sending crash dumps to Microsoft.
Fennevia does not supply an alternate uploader. Local crash files remain OS/runtime
data and must not be attached to issue reports.

Wry 0.57.1 constructs these options internally and does not expose this setting
through Tauri 2.12.5. Remove this patch once the pinned stack exposes the option;
set it explicitly and retain the regression test before changing the default.
Do not replace it with unsupported Chromium command-line flags.

The root installer notice generator includes this license and identifies this
modified source at the Fennevia source commit. No external loader code was used.

Reference: [Microsoft option contract](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/winrt/microsoft_web_webview2_core/corewebview2environmentoptions).
