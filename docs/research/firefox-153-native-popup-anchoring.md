<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 153 native popup anchoring research

## Environment

- Date: 2026-08-17
- Firefox version: 153.0.4 release
- Build ID: `20260810162159`
- Channel: release
- Operating system: Windows 11 Pro 25H2, build `26200.9168`
- Profile: marker-owned `fennevia-dev` (source review); live Browser Toolbox
  placement spike: **not run**
- Project commit: `b892db6` plus the ADR-042 worktree
- Official GitHub tag: `FIREFOX_153_0_4_RELEASE` at
  [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)
- Package: `0.10.0-beta.1`

This is a source and focused-build record. Live popup placement against a
collapsed navbar was not executed on a real Firefox window. No support claim
is added for another Firefox version, channel, operating system, or profile.

## Symptom

ADR-037's anchored browser-tool actions called `nativeUi.revealForToolbar()`,
focused the original navbar control, then clicked/`PanelUI.show()`/
`togglePanel()`. `NativeUi.sys.mjs` kept the complete navbar visible while that
popup was open because `popupAnchorIsManaged()` is true for anchors inside
`#navigator-toolbox`. The custom row also dismissed itself before the handoff.

Result: original Firefox chrome appeared, and the panel sat at the collapsed
native button geometry instead of beside the Fennevia control.

## In-scope buttons

Popup handoffs only:

- Top: Downloads, Unified Extensions, application menu
- Left launcher: site information, tracking protection
- Centered address popup: site information, tracking protection, site
  permissions
- Already separate: left-edge tab `#tabContextMenu` (`openPopup` + `moveTo`)

Out of scope: Settings, Customize, Show original toolbar, native Urlbar
handoff, page-action overflow, bookmark star/Library, bottom-edge Downloads
(read-only aggregate).

## First causal evidence

### Application menu

