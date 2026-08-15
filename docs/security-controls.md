# Operational Security Controls

This document turns `docs/security-and-privacy.md` into current review records,
required evidence, and testable gates. It is a project security baseline, not a
formal audit or penetration test.

## 1. Control status vocabulary

- **implemented:** code and repository tests exist.
- **validated:** implementation has recorded real Firefox evidence on the stated
  build/platform.
- **active policy:** required for every current issue and review.
- **implementation gate:** the named issue must supply code and evidence before
  a later phase may depend on it.
- **deferred:** intentionally outside the current MVP; no implementation may
  claim coverage.
- **prohibited:** requires a new issue and architecture/security decision before
  implementation.

Current validated baseline:

- package `0.8.0-dev`;
- Firefox 153.0.4 release, Windows;
- copied Firefox program plus marker-owned development profile;
- native Firefox visible UI retained;
- functional left-edge vertical tabs and compact address/status launcher,
  centered address/search popup, top-edge navigation controls, and right-edge
  bookmarks;
- four-edge frame/reveal/design foundation complete;
- Downloads, fuller Urlbar permissions/page-action coverage, and active native
  hiding pending.

## 2. Threat model and ownership

| Asset or trust boundary | Threat and consequence | Current control | Missing evidence or next gate | Owner |
| --- | --- | --- | --- | --- |
| AutoConfig and process bootstrap | Malformed/replaced/duplicated privileged code can execute arbitrarily or break startup | Minimal fixed entry, process guards, safe start before registration/import, privacy-safe fatal boundary, no discovery/dynamic loader | Repeat after Firefox/bootstrap changes | #3, #16 |
| Chrome Registry manifest | Broad mapping or override can expose files or miss upstream security fixes | Dedicated `content fennevia` package, no `contentaccessible=yes`, no active `resource` alias, no override, ordinary-content denial test | Dedicated review before any new mapping/directive | #3; ADR-016 |
| Generated privileged artifacts | HMR, endpoints, source maps, dynamic imports, extra chunks, or binaries can create remote execution/non-determinism | Exact eleven-file inventory, deterministic double builds, hash synchronization, scanner, Windows CI | Repeat after every build/tooling change | #8, #9, #16 |
| npm/build supply chain | Compromised package, lifecycle script, or native binary can compromise developer host/artifacts | Exact dev dependencies, lockfile v3, install scripts disabled, resolved graph/native binary/license review, audit | Repeat complete dependency record on upgrades | #8, #16 |
| Browser windows and lifecycle | Duplicate/late callbacks or retained native windows can cross contexts and leak state | One process runtime, strict browser filtering, abort-first per-window cleanup, idempotent stop; #12 removes tab/progress/command/application listeners and observers per window | Repeat lifecycle/leak matrix for later features | #5, #12, #16 |
| Four-edge frame and triggers | Broad overlays can block web content, prompts, or OS controls; stuck holds can trap focus | Zero-layout project frame, narrow triggers, pointer-transparent resting center, deterministic corners, modal/DOM-fullscreen/customize suspension, tracked holds/timers, reverse cleanup; the nonmodal #13 popup suppresses edges only while active | Revalidate after geometry/controller changes and before #15 | #31, #13, #15, #16 |
| Svelte/native DOM boundary | Framework may reconcile Firefox-owned children or leak styles | Four edge roots plus one address-overlay root, all project-owned XHTML; frame-scoped CSS, Browser Toolbox ownership walk, native computed-style comparison | Revalidate after root/style changes | #8, #13, #31 |
| Firefox native handles | Native tab/browser/controller/service may enter reactive state or survive disposal | Enforced `src/firefox/` boundary, context-scoped opaque registries, typed stale/foreign failures, idempotent disposal, lint rules; #12/#13 keep selected browser, Urlbar, commands, identity/protections handlers, allow-list, and progress private; #14 keeps Places records, GUIDs, URLs, observers, and node-like values private | Apply the same contract to Downloads | #9, #10, #12, #13, #14, #32 |
| Tab title/favicon data | Page-controlled strings/images can inject HTML/CSS, spoof UI, or leak | Bounded text-only titles, `dir=auto`, reviewed favicon allowlist, property-only `img.src`, static fallback, no referrer, no datasets/logging | Continue hostile-data tests after tab UI changes | #10, #11 |
| Navigation status and address input | Page-controlled location or input can spoof UI, bypass Firefox fixup/principal/security behavior, or leak to logs | #12/#13 expose bounded text-only title/location/draft, fixed Firefox-derived connection/protection enums, and explicit current-window actions; submission delegates to `gURLBar.handleCommand()`, executable schemes are rejected, drafts are per-window/ephemeral, uncontrolled load helpers and inferred security state remain prohibited | Revalidate Urlbar/identity/protections internals on Firefox updates; #37 owns fuller permissions/page-action coverage | #12, #13, #37 |
| Bookmark data and opening | Large/user-controlled tree can become unbounded UI state; unsafe opening can bypass principal/scheme behavior | #14 uses 32-item replaceable pages, depth/expansion caps, per-window opaque IDs and observers, text-only 160-code-point titles, no URL in Svelte/DOM/logs, blocked executable/data/place schemes, and native `PlacesUIUtils` opening/private policy | Revalidate exact Places and opening internals on Firefox updates | #14, #16; ADR-029 |
| Download data and file actions | Paths/source URLs/private state can leak; unsafe actions can execute files | Bounded status-only contract, no file actions, no forced reveal, native safety retained by policy | Implement current Downloads view/bridge and privacy matrix | #32 |
| Normal diagnostics | URLs, titles, queries, bookmarks, downloads, paths, secrets, or private data can leak | Default-deny schemas, stable codes, redacted stacks, no network sink, hostile-value tests; #12/#13/#14 errors contain fixed phase/code/symbol/build/window-kind only and never address/status/bookmark source data | Extend fixed adapters to Downloads and later features | #3, #5, #9–#14, #32 |
| Private-window state | State can leak to normal windows, process globals, preferences, or diagnostics | Per-window lifecycle/frame/tabs/navigation/popup/bookmark instances, opaque generations, bounded unpersisted state, complete fallback on uncertainty; #12/#13/#14 passed normal/second/private isolation and disposal | Validate Downloads and each later bridge independently | #5, #9–#14, #31, #32 |
| Native security UI | Custom surfaces/native hiding can obscure permission/auth/certificate/extension/download-safety/dialog UI | Native UI retained; #13 badges/details summarize only fixed current Firefox state and do not replace identity/protections panels; four edges and popup suspend for modal state; emergency fallback; #15 coverage inventory required | Complete #37 plus full prompt/retained-access/stacking matrix before activation | #7, #13, #31, #37, #15 |
| Installer/updater/uninstaller | Ambiguous/broad/reparse targets can overwrite/delete unrelated Firefox/profile data | Explicit canonical targets, marker checks, dry run, dual ownership manifests, staging, hashes, journal, rollback, exact deletion | Revalidate for every platform/scope change | #4, #16 |
| Startup cache/stale installed code | Removed or fixed privileged code may continue to run | Exact inventory and evidence-first cache policy; validated changes took effect without routine clearing | Cache action only after observed stale symptom | #3, #4, #16 |
| External implementation/design | Unlicensed or copied code/design can create legal and maintenance risk | License/provenance requirement; `my-firefox-custom` no-copy boundary; exact reference commit required | Owner license/attribution decision | #18 |
| Runtime network/update/telemetry | Remote party can change privileged behavior or receive browsing data | Prohibited; scanner detects common endpoints/APIs | New issue + ADR + security review for any exception | ADR-012 |
| Native UI hiding | Broad selectors can remove uncovered actions or leave no recovery | Production does not enter active; #15 narrow coverage inventory and reversible gate required | Complete #32/#37 and full failure/recovery matrix | #15 |

