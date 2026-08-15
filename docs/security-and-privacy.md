# Security and Privacy

## 1. Scope

This project executes privileged code in Firefox browser chrome. A defect or compromised dependency can affect browser UI, profile files, browsing state, and Firefox security surfaces. Security and privacy constraints therefore apply to bootstrap code, runtime modules, frontend bundles, dependencies, build tooling, resource mappings, logs, installers, and documentation.

This document defines project policy; it does not claim that a formal security audit has been completed.

`docs/security-controls.md` is the operational companion: it contains the structured threat model, logging record schema and example, production-artifact gate, proposed manifest review, installer preflight, private-window rules, and security-review trigger evidence.

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
- shell lifecycle state;
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

Normal logger APIs must accept allowlisted fields rather than arbitrary context objects or native Firefox values. Error messages are untrusted; use a stable project error code and preserve each stack frame only after URLs, local paths, user names, queries, and fragments are replaced. If redaction fails, emit a minimal code-only record. The normative field schema and privacy-safe bootstrap example are in `docs/security-controls.md`.

Issue #5 implements this contract for window/runtime records. The logger builds
each output object field by field; unknown caller fields are ignored. It records
only a random process-local window UUID and `normal`, `private`, or
`unsupported` kind. Remote URLs, file URLs, Windows/UNC/POSIX local paths,
opaque URLs, other URI schemes, and query/fragment suffixes are replaced without
dropping stack lines. Only `chrome://` and `resource://` source locations remain
after their suffixes are removed. Automated hostile-value tests prove that
arbitrary URL, title, and private-content fields are not serialized.

Issue #6 extends the allowlist with one fixed DOM-path field for insertion-point
failures. It accepts only a short ASCII selector/path grammar; URL-like or local
path values are dropped. The visible diagnostic is built exclusively from
normalized Firefox version/build, normal/private kind, fixed host count, and
fixed ready/native-retained labels. It never receives a browsing URL, title,
query, profile path, native object, or arbitrary error message.

Issue #7 adds only the fixed `created`, `mounted`, `healthy`, `active`, `failed`,
and `disposed` shell-state enum plus an existing capability-name/boolean pair.
Health and emergency records reuse the fixed phase/code, process-local window
UUID, normal/private kind, Firefox version/build, and redacted stack. They do
not serialize keyboard event objects, native windows, user input, browsing
state, or arbitrary collaborator results. The diagnostic adds only fixed state
and recovery-binding labels.

Issue #9 adds one allowlisted `firefoxSymbol` field. It accepts only a short
ASCII property-path grammar and is populated from fixed capability
specifications such as `window.gBrowser`; URL/query punctuation, local paths,
and caller-provided browsing values are rejected. Typed bridge errors have a
fixed code/message and non-enumerable context containing only phase, symbol,
Firefox version/build, and normal/private kind. Their ordinary diagnostic form
contains exactly those six fields. Native causes remain private and pass only
through the existing stack redactor.

Bridge capability snapshots contain booleans, fixed names, fixed symbols, and
required/optional classification. Boundary and opaque-registry snapshots add
only fixed lifecycle state and counts. They never contain a native window, tab,
browser, event, principal, URL, title, query, or profile path. The privileged
boundary object itself is retained by `WindowShell.sys.mjs` and is never passed
to Svelte or ordinary application state.

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

Use `docs/dependency-review-template.md` for additions and upgrades, store accepted records under `docs/dependency-reviews/`, and link the record from the issue and pull request. `docs/dependency-reviews/frontend-toolchain-2026-08-14.md` is the preliminary no-install assessment; `docs/dependency-reviews/frontend-toolchain-2026-08-15.md` is the accepted issue #8 resolved-graph review.

Requirements:

- Commit the lockfile.
- Prefer exact or controlled version ranges according to the selected package-manager policy.
- Review changelogs and relevant source before privileged dependency upgrades.
- Avoid dependencies with unnecessary postinstall scripts or remote download behavior.
- Do not add a component library solely for convenience when a small local component is sufficient.
- CI should verify the production bundle contains no unexpected remote endpoints or runtime loaders.
- The resolved lockfile review must enumerate lifecycle scripts, native/platform binaries, optional packages, network behavior, and the difference when installation scripts are disabled; top-level registry metadata alone is not approval.

Issue #8 pins 12 exact development dependencies and commits npm lockfile v3.
The resolved inventory contains 173 package paths; 148 apply to the validated
Windows host. Project-level `ignore-scripts=true` prevents lifecycle execution.
The only lock entry flagged with an install script is optional macOS-only
`fsevents`; it is not installed on Windows. Rolldown and Lightning CSS each add
one Windows `.node` build-host binary, neither of which enters the Firefox
package. Registry signatures, tarball integrity, licenses, provenance where
published, native files, declared CLIs, and zero known audit vulnerabilities
are recorded in the accepted review and machine-readable lock inventory.

## 6. Chrome and resource exposure

- Project resources use dedicated namespaces.
- Default to no content-accessible mappings.
- Never place secrets, private data, source maps, development diagnostics, or privileged implementation files in a content-accessible location.
- Review every manifest `content`, `resource`, `skin`, `style`, and `override` entry.
- `contentaccessible=yes` requires a dedicated security rationale and test.
- A resource override requires the additional review defined in the override policy.

The initial manifest omits `contentaccessible=yes` and omits the `resource` directive. Firefox 153's current internal-URL documentation defines both `chrome:` and `resource:` mappings as privileged-only by default and defines `contentaccessible=yes` as an explicit hole punch. Phase 1 verified that an ordinary loopback HTTP page could not fetch the project Chrome entry. A future resource alias is still omitted until a real consumer, exact inventory, current-source review, content-context test, and removal test exist. No content-accessible mapping may contain privileged modules, source maps, debug data, diagnostics, private data, or secrets.

Issue #8 adds no manifest directive. Its privileged adapter loads exactly the
already private `chrome://fennevia/content/shell/ShellApp.js` URI into a
validated browser-window global. The temporary registration property rejects
collisions, is deleted after synchronous evaluation even on error, and cannot
select another path. This narrow local load is not script discovery, remote
loading, or a new content-accessible surface.

Issue #9 also adds no manifest directive. Its generated bridge ESM remains
inside the same privileged-only `chrome://fennevia/content/` package and is
imported only by the fixed runtime module. It exposes no `resource:` alias,
content-accessible flag, arbitrary path, or runtime loader API.

## 7. Installation and file-system safety

Install, update, disable, enable, and uninstall scripts:

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

The issue #4 implementation enforces these controls in
`scripts/fennevia-package.ps1` and `scripts/lib/FenneviaInstaller.psm1`.
`package-manifest.json` is the committed source/hash inventory; byte-identical
ownership records are installed in both selected roots. New content is staged
and verified before mutation, existing owned files are backed up, a relative-path
recovery journal is written, and caught partial failure rolls back. Any
interrupted transaction blocks later actions until explicit recovery. The
mandatory sequence and test evidence are in `docs/security-controls.md`; the
operator and manual-recovery contract is in `docs/installation.md`.

### Development-profile helper

The Phase 0 Windows helper is not an installer, but its profile deletion is still destructive and follows the same path-safety principles:

- it manages only `%LOCALAPPDATA%\fennevia\profiles\...`;
- it rejects Firefox-registered profiles, broad paths, files, reparse points, non-empty unowned directories, and active profiles;
- it requires a valid `.fennevia-dev-profile.json` ownership marker and explicit `-Force` before recursive deletion;
- it supports `-WhatIf` and never changes `profiles.ini`;
- it does not adopt, mutate, or delete a profile or ownership marker from the
  provisional project identity;
