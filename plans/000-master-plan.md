# Master Plan: Fennevia Content-First Four-Edge Firefox Shell

## 1. Vision

Build a distinct, content-first browser chrome on top of stock Firefox without
compiling or maintaining a Firefox fork. Firefox remains the Gecko/browser
platform and continues to own security-sensitive browser infrastructure.
Fennevia provides a small privileged integration runtime, typed bridge modules,
and project-owned Svelte UI.

The target interface has four independent floating edge surfaces:

- **Top:** primary browser controls.
- **Left:** vertical tabs and a compact address/status launcher.
- **Right:** bookmarks.
- **Bottom:** download progress and status.

The launcher opens a centered project-owned address/search popup. Compact and
detailed connection/HTTPS and tracking-protection status comes from current
Firefox state; native identity, protections, permission, and page-action panels
remain Firefox-owned.

All four surfaces are hidden at rest and reserve no permanent layout space.
They reveal through their matching pointer edge or an accessible keyboard/focus
path, float above content, and share one Fennevia-owned reveal, collision,
accessibility, cleanup, and glass-design contract.

Only after every required feature passes while Firefox native UI remains visible
may a reversible per-window `active` gate hide the exact native surfaces with
verified replacements. Native browser-content infrastructure, OS window
controls, permissions, authentication, certificate, extension-install,
download-safety, dialog, notification, popup, and DevTools behavior remains
Firefox-owned.

## 2. Current baseline

As of 2026-08-16, package `0.10.0-dev` is validated on Firefox 153.0.4 for
Windows in an isolated copied Firefox program and marker-owned development
profile.

Completed:

- #2 and #17: safe development environment and privileged-code security
  baseline;
- #3 and #4: minimal bootstrap and path-safe package lifecycle;
- #5, #6, and #7: process/window lifecycle, XHTML ownership, health states,
  safe start, emergency fallback, and fail-open cleanup;
- #8: deterministic Svelte 5/TypeScript/Vite production build;
- #9 and #10: enforceable Firefox boundary and typed tab-state bridge;
- #11: accessible custom tab UI, now rendered vertically in the left edge;
- #31: zero-layout four-edge frame, shared reveal controller, corner/collision
  policy, glass tokens, accessibility fallbacks, and complete cleanup;
- #12: event-driven selected-navigation bridge and top-edge Back, Forward,
  Reload/Stop, and New Tab controls with bounded page status;
- #13: compact left address/status launcher, centered address/search popup,
  native Urlbar submission and healthy-only `Ctrl+L`, real Firefox connection
  and tracking-protection state, and a fifth owned overlay root.
- #14: bounded/lazy typed Places bridge, event-driven right-edge bookmarks,
  opaque opening actions, and keyboard-accessible hierarchy;
- #32: per-window typed Downloads list views, bounded anonymous state,
  event-driven bottom-edge aggregate progress/status, and native
  safety/management retention;
- #37: full current Urlbar status/action inventory, fixed permission/action
  coverage in the detailed popup, and complete Firefox native-Urlbar handoff;
- #15: exact health-gated content-only activation, complete retained native
  reveal, and reversible per-window fail-open cleanup;
- #16: fixed local/CI PowerShell gates, aggregate performance/resource mode,
  exact one-sided ownership repair, reconciled compatibility inventory, and an
  executable Firefox stable-update rehearsal.

Remaining project-governance work:

- #18: project license and third-party attribution decision.

At active rest, only ADR-032's exact native toolbar/sidebar descendants are
collapsed; Firefox DOM, prompts, dialogs, controls, and a complete transient
native access path remain attached. The four-edge MVP is implementation-
complete for the tested Windows/Firefox baseline, but it is not a versioned
public release and has no Linux/macOS support claim.

## 3. Success criteria

- No runtime dependency on Alice0775, fx-autoconfig, another generic loader, or
  `my-firefox-custom`.
