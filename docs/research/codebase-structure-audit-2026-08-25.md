# Whole-codebase structure audit — 2026-08-25

## Status and scope

- Status: complete
- Base commit: `cb9a623d57a2a63a145bdab7ae6d7ab7c18315f6`
- Working branch: `codex/refactor-codebase-structure`
- Request source: direct project-owner request; no GitHub issue was supplied
- Platform: Windows, PowerShell, nvm-windows Node `24.18.0`, npm `11.16.0`
- Real Firefox matrix: not run; this is an ordinary source-structure change
  under ADR-039

This audit reviews the complete repository for oversized or mixed-responsibility
files, dependency cycles, suppressions, unsafe typing, duplicated ownership,
and structural anti-patterns. File and function size were used only as
diagnostic signals and were always reviewed against cohesion, safety risk, and
existing behavior tests. No numeric source-line or complexity limit is added to
CI.

## Review method

- Read the current master plan, shell roadmap, modularization plan, architecture,
  ADR-053, current status, testing contract, prior robustness audit, licensing
  policy, and third-party notices.
- Run an unmodified `npm run verify` baseline before editing.
- Inventory authored source, privileged runtime, Svelte, tests, PowerShell,
  generated artifacts, and documentation by physical line count.
- Use temporary local-only ESLint complexity/function-size diagnostics to find
  review candidates; do not add those diagnostics to project configuration or
  CI.
- Parse all PowerShell functions with the PowerShell AST and inspect the largest
  transactional and layout owners.
- Build the static `src/` import graph and check for cycles.
- Search for `TODO`/`FIXME`/`HACK`, lint or TypeScript suppressions, `any`,
  double assertions, dynamic code, runtime networking, and unexpected logging.
- Inspect the largest candidates against their behavior, cleanup ownership,
  fail-open role, and existing tests before deciding whether to split them.

## Findings register

| ID          | Priority | Area                               | Status             | Evidence and disposition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------- | -------- | ---------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| STR-001     | P3       | Browser-tools privileged bridge    | refactored         | The 1,437-line controller combined per-window lifecycle/listeners, native panel resolution and ordered opening fallbacks, and a 367-line action dispatcher with diagnostic complexity 59. It now retains lifecycle, handoff, event publication, and public bridge wiring in a 696-line controller; `panel-placement.ts` owns native panel resolution/placement; `popup-actions.ts` owns named fixed action flows and a small dispatcher. Public contracts, action ordering, error codes, Firefox symbols, and the single generated ESM remain unchanged. |
| STR-002     | P3       | Privileged runtime                 | reviewed/deferred  | `WindowShell.sys.mjs` is 2,288 lines and `NativeUi.sys.mjs` is 2,010 lines. They are genuine future modularization candidates, but they also own activation, native hiding, cleanup, emergency recovery, and fail-open behavior. Splitting them changes the fixed runtime package surface and should be a dedicated task with failure-injection and real-Firefox evidence, not a line-count-driven edit.                                                                                                                                                 |
| STR-003     | P3       | Vertical tab UI                    | reviewed/deferred  | `TabStrip.svelte` is 1,878 lines and owns row rendering, reactive selection, pointer/focus behavior, and native drag-and-drop coordination. Those concerns are separable in principle, but their event ordering and accessibility state are tightly coupled. Extract only around a focused acceptance matrix with real-Firefox drag/focus checks.                                                                                                                                                                                                        |
| STR-004     | P3       | Toolbar widgets                    | reviewed/deferred  | The 1,796-line controller still combines persistence/edit-session coordination with native widget ownership after its presentation and popup-action modules were already extracted. This is the next lower-risk privileged candidate, but it is unrelated to browser-tools and is intentionally not mixed into this change.                                                                                                                                                                                                                              |
| TEST-001    | P3       | Real-Firefox lifecycle harness     | reviewed/deferred  | `tests/firefox-window-lifecycle.mjs` is 8,975 lines and its top-level runner coordinates many probes. A later test-infrastructure task can split probe definitions while retaining the exact release CLI and result semantics. This does not affect installed runtime structure.                                                                                                                                                                                                                                                                         |
| PS-001      | P3       | Installer/setup PowerShell         | reviewed/no change | All 315 parsed functions had valid ASTs. The largest functions (up to 275 lines) are cohesive transaction or WinForms layout flows with fixed-list test coverage; no concrete defect or duplicated state owner justified a split.                                                                                                                                                                                                                                                                                                                        |
| GRAPH-001   | P3       | Source dependencies                | reviewed/no change | The baseline static `src/` graph contained 106 files and 373 relative-import edges with no cycle; the final split contains 108 files and 382 edges with no cycle. No service locator, speculative SDK layer, or cross-layer privileged import was found.                                                                                                                                                                                                                                                                                                 |
| HYGIENE-001 | P3       | Suppressions and unsafe constructs | reviewed/no change | No `TODO`/`FIXME`/`HACK`, lint/typecheck suppression, or source `any` was found. Three existing double assertions were reviewed as narrow parse/function-owner boundaries and were not expanded by this change. No new dynamic code, runtime network path, or browsing-data log was found.                                                                                                                                                                                                                                                               |

