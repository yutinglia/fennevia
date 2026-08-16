# Contributing

Fennevia is an experimental, owner-directed stock-Firefox browser-shell project.
Contributions and agent-generated changes follow an issue-first workflow and the
privileged-code constraints below.

## Before starting

1. Read `AGENTS.md`.
2. Read `plans/000-master-plan.md`.
3. For UI/feature work, read `plans/002-shell-roadmap.md` and #31.
4. Read the complete issue body, blockers, accepted decisions, linked research
   records, and current implementation.
5. Inspect the latest relevant commits.
6. Use the dedicated copied Firefox program and marker-owned development
   profile. The recommended entry is
   `pwsh -NoProfile -File .\scripts\fennevia.ps1` or `npm run env`.
7. Do not begin while a listed blocker is open unless the owner explicitly
   changes the dependency.

## Current product boundary

The MVP uses four independent floating surfaces:

- top: primary controls;
- left: vertical tabs plus compact HTTPS/protection address launcher;
- center overlay: detailed address/search popup and native Urlbar handoff;
- right: bookmarks;
- bottom: download progress/status.

All surfaces are hidden at rest and reserve no permanent browser-content space.
Feature work must reuse #31's hosts, edge triggers, reveal controller, collision
policy, glass tokens, focus/popup behavior, accessibility path, and disposer.

Do not create feature-specific edge triggers, hide timers, z-index systems,
browser-window observers, native-DOM owners, or window-global coordination
flags.

ADR-032's exact active-only descendants are now collapsed at rest, while the
native DOM and complete reveal/fallback remain. Do not broaden native hiding or
remove retained Firefox infrastructure to make a feature appear finished.

## Issue scope

- One issue produces one coherent change set.
- Do not silently broaden scope.
- Track useful non-required work in a follow-up issue.
- Research issues produce reproducible evidence, a decision, or a clear negative
  result.
- A placeholder is not a completed feature.
- Changes to the native-hide inventory or Firefox-version support require a
  dedicated issue, current source evidence, recovery tests, and the workflow in
  `docs/firefox-update-workflow.md`.

## Development requirements

- Keep Firefox internal APIs inside `src/firefox/` or the minimal runtime
  boundary.
- Keep Svelte limited to project-owned XHTML descendants.
- Keep native handles out of application/Svelte state.
- Preserve fail-open native-UI behavior.
- Add deterministic cleanup for every listener, observer, timer, mapping,
  native view/query, stylesheet, framework root, hold, and pending operation.
- Provide a keyboard/focus path for every surface.
- Keep hidden surfaces at zero permanent content size.
- Do not add runtime remote code, CSS, fonts, configuration, analytics,
  telemetry, or update checks.
- Do not log URLs, titles, search/address text, bookmark contents, download
  metadata/paths, profile paths, or private-window browsing state.
- Do not add a Chrome Registry override without a dedicated issue and ADR.
- Do not hand-edit generated artifacts.

The project is currently under rapid development. Ordinary pull requests must
make CI able to pass. Do not run the complete real-Firefox or mass-test
matrices on every change; those run before a release. Design for adjacent
corners, delayed hide, `Escape`, focus restoration, reduced motion, forced
colors, and transparency fallback, and prove that matrix at release. Do not
add tests whose only purpose is to satisfy the unit-coverage floor.

Safety, privacy, fail-open, and native-UI ownership rules remain in force.
Updating or relaxing them requires explicit project-owner approval recorded in
the same change.

## Research requirements

For Firefox-internal behavior, follow `docs/research-playbook.md`:

1. Reproduce in the clean development profile.
2. Inspect Browser Console and Browser Toolbox.
3. Check maintained compatibility canaries.
4. Use Searchfox and official Firefox source to find the upstream behavior.
5. Record exact source paths, commits, Firefox version, and build ID.
6. Separate loader/customization baggage from the minimum Fennevia adaptation.
7. Define failure, cleanup, and real Firefox validation.

External repositories are signals, not implementation templates.

`yutinglia/my-firefox-custom` may be inspected only for capabilities and broad
visual concepts. Do not copy/adapt its code, event/timer/global structure,
selectors, IDs, classes, token names, numeric values, native-DOM mutation
strategy, loader assumptions, module layout, or visual composition. Record the
exact consulted commit and Fennevia's independent decisions.

## Pull requests

A pull request includes:

- linked issue or reason for a cross-cutting documentation change;
- summary and non-goals;
- current base commit and package version;
- Firefox version, build ID, channel, OS, profile type, and project commit for
  integration claims;
- source/design references consulted;
- commands run and `pass`, `fail`, `blocked`, or `not run` results;
- CI as the ordinary-development gate;
- real Firefox evidence for release work; ordinary rapid-development pull
  requests may record those rows as `not run`;
- failure-injection and recovery evidence for release work;
- security, privacy, dependency, resource, persistence, native-UI, and installer
  effects;
- documentation changes;
- known limitations and follow-up issues.

Do not infer Firefox integration success from unit tests alone, and do not
claim unrun checks passed.

## External code, contribution license, and provenance

Fennevia is licensed under MPL-2.0. By intentionally submitting a contribution
for inclusion, you represent that you have sufficient rights and agree to
provide that contribution under MPL-2.0. The project currently requires no CLA
or DCO sign-off. See `LICENSE` and `docs/licensing-and-provenance.md` for the
complete policy.

Before copying code:

- verify repository, file, commit, and license;
- preserve required headers/attribution;
- record source and modifications;
- keep third-party code distinguishable;
- treat unlicensed or unclear code as unavailable.

Add or update `THIRD_PARTY_NOTICES.md` before submitting copied, adapted,
generated-from, vendored, or bundled third-party material. Record the source
repository, exact file or published source unit, commit/tag and integrity,
license/file notice, classification, project paths, modifications, required
attribution/source availability, and update/removal strategy.

Project-authored generated and installed files remain MPL-2.0; included
third-party portions keep their own terms. A distributed generated/minified or
installed-tree artifact must accompany the corresponding preferred source,
canonical `LICENSE`, and applicable notices. The software license does not grant
trademark or endorsement rights.

## Security-sensitive changes

Read `docs/security-and-privacy.md`, `docs/security-controls.md`, and
`SECURITY.md`.

A dedicated review is required for runtime network access, dynamic code
generation, privileged dependencies, content-accessible resources, resource
overrides, new persistence, arbitrary URL/scheme or file actions, security UI
replacement, broader native-UI hiding, installer deletion changes, telemetry,
or custom titlebar/window controls.

Use `docs/dependency-review-template.md` for every dependency addition or
upgrade. Production changes must retain the exact artifact inventory and pass
`scripts/check-production-artifacts.ps1`; findings cannot be silently waived.

These security requirements remain in force during rapid development. Updating
or relaxing them requires explicit project-owner approval recorded in the same
change.
