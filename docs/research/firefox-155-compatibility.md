<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 155 compatibility investigation

## Environment and scope

- Date: 2026-09-06; direct project-owner request, no separate issue supplied.
- Base: `f14a508`, package `0.18.0-beta.1`, branch
  `codex/firefox-155-compatibility`, Windows x64.
- Owner report and isolated reproduction: Firefox 155.0.1 release, BuildID
  `20260903215306`, source stamp `5fdfd0092780e85643e2cddc0e1b590c8b9ef860`.
- Official source: `FIREFOX_155_0_1_RELEASE`,
  `fb95137a04eb8fe1196cb12f26b100c1e060295c`; comparison:
  `FIREFOX_154_0_1_RELEASE`, `9cd094dbc3eac5df87a24e7a871e52880cb8cd42`.
- The Mozilla-signed official Windows x64 installer was extracted without
  installing it globally. The existing development helpers created a fresh
  marker-owned program/profile pair under an isolated process-local AppData
  test root. The stock contamination gate passed before package installation:
  no AutoConfig, enterprise policy, add-ons, or profile chrome. Existing
  development and registered daily-use profiles were not changed.
- This is a compatibility fix and feature audit, not a release or expansion of
  the installer support promise. Unexecuted release/manual rows remain not run.

## First causal evidence, before production changes

The unchanged production package starts, reaches healthy active state, and
projects a direct result for the fixed internal-page fixture. The existing
`--urlbar-suggestions-probe` then fails with
`FENNEVIA_FIREFOX_TEST_URLBAR_SUGGESTIONS_EXECUTION_TIMEOUT`.

The existing Browser Toolbox ownership probe passed. A temporary test-harness
wrapper around the native method, restored in `finally`, recorded only:

```json
{"argumentCount":4,"optionsResultPresent":false,"nativeArity":1,"nativePickFrame":true,"missingResult":true}
```

The native stack identifies `pickResult` in
`chrome://browser/content/urlbar/UrlbarInput.mjs`; its first failure is an
undefined `result`. The Browser Console records
`FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_EXECUTE_FAILED` in
`firefox-urlbar-suggestions-execute`, matching the owner report. The caught
bridge failure is separate from the zero unhandled first-party script errors.
No user query, result, URL, native object, or local path was emitted.

## Upstream change

