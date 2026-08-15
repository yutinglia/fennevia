# Architecture

## 1. System boundary

This project is neither a Gecko embedder nor a Firefox source fork. Stock Firefox continues to own the process model, browser windows, content processes, tabs, networking, security model, web-content isolation, and session persistence.

This project owns the visible browser shell and a privileged integration runtime.

```text
+--------------------------------------------+
| Svelte shell                               |
| components / local state / accessibility   |
+-------------------+------------------------+
                    | plain typed contracts
+-------------------v------------------------+
| Application state and controllers          |
+-------------------+------------------------+
                    | bridge API
+-------------------v------------------------+
| Firefox bridge                             |
| gBrowser / commands / Places / Downloads   |
+-------------------+------------------------+
                    | privileged APIs
+-------------------v------------------------+
| Stock Firefox browser chrome and Gecko     |
+--------------------------------------------+
```

## 2. Startup layer

### AutoConfig

AutoConfig performs only these tasks:

1. Stop before registration when Firefox safe mode or `fennevia.safeStart` is active.
2. Resolve the active profile's project manifest through `UChrm`.
3. Register the Chrome Registry manifest through `nsIComponentRegistrar.autoRegister()`.
4. Resolve and import one privileged `Bootstrap.sys.mjs` entry.
5. Validate the entry contract and report success, duplicate evaluation, or fatal failure without hiding native UI.

It does not implement script discovery, hot reload, metadata parsing, sandbox abstraction, frontend UI, or application logic.

The stabilized Phase 1 package lives in the repository-root `program/` and
`profile/chrome/fennevia/` trees and is inventoried by
`package-manifest.json`. AutoConfig and the entry each use a process guard. The
entry uses Firefox 153's loader-defined `Services` global after a runtime
capability check; `Services.sys.mjs` is not packaged in the supported build.
Structured records include phase, stable code, Firefox version, build ID, and a
path/URL-redacted stack.

Phase 2 keeps that entry singular. `Bootstrap.sys.mjs` directly imports four
fixed project modules (`Logger`, `WindowManager`, `WindowShell`, and `Runtime`)
plus Firefox's fixed `PrivateBrowsingUtils` module. `WindowShell` has one fixed
relative import of `HealthState`; there is still no discovery or dynamic import.
The entry starts one process runtime and returns the same frozen bootstrap
contract. AutoConfig still knows nothing about windows or features.

### Chrome Registry package

ADR-017 defines Fennevia as the sole active project and package identity. The
package reserves stable project-owned logical URIs:

```text
chrome://fennevia/content/...
resource://fennevia/...
```

The initial manifest registers only `content fennevia content/` without `contentaccessible=yes`. The `resource://fennevia/` alias is reserved but omitted because Phase 1 has no consumer and every mapping expands the audited surface. Use of manifest `style` is decided by the CSS spike. `override` is disabled by default. The package rename was revalidated against Firefox 153.0.4 without a compatibility alias; see `docs/research/fennevia-identity-migration.md`.

Firefox 153's `toolkit/docs/internal-urls.md` states that both `chrome:` and `resource:` mappings are restricted to privileged code by default. `contentaccessible=yes` hole-punches that restriction for the whole mapped package. Phase 1 confirmed from an ordinary loopback HTTP page that the project entry is not content-accessible. Any future mapping still requires an exact inventory and current runtime test; never use `contentaccessible=yes` or map secrets, private data, source maps, diagnostics, or privileged implementation without a dedicated security review.

## 3. Runtime layer

The process-global runtime owns:

- a `Symbol.for()` singleton and one idempotent start/stop transition;
- registration of the application-shutdown observer;
- one browser `WindowManager`;
- global version and diagnostic metadata;
- aggregate lifecycle counts that contain no native handles or browsing data.

The `WindowManager` registers
`browser-delayed-startup-finished` before enumerating existing
`navigator:browser` windows, closing the observer/enumerator race. It accepts a
window only when it is an open top-level chrome window whose document URI is
exactly `chrome://browser/content/browser.xhtml`, whose root `windowtype` is
exactly `navigator:browser`, and whose
`gBrowserInit.delayedStartupFinished` flag is true. A `WeakSet` permits one
initialization attempt per native window. Browser Toolbox, dialogs, chrome
frames, tabs, and unrelated windows therefore cannot become shell windows.

