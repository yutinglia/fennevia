<!-- SPDX-License-Identifier: MPL-2.0 -->

This is Fennevia `0.15.0-beta.1`, the sixth public Windows x64 prerelease.
It follows [`v0.14.0-beta.1`](https://github.com/yutinglia/fennevia/releases/tag/v0.14.0-beta.1).

Validated compatibility remains intentionally narrow: tested on stock Firefox
153.0.4 BuildID 20260810162159 and 154.0 BuildID 20260812182057, release
channel. Later Firefox versions may break the shell; confirming install does
not promise that everything will work. Review `INSTALL.md` and
`RELEASE-MANIFEST.json` inside the archive before installation, use a dedicated
Firefox profile, and verify the separately published SHA-256 file.

In PowerShell, compare the first field of the downloaded `.sha256` file with:

```powershell
(Get-FileHash -Algorithm SHA256 .\fennevia-0.15.0-beta.1-windows.zip).Hash.ToLowerInvariant()
```

This minor collects the tab-strip and shell work added after
`v0.14.0-beta.1`:

- pinned tabs now occupy a conditional, height-capped area fixed above the
  independently scrolling regular-tab partition; both keep full tab rows,
  native order, focus recovery, drag boundaries, and direct actions, while New
  Tab remains reachable below both scrollers
- single- and multi-tab downward drops now use the same insertion-boundary
  conversion and verify the complete resulting native order before the drag is
  consumed; invalid geometry and silent native no-ops are rejected
- the first and last 32 CSS pixels plus the owned strip gap and New Tab region
  provide easier end-of-list drop targets without reserving browser-content
  space
- corrected side-panel flex sizing keeps tab rows visible and places New Tab
  after the last row; the bookmark location selector keeps its accessible name
  without a persistent visible heading
- native popup placement and fixed popup action flows were separated into
  focused source modules while preserving the public bridge, action order,
  Firefox owners, errors, cleanup, and single generated ESM
- the English and Traditional Chinese READMEs include a project-authored
  four-edge interface map that is explicitly not compatibility evidence

At the owner's request, this identity bump does not re-run tests or the release
mass matrix. The included changes retain their already-recorded focused,
`npm run verify`, Windows PowerShell 5.1, and Firefox 154 headless-layout
evidence. The `0.12.0-beta.1` Firefox 154 automated lifecycle, recovery,
performance-control, archive, and extracted-package installer results remain
the last recorded release-matrix evidence. Remaining real-Firefox visual,
assistive, account/device, popup-placement, customize, first-paint, GUI
installer, and representative Urlbar-provider rows stay `not run`.

The pinned and regular partitions derive from the existing Firefox-owned tab
snapshot and add no bridge field, native DOM ownership, persistence, or second
reveal controller. The source-module split changes no privileged contract. The
interface map is project-authored MPL-2.0 material. No dependency,
content-accessible resource mapping, or automatic updater is added.

The annotated release tag identifies the corresponding source. The archive's
`RELEASE-MANIFEST.json` records the complete source commit and preferred-source
URL; `INSTALL.md` contains install, update, hard-disable, repair, enable,
uninstall, and Firefox-update recovery commands. The release validation record
distinguishes automated, real-Firefox, and manual observations without
inferring GUI behavior from CI.

Fennevia relies on unsupported privileged Firefox internals and has not yet
completed an independent security audit. Linux, macOS, Firefox ESR, Beta, and
Nightly are not supported by this package.
