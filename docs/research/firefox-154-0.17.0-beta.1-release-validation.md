# Firefox 154.0.1 and Fennevia 0.17.0-beta.1 release validation

## 1. Scope and release

- Validation date: 2026-08-26
- Release: `0.17.0-beta.1`, annotated tag `v0.17.0-beta.1`
- Release-preparation commit:
  `36855b90a80752c006647508cae2909b46141307`
- Real-Firefox harness refresh commit:
  `8e041150367774fd4a551852688230c155cffc0d`
- Reviewed merge and tag target:
  `f4acb2fe5f0badb633b213f4a4c3cd5ab7d04dd4`
- Target: stock Firefox 154.0.1 release, BuildID `20260824154132`, in a
  marker-owned copied program and a dedicated marker-owned release profile
- Final status: published prerelease; source/static, automated real-Firefox,
  performance-control, deterministic archive, extracted-package lifecycle,
  pull-request and `main` CI/CodeQL, annotated tag, release workflow, public
  asset, independent download, Unicode-path extraction, and public-package
  recovery checks passed within section 10's explicit unrun boundaries

No registered or ordinary Firefox profile was used. The pre-existing
marker-owned development profile was preserved while the release matrix ran in
a fresh dedicated profile, then restored as the final enabled package target.

This is a package-specific validation record, not a wider support claim.
Retained Firefox 153.0.4 and 154.0 evidence remains in the existing historical
records. Linux, macOS, ESR, Beta, Nightly, and later Firefox releases are not
inferred.

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
| Fennevia package | `0.17.0-beta.1` |

The copied-program and profile ownership markers were validated before harness
or installer mutations. Firefox processes were closed before every package
action. Normal evidence contains no target paths, browsing data, profile data,
process IDs, URLs, titles, or user input.

## 3. Candidate changes

Relative to `v0.16.0-beta.1`, this candidate includes:

- a feature-first customize palette with adjacent companion actions and an
  optional localized layout Guide (ADR-078);
- a search-first address popup and one bounded retry for the first completed
  empty zero-prefix Firefox Urlbar query (ADR-079);
- a viewport-driven narrow four-panel mosaic at 560 and 360 CSS px (ADR-080);
- a 16 CSS pixel tab-detach intent threshold, child drag-event ownership, and
  same-window stale-transfer recovery (ADR-081);
- synchronous Fluent-first built-in widget labels before the legacy
  CustomizableUI fallback.

The release adds no dependency, runtime endpoint, telemetry, content-accessible
resource mapping, arbitrary persistence, or replacement for Firefox-owned
security prompts.

## 4. First causal finding and selected fix

The first full lifecycle run found that the real-Firefox harness had not been
updated with the composable-toolbar work completed after the last complete
release matrix. Production runtime and focused tests already used the current
contracts. The stale release harness still assumed:

- seven native-hide rules instead of the current ten;
- the address launcher and Trust status on Left instead of Top;
- one grouped Browser Tools container instead of independent composable tools;
- the old project-widget selector for the temporary Downloads placement;
- an unmount/remount bridge fixture without the required toolbar-widget
  contract; and
- a `pointerout` with no destination for ordinary movement into browser
  content, which the current controller correctly reserves for a real
  window-leave path.

The harness now derives its expectations from the current default composition,
supplies one minimal valid toolbar snapshot at the remount boundary, addresses
stable independent tool selectors, and distinguishes movement into the browser
from an actual window leave through `relatedTarget`. Temporary narrow
diagnostics used to isolate these mismatches were removed after the corrected
lifecycle and performance modes passed.

This was test-harness drift, not a production runtime defect. No production
module, generated runtime artifact, dependency, data flow, logging boundary, or
Firefox capability contract changed.

## 5. Source and static validation

The candidate passed:

- `npm run verify`: formatting, lint, Svelte/TypeScript checks, 429 Node tests,
  the enforced coverage floors, dependency audit, deterministic build,
  committed generated-artifact comparison, and all 14 production-artifact
  scans;
- line coverage `88.48%`, function coverage `95.63%`, and branch coverage
  `81.01%`; the enforced line/function floors remain 80%;
- the complete fixed-list static PowerShell suite under PowerShell 7 and
  Windows PowerShell 5.1; and
