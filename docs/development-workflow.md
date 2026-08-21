# Development Workflow

## 1. Issue-first execution

Every implementation, research, or documentation change should be linked to a
GitHub issue when a suitable issue exists.

Before starting:

1. Read `AGENTS.md`.
2. Read `plans/000-master-plan.md` and, for shell work,
   `plans/002-shell-roadmap.md`.
3. Read the complete issue body, blockers, accepted ADRs, linked research
   records, and current implementation.
4. Inspect the most recent relevant commits and merged pull requests.
5. Confirm blockers are complete or explicitly changed by the owner.
6. Restate scope, non-goals, and acceptance criteria in working notes.
7. Separate pure/static coverage from behavior that requires real Firefox.
8. Check security-review triggers in `docs/security-controls.md`.
9. Complete `docs/dependency-review-template.md` before any dependency or
   lockfile change.

For Windows Firefox work, create and verify the marker-owned direct-path profile
from `docs/development-setup.md` before changing privileged runtime or browser
chrome. The recommended entry is `pwsh -NoProfile -File .\scripts\fennevia.ps1`
or `npm run env`.

Do not silently expand scope. Useful but non-required work becomes a follow-up
issue.

## 2. Current dependency order

The common bootstrap, runtime, recovery, frontend, bridge, tabs, and four-edge
frame are complete.

Current feature order:

```text
#31 four-edge frame (complete)
├─ #12 top navigation (complete)
├─ #14 right bookmarks (complete)
├─ #32 bottom downloads (complete)
└─ #11 left tabs (complete)
    └─ #60 left-tab native parity (complete; groups still deferred)
    └─ #13 compact address/status launcher and popup (complete; depends on #12)
        └─ #37 fuller Urlbar permissions/page-action coverage (complete)
            └─ #15 content-only activation (complete)
                └─ #16 hardening and Firefox-update workflow (complete)
```

#15 completed the exact reversible content-only gate and retained #37's native
Urlbar reveal/focus path. #16 completed the regression, resource,
installer-repair, and Firefox-stable-update procedure work without adding a
second edge controller or a new product feature. The executable update
procedure is `docs/firefox-update-workflow.md`. Issue #18 completed the MPL-2.0
project/inbound license and third-party provenance gate; all copied/adapted or
distributed material follows `docs/licensing-and-provenance.md` and
`THIRD_PARTY_NOTICES.md`.

Issue #39 established the first versioned distribution gate after #16 and #18
and produced the verified public `v0.10.0-beta.1` prerelease. The current
published package is `v0.11.0-beta.1`. A release is never
assembled from a developer's arbitrary working directory or published before
its tag, source commit, generated artifacts, complete file inventory, and remote
asset digests agree.

## 3. Branch and commit conventions

Recommended branch names:

```text
codex/issue-12-top-navigation
codex/issue-14-right-bookmarks
codex/issue-32-downloads
codex/issue-37-urlbar-coverage
codex/sync-current-progress-docs
```

Commit messages should be imperative and scoped:

```text
navigation: add selected-browser command state
bookmarks: expose bounded Places children
downloads: add aggregate progress snapshots
docs: synchronize current four-edge progress
```

Keep commits reviewable. Avoid unrelated formatting or generated-artifact churn.

## 4. Research before implementation

When an issue depends on Firefox internals:

- follow `docs/research-playbook.md`;
- record Firefox version, build ID, channel, OS, profile state, and project
  commit;
- inspect maintained compatibility canaries;
- inspect current Searchfox/official source definitions, callers, tests, blame,
  commits, and Bugzilla;
- identify the first causal error;
- separate loader/customization baggage from the minimum Fennevia requirement;
- record exact source paths and revisions;
- record negative results and rejected alternatives;
- define the real Firefox validation and removal/cleanup plan before coding.

For UI design references, record the exact external commit and only the concepts
learned. `yutinglia/my-firefox-custom` may inform capability or broad visual
direction but its code, selectors, IDs, classes, timers, values, native-DOM
strategy, loader assumptions, module layout, and visual composition must not be
copied.

Research is complete only when it supports a decision and validation plan.

## 5. Implementation sequence

For a privileged bridge or integration change:

1. Add or update runtime capability checks.
2. Implement the smallest bridge behavior.
3. Keep native handles inside `src/firefox/`.
4. Add pure tests for mapping, state, bounds, IDs, errors, and cleanup.
5. Connect an ordinary application-state adapter.
6. Integrate the feature into the existing #31 surface contract.
7. Test in active content-only mode and with native reveal/fallback available.
8. Add controlled failure injection and verify fail-open cleanup.
9. Update current architecture, internals, security, testing, and decision
   documentation.
