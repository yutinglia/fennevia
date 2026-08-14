# Contributing

This repository is currently an experimental, owner-directed project. Contributions and agent-generated changes must follow the issue-first workflow and the privileged-code constraints below.

## Before starting

1. Read `AGENTS.md`.
2. Read `plans/000-master-plan.md` and the plan relevant to the issue.
3. Read the complete issue body, blockers, linked decisions, and research records.
4. Use a dedicated Firefox development profile.
5. Do not begin implementation while a listed blocker is open unless the repository owner explicitly changes the dependency.

## Issue scope

- One issue should produce one coherent change set.
- Do not silently broaden scope.
- Track useful but non-required work in a follow-up issue.
- Research issues must produce reproducible evidence, a decision, or a clear negative result.
- Do not begin by hiding native Firefox UI.

## Development requirements

- Keep Firefox internal APIs inside `src/firefox/` or the minimal runtime boundary.
- Keep Svelte limited to project-owned XHTML hosts.
- Preserve fail-open native-UI behavior.
- Add deterministic cleanup for every listener, observer, timer, mapping, stylesheet, and framework root.
- Do not add runtime remote code, CSS, fonts, configuration, analytics, or telemetry.
- Do not log complete browsing URLs, titles, search text, profile paths, or private-window state.
- Do not add a Chrome Registry override without a dedicated issue and architecture decision.
- Do not hand-edit generated artifacts.

## Research requirements

For Firefox-internal behavior, follow `docs/research-playbook.md`:

1. Reproduce in the clean development profile.
2. Inspect Browser Console and Browser Toolbox.
3. Check current fixes in Alice0775, fx-autoconfig, xiaoxiaoflood, and aminomancer.
4. Use Searchfox and official Firefox source to find the upstream cause.
5. Record exact source paths, commits, Firefox version, and build ID.
6. Separate generic-loader baggage from the minimum project adaptation.

## Pull requests

A pull request must include:

- a linked issue;
- summary and non-goals;
- Firefox version, build ID, channel, operating system, profile type, and project commit;
- research sources consulted;
- commands run and their results;
- real Firefox smoke evidence where required;
- failure-injection and recovery results where applicable;
- security, privacy, dependency, resource-exposure, and installer effects;
- documentation changes;
- known limitations and follow-up issues.

Use `pass`, `fail`, `blocked`, or `not run` for test status. Do not claim a Firefox integration result from unit tests alone.

## External code

Before copying code:

- verify the repository and file license;
- preserve required headers and attribution;
- record the source URL and commit;
- keep third-party code distinguishable from original project code;
- treat unlicensed code as unavailable for direct inclusion.

## Security-sensitive changes

Read `docs/security-and-privacy.md` and `SECURITY.md`. A dedicated review is required for runtime network access, dynamic code generation, privileged dependencies, content-accessible resources, security-prompt replacement, resource overrides, new persistence, installer deletion changes, or telemetry.
