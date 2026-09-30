<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 157 configured window-control Row alignment

## Scope and environment

Direct owner follow-up on 2026-10-01 after public `0.19.0-beta.1`.
Baseline commit: `be33874dd9a571d08fade913f0bba13baa6568b6`.
Windows x64, Firefox stable 157.0 BuildID `20260924084938`, Node 24.18.0,
npm 11.16.0. Runtime checks use a marker-owned disposable Firefox copy and
development profile under a task-specific temporary root. The daily program
and profile are not modified. This is ordinary development evidence, not a
new release or a continuation of the previous release's manual-test waiver.

The owner supplied two screenshots and a redacted version-2 layout export.
Top contains its window controls at the end of the root Row. Left starts with
a Row containing Back, Forward, Reload/Stop, Translate, Flexible space, and
Minimize/Maximize/Close, followed by the address Row and expanded Tabs. The
export enables multiple placements. No layout migration is needed. The export
and its local path are not included in this repository.

## First causal divergence and selected fix

The released renderer recursively removed window controls from the configured
tree and placed them in one panel-wide dock. The dock aligned to block-start
in Top and followed all content at block-end in side panels. The baseline
real-engine fixture reproduced both loss of Row membership and mismatched
vertical centers in Top, Left, and Right. This is a project layout regression;
the selected fix does not depend on a changed Firefox internal API.

ADR-092 replaces extraction with consecutive sibling groups inside the saved
parent. CSS pins only on the inline axis. The group keeps the existing control
size/spacing and containing Row/Column direction; customization still renders
individual items. Ancestors retain their minimum content width and can pin
with the group. This addresses a measured 110px side-panel case where a narrow
Row's containing block otherwise prevented its controls from following the
horizontal scroll position. Local stacking prevents later scrolled siblings
from covering controls placed at the beginning of a Row.

There are no new privileged APIs, dependencies, network requests, production
diagnostics, observers, timers, preferences, or native UI mutations. Native
window commands and shared surface health/reveal/cleanup remain unchanged.

## Reproduction and verification

After building and installing the exact source artifacts into the owned pair:

```powershell
$env:PATH = (Join-Path $env:NVM_HOME 'v24.18.0') + ';' + $env:PATH
npm run verify
powershell -NoProfile -ExecutionPolicy Bypass -File ./tests/run-static-powershell-tests.ps1

# Optional local, redacted layout export; never print its contents in reports.
$env:FENNEVIA_LAYOUT_FIXTURE = $layoutExport
node tests/firefox-window-lifecycle.mjs --firefox $firefox --profile $profile --ui-controls-probe
```

The UI fixture verifies the same configured parent and vertical center, visible
control bounds, actual pointer hit testing, and movement of the other widgets.
It covers Top/Left/Right, controls at the beginning/middle/end of a padded Row,
360px/640px panels, and both horizontal scroll extremes. The optional supplied
layout verifies simultaneous Top and Left groups without rewriting its saved
preference. All preferences and owned style fixtures are restored in `finally`.
Redacted external widget IDs cannot reproduce the daily profile's actual
extension icons or their exact widths; generic overflow fixtures provide the
additional width and overlap coverage.

- Node unit gate: passed, 469/469, including adjacent-run ordering, repeated
  instances, no parent-boundary extraction, and no input mutation.
- `npm run verify`: passed, including formatting, lint, typecheck, coverage,
  the PowerShell 7 fixed-list suite, dependency audit, deterministic build, and
  all 14 accepted production artifacts.
- Firefox UI regression: passed all 36 placement/width/scroll cases and all
  four supplied-layout checks. The saved supplied preference remained exact.
  The existing download indicator, disabled bookmark icon, side scrolling,
  customize enter/exit, and 110px nested-control checks also passed.
- Windows PowerShell 5.1 fixed-list suite: passed.
- Daily-profile GUI confirmation, screen reader, high DPI/system colors, and
  full release matrices: not run. The owner export supplies structure only.
- GitHub-hosted CI: not run for this local change.
- `act`: evaluated, not run. The unchanged workflow requires `windows-latest`
  and Windows PowerShell 5.1; native commands are the relevant local precheck.

Generated artifacts are rebuilt by `npm run build`; none are edited by hand.
Temporary diagnostic spikes are removed from the test code. The retained
regression fixture returns only bounded booleans, dimensions, and placement
categories, never profile paths, external widget IDs, or browsing data.

Verified generated artifact SHA-256:

- `ShellApp.js`: `a10f22c07c094c2a4e77d4d9db89cdf94fab134e0ed9164159d92adbf116afc2`
- `ShellStyles.sys.mjs`: `d6a636022164a21b74bc23be9c5790661ab17e49065f7ecd82a4fdd7213d4f5b`
- Unchanged `BridgeBoundary.sys.mjs`: `2702eddbc00282ba55aeaf330058015bc092295ab51ababdd868aef0f8e9dc47`
