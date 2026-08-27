# Current Project Status

> Snapshot: 2026-08-28. This status review includes ADR-074 through ADR-084 and
> the `0.18.0-beta.1` version identity, alongside the public
> `v0.18.0-beta.1` prerelease.
> Historical research records and milestone ADR context remain unchanged.

This page is the short, current answer to “how far along is Fennevia?” The root
READMEs remain user-facing, while the master plan, shell roadmap, architecture,
and testing documents retain the complete engineering contract.

## At a glance

| Area                            | Current state                                                                                                                                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public release                  | `v0.18.0-beta.1`, Windows x64 prerelease                                                                                                                                                                                                                                                               |
| Tested Firefox                  | Stock Firefox 153.0.4 BuildID `20260810162159`, 154.0 BuildID `20260812182057`, and 154.0.1 BuildID `20260824154132`, release channel                                                                                                                                                                  |
| Installer compatibility gate    | Firefox 153 and newer after an explicit warning; only 153 and 154 are tested                                                                                                                                                                                                                           |
| Core four-edge MVP              | Implemented and released                                                                                                                                                                                                                                                                               |
| Post-MVP shell work             | Included through `v0.18.0-beta.1` with focused automated coverage, including ADR-064 panel roles/favicons, compact windows, tabbed customize, tab-panel hold, related New Tab, Firefox-owned tab multi-select, ADR-073 pinned-tab partitioning, and ADR-074 through ADR-084's widget, address, layout, narrow-window, drag, and customize work |
| Latest released follow-up       | ADR-082 restores Firefox's bounded untrimmed value for a fresh address edit and adds optional Row/Column content padding; ADR-083 keeps narrow Top scrollbars draggable; the ADR-076 follow-up makes the inspector yield during widget drags; ADR-084 adopts the owner's default and blocks/darkens website content during customization |
| Current source follow-up        | No additional unversioned feature work is recorded after the `v0.18.0-beta.1` candidate at this snapshot                                                                                                                                                                                               |
| Latest widget-system follow-up  | ADR-074 composes every edge from bounded recursive widgets; ADR-075 adds projected dragging, palette discovery, and closed per-instance variants; ADR-076 moves controls into one floating inspector; ADR-077 adds configurable panel dodge and correct horizontal feature sizing; ADR-078 adds a feature-first paired palette and optional layout Guide; ADR-080 adds retained-floor and ultra-compact four-panel reflow; the automated Firefox 154.0.1 release matrix passed while manual visual rows remain pending |
| Native Urlbar result projection | Included since `v0.12.0-beta.1`; the `0.17.0-beta.1` Firefox 154.0.1 provider-contract, production-panel, and failure-injection probes passed; the literal fresh-profile first-zero-prefix and representative-provider matrices remain pending                                                                        |
| Real-Firefox validation         | `v0.17.0-beta.1` passed the complete automated Firefox 154.0.1 lifecycle, recovery, performance-control, deterministic-archive, extracted-package, independently downloaded public-package, and recovery matrix. Several manual visual, assistive, account/device, and GUI installer rows remain pending                                                |
| Stability claim                 | Experimental prerelease; not a stable daily-driver or long-term-support promise                                                                                                                                                                                                                        |

## Implemented product surface

### Runtime, safety, and distribution

- Minimal project-owned AutoConfig and Chrome Registry bootstrap on stock
  Firefox, without a generic userscript loader or maintained Firefox fork.
- One process runtime with deterministic normal, additional-normal, and private
  window lifecycle.
- Health-gated activation, safe start, emergency native fallback, bounded
  failure records, deterministic disposal, and fail-open recovery.
- Ownership-checked install, update, repair, hard-disable, re-enable, rollback,
  and uninstall for explicit Firefox program/profile targets.
- Deterministic Windows release archive, checksum, exact manifests, annotated
  tag contract, and verify-before-publish workflow.
- `FenneviaSetup.exe` as the recommended release installer, with the PowerShell
  console and scripted package interface retained for advanced and development
  use.

### Four-edge shell

- Hidden-at-rest top, left, right, and bottom surfaces with a shared reveal,
  focus, popup-hold, collision, accessibility, and cleanup contract.
