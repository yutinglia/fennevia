# Frontend Toolchain Dependency Review

## Request and decision

- Review date: 2026-08-15
- Owning issue: [#8](https://github.com/yutinglia/fennevia/issues/8)
- Reviewer: `yutinglia-agent`
- Decision: **accepted for the issue #8 smoke frontend and build pipeline**
- Package registry: public npm registry only
- Package manager: npm 11.16.0 bundled with the nvm-managed Node.js 24.18.0 installation
- Install policy: exact versions, lockfile v3, `engine-strict=true`, and project-level `ignore-scripts=true`

This record supersedes the candidate-version portion of
`frontend-toolchain-2026-08-14.md`. The complete machine-readable resolution is
`frontend-toolchain-lock-inventory.json`; it records every package path,
name/version, registry URL, integrity, license, optional/platform condition,
declared CLI, install-script flag, and observed installed lifecycle hook.

## Direct dependencies

All 12 dependencies are development dependencies. Only compiler-selected code
from `svelte` is present in an installed artifact.

| Package | Version | Purpose | License | Runtime privilege impact |
|---|---:|---|---|---|
| `svelte` | 5.56.9 | Compile and provide the minimal component runtime | MIT | Selected client runtime code is bundled into the system-principal artifact |
| `@sveltejs/vite-plugin-svelte` | 7.3.0 | Compile `.svelte` source through Vite | MIT | Build host only |
| `vite` | 8.2.1 | Produce one deterministic IIFE and extracted CSS | MIT | Build host only; no dev server or HMR output is installed |
| `typescript` | 6.0.3 | Typecheck source and build configuration | Apache-2.0 | Build host only |
| `svelte-check` | 4.7.6 | Typecheck Svelte component markup and props | MIT | Build host only |
| `eslint` | 10.8.1 | Static lint runner | MIT | Build host only |
| `@eslint/js` | 10.0.1 | ESLint's maintained JavaScript rule preset | MIT | Build host only |
| `typescript-eslint` | 8.67.0 | TypeScript parser and lint rules | MIT | Build host only |
| `eslint-plugin-svelte` | 3.23.0 | Svelte parser and lint rules | MIT | Build host only |
| `prettier` | 3.9.6 | Deterministic source formatting | MIT | Build host only |
| `prettier-plugin-svelte` | 4.1.1 | Format `.svelte` source | MIT | Build host only |
| `@types/node` | 24.13.3 | Type declarations for Node.js build scripts | MIT | Types only; never bundled |

Every direct installed package has a top-level license file. The lockfile also
contains a license expression for all 173 resolved package paths.

## Selection and rejected alternatives

- npm is selected because it ships with the required nvm-managed Node runtime;
  pnpm, Yarn, and another installer or lockfile format add no benefit here.
- Svelte is the candidate accepted by ADR-005. The real Firefox result now
  validates its state, events, XHTML, template, and official unmount paths.
- Vite and the official Svelte plugin provide the smallest maintained Svelte
  production integration. Library mode emits one IIFE and one extracted CSS
  input; Fennevia converts the CSS to a fixed local style module.
- TypeScript 7.0.2 is rejected. Its platform compiler packages add native
  surface, while `svelte-check@4.7.6` supports TypeScript through 6.x and
  `typescript-eslint@8.67.0` supports versions below 6.1. TypeScript 6.0.3
  satisfies both and has no runtime dependencies.
- Node's built-in `node:test` covers pure state and artifact tests. Vitest,
  jsdom, happy-dom, and browser automation packages are rejected because the
  required DOM proof runs in real Firefox.
- Extracted Svelte component CSS is sufficient. Tailwind and a component
  library would add a graph and CSS transformation stage without improving
  this smoke island.

## Resolved graph and install behavior

`npm run dependencies:audit` reproduced this Windows x64 inventory:

| Measurement | Result |
|---|---:|
| Direct exact dependencies | 12 |
| Lockfile package paths | 173 |
| Unique name/version pairs | 173 |
| Installed package paths after clean Windows install | 148 |
| Optional package paths | 26 |
| Packages declaring a CLI `bin` | 12 |
| Lock entries flagged with an install script | 1 |
| Installed packages with `preinstall`, `install`, or `postinstall` | 0 |
| Installed native binaries | 2 |
| Installed WebAssembly files | 0 |

The 12 declared CLI packages are `acorn`, `cssesc`, `eslint`, `nanoid`,
`prettier`, `rolldown`, `semver`, `svelte-check`, `typescript`, `vite`, `which`,
and `yaml`. npm creates ordinary local command shims for these declarations;
none is copied into the Firefox package.

The sole lock entry with `hasInstallScript` is optional
`fsevents@2.3.3`, constrained to `os: ["darwin"]`. Its registry manifest says
`install: node-gyp rebuild`. It is not installed on the validated Windows host,
and scripts remain disabled on every platform. This is the only default-install
lifecycle difference requiring explicit review.

The two installed native files are:

- `@rolldown/binding-win32-x64-msvc/rolldown-binding.win32-x64-msvc.node`;
- `lightningcss-win32-x64-msvc/lightningcss.win32-x64-msvc.node`.

They execute only when the reviewed Vite build invokes Rolldown or Lightning
CSS on the development/CI host. Neither file, package loader, nor package
manager is included in the profile artifact inventory. There are no installed
`.wasm`, `.exe`, or `.dll` dependency payloads.

`npm ci --ignore-scripts --no-fund` installed the 148 platform-applicable
package paths. Every resolved tarball URL is under
`https://registry.npmjs.org/`, every entry has an integrity digest, and no
Git/file dependency is present. With all lifecycle hooks disabled, install-time
network behavior is limited to npm registry metadata/tarballs and the npm
security verification endpoints; packages cannot start their own downloader.

## Registry, signature, source, and tarball checks

`npm audit signatures --json` returned zero invalid and zero missing
signatures. `npm audit --json` returned zero known vulnerabilities at every
severity. These checks establish registry integrity/signature status at the
review time, not future trustworthiness.

`npm pack <name>@<version> --dry-run --json --ignore-scripts` reproduced each
direct package's lockfile integrity. It reported these exact tarball file
counts: Svelte 389, Svelte Vite plugin 39, Vite 36, TypeScript 140,
Svelte Check 11, ESLint 420, `@eslint/js` 7, typescript-eslint 13,
eslint-plugin-svelte 283, Prettier 56, Prettier Svelte plugin 7, and
`@types/node` 88.

The corresponding upstream version references were checked:

| Package | Upstream version reference and commit | npm correspondence |
|---|---|---|
| `svelte` | `svelte@5.56.9` → `20b341f10048cf1016a2028ac7eee5595cfef6a5` | npm SLSA provenance present |
| `@sveltejs/vite-plugin-svelte` | `@sveltejs/vite-plugin-svelte@7.3.0` → `e6a89fc7d4285315ab26588a51199a421e4c81cd` | npm SLSA provenance present |
| `vite` | `v8.2.1` → `421615865dad3ed39137d17281814fc78a41246c` | npm SLSA provenance present |
| `typescript` | `v6.0.3` → `050880ce59e30b356b686bd3144efe24f875ebc8` | npm `gitHead` matches |
| `svelte-check` | `svelte-check@4.7.6` → `f436ec070aa88eaac9efbbbe6131c6658d4d87eb` | npm SLSA provenance present |
| `eslint` | `v10.8.1` → `c049dc3c4294da7afe3d920a1a5fdeba388f4983` | npm `gitHead` matches |
| `@eslint/js` | release commit `84fb885d49ac810e79a9491276b4828b53d913e5` | npm `gitHead` matches the package-release commit |
| `typescript-eslint` | `v8.67.0` → `20a261fb8e62351e88176b075090dc9276d26072` | npm SLSA provenance present |
| `eslint-plugin-svelte` | `eslint-plugin-svelte@3.23.0` → `a24a9bb53cbd716f7ae894d889c02512c37453b6` | npm SLSA provenance present |
| `prettier` | `3.9.6` → `8f0c95057cc91d5836409466cd9d9af3bb901e84` | signed npm tarball; no npm provenance record |
| `prettier-plugin-svelte` | `prettier-plugin-svelte@4.1.1` → `7809486a9716faa2234c8a45d88b601034de52d8` | npm SLSA provenance present |
| `@types/node` | DefinitelyTyped `types/node/v24` baseline `4e4c198c164b1fba9bba790ea9acb7fa47fc4f80` | signed npm tarball; the publisher exposes no package-specific tag or `gitHead` |

The missing provenance/git-head fields for the last two cases remain an
explicit residual risk. Their signed tarball integrity and installed license
were checked, but this review does not overstate a source-to-tarball proof.

## Production artifact impact

The deterministic build runs twice in isolated OS temporary directories and
compares bytes before replacing the exact owned target directory. Package
`0.5.0-dev` contains these generated files:

| Artifact | Bytes | SHA-256 | Included package code |
|---|---:|---|---|
| `ShellApp.js` | 35,837 | `92338b310d522ede99955d214aae3faa5c71194cb798c10dcd2a97c8304e3da3` | Svelte 5.56.9 client subset and project component |
| `ShellStyles.sys.mjs` | 3,542 | `2a80d21a31bb541aca31ee4713a75087537ad42b7b0de3a375806823da3c842a` | Project component CSS only |
| `THIRD_PARTY_NOTICES.txt` | 1,200 | `0cd8b75a5e96e98009ec60de17b5536ef15d00f1b4f469a0c7189a30681ac7ea` | Svelte MIT notice |

The scanner found no HMR client, dev-server reference, CDN, remote font,
analytics, runtime network API, bare/dynamic import, source map, debug
statement, executable binary, or unexpected chunk. There is no runtime npm
package manager or network loader.

Svelte embeds 13 documentation URLs in invariant error messages. The build
accepts only the pinned slug set and replaces each inert URL with a fixed
`FENNEVIA_SVELTE_RUNTIME_*` code; it fails if Svelte adds or removes a slug.
Svelte tree fragments also include exact W3C XHTML, SVG, MathML, and XLink
namespace constants. The artifact policy exempts only complete quoted forms of
those standards identifiers and still rejects any suffix.

Source maps are disabled in Vite and prohibited from the installed inventory.
Development diagnostics stay in source/test tooling and are not exposed
through a content-accessible mapping. The classic IIFE has one fixed
per-window registration callback; the privileged adapter deletes that
callback immediately after capture and keeps the API only in a private
`WeakMap` until official unmount.

## Runtime validation

On Firefox 153.0.4 (`20260810162159`) on Windows 11, the bundle passed:

- normal, second normal, and private-window mount with independent state;
- counter, input, button event, conditional render, extracted CSS, XHTML
  namespace, and real `HTMLTemplateElement.content` paths;
- official unmount, zero descendants, balanced delegated listener removal,
  detached-control inactivity, and fresh-state remount;
- unchanged computed styles for native toolbox, sidebar, popup set, URL input,
  application-menu button, and retained modal prompt;
- missing-bundle and throwing-mount fail-open recovery with exact restoration;
- Browser Toolbox ownership inspection and zero unexpected first-party script
  errors.

The first HTML-fragment build failed in real `browser.xhtml` because Svelte's
HTML parser traversal assumptions do not hold in Firefox's XML/XHTML document.
The maintained compiler option `fragments: "tree"` is the selected minimum
fix. It creates the DOM tree directly and passed the required template path;
no Svelte runtime patch is carried.

## Update, recovery, and residual risk

- Versions are exact. Every upgrade requires a lockfile/inventory diff, a new
  signature/vulnerability check, and a repeated production/Firefox matrix.
- `npm run dependencies:audit` must reproduce the committed inventory; CI
  rejects a changed graph or platform payload through the clean-tree gate.
- Removal deletes the exact generated shell directory and restores the prior
  package manifest. No framework state is persisted in a Firefox profile.
- The remaining material build-host risks are npm registry compromise, the two
  selected Windows native binaries, and future changes in Svelte/Vite output.
  Integrity, signatures, scripts-disabled install, deterministic output,
  exact inventory, and real-Firefox tests reduce but do not eliminate them.

Final decision: accept this graph for the issue #8 smoke island and initial CI.
This is not blanket approval for additional runtime dependencies, component
libraries, Tailwind, dev-server use, or dependency upgrades.
