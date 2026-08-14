# Preliminary Frontend Toolchain Dependency Review

## Status

- Review date: 2026-08-14
- Owning issue: [#17](https://github.com/yutinglia/my-firefox-shell/issues/17)
- Installation/build owner: [#8](https://github.com/yutinglia/my-firefox-shell/issues/8)
- Decision: **defer installation and final approval to #8**
- Evidence command: `npm view <package>@<version> ... --json` with npm 11.16.0 on Node.js 24.18.0

This is the required example of the dependency-review process. It records current official registry metadata without adding a package, generating a lockfile, executing a lifecycle script, or claiming the unresolved graph is approved.

## Candidate snapshot

| Package | Version observed | Purpose | License | Published direct / optional dependencies | Published install lifecycle signal |
|---|---:|---|---|---:|---|
| [`svelte`](https://www.npmjs.com/package/svelte/v/5.56.9) | 5.56.9 | Compile and provide the isolated project-owned frontend runtime | MIT | 16 / 0 | No `preinstall`, `install`, `postinstall`, or `prepare` script in the published manifest |
| [`@sveltejs/vite-plugin-svelte`](https://www.npmjs.com/package/@sveltejs/vite-plugin-svelte/v/7.3.0) | 7.3.0 | Connect Svelte compilation to the proposed Vite build | MIT | 4 / 0 | No install lifecycle script in the published manifest |
| [`vite`](https://www.npmjs.com/package/vite/v/8.2.1) | 8.2.1 | Production bundling and local build orchestration; the dev server must never be part of installed runtime | MIT | 5 / 1 | No install lifecycle script in the published manifest; direct graph includes native-capable build tools |
| [`typescript`](https://www.npmjs.com/package/typescript/v/7.0.2) | 7.0.2 | Type checking and source compilation only | Apache-2.0 | 20 / 20 | No install lifecycle script in the published manifest; current package selects platform compiler packages |

Registry modification times were 2026-08-06 through 2026-08-13, so this snapshot is temporally specific and must be refreshed when #8 selects versions.

Registry integrity values observed for the exact candidates:

```text
svelte@5.56.9 sha512-VT8kSnlEg8069w7AiCcAk3Yf5xvMnrGTagVOmU/OpOLHaHnNqXhWZCH/4EVga/bT/HtWhvE6/fHrXLErx7OnJA==
@sveltejs/vite-plugin-svelte@7.3.0 sha512-QbRoJyD92e9R0ufeQIWRHrCC0ObcqSv/aBDdrQMoU+sypav3cDx5wytdQ6GLdXjEMO6xjrXGzfkUygng8JMv0A==
vite@8.2.1 sha512-EU/eS7BH3XROHh2YnBefjM6DBKA6ZeMZEYQbj7NLWg5wHYlhB8B/Mayd5XsgWq+NFYccDOTemRpdETWR6Ka/lw==
typescript@7.0.2 sha512-8FYau96o3NKOhbjKi/qNvG/W5jhzxkbdm5sj9AbZ/5T5sWqn3hJgLfGx27sRKZWTvyzCP8dLRBTf5tBTSRVUNA==
```

The registry metadata points to the official Svelte, Svelte Vite plugin, Vite, and Microsoft TypeScript repositories. The current engine ranges accept Node.js 24 for all four candidates, but #8 must pin the repository's nvm-managed version and verify source tag/tarball correspondence rather than infer it from repository URLs.

## Purpose and alternatives

- Svelte is the planned candidate in ADR-005, but #8 must still prove XHTML mount/unmount, event behavior, CSS isolation, and deterministic output.
- The Svelte Vite plugin is required only if Vite remains the selected compiler integration. A direct compiler invocation is an alternative if it materially reduces the graph.
- Vite is a candidate build tool, not a runtime service. Direct Rollup/Rolldown configuration or another local bundler remains an alternative if Vite output cannot meet the exact-artifact and no-HMR gates.
- TypeScript is a build/typecheck tool. Firefox must run generated JavaScript without Node.js or a TypeScript runtime.
- No component library, CSS framework, remote font package, analytics package, or runtime fetch helper is included in this proposal.

## Execution lifecycle and elevated branches

The four top-level packages execute during dependency resolution and build/typecheck. Svelte runtime code may be included in the privileged frontend bundle; Vite, its plugin, TypeScript, and compiler binaries must not be installed into the Firefox package.

Current direct metadata identifies these elevated supply-chain branches:

- Vite 8.2.1 depends on `rolldown` and `lightningcss`.
- `rolldown` 1.2.1 declares 15 platform-specific optional binding packages, including `@rolldown/binding-win32-x64-msvc`.
- `lightningcss` 1.33.0 declares 11 platform-specific optional packages and a published `prepare` script (`patch-package`). Whether that script executes for the selected registry/install flow must be measured rather than assumed.
- TypeScript 7.0.2 declares 20 platform packages as direct and optional dependencies; the Windows x64 package is approximately 28 MB unpacked and represents executable compiler supply-chain surface.

None of the reviewed top-level manifests declares a runtime remote download or postinstall script. That observation is not enough to approve the transitive graph: #8 must inspect the exact lockfile, every lifecycle script, platform binary provenance, package-manager network log, and filesystem effects.

## Network and data behavior

Accepted policy for #8:

- Network access is limited to explicit package-manager registry retrieval during dependency installation.
- Run and compare installation with lifecycle scripts disabled before allowing any script.
- No package may read Firefox profiles, browser data, SSH state, GitHub credentials, or unrelated home-directory files as part of build.
- Vite dev-server, HMR websocket, dependency optimizer endpoints, update checks, and remote assets are development-only and must not appear in generated or installed artifacts.
- The installed runtime performs no package-manager, CDN, font, analytics, configuration, or update network request.

## Required #8 approval evidence

Before these candidates are accepted, #8 must:

1. select exact versions compatible with the repository's nvm-managed Node.js version;
2. commit the package manifest and lockfile in the same review;
3. record exact direct/transitive counts and all added package names/versions;
4. inspect `preinstall`, `install`, `postinstall`, `prepare`, native-binary, WebAssembly, and code-generation behavior across the resolved graph;
5. compare install behavior with scripts disabled and record all network/file effects;
6. verify package licenses and published-tarball/source-tag correspondence;
7. produce a deterministic production build with no runtime Node.js requirement;
8. commit an exact production artifact inventory and pass `scripts/check-production-artifacts.ps1`;
9. inspect the bundle for Svelte-only runtime inclusion and prove Vite/plugin/TypeScript/build binaries are absent;
10. run the XHTML lifecycle, cleanup, second-window, and private-window tests required by #8.

## Removal and rollback

If the spike fails, remove the package manifest entries and lockfile delta, delete only project build output/cache directories, and verify the exact artifact inventory no longer contains candidate code. Firefox installation and profile artifacts must remain unchanged because #8 is a build spike until a separately reviewed installer consumes its output.

## Preliminary decision

The toolchain remains a plausible candidate, but this record does not approve installation or privileged runtime use. Native compiler/bundler packages and the unresolved transitive graph are material review conditions. #8 owns the final version decision and may select a smaller toolchain if it better satisfies deterministic, self-contained output.