- Viewport-driven narrow geometry begins at 560 CSS px even with Firefox's
  ordinary minimum retained: Bottom gets a full-width lane, one visible side
  expands while leaving at least 104 CSS px of opposite-side client area, two
  visible sides split, and reserved modes keep enabled lanes stable. Only the
  360 CSS px tier permits a lone side to use the available width while
  tightening lane density for opt-in smaller windows, without changing saved
  layouts or panel-controller behavior.
- Vertical tabs in Left by default, but movable as a singleton and axis-aware,
  with a fixed, height-capped pinned area
  above an independently scrolling regular-tab area, selected state, Firefox's packaged loading icon,
  audio, containers, attention/PiP, closed camera/microphone/screen-sharing and crash
  indicators, fixed trailing action positions, middle-click close,
  middle-click/accel New Tab insertion after the current tab,
  Firefox-owned multi-select with Accel toggle, Shift range, group drag, and
  row close/mute/pin,
  drag/keyboard reorder with a pointer-aligned full-row ghost, animated neighbor
  gap, insertion marker, enlarged top/bottom magnetic landing zones, verified
  single/group native order, and polite move announcement, plus Firefox-owned tab
  context-menu handoff with complete lazy Fluent labels and no original-toolbar
  reveal.
- Compact address/status launcher in a standard-padded Row above Tabs on the
  configured tabs side by default, but independently movable as a singleton,
  with one adjacent Firefox-style Trust shield plus a
  centred address/search popup backed by Firefox
  navigation, bounded connection/protection state, and the native Trust/Urlbar
  owners. ADR-061 adds an accessible bounded result list fed by Firefox's own
  per-window Urlbar provider manager: ordinary rows execute through native
  `pickResult`, while rich/unknown rows retain the complete native-Urlbar
  handoff. Fennevia adds no search engine, provider, ranking, persistence, or
  suggestion endpoint.
- ADR-082 keeps that launcher on Firefox's compact committed value and uses its
  separately bounded untrimmed value only when a fresh popup enters editing;
  invalid proxy state and existing draft ownership remain conservative.
- Default-Top navigation, page status, Firefox tool handoffs, native-panel
  anchoring, packaged Firefox icons including the Settings gear, and project-
  owned window controls, all projected as placeable widgets. The 2026-08-25
  adaptive-popup follow-up resolves each edge-facing direction and client-half
  alignment before Firefox opens all seven widget panels; accepted project
  anchors receive no second visible move, while owner-rejected anchors retain
  one measured compatibility fallback. Top and Bottom
  retain independently configurable loading/download/off gutter indicators,
  and Firefox's native corner status keeps its compact active-only capsule.
- Generic relationship-based anchoring for non-security Firefox-owned XUL
  popups opened from the hidden toolbox; unsupported movement remains
  fail-open to original Firefox chrome. ADR-057 pre-anchors the shared security
  notification panel before first open, keeps it fully Firefox-owned without a
  post-show move or unnecessary original-chrome reveal, and retains native
  reveal if routing is unavailable so marketplace installation and other
  prompts preserve Firefox timing. The owner-observed Firefox 154 AMO path
  currently uses that accepted complete-native-chrome fallback. It also adds a
  placeable widget for the Firefox-owned full-page translation panel; the
  2026-08-22 follow-up keeps its routing active until Firefox's asynchronously
  created panel is actually shown.
- Lazy, event-driven Bookmarks in Right by default, including Firefox-cached
  bounded raster favicons and middle-click new-tab opening, plus anonymous
  Downloads status in Bottom by default while Firefox retains authoritative
  editing, safety, and file management. Both are movable singleton widgets;
  Left, Right, and Bottom are independently enabled while Top is mandatory.
- Useful pointer/keyboard right-click menus on all four edge panels: top
  Settings, configured tabs-side New Tab/native tab actions, configured
  bookmarks-side bookmark/folder/Library
  actions, bottom Firefox Downloads, plus available Fennevia/native customize
  and original-toolbar actions. The 2026-08-22 owner-reported follow-up fixes
  delegated tab-event interception and explicitly releases pointer-menu focus
  so edge auto-hide can resume after explicit dismissal; pointer exit alone
  retains the menu and its working panel like Firefox's native context menu.
- Complete native Firefox reveal paths for unsupported, security-sensitive, or
  recovery-only operations.

### Customization and presentation

