# Firefox Internals Boundary Map

This is an initial ownership and dependency map, not a stable API list. Every symbol, DOM ID, event, URI, preference, and source path must be revalidated against the current Firefox source before implementation.

## 1. Project-owned areas

| Area | Ownership |
| --- | --- |
| Shell XHTML hosts | Created, mounted, and removed by this project |
| Visible tabs, navigation, compact address/status launcher, centered address popup, and sidebar | This project |
| Shell state and controllers | This project |
| Firefox bridge adapters | This project, with documented internal dependencies |
| Build and installation scripts | This project |
| Native-UI active gate | This project |
| Diagnostic redaction and health state | This project |

## 2. Firefox infrastructure that must remain

| Infrastructure | Reason |
| --- | --- |
| `browser.xhtml` main window | Startup, includes, commands, popups, and content layout |
| `gBrowser` and tab infrastructure | Tab ownership, selected browser, switching, open, and close |
| Browser content and tabbox | Actual web-content viewport |
| Command and controller sets | Navigation, tab commands, shortcuts, and native semantics |
| Popup, permission, authentication, certificate, and dialog infrastructure | Security-sensitive native UI |
| SessionStore | Session, window, and tab restoration |
| Places | Bookmarks and history backend |
| Downloads backend | Download state and lifecycle |
| DevTools and Browser Toolbox | Development, diagnosis, and recovery |
| Notification boxes | Site and browser notifications until a reviewed replacement exists |
| OS titlebar and window controls | Platform integration until separately validated |

Some native elements may eventually be hidden, but do not remove them or let the frontend framework manage their descendants.

## 3. Visible native UI that may eventually be hidden

| Native UI | Initial strategy |
| --- | --- |
| `#navigator-toolbox` | Hide behind the active root gate after replacement coverage is verified |
| `#TabsToolbar` and native tab strip | Hide after the custom tab MVP is complete |
| Native navbar and Urlbar | Hide only after #15 verifies complete replacement/retained access, including #14, #32, and #37 coverage |
| Bookmarks toolbar | Hide only after required access has a replacement |
| Native sidebar launcher, box, and splitter | Hide after the custom sidebar is stable |
| App menu and toolbar buttons | Replace and validate incrementally |
| Titlebar and window controls | Handle last in a separate platform-specific issue |

## 4. Primary research entry points

### Main browser window

Current source area to verify:

- `browser/base/content/browser.xhtml`

Inspect CSP, script and stylesheet includes, popup sets, browser content, window attributes, and initialization dependencies.

### Navigator toolbox

Current source area to verify:

- `browser/base/content/navigator-toolbox.inc.xhtml`

Inspect tabs toolbar, navbar, Urlbar, titlebar controls, customization targets, and platform conditions.

### Tabs

Use the Firefox Source Docs for the tabbed browser and Searchfox for:

- `gBrowser`;
- `tabContainer`;
- `TabOpen`;
- `TabClose`;
- `TabSelect`;
- current tab-state attributes and update events;
- relevant tests and callers.

Do not rely on old assumptions about a `<xul:tabbrowser>` DOM element.

Initial bridge candidates, subject to runtime validation:

- `gBrowser.tabs`;
- `gBrowser.selectedTab`;
- `gBrowser.selectedBrowser`;
- `gBrowser.addTab()` and `gBrowser.removeTab()`;
- `gBrowser.tabContainer` events.

### Navigation and commands

Prefer Firefox command and controller semantics instead of reimplementing history behavior. Research:

- native back, forward, reload, stop, and new-tab commands;
- enabled-state updates;
- selected-browser progress and location state;
- command ownership and user-gesture requirements.

Custom controls call a bridge; components do not query native command DOM directly.

### Urlbar

Research:

- `browser/components/urlbar/`;
- current Urlbar custom elements, controllers, providers, input, and submission path;
- URL fixup and search submission;
- navigation disposition and private-window behavior.

The MVP needs only basic display and submission. Suggestions, autofill, search modes, extension providers, rich results, identity UI, and permission UI require separate research.

### Places

Research:

- `PlacesUtils`;
- current browser Places UI helpers;
- bookmark and history observers;
- callers and tests.

Initially expose read-only ordinary snapshots. Do not place Places result objects in frontend state.

### SessionStore

Research:

- `browser/components/sessionstore/`;
- window and tab restore timing;
- interactions with future workspace persistence.

Do not replace SessionStore during the early roadmap.

### Downloads

Research current browser and toolkit Downloads modules, events, panels, and safety prompts. Initially expose read-only state and leave download prompts to Firefox.

### Sidebar

Research `browser/components/sidebar/` and current sidebar DOM. The custom sidebar is independent project-owned UI and should not patch a large native sidebar subtree.

### Window lifecycle

Issue #5 verified these dependencies on Firefox 153.0.4 release, build ID
`20260810162159`, installed source stamp
`54be19de0e08edff0b797e55fd935dd3978b0a6d`. The official Git mirror tag
`FIREFOX_153_0_4_RELEASE` resolves to
`c178247e1dfea52241a6b18b18cf3a00f8da935c`. The complete canary review,
selection rationale, runtime matrix, and failure injection are in
`docs/research/firefox-153-window-lifecycle.md`.

