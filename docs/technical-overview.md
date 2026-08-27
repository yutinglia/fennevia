# Fennevia Technical Overview

This document contains the engineering-level material intentionally removed from
the public README. For installation and ordinary use, start with the
[English README](../README.md) or [繁體中文 README](../README.zh-Hant.md). For a
short reviewed progress snapshot, see [Current project status](current-status.md).

## Current engineering status

As of 2026-08-28, Fennevia has a published Windows x64 prerelease,
`v0.18.0-beta.1`, tested on stock Firefox 153.0.4 release, Build ID
`20260810162159`, Firefox 154.0 Build ID `20260812182057`, and Firefox 154.0.1
Build ID `20260824154132`. The installer accepts Firefox 153 and newer after
an explicit warning that later versions may break with no working promise;
see ADR-048 and `docs/research/firefox-154-stable-transition.md`.

The tested MVP and current post-MVP implementation include:

| Area                                                                          | Status                                                                                                                         | Current result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bootstrap and package lifecycle                                               | Complete                                                                                                                       | Fixed AutoConfig/Chrome Registry startup plus ownership-checked install, update, disable, enable, repair, rollback, and uninstall; `FenneviaSetup.exe` is the recommended release GUI, and `scripts/fennevia.ps1` remains the development console and scripted TUI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Window runtime and recovery                                                   | Complete                                                                                                                       | Existing and later normal/private windows, persisted multi-tab Session Restore across separate Firefox processes, health states, safe start, emergency fallback, and deterministic disposal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Frontend and bridge foundation                                                | Complete                                                                                                                       | Deterministic Svelte 5 build, root-scoped CSS, typed per-window Firefox boundary, and opaque native-handle ownership                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Four-edge frame                                                               | Complete; ADR-080 real-Firefox narrow-window matrix pending                                                                    | Independent top, left, right, and bottom XHTML surfaces, shared reveal/collision/focus policy, accessibility fallbacks, and a viewport-driven retained-floor/ultra-compact panel mosaic                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Tabs and address launcher                                                     | Complete; ADR-059/ADR-060/ADR-062/ADR-063/ADR-071/ADR-072/ADR-073/ADR-081 real-Firefox follow-up pending                       | Event-driven vertical tabs with a fixed, height-capped pinned partition above independently scrolling regular tabs, Firefox's packaged loading/status/action icon family, audio/container/attention/PiP, closed camera/microphone/screen-sharing and crash indicators, Firefox-owned multi-select, fixed trailing actions, verified live source-row drag/keyboard reorder with spatial and accessible move feedback plus enlarged owned edge targets, composable-layout isolation that preserves child tab drag ownership, target-window tab-surface reveal and visible landing row, same-kind cross-window adoption/content append, no-drop target-exit cleanup, same-context stale-drag recovery and terminal-displacement intent before Firefox-owned external detach through a marker-only transfer, native tab context-menu handoff, compact committed address launcher with a leading Firefox Trust shield, and centred address/search popup |
| Top controls                                                                  | Complete; ADR-060 real-Firefox follow-up pending                                                                               | Native-synchronised Back, Forward, Reload/Stop, Home, New Tab, bounded page status, Firefox tool handoffs, packaged Firefox control icons including the Settings gear, and compact project-owned window-command controls                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Default toolbar and native handoffs                                           | Focused implementation; ADR-074/ADR-084 real-Firefox matrix pending                                                            | Deterministic native-v2 four-edge layout: Top navigation and handoffs around an empty Expanded region; a standard-padded Address Row plus expanded Tabs and Separator on the configured tabs side; expanded Bookmarks opposite; centered Downloads status at Bottom; retained Firefox/OS owners back native handoffs and window commands                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Nav-bar widget mirror (ADR-044)                                               | Focused implementation; superseded as a default/sole model by ADR-074; real-Firefox matrix pending                             | `CustomizableUI` built-ins, extension actions with current icon/badge, and structural spaces remain palette/placeable items and valid v1 migration inputs, with popups anchored on the project button; profile-specific nav-bar placement is no longer copied into the native-v2 default                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Fennevia customize mode (ADR-045, ADR-046, ADR-047, ADR-054, ADR-074–ADR-080) | Focused implementation; real-Firefox matrix pending                                                                            | Strict recursive four-edge widget trees, feature-first paired and searchable/filterable CustomizableUI/project palette, optional layout Guide, exact projected drops, bounded autoscroll, one session-wide obstacle-aware floating inspector, viewport-clamped narrow sheet, nested Row/Column orientation, compatible duplicates, independent optional panels, confirmed Clean all, closed per-instance Address/Tabs variants, bounded appearance/interaction prefs, and owner-approved adopt/restore writes; native customize mode remains available                                                                                                                                                                                                                                   |
| Appearance, interaction, and localization                                     | Focused implementation; real-Firefox matrix pending                                                                            | Firefox chrome design tokens provide the default theme; bounded panel/window appearance, motion, separate in-window/window-leave hide timing, temporary reveal timing, shortcut-tip timing, and edge trigger thickness are profile-local; shell strings follow Firefox UI locale with English and Traditional Chinese catalogs                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Urlbar coverage                                                               | Complete; ADR-059 real-Firefox follow-up pending                                                                               | One Firefox-style Trust shield and popup row derived from bounded connection/protection state, permission/action summaries, and complete native Trust/Urlbar handoff                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Urlbar suggestions/providers (ADR-061)                                        | Focused implementation complete; Firefox 154 contract and production-panel probes passed; full provider/release matrix pending | The centred combobox projects bounded results from Firefox's existing per-window provider manager, executes ordinary rows through Firefox `pickResult`, and hands rich/unknown rows to the complete native Urlbar; no Fennevia engine, provider, ranking, persistence, or network endpoint exists                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Bookmarks                                                                     | Complete                                                                                                                       | Bounded lazy Places hierarchy with live updates and Firefox-owned opening behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Downloads                                                                     | Complete                                                                                                                       | Anonymous event-driven aggregate progress/status while Firefox retains safety and file management                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Content-only activation                                                       | Complete for durable hide; first-paint sheet implemented, real flash matrix `not run`                                          | Exact health-gated native-surface hiding, transient native reveal, fullscreen/customize suspension, fail-open cleanup, and a self-expiring first-paint author sheet (ADR-050)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Firefox-update hardening                                                      | Complete for the tested build                                                                                                  | Fixed local/CI gates, resource baseline, ownership repair, compatibility inventory, and same-build update rehearsal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Licensing and distribution                                                    | Complete                                                                                                                       | MPL-2.0 policy, third-party provenance, deterministic ZIP/checksum, exact source/file manifest, and verified prerelease publication                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Later stable transition                                                       | Recorded for ordinary 154.0 runtime                                                                                            | First real stock-stable move is Firefox 153.0.4 / `20260810162159` to 154.0 / `20260812182057`; ADR-048 then relaxed the installer gate to Firefox 153+ with a no-promise warning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

