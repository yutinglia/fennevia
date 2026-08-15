# Testing and Recovery

## 1. Always use a dedicated development profile

Do not develop the browser shell in a daily-use profile.

The normative Windows procedure and tested commands are in `docs/development-setup.md`. The project helper creates a marker-owned direct-path profile and launches it with explicit `--profile`, `--no-remote`, and `--new-instance` arguments:

```powershell
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Initialize
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Verify -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe' -RequireCleanEnvironment
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Launch -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe' -Page about:support
```

The profile is intentionally not added to Firefox's `profiles.ini`. This prevents the helper from changing the default-profile selection and makes complete deletion independent of daily-use profile registration.

The development profile should:

- contain no unrelated userChrome, userContent, or custom loader;
- contain the minimum necessary extensions;
- be reproducible from a script or documented procedure;
- permit Browser Console and Browser Toolbox use;
- have an unambiguous name such as `fennevia-dev`;
- be disposable without affecting another profile.

Before each integration test, confirm the profile path, Firefox version, build ID, channel, executable, and project commit.

Generate the privacy-safe portion of that record with:

```powershell
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Environment -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe'
```

Normal output redacts the executable and profile paths. `-RevealPaths` is local-only and must not be pasted into issues or pull requests.

## 2. Minimum test matrix

| Case | Expected result |
|---|---|
| Clean cold start | Bootstrap and process runtime initialize exactly once |
| Browser restart | Shell reconstructs without stale behavior |
| Second normal window | One managed lifecycle per window with no duplicate process runtime; one shell per window after hosts exist |
| Private window | Full feature lifecycle according to policy or complete native fallback; never partial initialization |
| Close and reopen window | Hosts, listeners, observers, mappings, and roots are cleaned up |
| Missing manifest | Native Firefox UI works; clear bootstrap error |
| Malformed manifest | Native Firefox UI works; registration failure is clear |
| Missing or broken entry | Native Firefox UI works; complete phase and stack are logged |
| Broken frontend bundle | No active gate; native UI remains usable |
| Frontend mount throws | Partial hosts are cleaned up; native UI remains usable |
| Missing stylesheet | Shell does not activate and native UI is not permanently hidden |
| Missing bridge capability | Typed failure and fail-open behavior |
| Emergency fallback | Native UI becomes visible immediately without depending on Svelte |
| Safe start | Shell activation is skipped before native UI can be hidden |
| Fullscreen | Enter and exit remain operable |
| Customize mode | Native toolbox cannot become inaccessible or corrupt the layout |
| Browser Toolbox | Shell and retained native chrome remain inspectable |
| Install, update, uninstall | Only project-owned files are changed and stock startup is restored |
| Production artifact inventory | Exact files only; no remote endpoint, runtime network API, HMR, bare/dynamic import, source map, dev marker, unexpected chunk, or executable binary |
| Unsafe installer target | Preflight rejects before writes, backups, cache actions, or process changes |

Every recorded result must be `pass`, `fail`, `blocked`, or `not run`, with evidence. A check mark alone is not sufficient.

## 3. Recovery design

### Health and activation gate

Native-UI hiding must depend on `data-fennevia-active`. Set it only after all required steps succeed:

1. process runtime initialized;
2. window accepted by lifecycle policy;
3. hosts created;
4. bridge capabilities validated;
5. frontend mounted;
6. stylesheet and critical UI health checks passed;
7. emergency handler registered;
8. safe-start state checked.

