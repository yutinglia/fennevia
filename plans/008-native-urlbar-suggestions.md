# Native Firefox Urlbar suggestions and providers

## Status

- Owner request: implement the complete Firefox Urlbar suggestions/provider
  experience in the Fennevia address/search panel.
- Working branch: `codex/search-suggestions`.
- Current phase: focused implementation, ordinary development gate, and Firefox
  154 contract/panel probes complete; the broader manual matrix remains.
- Validation baseline: Firefox 154.0 BuildID `20260812182057` on Windows x64;
  Firefox 153.0.4 remains the other tested prerelease baseline.
- Real-Firefox validation: Firefox 154.0 query-contract and production-panel
  direct-result probes passed; the representative-provider, private-window,
  accessibility, and release interaction matrices remain not run.

This file is the progress checklist and normative implementation plan for this
work. Check an item only after the named evidence exists. Do not treat an
unchecked real-Firefox row as covered by unit tests or an older milestone.

## 1. Owner intent and bounded scope

Fennevia's centered address/search panel must present and execute the results
produced by Firefox's current Urlbar provider pipeline. This includes enabled
Firefox providers such as search suggestions, history, bookmarks, open tabs,
autofill, actions, and other current built-in result sources. Firefox remains
the query, ranking, provider-policy, search-engine, telemetry, destination,
principal, and action owner.

The implementation must not:

- create a Fennevia search-suggestion engine or contact a suggestion endpoint;
- duplicate Firefox ranking, deduplication, autofill, URL fixup, keyword,
  search-engine, private-window, or result-execution policy;
- import or adapt a third-party Urlbar implementation;
- move, clone, or mount Firefox-owned Urlbar DOM in a project host;
- expose native result, query, provider, controller, browser, principal, event,
  or window objects to `src/app/` or Svelte;
- log, persist, diagnose, or place in datasets/CSS variables any query, URL,
  title, suggestion, history entry, provider payload, extension identity, or
  private-window browsing state;
- weaken the complete native Urlbar handoff or fail-open path.

Search modes and one-off engines are in scope where they are necessary to
operate the complete current provider experience. Their exact custom UI and
native fallback must be selected from Firefox 154 source/runtime evidence,
not assumed from older Urlbar behavior.

## 2. Definition of done

- [x] The panel queries Firefox's current Urlbar provider manager/controller;
      no project network request or independent suggestion provider exists.
- [x] Every enabled Firefox result returned through the selected query contract
      is either rendered and executable through an opaque action token or
      causes an explicit native-Urlbar fallback; no silent dead result exists.
- [x] Directly representable result selection delegates to Firefox's current
      `pickResult()` path; rich, dynamic, tip, restrict, AI, and unknown rows
      delegate to the complete native Urlbar instead of cloning their semantics.
- [x] Empty, late, canceled, malformed, unsupported, and thrown query/result
      states are bounded, deterministic, and fail open.
- [x] The per-window design and focused tests isolate normal/private query state,
      result registries, subscriptions, cancellation, and cleanup. The real
      second-normal/private-window matrix remains tracked separately below.
- [x] The address input and result list form one accessible combobox with
      visible focus, deterministic active-descendant behavior, pointer support,
      full keyboard operation, status announcements, and Escape restoration.
- [x] Existing native `openLocation()` handoff remains complete and available.
- [x] Security, internals, testing, architecture, roadmap, and current-status
      documents describe the new data flow and remaining compatibility risk.
- [x] Focused tests and `npm run verify` pass; real-Firefox rows are recorded
      honestly as passed, blocked, or not run.

## 3. Required research checklist

### 3.1 Repository and decision context

- [x] Read root `AGENTS.md`.
- [x] Read `plans/000-master-plan.md`.
- [x] Read `plans/002-shell-roadmap.md`.
- [x] Read `docs/research/firefox-153-address-popup.md`.
- [x] Finish reading `docs/security-and-privacy.md` before implementation.
- [x] Read ADR-028 and ADR-031 completely. The new ADR must narrowly supersede
      ADR-031's ban on provider results crossing the bridge and its native-only
      ownership of suggestion rendering, while retaining ADR-028's native
      submission, focus fallback, and owned-overlay contracts.
