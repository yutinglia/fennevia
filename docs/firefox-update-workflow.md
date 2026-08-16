# Firefox Stable-Update Workflow

This is the executable Windows-first procedure for moving Fennevia between
stock Firefox stable builds. It applies to unsupported Firefox internals, native
browser DOM, the copied-program installer target, and the marker-owned
development profile. It does not authorize modifying a daily-use Firefox tree,
weakening ownership checks, or claiming support for an untested platform.

## 1. Start an update record

Create one file below `docs/research/` before changing compatibility code. Use
fixed placeholders instead of local paths and record:

- old/new Firefox version, build ID, release channel, official tag/commit, and
  source stamp when available;
- Windows edition/version/build, CPU, installed memory, display scale, and
  power mode for resource comparisons;
- marker-owned profile state and whether session restore is enabled;
- Fennevia base commit, package version, branch, and package-manifest hash;
- old/new copied-program identities and whether the Firefox update retained,
  removed, or changed Fennevia-owned paths;
- the first causal Browser Console error and its redacted stack, or an explicit
  `none observed` result;
- every command as `pass`, `fail`, `blocked`, or `not run`.

Never include an absolute profile/program path, URL, title, query, bookmark,
download source/target, private-window state, token, cookie, or page-derived
label in a shared record.

## 2. Prepare isolated old and new targets

Use `docs/development-setup.md` to create a marker-owned profile and a verified
copied Firefox program. Close the selected Firefox, Browser Console, and Browser
Toolbox before package mutation. Generate the privacy-safe environment record:

```powershell
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Environment `
  -FirefoxPath $firefox
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Verify `
  -FirefoxPath $firefox -RequireNoAutoConfig
```

For a real transition, preserve the old copy for before/after comparison and
create a separately marker-proven copy from the new stock stable build. Do not
overlay one guessed tree with another or use recursive deletion against a
program parent. If the Firefox updater changed an already selected disposable
copy in place, inventory Fennevia-owned paths before running any package action.

Use `Install` when neither ownership side exists. If exactly one valid side
survives because Firefox replaced or moved one complete root, preview `Repair`
with the exact source package recorded by that survivor. Repair must reject
partial residue, a different package, an unmarked profile, or an unproven
directory. If the exact old package is unavailable and removal is intended,
preview `Uninstall` instead; it may use the survivor only when peer metadata is
absent and every present owned byte still matches. Use `Update` only after a
complete identical pair exists:

```powershell
pwsh -NoProfile -File .\scripts\fennevia-package.ps1 Repair `
  -FirefoxPath $firefox -ProfilePath $profile -WhatIf
pwsh -NoProfile -File .\scripts\fennevia-package.ps1 Repair `
  -FirefoxPath $firefox -ProfilePath $profile
pwsh -NoProfile -File .\scripts\fennevia-package.ps1 Uninstall `
  -FirefoxPath $firefox -ProfilePath $profile -WhatIf
pwsh -NoProfile -File .\scripts\fennevia-package.ps1 Update `
  -FirefoxPath $firefox -ProfilePath $profile -WhatIf
```

Stop on ownership, hash, source, residue, reparse-point, process, or transaction
errors. Preserve interrupted-transaction evidence and follow
`docs/installation.md`; never manufacture an ownership file.

## 3. Capture the old-build baseline

From a clean checkout at the base commit:

```powershell
nvm use 24.18.0
npm ci --ignore-scripts --no-fund
npm run dependencies:audit
npm run verify
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\tests\run-static-powershell-tests.ps1
```

Run the real-Firefox harness three separate cold starts, an ordinary restart,
session restore, the Browser Toolbox ownership probe, and the privacy-safe
performance mode. The paths remain local variables:

```powershell
node .\tests\firefox-window-lifecycle.mjs `
  --firefox $firefox --profile $profile
node .\tests\firefox-window-lifecycle.mjs `
  --firefox $firefox --profile $profile --browser-toolbox
node .\tests\firefox-window-lifecycle.mjs `
  --firefox $firefox --profile $profile --performance-baseline
pwsh -NoProfile -File .\tests\firefox-session-restore.ps1 `
  -FirefoxPath $firefox -ProfilePath $profile
```

