# Plan 007: Feature-first codebase modularization

**Status:** Complete
**Decision:** ADR-053
**Date:** 2026-08-21

## Objective

Refactor the current implementation into reviewable feature and responsibility
boundaries without changing product behavior, Firefox ownership, public bridge
contracts, installer safety, generated artifact policy, or support claims.

## Constraints

- Preserve the established top-level TypeScript import paths through thin
  facades.
- Keep every Firefox internal in `src/firefox/`; no native handle may enter
  application state or Svelte.
- Keep the shared edge controller, focus restoration, popup holds, keyboard
  access, reduced motion, forced colors, and fail-open cleanup unchanged.
- Keep generated files reproducible from source; never hand-edit installed
  frontend or bridge artifacts.
- Do not add dependencies, runtime discovery, remote resources, preferences,
  telemetry, or new Firefox symbols.
- Keep installer implementation loading fixed and fail closed. Release packages
  must inventory every required implementation file.

## Target boundaries

```text
src/app/<feature>/
  contracts -> validation -> pure state -> adapter/view derivation

src/firefox/<feature>/
  native support -> per-window controller -> optional focused action coordinator

src/shell/
  surfaces/ -> edge composition
  features/ -> tabs, widgets, customize
  runtime/ -> contracts, health, mount, focus/address coordinators
  styles/ -> ordered feature CSS

scripts/lib/installer/
  common -> discovery -> ownership -> planning -> transaction -> public output
```

Top-level files remain stable facades. Dependency direction remains
`shell -> app contracts -> Firefox public bridge -> Firefox implementation`.

## Work completed

1. Split the four-edge Svelte frame into surface and feature components.
2. Split the shell runtime into contracts, health, customize-style, mounting,
   focus, and address-popup coordination.
3. Split the monolithic stylesheet in the exact previous cascade order.
4. Split toolbar-widget, bookmark, and edge state into contracts, validation,
   state/controller, adapter, and view modules.
5. Split Firefox bookmarks, browser tools, downloads, navigation, tabs, Urlbar
   coverage, and toolbar widgets into feature folders with stable facades.
6. Isolate toolbar native presentation and popup action handling.
7. Split the installer into a fixed six-file implementation and update strict
   release packaging inventory.
8. Update architecture, security, installation, tests, and generated artifacts.

## Validation gate

Required before completion:

- `npm run verify`;
- focused Firefox bridge, application state, frontend, installer, and release
  packaging tests;
- deterministic frontend and bridge rebuild;
- generated package-manifest synchronization;
- `git diff --check`;
- no new dependency, Firefox-internal, resource-exposure, or privacy flow.

Real Firefox visual, interaction, startup-flash, and release mass matrices
remain `not run` for this structural change unless separately executed and
recorded.

## Recorded result

- `npm run verify`: passed.
- Node tests: 268 passed; line coverage 87.56%, function coverage 95.21%.
- PowerShell fixed-list suite: passed in both PowerShell 7 and Windows
  PowerShell 5.1.
- Frontend and Firefox bridge builds: deterministic; package manifest
  synchronized.
- Production scan: all 14 artifacts matched the explicit inventory and
  security rules.
- Focused installer/release staging, extraction, tamper, rollback, and
  registered-profile tests: passed.
- Real Firefox mass matrices: `not run`; no new runtime compatibility claim.
