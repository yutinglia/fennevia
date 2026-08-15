# Testing and Recovery

This document defines the **current** test and recovery contract for Fennevia.
Exact historical command output, first causal failures, and milestone-specific
Firefox evidence remain in `docs/research/`. Do not rewrite those records when a
later ADR supersedes their production architecture.

## 1. Current validated baseline

As of 2026-08-15:

- package: `0.6.0-dev`;
- Firefox: 153.0.4 release;
- build ID: `20260810162159`;
- first platform: Windows 11;
- environment: copied stock Firefox program plus marker-owned direct-path
  development profile;
- completed runtime/UI milestones: #3–#11 and #31;
- current shell: one zero-layout frame with independent top, left, right, and
  bottom surfaces;
- current functional feature: vertical tabs in the left surface;
- current placeholders: top, right, and bottom;
- native Firefox visible UI: retained and unchanged;
- production active state: not entered.

The #6 primary/sidebar/overlay host record and #11 horizontal-tab record remain
historical evidence. ADR-026 and #31 define the current four-edge geometry and
vertical presentation.

## 2. Always use the dedicated development environment

Do not develop or validate privileged browser chrome in a daily-use profile.

Follow `docs/development-setup.md`:

```powershell
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Initialize

pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Verify `
  -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe' `
  -RequireCleanEnvironment

pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Launch `
  -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe' `
  -Page about:support
```

The profile must:

- remain outside Firefox `profiles.ini`;
- contain the project ownership marker;
- contain no unrelated userChrome/userContent/loader;
- be disposable without touching another profile;
- permit Browser Console and Browser Toolbox use;
- be launched through explicit `--profile`, `--no-remote`, and
  `--new-instance`;
- use an explicitly selected copied Firefox program for package tests.

Before each real integration run, record:

- Firefox version, build ID, channel, and executable identity;
- OS version;
- profile type and clean/installed state;
- project commit;
- package version;
- test command;
- `pass`, `fail`, `blocked`, or `not run`.

Generate a redacted environment record with:

```powershell
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Environment `
  -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe'
```

`-RevealPaths` is local-only and its output must not be pasted into issues or
pull requests.

## 3. Repository and production-artifact gates

Use the exact Node.js and npm versions in `.nvmrc` and `package.json`.

```powershell
npm ci --ignore-scripts --no-fund
npm run dependencies:audit
npm run verify
```

`npm run verify` covers:

- Prettier check for configured source/build files;
- ESLint and the Firefox-boundary rules;
- Svelte/TypeScript checking;
- pure and component tests;
- resolved dependency audit;
- deterministic frontend and bridge builds;
- package-manifest synchronization;
- exact production artifact scanning.

Run the artifact gate directly when diagnosing package output:

```powershell
pwsh -NoProfile -File .\scripts\check-production-artifacts.ps1 `
  -ArtifactRoot .\profile\chrome\fennevia `
  -InventoryPath .\package-manifest.json
```

The current profile inventory contains exactly the eleven paths in
`package-manifest.json`. The gate rejects unplanned files/chunks, endpoints,
runtime networking APIs, HMR/dev-server markers, bare or dynamic imports, source
maps, development source, executable binaries, symlinks/junctions, and unsafe
paths.

A build must not leave a dirty generated-artifact or manifest diff unless that
change is intentional and reviewed. Never hand-edit generated bridge or shell
artifacts.

## 4. Minimum runtime matrix

