# Firefox 153/154 narrow Top scrollbar and window-drag regions

Date: 2026-08-27

## Environment

- Firefox version: source checked at 153.0.4, 154.0, and 154.0.1 release tags;
  the owner report came from an existing Fennevia browser session whose exact
  executable was not captured in this task.
- Build ID: supported-build references are `20260810162159`,
  `20260812182057`, and `20260824154132`; the reporting session was not queried.
- Channel: release support boundary; reporting session not independently
  verified.
- Operating system: Windows x64.
- Profile: existing owner profile in the supplied runtime evidence; clean
  development-profile reproduction not run.
- Project commit: `ac92f468268536b600b9cc51caba0af6dddeb9ce` plus the uncommitted
  `codex/improve-urlbar-layout-ux` worktree.
- Startup mode: normal in the owner report; not independently reproduced.

## Symptom

When a narrow Top layout overflows and shows its horizontal scrollbar, dragging
the scrollbar moves the Firefox OS window instead of moving the scrollbar
thumb. The owner explicitly required preserving window dragging elsewhere in
the Top panel.

## Minimal reproduction

1. Reveal Top in a sufficiently narrow Firefox window so the composable Row
   overflows and its native thin horizontal scrollbar appears.
2. Press and drag the scrollbar thumb or track.
3. Reported result: Windows treats the pointer as a caption drag and moves the
   Firefox window.
4. Expected result: the scrollbar owns that pointer gesture; adjacent empty
   Top chrome continues to drag the window.

Clean-profile reproduction and Browser Toolbox pointer inspection are not run.

## First causal evidence

- Browser Console: not run; the report is a native hit-test conflict rather
  than an observed exception.
- Browser Toolbox: not run. Static ownership shows the overflowing
  `.fennevia-composable-layout` and its panel are explicit
  `-moz-window-dragging: drag` regions, while the existing no-drag selector
  covers authored interactive descendants but not Firefox's native-anonymous
  scrollbar.
- Firefox 153.0.4/154.0/154.0.1 `nsDisplayList.cpp` separately unions visible
  drag and no-drag border boxes, then subtracts the complete no-drag union from
  the drag union. This proves that setting the complete scroll root to no-drag
  would also erase nested empty-space drag regions.

## Sources checked

- Alice0775/userChrome.js: default `master` tip
  `a39f5cb60d40d01a1ae6d65935db152e7ac23111` (2026-08-23); no current
  `-moz-window-dragging` code-search result, so no applicable scrollbar fix.
- MrOtherGuy/fx-autoconfig: default `master` tip
  `dfdab5684faffc112b76ccb1d8cab7f75da0102c` (2026-07-23); no current
  `-moz-window-dragging` code-search result.
- xiaoxiaoflood/firefox-scripts: default `master` tip
  `a898ac59fb0ca3886c0c46b184fdbc037c83c037` (2025-02-10); no current
  `-moz-window-dragging` code-search result.
- aminomancer/uc.css.js: default `master` tip
  `88514013ddc375f4770f4a35d8d07a91d6dd7d8f` (2026-01-06); no current
  `-moz-window-dragging` code-search result.
- Searchfox path: current `layout/painting/nsDisplayList.cpp`,
  `nsDisplayListBuilder::AdjustWindowDraggingRegion()` and
  `GetWindowDraggingRegion()`; current `widget/windows/nsWindow.cpp` confirms
  the resulting region controls Windows `HTCAPTION` versus `HTCLIENT`.
- Official Firefox release revisions:
  - 153.0.4 `c178247e1dfea52241a6b18b18cf3a00f8da935c`;
  - 154.0 `032a9fc1ac0cc3209f7c142744ba2e40847c8086`;
  - 154.0.1 `9cd094dbc3eac5df87a24e7a871e52880cb8cd42`.
  All three contain the same drag/no-drag union and final subtraction contract.
- Bugzilla: no upstream regression was identified; this is a Fennevia region-
  composition error exposed by narrow overflow.

## Upstream change

No version transition was identified. The relevant Gecko region algorithm is
the same across all three supported release tags. This task corrects project
geometry rather than adapting to a renamed or changed Firefox API.

## Loader-specific baggage identified

None. The compatibility canaries do not own Fennevia's composable Top panel or
its native-anonymous scrollbar hit band.

## Options considered

1. Mark the complete composable scroll root no-drag. Rejected because Gecko
   subtracts the union of all no-drag boxes after collecting drag boxes; nested
   spaces cannot add their drag geometry back.
2. Remove Top overflow or hide the scrollbar. Rejected because configured
   controls would become clipped or lose a visible pointer scrolling path.
3. Add runtime overflow measurement, a ResizeObserver, and a state attribute.
   Rejected because the narrow tier is already bounded and a deterministic
   guard avoids another observer and cleanup path.
4. Add a pointer-transparent no-drag strip only over the narrow Top block-end
   scrollbar band. Selected as the smallest adaptation.

## Decision and minimum adaptation

In the existing `max-width: 560px` tier, generate one absolutely positioned
Top-panel pseudo-element spanning the inline axis and the final
`--fennevia-space-3` (12 CSS px) of the block axis. Give it no visible paint,
`pointer-events: none`, and `-moz-window-dragging: no-drag`.

The underlying native scrollbar remains the pointer target. The rest of the
panel and all existing explicit empty-space drag declarations remain unchanged.
The guard is present throughout the narrow tier even when overflow is absent;
that bounded 12 px reduction is accepted in exchange for no observer, dataset,
or event-forwarding owner.

## Security and privacy effects

None. The change reads no URL, title, input, profile state, scrollbar geometry,
or browsing data; it adds no logging, persistence, dependency, listener,
observer, timer, privileged bridge field, or native DOM access.

## Validation performed

- Source comparison against all three official Firefox release tags: passed.
- Current compatibility-canary code search: completed; no applicable pattern.
- Focused `tests/frontend-build.test.mjs`: 10/10 passed. It verifies the bounded
  guard, pointer transparency, no-drag declaration, launcher spacing, and the
  existing ordinary drag declaration in the broader frontend contract.
- Complete `npm run verify`: passed with 433/433 Node tests, 88.66% line
  coverage, 81.29% branch coverage, 95.71% function coverage, every fixed
  PowerShell 7 suite, dependency audit, deterministic frontend/bridge output,
  and 14/14 accepted production artifacts.
- Windows PowerShell 5.1 fixed-list suite: passed.
- Real Firefox scrollbar and adjacent empty-space window dragging: not run.

## Remaining compatibility risk

The 12 CSS px guard is inferred from the project `scrollbar-width: thin` and
Firefox's documented border-box region calculation. Real Firefox still needs
to prove thumb and track input at ordinary/high DPI and forced-colors settings,
and that adjacent empty chrome retains comfortable drag coverage. If the owner
reports the conflict remains, the next step is a removable, privacy-safe hit-
test probe rather than another CSS guess.

## Follow-up

Run the real Firefox narrow Top scrollbar/adjacent-drag matrix in normal,
second-normal, and private windows, then record Browser Console/Toolbox evidence
without logging page or input data.