| Dependency | Firefox 153 source-backed behavior | Project owner and failure behavior |
| --- | --- | --- |
| `Services.wm.getEnumerator("navigator:browser")` | [`nsIWindowMediator.idl`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/xpfe/appshell/nsIWindowMediator.idl) filters by root `windowtype` and warns that enumerated windows can already be closed; Firefox's [`EveryWindow.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/modules/EveryWindow.sys.mjs) uses this enumerator | `WindowManager.sys.mjs` enumerates after observer registration and rejects closed windows. Enumerator/start failure removes the observer and disposes every partial record before propagating to the bootstrap fail-open boundary. |
| `browser-delayed-startup-finished` and `gBrowserInit.delayedStartupFinished` | [`browser-init.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-init.js) sets the flag, resolves delayed startup, then notifies this topic; `EveryWindow` consumes the same signal | Required readiness boundary for existing and later windows. Fennevia does not use `domwindowopened`, `load`, or `DOMContentLoaded` as a browser-ready substitute. Duplicate topics are ignored through weak native-window identity. |
| `chrome://browser/content/browser.xhtml`, XHTML `html#main-window`, `windowtype="navigator:browser"`, `isChromeWindow`, and top-level identity | [`browser.xhtml`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser.xhtml) defines the exact URI/root/type; chrome-window identity is also required by `PrivateBrowsingUtils` | All checks must pass before classification. Dialogs, frames, tabs, and the Browser Toolbox URI from [`Launcher.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/devtools/client/framework/browser-toolbox/Launcher.sys.mjs) remain complete native fallback. |
| `PrivateBrowsingUtils.isWindowPrivate(window)` from `resource://gre/modules/PrivateBrowsingUtils.sys.mjs` | [`PrivateBrowsingUtils.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/toolkit/modules/PrivateBrowsingUtils.sys.mjs) reads the chrome window's privacy context | `Bootstrap.sys.mjs` imports the fixed module and passes it into `WindowManager`. Classification failure performs no partial initialization. Issue #6 gives private windows the same complete non-browsing host set as normal windows. |
| `Services.uuid.generateUUID()` / `nsIUUIDGenerator.generateUUID()` | [`nsIUUIDGenerator.idl`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/xpcom/base/nsIUUIDGenerator.idl) returns a random UUID and may fail if randomness is unavailable | Creates only a process-local log/record identity. Invalid or failed UUID generation leaves that window fully native and emits a code-only privacy-safe lifecycle failure. |
| Window `unload`, `AbortController`, and per-window cleanup | Firefox browser windows dispatch unload during close; current in-tree window trackers and browser tests use explicit close cleanup | The manager registers one unload listener, aborts before reverse-order cleanup, removes the strong map entry and listener, and immediately disposes a late async result. Cleanup exceptions are logged after redaction and do not stop later cleanups. |
| `quit-application-granted` | [`nsAppStartup.cpp`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/toolkit/components/startup/nsAppStartup.cpp) notifies after shutdown is committed; Firefox process services use it for final reference cleanup | `Runtime.sys.mjs` removes its shutdown observer and stops the window manager once. Explicit stop and repeated stop are safe. Forced OS termination cannot execute JavaScript cleanup and relies on process teardown. |
| `Services.obs.addObserver()` / `removeObserver()` | [`nsIObserverService.idl`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/xpcom/ds/nsIObserverService.idl) requires explicit topic registration and removal | Runtime and manager track registration flags, remove observers on start failure and stop, and never depend on garbage collection. |

### XHTML shell hosts

Issue #31 supersedes ADR-020's initial production geometry on the same Firefox
153.0.4 release/build and official tag. The current source, compatibility
canaries, frame placement, reveal/suspension policy, Browser Toolbox evidence,
and rejected alternatives are in
`docs/research/firefox-153-four-edge-shell.md`.

| Dependency | Firefox 153 source-backed behavior | Project owner and failure behavior |
| --- | --- | --- |
| Relative `#browser` and `#tabbrowser-tabbox` child | [`content-area.css`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/themes/shared/tabbrowser/content-area.css) makes `#browser` a relative containing block and gives the tabbox/browser/dialog stacks their native layout and stacking | `WindowShell.sys.mjs` inserts one absolute, zero-layout frame immediately before `#tabbrowser-tabbox`. The frame never enters or reconciles the tabbox/browser stacks. Missing parent, anchor, order, or namespace rolls back the complete frame before health. |
| Root `customizing`, `inFullscreen`, and `inDOMFullscreen` attributes | [`CustomizeMode.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/customizableui/CustomizeMode.sys.mjs) sets `customizing` and temporarily hides `#browser`; [`browser-fullScreenAndPointerLock.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-fullScreenAndPointerLock.js) owns the two fullscreen attributes and native toggler | One frame observer suspends all edges during customize mode and DOM fullscreen. Browser fullscreen remains enabled because the frame follows current browser geometry and does not own window controls. Disposal disconnects the observer. |
| Native window-modal state and descendant `browser[tabDialogShowing]` | [`browser.xhtml`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser.xhtml) retains the window-modal dialog; [`content-area.css`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/themes/shared/tabbrowser/content-area.css) styles browsers carrying `tabDialogShowing` within Firefox-owned stacks | Any current native modal state disables and hides all four surfaces. A scoped mutation observer watches only the validated root/browser attributes and subtree; it does not poll or inspect browsing data. |
| Four ordered XHTML edge hosts, one final address-overlay host, and exact mount targets | Current browser chrome supports explicit XHTML creation in the mixed-namespace document; the frame remains a sibling of Firefox-owned content infrastructure | The frame owns top, left, right, and bottom hosts in that order, followed by one centered address-overlay host. Each owns one target and Svelte root. CSS is a separate frame child. Partial attach, mount, health, or disposal failure is all-or-nothing and leaves native UI visible. |

Issue #6's table below remains historical evidence for the original
primary/sidebar/overlay spike. Those three insertion positions are no longer
the production host shape after ADR-026.

| Dependency | Firefox 153 source-backed behavior | Project owner and failure behavior |
| --- | --- | --- |
| XHTML `html#main-window` and `body`; XUL `#navigator-toolbox` followed by XUL `#browser` | [`browser.xhtml`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser.xhtml), [`navigator-toolbox.inc.xhtml`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/navigator-toolbox.inc.xhtml), and [`browser-shared.css`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/themes/shared/browser-shared.css) define the mixed-namespace body and flex-column layout | `WindowShell.sys.mjs` validates document URI, root/body namespaces, direct parents, and order. The primary XHTML host is inserted immediately before `#browser`; a mismatch creates no partial host and leaves native UI visible. |
| Native sidebar children and `#tabbrowser-tabbox` below `#browser` | [`browser-box.inc.xhtml`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-box.inc.xhtml) owns the sidebar container/splitters/box and tabbox | The hidden XHTML sidebar host is inserted immediately before the tabbox. Project code never mounts into or reconciles a native child; all native siblings remain in their original order. |
| XHTML `#window-modal-dialog`, `#a11y-announcement`, and `#fullscr-toggler` | [`browser.xhtml`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser.xhtml), [`browser.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser.js), and [`content-area.css`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content-area.css) retain Firefox's modal/top-layer and tail anchors | All three anchors and their order are required before attach. The overlay host is before the accessibility anchor and remains hidden, inert, and pointer-transparent. A real modal entered `:modal` while no project host intercepted its hit target. |
| Native titlebar button box and close command | [`titlebar-items.inc.xhtml`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/titlebar-items.inc.xhtml) defines Firefox's minimize/maximize/restore/close controls within the navigator toolbox | The host probe requires the native close control to remain below the toolbox and never places the primary host above or inside that toolbox. No window-control support claim beyond tested Windows is made. |
| `document.createElementNS("http://www.w3.org/1999/xhtml", ...)` in browser chrome | Current Firefox browser code, including [`browser-addons.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-addons.js), explicitly creates HTML namespace nodes in chrome documents | Every project element, including descendants, is created through the fixed XHTML namespace. Browser Toolbox and real-DOM tests reject any mixed project namespace. |
| Browser Toolbox Inspector, `NodeFront.isNativeAnonymous`, and separate toolbox process | [`Launcher.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/devtools/client/framework/browser-toolbox/Launcher.sys.mjs), Browser Toolbox [`window.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/devtools/client/framework/browser-toolbox/window.js), [`NodeFront.isNativeAnonymous`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/devtools/client/fronts/node.js), and CC0 [`helpers-browser-toolbox.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/devtools/client/framework/browser-toolbox/test/helpers-browser-toolbox.js) define launch, ownership metadata, and test interaction. Firefox generates native-anonymous XUL scrollbar descendants for the issue #31 vertical XHTML overflow host. | The real probe accepts the enabled connection prompt, selects the shared frame in Inspector, proves native nodes have no project-frame ancestor, confirms all four edge boundaries plus the address-overlay boundary, and excludes browser-owned `isNativeAnonymous` subtrees before checking every authored descendant is XHTML. Temporary parent/child test prefs, child profile bytes, listener, marker, backup, and process are restored or removed deterministically. This property is test-only and never enters production UI code. |

### Shell health and recovery

Issue #7 verified these inputs on Firefox 153.0.4 release/build
`20260810162159`, official tag `FIREFOX_153_0_4_RELEASE` at commit
`c178247e1dfea52241a6b18b18cf3a00f8da935c`, on Windows 11 25H2. Full
source/canary and failure evidence is in
`docs/research/firefox-153-shell-health-recovery.md`.

| Dependency | Firefox 153 source-backed behavior | Project owner and failure behavior |
| --- | --- | --- |
| `EventTarget.addEventListener(..., { capture: true, mozSystemGroup: true })` | [`EventTarget.webidl`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/dom/webidl/EventTarget.webidl) exposes `mozSystemGroup` only to privileged/UA callers. DevTools [`node-picker.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/devtools/server/actors/inspector/node-picker.js) documents that default-group handlers run before a system-group listener; [`spotlight.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/spotlight.js) pairs capture/system registration and removal options. | `HealthState.sys.mjs` registers one per-window `keydown` listener with the same frozen options and removes the exact listener on fallback/disposal. Registration is itself health-gated. The callback synchronously clears/disposes project state and has no frontend or bridge dependency. |
| `Ctrl+Alt+Shift+F12` keyboard identity | [`DevToolsStartup.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/devtools/startup/DevToolsStartup.sys.mjs) uses unmodified F12 for the stock DevTools shortcut. Firefox's shortcut customization means no chord can be proven globally collision-free. | The handler requires F12 plus exactly Ctrl, Alt, and Shift and rejects Meta. The diagnostic shows the fixed binding. This minimizes conflict on tested stock Windows but is not a cross-platform or user-customization guarantee. |
| `nsIDOMWindowUtils.sendNativeKeyEvent()` and native modifier constants | [`nsIDOMWindowUtils.idl`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/dom/interfaces/base/nsIDOMWindowUtils.idl) defines the chrome-only asynchronous native event API, callback, and left Shift/Control/Alt flags. Mozilla's CC0 [`NativeKeyCodes.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/testing/mochitest/tests/SimpleTest/NativeKeyCodes.js) defines Windows F12 as `0x0058007b`; [`EventUtils.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/testing/mochitest/tests/SimpleTest/EventUtils.js) defines US Windows layout `0x00000409`. | Used only by the external real-Firefox test to synthesize the documented chord. It is absent from the installed runtime. The probe requires host/state removal while native toolbox/browser remain, then verifies another window stays healthy. |
| `Services.appinfo.inSafeMode` and `fennevia.safeStart` | AutoConfig can evaluate both before package registration. Current Alice0775, fx-autoconfig, and xiaoxiaoflood loader heads also stop their loader paths in Firefox safe mode, but carry generic-loader behavior Fennevia does not need. | `program/fennevia.cfg` exits before `UChrm`, manifest registration, URI resolution, or ESM import. Real tests cover the complete package and a hash-verified missing `HealthState.sys.mjs`, restore the module exactly, persist `false`, and prove ordinary startup recovers. |
| Inline `HTMLStyleElement.sheet.cssRules` and project XHTML hosts | The attached project-owned inline style exposes parsed CSS rules through the chrome document's DOM CSSOM. | Health requires the exact style node below the shared frame and at least one parsed rule, plus exact frame/host identity, placement/order, five mount targets and roots, and XHTML descendants. Missing/unavailable CSS fails before `healthy`; cleanup removes only project nodes. |

### Svelte frontend execution

Issue #8 verified these dependencies on the same Firefox 153.0.4 release/build,
official tag, and Windows platform. The first causal errors, compiler decision,
canary review, and complete runtime matrix are in
`docs/research/firefox-153-svelte-build.md`.

| Dependency | Firefox 153 source-backed behavior | Project owner and failure behavior |
| --- | --- | --- |
| `Services.scriptloader.loadSubScript(url, target, "UTF-8")` | Firefox's [`JS Loader API`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/docs/jsloader/jsloader-api.rst) says the classic script is synchronously evaluated in the second parameter's global and its globals are defined on the supplied object. [`mozIJSSubScriptLoader.idl`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/js/xpconnect/idl/mozIJSSubScriptLoader.idl) accepts local privileged `chrome:` sources and an optional target object. | `WindowShell.sys.mjs` passes only the fixed private `chrome://fennevia/content/shell/ShellApp.js` URI and the already validated owning browser window. Loader absence, URI/load failure, registration collision, multiple/missing registration, or an invalid frozen API fails before health and removes partial style/host state. No arbitrary path, metadata, directory scan, remote scheme, or cache-bypass option exists. |
| Browser-window `window`, `document`, and DOM constructors versus the shared privileged module global | The same loader documentation distinguishes evaluation in a supplied global from ESM import into a module global. `browser.xhtml` supplies the per-window DOM bindings used by ordinary browser code. | The first shared `.sys.mjs` Svelte bundle failed at the browser runtime's `window` access. The selected IIFE evaluates in each browser window, and its one-shot project registration property is deleted in `finally`; the captured API is retained only by a frame-keyed `WeakMap` until all five roots unmount. |
| XML/XHTML `browser.xhtml`, `HTMLTemplateElement`, and Svelte tree fragments | Stock [`browser.xhtml`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser.xhtml) is an XML/XHTML chrome document. Svelte's maintained [`fragments: "tree"`](https://svelte.dev/docs/svelte/svelte-compiler) option creates fragment elements directly instead of populating a template with HTML parsing. | The default HTML-fragment build failed at `Node.nextSibling` during real mount. The selected tree build creates only XHTML descendants and passed a real XHTML `template`, XHTML `template.content` child, conditional render, event, official unmount, and remount. Any namespace, constructor, target, or health mismatch fails open; no runtime monkey patch is carried. |
| Svelte `mount`, `flushSync`, `unmount`, and delegated target/document listeners | Svelte's maintained [`svelte` runtime API](https://svelte.dev/docs/svelte/svelte) defines imperative mount, synchronous flushing, lifecycle destruction, and official unmount. | `src/shell/index.ts` wraps only these APIs. Disposal unmounts the address-overlay root, then four edge roots in reverse order; it is idempotent, requires zero remaining descendants/listeners/timers/subscriptions, reports rejected asynchronous work through the privacy-safe runtime boundary, and removes the frame from duplicate-mount tracking. Real instrumentation observed balanced delegated listener add/remove and inert detached controls after disposal. |

### Firefox bridge boundary

Issue #9 verified the following current internals on Firefox 153.0.4 release,
build ID `20260810162159`, official tag `FIREFOX_153_0_4_RELEASE` at commit
[`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c),
on Windows 11 25H2. Searchfox callers, maintained-loader canaries, rejected
generic-loader behavior, and runtime/failure evidence are recorded in
`docs/research/firefox-153-bridge-boundary.md`.

| Dependency | Firefox 153 source-backed behavior | Project owner and failure behavior |
| --- | --- | --- |
| Per-window `window.gBrowser` creation and destruction | Firefox's [`BrowserComponents.manifest`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/BrowserComponents.manifest) invokes `Tabbrowser.create` in the browser-window DOMContentLoaded tabbrowser category and `Tabbrowser.destroy` during unload. [`tabbrowser.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tabbrowser.js) assigns `window.gBrowser = new window.Tabbrowser()` and initializes it. Firefox's [tabbrowser source documentation](https://searchfox.org/firefox-main/source/browser/base/content/docs/tabbrowser/index.rst) states that there is one `gBrowser` per browser window. | `createFirefoxBridgeBoundary` accepts only the already validated browser document/default view plus its process-local `WindowManager` ID and normal/private kind. A `WeakMap` and active-ID set reject simultaneous duplicate or cross-window claims; disposal removes both. Missing `window.gBrowser` is a required health failure, never a process-global fallback. |
| `gBrowser.tabs` and `gBrowser.tabContainer` | Firefox 153 [`tabbrowser.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tabbrowser.js) initializes `tabContainer` from `#tabbrowser-tabs` and implements `tabs` as `tabContainer.allTabs`. [`tabs.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tabs.js) returns an array of pinned and unpinned native tabs from `allTabs` and handles `TabSelect`; current browser tests such as [`browser_tab_groups.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/test/browser/tabs/browser_tab_groups.js) use `gBrowser.tabs`, `gBrowser.tabContainer`, and window-level `TabSelect`. | The base boundary requires an array-valued `tabs` collection and an event-target-valued `tabContainer`. Issue #10 additionally selects `openTabs` for active ordered state, registers native objects only in the context registry, and converts events to ordinary data before crossing the public contract. Native tabs and the event target never enter frontend state. |
| `gBrowser.selectedBrowser` | Firefox 153 [`tabbrowser.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tabbrowser.js) exposes `_selectedBrowser` through `selectedBrowser`; Firefox's tabbrowser documentation identifies the value as the selected native `<browser>` element. | The base boundary requires presence. Issue #12's navigation controller re-reads the selected browser for every snapshot and action while retaining it only inside `src/firefox/`; only bounded title/display-URI text and booleans cross into ordinary state. No principal, browsing context, browser element, or browsing value enters diagnostics. |
| `gBrowser.selectedBrowser.webNavigation` presence | Firefox 153's [`browser-custom-element.mjs`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/toolkit/content/widgets/browser-custom-element.mjs) defines `webNavigation`, `goBack`, `goForward`, `reload`, and `stop`; [`tabbrowser.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tabbrowser.js) forwards navigation through the selected browser. | #9 checks only whether the property exists and marks it optional; it does not call the getter. Issue #12 revalidated the direct operations but selected the central `BrowserCommands` action boundary recorded below, so this optional probe remains unconsumed and cannot half-initialize a window. |
| Event listener add/remove pairing | Native tab events use the browser window/tab container `EventTarget` surface and current Firefox consumers pair listener registration with lifecycle cleanup. | `subscribeFirefoxEvent` preserves the exact target/type/listener/options tuple and returns a one-shot disposer. Boundary-owned subscriptions are disposed in reverse registration order; a removal failure is wrapped as `FENNEVIA_FIREFOX_CONTEXT_DISPOSE_FAILED` after every owned cleanup has been attempted. |

### Typed tabs bridge

Issue #10 verified these dependencies on the same Firefox 153.0.4 release,
build ID `20260810162159`, official tag `FIREFOX_153_0_4_RELEASE` at commit
[`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c),
on Windows 11 25H2. The source/canary comparison, event ordering, rejected
approaches, runtime evidence, and security review are in
`docs/research/firefox-153-tabs-bridge.md`.

| Dependency | Firefox 153 source-backed behavior | Project owner and failure behavior |
| --- | --- | --- |
| `gBrowser.openTabs` | [`tabbrowser.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tabbrowser.js) forwards to [`tabs.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tabs.js) `openTabs`: ordered hidden and collapsed-group tabs are retained, while closing and Firefox View tabs are excluded. | `src/firefox/tabs.ts` requires an array at create and health time, validates every tab shape, and performs no continuous polling. A missing/throwing collection is `FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING` and fails open before `healthy`; a later event read failure is reported and marks that controller unhealthy. |
| `TabOpen`, `TabClose`, `TabSelect`, `TabMove`, `TabPinned`, `TabUnpinned` on `gBrowser.tabContainer` | Current [`tabbrowser.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tabbrowser.js) and [`tabs.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tabs.js) dispatch after the corresponding model mutation. Selected-close chooses a replacement before `TabClose`; pin/unpin may also move. Current tests include [`browser_pinnedTabs.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/test/browser/tabs/browser_pinnedTabs.js) and [`browser_tab_move_active_tab.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/test/browser/tabs/browser_tab_move_active_tab.js). | Seven exact boundary-owned listeners trigger one complete immutable reconciliation; equal snapshots do not publish. Disposal removes listeners in reverse order, clears subscribers/snapshots/IDs, and makes any late callback inert. Window lifecycle disposal covers the no-`TabClose` last-window fast path. |
| `TabAttrModified.detail.changed` values `label`, `image`, `busy`, `selected` | `_tabAttrModified` in [`tabbrowser.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tabbrowser.js) skips closing tabs and bubbles the changed-attribute list. Label, favicon, and network progress paths emit the adopted values; selected identity is also available directly. | Only these four values reconcile #10 state; unrelated attributes are ignored. A malformed detail is conservatively reconciled. No native event/detail object crosses the public subscription. |
| Native tab `getAttribute("label")`, `getAttribute("image")`, `hasAttribute("busy")`, `hasAttribute("pinned")` | Firefox's current tabbrowser writes these attributes before the associated notification. `TAB_LABEL_MAX_LENGTH` is 256. `setIcon` accepts `chrome:`, `about:`, `resource:`, or `data:` source values and may wrap SVG data with `moz-remote-image:`. | The bridge reads the attributes only inside `src/firefox/`. Title is copied as at most 256 text characters. Favicon is optional and permits only bounded `chrome://`, `resource://`, `moz-remote-image:`, or base64 raster data; remote, `about:`, SVG-data, malformed, oversized, and unknown values fall back. Nothing is logged or loaded by the bridge. |
| `gBrowser.selectedTab` | Firefox dispatches `TabSelect` on the new tab before selected-attribute updates and can reject some invalid/shared-tab selections. | Snapshot selection uses strict native identity. `select(id)` sets the property, re-reads it, and throws `FENNEVIA_FIREFOX_TAB_SELECT_REJECTED` if Firefox did not accept the action. Foreign/stale IDs fail before the setter. |
| `gBrowser.addTrustedTab(window.BROWSER_NEW_TAB_URL, { inBackground })` | [`addTrustedTab`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tabbrowser.js#L3255-L3258) mutates the supplied options by assigning the system `triggeringPrincipal`, then delegates to `addTab`; Firefox's own callers use the window-defined `BROWSER_NEW_TAB_URL`. | `open()` accepts only an optional selected boolean and cannot receive a URL. The bridge passes a fresh writable boundary-local options record because freezing it produced the real Firefox `triggeringPrincipal` TypeError. It validates the returned native tab is present in this window's `openTabs`, registers/returns its opaque ID, and verifies requested foreground selection. A mutation-capable native fixture prevents regression; no options record crosses the bridge. |
| `gBrowser.removeTab(tab, { animate, isUserTriggered })` | `removeTab` retains permit-unload, selected replacement, animation, session, last-tab/new-tab, and close-window behavior. [`browser_removeTabs_order.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/test/browser/tabs/browser_removeTabs_order.js) verifies permit-unload occurs before removal calls. | `close(id)` passes one fresh writable boundary-local options record and does not bypass permit unload or last-tab behavior. It keeps state while a prompt defers/rejects close and releases the ID only when Firefox removes the tab from `openTabs`. The frontend retries focus once after the native animation window and cancels that timer on the next action or disposal. |
| `gBrowser.pinTab(tab)` and `gBrowser.unpinTab(tab)` | Firefox updates pinned state/order and emits move plus pin/unpin events; current pinned-tab tests verify the partition order. | Actions are idempotent, re-read the attribute, and type a rejected native result. The ensuing event/action reconciliation preserves the same stable opaque ID after movement. |

The bridge contract and state adapter introduce no URL field, native handle,
tab-group object, persistence, content-accessible mapping, runtime network
request, or native DOM ownership. Revalidate every row on the next supported
Firefox stable.

### Selected-navigation bridge

Issue #12 verified the following dependencies on Firefox 153.0.4 release,
build ID `20260810162159`, official tag `FIREFOX_153_0_4_RELEASE` at commit
[`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c),
on Windows 11 25H2. Command/state timing, maintained-canary comparison,
rejected alternatives, privacy boundaries, and runtime/failure evidence are in
`docs/research/firefox-153-navigation-controls.md`; ADR-027 records the selected
boundary.

| Dependency | Firefox 153 source-backed behavior | Project owner and failure behavior |
| --- | --- | --- |
| `Browser:Back`, `Browser:Forward`, `Browser:Reload`, `Browser:Stop`, and `cmd_newNavigatorTabNoEvent` | [`browser-sets.inc.xhtml`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-sets.inc.xhtml) retains these command elements. [`browser-sets.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-sets.js) dispatches them to the central browser commands. | `src/firefox/navigation.ts` requires each exact element and observes only its `disabled` attribute. Back/Forward state and loading-as-Stop-enabled therefore match retained native command truth. Each missing element has its own fixed symbol and fails before `healthy`; the UI never queries command DOM. |
| `window.BrowserCommands.back`, `forward`, `reload`, `stop`, and `openTab` | [`browser-commands.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-commands.js) owns current selected-browser navigation, reload/view-source/cache behavior, stop behavior, and configured New Tab semantics including native observers/principal/telemetry. | Every action re-resolves the owning window, selected browser, command state, and method synchronously. Missing methods and thrown actions are typed fixed-symbol failures routed through ADR-021. No history, load flags, new-tab target, or principal policy is recreated. |
| `UpdateBackForwardCommands`, `XULBrowserWindow.onStateChange`, and `onLocationChange` | Current [`browser.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser.js) updates native Back/Forward disabled state on selected location changes and Stop/Reload state on selected top-level network start/stop. | Fennevia reads the resulting command state rather than duplicating these algorithms. One command `MutationObserver` is disconnected on startup rollback, window disposal, emergency fallback, or runtime stop. |
| `gBrowser.selectedBrowser.currentURI.displaySpec`, `canGoBack`, and `canGoForward` | Current [`tabbrowser.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tabbrowser.js) exposes the selected browser and its current URI/navigation surface. | The selected browser is required and re-read for every snapshot/action. `displaySpec` (with current `spec` fallback) is copied as at most 2,048 text characters; the booleans are capability shape checks while public Back/Forward enabled state still comes from native commands. Native browser/URI objects never cross the bridge. |
| `gBrowser.selectedTab`, `TabSelect`, and selected `TabAttrModified` values `label`, `busy`, `selected` | `tabbrowser.js` emits selected handoff and tab-attribute notifications; selected label changes provide the current display title and busy/selection notifications close event-timing gaps. | The selected tab label is copied as at most 256 text characters. Only a selected target and the three relevant changed values reconcile; malformed detail enters one typed event-failure path. Title, URI, event, and tab never enter diagnostics or persistence. |
| `gBrowser.addTabsProgressListener()` / `removeTabsProgressListener()` | `tabbrowser.js` registers global tab progress listeners before tab-specific listeners, supplies the native browser argument, and synthesizes selected-browser progress during handoff. Current maintained customizations also pair the add/remove calls and filter selected/top-level callbacks. | One frozen listener handles only selected browser callbacks whose progress is top-level, reconciling location and network-state changes without polling. Both methods are required independently; startup rollback and disposal remove the exact listener once. |
| Per-window `MutationObserver` | The browser-window global supplies the DOM observer used throughout browser chrome for bounded attribute observation. | One controller-owned observer watches only five fixed Firefox command elements and only `disabled`. It handles no content subtree or browsing text and is disconnected before native references are released. |

Issue #13 extends the public snapshot to eight primitive/fixed-enum fields:
the prior five plus committed `addressValue`, `connectionSecurity`, and
`trackingProtection`. Title, display URI, and address are page-derived but
bounded, text-only, per-window, and prohibited from logs/errors/datasets/
persistence/transmission. Svelte receives only the application adapter; no
native handle, command element, event, observer, handler, or Firefox
implementation module crosses into UI code. Revalidate every row on the next
supported Firefox stable.

### Address launcher, popup, and Firefox site status

Issue #13 verified the following additions on the same Firefox 153.0.4
release/build and Windows platform. First causal failures, source blob pins,
product-reference provenance, rejected approaches, privacy boundaries, and
real validation are in `docs/research/firefox-153-address-popup.md`; ADR-028
records the selected UI and command boundary.

| Dependency                                                                                     | Firefox 153 source-backed behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Project owner and failure behavior                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `window.gURLBar.value`, `pageproxystate`, and `handleCommand()`                                | Firefox 153 [`UrlbarInput.mjs`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/urlbar/content/UrlbarInput.mjs) uses `handleCommand()` to route current Urlbar fixup/search and navigation through its current load parameters and principal policy. A valid `pageproxystate` identifies a committed native display value.                                                                                                                                   | The bridge copies at most 4,096 text characters. The compact launcher reads a committed Urlbar value only while proxy state is valid, otherwise the selected URI; initial blank/home/private locations display an empty value. Submission rejects empty, over-length, and executable-scheme input, writes the bounded draft to the native Urlbar, and invokes `handleCommand()`. It never calls a search engine or `loadURI` in production and never logs or persists input. |
| `focusURLBar`, `Browser:OpenLocation`, and `openLocation(event)`                               | [`browser-sets.inc.xhtml`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-sets.inc.xhtml), [`browser-sets.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-sets.js), and [`browser.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser.js) route the native key through `Browser:OpenLocation` and select/open the current Urlbar. | One capture listener requests the custom popup only while the exact project health marker is present. It cancels the native event only when a popup subscriber accepts. In inactive, failed, safe-started, unsupported, or disposed state, Firefox's native command continues unchanged.                                                                                                                                                                                     |
| `gBrowser.selectedBrowser.focus()`                                                             | The selected browser owns current content focus.                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Popup cancellation/focus-boundary exit restores a still-valid prior control, otherwise invokes the current selected browser's focus method. Missing capability fails health; no captured prior browser is targeted after a tab switch.                                                                                                                                                                                                                                       |
| `gIdentityHandler.getConnectionSecurityInformation()`                                          | Firefox 153 [`browser-siteIdentity.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-siteIdentity.js) returns current fixed connection classifications for secure, insecure, internal, extension, file, and error states.                                                                                                                                                                                                                       | The bridge maps only the fixed current strings to an ordinary enum. Unknown/thrown state is `unavailable`; no URL inference, certificate data, native object, fake lock, or identity-panel replacement crosses the boundary.                                                                                                                                                                                                                                                 |
| `gProtectionsHandler.onContentBlockingEvent`, `anyDetected`, `anyBlocking`, and `hasException` | Firefox 153 [`browser-siteProtections.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-siteProtections.js) establishes the booleans during current content-blocking events after handleability.                                                                                                                                                                                                                                                | The callback shape is the required capability; the booleans are read only when current and boolean-valued. State becomes `exception`, `blocking`, `detected`, `clear`, or conservatively `unavailable`. Native protections UI and exception actions remain Firefox-owned.                                                                                                                                                                                                    |
| `ContentBlockingAllowList.canHandle(selectedBrowser)`                                          | Firefox 153 [`ContentBlockingAllowList.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/toolkit/components/antitracking/ContentBlockingAllowList.sys.mjs) rejects browser/principal/scheme cases where content-blocking permissions are not meaningful and accounts for the current private permission type.                                                                                                                                                           | Fennevia checks this before reading handler booleans. A false result is `unavailable`, not an invented clear/protected claim. The allow-list object and permission state stay private.                                                                                                                                                                                                                                                                                       |
| Selected/top-level `onSecurityChange` and `onContentBlockingEvent` progress callbacks          | Firefox's tabs progress listener surface supplies current browser/security/content-blocking transitions alongside location/network changes.                                                                                                                                                                                                                                                                                                                                                             | The same single controller listener reconciles only the selected top-level browser and is removed through the already paired `removeTabsProgressListener`. Background callbacks cannot update launcher/popup state.                                                                                                                                                                                                                                                          |

The left launcher and centered popup derive compact and detailed labels from the
same frozen enum mapping in ordinary `src/shell/navigation-labels.ts`. The
address-overlay host is a project-owned DOM dependency, not a Firefox API. Full
permissions/page-action coverage is separately tracked in #37; Firefox's native
identity/protections panels remain visible and authoritative.

### Chrome Registry and AutoConfig

Phase 1 verified the following dependencies on Firefox 153.0.4 release, build ID
`20260810162159`, source stamp
`54be19de0e08edff0b797e55fd935dd3978b0a6d`, on Windows 11 25H2. The full
source and original runtime record is in
`docs/research/firefox-153-bootstrap.md`. ADR-017 renamed the active package to
Fennevia, and issue #22 revalidated every identity-sensitive dependency on the
same build without an alias; see `docs/research/fennevia-identity-migration.md`.

| Dependency | Current source-backed behavior | Project use and observed failure behavior |
| --- | --- | --- |
| `general.config.obscure_value=0`, `general.config.filename`, `general.config.sandbox_enabled=false` | [`nsReadConfig.cpp`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/extensions/pref/autoconfig/src/nsReadConfig.cpp) reads the default preferences, skips the cfg first line, and selects privileged or restricted evaluation | One project cfg is selected; its first line remains a comment. Missing or invalid setup leaves stock Firefox startup available. |
| Privileged AutoConfig globals: `Services`, `Components`, `Cc`, `Ci`, `ChromeUtils` | [`nsJSConfigTriggers.cpp`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/extensions/pref/autoconfig/src/nsJSConfigTriggers.cpp) creates the privileged AutoConfig environment; Bug 1766114 added `ChromeUtils` there | AutoConfig validates and uses only the globals required for directory lookup, registration, URI resolution, import, and privacy-safe console logging. |
| `Services.dirsvc.get("UChrm", Ci.nsIFile)` | [`nsAppDirectoryServiceDefs.h`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/xpcom/io/nsAppDirectoryServiceDefs.h) defines `UChrm` as the user Chrome directory | Resolves `<PROFILE>/chrome`; a missing project manifest reports phase `manifest-locate` and fails open. |
| `Ci.nsIComponentRegistrar`, `autoRegister(manifest)` | [`nsIComponentRegistrar.idl`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/xpcom/components/nsIComponentRegistrar.idl) and [`nsComponentManager.cpp`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/xpcom/components/nsComponentManager.cpp) register a manifest for the current run and do not cache this registration | Registers exactly one profile package. A malformed declaration leads to a deterministic `entry-resolve` failure; no generic directory scan is added. |
| `content fennevia content/` and `nsIChromeRegistry.convertChromeURL()` | [`ManifestParser.cpp`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/xpcom/components/ManifestParser.cpp) parses the declaration; [`nsChromeRegistry.cpp`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/chrome/nsChromeRegistry.cpp) resolves the URI | Resolves `chrome://fennevia/content/Bootstrap.sys.mjs` before import. A missing mapping reports phase `entry-resolve`; a missing file reports `entry-import`. |
| `ChromeUtils.importESModule()` | Current Firefox source has many privileged `chrome://` ESM callers; the real spike imported the newly registered entry immediately | AutoConfig imports one fixed entry URI. The entry directly imports only fixed Logger, WindowManager, WindowShell, Runtime, and PrivateBrowsingUtils URIs; WindowShell has one fixed relative HealthState import. The entry validates the frozen result contract. Syntax, missing-module, and import failures retain phase, redacted full stack, version, and build ID; #5 and #7 missing-module probes retained native UI. |
| Loader-defined `Services` global | [`mozJSModuleLoader.cpp`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/js/xpconnect/loader/mozJSModuleLoader.cpp) creates and defines `Services` on loader globals; Firefox 153's `omni.ja` does not contain `Services.sys.mjs` | The entry validates `typeof Services` and `Services.appinfo` before use. The first spike revision imported the removed module and produced the first causal `entry-import` error. |
| Default `chrome:` and `resource:` access; `contentaccessible=yes` | [`toolkit/docs/internal-urls.md`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/toolkit/docs/internal-urls.md) says both schemes are privileged-only by default and the flag opens the complete mapping to web content | The flag is omitted. An ordinary loopback HTTP page could not fetch the entry. `resource`, `style`, `skin`, `locale`, and `override` are all omitted because Phase 1 has no consumer. |
| Startup-cache and registration lifetime | `nsIComponentRegistrar.idl` states runtime manifest registration is not cached; module state remains process-local | A corrected ESM loaded on the first cold start after a syntax failure, and complete project-file removal restored stock startup, both without clearing startup cache. Cache clearing remains an evidence-driven escalation only. |
| `fennevia.safeStart` and `Services.appinfo.inSafeMode` | Project-owned early gates evaluated before manifest lookup | The preference test emitted one `bootstrap.skipped` record and retained the native Firefox window. No package registration or entry import occurred. |

The only accepted manifest line is `content fennevia content/`. `contentaccessible=yes` and `override` remain rejected. A future `resource` mapping requires a concrete consumer, exact inventory, current-source review, ordinary-content denial test, and removal test under ADR-016.

## 6. Phase 0 development-profile dependencies

These dependencies are development-only. They are owned by `scripts/lib/FirefoxDevProfile.psm1`, do not enter the installed runtime, and were verified on Firefox 153.0.4 release, build ID `20260810162159`, source stamp `54be19de0e08edff0b797e55fd935dd3978b0a6d`, on Windows 11 25H2.

| Dependency | Purpose and observed evidence | Current source or documentation | Failure behavior |
| --- | --- | --- | --- |
| `--profile <path>` | Select the dedicated profile by absolute path; the running process command line contained the expected managed path | Firefox Source Docs, `browser/CommandLineParameters`; local `firefox.exe --help` | Launch is refused before Firefox starts if the marker or managed path is invalid |
| `--no-remote`, `--new-instance` | Prevent forwarding to another Firefox process and force a separate instance | Firefox Source Docs, `browser/CommandLineParameters`; local `firefox.exe --help` | A daily-use process cannot silently receive the launch request |
| `--new-window`, `--private-window` | Exercise normal, second-normal-window, and private-window startup | Firefox Source Docs, `browser/CommandLineParameters`; two normal windows and one isolated private launch observed | `SecondWindow` and `PrivateWindow` modes are kept separate and an invalid combination is rejected |
| `--jsconsole`, `Ctrl+Shift+J` | Open the Browser Console | `devtools/startup/DevToolsStartup.sys.mjs`; Firefox Browser Console docs | Missing console is recorded as a failed GUI check; it does not alter the profile helper's ownership state |
| `--jsdebugger`, `Ctrl+Alt+Shift+I` | Open the Browser Toolbox | `devtools/startup/DevToolsStartup.sys.mjs`; `devtools/client/framework/browser-toolbox/Launcher.sys.mjs`; Firefox Browser Toolbox docs | Firefox reports that required preferences are missing, or the GUI check remains failed |
| `devtools.chrome.enabled=true` | Permit browser-chrome tools and Browser Console command input | `modules/libpref/init/all.js`; `devtools/startup/DevToolsStartup.sys.mjs`; Browser Console docs | Browser-chrome tools remain unavailable; native Firefox remains unchanged |
| `devtools.debugger.remote-enabled=true` | Allow the local Browser Toolbox connection | `modules/libpref/init/all.js`; `devtools/startup/DevToolsStartup.sys.mjs`; Browser Toolbox docs | Browser Toolbox launch is rejected by Firefox |
| `devtools.debugger.prompt-connection=true` | Retain explicit approval for an incoming local debugger connection | `modules/libpref/init/all.js`; `devtools/shared/security/auth.js` | The user must approve each Browser Toolbox connection; the helper does not bypass it |
| `devtools.browsertoolbox.scope="parent-process"` | Restrict the initial Toolbox scope to browser chrome while keeping `browser.xhtml` inspectable | `browser/app/profile/firefox.js`; `devtools/client/framework/components/ChromeDebugToolbar.js` | The GUI check fails if `html#main-window` is not exposed in the Inspector |
| `chrome://browser/content/browser.xhtml`, `#main-window` | Identify the retained stock Firefox browser window in Browser Toolbox | `browser/base/content/browser.xhtml`; Inspector exposed `html#main-window` during the validated smoke test | Do not claim Browser Toolbox validation without observing the root document |
| `general.config.filename` | Phase 0 audit signal for an existing AutoConfig declaration in `defaults/pref/*.js` | Mozilla AutoConfig documentation and current Firefox preference files | `Verify -RequireNoAutoConfig` fails without deleting or changing the declaration |
| `application.ini` fields `Version`, `BuildID`, `SourceRepository`, `SourceStamp` | Record the selected Firefox build without launching the default profile | Installed Firefox application metadata; cross-checked with `firefox.exe --full-version` | Environment-record generation fails rather than inventing build metadata |
| `app.update.channel` in `defaults/pref/channel-prefs.js` | Record the selected Firefox update channel | Installed Firefox channel preference | The record uses `unknown` if the channel cannot be read |
| `browser.shell.checkDefaultBrowser=false` | Avoid a default-browser prompt in the disposable profile | `browser/app/profile/firefox.js` | Only the disposable profile may show the native prompt; no security UI is replaced |

Revalidate the preference names and command-line flags when the supported Firefox stable changes. The authoritative setup and captured evidence are in `docs/development-setup.md`.

## 7. Phase 1 package-lifecycle dependencies

These dependencies are owned by `scripts/lib/FenneviaInstaller.psm1`; they do
not enter the privileged Firefox runtime. Their normative operator contract is
in `docs/installation.md`.

| Dependency | Installer use | Failure behavior |
| --- | --- | --- |
| Selected `firefox.exe` plus sibling `application.ini` `[App] Name` and `BuildID` | Prove the explicit program root is a source-identifiable stock Firefox build | Reject before transaction creation when identity is absent or ambiguous |
| `<PROGRAM>/defaults/pref` and `general.config.filename` declarations | Install or move the one Fennevia AutoConfig preference and detect another loader declaration | Reject unknown AutoConfig rather than replacing or composing with it |
| Firefox `profiles.ini` and `installs.ini` beneath the current user's Firefox data root | Reject registered/default-style profiles from the development-stage workflow | Never select, register, mutate, or delete a profile entry |
| `.fennevia-dev-profile.json` | Prove a new explicit profile is owned by the project helper | A valid existing dual ownership pair is the only accepted proof after installation |
| Windows process `ExecutablePath` and `CommandLine` | Refuse mutation while the selected executable or profile is active | If Firefox is running but process identity cannot be inspected, fail closed |
| Same-volume `.fennevia-transaction-<UUID>` roots and .NET file replacement | Stage, hash, journal, back up, atomically replace where available, and roll back exact paths | Any residue blocks future actions; recursive cleanup requires an exact marker-owned, no-reparse transaction tree |
| Firefox startup cache | No automatic mutation; Phase 1 observed corrected/removal state on the next cold start | Escalate to Firefox's `about:support` action only after a concrete stale-code symptom |

No new privileged Firefox API or content-accessible mapping is introduced by
the installer.

## 8. Native-handle rules

- Native tab, browser, window, controller, and result objects remain inside bridge or runtime modules.
- UI uses project-generated opaque IDs and immutable snapshots.
- Mappings are removed on `TabClose`, window unload, runtime stop, and capability failure.
- Never put privileged objects in serializable stores, DOM datasets, logs, or error telemetry.
- Translate native callbacks into ordinary application events at the boundary.
- Validate a native handle before every action that can outlive a prior snapshot.

## 9. Dependency inventory fields

Every implemented dependency should eventually record:

| Field | Meaning |
| --- | --- |
| Symbol, event, DOM ID, URI, or preference | Exact dependency |
| Firefox version and build ID | Build where it was verified |
| Current source path and revision | Searchfox or official source evidence |
| Project owner module | Bridge or runtime module that uses it |
| Required or optional | Health-gating behavior |
| Failure behavior | Fallback or typed error |
| Compatibility canary | Loader or derivative likely to encounter the same change |
| Tests | Unit, static, or dev-profile smoke coverage |
| Replacement or removal plan | How dependency could be reduced later |

## 10. High-risk areas requiring separate decisions

- complete `browser.xhtml` override;
- tab custom-element or internal-script override;
- Urlbar provider replacement;
- permission, identity, authentication, or certificate UI replacement;
- titlebar and window controls;
- global agent-sheet styling of native chrome;
- SessionStore schema or persistence hooks;
- internal script monkey patches;
- content-accessible privileged resource mappings.

Any such work requires a dedicated issue and an update to `docs/architecture-decisions.md` before implementation.
