# Testing and Recovery

This document defines the **current** test and recovery contract for Fennevia.
Exact historical command output, first causal failures, and milestone-specific
Firefox evidence remain in `docs/research/`. Do not rewrite those records when a
later ADR supersedes their production architecture.

## Rapid-development vs release testing

The project is currently under rapid development. Ordinary implementation,
review, and documentation work uses the Windows CI job in
`.github/workflows/ci.yml` as the required gate: formatting, lint, typecheck,
unit tests with 80% line and function coverage floors on loaded `src/app` and
`src/firefox` modules, fixed-list static PowerShell suites, dependency audit,
deterministic build, committed generated artifacts, and the production-artifact
scan. Locally, `npm run verify` is the CI-equivalent command. Do not add tests
whose only purpose is to satisfy the coverage floor.

The matrices in sections 4–7 and 12, plus the real Firefox harnesses, are the
**release mass-test contract**. They prove a tagged package. They are not a
per-pull-request Definition of Done during rapid development unless the project
owner asks for them or the change is a release. Record unrun mass-matrix rows as
`not run`. Do not imply they passed because CI passed.

Safety, privacy, fail-open, and native-UI ownership rules remain in force.
Updating or relaxing them requires explicit project-owner approval. See
ADR-039.

## 1. Current validated baseline

As of 2026-08-16:

- package: public `0.10.0-beta.1` prerelease;
- Firefox: 153.0.4 release;
- build ID: `20260810162159`;
- first platform: Windows 11;
- environment: copied stock Firefox program plus marker-owned direct-path
  development profile;
- completed runtime/UI/distribution milestones: #3–#18, #31, #32, #37, #39,
  and #46;
- current shell: one zero-layout frame with independent top, left, right, and
  bottom surfaces plus one centered address-overlay root;
- current functional features: vertical tabs and compact address/status
  launcher in the left surface, centered address/search popup, primary
  navigation controls with bounded page status in the top surface, bounded lazy
  bookmarks in the right surface, and anonymous aggregate download status in
  the bottom surface; the centered popup also includes fixed Urlbar permission/
  action coverage and complete native handoff;
- current placeholders: none inside the five product surfaces;
- native Firefox visible UI: exact ADR-032 toolbar/sidebar descendants collapse
  only at active rest; the complete native DOM and transient reveal path remain;
- production active state: entered only after health, with safe start,
  suspension, emergency fallback, and per-window cleanup validated.

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
npm run test:powershell
npm run verify
```

`npm run verify` covers:

- Prettier check for configured source/build files;
- ESLint and the Firefox-boundary rules;
- Svelte/TypeScript checking;
- pure and component tests plus Node coverage floors (80% lines and 80%
  functions on loaded `src/app` and `src/firefox` modules);
- the fixed-list PowerShell bootstrap/profile/installer/release/artifact/
  identity/health/host/lifecycle suites;
- resolved dependency audit;
- deterministic frontend and bridge builds;
- package-manifest synchronization;
- exact production artifact scanning.

This command set is the ordinary development gate. During rapid development,
making CI pass is sufficient. Do not expand it into the real Firefox matrices
below unless the change is a release.

Run the artifact gate directly when diagnosing package output:

```powershell
pwsh -NoProfile -File .\scripts\check-production-artifacts.ps1 `
  -ArtifactRoot .\profile\chrome\fennevia `
  -InventoryPath .\package-manifest.json
```

The current profile inventory contains exactly the 12 paths in
`package-manifest.json`. The gate rejects unplanned files/chunks, endpoints,
runtime networking APIs, HMR/dev-server markers, bare or dynamic imports, source
maps, development source, executable binaries, symlinks/junctions, and unsafe
paths.

A build must not leave a dirty generated-artifact or manifest diff unless that
change is intentional and reviewed. Never hand-edit generated bridge or shell
files.

Release packaging has additional fixed-list coverage in
`release-packaging.Tests.ps1` and `release-installer.Tests.ps1`. Both run under
PowerShell 7 and Windows PowerShell 5.1. They require two byte-identical ZIPs,
fixed/sorted entries, a strict extracted tree from a Unicode/space path,
checksum and source records, tamper rejection, explicit registered-profile
mode, exact supported Firefox version/BuildID, pre-mutation rejection, and
disable/uninstall recovery after an unsupported Firefox update. Before a tag,
also run the clean-tree preflight and a real Firefox install/no-op/disable/
repair-or-update/enable/uninstall smoke test from the extracted ZIP.

The release-specific real recovery wrapper injects a missing ownership-proven
frontend bundle only below the marker-owned test profile, hard-disables the
package, restores the exact file through release Update while preserving
disabled state, verifies a native-only cold start, enables, and reruns the full
lifecycle matrix. Its `finally` restores exact bytes/enabled state and removes
its bounded temporary backup:

```powershell
pwsh -NoProfile -File .\tests\firefox-release-recovery.ps1 `
  -FirefoxPath '<COPIED_FIREFOX_PROGRAM>\firefox.exe' `
  -ProfilePath '<FENNEVIA_DEV_PROFILE>' `
  -PackageRoot '<EXTRACTED_RELEASE_ROOT>'
```

