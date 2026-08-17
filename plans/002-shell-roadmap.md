# Shell Implementation Roadmap

This document defines the current implementation order after the bootstrap,
runtime, frontend, and first bridge foundations have been proven. Every custom
UI slice must pass while Firefox native UI remains visible.

Issue #5 established the single process runtime and per-window lifecycle used by
all milestones. Issue #31 established the single shared four-edge frame and
reveal contract used by all remaining UI features. No later issue may create a
parallel browser-window observer, native-DOM owner, edge trigger, reveal timer,
collision system, glass token set, or window-global coordination layer.

## Current status

Validated baseline as of 2026-08-16:

- public package `0.10.0-beta.1` prerelease;
- Firefox 153.0.4 BuildID 20260810162159 release on Windows x64;
- #2, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12, #13, #14, #15, #16,
  #17, #18, #22, #31, #32, #37, #39, #57, and #60 complete;
- functional vertical tabs and a compact address/status launcher in the left
  surface;
- one centered address/search popup with detailed connection, protection,
  permission, applicable-action, and native-handoff coverage in a fifth owned
  root;
- one-line primary navigation/address/status plus fixed native Firefox handoffs
  in the top surface;
- bounded lazy Firefox Places bookmarks in the right surface;
- event-driven anonymous aggregate Downloads status in the bottom surface;
- exact Firefox native DOM and complete reveal/fallback paths retained;
- production enters `active` only after the complete health gate.

ADR-037's single-line toolbar/caption/gutter enhancement, ADR-042's
host-anchored Firefox panel placement, and ADR-043's decorative gutter
progress lights have focused automated evidence; the real Firefox popup-
placement and live light-painting matrices remain pending and are not included
in the earlier validated baseline.

