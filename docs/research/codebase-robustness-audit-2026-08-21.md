# Whole-codebase robustness audit — 2026-08-21

## Status and scope

- Status: complete
- Base commit: `63caf8de1dc70ed5f43636a492b92b35af75c3c0`
- Working branch: `codex/codebase-robustness-audit`
- Request source: direct project-owner request; no GitHub issue was supplied
- Platform for repository checks: Windows, PowerShell, Node.js from the
  repository's nvm-managed toolchain
- Real Firefox matrix: not run unless a concrete finding requires it; this is
  an ordinary rapid-development audit under ADR-039

This audit reviews authored runtime code, TypeScript/Svelte application and
Firefox boundaries, generated-artifact controls, PowerShell installation and
release tooling, tests, CI, dependencies, documentation consistency, privacy,
fail-open behavior, accessibility, and deterministic cleanup. Historical
research records are evidence inputs and are not rewritten.

## Constraints carried into the review

- Preserve stock-Firefox ownership, the shared four-edge controller, exact
  native fail-open paths, and project-owned XHTML boundaries.
- Do not add compatibility guesses, dependencies, runtime network access,
  content-accessible mappings, persistence, or native-hide targets.
- Do not hand-edit generated files. Rebuild them from source when affected.
- Keep fixes coherent and evidence-backed. Record broader product work as
  follow-up rather than hiding it inside this audit.
- Treat all user-derived browsing data as prohibited in logs and shared
  evidence.

## Review checklist

### Repository and baseline

- [x] Read `AGENTS.md`, master plan, shell roadmap, current plans, architecture,
      accepted ADRs, security policy/controls, testing contract, licensing, and
      development workflow.
- [x] Confirm the starting worktree is clean and inspect recent merged changes.
- [x] Create a dedicated branch and this persistent audit record.
- [x] Confirm the nvm-managed Node/npm versions and dependency installation.
- [x] Run the unmodified `npm run verify` baseline and record exact results.
- [x] Run `git diff --check` after every edit phase.

### Architecture and privileged runtime

- [x] Inspect AutoConfig/bootstrap for minimal fixed loading and privacy-safe
      fail-open behavior.
- [x] Inspect process/window lifecycle for races, duplicate ownership, late
      async completion, and idempotent reverse cleanup.
- [x] Inspect health, native-UI activation, first-paint hide, safe start, and
      emergency fallback for fail-closed gaps.
- [x] Compare every used Firefox symbol/DOM/event/preference with the current
      internals inventory; record undocumented dependencies.

### Firefox bridges and ordinary state

- [x] Audit boundary validation, opaque handle generation, stale/foreign ID
      rejection, subscriptions, error containment, and disposal.
- [x] Audit tabs, navigation/address, Urlbar coverage, bookmarks, Downloads,
      browser tools, toolbar widgets, locale, and window controls.
- [x] Verify bounds, immutability, per-window/private isolation, and absence of
      native handles or sensitive values in ordinary state and diagnostics.
- [x] Look for asynchronous races, unhandled rejections, callbacks after
      disposal, unbounded collections, and observer/listener leaks.

### Svelte UI and shared interaction

- [x] Audit all five roots for keyboard access, focus restoration, popup holds,
      `Escape`, accessible names/states, and hidden-focus prevention.
- [x] Audit pointer/drag/corner/timer behavior against the single #31
      controller, including the newest window-leave timing changes.
- [x] Audit hostile text/icon rendering, drag payloads, style preferences,
      reduced motion, forced colors, contrast, and responsive overflow.
- [x] Confirm no unscoped CSS, native DOM ownership, second trigger/timer, or
      permanent content geometry was introduced.

### Installer, release, and scripts

- [x] Audit fixed module loading, canonical path checks, reparse defenses,
      ownership proof, plan digest, transaction journal, rollback, repair, and
      one-sided uninstall.
- [x] Audit GUI/TUI event flow, elevation resume state, process checks,
      redaction, and Windows PowerShell 5.1 compatibility.
