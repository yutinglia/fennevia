# Firefox 153 Browser-Window Lifecycle Record

Issue: [#5](https://github.com/yutinglia/fennevia/issues/5)
Recorded: 2026-08-15

## Environment

- Firefox: 153.0.4 release
- Build ID: `20260810162159`
- Installed source stamp: `54be19de0e08edff0b797e55fd935dd3978b0a6d`
- Official Git mirror tag: `FIREFOX_153_0_4_RELEASE`, commit
  `c178247e1dfea52241a6b18b18cf3a00f8da935c`
- Operating system: Windows 11 25H2, build `26200.9168`
- Profile: unregistered, direct-path, marker-owned `fennevia-dev`
- Program: marker-owned copy of stock Firefox, not the system installation
- Project base commit: `e245e67b5255da0af2bbb060971a2148d6c5df90`
- Node.js: 24.18.0 from nvm-windows
- PowerShell: 7.6.4 and Windows PowerShell 5.1
- Startup cache: not cleared

Normal shared records used `<FIREFOX_PROGRAM>` and `<FENNEVIA_DEV_PROFILE>`;
no local absolute path or browsing value was copied into the issue or this
record.

## Symptom

Phase 1 imported one process entry but intentionally had no browser-window
lifecycle. Issue #5 required a mechanism that discovers already-ready and later
`browser.xhtml` windows, handles normal and private windows, excludes unrelated
chrome windows, prevents duplicate initialization, and deterministically cleans
up without growing AutoConfig into a generic loader.

The compatibility risk was concrete: broad `domwindowopened`, `load`, or
`DOMContentLoaded` hooks used by generic customization loaders have accumulated
special cases for initial documents, dialogs, delayed startup, and Firefox
startup changes. Fennevia needed the current stock-Firefox readiness boundary,
not a copied loader abstraction.

## Minimal reproduction

Before this change, importing `Bootstrap.sys.mjs` produced one successful
process result but installed no observer and managed no browser window. The
smallest acceptance probe was therefore:

1. cold-start the copied Firefox with the marker-owned profile;
2. observe one ready main browser window;
3. open and close a second normal window;
4. open and close a private window;
5. open an additional tab and prove it does not create another window runtime;
6. stop the runtime twice, then open another window and prove no callback occurs;
7. inspect only allowlisted Fennevia Console Service records and first-party
   script-error counts;
8. quit through Firefox and confirm no test process remains.

`tests/firefox-window-lifecycle.mjs` implements that probe over Firefox's own
Marionette protocol. It requires explicit absolute paths, validates the copied
Firefox and development-profile markers, binds only loopback port 2828, and
uses `--remote-allow-system-access` only for this local parent-process test.
That flag is not installed or used by production code.

## First causal evidence

There was no pre-existing runtime error to patch. The first source-backed
causal evidence was Firefox's own startup ordering:

- [`browser-init.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-init.js)
  sets `gBrowserInit.delayedStartupFinished = true`, resolves delayed startup,
  then notifies `browser-delayed-startup-finished`, with an explicit warning not
  to add work after that notification.
- [`EveryWindow.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/modules/EveryWindow.sys.mjs)
  enumerates `navigator:browser`, waits for existing windows'
  `delayedStartupPromise`, observes later
  `browser-delayed-startup-finished`, and unregisters per-window work at close.
- [`nsIWindowMediator.idl`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/xpfe/appshell/nsIWindowMediator.idl)
  defines the enumerator filter as the root `windowtype` attribute and warns
  that returned windows can already have `.closed === true`.

This established delayed browser startup—not a generic document event—as the
readiness signal. Fennevia still adds stricter identity checks and owns its own
stop/cleanup semantics.

## Sources checked

### Compatibility canaries

The following repository heads were cloned and inspected on 2026-08-15:

| Canary | Pinned revision | Relevant observation |
|---|---|---|
| Alice0775 `userChrome.js` | [`5e146e348a56a914e6c016d29733e8ee8d468155`](https://github.com/alice0775/userChrome.js/commit/5e146e348a56a914e6c016d29733e8ee8d468155) | Current-version configuration still supports broad window discovery and generic script loading; individual scripts often wait for delayed browser startup. |
| MrOtherGuy `fx-autoconfig` | [`dfdab5684faffc112b76ccb1d8cab7f75da0102c`](https://github.com/MrOtherGuy/fx-autoconfig/commit/dfdab5684faffc112b76ccb1d8cab7f75da0102c) | Uses `domwindowopened`, exact `navigator:browser` checks, `gBrowserInit.delayedStartupFinished`, and the delayed-startup topic, but also carries generic loader and dialog policy. |
| xiaoxiaoflood `firefox-scripts` | [`a898ac59fb0ca3886c0c46b184fdbc037c83c037`](https://github.com/xiaoxiaoflood/firefox-scripts/commit/a898ac59fb0ca3886c0c46b184fdbc037c83c037) | Uses a broad `chrome-document-global-created` loader; [issue #386](https://github.com/xiaoxiaoflood/firefox-scripts/issues/386) records Firefox 148 initial-document/dialog regressions and remains a warning against broad document hooks. |
| aminomancer `uc.css.js` | [`88514013ddc375f4770f4a35d8d07a91d6dd7d8f`](https://github.com/aminomancer/uc.css.js/commit/88514013ddc375f4770f4a35d8d07a91d6dd7d8f) | Current scripts commonly use the delayed-startup topic, explicit unload cleanup, and `PrivateBrowsingUtils`. |

Relevant `fx-autoconfig` history included:

- [`bec422372fdfef60961f964757277ae9c2927408`](https://github.com/MrOtherGuy/fx-autoconfig/commit/bec422372fdfef60961f964757277ae9c2927408),
  adapting to the initial uncommitted `about:blank` behavior after upstream Bug
  543435;
- [`3dfa4d88037237b0f5a4e83c4bea4d50302bcf97`](https://github.com/MrOtherGuy/fx-autoconfig/commit/3dfa4d88037237b0f5a4e83c4bea4d50302bcf97),
  separating non-browser dialogs from ready browser windows;
- [`8da9268f7a7a9ac3de4b9f4ad9ed2f447041ff83`](https://github.com/MrOtherGuy/fx-autoconfig/commit/8da9268f7a7a9ac3de4b9f4ad9ed2f447041ff83),
  adding dialog-like document handling.

No canary code was copied. These repositories were compatibility signals only.

### Official Firefox source

All implementation decisions were checked against the Firefox 153.0.4 tag:

- [`browser.xhtml`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser.xhtml)
  defines XHTML `html#main-window` with
  `windowtype="navigator:browser"`.
- [`browser-init.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-init.js)
  defines the delayed-startup ordering and notification.
- [`EveryWindow.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/modules/EveryWindow.sys.mjs)
  provides a current in-tree consumer of window enumeration, delayed startup,
  and close cleanup.
- [`PrivateBrowsingUtils.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/toolkit/modules/PrivateBrowsingUtils.sys.mjs)
  defines `isWindowPrivate()` for a chrome window through its privacy context.
- [`nsIWindowMediator.idl`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/xpfe/appshell/nsIWindowMediator.idl)
  defines `getEnumerator()` and its closed-window caveat.
- [`nsIObserverService.idl`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/xpcom/ds/nsIObserverService.idl)
  defines explicit observer registration and removal.
- [`nsIUUIDGenerator.idl`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/xpcom/base/nsIUUIDGenerator.idl)
  defines `generateUUID()` and its randomness-failure behavior.
- [`nsAppStartup.cpp`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/toolkit/components/startup/nsAppStartup.cpp)
  notifies `quit-application-granted` after shutdown is committed.
- [`Launcher.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/devtools/client/framework/browser-toolbox/Launcher.sys.mjs)
  pins the Browser Toolbox document to
  `chrome://devtools/content/framework/browser-toolbox/window.html`.
- Upstream commit
  [`967fc6d445e4e7bfc2d8df824b2e47c59b47e8f8`](https://github.com/mozilla-firefox/firefox/commit/967fc6d445e4e7bfc2d8df824b2e47c59b47e8f8)
  changed replacement of the initial `about:blank` session-history entry. This
  explains why document-timing assumptions in generic loaders required fixes;
  Fennevia does not depend on that generic path.

## Upstream change

The selected release does not expose a new stable extension API for this use
case. Its current browser startup contract is an internal sequence: browser
window construction, delayed startup completion, promise resolution, then the
`browser-delayed-startup-finished` observer topic. Initial-document and dialog
behavior has continued to change independently, which makes broad chrome-window
or DOM-event hooks a larger compatibility surface than the browser-specific
topic.

## Loader-specific baggage identified

The maintained loaders include behavior that Fennevia does not need:

- arbitrary `.uc.js` discovery and directory enumeration;
- metadata parsing and include/exclude rules;
- subscript loading, sandboxes, cache busting, and legacy script globals;
- generic handling for every chrome dialog/document;
- compatibility branches for multiple historical Firefox releases;
- user-script error policy and per-script lifecycle registries.

Fennevia has one controlled package and one runtime. None of that behavior was
adopted.

## Options considered

1. Import Firefox's `EveryWindow` module directly. Rejected because Fennevia
   needs its own process stop, cancellation context, privacy-safe identities,
   duplicate policy, and failure behavior; importing a convenience module would
   not remove those responsibilities.
2. Observe `domwindowopened` or `chrome-document-global-created`. Rejected
   because it broadens scope to dialogs and intermediate documents and repeats
   the compatibility surface seen in loader history.
3. Enumerate and poll `delayedStartupPromise` only. Rejected because a
   permanent poll or separate watcher is unnecessary when Firefox already
   publishes the completion topic.
4. Register the delayed-startup observer first, then enumerate already-ready
   `navigator:browser` windows and suppress duplicates. Selected because it
   covers the registration/enumeration race with the smallest browser-specific
   mechanism.

## Decision and minimum adaptation

The implementation consists of three fixed project modules imported by the one
Phase 1 entry:

- `Runtime.sys.mjs` owns a `Symbol.for()` process singleton, one idempotent
  `start()`/`stop()`, and `quit-application-granted` cleanup.
- `WindowManager.sys.mjs` registers the delayed-startup observer before
  enumerating existing `navigator:browser` windows. A `WeakSet` permits at most
  one initialization attempt per window.
- `Logger.sys.mjs` serializes only an allowlisted schema and redacts remote,
  local/file/UNC, opaque, and non-source URIs plus query/fragment suffixes.

A window is eligible only when all of these are true:

- it is open, top-level, and reports `isChromeWindow === true`;
- `document.documentURI` is exactly
  `chrome://browser/content/browser.xhtml`;
- the root `windowtype` is exactly `navigator:browser`;
- `gBrowserInit.delayedStartupFinished === true`.

`PrivateBrowsingUtils.isWindowPrivate()` classifies an eligible window before
initialization. Normal and private windows receive the same complete lifecycle
support in #5; neither receives a host or UI yet. Each context receives a
process-local UUID, kind, native handle confined to the runtime boundary,
`AbortSignal`, cleanup registry, and disposed-state query. Unload or runtime
stop aborts first, then runs every cleanup in reverse registration order. A
late async result can only run its returned disposer immediately; it cannot
restore state or emit a late initialized event.

No Svelte code, shell host, native-UI state, manifest declaration, resource
alias, override, runtime network call, or third-party dependency was added.

## Security and privacy effects

- The runtime is system-principal code but accepts no page-derived input in
  this issue.
- Process-global snapshots contain counts and lifecycle state only. Native
  windows remain private to runtime records and are never serialized.
- Private windows are identified only as `windowKind=private`; no private URL,
  title, tab, query, or durable identifier is logged or persisted.
- Window IDs are random UUIDs generated by Firefox's UUID service and live only
  for the current process.
- Error messages are not logged. Error class and every stack line are retained
  only after conservative redaction; a redaction failure produces a minimal
  record.
- The package inventory grew from two to five profile artifacts and advanced
  to `0.2.0-dev`; every artifact has a committed SHA-256 and passed the existing
  no-network/no-dynamic-code scanner.
- The Marionette system-access flag is test-only and requires explicit copied
  Firefox and marker-owned profile paths. It is absent from installed files.

## Validation performed

### Automated module and policy tests

Nine Node.js tests cover existing and later windows, normal/private behavior,
the exact Browser Toolbox URI and non-browser/dialog filters, delayed readiness,
duplicate topics, close during async initialization, abort and late disposer,
sync/async initializer failures, cleanup exceptions, startup rollback,
idempotent runtime shutdown, singleton failure state, and logger redaction:

```powershell
node --test .\tests\window-lifecycle.test.mjs
pwsh -NoProfile -File .\tests\window-lifecycle.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\window-lifecycle.Tests.ps1
```

All nine passed under Node.js 24.18.0; both PowerShell wrappers passed. The
bootstrap/package checks passed in both PowerShell runtimes, and the production
artifact command reported exactly five matching artifacts.

### Real Firefox lifecycle

The package installer preview and execution used the same plan SHA-256 and
applied 14 exact creates for `0.2.0-dev`. A later update preview returned
`already-current`, zero mutations, and `startupCacheAction=none`.

Six complete passing lifecycle probes were run in separate Firefox processes,
including a final run against the packaged logger hash recorded in the manifest:

```powershell
node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>'
```

Each observed:

| Case | Result |
|---|---|
| Initial browser window | Runtime state `started`, `initializationCount=1`, one managed normal window |
| Additional tab | Managed-window count remained one |
| Second normal window | Exactly one additional normal initialization; close produced one disposal |
| Private window | Exactly one private initialization; close produced one private disposal |
| Runtime stop twice | First stop disposed the remaining normal window; second state was identical |
| Window opened after stop | Managed count remained zero and no later initialization record appeared |
| Native fallback | `browser.xhtml`, `html#main-window`, and `#navigator-toolbox` remained present; `data-fennevia-active` remained absent |
| Diagnostics | One bootstrap success and runtime start per process; no runtime error-level record and no first-party Fennevia script error |
| Shutdown | Firefox graceful quit completed; no test Firefox process remained |

The Browser Toolbox's exact Firefox 153 URI and dialog/non-main identities were
exercised by strict-filter unit tests. A separately spawned interactive Browser
Toolbox GUI was not opened because its required connection approval was not
bypassed; #5 does not alter or hide DevTools UI.

### Fail-open injection

`tests/firefox-fail-open.Tests.ps1` verified the installed
`WindowManager.sys.mjs` hash, moved only that file to a unique OS-temporary
directory, launched the same copied Firefox, and restored the file in `finally`.
The result was one caught `bootstrap.fatal` at phase `entry-import`, no runtime
start/window initialization, and a usable native `browser.xhtml` with the
native toolbox still present. The file was restored byte-identically and no
Firefox process remained. The immediately following normal cold start passed
without clearing startup cache.

After all lifecycle checks, uninstall preview and execution shared one plan
SHA-256, removed the nine owned files/ownership records plus five now-empty
project directories through 14 exact operations, and again reported
`startupCacheAction=none`. The `--expect-stock` probe then observed native
`browser.xhtml` with zero Fennevia Console Service records and zero owned-file
residue. A repeat uninstall preview returned `not-installed` with zero
mutations, and no Firefox process remained.

## Remaining compatibility risk

- All lifecycle symbols and topics are unsupported Firefox internals and must
  be revalidated on each stable update.
- A forced process kill cannot execute JavaScript cleanup; operating-system
  process teardown remains the terminal cleanup in that case.
- Future async per-window initializers must honor the supplied `AbortSignal`.
  The manager can neutralize a late returned disposer but cannot undo arbitrary
  side effects performed by code that ignores cancellation and cleanup rules.
- A real interactive Browser Toolbox launch remains a manual regression check
  when #6 adds hosts or changes chrome DOM. Its current URI is already excluded
  by the exact filter.
- Only Windows and Firefox 153.0.4 release were tested. No Linux, macOS, ESR,
  Beta, Nightly, or older-release support is claimed.

## Follow-up

- Issue #6 may consume the per-window context to create isolated project-owned
  XHTML hosts; it must retain the abort/cleanup contract and native fallback.
- Issue #8 must keep these hand-authored privileged modules in the exact
  production inventory when introducing the frontend build.
- Issue #16 should run the static and Node lifecycle suites in CI; the real
  copied-Firefox probe remains an explicit local compatibility gate until a
  safe dedicated runner exists.
