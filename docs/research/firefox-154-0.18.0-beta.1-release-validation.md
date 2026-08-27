# Firefox 154.0.1 and Fennevia 0.18.0-beta.1 release validation

## 1. Scope and release

- Validation date: 2026-08-28
- Release candidate: `0.18.0-beta.1`, intended annotated tag
  `v0.18.0-beta.1`
- Feature commit: `a3ea3aedbfe0bb36f7ec4e6c1ecd8c8ba182408c`
- Release-preparation commit: `6f0890341ba5424371231ee21e071c79bbc54b37`
- Release-validation correction commit:
  `6484fb62413394dfedde525e776e50f83cebc949`
- Reviewed merge/tag target: pending pull-request merge
- Target: stock Firefox 154.0.1 release, BuildID `20260824154132`, in a
  marker-owned copied program and dedicated marker-owned release profile
- Candidate status: committed candidate validation passed; publication
  evidence is recorded only after the annotated-tag workflow succeeds

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

Clean candidate and final merge preflight digests, pull-request checks,
annotated-tag identity, release workflow jobs, asset IDs/digests, independent
download verification, and public-package recovery remain pending until their
respective states exist. No future result is inferred here.

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

No blocker was found inside the automated Windows x64 candidate boundary. The
remaining publication conditions are a clean final merge-commit preflight,
passing pull-request and `main` checks, an annotated tag resolving to the
reviewed source, a passing release workflow, exact public asset inventory and
digests, independent download verification, and final marker-owned
public-package recovery. Section 9 remains the explicit limit on all eventual
claims.
