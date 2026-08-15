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

**Status:** Accepted and validated by Phase 1; package label superseded by
ADR-017; mapping policy amended by ADR-016

Reserve project-owned `chrome://my-firefox-shell/` and `resource://my-firefox-shell/` namespaces so privileged modules, UI assets, and styles do not depend on absolute file paths. Register only mappings with a concrete consumer and reviewed inventory.

Phase 1 validated Chrome package registration, immediate import, cache behavior, default content denial, and complete removal on Firefox 153.0.4. The initial manifest registers only the required Chrome content package.

The namespace literals above record the placeholder identity used by the
original Phase 1 experiment. ADR-017 changes the active package label to
`fennevia` without changing this resource-boundary decision.

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

**Status:** Superseded in part by ADR-016; package label superseded by ADR-017;
the minimal initial-manifest decision remains accepted

Reserve both project-owned namespaces, but initially register only `content my-firefox-shell ...` without `contentaccessible=yes`. Omit a `resource://my-firefox-shell/` alias until a dedicated review defines an exact inert/public file inventory and validates access from ordinary web content.

**Historical reasoning (superseded):** Mozilla's Chrome Registration documentation used during Phase 0.5 says `contentaccessible=yes` explicitly exposes a content package to untrusted references and separately warns that web content is not prevented from including files at `resource:` aliases. A dedicated project name prevents namespace collision; it does not create a privilege boundary.

Privileged modules, source maps, debug artifacts, diagnostics, and private assets must not be placed in a resource alias. Any later alias or content-accessibility flag is a security-review trigger and must include the exact manifest lines, mapped file inventory, callers, content-context tests, and removal behavior.

The statement above about default `resource:` access came from the older `build/docs/chrome-registration.rst` wording. Firefox 153's newer `toolkit/docs/internal-urls.md` and the Phase 1 runtime test establish the replacement policy in ADR-016; this historical reasoning is retained rather than silently rewritten.

## ADR-016: Follow Firefox's current internal-URL access model and omit unused mappings

**Status:** Accepted; active package label superseded by ADR-017

Firefox 153 treats both `chrome:` and `resource:` mappings as privileged-only by default. A manifest `contentaccessible=yes` flag deliberately hole-punches that boundary and exposes the mapped package to web content.

The Phase 1 manifest therefore contains only:

```text
content my-firefox-shell content/
```

It omits `resource`, `skin`, `locale`, `style`, `override`, and `contentaccessible=yes`. The resource alias is omitted because there is no Phase 1 consumer and the smallest registered surface is easiest to audit, not because a default resource mapping is content-accessible.

**Reasoning:** The supported Firefox 153 source revision `54be19de0e08edff0b797e55fd935dd3978b0a6d` documents the default restriction in `toolkit/docs/internal-urls.md`. An ordinary loopback HTTP page also failed to fetch the project Chrome entry in the real spike. Any later mapping requires a concrete consumer, exact file inventory, current-source review, ordinary-content access test, and removal test. `contentaccessible=yes` remains rejected without a dedicated security issue.

The manifest line above is the exact historical Phase 1 declaration. The
active equivalent after ADR-017 is `content fennevia content/`; declaration
semantics and exposure requirements are unchanged.

## ADR-017: Adopt the Fennevia project and package identity

**Status:** Accepted

Replace the provisional `my-firefox-shell` identity with **Fennevia** before
the installer makes paths and ownership records durable. Active project-owned
identifiers are:

```text
Fennevia
fennevia
chrome://fennevia/
resource://fennevia/        # reserved; still omitted until a real consumer
fennevia.safeStart
[Fennevia <subsystem>]
data-fennevia-*
```

The AutoConfig files are `defaults/pref/fennevia.js` and `fennevia.cfg`; the
profile package is `chrome/fennevia/`. Development-only profile state moves to
the separately marker-owned `%LOCALAPPDATA%\fennevia\profiles\fennevia-dev`
root.

**Reasoning:** The old name was an implementation placeholder. Selecting the
product identity before issue #4 avoids baking a temporary label into install,
update, ownership-manifest, and removal contracts. This changes names only:
the minimal AutoConfig chain, privileged boundary, fail-open behavior,
content-access policy, and omitted resource alias remain the same.

No dual Chrome namespace, preference alias, marker adoption, or automatic
deletion of the old development root is added. The project has no released
installer or supported user migration to preserve, and silently adopting or
removing a differently named profile would weaken ownership checks. Historical
Phase 1 literals remain in their research record and in the superseded portions
of these decisions.

