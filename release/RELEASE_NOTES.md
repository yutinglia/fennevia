<!-- SPDX-License-Identifier: MPL-2.0 -->

This is Fennevia `0.12.0-beta.1`, the third public Windows x64 prerelease.
It follows [`v0.11.0-beta.1`](https://github.com/yutinglia/fennevia/releases/tag/v0.11.0-beta.1).

Validated compatibility remains intentionally narrow: tested on stock Firefox
153.0.4 BuildID 20260810162159 and 154.0 BuildID 20260812182057, release
channel. Later Firefox versions may break the shell; confirming install does
not promise that everything will work. Review `INSTALL.md` and
`RELEASE-MANIFEST.json` inside the archive before installation, use a dedicated
Firefox profile, and verify the separately published SHA-256 file.

In PowerShell, compare the first field of the downloaded `.sha256` file with:

```powershell
(Get-FileHash -Algorithm SHA256 .\fennevia-0.12.0-beta.1-windows.zip).Hash.ToLowerInvariant()
```

This minor collects the shell, interaction, and installer work added after
`v0.11.0-beta.1`:

- an accessible bounded result list backed by Firefox's existing Urlbar
  providers, ranking, search modes, and native `pickResult` execution, with
  complete native-Urlbar handoff for rich or unknown rows
- configurable edge trigger thickness and separate in-window/window-leave hide
  timing, temporary reveal timing, and optional shortcut hints
- packaged Firefox icons, native tab status indicators, one unified Trust
  summary, complete four-panel context menus, and stronger Firefox-owned popup
  handoffs
- spatial tab dragging with a live source row, full-row ghost, insertion gap,
  same-kind cross-window adoption, browser-content append, and Firefox-owned
  external detach
- restored Account, Library, All Tabs, menu, and compound toolbar-widget
  activation, including the live localized Zoom percentage
- fixes for duplicate middle-click navigation, address-popup focus release,
  side-drag reveal suppression, and tab-panel hold restoration after closing a
  row under the pointer
- WinForms installer event-flow/scaling fixes plus stricter fail-open,
  ownership, and cleanup boundaries
- an internal source-layout modularization that preserves the existing bridge,
  edge-controller, and generated-artifact contracts

The new Urlbar projection adds no Fennevia search engine, provider, telemetry,
or network endpoint. Cross-window tab transfer uses one short-lived,
normal/private-separated privileged coordinator and carries no URL or title in
the OS drag payload. No dependency, content-accessible resource mapping, or
automatic updater is added.

The annotated release tag identifies the corresponding source. The archive's
`RELEASE-MANIFEST.json` records the complete source commit and preferred-source
URL; `INSTALL.md` contains install, update, hard-disable, repair, enable,
uninstall, and Firefox-update recovery commands. The release validation record
distinguishes automated, real-Firefox, and manual observations without
inferring GUI behavior from CI.

Fennevia relies on unsupported privileged Firefox internals and has not yet
completed an independent security audit. Linux, macOS, Firefox ESR, Beta, and
Nightly are not supported by this package.
