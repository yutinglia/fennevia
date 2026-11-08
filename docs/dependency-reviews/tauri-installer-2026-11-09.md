<!-- SPDX-License-Identifier: MPL-2.0 -->
# Tauri installer dependency review

Owner: direct project-owner implementation request, including usable native
packaging and independent PowerShell backup. Reviewer: Codex. Date: 2026-11-09.
Status: Windows distribution scope reviewed; not an independent security audit
or approval to skip manual release gates. This final increment supersedes the
earlier development-only decision recorded in the initial/transaction evidence.

## Graph and execution

Tauri 2.12.5, tauri-build 2.7.4, rfd 0.18.0, serde 1.0.229,
serde_json 1.0.154, sha2 0.11.1, uuid 1.29.1, windows-sys 0.61.2,
winreg 0.56.0 and regex 1.13.1 form the direct native contracts. The host also
uses existing locked webview2-com 0.39.1 and windows-core 0.62.2 to configure
privacy before rendering. Wry is 0.57.1. Svelte 5.56.9, Vite 8.3.6 and
@tauri-apps/api 2.12.4 form the separately locked frontend.

`tauri-installer-lock-inventory.json` records 247 Windows crates (including the
one vendored crate) and 77 npm entries, lock hashes, source checksums, published
VCS commits, licenses, root notices and build-script flags. Regenerate with
`node installer/scripts/dependency-inventory.mjs`. Source correspondence uses
the published Cargo source/checksum and VCS metadata, not an independently
authenticated upstream release tag. The package ships generated notices and
links to exact preferred source versions.

npm install runs with lifecycle scripts disabled; frontend building still
executes pinned Vite/Rolldown tooling. Cargo executes proc macros and build
scripts. Review of the 37 Windows build-script entries found compiler/SDK
probing, generated constants/resources, OUT_DIR writes and tool invocations;
no build-script network download was identified. This bounded source review
does not certify every possible transitive behavior. Tauri resource compilation
and the Microsoft SDK loader are linked into the executable. The only deliberate
packaging download is the pinned Microsoft CAB, on the build host.

No dependencies are added to the installed Firefox tree. The native host grants
no general filesystem/shell/HTTP plugin, updater or remote-window capability.
Only enumerated bounded commands are exposed to the local main window.
Navigation, window creation, saved-path privacy, worker authorization and
transactions remain enforced by project Rust code; dependencies do not remove
that responsibility.

Tauri's custom-protocol feature is explicitly enabled even for local builds;
the application has no dev-server mode. Without it, tauri-codegen 2.7.4 embeds
config_parent as a development-context string despite cargo --release. The
packager now rejects ASCII/UTF-16 build-host path patterns in both executables.
MSVC dumpbin /dependents found Windows system/UCRT API-set DLL imports only,
with no Node, .NET, PowerShell, external WebView2Loader DLL or VC redistributable
DLL dependency. The fixed WebView2 engine remains a separately inventoried
runtime. This inspection is not a clean-machine execution test.

## Fixed runtime and binary provenance

Microsoft WebView2 Fixed Version Runtime 157.0.4341.42 x64:

- Official download and deployment contract:
  [Microsoft distribution](https://learn.microsoft.com/microsoft-edge/webview2/concepts/distribution).
- Exact official CAB URL and its 257-file inventory:
  `installer/runtime/webview2.json`.
- CAB SHA-256:
  `cedaf8f3d12202c8803bdbae727b01c1be34540b78e8f0a10c6b401c2a8be97d`.
- The downloaded `msedgewebview2.exe` Authenticode check returned Valid with
  Microsoft Corporation as signer. Runtime contents are copied unchanged.
- Official fixed-runtime license retrieved from
  [Microsoft license endpoint](https://developer.microsoft.com/microsoft-edge/api/eula/webview2?locale=en-us&fixed=true);
  visible terms are retained as `installer/runtime/WEBVIEW2-LICENSE.txt` and
  shipped beside the application. Redistribution is with this app under those
  terms, not a standalone runtime offering or MPL relicensing.
- Native inventory contains these runtime files plus GUI, worker, license,
  inventory and assembled notices. No unrelated EXE/DLL wildcard is allowed.

The published webview2-com-sys 0.39.1 contains WebView2LoaderStatic.lib.
Its x64 bytes match Microsoft's NuGet Microsoft.Web.WebView2 1.0.3800.47:
SHA-256 `89c6b872783b8f6c3cedbff618adb42082d455c615453ae10cfc753f1e8f25d8`.
The package was retrieved from Microsoft's NuGet flat-container endpoint.
The BSD-3-Clause SDK license and third-party notice are retained in
`installer/licenses/WEBVIEW2-SDK-LICENSE.txt` and `WEBVIEW2-SDK-NOTICE.txt`.
Runtime/SDK credits are separate from the crate's own MIT copyright.

## Privacy patch

`installer/vendor/webview2-com` retains the published 0.39.1 source, normalized
Cargo manifest and MIT license (Copyright 2021 Bill Avery). Upstream:
`wravery/webview2-rs`, commit `edc2caf886175ccaebe86078c9cfe1ae2a187328`,
`crates/webview2-com`. Sole implementation change: default
`is_custom_crash_reporting_enabled` becomes true. The official option prevents
crash dumps from being sent to Microsoft; Fennevia has no replacement uploader.
Wry creates these options internally and the pinned Tauri stack does not expose
them. Keep the regression test; remove the patch when upstream permits explicit
configuration. See `FENNEVIA-PATCH.md` and ADR-097.

Before embedded UI navigation, supported WebView2 APIs disable this app's
reputation checks, general autofill and password saving. Incognito storage is
used. No unsupported Chromium flags or system-wide SmartScreen changes are made.
The OS/runtime may still generate local diagnostics and follow Windows diagnostic
policy. Network capture and clean-machine privacy tests remain not run; do not
claim that every OS diagnostic service is disabled.
[Microsoft privacy documentation](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/data-privacy).

## Notices and source availability

`installer/scripts/notices.mjs` assembles all selected native crate root
LICENSE/COPYING/NOTICE files, applicable license_file contents, Svelte/Tauri API
licenses, the exact SDK notices and Rust 1.99.1 COPYRIGHT-library.html with its
referenced license texts. This intentionally includes conservative source-level
notices for resolved crates rather than claiming all crate code is linked.
Each crate has an exact crates.io source download link; modified code is
identified at the Fennevia source commit in RELEASE-MANIFEST.json.

License supplements for archives missing root license files:

| Component | Exact source and decision |
| --- | --- |
| alloc-stdlib 0.3.0 | BSD-3-Clause LICENSE, dropbox/rust-alloc-no-stdlib commit 0a81fd6928ea3b33c8cd484aa4575d50ffb98012 |
| selectors 0.38.0 | MPL-2.0 per file headers, servo/stylo commit 572ecba2d1600e7c3d490586692a209faf703baa, selectors/; full canonical MPL text and exact source URL |
| webview2-com / sys | MIT root LICENSE from wravery/webview2-rs commit edc2caf886175ccaebe86078c9cfe1ae2a187328; loader separately identified above |
| webview2-com-macros 0.8.1 | MIT root LICENSE from wravery/webview2-rs commit dffa41a8a46d3f5565eefbff2de57d38d399f158 |

The Windows crate graph declares MIT/Apache, BSD, Unicode, MPL, Zlib or Unlicense
choices; preserve each actual component's terms. The broader Rust toolchain
license reference directory also contains licenses for non-shipped tooling:
including those reference texts is not a claim that the executable contains
every toolchain component. Fennevia original material remains MPL-2.0.

## Advisory evidence and remaining risk

Cargo audit 0.22.2 against RustSec database commit
`309392b18f6b17022f82c701f300433126901068` (updated 2026-11-06) reported no
vulnerabilities, with two informational warnings in the whole cross-platform
lock: proc-macro-error 1.0.4 unmaintained (RUSTSEC-2024-0370), and glib 0.18.5
unsound (RUSTSEC-2024-0429). Neither is in the Windows resolved target graph.
Linux is not supported and must review these before enabling that target.

npm audit reports two low-severity affected entries for the
[deepmerge advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4):
deepmerge 4.3.1 and @sveltejs/vite-plugin-svelte 7.3.0, with no offered fix.
This is trusted build-configuration merging, not runtime profile parsing.
Keep the finding visible; the gate rejects moderate or higher findings.

Binaries are unsigned. Hash inventories detect corruption relative to trusted
source, not publisher authenticity. Native UAC, clean-machine, network capture
and accessibility/hardware release checks remain explicitly unrun. Updates must
refresh exact locks, runtime/SDK pins, notices and audits, then rerun both engines
and reproducibility tests. Removing the installer does not change the Firefox
runtime dependency graph; retain historical validation records.
