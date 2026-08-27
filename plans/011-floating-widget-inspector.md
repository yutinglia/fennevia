# Floating widget inspector plan

Date: 2026-08-25
Status: follow-up implementation complete; real Firefox smoke pending
Baseline: commit `b270777` (`feat(customize): refine drag editing and widget styles`)

## 1. Owner request

The current selected-node action toolbar and per-widget Style selector are
rendered inside the layout node. On narrow side panels they cover the widget,
force the selected node to grow, and can compress the Style label into a
vertical stack. Because selection is currently local to each edge root, several
node editors may also remain visible at once.

Replace that presentation with one floating widget inspector for the complete
customize session. The inspector must never participate in Row/Column sizing,
and selecting a widget on any edge must replace the previous selection and
inspector.

## 2. UX contract

- Clicking or focusing an editable node selects that instance across all four
  edge roots. Exactly one instance may be selected per browser-window customize
  session.
- Every editable node keeps a subtle blue boundary for the complete customize
  session. The deepest pointer-hovered and selected nodes strengthen that
  boundary, while direct keyboard focus keeps its separate visible ring. Move,
  nest, direction, remove, and semantic Style controls live in one compact
  floating inspector.
- The inspector is anchored on the content-facing side of the selected node:
  below Top, right of Left, left of Right, and above Bottom. Its final rectangle
  is clamped to the visible browser viewport. The central customize workspace
  is a positioning obstacle: the inspector tries another side before allowing
  either panel to cover the other. It repositions after scrolling, resizing,
  selection changes, or a successful layout edit.
- While any project widget drag is active, the inspector remains mounted but
  yields hit testing and fades out so the underlying exact drop target stays
  reachable. The same shared terminal drag signal restores it without clearing
  the selected widget.
- The inspector uses a stable header with the localized widget name and a clear
  close button, one compact action row, and a full-width labelled Style field
  only for widgets with multiple registered variants.
- Hover may reveal a node boundary/structure label, but must not reveal another
  toolbar. Selecting a different node replaces the inspector instead of
  stacking another panel.
- Editable nodes become direct keyboard stops. Enter moves focus into the
  inspector; Escape from either the node or inspector closes the inspector and
  restores focus to the selected node when it still exists.
- Delete/Backspace and Ctrl+axis keyboard alternatives remain available on the
  selected node. Removing the selected node clears the session selection and
  restores focus to the nearest surviving layout path.
- The inspector uses existing glass, spacing, focus, reduced-motion,
  reduced-transparency, and forced-colors tokens. It must not obscure the
  focused control.

## 3. Architecture and privacy

- Extend the existing per-window `CustomizeSessionController` with one
  ephemeral validated layout-instance selection. This is the sole cross-root
  selection owner and is cleared on close and disposal.
- Persist nothing new. The selection contains only an existing bounded
  layout-local instance id; it never contains a Firefox widget id, extension
  identity, label, URL, style value, DOM node, or geometry.
- Resolve the selected location and ordinary node from the current validated
  toolbar snapshot. The Top app root renders exactly one inspector after the
  central customize workspace and resolves its anchor across the shared
  project-owned frame, so no edge-panel stacking context can cover it.
- Render the inspector as project-owned XHTML in the existing Top customize
  overlay layer. Do not portal into, clone, move, or reparent Firefox-owned DOM.
- Keep geometry as component-local finite numbers. A pure bounded placement
  helper selects and clamps the preferred side; listeners/observers are
  installed only while the inspector exists and have deterministic cleanup.
- Reuse the existing revision-guarded edit operations and bridge. This change
  adds no privileged action, Firefox dependency, timer owner, surface, or
  persistence schema.
- Reuse the existing opaque toolbar-widget drag lifecycle as the sole inspector
  dodge signal. Do not add pointer tracking, drag geometry to session state, or
  a second drag owner.

## 4. Implementation checklist

### A. Session-wide selection

- [x] Add a closed selected-instance field and set/clear methods to the
      customize session snapshot/controller.
