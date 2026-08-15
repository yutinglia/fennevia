# Firefox 153 Svelte Production Build

## 1. Record

- Issue: [#8](https://github.com/yutinglia/fennevia/issues/8)
- Scope: Svelte 5, TypeScript, Vite, XHTML, scoped CSS, deterministic build,
  per-window lifecycle, dependency review, and initial CI feasibility
- Firefox: 153.0.4 release, build ID `20260810162159`, release channel
- Operating system: Windows 11 25H2
- Profile: clean, unregistered, marker-owned `fennevia-dev`
- Firefox source stamp: `54be19de0e08edff0b797e55fd935dd3978b0a6d`
- Firefox source: tag `FIREFOX_153_0_4_RELEASE`, commit
  [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)
- Project baseline: issue #7 merge
  `3bd8d1cf711549fe11601bee9ccc7595898c2515`; implementation branch
  `codex/issue-8-svelte-build`; package `0.5.0-dev`
- Toolchain: nvm-managed Node.js 24.18.0, npm 11.16.0, PowerShell 7.6.4,
  and Windows PowerShell 5.1.26100.9168
- Profile state: exact installer-owned package, no unrelated loader,
  extension, policy, or chrome customization; startup cache was not cleared
- First causal errors:
  1. a shared privileged `.sys.mjs` bundle reached Svelte's browser runtime
     without a browser-window `window` global;
  2. after moving execution into the window, Svelte's default HTML fragment
     path failed in the XML/XHTML document with `TypeError: 'get nextSibling'
     called on an object that does not implement interface Node`.

## 2. Question and constraints

Can a small Svelte 5 component compile into a deterministic local artifact and
run inside stock Firefox's privileged `browser.xhtml` while preserving exact
XHTML ownership, per-window isolation, official cleanup, native UI, and the
existing fail-open health lifecycle?

The solution must not turn AutoConfig or the runtime into a generic loader. It
must add no runtime package manager, dev server, HMR client, remote dependency,
dynamic module path, content-accessible mapping, native-DOM ownership, global
CSS reset, or automatic activation. A build-host dependency is accepted only
after an exact resolved-graph, lifecycle, native-binary, license, integrity,
provenance, and artifact review.

## 3. Clean baseline and root-error isolation

The installer updated only manifest-owned files in the copied stock program and
marker-owned profile. The ordinary issue #7 matrix passed before frontend
integration. Browser Console and the external chrome harness then captured the
first frontend error rather than later host-health cleanup.

The first build exported Svelte from a privileged ESM. Firefox imported that
module once in a loader-owned global, while the compiled browser runtime
initializes from `window`, `document`, `Element`, and related DOM constructors.
The first root error therefore occurred before a component mount; adding a
polyfill or copying window globals into the shared module would have mixed
window realms and state.

The minimum next spike produced one classic IIFE and loaded its fixed local URI
into each validated owning browser window. That supplied coherent window/DOM
bindings, but the first default fragment reached `Node.nextSibling` with a value
created under HTML parsing assumptions that did not hold in Firefox's XML/XHTML
chrome document. The exact same source compiled with Svelte's maintained tree
fragment strategy mounted successfully. No startup-cache action, Firefox
override, runtime monkey patch, or compatibility branch was required.

## 4. Current source evidence

### Firefox script realm

- Firefox 153's
  [`docs/jsloader/jsloader-api.rst`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/docs/jsloader/jsloader-api.rst)
  states that `Services.scriptloader.loadSubScript` synchronously loads a
  classic script in the second parameter's global and defines loaded globals on
  the supplied object.
- [`mozIJSSubScriptLoader.idl`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/js/xpconnect/idl/mozIJSSubScriptLoader.idl)
  accepts a local privileged `chrome:` URI plus an optional target object.
- [`browser.xhtml`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser.xhtml)
  is the XML/XHTML browser-chrome document whose owning window is already
  validated by `WindowManager` and `WindowShell`.

Fennevia consequently loads only
`chrome://fennevia/content/shell/ShellApp.js`, passes the owning browser window,
and uses no options that bypass cache or select another source. A temporary
`__fenneviaRegisterShellFrontend` property accepts exactly one frozen API and
is deleted in `finally`. A private target-keyed `WeakMap` retains the API only
until disposal. This is the minimum realm adapter, not script discovery.

### Svelte DOM strategy and lifecycle

- The official
  [`svelte/compiler` reference](https://svelte.dev/docs/svelte/svelte-compiler)
  defines `fragments: "tree"` as direct element-by-element fragment creation
  instead of populating a template through `innerHTML`.
- The official [`svelte` runtime reference](https://svelte.dev/docs/svelte/svelte)
  defines `mount`, `flushSync`, `onDestroy`, and `unmount`; those are the only
  lifecycle APIs wrapped by the frontend entry.
- Vite's official [build options](https://vite.dev/config/build-options.html)
  and [production build guide](https://vite.dev/guide/build) define library
  output, CSS extraction, source-map control, and chunk configuration used by
  the production-only build.

The selected tree output still exercises a real XHTML `template` element and
its XHTML `content` child. The real harness rejects any generated element whose
namespace is not `http://www.w3.org/1999/xhtml`.

## 5. Compatibility canaries

Heads inspected on 2026-08-15:

| Project | Commit | Relevant observation |
|---|---|---|
| [Alice0775/userChrome.js](https://github.com/alice0775/userChrome.js/tree/5e146e348a56a914e6c016d29733e8ee8d468155) | `5e146e348a56a914e6c016d29733e8ee8d468155` | Current loader code remains a useful fixed-window script-realm canary, but its arbitrary script discovery, version trees, and user-script behavior are out of scope. It provides no maintained Svelte/XHTML build path. |
| [MrOtherGuy/fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig/tree/dfdab5684faffc112b76ccb1d8cab7f75da0102c) | `dfdab5684faffc112b76ccb1d8cab7f75da0102c` | Its current boot/runtime separation confirms loader-realm sensitivity, but module discovery and compatibility utilities are generic-loader baggage. It provides no Svelte integration to copy. |
| [xiaoxiaoflood/firefox-scripts](https://github.com/xiaoxiaoflood/firefox-scripts/tree/a898ac59fb0ca3886c0c46b184fdbc037c83c037) | `a898ac59fb0ca3886c0c46b184fdbc037c83c037` | Its privileged user-script facilities encounter the same window-global boundary, but RDF/manifest conversion, script metadata, and hook APIs are unnecessary. No maintained Svelte production path was found. |
| [aminomancer/uc.css.js](https://github.com/aminomancer/uc.css.js/tree/88514013ddc375f4770f4a35d8d07a91d6dd7d8f) | `88514013ddc375f4770f4a35d8d07a91d6dd7d8f` | Current privileged UI customizations remain a DOM-compatibility canary. Broad monkey patches, dynamic evaluation, and native-subtree modifications were not copied; no Svelte runtime dependency was adopted from it. |

The canaries provided negative and realm-boundary evidence only. They are not
runtime dependencies, and no third-party loader implementation was copied.

## 6. Build and styling decision

The accepted production path is:

```text
src/shell/App.svelte + TypeScript
  -> Vite library build with Svelte fragments="tree"
  -> ShellApp.js (one classic IIFE)
  -> ShellStyles.sys.mjs (one extracted CSS string)
  -> THIRD_PARTY_NOTICES.txt (bundled Svelte license)
  -> package-manifest.json exact hashes
```

`scripts/build-frontend.mjs` builds twice in distinct OS temporary directories,
requires exactly three raw and three normalized files, and compares exact bytes
before replacing only the fixed owned shell target. It removes Vite's internal
CSS marker, requires one known Svelte documentation-error slug set and converts
those inert URLs to local fixed codes, rejects any remaining runtime endpoint,
normalizes the generated notice, and prints final SHA-256 values. Vite disables
source maps, CSS/code splitting, module preload, comments, and development mode.

Svelte component CSS is selected. Every authored selector starts at
`#fennevia-shell-app-root`; theme values derive from Firefox/forced-color-safe
CSS variables inside the project host. Plain CSS, extracted component CSS, and
the existing local style attachment met the isolation requirement. Tailwind,
Preflight, Shadow DOM, a component library, and runtime stylesheet registration
would add cost without solving an observed problem and are rejected for this
milestone.

## 7. Dependency and artifact result

The accepted review is
`docs/dependency-reviews/frontend-toolchain-2026-08-15.md`; the complete
machine-readable graph is
`docs/dependency-reviews/frontend-toolchain-lock-inventory.json`.

- 12 exact development dependencies resolve to 173 lockfile package paths;
  148 install on validated Windows and 26 are optional/platform-conditioned.
- Project `ignore-scripts=true` leaves zero installed lifecycle hooks. The sole
  lock entry flagged with an install script is optional macOS-only `fsevents`.
- Rolldown and Lightning CSS each add one Windows `.node` build-host binary;
  no native, WebAssembly, package-manager, or loader file enters Firefox.
- Every registry URL is npm, every tarball has integrity, direct licenses and
  source references were checked, signatures reported zero missing/invalid,
  and npm audit reported zero known vulnerabilities at review time.
- The ten-file profile inventory includes exactly three generated shell files:

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `ShellApp.js` | 35,837 | `92338b310d522ede99955d214aae3faa5c71194cb798c10dcd2a97c8304e3da3` |
| `ShellStyles.sys.mjs` | 3,542 | `2a80d21a31bb541aca31ee4713a75087537ad42b7b0de3a375806823da3c842a` |
| `THIRD_PARTY_NOTICES.txt` | 1,200 | `0cd8b75a5e96e98009ec60de17b5536ef15d00f1b4f469a0c7189a30681ac7ea` |

The production scanner found no HMR/dev-server marker, CDN, remote font,
analytics, runtime network API, bare/dynamic import, source map, debug statement,
executable binary, unexpected chunk, or unexpected file.

## 8. Runtime, failure, and cleanup matrix

| Case | Observed result |
|---|---|
| Initial normal, second normal, and private windows | One healthy but inactive Svelte root per window; independent counter/input state; no duplicate mount |
| State, events, and conditional rendering | Counter, text input, two button handlers, event count, and conditional block updated synchronously |
| XHTML and templates | Every generated element, `template`, and first `template.content` element used the XHTML namespace and native `HTMLTemplateElement` |
| Component CSS | Extracted sheet parsed with rules; native toolbox, sidebar, popup set, Urlbar input, application-menu button, and modal-prompt styles were unchanged when toggled |
| Emergency disposal | Only the selected second window lost project hosts/state; native browser/toolbox remained |
| Direct official unmount | Zero target descendants, old root disconnected, delegated listener adds/removes balanced, and a detached button became inert |
| Remount | A fresh root mounted with reset local state and passed health again |
| Window close/runtime stop | Per-window WeakMap entry, component, listeners, style, mount target, hosts, and state markers were removed deterministically |
| Missing `ShellApp.js` | Fixed `FENNEVIA_FRONTEND_SCRIPT_LOAD_FAILED` / `shell-frontend-load`; partial project UI removed; native UI usable |
| Bundle that throws during registration/mount | Fixed frontend mount failure; partial project UI removed; native UI usable |
| Exact restoration | Original bytes and manifest-owned installation restored; ordinary cold startup passed without startup-cache clearing |
| Browser Toolbox | Inspector selected the primary project host, confirmed XHTML ownership, and found no native descendant owned by Svelte |
| Native visibility | Production remained `healthy` and never `active`; no native selector was hidden |

The throwing and missing cases are applied only by the external owned-file test
wrapper, which records and restores the exact original bytes. No installed
preference, query parameter, global switch, or runtime code path selects a
failure mode.

## 9. Validation commands and observed results

Local toolchain and static gates:

```powershell
npm ci --ignore-scripts --no-fund
npm run dependencies:audit
npm run verify
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

pwsh -NoProfile -File .\tests\firefox-frontend-recovery.Tests.ps1 `
  -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe' `
  -ProfilePath '<FENNEVIA_DEV_PROFILE>'
```

The final Node matrix reported 46 passing tests. PowerShell 7 and Windows
PowerShell 5.1 passed the applicable bootstrap, profile, artifact, identity,
host, health, lifecycle, installer, and generated-artifact checks. Both
ordinary and Browser Toolbox real-Firefox runs passed the complete expanded
matrix. The recovery wrapper passed missing and throwing bundles, restored the
installed package exactly, passed ordinary recovery, and left no Firefox test
process. No new unexpected first-party Browser Console exception was observed.

The GitHub Actions workflow runs on `windows-latest` with pinned checkout and
setup-node commits, npm scripts disabled during clean install, format, lint,
Svelte/TypeScript checks, unit tests, dependency inventory, deterministic build,
clean-tree verification, production artifact scan, and Windows PowerShell 5.1
artifact fixtures. GitHub-hosted status remains the merge gate; local execution
does not claim equivalence to that runner. `act -l` successfully listed the one
`verify` job, but the available Docker Desktop daemon is Linux while the job
requires `windows-latest` and Windows PowerShell 5.1. The job was therefore not
run under `act`; the original commands were run directly in both local
PowerShell runtimes instead.

## 10. Security, privacy, and support result

- The manifest remains exactly `content fennevia content/`; no `resource`,
  `style`, `skin`, `locale`, `override`, or content-accessible declaration is
  added.
- The component receives only a fixed normal/private label. Input and counter
  values remain in one component instance, are not persisted, and are not
  logged or passed to a process-global store.
- The one fixed local classic script is system-principal code. Its reviewed
  dependency subset and generated notice are therefore exact package artifacts;
  changing Svelte or build output requires the full upgrade review.
- Source maps and runtime endpoints are absent. The four W3C DOM namespace
  literals and XUL namespace are scanner exceptions only as exact quoted
  standards identifiers; suffixes and other URLs remain blocked.
- Native Firefox chrome, modal/security UI, commands, web content, and window
  controls remain visible and owned by Firefox. The project never activates or
  hides native UI in this issue.
- Only Windows 11 and Firefox 153.0.4 are supported by this evidence. Other
  operating systems and later Firefox stable versions require the normal update
  procedure and real test evidence.

## 11. Follow-up boundary

Issue #9 may consume the validated frontend lifecycle for the first typed
Firefox bridge. It must keep native handles and `Services` out of Svelte, use
per-window ordinary data/events, register deterministic unsubscribe behavior,
and preserve the same failure boundary. No later feature may turn the fixed
IIFE adapter into arbitrary script discovery or hide native UI before issue #15
completes its separate security and recovery matrix.
