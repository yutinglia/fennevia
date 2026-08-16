# Architecture

## 1. System boundary

This project is neither a Gecko embedder nor a Firefox source fork. Stock Firefox continues to own the process model, browser windows, content processes, tabs, networking, security model, web-content isolation, and session persistence.

This project owns the visible browser shell and a privileged integration runtime.

```text
+--------------------------------------------+
| Svelte shell |
| components / local state / accessibility |
+-------------------+------------------------+
                    | plain typed contracts
+-------------------v------------------------+
| Application state and controllers |
+-------------------+------------------------+
                    | bridge API
+-------------------v------------------------+
| Firefox bridge |
| gBrowser / commands / Places / Downloads |
+-------------------+------------------------+
                    | privileged APIs
+-------------------v------------------------+
| Stock Firefox browser chrome and Gecko |
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
plus Firefox's fixed `PrivateBrowsingUtils` module. `WindowShell` has fixed
relative imports of `HealthState` and `NativeUi`; there is still no discovery or
dynamic import.
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
- that window's project XHTML frame and edge hosts, Firefox bridge instances,
  frontend roots, health state, and native-UI gate.

Issue #5 established the lifecycle, and issue #6 proved the first three-island
initializer. ADR-026 supersedes that production geometry. The current
`WindowShell.sys.mjs` validates the exact document hierarchy and creates one
zero-layout XHTML frame as an absolute child of `#browser`, immediately before
`#tabbrowser-tabbox`. Ordered top, left, right, and bottom XHTML hosts each own
one empty mount target and one Svelte root. One address-overlay XHTML host is
ordered last and owns the centered popup's fifth target/root. A generated style
node is a separate frame child and does not participate in edge-host ordering.
Normal and private windows receive the same complete frame. Project code owns
only this frame and its descendants; the frame itself never moves a native node
or participates in browser-content layout. ADR-032 adds one separate privileged
controller that changes only source-validated native surfaces; ADR-037 extends
that sheet with the explicitly selected 7px decorative browser gutter.

Issue #7 adds a per-window controller around those hosts. `HealthState.sys.mjs`
owns the only root-state transition table: `created -> mounted -> healthy ->
active`, plus terminal `failed` and `disposed` handling. State attributes are
project-prefixed, cumulative through `active`, and removed on disposal. An
illegal transition enters `failed`, removes the active marker first, and is
reported rather than accepted. Duplicate transitions and disposal are
idempotent.

The production initializer mounts synchronously and then applies a finite
2,000 ms health deadline. Its current self-check validates exact frame and host
identity, placement and order, five XHTML mount targets and frontend roots, an
attached generated stylesheet with parsed rules, the registered emergency
handler, and every declared capability. The extension points used to inject
failures in unit tests are ordinary constructor collaborators; the installed
initializer always uses fixed production defaults and exposes no preference,
DOM global, or runtime debug switch for choosing a failure mode.

`initializeWindowShell` awaits the complete health result and then makes the
single production call to `lifecycle.activate()`. Only this final transition
enables ADR-032's exact native stylesheet; an exception reports failure and
disposes that window before returning. `Ctrl+Alt+Shift+F12` is registered directly on each chrome window in
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
`docs/research/firefox-153-shell-health-recovery.md`,
`docs/research/firefox-153-four-edge-shell.md`, ADR-019 through ADR-022, and
ADR-026. ADR-032 and
`docs/research/firefox-153-content-only-activation.md` record the active native
gate layered on that lifecycle.

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

Issue #9 implements the first enforceable boundary in
`src/firefox/bridge-boundary.ts`. Vite compiles that source into the single
private installed ESM
`chrome://fennevia/content/firefox/BridgeBoundary.sys.mjs`; the generated file
is not source of truth. `WindowShell.sys.mjs` creates exactly one boundary from
the existing `WindowManager` context for each managed window and retains it in
the same frame-keyed private record as the frontend API. It passes no bridge
implementation object, native handle, or capability object to Svelte. Issues
#10, #12, #13, #14, #32, #37, and ADR-037 pass only frozen ordinary-data tabs,
navigation/address, bookmarks, anonymous download-status, Urlbar coverage, and
fixed browser-tool contracts through separate application adapters.

