<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 157 independent native dialogs

Date: 2026-10-01. Direct owner follow-up to the
[157 compatibility investigation](firefox-157-compatibility.md); no issue number
was supplied. The owner reports that native chrome appears for confirmations
such as unsaved-tab close and sometimes stays visible afterward, and explicitly
requests keeping it hidden while the popup is open. ADR-090 records this narrow
policy refinement. Native prompt ownership and failure recovery remain intact.

## Environment and evidence boundary

- Windows x64, stock Firefox 157.0, release channel, BuildID `20260924084938`.
- Fennevia `0.18.0-beta.1` working tree on
  `codex/firefox-157-panel-background`, base
  `dabff2d816335aa29bda7ef6c42c111115001456`; not a published package.
- Fresh marker-owned development profile and copied stock program, populated
  through the validated package installer. Installed hashes were checked by
  the harness. No daily profile, unrelated extension, or customization used.
- Node 24.18.0/npm 11.16.0 from the installed nvm-windows version, selected only
  in the command environment. The host's global Node selection is unchanged.
- No first causal script exception was observed in the successful probe. The
  evidence is a controller-state divergence, not a fabricated exception stack.
  The original intermittent physical/user-site sequence remains unconfirmed.

## Upstream and current implementation

All Firefox source below is pinned to release commit
`fdd757a2e09c9471cddf383e64e631e4ce178499`:

| Source | Relevant behavior |
| --- | --- |
| [`browser/base/content/browser.xhtml`](https://github.com/mozilla-firefox/firefox/blob/fdd757a2e09c9471cddf383e64e631e4ce178499/browser/base/content/browser.xhtml) | The HTML `#window-modal-dialog` and native dialog frames are outside the hidden toolbox. |
| [`browser/base/content/browser.js`](https://github.com/mozilla-firefox/firefox/blob/fdd757a2e09c9471cddf383e64e631e4ce178499/browser/base/content/browser.js) | `gDialogBox` uses `showModal()` and asynchronous close cleanup; `TabDialogBox` marks its browser with `tabDialogShowing` while dialogs exist. The root modal attribute can outlive the actual HTML dialog. |
| [`toolkit/components/prompts/src/Prompter.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/fdd757a2e09c9471cddf383e64e631e4ce178499/toolkit/components/prompts/src/Prompter.sys.mjs) | Internal-window prompts require a chrome browsing context with `gDialogBox`; passing a content context can fall back to a separate OS window. The fixture uses the correct native context. |
| [`toolkit/components/windowwatcher/nsIPromptService.idl`](https://github.com/mozilla-firefox/firefox/blob/fdd757a2e09c9471cddf383e64e631e4ce178499/toolkit/components/windowwatcher/nsIPromptService.idl) | `asyncConfirm` returns a property bag identifying the native confirmation result. |
| [`toolkit/components/prompts/content/commonDialog.js`](https://github.com/mozilla-firefox/firefox/blob/fdd757a2e09c9471cddf383e64e631e4ce178499/toolkit/components/prompts/content/commonDialog.js) and [`commonDialog.xhtml`](https://github.com/mozilla-firefox/firefox/blob/fdd757a2e09c9471cddf383e64e631e4ce178499/toolkit/components/prompts/content/commonDialog.xhtml) | Native dialog accept/cancel events execute the actual prompt actions. The test waits for enabled native buttons. |
| [`browser/components/tabbrowser/Tabbrowser.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/fdd757a2e09c9471cddf383e64e631e4ce178499/browser/components/tabbrowser/Tabbrowser.sys.mjs) | Normal tab removal calls `permitUnload()`, which spins a nested event loop. The fixture schedules that real close and operates the resulting native prompt. |
| [`modules/libpref/init/StaticPrefList.yaml`](https://github.com/mozilla-firefox/firefox/blob/fdd757a2e09c9471cddf383e64e631e4ce178499/modules/libpref/init/StaticPrefList.yaml) and [`remote/marionette/driver.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/fdd757a2e09c9471cddf383e64e631e4ce178499/remote/marionette/driver.sys.mjs) | Test-only gesture prerequisite and prompt/session handling; no production preference or driver dependency is introduced. |

The general 157 record contains the current four-canary commit/issue review
and unavailable Searchfox attempt. Official release source supplied the needed
dialog behavior; no canary patch was applicable or copied. There is no evidence
that Firefox 157 introduced the stale focus-hold bug. No external source,
loader behavior, or `my-firefox-custom` implementation was copied or adapted.

Before this change, `NativeUi.updateSuspension()` exposed the original toolbar
for a known dialog. The unchanged-package real fixture observed visible chrome
for the first tab confirmation and both internal-window confirmations; some
subsequent tab/content samples were already hidden. All clean-fixture closes
recovered, so this is not evidence reproducing the owner's intermittent stick.

A focused controller fixture reproduced a concrete causal order: native
`focusin` arrives while the dialog is still open; close then removes suspension
without clearing the newly acquired `focusHeld`. The new regression assertion
failed before the correction (`revealed: true`, expected `false`) and passes
after it. This supports the correction while leaving physical reproduction
and other possible event orders as explicit limits.

## Selected change and boundaries

The existing per-window NativeUi controller distinguishes dialog interaction
suppression from exposing native chrome. Known independent HTML window and
tab/content dialogs retain the healthy resting layout. WindowShell still
suppresses custom surfaces for their entire lifetime. No native dialog node,
focus action, button, security delay, prompt decision, or notification anchor
is replaced or altered.

Entry records whether native UI was already intentionally revealed or a native
sidebar was open. Such access retains complete native fallback. Unknown modal
state, customize mode, DOM fullscreen, and health failure also retain fallback.
Dialog-time focus cannot acquire a new native hold; queued native handoff
callbacks are cancelled. Close may restore only a previously intentional native
focus hold that is still current. A failed controller cannot have its fallback
cleared by later dialog events. There is no new controller, listener, observer,
timer, production preference, dependency, data flow, or logging.

## Executed fixture and reproducibility

`tests/firefox-native-dialog-probe.mjs` is a test-only mode of the existing
marker-owned lifecycle harness. Six cases invoke real native confirmations:
tab, content, and internal-window, each with accept and cancel. Two more create
a synthetic beforeunload tab and execute normal tab removal. Cancellation keeps
the tab; acceptance closes it. The exact created fixture tab may skip a second
prompt only during cleanup. The observed normal close never skips permission.

The beforeunload fixture temporarily sets
`dom.require_user_interaction_for_beforeunload=false` and restores the exact
prior value and user-value presence in `finally`. Native button security timing
is awaited. An ignored unhandled-prompt policy plus a BiDi-capable test session
keeps Marionette from autoaccepting beforeunload. Existing commands still use
Marionette. These are isolated harness settings, not shipped browser defaults.

Prompt opening interrupts an outstanding Marionette script response, so the
fixture runs asynchronously. A random console prefix carries only bounded
stages, fixed kind/action names, booleans, and allowlisted error codes. No prompt
text, URL, title, input, focus ID, browser object, or window-global hook crosses
the boundary. No probe is installed in production.

```powershell
# Prepend the already installed nvm-managed version only for this shell.
$env:PATH = (Join-Path $env:NVM_HOME 'v24.18.0') + ';' + $env:PATH
node --test tests/native-ui.test.mjs
node tests/firefox-window-lifecycle.mjs --firefox $firefox157 --profile $profile157 --native-dialog-probe
node tests/firefox-window-lifecycle.mjs --firefox $firefox157 --profile $profile157 --browser-toolbox
npm run verify
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/run-static-powershell-tests.ps1
# After exact package uninstall:
node tests/firefox-window-lifecycle.mjs --firefox $firefox157 --profile $profile157 --expect-stock
```

| Check | Result |
| --- | --- |
| NativeUi unit suite | Pass, 24/24, including the previously failing modal focus sequence, intentional native access/queued callback cleanup, and failure during a tab dialog. |
| Real native dialog probe | Pass, 8/8. Every open sample has hidden toolbox, suppressed custom surfaces, and visible native buttons. Both actions yield the expected result. Every close clears modal/suspension/reveal state and resumes the shell. Beforeunload preference restoration passes. No unexpected first-party or structured errors; clean shutdown. |
| Full lifecycle / Browser Toolbox | Pass: existing/second/private windows, XHTML ownership, content-only activation, native reveal/fallback, resize/maximize/minimize/fullscreen/customize, close/stop disposal, and no unexpected first-party script errors. |
| Ordinary local gate | Pass: format, lint, typecheck, 467/467 unit tests; 88.88% lines, 81.58% branches, 95.99% functions; PowerShell 7 fixed-list suite, dependency inventory audit, deterministic build, and 14/14 production-artifact scan. The first attempt stopped on an unnecessary escape in test fixture HTML; removing that escape leaves the evaluated fixture unchanged, and the complete rerun passes. |
| Windows PowerShell 5.1 fixed-list suite | Pass. |
| Development-pair uninstall / stock startup / marker cleanup | Pass: native browser UI, zero Fennevia records or owned-file residue after uninstall. Both marker-owned development profile and program copy were removed through the validated project helpers. No daily profile was changed. |
| GitHub-hosted Actions | Not run; working tree is not pushed. |
| `act` | Not run: no CI/runner/Docker changes; the Windows job commands run directly on Windows. |
| Physical user-site sequence, light/dark page dialog visuals, keyboard/screen reader, OS-level prompts, permission/provider matrix, high DPI, full release matrix | Not run. The eight native cases do not establish these broader claims. |

Initial fixture iterations corrected the internal-window context, prompt-driver
autoaccept behavior, and synchronous tab-close test deadlock using the pinned
upstream contracts. Those were harness issues, not additional speculative
production fixes. Public package, version, supported/tested-major metadata,
dependency lockfile, and third-party notices remain unchanged.

The verified runtime source `NativeUi.sys.mjs` SHA-256 is
`8b154cb68931cd111a4fbdb16915777f629063fff7156873ee5c7806bc3bef69`.
The package manifest is synchronized only through `npm run build`; frontend
and bridge artifacts retain the preceding 157 compatibility change's hashes.
README, current status, plans, ADR-032's supersession note/ADR-090, native
internals, security policy, and testing guide were checked against this source
and the executed fixtures. No release milestone is declared complete.
