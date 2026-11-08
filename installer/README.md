<!-- SPDX-License-Identifier: MPL-2.0 -->
# Native Windows installer

Tauri 2/Svelte/Rust implements discovery, explicit saved locations, status,
preview, install/update/repair/disable/enable/uninstall, rollback and a separate
UAC worker. The GUI never invokes PowerShell. `scripts/fennevia.ps1` remains an
independent backup and shares the saved Firefox/profile pairs. Windows x64 is
the current target; choosing Tauri does not establish Linux support.

Extract the complete package and run `FenneviaSetup.exe` as a standard user.
Its adjacent release source is verified automatically. Select a Firefox build
and profile, optionally save the pair, preview the relative-path changes, then
confirm. Nothing is silently selected or installed. Close all Firefox processes.
Default profiles require extra confirmation. Firefox stable 153+ is accepted
with a warning; only 153/154/157/159 retain recorded browser compatibility evidence.
Source-tree writes remain restricted to marked development targets.

Saving persists only local paths and random IDs, at most ten pairs, in the
current user's `%LOCALAPPDATA%/Fennevia/Setup/targets.json`. Reuse validates the
targets again. Forget/clear never deletes Firefox or a profile. The release
PowerShell console scans registry/common locations and offers the same saved
pairs without requiring the native GUI or worker.

Build prerequisites: pinned Node/npm through nvm-windows, Rust 1.99.1, Visual
Studio C++ build tools and Windows x64. From the root install lint dependencies
with `npm ci --ignore-scripts`, then:

```text
cd installer
npm ci --ignore-scripts
npm run verify
cargo fmt --all --check
cargo clippy --locked --workspace --all-targets -- -D warnings
cargo test --locked --workspace
npm run build:native
npm run smoke:native
npm run package:native -- out/native
```

The packaging output must be empty. Packaging downloads the pinned Microsoft
WebView2 CAB on the build host only, verifies it and all 257 runtime files,
builds both executables, embeds the worker hash in the GUI, and assembles notices
and `INSTALLER-MANIFEST.json`. Repeated builds reuse the verified CAB cache.
The application itself does not download a runtime. Debug builds use an installed
WebView2; distributed builds require the complete fixed runtime. Review
`WEBVIEW2-LICENSE.txt` and `INSTALLER-NOTICES.txt` before use. The proprietary
runtime's redistribution terms are separate from Fennevia's MPL-2.0 license.

From a clean checkout, build the complete release with:

```powershell
pwsh -NoProfile -File scripts/build-release.ps1 -OutputDirectory .release `
  -NativeInstallerDirectory installer/out/native
```

`scripts/release-preflight.ps1` additionally builds in two independent Cargo
source and Cargo target directories and compares manifests and ZIP bytes. It requires a clean
checkout. Extracted GUI/worker smoke runs only from an unelevated token; elevated
build hosts report `nativeSmokeStatus=not-run` without weakening the GUI guard.
The manual GUI/UAC release gates still apply. It does not publish a release.
The old C#/WinForms launcher is retained
only for legacy fixtures/explicit fallback packaging, not the default release.

The GUI grants only bounded custom commands to the local window. Paths remain
behind host tokens, and apply consumes a single-use approval bound to source,
target identities and a recomputed plan. Real worker phase/count progress has no
paths; it is advisory and cannot interrupt rollback. All file writes are native.

Only a cleanly rolled-back access-denied attempt, followed by a failed program
write probe, offers **Continue with Windows administrator approval**. Clicking
it starts the fixed worker through UAC. The GUI stays unelevated and another
account's credentials are rejected. No automatic retry follows cancellation.

Unknown results must not be retried blindly. Reopen and inspect the targets.
Incomplete rollback or unacknowledged results leave `.fennevia-transaction-*`
directories; both engines block further writes. Preserve journals, backups,
stashed originals and `result.json` for explicit recovery. The receipt describes
mutation state; it is not permission to delete the journal. Disable/Uninstall
can use valid ownership without a working package source.

The smoke command accepts an optional path to a distributed EXE and checks actual
frontend-ready IPC plus an authenticated, non-mutating worker request. It does
not certify visual/keyboard interaction or secure-desktop UAC. Tests may invoke
PowerShell for cross-engine fixtures; neither shipping executable does so.

Current evidence and unrun manual release checks are in
[`tauri-installer-release-validation.md`](../docs/research/tauri-installer-release-validation.md).
Initial and transaction-only records describe earlier increments. The first
native-installer release candidate is `0.20.0-beta.1`; publication and current
browser evidence are tracked in
[`Firefox 159 release validation`](../docs/research/firefox-159-0.20.0-beta.1-release-validation.md).