- `git diff --check` with no whitespace error.

No test was added solely to raise coverage. The lifecycle changes refresh a
real release gate that failed against current Firefox/package behavior.

## 6. Automated real-Firefox 154.0.1 validation

The dedicated clean release profile and the exact Unicode-path extraction of
the candidate package passed:

| Check | Result and boundary |
| --- | --- |
| Full lifecycle | Existing, second normal, and private windows; four edges; navigation, address, tabs, bookmarks, downloads, resize, maximize, minimize, fullscreen, customize mode, emergency fallback, partial activation-CSS fail-open, close/disposal, and no unexpected first-party error |
| Browser Toolbox | Shared frame, four edge hosts, and the centered address-overlay XHTML ownership boundaries passed |
| Frontend recovery | Missing and throwing production frontend mutations failed open; exact bytes were restored; a healthy full lifecycle passed |
| Bridge recovery | Boundary, bookmarks, downloads, tabs, navigation, and Urlbar-coverage missing-capability mutations failed open; exact bytes were restored; a healthy full lifecycle passed |
| Shell recovery | Complete-package safe start, broken-package safe start, and restored ordinary startup passed |
| Missing privileged entry | Missing WindowManager dependency failed open to usable native Firefox; exact bytes were restored |
| Session restore | Prepare, cross-process native/Fennevia order, pinned/selected/lazy pending tabs, missing-frontend fail-open, cleanup, preference restoration, and rehearsal-state removal passed |
| Urlbar provider probe | One bounded batch completed through the per-window provider manager; controller and native-view state were restored |
| Production suggestions probe | The combobox projected one direct result, retained accessible ownership and Firefox execution, restored the controller, and closed the native view |
| Performance and cleanup | Six enabled cold starts and six hard-disabled controls completed; every enabled run also completed five open/close cycles without retained process-count or memory-growth threshold failure |
| Release recovery | Exact staged package hard-disable, native cold start, update repair, enable, and recovered full lifecycle passed |
| Extracted-package lifecycle | Uninstall preview/apply, stock cold start, install preview/apply, post-install full lifecycle, and zero-mutation `already-current` update preview passed |

Representative commands, with local paths intentionally abstracted, were:

```powershell
node .\tests\firefox-window-lifecycle.mjs --firefox <COPIED_FIREFOX> --profile <RELEASE_PROFILE>
node .\tests\firefox-window-lifecycle.mjs --firefox <COPIED_FIREFOX> --profile <RELEASE_PROFILE> --browser-toolbox
node .\tests\firefox-window-lifecycle.mjs --firefox <COPIED_FIREFOX> --profile <RELEASE_PROFILE> --urlbar-provider-probe
node .\tests\firefox-window-lifecycle.mjs --firefox <COPIED_FIREFOX> --profile <RELEASE_PROFILE> --urlbar-suggestions-probe
pwsh -NoProfile -File .\tests\firefox-frontend-recovery.Tests.ps1 -FirefoxPath <COPIED_FIREFOX> -ProfilePath <RELEASE_PROFILE>
pwsh -NoProfile -File .\tests\firefox-bridge-recovery.Tests.ps1 -FirefoxPath <COPIED_FIREFOX> -ProfilePath <RELEASE_PROFILE>
pwsh -NoProfile -File .\tests\firefox-shell-recovery.Tests.ps1 -FirefoxPath <COPIED_FIREFOX> -ProfilePath <RELEASE_PROFILE>
pwsh -NoProfile -File .\tests\firefox-fail-open.Tests.ps1 -FirefoxPath <COPIED_FIREFOX> -ProfilePath <RELEASE_PROFILE>
pwsh -NoProfile -File .\tests\firefox-session-restore.ps1 -FirefoxPath <COPIED_FIREFOX> -ProfilePath <RELEASE_PROFILE>
pwsh -NoProfile -File .\tests\firefox-release-recovery.ps1 -FirefoxPath <COPIED_FIREFOX> -ProfilePath <RELEASE_PROFILE> -PackageRoot <EXTRACTED_RELEASE_ROOT>
```

### Urlbar privacy-safe evidence

The provider-contract probe returned:

| Field | Observed value |
| --- | ---: |
| Batch count | 1 |
| Maximum result count | 1 |
| Result source/type counts | 1 / 1 |
| Row-backed/selectable-row counts | 0 / 0 |
| Controller restored | true |
| Native view closed | true |
| Value set through Firefox contract | true |

The production-panel probe returned:

| Field | Observed value |
| --- | ---: |
| Direct result / option counts | 1 / 1 |
| Active descendant linked | true |
| Combobox / listbox / aria-autocomplete contracts | true / true / true |
| Native result/row counts before execution | 0 / 0 |
| Controller restored before/after execution | true / true |
| Native view closed before/after execution | true / true |
| Internal page committed | true |
| Utility controls share one row | true |
| Utility column count | 3 |
| Utility row/strip height | 48.800 CSS px |
| Native access target height | 40 CSS px |

The isolated profile had already completed earlier candidate launches before
the provider probe. Therefore ADR-079's literal fresh-profile, first-ever
zero-prefix retry ordering was not observed in this matrix and remains explicit
in section 10; focused source/unit evidence is not promoted into that row.

## 7. Performance threshold investigation

The existing five-second aggregate-CPU investigation threshold triggered, so
the candidate was compared with the same copied Firefox and profile while the
ownership-checked installer was hard-disabled. Each mode first proved its
expected enabled or native-only state. Enable was restored in a `finally` path.

The first three-run comparison was noisy but showed a lower hard-disabled
median, so the complete three-plus-three comparison was repeated as required by
the update workflow.

| Enabled metric | Run 1 | Run 2 | Run 3 | Median | Run 4 | Run 5 | Run 6 | Median |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Startup to active (ms) | 1,818 | 1,369 | 1,589 | 1,589 | 2,014 | 1,603 | 2,250 | 2,014 |
| Idle CPU (ns) | 563,126,601 | 1,093,293,101 | 1,182,068,311 | 1,093,293,101 | 662,075,306 | 1,408,649,913 | 1,589,146,899 | 1,408,649,913 |
| Idle memory delta (bytes) | 39,882,752 | 52,248,576 | 67,461,120 | 52,248,576 | 41,840,640 | 67,219,456 | 40,161,280 | 41,840,640 |
| Edge reveal p95 (ms) | 17.550 | 20.031 | 18.588 | 18.588 | 19.952 | 17.823 | 15.656 | 17.823 |
| Five-cycle CPU (ns) | 7,062,711,887 | 6,531,006,456 | 7,497,661,268 | 7,062,711,887 | 7,785,013,601 | 8,279,370,084 | 9,159,701,847 | 8,279,370,084 |
| Five-cycle memory delta (bytes) | -90,537,984 | -30,060,544 | -68,599,808 | -68,599,808 | -87,871,488 | -9,609,216 | 31,395,840 | -9,609,216 |

| Hard-disabled control | Run 1 | Run 2 | Run 3 | Median | Run 4 | Run 5 | Run 6 | Median |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Startup to native ready (ms) | 1,608 | 1,603 | 1,685 | 1,608 | 1,971 | 1,837 | 1,454 | 1,837 |
| Idle CPU (ns) | 1,246,757,103 | 563,460,006 | 714,459,105 | 714,459,105 | 1,549,803,634 | 651,752,417 | 1,614,252,507 | 1,549,803,634 |
| Idle memory delta (bytes) | 61,317,120 | 43,040,768 | 41,967,616 | 43,040,768 | 70,848,512 | 38,850,560 | 95,461,376 | 70,848,512 |

The first enabled idle-CPU median was 1.530 times its hard-disabled control;
the repeated enabled median was 0.909 times its control. Individual
distributions overlap, and the direction did not reproduce. The six-run
medians were 1,137,680,706 ns enabled and 980,608,104 ns hard-disabled, a 1.160
ratio. Both modes crossed the absolute investigation threshold, while edge
latency stayed below 50 ms, process counts returned to the expected values, and
no enabled run retained more than 64 MiB after five complete window cycles.

This evidence does not identify a repeatable Fennevia-specific idle loop or
leak. It also does not waive the absolute threshold, redefine a baseline, or
claim a general Firefox performance result; cold-start process activity on this
machine remains visibly noisy.

## 8. Initial archive and extracted-package lifecycle