- Fennevia-owned customize mode with the current `CustomizableUI` inventory and
  project browser/feature/window controls in one strict recursive version-2
  layout contract.
- Live drag-and-drop plus keyboard/button placement across all four edge roots,
  with nested Row/Column containers and nearest-container horizontal/vertical
  feature semantics.
- Localized widget names, Firefox-native built-in icons, and always-repeatable
  Row, Column, Center, Expanded, Padding, Separator, Space, and Flexible-space
  structure. Ordinary children retain natural size/start order; Expanded is the
  explicit remaining-space wrapper.
- Selected Row/Column nodes can optionally apply one standard content-padding
  preset through the existing floating inspector. It reuses the shared spacing
  token, persists only the non-default value, and does not accept arbitrary
  pixels or CSS.
- Fixed panel base flows (Top/Bottom Row, Left/Right Column) suppress redundant
  outer-container chrome, while empty roots retain a full drop hitbox behind a
  compact centered prompt.
- Fresh/reset/fallback state uses ADR-084's explicit native-v2 tree:
  navigation, Trust, an empty Expanded region, handoffs, Customize, private
  indicator, and window controls in Top; a standard-padded site-status Address
  Row, expanded Tabs with integrated New Tab, and a Separator on the configured
  tabs side; expanded Bookmarks opposite; and centered Downloads status in
  Bottom. Profile-specific native
  toolbar entries remain palette choices instead of destabilizing the default.
- Opt-in compatible duplicate placements—including window controls in Top and
  Left—while stateful features remain singleton and at least one Customize
  widget remains on an enabled edge.
- Independent Left/Right/Bottom enablement with no Top toggle. Enabled empty
  optional panels are hidden ordinarily but reappear as labelled customize
  drop/keyboard-add targets.
- One four-choice panel reveal/clearance setting: single or multiple visible
  edges combined with dynamic or reserved adjacent-edge lanes. Existing
  profiles retain multiple/dynamic behavior; either single mode still permits
  the bounded new-tab Tabs highlight, and Firefox-owned popup holds remain
  authoritative.
- Confirmed Clean all restores adopted Firefox widgets, empties every root,
  preserves unrelated settings, and leaves one Top Customize; Reset layout
  remains separate.
- Drag outlines clear after actual edge exit and every terminal path. One
  explicitly selected node keeps its boundary until another selection or
  Escape; its move/containment/axis/remove and eligible Style controls appear
  in one Top-root floating inspector that stays outside Row/Column sizing,
  avoids the central drawer when space permits, and cannot be covered by an
  edge-panel stacking context. While a widget is dragged, that mounted
  inspector fades and stops intercepting pointer hit testing, then returns from
  the shared terminal drag signal without clearing selection. Dragging
  subdues the source, inserts one exact axis-aware preview at the accepted
  nested index, and autoscrolls near a panel edge without retaining work after
  the drag.
- Customize mode mounts one non-focusable 48% dark backdrop below every project
  panel. It intercepts page-only pointer and wheel targeting so website content
  is quieter and cannot be clicked accidentally, without marking Firefox
  content inert, mutating native DOM, or adding another host or input owner.
- The widget palette has localized search,
  All/Main features/Fennevia/Firefox/Layout filters, result count, selected
  destination feedback, and both click/keyboard and precise drag placement.
  Address/Trust, Tabs/New Tab, Bookmarks/Show Bookmarks, and Download
  status/Show Downloads appear first as adjacent primary/companion pairs when
  both are available. Incomplete search or placement groups reflow without
  blank columns or unrelated tiles appearing as companions.
- An optional Guide tab explains fixed edge directions, Row/Column,
  Center/Expanded/Padding wrappers, structural spacing widgets, practical
  recipes, editor actions, and recovery in English and Traditional Chinese.
- Closing customize mode through its button, `Escape`, or an environment change
  uses the shared surface dismiss/focus-origin path. It does not reveal or
  refocus Customize afterward, so the Top focus hold clears without requiring a
  click in web content and an already-focused native dialog is not displaced.
- Eligible placed widgets have bounded per-instance variants rather than
  arbitrary CSS: Address can be address-only or include the existing native-
  owner Trust action in one capsule; Tabs can be tabs-only or include the
  existing trailing New Tab action. Standalone Trust and New Tab remain
  available.
