# Master Plan: Fennevia Content-First Four-Edge Firefox Shell

## 1. Vision

Build a distinct, content-first browser chrome on top of stock Firefox without
compiling or maintaining a Firefox fork. Firefox remains the Gecko/browser
platform and continues to own security-sensitive browser infrastructure.
Fennevia provides a small privileged integration runtime, typed bridge modules,
and project-owned Svelte UI.

The target interface has four independent floating edge surfaces:

- **Top:** one-line primary browser controls and fixed native Firefox handoffs.
- **Left:** vertical tabs and a compact address/status launcher.
- **Right:** bookmarks.
- **Bottom:** download progress and status.

The launcher opens a centered project-owned address/search popup. Compact and
detailed connection/HTTPS and tracking-protection status comes from current
Firefox state; native identity, protections, permission, and page-action panels
remain Firefox-owned and open from explicit native-detail actions.

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

As of 2026-08-19, public prerelease package `0.10.0-beta.1` remains published
for Windows x64. Validated evidence is Firefox 153.0.4 BuildID 20260810162159
and owner-confirmed ordinary runtime on Firefox 154.0 BuildID 20260812182057.
The installer accepts Firefox 153 and newer after an explicit warning that only
153 and 154 are tested. See
`docs/research/firefox-154-stable-transition.md` and ADR-048.

Completed:

- #2 and #17: safe development environment and privileged-code security
  baseline;
- #3 and #4: minimal bootstrap and path-safe package lifecycle;
- #5, #6, and #7: process/window lifecycle, XHTML ownership, health states,
  safe start, emergency fallback, and fail-open cleanup;
- #8: deterministic Svelte 5/TypeScript/Vite production build;
- #9 and #10: enforceable Firefox boundary and typed tab-state bridge;
- #11: accessible custom tab UI, now rendered vertically in the left edge;
- #60: left-edge flat-list native parity (audio, container, attention,
  middle-click close, drag/keyboard reorder, Firefox `#tabContextMenu`);
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

Current fast branch enhancement under ADR-037, ADR-042, ADR-044, ADR-045, and
ADR-046:

- one non-wrapping top row with navigation, address/page status, loading,
  Firefox tools, and progressive disclosure;
- fixed native Trust/identity, protections, permission, Unified Extensions,
  application-menu, and Settings handoffs without exporting their sensitive
  data; Downloads is available as the placeable `show-downloads` widget;
  native customization and original-toolbar remain bridge actions, not fixed
  top-row buttons;
- popup-opening handoffs re-anchor Firefox-owned panels beside the clicked
  Fennevia host without revealing native chrome;
- retained Firefox caption controls styled in place as a compact island;
- a 7px browser-content gutter, gap-free edge contact, transient shortcut hint,
  panel drag regions, and `top > sides > bottom` collision priority;
- 2px decorative gutter lights for selected-tab loading and active download
  aggregate, without a second trigger or filename text;
- an ADR-044 read-only mirror of the user's nav-bar `CustomizableUI`
  placements as the default top-zone layout, superseded as the only widget
  source by ADR-045: a Fennevia-owned customize mode with four-edge widget
  zones, the full current CustomizableUI inventory as an opaque-token palette,
  bounded style tokens, profile-local prefs, and owner-approved adopt/restore
  writes onto the collapsed nav-bar. ADR-046 restores localized widget names
  and native built-in icons (CSS mask, not `<img>`) in that palette and in
  widget zones. ADR-047 makes placement a live four-edge HTML5 drag-and-drop
  session (palette plus style stay in the top-host drawer). Native customize
  mode stays available
  through the Firefox application menu, complete native reveal, and fail-open;
  it is not a fixed top-row control.

Focused type/build/unit/static checks cover this enhancement. Its real Firefox
manual matrix remains pending and is not part of the earlier #15 validation.

Completed project-governance foundation:

- #18: MPL-2.0 project/inbound license, generated/installed artifact treatment,
  third-party provenance source of truth, and distribution checklist.
