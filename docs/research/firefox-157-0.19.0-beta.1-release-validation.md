<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 157 — Fennevia 0.19.0-beta.1 release validation

## Environment and release boundary

- Date: 2026-10-01, direct owner request to push and release.
- Candidate: `0.19.0-beta.1`, intended annotated tag `v0.19.0-beta.1`.
- Implementation commit: `b8dae69`; base `dabff2d`.
- Windows x64, stock Firefox 157.0 release, BuildID `20260924084938`;
  official release source `fdd757a2e09c9471cddf383e64e631e4ce178499`.
- A new marker-owned copied program and disposable development profile are
  isolated from daily Firefox. Only synthetic local fixtures are exercised.
- Node 24.18.0/npm 11.16.0 from the installed nvm-windows runtime, selected
  per command. No global runtime switch or separate Node installation.
- Status: release preparation; no tag or public release yet. Rows below are
  updated only when observed. Firefox 153/154 evidence is historical; their
  complete current-candidate matrices are not rerun.

## Changes and earlier evidence

This candidate includes ADR-085 through ADR-090: Firefox 155 Urlbar execution
and native search-mode continuation, auxiliary tab-button correctness,
progressive tab-drag scrolling and visible native scrollbars, background-window
focus preservation, Firefox 157 Nova panel opacity, inactive-window hover
release, and hidden resting chrome behind independent native dialogs.

Exact upstream sources and first-causal evidence are in
`firefox-155-compatibility.md`, `firefox-155-tab-drag-scroll.md`,
`firefox-157-compatibility.md`, and `firefox-157-native-dialogs.md`.
Before release preparation, the complete local gate passed 467 unit tests,
PowerShell 7/5.1 suites, deterministic builds, and 14 production artifacts.
Focused real Firefox 157 color (10), background hover (8), native dialog (8),
Urlbar execution, and Browser Toolbox/lifecycle probes passed. These are
earlier source observations, not substitutes for archive validation below.

No dependency, remote runtime asset, updater, normal logging, browsing-data
flow, or third-party implementation is introduced. Firefox retains prompt
actions, permissions, security delays, native ownership, and fail-open recovery.
The owner-requested dialog policy refinement is recorded in ADR-090.

The owner added ADR-091 follow-ups before publication: download-launcher progress,
bookmark middle-click icon visibility, fixed window controls during narrow-panel
scrolling, and horizontal side scrolling. The focused Firefox 157 fixture passes
six download states, two Top scroll positions, both side scrollers, and hidden
disabled bookmark actions, with fixture restoration. This measures rendered DOM
and computed styles, not a physical mouse or assistive-technology session.
The expanded final fixture also passes customization entry/exit, no duplicate
controls, and all three controls moved into a nested side Row at 110px width.
Both the launcher and Downloads status widget render the same weighted ring.
The final source ordinary gate passed 467 tests with 88.88% line / 95.99%
function coverage, static PowerShell, dependency audit, and all 14 production
artifacts. After sharing the ring with the status widget, typecheck, lint, and
the 11 affected frontend source-contract tests passed again.

Current source artifact SHA-256 values:

- ShellApp: `fe02c8045151b62c9008011729354f09c17d7d2400a1546c421b741d4abf56d9`.
- ShellStyles: `d635e47d1e5bba1f9391254b8bcfa36274679062235ba61dc5ea3feacf74d7ca`.
- BridgeBoundary: `2702eddbc00282ba55aeaf330058015bc092295ab51ababdd868aef0f8e9dc47`.

An initial dock build correctly failed open because its moved controls lacked
their configured layout health identities. The dock now renders each identity
and action exactly once; the existing health check is unchanged. A test-only
side fixture initially assumed every saved layout has a single base container;
it now also covers direct root children. Neither failure is a shipped result.

## Release checks

