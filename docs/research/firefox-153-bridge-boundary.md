# Firefox 153 Bridge Boundary

## 1. Record

- Issue: [#9](https://github.com/yutinglia/fennevia/issues/9)
- Scope: per-window Firefox context, capability checks, typed errors,
  idempotent subscriptions/disposal, opaque native-handle IDs, static
  dependency enforcement, deterministic privileged build, and fail-open
  integration
- Firefox: 153.0.4 release, build ID `20260810162159`, release channel
- Operating system: Windows 11 25H2, build `26200.9168`
- Profile: clean, unregistered, marker-owned `fennevia-dev`
- Firefox source stamp: `54be19de0e08edff0b797e55fd935dd3978b0a6d`
- Firefox source: tag `FIREFOX_153_0_4_RELEASE`, commit
  [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)
- Project baseline: issue #8 merge
  `56d0db5c5056bc13d0d8a9d5a7254a0ed5580cf5`; implementation branch
  `codex/issue-9-firefox-bridge-boundary`; package `0.5.0-dev`
- Toolchain: nvm-managed Node.js 24.18.0, npm 11.16.0, PowerShell 7.6.4,
  and Windows PowerShell 5.1.26100.9168
- Profile state: exact installer-owned package, no unrelated loader,
  extension, policy, or chrome customization; startup cache was not cleared
- First real-test failure: the first ordinary run passed bridge startup and
  window checks but the existing broad frontend listener instrumentation
  observed one unmatched registration at
  `firefox-window-lifecycle.mjs:2102`. The process and profile cleaned up. The
  assertion gained count-only diagnostics; the immediate retry, recovery
  rerun, and Browser Toolbox rerun passed with balanced listeners and no
  first-party Browser Console exception. No bridge subscription exists in #9.

## 2. Question and constraints

What is the smallest enforceable boundary that lets future tab and navigation
bridges use Firefox 153 internals while preventing Svelte and ordinary
application state from receiving native windows, tabs, browser elements,
events, controllers, principals, or other privileged objects?

The answer must use the existing per-window lifecycle and fail-open gate. It
must not add tab/navigation UI, a generic Firefox SDK, dependency-injection or
service-locator framework, historical compatibility branches, native global,
runtime network behavior, content-accessible mapping, persisted browsing data,
or native-UI hiding. Required symbols must fail visibly through #7; optional
symbols must remain explicit without leaving a half-initialized window.

## 3. Clean baseline and root-error isolation

Issue #8's installed package passed the normal, second, private, recovery, and
Browser Toolbox matrix before bridge integration. The installer then previewed
and applied six exact mutations to the marker-owned Firefox copy/profile: one
new `content/firefox` directory, one generated bridge artifact, two changed
runtime modules, and the paired ownership records. It performed no startup
cache action and touched no daily Firefox installation or registered profile.

Bridge integration reused the existing `WindowManager` context rather than
adding another observer or window-discovery path. `WindowShell` passes the exact
native window, random process-local window ID, normal/private classification,
and `Services.appinfo` version/build into the boundary. The target document's
`defaultView` must be that same window. Required capability assertion runs only
inside the existing finite health check, so a missing symbol triggers the same
failed state, reverse cleanup, and native-visible outcome as other #7 failures.

The only first real-run failure was not a bridge error or Browser Console
exception. It occurred later in issue #8's standalone Svelte remount probe,
whose temporary `EventTarget.prototype` instrumentation intentionally sees
registrations beyond the bridge. Three subsequent complete runs passed. This is
retained as a test-instrumentation watch item rather than hidden or treated as
Firefox support evidence.

## 4. Current Firefox source evidence

### Per-window `gBrowser`

- Firefox's
  [`BrowserComponents.manifest`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/BrowserComponents.manifest)
  invokes `Tabbrowser.create` in the browser-window DOMContentLoaded tabbrowser
  category and `Tabbrowser.destroy` during window unload.
- Firefox 153
  [`tabbrowser.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tabbrowser.js)
  assigns `window.gBrowser = new window.Tabbrowser()`, initializes
  `tabContainer` from `#tabbrowser-tabs`, implements `tabs` as
  `tabContainer.allTabs`, and exposes `_selectedBrowser` through
  `selectedBrowser`.
- Firefox's current
  [tabbrowser source documentation](https://searchfox.org/firefox-main/source/browser/base/content/docs/tabbrowser/index.rst)
  says `gBrowser` is defined by `tabbrowser.js`, lives in browser-window scope,
  and has one instance per browser window.

The selected minimum therefore captures one `gBrowser` through one already
validated browser window. It does not copy the object into a process-global
service or public contract.

### Tabs and events

- Firefox 153
  [`tabs.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tabs.js)
  builds `allTabs` as an array of pinned and unpinned native tabs and handles
  `TabSelect` on the tab container.
- Firefox browser tests such as
  [`browser_tab_groups.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/test/browser/tabs/browser_tab_groups.js)
  use `gBrowser.tabs`, `gBrowser.tabContainer`, and a window-level bubbling
  `TabSelect` event.

The boundary checks only that `tabs` is an array and `tabContainer` supplies
paired event-target methods. It does not inspect URL/title/tab content or
subscribe in #9. Future subscriptions must convert the native event to ordinary
data before publication and return the provided idempotent disposer.

### Selected browser and navigation presence

- Firefox 153
  [`browser-custom-element.mjs`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/toolkit/content/widgets/browser-custom-element.mjs)
  defines the native browser's `webNavigation`, `goBack`, `goForward`,
  `reload`, and `stop` surfaces.
- [`tabbrowser.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tabbrowser.js)
  forwards those operations through `selectedBrowser`.

`selectedBrowser` is required because both planned consumers need a selected
native browser. #9 performs only an optional, side-effect-free
`"webNavigation" in selectedBrowser` presence check. Issue #12 must revalidate
and promote the exact getter/actions it consumes; #9 does not call them.

## 5. Compatibility canaries

Heads inspected on 2026-08-15:

| Project | Commit | Relevant observation |
|---|---|---|
| [Alice0775/userChrome.js](https://github.com/alice0775/userChrome.js/tree/5e146e348a56a914e6c016d29733e8ee8d468155) | `5e146e348a56a914e6c016d29733e8ee8d468155` | The current note tracks Bug 2058812 non-Latin `loadSubScript` filenames. Earlier commit [`c7da520032c61086c532cb630fe59152255dfa08`](https://github.com/alice0775/userChrome.js/commit/c7da520032c61086c532cb630fe59152255dfa08) opted a generic file/jar loader into unsafe URLs for Bug 1974213. Fennevia loads a fixed ASCII private `chrome:` URI, so neither workaround applies. Direct `gBrowser` scripts and arbitrary discovery are not a typed boundary. |
| [MrOtherGuy/fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig/tree/dfdab5684faffc112b76ccb1d8cab7f75da0102c) | `dfdab5684faffc112b76ccb1d8cab7f75da0102c` | Commit [`d469a80f12e286c0e937d8b93c01dfc2d55dca8f`](https://github.com/MrOtherGuy/fx-autoconfig/commit/d469a80f12e286c0e937d8b93c01dfc2d55dca8f) adapts from renamed `ownerGlobal` to `documentGlobal`, confirming that realm/internal names change. Its loader APIs, discovery, update checking, and direct native access are generic-loader baggage. |
| [xiaoxiaoflood/firefox-scripts](https://github.com/xiaoxiaoflood/firefox-scripts/tree/a898ac59fb0ca3886c0c46b184fdbc037c83c037) | `a898ac59fb0ca3886c0c46b184fdbc037c83c037` | The current tree and open Firefox 153-era reports remain useful breakage signals, but scripts access native globals directly and provide no typed, serializable-state boundary to reuse. |
| [aminomancer/uc.css.js](https://github.com/aminomancer/uc.css.js/tree/88514013ddc375f4770f4a35d8d07a91d6dd7d8f) | `88514013ddc375f4770f4a35d8d07a91d6dd7d8f` | Current customizations are useful callers/DOM canaries but intentionally operate on `gBrowser` and Firefox-owned UI directly. No implementation was copied. |

The canaries are negative and compatibility evidence only. They are not runtime
dependencies. No third-party code, compatibility shim, update mechanism,
unsafe-URL option, script metadata, or loader abstraction entered Fennevia, so
no new third-party attribution is required.

## 6. Selected boundary

The accepted dependency path is:

```text
WindowManager per-window context
  -> WindowShell private target record
  -> generated BridgeBoundary.sys.mjs
  -> required capability assertion in #7 health

Svelte -> ordinary app/public contracts only
```

`src/firefox/bridge-boundary.ts` provides:

- exact context/document/window-kind validation and active-context exclusion;
- four required capability records for `gBrowser`, tabs, tab events, and the
  selected browser;
- one optional web-navigation-presence record;
- `FenneviaFirefoxBridgeError`, whose message is only its fixed code and whose
  non-enumerable context records phase, symbol, Firefox version/build, and
  window kind;
- a six-field ordinary diagnostic converter;
- event subscription with exact add/remove tuple and one-shot disposer;
- boundary-owned reverse disposal that attempts every cleanup;
- generic-by-type but context-scoped native-handle registries with private
  `Map`/`WeakMap` storage, stable process-local IDs, and distinct invalid,
  stale, cross-context, and disposed errors;
- frozen snapshots containing primitives, fixed strings, booleans, and counts
  only.

The opaque registry ID includes a monotonic process-local registry generation.
Consequently an old ID cannot alias the first handle of a recreated registry,
and an ID from a private or second window cannot resolve in another registry.
IDs are intentionally not persisted and make no stability promise across a
window lifecycle or Firefox restart.

`eslint.config.js` rejects `src/firefox` imports from `src/shell/` and
`src/app/`, privileged globals including `gBrowser`, `Services`, `ChromeUtils`,
`Cc`/`Ci`/`Cr`/`Cu`, Places, SessionStore, and Downloads, plus direct/computed
known Firefox-owned properties. A test invokes ESLint against deliberate shell
and app violations, so the rule is behaviorally verified rather than inspected
as text only.

## 7. Build, packaging, and diagnostics

`vite.firefox.config.ts` compiles the TypeScript source into one ESM. The build
script runs twice in separate operating-system temporary directories, requires
exactly one file each time, compares bytes, and replaces only the validated
owned `content/firefox` directory. It rejects source maps, HMR, dynamic import,
runtime network APIs, and endpoint literals.

Final generated artifact:

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `content/firefox/BridgeBoundary.sys.mjs` | 8,177 | `7eb9413ae09800e183f28a91ba1bb5bbdb483bb8f92f3e62fee301385db0e5b2` |

The complete package contains 13 manifest-owned files, 11 under the profile
package. No dependency, lockfile package, manifest mapping, source map, extra
chunk, remote endpoint, or content-accessible resource was added.

The runtime logger accepts the bridge's fixed symbol through a new
`firefoxSymbol` allowlist. The grammar rejects URL/query punctuation and local
paths. Bridge lifecycle records identify only created/ready/disposed state,
project URI, random process-local window ID, normal/private kind, and the
logger's existing Firefox version/build. Errors and snapshots never serialize
native values or browsing data.

## 8. Unit, runtime, failure, and cleanup matrix

| Case | Observed result |
|---|---|
| Required capabilities | All four current Firefox 153 symbols available in initial normal, second normal, and private windows before `healthy` |
| Optional capability absent | Pure fixture remained valid and fully initialized; optional record was explicitly false |
| Missing required capability | Typed `FENNEVIA_FIREFOX_CAPABILITY_MISSING` / `firefox-bridge-capability` with `window.gBrowser`, version `153.0.4`, build `20260810162159`, and normal kind |
| Error serialization | Direct `JSON.stringify(error)` exposed no context/cause; allowlisted diagnostic contained exactly six safe fields |
| Context duplication | Same active window with another ID and another window with the same active ID both failed; disposal permitted a deliberate replacement context |
| Normal/second/private isolation | Three distinct process-local window contexts emitted matching created/ready/disposed records; no bridge object reached frontend state |
| Subscription disposal | Direct and boundary-owned removal used the exact tuple once; double disposal returned false; native removal failure became a typed cleanup error after complete cleanup attempt |
| Opaque IDs | Same handle returned a stable ID; another registry rejected it as foreign; released ID was stale; snapshots exposed count only |
| Static boundary | Live ESLint fixtures rejected Firefox implementation import, bare global, member access, and ordinary app `Services` use |
| Missing-capability Firefox injection | Stopped before healthy, removed frontend/style/hosts/boundary, preserved native browser/toolbox, emitted no unexpected first-party error |
| Exact restoration | Restored committed bridge SHA-256, passed full normal/second/private matrix, and left no process/temp residue |
| Browser Toolbox | Inspector ownership matrix and bridge lifecycle passed with no native ownership or first-party exception regression |

The failure fixture exists only in the external marker/path/hash-validated test
wrapper. Production has no preference, debug global, query, alternate import,
or runtime switch capable of selecting it.

## 9. Validation commands and observed results

Static and package gates:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run dependencies:audit
npm run build
npm run artifacts
pwsh -NoProfile -File .\tests\bootstrap-spike.Tests.ps1
pwsh -NoProfile -File .\tests\firefox-dev-profile.Tests.ps1
pwsh -NoProfile -File .\tests\production-artifacts.Tests.ps1
pwsh -NoProfile -File .\tests\project-identity.Tests.ps1
pwsh -NoProfile -File .\tests\shell-hosts.Tests.ps1
pwsh -NoProfile -File .\tests\shell-health.Tests.ps1
pwsh -NoProfile -File .\tests\window-lifecycle.Tests.ps1
pwsh -NoProfile -File .\tests\installer.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\production-artifacts.Tests.ps1
```

Real Firefox gates:

```powershell
node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>'
node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>' `
  --browser-toolbox
pwsh -NoProfile -File .\tests\firefox-bridge-recovery.Tests.ps1 `
  -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe' `
  -ProfilePath '<FENNEVIA_DEV_PROFILE>'
```

The final local Node matrix reports 56 passing tests. PowerShell 7.6.4 and
Windows PowerShell 5.1.26100.9168 pass the applicable repository suites. The
exact production scanner reports zero findings. The ordinary Firefox matrix
passed on immediate retry and again after exact bridge restoration; the Browser
Toolbox matrix passed separately. The missing-capability run failed open with
the expected safe record. All final runs left zero Firefox process and no
unexpected first-party Browser Console exception.

`act -l` lists the Windows CI job, but the available Docker daemon is Linux and
cannot execute the `windows-latest`/Windows PowerShell 5.1 workflow faithfully.
No local `act` success is claimed. Direct local commands are precheck evidence;
GitHub-hosted Actions remain the merge gate.

## 10. Remaining risks and follow-up

- `gBrowser` and every listed member are Firefox internals, not stable public
  contracts. A later Firefox release must repeat source inspection and real
  smoke tests; no historical fallback is carried.
- The optional web-navigation probe establishes property presence only. Issue
  #12 must validate the actual selected-browser actions and promote only the
  operations it consumes.
- #9 has no production subscription or registered tab handle. Issue #10 must
  prove native-event-to-ordinary-event mapping, selection synchronization,
  handle cleanup on close/adopt, hostile title/URL handling, and stale action
  behavior.
- The first broad frontend listener instrumentation result did not reproduce in
  three subsequent complete runs. Count-only failure diagnostics are retained;
  a recurrence must be investigated before attributing it to bridge cleanup.
- Only Firefox 153.0.4 on Windows 11 has real evidence. No Linux, macOS, older,
  or later Firefox support claim is made.

A compatibility fallback may be added only after a current Firefox change is
identified, current canaries and official source are inspected, the minimum
consumer is known, and an explicit removal condition is documented. Direct
native access from shell/app code remains prohibited regardless of fallback.
