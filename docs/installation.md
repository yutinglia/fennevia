# Installation and Package Lifecycle

This document is the normative Windows-first workflow for installing, updating,
hard-disabling, re-enabling, and removing the current Fennevia development
package. It is not an end-user release installer. The supported target for the
current milestone is an explicitly selected stock Firefox program and an
unregistered, marker-owned Fennevia development profile. The validated workflow
uses a copied Firefox program so daily-use installations remain untouched.

## 1. Source of truth

`package-manifest.json` is the only install inventory. Every entry combines its
`scope` and normalized relative `path` to identify a committed source file:

```text
package-manifest.json
program/
  defaults/pref/fennevia.js
  fennevia.cfg
profile/chrome/fennevia/
  chrome.manifest
  content/
    Bootstrap.sys.mjs
    runtime/
      HealthState.sys.mjs
      Logger.sys.mjs
      Runtime.sys.mjs
      WindowManager.sys.mjs
      WindowShell.sys.mjs
```

The installer verifies the manifest schema, package identity, version, exact
profile artifact inventory, every source SHA-256, and the privileged-artifact
policy before planning a write. The policy implementation is loaded only from
`SecurityChecks.psm1` beside the already trusted installer module, never from
the package source being inspected. Paths outside the three approved program
files and `profile/chrome/fennevia/` are rejected. Generated build output may be
added only by updating this manifest and the production-artifact gate; `dist/`
is never edited or adopted by the installer.

The installed layout is:

```text
<FIREFOX_PROGRAM>/
  defaults/pref/fennevia.js        # renamed to .js.disabled when hard-disabled
  fennevia.cfg
  .fennevia/ownership.json

<FENNEVIA_PROFILE>/
  chrome/fennevia/
    chrome.manifest
    content/
      Bootstrap.sys.mjs
      runtime/
        HealthState.sys.mjs
        Logger.sys.mjs
        Runtime.sys.mjs
        WindowManager.sys.mjs
        WindowShell.sys.mjs
  .fennevia/ownership.json
```

The two `ownership.json` files must be byte-identical. Neither parent root nor
the profile's general `chrome/` directory becomes Fennevia-owned.

## 2. Target and preflight rules

Close the selected Firefox instance, Browser Console, and Browser Toolbox before
applying changes. Every command requires both targets:

- `-FirefoxPath` must explicitly name an existing `firefox.exe` whose sibling
  `application.ini` identifies `Name=Firefox` and provides a build ID;
- `-ProfilePath` must explicitly name an existing unregistered profile with a
  valid `.fennevia-dev-profile.json` marker, or the exact profile already paired
  to a valid Fennevia ownership manifest;
- program and profile roots must be absolute, canonical, non-overlapping, and
  free of reparse-point ancestors;
- drive roots, user/home roots, AppData roots, Firefox profile collections,
  registered profiles, missing targets, wildcards, and relative paths are
  rejected;
- an existing AutoConfig declaration, unknown same-name file, incomplete or
  differing ownership pair, unexplained hash change, or interrupted transaction
  stops the action before managed-file mutation.

The script proves that the selected executable is Firefox, but it cannot infer
whether that installation is disposable. During this development stage, do not
point it at a daily-use or system-managed Firefox installation. Use the copied
stock program and marker-owned profile procedure from `docs/development-setup.md`.

Normal output always substitutes `<FIREFOX_PROGRAM>` and `<FENNEVIA_PROFILE>`.
It does not enumerate unrelated profile files or print absolute paths.

## 3. Preview and execute

Set the two variables locally; do not paste their values into an issue or pull
request:

```powershell
$firefox = '<FIREFOX_PROGRAM>\firefox.exe'
$profile = '<FENNEVIA_PROFILE>'
```

Always preview the exact relative operation list first:

```powershell
pwsh -NoProfile -File .\scripts\fennevia-package.ps1 Install `
  -FirefoxPath $firefox -ProfilePath $profile -WhatIf
```

Then run the same command without `-WhatIf`. The CLI displays the dry-run plan
again before asking for confirmation:

```powershell
pwsh -NoProfile -File .\scripts\fennevia-package.ps1 Install `
  -FirefoxPath $firefox -ProfilePath $profile
```

