# Fennevia

Fennevia is an experimental custom browser chrome and browser shell for
**stock Firefox**.

`Fennevia` and the `fennevia` package slug are the project's sole active
identity. The migration from the provisional name is recorded in ADR-017 and
`docs/research/fennevia-identity-migration.md`.

The project is not intended to become another general-purpose `userChrome.js` loader, and its primary architecture is not an indefinitely growing collection of DOM patches. The goal is to use a minimal AutoConfig entry point to register a project-owned Chrome Registry package, load privileged ES modules, and build a replacement visible browser shell with a modern frontend toolchain.

> Status: planning and feasibility-validation stage. A Windows-first,
> ownership-guarded development package workflow is available for isolated
> Firefox copies. The minimal bootstrap and deterministic normal/private
> browser-window lifecycle plus three isolated XHTML diagnostic hosts are
> validated on Firefox 153.0.4. An explicit health deadline, safe start, and
> privileged emergency fallback are implemented. A Svelte 5 smoke island now
> validates per-window state, events, XHTML templates, scoped CSS, official
> unmount/remount, deterministic production output, and broken-bundle recovery
> while native UI remains fully visible. No usable replacement shell,
> daily-driver support, or end-user release is available yet.

## Architecture direction

```text
Stock Firefox
  └─ minimal AutoConfig bootstrap
      └─ register chrome.manifest
          ├─ chrome://fennevia/...
          │   └─ privileged runtime and Firefox bridge
          │       └─ Svelte shell
          │           ├─ tabs
          │           ├─ navigation
          │           ├─ address input
          │           └─ sidebar
          └─ resource://fennevia/... (reserved; omitted until exposure review)
```

The project keeps Firefox's core browser infrastructure, including `gBrowser`, web-content containers, SessionStore, Places, Downloads, commands, permissions, dialogs, notifications, and DevTools. Native visible UI is hidden only after the custom shell mounts and passes health checks. It is not deleted during startup.

## Primary goals

- Run on the official Firefox binary without maintaining a Firefox source fork.
- Replace the visible tabs, navigation, address input, and sidebar with project-owned UI.
- Keep Firefox internals behind a small typed bridge boundary.
- Use a reversible, fail-open native-UI gate.
- Maintain an evidence-based workflow for Firefox updates and internal API breakage.
- Keep the runtime deterministic, local, and free of remote executable dependencies.

## Non-goals for the initial roadmap

- A generic `.uc.js` loader or userscript manager.
- Compatibility with historical Firefox versions.
- A complete rewrite of Firefox Urlbar providers, permission UI, Downloads, or SessionStore.
- Overriding the complete `browser.xhtml`.
- A branded Firefox fork, updater, or public end-user support product.

## Initial technology choices

- Firefox: latest stable during implementation; older versions are not supported.
- First development platform: Windows. Other platforms require separate evidence before support is claimed.
- Bootstrap: AutoConfig used only to register the manifest and load one privileged entry point.
- Runtime: privileged `.sys.mjs` modules.
- UI: Svelte 5 with TypeScript, compiled as one tree-fragment IIFE per browser-window global.
- Build: Vite with a twice-built deterministic production output and no runtime CDN, HMR, source map, extra chunk, or network dependency.
- Styling: extracted Svelte component CSS rooted at the project mount. Tailwind is not adopted for the validated spike.

## Documentation

- [Agent rules](AGENTS.md)
- [Master plan](plans/000-master-plan.md)
- [Bootstrap feasibility spike](plans/001-bootstrap-spike.md)
- [Shell implementation roadmap](plans/002-shell-roadmap.md)
- [Security foundation plan](plans/003-security-foundation.md)
- [Architecture](docs/architecture.md)
- [Architecture decisions](docs/architecture-decisions.md)
- [Firefox internals boundary map](docs/firefox-internals-map.md)
- [Research and debugging playbook](docs/research-playbook.md)
- [Testing and recovery](docs/testing-and-recovery.md)
- [Security and privacy](docs/security-and-privacy.md)
- [Operational security controls and threat model](docs/security-controls.md)
- [Dependency review template](docs/dependency-review-template.md)
- [Development workflow](docs/development-workflow.md)
- [Windows Firefox development setup](docs/development-setup.md)
- [Installation and package lifecycle](docs/installation.md)
- [Firefox 153 window-lifecycle research](docs/research/firefox-153-window-lifecycle.md)
- [Firefox 153 isolated shell-host research](docs/research/firefox-153-shell-hosts.md)
- [Firefox 153 shell health and recovery research](docs/research/firefox-153-shell-health-recovery.md)
- [Firefox 153 Svelte build research](docs/research/firefox-153-svelte-build.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## Implementation workflow

Implementation is tracked through GitHub Issues. An agent must read `AGENTS.md`, the relevant plans and documentation, the complete issue body, and all blockers before starting. A pull request should normally address one issue and include reproducible research and test evidence.

Start with the tracking issue, then follow the dependency order. Do not begin by hiding Firefox native UI.

The frontend toolchain is pinned to the Node.js and npm versions in `.nvmrc`
and `package.json`. After selecting that nvm-managed Node version, install and
verify with:

```powershell
npm ci --ignore-scripts --no-fund
npm run verify
```

## License status

No repository license has been selected yet. Public visibility does not grant permission to copy, redistribute, or incorporate the code. The owner decision, contribution terms, and third-party attribution policy are tracked in issue #18.

Until that decision is complete, agents may research external implementations but must not directly copy third-party code without independently verifying and recording its license and provenance.

## Safety warning

This project executes system-principal code and relies on Firefox internal APIs that Mozilla does not promise to keep stable. A defect can make browser chrome unusable. Development and testing must use a separate Firefox profile, preserve native-UI fallback, and follow the recovery procedures before any daily-use profile is considered.

Preview every package action with `scripts/fennevia-package.ps1 -WhatIf`. The
current installer is for an explicitly selected copied stock Firefox program and
marker-owned, unregistered development profile; see
`docs/installation.md` before running it.
