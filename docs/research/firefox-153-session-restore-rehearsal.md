# Firefox 153 persisted SessionStore rehearsal

## 1. Scope and result

Issue #46 closes the persisted-session evidence gap left by the MVP hardening
rehearsal. It proves that stock Firefox SessionStore, the ordinary Fennevia tabs
bridge, lazy background tabs, native reveal, fail-open behavior, and cleanup
agree across real process boundaries. It does not add production persistence,
workspace semantics, a SessionStore bridge, or support beyond the tested
Windows/Firefox build.

The fixed prepare, verify, missing-frontend fail-open, and cleanup sequence
passed under PowerShell 7.6.4 and Windows PowerShell 5.1. No first-party
unhandled Browser Console script error was observed in any phase.

## 2. Environment

- Date: 2026-08-16
- Firefox: 153.0.4 stable, build ID `20260810162159`, tag
  `FIREFOX_153_0_4_RELEASE`, release commit
  `c178247e1dfea52241a6b18b18cf3a00f8da935c`
- Firefox source stamp: `54be19de0e08edff0b797e55fd935dd3978b0a6d`
- Operating system: Windows 11 Pro 25H2, build `26200.9168`
- Project base: `d68c466df5a09490c7c8289f02dacee134122b1d`
- Project branch: `codex/issue-46-session-restore`
- Toolchain: nvm-managed Node.js 24.18.0, npm 11.16.0, PowerShell
  7.6.4, and Windows PowerShell 5.1
- Target state: one dedicated marker-owned Firefox copy and one dedicated
  marker-owned development profile, with the current package installed from
  the repository manifest

Local program/profile paths are deliberately omitted. An older unrelated
copied target whose package source no longer matched was rejected by the
installer's repair preflight and left untouched; this rehearsal used a new
marker-owned pair.

## 3. First causal evidence

The earlier lifecycle and hardening tests restarted or remounted Fennevia and
retained Firefox-owned SessionStore infrastructure, but did not create a fixed
multi-tab state, cross a confirmed clean-shutdown disk write, and inspect lazy
pending state in a later process. Therefore they could not distinguish real
session persistence from same-process lifecycle behavior.

This was an evidence gap rather than a production failure. The first relevant
runtime observation was a healthy fixed fixture in the prepare process; the
causal boundary under test was Firefox's normal process shutdown and next
startup, not a later UI symptom. Startup cache, unrelated extensions, policies,
other customizations, and daily-use profiles were excluded through the existing
clean-profile/program verification.

## 4. Current Firefox source evidence

All source links are pinned to the tested Firefox release commit.

| Dependency | Revision and selected behavior |
| --- | --- |
| [`SessionStartup.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/sessionstore/SessionStartup.sys.mjs) | Blob `86600ffb5178599ab23270a964064ca657a3283f`; `browser.startup.page = 3` participates in automatic normal resume selection. |
| [`SessionStore.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/sessionstore/SessionStore.sys.mjs) | Blob `11191a82a0f0dc6eee60f9de52a63bc6085c3981`; `promiseAllWindowsRestored` waits for restored window/tab shells, `setBrowserState()` is explicitly test-only, and lazy background tabs may retain the native `pending` attribute. |
| [`SessionFile.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/sessionstore/SessionFile.sys.mjs) | Blob `5580838acd72bf0e1189d367984859529d89f5b4`; the final write is a profile-shutdown blocker, making normal process exit the persistence boundary. |
| [`SessionSaver.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/sessionstore/SessionSaver.sys.mjs) | Blob `9141793550f7c7ff6aa63d4c85bf571b4499e2d0`; coordinates SessionStore saves. |
| [`TabStateFlusher.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/sessionstore/TabStateFlusher.sys.mjs) | Blob `ed7953e41e8d61695c04cd9fc40f9a9d40d56d77`; flushes connected browsers without forcing pending tabs. Prepare/cleanup use it after fixed test-only state replacement, but normal shutdown and process exit remain the disk-persistence proof. |

Current upstream tests also informed the fixed selected/pinned/pending
expectations: [`test_restore_manually_with_pinned_tabs.py`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/sessionstore/test/marionette/test_restore_manually_with_pinned_tabs.py),
blob `5e92dce2b0a46f7ced2e12c97eae81f85e3e655b`, and
[`browser_pending_tabs.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/sessionstore/test/browser_pending_tabs.js),
blob `20f3c4e8cae21bedb450f5eeea2392cced23a7b9`.