## 4. Minimum runtime matrix

| Case                             | Expected result                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Three clean cold starts          | One bootstrap and one process runtime per process                                                          |
| Ordinary restart                 | Fresh per-window frame, bridge, roots, and state; no stale callbacks                                       |
| Second normal window             | Independent complete frame and feature state; no duplicate process runtime                                 |
| Private window                   | Full explicitly tested feature support or complete native fallback; never partial initialization           |
| Close/reopen window              | Hosts, roots, bridge contexts, listeners, observers, holds, timers, mappings, and pending work are removed |
| Persisted session rehearsal      | A new process restores fixed native/frontend order, selected/pinned/lazy state; fail-open remains usable; cleanup restores the blank baseline |
| Runtime stop twice               | First stop disposes; second is idempotent                                                                  |
| Missing manifest                 | Clear bootstrap failure; native UI usable                                                                  |
| Malformed manifest               | Clear registration/entry failure; native UI usable                                                         |
| Missing/broken entry             | Privacy-safe first causal stack; no partial runtime                                                        |
| Broken frontend bundle           | No `healthy`/`active`; partial frame cleaned; native UI usable                                             |
| Missing/invalid CSS              | No activation; native UI usable                                                                            |
| Missing bridge capability        | Typed fixed-symbol failure and complete cleanup                                                            |
| Emergency fallback               | Matching window's project lifecycle is disposed without Svelte                                             |
| Safe start                       | Manifest lookup/import/mount skipped early                                                                 |
| Browser Toolbox                  | Project ownership and native retention are inspectable                                                     |
| Install/update/disable/uninstall | Only owned files change; stock startup restored                                                            |
| Unsafe package target            | Preflight rejects before mutation                                                                          |
| Cleanup/reinstall                | No owned residue, stale process, or unexplained cache action                                               |

Every expected result requires evidence. A check mark without environment,
command, and observation is insufficient. During rapid development, this matrix
is a release check, not a per-change requirement.

## 5. Current shell-frame and edge-controller matrix

The release mass-test contract for shell or feature changes that can affect #31
is:

### Ownership and mount

- exactly one `#fennevia-shell-frame-host` per managed browser window;
- exact top, left, right, and bottom host order;
- one final address-overlay host after the four edge hosts;
- one XHTML mount target and one Svelte root per edge plus one for the address
  overlay;
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
- after the left surface's initial snapshot, a newly opened tab briefly
  reveals the left edge and highlights only the new tab IDs;
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
- native tab strip remains attached and unchanged; active rest may collapse its
  exact item owner, while native focus/popup/Urlbar/original-toolbar reveal
  restores it.

Evidence:

- `docs/research/firefox-153-tabs-bridge.md`;
- `docs/research/firefox-153-tab-strip.md`;
- `docs/research/firefox-153-four-edge-shell.md`.

### 6.2 Top navigation — implemented

Validate:

- Back/Forward state against native controls;
- Reload/Stop transitions;
- Home through `BrowserCommands.home()` without reading the homepage URL;
- middle-click Back/Forward/Home/Reload opening through Firefox
  `whereToOpenLink` / `reloadOrDuplicate`;
- New Tab;
- left-edge programmatic reveal and a short new-tab highlight after `TabOpen`;
- selected-browser handoff;
- redirects, same-document navigation, error pages, and tab close;
- rapid command/tab-switch sequences;
- no action against the previous selected browser;
- bounded text-only title and display-URI state;
- current Firefox command/controller semantics;
- top-edge pointer/keyboard/focus/popup behavior;
- no editable address field in the top surface;
- native navbar/Urlbar/toolbox retained;
- direct frontend unmount/remount and window/runtime disposal;
- normal, second-normal, and private-window isolation;
- navigation capability, frontend, and safe-start failure recovery.

