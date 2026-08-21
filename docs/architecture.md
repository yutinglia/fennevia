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
5. Validate the entry contract and report success, duplicate evaluation, or fatal failure without hiding native UI. The first-paint hide sheet is registered only after this entry starts the process runtime (ADR-050).

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
- the ADR-050 first-paint native-hide author sheet, registered before
  `WindowManager.start()` and unregistered on stop or start failure;
- one browser `WindowManager`;
- global version and diagnostic metadata;
- aggregate lifecycle counts that contain no native handles or browsing data.

Host, bridge, and Svelte initialization remain on
`browser-delayed-startup-finished`. Only "do not paint the native topbar"
moves earlier.

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
that sheet with the explicitly selected 7px decorative browser gutter. Edge
pointer strips stay on the #31 trigger contract. Their default is 12px, and
ADR-054 lets the existing bounded customize preference select 6–24 CSS px so
the hit target can remain distinct from the visible gutter without becoming an
unbounded content overlay. On Windows, Firefox's chrome-only
`draggableregionleftmousedown` event starts a pointer-only native-window-drag
lock in the same shared controller. Firefox's synthesized mouse-up after its
hidden move loop, plus pointer-up/cancel and blur fallbacks, releases that lock.
This coordinates all four independent roots so dragging neutral left/right
chrome cannot reveal the top edge; keyboard, focus, and popup holds are not
suppressed.

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
ADR-052 adds an optional locale snapshot that carries only the mapped id `en`
or `zh-Hant`.

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
downloads, Urlbar-coverage, browser-tools, and locale bridges; no service locator,
dependency-injection framework, or generic Firefox SDK exists.

ADR-052 adds `src/firefox/locale.ts` to the same generated private ESM. It
reads `Services.locale.appLocaleAsBCP47` (the Firefox UI language, not
`intl.accept_languages`) and observes `intl:app-locales-changed`. The public
object exposes only `{ id: "en" | "zh-Hant" }`. Every Chinese tag currently
maps to `zh-Hant` until a Simplified Chinese catalog exists; every other tag
maps to `en`.
Missing locale symbols fall back to English and do not fail health. Project
copy uses typed catalogs in `src/app/messages/` plus `t()`; chrome.manifest
still omits `locale`. Firefox Fluent widget names (ADR-046) and Places root
titles stay Firefox-owned. Frame, overlay, and surface roots set `lang` to
the mapped id; both catalogs are LTR.

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
tab strip. Issue #60 extends the same strip with audio/container/attention
indicators, middle-click close, drag and keyboard reorder, and Firefox-owned
`#tabContextMenu` handoff. Primary tab buttons expose selected semantics and
roving keyboard focus; pin, mute, and close remain sibling controls. Titles
stay bounded text, favicon values use a strict internal/raster allowlist with a
property-only image and explicit fallback, and no browsing value enters logs or
diagnostics. Current source and runtime evidence is in
`docs/research/firefox-153-tabs-bridge.md`,
`docs/research/firefox-153-tab-strip.md`,
`docs/research/firefox-153-tab-strip-parity.md`, ADR-024, ADR-025, and ADR-041.

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
One controller per window validates the current Firefox owners needed for nine
actions: site information, protections, site permissions, native Downloads,
Unified Extensions, application menu, Settings, native customization, and
complete original-toolbar access. It re-resolves every owner at action time.
ADR-042's six popup actions pass a project-owned XHTML host, keep native
chrome hidden, and re-anchor the Firefox panel beside that host. If the
current owner throws after initializing a lazy panel, the bridge still
opens the existing panel on that host. Popup position follows the host
surface: address overlay `after_end`, left rail `end_before`, otherwise
the action default. Application menu awaits `PanelUI.ensureReady()`, then
opens `#appMenu-popup` with Firefox's `bottomcenter topright` placement
through `PanelMultiView.openPopup` so the main view exists before
`popupshown`. If HTML anchoring fails, that call routes `panel.openPopup` to
`openPopupAtScreenRect` for the duration of `#showMainView` then restores
Firefox's method. A raw `openPopupAtScreenRect` is not used: it leaves
`openViews` empty and Firefox throws `panelView is undefined` on `isOpenIn`.
Failed opens that fire `popuphidden` without showing the panel keep the
NativeUi token so `PanelUI.show()` cannot reveal the collapsed navbar. If the
panel still stays closed, it calls `PanelUI.show()` with the token already set
and `moveTo`s the host screen rectangle on `popupshown`. Unified Extensions
awaits `gUnifiedExtensions.togglePanel()` to initialize the lazy view, ignores
that owner's fire-and-forget native-button `PanelMultiView.openPopup`, then
opens `#unified-extensions-panel` on the project host. The top-row Extensions
control uses `mousedown` like the native button; keyboard still uses `click`.
The dedicated
original-toolbar, Downloads, and native-customize buttons are not shown;
Downloads is available as the placeable `show-downloads` widget, and the
application menu plus fail-open remain the complete native-chrome access
paths. Settings, customization, and the complete-toolbar action keep their
previous owners; the complete-toolbar action still reveals the current navbar
and focuses an original navigation control instead of enumerating
`CustomizableUI`. The
public contract contains only nine fixed availability booleans, nine fixed
action strings, an optional host for popup actions, and a privacy-safe
open/closed popup hold. It contains no URL, certificate, tracker, permission,
extension, download, widget, preference, native node, handler, panel, or
window. The unprivileged adapter validates results and releases its
per-window reference on unmount. See ADR-037, ADR-042, and
`docs/research/firefox-153-native-popup-anchoring.md`.

