# Firefox 153 compact address launcher and popup research

## Environment

- Date: 2026-08-16
- Firefox version: 153.0.4 release
- Build ID: `20260810162159`
- Channel: release
- Operating system: Windows 11 Pro 25H2, build `26200.9168`
- Profile: marker-owned `fennevia-dev`
- Program: marker-owned copy of the stock Firefox installation
- Project base commit: `a00942afa7246e2ac2f62caa0492f97efee33f19`
  plus the issue #13 worktree
- Package: `0.7.0-dev`
- Official GitHub tag: `FIREFOX_153_0_4_RELEASE` at
  [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)

Only this Firefox release and Windows environment were validated. This record
makes no Linux, macOS, ESR, Beta, Nightly, touch, or later-release support
claim.

## Goal and refined product decision

Issue #13 originally described an editable field inside the left edge. The
owner refinement on 2026-08-16 supersedes that presentation:

- the left surface contains a short, non-editable address launcher above the
  vertical tabs;
- the launcher always includes compact, real Firefox connection/HTTPS and
  Enhanced Tracking Protection status;
- activating it or healthy-shell `Ctrl+L` opens one centered Fennevia-owned
  address/search popup;
- the popup is the sole editable custom address field and shows fuller text for
  the same two Firefox states;
- Firefox continues to own URL fixup/search submission, the native identity and
  protections panels, permissions, page actions, prompts, and security UI.

Issue #37 owns fuller permissions/page-actions coverage. Issue #13 does not
invent a partial generic Urlbar-item model or move Firefox-owned panel DOM.

## Minimal reproduction

1. Build and install the exact package into the marker-owned copied Firefox
   program and profile.
2. Confirm the hidden-at-rest left edge contains one button, no editable field,
   a bounded committed location, and compact connection/protection badges.
3. Open the centered popup from the launcher and from `Ctrl+L`; verify one
   selected input and two detailed status rows.
4. Submit a loopback URL, host-like value, and test-only ordinary search; verify
   Firefox's Urlbar performs the navigation.
5. Exercise invalid, empty, executable-scheme, and over-length input, Escape,
   focus restoration, background navigation, selected-tab changes, and popup
   suppression of all four edge surfaces.
6. Compare project status with `gIdentityHandler` and `gProtectionsHandler` on
   secure, insecure, internal, and non-handleable pages.
7. Repeat normal, second-normal, private, unmount/remount, disposal, emergency
   fallback, capability failure, frontend failure, and Browser Toolbox runs.

The navigation/search/slow-page endpoints used by the harness bind only an
ephemeral `127.0.0.1` port and serve fixed inert test data. The temporary search
engine is restored and removed in `finally`; no test query is sent externally.

## First causal evidence

- The first real startup failed health because the initial protection shape
  required `gProtectionsHandler.anyBlocking` immediately. Current Firefox sets
  `anyDetected`, `anyBlocking`, and `hasException` from
  `onContentBlockingEvent`, and the handler first returns when
  `ContentBlockingAllowList.canHandle(browser)` is false. Those booleans may
  therefore be absent during startup or on non-handleable pages. The minimum
  fix requires the source-backed callback as the capability, checks
  `canHandle` first, and reports `unavailable` while current booleans are not
  established. Native UI stayed visible during the failed attempt.
- An early real search smoke waited for an observer that did not establish the
  submitted query's final destination. The test now creates a temporary local
  Firefox search engine through SearchService, points it to loopback, restores
  the prior default, and removes it deterministically. Production still calls
  only `gURLBar.handleCommand()`.
- A harness-only loading check set a synthetic tab `busy` attribute, which
  Firefox immediately reconciled away. A delayed loopback response now provides
  real network state. Phase-specific state and recent-event assertions also
  replaced late exact-count checks after navigation events legitimately evicted
  early lifecycle records from Firefox's Console ring buffer.

No startup-cache action was required.

## Current Firefox source checked

- [`UrlbarInput.mjs`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/urlbar/content/UrlbarInput.mjs)
  (blob `23a4e5c9be70131550b4bfd6fa3e60a500f1e88d`): `handleCommand()` routes through
  current Urlbar navigation, including fixup/search, load parameters, triggering
  principal policy, and `_loadURL`. Fennevia sets the native value and invokes
  this method rather than implementing `loadURI` policy.