- A minimal AutoConfig bootstrap that can be understood, tested, installed,
  disabled, and removed independently.
- A project-owned Chrome Registry namespace for fixed privileged modules and
  assets.
- One process runtime and deterministic per-window lifecycle for normal,
  second-normal, and private windows.
- Four independently owned XHTML edge surfaces mounted through one shared frame
  and window lifecycle.
- Hidden-at-rest surfaces that add no permanent top, left, right, or bottom
  content margin.
- A shared edge controller for pointer, keyboard, focus, popup, delayed hide,
  deterministic corners, suspension, and cleanup.
- A Fennevia-owned frosted-glass design system with solid, reduced-motion,
  reduced-transparency, and forced-colors fallbacks.
- A frontend framework that manages only project-owned descendants.
- Firefox internal APIs isolated behind small typed bridge modules.
- A usable top navigation surface, combined left tabs/address-launcher surface,
  centered address popup, right bookmarks surface, and bottom download-status
  surface.
- A fail-open recovery path that immediately restores native Firefox UI without
  depending on Svelte.
- A reviewed native-UI coverage inventory before any native surface is hidden.
- A reproducible research workflow for breakage caused by Firefox stable
  updates.
- A documented security, privacy, dependency, logging, resource-exposure,
  installation, testing, and provenance baseline for system-principal code.
- At least one real Firefox stable transition handled with a complete
  before/after record when such an update becomes available.

## 4. Non-goals

- A generic `.uc.js` loader or userscript manager.
- Support for multiple historical Firefox versions.
- A complete Urlbar suggestion/provider ecosystem.
- Complete Firefox View, identity, permission, extension-action, bookmarks,
  history, Downloads, or SessionStore replacement.
- Custom titlebar, window buttons, or OS window controls in the initial roadmap.
- Overriding the complete `browser.xhtml`.
- A branded Firefox fork, update channel, public installer, or support product.
- Pixel-for-pixel copying of Firefox, `my-firefox-custom`, Arc, Edge, or another
  browser.
- Treating hardening as a container for unrelated product features.

## 5. Architecture principles

1. **Own instead of patch.** Create project-owned UI rather than mutating native
   widget internals.
2. **Bridge instead of leak.** Firefox-native objects never enter Svelte or
   serializable application state.
3. **Use one shared edge contract.** Feature modules consume #31's hosts,
   triggers, reveal/collision policy, glass tokens, accessibility behavior, and
   disposer instead of building parallel mechanisms.
4. **Hide only after complete healthy coverage.** Native visibility is the last
   activation step, never an early development shortcut.
5. **Preserve infrastructure.** Keep web-content containers, commands,
   controllers, popups, dialogs, permissions, notifications, SessionStore,
   Places, Downloads, DevTools, and OS controls.
6. **Quarantine overrides.** High-risk resource overrides default to zero and
   require separate decisions, source pins, tests, and removal plans.
7. **Require evidence before abstraction.** Prove current startup, lifecycle,
   event, DOM, focus, cleanup, and Firefox-command behavior before generalizing.
8. **Fail open.** Any failed, unknown, unsupported, or disposed state exposes
   native Firefox UI.
9. **Minimize privileged attack surface.** Keep dependencies, resource
   exposure, logging, user-derived data, and installer scope constrained.
10. **Preserve historical evidence.** Supersede architecture through current
    plans and ADRs; do not rewrite old research records.
11. **Reference, do not copy.** External customizations are compatibility or
    product-direction signals, not implementation templates.

## 6. Phases and gates

### Phase 0: Safe development environment — complete

Deliverables:

- dedicated marker-owned Firefox development profile;
- explicit copied Firefox program and launch procedure;
- Firefox version/build/channel/project environment record;
- Browser Console and Browser Toolbox access;
- profile reset, cleanup, and path-safety rules.

Gate: testing can be repeated without modifying a daily-use profile.

Evidence: #2 and `docs/development-setup.md`.

