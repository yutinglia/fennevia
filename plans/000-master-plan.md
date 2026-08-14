# Master Plan: Stock Firefox Custom Browser Shell

## 1. Vision

Build a custom browser chrome on top of stock Firefox without compiling or maintaining a Firefox fork. Firefox remains the Gecko and browser platform, while this project provides a privileged integration runtime and a modern, project-owned visible shell.

The eventual user-facing interface may contain only this project's tabs, navigation controls, address input, sidebar, and command surfaces. Firefox's native visible shell is hidden after successful activation, while its underlying browser infrastructure remains available through a typed bridge.

## 2. Success criteria

- No runtime dependency on Alice0775, fx-autoconfig, or another general-purpose userChrome loader.
- A minimal AutoConfig bootstrap that can be understood, tested, installed, disabled, and removed independently.
- A project-owned Chrome Registry namespace for privileged modules and assets.
- A frontend framework that manages only project-owned DOM.
- Firefox internal APIs isolated behind small bridge modules.
- A fail-open recovery path that preserves or immediately restores native Firefox UI.
- A reproducible research workflow for breakage caused by Firefox stable updates.
- An MVP that provides basic tabs, navigation, address input, and sidebar behavior in a clean profile.
- A documented security, privacy, dependency, logging, and installation baseline for system-principal code.

## 3. Non-goals

- A generic `.uc.js` loader or userscript manager.
- Support for multiple historical Firefox versions.
- Reimplementing the complete Urlbar suggestion engine, permission system, Downloads backend, or SessionStore during the first roadmap.
- Overriding the complete `browser.xhtml` during the first roadmap.
- Producing a public one-click product or a Firefox branding and update pipeline during the first roadmap.
- Copying large loader implementations instead of understanding the underlying Firefox change.

## 4. Architecture principles

1. **Own instead of patch.** Create project-owned UI whenever possible rather than modifying native widget internals.
2. **Bridge instead of leak.** Firefox-native objects do not enter Svelte components or serializable application state.
3. **Hide only after a healthy mount.** Native UI visibility is the last activation step, not the first startup action.
4. **Preserve infrastructure.** Keep web-content containers, commands, popups, dialogs, permissions, notifications, SessionStore, Places, Downloads, and DevTools.
5. **Quarantine overrides.** High-risk resource overrides are isolated, separately reviewed, and initially absent.
6. **Require evidence before abstraction.** Prove startup, lifecycle, namespace, and cleanup behavior before building a framework around them.
7. **Fail open.** Any unknown or failed state exposes native Firefox UI.
8. **Minimize privileged attack surface.** Keep dependencies, resource exposure, logging, and installer behavior constrained and reviewed.

## 5. Phases and gates

### Phase 0: Safe development environment

Deliverables:

- A dedicated Firefox development profile and reproducible launch procedure.
- A reliable way to record Firefox version, build ID, channel, profile path, and project commit.
- Working Browser Console and Browser Toolbox access.
- A documented profile reset and cleanup procedure.

Gate: testing can be repeated without modifying the daily-use profile.

### Phase 0.5: Security and privacy foundation

Deliverables:

- A privileged-code threat model.
- Logging and diagnostic redaction rules.
- Dependency and supply-chain policy.
- Chrome/resource exposure policy.
- Installer path-safety requirements.
- A security reporting and review workflow.

Gate: bootstrap and dependency work can proceed under explicit security and privacy constraints.

### Phase 1: Minimal bootstrap and Chrome package

Deliverables:

- AutoConfig resolves the active profile package location.
- `nsIComponentRegistrar.autoRegister()` or a source-validated equivalent registers the project manifest.
- One project-owned privileged `.sys.mjs` entry loads through a registered URI.
- Fatal errors include useful context and leave native Firefox UI fully usable.

Gate: three repeatable cold starts on the current Firefox stable produce exactly one process bootstrap, and uninstall restores stock behavior.

### Phase 2: Window lifecycle and shell hosts

Deliverables:

- Existing and later browser windows are discovered and managed.
- Normal, second, and private-window behavior is explicit.
- Each managed window receives project-owned XHTML hosts.
- Per-window cleanup, health state, safe start, and emergency fallback exist.
- The initial diagnostic UI does not hide native UI.

Gate: no duplicate initialization, half-mounted window, or retained listener remains after close or disposal.

### Phase 3: Frontend build feasibility

Deliverables:

