# Bootstrap and Chrome Package Feasibility Spike

## Purpose

Use the smallest possible implementation to prove that the following startup chain works reliably on the current Firefox stable:

```text
Firefox program-directory AutoConfig
  -> locate the active profile chrome directory
  -> register profile/chrome/my-firefox-shell/chrome.manifest
  -> import one privileged Bootstrap.sys.mjs
  -> observe browser-window lifecycle
```

This spike does not create a general-purpose loader, scan scripts, parse metadata, or mount the production UI.

## Questions the spike must answer

1. Which globals and privileged APIs are available when AutoConfig runs?
2. Does `UChrm` reliably resolve the active profile chrome directory?
3. Is `Components.manager.QueryInterface(Ci.nsIComponentRegistrar).autoRegister(manifestFile)` available on the current stable build?
4. Can `ChromeUtils.importESModule()` immediately load an entry through a newly registered `chrome://` or `resource://` URI?
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
    defaults/pref/my-firefox-shell.js
    my-firefox-shell.cfg
  profile/chrome/my-firefox-shell/
    chrome.manifest
    Bootstrap.sys.mjs
```

The first manifest should contain only project-owned namespace declarations, for example:

```text
content my-firefox-shell ./
resource my-firefox-shell ./
```

Do not use `override` in this spike. Do not add `contentaccessible=yes` without a separately documented requirement.

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
