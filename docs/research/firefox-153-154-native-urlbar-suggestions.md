<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 153/154 native Urlbar suggestions and providers research

## Environment

- Date: 2026-08-22
- Runtime validation: Firefox 154.0 release, BuildID `20260812182057`, Windows
  x64, marker-owned `fennevia-dev` profile and stock-Firefox program copy
- Other supported source baseline: Firefox 153.0.4 release, BuildID
  `20260810162159`
- Project base commit: `ea24c7593d24a2a613bf0be32c5daeb81005bde9`
- Working branch: `codex/search-suggestions`
- Firefox 154 source: `FIREFOX_154_0_RELEASE` at
  [`032a9fc1ac0cc3209f7c142744ba2e40847c8086`](https://github.com/mozilla-firefox/firefox/commit/032a9fc1ac0cc3209f7c142744ba2e40847c8086)
- Firefox 153.0.4 source: `FIREFOX_153_0_4_RELEASE` at
  [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)

The query-contract probe below validates only Firefox 154.0 on this Windows
profile. It does not establish complete provider, interaction, accessibility,
second-window, private-window, or release-matrix coverage, and makes no Linux,
macOS, ESR, Beta, or Nightly support claim.

## Goal and owner refinement

The owner first requested Firefox search suggestions in the centered address
panel, explicitly preferring Firefox's built-in suggestions over a new
suggestion engine. The owner then expanded the request to the complete current
Urlbar suggestion/provider experience. The required ownership split is:

- Firefox constructs query contexts, activates providers, applies preferences
  and private policy, ranks and muxes results, owns search engines, and executes
  accepted results;
- Fennevia renders only a bounded text-row projection in its existing owned
  address overlay and retains native results behind per-window opaque tokens;
- Fennevia makes no suggestion network request and creates no search engine,
  Urlbar provider, ranking policy, or destination policy;
- a result that depends on native rich row DOM or unsupported semantics opens
  the complete retained native Urlbar instead of becoming a dead or guessed
  action.

This explicitly extends the earlier ADR-031 native-only rendering decision.
Provider names, raw payload objects, native controllers, browser objects, and
result URLs remain outside frontend state.

## First causal evidence

The first design attached a listener to the existing `gURLBar.controller` and
called `gURLBar.startQuery()`. Firefox did publish query results, but
`UrlbarView.onQueryResults()` also opened the native Urlbar view even while the
Fennevia input owned focus. Calling `view.close()` to suppress that native view
canceled the active provider query. This makes a direct-listener design
incompatible with an independent owned result list.

Constructing another `UrlbarParentController` was also rejected. The Firefox
154 constructor owns a `UrlbarPrefs` observer and exposes no matching public
destroy/uninit lifetime. A second parent would therefore create ownership and
cleanup that Fennevia cannot prove.

The minimum successful contract uses the existing input, child/parent
controllers, and the parent's existing shared `ProvidersManager`:

1. Resolve `gURLBar.controller`, its `parentController` (or the controller
   itself on the compatible shape), and `parentController.manager`.
2. Synchronously replace only `gURLBar.controller` with a proxy and call the
   existing `gURLBar.startQuery()`. Firefox still runs the input's private
   query-context builder and updates its private query state.
3. The proxy redirects `startQuery(context)` to the existing manager with a
   second proxy of the native parent controller. That proxy overrides only
   `receiveResults` and `view`; every other value and method is forwarded and
   native methods are bound to their native owner.
4. Restore the exact original `gURLBar.controller` identity on both success and
   throw paths before asynchronous provider work continues.
5. Cancel the exact context through `manager.cancelQuery(context)` on
   replacement, close, handoff, failure, or disposal.

The manager therefore sees the same native query context and controller-owned
window access used by Firefox providers, while the native view receives no
query-result callback and builds no row.

## Current Firefox source checked

All Firefox 154 links below resolve from the exact release pin.

- [`UrlbarInput.mjs`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/urlbar/content/UrlbarInput.mjs):
  `startQuery()` calls the private query-context builder, updates the input's
  search state, then delegates to `this.controller.startQuery(context)`.
  `pickResult(result, event, element, browser)` remains the native execution
  entry for URL, search, keyword, switch-tab, omnibox, remote-tab, and related
  results; `element` is optional for ordinary text-row results.
- [`UrlbarChildController.mjs`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/urlbar/content/UrlbarChildController.mjs)
  and
  [`UrlbarParentControllerProxy.mjs`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/urlbar/content/UrlbarParentControllerProxy.mjs):
  establish the current input/controller split and parent-controller access.
- [`UrlbarParentController.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/urlbar/UrlbarParentController.sys.mjs):
  owns the shared manager and query cleanup, exposes `browserWindow`, and owns
  observer lifetime that rules out a project-created parent controller.
- [`UrlbarProvidersManager.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/urlbar/UrlbarProvidersManager.sys.mjs):
  selects registered providers and sources, tokenizes, starts provider queries,
  muxes/ranks results, publishes incremental batches through
  `controller.receiveResults(context)`, and cancels by exact context.
- [`UrlbarView.mjs`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/urlbar/content/UrlbarView.mjs):
  confirms why sending project queries through the retained native listener
  cannot keep the native view closed.
- [`UrlbarResult.mjs`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/urlbar/content/UrlbarResult.mjs):
  provides result type/source, heuristic and payload state, the computed icon,
  and bounded display-value/highlight preparation. Fennevia does not call
  `toString()` or serialize the payload.
- [`UrlbarProviderSearchSuggestions.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/urlbar/UrlbarProviderSearchSuggestions.sys.mjs):
  uses the controller's owning browser window and Firefox search-suggestion
  policy. Forwarding the native parent controller preserves that owner.

The corresponding Firefox 153.0.4 files were checked for the same minimum
input/controller/manager/result contracts. Runtime guards, not TypeScript
declarations, remain authoritative on every managed window.

## Search, private-window, and execution ownership

Firefox's query context carries the owning window's private state, selected
container/tab-group/current-page context, search mode and allowed sources.
Firefox's current suggestion preferences, including ordinary and private
remote-suggestion enablement and per-query remote-result prohibition, remain
unchanged. Fennevia neither reads them to recreate policy nor overrides them.

For an accepted ordinary result, Fennevia retrieves the retained native result
by its opaque current-query token and calls the same window's
`gURLBar.pickResult()`. A narrow synthetic keyboard or pointer event conveys
only the bounded activation gesture/disposition; it does not reconstruct a
payload or navigation target. The synchronous controller proxy is also applied
around `pickResult()` so a Firefox-owned search-mode transition can start its
follow-up query in the owned list without opening the native view.

Tip, dynamic, row-span, and any other result whose behavior requires native row
content or cannot be represented faithfully by an ordinary bounded text row is
classified `native`. Activating it preserves the draft, closes Fennevia's
overlay, reveals and focuses the retained native Urlbar, and starts its native
query path. Unknown type/source values receive the same conservative treatment.

## Data boundary and security effects

- The owner request is explicit approval for bounded suggestion/result text and
  source-validated icon references to enter only the owning window's frontend
  memory and project-owned text/image properties while the popup is active.
- Only closed type/source enums, bounded title/description strings, a validated
  local Firefox/extension/data-image icon reference, heuristic state,
  direct/native execution class, and an opaque action token cross the bridge.
- Raw payloads, provider names, URLs used as navigation authority, engine
  objects, native events, principals, controllers, windows, browser objects,
  result instances, and private-window state do not cross.
- Query/result text and tokens never enter logs, errors, diagnostics, datasets,
  CSS variables, preferences, disk, clipboard, telemetry added by Fennevia, or
  project network traffic. Errors contain fixed code/phase/symbol and existing
  Firefox version/build/window-kind context only.
- Close, tab switch, native handoff, failure, and disposal clear projected
  result text/icons, tokens, retained native results, and active context state.
  The existing popup draft is retained only while editing or for raw/native
  fallback; ordinary close/disposal reverts the native input.
- No content-accessible mapping, dependency, override, remote resource, search
  engine, provider registration, or copied Firefox/canary code is introduced.

Firefox source is used only as a factual compatibility reference. No Firefox,
loader, canary, or derivative implementation is copied or adapted, so this
change adds no entry to `THIRD_PARTY_NOTICES.md`.

## Compatibility canaries

The heads checked on 2026-08-22 were:

- [`alice0775/userChrome.js@df95b65f`](https://github.com/alice0775/userChrome.js/commit/df95b65f)
- [`MrOtherGuy/fx-autoconfig@dfdab568`](https://github.com/MrOtherGuy/fx-autoconfig/commit/dfdab5684faffc112b76ccb1d8cab7f75da0102c)
- [`xiaoxiaoflood/firefox-scripts@a898ac59`](https://github.com/xiaoxiaoflood/firefox-scripts/commit/a898ac59fb0ca3886c0c46b184fdbc037c83c037)
- [`aminomancer/uc.css.js@88514013`](https://github.com/aminomancer/uc.css.js/commit/88514013ddc375f4770f4a35d8d07a91d6dd7d8f)

The aminomancer compatibility discussion records the Firefox 147 Urlbar
controller split/refactor as an update hazard and reinforces delayed-startup
resolution of the current window's live owners. The canaries add no supported
API contract, and no code, selectors, globals, timing values, or loader
behavior was copied.

## Runtime probe and observed result

The focused Marionette mode is:

```powershell
$firefox = Join-Path $env:LOCALAPPDATA 'fennevia\program-spikes\firefox-stable-copy\firefox.exe'
$profile = Join-Path $env:LOCALAPPDATA 'fennevia\profiles\fennevia-dev'
node .\tests\firefox-window-lifecycle.mjs --firefox $firefox --profile $profile --urlbar-provider-probe
```

Observed privacy-safe evidence:

```json
{
  "batchCount": 1,
  "controllerRestored": true,
  "lifecycle": ["started", "results", "finished"],
  "maximumResultCount": 1,
  "maximumRowCount": 0,
  "nativeViewClosed": true,
  "resultSourceCount": 1,
  "resultTypeCount": 1,
  "rowBackedResultCount": 0,
  "selectableRowCount": 0,
  "valueWasSet": true
}
```

Firefox shut down cleanly and the post-probe Browser Console evidence contained
no first-party script error. The profile returned only its heuristic result for
the synthetic test text; that is expected evidence that the project respects
the profile's current provider/settings state, not proof that every provider
class has been exercised.

The production bridge and panel mode is:

```powershell
node .\tests\firefox-window-lifecycle.mjs --firefox $firefox --profile $profile --urlbar-suggestions-probe
```

It opens the healthy project popup, queries the fixed internal target
`about:preferences`, waits for the projected listbox, selects the first direct
result with Arrow Down, and executes it with Enter. Its shared output contains
only fixed enums, counts, and booleans:

```json
{
  "activeDescendantLinked": true,
  "ariaAutocompleteList": true,
  "comboboxRole": true,
  "controllerRestoredAfterExecution": true,
  "controllerRestoredBeforeExecution": true,
  "directResultCount": 1,
  "internalPageCommitted": true,
  "listboxRole": true,
  "nativeResultCount": 0,
  "nativeRowCountBeforeExecution": 0,
  "nativeViewClosedAfterExecution": true,
  "nativeViewClosedBeforeExecution": true,
  "optionCount": 1,
  "popupClosed": true,
  "sourceKindCount": 1
}
```

This second Firefox 154.0 run also shut down cleanly and recorded no first-party
script error. It proves the built production artifacts use the selected native
provider/result path for one ordinary result; it does not claim that every
provider, search setting, private-window policy, or rich result was exercised.

### Final artifact rerun and incremental-selection finding

The final installed artifact set used these generated hashes:

- `BridgeBoundary.sys.mjs`:
  `f155b753a6eb483a84b6d93ee1ed48b95824e11b5290cbf0dd1d40cb48e60ad6`;
- `ShellApp.js`:
  `aaa6aa58ae81d7e05ce2fc13e6133aaad846978e846be2384031a0483a8cd17b`.

The first production-panel rerun against those changes stopped with the fixed
privacy-safe code `FENNEVIA_FIREFOX_TEST_URLBAR_SUGGESTIONS_SELECTION_TIMEOUT`.
A later provider batch for the same query revision had reset the active index
after Arrow Down and replaced the keyed option node. The implementation now
preserves a bounded active index for same-revision result batches, resets it for
new-query or non-result states, and leaves modified text-selection keys alone.
The harness now checks the current keyed option rather than a detached node. A
rebuilt, exact-installer-updated `ShellApp.js` then produced the passing evidence
above with no first-party script error.

The final ordinary gate passed 316 Node tests with 87.45% line and 95.10%
function coverage, every fixed PowerShell suite under PowerShell 7 and Windows
PowerShell 5.1, deterministic builds, dependency audit, and all 14 production
artifact checks.

## Options rejected

1. A Fennevia suggestion endpoint, search engine, provider, or independently
   ranked history/bookmark model: duplicates Firefox policy and creates a new
   browsing-data network or storage owner.
2. A listener on the existing controller: opens the native view; suppressing
   that view cancels the query.
3. A new parent controller or manager: introduces Firefox-owned observer and
   provider lifecycle without a proven teardown and risks divergent state.
4. Hidden native Urlbar rows, native DOM reparenting, or a second invisible
   `moz-urlbar`: violates native ownership and creates focus/command ambiguity.
5. Arbitrary payload serialization or result URLs as frontend commands: expands
   sensitive data exposure and duplicates execution semantics.
6. Rebuilding tip/dynamic/one-off rich UI from payload guesses: silently loses
   current Firefox semantics. Complete native handoff is explicit instead.

## Remaining validation

Focused bridge/state/UI tests and the Firefox 154 production-panel probe are
recorded. Firefox 153 runtime validation, representative provider classes,
remote-suggestion setting combinations, rich results, one-offs, rapid real
replacement/close, second/private windows, pointer and assistive-technology
checks, layout/accessibility environments, Browser Toolbox ownership, failure
injection, and the release matrix remain `not run`. Neither focused probe
substitutes for those rows.