## ADR-018: Use a manifest-driven dual-root transaction for package lifecycle

**Status:** Accepted

Stabilize the Phase 1 installable source at `program/` and
`profile/chrome/fennevia/`, with `package-manifest.json` as the sole versioned
path and SHA-256 inventory. Install identical ownership records below
`<PROGRAM>/.fennevia/` and `<PROFILE>/.fennevia/`; each record binds one
installation UUID, package version/state, source-manifest hash, exact files,
installed relative paths, and only the profile directories created by the
package action.

Every non-empty mutation uses marker-owned same-volume transaction roots. It
stages and verifies new bytes, backs up only ownership-proven existing files,
writes a relative-path/hash recovery journal, rechecks old hashes before
replacement, rolls back caught partial failure, and rejects later actions while
transaction residue exists. Hard disable moves the AutoConfig preference out of
the active `defaults/pref/*.js` set and therefore does not depend on a working
manifest or runtime entry. Startup-cache mutation remains evidence-driven and is
never part of normal file cleanup.

**Reasoning:** Installation spans a Firefox program and one explicitly selected
profile, so a single-root copy script cannot prove atomicity or safe removal.
Byte-identical records prevent either root from silently claiming a different
installation. Exact hashes distinguish owned content from same-name foreign or
manually changed files. Same-volume staging and journals make ordinary failure
rollback deterministic and interrupted-operation recovery inspectable without
recording absolute personal paths.

The installer never adopts arbitrary customizations, scans for generic scripts,
chooses a default/registered profile, recursively removes a Firefox, profile, or
general `chrome` parent, or clears arbitrary cache directories. The Windows-first
development workflow and its current copied-program support boundary are
documented in `docs/installation.md`.

## ADR-019: Manage browser windows at Firefox delayed startup with strict project-owned cleanup

**Status:** Accepted and validated on Firefox 153.0.4

Keep one process-global Fennevia runtime. Its `WindowManager` first registers
for `browser-delayed-startup-finished`, then enumerates already-existing
`navigator:browser` windows. It accepts only an open top-level chrome window
whose exact document is `chrome://browser/content/browser.xhtml`, exact root
`windowtype` is `navigator:browser`, and delayed-startup flag is true. A weak
identity set allows at most one initialization attempt per window.

Normal and private browser windows receive the same base lifecycle. Firefox's
`PrivateBrowsingUtils.isWindowPrivate()` performs classification before any
initializer runs. Every context has a process-local random UUID, an
`AbortSignal`, and a cleanup registry. Window unload and process-runtime stop
abort pending work and deterministically dispose all registered resources;
stop is idempotent. A late asynchronous initializer result is disposed
immediately and cannot revive a closed record.

**Reasoning:** Firefox 153 sets the delayed-startup flag, resolves its startup
promise, and then publishes the browser-specific observer topic. Firefox's own
`EveryWindow` module uses the same enumerator and readiness boundary. Registering
before enumeration closes the discovery race, while exact browser identity
checks avoid the generic dialog/document handling carried by customization
loaders. A project-owned manager is retained instead of importing
`EveryWindow` because Fennevia requires explicit runtime stop, cancellation,
privacy-safe window identity, initialization-failure rollback, and a future
host initializer contract.

This decision adds no generic script discovery, historical Firefox branches,
Svelte UI, host elements, native-UI hiding, Chrome Registry mapping, override,
runtime network behavior, or third-party dependency. The pinned research,
canary differences, automated tests, real normal/private-window matrix, and
fail-open injection are recorded in
`docs/research/firefox-153-window-lifecycle.md`.

## ADR-020: Attach three validated XHTML islands without taking native DOM ownership

**Status:** Accepted and validated on Firefox 153.0.4

For each managed normal or private browser window, create exactly three
project-owned XHTML hosts only after validating the exact `browser.xhtml`
document, namespaces, parents, and source-backed child order:

- a visible primary `section` as a direct `body` child immediately before
  `#browser`;
- a hidden sidebar `aside` immediately before `#tabbrowser-tabbox` under
  `#browser`;
- a hidden, inert, pointer-transparent overlay `div` immediately before
  `#a11y-announcement` under `body`.