- [`browser-sets.inc.xhtml`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-sets.inc.xhtml),
  [`browser-sets.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-sets.js),
  and [`browser.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser.js): the `focusURLBar` key
  invokes `Browser:OpenLocation`; `openLocation(event)` selects and opens the
  current native Urlbar. Fennevia intercepts only while its per-window health
  marker is present and a custom subscriber accepts the request. Otherwise the
  event continues to Firefox unchanged.
- [`browser-siteIdentity.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-siteIdentity.js)
  (blob `c6d060853cd3dab9d5c02bdc8de707b8fbde4b6d`):
  `getConnectionSecurityInformation()` returns the current fixed connection
  classification used by the project mapping.
- [`browser-siteProtections.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-siteProtections.js)
  (blob `b99b442344d3164ea6ef9551455db8a54e61922e`):
  `onContentBlockingEvent` updates `anyDetected`, `anyBlocking`, and
  `hasException` only after handleability is established.
- [`ContentBlockingAllowList.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/toolkit/components/antitracking/ContentBlockingAllowList.sys.mjs):
  `canHandle(browser)` excludes schemes/principals for which protections state
  is not meaningful and retains Firefox's normal/private permission policy.
- [`SearchService.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/toolkit/components/search/SearchService.sys.mjs)
  and [`UserSearchEngine.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/toolkit/components/search/UserSearchEngine.sys.mjs):
  used only by the external real-Firefox test to install and remove its local
  `{searchTerms}` engine. They are not production dependencies.

Every adopted Firefox symbol is isolated in `src/firefox/navigation.ts` and is
revalidated at runtime.

## Compatibility canaries

The current heads checked on 2026-08-16 were:

- Alice0775/userChrome.js
  [`5e146e348a56a914e6c016d29733e8ee8d468155`](https://github.com/alice0775/userChrome.js/commit/5e146e348a56a914e6c016d29733e8ee8d468155)
- MrOtherGuy/fx-autoconfig
  [`dfdab5684faffc112b76ccb1d8cab7f75da0102c`](https://github.com/MrOtherGuy/fx-autoconfig/commit/dfdab5684faffc112b76ccb1d8cab7f75da0102c)
- xiaoxiaoflood/firefox-scripts
  [`a898ac59fb0ca3886c0c46b184fdbc037c83c037`](https://github.com/xiaoxiaoflood/firefox-scripts/commit/a898ac59fb0ca3886c0c46b184fdbc037c83c037)
- aminomancer/uc.css.js
  [`88514013ddc375f4770f4a35d8d07a91d6dd7d8f`](https://github.com/aminomancer/uc.css.js/commit/88514013ddc375f4770f4a35d8d07a91d6dd7d8f)

They remain startup and listener-cleanup compatibility signals. Review found no
current address/security adaptation that should be copied. Generic script
discovery, metadata, sandbox compatibility, loader globals, historical-version
branches, and direct native-widget modification remain out of scope. No canary
code was copied.

## Product-reference provenance

The compact-launcher/centered-popup concept was informed by the Zen Browser
user-manual Urlbar description at
[`zen-browser/docs@765737d3e70e29994e23d66a617bc09f17e74653`](https://github.com/zen-browser/docs/blob/765737d3e70e29994e23d66a617bc09f17e74653/content/docs/user-manual/urlbar.mdx)
(page blob `39eee8e40ebb8d37e4fc56463bf0a90e463c66a9`) and the contemporary desktop head
[`f8daccb4c95f0e72795b29ff56f18294600fb262`](https://github.com/zen-browser/desktop/commit/f8daccb4c95f0e72795b29ff56f18294600fb262).
Only the broad product concepts of a compact trigger and focused central entry
surface were used. No Zen source, CSS, selector, ID, class, icon, dimension,
animation, composition, or Firefox-internal strategy was copied or adapted.

## Decision and minimum implementation

- Extend the existing frame with one final, project-owned XHTML address overlay
  host. Four edge roots remain independent; the fifth Svelte root owns only the
  centered popup. Partial host/root failure rolls back the complete shell.
- The left root renders one non-editable launcher with bounded committed
  location text and two state-derived text badges. It contains no input and
  never mirrors an uncommitted native Urlbar draft.
- `src/app/address-popup.ts` owns one immutable per-window popup state machine.
  A draft exists only while open. Background same-tab navigation cannot replace
  an active draft; selected-tab change closes/discards it; confirmed accepted
  navigation closes it.
- Submission rejects empty, over-4,096-character, `data:`, `javascript:`, and
  `vbscript:` values before native access. Accepted input is assigned to
  `gURLBar.value`, then Firefox's `handleCommand()` owns fixup, search, principal,
  telemetry, and navigation behavior.
- Healthy `Ctrl+L` opens/selects the custom popup. If it cannot be accepted,
  Fennevia does not cancel the event, so the retained native command proceeds.
- Connection and protection states are fixed ordinary enums. Compact and
  detailed labels are both derived from the same enum; they never infer status
  from the URL or expose native handler objects.
- While the popup is opening, editing, submitting, invalid, failed, or closing,
  the shared edge controller suppresses all four edge surfaces. The popup is
  nonmodal, closes at focus bounds or Escape, and restores a valid prior focus
  target or the selected content browser.
- Firefox's native Urlbar, identity/protection panels, permissions, page actions,
  prompts, and navbar remain visible, attached, and authoritative.

## Options rejected

1. Keep an editable input permanently in the left edge. Rejected by the owner
   refinement and because it crowds the vertical tabs and creates two visible
   drafts.
2. Move or clone native Urlbar/identity/protection DOM into project hosts.
   Rejected because Firefox owns those children, popup routing, and sensitive
   flows.
3. Call `loadURI`, implement URI fixup, or call a search engine directly.
   Rejected because it would duplicate principal, keyword, disposition,
   telemetry, and current Urlbar policy.
4. Infer HTTPS or protection from the address string or use decorative fake
   shield/padlock icons. Rejected because these would make security claims
   without Firefox state.
5. Mount the popup in Firefox's native `popupset`. Rejected because the feature
   needs a project-owned XHTML root and no native popup ownership.
6. Recreate every native Urlbar item in #13. Rejected as incoherent scope;
   issue #37 tracks reviewed permissions/page-actions coverage while native
   panels remain available.

## Security and privacy effects

- Committed address and popup draft are bounded text in the owning window's
  memory and project-owned text/input nodes only. They never enter logs, error
  metadata, datasets, preferences, disk, another window, or project network
  traffic.
- Svelte text interpolation and native input value assignment are used; there
  is no `{@html}`, CSS interpolation, remote asset, or content-accessible
  mapping.
- Status values are fixed enums copied from current Firefox handler state. The
  popup does not display certificate material, origin attributes, permission
  records, exception principals, or private-window state.
- The bridge introduces no dependency, endpoint, telemetry, storage, Chrome
  Registry directive, override, source map, or executable network content.
- Normal, second-normal, and private windows own separate popup state,
  subscribers, listener/observer/progress cleanup, root, and focus history.

## Validation performed

- Targeted Node tests passed 47/47 during implementation. The final
  `npm run verify` passed all 101 repository tests plus formatting, lint,
  dependency audit, deterministic builds, manifest synchronization, and the
  production artifact scanner. Tests cover snapshot/state validation, Firefox
  submission and capability behavior, popup draft/tab/navigation rules, real
  status mapping, edge suppression, five-host ownership, and deterministic
  disposal.
- Type checking passed with zero Svelte errors and warnings. The build
  reproduced the private bridge, frontend, stylesheet, and package manifest.
- The ordinary Firefox 153.0.4 matrix passed launcher/popup focus, native and
  custom `Ctrl+L`, URL/host/search submissions, invalid input, Escape/cancel,
  committed versus draft behavior, tab switch, real connection/protection
  labels, popup edge suppression, normal/second/private isolation,
  unmount/remount, close/runtime disposal, native-UI retention, and no
  unexpected first-party Browser Console error.
- The Browser Toolbox run selected the shared frame, confirmed all four edge
  boundaries plus the address-overlay boundary, retained native infrastructure,
  and completed with exit code 0.
- Bridge recovery passed missing base, tabs, and navigation/address capability
  fail-open, exact restoration, and ordinary startup. Frontend recovery passed
  missing and throwing bundles, exact restoration, and the full ordinary
  matrix. Every run ended with zero Firefox process.

## Remaining compatibility risk and follow-up

- All adopted Urlbar, identity, protections, allow-list, progress, command, and
  browser properties are Firefox internals and must be revalidated on the next
  supported stable.
- Protection booleans are event-established rather than startup invariants;
  conservative `unavailable` is intentional until Firefox supplies a coherent
  current state.
- The compact badges and popup rows summarize Firefox state but are not
  certificate, permission, or protection panels. The retained native panels
  remain authoritative.
- Issue #37 must separately inventory and design fuller permissions/page-action
  access before issue #15 can hide any native Urlbar surface.