| Case | Expected result |
| --- | --- |
| Three clean cold starts | One bootstrap and one process runtime per process |
| Ordinary restart | Fresh per-window frame, bridge, roots, and state; no stale callbacks |
| Second normal window | Independent complete frame and feature state; no duplicate process runtime |
| Private window | Full explicitly tested feature support or complete native fallback; never partial initialization |
| Close/reopen window | Hosts, roots, bridge contexts, listeners, observers, holds, timers, mappings, and pending work are removed |
| Runtime stop twice | First stop disposes; second is idempotent |
| Missing manifest | Clear bootstrap failure; native UI usable |
| Malformed manifest | Clear registration/entry failure; native UI usable |
| Missing/broken entry | Privacy-safe first causal stack; no partial runtime |
| Broken frontend bundle | No `healthy`/`active`; partial frame cleaned; native UI usable |
| Missing/invalid CSS | No activation; native UI usable |
| Missing bridge capability | Typed fixed-symbol failure and complete cleanup |
| Emergency fallback | Matching window's project lifecycle is disposed without Svelte |
| Safe start | Manifest lookup/import/mount skipped early |
| Browser Toolbox | Project ownership and native retention are inspectable |
| Install/update/disable/uninstall | Only owned files change; stock startup restored |
| Unsafe package target | Preflight rejects before mutation |
| Cleanup/reinstall | No owned residue, stale process, or unexplained cache action |

Every expected result requires evidence. A check mark without environment,
command, and observation is insufficient.

## 5. Current shell-frame and edge-controller matrix

Every shell or feature change that can affect #31 must verify:

### Ownership and mount

- exactly one `#fennevia-shell-frame-host` per managed browser window;
- exact top, left, right, and bottom host order;
- one XHTML mount target and one Svelte root per edge;
- all-or-nothing attach and rollback;
- project-owned style attached and parsed;
- project ownership stops at frame descendants;
- no Firefox-native node is moved, reparented, removed, or managed by Svelte;
- frame and hidden surfaces reserve no permanent browser-content geometry.

### Reveal state

For each edge:

- hidden default;
- pointer reveal from the matching narrow trigger;
- keyboard reveal command;
- focus hold;
- popup hold where supported;
- bounded programmatic hold where used;
- delayed hide after the last hold clears;
- rapid exit/re-entry;
- pointer leaving the Firefox window;
- `Escape` priority and dismissal;
- focus transfer into the surface;
- focus restoration to the prior valid target;
- disposal during a pending hide or hold.

### Corners and collisions

- top-left, top-right, bottom-left, and bottom-right ownership;
- deterministic pointer arbitration;
- rapid movement between adjacent edges;
- no accidental double reveal from a corner;
- legitimate simultaneous non-pointer holds;
- no overlap that makes a required control unreachable;
- narrow/short window fallback.

### Environment and accessibility

- normal, second-normal, and private windows;
- maximized, restored, resized, snapped, narrow, short, ultrawide, and high-DPI
  layouts where practical;
- browser fullscreen;
- DOM fullscreen suspension;
- customize-mode suspension;
- native modal/window-modal suspension;
- light and dark Firefox themes;
- very light, dark, saturated, patterned, and moving content behind surfaces;
- backdrop-filter unavailable or transparency reduced;
- `prefers-reduced-motion`;
- forced colors/high contrast;
- visible focus and meaningful accessible names/roles/states.

The frame may be pointer-active only at the documented edge triggers and visible
owned surfaces. The center content hit target must remain Firefox-owned.

## 6. Feature-specific matrices

### 6.1 Tabs and left surface — implemented

Validate:

- one tab, many tabs, and bounded vertical overflow;
- exact native order;
- selected, title, safe favicon/fallback, pinned, and loading state;
- native and custom select/new/close/pin/unpin used alternately;
- selected/background/last-tab close behavior;
- rapid event/action bursts;
- long, empty, emoji, markup-like, Unicode, and bidirectional titles;
- rejected/failed favicon;
- Up/Down, Home/End, Enter/Space, Delete, sibling pin/close controls;
- deterministic close-focus recovery;
- selected item remains reachable;
- direct frontend unmount/remount;
- stale/foreign ID rejection;
- bridge-capability failure;
- no title, URL, or favicon value in normal diagnostics;
- native tab strip remains visible and unchanged until #15.

Evidence:

- `docs/research/firefox-153-tabs-bridge.md`;
- `docs/research/firefox-153-tab-strip.md`;
- `docs/research/firefox-153-four-edge-shell.md`.

### 6.2 Top navigation — required for #12

Validate:

- Back/Forward state against native controls;
- Reload/Stop transitions;
- New Tab;
- selected-browser handoff;
- redirects, same-document navigation, error pages, and tab close;
- rapid command/tab-switch sequences;
- no action against the previous selected browser;
- current Firefox command/controller semantics;
- top-edge pointer/keyboard/focus/popup behavior;
- no editable address field in the top surface;
- native navbar/Urlbar/toolbox retained;
- navigation capability and surface failure.

### 6.3 Left address input — required for #13

Validate:

- ordinary URLs, host-like input, Unicode domains, and ordinary searches;
- empty, whitespace, malformed, unsupported, dangerous, and very long input;
- current Firefox fixup/search/principal/load semantics;
- independent unsubmitted draft;
- redirects, Back/Forward, reload, stop, tab switch, new tab, and session restore;
- repeated `Ctrl+L`, Enter, and two-stage Escape behavior;
- healthy-only custom `Ctrl+L` ownership;
- native `Ctrl+L` fallback while inactive, failed, safe-started, unsupported, or
  disposed;
- focus movement between address and tabs;
- no input/complete URL in normal diagnostics or project persistence;
- bridge/component/surface failure.

### 6.4 Right bookmarks — required for #14

Validate:

- empty roots and large bounded trees;
- root selection and nested folder expansion;
- lazy/bounded child loading;
- long/empty/Unicode/bidirectional titles;
- separator, malformed, stale, deleted, and missing-parent state;
- native create, rename, move, reorder, and remove while hidden/open;
- current-tab and supported new-tab opening;
- unsupported/special scheme policy;
- observer event bursts without continuous polling;
- keyboard traversal and focus stability during live changes;
- no bookmark title, URL, folder contents, or user-data identifier in normal
  logs/persistence;
- native Library, `Ctrl+D`, dialogs, and management paths retained;
- Places capability/query/observer/surface failure.

### 6.5 Bottom downloads — required for #32

Validate:

- one and multiple known-size downloads;
- mixed known/unknown sizes;
- zero-byte, very small, and very large items;
- active, paused/resumed through native UI, failed, canceled, and succeeded;
- starts/completions while hidden;
- rapid view/event bursts;
- determinate/indeterminate aggregate semantics;
- hidden updates without unsolicited reveal;
- accessible progress state;
- no filename, source URL, full path, private marker, or named byte count in
  normal diagnostics;
- native Downloads panel, notification, reputation, and safety UI retained;
- Downloads module/view/subscription/surface failure.

## 7. Native-UI activation matrix — required only for #15

No earlier issue may claim this gate.

Before activation, create a reviewed inventory for every hidden native selector
or capability with:

- current Firefox owner and source path;
- custom replacement;
- retained native access path;
- failure behavior;
- test evidence.

Validate:

- active rest shows only web content inside the browser client area;
- all four Fennevia surfaces remain hidden at rest;
- no custom or hidden native surface reserves permanent layout;
- top/left/right/bottom reveal independently;
- clearing `data-fennevia-active` restores native UI immediately without
  restart or Svelte;
- safe start prevents activation;
- emergency fallback works with no surface open and with each surface
  open/focused;
- missing entry, bundle, CSS, activation CSS, host, controller, command path,
  Places/Downloads callback, or bridge capability clears/prevents active state;
- native app menu and retained overflow paths;
- extension actions and installation prompts;
- bookmarks Library and management;
- Downloads management, notification, and safety;
- permission, authentication, certificate, file picker, notification, find bar,
  and dialog UI;
- browser fullscreen, DOM fullscreen, customize mode, DevTools, Browser Toolbox,
  and OS window controls;
- hard disable and uninstall from a broken active package.

Do not hide a broad parent when an uncovered descendant or action would become
unreachable.