- A Svelte 5, TypeScript, and Vite production-build spike.
- Deterministic artifacts with no CDN, HMR client, dev server, or runtime network dependency.
- XHTML namespace, event, style, mount, unmount, and remount evidence.
- An evidence-based decision on plain CSS, Svelte CSS, and optional Tailwind.

Gate: state, event, CSS, cleanup, and multi-window smoke tests pass in Firefox chrome.

### Phase 4: Firefox bridge and state model

Deliverables:

- Typed adapters for tabs, selected-tab state, and navigation state.
- Explicit event subscription and unsubscription.
- Runtime capability checks and useful typed errors.
- Native handles retained only inside the bridge.

Gate: native actions and shell actions remain synchronized without DOM polling or leaked native objects.

### Phase 5: Usable UI slices

Implement in this order:

1. Custom tab strip MVP.
2. Back, forward, reload, stop, and new-tab controls.
3. Address input MVP that reuses Firefox URL and search semantics.
4. Project-owned sidebar MVP.
5. Additional menu, command, and download surfaces as separate follow-up work.

Gate: basic browsing can be completed through the custom shell while native UI remains visible as a comparison and fallback.

### Phase 6: Hide the native visible shell

Deliverables:

- Root-state-gated rules hide only native UI that has a verified replacement.
- Window controls, fullscreen, customize mode, DevTools, dialogs, prompts, and notifications have explicit policies.
- Missing bundle, missing CSS, bridge failure, and health timeout all fail open.
- Safe start and emergency fallback restore native UI without requiring a working Svelte component.

Gate: controlled breakage never leaves Firefox without an operable recovery path.

### Phase 7: Hardening and update workflow

Deliverables:

- A complete Firefox-internal dependency inventory.
- A stable-update compatibility checklist and incident template.
- CI for format, lint, typecheck, unit tests, production build, and artifact checks.
- Install, update, uninstall, startup-cache, restart, session-restore, cleanup, and failure-injection evidence.
- At least one real Firefox stable update handled with a documented before-and-after compatibility record when such an update occurs.

Gate: an agent who did not implement the original code can reproduce the update and recovery workflow from the repository documentation.

## 6. Target repository layout

```text
program/                       # Minimal files installed in the Firefox program directory
profile/chrome/fennevia/
  chrome.manifest
  runtime/                     # Installed privileged runtime artifacts
  shell/                       # Installed production UI assets
src/
  bootstrap/
  runtime/
  firefox/                     # Firefox-internal boundary
  app/
  shell/
  styles/
patches/                       # Empty by default; reviewed high-risk overrides only
scripts/                       # Build, install, update, uninstall, and dev-profile helpers
tests/
docs/
plans/
```

Issue #3 validated the minimal bootstrap files, and issue #4 stabilized their
source and installed boundaries through `package-manifest.json`, `program/`,
and `profile/chrome/fennevia/`. The future generated `runtime/` and `shell/`
contents remain provisional until the frontend build spike supplies a reviewed
artifact inventory.

## 7. Major risks and mitigations

| Risk | Mitigation |
|---|---|
| Firefox changes AutoConfig or manifest registration | Compatibility canaries, Searchfox, official source history, minimal bootstrap tests |
| Svelte runtime conflicts with XHTML or mixed XUL/HTML chrome | Isolated-host spike and strict DOM ownership |
| Firefox changes internal APIs | Small bridge modules, runtime capability checks, latest-stable-only policy |
| Native UI is hidden while the custom shell fails | Health gate, safe start, emergency toggle, independent dev profile |
| Resource overrides approach fork-level maintenance | Overrides default to zero and require dedicated review |
| CSS leaks into native chrome | Root-scoped styles, no global reset, optional prefixed Tailwind without Preflight |
| Multi-window lifecycle leaks state or listeners | Process WindowManager, per-window disposer, explicit tests |
| Privileged dependency or installer compromise | Small dependency graph, lockfile, review policy, path validation, no runtime network code |
| Logs expose browsing information | Default redaction and explicit diagnostic opt-in |

## 8. Issue execution rules

- Foundation issues must be completed in dependency order. Do not jump directly to hiding native UI.
- A research issue must produce reproducible evidence or a clear negative result, not merely a list of links.
- Every UI issue must first pass while native UI remains visible.
- Any proposal that makes maintenance resemble a Firefox fork requires an architecture decision before implementation.
- Parallel work is allowed only when shared bootstrap, lifecycle, and bridge contracts are already validated.
- Acceptance criteria may be refined with evidence, but must not be silently weakened.
