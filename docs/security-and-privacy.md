# Security and Privacy

## 1. Scope and status

Fennevia executes system-principal code in Firefox browser chrome. A defect or
compromised dependency can affect browser UI, profile files, browsing state, and
Firefox security surfaces.

These rules apply to:

- AutoConfig and Chrome Registry bootstrap;
- privileged runtime and bridge modules;
- generated Svelte/JavaScript/CSS artifacts;
- build tooling and dependencies;
- four-edge hosts, triggers, controllers, focus, and timers;
- tab, navigation, address/Urlbar coverage, Places, and Downloads data flows;
- resource mappings;
- diagnostics and shared evidence;
- install, update, repair, disable, and uninstall;
- documentation and copied code.

This document defines policy. It does not claim a formal security audit,
penetration test, or hardened production release.

`docs/security-controls.md` is the operational companion containing the current
threat model, artifact gate, logging contract, resource review, installer
controls, private-window rules, and review triggers.

## 2. Current security baseline

Current validated public prerelease package: `0.15.0-beta.1` on Firefox 153.0.4
BuildID 20260810162159 and owner-confirmed Firefox 154.0 BuildID 20260812182057
for Windows x64. Later Firefox majors may be installed after an explicit
warning; that is not a support promise.

Implemented controls:

- minimal fixed AutoConfig/Chrome Registry startup;
- no generic loader, script discovery, or dynamic runtime module selection;
- no `contentaccessible=yes` and no active `resource://fennevia/` mapping;
- one process runtime and per-window abort-first cleanup;
- health deadline, safe start, and Svelte-independent emergency fallback;
- deterministic Svelte/bridge builds and exact package inventory;
- frame-scoped CSS and project-only XHTML ownership;
- typed per-window Firefox boundary and context-scoped opaque IDs;
- bounded tab titles and allowlisted property-only favicon values;
- closed per-window tab capture/crash indicators without WebRTC or device
  details;
- bounded navigation title/display-URI text and explicit native command actions;
- bounded address draft plus fixed Firefox-derived connection/protection enums;
- fixed Urlbar permission/action availability with read-only owner-state
  observation and complete native handoff;
- bounded lazy Places pages with opaque handles and native bookmark opening;
- anonymous bounded Downloads status with per-window native list views and no
  filename, path, source URL, byte value, or file action crossing the bridge;
- hidden-at-rest four-edge state with pointer-transparent center;
- explicit suspension for native modal state, DOM fullscreen, and customize
  mode;
- exact active-only durable native hiding, plus a self-expiring first-paint
  hide sheet, with complete native reveal, safe start, and emergency fallback;
- default-deny diagnostics and no runtime network sink;
- path-safe package lifecycle with ownership manifests, narrow one-sided repair,
  and rollback;
- deterministic versioned release staging with an exact file/digest manifest,
  separate ZIP checksum, sensitive-data/local-path scan, annotated-tag gate,
  draft-asset digest verification, and Firefox 153+ compatibility
  enforcement with an explicit untested-version warning.

Not completed by this development baseline: a formal independent security
audit, a stable/daily-driver support promise, signing, attestations, an SBOM,
and a real newer-stable transition when no newer stable is available. Issue #18
selected MPL-2.0 and the provenance
policy in `docs/licensing-and-provenance.md`. Native Firefox DOM remains attached
and authoritative; active rest hides only ADR-032's exact visible descendants,
and reveal/suspension/failure immediately restores the independent native path.

## 3. Security objectives

- Preserve Firefox's process, content, principal, command, and prompt
  boundaries.
- Keep installed privileged code small, local, deterministic, and reviewable.
- Fail open to native Firefox UI on every unsupported or failed custom-shell
  state.
- Prevent web-content access to privileged project resources.
- Prevent normal diagnostics and shared evidence from exposing browsing data.
- Prevent native handles from entering ordinary/Svelte state.
- Bound every user-derived string and collection before it reaches reactive
  state.
- Keep private-window state per-window and non-persistent.
- Keep package mutations explicit, target-validated, reversible, and
  ownership-limited.
- Maintain clear license and provenance for dependencies and external code.
- Preserve native permission, authentication, certificate, extension-install,
  download-safety, file-picker, notification, dialog, and DevTools behavior.

## 4. Privileged-code rules

- Treat every installed runtime module and generated frontend bundle as
  system-principal code.
- Do not use `eval`, `Function`, string-generated modules, arbitrary dynamic
  import, or equivalent code generation without a dedicated security decision.
- Do not fetch executable code, CSS, fonts, templates, configuration, analytics,
  telemetry, crash upload, or updates at runtime.
- Do not add a generic runtime loader, arbitrary path resolver, or plugin
  registry.
- Validate every required Firefox symbol at the privileged boundary.
- Keep native windows, tabs, browsers, controllers, principals, progress
  listeners, Places objects, Downloads objects, and services private.
- Expose only bounded ordinary immutable data and explicit actions.
- Render user-derived text as text. Do not inject unsanitized HTML.
- Do not construct arbitrary CSS from page-derived values.
- Do not implement uncontrolled `loadURI` or shell-execute helpers.
- Keep security-sensitive Firefox UI native unless a separately reviewed issue
  includes a threat model, current-source research, failure behavior, fallback,
  and tests.
- Do not reparent native Firefox DOM into Fennevia surfaces.
- Do not expand ADR-032's native-hide target set without a dedicated current-
  source coverage, recovery, and security review.

## 5. Four-edge interaction security

The current frame has top, left, right, and bottom project-owned surfaces.

Requirements:

- hidden surfaces reserve no permanent content geometry;
- the frame is pointer-transparent except at narrow documented edge triggers
  (12 CSS px by default, user-bounded to 6–24 CSS px by ADR-054) and currently
  visible owned surfaces;
- trigger thickness is measured, validated, and independent of the 7px
  decorative content gutter; the same value drives CSS hit geometry and corner
  arbitration;
- deterministic corner arbitration prevents ambiguous overlapping pointer
  targets;
- feature modules use the shared #31 controller rather than private timers or
  CSS classes;
- the same style preference may select separate 100–5,000 ms in-window and
  window-leave hide delays plus a 400–10,000 ms default temporary reveal; these
  values reconfigure only the existing tracked hide/programmatic timers;
- standard `PointerEvent.relatedTarget` distinguishes a non-null destination
  inside the Firefox window from a null window exit; a null destination is a
  window leave only when the coordinates are also outside the window viewport
  or outside every visible owned panel. Window `blur` skips pointer-hold
  release while `Services.focus.activeWindow` is still this chrome window, so
  focusing a selected `<browser>` is not treated as leaving Firefox. The
  privileged callback returns only a boolean; chrome window objects, focus
  owners, and coordinates are neither persisted nor logged;
- shortcut-tip duration is bounded to 0–10,000 ms and controls only the
  existing frame-scoped CSS animation; zero omits the nonessential footer and
  creates no JavaScript timer. The bookmarks status row no longer shows a
  persistent Ctrl/Command+Enter hint; it remains a health target for actual
  notices only;
- focus cannot remain inside a hidden, failed, or disposed surface;
- a focused surface stays open until focus leaves or an explicit close action;
- `Escape` respects higher-priority native/project popup handling;
- native modal/window-modal state suspends all custom edge interaction;
- DOM fullscreen and customize mode follow explicit suspension policies;
- OS window commands remain Firefox-owned; ADR-038 project buttons call them
  without deleting or clicking native caption nodes;
- failure in a required host/controller/feature prevents or clears active mode;
- disposal clears all holds, timers, observers, delegated listeners, roots, and
  focus-origin records.

