# Firefox Research and Debugging Playbook

This document defines the required investigation order for Firefox updates, bootstrap failures, internal API changes, DOM changes, and CSS behavior changes. The goal is to identify the upstream cause and implement the smallest justified adaptation instead of accumulating accidental workarounds.

## 1. Establish reproducible evidence first

Begin every investigation with:

```text
Date:
Firefox version:
Firefox build ID:
Channel:
Operating system:
Profile: clean / existing
Project commit:
Startup mode: normal / safe start / failure injection
Symptom:
First root error and stack:
Minimal reproduction:
```

Use the dedicated development profile. Disable unrelated userChrome files, loaders, extensions, policies, and experiments where practical.

Classify the failure before changing code:

- AutoConfig did not execute;
- the manifest did not register;
- the privileged ESM import failed;
- startup or window-lifecycle timing changed;
- a bridge symbol, event, or property changed;
- an expected DOM insertion point changed;
- framework or CSS behavior changed;
- startup cache or a stale build artifact is executing;
- installation or profile-path selection is wrong.

## 2. Use Firefox's own diagnostic tools

Inspect:

- Browser Console for startup, import, and runtime exceptions;
- Browser Toolbox for browser-chrome DOM, namespaces, computed style, events, globals, and retained native UI;
- `about:support` for version, build ID, executable, and profile information;
- `about:profiles` to confirm the active test profile;
- narrowly scoped diagnostic logging when needed.

Find the first causal error. Later missing-element, null-reference, or mount errors are often consequences.

Do not enable logging that records browsing data by default. Follow `docs/security-and-privacy.md`.

## 3. Check maintained compatibility canaries

These projects are not dependencies, but they often encounter AutoConfig, sandbox, script-loader, Chrome Registry, or browser-DOM changes early.

### Alice0775 userChrome.js

Repository: `https://github.com/alice0775/userChrome.js`

Inspect:

- the latest relevant commit;
- the current Firefox-version directory or active loader file;
- version notes and referenced Firefox bugs;
- related issues and pull requests;
- changes involving sandboxing, compilation, module loading, window filtering, or startup behavior.

Do not assume the historically familiar directory is the current implementation.

### MrOtherGuy fx-autoconfig

Repository: `https://github.com/MrOtherGuy/fx-autoconfig`

Inspect current:

- program `config.js`;
- `chrome.manifest`;
- `boot.sys.mjs`;
- module-loading and window-lifecycle utilities;
- recent commits and issues involving startup cache, registration, or Firefox version changes.

### xiaoxiaoflood firefox-scripts

Repository: `https://github.com/xiaoxiaoflood/firefox-scripts`

Use it to cross-check AutoConfig, userChromeJS bootstrap, privileged extension patterns, and current Firefox compatibility. Judge maintenance per component and commit, not only by repository activity.

### aminomancer uc.css.js

Repository: `https://github.com/aminomancer/uc.css.js`

Inspect:

- `chrome.manifest`;
- content, skin, and resource registration;
- stylesheet service use;
- script and resource overrides;
- current compatibility changes.

Its large override set is a research case, not this project's default architecture.

For every loader fix, answer:

1. What changed in Firefox upstream?
2. Which part of the fix exists only because the project is a generic or legacy-compatible loader?
3. What is the minimum behavior required by this project?
4. What evidence proves that minimum behavior is sufficient?

Record the exact commit SHA or retrieval date for unstable references.

## 4. Use Searchfox as the primary source browser

Searchfox: `https://searchfox.org/`

Common starting points:

- `browser/base/content/browser.xhtml`
- `browser/base/content/navigator-toolbox.inc.xhtml`
- `browser/components/tabbrowser/`
- `browser/components/urlbar/`
- `browser/components/sidebar/`
- `browser/components/sessionstore/`

Recommended search order:

1. exact exception text;
2. failing symbol, class, DOM ID, URI, or preference;
3. definition;
4. all current callers and usages;
5. nearby tests;
6. blame or annotate history;
7. linked Bugzilla issue and upstream commit.

Do not inspect only a definition. The practical contract of an internal API is often visible in callers, tests, and lifecycle ordering.

Paths move across versions, so search by symbol first and record the current path after verification.

## 5. Use official source, documentation, and bug history

Primary sources:

- Official Firefox source: `https://github.com/mozilla-firefox/firefox`
- Firefox Source Docs: `https://firefox-source-docs.mozilla.org/`
- Chrome registration: `https://firefox-source-docs.mozilla.org/build/buildsystem/chrome-registration.html`
- Tabbed browser documentation: `https://firefox-source-docs.mozilla.org/browser/components/tabbrowser/docs/index.html`
- AutoConfig documentation: `https://support.mozilla.org/kb/customizing-firefox-using-autoconfig`
- Bugzilla: `https://bugzilla.mozilla.org/`

When version history matters:

- identify the commit that changed the symbol or path;
- read its commit message and linked Bugzilla issue;
- compare callers and tests before and after the change;
- confirm whether the change reached stable, beta, or only central/nightly;
- do not apply a nightly-only fix to stable without evidence.

## 6. Use GitHub for code and history queries

GitHub is useful for:

- official mirror commits and pull requests;
- loader fix comparisons;
- cross-repository searches for a Firefox symbol;
- Firefox derivative frontend patterns;
- exact file history where Searchfox context is insufficient.

Prefer exact English terms. Example queries:

```text
repo:mozilla-firefox/firefox "nsIComponentRegistrar" "autoRegister"
repo:alice0775/userChrome.js "freezeBuiltins"
repo:MrOtherGuy/fx-autoconfig "startup cache"
repo:aminomancer/uc.css.js "override chrome://browser"
```

Do not treat a GitHub search snippet as sufficient source context. Open the file, commit, and surrounding code.

## 7. Treat Firefox derivatives as pattern references only

Floorp, Noraneko, Zen, and other derivatives may demonstrate modern frontend, build, bridge, or patch-layer patterns. They may also rely on:

- a Firefox source fork;
- build-time patching;
- custom compile flags;
- packaging hooks unavailable to stock Firefox;
- a proprietary or project-specific runtime.

Before adopting a pattern, document which part works through stock-Firefox runtime hooks and which part requires a fork.

## 8. External code and licensing

- Verify the repository and file license before copying implementation code.
- Copying a concept is not the same as copying a concrete implementation.
- Preserve required attribution, license headers, and source commit references.
- Treat code with no clear license as unavailable for direct inclusion.
- Keep third-party code separate enough that provenance and relicensing remain understandable.

## 9. Required research record

```markdown
## Environment
- Firefox version:
- Build ID:
- Channel:
- Operating system:
- Profile:
- Project commit:

## Symptom

## Minimal reproduction

## First causal evidence
- Browser Console:
- Browser Toolbox:

## Sources checked
- Alice0775 commit/issue:
- fx-autoconfig commit/issue:
- xiaoxiaoflood commit/issue:
- aminomancer commit/issue:
- Searchfox path/revision:
- Official Firefox commit/Bugzilla:

## Upstream change

## Loader-specific baggage identified

## Options considered

## Decision and minimum adaptation

## Security and privacy effects

## Validation performed

## Remaining compatibility risk

## Follow-up
```

Move durable conclusions into `docs/`. A one-version incident may remain in an issue, but its evidence and validation must be complete.
