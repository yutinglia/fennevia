# Firefox 154.0.1 and Fennevia 0.18.0-beta.1 release validation

## 1. Scope and release

- Validation date: 2026-08-28
- Release candidate: `0.18.0-beta.1`, intended annotated tag
  `v0.18.0-beta.1`
- Feature commit: `a3ea3aedbfe0bb36f7ec4e6c1ecd8c8ba182408c`
- Release-preparation commit: `6f0890341ba5424371231ee21e071c79bbc54b37`
- Release-validation correction commit:
  `6484fb62413394dfedde525e776e50f83cebc949`
- Reviewed merge/tag target:
  `dfa4d2d207a353785998a44544b068b849bc817c`
- Target: stock Firefox 154.0.1 release, BuildID `20260824154132`, in a
  marker-owned copied program and dedicated marker-owned release profile
- Candidate status: published Windows x64 prerelease; the public assets and
  retained marker-owned installation were independently reverified

No registered or ordinary Firefox profile is in scope. The project-owned test
targets are validated before every installer or harness mutation. This is a
package-specific Windows x64 record, not a wider platform or Firefox-version
support claim.

## 2. Environment

| Item | Observed value |
| --- | --- |
| Operating system | Windows 11 25H2, build `26200.9168`, x64 |
| Firefox | Stock release `154.0.1` |
| Firefox BuildID | `20260824154132` |
| Firefox SourceStamp | `8b532c2140db30c193436254a61ce964e7d2a121` |
| Official Firefox tag commit | `9cd094dbc3eac5df87a24e7a871e52880cb8cd42` |
| Node.js | `24.18.0` through nvm-windows |
| npm | `11.16.0` |
| PowerShell | `7.6.4` |
| Windows PowerShell | `5.1.26100.9168` |
| Fennevia package | `0.18.0-beta.1` candidate |

Normal evidence contains no target paths, browsing data, profile data, process
IDs, URLs, titles, or user input.

## 3. Candidate changes

Relative to `v0.17.0-beta.1`, this candidate includes:

- Firefox's bounded untrimmed Urlbar value for a fresh centered address edit,
  while the compact launcher remains trimmed (ADR-082);
- one optional allowlisted Standard content-padding value for Row and Column
  containers, plus owner-default launcher/Tab alignment (ADR-082 and ADR-084);
- a no-drag scrollbar lane that leaves the rest of narrow Top chrome available
  for native window dragging (ADR-083);
- widget-inspector drag yielding through the existing shared drag lifecycle;
- the owner's four-edge default composition, preserving valid saved version-2
  layouts (ADR-084);
- a project-owned customize backdrop that darkens and blocks website pointer
  input without mutating Firefox-owned content DOM (ADR-084);
- Firefox-normalized suggestion query startup while the centered editor retains
  the full untrimmed draft; and
- a bilingual screenshot showcase and generated brand illustration with local
  provenance records.

The candidate adds no dependency, runtime endpoint, telemetry,
content-accessible resource mapping, arbitrary CSS persistence, or replacement
for Firefox-owned security prompts.

## 4. Source and static validation

Correction commit `6484fb62413394dfedde525e776e50f83cebc949`
passed `npm run verify` under Node.js 24.18.0 and npm 11.16.0: 435/435
Node tests, 88.71% line coverage, 81.37% branch coverage, 95.79% function
coverage, every fixed PowerShell 7 suite, dependency audit, deterministic
frontend/bridge generation, and 14/14 accepted production artifacts. The
complete fixed-list suite also passed under Windows PowerShell 5.1, and
`git diff --check` passed before the correction commit and again before this
validation-record commit.

The same clean commit passed the release preflight in a new empty output
directory: exact dependency installation, the complete verification gate, two
byte-identical isolated release builds, strict release-tree checks, and
Unicode-path extraction. Section 7 records its initial archive digest and
package lifecycle.

## 5. Automated real-Firefox 154.0.1 validation

### 5.1 First causal findings and corrections

The initial lifecycle run found three release-candidate integration issues
before publication:

1. The lifecycle harness still searched only Top for the single address
   launcher even though the new default places it with Tabs. Its address and
   navigation checks now locate the launcher across the four project-owned edge
   roots and reveal the launcher's actual edge before focusing it.
2. The composable Application Menu still opened Firefox's native menu but did
   not expose `aria-haspopup="menu"`. Both current and retained rendering paths
   now expose the same popup semantic, with a static regression.