The fixed top navigation, configured tabs-side address/status, centered detailed
popup, configured bookmark-side panel, and optional bottom download-status
surface are complete for #12–#14, #32, and #37, with ADR-064's bounded role and
presentation extension. #15's completed gate activates exact reversible hiding only after
health; complete native reveal and fail-open cleanup remain available.

## 6. Data classification and logging

### 6.1 Allowed in normal logs

Only schema-defined values such as:

- project version and commit;
- Firefox version, build ID, and channel;
- operating system;
- fixed lifecycle phase/state;
- `normal`, `private`, or `unsupported` window classification;
- fixed capability name/symbol and boolean result;
- project module and fixed project URI;
- stable project error code and error class;
- stack frames after redaction;
- process-local opaque IDs and aggregate counts with no external mapping;
- fixed edge identity and hold/state enum;
- fixed bounded DOM path selected by source code;
- mapped Fennevia locale id `en` or `zh-Hant`.

### 6.2 Prohibited in normal logs and shared evidence

- complete URLs, origins, queries, fragments, or address text;
- page/tab titles;
- history entries;
- bookmark/folder titles, URLs, tree contents, Places identifiers tied to user
  data, or expanded-folder state;
- download filenames, source URLs, referrers, target paths, private markers, or
  byte counts tied to named items;
- form values;
- cookies, tokens, headers, principals, certificates, or session state;
- profile paths, user names, local paths, UNC paths, or file URLs;
- native event, window, tab, browser, controller, service, query, or download
  objects;
- private-window browsing state;
- extension data not required by a fixed project diagnostic;
- raw Firefox UI locale tags, `intl.accept_languages` / accept-language
  lists, language-pack inventories, and Firefox Fluent or Places localized
  labels.

Detailed local debugging, when unavoidable, must be explicitly enabled, remain
local, be off by default, and be removed/redacted before sharing.

### 6.3 Logger contract

Logger APIs accept allowlisted fields, not arbitrary objects.

- Unknown caller fields are ignored.
- Error messages are untrusted and replaced with a stable safe summary.
- Stacks retain line structure only after URL/path/query/user-name redaction.
- If redaction fails, emit a minimal code-only record.
- No log sink transmits data.
- No spread or generic serializer may serialize native or application state.

Implemented runtime records use process-local random window IDs and fixed
normal/private classification. Bridge errors add only fixed phase, code,
allowlisted Firefox symbol, Firefox version/build, and window kind.

Issue #12 navigation errors use that same fixed schema. Bounded title and
display-URI values never enter logger fields, error messages, or stacks.

Edge-controller records may include only fixed edge/state/hold enums and counts.
They must never receive browsing data.

### 6.4 Test-only resource evidence

`--performance-baseline` and its hard-disabled
`--performance-stock-baseline` diagnostic control may call Firefox's privileged
process-info API only in the local real-Firefox harness. The collector
immediately returns aggregate process count, memory bytes, CPU
nanoseconds/cycles, and fixed timing samples. It must not serialize the raw
record because that record can also contain origins, document URIs/titles,
process IDs, windows, and threads. This API and its results never enter
production runtime, Svelte state, persistence, telemetry, or a network sink.
ADR-034 and static privacy assertions own this exception.

### 6.5 Test-only persisted-session evidence

`--session-restore` may inspect Firefox-owned tab/session state only inside the
local real-Firefox harness and only for four fixed data-URL fixtures. Shared
output is a default-deny schema containing fixed fixture IDs, phase enums,
booleans, and bounded counts. It must not include fixture or user URLs, tab
titles, queries, raw SessionStore JSON, preferences outside the exact allowlist,
profile/program paths, native objects, or private-window state.

The transaction marker stores only its schema version and each allowlisted
preference's prior user-value presence/value. It contains no tab or browsing
state. Prepare refuses a stale marker. The wrapper verifies the installed
frontend hash before temporarily moving it, restores exact bytes in `finally`,
and, after its own prepare phase creates state, attempts the fixed cleanup phase
from `finally`. A marker left by an earlier interrupted invocation blocks before
mutation and requires the documented manual cleanup command. Cleanup returns
Firefox to one blank tab, restores preference ownership/value state, performs a
normal shutdown, and removes the marker after process exit. SessionStore APIs
and evidence have no production caller, persistence sink, telemetry, or network
path. ADR-035 and contract/static tests own this exception.

## 7. User-derived frontend data

### 7.1 Tabs — implemented

The tabs bridge/application/UI may expose:

- opaque context-bound tab ID;
- bounded title text;
- selected, pinned, loading booleans;
- optional bounded allowlisted favicon value;
- optional closed audio enum (`playing` / `muted` / `blocked`);
- optional closed sharing enum (`camera` / `microphone` / `screen`);
- optional attention, picture-in-picture, and crashed booleans;
- optional container `{ color, label }` where `color` is a closed Firefox
  identity color name and `label` is at most 80 text characters.

Rules:

- title is rendered as text/property labels only;
- `dir="auto"`/plaintext bidi handling affects layout only;
- favicon accepts only the reviewed local/internal/raster forms;
- rejected, malformed, remote, SVG-data, oversized, or unknown values use the
  static fallback;
- accepted favicon is assigned only to `img.src`;
- no favicon value enters CSS, HTML, datasets, logs, or accessible labels;
- `referrerpolicy="no-referrer"` is used;
- image load failure removes/hides the value;
- native tab handles stay in the bridge registry;
- new-tab action accepts no arbitrary URL;
- stale/foreign/disposed IDs fail before native access;
- container labels follow the title rule: shown as text/accessible name, never
  logged, never placed in error text, and never stored as `userContextId`;
- container colors are a closed enum mapped to CSS tokens, not page hex/URLs;
- audio/sharing are closed enums and attention/PiP/crashed are booleans. Their
  fixed visual tokens may exist only in the owning window's project tab
  descendants and accessible name; they never enter logs, persistence, a frame
  root dataset, or another window;
- origins, permission records, paused state, device IDs/names, native
  `_sharingState`, and WebRTC objects never cross the privileged boundary;
- color names may appear in `data-fennevia-container-color` because they are
  allowlisted tokens;
- ADR-073 derives pinned and regular presentation partitions only from the
  existing `pinned` boolean and native snapshot order. Section counts and
  independent scroll geometry stay in the owning project DOM; they add no URL,
  title copy, persistence, diagnostics, native handle, Firefox DOM access, or
  cross-window state;
- native `#tabContextMenu` remains the owner of Duplicate, Close others, Send
  tab, Reopen in container, and Undo close;
- the required synchronous Firefox translation owner activates lazy Fluent IDs
  before direct popup open; Fennevia stores or logs no native label;
- a fixed NativeUi `tabContextMenu` token suppresses original-chrome reveal and
  is released on open failure, popup close, or bridge disposal;
- drag preview uses an immediate bounded transform on the complete existing
  project-owned source row, closed `up`/`down` background presentation tokens,
  and one CSS insertion marker. ADR-063 clears
  the transferable payload and adds only a fixed custom MIME marker with the
  constant value `1`: it carries no `text/plain`, URL, opaque tab ID, random
  drag ID, title, favicon, or native value. The browser-rendered ghost may
  mirror title/favicon pixels already visible in the same owning window, but
  Fennevia creates no page screenshot or bitmap and exposes no title, URL,
  thumbnail, or favicon bytes through drag data. One process coordinator may
  temporarily retain only the active native tab plus source context/window
  kind, pinned state, and liveness callback; target windows inspect only a
  bounded random ID, pinned boolean, and same/other-window enum. The native
  value never reaches Svelte, another window's reactive state, DOM, logs,
  persistence, clipboard, telemetry, or a network sink. A successful move may
  interpolate the existing bounded title into one text-only live output under
  the same restrictions. A target window's visible tab-shaped preview uses
  only a fixed localized label and packaged tab icon; it is aria-hidden and
  receives no source title, URL, favicon value, native DOM, or transferable ID;
