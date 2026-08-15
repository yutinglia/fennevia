# Development Workflow

## 1. Issue-first execution

Every implementation or research change should be linked to a GitHub issue. Before starting:

1. Read `AGENTS.md`.
2. Read the master plan and issue-specific plan or documentation.
3. Confirm all blockers are complete or explicitly waived by the owner.
4. Inspect the current repository and relevant recent commits.
5. Restate the issue scope and acceptance criteria in the working notes.
6. Identify which steps require real Firefox evidence rather than unit tests.
7. Check the triggers in `docs/security-controls.md`; link a dedicated review before implementing a triggered change.
8. For any dependency addition or upgrade, complete `docs/dependency-review-template.md` before installation or lockfile mutation.

For Windows Firefox work, create and verify the disposable direct-path profile by following `docs/development-setup.md` before changing privileged runtime or browser chrome.

Do not silently expand the issue. Create a follow-up issue for work that is useful but not required by the current acceptance criteria.

## 2. Branch and commit conventions

Recommended branch names:

```text
issue-3/bootstrap-spike
issue-8/svelte-build-spike
issue-10/tabs-bridge
```

Commit messages should be imperative and scoped, for example:

```text
bootstrap: register the project chrome manifest
runtime: add idempotent browser-window disposal
shell: mount a diagnostic Svelte island
```

Keep commits reviewable. Avoid unrelated formatting or generated-artifact churn.

## 3. Research before implementation

When an issue depends on Firefox internals:

- follow `docs/research-playbook.md`;
- record Firefox version and build ID;
- inspect maintained loader fixes before using Searchfox and official source to identify the root change;
- capture source paths and commit SHAs;
- separate loader-specific compatibility behavior from the minimum project requirement;
- record negative results and rejected options.

Research is complete only when it supports a decision and validation plan.

## 4. Implementation sequence

For a privileged integration change:

1. Add or update runtime capability checks.
2. Implement the smallest bridge or runtime behavior.
3. Add pure tests for mappings, state transitions, or validation where possible.
4. Add development-profile smoke instrumentation without exposing browsing data.
5. Test while native Firefox UI remains visible.
6. Add failure injection and verify fail-open behavior.
7. For a production build, commit the exact artifact inventory and run `scripts/check-production-artifacts.ps1`.
8. Update internals, security, testing, and decision documentation.
9. Only then consider activation or native-UI hiding effects.

## 5. Frontend build and verification

Use the nvm-managed version in `.nvmrc`; do not substitute another Node.js
installation. A clean frontend validation is:

```powershell
npm ci --ignore-scripts --no-fund
npm run dependencies:audit
npm run verify
```

`npm run build` performs two isolated runs for each production target, compares
exact bytes, replaces only the owned generated shell and Firefox-boundary
directories, and synchronizes hashes into `package-manifest.json`. A dirty tree
after rebuilding means source, generated artifacts, or the manifest is stale.
Do not hand-edit generated shell or bridge files.

## 6. Pull-request evidence

A pull request should include:

- linked issue;
- summary and explicit non-goals;
- Firefox version, build ID, channel, operating system, profile type, and project commit;
- upstream and loader sources consulted;
- architecture, security, privacy, and resource-exposure effects;
- dedicated security-trigger and dependency-review records, when applicable;
- exact manifest lines, mapped files, artifact inventory, installer scope, private-window policy, and native security-UI effects;
- commands run;
- results for unit, build, static, and Firefox smoke tests;
- failure-injection results;
- screenshots or logs only after sensitive information is redacted;
- documentation changed;
- known limitations and follow-up issues.

Mark each test as pass, fail, blocked, or not run. Do not imply a GUI integration test was executed because a unit test passed.

## 7. Review focus

Reviewers should check:

- architecture boundary violations;
- direct Firefox-internal access from Svelte;
- leaked native handles;
- missing cleanup;
- fail-closed behavior that could hide native UI;
- unscoped CSS;
- remote runtime dependencies;
- unresolved dependency lifecycle scripts, native binaries, or transitive/network effects;
- HMR, endpoints, source maps, bare/dynamic imports, debug code, or unexpected files in production artifacts;
- `contentaccessible=yes` or `resource:` mappings without exact exposure evidence;
- logging of browsing data;
- unsafe install or deletion paths;
- undocumented Firefox symbols or source references;
- copied external code without license provenance;
- unsupported compatibility or platform claims.

## 8. Merge readiness

A change is ready to merge when:

- acceptance criteria are met or explicitly revised with owner approval;
- required evidence is attached;
- documentation is synchronized;
- CI passes where available;
- real Firefox smoke tests are recorded where required;
- recovery behavior remains available;
- required dependency, resource, artifact, installer, private-window, and native security-UI evidence is complete;
- no unresolved security-sensitive review finding remains;
- follow-up work is tracked rather than hidden in comments.
