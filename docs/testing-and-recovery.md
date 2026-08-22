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
scan. Locally, `npm run verify` exercises the shared gate; on Windows, repeat
the fixed-list suite under Windows PowerShell 5.1 to match the final CI row.
Do not add tests whose only purpose is to satisfy the coverage floor.

The matrices in sections 4–7 and 12, plus the real Firefox harnesses, are the
**release mass-test contract**. They prove a tagged package. They are not a
per-pull-request Definition of Done during rapid development unless the project
owner asks for them or the change is a release. Record unrun mass-matrix rows as
`not run`. Do not imply they passed because CI passed.

Safety, privacy, fail-open, and native-UI ownership rules remain in force.
Updating or relaxing them requires explicit project-owner approval. See
ADR-039.

## 1. Current validated baseline

As of 2026-08-21:

- package: public `0.11.0-beta.1` prerelease;
- tested Firefox: 153.0.4 release, Build ID `20260810162159`, and 154.0
  release, Build ID `20260812182057`;
- installer gate: Firefox 153+ after an explicit warning that only 153 and 154
  are tested (ADR-048);
- first real stock-stable transition: owner-confirmed ordinary runtime on
  Firefox 154.0; full update-workflow mass matrix `not run`; see
  `docs/research/firefox-154-stable-transition.md`;
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

Follow `docs/development-setup.md`. The recommended interactive development
entry is `pwsh -NoProfile -File .\scripts\fennevia.ps1`. That console redraws
in place and accepts mouse clicks; it does not append a new menu after every
key. Search is a literal substring filter, so `[` or a leaked SGR mouse
sequence cannot crash the host. Each TUI prompt reasserts console input mode
and VT mouse tracking after child processes such as `npm run build`. Extracted releases should use `FenneviaSetup.exe`. The scripted equivalent
is:

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
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\tests\run-static-powershell-tests.ps1
```

`npm run verify` covers:

- Prettier check for configured source/build files;
- ESLint and the Firefox-boundary rules;
- Svelte/TypeScript checking;
- pure and component tests plus Node coverage floors (80% lines and 80%
  functions on loaded `src/app` and `src/firefox` modules);
- the fixed-list PowerShell bootstrap/profile/installer/GUI/release/artifact/
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

The current profile inventory is the closed `expectedFiles` list in
`package-manifest.json`. The gate rejects unplanned files/chunks, endpoints,
runtime networking APIs, HMR/dev-server markers, bare or dynamic imports, source
maps, development source, executable binaries, symlinks/junctions, and unsafe
paths.

A build must not leave a dirty generated-artifact or manifest diff unless that
change is intentional and reviewed. Never hand-edit generated bridge or shell
files.

Shell UI locale mapping, the optional `Services.locale` bridge, catalog key
parity, and `t()` interpolation are covered by `tests/locale-state.test.mjs`,
`tests/firefox-locale.test.mjs`, and `tests/i18n.test.mjs` in the ordinary CI
gate. Switching the Firefox UI language (including language-pack changes
without restart) is a real-Firefox release check and is `not run`.

Release packaging has additional fixed-list coverage in
`fennevia-gui.Tests.ps1`, `release-packaging.Tests.ps1`, and
`release-installer.Tests.ps1`. They run under PowerShell 7 and Windows
PowerShell 5.1. GUI coverage includes the dedicated elevation-state namespace,
exclusive creation, bounded input, owner-only ACL, explicit cleanup failure,
and plan-digest revalidation. Installer discovery also requires a successful
writability probe to leave no temporary residue. Release checks require two
byte-identical ZIPs, a compiled
`FenneviaSetup.exe`, module-scoped button/list/checkbox event-flow,
localized system-font, DPI/responsive-layout, and confirmation/elevation-state
coverage without `ShowDialog`, fixed/sorted entries, a strict extracted tree
from a Unicode/space path, checksum and source records, tamper rejection,
explicit registered-profile mode, exact supported Firefox major-version gate
(153+; older rejected), pre-mutation rejection, untested-newer warning text, and
disable/uninstall recovery after an older Firefox update. Real double-click,
UAC, and system-Firefox GUI installs are release-matrix work and are `not run`
on ordinary pull requests. Before a tag,
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

| Case                             | Expected result                                                                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Three clean cold starts          | One bootstrap and one process runtime per process                                                                                             |
| Ordinary restart                 | Fresh per-window frame, bridge, roots, and state; no stale callbacks                                                                          |
| Second normal window             | Independent complete frame and feature state; no duplicate process runtime                                                                    |
| Private window                   | Full explicitly tested feature support or complete native fallback; never partial initialization                                              |
| Close/reopen window              | Hosts, roots, bridge contexts, listeners, observers, holds, timers, mappings, and pending work are removed                                    |
| Persisted session rehearsal      | A new process restores fixed native/frontend order, selected/pinned/lazy state; fail-open remains usable; cleanup restores the blank baseline |
| Runtime stop twice               | First stop disposes; second is idempotent                                                                                                     |
| Missing manifest                 | Clear bootstrap failure; native UI usable                                                                                                     |
| Malformed manifest               | Clear registration/entry failure; native UI usable                                                                                            |
| Missing/broken entry             | Privacy-safe first causal stack; no partial runtime                                                                                           |
| Broken frontend bundle           | No `healthy`/`active`; partial frame cleaned; native UI usable                                                                                |
| Missing/invalid CSS              | No activation; native UI usable                                                                                                               |
| Missing bridge capability        | Typed fixed-symbol failure and complete cleanup                                                                                               |
| Emergency fallback               | Matching window's project lifecycle is disposed without Svelte                                                                                |
| Safe start                       | Manifest lookup/import/mount skipped early                                                                                                    |
| Browser Toolbox                  | Project ownership and native retention are inspectable                                                                                        |
| Install/update/disable/uninstall | Only owned files change; stock startup restored                                                                                               |
| Unsafe package target            | Preflight rejects before mutation                                                                                                             |
| Cleanup/reinstall                | No owned residue, stale process, or unexplained cache action                                                                                  |

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
- default and minimum/maximum ADR-054 in-window and window-leave hide delays,
  including changing each applicable value while the one hide timer is pending;
- default and minimum/maximum temporary programmatic reveal durations;
- zero/default/maximum shortcut-tip durations, including no initial footer at
  zero and a timed non-fading expiry under reduced motion;
- rapid exit/re-entry;
- pointer moving into browser content uses the in-window delay; pointer leaving
  the Firefox window uses the window-leave delay; a duplicate window-level
  event does not create or restart a second timer;
- dragging the native window from neutral top/left/right/bottom panel chrome
  releases all pointer holds, suppresses cross-edge pointer reveal until the
  matching mouse/pointer release, and does not reveal top after a side drag;
- `Escape` priority and dismissal;
- focus transfer into the surface;
- focus restoration to the prior valid target;
- disposal during a pending hide or hold.

### Corners and collisions

- top-left, top-right, bottom-left, and bottom-right ownership;
- deterministic pointer arbitration;
- rapid movement between adjacent edges;
- no accidental double reveal from a corner;
- default, minimum, and maximum trigger thickness with matching CSS hit geometry
  and point/corner arbitration;
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
- native modal/window-modal suspension, including first-run Terms of Use
  Spotlight: native chrome must hide again after the HTML dialog closes even
  if `window-modal-open` remains;
- light and dark Firefox themes;
- default shell colors following Firefox Light/Dark/System design tokens;
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

- one tab, many tabs, and bounded vertical overflow, with New tab following the
  last tab and remaining pinned below the scroller when the list overflows;
- exact native order;
- selected, title, safe favicon/fallback, pinned, and loading state;
- native and custom select/new/close/pin/unpin used alternately;
- after the left surface's initial snapshot, a newly opened tab briefly
  reveals the left edge and highlights only the new tab IDs;
- selected/background/last-tab close behavior;
- rapid event/action bursts;
- long, empty, emoji, markup-like, Unicode, and bidirectional titles;
- rejected/failed favicon;
- Up/Down, Home/End, Enter/Space, Delete, sibling pin/close/mute controls;
- middle-click close without autoscroll;
- mouse-initiated close by middle button or the close control keeps the left
  surface held when the pointer remains inside the panel after the tab row is
  removed; a real pointer exit still uses the shared delayed-hide path, while
  keyboard and touch activation do not synthesize a pointer hold;
- drag reorder and `Ctrl+Shift+ArrowUp/Down` within the pinned partition;
- pointer-aligned full-row browser drag image, an actual source row that follows
  the pointer without transform lag while inside its strip, stable pre-transform
  midpoint hit testing with scroll compensation, pinned-partition movement
  bounds, one-slot neighboring-row shifts, and a valid before/after marker that
  remains at the exposed landing gap;
- pinned boundary clamp, drag-leave shift/marker cleanup with valid re-entry,
  and drop/end/disposal cleanup of geometry, transforms, marker, and the
  existing left pointer hold;
- ordinary default tab-drag cursor, hover/focus disclosure of secondary
  actions, declared reorder shortcuts, and one polite successful-move
  announcement;
- reduced-motion suppression of meaningful background-row transition duration
  without delaying direct pointer tracking, plus a visible forced-colors drag
  source;
- native `#tabContextMenu` on a background tab, including complete static and
  dynamic localized labels, translation before open, left-edge popup hold, and
  NativeUi handoff that does not reveal original Firefox chrome;
