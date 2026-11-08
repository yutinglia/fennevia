<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 159 — Fennevia 0.20.0-beta.1 release candidate

## Status and source

Preparation started 2026-11-09 after the owner explicitly requested commit,
push to main, then release. Feature implementation `837a5f900f84b930d902fab075c2eed90503745e`
is on main. No release tag or public artifact exists yet for this candidate.
The previous prerelease's one-time manual-test exception does not apply here.

This candidate includes local WebExtension management (ADR-098), plus the earlier
unreleased main changes: portable settings, scoped container scrolling, configured
window controls, and native Tauri installer with fixed offline WebView2.
The same-ID in-flight extension installation limitation was explicitly accepted
by the owner before implementation; that approval does not waive release tests.

## Environment

- Windows 25H2 x64 build 26200.9711; stock Firefox 159.0.1 release,
  BuildID `20261102144711`, official Git release source
  `6181e6b5f28a8fbae1d5c3ef6f6626b5a2180213`.
- Official Mozilla-signed download unpacked into a marker-owned program copy;
  newly initialized, unregistered marker-owned release-test profile.
  Daily Firefox and profiles remain untouched.
- Node 24.18.0/npm 11.16.0 from nvm-windows, Rust 1.99.1 from the repository
  toolchain pin. No standalone language runtime was installed.
- Firefox 159 chrome automation uses `MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1` only
  in test subprocess environments. It is not a product preference or global change.

## Evidence so far

| Gate | Observed result |
| --- | --- |
| Feature ordinary gate | Passed at implementation tree: 510 tests, 89.45% lines / 95.95% functions, root verify, PS7/5.1, deterministic build, production scan. |
| Native installer frontend / Rust | `npm --prefix installer run verify`, `cargo fmt --all --check`, locked clippy with warnings denied, and locked workspace tests passed on the implementation source. |
| Main CI / CodeQL | Passed for `837a5f9`: Windows CI `42528214776`, CodeQL `42528214729`. |
| Firefox full lifecycle + Browser Toolbox | Passed: normal/second/private windows, owned XHTML hosts, content-only activation, native reveal/fallback, resize/maximize/minimize/fullscreen/customize, excluded tab, cleanup and no unexpected first-party script errors. |
| Local extension runtime and UI | Passed; see [feature evidence](firefox-159-local-extension-implementation.md). |
| Frontend/bridge/safe-start/runtime recovery, SessionStore | Passed: missing/throwing frontend, all bridge failure cases, shell recovery, safe start/fatal bootstrap, persisted tabs/lazy restoration and fail-open, with exact baseline restoration. |
| Focused native/Urlbar/layout probes | Passed: provider/results, suggestions/execution/search-mode handoff, tab drag scroll, ten light/dark opacity cases, scoped Row/Column scrolling and configured controls, settings transfer, eight background and eight native dialog cases. |
| Repeated performance | Three enabled starts and three hard-disabled controls passed; numeric observations below. |
| Local extension cold AutoConfig restore | Passed after the process-global I/O correction: normal and immediate-quit modes, three processes each, later-window operations after closing the original window, restoration and persistent removal. |
| Exact candidate double native/package build and extracted archive | Not run yet. |
| Annotated tag / publication / independent public download | Not run. |

Commands use the existing `tests/firefox-window-lifecycle.mjs --browser-toolbox`
and recovery/probe wrappers listed in `docs/testing-and-recovery.md`, passing only
the isolated program/profile. Generated fixtures and test instrumentation do not
enter the release inventory. Each recovery wrapper restores exact installed bytes.

## Startup/shutdown correction found during release validation

The first AutoConfig harness requested application quit as soon as the native
addon appeared, before the confirmation transaction completed. Firefox did not
exit within the harness's ten-second bound; it was terminated, leaving the
expected interrupted checkpoint. A subsequent startup kept that entry inactive
and its removal through the UI succeeded. Waiting for the normal UI transaction
to finish also passed, but did not resolve the early-quit case by itself.

The privacy-safe global-identity probe established that `window.IOUtils` belongs
to the first window, while the bridge system module has a separate process-global
IOUtils. Upstream `IOUtils::CreateJSPromise` binds promises to the API's global;
copying a window API into a plain object does not change that lifetime. The
facade now takes native APIs from its system module global and registers its
drain on `IOUtils.profileBeforeChange`, whose clients complete before IOUtils's
final flush. No timeout was increased and no pending work was silently discarded.

Source pin: [IOUtils.cpp](https://github.com/mozilla-firefox/firefox/blob/6181e6b5f28a8fbae1d5c3ef6f6626b5a2180213/xpcom/ioutils/IOUtils.cpp),
`CreateJSPromise`, `GetProfileBeforeChange`, `EventQueue::SetShutdownHooks` and
`IOUtilsShutdownBlocker::Done`. No upstream code was copied.

`tests/firefox-local-extensions-startup.mjs` passed in normal mode and with
`--interrupt-install`. Both runs completed all three processes cleanly: initial
confirmed import; automatic restore, first-window close and removal in a second
window; third startup with removal preserved. No manual Bootstrap import or
second service was used. The correction is limited to the process facade and
generated bridge; the earlier full-shell evidence is explicitly before this fix.

## Performance observations

AMD Ryzen 9 9950X3D, approximately 8 GiB RAM, Balanced power scheme. These runs
share one copied program/profile and display configuration. The prior Firefox
157 record used different hardware, so no cross-version slowdown ratio is claimed.

| Run | Startup (ms) | Five-second CPU (ms) | Edge p95 (ms) | Five-cycle memory (MiB / %) |
| --- | ---: | ---: | ---: | ---: |
| Enabled 1 | 1298 | 1641.694 | 17.582 | 76.961 / 11.677 |
| Enabled 2 | 1142 | 1613.067 | 19.541 | 74.313 / 10.776 |
| Enabled 3 | 1156 | 1654.411 | 16.454 | 66.043 / 10.034 |
| Disabled 1 | 1164 | 1798.679 | n/a | n/a |
| Disabled 2 | 1170 | 1683.285 | n/a | n/a |
| Disabled 3 | 1109 | 1634.871 | n/a | n/a |

Enabled startup median: 1156 ms. Edge response remains below 50 ms; memory does
not meet the joint 64 MiB and 20% investigation threshold. Five-cycle process
counts return to 11 and normal lifecycle cleanup passes. The enabled CPU median
1641.694 ms exceeds the absolute 500 ms trigger, so hard-disabled controls were
run; their median is comparable at 1683.285 ms with zero Fennevia records/hosts.
This supports shared Firefox startup activity, not precise CPU attribution.
Enable was restored in `finally`. These numbers precede the I/O lifetime fix.

## Remaining manual and hardware gates

Not run: secure-desktop UAC acceptance/cancellation/different-account credentials;
clean Windows without build tools; physical power loss/disk-full/worker interruption;
screen reader, high DPI/system colors and physical cross-application pointer flows;
real user-account/provider/third-party-extension compatibility and full permissions
matrix. Automated fixtures cannot establish these results.

Publication remains gated by the repository's current release contract. No waiver
is inferred from the owner's general release request. Any explicit owner decision
about unrun rows must be recorded in the current normative documents before tagging.

An earlier attempt to batch-delete this task's disposable profiles was rejected by
automatic approval review with only `blocked by policy`. No bypass was attempted;
those isolated targets remain. The retained stock copy is reused for this release
verification with a fresh profile. This is not an installation in a daily profile.
