<!-- SPDX-License-Identifier: MPL-2.0 -->

# Composable everything-is-a-widget customize plan

## 1. Status and owner request

Status: implementation complete on 2026-08-25; the ordinary automated gate
passes and the explicit real-Firefox/manual visual rows remain pending. This
plan was created before code changes from a direct project-owner request.
Unchecked real-Firefox rows are not passed.

The owner requested a large expansion of Fennevia customize mode:

- treat browser controls, Firefox toolbar actions, window controls, and the
  principal Fennevia feature areas as placeable widgets;
- make every edge panel use a composable layout rather than one fixed feature
  followed by one flat widget row;
- add Row and Column layout widgets so users can arrange and reorder nested
  groups without editing JSON or CSS;
- let the main feature areas render horizontally or vertically according to
  their containing Row/Column configuration;
- require at least one working Fennevia Customize widget in every accepted
  layout;
- add an opt-in setting that permits compatible widgets to appear in more than
  one position when the underlying owner can safely support it.
- make Bottom a general fully composable panel rather than a fixed Downloads
  panel, and let Left, Right, and Bottom be enabled independently while Top
  remains mandatory and cannot be disabled.

This plan is the first changed file for the request. Implementation starts only
after this file exists in the worktree.

## 2. Owner-approved architecture update

This request explicitly supersedes only the fixed-composition clauses of
ADR-026, ADR-037, ADR-038, ADR-045, ADR-064, and the matching current plans:

- Back, Forward, Reload/Stop, Home, Firefox tools, project window controls,
  address launcher, tabs, bookmarks, and Downloads status no longer have to be
  hard-coded children of one particular edge component;
- an edge is no longer limited to one flat horizontal toolbar-widget zone;
- tabs/address and bookmarks may be placed by the composable layout instead of
  only through the complete `tabs-left` / `tabs-right` role swap;
- the bottom edge no longer has a fixed Downloads role; Downloads status is an
  ordinary singleton feature widget that may move to another enabled edge;
- the visible project-owned window controls may be moved as widgets while the
  retained Firefox caption nodes remain attached for fail-open recovery.

The update does **not** relax these rules:

- Firefox-owned DOM is never deleted, reparented, cloned, or mounted into a
  project host;
- Svelte still consumes ordinary adapters and cannot access Firefox globals;
- security, permission, authentication, extension, popup, and download-safety
  contents stay Firefox-owned;
- the four existing edge hosts, triggers, reveal controller, timers, popup
  holds, collision policy, and disposer remain the only shell owners;
- hidden-at-rest surfaces reserve no permanent content geometry;
- missing or malformed required state fails safe to a valid default layout,
  and runtime failure still exposes native Firefox UI immediately;
- no runtime network dependency, arbitrary CSS, arbitrary command, or new
  content-accessible mapping is introduced.

The accepted ADR added by this work must record the owner request and mark the
older fixed-composition clauses as narrowly superseded. Historical research
records stay historical.

## 3. Product contract

### 3.1 Widget inventory

The public palette should expose these project-owned widget definitions when
their required adapter is available:

- navigation: Back, Forward, Reload/Stop, Home, and New Tab;
- address: Firefox Trust and the non-editable address/search launcher;
- main features: Tabs, Bookmarks, and Downloads status;
- Firefox handoffs: Unified Extensions, Settings, application menu, show
  bookmarks, native Downloads, and full-page translation;
- window: Minimize, Maximize/Restore, and Close;
- shell: private-window indicator and Customize;
- current Firefox `CustomizableUI` built-ins, extension actions, compound
  widgets, separator, spacer, and flexible space;
- structural Row and Column containers;
- one-child Center, Expanded, and Padding wrappers. These are deliberately
  composable: `Expanded > Center > widget` allocates the parent's remaining
  main-axis space and centers the widget inside that constraint.