Fennevia owns only each host and its descendants. It does not move, replace,
remove, reconcile, or hide the navigator toolbox, browser content, native
sidebar, tabbox, modal dialog, accessibility/fullscreen anchors, titlebar, or
window controls. The initial primary surface contains only normalized,
non-browsing diagnostic text. There is no Shadow DOM, framework mount, active
gate, or new Chrome Registry mapping in this decision.

Every host controller has explicit create, attach, detach, reattach, and
dispose transitions. Duplicate project IDs are treated as a collision rather
than adopted. Any missing or changed insertion point rolls back exact project
node references and emits an allowlisted DOM path plus Firefox version/build
before the existing outer bootstrap boundary fails open to native UI.

**Reasoning:** Firefox 153's stock document is XHTML with mixed XHTML/XUL
children. The native toolbox and browser are body siblings, while native
sidebar and tab content infrastructure remain children of `#browser`.
Dedicated XHTML islands preserve a strict future frontend ownership boundary;
placing the visible host between the toolbox and browser participates in the
existing body flex column without covering native titlebar controls or web
content. A hidden overlay cannot intercept prompts, and retaining Firefox's
native modal top layer preserves security UI.

The stock-DOM snapshot, current-source links, rejected placements, Browser
Toolbox Inspector evidence, privacy review, failure injection, and cleanup
matrix are recorded in `docs/research/firefox-153-shell-hosts.md`.

## ADR-021: Gate activation behind an explicit fail-open health lifecycle

**Status:** Accepted and validated on Firefox 153.0.4

Give each managed browser window one project-owned lifecycle with validated
`created`, `mounted`, `healthy`, `active`, `failed`, and `disposed` states. The
root markers are cumulative through `active`; `failed` is exclusive; disposal
removes every marker. Only `healthy -> active` is legal, and issue #7 deliberately
has no production caller that activates or hides native UI.

Health is bounded by a 2,000 ms deadline and requires exact host ownership and
placement, XHTML descendants, usable project CSS, a registered recovery
handler, declared capability success, and a literal successful health result.
Any exception, false/invalid result, timeout, illegal transition, missing CSS,
or missing capability clears the active marker before deterministic reverse
cleanup and emits a privacy-safe fixed phase/code with Firefox version, build
ID, and redacted stack.

Register `Ctrl+Alt+Shift+F12` directly on each privileged browser window with
capture and `mozSystemGroup`. Its synchronous fallback owns no Svelte, app, or
bridge dependency and disposes only that window's project lifecycle. Keep the
existing `fennevia.safeStart` AutoConfig preference and Firefox safe-mode check
ahead of manifest lookup, registration, and module import. Therefore safe start
works even when a runtime module is missing.

**Reasoning:** A CSS-only or frontend-owned escape path can fail with the shell
it is meant to recover. An explicit state machine makes activation auditable;
the early preference handles startup breakage, while the system-group key
handles a mounted or active runtime. Stock Firefox uses unmodified F12 for
DevTools and exposes user-customizable shortcuts, so the four-modifier binding
minimizes but cannot eliminate collision risk. Windows is the only tested
platform; other platforms require a separately sourced native-key test.

No dependency, manifest mapping, remote behavior, native DOM removal, loader
compatibility layer, or production failure-selection hook is added. Source and
runtime evidence, rejected loader baggage, failure matrix, and recovery
procedure are recorded in
`docs/research/firefox-153-shell-health-recovery.md`.

## ADR-022: Load one tree-fragment Svelte IIFE in each browser-window global

**Status:** Accepted and validated on Firefox 153.0.4

Compile the issue #8 smoke frontend from Svelte 5 and TypeScript with Vite
library mode into one fixed classic IIFE, one extracted component stylesheet
module, and one generated third-party notice. `WindowShell.sys.mjs` loads only
`chrome://fennevia/content/shell/ShellApp.js` synchronously into the owning
browser-window global with `Services.scriptloader.loadSubScript`. A temporary
non-enumerable registration callback accepts exactly one frozen three-function
frontend API, is deleted in `finally`, and the captured API is retained only in
a private `WeakMap` until official Svelte unmount.

Use Svelte's maintained `fragments: "tree"` compiler option. The default HTML
fragment strategy populated a template through `innerHTML`; in Firefox's
XML/XHTML `browser.xhtml` document, the resulting traversal reached a node from
the wrong DOM assumptions and failed at `Node.nextSibling`. Tree fragments
construct and clone DOM nodes directly and passed ordinary element,
`HTMLTemplateElement.content`, conditional-render, event, unmount, and remount
checks without a Svelte runtime patch.