`-AcceptPlan` is intended only for an already-reviewed scripted invocation,
including isolated validation. It suppresses the interactive prompt after the
preview but does not bypass plan-digest, target, ownership, hash, process,
transaction, or rollback checks.

Available actions are:

| Action | Contract |
| --- | --- |
| `Install` | Create the exact package and identical ownership pair; repeat is a no-op when source and installed state match |
| `Update` | Replace or remove only previously owned files, add exact new manifest entries, preserve enabled/disabled state, and update both ownership records |
| `Disable` | Move only `defaults/pref/fennevia.js` to `fennevia.js.disabled`; it does not need a working manifest or runtime entry |
| `Enable` | Verify every owned file and conflict check before moving the preference back into Firefox's active preference directory |
| `Uninstall` | Remove exact existing owned files and metadata, tolerate already-missing owned files, and remove only recorded project-created directories that are empty |

Examples use the same explicit targets:

```powershell
pwsh -NoProfile -File .\scripts\fennevia-package.ps1 Update `
  -FirefoxPath $firefox -ProfilePath $profile -WhatIf

pwsh -NoProfile -File .\scripts\fennevia-package.ps1 Disable `
  -FirefoxPath $firefox -ProfilePath $profile

pwsh -NoProfile -File .\scripts\fennevia-package.ps1 Enable `
  -FirefoxPath $firefox -ProfilePath $profile

pwsh -NoProfile -File .\scripts\fennevia-package.ps1 Uninstall `
  -FirefoxPath $firefox -ProfilePath $profile -WhatIf
```

A plan reports every `CreateDirectory`, `CreateFile`, `ReplaceFile`,
`RemoveFile`, `MoveFile`, and `RemoveDirectoryIfEmpty` operation as a scoped
relative path, every ownership-proven file that will be backed up, and a
deterministic `planSha256`. Transaction-internal stage paths remain represented
by logical backup entries rather than absolute temporary names. Before mutation,
the CLI replans and requires that digest to match the displayed preview; target
or package changes require a new confirmation. `plannedMutationCount=0` means
the requested state already exists. `startupCacheAction=none` is deliberate;
see section 7.

## 4. Ownership and conflicts

The versioned ownership record contains only:

- schema and package identity;
- one installation UUID and package version;
- `enabled` or `disabled` state;
- source-manifest SHA-256;
- exact logical and installed relative paths with SHA-256 values;
- profile-package directories that this installation actually created.

An update or enable requires every present owned file to match its recorded
hash. Uninstall permits a recorded file to be missing so recovery still works
after a broken or manually removed runtime entry, but it refuses to delete a
present file whose hash changed. Unknown content is never adopted, overwritten,
or recursively removed.

If either ownership record is missing, invalid, or differs from the other, stop
and investigate. Do not copy one manifest over the other merely to make the
installer proceed; first compare the installed files and determine which state
is genuine.

## 5. Transaction and rollback model

For a non-empty action, the installer:

1. confirms the selected Firefox program/profile are not running;
2. creates one same-volume sibling `.fennevia-transaction-<UUID>` directory in
   each selected root;
3. writes a transaction ownership marker;
4. stages every new byte sequence and verifies its expected SHA-256;
5. backs up only existing, ownership-proven files and verifies each backup;
6. writes `journal.json` with scoped relative paths, old/new hashes, backup
   names, and pre-transaction existence state;
7. rechecks old hashes and reparse-point ancestors immediately before mutation;
8. applies the displayed operations, using same-volume file replacement where
   available, then verifies committed hashes;
9. removes both marker-owned transaction directories after success.

Any caught failure stops later operations and restores the snapshots. A tested
rollback removes files created by the failed action, restores replaced or moved
owned files, recreates prior directories when needed, and removes newly created
directories only when empty. Recursive deletion is used only for the exact
randomly named transaction root after its marker and complete no-reparse tree
are validated.

## 6. Interrupted-operation recovery

Any `.fennevia-transaction-*` entry blocks every later package action, including
dry run. This is intentional: a power loss or terminated PowerShell process may
have interrupted the transaction outside the normal catch/rollback path.