A per-window runtime owns:

- one process-local random UUID and `normal` or `private` classification;
- an `AbortSignal` that is triggered before disposal cleanup;
- a reverse-order cleanup registry and one optional returned disposer;
- eventually, that window's project XHTML hosts, Firefox bridge instances,
  frontend root, health state, and native-UI gate.

Issue #5 established the lifecycle. Issue #6 supplies its one initializer:
`WindowShell.sys.mjs` validates the exact current document hierarchy before it
creates a visible primary XHTML host, hidden sidebar XHTML host, and hidden,
inert overlay XHTML host. Normal and private windows receive the same complete
host set. The primary host is a direct `body` child immediately before
`#browser`; the sidebar host is immediately before `#tabbrowser-tabbox`; the
overlay host is immediately before `#a11y-announcement`. Project code owns only
these nodes and their descendants. It never moves a native node or hides native
UI.

Issue #7 adds a per-window controller around those hosts. `HealthState.sys.mjs`
owns the only root-state transition table: `created -> mounted -> healthy ->
active`, plus terminal `failed` and `disposed` handling. State attributes are
project-prefixed, cumulative through `active`, and removed on disposal. An
illegal transition enters `failed`, removes the active marker first, and is
reported rather than accepted. Duplicate transitions and disposal are
idempotent.

The production initializer mounts synchronously and then applies a finite
2,000 ms health deadline. Its current self-check validates exact host identity,
placement, XHTML descendants, hidden/inert auxiliary hosts, an attached inline
stylesheet with parsed rules, the registered emergency handler, and every
declared capability. The extension points used to inject failures in unit tests
are ordinary constructor collaborators; the installed initializer always uses
fixed production defaults and exposes no preference, DOM global, or runtime
debug switch for choosing a failure mode.

`initializeWindowShell` stops at `healthy`. Only the explicit lifecycle
controller can request `active`, and no production caller does so. Package
`0.4.0-dev` introduced this boundary, and the current `0.5.0-dev` package still
contains no selector that hides Firefox UI. `Ctrl+Alt+Shift+F12` is registered directly on each chrome window in
the capture and Mozilla system event groups. It reports the fixed recovery
phase, clears state, removes every host/listener/timer/cleanup, and does not
depend on Svelte, application state, or a Firefox bridge. AutoConfig separately
checks Firefox safe mode and `fennevia.safeStart` before manifest lookup, so a
missing runtime module cannot prevent safe start.

Window unload removes the record, aborts pending initialization, and runs every
registered cleanup exactly once. A late asynchronous result is immediately
disposed and cannot transition the closed window back to managed state. Host
attachment failure removes every partial project node before propagating to the
bootstrap fail-open boundary. Runtime stop removes the global observers,
disposes every host/record, and is safe when called again. Shutdown behavior
does not depend on garbage collection.

Lifecycle records use a default-deny logger. They may identify the Firefox
build, stable phase/code, process-local window UUID, and `normal`/`private`
kind, but never a page URL, title, query, profile path, or native object. The
source and runtime evidence is in
`docs/research/firefox-153-window-lifecycle.md`,
`docs/research/firefox-153-shell-hosts.md`,
`docs/research/firefox-153-shell-health-recovery.md`, ADR-019, ADR-020, and
ADR-021.

## 4. Firefox bridge

`src/firefox/` is the primary location allowed to depend directly on Firefox internal APIs.

A bridge should:

- convert native objects into small immutable snapshots;
- convert native events into stable application events;
- provide explicit subscription and unsubscription;
- validate required symbols at runtime;
- model optional features as capabilities;
- keep native handles private;
- document each internal dependency with a current source reference and observed Firefox build.

A bridge should not:

- expose `gBrowser`, native tab DOM, browser elements, windows, or `Services` to Svelte;
- pretend an internal API is stable across versions;
- swallow upstream exceptions;
- combine unrelated Firefox subsystems into one large module;
- store privileged objects in serializable state or diagnostics.

