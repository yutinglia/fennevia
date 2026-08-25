# Master Plan: Fennevia Content-First Four-Edge Firefox Shell

## 1. Vision

Build a distinct, content-first browser chrome on top of stock Firefox without
compiling or maintaining a Firefox fork. Firefox remains the Gecko/browser
platform and continues to own security-sensitive browser infrastructure.
Fennevia provides a small privileged integration runtime, typed bridge modules,
and project-owned Svelte UI.

The target interface has four independent floating edge surfaces whose content
is composed from bounded widgets, nested Row/Column containers, and one-child
Center/Expanded/Padding wrappers:

- **Top:** always enabled; defaults to primary browser controls, Trust, an
  expanded address launcher, Firefox handoffs, Customize, and project-owned
  window controls.
- **Left/right:** independently optional; default to New Tab plus expanded
  vertical Tabs on Left and expanded Bookmarks on Right.
- **Bottom:** independently optional; defaults to centered movable
  Downloads status.

Main feature widgets follow the nearest Row/Column axis. Ordinary children keep
natural main-axis size and start order; only Expanded or Flexible space claims
remaining space. Compatible stateless
controls may be repeated when the user opts in; stateful feature widgets remain
singleton, while Row, Column, Center, Expanded, Padding, Separator, Space, and Flexible space are always
repeatable. At least one Customize widget must remain in an enabled edge.

Each edge root is the fixed base flow (Top/Bottom Row, Left/Right Column).
Palette Row/Column widgets create only nested groups; existing sole matching
root containers render as that base without redundant editing chrome.
Fresh/reset/fallback state uses one deterministic native-v2 tree; current
Firefox nav-bar items remain palette candidates instead of becoming
profile-dependent defaults. Valid saved v2 trees remain untouched.

The launcher opens a centered project-owned address/search popup. Compact and
detailed Trust status combines current Firefox connection/HTTPS and
tracking-protection state behind one Firefox-style shield at the launcher's
leading edge; native Trust/identity/protections, permission, and page-action
panels remain Firefox-owned and open from explicit native-detail actions.

All four surfaces are hidden at rest and reserve no permanent layout space.
They reveal through their matching pointer edge or an accessible keyboard/focus
path, float above content, and share one Fennevia-owned reveal, collision,
accessibility, cleanup, and glass-design contract.

A reversible per-window `active` gate is the durable hide of exact native
surfaces after every required feature passes health. ADR-050 may collapse those
same surfaces at first paint with a self-expiring sheet so the original toolbox
does not flash; that sheet is not a substitute for the health gate. Native
browser-content infrastructure, OS window
controls, permissions, authentication, certificate, extension-install,
download-safety, dialog, notification, popup, and DevTools behavior remains
Firefox-owned.

## 2. Current baseline

As of 2026-08-25, public prerelease package `0.16.0-beta.1` remains published
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
- #60: left-edge tab-row native parity (audio, container, attention,
  middle-click close, middle-click/accel related New Tab, drag/keyboard reorder,
  Firefox `#tabContextMenu`);
- ADR-073: Firefox-like pinned-tab structure with a conditional fixed section
  above the independently scrolling regular-tab partition;
- ADR-058: fixed tab action placement and closed camera/microphone/screen-sharing
  plus crash indicators; ADR-060 supersedes its custom icon-animation clause;
- ADR-060: exact native-equivalent shell controls use installed Firefox icon
  resources, including the Settings gear and the complete tab icon family;
- ADR-062: tab drag keeps the existing opaque move path while the actual source
  row follows the pointer, a full-row browser ghost continues outside the
  strip, transform-only neighbor gaps preview the final order, and tab controls
  retain Firefox's ordinary default cursor;
- ADR-063: tab drag uses a marker-only OS payload and one ephemeral privileged
  coordinator for same-kind cross-window adoption, target-strip reveal/hold,
  a real target-row layout slot plus visible generic row without spurious
  short-list overflow, no-drop target-exit cleanup, browser-content append,
  native detach outside Firefox, and capture plus source-snapshot hold cleanup;
- ADR-071: the vertical strip drives Firefox-owned tab multi-select, including
  range/toggle semantics, group actions, block move/adopt/detach, and native
  plural context-menu behavior without a second selected-ID owner;
- ADR-072: same-window single and multi-tab drops share one downward insertion-
  boundary conversion, verify the complete native result before consumption,
  reject invalid geometry, and use larger owned top/bottom drop targets without
  reserving layout space;
