# Fennevia

Fennevia is an experimental, content-first browser chrome and browser shell for
**stock Firefox**.

`Fennevia` and the `fennevia` package slug are the project's sole active
identity. The migration from the provisional name is recorded in ADR-017 and
`docs/research/fennevia-identity-migration.md`.

The project is not a general-purpose `userChrome.js` loader and is not intended
to become an indefinitely growing collection of native-DOM patches. A minimal
AutoConfig entry registers a project-owned Chrome Registry package, loads fixed
privileged ES modules, and mounts project-owned Svelte UI through typed Firefox
bridges.

> **Current status — 2026-08-16:** package `0.10.0-dev` is validated on Firefox
> 153.0.4 for Windows in an isolated copied Firefox program and marker-owned
> development profile. Bootstrap, installation lifecycle, multi-window runtime,
> health/recovery, deterministic Svelte production builds, the typed bridge
> boundary, tab-state bridge, accessible tab UI, and the common four-edge
> floating frame are implemented. The left edge contains functional vertical
> tabs plus a compact address launcher with real Firefox connection and
> tracking-protection status. A centered popup provides address/search editing
> plus fuller connection, protection, permission, applicable-action, and native
> Urlbar-access detail. The top edge contains native-synchronized Back,
> Forward, Reload/Stop, and New Tab controls plus bounded page status. The right
> edge contains a bounded, lazy, event-driven bookmarks panel backed by Firefox
> Places and opaque per-window handles. The bottom edge contains an event-driven
> anonymous download-status panel with determinate/indeterminate aggregate
> progress; native Downloads management and safety remain Firefox-owned.
> Firefox native UI remains visible and unchanged; content-only active mode is
> not implemented yet.

There is no daily-driver support, versioned end-user release, cross-platform
support claim, or completed security audit.

## Product direction

Fennevia's final MVP uses four independent project-owned floating surfaces:

- **Top:** primary browser controls.
- **Left:** vertical tabs and a compact address/status launcher.
- **Right:** bookmarks.
- **Bottom:** download progress and status.

The sole custom editable address field opens in a fifth, centered
project-owned overlay root. Firefox retains its native Urlbar, identity and
protections panels, permissions, page actions, and security prompts. The popup
shows only fixed Firefox-derived summaries and can hand focus to the complete
native Urlbar.

Each surface is hidden at rest, reserves no permanent layout space, and is
revealed by its matching window edge or an accessible keyboard/focus path. The
surfaces share one Fennevia-owned reveal, collision, focus, popup-hold, cleanup,
and frosted-glass design contract while retaining independent ownership and
state.

When the shell eventually enters healthy `active` mode, the normal Firefox
client area should show only the current web page until one of those surfaces is
revealed. Native OS window controls and Firefox security-sensitive prompts,
dialogs, notifications, extension-install UI, download-safety UI, DevTools, and
browser-content infrastructure remain Firefox-owned.

## UI and UX philosophy

Fennevia is intentionally opinionated. Its UI and UX are based on the author's
personal preferences and workflow, and the project is designed primarily to
satisfy those needs rather than to provide a broadly configurable browser
interface.

The current roadmap does not provide user-facing configuration for core layout,
interaction, or visual-design choices. These choices are treated as part of
Fennevia's product design rather than as settings that every user can customize.

This does not mean the design is permanently frozen. The UI and UX may change as
the author's preferences, workflow, experiments, or implementation constraints
evolve, and configurability may be reconsidered in the future if it becomes
useful.

## Current progress

| Area                                          | Status         | Result                                                                                                                                                        |
| --------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Safe development and privileged-code baseline | Complete       | Dedicated Windows profile workflow, threat model, redacted diagnostics, and recovery rules                                                                    |
| Bootstrap and package lifecycle               | Complete       | Minimal AutoConfig/Chrome Registry chain plus path-safe install, update, disable, and uninstall                                                               |
| Window runtime and recovery                   | Complete       | Existing/later normal and private windows, deterministic disposal, health states, safe start, and emergency fallback                                          |
| Frontend and bridge foundation                | Complete       | Deterministic Svelte 5 build, root-scoped CSS, typed per-window Firefox boundary, and opaque native-handle ownership                                          |
| Tabs data and UI                              | Complete       | Event-driven immutable tab state plus accessible vertical tab UI in the left surface                                                                          |
| Four-edge frame                               | Complete       | Independent top/left/right/bottom XHTML surfaces, edge reveal controller, collision rules, glass tokens, and accessibility fallbacks                          |
| Top primary controls                          | Complete — #12 | Event-driven navigation bridge and Back/Forward/Reload/Stop/New Tab UI with bounded text-only page status                                                     |
| Address launcher and popup                    | Complete — #13 | Compact committed location plus real Firefox connection/protection badges, centered address/search popup, native Urlbar submission, and healthy-only `Ctrl+L` |
| Urlbar permission/action coverage             | Complete — #37 | Fixed detailed permission/action availability, event-driven per-window bridge, and complete native Urlbar handoff                                           |
| Right bookmarks                               | Complete — #14 | Typed Places bridge, bounded lazy hierarchy, native live updates, and Firefox-owned current/new-tab opening                                                   |
| Bottom downloads                              | Complete — #32 | Per-window PUBLIC/PRIVATE list views, bounded anonymous state, accessible aggregate progress/status, and native safety/management retained                    |
| Content-only activation                       | Pending — #15  | Reversible hiding of only the native surfaces with complete replacements                                                                                      |
| Hardening and Firefox-update workflow         | Pending — #16  | Full regression, resource, performance, cleanup, and stable-update matrix                                                                                     |
| Project license                               | Pending — #18  | Owner-approved license and third-party attribution policy                                                                                                     |