- audio playing/muted/blocked indicator and mute toggle without first selecting;
- camera, microphone, and screen-sharing indicators from the closed native tab
  value, with unknown values omitted and no fake capture action;
- crashed-tab and picture-in-picture status badges with localized accessible
  names;
- exact packaged Firefox resources for fallback/loading/audio/status/pin/close,
  fixed trailing pin/close placement with and without audio, and no
  text-symbol placeholder icons;
- native `loading.svg` while `busy`, with no second project rotation and its
  packaged reduced-motion behavior left intact;
- container color stripe and bounded label; private windows omit container;
- attention indicator;
- deterministic close-focus recovery;
- selected item remains reachable;
- direct frontend unmount/remount;
- stale/foreign ID rejection;
- marker-only tab drag data after `clearData()`, with no `text/plain`, URL,
  opaque tab ID, or random drag ID in `DataTransfer`;
- same-window drag move, target-strip cross-window adoption at a pinned-aware
  insertion point, and target-browser-content append at the tab-list end;
- target-window entry over either browser content or the project frame reveals
  and holds that window's left tab surface before list hit testing; moving
  between target content and list keeps it visible;
- an external target preview reserves one real row-height layout slot only for
  a valid target index, so a short target list extends without a
  transformed-overflow scrollbar while a genuinely height-constrained list
  remains scrollable;
- the accepted target index also shows one pointer-transparent, aria-hidden
  tab-shaped row at the exact insertion point, using only a fixed localized
  label and packaged tab icon; target-content dragover shows the append
  position, while project-frame space outside the list shows no false preview;
- leaving the target browser window again without dropping clears the visible
  preview, hidden layout slot, marker, external drag state, and left hold;
  nested/internal `dragleave` events with non-null `relatedTarget` do not clear
  a still-active target;
- an unconsumed source drag delegates to Firefox window detach, while Escape,
  disabled detach, stale state, and a sole-tab source do not create a window;
- normal/private cross-window inspection and adoption rejection;
- capture-phase source `dragend`, source-snapshot disappearance after adoption,
  null-related-target true target-window leave, target drop, setup failure,
  component disposal, and window disposal release local drag state and the left
  pointer hold through the shared edge hide owner; after source DOM
  reconciliation, stale focus/keyboard holds are released only if focus is no
  longer inside that surface, and an in-window reorder does not trigger the
  snapshot fallback;
