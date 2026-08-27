# Urlbar editing value and container padding plan

Date: 2026-08-27
Status: implementation complete; automated gates passed; real Firefox smoke not
run
Baseline: commit `ac92f46` (`Merge pull request #118 from yutinglia-agent/codex/release-0.17.0-beta.1`)

## 1. Owner request and observed problem

Improve the custom address launcher and centered address panel so a committed
HTTPS location remains visually compact at rest but exposes its complete
`https://` prefix at an appropriate editing moment, matching Firefox's current
interaction model. Also provide an optional way to inset Row and Column content
so compact controls can align with the inner edge of larger feature widgets
such as Tabs without requiring arbitrary pixel values.

The owner follow-ups ask for horizontal and vertical breathing room around the
composable URL launcher widget only, plus usable Top overflow scrolling in a
narrow window without losing the remaining empty-space window-drag path. The
centered editable URL panel already has suitable outer spacing and must remain
unchanged.

The supplied screenshots are visual evidence only. They show a trimmed
`www.google.com` value in both the compact launcher and the already-focused
address panel, plus a nested control Row whose children sit closer to the panel
edge than the content inside the larger Tabs widget.

## 2. Firefox and UX evidence

- Firefox 153.0.4 and 154 retain a public `gURLBar.untrimmedValue` alongside
  the trimmed visible `gURLBar.value`. Their current `UrlbarInput.mjs` restores
  the untrimmed value for keyboard focus and selected editing paths, then trims
  an unchanged value again after blur.
- Fennevia's compact launcher is non-editable and remains the at-rest display,
  so it should continue to consume the bounded committed `gURLBar.value` while
  proxy state is valid.
- The centered panel is Fennevia's only editable address field and opens by
  immediately focusing and selecting its complete draft. It should therefore
  initialize from the bounded native untrimmed value at open time.
- The composable layout already uses `--fennevia-space-2` for its root inset,
  gaps, the Padding wrapper, and large feature-widget interiors. Reusing that
  token gives Row/Column content a predictable alignment preset without a
  free-form numeric setting.
- Firefox 153.0.4, 154.0, and 154.0.1 collect visible `drag` and `no-drag`
  border boxes independently and compute the final native titlebar region as
  their difference. A no-drag scroll root would therefore also remove every
  nested empty-space drag region.

## 3. UX and architecture contract

### Address editing

- Keep the compact launcher trimmed and unchanged at rest.
- Project a second bounded ordinary string, `editableAddressValue`, from the
  Firefox navigation bridge. For a valid committed native Urlbar state it is
  `gURLBar.untrimmedValue`; for an invalid proxy state it falls back to the
  selected browser URI; hidden initial/home/private locations remain empty.
- Initialize a newly opened address-panel draft from
  `editableAddressValue`. Existing refocus behavior must not overwrite an
  in-progress draft.
- Continue to submit through the current native `gURLBar.value` plus
  `handleCommand()` route. Do not reconstruct schemes, call `loadURI`, or add a
  second URL parser.

### Row and Column padding

- Add a closed container padding value: `none` (default) or `standard`.
- Persist only non-default `standard` padding in the existing bounded version-2
  layout tree. Old layouts remain valid; unknown keys or values remain invalid.
- Expose one labelled Content padding selector in the existing session-wide
  widget inspector whenever a Row or Column is selected.
- Render `standard` with `padding: var(--fennevia-space-2)`. Keep the existing
  Padding wrapper available for compositions where padding itself should remain
  a distinct structural node.
- Do not add custom pixel input, another inspector, another layout owner, or a
  customize-only geometry change.

### Launcher spacing follow-up

Historical note: ADR-084 later supersedes only the inline-margin part of this
follow-up after the owner selected a `standard`-padded Address Row as the
default. That parent now owns the 8 CSS px horizontal alignment with Tabs, so
the launcher uses zero inline margin and keeps the non-Top 4 CSS px block
margin described here. The centered address panel remains unchanged.

- Give only `.fennevia-layout-address` fixed inline and block margins using
  `--fennevia-space-1`; do not change any address-panel selector.
- Subtract the matching two-sided space from the launcher's maximum inline size
  so constrained and Expanded placements do not overflow their owner.
- On Top, suppress only the additional block margin and retain the root's
  existing 4–8 px block inset so compact 48/52 px lanes do not gain vertical
  overflow. Left, Right, and Bottom keep the full 4 px block margin.

### Narrow Top scrollbar follow-up

- In the existing 560 CSS px narrow tier, subtract only a 12 CSS px
  (`--fennevia-space-3`) block-end strip from Firefox's native window-drag
  region. Keep it pointer-transparent so the underlying native scrollbar owns
  thumb and track input.
- Preserve the panel, composable root, nested containers/wrappers, Space,
  Separator, and Flexible space drag declarations outside that strip.