ADR-044 and ADR-045 add `src/firefox/toolbar-widgets.ts` and
`src/firefox/customize-model.ts` to the same generated private ESM. One
optional controller per window reads the current `CustomizableUI` inventory,
keeps widget ids and native nodes in a privileged handle/token registry, and
renders project-owned widget zones on all four edges. The top zone sits
between the fixed navigation cluster and the Firefox-tools cluster and grows
to fill the remaining toolbar width so `spring` placements can pack like the
Firefox nav-bar (widgets before a spring stay left; widgets after it stay
right). Left, right, and bottom widget zones are the same kind of horizontal
row at full panel width, so `spring` can pack leftover space there too,
without changing the tabs, bookmarks, or downloads panel sizes. With no
layout preference the top zone falls back to the live nav-bar placement
list. The first edit materializes a Fennevia layout into
`fennevia.customize.layout`; `fennevia.customize.style` stores bounded style
tokens (theme, accent, panel surface, chrome background, text, border, blur,
radius, density, surface opacity, saturation, shadow, motion, and font size).
ADR-054 extends that same version-1 style object with bounded in-window and
window-leave hide delays, temporary programmatic-reveal duration, shortcut-tip
duration, and edge-trigger size. Existing values without those fields receive
the 300 ms, 800 ms, 1,200 ms, 600 ms, and 12 CSS px defaults. A non-null
`PointerEvent.relatedTarget` selects the in-window delay; a null target or the
existing window-blur fallback selects the window-leave delay. A zero
shortcut-tip duration omits the footer from rendering. Both prefs are versioned
JSON with a 16 KiB cap and fail safe to defaults. Glass, trigger, and
shortcut-animation tokens apply on the project frame root; the validated reveal
timing values update the one shared edge controller. Empty color tokens resolve
to Firefox chrome design-system variables (ADR-051). The chrome background
token is applied by NativeUi as `--fennevia-chrome-background` on
`:root#main-window`.
Placing a widget
with no live node performs the owner-approved `addWidgetToArea(id, "nav-bar")`
adoption; removing the last Fennevia placement restores extensions to
`AREA_ADDONS` and other widgets to the palette. The frontend receives frozen
ordinary snapshots only. Extension identity may exist in that window's
in-memory DOM for rendering; it never enters logs, diagnostics, serialized
frontend state, CSS variables, or root datasets. Missing `CustomizableUI`
hides the zones and missing `Services.prefs` disables editing; neither joins
activation health. ADR-047 moves placement editing onto the live four-edge
widget zones with HTML5 drag-and-drop; the top-host drawer is the palette and
style editor, centered in the remaining content well so it does not cover the
four-edge drop zones. See ADR-044, ADR-045, ADR-046, ADR-047,
`docs/research/firefox-153-toolbar-widget-mirror.md`, and
`docs/research/firefox-153-customize-mode.md`.

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
while retaining accessible names, Unified Extensions, Settings, and the
application menu. The dedicated original-toolbar, Downloads, and
native-customize buttons are not shown; Downloads is available as the
placeable `show-downloads` widget, and the application menu plus fail-open
remain the complete native-chrome access paths. The row consumes only
ordinary adapters and the existing top-edge focus/reveal contract; it does
not inspect native DOM or create another trigger, timer, controller, or widget
registry. ADR-043 overlays a decorative 2px load light in that same top root
from the existing `loading` boolean; it is not a second chrome surface.

Issue #13 replaces the old left address placeholder with a non-editable compact
launcher above tabs and mounts `AddressPopup.svelte` in the fifth root. The
launcher displays bounded committed location plus compact labels derived from
real Firefox connection/protection enums. Those compact HTTPS and protection
badges, and the matching popup connection, protection, and permission cards,
are explicit native handoff buttons: they keep the matching edge or address
overlay open, leave native chrome hidden, and open Firefox's current
Trust/identity, protections, or permission panel beside the clicked project
host. The popup owns the sole custom input,
an independent per-window draft, fuller labels, focus restoration, and
popup-priority edge suppression. It never moves native Urlbar/identity/
protections DOM or renders inferred security state.

