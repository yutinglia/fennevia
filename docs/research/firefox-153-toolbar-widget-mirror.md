<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 153 toolbar widget mirror research

## Environment

- Date: 2026-08-17
- Firefox version: 153.0.4 release
- Build ID: `20260810162159`
- Channel: release
- Operating system: Windows 11
- Project commit: `8337f2c` (main after ADR-042/043) on the issue #64 branch
- Official GitHub tag: `FIREFOX_153_0_4_RELEASE`
  (`c178247e1dfea52241a6b18b18cf3a00f8da935c`)
- Package: `0.10.0-beta.1`

## Goal

Issue #64: mirror the user's customized nav-bar `CustomizableUI` placements as
project-owned top-row buttons (extension actions with real icon/badge, pinned
built-ins, spacers as gaps), keep native customize mode as the only editor,
and open Firefox-owned popups anchored to the project button through the
ADR-042 machinery. The owner approved the narrow ADR-037/section-7.4
relaxation recorded in ADR-044.

## Findings (all from the pinned tag source)

### CustomizableUI availability and read model

- `window.CustomizableUI` is a lazy module getter on the browser window
  (`browser/base/content/browser.js` lines 35-36, module
  `moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs`).
- `CustomizableUI.AREA_NAVBAR` is `"nav-bar"`
  (`CustomizableUI.sys.mjs` line 5407).
- `getWidgetIdsInArea(area)` returns the ordered placement ids and throws for
  unknown or unrestored areas (line 6291). `getWidget(id)` returns a group
  wrapper (line 6257).
- API group wrappers expose `id`, `type`, `disabled`, `label`, `tooltiptext`,
  `showInPrivateBrowsing`, `hideInNonPrivateBrowsing`, `viewId`,
  `webExtension`, and `forWindow(window)` (lines 7060-7114). Per-window
  single wrappers expose the live `node`, node-attribute `label` /
  `tooltiptext`, `disabled`, and `anchor` (lines 7142-7193). XUL group
  wrappers report `type: "custom"`, `webExtension: false`, and resolve the
  node lazily (lines 7203-7306).
- `CustomizableUI.isSpecialWidget(id)` matches ids starting with
  `customizableui-special-`, `spring`, `spacer`, or `separator` (lines
  2329-2341). `CustomizableUI.isWebExtensionWidget(id)` checks the
  `webExtension` flag with a `-browser-action` suffix fallback (lines
  6663-6674).
- Default nav-bar placements at this version (lines 355-372): optional
  `sidebar-button`, `back-button`, `forward-button`, `stop-reload-button`,
  optional `home-button`, `spring`, `vertical-spacer`, `urlbar-container`,
  `spring`, `downloads-button`, optional `developer-button`,
  `ipprotection-button`, `fxa-toolbar-menu-button`, and optional
  `reset-pbm-toolbar-button`. `search-container` and `personal-bookmarks`
  can be placed there by the user.
- `buildArea` skips widgets whose private-browsing visibility excludes the
  window (`PrivateBrowsingUtils.isWindowPrivate`, lines 1361-1364), so a
  widget without a node in this window is not usable in this window. The
  mirror therefore only lists placements whose per-window node exists.

### Listener contract

`CustomizableUI.addListener(listener)` / `removeListener(listener)` (lines
5770-5782) call plain listener methods. Relevant notifications and their
source lines: `onWidgetAdded(id, area, position)` 3315,
`onWidgetRemoved(id, area)` 3362, `onWidgetMoved` 3409, `onWidgetCreated`
3981, `onWidgetDestroyed` 4436, `onWidgetInstanceRemoved(id, document)` 1909,
`onWidgetOverflow` 7825, `onWidgetUnderflow` 8034, `onWidgetReset` 1453,
`onWidgetUndoMove` 1455, `onAreaReset` 1519, `onCustomizeStart(window)` 6727,
`onCustomizeEnd(window)` 6737, `onWindowClosed(window)` 1920. Listener
exceptions are caught by `notifyListeners`, but the project listener still
wraps its own body.

### Extension action widgets (`browser/components/extensions/parent/ext-browserAction.js`)

- Widget id is `${makeWidgetId(extension.id)}-browser-action` (lines 44-46,
  135-136); the popup view id is `PanelUI-webext-${widgetId}-BAV` (line 137);
  the visible action button id is `${widgetId}-BAP` (line 138).
- The widget is created with `CustomizableUI.createWidget({ type: "custom",
webExtension: true, showInPrivateBrowsing: extension.privateBrowsingAllowed,
label/tooltiptext: action title, viewId, ... })` (lines 195-205).
- The built node is a `toolbaritem.unified-extensions-item` with
  `view-button-id` pointing at the inner
  `toolbarbutton.unified-extensions-item-action-button.webextension-browser-action`
  (lines 213-301, 332-345).
- `updateButton` (lines 841-934) maintains, on the inner action button:
  `badge` (text, set/removed), `badgeStyle`
  (`background-color: rgba(...); color: rgba(...)`), `disabled`, and `style`
  containing the icon custom properties; and on the toolbaritem: `attention`.
  The icon style string sets `--webextension-toolbar-image` (and the
  menupanel variant) to `url(...)`/`image-set(...)` values built from
  moz-extension icon URLs (`getIconData`, lines 936-973).

