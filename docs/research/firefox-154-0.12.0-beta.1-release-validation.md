# Firefox 154 and Fennevia 0.12.0-beta.1 release validation

## 1. Scope and candidate

- Validation date: 2026-08-23
- Release: `0.12.0-beta.1`, intended annotated tag `v0.12.0-beta.1`
- Base after the final feature merge: PR
  [#98](https://github.com/yutinglia/fennevia/pull/98), merge commit
  `49beced27ed020351e7bb97dd88e92c41719474b`
- Version and release-note commit:
  `4f617ef695b8fa5b71903bf3473cfb073b9704ce`
- Release-candidate runtime fix commit:
  `00620c4a0518a5547c17b5caf3aba09d2b3f1754`
- Disabled performance-control commit:
  `21e81150981619a4b3bc83072df0064c191e8697`
- Validation target: marker-owned copied Firefox program and marker-owned
  development profile; no registered or daily profile was used
- Final status: published prerelease; source/static, real-Firefox candidate,
  exact extracted archive, marker-owned installer lifecycle, annotated tag,
  CI, public-asset, independently downloaded checksum, and post-publication
  recovery evidence complete within the explicit unrun boundaries in section 9

This is a release record, not a wider support claim. The package remains a
Windows x64 prerelease tested on stock Firefox 153.0.4 BuildID
`20260810162159` and Firefox 154.0 BuildID `20260812182057`. The current
candidate was rerun on Firefox 154.0. Linux, macOS, ESR, Beta, Nightly, and
later Firefox releases remain unsupported or untested as stated by the package.

## 2. Environment

| Item | Observed value |
| --- | --- |
| Operating system | Windows 25H2, build `26200.9168`, x64 |
| Firefox | Stock release `154.0` |
| Firefox BuildID | `20260812182057` |
| Firefox SourceStamp | `9ce1ee6baeb9a3c326dbd180bdece65d8fc2eadc` |
| Official Firefox tag commit | `032a9fc1ac0cc3209f7c142744ba2e40847c8086` |
| Node.js | `24.18.0` through nvm-windows |
| npm | `11.16.0` |
| PowerShell | `7.6.4` |
| Windows PowerShell | `5.1.26100.9168` |
| Fennevia package | `0.12.0-beta.1` |

The copied program and profile markers were validated before every harness or
installer mutation. Firefox processes were closed before package actions. The
profile was recycled only through the repository's marker-checked test helper;
no unrelated Firefox installation or profile was changed.

## 3. First causal findings and selected fixes

Release validation found three candidate-level issues. Each was fixed at its
smallest owning boundary rather than hidden in the harness:

1. Top-edge keyboard reveal selected Back even when Firefox history disabled
   it. `TopSurface.svelte` now marks the always-enabled Home control as the
   default focus target.
2. Failed-window disposal cleared every lifecycle dataset marker. While the
   process-scoped startup hide sheet still existed, that made the failed window
   match the startup selector again and could re-hide native Firefox after a
   fail-open transition. Failed disposal now retains only the empty
   `data-fennevia-failed` marker for that document's lifetime; all other
   project lifecycle markers still clear.
3. The real-Firefox recovery wrappers had drifted from the current generated
   bridge and frontend contracts. They now derive recovery inputs from exact
   production artifacts, override only the intended capability, restore exact
   bytes in `finally`, and account for current Svelte, Urlbar, and native UI
   behavior.

No production dependency, content-accessible mapping, runtime network request,
telemetry, or new browsing-data log field was added. The performance control is
test-only and remains inside ADR-034's aggregate-only process-information
boundary.

## 4. Source and static validation

The candidate passed:

- `npm run verify`: format, lint, Svelte/TypeScript checks, 331 Node tests,
  dependency audit, deterministic build, committed generated-artifact check,
  and all 14 production-artifact scans;
- line coverage `87.28%`, function coverage `95.23%`, branch coverage
  `79.20%`; the enforced line/function floors remain 80%;
- the complete fixed-list static PowerShell suite under PowerShell 7 and
  Windows PowerShell 5.1;
- focused lint, format, static privacy, and lifecycle checks after adding the
  disabled performance control;
- `git diff --check` with no whitespace error.

No test was added solely to raise coverage. The disabled performance mode is a
release-diagnostic control for a threshold that actually triggered.

## 5. Real Firefox 154 validation

The following checks passed on Firefox 154.0 BuildID `20260812182057`:

| Check | Result and boundary |
| --- | --- |
| Full lifecycle | Existing, second normal, and private windows; four surfaces; navigation/address/tabs/bookmarks/downloads; resize, maximize, minimize, fullscreen, customize; emergency fallback; partial activation-CSS fail-open; close and runtime disposal; no unexpected first-party error |
| Browser Toolbox | Project namespace/ownership lifecycle probe passed |
| Frontend recovery | Current production bundle mutations failed open and exact bytes were restored |
| Bridge recovery | Boundary, bookmarks, downloads, tabs, navigation, and Urlbar-coverage capability failures each failed open; healthy exact restoration passed |
| Session restore | Fixed prepare, cross-process verify, missing-frontend fail-open, and cleanup sequence passed |
| Shell recovery | Safe start and shell failure recovery passed |
| Missing privileged entry | Native fail-open wrapper passed |
| Urlbar provider probe | Shared Firefox provider-manager contract passed |
| Urlbar suggestions probe | Production combobox projected one fixed direct result, linked the active descendant, retained native execution, restored the controller, and emitted no first-party error |
| Post-disable restore | A full lifecycle rerun after restoring Enable passed |

Focused Urlbar panel evidence was privacy-safe and numeric:

| Field | Observed value |
| --- | ---: |
| Direct result count | 1 |
| Option count | 1 |
| Active descendant linked | true |
| Native row count before execution | 0 |
| Footer item count | 2 |
| Footer second row matched items | true |
| Status column count | 2 |
| Status row height | 48.650 CSS px |
| Native access target height | 32 CSS px |

## 6. Performance threshold investigation

Three enabled cold starts used `--performance-baseline`. All lifecycle and
cleanup assertions passed, but five-second aggregate CPU crossed the existing
500,000,000 ns investigation threshold and the prior Firefox 153 median.

| Enabled metric | Run 1 | Run 2 | Run 3 | Median |
| --- | ---: | ---: | ---: | ---: |
| Startup to active (ms) | 1,484 | 1,350 | 1,186 | 1,350 |
| Idle CPU (ns) | 1,007,433,603 | 1,135,718,505 | 1,188,061,798 | 1,135,718,505 |
| Idle memory delta (bytes) | 64,888,832 | 79,519,744 | 93,769,728 | 79,519,744 |
| Edge reveal p95 (ms) | 17.190 | 10.552 | 9.762 | 10.552 |
| Five-cycle CPU (ns) | 7,007,360,114 | 6,825,814,769 | 6,248,496,090 | 6,825,814,769 |
| Five-cycle memory delta (bytes) | -9,277,440 | -39,354,368 | -10,059,776 | -10,059,776 |
| Idle process count before/after | 8/11 | 8/11 | 8/11 | 8/11 |
| Cycle process count before/after | 11/11 | 11/11 | 11/11 | 11/11 |

The enabled idle CPU median is 2.969 times the accepted Firefox 153 median of
382,488,998 ns, so the threshold could not be waived as noise. The same copied
Firefox and profile were therefore hard-disabled through the ownership-checked
installer. Three `--performance-stock-baseline` cold starts first proved native
UI, zero Fennevia records, and zero project hosts, then reused the exact same
aggregate idle collector. Enable was restored in `finally`.

| Hard-disabled control | Run 1 | Run 2 | Run 3 | Median |
| --- | ---: | ---: | ---: | ---: |
| Startup to native ready (ms) | 1,487 | 1,551 | 1,206 | 1,487 |
| Idle CPU (ns) | 1,421,502,898 | 459,802,705 | 1,138,743,677 | 1,138,743,677 |
| Idle memory delta (bytes) | 119,410,688 | 39,985,152 | 76,201,984 | 76,201,984 |
| Idle process count before/after | 8/11 | 8/11 | 8/11 | 8/11 |

The enabled CPU median was 0.266% lower than the hard-disabled median, with the
same process counts. Enabled median memory movement was 4.354% higher, but both
distributions were noisy startup deltas and there was no retained five-window
memory growth in the enabled runs. This isolates the crossed idle threshold to
Firefox 154/profile startup activity on this machine rather than a
Fennevia-specific idle loop. It does not redefine the Firefox 153 baseline or
claim a general Firefox performance result.

## 7. Exact release archive and installer lifecycle

Clean candidate commit `4df47a80bc1836866ca952fb3e44f468b504ed24`
passed `scripts/release-preflight.ps1` in a new empty output directory. The
preflight ran `npm ci`, the complete `npm run verify` gate, two independent
release builds, byte comparison, strict release-tree validation, and extraction
beneath `unicode path 測試`. Both builds produced
`fennevia-0.12.0-beta.1-windows.zip`; the candidate archive SHA-256 was
`7b39bb723e36a38b8810dddee5a2c03b75fbd3bafc0a98f3876a4dcc1d645528`.

The exact Unicode-path extraction then passed the marker-owned Firefox 154
release lifecycle:

1. `Update -WhatIf` and applied `Update` both returned `already-current` with
   zero mutations.
2. `tests/firefox-release-recovery.ps1` passed hard disable, native-only cold
   start, update repair, enable, exact-byte restoration, and full lifecycle.
3. `Uninstall -WhatIf` identified 18 ownership-proven files and eight
   remove-if-empty directory operations. Applied Uninstall completed all 26
   operations.
4. `--expect-stock` cold start proved native Firefox UI, zero Fennevia records,
   and no owned-file residue.
5. `Install -WhatIf` and applied Install used the same extracted package and
   completed the expected 26 directory/file/ownership operations.
6. A post-install full lifecycle passed existing, second, and private windows,
   interaction/layout/fallback checks, and first-party error assertions.
7. A final extracted-package Update preview returned `already-current` with
   zero mutations. The ownership pair was byte-identical, the active preference
   existed with no disabled alternate, and there was no Firefox process,
   transaction directory, bridge-recovery sibling, or session-rehearsal state.

The candidate preflight digest above is not presented as the tag archive digest:
this evidence record changes the source commit embedded in
`RELEASE-MANIFEST.json`. The exact tag-target preflight and public asset digest
are therefore observed after this commit and recorded in section 8.

## 8. Tag, CI, and public prerelease

Annotated tag `v0.12.0-beta.1` has tag-object ID
`9212e8c4c00e0615483fa10779428b69a13c0812` and resolves exactly to source
commit `6c2942496a14df1baad2e1ab1b02acaf181beb82`. The local and remote tag
objects agree.

Before the tag was pushed:

- [`main` CI run 32599921646](https://github.com/yutinglia/fennevia/actions/runs/32599921646)
  passed the complete Windows job in 4 minutes 17 seconds, including both
  PowerShell 7 and Windows PowerShell 5.1 fixed lists;
- [CodeQL run 32599921186](https://github.com/yutinglia/fennevia/actions/runs/32599921186)
  passed its Actions, C#, and JavaScript/TypeScript analyses;
- the annotated-tag preflight resolved the tag to the same source commit and
  reproduced the local fallback-compiler archive digest recorded below.

[Release workflow run 32600158020](https://github.com/yutinglia/fennevia/actions/runs/32600158020)
then checked out the annotated tag in two independent `windows-latest` jobs.
`Rehearse exact release` passed in 3 minutes 32 seconds. `Verify draft assets
and publish` independently reran the complete preflight, created the private
draft, verified both GitHub-reported asset digests, published the numeric
release ID, and passed in 3 minutes 13 seconds.

Public prerelease ID `375047234` was published at `2026-08-22T21:44:54Z`
(`2026-08-23T05:44:54+08:00`):
<https://github.com/yutinglia/fennevia/releases/tag/v0.12.0-beta.1>. It is not a
draft, is marked prerelease, and contains exactly:

- asset ID `525480187`, `fennevia-0.12.0-beta.1-windows.zip`, 1,182,959 bytes,
  GitHub and independently downloaded SHA-256
  `3fa1ebcb072b7a7475a83d141b7586e4371cfb17f5ccf65871d8927aafece0bc`;
- asset ID `525480188`,
  `fennevia-0.12.0-beta.1-windows.zip.sha256`, 101 bytes, GitHub and
  independently downloaded SHA-256
  `dcecac82de2b17d51a105a6f9abdb1e34a32deff3fa64d97647ecd83c82c2474`.

The downloaded checksum content names the exact archive and reproduces its
hash. Extraction beneath `unicode public 測試` passed the public package's own
strict verifier: version `0.12.0-beta.1`, tag `v0.12.0-beta.1`, 39 files,
source commit equal to the tag target, and package-manifest SHA-256
`22820467602eaee13ced8a6c2e500dacfdbdcf35bde9a6c959b3c5fbeafcd61f`.
The downloaded public package then passed hard disable, native cold start,
update repair, enable, and recovered full lifecycle on the marker-owned Firefox
154 target.

### Compiler-specific reproducibility boundary

The final local Windows preflight used ADR-049's .NET Framework `csc.exe`
fallback because Roslyn was not installed. It deterministically produced a
1,182,447-byte archive with SHA-256
`822ecdd21930f58ca705639e4e41ae0bfb0928fb64c799034714bf1f18d8e8e3`.
The two GitHub `windows-latest` jobs used ADR-049's preferred Roslyn
`/deterministic` path and independently agreed on the published digest above.

Entry-by-entry comparison found identical names, timestamps, attributes, and
content except for `FenneviaSetup.exe` and the release manifest field that
records its hash. The normalized fallback executable was 6,144 bytes with
SHA-256 `e104e0dcd83ae76183d7ae8d06866c5948dd25cf702f8b9f241938310621c0f3`;
the published deterministic Roslyn executable is 6,656 bytes with SHA-256
`4488f42d429ea9ef5f60c984edaaeaa2317ae86fc746dd045fc40abed3ef928b`.
This is the documented two-compiler output boundary, not a mismatch between the
two publishing jobs or between the public asset and its checksum. The project
does not claim byte identity across different C# compiler implementations.

The final marker-owned test installation is enabled at `0.12.0-beta.1`, its
ownership pair is byte-identical, an extracted-public-package Update preview is
`already-current` with zero mutations, and Firefox process, installer
transaction, bridge-recovery sibling, and session-rehearsal residue counts are
all zero.

## 9. Explicitly unrun or unsupported rows

- The complete current-candidate matrix was not rerun on Firefox 153.0.4; its
  support statement relies on the retained Firefox 153 release and feature
  records plus no removed compatibility branch. This is not presented as a new
  Firefox 153 run.
- Live account sign-in, live language switching, hardware-specific permission
  prompts, and third-party extension/provider matrices were not run because the
  isolated release profile had no applicable account, device, or fixture.
- The GUI double-click, protected Program Files/UAC continuation, and ordinary
  registered-profile installer rows were not run against a user's real Firefox
  target. Automated WinForms/static coverage and the marker-owned extracted
  package CLI lifecycle do not substitute for those observations.
- Linux, macOS, ESR, Beta, Nightly, and Firefox versions after 154 are not
  supported or inferred.

## 10. Release decision

The prerelease decision boundary was satisfied: sections 7 and 8 contain
observed passing evidence; the tag target was clean and matched pushed `main`;
the marker-owned test target ended enabled with exact package bytes and no
process/recovery residue; and the fail-closed workflow independently verified
both remote asset digests before publication. Section 9 remains the explicit
limit on compatibility, manual GUI, device, account, and platform claims.