- [x] Read the relevant address, Urlbar, bridge, active-mode, and cleanup
      sections of `docs/firefox-internals-map.md`,
      `docs/testing-and-recovery.md`, and `docs/architecture.md`.
- [x] Inspect the current address popup, navigation bridge, boundary,
      lifecycle, locale, styling, and focused tests.
- [x] Inspect the most recent relevant project commits.
- [x] Check for an existing open GitHub issue; none matched on 2026-08-22.

### 3.2 Firefox 154 source and runtime evidence

- [x] Record the exact Firefox 154 release tag/commit and source paths used:
      `FIREFOX_154_0_RELEASE` / `032a9fc1ac0cc3209f7c142744ba2e40847c8086`.
- [x] Inspect `UrlbarController`, `UrlbarProvidersManager`, `UrlbarQueryContext`,
      `UrlbarResult`, `UrlbarInput`, and `UrlbarView` in current official source.
- [x] Identify the supported query start, incremental-result, completion,
      cancellation, and listener cleanup sequence.
- [x] Identify the exact current result-pick/command path and required native
      event/disposition inputs.
- [x] Inventory current result `type`, `source`, payload, heuristic, suggested
      index, row-span/dynamic, autofill, and provider-name behavior.
- [x] Determine how current search modes and one-off engines affect query
      context and result execution.
- [x] Verify private-window remote-suggestion policy remains wholly Firefox
      owned and that Fennevia adds no override.
- [x] Verify whether using the existing `gURLBar.controller` would interfere
      with its native view; prefer a per-window project controller only if the
      current constructor/manager contract supports it.
- [x] Reproduce the chosen contract in the clean development profile and inspect
      Browser Console before production implementation. The Firefox 154.0
      BuildID `20260812182057` Marionette probe used the selected shared-manager
      path, restored the native input controller by identity, produced a
      provider result batch, opened no native row, and emitted no first-party
      console error. Browser Toolbox inspection remains part of the full manual
      matrix.
- [x] Check all four current compatibility canaries and record heads/relevant
      Urlbar adaptations; copy no canary code.

### 3.3 Architecture decision

- [x] Add a new ADR recording the owner-approved bounded exposure of rendered
      Urlbar result text/icon data to per-window frontend memory.
- [x] Record the exact Firefox-owned query and result-execution path.
- [x] Record rejected options: custom suggestion endpoint, provider clone,
      native DOM reparenting, arbitrary payload serialization, and direct
      navigation from frontend data.
- [x] Define fail-open behavior for missing symbols, source drift, unsupported
      results, query exceptions, result-pick exceptions, and cleanup failures.

## 4. Target architecture checklist

Firefox 153.0.4 and 154.0 source plus the Firefox 154 runtime probe establish
the minimum design below.

### 4.1 Privileged Firefox boundary

- [x] Add a focused `src/firefox/urlbar-suggestions/` feature with a stable
      top-level facade, following ADR-053 module boundaries.
- [x] Resolve the existing child controller, its parent controller, and that
      parent's shared `ProvidersManager`; do not construct or register a new
      provider, engine, parent controller, or native view.
- [x] Start queries through that window's existing `gURLBar.startQuery()` while
      synchronously replacing only `gURLBar.controller` with a narrow proxy.
      This preserves Firefox's private `UrlbarQueryContext` construction and
      input state while redirecting the resulting context to the shared manager
      without notifying or opening the retained native view.
- [x] Restore the exact native `gURLBar.controller` identity through guarded
      success/throw cleanup before asynchronous provider work can continue;
      never retain the input proxy between synchronous native calls.
- [x] Proxy the existing parent controller only for the manager callback,
      overriding `receiveResults` and `view` while binding all other properties
      and methods to the native controller. This preserves provider access to
      the owning browser window and native policy without exporting it.
- [x] Keep at most one active query per window and cancel it before replacement,
      popup close, selected-tab change, failure, or disposal.
- [x] Use monotonically increasing local query revisions so late callbacks
      cannot overwrite current results.
- [x] Bound input length, result count, per-field text, icon strings, and
      collection depth before publishing an immutable snapshot.
- [x] Map native result/source values to closed public enums plus a conservative
      `unknown` value; do not export provider names or arbitrary payload keys.
