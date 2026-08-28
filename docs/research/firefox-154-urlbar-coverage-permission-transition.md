# Firefox 154 Urlbar coverage permission-transition follow-up

## Environment and report

- Date: 2026-08-28
- Reported Firefox: 154.0.1 release
- Build ID: `20260824154132`
- Operating system: Windows x64 support target
- Project branch: `codex/fix-urlbar-coverage-subscribe`
- Starting project commit: `881f18cc20696badc2540748b58a7794e2a127e3`
- Installed project commit in the supplied runtime record: `unknown`

The supplied Browser Console record shows
`FENNEVIA_FIREFOX_URLBAR_COVERAGE_SUBSCRIBER_FAILED` while Firefox is selecting
a newly added tab. The stack enters through `tabbox.js`, `tabbrowser.js`, and
`BrowserDOMWindow.sys.mjs`, then reaches the Urlbar coverage mutation observer
and subscriber notification. The record does not include the wrapped
subscriber cause, so the exact live-runtime cause remains an evidence-backed
hypothesis until the corrected package is reproduced in Firefox.

## Firefox 154.0.1 source evidence

The official `FIREFOX_154_0_1_RELEASE` tag resolves to commit
[`9cd094dbc3eac5df87a24e7a871e52880cb8cd42`](https://github.com/mozilla-firefox/firefox/commit/9cd094dbc3eac5df87a24e7a871e52880cb8cd42).

- [`gPermissionPanel.hidePermissionIcons()`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_154_0_1_RELEASE/browser/base/content/browser-sitePermissionPanel.js#L162-L168)
  removes `hasPermissions` from `identity-permission-box` without clearing the
  blocked child anchors' `showing` attributes.
- [`gPermissionPanel.refreshPermissionIcons()`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_154_0_1_RELEASE/browser/base/content/browser-sitePermissionPanel.js#L173-L221)
  removes and rebuilds the child `showing` attributes, then updates the parent
  `hasPermissions` attribute last.
- [`gIdentityHandler.refreshIdentityBlock()`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_154_0_1_RELEASE/browser/base/content/browser-siteIdentity.js#L920-L933)
  chooses the hide or refresh path from Firefox's current page-proxy state.

The parent attribute is therefore Firefox's visibility envelope for the
blocked child anchors. A child may retain `showing` after the parent has been
cleared; treating that child as independently current can publish a snapshot
that contradicts the application contract and can also momentarily expose the
previous tab's indicator.

## Reproduction and first causal divergence

A focused bridge/adapter regression reproduces the Firefox owner transition:

1. publish a valid permission owner with `hasPermissions` and one blocked
   camera child;
2. remove only the parent `hasPermissions`, as Firefox's hide path does;
3. leave the child `showing` attribute in place until the later owner refresh.

Before the correction, step 2 publishes `blocked: ["camera"]` with
`hasPermissions: false`. `copyUrlbarCoverageSnapshot()` rejects that state as
`FENNEVIA_URLBAR_COVERAGE_SNAPSHOT_INVALID`; the bridge wraps it as the same
`FENNEVIA_FIREFOX_URLBAR_COVERAGE_SUBSCRIBER_FAILED` code from the supplied
record. This is the first source-and-test-backed causal divergence. No URL,
title, permission record, tab identity, or other browsing value is logged by
the regression.

## Minimum selected correction

Keep the existing observer, fixed enums, application validation, fail-open
boundary, and native handoff. When `identity-permission-box` lacks
`hasPermissions`, publish no blocked child enums even if a stale child still
has `showing`. Active sharing remains independent, matching Firefox's existing
owner contract. This adds no timer, deferred task, polling, native mutation,
new capability, or privileged data flow.

Deferring the observer or weakening application validation was rejected. A
delay would add pending lifecycle work without establishing owner coherence;
accepting contradictory state would preserve stale cross-tab presentation.

## Compatibility canaries

The current heads were checked on 2026-08-28:

- `alice0775/userChrome.js` at `a39f5cb60d40`;
- `MrOtherGuy/fx-autoconfig` at `dfdab5684faf`;
- `xiaoxiaoflood/firefox-scripts` at `a898ac59fb0c`; and
- `aminomancer/uc.css.js` at `88514013ddc3`.

No current issue or code search exposed a corresponding state-normalization
fix. `aminomancer/uc.css.js` references `blocked-permissions-container` only
for styling. The canaries supplied no implementation code, selector, timing,
or architecture for this correction.

## Validation

- The new regression failed before the source correction with the expected
  wrapped subscriber error and nested invalid-snapshot cause.
- The focused Urlbar coverage bridge and application-adapter run passes 10/10
  after the correction.
- `npm run verify` passes: formatting, lint, typecheck, 436 Node tests, the
  80% line/function coverage gates (88.71% lines and 95.79% functions), the
  fixed-list PowerShell suite, dependency audit, deterministic build, and all
  14 production-artifact inventory/security checks.
- The fixed-list static suite also passes independently under Windows
  PowerShell 5.1.
- The generated `BridgeBoundary.sys.mjs` and `package-manifest.json` hash are
  synchronized from source by the successful build.
- Real Firefox 154.0.1 new-tab selection with the corrected package is **not
  run** in this record.
