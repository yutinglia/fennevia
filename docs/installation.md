# Installation and Package Lifecycle

This document is the normative Windows-first workflow for installing, updating,
repairing, hard-disabling, re-enabling, and removing Fennevia. Source-tree
development uses an unregistered marker-owned profile and copied Firefox
program. A versioned release uses an explicitly selected Firefox-registered
profile only after `-ProfileMode Registered` is supplied. Neither mode selects
a default profile or broad target, and a dedicated profile remains strongly
recommended.

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
    firefox/
      BridgeBoundary.sys.mjs
    runtime/
      HealthState.sys.mjs
      Logger.sys.mjs
      NativeUi.sys.mjs
      Runtime.sys.mjs
      WindowManager.sys.mjs
      WindowShell.sys.mjs
    shell/
      ShellApp.js
      ShellStyles.sys.mjs
      THIRD_PARTY_NOTICES.txt
```

The installer verifies the manifest schema, package identity, version, exact
profile artifact inventory, every source SHA-256, and the privileged-artifact
policy before planning a write. The policy implementation is loaded only from
`SecurityChecks.psm1` beside the already trusted installer module, never from
the package source being inspected. Paths outside the two approved program
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
      firefox/
        BridgeBoundary.sys.mjs
      runtime/
        HealthState.sys.mjs
        Logger.sys.mjs
        NativeUi.sys.mjs
        Runtime.sys.mjs
        WindowManager.sys.mjs
        WindowShell.sys.mjs
      shell/
        ShellApp.js
        ShellStyles.sys.mjs
        THIRD_PARTY_NOTICES.txt
  .fennevia/ownership.json
```

The two `ownership.json` files must be byte-identical. Neither parent root nor
the profile's general `chrome/` directory becomes Fennevia-owned.

A release adds a second, distribution-level inventory:

```text
fennevia-<VERSION>/
  RELEASE-MANIFEST.json
  package-manifest.json
  program/
  profile/
  scripts/fennevia-package.ps1
  scripts/verify-release.ps1
  scripts/lib/{FenneviaInstaller,FenneviaRelease,SecurityChecks}.psm1
  INSTALL.md
  LICENSE
  THIRD_PARTY_NOTICES.md
```

`RELEASE-MANIFEST.json` records the exact version, annotated tag, source commit
and source archive, archive/checksum names, package-manifest SHA-256, supported
platform and Firefox version/BuildID allowlist, compatibility evidence, known
limitations, and every other release file's size and SHA-256. It intentionally
does not contain a recursive self-hash. The release validator rejects an extra,
missing, renamed, reparse-point, changed, credential-like, high-confidence
secret-bearing, or local-machine-path-bearing file. The separately published
`.sha256` file authenticates the ZIP as a whole; verify it before trusting the
installer and validator code inside that ZIP.

## 2. Target and preflight rules

Close the selected Firefox instance, Browser Console, and Browser Toolbox before
applying changes. Every command requires both targets:

- `-FirefoxPath` must explicitly name an existing `firefox.exe` whose sibling
  `application.ini` identifies `Name=Firefox` and provides a version and build
  ID;
- the default `-ProfileMode Development` requires an unregistered profile with
  a valid `.fennevia-dev-profile.json` marker, or the exact profile already
  paired to a valid Fennevia ownership manifest;
- explicit `-ProfileMode Registered` requires `-ProfilePath` to match a path in
  Firefox's current `profiles.ini`/`installs.ini`, or to retain a valid Fennevia
  ownership pair from an earlier registered-mode installation;
- program and profile roots must be absolute, canonical, non-overlapping, and
  free of reparse-point ancestors;
- drive roots, user/home roots, AppData roots, Firefox profile collections,
  mode-inappropriate or unregistered profiles, missing targets, wildcards, and
  relative paths are rejected;
- an existing AutoConfig declaration, unknown same-name file, differing
  ownership pair, unexplained hash change, or interrupted transaction stops the
  action before managed-file mutation;
- an incomplete ownership pair blocks install, update, disable, and enable.
  Explicit `Repair` may reconstruct one completely absent side, while explicit
  `Uninstall` may remove only hash-verified content proven by one valid
  survivor, under the strict rules in section 4;
