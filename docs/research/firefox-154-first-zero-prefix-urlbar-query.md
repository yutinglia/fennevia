# Firefox 154 first zero-prefix Urlbar query follow-up

Date: 2026-08-26

## Scope and observed symptom

The project owner reported that the first opening of Fennevia's address panel
showed Firefox's empty-suggestions state, while closing and opening the same
panel again produced the expected suggestions. The current screenshot and
report concern an empty address field, which exercises Firefox's zero-prefix
Top Sites path. This follow-up was not reproduced in a fresh real-Firefox run,
so the exact startup race remains an inference rather than claimed runtime
proof.

The supported source pin remains Firefox 154.0 release commit
`032a9fc1ac0cc3209f7c142744ba2e40847c8086`.

## Current upstream behavior checked

- [`UrlbarProvidersManager.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/urlbar/UrlbarProvidersManager.sys.mjs)
  initializes Firefox search and region services, runs the registered provider
  set, publishes incremental batches through `controller.receiveResults()`, and
  resolves only after the active providers finish.
- [`UrlbarProviderTopSites.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/urlbar/UrlbarProviderTopSites.sys.mjs)
  is active only for an unrestricted empty search string and obtains its rows
  from `TopSites.getSites()`.
- [`TopSites.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/topsites/TopSites.sys.mjs)
  starts with an empty private site list and initializes it lazily on the first
  `getSites()`. Its `refresh()` returns early when another refresh is already in
  progress. The owner-observed first-empty/second-populated sequence is
  consistent with a zero-prefix query overlapping that lazy startup refresh,
  but Browser Console/Toolbox evidence would be required to prove that exact
  ordering.

No Firefox, loader, or derivative source was copied or adapted. These files are
compatibility evidence only.

## Minimum Fennevia change

The existing per-window suggestions bridge now permits exactly one warm-up
retry when all of the following are true:

1. the query is a zero-prefix query;
2. it is the first eligible zero-prefix query in this bridge lifetime;
3. Firefox's manager has completed it;
4. no projected result arrived; and
5. the context is still current rather than replaced, canceled, handed off, or
   disposed.

The retry uses the same native `gURLBar.startQuery()` context builder, existing
shared manager, provider set, ranking, result projection, and cancellation
contract. It publishes no intermediate empty state. The retry itself is not
eligible for another retry, so a genuinely empty profile settles as empty after
two bounded attempts. A successful first attempt marks warm-up complete and is
not repeated. Non-empty user text is never retried by this rule.

This adds no timer, startup/background query, observer, provider, engine,
endpoint, network request, preference, persistence, log field, or frontend data
shape. Query text still does not cross the bridge or enter diagnostics.

## Rejected alternatives

1. An arbitrary delay before the first query: timing-dependent and makes every
   healthy first open slower.
2. A hidden startup query: reads Firefox suggestion state before a user opens
   the panel and retains unnecessary background work.
3. A new Top Sites import or observer: expands the privileged compatibility and
   cleanup surface when the existing manager can safely repeat its own bounded
   zero-prefix contract.
4. Retrying non-empty queries: could duplicate Firefox-owned remote suggestion
   work and is unrelated to the reported Top Sites symptom.
5. Hiding every empty state: would make a genuinely empty result set
   indistinguishable from loading and weaken no-results feedback.

## Verification

- `tests/firefox-urlbar-suggestions.test.mjs` proves first-empty/second-result,
  genuine-empty bounded retry, existing replacement/cancellation behavior, and
  privacy-safe failure paths.
- The focused bridge plus popup suite passes 21/21; Svelte/TypeScript reports
  zero diagnostics and focused ESLint reports zero errors.
- The complete `npm run verify` gate passes 424/424 Node tests with 88.44% line,
  80.87% branch, and 95.62% function coverage, every fixed PowerShell 7 suite,
  dependency audit, deterministic frontend/bridge builds, and 14/14 accepted
  production artifacts. The fixed-list suite also passes under Windows
  PowerShell 5.1.
- The regenerated bridge contains the bounded retry guard, its manifest hash
  matches the generated file, and the generated shell omits the removed
  capability-badge markup and explanatory copy.
- The updated real Firefox 154 first-open zero-prefix probe is `not run`.
