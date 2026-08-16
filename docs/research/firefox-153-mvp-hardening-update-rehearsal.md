# Firefox 153 MVP hardening and update rehearsal

## Environment

- Date: 2026-08-16
- Issue: [#16](https://github.com/yutinglia/fennevia/issues/16)
- Project base commit: `581c812d494e33b8eea23a41b7673f9f985c6ef4`
  plus the issue #16 working tree
- Package: `0.10.0-dev`
- Package-manifest SHA-256:
  `a8ffcd1eb5299d99b665ff571a9f20de01ab26b9d3c40509fa1d1be3e3b63f68`
- Firefox: 153.0.4 release
- Build ID: `20260810162159`
- Official release commit:
  [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)
- Operating system: Windows 11 Pro 25H2, build `26200.9168`
- Processor: 13th Gen Intel Core i7-13700K; the test environment exposed 8
  logical processors
- Memory: 24.0 GiB
- Node.js: 24.18.0
- npm: 11.16.0
- PowerShell: 7.6.4 and Windows PowerShell 5.1
- Profile: marker-owned `fennevia-dev`
- Program: marker-owned disposable copy of the stock Firefox installation

The system Firefox installation, registered profiles, default profile, and
daily-use profiles were not selected or mutated. Paths in shared output used
`<FIREFOX_PROGRAM>` and `<FENNEVIA_PROFILE>` placeholders.

Mozilla Product Details reported 153.0.4 as
`LATEST_FIREFOX_VERSION` and 154.0b10 as the development release on
2026-08-16. There was therefore no newer stable release available for a real
stable-to-stable transition. This record is an isolated same-build update and
recovery rehearsal plus the first performance baseline. It makes no later
Firefox, Beta, Nightly, ESR, Linux, or macOS support claim.

## Scope

Issue #16 closes the MVP hardening gate by supplying:

- a repeatable Firefox update workflow with exact evidence fields;
- fail-closed repair for exactly one missing installer ownership side;
- a fixed-list PowerShell test gate in both supported PowerShell runtimes;
- test-only startup, idle-resource, edge-response, and repeated-window-cycle
  measurements;
- complete install, failure, disable, enable, uninstall, stock-fallback, and
  cleanup rehearsal against an isolated Firefox copy;
- synchronized architecture, internals, security, testing, and roadmap records.

It does not add production telemetry, polling, persistence, runtime network
access, a resource mapping, a dependency, or a Firefox-owned DOM replacement.

## First causal incident

The controlled recovery incident removed only the exact marker-owned program
artifacts after their hashes were verified, while leaving the profile package
and its ownership record intact. The ordinary `Update` action rejected that
state with `FENNEVIA_INSTALL_OWNERSHIP_INCOMPLETE` before creating a
transaction. This was the first causal failure; no runtime exception was used
to infer installer state.

The accepted repair is deliberately narrower than ordinary update:

1. exactly one ownership side must be wholly absent;
2. the other side must contain an internally valid owner and exact package
   files;
3. the selected repository source must reproduce the surviving files
   byte-for-byte;
4. the absent side must contain no alternate preference, foreign AutoConfig,
   partial package, metadata, transaction, or conflicting artifact;
5. both selected roots must still pass marker, canonical-path, reparse-point,
   and project-created-directory validation;
6. the plan may mutate only the absent side and must use the existing digest,
   journal, staging, rollback, and cleanup transaction.

Any ambiguous residue remains a manual diagnosis rather than an adoption or
overwrite path. ADR-033 records this boundary.

## Firefox and canary review

The four required compatibility canaries were compared with the pins recorded
for #15. Their heads had not changed:

| Canary | Previous and current head | Current relevance |
| --- | --- | --- |
| Alice0775/userChrome.js | [`5e146e348a56a914e6c016d29733e8ee8d468155`](https://github.com/alice0775/userChrome.js/commit/5e146e348a56a914e6c016d29733e8ee8d468155) | Latest change concerns non-Latin script filenames and generic `loadSubScript` handling; Fennevia uses fixed ASCII Chrome ESM paths |
| MrOtherGuy/fx-autoconfig | [`dfdab5684faffc112b76ccb1d8cab7f75da0102c`](https://github.com/MrOtherGuy/fx-autoconfig/commit/dfdab5684faffc112b76ccb1d8cab7f75da0102c) | Latest change targets generic-loader actor definitions for parent-process subframes; Fennevia has no such actor/discovery layer |
| xiaoxiaoflood/firefox-scripts | [`a898ac59fb0ca3886c0c46b184fdbc037c83c037`](https://github.com/xiaoxiaoflood/firefox-scripts/commit/a898ac59fb0ca3886c0c46b184fdbc037c83c037) | No current Firefox 153 adaptation relevant to the fixed package/runtime boundary |
| aminomancer/uc.css.js | [`88514013ddc375f4770f4a35d8d07a91d6dd7d8f`](https://github.com/aminomancer/uc.css.js/commit/88514013ddc375f4770f4a35d8d07a91d6dd7d8f) | No current change required by the issue #16 boundaries |

Recent commits and current-version content were inspected, not only README
files. No canary code, loader discovery behavior, selector, or compatibility
branch was copied.

Firefox 153's pinned
[`ChromeUtils.webidl`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/dom/chrome-webidl/ChromeUtils.webidl)
confirms that `ChromeUtils.requestProcInfo()` exposes memory bytes, CPU time in
nanoseconds, and CPU cycles. It also confirms that raw child-process records can
contain origins, window URIs/titles, identifiers, and thread details. The
harness therefore immediately reduces each response to numeric process count,
memory, CPU time, and cycles; raw records never enter output or project state.
There is no production caller. ADR-034 records the privacy boundary.

## Installer repair validation

The static installer matrix passed in both PowerShell runtimes:

```powershell
pwsh -NoProfile -File .\tests\run-static-powershell-tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\tests\run-static-powershell-tests.ps1
```

The fixed runner names every supported suite explicitly, so an unexpected test
file cannot silently become executable CI input. The installer suite covers:

- rejection when both ownership sides are absent;
- exact program-side and profile-side repair plans;
- dry-run immutability, redacted output, zero unrelated backups, and a plan
  limited to the missing side;
- exact source/survivor fingerprint and byte-identical owner-pair restoration;
- idempotent `already-complete` behavior;
- rejection of source mismatch, partial residue, unmarked roots, foreign
  AutoConfig/preferences, and incomplete ownership during ordinary actions;
- injected failure after partial mutation, exact rollback, and zero
  transaction residue;
- direct CLI `Repair -WhatIf` behavior in addition to module-level tests.

The final `npm run verify` passed formatting, lint, Svelte/TypeScript checks,
all 149 Node tests, the complete PowerShell 7 fixed suite, dependency audit,
deterministic frontend and bridge builds, manifest synchronization, and the
12-file production-artifact scan. The same fixed PowerShell suite then passed
independently in Windows PowerShell 5.1.

The real copied-Firefox rehearsal then produced this sequence:

| Step | Observed result |
| --- | --- |
| Clean install preview/apply | 23 exact mutations, zero backups, matching plan digest, complete byte-identical ownership pair |
| Deliberate one-sided loss | Exact two program package files and program owner removed only after source/hash/marker proof |
| Ordinary update | Failed closed with `FENNEVIA_INSTALL_OWNERSHIP_INCOMPLETE`; no transaction |
| Injected repair failure | Failed after two mutations, restored the exact incomplete state, left zero transaction residue |
| Repair preview/apply | Classified `repairable-program`; four program-only mutations, zero backups; complete pair restored |
| Repeated repair | `already-complete`; zero mutations |
| Disable preview/apply | Three mutations and three owned backups; disabled cold start retained native stock UI and created no project host/record |
| Enable | Three mutations and three owned backups; complete lifecycle returned |
| Same-package update | `already-current`; zero mutations |
| Uninstall preview/apply | 23 mutations and 16 owned backups; all package, ownership, and transaction residue removed |
| Stock cold start | Native Firefox remained usable; no Fennevia host or record |

Startup cache was not cleared. Every immediately following cold start reflected
the intended package state, so the evidence-driven cache policy remains
`startupCacheAction=none`.

## Real Firefox lifecycle and recovery

The following passed against Firefox 153.0.4:

- more than three clean cold starts and complete shell health activation;
- existing and second normal windows plus a private window;
- resize, maximize, minimize, browser fullscreen, DOM fullscreen, customize
  mode, tabs, navigation, address submission, Urlbar coverage, Places, and
  Downloads paths exercised by the lifecycle harness;
- Browser Toolbox selection of the shared project frame and confirmation that
  all four edges plus address overlay are project-owned XHTML boundaries;
- missing privileged entry, missing/throwing frontend, and missing boundary,
  tabs, navigation, address, Urlbar coverage, bookmarks, and Downloads bridge
  paths;
- every injected failure removed all project hosts and retained usable native
  Firefox UI, followed by exact byte restoration and an ordinary healthy run;
- deterministic disposal on window close and runtime stop, with no duplicate
  host, process-global initialization, first-party unhandled exception, or
  remaining Firefox process.

Native Firefox DOM, trust/protections/permission UI, prompts, tab/content
infrastructure, titlebar, and OS controls remained attached. The compact side
address launcher continued to show Firefox-derived connection/HTTPS and
Enhanced Tracking Protection state; the centered popup retained the detailed
status and complete native-Urlbar handoff established by #15.

Hardware/account-dependent prompts were not artificially claimed as newly
reproduced by #16: real extension-install, authentication, certificate-error
exception, OS file-picker, and Sync-account dialogs were not triggered. Their
native owner DOM and access paths were retained, and #15's recorded native UI
matrix remains the relevant implementation evidence. A real newer-stable
transition was not run because none existed.

## Performance baseline

The explicit test-only command was run three times after clean cold starts:

```powershell
node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_PROFILE>' `
  --performance-baseline
```

Each run measured spawn-to-active startup, a five-second idle interval, twelve
edge reveal samples (three per edge), and five normal-window open/close cycles.
All three runs passed lifecycle cleanup and Browser Console checks.

| Metric | Run 1 | Run 2 | Run 3 | Median |
| --- | ---: | ---: | ---: | ---: |
| Startup to active (ms) | 2,578 | 1,204 | 1,459 | 1,459 |
| Five-second idle CPU delta (ns) | 382,488,998 | 384,739,396 | 369,134,199 | 382,488,998 |
| Five-second idle memory delta (bytes) | 64,749,568 | 64,516,096 | 63,553,536 | 64,516,096 |
| Edge response p95 (ms) | 21.494 | 20.283 | 15.329 | 20.283 |
| Five-cycle CPU delta (ns) | 3,224,279,827 | 3,354,103,904 | 3,650,836,102 | 3,354,103,904 |
| Five-cycle memory delta (bytes) | 91,955,200 | 71,749,632 | 86,282,240 | 86,282,240 |
| Process count before/after cycles | 11/11 | 11/11 | 11/11 | 11/11 |

This is a machine- and build-specific baseline, not a general performance
guarantee. The initial review thresholds are:

- idle CPU: above 500,000,000 ns or twice the last accepted median;
- edge p95: above 50 ms or twice the last accepted median;
- repeated-window memory: above both 64 MiB and 20% of the pre-cycle aggregate;
- startup: compare and investigate on a later supported release; do not fail
  the first baseline without a predecessor.

No threshold triggered. The repeated-window memory deltas exceeded 64 MiB but
remained below 20% (the median ratio was approximately 11.6%), so the compound
gate correctly did not classify them as a regression. These totals include
Firefox and its child processes and do not attribute all movement to Fennevia.

## Security, privacy, dependency, and provenance review

- No dependency, lifecycle script, runtime endpoint, telemetry, persistence,
  content-accessible resource, Chrome override, or source map was added.
- No URL, origin, title, query, bookmark, download, profile path, native record,
  account, token, cookie, certificate, or private-window browsing state enters
  the performance result or normal diagnostics.
- Repair never enumerates unrelated profiles, discovers arbitrary scripts,
  adopts unknown files, or broadens deletion scope.
- The package inventory remains exact and reproducible from source. Generated
  output is never hand-edited.
- Canary repositories and Firefox source were evidence only; no external code
  was copied or adapted.
- The fixed test runner reduces CI execution ambiguity but does not turn local
  PowerShell success into a substitute for GitHub-hosted checks.

## Cleanup and result

Uninstall returned the disposable program/profile pair to zero package,
ownership, and transaction residue. The marker-owned profile itself was
retained for future development, with no project package installed. After exact
marker and path-prefix verification, the copied Firefox program was sent to the
Windows Recycle Bin rather than permanently deleted; it is recoverable there.
No Firefox process remained.

The MVP hardening boundary is complete for the stated Firefox 153.0.4 Windows
environment. The project now has a reproducible update procedure, narrowly
recoverable ownership interruption, deterministic PowerShell coverage, and an
accepted baseline for detecting future release regressions. A later Firefox
stable must repeat the workflow and record any upstream adaptation before
compatibility is claimed.
