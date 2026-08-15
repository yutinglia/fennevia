# Operational Security Controls

This document turns the policy in `docs/security-and-privacy.md` into review records, required evidence, and testable gates. It is a Phase 0.5 baseline, not a formal security audit or penetration test.

## 1. Control ownership and status

The controls defined here are mandatory defaults. A later implementation issue owns the code and real-Firefox evidence for its boundary; that issue may strengthen a control but must not silently weaken it.

Status terms:

- **active policy**: required now for issues and reviews;
- **automated baseline**: a repository check exists, but a later issue must wire it to real artifacts or CI;
- **implementation gate**: the named issue must provide runtime or installer evidence;
- **accepted architecture decision**: the behavior is intentionally retained and has no missing implementation in this issue.

## 2. Threat model

| Asset or trust boundary | Threat | Consequence | Existing control or decision | Missing control or evidence | Owner |
|---|---|---|---|---|---|
| AutoConfig entry and process bootstrap | Malformed, replaced, duplicated, or compromised system-principal code | Arbitrary privileged execution, repeated initialization, or unusable startup | Minimal bootstrap, no generic loader, no dynamic code, fail open | Implement the smallest startup chain, one-time guard, privacy-safe fatal error, and failure injection | [#3](https://github.com/yutinglia/fennevia/issues/3) |
| Chrome Registry manifest | A malformed or over-broad declaration exposes files or replaces Firefox resources | Web-content access, privilege-boundary confusion, or missed upstream security fixes | Dedicated namespace; no `override`; no `contentaccessible=yes`; review in section 6 | Validate the final manifest and content-process access on the supported Firefox build | [#3](https://github.com/yutinglia/fennevia/issues/3) |
| `resource://` mapping | A later `contentaccessible=yes` flag or over-broad inventory exposes files that were intended to remain privileged | Disclosure of source maps, implementation code, diagnostics, or private assets | Initial manifest omits `resource`; default access is privileged-only, and any hole punch is rejected | Concrete consumer, exact inventory, current-source review, ordinary-content test, and removal test before adding a mapping | [ADR-016](architecture-decisions.md#adr-016-follow-firefoxs-current-internal-url-access-model-and-omit-unused-mappings); runtime validation: [#3](https://github.com/yutinglia/fennevia/issues/3) |
| npm registry, dependencies, and build tools | A compromised maintainer, package, lifecycle script, native binary, or transitive dependency executes during install/build | Developer-host compromise or malicious system-principal artifact | Exact review record, committed lockfile, no unreviewed lifecycle scripts, no runtime package manager | Resolve and review the actual lockfile and build in a constrained environment | [#8](https://github.com/yutinglia/fennevia/issues/8); upgrades: [#16](https://github.com/yutinglia/fennevia/issues/16) |
| Generated JavaScript, CSS, XHTML, maps, and chunks | HMR, remote endpoints, bare imports, dynamic chunks, source maps, debug code, or executable binaries leak into installation | Runtime network execution, non-determinism, source disclosure, or unreviewed code | `scripts/check-production-artifacts.ps1` and explicit artifact inventory | Run against the selected production build and then in CI | [#8](https://github.com/yutinglia/fennevia/issues/8), [#16](https://github.com/yutinglia/fennevia/issues/16) |
| Page titles, URLs, favicon values, and address input | Page-controlled strings are interpreted as HTML, CSS, code, privileged URIs, or native API arguments without validation | Chrome injection, spoofing, unintended navigation, or privileged API misuse | Text rendering only, typed bridge boundary, runtime validation, no arbitrary HTML | Implement per-feature validation and hostile-string tests | [#9](https://github.com/yutinglia/fennevia/issues/9), [#10](https://github.com/yutinglia/fennevia/issues/10), [#11](https://github.com/yutinglia/fennevia/issues/11), [#12](https://github.com/yutinglia/fennevia/issues/12), [#13](https://github.com/yutinglia/fennevia/issues/13), [#14](https://github.com/yutinglia/fennevia/issues/14) |
| Normal diagnostics and shared evidence | URLs, titles, queries, history, local paths, secrets, or private-window state enter logs or screenshots | Browsing-data or identity disclosure | Bootstrap and #5 runtime loggers use allowlisted schemas, line-preserving redaction, hostile-value tests, and no network sink | Extend the same adapter contract to each future bridge/frontend logger | [#3](https://github.com/yutinglia/fennevia/issues/3), [#5](https://github.com/yutinglia/fennevia/issues/5) |
| Private-window per-window state | Private tab data is copied to process-global state, normal windows, persisted preferences, or diagnostics | Private-browsing disclosure after or during the session | Section 8 requires per-window memory, no browsing-derived persistence, and native fallback on uncertainty; #5 validates base lifecycle and disposal in a real private window | Validate each browsing-data bridge and UI feature separately before enabling it in private windows | [#5](https://github.com/yutinglia/fennevia/issues/5), [#9](https://github.com/yutinglia/fennevia/issues/9), [#10](https://github.com/yutinglia/fennevia/issues/10), [#12](https://github.com/yutinglia/fennevia/issues/12), [#13](https://github.com/yutinglia/fennevia/issues/13), [#14](https://github.com/yutinglia/fennevia/issues/14) |
| Installer, updater, and uninstaller | Relative, broad, reparse-point, wrong-install, or daily-profile targets cause path escape, overwrite, or recursive deletion | Firefox damage or loss of unrelated profile files | Canonical preflight, redacted dry run, dual ownership manifest, same-volume staging, recovery journal, rollback, and exact deletion rules in section 7 | Repeat the real-Firefox lifecycle on each supported installer/platform change | [#4](https://github.com/yutinglia/fennevia/issues/4) |
| Startup cache and installed stale state | Removed or replaced privileged code continues to execute from stale state | Old vulnerable behavior survives update, disable, or uninstall | Evidence-first cleanup; complete installed-file inventory; installer reports `startupCacheAction=none`; no arbitrary cache deletion | Revalidate only when a Firefox update or observed stale-code symptom supplies evidence | [#3](https://github.com/yutinglia/fennevia/issues/3), [#4](https://github.com/yutinglia/fennevia/issues/4) |
| Native permission, authentication, certificate, extension-install, file-picker, and download-safety UI | The custom shell hides, replaces, overlays, or makes a prompt unreachable | Spoofing, unsafe consent, or inability to respond to Firefox security state | Firefox ownership is accepted in ADR-014; native UI remains on fail-open path | Verify hosts do not obstruct prompts, then test before hiding native visible UI | [#6](https://github.com/yutinglia/fennevia/issues/6), [#7](https://github.com/yutinglia/fennevia/issues/7), [#15](https://github.com/yutinglia/fennevia/issues/15) |
| Window/runtime listeners, mappings, styles, and roots | Incomplete cleanup retains privileged state or duplicates handlers across windows | Cross-window data leaks, stale actions, or repeated privileged effects | #5 implements one process runtime, weak duplicate suppression, abort-first per-window cleanup, idempotent stop, and real second/private-window disposal | Require every future host, bridge, timer, mapping, style, and root to register with the same cleanup boundary | [#5](https://github.com/yutinglia/fennevia/issues/5), [#6](https://github.com/yutinglia/fennevia/issues/6), [#9](https://github.com/yutinglia/fennevia/issues/9) |
| Third-party source and copied snippets | Incompatible, absent, or unclear licensing and provenance | Legal inability to distribute, stale vulnerable code, or lost attribution | Record source URL, commit, license, modifications, and attribution; unlicensed code is unavailable | Select project license and attribution policy before copying implementation code | [#18](https://github.com/yutinglia/fennevia/issues/18) |
| Runtime network, analytics, configuration, fonts, templates, and update checks | A remote party changes privileged behavior or receives browser data | Remote code execution, tracking, or unreproducible recovery | ADR-012 prohibits all such runtime dependencies; artifact scanner detects common leakage | Any proposed exception requires a dedicated issue and new architecture decision before implementation | [ADR-012](architecture-decisions.md#adr-012-no-runtime-remote-executable-dependencies); otherwise prohibited |

Every high-risk implementation gap is assigned above. The absence of an implementation today is not acceptance of the risk; it is a blocker owned by the linked issue.

## 3. Production artifact gate

Every production build must have a committed, reviewed inventory. Example:

```json
{
  "schemaVersion": 1,
  "expectedFiles": [
    "runtime/Bootstrap.sys.mjs",
    "shell/shell.js",
    "shell/shell.css"
  ]
}
```

The current bootstrap inventory is the exact `expectedFiles` list in
`package-manifest.json`. The paths above remain illustrative only for the future
#8 frontend build. That issue must add its exact generated file set; globs are
prohibited because they cannot detect an unexpected chunk.

After issue #6, the current privileged profile inventory is exactly:

```text
chrome.manifest
content/Bootstrap.sys.mjs
content/runtime/Logger.sys.mjs
content/runtime/Runtime.sys.mjs
content/runtime/WindowManager.sys.mjs
content/runtime/WindowShell.sys.mjs
```

The package version is `0.3.0-dev`. Every entry has a committed SHA-256 in
`package-manifest.json`; no new Chrome Registry declaration accompanies the
four runtime modules.

Run the gate with:

```powershell
pwsh -NoProfile -File .\scripts\check-production-artifacts.ps1 `
  -ArtifactRoot .\dist `
  -InventoryPath .\config\production-artifacts.json
```

Exit codes are `0` for pass, `1` for findings, and `2` for invalid input or policy. Output contains only a stable rule ID, artifact-relative path, and line number. It does not echo matched URLs, source text, or the absolute artifact root.

The automated baseline detects:

- files missing from or added beyond the exact inventory, including unplanned chunks;
- non-normalized or non-ASCII artifact paths, which are reported as `<UNSAFE_ARTIFACT_PATH>` rather than echoed;
- `http`, `https`, `ws`, `wss`, protocol-relative, localhost, and loopback endpoint literals;
- `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, and `importScripts` usage;
- Vite and common bundler HMR markers;
- bare imports and dynamic `import()` calls;
- source-map files and source/source-map references;
- development source, test, coverage, TypeScript, and Svelte files;
- `eval`, `new Function`, executable binaries, and unscannably large text;
- junctions and symbolic links inside the artifact tree.

The two standards-defined namespace identifiers used by DOM APIs are the only
endpoint-literal exception: the scanner permits exact quoted
`http://www.w3.org/1999/xhtml` and
`http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul` values. It
replaces only the exact quoted token before endpoint matching, so any suffix,
path, query, alternate scheme, concatenation, or other URL remains blocked.
The scanner fixture proves both the accepted constants and a rejected
namespace-looking URL with a query.

The scanner has no bypass flag. A legitimate finding requires a dedicated review and a visible policy/code change, not an ignored CI warning. Passing this static gate does not prove runtime safety; #8 must also run the built artifacts in the development profile, and #16 must make the gate part of CI.

## 4. Privacy-safe logging contract

### 4.1 Default-deny fields

Logging calls accept a defined event record, not arbitrary objects, native Firefox values, exceptions, tabs, windows, requests, or application state. The normal record may contain only:

| Field | Rule |
|---|---|
| `prefix` | One of `[Fennevia bootstrap]`, `[Fennevia runtime]`, `[Fennevia window]`, `[Fennevia bridge]`, or `[Fennevia shell]` |
| `level` | Stable severity, not user data |
| `event` | Stable project event name |
| `phase` | Stable lifecycle phase |
| `code` | Stable project error or result code |
| `projectCommit` | Commit hash or `unknown` |
| `firefoxVersion`, `buildId`, `channel` | Application metadata |
| `windowKind` | `normal`, `private`, or `unsupported`; never window browsing state |
| `capability` and `available` | Symbolic capability name and boolean |
| `projectUri` | Only a fixed `chrome://fennevia/` URI known by source code |
| `domPath` | Short source-defined ASCII selector/path only; URL-like and local path values are dropped |
| `errorName` | Error class without an untrusted message |
| `stack` | Every frame retained after sensitive substrings are replaced |
| `opaqueId` | Process-local random ID with no durable or external mapping |

No spread operator or generic serializer may turn an input context object into log fields. Values derived from a page, tab, query, title, URL, favicon, history, download, file picker, profile, principal, certificate, header, token, cookie, or private-window content are prohibited even if they appear harmless.

`Logger.sys.mjs` is the implemented runtime adapter for this schema. Successful
lifecycle records do not accept an exception or native context object. Error
records inspect only `name` and `stack`; the upstream message is replaced by
`<REDACTED_MESSAGE>`. `windowKind=private` is classification metadata, not a
private browsing value, and its UUID is random, process-local, and never stored.

### 4.2 Error and stack handling

The logger must:

1. select a stable project `code` and constant safe summary;
2. retain the error class;
3. preserve every stack frame and line while replacing `file:`, local profile/program paths, user names, page and non-source URI schemes, query text, and fragments with symbolic placeholders;
4. allow fixed project `chrome://fennevia/` paths and source-validated Firefox `chrome://` or `resource://` module paths;
5. fall back to a minimal code-only record if redaction itself fails;
6. keep detailed opt-in diagnostics local, off by default, non-persistent unless explicitly exported, and disconnected from any network sink.

An upstream error message is not safe merely because it is an `Error.message`; Firefox exceptions can embed a URI or path. Normal logs use a stable project summary instead.

### 4.3 Example bootstrap error

```text
[Fennevia bootstrap] {"level":"error","event":"bootstrap.failure","phase":"entry-import","code":"FENNEVIA_BOOTSTRAP_IMPORT_FAILED","projectCommit":"<COMMIT>","firefoxVersion":"153.0.4","buildId":"20260810162159","projectUri":"chrome://fennevia/content/runtime/Bootstrap.sys.mjs","errorName":"SyntaxError","stack":"SyntaxError: <REDACTED_MESSAGE>\n  at chrome://fennevia/content/runtime/Bootstrap.sys.mjs:12:4\n  at <REDACTED_LOCAL_FRAME>:1:1"}
```

This record identifies the phase, build, project entry, error class, and all stack frames without a page URL, title, query, user name, profile path, or private-window browsing value.

## 5. Untrusted UI value handling

Page and user-controlled values cross into the shell only through typed bridge snapshots and actions. Implementations must:

- assign titles, labels, URL display text, and address input with text/value properties; never use `innerHTML`, markup concatenation, or an HTML action merely to render text;
- keep the raw navigation request only in the focused address-input/controller flow and navigation bridge long enough for Firefox's URL/search semantics to classify it; do not copy it into process-global state, persistence, DOM datasets, or diagnostics;
- reject page-controlled `chrome:`, `resource:`, `file:`, `javascript:`, `data:`, and other privileged or executable schemes wherever the value is not an explicit navigation request handled by Firefox;
- never interpolate a title, URL, favicon value, or input into CSS, a selector, a manifest line, a module URI, a file path, a preference name, or executable code;
- use a Firefox-owned or source-validated favicon/icon pipeline. Do not make a new system-principal network request by assigning an arbitrary page-provided favicon URL to project chrome;
- constrain attributes to an explicit property and value type, remove them on absence, and avoid spreading page-derived objects onto DOM elements or components;
- cap display length without mutating the bridge's action semantics, preserve accessibility names, and test control characters, bidirectional text, invalid Unicode, quotes, markup-looking text, long input, and rapidly changing values;
- keep native Firefox permission and identity indicators authoritative; page-derived text must not imitate or cover them.

Hostile-string and navigation tests are owned by #9 through #13. If a consumer needs HTML, CSS, SVG script, or a new URI scheme, it triggers the dedicated review in section 9.

## 6. Chrome and resource declaration review

ADR-017 defines Fennevia as the sole active namespace. The initial Phase 1
proposal, now expressed with that canonical identity, is intentionally smaller
than the target namespace set:

```text
content fennevia content/
```

Review result:

| Declaration or omission | Decision | Reason | Evidence or future gate |
|---|---|---|---|
| `content fennevia content/` | Accept for Phase 1 | Dedicated project package; omits `contentaccessible=yes` | Firefox 153 resolved and imported the entry; an ordinary loopback HTTP page reported access blocked, and issue #22 repeated the denial after the identity migration |
| `contentaccessible=yes` | Reject | It explicitly permits untrusted content to reference the package | None; adding it requires a dedicated security issue |
| `resource fennevia ...` | Omit initially | No Phase 1 consumer; omitting the mapping minimizes registered and packaged surface | If later needed, name the consumer, map an exact inventory, retain default privileged-only access, and test both content denial and removal |
| `style`, `skin`, or `locale` | Omit initially | No Phase 1 consumer and each broadens exposed package behavior | Dedicated consumer and manifest review |
| `override` | Reject | Prohibited during the initial roadmap without a dedicated issue, ADR, source pin, tests, update plan, and removal plan | Not applicable to #3 |

The current source basis is Firefox 153's [`toolkit/docs/internal-urls.md`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/toolkit/docs/internal-urls.md), source revision `54be19de0e08edff0b797e55fd935dd3978b0a6d`. It documents that `chrome:` and `resource:` are privileged-only by default and that `contentaccessible=yes` opens the complete mapped package to web content. The older pinned `build/docs/chrome-registration.rst` wording used by ADR-015 implied a broader default for `resource:`; ADR-016 supersedes that interpretation while retaining the conservative inventory and test requirements.

Every manifest review must include the exact lines, mapped physical file inventory, callers, process/context tests, source-map/debug-file check, and removal behavior. A URI being project-owned does not make it privileged-only.

The Fennevia migration introduced no compatibility alias or additional mapped
surface. Its exact inventory, fail-open checks, content-denial probe, and removal
evidence are recorded in `docs/research/fennevia-identity-migration.md`.

## 7. Installer preflight, mutation, and rollback

The issue #4 package helper implements this order before its first managed-file
write:

1. Require explicit Firefox program and profile targets; never discover a daily-use profile as a mutation default.
2. Expand environment variables, require absolute paths, canonicalize with operating-system APIs, and verify every existing ancestor is not a reparse point.
3. Reject drive roots, user/home directories, AppData roots, Firefox profile collections, relative paths, missing/ambiguous targets, files where directories are required, and any target outside the selected roots.
4. Prove the program target with `firefox.exe` and `application.ini`; prove the profile target with an explicit user selection and project/development marker policy.
5. Load and validate a versioned owned-file manifest containing only normalized relative paths, file hashes, and ownership metadata. Reject traversal, absolute paths, alternate data streams, duplicates, reparse points, and collisions with non-project files.
6. Refuse update or uninstall if an existing project-owned file has an unexplained hash/ownership mismatch. Do not adopt or overwrite it silently.
7. Produce a redacted dry-run plan of exact relative creates, replaces, backups, and removals plus a deterministic plan SHA-256. Dry run performs no write, rename, cache action, or process termination; execution replans and rejects a digest mismatch before transaction creation.
8. Stage new files below marker-owned same-volume transaction directories, verify hashes, back up only project-owned files, and write a relative-path/hash journal before using same-volume atomic replacement where available.
9. On failure, stop further mutation and restore replaced, removed, moved, and newly created project-owned paths from snapshots. Preserve the journal and exact transaction directories if rollback is incomplete; any residue blocks later actions.
10. Uninstall only manifest-listed files whose ownership is still proven; remove project directories only when empty. Never recursively delete a program, profile, `chrome`, or parent directory.
11. Treat startup-cache cleanup and Firefox restart as explicit evidence-based operations after file rollback is possible, not as path cleanup.

### Rejected unsafe-target evidence

```text
event: installer.preflight
decision: reject
code: FENNEVIA_INSTALL_UNSAFE_ROOT
requestedTarget: <DRIVE_ROOT>
canonicalTarget: <DRIVE_ROOT>
plannedMutationCount: 0
reason: target is a filesystem root
```

The rejection occurs before directory creation, backup, cache action, or file mutation. Additional mandatory rejection fixtures for #4 are `<USER_HOME>`, `<APPDATA_ROOT>`, the Firefox profiles collection, a relative target, a junction escaping the selected root, a program directory without the selected Firefox identity, an unmarked daily-use profile, and an owned-manifest path containing `..`.

The automated suite also covers unknown same-name content, a simulated staging
permission denial, interrupted-transaction residue, dry-run immutability and
redaction, identical dual ownership, idempotent install/update/disable/uninstall,
missing runtime files, stale-file removal, unrelated profile chrome content,
owned-file hash conflicts, and rollback after an injected partial mutation. Run:

```powershell
pwsh -NoProfile -File .\tests\installer.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\installer.Tests.ps1
```

The exact package and manual interrupted-operation recovery procedure are in
`docs/installation.md`.

## 8. Private-window isolation and persistence

- Browsing-derived private state remains in one private window's runtime and bridge objects.
- Process-global state may contain only version, capability, registration, and health metadata that cannot identify a page or tab.
- Normal windows never subscribe to a private window's tab, title, URL, favicon, query, selection, history, or download snapshots.
- Closing a private window synchronously disposes project hosts, subscriptions, timers, mappings, opaque-ID mappings, and in-memory browsing-derived state.
- Profile preferences may persist only reviewed, schema-defined shell settings whose value does not depend on private browsing activity. Window layout preferences must have the same meaning whether changed from a normal or private window.
- Recent items, last input, selected tab, sidebar content, page-derived labels, and feature usage derived from a private window are never persisted.
- Normal diagnostics may record `windowKind=private` for lifecycle failure routing, but never a private page value or durable window identifier.
- If a bridge or feature cannot prove these boundaries, the complete private window remains on native Firefox fallback.

## 9. Security-review triggers

The issue and pull request must link a dedicated security review before any of these changes:

| Trigger | Minimum additional evidence |
|---|---|
| Runtime network access, remote configuration, analytics, updates, fonts, CSS, templates, or executable code | New ADR, endpoint/data-flow inventory, threat model, offline/failure behavior, and explicit owner approval |
| `eval`, `Function`, string-generated modules, dynamic module location, or other dynamic code | Necessity, alternatives, input provenance, CSP/principal analysis, and abuse tests |
| New privileged runtime dependency or lifecycle/native-binary build dependency | Completed dependency record, exact lockfile diff, script/network sandbox evidence, artifact diff, and removal plan |
| `contentaccessible=yes` or any `resource://` alias | Exact file inventory and ordinary-web-content access tests |
| Chrome Registry `override`, monkey patch, or upstream script replacement | Dedicated ADR and issue, upstream source pin, security-update diff process, regression tests, and removal plan |
| New profile persistence | Data classification, schema, private-window behavior, retention, migration, removal, and corruption recovery |
| Untrusted HTML, CSS, SVG script, or markup processing | Sanitizer/provenance review, parser context, hostile-input tests, and text-only alternatives |
| Installer deletion scope, ownership rules, or startup-cache mutation | Canonical-target fixtures, dry run, transaction/rollback evidence, and interrupted-operation recovery |
| Permission, identity, authentication, certificate, extension-install, file-picker, or download-safety UI replacement | Separate threat model and complete Firefox parity/fallback evidence; prohibited in the initial roadmap |
| Telemetry, crash upload, or external diagnostics | New architecture decision and privacy review; prohibited by the current roadmap |

An issue that does not trigger one of these still completes the normal security/privacy/resource/recovery sections in the repository templates with evidence or a precise `not applicable` rationale.

## 10. Security-sensitive Firefox compatibility changes

When a Firefox update changes a principal check, resource accessibility, manifest behavior, native security prompt, process boundary, installer location, or fail-open path:

1. keep or restore native UI and use safe start before retrying custom-shell activation;
2. record the supported and failing Firefox versions/build IDs, project commit, first causal error, and privacy-safe stack;
3. follow `docs/research-playbook.md`, including current canaries, Searchfox definition/callers/tests/blame, official Firefox commit, and Bugzilla when available;
4. identify whether the change closes a security boundary, exposes a resource, or invalidates an accepted decision before adapting code;
5. do not restore older behavior with an override, disabled prompt, broad mapping, or compatibility hack merely to make startup pass;
6. update this threat model, the internals map, security policy, architecture decision, recovery procedure, and owning issue when the security boundary changes;
7. add regression and failure-injection evidence, test uninstall/rollback, and re-enable activation only after native security UI and recovery remain operable.

Potentially exploitable details follow `SECURITY.md` and are not posted to a public compatibility issue before private triage.

## 11. Verification commands for this baseline

```powershell
pwsh -NoProfile -File .\tests\production-artifacts.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\production-artifacts.Tests.ps1
```

These tests exercise passing artifacts, inventory mismatch, endpoint and runtime-network leakage, HMR, bare and dynamic imports, source maps, development files, dynamic code, reparse points, traversal, exit codes, and privacy-safe finding output. They do not substitute for the real production build or Firefox smoke tests owned by later issues.

Issue #5 adds the lifecycle/privacy checks:

```powershell
node --test .\tests\window-lifecycle.test.mjs
pwsh -NoProfile -File .\tests\window-lifecycle.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\window-lifecycle.Tests.ps1
```

The real copied-Firefox and missing-module probes, including their explicit
system-access test boundary, are recorded in
`docs/research/firefox-153-window-lifecycle.md`.

Issue #6 adds the isolated-host, scanner-exception, and real Browser Toolbox
ownership checks:

```powershell
node --test .\tests\shell-hosts.test.mjs .\tests\window-lifecycle.test.mjs
pwsh -NoProfile -File .\tests\shell-hosts.Tests.ps1
pwsh -NoProfile -File .\tests\production-artifacts.Tests.ps1
node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>' `
  --browser-toolbox
```

The browser probe keeps the main connection prompt enabled, accepts it, uses
the Inspector walker, then restores temporary parent prefs and the child
Browser Toolbox profile byte-identically. Exact evidence and limitations are
in `docs/research/firefox-153-shell-hosts.md`.