[`panelUI.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/customizableui/content/panelUI.js)
`PanelUI.show()` always anchors through `_getPanelAnchor(this.menuButton)`
inside a fire-and-forget async IIFE after `ensureReady()`. Calling `show()`
first therefore races a later native-button `openPopup` against any subsequent
`moveToAnchor`. Panel id: `appMenu-popup`. Selected sequence: await
`PanelUI.ensureReady()`, optionally `_ensureShortcutsShown()`, then open
`#appMenu-popup` with the panel's native `bottomcenter topright` placement
(not `after_end`, which opens off-screen to the right of the hamburger).
Prefer `window.PanelMultiView.openPopup`. Firefox 153 exposes that owner as
an ES class via `ChromeUtils.defineESModuleGetters` (`typeof === "function"`),
so a plain-object `isNativeRecord` check skips it and falls through to a raw
`openPopupAtScreenRect`. That leaves `openViews` empty; `popupshown` then
throws `TypeError: can't access property "isOpenIn", panelView is undefined`
at `PanelMultiView.sys.mjs:1093`. The bridge must accept a class or object
owner. `popupshown` then calls `#activateView(this.openViews[0])`. Opening with
`openPopupAtScreenRect` alone is still forbidden. When HTML anchoring fails,
temporarily route `panel.openPopup` to `openPopupAtScreenRect` only for that
`PanelMultiView.openPopup` call, then restore Firefox's method. An unanchored
`PanelMultiView.openPopup` at the host viewport point is next. `PanelUI.show()`
remains last.

### Downloads

[`indicator.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/downloads/content/indicator.js)
`DownloadsButton.getAnchor()` returns null when the parent toolbar fails
`isElementVisible`. [`downloads.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/downloads/content/downloads.js)
`showPanel()` then refuses to open. `initialize()` loads data without opening.
Panel id: `downloadsPanel`. Selected sequence: `DownloadsPanel.initialize()`,
then `openPopup(host)` on `#downloadsPanel`. Do not click `#downloads-button`.

### Trust / identity / protections

[`browser-trustPanel.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/browser-trustPanel.js)
`showPopup()` initializes and updates the Trust panel, then
`PanelMultiView.openPopup(this.#popup, this.#anchor())`. `#anchor()` uses
`checkVisibility()` on native nodes. Collapsed Fennevia navbar would make that
visibility check fail and wrongly look like a Trust feature-gate. Panel ids:
`trustpanel-popup` (lazy), with legacy `identity-popup` and
`protections-popup`. Selected sequence: call `gTrustPanelHandler.showPopup()`
when that owner exists, then `moveToAnchor` or `openPopup` on
`#trustpanel-popup`. Do not use navbar `checkVisibility()` as the Trust
feature-gate.

### Site permissions

[`browser-sitePermissionPanel.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/browser-sitePermissionPanel.js)
documents `gPermissionPanel.setAnchor(node, position)` as the public override
for an outside consumer. Panel id: `permission-popup` (lazy). Selected
sequence: `setAnchor(host, position)` then `openPopup({})`. Clear `setAnchor`
on `popuphidden` and dispose.

### Unified Extensions

[`browser-unified-extensions.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/browser-unified-extensions.js)
`gUnifiedExtensions.togglePanel()` owns panel contents. Panel id:
`unified-extensions-panel`. Selected sequence: if already open, `hidePopup`;
else toggle the current owner, then `openPopup`/`moveToAnchor` on the project
host.

## Selected implementation

Follow ADR-041: Firefox still owns panel contents; Fennevia only supplies a
project-owned XHTML host as the visual anchor.

1. Stop `revealForToolbar` and native `focus()` for the six popup actions.
   Settings, Customize, and original-toolbar access are unchanged.
2. Keep the Fennevia control visible. Stop `onDismiss` /
   `closeAddressPopupForNativeHandoff` for popup actions. Hold the matching
   top or left edge with the existing `#31` `setPopupHeld` path. Keep the
   address overlay open when the host is a detail card.
3. Open or populate through the current Firefox owner, then
   `openPopup`/`moveToAnchor`/`setAnchor` on the clicked host.
4. `NativeUi.sys.mjs` ignores toolbox reveal for a short-lived panel-id
   handoff token and for popups whose `anchorNode` is inside the Fennevia
   frame. Firefox-initiated doorhangers that stay anchored in the toolbox
   still reveal native chrome.
5. Placement: top Downloads `after_start`; menu/extensions `after_end`;
   left-rail identity/protection `end_before`; address-popup identity,
   protection, and permission cards `after_end`. Resolve position from the
   host (`closest("[data-fennevia-address-popup]")` then
   `closest('[data-fennevia-edge="left"]')`), else the action default. Let XUL
   flip if the window is too small. Do not restyle native panel chrome.
6. `popuphidden` releases the edge hold, clears `setAnchor`, and drops the
   NativeUi token. Window dispose still `hidePopup` if the panel is open.
   Host nodes stay inside `src/firefox/`; they never enter snapshots,
   datasets, or logs.

Allowlisted panel ids:

- `appMenu-popup`
- `unified-extensions-panel`
- `downloadsPanel`
- `trustpanel-popup`
- `identity-popup`
- `protections-popup`
- `permission-popup`

`EXPECTED_STYLE_RULE_COUNT` remains 7. No extra hide-rule was required.

## Sources checked

### Official Firefox

- `panelUI.js` `show`, `ensureReady`, `_getPanelAnchor`, `#appMenu-popup`
- `indicator.js` `DownloadsButton.getAnchor` / `isElementVisible`
- `downloads.js` `DownloadsPanel.showPanel` / `initialize`
- `browser-trustPanel.js` `showPopup` / `#anchor` / `#trustpanel-popup`
- `browser-siteIdentity.js` and `browser-siteProtections.js` legacy owners
- `browser-sitePermissionPanel.js` `setAnchor` / `openPopup`
- `browser-unified-extensions.js` `togglePanel`
- `navigator-toolbox.js` Trust/identity/protection/Downloads click routing

### Compatibility canaries

Not used as implementation templates. Maintained loaders do not provide a
typed host-anchored PanelMultiView handoff for stock Firefox 153.

### Product reference

`yutinglia/my-firefox-custom` was not consulted for this change. No `.uc.js`
selector, ID, class, timer, global flag, numeric value, or native-DOM mutation
strategy was copied.

## Rejected alternatives

- Reparenting native anchors into the custom row: already rejected; breaks
  Firefox ownership, popup anchoring, and customization.
- Cloning Trust/identity/permissions/Downloads/PanelUI contents: would
  duplicate security-sensitive data and actions.
- Ghost-positioning collapsed native buttons with CSS so `checkVisibility` /
  `isElementVisible` succeed: hides a missing-owner failure as a layout hack.
  If a panel cannot open without a visible native node, record a blocker.
- Using navbar `checkVisibility()` as the Trust feature-gate: collapsed chrome
  would always fall back to legacy identity/protections.
- Calling `PanelUI.show()` then racing `moveToAnchor`: `show()` is
  fire-and-forget and re-anchors to `#PanelUI-menu-button`. Host-open remains
  first. `show()` is only the fallback after the panel stays closed, with the
  NativeUi token already set and `popupshown` performing `moveToAnchor`.

## Security and privacy effects

- Hosts are project-owned XHTML nodes in this window. They are validated as
  objects with `getBoundingClientRect`, `ownerDocument === window.document`,
  and `frame.contains(host) === true`.
- Hosts, panel nodes, handlers, URLs, titles, certificates, permission
  records, extension identity, and download metadata never enter snapshots,
  datasets, or logs.
- NativeUi tokens store only allowlisted panel ids.
- Toolbox-anchored Firefox doorhangers still reveal chrome.

A real Firefox 153.0.4 click on a host-anchored popup button fail-opened the
window with `FENNEVIA_EDGE_CONTROLLER_RUNTIME_FAILED`. The first causal error
was an unbound `frame.contains` call (`Node.prototype.contains` requires the
frame as `this`). Host containment now uses `Reflect.apply`, popup invoke
failures no longer call `onFatalError`, and the clicked host is resolved from
`currentTarget` or `target.closest("[data-fennevia-browser-tool]")`.

After that containment fix, some popup buttons still no-op because Firefox 153
`gTrustPanelHandler.showPopup()` can throw after `#initializePopup()`:
`#updatePopup()` runs before open, and `PanelMultiView.openPopup` then uses
`#anchor()` which is `undefined` on a collapsed navbar. Permission
`openPopup` can similarly fail after the lazy template is stamped. The bridge
now catches those owner failures and still `openPopup`/`moveToAnchor`s the
existing panel on the project host. Prefer `window.PanelMultiView.openPopup`
when present. `popupshown` drops unused panel-id tokens so a leftover
`identity-popup` handoff cannot hide a later toolbox doorhanger.

## Validation performed

- Source review for the symbols above: completed.
- Unit tests for no-reveal popup actions, required host, Trust without
  `checkVisibility`, Trust/permission owner-throw still host-opening, host
  surface positions without requiring `closest` for the action default,
  `PanelMultiView.openPopup` preference, unused handoff-token cleanup,
  Downloads `initialize`+`openPopup`, application-menu `PanelMultiView.openPopup`
  with `openPopupAtScreenRect` routed through `panel.openPopup` after
  `#showMainView`, ignored `popuphidden` during a still-in-progress open,
  `PanelUI.show` fallback plus host `moveTo`, NativeUi Fennevia-anchor/token
  carve-out, hold/release, dispose, and `contains` called with the frame as
  `this`: added with ADR-042 and the host-containment/owner-fallback fixes.
- Live Browser Toolbox / real Firefox 153.0.4 popup placement and lifetime
  against a collapsed navbar: **not run**.

## Remaining compatibility risk

- Application-menu must not call `openPopupAtScreenRect` except from inside
  `PanelMultiView.openPopup` after `#showMainView`. A raw screen-rect open
  leaves `openViews` empty; Firefox 153 then throws
  `TypeError: can't access property "isOpenIn", panelView is undefined` on
  `popupshown` (`PanelMultiView.sys.mjs:1093`). Treating `window.PanelMultiView`
  as a plain object skips the class owner and reproduces that throw. Live
  placement remains **not run**.
- Lazy Trust/permission templates may not exist until the first owner
  `showPopup`/`openPopup`. The bridge re-resolves the panel after the owner
  runs, and still host-opens if that owner throws once the panel id exists.
- `showPopup()` is not awaited on `PanelMultiView.openPopup`; a later
  `#updatePopup`/Places/favicons failure can leave an initialized but closed
  `#trustpanel-popup`. Host-open still proceeds; panel contents stay
  Firefox-owned and may be incomplete until the next successful owner update.
- XUL may flip `after_start` / `after_end` / `end_before` in a small window.
  That is accepted Firefox behavior.

## Follow-up

- Run the real Firefox placement matrix in
  `docs/testing-and-recovery.md` section 6.7 before any release that claims
  host-anchored popup geometry.
- Re-validate panel ids, `setAnchor`, `DownloadsButton.getAnchor`, and
  `PanelUI.show` on the next supported Firefox stable.