Each project-owned definition has a fixed enum id, localized label, icon,
capability policy, duplicate policy, and rendering owner. The frontend receives
no raw Firefox widget id; existing opaque palette and activation handles remain
the privileged boundary.

### 3.2 Composable layout

Replace version-1 flat zone arrays with a strict version-2 tree:

```text
layout
├─ top:    node[]
├─ left:   node[]
├─ right:  node[]
└─ bottom: node[]

node = item | row | column | wrapper
row/column = bounded container node with child node[]
wrapper = center | expanded | padding, with zero or one child node
item = one project, Firefox, extension, or spacing widget instance
```

Every persisted node has a non-sensitive, layout-local instance id. Drag,
keyboard editing, focus restoration, and keyed rendering address instance ids
and bounded tree paths rather than Firefox ids or labels.

Bounds:

- maximum four edge roots;
- maximum nesting depth 3 below an edge root;
- maximum 48 direct children per container;
- maximum 128 total nodes;
- maximum 64 adopted Firefox ids;
- existing 16 KiB serialized preference cap;
- no unknown keys, node types, widget ids, orientation values, or duplicate
  instance ids.

Row/Column are layout containers, not independent edge surfaces. They create no
new trigger, timer, popup owner, z-index layer, browser-window observer, or
Svelte mount root. A container exposes an accessible group label only in
customize mode and becomes presentational in ordinary browsing.

Each edge root is also a fixed, non-removable base flow: Top and Bottom are
Rows; Left and Right are Columns. Users arrange ordinary children directly in
that flow and add palette Row/Column nodes only for nested groups. For existing
version-2 state, a sole root-level container whose axis matches its edge is
promoted visually and interactively to this compatibility base: it keeps its
paths and children but has no draggable node chrome, axis/remove controls, or
large editing outline. Root-padding drops are redirected into that base, and
its direct children cannot be moved outside it. This avoids a redundant giant
Row/Column box without rewriting the preference merely because it was read.

Follow Flutter's constraint-aware Flex defaults rather than making every child
flexible. An edge's root Row/Column receives the bounded panel size and occupies
that available axis (`mainAxisSize: max`). Children retain their natural main-
axis size, stay in DOM order from `start`, and center on the cross axis. Only an
explicit Expanded wrapper receives remaining main-axis space. A nested
Row/Column therefore fills a bounded incoming axis but shrink-wraps when its
parent gives it an unbounded same-axis measurement, instead of every sibling
becoming an equal `flex: 1` cell. This follows Flutter's official Row/Column
layout algorithm and defaults:
<https://api.flutter.dev/flutter/widgets/Row-class.html> and
<https://api.flutter.dev/flutter/widgets/Column-class.html>.

### 3.3 Orientation

The nearest Row/Column container supplies an explicit `horizontal` or
`vertical` layout axis. Main feature widgets receive that axis through an
ordinary Svelte prop:

- Tabs uses horizontal ARIA/keyboard order in a Row and vertical order in a
  Column, while retaining native order, pinning, multi-select, drag, and
  bounded overflow semantics;
- Bookmarks uses a horizontal bar presentation in a Row and the current
  vertical tree/list presentation in a Column;
- the address launcher, Downloads status, navigation controls, Firefox tools,
  and window controls use axis-aware grouping and overflow without rotated
  text;
- narrow/short fallback may wrap only inside its owning container and must not
  change persisted order.

Orientation changes presentation only. It must not create a second adapter,
Firefox listener, feature timer, or persisted copy of browsing-derived state.

### 3.4 Mandatory Customize widget

Every accepted layout contains exactly one Customize widget by default and at
least one at all times. The Customize widget is a project-owned semantic button
that opens the existing shared customize session and drawer.

- version-1 migration and default layout always insert it;
- parsing version-2 data without it fails safe to the default layout;
- removing or moving it is allowed only when the resulting layout still has at
  least one instance;
- reset restores the documented default position;
- the editor must keep a keyboard-reachable close route and deterministic focus
  restoration to the surviving Customize instance;