Issue #7 implements the per-window sequence as `created -> mounted -> healthy ->
active`, plus `failed` and `disposed`. The root carries
`data-fennevia-state` and cumulative state-specific markers. An illegal
transition enters `failed`; disposal removes every marker. The production
initializer deliberately stops at `healthy`, and package `0.4.0-dev` contains
no native-hide selector or automatic activation call. The current
`0.5.0-dev` frontend package preserves the same inactive gate.

The health phase has a 2,000 ms deadline. It requires exact host identity,
placement, XHTML ownership, parsed project CSS, hidden/inert auxiliary hosts,
the emergency listener, declared capabilities, and a literal `true` result.

If any step fails:

- do not set, or immediately remove, the active attribute;
- attempt to unmount and remove project-owned UI;
- dispose partial listeners and mappings;
- log the phase and complete stack with privacy-safe context;
- do not remove or mutate core native UI.

### Emergency fallback

Provide a privileged keyboard handler that does not depend on a Svelte component, store, CSS animation, or bridge feature. It must immediately clear the active gate and reveal native UI.

Choose a binding that does not conflict with common Firefox or OS shortcuts. Document and test it on every supported platform.

The Windows binding is `Ctrl+Alt+Shift+F12`. It is registered on the browser
chrome window for `keydown` with `{ capture: true, mozSystemGroup: true }`,
requires exactly Ctrl/Alt/Shift without Meta, and is removed with the identical
listener/options pair. Stock Firefox reserves unmodified F12 for DevTools; a
user-customized shortcut can still collide, so other platforms and customized
bindings require new evidence. Triggering fallback reports a fixed phase/code,
clears active state, and disposes only that window's project lifecycle.

### Safe start

Select at least one mechanism that can be evaluated before shell activation:

- a preference such as `fennevia.safeStart=true`;
- a sentinel file in the project profile package;
- another source-validated early mechanism.

Safe start may load minimal logging needed for diagnosis, but it must not mount or activate the custom shell.

Fennevia uses the existing preference mechanism. AutoConfig checks Firefox safe
mode and `fennevia.safeStart` before `UChrm`, registration, URI resolution, or
module import. The owned-profile recovery matrix is:

```powershell
pwsh -NoProfile -File .\tests\firefox-shell-recovery.Tests.ps1 `
  -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe' `
  -ProfilePath '<FENNEVIA_DEV_PROFILE>'
```

The script refuses a pre-existing `user.js` policy for this preference. It tests
safe start once with all files and once with a hash-verified runtime module
moved to a unique OS-temporary directory, restores that module byte-identically,
runs ordinary startup with `false`, restores the original `user.js`, and ensures
the persisted preference ends false.

### Hard disable and uninstall

The package helper provides a recovery procedure that does not require deleting
the entire profile:

1. Close Firefox.
2. Preview and run `scripts/fennevia-package.ps1 Disable` against the explicit
   program and profile targets. This moves the owned AutoConfig preference even
   when the manifest or runtime entry is missing.
3. Restart Firefox and confirm that native UI appears and Browser Console
   contains no Fennevia startup record.
4. Preview and run the ownership-manifest-based `Uninstall` action.
5. Cold-start stock Firefox and confirm no Fennevia record or manifest error.
6. Apply startup-cache cleanup only if an observed stale-code symptom remains.

Exact commands, ownership rules, and interrupted-operation recovery are in
`docs/installation.md`.

## 4. Diagnostic tools

### Browser Console

Use for AutoConfig, registration, module import, lifecycle, bridge, and frontend exceptions. Logs should have stable prefixes such as:

```text
[Fennevia bootstrap]
[Fennevia runtime]
[Fennevia window]
[Fennevia bridge]
[Fennevia shell]
```

Normal logs must follow the privacy policy and avoid complete browsing data.

### Browser Toolbox

Use it to:

- inspect host namespace and placement;
- inspect health attributes and computed style;
- verify that native UI still exists;
- find duplicate hosts or retained listeners;
- manually clear the active attribute as a recovery step;
- inspect focus, fullscreen, customize-mode, and popup behavior.

### Development diagnostic API

A later runtime may expose a read-only local debug object such as:

```text
window.FenneviaDebug
```

It must be development-only, must not expose sensitive browsing state, and must never become a production UI dependency.

## 5. Failure-injection policy

Development builds should provide controlled ways to simulate:

- missing manifest;
- failed module import;
- host creation failure;
- missing required capability;
- frontend mount exception;
- missing CSS;
- health-check timeout;
- disposer called twice;
- stale tab or window handle.

Failure injection must be impossible or explicitly disabled in installed production artifacts unless a documented local diagnostic mode is enabled.

Issue #7 does not add a production diagnostic mode. Mount, health, capability,
and timeout failures are passed as ordinary collaborators only to the exported
unit-test constructor. `initializeWindowShell`, the sole production consumer,
uses fixed defaults. Static checks reject a failure/debug preference or global
selector in the installed health runtime.

## 6. Phase 0 profile reset and cache evidence

Preview and perform a complete disposable-profile reset only after all managed Firefox and Browser Toolbox processes are closed:

```powershell
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Remove -WhatIf
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Remove -Force
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Initialize
```

Deletion is restricted to the dedicated managed root and requires the valid project marker. A missing marker, registered Firefox profile, broad path, or active process is a hard refusal.

Do not clear Firefox's startup cache routinely. First record a causal startup or stale-artifact symptom. If evidence still indicates startup-cache state after source artifacts and the active profile are verified, use Firefox's **Clear startup cache** action in `about:support`, restart, and record the before-and-after result. Phase 0 observed no project AutoConfig declaration and did not require cache clearing. The Phase 1 evidence below confirms that entry replacement and complete project-file removal also took effect without it on Firefox 153.0.4.

## 7. Phase 1 bootstrap evidence

The minimal startup chain was first validated under the provisional identity on
2026-08-14 with Firefox 153.0.4 release, build ID `20260810162159`, source stamp
`54be19de0e08edff0b797e55fd935dd3978b0a6d`, on Windows 11 25H2. The exact
historical literals remain in `docs/research/firefox-153-bootstrap.md`. The
current Fennevia paths shown below were revalidated on the same Firefox build on
2026-08-15; the identity-specific matrix is in
`docs/research/fennevia-identity-migration.md`.

Both runs used a project-owned copy of the stock Firefox program under a
marker-owned local test root and a separate marker-owned direct-path profile.
No system Firefox files, registered profiles, or daily-use profiles were
modified.

The installed test layout was:

```text
<FIREFOX_PROGRAM_COPY>/
  defaults/pref/fennevia.js
  fennevia.cfg

