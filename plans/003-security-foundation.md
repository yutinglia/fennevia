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