### Phase 0.5: Security and privacy foundation — complete

Deliverables:

- privileged-code threat model;
- logging and diagnostic redaction rules;
- dependency and supply-chain policy;
- Chrome/resource exposure policy;
- installer path-safety requirements;
- security reporting and review triggers.

Gate: privileged and dependency work proceeds under explicit controls.

Evidence: #17, `plans/003-security-foundation.md`,
`docs/security-and-privacy.md`, and `docs/security-controls.md`.

### Phase 1: Minimal bootstrap and Chrome package — complete

Deliverables:

- AutoConfig resolves the selected profile package;
- source-validated Chrome Registry registration;
- one fixed project-owned `.sys.mjs` entry;
- process guards and privacy-safe fatal records;
- deterministic install, update, disable, enable, and uninstall;
- exact owned-file manifest and rollback/recovery behavior.

Gate: repeatable cold starts initialize once and uninstall restores stock
behavior.

Evidence: #3, #4, ADRs 001–018, and the bootstrap/installer research records.

### Phase 2: Window lifecycle, hosts, health, and recovery — complete

Deliverables:

- existing and later browser-window discovery;
- explicit normal, second-normal, and private behavior;
- one per-window cleanup registry;
- project-owned XHTML mount boundaries;
- validated health state machine;
- safe start before package import;
- Svelte-independent privileged emergency fallback;
- deterministic partial rollback and disposal.

Historical progression:

- #6 first proved a primary/sidebar/overlay three-host spike.
- ADR-026 and #31 supersede only that production geometry with one zero-layout
  frame and four independent edge hosts.
- The #6 research record remains historical evidence for namespace, insertion,
  ownership, and rollback.

Gate: no duplicate initialization, half-mounted window, hidden native UI, or
retained listener remains after close/fallback/disposal.

### Phase 3: Frontend build feasibility — complete

Deliverables:

- Svelte 5, TypeScript, and Vite production build;
- one fixed tree-fragment IIFE and extracted frame-scoped CSS;
- four independent edge roots plus one centered address-overlay root under the
  shared frame;
- deterministic byte-for-byte production output;
- no CDN, HMR, source map, runtime network dependency, or unexpected chunk;
- mount, unmount, remount, XHTML namespace, event, and CSS-isolation evidence.

Gate: state, events, styles, cleanup, artifact policy, and multi-window smoke
tests pass in Firefox chrome.

Evidence: #8, ADR-022, ADR-026, and
`docs/research/firefox-153-svelte-build.md`.

### Phase 4: Typed Firefox bridge and state model — complete for pre-activation features

Shared deliverables:

- per-window bridge contexts;
- required and optional capability checks;
- typed privacy-safe errors;
- context-scoped opaque native-handle registries;
- explicit subscriptions and idempotent disposal;
- static shell/application import boundary.

Tabs deliverables:

- event-driven ordered immutable snapshots from `gBrowser.openTabs`;
- stable context-bound IDs;
- select, open-new-tab, close, pin, and unpin actions;
- bounded text and safe favicon handling;
- stale, malformed, and foreign-ID rejection;
- ordinary Svelte-independent tab adapter.

Gate for each bridge: native and shell actions remain synchronized without
polling or leaked native objects.

Completed: #9, #10, the navigation bridge in #12, the address/status extension
in #13, the Places/bookmarks bridge in #14, the Downloads bridge in #32, and
the Urlbar-coverage bridge in #37. Issues #12–#14, #32, and #37 keep native
browser, command, Urlbar,
identity/protections handler, Places record, URL, Downloads list/view/object,
path, byte, permission record, extension identity, page-action ID, event,
observer, and progress values private while exposing immutable bounded ordinary
state and explicit current-window actions. See ADR-027, ADR-028, ADR-029,
ADR-030, ADR-031,
`docs/research/firefox-153-navigation-controls.md`,
`docs/research/firefox-153-address-popup.md`,
`docs/research/firefox-153-bookmarks-surface.md`, and
`docs/research/firefox-153-downloads-surface.md`, and
`docs/research/firefox-153-urlbar-coverage.md`.

