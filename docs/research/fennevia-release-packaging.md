# Fennevia 0.10.0-beta.1 release packaging and distribution record

## 1. Scope and status

- Issue: #39
- Decision: ADR-036
- First version: `0.10.0-beta.1`
- Base commit inspected: `2e0c57c00d7518616c7f8adb33d95b4ed08e2cfb`
- Implementation branch: `codex/issue-39-release-packaging`
- Operating system: Windows 11 x64
- Package compatibility target: stock Firefox 153.0.4 release, BuildID
  `20260810162159`
- Profile policy: copied marker-owned development profile for real validation;
  explicit Firefox-registered profile mode for ordinary release installation
- Status: implementation and isolated validation complete; exact tagged
  publication evidence is appended only after the merged commit is tagged and
  the public assets are downloaded and reverified

This record covers deterministic distribution and installer policy. It adds no
Firefox runtime symbol, bridge data flow, resource mapping, native-DOM access,
dependency, telemetry, updater, or browser-content exposure.

## 2. Primary sources checked

Retrieved 2026-08-16:

- Semantic Versioning 2.0.0 prerelease grammar:
  <https://semver.org/spec/v2.0.0.html>
- GitHub Actions tag filters, manual inputs, job permissions, and least-
  privilege workflow syntax:
  <https://docs.github.com/actions/reference/workflows-and-actions/workflow-syntax>
- GitHub `GITHUB_TOKEN` permission control:
  <https://docs.github.com/actions/security-for-github-actions/security-guides/automatic-token-authentication>
- GitHub REST release-asset response, including the `digest` field:
  <https://docs.github.com/rest/releases/assets>
- GitHub CLI `gh release create`, including draft, prerelease, notes-file, and
  `--verify-tag` behavior:
  <https://cli.github.com/manual/gh_release_create>
- GitHub REST release listing and update-by-ID behavior:
  <https://docs.github.com/rest/releases/releases>
- Microsoft `System.IO.Compression.ZipArchive` documentation:
  <https://learn.microsoft.com/dotnet/api/system.io.compression.ziparchive>

The current repository action pins were retained: `actions/checkout` v7.0.1 at
`3d3c42e5aac5ba805825da76410c181273ba90b1` and `actions/setup-node` v7.0.0 at
`820762786026740c76f36085b0efc47a31fe5020`. No upload/download action or new
runtime/build dependency was introduced. GitHub CLI is supplied by the hosted
runner image and is used only by the publication job.

## 3. Selected contract

`package.json` is canonical. A publishable version is stable SemVer or one of
`alpha.N`, `beta.N`, and `rc.N`; `-dev`, build metadata, leading-zero numeric
identifiers, and a mismatched tag are rejected. The tag is annotated
`v<VERSION>` and resolves to the complete source commit embedded in the release
manifest.

The first archive is `fennevia-0.10.0-beta.1-windows.zip`. It contains one
`fennevia-0.10.0-beta.1/` root and 24 files:

- 14 exact install files already owned by `package-manifest.json`;
- `package-manifest.json`;
- installer, release validator, privileged-artifact scanner, and extracted-
  tree verification wrapper;
- release-specific `INSTALL.md`;
- `LICENSE` and `THIRD_PARTY_NOTICES.md`;
- generated `RELEASE-MANIFEST.json`.

The generated manifest excludes itself from its `files` array and records every
other file's normalized path, byte size, and SHA-256. ZIP entries are sorted,
uncompressed, use no explicit directory entries, and carry the fixed
1980-01-01 timestamp. The checksum file contains one lowercase SHA-256 and the
exact archive name.

## 4. Installer and compatibility findings

The source installer keeps `Development` as its backward-compatible default.
`Registered` must be explicit and checks only the supplied profile path against
Firefox's `profiles.ini`/`installs.ini`; it never scans for or chooses a target
on the operator's behalf. A valid existing ownership pair remains proof for
cleanup, and a valid surviving side remains proof for one-sided Registered-mode
repair after registration is lost. A valid survivor also permits narrow
package-independent Uninstall when peer metadata is wholly absent and every
still-present owned file matches; this recovery path was added after exact
preflight exposed an older marker-owned test installation whose original dirty
source package no longer existed. Development-mode repair retains ADR-033's
marker requirement.

If `RELEASE-MANIFEST.json` is present, the installer validates the complete
release tree before planning. Install, Update, Repair, and Enable then require
an exact version/BuildID allowlist match. Enable additionally requires the
package-manifest SHA-256 recorded in ownership. Disable and Uninstall do not
load compatibility policy and remain available after an unsupported Firefox
update. This prevents both executing an unreviewed old package on new Firefox
and trapping its AutoConfig activation in place.

The first allowlist contains only Firefox 153.0.4 release BuildID
`20260810162159`, tied to
`docs/research/firefox-153-mvp-hardening-update-rehearsal.md`. Linux, macOS,
ESR, Beta, Nightly, and other builds are rejected rather than inferred.

## 5. Security, privacy, and provenance review

