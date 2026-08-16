<!-- SPDX-License-Identifier: MPL-2.0 -->

# Licensing and third-party provenance

## 1. Decision and status

The repository owner's issue #18 decision licenses Fennevia under the Mozilla
Public License 2.0 (`MPL-2.0`). The unmodified canonical license text is in the
root `LICENSE` file.

Copyright 2026 Fennevia contributors.

This is an open-source license decision, not a warranty, legal-compliance
guarantee, contributor license agreement, or trademark registration. The
Mozilla license text controls if this policy summary differs from it.

The `private: true` field in `package.json` only prevents accidental npm
publication. It does not change the repository's MPL-2.0 license.

## 2. What the project license covers

Unless a file carries a different third-party notice, MPL-2.0 covers:

| Material | Treatment |
| --- | --- |
| Project-authored source, tests, scripts, configuration, and styles | Source Code Form under MPL-2.0 |
| Project-authored documentation and plans | MPL-2.0 for consistency with the software project |
| Generated bridge, JavaScript, CSS/style modules, manifests, and other project output | Project-authored portions remain MPL-2.0; generated/minified output may be Executable Form and does not replace source availability |
| Installed Fennevia files | Same treatment as their source/generated inputs; installation does not create a new license |
| Third-party portions of a combined artifact | Remain under their original license and notice; they are not relicensed as Fennevia code |
| Research links, factual source citations, and broad design references | Do not import the referenced implementation's license or grant permission to copy it |

A detached generated or installed tree is not a self-sufficient distribution
bundle. Anyone distributing it must also provide recipients with the canonical
MPL-2.0 license, the corresponding preferred source form at the exact release
or commit, instructions for obtaining that source, and all applicable
third-party notices. The release workflow must enforce this before publishing a
binary/minified artifact.

## 3. File notices

For new project-authored source files, use this SPDX identifier in the native
comment syntax where practical:

```text
SPDX-License-Identifier: MPL-2.0
```

The root `LICENSE` is the attached notice for existing files, generated files,
formats without comments, and files where an inline notice is impractical, as
allowed by MPL-2.0 Exhibit A. Do not add or infer the Exhibit B
`Incompatible With Secondary Licenses` notice without a separate explicit owner
decision.

Never remove or alter an upstream copyright, patent, license, warranty, or
attribution notice except to correct a verified factual error in a manner
permitted by its license.

## 4. External contributions

By intentionally submitting a contribution for inclusion in Fennevia, a
contributor represents that they have sufficient rights to submit it and agrees
that the contribution is provided under MPL-2.0. No contributor license
agreement or Developer Certificate of Origin sign-off is currently required.

Contributors must identify material they did not author. A pull request
containing third-party code or assets must include the provenance record and
required notices before review. Maintainers may reject a contribution when its
origin, authorship, or licensing authority is unclear.

This inbound rule does not relicense third-party material. Material accepted
under another compatible license remains subject to that license and must stay
distinguishable from Fennevia-authored files.

## 5. Third-party handling rules

| Source license/class | Project rule before inclusion |
| --- | --- |
| MPL-2.0 or other file-level copyleft | Preserve file notices and license; keep affected files/source availability identifiable; document modifications and distribution obligations |
| MIT, BSD, ISC, or BlueOak | Verify the exact source/file license and preserve copyright, license, and disclaimer text required by that license |
| Apache-2.0 | Preserve the license and applicable attribution/NOTICE material; record patent/NOTICE implications before combining or modifying |
| Creative Commons or another asset/document license | Review the exact version, attribution, modification, share-alike, non-commercial, and no-derivatives terms; do not assume it is suitable for source code |
| Dual/multi-licensed material | Record which offered license is selected and why Fennevia can comply; preserve the source's notices |
| Public-domain/CC0 assertion | Verify the exact dedication and source authority; record it rather than silently treating it as unowned |
| Unlicensed, unclear, source-visible-only, or incompatible material | Direct copying, adaptation, vendoring, generation into artifacts, and distribution are prohibited |

Public visibility, a GitHub license badge, an SPDX package field, or conceptual
similarity alone is not enough evidence. Review the repository, exact file,
commit/tag, and file-level notices.

## 6. Provenance source of truth

`THIRD_PARTY_NOTICES.md` is the canonical repository inventory for material
included in distributed Fennevia source or artifacts. Accepted dependency
records under `docs/dependency-reviews/` provide deeper build-host and resolved
graph evidence and must be linked from the corresponding notice entry.

Every copied, adapted, generated-from, vendored, or bundled item requires:

1. owning issue, review date, and reviewer;
2. source repository and exact source file or published source unit;
3. exact commit/tag and package integrity when applicable;
4. license identifier, license-file path, and file-level notices;
5. classification: copied, adapted, generated, bundled, build-only, or
   reference-only;
6. every Fennevia project/artifact path containing the material;
7. modifications and independently authored surrounding work;
8. required attribution, license copy, source availability, or NOTICE handling;
9. security/compatibility review and update/removal strategy.

Reference-only sources remain in issue/research records and must include the
exact consulted revision and a no-copy statement. They enter the root notice
inventory only if material is actually included.

## 7. Distribution checklist

Before publishing a source archive, release package, generated/minified bundle,
or installed-tree copy:

- include the unmodified root `LICENSE`;
- include `THIRD_PARTY_NOTICES.md` and every artifact-specific notice;
- identify the exact corresponding source repository/release commit and make
  that preferred source form available by reasonable means;
- ensure project package metadata says `MPL-2.0`;
- preserve all applicable upstream file headers and notices;
- verify generated output against the committed source and lockfile;
- confirm no unrecorded copied/adapted code, asset, font, icon, or binary is
  present;
- run the production artifact, dependency, secret, and local-path gates;
- record any material that cannot comply before distribution, as required by
  the governing license.

## 8. Existing repository audit

The #18 audit covered repository history through base commit
`24cfc814f833030b05f82bc665d1574c439d173c`, completed research/provenance
records, the resolved npm graph, generated artifacts, and the package manifest.
It found:

- independently authored Fennevia implementation and documentation;
- no copied/adapted Firefox, loader, derivative, or `my-firefox-custom`
  implementation;
- no third-party icon, logo, font, image, or Firefox binary;
- only the compiler-selected `svelte@5.56.9` runtime subset in a distributed
  artifact, with its complete MIT notice already generated and installed;
- all other npm packages confined to development/CI hosts.

The exact current runtime entry is in `THIRD_PARTY_NOTICES.md`. Future findings
must update that inventory; this audit is not a permanent assertion about later
commits.

## 9. Name and branding

MPL-2.0 does not grant rights to contributor trademarks, service marks, or
logos. The software license therefore does not grant a right to imply project
endorsement or use Fennevia branding as a trademark. No separate logo/icon
license exists because the repository currently distributes no project logo or
icon asset. Any future brand asset or trademark policy requires an explicit
owner decision and its own license/provenance record.

## 10. Changing this policy

Relicensing, dual licensing, applying Exhibit B, adding a CLA/DCO requirement,
or adopting a separate documentation/asset license requires a dedicated issue
and explicit repository-owner approval. Agents and contributors must not infer
such authority from project maintenance access.
