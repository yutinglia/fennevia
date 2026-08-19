# Firefox 153.0.4 to 154.0 stable transition

## Environment

- Date: 2026-08-19
- Tracking issue: [#1](https://github.com/yutinglia/fennevia/issues/1)
- Firefox old: 153.0.4 release, Build ID `20260810162159`, tag
  `FIREFOX_153_0_4_RELEASE`
- Firefox new: 154.0 release, Build ID `20260812182057`, official tag
  `FIREFOX_154_0_RELEASE` at commit
  [`032a9fc1ac0cc3209f7c142744ba2e40847c8086`](https://github.com/mozilla-firefox/firefox/commit/032a9fc1ac0cc3209f7c142744ba2e40847c8086)
- Channel: release
- Mozilla Product Details on 2026-08-19:
  `LATEST_FIREFOX_VERSION` = `154.0`; `LAST_RELEASE_DATE` = `2026-08-18`
- Operating system: Windows 11 (same Windows-first development environment as
  the Firefox 153 baseline)
- Profile: existing marker-owned development profile
- Program: existing marker-owned copied Firefox program after the stock 154.0
  update
- Fennevia public package still pinned by installer allowlist:
  `0.10.0-beta.1` on Firefox 153.0.4 / `20260810162159`

This is the first real stock-stable transition after the #16 same-build
rehearsal. It does not widen the published installer allowlist and does not
claim Linux, macOS, ESR, Beta, Nightly, or daily-driver support.

## Symptom and first causal evidence

- Reproduction: the copied development Firefox updated from 153.0.4 to 154.0.
  The project owner confirmed ordinary Fennevia use on 2026-08-19 with no
  remaining functional regression.
- First structured runtime records on the new build:
  `runtime.starting` / `runtime.started` / `bootstrap.success` with
  `firefoxVersion=154.0` and `buildId=20260812182057`.
- First causal error/stack: none observed for bootstrap, runtime-ready, or
  ordinary shell use.
- One 154-adjacent naming defect was found and already fixed: customize-palette
  **Toolbar item** fallback for `reset-pbm-toolbar-button`, mapped to Fluent
  `reset-pbm-toolbar-button2` in PR #70. That widget is created by
  `ResetPBMPanel`, not `CustomizableWidgets`. Remaining
  `CustomizableUI: Could not localize property '*.label'` lines are
  properties-bundle fallback noise, not missing visible names.

## Sources checked

Firefox 154.0 tag commit
[`032a9fc1ac0cc3209f7c142744ba2e40847c8086`](https://github.com/mozilla-firefox/firefox/commit/032a9fc1ac0cc3209f7c142744ba2e40847c8086)
is the merge-day config bump. Release notes:
https://www.firefox.com/en-US/firefox/154.0/releasenotes/

Compatibility canaries on 2026-08-19 (current default-branch HEAD):

| Canary | Current head | Current relevance |
| --- | --- | --- |
| alice0775/userChrome.js | [`127d6ee50f01dbdde7f65a9fb0d56a7ee47356e3`](https://github.com/alice0775/userChrome.js/commit/127d6ee50f01dbdde7f65a9fb0d56a7ee47356e3) (2026-08-18, message `mmm, test`) | No Fennevia-required adaptation |
| MrOtherGuy/fx-autoconfig | [`dfdab5684faffc112b76ccb1d8cab7f75da0102c`](https://github.com/MrOtherGuy/fx-autoconfig/commit/dfdab5684faffc112b76ccb1d8cab7f75da0102c) | Unchanged from the #16 pin; loader-actor work remains out of scope |
| xiaoxiaoflood/firefox-scripts | [`a898ac59fb0ca3886c0c46b184fdbc037c83c037`](https://github.com/xiaoxiaoflood/firefox-scripts/commit/a898ac59fb0ca3886c0c46b184fdbc037c83c037) | Unchanged from the #16 pin |
| aminomancer/uc.css.js | [`88514013ddc375f4770f4a35d8d07a91d6dd7d8f`](https://github.com/aminomancer/uc.css.js/commit/88514013ddc375f4770f4a35d8d07a91d6dd7d8f) | Unchanged from the #16 pin |

No canary loader discovery, subscript, actor, or `.uc.js` behavior was copied.

## Decision and minimum adaptation

- Required runtime/bootstrap internals used by Fennevia continued to start on
  154.0 without a new fail-open incident.
- The only shipped 154-adjacent code change is the existing PR #70 Fluent map
  for `reset-pbm-toolbar-button`.
- The published `v0.10.0-beta.1` exact version/Build ID allowlist is unchanged.
  Install, update, repair, and re-enable remain blocked on a Firefox build that
  is not 153.0.4 / `20260810162159` until a follow-up release widens that pair.
- No new mapping, content-accessible resource, runtime network endpoint, or
  logging of browsing data.

## Validation

- Owner-confirmed ordinary Windows x64 runtime on Firefox 154.0 Build ID
  `20260812182057`: **pass**
- Bootstrap/runtime-ready structured logs on that build: **pass**
- Full `docs/firefox-update-workflow.md` old-vs-new copied-program matrix,
  three-harness cold starts, SessionStore rehearsal, performance medians,
  disable/uninstall/stock cold start, and the release mass-test tables in
  `docs/testing-and-recovery.md`: **not run** (ADR-039 rapid-development
  cadence; owner confirmation of ordinary use closed the #1 tracking gate)
- Published installer allowlist widened to 154.0: **not done** (follow-up
  release work)

## Results and follow-up

- Real stable transition: **recorded**
- Remaining compatibility risk: unsupported internals can still drift; the
  published prerelease still installs only on 153.0.4; later stables still
  require `docs/firefox-update-workflow.md`
- Unsupported platforms remain unsupported

## Follow-up: installer major-version gate (ADR-048)

On 2026-08-19 the project owner asked to relax Install, Update, Repair, and
Enable from an exact 153.0.4 / `20260810162159` pair to Firefox major version
153 and newer, because 154.0 ordinary runtime had already been confirmed.

Current installer policy:

- Firefox major versions older than 153 remain blocked.
- Firefox 153 and 154 are the tested majors recorded in
  `release/release-config.json`.
- Newer majors may install after an explicit README and installer-TUI warning
  that later Firefox can break the shell and that confirming install does not
  promise that everything will work.
- Disable and Uninstall remain available without this gate.

This follow-up does not claim a completed mass-test matrix, Linux, macOS, ESR,
Beta, Nightly, or daily-driver support.
