<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 157 compatibility investigation

## Environment and scope

- Date: 2026-09-30/10-01; direct owner request, no separate issue supplied.
- Base: `dabff2d`, package `0.18.0-beta.1`, Windows x64.
- Local gates: nvm-windows Node `24.18.0`, npm `11.16.0`; PowerShell 7
  and the separate Windows PowerShell 5.1 fixed suite.
- Firefox 157.0 release, BuildID `20260924084938`; official source tag
  `FIREFOX_157_0_RELEASE`, commit `fdd757a2e09c9471cddf383e64e631e4ce178499`.
- A valid Mozilla-signed official Windows x64 installer was extracted locally.
  The existing development helpers created a fresh marker-owned program/profile
  pair in an isolated test root. The stock contamination check passed before
  installation: no AutoConfig, policy source, add-ons, or profile chrome.
- Owner symptom: panels have lost their background after upgrading to 157.
- This investigation does not expand published release support. Existing
  daily-use and development profiles are not the test targets.

## First causal evidence

The unchanged production package reaches active state on the clean 157 profile.
The new `--panel-style-probe` measures computed backgrounds using a detached
one-pixel canvas filled only with the computed CSS color. It never captures
website pixels. Before the fix, Nova is enabled, the inherited toolbar color
has alpha `0.2`, and all four edge panels plus the address popup have alpha
`0.16470588235294117` (8-bit rounding of `0.2 * 0.82`). The regression assertion
fails. The native variable exists; missing variables were an initial hypothesis,
not the cause of this reproduction.

Before production edits, the complete lifecycle run with `--browser-toolbox`
passes. Browser Toolbox selects the owned frame and confirms XHTML boundaries;
Browser Console collection reports no unexpected first-party script errors.
There is no JavaScript root exception or stack for this CSS compositing failure.
No extension, other customization, stale artifact, or daily-use profile is
needed to reproduce it.

## Upstream change and source review