- the widget remains a singleton even when compatible duplicates are enabled.

This invariant prevents a saved layout from making its own editor unreachable.
Emergency fallback and retained native Firefox UI remain independent recovery
paths.

### 3.5 Multiple-position setting

Add `allowMultiplePlacements: boolean` to the strict version-2 layout object,
default `false`, with a labeled control in the Customize **Panels/Layout** tab.

When false, adding an already placed definition moves its existing instance,
matching current behavior. When true:

- ordinary project controls and Firefox toolbar mirrors that are safe to
  render more than once may create another layout instance;
- every mirror instance resolves the same current opaque activation owner and
  popup path; no native node is cloned or moved;
- adopted Firefox widgets are restored only after their last Fennevia instance
  is removed;
- singleton main features (Tabs, Bookmarks, Downloads status, address
  launcher), private indicator, and Customize remain single-instance because
  duplicate DOM ids, focus owners, or feature interaction state would be
  misleading;
- the palette explains unavailable duplication rather than silently creating a
  dead control.

Changing the setting from true to false is accepted only when the current tree
already has no incompatible duplicate definitions; otherwise the editor shows
a bounded actionable error and leaves the saved layout unchanged.

Row, Column, separator, space, and flexible-space definitions are structural
layout primitives and remain repeatable regardless of this setting. They do
not represent duplicated browser actions or feature-state owners.

In ordinary browsing mode, structural empty space is also window chrome:
Space, Flexible space, Separator, empty Row/Column containers, and unoccupied
container gaps must start the existing Firefox window-drag path. Interactive
widget descendants remain explicit no-drag targets, and customize mode disables
window dragging across the editor so layout gestures cannot move the window.

### 3.6 Empty edges and fail-open

Top remains reachable because it contains the mandatory Customize widget by
default and is always enabled. Left, Right, and Bottom each gain an explicit
enabled boolean; Top has no enabled setting and cannot be disabled. Disabling
an optional edge retains its layout but removes its pointer/keyboard trigger,
clears focus and holds, and renders no panel content until re-enabled. An empty
edge uses the same disabled behavior in ordinary browsing even when its
preference is enabled. While customize mode is open, every enabled optional
edge remains visible as an empty labelled drop zone so a first widget can be
dragged or keyboard-added into it; a preference-disabled edge appears after the
user enables it. Re-adding a node re-enables that same edge when its preference
permits it. No fifth surface or alternate reveal path is added.

The old `bottomDownloadsEnabled` preference field is migrated to a general
bottom-panel enabled value. Missing Left/Right values default to enabled so old
profiles preserve their current presentation. A change that would disable the
edge containing the only Customize widget is rejected until Customize has been
moved to Top or another enabled edge.

User removal of an optional feature is a valid configuration, not a runtime
health failure. A malformed layout, unavailable required Customize owner, or
frontend/controller exception uses the valid default layout or existing
native-visible fail-open path.

### 3.7 Clean all panels

Add one destructive **Clean all panels** action to the Customize Panels/Layout
tab. It first opens a project-owned accessible confirmation alert dialog. Cancel
does not issue an edit. Confirm atomically removes every placed feature,
Firefox widget, structural container, separator, space, and flexible space from
all four roots, restores every adopted Firefox widget after its final instance,
and inserts one mandatory Customize widget in Top. Panel enable, light, compact-
window, appearance, and interaction preferences are unchanged. This is distinct
from Reset layout, which restores the documented default composition.

### 3.8 Flutter-style wrapper semantics

Center, Expanded, and Padding are structural nodes and are always repeatable,
like Row, Column, Separator, Space, and Flexible space. They have no Firefox
state owner and introduce no browser data flow.

- **Center** accepts zero or one child and centers that child on both axes. Like
  Flutter Center, it becomes as large as bounded incoming constraints allow and
  matches its child on an unconstrained dimension.