Every unresolved high-risk row has an owner. An unimplemented control is a
blocker, not an implicit risk acceptance.

## 3. Production artifact gate

### 3.1 Current inventory

`package-manifest.json` is the only source of truth. Package `0.8.0-dev`
contains the following profile paths:

```text
chrome.manifest
content/Bootstrap.sys.mjs
content/firefox/BridgeBoundary.sys.mjs
content/runtime/HealthState.sys.mjs
content/runtime/Logger.sys.mjs
content/runtime/Runtime.sys.mjs
content/runtime/WindowManager.sys.mjs
content/runtime/WindowShell.sys.mjs
content/shell/ShellApp.js
content/shell/ShellStyles.sys.mjs
content/shell/THIRD_PARTY_NOTICES.txt
```

Every path has a committed SHA-256. Globs are prohibited because they cannot
detect an unexpected chunk. No new Chrome Registry declaration accompanies the
three generated shell files or generated private bridge ESM; the frontend and
bridge builds are reproduced byte-for-byte twice and pass the same
exact-inventory scanner.

Run:

```powershell
pwsh -NoProfile -File .\scripts\check-production-artifacts.ps1 `
  -ArtifactRoot .\profile\chrome\fennevia `
  -InventoryPath .\package-manifest.json
```

Exit codes:

- `0`: pass;
- `1`: security finding;
- `2`: invalid input or policy.

Output contains only stable rule ID, artifact-relative path, and line number.
It does not echo matched sensitive text or the absolute artifact root.

### 3.2 Required detections

The scanner must reject:

- missing or extra inventory files;
- unsafe/non-normalized/non-ASCII artifact paths;
- symlinks and junctions;
- `http`, `https`, `ws`, `wss`, protocol-relative, localhost, and loopback
  endpoint literals except exact reviewed standards namespace constants;
- `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, and
  `importScripts`;
- HMR/dev-server/bundler runtime markers;
- bare imports and dynamic `import()`;
- source-map files/references;
- development source, tests, coverage, TypeScript, or Svelte files;
- `eval`, `new Function`, and executable binaries;
- unscannably large/unreadable text;
- unplanned runtime chunks;
- production failure/debug selectors.

The scanner has no bypass flag. A legitimate exception requires an explicit
policy and code review, not an ignored warning.

### 3.3 Build reproducibility

`npm run build` must:

1. build the frontend twice in isolated directories;
2. compare exact output bytes;
3. build the Firefox bridge twice;
4. compare exact output bytes;
5. replace only owned generated directories;
6. synchronize package hashes;
7. leave no unexplained dirty generated/manifest state.

No generated artifact is hand-edited.

## 4. Dependency gate

Every addition or upgrade requires
`docs/dependency-review-template.md`.

Record:

- exact version and purpose;
- license and provenance;
- maintainers and release activity;
- transitive graph;
- lifecycle scripts;
- install/build/runtime network behavior;
- native/platform binaries;
- optional dependencies;
- code generation;
- command-line entry points;
- bundle inclusion;
- vulnerability audit;
- removal cost.

Installation remains:

```powershell
npm ci --ignore-scripts --no-fund
npm run dependencies:audit
```

A registry metadata check alone is insufficient. Inspect the resolved lock
graph and installed files.

Current toolchain decision:

- exact dev dependencies;
- project `ignore-scripts=true`;
- optional macOS `fsevents` not installed on Windows;
- build-host `.node` binaries remain outside the Firefox package;
- no component library/Tailwind/remote font/runtime SDK.

## 5. Privacy-safe logging contract

### 5.1 Default-deny fields

Normal records may include only:

| Field | Rule |
| --- | --- |
| `prefix` | One of the fixed Fennevia component prefixes |
| `level` | Stable severity |
| `event`, `phase`, `code` | Fixed project values |
| `projectCommit`, `projectVersion` | Build metadata |
| `firefoxVersion`, `buildId`, `channel` | Firefox metadata |
| `windowKind` | `normal`, `private`, or `unsupported` classification only |
| `capability`, `available`, `firefoxSymbol` | Fixed allowlisted symbol/name and boolean |
| `projectUri` | Fixed source-defined `chrome://fennevia/` URI only |
| `domPath` | Fixed short allowlisted selector/path only |
| `edge`, `edgeState`, `holdReason` | Fixed enums only |
| `errorName` | Class name without untrusted message |
| `stack` | Redacted line-preserving frames |
| `opaqueId` | Process-local random ID with no durable mapping |
| counts/booleans | Aggregate non-browsing state only |

No spread/generic serializer may copy an arbitrary context, exception, native
object, application snapshot, or event into a record.

### 5.2 Prohibited values

Never log or include in ordinary shared evidence:

- complete URL/origin/query/fragment/address input;
- page/tab title or favicon value;
- history;
- bookmark/folder title, URL, tree contents, or user-data Places identifier;
- download filename, source/referrer URL, target path, private marker, or named
  byte count;
- form values;
- cookie, token, header, principal, certificate, session state;
- user name, program/profile/local/UNC path, or file URL;
- native window/tab/browser/controller/service/query/view/event object;
- private-window browsing state;
- unrelated extension data.