The boundary validates `window.document.defaultView`, the browser document URI,
the process-local window ID, and normal/private kind before claiming a context.
An active window or context ID cannot be claimed twice. Required capabilities
are asserted inside the existing bounded health check; optional capabilities
are reported explicitly but do not create a half-initialized failure. Errors
carry only a fixed code, phase, Firefox version, build ID, window kind, and
allowlisted Firefox symbol. A missing required symbol therefore follows the
same reverse cleanup and native-visible fail-open path as every other #7 health
failure.

Opaque native-handle registries are scoped to one boundary generation. IDs are
stable only while that registry owns the handle; malformed, stale, and foreign
registry IDs produce distinct typed errors. Registry snapshots contain counts
and fixed state only. Event subscriptions and cleanup callbacks return
idempotent disposers, and boundary disposal continues through all owned
subscriptions and registries before reporting a typed cleanup error. These are
the only shared utilities consumed by the tabs, navigation, bookmarks,
downloads, Urlbar-coverage, and browser-tools bridges; no service locator,
dependency-injection framework, or generic Firefox SDK exists.

ESLint applies a static boundary to `src/shell/` and ordinary `src/app/` code:
Firefox implementation imports, privileged globals, and direct Firefox-owned
properties such as `gBrowser` are rejected. Future public bridge contracts must
contain ordinary snapshots/events/actions only and remain separate from the
privileged implementation.

Issue #10 adds `src/firefox/tabs.ts` to the same generated private ESM. One
controller per boundary reads `gBrowser.openTabs`, keeps native tabs in that
boundary's opaque registry, and reconciles immutable snapshots after the
minimal open/close/select/move/pin/unpin/attribute event set. The public object
contains only primitive snapshots and explicit actions; `WindowShell.sys.mjs`
passes that object, never the controller or native window, to the frontend.

`src/app/tab-state.ts` is a second, unprivileged copy boundary. It validates and
copies exact snapshot fields into a Svelte-independent reactive adapter, drops
unknown properties, owns frontend subscriptions, and releases the public bridge
on unmount. Issue #11 renders that ordinary state as one accessible project-owned
tab strip. Primary tab buttons expose selected semantics and roving keyboard
focus; pin and close remain sibling controls. Titles stay bounded text, favicon
values use a strict internal/raster allowlist with a property-only image and
explicit fallback, and no browsing value enters logs or diagnostics. Current
source and runtime evidence is in `docs/research/firefox-153-tabs-bridge.md`,
`docs/research/firefox-153-tab-strip.md`, ADR-024, and ADR-025.

Issue #12 adds `src/firefox/navigation.ts` beside tabs in the same generated
private ESM. Issue #13 extends that same coherent per-window controller rather
than introducing a second native navigation owner. It validates retained native
command elements, `BrowserCommands` actions, Urlbar value/submission, selected
browser/tab, identity and protections handlers, the content-blocking allow
list, paired tabs progress methods, event target, URI shape, and command
observer. It reconciles one immutable selected-navigation snapshot from
selected/top-level location, state, security, and content-blocking callbacks,
selected tab/attribute events, and command `disabled` mutations. Background or
non-top-level progress is ignored, equal snapshots do not publish, and there is
no polling.

Actions invoke the current window's `BrowserCommands` methods after re-reading
the selected browser and relevant command state; session-history, reload/cache,
stop, and new-tab policy remain Firefox-owned. Address submission writes only a
validated bounded draft to the native Urlbar and invokes `handleCommand()`, so
Firefox retains fixup, search, principal, disposition, and telemetry policy.
The public contract contains only booleans, bounded title/display/location
text, fixed connection/protection enums, subscriptions, and named actions.
`src/app/navigation-state.ts` validates and copies it again before Svelte
receives an adapter. Native browsers, tabs, Urlbar, command elements, handlers,
allow-list, observers, progress objects, and windows remain inside the
privileged boundary. Missing or later-failing dependencies use the existing
health/fail-open path. See ADR-027, ADR-028,
`docs/research/firefox-153-navigation-controls.md`, and
`docs/research/firefox-153-address-popup.md`.

Issue #14 adds `src/firefox/bookmarks.ts` to the same generated private ESM.
One controller per window loads the fixed current Places modules, registers one
paired `PlacesUtils.observers` listener, and keeps bookmark GUIDs, result
records, URL objects, native node-like values, services, and the owning window
inside the privileged layer. Its public object exposes only four localized root
snapshots, opaque context-bound IDs, bounded child pages, one fixed tree-change
event, and current/new-tab open actions.

