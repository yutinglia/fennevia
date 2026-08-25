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

- public package `0.16.0-beta.1` prerelease;
- Firefox 153.0.4 BuildID 20260810162159 and 154.0 BuildID 20260812182057,
  Windows x64; later majors may install after an explicit no-promise warning;
- copied Firefox program plus marker-owned development profile;
- native Firefox DOM and complete transient access retained;
- functional vertical tabs/compact address launcher and bookmarks on a bounded
  owner-configurable side-role pair (tabs left/bookmarks right by default),
  centered address/search popup, fixed top-edge navigation controls, optional
  bottom-edge anonymous download status, and detailed Urlbar
  permission/action coverage with native handoff;
- four-edge frame/reveal/design foundation complete;
- exact health-gated content-only activation complete;
- fixed-list PowerShell gates, narrow one-sided ownership repair, and test-only
  aggregate resource baseline complete.

ADR-037's single-line toolbar and fixed browser-tool handoffs, plus ADR-042's
host-anchored popup placement, are implemented with focused automated evidence.
ADR-056's generic hidden-toolbox popup proxy and ADR-057's security-notification
exception plus translations widget are also implemented with focused automated
evidence. ADR-058's tab indicators, ADR-059's single in-launcher Trust shield,
and ADR-060's fixed packaged shell icons have complete automated evidence. The
owner-observed Firefox 154 AMO path currently uses the accepted
complete-native-chrome fallback. The remaining changed real-Firefox visual,
popup/prompt placement, caption, drag, second/private, and fallback matrix
remains pending.

## 2. Threat model and ownership