Evidence: `docs/research/firefox-153-navigation-controls.md` and
`docs/research/firefox-153-home-and-new-tab-reveal.md`. Home click, Alt+Home
comparison, Ctrl+T left reveal, and highlight timing are `not run` for this
addition.

### 6.3 Compact address launcher and popup — implemented (#13)

Validate:

- short non-editable launcher with bounded committed location;
- compact Firefox connection/HTTPS and tracking-protection badges in the
  launcher, with fuller matching text in the popup;
- secure, insecure, internal, error, protection blocking/detected/exception,
  non-handleable, transient, and unknown status mapping without URL inference;
- ordinary URLs, host-like input, and ordinary searches;
- empty, whitespace, executable-scheme, and over-4,096-character input;
- current Firefox fixup/search/principal/load semantics through
  `gURLBar.handleCommand()`;
- independent unsubmitted draft;
- background same-tab navigation draft retention and selected-tab-change
  discard;
- redirects, Back/Forward, reload, stop, tab switch, and new tab;
- launcher activation, repeated `Ctrl+L`, Enter, Escape, backdrop cancel, and
  focus-boundary close;
- healthy-only custom `Ctrl+L` ownership;
- native `Ctrl+L` fallback while inactive, failed, safe-started, unsupported, or
  disposed;
- focus restoration to a valid prior project/native control or selected
  content;
- all four edge surfaces suppressed while popup state has priority;
- no input/complete URL in normal diagnostics or project persistence;
- no native Urlbar, identity/protections panel, permission, or page-action DOM
  moved or managed;
- bridge/component/overlay failure, exact cleanup, and native-visible recovery;
- normal, second-normal, private, frontend recovery, and Browser Toolbox runs.

The real harness creates a temporary loopback-only Firefox search engine for
the ordinary-search case, restores the prior default, and removes the engine in
`finally`. Its delayed page is also loopback-only. No submitted test query is
sent to an external service.

Evidence: `docs/research/firefox-153-address-popup.md`.

### 6.4 Urlbar trust, permission, and action coverage — validated for #37

Validate:

- the short left launcher continues to show only committed location plus real
  Firefox connection/HTTPS and ETP status;
- the centered popup shows matching detailed connection/protection rows, a
  site-permission card, and current applicable Firefox-control labels;
- ordinary HTTP, valid HTTPS, secure internal, and real network-error
  classifications are derived from `gIdentityHandler`, never from URL text;
- ETP unavailable, clear/detected/blocking, exception, and restored states
  match current `gProtectionsHandler`/allow-list state;
- fixed active-sharing and blocked-permission indicators update from Firefox
  owner attributes; unknown permissions remain native-only;
- static, conditional, overflow, extension, unknown native, search-mode,
  persisted-search, and remote-control presence remains fixed and bounded;
- switch-to-tab, extension result labels, providers, suggestions, autofill,
  search one-offs, prompt anchors, and all native panels remain available
  through Firefox rather than a custom replica;
- dynamic native zoom visibility appears and clears without polling;
- **Open full Firefox address bar** closes the custom popup and focuses the
  current native `gURLBar`;
- no URL, origin, certificate, permission record/scope, extension identity,
  action ID, localized native label, or provider result enters Svelte, normal
  diagnostics, datasets, CSS variables, or persistence;
- one per-window observer is disconnected exactly once across normal, second,
  private, unmount/remount, fallback, window close, and runtime disposal;
- missing owner root, observer, or native-handoff capability fails open and
  leaves native UI usable.

The real targeted matrix uses an ephemeral loopback server. It temporarily maps
`fennevia.test` through Firefox's local-domain test preference so ordinary HTTP
is not misclassified as potentially trustworthy loopback, then restores the
original preference in `finally`. A temporary browser-scoped blocked-camera
permission and one ETP exception are both removed in `finally`. The valid-HTTPS
row loads fixed `https://example.com/` only and sends no user or browsing data.

Evidence: ADR-031 and
`docs/research/firefox-153-urlbar-coverage.md`.

### 6.5 Right bookmarks — validated for #14

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