- its Phase 0 clean-environment gate detects existing AutoConfig declarations, enterprise-policy sources, profile add-ons, and profile chrome customizations without removing them;
- normal output redacts the Firefox executable and profile paths;
- revealing local paths requires explicit `-RevealPaths` opt-in and that output must not be shared;
- Browser Toolbox support keeps `devtools.debugger.prompt-connection=true` and limits the default scope to the parent process.

ADR-017 makes Fennevia the sole active identity. The migration adds no alias,
new mapping, dependency, runtime network behavior, or broader deletion scope;
its security regression is recorded in
`docs/research/fennevia-identity-migration.md`.

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

The issue #6 hosts do not hide any toolbar. The future overlay host remains
hidden, inert, `aria-hidden`, and pointer-transparent. Real Firefox checks kept
the native window-modal dialog in the top layer, left browser content
hit-testable, retained the navigator toolbox and native close command, and
confirmed the Browser Toolbox connection prompt remained enabled and usable.
Issue #7 still has no native-hide rule and never activates in production. Its
emergency handler clears the active marker before disposing project hosts, so
the retained toolbox, browser, modal, titlebar, and security prompts remain the
independent recovery surface.

Issue #8 mounts only inside the primary project host and still never enters
`active`. Toggling the extracted component style did not change the computed
styles of the native toolbox, sidebar, popup set, Urlbar input, application-menu
button, or modal prompt. Missing and throwing frontend bundles removed partial
project UI and left the retained native surface usable.

Issue #31 supersedes that initial host geometry with one zero-layout frame over
the browser content area. The frame is pointer-transparent except for its
seven-CSS-pixel edge triggers and currently visible owned panels, so the center
content hit target remains Firefox-owned. All four edges suspend for customize
mode, DOM fullscreen, and native window/tab-modal state; browser fullscreen
continues to follow `#browser` geometry without claiming OS controls. No native
node is hidden, resized, moved, or placed under Svelte ownership, and issue #15
still owns any future native-visible-shell gate.

## 9. Private windows

- Private-window behavior must be explicit: fully supported or complete native fallback.
- Do not persist private-window feature state that can reveal browsing activity.
- Do not include private-window URLs, titles, queries, or tab state in diagnostics.
- Project-global state must not accidentally share private-window browsing data with normal windows.
- Only schema-defined shell preferences whose values are independent of browsing activity may persist; private tabs, titles, URLs, favicons, queries, recent items, selection, and feature usage never persist.
- A feature that cannot prove per-window memory, synchronous disposal, and normal/private separation must use complete native fallback in private windows.

The Phase 2 base lifecycle fully supports private browser windows. Issue #6
originally added the same complete three-host set and fixed non-browsing
diagnostic used by normal windows; it read no tab, content, URL, title, query,
or profile state. ADR-026 later superseded only that host geometry.
Classification happens before the initializer, process-global snapshots retain
counts only, and unload/runtime stop abort and dispose the private hosts and
record. This does not pre-approve any future private-window bridge or feature:
each consumer must still prove its own data isolation or keep the complete
native fallback.

Issue #7 creates one health controller, timer, and emergency listener per
normal or private window. They contain only lifecycle state and fixed capability
results, persist nothing, and are synchronously removed on that window's
fallback or disposal. Triggering fallback in one normal window does not mutate
another normal or private window.

Issue #8 creates one Svelte instance and immutable interaction state per mount
target. Normal, second normal, and private windows did not share counter or
input state. The frontend receives only the fixed normal/private classification,
persists nothing, and logs no input; its API is held in a `WeakMap` until
per-window unmount and is never process-global serializable state.

Issue #9 creates a separate bridge context for each existing, second, and
private browser window. Active native windows and random process-local window
IDs are exclusive until disposal. Opaque handle IDs additionally include a
process-local registry generation, so an ID from another or already-disposed
context cannot resolve to a native object in the current context. No browsing
value is persisted or logged.