| Asset or trust boundary              | Threat and consequence                                                                                                                           | Current control                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Missing evidence or next gate                                                                                                                                                                                                              | Owner                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| AutoConfig and process bootstrap     | Malformed/replaced/duplicated privileged code can execute arbitrarily or break startup                                                           | Minimal fixed entry, process guards, safe start before registration/import, privacy-safe fatal boundary, no discovery/dynamic loader                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Repeat after Firefox/bootstrap changes                                                                                                                                                                                                     | #3, #16                                                                               |
| Chrome Registry manifest             | Broad mapping or override can expose files or miss upstream security fixes                                                                       | Dedicated `content fennevia` package, no `contentaccessible=yes`, no active `resource` alias, no override, no manifest `style` overlay, ordinary-content denial test                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Dedicated review before any new mapping/directive                                                                                                                                                                                          | #3; ADR-016                                                                           |
| Generated privileged artifacts       | HMR, endpoints, source maps, dynamic imports, extra chunks, or binaries can create remote execution/non-determinism                              | Closed manifest-derived profile inventory, deterministic double builds, hash synchronization, scanner, Windows CI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Repeat after every build/tooling change                                                                                                                                                                                                    | #8, #9, #15, #16                                                                      |
| npm/build supply chain               | Compromised package, lifecycle script, or native binary can compromise developer host/artifacts                                                  | Exact dev dependencies, lockfile v3, install scripts disabled, resolved graph/native binary/license review, audit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Repeat complete dependency record on upgrades                                                                                                                                                                                              | #8, #16                                                                               |
| Browser windows and lifecycle        | Duplicate/late callbacks or retained native windows can cross contexts and leak state                                                            | One process runtime, strict browser filtering, abort-first per-window cleanup, idempotent stop; #12 removes tab/progress/command/application listeners and observers per window                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Repeat lifecycle/leak matrix for later features                                                                                                                                                                                            | #5, #12, #16                                                                          |
| Four-edge frame and triggers         | Broad overlays can block web content, prompts, or OS controls; stuck holds can trap focus                                                        | Zero-layout project frame, narrow triggers, pointer-transparent resting center, deterministic corners, modal/DOM-fullscreen/customize suspension, tracked holds/timers, reverse cleanup; the nonmodal #13 popup and ADR-055's bounded per-edge context menus reuse existing popup holds only while active                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Revalidate context-menu placement/keyboard/hold cleanup in real Firefox, then repeat after geometry/controller changes                                                                                                                     | #31, #13, #15, #16; ADR-055                                                           |
| Svelte/native DOM boundary           | Framework may reconcile Firefox-owned children or leak styles                                                                                    | Four edge roots plus one address-overlay root; hosts/structural nodes and ADR-060 packaged-resource mask spans are project-owned XHTML, while SVG is allowed only below reviewed `svg[data-fennevia-icon]` exception roots; frame-scoped CSS, Browser Toolbox ownership walk, native computed-style comparison                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Run the pending real Browser Toolbox namespace walk after ADR-060, then revalidate after root/style changes                                                                                                                                | #8, #13, #31; ADR-037, ADR-060                                                        |
| Firefox native handles               | Native tab/browser/controller/service may enter reactive state or survive disposal                                                               | Enforced `src/firefox/` boundary, context-scoped opaque registries, typed stale/foreign failures, idempotent disposal, lint rules; #12/#13 keep selected browser, Urlbar, commands, identity/protections handlers, allow-list, and progress private; #37 and ADR-057 expose only fixed browser-tool booleans/actions plus a transient event/host and privacy-safe popup hold while keeping anchors, handlers, panels, widget/extension/download/translation/security details, and window private; #14 keeps Places records, GUIDs, URLs, observers, node-like values, `PlacesCommandHook`, and Library windows private; #32 keeps Downloads objects, lists/views, paths, sources, bytes, and errors private; #60 keeps native tabs, `#tabContextMenu`, translation owner, NativeUi token, and `ContextualIdentityService` private; ADR-063's owner-approved exception permits exactly one ephemeral native tab in a privileged same-kind drag coordinator, never in `DataTransfer`, Svelte, another window's reactive state, logs, or persistence                                                                                     | Revalidate each exact boundary on Firefox updates; run ADR-042/ADR-055/ADR-057's pending real native-panel placement matrix plus ADR-063's multi-window/content/external-drop matrix                                                       | #9, #10, #12–#14, #32, #37, #60; ADR-037, ADR-041, ADR-042, ADR-055, ADR-057, ADR-063 |
| Tab title/favicon and activity state | Page-controlled strings/images can inject HTML/CSS or leak; capture state can expose sensitive browsing activity                                 | Bounded text-only titles, `dir=auto`, reviewed favicon allowlist, property-only `img.src`, static fallback, no referrer or value logging; #60 adds bounded container labels and closed audio/attention/PiP state; ADR-058 adds only `camera`/`microphone`/`screen` plus crash and keeps WebRTC/device/origin details privileged; ADR-060 renders fixed installed Firefox status resources without adding state or mutation actions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Continue hostile-data tests and run the pending real capture/crash/icon visual matrix after tab UI changes                                                                                                                                 | #10, #11, #60; ADR-058, ADR-060                                                       |
| Packaged Firefox icon resources      | A user-derived or drifted privileged URI could load the wrong resource, leak values, or create a network/content boundary                        | ADR-060 uses one closed TypeScript token map of fixed installed `chrome://` / `resource://` paths, inline per-element masks, `currentColor`, decorative `aria-hidden` spans, no arbitrary URL prop, no copied bytes, no shared CSS URL, and no network/discovery fallback; dynamic favicons/extensions and caption/generic exceptions remain separately bounded                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Revalidate every fixed path and the 153/154 Send Tab version branch, then run the pending real theme/reduced-motion/forced-color/DPI/fail-open matrix                                                                                      | ADR-046, ADR-059, ADR-060                                                             |
| Navigation status and address input  | Page-controlled location or input can spoof UI, bypass Firefox fixup/principal/security behavior, or leak to logs                                | #12/#13 expose bounded text-only title/location/draft, fixed Firefox-derived connection/protection enums, and explicit current-window actions; ADR-059 combines only those enums behind one semantic leading Trust shield and fixed installed Firefox masks, without native classes/nodes or URL inference; submission delegates to `gURLBar.handleCommand()`, executable schemes are rejected, and drafts are per-window/ephemeral                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Revalidate Urlbar/identity/protections/icon-resource internals and run ADR-059's pending real state/visual matrix on Firefox updates                                                                                                       | #12, #13; ADR-059                                                                     |
| Urlbar permission/action coverage    | Cloning panels or exposing principals, permission records, extension identity, provider results, or action IDs can leak or bypass Firefox policy | #37 reads only fixed owner attributes/children, exposes fixed enums/booleans, collapses dynamic actions generically, modifies no native DOM, and delegates complete access to `window.openLocation()`; #15 reveals synchronously before handoff and holds native focus/popups                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Revalidate owner roots and handoff on Firefox updates                                                                                                                                                                                      | #37, #15; ADR-031, ADR-032                                                            |
| Bookmark data and opening            | Large/user-controlled tree can become unbounded UI state; unsafe opening can bypass principal/scheme behavior                                    | #14 uses 32-item replaceable pages, depth/expansion caps, per-window opaque IDs and observers, text-only 160-code-point titles, no URL in Svelte/DOM/logs, blocked executable/data/place schemes, native `PlacesUIUtils` opening/private policy, and a fixed `PlacesCommandHook.showPlacesOrganizer("UnfiledBookmarks")` Library action; row menus retain only an opaque ID                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Revalidate exact Places/opening/Library internals and real context-menu paths on Firefox updates                                                                                                                                           | #14, #16; ADR-029, ADR-055                                                            |
| Download data and file actions       | Paths/source URLs/private state can leak; unsafe actions can execute files                                                                       | #32 exposes six anonymous items, capped counts, fixed state/percentage only; uses PUBLIC/PRIVATE per-window views, no filenames/paths/sources/bytes/actions/forced reveal, exact view removal, and native safety retention                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Revalidate current list/view/field/native-panel semantics on Firefox updates                                                                                                                                                               | #32; ADR-030                                                                          |
| Normal diagnostics                   | URLs, titles, queries, bookmarks, downloads, paths, secrets, or private data can leak                                                            | Default-deny schemas, stable codes, redacted stacks, no network sink, hostile-value tests; #12–#14/#32/#37 and ADR-037 errors contain fixed phase/code/symbol/build/window-kind only and never address/status/permission/action/extension/widget/bookmark/download source data                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Extend the same fixed schema to later features                                                                                                                                                                                             | #3, #5, #9–#14, #32, #37; ADR-037                                                     |
| Private-window state                 | State can leak to normal windows, process globals, preferences, or diagnostics                                                                   | Per-window lifecycle/frame/tabs/navigation/popup/Urlbar/browser-tools/bookmark/download instances, opaque generations, bounded unpersisted state, complete fallback on uncertainty; #12–#14/#32/#37 passed normal/second/private isolation and disposal; ADR-063 tags the sole active drag by window kind and makes normal/private inspection, hit-target resolution, and adoption mutually invisible                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Run ADR-042's pending second/private native-panel placement matrix and ADR-063's real cross-window rejection rows, then repeat for each later bridge and Firefox update                                                                    | #5, #9–#14, #31, #32, #37; ADR-037, ADR-042, ADR-063                                  |
| Native security UI                   | Custom surfaces/native hiding can obscure permission/auth/certificate/extension/download-safety/dialog UI                                        | Native DOM retained; #13/#37 summarize fixed state/availability; ADR-059 merges only the visible Trust summary while retaining both bridge actions and the native panel; ADR-037/ADR-042 delegate detail/actions to original Firefox owners and clicked project hosts; ADR-056 moves only non-security hidden-toolbox popups to one health-checked project proxy, with movement failure revealing or suspending fail-open; ADR-057 never moves shared `#notification-popup` after show, preserves lazy owner creation, invokes Firefox's stored visible-anchor callback first, substitutes the proxy only before initial hidden-toolbox placement, restores exact ownership, and holds complete native chrome if routing is unavailable/ineffective—the owner-observed Firefox 154 AMO path currently uses that accepted fallback—while `show-translate` delegates to the Firefox translations owner; no sensitive panel data is exported; ADR-032 retains explicit navbar/sidebar access, modal/customize/DOM-fullscreen suspension, and emergency fallback; ADR-050 pending hide self-expires and yields to failed/suspended/active | Run ADR-042/ADR-056/ADR-057/ADR-059's pending native-panel/doorhanger placement, Trust-state, AMO install, translation, caption, focus, security-delay, and fallback matrix and repeat after Firefox updates                               | #7, #13, #15, #31, #37; ADR-032, ADR-037, ADR-042, ADR-050, ADR-056, ADR-057, ADR-059 |
| Installer/updater/repair/uninstaller | Ambiguous/broad/reparse targets can overwrite/delete unrelated Firefox/profile data or adopt stale state                                         | Explicit canonical targets, create-and-delete writability proof, mode-specific marker/registration/ownership proof, dry run, dual ownership manifests, staging, hashes, journal, rollback, exact deletion; release mutations require strict package validation and Firefox major version 153 or newer; Repair accepts only one wholly absent side, one exact survivor/source, and no residue; one-sided Uninstall accepts only a valid survivor, absent peer metadata, and hash-matching present files; Disable/Uninstall remain recovery exits; the optional console and release GUI confirm the 153/154 testing warning and the displayed plan digest and never auto-select a default profile; the GUI may UAC-relaunch only after an explicit continue when the program directory is not writable, using an exclusive, bounded, owner-only non-reparse continuation file in the dedicated OS-temp namespace before recomputing `planSha256`                                                                                                                                                                                        | Revalidate for every platform/scope/compatibility change                                                                                                                                                                                   | #4, #16, #39, #57; ADR-033, ADR-036, ADR-040, ADR-048, ADR-049                        |
| Release publication                  | Stale, nondeterministic, tampered, secret-bearing, wrong-source, or partially uploaded assets can execute privileged code                        | Canonical SemVer/tag contract, strict machine manifest, deterministic sorted ZIP with fixed timestamps, separate SHA-256, sensitive-data/path scan, clean-tree double build, annotated-tag-only workflow, draft with exact two-asset and GitHub digest verification before publish, download recheck                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Record exact first-publication run and repeat per release                                                                                                                                                                                  | #18, #39; ADR-036                                                                     |
| Test-only performance evidence       | Firefox process records can expose origins, window URIs/titles, IDs, and threads                                                                 | Explicit harness mode immediately reduces raw records to numeric process/memory/CPU aggregates and fixed timings; static test rejects sensitive fields; no production caller or sink                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Revalidate API shape on every supported Firefox                                                                                                                                                                                            | #16; ADR-034                                                                          |
| Test-only persisted-session evidence | Firefox SessionStore can expose complete browsing state, while preference or failure-injection residue can alter later starts                    | Explicit four-phase harness accepts only fixed local fixtures; default-deny evidence emits fixed IDs/counts/booleans; a stale marker blocks prepare; exact preference state, bundle bytes, one blank tab, and process baseline are restored; no production caller or sink                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Revalidate restore timing, lazy pending semantics, and cleanup on every supported Firefox                                                                                                                                                  | #46; ADR-035                                                                          |
| Startup cache/stale installed code   | Removed or fixed privileged code may continue to run                                                                                             | Exact inventory and evidence-first cache policy; validated changes took effect without routine clearing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Cache action only after observed stale symptom                                                                                                                                                                                             | #3, #4, #16                                                                           |
| External implementation/design       | Unlicensed or copied code/design can create legal and maintenance risk                                                                           | MPL-2.0 project/inbound policy; root third-party inventory; exact source/file/commit/license/modification record; preserved notices; `my-firefox-custom` no-copy boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Repeat gate before every included external item or distribution                                                                                                                                                                            | #18; `docs/licensing-and-provenance.md`                                               |
| Runtime network/update/telemetry     | Remote party can change privileged behavior or receive browsing data                                                                             | Prohibited; scanner detects common endpoints/APIs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | New issue + ADR + security review for any exception                                                                                                                                                                                        | ADR-012                                                                               |
| Native UI hiding                     | Broad selectors can remove uncovered actions or leave no recovery                                                                                | Production durable hide activates only after health; ADR-032/ADR-037/ADR-038/ADR-042/ADR-056/ADR-057/ADR-064/ADR-068 use one exact ten-rule per-window controller, retained caption-node validation, project-owned top-row window commands, Urlbar/original-toolbar reveal, Fennevia host/token and health-checked generic popup anchors, a pre-open security-notification anchor route with complete-native fallback, two active-only fixed `#statuspanel-label` presentation rules, CSS/anchor integrity checks, and suspension-first fail-open; ADR-050 adds a 2,000 ms self-expiring first-paint `AUTHOR_SHEET`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Run the changed real geometry/caption/popup/prompt/status-label matrix and the ADR-050 cold-start/watchdog/skeleton checks, then revalidate exact target graph, popup API, notification timing, status owner, and both tab-layout branches on every supported Firefox | #15, #16; ADR-032, ADR-037, ADR-038, ADR-042, ADR-050, ADR-056, ADR-057, ADR-064, ADR-068      |

