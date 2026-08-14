# Security Policy

## Project stage

`fennevia` is experimental and currently targets development profiles only. It executes system-principal code and uses unsupported Firefox internal APIs. It has not completed a formal security audit and must not be treated as a hardened production security boundary.

## Supported versions

Until the implementation reaches a versioned release, only the current `main` branch on the explicitly documented Firefox stable build is considered in scope. Historical Firefox versions and untested platforms are not supported.

## Reporting a vulnerability

Do not publish an exploitable privileged-code, installer, resource-exposure, or security-UI vulnerability in a public issue before the repository owner has had a reasonable opportunity to investigate.

Preferred reporting order:

1. Use GitHub private vulnerability reporting if it is enabled for this repository.
2. Otherwise contact the repository owner through an established private channel.
3. If no private channel is available, open a minimal issue requesting a private contact method without including exploit details, browsing data, secrets, or a proof of concept.

Include, when safe:

- affected project commit;
- Firefox version, build ID, channel, and operating system;
- whether the issue affects normal or private windows;
- the affected bootstrap, runtime, bridge, shell, resource mapping, or installer component;
- minimal reproduction steps;
- impact and required user interaction;
- whether native Firefox fallback remains available;
- suggested mitigation if known.

Do not include real cookies, tokens, browsing history, personal URLs, private profile paths, or other user data.

The normal issue and pull-request templates are not a substitute for private vulnerability reporting. Before attaching diagnostics, follow the allowlisted fields and redaction rules in `docs/security-controls.md`; do not paste an upstream error message or stack until page URIs, local paths, user names, queries, fragments, and private-window browsing values are removed.

## Security priorities

High-priority reports include:

- arbitrary or remote code execution in privileged browser chrome;
- web-content access to privileged resources or APIs;
- unsafe installer or uninstaller path handling;
- shell failure that hides native security prompts or prevents recovery;
- leakage of browsing data, private-window state, secrets, or profile content;
- dependency or build compromise affecting installed privileged artifacts;
- a resource override that bypasses an upstream security fix.

## Disclosure and fixes

The repository owner will determine the remediation and disclosure timeline based on severity, exploitability, and project stage. A fix should include regression coverage, recovery validation, source and version evidence, and updates to `docs/security-and-privacy.md` or the relevant architecture decision.

Security fixes that affect dependencies, resource exposure, production artifacts, installer scope, private-window state, or native security UI must also update the corresponding operational record in `docs/security-controls.md` or `docs/dependency-reviews/`. This process is a project control and does not imply that a formal audit has occurred.