The unit matrix covers fixed four-root translation, 32-item paging and
last-page normalization, lazy branches, depth/expansion behavior, code-point
title bounds, separators, stale/foreign IDs, event bursts, descendant-handle
release, supported and rejected schemes, private opening, cleanup, and
capability failure. The real harness creates only fixed
GUID test fixtures in the marker-owned profile, mutates them through native
`PlacesUtils.bookmarks`, and removes them in `finally`. It verified hidden
create, open rename/URL change, move, reorder, focused delete, current-tab and
Ctrl+Enter new-tab opening, keyboard traversal, and no URL-bearing panel DOM.

The ordinary and Browser Toolbox runs passed in the initial normal window, a
second normal window, and a private window. The bridge recovery wrapper now
injects a missing Places capability in addition to base/tabs/navigation
failures, proves native UI and zero project hosts, restores the exact committed
hash, and then reruns ordinary startup. Frontend missing/throwing bundle
recovery passed after the bookmark component was added. Evidence: ADR-029 and
`docs/research/firefox-153-bookmarks-surface.md`.

### 6.6 Bottom downloads — validated for #32

Validated:

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

The real fixture adds native records to the current PUBLIC or PRIVATE list
without starting a transfer or creating a target file. It validates 25/50/41
percent known progress, mixed indeterminate progress, zero/one-byte/5-GiB
records, pause/resume, terminal states, six-item burst bounds, hidden updates,
shared keyboard reveal/Escape, and exact removal. It alternates the custom
surface with Firefox's native Downloads panel and proves source/path sentinel
values never enter the DOM. Normal, second, private, Browser Toolbox, frontend
unmount/remount, missing Downloads capability, hard-disable/re-enable, and
artifact restoration passed. Evidence: ADR-030 and
`docs/research/firefox-153-downloads-surface.md`.

### 6.7 Single-line toolbar and native handoffs — focused automation complete, real Firefox pending

ADR-037 adds focused unit/static/build coverage for:

- exact validation of the nine fixed browser-tool action names and nine fixed
  availability booleans;
- twelve required per-window Firefox capabilities;
- current Trust-owner selection with separate legacy identity/protection
  fallback;
- original permission and Downloads anchor activation;
- Unified Extensions, application-menu, Settings, customization, and complete
  original-toolbar delegation;
- owner re-resolution at action time, reveal rejection/failure, malformed
  input/result, privacy-safe error symbols, pending-action accounting, and
  idempotent disposal;
- one-row top-surface selectors, project-authored SVG namespace containment,
  progressive disclosure, loading/focus/disabled states, reduced motion,
  forced colors, and deterministic generated artifacts;
- seven-rule native activation CSS, retained native caption nodes, project-owned
  top-row window controls, content gutter, and exact rule-count failure;
- panel drag/no-drag declarations, edge-to-panel contact, transient shortcut
  overlay, and `top > sides > bottom` collision policy.

The user requested a fast handoff and will test the browser manually. Therefore
the following are `not run`, not passed: cold-start flash, real Trust/identity/
protections/permission/Downloads/extension/menu popup placement and lifetime,
collapsed permission-anchor behavior, original-toolbar pinned widgets,
customization enter/exit, caption commands/placement, window drag release,
corner twitch, narrow/short/maximized/fullscreen/high-DPI layout, second/private
windows, and emergency fallback. The complete checklist is in
`plans/004-single-line-toolbar-ui-ux.md`; implementation/source evidence is in
`docs/research/firefox-153-single-line-toolbar-handoffs.md`.

## 7. Native-UI activation matrix — validated for #15

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
- #37 native handoff temporarily reveals and focuses the native Urlbar while
  active, and returning from it restores the intended content-only state;
- trust/identity/certificate, protections, permission, extension, bookmark,
  translation, zoom, overflow, and prompt-anchor paths remain reachable;
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

ADR-032 and
`docs/research/firefox-153-content-only-activation.md` contain the completed
owner/replacement/fallback inventory for #15. The ordinary real-Firefox harness
for that historical validation checked exact five-rule CSS, collapsed resting native owners, retained rendered
caption controls, compact HTTPS/ETP status, full native Urlbar owner reveal and
release, native Downloads popup hold, native History sidebar hold, real
customize enter/exit, real browser fullscreen, DOM-fullscreen suspension,
native modal stacking, narrow/short move/resize, maximize/minimize/restore,
normal/second/private isolation, emergency fallback, partial activation CSS
failure in an independent window, and Browser Console cleanliness. The Browser
Toolbox variant repeated ownership and namespace inspection while active. The
current ADR-038 extension has seven rules and the pending manual matrix in
section 6.7; the earlier result must not be treated as evidence for the changed
toolbar/caption implementation.