### Activation and popups

- CustomizableUI attaches `command` and `click` handlers on every API widget
  node (lines 2668-2671). `handleWidgetCommand` (line 2894) runs
  `onBeforeCommand`, then for view-typed results calls `showWidgetView`,
  which is `PanelUI.showSubView(widget.viewId, anchor, event)` (line 2880).
- `PanelUI.showSubView(viewId, anchor, event)`
  (`browser/components/customizableui/content/panelUI.js` lines 515-642)
  accepts an arbitrary anchor element. For anchors outside a
  `panelmultiview` it sets `anchor.open = true`, builds a transient
  `panel#customizationui-widget-panel` containing the view, and opens it with
  `PanelMultiView.openPopup(tempPanel, anchor, { position:
"bottomright topright" })`. `popuphidden` resets `anchor.open` and removes
  the panel (lines 557-640). `_getPanelAnchor` returns the anchor itself for
  non-toolbarbutton elements (lines 1256-1259).
- The extension popup attaches into that same transient panel: the widget's
  `onViewShowing` calls `action.triggerClickOrPopup(tab, lastClickInfo)` and
  either attaches the `ViewPopup` browser or prevents the view (click-only
  actions fire the extension `onClicked` inside `triggerClickOrPopup` and no
  panel is shown) (ext-browserAction lines 418-470;
  `toolkit/components/extensions/ExtensionActions.sys.mjs` lines 240-260,
  `triggerClickOrPopup(tab, clickInfo = undefined)` tolerates an undefined
  click info).
- Precedent for synthetic activation: Firefox's own
  `BrowserAction.openPopup()` dispatches a bubbling `command` `CustomEvent`
  on the inner action button (lines 536-543).

### Selected activation design

1. Widgets with a `viewId` (extension actions and view-typed built-ins):
   call `window.PanelUI.showSubView(viewId, projectButton)`. The transient
   `customizationui-widget-panel` then anchors to the visible project button
   from the start; no re-anchor is needed, and ADR-042's NativeUi rule
   (popups anchored inside the Fennevia frame do not reveal chrome) already
   covers it. Known bounded limitation: bypassing `onBeforeCommand` leaves
   the delegate's `lastClickInfo` / `openPopupWithoutUserInteraction` state
   untouched (ext-browserAction lines 371-392); `triggerClickOrPopup`
   defaults the click info, so behavior equals an unmodified left click.
2. Other mirrorable widgets: activate the live native node (`doCommand()`
   when present, otherwise a bubbling `command` `CustomEvent`). If the
   activation opens a native panel anchored to that collapsed native node,
   a short-lived pending-invoke record lets the existing `popupshown`
   listener `moveToAnchor` the panel onto the project button.
3. Ultimate fallback stays ADR-037's reveal path through the existing fixed
   `native-toolbar` action.

### Icons

- Extension icons: read the inner action button's inline
  `--webextension-toolbar-image` value and extract the first `url(...)`
  (a moz-extension URL). The Fennevia hosts live in the same
  `browser.xhtml` document as the native buttons, so the image loads in the
  same privileged context Firefox itself uses. Real-Firefox rendering is a
  manual smoke item; a project glyph is the fallback.
- Built-ins: curated project glyphs for a known set; otherwise a generic
  project glyph. Native chrome:// icon extraction was rejected (context-fill
  coupling and styling leakage). ADR-046 later amends this for CSS-mask
  rendering; see the Later amendment section below.

## Later amendment (ADR-046, 2026-08-19)

This section records the selected follow-up; it does not rewrite the
historical findings or rejected alternatives above.

- Unused XUL widgets live in `gNavToolbox.palette`, which is not part of
  the document (`XULWidgetGroupWrapper.forWindow` in
  `CustomizableUI.sys.mjs`). Presentation lookup uses
  `document.getElementById` first, then
  `gNavToolbox.palette.getElementsByAttribute("id", widgetId)[0]`.
  Connected nodes remain required for activation handles.
- API built-ins often have only `l10nId` on the internal widget record;
  the group wrapper does not expose that field. Names resolve from node
  `label` / `title` / `tooltiptext`, wrapper strings, node `data-l10n-id`,
  a dedicated sync `Localization` for `browser/browser.ftl`,
  `browser/sidebar.ftl`, `browser/appmenu.ftl`, and
  `browser/screenshots.ftl`, plus allowlisted chrome
  `link[rel="localization"]` hrefs (chrome `document.l10n` calls
  `setAsync()` after the initial translation, so `formatMessagesSync`
  then throws `InvalidStateError`; XUL palette widgets such as
  `new-window-button` / `fullscreen-button` use `appmenuitem-*` in
  `appmenu.ftl`; `screenshot-button` uses `screenshot-toolbar-button`
  in `screenshots.ftl`; other toolbar Fluent messages such as
  `toolbar-button-email-link` are attribute-only, so `formatValueSync`
  is empty),
  `CustomizableUI.getLocalizedProperty`, and a small privileged Fluent-id
  map pinned to 153 `CustomizableWidgets` and XUL palette widgets.
  `WidgetGroupWrapper.tooltiptext` is often a raw key such as
  `history-panelmenu.tooltiptext2`; those keys and incomplete `%S` bundle
  strings are not used as names.