- [x] Audit release manifest/ZIP determinism, exact inventories, tamper/secret
      scans, workflow permissions, and fail-closed publication behavior.
- [x] Inspect build/sync/audit scripts for unsafe filesystem operations,
      incomplete inventories, or environment-dependent output.

### Tests, CI, dependencies, and documentation

- [x] Map source modules to meaningful tests and identify untested error,
      cleanup, bounds, and fail-open behavior.
- [x] Check whether CI actually runs every documented ordinary gate in both
      supported PowerShell runtimes.
- [x] Review the lockfile, lifecycle scripts, audit logic, bundled runtime
      subset, notices, and production scan.
- [x] Search for stale counts, versions, support claims, paths, commands, and
      contradictory current documentation.
- [x] Add tests only for real behavior uncovered by findings, never only to
      raise coverage.

### Completion

- [x] Implement high-confidence robustness fixes within one coherent hardening
      change set.
- [x] Rebuild generated artifacts through `npm run build` if source changes
      require it.
- [x] Run focused tests while iterating, then the full `npm run verify` gate.
- [x] Record every command as pass/fail/blocked/not run and update finding
      dispositions.
- [x] Review the final diff for unrelated churn, privacy leakage, and overstated
      claims.

## Findings register

| ID | Priority | Area | Status | Evidence and disposition |
| --- | --- | --- | --- | --- |
| DOC-001 | P2 | Current security/testing docs | fixed | Removed stale duplicated 12-file counts. Current documents now defer to the closed manifest-derived `expectedFiles` inventory; the executable manifest remains the source of truth. Historical 12-file milestone evidence was intentionally unchanged. |
| DOC-002 | P3 | Current status snapshot | fixed | Refreshed `docs/current-status.md` from stale base `8923806…` to the audit base `63caf8d…`. |
| RUN-001 | P1 | Process runtime shutdown | fixed | `Runtime.sys.mjs` now records a window-manager disposal failure, continues startup-hide sheet removal, reaches `stopped`, and has a focused regression test proving the fail-open result. |
| INST-001 | P1 | GUI elevation state | fixed | State is now exclusively created in a dedicated direct-child OS-temp namespace, capped at 64 KiB, rejected when reparse-backed, protected by an exact current-owner/full-control ACL, and securely cleaned on creation/resume failure. The exported remover rejects out-of-namespace targets and no longer suppresses deletion failure. PowerShell 7 and 5.1 tests cover valid, missing, external, oversized, locked-cleanup, expiry, digest-mismatch, and successful paths. |
| CI-001 | P2 | Static-analysis inventory | fixed | Replaced hand-maintained test lists with closed globs, added authored privileged runtime modules to lint/format, ignored only generated bridge/bundle trees, and scoped Node/Firefox globals explicitly. The expanded gate also fixed one lost-cause harness error plus stale runtime imports/assignments; one-time formatting establishes the new gate. |
| DOC-003 | P1 | Debug workflow | fixed | Removed the prohibited runtime `fetch`/`IOUtils` debugging recommendation and documented Browser Console/Toolbox plus fixed privacy-safe diagnostics only. |
| DOC-004 | P3 | Local/CI gate wording | fixed | Current setup, workflow, and testing docs now distinguish the shared `npm run verify` gate from the additional Windows PowerShell 5.1 CI row and show both commands. |
| UI-001 | P2 | Deferred Svelte focus work | fixed | Customize and tab focus paths discarded `tick()` promises; a render/focus rejection could bypass the fatal boundary while native UI was hidden. All deferred focus/reveal promises now route rejection to `onFatalError`, with a static component-contract regression check. The `ui-ux-pro-max` review also confirmed existing focus visibility, semantic controls, live regions, reduced-motion/forced-colors handling, and bounded layering. |
| INST-002 | P2 | Program writability probe | fixed | The probe previously returned true after creation even when its silently attempted deletion failed. It now reports writable only after create and delete both succeed, returns false on cleanup uncertainty, and has a no-residue assertion in both PowerShell runtimes. |

