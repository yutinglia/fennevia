<!-- SPDX-License-Identifier: MPL-2.0 -->

# Install and recover a Fennevia Windows release

This archive contains a prebuilt Fennevia package. Ordinary installation does
not require Node.js or npm. Fennevia runs privileged code and relies on Firefox
internals. It has been tested only with Firefox 153 and 154. Later Firefox
versions may break the shell. If you confirm install on a newer version, there
is no promise that everything will work. Keep this archive for later recovery.

## Before installation

1. Download both the Windows ZIP and its `.sha256` file from the same GitHub
   Release.
2. In PowerShell, verify the archive before extracting it:

   ```powershell
   $expected = (Get-Content -Raw .\fennevia-<VERSION>-windows.zip.sha256).Split()[0]
   $actual = (Get-FileHash -Algorithm SHA256 .\fennevia-<VERSION>-windows.zip).Hash.ToLowerInvariant()
   if ($actual -cne $expected) { throw "Fennevia release checksum mismatch." }
   ```

3. Extract the ZIP to a local directory. Review `RELEASE-MANIFEST.json`, this
   file, `LICENSE`, and `THIRD_PARTY_NOTICES.md`.
4. Close every Firefox, Browser Console, and Browser Toolbox process using the
   selected program or profile.
5. Explicitly identify `firefox.exe` and one Firefox profile. Fennevia never
   selects a default. A dedicated profile created through `about:profiles` is
   strongly recommended. The profile must be listed in Firefox's
   `profiles.ini`; do not pass the profile collection directory itself.
6. The selected Firefox program directory must be writable, or you must approve
   an administrator prompt from Fennevia Setup. The transaction engine never
   elevates itself. The GUI asks for administrator permission only after you
   click **Continue as administrator**.

Keep path values local. Do not paste them into issues or logs:

```powershell
$firefox = '<FIREFOX_PROGRAM>\firefox.exe'
$profile = '<FIREFOX_PROFILE>'
```

## Preview, install, and update

The recommended interactive entry is `FenneviaSetup.exe` in this directory.
Select `firefox.exe` and one registered profile **by name**, acknowledge the
Firefox 153/154 testing warning, then confirm the redacted plan. If the program
folder is not writable, choose **Continue as administrator**.

The PowerShell console remains available:

```powershell
pwsh -NoProfile -File .\scripts\fennevia.ps1
```

The console lists local Firefox builds and registered profile **names**, never
preselects Firefox's default profile, shows the Firefox 153/154 testing
warning, shows the redacted plan, and applies only after both confirmations.
The interactive host redraws in place and accepts
mouse clicks; it does not require Node.js. If stdin is redirected,
use the scripted commands below.

Always preview the complete relative-path plan first:

```powershell
pwsh -NoProfile -File .\scripts\fennevia-package.ps1 Install `
  -FirefoxPath $firefox -ProfilePath $profile `
  -ProfileMode Registered -WhatIf
```

After reviewing the plan, repeat without `-WhatIf` and approve the displayed
mutation. `-AcceptPlan` is only for an already reviewed scripted invocation; it
does not bypass path, ownership, hash, compatibility, transaction, or rollback
checks.

To move from an earlier installed release to this extracted release, retain the
same explicit targets and preview `Update`:

```powershell
pwsh -NoProfile -File .\scripts\fennevia-package.ps1 Update `
  -FirefoxPath $firefox -ProfilePath $profile `
  -ProfileMode Registered -WhatIf
```

An update refuses modified owned files, a mismatched ownership pair, Firefox
older than the tested baseline, or a release tree whose recorded bytes changed.

## Hard disable, repair, enable, and uninstall

Hard-disable Fennevia before investigating a broken runtime or Firefox update:

```powershell
pwsh -NoProfile -File .\scripts\fennevia-package.ps1 Disable `
  -FirefoxPath $firefox -ProfilePath $profile `
  -ProfileMode Registered -WhatIf
```

Then apply the reviewed `Disable` plan and cold-start Firefox. Disable only
moves the ownership-proven AutoConfig preference and does not need a functioning
Fennevia bundle.

If Firefox removed one complete side of an otherwise valid installation, the
exact original release may preview `Repair`. Repair never adopts partial
residue, a different release, or modified files. Repair and enable reject
Firefox older than 153. Firefox 153, 154, and newer majors may proceed after
the testing warning; confirming that warning is not a support promise.

If exactly one valid ownership record survives but the exact old release is no
longer available, preview `Uninstall` instead. It does not read package bytes:
it verifies every still-present ownership-listed file, rejects modified files
or missing-side metadata residue, and removes only those proven bytes, the
surviving ownership record, and recorded empty directories.

After a verified repair or update, preview and apply `Enable`. Enable requires
the exact package source recorded by ownership and rechecks Firefox
compatibility.

To remove Fennevia, preview and apply `Uninstall` with the same explicit targets.
Uninstall removes only ownership-listed files and empty project-created
directories; unrelated profile `chrome` content remains untouched. A valid
single surviving ownership record remains sufficient for this narrow cleanup.

## Interrupted operation and emergency fallback

An unexpected `.fennevia-transaction-*` directory blocks every later action.
Do not delete it blindly or launch the selected Firefox. Preserve it and follow
the relative-path journal recovery procedure in the source documentation at
`docs/installation.md` for this release tag.

If Firefox is already running and the custom shell is unhealthy, press
`Ctrl+Alt+Shift+F12` to request the Svelte-independent native-UI fallback. If
that is unavailable, close Firefox and use the installer `Disable` action.

The installer never clears startup cache automatically. Only use Firefox's
**Clear startup cache** action after verified installed bytes and a reproduced
stale-code symptom.

## Source and notices

`RELEASE-MANIFEST.json` records the exact source repository, annotated tag,
commit, package-manifest digest, complete release-file digests, supported
platform scope, Firefox build, compatibility evidence, and known limitations.
The corresponding preferred source is available from the tag archive named in
that manifest. Fennevia is MPL-2.0; bundled third-party material keeps the terms
and notices identified in `THIRD_PARTY_NOTICES.md` and the installed runtime
notice.