- [x] Give each current result a context-bound opaque action token; reject
      malformed, stale, removed, foreign-window, and foreign-query tokens.
- [x] Execute only the retained native result associated with that token via the
      window's existing `gURLBar.pickResult()` path. Wrap that synchronous call
      in the same input-controller proxy so Firefox-owned search-mode follow-up
      queries remain in the project view instead of opening the native view.
- [x] Keep native errors privacy-safe: fixed phase/code/symbol/version/build and
      window kind only.
- [x] Cancel the exact active context through the shared manager and dispose the
      registry, subscriptions, and pending callbacks exactly once. Never dispose
      or mutate lifetime ownership of the shared manager or native controllers.

### 4.2 Ordinary application state

- [x] Add immutable query states: `idle`, `querying`, `results`, `empty`, and
      `failed`, with a revision and fixed capability state.
- [x] Copy only allowlisted primitive result presentation fields.
- [x] Preserve the user's draft while results update; never overwrite it with a
      late result or background navigation.
- [x] Reset active selection predictably when results are replaced.
- [x] Keep selection inside bounds across same-query incremental batches; every
      projected row is actionable, with unsupported rich rows using native
      handoff instead of a dead/non-selectable row.
- [x] Make Enter execute the selected native result; with no selection, retain
      the existing Firefox-owned raw submission path.
- [x] Ensure query failure leaves raw submission and native handoff usable.

### 4.3 Svelte address/search panel

- [x] Use the existing address-overlay root and popup coordinator; create no new
      root, edge trigger, hide timer, z-index system, or global listener owner.
- [x] Implement the input/list as an ARIA combobox/listbox with stable option
      IDs, `aria-expanded`, `aria-controls`, `aria-activedescendant`, and
      selected state.
- [x] Support Arrow Up/Down, Home/End, Page Up/Down where useful, Enter, Escape,
      pointer hover/click, and deterministic focus restoration.
- [x] Do not reinterpret Tab as a custom autofill/one-off command; retain normal
      panel focus behavior and native handoff for Firefox's complete Tab,
      one-off, and rich search-mode semantics.
- [x] Announce result count, loading, no-results, and unavailable states through
      one polite live region without moving focus.
- [x] Show fixed source/action affordances without relying on color alone.
- [x] Render user-derived strings only through Svelte text interpolation; no
      HTML injection or user-derived CSS.
- [x] Allow only source-validated local/Firefox/extension icon schemes needed
      by current results, with a generic project-owned fallback.
- [x] Reuse existing glass, color, spacing, focus, reduced-motion,
      reduced-transparency, and forced-colors tokens.
- [x] Keep the panel usable at narrow/short sizes with a bounded scroll region
      that follows keyboard selection, and no permanent browser-content
      geometry.

## 5. Privacy and security checklist

- [x] Document why result text must enter frontend memory to render the requested
      UI and record explicit owner approval in the new ADR.
- [x] Limit result data to the owning window's memory and project-owned text/
      image properties while the popup/query is active.
- [x] Clear results, action tokens, selected index, and icon references on close,
      tab switch, failure, fallback, and disposal. Revert native query text on
      ordinary close/disposal; preserve the draft only while editing or for an
      explicit raw-submit/native-handoff fallback.
- [x] Add no preference, disk, telemetry, analytics, clipboard, diagnostic, or
      project network sink.
- [x] Assert that logs/errors never contain query/result strings, URLs, titles,
      provider payloads, engine names derived from user state, or tokens.
- [x] Do not expose raw URLs to Svelte merely to navigate; opaque native action
      tokens own execution.
- [x] Source-validate icon schemes and bound icon URL length before setting an
      element property; never interpolate an icon URL into CSS.
- [x] Preserve Firefox's own private-search-suggestion and remote-result prefs,
      policies, filtering, and search-mode behavior.
- [x] Treat unknown result types/sources/payloads conservatively and keep the
      native handoff available.
- [x] Confirm no new content-accessible resource, dependency, runtime endpoint,
      dynamic code loading, override, or native-hide selector is introduced.

## 6. Test checklist

### 6.1 Unit and static tests

- [x] Capability validation and privacy-safe missing-symbol failures.
- [x] Per-window query-context forwarding, selected-browser ownership, and
      normal/private result-registry isolation.