Every unresolved high-risk row has an owner. An unimplemented control is a
blocker, not an implicit risk acceptance.

## 3. Production artifact gate

### 3.1 Current inventory

`package-manifest.json` is the installed-file source of truth. Package
`0.16.0-beta.1`
contains the following profile paths:

```text
chrome.manifest
content/Bootstrap.sys.mjs
content/firefox/BridgeBoundary.sys.mjs
content/runtime/HealthState.sys.mjs
content/runtime/Logger.sys.mjs
content/runtime/NativeUi.sys.mjs
content/runtime/Runtime.sys.mjs
content/runtime/StartupNativeHide.css
content/runtime/StartupNativeHide.sys.mjs
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

| Field                                      | Rule                                                      |
| ------------------------------------------ | --------------------------------------------------------- |
| `prefix`                                   | One of the fixed Fennevia component prefixes              |
| `level`                                    | Stable severity                                           |
| `event`, `phase`, `code`                   | Fixed project values                                      |
| `projectCommit`, `projectVersion`          | Build metadata                                            |
| `firefoxVersion`, `buildId`, `channel`     | Firefox metadata                                          |
| `windowKind`                               | `normal`, `private`, or `unsupported` classification only |
| `capability`, `available`, `firefoxSymbol` | Fixed allowlisted symbol/name and boolean                 |
| `projectUri`                               | Fixed source-defined `chrome://fennevia/` URI only        |
| `domPath`                                  | Fixed short allowlisted selector/path only                |
| `edge`, `edgeState`, `holdReason`          | Fixed enums only                                          |
| `errorName`                                | Class name without untrusted message                      |
| `stack`                                    | Redacted line-preserving frames                           |
| `opaqueId`                                 | Process-local random ID with no durable mapping           |
| counts/booleans                            | Aggregate non-browsing state only                         |

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

