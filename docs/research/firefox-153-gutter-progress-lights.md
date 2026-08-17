<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 153 gutter progress lights

## Environment

- Date: 2026-08-17
- Supported evidence target: Firefox 153.0.4 release
- Build ID: `20260810162159`
- Official release tag: `FIREFOX_153_0_4_RELEASE`
- Official release commit:
  [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)
- Operating-system target: Windows 11 x64
- Implementation branch: `feat/gutter-progress-lights`
- Package: `0.10.0-beta.1`

This is a source, mapping, health, and generated-artifact record. Real Firefox
load/download light painting, reduced-motion, forced-colors, and fullscreen
checks remain `not run`. No support claim is added for another Firefox version,
channel, operating system, or profile.

## Goal and selected product boundary

Show selected-tab loading at the top of the content gutter and active download
progress at the bottom of the content gutter while the four edge panels stay
hidden at rest. The lights must not reserve extra layout, steal pointer hits,
open a second hover surface, or display filenames.

`yutinglia/my-firefox-custom` was consulted only as a capability and broad
visual reference at commit
`7a02f60bb23abe9c191c7fd8cd2a7096bb63aee5`. Inspected capability, not copied
implementation:

- a thin top indicator while the selected tab loads, then hide;
- a bottom indicator while downloads are active, then hide.

## Old-method issues (why not copy)

The reference loading script combined several Firefox signals and then invented
the rest. That is the source of the intermittent faults:

| Old loading behavior | What goes wrong |
| --- | --- |
| Same object registered with both `gBrowser.addTabsProgressListener` and `gBrowser.addProgressListener` | Tabs listeners receive `(browser, webProgress, …)` first; window progress listeners do not. `aWebProgress.isTopLevel` is sometimes a request object. The bar sticks or never shows. |
| `onLocationChange` always `show()` plus 15% | Hash/SPA/same-document location changes flash the bar even when `Browser:Stop` stays disabled. |
| `setTimeout` 500 / 1500 / 3000 ms fake SPA fill that hides at 100% | Fast pages finish twice; slow pages still load after the bar has hidden. |
| 8 s auto-complete timeout | Long documents or stalled requests hide the bar while Stop is still enabled. |
| `onProgressChange` width from `aCurTotalProgress / aMaxTotalProgress` capped at 85% | Firefox 153 IDL replaces unknown or overflowing totals with `-1`. [`nsBrowserStatusFilter.cpp`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/toolkit/components/statusfilter/nsBrowserStatusFilter.cpp) throttles updates, drops `cur > max` or `cur <= 0`, requires a 3-point jump, and truncates 64-bit progress to 32-bit. HTTP/2 multiplexed subresources make the ratio jump backwards (the old code then ignored it, so the bar stalled). |
| Mutating `.browserStack` | Native content chrome is not a Fennevia host. |

The reference download script had a second set of faults:

| Old download behavior | What goes wrong |
| --- | --- |
| `setInterval` 500–1500 ms plus `Downloads.getList(Downloads.ALL).getAll()` | Lag, extra CPU, and mixing public with private lists. |
| Filter `!stopped && hasProgress && currentBytes < totalBytes` | Unknown-size and some still-running transfers never appear. |
| Legacy `dl-start` / `dl-done` observers plus a 3 s hide and a 1.5 s completion flash | Bar stays expanded after idle, or hides while another transfer is still active. |
| Hover-expand 40px chrome with filename text | Fights the bottom edge trigger and violates Fennevia privacy. |

Rejected from that reference in addition to the table: `#main-window`
insertion, `#top-loading-bar` / `#download-progress-bar` IDs, `.loading-bar-*`
/ `.download-bar-*` classes, 3px/40px/4px geometry, z-index 20000, cyan/lime
hex, hue-rotate shimmer, and a second `nsIWebProgressListener` besides the
existing navigation listener.

## Alternatives considered against Firefox 153