<FENNEVIA_DEV_PROFILE>/chrome/fennevia/
  chrome.manifest
  content/Bootstrap.sys.mjs
```

Static and syntax checks:

```powershell
pwsh -NoProfile -File .\tests\bootstrap-spike.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\bootstrap-spike.Tests.ps1
Get-Content -Raw .\program\fennevia.cfg | node --check -
node --check .\profile\chrome\fennevia\content\Bootstrap.sys.mjs
node --check .\tests\bootstrap-content-access.mjs
```

The ordinary-content probe uses only Node's standard library, binds an ephemeral `127.0.0.1` port, requires explicit absolute Firefox/profile/screenshot paths, and refuses to overwrite a screenshot:

```powershell
node .\tests\bootstrap-content-access.mjs `
  --firefox '<FIREFOX_PROGRAM_COPY>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>' `
  --screenshot '<NEW_LOCAL_SCREENSHOT_PATH>'
```

Observed real-Firefox matrix:

| Case | Browser Console or page result | Native/recovery result |
|---|---|---|
| Three cold starts | Exactly one `bootstrap.success` per process; `initializationCount=1` | Native `about:support` window present each time |
| Second normal window | One process success record | Two native Firefox windows; no second process initialization |
| Private window | One process success record | Native Firefox private-browsing window present |
| Missing manifest | `bootstrap.fatal`, phase `manifest-locate`, complete redacted stack | Native Firefox window present |
| Malformed manifest | `bootstrap.fatal`, phase `entry-resolve`, `NS_ERROR_FILE_NOT_FOUND` | Native Firefox window present |
| Incorrect entry URI | `bootstrap.fatal`, phase `entry-import`, fixed project URI identified | Native Firefox window present |
| Entry syntax error | `bootstrap.fatal`, phase `entry-import`, `SyntaxError` | Native Firefox window present |
| Duplicate cfg evaluation | One success plus one `bootstrap.duplicate`; no fatal record | Second evaluation skipped with prior result `ready` |
| `fennevia.safeStart=true` | One `bootstrap.skipped`; no registration or import | Native Firefox window present |
| Ordinary HTTP content fetch | Probe reported `blocked`; screenshot displayed the PASS state | No `contentaccessible=yes`; no resource alias |
| Corrected entry after syntax failure | Success on the immediately following cold start | No startup-cache clearing performed |
| AutoConfig pref, cfg, and package removed | Zero project records in a new Browser Console | Stock native startup; no residual project error |

When safe start is injected through `user.js`, Firefox copies that value into the profile preference store. Restoring `user.js` alone is not a reset. The test must explicitly set `fennevia.safeStart=false`, complete a cold start, restore the original `user.js`, and confirm that the final bootstrap succeeds and no stale `true` value remains in `prefs.js`.

Fatal records use the `[Fennevia bootstrap]` prefix and include `event`, `phase`, stable `code`, context, safe error name/message, full stack array, Firefox version, and build ID. Remote URLs, file URLs, Windows paths, opaque URLs, and control characters are redacted or removed. They do not include browsing URLs, page titles, search text, profile paths, or private-window state.

The validated cache procedure is evidence-first:

1. Close every process using the test profile.
2. Verify or restore the exact cfg, manifest, and entry from source, then cold start again.
3. If disabling, remove only the project AutoConfig preference file, cfg file, and project-owned profile package, then cold start and confirm zero project records.
4. Do not clear startup cache for ordinary source replacement or removal on the validated build; neither recovery test required it.
5. Only if an actual stale artifact remains after file and profile verification, use Firefox's **Clear startup cache** action in `about:support`, restart, and record the before/after evidence.

The detailed upstream research and exact canary revisions are in
`docs/research/firefox-153-bootstrap.md`. The 2026-08-15 regression additionally
confirmed three cold starts, safe start and reset, missing-manifest fail-open and
immediate recovery, ordinary-content denial, second and private windows,
graceful cleanup, and complete Fennevia-file removal without clearing startup
cache.

## 8. Phase 1 package-lifecycle evidence

Issue #4 stabilized the package at `program/`, `profile/chrome/fennevia/`, and
`package-manifest.json`, then validated `scripts/fennevia-package.ps1` on the
same copied Firefox 153.0.4 program and marker-owned development profile used by
the identity regression. No system Firefox or registered/daily-use profile was
modified.

Automated installer tests passed in PowerShell 7 and Windows PowerShell 5.1.
They cover unsafe targets, reparse points, path traversal, unknown collisions,
redacted dry run, ownership and hash conflicts, changing/stale package updates,
missing files, unrelated profile content, staging permission denial,
interrupted-transaction rejection, and injected partial-failure rollback:

```powershell
pwsh -NoProfile -File .\tests\installer.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\installer.Tests.ps1
```

Observed real-Firefox results:

| Case | Result |
|---|---|
| Install preview | 10 exact operations; program/profile tree fingerprint unchanged |
| Install and repeat | Preview/result plan digests matched; 10 applied mutations, exact hashes, byte-identical ownership pair, no transaction residue; repeat was a zero-operation no-op |
| Three cold starts | Exactly one success per process and zero Fennevia fatal records |
| Second and private windows | Two native normal windows or one native private window remained usable; no duplicate initialization |
| Same-package update | `already-current`, zero operations |
| Disable and enable | Disabled cold start had zero Fennevia records; enable restored one success on the next cold start |
| Missing runtime entry | Hard disable still completed; disabled cold start had native UI and zero Fennevia/manifest/uncaught records |
| Uninstall preview | 9 exact operations because the entry was already missing; tree fingerprint unchanged |
| Uninstall and repeat | All remaining owned files/metadata removed, development marker and parents retained, no transaction residue; repeat was a zero-operation no-op |
| Final stock cold start | Native UI present; zero Fennevia records, manifest errors, uncaught, or unhandled signals |
| Final state | Clean-environment verification passed; no Firefox process remained |

All GUI processes exited through Firefox's graceful quit API. Startup cache was
not cleared at any point; each state transition appeared on the immediately
following cold start. One Firefox-owned missing Crash Reports directory message
was observed as an unrelated baseline and was not suppressed by mutating that
non-project directory.

The exact environment, operation counts, security review, and complete matrix
are in `docs/research/fennevia-installer-validation.md`. The operator and
interrupted-operation recovery contract is in `docs/installation.md`.

## 9. Phase 2 browser-window lifecycle evidence

Issue #5 added the process singleton, strict browser-window manager,
abort-first per-window cleanup, and privacy-safe runtime logger without adding
hosts or changing native UI. The implementation record, pinned source/canary
research, and exact limitations are in
`docs/research/firefox-153-window-lifecycle.md`.

Automated tests passed under Node.js 24.18.0, PowerShell 7.6.4, and Windows
PowerShell 5.1:

```powershell
node --test .\tests\window-lifecycle.test.mjs
pwsh -NoProfile -File .\tests\window-lifecycle.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\window-lifecycle.Tests.ps1
pwsh -NoProfile -File .\tests\bootstrap-spike.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\bootstrap-spike.Tests.ps1
pwsh -NoProfile -File .\scripts\check-production-artifacts.ps1 `
  -ArtifactRoot .\profile\chrome\fennevia `
  -InventoryPath .\package-manifest.json