- **Expanded** accepts zero or one child and is the only wrapper that requests
  the parent's remaining main-axis space. Its child stretches into that
  allocation; nesting Center inside it provides the familiar Flutter
  `Expanded(child: Center(...))` behavior.
- **Padding** accepts zero or one child and applies one existing Fennevia spacing
  token on every side; it does not persist arbitrary numeric CSS.

All three wrappers inherit the nearest Row/Column orientation for feature
presentation. Empty wrappers remain visible and droppable in customize mode;
ordinary mode gives them only their defined intrinsic/expanded geometry. A
drop, keyboard add, or move that would create a second direct child is rejected
with the existing bounded edit feedback. Wrapper nesting counts toward the same
depth and total-node limits as Row/Column.

Reference semantics:
<https://api.flutter.dev/flutter/widgets/Expanded-class.html>,
<https://api.flutter.dev/flutter/widgets/Center-class.html>, and
<https://api.flutter.dev/flutter/widgets/Padding-class.html>.

### 3.9 Native version-2 default composition

Do not construct a fresh or reset version-2 layout by treating the live
Firefox navigation toolbar as a version-1 layout. Its profile-specific
extensions, spacers, flexible spaces, and ordering are valid palette inputs,
but they do not form a stable default for the new constraint-aware tree.

The documented default is an explicit tree whose children live directly in
the fixed edge base flows:

- **Top Row:** Back, Forward, Reload/Stop, Home, Trust,
  `Expanded(Address launcher)`, native Downloads handoff, Extensions,
  Settings, Customize, Firefox menu, Private indicator, Minimize,
  Maximize/Restore, and Close;
- **Tabs-side Column:** New Tab and `Expanded(Tabs)`;
- **Bookmarks-side Column:** `Expanded(Bookmarks)`;
- **Bottom Row:** `Expanded(Center(Downloads status))`.

Historical note: ADR-084 later supersedes this initial explicit default from
direct project-owner layout evidence. The current fresh/reset/fallback tree
moves Address into a standard-padded Row on the configured tabs side, uses the
integrated-New-Tab Tabs style followed by a Separator, and leaves an empty
Expanded region in Top. The version-2 schema and saved-layout preservation
rules in this plan are unchanged; see
`plans/017-owner-default-layout-and-customize-backdrop.md`.

Tabs remain Left and Bookmarks Right by default, while a retained version-1
`sidePanelLayout` migration hint may swap those two complete side trees. A
fresh profile, malformed-layout fallback, and Reset layout use this explicit
default. A valid saved version-2 tree remains user-owned and is never silently
replaced. A valid saved version-1 tree still migrates its four explicit zone
orders and adopted Firefox widgets; the absence of a layout preference is no
longer misclassified as a version-1 Firefox-toolbar mirror. Firefox built-ins
and extension actions remain discoverable in the palette without being placed
by default.

## 4. Persistence and migration

- [x] Add a strict version-2 layout schema with node ids, nested Row/Column
      children, one-child wrappers, and `allowMultiplePlacements`.
- [x] Parse valid version-1 preferences and migrate them in memory without
      discarding the user's four zone orders or adopted list.
- [x] Materialize current fixed Fennevia controls/features around migrated
      version-1 zone entries so the first v2 save preserves current behavior.
- [x] Save only version 2 after the first edit; never rewrite a preference just
      because it was read.
- [x] Keep the 16 KiB cap, strict unknown-key rejection, fixed id patterns,
      deterministic serialization, and default fallback.
- [x] Reject cycles, excessive depth/counts, duplicate instance ids, missing
      Customize, forbidden duplicate definitions, over-capacity wrappers, and
      invalid containers.
- [x] Preserve bounded CustomizableUI adopt/restore behavior and restore only
      after the last instance disappears.
- [x] Add pure tree helpers for lookup, insertion, move, removal, containment,
      ancestor checks, path normalization, and nearest-container orientation.