Do not launch Firefox and do not delete the transaction directory immediately.
For each selected root:

1. preserve a local copy of the transaction directory;
2. verify `transaction.json` and `journal.json` have the same transaction UUID,
   expected scope, schema `1`, and owner `fennevia-installer-transaction`;
3. use only journal-relative paths beneath that journal's selected root;
4. for each file whose `existed` value is `true`, verify the backup SHA-256 and
   restore that backup to the recorded path;
5. for each file whose `existed` value is `false`, remove a current file only if
   its hash matches the corresponding create or move operation's expected hash;
   stop on any mismatch or non-file entry;
6. recreate a directory recorded as previously existing; remove a directory
   recorded as new only if it is empty;
7. compare the two installed ownership records and all listed file hashes;
8. only after recovery is proven, validate that the transaction tree has no
   reparse points and remove that exact marker-owned transaction directory.

If the journal or marker is absent, malformed, mismatched, or insufficient to
prove an exact target, leave the files in place and report the stable error code
plus redacted operation list in issue #4. Never recursively delete a Firefox
program root, profile root, general `chrome/` directory, or guessed parent as a
recovery shortcut.

## 7. Hard disable, uninstall, and startup cache

`Disable` is the first recovery action when the installed runtime or manifest is
broken. It deactivates AutoConfig before that runtime can load and remains
available when another owned package file is missing. Cold-start Firefox after
disable and confirm native Firefox starts with no Fennevia bootstrap record.

`Uninstall` then removes the exact ownership-listed files that still exist. It
leaves unrelated files below the profile's `chrome/` directory untouched. A
second uninstall is a no-op only when no Fennevia-named residue remains.

The installer never clears Firefox startup cache automatically. Firefox 153.0.4
accepted corrected and removed bootstrap files on the next cold start in Phase
1 without cache clearing. Use this order:

1. close all processes using the selected profile;
2. verify installed files, package state, and ownership records;
3. hard-disable or uninstall and cold-start again;
4. only if a specific stale-code symptom remains, use Firefox's **Clear startup
   cache** action in `about:support` and record before/after evidence.

Do not manually delete arbitrary Firefox cache directories.

## 8. Verification commands

The isolated filesystem suite exercises unsafe paths, collisions, dry-run,
idempotency, hard disable with a missing runtime entry, stale-file update,
unrelated-file preservation, permission failure, interrupted-transaction
rejection, preview/execute plan mismatch, rollback, uninstall, and redacted CLI
output in both supported PowerShell runtimes:

```powershell
pwsh -NoProfile -File .\tests\installer.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\installer.Tests.ps1
```

The current package is `0.6.0-dev` and contains eleven exact profile artifacts:
the manifest, bootstrap, one generated private bridge ESM, five runtime
modules, and three generated shell files.
`.gitattributes` fixes AutoConfig/default/manifest files to CRLF and privileged
`.mjs`, `.js`, and notice files to LF so the committed SHA-256 values remain
stable on Windows and non-Windows checkouts. Do not recompute hashes from an
unintended line-end conversion; normalize the source according to that contract
first. Run `npm run build` before package preview whenever frontend/Firefox
source or build configuration changes; the command rebuilds the exact shell and
bridge directories and synchronizes package hashes.
Before a real install or update, also run the runtime/package gates:

```powershell
pwsh -NoProfile -File .\tests\bootstrap-spike.Tests.ps1
pwsh -NoProfile -File .\tests\window-lifecycle.Tests.ps1
pwsh -NoProfile -File .\tests\shell-hosts.Tests.ps1
pwsh -NoProfile -File .\tests\shell-health.Tests.ps1
npm run verify
pwsh -NoProfile -File .\scripts\check-production-artifacts.ps1 `
  -ArtifactRoot .\profile\chrome\fennevia `
  -InventoryPath .\package-manifest.json
```

Real-Firefox evidence must use the marker-owned profile and copied program,
include cold start after install and uninstall, and finish with no Fennevia files,
logs, or running test process. The current observed matrix is maintained in
`docs/testing-and-recovery.md` and
`docs/research/fennevia-installer-validation.md`.