Clean release-preparation commit
`36855b90a80752c006647508cae2909b46141307` passed
`scripts/release-preflight.ps1` in a new empty output directory. The preflight
ran `npm ci`, the complete `npm run verify` gate, two independent release
builds, byte comparison, strict release-tree validation, and extraction beneath
`unicode path 測試`. The initial archive SHA-256 was
`2957466187171d1bfd8714670ecd0f2e70189cc485b3ba4bfbfba81203ceb4c2`.

That exact extraction then passed the marker-owned Firefox 154.0.1 lifecycle:

1. `tests/firefox-release-recovery.ps1` passed hard disable, native-only cold
   start, update repair, enable, and recovered full lifecycle.
2. `Uninstall -WhatIf` identified 18 ownership-proven files and eight
   remove-if-empty directory operations. Applied Uninstall completed all 26
   operations.
3. `--expect-stock` proved native Firefox UI, zero Fennevia records, and no
   owned-file residue.
4. `Install -WhatIf` and applied Install completed the expected 26
   directory/file/ownership operations from the same extraction.
5. A post-install full lifecycle passed existing, second, and private windows,
   interaction/layout/fallback checks, and first-party error assertions.
6. The final Update preview returned `already-current` with zero mutations.
7. The ownership pair was byte-identical and enabled at `0.17.0-beta.1`; the
   active preference existed with no disabled alternate; Firefox process,
   transaction-directory, bridge-recovery sibling, temporary recovery-root,
   and session-rehearsal residue counts were zero.

The initial digest is not presented as the tag archive digest. The harness and
this evidence record change the source commit embedded in
`RELEASE-MANIFEST.json`; the exact final/tag-target preflight and independently
downloaded public asset were therefore checked separately.

After PR #117 merged, clean merge commit
`f4acb2fe5f0badb633b213f4a4c3cd5ab7d04dd4` independently passed the same
complete preflight in a new detached worktree. Its .NET Framework fallback-
compiler archive was 1,406,235 bytes with SHA-256
`ac299d396c8313cd8f736f99b324e7ecc50dfa556eed5f4df21df1bedb2ec14c`.

## 9. Tag, CI, and public prerelease