## 5. Application and frontend layers

The application layer coordinates ordinary typed state, controllers, and feature policy. It must be usable without importing Firefox implementation modules directly.

Svelte mounts only into project-created XHTML elements. It must not reconcile `navigator-toolbox`, `tabbrowser-tabbox`, the native sidebar, popup sets, or any other Firefox-owned children.

Issue #8 validates one Svelte 5 root in the primary XHTML host of every managed
normal or private browser window. The privileged runtime supplies only the
ordinary `windowKind` prop and lifecycle callbacks; the component owns local
immutable smoke state and receives no Firefox handle, `Services`, browsing
value, or native DOM node other than its exact empty mount target. Mount,
health, official unmount, and fresh-state remount are explicit frontend API
operations.

The frontend owns:

- rendering;
- local interaction state;
- focus and accessibility behavior;
- calls to typed application and bridge contracts.

The frontend does not own:

- profile or file access;
- privileged module imports;
- native tab DOM lifecycle;
- SessionStore persistence;
- command discovery;
- security-sensitive native prompts.

## 6. DOM and CSS isolation

Use this priority order:

1. Every selector begins at a unique project shell root.
2. Project classes, attributes, custom events, and CSS variables use a consistent prefix.
3. Do not apply unscoped rules to `button`, `input`, `*`, or other generic selectors.
4. If Tailwind is adopted, disable Preflight and use a project-specific prefix.
5. Changes to retained native UI belong in a separate `native-integration.css`; every rule requires a documented reason and current source reference.
6. Use agent or author sheets only when an ordinary scoped stylesheet cannot solve a demonstrated problem.
7. Prefer text rendering and safe property assignment over unsanitized HTML.

The issue #8 result selects Svelte component CSS extracted at build time. Every
authored selector starts at `#fennevia-shell-app-root`, and the generated style
element is a child of the project-owned primary host. Real Firefox comparison
kept the computed styles of the native toolbox, sidebar, popup set, Urlbar
input, application-menu button, and modal prompt unchanged when that style was
toggled. Tailwind and Shadow DOM remain unselected because the scoped component
CSS satisfied the measured isolation and theme requirements without another
dependency or rendering boundary.

## 7. Native UI gate

The implemented root state attributes are:

```text
[data-fennevia-created]
[data-fennevia-mounted]
[data-fennevia-healthy]
[data-fennevia-active]
[data-fennevia-failed]
[data-fennevia-state="created|mounted|healthy|active|failed"]
```

Only a healthy shell may become active. Native-UI hiding rules must depend on
`data-fennevia-active`. A bootstrap, bridge, CSS, or frontend failure must
prevent or remove that attribute. `disposed` is controller state, not a retained
DOM marker: disposal removes every project state attribute. Safe start exits in
AutoConfig before a browser-window controller exists and therefore deliberately
sets no DOM attribute.

When a later issue implements the actual native-UI gate, native UI may be hidden
only while active and must never be removed. Package `0.5.0-dev` does not hide
it. Retaining native DOM preserves implicit dependencies in Firefox commands,
popups, customization, titlebar, and platform integration and provides the
recovery path.

## 8. Override policy

A Chrome Registry `override` replaces a Firefox resource before it loads and therefore has maintenance characteristics close to a source patch. Risks include:

- missing newly added upstream includes or side effects;
- changed relative-URI resolution;
- mandatory source diffs on every Firefox update;
- security fixes not reaching the replacement automatically;
- maintenance drifting toward an uncompiled Firefox fork.

Therefore:

- `patches/` is empty initially;
- every override requires a dedicated issue and architecture decision;
- the replaced upstream revision and path must be pinned;
- the replacement needs a documented update-diff workflow;
- regression tests and a removal plan are mandatory;
- overriding the complete `browser.xhtml` is prohibited during the initial roadmap.

## 9. Build, package, and artifacts

Application and frontend source belongs in `src/`. Directly authored bootstrap
and runtime source is rooted at `program/` and `profile/`; installable files and
their committed hashes are defined only by `package-manifest.json`. Generated
frontend artifacts enter that same inventory through `npm run build`; they are
never hand-edited in `profile/`, `dist/`, or an installed Firefox copy.

