<!-- SPDX-License-Identifier: MPL-2.0 -->

This is Fennevia `0.16.0-beta.1`, the seventh public Windows x64 prerelease.
It follows [`v0.15.0-beta.1`](https://github.com/yutinglia/fennevia/releases/tag/v0.15.0-beta.1).

Validated compatibility remains intentionally narrow: tested on stock Firefox
153.0.4 BuildID 20260810162159 and 154.0 BuildID 20260812182057, release
channel. Later Firefox versions may break the shell; confirming install does
not promise that everything will work. Review `INSTALL.md` and
`RELEASE-MANIFEST.json` inside the archive before installation, use a dedicated
Firefox profile, and verify the separately published SHA-256 file.

Fennevia targets the latest stock Firefox stable release available during
implementation. The tested 153/154 records are evidence for this package, not a
promise to preserve every historical Firefox version. ESR, Beta, Nightly, and
long-lived old-version compatibility branches are outside the release scope.

In PowerShell, compare the first field of the downloaded `.sha256` file with:

```powershell
(Get-FileHash -Algorithm SHA256 .\fennevia-0.16.0-beta.1-windows.zip).Hash.ToLowerInvariant()
```

The headline feature in this minor is Fennevia's full composable customization
system:

- nearly every visible browser control is now a widget that can be arranged
  across Top, Left, Right, and Bottom; Tabs, Bookmarks, address launcher, and
  download status can change between horizontal and vertical presentation
- each edge has a stable base Row or Column, while nested Row, Column, Center,
  Expanded, and Padding widgets support Flutter-style composition: ordinary
  children keep natural size and start order, and only explicit expansion or
  flexible space consumes the remainder
- safe controls can opt into multiple placements—for example, window controls
  can appear on both Top and Left—while structural layout widgets are always
  repeatable and stateful feature areas remain singletons
- the new deterministic default layout is designed for the recursive system;
  older valid layouts migrate safely and remain user-owned until Reset layout
  is chosen
- empty enabled panels remain full drag-and-keyboard targets in customize mode;
  live insertion previews, source dimming, edge autoscroll, persistent widget
  boundaries, palette search/categories, and contextual controls make precise
  editing visible without changing the real widget size
- one obstacle-aware floating inspector edits only the currently selected
  widget, replacing stacked toolbars; Address can include Trust/site status,
  and Tabs can include New Tab after the final tab
- Clean all panels asks for confirmation, restores adopted Firefox widgets,
  empties every edge, and retains the required Customize widget in Top; Reset
  layout remains a separate recovery action
- unoccupied project chrome—including structural space and empty containers—
  can still drag the Firefox window outside customize mode

Panel behavior is configurable as well. Left, Right, and Bottom can be enabled
independently while Top remains available. Four closed dodge modes combine
single or multiple visible panels with dynamic neighbor clearance or stable
reserved lanes. Single modes retain the short newly-opened-tab Tabs highlight,
and Firefox-owned popup holds remain authoritative. Tabs, Bookmarks, and
Downloads now share one bounded axis-aware feature root, fixing horizontal Tabs
and New Tab sizing in Top and Bottom without stretching every child.

Popup and customize follow-ups included since `v0.15.0-beta.1` choose an
application-menu direction before first paint, keep the menu within the useful
Firefox window area when possible, prevent floating widget settings from being
covered by the customize drawer, close that inspector reliably, and restore
normal top-panel auto-hide immediately after customize mode ends.

Fennevia's safety-oriented Firefox API bridge remains the only route from the
Svelte interface to privileged Firefox internals. It validates capabilities and
untrusted boundary values, exposes bounded snapshots plus narrow actions, and
keeps native objects out of widgets and serializable state. Firefox continues
to own tabs, bookmarks, downloads, security prompts, permissions, certificates,
extension installation, native menus, and window commands; startup or runtime
failure returns to the retained native interface instead of deleting it.

The included feature work has focused regression coverage and passed the
ordinary `npm run verify` gate with 420/420 Node tests; the complete fixed-list
suite also passed under Windows PowerShell 5.1. Release publication
independently repeats exact
dependency installation, the complete automated gate, deterministic double
build, strict Unicode/space extraction, archive checksum verification, and
remote asset digest checks. The last recorded complete Firefox 154 automated
lifecycle, recovery, performance-control, archive, and extracted-package
installer matrix remains the `0.12.0-beta.1` candidate. Remaining real-Firefox
visual, assistive, account/device, popup-placement, customize, first-paint, GUI
installer, and representative Urlbar-provider rows stay `not run`; this release
does not infer them from source or static tests.

The customization preferences store only bounded, versioned, allowlisted layout
and style values. They do not store URLs, titles, browsing text, popup state, or
arbitrary CSS. No dependency, content-accessible resource mapping, remote
runtime service, telemetry, or automatic updater is added. The bridge and
fail-open design reduce risk but are not a sandbox or a substitute for an
independent security audit.

The annotated release tag identifies the corresponding source. The archive's
`RELEASE-MANIFEST.json` records the complete source commit and preferred-source
URL; `INSTALL.md` contains install, update, hard-disable, repair, enable,
uninstall, and Firefox-update recovery commands.

Fennevia relies on unsupported privileged Firefox internals and has not yet
completed an independent security audit. Linux, macOS, Firefox ESR, Beta, and
Nightly are not supported by this package.
