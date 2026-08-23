# Current Project Status

> Snapshot: 2026-08-24. This status review is based on `main` through PR #103
> plus the `0.13.0-beta.1` version identity, alongside the public
> `v0.13.0-beta.1` prerelease.
> Historical research records and milestone ADR context remain unchanged.

This page is the short, current answer to “how far along is Fennevia?” The root
READMEs remain user-facing, while the master plan, shell roadmap, architecture,
and testing documents retain the complete engineering contract.

## At a glance

| Area                            | Current state                                                                                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public release                  | `v0.13.0-beta.1`, Windows x64 prerelease                                                                                                                    |
| Tested Firefox                  | Stock Firefox 153.0.4 BuildID `20260810162159` and 154.0 BuildID `20260812182057`, release channel                                                          |
| Installer compatibility gate    | Firefox 153 and newer after an explicit warning; only 153 and 154 are tested                                                                                |
| Core four-edge MVP              | Implemented and released                                                                                                                                    |
| Post-MVP shell work             | Included in `v0.13.0-beta.1` with focused automated coverage, including ADR-064 panel roles/favicons, compact windows, tabbed customize, and tab-panel hold |
| Native Urlbar result projection | Included since `v0.12.0-beta.1`; last recorded Firefox 154 provider-contract, production-panel, failure-injection, and release-candidate probes are the `0.12.0-beta.1` candidate; representative-provider matrix pending |
| Real-Firefox validation         | Last recorded automated Firefox 154 release/recovery and extracted-package matrix is `0.12.0-beta.1`; this `0.13.0-beta.1` package does not re-run that matrix. Several manual visual, assistive, account/device, and GUI installer rows remain pending |
| Stability claim                 | Experimental prerelease; not a stable daily-driver or long-term-support promise                                                                             |

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
- Vertical tabs on the left by default, with selected state, Firefox's packaged loading icon,
  audio, containers, attention/PiP, closed camera/microphone/screen-sharing and crash
  indicators, fixed trailing action positions, middle-click close,
  middle-click/accel New Tab insertion after the current tab,
  drag/keyboard reorder with a pointer-aligned full-row ghost, animated neighbor
  gap, insertion marker, and polite move announcement, plus Firefox-owned tab
  context-menu handoff with complete lazy Fluent labels and no original-toolbar
  reveal.
- Compact address/status launcher on the same configured tabs side, with one Firefox-style Trust shield embedded
  at the leading edge, plus a centred address/search popup backed by Firefox
  navigation, bounded connection/protection state, and the native Trust/Urlbar
  owners. ADR-061 adds an accessible bounded result list fed by Firefox's own
  per-window Urlbar provider manager: ordinary rows execute through native
  `pickResult`, while rich/unknown rows retain the complete native-Urlbar
  handoff. Fennevia adds no search engine, provider, ranking, persistence, or
  suggestion endpoint.
- Fixed top navigation, page status, Firefox tool handoffs, native-panel
  anchoring, packaged Firefox icons including the Settings gear, independently
  configurable loading/download/off top and bottom gutter indicators, a compact
  active-only native corner-status capsule, and project-owned window controls.
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
- Lazy, event-driven bookmarks on the right by default, including Firefox-cached
  bounded raster favicons and middle-click new-tab opening, plus anonymous
  bottom-edge download progress/status while Firefox retains authoritative
  editing, safety, and file management. The complete tabs/bookmarks side roles
  can swap; the bottom owned panel and trigger can be disabled.
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

- Fennevia-owned customize mode with the current `CustomizableUI` inventory.
- Live drag-and-drop placement of supported toolbar widgets across all four
  edge zones.
- Localized widget names, Firefox-native built-in icons, spacers, separators,
  and flexible-space behavior.
- Bounded profile-local appearance and interaction controls for panel/window
  backgrounds, text, borders, saturation, shadow, motion, separate
  in-window/window-leave hide timing, temporary reveal timing, zero-disable
  shortcut-tip timing, and edge trigger thickness.
- Bounded profile-local panel controls for the complete tabs/bookmarks side
  swap, bottom downloads-panel enablement, and top/bottom activity-light source;
  the top role remains fixed.
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

The `0.12.0-beta.1` release-candidate pass on 2026-08-23 additionally covered
the complete automated Firefox 154 lifecycle, Browser Toolbox, safe-start and
failure-injection wrappers, SessionStore rehearsal, Urlbar provider/production
panel probes, three enabled performance samples with a three-run hard-disabled
control, deterministic dual-archive preflight, Unicode-path extraction, and the
extracted package's update/disable/recovery/uninstall/stock-start/install
lifecycle. See
[`docs/research/firefox-154-0.12.0-beta.1-release-validation.md`](research/firefox-154-0.12.0-beta.1-release-validation.md).
This `0.13.0-beta.1` package does not re-run that matrix and does not convert
the pending real-Firefox rows below into observed evidence.

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
- ADR-062 full-row tab-drag ghost alignment, spatial gap behavior during rapid
  direction changes and overflow scrolling, reduced motion, forced colors,
  screen-reader announcements, multiple windows, and disposal during drag;
- ADR-063 target-strip insertion, target-content append, source-content and
  non-Firefox detach, visible target-row placement, no-drop target-window exit,
  Escape and sole-tab behavior, pinned partitions, overlapping windows,
  source and target left-edge auto-hide (including missing source `dragend`),
  normal/private rejection, source/target closure, and
  Browser Console/Toolbox ownership;
- a complete recorded real double-click, UAC, and system-Firefox installation
  matrix for the WinForms release wizard.

Accordingly, `v0.13.0-beta.1` should be described as an implemented experimental
prerelease with validation debt, not as a stable product. The largest remaining
risk is Firefox-internal compatibility and real-environment coverage rather
than absence of the core shell.

## Important support boundaries

- Windows x64 only. Linux and macOS are not supported by the current package.
- Only stock Firefox release 153.0.4 and 154.0 have recorded tested evidence.
  Newer Firefox may be installed after a no-promise warning and may break the
  shell.
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