## 5. Implementation checklist

### A. Architecture and contracts

- [x] Add the accepted architecture decision and mark only the stale fixed-
      composition clauses as superseded.
- [x] Add ordinary contract enums for project widgets, structural containers,
      one-child wrappers, orientation, duplicate policy, layout nodes, and
      path-based edits.
- [x] Replace the Downloads-specific bottom enabled field with general Left,
      Right, and Bottom panel enabled state; keep Top hard-enabled and migrate
      older panel preferences without rewriting on read.
- [x] Keep widget definitions separate from rendered instances and keep raw
      Firefox ids privileged.
- [x] Preserve the existing stable facades and feature-first module boundaries.
- [x] Update the shell health contract so required adapters stay validated even
      when their corresponding user widget is not placed.

### B. Privileged customize engine

- [x] Build the v2/default/migrated layout and recursively project immutable
      ordinary nodes for each edge.
- [x] Add the explicit native-v2 default tree, use it for fresh/reset/fallback
      state, and stop mirroring live Firefox navigation-bar placements into a
      no-preference default.
- [x] Keep valid v1 migration and valid saved-v2 ownership distinct: preserve
      explicit legacy zone/adoption data and never overwrite a saved v2 tree
      merely because the documented default changed.
- [x] Add project-widget palette entries with localized frontend labels and
      fixed icon tokens; do not persist presentation text.
- [x] Keep Firefox/extension widget activation and popup anchoring unchanged.
- [x] Resolve duplicate mirror instances to the current same-window native
      owner without native-node cloning.
- [x] Implement path-based add/move/remove/container edits with revision guard,
      mandatory-Customize validation, duplicate policy, adoption, and rollback.
- [x] Enforce zero-or-one-child wrapper capacity for add and cross-parent move,
      while keeping nested paths, cycle checks, and rollback deterministic.
- [x] Add one atomic `clean-layout` edit that restores adopted Firefox widgets,
      empties all roots, and creates only the mandatory Top Customize instance.
- [x] Observe the existing preference domain and deterministically clear all
      node/activation/palette registries on dispose.

### C. Frontend composition

- [x] Replace fixed edge feature composition with one recursive layout renderer
      under each existing edge root.
- [x] Extract project widget components so `App.svelte` and surface hosts remain
      wiring rather than a new catch-all.
- [x] Render Back/Forward/Reload/Home/New Tab, Trust/address, Firefox handoffs,
      window controls, private indicator, and Customize through the same layout
      instance contract.
- [x] Render Tabs, Bookmarks, and Downloads status through axis-aware wrappers
      without creating duplicate data owners.
- [x] Give root/nested Row/Column Flutter-like max/start/center constraint
      behavior without flexing ordinary children; render Center, Expanded, and
      Padding as composable one-child wrappers, and let only Expanded claim
      remaining parent-axis space.
- [x] Make every panel root a fixed base Row/Column, visually promote a sole
      matching legacy container to that base, and keep only user-added nested
      flows removable/editable.
- [x] Treat Bottom exactly like the other composable roots; do not mount
      Downloads status there unless its layout contains that widget.
- [x] Keep enabled empty Left/Right/Bottom roots hidden in ordinary mode but
      visible and droppable throughout customize mode.
- [x] Keep native popup holds, edge context menus, surface focus, Escape, and
      window-drag exclusion behavior intact.
- [x] Mark Space, Flexible space, Separator, empty Row/Column areas, and layout
      gaps as window-drag regions outside customize mode; keep controls and the
      active editor no-drag.
- [x] Disable activation during customize mode while retaining editor controls.

### D. Customize interaction

- [x] Add Row and Column tiles to the palette with consistent vector icons and
      accessible names.
- [x] Add Center, Expanded, and Padding palette tiles, labels, icons, empty
      one-child drop targets, and keyboard insertion behavior.
