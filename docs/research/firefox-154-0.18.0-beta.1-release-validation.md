# Firefox 154.0.1 and Fennevia 0.18.0-beta.1 release validation

## 1. Scope and release

- Validation date: 2026-08-28
- Release candidate: `0.18.0-beta.1`, intended annotated tag
  `v0.18.0-beta.1`
- Feature commit: `a3ea3aedbfe0bb36f7ec4e6c1ecd8c8ba182408c`
- Release-preparation commit: `6f0890341ba5424371231ee21e071c79bbc54b37`
- Release-validation correction commit: pending until the findings below are
  committed
- Reviewed merge/tag target: pending pull-request merge
- Target: stock Firefox 154.0.1 release, BuildID `20260824154132`, in a
  marker-owned copied program and dedicated marker-owned release profile
- Candidate status: validation in progress; publication evidence is recorded
  only after the annotated-tag workflow succeeds

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

The correction passed `npm run verify` under Node.js 24.18.0 and npm 11.16.0:
435/435 Node tests, 88.71% line coverage, 81.37% branch coverage, 95.79%
function coverage, every fixed PowerShell 7 suite, dependency audit,
deterministic frontend/bridge generation, and 14/14 accepted production
artifacts. The complete fixed-list suite also passed under Windows PowerShell
5.1. `git diff --check` passed before this record update and will be repeated
before commit.

The clean-tree deterministic double release build, strict Unicode-path
extraction, archive digest, and committed-tree package recovery remain pending
until this correction is committed.

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

Performance controls, committed release-package recovery, and extracted-package
lifecycle remain pending until the correction is committed and a clean source
candidate can be built. Results are not promoted from focused tests.

The owner-supplied screenshots provide direct visual evidence for the default
layout and five customize views. They do not prove the complete interaction,
accessibility, popup, multi-window, private-window, failure, or platform matrix.

## 6. Package, tag, workflow, and publication

Clean candidate and final merge preflight digests, pull-request checks,
annotated-tag identity, release workflow jobs, asset IDs/digests, independent
download verification, and public-package recovery remain pending until their
respective states exist. No future result is inferred here.

## 7. Explicitly unrun or unsupported rows

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

## 8. Release decision boundary

The prerelease decision remains pending until the committed candidate passes
its source/static, marker-owned Firefox, deterministic package, pull-request,
annotated-tag, workflow, remote-asset, independent-download, and recovery
checks. Section 7 remains the explicit limit on all eventual claims.