The bridge never calls the unimplemented `Bookmarks.fetchTree()`. A child page
uses one parent lookup plus at most 32 indexed `Bookmarks.fetch()` calls; the
application retains only one page per loaded branch, caps depth at 8 and open
folders at 20, and drops descendant pages on collapse. Observer bursts are
bounded and coalesced, refresh only already-loaded affected parents, and use no
polling or process-global tree mirror. Initial roots and the first page must
finish before health succeeds.

Opening resolves the opaque ID back to a current bookmark record, rejects
stale/foreign/folder and `javascript:`, `data:`, `vbscript:`, or `place:`
targets, then delegates node conversion and opening to
`PlacesUIUtils.promiseNodeLikeFromFetchInfo()` and `openNodeIn()`. Firefox keeps
URL security checks, trusted-link principal policy, bookmark transition data,
background-tab preference, and private-window targeting. URLs never enter the
public snapshot or DOM. See ADR-029 and
`docs/research/firefox-153-bookmarks-surface.md`.

Issue #32 adds `src/firefox/downloads.ts` to the same generated private ESM.
One controller per window imports the fixed current Downloads module, selects
PUBLIC or PRIVATE from the validated window kind, and owns exactly one paired
`DownloadList` view. Initial replay retains current nonterminal work but ignores
old terminal history. Added, changed, removed, and batch callbacks reconcile
without polling; initial list readiness and view capabilities are required for
health.

The bridge mirrors current Firefox state precedence and computes active
aggregate progress from privileged byte totals. Any unknown active size becomes
explicit indeterminate output. Only state, optional integer percentage,
context-bound opaque ID, six anonymous items, three newly observed terminal
records, and counts capped at 999 reach the application adapter. Native
download/list/view/source/target/error objects, filenames, paths, source URLs,
private markers, and byte values remain privileged and absent from DOM/logs.
The bridge offers no file action and never requests edge reveal. See ADR-030
and `docs/research/firefox-153-downloads-surface.md`.

Issue #37 adds `src/firefox/urlbar-coverage.ts` to the same generated private
ESM. One controller per window requires the current Urlbar owner roots,
`MutationObserver`, and `window.openLocation()`, then observes only the document
root, `gURLBar`, the permission subtree, and page-action subtree. It exposes
fixed sharing, blocked-permission, and applicable-item enums plus booleans; it
never exposes URLs, origins, principals, certificates, permission records,
extension identities, action IDs, localized Firefox labels, native nodes, or
controllers.

The bridge is read-only. It does not clone or invoke Firefox-owned Urlbar
children. The detailed popup's explicit native-access action first closes the
project popup and then calls Firefox's `openLocation()`, preserving providers,
suggestions, one-offs, extension actions, prompts, and native panels. One
observer is disconnected exactly once with the window. See ADR-031 and
`docs/research/firefox-153-urlbar-coverage.md`.

ADR-037 adds `src/firefox/browser-tools.ts` to the same generated private ESM.
One controller per window validates the twelve fixed Firefox owners needed for
nine actions: site information, protections, site permissions, native
Downloads, Unified Extensions, application menu, Settings, native
customization, and complete original-toolbar access. It re-resolves every
owner at action time. Anchored actions first request the existing reversible
native-toolbar reveal, then focus and delegate to the original owner; Firefox
continues to populate and operate every resulting panel.

The public contract contains only nine fixed availability booleans and nine
fixed action strings. It contains no URL, certificate, tracker, permission,
extension, download, widget, preference, native node, handler, panel, or
window. The complete-toolbar action reveals the current navbar and focuses an
original navigation control instead of enumerating `CustomizableUI`. The
unprivileged adapter validates results and releases its per-window reference on
unmount. See ADR-037 and
`docs/research/firefox-153-single-line-toolbar-handoffs.md`.

## 5. Application and frontend layers

The application layer coordinates ordinary typed state, controllers, and feature policy. It must be usable without importing Firefox implementation modules directly.

