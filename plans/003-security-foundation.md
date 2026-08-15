# Security, Privacy, and Supply-Chain Foundation

## Purpose

Define the baseline controls required before a system-principal Firefox runtime, dependency graph, installer, or diagnostic layer is considered acceptable.

This plan does not attempt to provide a complete security audit. It establishes explicit defaults so later implementation issues do not invent incompatible security behavior.

## Threat model

The project must account for at least:

- a compromised or malicious npm dependency executing during build or in privileged runtime;
- a malformed build artifact loaded with system-principal privileges;
- unintended content access to project-owned `chrome://` or `resource://` files;
- logging that exposes browsing URLs, titles, queries, local paths, or private-window data;
- path confusion or unsafe deletion in install, update, and uninstall scripts;
- shell UI rendering untrusted page-derived text or favicon data unsafely;
- a broken shell hiding native security-sensitive UI;
- stale startup-cache artifacts causing old privileged code to execute;
- copied third-party code without compatible licensing or provenance;
- remote executable content introduced through CDN, HMR, fonts, configuration, analytics, or update checks.

## Baseline decisions

- No runtime remote code, stylesheet, font, configuration, or analytics dependency.
- No secrets are stored in source, generated artifacts, logs, or profile-visible diagnostics.
- The dependency graph remains intentionally small and lockfile-controlled.
- Dependency upgrades require changelog and source review appropriate to their privilege level.
- Normal logs exclude complete URLs, page titles, search text, history, profile paths, and private-window data.
- Content-accessible resource mappings default to none.
- Firefox remains responsible for permissions, authentication, certificates, downloads safety, and other security-sensitive prompts until separately reviewed replacements exist.
- Native UI remains visible when the shell is not demonstrably healthy.
- Install and uninstall operations validate canonical paths and owned-file manifests before writing or deleting.
- Third-party code requires license review and provenance records.

## Required deliverables

1. `docs/security-and-privacy.md` maintained as the normative project policy.
2. `SECURITY.md` with reporting expectations and supported-stage limitations.
3. A dependency review checklist for package additions and upgrades.
4. A logging classification and redaction policy.
5. A Chrome/resource exposure review checklist.
6. Installer path validation, dry-run, ownership-manifest, and rollback requirements.
7. Security-focused pull-request checklist entries.
8. A documented policy for source maps and installed debug artifacts.
9. A process for recording and resolving security-sensitive Firefox compatibility changes.

## Operational artifacts

Issue #17 establishes the reusable Phase 0.5 controls in:

- `docs/security-controls.md`: threat model, logging contract and example, Chrome/resource review, installer preflight and rejected-target record, private-window rules, review triggers, and ownership;
- `docs/dependency-review-template.md`: required addition and upgrade record;
- `docs/dependency-reviews/frontend-toolchain-2026-08-14.md`: preliminary no-install Svelte/Vite/TypeScript example;
- `docs/dependency-reviews/frontend-toolchain-2026-08-15.md`: accepted issue #8 resolved graph, build-host payload, and production artifact review;
- `scripts/check-production-artifacts.ps1`: exact-inventory and leakage gate;
- `tests/production-artifacts.Tests.ps1`: PowerShell 7 and Windows PowerShell 5.1 regression coverage;
- repository issue and pull-request templates: required security, privacy, resource, dependency, installer, private-window, artifact, and recovery evidence.

Later issues own integration evidence. Issues #3 and #4 completed the real
manifest/content-access and installer mutation/rollback evidence; #5 owns the
base runtime/private-window boundary; #8 completed the resolved dependency graph,
real production bundle, and initial CI gate; #9 owns bridge-level isolation;
#16 owns upgrade and release-CI hardening.

The security-foundation gate is complete only when #17 is merged. This plan does not claim that the later implementation controls or a formal security audit are complete.

## Acceptance criteria

- The threat model covers runtime, build, resource registration, UI data, logging, installation, and recovery.
- The repository defines which data may and may not appear in logs.
- The repository prohibits runtime network-loaded executable content.
- New dependencies have an explicit review process and owner rationale.
- Chrome/resource mappings are reviewed for content accessibility and privilege boundaries.
- Installer and uninstaller requirements prevent silent writes to or deletion from an ambiguous profile or program directory.
- Security-sensitive native Firefox UI is explicitly preserved by the architecture.
- Pull-request and issue templates prompt contributors for security, privacy, resource-exposure, and recovery effects.
- No document claims the project has completed a security audit before such an audit actually occurs.