## 8. Recovery design

### 8.1 Health and activation

The current per-window sequence is:

```text
created -> mounted -> healthy -> active
                 \-> failed
any live state -> disposed
```

Current package `0.6.0-dev` stops at `healthy`. The health phase requires:

- exact frame identity and placement;
- ordered top/left/right/bottom hosts;
- four XHTML mount targets;
- four frontend roots;
- attached parsed project CSS;
- edge reveal controller;
- environment/suspension handling;
- privileged emergency handler;
- every declared required capability;
- a literal successful health result before the finite deadline.

If any step fails:

1. remove or never set `data-fennevia-active`;
2. abort pending initialization;
3. unmount every created frontend root;
4. dispose bridge contexts and feature subscriptions;
5. clear edge holds and timers;
6. remove style and frame descendants;
7. report the privacy-safe first causal phase/stack;
8. leave core native Firefox UI unchanged.

### 8.2 Emergency fallback

The Windows binding is:

```text
Ctrl+Alt+Shift+F12
```

It is registered directly on the browser chrome window in the capture and
Mozilla system event groups. It must not depend on:

- Svelte;
- a component;
- application state;
- a feature bridge;
- project CSS;
- a visible custom control.

Triggering it clears active state first and disposes only that window's project
lifecycle.

### 8.3 Safe start

AutoConfig checks Firefox safe mode and:

```text
fennevia.safeStart = true
```

before `UChrm`, manifest registration, project URI resolution, or module import.
A broken runtime module therefore cannot prevent safe start.

Run the recovery wrapper:

```powershell
pwsh -NoProfile -File .\tests\firefox-shell-recovery.Tests.ps1 `
  -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe' `
  -ProfilePath '<FENNEVIA_DEV_PROFILE>'
```

When the preference is injected through `user.js`, Firefox persists it into the
profile preference store. Restore the original `user.js`, explicitly return the
preference to `false`, cold start, and verify no stale safe-start state remains.

### 8.4 Hard disable and uninstall

1. Close all Firefox and Browser Toolbox processes using the selected targets.
2. Preview `Disable` against explicit program/profile paths.
3. Run `Disable`; the AutoConfig preference is moved even when the runtime entry
   is broken.
4. Cold start and confirm native UI with no Fennevia startup record.
5. Preview and run ownership-manifest-based `Uninstall`.
6. Cold start stock Firefox and confirm no Fennevia record, manifest error, or
   owned residue.
7. Use startup-cache cleanup only when an observed stale-code symptom remains.

See `docs/installation.md` for exact commands and interrupted-operation recovery.

## 9. Diagnostic tools

### Browser Console

Use it for:

- AutoConfig and manifest registration;
- privileged import failures;
- process/window lifecycle;
- bridge capability and action failures;
- frontend registration/mount/unmount;
- edge-controller and feature failures;
- recovery and cleanup.

Normal records use stable prefixes:

```text
[Fennevia bootstrap]
[Fennevia runtime]
[Fennevia window]
[Fennevia bridge]
[Fennevia shell]
```

Do not log page titles, complete URLs, search/address text, bookmark contents,
download filenames/URLs/paths, profile paths, or private browsing data.

### Browser Toolbox

Use it to verify:

- exact frame and edge-host placement;
- XHTML namespace;
- project/native ownership boundary;
- root state attributes;
- hidden-at-rest geometry;
- trigger hit regions;
- focus and accessible roles/states;
- corner/collision behavior;
- computed glass and fallback styles;
- retained native UI;
- prompt/dialog/notification stacking;
- complete cleanup.

### Development-only failure injection

Installed production artifacts expose no preference or global that selects a
failure mode. Unit constructors and owned mutation wrappers may inject controlled
failure. Every wrapper must restore exact committed bytes in `finally` and
verify the restored hash.

Do not create a production `window.FenneviaDebug` dependency. A future read-only
development diagnostic API requires a separate review and must remain
privacy-safe and absent from production artifacts.

## 10. Failure-injection catalogue

Maintain controlled tests for:

- missing/malformed manifest;
- missing/throwing privileged entry;
- duplicate bootstrap;
- window initialization race/close;
- changed host insertion point;
- partial frame/edge host attach;
- missing top, left, right, or bottom target;
- frontend registration/mount/unmount failure;
- missing/invalid frame CSS;
- edge-controller construction/hold/timer/corner/disposal failure;
- health false and timeout;
- missing base bridge capability;
- missing tabs/navigation/address/Places/Downloads capability;
- malformed/stale/foreign snapshots and IDs;
- feature component failure;
- disposal during a pending hide, focus/popup hold, navigation event, address
  submission, Places query/observer callback, or Downloads callback;
- emergency fallback while Svelte is absent or visually broken.

Each case must produce a fixed privacy-safe first causal record, clean partial
work, and retain or restore native UI.

## 11. Profile reset and startup cache

Reset only the marker-owned disposable profile after every related Firefox and
Browser Toolbox process is closed:

```powershell
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Remove -WhatIf
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Remove -Force
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Initialize
```

The helper rejects broad paths, registered profiles, reparse points, missing
ownership markers, and active processes.

Do not clear Firefox startup cache routinely. First:

1. verify source/generated/package hashes;
2. verify the selected installed targets;
3. close all target processes;
4. reproduce one cold start;
5. restore or remove exact project files;
6. cold start again.

Only if stale behavior persists with verified files should the operator use
Firefox's **Clear startup cache** action in `about:support`, then record exact
before/after evidence.

Firefox 153.0.4 milestone tests did not require routine startup-cache clearing.

## 12. Real Firefox harnesses

The current integration harnesses include:

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

pwsh -NoProfile -File .\tests\firefox-bridge-recovery.Tests.ps1 `
  -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe' `
  -ProfilePath '<FENNEVIA_DEV_PROFILE>'