Record the three `performanceBaseline=` objects. They contain numeric aggregates
only: harness-observed spawn-to-active time, total Firefox-process CPU time and
memory, edge-reveal latency, process count, and five normal-window lifecycle
cycles. The harness deliberately discards process URIs, titles, origins, IDs,
and thread/window records returned by Firefox.

Run the SessionStore wrapper once on the isolated old-build pair and preserve
only its fixed-ID/count/boolean evidence. It performs prepare, cross-process
verify, missing-frontend fail-open, and cleanup, then returns the profile to one
blank tab and its prior preference user-value states. A stale rehearsal marker
or uncertain bundle restoration is a blocker, not permission to delete state.

## 4. Review compatibility canaries

Use English queries and the GitHub CLI. Record each default branch, previous
pin, current head SHA/date, relevant commits/issues/PRs, and whether the change
is applicable:

```powershell
gh api repos/alice0775/userChrome.js/commits?per_page=30
gh api repos/MrOtherGuy/fx-autoconfig/commits?per_page=30
gh api repos/xiaoxiaoflood/firefox-scripts/commits?per_page=30
gh api repos/aminomancer/uc.css.js/commits?per_page=30
```

Check concrete current-version directories and code, not only README files.
Separate generic loader behavior—script discovery, metadata, arbitrary
subscripts, actors, hot reload, menus, legacy compatibility—from a concrete
Fennevia dependency. Canary code is evidence, not a runtime dependency or a
license to copy implementation.

## 5. Inspect current Firefox source

Resolve the release tag in `mozilla-firefox/firefox`, then inspect current
definitions, callers, tests, blame, commits, and linked Bugzilla issues in
Searchfox or the official repository. Start with every changed or failing row in
`docs/firefox-internals-map.md`; do not assume that an unchanged symbol keeps the
same timing, owner, DOM parent, or cleanup semantics.

Minimum source areas are:

- AutoConfig/Chrome Registry and ESM loader;
- delayed browser startup, window mediator, and private-window classification;
- `browser.xhtml`, navigator toolbox, browser box/sidebar, titlebar,
  customization, fullscreen, native dialog, popup, and Urlbar ownership;
- `gBrowser`, `BrowserCommands`, progress listeners, `openLocation`, Urlbar
  identity/protections/permission/action owners;
- Places APIs/observers/opening helpers and Downloads lists/views/state;
- SessionStartup/SessionStore lazy pending state, final SessionFile/SessionSaver
  shutdown writes, and relevant current tests;
- CSS features and accessibility media queries used by project styles;
- `ChromeUtils.requestProcInfo()` for test-only aggregate resource evidence.

For each dependency, update the current revision, project owner/cleanup,
required/optional classification, fallback, test, likely break signal, and first
diagnostic location. Remove stale statements instead of adding a second
contradictory inventory.

## 6. Diagnose and adapt

Reproduce in the clean profile and rule out stale artifacts, startup cache,
extensions, policies, other customizations, and the wrong Firefox/profile pair.
Inspect the Browser Console and Browser Toolbox before editing. Fix the first
causal error; later host, health, or Svelte failures may be cascades.

Record:

1. what changed upstream;
2. how each maintained canary adapted;
3. which parts are loader/customization-specific baggage;
4. the smallest Fennevia change;
5. security/privacy/resource effects and cleanup;
6. exact tests that fail before and pass after.

Missing required capability, native target drift, partial native CSS, mount
failure, or timeout must clear/suspend active hiding and restore native Firefox
UI. Optional capabilities may degrade only through an explicit fixed state.

## 7. Run the new-build matrix

Repeat all old-build commands on the new build, then cover the matrix in
`docs/testing-and-recovery.md`. At minimum record:

- three cold starts; the complete `firefox-session-restore.ps1` rehearsal on
  the new copied-program/profile pair; zero/one/many/loading/restored tabs;
  second normal window; private window; and five repeated window cycles;
- all four edges, corners, pointer/focus/keyboard/popup holds, `Ctrl+L`, Escape,
  native reveal, and disposal during pending state;
- ordinary/narrow/short/maximized/restored/snapped/high-DPI, browser and DOM
  fullscreen, customize mode, light/dark, reduced motion, forced colors, and
  transparency fallback;