- ADR-064: bookmark rows use Firefox's cached bounded raster favicon data and
  middle-click new-tab opening; a third bounded customize preference swaps the
  paired side roles, disables the bottom panel, and maps either top/bottom light
  to loading/download/off; the native status label receives an active-only
  theme-aware capsule without changing its content or owner;
- #31: zero-layout four-edge frame, shared reveal controller, corner/collision
  policy, glass tokens, accessibility fallbacks, and complete cleanup;
- #12: event-driven selected-navigation bridge and top-edge Back, Forward,
  Reload/Stop, and New Tab controls with bounded page status;
- #13: compact default-left address/status launcher, centered address/search popup,
  native Urlbar submission and healthy-only `Ctrl+L`, real Firefox connection
  and tracking-protection state, and a fifth owned overlay root.
- #14: bounded/lazy typed Places bridge, event-driven default-right bookmarks,
  opaque opening actions, and keyboard-accessible hierarchy;
- #32: per-window typed Downloads list views, bounded anonymous state,
  event-driven bottom-edge aggregate progress/status, and native
  safety/management retention;
- #37: full current Urlbar status/action inventory, fixed permission/action
  coverage in the detailed popup, and complete Firefox native-Urlbar handoff;
- ADR-061: the centered popup projects bounded results from Firefox's existing
  per-window Urlbar provider manager, executes ordinary rows through native
  `pickResult`, and hands rich/unknown rows to the complete native Urlbar. It
  adds no engine, provider, ranking, persistence, or project network endpoint;
  focused tests and two Firefox 154 probes pass while the representative-provider
  and release matrices remain pending;
- #15: exact health-gated content-only activation, complete retained native
  reveal, and reversible per-window fail-open cleanup;
- #16: fixed local/CI PowerShell gates, aggregate performance/resource mode,
  exact one-sided ownership repair, reconciled compatibility inventory, and an
  executable Firefox stable-update rehearsal.

Current fast branch enhancement under ADR-037, ADR-042, ADR-044 through
ADR-047, and ADR-054 through ADR-072:

- one non-wrapping top row with navigation, address/page status, loading,
  Firefox tools, and progressive disclosure;
- one visible Trust handoff backed by the retained fixed Trust/identity and
  protections actions, plus permission, Unified Extensions,
  full-page translation, application-menu, and Settings handoffs without
  exporting their sensitive data; Downloads and translation are available as
  the placeable `show-downloads` and `show-translate` widgets;
  native customization and original-toolbar remain bridge actions, not fixed
  top-row buttons;
- popup-opening handoffs re-anchor Firefox-owned panels beside the clicked
  Fennevia host without revealing native chrome; one shared pre-open resolver
  gives every Fennevia popup a content-facing direction and client-half
  alignment without a second visible move, with measured correction retained
  only for owner-rejected anchors;
- useful bounded context actions on all four project-owned panels, with the
  translated Firefox tab menu retained on tab rows, bounded bookmark/folder
  actions plus native Library access on bookmark rows, and a spatial tab drag
  preview with a live source row, full-row browser ghost, animated neighbor gap,
  insertion marker, target-window tab-surface reveal and visible landing row,
  enlarged owned top/bottom landing zones, same-kind cross-window transfer,
  content-area append, and Firefox-owned external detach;
- retained Firefox caption controls styled in place as a compact island;
- a 7px browser-content gutter, gap-free edge contact, transient shortcut hint,
  click-versus-drag reconciliation for panel drag regions, and
  `top > sides > bottom` collision priority;
- 2px decorative gutter lights whose top/bottom sources independently select
  selected-tab loading, active download aggregate, or off, without a second
  trigger or filename text;
- an ADR-044 read-only mirror of the user's nav-bar `CustomizableUI`
  placements as the default top-zone layout, superseded as the only widget
  source by ADR-045: a Fennevia-owned customize mode with four-edge widget
  zones, the full current CustomizableUI inventory as an opaque-token palette,
  bounded style and interaction settings, profile-local prefs, and
  owner-approved adopt/restore writes onto the collapsed nav-bar. ADR-046
  restores localized widget names
  and native built-in icons (CSS mask, not `<img>`) in that palette and in
  widget zones. ADR-047 makes placement a live four-edge HTML5 drag-and-drop
  session (palette plus appearance/interaction settings stay in the top-host
  drawer). ADR-054 lets the user tune separate in-window and window-leave hide
  delays, temporary reveal duration, shortcut-tip duration (including zero to
  disable), and edge trigger thickness within fixed bounds. ADR-064 lets
  Fennevia customize mode persist a strict third preference for the complete
  side-role swap, bottom-panel enablement, and top/bottom light sources. Native
  customize mode stays available
  through the Firefox application menu, complete native reveal, and fail-open;
  it is not a fixed top-row control.