| Question                                                           | Required evidence                                |
| ------------------------------------------------------------------ | ------------------------------------------------ |
| What exact consumer needs the mapping?                             | Source/issue reference                           |
| Which exact files become reachable?                                | Closed inventory; no globs                       |
| Who can resolve/fetch them?                                        | Current Firefox source and ordinary-content test |
| Can the mapping expose source, diagnostics, secrets, or user data? | Negative review                                  |
| Can a narrower fixed import work?                                  | Alternatives analysis                            |
| How is removal tested?                                             | Cold-start/content-context removal test          |
| Does it use `contentaccessible=yes` or `override`?                 | Dedicated issue, ADR, security review            |

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
- no tab data in logs/datasets/persistence;
- container labels are bounded text like titles and never logged;
- container colors are a closed enum mapped to CSS tokens;
- audio and sharing remain closed enums; attention/PiP/crashed remain
  booleans;
- origins, devices, permissions, paused state, `_sharingState`, and WebRTC
  records stay privileged; capture status is transient per window and never
  logged or persisted;
- native tab context-menu policy stays Firefox-owned;
- lazy Fluent IDs are activated by the required current Firefox owner before
  open, without copying labels;
- the fixed NativeUi handoff token is released on open failure, popup close,
  and disposal so the native anchor does not reveal original chrome;