- Tabs, Bookmarks, and Downloads status share one bounded axis-aware feature
  root. Horizontal Tabs now keeps its summary and integrated New Tab action
  intrinsic while its partitions shrink/scroll; vertical behavior and the
  other large widgets retain bounded overflow.
- Ordinary unoccupied project chrome—including structural space and empty
  containers/gaps—uses the shared Firefox-window drag path; customize mode is
  explicitly no-drag.
- Bounded profile-local appearance and interaction controls for panel/window
  backgrounds, text, borders, saturation, shadow, motion, separate
  in-window/window-leave hide timing, temporary reveal timing, zero-disable
  shortcut-tip timing, and edge trigger thickness.
- Bounded profile-local panel controls for independent Left/Right/Bottom
  enablement, four closed reveal/clearance modes, and top/bottom activity-light
  sources; Top remains enabled.
- Firefox chrome design tokens as the default color source, with solid,
  reduced-transparency, reduced-motion, and forced-colors fallbacks.
- English and Traditional Chinese shell catalogs selected from Firefox's UI
  locale. Until a Simplified Chinese catalog exists, every `zh-*` locale maps
  to Traditional Chinese.
- A self-expiring, fail-open first-paint stylesheet intended to prevent the
  original Firefox toolbox flashing before healthy activation.

## Validation status

The `v0.12.0-beta.1` release candidate records successful
`git diff --check`, `npm run format:check`, and `npm run verify`. The verify gate
covers linting, type checking, coverage floors, PowerShell static suites,
dependency review, deterministic builds, and production-artifact checks.
The 2026-08-22 ADR-060 native-shell-icon follow-up also passed the complete
`npm run verify` gate with 296 Node tests, 87.60% line coverage, 95.33%
function coverage, deterministic generated output, and all 14 production
artifacts accepted.

The ADR-061 Urlbar-provider follow-up passed the complete `npm run verify` gate
with 316 Node tests, 87.45% line coverage, 95.10% function coverage, all fixed
PowerShell 7 suites, deterministic generated output, dependency review, and all
14 production artifacts accepted. The same fixed PowerShell list also passed
under Windows PowerShell 5.1. Its latest installed Firefox 154 focused probes
passed after one real incremental-result selection race was found and fixed;
the broader rows below remain pending.

The ADR-062 tab-drag spatial-preview follow-up passed the complete
`npm run verify` gate with 318 Node tests, 87.49% line coverage, 95.11%
function coverage, all fixed PowerShell 7 suites, deterministic frontend and
bridge output, dependency review, and all 14 production artifacts accepted.
The same fixed PowerShell list passed under Windows PowerShell 5.1. Its real
Firefox visual and assistive-technology rows remain pending.

ADR-063 implements the owner-requested cross-window/content/external-drop
terminal behavior with a marker-only transferable payload, one ephemeral
same-kind privileged coordinator, native `adoptTab`/`replaceTabWithWindow`, and
capture-level plus source-snapshot left-hold cleanup. The target preview
reserves one real row so a
short list grows without a transform-induced scrollbar, overlays a visible
generic tab row at the accepted position, and clears both after a no-drop
target-window exit; source snapshot reconciliation also releases the original
window's pointer hold if adoption removes its tab before source `dragend` is
observed, then conditionally releases stale focus/keyboard holds after the DOM
update without confusing an in-window reorder or intentional remaining focus.
Tab drag retains Firefox's ordinary cursor. The latest
complete `npm run verify` gate passed
with 331/331 Node tests, 87.27% line coverage, 79.19% branch coverage, 95.23%
function coverage, all fixed PowerShell 7 suites, dependency review,
deterministic frontend/bridge output, and 14/14 accepted production artifacts.
The same fixed suite passed under Windows PowerShell 5.1. The real Firefox
multi-window and external-application rows remain pending.

ADR-064 implements bounded side-role swapping, optional bottom-download-panel
presentation, configurable top/bottom activity lights, cached raster bookmark
favicons, bookmark middle-click new-tab behavior, and the retained native status
capsule. Its complete `npm run verify` gate passed with 351/351 Node tests,
87.51% line coverage, 79.58% branch coverage, 95.30% function coverage, all
fixed PowerShell 7 suites, dependency review, deterministic frontend/bridge
output, and 14/14 accepted production artifacts. The same fixed suite passed
under Windows PowerShell 5.1. The ADR-064 real-Firefox visual, interaction,
multi-window, DPI, theme, and accessibility rows below remain pending.

