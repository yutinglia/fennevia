# Architecture Decisions

This file records the active high-level decisions. Add a new entry for a major change rather than silently rewriting historical reasoning. Mark an older decision as superseded when a later decision replaces it.

## ADR-001: Use stock Firefox, not a source fork

**Status:** Accepted

Use the official Firefox binary and install the custom shell through AutoConfig, Chrome Registry registration, and a privileged runtime.

**Reasoning:** This avoids downloading, compiling, merging, branding, and releasing the full Firefox source tree. The tradeoff is dependence on unsupported internal APIs and the limits of runtime hooks.

## ADR-002: Do not build a general-purpose userChrome loader

**Status:** Accepted

The bootstrap does not scan `.uc.js`, parse userscript metadata, or provide arbitrary-script sandbox and compatibility behavior.

**Reasoning:** This repository contains one controlled application. Generic discovery, legacy compatibility, cache abstraction, and arbitrary userscript execution are unnecessary attack surface and maintenance cost.

Alice0775, fx-autoconfig, and similar projects are compatibility research sources only.

## ADR-003: Use Chrome Registry as the resource boundary

**Status:** Accepted pending spike validation; initial exposure policy amended by ADR-015

Register project-owned `chrome://my-firefox-shell/` and `resource://my-firefox-shell/` URIs so privileged modules, UI assets, and styles do not depend on absolute file paths.

Phase 1 must validate registration, import timing, cache behavior, resource exposure, and removal on the current Firefox stable.

## ADR-004: Do not override `browser.xhtml` during the initial roadmap

**Status:** Accepted

Keep Firefox's main-window markup and includes. Add isolated project-owned hosts after load and later hide only replaced visible native UI.

**Reasoning:** A complete override would require tracking every upstream structural and security change, making maintenance resemble an uncompiled fork and risking omission of startup, dialog, popup, and security infrastructure.

## ADR-005: Use isolated frontend islands

**Status:** Accepted

The frontend framework mounts only into project-created XHTML roots. Firefox-owned DOM is never reconciled by the framework.

Svelte 5 is the initial candidate and must pass a production-build and XHTML lifecycle spike. A failed Svelte spike may replace the frontend implementation without changing bootstrap and bridge contracts.

## ADR-006: Access Firefox internals only through bridges

**Status:** Accepted

Dependencies on `gBrowser`, Services, Places, SessionStore, Downloads, commands, native DOM, and related internals are concentrated in `src/firefox/` and a minimal amount of runtime bootstrap code.

**Reasoning:** Firefox update fixes remain localized, while UI state and components remain testable and replaceable.

## ADR-007: Hide native UI behind a health gate; do not delete it

**Status:** Accepted

Set the active state only after frontend mount and required capability checks succeed. CSS hides native visible UI only while active. Failure leaves native UI usable.

**Reasoning:** Firefox code may continue to rely on native elements, and the retained DOM provides a recovery path.

## ADR-008: Isolate overrides and default to zero

**Status:** Accepted

`patches/` starts empty. Any manifest override, monkey patch, or internal script replacement requires a dedicated issue, source pin, tests, update process, and removal plan.

## ADR-009: Latest stable only; Windows first

**Status:** Accepted

Development guarantees only the current Firefox stable. The first install and test workflow targets Windows. Do not add historical-version compatibility branches. Do not claim cross-platform support before testing it.

## ADR-010: Generated artifacts are not the source of truth

**Status:** Accepted

Production JavaScript and CSS are generated from TypeScript, Svelte, and source styles. Never hand-edit `dist/`. Builds must be deterministic and free of runtime CDN or dev-server dependencies.

## ADR-011: Failure must expose native Firefox UI

**Status:** Accepted

Unknown, timeout, partial, or failed states do not activate native-UI hiding. Emergency fallback and safe start are release gates rather than optional convenience features.

**Reasoning:** The project modifies the primary browser control surface with system-principal code. A closed failure mode could make recovery impractical.

## ADR-012: No runtime remote executable dependencies

**Status:** Accepted

The installed runtime does not fetch executable JavaScript, CSS, fonts, configuration, templates, analytics scripts, or updates from remote endpoints.

**Reasoning:** Remote content would expand the privileged attack surface, reduce reproducibility, and complicate offline recovery.

## ADR-013: Minimize and redact diagnostics

**Status:** Accepted

Normal diagnostics exclude complete URLs, page titles, search text, history, profile paths, cookies, tokens, and private-window state. More detailed debugging requires explicit local opt-in and must not become a network telemetry path.

## ADR-014: Preserve Firefox security-sensitive UI until separately reviewed

**Status:** Accepted

Permissions, authentication, certificates, file pickers, extension installation, download safety, and other security-sensitive prompts remain native Firefox infrastructure during the initial roadmap.

**Reasoning:** Replacing these surfaces safely is a separate security project and is not required to replace the everyday visible shell.

## ADR-015: Default Chrome and resource exposure to zero

**Status:** Accepted for the initial manifest; runtime validation remains required in Phase 1

Reserve both project-owned namespaces, but initially register only `content my-firefox-shell ...` without `contentaccessible=yes`. Omit a `resource://my-firefox-shell/` alias until a dedicated review defines an exact inert/public file inventory and validates access from ordinary web content.

**Reasoning:** Mozilla's current Chrome Registration documentation says `contentaccessible=yes` explicitly exposes a content package to untrusted references and separately warns that web content is not prevented from including files at `resource:` aliases. A dedicated project name prevents namespace collision; it does not create a privilege boundary.

Privileged modules, source maps, debug artifacts, diagnostics, and private assets must not be placed in a resource alias. Any later alias or content-accessibility flag is a security-review trigger and must include the exact manifest lines, mapped file inventory, callers, content-context tests, and removal behavior.
