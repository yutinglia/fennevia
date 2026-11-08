<!-- SPDX-License-Identifier: MPL-2.0 -->
# Native installer transactions and worker evidence

Date: 2026-11-09, Asia/Taipei. Direct owner request to continue with actual
transactions, rollback and UAC; plan 019 / ADR-095 / ADR-096. Source baseline
`5ad1eccf84ede8e5776ff1bcb27140079f5ce032` plus uncommitted changes on
`codex/gui-installer-plan`. No release, commit, PR or completed-milestone claim.
The initial read-only validation record remains historical.

## Delivered development behavior

- The GUI now offers explicit, single-use apply consent for eligible previews.
  It binds the request to target volume/file IDs, Firefox identity, source and
  plan digest, rejects stale/default-profile consent, and prevents duplicate
  actions and ordinary window close during work. English/Traditional Chinese
  UI reports committed, unchanged, rolled-back, cleanup-failed and unknown states.
- The native worker runs all six lifecycle actions. Both target roots use
  same-volume private staging, flushed journals/backups and handle-based
  create/rename/delete. Each operation rechecks hashes; rollback reverses
  actual completed steps. Existing objects are stashed, preserving their ACLs.
  Cleanup only visits recorded artifacts and never recursively deletes targets.
- A native process snapshot refuses any running `firefox.exe`, without reading
  command lines or killing processes. The selected `parent.lock` is held during
  work; pre-existing bytes are preserved. The Windows locking contract was
  checked in upstream `toolkit/profile/nsProfileLock.cpp`, commit
  `6be5ec2fff811284b3ed164cf7ae944a26341869`. No upstream implementation was copied.
- A SID-only local named pipe carries a bounded request and correlated result.
  The parent and worker check exact peer PID/image and same SID; image handles
  deny writes/deletes while connected. Only a nonce goes into argv. The worker
  recomputes the plan under both shared writer locks.
- UAC is wired through native `ShellExecuteExW` / `runas`, only after a normal
  attempt rolls back with access denial and a program-folder write probe confirms
  the need. The user must explicitly confirm again. The GUI never elevates or
  invokes PowerShell. Native UAC interaction is **not run**.
- A durable `result.json` precedes GUI acknowledgement and cleanup. Lost
  acknowledgement retains journals/backups, and both engines reject further
  actions. A lost final reply remains unknown in the GUI; it blocks session
  retries and requires reopening/inspection. No automatic residue deletion.
- PowerShell remains an independent backup. Its only implementation changes are
  shared per-target mutexes and validated, canonical ownership-data comparison.
  The installed pair still requires identical bytes. Rust also normalizes array
  order for semantic comparison, so neither tool rewrites identical installations
  merely because the other serializer wrote their metadata.

Source writing is restricted to the existing unregistered development markers
and disposable Firefox copy marker. Existing valid ownership can still be
disabled/uninstalled without a usable package. General release installation is
gated until full release-container and image inventory verification are ported.
New development files retain the private staging ACL; general Program Files ACL
policy remains part of release work. This is not production installer readiness.

## Environment and commands

Windows x64; Node 24.18.0 / npm 11.16.0 via nvm-windows; Rust 1.99.1 MSVC and
Visual Studio 2022 C++ toolchain. Tauri 2.12.5, Svelte 5.56.9, Vite 8.3.6.
Native document-load smoke uses the installed WebView2 runtime.

| Check | Result and scope |
| --- | --- |
| `npm --prefix installer run verify` | Passed: formatting, lint, Svelte/TS, two request-state tests, advisory gate and frontend build |
| `cargo fmt --all --check` | Passed |
| `cargo clippy --locked --workspace --all-targets -- -D warnings` | Passed |
| `cargo test --locked --workspace` | Passed: 36 tests; includes real filesystem transactions, six-action fault injection, mid-replacement rollback, stale/hardlink refusal, lost-ack receipt retention, profile lock, consent expiry/identity/token checks and existing contracts |
| Cross-engine lifecycle | Passed on synthetic disposable roots with PowerShell 5.1 and 7: Rust install to PS no-op/update/disable/enable/repair/uninstall, PS install to Rust no-op/update/disable/repair/uninstall; shared mutex refusal |
| `cargo build --locked --workspace` | Passed; GUI and separate worker executables produced |
| `npm --prefix installer run smoke:native` | Passed: hidden WebView document load, then actual same-user native worker pipe exchange rejects nonexistent targets without mutation |
| Root `npm run verify` | Passed: formatting/lint/types, coverage, fixed PS7 suites, dependency inventory, deterministic installed build, production artifact scan |
| Root coverage and artifacts | 89.18% lines / 95.99% functions; 14 production artifacts passed; no installed-runtime artifact changes |
| Windows PowerShell 5.1 fixed suites | Passed with process-local module search path and `-ExecutionPolicy Bypass`; no persistent execution-policy change |
| Dependency inventory | Regenerated; 247 Windows external crates, 77 npm entries; no new external crate version in this increment |
| `git diff --check` | Passed |
| `act` Windows job | Not run; the earlier enumeration and Docker assessment remain applicable. Windows registry/ACL/MSVC/WebView2/PS5.1 checks run natively; Linux containers cannot provide equivalent evidence |
| GitHub-hosted CI | Not run; no push or PR requested |

The PowerShell cross-engine script is a development test harness. Native
executables never invoke it. Tests remove only their own UUID-named synthetic
fixtures. Real Firefox programs/profiles were not installed, updated or removed.

## Findings resolved during implementation

Windows directory sharing initially blocked rename. The implementation now uses
opened parent handles for native relative creates/renames and validates final
paths; mutating file handles reject hardlinks. Cargo's development EXEs are
hardlinked, so immutable read-only image validation permits those links while
denying write/delete sharing. The actual worker IPC smoke passed after this fix.
Temporary diagnostic output was removed.

PowerShell 5.1 child tests initially inherited an incompatible PowerShell 7
module search path. The harness now clears the child's `PSModulePath`, allowing
each runtime to initialize its own standard modules. This changes the test
environment only. No application fallback or system-wide setting was added.

## Not run / remaining gates

Real UAC acceptance, cancellation, different-account denial, elevated peer-token
inspection, arbitrary forged-process attempts, renderer permission acceptance,
real Firefox startup races, physical disk-full/ACL-race failures, killed-worker
or power-loss recovery, GUI keyboard/focus/DPI/screen-reader flow, and full release
matrices are **not run**. Synthetic fault injection and normal IPC do not prove
these scenarios.

Full release-container/source-policy parity, channel/architecture decisions,
fixed offline WebView2 inventory/provenance, binary identity from a verified
release inventory, clean offline host, reproducible release packaging and the
complete Cargo advisory/transitive dependency review remain unfinished. The npm
build graph still reports two low-severity entries for the known deepmerge
advisory; the moderate-or-higher gate passes. No Linux or other new platform
support is claimed.
