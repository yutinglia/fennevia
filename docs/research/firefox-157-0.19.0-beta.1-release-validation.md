<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 157 — Fennevia 0.19.0-beta.1 release validation

## Environment and release boundary

- Date: 2026-10-01, direct owner request to push and release.
- Release: `0.19.0-beta.1`, annotated tag `v0.19.0-beta.1`.
- Implementation commit: `b8dae69`; base `dabff2d`.
- Final annotated tag source: `41e5b140b62619299d46a492c5e7d0bc9ee95dc2`,
  including [PR #123](https://github.com/yutinglia/fennevia/pull/123)'s explicit
  approval record; its Windows CI run `36756598629` and CodeQL checks passed.
- Windows x64, stock Firefox 157.0 release, BuildID `20260924084938`;
  official release source `fdd757a2e09c9471cddf383e64e631e4ce178499`.
- A new marker-owned copied program and disposable development profile are
  isolated from daily Firefox. Only synthetic local fixtures are exercised.
- Node 24.18.0/npm 11.16.0 from the installed nvm-windows runtime, selected
  per command. No global runtime switch or separate Node installation.
- Status: [public prerelease](https://github.com/yutinglia/fennevia/releases/tag/v0.19.0-beta.1),
  published at `2026-09-30T18:25:19Z` (2026-10-01 in Asia/Taipei).
  Rows below are updated only when observed. Firefox 153/154 evidence is
  historical; their complete current-package matrices are not rerun.

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
| Clean committed preflight, exact dependencies, local verification | Full preflight passes at `e727424`; final UI passes local verification and affected follow-up checks. Clean ADR-091 packaging rehearsal passes at `fe9a879` with dependency install/project verification explicitly reused. |
| PowerShell 5.1 fixed-list suite for candidate metadata | Passed locally at `e727424` and in the current Windows CI gate; final extracted tree also passes the 5.1 verifier. |
| Three cold starts / full lifecycle / Browser Toolbox | Passed Toolbox lifecycle and the repeated complete bridge, safe-start, frontend, and extracted-package recovery lifecycles, including normal/second/private windows and cleanup. |
| Frontend, bridge, safe-start, entry/runtime failure recovery | Missing/throwing bundle, all six bridge injections, complete/broken-package safe start, missing Bootstrap entry, and missing WindowManager dependency pass with exact restoration. |
| SessionStore process restart / fail-open / cleanup | All four phases pass after updating test-only module imports. |
| Native providers, production Urlbar, tab drag, color, hover, dialog probes | All six focused modes pass on the final artifacts; UI-controls fixture also passes its expanded cases. |
| Three enabled performance starts and disabled controls when needed | Three enabled and three disabled starts complete; investigation and metrics below. |
| Deterministic archive / Unicode extraction / exact package lifecycle | `fe9a879` clean preflight passes with existing verified dependencies/project gates reused; double archive matches, both PowerShell verifiers pass, and extracted-package disable/repair/enable lifecycle passes. |
| GitHub Windows CI and reviewed merge | Windows CI run `36755164762` and all CodeQL checks pass at `87ee2209bc6e1becc0f6d2a4666b5be36e0648dd`; [PR #122](https://github.com/yutinglia/fennevia/pull/122) merged normally as `c52c229076347ec0be873ecdfb44b665882a7384`. |
| Annotated tag / fail-closed publication / independent public download | Annotated tag resolves to `41e5b140b62619299d46a492c5e7d0bc9ee95dc2`. Both jobs of [Release run 36757541789](https://github.com/yutinglia/fennevia/actions/runs/36757541789) pass; independently downloaded ZIP and checksum match remote asset digests, and strict PowerShell 7/5.1 verification passes. |
| Public archive recovery and final cleanup | Fresh marker-owned Firefox 157 program/profile pair: public-package Install, hard-disable with missing frontend, native cold start, Update repair, Enable, normal/second/private lifecycle, Uninstall, and stock startup all pass. Both checked test targets were removed; zero Firefox processes remain. |

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

The ADR-091 archive at `fe9a8795ae0997bc472b627b8e02260330d5160f` has SHA-256
`a54d2474b7ca03699add50c32a28ab9e74a5b2ac36cefea34ee5fb77226148a6`.
Its strict extraction contains 39 files and package-manifest SHA-256
`05df76818b8cc6bce235521f965f84005933505cbfb636f197d65195f9d0a492`.
This remains a local candidate checksum, not a public asset digest.

The final pre-tag candidate at `87ee2209bc6e1becc0f6d2a4666b5be36e0648dd`
also passes double-archive equality, Unicode extraction, and strict PowerShell
7/5.1 verification of all 39 files. Its 1,426,150-byte ZIP SHA-256 is
`a1e6b85170566ca06fc6bf0e8ca5a17273706e628b42796f4f61d3d677ecc855`;
the package-manifest digest above is unchanged. This rehearsal explicitly
reused verified dependencies and project gates. It is not the public digest.
The final installed Update preview reports `already-current` with zero planned
or applied mutations. The marker-owned profile and copied program were then
uninstalled and removed through their checked helpers; zero Firefox processes
remain. Candidate archives and privacy-safe test evidence are retained.

The annotated-tag rehearsal at `41e5b140b62619299d46a492c5e7d0bc9ee95dc2`
passes with verified dependencies/project gates explicitly reused, two identical
archives, Unicode extraction, and strict PowerShell 7/5.1 verification. Its
local ZIP SHA-256 is
`ae1e516052d0d0cd327799fe4ce8d4f682153bb91c92699285e0fb9d7f3d12b7`.
This is a local compiler output, not the independently downloaded public digest.

### Published assets

The GitHub-hosted publication workflow reran full dependency installation,
ordinary verification, deterministic packaging, and extraction verification in
each of its two jobs. It verified draft asset digests before publishing, then
downloaded and verified the public assets. A separate local
`gh release download` retrieved the published ZIP and checksum:

- ZIP: `fennevia-0.19.0-beta.1-windows.zip`, 1,426,662 bytes, SHA-256
  `eb24fdf822cf0d42e4a5a26002f1c9047c8e6988f1a59a02965a793233c31f33`.
- Checksum file SHA-256:
  `0762fec4a0d5e7897910b687889201d22fee24b3655ac3ffbdc7046bb8104b77`.
- Manifest source commit: `41e5b140b62619299d46a492c5e7d0bc9ee95dc2`;
  package-manifest SHA-256 remains
  `05df76818b8cc6bce235521f965f84005933505cbfb636f197d65195f9d0a492`.
- Unicode-path extraction and strict PowerShell 7/5.1 verification pass for all
  39 files. Comparing inventory hashes with the local tag rehearsal finds only
  `FenneviaSetup.exe` differs, along with its enclosing release manifest. The
  local/framework and GitHub/Roslyn compiler distinction is documented by
  ADR-049; installed runtime files match exactly. No claim is made that the
  entire local ZIP is byte-identical to the public ZIP.

The downloaded public archive was installed into a fresh marker-owned copied
Firefox 157 program and disposable profile after clean-environment verification
and an exact dry-run plan check. The release recovery harness passed missing
frontend hard-disable, zero-host native cold start, exact Update repair, Enable,
and complete normal/second/private lifecycle with no unexpected first-party
script errors. A separately checked Uninstall then passed stock startup with
zero project records or owned-file residue. The profile and copied program were
removed through their marker-checked helpers after WhatIf review and resolved
path-boundary checks. Both removals succeeded and no Firefox process remained.
Daily Firefox was not changed. No open Dependabot pull requests were present.

### Performance observations

Windows 11 Pro 10.0.26200 x64, Intel Core i7-13700K, 8 GiB RAM, Balanced
power plan; same copied Firefox 157/profile and exact candidate runtime bytes.
No local verification/build jobs ran during the six measurements.

| Run | Spawn to active (ms) | Five-second CPU (ms) | Edge p95 (ms) | Five-cycle memory delta (MiB / %) |
| --- | ---: | ---: | ---: | ---: |
| Enabled 1 | 1161 | 1604.856 | 18.293 | 81.438 / 12.411 |
| Enabled 2 | 1433 | 1004.165 | 18.347 | 97.980 / 14.892 |
| Enabled 3 | 1591 | 915.781 | 19.922 | 101.336 / 15.202 |
| Disabled 1 | 1322 (native ready) | 1947.145 | Not applicable | Not applicable |
| Disabled 2 | 1468 (native ready) | 1922.526 | Not applicable | Not applicable |
| Disabled 3 | 1389 (native ready) | 1761.864 | Not applicable | Not applicable |

Enabled startup median is 1433 ms; all edge p95 values are below 50 ms. Memory
growth exceeds 64 MiB but remains below the joint 20% investigation threshold
in all three runs; process count returns to the pre-cycle count of 11 and all
five windows dispose their hosts/bridges. This is not a zero-growth claim.
The enabled idle median of 1004.165 ms exceeds the absolute 500 ms threshold,
so three hard-disabled controls were run. Their median is higher at 1922.526
ms, with zero Fennevia records/hosts. This points to shared Firefox/profile
startup activity rather than evidence of Fennevia-specific idle overhead;
it is not a precise causal CPU attribution. Enable was restored in `finally`.

The fatal-bootstrap test mode now permits an intentionally absent Bootstrap
entry in its target preflight, alongside the already permitted missing
WindowManager dependency. Both missing-module runs produce one caught fatal
record and retain native UI. Normal harness modes still require both modules.
Each exact installed file hash was checked before removal and after restoration.
Affected harness lint and all three SessionStore contract tests pass.

Exact-package Uninstall passed its reviewed plan, followed by stock Firefox
startup with zero Fennevia records or owned-file residue. Reinstall from the
same verified extraction then passed a complete normal/second/private lifecycle
with no unexpected first-party exceptions and deterministic cleanup.

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
all non-Windows/non-stable channels are not run. These are not passed claims.
The archive is not a stable or cross-platform support promise. Unsupported
platform/channel rows do not expand this Windows stable candidate's scope.

On 2026-10-01, after reviewing the completed changes, candidate ZIP, automated
Firefox 157 evidence, and remaining manual/hardware/GUI limitations, the owner
explicitly approved: “核准本次預覽版例外，CI 通過後發布” (approve this prerelease
exception and publish after CI passes). This one-time approval covers the
unrun assistive-technology, high-DPI/system-color, device/account/extension,
GUI/UAC, and physical cross-application pointer rows described above. It is
recorded in AGENTS.md §8.2, ADR-039, and `docs/testing-and-recovery.md` before
tagging. These rows remain `not run`; the approval does not establish stable,
cross-platform, or physical-interaction validation. Safety, privacy, fail-open,
and native-UI ownership remain unchanged. Publication still requires the
successful automated release workflow and verified public assets.

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
node tests/firefox-window-lifecycle.mjs --firefox $firefox --profile $profile --ui-controls-probe
node tests/firefox-window-lifecycle.mjs --firefox $firefox --profile $profile --performance-baseline
# Three control starts while this same marker-owned installation is hard-disabled:
node tests/firefox-window-lifecycle.mjs --firefox $firefox --profile $profile --performance-stock-baseline
# After marker/manifest/hash-checked removal of each test target, restored in finally:
node tests/firefox-window-lifecycle.mjs --firefox $firefox --profile $profile --expect-fail-open
# Following an ownership-checked Uninstall:
node tests/firefox-window-lifecycle.mjs --firefox $firefox --profile $profile --expect-stock
```

Lifecycle modes additionally used for individual rows will be recorded with
their actual results. No release-complete assertion is made before publication.
