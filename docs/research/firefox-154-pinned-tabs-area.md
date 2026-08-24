# Firefox 154 pinned-tabs area research

## Environment

- Date: 2026-08-24
- Firefox version: 154.0 release source target
- Validated project runtime baseline: Firefox 154.0, Build ID
  `20260812182057`, Windows 11 x64
- Profile state for this follow-up: official-source review and focused local
  automation; clean-profile Browser Console, Browser Toolbox, and assistive-
  technology runs: **not run**
- Project base commit: `b48dc94`
- Working branch: `codex/feat-pinned-tabs-area`
- Official Firefox release commit:
  [`032a9fc1ac0cc3209f7c142744ba2e40847c8086`](https://github.com/mozilla-firefox/firefox/commit/032a9fc1ac0cc3209f7c142744ba2e40847c8086)

## Request and first causal evidence

The owner requested a Firefox-like pinned-tabs area. There was no privileged
runtime exception. The first causal mismatch was project-owned presentation:
Fennevia rendered pinned and regular snapshots as one flat vertical scroller,
so regular-tab overflow could scroll pinned tabs out of view. Pin state, native
order, bridge actions, keyboard access, and pinned-boundary move logic already
worked and did not require a new privileged contract.

Firefox 154's
[`navigator-toolbox.inc.xhtml`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/base/content/navigator-toolbox.inc.xhtml)
places `#pinned-tabs-container` and `#vertical-pinned-tabs-splitter` before the
regular `#tabbrowser-arrowscrollbox`. Its
[`tabs.css`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/themes/shared/tabbrowser/tabs.css)
hides the pinned container when empty and gives it independent bounded layout;
expanded native vertical tabs use a compact icon grid. Mozilla Support likewise
describes [pinned tabs as compact tabs kept available separately from ordinary
tab use](https://support.mozilla.org/en-US/kb/pinned-tabs-keep-favorite-websites-open).

Those sources establish the separate-area behavior, not a reusable visual
template. Fennevia owns XHTML rows inside its own surface and does not inspect
or modify Firefox's pinned container, splitter, arrowscrollbox, native tab DOM,
CSS classes, grid, dimensions, or drag implementation.

## Compatibility canaries

Current heads were checked on 2026-08-24:

- Alice0775/userChrome.js
  [`a39f5cb60d40d01a1ae6d65935db152e7ac23111`](https://github.com/alice0775/userChrome.js/commit/a39f5cb60d40d01a1ae6d65935db152e7ac23111)
- MrOtherGuy/fx-autoconfig
  [`dfdab5684faffc112b76ccb1d8cab7f75da0102c`](https://github.com/MrOtherGuy/fx-autoconfig/commit/dfdab5684faffc112b76ccb1d8cab7f75da0102c)
- xiaoxiaoflood/firefox-scripts
  [`a898ac59fb0ca3886c0c46b184fdbc037c83c037`](https://github.com/xiaoxiaoflood/firefox-scripts/commit/a898ac59fb0ca3886c0c46b184fdbc037c83c037)
- aminomancer/uc.css.js
  [`88514013ddc375f4770f4a35d8d07a91d6dd7d8f`](https://github.com/aminomancer/uc.css.js/commit/88514013ddc375f4770f4a35d8d07a91d6dd7d8f)

Repository searches found no `pinned-tabs-container` adaptation in those four
heads. No canary code, selector, timer, global flag, loader behavior, or visual
composition was copied. `yutinglia/my-firefox-custom` was not consulted.

## Options considered

1. Keep one flat scroller and add a pinned border accent. Rejected because the
   pinned rows still disappear with regular overflow.
2. Make pinned rows sticky inside that scroller. Rejected because sticky rows
   still share overflow and scrollbar geometry with ordinary rows, complicate
   several pinned items, and couple drag midpoints to one scroll owner.
3. Copy Firefox's icon-only auto-fit grid. Rejected because Fennevia's direct
   title, unpin, mute, close, status, and focus paths would become hidden or
   menu-dependent, and copying native composition is unnecessary.
4. Use two bounded project-owned partitions inside the existing tablist.
   Selected as the minimum change that keeps pins available while preserving
   every current bridge and interaction owner.

## Independent Fennevia design

- Ordered snapshots are mapped once to keyed `{ tab, index }` entries, then
  filtered into pinned and regular presentation collections. The original
  native index remains the action, accessible-position, and drag index.
- The pinned section is absent when empty. When present, it has a visible
  localized heading and count, a labelled group, its own scrollbar, and a
  divider before regular tabs.
- The cap `min(34vh, 190px)` is project-selected: 34 viewport-height percent
  follows the existing bounded-panel convention, while 190 CSS pixels fits a
  heading and roughly four current 38-pixel rows without consuming the regular
  region. It is not copied from Firefox or an external customization.
- Regular tabs fill the remaining list height and scroll independently. Both
  partitions reserve a stable scrollbar gutter so pin/unpin or new overflow
  does not change row width. New Tab remains outside both partitions.
- Rows stay full-width and keep their direct sibling controls. Pin/unpin moves
  the same keyed row across partitions after Firefox publishes the new order;
  the existing `tick()`-gated focus lookup follows it and scrolls only its new
  partition.
- One outer `tablist` retains vertical roving navigation across both
  collections. The pinned group label includes its count, and the visual count
  is hidden from duplicate accessibility output. Existing visible-focus,
  forced-colors, reduced-motion, keyboard reorder, and `Escape` paths remain.
- Drag geometry captures pinned and regular scroll offsets independently.
  Midpoint hit testing and marker/source transforms compensate only the
  dragged partition while existing pure helpers continue to clamp every move
  to pinned state. Cross-window content append selects the correct partition
  end. When the first incoming pinned tab temporarily mounts an otherwise
  absent section, one `tick()`-gated recapture waits for that owned layout;
  drag-ID cleanup makes a late callback inert. The OS payload and coordinator
  contract are unchanged.

The local UI/UX design review reinforced visible section labelling, stable
focus, keyboard continuity, and independent bounded overflow. It did not
replace the established Fennevia tokens, type scale, row composition, or
motion/accessibility policies.

## Security, privacy, ownership, and provenance

The layout consumes only the existing ordered tab snapshots and `pinned`
boolean. The displayed count is local integer presentation. Scroll offsets and
DOM bounds remain ephemeral component geometry and are cleared with existing
drag cleanup. No URL, additional title copy, favicon value, native handle,
Firefox DOM node, preference, persistence, log field, diagnostic value,
telemetry, clipboard value, network request, content-accessible mapping,
dependency, surface, edge trigger, timer, or process-global state is added.

No external code or asset was copied or adapted. Official Firefox source is
MPL-licensed behavioral evidence only, so the shipped dependency graph and
`THIRD_PARTY_NOTICES.md` remain unchanged.

## Validation

Completed locally on 2026-08-24:

- baseline focused tests (`node --test ./tests/tab-strip.test.mjs
  ./tests/frontend-build.test.mjs`): **passed**, 17/17 tests before the change;
- `npm run typecheck`: **passed**, 0 errors and 0 warnings after the component
  change;
- updated focused tests (`node --test ./tests/tab-strip.test.mjs
  ./tests/frontend-build.test.mjs`): **passed**, 17/17 tests;
- `npm run verify`: **passed** with formatting, lint, typecheck, 373/373 Node
  tests, 87.50% line coverage, 79.85% branch coverage, 95.39% function
  coverage, every fixed PowerShell 7 suite, dependency audit, deterministic
  frontend/bridge builds, and 14/14 accepted production artifacts;
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File
.\tests\run-static-powershell-tests.ps1`: **passed** every fixed-list suite
  under Windows PowerShell 5.1.

Real Firefox 153.0.4/154.0 zero/one/many pinned tabs, independent overflow,
pin/unpin focus transfer, selected pinned visibility, same-/cross-window drag,
short/narrow/maximized windows, normal/second/private isolation, light/dark,
reduced motion, forced colors, high DPI, fail-open, Browser Console/Toolbox,
screen reader, and disposal-during-drag rows are **not run**, not passed.
