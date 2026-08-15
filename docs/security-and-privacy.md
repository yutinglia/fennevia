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
- tab, navigation, address, Places, and Downloads data flows;
- resource mappings;
- diagnostics and shared evidence;
- install, update, disable, and uninstall;
- documentation and copied code.

This document defines policy. It does not claim a formal security audit,
penetration test, or hardened production release.

`docs/security-controls.md` is the operational companion containing the current
threat model, artifact gate, logging contract, resource review, installer
controls, private-window rules, and review triggers.

## 2. Current security baseline

Current validated package: `0.7.0-dev` on Firefox 153.0.4 for Windows.

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
- bounded navigation title/display-URI text and explicit native command actions;
- hidden-at-rest four-edge state with pointer-transparent center;
- explicit suspension for native modal state, DOM fullscreen, and customize
  mode;
- default-deny diagnostics and no runtime network sink;
- path-safe package lifecycle with ownership manifests and rollback.

Not implemented yet:

- address, Places/bookmarks, and Downloads feature bridges;
- final native-visible-shell hiding;
- public release/security hardening;
- project license decision.

Native Firefox UI remains visible and is the independent fallback.

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
- Do not hide native UI before #15's complete coverage inventory and recovery
  matrix.

## 5. Four-edge interaction security

The current frame has top, left, right, and bottom project-owned surfaces.

Requirements:

- hidden surfaces reserve no permanent content geometry;
- the frame is pointer-transparent except at narrow documented edge triggers
  and currently visible owned surfaces;
- trigger thickness is measured and bounded;
- deterministic corner arbitration prevents ambiguous overlapping pointer
  targets;
- feature modules use the shared #31 controller rather than private timers or
  CSS classes;
- focus cannot remain inside a hidden, failed, or disposed surface;
- a focused surface stays open until focus leaves or an explicit close action;
- `Escape` respects higher-priority native/project popup handling;
- native modal/window-modal state suspends all custom edge interaction;
- DOM fullscreen and customize mode follow explicit suspension policies;
- OS window controls remain outside project ownership;
- failure in a required host/controller/feature prevents or clears active mode;
- disposal clears all holds, timers, observers, delegated listeners, roots, and
  focus-origin records.

The right and bottom placeholders are not feature-complete. The top navigation
surface is complete for #12 but does not replace the pending address, bookmarks,
or Downloads features required before #15.

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
- fixed bounded DOM path selected by source code.

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
- extension data not required by a fixed project diagnostic.

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

## 7. User-derived frontend data

### 7.1 Tabs — implemented

The tabs bridge/application/UI may expose:

- opaque context-bound tab ID;
- bounded title text;
- selected, pinned, loading booleans;
- optional bounded allowlisted favicon value.

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
- stale/foreign/disposed IDs fail before native access.

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
- action state is re-resolved against the current selected browser immediately
  before invocation;
- background and non-top-level progress cannot update selected navigation
  state;
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
- no certificate material, permission record, exception principal, or native
  handler state crosses into Svelte;
- the popup summarizes connection/protection state but does not replace
  Firefox's authoritative identity or protections panels. Permissions/page-
  action expansion is separately reviewed in #37.

The fifth address-overlay root remains inside the project frame. Popup activity
suppresses the four edge surfaces, and disposal clears its draft, focus history,
subscribers, listeners, and root before host removal.

### 7.3 Bookmarks — pending #14

Before implementation:

- use bounded/lazy roots and child queries;
- keep Places records, GUIDs/IDs, URLs, observers, services, and principals
  private;
- prefer opaque-ID open actions so a bookmark URL need not enter Svelte state;
- bound title length, item count, page size, and recursion depth;
- render titles as text;
- do not support bookmarklets/executable URLs without a separate security issue;
- do not add remote favicons/metadata;
- do not mirror an unbounded tree;
- do not log or persist bookmark contents;
- preserve native Library, dialogs, `Ctrl+D`, and management paths.

### 7.4 Downloads — pending #32

Before implementation:

- keep download objects, lists/views, paths, sources, principals, and services
  private;
- expose only bounded immutable progress/status snapshots;
- define known/unknown-size aggregate semantics;
- sanitize or omit display names;
- never expose full paths or source URLs;
- do not log filenames or named byte counts;
- use event/view subscriptions rather than idle polling;
- do not automatically reveal the panel on activity;
- do not add open, execute, reveal-in-folder, retry, pause, cancel, delete, or
  other file actions in the MVP;
- preserve native reputation, malware, permission, confirmation, notification,
  file-picker, and management UI.

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

The current installed profile inventory is the exact eleven-file
`expectedFiles` list in `package-manifest.json`.

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

Issue #12 adds no dependency or installed debug artifact. Its generated bridge,
application, UI, and CSS changes remain subject to deterministic double-build,
exact-inventory, and production-network/debug scans.

## 11. Installation and file-system safety

Install, update, disable, enable, and uninstall must:

- require explicit Firefox program and profile targets;
- resolve and validate canonical paths;
- require marker/ownership evidence;
- reject root, home, broad, registered-profile, reparse-point, traversal, and
  ambiguous targets;
- show a redacted dry run before mutation;
- write only project-owned paths;
- stage and hash new files before replacement;
- back up owned files;
- use a recovery journal;
- roll back caught partial failure;
- block later actions after interrupted transaction until recovery;
- remove only ownership-proven files/directories;
- never silently choose a default or daily-use profile;
- leave unrelated profile content untouched.

The current implementation is in `scripts/fennevia-package.ps1` and
`scripts/lib/FenneviaInstaller.psm1`. Operator behavior and recovery are in
`docs/installation.md`.

The development-profile helper follows the same principles and manages only its
marker-owned `%LOCALAPPDATA%\fennevia\profiles\...` root.

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
  notifications, prompts, and OS controls are not hidden, moved, resized, or
  owned by Svelte.

Issue #12's top surface invokes retained Firefox commands. The native navbar,
Urlbar, identity/permission UI, prompts, and security indicators remain visible
and authoritative; Fennevia's bounded location text is not a security indicator.

Issue #15 must build a current native-UI coverage inventory and hide only the
narrowest surfaces with complete replacement and retained access. Missing
coverage blocks activation.

## 13. Private windows

Private-window behavior is feature-specific: fully validated support or complete
native fallback.

Global rules:

- no browsing-derived persistence;
- no private URL/title/query/bookmark/download data in diagnostics;
- no process-global copy of private feature state;
- no cross-window native handle;
- no profile preference reflecting private activity;
- exact per-window cleanup on close/fallback/disposal;
- uncertainty means complete native fallback.

Implemented:

- base lifecycle, health, frame, edge controller, tabs bridge, vertical tab UI,
  navigation/address bridge, compact launcher, centered popup, and top controls
  have isolated normal, second-normal, and private instances;
- opaque IDs include context/registry generation;
- controllers, roots, holds, timers, listeners, mappings, and state are removed
  per window;
- one window's emergency fallback does not mutate another.

Pending:

- #14 bookmarks;
- #32 Downloads.

Each pending feature must prove its own isolation before enabling in private
windows.

Issues #12 and #13 give each window its own navigation controller, selected
snapshot, navigation and popup subscriber sets, popup controller/draft, two tab
listeners, one tabs progress listener, one command observer, application
adapter, five roots, and text output. Title, display URI, address text, and draft
may describe private browsing, so they are never process-global, persisted,
logged, placed in datasets/errors, or copied to another window. Background and
non-top-level progress is ignored. Frontend unmount, emergency fallback, window
close, runtime stop, capability failure, and startup rollback remove all
listeners/observers/subscribers and release the snapshot/draft with that
window.
Normal, second, and private-window isolation passed in real Firefox. Full
evidence is in `docs/research/firefox-153-navigation-controls.md`.

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

Issue #18 owns the project license and third-party attribution policy. Public
visibility is not permission to reuse code.

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
- custom titlebar or OS window controls.

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
