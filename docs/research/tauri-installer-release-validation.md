<!-- SPDX-License-Identifier: MPL-2.0 -->
# Native installer integration validation — 2026-11-09

Scope: the owner's request to finish the Tauri installer, retain independent
PowerShell backup, add scanned/saved locations to that backup, update Markdown,
and commit/push to main after checks. This is an unreleased source integration,
not a release tag/publication or a new Firefox compatibility claim.

Baseline: `5ad1eccf84ede8e5776ff1bcb27140079f5ce032`, with the implementation
working tree layered above it. Environment: Windows x64, Node 24.18.0/npm
11.16.0, Rust 1.99.1/MSVC, PowerShell 7 and Windows PowerShell 5.1.
Initial read-only and development transaction records remain unchanged.

## Implemented contract comparison (P0)

| Contract | PowerShell boundary | Native boundary and evidence |
| --- | --- | --- |
| Explicit roots, no broad/overlapping/reparse targets | installer Paths/Targets | core paths; Windows held handles and final paths; traversal/overlap/hardlink tests |
| Firefox/profile proof and default consent | Discovery/Targets/Support | registry/INI discovery, registered or ownership/marker proof; x64 PE/release channel/153+ checks; unsupported architecture/channel/version tests |
| Package source and exact hashes | Manifest + SecurityChecks + FenneviaRelease | core package/release/distribution; closed schemas, metadata, exact files/hash/size, artifact policy; tamper/unknown/extra tests |
| Ownership-paired lifecycle | Ownership/Planning | core ownership/planning; common fixtures, six actions, missing-side recovery, unrelated-file preservation |
| Same writer lock and stale-plan rejection | Public named mutex + expected digest | sorted target mutexes, file identities, fresh rebuild, single-use consent, expiry and replay rejection |
| Atomic writes/undo and unknown outcome | Transaction journals | held-parent rename, private per-root staging, backup/journal, reverse undo, durable result receipt before ACK; failure injection and lost-ACK tests |
| Saved local pairs | FenneviaLocations + ConsoleLocations | native preferences; identical schema/ACL/user mutex/revision CAS, restart, clear/forget, corrupt/stale/duplicate cases in PS 5.1/7 |
| Privilege and runtime separation | Manual console/legacy GUI retain their own flow | unelevated GUI; pinned worker, nonce/SID/PID/image pipe, no GUI PowerShell invocation; actual non-mutating IPC smoke |

