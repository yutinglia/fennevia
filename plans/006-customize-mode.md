<!-- SPDX-License-Identifier: MPL-2.0 -->

# Fennevia-owned customize mode implementation plan

## 1. Status and goal

Status: implementation and documentation complete on
`feat/fennevia-customize-mode` (ADR-045); ADR-046 adds localized names and
native built-in icons; ADR-047 replaces the drawer list editor with live
four-edge HTML5 drag-and-drop. The manual real-Firefox checklist in
`docs/testing-and-recovery.md` §6.9 is still `not run`.

This pass deprecates the ADR-044 read-only nav-bar widget mirror as the only
widget source and adds a Fennevia-owned customize mode:

- the full current `CustomizableUI` widget inventory, extensions included, as
  an opaque-token palette;
- project-owned placement editing across all four edge panels;
- Fennevia-owned placeable widgets (`show-bookmarks` reveals the right-edge
  bookmarks surface; `show-downloads` opens Firefox's `#downloadsPanel`) and
  spacer/spring/separator specials;
- bounded style tokens applied as a fixed CSS custom-property set;
- profile-local persistence and owner-approved bounded CustomizableUI writes.

Native customize mode remains available through the Firefox application menu,
complete native reveal, and fail-open; it is not a fixed top-row control.
Fennevia never writes
`browser.uiCustomization.state` directly and never edits placements the user
made natively.

## 2. Owner-approved rule update

The project owner approved (2026-08-18, planning conversation) two bounded
relaxations, recorded as ADR-045:

- the layout preference may persist Firefox widget ids, including extension
  widget ids, on the privileged side; extension identity remains banned from
  logs, diagnostics, serialized frontend state, CSS variables, and root
  datasets;
- the controller may perform bounded `CustomizableUI` writes:
  `addWidgetToArea(id, "nav-bar")` onto the collapsed native nav-bar when
  placing a widget that has no live node, recording it in the persisted
  `adopted` list, and the inverse restore (extensions return to `AREA_ADDONS`,
  others to the palette) when the last Fennevia placement is removed or the
  layout is reset.

## 3. Reference boundary

`yutinglia/my-firefox-custom` is not consulted. Firefox 153.0.4 sources are
pinned in `docs/research/firefox-153-customize-mode.md`. ADR-044 research in
`docs/research/firefox-153-toolbar-widget-mirror.md` remains the read/render/
activation contract.

## 4. Implementation checklist

- [x] Record inventory, write, and preference contracts against the pinned
      Firefox 153.0.4 tag.
- [x] Add ADR-045 and annotate the superseded ADR-044 clauses.
- [x] Keep `src/firefox/toolbar-widgets.ts` as the per-window engine; add
      `src/firefox/customize-model.ts` for bounded layout/style JSON.
- [x] Default top zone falls back to the live nav-bar mirror; first edit
      materializes `fennevia.customize.layout`.
- [x] Palette enumerates placed areas plus `getUnusedWidgets`, Fennevia
      widgets, and specials behind opaque tokens.
- [x] Editor drawer under the top panel with add/move/remove/reset, including
      cross-zone moves, held through the #31 popup hold. ADR-047 keeps the
      drawer as palette plus style and moves placement onto live zones.
- [x] ADR-047 live four-edge HTML5 drag-and-drop: customize session holds all
      four popup holds, opaque `application/x-fennevia-toolbar-widget` payload,
      existing `add`/`move`/`remove` edits, keyboard Delete/Ctrl+Arrow/Enter,
      and no native-area CustomizeMode copy.
- [x] Bounded style tokens on the project frame root; skipped under forced
      colors; cleared on dispose. ADR-051 maps empty color defaults to Firefox
      chrome design-system tokens.
- [x] Skip list includes placements already represented by fixed Fennevia
      controls, including Unified Extensions and the application menu.
- [x] Unit tests for model, bridge, adapter, skip list, missing capability,
      and disposal.
- [x] Internals map, security/privacy, plans, README, and testing matrix
      synchronized.
- [x] ADR-046 localized palette/zone names and native chrome/resource icons
      via CSS mask; unit coverage for palette lookup, dedicated sync
      Localization, CSSOM, and forbidden `forWindow`.
- [ ] Real-Firefox matrix in `docs/testing-and-recovery.md` §6.9.

## 5. Explicit non-goals

- Reimplementing native `CustomizeMode.sys.mjs` drag-and-drop into native
  areas.
- Writing `browser.uiCustomization.state` directly.
- A second overlay host, edge trigger, hide timer, or z-index system.
- Cloning panel contents or mirroring the overflow panel.