```

Use only harnesses that exist on the current branch. When a future issue adds a
feature-specific harness, document its exact target validation, mutation scope,
restoration path, and sensitive-output policy.

The Marionette `--remote-allow-system-access` flag is test-only and is not part
of the installed package.

## 13. Evidence index

| Milestone | Evidence |
| --- | --- |
| Development profile | `docs/development-setup.md` |
| Bootstrap | `docs/research/firefox-153-bootstrap.md` |
| Identity migration | `docs/research/fennevia-identity-migration.md` |
| Installer lifecycle | `docs/research/fennevia-installer-validation.md` |
| Window lifecycle | `docs/research/firefox-153-window-lifecycle.md` |
| Initial XHTML hosts | `docs/research/firefox-153-shell-hosts.md` |
| Health and recovery | `docs/research/firefox-153-shell-health-recovery.md` |
| Svelte build | `docs/research/firefox-153-svelte-build.md` |
| Firefox boundary | `docs/research/firefox-153-bridge-boundary.md` |
| Tabs bridge | `docs/research/firefox-153-tabs-bridge.md` |
| Tab UI | `docs/research/firefox-153-tab-strip.md` |
| Four-edge frame | `docs/research/firefox-153-four-edge-shell.md` |

Those records describe the exact milestone tested. Current production state is
summarized in README, the master plan, the shell roadmap, architecture, issue
#1, and the package manifest.

## 14. Result-reporting rules

For every matrix row, record one of:

- `pass`;
- `fail`;
- `blocked`;
- `not run`.

Include:

- environment and project commit;
- exact command/action;
- expected result;
- observed result;
- privacy-safe log or screenshot reference;
- cleanup/restoration result;
- known limitation.

Do not:

- convert “not run” into a check mark;
- infer real Firefox success from pure tests;
- claim a platform or Firefox version not tested;
- claim native-UI activation before #15;
- claim a feature placeholder is a completed feature;
- paste sensitive values into shared evidence.
