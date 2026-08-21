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

**Status:** Accepted; first-paint pending hide added by ADR-050

Set the durable active state only after frontend mount and required capability
checks succeed. CSS hides native visible UI for the rest of the session only
while active. A process-scoped, self-expiring startup sheet may collapse the
same surfaces before `active` so first paint does not show the native toolbox;
that sheet yields immediately to `failed`, `suspended`, emergency fallback, and
the 2,000 ms health deadline. Failure leaves native UI usable.

**Reasoning:** Firefox code may continue to rely on native elements, and the
retained DOM provides a recovery path. Showing native chrome until health
completes caused a first-paint flash; ADR-050 removes that flash without
deleting native DOM or making a dead runtime fail closed.

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

**Status:** Accepted; pending-hide fail-open path extended by ADR-050

Unknown, timeout, partial, or failed states do not keep a durable native-UI
hide. The startup hide sheet self-expires at the health deadline and is
unregistered when the process runtime stops or fails to start. Emergency
fallback and safe start remain release gates rather than optional convenience
features.

**Reasoning:** The project modifies the primary browser control surface with
system-principal code. A closed failure mode could make recovery impractical.

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

**Status:** Superseded by ADR-026 for the production host shape; retained as
validated historical evidence for the initial three-island spike

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

ADR-026 supersedes only the original one-root/primary-host mounting shape. The
tree-fragment IIFE, one-shot registration, extracted local CSS, and official
mount/unmount decisions remain current for four independent roots.

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
`WindowManager` context, retains it only in a private frame-keyed record, and
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

**Status:** Accepted for the data/action/accessibility contract; ADR-026
supersedes its horizontal geometry with a vertical left-edge presentation

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

## ADR-026: Use one zero-layout frame with four independently owned edge surfaces

**Status:** Accepted and validated on Firefox 153.0.4; default color values
amended by ADR-051 and interaction defaults made user-configurable by ADR-054

Insert one project-owned XHTML frame as an absolute child of `#browser`
immediately before `#tabbrowser-tabbox`. The frame reserves no layout space and
contains ordered top, left, right, and bottom XHTML hosts. Each host owns one
empty mount target, one Svelte root, one accessible region, one trigger, one
state controller, and one deterministic disposer. Generated CSS is a separate
frame child and cannot change edge-host ordering. Any missing target, partial
attachment, mount, CSS, controller, or health failure disposes the complete
frame through the ADR-021 fail-open lifecycle.

Keep reveal policy in the framework-independent `src/app/edge-surfaces.ts`
contract. Pointer, focus, keyboard, popup, and bounded programmatic holds are
explicit; there is one anti-flicker hide timer per edge and no polling. Its
normal in-window default is 300 ms. ADR-054 may rearm that same timer with a
validated profile-local delay, including a distinct 800 ms default after the
pointer leaves the browser window; it does not add another timer. Pointer
reveal is exclusive, while legitimate non-pointer holds may keep multiple
surfaces visible. Side edges own exact corners. Features call the controller
API and must not manipulate visibility classes, attributes, or timers directly.

Expose keyboard access through exact
`Ctrl+Alt+Shift+ArrowUp|Left|Right|Down` commands. A keyboard reveal moves focus
to a named owned control, holds visibility while focus remains, lets `Escape`
dismiss unless a popup has priority, and restores the originating HTML or XUL
control. A bounded focus-transfer guard covers native tab-close animation;
disposal clears it. Future `Ctrl+L` routing remains issue #13.

Suspend all four surfaces during customize mode, DOM fullscreen, and native
window/tab-modal state. Continue in browser fullscreen because the frame tracks
the current `#browser` geometry and never owns OS controls. Observe only the
current source-backed root attributes and `tabDialogShowing`; do not add a
second window manager, continuous DOM scan, or periodic timer.

Use one plain extracted stylesheet rooted at
`#fennevia-shell-frame-host`. Project-owned tokens define surface/tint, text,
border, blur/saturation, radius, elevation, inset/trigger, dimensions, spacing,
density, motion, focus, and selected state. A near-solid base is valid without
backdrop filtering; reduced transparency removes blur, reduced motion removes
translation, and forced colors uses system colors. Top, side, and bottom
geometry differs by function, with shared clearances preventing overlap. No
Tailwind, component library, Shadow DOM, runtime stylesheet fetch, or native
selector is introduced.

