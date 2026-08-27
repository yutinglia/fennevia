# Firefox 154.0.1 and Fennevia 0.18.0-beta.1 release validation

## 1. Scope and release

- Validation date: 2026-08-28
- Release candidate: `0.18.0-beta.1`, intended annotated tag
  `v0.18.0-beta.1`
- Feature commit: `a3ea3aedbfe0bb36f7ec4e6c1ecd8c8ba182408c`
- Release-preparation commit: pending until this record and candidate checks are
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
  input without mutating Firefox-owned content DOM (ADR-084); and
- a bilingual screenshot showcase and generated brand illustration with local
  provenance records.

The candidate adds no dependency, runtime endpoint, telemetry,
content-accessible resource mapping, arbitrary CSS persistence, or replacement
for Firefox-owned security prompts.

## 4. Source and static validation

The candidate validation will record the final committed results for:

- `npm run verify` under Node.js 24.18.0;
- the complete fixed-list suite under Windows PowerShell 5.1;
- deterministic generated artifacts and the 14-file production scan;
- `git diff --check`; and
- a clean-tree double release build with strict Unicode-path extraction.

## 5. Automated real-Firefox 154.0.1 validation

The release profile will run the project lifecycle, Browser Toolbox ownership,
frontend/bridge/shell/missing-entry recovery, SessionStore rehearsal, Urlbar
provider and production-panel probes, performance/cleanup controls, release
recovery, and extracted-package lifecycle. Results are not promoted from
focused tests and will be added only after the candidate run finishes.

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
