# Tab-drop correction and whole-codebase robustness audit — 2026-08-24

## Status and scope

- Status: complete
- Base commit: `2d5a84b05a6fe26d6086c70284ab842dceb6c13f`
- Working branch: `codex/fix-tab-drop-index-robustness`
- Request source: direct project-owner report; no GitHub issue was supplied
- Platform: Windows, PowerShell, nvm-windows Node `24.18.0`, npm `11.16.0`
- Real Firefox matrix: not run; this is ordinary rapid-development work under
  ADR-039

The primary task corrects same-window single-tab drop placement and makes the
top and bottom of the vertical tab list easier to target. The accompanying
audit reviews the full current authored/runtime surface by combining the
2026-08-21 audit baseline with every source change since that audit, the
configured all-source lint/type/test/build gates, and targeted manual checks of
privileged boundaries, async work, cleanup, installer/release controls,
security/privacy, documentation, and generated artifacts.

## Constraints

- Preserve stock-Firefox/native-UI ownership, fail-open recovery, the shared
  four-edge controller, project-owned XHTML roots, and the marker-only drag
  payload.
- Do not add a second drag owner, edge trigger, hide timer, persistence field,
  runtime network dependency, native DOM mutation, or compatibility guess.
- Do not hand-edit generated artifacts. Rebuild them from source.
- Keep real-Firefox evidence explicitly separate from unit/static evidence.
- Route unexpected deferred UI failures to the existing fatal boundary without
  exposing browsing data.

## Review coverage

- [x] Read the current plans, relevant accepted ADRs, Firefox research records,
      security/testing contracts, issue #109, PR #110, and its implementation
      commits.
- [x] Run an unmodified complete `npm run verify` baseline.
- [x] Compare all authored source/test changes since the 2026-08-21 audit.
- [x] Inspect tabs, drag coordinator, Svelte drag geometry, pointer/focus holds,
      pinned/multi-selected partitions, and native mutation verification.
- [x] Search all TypeScript/Svelte for discarded promises, delayed work,
      listener/observer/timer ownership, ignored errors, suppressions, dynamic
      HTML/code generation, runtime networking, logging, and persistence.
- [x] Confirm literal authored `addEventListener`/`removeEventListener` and
      `addObserver`/`removeObserver` registrations remain balanced per file;
      inspect the timer-owning files and their cleanup paths.
- [x] Run dependency vulnerability and available-update checks without changing
      exact pins.
- [x] Inspect current installer/release/CI coverage through the fixed complete
      verification suites and previous unchanged audit findings.
- [x] Add focused tests only for observed placement, bounds, mutation, and
      deferred-error paths.
- [x] Rebuild generated frontend/bridge artifacts and complete both supported
      PowerShell validation rows.
- [x] Review the final diff and mark this record complete.

## Findings register

| ID | Priority | Area | Status | Evidence and disposition |
| --- | --- | --- | --- | --- |
| TAB-001 | P2 | Same-window tab drag | fixed | PR #110's single-tab branch passed the final destination directly to a helper that subtracts moving tabs before the insertion boundary. A first-tab-to-index-1 test reproduced actual index 0. ADR-072 now applies the existing downward `+1` boundary conversion to every move-set size. |
| TAB-002 | P2 | Drag geometry/native mutation | fixed | Local midpoint mapping accepted `NaN`, and a non-throwing native `moveTabTo` no-op was still consumed as success. Local mapping now rejects every non-finite midpoint, and same-window drop compares the complete resulting native identity order before consuming the transfer. |
| UX-001 | P2 | Top/bottom list targeting | fixed | The prior target used only exact row midpoints inside the scrollable list. A pure 32 CSS-pixel top/bottom magnetic zone, capped for short lists, now normalizes both local and external drops; the existing owned strip wrapper accepts its gap/New Tab region and clamps it to the nearest list end. Keyboard reorder remains available. |
| UI-001 | P2 | Deferred Svelte work | fixed | Post-multi-select drag recapture, bookmark focus/actions, customize-tab focus, toolbar-widget actions, and top/left browser-tool actions had fire-and-forget paths that could reject outside `onFatalError`. They now route unexpected rejection through the existing fatal boundary; expected optional edit/popup failures retain their current local handling. |
| DEP-001 | P3 | Exact frontend dependencies | reviewed/deferred | `npm audit` reports zero vulnerabilities. Patch/major releases are available for some exact pins; upgrades remain a separate provenance and compatibility review and are not mixed into this correction. |

Priority meanings: P0 immediate safety/data-loss risk; P1 high-impact runtime or
security failure; P2 concrete correctness/robustness defect; P3 lower-impact
maintenance or hygiene item.

## Verification log

| Command or check | Result | Notes |
| --- | --- | --- |
| Starting worktree and branch | pass | Clean `main` at the base commit; work moved to the dedicated branch above. |
| Unmodified `npm run verify` | pass | Formatting, lint, zero-diagnostic typecheck, 369 Node tests with 87.44% line/95.38% function coverage, fixed PowerShell 7 suites, dependency audit, deterministic builds, and 14 accepted artifacts. |
| Single-tab downward regression before fix | fail as expected | Requested final index 1 returned index 0; the test now passes after the boundary correction. |
| Invalid midpoint and silent native no-op tests before fix | fail as expected | Mapping returned index 2 for `NaN`; a no-op `moveTabTo` was accepted. Both are now rejected. |
| Focused tabs/UI tests after fixes | pass | 50/50 across tab bridge, tab strip, bookmarks UI, and frontend build contracts. |
| `npm run typecheck` after fixes | pass | Zero Svelte errors and zero warnings; TypeScript completed. |
| `npm run lint` after fixes | pass | Complete configured authored/runtime/test inventory passed. |
| Literal listener/observer pairing scan | pass | No authored file has unequal literal add/remove registration counts. |
| Dynamic HTML/code/network and authored logging scan | pass | No dynamic HTML, code-generation, runtime network API, or authored console logging match was found. |
| `npm audit --ignore-scripts --json` | pass | Zero known vulnerabilities across 173 resolved dependencies. |
| `npm outdated --json` | reviewed | Available updates were recorded; no dependency was changed. |
| Final `npm run verify` | pass | 373/373 Node tests; 87.49% line, 79.85% branch, and 95.39% function coverage; zero-diagnostic typecheck; all fixed PowerShell 7 suites; dependency audit; deterministic frontend/bridge builds; and all 14 production artifacts. |
| Final Windows PowerShell 5.1 suite | pass | All fixed-list static PowerShell suites passed under the CI runtime counterpart. |
| Real Firefox 153/154 and release mass matrices | not run | Static/unit evidence does not relabel these rows. |

## Security, privacy, and compatibility result

No new Firefox symbol, URL/title/bookmark/download data flow, log field,
persistence key, resource mapping, dependency, native-hide target, or runtime
network path is introduced. The drag payload remains one fixed MIME marker;
native tabs remain inside `src/firefox/`. Current Firefox 153/154
`gBrowser.moveTabTo` evidence and source pins remain unchanged, so no new
canary adaptation or compatibility claim is made.

No confirmed P0/P1 issue or unresolved in-scope P2 issue remains in the current
local review. The principal remaining evidence debt is the already-documented
real-Firefox drag, accessibility, multi-window/private-window, visual, and
release matrices.
