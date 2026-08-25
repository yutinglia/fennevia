<!-- SPDX-License-Identifier: MPL-2.0 -->

# Narrow-window four-panel UI/UX plan

Date: 2026-08-26
Status: implementation and ordinary automated gate complete; real Firefox
visual matrix not run
Baseline: commit `9ef8b79` (`fix(address): simplify popup and retry initial suggestions`)

## 1. Owner request and scope

Improve all four Fennevia edge panels whenever the Firefox window is narrow,
including ordinary windows that retain Firefox's native minimum and, with a
second denser fallback, windows where the owner enables `allowCompactWindow`
and the native chrome floor no longer protects the layout.

This plan is the first worktree file change for the request. Implementation
starts only after this plan and checklist exist.

The change is a responsive presentation follow-up to ADR-068 and ADR-077. It
does not add another preference, surface, trigger, controller, observer, timer,
or Firefox bridge. The existing four panel roots, reveal/focus/popup holds,
panel-dodge setting, composable widget trees, native fallback, and
`allowCompactWindow` fail-open behavior remain authoritative.

## 2. Current evidence and problem statement

- ADR-068 intentionally removes only Firefox's `:root` minimum width/height.
  It warns that chrome may clip but does not define a Fennevia layout below the
  native floor.
- The ordinary side width is bounded to roughly 42–43% of the viewport. When
  both sides reserve lanes, Bottom can be squeezed to an unusably small or
  inverted inline area at compact widths.
- A side panel that is the only visible side still remains a narrow rail even
  though the rest of the compact viewport is available.
- Top and Bottom use fixed Row semantics. Their composable roots already
  support bounded overflow, but compact spacing, scroll focus affordance, and
  a predictable fixed lane are not explicit.
- Side shortcut hints are positioned outside their panels. A nearly full-width
  compact side panel can therefore place the hint outside the viewport.
- The centered customize drawer derives all four insets from ordinary panel
  clearances. Once side panels become wider, that formula can leave no usable
  compact editor width.

Focused `ui-ux-pro-max` guidance selected content reflow, shrinkable Flex
children, explicit overflow access, and fixed-panel collision clearance over
clipping important content. The Svelte stack dataset returned no verified
responsive Flex/overflow match after one narrower retry, so framework details
must use the repository's current Svelte and CSS contracts.

## 3. Responsive UX contract

### 3.1 Responsive tiers

- Apply the new narrow-panel geometry at the documented narrow breakpoint
  regardless of `allowCompactWindow`, because Firefox's ordinary minimum still
  leaves the four feature panels cramped.
- Add a second ultra-compact density tier at a smaller breakpoint. ADR-068's
  opt-in root attribute normally makes that tier reachable, but the CSS remains
  viewport-driven so alternate valid Firefox window states receive the same
  safe reflow.
- Keep the existing wide-window geometry above the narrow breakpoint.
- Use only CSS media queries and the fixed root/frame attributes already owned
  by NativeUi and the shared shell. Do not add a resize observer, measurement
  loop, or persisted viewport state.

### 3.2 Four-panel compact geometry

- Keep Top above every other panel in one fixed-height lane whose configured
  clearance exactly matches its rendered height.
- Keep Bottom in one fixed-height, full available-width lane instead of
  subtracting two side widths from its inline size.
- At the ordinary narrow tier, expand one visible side panel to a bounded sheet
  but preserve at least 104 CSS px of exposed client area on its opposite side
  for pointer exit and the existing delayed auto-hide path.
- Only at the ultra-compact tier may one visible side use the full available
  width, where preserving both a useful panel and a large exit corridor is no
  longer possible. Keyboard dismissal and `Escape` remain available.
- When Left and Right are simultaneously visible, split the available inline
  space in DOM/edge order with a real gap and no overlap.
- When Bottom is visible, shorten side panels above its lane. In a reserved
  dodge mode, an enabled Bottom panel keeps that lane stable before reveal;
  dynamic modes reserve it only while Bottom is visible.
- Preserve the existing hidden transforms, `top > sides > bottom` ownership,
  pointer triggers, popup holds, single/multiple reveal policy, and zero
  permanent browser-content geometry.

### 3.3 Panel content priority and overflow

- Keep Top/Bottom base flows as Rows and Left/Right base flows as Columns; do
  not rewrite or reinterpret saved widget order.
- Make compact Top/Bottom roots use denser token-based gaps and bounded inline
  scrolling. Focused nodes receive scroll margin so keyboard navigation brings
  the complete control into view.
- Keep controls and feature roots shrinkable. Do not hide browser actions or
  make drag the only access path.
- In horizontal Tabs, collapse only the redundant visible heading text while
  retaining the labelled count output and complete ARIA orientation.
- Let vertical Downloads shrink below its ordinary preferred width, bound
  horizontal Bookmark controls, and keep context menus inside the panel.
- Re-anchor side shortcut hints inside compact side panels so the transient
  keyboard path remains visible instead of rendering beyond the viewport.

### 3.4 Customize and accessibility fallback

- Clamp the customize drawer directly to the compact viewport instead of
  applying impossible simultaneous side clearances. Its destination selector,
  click/Enter/Space additions, tabs, close route, and scrolling remain usable.
- Keep all four editable roots mounted and held by the existing customize
  session. Precise drag remains an enhancement; destination selection and
  keyboard editing remain the reliable compact path.
- Preserve logical DOM/focus order, visible focus, `Escape`, focus restoration,
  reduced motion, reduced transparency, and forced colors.