```

The Node suite has nine tests. It covers existing and later windows,
normal/private classification, exact Browser Toolbox URI and dialog/non-main
filtering, duplicate notifications, async-close cancellation and late disposal,
cleanup exceptions, manager-start rollback, idempotent runtime shutdown,
singleton failure state, and hostile logging values.

The package was installed as `0.2.0-dev` into only the copied Firefox program
and marker-owned profile. Preview and execution shared one plan digest and
applied 14 exact creates. A same-package update preview later returned
`already-current` with zero mutations and no startup-cache action.

Six complete real-Firefox probes passed in separate Firefox 153.0.4 processes,
including a final run against the packaged logger hash recorded in the manifest:

```powershell
node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>'
```

| Case | Observed result |
|---|---|
| Initial normal window | Runtime `started`, `initializationCount=1`, managed count one |
| Additional tab | Managed count unchanged; no extra window initialization |
| Second normal window | One normal initialization and one disposal on close |
| Private window | One private initialization and one disposal on close |
| Runtime stop twice | First stop disposed the remaining window; second returned the identical stopped state |
| New normal window after stop | Managed count remained zero; no callback or initialization record |
| Native UI | `browser.xhtml`, `html#main-window`, and `#navigator-toolbox` remained; no active Fennevia UI gate existed |
| Diagnostics | One process bootstrap/runtime start, no Fennevia error-level record, and no first-party Fennevia script error |
| Exit | Firefox graceful quit; zero remaining test Firefox processes |