The planned Windows MVP and first public prerelease are complete. ADR-037's
single-line toolbar and native handoffs, ADR-044's nav-bar widget mirror,
ADR-045's Fennevia-owned customize mode, ADR-046's localized names and native
built-in widget icons, ADR-047's live-zone drag-and-drop, ADR-050's first-paint
hide, ADR-054's bounded interaction settings, ADR-058's tab indicators,
ADR-059's unified Trust shield, ADR-060's native shell icons, ADR-071/ADR-072's
tab selection/drop behavior, ADR-073's pinned-tab partition, ADR-074's
recursive everything-is-a-widget layout, ADR-075's projected editor and
per-instance styles, ADR-076's session-wide floating inspector, ADR-077's
panel policy, ADR-078's feature-first paired palette and Guide, and ADR-080's
narrow-window four-panel mosaic, ADR-082/ADR-083's URL/container and narrow-Top
interaction refinements, and ADR-084's owner default and customize backdrop
have focused automated coverage. Their changed
real-Firefox visual and interaction matrices remain pending and are not part of
a completed real-Firefox validation claim for `v0.18.0-beta.1`.

[Issue #1](https://github.com/yutinglia/fennevia/issues/1) recorded the first
real stock-stable transition to Firefox 154.0 Build ID `20260812182057` on
2026-08-19; see `docs/research/firefox-154-stable-transition.md`. ADR-048
relaxes the installer to Firefox 153 and newer with an explicit warning.
Historical research files record what was actually true at each milestone and
are not rewritten when later work supersedes their production shape.

The practical review conclusion is that Fennevia is no longer waiting for a
primary shell feature. Its largest remaining gap is converting focused
implementation evidence into repeatable real-Firefox visual, interaction,
installer, and stable-update support evidence. The detailed review and
recommended priorities are maintained in [Current project status](current-status.md).

## Product model

Fennevia uses four independently owned floating surfaces:

- **Top:** always enabled; defaults to a Row of primary browser controls,
  Trust, an empty Expanded region, Firefox-native handoffs, Customize, and
  compact window commands.
- **Configured tabs side:** independently enabled; defaults to a Column with a
  standard-padded site-status Address Row, expanded integrated-New-Tab Tabs,
  and a Separator.
- **Opposite side:** independently enabled; defaults to expanded Bookmarks.
- **Bottom:** independently enabled; defaults to a Row with centered anonymous
  Downloads status.

A fifth centred overlay contains the only custom editable address/search input.
All edge surfaces remain hidden at rest, reserve no permanent browser-content
space, and share one reveal, collision, focus, popup-hold, cleanup, and glass
design contract.

At 560 CSS px and below, that same frame reflows independently of the optional
compact-window setting. Top remains fixed, Bottom receives a full-width lane,
one visible side expands to at most 320 CSS px while preserving at least 104
CSS px of opposite-side client area for pointer exit, and two visible sides
split with a center gap. Dynamic and reserved panel policies continue to use
their existing visible/enabled attributes. At 360 CSS px and below, a lone side
may use the available width while gaps and Top/Bottom lane heights become
denser. Top/Bottom Rows keep their saved order and expose overflow through
bounded scrolling; no responsive state is persisted.

ADR-074's strict version-2 layout composes each root from project controls and
features, Firefox toolbar mirrors, nested Row/Column containers, one-child
Center/Expanded/Padding wrappers, and always-repeatable
Separator/Space/Flexible-space structure. Ordinary children keep natural size
and start order while Expanded claims remaining room. Each panel root is a
fixed base flow; a sole matching compatibility container has no redundant
editing chrome. The nearest container axis selects horizontal or vertical
feature semantics. Compatible actions and
Firefox mirrors may repeat only when the user opts in; stateful Tabs, Bookmarks,
Downloads status, address launcher, private indicator, and Customize remain
singleton. At least one Customize widget must stay on an enabled edge.

Fresh profiles, malformed-layout fallback, and Reset layout use that explicit
tree. Firefox nav-bar built-ins, extension actions, spacers, and springs remain
available in the palette but are not copied into the default. Valid v1 data
keeps its explicit order during in-memory migration, and valid saved v2 data is
never replaced just because the documented default changes.

While customization is open, one non-focusable project-owned backdrop darkens
the page and intercepts page-only pointer and wheel targeting. It stays below
all four edge panels, the central drawer, and the floating inspector; it does
not mark Firefox content inert, mutate native DOM, or claim modal semantics.

Fennevia customize mode supports live drag-and-drop and explicit keyboard/
button path operations. Enabled empty optional panels are hidden in ordinary
browsing but re-enabled and held visible as labelled drop/add targets while
customizing. A drag subdues its source, reserves one exact bounded insertion
slot, and autoscrolls near the owned panel edge. Drag outlines clear on actual
panel exit and every terminal path. Clicking or focusing a node selects it
across all four roots and opens one Top-root floating inspector containing its
move/containment/axis/remove and eligible Style controls. The inspector stays
outside Row/Column sizing, clamps to the viewport, avoids the central drawer
when another side fits, and restores keyboard focus to a non-selecting outer
node anchor on close/removal. Every editable widget keeps a subtle blue boundary
throughout customize mode, with hover/selection emphasis and a distinct
keyboard focus ring. Boundaries paint inside unchanged widget boxes, so they
add no layout border or minimum size. The
drawer searches localized labels and filters the closed
All/Main features/Fennevia/Firefox/Layout categories. Its first category keeps
Address/Trust, Tabs/New Tab, Bookmarks/Show Bookmarks, and Download
status/Show Downloads together as wide-primary/compact-companion pairs when
both entries are available; incomplete groups use ordinary full/compact flow
without reserved holes. An
optional fifth Guide tab explains fixed edge directions, wrappers, structural
widgets, recipes, editor actions, and recovery without storing onboarding
state. On narrow windows the drawer becomes a viewport-clamped sheet; its
destination selector and click/keyboard placement remain usable when precise
cross-panel dragging is obstructed. Confirmed Clean all restores adopted
Firefox widgets, empties every root, and retains one Top Customize without
changing unrelated settings. Native Firefox customize mode remains available
through the application menu, and Fennevia performs only the bounded adopt/
restore writes accepted by ADR-045.

Eligible project items may persist one closed per-instance style id. Address
selects address-only or an integrated site-status/Trust action; Tabs selects
tabs-only or the existing New Tab action after the final tab. Missing style
fields use registry defaults, explicit defaults are omitted from persistence,
and incompatible ids are rejected. Standalone Trust and New Tab widgets remain
available. No arbitrary CSS, class name, geometry, or native owner enters the
style field.

Outside customize mode, Space, Flexible space, separators, empty containers,
and unoccupied layout gaps feed the shared native-window drag candidate.
Interactive descendants and the active editor remain no-drag.

Fennevia's owned palette also includes `show-bookmarks`, `show-downloads`, and
`show-translate`. The translation widget opens Firefox's built-in full-page
translation owner on the clicked project host. Its narrow popup route remains
active until Firefox's asynchronously created panel is actually shown; Firefox
retains all language, model, settings, error, focus, and translation behavior.

Appearance and interaction customization are deliberately bounded.
Profile-local settings may adjust panel and window backgrounds, text, border,
saturation, shadow, and motion values. They may also set the in-window hide
delay (`100–5,000 ms`), window-leave hide delay (`100–5,000 ms`), temporary
programmatic reveal duration (`400–10,000 ms`), shortcut-tip duration
(`0–10,000 ms`, where zero hides it), and edge trigger thickness
(`6–24 CSS px`). The interaction defaults are `300 ms`, `800 ms`, `1,200 ms`,
`600 ms`, and `12 CSS px`; old version-1 style payloads receive those defaults.
The shell distinguishes a non-null in-window pointer destination from a null
window exit and retains `blur` as the stuck-pointer fallback. Color defaults
resolve to Firefox chrome design tokens so Light, Dark, and System chrome remain
authoritative defaults. This is not an arbitrary CSS or geometry editor.

The retained Firefox toolbar is transient in active mode. **Original Firefox
toolbar** from its placed project control reveals pinned extension widgets and any
unmodeled control; **Open Firefox address bar** reveals and focuses the
complete Urlbar. Placed native-handoff actions open Firefox's authoritative
panels. Returning focus to web content and closing native panels restores the
content-only resting view.

## Architecture summary

```text
Stock Firefox
  └─ minimal AutoConfig bootstrap
      └─ register the fixed Chrome Registry package
          └─ chrome://fennevia/content/...
              ├─ process runtime and per-window lifecycle
              ├─ health gate, safe start, emergency fallback
              ├─ typed Firefox bridges
              │   ├─ tabs
              │   ├─ navigation and address state
              │   ├─ Urlbar permission/action coverage
              │   ├─ native Urlbar result projection and opaque execution
              │   ├─ fixed native browser-tool handoffs
              │   ├─ Places/bookmarks
              │   ├─ Downloads
              │   └─ toolbar widgets and bounded customize actions
              ├─ locale selection and en / zh-Hant catalogs
              └─ Svelte frame with five project-owned roots
                  ├─ top: mandatory composable widget tree
                  ├─ left/right: independent optional composable trees
                  ├─ bottom: independent optional composable tree
                  └─ centred address/search overlay
```

Firefox continues to own `gBrowser`, web-content containers, SessionStore,
Places, Downloads, commands, principals, permissions, dialogs, notifications,
native popups, DevTools, security-sensitive prompts, and the OS window command
implementation. Fennevia owns only its frame, descendants, bounded profile-local
layout/style preferences, and the accepted `CustomizableUI` adopt/restore
operations. ADR-061 permits only bounded per-window result presentation fields
and opaque action tokens to enter project memory while the popup is active;
Firefox still owns query contexts, engines, registered providers, ranking,
private/search-suggestion policy, telemetry, principals, and destinations.

Native UI is never deleted during startup. Durable visibility changes only
after every required host, stylesheet, controller, bridge capability, and
frontend root passes the bounded health gate. ADR-050 may collapse the same
toolbox surfaces at first paint with a 2,000 ms self-expiring author sheet so
the original topbar does not flash; that sheet yields to `failed`,
`suspended`, emergency fallback, and the health deadline. Any unsupported,
failed, or disposed state removes the active gate and exposes native Firefox UI.

## Technology and support choices

- **Browser:** official stock Firefox rather than a maintained source fork.
- **Supported release boundary:** Firefox major version 153 or newer on
  Windows x64, with tested evidence on 153.0.4 / `20260810162159` and 154.0 /
  `20260812182057`. Later majors may install after a no-promise warning.
- **Bootstrap:** AutoConfig only for fixed manifest registration and one fixed
  privileged entry.
- **Runtime:** privileged `.sys.mjs` modules with one process runtime and
  deterministic per-window ownership.
- **Firefox integration:** small typed bridges under `src/firefox/`; no native
  handles enter Svelte or serializable application state.
- **Source organization:** feature folders separate public contracts,
  validation, controllers, native support, UI surfaces, and deterministic
  cleanup. Existing top-level imports remain stable facades rather than
  parallel implementations.
- **UI:** Svelte 5 with TypeScript, compiled into deterministic project-owned
  XHTML roots. Hosts and structural nodes remain XHTML; only explicit
  reviewed caption/generic icon exception subtrees use SVG; exact
  native-equivalent icons use decorative XHTML mask spans backed by fixed
  packaged Firefox resources.
- **Build:** Vite with byte-reproducible output and no CDN, HMR, source maps,
  extra runtime chunks, or network-loaded executable dependencies.
- **Styling and interaction:** frame-scoped component CSS, Firefox chrome
  design tokens as the default color source, bounded profile-local appearance,
  motion, reveal timing, and trigger-size values, with solid,
  reduced-transparency, reduced-motion, and forced-colors fallbacks. Timing
  values reconfigure the shared edge controller; they do not add timers.
- **Localization:** shell-owned English and Traditional Chinese catalogs chosen
  from Firefox UI locale; native Firefox strings remain Firefox-owned. Until a
  Simplified Chinese catalog exists, every `zh-*` locale maps to Traditional
  Chinese.
- **Deliberate omissions:** no generic `.uc.js` loader, component library,
  Tailwind, Shadow DOM, runtime updater, telemetry, remote configuration, or
  arbitrary user CSS/layout engine.

## Goals

- Build a distinct content-first Firefox interface without maintaining a Firefox
  fork.
- Keep custom surfaces hidden at rest with no permanent content margins.
- Localise Firefox-internal breakage behind small, testable bridge modules.
- Preserve immediate recovery that does not depend on Svelte.
- Keep privileged artifacts deterministic, local, bounded, and reviewable.
- Preserve Firefox-owned security infrastructure and complete native access.
- Offer bounded widget placement, appearance, and edge-interaction controls
  without turning the privileged shell into an unrestricted customization
  loader.
- Maintain an evidence-based stable-update workflow.

## Non-goals

- A general-purpose userChrome/userscript loader.
- Compatibility branches for historical Firefox versions.
- A reimplementation or replacement of Firefox's Urlbar providers, ranking,
  search-suggestion engine, Firefox View,
  permissions, bookmark management, Downloads management, SessionStore, or
  extension actions. ADR-061 only projects results from Firefox's existing
  provider pipeline and delegates execution back to Firefox.
- Replacement of Firefox/OS window-command ownership or removal of the retained
  native caption nodes. Project-owned controls may invoke those native command
  owners under ADR-037 and must preserve fail-open access.
- A complete `browser.xhtml` override.
- A branded Firefox fork, Inno/NSIS/MSI product installer, automatic update
  channel, or commercial support product. The PowerShell console in
  `scripts/fennevia.ps1` remains the development TUI. ADR-049 adds a
  release-only WinForms wizard; it is not a Program Files product installer.
- An unrestricted CSS editor or unbounded geometry/layout-expression builder.
- Pixel-for-pixel reproduction of Firefox, `my-firefox-custom`, Arc, Edge, or
  another browser.

## Opinionated structure and bounded customization

The UI and UX deliberately follow the author's content-first preferences. The
four edge hosts, always-enabled Top path, hidden-at-rest behavior, reveal model,
native-ownership boundaries, and interaction hierarchy remain product
decisions rather than a fully user-programmable shell.

That boundary no longer means “not configurable.” ADR-045 through ADR-047 add a
project-owned four-edge widget editor, and ADR-054 extends the current style
model with bounded in-window/window-leave hide, temporary-reveal,
zero-disable shortcut-tip, and trigger-thickness values in addition to
background, text, border, saturation, shadow, and motion. These settings are
versioned, size-limited, validated, profile-local, and kept away from
Firefox-owned DOM and sensitive extension identity persistence.
ADR-064 adds one similarly bounded panel preference for the paired side-role
swap, bottom-panel enablement, and top/bottom activity-light sources. The top
role remains fixed in that historical version. ADR-074 supersedes its placement
clauses with recursive widget trees, independent Left/Right/Bottom enablement,
axis-aware features, and opt-in compatible duplicates while keeping Top and all
native-ownership boundaries mandatory.

`yutinglia/my-firefox-custom` may be consulted for desired capabilities and broad
visual ideas such as edge activation, delayed hiding, glass surfaces,
right-side bookmarks, and download progress. It is not an implementation
template. Fennevia does not copy its `.uc.js` code, selectors, IDs, classes,
timers, globals, numeric values, native-DOM strategy, loader assumptions, module
layout, or visual composition.

## Where to go deeper

- [Current project status](current-status.md)
- [Architecture](architecture.md)
- [Architecture decisions](architecture-decisions.md)
- [Firefox internals map](firefox-internals-map.md)
- [Testing and recovery](testing-and-recovery.md)
- [Firefox stable-update workflow](firefox-update-workflow.md)
- [Security and privacy](security-and-privacy.md)
- [Operational security controls](security-controls.md)
- [Master plan](../plans/000-master-plan.md)
- [Shell roadmap](../plans/002-shell-roadmap.md)
- [Single-line toolbar plan](../plans/004-single-line-toolbar-ui-ux.md)
- [Codebase modularization plan](../plans/007-codebase-modularization.md)
- [Research and validation records](research/)
