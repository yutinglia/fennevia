# Security and Privacy

## 1. Scope

This project executes privileged code in Firefox browser chrome. A defect or compromised dependency can affect browser UI, profile files, browsing state, and Firefox security surfaces. Security and privacy constraints therefore apply to bootstrap code, runtime modules, frontend bundles, dependencies, build tooling, resource mappings, logs, installers, and documentation.

This document defines project policy; it does not claim that a formal security audit has been completed.

## 2. Security objectives

- Preserve Firefox security boundaries and native security-sensitive prompts.
- Keep the privileged runtime small, local, deterministic, and reviewable.
- Fail open to native Firefox UI when the custom shell is unhealthy.
- Prevent unintended content access to privileged project resources.
- Prevent normal diagnostics from exposing browsing information.
- Make install, update, disable, and uninstall operations explicit and reversible.
- Maintain clear provenance for dependencies and copied code.

## 3. Privileged-code rules

- Treat every runtime module as system-principal code.
- Do not use `eval`, `Function`, string-generated modules, or equivalent dynamic code unless a dedicated security issue proves necessity and reviews alternatives.
- Do not fetch executable code, CSS, fonts, templates, configuration, or updates at runtime.
- Do not introduce analytics, telemetry, crash upload, or background network reporting.
- Keep security-sensitive Firefox UI native unless a separate issue includes a threat model, source review, failure behavior, and tests.
- Validate external and page-derived values before using them in privileged APIs.
- Render titles, URLs, labels, and user input as text; do not inject unsanitized HTML.

## 4. Data classification and logging

### Allowed in normal logs

- project version and commit;
- Firefox version, build ID, and channel;
- operating system and window type;
- lifecycle phase;
- capability name and boolean result;
- project module and source path;
- error class, stack, and a privacy-safe symbolic context;
- opaque project-generated IDs when they cannot be mapped outside the current process.

### Prohibited in normal logs

- complete URLs or origins;
- page titles;
- search queries or address-input text;
- history, bookmarks, downloads, or form values;
- cookies, tokens, headers, principals, certificates, or session state;
- complete profile paths, user names, or local file paths;
- private-window browsing state;
- extension data not required to diagnose the project.

Detailed local debugging, when unavoidable, must require explicit opt-in, remain local, be disabled by default, and be removed or redacted before sharing an issue or pull request.

## 5. Dependency and supply-chain policy

Before adding a runtime or build dependency, record:

- the exact purpose and why the standard platform is insufficient;
- whether it executes during install, build, or privileged runtime;
- license and provenance;
- maintainer and release activity;
- transitive dependency impact;
- network, postinstall, native-binary, and code-generation behavior;
- bundle-size and attack-surface effect;
- removal or replacement cost.

Requirements:

- Commit the lockfile.
- Prefer exact or controlled version ranges according to the selected package-manager policy.
- Review changelogs and relevant source before privileged dependency upgrades.
- Avoid dependencies with unnecessary postinstall scripts or remote download behavior.
- Do not add a component library solely for convenience when a small local component is sufficient.
- CI should verify the production bundle contains no unexpected remote endpoints or runtime loaders.

## 6. Chrome and resource exposure

- Project resources use dedicated namespaces.
- Default to no content-accessible mappings.
- Never place secrets, private data, source maps, development diagnostics, or privileged implementation files in a content-accessible location.
- Review every manifest `content`, `resource`, `skin`, `style`, and `override` entry.
- `contentaccessible=yes` requires a dedicated security rationale and test.
- A resource override requires the additional review defined in the override policy.

## 7. Installation and file-system safety

Install, update, and uninstall scripts must:

- require an explicit Firefox program directory and profile directory;
- resolve and validate canonical paths;
- display or log planned operations without leaking unrelated profile content;
- support dry run before destructive actions;
- refuse ambiguous, missing, root, home, or otherwise unsafe target paths;
- write only project-owned paths;
- track installed files in an ownership manifest;
- avoid recursively deleting directories not proven to be project-owned;
- handle partial failure with rollback or clear manual recovery instructions;
- never silently choose a daily-use profile.

### Development-profile helper

The Phase 0 Windows helper is not an installer, but its profile deletion is still destructive and follows the same path-safety principles:

- it manages only `%LOCALAPPDATA%\my-firefox-shell\profiles\...`;
- it rejects Firefox-registered profiles, broad paths, files, reparse points, non-empty unowned directories, and active profiles;
- it requires a valid `.mfs-dev-profile.json` ownership marker and explicit `-Force` before recursive deletion;
- it supports `-WhatIf` and never changes `profiles.ini`;
- its Phase 0 clean-environment gate detects existing AutoConfig declarations, enterprise-policy sources, profile add-ons, and profile chrome customizations without removing them;
- normal output redacts the Firefox executable and profile paths;
- revealing local paths requires explicit `-RevealPaths` opt-in and that output must not be shared;
- Browser Toolbox support keeps `devtools.debugger.prompt-connection=true` and limits the default scope to the parent process.

The full procedure and evidence are in `docs/development-setup.md`.

## 8. Native security UI preservation

During the initial roadmap, Firefox remains responsible for:

- site permissions;
- authentication prompts;
- TLS and certificate warnings;
- extension installation prompts;
- download safety and executable-file warnings;
- file pickers;
- protected-content and device prompts;
- other browser security notifications.

Hiding or replacing a visible toolbar must not remove the underlying prompt, popup, notification, or command infrastructure.

## 9. Private windows

- Private-window behavior must be explicit: fully supported or complete native fallback.
- Do not persist private-window feature state that can reveal browsing activity.
- Do not include private-window URLs, titles, queries, or tab state in diagnostics.
- Project-global state must not accidentally share private-window browsing data with normal windows.

## 10. Source maps and debug artifacts

- Development source maps may remain local.
- Installed source maps require an explicit decision based on debugging value and exposure risk.
- Source maps must not be published through a content-accessible resource mapping by accident.
- Development-only failure-injection and debug APIs must be excluded or disabled in installed production artifacts.

## 11. Security review triggers

A dedicated security review is required before:

- adding runtime network access;
- adding dynamic code generation;
- adding a dependency that executes in privileged runtime;
- exposing a project resource to web content;
- replacing permission, identity, authentication, certificate, download-safety, or extension-install UI;
- adding a Chrome Registry override;
- persisting new profile data;
- processing untrusted HTML rather than text;
- changing installer deletion scope;
- adding telemetry or crash upload.

## 12. Reporting

Follow `SECURITY.md` for reporting. Do not disclose a live vulnerability in a public issue before the repository owner has had a reasonable opportunity to investigate, especially if the defect can execute privileged code or hide security UI.