- #39: deterministic versioned Windows release staging, exact source and file
  manifest, registered-profile release mode, Firefox compatibility records,
  checksum, annotated-tag rehearsal, verify-before-publish GitHub workflow, and
  independently reverified public `v0.10.0-beta.1` prerelease. ADR-048 later
  relaxed the exact BuildID install gate to Firefox 153+ with a warning.
- #57: PowerShell console for release install/update/recovery and development
  environment setup, launch, and teardown, without changing the installer
  transaction contract.

At active rest, ADR-032/ADR-037 collapse only reviewed native toolbar/sidebar
geometry and descendants, retain the native caption controls, and add a narrow
content gutter; Firefox DOM, prompts, dialogs, controls, and complete transient
native access paths remain attached. The four-edge MVP is implementation-
complete for the tested Windows/Firefox baseline and has a first versioned
public prerelease path. It has no stable/daily-driver, Linux, or macOS support
claim.

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
- Fixed actions that open Firefox's authoritative native detail panels, menu,
  Settings, customization, Unified Extensions, Downloads, and original toolbar
  without copying their private or dynamic data.
- A fail-open recovery path that immediately restores native Firefox UI without
  depending on Svelte.
- A reviewed native-UI coverage inventory before any native surface is hidden.
- A reproducible research workflow for breakage caused by Firefox stable
  updates.
- A documented security, privacy, dependency, logging, resource-exposure,
  installation, testing, and provenance baseline for system-principal code.
- At least one real Firefox stable transition handled with a complete
  before/after record when such an update becomes available. Done for
  153.0.4 → 154.0 ordinary runtime on 2026-08-19; ADR-048 then relaxed the
  installer gate to Firefox 153+ with an explicit untested-version warning.

## 4. Non-goals

- A generic `.uc.js` loader or userscript manager.
- Support for multiple historical Firefox versions.
- A complete Urlbar suggestion/provider ecosystem.
- Complete Firefox View, identity, permission, extension-action, bookmarks,
  history, Downloads, or SessionStore replacement.
- Replacement titlebar/window buttons or custom OS window commands; styling the
  retained Firefox-owned caption group in place is allowed by ADR-037.
- Overriding the complete `browser.xhtml`.
- A branded Firefox fork, automatic update channel, graphical installer, or
  commercial support product.
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

#### Left vertical tabs — complete (#11, #60)

- native-order vertical list;
- selected/title/favicon/pinned/loading/audio/attention/container state;
- select, new, close, pin, unpin, mute, move, and native context-menu handoff;
- bounded vertical overflow;
- keyboard navigation, drag reorder, and deterministic close-focus recovery;
- ordinary bridge contracts only;
- native tab strip retained.

Evidence: ADR-025, ADR-026, ADR-041,
`docs/research/firefox-153-tab-strip.md`, and
`docs/research/firefox-153-tab-strip-parity.md`.

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

#### Single-line toolbar and native detail handoffs — focused implementation complete, manual Firefox pending (ADR-037, ADR-042)

- one compact non-wrapping top row with navigation, top address/popup launcher,
  existing bounded status, loading accent, Firefox tools, and responsive
  progressive disclosure;
- fixed native handoffs for Trust/identity, protections, site permissions,
  Unified Extensions, application menu, and Settings; Downloads is available
  as the placeable `show-downloads` widget; native customization and the
  complete original toolbar remain bridge actions rather than fixed top-row
  buttons;
- six popup actions pass a project-owned host, keep native chrome hidden, and
  re-anchor the Firefox panel beside that host;
- nine fixed booleans/actions only; no certificate, permission, tracker,
  extension, download, widget, preference, URL, or native object crosses;
- Firefox remains the complete data/action/popup owner and the custom HTTPS/ETP
  labels remain summaries;
- Firefox-owned caption buttons retained and styled in place, with empty panel
  chrome draggable and every interactive descendant excluded from dragging;
- independently authored SVG glyphs and no copied code/design/assets from
  `my-firefox-custom`.

Focused source, adapter/controller, type, build, static CSS/native-UI, artifact,
and privacy checks are required before push. Real cold start, native panel
placement against collapsed chrome, caption commands, drag, responsive layouts,
second/private windows, fullscreen, and fallback remain the user's post-push
manual matrix.