[Bug 2069497](https://bugzilla.mozilla.org/show_bug.cgi?id=2069497), release
commit [`678e7440c53eec2b79fe3f04908b7fff623684f5`](https://github.com/mozilla-firefox/firefox/commit/678e7440c53eec2b79fe3f04908b7fff623684f5),
changes Nova's toolbar background from a box color to white at 40% in light
mode and black at 20% in dark mode. Native toolbars composite that overlay
onto their toolbox; Fennevia's independent floating panels do not have that
native backdrop. Applying the glass mix to an already translucent overlay
therefore loses the intended opacity.

Release-pinned files inspected at `fdd757a2e09c9471cddf383e64e631e4ce178499`:

- `toolkit/themes/shared/design-system/src/tokens/components/toolbar.tokens.json`
  and the upstream commit diff;
- `toolkit/themes/shared/design-system/dist/tokens-shared.css`, including
  panel, popup, toolbar, Nova, and forced-color definitions;
- `toolkit/themes/shared/design-system/src/toolbar.css` and `src/panel.css`;
- `browser/themes/shared/browser-colors.css` and native toolbar/background
  consumers in `browser/themes/shared/browser-shared.css`;
- `browser/components/urlbar/content/UrlbarInput.mjs` and `UrlbarInputBase.mjs`:
  the public element now subclasses the base implementation (Bug 2061818,
  rename commit `3f07e97356d2762f35a152a4cd6e0647ea9a2576`). The options-based
  `pickResult({ result, event, element, browserId })` and existing native
  continuation callers remain compatible with ADR-085.

Searchfox returned an inaccessible response. Official release-pinned source,
history, and canaries were inspected through `gh`; no nightly contract was
substituted for the release. No upstream theme test was run locally. The
Fennevia production CSS regression is checked in the actual release engine.

## Minimum adaptation (ADR-088)

Use a single frame-scoped `--fennevia-panel-base`, preferring Firefox's panel
color, then its toolbar color, then the existing literal light/dark fallback.
Relative `rgb(... / 1)` gives that color an opaque alpha before applying the
existing Fennevia surface/tint percentages. Both CSS defaults and the
customized-opacity path consume this base. Explicit custom colors and the
forced-colors overrides retain their existing ownership.

This deliberately updates ADR-051's toolbar-first tint mapping to a panel-first
mapping. It may slightly change the default hue on older Firefox builds; it
does not require a Firefox-major branch, Nova-pref mutation, native stylesheet
override, per-frame polling, or a second palette. The existing literal fallback
now also covers empty custom color with non-default opacity. Missing-token
coverage is preventive; the reproduced 157 cause is the changed alpha.

## Compatibility canaries

All four default branches remain `master`. Latest commits, recently updated
issues/PRs, and concrete loader/manifest or current-version files were checked.
None supplies a necessary Fennevia bootstrap adaptation.

| Canary | Previous pin (155 investigation) / current pin and date | Relevant evidence and decision |
| --- | --- | --- |
| `alice0775/userChrome.js` | `62240c77eef8eaf261f9bd07f7f5752c1b8bf9a6` / `b19a30208a8e83862b931e3b98caf39b24ff46f5`, 2026-09-18 | New `157/show_SearchBar_Histrory_Dropmarker.uc.js`; commit `67cad38f2dd49a70fab863223732ad8839b38b71` follows Bug 2068166 and `_on_mousedown` on the new search widget. This is separate-searchbar customization, not Fennevia's address popup. Loader report #101 concerns unsafe subscript handling; no such code is added. |
| `MrOtherGuy/fx-autoconfig` | unchanged `dfdab5684faffc112b76ccb1d8cab7f75da0102c`, 2026-07-23 | `profile/chrome/utils/boot.sys.mjs` still owns generic script metadata, actors, and sheets. #109's Firefox 158 menu report was resolved by updating that loader; #108 concerns update helpers. Fennevia's manifest/ESM bootstrap passes independently; none of that machinery is required. |
| `xiaoxiaoflood/firefox-scripts` | unchanged `a898ac59fb0ca3886c0c46b184fdbc037c83c037`, 2025-02-10 | `chrome/utils/chrome.manifest` retains generic content/resource mappings. #403 asks for maintained 155 loader files; the current head provides no 157-specific fix. Do not import generic-loader or security-pref workarounds. |
| `aminomancer/uc.css.js` | unchanged `88514013ddc375f4770f4a35d8d07a91d6dd7d8f`, 2026-01-06 | `utils/chrome.manifest` includes broad arrowscrollbox/tab overrides. Recent reports include #135's Nightly toolbar button and #133's split-view/tab override. These are outside Fennevia's architecture; #136 contains only a report template. No 157 adaptation is taken. |

All external implementation is reference-only. No loader, Firefox, or
`my-firefox-custom` code/assets were copied or adapted. Dependencies, notices,
lockfile, native ownership, bridge data flows, and normal logging are unchanged.
The test-only probe returns fixed case names, alpha numbers, build metadata,
and cleanup booleans. It restores its synthetic preference and owned inline
style in `finally`; no probe runs in the installed package.

## Background hover follow-up (ADR-089)

The owner additionally reports that, while another application is in the
foreground, moving the mouse over the exposed Firefox window sometimes leaves
a panel visible after the pointer exits. This is separate from Nova's colors;
there is no evidence that Firefox 157 introduced this interaction bug.

The pre-existing ADR-067 geometry exception ignores a null-`relatedTarget`
pointer-out when its coordinates remain inside a visible panel and the window
viewport. Both the owned-root and window fallback take that exception even
when Firefox is inactive. An already-background window need not receive a new
blur when the mouse leaves it. Firefox 157
[`widget/windows/nsWindow.cpp`](https://github.com/mozilla-firefox/firefox/blob/fdd757a2e09c9471cddf383e64e631e4ce178499/widget/windows/nsWindow.cpp)
handles `WM_MOUSELEAVE` by synthesizing an event position from `GetMessagePos()`;
window occlusion is not represented by the panel's rectangle. This supports
testing the in-panel/null-destination case, rather than treating geometry as
proof that the pointer still belongs to Firefox.

Before modifying the interaction code, the marker-owned 157 harness opens a
second real chrome window to own focus, hovers each original-window trigger,
waits for the reveal transition, checks that the exit point is inside the
viewport, and dispatches a synthetic in-panel/null-destination pointer-out.
All four panels remain `pointer-revealed` after 1,100 ms. Bounded event records
show capture, target, root bubble, and window bubble all delivered, with no
cancellation and the original window inactive throughout. This is a wrong
classification, not a missing event or timer assertion inferred from unit code.
An initial fixture sampled during the reveal animation and exercised an
out-of-viewport exit; it was corrected before drawing this conclusion.

The minimum production change gates the existing **window-level** geometry
exception on its existing `isChromeWindowActive` adapter. The root may still
ignore the synthetic exit, but the shared window fallback releases it using
the configured window-leave delay. Foreground noise protection, independent
focus/keyboard/popup holds, drag behavior, and focus restoration remain under
their existing owners; no blanket dismissal or new timer was added.

The final `--background-panel-probe` passes eight cases (four edges times two
activation states): background enters `pending-hide` then `hidden`, foreground
retains `pointer-revealed` for the same noise event, normal non-null in-window
exits hide in both states, and the exit never activates the background window.
Each run has a random session ID; observations contain fixed edge/phase names,
event phase numbers and booleans only. Observers are removed in `finally` and
the fixture window is closed. There is no installed probe, file/network sink,
URL/title/input capture, or synchronous I/O in event handlers.

Actual physical hover across a covering **other application**, prior-focus and
popup combinations, taskbar flashing, and the owner's intermittent sequence
remain **not run / awaiting owner confirmation**. The automated result proves
this causal path and does not establish that it covers every reported case.

## Other follow-up from Firefox 157

The [official release notes](https://www.firefox.com/en-US/firefox/157.0/releasenotes/)
and [developer notes](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/157)
were checked. Priority means the next validation focus, not an established bug.

| Priority | Area | Result / remaining work |
| --- | --- | --- |
| Fixed | Nova floating backgrounds | Confirmed regression and correction described above. |
| High | Native geometry, compact mode, refreshed sidebar | The lifecycle audit covers existing normal/second/private ownership, native reveal, resize, fullscreen, and recovery. Explicit Nova compact density, vertical tabs, sidebar expansion, high DPI, native popup anchors, and extension actions still need the interactive matrix. Do not change hide selectors speculatively. |
| High | New TLS-key-recording warning in native site information | Check discoverability through Fennevia's existing complete native Trust/identity handoff using an isolated synthetic setup. Not run. Keep the warning and all security decisions Firefox-owned; the compact custom shield is not proof that this new warning is represented. |
| High | Urlbar timing and focus | The actual 157 keyboard/pointer URL and ordinary-search execution and native search-mode handoff probes pass. Source implementation moved into `UrlbarInputBase.mjs`; no additional execution patch is needed in these rows. Selection while a page is still loading and native Tab/Shift+Tab order remain targeted manual checks. |
| Normal | Native dialogs now follow page color scheme | The [subsequent ADR-090 investigation](firefox-157-native-dialogs.md) verifies hidden chrome and restoration across eight actual native confirmation cases. Page light/dark visual coverage remains not run. |
| Normal | New suggestion regions and built-in engine changes | Keep Firefox in charge of providers and engines. No new hard-coded engine or region mapping. Representative providers and per-region policies remain unvalidated. |
| Normal | Release readiness | Run outstanding mass matrices and extracted-package/update/uninstall validation before a release or expanding tested-major metadata. This working tree is not a new published package. |
| No required migration found | New CSS `at-rule()` / overscroll `chain`, WebDriver BiDi download behavior | No consumer requires these changes. The existing harness uses Marionette; do not alter its download fixtures for an unused BiDi command. |

## Validation and reproducibility

The following use only the fresh marker-owned Firefox 157 pair:

```powershell
node tests/firefox-window-lifecycle.mjs --firefox $firefox157 --profile $profile157 --panel-style-probe
node tests/firefox-window-lifecycle.mjs --firefox $firefox157 --profile $profile157 --background-panel-probe
node tests/firefox-window-lifecycle.mjs --firefox $firefox157 --profile $profile157 --browser-toolbox
node tests/firefox-window-lifecycle.mjs --firefox $firefox157 --profile $profile157 --urlbar-suggestions-probe
npm run verify
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/run-static-powershell-tests.ps1
```

| Check | Result |
| --- | --- |
| Unchanged package on clean 157 | Expected failure: five floating backgrounds at approximately 16.5% opacity. |
| Before-fix full lifecycle / Browser Toolbox / console | Pass, no unexpected first-party script errors. |
| Corrected production panel probe | Pass, 10 cases across light/dark Fennevia schemes: defaults, customized opacity, explicit custom color, translucent native tokens, missing tokens. Each checks all four edge panels and the address popup. Default alpha is approximately 82%; custom 80% surface opacity yields the existing 70% tint. Preference and style restoration pass. These are computed-color checks, not an OS accessibility or every built-in-theme visual matrix. |
| Corrected production Urlbar probes | Pass: keyboard/pointer URL and ordinary search, native search-mode handoff, exact controller restoration, no unexpected first-party/structured errors, test engine removal. |
| Background hover production probe | Before fix: all four edges stay `pointer-revealed`; after fix: eight foreground/background cases pass, with no unexpected first-party/structured errors. Real chrome focus, synthetic pointer boundaries; cross-application physical reproduction remains pending. |
| After-fix full lifecycle / Browser Toolbox | Pass: existing/second/private windows, active/native reveal/fallback, resize/maximize/minimize/fullscreen/customize, close/stop cleanup, and no unexpected first-party script errors. |
| `npm run verify` | Pass: format, lint, typecheck, 464/464 unit tests; 88.88% lines, 81.58% branches, 95.99% functions; PowerShell 7 fixed-list suite, dependency inventory audit, deterministic build, and 14/14 production-artifact scan. |
| Windows PowerShell 5.1 fixed-list suite | Pass. |
| Development-pair uninstall and stock startup | Pass: 26 owned mutations removed; native browser UI, zero Fennevia records, and no owned-file residue. This is the development pair, not an extracted release-package validation. |
| GitHub-hosted Actions | Not run; working tree has not been pushed. |
| `act` | Not run: no workflow, Docker, or runner changes; the required job is `windows-latest` and its commands run directly on Windows. |
| Full release, earlier-Firefox comparison, performance, session-persistence, forced-colors/reduced-transparency, physical interaction, and account/device matrices | Not run; this is focused compatibility work, not release validation. |

One initial expanded test sampled preferences before the queued native observer
published them and failed `FENNEVIA_PANEL_STYLE_NOT_APPLIED`. The test now awaits
the bounded applied-style condition. Production code was not changed for that
harness timing issue. Original runtime logs and user data are not retained in
this record.

Generated output came only from `npm run build` (also run by `verify`):
`ShellApp.js` SHA-256
`d54340b7c96f01767b76d041337b1d74b942d9542cd059aaad34b45f4198a993`;
`ShellStyles.sys.mjs` SHA-256
`1ae2145385c66cd20ee6ffc1703c84b26fa3cd24204827e1d5cb799339b090a8`.
The generated bridge remains unchanged. Package version, public archive,
release tags, and installer-tested majors are unchanged.

Current README/status, plans, ADR-088/089, the internals map, security interaction
description, and the testing guide
were checked against this source change, generated manifest, the pre-existing
155 evidence/PR #121, and the executed 157 probes. No completed historical
research record was rewritten and no release milestone was declared complete.
