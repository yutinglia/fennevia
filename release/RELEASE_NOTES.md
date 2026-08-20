<!-- SPDX-License-Identifier: MPL-2.0 -->

This is Fennevia `0.11.0-beta.1`, the second public Windows x64 prerelease.
It follows [`v0.10.0-beta.1`](https://github.com/yutinglia/fennevia/releases/tag/v0.10.0-beta.1).

Validated compatibility remains intentionally narrow: tested on stock Firefox
153.0.4 BuildID 20260810162159 and 154.0 BuildID 20260812182057, release
channel. Later Firefox versions may break the shell; confirming install does
not promise that everything will work. Review `INSTALL.md` and
`RELEASE-MANIFEST.json` inside the archive before installation, use a dedicated
Firefox profile, and verify the separately published SHA-256 file.

In PowerShell, compare the first field of the downloaded `.sha256` file with:

```powershell
(Get-FileHash -Algorithm SHA256 .\fennevia-0.11.0-beta.1-windows.zip).Hash.ToLowerInvariant()
```

This minor adds user-visible shell and installer work that was not part of the
`v0.10.0-beta.1` MVP snapshot:

- Fennevia-owned customize mode with four-edge widget zones, live drag-and-drop,
  localized names, native built-in icons, and bounded style tokens
- default top-zone layout from the Firefox nav-bar widget placements
- first-paint native-toolbox hide with a self-expiring fail-open sheet
- Firefox chrome design tokens as the default theme
- English and Traditional Chinese catalogs that follow Firefox UI language
- left-edge tab-strip native parity, gutter progress lights, and host-anchored
  native panels
- project-owned window controls and compact single-line chrome
- `FenneviaSetup.exe` as the recommended release installer, with the PowerShell
  console remaining as the advanced host
- Firefox 153+ install, update, repair, and enable after an explicit
  untested-version warning; 154.0 is a tested major

The annotated release tag identifies the corresponding source. The archive's
`RELEASE-MANIFEST.json` records the complete source commit and preferred-source
URL; `INSTALL.md` contains install, update, hard-disable, repair, enable,
uninstall, and Firefox-update recovery commands. Real-Firefox visual,
popup-placement, customize, and first-paint flash matrices remain pending.

Fennevia relies on unsupported privileged Firefox internals and has not yet
completed an independent security audit. Linux, macOS, Firefox ESR, Beta, and
Nightly are not supported by this package.
