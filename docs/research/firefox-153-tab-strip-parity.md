# Firefox 153 left-tab native parity research

## Environment

- Date: 2026-08-17
- Firefox version: 153.0.4 release
- Build ID: `20260810162159`
- Channel: release
- Operating system: Windows 11 Pro 25H2, build `26200.9168`
- Profile: marker-owned `fennevia-dev` (source review); live Browser Toolbox
  positioning spike: **not run**
- Project commit: `fa2789d` plus the issue #60 worktree
- Official GitHub tag: `FIREFOX_153_0_4_RELEASE` at
  [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)

## Symptom

Issue #11 left a functional vertical tab list without native-adjacent
indicators or gestures. Issue #60 needs audio, container color/label,
attention, middle-click close, drag/keyboard reorder, and the complete Firefox
tab context menu without copying native tab DOM or writing a second menu.

## Minimal reproduction

1. Read Firefox 153 tab attributes, `moveTabTo`, `TabContextMenu.updateContextMenu`,
   `#tabContextMenu` popupshowing, and `ContextualIdentityService` color names.
2. Confirm `TabAttrModified.detail.changed` can carry `soundplaying`, `muted`,
   `activemedia-blocked`, `usercontextid`, `attention`, and `pictureinpicture`.
3. Confirm a custom XHTML tab cannot be `triggerNode` for the native menu:
   `updateContextMenu` only accepts `triggerNode.tab` or `closest("tab")`.
4. Select the smallest bridge actions that keep native handles inside
   `src/firefox/`.

## First causal evidence

- Source: Firefox 153
  [`tab.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tab.js)
  exposes `soundPlaying`, `muted`, `activeMediaBlocked`, `userContextId`,
  `attention`, `pictureinpicture`, and `toggleMuteAudio()`. The audio overlay
  click path mutes without treating the click as a close.
- Source: `_tabAttrModified` in
  [`tabbrowser.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tabbrowser.js)
  still bubbles a `changed` string list. Issue #10 ignored every attribute
  except `busy`, `image`, `label`, and `selected`, so audio/container/attention
  never reached the strip.
