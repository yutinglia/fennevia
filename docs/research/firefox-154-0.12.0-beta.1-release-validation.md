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
- Status at record creation: source/static and real-Firefox candidate checks
  complete; exact extracted archive, installer lifecycle, annotated tag, CI,
  and public-asset evidence are recorded in later sections after they run

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

Pending at record creation. Before tagging, the final clean commit must pass
the release preflight into a new empty output directory, produce two
byte-identical archives, validate the Unicode/space extraction, and run the
exact extracted package through update, recovery, hard-disable, uninstall,
stock cold start, install, and final full-lifecycle checks. Exact results and
the archive digest will replace this paragraph.

## 8. Tag, CI, and public prerelease

Pending at record creation. The annotated tag object, tag target, `main` CI,
tag-triggered release workflow, public prerelease URL, exact asset names,
sizes, and SHA-256 verification will be recorded only after observed success.

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

## 10. Release decision boundary

Publication is permitted only after sections 7 and 8 contain observed passing
evidence, the worktree is clean, the installed marker-owned target is enabled
with exact candidate bytes, no Firefox test process or recovery residue remains,
and GitHub has no conflicting tag, draft, or public release. Any failure remains
a blocker rather than an omitted matrix row.