- ADR-063's coordinator has one active transfer, rejects normal/private
  crossing, and retains no completed native object. Each window removes its
  capture listeners and cancels its owned source transfer on disposal. This is
  the owner's explicit narrow exception for tab drag only; it does not permit a
  general cross-window registry or any browsing-derived process-global
  snapshot;
- `gBrowser.adoptTab` and `replaceTabWithWindow` remain privileged named
  actions. Missing capabilities fail health open, and no native tab DOM is
  copied, moved, or mounted by Svelte;
- capture-phase browser-window `dragenter`, true-window `dragleave` identified
  by null `relatedTarget`, `dragend` when observed, target/source drop,
  cancellation, setup failure, and component/window disposal all clear
  geometry, visible target row, hidden layout slot, marker, transfer state, and
  the existing shared left pointer hold. Source snapshot disappearance after
  adoption is a second frontend-only hold-release signal; it compares only the
  already-bounded opaque tab ID, does not copy browsing data, and does not call
  source `endDrag` during target consumption. After DOM reconciliation it also
  releases focus/keyboard holds only when focus is no longer within the source
  surface. Non-null `relatedTarget` transitions stay inside the window.
  Target-window reveal uses that hold and adds no private timer or browsing
  data.

### 7.2 Navigation and address/status popup — implemented (#12 and #13)

Issues #12 and #13 expose only `canGoBack`, `canGoForward`, loading state,
bounded title text (256 code units), bounded display-URI text (2,048 code
units), bounded committed/draft address text (4,096 code units), fixed
connection/protection enums, and explicit named actions.

Rules:

- browser, controller, principal, Urlbar, identity/protections handler,
  content-blocking allow-list, command, observer, progress, and native event
  objects stay private;
- title, display URI, committed address, and draft are rendered or edited as
  text only and never enter logs, errors, datasets, persistence, project
  network requests, or another window;
- navigation actions accept no arbitrary URL and invoke the current window's
  source-validated `BrowserCommands` methods;
- Home invokes `BrowserCommands.home()` only. The configured homepage URL,
  `HomePage` module, and homepage-changed observers stay Firefox-owned and
  never cross the bridge;
- middle-click Back/Forward/Home/Reload copies only `button` and modifier
  booleans. Firefox still owns `whereToOpenLink`, `duplicateTabIn`, homepage
  loading, and reload-or-duplicate policy; no URL is invented or logged;
- action state is re-resolved against the current selected browser immediately
  before invocation;
- background and non-top-level progress cannot update selected navigation
  state;
- the ADR-043 top gutter light consumes only the public `loading` boolean.
  It is `aria-hidden`, contains no title, URI, or address text, and does not
  add a second progress listener or percent field;
- the compact launcher contains committed text only and no editable field;
- one popup draft exists only in the owning window's memory while open;
  background same-tab navigation cannot overwrite it, while selected-tab
  change closes and discards it;
- empty, over-4,096-character, `data:`, `javascript:`, and `vbscript:` input is
  rejected before native access;
- accepted input is assigned to the current native Urlbar and submitted through
  `gURLBar.handleCommand()`, leaving fixup, ordinary search, principal,
  disposition, and telemetry policy with Firefox;
- custom `Ctrl+L` cancellation occurs only when the healthy popup accepts the
  request; otherwise Firefox's retained native command proceeds;
- connection and protection labels derive only from fixed enum mappings of
  current Firefox handler state. Unknown, transient, and non-handleable states
  are `unavailable`; URL inference and decorative fake security claims are
  prohibited;
- ADR-059 combines those two labels into one accessible Trust summary and maps
  only the same closed enums to active/disabled/insecure/warning presentation.
  It does not read native Trust classes or add a privileged field;
- no certificate material, permission record, exception principal, or native
  handler state crosses into Svelte;
- the launcher and popup summarize combined connection/protection state but do
  not replace Firefox's authoritative Trust/identity/protections panel. Issue #37's fuller
  permission/action summary follows the separate fixed-state policy below.

The fifth address-overlay root remains inside the project frame. Popup activity
suppresses the four edge surfaces, and disposal clears its draft, focus history,
subscribers, listeners, and root before host removal.

### 7.3 Urlbar permission and page-action coverage — implemented #37

Each managed window owns one `urlbar-coverage` controller, one application
adapter, and one native observer. The observer reads only current owner-set
attributes and children below the document root, `gURLBar`,
`identity-permission-box`, `blocked-permissions-container`, and
`page-action-buttons`. It never modifies Firefox-owned DOM and has no timer,
polling fallback, or process-global mirror.

Only these ordinary values cross the bridge:

- permission availability and generic `hasPermissions` booleans;
- four fixed active-sharing enums;
- fifteen fixed blocked-permission enums;
- fixed current Urlbar-item availability enums; and
- one generic extension-action and one generic unknown-native-action presence
  enum.

URLs, origins, principals, certificates, permission records/scopes, policy or
private markers, extension IDs/names/icons/objects, page-action IDs/commands,
localized Firefox labels, provider results, search terms, browsers, windows,
and native nodes remain privileged within this coverage bridge. Unknown
permission IDs are omitted and unknown actions become generic presence only.
None of these values enters normal logs, persistence, CSS variables, or root
datasets.

The detailed popup renders fixed project labels from the bundled en / zh-Hant
catalogs (ADR-052). It still does not receive Firefox Fluent labels across the
bridge, synthesize native clicks, or expose permission/security mutation.
Its one native-access action
closes the project popup and calls the current window's `openLocation()` so
Firefox retains suggestions, providers, one-offs, extension actions, prompts,
and identity/trust/protections/permission/action panels. Missing capability,
observer/subscriber/component failure, malformed state, or handoff failure
uses the existing typed value-free fail-open path.

The observer is disconnected and subscribers/window references are released
exactly once on rollback, unmount, fallback, window close, or runtime stop.
Source inventory and real HTTP/HTTPS/internal/error/permission/protection/
normal/second/private/fail-open evidence are in ADR-031 and
`docs/research/firefox-153-urlbar-coverage.md`.

### 7.4 Native Urlbar provider projection — implemented ADR-061

The project owner explicitly approved the minimum additional frontend exposure
needed to render Firefox's own Urlbar results. Each managed window owns one
focused suggestions controller, one application adapter, one active Firefox
query context at most, and one boundary-scoped native-result registry. It
reuses the owning window's current input, controllers, and shared provider
manager; it creates no Fennevia search engine, provider, ranking model, history
index, suggestion service, telemetry, or network request.

The bridge publishes at most 20 immutable rows. Each row contains only a closed
type/source enum, heuristic boolean, direct/native execution enum, title up to
512 code units, description up to 1,024, source-validated icon reference up to
2,048, and opaque token up to 160. Allowed icons are current local Firefox or
extension schemes (`chrome:`, `resource:`, `moz-extension:`, `page-icon:`, and
`moz-page-thumb:`) or bounded base64 PNG/GIF/JPEG/WebP data. HTTP(S), file,
SVG-data, CSS interpolation, arbitrary attributes, provider names, and raw
payload serialization are rejected. Titles and descriptions render only as
Svelte text; icon references are assigned only to an image `src` property.