3. Firefox's `gURLBar.value` setter normalized an untrimmed URL before
   `startQuery()`, while the bridge still passed the full draft as the explicit
   query string. Firefox 154.0.1 requires its current value to start with that
   string, so the query failed synchronously. The bridge now reads back and
   queries with Firefox's normalized native value while the custom editor keeps
   its untrimmed draft; a focused unit test reproduces this boundary.

The temporary privacy-safe diagnostic probe recorded only fixed codes, phases,
error names, project stacks, and window kind. It recorded no URL, title, input,
profile path, or other browsing data and was removed before the clean rerun.

### 5.2 Completed automated rows

The isolated candidate profile passed:

- the clean full lifecycle twice after correction, covering existing, second,
  and private windows; address editing and native fallback; tabs, bookmarks,
  downloads; resize, maximize, minimize, fullscreen, and customize; close and
  runtime disposal; and zero unexpected first-party script errors;
- the Browser Toolbox ownership run for the shared frame, four edge roots, and
  centered address-overlay XHTML host;
- the native Urlbar ProvidersManager probe and production suggestion-combobox
  probe, with the native view closed, exact controller restoration, bounded
  projection, and Firefox-owned result execution;
- missing and throwing frontend bundles, six required bridge capability
  failures, complete and broken-package safe start, missing privileged entry,
  and missing lifecycle module, all with native UI retained and exact artifact
  restoration; and
- SessionStore prepare, process restart, lazy background-tab restore,
  fail-open usability, and exact preference/state cleanup.
- three enabled performance cold starts and three same-program/profile
  hard-disabled controls, with expected process cleanup, sub-50-ms edge
  latency, and no retained five-cycle memory growth; and
- exact committed-package hard-disable/recovery plus uninstall, stock startup,
  reinstall, post-install lifecycle, and zero-mutation update preview.

All package and performance rows used the extraction produced from the clean
committed candidate. Results are not promoted from focused tests.

The owner-supplied screenshots provide direct visual evidence for the default
layout and five customize views. They do not prove the complete interaction,
accessibility, popup, multi-window, private-window, failure, or platform matrix.

## 6. Performance controls

All three enabled cold starts crossed the absolute 500,000,000 ns idle-CPU
investigation threshold, so the same copied Firefox and profile were
hard-disabled through the ownership-checked installer for three native-only
controls. Enable was restored in a `finally` path.

| Enabled metric | Run 1 | Run 2 | Run 3 | Median |
| --- | ---: | ---: | ---: | ---: |
| Startup to active (ms) | 2,084 | 1,744 | 1,631 | 1,744 |
| Idle CPU (ns) | 1,836,135,488 | 2,083,288,700 | 1,963,172,712 | 1,963,172,712 |
| Idle memory delta (bytes) | 80,039,936 | 87,568,384 | 114,745,344 | 87,568,384 |
| Edge reveal p95 (ms) | 15.004 | 15.265 | 18.980 | 15.265 |
| Five-cycle CPU (ns) | 8,007,524,112 | 7,837,554,428 | 8,096,252,193 | 8,007,524,112 |
| Five-cycle memory delta (bytes) | -5,046,272 | -49,872,896 | -49,709,056 | -49,709,056 |

| Hard-disabled control | Run 1 | Run 2 | Run 3 | Median |
| --- | ---: | ---: | ---: | ---: |
| Startup to native ready (ms) | 1,629 | 1,711 | 1,544 | 1,629 |
| Idle CPU (ns) | 1,912,093,195 | 1,639,944,592 | 1,749,767,396 | 1,749,767,396 |
| Idle memory delta (bytes) | 117,661,696 | 92,823,552 | 96,354,304 | 96,354,304 |

The enabled idle-CPU median was 1.122 times the hard-disabled control, and the
enabled startup median was 1.071 times the control. The distributions overlap;
all enabled edge-reveal p95 values remained below 50 ms; every enabled
five-window-cycle memory delta was negative; and process counts returned to
their expected values. This comparison does not identify a repeatable
Fennevia-specific idle loop or retained-window leak. It does not waive the
absolute investigation threshold or claim a general Firefox performance
result.

## 7. Initial archive and extracted-package lifecycle

Clean correction commit `6484fb62413394dfedde525e776e50f83cebc949`
passed `scripts/release-preflight.ps1`. Its two independent release builds
produced byte-identical `fennevia-0.18.0-beta.1-windows.zip` archives with
initial SHA-256
`ea18a5b9964a6a5f7efbaa510cc182ea83db2b12c2b8f7465386b39f3a665d63`.
The exact archive also passed checksum validation and strict extraction beneath
`unicode path 測試`.

