<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 153/154 tab multi-select research

## Environment

- Date: 2026-08-24
- Firefox versions: 153.0.4 release and 154.0 release
- Build IDs: `20260810162159` (153.0.4), `20260812182057` (154.0)
- Channel: release
- Operating system: Windows 11, development host
- Profile: not launched for this record
- Project commit: `e642e63` plus the issue #109 worktree
- Official GitHub tags: `FIREFOX_153_0_4_RELEASE` at
  [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)
  and `FIREFOX_154_0_RELEASE`

## Symptom

Issue #109 needs the Fennevia vertical tab strip to follow Firefox's tab
multi-select contract: Accel-click toggles a tab without activating it,
Shift-click selects a range, selected tabs move as a group, and native
`#tabContextMenu` plus row close/mute/pin act on that set. The strip previously
always called `select()`, so Accel/Shift never reached `gBrowser`.

## Minimal reproduction

1. Read Firefox 153/154 `tab.js` mousedown/click and `tabbrowser.js`
   `addToMultiSelectedTabs`, `addRangeToMultiSelectedTabs`,
   `selectedTabs`, `lockClearMultiSelectionOnce`, and `TabMultiSelect`.
2. Confirm Fennevia `TabStrip.svelte` left-click always activates and
   `beginDrag` stores one native tab.
3. Confirm `#tabContextMenu` already keys off `contextTab.multiselected`, so
   driving native multi-select is sufficient for menu plural actions.

## First causal evidence

- Source: Firefox 154
  [`tab.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_154_0_RELEASE/browser/components/tabbrowser/content/tab.js)
  `on_mousedown` uses `event.getModifierState("Accel")` and `event.shiftKey`.
  Shift range uses `gBrowser.lastMultiSelectedTab`, optionally sets
  `selectedTab` back to that anchor, calls `clearMultiSelectedTabs()`, then
  `addRangeToMultiSelectedTabs(anchor, this)`. Accel toggle calls
  `removeFromMultiSelectedTabs` or `addToMultiSelectedTabs` without changing
  `selectedTab`. Accel-click on the current `selectedTab` when it is not
  already `multiselected` is a no-op. A primary click on a multi-selected
  background tab calls `lockClearMultiSelectionOnce()` so the later activate
  keeps the set.
- Source: the same file's `on_click` clears multi-select when Accel/Shift are
  not held and `gBrowser.multiSelectedTabsCount > 0`. Close, mute, and delayed
  media on a `multiselected` tab call `removeMultiSelectedTabs` /
  `toggleMuteAudioOnMultiSelectedTabs` / `resumeDelayedMediaOnMultiSelectedTabs`.
- Source: Firefox 154
  [`tabbrowser.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_154_0_RELEASE/browser/components/tabbrowser/content/tabbrowser.js)
  `addToMultiSelectedTabs` sets the `multiselected` and `aria-selected`
  attributes and records the tab in `_multiSelectedTabsSet`. `_endMultiSelectChange`
  also adds `selectedTab` to the set and dispatches bubbling `TabMultiSelect` on
  `gBrowser`. `addRangeToMultiSelectedTabs` walks `visibleTabs` between the two
  endpoints. `selectedTabs` returns connected non-closing multi-selected tabs
  plus `selectedTab` if needed, sorted by `_tPos`.
- Source: Firefox 154 `tabs.js` dragstart builds `movingTabs` from
  `gBrowser.selectedTabs` when the handle is `multiselected`, then filters to
  the same pinned partition. Drop adopts non-selected movers first and the
  selected tab last. Detach of a multi-selected set uses
  `replaceTabsWithWindow`.
- Source: Firefox 153.0.4 `tab.js` uses the same method names
  (`addToMultiSelectedTabs`, `addRangeToMultiSelectedTabs`,
  `lastMultiSelectedTab`, `lockClearMultiSelectionOnce`).
- Canaries: alice0775/userChrome.js, MrOtherGuy/fx-autoconfig,
  xiaoxiaoflood/firefox-scripts, and aminomancer/uc.css.js were searched for
  this change. None replace `gBrowser` multi-select; they are not templates.

## Selected Fennevia change

Keep native `gBrowser` as the only selection owner. The tabs bridge snapshots
`multiselected`, forwards Accel/Shift/keep-multi gestures to the methods above,
listens for `TabMultiSelect`, and captures `movingTabs` at `beginDrag`. The
Svelte strip maps pointer/keyboard gestures through `src/app/tab-strip.ts` and
does not store a second selected-id set.

Shift+Arrow range and Accel+Space toggle are Fennevia accessibility extensions
of those same native methods. Firefox's own tab strip still uses Arrow to
activate a single tab.

## Validation

- Source pin: Firefox 153.0.4 and 154.0 `tab.js` / `tabbrowser.js` as linked
  above.
- Automated: unit tests for snapshot copy, capability failure, toggle/range
  without changing `selectedTab`, keep-multi lock, group `moveTabTo` /
  `adoptTab` order, row close/mute/pin, and `inspectDrag().count`.
- Real Firefox 153/154 matrix: **not run**.

## Later follow-up

Issue #109's owned strip now collapses non-handle moving rows into one stacked
handle while a group drag is active, then lets the native move expand the set
on drop. That is a Fennevia-owned presentation of the captured `movingTabs`
set. It does not copy Firefox `tab-stacking.js`, `dragtarget`, or
`multiselectStacking` internals.
