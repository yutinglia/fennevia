<!-- SPDX-License-Identifier: MPL-2.0 -->

# Third-party notices

This file is the repository-level source of truth for third-party material
copied, adapted, generated into, or bundled with distributed Fennevia artifacts.
The review baseline is project commit `24cfc814f833030b05f82bc665d1574c439d173c`
on 2026-08-16 for issue #18.

Fennevia's original material is licensed under MPL-2.0; see `LICENSE` and
`docs/licensing-and-provenance.md`. Third-party material remains under the terms
identified below. This inventory is not a substitute for the complete license
text preserved at the named notice path.

## Project-owned and generated documentation media

### Owner runtime captures and generated customization hero

- Owning decision and review: direct repository-owner request, reviewed
  2026-08-28 by Codex; no separate issue number was supplied.
- Classification: six owner-provided runtime captures copied without raster
  modification, plus one generated README hero based on five of those captures
  and a project-authored prompt.
- Source: project-owner attachments supplied for this repository. The hero was
  created with OpenAI's built-in image-generation tool; no exact model/version
  identifier was exposed and no external design asset was supplied.
- Service terms/rights basis: OpenAI Terms of Use effective 2026-01-01,
  <https://openai.com/policies/terms-of-use/>. As between the user and OpenAI
  and to the extent permitted by law, the user owns Output and receives any
  OpenAI interest in it. This is a service-provenance record, not a bundled
  OpenAI software license.
- Project paths, exact SHA-256 values, complete final prompt, privacy/security
  review, modifications, and update/removal procedure:
  `docs/media/PROVENANCE.md`.
- License/notice treatment: the repository owner intentionally contributed the
  captures and requested the generated output under Fennevia's MPL-2.0 inbound
  rule. Incidental product UI visible inside the captures and stylized hero is
  not extracted or shipped as a standalone reusable logo or asset. No font
  file, source code, separately downloaded raster, runtime dependency, or
  release-package dependency is added.

## Material included in the distributed runtime

### Svelte 5.56.9 runtime subset

- Classification: compiler-selected third-party runtime code bundled into a
  generated executable-form artifact; no upstream source file is manually
  copied into this repository.
- Package: `svelte@5.56.9`.
- Source repository: `https://github.com/sveltejs/svelte`.
- Source tag and commit:
  `svelte@5.56.9`, `20b341f10048cf1016a2028ac7eee5595cfef6a5`.
- Published source unit: the runtime modules in the npm package selected by the
  Svelte compiler and deterministic Vite/Rolldown tree-shaking process.
- Registry tarball:
  `https://registry.npmjs.org/svelte/-/svelte-5.56.9.tgz`.
- Integrity:
  `sha512-VT8kSnlEg8069w7AiCcAk3Yf5xvMnrGTagVOmU/OpOLHaHnNqXhWZCH/4EVga/bT/HtWhvE6/fHrXLErx7OnJA==`.
- License: MIT.
- Copyright notice: `Copyright (c) 2016-2025 Svelte Contributors`.
- Fennevia artifact:
  `profile/chrome/fennevia/content/shell/ShellApp.js`.
- Modifications: compiler selection, bundling, and minification; Fennevia's
  build also replaces the exact reviewed Svelte diagnostic URLs with fixed
  local error codes. No upstream Svelte source file is edited in place.
- Required notice:
  `profile/chrome/fennevia/content/shell/THIRD_PARTY_NOTICES.txt`, generated from
  the pinned package license and included in the installed artifact inventory.
- Update/removal record:
  `docs/dependency-reviews/frontend-toolchain-2026-08-15.md`.

## Build-only dependencies

The remaining resolved npm packages execute only on development and CI hosts;
they are not copied into the installed Firefox package. Their exact versions,
integrities, licenses, native/platform payloads, lifecycle behavior, source
correspondence, and removal procedure are recorded in:

- `docs/dependency-reviews/frontend-toolchain-2026-08-15.md`;
- `docs/dependency-reviews/frontend-toolchain-lock-inventory.json`.

Build-only classification does not relicense those packages. If a future
artifact includes any of their code or assets, this file and the generated
artifact notice must be updated before distribution.

## Research and design references not included

Mozilla Firefox source, compatibility canaries, Firefox derivatives, and
`yutinglia/my-firefox-custom` were consulted as documented evidence or broad
design references. The issue #18 audit identified no copied/adapted
implementation, selector, event/timer structure, native-DOM strategy, visual
asset, icon, font, or Firefox binary from those sources in Fennevia. They are
therefore not bundled third-party material and are not relicensed here.

## Adding or changing third-party material

Before merge, add one record using the fields in
`docs/licensing-and-provenance.md`: source repository, source file or published
source unit, exact commit/tag and integrity when applicable, license and
file-level notice, copied/adapted/generated/bundled classification, project
paths, modifications, required attribution/source availability, reviewer/date,
update/removal strategy, and owning issue.

Code or assets with an unclear or absent reusable license must not be included.