## 8. Recovery design

### 8.1 Health and activation

The current per-window sequence is:

```text
created -> mounted -> healthy -> active
                 \-> failed
any live state -> disposed
```

Current package `0.10.0-beta.1` performs the sole production activation only after
the health phase requires:

- exact frame identity and placement;
- ordered top/left/right/bottom hosts plus the final address-overlay host;
- five XHTML mount targets, XHTML structural frontend nodes, and only explicit
  project-authored `svg[data-fennevia-icon]` SVG subtrees;
- five frontend roots;
- attached parsed project CSS;
- edge reveal controller;
- initialized four-root bookmarks state and a successful first bounded page;
- a ready PUBLIC/PRIVATE Downloads list view and valid bottom-panel state;
- a valid Urlbar-coverage snapshot, one owner-state observer, and native
  `openLocation()` handoff capability;
- a valid browser-tools snapshot, all fixed native-panel/tool actions, and
  synchronous original-toolbar reveal capability;
- a valid window-controls snapshot and project-owned top-row min/max/close
  buttons;
- exact Firefox native target/titlebar ownership, an attached exact activation
  style with seven parsed rules, and synchronous native Urlbar reveal capability;
- environment/suspension handling;
- privileged emergency handler;
- every declared required capability;
- a literal successful health result before the finite deadline.

The initializer then calls `lifecycle.activate()` exactly once. Its active
marker is the only state that enables native hiding. A failed activation enters
the same fail-open disposal path.

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

### 8.4 Ownership repair, hard disable, and uninstall

1. Close all Firefox and Browser Toolbox processes using the selected targets.
2. If exactly one ownership side survives, choose one explicit recovery path:
   preview `Repair` with the exact recorded package source to reconstruct the
   missing side, or preview package-independent `Uninstall` to remove only
   survivor-proven content. Repair must reject partial residue, source mismatch,
   or unmarked targets; one-sided uninstall must reject missing-side metadata or
   any modified still-present owned file.
3. After repair or when a complete pair already exists, preview `Disable`
   against explicit program/profile paths.
4. Run `Disable`; the AutoConfig preference is moved even when the runtime entry
   is broken.
5. Cold start and confirm native UI with no Fennevia startup record.
6. Preview and run ownership-manifest-based `Uninstall`; repeat the one-sided
   path with the old package unavailable and with a deliberately modified owned
   file to prove safe success and fail-closed rejection.
7. Cold start stock Firefox and confirm no Fennevia record, manifest error, or
   owned residue.
8. Use startup-cache cleanup only when an observed stale-code symptom remains.

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

- exact frame, edge-host, and address-overlay placement;
- XHTML structural namespaces and SVG only below explicit project icon roots;
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
- missing top, left, right, bottom, or address-overlay target;
- frontend registration/mount/unmount failure;
- missing/invalid frame CSS;
- edge-controller construction/hold/timer/corner/disposal failure;
- health false and timeout;
- missing base bridge capability;
- missing tabs/navigation/address/Urlbar-coverage/Places/Downloads capability;
- malformed/stale/foreign snapshots and IDs;
- feature component failure;
- disposal during a pending hide, focus/popup hold, navigation event, address
  submission, Urlbar owner mutation/native handoff, Places query/observer
  callback, or Downloads callback;
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

node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>' `
  --performance-baseline

pwsh -NoProfile -File .\tests\firefox-frontend-recovery.Tests.ps1 `
  -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe' `
  -ProfilePath '<FENNEVIA_DEV_PROFILE>'

pwsh -NoProfile -File .\tests\firefox-bridge-recovery.Tests.ps1 `
  -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe' `
  -ProfilePath '<FENNEVIA_DEV_PROFILE>'

pwsh -NoProfile -File .\tests\firefox-session-restore.ps1 `
  -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe' `
  -ProfilePath '<FENNEVIA_DEV_PROFILE>'