The real probe starts Firefox with `--remote-allow-system-access` solely so
Marionette can inspect the parent-process chrome context. The script first
validates explicit copied-program and marker-owned-profile paths and never
prints them. This flag is not part of the installed package.

Failure injection used:

```powershell
pwsh -NoProfile -File .\tests\firefox-fail-open.Tests.ps1 `
  -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe' `
  -ProfilePath '<FENNEVIA_DEV_PROFILE>'
```

The script moved only the hash-verified installed `WindowManager.sys.mjs` into
a unique OS-temporary directory, restored it in `finally`, and verified the
restored SHA-256. The missing module produced one caught `bootstrap.fatal` at
`entry-import`; native browser UI remained usable and the runtime did not
partially start. The immediately following cold start passed without clearing
startup cache.

Final uninstall preview and execution used the same plan digest, backed up the
nine ownership-proven files, and applied 14 exact file/directory operations.
The stock-start probe reported native UI, zero Fennevia records, and zero owned
residue. A repeat uninstall was `not-installed` with zero mutations; no Firefox
process remained and startup cache was never cleared.

For issue #5, the Browser Toolbox's exact Firefox 153 URI and dialog/non-main
identities were covered by the strict-filter unit suite, but its separately
spawned GUI was intentionally deferred until the first browser-chrome DOM in
issue #6. The following record completes that deferred check.

### Issue #6 isolated XHTML host evidence

Issue #6 adds a visible diagnostic primary host plus hidden sidebar and overlay
hosts without hiding native UI or adding Svelte. The complete source, canary,
stock-DOM, placement, Browser Toolbox, privacy, and failure evidence is in
`docs/research/firefox-153-shell-hosts.md`.

The local suites passed:

```powershell
node --test .\tests\shell-hosts.test.mjs .\tests\window-lifecycle.test.mjs
pwsh -NoProfile -File .\tests\shell-hosts.Tests.ps1
pwsh -NoProfile -File .\tests\window-lifecycle.Tests.ps1
pwsh -NoProfile -File .\tests\bootstrap-spike.Tests.ps1
pwsh -NoProfile -File .\tests\production-artifacts.Tests.ps1
pwsh -NoProfile -File .\tests\installer.Tests.ps1
pwsh -NoProfile -File .\scripts\check-production-artifacts.ps1 `
  -ArtifactRoot .\profile\chrome\fennevia `
  -InventoryPath .\package-manifest.json