The tracking source of truth is issue #1. Historical research records preserve
what was true at each earlier milestone; they should not be rewritten to pretend
that later code already existed.

## Architecture

```text
Stock Firefox
  └─ minimal AutoConfig bootstrap
      └─ register chrome.manifest
          └─ chrome://fennevia/content/...
              ├─ process runtime and per-window lifecycle
              ├─ health gate, safe start, emergency fallback
              ├─ typed Firefox bridges
              │   ├─ tabs (implemented)
              │   ├─ navigation (implemented)
              │   ├─ address/status popup (implemented)
              │   ├─ Urlbar permission/action coverage (implemented)
              │   ├─ Places/bookmarks (implemented)
              │   └─ Downloads (implemented)
              └─ Svelte frame with five owned roots
                  ├─ top: primary controls
                  ├─ left: vertical tabs + compact address/status launcher
                  ├─ right: bookmarks
                  ├─ bottom: download progress/status
                  └─ center overlay: address/search popup + status details
```

Firefox continues to own `gBrowser`, web-content containers, SessionStore,
Places, Downloads, commands, permissions, dialogs, notifications, native
popups, DevTools, and the OS window frame. Fennevia owns only its XHTML frame and
descendants. Native visible UI may be hidden only after the complete custom
surface set passes the health and recovery gates; it is never deleted during
startup.

## Primary goals

- Run on the official Firefox binary without maintaining a Firefox source fork.
- Provide a distinct content-first four-edge browser interface.
- Keep all custom surfaces hidden at rest and free of permanent content margins.
- Keep Firefox internals behind small typed bridge modules.
- Preserve immediate, Svelte-independent native fallback.
- Maintain an evidence-based workflow for Firefox stable updates and internal
  API breakage.
- Keep privileged runtime artifacts deterministic, local, and free of remote
  executable dependencies.
- Preserve security-sensitive native Firefox UI and infrastructure.

## Non-goals for the initial roadmap

- A generic `.uc.js` loader or userscript manager.
- Compatibility with historical Firefox versions.
- A complete replacement for Urlbar suggestions/providers, Firefox View,
  identity/permission UI, bookmark management, Downloads management,
  SessionStore, or extension actions.
- Custom titlebar or OS window controls.
- Overriding the complete `browser.xhtml`.
- A branded Firefox fork, updater, public installer, or support product.
- Pixel-for-pixel reproduction of Firefox, `my-firefox-custom`, Arc, Edge, or
  another browser.

## Technology and support choices

- **Firefox:** latest stable during implementation; current evidence is Firefox
  153.0.4.
- **Platform:** Windows-first. Linux and macOS require separate real evidence.
- **Bootstrap:** AutoConfig only to register the manifest and import one fixed
  privileged entry.
- **Runtime:** privileged `.sys.mjs` modules with one process runtime and
  per-window deterministic disposal.
- **UI:** Svelte 5 with TypeScript, compiled as a fixed tree-fragment IIFE into
  four edge roots and one address-overlay root, all project-owned XHTML.
- **Build:** Vite with byte-reproduced production artifacts and no CDN, HMR,
  source map, extra chunk, or runtime network dependency.
- **Styling:** frame-scoped component CSS and Fennevia-owned glass tokens with
  near-solid, reduced-transparency, reduced-motion, and forced-colors fallbacks.
- **UI framework policy:** no Tailwind, Shadow DOM, or component library in the
  validated implementation because the smaller local design system is
  sufficient.

## Design-reference boundary

