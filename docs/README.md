# Fennevia Documentation

This index separates end-user guidance, contributor instructions, current
technical documentation, and historical evidence. The root READMEs intentionally
avoid implementation-level detail. Only the public README is translated into
Traditional Chinese for now; technical and contributor documentation remains in
English.

## For users

- [English README](../README.md) — product overview, supported release, basic
  installation, use, limitations, and emergency fallback.
- [繁體中文 README](../README.zh-Hant.md) — complete Traditional Chinese version
  of the public README.
- [Current project status](current-status.md) — reviewed progress snapshot,
  implemented capabilities, validation gaps, support boundaries, and
  recommended next priorities.
- [Current GitHub Releases](https://github.com/yutinglia/fennevia/releases) —
  versioned Windows packages and checksums.
- [Release installation and recovery](../release/INSTALL.md) — the guide bundled
  into each release archive. The recommended entry is `FenneviaSetup.exe`.
- [Complete package lifecycle](installation.md) — detailed install, update,
  repair, disable, enable, uninstall, rollback, and interrupted-operation rules.
- [Security policy](../SECURITY.md) — supported security-reporting scope and how
  to report a vulnerability privately.

## For contributors

Read these before changing code or current documentation:

1. [Agent and repository rules](../AGENTS.md)
2. [Contributing](../CONTRIBUTING.md)
3. [Current project status](current-status.md)
4. [Master plan](../plans/000-master-plan.md)
5. [Shell roadmap](../plans/002-shell-roadmap.md)
6. [Development setup](development-setup.md) — recommended entry:
   `scripts/fennevia.ps1` or `npm run env`
7. [Development workflow](development-workflow.md)
8. [Research playbook](research-playbook.md)

## Current technical documentation

- [Current project status](current-status.md) — concise current capability and
  evidence boundary; use this before reading milestone history as present-tense
  product documentation.
- [Technical overview](technical-overview.md) — current product model,
  engineering status, architecture summary, technology choices, and boundaries.
- [Architecture](architecture.md) — normative runtime, bridge, ownership, and
  data-flow design.
- [Architecture decisions](architecture-decisions.md) — accepted and superseded
  ADRs, including the historical reasoning behind current choices.
- [Firefox internals map](firefox-internals-map.md) — unsupported Firefox APIs,
  DOM, commands, events, ownership, and compatibility obligations.
- [Testing and recovery](testing-and-recovery.md) — current automated and real
  Firefox validation contract, including the rapid-development CI gate, Node
  coverage floors, and the release mass-test matrices.
- [Firefox stable-update workflow](firefox-update-workflow.md) — how to validate,
  disable, repair, or update Fennevia around Firefox changes.

## Security, dependencies, and licensing

- [Security and privacy](security-and-privacy.md)
- [Operational security controls](security-controls.md)
- [Dependency review template](dependency-review-template.md)
- [`docs/dependency-reviews/`](dependency-reviews/) — completed dependency and
  supply-chain records.
- [Licensing and provenance](licensing-and-provenance.md)
- [Third-party notices](../THIRD_PARTY_NOTICES.md)

## Plans and project status

- [Current project status](current-status.md) — the present-tense summary. It
  does not replace normative plans, ADRs, or testing requirements.
- [Master plan](../plans/000-master-plan.md) — current project-wide goals,
  completed phases, success criteria, and remaining support gates.
- [Shell roadmap](../plans/002-shell-roadmap.md) — the completed MVP sequence and
  ongoing maintenance rules.
- [Bootstrap feasibility plan](../plans/001-bootstrap-spike.md) and
  [security-foundation plan](../plans/003-security-foundation.md) — phase plans
  retained for their decisions and acceptance criteria.
- [Single-line toolbar plan](../plans/004-single-line-toolbar-ui-ux.md) — ADR-037
  implementation boundary, focused automation, and pending real-Firefox matrix.
- [Topbar widget mirror plan](../plans/005-topbar-widget-mirror.md) — ADR-044
  read-only nav-bar mirror, owner-approved privacy relaxation, and pending
  real-Firefox matrix. ADR-045 later supersedes the mirror-as-sole-model.
- [Customize mode plan](../plans/006-customize-mode.md) — ADR-045 Fennevia-owned
  four-edge widget editor, bounded style tokens, and owner-approved
  CustomizableUI adopt/restore writes; ADR-046 localized names and native
  built-in icons; ADR-047 live four-edge drag-and-drop; ADR-054 bounded
  separate in-window/window-leave hide, temporary-reveal, shortcut-tip, and
  edge-trigger settings.
- [Codebase modularization plan](../plans/007-codebase-modularization.md) —
  ADR-053 feature-first source boundaries, compatibility facades, and fixed
  installer implementation inventory.

The public `v0.15.0-beta.1` prerelease follows the planned Windows MVP and
versioned distribution path. Tested Firefox builds are 153.0.4 BuildID
`20260810162159` and 154.0 BuildID `20260812182057`; see
[`docs/research/firefox-154-stable-transition.md`](research/firefox-154-stable-transition.md)
and the
[`0.12.0-beta.1` Firefox 154 release-validation record](research/firefox-154-0.12.0-beta.1-release-validation.md),
plus ADR-048. The installer accepts Firefox 153 and newer after a warning that
later versions may break with no working promise.

## Historical research and validation records

[`docs/research/`](research/) contains milestone-specific research, failures,
source pins, environment records, and real-Firefox evidence. These files are
historical evidence: later architecture is documented through current plans,
ADRs, and normative docs rather than by rewriting old observations.