```

The seven shell tests plus nine lifecycle tests cover exact XHTML descendants,
all host transitions, duplicate/collision behavior, partial rollback,
normal/private separation, hostile diagnostic metadata, lifecycle races, and
privacy-safe logging. Package `0.3.0-dev` has six exact profile artifacts; the
clean real install applied 15 planned operations with matching plan digest and
no startup-cache action.

The copied Firefox matrix passed in separate cold processes:

```powershell
node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>'

node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>' `
  --browser-toolbox
```

| Case | Observed result |
|---|---|
| Initial, second, private windows | Each received one independent complete three-host set; every project element was XHTML |
| Visible diagnostic | At least 30 CSS pixels high between toolbox and browser; fixed non-sensitive text only |
| Native UI | Toolbox, browser, tabbox, sidebar siblings, modal top layer, content hit target, and Windows close command remained available |
| Overlay/sidebar | Hidden; overlay also inert and pointer-transparent |
| Window close/runtime stop | Exact hosts removed; repeated stop unchanged; post-stop window received no host |
| Changed insertion point | Real tabbox ID was temporarily changed and restored; no partial host remained; one expected error contained fixed DOM path, Firefox version, and build ID |
| Browser Toolbox | Prompt remained enabled and was accepted; Inspector selected the primary host and walker proved native nodes were outside every project host |
| Toolbox cleanup | Child profile hash restored byte-identically; temporary prefs, marker, backup, port, and processes removed |
| Browser Console | No unexpected first-party exception or error record; only the deliberate fail-open record appeared |
| Uninstall/stock/reinstall | Uninstall backed up ten owned files and applied 15 operations; stock startup had zero project record/residue; clean reinstall applied 15 operations |

The Browser Toolbox test follows Mozilla's CC0 test-server interaction pattern.
It serializes `prompt-connection=false` only into the temporary child test
profile, restores the parent pref to true before creating the parent DevTools
server, and explicitly accepts that parent connection prompt. The original
child profile bytes and parent prefs are restored after the child process exits.

### Issue #7 shell-health and recovery evidence

Issue #7 wraps the issue #6 hosts in the explicit health lifecycle without
adding Svelte, a bridge, dependency, manifest mapping, native-hide CSS, or a
production failure hook. Source, canary, keyboard, privacy, and real recovery
evidence is in `docs/research/firefox-153-shell-health-recovery.md`.

The local matrix is run with:

```powershell
node --test .\tests\health-state.test.mjs .\tests\safe-start.test.mjs `
  .\tests\shell-hosts.test.mjs .\tests\window-lifecycle.test.mjs
pwsh -NoProfile -File .\tests\shell-health.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\shell-health.Tests.ps1
pwsh -NoProfile -File .\tests\shell-hosts.Tests.ps1
pwsh -NoProfile -File .\tests\window-lifecycle.Tests.ps1
pwsh -NoProfile -File .\tests\bootstrap-spike.Tests.ps1
pwsh -NoProfile -File .\tests\production-artifacts.Tests.ps1
pwsh -NoProfile -File .\tests\installer.Tests.ps1
pwsh -NoProfile -File .\scripts\check-production-artifacts.ps1 `
  -ArtifactRoot .\profile\chrome\fennevia `
  -InventoryPath .\package-manifest.json
```

