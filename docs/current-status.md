# Current Project Status

> Snapshot: 2026-08-21. This status review is based on `main` at
> `63caf8de1dc70ed5f43636a492b92b35af75c3c0` and the public
> `v0.11.0-beta.1` prerelease. Historical research records and milestone ADR
> context remain unchanged.

This page is the short, current answer to “how far along is Fennevia?” The root
READMEs remain user-facing, while the master plan, shell roadmap, architecture,
and testing documents retain the complete engineering contract.

## At a glance

| Area | Current state |
| --- | --- |
| Public release | `v0.11.0-beta.1`, Windows x64 prerelease |
| Tested Firefox | Stock Firefox 153.0.4 BuildID `20260810162159` and 154.0 BuildID `20260812182057`, release channel |
| Installer compatibility gate | Firefox 153 and newer after an explicit warning; only 153 and 154 are tested |
| Core four-edge MVP | Implemented and released |
| Post-MVP shell work | Implemented on `main` with focused automated coverage |
| Real-Firefox validation | Several visual, interaction, popup, customize, and first-paint matrices remain pending |
| Stability claim | Experimental prerelease; not a stable daily-driver or long-term-support promise |

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
- Left-edge vertical tabs with selected/loading state, audio, containers,
  attention, middle-click close, drag/keyboard reorder, and Firefox-owned tab
  context-menu handoff.
- Compact address/status launcher plus a centred address/search popup backed by
  Firefox navigation and Urlbar behavior.
- Top navigation, page status, Firefox tool handoffs, native-panel anchoring,
  gutter activity indicators, and compact window controls.
- Lazy, event-driven right-edge bookmarks and anonymous bottom-edge download
  progress/status while Firefox retains authoritative editing, safety, and file
  management.
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
- Firefox chrome design tokens as the default color source, with solid,
  reduced-transparency, reduced-motion, and forced-colors fallbacks.
- English and Traditional Chinese shell catalogs selected from Firefox's UI
  locale. Until a Simplified Chinese catalog exists, every `zh-*` locale maps
  to Traditional Chinese.
- A self-expiring, fail-open first-paint stylesheet intended to prevent the
  original Firefox toolbox flashing before healthy activation.

## Validation status

The `v0.11.0-beta.1` release pull request records successful
`git diff --check`, `npm run format:check`, and `npm run verify`. The verify gate
covers linting, type checking, coverage floors, PowerShell static suites,
dependency review, deterministic builds, and production-artifact checks.

That automated evidence does **not** complete every real-browser claim. The
following remain explicitly pending in the current plans and testing document:

- ADR-037 single-line toolbar visual and interaction matrix;
- ADR-042 host-anchored Firefox popup placement;
- ADR-044 toolbar-widget mirror behavior in real Firefox;
- ADR-045, ADR-047, and ADR-054 customize-mode, live drag-and-drop, and bounded
  interaction-setting behavior;
- ADR-050 cold-start flash, watchdog expiry, and failure-skeleton behavior;
- a complete recorded real double-click, UAC, and system-Firefox installation
  matrix for the WinForms release wizard.

Accordingly, `v0.11.0-beta.1` should be described as an implemented experimental
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
