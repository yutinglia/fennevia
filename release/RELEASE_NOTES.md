<!-- SPDX-License-Identifier: MPL-2.0 -->

This is Fennevia `0.18.0-beta.1`, the ninth public Windows x64 prerelease.
It follows [`v0.17.0-beta.1`](https://github.com/yutinglia/fennevia/releases/tag/v0.17.0-beta.1).

Validated compatibility remains intentionally narrow: stock Firefox 153.0.4
BuildID 20260810162159, Firefox 154.0 BuildID 20260812182057, and Firefox
154.0.1 BuildID 20260824154132 on Windows x64. Firefox 153 and newer may be
installed after the explicit warning that later versions can break the shell;
confirming install does not promise that everything will work. ESR, Beta,
Nightly, Linux, and macOS remain outside this package's support scope.

Review `INSTALL.md` and `RELEASE-MANIFEST.json` inside the archive, use a
dedicated Firefox profile, and verify the separately published SHA-256 file.
In PowerShell, compare its first field with:

```powershell
(Get-FileHash -Algorithm SHA256 .\fennevia-0.18.0-beta.1-windows.zip).Hash.ToLowerInvariant()
```

The main changes since `v0.17.0-beta.1` are:

- **Firefox-like address editing.** The compact launcher continues to show
  Firefox's trimmed committed value, while opening the centered editor uses
  Firefox's bounded `untrimmedValue`. A normal HTTPS page therefore restores
  its `https://` prefix at the useful editing moment without inventing URL
  parsing, persistence, or a parallel navigation source. Native suggestions
  continue through Firefox's normalized Urlbar value, preserving its trimming
  and `startQuery()` contract while the custom editor remains untrimmed.
- **A balanced four-edge default.** Fresh and reset layouts now match the
  owner's current composition: navigation and browser actions in Top, an
  address/status Row aligned with expanded Tabs on the tabs side, expanded
  Bookmarks opposite it, and centered Download status in Bottom. Valid saved
  version-2 layouts remain user-owned and are not silently replaced.
- **Container padding and launcher spacing.** Row and Column containers gain
  one optional bounded Standard content-padding preset. The default parent Row
  owns the address launcher's horizontal alignment with Tabs while the launcher
  retains comfortable tokenized vertical space; the centered address panel is
  unchanged.
- **Clearer, safer customization.** Customize mode now places a dark,
  pointer-blocking project-owned backdrop over website content. The floating
  widget inspector fades and yields hit testing during a widget drag so it
  cannot cover the intended drop target.
- **Draggable narrow Top scrollbars.** A bounded no-drag guard covers the Top
  panel's scrollbar lane when horizontal overflow appears. The thumb and track
  remain usable while adjacent empty Top chrome still drags the Firefox window.
- **Updated project showcase.** The bilingual READMEs include the current
  owner-supplied layout/customization captures and a stylized Fennevia hero;
  media provenance and generated-output records are included in the source.

Fennevia's safety-oriented Firefox API bridge remains the only route from the
Svelte interface to privileged Firefox internals. It validates capabilities
and boundary values, exposes bounded snapshots plus narrow actions, and keeps
native objects out of widgets and serializable state. Firefox continues to own
tabs, bookmarks, downloads, certificates, permissions, security prompts,
extension installation, native menus, Urlbar providers and execution, and
window commands. Startup or runtime failure returns to the retained native
interface instead of deleting it.

The candidate passed the ordinary `npm run verify` gate with 435/435 Node
tests, the complete fixed-list suite under PowerShell 7 and Windows PowerShell
5.1, deterministic generated artifacts, dependency review, and the production
artifact scan. Release publication independently repeats exact dependency
installation, verification, deterministic double packaging, strict
Unicode/space extraction, checksum validation, and remote asset digest checks.
Package-specific Firefox 154.0.1 lifecycle, recovery, and extracted-package
results are recorded in
`docs/research/firefox-154-0.18.0-beta.1-release-validation.md`.

Remaining real-Firefox visual, assistive-technology, account/device,
popup-placement, complete customize, first-paint, GUI/UAC installer, Firefox
153 rerun, and representative Urlbar-provider rows are stated explicitly in
the validation record; they are not inferred from focused or static tests.

The customization preferences store only bounded, versioned, allowlisted
layout and style values. They do not store URLs, titles, browsing text, popup
state, or arbitrary CSS. This release adds no dependency, content-accessible
resource mapping, remote runtime service, telemetry, or automatic updater.

The annotated release tag identifies the corresponding source. The archive's
`RELEASE-MANIFEST.json` records the complete source commit and preferred-source
URL; `INSTALL.md` contains install, update, hard-disable, repair, enable,
uninstall, and Firefox-update recovery commands.

Fennevia relies on unsupported privileged Firefox internals and has not
completed an independent security audit. This is an experimental prerelease,
not a stable daily-driver or long-term-support promise.