- ADR-074 advances the flat zones to a bounded version-2 tree: every principal
  browser feature/control is a movable widget, Row/Column drives orientation,
  compatible duplicate actions are opt-in, structural primitives are always
  repeatable, Downloads status is a movable singleton, Left/Right/Bottom are
  independently optional, and Top plus one reachable Customize instance are
  mandatory. A confirmed Clean-all action leaves only Top Customize, while
  preference-enabled empty edges remain live drop targets during customize
  mode. Space/Flexible space/Separator/empty containers and gaps drag the
  Firefox window outside the editor. Drag-target feedback clears on every
  leave/terminal path, and per-node edit controls appear contextually instead
  of covering every widget at once.
- ADR-075 makes that live editor spatial and discoverable: a bounded drag image
  leaves a subdued source placeholder, one exact nested insertion slot previews
  the result, panel-edge autoscroll is frame-bounded, one selected node remains
  active, and the palette has localized search plus closed categories.
- ADR-076 keeps that selection in the per-window customize session and renders
  its controls in exactly one Top-root floating inspector outside Row/Column
  sizing. The inspector is above project panel stacking contexts, clamps to the
  viewport, avoids the central customize workspace when another side fits,
  closes through a non-selecting outer focus anchor, and keeps every customize
  node boundary visible without changing real widget measurements.
  Eligible Address and Tabs instances may persist one allowlisted semantic
  style id for integrated Trust or trailing New Tab; arbitrary CSS, geometry,
  labels, native ids, and Firefox nodes remain prohibited.
- ADR-077 adds one closed four-choice panel policy combining single/multiple
  surface visibility with dynamic/reserved collision lanes. The default keeps
  existing multiple/dynamic behavior; single modes retain the bounded new-tab
  Tabs reveal and respect Firefox popup holds. Tabs, Bookmarks, and Downloads
  now render through one bounded axis-aware feature root, fixing intrinsic
  horizontal Tabs/New Tab sizing without making ordinary children Expanded.
- ADR-078 makes the existing palette feature-first without changing its edit
  model: Address/Trust, Tabs/New Tab, Bookmarks/Show Bookmarks, and Download
  status/Show Downloads publish as fixed adjacent primary/companion groups in a
  closed Main features category. Complete groups use wide/compact pairs while
  incomplete groups reflow without empty columns. A fifth optional Guide tab
  explains the fixed root directions, structural widgets, wrappers, practical
  recipes, editing, and recovery with static localized content and no new
  persisted state.
- ADR-080 makes all four panels usable near Firefox's retained minimum width as
  well as below it when `allowCompactWindow` is enabled. A 560 CSS px mosaic
  gives Bottom its own full-width lane, expands one visible side while retaining
  at least 104 CSS px of opposite-side client area, splits two visible sides,
  and preserves dynamic/reserved lane semantics. Only the 360 CSS px ultra-
  compact tier lets one side use the full available width while tightening gaps
  and fixed Top/Bottom heights. Existing Row/Column order, scrolling, focus,
  reveal, and native fallback remain unchanged.

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
- ADR-049: release-only WinForms setup wizard (`FenneviaSetup.exe`) as the
  recommended end-user entry, with on-demand UAC when the selected Firefox
  program directory is not writable.
- ADR-050: process-scoped self-expiring first-paint native hide so the original
  toolbox does not paint before `active`; durable hide remains health-gated.
  Real Firefox cold-start flash, CSS watchdog, and skeleton checks are
  `not run`.

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
- A usable strict composable layout across all four edges, including movable
  navigation, address launcher, Tabs, Bookmarks, Downloads status, Firefox
  handoffs, window controls, and a mandatory reachable Customize widget.
- Independent Left/Right/Bottom enablement with Top always enabled, enabled
  empty drop targets during customize mode, confirmed clean-all recovery, and
  empty ordinary chrome available for native window dragging, plus deterministic
  drag-outline cleanup and contextual node controls.
- Configurable single/multiple edge reveal and dynamic/reserved clearance lanes
  through the same shared controller and frame, including the short newly-opened
  tab exception.
