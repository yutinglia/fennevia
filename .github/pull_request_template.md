## Linked issue

Closes #

## Summary

## Explicit non-goals

## Environment

- Firefox version:
- Firefox build ID:
- Channel:
- Operating system:
- Profile: clean development / existing development
- Project commit tested:

## Research and evidence

- Alice0775 reference:
- fx-autoconfig reference:
- xiaoxiaoflood reference:
- aminomancer reference:
- Searchfox path/revision:
- Official Firefox commit or Bugzilla:
- Upstream change identified:
- Loader-specific baggage excluded:

Use `not applicable` only when the change does not depend on Firefox internals.

## Architecture effects

- Firefox internal dependencies added or changed:
- Bridge boundary effects:
- DOM ownership effects:
- Exact Chrome/resource manifest lines and mapped file inventory:
- Ordinary-web-content accessibility result:
- Override introduced: yes / no

## Security and privacy

- Security-review triggers: none / linked issue or review
- Data classifications and normal log fields added or changed:
- Private-window state, persistence, and fallback effects:
- Dependency review record and exact lockfile delta:
- Lifecycle scripts, native binaries, code generation, and install-time network effects:
- Production artifact inventory and scanner result:
- Installer targets, ownership manifest, dry run, rollback, and deletion effects:
- [ ] No runtime remote executable dependency was added.
- [ ] Normal logging uses allowlisted fields and remains free of complete URLs, titles, queries, local/profile paths, and private-window browsing data.
- [ ] Resource accessibility, `resource:` exposure, and source-map/debug-file placement were reviewed.
- [ ] Every dependency addition or upgrade has a linked review covering purpose, license, lifecycle, transitive graph, network behavior, and removal.
- [ ] Installer or deletion scope was reviewed with preflight and rollback evidence, or is precisely not applicable.
- [ ] Private-window data remains per-window and non-persistent, or complete native fallback is documented.
- [ ] Native security-sensitive UI remains available, or a dedicated review is linked.
- [ ] Any triggered dedicated security review is linked before implementation.

## Validation

| Check | Status | Evidence |
|---|---|---|
| Format / lint | not run | |
| Typecheck | not run | |
| Unit tests | not run | |
| Production build | not run | |
| Exact production artifact inventory / security scan | not run | |
| Chrome/resource ordinary-content access | not run | |
| Clean cold start | not run | |
| Second normal window | not run | |
| Private window or complete fallback | not run | |
| Cleanup / disposal | not run | |
| Failure injection / fail-open recovery | not run | |
| Installer unsafe-target / rollback | not run | |
| Native security UI reachability | not run | |
| Browser Console regression check | not run | |

Allowed status values: `pass`, `fail`, `blocked`, `not run`, `not applicable`.

## Documentation changed

- [ ] `AGENTS.md`, if agent rules changed
- [ ] Relevant plan
- [ ] `docs/architecture.md`
- [ ] `docs/architecture-decisions.md`
- [ ] `docs/firefox-internals-map.md`
- [ ] `docs/testing-and-recovery.md`
- [ ] `docs/security-and-privacy.md`
- [ ] `docs/security-controls.md`
- [ ] Dependency review under `docs/dependency-reviews/`, if applicable
- [ ] No documentation change required, with explanation below

## Known limitations and follow-up issues

## Reviewer focus