Priority meanings: P0 immediate safety/data-loss risk; P1 high-impact runtime or
security failure; P2 concrete robustness/maintenance defect; P3 low-impact
clarity or hygiene issue.

## Verification log

| Command or check | Result | Notes |
| --- | --- | --- |
| Starting `git status --short --branch` | pass | Clean `main` before branch creation. |
| Manifest/profile inventory comparison | pass | Actual closed profile inventory is 14 paths. |
| Node/npm/dependency preflight | pass | nvm-windows Node `24.18.0`, npm `11.16.0`, and all 12 direct exact dependencies present. |
| `npm run verify` before source changes | pass | 271 Node tests; 87.75% line and 95.26% function coverage; all fixed-list PowerShell 7 suites; dependency audit; deterministic frontend/bridge build; 14-artifact production scan. |
| `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\run-static-powershell-tests.ps1` before source changes | pass | Complete fixed-list suite passed under Windows PowerShell 5.1. |
| Generated-tree cleanliness after baseline build | pass | Only this new audit record is untracked; generated files and `package-manifest.json` stayed unchanged. |
| `npm audit --ignore-scripts --json` | pass | Zero known vulnerabilities in 173 resolved dependencies. |
| `npm outdated --json` | pass | Exact pins have available patch/major updates; upgrades are deferred to the project's required dedicated dependency review rather than mixed into this audit. |
| UI/UX static review and local `ui-ux-pro-max` Svelte/UX searches | pass with finding | Visible focus, semantic controls, live regions, reduced-motion/forced-colors handling, shared layering, and bounded responsive behavior are present; UI-001 records the deferred-Promise fail-open gap found during the async pass. |
| Expanded read-only ESLint/Prettier probes | fail (expected finding) | Existing configured lists pass, while omitted unit/runtime files expose inventory drift and one caught-error propagation violation; CI-001 tracks the fix. |
| Focused runtime, tab, GUI, and installer-discovery tests | pass | Runtime startup-hide cleanup and tab async-error checks passed; GUI and installer-discovery suites passed under PowerShell 7 and Windows PowerShell 5.1. |
| `npm test` after glob hardening | pass | All 272 `*.test.mjs` tests were discovered and passed. |
| First post-edit `npm run verify` | fail (expected stale-artifact gate) | Source changed before generated shell/manifest synchronization, so installer tests stopped on `FENNEVIA_INSTALL_SOURCE_HASH_MISMATCH`; no assertion was weakened. |
| `npm run build` | pass | Deterministically rebuilt the frontend/bridge and synchronized the closed 16-file package manifest (14 profile artifacts). |
| Final `npm run verify` | pass | Formatting, expanded lint, typecheck, 272 Node tests, 87.75% line/95.26% function coverage, complete PowerShell 7 fixed-list suites, dependency audit, deterministic build, manifest sync, and 14-artifact production scan all passed. |
| Final Windows PowerShell 5.1 fixed-list suite | pass | Complete bootstrap, profile, console/GUI, installer, release, artifact, session, health, host, and lifecycle list passed. |
| Final `git diff --check` | pass | No whitespace error; Git emitted only the repository's expected LF-to-CRLF working-tree notices for PowerShell/Markdown files. |
| PSScriptAnalyzer | not run | Not installed on this host; no software was added for the audit. Both supported PowerShell execution suites passed instead. |
| Real Firefox and release mass matrices | not run | Not implied by this ordinary audit. |

## Deferred or manual-only evidence

The existing pending real-Firefox matrices for ADR-037, ADR-042, ADR-044,
ADR-045/046/047/054, and ADR-050 remain pending unless this audit explicitly
runs and records them. Static or unit success will not be used to relabel those
rows.

No confirmed P0 or unresolved P1/P2 finding remains within this local static,
unit, build, and installer audit scope. Exact dependency upgrades remain a
separate reviewed change because the project pins the complete frontend graph;
the pending real-Firefox matrices remain the principal external validation
debt.