### Phase 5A: Four-edge shell foundation — complete

Deliverables from #31:

- one zero-layout frame under the validated browser hierarchy;
- independent top, left, right, and bottom XHTML surfaces;
- hidden-at-rest state with no permanent content geometry;
- framework-independent edge state controller;
- pointer, keyboard, focus, popup, and bounded programmatic holds;
- one tracked anti-flicker timer per edge;
- deterministic corner ownership and overlap clearances;
- suspension policy for native modal state, customize mode, and DOM fullscreen;
- keyboard reveal, `Escape`, focus transfer, and focus restoration;
- frame-scoped glass tokens and accessibility fallbacks;
- all-or-nothing mount and complete disposal.

Gate: all four surfaces reveal independently and safely while Firefox native UI
remains visible.

Evidence: ADR-026 and
`docs/research/firefox-153-four-edge-shell.md`.

### Phase 5B: Usable edge features — complete

#### Left vertical tabs — complete (#11)

- native-order vertical list;
- selected/title/favicon/pinned/loading state;
- select, new, close, pin, and unpin;
- bounded vertical overflow;
- keyboard navigation and deterministic close-focus recovery;
- ordinary bridge contracts only;
- native tab strip retained.

Evidence: ADR-025, ADR-026, and
`docs/research/firefox-153-tab-strip.md`.

#### Top primary controls — complete (#12)

- selected-browser navigation bridge;
- Back and Forward enabled state;
- Back, Forward, Reload/Stop, and New Tab actions;
- current Firefox command semantics;
- bounded text-only title and display-URI status;
- selected/top-level event-driven synchronization without polling;
- top-edge UI through #31's reveal, focus, collision, and accessibility contract;
- normal, second-normal, private, cleanup, capability-failure, and recovery
  validation while native navbar and Urlbar remain visible.

Evidence: ADR-027 and
`docs/research/firefox-153-navigation-controls.md`.

#### Compact address launcher and centered popup — complete (#13)

- non-editable bounded committed location in a compact left launcher;
- compact real Firefox connection/HTTPS and tracking-protection status;
- one centered project-owned popup with independent draft/editing state and
  fuller status text;
- Firefox-owned URL fixup/search/principal/load behavior through the native
  Urlbar command path;
- healthy-only `Ctrl+L` ownership with unchanged native fallback;
- popup-priority suppression of the four edge surfaces, focus restoration, and
  deterministic cleanup;
- native Urlbar, identity/protections panels, permissions, and page actions
  retained; #37 completes their reviewed coverage and handoff.

Evidence: ADR-028 and
`docs/research/firefox-153-address-popup.md`.

#### Right bookmarks — complete (#14)

- typed Places bridge;
- bounded/lazy roots and child queries;
- event-driven native bookmark updates;
- current-tab and source-validated new-tab opening;
- right-edge tree/list accessibility.

The implementation uses four localized roots, 32-item replaceable pages,
depth/expansion caps, per-window opaque IDs and observers, native
`PlacesUIUtils` opening, and the shared #31 right-edge/focus contract. Native
bookmark UI remains visible. Normal, second, private, live-mutation,
Browser-Toolbox, cleanup, and fail-open recovery evidence passed.

Evidence: ADR-029 and
`docs/research/firefox-153-bookmarks-surface.md`.

#### Bottom downloads — complete (#32)

- typed Downloads bridge;
- determinate and indeterminate aggregate progress;
- active count and bounded safe item summary;
- event/view-driven updates;
- no unsolicited panel opening;
- native safety and management UI retained.