Extract component CSS, convert it into a static local module, and attach it only
beside the project-owned mount target. Every authored selector remains rooted
under `#fennevia-shell-app-root`; no global reset or native selector is emitted.
Plain component CSS is sufficient for the spike, so Tailwind, Shadow DOM,
runtime stylesheet registration, and a component library are not adopted.

The build runs twice in isolated OS temporary directories and requires
byte-identical output before replacing the exact owned shell directory. It
disables source maps, HMR, module preloading, and code splitting; rejects
unexpected files and runtime endpoints; converts Svelte's fixed documentation
URLs to local error codes; and synchronizes generated hashes into the package
manifest. Missing, throwing, invalid, or incomplete frontend code fails before
`healthy`, removes partial project nodes/styles, and leaves all native Firefox
UI visible.

**Reasoning:** A shared privileged ESM global does not provide the target
window bindings expected by Svelte's browser runtime. Loading a fixed local
classic script into each validated browser-window global supplies those
bindings and naturally isolates Svelte state per window. This is a narrow
runtime adapter, not arbitrary script discovery, metadata parsing, a generic
loader, or a remote module mechanism. The exact dependency review, rejected
alternatives, first causal errors, source references, and real-Firefox matrix
are recorded in `docs/dependency-reviews/frontend-toolchain-2026-08-15.md` and
`docs/research/firefox-153-svelte-build.md`.

## ADR-023: Use one generated, context-scoped Firefox boundary per window

**Status:** Accepted and validated on Firefox 153.0.4

Keep the typed source boundary in `src/firefox/bridge-boundary.ts` and compile
it into one fixed private ESM,
`chrome://fennevia/content/firefox/BridgeBoundary.sys.mjs`.
`WindowShell.sys.mjs` creates one instance from the existing per-window
`WindowManager` context, retains it only in a private target-keyed record, and
disposes it through the same reverse lifecycle as the Svelte frontend and host.
The active context ID and native window are exclusive until disposal, so a
normal, second, or private window cannot reuse another window's bridge.

Probe the exact current symbols needed by the next tabs/navigation slices:
`window.gBrowser`, `gBrowser.tabs`, `gBrowser.tabContainer`, and
`gBrowser.selectedBrowser` are required;
`gBrowser.selectedBrowser.webNavigation` is an explicit optional presence
probe until navigation consumes and revalidates it. Required failure occurs
inside the #7 health check and produces a typed fixed-code error with phase,
symbol, Firefox version/build, and window kind. It removes all project state
while native UI remains visible. Optional absence does not fail or partially
activate a window.

Native handles remain private to context-scoped registries. Their opaque IDs
include a process-local registry generation, remain stable only while owned,
and distinguish malformed, stale, and cross-context use. Public snapshots and
diagnostics contain only primitives, fixed enums, counts, capability names, and
symbols. Every subscription and boundary-owned cleanup has an idempotent
disposer; disposal continues through the complete owned set before surfacing a
typed cleanup failure.

Enforce the other side of the boundary with ESLint: `src/shell/` and ordinary
`src/app/` modules cannot import `src/firefox/`, reference privileged Firefox
globals, or dereference known Firefox-owned global properties. No bridge value
is passed into Svelte in this issue. The module supplies only the foundation
needed by issues #10 and #12; it contains no tab UI, navigation UI, generic
service container, persistence, compatibility branch, global debug API, or
native-UI hiding.

**Reasoning:** Firefox documents `gBrowser` as one object per browser window,
and Firefox 153 constructs it before ordinary browser-window consumers while
its tab collection, event target, selected browser, and web-navigation surface
remain native objects. Capturing those objects inside one validated privileged
context localizes update risk and prevents the UI state model from acquiring
system-principal handles. A generated ESM keeps TypeScript as source of truth
and brings the bridge under the deterministic package gate without adding a
runtime dependency or new Chrome Registry exposure. Source, canary, failure,
cleanup, and real normal/second/private-window evidence is recorded in
`docs/research/firefox-153-bridge-boundary.md`.

## ADR-024: Reconcile immutable tab snapshots from `gBrowser.openTabs` events

**Status:** Accepted and validated on Firefox 153.0.4

Build one typed tabs controller inside each issue #9 boundary. Keep native tabs
only in that boundary's opaque registry and expose a frozen public contract with
ordered snapshots, subscriptions, and select/open-new-tab/close/pin/unpin
actions. A separate `src/app/tab-state.ts` adapter copies only primitive fields
into Svelte-independent reactive state; the #10 frontend renders only a count
diagnostic, leaving the visual tab strip to #11.