## 5. Compatibility canaries

The four required current heads were checked for SessionStore/startup changes:

| Canary | Checked revision | Finding |
| --- | --- | --- |
| `alice0775/userChrome.js` | [`5e146e348a56a914e6c016d29733e8ee8d468155`](https://github.com/alice0775/userChrome.js/commit/5e146e348a56a914e6c016d29733e8ee8d468155), 2026-07-30 | No applicable persisted-session adaptation was found. |
| `MrOtherGuy/fx-autoconfig` | [`dfdab5684faffc112b76ccb1d8cab7f75da0102c`](https://github.com/MrOtherGuy/fx-autoconfig/commit/dfdab5684faffc112b76ccb1d8cab7f75da0102c), 2026-07-23 | No applicable persisted-session adaptation was found. |
| `xiaoxiaoflood/firefox-scripts` | [`a898ac59fb0ca3886c0c46b184fdbc037c83c037`](https://github.com/xiaoxiaoflood/firefox-scripts/commit/a898ac59fb0ca3886c0c46b184fdbc037c83c037), 2025-02-10 | No applicable persisted-session adaptation was found. |
| `aminomancer/uc.css.js` | [`88514013ddc375f4770f4a35d8d07a91d6dd7d8f`](https://github.com/aminomancer/uc.css.js/commit/88514013ddc375f4770f4a35d8d07a91d6dd7d8f), 2026-01-06 | No applicable persisted-session adaptation was found. |

These repositories were compatibility signals only. No implementation or
loader behavior was copied.

## 6. Selected design and rejected alternatives

ADR-035 selects a test-only transaction around stock SessionStore:

- four fixed local data-URL fixtures named `pinned`, `selected`, `lazy-a`, and
  `lazy-b`;
- one pinned tab, one selected tab, and three expected pending tabs after the
  next process starts;
- exact native/Fennevia order agreement through the existing tabs bridge;
- normal quit and complete process exit after prepare and cleanup;
- a marker containing only prior user-value state for seven fixed preferences;
- exact package-hash validation and byte restoration around missing-frontend
  fail-open injection;
- default-deny evidence containing fixed IDs, enums, booleans, and counts.

Rejected alternatives were:

1. adding a production SessionStore adapter or Fennevia persistence schema;
2. treating `setBrowserState()` completion in the same process as persistence;
3. using a daily-use profile or serializing its raw session state;
4. killing Firefox instead of waiting for its final shutdown write;
5. selecting or flushing every tab before checking pending state;
6. clearing startup cache without an observed stale-code symptom;
7. deleting an interrupted marker or broad preference state by hand.

## 7. Implementation and transaction ownership

`tests/session-restore-contract.mjs` owns fixed modes, the preference allowlist,
marker/evidence validation, and sensitive-field rejection. Its Node tests cover
preference scope, stale markers, and output privacy.

`tests/firefox-window-lifecycle.mjs` owns the privileged prepare, verify,
fail-open, and cleanup browser phases. It waits for current SessionStore startup,
checks the fixture before interaction, verifies native reveal/release, and uses
ordinary lifecycle/Browser Console accounting.

`tests/firefox-session-restore.ps1` owns the outer transaction. It accepts only
marker-owned Fennevia program/profile roots, validates the package-manifest hash
of the one injected file, keeps a temporary backup outside the installed path,
restores exact bytes in `finally`, attempts cleanup after this invocation creates
state, and verifies that no Firefox process or rehearsal marker remains. A
pre-existing marker blocks before mutation and routes the operator to the
documented cleanup-only command.

## 8. Privacy and security review

The fixture URLs and titles never enter shared output. Evidence accepts only the
four fixed IDs plus fixed phase/state fields, booleans, and bounded counts. Raw
SessionStore state, native tab/browser objects, preference branches, profile
paths, program paths, private-window state, and page-derived strings cannot be
serialized by the contract.

Only seven preferences are mutable, each after recording whether a user value
existed and its typed value. Cleanup restores value and ownership state exactly.
The transaction marker contains no tab/session data. There is no production
caller, runtime network request, telemetry, or new content-accessible resource.

## 9. Automated validation

The following prechecks passed before the real browser run:

```powershell
node --check .\tests\session-restore-contract.mjs
node --check .\tests\session-restore-contract.test.mjs
node --check .\tests\firefox-window-lifecycle.mjs
node --test .\tests\session-restore-contract.test.mjs
npm test
npm run lint
npm run format:check
pwsh -NoProfile -File .\tests\session-restore-harness.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\tests\session-restore-harness.Tests.ps1
npm run verify
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\tests\run-static-powershell-tests.ps1
```

The focused contract suite reported 3/3 passing tests; the full Node suite
reported 152 passing tests. Both PowerShell implementations passed the static
wrapper contract and complete fixed-list PowerShell suite. `npm run verify`
also completed format, lint, zero-warning typecheck, dependency audit,
deterministic frontend/bridge build, package-manifest synchronization, and all
12 production-artifact inventory/security checks.

## 10. Real Firefox evidence

The same wrapper command was run once under PowerShell 7.6.4 and once under
Windows PowerShell 5.1, using placeholders here to avoid local paths:

```powershell
pwsh -NoProfile -File .\tests\firefox-session-restore.ps1 `
  -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe' `
  -ProfilePath '<FENNEVIA_PROFILE>'
```

Both runs produced the same privacy-safe result:

- prepare: active healthy shell, one managed window, six project hosts, four
  native/frontend fixtures in `pinned`, `selected`, `lazy-a`, `lazy-b` order,
  one pinned tab, selected `selected`, and zero first-party script errors;
- verify in a new process: the same order/selection/pinning, exact pending IDs
  `pinned`, `lazy-a`, `lazy-b`, successful native reveal and release, one
  runtime start/window initialization, and zero first-party script errors;
- missing-frontend fail-open in another process: inactive shell, zero managed
  windows/hosts/frontend records, the complete native order retained, exactly
  one expected shell failure, successful pending-tab activation and selection
  restoration, and zero first-party script errors;
- cleanup: zero fixtures, one healthy runtime/window, preferences restored,
  transaction marker removed, one blank tab persisted through normal shutdown,
  and zero first-party script errors.

The wrapper's final assertions also found no Firefox process and exact restored
frontend bytes. No startup-cache action was needed.

## 11. Failure and interruption recovery

Every phase emits a fixed causal failure and leaves native Firefox authoritative.
The outer wrapper restores the injected file in `finally` and invokes cleanup
when a transaction marker exists. A stale marker deliberately blocks a new
prepare run. Manual recovery must first establish exact installed bundle bytes,
close Firefox, then run the documented `--session-restore cleanup` phase; the
marker must not be deleted manually.

## 12. Remaining risk and support boundary

- Real evidence covers only Firefox 153.0.4 stable on Windows 11 25H2.
- SessionStore is unsupported internal behavior and must be source-inspected and
  rerun for each supported Firefox stable.
- A real old-to-new stable transition remains not run because no newer stable
  existed on 2026-08-16; issue #39 owns the release/update rehearsal.
- The rehearsal intentionally does not cover crash recovery, private-window
  persistence, form/session payloads, containers, extension state, or a future
  workspace model.
- Production Fennevia still delegates all session persistence and recovery to
  stock Firefox.