ADR-072 and ADR-073 each passed the complete `npm run verify` gate with 373/373
Node tests, at least 87.49% line coverage and 95.39% function coverage, every
fixed PowerShell 7 suite, dependency audit, deterministic builds, and 14/14
accepted production artifacts. The fixed suite also passed under Windows
PowerShell 5.1. The later browser-tools responsibility split passed its final
gate with 374/374 Node tests and unchanged public behavior. The side-panel
layout correction then passed `npm run verify` and a Firefox 154 headless layout
probe. These are pre-release-commit results from the included changes. The
`0.16.0-beta.1` release retains those results without relabelling them as a
complete current package matrix.

The ADR-074 implementation passed the complete
`npm run verify` gate on 2026-08-25 with 395/395 Node tests, 87.92% line
coverage, 80.29% branch coverage, 95.37% function coverage, every fixed
PowerShell 7 suite, dependency audit, deterministic frontend/bridge rebuilds,
and 14/14 accepted production artifacts. This is ordinary automated evidence;
the ADR-074 real-Firefox visual, input, accessibility, multi-window, private-
window, caption, popup, and recovery rows remain `not run`.

The ADR-075 implementation passed the complete `npm run verify` gate on
2026-08-25 with 406/406 Node tests, 88.19% line coverage, 80.52% branch
coverage, 95.47% function coverage, every fixed PowerShell 7 suite, dependency
audit, deterministic frontend/bridge rebuilds, and 14/14 accepted production
artifacts. Its drag-preview, palette, selection, per-instance style, native
Trust/New Tab placement, accessibility, and multi-window real-Firefox rows
remain `not run`.

The ADR-076 implementation passed the complete `npm run verify` gate on
2026-08-25 with 411/411 Node tests, 88.22% line coverage, 80.56% branch
coverage, 95.48% function coverage, every fixed PowerShell 7 suite, dependency
audit, deterministic frontend/bridge rebuilds, and 14/14 accepted production
artifacts. The same gate covers the follow-up that keeps explicit inspector
dismissal closed, restores focus through a non-selecting outer node anchor, and
paints persistent customize boundaries without changing widget measurements.
Its positioning, zoom, focus, accessibility, multi-window, and private-window
real-Firefox rows remain `not run`.

ADR-077 and the `0.16.0-beta.1` release preparation passed `npm run verify` on
2026-08-25 with 420/420 Node tests, 88.36% line coverage, 80.78% branch
coverage, 95.61% function coverage, every fixed PowerShell 7 suite, dependency
audit, deterministic frontend/bridge rebuilds, and 14/14 accepted production
artifacts. The complete fixed-list suite also passed under Windows PowerShell
5.1, including deterministic release packaging, registered-profile release
install, compatibility warning, survivor recovery/uninstall, repair, tamper,
and release-workflow checks. ADR-077's real-Firefox panel-mode, layout, popup,
accessibility, multi-window, private-window, and recovery rows remain `not run`.

ADR-078 and the screenshot-driven incomplete-pair layout correction passed
`npm run verify` on 2026-08-26 with 421/421 Node tests, 88.47% line coverage,
80.85% branch coverage, 95.62% function coverage, every fixed PowerShell 7
suite, dependency audit, deterministic frontend/bridge rebuilds, and 14/14
accepted production artifacts. Its real-Firefox palette layout, text scaling,
keyboard, forced-colors, assistive-technology, multi-window, private-window,
and recovery rows remain `not run`.

ADR-080's retained-corridor/ultra-compact panel source passed `npm run verify`
on 2026-08-26 with 425/425 Node tests, 88.44% line coverage, 80.87% branch
coverage, 95.62% function coverage, every fixed PowerShell 7 suite, dependency
audit, deterministic frontend/bridge rebuilds, and 14/14 accepted production
artifacts. The complete fixed-list suite also passed under Windows PowerShell
5.1. Its Firefox 153/154 retained-floor and `allowCompactWindow` visual, pointer
auto-hide, keyboard, panel-mode, customize, accessibility, multiple/private
window, and recovery rows remain `not run`.

