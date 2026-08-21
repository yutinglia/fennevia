<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 153/154 side-panel window-drag release correction

## Environment and symptom

- Date: 2026-08-21
- User-reported behavior: releasing a native Firefox window drag started from
  empty chrome in the left or right Fennevia panel revealed the top panel.
- Project base: `d374495` (merged ADR-054 configurable edge interactions).
- Supported source targets checked: Firefox 153.0.4 commit
  `c178247e1dfea52241a6b18b18cf3a00f8da935c` and Firefox 154.0 commit
  `032a9fc1ac0cc3209f7c142744ba2e40847c8086`.
- Operating-system scope: Windows x64.
- Exact reporting Firefox version, Build ID, profile state, Browser Console,
  and first runtime stack: not captured with the user report. No new support
  claim is made from this focused correction.

## First causal evidence

The four edge surfaces are independent Svelte roots. `App.svelte` kept
`panelDragCandidate` only inside the root where a DOM pointer-down occurred and
released only that edge's pointer hold. A different root, especially the top
trigger, remained free to process pointer movement generated around native
window-drag completion.

That local state also did not match the Windows owner. In both pinned Firefox
sources, `widget/windows/nsWindow.cpp` converts a CSS window-drag region to
`HTCAPTION`. On `WM_NCLBUTTONDOWN`, Firefox dispatches the chrome-only
`draggableregionleftmousedown` event instead of an ordinary DOM mousedown, then
Windows runs a hidden move loop in which Gecko does not receive normal mouse
events. When `WM_EXITSIZEMOVE` ends that loop, Firefox synthesizes the primary
mouse-up. The project therefore cannot reliably coordinate four roots from a
single panel's pointer-down/up handlers.

Exact source pins:

- [Firefox 153.0.4 `widget/windows/nsWindow.cpp`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/widget/windows/nsWindow.cpp)
- [Firefox 154.0 `widget/windows/nsWindow.cpp`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/widget/windows/nsWindow.cpp)

No compatibility canary adaptation was relevant: the failure is in Fennevia's
edge coordination around a current Firefox Windows widget event, not in
AutoConfig or loader behavior.

## Minimum correction

- Add a private per-shell `windowDragActive` latch to the existing shared edge
  controller. Starting a native drag releases all four pointer holds and blocks
  only future pointer reveals until release.
- Listen at the browser window for Firefox's exact
  `draggableregionleftmousedown` event and the synthesized `mouseup` that ends
  the move loop. Keep DOM pointer-up/cancel and window blur listeners as bounded
  cleanup fallbacks, and remove all listeners during normal disposal.
- Keep the component pointer handlers as a fallback for a drag path that does
  provide DOM pointer events. Reject trigger/panel hover reveal while any
  pointer button remains pressed.
- Preserve keyboard, focus, popup, programmatic, suspension, fail-open, and
  native-UI ownership behavior. No new timer, observer, window-global property,
  preference, log field, browsing data, or dependency is added.

## Validation

Focused controller and frontend-source tests cover cross-root suppression,
pointer-hold release, unaffected keyboard/focus/popup holds, exact Firefox
start/mouse-up listener registration, pointer fallbacks, and invalid runtime
input. `npm run verify` passed with 271 Node tests, 87.75% line coverage,
95.26% function coverage, all fixed-list PowerShell 7 tests, the dependency
audit, deterministic builds, and all 14 production-artifact checks. The same
fixed-list static suite also passed under Windows PowerShell 5.1 by running
`tests/run-static-powershell-tests.ps1` with `powershell.exe`.

The real Firefox left/right/top/bottom drag-release matrix, Browser Console
inspection, restored/maximized/snapped windows, and second/private windows are
`not run` in this ordinary development pass and remain release-matrix work.