- when `RELEASE-MANIFEST.json` is present, `Install`, `Update`, `Repair`, and
  `Enable` require the selected Firefox version and BuildID to match an exact
  allowlist entry before mutation. `Enable` also requires the package-manifest
  hash recorded by ownership. `Disable` and `Uninstall` deliberately remain
  available on an unsupported updated Firefox for recovery.

The script proves that the selected executable is stock Firefox, but it cannot
infer whether that installation is disposable or writable. Development must
use the copied stock program and marker-owned profile procedure from
`docs/development-setup.md`. A release may target an explicitly selected normal
Firefox installation, but system-managed program files can require a separately
opened elevated PowerShell; the installer never elevates itself.

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

That command uses the Development default. From an extracted release, use the
same explicit targets and opt in to registered-profile handling:

```powershell
pwsh -NoProfile -File .\scripts\fennevia-package.ps1 Install `
  -FirefoxPath $firefox -ProfilePath $profile `
  -ProfileMode Registered -WhatIf
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
| `Repair` | Reconstruct one completely absent ownership side from one verified survivor and the exact recorded package source; never adopt partial residue or infer a new installation |
| `Disable` | Move only `defaults/pref/fennevia.js` to `fennevia.js.disabled`; it does not need a working manifest or runtime entry |
| `Enable` | Verify every owned file, exact recorded package source, release compatibility, and conflict check before moving the preference back into Firefox's active preference directory |
| `Uninstall` | Remove exact existing owned files and metadata, including from one valid surviving ownership record when its peer and metadata are wholly absent; tolerate already-missing owned files, reject changed present files, and remove only recorded project-created directories that are empty |

Examples use the same explicit targets:

```powershell
pwsh -NoProfile -File .\scripts\fennevia-package.ps1 Update `
  -FirefoxPath $firefox -ProfilePath $profile -WhatIf

pwsh -NoProfile -File .\scripts\fennevia-package.ps1 Repair `
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

If either ownership record is invalid or the pair differs, stop and investigate.
Do not copy one manifest over the other merely to make the installer proceed.

A valid one-sided ownership state has two explicit recovery exits. Use `Repair`
only when the exact recorded source is available and the missing side should be
reconstructed. Use `Uninstall` when the installation should be removed,
including when that old source is no longer available. Neither path permits
install, update, disable, or enable to infer a complete pair.

`Repair` is intentionally narrower than install or update:

- exactly one valid ownership record must survive; both absent is
  `FENNEVIA_INSTALL_NOT_INSTALLED` and requires a reviewed clean install;
- Development mode requires the selected profile to retain its valid project
  development marker. Registered mode requires current exact registration or
  the valid surviving ownership side, so a Firefox update that loses
  registration does not erase the only recovery proof;
- every survivor-side file and hash must match;
- the supplied package version, manifest hash, logical files, installed paths,
  enabled/disabled state, installation ID, and created-directory record must
  regenerate the survivor byte-for-byte;
- the missing metadata directory and every missing-side owned file must be
  entirely absent. A partial file set, alternate enabled/disabled preference,
  foreign AutoConfig declaration, retained profile package, or metadata residue
  is rejected rather than overwritten;
- any directory that must be recreated must already be proven as
  project-created by the survivor;
- preview operations are confined to the missing scope and report no backup for
  a clean reconstruction; execution uses the same dual-root transaction,
  digest confirmation, failure rollback, and residue checks as other actions.

A complete valid pair makes `Repair` an `already-complete` no-op. Use `Update`,
not `Repair`, for a newer package. If repair rejects source mismatch or residue,
preserve the state or preview survivor-based `Uninstall`.

One-sided `Uninstall` requires exactly one valid survivor, no metadata residue
on the missing side, and the normal mode-specific marker, registration, or
surviving-ownership proof. It validates every still-present file from both
scopes against that survivor, fails on any hash or path conflict, skips already
missing files, removes only ownership-listed bytes and the surviving ownership
record, and removes only recorded project-created directories that are empty.
It does not read `PackageRoot`, relax collision checks, synthesize the missing
manifest, or adopt unrelated content. If it rejects a changed file or metadata
residue, preserve the state and follow the incident procedure in
`docs/firefox-update-workflow.md`.

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
available when another owned package file is missing or the selected Firefox
build is newer than the release allowlist. Cold-start Firefox after disable and
confirm native Firefox starts with no Fennevia bootstrap record. Do not repair
or enable an old release on an unsupported Firefox build; leave it disabled or
absent until a compatible package exists.

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

