# Bootstrap and Chrome Package Feasibility Spike

## Purpose

Use the smallest possible implementation to prove that the following startup chain works reliably on the current Firefox stable:

```text
Firefox program-directory AutoConfig
  -> locate the active profile chrome directory
  -> register profile/chrome/fennevia/chrome.manifest
  -> import one privileged Bootstrap.sys.mjs
  -> observe browser-window lifecycle
```

This spike does not create a general-purpose loader, scan scripts, parse metadata, or mount the production UI.

## Questions the spike must answer

1. Which globals and privileged APIs are available when AutoConfig runs?
2. Does `UChrm` reliably resolve the active profile chrome directory?
3. Is `Components.manager.QueryInterface(Ci.nsIComponentRegistrar).autoRegister(manifestFile)` available on the current stable build?
4. Can `ChromeUtils.importESModule()` immediately load an entry through the newly registered `chrome://fennevia/` content package?
5. Does registration occur early enough for the required first-window lifecycle hook?
6. How are an existing normal window, a second window, and a private window observed?
7. How do manifest and bundle changes interact with startup cache, and what deterministic invalidation procedure is required?
8. Do a missing manifest, malformed manifest, syntax error, or failed import leave Firefox starting with native UI?
9. Which safe-start mechanism can disable shell initialization before activation?
10. Which Firefox program-directory and profile files are required for install and removal?
11. Which files or URI mappings become content-accessible, and how is unintended exposure prevented?

## Reference implementations, not dependencies

`MrOtherGuy/fx-autoconfig` currently demonstrates a useful research pattern: resolve a manifest beneath `UChrm`, call the component registrar's `autoRegister()`, and import a privileged `boot.sys.mjs`. Treat this as a research seed only. This project does not need its script discovery and compatibility runtime.

Also inspect:

- the latest `alice0775/userChrome.js` changes related to AutoConfig, sandboxing, compile/import behavior, and Firefox startup changes;
- the current bootstrap in `xiaoxiaoflood/firefox-scripts`;
- `aminomancer/uc.css.js` for content, skin, resource, stylesheet, and override registration patterns;
- Searchfox and official Firefox source for current callers of `nsIComponentRegistrar.autoRegister`, Chrome Registry code, startup lifecycle, and cache behavior.

Record the exact commit SHA or source revision used for every unstable reference.

## Suggested temporary layout

```text
spikes/bootstrap/
  program/
    defaults/pref/fennevia.js
    fennevia.cfg
  profile/chrome/fennevia/
    chrome.manifest
    content/Bootstrap.sys.mjs
```

The first manifest should contain only the project-owned content-package declaration:

```text
content fennevia content/
```

The `resource://fennevia/` namespace is reserved but the initial alias is omitted because Phase 1 has no resource consumer and every extra mapping expands the package surface. Firefox 153's current internal-URL documentation says both `chrome:` and `resource:` mappings are privileged-only by default; `contentaccessible=yes` explicitly opens either mapping to web content. Any later resource mapping still requires an exact file inventory, a real consumer, and ordinary-content tests under ADR-016 and `docs/security-controls.md`.

Do not use `override` in this spike. Do not add `contentaccessible=yes` without a separately documented requirement and dedicated security review.

## Bootstrap behavior requirements

- Follow the current AutoConfig file-format requirement, including its first-line behavior.
- Resolve every path explicitly and report useful errors.
- If the manifest does not exist, log the failure and exit without changing browser UI.
- If entry import fails, retain the complete stack and phase information.
- Initialize the process-global runtime at most once.
- Initialize each eligible browser window at most once.
- Do not create framework UI, styles, or business logic.
- Do not download or remotely import any resource.
- Do not log browsing URLs, titles, or private-window content.
- Keep all failure paths fail open.

## Required evidence

The issue or pull request must include:

- Firefox version, build ID, channel, operating system, and project commit;
- the actual program/profile layout used;
- cold-start Browser Console logs;
- normal, second, and private-window lifecycle logs;
- missing-manifest and broken-entry failure tests;
- startup-cache observations and the validated cleanup command;
- complete uninstall validation;
- the upstream and loader source revisions consulted;
- an explanation of which loader behavior was intentionally not adopted.

## Acceptance criteria

- A clean development profile completes at least three repeatable cold starts.
- A project-owned ESM entry loads through a registered URI.
- A second browser window does not create a second process-global runtime.
- Private-window behavior is explicitly defined and tested.
- Every bootstrap failure leaves native Firefox UI fully usable.
- Removal of the AutoConfig files and project package restores stock startup with no residual project error.
- Startup-cache behavior and required invalidation are documented from evidence.
- Resource exposure is inspected and no unintended privileged asset is content-accessible.
- Results update `docs/architecture.md`, `docs/firefox-internals-map.md`, `docs/security-and-privacy.md`, and `docs/testing-and-recovery.md`.

## Observed Phase 1 result

Issue #3 validated the spike under the provisional package identity on Firefox
153.0.4 release, build ID `20260810162159`, on Windows 11 25H2. The exact
historical evidence and upstream revisions are recorded in
`docs/research/firefox-153-bootstrap.md`. Issue #22 migrated the active package
to Fennevia and repeated the identity-sensitive runtime checks; see
`docs/research/fennevia-identity-migration.md`.

- `UChrm`, `autoRegister()`, immediate Chrome Registry resolution, and `ChromeUtils.importESModule()` completed in one early AutoConfig evaluation.
- Firefox 153 no longer packages `resource://gre/modules/Services.sys.mjs`; privileged ES modules receive a loader-defined `Services` global, which the entry validates before use.
- Three repeatable cold starts emitted exactly one process success record each. A second normal window and a private window did not reinitialize the process runtime.
- Missing and malformed manifests, a wrong entry URI, and an entry syntax error all failed open with native Firefox windows present.
- Restoring the entry after a syntax failure took effect on the next cold start without clearing startup cache. Removing the AutoConfig preference file, cfg file, and profile package restored a stock startup with no project record.
- An ordinary loopback HTTP page could not fetch `chrome://fennevia/content/Bootstrap.sys.mjs`.
- `fennevia.safeStart=true` skipped project initialization before manifest registration and left native Firefox available.
- The Fennevia regression repeated cold starts, safe start, missing-manifest
  fail-open and recovery, content denial, normal/private windows, cleanup, and
  full project-file removal without a legacy namespace alias.