Evidence: ADR-037, ADR-042,
`plans/004-single-line-toolbar-ui-ux.md`,
`docs/research/firefox-153-single-line-toolbar-handoffs.md`, and
`docs/research/firefox-153-native-popup-anchoring.md`.

#### Nav-bar widget mirror — focused implementation complete, manual Firefox pending (ADR-044, #64)

- read-only mirror of the user's `CustomizableUI` nav-bar placements in the
  top row with project-owned components: extension actions with real
  icon/badge/name, pinned built-ins with curated or generic project glyphs,
  and spacers as gaps;
- listener events and a bounded attribute observer republish revision
  snapshots without polling;
- extension popups open through `PanelUI.showSubView` anchored on the clicked
  project button; built-ins activate their native node with panel re-anchor;
- owner-approved ADR-044 relaxation: extension identity (label, tooltip,
  `moz-extension://` icon URL, badge) enters frontend memory for rendering
  only and stays banned from logs, persistence, diagnostics, CSS variables,
  and root datasets;
- optional capability: a missing `CustomizableUI` leaves the fixed controls
  and activation health untouched.

The mirror-as-sole-model and "native customize mode is the only editor"
clauses are superseded by ADR-045 below. Evidence: ADR-044,
`plans/005-topbar-widget-mirror.md`, and
`docs/research/firefox-153-toolbar-widget-mirror.md`.

#### Fennevia-owned customize mode — focused implementation complete, manual Firefox pending (ADR-045)

- four-edge widget zones driven by `fennevia.customize.layout`, falling back
  to the ADR-044 nav-bar mirror until the first edit;
- opaque-token palette of every current CustomizableUI widget plus Fennevia
  `show-bookmarks` (right-edge bookmarks) / `show-downloads` (Firefox
  `#downloadsPanel`) widgets and spacer/spring/separator specials;
- project-owned editor: ADR-047 live four-edge HTML5 drag-and-drop with the
  top-host palette/style drawer held through the #31 popup hold on every
  edge, plus keyboard Delete / Ctrl+Arrow / Enter;
- owner-approved persistence of widget ids in the layout pref and bounded
  `addWidgetToArea` / restore writes; extension identity still banned from
  logs, diagnostics, serialized frontend state, CSS variables, and root
  datasets;
- optional editing: missing `Services.prefs` disables the editor without
  joining activation health. Native customize mode remains available through
  the Firefox application menu, complete native reveal, and fail-open.

Evidence: ADR-045, ADR-046, ADR-047, `plans/006-customize-mode.md`, and
`docs/research/firefox-153-customize-mode.md`. The real-Firefox customize
matrix is recorded as pending in `docs/testing-and-recovery.md` §6.9.

ADR-046 (2026-08-19) restores localized widget names and native built-in
icons in the customize palette and widget zones: palette-node / dedicated
sync Fluent Localization / `getLocalizedProperty` labels, CSSOM `chrome://`
/ `resource://` icon URLs painted as CSS masks with `currentColor`, and no
`wrapper.forWindow` node build for presentation.

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

Delivered by ADR-032 and extended by ADR-037:

- the production initializer activates only after the complete health check;
- one exact seven-rule per-window controller collapses reviewed toolbox and
  toolbar geometry, exact non-caption content, bookmarks toolbar, and exact
  native sidebar surfaces, and applies the 7px content gutter;
- native vertical-tab mode retains its navbar titlebar owner;
- Firefox-owned titlebar controls remain attached for fail-open; ADR-038
  collapses every native caption copy at rest and shows project-owned
  window buttons on the visible top row; notifications, popups, dialogs, and
  content remain Firefox-owned;
- native focus, toolbox-anchored Firefox doorhangers, an open native sidebar,
  #37's Urlbar handoff, and ADR-037's original-toolbar handoff reveal the
  complete retained native path;
- Fennevia-initiated Trust/permission/Downloads/extensions/application-menu
  panels that are token-listed or re-anchored to a project host do not reveal
  the navbar;