Native results, URLs as navigation authority, payload objects, engines,
controllers, browsers, windows, events, principals, and query contexts never
cross the privileged boundary. The existing popup already owns the bounded
draft; the suggestions snapshot does not copy query text. Ordinary result
execution resolves the current token back to the retained native result and
calls Firefox's own `pickResult`. Rich, dynamic, tip, unknown, and other
row-dependent results preserve the draft and use the complete native Urlbar.
Malformed, stale, removed, foreign-query, and foreign-window tokens are
rejected.

Replacement, empty incremental batches, ordinary close, selected-tab change,
failure, fallback, unmount, and disposal release projected strings/icons,
tokens, retained results, and the exact active context. Explicit native handoff
clears the project snapshot without reverting the draft Firefox must receive.
No query/result value or token enters normal logs, errors, diagnostics,
preferences, disk, clipboard, project telemetry, datasets, CSS variables, or a
project network sink. Fixed error metadata contains only code, phase,
allowlisted symbol, Firefox version/build, and window kind. Firefox's own
normal/private suggestion prefs, search modes, allowed sources, provider
filtering, and remote-result policy remain unchanged.

Focused tests prove bounds, immutable copying, stale/foreign token rejection,
normal/private registry isolation, replacement and late callback behavior,
failure redaction, controller restoration, rich-result handoff, search-mode
continuation, cleanup, ARIA structure, and property/text-only rendering. The
Firefox 154 provider-contract and production-panel probes contain only fixed
counts/enums/booleans. Representative providers, remote-suggestion preference
combinations, second/private real windows, and the release matrix remain not
run. See `docs/research/firefox-153-154-native-urlbar-suggestions.md`.

### 7.5 Browser-tool native handoffs — implemented ADR-037/ADR-042/ADR-057, composable widgets and customize mode ADR-044/ADR-045/ADR-046/ADR-047/ADR-074–ADR-076

Each managed window owns one `browser-tools` Firefox controller and one ordinary
application adapter. The controller validates twenty required current
capabilities and one optional translations owner while native UI is visible,
and accepts only ten fixed actions:
site information, protections, site permissions, native Downloads, Unified
Extensions, built-in full-page translation, application menu, Settings, native
customization mode, and complete original-toolbar access. Every action
re-resolves its owner. The seven popup
actions require a project-owned XHTML host in this window, keep native chrome
hidden, and re-anchor the Firefox-owned panel beside that host. Settings,
customization, and complete original-toolbar access keep their previous owners;
only the complete-toolbar action still requests reversible navbar reveal. The
top row does not show dedicated original-toolbar, Downloads, or
native-customize buttons; Downloads and translation are available as the
placeable `show-downloads` and `show-translate` widgets, and the application
menu plus fail-open remain the visible native-chrome access paths.

Only ten availability booleans, the fixed action/result values, an optional
host and transient initiating event for popup actions, and a privacy-safe
`{ open, type: "native-popup" }` hold cross the bridge. Host/event objects are
never serialized, retained in snapshots, placed in datasets, or logged.
The following remain privileged and absent from Svelte, DOM attributes,
persistence, normal logs, and project network requests:

- URL, origin, page-title, address, search, and history data;
- certificate, HTTPS-only exception, site-data, tracker, breach, and protection
  details;
- permission IDs, states, scopes, origins, sharing records, prompts, and native
  labels;
- extension IDs, names, icons, widgets, customization state, actions, and
  commands, except the bounded owner-approved ADR-044/ADR-045/ADR-046 rendering and
  customize flows below;
- download names, paths, source URLs, byte records, errors, and native objects;
- Firefox nodes, panels, handlers, preferences, principals, windows, and
  controller objects.

Firefox initializes, populates, and owns each opened panel. ADR-059's one custom
Trust button, matching popup row, and the independent permission row display
only the already reviewed bounded connection, protection, and permission enums
and explicitly open the authoritative native Trust or permission owner. Both
fixed security bridge actions remain intact even though the visible entries are
merged. The native
permission and Downloads panels retain their
mutation, safety, and management behavior. Unified Extensions and the complete
original-toolbar handoff preserve arbitrary extension access without exposing
extension identity. Settings uses Firefox's current method rather than a
project-constructed URL; native customization suspends all Fennevia hiding for
the current Firefox lifecycle.

The controller has no polling loop, generic widget registry, or process-global
state. Document-level `popupshown`/`popuphidden` listeners exist only for the
allowlisted panel ids and are removed on dispose. Disposal hides any still-open
handoff panel, clears `gPermissionPanel.setAnchor`, ends NativeUi tokens, and
drops the owner-window reference. Malformed input/result, missing owner, invalid
host, or thrown native action uses only fixed
code/phase/symbol/version/build/window-kind diagnostics and the existing
per-window fail-open path. ADR-060's general icon component accepts only a
fixed token and references exact installed `chrome://` / `resource://` paths
as inline masks; ADR-059's Trust component retains its stricter four-state
installed resource map. Neither component accepts user-derived URLs, copies
Firefox bytes, introduces a content mapping or network fallback, or moves the
accessible name off the semantic owner. The remaining project-authored caption
and ambiguous fallback SVGs contain no external asset, metadata, script, URL,
or runtime load. See ADR-037, ADR-042, ADR-059, ADR-060,
`docs/research/firefox-153-native-popup-anchoring.md`, and
`docs/research/firefox-153-154-native-shell-icons.md`.

Owner-approved ADR-044/ADR-045/ADR-046/ADR-074–ADR-076 widget and customize flow: each
managed window may own one optional `toolbar-widgets` controller. It renders a
strict bounded version-2 tree under the four fixed edge roots. The default tree
uses the deterministic native-v2 Top controls/address/handoffs/window commands,
tabs-side, bookmarks-side, and Bottom Downloads composition. Current
`CustomizableUI` placements remain palette choices rather than
profile-dependent defaults.
Ordinary layout nodes expose only a layout-local instance id, closed
project/container/wrapper/special kind, Row/Column direction, a fixed
Center/Expanded/Padding wrapper kind, children, and immutable widget
presentation. Eligible project items additionally expose only one effective
fixed style id from the widget-specific ADR-075 registry. Each placed widget
carries an opaque handle, fixed kind,
bounded label and tooltip text, a bounded `moz-extension://` icon URL for
extension actions, a bounded `chrome://` or `resource://` icon URL for
built-ins (rendered as a CSS mask with `currentColor`, not `<img>`), bounded rgba-only
badge text/colors, a fixed curated presentation token whose exact meanings now
prefer ADR-060's packaged Firefox map, disabled/missing flags, and at most eight
built-in compound-part records with separate opaque handles and the same
bounded presentation fields, plus a widget palette of every remaining current
`CustomizableUI` widget (placed areas and the unused palette), fixed project
widgets, Row/Column, Center/Expanded/Padding, and the fixed specials, each behind an opaque palette
token. Extension name, icon, and
badge are extension identity and may exist only in that window's in-memory
frontend state and rendered DOM (`img src`, button label/tooltip, badge chip).
Built-in chrome/resource icon URLs follow the same in-memory-only rule via
per-element `mask-image` (ADR-046). Widget ids, compound child ids, and native
nodes stay in the privileged handle/token registries.
Extension identity never enters logs, diagnostics, serialized frontend state,
CSS custom properties on shared roots, root datasets, clipboard, or network
requests; diagnostics stay at widget counts, revisions, and fixed codes.

