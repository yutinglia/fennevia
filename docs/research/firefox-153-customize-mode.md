<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 153 Fennevia customize mode research

## Environment

- Date: 2026-08-18
- Firefox version: 153.0.4 release
- Build ID: `20260810162159`
- Channel: release
- Operating system: Windows 11
- Project commit: `3b24dc9` (main after ADR-044) on the customize-mode branch
- Official GitHub tag: `FIREFOX_153_0_4_RELEASE`
  (`c178247e1dfea52241a6b18b18cf3a00f8da935c`)
- Package: `0.10.0-beta.1`

## Goal

Deprecate the ADR-044 read-only nav-bar widget mirror as the only widget
source and implement a Fennevia-owned customize mode (ADR-045): full current
`CustomizableUI` widget inventory including extensions, project-owned
placement editing across all four edge panels, Fennevia-owned placeable
widgets, and bounded style customization, with profile-local persistence and
owner-approved bounded `CustomizableUI` writes.

## Findings (all from the pinned tag source)

All ADR-044 findings in
`docs/research/firefox-153-toolbar-widget-mirror.md` (read model, listener
contract, extension widget node shape, activation, and icons) remain valid and
are reused unchanged. This pass adds the inventory, write, and persistence
contracts.

### Inventory beyond the nav-bar

- `CustomizableUI.areas` returns every registered area id
  (`CustomizableUI.sys.mjs`, public getter over `gAreas.keys()`).
  `getWidgetIdsInArea(area)` throws for unknown or unrestored areas (lines
  6291-6301), so each area read is individually guarded.
- `getUnusedWidgets(aWindowPalette)` (lines 3141-3160, public wrapper 6273)
  returns group wrappers for every widget currently in no area. It takes the
  window's palette element because XUL- and API-provided widgets differ per
  window; the browser window exposes it as `window.gNavToolbox.palette`.
- `CustomizableUI.AREA_ADDONS` is `"unified-extensions-area"` (line 346
  region). Extension widgets can never enter the customization palette: when
  registration finds no area for a webExtension widget it places it in
  `AREA_ADDONS` (lines 4076-4081).
- Group wrappers expose `showInPrivateBrowsing`; `buildArea` skips widgets
  whose private-browsing visibility excludes the window (lines 1361-1364).
  The Fennevia palette therefore drops `showInPrivateBrowsing === false`
  wrappers in private windows.

### Bounded write APIs

- `addWidgetToArea(aWidgetId, aArea, aPosition)` (public wrapper lines
  5890-5892, internal 3236) places a widget id in an area, builds its
  per-window node, fires `onWidgetAdded`, and saves state. Placing onto the
  ADR-032-collapsed native nav-bar creates a live node without any visible
  native UI change.
- `removeWidgetFromArea(aWidgetId)` (public 5903, internal 3322) no-ops for
  non-removable or unplaced widgets, clears `currentArea`, saves state, and
  fires `onWidgetRemoved`. An extension widget removed this way becomes
  area-less until something re-places it, so Fennevia instead returns adopted
  extension widgets to `AREA_ADDONS` via `addWidgetToArea`.
- `getPlacementOfWidget(aWidgetId)` (public 6495) returns
  `{ area, position }` or `null`; `isWidgetRemovable` (6521) and
  `canWidgetMoveToArea` (6539) exist but are not needed for the bounded
  adopt/restore pair.
- CustomizableUI persists its own placements in the
  `browser.uiCustomization.state` char pref (`kPrefCustomizationState`, line
  33; save at 3801). Fennevia's adoption writes flow into that existing
  Firefox-owned persistence; Fennevia does not touch that pref directly.

### Preference persistence and observation

- `Services.prefs` (`nsIPrefBranch`) `getStringPref(name, default)` /
  `setStringPref(name, value)` / `clearUserPref(name)` are the supported
  string-pref API on the browser window's `Services` global.
  `addObserver(domain, observer)` / `removeObserver(domain, observer)`
  observe a prefix domain; observers receive
  `observe(subject, "nsPref:changed", prefName)` synchronously on change in
  the same process, which is how one window's edit reaches every other
  window's controller.
- Fennevia uses the reserved `fennevia.customize.` domain with two prefs:
  `fennevia.customize.layout` and `fennevia.customize.style`, both strict
  versioned JSON capped at 16 KiB and parsed fail-safe (invalid → default
  mirror layout / default style).

### Selected design

1. The per-window `toolbar-widgets` controller keeps the ADR-044 read/render
   machinery and becomes layout-driven: zones for all four edges render from
   the persisted Fennevia layout; with no layout pref the top zone falls back
   to the live nav-bar mirror (the deprecated ADR-044 behavior survives only
   as the default).
2. The palette enumerates placed areas plus `getUnusedWidgets`, dedupes, drops
   the fixed skip list and specials, and maps each id to a stable opaque
   `palette-N` token; raw ids never cross the bridge.
3. Placing a widget with no live node adopts it into the collapsed nav-bar
   (`addWidgetToArea(id, "nav-bar")`) and records it in the layout's
   `adopted` list; removal of the last placement or a layout reset restores
   extension widgets to `AREA_ADDONS` and other widgets to the palette.