- Exact projected drag placement, session-wide selected-node editing through
  one obstacle-aware floating inspector, palette search/categories, and closed
  per-instance Address/Tabs variants without making drag mandatory or
  expanding into arbitrary CSS.
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
- New OS window semantics or deletion/reparenting of native caption controls;
  ADR-038/ADR-074's project-rendered command buttons retain Firefox command
  ownership and native fail-open copies.
- Overriding the complete `browser.xhtml`.
- A branded Firefox fork, automatic update channel, Inno/NSIS/MSI product
  installer, or commercial support product.
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
12. **Separate responsibility without widening APIs.** Keep stable facades at
    established import paths while feature folders separate contracts,
    validation, native support, controllers, UI composition, and cleanup
    according to ADR-053 and `plans/007-codebase-modularization.md`.

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
- one tracked anti-flicker timer per edge, with a bounded configurable delay;
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

- native-order vertical rows split into a conditional fixed pinned section and
  an independently scrolling regular section;
- selected/title/favicon/pinned/loading/audio/attention/container state plus
  closed camera/microphone/screen-sharing, crash, and picture-in-picture
  indicators;
- select, new, close, pin, unpin, mute, move, and native context-menu handoff;
- bounded independent pinned/regular overflow, with the pinned section capped
  so regular tabs and the always-visible New Tab control remain reachable;
- keyboard navigation, drag reorder with a pointer-aligned full-row ghost,
  animated neighbor gap, insertion marker, and polite move announcement, plus
  deterministic close-focus recovery; same-window drops use one verified
  insertion-boundary mapping for single and Firefox-owned multi-selected sets,
  while the first/last 32 CSS pixels and the owned New Tab region provide
  easier top/bottom landing targets;
- synchronous native lazy-label activation and a NativeUi popup token so the
  Firefox tab menu is complete without revealing original chrome;
- non-consuming parent context routing so the delegated tab owner still opens
  that native menu, with explicit project-menu focus release for auto-hide;
- ordinary bridge contracts only;
- native tab strip retained.

Evidence: ADR-025, ADR-026, ADR-041, ADR-055, ADR-058, ADR-060, ADR-062, ADR-063,
ADR-065, ADR-066, ADR-071, ADR-072, ADR-073,
`docs/research/firefox-153-tab-strip.md`, and
`docs/research/firefox-153-tab-strip-parity.md`,
`docs/research/firefox-153-154-tab-status-indicators.md`,
`docs/research/firefox-153-154-native-shell-icons.md`,
`docs/research/firefox-154-tab-drag-spatial-preview.md`,
`docs/research/firefox-154-tabbar-interaction-follow-up.md`, and
`docs/research/firefox-154-shell-interaction-second-follow-up.md`,
`docs/research/firefox-154-pinned-tabs-area.md`,
`docs/research/firefox-153-154-panel-context-actions.md`, and
`docs/research/codebase-robustness-audit-2026-08-24.md`.

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

- non-editable bounded committed location in the compact configured tabs-side launcher;
- one compact Firefox-style Trust shield combining real connection/HTTPS and
  tracking-protection status at the leading edge inside the address frame;
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

ADR-061 extends the same popup without replacing Firefox's provider stack. The
existing input now controls one bounded result list populated by the owning
window's native Urlbar manager. Closed presentation fields and per-window opaque
tokens cross the bridge; Firefox keeps query contexts, provider selection,
ranking, search engines/suggestions, private policy, result objects, execution,
and destinations. Ordinary rows use native `pickResult`; rich/unknown rows use
the existing complete-native-Urlbar handoff. Focused automation and Firefox 154
query-contract/production-panel probes pass. Firefox 153, representative
providers, remote-suggestion settings, one-offs/rich rows, second/private
windows, full accessibility/layout, failure injection, and release rows remain
not run. Evidence: ADR-061,
`plans/008-native-urlbar-suggestions.md`, and
`docs/research/firefox-153-154-native-urlbar-suggestions.md`.

#### Right bookmarks — complete (#14)

- typed Places bridge;
- bounded/lazy roots and child queries;
- event-driven native bookmark updates;
- current-tab and source-validated new-tab opening;
- configured bookmark-side tree/list accessibility;
- pointer/keyboard bookmark and folder actions plus Firefox-owned Library
  management.

