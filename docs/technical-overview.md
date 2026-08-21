# Fennevia Technical Overview

This document contains the engineering-level material intentionally removed from
the public README. For installation and ordinary use, start with the
[English README](../README.md) or [繁體中文 README](../README.zh-Hant.md). For a
short reviewed progress snapshot, see [Current project status](current-status.md).

## Current engineering status

As of 2026-08-22, Fennevia has a published Windows x64 prerelease,
`v0.11.0-beta.1`, tested on stock Firefox 153.0.4 release, Build ID
`20260810162159`, with owner-confirmed ordinary runtime on Firefox 154.0
Build ID `20260812182057`. The installer accepts Firefox 153 and newer after
an explicit warning that later versions may break with no working promise;
see ADR-048 and `docs/research/firefox-154-stable-transition.md`.

The tested MVP and current post-MVP implementation include:

| Area | Status | Current result |
| --- | --- | --- |
| Bootstrap and package lifecycle | Complete | Fixed AutoConfig/Chrome Registry startup plus ownership-checked install, update, disable, enable, repair, rollback, and uninstall; `FenneviaSetup.exe` is the recommended release GUI, and `scripts/fennevia.ps1` remains the development console and scripted TUI |
| Window runtime and recovery | Complete | Existing and later normal/private windows, persisted multi-tab Session Restore across separate Firefox processes, health states, safe start, emergency fallback, and deterministic disposal |
| Frontend and bridge foundation | Complete | Deterministic Svelte 5 build, root-scoped CSS, typed per-window Firefox boundary, and opaque native-handle ownership |
| Four-edge frame | Complete | Independent top, left, right, and bottom XHTML surfaces, shared reveal/collision/focus policy, and accessibility fallbacks |
| Tabs and address launcher | Complete; ADR-059 real-Firefox follow-up pending | Event-driven vertical tabs with loading animation, audio/container/attention/PiP, closed camera/microphone/screen-sharing and crash indicators, fixed trailing actions, drag/keyboard reorder, native tab context-menu handoff, compact committed address launcher with a leading Firefox Trust shield, and centred address/search popup |
| Top controls | Complete | Native-synchronised Back, Forward, Reload/Stop, Home, New Tab, bounded page status, Firefox tool handoffs, and compact window-command controls |
| Single-line toolbar and native handoffs | Focused implementation; real-Firefox matrix pending | One non-wrapping top row, fixed native tool/original-toolbar actions, project-owned control surfaces backed by retained Firefox/OS command owners, 7px gutter, drag regions, and transient shortcut hint |
| Nav-bar widget mirror (ADR-044) | Focused implementation; superseded as sole model by ADR-045; real-Firefox matrix pending | Default top-zone layout from `CustomizableUI` nav-bar placements as project-styled buttons — extension actions with real icon/badge, pinned built-ins, spacers — with popups anchored on the project button |
| Fennevia customize mode (ADR-045, ADR-046, ADR-047, ADR-054) | Focused implementation; real-Firefox matrix pending | Four-edge widget zones, full CustomizableUI inventory palette with localized names and native built-in icons (CSS mask), live-zone HTML5 drag-and-drop, bounded appearance and interaction settings, profile-local prefs, and owner-approved adopt/restore writes; native customize mode remains available from the Firefox application menu |
| Appearance, interaction, and localization | Focused implementation; real-Firefox matrix pending | Firefox chrome design tokens provide the default theme; bounded panel/window appearance, motion, separate in-window/window-leave hide timing, temporary reveal timing, shortcut-tip timing, and edge trigger thickness are profile-local; shell strings follow Firefox UI locale with English and Traditional Chinese catalogs |
| Urlbar coverage | Complete; ADR-059 real-Firefox follow-up pending | One Firefox-style Trust shield and popup row derived from bounded connection/protection state, permission/action summaries, and complete native Trust/Urlbar handoff |
| Bookmarks | Complete | Bounded lazy Places hierarchy with live updates and Firefox-owned opening behavior |
| Downloads | Complete | Anonymous event-driven aggregate progress/status while Firefox retains safety and file management |
| Content-only activation | Complete for durable hide; first-paint sheet implemented, real flash matrix `not run` | Exact health-gated native-surface hiding, transient native reveal, fullscreen/customize suspension, fail-open cleanup, and a self-expiring first-paint author sheet (ADR-050) |
| Firefox-update hardening | Complete for the tested build | Fixed local/CI gates, resource baseline, ownership repair, compatibility inventory, and same-build update rehearsal |
| Licensing and distribution | Complete | MPL-2.0 policy, third-party provenance, deterministic ZIP/checksum, exact source/file manifest, and verified prerelease publication |
| Later stable transition | Recorded for ordinary 154.0 runtime | First real stock-stable move is Firefox 153.0.4 / `20260810162159` to 154.0 / `20260812182057`; ADR-048 then relaxed the installer gate to Firefox 153+ with a no-promise warning |