- [x] Show nested live drop targets, insertion markers, container outlines, and
      selected parent/axis without obscuring keyboard focus.
- [x] Clear every panel/palette drag-hover outline when the pointer leaves its
      real boundary and after drop, cancel, drag end, customize close, or
      component disposal; a target must never retain the blue outline from a
      completed or abandoned drag.
- [x] Change drag payloads from flat zone indexes to opaque instance/path data;
      never include Firefox ids, labels, URLs, or extension identity.
- [x] Keep drag as an enhancement. Add visible/keyboard move before, move after,
      move into, move out, and remove alternatives for every placed item.
- [x] Preserve Ctrl+Arrow reordering where unambiguous and add documented
      parent/child keyboard commands for nested layouts.
- [x] Add the multiple-placement setting with helper text and safe validation.
- [x] Add independent Left/Right/Bottom enabled controls, omit a Top toggle,
      retain disabled-edge layouts, and reject disabling the sole Customize
      edge.
- [x] Prevent removal of the last Customize widget and announce the reason in
      the existing polite status output without moving focus.
- [x] Add a Clean all panels button with an accessible destructive confirmation
      alert; Cancel must be side-effect free and Confirm must leave Customize
      reachable in Top and every enabled empty edge available as a drop target.
- [x] Restore focus by instance id after move/remove/close and keep visual tab
      order identical to DOM/focus order.
- [x] Keep each node's move/containment/axis/remove controls visually hidden by
      default and reveal them only while that node is hovered or contains
      keyboard focus; controls must remain keyboard reachable and visibly
      focused.

### E. Layout and accessibility

- [x] Add axis-aware CSS using the existing frame tokens and scoped selectors;
      no arbitrary CSS values or native selectors.
- [x] Audit every rendered widget family at both root and nested Row/Column
      levels: action buttons, compound Firefox widgets, Trust/private chips,
      address launcher, Tabs, Bookmarks, Downloads, structural items, and
      empty containers. Fixed controls must center on the cross axis, feature
      widgets must fill their intended area, and Flexible space must grow on
      the active axis.
- [x] Verify Row/Column max/start/center behavior with natural-size ordinary
      children plus composed `Expanded > Center`, Padding, empty-wrapper, and
      wrapper-capacity behavior in both parent axes.
- [x] Give the placeable address launcher dedicated compact chrome. It must not
      inherit the old fixed-side launcher section gradient, padding, or divider;
      its button stays one bounded control-height row with ellipsis in both
      horizontal and vertical layouts.
- [x] Keep empty root panels fully droppable while presenting one compact
      centered empty-state affordance instead of a full-panel inset rectangle;
      keep ordinary node outlines neutral until hover or keyboard focus.
- [x] Keep non-empty item/container/wrapper outlines transparent at rest in
      customize mode; reveal only the deepest hovered/focused boundary and a
      compact structural label, while actual drag targets retain an
      unmistakable focus-color outline.
- [x] Keep icon-only controls named and all focus indicators visible in light,
      dark, reduced-transparency, reduced-motion, and forced-colors modes.
- [x] Ensure nested containers do not create inaccessible nested toolbars or
      duplicate landmark names.
- [x] Keep focused controls unobscured by the customize drawer and bounded
      panel scrolling.
- [ ] Verify long localized labels, 200% text, narrow/short windows, maximize,
      restore, fullscreen, and high-DPI fallback geometry.
- [x] Confirm drag is never the sole movement mechanism. This follows the
      focused `ui-ux-pro-max` WCAG 2.2 guidance; its local Svelte stack dataset
      had no verified nested-reorder match, so implementation details must rely
      on repository patterns plus the general semantic guidance.

### F. Tests and documentation

- [x] Model tests cover v1 migration, v2 parsing/serialization, bounds, paths,
      nested moves, cycle rejection, required Customize, duplicate policy,
      wrapper shape/capacity, accessible-edge validation, optional-edge enable
      migration, explicit native-v2 defaults, reset/fallback behavior, and
      last-instance adoption restore.
