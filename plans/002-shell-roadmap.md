# Shell Implementation Roadmap

This document defines the implementation order after the bootstrap chain is proven. Every custom UI slice must first be tested while Firefox native UI remains visible.

Issue #5 established the single process runtime and per-window lifecycle used by
all milestones below. New host or recovery work registers only through that
initializer/cleanup boundary; it must not create a parallel browser-window
observer or retain native windows outside the runtime.

## Milestone A: Isolated shell hosts

Create project-owned XHTML mount islands for each managed browser window, initially including:

- a top or primary chrome host;
- an optional sidebar host;
- an overlay host.

Requirements:

- Create hosts explicitly in the XHTML namespace.
- Use project-prefixed IDs, classes, attributes, and custom events.
- Let the frontend framework manage only host descendants.
- Support complete removal and framework unmount.
- Do not move, remove, or reconcile Firefox-owned DOM.
- Render only a diagnostic surface containing non-sensitive runtime, version, window-type, and health information.

Progress (2026-08-15): issue #6 completed this milestone on Firefox 153.0.4 for
Windows. The runtime creates one visible primary XHTML host, one hidden sidebar
host, and one hidden inert overlay host in each managed normal/private window.
Real second-window, cleanup, changed-insertion-point, native modal/content/OS
control, and Browser Toolbox Inspector checks passed. The diagnostic reports
ready state rather than the future Milestone B health machine; native UI remains
fully visible. See `docs/research/firefox-153-shell-hosts.md` and ADR-020.

## Milestone B: Mount gate and recovery

Maintain separate states for:

- `created`: hosts exist;
- `mounted`: frontend mount completed;
- `healthy`: required capabilities and self-checks passed;
- `active`: native visible UI may be hidden;
- `failed` and `disposed`.

During this milestone, never enter `active` automatically. Validate the state machine and add:

- an emergency privileged keyboard toggle;
- a safe-start preference or sentinel;
- fatal-error reporting;
- deterministic cleanup on unload;
- failure-injection hooks available only in development mode.

Progress (2026-08-15): issue #7 completed this milestone on Firefox 153.0.4 for
Windows. `HealthState.sys.mjs` enforces the six states and cumulative project
root markers, while `WindowShell.sys.mjs` owns a finite two-second check,
reverse cleanup, fixed capability failures, and an explicit healthy-only
activation method. Production stops at `healthy`; no native selector is hidden.
The independent `Ctrl+Alt+Shift+F12` system-group listener and AutoConfig
`fennevia.safeStart` preference passed complete/broken-package recovery checks.
Failure selection exists only as unit-test collaborators, not an installed
preference or global. See ADR-021 and
`docs/research/firefox-153-shell-health-recovery.md`.

## Milestone C: Frontend build and styling

Validate a Svelte 5 production bundle for:

- reactive state updates;
- event handlers;
- conditional rendering;
- mount, unmount, and remount;
- normal, second, and private-window behavior;
- correct XHTML element namespace;
- absence of dev-server, HMR, CDN, and runtime network dependencies.

Evaluate styling in this order:

1. Plain CSS scoped from a unique shell root.
2. Svelte component CSS and extraction behavior.
3. Manifest or runtime stylesheet registration only where it provides a verified benefit.
4. Tailwind utility generation only if it materially improves the project.
5. Shadow DOM only when it solves a demonstrated isolation problem without harming Firefox theme variables, accessibility, popups, or focus behavior.

If Tailwind is adopted, disable Preflight, use a project-specific prefix, and guarantee that generated selectors cannot reset native Firefox chrome.