Production artifacts must be:

- deterministic;
- self-contained;
- free of CDN, dev-server, HMR, remote-font, and runtime-network dependencies;
- runnable without Node.js inside Firefox;
- reproducible through documented package-manager commands;
- checked for unexpected bare imports, chunks, dynamic fetches, and debug content.

Each production build also has an exact reviewed file inventory and passes `scripts/check-production-artifacts.ps1`. Unexpected files, including dynamically emitted chunks, fail the gate rather than being accepted by a glob. The operational rule set is in `docs/security-controls.md`.

ADR-022 selects one classic `ShellApp.js` IIFE for execution in each owning
browser-window global. `ShellStyles.sys.mjs` contains the extracted CSS as a
static string, and `THIRD_PARTY_NOTICES.txt` contains the bundled Svelte notice.
The build runs twice and compares exact bytes before replacing only those three
generated files, then synchronizes their SHA-256 values into
`package-manifest.json`. No source map, development source, loader package,
bare/dynamic import, HMR client, extra chunk, or runtime network endpoint is
installed.

Installed privileged source maps are prohibited for the current build. A later
debug-map proposal requires an explicit exposure and packaging decision; local
tool output must never enter the package inventory accidentally.

`scripts/fennevia-package.ps1` owns the Windows-first package lifecycle. It
accepts explicit program and profile targets, emits a redacted exact dry run,
requires paired hash-based ownership records, stages and journals changes on the
same volumes, rolls back partial failure, hard-disables by moving the AutoConfig
preference, and uninstalls only exact owned files. The normative contract and
interrupted-operation recovery procedure are in `docs/installation.md` and
ADR-018.

## 10. Security and privacy model

The runtime has system-principal capability. Consequently:

- minimize external dependencies;
- commit and review the lockfile;
- prohibit runtime remote executable content;
- do not transmit browsing data or telemetry;
- redact complete URLs, titles, queries, history, profile paths, and private-window state from normal logs;
- validate installation paths and owned files before mutation;
- keep security-sensitive prompts owned by Firefox;
- review resource exposure and dependency upgrades explicitly.

The normative policy is in `docs/security-and-privacy.md`. The threat model, logging schema, manifest review, installer preflight, private-window rules, security triggers, and automated artifact gate are in `docs/security-controls.md`.

## 11. Initial module boundaries

```text
src/
  bootstrap/
    entry.ts
  runtime/
    Runtime.ts
    WindowManager.ts
    WindowShell.ts
    HealthState.ts
    Logger.ts
  firefox/
    context.ts
    capabilities.ts
    disposables.ts
    tabs.ts
    navigation.ts
    commands.ts
    places.ts
    downloads.ts
  app/
    controllers/
    state/
  shell/
    App.svelte
    components/
  styles/
    shell.css
    native-integration.css
```

This is a target boundary, not permission to scaffold unused abstractions before the Phase 1 and Phase 2 evidence exists.

The current package combines the proven Phase 2 runtime boundary with the
generated Phase 3 frontend:

```text
profile/chrome/fennevia/content/
  Bootstrap.sys.mjs
  runtime/
    HealthState.sys.mjs
    Logger.sys.mjs
    Runtime.sys.mjs
    WindowManager.sys.mjs
    WindowShell.sys.mjs
  shell/
    ShellApp.js
    ShellStyles.sys.mjs
    THIRD_PARTY_NOTICES.txt
```

All ten profile files are exact package artifacts with committed hashes. The
three shell files are reproducible only from `src/` and build configuration;
the runtime modules remain reviewed source. The source/build boundary and
per-window execution decision are recorded in ADR-022.

## 12. Dependency direction

Allowed high-level direction:

```text
shell -> app contracts -> firefox bridge interface -> Firefox implementation
runtime -> bridge implementation and shell mount
bootstrap -> runtime entry only
```

Disallowed examples:

- Svelte importing a module that reads `gBrowser`;
- a bridge importing a Svelte store;
- an installer depending on runtime browsing state;
- bootstrap scanning arbitrary feature modules;
- project code requiring a native element because its visual replacement happens to resemble that element.