- Use no color-only compact state and introduce no smaller interactive target
  than the existing desktop control contract.

## 4. Security, privacy, and architecture review

- No new Firefox internal symbol, native DOM selector, network access,
  dependency, preference, browsing-derived field, URL/title value, log field,
  or content-accessible mapping is introduced.
- `allowCompactWindow` remains default-off, active-only, not a health input,
  and immediately reversible through the existing NativeUi root attribute.
- Responsive geometry reads only fixed shell visibility/enabled attributes and
  viewport media state in CSS. The existing compact-window root attribute is
  not consulted by the panel stylesheet.
- Native security UI, caption fallback, prompts, popups, permissions,
  authentication, Downloads safety, emergency fallback, and disposal are
  unchanged.

## 5. Implementation checklist

### A. Narrow and ultra-compact frame geometry

- [x] Add one narrow-width panel mosaic that works with or without the NativeUi
      compact-window root attribute.
- [x] Add one denser ultra-compact tier without changing persisted settings or
      panel-controller behavior.
- [x] Give Top and Bottom fixed matching visual/clearance lanes.
- [x] Make Bottom full-width in compact geometry and reserve its block lane
      from visible side panels.
- [x] Expand a lone visible side while preserving an easy pointer-exit corridor
      at the ordinary narrow tier; allow full width only in the ultra-compact
      tier; split Left/Right without overlap when both are visible.
- [x] Preserve reserved-mode stability from existing enabled-edge attributes.
- [x] Keep hidden transforms and the final visible transform override ordered
      correctly.

### B. Compact panel content

- [x] Add bounded inline overflow, compact spacing, focus scroll margin, and
      overscroll containment to Top/Bottom Row roots.
- [x] Keep feature roots and nested layout children at zero minimum size where
      needed.
- [x] Compact redundant horizontal Tabs heading copy without removing its
      accessible count or controls.
- [x] Let vertical Downloads and Bookmark context controls fit the compact
      panel instead of forcing overflow.
- [x] Move Left/Right shortcut hints inside the compact viewport.

### C. Customize and accessibility

- [x] Clamp the customize drawer to a usable viewport-relative compact sheet.
- [x] Preserve tab/tabpanel scrolling, destination-based additions, keyboard
      alternatives, close/focus behavior, and the four existing editable roots.
- [x] Verify forced-colors and reduced-motion rules continue to win where
      applicable.

### D. Tests and normative synchronization

- [x] Add focused frontend regressions for both responsive tiers, fixed lanes,
      single/dual side geometry, full-width Bottom, content overflow, hint, and
      customize fallback contracts.
- [x] Update ADR/current architecture, master plan, shell roadmap, current
      status, technical overview, and testing/recovery where compact panel
      behavior is described.
- [x] Rebuild generated frontend artifacts and package manifest from source;
      never hand-edit installed generated files.
- [x] Run focused tests while iterating and `npm run verify` as the ordinary
      development gate.
- [x] Record compact-width real Firefox 153/154, default/dynamic/reserved,
      one/two/all-panel, customize, keyboard, 200% text, forced-colors,
      second/private-window, popup, and recovery rows as `not run` unless they
      are actually performed.

## 6. Delivery order and progress

1. Plan and responsive behavior contract.
2. Compact panel geometry and content CSS.
3. Focused static/build regressions.
4. ADR and current normative documentation synchronization.
5. Generated artifacts and ordinary verification gate.

Progress:

- [x] 2026-08-26: read repository rules, local context, master plan, shell
      roadmap, composable-layout, panel-dodge, palette, toolbar, compact-window
      ADR/security/testing material, current source/tests, and recent relevant
      commits.
- [x] 2026-08-26: run focused responsive-overflow and Svelte stack guidance;
      record the verified general result and the absent stack-specific match.
- [x] 2026-08-26: create this plan/checklist as the first worktree file change.
- [x] 2026-08-26: incorporate owner correction that ordinary narrow side
      panels must retain a content exit corridor for reliable auto-hide and may
      use full width only in the ultra-compact tier.
- [x] Implementation complete.
- [x] Ordinary automated gate complete.
- [ ] Real-Firefox/manual visual matrix complete.

## 7. Explicit non-goals

- A new compact-window preference, breakpoint setting, persisted geometry, or
  automatic rewrite of the user's panel-dodge mode or composable layout.
- A fifth surface, another Svelte root, resize observer, reveal controller,
  collision owner, focus system, trigger, timer, or z-index scale.
- Hiding required actions, replacing native caption/security UI, or treating
  clipped native fallback chrome as a stable support promise.
- Claiming arbitrary zero-size windows are useful or that real Firefox visual
  behavior passed without running the documented matrix.

## 8. Validation record

- `node --test tests/frontend-build.test.mjs`: passed, 10/10 focused frontend
  tests before the complete gate.
- `npm run build`: passed; generated shell style artifact and package manifest
  rebuilt deterministically from source.
- `npm run verify`: passed on 2026-08-26 with 425/425 Node tests, 88.44% line
  coverage, 80.87% branch coverage, 95.62% function coverage, every fixed
  PowerShell 7 suite, dependency audit, deterministic rebuild, and 14/14
  accepted production artifacts.
- `powershell.exe` with `-NoProfile -ExecutionPolicy Bypass -File` and
  `./tests/run-static-powershell-tests.ps1`: passed every fixed-list Windows
  PowerShell 5.1 suite.
- Real Firefox 153/154 retained-floor and `allowCompactWindow` visual,
  interaction, accessibility, multiple/private-window, and recovery matrix:
  `not run`.