ADR-044 (#64) adds the read-only nav-bar widget mirror in the top surface with
owner-approved rendering of extension identity data. ADR-045 deprecates that
mirror as the only widget source and adds a Fennevia-owned customize mode with
four-edge zones, the full CustomizableUI inventory, bounded style tokens, and
owner-approved adopt/restore writes. Both have focused automated evidence;
the real Firefox matrices in `docs/testing-and-recovery.md` §6.8 and §6.9
remain pending.

The project is currently under rapid development. Ordinary shell work uses CI
as the required gate; the complete real-Firefox matrices run at release. See
ADR-039 and `AGENTS.md` section 8.

Governance foundation:

1. #18 selected MPL-2.0 and the third-party attribution/provenance policy.
2. #39 established deterministic, checksum-published Windows prereleases with
   exact tagged source, a Firefox-build allowlist, explicit registered-profile
   installation, and independently reverified public assets.
3. #57 added the PowerShell console as the recommended install and development
   environment entry without changing the installer transaction contract.

Historical research records remain accurate for the milestone they tested.
Current production architecture is defined by this roadmap, the master plan,
`docs/architecture.md`, and accepted ADRs.

## Milestone A: Per-window XHTML ownership — complete

### Historical proof from #6

Issue #6 first proved three isolated XHTML mount islands:

- a visible primary diagnostic host;
- a hidden sidebar host;
- a hidden inert overlay host.

That spike established:

- explicit XHTML namespace creation;
- project-prefixed ownership;
- exact insertion-point validation;
- all-or-nothing rollback;
- second/private-window isolation;
- Browser Toolbox ownership evidence;
- native prompt, browser-content, and OS-control preservation;
- deterministic removal.

The exact tested shape remains documented in
`docs/research/firefox-153-shell-hosts.md` and ADR-020.

### Current production shape from #31

ADR-026 supersedes only the initial production geometry. The current runtime
uses one zero-layout XHTML frame under the validated `#browser` hierarchy with
ordered independent:

- top host;
- left host;
- right host;
- bottom host;
- centered address-overlay host, ordered last;
- one project-owned generated style node.

Each of the four edge hosts and the address-overlay host contains exactly one
project-owned XHTML mount target and one Svelte root. Structural descendants
remain XHTML; only project-authored `svg[data-fennevia-icon]` subtrees use SVG.
Project ownership stops at the frame descendants. Firefox-native nodes are
neither moved nor reconciled.

Gate: complete mount or complete fail-open rollback in normal, second-normal,
and private windows.

## Milestone B: Health, safe start, and emergency fallback — complete

The per-window state model is:

- `created`;
- `mounted`;
- `healthy`;
- `active`;
- terminal `failed`;
- controller-only `disposed`.

Issue #7 provides:

- validated state transitions;
- cumulative project root attributes;
- finite health deadline;
- privacy-safe first causal errors;
- `fennevia.safeStart` before manifest lookup/import;
- privileged `Ctrl+Alt+Shift+F12` emergency fallback;
- development-only constructor collaborators for failure injection;
- deterministic reverse cleanup.

Issue #31 updates the current health checks to require the complete frame, all
four ordered hosts, mount targets, roots, parsed frame-scoped styles, edge
controller, emergency handler, and declared bridge capabilities. ADR-032 later
adds the sole production `healthy -> active` caller after those checks and owns
the exact reversible native selectors; it does not change this health model.

Gate: every broken host, frontend, CSS, controller, capability, or pending
operation leaves native Firefox UI usable.

Evidence:

- ADR-021;
- ADR-026;
- `docs/research/firefox-153-shell-health-recovery.md`;
- `docs/research/firefox-153-four-edge-shell.md`.

## Milestone C: Deterministic Svelte production build — complete

Issue #8 proved:

- Svelte 5 and TypeScript inside Firefox privileged XHTML;
- one fixed tree-fragment IIFE;
- extracted root-scoped CSS;
- event, input, conditional, and template behavior;
- official unmount/remount;
- normal/second/private state isolation;
- deterministic double build;
- no HMR, CDN, source map, remote font, runtime endpoint, or unexpected chunk;
- exact package inventory and CI gates;
- broken-bundle fail-open behavior.

Issue #31 keeps the same generated API and artifact contract but mounts four
independent roots inside one shared frame. Build determinism, one-shot
registration, namespace ownership, and official unmount requirements are
unchanged.

Tailwind, Shadow DOM, runtime stylesheet registration, and a component library
remain rejected because the smaller local implementation satisfies current
requirements.

Gate: deterministic artifacts and complete frontend cleanup in every supported
window.

Evidence:

- ADR-022;
- ADR-026;
- `docs/research/firefox-153-svelte-build.md`;
- `docs/dependency-reviews/frontend-toolchain-2026-08-15.md`.

## Milestone D: Typed Firefox bridge boundary — shared foundation complete

Issue #9 implements the shared boundary:

```ts
interface FirefoxBoundary {
  readonly capabilities: CapabilitySnapshot;
  dispose(): void;
}
```

The exact internal shape remains private, but the rules are fixed:

- one exclusive context per managed window;
- runtime validation of required and optional symbols;
- privacy-safe typed errors;
- context-scoped opaque native-handle registries;
- idempotent subscriptions and disposal;
- no native handle in ordinary or Svelte state;
- ESLint rejection of Firefox implementation imports/globals from
  `src/app/` and `src/shell/`;
- no generic service container or Firefox SDK.

Gate for every feature bridge:

- current Firefox source and runtime evidence;
- ordinary immutable public data;
- explicit actions;
- event-driven updates rather than idle polling;
- stale and foreign ID rejection;
- normal/private isolation;
- deterministic cleanup;
- required-capability fail-open behavior.

Evidence: ADR-023 and
`docs/research/firefox-153-bridge-boundary.md`.

## Milestone E: Tabs bridge and left-edge vertical tabs — complete

### E.1 Typed tabs bridge (#10)

The current public tabs contract provides:

- ordered immutable tab snapshots;
- stable context-bound opaque IDs;
- selected, title, safe favicon, pinned, loading, and order state;
- select, open-new-tab, close, pin, and unpin;
- event-driven reconciliation from the minimal current Firefox tab event set;
- stale, malformed, and foreign-window failures;
- deterministic subscription/controller disposal.

A Svelte-independent adapter copies only allowlisted primitive fields.

Evidence: ADR-024 and
`docs/research/firefox-153-tabs-bridge.md`.

### E.2 Accessible tab UI (#11)

Issue #11 supplies:

- native-order tab rendering;
- selected/title/favicon/pinned/loading state;
- select, new, close, pin, and unpin controls;
- sibling interactive controls rather than invalid nesting;
- roving keyboard focus, Home/End, activation, deletion, and focus recovery;
- bounded overflow;
- text-only titles and property-only allowlisted favicons;
- normal/second/private isolation;
- native tab strip retained.

ADR-026 reorients the same data, action, and accessibility contract vertically
inside the left edge. Up/Down replaces horizontal arrow movement, and many tabs
scroll inside the bounded left panel.

Issue #60 completes the remaining flat-list parity on that same strip:

- middle-click close;
- audio playing/muted/blocked plus a sibling mute toggle;
- container color stripe and bounded label;
- attention and picture-in-picture indicators;
- drag reorder and `Ctrl+Shift+ArrowUp/Down`;
- Firefox-owned `#tabContextMenu` handoff with #31 popup hold.

Deferred:

- tab groups/workspaces/split view;
- multi-select;
- thumbnails/previews;
- container icon loads from `resource://usercontext-content/`.

Evidence: ADR-025, ADR-026, ADR-041, and
`docs/research/firefox-153-tab-strip.md`,
`docs/research/firefox-153-tab-strip-parity.md`.

## Milestone F: Shared four-edge interaction and design frame — complete

Issue #31 provides one common contract for every feature surface:

- independently owned top, left, right, and bottom hosts;
- hidden-at-rest state with no permanent content space;
- pointer, keyboard, focus, popup, and bounded programmatic reveal reasons;
- one tracked anti-flicker hide timer per edge;
- deterministic corner ownership;
- overlap clearances and collision policy;
- `Escape` and focus restoration;
- suspension for customize mode, DOM fullscreen, and native modal state;
- browser-fullscreen and resize behavior tied to the validated browser geometry;
- frame-scoped Fennevia glass tokens;
- near-solid, reduced-transparency, reduced-motion, forced-colors, and
  responsive fallbacks;
- all-or-nothing mount and reverse disposal.

Feature modules receive a narrow surface API. They do not manipulate CSS
classes, timers, z-index values, or trigger DOM directly.

Current contents:

- left: functional vertical tabs;
- top: one-line primary navigation, address/page status, fixed native-detail
  and Firefox-tool handoffs;
- right: functional bounded/lazy bookmarks;
- bottom: functional bounded download progress/status.

Gate: pointer, keyboard, focus, popup, corner, suspension, layout, and cleanup
behavior pass in normal, second-normal, and private windows without changing
native UI.

Evidence: ADR-026 and
`docs/research/firefox-153-four-edge-shell.md`.

## Milestone G: Top-edge primary navigation — complete (#12)

### Bridge work

Research and implement the minimum selected-browser navigation contract:

- `canGoBack`;
- `canGoForward`;
- loading state;
- Reload/Stop state;
- bounded display title/location only where required;
- Back, Forward, Reload, Stop, and New Tab actions;
- selected-browser handoff;
- current Firefox command/controller semantics;
- event-driven progress/location/command-state updates;
- deterministic disposal.

No native browser, controller, progress listener, principal, or Firefox-owned
DOM enters ordinary state.

### Top-surface UI

Use #31's top host and shared reveal contract:

- compact Back and Forward;
- deterministic Reload/Stop;
- New Tab;
- accessible labels and visible focus;
- narrow-window behavior;
- no editable address field;
- no fake overflow/menu control;
- no replacement titlebar or caption commands.

Gate:

- state matches native semantics;
- actions never target the previous selected browser;
- rapid navigation/tab switching/disposal is deterministic;
- top surface is hidden at rest and adds no permanent height;
- native navbar remains visible and unchanged;
- capability or surface failure fails open.

Validated on Firefox 153.0.4 for Windows in normal, second-normal, private, and
Browser Toolbox runs. Missing navigation capability, frontend failure, safe
start, cleanup, rapid tab/navigation changes, and Reload/Stop timing all passed.

Evidence: ADR-027 and
`docs/research/firefox-153-navigation-controls.md`.

### Current ADR-037/ADR-042 extension

The same top host now renders one non-wrapping row with the existing navigation
state, a launcher for the existing centered popup, loading feedback, fixed page
actions, Firefox-owned detail/tool handoffs, and progressive disclosure. The
browser-tools boundary delegates Trust/identity, protections, permissions,
Downloads, Unified Extensions, the application menu, Settings, customization,
and complete original-toolbar access without exposing their data or arbitrary
widget identity. ADR-042 keeps native chrome hidden for the six popup actions
and re-anchors each Firefox-owned panel to the clicked project host. Settings,
customization, and the complete original-toolbar path keep their previous
owners.

Focused automation is complete. Cold-start, real native-panel placement against
collapsed chrome, caption commands, drag release, responsive/fullscreen
geometry, second/private windows, and fail-open remain post-push manual checks.
Evidence: ADR-037, ADR-042,
`plans/004-single-line-toolbar-ui-ux.md`,
`docs/research/firefox-153-single-line-toolbar-handoffs.md`, and
`docs/research/firefox-153-native-popup-anchoring.md`.

## Milestone H: Compact address launcher and centered popup — complete (#13)

Compose one short, non-editable launcher with the completed #11 tab UI and put
the sole custom editable address field in a centered project-owned overlay.

### Bridge and command work

The bridge adopts current Firefox semantics for:

- user-facing display location;
- URL fixup;
- ordinary search submission;
- principals and load options;
- executable/special schemes;
- current-tab disposition;
- `Ctrl+L` command ownership and fallback;
- connection/HTTPS classification;
- Enhanced Tracking Protection detection, blocking, and exceptions.

Only bounded ordinary text, fixed typed state, and explicit actions cross the
privileged boundary. Native Urlbar, browser, identity/protections handler,
allow-list, progress, command, and event objects stay private.

### UI work

- compact launcher above the tab list with bounded committed location and real
  Firefox connection/protection badges;
- centered nonmodal popup with one independent draft and fuller status text;
- `Ctrl+L` opens, focuses, and selects the popup only while the healthy custom
  shell accepts the command;
- native `Ctrl+L` remains available while inactive, failed, safe-started,
  unsupported, or disposed;
- Enter submits;
- Escape/cancel discards the draft and restores a valid prior target or content;
- selected-tab changes close/discard; background same-tab navigation cannot
  overwrite an active draft;
- popup priority suppresses the four edge surfaces without creating another
  edge controller;
- no suggestions, rich results, search modes, moved native DOM, fake security
  icon, or arbitrary `loadURI` helper.

Gate:

- URL-like and search-like input delegates to current native Urlbar behavior;
- navigation cannot overwrite an active draft;
- no input or complete URL enters diagnostics or persistence;
- the combined left surface remains compact, bounded, and hidden at rest;
- compact and detailed status match the same current Firefox state and become
  conservatively unavailable when Firefox has no coherent status;
- native Urlbar remains visible and unchanged;
- failure restores native fallback.

Validated on Firefox 153.0.4 in normal, second-normal, private, fail-open,
frontend-recovery, and Browser Toolbox runs. Issue #37 separately completes
native permission/page-action coverage and retained access.

Evidence: ADR-028 and
`docs/research/firefox-153-address-popup.md`.

## Milestone I: Right-edge bookmarks — complete (#14)

Replace the obsolete generic “sidebar MVP” direction with a focused,
project-owned right-edge bookmarks feature.

### Places bridge

Implemented and validated:

- major Firefox bookmark roots;
- bounded/lazy folder-child queries;
- folder/bookmark/separator snapshots;
- context-bound opaque IDs;
- event-driven create/remove/move/reorder/title/URL updates;
- current-tab and source-validated new-tab opening;
- private-window behavior;
- deterministic observer/query cleanup.

Bookmark URLs need not enter Svelte state merely to open a bookmark. Large trees
must not be mirrored eagerly.

### Right-surface UI

- root selector or documented section layout;
- nested folder hierarchy;
- expand/collapse;
- current-tab and supported new-tab opening;
- safe empty/loading/truncated/stale/error states;
- keyboard traversal and focus stability;
- no remote favicons for the MVP;
- native Library, `Ctrl+D`, bookmark dialogs, and management paths retained.

Gate:

- live native bookmark changes reconcile without continuous polling;
- bookmark titles/URLs/folder contents do not enter normal logs or persistence;
- right surface is hidden at rest and adds no permanent width;
- native bookmark access remains usable;
- failures fail open.

The selected bridge uses one per-window opaque registry and one exact Places
observer. Child pages are limited to 32 items, visible depth to 8, and expanded
folders to 20. It delegates non-executable bookmark opening to current
`PlacesUIUtils`, never exposes URLs/GUIDs to Svelte, and health-gates the four
roots plus first page. The ordinary, second-window, private-window, Browser
Toolbox, missing-capability, and frontend-recovery matrices passed on Firefox
153.0.4 while native bookmark UI remained visible.

Evidence: ADR-029 and
`docs/research/firefox-153-bookmarks-surface.md`.

## Milestone J: Bottom-edge download progress/status — complete (#32)

### Downloads bridge

Implemented and validated:

- current Downloads modules/list/view semantics;
- active, paused, succeeded, failed, and canceled state;
- known-size and unknown-size progress;
- aggregate progress definition;
- normal/private isolation;
- event/view-driven updates;
- context-bound opaque IDs;
- bounded anonymous display values with no filenames;
- deterministic native-view and subscription cleanup.

Do not expose source URLs, referrers, headers, cookies, full target paths,
principals, or native download objects.

### Bottom-surface UI

- compact aggregate progress track;
- determinate and indeterminate states;
- active count;
- bounded item summary only where privacy and space allow;
- completion/error/no-active states without continuous animation;
- hidden state continues receiving updates;
- activity does not force unsolicited reveal;
- accessible progress semantics;
- native Downloads panel, notifications, reputation, safety, and management
  behavior retained.

Gate:

- single/multiple/mixed-size progress is correct without idle polling;
- bottom surface is hidden at rest and adds no permanent padding;
- filenames, paths, source URLs, and private activity do not enter normal logs;
- failures fail open.

The final bridge selects PUBLIC for normal windows and PRIVATE for private
windows, registers one exact list view per window, ignores replayed terminal
history, retains three newly observed terminal records, and exposes at most six
anonymous items with counts capped at 999. Known-size progress is byte-weighted;
any active unknown-size record makes the aggregate explicitly indeterminate.
No timer, action, filename, path, source URL, private marker, or per-item byte
value crosses into application/Svelte state.

Normal, second-normal, private, hidden-update, native-panel alternation,
keyboard reveal, Browser Toolbox, hard-disable, exact view removal, malformed
data, missing capability, frontend, bootstrap, and safe-start matrices passed.
Evidence: ADR-030 and
`docs/research/firefox-153-downloads-surface.md`.

## Milestone K: Urlbar trust, permission, and action coverage — complete (#37)

### Inventory and bridge

- exact Firefox 153 leading/trailing status, permission, prompt-anchor,
  conditional/static/dynamic page-action, and provider-control inventory;
- one read-only per-window owner-state observer with four fixed targets;
- fixed sharing, blocked-permission, and applicable-item enums plus booleans;
- generic extension/unknown-action presence without extension identity or
  action IDs;
- no URL, origin, principal, certificate, permission record/scope, native
  label, provider result, browser/window object, or native node crossing;
- deterministic observer/subscriber/application cleanup and fail-open.

### Detailed popup and retained access

- short launcher remains bounded location plus real Firefox connection/HTTPS
  and ETP status;
- centered popup adds permission and applicable-action detail;
- native identity/trust/protections/permission/extension/page-action panels,
  prompts, providers, suggestions, and one-offs remain Firefox-owned;
- one explicit action closes the project popup and invokes current
  `window.openLocation()`.

Gate passed on Firefox 153.0.4 with HTTP, valid HTTPS, internal, network-error,
blocked-camera, ETP exception/restore, dynamic zoom, normal, second-normal,
private, Browser Toolbox, missing-capability, exact restoration, and cleanup
evidence.

Evidence: ADR-031 and
`docs/research/firefox-153-urlbar-coverage.md`.

## Milestone L: Content-only active mode — complete (#15)

Begin only after #7, #31, #11, #12, #13, #14, #32, and #37 are complete with
real native-visible validation.

Create a reviewed native-UI coverage inventory mapping every candidate hidden
surface to:

- exact current Firefox owner/source;
- Fennevia replacement;
- retained native access path;
- failure behavior;
- test evidence.

Do not hide a broad parent merely because some descendants have replacements.

Active-mode contract:

- all Fennevia surfaces remain hidden at rest;
- no custom surface reserves permanent layout;
- only narrow documented edge triggers remain interactive;
- each surface reveals independently through #31;
- clearing `active` restores native UI immediately without Svelte or restart;
- missing bundle, CSS, host, controller, command, or bridge capability clears
  active state;
- #37 native handoff reveals/focuses the retained Urlbar while active and
  returns to the intended content-only presentation afterward;
- trust/identity/certificate, protections, permission, extension, bookmark,
  translation, zoom, overflow, and prompt-anchor paths stay reachable;
- native prompts, notifications, dialogs, find bar, menus, extension actions,
  Library, Downloads access, DevTools, and OS controls remain reachable;
- customize mode normally suspends active mode;
- DOM fullscreen follows an explicit security-preserving policy.

Gate: every controlled failure leaves or restores a usable native browser shell.

ADR-032 implements the final `healthy -> active` production transition and one
exact per-window native visibility controller. ADR-037 extends its stylesheet
to seven exact rules for reviewed toolbox/toolbar geometry, non-caption
content, bookmarks/sidebar collapse, a 7px content gutter, and tabbox border.
ADR-038 collapses every native caption copy at rest and places project-owned
window controls on the top row. Native vertical-tab titlebar ownership,
notifications, popups, dialogs, content, and DevTools remain intact. Native
focus, toolbox-anchored Firefox doorhangers, open sidebar panels, #37's Urlbar
handoff, and ADR-037's original-toolbar handoff temporarily reveal the complete
native owner. Fennevia-initiated host-anchored or token-listed panels do not
reveal the navbar. Customize, native dialogs, and DOM fullscreen suspend
project hiding.
Partial activation CSS fails open only the affected window.

Gate passed on Firefox 153.0.4 with normal/second/private, active rest and
geometry, all edge paths, complete native Urlbar/Downloads/sidebar paths,
customize/browser fullscreen, Browser Toolbox, emergency fallback, CSS
corruption, safe-start, and cleanup evidence.

The gate result above is historical #15 evidence. ADR-037/ADR-038/ADR-042's
changed rule set, caption presentation, and host-anchored handoffs still
require the manual matrix and are not claimed by that run.

Evidence: ADR-032 and
`docs/research/firefox-153-content-only-activation.md`.

## Milestone M: Hardening and Firefox updates — complete (#16)

Validate and document:

- clean start, restart, session restore;
- normal, second-normal, and private windows;
- complete four-edge pointer/keyboard/focus/popup/corner matrix;
- narrow, short, ultrawide, snapped, maximized, high-DPI, browser fullscreen,
  DOM fullscreen, customize mode, reduced motion, forced colors, and
  transparency fallback;
- prompts, dialogs, notifications, extension access, Library, Downloads,
  DevTools, Browser Toolbox, and OS controls;
- tab, navigation, address/Urlbar coverage, bookmark, and download event stress;
- missing/malformed package, host, CSS, controller, component, and bridge
  failures;
- repeated lifecycle and leak checks;
- idle/interaction performance baselines;
- install, update, exact one-sided repair, disable, stale-cache recovery, and
  uninstall;
- complete dependency, resource-exposure, logging, private-window, and
  provenance review;
- one real Firefox stable transition when available.

Gate: a new contributor can reproduce installation, diagnosis, recovery,
update, and removal from the repository documentation.

The gate passed with fixed local/CI PowerShell suites, a privacy-safe aggregate
resource mode, installer repair/rollback coverage, the reconciled Firefox 153
inventory, and the procedure in `docs/firefox-update-workflow.md`. Firefox
153.0.4 remained the newest stable on 2026-08-16, so this milestone records a
same-build rehearsal and leaves the first real stable transition honestly not
run. See
`docs/research/firefox-153-mvp-hardening-update-rehearsal.md`.

## Milestone N: Nav-bar widget mirror — implementation complete, real Firefox smoke pending (#64, ADR-044)

Started from the Deferred "extension toolbar/action replacement" item with
owner approval for the bounded ADR-037 privacy relaxation. Mirror the user's
`CustomizableUI` nav-bar layout read-only in the Fennevia top row with
project-owned components: extension action buttons (real icon, badge, name),
pinned built-in buttons (curated `ShellIcon` tokens, generic fallback), and
spacers as gaps. Native customize mode was the only editor in this milestone;
listeners plus a bounded attribute observer republish revision snapshots.
Extension popups anchor on the clicked project button through
`PanelUI.showSubView` and the ADR-042 hold path. The capability is optional
and never joins activation health. CustomizableUI writes, drag editing,
panel-content cloning, and overflow mirroring stay deferred to ADR-045.

Gate: CI passes with focused bridge/adapter coverage; the real Firefox rows in
`docs/testing-and-recovery.md` §6.8 are recorded honestly (currently
`not run`). Plan: `plans/005-topbar-widget-mirror.md`; evidence:
`docs/research/firefox-153-toolbar-widget-mirror.md`.

## Milestone O: Fennevia-owned customize mode — implementation complete, real Firefox smoke pending (ADR-045)

Deprecate the ADR-044 mirror as the only widget source. The toolbar-widgets
controller becomes layout-driven across all four edges, exposes the complete
current CustomizableUI inventory as an opaque-token palette, adds Fennevia
`show-bookmarks` / `show-downloads` widgets, and accepts a fixed edit set with
a revision guard. A project-owned editor drawer under the top panel performs
all editing. Profile-local `fennevia.customize.layout` / `.style` prefs persist
versioned JSON. Owner-approved bounded writes adopt widgets onto the collapsed
nav-bar and restore them on removal or reset. Native customize mode remains a
fixed handoff. Editing is optional and never joins activation health.

Gate: CI passes with focused model/bridge/adapter coverage; the real Firefox
rows in `docs/testing-and-recovery.md` §6.9 are recorded honestly (currently
`not run`). Plan: `plans/006-customize-mode.md`; evidence:
`docs/research/firefox-153-customize-mode.md`.

## Deferred work

The following require separate plans and issues:

- complete Urlbar suggestions/providers and search modes;
- Firefox View replacement;
- identity and permission panel replacement;
- extension toolbar/action replacement beyond the ADR-045 Fennevia customize
  mode (native-area drag-and-drop, panel-content cloning, overflow mirroring);
- complete bookmarks/history manager;
- complete Downloads manager and file actions;
- bookmark drag-and-drop/editing;
- tab groups, split view, workspaces, multi-select, and container icons;
- custom titlebar and OS window controls;
- arbitrary theme editor or CSS injection;
- any `browser.xhtml` or internal-component override;
- stable release support, automatic updates, signing, attestations, and SBOM;
- Linux, macOS, touch, or tablet support without real evidence.
