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

Research current manifest registration, `nsIComponentRegistrar.autoRegister`, module import timing, startup cache, and resource accessibility. Record the exact current Firefox source and loader revisions.

## 5. Native-handle rules

- Native tab, browser, window, controller, and result objects remain inside bridge or runtime modules.
- UI uses project-generated opaque IDs and immutable snapshots.
- Mappings are removed on `TabClose`, window unload, runtime stop, and capability failure.
- Never put privileged objects in serializable stores, DOM datasets, logs, or error telemetry.
- Translate native callbacks into ordinary application events at the boundary.
- Validate a native handle before every action that can outlive a prior snapshot.

## 6. Dependency inventory fields

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

## 7. High-risk areas requiring separate decisions

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
