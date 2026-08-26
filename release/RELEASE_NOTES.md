<!-- SPDX-License-Identifier: MPL-2.0 -->

This is Fennevia `0.17.0-beta.1`, the eighth public Windows x64 prerelease.
It follows [`v0.16.0-beta.1`](https://github.com/yutinglia/fennevia/releases/tag/v0.16.0-beta.1).

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
(Get-FileHash -Algorithm SHA256 .\fennevia-0.17.0-beta.1-windows.zip).Hash.ToLowerInvariant()
```

The main changes since `v0.16.0-beta.1` are:

- **Feature-first customization.** Address, Tabs, Bookmarks, and Download
  status now appear first in the widget palette with their common companion
  actions beside them. Incomplete groups reflow without blank columns. An
  optional English and Traditional Chinese Guide explains edge directions,
  Rows, Columns, wrappers, structural spacing, practical recipes, editing, and
  recovery.
- **A simpler address/search popup.** The centered overlay now uses a compact
  search-first composition while retaining Fennevia identity, accessible
  status, Trust and permission actions, Firefox's provider results, and the
  complete native Urlbar handoff. The bridge retries only the first completed
  empty zero-prefix query once, through Firefox's existing provider manager,
  to cover the observed first-open warm-up case without adding a provider,
  timer, engine, endpoint, ranking rule, or persistent state.
- **Better narrow-window layouts.** At 560 CSS px and below, Bottom receives a
  dedicated full-width lane, one visible side expands while retaining a
  content corridor for pointer exit, and two visible sides split. At 360 CSS
  px and below, the denser layout may let one side use the available width.
  The reflow remains CSS-driven and does not alter saved layouts, reveal
  controllers, or panel policies.
- **Safer tab dragging.** An unconsumed drag must move at least 16 CSS pixels
  before it can detach into a window. Recursive layout ancestors no longer
  cancel a child tab's drag session, and a new physical drag can recover only
  stale transfer state owned by the same window. Same-strip reorder, outside
  detach, and cross-window transfer were confirmed on Firefox 154.0.1.
- **Quieter built-in widget localization.** Known built-in toolbar labels use
  the synchronous Fluent mapping before Firefox's legacy property lookup,
  retaining that older path only as a fallback for unmapped widgets.

Fennevia's safety-oriented Firefox API bridge remains the only route from the
Svelte interface to privileged Firefox internals. It validates capabilities
and boundary values, exposes bounded snapshots plus narrow actions, and keeps
native objects out of widgets and serializable state. Firefox continues to own
tabs, bookmarks, downloads, certificates, permissions, security prompts,
extension installation, native menus, Urlbar providers and execution, and
window commands. Startup or runtime failure returns to the retained native
interface instead of deleting it.

The candidate passed the ordinary `npm run verify` gate with 429/429 Node
tests, the complete fixed-list suite under PowerShell 7 and Windows PowerShell
5.1, deterministic generated artifacts, dependency review, and the production
artifact scan. Release publication independently repeats exact dependency
installation, verification, deterministic double packaging, strict
Unicode/space extraction, checksum validation, and remote asset digest checks.
Package-specific Firefox 154.0.1 lifecycle, recovery, and extracted-package
results are recorded in
`docs/research/firefox-154-0.17.0-beta.1-release-validation.md`.

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