Svelte mounts only into project-created XHTML elements. Structural frontend
nodes stay XHTML; the sole namespace exception is a project-authored inline
glyph subtree rooted at `svg[data-fennevia-icon]`. Health rejects every other
mixed project namespace. Svelte must not reconcile `navigator-toolbox`,
`tabbrowser-tabbox`, the native sidebar, popup sets, or any other Firefox-owned
children.

Issue #8 validated the original single Svelte 5 root. Issue #31 keeps the same
fixed tree-fragment IIFE and one-shot API but mounts four independent roots in
the ordered edge targets. Issue #13 adds one final address-overlay target/root
inside the same frame. The privileged runtime supplies ordinary window kind,
the five owned targets, and narrow lifecycle/data contracts; components receive
no Firefox handle, `Services`, browsing value, or Firefox-owned DOM node. One
shared framework-independent controller coordinates edge visibility, while
each root retains independent component ownership. Mount, health, official
unmount, and fresh-state remount are explicit frontend API operations.

Issue #12 originally replaced the top placeholder with four accessible
navigation controls and bounded status. ADR-037 keeps that navigation/tool
state in one non-wrapping row. ADR-038 removes the top address cluster and
places project-owned minimize, maximize/restore, and close buttons on the
right of that row. The primary cluster is Back, Forward, Reload/Stop, and
Home. Home calls the current window's `BrowserCommands.home()` and does not
read the configured homepage URL. Middle-click on Back, Forward, Home, and
Reload copies only pointer modifiers and lets Firefox open the result in a
new tab. New-tab remains on the left tab strip, not
the top row. Opening a tab after the left surface has its initial snapshot
uses the shared programmatic reveal to show the left edge briefly and
highlights only the newly added tab IDs.
Shortcut hints float outside each revealed panel. Edge panels have no title chrome or hide buttons; they close
through `Escape`, pointer leave, and the documented keyboard shortcut.
Responsive rules progressively hide secondary controls
while retaining accessible names, Unified Extensions, complete
original-toolbar access, and the application menu. The row consumes only
ordinary adapters and the existing top-edge focus/reveal contract; it does
not inspect native DOM or create another trigger, timer, controller, or widget
registry.

Issue #13 replaces the old left address placeholder with a non-editable compact
launcher above tabs and mounts `AddressPopup.svelte` in the fifth root. The
launcher displays bounded committed location plus compact labels derived from
real Firefox connection/protection enums. The popup owns the sole custom input,
an independent per-window draft, fuller labels, focus restoration, and
popup-priority edge suppression. It never moves native Urlbar/identity/
protections DOM or renders inferred security state.

Issue #37 extends that same popup with a full-width site-permission card, fixed
applicable Firefox-control labels, and one native Urlbar handoff button.
ADR-037's Trust/identity, protections, and permission handoffs remain available
from the centered popup and original-toolbar path rather than a second top-row
launcher. All complete security/permission/action panels and commands stay
Firefox-owned, and no second popup, input, edge controller, timer, or provider
stack is added.

Issue #14 replaces the right placeholder with `BookmarksPanel.svelte`. It uses
the existing right host, trigger, controller, focus restoration, collision
rules, glass tokens, and disposer. A compact native four-root `select` fronts
one ordinary nested list. Folder children load only on expansion; fixed Previous
and Next controls replace rather than accumulate pages. The location dropdown
switches roots; Arrow keys, Home/End, Enter/Space, Ctrl/Command+Enter, middle
click, and an explicit new-tab control cover list traversal and opening. Separators are non-focusable, stable opaque IDs
preserve focus across rename/reorder, and deletion moves focus to the nearest
surviving item or selected root. No second trigger, timer, popup stack, URL,
favicon request, bookmark-management action, or native Places DOM is added.

Issue #32 replaces the bottom placeholder with `DownloadsPanel.svelte`. It uses
the existing bottom host, reveal/focus controller, collision policy, glass
tokens, environment suspension, and disposer. The compact panel renders a
fixed anonymous summary, accessible determinate or indeterminate progress, and
at most six state pills. Updates while hidden never change reveal state; there
is no feature timer, action, filename, path, remote asset, native-panel
mutation, or permanent content padding. Firefox's native Downloads panel,
notifications, safety, reputation, and management remain authoritative.

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
5. Changes to retained native UI belong only in the isolated native-UI controller stylesheet; every exact rule requires a documented reason and current source reference.
6. Use agent or author sheets only when an ordinary scoped stylesheet cannot solve a demonstrated problem.
7. Prefer text rendering and safe property assignment over unsanitized HTML.