`yutinglia/my-firefox-custom` may be inspected for desired capabilities and
broad visual concepts such as edge activation, delayed hiding, glass surfaces,
right-side bookmarks, and download progress. It is not an implementation
template.

Do not copy its `.uc.js` code, selectors, IDs, classes, timers, global flags,
numeric values, native-DOM mutation strategy, loader assumptions, module
layout, or visual composition. Any implementation record that consults it must
name the exact commit and explain Fennevia's independently selected architecture
and design.

## Documentation

### Plans and operating rules

- [Agent rules](AGENTS.md)
- [Master plan](plans/000-master-plan.md)
- [Bootstrap feasibility spike](plans/001-bootstrap-spike.md)
- [Shell implementation roadmap](plans/002-shell-roadmap.md)
- [Security foundation plan](plans/003-security-foundation.md)
- [Development workflow](docs/development-workflow.md)
- [Windows Firefox development setup](docs/development-setup.md)
- [Installation and package lifecycle](docs/installation.md)

### Architecture, security, and testing

- [Architecture](docs/architecture.md)
- [Architecture decisions](docs/architecture-decisions.md)
- [Firefox internals boundary map](docs/firefox-internals-map.md)
- [Research and debugging playbook](docs/research-playbook.md)
- [Testing and recovery](docs/testing-and-recovery.md)
- [Security and privacy](docs/security-and-privacy.md)
- [Operational security controls and threat model](docs/security-controls.md)
- [Dependency review template](docs/dependency-review-template.md)

### Current implementation evidence

- [Firefox 153 window lifecycle](docs/research/firefox-153-window-lifecycle.md)
- [Firefox 153 initial shell hosts](docs/research/firefox-153-shell-hosts.md)
- [Firefox 153 shell health and recovery](docs/research/firefox-153-shell-health-recovery.md)
- [Firefox 153 Svelte build](docs/research/firefox-153-svelte-build.md)
- [Firefox 153 bridge boundary](docs/research/firefox-153-bridge-boundary.md)
- [Firefox 153 tabs bridge](docs/research/firefox-153-tabs-bridge.md)
- [Firefox 153 accessible tab UI](docs/research/firefox-153-tab-strip.md)
- [Firefox 153 four-edge shell](docs/research/firefox-153-four-edge-shell.md)
- [Firefox 153 top navigation](docs/research/firefox-153-navigation-controls.md)
- [Firefox 153 compact address launcher and popup](docs/research/firefox-153-address-popup.md)
- [Firefox 153 Urlbar trust, permission, and action coverage](docs/research/firefox-153-urlbar-coverage.md)
- [Firefox 153 right-edge bookmarks](docs/research/firefox-153-bookmarks-surface.md)
- [Firefox 153 bottom-edge downloads](docs/research/firefox-153-downloads-surface.md)

Historical research files are immutable evidence of the tested milestone they
describe. Later decisions supersede their production architecture through ADRs
and current plans rather than retroactively editing old observations.

## Build and verification

Use the exact Node.js and npm versions in `.nvmrc` and `package.json`:

```powershell
npm ci --ignore-scripts --no-fund
npm run verify
```

`npm run verify` checks formatting, lint, Svelte/TypeScript diagnostics, tests,
dependency policy, deterministic builds, package-manifest synchronization, and
the production artifact gate.

Real Firefox work additionally requires the copied Firefox program,
marker-owned development profile, and the issue-specific smoke and recovery
commands documented in `docs/testing-and-recovery.md`.

## Implementation workflow

Implementation is issue-first. Before changing code or documentation, read
`AGENTS.md`, the complete issue and blockers, relevant plans, current
implementation, latest relevant commits, decisions, and research records.

Every feature must pass while native Firefox UI remains visible. Do not jump
directly to #15 or hide native UI to make an incomplete surface appear finished.

## License status

No repository license has been selected. Public visibility does not grant
permission to copy, redistribute, or incorporate the code. Issue #18 owns the
project-license, contribution, and attribution decision.

External projects may be researched, but implementation code may not be copied
without an independently verified license and recorded provenance.

## Safety warning

Fennevia executes system-principal code and relies on Firefox internal APIs that
Mozilla does not promise to keep stable. A defect can make browser chrome
unusable. Development and testing must use the isolated workflow, preserve
native fallback, and follow recovery procedures before any daily-use profile is
considered.

Preview every package mutation with:

```powershell
pwsh -NoProfile -File .\scripts\fennevia-package.ps1 <Action> `
  -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe' `
  -ProfilePath '<FENNEVIA_DEV_PROFILE>' `
  -WhatIf
```

Read `docs/installation.md` before running a non-preview package action.