The design concepts were independently derived after inspecting only the
license, README, and selected CSS reference files at
[`yutinglia/my-firefox-custom@7a02f60bb23abe9c191c7fd8cd2a7096bb63aee5`](https://github.com/yutinglia/my-firefox-custom/tree/7a02f60bb23abe9c191c7fd8cd2a7096bb63aee5).
No `.uc.js`, handler structure, timer, flag, selector, ID, class, token name,
numeric value, module layout, native-DOM strategy, or loader assumption was
copied or adapted.

**Reasoning:** Firefox 153 makes `#browser` a relative containing block and
keeps `#tabbrowser-tabbox`, browser stacks, dialogs, DevTools, and content under
Firefox ownership. One zero-layout frame is the smallest owned coordination
boundary that can float over content without resizing or reconciling native
children. Independent hosts preserve feature/lifecycle isolation; a shared
controller and token system prevent each feature from inventing conflicting
edge policy. Native UI remains visible and production still stops at
`healthy`, so issue #15 retains sole ownership of native hiding.

ADR-026 supersedes ADR-020's production three-host layout, ADR-022's original
single-root mount shape, and only ADR-025's horizontal presentation. It retains
their namespace, build, bridge, tab-state, accessibility, safety, and cleanup
decisions. Source evidence, rejected alternatives, visual-reference provenance,
security effects, first causal failures, and real validation are in
`docs/research/firefox-153-four-edge-shell.md`.

## ADR-027: Mirror native command state and invoke current `BrowserCommands` for navigation

**Status:** Accepted and validated on Firefox 153.0.4

Create one selected-navigation controller per issue #9 window boundary. Expose
only an immutable ordinary snapshot containing `canGoBack`, `canGoForward`,
`loading`, bounded display URI, and bounded title, plus explicit Back, Forward,
Reload, Stop, Reload-or-Stop, and New Tab actions. A separate application
adapter validates and copies those fields before Svelte renders the issue #31
top surface.

Treat Firefox's retained `Browser:Back`, `Browser:Forward`, `Browser:Reload`,
and `Browser:Stop` command `disabled` attributes as the native enabled/loading
truth. Invoke the current owning window's `BrowserCommands.back`, `forward`,
`reload`, `stop`, and `openTab` methods rather than recreating history,
reload/cache, stop, principal, observer, new-tab, or telemetry policy. Resolve
the selected browser and command again inside every action so a tab switch
cannot target a captured prior browser.

Reconcile state from selected/top-level `addTabsProgressListener` location and
network-state callbacks, `TabSelect`, relevant selected `TabAttrModified`
notifications, and one scoped `MutationObserver` over the five retained command
elements. Ignore background/non-top-level progress and equal snapshots. Pair
every tab listener, progress listener, command observer, application
subscription, and Svelte adapter with deterministic per-window cleanup; use no
polling or process-global browsing state.

Bound title to 256 characters and display URI to 2,048 characters. They may
exist only as text in the owning window's memory and top status output. They do
not enter logs, errors, datasets, persistence, another window, HTML/CSS
interpolation, or network traffic. Current title/URI are convenience status,
not replacement security indicators; Firefox's native Urlbar, identity,
permission, and prompt surfaces remain visible and authoritative.

Every selected-browser, URI, event, progress, observer, command-element, and
`BrowserCommands` dependency is required and independently identified by a
fixed symbol. Missing startup capabilities fail before `healthy`; a later
event, action, or subscriber failure requests ADR-021 fail-open and retains the
native navbar. The top UI consumes ADR-026's existing host, trigger, focus,
keyboard, hide timer, glass tokens, collision rules, environment suspension,
and disposer. It adds no editable address field, menu placeholder, native DOM
ownership, native-hide rule, dependency, mapping, or override.

**Reasoning:** Firefox already synchronizes its visible controls through
command state and centralizes current navigation semantics in
`BrowserCommands`. Consuming those two boundaries produces exact native/custom
agreement while keeping policy and privileged handles out of application UI.
The selected event set covers location, redirects, same-document changes,
error pages, title, loading, command state, and selected-browser handoff without
a continuous DOM poll. Source, canary, failure, cleanup, privacy, and real
normal/second/private-window evidence is recorded in
`docs/research/firefox-153-navigation-controls.md`.

## ADR-028: Use a compact address/status launcher and one centered owned popup

**Status:** Accepted and validated on Firefox 153.0.4

Keep the left edge compact: above the vertical tab list, render one
non-editable launcher containing bounded committed location text plus concise
connection/HTTPS and Enhanced Tracking Protection labels derived from current
Firefox state. Put the sole custom editable address field and fuller versions
of those two status rows in one centered, nonmodal Fennevia popup.

Extend ADR-026's shared frame with one final project-owned XHTML
address-overlay host, target, and Svelte root. The four edge hosts remain in
their established order and retain one controller. The fifth root owns only
the popup; it is hidden and pointer-inert at rest. While popup state has
priority, the shared edge controller suppresses all four surfaces. Mount,
health, unmount/remount, fail-open rollback, and disposal treat all five roots
as one complete per-window shell. No node is mounted into a Firefox popup set
or native container.

Extend ADR-027's one navigation controller instead of creating another native
navigation owner. The public immutable snapshot adds bounded committed address
text and fixed connection/protection enums. The controller reads a committed
native Urlbar value only when `pageproxystate` is valid, otherwise the selected
URI; initial blank/home/private locations remain visually empty. It reconciles
selected top-level location, network, security, content-blocking, tab, and
command events without polling or mirroring an uncommitted native draft.

The popup owns one independent per-window draft, limited to 4,096 characters.
Empty, over-limit, `data:`, `javascript:`, and `vbscript:` input is rejected
before native access. For accepted text, write the current native
`gURLBar.value` and invoke `gURLBar.handleCommand()`. Firefox therefore keeps
URL fixup, ordinary search, principal, load/disposition, observer, and
telemetry behavior. Do not introduce a general `loadURI` helper or pass a URL
to a project action outside this validated path.

Healthy-shell `Ctrl+L` asks the popup subscriber to open, focus, and select.
Cancel the retained `Browser:OpenLocation` event only when that request is
accepted. In inactive, failed, safe-started, unsupported, or disposed state—or
if focus/open fails—the native event continues to Firefox. Selected-tab change
closes/discards the draft; background same-tab navigation cannot overwrite an
active draft; accepted navigation confirmation closes the popup. Escape,
backdrop, and focus-boundary close restore a still-valid prior focus target or
the current selected content browser.

Map only current fixed values from
`gIdentityHandler.getConnectionSecurityInformation()` and current coherent
`gProtectionsHandler`/`ContentBlockingAllowList` state into ordinary enums.
Unknown, transient, or non-handleable state is explicitly `unavailable`.
Compact and detailed labels consume the same mapping. Do not infer HTTPS or
protection from URL text, expose certificate/permission data, or draw a fake
security claim.

Firefox's native Urlbar, identity and protections panels, permissions, page
actions, prompts, and navbar remain attached, visible, and authoritative.
Issue #37 owns a separate reviewed inventory for fuller permissions/page-action
coverage before issue #15 may hide related native UI.

**Reasoning:** The compact launcher preserves space for vertical tabs while a
centered popup provides a focused editing surface and room for honest status
details. Delegating submission and command fallback to the retained Urlbar
keeps unstable policy in Firefox. Fixed source-derived enums give the user the
requested side-level HTTPS/protection awareness without claiming to replace
security-sensitive native panels. One additional owned root is smaller and
safer than moving native DOM, mounting inside Firefox popup infrastructure, or
building a parallel Urlbar provider stack. Source pins, product-reference
provenance, first causal failures, rejected alternatives, privacy review, and
normal/second/private/Browser-Toolbox evidence are recorded in
`docs/research/firefox-153-address-popup.md`.

## ADR-029: Use per-window opaque Places views with bounded lazy bookmark pages

**Status:** Accepted and validated on Firefox 153.0.4. The four-root data,
bounded pages, and nested-list contract remain; root chrome is a native
`select` rather than a `tablist`.

Create one bookmarks controller inside each ADR-023 window boundary. Firefox's
profile Places database remains shared according to native policy, but every
Fennevia handle registry, observer subscription, selected root, loaded page,
expanded-folder set, focus position, and disposer belongs to one normal or
private browser window. Do not introduce a process-global bookmark mirror or
persist project bookmark UI state.

Load only the fixed `PlacesUtils` and `PlacesUIUtils` module URIs used by the
current Firefox browser frontend. Present the four current
`Bookmarks.userContentRoots` in native order with `getLocalizedTitle()`. For a
loaded branch, fetch its parent once and then fetch no more than 32 child
positions through `Bookmarks.fetch({ parentGuid, index })`. Keep only the
current page for that branch, cap offsets at 1,000,000, visible depth at 8, and
simultaneously expanded folders at 20. Collapse discards all owned descendant
pages. Do not use `fetchTree()`, which is explicitly unimplemented in Firefox
153, or an unbounded recursive query.

Translate only folder, bookmark, and separator type, a title of at most 160
Unicode code points, `hasChildren`, and a context-bound opaque ID into ordinary
immutable state. Keep Places records, GUIDs, URLs, native node-like objects,
services, observers, and windows private. Svelte receives no URL or user-data
identifier and stores none in a DOM attribute. Render title values through text
bindings and use project-owned type glyphs; remote favicon and metadata loading
remain out of scope.

Register one exact `PlacesUtils.observers` listener for bookmark added,
removed, moved, title-changed, and URL-changed events. Reorder is covered by
Firefox's moved notifications. Convert only already-registered affected parent
GUIDs to opaque IDs, include both old and new parents for a move, and refresh
only loaded branches. Coalesce application refreshes by microtask. Collapse an
event batch over 128 records or more than 16 affected parents to one bounded
all-scope refresh signal. Use no timer or continuous polling. Malformed observer
data requests the existing fail-open path; the exact listener/event array is
removed during idempotent disposal.

For opening, resolve the current opaque ID and re-fetch the bookmark at action
time. Reject stale/foreign IDs, folders, separators, and `javascript:`, `data:`,
`vbscript:`, or `place:` schemes before native opening. Convert the current
record with `PlacesUIUtils.promiseNodeLikeFromFetchInfo()` and delegate to
`PlacesUIUtils.openNodeIn()` with `current` or `tab`, the owning window, and its
private kind. Firefox therefore retains URL security checks,
`openTrustedLinkIn()` principal and popup policy, bookmark transition data,
background-tab preference, and private targeting. Ordinary HTTP(S), internal,
file, and other non-blocked schemes remain subject to Firefox's native checks.

Render the right surface as a four-root tablist followed by one ordinary nested
list rather than an ARIA tree. Root Left/Right/Home/End behavior and item
Up/Down/Home/End, folder Left/Right, Enter/Space, Ctrl/Command+Enter, middle
click, and explicit new-tab behavior are implemented directly and tested in
Firefox chrome. Separators do not enter roving focus. Stable opaque keys retain
focus through title/URL/reorder updates; removing the focused item selects the
nearest surviving action or the selected root. Loading, empty, paged, stale,
unavailable, and error output remains text-accessible.

Consume ADR-026's existing right host, reveal/focus controller, one anti-flicker
timer, corner arbitration, collision bounds, glass tokens, environment
suspension, and disposer. The panel adds no second edge trigger, timer, z-index
system, popup owner, native sidebar mutation, or native-hide selector. Initial
roots and first-page readiness are health-gated, and missing Places/query/open
capability follows ADR-021 fail-open while Firefox's native toolbar, sidebar,
Library, bookmark dialogs, and `Ctrl+D` remain attached and visible.

**Reasoning:** A per-window view aligns native object ownership with the
existing boundary and prevents normal/private UI state leakage, while Firefox
continues to own the shared profile database. Indexed pages bound privileged
work without assuming a small profile. The simpler list pattern gives reliable
keyboard and chrome accessibility without pretending a paged partial tree is a
complete ARIA tree. Native `PlacesUIUtils` opening preserves more Firefox
security and preference policy than a custom `loadURI` shortcut.

The capability reference
`yutinglia/my-firefox-custom@7a02f60bb23abe9c191c7fd8cd2a7096bb63aee5`
was inspected only for the broad goal of compact right-edge bookmark access.
Its repository `LICENSE` states MIT for the author's original work, while the
GitHub API reports `NOASSERTION`; regardless, its source, DOM strategy,
selectors, timers, CSS values, dimensions, icons, drag-and-drop code, and
visual composition were not copied or adapted.
Current source pins, canary review, alternatives, security analysis, first
causal failure, and real normal/second/private-window evidence are recorded in
`docs/research/firefox-153-bookmarks-surface.md`.

## ADR-030: Use per-window Downloads list views and anonymous bounded status

**Status:** Accepted and validated on Firefox 153.0.4

Create one Downloads controller inside each ADR-023 window boundary. A normal
window subscribes to Firefox's `Downloads.PUBLIC` list and a private window to
`Downloads.PRIVATE`. Windows of the same kind continue to observe Firefox's
shared native list according to its current policy, but every Fennevia view,
opaque-handle registry, subscriber set, application adapter, and disposer is
owned independently by one window. Do not introduce a process-global mirror.

Import only the fixed `resource://gre/modules/Downloads.sys.mjs` URI. Require
`Downloads`, `getList()`, the selected list constant, and the returned
`DownloadList.addView()`/`removeView()` pair before health. Register exactly one
view. Consume its synchronous initial replay and added, changed, removed, and
batch callbacks; pair it with exact idempotent removal. There is no polling
fallback, download-triggered edge reveal, timer, or persisted history.

Classify current native fields in Firefox's current `DownloadsCommon` order:
running, succeeded, failed, paused when canceled with partial data, canceled,
then queued. Ignore terminal records present during the initial list replay so
old download history does not appear as new activity. Retain at most three
terminal records first observed by this controller, until native removal or
displacement by newer terminal records. Active, paused, and queued records
remain while Firefox keeps them in the selected list.

Translate only a context-bound opaque ID, fixed state enum, and optional
integer percentage. Expose at most six anonymous item summaries and cap every
state count at 999 with explicit overflow/truncation flags. Native download
objects, source/referrer URLs, target paths, filenames, principals, headers,
cookies, private markers, and per-item byte counts never cross `src/firefox/`,
enter DOM attributes, persistence, or diagnostics.

Aggregate all active known-size transfers by positive total bytes. If every
active transfer reports progress but none has a positive total, average their
reported percentages. If any active transfer lacks progress, expose an
explicit indeterminate state and no percentage. Zero-total records carry no
weight when positive byte totals exist. Clamp and floor the final result to an
integer from zero through 100.

Render the result in ADR-026's existing bottom host as a compact, read-only
Svelte status panel. It uses the shared edge trigger, keyboard/focus reveal,
collision policy, glass tokens, environment suspension, and disposer. The
panel adds no host, trigger, z-index system, feature timer, content padding, or
file action. Determinate progress uses native progressbar semantics;
indeterminate output has no false `aria-valuenow` and no continuous animation.
Updates received while hidden do not alter shared reveal state.

Firefox's native Downloads button/panel, notifications, file picker,
reputation, malware and executable warnings, permission/confirmation flows,
history, and all pause/resume/cancel/retry/open/reveal/delete actions remain
attached, visible, and authoritative. Missing module/list/view capability,
malformed records, subscriber failure, or initial readiness failure follows
ADR-021 fail-open and retains those native paths.

**Reasoning:** Firefox already owns download isolation, lifecycle state,
notifications, safety policy, and management. Its list-view contract provides
the required event stream and paired cleanup without a polling loop. Anonymous
bounded status is enough for the bottom-edge product goal and avoids creating a
second sensitive download manager or exposing filenames and paths merely for
decoration. Per-window view ownership aligns cleanup and failure with the
existing boundary while preserving Firefox's normal/private list semantics.

The capability reference
`yutinglia/my-firefox-custom@7a02f60bb23abe9c191c7fd8cd2a7096bb63aee5`
was inspected only for the broad goal of aggregate bottom-edge progress. Its
GitHub license metadata reports `NOASSERTION`; no controller, polling loop,
observer combination, DOM, selector, class, timer, value, CSS, gradient,
animation, text, or visual composition was copied or adapted. Current source
pins, canary review, privacy analysis, rejected alternatives, and real
normal/second/private/Browser-Toolbox/fail-open evidence are recorded in
`docs/research/firefox-153-downloads-surface.md`.

## ADR-031: Represent fixed Urlbar coverage and retain Firefox's complete native path

**Status:** Accepted and validated on Firefox 153.0.4

Keep ADR-028's left address launcher compact: it continues to show only bounded
committed location plus Firefox-derived connection/HTTPS and Enhanced Tracking
Protection badges. Put richer site information in the existing centered popup,
not in another edge host, toolbar, overlay, or editable field.

Create one `urlbar-coverage` controller inside each ADR-023 window boundary.
Read only owner-set attributes and child presence from the current document
root, `gURLBar`, `identity-permission-box`, `blocked-permissions-container`, and
`page-action-buttons`. Require those owner roots, `MutationObserver`, and
`window.openLocation` before health. One observer watches four roots and is
paired with exact deterministic disconnection; there is no timer, polling
fallback, process-global state, or native-DOM mutation.

Expose only fixed sharing, blocked-permission, and Urlbar-item enums plus
booleans. Dynamic extension actions collapse to one generic presence enum;
unknown native page actions collapse to one generic presence enum. URLs,
origins, principals, certificates, permission records/scopes, extension IDs or
names, action IDs, localized Firefox labels, provider results, browser/window
objects, and native nodes never cross the bridge.

Render connection, protection, and permission cards plus applicable fixed
Firefox-control labels in the centered popup. These labels report current
Firefox-owned availability; they are not replacement commands. Identity,
certificate, trust, protections, permission, translation, bookmark, extension,
and page-action panels and all security-sensitive mutations remain native.

Provide one explicit native handoff. It first closes the project popup without
restoring focus over Firefox, then invokes the owning window's current
`openLocation()`. Firefox owns Urlbar selection, view opening, suggestions,
providers, search one-offs, extension actions, panel routing, prompts, and
commands. Missing capability, observer or subscriber failure, malformed state,
component failure, or handoff failure follows ADR-021 and leaves native chrome
usable.

**Reasoning:** Firefox's Urlbar combines status, prompts, providers, dynamic
extension actions, and security-sensitive panels whose contracts and content
cannot safely be recreated from visual markup. A bounded read-only summary
meets the compact/detailed product split while native handoff preserves complete
behavior and future unknown items. Fixed enums prevent sensitive values and
native handles from entering Svelte, and one event-driven observer aligns
lifecycle and failure with the existing per-window bridge.

Issue #15 may hide the navbar only if the handoff temporarily reveals and
focuses the native Urlbar and every retained panel/prompt remains reachable. A
failure must synchronously retain or restore it. The complete source inventory,
privacy classification, compatibility-canary review, normal/second/private
evidence, HTTP/HTTPS/internal/error/permission/protection matrix, and fail-open
proof are recorded in
`docs/research/firefox-153-urlbar-coverage.md`.

## ADR-032: Activate exact reversible native surfaces with retained native reveal

**Status:** Accepted and validated on Firefox 153.0.4;
Fennevia-initiated host-anchored popup reveal carved by ADR-042;
first-paint pending hide added by ADR-050 without moving this gate

After every ADR-021 health and required-capability check succeeds, the fixed
production initializer performs the explicit `healthy -> active` transition.
One per-window `NativeUi.sys.mjs` controller owns an exact Firefox 153 target
inventory, one project-owned five-rule stylesheet, reveal/suspension state,
and deterministic cleanup. No preference or debug switch can activate a
partially healthy production shell.

In horizontal native-tab mode, collapse only
`#TabsToolbar > .toolbar-items`, `#nav-bar`, `#PersonalToolbar`, and the exact
native sidebar container/box/splitters. Keep `#TabsToolbar` itself so Firefox's
current titlebar controls remain. When Firefox sets `tabs-hidden`, retain the
navbar titlebar owner and collapse only its exact direct content children.
Never target `#navigator-toolbox`, `#notifications-toolbar`, titlebar buttons,
popup sets, tabbox/content infrastructure, find UI, prompts, dialogs, or
DevTools.

Every hiding selector requires `data-fennevia-active` and the absence of both
native reveal and suspension markers. Native toolbox pointer/focus, a
toolbox-anchored Firefox doorhanger, an open unsupported native sidebar, or
ADR-031's Urlbar handoff reveals the complete retained native surface. The
Urlbar bridge must request reveal synchronously before `window.openLocation()`.
Returning focus to content and closing native popups releases the reveal after
one short owned delay. ADR-042 carves Fennevia-initiated Trust, permission,
Downloads, Unified Extensions, and application-menu panels whose `anchorNode`
is inside the project frame or whose id is listed by a short-lived NativeUi
handoff token; those panels do not set `data-fennevia-native-ui-revealed`.

Customize mode suspends through Firefox's `aftercustomization` event and hides
the project frame. Native dialogs also suspend. DOM fullscreen suspends project
hiding while Firefox's own fullscreen stylesheet remains authoritative, so
project code cannot reveal chrome against the page fullscreen policy. Browser
fullscreen retains active mode and Firefox's native autohide behavior.
Unsupported popup/taskbar/AI/hidden-toolbar windows fail open before activation.

Require exact native nodes, namespaces, direct parents, three current titlebar
control groups, style identity/text/parent, and exactly five parsed rules.
Style or stable target corruption first applies fail-open suspension and then
requests ADR-021 per-window disposal. Structural checks are coalesced to the
next event-loop turn so Firefox window teardown can dispose without a false
runtime failure; style mutation remains immediate. Clearing active alone
restores native layout without Svelte, restart, or stylesheet reload.

**Reasoning:** The broad toolbox owns irreplaceable notifications, platform
controls, and mode-specific layout. Exact reversible descendants achieve the
content-first resting state while preserving Firefox ownership and one complete
native access path for unknown extension, security, and future controls. A
single privileged controller concentrates unsupported dependencies and makes
version drift fail visible instead of leaving a half-hidden browser.

ADR-032 activates the production caller that ADR-021 intentionally withheld;
it does not weaken ADR-021's transition or recovery requirements. It fulfills
ADR-031's native-handoff precondition and supersedes only older statements that
package `0.10.0-dev` stops at healthy or contains no native-hide selector. The
source inventory, rejected alternatives, provenance, and real
normal/second/private/customize/fullscreen/Browser-Toolbox/fail-open evidence
are in `docs/research/firefox-153-content-only-activation.md`.

## ADR-033: Repair only a completely absent ownership side from exact surviving proof

**Status:** Accepted and validated in PowerShell 7 and Windows PowerShell 5.1

Keep the byte-identical dual-root ownership pair as the normal invariant. When
exactly one valid side survives a Firefox replacement or interrupted external
operation, expose a separate `Repair` action instead of weakening `Update` or
silently copying metadata. Every ordinary action continues to reject an
incomplete pair.

Repair is permitted only for the marker-owned development profile, one valid
survivor whose own-scope files still match, and a supplied package that
regenerates the complete survivor content byte-for-byte. The missing side's
metadata directory, owned file set, alternate enabled/disabled preference, and
profile package must be wholly absent. Any partial residue, foreign AutoConfig,
source mismatch, unexplained directory requirement, modified survivor, or both-
absent state fails before mutation. A successful plan creates only missing-side
paths and the original ownership bytes through the existing reviewed dual-root
transaction, plan digest, failure rollback, and residue cleanup.

**Reasoning:** A stock Firefox update may replace program files while leaving
the marker-owned profile package intact. Requiring a clean reinstall would lose
useful exact proof, while accepting a one-sided manifest as general authority
would let stale or planted metadata adopt files. The narrow reconstruction
preserves fail-closed ownership and provides a reproducible recovery path. The
complete operator contract and failure codes are in `docs/installation.md`.

## ADR-034: Collect only aggregate Firefox resource evidence in the test harness

**Status:** Accepted for test-only Firefox 153.0.4 evidence

The real-Firefox harness may call the privileged, unsupported
`ChromeUtils.requestProcInfo()` only in the explicit `--performance-baseline`
mode. The collector immediately reduces the parent and child process records to
numeric process count, committed memory bytes, CPU time nanoseconds, and CPU
cycles. It never serializes or returns process IDs, origins, windows, document
URIs/titles, threads, utility actors, or native records. Production runtime and
Svelte code do not import or call this API.

The baseline separately records harness-observed spawn-to-active time, a five-
second hidden-surface idle delta, four-edge reveal p50/p95/max, and memory/CPU
before and after five complete normal-window lifecycle cycles. Results are local
diagnostic evidence with repeatable investigation thresholds, not a synthetic
CI score or telemetry sink.

**Reasoning:** Firefox 153's pinned
`dom/chrome-webidl/ChromeUtils.webidl` defines process memory in bytes and CPU
time in nanoseconds, but the same dictionaries can contain browsing-derived
origins and window URI/title data. Immediate fixed-field aggregation detects
obvious regressions without expanding Fennevia's runtime data surface or shared
logs. The method and thresholds are in `docs/firefox-update-workflow.md`.

## ADR-035: Rehearse SessionStore persistence only with fixed test-owned state

**Status:** Accepted for test-only Firefox 153.0.4 evidence

Fennevia does not add a production session store, workspace schema, or restore
hook. The explicit `--session-restore` harness mode may use Firefox's test-only
`SessionStore.setBrowserState()` entry point to create four fixed local data-URL
tabs, then must cross the real persistence boundary through a normal Firefox
shutdown. A later process verifies native tab order, selected and pinned state,
and the exact lazy pending set before any pending tab is selected. The frontend
must report the same fixed tab identities through its ordinary tabs bridge.

The rehearsal is a four-phase transaction: prepare, verify, fail-open, and
cleanup. A profile-local marker stores only a schema version and the prior
user-value state of seven fixed SessionStore preferences. An existing marker
blocks a new prepare run. Failure injection removes exactly the installed
frontend bundle after validating its package hash, verifies that the restored
native session remains usable, and restores the exact bytes in `finally`.
Cleanup replaces the fixture with one `about:blank` tab, restores each prior
preference state, performs another normal shutdown, and removes the marker only
after that process exits.

Shared evidence is restricted to fixed fixture IDs, enums, booleans, and
counts. It must never contain a URL, title, query, raw SessionStore object,
profile/program path, native tab/browser object, or private-window state.

**Reasoning:** Re-mounting the shell in one process proves lifecycle behavior
but not Firefox's disk-backed session boundary or lazy restore semantics. A
fixed, marker-owned rehearsal exercises the stock implementation without
creating production persistence, force-loading pending tabs, or exposing real
browsing state. Source pins, interruption recovery, and real Windows evidence
are recorded in
`docs/research/firefox-153-session-restore-rehearsal.md`.

## ADR-036: Publish exact prerelease trees and opt in to registered-profile installation

**Status:** Accepted for Fennevia 0.10.0-beta.1 on Windows x64; the exact
Firefox version/BuildID install gate is superseded by ADR-048

Use `package.json` as the canonical release version and accept only stable
`MAJOR.MINOR.PATCH` or numbered `alpha`, `beta`, and `rc` prereleases. The exact
annotated tag is `v<VERSION>` and must resolve to the complete source commit
recorded in the release. A release consists of one
`fennevia-<VERSION>-windows.zip` plus its `.sha256` file; ordinary installation
does not require Node.js or npm.

Stage only the 14 manifest-owned install bytes, package manifest, installer,
release validator, privileged-artifact scanner, verification wrapper,
installation guide, MPL-2.0 license, and third-party notices. Generate a strict
`RELEASE-MANIFEST.json` with source/tag/archive identity, package-manifest hash,
platform, exact Firefox compatibility records, known limitations, and every
other tree file's size and SHA-256. The manifest excludes itself to avoid a
recursive hash. Reject any extra/missing/changed/reparse/credential-like file
and high-confidence secret or local-machine-path content.

Create ZIP entries in fixed sorted order beneath one versioned root, with no
explicit directory entries, no compression, and the fixed 1980-01-01 ZIP
timestamp. A clean-tree preflight installs exact dependencies without lifecycle
scripts, runs the complete repository verification, stages twice, compares
manifest and ZIP bytes, verifies the checksum, and validates a Unicode/space
extraction. Publication is tag-only or an explicitly authorized manual run. It
reruns preflight, creates a draft with exactly the ZIP and checksum, compares
GitHub's reported SHA-256 digests before making the draft public, then
downloads and compares both assets. Failed drafts are inspected and explicitly
deleted rather than reused; changed public bytes require a new version/tag.

Keep Development as the installer's default profile mode. Add explicit
Registered mode that validates only the operator-supplied profile against
Firefox's registration files; it never chooses a profile. Existing valid
ownership remains sufficient for cleanup and one-sided repair if registration
is later lost. When a release manifest is present, Install, Update, Repair, and
Enable require an exact Firefox version and BuildID allowlist match. Enable also
requires ownership's exact package-manifest hash. Disable and Uninstall remain
available without release compatibility so an unsupported Firefox update
cannot trap privileged startup code in place. ADR-048 later replaces that
exact version/BuildID match with a Firefox 153+ major-version gate plus an
explicit untested-version warning.

If exactly one valid ownership record survives and its peer metadata is wholly
absent, Uninstall may use that survivor without the old package. It verifies all
still-present ownership-listed files across both scopes, rejects changed files
or path conflicts, removes only proven bytes and the surviving manifest, and
removes only recorded empty directories. This narrowly supersedes ADR-033's
complete-pair requirement for deletion; one-sided install, update, disable, and
enable remain prohibited, while Repair still requires byte-identical source.

**Reasoning:** The installed code executes with system principal, spans Firefox
program/profile roots, and depends on unsupported internals. A loose source ZIP
or default-profile heuristic would make provenance, compatibility, and recovery
ambiguous. One reproducible tree, explicit target mode, exact upstream build,
and verify-before-publish draft provide a narrow first distribution boundary
without inventing an updater or trusting mutable assets.

This decision extends ADR-033: Development-mode one-sided repair still requires
the marker, while Registered mode may use exact registration or its valid
surviving ownership proof; both modes may use that proof for the narrow
one-sided Uninstall above. It does not claim stable/daily-driver support,
Linux/macOS compatibility, ESR/Beta/Nightly compatibility, signing,
attestations, an SBOM, automatic update, or an independent security audit.
Implementation and validation evidence are recorded in
`docs/research/fennevia-release-packaging.md`.

## ADR-037: Delegate complete browser details to fixed Firefox-owned handoffs

**Status:** Accepted for the Firefox 153.0.4 Windows prerelease boundary;
top-row address cluster and native caption island superseded by ADR-038;
popup-action toolbar reveal superseded by ADR-042; the widget/identity
enumeration prohibition partially superseded by ADR-044

Render the top edge as one project-owned, non-wrapping toolbar row. Expose only
nine fixed browser-tool availability booleans and nine fixed actions through a
new per-window `src/firefox/` controller: site information, protections, site
permissions, native Downloads, Unified Extensions, application menu, Settings,
native customization mode, and complete original-toolbar access. Re-resolve
every Firefox owner at action time. ADR-042 supersedes toolbar reveal before
popup-opening actions; Settings, customization, and complete original-toolbar
access still use their previous owners. The dedicated original-toolbar top-row
button was later removed by owner request; the action remains in the bridge.
The dedicated Downloads and native-customize top-row buttons were later
removed by owner request: Downloads is available as the placeable Fennevia
`show-downloads` widget, the customize action remains in the bridge, and the
application menu plus fail-open remain the native-chrome access paths.

Keep the requested 7px browser-content frame as a fixed decorative gutter, not
surface-dependent collision clearance. Edge panels remain overlays: they meet
that gutter without a dead pointer gap, top owns both top corners, side rails
own the remaining side corners, and bottom yields to both rails.

For Firefox 153's enabled Trust Panel, site-information and protection entries
call `gTrustPanelHandler.showPopup()` when that owner exists; collapsed-navbar
`checkVisibility()` is not the feature-gate. ADR-042 then re-anchors the
Firefox-owned panel to the clicked project host without revealing native
chrome. Permission uses `gPermissionPanel.setAnchor`; Downloads initializes
then opens `#downloadsPanel` on the host; extensions and the application menu
toggle or ensure-ready then `moveToAnchor`/`openPopup`. Settings and
customization still invoke the current window owners. The complete-toolbar
action still reveals the navbar and focuses a retained native navigation
control. Never enumerate or clone arbitrary `CustomizableUI` widgets,
extension identities, icons, commands, or panel contents. (Partially
superseded: ADR-044, with explicit owner approval, allows read-only nav-bar
placement enumeration and in-memory rendering of extension name, icon, and
badge; ADR-045 additionally allows full widget-inventory enumeration, bounded
adoption writes, and layout/style preference persistence; panel contents,
commands, and the remaining logging prohibitions stay in force.)

Keep Firefox's existing minimize, maximize/restore, and close nodes in place
for fail-open recovery. The compact native caption island from this decision is
superseded by ADR-038. Empty project panel space may use Firefox's
`-moz-window-dragging: drag`; every interactive or focusable descendant is an
explicit no-drag region.

Project hosts and structural frontend nodes remain XHTML. Project-authored
inline glyphs may use the SVG namespace only inside an explicit
`svg[data-fennevia-icon]` subtree; health and Browser Toolbox ownership checks
reject every other project namespace. No external asset or runtime endpoint is
added.

**Reasoning:** Firefox already owns complete, current, security-sensitive
identity, HTTPS-only, tracking, permission, extension, download, menu,
customization, and platform-window behavior. A fixed action boundary preserves
that fidelity and native recovery without exporting browsing data or creating
an unstable generic toolbar SDK. The original-toolbar handoff retains access to
pinned extension widgets and unmodeled controls while responsive disclosure
keeps the custom row single-line. A future project-owned identity/protection UI
requires a separate decision with complete data/action, privacy, accessibility,
and parity evidence; the current bounded labels are summaries only. Source pins,
reference provenance, and the manual-test boundary are recorded in
`docs/research/firefox-153-single-line-toolbar-handoffs.md`.

## ADR-038: Project-owned window controls with retained native caption nodes

**Status:** Accepted as an explicit owner exception on the Firefox 153.0.4
Windows prerelease boundary

Replace the ADR-037 native caption island with project-owned minimize,
maximize/restore, and close buttons on the right side of the custom top row.
The owner approved this exception because the native caption copies are
difficult to style and position independently of Firefox toolbar geometry.

Native `.titlebar-buttonbox-container` groups remain in `browser.xhtml`. Active
rest CSS collapses every copy; Fennevia never deletes, reparents, or clicks
those nodes. Custom buttons call `window.minimize()`, `window.maximize()` /
`window.restore()`, and `document.getElementById("cmd_closeWindow").doCommand()`
through `src/firefox/window-controls.ts`. The top-row address launcher is
removed; address entry remains on the left launcher and centered popup.

**Reasoning:** Window commands stay Firefox-owned while the visible controls can
follow the same glass/token contract as the rest of the top row. Fail-open still
reveals the original caption buttons. This exception does not authorize cloning
other native security, permission, or toolbar widgets.

## ADR-039: Rapid-development CI gate and owner-approved rule updates

**Status:** Accepted

While Fennevia is under rapid development, ordinary implementation,
documentation, and review work is complete when CI passes. The full
real-Firefox, edge-surface, native-UI, installer, and recovery matrices remain
the release contract and are required before a tagged publication.

Safety, privacy, fail-open, and native-UI ownership rules remain in force by
default. They may be updated or relaxed only with explicit project-owner
approval, recorded in the current normative documents in the same change.
Agents and contributors must not bypass those rules for speed, convenience, or
an unapproved issue comment.

**Reasoning:** The complete matrices are expensive relative to iteration speed.
CI already covers formatting, lint, typecheck, unit tests with coverage
floors, static PowerShell gates, dependency audit, deterministic builds, and
production-artifact scanning. Deferring the mass matrices to release keeps the shipped package
proven without blocking every development change. Owner approval is required
for safety-rule changes so speed cannot silently erode the privileged-code
baseline.

## ADR-040: Use a PowerShell console for release and development install

**Status:** Accepted for issue #57; the "not a graphical installer" clause and
the unconditional "not a self-elevating helper" clause are partially superseded
by ADR-049

Add `scripts/fennevia.ps1` as the interactive Windows console for release
installation and development-environment setup. ADR-049 makes `FenneviaSetup.exe`
the recommended release entry; the console remains the development entry and
the advanced/scripted host. The console is
presentation only: it discovers local Firefox programs, lists registered
profile **names**, shows redacted plans, and confirms. Every mutation still
calls `Invoke-FenneviaPackageAction` or the development-profile helpers. The
existing `fennevia-package.ps1` and `firefox-dev.ps1` commands remain the
non-interactive API.

A `RELEASE-MANIFEST.json` tree exposes only registered-mode package actions.
A source tree exposes development setup, update, launch, recovery, and
teardown. The source-tree console never offers to install the working tree
into a daily-use registered profile. The release ZIP ships the console
scripts and does not ship `FirefoxDevProfile.psm1`.

The documented Firefox program-copy procedure becomes
`New-` / `Test-` / `Remove-FenneviaFirefoxProgramCopy` for the fixed
`%LOCALAPPDATA%\fennevia\program-spikes\firefox-stable-copy` target. Copy and
delete require the `.fennevia-program-spike.json` marker, the managed prefix,
and a no-reparse tree. Unmarked or out-of-prefix directories are refused.

Interactive profile picking may show `profiles.ini` `Name` values locally. It
must not preselect Firefox's default profile, and a default selection requires
a second confirmation. Copyable output and installer status lines keep
`<FIREFOX_PROGRAM>` and `<FENNEVIA_PROFILE>`. Redirected or non-interactive
hosts fail closed.

This is not an updater. No npm TUI dependency is added. The interactive host is
a Fennevia-owned native TUI in `scripts/lib/FenneviaTui.psm1`: alternate screen,
dirty in-place redraw, VT SGR mouse (hover highlight, click to select, wheel), a
log pane in the same frame, and a numbered fallback when stdin or stdout is
redirected. Tests inject a Reader and do not require a real console. ADR-049
adds a separate release-only WinForms wizard that still calls this console's
confirmation helpers and `Invoke-FenneviaPackageAction`.

The TUI interaction model follows the author's profile picker in
`yutinglia/powershell-profile` `profile.d/00-tui.ps1` at commit
`e93dd79180468dec079d6340b21e499f6546f667` as a design reference. That
profile is not a runtime dependency, is not shipped in the release ZIP, and
is not copied into this repository. The Fennevia module is independently
authored for Windows PowerShell 5.1 and PowerShell 7, keeps a persistent
installer session, and still redacts absolute paths.

**Reasoning:** The current CLI is safe but requires memorizing profile mode,
absolute paths, and a long program-copy snippet. A local console can remove
that friction without changing ownership, transaction, or deletion contracts.
Listing profile names is a local interactive exception to "no profile
enumeration in normal output"; it is not automatic target selection.

## ADR-041: Complete left-edge tab strip native parity through Firefox-owned menu handoff

**Status:** Accepted for issue #60

Keep the #10/#11 flat vertical tab list as the only left-edge tab model. Extend
its ordinary snapshot with optional audio, attention, picture-in-picture, and
container `{ color, label }` fields. Add `move`, `toggleMute`, and
`openContextMenu({ screenX, screenY })`. Open Firefox `#tabContextMenu` with the
native `<tab>` as `triggerNode`, then `moveTo` the cursor. Hold the left edge
through the existing #31 `setPopupHeld("left")` path while that popup is open.

Do not reimplement Duplicate, Close others, Send tab, Reopen in container, or
Undo close in Svelte. Do not put native tab, menu, identity, or principal
objects in stores, datasets, or diagnostics. Do not expose `userContextId`.
Treat `ContextualIdentityService.getPublicIdentityFromId` as optional: missing
service, private windows, or unknown colors omit container fields and do not
fail the window. Tab groups, split view, workspaces, multi-select, thumbnails,
and `resource://usercontext-content/` icons remain out of scope.

**Reasoning:** `TabContextMenu.updateContextMenu` only accepts
`triggerNode.tab`, `triggerNode.closest("tab")`, or `selectedTab`. A Svelte
button as trigger would act on the selected tab, not a background tab.
`gBrowser.moveTabTo` already clamps the pinned partition. Container names are
user-derived text like titles: show them, never log them. Color names are a
closed Firefox enum mapped to CSS tokens. Live `openPopup`+`moveTo` proof
against a collapsed native tab strip was not run on this change; the
source-selected sequence is recorded in
`docs/research/firefox-153-tab-strip-parity.md`, with a bridge-owned `.tab`
trigger node as the fallback if positioning fails on the supported build.

## ADR-042: Anchor Firefox-owned panels beside Fennevia buttons without revealing native chrome

**Status:** Accepted for the Firefox 153.0.4 Windows prerelease boundary

Keep Firefox as the sole owner of Trust, identity, protections, permission,
Downloads, Unified Extensions, and application-menu panel contents. For the
six popup-opening browser-tool actions, stop revealing the original navbar and
stop focusing native toolbox anchors. Pass the clicked project-owned XHTML
host into `src/firefox/browser-tools.ts`, initialize or open the current
Firefox owner, then `openPopup`/`moveToAnchor` that host.

Site permissions use Firefox 153's public `gPermissionPanel.setAnchor`. Trust
and protections call `gTrustPanelHandler.showPopup()` when that owner exists
and do not treat Fennevia's collapsed navbar `checkVisibility()` as a Trust
feature-gate. Downloads call `DownloadsPanel.initialize()` then open
`#downloadsPanel` on the host, because `DownloadsButton.getAnchor()` returns
null while the navbar is collapsed. Application menu uses `PanelUI.ensureReady`
then `#appMenu-popup` using Firefox's `bottomcenter topright` placement through
`PanelMultiView.openPopup` (so `#showMainView` fills `openViews` before
`popupshown`). If HTML anchoring fails, that call routes `panel.openPopup` to
`openPopupAtScreenRect` for the duration of the open, then restores Firefox's
method. Do not open a `panelmultiview` panel with a raw `openPopupAtScreenRect`;
Firefox 153 throws `panelView is undefined` on `isOpenIn`. Failed opens
that fire `popuphidden` without showing the panel keep the NativeUi token.
If that still leaves the panel closed, `PanelUI.show()` with the NativeUi handoff token
already set and `moveTo` the host screen rectangle on `popupshown`. Unified Extensions
awaits `gUnifiedExtensions.togglePanel()` so the lazy view can initialize, but while
that call runs the bridge no-ops `PanelMultiView.openPopup` for
`#unified-extensions-panel`. `togglePanel` fire-and-forgets an open on
`#unified-extensions-button`; that in-flight native-button popup races a second
host-anchored open and `popuphide`s the panel before `popupshown`. After restore, the
bridge opens the panel on the project host. The top-row Extensions control uses
`mousedown` like the native button; keyboard still uses `click`.

`NativeUi.sys.mjs` ignores toolbox reveal for a short-lived panel-id handoff
token and for popups whose `anchorNode` is inside the Fennevia frame.
Firefox-initiated doorhangers that stay anchored in the toolbox still reveal
native chrome. Settings, customization, original-toolbar access, and native
Urlbar handoff are unchanged. Do not reparent native anchors or clone panel
contents.

Hold the matching top or left edge with the existing `#31` `setPopupHeld` path
while a Fennevia-initiated panel is open. Keep the centered address overlay
open when the host is one of its detail cards. `popuphidden` releases the hold,
clears `setAnchor`, and drops the NativeUi token. Disposal hides any still-open
handoff panel.

**Reasoning:** Revealing the complete navbar made the original chrome appear
and left panels at collapsed native-button geometry. ADR-041 already proved
that Firefox can own popup contents while Fennevia supplies only screen
placement. A project-owned host as the visual anchor keeps security-sensitive
UI native without a second chrome. Live Browser Toolbox placement against a
collapsed navbar is recorded as `not run`; the source-selected sequence is in
`docs/research/firefox-153-native-popup-anchoring.md`.

## ADR-043: Decorative gutter progress lights without a second surface

**Status:** Accepted for the Firefox 153.0.4 Windows prerelease boundary

Keep ADR-026's hidden-at-rest four-edge contract and ADR-030's anonymous
Downloads panel. Add two project-owned decorative strips inside the existing
Fennevia frame, in the 7px content gutter that ADR-037 already reserves:

- top: selected-tab loading, from the existing navigation `loading` boolean;
- bottom: active download aggregate, from the existing Downloads snapshot.

The strips are `pointer-events: none`, `aria-hidden`, 2px thick, and do not
create a host, edge trigger, reveal timer, z-index system, collision rule, or
content margin. Accessible loading remains Reload/Stop and tab busy state;
accessible download status remains the bottom panel and its keyboard path.
Filenames, URLs, titles, and byte counts never enter the lights.

Loading is an activity light, not a percent bar. Firefox 153 desktop chrome
itself uses selected-tab `busy` plus `Browser:Stop`, not `onProgressChange`
width. `nsIWebProgressListener` replaces unknown or overflowing totals with
`-1`, and `nsBrowserStatusFilter` throttles, drops `cur > max`, and truncates
64-bit progress to 32-bit. Fake timeout fills (the old SPA 3s/8s complete)
hide while a page is still loading. Fennevia therefore keys the top light off
the existing Stop-enabled `loading` boolean and paints a full-width pulse.
Downloads reuse determinate `aggregatePercent` from the list-view aggregate, or
the same pulse when size is unknown. Updates may paint while the matching edge
panel stays hidden and must not change reveal, holds, or collision.

`yutinglia/my-firefox-custom@7a02f60bb23abe9c191c7fd8cd2a7096bb63aee5` was
consulted only for the capability of a top load indicator and a bottom download
indicator. No `.uc.js` implementation, selector, ID, class, timer, numeric
value, native-DOM insertion, filename text, expandable hover bar, cyan/lime
gradient, hue-rotate shimmer, or `browserStack` mutation was copied or adapted.
The gutter overlay, glass/focus tokens, 2px thickness, Stop/list-view sources,
and activity pulse were independently selected for Fennevia.

**Reasoning:** A thin overlay in an already-reserved gutter gives rest-state
progress without revealing chrome or stealing pointer hits from the default
12px #31 triggers. Reusing current bridges avoids a second progress listener,
polling, or a filename-bearing download widget. Live Firefox load/download light
painting is recorded as `not run`; mapping, rejected alternatives, health, and
generated-artifact checks are in
`docs/research/firefox-153-gutter-progress-lights.md`.

## ADR-044: Read-only nav-bar widget mirror rendered with project components

**Status:** Accepted for the Firefox 153.0.4 Windows prerelease boundary, with
explicit project-owner approval for the bounded ADR-037 privacy relaxation;
the mirror-as-sole-model is deprecated and partially superseded by ADR-045 —
the nav-bar mirror remains only as the default top-zone layout until the user
customizes, and "native customize mode is the only editor" no longer holds;
the curated-glyph-only built-in icon clause is superseded by ADR-046

Mirror Firefox's own `CustomizableUI` nav-bar placement list as a read-only
data source and render it in the Fennevia top row with project-owned glass
buttons: WebExtension action buttons (real `moz-extension://` icon, badge
text/colors, extension name as label/tooltip), user-pinned built-in buttons
(curated `ShellIcon` tokens as fallback; native `chrome://` / `resource://`
icons per ADR-046), and
special placements (spring, spacer, separator) as gaps. Placements already
represented by fixed Fennevia controls (back/forward, urlbar-container,
search-container, Unified Extensions, application menu,
personal-bookmarks, and similar) stay on a fixed
skip list. `downloads-button` also remains skipped so the default nav-bar
mirror does not reintroduce it; users place the Fennevia `show-downloads`
widget instead. Until the user customizes in Fennevia, this list remains the default
top-zone layout. `CustomizableUI` listeners plus a bounded attribute
`MutationObserver` republish an immutable revision snapshot after customize
exit, pin/unpin, install/removal, badge, and icon changes.

The per-window `src/firefox/toolbar-widgets.ts` controller keeps widget ids and
native nodes in a privileged opaque-handle registry; the frontend receives only
`{ handle, kind, label, tooltip, iconUrl, badge, icon, disabled }` with
validated bounds (bounded `moz-extension://`, `chrome://`, and `resource://`
icon URLs per ADR-046, rgba-only badge colors, fixed icon tokens, bounded
text). Activation passes the clicked project host
back through the handle: widgets with a `viewId` open through
`PanelUI.showSubView(viewId, host)` (the transient
`customizationui-widget-panel` anchors on the host directly); other widgets
dispatch the native node command and re-anchor any panel that appears with
`moveToAnchor(host)`. Panel holds, toggle-close, popup release, and disposal
reuse the ADR-042 pattern.

This owner-approved decision partially supersedes ADR-037's prohibition:
read-only nav-bar placement enumeration and extension identity (name, icon,
badge) may enter frontend memory for rendering only. Logging, persistence,
diagnostics, CSS custom properties on shared roots, and root datasets must not
carry widget identity; diagnostics stay at widget counts and fixed codes. The
feature is an optional capability: a missing `CustomizableUI` or `PanelUI`
leaves the zone hidden, never joins activation health requirements, and keeps
fixed handoffs and fail-open recovery untouched. Panel-content cloning and
overflow-panel mirroring remain out of scope. Bounded CustomizableUI writes and
project-owned layout editing are recorded in ADR-045.

**Reasoning:** Firefox already maintains the user's customized nav-bar layout,
extension action state, and popup ownership; mirroring that list read-only
avoids inventing a second widget system while restoring pinned-extension access
that the collapsed navbar removed. Curated icon tokens keep widget ids
privileged-side as a fallback, and the ADR-042 host-anchoring path keeps
extension popup contents Firefox-owned. ADR-046 amends the built-in icon
rendering path. Live Firefox mirroring and popup anchoring are recorded
per-row in `docs/testing-and-recovery.md`; source pins and the selected minimum
sequence are in `docs/research/firefox-153-toolbar-widget-mirror.md`.

## ADR-045: Fennevia-owned customize mode with four-panel widget zones and bounded style tokens

**Status:** Accepted for the Firefox 153.0.4 Windows prerelease boundary, with
explicit project-owner approval (2026-08-18, planning conversation) for the two
bounded rule relaxations below; partially supersedes ADR-044's
mirror-as-sole-model and "native customize mode is the only editor" clauses;
the "editor drawer performs all editing" clause is superseded by ADR-047; the
style preference schema is extended by ADR-054

Deprecate the ADR-044 read-only nav-bar mirror as the only widget source and
replace it with a Fennevia-owned customize mode. The `toolbar-widgets`
controller becomes the per-window customize engine: it renders one Fennevia
widget zone in each of the four edge panels from a project-owned layout,
exposes the complete current `CustomizableUI` widget inventory (every placed
area plus `getUnusedWidgets` over `gNavToolbox.palette`, extensions included)
as an opaque-token palette, adds Fennevia-owned placeable widgets
(`show-bookmarks` reveals the right-edge bookmarks surface; `show-downloads`
opens Firefox's `#downloadsPanel` through the existing browser-tools Downloads
action) and the spacer/spring/separator specials,
and accepts a fixed validated edit-operation set (`add`, `move`, `remove`,
`reset-layout`, `set-style`, `reset-style`) with a revision guard. Visual
packing is Firefox-like rather than a trailing chip cluster: the top widget
zone sits between the fixed navigation buttons and the fixed Firefox-tools
cluster, grows to fill remaining toolbar width, and lets `spring` ("Flexible
space") consume that free space so widgets after the spring sit next to the
tools. Left, right, and bottom zones are the same kind of full-width
horizontal row, so `spring` can pack leftover space without changing the
tabs, bookmarks, or downloads panel sizes. A project-owned editor drawer
under the top panel — toggled by a dedicated
top-row control, held open through the #31 popup hold, closed by `Escape` with
focus restoration — performs all editing. The fixed health-gated Fennevia
controls remain fixed and non-removable; zones add to them.

When no layout preference exists, the top zone falls back to the ADR-044
nav-bar mirror, so the deprecated behavior survives only as the default. The
first edit materializes that layout into the `fennevia.customize.layout`
string preference; `fennevia.customize.style` persists the bounded style
tokens (theme, accent, panel surface, chrome background, text, border, blur,
radius, density, surface opacity, saturation, shadow, motion, and font size).
ADR-054 adds bounded edge interaction integers to that same preference; it does
not create another preference or persistence owner.
Both prefs are strict versioned JSON with a 16 KiB cap, fail safe to defaults
when invalid, are shared across windows through one preference observer per
controller, and contain widget ids and fixed tokens only — never URLs, titles,
input text, browsing data, or private-window state. Style is applied as a
fixed CSS custom-property set on the project frame root, skips color
overrides under forced colors, and is removed on dispose. The separate chrome
background token is applied by NativeUi as `--fennevia-chrome-background` on
`:root#main-window` (the same root NativeUi already owns for activation
attributes). Svelte never writes Firefox-owned `documentElement` styles.
Empty color tokens keep the CSS defaults, including Firefox
`--toolbar-background-color` for the content gutter. ADR-051 maps those frame
CSS color defaults onto Firefox chrome design-system tokens rather than a
private RGB palette.

Owner-approved relaxations recorded here: (a) the layout preference may
persist Firefox widget ids, including extension widget ids, on the privileged
side; extension identity remains banned from logs, diagnostics, serialized
frontend state, CSS variables, and root datasets; (b) the controller may
perform bounded `CustomizableUI` writes — `addWidgetToArea(id, "nav-bar")`
onto the collapsed native nav-bar when placing a widget that has no live node,
recording it in the persisted `adopted` list, and the inverse restore
(extensions return to `AREA_ADDONS`, others to the palette) when the last
Fennevia placement is removed or the layout is reset. Fennevia never mutates
placements the user made natively and never writes any other CustomizableUI
state. Editing is an optional capability on top of the optional zone
capability: missing `Services.prefs` disables editing, and neither joins
activation health. Native customize mode stays available through the Firefox
application menu, complete native reveal, and fail-open; it is not a fixed
top-row control.

**Reasoning:** The mirror restored pinned-extension access but left Firefox as
the only layout owner and covered only the top row. A Fennevia-owned layout
with the full CustomizableUI inventory delivers per-panel widget placement and
style customization while reusing the proven ADR-042/ADR-044 node, icon,
badge, invoke, and popup-anchoring machinery instead of inventing a second
widget system. Collapsed-nav-bar adoption keeps Firefox the owner of widget
nodes, popups, and extension lifecycle, so no panel contents are cloned and
removal restores the native state. Bounded, versioned, profile-local prefs are
the smallest persistence surface that survives restarts and syncs windows
without new storage machinery. Source pins are in
`docs/research/firefox-153-customize-mode.md`; validation lives in
`tests/customize-model.test.mjs`, `tests/firefox-toolbar-widgets.test.mjs`,
and `tests/toolbar-widgets-state.test.mjs`, with the real-Firefox matrix
recorded in `docs/testing-and-recovery.md`.

## ADR-046: Localized widget names and native chrome:// icons via CSS mask

**Status:** Accepted for the Firefox 153.0.4 Windows prerelease boundary, with
explicit project-owner approval (2026-08-19, planning conversation); supersedes
ADR-044's rejection of built-in `chrome://` `list-style-image` extraction

Unused CustomizableUI widgets often have no connected `document.getElementById`
node because XUL palette items live in `gNavToolbox.palette`, which is not part
of the document. API built-ins commonly expose only a Fluent `l10nId` on the
internal widget record, not a group-wrapper `label`. The toolbar-widgets
controller therefore resolves presentation without calling
`wrapper.forWindow()` or `buildWidgetNode()`:

- names from the document or palette node (`label` / `title` / `tooltiptext`
  and `data-l10n-id`); a dedicated per-window sync `Localization` for
  `browser/browser.ftl`, `browser/sidebar.ftl`, `browser/appmenu.ftl`, and
  `browser/screenshots.ftl`, plus allowlisted `link[rel="localization"]`
  hrefs from the chrome document, so `formatMessagesSync` still works after
  chrome `document.l10n` has called `setAsync()`; then
  `CustomizableUI.getLocalizedProperty`, and a small privileged Fluent-id map
  pinned to Firefox 153 `CustomizableWidgets`, XUL palette widgets,
  `screenshot-button`, and `reset-pbm-toolbar-button` (`reset-pbm-toolbar-button2`
  from `ResetPBMPanel`). Wrapper `tooltiptext` values that are still
  properties-bundle keys (`*.tooltiptext2`) or incomplete `%S` format
  strings are dropped;
- built-in icons from computed `list-style-image` when a node exists, otherwise
  a per-window CSSOM cache of `#widgetId` rules (including nested `&` /
  `@media` rules), then a pinned 153 `toolbarbutton-icons.css` URL map, then
  the existing curated `ShellIcon` token.

Bounded `chrome://` and `resource://` icon URLs may enter that window's
in-memory frontend state and a per-element CSS `mask-image` (plus
`-webkit-mask-image`) painted with `currentColor`. This avoids `<img src>` on
context-fill SVGs, which render blank or black. Extension icons remain
`moz-extension://` `<img src>`. Icon URLs follow the same privacy rule as
extension identity: they never enter logs, diagnostics, prefs, CSS variables on
shared roots, or root datasets. Empty, oversized, quoted, or non-allowlisted
values fall back to the curated token or generic glyph.

**Reasoning:** The customize palette is unusable when every unused built-in is
labelled "Toolbar item" with a generic glyph. Palette lookup and Fluent restore
the names Firefox already localizes. Masking the same `chrome://` URLs Firefox
uses in `toolbarbutton-icons.css` keeps theme/forced-colors coupling on
`currentColor` without cloning native nodes. Source pins remain in
`docs/research/firefox-153-toolbar-widget-mirror.md`; validation lives in
`tests/firefox-toolbar-widgets.test.mjs` and
`tests/toolbar-widgets-state.test.mjs`.

## ADR-047: Live four-edge HTML5 drag-and-drop for Fennevia customize mode

**Status:** Accepted for the Firefox 153.0.4 Windows prerelease boundary;
supersedes ADR-045's "editor drawer performs all editing" clause

Placement editing happens on the live four-edge widget zones, not in a
duplicate zone list. Opening Fennevia customize is a frontend session owned by
the shell host: it sets the existing #31 `popup` hold on all four edges, marks
the project frame with `data-fennevia-customize-active`, and keeps those holds
if a Firefox-owned popup later closes. Pointer hold is not used because
`setPointerHeld(true)` is exclusive and would hide the other edges. The top-host
CustomizePanel becomes the unused-widget palette plus style/reset controls.
Dragging uses HTML5 drag-and-drop on project-owned XHTML only, with MIME
`application/x-fennevia-toolbar-widget` and a payload of opaque palette tokens
or zone indexes — never widget ids. Drops call the existing
`add` / `move` / `remove` edit operations; adopt/restore writes are unchanged.
Widget activation is disabled while the session is open. Keyboard remains a
required path: `Escape` closes the session, `Delete` removes a focused placed
widget, `Ctrl+ArrowLeft/Right` reorders within a zone, and palette
`Enter`/click adds to the last-focused zone. The palette stays in the
top-host CustomizePanel and is centered in the remaining content well using
the #31 collision clearances, including `--fennevia-bottom-clearance`, so it
does not cover the four-edge drop zones. Native `CustomizeMode.sys.mjs` drag
into Firefox areas stays out of scope; native customize mode remains available
from the application menu, complete native reveal, and fail-open.

**Reasoning:** The button-only drawer could not match Firefox customize mode:
widgets were edited as a list instead of on the toolbars the user already sees,
and the four independent Svelte roots cannot share `$state`. Reusing popup hold
and the proven tab-strip HTML5 drag contract keeps the change inside the #31
edge controller and the existing toolbar-widgets write boundary. Validation
lives in `tests/customize-session.test.mjs` and
`tests/toolbar-widget-drag.test.mjs`; the real-Firefox matrix remains in
`docs/testing-and-recovery.md` §6.9.

## ADR-048: Allow Firefox 153+ with an explicit untested-version warning

**Status:** Accepted on 2026-08-19 after owner-confirmed Firefox 154.0 ordinary
runtime; supersedes ADR-036's exact version/BuildID install gate

Keep `firefoxCompatibility` as the **tested** Firefox records, not a closed
install allowlist. The current tested majors are 153 (153.0.4 /
`20260810162159`) and 154 (154.0 / `20260812182057`).

When `RELEASE-MANIFEST.json` is present, Install, Update, Repair, and Enable:

- reject Firefox major versions older than the lowest tested major (153);
- allow 153, 154, and newer majors;
- record `compatibilityKind` as `tested` or `untested-newer`;
- always surface the warning that only the tested majors have evidence and
  that confirming install does not promise that everything will work.

The interactive installer TUI requires an explicit
`confirm-firefox-support` acknowledgement before the existing plan
confirmation. Scripted CLI preview/result lines carry the same warning.
Disable and Uninstall remain available without this gate so an unusable
newer or older Firefox cannot trap AutoConfig in place.

Do not treat a newer major as a validated support promise. Linux, macOS, ESR,
Beta, Nightly, and daily-driver use remain out of scope. A later Firefox still
requires `docs/firefox-update-workflow.md` when internals break.

**Reasoning:** Exact BuildID matching blocked the owner-confirmed Firefox 154.0
runtime and would block every later stock stable until a release republished
the pair. A minimum-major gate plus an explicit no-promise warning lets 154
and later stables install while keeping older-than-153 builds fail-closed.
Evidence: `docs/research/firefox-154-stable-transition.md`.

## ADR-049: Release WinForms setup host with on-demand UAC

**Status:** Accepted after explicit owner request for a normal Windows GUI
setup wizard; partially supersedes ADR-040's "not a graphical installer" and
unconditional "not a self-elevating helper" clauses

Ship `FenneviaSetup.exe` at the extracted release root as the recommended
end-user entry. The executable is a tiny STA launcher compiled during release
packaging with Roslyn `csc /deterministic` when Visual Studio 2022 is present,
or with .NET Framework `csc.exe` plus a fixed PE timestamp and source-hash
MVID when it is not. It starts Windows PowerShell
5.1 with `-Sta -ExecutionPolicy Bypass` only so Mark-of-the-Web extracted
scripts can load; that bypass is not a mutation-check bypass.

The wizard in `scripts/lib/FenneviaGui.psm1` is presentation only. It reuses
`Initialize-FenneviaConsoleHooks`, `Resolve-FenneviaConsoleProfileSelection`,
`New-FenneviaConsolePackageRequest`, `Get-FenneviaConsoleFirefoxSupportWarning`,
and `Invoke-FenneviaPackageAction`. It runs only when `RELEASE-MANIFEST.json`
is present. Source trees keep `scripts/fennevia.ps1` for development. The GUI
never offers development setup, launch, or teardown.

The wizard must:

- list local Firefox builds and registered profile **names** without
  preselecting Firefox's default profile;
- require a second confirmation before using a default profile;
- require the 153/154 testing warning for Install, Update, Repair, and Enable;
- require the displayed `planSha256` before mutation;
- refuse to apply while the selected Firefox is running, without killing it;
- keep copyable output on `<FIREFOX_PROGRAM>` and `<FENNEVIA_PROFILE>`;
- tell the user to keep the extracted release folder.

On-demand UAC is allowed only when a mutating action's selected program
directory is not writable and the user clicks **Continue as administrator**.
Status never elevates. The unelevated host writes a 15-minute
`%TEMP%\fennevia-setup-state-*.json` file with a current-user-only ACL, then
relaunches `FenneviaSetup.exe --resume-state`. The elevated instance must
re-resolve the same package root, recompute the plan, and refuse to apply if
`planSha256` changed. UAC cancel leaves the wizard on the permission page.

This is not an Inno/NSIS/MSI product installer, Add/Remove Programs entry,
LocalAppData package cache, automatic updater, or signed binary. The
transaction, ownership, deletion, and registered-profile contracts are
unchanged.

**Reasoning:** The PowerShell TUI is safe but not a normal Windows setup
experience. A WinForms host can remove that friction for release users without
reimplementing path, hash, or rollback rules. Self-elevation at startup would
over-privilege profile writes; asking only when `Program Files` is not
writable keeps the existing least-privilege default.

## ADR-050: Self-expiring first-paint native hide without delayed-startup shell work

**Status:** Accepted after explicit project-owner implement request
(2026-08-20, planning conversation) to stop the original toolbox flashing on
boot while keeping fail-open; amends ADR-007 and ADR-011 timing only

Register one process-scoped author stylesheet as soon as the Fennevia runtime
starts, before `WindowManager` enumerates delayed-startup windows. The sheet
applies only to `chrome://browser/content/browser.xhtml` roots with
`windowtype="navigator:browser"` and only while `data-fennevia-active`,
`data-fennevia-failed`, and `data-fennevia-native-ui-suspended` are absent.
Hiding properties live in the `0%` keyframe of a 2,000 ms `step-end`
animation whose `100%` keyframe is empty, so `animation-fill-mode: forwards`
restores Firefox cascade values when health does not activate in time.
Setting `data-fennevia-active` cancels the pending animation in the same
style flush that enables NativeUi's seven rest rules.

Do not use a chrome.manifest `style` overlay: Firefox 153 and 154
`ManifestParser.cpp` no longer parse that directive. Do not use an unscoped
agent sheet. Do not move host, bridge, or Svelte initialization before
`browser-delayed-startup-finished`. Disable
`browser.startup.preXulSkeletonUI` from program defaults so the Windows
pre-XUL fake toolbar cannot paint a second native topbar.

Safe start and Firefox safe mode never import the runtime, so the sheet is
never registered. Runtime start failure unregisters the sheet if it was
registered. Registration failure does not fail the runtime; the native
toolbox may flash rather than leave the browser unusable.

**Reasoning:** Delayed-startup NativeUi cannot beat first paint. A document-
scoped author sheet registered at AutoConfig import time can. A CSS timeout
that does not depend on JavaScript is the only fail-open that still works
when the privileged runtime hangs after registration. Empty `100%` keyframes
avoid leftover `!important` geometry after the deadline.

Evidence: `docs/research/firefox-153-startup-native-hide.md`.

## ADR-051: Consume Firefox chrome design tokens as the default shell theme

**Status:** Accepted for the Firefox 153/154 Windows prerelease boundary;
amends ADR-026's default color values and ADR-045's empty-style CSS defaults

Keep the existing `--fennevia-*` token names on `#fennevia-shell-frame-host`.
Change only their default values so an empty customize style follows Firefox's
current chrome design system instead of a private slate/blue RGB palette.

Default mapping (runtime `var()` only; token JSON is not copied):

| Fennevia token | Firefox chrome token |
| --- | --- |
| `--fennevia-glass-surface` | `--panel-background-color` mixed to 94% |
| `--fennevia-glass-tint` | `--toolbar-background-color` mixed to 82% |
| `--fennevia-glass-text` | `--toolbar-text-color` / `--panel-text-color` |
| `--fennevia-glass-muted` | `--toolbarbutton-icon-fill` |
| `--fennevia-glass-border` | `--panel-border-color` |
| `--fennevia-glass-separator` | `--chrome-content-separator-color` |
| `--fennevia-focus-color` | `--focus-outline-color` / `--color-accent-primary` |
| `--fennevia-danger-color` | `--text-color-error` |
| `--fennevia-selected-surface` | `--color-accent-primary` at 20% |

Those symbols exist on `browser.xhtml` through
`toolkit/themes/shared/design-system/dist/tokens-platform.css`,
`tokens-shared.css`, and `browser/themes/shared/browser-colors.css` on both
`FIREFOX_153_0_4_RELEASE` and `FIREFOX_154_0_RELEASE`. Light and Dark in-app
themes resolve `--color-accent-primary` to `--color-blue-60` /
`--color-cyan-30`. System/native theme keeps `AccentColor`. Forced colors
continue to replace the Fennevia tokens with Canvas/CanvasText/Highlight.

Customize empty `#rrggbb` fields still mean "use CSS defaults." Swatches in
the style editor use documented Acorn hex (gray primitives plus `--color-*-60`
and Storybook `--color-blue-60` `#0062f9`), not Tailwind. NativeUi's content
gutter already uses `--toolbar-background-color`; this change aligns the
owned surfaces with the same official pattern.

**Reasoning:** A content-first shell on stock Firefox should look like Firefox
chrome when the user has not customized style. Inheriting the live chrome
tokens follows Light/Dark/System automatically, picks up HCM layers already
maintained upstream, and avoids a second palette that drifts from Acorn.
Source pins and the selected mapping are in
`docs/research/firefox-153-design-tokens.md`. Static coverage lives in
`tests/tab-strip.test.mjs` and `tests/frontend-build.test.mjs`. Real Firefox
Light/Dark visual review remains `not run`.

## ADR-052: Follow Firefox UI language with project-owned en / zh-Hant catalogs

**Status:** Accepted for the Firefox 153/154 Windows prerelease boundary;
does not add a chrome.manifest `locale` mapping (ADR-016 remains in force)

Fennevia shell copy follows the Firefox UI language, not website
`Accept-Language`. The optional per-window locale bridge reads
`Services.locale.appLocaleAsBCP47` and observes `intl:app-locales-changed`.
The public snapshot is only `{ id: "en" | "zh-Hant" }`:

- every Chinese tag (`zh`, `zh-Hant`, `zh-Hans`, `zh-TW`, `zh-CN`, and
  longer matching subtags) currently maps to `zh-Hant` because there is no
  Simplified Chinese catalog yet;
- every other tag, including Japanese and a missing or throwing
  `Services.locale`, maps to `en`.

Project-owned strings live in typed `src/app/messages/en.ts` and
`src/app/messages/zh-Hant.ts` catalogs compiled into the existing Svelte IIFE
and the Firefox bridge bundle. A small `t()` interpolates `{name}` placeholders
and falls back to English. There is no Fluent `.ftl` tree, npm i18n library,
Fennevia language selector, Simplified Chinese catalog, or RTL `dir` flip
(both supported locales are LTR). Missing locale capability must not fail
window health; host `aria-label` values start as English and are rewritten
from the same catalogs after the snapshot exists.

Firefox-native toolbar widget names remain Firefox Fluent (ADR-046). Bookmark
root titles remain `PlacesUtils.bookmarks.getLocalizedTitle`. Urlbar coverage
still crosses the bridge as fixed enums only; the shell translates its own
generic labels and never receives Firefox localized widget or permission text.

**Reasoning:** Chrome `locale` mappings and Fluent would add privileged
resource surface that ADR-016 omitted on purpose. Bundled catalogs keep the
copy next to the Svelte hosts, stay reviewable without a second toolchain, and
still follow the setting that displays Firefox menus and notifications.
Validation lives in `tests/locale-state.test.mjs`, `tests/firefox-locale.test.mjs`,
and `tests/i18n.test.mjs`. Real Firefox UI-language switching remains `not run`.

## ADR-053: Feature-first source modules with compatibility facades

**Status:** Accepted after the project owner's explicit whole-codebase
refactoring request (2026-08-21); organizational only, with no relaxation of
privileged, fail-open, native-ownership, privacy, or support rules

Keep the existing public TypeScript import paths such as
`src/app/edge-surfaces.ts`, `src/app/bookmark-state.ts`,
`src/firefox/navigation.ts`, and `src/firefox/toolbar-widgets.ts` as thin
facades. Move implementation into feature folders whose files have one primary
responsibility:

- application contracts, validation/copying, pure state reduction, adapters,
  and view derivation are separate;
- Firefox capability/native-data helpers are separate from per-window
  controllers and popup-action coordination;
- Svelte edge surfaces and feature components are separate from the frame
  coordinator;
- shell mounting delegates address-popup and focus ownership to explicit
  coordinators;
- the root stylesheet is an ordered import facade over feature CSS modules;
- `FenneviaInstaller.psm1` loads a fixed reviewed list of implementation
  files for common safety checks, target discovery, ownership, planning,
  transactions, and public output.

Facades are not a second implementation and must not grow feature logic. A
feature folder may use private support facades, but `src/app/` and
`src/shell/` still cannot import Firefox implementations. The installer
loader must never enumerate scripts or accept plugin paths. The CSS import
order is part of the cascade contract. Generated `profile/` files remain
build output and may change only through the documented deterministic build.

This decision adds no dependency, Firefox symbol, runtime resource mapping,
preference, native-DOM mutation, data field, logging field, or support claim.
Behavioral changes require their own decision and evidence; refactoring alone
must preserve focused tests, coverage floors, deterministic cleanup, release
inventory verification, and the complete ordinary CI gate. Real-Firefox mass
matrices are not reclassified as passed by structural equivalence.

**Reasoning:** The former flat files mixed stable contracts, native capability
checks, state copying, UI composition, event coordination, and cleanup. That
made reviews broad and encouraged unrelated edits in files exceeding one or
two thousand lines. Feature folders make privileged ownership and disposal
boundaries visible while compatibility facades avoid a repository-wide public
API migration. Fixed CSS and installer inventories preserve deterministic and
fail-closed behavior instead of replacing monoliths with discovery mechanisms.

## ADR-054: Persist bounded edge-interaction settings through shared shell contracts

**Status:** Accepted after the project owner's explicit configuration request
(2026-08-21); amends ADR-026 and ADR-045 without relaxing keyboard, focus,
popup-hold, fail-open, privacy, or native-UI ownership rules

Extend the existing `fennevia.customize.style` version-1 JSON object with five
optional bounded integers:

| Setting | Default | Accepted range | Runtime meaning |
| --- | ---: | ---: | --- |
| `autoHideDelay` | 300 ms | 100–5,000 ms | Delay after the pointer moves from a panel into page content or another target inside the Firefox window; also the default after a non-pointer hold clears |
| `windowLeaveHideDelay` | 800 ms | 100–5,000 ms | Delay after the pointer leaves the Firefox window or the window loses focus while a pointer hold remains |
| `temporaryRevealDuration` | 1,200 ms | 400–10,000 ms | Default duration for a bounded programmatic reveal such as `show-bookmarks` |
| `shortcutHintDuration` | 600 ms | 0–10,000 ms | Duration of the existing edge keyboard-shortcut tip animation; `0` omits the tip from the rendered shell |
| `edgeTriggerSize` | 12 CSS px | 6–24 CSS px | Shared invisible pointer strip and corner-arbitration thickness |

Older version-1 values omit these keys and receive the defaults. Any malformed,
non-integer, or out-of-range value fails safe through the existing default-style
path. The Fennevia customize drawer exposes the five values in an
**Interaction** section together with the existing density and motion controls;
all controls have visible labels, current values, helper text, and native
keyboard-operable inputs. Resetting appearance and interaction clears the same
style preference.

The toolbar-widgets preference observer republishes the validated snapshot to
each window. `mount-shell` applies it to the one shared edge controller and the
project frame. A surface `pointerout` with a non-null `relatedTarget` is an
in-window exit and uses `autoHideDelay`; a null target is treated as leaving the
browser window and uses `windowLeaveHideDelay`. The window-level `pointerout`
and `blur` listeners provide a fallback for an event that does not finish on the
surface root. If both layers observe the same exit, the controller keeps and,
only when the classification changes, rearms the one tracked hide timer.
Changing the applicable setting while that timer is pending also cancels and
rearms the same timer from the update moment. The temporary duration becomes
the default for later programmatic reveals; an explicit feature duration
remains explicit. Trigger size updates both the frame-scoped CSS variable and
`resolveEdgeAtPoint()` input from the same controller snapshot, so painted hit
geometry and corner arbitration cannot drift. Shortcut-tip duration updates the
existing frame-scoped CSS animation. A zero value prevents the Svelte footer
from rendering at all, including the initial frame; a non-zero value preserves
the same animation and uses a discrete, non-fading expiry under reduced motion.

Focus, keyboard, and popup holds remain authoritative regardless of the chosen
duration. The four fixed keyboard reveal paths, `Escape`, focus restoration,
modal/customize/DOM-fullscreen suspension, zero permanent layout, and complete
disposal are unchanged. The bounds keep the target narrow and prevent a very
large invisible overlay from consuming browser content.

This change adds no preference name, observer, JavaScript timer, host, native
Firefox symbol, network access, browsing-derived data, private-window activity,
arbitrary CSS, or log field. Standard `PointerEvent.relatedTarget` and the
existing window `blur` listener provide only ephemeral event classification;
the result is not persisted or logged. The existing 16 KiB cap and fixed
integer schema remain the persistence boundary. Focused validation covers
old-pref migration, bounds, cross-window persistence, both pointer-exit paths,
pending-timer rearming, default temporary duration, zero-disabled shortcut
tips, trigger wiring, localization parity, and generated artifacts. The
real-Firefox interaction rows remain release-matrix work.

**Reasoning:** The fixed timings and 12px hit strip were safe defaults but made
the shell unnecessarily rigid across pointer precision and work styles. Reusing
the accepted customize preference, shared #31 controller, and existing
shortcut-tip animation provides useful choice without creating per-surface
behavior, a second timer, or an unrestricted geometry editor.