- bridge-capability failure;
- no title, URL, or favicon value in normal diagnostics;
- native tab strip remains attached and unchanged; active rest may collapse its
  exact item owner, while native focus/popup/Urlbar/original-toolbar reveal
  restores it.

Evidence:

- `docs/research/firefox-153-tabs-bridge.md`;
- `docs/research/firefox-153-tab-strip.md`;
- `docs/research/firefox-153-tab-strip-parity.md`;
- `docs/research/firefox-153-four-edge-shell.md`;
- `docs/research/firefox-153-154-native-shell-icons.md`;
- `docs/research/firefox-154-tab-drag-spatial-preview.md`;
- `docs/research/firefox-154-cross-window-tab-drag.md`.

ADR-062 focused validation passed the complete `npm run verify` gate with
318/318 Node tests, 87.49% line coverage, 95.11% function coverage, all fixed
PowerShell 7 suites, deterministic generated output, dependency review, and
14/14 accepted production artifacts. The same fixed suite also passed under
Windows PowerShell 5.1.

ADR-063 focused coordinator, bridge, adapter, external-index, payload-source,
capability, and disposal tests pass. The complete `npm run verify` gate passed
with 326/326 Node tests, 87.36% line coverage, 79.08% branch coverage, 95.24%
function coverage, all fixed PowerShell 7 suites, dependency audit,
deterministic frontend/bridge builds, and 14/14 accepted production artifacts.
The same fixed suite passed under Windows PowerShell 5.1. Real Firefox results
are not inferred from that automation.

The latest combined ADR-062/ADR-063 refinement adds live source-row movement,
target-window reveal/hold, a row-height external target layout slot, a visible
generic target row, true-window-exit cleanup, and the ordinary Firefox cursor.
Its complete `npm run verify` gate passed with 327/327 Node tests, 87.38% line
coverage, 79.12% branch coverage, 95.24% function coverage, all fixed
PowerShell 7 suites, dependency audit, deterministic frontend/bridge builds,
and 14/14 accepted production artifacts. The fixed suite also passed under
Windows PowerShell 5.1.

The source-window auto-hide follow-up adds active-dragged-ID disappearance as
an idempotent cleanup signal, plus a post-DOM focus/keyboard release guarded by
actual remaining surface focus. `tests/tab-strip.test.mjs` passed 9/9 after the
change. The complete `npm run verify` gate passed with 331/331 Node tests,
87.27% line coverage, 79.19% branch coverage, 95.23% function coverage, all
fixed PowerShell 7 suites, dependency audit, deterministic frontend/bridge
builds, and 14/14 accepted production artifacts. The fixed suite also passed
under Windows PowerShell 5.1. Real Firefox results are not inferred from this
automation.

Issue #60 real Firefox rows (middle-click, audio/mute, container stripe,
background-tab native menu, drag/keyboard reorder, menu popup hold, private
window without containers, fail-open, disposal during menu/drag): **not run**.

ADR-058 real Firefox rows (camera/microphone/screen capture transitions,
crashed tab, simultaneous audio/PiP/capture status, narrow-panel control
alignment, reduced motion, forced colors, high DPI, normal/second/private
isolation, and cleanup): **not run**.

ADR-060 real Firefox rows (native Settings gear and all other fixed shell
resources, normal/second/private windows, light/dark/system themes, native
loading animation, reduced motion, forced colors, high DPI, missing-resource
fail-open, sizing, color, and optical alignment): **not run**.

ADR-062 real Firefox rows (full-row drag ghost alignment, live source-row
pointer tracking, stable upward and downward landing gaps, fast direction
reversal, overflow autoscroll, pinned boundary behavior, reduced motion, forced
colors, screen reader announcement, normal/second/private isolation, and
disposal during drag): **not run**.

ADR-063 real Firefox rows (target-strip insertion, target-content append,
source-content detach, non-Firefox application detach, Escape cancellation,
sole-tab behavior, pinned partitions, overlapping windows, left-edge auto-hide,
target-window reveal/hold while crossing content and list, visible target-row
placement and cleanup after leaving the target again without dropping,
source left-panel auto-hide after adoption even when source `dragend` is not
observed, normal/second/private rejection/isolation, source/target window
closure, missing-capability fail-open, and Browser Console/Toolbox ownership):
**not run**.

### 6.2 Top navigation — implemented

Validate:

- Back/Forward state against native controls;
- Reload/Stop transitions;
- Home through `BrowserCommands.home()` without reading the homepage URL;
- middle-click Back/Forward/Home/Reload opening through Firefox
  `whereToOpenLink` / `reloadOrDuplicate`;
- one physical middle click invokes exactly one navigation action even if
  browser chrome dispatches both `click` and `auxclick`;
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
- one compact Firefox Trust shield at the leading edge inside the launcher
  address frame, with fuller combined text in the popup;
- clicking that shield or the popup Trust/permission rows closes the custom UI
  as applicable and opens Firefox's current native Trust or permission panel;
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
- cancel, backdrop, or focus-boundary close after launcher activation returns
  focus to selected content instead of re-revealing the launcher, so the left
  focus hold clears and auto-hide does not require another content click;
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

### 6.4 Urlbar trust, permission, and action coverage — #37 validated; ADR-059 real follow-up pending

Validate:

- the short left launcher shows only committed location plus one Firefox-style
  Trust shield at the leading edge inside the shared address frame;
- the shield and centered popup's one full-width Trust row combine real Firefox
  connection/HTTPS and ETP status while keeping both bounded labels in the
  accessible name;
- clicking the launcher shield or popup Trust/permission row closes the custom
  popup as applicable and opens Firefox's current native Trust or permission
  panel;
- active, disabled, insecure, and warning map to the exact four fixed packaged
  `chrome://browser/skin/trust-icon-*.svg` masks, with no copied asset,
  generated-CSS URL, `<img>`, or network fallback;