- [x] Validate layout instance ids and clear selection on customize close and
      controller disposal.
- [x] Cover publication, no-op, invalid input, close, and disposal behavior in
      unit tests.

### B. Floating inspector

- [x] Add a pure preferred-side/clamped-position helper with invalid-geometry
      and central-workspace obstacle handling, with tests for
      Top/Left/Right/Bottom and narrow viewports.
- [x] Add a dedicated inspector component with localized title, close action,
      move/nest/axis/remove controls, and conditional semantic Style selector.
- [x] Render exactly one inspector in the Top customize overlay layer, above
      edge-panel and central-workspace stacking contexts.
- [x] Reposition after selection, revision, resize, descendant scroll, and
      element size changes; clean every listener and observer on unmount.
- [x] Keep the panel outside Row/Column sizing and use no native DOM portal.

### C. Node interaction and accessibility

- [x] Remove the in-node toolbar and Style editor from recursive node layout.
- [x] Keep persistent customize boundaries, a lightweight deepest-hover
      structure label, selected emphasis, and a distinct keyboard focus ring.
- [x] Make editable nodes keyboard focusable and expose selected/controls
      semantics.
- [x] Enter focuses the inspector; Escape closes it and restores node focus.
- [x] Preserve Delete/Backspace, Ctrl+axis movement, drag, and exact drop
      preview alternatives.
- [x] Keep focus rings, forced-colors distinctions, reduced-motion behavior,
      minimum pointer targets, and no-drag semantics.

### D. Verification and synchronization

- [x] Update ADR/current architecture, testing/recovery, roadmap, and status
      documents without rewriting historical records.
- [x] Update frontend static assertions for the one-inspector contract and the
      removal of in-node configuration layout.
- [x] Rebuild deterministic frontend/bridge/package artifacts.
- [x] Run focused unit, frontend, format, lint, and type checks while iterating.
- [x] Run `npm run verify` as the ordinary development gate.
- [x] Record real Firefox positioning, focus, zoom/text scaling, forced-colors,
      multi-window, and private-window checks as `not run` unless performed.

### E. Close and geometry-parity follow-up

- [x] Restore focus after inspector dismissal without focusing the hidden node
      selector that automatically reselects the same instance.
- [x] Keep a blue boundary visible on every editable widget for the complete
      customize session, with hover/selection emphasis and a separate keyboard
      focus ring.
- [x] Keep every customize boundary paint-only so entering customize mode does
      not add borders or minimum dimensions to real widget boxes.
- [x] Preserve programmatic focus, visible keyboard focus, drag selection, and
      usable structural-widget hit areas after removing metric-changing edit
      styles.
- [x] Add focused source/CSS regressions for a close action that stays closed
      and customize boundaries that preserve the real layout geometry.
- [x] Rebuild deterministic artifacts, run the ordinary verification gate, and
      record post-fix real Firefox visual checks honestly.

### F. Drag-obstruction follow-up

- [x] Subscribe the mounted inspector to the existing opaque widget-drag
      lifecycle and expose one component-local dodge state.
- [x] While dragging, make the positioned inspector transparent and
      pointer-inert so layout `dragover`/`drop` hit testing reaches the widget
      below it; restore it from the existing terminal signal.
- [x] Preserve session selection, the central palette removal target, keyboard
      move controls, reduced-motion behavior, and deterministic unsubscribe.
- [x] Add focused source/CSS regressions and rebuild deterministic artifacts.
- [ ] Run the real Firefox palette/layout-node/zone drag, Escape cancellation,
      focus restoration, multi-window, private-window, and forced-colors rows.

## 5. Out of scope

- A detachable, resizable, or persisted inspector window.
- Freeform inspector positioning or saved geometry.
- More widget style variants beyond the current closed registry.
- Replacing the HTML drag engine or keyboard edit operations.
- Portalling UI into Firefox-owned chrome or adding another popup/reveal owner.
