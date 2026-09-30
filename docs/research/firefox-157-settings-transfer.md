<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 157 portable settings files

## Scope and environment

Direct owner request on 2026-10-01, with explicit selection of all Fennevia
layout, panel, appearance and interaction settings. No separate issue supplied.
Base: `46255d1` (configured window-control Row alignment). Windows x64,
Firefox stable 157.0 BuildID `20260924084938`, nvm-windows Node 24.18.0,
npm 11.16.0. Tests use the task's marker-owned disposable program/profile pair;
no daily profile or supplied diagnostic export is changed. No release tag,
version bump, publication or continuation of the v19 manual-test exception.

## Source evidence and selected design

Official Firefox 157 source pin: `fdd757a2e09c9471cddf383e64e631e4ce178499`.
Files were read through `gh api` after Searchfox retrieval was unavailable:

- `widget/nsIFilePicker.idl`: browsing-context ownership, asynchronous callback,
  open/save modes, selected file and OK/Cancel/Replace results; no cancel method.
- `browser/components/places/content/places.js`: Firefox's native selection
  caller as an API-use reference.
- `dom/chrome-webidl/IOUtils.webidl`: bounded reads, exclusive file creation,
  flushed writes, move overwrite control, and cleanup.
- `modules/libpref/nsIPrefBranch.idl`: user-value presence and existing string
  preference get/set/clear calls.
- `browser/components/customizableui/CustomizableUI.sys.mjs`:
  `getWidgetProvider` may return an XUL provider for a nonexistent/arbitrary ID;
  actual placed/unused inventory must authorize adoption and action exposure.
- `testing/specialpowers/content/MockFilePicker.sys.mjs`: test-only component
  factory registration/restoration contract. The independently authored fixture
  implements only selection; no SpecialPowers code is bundled or copied.

Links to these production API definitions are in the current internals map.
All are API/behavior references, not copied/adapted implementation. No dependency
or third-party notice inventory changes. The same-session compatibility-canary
review is recorded in `firefox-157-compatibility.md`; this feature has no upstream
regression or maintained-loader workaround to transplant.

The minimum native spike constructed and initialized the real file picker and
proved local UTF-8 file round-trip/removal and preference presence on the exact
build before frontend integration. ADR-093 then selected a separate settings
module behind the existing toolbar controller, without new listeners or timers.

Files use `format: "fennevia-settings"`, version 1 and only layout/style/panels.
The current layout, appearance, interaction and panel schemas remain the source
of truth. Adopted-widget authority is removed; unavailable IDs remain disabled
unless they later enter the real widget inventory. Raw IDs, text and paths never
enter frontend state. File selection precedes a separate, single-use import
confirmation; concurrent preference edits invalidate it. Rollback restores
prior preference presence/values and native sibling order. An incomplete
rollback propagates to fail-open; process-crash atomicity is not claimed.

## Reproduction

After building and installing the exact artifacts into the owned pair:

```powershell
$env:PATH = (Join-Path $env:NVM_HOME 'v24.18.0') + ';' + $env:PATH
npm run verify
powershell -NoProfile -ExecutionPolicy Bypass -File ./tests/run-static-powershell-tests.ps1
node tests/firefox-window-lifecycle.mjs --firefox $firefox --profile $profile --settings-transfer-probe
```

The regression uses actual Customize actions, bridge code, native inventory,
IOUtils and preferences. Only the OS selection is replaced by a test-only
component factory; the original factory, exact preference presence/values and
owned files are restored in `finally`. Output contains only bounded booleans.
The native picker constructor is checked before and after the fixture.

Two early regression assertions failed because the harness read Svelte's DOM
before its update and compared a presence attribute with the string `true`.
Waiting for the next UI turn and testing attribute presence corrected the
harness; no production behavior was changed to satisfy those assertions.
The final layout comparison also canonicalizes JSON object-key order rather
than treating serialization order as a change in the saved tree.

## Results

Final development validation on 2026-10-01:

- `npm run verify`: **pass**, 492/492 Node tests; 89.18% line, 82.08% branch and
  95.99% function coverage. Formatting, lint, typecheck, PowerShell 7 fixed-list
  suites, dependency inventory, deterministic build and 14/14 production
  artifact checks passed. The final test-only JSON comparison change also
  passed its targeted ESLint check.
- Windows PowerShell 5.1 fixed-list suite: **pass**.
- Firefox settings regression: **pass** for native picker construction,
  actual local export, invalid input without writes, explicit preview, missing
  widget references, Escape/cancel focus, applying layout/style/panels,
  post-apply focus, export round-trip, stale preview rejection, picker cancel,
  retained active shell and exact cleanup/restoration. No unexpected
  first-party script error or error-level runtime record.
- Cleanup: **pass**. Uninstalled the test package, then removed only the
  resolved marker-owned disposable profile and program copy with the project
  helpers after their dry runs. The supplied diagnostic file is unchanged.
- Final-artifact UI regression: **pass**, 36 window-control Row/width/scroll
  cases and four checks of the supplied redacted Top/Left structure, including
  unchanged saved layout. Download indicator (six states), disabled bookmark
  icon, both side scrollers, Customize and 110px nested controls also passed.

Generated by `npm run build`, never hand-edited:

- `ShellApp.js`: `c68c706ae820c638f4ef5a0340684a3c51c8c3840f8ec2469c7657d723caea5e`
- `BridgeBoundary.sys.mjs`: `dc9fd85f385387515a3ff285a33c8d04246453e6d54815db6e39a343f3ef8ace`
- `ShellStyles.sys.mjs`: `d6a636022164a21b74bc23be9c5790661ab17e49065f7ecd82a4fdd7213d4f5b`

Native open/save dialog GUI, screen readers, high DPI/system
colors, installed extension hardware/account scenarios, second/private-window
import/export and the full release matrices remain **not run**. Automated
selection does not claim to cover those rows. GitHub-hosted CI is **not run** for
this local change. `act` is evaluated but not run: the unchanged workflow uses
`windows-latest` and Windows PowerShell 5.1; native commands are the applicable
local precheck.
