# Customize-mode drag and editor UX plan

Date: 2026-08-25
Status: implementation and ordinary automated gate complete; real Firefox rows not run
Baseline: commit `8cd3f3d` (`feat(customize): add composable edge widget layouts`)

## 1. Owner request

After the composable widget system passed the ordinary gate and was committed,
the project owner requested a second pass focused on customize-mode usability.
The named priority is a drag preview comparable to Fennevia's tab strip, plus
other editor UX improvements that make a large nested widget tree easier to
understand and operate.

The initial drag/editor pass did not require a persistence change. A subsequent
owner follow-up added bounded per-instance widget styles, so this plan now also
extends v2 item nodes with one optional allowlisted style id. Duplicate policy,
panel availability rules, native Firefox ownership, and fail-open behavior do
not change.

## 2. UX outcomes

### 2.1 Direct manipulation

- A palette tile or placed node uses a bounded custom drag image instead of an
  arbitrary browser snapshot.
- The source node remains in the tree as a subdued origin placeholder while it
  is being moved.
- The currently projected destination contains one axis-aware preview slot at
  the exact insertion index. The slot carries the widget icon and localized
  label where meaningful, so users can see the result before dropping.
- Siblings animate around the projected slot with the existing motion tokens;
  reduced-motion mode removes the transition.
- Exactly one deepest valid container or empty wrapper owns the active preview.
  A stale panel outline or preview must clear on leave, drop, cancellation,
  customize close, and component disposal.
- Dragging near a scrollable panel edge performs bounded frame-based autoscroll
  without timers that survive the drag.

### 2.2 Editor clarity

- Clicking or focusing a placed node selects it. The selected node keeps one
  compact action strip visible after pointer exit; selecting another node or
  pressing Escape clears the previous selection.
- Hover remains a lightweight inspection path, while selection provides a
  stable pointer and keyboard path for move, nest, orientation, and remove
  actions.
- The active destination is announced only when its panel/path/index changes,
  avoiding repeated live-region noise on every `dragover` event.
- Action labels, drop-area labels, drag status, and selection status are
  localized rather than hard-coded English.

### 2.3 Palette discoverability

- Add a localized search field that filters by the visible localized widget
  label without changing palette tokens or privileged identities.
- Add compact All, Fennevia, Firefox, and Layout category filters derived from
  the existing closed palette kinds.
- Show a bounded result count and a useful no-results state. Escape clears a
  non-empty search before it closes customize mode.
- Keep click/Enter/Space addition to the selected panel and all existing drag
  paths. Search and categories are discovery aids, not a drag-only workflow.

### 2.4 Per-instance widget styles

- A selected widget may expose a compact Style selector only when that widget
  has registered, meaningful variants. The setting belongs to that placed
  instance rather than applying globally.
- The first Address launcher variants are `address-only` and
  `with-site-status`; the latter includes the existing Firefox-owned site trust
  action inside the address control without cloning its native owner.
- The first Tabs variants are `tabs-only` and `with-new-tab`; the latter places
  the existing New Tab action after the last tab in the tab strip, matching the
  earlier Fennevia interaction while retaining the standalone New Tab widget.
- The model uses a closed widget-id/style-id registry and a generic
  `set-node-style` edit so other project widgets can add reviewed variants
  without introducing arbitrary CSS or a new persistence shape each time.
- Existing v2 layouts with no style field read as each widget's default. Invalid
  or unsupported style ids are rejected through the existing fail-safe layout
  recovery path.

## 3. Security and architecture constraints

- Keep the serialized `DataTransfer` payload opaque: palette token or layout
  instance id only. Labels, extension identity, Firefox ids, URLs, and browsing
  data must not be added.
- Derive preview presentation only from the already validated ordinary
  frontend snapshot and keep it component-local.
- Clamp drag-image and projected-slot dimensions. Never persist geometry.
- Persist only a bounded allowlisted style id on eligible project-widget item
  nodes. Never persist CSS declarations, class names, labels, or native ids.
- Keep the shared drag lifecycle as the sole cross-surface cleanup signal.
- Do not clone or reparent native Firefox nodes to produce a preview.
- Drag remains an enhancement; existing keyboard and visible action controls
  remain fully functional.

