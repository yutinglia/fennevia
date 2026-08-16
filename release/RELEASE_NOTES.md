<!-- SPDX-License-Identifier: MPL-2.0 -->

This is Fennevia's first public prerelease package for Windows x64.

Validated compatibility is intentionally narrow: stock Firefox 153.0.4,
BuildID 20260810162159, release channel. Review `INSTALL.md` and
`RELEASE-MANIFEST.json` inside the archive before installation, use a dedicated
Firefox profile, and verify the separately published SHA-256 file.

In PowerShell, compare the first field of the downloaded `.sha256` file with:

```powershell
(Get-FileHash -Algorithm SHA256 .\fennevia-0.10.0-beta.1-windows.zip).Hash.ToLowerInvariant()
```

The annotated release tag identifies the corresponding source. The archive's
`RELEASE-MANIFEST.json` records the complete source commit and preferred-source
URL; `INSTALL.md` contains install, update, hard-disable, repair, enable,
uninstall, and Firefox-update recovery commands. This release adds packaging,
explicit registered-profile installer mode, and an exact Firefox compatibility
gate. It does not change native-UI hiding, resource mappings, or Firefox runtime
internals from the validated MVP baseline.

Fennevia relies on unsupported privileged Firefox internals and has not yet
completed an independent security audit. Linux, macOS, Firefox ESR, Beta, and
Nightly are not supported by this package.