ADR-079's search-first popup and bounded first-empty zero-prefix retry passed
`npm run verify` with 424/424 Node tests. Its current first-open Firefox 154.0.1
ordering and complete representative-provider rows remain part of the release
matrix rather than being inferred from focused automation.

ADR-081's detach-intent and child-drag ownership correction passed
`npm run verify` with 428/428 Node tests and the Windows PowerShell 5.1 fixed
list. The owner confirmed ordinary same-tabbar reorder, intentional external
detach, and cross-window transfer on Firefox 154.0.1; private-window and full
Browser Console rows remain pending. The subsequent Fluent-first built-in
label correction passed `npm run verify` with 429/429 Node tests and the same
PowerShell 5.1 gate.

ADR-082's address-editing value and Row/Column content-padding implementation
passed `npm run verify` on 2026-08-27 with 433/433 Node tests, 88.66% line
coverage, 81.29% branch coverage, 95.71% function coverage, every fixed
PowerShell 7 suite, dependency audit, deterministic frontend/bridge output,
and 14/14 accepted production artifacts. The complete fixed-list suite also
passed under Windows PowerShell 5.1. Its real-Firefox editing, alignment,
responsive/accessibility, multiple/private-window, and Browser Console rows
remain `not run`.

The first same-day tokenized launcher-spacing follow-up reran the complete
verify and Windows PowerShell 5.1 gates with unchanged pass counts. The later
vertical-spacing and ADR-083 narrow Top scrollbar follow-up passed its focused
10/10 frontend source regression and reran both complete gates with the same
433/433 and 14/14 pass counts. The centered address panel is unchanged.

ADR-084's owner-default, duplicate-inline-inset correction, and customize
backdrop then passed the 53/53 focused layout/toolbar/frontend run and the
complete `npm run verify` gate with 433/433 Node tests, 88.71% line coverage,
81.37% branch coverage, 95.79% function coverage, every fixed PowerShell 7
suite, dependency audit, deterministic frontend/bridge output, and 14/14
accepted production artifacts. The complete Windows PowerShell 5.1 fixed-list
suite also passed. The bilingual README's generated hero and six corrected
owner captures passed seven-link, SHA-256, and dimension checks. Real Firefox
layout, backdrop, pointer/wheel, focus, narrow-scroll/window-drag,
forced-color, multi/private-window, disposal, and Browser Console rows remain
`not run`.

The `0.18.0-beta.1` Firefox 154.0.1 release-integration follow-up corrected the
Urlbar suggestion query's normalized-value boundary and restored Application
Menu popup semantics. Its complete `npm run verify` gate passed with 435/435
Node tests, 88.71% line coverage, 81.37% branch coverage, 95.79% function
coverage, every fixed PowerShell 7 suite, dependency audit, deterministic
frontend/bridge output, and 14/14 accepted production artifacts. The complete
Windows PowerShell 5.1 fixed list also passed. A clean full lifecycle,
Browser Toolbox ownership, provider/suggestion probes, fail-open matrices, and
SessionStore rehearsal passed on the isolated Firefox 154.0.1 candidate
profile; package, performance, and publication evidence remains in the current
release validation record until completed.

The `0.12.0-beta.1` release-candidate pass on 2026-08-23 additionally covered
the complete automated Firefox 154 lifecycle, Browser Toolbox, safe-start and
failure-injection wrappers, SessionStore rehearsal, Urlbar provider/production
panel probes, three enabled performance samples with a three-run hard-disabled
control, deterministic dual-archive preflight, Unicode-path extraction, and the
extracted package's update/disable/recovery/uninstall/stock-start/install
lifecycle. See
[`docs/research/firefox-154-0.12.0-beta.1-release-validation.md`](research/firefox-154-0.12.0-beta.1-release-validation.md).
The `0.17.0-beta.1` release reran that complete automated matrix on Firefox
154.0.1, including Browser Toolbox, failure injection, SessionStore, Urlbar,
performance controls, Unicode extraction, and the extracted-package lifecycle.
It does not convert the pending manual real-Firefox rows below into observed
evidence. See
[`docs/research/firefox-154-0.17.0-beta.1-release-validation.md`](research/firefox-154-0.17.0-beta.1-release-validation.md).

