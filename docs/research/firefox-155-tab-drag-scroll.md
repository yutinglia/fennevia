<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 155 tab-drag scrolling

## Request and environment

Direct owner request, 2026-09-06, based on `ec13e2d` on
`codex/firefox-155-compatibility`. Firefox 155.0.1 stable, Windows x64,
BuildID `20260903215306`; marker-owned disposable program/profile pair with
the normal production package. The owner reported slow edge scrolling on long
tab lists and explicitly wanted fine placement retained for short overflow.
This is a UX enhancement, not evidence of another Firefox 155 exception or
regression. No first causal runtime exception was supplied for this behavior.
The earlier compatibility/Browser Console/Toolbox audit is recorded in
`firefox-155-compatibility.md`; it is not repeated as a new compatibility claim.

## Evidence and independent design

- Project `TabStrip.svelte` read partition scroll offsets for drop geometry but
  had no scroll writer or animation loop. `ComposableLayout.svelte` has a
  separate widget-editor scroller and rejects child tab drags; it is not used.
- [Searchfox ScrollContainerFrame](https://searchfox.org/firefox-main/source/layout/generic/ScrollContainerFrame.cpp)
  and the exact [155 release source](https://github.com/mozilla-firefox/firefox/blob/fb95137a04eb8fe1196cb12f26b100c1e060295c/layout/generic/ScrollContainerFrame.cpp)
  show `DragScroll` using a 20-device-pixel border/step, requiring an existing
  scrollbar, and returning whether an ancestor should be considered. The
  pinned [EventStateManager source](https://github.com/mozilla-firefox/firefox/blob/fb95137a04eb8fe1196cb12f26b100c1e060295c/dom/events/EventStateManager.cpp)
  calls it from `eDragOver` independently of `preventDefault`.
- [Atlassian's auto-scroll design](https://github.com/atlassian/pragmatic-drag-and-drop/blob/dc4ea4c3e678e7dc9e0d28bf8073eb75e3cb3545/packages/auto-scroll/constellation/index/about.mdx)
  documents distance and time dampening. That interaction principle is a
  reference only. Fennevia independently selects its overflow-based cap,
  precision region, constants, loop, ownership, and cleanup below.
- The same-day four-canary review in `firefox-155-compatibility.md` remains the
  current loader evidence. Loader discovery, native tab replacements, global
  preferences, overrides, and window-global drag flags are unnecessary here.
  No canary implementation or `my-firefox-custom` code was used.

All upstream material is reference-only: no external code, assets, package,
or executable dependency was copied/adapted or added to the distribution.

## Selected behavior

`src/app/tab-drag-scroll.ts` contains a pure axis-independent policy:

- edge band: 24–48 CSS px according to measured item size, capped at one
  quarter of the visible span so the bands cannot overlap;
- inner 45% of each band: continuous zero-to-two-item-lengths/second precision
  speed independent of total tab count;
- outer 55%: quadratic distance contribution; after 180 ms of outer-region
  dwell, a 600 ms smooth acceleration reaches the bounded target speed;
- fast speed cap: at least the precision speed, otherwise limited by 1.5
  visible spans/second, 0.8 times total overflow/second, and three times the
  remaining distance/second near the destination end;
- invalid/non-finite geometry, no overflow, out-of-bounds pointer, center, and
  an already reached end produce zero movement.

`src/shell/features/tabs/tab-drag-autoscroll.ts` owns one frame callback for
the validated active transfer and its eligible partition. Delta time, capped
at 50 ms, makes ordinary refresh rates consistent and prevents a stalled frame
from jumping. Fractional distance is accumulated. Acceleration resets on exit,
precision-region return, reversal, and partition/transfer/axis changes. There
is no momentum after exit.

ADR-086 initially marked project-created partitions/list/ancestors up to the
existing surface root and used hidden overflow to suppress native scrolling.
The owner then requested visible scrollbars to communicate current position.
ADR-087 supersedes that mechanism: the existing drag state renders a transparent
receiver as a sibling of the list, outside the partitions' frame ancestry.
The controller now marks only the receiver's project-owned ancestors up to the
surface root. Package CSS hides their overflow and disables smooth scrolling
and snap; the list/partition scrollbars retain their normal styles and Firefox
paints their real positions. Prior ancestor marker values are restored on stop,
and drag completion/cancellation removes the receiver. Ordinary scrollbar input
resumes then; there is no second wheel-scrolling owner or Firefox DOM mutation.
All motion refreshes the existing source-row and insertion-marker geometry;
captured scroll events refresh it as well. Existing native reorder/adoption,
keyboard alternatives, surface holds, and fail-open disposal remain the owners.

No preferences, persistence, data-transfer fields, browsing-data logging,
network requests, privileged bridge dependencies, native DOM modifications,
or release-version/support changes are introduced.

## Initial implementation validation (ADR-086)

Commands use the existing marker-owned isolated 155 development pair; the
interactive owner profile and daily Firefox are not used for the harness.

```powershell
node --test tests/tab-drag-scroll.test.mjs tests/tab-strip.test.mjs
npm run verify
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/run-static-powershell-tests.ps1
node tests/firefox-window-lifecycle.mjs --firefox $firefox155 --profile $profile155 --tab-drag-scroll-probe
```

- Focused policy/controller/strip tests: pass, 24/24. Cover invalid bounds,
  precision consistency, dwell/distance/end limits, low-frame-rate gaps,
  60/120 Hz parity, fractional movement, horizontal axis, partition change,
  stationary preview callbacks, and exact owner restoration on stop/error.
- Typecheck and focused lint: pass.
- Initial Firefox 155 DOM-event probe: pass for production-bundle scrolling,
  stationary preview changes, inward stop, reverse, isolation with both
  partitions overflowing, drop after scrolling, exit/cancel cleanup, restored
  overflow, stable gutter, and fine movement with roughly one extra row.
- `npm run verify`: pass, 452/452 tests, 88.80% lines, 81.56% branches, 95.79%
  functions; format, lint, typecheck, PowerShell 7 fixed list, dependency audit,
  deterministic frontend/bridge builds, and 14/14 artifact checks. The small
  final external-target-exit refinement received focused lint and the final
  typecheck/build/probe; it adds no policy branch to the unit-covered module.
- Windows PowerShell 5.1 fixed list: pass.
- Physical OS drag, cross-window adoption/detach, private windows, horizontal
  real-Firefox layouts, high DPI, forced colors, reduced motion, screen reader,
  and complete release matrix: not run for this enhancement.
- GitHub-hosted CI: not run (uncommitted/unpushed work). `act`: not run; no CI
  orchestration change, Windows workflow commands are executed directly.

The attempted `dispatchDOMEventViaPresShellForTesting` native baseline did not
deliver the intended pointer coordinates on this host and was removed from the
final fixture. Native-scroll suppression therefore has pinned source plus
computed-style evidence, not a claimed physical/native-session pass. The
ordinary DOM fixture exercises the shipped code with fixed local blank tabs.
Its window was observed at about 7–8 animation frames/second during a timing
diagnostic; the probe waits for observable scroll progress with a deadline,
while deterministic unit tests verify the speed curve. That temporary frame
sampler was removed. No diagnostic instrumentation remains in production.

Initial generated frontend SHA-256:
`071954bdae4f526fb27e2691b1074759fcd1808af6ce1c97ebf49866cacf4c25`;
stylesheet SHA-256:
`fa15877e223c24819e483b543fa2d084e3eae8a2ce1b75c8583be9fe8bc7328b`.
The Firefox bridge was unchanged. Automated fixture tabs were removed before
opening that isolated pair for the owner's interactive test.

## Visible-scrollbar follow-up validation (ADR-087)

The 2026-09-06 owner follow-up requires position feedback during scrolling.
The corrected production package was installed into a fresh marker-owned
Firefox 155.0.1 program/profile pair, leaving the earlier interactive pair
untouched. The existing fixture now dispatches drag-over/drop events to
`document.elementFromPoint` and verifies that the actual target is the receiver
outside both scrolling ancestors. Both overflowing partitions retain
`overflow-y: auto`, no partition carries the suppression marker, and the
receiver disappears on cancel/drop. No new dependency or native API is used.

- Focused policy/controller/strip tests: pass, 24/24, including ancestor-only
  suppression and exact restoration without changing partition markers.
- `npm run typecheck`, focused ESLint, `npm run build`, and `npm run artifacts`:
  pass; Svelte check reports zero errors/warnings and all 14 production
  artifacts match the inventory/security rules. Build output is deterministic.
- Updated production-bundle Firefox 155 DOM-event fixture: pass for visible
  native scrollbar styles, receiver hit-test ancestry, stable gutter,
  stationary preview, long-list acceleration, inward stop, reverse,
  pinned/regular isolation, drop after scrolling, terminal cleanup, and short
  overflow precision. The fixture reports all 11 evidence flags as true and
  the harness finds no first-party or structured runtime errors.
- Full `npm run verify` and Windows PowerShell 5.1 matrices were not rerun for
  this follow-up; their passing results above belong to the initial iteration.
  No workflow, installer, privileged bridge, or dependency change was made.
- Physical OS drag and visual thumb tracking, cross-window/private-window and
  remaining release rows listed above: not run. The DOM fixture and pinned
  ancestor-walk source do not constitute a physical native-drag session.

Corrected generated frontend SHA-256:
`c72b0f533f01d1030ed782f60f4d516ed3eb5deebb1b8d1af19fb8b3d5fde096`;
stylesheet SHA-256:
`e48d7b4c2b2e0b03a1553028d64476caa6dc581227c570768959d263913f5eae`.
The Firefox bridge remains unchanged. The new isolated pair is available for
the owner's manual test after the automated fixture removes its own tabs.