- ADR-063 clears the transferable drag payload and adds only the fixed
  `application/x-fennevia-tab-transfer` marker with constant value `1`; there
  is no `text/plain`, URL, opaque tab ID, random drag ID, title, favicon, or
  native value for content or another application to interpret. Its visual
  ghost reuses the already rendered project row, the owned source row receives
  only a bounded pointer transform, and closed shift tokens plus one marker
  preview the landing gap without adding browsing data. A target window adds a
  decorative generic row using only a fixed localized label and packaged tab
  icon; it receives no source title, URL, favicon value, native DOM, or drag
  identifier. Target-window reveal reuses the shared left pointer hold and
  delayed-hide owner;
- ADR-063's single ephemeral privileged coordinator retains one active native
  tab only long enough for same-kind target `adoptTab` or source
  `replaceTabWithWindow`. Ordinary target inspection contains only a bounded
  random ID, pinned boolean, and same/other-window enum. Normal/private crossing
  is rejected, completed native state is not retained, and every terminal path
  or controller disposal clears the transfer, captured row geometry, shifts,
  marker, visible target row, hidden layout slot, capture listeners, and shared
  pointer hold. Browser-window cleanup treats null `dragleave.relatedTarget` as
  the true exit and ignores internal non-null target transitions; no depth
  counter or screen-coordinate target guessing occurs. If adoption removes the
  source tab before `dragend` is observed there, bounded opaque-ID snapshot
  reconciliation clears that source's frontend state and pointer hold while
  the target consumes the transfer, then releases focus/keyboard holds only if
  focus is outside the source surface after the DOM tick. This owner-approved
  exception does not authorize a general cross-window registry;
- ADR-081 permits source detach only when the bounded terminal screen point is
  at least 16 CSS pixels from the bounded drag-start point. The delta must not
  identify a DOM/window target, alter the established source/target event
  route, or retain a post-detach tab lock. It adds no timer, transferable ID,
  native handle, log field, persistence, or process-global state;
- a later `beginDrag` may replace an active transfer only when the same window
  context owns it; it must not cancel or inspect another window's native source
  through this recovery path;
- composable-layout drag handlers must act only when the layout node is the
  event's exact target. They must ignore a child widget's bubbling `dragstart`
  and must not become a second drag-event owner for tabs or other features;
- the post-move live announcement uses the existing bounded title as text only
  and has no log, dataset, persistence, clipboard, or network sink.

ADR-055's common top/left/right/bottom context menus use fixed labels/actions,
ordinary adapter calls, frame-clamped coordinates, the existing edge popup
hold, keyboard focus restoration, and deterministic outside/blur/disposal
cleanup. Descendant tab/bookmark menus stop propagation. They add no URL,
title, download detail, native handle, persistence, log field, trigger, or hide
timer. Automated boundary coverage passed; the real Firefox interaction rows
remain not run.