The release container permits Microsoft's exact `WebView2/Trust Protection
Lists/` directory spelling only alongside the pinned inventory. Installed
Firefox/ownership paths retain their stricter grammar. A regression checks all
pinned runtime paths and rejects traversal, reserved names and other spaces.

Update restores individual missing owned files. Repair deliberately reconstructs
one completely missing owned side from its valid survivor and exact source.
The full-copy test initially attempted Repair for one missing file and correctly
received Missing; the harness now tests the actual two distinct contracts.
No production recovery rule was loosened to make the harness pass.

## Automated checks

- Root `npm run verify`: passed (492 unit tests, coverage floors, PS 7 static
  suites, dependency inventory, deterministic frontend/bridge and 14 artifacts).
- Windows PowerShell 5.1 `tests/run-static-powershell-tests.ps1`: passed.
  Clear PSModulePath of PS 7 modules before launching this runtime.
- Installer `npm run verify`: passed (format, lint, Svelte/TypeScript, two
  async-request regression tests, npm audit threshold, embedded frontend build).
- Rust fmt and workspace/all-target clippy: passed. The final workspace run
  passed all 42 native tests, including runtime paths/progress. Normalized
  checkout fixtures also passed the 12 cross-engine contracts again.
  No coverage-padding tests were added.
- Native release build with fixed WebView2: built. Hidden frontend-ready IPC and
  authenticated worker rejection of nonexistent targets passed on the extracted
  native distribution. This is actual native execution, not browser emulation.
- Two independent Cargo target builds produced byte-identical native inventories.
  Release preflight additionally now rebuilds from a second archived source path.
  The final source-path/ZIP preflight passed as recorded below.
- Cargo audit 0.22.2: no vulnerabilities; two informational non-Windows dependency
  warnings. npm audit: two low affected entries for the existing build-only
  deepmerge issue. Exact scope and limitations are in the dependency review.
- MSVC `dumpbin /dependents`: Windows system/UCRT imports only; no .NET, Node,
  PowerShell, WebView2Loader DLL or VC redistributable DLL dependency.
- `act -l` inspected the original workflow jobs. Docker's Linux runner cannot
  validate Windows registry/ACL/PS 5.1/MSVC/WebView2; original Windows commands
  were run directly. No production secrets or publication jobs were run in act.
- GitHub-hosted CI is a separate post-push gate; no hosted result is inferred
  from local tests.

## Actual copied-Firefox file lifecycle

Command, using the locally built complete release tree:

```text
cargo run --locked --release -p fennevia-platform-windows --example release-transaction -- <EXTRACTED_PACKAGE> <FIREFOX_EXE>
```

The harness copied stock Firefox 155.0.1 BuildID 20260903215306 to a UUID
temporary fixture and created a separate profile with an unrelated sentinel.
Only this test process's APPDATA pointed to a synthetic profiles.ini; it did
not register anything in the real user's Firefox configuration. No browser
process was launched and no daily profile/program files were modified.

Observed: Install committed 26 operations; unchanged Update 0; Disable 3;
Enable 3; Update restored an individually missing file with 1 operation;
Repair restored a wholly missing program side with 4; Uninstall committed 26.
The complete original file/hash inventory matched after uninstall, including
the unrelated sentinel. The successful harness removed its own fixture.

The first debug harness was stopped because unoptimized hashing of the full
runtime repeatedly made verification slow; optimized validation above completed.
Four earlier failed/stopped UUID fixtures remain in the local temp directory:
the tool's automatic approval review rejected their bounded cleanup with
`blocked by policy`. They are not source, release contents or daily targets.
No retry through another deletion mechanism was attempted.

## Packaging findings and corrections

The original startup privacy callback synchronously dispatched navigation on
the same UI thread and stalled. A bounded phase-only probe identified the last
completed privacy phase. Dispatch now occurs after that callback returns;
frontend-ready IPC is required for smoke success. Temporary probes were removed.

A fixed-runtime validation attempt rejected Microsoft's directory spaces;
only the release-container spelling was corrected, with exact inventory checks.

Binary inspection then found a build-host config_parent string even under
cargo --release. Published Tauri macro/codegen source showed that the production
context depends on custom-protocol, not Rust's optimization mode. That feature
is now explicit. Packaging rejects ASCII/UTF-16 machine-local build paths and
never patches compiled bytes to hide them. The binaries are unsigned.
Installer source/lock/pin/notice line endings are fixed to LF, so Git checkout
and archive cannot change inventory bytes or dependency-review hashes. Upstream
source/license whitespace is retained and excluded from whitespace-only checks.

Fixed runtime: 157.0.4341.42 x64; 257 runtime files plus five native files,
with a separate manifest. The CAB hash, licensing, minimal crash-reporting
privacy patch, SDK loader provenance and notice assembly are in
`docs/dependency-reviews/tauri-installer-2026-11-09.md`.
The earlier build occupied about 728 MB extracted; final size/checksum are
reported by the generated artifacts, not a fixed product promise.

## Not run / release gates

Final clean-source preflight on commit
`5038e49dae15153b38fbd18f3e90e14477c0f856` passed:

```text
pwsh -NoProfile -File scripts/release-preflight.ps1 -OutputDirectory <EMPTY_OUTPUT> -SkipDependencyInstall -SkipProjectVerification
```

The skip flags reused the already passed local root/frontend gates and exact
installed dependencies. The second archived source installed its own locked
frontend dependencies; both native builds used fresh Cargo target directories.
Native inventory, both full ZIPs and release manifests matched. ZIP SHA-256:
`fb4869e30be0c5361945acd6ebde1ea4ae64ba666ff8a53201fe07d1aac5975f`.
Extraction into a Unicode/space path passed strict verification and the actual
frontend/worker smoke. This hash identifies that local preflight source commit,
not the older published release or any later documentation-only rebuild.
The ordinary release workflow retains full verification and annotated-tag gates.

The following manual rows remain not run:

- Secure-desktop UAC accept, cancel, different-account credentials and
  Program Files ACL/race scenarios on physical targets.
- Clean Windows machine without development tools; network-isolated/capture
  execution and exhaustive renderer/capability attack attempts.
- Physical disk-full, power loss or forced worker termination mid-write.
- Visual mouse/keyboard/focus checks, 100/150/200% DPI, screen reader,
  high contrast and multilingual hardware interaction.
- Real Firefox startup, shell/native fallback, multiple/private windows and
  the complete browser release matrix using this new extracted installer.
- Code signing, Linux/macOS support, new release tag/publication.

Automated rollback, package verification and copied-program file restoration
do not substitute for these rows. The earlier beta's one-time manual-test
exception is not extended.

## Documentation and repository administration

Current READMEs, installer README, installation/security/testing/internals,
current status, documentation index, dependency review/notices, ADR-097,
master/roadmap/plan 019 and bundled installation instructions were synchronized.
Historical initial/transaction evidence and prior Firefox release records were
not rewritten. Package version and published release remain unchanged.

The owner explicitly requested gh account yutinglia and direct main push.
After switching through `gh auth switch --user yutinglia`, inspection returned
main branch-protection 404 (not protected), repository rulesets [], and no
protected branch. There was nothing to relax; no protection was removed, no
force push used and no review approval was manufactured. This dated observation
does not cache credentials or change the general account-source-of-truth rule.
