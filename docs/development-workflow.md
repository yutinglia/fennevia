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
chrome.

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
    └─ #13 compact address/status launcher and popup (complete; depends on #12)
        └─ #37 fuller Urlbar permissions/page-action coverage
            └─ #15 content-only activation
                └─ #16 hardening
```

#37 is the next coverage step after completed #32. Completed #13 composes with
#11 and reuses #12's navigation controller; #37 owns fuller Urlbar
permissions/page-action and retained-access coverage before #15. No feature
issue may build a second edge controller or bypass #31.

## 3. Branch and commit conventions

Recommended branch names:

```text
codex/issue-12-top-navigation
codex/issue-14-right-bookmarks
codex/issue-32-downloads
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
7. Test while native Firefox UI remains visible.
8. Add controlled failure injection and verify fail-open cleanup.
9. Update current architecture, internals, security, testing, and decision
   documentation.
10. Only #15 may implement final native-visible-shell hiding.

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

```powershell
npm ci --ignore-scripts --no-fund
npm run dependencies:audit
npm run verify
```

`npm run build` performs isolated reproducibility builds for the frontend and
Firefox bridge, compares exact bytes, replaces only owned generated
directories, and synchronizes hashes in `package-manifest.json`.

A dirty tree after rebuilding means source, generated artifacts, or the manifest
is stale. Do not hand-edit generated shell or bridge files.

Documentation-only changes should still run:

- Markdown structure/link checks available in the working environment;
- a search for stale milestone phrases;
- `git diff --check`;
- `npm run format:check` only when the changed paths are included in the
  configured Prettier scope.

Do not claim `npm run verify` passed when the repository or required runtime was
not available. Record unrun commands honestly.

## 7. Real Firefox validation

Use the copied Firefox program and marker-owned profile described in
`docs/development-setup.md`.

Every relevant runtime/UI feature should cover:

- initial normal window;
- second normal window;
- private window or complete documented native fallback;
- window close and runtime disposal;
- emergency fallback and safe start where affected;
- Browser Toolbox ownership and native-style preservation;
- feature-specific native and custom actions used alternately;
- capability/component/surface failure and exact restoration.

Every edge feature should also cover:

- pointer and keyboard reveal;
- focus and popup holds;
- delayed hide and rapid re-entry;
- `Escape` and focus restoration;
- both adjacent corners;
- hidden-at-rest zero permanent layout;
- narrow, short, maximized, restored, fullscreen, and high-DPI behavior;
- reduced motion, forced colors, and solid-surface fallback.

#15 additionally owns the complete native-UI coverage, retained-access, prompt,
dialog, extension, Library, Downloads, DevTools, customize-mode, DOM-fullscreen,
and OS-window-control matrix.

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
- exact commands run;
- `pass`, `fail`, `blocked`, or `not run` results;
- real Firefox and failure-injection evidence where required;
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
- CI passes where available;
- real Firefox smoke tests are recorded where required;
- recovery remains available;
- dependencies, resources, artifacts, private-window behavior, and native
  security-UI effects are reviewed;
- no unresolved security-sensitive finding remains;
- follow-up work is tracked rather than hidden in prose.