The implementation uses four localized roots, 32-item replaceable pages,
depth/expansion caps, per-window opaque IDs and observers, native
`PlacesUIUtils` opening, and the shared #31 configured-edge/focus contract. Native
bookmark UI remains visible. Normal, second, private, live-mutation,
Browser-Toolbox, cleanup, and fail-open recovery evidence passed.

Evidence: ADR-029 and
`docs/research/firefox-153-bookmarks-surface.md`, plus ADR-055 and
`docs/research/firefox-153-154-panel-context-actions.md`.

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
- compact configured tabs-side launcher still limited to one bounded Trust summary derived
  from real connection/HTTPS and ETP status;
- centered popup adds fixed sharing/blocked-permission and applicable-action
  labels;
- one read-only per-window owner-state observer with deterministic cleanup;
- no principal, certificate, permission record, extension identity, action ID,
  provider result, or native node crosses the #37 coverage bridge;
- full Firefox Urlbar, providers, prompts, panels, and commands retained through
  `window.openLocation()`;
- real HTTP, valid HTTPS, internal, network-error, permission, ETP, dynamic
  action, normal/second/private, Browser Toolbox, and fail-open evidence.

Evidence: ADR-031 and
`docs/research/firefox-153-urlbar-coverage.md`.

ADR-061 narrowly supersedes only ADR-031's provider-result ban: a separate
focused bridge may expose bounded presentation fields and opaque execution
tokens under the privacy/cleanup rules above. The fixed coverage observer and
native security/action ownership remain unchanged.

#### Single-line toolbar and native detail handoffs — focused implementation complete, manual Firefox pending (ADR-037, ADR-042)

- one compact non-wrapping top row with navigation, top address/popup launcher,
  existing bounded status, loading accent, Firefox tools, and responsive
  progressive disclosure;
- one visible Trust handoff backed by fixed Trust/identity and protections
  actions, plus site permissions,
  Unified Extensions, built-in full-page translation, application menu, and
  Settings; Downloads and translation are available as the placeable
  `show-downloads` and `show-translate` widgets; native customization and the
  complete original toolbar remain bridge actions rather than fixed top-row
  buttons;
- seven popup actions pass a project-owned host, keep native chrome hidden, and
  re-anchor the Firefox panel beside that host;
- ten fixed booleans/actions only; no certificate, permission, tracker,
  extension, download, widget, preference, URL, or native object crosses;
- Firefox remains the complete data/action/popup owner and the custom combined
  Trust label and shield remain a summary;
- Firefox-owned caption buttons retained and styled in place, with empty panel
  chrome draggable and every interactive descendant excluded from dragging;
- fixed packaged Firefox resources for exact native-equivalent icons,
  independently authored caption/ambiguous fallback glyphs, and no copied
  code/design/assets from `my-firefox-custom`.

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
  `show-bookmarks` (configured bookmark side), `show-downloads` (Firefox
  `#downloadsPanel`), and `show-translate` (Firefox built-in full-page
  translations) widgets and spacer/spring/separator specials;
- project-owned editor: ADR-047 live four-edge HTML5 drag-and-drop with the
  top-host palette/style drawer held through the #31 popup hold on every
  edge, plus keyboard Delete / Ctrl+Arrow / Enter;
- owner-approved persistence of widget ids in the layout pref and bounded
  `addWidgetToArea` / restore writes; extension identity still banned from
  logs, diagnostics, serialized frontend state, CSS variables, and root
  datasets;
- ADR-054 bounded global interaction settings in the existing versioned style
  preference: in-window and window-leave hide delays `100–5000 ms`, temporary
  reveal duration `400–10000 ms`, shortcut-tip duration `0–10000 ms`, and edge
  trigger thickness `6–24 CSS px`; these reconfigure the shared #31 controller
  and existing frame CSS without adding JavaScript timers or triggers;
- optional editing: missing `Services.prefs` disables the editor without
  joining activation health. Native customize mode remains available through
  the Firefox application menu, complete native reveal, and fail-open.

Evidence: ADR-045, ADR-046, ADR-047, ADR-054,
`plans/006-customize-mode.md`, and
`docs/research/firefox-153-customize-mode.md`. The real-Firefox customize
matrix is recorded as pending in `docs/testing-and-recovery.md` §6.9.