ADR-045 adds two owner-approved bounded exceptions. ADR-064, ADR-074, ADR-075,
and ADR-077 extend only the first exception's closed schema. First, profile-local persistence: the
privileged controller stores the Fennevia layout, style, and panel policy as
bounded versioned JSON in the `fennevia.customize.layout`,
`fennevia.customize.style`, and `fennevia.customize.panels` string preferences
(16 KiB cap each, strict schema,
invalid values fail safe to the default composable layout and default style).
The layout pref contains Firefox widget ids — including extension widget ids —
fixed project/special/wrapper tokens, bounded node structure, layout-local
instance ids, `allowMultiplePlacements`, and an optional allowlisted
per-instance style id on eligible project items; the style pref contains only the
fixed style token set (theme, `#rrggbb` color tokens or empty defaults, and
bounded integers for blur, radius, density, surface opacity, saturation,
shadow, motion, font size, in-window hide delay, window-leave hide delay,
temporary reveal duration, shortcut-tip duration, and edge trigger size). The
panel pref version 3 contains independent Left/Right/Bottom enabled booleans,
the legacy closed side-layout migration hint, two closed activity-light enums,
ADR-068's `allowCompactWindow` boolean (default false), and ADR-077's one
four-value `panelDodgeMode` enum (default `multiple-dynamic`); Top has no
enabled field. Versions 1 and 2 migrate in memory and unknown modes or keys
fail safe. Neither the panel pref nor the optional item-style field can encode
arbitrary geometry, CSS declarations, class names, labels, a URL, or feature
activity.
Compact-window only toggles a root attribute and one
active/not-suspended `min-width`/`min-height` override; it stores no browsing
data and is not a health input. Missing keys keep documented defaults.
ADR-054 keeps those interaction values at 100–5,000 ms, 100–5,000 ms,
400–10,000 ms, 0–10,000 ms, and 6–24 CSS px respectively; old version-1 values
receive the defaults. Empty color tokens resolve through CSS
`var()` to Firefox chrome design-system properties already on `browser.xhtml`;
Fennevia does not persist or log those resolved colors. None of the three prefs may ever
contain URLs, titles, text input, browsing data, or private-window state.
Second, bounded
`CustomizableUI`
writes: placing a widget that has no live node calls
`addWidgetToArea(id, "nav-bar")` on the collapsed native nav-bar and records
the id in the persisted `adopted` list; removing the last Fennevia placement of
an adopted id restores it (`addWidgetToArea(id, AREA_ADDONS)` for extension
widgets, `removeWidgetFromArea(id)` otherwise), and layout reset restores every
adopted id and clears the pref. Confirmed **Clean all panels** restores the same
adopted ids, then persists a tree containing only Top Customize. Fennevia never
writes any other CustomizableUI state and never edits placements the user made
natively.

ADR-047/ADR-074–ADR-076 add a frontend-only customize session: HTML5
`dataTransfer` on
project-owned nodes may carry the MIME `application/x-fennevia-toolbar-widget`
and a JSON payload of an opaque palette token or layout-local instance id.
Destination zone, bounded parent path, and insertion index are derived from the
owned target rather than transferred as Firefox identity. The payload never
includes Firefox widget ids, extension identity, URLs, labels, preview
geometry, or style ids. ADR-075 derives its bounded drag image and exact
projected insertion slot only from that opaque source plus the already
validated in-memory ordinary snapshot. Preview labels, icons, geometry,
autoscroll values, active destination, and palette query/category are ephemeral
frontend state. ADR-076 stores only one validated layout-local selected
instance id in the existing per-window session; inspector position, obstacle
rectangles, focus target, and announcements remain component-local. None enters
`DataTransfer`, preferences, the privileged bridge, diagnostics, clipboard, or
a network sink. Preview and inspector XHTML are project-owned and
never clones or reparents a native Firefox node. The session is not persisted;
the frame marker
`data-fennevia-customize-active` is a boolean presence attribute.
The in-process drag-lifecycle listeners receive only that same opaque source
and are deterministically unsubscribed. The inspector's scroll/resize
listeners and `ResizeObserver` are present only while it is mounted and are
deterministically removed; target-outline, selection-boundary, and inspector
visibility remain transient component/CSS state with no persistence or log
sink.

Compatible duplicate placement resolves one current in-process owner and never
duplicates a native node or panel. Stateful feature ids remain singleton;
Row/Column/Center/Expanded/Padding/Separator/Space/Flexible space remain
repeatable because they contain no browser identity. The Clean confirmation alert stores only a transient
boolean and fixed localized text. Empty enabled drop targets, blank layout
gaps, and ordinary-mode window-drag regions add no dataset value beyond fixed
project attributes and no new log or persistence sink.

Activation resolves only registry handles, validates the project host, and
uses the transient in-process button event only while invoking a Firefox owner.
The event is never serialized, logged, persisted, or copied into frontend
state. Wrapper views open through `PanelUI.showSubView`; Account, Library, and
All Tabs retain their fixed Firefox owners; native menu popups use
`XULPopupElement.openPopup`; compound parts invoke only their registered native
child. The Zoom reset part's visible `valueText` may only equal its existing
bounded Firefox-derived label; it is kept in the in-memory snapshot and is not
logged, persisted, or copied to a root dataset or CSS property. Remaining
simple widgets dispatch the native node command. Any temporary per-window
owner-anchor substitution is restored immediately after the call, and
resulting Firefox-owned panels use the existing ADR-042 hold/release and
re-anchor path. Fennevia-owned widgets run fixed frontend actions without
touching the bridge. Edit operations accept only the validated fixed operation
set, bounded paths, and a revision guard.
The capability is optional: a missing `CustomizableUI`/`PanelUI` hides the
layouts, a drifted compound child marks that placement missing, and a missing
`Services.prefs` disables editing, in every case without joining activation
health. Disposal detaches the CustomizableUI listener, the
preference observer, the attribute `MutationObserver`, popup listeners, pending
waiters, widget/part handles, palette tokens, and any held panel exactly once.
Style tokens are applied as the fixed CSS custom-property set on the project frame root,
skip color overrides under forced colors, and are cleared on dispose. The
interaction integers additionally update the same per-window #31 controller;
they create no host, observer, timer, or process-global activity record. Focus,
keyboard, and popup holds remain authoritative regardless of duration. The
chrome background token is applied only by NativeUi as
`--fennevia-chrome-background` on `:root#main-window`; the frontend never
writes Firefox-owned documentElement styles. Forced colors and an empty token
remove that property so Firefox `--toolbar-background-color` remains
authoritative.

ADR-055's four common panel context menus contain only fixed localized labels,
closed action names, and ephemeral coordinates clamped to the project frame.
They delegate through existing typed tabs/bookmarks/browser-tools adapters.
The configured bookmark-side row menu carries only its existing opaque ID; the
configured tab side keeps Firefox's own menu. No URL, title, Places GUID,
download detail, native
node, private-window activity, or preference is added to menu state, datasets,
logs, or persistence. Per-edge popup holds and document/window listeners exist
only while a menu is open and are removed on every close or disposal path.

### 7.6 Bookmarks — implemented #14

The Places controller is per window and holds native modules, records, GUIDs,
URL objects, observers, node-like opening values, and the owner window only in
`src/firefox/bookmarks.ts`. Svelte receives immutable ordinary nodes containing
only an opaque context-bound ID, fixed kind, title, and `hasChildren`. URLs,
GUIDs, numeric database IDs, principals, native objects, and folder paths never
enter application state, DOM attributes, serialized data, or diagnostics.