The unit matrix covers cumulative and duplicate states, illegal transitions,
stale attributes, literal health results, timeout/abort, partial mount cleanup,
health false, missing CSS, missing capability, pending disposal with late
completion, active-only-after-healthy, and emergency fallback from mounted,
healthy, and active. The safe-start VM executes the actual cfg with complete
and broken entry behavior. Package `0.4.0-dev` has seven exact profile
artifacts.

Observed on Node.js 24.18.0, PowerShell 7.6.4, and Windows PowerShell
5.1.26100.9168: the combined shell-health command reported 32 passing tests;
the shell-host command reported 26; the lifecycle command reported nine. Both
PowerShell runtimes passed the bootstrap, development-profile, artifact,
identity, shell-host, shell-health, lifecycle, and installer suites. The exact
seven-artifact production scan passed with no finding.

Real Windows validation uses the ordinary harness plus the owned mutation
wrapper shown above. The harness verifies healthy-but-inactive markers on the
initial, second, and private windows; sends a native US-layout Windows F12 event
with left Shift/Control/Alt through `nsIDOMWindowUtils`; requires only that
window's hosts/state to disappear while native browser/toolbox remain; and then
proves the original window is still healthy. Safe-start runs require exactly one
`bootstrap.skipped`, no registration/runtime/window/shell record, no host/state,
and no first-party script error for both the complete and broken package.

Both ordinary real-Firefox runs passed, including the Browser Toolbox variant.
The Inspector selected the primary host and reconfirmed that native nodes remain
outside project ownership. The recovery wrapper passed two safe-start processes
and one ordinary recovery process, restored the missing module to its committed
SHA-256, restored the original `user.js`, disabled the persisted safe-start
value, and left zero Firefox process. No startup-cache action was used.

## 10. Phase 3 frontend-build evidence

Issue #8 replaces the diagnostic mount collaborator with a generated Svelte 5
smoke island while retaining the issue #7 lifecycle and inactive native UI.
Architecture, source, dependency, and first-error analysis is in
`docs/research/firefox-153-svelte-build.md`; the accepted resolved graph is in
`docs/dependency-reviews/frontend-toolchain-2026-08-15.md`.

The final static matrix is run with:

```powershell
npm ci --ignore-scripts --no-fund
npm run verify
pwsh -NoProfile -File .\tests\bootstrap-spike.Tests.ps1
pwsh -NoProfile -File .\tests\firefox-dev-profile.Tests.ps1
pwsh -NoProfile -File .\tests\production-artifacts.Tests.ps1
pwsh -NoProfile -File .\tests\project-identity.Tests.ps1
pwsh -NoProfile -File .\tests\shell-hosts.Tests.ps1
pwsh -NoProfile -File .\tests\shell-health.Tests.ps1
pwsh -NoProfile -File .\tests\window-lifecycle.Tests.ps1
pwsh -NoProfile -File .\tests\installer.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\production-artifacts.Tests.ps1
```

The clean npm graph contains 173 lock paths and installs 148 on Windows with
scripts disabled. The build runs twice and reproduces these exact generated
artifacts before synchronizing package `0.5.0-dev`:

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `content/shell/ShellApp.js` | 35,837 | `92338b310d522ede99955d214aae3faa5c71194cb798c10dcd2a97c8304e3da3` |
| `content/shell/ShellStyles.sys.mjs` | 3,542 | `2a80d21a31bb541aca31ee4713a75087537ad42b7b0de3a375806823da3c842a` |
| `content/shell/THIRD_PARTY_NOTICES.txt` | 1,200 | `0cd8b75a5e96e98009ec60de17b5536ef15d00f1b4f469a0c7189a30681ac7ea` |