[Bug 2055646](https://bugzilla.mozilla.org/show_bug.cgi?id=2055646), commit
[`daf5ed9ad12223850a33ed40a660100f594e9180`](https://github.com/mozilla-firefox/firefox/commit/daf5ed9ad12223850a33ed40a660100f594e9180),
converted `pickResult` to one options object. The preceding browser-target
refactor replaced the browser element with a browser ID. Firefox 154 accepts
`pickResult(result, event, element, browser)`; Firefox 155 accepts
`pickResult({ result, event, element, browserId })`.

The release-pinned definition, its `pickElement`/`handleNavigation` callers,
the changed `browser_handleCommand_fallback.js` tests, and the parent
controller's target resolution were inspected. Searchfox's release search
was unavailable during this investigation; exact official GitHub source and
commit history were accessed through `gh` instead.

The preceding changes are [Bug 1624579 / browser-ID
refactoring](https://github.com/mozilla-firefox/firefox/commit/f3aa7e8278bb79ab5f25598f0e0ec157a9d6065b)
and [Bug 2051959 / target-browser
resolution](https://github.com/mozilla-firefox/firefox/commit/e690ee092e8dba13d15d9caad89f5d17043f8a59).
The selected fix passes a fresh options object with the retained result,
activation event, and current selected browser's positive safe-integer ID.
The 153/154 positional contract is retained. No browser ID crosses into
frontend state, diagnostics, or persistence.

## Second reproduced regression: asynchronous search-mode continuation

After correcting the argument shape, an engine-alias SEARCH result with
`payload.providesSearchMode` returned `continued`, but Firefox's native view
opened despite the custom panel retaining ownership. A disposable probe using
Firefox's real provider result observed one matching search-mode result,
`nativeViewOpen: true`, restored controller identity, and no bridge error.
This is a distinct ownership failure, not a cascading undefined-result error.

[Bug 2060686](https://github.com/mozilla-firefox/firefox/commit/07920a5447720a9cfa097ceb9aa8380d09d07e78)
changed `maybeConfirmSearchModeFromResult` to start its follow-up query from
`#searchModeApplied.then(...)`. The release-pinned `UrlbarInput.mjs`,
`UrlbarChildController.mjs`, parent controller/proxy, and `SearchEngineStore.mjs`
were inspected. The asynchronous continuation outlives Fennevia's synchronous
controller substitution and reaches Firefox's normal view.

ADR-085 classifies `providesSearchMode` results as native handoffs on 155 and
newer. It uses the existing cancel/clear/draft-preserve/focus sequence, with no
long-lived controller substitution or reconstructed native query. Ordinary
URL and search results remain direct picks. Firefox 153/154 keep their
synchronous continuation.

The integration test initially required the native view to open immediately
on handoff. That expectation was too strong: the existing `openLocation`
contract preserved the draft, closed the custom popup, and focused Firefox's
input, with its view still closed. Firefox 155's
`UrlbarChildController.handleKeyNavigation` starts a query when Down is pressed
with the view closed. The final test exercises that native key path, selects
the engine result, and awaits Firefox's own mode and view continuation. No
production handoff behavior was changed to accommodate the test.

An additional ordinary-search check initially used an alias-plus-terms query
and timed out waiting for a direct row. The final fixture isolates ordinary
search using the existing lifecycle harness's approach: temporarily select the
test-only loopback engine as Firefox's default and enter plain fixed terms.
The actual projected SEARCH result then executes through the custom panel and
loads the expected loopback query. The prior default is restored even when
native-input cleanup fails, and the engine is removed even if default
restoration fails. Alias-mode continuation is checked separately. This does
not establish every alias/provider combination.

## Compatibility-canary review

Current heads, relevant commits, current-version files, and issues/PRs were
inspected through `gh`. These are compatibility research, not dependencies.

| Repository and exact head | Relevant evidence | Fennevia decision |
| --- | --- | --- |
| `alice0775/userChrome.js` at `62240c77eef8eaf261f9bd07f7f5752c1b8bf9a6` | The current tree has 155/156 directories. The 155 loader records the July chrome-scheme `loadSubScript` adaptation for Bug 1974213; its latest legacy searchbar fix concerns FormHistory weighting. | Fennevia already uses its dedicated chrome package and one module entry. Metadata discovery, sandbox/eval compatibility, and legacy searchbar code are irrelevant. |
| `MrOtherGuy/fx-autoconfig` at `dfdab5684faffc112b76ccb1d8cab7f75da0102c` | The current boot module includes parent-process/subframe actor targeting. Relevant reports include privileged-page lifecycle and `ownerGlobal` drift; PR #108 concerns remote update helpers. | No missing Fennevia bootstrap capability was reproduced. Do not add actors, generic injection, or update helpers. |
| `xiaoxiaoflood/firefox-scripts` at `a898ac59fb0ca3886c0c46b184fdbc037c83c037` | Issue #401 reports Firefox 155 loader failures involving unsafe subscript targets and `ownerGlobal`; related comments propose security-pref/CSP changes. The repository head has no corresponding current maintained fix. | Do not weaken security preferences or CSP. The stock-155 Fennevia bootstrap, runtime, and owned XHTML hosts pass without those workarounds. |
| `aminomancer/uc.css.js` at `88514013ddc375f4770f4a35d8d07a91d6dd7d8f` | No newer 155 execution adaptation at this head. Search-service availability reports such as #134 concern old customization assumptions. | Existing `SearchService.sys.mjs` use works in the isolated native search fixture. No loader code is imported. |

## Other Firefox changes and shell feature audit

The official [155 release notes](https://www.firefox.com/en-US/firefox/155.0/releasenotes/)
and [155.0.1 maintenance notes](https://www.firefox.com/en-US/firefox/155.0.1/releasenotes/)
were checked. In particular, 155.0.1 fixes blur/backdrop-filter-related
unresponsiveness (Bug 2068836), which is relevant to Fennevia's glass surfaces.
This investigation targets 155.0.1; it does not establish a performance result
or validate the initial 155.0 build.

The actual 154.0.1 and 155.0.1 `omni.ja` files were compared read-only,
supplemented by official source history at the release pins above.

| Area | Observed upstream change | Fennevia evidence and limit |
| --- | --- | --- |
| Bootstrap / native DOM | `browser.xhtml` tightens CSP and changes sidebar, notification, and toolbar markup. The retained toolbox/browser/sidebar/tabbox/dialog roots remain present. | Clean stock gate, package startup, active shell, Browser Toolbox ownership, native fallback, and deterministic disposal pass. No CSP, unsafe-script, or DOM-ownership relaxation. |
| Navigation and address submission | `browser-commands.js` changes the internal unsafe-paste helper import; Fennevia's command methods remain. | Back/Forward/Reload/Stop and fixed local URL/redirect/search submission pass. The separate projected-result execution failures are fixed above. |
| Tabs | `tabbrowser.js` changes its browser container from a vbox to a grid-backed box, adjusts browser/audio adoption and close behavior; native `tabs.js` changes vertical scrolling. | Fennevia does not depend on the old container tag or native tab scroller. New/select/pin/unpin/reorder/close and multi-window lifecycle probes pass. Real cross-window drag/detach, multi-select gestures, audio/device indicators, and drag scrolling are not run. |
| Trust / permissions | `browser-siteIdentity.js` is unchanged. Protections removes cookie-banner subviews; permissions moves serial-device sharing cleanup to its owner helper. | Fennevia consumes neither removed cookie-banner UI nor serial cleanup implementation. Existing bounded HTTP/HTTPS/protection/permission matrix and retained native modal access pass. Device/account/certificate prompt matrix is not run. |
| Bookmarks | PlacesUIUtils changes an internal sharing-module import; PlacesUtils adjusts an optional validator argument for `hasChildURIs`, which Fennevia does not call. | Real create/change/remove and current/new-tab opening fixtures pass; full favicon/tree/large-profile and side-swap visual matrix is not run. |
| Downloads | The extracted `Downloads.sys.mjs` and `DownloadsCommon.sys.mjs` are byte-identical across the two builds. | The native list/view progress, status, action, and cleanup fixture passes, including the private-window policy. Real malware/OS-file-safety prompts remain Firefox-owned and are not exercised. |
| Widgets and customization | CustomizableUI changes built-in placement migration, vertical-tab springs, density, and an overflow guard; Fennevia's required methods remain present. | Required capability initialization and native customize suspension/recovery pass. This does not prove every mirrored widget, extension, translation/account popup, or the full project customize editor. |
| SessionStore | The source removes the legacy statusbar chrome flag and adjusts AI-window initialization; the shell's adopted tab-restore methods remain. | Source review only for persisted-session restore. No fresh 155 session/crash/restart matrix was run. |
| Frame / window controls | Native markup and tab-container layout change as above. | Shared edge interactions, hidden-at-rest geometry, resize/maximize/minimize/restore, fullscreen/customize policies, second/private windows, and fail-open teardown pass. High-DPI, forced colors, reduced motion, first-paint timing, and assistive technology are not run. |

No additional breakage was reproduced within those executed checks. Source
inspection and required-capability presence are not substitutes for the
unexecuted interactive rows.

## Validation and reproducible commands

Both development copies came from valid Mozilla-signed official Windows x64
installers. Firefox 154.0.1 comparison BuildID is `20260824154132`. The clean
development helpers and package installer operated only on newly created
marker-owned program/profile pairs. Install/Update plans were inspected before
apply. The final generated bridge is 298,885 bytes with SHA-256
`2702eddbc00282ba55aeaf330058015bc092295ab51ababdd868aef0f8e9dc47`.

Run the following with `$firefox155`, `$profile155`, `$firefox154`, and
`$profile154` bound to the respective marker-owned development pairs. The
standard lifecycle harness does not accept ordinary user profiles.

```powershell
node --test tests/firefox-urlbar-suggestions.test.mjs
npm run verify
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/run-static-powershell-tests.ps1
node tests/firefox-window-lifecycle.mjs --firefox $firefox155 --profile $profile155 --browser-toolbox
node tests/firefox-window-lifecycle.mjs --firefox $firefox155 --profile $profile155 --urlbar-suggestions-probe
node tests/firefox-window-lifecycle.mjs --firefox $firefox154 --profile $profile154 --urlbar-suggestions-probe
```

| Check | Result |
| --- | --- |
| Untouched package on clean 155.0.1 | Expected reproduction failure: suggestion execution timeout and matching caught bridge error. |
| Focused bridge unit tests | Pass, 22/22: 154 positional execution/continuation, 155 options and current-browser targeting, invalid IDs, stale authority, errors, privacy, restoration, native mode handoff. |
| `npm run verify` | Pass, 441/441 tests; 88.78% lines, 81.48% branches, 95.79% functions; format, lint, typecheck, PowerShell 7 fixed list, dependency audit, deterministic build, 14/14 artifact scan. |
| Windows PowerShell 5.1 fixed list | Pass. |
| Final 155.0.1 full lifecycle with Browser Toolbox | Pass, including the feature and recovery rows identified above; no unexpected first-party script errors, no structured feature errors before deliberate fail-open checks. |
| Corrected 155.0.1 production suggestions | Pass: Arrow Down/Enter internal result, pointer URL and ordinary SEARCH results, exact loopback search query, exact controller restoration, hidden native view for custom execution, current three-column utility geometry, draft-preserving native search-mode continuation, default-engine restoration/test-engine removal, and zero structured/unhandled first-party errors. |
| Corrected 154.0.1 production suggestions | Pass: keyboard and pointer execution, exact controller restoration, hidden native view, current utility geometry, and zero structured/unhandled first-party errors. The new 155 mode-handoff row is explicitly not applicable. |
| GitHub-hosted CI | Not run for this unpushed working tree. Local commands match the Windows workflow; no claim of hosted CI completion. |
| `act` | Not run: no workflow/orchestration change; the job requires `windows-latest`, and its commands were run directly on Windows with both PowerShell runtimes. |
| Full release / performance / session persistence / provider / accessibility / extension-device-prompt matrices | Not run; see the row-specific limits above and `docs/testing-and-recovery.md`. |

The prior default engine is restored and the test-only search engine and
loopback server are removed in `finally`.
Temporary diagnostic wrappers, generator scripts, and their probe harnesses
were removed. No debug probe or logging was added to production. Generated
artifacts came only from `npm run build`; neither existing daily-use Firefox
nor the original development pair was updated. The package version, published
archive, release tags, and installer-tested-major warning remain unchanged.

All upstream code is reference-only. No Firefox or compatibility-canary code
is copied or adapted into Fennevia.