PR [#117](https://github.com/yutinglia/fennevia/pull/117) merged as
`f4acb2fe5f0badb633b213f4a4c3cd5ab7d04dd4` after:

- [CI run 32915373578](https://github.com/yutinglia/fennevia/actions/runs/32915373578)
  passed the Windows package gate in 3 minutes 55 seconds; and
- [CodeQL run 32915372781](https://github.com/yutinglia/fennevia/actions/runs/32915372781)
  passed Actions, C#, and JavaScript/TypeScript analysis.

The exact merge commit then passed:

- [`main` CI run 32915668136](https://github.com/yutinglia/fennevia/actions/runs/32915668136)
  in 5 minutes, including the Windows PowerShell 5.1 fixed list; and
- [`main` CodeQL run 32915667600](https://github.com/yutinglia/fennevia/actions/runs/32915667600)
  for Actions, C#, and JavaScript/TypeScript.

Annotated tag `v0.17.0-beta.1` has tag-object ID
`d239f750f304adecd11b5f3774d19adaad53abfa` and resolves exactly to that
merge commit. Local and remote tag objects and peeled targets agree.

[Release workflow run 32916402282](https://github.com/yutinglia/fennevia/actions/runs/32916402282)
checked out the annotated tag in two independent `windows-latest` jobs.
`Rehearse exact release` passed in 3 minutes 27 seconds. `Verify draft assets
and publish` independently reran the complete preflight, created the private
draft, verified both GitHub-reported asset digests, and published only after
those checks passed in 3 minutes 8 seconds.

Public prerelease ID `376803607` was published at `2026-08-26T00:52:53Z`
(`2026-08-26T08:52:53+08:00`) at
[`v0.17.0-beta.1`](https://github.com/yutinglia/fennevia/releases/tag/v0.17.0-beta.1).
It is not a draft, is marked prerelease, and contains exactly:

- asset ID `530017059`, `fennevia-0.17.0-beta.1-windows.zip`, 1,406,747
  bytes, GitHub-reported and independently downloaded SHA-256
  `c1fdc6ca600a52f877e47ef4119a0db35b32f71315575830ad1098b1dedc4f22`;
- asset ID `530017060`,
  `fennevia-0.17.0-beta.1-windows.zip.sha256`, 101 bytes,
  GitHub-reported and independently downloaded SHA-256
  `f2466f3540ce1772b8d9ff0e8f39a274623523cbda1a10af5df3cacff6b0c80a`.

The downloaded checksum content names the exact archive and reproduces its
hash. Independent extraction beneath new Unicode paths passed the public
package's strict verifier under both PowerShell 7 and Windows PowerShell 5.1:
version `0.17.0-beta.1`, tag `v0.17.0-beta.1`, 39 files, source commit equal to
the tag target, and package-manifest SHA-256
`dfa51224567f5da552fe1e3a28332783a8d4312404057a745f416e03fc4cf112`.

### Compiler-specific reproducibility boundary

The final local preflight used ADR-049's normalized .NET Framework `csc.exe`
fallback, while both publishing jobs used the preferred deterministic Roslyn
compiler. Entry-by-entry comparison found the same 39 paths, with identical
content for 37 files. Only these compiler-derived records differ:

- local `FenneviaSetup.exe`: 6,144 bytes, SHA-256
  `e104e0dcd83ae76183d7ae8d06866c5948dd25cf702f8b9f241938310621c0f3`;
- public `FenneviaSetup.exe`: 6,656 bytes, SHA-256
  `4488f42d429ea9ef5f60c984edaaeaa2317ae86fc746dd045fc40abed3ef928b`;
- local `RELEASE-MANIFEST.json`: 8,784 bytes, SHA-256
  `d1ac79afddb225ba62fe0a24b1c4c1a49f7e685aef2c80344115d9ddc0ce5ed2`;
- public `RELEASE-MANIFEST.json`: 8,784 bytes, SHA-256
  `84df2dcbb01acc686a9ed34a4f840b571bbb7eec292c3f98ae676d8f58d0098b`.

The manifest difference records the executable hash. Both publishing jobs
agreed on the public archive digest; the project does not claim byte identity
across different C# compiler implementations.

The independently downloaded public package then passed hard disable, native
cold start with zero Fennevia records or hosts, update repair, enable, and a
recovered full lifecycle on Firefox 154.0.1. Finally, the public package was
transferred through ownership-checked Uninstall/Install previews and applied
plans from the disposable release profile back to the preserved development
profile. The original preference file remained byte-identical. The disposable
profile was removed through the marker-checked helper. The final installation
is enabled at `0.17.0-beta.1`, its ownership pair and public package-manifest
hash agree, and Firefox-process, disabled-preference, transaction, bridge-
recovery, and session-rehearsal residue counts are zero.

## 10. Explicitly unrun or unsupported rows

- The complete current-release matrix was not rerun on Firefox 153.0.4 or
  154.0; those support statements rely on retained release/feature records plus
  no removed compatibility branch. They are not presented as new runs.
- ADR-079's literal fresh-profile first-ever zero-prefix ordering was not run,
  because the isolated profile had already completed earlier candidate
  launches before the provider probe.
- Manual visual and assistive-technology rows, including representative high
  DPI/display-scale hardware, screen readers, real forced-colors themes,
  first-paint observation, and every popup-placement/customize combination,
  were not run by the automated harness.
- Live account sign-in, live language switching, hardware-specific permission
  prompts, and representative third-party extension/Urlbar-provider matrices
  were not run because the isolated profile had no applicable account, device,
  extension, or fixture.
- The GUI double-click, protected Program Files/UAC continuation, and ordinary
  registered-profile installer rows were not run against a user's real Firefox
  target. Automated WinForms/static coverage and the marker-owned extracted
  package CLI lifecycle do not substitute for those observations.
- Linux, macOS, ESR, Beta, Nightly, and Firefox versions after 154.0.1 are not
  supported or inferred.

## 11. Release decision boundary

The Windows x64 prerelease decision boundary was satisfied. The reviewed merge
commit passed clean preflight and remote gates; the annotated tag resolves to
that commit; the fail-closed workflow independently verified the remote assets
before publication; the downloaded public package passed both PowerShell
verifiers and marker-owned recovery; and the preserved test installation ended
enabled with no process or recovery residue.

Section 10 remains the explicit limit on compatibility, manual GUI, visual,
assistive, device, account, provider, and platform claims.