- Built-in icons: computed `list-style-image` on the presentation node or
  its first `toolbarbutton` child; otherwise a per-window CSSOM cache of
  `#widgetId` rules from `document.styleSheets` (including `@media` and
  nested `&` rules that inherit the parent id), matching
  [`toolbarbutton-icons.css`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/themes/shared/toolbarbutton-icons.css).
  When CSSOM misses, a pinned 153 chrome/resource URL map is used. URLs
  are bounded `chrome://` or `resource://`. The frontend paints them
  with CSS `mask-image` and `currentColor`, not `<img src>`.
- `wrapper.forWindow()` / `buildWidgetNode()` remain unused for
  presentation so unused API widgets are not instantiated with command
  listeners. Curated `ShellIcon` tokens remain the fallback.
- The historical rejection of chrome:// icons as `<img src>` still holds.
- Unit coverage for palette lookup, dedicated sync Localization / `getLocalizedProperty` names,
  CSSOM `#id` `list-style-image` URLs, allowlisted `chrome://` /
  `resource://` snapshot copy, and forbidden `forWindow` lives in
  `tests/firefox-toolbar-widgets.test.mjs` and
  `tests/toolbar-widgets-state.test.mjs`. The real-Firefox customize
  matrix remains `not run`.

## Sources checked

### Official Firefox (tag `FIREFOX_153_0_4_RELEASE`)

- `browser/components/customizableui/CustomizableUI.sys.mjs`
- `browser/components/customizableui/content/panelUI.js`
- `browser/components/extensions/parent/ext-browserAction.js`
- `browser/components/extensions/ExtensionPopups.sys.mjs`
- `toolkit/components/extensions/ExtensionActions.sys.mjs`
- `browser/base/content/browser.js`

### Compatibility canaries (latest commits, checked 2026-08-17)

- `MrOtherGuy/fx-autoconfig` `dfdab5684faf` (2026-07-23)
- `aminomancer/uc.css.js` `88514013ddc3` (2026-01-06)
- `alice0775/userChrome.js` `5e146e348a56` (2026-07-30)
- `xiaoxiaoflood/firefox-scripts` `a898ac59fb0c` (2025-02-10)

They continue to treat `CustomizableUI` widget APIs as the stable
customization entry point; no code was copied or adapted.

## Rejected alternatives

- Reparenting native widget nodes into the project row: breaks Firefox
  ownership, popup anchoring, and customization (already rejected in
  ADR-042's record).
- Cloning extension popup/panel contents: prohibited; Firefox stays the
  panel owner.
- Dispatching the `command` event on the collapsed native button as the
  primary popup path: `PanelMultiView.openPopup` then anchors the transient
  panel at collapsed-node geometry and can fail outright, and a failed open
  removes the transient panel before any re-anchor is possible.
- Writing `CustomizableUI` placements or building a project drag-and-drop
  editor: out of scope; native customize mode remains the only editor.
- Extracting built-in chrome:// icons through computed `list-style-image`
  into an `<img src>`: fragile context-fill and theme coupling; curated
  generic project glyphs were selected for ADR-044. ADR-046 later uses the
  same URLs as a CSS mask with `currentColor` instead of `<img>`.

## Security and privacy effects

- Extension label, tooltip, icon URL, badge text, and badge colors cross
  into frontend in-memory state for rendering only (ADR-044 owner-approved).
  They stay out of logs, persistence, diagnostics, CSS variables, and root
  datasets; diagnostics carry fixed codes and widget counts only.
- Built-in `chrome://` / `resource://` icon URLs later follow the same
  in-memory-only rule (ADR-046): they may exist only as a per-element CSS
  mask on the owning window, never in prefs, logs, diagnostics, CSS
  variables on shared roots, or root datasets.
- Raw widget ids and native nodes stay privileged; the frontend receives
  opaque handles.
- No new mapping, network access, persistence, or eval.

## Validation performed

- Source review for every symbol above against the pinned tag: completed.
- Unit tests and real-Firefox smoke: recorded in the issue #64 change set
  and `docs/testing-and-recovery.md` as they are run.

## Remaining compatibility risk

- The `unified-extensions-item` node shape and `--webextension-toolbar-image`
  property are Firefox-internal details and may change across versions; the
  bridge treats missing attributes as absent data and falls back to the
  generic glyph.
- `PanelUI.showSubView` sets an `open` expando on the project anchor; the
  bridge must tolerate a stale value after failed opens.
- Extensions calling `browserAction.openPopup()` leave
  `openPopupWithoutUserInteraction` set until the next native click path
  runs; mirrored invokes performed afterwards skip click semantics for
  click-only actions in that window until then. Bounded and documented.