- The release tree is a strict allowlist; extra, missing, renamed, changed, or
  reparse-point files fail validation.
- A second scanner rejects credential-like filenames, high-confidence private
  key/token patterns, and local `C:\Users\...`/`C:\works\...` paths. The
  existing privileged production-artifact scanner still checks the installed
  runtime for endpoints, networking APIs, HMR, dynamic/bare imports, source
  maps, development files, and binaries.
- Normal build, verification, and installer output reports logical names,
  counts, versions, and hashes only. It does not print selected Firefox/profile
  paths or browse their unrelated contents.
- The GitHub workflow defaults to repository read permission. Only the gated
  publication job receives `contents: write`.
- Publication first creates a draft with exactly two assets, compares both
  GitHub-reported `sha256:` digests to local staged bytes, then publishes the
  verified numeric release ID and downloads both assets for a final hash
  comparison. Draft discovery uses the authenticated release list rather than
  get-by-tag.
- The archive carries MPL-2.0 and the complete root third-party notice. No
  external implementation, script, template, or release action was copied or
  added; no notice or dependency graph change was required.
- Signing, attestations, an SBOM, automatic update, stable support, and an
  independent security audit are explicit non-goals for this first prerelease.

## 6. Isolated validation

The following must pass on the final implementation commit in both PowerShell 7
and Windows PowerShell 5.1:

```powershell
pwsh -NoProfile -File .\tests\release-packaging.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\tests\release-packaging.Tests.ps1
pwsh -NoProfile -File .\tests\release-installer.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\tests\release-installer.Tests.ps1
npm run verify
```

Observed release-specific coverage:

- two independently staged ZIPs are byte-identical;
- manifest bytes are identical;
- entries are sorted beneath one versioned root, omit directory entries, and
  use the fixed timestamp;
- checksum content and archive digest agree;
- exact extraction under a Unicode/space path passes strict validation;
- changed release bytes and non-empty output directories fail closed;
- registered-profile mode is explicit in module and CLI plans;
- an unregistered profile and a listed version with the wrong BuildID fail
  before mutation;
- unsupported Firefox blocks Enable while preserving hard-disabled state;
- Disable and Uninstall remain usable on that unsupported build;
- one-sided repair succeeds from surviving ownership after registration loss;
- one-sided Uninstall succeeds without the old package, preserves unrelated
  profile content, and rejects a modified surviving owned file;
- a changed staged release file is rejected before installation.

There is no earlier Fennevia release artifact, so an N-to-N+1 release fixture is
not available for this first prerelease. The existing installer suite retains
its independent `1.0.0` to `2.0.0` exact-source/stale-file update fixture, and
the release suite verifies that Update from the same extracted release is a
no-op. The first real cross-release upgrade remains evidence for the next
version rather than a fabricated historical artifact.

## 7. Real staged-package and publication evidence

Before tagging, validate the exact extracted ZIP against the retained copied
Firefox/profile environment: install, repeated no-op, cold start, hard disable,
native-only cold start, one-sided repair or update, enable, recovery failure
injection, uninstall, stock cold start, no Browser Console regression, and no
owned/transaction residue. Do not substitute source-tree installation for this
test.

The reusable real recovery command is `tests/firefox-release-recovery.ps1`.
It accepts only the marker-owned managed profile and copied-program roots,
validates the extracted release and dual ownership pair, verifies the exact
bundle hash before failure injection, and restores exact bytes/enabled state in
`finally`.

After merge, append or link a follow-up evidence change containing:

- merged/tagged source commit and annotated tag object proof;
- clean preflight command/result and deterministic ZIP SHA-256;
- GitHub Actions run URL and all job results;
- release URL, exact two asset names/sizes/digests, and downloaded checksum
  verification;
- final real-Firefox cleanup state;
- any failed draft/retry evidence or `none`.

Until those values exist, they are intentionally not guessed in this record.

### First publication attempt (private draft retained)

Tag-triggered run `31926297782` on merged commit
`a16a99777e1dcac9c8f8e183301ca6fdb460cf2b` passed both independent release
preflights. It then created private draft release ID `371229727` with exactly:

- `fennevia-0.10.0-beta.1-windows.zip`, 593093 bytes, GitHub digest
  `sha256:0119fb648cc0f586af38b0dfc901caa0671178a942f1b2ab568d1bae21db2092`;
- `fennevia-0.10.0-beta.1-windows.zip.sha256`, 101 bytes, GitHub digest
  `sha256:5781e486a558ea22c3603fc4c0e36b53a19c029f1d5fe3f94d8bd1f0c9a2d38f`.

GitHub's get-a-release-by-tag endpoint returned 404 for that private draft, so
the workflow could not retrieve its asset collection and stopped before
publication. No public release was created. The corrected workflow enumerates
authenticated releases, refuses an existing matching draft, uniquely selects
the new draft by tag, validates its two assets, and publishes only its numeric
release ID. The retained failed draft must be deleted explicitly after this fix
is merged and before an authorized manual retry from the unchanged annotated
tag.