- [x] Controller/adapter tests cover recursive snapshots, opaque identity,
      palette capabilities, stale edits, preference observation, duplicated
      mirrors, atomic confirmed clean, adopted-widget restore, missing
      capability, and disposal.
- [x] Frontend/static tests cover every project widget, Row/Column rendering,
      Center/Expanded/Padding composition, horizontal/vertical semantics,
      nested drag targets, keyboard alternatives, focus restoration,
      drag-feedback cleanup, contextual node controls, root/nested widget
      alignment, compact address chrome, intrinsic/expanded structural sizing,
      scoped CSS, and forbidden native access.
- [x] Update `plans/000-master-plan.md`, `plans/002-shell-roadmap.md`,
      `plans/006-customize-mode.md`, `docs/architecture.md`,
      `docs/architecture-decisions.md`, `docs/firefox-internals-map.md`,
      `docs/security-and-privacy.md`, `docs/testing-and-recovery.md`, README,
      and current status where affected.
- [x] Rebuild generated bridge/frontend artifacts; never hand-edit `dist/` or
      installed generated files.
- [x] Run focused format/type/unit/build checks while iterating.
- [x] Run `npm run verify` as the ordinary development gate.
- [x] Record real Firefox 153/154 nested-layout, orientation, popup, caption,
      multi-window, private-window, recovery, accessibility, and visual rows as
      `not run` unless they are actually performed.

## 6. Delivery slices and progress

1. **Model foundation:** v2 tree, migration, mandatory Customize, duplicate
   policy, path edits, and focused tests.
2. **Recursive projection:** privileged controller and ordinary adapter expose
   composable nodes while retaining current activation owners.
3. **Everything-as-widget UI:** extract fixed controls/features and render them
   through the four existing roots.
4. **Nested editor:** Row/Column live layout, drag paths, keyboard/button
   alternatives, duplicate setting, and focus restoration.
5. **Orientation:** axis-aware Tabs, Bookmarks, address, Downloads, tool, and
   window-control presentation.
6. **Flutter-style flow and wrappers:** bounded max-size Row/Column with
   start-ordered natural children plus Center, Expanded, and Padding one-child
   composition.
7. **Native v2 default:** deterministic direct children in each fixed base
   flow, with profile-specific Firefox toolbar items left in the palette.
8. **Normative synchronization and verification:** docs, generated artifacts,
   focused checks, ordinary gate, and honest manual-test record.

Progress log:

- [x] 2026-08-25: read repository rules, master/shell/customize plans, relevant
      ADRs, security policy, customize research, issue #64, current source, and
      recent relevant commits before writing this plan.
- [x] 2026-08-25: create this plan/checklist as the first worktree change.
- [x] Model foundation complete.
- [x] Recursive projection complete.
- [x] Everything-as-widget UI complete.
- [x] Nested editor and orientation complete.
- [x] Documentation and ordinary verification gate complete.
- [x] 2026-08-25: correct the initial nested-container sizing regression so
      ordinary Row/Column nodes retain natural parent-axis size, compatibility
      base flows still fill their panels, and only Expanded explicitly claims
      remaining space; add a focused CSS regression assertion.
- [ ] Real-Firefox/manual visual matrix complete; currently recorded `not run`.

## 7. Explicit non-goals

- Reimplementing Firefox `CustomizeMode.sys.mjs` or dragging into native areas.
- Cloning extension/native popup contents or Firefox toolbar DOM.
- Arbitrary user JavaScript, CSS, commands, URLs, layout expressions, or remote
  assets.
- A fifth edge, second address overlay, new reveal timer, or alternate window
  lifecycle owner.
- Simultaneously rendering singleton feature areas that require unique DOM,
  focus, drag, or popup ownership.
- Claiming Linux, macOS, touch/tablet, later Firefox, or real-browser success
  without exact evidence.