- app menu, extension actions/install prompt, Library/bookmark editing, native
  Downloads and safety flows, permission/auth/certificate/file dialogs,
  notifications, find bar, DevTools, Browser Toolbox, and OS controls where
  reproducible;
- tab/navigation/address/Places/Downloads bursts and malformed-data or missing-
  capability failure injection;
- safe start, emergency fallback, hard disable, re-enable, stale-cache
  escalation, update, repair when applicable, uninstall, and stock cold start.

Mark unavailable accounts, extensions, devices, prompts, or display modes as
`not run` with a reason. Do not turn absence of a failure into positive evidence.

## 8. Compare performance and resources

Use the median of three runs on the same hardware, display scale, power mode,
profile state, and idle interval. The following are investigation thresholds,
not noisy CI pass/fail limits:

- spawn-to-active median increases by more than 25% and 250 ms;
- aggregate Firefox CPU exceeds 500,000,000 ns in the five-second idle window,
  or is more than twice the prior median;
- edge-reveal p95 exceeds 50 ms or doubles from the prior median;
- memory after five open/close cycles remains more than 64 MiB and 20% above
  the pre-cycle snapshot across all three runs;
- process count, project hosts, listeners, observers, timers, mappings,
  stylesheets, native views, or Svelte roots remain above the expected post-
  cleanup count.

Re-run outliers and investigate with Firefox Profiler/DevTools when repeatable.
Document hardware and uncertainty. Never normalize a persistent leak as a new
baseline without identifying its owner.

## 9. Security and release review

Run the dependency/license review, exact artifact inventory, deterministic
build, no-runtime-network/source-map/HMR checks, forbidden bridge imports,
native-handle leakage tests, and logging sentinels through `npm run verify`.
Confirm the manifest still has only `content fennevia content/`, no
`contentaccessible=yes`, no override, and no runtime CDN/font/config/code fetch.

Preview hard disable and uninstall, apply them, cold-start stock Firefox, and
verify no Fennevia-owned file, startup record, transaction, process, or host
remains. Startup-cache clearing is allowed only after an observed stale-code
symptom and must have before/after evidence.

The persisted-session fixture must already be cleaned before disable,
uninstall, or copied-program disposal. Verify the marker is absent, the profile
contains one blank native tab on the next normal start, and all seven fixed
preference user-value states match their pre-rehearsal values. Never include
the profile path or Firefox session files in shared evidence.

## 10. Publish the compatibility result

The pull request and issue update must link the current record and state:

- old/new exact builds and commits;
- first causal error or `none`;
- canary/source findings and loader baggage rejected;
- code/docs/ADR changes;
- commands and observed pass/fail/blocked/not-run results;
- before/after numeric medians and threshold findings;
- native fallback, cleanup, repair/update/uninstall evidence;
- remaining risks, unsupported platforms, and follow-up issues.

If no newer Firefox stable exists during implementation, execute this procedure
as a clearly labeled same-build rehearsal. Record the product-details check and
leave `real stable transition` as not run; never relabel beta/nightly or a
same-build reinstall as an actual stable transition.

## Incident record template

```markdown
# Firefox <old> to <new> compatibility record

## Environment
- Firefox old/new version, build ID, channel, tag/commit:
- Windows/hardware/display/power mode:
- profile/session state:
- Fennevia base/final commit and package version:

## Symptom and first causal evidence
- reproduction:
- first error/stack (redacted):
- stale-state and contamination checks:

## Sources checked
- Firefox definitions/callers/tests/blame/Bugzilla:
- four canary previous/current pins and relevant changes:
- loader-specific baggage rejected:

## Decision and minimum adaptation
- required/optional dependency changes:
- cleanup/fallback/security/privacy effects:

## Validation
- static/build/installer:
- cold/restart/windows/private:
- edges/layout/accessibility/native infrastructure:
- stress/failure/recovery:
- performance medians and thresholds:
- update/repair/disable/enable/uninstall/stock:

## Results and follow-up
- pass/fail/blocked/not run:
- remaining compatibility risk:
- real stable transition or rehearsal:
```