### 5.3 Stack/error handling

1. Select a stable project code and constant safe summary.
2. Preserve error class.
3. Ignore upstream error message in normal output.
4. Retain stack lines after replacing sensitive URI/path/query/user portions.
5. Permit only reviewed fixed project/Firefox source locations.
6. Fall back to code-only output when redaction fails.
7. Keep opt-in detailed diagnostics local, temporary, and disconnected from any
   network sink.

Example:

```text
[Fennevia bridge] {"level":"error","event":"bridge.failure","phase":"tabs-capability","code":"FENNEVIA_TABS_CAPABILITY_MISSING","firefoxVersion":"153.0.4","buildId":"20260810162159","windowKind":"normal","firefoxSymbol":"window.gBrowser.openTabs","errorName":"TypeError","stack":["TypeError: <REDACTED_MESSAGE>","at chrome://fennevia/content/firefox/BridgeBoundary.sys.mjs:1:1"]}
```

## 6. Chrome/resource exposure review

Current manifest state:

```text
content fennevia content/
```

Controls:

- no `contentaccessible=yes`;
- no active `resource://fennevia/` directive;
- no `override`;
- no source maps/debug/private/user data;
- ordinary content cannot fetch privileged project entry in validated evidence.

Before any new directive, record:

| Question | Required evidence |
| --- | --- |
| What exact consumer needs the mapping? | Source/issue reference |
| Which exact files become reachable? | Closed inventory; no globs |
| Who can resolve/fetch them? | Current Firefox source and ordinary-content test |
| Can the mapping expose source, diagnostics, secrets, or user data? | Negative review |
| Can a narrower fixed import work? | Alternatives analysis |
| How is removal tested? | Cold-start/content-context removal test |
| Does it use `contentaccessible=yes` or `override`? | Dedicated issue, ADR, security review |

`resource://fennevia/` remains reserved but absent until a real consumer and
review exist.

## 7. Bridge and user-data controls

### 7.1 Shared bridge

Every bridge must:

- be scoped to one validated browser-window context;
- validate required/optional capabilities;
- retain native handles privately;
- expose frozen/bounded ordinary data;
- use context-bound opaque IDs;
- reject malformed, stale, foreign, and disposed IDs before native access;
- use event/view/observer subscriptions rather than idle polling;
- return idempotent disposers;
- stop callbacks after disposal;
- fail open on missing required capability;
- log only fixed symbolic context.

### 7.2 Tabs — implemented and validated

Required controls:

- title maximum and text-only rendering;
- no `{@html}`;
- favicon reviewed allowlist;
- property-only `img.src`;
- static fallback and load-error removal;
- no CSS URL interpolation;
- no arbitrary URL accepted by new-tab action;
- native action options remain private/mutable where Firefox requires them;
- public snapshots remain immutable;
- no tab data in logs/datasets/persistence.

### 7.3 Navigation — implemented; address — #13 gate

Implemented navigation controls:

- current source for selected-browser handoff, progress, command elements, and
  `BrowserCommands`;
- bounded text-only title/display URI;
- no uncontrolled URL argument or `loadURI` action;
- fresh current-window action resolution;
- selected/top-level event filtering;
- no browsing data in logs, datasets, persistence, or network output;
- private-window isolation and complete cleanup;
- required-capability fail-open recovery.

Before enabling address input:

- current source for fixup, search, principal, disposition, and `Ctrl+L`;
- bounded draft values independent from committed navigation status;
- no uncontrolled `loadURI`;
- explicit dangerous/special scheme policy;
- no input persistence or logging;
- active-edit protection from background navigation;
- healthy-only custom command ownership;
- native fallback in inactive/failed/safe-start/unsupported/disposed states;
- hostile input tests;
- private-window isolation;
- complete cleanup.

### 7.4 Bookmarks — #14 validated gate

Implemented and validated on Firefox 153.0.4:

- current source for Places roots/query/observer/open behavior;
- bounded/lazy query and depth/page limits;
- opaque IDs;
- URL remains private when possible;
- text-only title;
- no bookmarklet execution;
- no remote favicon/metadata;
- live update reconciliation;
- no unbounded mirror/polling;
- native management paths retained;
- private-window policy;
- observer/query cleanup;
- no bookmark data in logs/persistence.