- Source: `TabContextMenu.updateContextMenu` sets
  `contextTab = triggerNode.tab || triggerNode.closest("tab") || selectedTab`.
  [`main-popupset.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/main-popupset.js)
  always runs that function on `#tabContextMenu` `popupshowing`. Opening the
  menu from a Svelte button would therefore act on the selected tab, not a
  background tab.
- Source: `gBrowser.moveTabTo(element, { tabIndex, isUserTriggered })` clamps
  pinned and unpinned partitions itself.
- Source:
  [`ContextualIdentityService.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/toolkit/components/contextualidentity/ContextualIdentityService.sys.mjs)
  publishes closed color names `gray`, `yellow`, `orange`, `red`, `pink`,
  `purple`, `violet`, `blue`, `cyan`, and `green`, plus aliases `turquoise` →
  `cyan` and `toolbar` → `gray`. `getPublicIdentityFromId` returns `name` and
  `color` without requiring Fennevia to load `resource://usercontext-content/`.
- Live Browser Toolbox proof that `openPopup(nativeTab)` plus `moveTo(screenX,
  screenY)` lands on the cursor while native tabs are collapsed: **not run**.
  The selected sequence remains the source-backed minimum; a bridge-owned
  `.tab` trigger node is the recorded fallback if positioning fails on the
  supported build.

## Sources checked

### Official Firefox

- `tab.js` getters, `toggleMuteAudio`, and overlay click handling.
- `tabbrowser.js` `moveTabTo`, `_tabAttrModified`, and `TabContextMenu`.
- `main-popupset.js` `#tabContextMenu` `popupshowing`.
- `ContextualIdentityService.sys.mjs` `CONTAINER_COLORS` and
  `getPublicIdentityFromId`.

### Compatibility canaries

- Alice0775/userChrome.js head
  [`5e146e348a56a914e6c016d29733e8ee8d468155`](https://github.com/alice0775/userChrome.js/commit/5e146e348a56a914e6c016d29733e8ee8d468155):
  still consumes native tab events; no reusable typed menu handoff.
- MrOtherGuy/fx-autoconfig head
  [`dfdab5684faffc112b76ccb1d8cab7f75da0102c`](https://github.com/MrOtherGuy/fx-autoconfig/commit/dfdab5684faffc112b76ccb1d8cab7f75da0102c):
  loader/window filtering only.
- xiaoxiaoflood/firefox-scripts head
  [`a898ac59fb0ca3886c0c46b184fdbc037c83c037`](https://github.com/xiaoxiaoflood/firefox-scripts/commit/a898ac59fb0ca3886c0c46b184fdbc037c83c037):
  scripts call `TabSelect`/`TabClose` and container APIs directly.
- aminomancer/uc.css.js head
  [`88514013ddc375f4770f4a35d8d07a91d6dd7d8f`](https://github.com/aminomancer/uc.css.js/commit/88514013ddc375f4770f4a35d8d07a91d6dd7d8f):
  `TabAttrModified` includes `busy`/`progress`; vertical-tab work overrides
  native tab classes. That override path is out of scope.

No canary code was copied.

## Upstream behavior

| Surface | Firefox 153 behavior used by Fennevia |
|---|---|
| Audio attributes | `soundplaying`, `muted`, and `activemedia-blocked` are boolean attributes. Overlay click calls `toggleMuteAudio()` or `resumeDelayedMedia()`. |
| Containers | `usercontextid` is numeric; `0`/absent is no container. Public identity supplies color name and label. |
| Attention | `attention` is toggled on background title change. |
| Picture-in-picture | `pictureinpicture` attribute presence. |
| Reorder | `moveTabTo(tab, { tabIndex, isUserTriggered: true })` is the current user-move entry. |
| Context menu | `#tabContextMenu.openPopup(nativeTab, ...)` makes `triggerNode` a real `<tab>`. `moveTo(screenX, screenY)` is the selected cursor placement after open. |
| Popup hold | `popupshown` / `popuphidden` on that menupopup are the hide-hold signals. |

## Loader-specific baggage identified

- Custom tab class overrides, native vertical-tab mirrors, and full menu clones
  are Firefox-maintenance traps, not Fennevia adapters.
- Putting a native tab on a Svelte node as `.tab` would leak a privileged
  handle into project DOM. Rejected.
- Container icons from `resource://usercontext-content/` would add a new
  resource consumer without a dedicated mapping review. Deferred; color stripe
  plus bounded label is enough.

## Options considered

1. Reimplement the tab context menu in Svelte. Rejected: duplicates Firefox
   policy for duplicate, send-tab, containers, undo-close, and extensions.
2. Open `#tabContextMenu` with the Svelte button as `triggerNode`. Rejected:
   `updateContextMenu` would fall back to `selectedTab`.
3. `openPopup(nativeTab)` then `moveTo(screenX, screenY)`. Selected as the
   source-backed sequence that keeps `triggerNode` native and coordinates
   ordinary.
4. Bridge-owned anonymous node with `.tab = nativeTab` plus
   `openPopupAtScreen`. Recorded fallback only.
5. Expose `userContextId` to Svelte. Rejected: the UI only needs an allowlisted
   color token and a bounded label.

## Decision and minimum adaptation

- Expand `#10` snapshots with optional `audio`, `attention`,
  `pictureInPicture`, and `container: { color, label }`.
- Reconcile the extra `TabAttrModified` names. Unrelated attributes stay
  ignored.
- Add `move`, `toggleMute`, and `openContextMenu({ screenX, screenY })`.
- Treat `ContextualIdentityService` as optional. Missing service, private
  windows, or unknown colors omit container fields and do not fail health.
- Require `gBrowser.moveTabTo` and `#tabContextMenu` `openPopup`/`moveTo`.
- Wire `popupshown`/`popuphidden` to the existing left `setPopupHeld` path.
  Do not add a second hide timer.
- Keep mute as a sibling button. Middle-click closes. Drag and
  `Ctrl+Shift+ArrowUp/Down` call `move`.

## Security and privacy effects

- Container labels are user-derived text with an 80 code-point cap, rendered
  only as text/accessible name. They must not enter logs, datasets, or errors.
- Color names are a closed enum mapped to CSS tokens. No page-controlled hex
  or URL is interpolated into style.
- Audio/attention/PiP are closed enums or booleans.
- Opaque tab IDs may travel in `dataTransfer` during drag; titles and URLs
  must not.
- Native menu actions remain Firefox-owned.

## Validation performed

- Source and canary review for the symbols above: completed.
- Unit tests for mapping, ignore-list, move clamp, mute, menu trigger, and
  UI helpers: added with the issue #60 implementation.
- `npm run verify`: recorded with the implementation change.
- Real Firefox 153.0.4 ordinary/Browser Toolbox/failure-injection matrix:
  **not run**.

## Remaining compatibility risk

- `openPopup` + `moveTo` against a collapsed native tab is source-selected,
  not live-proven on this machine. If the supported build ignores `moveTo`
  after a collapsed anchor, switch to the recorded bridge-owned trigger-node
  fallback in the same issue.
- Tab groups and split views still flatten through `openTabs`. Group UI
  remains deferred.
- Container color refresh (`browser.nova.enabled`) only changes hex codes.
  Fennevia stores color names, not hex, so CSS tokens may drift visually
  until revalidated.

## Follow-up

- Tab groups, split view, workspaces, multi-select, and thumbnails remain
  separate issues.
- Re-run the live menu-positioning spike on the next supported Firefox stable.
