<!-- SPDX-License-Identifier: MPL-2.0 -->

# Adaptive Firefox native-popup placement plan

Date: 2026-08-25
Status: implementation and ordinary automated gate complete; real Firefox rows not run
Baseline: commit `41caf4d` (`fix(customize): correct inspector dismissal and widget boundaries`)

## 1. Owner report

The placeable Firefox application-menu widget can sit on any Fennevia edge.
The original post-open placement always right-aligned `#appMenu-popup`, which
could send a left-side menu across the restored Firefox window into the
application behind it. The first containment correction clamped the complete
native popup into the Firefox client rectangle. With a menu almost as tall as
the window, that clamp moved the popup to the top edge and covered its own
toolbar button.

The owner clarified that overflow outside the Firefox window is acceptable.
Direction and an unobstructed trigger are more important than strict window
containment.

The owner subsequently asked for the same automatic direction selection on all
popup widgets when it can be implemented without separate per-panel patches.
The owner then observed a brief first-position-to-final-position jump. All
seven Fennevia popup actions already share one position resolver, so the edge
direction and alignment can be supplied to Firefox before opening. Post-show
movement is now only a compatibility fallback when a native owner refuses the
project host.

## 2. Selected behavior

- Keep `PanelUI.ensureReady()`, `PanelMultiView.openPopup()`, the existing
  `PanelUI.show()` fallback, popup holds, and all Firefox-owned menu contents.
- Resolve every Fennevia-initiated native popup's initial Firefox position in
  one shared path. Keep the application menu's dedicated initialization route.
- Prefer the content-facing opening direction: Top opens down, Bottom opens up,
  Left opens right, and Right opens left. Select start/end alignment from the
  host center relative to the owning client center so a top-left button opens
  down-right and a top-right button opens down-left.
- Pass that final initial position into `openPopup()` or
  `PanelMultiView.openPopup()`. Route Trust's owner call to the project host in
  the same narrow manner already used by Translation.
- If `popupshown` reports that Firefox already used the project host, do not
  move the panel again. If a native owner rejects or replaces the host, retain
  the measured fit/opposite/larger-space post-open correction as a fallback.
- Permit overflow beyond the owning Firefox client rectangle when necessary.
  Never center or clamp the popup across its trigger on the opening axis.
- On the cross axis, retain fit-first start/end alignment and clamp only that
  alignment in the measured compatibility fallback when neither choice fits.
- If host, panel, or viewport geometry is unavailable or malformed, retain a
  centralized directional `moveToAnchor()` fallback instead of guessing: Top
  `after_start`/`after_end`, Bottom `before_start`/`before_end`, Left
  `end_before`/`end_after`, and Right `start_before`/`start_after`. The address
  overlay remains `after_end`; a host without a recognized surface retains the
  action default.
- Do not resize or restyle native popups, clone their content, reparent native
  nodes, persist geometry, or expose native objects through the bridge.

## 3. Checklist

### A. Geometry and placement

- [x] Add strict finite positive window-viewport measurement.
- [x] Add pure fit-first cross-axis alignment helpers for compatibility
      fallback placement.
- [x] Keep a Top/Left/Right/Bottom host's preferred content-facing direction.
- [x] Flip when only the opposite side fits.
- [x] Compare available space when neither side fits.
- [x] Keep an oversized menu adjacent and allow client-window overflow.
- [x] Keep the existing `moveToAnchor()` fallback for missing geometry.
- [x] Resolve edge direction and start/end alignment before every native open.
- [x] Skip all post-show movement when Firefox used the requested project host.
- [x] Route Trust `PanelMultiView.openPopup()` to the final host and position
      before it opens.
- [x] Retain measured best-adjacent geometry only for owner-rejected anchors.
- [x] Keep application-menu initialization separate while sharing final
      placement.
- [x] Provide centralized Top/Bottom/Left/Right native anchor fallbacks for
      panels without measurable movement APIs.
- [x] Apply the same measured route when an already-open popup is moved.

### B. Regression coverage

- [x] Cover a non-zero restored-window screen origin.
- [x] Cover Top, Left, Right, and Bottom host geometry.
- [x] Cover all seven Fennevia popup actions using the shared initial resolver.
- [x] Cover all four edge-specific native anchor fallbacks.
- [x] Cover start/end alignment on both halves of horizontal and vertical
      edges.
- [x] Prove application menu and Trust pass the final host/direction into
      `PanelMultiView.openPopup()` without a post-show move.
- [x] Cover a tall popup that cannot fit on either side without covering its
      trigger.
- [x] Cover best-side selection when neither opening side fits.
- [x] Cover malformed geometry fallback.
- [x] Preserve `PanelMultiView` initialization and `PanelUI.show()` fallback
      assertions.
- [x] Preserve popup hold, toggle-close, cleanup, and privacy-safe bridge state.

### C. Documentation and verification

- [x] Update current architecture, ADR-042, Firefox-internals mapping, and the
      native-popup test matrix without rewriting older historical evidence.
- [x] Rebuild generated Firefox bridge and package artifacts.
- [x] Run focused browser-tools tests, formatting, lint, and typecheck.
- [x] Run `npm run verify` as the ordinary development gate.
- [x] Record real Firefox cross-edge/restored-window verification as `not run`
      unless it is actually performed.

## 4. Non-goals

- Replacing or styling Firefox application-menu rows.
- Forcing native popups to remain inside the owning client window.
- Restricting unrelated Firefox doorhangers or menus not initiated by a
  Fennevia popup widget.
- Adding a second popup owner, observer, timer, edge surface, or persistence
  field.
- Claiming Linux, macOS, or untested Firefox versions from Windows source and
  automated evidence.
