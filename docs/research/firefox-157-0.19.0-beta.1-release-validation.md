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

## Release checks

| Check | Result |
| --- | --- |
| Clean committed preflight, exact dependencies, local verification | Pending. |
| PowerShell 5.1 fixed-list suite for candidate metadata | Pending. |
| Three cold starts / full lifecycle / Browser Toolbox | Pending. |
| Frontend, bridge, safe-start, entry/runtime failure recovery | Pending. |
| SessionStore process restart / fail-open / cleanup | Pending. |
| Native providers, production Urlbar, tab drag, color, hover, dialog probes | Pending. |
| Three enabled performance starts and disabled controls when needed | Pending. |
| Deterministic archive / Unicode extraction / exact package lifecycle | Pending. |
| GitHub Windows CI and reviewed merge | Pending. |
| Annotated tag / fail-closed publication / independent public download | Pending. |
| Public archive recovery and final cleanup | Pending. |

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
