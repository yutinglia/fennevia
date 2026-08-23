<!-- SPDX-License-Identifier: MPL-2.0 -->

This is Fennevia `0.13.0-beta.1`, the fourth public Windows x64 prerelease.
It follows [`v0.12.0-beta.1`](https://github.com/yutinglia/fennevia/releases/tag/v0.12.0-beta.1).

Validated compatibility remains intentionally narrow: tested on stock Firefox
153.0.4 BuildID 20260810162159 and 154.0 BuildID 20260812182057, release
channel. Later Firefox versions may break the shell; confirming install does
not promise that everything will work. Review `INSTALL.md` and
`RELEASE-MANIFEST.json` inside the archive before installation, use a dedicated
Firefox profile, and verify the separately published SHA-256 file.

In PowerShell, compare the first field of the downloaded `.sha256` file with:

```powershell
(Get-FileHash -Algorithm SHA256 .\fennevia-0.13.0-beta.1-windows.zip).Hash.ToLowerInvariant()
```

This minor collects the shell work added after `v0.12.0-beta.1`:

- owner-configurable edge-panel roles: swap Tabs and Bookmarks between left and
  right, optionally disable the bottom Downloads surface, and independently
  choose loading, downloads, or off for each gutter light
- cached raster bookmark favicons from Firefox's local Places store, plus
  middle-click open in a new tab
- a compact, theme-aware restyle of Firefox's retained corner status label
  while Fennevia is active
- an opt-in compact-window setting that clears Firefox chrome min-width and
  min-height while Fennevia is active and not suspended, then restores them on
  dispose, suspend, or the default
- a tabbed customize drawer (widgets, panels, interaction, appearance) instead
  of one stacked scrolling form
- quieter bookmarks: the persistent Ctrl/Command+Enter status hint is removed;
  the status node still reports real notices
- tab-panel pointer hold until geometric pointer exit, plus follow-up
  interaction-state fixes so the tab strip does not hide early during select,
  drag, or in-panel pointer travel

This identity bump does not re-run the `0.12.0-beta.1` Firefox 154 automated
lifecycle, recovery, performance-control, archive, or extracted-package
installer matrix. Those results remain the last recorded release-matrix
evidence. Remaining real-Firefox visual, assistive, account/device,
popup-placement, customize, first-paint, GUI installer, and representative
Urlbar-provider rows stay pending.

The new panel settings persist only as bounded profile-local shell preferences.
Bookmark favicons use Firefox's cached Places rasters; Fennevia adds no
favicon network fetch. Compact-window min-size clearing is fail-open to
Firefox's chrome floor. No dependency, content-accessible resource mapping, or
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