Bookmark and folder titles are browsing data. They may exist as text only in
the owning window's in-memory bounded page and rendered panel. Each title is
limited to 160 Unicode code points. The bridge returns at most 32 children per
page, the application keeps one page per loaded branch, visible depth is capped
at 8, at most 20 folders may remain expanded, and collapse discards descendant
pages. There is no recursive `fetchTree()`, complete database mirror, polling,
project preference, session persistence, clipboard export, search index,
analytics, or network sink.

One paired native observer covers add/remove/move/reorder/title/URL changes.
Events expose only already-known opaque affected-parent IDs; batches above 128
records or 16 parents collapse to one fixed all-scope signal. Subscriber and
observer errors carry fixed code/phase/symbol/build/window-kind fields only and
request the existing per-window fail-open path. They never include title, URL,
folder contents, Places GUID, or private activity. Removal events immediately
release every registered removed-node handle, including descendant removals.

Opening accepts only an opaque bookmark ID and current/new-tab disposition. The
bridge re-fetches the current native record, rejects stale/foreign/folder/
separator handles and `javascript:`, `data:`, `vbscript:`, or `place:` schemes,
then delegates node conversion and opening to current `PlacesUIUtils`.
Firefox retains its URL security check, trusted-link principal behavior,
bookmark transition data, native-window/default
context policy, and private targeting. After a `new-tab` open, Fennevia
restores the previously selected native tab so the current tab does not change;
that restore reads no URL or title. Fennevia does not provide a `loadURI` shortcut,
bookmarklet execution, or project-owned principal.

The fixed Manage Bookmarks action accepts no identifier or user text and calls
the current window's required
`PlacesCommandHook.showPlacesOrganizer("UnfiledBookmarks")`. Firefox owns the
Library window, editing/search/import/export behavior, and reuse policy. A
bookmark-row context menu offers only existing current/new-tab open, folder
expand/collapse, and this Library action. It stores no URL or title beyond the
already-rendered bounded row and releases its configured side-edge hold/listeners on
dismissal or disposal.

Firefox natively shares profile bookmarks with private windows. Fennevia shows
that same native data but gives every private window an independent transient
view, handle registry, observer subscription, selected root, loaded page,
expansion, scroll/focus, and disposer. It records no private-window bookmark
activity and shares no project state with normal windows.

Titles are rendered through Svelte text bindings with fixed packaged Firefox
folder/bookmark/disclosure icons. ADR-064 may add one optional favicon obtained
only from Firefox's existing Places cache. The privileged bridge converts the
current bookmark URL to `nsIURI` locally, requests a DPI-bounded width, accepts
only a base64 raster `data:` URI up to 262,144 characters, and then discards the
URL/native result. The frontend assigns that value only through `img.src`, with
`referrerpolicy="no-referrer"`, no accessible label, and the packaged bookmark
icon as the failed/missing fallback. SVG data, remote icon URLs, CSS URLs,
thumbnail/metadata fetching, synchronization, logging, persistence, and project
network requests remain prohibited. A `favicon-changed` event emits only the
existing fixed all-scope refresh signal; its page/favicon URL fields never cross
the bridge. The native
bookmarks toolbar, sidebar, Library, dialogs, `Ctrl+D`, and management paths
remain attached, visible, and authoritative. Initial query or required Places/
opening capability failure blocks health and leaves those native paths usable.
Source evidence and real hostile-title/private/fail-open tests are in
`docs/research/firefox-153-bookmarks-surface.md`,
`docs/research/firefox-153-154-panel-context-actions.md`,
`docs/research/firefox-154-configurable-panels-bookmark-favicons-status.md`,
ADR-029, ADR-055, and ADR-064.

### 7.7 Downloads — implemented #32

Each managed window owns one typed controller and exact Firefox list view.
Normal windows select `Downloads.PUBLIC`; private windows select
`Downloads.PRIVATE`. Firefox retains any same-kind backend sharing, while every
Fennevia view, opaque registry, subscriber, adapter, component state, and
disposer remains per-window and transient.

Only fixed state, optional integer percentage, context-bound opaque ID, capped
counts, and at most six anonymous items cross the privileged boundary. The
bridge does not expose a display name at all. Native download objects,
lists/views, paths, filenames, source/referrer URLs, principals, headers,
cookies, private markers, error detail, and byte values remain privileged and
do not enter application state, Svelte, DOM attributes, logs, or persistence.

Known positive totals are weighted by bytes inside the bridge. Any active item
without progress produces an explicit indeterminate state; if all known totals
are zero, Firefox-reported percentages are averaged. Existing terminal history
is ignored during initial replay, and at most three newly observed terminal
records remain in hidden transient state. Counts cap at 999 with explicit
overflow. One exact list view supplies added/changed/removed/batch callbacks;
there is no polling or feature timer, and disposal pairs `removeView()` once.

Download events never reveal a panel. ADR-074's movable singleton Downloads
status widget consumes only the existing controller of whichever edge contains
it; moving or removing it does not duplicate or stop the per-window bridge. It
contains no open, execute, reveal-in-folder, retry, pause, resume, cancel,
delete, or file action. The
ADR-043 bottom gutter light reuses the same anonymous aggregate and optional
percentage; it is `aria-hidden`, `pointer-events: none`, and never receives a
filename, path, source URL, or byte count. Native
Downloads button/panel, notifications, reputation, malware and executable
warnings, permission/confirmation, file picker, history, and management remain
attached, visible, tested, and authoritative. Missing capabilities or malformed
records fail the owning window open with fixed value-free diagnostics.

Source and real normal/second/private/native-panel/hard-disable/fail-open
evidence is in `docs/research/firefox-153-downloads-surface.md` and ADR-030.

## 8. Dependency and supply-chain policy

Before adding or upgrading a dependency, record:

- exact purpose and why platform/local code is insufficient;
- install/build/runtime execution stage;
- license and provenance;
- maintainer/release activity;
- transitive impact;
- lifecycle scripts;
- network/download behavior;
- native/platform binaries;
- code generation;
- bundle and attack-surface impact;
- removal/replacement cost.

Use `docs/dependency-review-template.md` and store accepted records under
`docs/dependency-reviews/`.

Requirements:

- commit the lockfile;
- use the selected exact/controlled version policy;
- install with lifecycle scripts disabled unless separately reviewed;
- review every native binary and optional platform package;
- keep build tooling out of the installed Firefox package;
- use no component library solely for convenience;
- run dependency audit and deterministic production artifact gates;
- repeat the review on every upgrade.

Current frontend toolchain evidence is in
`docs/dependency-reviews/frontend-toolchain-2026-08-15.md`.

No current feature uses Tailwind, Shadow DOM, a component library, a CDN, remote
font, analytics SDK, or runtime update client.

## 9. Chrome and resource exposure

- Use dedicated project namespaces.
- Default to no content-accessible mapping.
- Never expose source maps, diagnostics, privileged implementation, user data,
  secrets, or development tools to web content.
- Review every `content`, `resource`, `skin`, `style`, and `override` manifest
  declaration.
- `contentaccessible=yes` requires a dedicated issue, security rationale,
  current-source review, exact inventory, content-context test, and removal
  test.
- An `override` additionally requires the override policy, upstream pin, diff
  workflow, regression tests, and removal plan.
- Do not add a mapping merely to simplify imports.

Current state:

- manifest contains the project `content` package;
- no `contentaccessible=yes`;
- reserved `resource://fennevia/` alias is not registered;
- no override;
- generated shell and bridge artifacts remain inside the privileged-only
  package;
- issue #12 adds no mapping, content-accessible resource, runtime endpoint, or
  remote asset;
- ordinary loopback content could not fetch the project entry in validated
  evidence.

## 10. Production artifacts and debug policy