- ordinary HTTP, valid HTTPS, secure internal, and real network-error
  classifications are derived from `gIdentityHandler`, never from URL text;
- ETP unavailable, clear/detected/blocking, exception, and restored states
  match current `gProtectionsHandler`/allow-list state; an HTTPS ETP exception
  changes the combined shield to disabled, while insecure/warning connection
  meaning retains priority;
- fixed active-sharing and blocked-permission indicators update from Firefox
  owner attributes; unknown permissions remain native-only;
- static, conditional, overflow, extension, unknown native, search-mode,
  persisted-search, and remote-control presence remains fixed and bounded;
- switch-to-tab, extension result labels, providers, suggestions, autofill,
  search one-offs, prompt anchors, and all native panels remain available
  through Firefox rather than a custom replica;
- dynamic native zoom visibility appears and clears without polling;
- **Open Firefox address bar** closes the custom popup and focuses the
  current native `gURLBar`;
- no URL, origin, certificate, permission record/scope, extension identity,
  action ID, localized native label, or provider result enters Svelte through
  the Urlbar-coverage adapter, normal diagnostics, datasets, CSS variables, or
  persistence;
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

The historical #37 matrix passed before ADR-059 merged the two visible rows.
ADR-059 adds focused state, source, accessibility, resource, build, and health
checks and updates the real harness to compare both custom masks with
`#trust-icon-container` for HTTP, HTTPS, ETP exception/restore, internal, and
network-error states. That updated real-Firefox run is **not run**.

Evidence: ADR-031, ADR-059,
`docs/research/firefox-153-urlbar-coverage.md`, and
`docs/research/firefox-153-154-unified-trust-shield.md`.

### 6.4.1 Native Urlbar suggestions/providers — focused automation and Firefox 154 probes complete; release matrix pending

ADR-061 reuses Firefox's existing per-window `gURLBar` query-context builder,
parent controller, shared provider manager, result objects, and `pickResult`
execution. The focused matrix validates:

- no project search engine, provider, endpoint, ranking, provider-name export,
  payload serialization, or direct frontend navigation path;
- bounded immutable result snapshots, closed type/source enums, validated local
  icon schemes, and text/property-only rendering;
- exact native-controller restoration on success and synchronous throw;
- incremental and empty replacement batches, exact-context cancellation, query
  replacement, late-callback rejection, same-query active-selection retention,
  and deterministic handle/native-input disposal;
- current-query opaque action tokens plus malformed, stale, removed,
  foreign-query, and normal/private cross-window rejection;
- direct `pickResult` execution, search-mode follow-up queries, conservative
  rich/unknown native handoff, and raw Enter submission with no selection;
- one ARIA combobox/listbox, stable active descendant, Arrow Up/Down, Home/End,
  Page Up/Down, Enter, pointer hover, left/middle click, one polite status
  output, active-option nearest scrolling, bounded list geometry, forced-colors,
  and responsive rules;
- modified navigation keys do not consume `Shift+Arrow`, `Shift+Home`, or
  `Shift+End` text-selection gestures;
- ordinary close, tab/environment close, explicit native handoff, failure, and
  unmount cleanup without logging or persisting query/result text.

Two focused Firefox 154.0 BuildID `20260812182057` runs use installed production
artifacts. `--urlbar-provider-probe` observed one complete
`started -> results -> finished` lifecycle, at least one result/type/source,
exact controller restoration, a closed native view, and zero native/selectable
rows. `--urlbar-suggestions-probe` opened Fennevia's panel, projected one fixed
`about:preferences` direct result, linked `aria-activedescendant`, executed it
with Arrow Down plus Enter through `pickResult`, closed the popup, kept the
native view closed with zero rows, and restored the controller before and after
execution. Both runs shut down cleanly with zero first-party script errors and
emitted only fixed enums, counts, and booleans.

The final production-artifact rerun initially exposed a real incremental batch
race: a later batch for the same query reset the active option after Arrow Down,
and the probe timed out. The current UI preserves a bounded active index within
the same query revision and resets only for a new query/non-result state; the
harness resolves the current keyed option. The rebuilt artifact then passed the
same probe. This is recorded as a found-and-fixed failure, not a retroactive
first-pass success.

The ordinary gate for this change passed with 316 Node tests, 87.45% line and
95.10% function coverage, the fixed PowerShell suites under both PowerShell 7
and Windows PowerShell 5.1, deterministic builds, dependency audit, and all 14
production artifacts accepted.

Those runs do not prove every enabled provider. Search suggestions appear only
when Firefox's own Search Suggestions provider, engine, prefs, private policy,
and current network conditions publish them; Fennevia adds no fallback engine
or request. The release matrix still must cover Firefox 153, history,
bookmarks, open/switch tabs, autofill, keyword, extension/omnibox, actions,
search suggestions enabled/disabled and remote allowed/denied, one-offs/search
modes, rich results/native handoff, rapid replacement/close, pointer and
assistive-technology operation, second/private windows, responsive/a11y
environments, Browser Toolbox ownership, and failure injection. Record each as
passed, blocked, or not run rather than inferring it from the focused probes.

Evidence: ADR-061 and
`docs/research/firefox-153-154-native-urlbar-suggestions.md`.

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
- pointer right-click plus Context Menu key/Shift+F10 on bookmark/folder rows;
- current/new-tab, expand/collapse, and fixed Manage Bookmarks actions;
- bounded menu placement, Arrow/Home/End/Escape, focus restoration, outside
  pointer/window-blur close, and exact right popup-hold/listener cleanup;
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
`docs/research/firefox-153-bookmarks-surface.md`. The added Library owner and
row context-menu unit/static matrix passed; its real Firefox rows are **not
run**. Evidence: ADR-055 and
`docs/research/firefox-153-154-panel-context-actions.md`.

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

ADR-037 and ADR-042 add focused unit/static/build coverage for:

- exact validation of the ten fixed browser-tool action names and ten fixed
  availability booleans;
- twenty required per-window Firefox capabilities plus one optional
  translations owner;
- popup actions requiring a project-owned host and refusing native-toolbar
  reveal;
- Trust `showPopup()` without using collapsed-navbar `checkVisibility()` as a
  feature-gate, and host-open of `#trustpanel-popup` when `showPopup` throws
  after initialize;
- permission `setAnchor` plus owner `openPopup`, with host-open of
  `#permission-popup` when the owner throws; Downloads `initialize` plus
  `#downloadsPanel` `openPopup`; Unified Extensions toggle plus re-anchor; and
  application-menu `ensureReady` plus `PanelMultiView.openPopup` (screen-rect
  routed through `panel.openPopup` after `#showMainView`), ignored `popuphidden`
  during that open, then `PanelUI.show()` and `popupshown` `moveTo`;
- Firefox `FullPageTranslationsPanel.open(event)` delegation, exact trigger
  event preservation, lazy panel creation after the owner has already returned,
  and host routing held through the actual
  `#full-page-translations-panel` `popupshown`; missing owner disables only
  Translate;
- host-surface popup positions (`after_end` in the address overlay,
  `end_before` on the left rail, otherwise the action default) and preferred
  `PanelMultiView.openPopup` when present;
- NativeUi token-listed and Fennevia-anchored panels that do not set
  `data-fennevia-native-ui-revealed`; ADR-056 supersedes the older blanket
  toolbox-doorhanger reveal behavior for non-security popups, while ADR-057
  pre-anchors shared security notifications before first open and retains
  complete native reveal as fallback; see section 6.11;
- edge `setPopupHeld` plus address-overlay keep-open for popup actions;
  Settings, customization, and complete original-toolbar still dismiss then
  delegate;
- owner re-resolution at action time, host rejection, malformed input/result,
  privacy-safe error symbols, pending-action accounting, popuphidden cleanup,
  and idempotent disposal;
- one-row top-surface selectors, packaged Firefox XHTML mask spans, reviewed
  project-SVG exception containment, progressive disclosure,
  loading/focus/disabled states, reduced motion, forced colors, and
  deterministic generated artifacts;
- one fixed no-input Firefox icon allowlist covering exact native-equivalent
  top, tab, popup, bookmark, download, customize, and fixed widget meanings;
  Settings resolves to `chrome://global/skin/icons/settings.svg`, Firefox bytes
  are not copied, and obsolete text-symbol equivalents are absent;
- one semantic Trust entry at the leading edge inside the left address frame,
  one popup Trust row, exact fixed Firefox icon URIs rendered as masks, closed
  state priority, combined accessible labels, and retained dual bridge actions;
- seven-rule native activation CSS, retained native caption nodes, project-owned
  top-row window controls, content gutter, and exact rule-count failure;
- panel drag/no-drag declarations, edge-to-panel contact, transient shortcut
  overlay, `top > sides > bottom` collision policy, and shared native-window-
  drag suppression from Firefox's drag-region start through its synthesized
  mouse-up so left/right drag release cannot reveal the top edge;
- ADR-043 2px gutter load/download lights, idle health nodes, anonymous
  download-width mapping, full-width activity pulse (not a fake load percent),
  reduced-motion static beam, and provenance checks that reject the
  old-project neon IDs/hex/hue-rotate/z-index.

The user requested a fast handoff and will test the browser manually. Therefore
the following are `not run`, not passed: cold-start flash, real unified Trust
shield/state and Trust/permission/Downloads/extension/menu popup placement and lifetime
against a collapsed navbar, original-toolbar pinned widgets, customization
enter/exit, caption commands/placement, window drag release, corner twitch,
narrow/short/maximized/fullscreen/high-DPI layout, second/private windows,
emergency fallback, and live gutter-light painting during selected-tab load
and active downloads. The complete checklist is in
`plans/004-single-line-toolbar-ui-ux.md`; implementation/source evidence is in
`docs/research/firefox-153-single-line-toolbar-handoffs.md`,
`docs/research/firefox-153-native-popup-anchoring.md`, and
`docs/research/firefox-153-gutter-progress-lights.md`. The drag-release
correction and exact Firefox 153/154 Windows event source are recorded in
`docs/research/firefox-153-154-side-panel-window-drag-release.md`.

### 6.8 Nav-bar widget mirror — focused automation complete, real Firefox pending