That automated evidence does **not** complete every real-browser claim. The
following remain explicitly pending in the current plans and testing document:

- ADR-037 single-line toolbar visual and interaction matrix;
- ADR-042 host-anchored Firefox popup placement;
- ADR-044 toolbar-widget mirror behavior in real Firefox;
- ADR-045, ADR-047, and ADR-054 customize-mode, live drag-and-drop, and bounded
  interaction-setting behavior;
- ADR-055 four-panel context-menu placement, native popup/Library ownership,
  label rendering, and normal/second/private-window interaction behavior;
- ADR-056/ADR-057 translation-widget placement, native AMO install/security
  notification timing, bookmark/page-action, and other hidden-toolbox popup
  behavior across normal/second/private windows and recovery cases;
- ADR-050 cold-start flash, watchdog expiry, and failure-skeleton behavior;
- ADR-058 tab loading/capture/crash indicators and fixed action placement under
  real WebRTC, crash, narrow-panel, reduced-motion, forced-color, DPI, and
  multi-window conditions;
- ADR-064 swapped-side focus/popup behavior, bottom disable/re-enable, cached
  bookmark favicon and middle-click behavior, all activity-light mappings, and
  native status-capsule theme/forced-colors/DPI behavior in real Firefox;
- ADR-069 auxiliary-pointer keep-current, related bookmark background restore,
  and top-navigation blur-after-activate behavior in real Firefox;
- ADR-070 related New Tab insertion after the current tab for middle-click and
  Accel-click, including Shift-background, in real Firefox;
- ADR-071 Firefox-owned tab multi-select, group drag/keyboard move, row
  close/mute/pin, and native context-menu plural actions in real Firefox;
- ADR-072 single/multi upward and downward drop placement, top/bottom magnetic
  targets, overflow interaction, native no-op rejection, and
  normal/second/private-window behavior in real Firefox;
- ADR-073 zero/one/many pinned tabs, independent pinned/regular overflow,
  pin/unpin focus transfer, same- and cross-window drag, constrained layouts,
  accessibility modes, multi-window isolation, fail-open, and disposal in real
  Firefox;
- ADR-074 recursive Row/Column composition, horizontal/vertical primary
  features, compatible duplicate placements, independent optional panels,
  initially empty customize targets, confirmed Clean all, contextual node
  controls, complete drag-outline cleanup, empty-space window dragging, popup/
  focus ownership, caption behavior, accessibility modes, multiple/private
  windows, fail-open, and disposal in real Firefox;
- ADR-075 pointer-relative drag images, exact projected nested insertion,
  autoscroll, selection/Escape priority, palette search/categories, live
  announcements, reduced-motion/forced-colors behavior, and Address/Tabs style
  switching with Firefox-owned Trust/New Tab actions in real Firefox;
- ADR-076 one-inspector cross-edge selection, central-drawer obstacle avoidance
  and fallback stacking, text/UI scaling, keyboard focus transfer/restoration,
  accessibility modes, multiple/private windows, and disposal in real Firefox;
- ADR-077/ADR-080 all four concurrency/clearance modes at retained Firefox
  minimum width and with `allowCompactWindow`, one/two/all-panel mosaics,
  full-width Bottom, compact Row overflow, customize-sheet fallback, keyboard
  and pointer access, 200% text, forced colors, multiple/private windows,
  popup holds, recovery, and disposal in real Firefox;
- ADR-078 paired feature palette, incomplete-group reflow, Guide layout,
  200% text, forced colors, keyboard, screen reader, and multiple/private
  windows in real Firefox;
- ADR-059 unified Trust-shield rendering/state, leading in-launcher placement,
  and native panel handoff across HTTP, HTTPS, ETP exception/restore, errors,
  forced colors, DPI, and multiple windows;
- ADR-060 packaged Firefox icon rendering and alignment across top controls,
  tabs, popups, bookmarks, downloads, customize UI, themes, reduced motion,
  forced colors, DPI, and multiple windows;
- ADR-061 representative Urlbar providers, Firefox search-suggestion setting
  combinations, Firefox 153, one-offs/rich rows, rapid replacement/close,
  pointer/assistive-technology behavior, second/private windows, Browser
  Toolbox ownership, failure injection, and release matrix;
