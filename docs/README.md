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
- [Current GitHub Releases](https://github.com/yutinglia/fennevia/releases) —
  versioned Windows packages and checksums.
- [Release installation and recovery](../release/INSTALL.md) — the guide bundled
  into each release archive. The recommended entry is
  `scripts/fennevia.ps1`.
- [Complete package lifecycle](installation.md) — detailed install, update,
  repair, disable, enable, uninstall, rollback, and interrupted-operation rules.
- [Security policy](../SECURITY.md) — supported security-reporting scope and how
  to report a vulnerability privately.

## For contributors

Read these before changing code or current documentation:

1. [Agent and repository rules](../AGENTS.md)
2. [Contributing](../CONTRIBUTING.md)
3. [Master plan](../plans/000-master-plan.md)
4. [Shell roadmap](../plans/002-shell-roadmap.md)
5. [Development setup](development-setup.md) — recommended entry:
   `scripts/fennevia.ps1` or `npm run env`
6. [Development workflow](development-workflow.md)
7. [Research playbook](research-playbook.md)

## Current technical documentation

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

- [Master plan](../plans/000-master-plan.md) — current project-wide goals,
  completed phases, success criteria, and remaining support gates.
- [Shell roadmap](../plans/002-shell-roadmap.md) — the completed MVP sequence and
  ongoing maintenance rules.
- [Bootstrap feasibility plan](../plans/001-bootstrap-spike.md) and
  [security-foundation plan](../plans/003-security-foundation.md) — phase plans
  retained for their decisions and acceptance criteria.
- [Single-line toolbar plan](../plans/004-single-line-toolbar-ui-ux.md) — ADR-037
  implementation boundary, focused automation, and pending real-Firefox matrix.

The public `v0.10.0-beta.1` prerelease completed the planned Windows MVP and
versioned distribution path for Firefox 153.0.4 BuildID `20260810162159`. A real
transition to a later Firefox stable remains a future compatibility gate; it is
not inferred from a same-build rehearsal.

## Historical research and validation records

[`docs/research/`](research/) contains milestone-specific research, failures,
source pins, environment records, and real-Firefox evidence. These files are
historical evidence: later architecture is documented through current plans,
ADRs, and normative docs rather than by rewriting old observations.