The isolated filesystem suites exercise unsafe paths, collisions, dry-run,
idempotency, hard disable with a missing runtime entry, stale-file update,
one-sided program/profile repair, exact-source enforcement, residue rejection,
repair dry-run and failure rollback,
unrelated-file preservation, permission failure, interrupted-transaction
rejection, preview/execute plan mismatch, rollback, uninstall, redacted CLI
output, registered-profile opt-in, release-tree tampering, exact Firefox-build
rejection, and unsupported-build recovery in both supported PowerShell
runtimes:

```powershell
pwsh -NoProfile -File .\tests\installer.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\installer.Tests.ps1
pwsh -NoProfile -File .\tests\release-installer.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\release-installer.Tests.ps1
pwsh -NoProfile -File .\tests\release-packaging.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\release-packaging.Tests.ps1
```

The final real-Firefox release recovery check must consume the extracted
release rather than repository install bytes:

```powershell
pwsh -NoProfile -File .\tests\firefox-release-recovery.ps1 `
  -FirefoxPath '<COPIED_FIREFOX_PROGRAM>\firefox.exe' `
  -ProfilePath '<FENNEVIA_DEV_PROFILE>' `
  -PackageRoot '<EXTRACTED_RELEASE_ROOT>'
```

The current package is `0.10.0-beta.1` and contains 14 source-installed files:
two program files and 12 exact profile artifacts (the manifest, bootstrap, one
generated private bridge ESM, six runtime modules, and three generated shell
files). Each root also receives its byte-identical installer ownership record;
those metadata files are generated by the installer and are not package source
entries.
`.gitattributes` fixes AutoConfig/default/manifest files to CRLF and privileged
`.mjs`, `.js`, and notice files to LF so the committed SHA-256 values remain
stable on Windows and non-Windows checkouts. Do not recompute hashes from an
unintended line-end conversion; normalize the source according to that contract
first. Run `npm run build` before package preview whenever frontend/Firefox
source or build configuration changes; the command rebuilds the exact shell and
bridge directories and synchronizes package hashes.
Before a real install or update, also run the runtime/package gates:

```powershell
npm run test:powershell
npm run verify
pwsh -NoProfile -File .\scripts\check-production-artifacts.ps1 `
  -ArtifactRoot .\profile\chrome\fennevia `
  -InventoryPath .\package-manifest.json
```

Maintainers stage an ordinary release into a new empty directory:

```powershell
pwsh -NoProfile -File .\scripts\build-release.ps1 `
  -OutputDirectory .\.release
pwsh -NoProfile -File .\scripts\verify-release.ps1 `
  -PackageRoot .\.release\fennevia-0.10.0-beta.1
```

Publication requires the complete clean-tree preflight, which runs exact
dependency installation and `npm run verify`, builds twice, compares ZIP and
manifest bytes, validates the checksum, and extracts into a Unicode/space path:

```powershell
$output = Join-Path ([IO.Path]::GetTempPath()) "fennevia-release-preflight"
pwsh -NoProfile -File .\scripts\release-preflight.ps1 `
  -OutputDirectory $output `
  -ExpectedTag v0.10.0-beta.1 `
  -RequireAnnotatedTag
```

The output directory must be empty and the Git tree must be clean. The tag must
be an annotated tag resolving to `HEAD`. The tag-triggered GitHub workflow
repeats this preflight, creates a draft with only the ZIP and checksum, compares
GitHub's reported `sha256:` digests, then publishes and downloads the assets for
one final comparison. Draft discovery tolerates only a bounded release-list
visibility delay and still fails on duplicate matches or unexpected assets. A
manually dispatched rehearsal defaults to `publish=false`. If draft creation or
remote verification fails, inspect the still-draft release and explicitly
delete it before retrying; never silently reuse unknown assets.

Real-Firefox evidence must use the marker-owned profile and copied program,
include cold start after install and uninstall, and finish with no Fennevia files,
logs, or running test process. The current observed matrix is maintained in
`docs/testing-and-recovery.md` and
`docs/research/fennevia-installer-validation.md`.