- ADR-079 a fresh first-open zero-prefix query on Firefox 154.0.1, including
  genuine empty completion after the bounded retry and query replacement/
  cancellation during that path;
- ADR-062 full-row tab-drag ghost alignment, spatial gap behavior during rapid
  direction changes and overflow scrolling, reduced motion, forced colors,
  screen-reader announcements, multiple windows, and disposal during drag;
- ADR-063 target-strip insertion, target-content append, source-content and
  non-Firefox detach, visible target-row placement, no-drop target-window exit,
  Escape and sole-tab behavior, pinned partitions, overlapping windows,
  source and target left-edge auto-hide (including missing source `dragend`),
  normal/private rejection, source/target closure, and
  Browser Console/Toolbox ownership;
- ADR-081 private-window drag isolation and complete Browser Console evidence
  after same-tabbar reorder, intentional detach, and cross-window transfer;
- ADR-082 launcher-at-rest versus focused editing behavior, mouse/Ctrl+L
  selection, launcher spacing, Row/Column content alignment, responsive/
  accessibility modes, normal/second/private windows, and Browser Console
  evidence;
- ADR-083 narrow Top scrollbar thumb/track dragging, adjacent empty-space
  window dragging, normal/second/private windows, high-DPI/forced-colors, and
  Browser Console evidence;
- a complete recorded real double-click, UAC, and system-Firefox installation
  matrix for the WinForms release wizard.

Accordingly, `v0.18.0-beta.1` should be described as an implemented experimental
prerelease with validation debt, not as a stable product. The largest remaining
risk is Firefox-internal compatibility and real-environment coverage rather
than absence of the core shell.

## Important support boundaries

- Windows x64 only. Linux and macOS are not supported by the current package.
- Only stock Firefox release 153.0.4, 154.0, and 154.0.1 have recorded tested
  evidence.
  Newer Firefox may be installed after a no-promise warning and may break the
  shell.
- The project follows the latest stock Firefox stable release available during
  implementation. It does not promise to preserve compatibility with every
  historical Firefox version or maintain old-version branches.
- Firefox ESR, Beta, and Nightly are outside the current release claim.
- There is no automatic updater, code signing, build attestation, completed
  SBOM publication contract, or completed independent security audit.
- Fennevia relies on unsupported privileged Firefox internals that Mozilla may
  change without notice.
- Firefox remains the source of truth for certificates, permissions, security
  prompts, extension installation, download safety, DevTools, complete Urlbar
  behavior, and other sensitive native UI.

## Review conclusion and recommended priorities

Fennevia has moved beyond its initial four-edge MVP: the core shell, package
lifecycle, public prerelease path, four-edge widget editor, bounded theming,
localization, GUI setup wizard, and first-paint work are all present. It is not
blocked on a missing primary feature before further testing; it is blocked on
turning focused implementation evidence into a repeatable real-Firefox support
claim.

Recommended next priorities, as a review rather than a new accepted roadmap:

1. Complete and publish the pending Firefox 153/154 real-browser matrices,
   including cold start, popup anchoring, customize drag-and-drop, extensions,
   private windows, multi-window behavior, DPI, reduced motion, and recovery.
2. Run the same compatibility workflow against every new Firefox stable before
   describing it as tested; keep the 153+ installer warning separate from the
   tested-version list.
3. Record a full real Windows installer matrix covering ordinary user installs,
   protected Program Files, UAC continuation, update, disable, repair, and
   uninstall.
4. Add signing, provenance/attestation, and SBOM work only if broader public
   distribution becomes a near-term goal.
5. Defer wider platform support, additional locale catalogs, and broader product
   configurability until the compatibility and release-validation loop is
   routine.

## Sources of truth

- [Public README](../README.md)
- [Technical overview](technical-overview.md)
- [Master plan](../plans/000-master-plan.md)
- [Shell roadmap](../plans/002-shell-roadmap.md)
- [Architecture](architecture.md)
- [Architecture decisions](architecture-decisions.md)
- [Testing and recovery](testing-and-recovery.md)
- [Installation and package lifecycle](installation.md)
- [Firefox update workflow](firefox-update-workflow.md)

Milestone-specific evidence under [`docs/research/`](research/) is historical.
Do not rewrite it to imply that later features or validation existed at the
original milestone.