ADR-044 (#64) adds focused unit/static/build coverage for:

- read-only `CustomizableUI` nav-bar enumeration mapped to ordered widget
  snapshots with opaque handles, the fixed skip list, and special placements
  (spring/spacer/separator) as non-interactive gaps;
- extension widget mapping: name label, bounded tooltip, `moz-extension://`
  icon URL parsing from `--webextension-toolbar-image`, rgba-only badge
  text/colors, disabled state, and privacy assertions that widget/extension
  ids never enter the serialized snapshot;
- live or version-aware packaged Firefox built-in icon URLs, a fixed native
  presentation-token fallback before the narrow generic fallback, plus ADR-046
  localized names (palette node / Fluent / `getLocalizedProperty`) and bounded
  `chrome://` / `resource://` CSS-mask rendering;
- coalesced revision snapshots from CustomizableUI listener events and the
  bounded attribute `MutationObserver`, including customize-exit re-read and
  no-change suppression;
- missing `CustomizableUI` degrading to an unavailable **optional** capability
  (`available: false`, empty widgets) without failing creation or health;
- extension and built-in wrapper-view activation through
  `PanelUI.showSubView(viewId, host, event)` anchored on the project host,
  popup hold publication, and same-widget toggle-close;
- delegated static-widget activation: Account preserves
  `gSync.toggleAccountPanel` state/CTA work while routing `PanelUI-fxa` to the
  project host, Library opens `appMenu-libraryView` on that host, and All Tabs
  initializes and invokes `gTabsPanel.showAllTabsPanel` through a temporary
  visible host before restoring the original owner anchor;
- native Bookmarks Menu / Share Tab / Send Tab `type="menu"` shape opening its
  existing Firefox-owned `menupopup` through `openPopup(host, options)`;
- compound Zoom, Edit, and Profiler snapshots with bounded unique child
  handles, semantic grouped buttons, parent/child disabled mapping, missing
  child degradation, all three native Zoom child commands, live reset-label
  percentage republishing, and Profiler main/dropmarker command-versus-view
  routing;
- remaining simple built-in activation through the native node command with
  `moveToAnchor` re-anchoring of node panels and bounded-timeout `false`
  settlement when no panel appears;
- stale-handle, foreign-host, and empty-handle rejection with privacy-safe
  typed diagnostics;
- deterministic disposal of the CustomizableUI listener, MutationObserver,
  popup listeners, pending waiters, handle registry, and any held panel;
- adapter validation (including bounded part arrays), trigger-event forwarding,
  revision reduction, popup forwarding, listener/dispose idempotence, and
  invoke result checks.

The following are `not run`, not passed: real mirroring of an installed
extension (icon, badge, popup), customize-mode pin/unpin round-trips,
extension install/removal/disable while a window is open, private-window
presentation of non-private-allowed extensions, second-window independence,
badge updates from live extensions, and overflow scrolling inside the
flexible top widget zone on narrow layouts. Also `not run`: Account in
signed-out/unverified/signed-in states, Library and All Tabs placement,
Bookmarks/Share/Send native menus, Zoom/Edit child commands, Profiler
main/dropmarker behavior, live Zoom percentage rendering after zoom and tab
changes, and popup placement for each from all four edges in Firefox 153/154.
Implementation/source evidence is in
`docs/research/firefox-153-toolbar-widget-mirror.md` and
`docs/research/firefox-153-154-toolbar-widget-activation.md` and
`plans/005-topbar-widget-mirror.md`.

### 6.9 Fennevia-owned customize mode — focused automation complete, real Firefox pending

ADR-045 adds focused unit/static/build coverage for:

- layout-driven four-zone snapshots with the ADR-044 nav-bar mirror as the
  default top zone until the first edit;
- opaque palette tokens for unused/placed CustomizableUI widgets, Fennevia
  `show-bookmarks` / `show-downloads` / `show-translate` widgets
  (`show-downloads` opens Firefox's `#downloadsPanel`; `show-translate`
  delegates to Firefox's built-in translation panel), and spacer/spring/separator
  specials, with the fixed skip list (including Unified Extensions and app-menu
  buttons already represented by fixed Fennevia controls);
- versioned `fennevia.customize.layout` / `fennevia.customize.style` JSON
  bounded to 16 KiB, fail-safe parse, and preference-observer republish;
- validated `add` / `move` / `remove` / `reset-layout` / `set-style` /
  `reset-style` operations with a revision guard;
- bounded adopt/restore writes: `addWidgetToArea(id, "nav-bar")` for widgets
  with no live node, restore to `AREA_ADDONS` for extensions and
  `removeWidgetFromArea` otherwise;
- style tokens for theme, accent, panel surface, chrome background, text,
  border, blur, radius, density, surface opacity, saturation, shadow, motion,
  font size, in-window hide delay, window-leave hide delay, temporary reveal
  duration, shortcut-tip duration, and trigger thickness,
  including NativeUi `--fennevia-chrome-background` on
  `:root#main-window` and skip of color overrides under forced colors /
  motion duration under reduced motion;
- ADR-054 interaction bounds and defaults (300 ms in-window and 800 ms
  window-leave within 100–5,000 ms, 1,200 ms within 400–10,000 ms, 600 ms
  within 0–10,000 ms, and 12 CSS px within 6–24 CSS px), additive loading of
  older version-1 style prefs, null/non-null pointer-destination routing plus
  window-blur fallback, zero-disabled shortcut tips, pending-hide timer
  rearming, shared CSS/arbitration trigger input, and no second timer or
  preference;
- empty style colors resolving to Firefox chrome design-system tokens
  (ADR-051) rather than a private RGB palette;
- missing `CustomizableUI` hiding zones and missing `Services.prefs` disabling
  editing, neither joining activation health;
- privacy assertions that widget ids never enter the serialized frontend
  snapshot and that style tokens apply as a fixed CSS custom-property set on
  the frame root plus NativeUi `--fennevia-chrome-background` on `:root`;
- ADR-046 palette presentation: unused XUL nodes resolved from
  `gNavToolbox.palette`, a dedicated sync `Localization` (pinned
  `browser`/`sidebar`/`appmenu`/`screenshots` FTL plus allowlisted chrome
  localization links; `document.l10n` is async after startup) /
  `getLocalizedProperty` names, CSSOM / pinned `list-style-image`
  chrome/resource URLs, no `wrapper.forWindow` call, and
  CSS-mask rendering rather than `<img src>` for built-in icons;
- deterministic disposal of the CustomizableUI listener, preference observer,
  MutationObserver, popup listeners, pending waiters, handle/token registries,
  and frame style properties.
- ADR-047 live-zone HTML5 drag-and-drop: customize session popup-holds all
  four edges, opaque drag payload, drop mapping to `add`/`move`/`remove`,
  keyboard Delete/Ctrl+Arrow/palette Enter, and popup-close re-hold.

The following are `not run`, not passed: live Fennevia customize drawer against
a collapsed navbar, four-edge placement round-trips, **live-zone drag from
palette onto each edge and back**, adopt/restore of an
installed extension, style tokens under forced colors and reduced motion,
default Firefox Light/Dark design-token colors on owned surfaces,
minimum/default/maximum trigger hit testing and live hide/reveal timings,
multi-window pref observation, layout reset restoring native placements, and
Escape/focus restoration while a widget popup is also held. Implementation/
source evidence is in `docs/research/firefox-153-customize-mode.md` and
`plans/006-customize-mode.md`.

### 6.10 Four-panel context menus — focused automation complete, real Firefox pending

Validate each top/left/right/bottom panel from pointer right-click and from a
focused control with the Context Menu key or Shift+F10:

- top exposes Firefox Settings;
- neutral left content exposes New Tab while a tab row retains Firefox's
  complete translated native menu;
- neutral right content exposes Manage Bookmarks while a bookmark/folder row
  retains its bounded item actions;
- bottom exposes Firefox Downloads and keeps the surface held until the native
  popup closes;
- capability-backed common actions expose Customize Fennevia, Customize
  Firefox Toolbar, and Show Original Firefox Toolbar without placeholder
  entries;
- role/menuitem semantics, first-item focus, Arrow Up/Down, Home/End, Escape,
  keyboard-origin positioning, focus restoration, frame clamping, descendant
  propagation ownership without parent interception, pointer exit retaining
  both menu and working-panel holds, outside pointer/window-blur close, surface
  hide, focused-item blur before pointer teardown, and component disposal;
- exactly one existing per-edge popup hold is active while a project menu is
  open, and no document/window listener or hold survives close/failure/disposal;
- no fixed action leaks a URL, title, bookmark GUID, download detail, native
  node, or private-window state to DOM attributes, persistence, or diagnostics.

Focused source-contract, localization-parity, bridge failure, state, and
cleanup tests pass. Real Firefox 153.0.4/154 placement, translated-label,
original-chrome suppression, native Downloads/Library ownership,
normal/second/private-window, forced-colors, high-DPI, and disposal rows are
**not run**, not passed. Evidence: ADR-055 and
`docs/research/firefox-153-154-panel-context-actions.md`.

### 6.11 Hidden-toolbox native popup and security-notification policy — focused automation complete, owner-observed AMO fallback, remaining real Firefox pending

ADR-056 adds relationship-based proxy coverage; ADR-057 adds the security-owner
exception and direct translation widget path:

- a translation panel whose `anchorNode` is the collapsed
  `#translations-button` stays Firefox-owned and moves to the fixed Fennevia
  proxy without setting `data-fennevia-native-ui-revealed`;
- the lazy `window.PopupNotifications` getter is not eagerly read; once Firefox
  materializes the owner, the original `_getVisibleAnchorElement` callback runs
  first and substitutes the fixed proxy only for a healthy hidden-toolbox
  anchor;
- the shared `#notification-popup` pre-anchored this way keeps original chrome
  hidden in the focused healthy-route fixture, never calls `moveToAnchor` after
  `popupshown`, and cleans its tracked hold on close so install/permission and
  other notification families retain one original anti-clickjacking timing
  cycle;
- the owner-observed Firefox 154 AMO path currently reveals complete original
  chrome; this is the accepted fail-open presentation, and AMO-specific
  suppression is not a completion requirement while Firefox's prompt and
  security timing remain usable;
- an absent, incompatible, or ineffective pre-anchor reveals complete Firefox
  chrome, and disposal before/after owner materialization restores the exact
  lazy getter or callback;
- a placeable `show-translate` widget delegates to
  `FullPageTranslationsPanel.open(event)`, preserves the initiating event,
  keeps the exact `#full-page-translations-panel` route alive across Firefox's
  fire-and-forget private open promise until the lazy panel is shown, restores
  the owner method, and degrades as one optional capability;
- an unrelated built-in toolbox panel proves that the behavior does not depend
  on translation/install IDs;
- one-turn deferral after `popupshown` lets an existing toolbar-widget bridge
  move to its exact clicked project host first, and the generic proxy does not
  overwrite it;
- token-listed, already-Fennevia-anchored, tooltip, tab-preview,
  `nopreventnavboxhide`, content, sidebar, suspended, and deliberately revealed
  native-toolbar paths keep their existing behavior;
- missing or ineffective `moveToAnchor()` reveals the complete Firefox chrome;
  a thrown call records `FENNEVIA_NATIVE_UI_POPUP_PROXY_FAILED`, suspends
  hiding, and enters per-window fail-open;
- exact proxy ID/parent/marker/style health, pending/proxied privacy-safe counts,
  hide/suspension/unload timer cleanup, popup cleanup, and idempotent disposal.

Except for the owner-observed Firefox 154 AMO native-chrome fallback, real
Firefox 153.0.4/154 placement, focus, arrow direction, close behavior, and
security-delay checks for automatic translation and the placeable widget;
extension install/progress/
confirmation/failure; WebExtension permission; location/media/notification/
password/WebAuthn prompts; bookmark/page-action panels; narrow/maximized/
fullscreen/high-DPI windows; second/private windows; and injected move failure
are **not run**, not passed. Evidence: ADR-056, ADR-057,
`docs/research/firefox-153-154-native-popup-proxy.md`, and
`docs/research/firefox-153-154-install-notification-and-translations-widget.md`.

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

Current package `0.11.0-beta.1` performs the sole production activation only after
the health phase requires:

- exact frame identity and placement;
- ordered top/left/right/bottom hosts plus the final address-overlay host;
- five XHTML mount targets and XHTML structural/frontend mask nodes, with SVG
  limited to reviewed project-authored `svg[data-fennevia-icon]` exception
  subtrees;
- five frontend roots;
- attached parsed project CSS;
- edge reveal controller;
- initialized four-root bookmarks state and a successful first bounded page;
- a ready PUBLIC/PRIVATE Downloads list view and valid bottom-panel state;
- a valid Urlbar-coverage snapshot, one owner-state observer, and native
  `openLocation()` handoff capability;
- a valid Urlbar-suggestions snapshot, required input/controller/shared-manager
  and execution capabilities, and one project combobox/listbox;
- a valid browser-tools snapshot, all fixed native-panel/tool actions, and
  host-anchored popup placement plus synchronous original-toolbar reveal
  capability;
- a valid window-controls snapshot and project-owned top-row min/max/close
  buttons;
- exact Firefox native target/titlebar ownership, an attached exact activation
  style with seven parsed rules, and synchronous native Urlbar reveal capability;
- environment/suspension handling;
- privileged emergency handler;
- every declared required capability;
- a literal successful health result before the finite deadline.

The initializer then calls `lifecycle.activate()` exactly once. Its active
marker is the durable state that enables NativeUi hiding. ADR-050 may collapse
the same toolbox surfaces before `active` through a process-scoped author
sheet; that sheet is not a substitute for the health gate. A failed activation
enters the same fail-open disposal path, which also stops the pending-hide
selector by setting `data-fennevia-failed` or clearing the window.

If any step fails:

1. remove or never set `data-fennevia-active`;
2. abort pending initialization;
3. unmount every created frontend root;
4. dispose bridge contexts and feature subscriptions;
5. clear edge holds and timers;
6. remove style and frame descendants;
7. report the privacy-safe first causal phase/stack;
8. leave core native Firefox UI unchanged. The ADR-050 startup sheet stops
   matching when `failed` or `suspended` is set, and otherwise self-expires at
   2,000 ms even if JavaScript never runs again.

### 8.1.1 First-paint native hide

ADR-050 registers `StartupNativeHide.css` as a process `AUTHOR_SHEET` when the
runtime starts, before delayed-startup window work. The sheet applies only to
`navigator:browser` `browser.xhtml` roots and only while `active`, `failed`,
and `native-ui-suspended` are absent. Empty `100%` keyframes restore Firefox
cascade values after 2,000 ms. Hosts, bridges, and Svelte stay on delayed
startup.

Until `WindowShell` registers `Ctrl+Alt+Shift+F12`, the CSS deadline is the
fail-open path for a hung privileged runtime. Safe start and Firefox safe mode
never import the runtime, so the sheet is never registered.

| Check                                                                             | Current result                                                                        |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Unit/static register, unregister, timeout lock, fail-open selectors               | Implemented                                                                           |
| Real Firefox cold-start native toolbox flash                                      | `not run`                                                                             |
| Real Firefox CSS 2 s watchdog restore of toolbox geometry                         | `not run`                                                                             |
| Real Firefox Windows pre-XUL skeleton with the pref disabled                      | `not run`                                                                             |
| Real Firefox safe-start / broken AutoConfig still shows native chrome immediately | `not run` for this sheet; historical safe-start evidence remains in the health record |

Evidence: `docs/research/firefox-153-startup-native-hide.md`.

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
- XHTML structural namespaces (including packaged-resource mask spans) and SVG
  only below reviewed project icon exception roots;
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
- missing tabs/navigation/address/Urlbar-coverage/Urlbar-suggestions/Places/
  Downloads capability;
- malformed/stale/foreign snapshots and IDs;
- Urlbar query/result/start/pick failure, empty replacement batch, late
  callback, foreign result token, or controller-restore failure;
- feature component failure;
- disposal during a pending hide, focus/popup hold, navigation event, address
  submission, Urlbar provider query/result/native handoff, Places query/
  observer callback, or Downloads callback;
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

node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>' `
  --urlbar-provider-probe

node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>' `
  --urlbar-suggestions-probe

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

The two Urlbar modes are focused compatibility checks. The provider mode proves
the selected shared-manager contract without constructing native rows. The
suggestions mode proves the built project combobox and one fixed internal direct
result through Firefox execution. Neither mode logs query/result text or
substitutes for the provider, private-window, accessibility, or release matrix
in §6.4.1.

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

| Milestone                      | Evidence                                                      |
| ------------------------------ | ------------------------------------------------------------- |
| Development profile            | `docs/development-setup.md`                                   |
| Bootstrap                      | `docs/research/firefox-153-bootstrap.md`                      |
| Identity migration             | `docs/research/fennevia-identity-migration.md`                |
| Installer lifecycle            | `docs/research/fennevia-installer-validation.md`              |
| Window lifecycle               | `docs/research/firefox-153-window-lifecycle.md`               |
| Initial XHTML hosts            | `docs/research/firefox-153-shell-hosts.md`                    |
| Health and recovery            | `docs/research/firefox-153-shell-health-recovery.md`          |
| Svelte build                   | `docs/research/firefox-153-svelte-build.md`                   |
| Firefox boundary               | `docs/research/firefox-153-bridge-boundary.md`                |
| Tabs bridge                    | `docs/research/firefox-153-tabs-bridge.md`                    |
| Tab UI                         | `docs/research/firefox-153-tab-strip.md`                      |
| Four-edge frame                | `docs/research/firefox-153-four-edge-shell.md`                |
| Default chrome design tokens   | `docs/research/firefox-153-design-tokens.md`                  |
| Top navigation                 | `docs/research/firefox-153-navigation-controls.md`            |
| Address launcher and popup     | `docs/research/firefox-153-address-popup.md`                  |
| Urlbar coverage                | `docs/research/firefox-153-urlbar-coverage.md`                |
| Native Urlbar suggestions      | `docs/research/firefox-153-154-native-urlbar-suggestions.md`  |
| Right-edge bookmarks           | `docs/research/firefox-153-bookmarks-surface.md`              |
| Bottom-edge downloads          | `docs/research/firefox-153-downloads-surface.md`              |
| Content-only activation        | `docs/research/firefox-153-content-only-activation.md`        |
| First-paint native hide        | `docs/research/firefox-153-startup-native-hide.md`            |
| MVP hardening/update rehearsal | `docs/research/firefox-153-mvp-hardening-update-rehearsal.md` |
| Persisted session restore      | `docs/research/firefox-153-session-restore-rehearsal.md`      |
| Release packaging/distribution | `docs/research/fennevia-release-packaging.md`                 |

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