The Node matrix reports 46 passing tests. Both PowerShell runtimes pass the
applicable repository suites, and the exact ten-profile-artifact scan reports
no finding. The generated IIFE has no bare/dynamic import, runtime endpoint,
HMR/dev-server marker, source map, extra chunk, debug statement, or executable
payload. The initial Windows GitHub Actions workflow repeats the clean install,
format, lint, Svelte/TypeScript, unit, dependency, deterministic build,
clean-tree, scanner, and Windows PowerShell 5.1 artifact gates.
`act -l` lists that job, but the available Docker daemon is Linux and cannot
faithfully execute the `windows-latest`/Windows PowerShell 5.1 runner. No local
`act` success is claimed; direct local commands and GitHub-hosted Actions remain
the respective precheck and merge evidence.

Real Firefox commands are:

```powershell
node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>'
node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>' `
  --browser-toolbox
pwsh -NoProfile -File .\tests\firefox-frontend-recovery.Tests.ps1 `
  -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe' `
  -ProfilePath '<FENNEVIA_DEV_PROFILE>'
```

Initial, second, and private windows mounted independent healthy-but-inactive
Svelte roots. Counter, input, events, conditional rendering, XHTML descendants,
an XHTML `HTMLTemplateElement.content` child, and the extracted CSS sheet passed.
Emergency fallback on the second window removed its hosts only. Direct official
unmount left zero descendants, balanced delegated listener removal, disconnected
the old root, made its detached control inert, and remounted with fresh state.
Browser Toolbox selected the project host and confirmed the ownership boundary;
toggling the component stylesheet left sampled native toolbox, sidebar, popup,
Urlbar, menu-button, and modal styles unchanged.

The owned mutation wrapper separately removed `ShellApp.js` and installed a
bundle that throws. Both cases failed open in each window, retained native UI,
and emitted fixed frontend phases/codes without browsing values. It then
restored exact bytes, ran the ordinary matrix, and left zero Firefox process.
No startup-cache action or native-hide rule was used.

## 11. Firefox stable-update procedure

For every stable update:

1. Record the last passing Firefox build and project commit.
2. Test the new build with a clean clone and development profile.
3. Start in smoke or safe-start mode before enabling native-UI hiding.
4. Run the minimum test matrix.
5. On failure, follow `docs/research-playbook.md`.
6. Update the internal dependency inventory and source references.
7. Re-enable active mode only after recovery tests pass.
8. Leave a compatibility record in an issue and move durable conclusions into documentation.

Never claim compatibility from version-number inspection alone.

## 12. Automation boundary

Suitable for automation:

- formatting, linting, typechecking, and unit tests;
- deterministic builds and artifact sanity checks;
- manifest, schema, and import-boundary checks;
- pure bridge mapping and state-reducer tests;
- install-layout and owned-file validation;
- checks for HMR, CDN, remote fonts, unexpected fetches, bare imports, and unexpected chunks.

The Phase 0.5 artifact baseline is exercised in both PowerShell runtimes with:

```powershell
pwsh -NoProfile -File .\tests\production-artifacts.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\production-artifacts.Tests.ps1
```

Issue #8 commits the real generated inventory and runs
`scripts/check-production-artifacts.ps1` against the complete installed profile
tree in both local verification and CI. Fixture tests remain necessary policy
coverage but do not substitute for that production scan or real Firefox smoke
tests.

Likely to require real Firefox smoke testing:

- AutoConfig startup;
- browser-chrome layout and namespaces;
- private and second-window lifecycle;
- native dialogs, fullscreen, customize mode, and Browser Toolbox;
- failure recovery after an installed artifact breaks.

Maintain repeatable manual procedures until reliable Firefox automation is proven. Fragile automation must not replace real evidence.