Use `gBrowser.openTabs`, not `gBrowser.tabs`, as the authoritative collection.
On `TabOpen`, `TabClose`, `TabSelect`, `TabMove`, `TabPinned`, `TabUnpinned`, or
a relevant `TabAttrModified`, synchronously rebuild the small complete snapshot
and publish only when it changed. IDs derive from native identity and registry
generation, never title, URL, or index. Closing IDs are released as soon as the
tab leaves `openTabs`; window disposal clears everything even when Firefox's
last-tab fast path emits no `TabClose`.

Bound titles to 256 characters and preserve them only as text. Expose an
optional favicon only for bounded Firefox-internal URLs or base64 raster data;
remote, SVG-data, malformed, and unknown image values use the no-favicon
fallback. `open()` accepts no URL and calls `addTrustedTab` only with the
window's `BROWSER_NEW_TAB_URL`. Native `removeTab` retains Firefox's unload and
last-tab decisions.

**Reasoning:** Firefox's `openTabs` already expresses the active logical order
and excludes closing/Firefox View tabs. Full reconciliation after a bounded
event set is easier to verify than composing fragile move/pin/selected-close
event details, while remaining event-driven and eliminating a privileged DOM
poll. A narrow data/action contract prevents Svelte from retaining
system-principal objects and leaves Firefox in control of navigation, unload
prompts, and last-window behavior.

Missing required tab collection/action/new-tab symbols fail before `healthy`.
No polling loop, arbitrary URL action, global debug surface, remote load,
native DOM ownership, compatibility branch, or tab-group abstraction is added.
Source, canary, security, failure, cleanup, and real three-window evidence is in
`docs/research/firefox-153-tabs-bridge.md`.

## ADR-025: Render the first tab strip as an owned accessible composite

**Status:** Accepted and validated on Firefox 153.0.4

Render one horizontal `tablist` from the immutable issue #10 snapshot. Each
ordered item has a primary `button[role="tab"]` plus sibling pin and close
buttons inside a presentational wrapper; interactive controls are never nested.
Exactly one primary tab participates in roving `tabindex`. Left/Right follows
computed text direction and wraps, Home/End selects an edge, Enter/Space
selects, and Delete closes. Firefox remains the source of selected state and
tab order. The custom component does not claim or link to a native tab panel,
because doing so would introduce a forbidden frontend dependency on Firefox DOM.

Keep pinned and regular tabs in the same native order. Pinned items use one
fixed compact width, regular items use bounded widths, and the project-owned
strip scrolls horizontally under pressure. Page titles are text with
`dir="auto"`, plaintext bidi isolation, ellipsis, a bounded accessible name,
and an untitled fallback. An allowlisted favicon is assigned only to an image
`src` property over a static fallback; a load error hides the image and removes
its source. No title or favicon enters HTML, CSS interpolation, a dataset, a
log, persistence, or an error.

Use root-level `focusin`/`focusout` delegation instead of one direct focus
listener per tab. Closing chooses the next native-order tab or the previous
one, focuses it after Svelte flush, and performs one 200 ms retry after
Firefox's close animation can move focus. The retry is replaced by every new
action and cleared on unmount, so there is at most one owned timer. Official
unmount/remount instrumentation verifies zero outstanding listeners,
subscriptions, timers, descendants, or reused state.

Pass fresh boundary-local mutable option records into `addTrustedTab` and
`removeTab`; continue freezing every public snapshot and contract. Firefox
153's `addTrustedTab` assigns `options.triggeringPrincipal` before delegating,
so freezing a native-call option record caused the first real new-tab action to
fail. A native-mutation regression fixture now proves those temporary records
remain writable without exposing them across the bridge.

**Reasoning:** The WAI-ARIA tabs and tabs-with-actions patterns provide the
smallest keyboard and semantic model compatible with a browser tab strip,
while sibling actions avoid invalid markup and accidental selection. Plain
root-scoped Svelte CSS and platform controls satisfy layout, forced-colors,
focus, bidi, and overflow requirements without a component dependency or a
native tab override. Native Firefox tabs stay visible and unchanged, so this
issue does not enter the activation or native-hide phase. Sources, rejected
alternatives, security effects, first causal errors, and the complete runtime
matrix are recorded in `docs/research/firefox-153-tab-strip.md`.