### 7.3 Navigation and address — implemented and validated

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

Implemented address controls:

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

### 7.4 Urlbar permission/action coverage — #37 validated control

Implemented and validated:

- current Firefox 153 inventory for leading status, permission/sharing,
  notification-anchor, conditional/static/dynamic page-action, search-mode,
  persisted-search, provider-label, and search-one-off families;
- only fixed booleans and allowlisted enums cross the bridge;
- unknown permission IDs are omitted and dynamic actions are generic;
- no URL, origin, principal, certificate, permission record/scope, extension
  identity, action ID, localized native label, or provider result crosses;
- one observer with four fixed owner roots and no polling/timer;
- no native DOM mutation, click synthesis, panel reconstruction, or security
  mutation;
- complete native handoff through current `window.openLocation()`;
- normal/second/private isolation and exact observer/subscriber cleanup;
- real HTTP, valid HTTPS, internal, network-error, blocked-camera, ETP
  exception/restore, dynamic zoom, Browser Toolbox, and fail-open evidence.

The short launcher remains connection/ETP only, presented as one Firefox-style
Trust shield inside the address frame; the detailed popup owns the combined
Trust row plus permission/action summary. The fixed resource map copies no
Firefox bytes and adds no network or content-accessible mapping. Missing
capability removes project hosts and retains native UI. Evidence: ADR-031,
ADR-059, and
`docs/research/firefox-153-urlbar-coverage.md`.

### 7.5 Bookmarks — #14 validated gate

The core #14 control was implemented and validated on Firefox 153.0.4;
ADR-064's favicon extension has focused automated coverage and Firefox 154
source evidence, while its real-browser rows remain `not run`:

- current source for Places roots/query/observer/open behavior;
- bounded/lazy query and depth/page limits;
- opaque IDs;
- URL remains private when possible;
- text-only title;
- no bookmarklet execution;
- optional Firefox-cached, bounded raster bookmark favicons through
  property-only `img.src`, with no remote project request or metadata;
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
`docs/research/firefox-153-bookmarks-surface.md`. The source-backed Library
owner, row context actions, missing-owner fail-open, and hold/listener cleanup
are covered by automated tests; their real interaction rows remain not run.
Evidence: ADR-055 and
`docs/research/firefox-153-154-panel-context-actions.md`. ADR-064 resolves the
bookmark URL only inside `src/firefox/`, asks Firefox's existing Places cache
for a 16–64 px DPI-bounded icon, accepts only base64 raster data up to 262,144
characters, drops malformed/SVG/remote values to the packaged fallback, and
never logs or persists the page or favicon URL. `favicon-changed` is reduced to
an all-scope refresh with no event value crossing the bridge. Evidence:
`docs/research/firefox-154-configurable-panels-bookmark-favicons-status.md`.

### 7.6 Downloads — #32 validated control

Implemented and validated:

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

Exact controls are six anonymous item summaries, three newly observed terminal
records, state counts capped at 999 with overflow, context-bound opaque IDs,
and integer aggregate output. Positive known totals are byte-weighted inside
the bridge; any active unknown progress is explicitly indeterminate. The
normal/second/private lifecycle, hidden updates, native panel alternation,
zero/small/5-GiB records, pause/resume/terminal states, bursts, exact view
removal, malformed records, missing Downloads capability, hard disable,
frontend recovery, and Browser Toolbox ownership matrix passed. Evidence:
ADR-030 and `docs/research/firefox-153-downloads-surface.md`.

## 8. Four-edge UI controls

The #31 contract is mandatory.

### 8.1 Trigger and layout

- narrow bounded trigger thickness (12 CSS px by default, user-bounded to
  6–24 CSS px, independent of the 7px content gutter); the same validated
  value drives CSS and corner arbitration;
- decorative 2px load/download lights in that gutter (`pointer-events: none`,
  `aria-hidden`, no extra margin);
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
on replacement/disposal. ADR-054 may rearm the same hide timer with separate
100–5,000 ms in-window and window-leave delays and select a 400–10,000 ms
default for the existing programmatic timer. A non-null pointer destination
inside the Firefox window selects the first delay; a null destination or the
existing window-blur fallback selects the second. Focus, keyboard, and popup
holds still prevent timed hiding. Exceptions enter fail-open cleanup.

The existing shortcut-tip CSS animation accepts a bounded 0–10,000 ms
duration. Zero omits the nonessential shortcut footer from the initial Svelte
render; no JavaScript timer, observer, or privileged data path is added.

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