```

The explicit performance mode records only numeric aggregates: spawn-to-active
milliseconds, total Firefox-process CPU/memory deltas across a five-second idle
window, four-edge reveal p50/p95/max, and before/after values for five complete
normal-window lifecycle cycles. It discards process/window IDs, origins, URIs,
titles, threads, and all browsing-derived fields. Repeat it three times on the
same hardware and apply the investigation thresholds in
`docs/firefox-update-workflow.md`; it is not a noisy CI pass/fail benchmark.

The bridge recovery command includes a dedicated
`FENNEVIA_FIREFOX_BOOKMARKS_CAPABILITY_MISSING` and
`FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING` run plus
`FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING`. The ordinary lifecycle
command contains bookmark, Downloads, and Urlbar state fixture matrices; no
separate profile mutation command is required. The same harness accepts
`--expect-disabled` after an exact package `Disable` action and verifies native
UI, zero project hosts, and zero Fennevia records before re-enable.

The SessionStore wrapper is a test-only four-process-boundary transaction:

1. `prepare` creates four fixed local fixtures, snapshots seven allowlisted
   preference user-value states, and performs a normal Firefox shutdown;
2. `verify` starts a new process, waits for Firefox's all-windows-restored
   promise, compares native and Fennevia order/selection/pinning, verifies the
   exact lazy pending set before interaction, and exercises native reveal;
3. `fail-open` temporarily removes the exact hash-validated installed frontend
   bundle, starts another process, verifies zero project hosts and a usable
   native restored session, activates one fixed pending tab, and restores the
   prior selection and bundle bytes;
4. `cleanup` restores one `about:blank` tab and every prior preference state,
   exits normally, and removes the transaction marker only after process exit.

An existing `.fennevia-session-restore-rehearsal.json` marker blocks `prepare`.
After an interrupted manual phase, first ensure the package-managed
`ShellApp.js` exactly matches `package-manifest.json`, close every Firefox
process, and run only the cleanup phase:

```powershell
node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>' `
  --session-restore cleanup
```

Do not delete the marker by hand or start another prepare run. If exact bundle
restoration cannot be established, stop and use the package ownership/repair
procedure before touching the session fixture. Evidence contains only fixed
fixture IDs, enums, booleans, and counts; it excludes URLs, titles, raw session
state, local paths, and native objects.

Use only harnesses that exist on the current branch. When a future issue adds a
feature-specific harness, document its exact target validation, mutation scope,
restoration path, and sensitive-output policy.

The Marionette `--remote-allow-system-access` flag is test-only and is not part
of the installed package.

## 13. Evidence index

| Milestone                  | Evidence                                             |
| -------------------------- | ---------------------------------------------------- |
| Development profile        | `docs/development-setup.md`                          |
| Bootstrap                  | `docs/research/firefox-153-bootstrap.md`             |
| Identity migration         | `docs/research/fennevia-identity-migration.md`       |
| Installer lifecycle        | `docs/research/fennevia-installer-validation.md`     |
| Window lifecycle           | `docs/research/firefox-153-window-lifecycle.md`      |
| Initial XHTML hosts        | `docs/research/firefox-153-shell-hosts.md`           |
| Health and recovery        | `docs/research/firefox-153-shell-health-recovery.md` |
| Svelte build               | `docs/research/firefox-153-svelte-build.md`          |
| Firefox boundary           | `docs/research/firefox-153-bridge-boundary.md`       |
| Tabs bridge                | `docs/research/firefox-153-tabs-bridge.md`           |
| Tab UI                     | `docs/research/firefox-153-tab-strip.md`             |
| Four-edge frame            | `docs/research/firefox-153-four-edge-shell.md`       |
| Top navigation             | `docs/research/firefox-153-navigation-controls.md`   |
| Address launcher and popup | `docs/research/firefox-153-address-popup.md`         |
| Urlbar coverage            | `docs/research/firefox-153-urlbar-coverage.md`       |
| Right-edge bookmarks       | `docs/research/firefox-153-bookmarks-surface.md`     |
| Bottom-edge downloads      | `docs/research/firefox-153-downloads-surface.md`     |
| Content-only activation    | `docs/research/firefox-153-content-only-activation.md` |
| MVP hardening/update rehearsal | `docs/research/firefox-153-mvp-hardening-update-rehearsal.md` |
| Persisted session restore  | `docs/research/firefox-153-session-restore-rehearsal.md` |
| Release packaging/distribution | `docs/research/fennevia-release-packaging.md`       |

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

During rapid development, `not run` is the expected status for mass-matrix and
real Firefox rows on ordinary pull requests. Convert those rows to `pass` or
`fail` before a release tag.

Do not:

- convert “not run” into a check mark;
- infer real Firefox success from pure tests;
- claim a platform or Firefox version not tested;
- claim native-UI activation, performance, or Firefox-version compatibility
  beyond the exact recorded evidence;
- claim a feature placeholder is a completed feature;
- paste sensitive values into shared evidence.