Progress (2026-08-15): issue #8 completed this milestone on Firefox 153.0.4 for
Windows. The production Svelte 5 bundle runs as one classic IIFE in each
validated browser-window global, uses the maintained tree-fragment compiler
strategy for Firefox's XML/XHTML document, and exposes a frozen lifecycle API
only through a one-shot callback deleted after load. Extracted Svelte component
CSS remains rooted at `#fennevia-shell-app-root`; Tailwind, Shadow DOM, runtime
stylesheet registration, and a component library were unnecessary. State,
events, conditionals, template content, normal/second/private isolation,
official unmount/remount, missing/throwing fail-open behavior, Browser Toolbox
ownership, deterministic build output, and the exact artifact gate passed. See
ADR-022, `docs/research/firefox-153-svelte-build.md`, and
`docs/dependency-reviews/frontend-toolchain-2026-08-15.md`.

## Milestone D: Firefox bridge

Start with small interfaces rather than a large service framework. A tabs contract may resemble:

```ts
interface BrowserTabsBridge {
  snapshot(): readonly TabSnapshot[];
  subscribe(listener: (event: TabEvent) => void): () => void;
  select(tabId: string): void;
  close(tabId: string): void;
  open(options?: OpenTabOptions): string;
}
```

Create a similarly small navigation contract. Native tab, browser, and window references must never become serializable Svelte state. The bridge owns opaque-ID-to-native-handle mappings and their cleanup.

## Milestone E: Custom tab strip MVP

Implement in this order:

1. tab order, selected state, title, and favicon fallback;
2. select, new, and close actions;
3. pinned tabs;
4. loading, attention, and audio state as separately justified additions;
5. reorder and drag behavior;
6. context actions.

Do not begin complex drag-and-drop, multi-select, groups, or workspace behavior before the first three items are stable.

## Milestone F: Navigation and address input MVP

Implement:

- back and forward enabled state;
- back, forward, reload, stop, and new-tab actions;
- selected-tab URI and title display as plain data;
- an address input with independent editing state;
- basic URL and search submission through Firefox's existing semantics.

Do not reimplement Firefox Urlbar providers, rich suggestions, autofill, search modes, extension integration, identity UI, or permission UI in the MVP. Research the current Firefox submission path and keep any temporary native controller dependency behind the bridge.

## Milestone G: Sidebar MVP

Create a project-owned sidebar layout that can initially contain:

- tabs or workspaces placeholders clearly marked as incomplete;
- optional read-only bookmarks or history prototypes;
- settings and non-sensitive diagnostics;
- an explicit native-fallback action.

Keep the Firefox native sidebar intact until the custom sidebar can mount, resize, hide, show, restore focus, and dispose reliably.

## Milestone H: Hide the native visible shell

Begin only after tabs, navigation, address input, sidebar, safe start, emergency fallback, and failure injection are working.

Candidates to hide after current-source validation include:

- visible parts of `#navigator-toolbox`;
- the native tab strip;
- native navigation and Urlbar UI;
- the bookmarks toolbar;
- the native sidebar launcher, box, and splitter.

Preserve:

- browser content and tabbox infrastructure;
- commands and controllers;
- popup, permission, authentication, certificate, and dialog infrastructure;
- notifications unless a reviewed replacement exists;
- DevTools and Browser Toolbox;
- native titlebar and window controls until a separate platform-specific issue validates replacements.

Use a reversible root-state gate. Do not call `remove()` on native infrastructure and do not use a full `browser.xhtml` override.

## Milestone I: Hardening

Validate:

- cold start, restart, and session restore;
- normal, second, and private windows;
- fullscreen and customize mode;
- Browser Toolbox and DevTools;
- permission, download, notification, authentication, and extension-install prompts where reproducible;
- broken manifest, entry, UI bundle, stylesheet, and bridge capabilities;
- startup cache and stale artifacts;
- repeated window and tab lifecycle cleanup;
- install, update, disable, and uninstall workflows;
- dependency, source-map, logging, and resource-exposure policies.

## Deferred work

The following require separate plans and issues:

- complete Urlbar suggestion and provider UI;
- Firefox View replacement;
- identity and permission panel replacement;
- full Downloads manager replacement;
- extension toolbar and action replacement;
- custom titlebar and window controls;
- workspace and session model;
- complete bookmarks and history management;
- any `browser.xhtml` or internal-component override;
- cross-platform installer and release packaging.