Exact bounds are 32 items per page, depth 8, 20 expanded folders, 160 title
code points, observer batches of 128, and affected-parent batches of 16. The
normal/second/private lifecycle, hidden/open native changes, current/new-tab
opening, hostile titles, stale/foreign handles, exact observer cleanup,
missing-bookmarks capability fail-open, frontend recovery, and Browser Toolbox
ownership matrix passed. Evidence: ADR-029 and
`docs/research/firefox-153-bookmarks-surface.md`.

### 7.5 Downloads — #32 gate

Before enabling:

- current source for Downloads list/view/subscription/private behavior;
- bounded item count and strings;
- known/unknown aggregate definition;
- native objects/paths/source URLs remain private;
- no file actions;
- no forced panel reveal;
- native safety/reputation/notification/management retained;
- event/view updates;
- private-window isolation;
- native view/listener cleanup;
- no download data in logs/persistence.

## 8. Four-edge UI controls

The #31 contract is mandatory.

### 8.1 Trigger and layout

- narrow bounded trigger thickness;
- pointer-transparent center;
- no permanent content margin/padding;
- one frame only;
- four exact hosts only;
- feature descendants remain inside owning host;
- no native node reparenting;
- no feature-owned z-index or trigger.

### 8.2 Reveal/hold state

Allow only fixed:

- pointer;
- keyboard;
- focus;
- popup;
- bounded programmatic;
- suspended;
- disposed.

Each hold has explicit acquire/release ownership. Timers are tracked and cleared
on replacement/disposal. Exceptions enter fail-open cleanup.

### 8.3 Focus/accessibility

- keyboard/focus path for every edge;
- meaningful landmark/name;
- visible focus;
- no hidden focused descendant;
- predictable focus restoration;
- `Escape` priority;
- forced-colors support;
- reduced-motion support;
- near-solid fallback.

### 8.4 Collision and suspension

- deterministic corner ownership;
- tested adjacent edge travel;
- documented simultaneous holds;
- no unreachable controls;
- native modal/window-modal suspension;
- DOM fullscreen suspension;
- customize-mode suspension;
- explicit browser-fullscreen behavior;
- OS controls untouched.

## 9. Native security UI and #15 activation gate

Native Firefox continues to own:

- permission/authentication/certificate/identity UI;
- extension-install UI;
- download safety/reputation;
- file pickers;
- notification boxes;
- find bar;
- modal/window-modal dialogs;
- app/extension/Library/Downloads access without a completed replacement;
- DevTools/Browser Toolbox;
- titlebar and OS window controls.

Before `active` can hide any native surface, #15 must provide a coverage
inventory:

| Field | Required |
| --- | --- |
| Native selector/capability | Exact current value |
| Firefox owner/source | Path/revision/build |
| User-visible purpose | Complete |
| Fennevia replacement | Completed issue |
| Retained native access path | Command/menu/fallback |
| Failure behavior | Immediate native restoration |
| Mode policy | fullscreen/DOM fullscreen/customize/modal |
| Tests | normal/second/private plus failure matrix |

Rules:

- hide the narrowest possible surface;
- never hide a broad parent with uncovered descendants;
- every selector is gated by per-window `data-fennevia-active`;
- missing/invalid activation CSS prevents activation;
- clearing active restores native UI without restart/Svelte;
- unsupported mode suspends/clears active;
- no core native DOM is removed or reparented;
- no feature implementation is smuggled into #15 to bypass blockers.

## 10. Private-window controls

Each feature records:

- data read;
- ordinary snapshot fields;
- persistence;
- process/global state;
- cross-window identifiers;
- disposal;
- normal/private tests;
- fallback decision.

Allowed persistence is limited to schema-defined shell preferences independent
of browsing activity.

Prohibited persistence:

- tabs/titles/favicons;
- address/query/location;
- bookmark selection/tree/contents;
- download state;
- feature usage that reveals private activity.

If isolation, disposal, or semantics are uncertain, use complete native
fallback.

## 11. Installer and profile controls

Required preflight:

- explicit program/profile paths;
- canonicalization;
- expected Firefox program identity;
- marker-owned unregistered profile;
- no root/home/profile-parent/program-root target;
- no traversal/reparse ambiguity;
- permissions;
- ownership/collision/hash verification;
- all processes closed where required;
- redacted plan digest.

Mutation controls:

- same-volume staging;
- exact hashes;
- backups only for owned files;
- relative-path recovery journal;
- rollback on caught failure;
- interrupted transaction blocks later actions;
- no recursive deletion without ownership proof;
- no unrelated profile enumeration/logging;
- dry run changes nothing.

Recovery:

- `Disable` must work with a broken/missing runtime;
- `Uninstall` removes only owned files/metadata;
- repeat action is idempotent;
- stock cold start has no project record/error;
- startup-cache action remains evidence-driven.

## 12. External code and provenance gate

Before direct reuse:

- source repository and exact commit;
- file path;
- license and file-level notice;
- copied/adapted/generated classification;
- modifications;
- required attribution;
- compatibility/security review;
- removal/update strategy.

`my-firefox-custom` restrictions:

- capability/broad visual reference only;
- no `.uc.js` implementation;
- no event/timer/global structure;
- no selectors/IDs/classes/token names;
- no numeric values;
- no native-DOM mutation/reparenting;
- no loader assumptions;
- no module layout;
- no pixel/component-for-component visual copy.

Every design-reference implementation record states the exact consulted commit,
concepts retained, independent Fennevia decisions, and no-copy confirmation.

Issue #18 must be resolved before public distribution, substantial external
contributions under unclear terms, or copying reusable implementation code.

## 13. Security review triggers

| Trigger | Minimum required record |
| --- | --- |
| Runtime network/update/telemetry | Threat model, endpoint/data inventory, consent, failure/offline behavior, new ADR |
| Dynamic code generation | Necessity, alternatives, input boundary, CSP/privilege review, tests |
| Privileged runtime dependency | Complete dependency review and artifact/runtime effect |
| Content-accessible resource | Exact files, consumers, current-source/content-context tests |
| Chrome Registry override | Upstream pin/diff workflow/security/update/removal tests |
| New persistence | Schema, privacy classification, private-window behavior, cleanup |
| Untrusted HTML/CSS | Sanitization boundary and hostile input tests |
| Arbitrary scheme/URL load | Firefox principal/fixup/content-policy research and tests |
| File open/execute/delete action | OS/Firefox safety semantics, user intent, path policy |
| Native security UI replacement | Dedicated threat model, spoofing/fallback/accessibility tests |
| Native visible parent hiding | Complete coverage inventory and retained paths |
| Installer deletion-scope change | Canonical path/ownership/rollback/adversarial tests |
| Custom titlebar/window controls | Platform-specific source/UX/security/recovery matrix |

A normal PR checkbox does not waive a triggered review.

## 14. Required verification commands

Static/build baseline:

```powershell
npm ci --ignore-scripts --no-fund
npm run dependencies:audit
npm run verify

pwsh -NoProfile -File .\tests\production-artifacts.Tests.ps1
pwsh -NoProfile -File .\tests\installer.Tests.ps1
pwsh -NoProfile -File .\scripts\check-production-artifacts.ps1 `
  -ArtifactRoot .\profile\chrome\fennevia `
  -InventoryPath .\package-manifest.json
```

Real Firefox baseline, where applicable:

```powershell
node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>'

node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>' `
  --browser-toolbox
```

Use the feature-specific recovery wrapper documented in
`docs/testing-and-recovery.md`. Every owned mutation wrapper restores exact bytes
and verifies hashes in `finally`.

## 15. Evidence and maintenance

Current detailed evidence:

- bootstrap: `docs/research/firefox-153-bootstrap.md`;
- installer: `docs/research/fennevia-installer-validation.md`;
- lifecycle: `docs/research/firefox-153-window-lifecycle.md`;
- initial hosts: `docs/research/firefox-153-shell-hosts.md`;
- health/recovery: `docs/research/firefox-153-shell-health-recovery.md`;
- frontend: `docs/research/firefox-153-svelte-build.md`;
- boundary: `docs/research/firefox-153-bridge-boundary.md`;
- tabs bridge: `docs/research/firefox-153-tabs-bridge.md`;
- tab UI: `docs/research/firefox-153-tab-strip.md`;
- four-edge frame: `docs/research/firefox-153-four-edge-shell.md`;
- top navigation: `docs/research/firefox-153-navigation-controls.md`.

After every completed milestone:

1. update issue #1;
2. update README current status;
3. update master plan/roadmap;
4. update this threat model/control owner;
5. update testing/recovery;
6. update security/privacy for new data flows;
7. update internals map and ADRs;
8. preserve historical research evidence;
9. record remaining blockers honestly.
