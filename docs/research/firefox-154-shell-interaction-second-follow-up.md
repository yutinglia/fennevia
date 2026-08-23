<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 154 shell interaction second follow-up

## Environment and report

- Date: 2026-08-23.
- Project base: `dfcac34` on Windows x64, immediately after merged PR #100.
- Supported source target reviewed: Firefox 154.0 commit
  [`032a9fc1ac0cc3209f7c142744ba2e40847c8086`](https://github.com/mozilla-firefox/firefox/commit/032a9fc1ac0cc3209f7c142744ba2e40847c8086).
- Owner-reported behavior: container color remained absent; selecting a custom
  tab still failed to keep its configured side surface open; clicking neutral
  draggable chrome without moving left a permanent panel hold; and a loaded
  bookmark favicon still painted over the packaged star fallback. The owner
  requested the same favicon check for the tab strip while retaining the prior
  requirement that a real native window drag must not hide its source panel.
- The attached screenshot visually showed a Gmail favicon and pale bookmark
  fallback occupying the same icon slot. It contained no normative instruction
  and is not copied into the repository.
- No Firefox process was running during source diagnosis. The exact reporting
  Firefox version, Build ID, channel, profile state, first Browser Console
  error/stack, clean-profile reproduction, and Browser Toolbox inspection were
  not available. Real Firefox rows therefore remain **not run**.

## First causal evidence

The merged source exposed five local causes that together explain the report:

1. Pointer select/close acquired the edge hold only after the native action and
   one Svelte tick. Selection reconciliation could hide the panel before that
   post-render hit test had a panel to reacquire.
2. The input-modality check treated every primary click with `detail === 0` as
   keyboard-origin. Firefox chrome can supply a physical click with useful
   viewport coordinates but zero detail, bypassing pointer retention.
3. Neutral panel mouse-down immediately entered the shared drag lock. Release
   ended that lock but intentionally retained the source hold for an actual
   drag; there was no movement classification or click-only release path.
4. The container bridge returned no state whenever its optional identity
   service was unavailable, despite the native tab retaining a positive
   `userContextId` and closed identity color class. Presentation also still
   depended on a pseudo-element rather than inspectable owned markup.
5. Tab and bookmark fallback glyphs and favicon images were separately
   absolutely positioned. Assigning a valid image source made the image
   visible without hiding the fallback, so both painted. The same structure
   existed in both components even though the supplied screenshot showed the
   bookmark case.

No exception cascade, URL/cache fetch, native DOM replacement, or unrelated
surface controller was needed to explain these failures.

## Current Firefox and compatibility evidence

Firefox 154
[`tab.js`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/tabbrowser/content/tab.js)
derives the native tab's `userContextId` from `usercontextid`. Firefox 154
[`ContextualIdentityService.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/toolkit/components/contextualidentity/ContextualIdentityService.sys.mjs)
exports the identity service, closed public colors and labels, and applies one
closed `identity-color-${color}` class to the native tab. These are current
bounded fallback facts, not permission to expose a native tab or identity
object to Svelte.

The four required compatibility-canary heads were queried again and were
unchanged from the immediately preceding same-day research record, whose
latest relevant commits, trees, issues, and pull requests were already checked:

- `alice0775/userChrome.js` at
  [`a39f5cb60d40d01a1ae6d65935db152e7ac23111`](https://github.com/alice0775/userChrome.js/commit/a39f5cb60d40d01a1ae6d65935db152e7ac23111);
- `MrOtherGuy/fx-autoconfig` at
  [`dfdab5684faffc112b76ccb1d8cab7f75da0102c`](https://github.com/MrOtherGuy/fx-autoconfig/commit/dfdab5684faffc112b76ccb1d8cab7f75da0102c);
- `xiaoxiaoflood/firefox-scripts` at
  [`a898ac59fb0ca3886c0c46b184fdbc037c83c037`](https://github.com/xiaoxiaoflood/firefox-scripts/commit/a898ac59fb0ca3886c0c46b184fdbc037c83c037);
- `aminomancer/uc.css.js` at
  [`88514013ddc375f4770f4a35d8d07a91d6dd7d8f`](https://github.com/aminomancer/uc.css.js/commit/88514013ddc375f4770f4a35d8d07a91d6dd7d8f).

No canary provides a more specific Fennevia-owned click/drag, Svelte mutation,
or fallback-layer correction. No external code, selector, timer, event
strategy, numeric value, or visual composition was copied.

## Minimum correction

- Hold the configured tabs edge synchronously before pointer-origin native
  select/close. After one Svelte tick, explicitly keep the hold if the hit point
  is inside the current panel or release it through the existing inside-window
  path otherwise. A zero-detail/zero-coordinate click remains keyboard-origin;
  a zero-detail click with real coordinates remains pointer-origin.
- Represent a neutral press as one transient candidate. Compare both the final
  window position and pointer displacement; actual window movement or at least
  4 CSS px confirms a drag. A confirmed drag keeps the source held through the
  move loop, while a stationary/sub-threshold release clears the source through
  the existing delayed-hide owner. Pointer cancellation remains conservative.
- Read a positive `tab.userContextId` before the existing attribute fallback.
  Keep `ContextualIdentityService` primary, but if it is missing or rejects the
  identity, resolve only a known closed `identity-color-*` native class and use
  a generic bounded label. Render the result in one explicit project-owned
  aria-hidden stripe.
- In both tab and bookmark components, hide the image while assigning a source,
  unhide only on successful load, and clear/hide it on error or disposal. Put
  the packaged fallback immediately after the image and hide that fallback only
  while the loaded image is visible.

Rejected alternatives were a second hide timer, unconditional source release
after every native drag, using focus to pin the tab panel, raising image z-index
while continuing to paint two icons, exposing arbitrary native classes, or
adding a favicon/container network lookup. Each would violate an existing
interaction, ownership, privacy, or fail-open contract.

## Security, privacy, and provenance

Pointer/window coordinates exist only in short-lived frontend candidate
records and are not serialized, logged, persisted, or passed through the
Firefox bridge. The container fallback inspects only a positive context ID and
closed color class at the privileged boundary; neither the ID, native class
object, tab, nor identity object crosses that boundary. Favicon source policy
is unchanged: tabs retain their bounded internal/raster allowlist, bookmarks
retain bounded cached raster data URIs, and neither path performs a project
network request. No dependency, resource mapping, native mutation, preference,
process-global browsing state, or third-party material is added.

`docs/security-and-privacy.md` therefore needs no normative change, and
`THIRD_PARTY_NOTICES.md` remains unchanged.

## Validation

- `npm run typecheck`: passed with zero errors and zero warnings.
- `node --test tests/edge-app-interactions.test.mjs
  tests/edge-surfaces.test.mjs tests/firefox-tabs.test.mjs
  tests/tab-strip.test.mjs tests/bookmarks-ui.test.mjs
  tests/frontend-build.test.mjs`: passed 56/56.
- Complete ordinary `npm run verify`: passed with 356/356 Node tests, 87.51%
  line coverage, 79.75% branch coverage, 95.32% function coverage, every fixed
  PowerShell 7 suite, dependency audit, deterministic generated frontend and
  bridge output, and 14/14 accepted production artifacts.
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File
  .\tests\run-static-powershell-tests.ps1`: every fixed Windows PowerShell 5.1
  suite passed.
- Real Firefox container color, tab selection/close, tab/bookmark favicon,
  click-only neutral chrome, actual window drag, restored/maximized/snapped,
  theme/forced-colors, second/private-window, Browser Console, and Browser
  Toolbox rows: **not run**.