- Do not hide the scrollbar, disable scrolling, forward pointer input, add an
  observer, or create another window-drag controller.

## 4. Implementation checklist

### A. Native address value boundary

- [x] Validate and document `window.gURLBar.untrimmedValue` as a required
      Firefox 153/154 navigation capability.
- [x] Add bounded `editableAddressValue` snapshot copying and equality.
- [x] Preserve trimmed launcher rendering and initialize only a fresh popup
      draft from the editable value.
- [x] Cover valid committed, invalid proxy, hidden location, bounding, and
      refocus-with-existing-draft behavior.

### B. Container padding model and UI

- [x] Add closed persisted and projected container-padding contracts.
- [x] Validate, serialize, copy, mutate, publish, and revision-guard the new
      `set-container-padding` edit.
- [x] Add the Row/Column inspector field with English and Traditional Chinese
      labels and a polite success announcement.
- [x] Apply the existing spacing token in normal rendering and keep customize
      boundaries paint-only.
- [x] Cover default omission, round trip, invalid values/targets, bridge
      projection/editing, frontend wiring, and CSS.

### C. Launcher spacing follow-up

- [x] Add tokenized inline and non-Top block breathing room only to the
      composable URL launcher.
- [x] Preserve bounded inline sizing and leave the centered URL panel unchanged.
- [x] Add a static frontend regression for the token, Top exception, and
      constrained width.

### D. Narrow Top scrollbar follow-up

- [x] Confirm Firefox's drag-minus-no-drag region algorithm on all three tested
      Firefox release tags and check the four current compatibility canaries.
- [x] Add a pointer-transparent narrow Top block-end no-drag guard without
      changing the remaining drag declarations.
- [x] Add a static regression for guard size, pointer transparency, no-drag
      semantics, and retained ordinary drag declarations.

### E. Documentation and verification

- [x] Record Firefox 153/154 source evidence without rewriting historical
      research records.
- [x] Add ADR-082/ADR-083 and update current architecture, Firefox internals,
      security, testing, roadmap, and status documentation where affected.
- [x] Rebuild deterministic generated artifacts.
- [x] Run focused tests while iterating, then `npm run verify` and the Windows
      PowerShell 5.1 fixed-list static suite when available.
- [x] Record real Firefox visual and interaction checks as `not run` unless they
      are actually performed.

## 5. Verification result

- The focused navigation, popup, layout, toolbar, and frontend run passed 92/92.
- The launcher-spacing and narrow Top scrollbar frontend regression passed
  10/10.
- `npm run verify` passed under the existing nvm-managed Node 24.18.0 and npm
  11.16.0: 433/433 Node tests, 88.66% line coverage, 81.29% branch coverage,
  95.71% function coverage, every fixed PowerShell 7 suite, dependency audit,
  deterministic frontend/bridge output, and 14/14 accepted production
  artifacts.
- The complete fixed-list static suite also passed under Windows PowerShell
  5.1. Both launcher-spacing follow-ups and the scrollbar guard reran the
  complete gates with unchanged pass counts.
- Real Firefox launcher/popup selection and spacing, container alignment,
  narrow Top scrollbar and adjacent window dragging, responsive and
  accessibility environments, multiple/private windows, and Browser Console
  checks remain `not run`.

### Release integration follow-up (2026-08-28)

The `0.18.0-beta.1` Firefox 154.0.1 candidate exposed one integration boundary
that focused mocks had not represented: assigning an untrimmed draft through
Firefox's `gURLBar.value` setter can normalize the native value, while an
explicit `startQuery({ searchString })` must be a prefix of that current value.
The suggestion bridge now reads back the normalized native value for query and
selection state while the project-owned editor keeps its full draft. A focused
regression reproduces native trimming. The clean full lifecycle, Browser
Toolbox ownership run, provider/suggestion probes, second/private windows,
frontend and bridge fail-open matrices, and SessionStore rehearsal passed on
Firefox 154.0.1. The complete gate passed with 435/435 Node tests, 88.71% line,
81.37% branch, and 95.79% function coverage, all fixed PowerShell 7 and Windows
PowerShell 5.1 suites, deterministic artifacts, dependency review, and the
14/14 production scan. Remaining package, performance, and publication evidence
stays in the release validation record.

## 6. Out of scope

- Showing a scheme permanently in the compact launcher.
- Reimplementing Firefox URL trimming, fixup, search, or result ranking.
- Free-form per-container padding, margin, gap, alignment, or size controls.
- Adding another margin to the centered URL panel.
- Removing the existing Center, Expanded, or Padding wrappers.
- A new layout schema version, legacy-Firefox compatibility branch, or support
  expansion beyond the current Firefox 153/154 prerelease boundary.