- [x] Incremental result publication, ordering, bounds, unknown mapping, and
      immutable snapshots.
- [x] Query replacement/cancellation and rejection of late callbacks.
- [x] Opaque token format plus stale, foreign-window, foreign-query, removed,
      malformed, and duplicate execution rejection.
- [x] Closed classification for every Firefox-153/154 result type/source,
      direct `pickResult()` execution, search-mode continuation, and explicit
      rich/unknown native handoff.
- [x] Query/start/result/execute exception handling and raw-submit/native-handoff
      fallback.
- [x] Popup open/input/close/tab-switch/navigation/disposal state transitions.
- [x] Keyboard selection, active descendant, pointer selection, Enter/Escape,
      empty/loading/error announcement, and focus restoration behavior.
- [x] Launcher-origin cancel, backdrop, and focus-boundary close return focus
      to selected content and release the left focus hold; `Ctrl+L` from a
      valid non-launcher origin retains the prior-origin restoration path.
- [x] Result text/icon rendering uses properties/text interpolation only.
- [x] Boundary tests reject Firefox imports/globals from app/Svelte modules.
- [x] Source/static privacy tests reject provider payload logging, persistence,
      arbitrary serialization, and project network calls.
- [x] Generated bridge/frontend artifacts remain deterministic and scanned.

### 6.2 Local ordinary development gate

- [x] Run focused Node tests while iterating (20 focused tests pass after final
      cleanup and input-selection hardening).
- [x] Run formatting, lint, and typecheck for affected files.
- [x] Run `npm run verify`: 317/317 Node tests, 87.45% line coverage, 95.10%
      function coverage, all PowerShell 7 suites, deterministic build, dependency
      audit, and 14/14 production-artifact checks passed.
- [x] Run the Windows PowerShell 5.1 fixed-list static suite; all listed suites
      pass.
- [x] Inspect the generated diff and package manifest; generated artifacts came
      only from `npm run build` and match the 16-file package inventory.

### 6.3 Real Firefox matrix

- [x] Firefox 154 shared-manager query-contract probe: provider batch received,
      exact controller restored, native view closed, zero native result rows.
- [x] Firefox 154 production-panel probe: ARIA combobox/listbox linked,
      `about:preferences` direct result selected with Arrow Down/Enter through
      Firefox `pickResult()`, popup closed, controller restored, native view
      stayed closed.
- [ ] Clean normal window: local URL, host-like input, and ordinary search.
- [ ] Search suggestions enabled/disabled and remote suggestions allowed/denied
      according to Firefox settings.
- [ ] History, bookmark, open-tab/switch-tab, autofill, keyword, action, and
      any Firefox-154-specific enabled providers.
- [ ] Search modes and one-off engines selected, changed, and exited.
- [ ] Keyboard-only and pointer operation, screen-reader semantics where the
      environment permits, Escape, focus restoration, and native handoff.
- [ ] Rapid typing, incremental updates, query replacement, popup close during
      query, tab switch, navigation, window close, and runtime disposal.
- [ ] Normal, second-normal, and private-window isolation.
- [ ] Narrow, short, maximized, restored, high-DPI, reduced-motion,
      forced-colors, and transparency fallback layouts.
- [ ] Browser fullscreen, DOM fullscreen, customize mode, native prompts,
      Browser Toolbox, emergency fallback, and safe start.
- [ ] Missing/renamed controller, manager, query-context, result, and execution
      capabilities all restore or retain usable native Firefox UI.
- [x] The two focused Firefox 154 probes contain no new unhandled first-party
      exception and their shared evidence contains no browsing-derived text.
- [ ] Repeat the Browser Console/privacy check across the full matrix above.

## 7. Documentation synchronization checklist

- [x] Add the new ADR to `docs/architecture-decisions.md`.
- [x] Update current architecture/data-flow descriptions in
      `docs/architecture.md` and `docs/technical-overview.md`.
- [x] Update Firefox symbols, source pins, payload assumptions, and cleanup in
      `docs/firefox-internals-map.md`.
- [x] Update privileged user-derived data and logging rules in
      `docs/security-and-privacy.md` and operational checks if needed.
- [x] Add focused and real-Firefox rows to `docs/testing-and-recovery.md`.
- [x] Update `plans/000-master-plan.md` and `plans/002-shell-roadmap.md` so this
      work is no longer described as wholly deferred.