#15 provides the reviewed coverage inventory in
`docs/research/firefox-153-content-only-activation.md`:

| Field                       | Required                                  |
| --------------------------- | ----------------------------------------- |
| Native selector/capability  | Exact current value                       |
| Firefox owner/source        | Path/revision/build                       |
| User-visible purpose        | Complete                                  |
| Fennevia replacement        | Completed issue                           |
| Retained native access path | Command/menu/fallback                     |
| Failure behavior            | Immediate native restoration              |
| Mode policy                 | fullscreen/DOM fullscreen/customize/modal |
| Tests                       | normal/second/private plus failure matrix |

Rules:

- hide the narrowest possible surface;
- never hide a broad parent with uncovered descendants;
- #37 native handoff must reveal and focus the native Urlbar while active;
- identity/trust/protections/permission/extension/page-action panels and
  notification anchors must remain reachable and unobstructed;
- every durable hiding selector is gated by per-window `data-fennevia-active`;
- the ADR-050 pending hide is a separate self-expiring `AUTHOR_SHEET` that
  yields immediately to `failed`, `suspended`, and `active`;
- missing/invalid activation CSS prevents activation;
- clearing active restores native UI without restart/Svelte;
- unsupported mode suspends/clears active;
- no core native DOM is removed or reparented;
- no feature implementation is smuggled into #15 to bypass blockers.

ADR-032 implements these rules with exact active/reveal/suspension selectors.
Real Firefox 153 tests cover the complete Urlbar owner, native Downloads popup,
History sidebar, customize mode, browser/DOM fullscreen policy, native modal,
normal/second/private isolation, Browser Toolbox ownership, emergency fallback,
and partial activation CSS. ADR-050 adds a document-scoped `AUTHOR_SHEET` and
`browser.startup.preXulSkeletonUI=false`; it adds no browsing-derived
diagnostic field. Real Firefox cold-start flash, CSS watchdog restore, and
skeleton comparison remain `not run`.

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

The existing `fennevia.customize.style` schema may persist ADR-054's bounded
in-window hide delay, window-leave hide delay, temporary reveal duration,
shortcut-tip duration, and trigger thickness. These are global shell
preferences, never observations of private-window activity; they use the
existing 16 KiB cap, preference observer, reset path, and fail-safe defaults
rather than a new persistence owner.

ADR-064 uses the same privileged preference owner for one additional strict
version-1 `fennevia.customize.panels` value. It stores only the complete side
role enum, bottom-enabled boolean, two loading/download/off light enums, and
ADR-068's `allowCompactWindow` boolean (default false);
it stores no browsing observation, URL, title, bookmark, download state, CSS,
or private-window activity. Compact-window CSS is an opt-in chrome min-size
override while Fennevia is active; disposal restores Firefox's floor.

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
- default marker-owned unregistered development profile, or explicit
  registered-profile mode with an exact Firefox registration/ownership proof;
- no root/home/profile-parent/program-root target;
- no traversal/reparse ambiguity;
- permissions;
- ownership/collision/hash verification;
- all processes closed where required;
- redacted plan digest.

Release-only preflight additionally requires a strict `RELEASE-MANIFEST.json`
inventory and file hashes, package-manifest binding, supported Windows scope,
and Firefox major version 153 or newer for install/update/repair/enable, plus
an explicit warning that only 153 and 154 are tested. Enable binds
to ownership's source-manifest hash. Disable/uninstall remain available when
Firefox is older than 153.

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

The optional console (`scripts/fennevia.ps1`) and release GUI (`FenneviaSetup.exe`)
may list registered profile **names** locally. They must not preselect a default
profile, must not write absolute paths to copyable output, and must pass the
displayed plan digest before mutation. The GUI may request administrator
permission only after an explicit continue when the selected program directory
is not writable; the elevated instance must recompute and match `planSha256`.
The development helper may create or remove only the marker-owned
`program-spikes\firefox-stable-copy` tree.

Recovery:

- `Repair` reconstructs only one completely absent side from exact survivor and
  source proof, and rolls back injected partial failure;
- `Disable` must work with a broken/missing runtime;
- complete-pair and one-survivor `Uninstall` remove only verified owned
  files/metadata, preserve unrelated content, and reject modified survivors;
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

Issue #18 resolved the project license and inbound contribution terms. The gate
remains mandatory before every public distribution or inclusion of reusable
external code/asset: follow `docs/licensing-and-provenance.md` and update
`THIRD_PARTY_NOTICES.md` before merge.

## 13. Security review triggers