The planned Windows MVP and first public prerelease are complete. ADR-037's
single-line toolbar and native handoffs, ADR-044's nav-bar widget mirror,
ADR-045's Fennevia-owned customize mode, ADR-046's localized names and native
built-in widget icons, ADR-047's live-zone drag-and-drop, ADR-050's first-paint
hide, ADR-054's bounded interaction settings, ADR-058's tab indicators, and
ADR-059's unified Trust shield have focused automated
coverage. Their changed real-Firefox
visual and interaction matrices remain pending and are not part of a completed
real-Firefox validation claim for `v0.11.0-beta.1`.

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

- **Top:** one-line primary browser controls, Firefox-native handoffs, a
  placeable widget zone, and compact window-command controls.
- **Left:** vertical tabs, a compact address/status launcher with one Trust
  shield embedded at the leading edge, and an optional widget zone.
- **Right:** bookmarks and an optional widget zone.
- **Bottom:** download progress/status and an optional widget zone.

A fifth centred overlay contains the only custom editable address/search input.
All edge surfaces remain hidden at rest, reserve no permanent browser-content
space, and share one reveal, collision, focus, popup-hold, cleanup, and glass
design contract.

The default widget layout mirrors the Firefox nav-bar into the top zone until a
user makes the first Fennevia customization. Fennevia customize mode then owns a
versioned four-zone layout, can place supported `CustomizableUI` widgets by live
drag-and-drop, and may perform only the bounded adopt/restore writes accepted by
ADR-045. Native Firefox customize mode remains available through the
application menu.

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
toolbar** in the custom top row reveals pinned extension widgets and any
unmodeled control; **Open full Firefox address bar** reveals and focuses the
complete Urlbar. Fixed top-row actions open Firefox's authoritative native
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
              │   ├─ fixed native browser-tool handoffs
              │   ├─ Places/bookmarks
              │   ├─ Downloads
              │   └─ toolbar widgets and bounded customize actions
              ├─ locale selection and en / zh-Hant catalogs
              └─ Svelte frame with five project-owned roots
                  ├─ top: one-line controls + native handoffs + widgets
                  ├─ left: tabs + address launcher + widgets
                  ├─ right: bookmarks + widgets
                  ├─ bottom: download status + widgets
                  └─ centred address/search overlay
```

Firefox continues to own `gBrowser`, web-content containers, SessionStore,
Places, Downloads, commands, principals, permissions, dialogs, notifications,
native popups, DevTools, security-sensitive prompts, and the OS window command
implementation. Fennevia owns only its frame, descendants, bounded profile-local
layout/style preferences, and the accepted `CustomizableUI` adopt/restore
operations.

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
  project-authored icon subtrees use SVG.
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
- A complete replacement for Firefox's Urlbar providers, Firefox View,
  permissions, bookmark management, Downloads management, SessionStore, or
  extension actions.
- Replacement of Firefox/OS window-command ownership or removal of the retained
  native caption nodes. Project-owned controls may invoke those native command
  owners under ADR-037 and must preserve fail-open access.
- A complete `browser.xhtml` override.
- A branded Firefox fork, Inno/NSIS/MSI product installer, automatic update
  channel, or commercial support product. The PowerShell console in
  `scripts/fennevia.ps1` remains the development TUI. ADR-049 adds a
  release-only WinForms wizard; it is not a Program Files product installer.
- An unrestricted CSS editor, arbitrary edge-role reassignment, or general
  geometry/layout builder.
- Pixel-for-pixel reproduction of Firefox, `my-firefox-custom`, Arc, Edge, or
  another browser.

## Opinionated structure and bounded customization

The UI and UX deliberately follow the author's content-first preferences. The
four edge roles, hidden-at-rest behavior, reveal model, native-ownership
boundaries, and interaction hierarchy remain product decisions rather than a
fully user-programmable shell.

That boundary no longer means “not configurable.” ADR-045 through ADR-047 add a
project-owned four-edge widget editor, and ADR-054 extends the current style
model with bounded in-window/window-leave hide, temporary-reveal,
zero-disable shortcut-tip, and trigger-thickness values in addition to
background, text, border, saturation, shadow, and motion. These settings are
versioned, size-limited, validated, profile-local, and kept away from
Firefox-owned DOM and sensitive extension identity persistence.

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
