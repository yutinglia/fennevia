# Firefox 153 minimal bootstrap research record

Recorded on 2026-08-14 for Issue [#3](https://github.com/yutinglia/fennevia/issues/3).

> Identity note (2026-08-15): this experiment predates the Fennevia identity
> migration in ADR-017 and issue #22. The `my-firefox-shell`,
> `myFirefoxShell`, and `MFS` literals below are retained as exact historical
> artifact, preference, and log names. Current equivalents and regression
> results are recorded in `docs/research/fennevia-identity-migration.md`.

## Environment

- Firefox version: 153.0.4
- Build ID: `20260810162159`
- Channel: release
- Firefox source stamp: `54be19de0e08edff0b797e55fd935dd3978b0a6d`
- Operating system: Windows 11 25H2, build `26200.8894`
- Profile: clean, marker-owned, direct-path development profile; not registered in `profiles.ini`
- Program: project-owned copy of the stock Firefox program under the managed local test root
- Project base commit: `b5b18f285c39889477181ac6478e58ffb0ebd67f`
- Initial clean-environment audit: no stock-program AutoConfig declaration, enterprise-policy source, profile add-on, or profile Chrome customization

Paths are intentionally represented by logical placeholders. No daily-use profile or system Firefox installation was modified.

## Symptom

The first implementation resolved `UChrm`, registered the project manifest, and resolved the fixed Chrome URI, but failed while importing the privileged entry. The first structured causal record was:

```text
event=bootstrap.fatal
phase=entry-import
errorMessage=Failed to load resource://gre/modules/Services.sys.mjs
firefoxVersion=153.0.4
buildId=20260810162159
```

The AutoConfig catch boundary retained the stack, but the first revision did not include a safe error message. The diagnostic record was corrected to include a 500-character, control-character-stripped message with remote URL, file URL, Windows path, data URL, and blob URL redaction.

## Minimal reproduction

1. Copy the stock Firefox program into a project-owned local test directory.
2. Install `spikes/bootstrap/program/defaults/pref/my-firefox-shell.js` and `spikes/bootstrap/program/my-firefox-shell.cfg` into that copy.
3. Install `spikes/bootstrap/profile/chrome/my-firefox-shell/` into the isolated profile's `chrome` directory.
4. Launch the copied browser with explicit `--no-remote --new-instance --profile <MFS_DEV_PROFILE> --jsconsole --new-window about:support` arguments.
5. Filter the parent-process Browser Console for `MFS bootstrap`.

The installed Firefox `omni.ja` did not contain `modules/Services.sys.mjs`. The supported source instead creates a `Services` object and defines it on privileged module-loader globals.

## First causal evidence

- Browser Console: `bootstrap.fatal` at `entry-import`, with the fixed dependency URI above and a stack ending at the `ChromeUtils.importESModule()` call.
- Installed artifact: Firefox 153's `omni.ja` contains `AppConstants.sys.mjs` and `SimpleServices.sys.mjs`, but no `Services.sys.mjs`.
- Official source: [`mozJSModuleLoader.cpp`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/js/xpconnect/loader/mozJSModuleLoader.cpp) creates and defines `Services`, including on the loader shared global.
- Current-source caller: [`SearchUIUtils.sys.mjs`](https://searchfox.org/firefox-main/source/browser/components/search/SearchUIUtils.sys.mjs) uses `Services` without importing `Services.sys.mjs`.
- Browser Toolbox: the exact Firefox build and retained `browser.xhtml` root had already passed the Phase 0 development-profile baseline. It was not reopened for this pre-window import failure; no Phase 1 Browser Toolbox result is claimed. Browser Console plus installed-artifact and official-source evidence identified the first cause.

## Sources checked

### Compatibility canaries

- [`alice0775/userChrome.js` at `5e146e348a56a914e6c016d29733e8ee8d468155`](https://github.com/alice0775/userChrome.js/tree/5e146e348a56a914e6c016d29733e8ee8d468155)
  - Inspected the current Firefox 155 AutoConfig/loader files and recent compatibility commits.
  - [`42757542efebed7c0461e3cb9277fde82aa05c04`](https://github.com/alice0775/userChrome.js/commit/42757542efebed7c0461e3cb9277fde82aa05c04) adapted to Bug 1974213 by moving `loadSubScript` away from direct `file:` loading.
  - [`a4a3d2ab1f3add919e19849552f544f4df489cf6`](https://github.com/alice0775/userChrome.js/commit/a4a3d2ab1f3add919e19849552f544f4df489cf6) tracked Bug 2017957's `Cu.Sandbox` `freezeBuiltins` change.
  - The repository exposes no detectable SPDX license through GitHub, so no implementation code was copied.
- [`MrOtherGuy/fx-autoconfig` at `dfdab5684faffc112b76ccb1d8cab7f75da0102c`](https://github.com/MrOtherGuy/fx-autoconfig/tree/dfdab5684faffc112b76ccb1d8cab7f75da0102c)
  - Inspected `program/config.js`, `profile/chrome/utils/chrome.manifest`, and `profile/chrome/utils/boot.sys.mjs`.
  - The useful seed is `UChrm` -> `autoRegister()` -> one ESM import.
  - [`db8bdc396a6d1037f7276358269f98fb6ec9564f`](https://github.com/MrOtherGuy/fx-autoconfig/commit/db8bdc396a6d1037f7276358269f98fb6ec9564f) switched its bootstrap to `boot.sys.mjs`.
  - The project is MPL-2.0, but no code was copied; the implementation was derived from official source and local evidence.
- [`xiaoxiaoflood/firefox-scripts` at `a898ac59fb0ca3886c0c46b184fdbc037c83c037`](https://github.com/xiaoxiaoflood/firefox-scripts/tree/a898ac59fb0ca3886c0c46b184fdbc037c83c037)
  - Inspected `installation-folder/config.js`, its manifest, and bootstrap patterns.
  - Confirmed the same broad `UChrm`/manifest seed, but also found extension-signing bypasses, a general `resource userchromejs` alias, legacy add-on behavior, and generic script loading. None was adopted.
  - License: MPL-2.0.
- [`aminomancer/uc.css.js` at `88514013ddc375f4770f4a35d8d07a91d6dd7d8f`](https://github.com/aminomancer/uc.css.js/tree/88514013ddc375f4770f4a35d8d07a91d6dd7d8f)
  - Inspected `utils/chrome.manifest` for registration examples.
  - It includes broad overrides and a content-accessible resource mapping that are outside this project's architecture.
  - GitHub reports `NOASSERTION` for the repository license metadata; no code was copied.

### Official Firefox source

Installed release source revision:

- [`nsReadConfig.cpp`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/extensions/pref/autoconfig/src/nsReadConfig.cpp): reads AutoConfig preferences, skips the cfg first line, and selects privileged or restricted evaluation.
- [`nsJSConfigTriggers.cpp`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/extensions/pref/autoconfig/src/nsJSConfigTriggers.cpp): creates the AutoConfig globals and system-principal sandbox.
- [`nsAppDirectoryServiceDefs.h`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/xpcom/io/nsAppDirectoryServiceDefs.h): defines `UChrm` as the user Chrome directory.
- [`nsIComponentRegistrar.idl`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/xpcom/components/nsIComponentRegistrar.idl): defines `autoRegister()` and states that registration lasts for the run and is not cached.
- [`nsComponentManager.cpp`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/xpcom/components/nsComponentManager.cpp): adds the manifest location immediately when the component manager is running normally.
- [`ManifestParser.cpp`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/xpcom/components/ManifestParser.cpp): parses `content`, `resource`, and `contentaccessible` declarations.
- [`nsChromeRegistry.cpp`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/chrome/nsChromeRegistry.cpp): resolves Chrome URIs and defaults content access to denied unless explicitly opened.
- [`mozJSModuleLoader.cpp`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/js/xpconnect/loader/mozJSModuleLoader.cpp): creates the loader `Services` object and defines it on globals that need it.
- [`toolkit/docs/internal-urls.md`](https://hg.mozilla.org/releases/mozilla-release/file/54be19de0e08edff0b797e55fd935dd3978b0a6d/toolkit/docs/internal-urls.md): documents that both `chrome:` and `resource:` are privileged-only by default and that `contentaccessible=yes` opens the entire mapping to web content.

Current official GitHub mirror revision checked during research: [`8e42adb00f0d301d1b74f71d5f7d49228eb712c9`](https://github.com/mozilla-firefox/firefox/tree/8e42adb00f0d301d1b74f71d5f7d49228eb712c9).

Relevant upstream commits:

- [`8b369011b77fe4a914e77c11f0b83e5e79846a4d`](https://github.com/mozilla-firefox/firefox/commit/8b369011b77fe4a914e77c11f0b83e5e79846a4d), Bug 1766114: defines `ChromeUtils` in the privileged AutoConfig sandbox.
- [`c7c574c601542f4923278666e77a3b30efdec5ec`](https://github.com/mozilla-firefox/firefox/commit/c7c574c601542f4923278666e77a3b30efdec5ec), Bug 2011307: removes old test-only Chrome URI remote-loading support; the removed flags are not used here.

## Upstream behavior identified

1. Release AutoConfig defaults to restricted evaluation; the fixed bootstrap requires the explicit privileged setting and must therefore remain tiny and auditable.
2. Firefox ignores the first cfg line, so the project keeps a mandatory first-line comment.
3. `UChrm` resolves the selected profile's `chrome` directory without hard-coded paths.
4. `autoRegister()` can register the profile manifest during startup and does not persist or cache that registration across runs.
5. The newly registered fixed Chrome URI can be resolved and imported immediately.
6. Firefox 153 privileged module globals provide `Services`; the formerly common `Services.sys.mjs` URI is absent from this build.
7. Both Chrome and resource mappings deny ordinary web content by default. `contentaccessible=yes` is the explicit package-wide exposure switch.
8. The older `build/docs/chrome-registration.rst` warning about resource aliases conflicts with the newer internal-URL security section. The supported release source and runtime test take precedence.

## Loader-specific baggage identified

The canaries solve broader problems than this project needs. Excluded behavior includes:

- arbitrary `.uc.js` discovery and directory scanning;
- userscript metadata parsing and per-script include/exclude behavior;
- arbitrary sandbox creation, evaluation, and compatibility shims;
- overlay or large manifest override sets;
- content-accessible aliases and generic user resource namespaces;
- extension-signing and origin-check bypasses;
- legacy add-on bootstrapping, updater/network behavior, menus, notifications, caches, and hot reload;
- catches that discard startup exceptions.

No canary is a runtime dependency.

## Options considered

1. Import `Services.sys.mjs` from the project entry. Rejected by real Firefox 153 evidence because the module URI is absent.
2. Use the loader-defined `Services` global after a runtime check. Selected because current source defines it and current privileged modules use it.
3. Add a `resource://my-firefox-shell/` alias. Rejected for Phase 1 because there is no consumer and the Chrome package already provides the fixed entry.
4. Use `file:` loading or a generic loader. Rejected because a dedicated registered URI is smaller, current, and avoids arbitrary-script behavior.
5. Suppress import errors. Rejected; the only catch is the outer fail-open boundary and it emits a structured, privacy-safe causal record.

## Decision and minimum adaptation

The selected chain is:

```text
program defaults pref
  -> privileged my-firefox-shell.cfg
  -> UChrm/my-firefox-shell/chrome.manifest
  -> autoRegister(manifest)
  -> convertChromeURL(fixed entry)
  -> importESModule(fixed entry)
  -> validate bootstrapResult
```

The manifest has one line:

```text
content my-firefox-shell content/
```

AutoConfig evaluates safe start before registration, records process state with a symbol key, and emits structured success, duplicate, skip, or fatal records. The module validates the built-in `Services` global, rejects duplicate top-level initialization, and exports one frozen result. It creates no window listener, UI host, stylesheet, timer, observer, resource alias, override, or network behavior.

## Security and privacy effects

- AutoConfig executes as system principal, so its scope is restricted to fixed path construction, one manifest registration, one URI resolution/import, contract validation, and local console diagnostics.
- The production package inventory contains exactly `chrome.manifest` and `content/Bootstrap.sys.mjs`.
- No `contentaccessible=yes`, `resource`, `style`, `skin`, `locale`, or `override` declaration exists.
- An ordinary loopback HTTP page could not fetch the privileged entry.
- Fatal logs include no browsing URL, page title, query, history, private state, token, cookie, or profile path. Potential URL/path-bearing error data is redacted.
- The content-access test server binds only `127.0.0.1`, uses an ephemeral port, has no dependency, and exits after the local result.
- The system Firefox installation and daily profiles were not modified; integration writes were limited to marker-owned local test roots.

## Validation performed

Static checks passed in PowerShell 7 and Windows PowerShell 5.1. Both JavaScript artifacts and the Node content probe passed `node --check`. The production-artifact scanner accepted the exact package inventory.

Real Firefox results:

- Three repeatable cold starts: one `bootstrap.success` per process, `initializationCount=1`.
- Second normal window: two native windows, still one process success record.
- Private launch: native private window, still one process success record.
- Missing manifest: fatal at `manifest-locate`; native window remained.
- Malformed manifest: fatal at `entry-resolve`; native window remained.
- Incorrect entry URI: fatal at `entry-import`; native window remained.
- Entry syntax error: fatal at `entry-import` with `SyntaxError`; native window remained.
- Duplicate cfg evaluation: one success plus one duplicate-skip record, no fatal record.
- Preference safe start: one skip record and native window; no entry initialization. Because Firefox persisted the `user.js` value, the fixture then explicitly set the preference back to `false` and verified a final successful cold start instead of assuming that restoring `user.js` cleared it.
- Corrected entry after syntax failure: success on the next cold start without clearing startup cache.
- Ordinary HTTP page: fetch of the project Chrome entry was blocked and the generated screenshot showed PASS.
- Complete project-file removal: no project Browser Console record and stock native startup, without clearing startup cache.
- Every test process closed with no remaining process for the explicit profile, the safe-start preference no longer retained a stale `true` value, and the test fixtures restored the source artifacts.

## Remaining compatibility risk

- AutoConfig, Chrome Registry, loader globals, and `UChrm` are internal or deployment-sensitive behavior and must be retested on every supported Firefox stable.
- The explicit `Services.appinfo.inSafeMode` branch was source-reviewed; the preference safe-start branch was the one exercised in this spike.
- This issue proves only the process bootstrap. It does not implement browser-window observers, production UI, native-UI hiding, or runtime disposal.
- The future installer must safely own, update, rollback, and remove program-directory files; this spike used only a disposable program copy.
- Only Windows and Firefox release 153.0.4 were tested. No Linux or macOS support claim is made.

## Follow-up

- Issue #4 owns the transactional Windows install, update, disable, rollback, and uninstall workflow.
- Future runtime issues must add window lifecycle and deterministic cleanup without expanding AutoConfig.
- On each Firefox stable update, rerun the cold-start, failure, content-access, removal, second-window, private-window, and safe-start matrix before declaring compatibility.