- [x] Update `docs/current-status.md` and both READMEs. No matching issue exists,
      so no issue status or external GitHub state was changed.
- [x] Add a dated historical research record after source/runtime research;
      do not rewrite the Firefox 153 address-popup record.

## 8. Evidence answers and remaining manual validation

- The selected path is the existing input's private query-context builder plus
  the existing parent controller's shared `ProvidersManager`, reached through
  synchronous, identity-restored proxies. A direct listener was rejected because
  `UrlbarView.onQueryResults()` opens the native view, while closing that view
  cancels the provider query. Constructing a parent controller was rejected
  because it owns preference-observer lifetime with no matching public teardown.
- `gURLBar.pickResult(result, event, null, browser)` remains the native execution
  path for text-row results. Dynamic, tip, and other rich row-dependent results
  receive an explicit complete-native-Urlbar handoff instead of reconstructed
  payload behavior.
- Presentation data is restricted to bounded, allowlisted strings exposed by
  `UrlbarResult`/documented payload fields. Raw payloads, provider names, native
  objects, and navigation URLs never cross the bridge; opaque tokens retain the
  native result for execution.
- Search-mode transitions initiated by `pickResult()` can reuse the same
  synchronous proxy. Complete one-off-engine and rich-result behavior still
  requires manual Firefox validation and falls back to the native Urlbar when a
  bounded text-row contract cannot represent it faithfully.
- Replacement, close, handoff, and disposal cancel the exact active context with
  `ProvidersManager.cancelQuery(context)`. Local query revisions reject late
  callbacks independently of provider completion timing.

The dated research record and ADR preserve the exact source pins, rejected
paths, probe command/evidence, and the remaining manual rows. The unchecked
real-Firefox rows above remain release/compatibility work, not silently inferred
coverage from the focused probes.

## 9. Compact address-popup UX follow-up (2026-08-22)

This follow-up changes only the project-owned presentation of the existing
trust, permission, Urlbar-coverage, and native-handoff controls. It does not
change the Firefox bridge, suggestion providers, result ranking, privileged
data flow, or native-panel ownership described above.

### 9.1 Layout and interaction checklist

- [x] Use the supplied screenshot only as current-state evidence; the explicit
      request is to place security/trust and permissions on one line and make
      the footer smaller.
- [x] Preserve separate semantic buttons, accessible names, disabled states,
      focus rings, DOM/tab order, and Firefox-owned trust/permission handoffs.
- [x] At ordinary popup widths, render site trust and site permissions as two
      equal columns in one compact status row.
- [x] At narrow window breakpoints, stack the two controls without
      horizontal overflow or reduced target size.
- [x] Keep active/blocked permission indicators inside the permission column
      and allow the indicator collection to wrap before labels shrink.
- [x] Reduce card padding and visual weight without removing the text labels,
      state icons/badges, hover/pressed feedback, or forced-colors treatment.
- [x] Render the Firefox-controls footer as one compact primary row containing
      a short explanation and the complete native-Urlbar handoff.
- [x] Omit the non-actionable “no page actions” second row; render a second row
      only when real Firefox Urlbar coverage items exist.
- [x] Preserve natural wrapping at the narrow breakpoint rather than clipping
      localized text or shrinking the native-access target below the shared
      32px desktop control height.

### 9.2 Verification checklist

- [x] Add focused source/UI assertions for the ordinary two-column status row,
      narrow one-column fallback, compact footer, retained handoffs, and the
      absence of the empty second footer row.
- [x] Run formatting plus the focused address-popup/Urlbar UI tests: 8/8 pass,
      with zero Svelte/TypeScript diagnostics and zero focused lint errors.
- [x] Build generated artifacts and inspect the source/generated diff; the
      frontend and bridge builds report deterministic output.
- [x] Run `npm run verify`: 317/317 Node tests, 87.45% line coverage,
      95.10% function coverage, all fixed PowerShell 7 suites, dependency
      audit, deterministic build, and 14/14 production-artifact checks pass.
- [x] Run the Windows PowerShell 5.1 fixed-list static suite; all listed suites
      pass.
