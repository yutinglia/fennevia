<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 159 — Fennevia 0.20.0-beta.1 release candidate

## Status and source

Preparation started 2026-11-09 after the owner explicitly requested commit,
push to main, then release. Feature implementation `837a5f900f84b930d902fab075c2eed90503745e`
is on main. No release tag or public artifact exists yet for this candidate.
The previous prerelease's one-time manual-test exception does not apply here;
the owner supplied a separate explicit decision for this candidate below.

Release follow-up `a7b45da` corrects the I/O lifetime issue below. Package, npm
locks, native workspace/lock and Tauri identities are now `0.20.0-beta.1`.
The regenerated dependency inventory changes only lock hashes for those local
version fields; no third-party crate, npm dependency, runtime pin or license
inventory changes in this candidate.

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
| Versioned candidate ordinary gate | Passed again after I/O correction and 0.20 metadata: root verify (510 tests, 89.45% lines / 95.95% functions), PS7/5.1 static suites, dependency audit, deterministic build, production scan and installer frontend verify. |
| Native installer frontend / Rust | `npm --prefix installer run verify`, `cargo fmt --all --check`, locked clippy with warnings denied, and all 42 locked workspace tests passed again after the version bump. |
| Main CI / CodeQL | Passed for implementation `837a5f9` (CI `42528214776`, CodeQL `42528214729`) and exact candidate `90f51b3` (Windows CI `42531591043`, CodeQL `42531590805`). |
| Firefox full lifecycle + Browser Toolbox | Passed again on the versioned candidate after the I/O fix: normal/second/private windows, owned XHTML hosts, content-only activation, native reveal/fallback, resize/maximize/minimize/fullscreen/customize, excluded tab, cleanup and no unexpected first-party script errors. |
| Local extension runtime and UI | Passed; see [feature evidence](firefox-159-local-extension-implementation.md). |
| Frontend/bridge/safe-start/runtime recovery, SessionStore | Passed: missing/throwing frontend, all bridge failure cases, shell recovery, safe start/fatal bootstrap, persisted tabs/lazy restoration and fail-open, with exact baseline restoration. |
| Focused native/Urlbar/layout probes | Passed: provider/results, suggestions/execution/search-mode handoff, tab drag scroll, ten light/dark opacity cases, scoped Row/Column scrolling and configured controls, settings transfer, eight background and eight native dialog cases. |
| Repeated performance | Three enabled starts and three hard-disabled controls passed; numeric observations below. |
| Local extension cold AutoConfig restore | Passed after the process-global I/O correction: normal and immediate-quit modes, three processes each, later-window operations after closing the original window, restoration and persistent removal. |
| Exact candidate double native/package build and extracted archive | Passed at clean source `90f51b3556ea2929a4230e35d0a4398eb602862a`; independent source/target builds, identical ZIP/manifests, Unicode extraction, exact hashes, PS7/5.1 verifiers and native frontend/worker smoke. |
| Extracted native installer file transactions | Passed on a separate pristine Firefox 159 copy: Install 26, unchanged Update 0, Disable/Enable 3 each, missing-file Update 1, missing-program-side Repair 4, Uninstall 26; original file inventory restored. |
| Extracted browser recovery / stock return | Passed: exact archive update, missing frontend hard-disable, update/repair while disabled, stock cold start, re-enable and full normal/second/private lifecycle, uninstall and stock cold start with zero project records or owned-file residue. |
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

The first full-shell rerun failed to connect because the early startup harness
had persisted its temporary Marionette port in `prefs.js` while restoring only
`user.js`. The observed port was 2839 while the lifecycle harness expected 2828.
That test-only preference was restored through Firefox; the startup harness now
reads the existing bounded port and does not change either preference file.
No product setting or connection timeout was changed for this correction.
The corrected transport harness then passed the complete lifecycle/Toolbox run
and three more immediate-quit/restore/later-window/removal processes on the
installed `0.20.0-beta.1` candidate.

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

## Exact candidate package

Clean source: `90f51b3556ea2929a4230e35d0a4398eb602862a`, pushed to main.
Command:

