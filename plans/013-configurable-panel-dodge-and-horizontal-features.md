<!-- SPDX-License-Identifier: MPL-2.0 -->

# Configurable edge-panel dodge and horizontal feature layout plan

## 1. Status and owner request

Status: implemented and ordinary verification complete on 2026-08-25; the real
Firefox manual matrix remains `not run`. This plan and checklist was the first
worktree change for the request. Code changes began only after this file
existed in the worktree.

The project owner requested one persisted panel-behavior setting with four
closed choices:

| Persisted mode       | Simultaneous surfaces | Clearance behavior |
| -------------------- | --------------------- | ------------------ |
| `single-dynamic`     | One, except the bounded new-tab highlight | Existing visibility-driven dodge |
| `single-reserved`    | One, except the bounded new-tab highlight | Always reserve enabled adjacent edge lanes |
| `multiple-dynamic`   | Existing multi-hold behavior | Existing visibility-driven dodge |
| `multiple-reserved`  | Existing multi-hold behavior | Always reserve enabled adjacent edge lanes |

The request also includes correcting Tabs when placed in Top or Bottom and
auditing the other large feature widgets for the same cross-axis sizing,
overflow, or stretched-action problem.

## 2. Required behavior

### 2.1 Backward-compatible default

- Add `panelDodgeMode` to the strict `fennevia.customize.panels` payload.
- Use `multiple-dynamic` as the default and migration value because it
  preserves the current legitimate focus, keyboard, popup, and programmatic
  multi-surface holds together with current visibility-driven clearances.
- Parse existing panel preference versions without rewriting them merely
  because they were read. The next accepted panel edit serializes the new
  schema version.
- Reject unknown mode values, unknown keys, and malformed versions through the
  existing default-panel fallback.

### 2.2 Single-surface modes

- Before an ordinary pointer, keyboard, focus, or programmatic reveal,
  dismiss every other dismissible edge through the existing shared edge
  controller. Do not create a second visibility owner or timer.
- A Firefox-owned popup hold is authoritative. If another edge owns an open
  popup, reject a competing ordinary reveal rather than hiding its anchor or
  clearing the popup hold behind Firefox's back. If Firefox reports a new popup
  owner before reporting the old owner closed, retain both anchors for that
  native transition instead of clearing either hold behind Firefox's back.
- Customize mode retains its established all-edge popup holds so all four
  editable roots and empty drop targets remain available; single-panel policy
  applies to ordinary browsing rather than dismantling the editor.
- Switching from a multiple mode to a single mode immediately converges on the
  current active edge, preferring an existing popup-held edge when necessary.
- Preserve focus restoration through existing surface snapshot subscriptions;
  never leave focus inside a newly hidden panel.
- Keep pointer corner arbitration, delayed hide, window-drag retention,
  suppression, disabled edges, and disposal in the current shared contracts.

### 2.3 New-tab highlight exception

- Give the existing 500 ms new-tab highlight reveal one closed
  `new-tab-highlight` programmatic reason.
- In either single mode, that reason may temporarily reveal the edge containing
  Tabs alongside the otherwise active edge. It must not dismiss the active
  edge and must use the existing surface programmatic timer.
- Every other programmatic reveal remains exclusive in single mode.
- The exception carries only the fixed reason enum and edge. It introduces no
  tab id, URL, title, browsing-derived persistence, or new timer.

### 2.4 Dynamic and reserved clearances

The existing one-way priority remains `Top > Left/Right > Bottom`.

- Dynamic modes keep current behavior: side rails leave Top clearance only
  while Top is visible; Bottom leaves Left/Right clearance only while those
  rails are visible.
- Reserved modes keep Left and Right below the Top lane even while Top is
  hidden.
- Reserved modes keep Bottom between each currently enabled side lane even
  while that side panel is hidden.
- A preference-disabled or runtime-empty optional edge reserves no lane in
  ordinary mode. An enabled empty edge held as a customize drop target does
  reserve its lane while the editor is open.
- Clearances remain CSS custom properties on the one project frame. No content
  margin, native selector, layout observer, or JavaScript geometry loop is
  added.

## 3. Settings UX

- Place one labeled select in the existing **Panels/Layout** section instead of
  four unrelated toggles.
- Use four concise localized option labels combining the visibility and
  clearance consequences.
- Add persistent helper text explaining dynamic versus reserved lanes and the
  short new-tab exception.
- Keep native keyboard operation, visible focus, English/Traditional Chinese
  parity, bounded feedback, and the existing Reset panels behavior.
- Reset panels clears the preference and restores `multiple-dynamic` together
  with the other documented panel defaults.

Focused `ui-ux-pro-max` guidance matched fixed-panel overlap clearance: fixed
elements should account for other fixed elements instead of being stacked
carelessly. The local Svelte dataset returned no verified axis-overflow match
after one retry, so implementation details must use the repository's existing
Svelte, Flex, and overflow contracts rather than unverified stack advice.

## 4. Top/Bottom Tabs and large-feature audit

### 4.1 Tabs correction

- Treat the Tabs summary and tab strip as one axis-aware feature box so a
  composable layout sees one bounded child rather than two unrelated roots.
- In Row orientation, keep the summary intrinsic, let the tab partitions own
  the remaining inline space, and keep the integrated New Tab button intrinsic
  instead of `inline-size: 100%`.
- Preserve horizontal scrolling, pinned/regular partitioning, ARIA
  orientation, Left/Right keyboard movement, drag geometry, insertion markers,
  multi-select, and the 500 ms highlight.
- In Column orientation, preserve the existing bounded pinned section,
  independently scrolling regular section, full-width rows, and final New Tab
  action.

