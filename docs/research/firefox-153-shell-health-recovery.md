# Firefox 153 Shell Health and Recovery

## 1. Record

- Issue: [#7](https://github.com/yutinglia/fennevia/issues/7)
- Scope: Milestone B per-window health lifecycle, finite deadline, emergency
  fallback, safe start, fatal reporting, and deterministic cleanup
- Firefox: 153.0.4 release, build ID `20260810162159`, release channel
- Operating system: Windows 11 25H2
- Profile: clean, unregistered, marker-owned `fennevia-dev`
- Firefox source: tag `FIREFOX_153_0_4_RELEASE`, commit
  [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)
- Project baseline: merge commit
  `5e49046a5920a1576a0739a713f0ca93de3fc729`; implementation branch
  `codex/issue-7-health-recovery`; package `0.4.0-dev`
- Profile state: no unrelated loader, extension, policy, or chrome
  customization; startup cache was not cleared
- First causal errors: controlled fixed-code injections described in section 8;
  there was no pre-existing Firefox regression to diagnose

## 2. Question and constraints

How can Fennevia prove a per-window shell is ready, retain a future reversible
activation gate, and recover when its own frontend or privileged bridge is
broken—without relying on the failed frontend and without hiding or deleting
Firefox's native chrome?

The issue requires six explicit states, project-prefixed root attributes, a
finite health timeout, an early safe-start mechanism, a privileged emergency
keyboard path, fixed fatal context, and exact cleanup. It explicitly forbids
automatic activation in this milestone, permanent native-hide CSS, swallowed
fatal errors, and an installed switch that can select failure injection.

## 3. Local baseline

Issue #6 already proved three project-owned XHTML hosts in each normal/private
browser window while the navigator toolbox, browser, tabbox, modal dialog,
content hit target, Windows close control, and Browser Toolbox remained native.
`WindowManager` already accepts asynchronous initialization, aborts before
reverse cleanup, neutralizes late completion, and initializes each window once.

AutoConfig already evaluated these gates before manifest lookup:

```js
Services.appinfo.inSafeMode ||
  Services.prefs.getBoolPref("fennevia.safeStart", false)
```

Therefore issue #7 did not add a second sentinel or move recovery into the
frontend. It retained and tested the existing earlier boundary.

## 4. Current Firefox source evidence

### Privileged event group

- [`dom/webidl/EventTarget.webidl`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/dom/webidl/EventTarget.webidl)
  exposes `mozSystemGroup` only to chrome/UA callers.
- DevTools [`node-picker.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/devtools/server/actors/inspector/node-picker.js)
  documents why a default-group handler runs before a system-group handler.
- Browser [`spotlight.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/spotlight.js)
  registers and removes a capture/system-group listener with matching options.

The minimum adaptation is one `keydown` listener on the privileged browser
window with frozen `{ capture: true, mozSystemGroup: true }` options. It is not
a claim that the handler precedes every Firefox default-group handler; the
system group is valuable because ordinary propagation cancellation does not
own it. The fallback remains synchronous and idempotent.

### Binding selection

Firefox [`DevToolsStartup.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/devtools/startup/DevToolsStartup.sys.mjs)
defines unmodified F12 as the stock toolbox shortcut. No stock source inspected
for this release defines `Ctrl+Alt+Shift+F12`. Firefox's user-customizable
shortcut support means absence from stock is not proof against every local
collision. Fennevia therefore records the binding as Windows-tested and rejects
events unless F12, Ctrl, Alt, and Shift are all present and Meta is absent.

### Native real-test input

[`nsIDOMWindowUtils.idl`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/dom/interfaces/base/nsIDOMWindowUtils.idl)
defines the chrome-only asynchronous `sendNativeKeyEvent()` test input, its
`nsISynthesizedEventCallback.onCompleteDispatch()` completion, and native left
Shift/Control/Alt flags. Mozilla's CC0 test helpers define:

- Windows F12 as `0x0058007b` in
  [`NativeKeyCodes.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/testing/mochitest/tests/SimpleTest/NativeKeyCodes.js);
- US Windows layout as `0x00000409` in
  [`EventUtils.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/testing/mochitest/tests/SimpleTest/EventUtils.js).

Those constants and the API are used only by the external Firefox harness. The
installed runtime does not synthesize input or import Mozilla test code.

## 5. Compatibility canaries

Heads inspected on 2026-08-15:

| Project | Commit | Relevant observation |
|---|---|---|
| [Alice0775/userChrome.js](https://github.com/alice0775/userChrome.js/tree/5e146e348a56a914e6c016d29733e8ee8d468155) | `5e146e348a56a914e6c016d29733e8ee8d468155` | Current-version `install_folder/config.js` skips loader startup in Firefox safe mode. Its script scanning and historical-version trees are generic-loader baggage. |
| [MrOtherGuy/fx-autoconfig](https://github.com/MrOtherGuy/fx-autoconfig/tree/dfdab5684faffc112b76ccb1d8cab7f75da0102c) | `dfdab5684faffc112b76ccb1d8cab7f75da0102c` | `profile/chrome/utils/boot.sys.mjs` stops its loader in safe mode. Module discovery, user-script APIs, and compatibility machinery are out of scope. |
| [xiaoxiaoflood/firefox-scripts](https://github.com/xiaoxiaoflood/firefox-scripts/tree/a898ac59fb0ca3886c0c46b184fdbc037c83c037) | `a898ac59fb0ca3886c0c46b184fdbc037c83c037` | `chrome/utils/userChrome.jsm` has a safe-mode guard. RDF/manifest conversion, arbitrary scripts, and hook utilities are not needed. |
| [aminomancer/uc.css.js](https://github.com/aminomancer/uc.css.js/tree/88514013ddc375f4770f4a35d8d07a91d6dd7d8f) | `88514013ddc375f4770f4a35d8d07a91d6dd7d8f` | Current scripts use `mozSystemGroup` in privileged UI code, confirming it remains a live compatibility signal. Its broad UI monkey patches and `eval`-based adaptations were not copied. |

The canaries confirm two narrow ideas—skip privileged customization in safe
mode and use the privileged system event group where needed. None provides the
project-specific lifecycle, and none is a runtime dependency.

## 6. Options and decision

### Recovery owner

1. A Svelte button or store was rejected because a broken bundle, mount, event
   graph, or CSS could disable the recovery surface.
2. A Firefox command/key element was rejected for this milestone because it
   would add native DOM ownership and still needs independent registration and
   cleanup.
3. A minimal privileged window listener was selected. It is installed before
   mount, included in health, and disposed by the same per-window cleanup stack.

### State representation

One module owns the transition table and exact root attributes:

```text
created -> mounted -> healthy -> active
    \          \          \        \
     +----------+----------+-------> failed

created/mounted/healthy/active/failed -> disposed
```

`created`, `mounted`, `healthy`, and `active` have cumulative markers. `failed`
is exclusive and always removes `data-fennevia-active` first. `disposed` is not
left in the DOM; every project state attribute is removed. A same-state request
is idempotent, while skipping or reversing a transition fails open.

### Health contract

The default deadline is 2,000 ms and cannot exceed 30 seconds through the
constructor contract. Health requires:

1. exact primary/sidebar/overlay object identity and parents;
2. source-backed placement relative to retained Firefox anchors;
3. hidden sidebar plus hidden/inert overlay;
4. only XHTML elements inside every project host;
5. the exact inline project style below the primary host and at least one parsed
   CSS rule;
6. a currently registered emergency handler;
7. every fixed-name capability result to be boolean and available;
8. a literal `true` final health result.

The current diagnostic itself is the mount contract. Issue #8 may replace that
mount collaborator with Svelte without changing the lifecycle. Production does
not call `activate`; issue #15 remains responsible for native-hide CSS and its
larger fullscreen/customize/security-UI matrix.

## 7. Failure, logging, and cleanup

All lifecycle errors carry a fixed `FENNEVIA_*` code and phase. Existing host
errors retain their fixed allowlisted DOM path. Missing capabilities add only a
validated stable name plus `available=false`. `Logger.sys.mjs` adds the fixed
shell-state enum; its existing allowlist supplies Firefox version/build,
process-local opaque window ID, normal/private kind, project URI, and a
URL/path-redacted stack. Error messages, event objects, native handles, browsing
URLs/titles/queries, profile paths, and private browsing state are not emitted.

Cleanup is a per-window reverse stack. It aborts the health signal, removes the
context abort listener, unmounts partial UI callbacks, removes the emergency
listener, clears root markers, and removes exact host references. Every
disposer is idempotent. Disposing while health is pending resolves as a neutral
cancellation; a late result cannot restore `healthy` or hosts. Emergency
fallback records `failed` before complete disposal, so no active marker remains
even if later native-hide CSS exists.

## 8. Failure matrix

| Injection | Required observation |
|---|---|
| Second host insertion throws | First host rolled back; fixed failed DOM path; no state/listener remains |
| Mount callback registers partial UI then throws | Partial cleanup once; all hosts/attributes/listener removed |
| Health callback returns false or a non-boolean | Fixed failure; no activation; complete cleanup |
| Health callback never settles | `FENNEVIA_SHELL_HEALTH_TIMEOUT` at the finite deadline; health signal aborted |
| Project style removed or has no parsed rules | Stylesheet-specific failure before healthy |
| Required capability unavailable | Fixed capability name and false result only; complete fallback |
| Illegal or duplicate transition | Illegal request enters failed; duplicates are idempotent |
| Emergency in mounted, healthy, or active | Active removed; that lifecycle disposed exactly once |
| Disposal while health is pending | Timer/listener/hosts/state removed once; late completion is inert |
| Safe start with complete package | One early skipped record; zero runtime/window/shell initialization |
| Safe start with missing health module | Same result because no manifest or ESM access occurs |

Unit failure selection is constructor input to the test target. The installed
`initializeWindowShell` passes only fixed production defaults. There is no
`fennevia.*fail` preference, global debug hook, DOM toggle, dynamic import,
network endpoint, or arbitrary script loader in production artifacts.

## 9. Validation

Local commands:

```powershell
node --test .\tests\health-state.test.mjs .\tests\safe-start.test.mjs `
  .\tests\shell-hosts.test.mjs .\tests\window-lifecycle.test.mjs
pwsh -NoProfile -File .\tests\shell-health.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\shell-health.Tests.ps1
pwsh -NoProfile -File .\tests\shell-hosts.Tests.ps1
pwsh -NoProfile -File .\tests\window-lifecycle.Tests.ps1
pwsh -NoProfile -File .\tests\bootstrap-spike.Tests.ps1
pwsh -NoProfile -File .\tests\production-artifacts.Tests.ps1
pwsh -NoProfile -File .\tests\installer.Tests.ps1
pwsh -NoProfile -File .\scripts\check-production-artifacts.ps1 `
  -ArtifactRoot .\profile\chrome\fennevia `
  -InventoryPath .\package-manifest.json
```

Real Firefox commands:

```powershell
node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>'

pwsh -NoProfile -File .\tests\firefox-shell-recovery.Tests.ps1 `
  -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe' `
  -ProfilePath '<FENNEVIA_DEV_PROFILE>'
```

The real harness requires healthy-but-inactive roots for initial, second, and
private windows. In the second normal window it synthesizes the native chord,
requires exact project cleanup while native browser/toolbox remain, and then
proves the original normal window remains healthy. It still tests a changed
tabbox insertion point, runtime stop, post-stop exclusion, and privacy-safe
Browser Console output. The recovery wrapper additionally proves complete and
broken-package safe start, exact module restoration, ordinary-start recovery,
`prefs.js` reset to false, and zero remaining Firefox process.

Observed results:

- Node.js 24.18.0 reported 41 passing tests when all four Node files ran
  together; the focused shell-health wrapper reported 32 including subtests.
- PowerShell 7.6.4 and Windows PowerShell 5.1.26100.9168 both passed the
  bootstrap, development-profile, artifact, identity, shell-host, shell-health,
  lifecycle, and installer suites. The installer suite passed update rollback,
  permission failure, hard disable, uninstall, and unsafe-target cases.
- The exact production scan passed all seven artifacts. Updating the owned
  installed package to `0.4.0-dev` used one reviewed plan digest, added the
  HealthState module, replaced changed modules/manifests, and took no startup
  cache action. A follow-up source correction used a second exact four-operation
  update with matching preview/execution digest.
- The ordinary Firefox harness passed. Initial, second, and private windows were
  healthy but inactive; native Ctrl+Alt+Shift+F12 disposed only the second
  window's project state; the original window remained healthy; changed-tabbox
  injection retained the fixed DOM path; runtime stop/post-stop exclusion and
  Browser Console checks passed.
- The Browser Toolbox variant passed and selected the primary host in Inspector
  while proving native nodes remained outside all project hosts. Its temporary
  debugger state and child process were cleaned as in issue #6.
- The recovery wrapper passed safe start with the complete package and with the
  hash-verified HealthState module absent. It then restored the module
  byte-identically, restored `user.js`, ran the full ordinary matrix, asserted
  safe start disabled, and left zero Firefox process.

Two first-run test findings were corrected before this final matrix. The DOM
probe initially classified the new style ID as a fourth host because its
selector used a broad prefix; the runtime was healthy and the probe now checks
the three exact host IDs. The later changed-tabbox injection exposed a real
null-guard error in failure reporting: an absent pre-health controller could
enter its cleanup branch. Requiring a present controller removed the secondary
cleanup error while preserving the original fixed host failure. A regression
assertion now requires zero cleanup error for pre-health host failures.

## 10. Security and support result

- No dependency or lockfile changed.
- The Chrome manifest remains exactly `content fennevia content/`; no resource,
  style, override, locale, skin, or content-accessible mapping was added.
- The exact package grows from six to seven profile artifacts by adding only
  `HealthState.sys.mjs`; every file has a committed SHA-256.
- No runtime network API, remote endpoint, dynamic code, dynamic import, source
  map, native binary, or executable download was added.
- Normal/private windows have independent in-memory state/listeners and no
  persisted browsing data.
- Native browser chrome and security-sensitive UI remain fully visible because
  production never enters active in this milestone.
- Only Windows 11 and Firefox 153.0.4 are supported by this evidence. The
  emergency binding and native test constants must be revalidated for another
  operating system or Firefox stable.
- No third-party production code was copied. The external harness records and
  directly attributes Mozilla's CC0 native-test constants.

## 11. Follow-up boundary

Issue #8 may consume the mount and health collaborators for the Svelte/Vite
spike. It must not add an alternate state owner or auto-activate. Bridge issues
must supply fixed capability vectors without exposing native handles. Issue #15
alone may add `data-fennevia-active`-gated native-hide CSS after custom controls,
fullscreen, customize mode, Browser Toolbox, emergency fallback, safe start,
missing CSS/bundle/capability, and native security UI all pass together.
