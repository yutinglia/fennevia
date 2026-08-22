<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 153/154 toolbar widget activation correction

## Environment and first causal evidence

- Date: 2026-08-22
- Supported comparison targets:
  - Firefox 153.0.4 release, BuildID `20260810162159`, official commit
    [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)
  - Firefox 154.0 release, BuildID `20260812182057`, official commit
    [`032a9fc1ac0cc3209f7c142744ba2e40847c8086`](https://github.com/mozilla-firefox/firefox/commit/032a9fc1ac0cc3209f7c142744ba2e40847c8086)
- Operating system: Windows 11, x64
- Project base commit: `d974d2b`
- Package: `0.11.0-beta.1`
- Profile state: the owner reported the failure from an ordinary Fennevia
  runtime; the exact profile, Firefox build, Browser Console, and Browser
  Toolbox state were not captured with the report. Clean-profile live
  validation for this correction is therefore **not run**, not passed.

The reported first failure was that activating the mirrored Firefox Account
widget had no visible effect. No exception or stack was supplied. Source
inspection found the first causal mismatch: the mirror treated every built-in
without a wrapper `viewId` as a generic XUL `command`, but Firefox Account is a
static delegated toolbar button whose native activation is owned by
`gSync.toggleAccountPanel(element, event)` on `mousedown`/keyboard handling.
Dispatching `command` on the hidden node never enters that owner.

The same assumption affected other widget shapes, so the correction audited
the complete current activation strategy rather than special-casing only the
reported button.

## Firefox source findings

### Delegated static toolbar buttons

Firefox 153/154
[`navigator-toolbox.js`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/base/content/navigator-toolbox.js)
delegates these relevant toolbar buttons instead of giving each a generic
`command` owner:

- `fxa-toolbar-menu-button` calls
  `gSync.toggleAccountPanel(element, event)`;
- `library-button` calls
  `PanelUI.showSubView("appMenu-libraryView", element, event)`;
- `alltabs-button` calls
  `gTabsPanel.showAllTabsPanel(event, "alltabs-button")`.

Firefox 153/154
[`browser-sync.js`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/base/content/browser-sync.js)
shows why Account must keep its owner. `toggleAccountPanel` validates the
event, handles signed-in/signed-out and CTA state, updates Sync UI and access
state, and only then calls `PanelUI.showSubView("PanelUI-fxa", anchor, event)`.
Calling that final subview directly would bypass Firefox behavior.

Firefox 153/154
[`browser-allTabsMenu.js`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/tabbrowser/content/browser-allTabsMenu.js)
initializes the owner, checks `isElementVisible(this.allTabsButton)`, records
the current entrypoint, and opens the view on that anchor. The native button is
intentionally collapsed in active Fennevia mode, so invoking the owner without
a temporary visible project anchor is also a silent no-op.

### Wrapper views and simple command widgets

API widgets with a wrapper `viewId`, including extension actions and the
Firefox 154 IP Protection view, remain correctly opened through
`PanelUI.showSubView(viewId, projectHost, event)`. Firefox still owns the view,
its lifecycle events, and its contents. `firefox-view-button` remains covered
by Firefox's bubbling `command` listener. Other ordinary buttons retain their
native `doCommand()`/bubbling `command` path and any resulting panel is moved
to the clicked project host.

The fixed skip list continues to exclude controls already represented by
Fennevia or retained through a dedicated handoff: Back, Forward,
Stop/Reload, Home, Urlbar/Search containers, Downloads, Unified Extensions,
the application menu, Personal Bookmarks, and non-button containers. The
delegated Page Action button is inside the Urlbar rather than a mirrorable
placement.

### Native menu widgets

Firefox 153/154
[`CustomizableWidgets.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/customizableui/CustomizableWidgets.sys.mjs)
builds Share Tab and Send Tab as `toolbarbutton type="menu"` owners with a
nested native `menupopup`; Bookmarks Menu has the same native menu shape.
Activating only the outer node's generic command does not reproduce XUL menu
opening. The selected path calls the existing popup's
`openPopup(projectHost, { position, triggerEvent })`; no menu child is read,
cloned, or reparented. Firefox 153/154
[`XULPopupElement.webidl`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/dom/chrome-webidl/XULPopupElement.webidl)
defines this anchor/options contract.

### Compound widgets

Two `CustomizableWidgets.sys.mjs` entries are one placement with several
independent native controls:

- `zoom-controls`: Zoom out, Reset zoom, and Zoom in;
- `edit-controls`: Cut, Copy, and Paste.

The Firefox Profiler module
[`menu-button.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/devtools/client/performance-new/popup/menu-button.sys.mjs)
adds a third compound shape, `type: "button-and-view"`: its main child starts
or captures a profile while its dropmarker opens `PanelUI-profiler`. Rendering
any of these as one outer button created a misleading control whose command
could do nothing or perform only one of several actions.

Fennevia now keeps each placement grouped but exposes a bounded list of opaque
child handles. Every part is a semantic project-owned button with its own
Firefox-derived label, tooltip, disabled state, and bounded icon presentation.
If an expected child is missing or disconnected on a supported build, the
whole placement is published as missing instead of displaying a silent no-op.

### Follow-up: visible Zoom percentage

The owner follow-up reported that the corrected Zoom group still omitted its
percentage. The follow-up base is project commit `f2f2bb3`; the supported
Firefox 154.0 release/build and official commit remain those recorded above.

Firefox 153/154
[`ZoomUI.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/modules/ZoomUI.sys.mjs)
calculates the selected page's `ZoomManager.zoom * 100`, formats it with
`zoom-button.label`, and writes the localized percentage to
`#zoom-reset-button[label]` after zoom and location changes. The existing
toolbar-widget subtree observer already watches `label`, but the shell rendered
every compound part through its glyph component, so the changing value never
became visible.

The minimum correction marks only the Zoom reset specification as a textual
value part. Its bounded Firefox-derived label is copied to `valueText`, which
must be empty or exactly equal to the already-validated label. The shell shows
that value with tabular figures, gives the project button an accessible name
that includes both percentage and reset tooltip, and continues to invoke the
same opaque native reset handle. No direct `ZoomManager` read, duplicate zoom
listener, timer, native-node exposure, persistence, logging, or new dependency
is introduced.

## Compatibility canaries checked

The required current canary heads were inspected for the same owner symbols:

- Alice0775/userChrome.js
  [`e78445ac637f1355bc0c03d63fea3d039589c373`](https://github.com/alice0775/userChrome.js/commit/e78445ac637f1355bc0c03d63fea3d039589c373)
- MrOtherGuy/fx-autoconfig
  [`dfdab5684faffc112b76ccb1d8cab7f75da0102c`](https://github.com/MrOtherGuy/fx-autoconfig/commit/dfdab5684faffc112b76ccb1d8cab7f75da0102c)
- xiaoxiaoflood/firefox-scripts
  [`a898ac59fb0ca3886c0c46b184fdbc037c83c037`](https://github.com/xiaoxiaoflood/firefox-scripts/commit/a898ac59fb0ca3886c0c46b184fdbc037c83c037)
- aminomancer/uc.css.js
  [`88514013ddc375f4770f4a35d8d07a91d6dd7d8f`](https://github.com/aminomancer/uc.css.js/commit/88514013ddc375f4770f4a35d8d07a91d6dd7d8f)

None contains an Account-owner adaptation. Alice's current Firefox 136
vertical-tab customization explicitly calls
`gTabsPanel.showAllTabsPanel(event, "alltabs-button")`, which corroborates the
owner route but is loader/customization-specific code and was not copied.
Searchfox was also checked for the current All Tabs markup, Zoom owner, and
Profiler localization; the exact supported-version decisions above use the
pinned official repository commits rather than the moving main branch.

## Minimum correction selected

1. Forward the actual project-button activation event across the in-process
   adapter. A bounded left-click-shaped event is created only for non-UI/test
   callers.
2. Invoke `gSync.toggleAccountPanel(nativeAccountNode, event)` so Firefox keeps
   all Account state and CTA work. While that owner executes, replace only its
   `PanelUI-fxa` call's native anchor with the clicked project host, then restore
   the original per-window method immediately.
3. Invoke Library's known native subview directly on the project host.
4. Initialize `gTabsPanel`, temporarily expose the clicked project host through
   its `allTabsButton` owner slot, invoke `showAllTabsPanel` with Firefox's
   telemetry entrypoint, and restore the original node immediately.
5. Open native `type="menu"` popups on the host through `openPopup`.
6. Project Zoom, Edit, and Profiler into grouped child buttons backed by opaque
   native handles. The Profiler main child uses its command; its dropmarker
   resolves the parent `button-and-view` wrapper and opens the native view.
7. Leave wrapper-view and ordinary-command strategies unchanged, including
   existing popup hold, toggle-close, bounded settlement, and deterministic
   disposal.

Rejected alternatives were clicking or revealing the hidden original widget,
calling `PanelUI-fxa` without the Sync owner, cloning native panel/menu content,
reparenting native controls, or adding a generic event-listener shim. Those
choices lose Firefox state, produce hidden-anchor geometry, or violate native
ownership and cleanup boundaries.

## Security, privacy, licensing, and failure behavior

- The trigger event and native child references are transient per-window
  objects. They are never serialized, persisted, logged, copied into a root
  dataset/CSS property, or sent over a network.
- Raw widget/child ids remain privileged-side. The frontend receives only
  opaque handles and the already approved bounded built-in presentation data;
  extension identity rules are unchanged.
- Native panel and menu contents remain Firefox-owned and unread. No new
  dependency, preference, content-accessible mapping, remote source, runtime
  code generation, telemetry sink, or process-global state is introduced.
- Missing owners, stale handles, missing compound children, and thrown native
  calls produce fixed privacy-safe toolbar-widget errors or a missing optional
  widget. Existing native UI and fail-open recovery remain authoritative.
- No Firefox or canary code/assets were copied. Only source behavior and fixed
  installed-resource URIs were referenced, so `THIRD_PARTY_NOTICES.md` does not
  change.

## Validation record

Visible-percentage follow-up:

- `node --test tests/firefox-toolbar-widgets.test.mjs tests/toolbar-widgets-state.test.mjs tests/frontend-build.test.mjs`
  — **passed**, 40/40 tests, including all three Zoom child commands and a
  `100%` to `110%` native-label republish.
- `npm run typecheck` — **passed**, including zero Svelte errors or warnings.
- `npm run verify` — **passed**: formatting, ESLint, typecheck, 321/321 Node
  tests, 87.36% line / 95.08% function coverage, the complete fixed-list
  PowerShell suite, dependency audit, deterministic frontend/bridge build,
  16-file package manifest sync, and all 14 production-artifact
  inventory/security checks.
- Live percentage rendering and clicking in Firefox 153/154 — **not run**, not
  passed. The implementation uses the pinned Firefox 154 source contract and
  focused automation; the real-Firefox row remains in the release matrix.

Original activation correction:

- `node --test tests/firefox-toolbar-widgets.test.mjs tests/toolbar-widgets-state.test.mjs tests/frontend-build.test.mjs`
  — **passed**, 40/40 tests.
- `npm run typecheck` — **passed**, including zero Svelte errors or warnings.
- `npm run verify` — **passed**: formatting, ESLint, typecheck, 321/321 Node
  tests, 87.35% line / 95.08% function coverage, the complete fixed-list
  PowerShell static suite, dependency audit, deterministic frontend/bridge
  build, 16-file package manifest sync, and all 14 production-artifact
  inventory/security checks.
- Real Firefox 153/154 Account states, Library, All Tabs, native menus,
  Zoom/Edit, Profiler, second/private windows, and popup placement — **not
  run**, not passed.
