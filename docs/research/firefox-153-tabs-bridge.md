# Firefox 153 typed tabs bridge research

## Environment

- Date: 2026-08-15
- Firefox version: 153.0.4 release
- Build ID: `20260810162159`
- Channel: release
- Operating system: Windows 11 Pro 25H2, build `26200.9168`
- Profile: clean, unregistered, marker-owned `fennevia-dev`
- Project commit: `e2ce5a8c01db2618a958f9760af58bfa01ebc01c` plus the issue #10 worktree
- Firefox release source stamp: `54be19de0e08edff0b797e55fd935dd3978b0a6d`
- Official GitHub tag: `FIREFOX_153_0_4_RELEASE` at
  [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)

## Symptom

Issue #10 needed an event-driven tab model for a future Svelte tab strip. The
initial interface direction did not establish which Firefox collection excludes
closing/special tabs, which event order is safe around selected and last-tab
close, or which favicon values can cross the privileged boundary.

## Minimal reproduction

1. Start the marker-owned profile with the generated bridge installed.
2. Read the ordered initial snapshot in each normal/private browser window.
3. Open, select, move, pin, unpin, retitle, start/stop loading, and close native
   tabs while observing immutable public snapshots.
4. Repeat through the public bridge actions and try a closed ID and an ID from a
   different window.
5. Close the window or stop the runtime, then fire another fake/native event and
   verify that no subscriber runs and every mapping is gone.
6. Replace the installed bridge with a capability-failure fixture and verify the
   #7 fail-open lifecycle before restoring the exact artifact bytes.

## First causal evidence

- Browser Console: the completed normal, second-normal, and private-window runs
  recorded no unexpected first-party script error. No tab title, URL, favicon,
  profile path, or native object appeared in lifecycle records.
- Browser Toolbox: the issue #10 ownership run retained the existing XHTML host
  boundary and native browser/tab infrastructure. The bridge added no native
  selector, DOM replacement, or native-hide gate.
- Source distinction: Firefox 153's `gBrowser.tabs` forwards to `allTabs`, while
  `gBrowser.openTabs` explicitly excludes closing tabs and the Firefox View tab.
  The latter is the correct active-model input. This resolves the close-time
  ambiguity without polling or filtering private Firefox flags in application
  code.

## Sources checked

### Official Firefox and Searchfox