The issue #31 result keeps Svelte component CSS extracted at build time. Every
authored selector starts at `#fennevia-shell-frame-host`, and the generated
style element is a child of the project-owned frame. Real Firefox comparison
kept the computed styles of the native toolbox, sidebar, popup set, Urlbar
input, application-menu button, and modal prompt unchanged when that style was
toggled. Tailwind and Shadow DOM remain unselected because the scoped component
CSS satisfied the measured isolation and theme requirements without another
dependency or rendering boundary.

Issue #11 first proved the tab strip boundary horizontally; ADR-026 retains its
data and accessibility contract but reorients it into the left edge. Pinned and
regular items use bounded project-only layout, many tabs overflow inside one
vertical scroller, and forced-colors/focus rules remain rooted at the frame. The
Browser Toolbox ownership walk excludes Firefox-generated native-anonymous
scrollbar descendants before asserting XHTML project ownership; it does not
reclassify those browser-owned XUL widgets as authored shell DOM. No selector
in the component stylesheet targets the native tab strip. ADR-032's separate
active-only sheet collapses only its `.toolbar-items` owner.

The ADR-037/ADR-038 top row uses the same frame-rooted token and control
classes. Top-specific selectors cover one-line flex zoning, progressive
disclosure, native-disabled state, loading emphasis, project-authored SVG
glyphs, window-control grouping, reduced motion, and forced colors. Hover,
active, and focus-visible behavior remains the common owned-control policy. No
selector targets the native navbar, Urlbar, command set, or toolbox from
component CSS; ADR-032 owns the separate reversible native sheet.

The issue #14 right panel likewise uses only frame-rooted project classes and
the existing responsive right-edge bounds. It renders type glyphs rather than
remote favicons, uses text/property bindings for hostile titles, and provides
solid, reduced-motion, and forced-colors states through the shared shell
contract. No selector targets Firefox's bookmarks toolbar, sidebar, Library,
popup set, or Places views from component CSS. ADR-032 independently owns the
bookmarks-toolbar and exact native-sidebar visibility rules.

The issue #32 bottom panel uses the same frame-rooted glass and accessibility
tokens. Its progress value is a scoped custom property set only from a validated
integer percentage; indeterminate output is a static hatch, not a continuous
animation. Responsive and forced-colors rules remain inside the existing bottom
surface. No selector targets Firefox's Downloads button, panel, notifications,
or browser content.

The issue #37 popup additions remain frame-rooted and reuse the existing
responsive overlay. Permission/action chips render only fixed project labels;
no selector targets Firefox's Urlbar, identity, permission, page-action, panel,
or notification-anchor DOM. The native-access button uses the shared control
and focus-visible policy.

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

ADR-032, as extended by ADR-037 and ADR-038, implements the gate with a seven-rule
project-owned style and two temporary root markers:

```text
[data-fennevia-native-ui-revealed]
[data-fennevia-native-ui-suspended]
```

At active rest, the toolbox and horizontal toolbar geometry collapse together
with exact non-caption content, the bookmarks toolbar, and exact native sidebar
surfaces. Native vertical-tab mode keeps the navbar/titlebar owner and
collapses only exact direct content. The retained `#browser` receives a 7px
gutter and the tabbox receives only border/radius/clip styling using Firefox's
`--chrome-block-radius` when present, otherwise 4px, so project panels stay
concentric with the 8px window corners.
Notifications,
popups, dialogs, and content infrastructure remain untargeted. Firefox's
selected native titlebar button box remains in Firefox DOM for fail-open
recovery; ADR-038 collapses every native caption copy at rest and shows
project-owned window controls on the right of the visible top row. No caption
node is moved or replaced.

Native focus, anchored native popups, an open native sidebar, and explicit
Urlbar or original-toolbar handoffs set temporary reveal. Customize and
native-dialog state set suspension. DOM fullscreen also suspends project hiding
while Firefox's own fullscreen CSS remains authoritative; browser fullscreen
retains active mode. The controller validates exact nodes and seven parsed
rules before health, then watches integrity. Invalid or partial CSS and stable
target drift suspend first and request per-window fail-open disposal. Clearing
active restores Firefox immediately without Svelte or restart. Retaining all
native DOM preserves implicit command, popup, customization, titlebar, and
platform integration.