The current installed profile inventory is the closed, manifest-derived
`expectedFiles` list in `package-manifest.json`; that machine-readable list is
the source of truth rather than a duplicated prose count.

Requirements:

- build frontend and bridge twice and compare exact bytes;
- synchronize committed hashes;
- reject extra chunks/files;
- reject HMR/dev-server/source-map/runtime-endpoint/network API/bare import/
  dynamic import/debug/executable findings;
- reject symlinks/junctions and unsafe artifact paths;
- keep development source and failure-selection hooks out of installation;
- do not hand-edit generated output;
- scanner has no silent bypass.

Development source maps may remain local. Installed source maps or a production
debug API require an explicit reviewed decision.

Failure injection is implemented through pure constructor collaborators and
owned test wrappers, not a production preference, global, or UI control.

Issues #12–#14 and #32 add no dependency or installed debug artifact. Their
generated bridge, application, UI, and CSS changes remain subject to
deterministic double-build, exact-inventory, and production-network/debug scans.

## 11. Installation and file-system safety

Install, update, repair, disable, enable, and uninstall must:

- require explicit Firefox program and profile targets;
- resolve and validate canonical paths;
- report a program directory writable only after an exact create-and-delete
  probe succeeds without residue;
- require mode-specific marker/registration/ownership evidence;
- reject root, home, broad, profile-collection, mode-inappropriate,
  reparse-point, traversal, and ambiguous targets;
- show a redacted dry run before mutation;
- write only project-owned paths;
- stage and hash new files before replacement;
- back up owned files;
- use a recovery journal;
- roll back caught partial failure;
- block later actions after interrupted transaction until recovery;
- let repair reconstruct only one wholly absent side from a valid survivor and
  byte-identical package proof, rejecting partial residue or source mismatch;
- let uninstall use one valid survivor without package bytes only when the peer
  metadata is wholly absent, every present owned file still matches, and every
  removal remains ownership-listed or an empty recorded directory;
- validate a release's strict whole-tree inventory/digests before planning,
  require Firefox major version 153 or newer for install, update, repair, and
  enable, warn that only 153 and 154 are tested, and require enable to use
  ownership's exact source manifest;
- remove only ownership-proven files/directories;
- restrict GUI elevation continuation state to an exclusive, bounded,
  owner-only non-reparse file directly under the OS temporary directory, and
  surface cleanup failure without disclosing its path;
- never silently choose a default or daily-use profile;
- leave unrelated profile content untouched.

`Disable` and `Uninstall` intentionally do not require release compatibility or
a readable release manifest. Uninstall may also use one valid surviving
ownership record, but cannot delete a changed present file or proceed through
missing-side metadata residue. They remain ownership-limited recovery actions
after Firefox updates. Registered mode is opt-in and proves only the explicitly
passed path against Firefox registration; it never enumerates a profile into
normal output or chooses one for the operator.

The optional `scripts/fennevia.ps1` console and the release GUI
(`FenneviaSetup.exe` / `scripts/lib/FenneviaGui.psm1`) may list `profiles.ini`
**Name** values in a local interactive picker. That listing is not written to
`installer.plan`, `installer.result`, `installer.status`, or other copyable
output. Neither host preselects Firefox's default profile; both require a
second confirmation before using a default. They do not kill Firefox or apply a
package plan without the displayed `planSha256`. The transaction engine does
not elevate itself. The GUI may relaunch through Windows UAC only after the
user clicks **Continue as administrator** because the selected program
directory is not writable, and only after the warning and plan are confirmed.
The elevated instance recomputes the plan and refuses a changed digest. Status
never elevates.

The current implementation is in `scripts/fennevia.ps1`,
`scripts/fennevia-gui.ps1`,
`scripts/fennevia-package.ps1`, `scripts/lib/FenneviaConsole.psm1`,
`scripts/lib/FenneviaGui.psm1`,
`scripts/lib/FenneviaTui.psm1`, and
`scripts/lib/FenneviaInstaller.psm1` plus its fixed, release-inventoried
`scripts/lib/installer/{Common,Discovery,Ownership,Planning,Transaction,Public}.ps1`
implementation files. The module never scans that directory; missing or
unexpectedly unshipped required files fail import rather than weakening path,
ownership, or rollback checks. Operator behavior and recovery are in
`docs/installation.md`.

The development-profile helper follows the same principles and manages only its
marker-owned `%LOCALAPPDATA%\fennevia\profiles\...` root and, when requested,
the marker-owned `%LOCALAPPDATA%\fennevia\program-spikes\firefox-stable-copy`
program copy. Program-copy deletion is limited to that exact managed prefix
and a valid `.fennevia-program-spike.json` marker.

## 12. Native security UI preservation

Firefox remains responsible for:

- site permissions;
- authentication prompts;
- TLS/certificate warnings;
- identity and permission panels;
- extension installation;
- download reputation, malware, and executable warnings;
- file pickers;
- protected-content/device prompts;
- notification boxes;
- find bar;
- browser and window modal dialogs;
- native app/extension/Library/Downloads access not explicitly replaced.

Current #31 behavior:

- one zero-layout frame over the browser content area;
- pointer-transparent center;
- only narrow edge triggers and visible surfaces accept pointer input;
- all four edges suspend for native modal state, DOM fullscreen, and customize
  mode;
- native titlebar, toolbox, sidebar, popup sets, tabbox, browser content,
  notifications, prompts, and OS controls are never owned by Svelte; only the
  privileged reversible native sheet may alter their reviewed active geometry,
  and ADR-050's process author sheet may collapse the same reviewed toolbox
  surfaces before `active` for at most the health deadline.

Issue #12's top surface invokes retained Firefox commands. The native navbar,
Urlbar, identity/permission UI, prompts, and security indicators remain attached
and authoritative; Fennevia's bounded location text is not a security indicator.

Issue #37 adds only fixed read-only status/action availability and an explicit
handoff to `window.openLocation()`. It does not replace native panels, prompts,
providers, extension actions, or commands.

ADR-037, ADR-042, ADR-056, and ADR-057 add fixed native browser-tool handoffs
and popup placement. They do not inspect or copy the sensitive panel data described in
section 7.4; Firefox remains the panel, prompt, command, extension, download,
customization, and window-control owner.

Issue #15 implements the narrow active-only boundary in ADR-032. One privileged
controller validates exact Firefox toolbar/sidebar/titlebar nodes and one
ten-rule project style. ADR-068's compact-window rule is opt-in and not a
health capability. ADR-050 adds one process-scoped author stylesheet
with no browsing data, scoped by `@-moz-document` to
`chrome://browser/content/browser.xhtml`. Neither the controller nor that sheet
reads URLs, labels, principals, certificates,
permissions, extension identity, popup contents, sidebar contents, or browser
content. ADR-064's two added rules select only the fixed
`#statuspanel-label` owner and forced-colors mode; they read or replace no status
text, URL, hover target, timing, or visibility state. Root state stores only
fixed reveal/suspension booleans; logs contain
only fixed error phase/code, Firefox version/build, and per-window opaque ID.