- [x] Run the extended Firefox 154 production-panel layout probe. The 2026-08-23
      release-candidate run proved two computed status columns, same-row
      geometry, a 48.65px status row, a 32px native-access target, and a
      69.90px compact footer with two real Firefox Urlbar coverage items in its
      conditional second row. The wider provider/account-dependent rows in
      section 6.3 remain release-recorded as `not run` where they could not be
      reproduced safely.

## 10. Search-first address-popup simplification (2026-08-26)

This follow-up supersedes only the visual composition in section 9.1. The
Firefox bridge, provider/ranking behavior, result execution, security state,
permission state, native-panel ownership, and complete native-Urlbar handoff
remain unchanged.

### 10.1 Layout and interaction checklist

- [x] Keep one compact Fennevia identity row, with the wordmark visible in both
      ordinary and private windows.
- [x] Make the input and bounded suggestion list the primary visual hierarchy;
      retain the real input label for assistive technology without repeating it
      as visible instruction text.
- [x] Remove the decorative Enter glyph and visually hide routine idle/result
      status copy while keeping one polite live region. Loading, empty, failed,
      validation, and submission states remain visible.
- [x] Render suggestion source as subdued metadata and reserve bordered badges
      for meaningful best-match or native-handoff states.
- [x] Replace the separate Trust card, permission card, and explanatory footer
      with one ordered three-control utility strip: Site trust, Site
      permissions, and Open Firefox address bar.
- [x] Preserve full Trust/permission state in accessible names and titles;
      render active-sharing or blocked-permission indicators only when present.
- [x] Remove non-actionable Firefox Urlbar capability badges, including the
      bookmark-page badge. The complete native-Urlbar button remains the access
      path for bookmark, zoom, translation, extension, and other native actions.
- [x] Stack the utility controls at narrow breakpoints without reducing the
      shared 32px minimum native-access target or forced-colors support.

### 10.2 Verification checklist

- [x] Format the changed source and run the focused address-popup plus i18n
      tests: 6/6 pass; Svelte/TypeScript reports zero diagnostics.
- [x] Run the ordinary `npm run verify` gate and inspect generated artifacts:
      424/424 Node tests, 88.44% line coverage, 80.87% branch coverage, 95.62%
      function coverage, every fixed PowerShell 7 suite, dependency audit,
      deterministic builds, and 14/14 accepted production artifacts pass. The
      generated shell and manifest contain the compact utility strip and omit
      the removed capability-badge markup and copy.
- [x] Run the Windows PowerShell 5.1 fixed-list static suite; all listed suites
      pass.
- [ ] Run the updated Firefox 154 production-panel layout probe. Until then,
      current real-Firefox geometry is `not run`; section 9.2 retains only
      historical evidence for the superseded two-row composition.

## 11. First-open zero-prefix recovery (2026-08-26)

This follow-up implements ADR-079 without changing ADR-061's provider,
ranking, result, execution, privacy, or native-handoff ownership.

### 11.1 Behavior checklist

- [x] Treat only the first eligible completed empty-string query as a possible
      Firefox Top Sites warm-up result.
- [x] Repeat that query once through the existing native input/context builder
      and shared provider manager without publishing an intermediate empty
      state.
- [x] Keep non-empty text, search-mode follow-up, query replacement, close,
      cancellation, native handoff, failure, and disposal on their existing
      single-query paths.
- [x] Settle a genuinely empty retry as empty; never recurse or add a timer,
      startup query, observer, provider, engine, endpoint, or persisted state.
- [x] Retain exact controller restoration, context cancellation, opaque result
      tokens, and value-free diagnostics on both attempts.

### 11.2 Verification checklist

- [x] Add focused first-empty/second-result and bounded genuine-empty tests;
      the bridge plus popup suite passes 21/21, with zero focused lint errors
      and zero Svelte/TypeScript diagnostics.
- [x] Run the ordinary `npm run verify` gate and inspect regenerated artifacts;
      the 424/424 result and coverage/build evidence are recorded in section
      10.2, and the generated bridge contains the bounded retry guard.
- [x] Run the Windows PowerShell 5.1 fixed-list static suite; all listed suites
      pass.
- [ ] Run a fresh Firefox 154 first-open empty-field probe; this remains
      `not run` and is not inferred from focused fixtures.