- customize/native-dialog/DOM-fullscreen policy suspends project hiding;
- invalid or partial activation CSS and stable native-target drift fail open
  per window.

Gate passed on Firefox 153.0.4 with active rest/geometry, all four edge paths,
normal/second/private isolation, complete Urlbar handoff, native Downloads and
History-sidebar holds, customize/browser-fullscreen transitions, Browser
Toolbox ownership, emergency fallback, partial CSS failure, safe start, and
recovery evidence.

That gate result predates ADR-037/ADR-038/ADR-042's changed geometry and
handoffs. The new manual matrix remains pending and must not be reported as
covered by the historical #15 run.

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

Gate passed on the Firefox 153.0.4 same-build rehearsal. The first real
stock-stable transition to Firefox 154.0 BuildID 20260812182057 is recorded in
`docs/research/firefox-154-stable-transition.md` from owner-confirmed ordinary
runtime on 2026-08-19; the full update-workflow mass matrix remains `not run`.
ADR-048 relaxes Install/Update/Repair/Enable to Firefox 153 and newer with an
explicit no-promise warning. Evidence: ADR-033/ADR-034/ADR-048,
`docs/research/firefox-153-mvp-hardening-update-rehearsal.md`, and
`docs/research/firefox-154-stable-transition.md`.

Post-gate issue #46 additionally passed a real clean-shutdown SessionStore
rehearsal across separate Firefox processes. One fixed selected tab, one pinned
tab, and two lazy background tabs restored in identical native/Fennevia order;
the exact pending set remained lazy before interaction; missing-frontend
failure left the native session usable; and cleanup restored one blank tab,
prior preference state, exact package bytes, and no transaction marker.
Evidence: ADR-035 and
`docs/research/firefox-153-session-restore-rehearsal.md`.

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

| Risk                                                     | Mitigation                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Firefox changes AutoConfig or manifest registration      | Current-source research, compatibility canaries, minimal bootstrap tests                   |
| Firefox changes internal APIs/events/DOM                 | Small bridge modules, capability checks, internals map, latest-stable-only policy          |
| Svelte or CSS affects native chrome                      | Project-owned roots, frame-scoped selectors, no global reset, Browser Toolbox comparison   |
| Edge triggers block web content                          | Narrow measured trigger regions, deterministic corners, pointer-transparent frame          |
| A surface becomes stuck or retains focus                 | Explicit hold state, tracked timers, `Escape`, focus restoration, disposal tests           |
| Native UI is hidden before feature coverage              | #15 blockers, native-UI coverage inventory, active-only rules                              |
| Custom shell fails after activation                      | Safe start, privileged emergency fallback, immediate active clearing                       |
| Native prompts or extension surfaces become inaccessible | Firefox ownership, modal suspension, narrowest possible native hiding                      |
| Multi-window/private state leaks                         | Per-window contexts, opaque IDs, no browsing-derived persistence, cleanup                  |
| Build or dependency compromise                           | Locked graph, lifecycle scripts disabled, deterministic builds, artifact scanner           |
| Installer damages another profile                        | Explicit canonical targets, ownership manifests, dry run, rollback, hard refusal           |
| Release bytes are stale, altered, or partially published | Clean-tree double build, exact manifest, SHA-256, annotated tag, verified draft assets     |
| Logs expose browsing data                                | Default-deny schemas, redaction, hostile-value tests, no network sink                      |
| External code is copied without permission               | MPL-2.0 policy, exact provenance gate, root third-party inventory, prohibited unclear code |

## 9. Issue execution rules

- Complete shared foundations before feature-specific UI.
- Runtime changes must preserve active-mode plus complete native reveal and
  fail-open recovery design. During rapid development, CI is the ordinary
  proof gate; the complete real-Firefox matrices run at release.
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
- The project is currently under rapid development. Ordinary issues use CI as
  the required proof gate. The complete real-Firefox and mass-test matrices
  run at release. Safety, privacy, and fail-open rules may be updated or
  relaxed only with explicit project-owner approval.