## 4. Implementation checklist

### A. Plan and evidence

- [x] Commit the completed composable-layout baseline before this UX pass.
- [x] Create this plan/checklist before changing UX code.
- [x] Inspect and reuse the tab-strip drag feedback principles without coupling
      toolbar layout state to the tab drag coordinator.

### B. Drag presentation

- [x] Add pure bounded helpers for projected preview sizing and panel
      autoscroll; cover invalid and axis-specific inputs.
- [x] Add a component-local validated preview descriptor derived from the
      active opaque drag source and current ordinary toolbar snapshot.
- [x] Set bounded pointer-relative drag images for palette tiles and placed
      nodes.
- [x] Render one keyed projected slot at the exact root/nested insertion index,
      including empty containers and wrappers.
- [x] Subdue the source node, animate affected layout siblings, and keep actual
      drag targets visibly distinct from ordinary selection/hover chrome.
- [x] Add bounded requestAnimationFrame autoscroll and deterministic cleanup.
- [x] Preserve real-boundary leave, drag end, cancel, customize-close, and
      disposal cleanup.

### C. Selection and action UX

- [x] Add single-node selection per panel with pointer and focus entry paths.
- [x] Keep controls visible only for the selected, deepest-hovered, or
      direct-focus node.
- [x] Clear selection on Escape before closing customize mode and after the
      selected node is removed.
- [x] Localize node action, drop target, selection, and drag destination text.
- [x] Keep focus restoration and keyboard move/nest/remove operations intact.

### D. Palette UX

- [x] Add search and closed category filters over localized labels and kinds.
- [x] Add result count, selected destination context, and no-results feedback.
- [x] Make Escape clear search first; keep Enter/Space/click addition and drag.
- [x] Give palette tiles matching selected/dragging/grab cursor feedback without
      exposing their opaque tokens visually.

### E. Accessibility and visual states

- [x] Announce only changed drag destinations and completed edits in the polite
      live region.
- [x] Keep focus indicators and selected/drop distinctions usable in forced
      colors and reduced-transparency modes.
- [x] Disable drag/sibling motion under `prefers-reduced-motion`.
- [x] Preserve minimum target sizes and avoid action strips covering the main
      widget label or control at 200% text.

### F. Verification and synchronization

- [x] Add unit/static tests for preview sizing, autoscroll, exact insertion
      slots, opaque payloads, selection, filters, Escape priority, cleanup,
      reduced motion, and forced colors.
- [x] Update current UX/recovery documentation and this checklist.
- [x] Rebuild generated frontend artifacts.
- [x] Run focused checks while iterating.
- [x] Run `npm run verify` as the ordinary development gate.
- [x] Record live Firefox visual/interaction checks as `not run` unless they are
      actually performed.

### G. Per-instance widget styles

- [x] Add a closed project-widget style registry with defaults and bounded ids.
- [x] Extend v2 parse/serialize/copy/migration and snapshots with an optional
      per-item style while preserving old v2 data unchanged on read.
- [x] Add a revision-guarded `set-node-style` edit that rejects non-item,
      unsupported-widget, invalid-style, stale, or foreign locations.
- [x] Show a localized Style selector in the selected node's contextual editor
      only when multiple registered variants exist.
- [x] Add Address launcher `address-only` and `with-site-status` rendering by
      reusing the current trust adapter/action and popup ownership.
- [x] Add Tabs `tabs-only` and `with-new-tab` rendering with the existing New
      Tab action after the final tab for both horizontal and vertical axes.
- [x] Keep standalone Trust and New Tab widgets available and preserve all
      duplicate/single-instance rules.
- [x] Cover schema defaults/rejection, edit validation, rendering hooks,
      localization, and generated artifact output in tests and documentation.

## 5. Out of scope

- Persisting editor selection, palette filters, drag geometry, or open tabs.
- Freeform pixel positioning, overlapping widgets, arbitrary CSS, or absolute
  canvas coordinates.
- Replacing HTML drag-and-drop with a second pointer-only drag engine.
- Removing the keyboard move/nest/remove controls.
- Native Firefox DOM cloning or toolbar-node reparenting for drag visuals.
