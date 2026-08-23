<!-- SPDX-License-Identifier: MPL-2.0 -->

This is Fennevia `0.14.0-beta.1`, the fifth public Windows x64 prerelease.
It follows [`v0.13.0-beta.1`](https://github.com/yutinglia/fennevia/releases/tag/v0.13.0-beta.1).

Validated compatibility remains intentionally narrow: tested on stock Firefox
153.0.4 BuildID 20260810162159 and 154.0 BuildID 20260812182057, release
channel. Later Firefox versions may break the shell; confirming install does
not promise that everything will work. Review `INSTALL.md` and
`RELEASE-MANIFEST.json` inside the archive before installation, use a dedicated
Firefox profile, and verify the separately published SHA-256 file.

In PowerShell, compare the first field of the downloaded `.sha256` file with:

```powershell
(Get-FileHash -Algorithm SHA256 .\fennevia-0.14.0-beta.1-windows.zip).Hash.ToLowerInvariant()
```

This minor collects the tab-strip work added after `v0.13.0-beta.1`:

- Firefox-owned tab multi-select from the vertical strip: Accel toggles without
  activating, Shift selects a visible-tab range, a plain click on an already
  multi-selected background tab activates and keeps the set, group drag and
  `Ctrl+Shift+Arrow` move the same-pinned set, and row close/mute/pin plus the
  native tab context menu operate on that Firefox-owned selection
- middle-click or Accel-click New Tab inserts a related tab after the current
  tab, while ordinary left-click New Tab still appends at the default end
- auxiliary pointer actions keep the current tab, so middle-click close and
  related New Tab do not first select the clicked row
- neighbor tabs stay still when a dragged tab is dropped, instead of jumping
  into a leftover preview gap

This identity bump does not re-run the `0.12.0-beta.1` Firefox 154 automated
lifecycle, recovery, performance-control, archive, or extracted-package
installer matrix. Those results remain the last recorded release-matrix
evidence. Remaining real-Firefox visual, assistive, account/device,
popup-placement, customize, first-paint, GUI installer, and representative
Urlbar-provider rows stay pending.

Tab multi-select remains Firefox-owned; Fennevia snapshots the native
`multiselected` attribute and does not keep a second selected-id set. Drag
metadata leaving the privileged boundary is limited to opaque tab IDs and an
integer count. No dependency, content-accessible resource mapping, or
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