The implementation uses one Firefox PUBLIC or PRIVATE list view per managed
window, context-bound opaque IDs, six anonymous items, three newly observed
terminal states, state counts capped at 999, weighted known-size progress, and
explicit indeterminate progress when any active total is unknown. Native
objects, filenames, paths, source URLs, byte values, and private markers do not
cross the bridge. The surface receives hidden updates without acquiring a
reveal hold and adds no action or polling timer. Normal, second, private,
native-panel alternation, Browser-Toolbox, hard-disable, cleanup, and fail-open
evidence passed.

Evidence: ADR-030 and
`docs/research/firefox-153-downloads-surface.md`.

#### Detailed Urlbar coverage and native handoff — complete (#37)

- exact Firefox 153 leading/trailing item and notification-anchor inventory;
- compact left launcher still limited to real connection/HTTPS and ETP status;
- centered popup adds fixed sharing/blocked-permission and applicable-action
  labels;
- one read-only per-window owner-state observer with deterministic cleanup;
- no principal, certificate, permission record, extension identity, action ID,
  provider result, or native node crosses the bridge;
- full Firefox Urlbar, providers, prompts, panels, and commands retained through
  `window.openLocation()`;
- real HTTP, valid HTTPS, internal, network-error, permission, ETP, dynamic
  action, normal/second/private, Browser Toolbox, and fail-open evidence.

Evidence: ADR-031 and
`docs/research/firefox-153-urlbar-coverage.md`.

Gate: basic browsing and required access paths work entirely through custom
surfaces while native UI remains visible for comparison and fallback.

### Phase 6: Content-only activation — complete (#15)

Preconditions:

- #7, #31, #11, #12, #13, #14, #32, and #37 complete;
- every feature validated in normal, second-normal, and private windows while
  native UI remains visible;
- native-UI coverage inventory contains no unexplained hidden descendant or
  unreachable required action;
- emergency fallback and safe start pass against broken packages.

Deliverables:

- root-state-gated rules hide only the narrowest native surfaces with complete
  replacements;
- #37's native handoff reveals/focuses the retained Urlbar while active and
  every trust/identity/protections/permission/extension/action panel and prompt
  remains reachable;
- all Fennevia surfaces remain hidden at rest;
- only narrow edge triggers remain interactive;
- clearing `active` restores native UI immediately without Svelte or restart;
- fullscreen, DOM fullscreen, customize mode, DevTools, dialogs, prompts,
  notifications, native menus, extension access, Library, Downloads access, and
  OS controls have explicit policies;
- missing bundle, CSS, host, controller, command path, or bridge capability
  fails open.

Gate: controlled breakage never leaves Firefox without an operable native
recovery path.

Delivered by ADR-032:

- the production initializer activates only after the complete health check;
- one exact five-rule per-window controller collapses horizontal native tab
  items/navbar, bookmarks toolbar, and exact native sidebar surfaces;
- native vertical-tab mode retains its navbar titlebar owner;
- titlebar controls, notifications, popups, dialogs, tabbox/content, and
  DevTools remain untargeted;
- toolbox focus/pointer, anchored popups, an open native sidebar, and #37's
  Urlbar handoff reveal the complete retained native path;
- customize/native-dialog/DOM-fullscreen policy suspends project hiding;
- invalid or partial activation CSS and stable native-target drift fail open
  per window.

Gate passed on Firefox 153.0.4 with active rest/geometry, all four edge paths,
normal/second/private isolation, complete Urlbar handoff, native Downloads and
History-sidebar holds, customize/browser-fullscreen transitions, Browser
Toolbox ownership, emergency fallback, partial CSS failure, safe start, and
recovery evidence.

Evidence: ADR-032 and
`docs/research/firefox-153-content-only-activation.md`.

### Phase 7: Hardening and update workflow — complete (#16)

Deliverables:

- complete Firefox-internal and native-visibility dependency inventory;
- full four-edge, feature, layout, accessibility, private-window, prompt,
  recovery, install, and cleanup matrix;