| Check | Result |
| --- | --- |
| Clean committed preflight, exact dependencies, local verification | Passed at `e727424` before ADR-091; final candidate rerun pending. |
| PowerShell 5.1 fixed-list suite for candidate metadata | Passed at `e727424`; final candidate rerun pending. |
| Three cold starts / full lifecycle / Browser Toolbox | First ADR-091 full lifecycle and Toolbox pass; subsequent recovery starts pending. |
| Frontend, bridge, safe-start, entry/runtime failure recovery | Pending. |
| SessionStore process restart / fail-open / cleanup | Pending. |
| Native providers, production Urlbar, tab drag, color, hover, dialog probes | Pending. |
| Three enabled performance starts and disabled controls when needed | Pending. |
| Deterministic archive / Unicode extraction / exact package lifecycle | Pending. |
| GitHub Windows CI and reviewed merge | Pending. |
| Annotated tag / fail-closed publication / independent public download | Pending. |
| Public archive recovery and final cleanup | Pending. |

The first clean preflight produced identical archives with SHA-256
`98c1c994b87e59709256f9ef327802e7a1a6c0d1d39d0b6d0fe9ea078d327202`.
This is an earlier candidate, not a public-release checksum. Frontend recovery
passed; all six missing-bridge capability injections passed, but the bridge
suite's final restored lifecycle found Bottom visible after OS window-state
changes. That final-state failure is being investigated; it is not recorded as
a passing suite and no production behavior is inferred from it.
The next full lifecycle passed; a bounded test-only trace observed only window
size-state events and all four surfaces hidden after restoration. The failure
has not yet recurred; no guessed production fix was made for this observation.
The final bridge and safe-start suites also passed their restored full
lifecycles with all four surfaces hidden. The temporary window-state trace was
then removed; it never formed part of an installed artifact.

The SessionStore rehearsal first failed during its module import. A bounded
test-only probe isolated that first phase; installed Firefox 157 `omni.ja` and
upstream `moz.build` confirm the URI migration in
[Bug 2062783](https://bugzilla.mozilla.org/show_bug.cgi?id=2062783), commit
`05d579ece18a136fefc53d6fd5d76e6da7890dc7` (Firefox 156). Updating only the
harness's SessionStore and TabStateFlusher imports to `moz-src:///browser/`
restored preparation, restart, lazy-tab, fail-open, and exact preference/state
cleanup; all four phases passed. No production SessionStore implementation
or compatibility branch was added; the temporary import probe was removed.

The Windows workflow is run directly locally; `act` is not used because no
workflow, container, runner, or CI orchestration changes are made. GitHub-hosted
checks remain authoritative for merge and publication.

## Explicit limits

Physical cross-application pointer/drag sequences and the owner's intermittent
site-specific dialog behavior remain unconfirmed. Native event/DOM fixtures
are not OS mouse sessions. Full page light/dark dialog visuals, accessibility
and hardware/high-DPI/forced-colors checks, accounts, language switching,
representative extension/provider and permission-device matrices, first-paint
watchdog visuals, GUI double-click/UAC/registered daily-profile installs, and
all non-Windows/non-stable channels are not run. These limits follow the
existing experimental Windows prerelease boundary and are not passed claims.
The archive is not a stable or cross-platform support promise.

## Reproduction

Commands use only the exact marker-owned `$firefox` and `$profile`; `$package`
is the strictly verified extracted archive. Paths are intentionally not stored.

```powershell
pwsh -NoProfile -File scripts/release-preflight.ps1 -OutputDirectory $output -ExpectedTag v0.19.0-beta.1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/run-static-powershell-tests.ps1
node tests/firefox-window-lifecycle.mjs --firefox $firefox --profile $profile --browser-toolbox
pwsh -NoProfile -File tests/firefox-frontend-recovery.Tests.ps1 -FirefoxPath $firefox -ProfilePath $profile
pwsh -NoProfile -File tests/firefox-bridge-recovery.Tests.ps1 -FirefoxPath $firefox -ProfilePath $profile
pwsh -NoProfile -File tests/firefox-shell-recovery.Tests.ps1 -FirefoxPath $firefox -ProfilePath $profile
pwsh -NoProfile -File tests/firefox-session-restore.ps1 -FirefoxPath $firefox -ProfilePath $profile
pwsh -NoProfile -File tests/firefox-release-recovery.ps1 -FirefoxPath $firefox -ProfilePath $profile -PackageRoot $package
```

Lifecycle modes additionally used for individual rows will be recorded with
their actual results. No release-complete assertion is made before publication.