That exact extraction then passed the marker-owned Firefox 154.0.1 lifecycle:

1. `tests/firefox-release-recovery.ps1` passed hard disable, native-only cold
   start, update repair, enable, and recovered full lifecycle.
2. `Uninstall -WhatIf` identified 18 ownership-proven files and eight
   remove-if-empty directory operations. Applied Uninstall completed all 26
   operations.
3. `--expect-stock` proved native Firefox UI, zero Fennevia records, and no
   owned-file residue.
4. `Install -WhatIf` and applied Install completed all 26 expected operations
   from the same extraction.
5. A post-install full lifecycle passed existing, second, and private windows,
   interaction/layout/fallback checks, and first-party error assertions.
6. The final Update preview returned `already-current` with zero mutations.
7. The ownership pair finished byte-identical and enabled at
   `0.18.0-beta.1`; the active preference existed with no disabled alternate;
   and Firefox process, installer transaction, recovery temporary-root, and
   session-rehearsal residue counts were zero.

The initial digest is not presented as the tag archive digest. This evidence
record changes the source commit embedded in `RELEASE-MANIFEST.json`; the exact
final merge/tag-target preflight and independently downloaded public asset are
checked during publication.

## 8. Package, tag, workflow, and publication

### 8.1 Final source, pull request, and tag

