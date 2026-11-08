<!-- SPDX-License-Identifier: MPL-2.0 -->

Fennevia `0.20.0-beta.1` is a Windows x64 prerelease following
[`v0.19.0-beta.1`](https://github.com/yutinglia/fennevia/releases/tag/v0.19.0-beta.1).

- **Local extensions that return after restart.** Open **Customize → Local
  extensions**, choose a Firefox-compatible folder or XPI/ZIP, review its access
  and confirm. Fennevia keeps a managed copy, so moving the original download
  does not break restoration. Enable, disable, reload, update and remove it from
  the same page. A fixed author-provided Gecko ID is required; Chrome CRX files
  and Chrome-only APIs are not converted. The first version accepts ordinary
  paths on the Windows system drive only.
- **A native Windows installer.** The Tauri/Svelte interface and separate Rust
  worker provide discovery, explicitly remembered Firefox/profile pairs,
  previews, installation, updates, repair and recovery. The GUI stays unelevated;
  administrator access is an explicit worker handoff. The complete archive
  bundles an offline WebView2 runtime and its license/notices. It is larger than
  previous packages, and the unsigned executables may trigger SmartScreen.
- **Portable Fennevia settings.** Preview and confirm local export/import of
  layout, appearance, panel and interaction settings. Extension packages,
  identities and paths are not included in these backups.
- **Independent panel scrolling.** Overflow stays within its configured
  Row/Column, preserving adjacent widgets and configured window-control placement.

Local extension restoration uses Firefox's native temporary installation, not
permanent unsigned installation. It may repeat `runtime.onInstalled` instead of
`runtime.onStartup`; a third-party extension may reopen its welcome page or reset
its own data. Known same-ID conflicts are rejected, but concurrent installation
by another tool can still be replaced by an already-started Firefox operation.
Only trust packages from authors you trust. Signing policy and private access are
unchanged; signed packages can still use Firefox's normal installation.

Automated validation covers stock Firefox **159.0.1**, BuildID
`20261102144711`, on Windows x64. Firefox 153/154/157 evidence is historical.
The installer accepts release-channel Firefox 153+ with its explicit compatibility
warning. This is not a stable, cross-platform or all-extensions compatibility
promise. Linux, macOS, ESR, Beta and Nightly remain outside scope.

Download the Windows ZIP and matching checksum, then compare the first checksum
field with:

```powershell
(Get-FileHash -Algorithm SHA256 .\fennevia-0.20.0-beta.1-windows.zip).Hash.ToLowerInvariant()
```

Extract the whole package and read `INSTALL.md`, `RELEASE-MANIFEST.json`,
`INSTALLER-NOTICES.txt` and `WEBVIEW2-LICENSE.txt`. Run `FenneviaSetup.exe` as a
standard user. Installation needs no Node.js, npm, Rust or PowerShell; the
independent PowerShell console remains available as a backup. Keep the exact
archive for recovery, and use a dedicated Firefox profile.

Exact release evidence and remaining test limits:
[Firefox 159 validation](https://github.com/yutinglia/fennevia/blob/main/docs/research/firefox-159-0.20.0-beta.1-release-validation.md).
See also the [local extension guide](https://github.com/yutinglia/fennevia/blob/main/docs/local-extensions.md).
The owner explicitly approved a one-release exception for remaining manual UAC,
clean-machine, physical interruption, accessibility/DPI/input and real-account,
extension/permission/early-network checks. Those rows remain **not run**; automated
fixtures do not establish those results. Fennevia continues to use unsupported
privileged Firefox internals and has not completed an independent security audit.
