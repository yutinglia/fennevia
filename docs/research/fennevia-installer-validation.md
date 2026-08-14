# Fennevia package-lifecycle validation

## Environment

- Date: 2026-08-15
- Issue: [#4](https://github.com/yutinglia/fennevia/issues/4)
- Base commit: `d403857974266c1d85ef4ef21eb254d7b1835013` plus the #4 working tree
- Firefox: 153.0.4 release
- Firefox build ID: `20260810162159`
- Firefox source stamp: `54be19de0e08edff0b797e55fd935dd3978b0a6d`
- Operating system: Windows 11 25H2, build `26200.8894`
- PowerShell: PowerShell 7 and Windows PowerShell 5.1
- Program state: stock Firefox copied below a marker-owned Fennevia test root
- Profile state: marker-owned `fennevia-dev` direct-path profile, absent from
  Firefox's registered profile collection

All paths in this record are logical placeholders. The system Firefox
installation, registered profiles, default profile, and daily-use profiles were
not selected or modified.

## Scope

This validation covers the Windows-first package workflow introduced by #4:

- stable repository-root package layout and committed source hashes;
- explicit program/profile preflight and redacted dry run;
- deterministic install and byte-identical dual ownership;
- no-op install/update behavior;
- hard disable and enable;
- recovery when the installed runtime entry is missing;
- exact uninstall and stock cold-start recovery;
- transaction cleanup and evidence-first startup-cache policy.

Changing-package update, stale artifact removal, unsafe input, permission denial,
hash conflicts, and injected partial-failure rollback use isolated filesystem
fixtures so no real Firefox target is intentionally left in an old or partially
mutated package state.

## Package and ownership model

`package-manifest.json` listed four files and their committed SHA-256 values:

```text
program:defaults/pref/fennevia.js
program:fennevia.cfg
profile:chrome/fennevia/chrome.manifest
profile:chrome/fennevia/content/Bootstrap.sys.mjs
```

Install created matching `.fennevia/ownership.json` files below the selected
program and profile. The records were byte-identical, bound one installation
UUID and package version `0.1.0-dev`, and listed only scoped relative paths and
hashes. Every installed file matched the package manifest. No
`.fennevia-transaction-*` residue remained after any completed action.

## Static and transaction validation

Both supported PowerShell runtimes passed:

```powershell
pwsh -NoProfile -File .\tests\installer.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\installer.Tests.ps1
```

The suite covers:

- relative, root, home, AppData, registered-style, unmarked, wrong-Firefox,
  reparse-point, and manifest-traversal rejection;
- unknown same-name content and owned-hash conflict rejection;
- dry-run immutability and local-path redaction;
- preview/execute plan-digest mismatch rejection before transaction creation;
- deterministic and idempotent install, update, disable, and uninstall;
- identical ownership pairs and preservation of unrelated profile chrome files;
- changed/stale owned artifact update and missing-file uninstall;
- simulated transaction permission failure before managed-file mutation;
- rollback after an injected partial mutation, including exact tree restoration
  and transaction cleanup;
- rejection of interrupted-transaction residue;
- hard disable while the runtime entry is missing.

The bootstrap, production-artifact, development-profile, and identity suites
also passed in PowerShell 7 and Windows PowerShell 5.1. Node syntax checks passed
for the cfg body, privileged ESM, and ordinary-content probe.

## Real-Firefox lifecycle matrix

The initial clean-environment check found no AutoConfig declaration, enterprise
policy source, profile-installed add-on, or profile chrome customization.

| Case | Observed result |
|---|---|
| Install dry run | Listed 10 exact relative operations; before/after program and profile tree fingerprints were identical; `startupCacheAction=none` |
| Install | Applied the same 10 operations with the preview's matching `planSha256`; all source/installed hashes matched; ownership pair was byte-identical; no transaction residue |
| Repeated install | `already-installed`, zero planned or applied mutations |
| Three cold starts | Each process exposed one native Firefox window and exactly one `bootstrap.success`, code `FENNEVIA_BOOTSTRAP_READY`, `initializationCount=1`; zero Fennevia fatal records |
| Second normal window | Third cold start exposed two native browser windows plus Browser Console while retaining one process success and no duplicate record |
| Private window | One native private-browsing window plus Browser Console; one process success; zero Fennevia fatal, uncaught, or unhandled signal |
| Same-package update | `already-current`, zero planned or applied mutations |
| Hard disable | Moved only `defaults/pref/fennevia.js` to `.js.disabled` and replaced the paired ownership records; state became `disabled` |
| Disabled cold start | Native Firefox window present; zero Fennevia records, manifest errors, uncaught, or unhandled signal |
| Enable | Verified the owned package, moved the preference back, and replaced both ownership records; next cold start restored exactly one success |
| Broken runtime injection | Deleted only the installed `Bootstrap.sys.mjs` copy after verifying it matched reproducible repository source |
| Hard disable with missing entry | Completed without loading or validating the broken runtime; disabled ownership remained paired; no transaction residue |
| Broken-plus-disabled cold start | Native Firefox window present; zero Fennevia records, manifest errors, uncaught, or unhandled signal |
| Uninstall dry run | Listed 9 exact operations because the owned entry was already missing; before/after tree fingerprints were identical |
| Uninstall | Removed every remaining owned file and both metadata records; project package/transaction residue count was zero; development marker and non-project parents remained |
| Repeated uninstall | `not-installed`, zero planned or applied mutations |
| Final stock cold start | Native Firefox window present; zero Fennevia records, manifest errors, uncaught, or unhandled signal |
| Final clean verification | No AutoConfig declaration, enterprise policy, profile add-on, or chrome customization; no Firefox process remained |

After the plan-binding guard was added, one final no-GUI install/uninstall round
trip produced identical preview/result digests for each action and returned to
zero package, metadata, transaction, and process residue.

Browser Console also reported Firefox's pre-existing lookup of a missing Crash
Reports `submitted` directory (`NS_ERROR_FILE_NOT_FOUND`). It did not reference
Fennevia, was not uncaught or unhandled, and appeared in the stock/isolated
profile environment. No unrelated directory was created or changed to suppress
that baseline message.

Every GUI run exited through
`Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit)`. No forced process
termination was used, and no Firefox process remained after each lifecycle
boundary.

## Startup-cache result

Startup cache was never cleared. Disable, enable, missing-entry hard disable,
complete uninstall, and final stock startup all took effect on the immediately
following cold start. The installer therefore reports
`startupCacheAction=none`; cache clearing remains an explicit escalation only
for a future observed stale-code symptom.

## Security and privacy effects

- Normal CLI and shared evidence used `<FIREFOX_PROGRAM>` and
  `<FENNEVIA_PROFILE>` placeholders; no absolute profile or user path is stored
  in package metadata or this record.
- The installer made no network request, selected no default profile, and did
  not register or alter `profiles.ini`.
- Recursive deletion was limited to exact marker-owned transaction roots after
  reparse validation. Installed package and metadata directories were removed
  only when empty.
- The profile's development ownership marker and non-project parent structure
  remained intact.
- No Chrome mapping, runtime dependency, content-accessible surface, or Firefox
  security prompt changed.

## Result

The #4 lifecycle is deterministic and fail-closed for the tested Windows
development boundary. It can install, identify, hard-disable, recover, and remove
the Phase 1 package without relying on a working runtime, selecting a daily-use
profile, clearing startup cache, or leaving project residue. Future end-user or
system-install support remains outside this validation.