Issue #10 uses that machinery for tab state. Native tabs remain in one
context-scoped registry; the public and reactive snapshots contain only opaque
ID, bounded title text, booleans, and an optional allowlisted favicon value.
Titles and favicon values are never logged, persisted, placed in datasets, or
included in errors. Unknown fields are dropped again by the application-state
adapter. Normal and private state is held only by the owning window and is
cleared on frontend, tabs-controller, boundary, or window disposal.

The favicon boundary accepts bounded `chrome://`, `resource://`,
`moz-remote-image:`, and base64 raster image values. It rejects raw remote,
`about:`, SVG-data, malformed, oversized, whitespace/quote-bearing, and unknown
values to the no-favicon fallback. The bridge itself never loads the value; a
component may assign it only through an image property, not HTML or CSS. The
new-tab action accepts no browsing URL and uses only Firefox's fixed
`BROWSER_NEW_TAB_URL`.

Issue #11 implements that consumer without widening the data boundary. Titles
are inserted as text and as property-bound accessible/tooltip labels; `dir="auto"`
and plaintext bidi handling affect layout only. The optional favicon is bound
only to `img.src` with a static fallback and `referrerpolicy="no-referrer"`; a
load error hides the image and removes `src`. There is no `{@html}`, CSS URL,
style interpolation, content-accessible mapping, runtime fetch API, persistence,
or new dependency. Opaque IDs are retained in closures rather than DOM dataset
values. Normal diagnostics and test failure records contain only fixed codes,
booleans, and counts, never the exercised title or favicon value.

Each window still owns its own adapter, Svelte state, focus registry, bridge
subscription, and at most one close-focus retry timer. Every action replaces
that timer; unmount clears it and the root-delegated listeners before dropping
state. Normal, second, and private windows remained isolated. Issue #12 must
still prove the navigation data flow it introduces. Full evidence is in
`docs/research/firefox-153-tabs-bridge.md` and
`docs/research/firefox-153-tab-strip.md`.

Issue #31 gives every normal or private window its own frame, four Svelte roots,
four edge state machines, focus-origin map, environment observer, delegated
listeners, and tracked timers. Edge identity, reveal phase, and hold reason are
fixed enums with no browsing value; the controller never receives a title,
favicon, URL, query, profile path, native tab, or native window. Reverse disposal
clears every hold and timer before dropping per-window state. No edge state is
persisted or shared across windows. Full evidence is in
`docs/research/firefox-153-four-edge-shell.md`.

## 10. Source maps and debug artifacts

- Development source maps may remain local.
- Installed source maps require an explicit decision based on debugging value and exposure risk.
- Source maps must not be published through a content-accessible resource mapping by accident.
- Development-only failure-injection and debug APIs must be excluded or disabled in installed production artifacts.
- Production builds require an exact file inventory and must pass `scripts/check-production-artifacts.ps1`; scanner findings have no silent bypass.

The production scanner continues to reject runtime endpoints. Its only literal
exceptions are exact single-, double-, or backtick-quoted XHTML, XUL, SVG,
MathML, and XLink standards namespace URIs used by DOM creation; adding any
suffix, path, query, concatenation, or different URL remains a finding.
Issue #8 sets Vite production source maps to false and rejects source-map files
and references. Issue #9 applies the same rules to the bridge build; the current
package installs only the exact eleven-file profile inventory. Installed startup
and generated files have explicit repository EOL attributes so their manifest
hashes describe stable bytes across Windows checkouts.

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

The evidence required for each trigger is defined in `docs/security-controls.md`. A triggered change links a dedicated security issue or review before implementation; an ordinary “no impact” checkbox is not a waiver.

## 12. Reporting

Follow `SECURITY.md` for reporting. Do not disclose a live vulnerability in a public issue before the repository owner has had a reasonable opportunity to investigate, especially if the defect can execute privileged code or hide security UI.