Issue #37 extends that same popup with a full-width site-permission card, fixed
applicable Firefox-control labels, and one native Urlbar handoff button.
ADR-037/ADR-042's Trust/identity, protections, and permission handoffs remain
available from the left launcher badges and the centered popup cards rather
than a second top-row launcher. The complete original-toolbar action remains
in the Firefox bridge for tests and recovery; the top row no longer shows a
dedicated button. All complete security/permission/action panels and
commands stay Firefox-owned, and no second popup, input, edge controller,
timer, or provider stack is added.

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

ADR-043 adds two decorative gutter lights in those same roots: a top load beam
driven by the existing navigation `loading` boolean, and a bottom download beam
driven by the existing anonymous aggregate. They overlay the 7px content gutter,
use `pointer-events: none`, stay `aria-hidden`, and do not add a trigger,
timer, z-index system, or content margin. Accessible loading and download
status remain Reload/Stop, tab busy, and the bottom panel.

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
6. Use agent or author sheets only when an ordinary scoped stylesheet cannot solve a demonstrated problem. ADR-050 is that case for first paint: Firefox 153/154 no longer parse chrome.manifest `style` overlays, so one `@-moz-document`-scoped `AUTHOR_SHEET` is registered at runtime start and unregistered on stop.
7. Prefer text rendering and safe property assignment over unsanitized HTML.

The issue #31 result keeps Svelte component CSS extracted at build time. Every
authored selector starts at `#fennevia-shell-frame-host`, and the generated
style element is a child of the project-owned frame. Real Firefox comparison
kept the computed styles of the native toolbox, sidebar, popup set, Urlbar
input, application-menu button, and modal prompt unchanged when that style was
toggled. Tailwind and Shadow DOM remain unselected because the scoped component
CSS satisfied the measured isolation and theme requirements without another
dependency or rendering boundary. ADR-051 maps the default `--fennevia-*` color
tokens to Firefox chrome design-system variables (`--panel-background-color`,
`--toolbar-background-color`, `--toolbar-text-color`, `--color-accent-primary`,
`--focus-outline-color`, and related tokens from `tokens-platform.css` /
`tokens-shared.css`). Empty customize color values keep those defaults.
Forced-colors still uses Canvas/CanvasText/Highlight. See
`docs/research/firefox-153-design-tokens.md`.

Issue #11 first proved the tab strip boundary horizontally; ADR-026 retains its
data and accessibility contract but reorients it into the left edge. Pinned and
regular items use bounded project-only layout, many tabs overflow inside one
vertical scroller, and the New tab control stays outside that scroller so it
follows the last tab and remains visible when the list overflows.
Forced-colors/focus rules remain rooted at the frame. The
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

ADR-043's gutter lights are also frame-rooted. Thickness is the independently
selected 2px token. Determinate download width uses a scoped custom property
from the validated integer percentage. Unknown-size load/download activity is a
full-width pulse, not a fake fill, so it cannot stall at an invented percent.
Reduced motion keeps a static full-width beam; forced-colors maps to `Highlight`
without glow. The lights are `pointer-events: none` and sit at `z-index: 0`
under the #31 trigger. No selector targets `#main-window`, `#browser`, or
native progress UI.

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

Only a healthy shell may become active. Durable native-UI hiding rules must
depend on `data-fennevia-active`. A bootstrap, bridge, CSS, or frontend failure
must prevent or remove that attribute. ADR-050 may collapse the same toolbox
surfaces before `active` through a process-scoped, 2,000 ms self-expiring
author sheet so first paint does not show the native topbar; that sheet is not
a substitute for the health gate. `disposed` is controller state, not a retained
DOM marker: disposal removes every project state attribute. Safe start exits in
AutoConfig before a browser-window controller exists and therefore deliberately
sets no DOM attribute and never registers the startup hide sheet.

ADR-032, as extended by ADR-037, ADR-038, ADR-042, and ADR-050, implements the
gate with a seven-rule
project-owned style, a process-scoped first-paint author sheet, and two temporary root markers:

```text
[data-fennevia-native-ui-revealed]
[data-fennevia-native-ui-suspended]
```

The startup sheet uses a 2,000 ms `step-end` animation whose empty `100%`
keyframe restores Firefox cascade values if `active` never arrives. Emergency
`Ctrl+Alt+Shift+F12` is still registered by the window shell before durable
hide; until that binding exists, the CSS deadline is the fail-open path.
Registration failure of the sheet does not fail the runtime.

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