PR [#119](https://github.com/yutinglia/fennevia/pull/119) merged as
`dfa4d2d207a353785998a44544b068b849bc817c` after:

- [PR CI run 33100412020](https://github.com/yutinglia/fennevia/actions/runs/33100412020)
  passed the Windows frontend/package gate in 5 minutes 11 seconds; and
- [PR CodeQL run 33100410078](https://github.com/yutinglia/fennevia/actions/runs/33100410078)
  passed Actions, C#, and JavaScript/TypeScript analysis.

The exact merge commit then passed:

- a new local detached-worktree release preflight, whose .NET Framework
  fallback-compiler archive was 1,414,855 bytes with SHA-256
  `755c822bc37ebe2ab5f15a7d1ae459b8d67b7906e86a1d14d6a945a93e2670bd`;
- [`main` CI run 33100912358](https://github.com/yutinglia/fennevia/actions/runs/33100912358),
  including the Windows PowerShell 5.1 fixed list; and
- [`main` CodeQL run 33100911787](https://github.com/yutinglia/fennevia/actions/runs/33100911787)
  for Actions, C#, and JavaScript/TypeScript.

Annotated tag `v0.18.0-beta.1` has tag-object ID
`6fdf4fa1d3d4d39a1ad8fc8d79889c1b9baefa64` and resolves exactly to that
merge commit. Local and remote tag objects and peeled targets agree.

### 8.2 Workflow and public assets

[Release workflow run 33102000343](https://github.com/yutinglia/fennevia/actions/runs/33102000343)
checked out the annotated tag in two independent `windows-latest` jobs.
`Rehearse exact release` passed in 3 minutes 7 seconds. `Verify draft assets
and publish` independently reran the complete preflight, created the private
draft, verified both GitHub-reported asset digests, and published only after
those checks passed in 3 minutes 3 seconds.

Public prerelease ID `378029865` was published at `2026-08-27T18:14:51Z`
(`2026-08-28T02:14:51+08:00`) at
[`v0.18.0-beta.1`](https://github.com/yutinglia/fennevia/releases/tag/v0.18.0-beta.1).
It is not a draft, is marked prerelease, and contains exactly:

- asset ID `532692972`, `fennevia-0.18.0-beta.1-windows.zip`, 1,415,367
  bytes, GitHub-reported and independently downloaded SHA-256
  `7b35133bbf99ed70a588f8d1c4beb9e4e212e71d4e658819151e51b6c5d44e28`;
- asset ID `532692973`,
  `fennevia-0.18.0-beta.1-windows.zip.sha256`, 101 bytes,
  GitHub-reported and independently downloaded SHA-256
  `924cfd87cb7be693f26d7dddd864db783f4196ac22c18d0ca228971a778c2a9a`.

The downloaded checksum content names the exact archive and reproduces its
hash. Independent extraction beneath a new Unicode path passed the public
package's own strict verifier under both PowerShell 7 and Windows PowerShell
5.1: version `0.18.0-beta.1`, tag `v0.18.0-beta.1`, 39 files, source commit
equal to the tag target, and package-manifest SHA-256
`7f3b5fe3a51d20b920dc7eefa8b12818d5742ee494d7b7327e56c5b4dfdc0228`.

### 8.3 Compiler-specific reproducibility boundary

The final local preflight used ADR-049's normalized .NET Framework `csc.exe`
fallback, while both publishing jobs used the preferred deterministic Roslyn
compiler. Entry-by-entry comparison found the same 38 manifest paths, with
identical content for 37 entries. Only the compiler-derived executable differs:

- local `FenneviaSetup.exe`: 6,144 bytes, SHA-256
  `e104e0dcd83ae76183d7ae8d06866c5948dd25cf702f8b9f241938310621c0f3`;
- public `FenneviaSetup.exe`: 6,656 bytes, SHA-256
  `4488f42d429ea9ef5f60c984edaaeaa2317ae86fc746dd045fc40abed3ef928b`.

The 8,784-byte release manifest records that executable hash, so its local and
public SHA-256 values are respectively
`2b6d3df7df407a90eff924dc3fa43fcf013fe1f9ce3adab2bbf7cef095c88bb3`
and `d2f0d8437dc2cad7e05c6382996acd5024fd0349d5983b5915d3c1be89a8890d`.
Both variants identify the same source commit, tag, 37 other file entries, and
package-manifest hash. Both publishing jobs agreed on the public archive
digest; the project does not claim byte identity across different C# compiler
implementations.

### 8.4 Public-package recovery and retained profile

The independently downloaded public package passed hard disable, native cold
start with zero Fennevia records or hosts, update repair, enable, and a
recovered full lifecycle on the dedicated Firefox 154.0.1 release profile.
Ownership-checked Uninstall and Install previews and applied plans then moved
the public package from that disposable profile to the retained marker-owned
development profile. The final Update preview returned `already-current` with
zero mutations, and the active preference matches the public package byte for
byte.

A generic full-lifecycle invocation after that transfer was not counted as a
pass: the retained profile intentionally stores `single-dynamic` panel reveal,
while the generic harness's early concurrency row waits for Top and Left to be
visible simultaneously and therefore reached
`FENNEVIA_FIREFOX_TEST_TWO_EDGE_HOLD_TIMEOUT`. The same public bytes had just
passed that complete lifecycle in the clean release profile under its
multiple-panel precondition. The retained preference was not changed to make
the assertion pass. Its applicable active/performance harness instead passed
all 12 sequential edge samples with an 11.836 ms p95 and five complete window
cycles with a -67,280,896-byte memory delta and clean process exit. This is a
test-applicability boundary, not positive evidence for the incompatible
two-panel assertion.

The disposable release profile was removed through the marker-checked helper.
The retained installation finishes enabled at `0.18.0-beta.1`; its byte-
identical ownership pair records the public package-manifest SHA-256 above;
the disabled preference is absent; and Firefox-process, installer-transaction,
frontend/bridge/release-recovery temporary-root, and session-rehearsal residue
counts are zero.

## 9. Explicitly unrun or unsupported rows

- The complete current-release matrix is not rerun on Firefox 153.0.4 or
  154.0; those support statements retain their historical evidence and do not
  become new observations for this candidate.
- Manual assistive-technology and hardware-specific rows, including screen
  readers, representative high-DPI display hardware, and live forced-colors
  themes, are not automated by the release harness.
- Live account sign-in, live language switching, hardware-specific permission
  prompts, and representative third-party extension/Urlbar-provider matrices
  require applicable accounts, devices, extensions, and fixtures and remain
  outside this candidate automation.
- GUI double-click, protected Program Files/UAC continuation, and ordinary
  registered-profile installer rows are not run against a user's real Firefox
  target. Static WinForms coverage and marker-owned package CLI operations do
  not substitute for those observations.
- Linux, macOS, ESR, Beta, Nightly, and Firefox versions after 154.0.1 are not
  supported or inferred.

## 10. Release decision boundary

The Windows x64 prerelease decision boundary was satisfied. The reviewed merge
commit passed clean preflight and remote gates; the annotated tag resolves to
that commit; the fail-closed workflow independently verified remote assets
before publication; the downloaded public package passed both PowerShell
verifiers and marker-owned Firefox recovery; and the retained installation
ended enabled with no process or recovery residue. Section 9 and the retained-
profile harness boundary in section 8.4 remain explicit limits on all claims.
