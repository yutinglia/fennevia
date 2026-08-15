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

- package `0.7.0-dev`;
- Firefox 153.0.4 release on Windows;
- #2, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12, #17, #22, and #31
  complete;
- functional vertical tabs in the left surface;
- functional primary navigation and bounded page status in the top surface;
- right and bottom surfaces mounted as honest non-functional placeholders;
- Firefox native visible UI retained;
- no production caller enters `active`.

Next feature work:

1. #13 combines the left address input with the completed tab surface and
   depends on the navigation/address contract;
2. #14 right bookmarks and #32 bottom downloads may proceed after their
   research/bridge prerequisites;
3. #15 activates content-only mode only after all feature blockers pass;
4. #16 hardens the complete MVP.

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
- one project-owned generated style node.

Each host contains exactly one project-owned mount target and one Svelte root.
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
controller, emergency handler, and declared bridge capabilities. Production
still stops at `healthy`; no native selector is hidden.

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

Deferred:

- drag reorder;
- tab groups/workspaces;
- multi-select;
- audio/attention/previews;
- full native-equivalent context menus.

Evidence: ADR-025, ADR-026, and
`docs/research/firefox-153-tab-strip.md`.

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
- top: functional primary navigation and bounded page status;
- right: non-functional placeholder;
- bottom: non-functional placeholder.

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
- no custom titlebar or caption buttons.

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
Issue #13 still owns independent address editing, URL/search submission, and
`Ctrl+L`.

Evidence: ADR-027 and
`docs/research/firefox-153-navigation-controls.md`.

## Milestone H: Left-edge address input — pending (#13)

Compose the address input with the completed #11 tab UI inside the existing left
surface.

### Bridge and command work

Research current Firefox semantics for:

- user-facing display location;
- URL fixup;
- ordinary search submission;
- principals and load options;
- dangerous/special schemes;
- current-tab disposition;
- `Ctrl+L` command ownership and fallback.

Expose only bounded ordinary text, typed state, and explicit actions.

### UI work

- compact address region above the tab list;
- independent draft while editing;
- `Ctrl+L` reveals left edge, focuses, and selects only while the healthy custom
  shell owns the command;
- native `Ctrl+L` remains available while inactive, failed, safe-started,
  unsupported, or disposed;
- Enter submits;
- first Escape reverts editing, later Escape dismisses the surface through #31;
- coherent focus order between input and tabs;
- no suggestions, rich results, search modes, identity UI, or arbitrary
  `loadURI` helper.

Gate:

- URL-like and search-like input matches basic native Urlbar behavior;
- navigation cannot overwrite an active draft;
- no input or complete URL enters diagnostics or persistence;
- combined left surface remains bounded and hidden at rest;
- native Urlbar remains visible and unchanged;
- failure restores native fallback.

## Milestone I: Right-edge bookmarks — pending (#14)

Replace the obsolete generic “sidebar MVP” direction with a focused,
project-owned right-edge bookmarks feature.

### Places bridge

Research and implement:

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

## Milestone J: Bottom-edge download progress/status — pending (#32)

### Downloads bridge

Research and implement:

- current Downloads modules/list/view semantics;
- active, paused, succeeded, failed, and canceled state;
- known-size and unknown-size progress;
- aggregate progress definition;
- normal/private isolation;
- event/view-driven updates;
- context-bound opaque IDs;
- bounded safe display values;
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

## Milestone K: Content-only active mode — pending (#15)

Begin only after #7, #31, #11, #12, #13, #14, and #32 are complete with real
native-visible validation.

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
- native prompts, notifications, dialogs, find bar, menus, extension actions,
  Library, Downloads access, DevTools, and OS controls remain reachable;
- customize mode normally suspends active mode;
- DOM fullscreen follows an explicit security-preserving policy.

Gate: every controlled failure leaves or restores a usable native browser shell.

## Milestone L: Hardening and Firefox updates — pending (#16)

Validate and document:

- clean start, restart, session restore;
- normal, second-normal, and private windows;
- complete four-edge pointer/keyboard/focus/popup/corner matrix;
- narrow, short, ultrawide, snapped, maximized, high-DPI, browser fullscreen,
  DOM fullscreen, customize mode, reduced motion, forced colors, and
  transparency fallback;
- prompts, dialogs, notifications, extension access, Library, Downloads,
  DevTools, Browser Toolbox, and OS controls;
- tab, navigation, address, bookmark, and download event stress;
- missing/malformed package, host, CSS, controller, component, and bridge
  failures;
- repeated lifecycle and leak checks;
- idle/interaction performance baselines;
- install, update, disable, stale-cache recovery, and uninstall;
- complete dependency, resource-exposure, logging, private-window, and
  provenance review;
- one real Firefox stable transition when available.

Gate: a new contributor can reproduce installation, diagnosis, recovery,
update, and removal from the repository documentation.

## Deferred work

The following require separate plans and issues:

- complete Urlbar suggestions/providers and search modes;
- Firefox View replacement;
- identity and permission panel replacement;
- extension toolbar/action replacement;
- complete bookmarks/history manager;
- complete Downloads manager and file actions;
- bookmark drag-and-drop/editing;
- tab drag reorder, groups, workspaces, containers UI, and multi-select;
- custom titlebar and OS window controls;
- arbitrary theme editor or CSS injection;
- any `browser.xhtml` or internal-component override;
- public installer/release packaging;
- Linux, macOS, touch, or tablet support without real evidence.
