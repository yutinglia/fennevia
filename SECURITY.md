# Security Policy

## Project stage

Fennevia is experimental and publishes a narrowly supported Windows prerelease.
It executes system-principal code and relies on unsupported Firefox internal
APIs. It has not completed an independent security audit and must not be treated
as a hardened production security boundary or a stable daily-driver product.

Use a dedicated Firefox profile, verify release checksums, retain the exact
release archive for recovery, and read the Firefox 153/154 testing warning
before installation. Later Firefox versions may break the shell; confirming
install is not a working promise.

## Supported versions

The current public security-reporting scope is:

| Fennevia | Firefox | Platform | Status |
| --- | --- | --- | --- |
| `0.16.0-beta.1` | Stock Firefox 153.0.4 and 154.0 release; Build IDs `20260810162159` / `20260812182057` | Windows x64 | Current public prerelease; later majors install only after an explicit no-promise warning |

The installer rejects Firefox older than 153 for install, update, repair, and
enable operations. Firefox 153, 154, and newer majors may be installed after
the warning that only 153 and 154 are tested. Linux, macOS, Firefox ESR, Beta,
and Nightly are not supported by this release.

The `main` branch is development source, not a supported release channel. A
Firefox update can move an existing installation onto an untested major.
Later versions may break the shell. Confirming install is not a support
promise. Recovery-oriented `Disable` and `Uninstall` remain available.

## Reporting a vulnerability

Do not publish an exploitable privileged-code, installer, resource-exposure, or
security-UI vulnerability in a public issue before the repository owner has had
a reasonable opportunity to investigate.

Preferred reporting order:

1. Use GitHub private vulnerability reporting if it is enabled for this
   repository.
2. Otherwise contact the repository owner through an established private
   channel.
3. If no private channel is available, open a minimal public issue requesting a
   private contact method without including exploit details, browsing data,
   secrets, or a proof of concept.

Include, when safe:

- affected Fennevia version or commit;
- Firefox version, Build ID, channel, and operating system;
- whether the issue affects normal or private windows;
- the affected bootstrap, runtime, bridge, shell, resource mapping, release, or
  installer component;
- minimal reproduction steps;
- impact and required user interaction;
- whether native Firefox fallback remains available;
- suggested mitigation if known.

Do not include real cookies, tokens, browsing history, personal URLs, profile
paths, local user names, or other user data.

The normal issue and pull-request templates are not a substitute for private
vulnerability reporting. Before attaching diagnostics, follow the allowlisted
fields and redaction rules in [the security controls](docs/security-controls.md).
Do not paste an upstream error or stack until page URIs, local paths, user names,
queries, fragments, and private-window values are removed.

## Security priorities

High-priority reports include:

- arbitrary or remote code execution in privileged browser chrome;
- web-content access to privileged resources or APIs;
- unsafe installer, updater, repair, or uninstaller path handling;
- shell failure that hides native security prompts or prevents recovery;
- leakage of browsing data, private-window state, secrets, or profile content;
- dependency, build, release, or asset compromise affecting privileged files;
- a resource override or compatibility change that bypasses an upstream
  security fix.

## Disclosure and fixes

The repository owner determines remediation and disclosure timing based on
severity, exploitability, available mitigation, and the project's prerelease
stage. A fix should include regression coverage, recovery validation, exact
Firefox/source evidence, and updates to the relevant current documentation.

Security fixes affecting dependencies, resource exposure, production artifacts,
release assets, installer scope, private-window state, or native security UI
must also update [security and privacy](docs/security-and-privacy.md),
[operational controls](docs/security-controls.md), or the applicable dependency
review. These controls reduce risk but do not imply that a formal audit has
occurred.