| Trigger                          | Minimum required record                                                           |
| -------------------------------- | --------------------------------------------------------------------------------- |
| Runtime network/update/telemetry | Threat model, endpoint/data inventory, consent, failure/offline behavior, new ADR |
| Dynamic code generation          | Necessity, alternatives, input boundary, CSP/privilege review, tests              |
| Privileged runtime dependency    | Complete dependency review and artifact/runtime effect                            |
| Content-accessible resource      | Exact files, consumers, current-source/content-context tests                      |
| Chrome Registry override         | Upstream pin/diff workflow/security/update/removal tests                          |
| New persistence                  | Schema, privacy classification, private-window behavior, cleanup                  |
| Untrusted HTML/CSS               | Sanitization boundary and hostile input tests                                     |
| Arbitrary scheme/URL load        | Firefox principal/fixup/content-policy research and tests                         |
| File open/execute/delete action  | OS/Firefox safety semantics, user intent, path policy                             |
| Native security UI replacement   | Dedicated threat model, spoofing/fallback/accessibility tests                     |
| Native visible parent hiding     | Complete coverage inventory and retained paths                                    |
| Installer deletion-scope change  | Canonical path/ownership/rollback/adversarial tests                               |
| Custom titlebar/window controls  | Platform-specific source/UX/security/recovery matrix                              |

A normal PR checkbox does not waive a triggered review. Waiving or relaxing a
triggered review requires explicit project-owner approval.

## 14. Required verification commands

During rapid development, the ordinary gate is CI / `npm run verify`. The
commands below remain the complete security-verification inventory. Real
Firefox and extra packaging suites are the release mass-test contract unless
the owner asks for them earlier. See ADR-039. `npm run verify` includes Node
coverage floors (80% lines and 80% functions) on loaded `src/app` and
`src/firefox` modules; do not add tests solely to raise those numbers.

Static/build baseline:

```powershell
npm ci --ignore-scripts --no-fund
npm run dependencies:audit
npm run test:powershell
npm run verify

powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\tests\run-static-powershell-tests.ps1
pwsh -NoProfile -File .\tests\release-packaging.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\tests\release-packaging.Tests.ps1
pwsh -NoProfile -File .\tests\release-installer.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\tests\release-installer.Tests.ps1
pwsh -NoProfile -File .\scripts\check-production-artifacts.ps1 `
  -ArtifactRoot .\profile\chrome\fennevia `
  -InventoryPath .\package-manifest.json
```

Real Firefox baseline, required before a tagged release:

```powershell
node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>'

node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>' `
  --browser-toolbox

node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>' `
  --performance-baseline
```

If the five-second idle threshold triggers, hard-disable only the same isolated
marker-owned target and run three `--performance-stock-baseline` cold-start
controls before restoring Enable. This mode reuses ADR-034's aggregate-only
collector and must observe zero Fennevia records and project hosts.

Use the feature-specific recovery wrapper documented in
`docs/testing-and-recovery.md`. Every owned mutation wrapper restores exact bytes
and verifies hashes in `finally`.

## 15. Evidence and maintenance

Current detailed evidence:

- bootstrap: `docs/research/firefox-153-bootstrap.md`;
- installer: `docs/research/fennevia-installer-validation.md`;
- release packaging: `docs/research/fennevia-release-packaging.md`;
- lifecycle: `docs/research/firefox-153-window-lifecycle.md`;
- initial hosts: `docs/research/firefox-153-shell-hosts.md`;
- health/recovery: `docs/research/firefox-153-shell-health-recovery.md`;
- frontend: `docs/research/firefox-153-svelte-build.md`;
- boundary: `docs/research/firefox-153-bridge-boundary.md`;
- tabs bridge: `docs/research/firefox-153-tabs-bridge.md`;
- tab UI: `docs/research/firefox-153-tab-strip.md`;
- four-edge frame: `docs/research/firefox-153-four-edge-shell.md`;
- top navigation: `docs/research/firefox-153-navigation-controls.md`;
- address popup: `docs/research/firefox-153-address-popup.md`;
- Urlbar coverage: `docs/research/firefox-153-urlbar-coverage.md`;
- bookmarks: `docs/research/firefox-153-bookmarks-surface.md`;
- Downloads: `docs/research/firefox-153-downloads-surface.md`;
- content-only activation:
  `docs/research/firefox-153-content-only-activation.md`;
- MVP hardening and update rehearsal:
  `docs/research/firefox-153-mvp-hardening-update-rehearsal.md`.
- persisted SessionStore rehearsal:
  `docs/research/firefox-153-session-restore-rehearsal.md`.

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