4. Fennevia-owned widgets (`show-bookmarks`, `show-downloads`) and specials
   are frontend-only entries; activation of Firefox widgets reuses the exact
   ADR-042/ADR-044 `showSubView`/`doCommand` + re-anchor path.
5. Style is a fixed bounded token set applied as CSS custom properties on the
   frame root by the frontend host module, skipped under forced colors.

### Live-zone HTML5 drag-and-drop (ADR-047)

This addendum records the later placement-UI change. It does not rewrite the
ADR-045 inventory, write, or persistence findings above.

- Firefox 153 `CustomizeMode.sys.mjs` owns native-area drag through
  `DragPositionManager` and customizable-area wrappers. Fennevia zones are
  project-owned XHTML, not CustomizableUI areas, so that code is not copied
  and native-area drop remains a handoff to Firefox customize mode.
- The four edge hosts live in one chrome document under
  `#fennevia-shell-frame-host`. HTML5 drag-and-drop therefore works across
  roots. The left tab strip already proved `DragEvent` / `dataTransfer` in
  this privileged XHTML host (`application/x-fennevia-tab`).
- `dragover` does not expose `getData`, so the active drag is module-level
  ordinary state in `src/app/toolbar-widget-drag.ts`. The payload is an
  opaque palette token or `{zone, index}` — never a Firefox widget id.
- `EdgeShellController.setPointerHeld(true)` clears pointer holds on the
  other three edges. A customize session therefore holds all four edges with
  the existing `popup` hold and restores those holds if a Firefox popup
  later closes. No new hold name, hide timer, or overlay host is added.
- `yutinglia/my-firefox-custom` was not consulted.

## Sources checked

### Official Firefox (tag `FIREFOX_153_0_4_RELEASE`)

- `browser/components/customizableui/CustomizableUI.sys.mjs`
- `browser/components/customizableui/CustomizeMode.sys.mjs`
- `browser/components/customizableui/content/panelUI.js`
- `browser/components/extensions/parent/ext-browserAction.js`
- `browser/base/content/browser.js`

### Compatibility canaries (checked 2026-08-17 for the ADR-044 pass)

- `MrOtherGuy/fx-autoconfig` `dfdab5684faf`
- `aminomancer/uc.css.js` `88514013ddc3`
- `alice0775/userChrome.js` `5e146e348a56`
- `xiaoxiaoflood/firefox-scripts` `a898ac59fb0c`

They continue to treat the `CustomizableUI` widget and placement APIs
(`createWidget`, `addWidgetToArea`, `getWidgetIdsInArea`) as the stable
customization entry points; no code was copied or adapted.
`yutinglia/my-firefox-custom` was not consulted.

## Rejected alternatives

- Reimplementing Firefox customize mode (`CustomizeMode.sys.mjs`
  drag-and-drop into native areas): Fennevia zones are project-owned surfaces,
  not native areas; entering native customize mode remains a fixed handoff.
  ADR-047 adds HTML5 drag only among Fennevia-owned zones and the palette.
- Writing `browser.uiCustomization.state` directly: unsupported serialization
  details; the public `addWidgetToArea`/`removeWidgetFromArea` API already
  persists through Firefox's own saver.
- A second overlay host for the editor: the drawer renders inside the
  existing top edge root under the #31 popup hold, so no new runtime host,
  health selector, or hide timer is needed.
- `removeWidgetFromArea` for adopted extension widgets: leaves the widget
  area-less; returning it to `AREA_ADDONS` keeps the unified extensions panel
  authoritative.
- Storing layout/style in a project file or SessionStore: prefs are the
  smallest supported profile-local persistence with built-in observation.

## Security and privacy effects

Recorded normatively in `docs/security-and-privacy.md` section 7.4 and
ADR-045: layout/style prefs contain widget ids and fixed tokens only;
extension identity stays out of logs, diagnostics, serialized frontend state,
CSS variables, and root datasets; bounded adopt/restore writes only; no new
mapping, network access, or eval.

## Validation performed

- Source review of every symbol above against the pinned tag: completed.
- `npm run verify` (format, lint, svelte-check/tsc, unit coverage with
  80%/80% floors, static PowerShell suites, dependency audit, deterministic
  build, artifact scan): recorded in the change set.
- Real-Firefox manual matrix: `not run` at research time; tracked in
  `docs/testing-and-recovery.md` section 6.8.

## Remaining compatibility risk

- `CustomizableUI.areas`, `getUnusedWidgets`, and `AREA_ADDONS` are
  Firefox-internal; every read is guarded and a missing symbol degrades to a
  smaller palette without failing the window.
- Adopted widgets live in the user's real nav-bar placement state; an
  external reset of `browser.uiCustomization.state` orphans the `adopted`
  bookkeeping harmlessly (restore becomes a no-op and placements re-render
  from live state).
- The pref observer contract (`nsPref:changed`) is long-stable but
  per-process; multi-process browser windows are not a target.