| Alternative | Firefox 153 evidence | Decision |
| --- | --- | --- |
| Determinate load bar from `onProgressChange` | IDL `-1` unknown/overflow; status-filter throttle/truncation; tabbrowser only uses the ratio to set tab `progress` for the native throbber, not a window percent bar | Rejected. Would recreate stall/jump. |
| Fake ease-toward-80% then timeout complete (NProgress-style) | No Firefox owner; the old 3 s/8 s timers were the hide-too-early bug | Rejected. Any invented percent still looks stuck on long loads. |
| Drive load from selected-tab `busy` only | [`tabbrowser.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/tabbrowser/content/tabbrowser.js) sets `busy` on top-level `STATE_START`/`STATE_IS_NETWORK` when `_shouldShowProgress` allows it, and synthesizes start/stop for tabs-progress listeners on TabSelect | Equivalent in the common case. Fennevia already mirrors that network as `Browser:Stop` enabled. Using Stop keeps the light aligned with Reload/Stop. |
| Extra `onProgressChange` on the existing navigation listener | New internals dependency for a ratio Firefox chrome does not trust for UI width | Out of scope. |
| Poll Downloads or observe `dl-start`/`dl-done` | Current owner is `DownloadList.addView()`; ADR-030 already rejected polling | Rejected. |
| Expand-on-hover download chrome | Conflicts with the #31 bottom trigger and collision policy | Rejected. The bottom panel remains the readable surface. |
| Completion flash / delayed hide | Old 1.5–3 s timers left the bar visible after idle | Rejected. CSS opacity fade on `activeCount === 0` is enough. |

## Independently selected Fennevia design

1. Mount the lights in the existing top and bottom Svelte roots inside
   `#fennevia-shell-frame-host`, as siblings of the #31 trigger, not inside the
   glass panel.
2. Keep them in the ADR-037 7px gutter (`--fennevia-edge-inset`) at 2px
   (`progressLightThicknessCssPixels`). They overlay; they do not add padding.
3. `pointer-events: none` and `z-index: 0` so the 12px trigger remains the hit
   target.
4. Drive the top light from `navigation.snapshot.loading` (`Browser:Stop`
   enabled). That is the same selected/top-level network truth Firefox uses for
   the Stop command. Same-document/SPA location changes that do not enable Stop
   do not flash the light.
5. Unknown-size activity (load, or downloads with no aggregate percent) is a
   full-width pulse. It does not claim a percent.
6. Drive the bottom determinate width from the existing anonymous Downloads
   snapshot `aggregatePercent` when `activeCount > 0`. Hide when idle. No
   filename, no hover expand, no polling.
7. Reuse `--fennevia-focus-color` as `--fennevia-progress-light`. Reduced
   motion disables the pulse; forced colors use `Highlight` without glow.
8. `aria-hidden="true"`. Reload/Stop, tab busy, and the bottom Downloads panel
   remain the accessible paths.
9. Health requires the idle nodes; it does not require them to be visible.
10. No new Firefox symbol, Downloads field, or navigation listener method.

## Firefox source owners reused, not extended

| Existing Fennevia contract | Owner already documented |
| --- | --- |
| Selected loading boolean | ADR-027 / `src/firefox/navigation.ts` Stop command + selected/top-level tabs progress |
| Anonymous download aggregate | ADR-030 / `src/firefox/downloads.ts` `Downloads.PUBLIC` / `PRIVATE` list view |
| Frame, trigger, gutter | ADR-026 / ADR-037 / `#fennevia-shell-frame-host` |

Additional pins used only to reject a load percent:

| Source | Finding |
| --- | --- |
| [`nsIWebProgressListener.idl`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/uriloader/base/nsIWebProgressListener.idl) | Unknown or overflowing progress values become `-1`. |
| [`nsBrowserStatusFilter.cpp`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/toolkit/components/statusfilter/nsBrowserStatusFilter.cpp) | Progress is delayed 160 ms, ignored when `cur > max` or `cur <= 0`, forwarded only for +3% jumps, and truncated to 32-bit. |
| `tabbrowser.js` `TabProgressListener` | Native chrome uses progress only to toggle tab `progress` while `busy`; it does not render a window loading bar. |

## Validation

- `tests/progress-light.test.mjs` mapping for idle, loading, determinate, and
  indeterminate download states.
- Health selectors and `frontend.progress-lights` capability in
  `src/shell/index.ts`.
- Frontend-build assertions for the 2px token, pulse keyframes, full-width
  indeterminate beam, `pointer-events: none`, and absence of the old-project
  IDs, neon hex, hue-rotate, and z-index 20000.
- Real Firefox Marionette rows for load-light-during-Stop and
  download-light-while-panel-hidden are wired in
  `tests/firefox-window-lifecycle.mjs` and remain `not run` until the release
  matrix is executed.

## Remaining risks

- Client-side SPA navigations that never enable `Browser:Stop` will not show
  the load light. That matches Firefox's own Stop/throbber policy and avoids
  the old hash-change flash.
- Live painting against collapsed native chrome, Browser fullscreen, and
  high-DPI is unproven on this change.
