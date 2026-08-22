# Firefox 154 tab-drag spatial preview research

## Environment

- Date: 2026-08-22
- Firefox version: 154.0 release
- Build ID: `20260812182057`
- Channel: release
- Operating system: Windows 11, x64
- Profile state: official-source review and focused local automation; clean
  development-profile, Browser Toolbox, and assistive-technology runs for this
  visual follow-up: **not run**
- Project base commit: `00811d7`
- Working branch: `codex/improve-tab-drag-preview`
- Official Firefox commit:
  [`032a9fc1ac0cc3209f7c142744ba2e40847c8086`](https://github.com/mozilla-firefox/firefox/commit/032a9fc1ac0cc3209f7c142744ba2e40847c8086)

## Request and first causal evidence

The owner asked for tab dragging and reordering to have a stronger preview like
stock Firefox, plus related tab-strip UX improvements. There was no privileged
runtime exception. The first mismatch was in the project-owned presentation:
the current strip showed a browser drag image and one before/after line, but
stationary siblings did not communicate the prospective final order. The
marker was valid but supplied weak spatial continuity during a long vertical
move.

Firefox 154's
[`drag-and-drop.js`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/tabbrowser/content/drag-and-drop.js)
provides the relevant native behavior in `_animateTabMove`: the dragged
representation follows the pointer while intervening tabs translate one slot
to expose the destination. The implementation computes pointer-axis movement
from the drag-start screen coordinate, constrains it to the current tab
partition, applies that transform directly to the moving tab, and separately
transforms the background tabs. Its `handle_dragover` takes this animated path
only when the source tab belongs to the same document; a cross-window target
uses the drop indicator and adoption path instead. Firefox's
[`tabs.css`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/themes/shared/tabbrowser/tabs.css)
defines the 200 ms background transform transition only when reduced motion is
not requested and excludes the active moving item from that delayed movement.

Those files are behavioral evidence, not an implementation template. Fennevia
owns a vertical XHTML list and already delegates the final operation through
its typed opaque-ID `move` action. It does not invoke `_animateTabMove`, inspect
native tab geometry, move Firefox DOM, or reuse native selectors, classes,
timing values, flags, or event owners.

## Accessibility references

- W3C's
  [Understanding SC 2.5.7: Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)
  reinforces retaining a non-drag path for a drag operation. Fennevia already
  supports `Ctrl+Shift+ArrowUp/Down`; this change makes that shortcut
  programmatically discoverable rather than claiming new WCAG conformance.
- WAI-ARIA 1.2 defines
  [`aria-keyshortcuts`](https://www.w3.org/TR/wai-aria-1.2/#aria-keyshortcuts)
  as the way to expose implemented keyboard shortcuts to assistive technology.
  A separate polite live output reports the successful final move.

## Compatibility canaries

The same-day compatibility review in
`docs/research/firefox-153-154-panel-context-actions.md` pinned:

- Alice0775/userChrome.js
  [`8481c32e00f1cf14295322a7a1d59075d419405a`](https://github.com/alice0775/userChrome.js/commit/8481c32e00f1cf14295322a7a1d59075d419405a)
- MrOtherGuy/fx-autoconfig
  [`dfdab5684faffc112b76ccb1d8cab7f75da0102c`](https://github.com/MrOtherGuy/fx-autoconfig/commit/dfdab5684faffc112b76ccb1d8cab7f75da0102c)
- xiaoxiaoflood/firefox-scripts
  [`a898ac59fb0ca3886c0c46b184fdbc037c83c037`](https://github.com/xiaoxiaoflood/firefox-scripts/commit/a898ac59fb0ca3886c0c46b184fdbc037c83c037)
- aminomancer/uc.css.js
  [`88514013ddc375f4770f4a35d8d07a91d6dd7d8f`](https://github.com/aminomancer/uc.css.js/commit/88514013ddc375f4770f4a35d8d07a91d6dd7d8f)

That review found no smaller Fennevia adaptation. This presentation-only
follow-up adds no loader behavior or privileged compatibility branch. No
canary code, selector, timer, flag, value, or visual composition was copied.
`yutinglia/my-firefox-custom` was not consulted.

## Options considered

1. Keep the marker-only preview. Rejected because it identifies one boundary
   but does not show how the surrounding order will change.
2. Render a page screenshot or thumbnail in a custom bitmap ghost. Rejected
   because it introduces browsing-content capture and bitmap lifecycle without
   improving the ordering model.
3. Clone or move Firefox's native tab DOM into the project strip. Prohibited by
   the ownership boundary and unnecessary for a project-owned visual effect.
4. Reimplement pointer movement outside HTML5 drag-and-drop. Rejected because
   it would add another drag owner, pointer-capture lifecycle, and input edge
   cases while the current final move path is already correct.
5. Keep the existing HTML5 drag and opaque payload, use the full existing
   project row as the browser ghost, move the actual source row under the
   pointer while it remains inside its strip, and move intervening owned rows
   aside with transforms. Selected as the smallest adaptation.

## Independent Fennevia design

- `setDragImage()` receives the complete current Fennevia tab row, with the
  hotspot aligned to the initiating pointer. It is a browser-rendered snapshot
  of UI already visible in that window, not a page thumbnail or project-created
  bitmap.
- While the source pointer remains over the source list, that same owned row is
  lifted above its siblings and receives an immediate inline `translateY` on
  every accepted `dragover`. The calculation preserves the initial grab offset,
  compensates for current list scrolling, and clamps the row to its pinned or
  unpinned partition. It deliberately has no transform transition, matching
  Firefox's separation between a live moving item and animated background
  items.
- The transferable payload remains the opaque tab ID. No title, URL, favicon
  bytes, thumbnail, native tab, principal, or browser object is added.
- A pure helper maps the current and accepted final indices to closed `up` or
  `down` tokens for only the intervening rows. Each row moves by one Fennevia
  row plus the existing shared gap. The moving source is a solid raised row;
  after it leaves the source list, it returns to a low-opacity dashed origin
  while the browser drag ghost continues outside. The insertion marker remains
  at the newly exposed landing gap.
- Row midpoint geometry is captured before transforms begin. Hit testing
  compensates for list movement and scrolling, so rendered animation cannot
  change its own thresholds and oscillate at a boundary.
- Background rows use the established 180 ms motion token/easing and its 1 ms
  reduced-motion value. Pointer-following remains immediate in both modes
  because delaying direct manipulation would disconnect the row from the
  pointer. Forced colors retains an explicit source treatment. No private timer
  or animation owner is added.
- A different Fennevia window keeps Firefox's same-document animation boundary:
  it does not clone the source row, title, or favicon. ADR-063 nevertheless
  overlays a generic tab-shaped target row at the insertion gap using a fixed
  localized label and packaged icon, while cross-window source identity
  remains in the browser drag image until adoption.
- Tab controls retain the ordinary default cursor, matching Firefox's
  `mozCursor = "default"` tab-drag behavior. Unselected rows gain a subtle hover
  response; fixed pin/close slots remain stable while non-audio actions become
  prominent on selected, hovered, or keyboard-focused rows.
- `Ctrl+Shift+ArrowUp/Down` remains the alternative reorder path and is exposed
  with `aria-keyshortcuts`. Pointer and keyboard success both update one polite
  text-only output with the bounded title and final ordinal.

## Security, privacy, ownership, and provenance

All new state is local to the existing Svelte tab-strip component or a pure
`src/app` index helper. No Firefox bridge, observer, native event, native DOM
mutation, surface, z-index system, reveal controller, hold type, health
capability, persistence path, telemetry, runtime network request, or dependency
was added.

The browser drag ghost can visibly mirror title/favicon pixels already rendered
in the same window, but Fennevia receives or stores no generated bitmap. The
move announcement interpolates an existing bounded title as text only. Neither
the title nor geometry enters drag data, datasets, CSS variables, logs,
diagnostics, persistence, clipboard, telemetry, or network output. Terminal
drag paths and component disposal clear geometry, shifts, marker, and the
existing left pointer hold.

No external code or asset was copied or adapted. Official Firefox source is
referenced as MPL-licensed behavioral evidence only, so no new shipped
third-party material or `THIRD_PARTY_NOTICES.md` entry is required.

## Validation

Completed locally on 2026-08-22:

- `node --test tests/tab-strip.test.mjs`: **passed**, 8/8 tests;
- `npm run typecheck`: **passed**, 0 errors and 0 warnings;
- focused ESLint for the changed TypeScript, Svelte, and test sources:
  **passed**;
- Prettier for the changed TypeScript, Svelte, CSS, and test sources:
  **passed**;
- `npm run verify`: **passed** with 327/327 Node tests, 87.38% line coverage,
  79.12% branch coverage, 95.24% function coverage, every fixed PowerShell 7
  suite, dependency audit, deterministic frontend/bridge builds, and 14/14
  accepted production artifacts;
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File
.\tests\run-static-powershell-tests.ps1`: **passed** every fixed-list suite
  under Windows PowerShell 5.1.

Real Firefox 153.0.4/154.0 upward and downward drag, rapid reversal, overflow
autoscroll, pinned boundaries, light/dark/system theme, reduced motion, forced
colors, high DPI, normal/second/private isolation, screen-reader announcement,
fail-open, and disposal-during-drag rows are **not run**, not passed.

No new Firefox runtime symbol is invoked. `docs/firefox-internals-map.md`
records the official drag source path beside the existing `moveTabTo` boundary
as a visual reference only.