The complete owner/replacement/fallback inventory and Firefox 153 evidence are
in `docs/research/firefox-153-content-only-activation.md`.

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
browser-window global. ADR-028 extends its current mount shape to four edge
roots plus one address-overlay root inside the one validated frame.
`ShellStyles.sys.mjs` contains the extracted CSS as a
static string, and `THIRD_PARTY_NOTICES.txt` contains the bundled Svelte notice.
The build runs twice and compares exact bytes before replacing only those three
generated files, then synchronizes their SHA-256 values into
`package-manifest.json`. No source map, development source, loader package,
bare/dynamic import, HMR client, extra chunk, or runtime network endpoint is
installed.

ADR-023 adds a separate deterministic ESM build for
`BridgeBoundary.sys.mjs`. It runs twice in isolated temporary directories,
requires one exact output, and rejects source maps, HMR, dynamic imports,
runtime network APIs, and endpoint literals. `npm run build` completes both
generated targets before synchronizing all source and artifact hashes into the
package manifest.

Installed privileged source maps are prohibited for the current build. A later
debug-map proposal requires an explicit exposure and packaging decision; local
tool output must never enter the package inventory accidentally.

`scripts/fennevia-package.ps1` owns the Windows-first package lifecycle. It
accepts explicit program and profile targets, emits a redacted exact dry run,
requires paired hash-based ownership records, stages and journals changes on the
same volumes, rolls back partial failure, hard-disables by moving the AutoConfig
preference, repairs only one completely absent ownership side from exact
surviving source proof, and uninstalls only exact owned files. An incomplete
pair blocks state-changing install/update/disable/enable actions; explicit
Uninstall may use one valid survivor only after verifying present owned hashes
and absent peer metadata. `scripts/fennevia.ps1` is the recommended interactive
front end: a native in-place TUI that does not change those contracts. The
normative contract and interrupted-operation recovery procedure are in
`docs/installation.md` and ADR-018/ADR-033/ADR-036/ADR-040.

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

## 11. Current module boundaries

```text
src/
  firefox/
    bridge-boundary.ts
    index.ts
    tabs.ts
    navigation.ts
    browser-tools.ts
    urlbar-coverage.ts
    bookmarks.ts
    downloads.ts
  app/
    address-popup.ts
    browser-tools-state.ts
    bookmark-state.ts
    download-state.ts
    edge-surfaces.ts
    navigation-state.ts
    tab-state.ts
    tab-strip.ts
    urlbar-coverage-state.ts
  shell/
    AddressPopup.svelte
    App.svelte
    BookmarksPanel.svelte
    DownloadsPanel.svelte
    ShellIcon.svelte
    entry.ts
    index.ts
    styles/
      edge-shell.css

profile/chrome/fennevia/
  chrome.manifest
  content/
    Bootstrap.sys.mjs
    runtime/                 # authored privileged lifecycle/health/native UI
    firefox/                 # generated private bridge boundary
    shell/                   # generated Svelte IIFE, CSS, and notice

program/
  defaults/pref/fennevia.js
  fennevia.cfg
```

Svelte/application modules consume only ordinary contracts. Unsupported native
handles and Firefox calls remain inside generated `src/firefox/` output or the
authored privileged runtime. No speculative SDK/container layer is present.

The current package combines the proven runtime/bridge boundary with the
generated four-edge frontend:

```text
profile/chrome/fennevia/content/
  Bootstrap.sys.mjs
  firefox/
    BridgeBoundary.sys.mjs
  runtime/
    HealthState.sys.mjs
    Logger.sys.mjs
    NativeUi.sys.mjs
    Runtime.sys.mjs
    WindowManager.sys.mjs
    WindowShell.sys.mjs
  shell/
    ShellApp.js
    ShellStyles.sys.mjs
    THIRD_PARTY_NOTICES.txt
```

All 12 profile files (the Chrome manifest plus the 11 files below `content/`)
are exact package artifacts with committed hashes. The
bridge ESM and three shell files are reproducible only from `src/` and build
configuration; the runtime modules remain reviewed source. The source/build
boundaries and per-window execution decisions are recorded in ADR-022,
ADR-023, and ADR-026.

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