ADR-074 supersedes this milestone's fixed controls plus flat-zone composition.
The current version-2 tree makes navigation, Trust/address, Tabs, Bookmarks,
Downloads status, Firefox handoffs, private indicator, window controls, and
Customize placeable under nested Row/Column containers. It adds bounded path
edits, orientation-aware feature presentation, opt-in safe duplication,
always-repeatable structural primitives, independent Left/Right/Bottom enable
state, enabled empty-edge drop targets while editing, a confirmed Clean-all
operation that preserves one Top Customize instance, and ordinary-mode window
dragging from empty project chrome. Shared drag lifecycle cleanup prevents
stale target outlines. Closing the shared customize session restores or blurs
the active Top-surface focus through the existing dismiss path and never
re-reveals or refocuses Customize, so auto-hide does not wait for a content
click. Node boundaries, structure labels, and edit controls appear only on
deepest hover or direct keyboard focus. The native-v2 default is
explicit rather than a live nav-bar mirror: Top owns the expanded address
composition, the configured side roots own expanded Tabs/Bookmarks, and Bottom
centers Downloads status. Plan and checklist:
`plans/009-composable-widget-layout.md`.

ADR-077 extends the bounded Panels/Layout policy with
`single-dynamic`, `single-reserved`, `multiple-dynamic`, and
`multiple-reserved`; existing and migrated profiles default to
`multiple-dynamic`. Reserved lanes keep sides below Top and Bottom between
effectively enabled sides even before their panels reveal. Single modes use the
same dismiss/focus/popup contract and permit only the existing 500 ms
new-tab-highlight exception. Its common feature root also makes Tabs'
summary/strip one layout child and keeps the horizontal trailing New Tab action
intrinsic. Plan and checklist:
`plans/013-configurable-panel-dodge-and-horizontal-features.md`.

ADR-078 adds the feature-first paired palette and optional layout Guide while
retaining opaque tokens, existing click/keyboard/drag edits, and one customize
drawer owner. Plan and checklist:
`plans/014-customize-palette-and-layout-guide.md`.

ADR-080 adds the responsive narrow-window mosaic without a new preference or
controller. It applies at Firefox's ordinary minimum-width range regardless of
`allowCompactWindow`, while retaining a content corridor for reliable pointer
exit and auto-hide; only the ultra-compact tier uses a full-width lone side in
the smaller range the opt-in normally exposes. Plan and checklist:
`plans/015-narrow-window-four-panel-ui-ux.md`.

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
- one exact nine-rule per-window controller collapses reviewed toolbox and
  toolbar geometry, exact non-caption content, bookmarks toolbar, and exact
  native sidebar surfaces, and applies the 7px content gutter;
- native vertical-tab mode retains its navbar titlebar owner;
- Firefox-owned titlebar controls remain attached for fail-open; ADR-038
  collapses every native caption copy at rest and shows project-owned
  window buttons on the visible top row; notifications, popups, dialogs, and
  content remain Firefox-owned;
- native focus, an open native sidebar, #37's Urlbar handoff, and ADR-037's
  original-toolbar handoff reveal the complete retained native path;
- Fennevia-initiated Trust/permission/Downloads/extensions/application-menu
  panels that are token-listed or re-anchored to a project host do not reveal
  the navbar;
- ADR-056 moves any other non-excluded non-security hidden-toolbox XUL popup to one
  health-checked project proxy after yielding to a feature-specific host;
  missing/ineffective movement reveals Firefox chrome and a thrown move
  suspends before fail-open;
- ADR-057 excludes `#notification-popup` from post-open movement, preserves
  Firefox's lazy owner initialization, and pre-anchors healthy hidden-toolbox
  notifications to the project proxy; original chrome stays hidden on that
  path while unavailable/ineffective routing holds complete native reveal, so
  extension installation and every shared security prompt retain Firefox's
  anti-clickjacking timing; the owner-observed Firefox 154 AMO path currently
  takes that accepted complete-native-chrome fallback;
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
runtime on 2026-08-19. The `0.12.0-beta.1` release candidate subsequently
passed the automated Firefox 154 lifecycle/recovery, performance plus disabled
control, and exact extracted-package install/uninstall matrix on 2026-08-23;
the current candidate was not rerun on Firefox 153 and the explicit manual rows
remain recorded as `not run`. ADR-048 relaxes
Install/Update/Repair/Enable to Firefox 153 and newer with an explicit
no-promise warning. Evidence: ADR-033/ADR-034/ADR-048,
`docs/research/firefox-153-mvp-hardening-update-rehearsal.md`, and
`docs/research/firefox-154-stable-transition.md`, plus
`docs/research/firefox-154-0.12.0-beta.1-release-validation.md`.

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
