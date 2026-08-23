<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 154 tabbar interaction follow-up

## Environment and report

- Date: 2026-08-23.
- Project base: `384d763` on Windows x64.
- Supported source target reviewed: Firefox 154.0 commit
  [`032a9fc1ac0cc3209f7c142744ba2e40847c8086`](https://github.com/mozilla-firefox/firefox/commit/032a9fc1ac0cc3209f7c142744ba2e40847c8086).
- Owner-reported behavior: the container color bar was absent; closing a custom
  tab could leave its side surface unable to auto-hide; selecting a custom tab
  could hide the surface before the pointer exited; dragging neutral side or
  top chrome hid the surface being dragged.
- Exact reporting Firefox version, Build ID, channel, profile state, Browser
  Console first error, and stack were not captured with the report. A clean
  profile reproduction and Browser Toolbox visual pass are **not run**, so this
  correction makes no new support or real-Firefox validation claim.

## First causal evidence

The current project source exposed four direct state/presentation conflicts; no
exception cascade was required to explain the report:

1. `TabStrip.svelte` always ran keyboard-style close-focus recovery, including
   for a pointer close. Focusing the next row published a focus hold in addition
   to the pointer hold, so a later pointer exit could not hide the surface.
2. Pointer selection selected the native tab and focused the owned tab button,
   but performed no post-render hit test. Native/Svelte selection reconciliation
   could invalidate pointer event ownership while the clicked focus target also
   became a persistent second hold.
3. `setWindowDragActive(true)` explicitly released all four pointer holds.
   Cross-edge suppression therefore also hid the source surface that the owner
   was dragging.
4. The tab snapshot and XHTML row already carried the closed container color,
   but its only visual was an inset row `box-shadow`. The same row uses
   `box-shadow` for drag presentation, so identity had no independent layer.

## Current Firefox and compatibility evidence

Firefox 154
[`ContextualIdentityService.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/toolkit/components/contextualidentity/ContextualIdentityService.sys.mjs)
still owns the public identity lookup and closed color names. Its
[`tabs.css`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/themes/shared/tabbrowser/tabs.css)
renders native identity state on an independent positioned layer. Fennevia uses
that only as behavior evidence and independently retains its project-owned row,
logical-inline geometry, selectors, and existing color values.

Firefox 154
[`widget/windows/nsWindow.cpp`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/widget/windows/nsWindow.cpp)
remains the owner of the chrome-only `draggableregionleftmousedown` event,
Windows native move loop, and synthesized mouse-up already pinned by ADR-037.
The correction changes only how Fennevia balances its existing shared hold
around that lifetime.

The current compatibility-canary heads and their latest relevant commits,
trees, plus repository issue/pull-request searches were checked:

- `alice0775/userChrome.js` at
  [`a39f5cb60d40d01a1ae6d65935db152e7ac23111`](https://github.com/alice0775/userChrome.js/commit/a39f5cb60d40d01a1ae6d65935db152e7ac23111);
- `MrOtherGuy/fx-autoconfig` at
  [`dfdab5684faffc112b76ccb1d8cab7f75da0102c`](https://github.com/MrOtherGuy/fx-autoconfig/commit/dfdab5684faffc112b76ccb1d8cab7f75da0102c);
- `xiaoxiaoflood/firefox-scripts` at
  [`a898ac59fb0ca3886c0c46b184fdbc037c83c037`](https://github.com/xiaoxiaoflood/firefox-scripts/commit/a898ac59fb0ca3886c0c46b184fdbc037c83c037);
- `aminomancer/uc.css.js` at
  [`88514013ddc375f4770f4a35d8d07a91d6dd7d8f`](https://github.com/aminomancer/uc.css.js/commit/88514013ddc375f4770f4a35d8d07a91d6dd7d8f).

Alice0775's newest changes address privileged subscript scheme opt-in and the
native tab index property. The other heads have no newer correction for these
Fennevia-owned hold lifecycles. Focused issue/pull-request searches found no
matching container-bar, native-window-drag, or post-close hover adaptation.
No canary code, selector, timer, event strategy, or numeric value was copied.

## Minimum correction

- Extend the existing shared shell controller with one transient source edge.
  Native drag start retains that edge's pointer hold, clears only other pointer
  holds, and blocks cross-edge pointer reveal. Source pointer-out noise is
  ignored during the move loop; ending the lock leaves the source held until a
  real pointer exit invokes the existing delayed-hide owner.
- Resolve the source from the owned panel carrying the Firefox drag event, with
  the component edge and currently held edge as bounded fallbacks. Disable,
  suppression, blur cleanup, and disposal remain deterministic.
- For pointer select and close, retain only the transient viewport point and
  clicked owned control. After the native action and one Svelte tick, hit-test
  the configured panel and reacquire its shared pointer hold if still inside.
  Blur only the pointer-activated control, then clear a stale focus/keyboard
  hold only when no surviving surface control remains focused. Keyboard and
  touch paths retain existing focus recovery.
- Replace the container row shadow with one pointer-transparent pseudo-element
  at logical inline start. The closed color selectors set a project variable;
  forced-colors mode uses `Highlight`.

No new trigger, timer, observer, Firefox symbol, native DOM mutation, bridge
field, preference, process-global state, or dependency is introduced.

## Security, privacy, and provenance

Pointer coordinates and the clicked XHTML control remain transient local
variables and are neither serialized nor logged. Container handling remains the
existing bounded public label plus closed color enum; private windows continue
to omit it. No URL, title, query, native tab, identity object, profile data, or
browsing value enters a new path. The change uses only original project code
and reference-only Firefox/canary research, so no third-party notice changes are
required.

## Validation

- `npm run typecheck`: passed with zero diagnostics.
- `node --test tests/edge-surfaces.test.mjs tests/tab-strip.test.mjs
  tests/frontend-build.test.mjs`: passed 29/29.
- Complete ordinary `npm run verify`: passed with 351/351 Node tests, 87.51%
  line coverage, 79.68% branch coverage, 95.31% function coverage, every fixed
  PowerShell 7 suite, dependency audit, deterministic generated frontend and
  bridge output, and 14/14 accepted production artifacts.
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File
  .\tests\run-static-powershell-tests.ps1`: every fixed Windows PowerShell 5.1
  suite passed.
- Real Firefox container-theme, pointer close/select, top/side drag,
  restored/maximized/snapped, second/private-window, Browser Console, and
  Browser Toolbox rows: **not run**.
