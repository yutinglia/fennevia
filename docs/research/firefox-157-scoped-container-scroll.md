<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 157 scrolling within configured containers

## Scope and environment

Owner-requested correction on 2026-10-01, based on a screenshot and the same
local redacted layout export used for ADR-092. Baseline:
`bcd71b2870adc5b817df3d581c207fdafcd193c7` (main after PR #125).
Windows x64, stock Firefox stable 157.0 BuildID `20260924084938`, Node
24.18.0/npm 11.16.0. Testing uses a marker-owned disposable program copy and
development profile. No daily profile, user export, or installed daily program
is modified. The export and its path remain outside the repository.

This is an unreleased development correction. No version bump, tag, publication,
or inherited release-matrix waiver is part of this change.

## Reproduction and decision

Before changing production code, the real-engine regression demonstrated
panel-wide horizontal movement at 240px and 360px with a generic tool Row.
The supplied layout reproduced it at 240px; its narrower set of tools fits
at 360px. In failing cases the outer Column gained horizontal extent, the
address/Tabs siblings moved, and the actual tool Row had no local scroll range.
There was no JavaScript root exception: the first divergence was owned layout
geometry, reproduced with exact baseline artifacts.

The minimum-content Row width and sticky/minimum-width ancestors introduced
by ADR-091/092 exported the overflowing Row's extent into the whole panel.
ADR-094 replaces those rules with bounded container scroll ports. Window
controls retain their configured sibling group, inline sticky position, and
vertical center. Natural/Expanded sizing and the saved configuration remain
unchanged. Columns constrain horizontal overflow; Rows expose local horizontal
scrolling. Existing Tabs partitions retain independent vertical scrolling.

Customize uses its existing animation-frame owner for the receiving container
and compensates cached insertion geometry for both local scroll and ancestor
movement. The bounded no-drag scrollbar band reuses the repository's ADR-083
pattern outside the scrolling content. No external code or new Firefox
internal contract is introduced; no new upstream-compatibility claim is made.
Existing native health, shared reveal/hide, actions, and fail-open are unchanged.

## Verification

Commands, with the disposable pair and optional local redacted export selected:

```powershell
$env:PATH = (Join-Path $env:NVM_HOME 'v24.18.0') + ';' + $env:PATH
npm run verify
powershell -NoProfile -ExecutionPolicy Bypass -File ./tests/run-static-powershell-tests.ps1
$env:FENNEVIA_LAYOUT_FIXTURE = $layoutExport
node tests/firefox-window-lifecycle.mjs --firefox $firefox --profile $profile --ui-controls-probe
```

The fixture returns bounded categories/booleans only. It restores preferences,
styles, synthetic Downloads state, and owned blank tabs on success or failure.
Generated files are reproduced with `npm run build`.

- Focused Firefox checks: passed all 12 side/width/structure cases, independent
  Column and Tabs scrolling, and both Row/Column customize drag cases (local
  movement, compensated insertion index, center-stop, and cleanup). All 36
  window-control placement cases and four supplied-layout alignment checks
  passed, as did download progress, bookmark opacity, customization entry/exit,
  and the 110px nested-control regression. Preference restoration passed.
- `npm run verify`: passed, including all 492 unit tests, coverage floors,
  formatting, lint, typecheck, the PowerShell 7 fixed-list suite, dependency
  audit, deterministic rebuild, and the 14-artifact production scan.
- Windows PowerShell 5.1 fixed-list suite: passed.
- No first-party script error or error-level runtime record after the Firefox
  probe; the owned browser exited cleanly. The disposable installation was
  uninstalled and both marker-owned targets were removed after validation.
- GitHub-hosted CI/CodeQL: pending PR gate; must pass before merge to main.
- `act`: evaluated, not run. The unchanged workflow requires Windows and
  Windows PowerShell 5.1; native commands provide the local precheck.
- Daily-profile GUI confirmation, physical scrollbar thumb/track and window
  dragging, high DPI/system colors, screen reader, and release mass matrices:
  not run. Synthetic DOM events and geometry do not prove OS input behavior.

The final rebuilt files match the bytes installed for the passing Firefox run:

- `ShellApp.js`: `2134dc244277d829dec827e1613917710bac7403aebf0d27ee76d01a2a69619e`
- `ShellStyles.sys.mjs`: `6b35b79bb501773d4a55bceb25a06cab3c68fe6654103bbddba5a8aabfe7a500`
