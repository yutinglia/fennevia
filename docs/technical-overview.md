# Fennevia Technical Overview

This document contains the engineering-level material intentionally removed from
the public README. For installation and ordinary use, start with the
[English README](../README.md) or [繁體中文 README](../README.zh-Hant.md).

## Current engineering status

As of 2026-08-16, Fennevia has a published Windows x64 prerelease,
`v0.10.0-beta.1`, validated against stock Firefox 153.0.4 release, Build ID
`20260810162159`.

The tested MVP includes:

| Area | Status | Current result |
| --- | --- | --- |
| Bootstrap and package lifecycle | Complete | Fixed AutoConfig/Chrome Registry startup plus ownership-checked install, update, disable, enable, repair, rollback, and uninstall |
| Window runtime and recovery | Complete | Existing and later normal/private windows, persisted multi-tab Session Restore across separate Firefox processes, health states, safe start, emergency fallback, and deterministic disposal |
| Frontend and bridge foundation | Complete | Deterministic Svelte 5 build, root-scoped CSS, typed per-window Firefox boundary, and opaque native-handle ownership |
| Four-edge frame | Complete | Independent top, left, right, and bottom XHTML surfaces, shared reveal/collision/focus policy, and accessibility fallbacks |
| Tabs and address launcher | Complete | Event-driven vertical tabs, compact committed address/status launcher, and centred address/search popup |
| Top controls | Complete | Native-synchronised Back, Forward, Reload/Stop, New Tab, and bounded page status |
| Single-line toolbar and native handoffs | Focused implementation; real-Firefox matrix pending | One non-wrapping top row, fixed native detail/tool/original-toolbar actions, retained caption island, 7px gutter, drag regions, and transient shortcut hint |
| Urlbar coverage | Complete | Firefox-derived connection/protection/permission/action summaries and complete native Urlbar handoff |
| Bookmarks | Complete | Bounded lazy Places hierarchy with live updates and Firefox-owned opening behavior |
| Downloads | Complete | Anonymous event-driven aggregate progress/status while Firefox retains safety and file management |
| Content-only activation | Complete | Exact health-gated native-surface hiding, transient native reveal, fullscreen/customize suspension, and fail-open cleanup |
| Firefox-update hardening | Complete for the tested build | Fixed local/CI gates, resource baseline, ownership repair, compatibility inventory, and same-build update rehearsal |
| Licensing and distribution | Complete | MPL-2.0 policy, third-party provenance, deterministic ZIP/checksum, exact source/file manifest, and verified prerelease publication |
| Later stable transition | Pending availability/evidence | A real transition to a newer Firefox stable still requires the complete update workflow and cannot be claimed from the Firefox 153 rehearsal |

The planned Windows MVP and first public prerelease are complete. ADR-037's
single-line toolbar and native handoffs have focused automated coverage; the
changed real-Firefox visual and interaction matrix remains pending and is not
part of the published `v0.10.0-beta.1` validation claim. [Issue
#1](https://github.com/yutinglia/fennevia/issues/1) remains open because a real
transition to a later Firefox stable has not yet produced the required
compatibility record. Historical research files record what was actually true
at each milestone and are not rewritten when later work supersedes their
production shape.

## Product model

Fennevia uses four independently owned floating surfaces:

- **Top:** one-line primary browser controls and fixed native Firefox handoffs.
- **Left:** vertical tabs and compact address/status launcher.
- **Right:** bookmarks.
- **Bottom:** download progress and status.

A fifth centred overlay contains the only custom editable address/search input.
All edge surfaces remain hidden at rest, reserve no permanent browser-content
space, and share one reveal, collision, focus, popup-hold, cleanup, and glass
design contract.

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
              │   ├─ Fixed native browser-tool handoffs
              │   ├─ Places/bookmarks
              │   └─ Downloads
              └─ Svelte frame with five project-owned roots
                  ├─ top: one-line controls + native Firefox handoffs
                  ├─ left tabs + address launcher
                  ├─ right bookmarks
                  ├─ bottom download status
                  └─ centred address/search overlay
```

Firefox continues to own `gBrowser`, web-content containers, SessionStore,
Places, Downloads, commands, principals, permissions, dialogs, notifications,
native popups, DevTools, security-sensitive prompts, and the OS window frame.
Fennevia owns only its frame and descendants.

Native UI is never deleted during startup. Visibility changes only after every
required host, stylesheet, controller, bridge capability, and frontend root
passes the bounded health gate. Any unsupported, failed, or disposed state
removes the active gate and exposes native Firefox UI.

## Technology and support choices

- **Browser:** official stock Firefox rather than a maintained source fork.
- **Supported release boundary:** exact Firefox version and Build ID allowlist,
  currently Windows x64 / Firefox 153.0.4 / `20260810162159`.
- **Bootstrap:** AutoConfig only for fixed manifest registration and one fixed
  privileged entry.
- **Runtime:** privileged `.sys.mjs` modules with one process runtime and
  deterministic per-window ownership.
- **Firefox integration:** small typed bridges under `src/firefox/`; no native
  handles enter Svelte or serializable application state.
- **UI:** Svelte 5 with TypeScript, compiled into deterministic project-owned
  XHTML roots. Hosts and structural nodes remain XHTML; only explicit
  project-authored icon subtrees use SVG.
- **Build:** Vite with byte-reproducible output and no CDN, HMR, source maps,
  extra runtime chunks, or network-loaded executable dependencies.
- **Styling:** frame-scoped component CSS and local glass tokens with solid,
  reduced-transparency, reduced-motion, and forced-colors fallbacks.
- **Deliberate omissions:** no generic `.uc.js` loader, component library,
  Tailwind, Shadow DOM, runtime updater, telemetry, or remote configuration.

## Goals

- Build a distinct content-first Firefox interface without maintaining a Firefox
  fork.
- Keep custom surfaces hidden at rest with no permanent content margins.
- Localise Firefox-internal breakage behind small, testable bridge modules.
- Preserve immediate recovery that does not depend on Svelte.
- Keep privileged artifacts deterministic, local, bounded, and reviewable.
- Preserve Firefox-owned security infrastructure and complete native access.
- Maintain an evidence-based stable-update workflow.

## Non-goals

- A general-purpose userChrome/userscript loader.
- Compatibility branches for historical Firefox versions.
- A complete replacement for Firefox's Urlbar providers, Firefox View,
  permissions, bookmark management, Downloads management, SessionStore, or
  extension actions.
- Replacement titlebar or OS window commands; current Firefox caption nodes may
  be styled in place under ADR-037.
- A complete `browser.xhtml` override.
- A branded Firefox fork, graphical installer, automatic update channel, or
  commercial support product.
- Pixel-for-pixel reproduction of Firefox, `my-firefox-custom`, Arc, Edge, or
  another browser.

## Opinionated design boundary

The UI and UX deliberately follow the author's preferences. Core layout,
interaction, and visual choices are product decisions rather than user settings
in the current roadmap. They may evolve, but broad configurability is not a
current requirement.

`yutinglia/my-firefox-custom` may be consulted for desired capabilities and broad
visual ideas such as edge activation, delayed hiding, glass surfaces,
right-side bookmarks, and download progress. It is not an implementation
template. Fennevia does not copy its `.uc.js` code, selectors, IDs, classes,
timers, globals, numeric values, native-DOM strategy, loader assumptions, module
layout, or visual composition.

## Where to go deeper

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
- [Research and validation records](research/)