- [`tabbrowser.js`](https://searchfox.org/firefox-main/source/browser/components/tabbrowser/content/tabbrowser.js)
  and the pinned
  [`FIREFOX_153_0_4_RELEASE` copy](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tabbrowser.js):
  `openTabs`, `selectedTab`, `_fireTabOpen`, `_beginRemoveTab`,
  `_tabAttrModified`, `setIcon`, `addTrustedTab`, `removeTab`, `pinTab`, and
  `unpinTab`.
- [`tabs.js`](https://searchfox.org/firefox-main/source/browser/components/tabbrowser/content/tabs.js)
  and the pinned
  [`FIREFOX_153_0_4_RELEASE` copy](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tabs.js):
  `allTabs`, `openTabs`, tab movement, and tab event dispatch.
- [`tab.js`](https://searchfox.org/firefox-main/source/browser/components/tabbrowser/content/tab.js)
  and the pinned
  [`FIREFOX_153_0_4_RELEASE` copy](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tab.js):
  current tab attributes and open/closing state.
- Current source tests:
  [`browser_pinnedTabs.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/test/browser/tabs/browser_pinnedTabs.js),
  [`browser_removeTabs_order.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/test/browser/tabs/browser_removeTabs_order.js),
  [`browser_tab_move_active_tab.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/test/browser/tabs/browser_tab_move_active_tab.js),
  and
  [`browser_tabswitch_select.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/test/browser/tabs/browser_tabswitch_select.js).
- Firefox's
  [tabbrowser source documentation](https://searchfox.org/firefox-main/source/browser/base/content/docs/tabbrowser/index.rst)
  confirms one `gBrowser` per browser window.

### Compatibility canaries

- Alice0775/userChrome.js head
  [`5e146e348a56a914e6c016d29733e8ee8d468155`](https://github.com/alice0775/userChrome.js/commit/5e146e348a56a914e6c016d29733e8ee8d468155):
  current-version scripts still consume `TabMove`, `TabClose`, `gBrowser.tabs`,
  and direct pin/unpin methods. Recent changes were script/drag behavior, not a
  reusable typed tab model.
- MrOtherGuy/fx-autoconfig head
  [`dfdab5684faffc112b76ccb1d8cab7f75da0102c`](https://github.com/MrOtherGuy/fx-autoconfig/commit/dfdab5684faffc112b76ccb1d8cab7f75da0102c):
  no current tab-state implementation. Commit
  [`3dfa4d8803e4e1ef912560e5d88f6f962b57c82d`](https://github.com/MrOtherGuy/fx-autoconfig/commit/3dfa4d8803e4e1ef912560e5d88f6f962b57c82d)
  is window-loading compatibility work and reinforces exact window filtering,
  but contributes no tab bridge behavior.
- xiaoxiaoflood/firefox-scripts head
  [`a898ac59fb0ca3886c0c46b184fdbc037c83c037`](https://github.com/xiaoxiaoflood/firefox-scripts/commit/a898ac59fb0ca3886c0c46b184fdbc037c83c037):
  scripts such as `privateTab.uc.js`, `multifoxContainer.uc.js`, and
  `BeQuiet.uc.js` directly consume `TabSelect`/`TabClose`; they do not isolate
  native objects behind an ordinary-data contract.
- aminomancer/uc.css.js head
  [`88514013ddc375f4770f4a35d8d07a91d6dd7d8f`](https://github.com/aminomancer/uc.css.js/commit/88514013ddc375f4770f4a35d8d07a91d6dd7d8f):
  `tabLoadingSpinner.uc.js` filters `TabAttrModified` for `busy`/`progress`, and
  `verticalTabsPane.uc.js` consumes the open/close/select/move/pin events plus
  label/image/busy attributes. Commit
  [`9c6e4741`](https://github.com/aminomancer/uc.css.js/commit/9c6e4741fef075c0350e7c184489dc115a84f40c)
  also demonstrates the maintenance cost of overriding tab classes for tab
  groups. That override-heavy approach is outside Fennevia's scope.

No canary implementation was copied, so no third-party runtime code or license
obligation was introduced.

## Upstream behavior

| Surface | Firefox 153 behavior used by Fennevia |
|---|---|
| `gBrowser.openTabs` | Returns native tabs in logical tab order, including hidden/collapsed-group tabs but excluding closing and Firefox View tabs. |
| `TabOpen` | Fires after the new tab is in a consistent tab model and before its regular load starts. |
| `TabClose` | `_beginRemoveTab` selects a replacement first when required, marks the old tab closing, removes it from `openTabs`, and then dispatches the event before final teardown. A last-tab fast path may close the whole window without a tab event. |
| `TabSelect` | Fires on the new selected tab with `previousTab`; selected-attribute notifications follow. Fennevia reads strict identity from `gBrowser.selectedTab` instead of depending on attribute timing. |
| `TabMove`, `TabPinned`, `TabUnpinned` | Pinning and unpinning can also move the tab. Firefox's tests assert the resulting pinned/unpinned order. Fennevia therefore rebuilds one ordered snapshot after each event rather than composing event details. |
| `TabAttrModified` | `detail.changed` identifies updates. `label`, `image`, `busy`, and `selected` are the only fields relevant to the #10 model; unrelated changes are ignored. |
| `label`, `image`, `busy`, `pinned` | The title is the `label` attribute; loading and pin state are attribute presence. `setIcon` emits `image` changes and accepts only Firefox-local protocols before optionally wrapping SVG data with `moz-remote-image:`. |
| Actions | `addTrustedTab(BROWSER_NEW_TAB_URL, { inBackground })` opens only Firefox's configured new-tab target with a system principal. `removeTab` preserves permit-unload/last-tab behavior. `selectedTab`, `pinTab`, and `unpinTab` are synchronous native operations whose result is re-read. |

## Loader-specific baggage identified

- Arbitrary `.uc.js` discovery, metadata parsing, sandbox adaptation, and script
  compatibility branches do not belong in the bridge.
- Direct custom-script ownership of native tabs cannot cross into Svelte.
- Overridden tab classes, vertical-tab native DOM mirrors, tab-group patches,
  and custom context menus are unrelated to the minimum state adapter.
- Historical Firefox version branches and defensive compatibility hacks were
  not adopted. A current missing symbol is a typed fail-open condition.

## Options considered

1. Poll `gBrowser.tabs` and diff by index. Rejected because it includes the
   wrong close-time population and creates a continuous privileged DOM poll.
2. Apply granular mutations from each event's `detail`. Rejected because pin,
   unpin, selected-close, groups, and split views can produce several ordered
   events; the details are more fragile than the current collection.
3. Rebuild the small immutable snapshot from `openTabs` after seven event types.
   Selected because it is event-driven, preserves native order and identity,
   and needs no speculative event-order abstraction.
4. Expose every native `image` value. Rejected because future UI could turn a
   browsing-controlled or SVG value into a second resource load or injection
   sink.
5. Let `open()` accept a URL. Rejected because #10 needs a new-tab action, not a
   privileged arbitrary-navigation API.

## Decision and minimum adaptation

- `src/firefox/tabs.ts` creates one controller per validated boundary/window.
  Its private context-scoped registry is the only native-tab mapping.
- Initial and event-driven reads use `gBrowser.openTabs`. Stable IDs depend only
  on registry identity and survive title, favicon, selection, pin, load, and
  order changes.
- The public frozen `BrowserTabsBridge` exposes only snapshot, subscribe,
  select, open-new-tab, close, pin, and unpin operations. Closed and foreign IDs
  fail with typed errors before a native action.
- Every relevant native event performs one synchronous full reconciliation.
  Equal snapshots do not publish a duplicate event. There is no interval,
  observer outside the owning window, or process-global tab state.
- `src/app/tab-state.ts` copies the exact primitive fields into a separately
  frozen, Svelte-independent reactive adapter. It drops unknown properties and
  rejects malformed/duplicate IDs.
- Svelte displays only a count diagnostic in #10. The visual tab strip remains
  issue #11.
- A missing collection/action/new-tab capability throws before `healthy` and
  follows the established host/frontend/bridge cleanup path. Window disposal
  handles the last-tab fast path even if no `TabClose` is delivered.

## Security and privacy effects

- Titles are bounded to Firefox's current 256-character label limit and cross
  as plain text only. They are never logged, placed in datasets, persisted, or
  interpreted as markup.
- `faviconUrl` is optional. Only bounded `chrome://`, `resource://`,
  `moz-remote-image:`, or base64 raster image values cross the boundary. Raw
  remote, `about:`, SVG data, malformed, oversized, whitespace/quote-bearing,
  and unknown values become the explicit no-favicon fallback.
- The bridge does not load a favicon or any network resource. Issue #11 must
  bind an accepted value through an image property and must not interpolate it
  into HTML or CSS.
- `open()` accepts only a selected/background option and reads the fixed
  `BROWSER_NEW_TAB_URL`; no browsing URL enters the action contract.
- Normal/private state exists only in the owning in-memory window. Disposal
  clears subscribers, snapshots, and native mappings. Diagnostics retain only
  fixed code/phase/symbol/build/window-kind values.

## Validation performed

- `npm test`: 69/69 tests passed. New tests cover initial mapping, event
  filtering/reduction, malformed native event failure, title/favicon/loading
  updates, stable reorder identity, bidirectional actions, selected and last-tab
  close, rapid lifecycle, stale and foreign IDs, subscriber isolation,
  malformed state, and double disposal.
- `node tests/firefox-window-lifecycle.mjs ...`: Firefox 153.0.4 passed native
  tab open/close synchronization and isolated tab counts in the existing,
  second-normal, and private windows; close, emergency fallback, and runtime
  stop cleaned up; no unexpected first-party exception was observed.
- The same real matrix with `--browser-toolbox` passed; Inspector selected the
  primary XHTML host while native browser/tab ownership remained outside it.
- `tests/firefox-bridge-recovery.Tests.ps1`: an injected missing base bridge
  capability and an injected missing tabs capability each failed open, removed
  every project host, and retained native browser UI. Exact artifact restoration
  then passed the complete window matrix again and left no Firefox process.
- The deterministic build still emits one 17,296-byte private bridge ESM with
  SHA-256 `a38984d8a2450387264492d4774e5689b755c6ac8e4c178b90ff684114e79b65`.
  Runtime endpoint, dynamic import/code, source-map, and artifact inventory
  gates remain active.

## Remaining compatibility risk

- Every adopted tab API/event/attribute is internal and must be revalidated on
  the next supported Firefox stable.
- Tab groups and split views are represented only through flattened
  `openTabs` order; group/workspace semantics remain deferred. Their event
  sequences could increase reconciliation frequency but cannot put native group
  objects in public state.
- A permit-unload prompt can defer or reject close. The bridge intentionally
  retains the tab until Firefox actually removes it from `openTabs`.
- Future favicon source or `moz-remote-image:` behavior may change. Unknown
  values safely fall back, but compatibility review should check whether the
  allowlist still yields useful icons.
- Runtime evidence is Windows-only. No Linux or macOS support is claimed.

## Follow-up

- Issue #11 may render these snapshots and actions as the tab-strip MVP without
  adding native handles or broadening the favicon sink.
- Issue #60 later extended this snapshot with optional audio, attention,
  picture-in-picture, and container color/label fields, plus `move`,
  `toggleMute`, and native `#tabContextMenu` handoff. See
  `docs/research/firefox-153-tab-strip-parity.md`. This #10 record is unchanged.
- Issue #12 must independently validate selected-browser navigation symbols.
- Re-run source/canary review, the real three-window matrix, failure injection,
  and cleanup tests when Firefox stable changes.
