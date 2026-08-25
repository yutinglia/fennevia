<!-- SPDX-License-Identifier: MPL-2.0 -->

# Customize palette hierarchy and layout guide plan

Date: 2026-08-26
Status: completed; real Firefox visual matrix not run
Baseline: commit `3dc850e` (`release: publish 0.16.0-beta.1`)

## 1. Owner request and clarification

Improve Fennevia customize mode for ordinary users. The owner clarified that
"large widgets should be on top" means the widget picker (palette), not the
Top edge panel:

- large feature widgets such as the address launcher and Tabs should have
  their own palette classification;
- those feature widgets should sort before other available widgets in the
  palette's All view;
- companion actions should stay beside their related large widget: Address
  with Trust, Tabs with New Tab, Bookmarks with Show Bookmarks, and Download
  status with Show Downloads;
- customize mode should include an explanation page, especially for the
  Row/Column layout model and Center/Expanded/Padding wrappers;
- make other small UI/UX improvements that reduce the learning cost without
  removing precise drag placement or keyboard alternatives.

This plan is the first worktree change for the request. Code changes begin only
after this file exists.

The owner's first visual review exposed two additional failure cases in the
initial implementation: the destination label collapsed to one CJK character
per line, and a fixed companion column left large holes or placed an unrelated
regular tile beside a primary feature when one member of a pair was absent.
The implementation therefore treats pairing as explicit semantic state rather
than inferring it from grid position.

## 2. Current evidence and constraints

- ADR-074 defines four fixed edge base flows: Top/Bottom are Rows and
  Left/Right are Columns. Ordinary children stay intrinsic; only Expanded and
  Flexible space claim remaining main-axis room.
- ADR-075 currently exposes the closed All/Fennevia/Firefox/Layout palette
  categories. Filtering uses localized labels and fixed palette kinds, while
  drag payloads contain only opaque palette tokens or layout-local instance
  ids.
- ADR-076 keeps layout actions in one session-wide floating inspector, so a
  help page must explain that existing owner instead of adding controls inside
  layout nodes.
- Main feature widgets are single-instance and may be absent from the palette
  while already placed. Their classification applies whenever they are
  available; it does not create disabled duplicate tiles.
- The four edge hosts, shared reveal controller, popup holds, drag lifecycle,
  persistence schemas, Firefox adapters, and fail-open paths remain unchanged.

Focused `ui-ux-pro-max` guidance supports a skippable, user-invoked explanation
instead of a forced tour, sequential heading hierarchy, consistent type scale,
and fixed-element overlap awareness. Its Svelte stack dataset returned no
verified accessibility match after one retry, so implementation details use
the repository's existing ARIA tablist and keyboard-editing patterns plus the
general accessibility guidance.

## 3. UX contract

### 3.1 Main-feature palette class

- Add one closed `feature` palette kind for Address, Tabs, Bookmarks, and
  Downloads status. These are the large, stateful feature widgets whose layout
  usually needs a wrapper. Add a closed `feature-companion` kind for Trust,
  New Tab, Show Bookmarks, and Show Downloads, plus a closed semantic group for
  each primary/companion relationship.
- Add a localized **Main features** palette category between All and Fennevia.
- Order the available feature entries as four fixed pairs: Address + Trust,
  Tabs + New Tab, Bookmarks + Show Bookmarks, and Download status + Show
  Downloads. When both members are available, the primary tile is visually
  larger and the companion occupies the adjacent slot. A primary-only result
  spans the row; a companion-only search result flows as a normal compact tile;
  and a companion whose primary is already placed returns to the ordinary
  Fennevia classification. Do not add a disabled or duplicate substitute.
- In All, search results keep every matching entry but sort Main features
  first. Ordering within each classification remains deterministic.
- Give feature tiles a dedicated semantic class/data attribute and a visibly
  stronger, wider treatment. The category remains understandable through its
  text label and does not rely on color alone.
- Preserve the opaque palette token, existing search behavior, result count,
  click/Enter/Space addition, precise drag placement, and palette-drop removal.
- Do not expose or infer Firefox widget ids in the frontend. The privileged
  controller assigns the closed classification from fixed project widget ids.

### 3.2 Layout guide page

- Add a fifth **Guide** tab to the existing non-modal customize dialog. It is
  always optional and never blocks editing.
- Explain the four edge base flows first: Top/Bottom flow horizontally and
  Left/Right flow vertically.
- Explain each structural widget in plain language:
  - Row and Column set child direction;
  - Expanded gives one child the parent's remaining main-axis room;
  - Center centers one child inside available room;
  - Padding adds the fixed Fennevia inset;
  - Space, Flexible space, and Separator shape gaps without becoming browser
    features.
- Show three compact recipes that mirror the deterministic default layout:
  Top controls with `Expanded(Address)`, side New Tab with `Expanded(Tabs)`,
  and `Expanded(Center(Downloads))` on Bottom.
- Explain the interaction model: choose a destination then click/press a tile,
  drag for exact placement, select a placed widget for the floating inspector,
  and use Reset layout for recovery.
- Use localized static project text, semantic headings/lists, and CSS diagrams.
  Add no remote content, tutorial state, preference, native dependency, or new
  popup/overlay owner.

