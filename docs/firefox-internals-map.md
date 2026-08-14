# Firefox Internals Boundary Map

This is an initial ownership and dependency map, not a stable API list. Every symbol, DOM ID, event, URI, preference, and source path must be revalidated against the current Firefox source before implementation.

## 1. Project-owned areas

| Area | Ownership |
|---|---|
| Shell XHTML hosts | Created, mounted, and removed by this project |
| Visible tabs, navigation, address input, and sidebar | This project |
| Shell state and controllers | This project |
| Firefox bridge adapters | This project, with documented internal dependencies |
| Build and installation scripts | This project |
| Native-UI active gate | This project |
| Diagnostic redaction and health state | This project |

## 2. Firefox infrastructure that must remain

| Infrastructure | Reason |
|---|---|
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
|---|---|
| `#navigator-toolbox` | Hide behind the active root gate after replacement coverage is verified |
| `#TabsToolbar` and native tab strip | Hide after the custom tab MVP is complete |
| Native navbar and Urlbar | Hide after navigation and address-input MVPs are complete |
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

Research current window mediator APIs, browser-window startup topics, document readiness, private-window detection, unload, and shutdown. Verify against current loader fixes and current Firefox callers.

### Chrome Registry and AutoConfig

Phase 1 verified the following dependencies on Firefox 153.0.4 release, build ID
`20260810162159`, source stamp
`54be19de0e08edff0b797e55fd935dd3978b0a6d`, on Windows 11 25H2. The full
source and original runtime record is in
`docs/research/firefox-153-bootstrap.md`. ADR-017 renamed the active package to
Fennevia, and issue #22 revalidated every identity-sensitive dependency on the
same build without an alias; see `docs/research/fennevia-identity-migration.md`.

| Dependency | Current source-backed behavior | Project use and observed failure behavior |
|---|---|---|
| `general.config.obscure_value=0`, `general.config.filename`, `general.config.sandbox_enabled=false` | [`nsReadConfig.cpp`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/extensions/pref/autoconfig/src/nsReadConfig.cpp) reads the default preferences, skips the cfg first line, and selects privileged or restricted evaluation | One project cfg is selected; its first line remains a comment. Missing or invalid setup leaves stock Firefox startup available. |
| Privileged AutoConfig globals: `Services`, `Components`, `Cc`, `Ci`, `ChromeUtils` | [`nsJSConfigTriggers.cpp`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/extensions/pref/autoconfig/src/nsJSConfigTriggers.cpp) creates the privileged AutoConfig environment; Bug 1766114 added `ChromeUtils` there | AutoConfig validates and uses only the globals required for directory lookup, registration, URI resolution, import, and privacy-safe console logging. |
| `Services.dirsvc.get("UChrm", Ci.nsIFile)` | [`nsAppDirectoryServiceDefs.h`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/xpcom/io/nsAppDirectoryServiceDefs.h) defines `UChrm` as the user Chrome directory | Resolves `<PROFILE>/chrome`; a missing project manifest reports phase `manifest-locate` and fails open. |
| `Ci.nsIComponentRegistrar`, `autoRegister(manifest)` | [`nsIComponentRegistrar.idl`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/xpcom/components/nsIComponentRegistrar.idl) and [`nsComponentManager.cpp`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/xpcom/components/nsComponentManager.cpp) register a manifest for the current run and do not cache this registration | Registers exactly one profile package. A malformed declaration leads to a deterministic `entry-resolve` failure; no generic directory scan is added. |
| `content fennevia content/` and `nsIChromeRegistry.convertChromeURL()` | [`ManifestParser.cpp`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/xpcom/components/ManifestParser.cpp) parses the declaration; [`nsChromeRegistry.cpp`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/chrome/nsChromeRegistry.cpp) resolves the URI | Resolves `chrome://fennevia/content/Bootstrap.sys.mjs` before import. A missing mapping reports phase `entry-resolve`; a missing file reports `entry-import`. |
| `ChromeUtils.importESModule()` | Current Firefox source has many privileged `chrome://` ESM callers; the real spike imported the newly registered entry immediately | Imports one fixed entry URI and validates its frozen result contract. Syntax and import failures retain phase, redacted full stack, version, and build ID. |
| Loader-defined `Services` global | [`mozJSModuleLoader.cpp`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/js/xpconnect/loader/mozJSModuleLoader.cpp) creates and defines `Services` on loader globals; Firefox 153's `omni.ja` does not contain `Services.sys.mjs` | The entry validates `typeof Services` and `Services.appinfo` before use. The first spike revision imported the removed module and produced the first causal `entry-import` error. |
| Default `chrome:` and `resource:` access; `contentaccessible=yes` | [`toolkit/docs/internal-urls.md`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/toolkit/docs/internal-urls.md) says both schemes are privileged-only by default and the flag opens the complete mapping to web content | The flag is omitted. An ordinary loopback HTTP page could not fetch the entry. `resource`, `style`, `skin`, `locale`, and `override` are all omitted because Phase 1 has no consumer. |
| Startup-cache and registration lifetime | `nsIComponentRegistrar.idl` states runtime manifest registration is not cached; module state remains process-local | A corrected ESM loaded on the first cold start after a syntax failure, and complete project-file removal restored stock startup, both without clearing startup cache. Cache clearing remains an evidence-driven escalation only. |
| `fennevia.safeStart` and `Services.appinfo.inSafeMode` | Project-owned early gates evaluated before manifest lookup | The preference test emitted one `bootstrap.skipped` record and retained the native Firefox window. No package registration or entry import occurred. |

The only accepted manifest line is `content fennevia content/`. `contentaccessible=yes` and `override` remain rejected. A future `resource` mapping requires a concrete consumer, exact inventory, current-source review, ordinary-content denial test, and removal test under ADR-016.

## 6. Phase 0 development-profile dependencies

These dependencies are development-only. They are owned by `scripts/lib/FirefoxDevProfile.psm1`, do not enter the installed runtime, and were verified on Firefox 153.0.4 release, build ID `20260810162159`, source stamp `54be19de0e08edff0b797e55fd935dd3978b0a6d`, on Windows 11 25H2.

| Dependency | Purpose and observed evidence | Current source or documentation | Failure behavior |
|---|---|---|---|
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

## 7. Native-handle rules

- Native tab, browser, window, controller, and result objects remain inside bridge or runtime modules.
- UI uses project-generated opaque IDs and immutable snapshots.
- Mappings are removed on `TabClose`, window unload, runtime stop, and capability failure.
- Never put privileged objects in serializable stores, DOM datasets, logs, or error telemetry.
- Translate native callbacks into ordinary application events at the boundary.
- Validate a native handle before every action that can outlive a prior snapshot.

## 8. Dependency inventory fields

Every implemented dependency should eventually record:

| Field | Meaning |
|---|---|
| Symbol, event, DOM ID, URI, or preference | Exact dependency |
| Firefox version and build ID | Build where it was verified |
| Current source path and revision | Searchfox or official source evidence |
| Project owner module | Bridge or runtime module that uses it |
| Required or optional | Health-gating behavior |
| Failure behavior | Fallback or typed error |
| Compatibility canary | Loader or derivative likely to encounter the same change |
| Tests | Unit, static, or dev-profile smoke coverage |
| Replacement or removal plan | How dependency could be reduced later |

## 9. High-risk areas requiring separate decisions

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