Native focus, toolbox-anchored Firefox doorhangers, an open native sidebar, and
explicit Urlbar or original-toolbar handoffs set temporary reveal. Fennevia-
initiated Trust/permission/Downloads/extensions/application-menu panels that
are token-listed or re-anchored to a project host do not reveal the navbar.
Customize and current native-dialog state set suspension. Window-modal
ownership follows `#window-modal-dialog.open` (and tab-dialog markers) rather
than a leftover `window-modal-open` attribute after the HTML dialog has
closed. DOM fullscreen also suspends project hiding
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
and absent peer metadata. `FenneviaSetup.exe` is the recommended interactive
release front end: a WinForms wizard that does not change those contracts.
`scripts/fennevia.ps1` remains the development console and advanced TUI. The
normative contract and interrupted-operation recovery procedure are in
`docs/installation.md` and ADR-018/ADR-033/ADR-036/ADR-040/ADR-049.

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
    customize-model.ts
    index.ts
    locale.ts
    window-controls.ts
    <feature>.ts              # stable public facade
    bookmarks/
    browser-tools/
    downloads/
    navigation/
    tabs/
    urlbar-coverage/
      controller.ts           # per-window ownership and cleanup
      support.ts              # capability checks and native-data helpers
    toolbar-widgets/
      controller.ts
      native-support.ts
      presentation.ts
      popup-actions.ts
      support.ts              # private support facade
  app/
    address-popup.ts
    browser-tools-state.ts
    bookmark-state.ts         # stable public facade
    bookmarks/
      contracts.ts
      validation.ts
      adapter.ts
      visible-rows.ts
    customize-session.ts
    download-state.ts
    edge-surfaces.ts          # stable public facade
    edge-surfaces/
      contracts.ts
      surface-controller.ts
      shell-controller.ts
      geometry.ts
    i18n.ts
    locale-state.ts
    messages/
      en.ts
      zh-Hant.ts
    navigation-state.ts
    tab-state.ts
    tab-strip.ts
    toolbar-widget-drag.ts
    toolbar-widgets-state.ts  # stable public facade
    toolbar-widgets/
      contracts.ts
      validation.ts
      state.ts
      adapter.ts
      errors.ts
    urlbar-coverage-state.ts
    window-controls-state.ts
  shell/
    AddressPopup.svelte
    App.svelte
    BookmarksPanel.svelte
    CustomizePanel.svelte
    DownloadsPanel.svelte
    ShellIcon.svelte
    entry.ts
    index.ts                  # public mount/health facade
    locale-ui.ts
    toolbar-widget-icons.ts
    features/
      customize/CustomizeInteractionSection.svelte
      customize/CustomizeStyleSection.svelte
      tabs/TabStrip.svelte
      toolbar-widgets/ToolbarWidgetZone.svelte
    runtime/
      contracts.ts
      health.ts
      mount-shell.ts
      address-popup-coordinator.ts
      surface-focus.ts
      customize-style.ts
    surfaces/
      TopSurface.svelte
      LeftSurface.svelte
      RightSurface.svelte
      BottomSurface.svelte
      EdgeProgressLight.svelte
    styles/
      edge-shell.css          # ordered import facade
      foundation.css
      address.css
      tabs.css
      toolbar.css
      bookmarks.css
      downloads.css
      customize.css
      window-controls.css
      responsive-accessibility.css

scripts/lib/
  FenneviaInstaller.psm1      # fixed implementation loader + public exports
  installer/
    Common.ps1
    Discovery.ps1
    Ownership.ps1
    Planning.ps1
    Transaction.ps1
    Public.ps1

profile/chrome/fennevia/
  chrome.manifest
  content/
    Bootstrap.sys.mjs
    runtime/                  # authored privileged lifecycle/health/native UI/first-paint hide
    firefox/                  # generated private bridge boundary
    shell/                    # generated Svelte IIFE, CSS, and notice

program/
  defaults/pref/fennevia.js
  fennevia.cfg
```

Facade files preserve the established import paths while implementation modules
are grouped by feature and responsibility. Firefox feature folders remain
privileged and may not be imported by `src/app/` or `src/shell/`. CSS modules
are imported in one explicit order so the pre-refactor cascade remains
authoritative. The installer module dot-sources only its fixed reviewed list;
there is no directory scanning or plugin discovery.

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
    StartupNativeHide.css
    StartupNativeHide.sys.mjs
    WindowManager.sys.mjs
    WindowShell.sys.mjs
  shell/
    ShellApp.js
    ShellStyles.sys.mjs
    THIRD_PARTY_NOTICES.txt
```

All 14 profile files (the Chrome manifest plus the 13 files below `content/`)
are exact package artifacts with committed hashes. The
bridge ESM and three shell files are reproducible only from `src/` and build
configuration; the runtime modules remain reviewed source. The source/build
boundaries and per-window execution decisions are recorded in ADR-022,
ADR-023, ADR-026, and ADR-050.

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