### 3.3 Widget-tab clarity

- Replace the three stacked introductory notes with one concise instruction
  card that states the current default/customized state and the complete
  click/drag/selection path.
- Keep the add-destination selector next to that instruction so the result of a
  click is clear before users reach the palette.
- Keep detailed wrapper education in Guide rather than overloading the primary
  widget-selection task.

## 4. Accessibility and responsive behavior

- Preserve the existing tablist roving focus, Arrow/Home/End keys, selected
  state, and matching tab/tabpanel ids for the fifth tab.
- Keep the visual order of palette entries equal to DOM and keyboard order.
- Use a heading sequence that starts at the existing dialog title and continues
  with `h3`/`h4`; diagrams are supplementary and receive equivalent text.
- Feature classification uses visible text plus structure, not color alone.
- Tiles and tab labels remain usable with long localization, narrow windows,
  200% text, forced colors, reduced transparency, and reduced motion.
- Complete feature pairs use wide/compact columns only while there is room;
  below the smallest breakpoint both tiles stack in DOM order. Destination
  labels reflow as words instead of collapsing into vertical CJK characters.
- Drag remains optional; click, Enter/Space, the floating inspector, Delete,
  and Ctrl+axis operations remain available.

## 5. Implementation checklist

### A. Contract and palette model

- [x] Add the closed feature/feature-companion palette kinds and fixed paired
      project-id order.
- [x] Assign that kind only to Address, Tabs, Bookmarks, and Downloads status
      when the privileged controller publishes available project widgets.
- [x] Validate/copy the new kind and closed feature group through the ordinary
      adapter boundary.
- [x] Add the Main features category and deterministic feature-first filtering.
- [x] Keep each complete primary/companion group adjacent without changing
      DOM/focus order, and reflow incomplete groups without empty grid columns.
- [x] Keep all non-feature Fennevia, Firefox, and Layout classifications
      unchanged.

### B. Customize UI

- [x] Add localized Main features category text and semantic feature-tile
      class/data state.
- [x] Render Main feature tiles first in All without duplicating entries.
- [x] Replace the stacked widget notes with one concise instruction card.
- [x] Add a dedicated `CustomizeGuideSection.svelte` and a fifth Guide tab.
- [x] Add compact base-flow, wrapper, recipe, and editing explanations in
      English and Traditional Chinese.

### C. Visual and accessibility treatment

- [x] Style feature tiles as the highest palette hierarchy while preserving
      focus, drag, selected, forced-color, and reduced-motion states.
- [x] Style the Guide as readable cards/definition rows with responsive CSS
      diagrams and no horizontal overflow.
- [x] Add responsive rules and static regressions for tab wrapping, destination
      label reflow, incomplete groups, and sequential headings.

### D. Tests and normative synchronization

- [x] Add focused palette tests for the new closed category, feature-first
      order, localized filtering, frozen results, and unchanged entry identity.
- [x] Add controller/adapter tests that prove classification is fixed,
      validated, non-persisted, and absent from opaque drag payloads.
- [x] Add frontend/source tests for the fifth tab, guide component, concise
      instruction card, semantic feature class, CSS hierarchy, and forced-color
      behavior.
- [x] Update ADR/current architecture, security/privacy data-flow wording,
      testing/recovery rows, roadmap/status, and README where current customize
      behavior is described.
- [x] Rebuild generated frontend/bridge/package artifacts; never hand-edit
      generated output.
- [x] Run focused tests while iterating.
- [x] Pass `npm run verify` as the ordinary development gate.
- [x] Record real Firefox visual, 200% text, keyboard, forced-colors,
      multi-window, and private-window checks as `not run`; they were not
      performed in this change.

## 6. Delivery order

1. Closed classification and pure palette ordering tests.
2. Main-feature category and tile hierarchy.
3. Guide tab/component and concise widget instructions.
4. Responsive/accessibility styling and static regressions.
5. Normative documentation, generated artifacts, and verification.

## 7. Validation evidence

- `npm run typecheck`: passed with 0 Svelte errors and 0 warnings.
- `npm run lint`: passed.
- Focused customize, controller, adapter, frontend-build, and source-structure
  run: 58/58 tests passed.
- `npm run verify`: passed with 421/421 Node tests, 88.47% line coverage,
  80.85% branch coverage, 95.62% function coverage, every fixed PowerShell 7
  suite, dependency audit, deterministic frontend/bridge output, and 14/14
  accepted production artifacts.
- Real Firefox visual, 200% text, keyboard, forced-colors, multi-window, and
  private-window checks: `not run`.

## 8. Explicit non-goals

- Moving feature widgets to the Top edge automatically or rewriting a saved
  layout.
- Showing duplicate disabled copies of single-instance widgets already placed.
- Persisting palette category, query, guide position, tutorial completion, or
  classification.
- Changing Row/Column/Expanded sizing semantics or adding freeform geometry.
- Replacing the floating inspector, HTML drag engine, keyboard alternatives,
  Firefox-owned UI, or shared edge controller.
- Adding a dependency, runtime network content, another Svelte root, popup,
  overlay, trigger, timer, or Firefox-internal API.
