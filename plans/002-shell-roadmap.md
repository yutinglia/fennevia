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

Issue #31 supersedes only that initial production host geometry through
ADR-026. The current runtime keeps the same validated lifecycle and ownership
rules but uses one zero-layout frame under `#browser` with ordered, independent
top, left, right, and bottom XHTML hosts. The issue #6 record remains the
historical spike that proved namespace, insertion, rollback, and native-node
ownership constraints.

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

Issue #31 evolves only the original one-root mounting shape: the same fixed
tree-fragment IIFE and extracted local stylesheet now create four official
Svelte roots inside one frame. Build determinism, one-shot registration,
XHTML ownership, and official unmount requirements remain unchanged.

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

Progress (2026-08-15): issue #9 implements only the shared boundary required by
those future contracts. `src/firefox/bridge-boundary.ts` supplies exclusive
per-window contexts, required/optional capability snapshots, privacy-safe typed
errors, idempotent event disposal, and context-scoped opaque native-handle
registries. `WindowShell.sys.mjs` health-gates and privately owns the generated
bridge ESM; Svelte receives none of it in #9. Issue #10 later passes only a
frozen ordinary-data tabs contract. ESLint enforces the shell/app side of the
boundary. Firefox 153.0.4 normal, second, private, Browser Toolbox, injected
required-capability failure, restoration, and cleanup matrices passed. No tab
or navigation action, service container, compatibility fallback, or native-hide
rule was added. See ADR-023 and
`docs/research/firefox-153-bridge-boundary.md`.

Issue #10 implements the first consumer without growing a service framework.
The per-window tabs controller uses `gBrowser.openTabs`, seven native event
types, one context registry, immutable snapshots, and explicit
select/open-new-tab/close/pin/unpin actions. Closed and cross-window IDs fail
before native access. `src/app/tab-state.ts` provides a framework-independent
reactive adapter, while Svelte renders only a synchronized count until #11.
Title/favicon privacy filtering, selected/last-tab ordering, rapid lifecycle,
normal/second/private isolation, disposal, and injected tabs-capability
fail-open behavior passed. See ADR-024 and
`docs/research/firefox-153-tabs-bridge.md`.

Issue #12 implements the second consumer without combining it with tabs. The
per-window navigation controller mirrors five retained command elements,
invokes five current `BrowserCommands` methods, and reconciles one immutable
selected snapshot from two tab events, selected/top-level progress callbacks,
and one command-attribute observer. `src/app/navigation-state.ts` provides the
separate ordinary reactive adapter. Bounded title/URI text, fresh selected-
browser actions, missing-capability fail-open, normal/second/private isolation,
and deterministic disposal passed. See ADR-027 and
`docs/research/firefox-153-navigation-controls.md`.

## Milestone E: Custom tab strip MVP

Implement in this order:

1. tab order, selected state, title, and favicon fallback;
2. select, new, and close actions;
3. pinned tabs;
4. loading, attention, and audio state as separately justified additions;
5. reorder and drag behavior;
6. context actions.

Do not begin complex drag-and-drop, multi-select, groups, or workspace behavior before the first three items are stable.

Progress (2026-08-15): issue #11 completes the MVP on Firefox 153.0.4 for
Windows. One Svelte tablist renders the issue #10 native order, selected/title,
safe favicon fallback, pinned, and loading state. It supports select, new,
close, pin/unpin, RTL-aware roving arrow navigation, Home/End, Enter/Space,
Delete, named sibling actions, deterministic close-focus restoration, bounded
pinned/regular widths, and horizontal overflow. Long bidirectional/markup-like
titles and failed image data remained text/property-only. Normal, second,
private, Browser Toolbox, rapid action, disposal/remount, native-style
isolation, and bridge-capability fail-open matrices passed while the native tab
strip stayed visible. Drag reorder, groups/workspaces, multi-select, audio,
attention, previews, and full context menus remain deferred. See ADR-025 and
`docs/research/firefox-153-tab-strip.md`.

Issue #31 supersedes only the horizontal presentation. The same ordinary-data
contract, semantic sibling actions, and roving-focus model now render vertically
inside the left-edge surface with bounded vertical overflow. Up/Down replace
Left/Right for the vertical orientation; Home/End and action behavior remain.

### Milestone E.1: Four-edge shell frame

Issue #31 adds the common visual and interaction boundary used by the remaining
Phase 5 features:

- one zero-layout frame with independent top, left, right, and bottom hosts;
- explicit pointer, focus, keyboard, popup, and bounded programmatic reveal
  holds with one tracked hide timer per edge;
- deterministic corner ownership, overlap clearances, and suspension for
  customize mode, DOM fullscreen, and native modal state;
- exact edge keyboard commands, focus transfer/restoration, and Escape policy;
- project-scoped glass tokens with near-solid, reduced-transparency,
  reduced-motion, and forced-colors fallbacks.

The right and bottom surfaces remain honest placeholders until their feature
issues land; issue #12 replaces only the top placeholder. The frame does not
hide, replace, or resize Firefox-owned UI or content. See ADR-026 and
`docs/research/firefox-153-four-edge-shell.md`.

## Milestone F: Navigation and address input MVP

Implement:

- back and forward enabled state;
- back, forward, reload, stop, and new-tab actions;
- selected-tab URI and title display as plain data;
- an address input with independent editing state;
- basic URL and search submission through Firefox's existing semantics.

Do not reimplement Firefox Urlbar providers, rich suggestions, autofill, search modes, extension integration, identity UI, or permission UI in the MVP. Research the current Firefox submission path and keep any temporary native controller dependency behind the bridge.

Progress (2026-08-15): issue #12 completes the navigation half on Firefox
153.0.4 for Windows. Back/Forward enabled state and Reload/Stop loading state
match Firefox's retained command elements; all five actions use current
`BrowserCommands`. Selected title/display URI remain bounded per-window text,
and all updates are event-driven. The top edge reuses issue #31's reveal,
focus, keyboard, collision, glass, environment, and cleanup contracts without
another trigger or timer. Native navbar/Urlbar remain visible. Issue #13 still
owns independent address editing, URL/search submission, and `Ctrl+L`.

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