Toolbox/toolbar geometry, exact non-caption content, the bookmarks toolbar, and
exact native sidebar surfaces collapse only while active and not
revealed/suspended. Native vertical-tab mode retains its navbar titlebar owner.
The browser receives only a 7px gutter and the tabbox receives only
border/radius/clip styling. Every native caption copy is collapsed at rest;
ADR-038 project-owned top-row buttons call Firefox window commands without
clicking those nodes. Native focus, an open native sidebar, #37 Urlbar handoff,
and the ADR-037 original-toolbar action reveal the complete native owner.
Fennevia-initiated Trust, permission, Downloads, extensions, and
application-menu panels that are token-listed or re-anchored to a project host
do not reveal the navbar. ADR-056 gives other non-security hidden-toolbox XUL popups one
fixed project-owned, non-interactive proxy anchor after `popupshown`; it stores
only popup references, timers, and counts per window and never reads popup
children, labels, origins, permission state, extension identity, or actions.
Missing/ineffective relocation reveals Firefox chrome and a thrown relocation
suspends hiding before fail-open. ADR-057 excludes the shared
`#notification-popup` from post-open movement. NativeUi wraps Firefox's lazy
owner descriptor without reading it, invokes the original stored visible-anchor
callback first, and substitutes the health-checked project proxy only for a
hidden-toolbox anchor before initial placement. The exact callback/descriptor
is restored on failure, unload, and disposal. A successful pre-anchor keeps
original chrome hidden with one native security-delay cycle; unavailable or
ineffective routing immediately holds complete native reveal. The
owner-observed Firefox 154 AMO path currently uses that accepted native-chrome
fallback. Fennevia reads no
notification contents/actions. The placeable translation widget delegates to
`FullPageTranslationsPanel.open(event)` and routes only the native panel to the
clicked host; page text, languages, model state, and results never cross.
Customize,
native-dialog, and DOM-fullscreen state suspend project hiding. Window-modal
suspension follows `#window-modal-dialog.open` or a current tab dialog, not a
leftover `window-modal-open` attribute. Any missing,
invalid, partial, or stably changed required target/style first exposes native
UI and then requests per-window ADR-021 cleanup.

Issue #15 adds no dependency, network request, resource mapping, executable
input, content-accessible asset, preference, persistence, remote font, or new
data flow. ADR-050 adds only a local author sheet and
`browser.startup.preXulSkeletonUI=false` in program defaults; it still transmits
no browsing data. The detailed threat and coverage evidence is in
`docs/research/firefox-153-content-only-activation.md` and
`docs/research/firefox-153-startup-native-hide.md`; ADR-056/ADR-057 source and
security boundaries are recorded in
`docs/research/firefox-153-154-native-popup-proxy.md` and
`docs/research/firefox-153-154-install-notification-and-translations-widget.md`.

## 13. Private windows

Private-window behavior is feature-specific: fully validated support or complete
native fallback.

Global rules:

- no browsing-derived persistence;
- no private URL/title/query/bookmark/download data in diagnostics;
- no process-global copy of private browsing-derived feature state;
- no persistent or general cross-window native handle. ADR-063 permits only
  one short-lived active native tab in its privileged drag coordinator, keyed
  by window kind and invisible across the normal/private boundary;
- no profile preference reflecting private activity;
- exact per-window cleanup on close/fallback/disposal;
- uncertainty means complete native fallback.

Implemented:

- base lifecycle, health, frame, edge controller, tabs bridge, vertical tab UI,
  navigation/address bridge, compact launcher, centered popup, top controls,
  Urlbar-coverage bridge/details/native handoff, Urlbar-suggestions controller
  and registry, bookmarks bridge/configured side panel, Downloads bridge/bottom panel,
  and native visibility controller have isolated normal, second-normal, and
  private instances;
- opaque IDs include context/registry generation;
- ADR-063 normal/private drag inspection and adoption are mutually rejected;
  disposing the source owner cancels its ephemeral transfer state, and every
  target removes its capture listeners;
- controllers, roots, holds, timers, listeners, mappings, and state are removed
  per window;
- one window's emergency fallback does not mutate another.

Issues #12–#15, #32, #37, ADR-037, and ADR-061 give each window its own
navigation, Urlbar coverage, Urlbar suggestions, browser-tools, bookmarks, and
Downloads controllers; selected snapshots; navigation, popup, Urlbar result,
bookmark, and download subscriber sets; popup
controller/draft; two tab listeners; one tabs progress listener; one command
observer; one Urlbar owner-state observer; at most one active Urlbar query and
one context-bound result registry; one Places observer; one Downloads list
view; application adapters; five roots; and text output. Title, display URI,
address text, draft, projected result text/icons, bookmark titles, and anonymous
download progress may describe private browsing, so they are never
process-global, persisted, logged, placed in datasets/errors, or copied to
another window. Background and
non-top-level navigation progress is ignored.
Frontend unmount, emergency fallback, window close, runtime stop, capability
failure, and startup rollback remove all listeners/observers/subscribers and
release snapshots, drafts, loaded pages, and opaque mappings with that
window; Downloads cleanup additionally removes the exact native view and its
anonymous transient state.
Normal, second, and private-window isolation passed in real Firefox. Full
evidence is in `docs/research/firefox-153-navigation-controls.md`,
`docs/research/firefox-153-address-popup.md`,
`docs/research/firefox-153-urlbar-coverage.md`,
`docs/research/firefox-153-bookmarks-surface.md`, and
`docs/research/firefox-153-downloads-surface.md`.

ADR-061's focused tests prove normal/private token and registry isolation, but
its real second-normal/private provider matrix is not run. The Firefox 154
focused probes used one normal development window only and do not expand the
historical private-window validation claim.

ADR-037/ADR-042's browser-tools unit/build boundary is per-window by
construction, but the real second/private-window native-panel placement matrix
was not run and remains explicitly pending in
`docs/research/firefox-153-native-popup-anchoring.md`.

## 14. External code, design references, and provenance

Before copying external code:

- verify repository, file, and commit;
- verify license and file-level notices;
- preserve required headers/attribution;
- record source URL, commit, modifications, and notice;
- keep third-party code distinguishable;
- treat unlicensed/unclear code as unavailable.

`yutinglia/my-firefox-custom` may be inspected for capabilities and broad design
concepts only. Do not copy/adapt its code, event structure, timers, globals,
selectors, IDs, classes, token names, numeric values, native-DOM mutations,
loader assumptions, module layout, or visual composition.

The implementation record must name the exact consulted commit, list only the
concepts retained, describe independent Fennevia decisions, and confirm no
implementation/layout copying.

Issue #18 selected MPL-2.0 for original project material, same-license inbound
contributions, and project-authored generated/installed output. Third-party
material keeps its own terms. `docs/licensing-and-provenance.md` is the normative
handling/distribution policy and `THIRD_PARTY_NOTICES.md` is the distributed-
material source of truth. Unclear or unlicensed material remains prohibited;
public visibility alone is not permission to copy it.

## 15. Security review triggers

A dedicated review is required before:

- runtime network access;
- dynamic code generation;
- privileged runtime dependency;
- content-accessible mapping;
- Chrome Registry override;
- security-prompt/identity/authentication/certificate/download-safety/
  extension-install replacement;
- new profile persistence;
- untrusted HTML processing;
- arbitrary URL/scheme execution;
- file open/execute/delete/reveal actions;
- installer deletion-scope change;
- telemetry, analytics, crash upload, or remote update;
- hiding a native parent with uncovered descendants;
- custom titlebar replacement beyond ADR-038/ADR-074's retained-native caption
  and project-rendered duplicate-placement exception.

Use `docs/security-controls.md` for required evidence. An ordinary “no impact”
checkbox is not a waiver.

## 16. Reporting

Follow `SECURITY.md`.

Do not disclose an exploitable system-principal, installer, resource-exposure,
privacy, or hidden-security-UI vulnerability publicly before the repository
owner has had a reasonable opportunity to investigate.

Shared reports must use the allowlisted diagnostic fields and redaction rules.
Never paste raw page URIs, local/profile paths, search text, bookmark/download
data, tokens, cookies, headers, or private-window browsing values.