- performance and leak baselines;
- CI/local gates for format, lint, typecheck, tests, builds, package inventory,
  resource exposure, boundary checks, and privacy;
- stable-update compatibility workflow and incident template;
- real Firefox stable transition record when an update is available;
- synchronized README, plans, architecture, security, testing, and installation
  documentation.

Gate: an agent unfamiliar with the implementation can install, start, diagnose,
fail open, update, disable, and uninstall Fennevia from repository documentation.

Gate passed on the Firefox 153.0.4 same-build rehearsal. No newer stable was
available on 2026-08-16, so the first real stable transition remains explicitly
not run and must use `docs/firefox-update-workflow.md` when available. Evidence:
ADR-033/ADR-034 and
`docs/research/firefox-153-mvp-hardening-update-rehearsal.md`.

## 7. Target repository layout

```text
program/                         # minimal Firefox program-directory files
profile/chrome/fennevia/
  chrome.manifest
  content/
    Bootstrap.sys.mjs
    runtime/                     # authored privileged runtime
    firefox/                     # generated private bridge ESM
    shell/                       # generated production UI assets
src/
  firefox/                       # Firefox-internal source boundary
  app/                           # ordinary state/controllers
  shell/                         # Svelte four-edge UI and centered address overlay
patches/                         # empty by default; reviewed overrides only
scripts/                         # build, package, diagnostics, and profile helpers
tests/
docs/
  research/                      # immutable milestone/compatibility evidence
plans/
```

`package-manifest.json` is the source of truth for installed project-owned files
and hashes. Generated files are never hand-edited.

## 8. Major risks and mitigations

| Risk                                                     | Mitigation                                                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Firefox changes AutoConfig or manifest registration      | Current-source research, compatibility canaries, minimal bootstrap tests                 |
| Firefox changes internal APIs/events/DOM                 | Small bridge modules, capability checks, internals map, latest-stable-only policy        |
| Svelte or CSS affects native chrome                      | Project-owned roots, frame-scoped selectors, no global reset, Browser Toolbox comparison |
| Edge triggers block web content                          | Narrow measured trigger regions, deterministic corners, pointer-transparent frame        |
| A surface becomes stuck or retains focus                 | Explicit hold state, tracked timers, `Escape`, focus restoration, disposal tests         |
| Native UI is hidden before feature coverage              | #15 blockers, native-UI coverage inventory, active-only rules                            |
| Custom shell fails after activation                      | Safe start, privileged emergency fallback, immediate active clearing                     |
| Native prompts or extension surfaces become inaccessible | Firefox ownership, modal suspension, narrowest possible native hiding                    |
| Multi-window/private state leaks                         | Per-window contexts, opaque IDs, no browsing-derived persistence, cleanup                |
| Build or dependency compromise                           | Locked graph, lifecycle scripts disabled, deterministic builds, artifact scanner         |
| Installer damages another profile                        | Explicit canonical targets, ownership manifests, dry run, rollback, hard refusal         |
| Logs expose browsing data                                | Default-deny schemas, redaction, hostile-value tests, no network sink                    |
| External code is copied without permission               | License/provenance gate and #18 owner decision                                           |

## 9. Issue execution rules

- Complete shared foundations before feature-specific UI.
- Runtime changes must pass with active mode plus complete native reveal and
  fail-open recovery.
- #15 and #16 completed the initial MVP activation and hardening gates; later
  Firefox updates follow the executable compatibility workflow.
- Feature issues use the shared #31 edge contract and the #9 bridge boundary.
- Research work must produce reproducible evidence or a clear negative result,
  not a list of links.
- Acceptance criteria may be refined with evidence but never silently weakened.
- Useful deferred work becomes a separate issue.
- A proposal that approaches fork-level maintenance, broad native-DOM
  replacement, or security-sensitive UI replacement requires a dedicated ADR
  and security review.
- Current normative documents must be synchronized when an issue closes.
  Historical research records remain unchanged.
