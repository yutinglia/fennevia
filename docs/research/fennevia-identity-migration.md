# Fennevia identity migration

## Record

- Date: 2026-08-15
- Issue: [#22](https://github.com/yutinglia/fennevia/issues/22)
- Decision: ADR-017 in `docs/architecture-decisions.md`
- Base commit: `06d00ff1f23b23a6f3c09667337119956ab912a7`
- Scope: project, package, bootstrap, development-profile, test, and documentation identity only

This record validates the migration from the provisional project identity to
**Fennevia**. It does not add installer behavior, runtime compatibility aliases,
or a new Firefox integration mechanism.

## Canonical identity

| Concern | Historical identifier | Current identifier |
|---|---|---|
| Project name | `My Firefox Shell` | `Fennevia` |
| Repository | `yutinglia/my-firefox-shell` | `yutinglia/fennevia` |
| Package slug | `my-firefox-shell` | `fennevia` |
| Chrome package | `chrome://my-firefox-shell/` | `chrome://fennevia/` |
| Reserved resource package | `resource://my-firefox-shell/` | `resource://fennevia/` |
| Safe-start preference | `myFirefoxShell.safeStart` | `fennevia.safeStart` |
| Structured log prefix | `[MFS bootstrap]` | `[Fennevia bootstrap]` |
| Error-code prefix | `MFS_` | `FENNEVIA_` |
| Development profile | `my-firefox-shell-dev` | `fennevia-dev` |
| Ownership marker | `.mfs-dev-profile.json` | `.fennevia-dev-profile.json` |
| DOM and CSS prefix | `data-mfs-*` / `mfs-*` | `data-fennevia-*` / `fennevia-*` |

The old literals remain only in explicitly labelled historical records and the
identity regression test. There is no dual registration, redirect, or alias.
The development helper does not adopt, mutate, or delete a profile or marker
owned by the provisional identity. That keeps the migration fail-closed and
avoids treating an unrelated or manually retained directory as project-owned.

## Implementation inventory

The active bootstrap layout is:

```text
spikes/bootstrap/program/
  defaults/pref/fennevia.js
  fennevia.cfg

spikes/bootstrap/profile/chrome/fennevia/
  chrome.manifest
  content/Bootstrap.sys.mjs
```

The manifest registers only:

```text
content fennevia content/
```

The reserved `resource://fennevia/` mapping remains omitted. No
`contentaccessible=yes`, Chrome Registry override, dependency, remote endpoint,
or runtime network behavior was introduced by this migration.

## Static validation

Both PowerShell 7 and Windows PowerShell 5.1 ran the project tests. JavaScript
syntax was checked with the repository's nvm-windows-managed Node.js runtime.

```powershell
pwsh -NoProfile -File .\tests\project-identity.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\project-identity.Tests.ps1
pwsh -NoProfile -File .\tests\bootstrap-spike.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\bootstrap-spike.Tests.ps1
pwsh -NoProfile -File .\tests\production-artifacts.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\production-artifacts.Tests.ps1
pwsh -NoProfile -File .\tests\firefox-dev-profile.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\firefox-dev-profile.Tests.ps1
Get-Content -Raw .\spikes\bootstrap\program\fennevia.cfg | node --check -
node --check .\spikes\bootstrap\profile\chrome\fennevia\content\Bootstrap.sys.mjs
node --check .\tests\bootstrap-content-access.mjs
```

The identity test rejects provisional literals in active tracked files, verifies
the canonical file layout and manifest, and requires the Fennevia Chrome URI,
safe-start preference, and log prefix. Historical exceptions are explicit and
small.

## Real-Firefox regression

The renamed artifacts were installed only into marker-owned test locations:

```text
<FENNEVIA_FIREFOX_PROGRAM_COPY>/
  defaults/pref/fennevia.js
  fennevia.cfg

<FENNEVIA_DEV_PROFILE>/chrome/fennevia/
  chrome.manifest
  content/Bootstrap.sys.mjs
```

Environment:

- Firefox 153.0.4 release
- Build ID `20260810162159`
- Source stamp `54be19de0e08edff0b797e55fd935dd3978b0a6d`
- Windows 11 25H2, build `26200.8894`
- Stock Firefox program copied into a project-owned test root
- Fresh marker-owned direct-path profile, not registered in `profiles.ini`
- Repository artifacts verified byte-for-byte against the installed copies

No system Firefox installation, registered profile, default profile, or daily-use
profile was modified.

| Case | Observed result |
|---|---|
| Three cold starts | Each process emitted exactly one `bootstrap.success`, code `FENNEVIA_BOOTSTRAP_READY`, with `initializationCount=1`; no fatal record |
| Browser Console | One privacy-safe Fennevia success record; no new causal exception observed |
| Ordinary HTTP content fetch | The loopback probe reported `blocked`; the privileged package remained inaccessible to ordinary content |
| Safe start | `fennevia.safeStart=true` emitted exactly one `bootstrap.skipped`, code `FENNEVIA_BOOTSTRAP_SAFE_START`, with no success or fatal record |
| Safe-start reset | Explicitly setting the preference false restored success; the original `user.js` was restored and no stale true value remained in `prefs.js` |
| Missing manifest | Exactly one fatal record at `manifest-locate` identified `FENNEVIA_BOOTSTRAP_MANIFEST_MISSING`; native Firefox UI remained present and usable |
| Recovery after missing manifest | Restoring the manifest produced success on the next cold start without clearing startup cache |
| Second normal window | One process initialization and three managed top-level windows, including two browser windows and Browser Console |
| Private window | One process initialization; the private browser window and Browser Console remained native and usable; the record contained no browsing-derived values |
| Complete removal | Removing only the Fennevia preference, cfg, and profile package produced a stock cold start with zero Fennevia records |
| Clean-environment verification | No AutoConfig declaration, enterprise policy, profile add-on, or unrelated chrome customization was detected |
| Process cleanup | Final launches exited gracefully and no Firefox process remained |

Startup cache was not cleared during these tests. Screenshots and raw local test
artifacts remain outside the repository because they contain machine-specific
paths and are not required runtime inputs.

The first automation attempt used forced process termination and incremented
Firefox's disposable-profile recent-crash counter, which opened a troubleshooting
prompt. The counter was reset only in that disposable profile, and all subsequent
GUI runs used Firefox's graceful `Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit)`
path. Final validation used the graceful path and ended in a clean, uninstalled
state. This was a test-harness correction, not a product failure.

## Security and privacy review

- The privileged mapping surface is unchanged: one non-content-accessible Chrome
  package and no resource alias.
- The migration adds no dependency, executable content, telemetry, URL handling,
  installer mutation, or network endpoint.
- Normal records retain path/URL redaction and contain no browsing URLs, titles,
  search text, profile paths, or private-window state.
- Old development roots are not automatically trusted or removed.
- Local evidence and recoverable test backups remain under marker-owned test
  roots and are not committed.

## Result

The code and documentation now use Fennevia as the sole active identity. The
bootstrap's fail-open behavior, safe start, ordinary-content isolation,
multi-window behavior, private-window native fallback, cleanup, and complete
project-file removal all remained intact after the rename.