```text
pwsh -NoProfile -File scripts/release-preflight.ps1 -OutputDirectory <EMPTY_TASK_OUTPUT> -ExpectedTag v0.20.0-beta.1 -SkipDependencyInstall -SkipProjectVerification
```

The flags reuse the already verified local dependencies and candidate project
gates above. Both native builds still ran independently, from different source
and Cargo target directories, with four build jobs. Preflight built both full
packages, compared their complete bytes and manifests, checked checksums,
extracted into a Unicode/space path, and passed native frontend-ready and
authenticated worker IPC smoke from the unelevated local token.

- ZIP: `fennevia-0.20.0-beta.1-windows.zip`, 729,837,927 bytes.
- SHA-256: `3eeb0df3e921b9c3d50b3db593b19c34922bb325c529d24686c1f106b23c9e40`.
- Strict extracted inventory: 304 files; both PowerShell 7 and 5.1 pass.
- Package manifest SHA-256:
  `a7ffe09c223b8e7a8d451fdeabe3b574a263c1405e6ec4fd9fd61628b23d851d`.
- The Rust `release-transaction` example used this exact extracted package and
  independently unpacked, Mozilla-signed pristine Firefox 159.0.1 input. Its
  complete copied-program lifecycle restored the original file inventory.
- Shipping PowerShell CLI update, `tests/firefox-release-recovery.ps1`, shipping
  uninstall and `tests/firefox-window-lifecycle.mjs --expect-stock` all passed
  with the exact Unicode-path extraction and the marked development pair.
  The first CLI invocation incorrectly supplied the library-only `PackageRoot`
  parameter and was rejected before mutation; the corrected invocation uses the
  shipped script's own package root. No installer code change was needed.
- The Windows jobs were executed directly. Workflows/runner orchestration are
  unchanged; Linux Docker/act cannot establish Windows ACL/registry/PS5.1/MSVC/
  WebView2 behavior, so no publication or privileged workflow ran in act.

These hashes describe this local candidate, not a public artifact or a future
tag with additional documentation. Publication requires the workflow's own
exact-tag rebuild and independent public-download verification.

## Remaining manual and hardware gates

Not run:

- Secure-desktop UAC acceptance/cancellation/different-account credentials and
  physical Program Files ACL/race scenarios.
- Clean Windows without build tools; isolated-network capture and exhaustive
  renderer/capability attack attempts.
- Physical power loss/disk-full/forced worker interruption at every transaction
  stage. Automated rollback and immediate browser quit do not establish these.
- Screen reader, 100/150/200% DPI, system colors/forced colors, multilingual
  physical keyboard/mouse, native file-dialog interaction and cross-application
  pointer flows; first-paint/watchdog visual confirmation and complete customize
  and popup-placement matrices.
- Real user accounts/devices/providers/third-party extensions, full permissions
  matrix, literal fresh-profile first-zero-prefix query, DNR/dynamic scripts/menus
  and earliest-network-request lifecycle coverage.

Automated fixtures cannot establish these results. Non-Windows and non-release
Firefox channels remain outside support scope, not newly passed or supported.

On 2026-11-09, after reviewing the completed candidate and the unrun rows above,
the owner explicitly answered **“核准本次例外並發布”** (approve this exception and
publish). The question included the exact unrun scope, linked AGENTS §8.2 and
this record, and specified publication after final CI. This is an explicit
one-release exception for `0.20.0-beta.1`, not inferred from the earlier general
release request and not reused from 0.19. All unrun rows remain `not run`.
AGENTS §8.2, ADR-039 and the current testing contract record the same decision
before tagging. Product safety, privacy, fail-open, native UI ownership and
Windows stable support boundaries remain unchanged.

An earlier attempt to batch-delete this task's disposable profiles was rejected by
automatic approval review with only `blocked by policy`. No bypass was attempted;
those isolated targets remain. The retained stock copy is reused for this release
verification with a fresh profile. This is not an installation in a daily profile.
After the shutdown fix passed, automatic approval review also rejected removal of
six new temporary diagnostic scripts/logs in the ignored task-artifact directory
with the same `blocked by policy` result. No alternative deletion method was used.
No temporary diagnostic code is in the production source or release inventory;
the retained regression harnesses are test-only.