### 4.2 Other large widgets

- Audit Tabs, Bookmarks, Downloads status, and Address launcher in direct,
  nested, Center, Padding, and Expanded placements for both Row and Column.
- Require every feature root and shrinkable flex child to expose
  `min-inline-size: 0` and `min-block-size: 0` where needed.
- Keep only Expanded responsible for claiming parent main-axis remainder.
- Keep Bookmarks' horizontal list and Downloads' horizontal summary/progress
  bounded and scroll/clip inside their owning feature instead of enlarging the
  edge panel.
- Do not change feature state ownership, duplicate policy, Firefox bridges, or
  persisted layout order as part of this visual correction.

## 5. Security, privacy, and architecture boundaries

- Reuse ADR-026's four hosts, edge triggers, surface controllers, timers,
  holds, collision properties, environment suspension, and disposer.
- Persist only one closed mode enum in the existing bounded panel preference.
- Do not persist visibility, current active edge, focus, popup state, new-tab
  activity, panel dimensions, URLs, titles, private-window activity, or
  arbitrary CSS.
- Keep Firefox popup, permission, authentication, certificate, extension,
  download-safety, and native fallback ownership unchanged.
- Keep all behavior per window; preference observation may reconfigure each
  window, but runtime surface state must never become process-global.
- Missing optional customize persistence keeps the default behavior and does
  not become an activation-health requirement.

## 6. Implementation checklist

### A. Contracts and persistence

- [x] Add the closed four-value panel dodge enum and validation helpers.
- [x] Extend `ShellPanelConfigSnapshot` with `panelDodgeMode`.
- [x] Default old/missing values to `multiple-dynamic`.
- [x] Parse panel preference v1, v2, and the new schema; serialize only the new
      version after an edit.
- [x] Preserve the 16 KiB cap, unknown-key rejection, immutable copies, and
      reset behavior.

### B. Shared edge controller

- [x] Add validated runtime mode configuration and expose it in the shell
      snapshot.
- [x] Enforce ordinary single-surface reveals without bypassing popup holds or
      focus restoration.
- [x] Preserve current multiple-surface hold behavior in both multiple modes.
- [x] Add the closed new-tab-highlight exception using the existing
      programmatic timer.
- [x] Reconcile immediately and deterministically when the mode changes.
- [x] Preserve suppression, disabled-edge, window-drag, active-edge, and
      disposal behavior.

### C. Frame geometry and settings UI

- [x] Apply the validated mode to one fixed frame data attribute.
- [x] Track effective optional-edge enablement with fixed boolean frame
      attributes and clear them on disposal.
- [x] Keep dynamic CSS clearances unchanged.
- [x] Add reserved Top and enabled-side lane clearances with scoped selectors.
- [x] Add the localized four-option selector and helper text to Panels/Layout.
- [x] Keep keyboard/focus behavior and locale key parity intact.

### D. Large feature layout

- [x] Wrap each main feature in one axis-aware, bounded presentation root.
- [x] Keep horizontal Tabs summary intrinsic and the tab partitions flexible.
- [x] Make the horizontal integrated New Tab action intrinsic rather than full
      width.
- [x] Preserve vertical Tabs behavior and all tab interaction semantics.
- [x] Audit and correct min-size/flex/overflow behavior for Bookmarks,
      Downloads status, and Address launcher without making ordinary nodes
      Expanded.

### E. Tests and normative synchronization

- [x] Model tests cover defaults, every mode, v1/v2 migration, new schema
      round-trip, invalid modes/keys, partial edits, and reset.
- [x] Edge-controller tests cover single/multiple behavior, popup priority,
      mode switching, new-tab exception, timers, disabled edges, suppression,
      and disposal.
- [x] Frontend/static tests cover frame attributes, dynamic/reserved CSS,
      localized settings, the axis-aware feature root, compact horizontal New
      Tab, and all large-feature min-size/overflow contracts.
- [x] Update ADR-077 and synchronize master plan, shell roadmap, architecture,
      security/privacy, testing/recovery, current status, and README where the
      current behavior is described.
- [x] Rebuild generated frontend/bridge artifacts and manifest; never hand-edit
      generated output.
- [x] Run focused tests while iterating and `npm run verify` as the ordinary
      development gate.
- [x] Record the real Firefox 153/154 four-mode, new-tab highlight, top/bottom
      Tabs, narrow/short, second/private-window, popup, focus, and recovery
      matrix as `not run` unless actually performed.

## 7. Delivery order and progress

1. Plan and closed behavior contract.
2. Model/schema and controller tests.
3. Shared controller and frame clearance implementation.
4. Settings UI and localization.
5. Axis-aware Tabs correction and large-feature audit.
6. Normative documentation, generated artifacts, and verification.

Progress:

- [x] 2026-08-25: read repository rules, local context, master plan, shell
      roadmap, composable-layout plan, relevant ADRs, four-edge research,
      persistence security rules, current source, tests, and recent commits.
- [x] 2026-08-25: create this plan/checklist as the first worktree change.
- [x] Implementation complete.
- [x] Ordinary automated gate complete (`npm run verify`: 420 coverage tests,
      all fixed-list PowerShell suites, deterministic build, and production
      artifact scan passed).
- [ ] Real-Firefox/manual visual matrix complete.

## 8. Explicit non-goals

- A fifth edge, another Svelte root, another reveal timer, or another collision
  controller.
- Arbitrary per-panel pixel geometry, CSS injection, user scripts, or persisted
  runtime visibility.
- Closing or moving Firefox-owned popup contents to satisfy single mode.
- Replacing tab, bookmark, download, address, or security state owners.
- Claiming real Firefox visual success without running the documented matrix.