10. Any change to the exact native-hide target set requires a dedicated review
    of ADR-032 and the current compatibility inventory.

For a feature surface, additionally:

1. consume the existing top/left/right/bottom host;
2. consume shared reveal, focus, popup, corner, collision, glass, and disposer
   APIs;
3. provide a keyboard/focus reveal path;
4. keep hidden-at-rest layout at zero permanent content size;
5. avoid fake or dead controls;
6. verify both adjacent corners and narrow/high-DPI layouts;
7. verify reduced motion, forced colors, and transparency fallback;
8. dispose during a pending hide/hold/update.

## 6. Frontend build and verification

Use the exact nvm-managed versions in `.nvmrc` and `package.json`.

The project is currently under rapid development. The ordinary verification
gate is CI. Locally, run the CI-equivalent commands when practical:

```powershell
npm ci --ignore-scripts --no-fund
npm run dependencies:audit
npm run test:powershell
npm run verify
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\tests\run-static-powershell-tests.ps1
```

`npm run verify` includes `npm run test:coverage`, which fails when loaded
`src/app` and `src/firefox` line or function coverage drops below 80%. Do not
add tests whose only purpose is to satisfy that floor.

Do not run the complete real-Firefox or mass-test matrices on every change.
Those matrices in `docs/testing-and-recovery.md` run before a release tag or
publication. If a local parity check is skipped, record it as `not run` and
rely on CI. Do not claim a check passed without evidence.

`npm run build` performs isolated reproducibility builds for the frontend and
Firefox bridge, compares exact bytes, replaces only owned generated
directories, and synchronizes hashes in `package-manifest.json`.

A dirty tree after rebuilding means source, generated artifacts, or the manifest
is stale. Do not hand-edit generated shell or bridge files.

### Release staging and publication

`package.json` is the canonical release version. Supported release versions are
plain `MAJOR.MINOR.PATCH` or `-alpha.N`, `-beta.N`, and `-rc.N`; build metadata
and development suffixes are rejected. The exact tag is `v<VERSION>`, it must
be annotated, and its target must equal the checked-out full source commit.

Before tagging, run the complete mass-test and real Firefox matrices in
`docs/testing-and-recovery.md`, plus the release packaging and installer suites
in both PowerShell runtimes and a real staged-package smoke test. After the
release change is merged, create and push the annotated tag. `.github/workflows/release.yml`
then repeats exact dependency installation and `npm run verify`, builds twice
into clean directories, requires byte-identical manifests/ZIPs, validates a
Unicode/space extraction, and runs a second independent preflight in the
publication job. The job uploads only the versioned ZIP and `.sha256` file to a
draft, lists private drafts to identify the exact numeric release ID, checks
GitHub's reported SHA-256 for both, publishes that verified ID, downloads both,
and compares them again. It does not rely on GitHub's get-by-tag endpoint for a
draft because the first real publication returned 404 there. Because the
authenticated release list can briefly lag successful draft creation, discovery
is limited to ten attempts two seconds apart. It waits only while no match is
visible or one private match has fewer than two assets; duplicates, a public
match, excess assets, or the final timeout fail closed. A manual dispatch is
rehearsal-only unless its `publish` boolean is explicitly set.

Do not move an existing tag, replace an asset in place, publish from a branch,
or reuse a failed draft. A failed draft remains private for inspection; delete
it explicitly only after recording the failure, then rerun from the unchanged
annotated tag. Corrections to published bytes require a new version and tag.
The first prerelease intentionally has no signing, attestation, SBOM, automatic
update, stable-support, or non-Windows claim.

Documentation-only changes should still run:

- Markdown structure/link checks available in the working environment;
- a search for stale milestone phrases;
- `git diff --check`;
- `npm run format:check` only when the changed paths are included in the
  configured Prettier scope.

Do not claim `npm run verify` passed when the repository or required runtime was
not available. Record unrun commands honestly.

## 7. Real Firefox validation

This section is the release and mass-test contract. During rapid development,
do not treat it as a per-pull-request requirement unless the owner asks for
those checks or the change is a release.

Use the copied Firefox program and marker-owned profile described in
`docs/development-setup.md`.

Every relevant runtime/UI release check should cover:

- initial normal window;
- second normal window;
- private window or complete documented native fallback;
- window close and runtime disposal;
- emergency fallback and safe start where affected;
- Browser Toolbox ownership and native-style preservation;
- feature-specific native and custom actions used alternately;
- capability/component/surface failure and exact restoration.

Every edge-feature release check should also cover:

- pointer and keyboard reveal;
- focus and popup holds;
- delayed hide and rapid re-entry;
- `Escape` and focus restoration;
- both adjacent corners;
- hidden-at-rest zero permanent layout;
- narrow, short, maximized, restored, fullscreen, and high-DPI behavior;
- reduced motion, forced colors, and solid-surface fallback.

The current matrix additionally covers native-UI retained access, prompts,
dialogs, extension actions, Library, Downloads, DevTools, customize mode,
DOM fullscreen, and OS window controls. Active-state tests prove #37's native
Urlbar handoff temporarily reveals/focuses the retained navbar and that
return/failure restores the correct presentation. Firefox-version changes use
`docs/firefox-update-workflow.md` and must record unsupported/not-run scenarios
honestly.

### 7.1 Live chrome debug logs

Firefox does not execute the repo `profile/chrome/fennevia/` tree in place.
The running package is the installed development profile
(`%LOCALAPPDATA%\fennevia\profiles\fennevia-dev\chrome\fennevia\`). After
instrumenting source and running `npm run build`, copy the changed chrome
files into that installed tree (or run package Update with Firefox closed),
delete the profile `startupCache` directory, confirm the installed files
contain the debug session id, then fully quit every Fennevia `firefox.exe`
and relaunch.

Installed runtime and frontend code must not use `fetch`, debug endpoints, or
`IOUtils` file output. Diagnose live chrome with Browser Console, Browser
Toolbox, and the existing privacy-safe logger. Temporary instrumentation must
emit only fixed event/code/phase fields—never browsing values or local paths—
and must be removed before rebuilding the reviewed package. A fixed mount-time
event can distinguish an install/cache mismatch from a missed interaction
without adding a network or profile-file diagnostic sink.

## 8. Pull-request evidence

A pull request should include:

- linked issue or explanation when the change is cross-cutting documentation;
- summary and explicit non-goals;
- current base commit and package version;
- Firefox version, build ID, channel, OS, profile type, and project commit for
  real integration claims;
- upstream and compatibility sources consulted;
- external design-reference commit and no-copy statement where applicable;
- architecture, security, privacy, persistence, and resource-exposure effects;
- dependency-review record when applicable;
- license/provenance record and root notice update when external material or a
  distribution artifact changes;
- exact commands run;
- `pass`, `fail`, `blocked`, or `not run` results;
- CI as the required ordinary-development gate;
- real Firefox and failure-injection evidence for release work, recorded as
  `not run` on ordinary rapid-development pull requests;
- generated artifact and package-manifest effects;
- documentation changed;
- known limitations and follow-up issues.

Do not imply a GUI integration test ran because a unit test passed.

## 9. Review focus

Reviewers should check:

- direct Firefox-internal access outside the bridge/runtime;
- leaked native handles or unbounded user-derived data;
- stale or foreign opaque-ID behavior;
- missing cleanup;
- a private edge trigger, timer, z-index scheme, or global state that bypasses
  #31;
- permanently reserved content layout;
- hover-only access or hidden focus;
- corner/collision ambiguity;
- unscoped CSS or native-style leakage;
- missing solid/reduced-motion/forced-colors behavior;
- fail-closed behavior that could hide native UI;
- remote runtime dependencies;
- HMR, endpoints, source maps, bare/dynamic imports, debug code, or unexpected
  files in production artifacts;
- content-accessible mappings without exact exposure evidence;
- logging of URL, title, search, bookmark, download, local-path, or private data;
- unsafe install/delete paths;
- undocumented Firefox symbols;
- copied external code/design without license and provenance;
- unsupported compatibility, completion, or platform claims.

## 10. Merge readiness

A change is ready when:

- acceptance criteria are met or explicitly revised with owner approval;
- required evidence is attached;
- current README, plans, issue #1, architecture, security, testing, and internals
  documentation agree;
- historical research records remain historically accurate;
- CI passes;
- real Firefox smoke tests are recorded for release work; ordinary
  rapid-development changes may leave those rows as `not run`;
- recovery remains available;
- dependencies, resources, artifacts, private-window behavior, and native
  security-UI effects are reviewed;
- no unresolved security-sensitive finding remains;
- follow-up work is tracked rather than hidden in prose.
