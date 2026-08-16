# Dependency Review Template

Complete this record before adding, upgrading, replacing, or newly executing a package. Store accepted records under `docs/dependency-reviews/` and link them from the issue and pull request.

## Request

- Review date:
- Owning issue:
- Reviewer:
- Decision: proposed / accepted / rejected / replace / remove
- Package and exact proposed version:
- Package registry and integrity:
- Source repository, tag or commit:
- License and license-file path:
- Root `THIRD_PARTY_NOTICES.md` entry: not required / pending / section:

## Purpose and alternatives

- Exact consumer and capability:
- Why Firefox, browser, Node.js, or a small local module is insufficient:
- Alternatives considered:
- Why this package is the minimum reasonable scope:

## Execution lifecycle

Mark every phase in which the package or its transitive graph executes:

- [ ] dependency resolution/download
- [ ] preinstall/install/postinstall/prepare or another lifecycle hook
- [ ] local development server
- [ ] production build
- [ ] test/lint/typecheck
- [ ] generated privileged runtime
- [ ] installed Firefox startup/runtime

List every published lifecycle script, code generator, native executable, WebAssembly binary, platform package, and child process. A build-only dependency is still trusted code on the developer and CI hosts.

## Provenance and maintenance

- Registry owner/maintainer signals checked:
- Release/tag correspondence checked:
- Recent release and activity:
- Changelog and relevant source reviewed:
- Security advisories and open incidents checked:
- Provenance/signature/attestation information available:
- Copied code or required attribution:
- Source file/published source unit and project artifact paths:

Do not treat package popularity, an SPDX string alone, or a visible repository as proof that the published tarball and source revision correspond.

## Dependency graph and install behavior

- Direct dependency delta:
- Resolved transitive package and version delta from the lockfile:
- Duplicate/version-skew impact:
- Optional and peer dependencies:
- Lifecycle scripts anywhere in the resolved graph:
- Native binaries or remote binary download behavior:
- Network access beyond registry tarball retrieval:
- Environment variables, credentials, home/profile files, or caches read/written:
- Lockfile and package-manager settings used:
- Result of an `--ignore-scripts` comparison or equivalent:

The accepted record must use the resolved lockfile, not only `npm view` metadata. A preliminary review may defer installation, but it cannot approve the graph until these fields are completed.

## Runtime and artifact impact

- Bundled into system-principal runtime: yes / no
- Runtime imports and entry points:
- Bundle-size delta:
- New chunks, source maps, dynamic imports, workers, WebAssembly, or assets:
- Remote endpoint/runtime network scan result:
- HMR and development-code scan result:
- Bare-import and exact-inventory scan result:
- Content-accessible Chrome/resource exposure:
- Private-window or logging data flow:

## Update, recovery, and removal

- Version-range policy and update owner:
- Upgrade review and changelog procedure:
- Rollback command and last known-good version:
- Files/configuration generated outside the lockfile:
- Removal steps and code replacement cost:
- Proof that production artifacts no longer contain the dependency after removal:

## Decision

- Accepted scope and version:
- Conditions that must be completed before install or merge:
- Rejected capabilities or optional features:
- Follow-up issues:
- Residual risk:

Do not write “no known risk” without evidence. This review is a supply-chain control, not a formal audit of the dependency.
