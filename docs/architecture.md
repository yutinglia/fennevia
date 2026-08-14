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

1. Locate the active profile's project manifest.
2. Register the Chrome Registry manifest.
3. Import one privileged bootstrap entry point.
4. Report fatal failure and exit without hiding native UI.

It does not implement script discovery, hot reload, metadata parsing, sandbox abstraction, frontend UI, or application logic.

### Chrome Registry package

The package reserves stable project-owned logical URIs:

```text
chrome://my-firefox-shell/content/...
resource://my-firefox-shell/...
```

The initial manifest registers only a `content my-firefox-shell ...` package without `contentaccessible=yes`. The `resource://my-firefox-shell/` alias is reserved but omitted until a dedicated exposure review identifies an exact inert/public file inventory and #3 validates ordinary-web-content behavior. Use of manifest `style` is decided by the CSS spike. `override` is disabled by default.

Current Mozilla Chrome Registration documentation states that web content is not prevented from including files from `resource:` aliases. Treat every such mapping as content-visible unless current source and runtime evidence prove a narrower boundary. Never map privileged implementation, secrets, private data, source maps, or diagnostics there. Do not use `contentaccessible=yes` without a dedicated security review.

## 3. Runtime layer

The process-global runtime owns:

- bootstrap state;
- window discovery;
- global version and diagnostic metadata;
- capability checks shared across windows;
- safe-start state;
- global shutdown.

A per-window runtime owns:

- project XHTML hosts;
- that window's Firefox bridge instances;
- frontend mount and unmount;
- health state and native-UI gate;
- event, observer, timer, stylesheet, and mapping cleanup.

Each window must have a single idempotent disposer. Shutdown behavior must not depend on garbage collection.

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

## 7. Native UI gate

Recommended root state attributes include:

```text
[data-mfs-created]
[data-mfs-mounted]
[data-mfs-healthy]
[data-mfs-active]
[data-mfs-safe-start]
[data-mfs-failed]
```

Only a healthy shell may become active. Native-UI hiding rules must depend on `data-mfs-active`. A bootstrap, bridge, CSS, or frontend failure must prevent or remove that attribute.

Native UI is initially hidden rather than removed. This preserves implicit dependencies in Firefox commands, popups, customization, titlebar, and platform integration, and provides a recovery path.

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

## 9. Build and artifacts

The source of truth is `src/`. Production artifacts must be:

- deterministic;
- self-contained;
- free of CDN, dev-server, HMR, remote-font, and runtime-network dependencies;
- runnable without Node.js inside Firefox;
- reproducible through documented package-manager commands;
- checked for unexpected bare imports, chunks, dynamic fetches, and debug content.

Each production build also has an exact reviewed file inventory and passes `scripts/check-production-artifacts.ps1`. Unexpected files, including dynamically emitted chunks, fail the gate rather than being accepted by a glob. The operational rule set is in `docs/security-controls.md`.

Whether the final entry is an IIFE, ES module, or mixed runtime is decided by the bootstrap and frontend spikes from real Firefox evidence, not fixed in advance.

Source-map policy must distinguish local development artifacts from installed artifacts. Privileged source maps must not be unintentionally exposed through a content-accessible mapping.

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
