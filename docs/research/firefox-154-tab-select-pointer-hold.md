<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 154 tab-select pointer hold and 500 ms new-tab highlight

## Environment and report

- Date: 2026-08-23.
- Supported source target reviewed: Firefox 154.0 commit
  [`032a9fc1ac0cc3209f7c142744ba2e40847c8086`](https://github.com/mozilla-firefox/firefox/commit/032a9fc1ac0cc3209f7c142744ba2e40847c8086).
- Owner-requested behavior: shorten the new-tab highlight to about 500 ms, and
  keep the configured tab surface visible after clicking a tab item until the
  pointer actually leaves the panel.
- No Firefox process was running during source diagnosis. The exact reporting
  Firefox version, Build ID, channel, profile state, first Browser Console
  error/stack, clean-profile reproduction, and Browser Toolbox inspection were
  not available. Real Firefox rows therefore remain **not run**.

## First causal evidence

The merged ADR-066 source still allowed a pointer-origin tab select to hide its
configured side surface while the mouse stayed inside the panel:

1. `gBrowser.selectedTab` focuses the selected content browser. Firefox chrome
   commonly emits a bubbling `pointerout` whose `relatedTarget` is `null`.
2. The surface root and the window `pointerout` listener both treated
   `relatedTarget === null` as leaving the Firefox window and released the
   shared pointer hold.
3. Focus also moved to content, so the focus hold cleared. With no remaining
   hold, the shared hide timer started.
4. The post-select restore used `elementFromPoint` plus `contains()`. In chrome
   stacking that hit test can miss the owned panel and then call
   `releasePointer`, even though the click coordinates are still inside the
   panel border box. A stationary pointer never re-enters, so the surface stays
   hidden.

The 1,600 ms `newTabHighlightDurationMs` constant and the matching
`fennevia-tab-opened` animation were an independent owner-requested duration
change. That constant remains the explicit programmatic-reveal duration for a
later-opened tab.

## Current Firefox and compatibility evidence

Firefox 154
[`tabbrowser.js`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/tabbrowser/content/tabbrowser.js)
still assigns `selectedTab` and focuses the selected browser. Fennevia continues
to set only that current property through the existing tabs bridge. No new
Firefox symbol, preference, or native DOM mutation is introduced.

The four required compatibility-canary heads were unchanged from the immediately
preceding same-day research records:

- `alice0775/userChrome.js` at
  [`a39f5cb60d40d01a1ae6d65935db152e7ac23111`](https://github.com/alice0775/userChrome.js/commit/a39f5cb60d40d01a1ae6d65935db152e7ac23111);
- `MrOtherGuy/fx-autoconfig` at
  [`dfdab5684faffc112b76ccb1d8cab7f75da0102c`](https://github.com/MrOtherGuy/fx-autoconfig/commit/dfdab5684faffc112b76ccb1d8cab7f75da0102c);
- `xiaoxiaoflood/firefox-scripts` at
  [`a898ac59fb0ca3886c0c46b184fdbc037c83c037`](https://github.com/xiaoxiaoflood/firefox-scripts/commit/a898ac59fb0ca3886c0c46b184fdbc037c83c037);
- `aminomancer/uc.css.js` at
  [`88514013ddc375f4770f4a35d8d07a91d6dd7d8f`](https://github.com/aminomancer/uc.css.js/commit/88514013ddc375f4770f4a35d8d07a91d6dd7d8f).

No canary supplies a Fennevia-owned edge-hold or chrome `pointerout`
classification. No external code, selector, timer, event strategy, numeric
value, or visual composition was copied.

## Minimum Fennevia change selected

- Keep `newTabHighlightDurationMs` coupled to both the just-opened highlight
  timer and `revealProgrammatically`, and set it to 500 ms with the matching
  CSS animation duration.
- After pointer-origin select, reassert the shared pointer hold and do not
  release from that path. Close still hit-tests the current panel border box
  through `src/shell/runtime/pointer-geometry.ts`.
- Ignore a null-`relatedTarget` surface or window `pointerout` when the event
  coordinates remain inside both the window viewport and a visible owned edge
  panel. Do not apply that geometry skip to a non-null destination: a real
  leave reports the last point inside the panel. Do not apply it to a negative
  `clientX`/`clientY` at a flush panel edge: that point can still sit inside
  the panel border box after the pointer has left the OS window. After
  pointer-origin restore, blur any remaining owned surface control so
  `focus-held` cannot outrank a later pointer leave. Window `blur` must not
  release the pointer hold while `Services.focus.activeWindow` is still this
  chrome window. Pointer-origin tab drag reasserts the shared pointer hold on
  in-list `dragover`, blurs leftover focus, and does not use `dragend` client
  coordinates to release the hold. After source drag it reasserts the hold on
  the next Svelte tick. A later geometric exit or true window
  deactivation still uses the one shared delayed-hide owner.

Rejected alternatives were a second hide timer, using focus to pin the tab
panel, treating every null-`relatedTarget` event as a window leave, skipping
every in-panel `pointerout` regardless of `relatedTarget`, skipping window
`blur` whenever `document.hasFocus()` is false and `activeElement` is `body`,
and skipping every in-panel null-`relatedTarget` event without a viewport gate.
Each would violate the #31 shared reveal contract or the observed owner
behavior.

## Later runtime evidence

Debug session `30b4be` on the installed Firefox 154 development profile showed
three remaining false classifications after the first ADR-067 patch:

1. Tab select restored `pointer-revealed`, then a window `blur` with
   `document.hasFocus() === false` and `activeElement` `body` started
   `pending-hide`. Checking for a focused chrome `<browser>` never matched.
   `Services.focus.activeWindow` remains this chrome window during that
   handoff.
2. Moving the pointer out of the OS window at the flush left panel emitted
   `pointerout` with `relatedTarget === null`, negative `clientX`, and
   `insideVisiblePanel: true`, so the geometry skip blocked auto-hide.
3. Same-window tab drag left `dragHoldActive` true while HTML5 `pointerout`
   released the pointer hold; `setDragHold(true)` no-oped because the flag was
   already true, so `pending-hide` started during the drag.

post-fix-4 then showed tab select staying `pointer-revealed` (`chromeWindowActive:
true` on blur). Source tab drag still hid at `dragend`: Firefox reported
`clientX` over content (`348`) while the following `pointerout` still had
`clientX` inside the panel (`120`). The source drag terminal path must reassert
the shared pointer hold and must not use `dragend` coordinates as a hit test.

post-fix-5 confirmed the same `dragend` mismatch while the panel stayed
`pointer-revealed` (`clientX` 378 / 367 reported outside the panel). A later
true window deactivation logged `chromeWindowActive: false` and `pending-hide`.

## Firefox 154 source confirmation

Pinned at commit
[`032a9fc1ac0cc3209f7c142744ba2e40847c8086`](https://github.com/mozilla-firefox/firefox/commit/032a9fc1ac0cc3209f7c142744ba2e40847c8086):

- Tab select: [`tabbrowser.js`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/tabbrowser/content/tabbrowser.js)
  `_adjustFocusAfterTabSwitch` ends with `Services.focus.setFocus(newBrowser,
  focusFlags)` on the chrome `<browser>`.
  [`nsIFocusManager.idl`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/dom/interfaces/base/nsIFocusManager.idl)
  documents `activeWindow` as the most active (frontmost) application window, so
  this handoff keeps the owning chrome window active while `document.hasFocus()`
  is false.
- Source `dragend` coordinates: Windows
  [`nsDragService.cpp`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/widget/windows/nsDragService.cpp)
  ends OLE `DoDragDrop` by reading `GetMessagePos()`, converting with
  `ScreenToClient` on the source HWND, and storing that as `SetDragEndPoint`.
  [`nsBaseDragService.cpp`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/widget/nsBaseDragService.cpp)
  `FireDragEventAtSource` then copies `mEndDragPoint` into the synthesized
  `eDragEnd` `mRefPoint`. That last-message position is not a hit test of the
  pointer over the source panel (Bug 489729 / 505521 / 1773886). Fennevia must
  not release the shared pointer hold from `dragend.clientX` / `clientY`.

## Security, privacy, and provenance

Pointer coordinates remain transient local variables used only for a border-box
and viewport comparison. They are not serialized, persisted, or passed through
the Firefox bridge. `Services.focus.activeWindow` is compared only inside
privileged `WindowShell.sys.mjs`; the frontend receives a boolean. No URL,
profile path, window object, or browsing value is logged. No new resource
mapping, dependency, or third-party material is added.

## Validation

- `npm run typecheck`: passed with zero errors and zero warnings.
- `node --test tests/tab-strip.test.mjs tests/edge-app-interactions.test.mjs
  tests/frontend-build.test.mjs`: passed 22/22.
- `npm run format` and `npm run lint`: passed after Prettier write on the new
  geometry helper and tab-strip source contract.
- `npm run build`: regenerated `ShellStyles.sys.mjs` / `ShellApp.js` with the
  500 ms highlight animation.
- Complete ordinary `npm run verify`: **not run**.
- Real Firefox hover-and-select, new-tab highlight timing, window-leave from a
  panel edge, second-window, and private-window rows: **not run**.