Priority meanings: P0 immediate safety/data-loss risk; P1 high-impact runtime or
security failure; P2 concrete correctness/robustness defect; P3 maintainability,
hygiene, or evidence debt without a confirmed current behavior failure.

## Why this refactor is behavior-preserving

- `src/firefox/browser-tools.ts` remains the stable facade, and the public
  browser-tools contract is unchanged.
- The controller still resolves the owning window before popup preparation,
  marks opening panel IDs only after handoff preparation, and clears them in the
  same `finally` path.
- The exact native panel IDs, Firefox owners, error codes, popup positions,
  `PanelMultiView`/screen/anchor attempt order, translation timeout, popup hold,
  and disposal behavior were moved without adding a fallback or compatibility
  branch.
- A source-structure test now protects responsibility ownership by module name
  and dependency, not by line count.

## Verification log

| Command or check                               | Result   | Notes                                                                                                                                                                                                                                                             |
| ---------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Starting worktree and branch                   | pass     | Clean `main` at the base commit; work moved to the dedicated branch above.                                                                                                                                                                                        |
| Unmodified `npm run verify`                    | pass     | Formatting, lint, zero-diagnostic typecheck, 373 Node tests, 87.50% line/95.39% function coverage, all fixed PowerShell 7 suites, dependency audit, deterministic builds, and 14 accepted artifacts.                                                              |
| Final static source import graph               | pass     | 108 source files, 382 relative-import edges, zero cycles; baseline was 106/373 with zero cycles.                                                                                                                                                                  |
| PowerShell AST inventory                       | pass     | 315 functions, zero parse errors; largest reviewed functions were cohesive transaction/layout owners.                                                                                                                                                             |
| Temporary ESLint diagnostics after refactor    | reviewed | No complexity-over-20 or statement-over-50 result remains in the three browser-tools modules. Their dependency-owning factory closures still exceed an arbitrary 200-line diagnostic threshold; this was reviewed as closure scope, not converted into a CI gate. |
| Focused browser-tools/source/build tests       | pass     | 35/35 including the new semantic ownership assertion; all existing browser-tools behavior paths remained green.                                                                                                                                                   |
| `npm run typecheck` after refactor             | pass     | Zero Svelte errors/warnings and zero TypeScript diagnostics.                                                                                                                                                                                                      |
| Final `npm run verify`                         | pass     | 374/374 Node tests; 87.57% line, 79.89% branch, and 95.35% function coverage; all fixed PowerShell 7 suites; dependency audit; deterministic builds; and all 14 production artifacts.                                                                             |
| Final Windows PowerShell 5.1 suite             | pass     | All fixed-list static PowerShell suites passed under the CI-runtime counterpart.                                                                                                                                                                                  |
| Real Firefox 153/154 and release mass matrices | not run  | Static/unit evidence does not relabel these rows.                                                                                                                                                                                                                 |

## Security, privacy, provenance, and compatibility result

The refactor adds no dependency, Firefox symbol, resource mapping, native-hide
target, persistence field, URL/title/query/bookmark/download data flow, log
field, runtime network path, or content-accessible resource. New source files
are project-authored MPL-2.0 modules with SPDX headers. The generated privileged
bridge will be rebuilt from source rather than edited directly; no third-party
notice changes are required.

No confirmed behavior, security, privacy, or fail-open defect was found in this
structural audit. Deferred large-file candidates remain documented instead of
being split solely to reduce their line counts.
