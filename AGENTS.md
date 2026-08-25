# AGENTS.md

This file applies to every coding, research, review, and documentation agent
working in this repository.

Do not silently bypass these rules. An issue may change a non-safety rule
explicitly. Safety, privacy, fail-open, native-UI ownership, and related
privileged-code rules may be updated or relaxed only with explicit project-owner
approval, recorded in the current normative documents in the same change.
Agents must not infer a relaxation from development speed, convenience, a
previous exception, or an unapproved issue comment.

## 1. Required reading order

Before changing code or documentation, read:

1. This file.
2. `plans/000-master-plan.md`.
3. `plans/002-shell-roadmap.md` for shell or feature work.
4. The plan and documentation files relevant to the assigned issue.
5. The complete issue body, blockers, linked research records, and related
   decisions.
6. The current implementation and the most recent relevant commits.

For dependency, copied/adapted code, generated artifact, contribution, or
distribution work, also read `docs/licensing-and-provenance.md` and
`THIRD_PARTY_NOTICES.md` before acting.

If an issue conflicts with an older document, follow the newer explicit
decision and update the stale normative document in the same change. A
safety-rule conflict still requires project-owner approval. Do not rewrite a
historical research record to make it describe later implementation. If a
conflict cannot be resolved from existing evidence, record the blocker instead
of inventing a new architecture.

## 2. Project identity and support scope

- Fennevia is a custom Chrome package and browser frontend runtime installed on
  **stock Firefox**.
- It is not a general-purpose userscript loader and must not grow arbitrary
  `.uc.js` discovery, metadata parsing, sandbox compatibility, or legacy loader
  behavior.
- Initial support targets the latest Firefox stable available during
  implementation and a Windows-first development environment.
- Current validated evidence is public prerelease package `0.17.0-beta.1` on
  Firefox 153.0.4 BuildID `20260810162159`, Firefox 154.0 BuildID
  `20260812182057`, and Firefox 154.0.1 BuildID `20260824154132` for Windows x64. The installer
  accepts Firefox 153 and newer after an explicit warning that only majors 153
  and 154 are tested and that later versions may break with no working promise.
  This is a narrow prerelease support boundary, not a stable or cross-platform
  support promise.
- Do not add branches, polyfills, or compatibility hacks for old Firefox
  versions unless an issue explicitly requires them.
- Firefox internal APIs are intentionally used, but those dependencies must be
  concentrated in the runtime and `src/firefox/` bridge layers.
- Do not claim Linux, macOS, ESR, Beta, or Nightly support without real evidence
  on that target.

## 3. Product and architecture invariants

1. AutoConfig must remain a minimal bootstrap that locates the manifest,
   registers the package, imports one privileged entry point, and reports fatal
   errors.
2. Project-owned resources must use dedicated `chrome://fennevia/` and reserved
   `resource://fennevia/` namespaces. Do not expose a mapping merely because the
   namespace exists.
3. The content-first shell consists of four independent project-owned floating
   surfaces:
   - top: fixed primary browser controls;
   - left and right: exactly one vertical-tabs/address-launcher surface and one
     bookmarks surface, defaulting to tabs on the left and bookmarks on the
     right, with an owner-configurable swap;
   - bottom: download progress and status, with an owner-configurable enabled
     state.
   A fifth centered project-owned overlay contains the only custom editable
   address/search input; the launcher on the configured tabs side is
   non-editable.
4. Every surface is hidden at rest and must reserve no permanent browser-content
   space.
5. Feature modules must consume the shared frame, edge trigger, reveal
   controller, collision policy, glass tokens, accessibility behavior, focus and
   popup holds, and disposer established by #31. Do not create a second edge
   trigger, private hide timer, z-index system, browser-window observer, or
   window-global coordination flag.
6. Hover cannot be the only access path. Each surface needs a documented
   keyboard or focus path, visible focus, and deterministic focus restoration.
7. Svelte components must not directly access `gBrowser`, `Services`,
   `PlacesUtils`, SessionStore, Downloads internals, Firefox-owned DOM, native
   controllers, or principals. Access goes through `src/firefox/` contracts.
8. The frontend framework may manage only XHTML hosts created and owned by this
   project. Never mount into a native container that already owns Firefox
   children.
9. Do not delete, reparent, or replace core `browser.xhtml` DOM, tab-content
   infrastructure, command sets, popup sets, permission UI, or browser-content
   containers.
10. Native visible UI may be collapsed at first paint by the process-scoped
    startup hide sheet. That sheet is scoped to `navigator:browser`,
    self-expires at the health deadline, and yields immediately to `failed`,
    `suspended`, emergency fallback, and safe start. Durable hiding after that
    deadline still requires every required custom surface and recovery path to
    pass health, and remains a reversible per-window `data-fennevia-active`
    gate. Do not delete native DOM.
11. Startup or runtime failure must fail open: native Firefox UI remains visible
    or returns immediately.
12. Every observer, event listener, timer, progress listener, stylesheet,
    mapping, native view, query, framework root, and pending async operation must
    have deterministic cleanup.
13. Do not load JavaScript, CSS, fonts, configuration, templates, analytics,
    telemetry, or executable content from a network endpoint at runtime.
14. Do not introduce unnecessary `eval`, dynamic code generation, remote module
    loading, or runtime update checks.
15. `override chrome://...` is a last resort. Every override requires a dedicated
    issue, architecture decision, upstream source pin, regression tests, update
    procedure, and removal plan.
16. Overriding the complete `browser.xhtml` is prohibited during the initial
    roadmap.
17. Do not copy large parts of an existing loader or customization. First
    identify the upstream Firefox behavior and implement only the minimum
    Fennevia-specific requirement.
18. `yutinglia/my-firefox-custom` is a capability and broad visual reference,
    not an implementation template. Do not copy or adapt its `.uc.js` code,
    selectors, IDs, classes, timers, global flags, numeric values, native-DOM
    mutation strategy, loader assumptions, module layout, or visual composition.
    Any implementation record that consults it must name the exact commit and
    document the independently selected Fennevia design.

## 4. Required Firefox research workflow

The full procedure is in `docs/research-playbook.md`. At minimum:

1. Record Firefox version, build ID, channel, operating system, profile state,
   project commit, and the first root error with its stack.
2. Reproduce in the clean development profile and rule out stale artifacts,
   startup cache, unrelated extensions, policies, or other customizations.
3. Inspect Browser Console and Browser Toolbox before changing code. Fix the
   first causal error rather than later cascading failures.
4. Check the current compatibility canaries:
   - `alice0775/userChrome.js`
   - `MrOtherGuy/fx-autoconfig`
   - `xiaoxiaoflood/firefox-scripts`
   - `aminomancer/uc.css.js`
5. Inspect their latest relevant commits, current-version directories, issues,
   pull requests, and concrete fixes. Do not rely only on README files or old
   snippets.
6. Use Searchfox to inspect the failing symbol, URI, DOM ID, exception text,
   callers, nearby tests, blame history, and linked Bugzilla issue.
7. When cross-version history is required, inspect the official
   `mozilla-firefox/firefox` repository and relevant upstream commits.
8. Record:
   - what changed upstream;
   - how maintained loaders or customizations adapted;
   - which parts are loader/customization-specific baggage;
   - the minimum Fennevia change selected;
   - the exact validation performed.

External repositories are research sources, compatibility canaries, and limited
design references. They are not runtime dependencies or implementation
templates.

## 5. Source and evidence priority

Use sources in this order:

1. Reproducible local evidence, Browser Console, and Browser Toolbox.
2. Current Firefox source in Searchfox or the official Firefox repository.
3. Firefox Source Docs, Bugzilla, and upstream commits.
4. Maintained loader and customization repositories.
5. Firefox derivatives such as Floorp, Noraneko, and Zen for frontend patterns,
   while separating fork-only capabilities from stock-Firefox capabilities.
6. Forums, Reddit, and old blog posts only as discovery hints.

Record an upstream commit SHA, source path, or Firefox build when a decision
depends on unstable internals. Never present an assumption as an established
Firefox contract.

Fennevia's original material is MPL-2.0 under the root `LICENSE`. Before copying
external code, follow `docs/licensing-and-provenance.md`, verify the exact
source/file/commit and license, preserve required notices, and update
`THIRD_PARTY_NOTICES.md`. Public visibility alone is not permission to reuse
code, and unclear or unlicensed material remains prohibited.

## 6. Implementation rules

- Keep one issue to one coherent change set. Do not combine unrelated
  architecture work.
- Prove the smallest spike before building an abstraction around it.
- Create small Firefox adapters that expose ordinary typed data, events,
  actions, and capability states.
- Perform runtime validation at the privileged boundary; TypeScript declarations
  alone are not evidence that a Firefox symbol exists.
- Errors for missing or renamed internals must identify the phase, allowlisted
  symbol or path, Firefox version, and build ID without browsing data.
- Do not swallow exceptions. The outer fail-open boundaries may catch a fatal
  error to preserve native UI, but must still record the privacy-safe first
  causal stack.
- Never assume there is only one browser window. Handle existing windows, later
  windows, private windows according to policy, and window shutdown.
- Build output is generated. Never hand-edit `dist/` or installed generated
  artifacts; every file must be reproducible from source.
- Avoid large service containers, generic Firefox SDK layers, or speculative
  abstractions without a real consumer.
- Keep composition hosts, public facades, CSS barrels, and installer loaders as
  wiring. Put feature implementation in dedicated modules instead of growing
  `App.svelte`, `CustomizePanel.svelte`, or another single file into a catch-all.
  Do not add numeric line-count CI gates for this; extract when a file starts
  owning unrelated feature logic.
- Keep privileged implementation details out of Svelte stores, DOM datasets,
  serializable state, and diagnostics.
- Feature UI must use the #31 edge contract rather than manipulating surface
  classes or timers directly.
- Do not add fake, disabled, or misleading placeholder controls. A placeholder
  surface must state that its feature is unavailable and must not satisfy a
  health requirement intended for the real feature.
- If Tailwind is proposed, create an evidence-based decision first, disable
  Preflight, use a project prefix, and prove no native-style leakage.

## 7. Security and privacy rules

Read `docs/security-and-privacy.md` before adding dependencies, logging,
resource mappings, installers, persistence, native-UI hiding, or code that
handles URLs or user-derived data.

- Treat every installed runtime module and frontend bundle as
  system-principal code.
- Keep the dependency graph small, commit the lockfile, and review dependency
  upgrades.
- Never transmit browsing URLs, history, queries, bookmark contents, download
  metadata, profile paths, or user input to external services.
- Normal logs must not contain complete URLs, page titles, address/search text,
  bookmark or folder titles, bookmark URLs, download filenames, source URLs,
  local paths, byte counts tied to named downloads, history entries, or
  private-window browsing state.
- Do not expose privileged modules or private assets through content-accessible
  mappings.
- Installation and removal scripts must validate paths and fail closed before
  destructive operations.
- Never print secrets, tokens, cookies, session data, principals, headers, or
  certificates.
- Security-sensitive prompts and permission flows remain Firefox-owned unless a
  separately reviewed issue replaces them.

These rules remain in force during rapid development. Updating or relaxing them
requires explicit project-owner approval.

## 8. Testing cadence

The project is currently under rapid development. Ordinary coding, review, and
documentation work should optimize for speed and developer experience: make CI
able to pass, and do not run the full real-Firefox or mass-test matrices on
every change. See ADR-039.

### 8.1 Ordinary development gate

The required gate is the Windows CI job in `.github/workflows/ci.yml`. It
covers formatting, lint, typecheck, unit tests with coverage floors, the
fixed-list static PowerShell suites, dependency audit, deterministic build,
committed generated artifacts, and the production-artifact scan.

`npm run test:coverage` uses Node's built-in test runner against the loaded
`src/app` and `src/firefox` modules. The CI floors are 80% line coverage and
80% function coverage. Branch coverage is reported but not a fail threshold
because several typed error paths are not worth extra padding tests. Svelte
hosts, privileged Firefox runtime, generated artifacts, and tests themselves
are outside this gate.

Do not write tests whose only purpose is to satisfy the coverage floor. If
coverage drops, add or fix tests that prove real mapping, bounds, errors,
cleanup, or fail-open behavior. Do not add tautological assertions, unused
helpers, copied branches, or otherwise-dead code that exists only to be
executed by the reporter.

Locally, run the same commands CI runs when practical (`npm run verify`, and
the Windows PowerShell 5.1 static suite when that runtime is available). If a
local run is skipped, record it as `not run` and rely on CI. Do not claim a
check passed without evidence.

### 8.2 Release mass tests

Before a release tag or publication, run the complete matrices in
`docs/testing-and-recovery.md`, including real Firefox checks that CI cannot
run. Those matrices exist to prove the shipped package, not to slow every
development iteration.

The lists below are the release and mass-test contract. During rapid
development they are not a per-issue Definition of Done. Record unrun rows
honestly as `not run`.

Every runtime or UI release check should verify, as applicable:

- clean cold start and restart;
- successful shell initialization;
- deliberately broken entry, bundle, CSS, host, controller, or required
  capability while native UI remains usable;
- a second normal browser window;
- a private window, or an explicitly documented complete native fallback;
- deterministic cleanup after window close or runtime disposal;
- no new unhandled Browser Console exception;
- no duplicated hosts, roots, listeners, timers, observers, native views, or
  process-global initialization;
- exact commands, environment, and observed results in the release record.

Every edge-surface release check should additionally verify:

- its matching pointer and keyboard reveal paths;
- focus and popup holds, delayed hide, `Escape`, and focus restoration;
- both adjacent corners and collision behavior;
- narrow, short, maximized, restored, fullscreen, and high-DPI layouts where
  relevant;
- reduced motion, forced colors, and transparency/blur fallback;
- zero permanent content margin while hidden;
- disposal during a pending hold or hide delay.

Any release that hides native UI must additionally test Browser fullscreen, DOM
fullscreen, customize mode, Browser Toolbox, DevTools, native prompt and dialog
surfaces, emergency fallback, safe start, missing activation CSS, retained
native access paths, and OS window controls.

Do not mark a test as passed without evidence. If a test cannot be run, mark it
`blocked` or `not run` and explain why.

## 9. Documentation and research records

- Long-lived current knowledge belongs in `docs/`.
- Ordered implementation work and milestone sequencing belong in `plans/`.
- Historical compatibility and validation evidence belongs in
  `docs/research/`.
- Do not rewrite historical records merely because a later issue superseded
  their architecture. Add an ADR and update current normative documents.
- Update `docs/architecture-decisions.md` for a new architectural tradeoff.
- Update `docs/firefox-internals-map.md` whenever a Firefox symbol, event, DOM
  ID, URI, preference, command, or source path is introduced or changed.
- Update `docs/security-and-privacy.md` when a new privileged data flow,
  dependency class, installer behavior, persistence path, or
  content-accessible resource is introduced.
- Update `docs/testing-and-recovery.md` when the current test, failure, recovery,
  edge-interaction, or native-access matrix changes.
- Keep README status, issue #1, plans, and package version synchronized after
  every completed milestone.
- Do not write statements such as “Firefox should do this” without source or
  runtime evidence. Create a research spike when uncertain.

## 10. Git and pull-request discipline

- Work on a dedicated branch unless the user explicitly requests a direct
  change.
- Reference the issue in commits and the pull request when one exists.
- Keep commits reviewable and avoid unrelated formatting churn.
- Pull requests must include environment details, research sources, commands
  run, results, documentation changes, and known remaining risks. During rapid
  development, CI is the required validation gate. Real Firefox,
  failure-injection, and mass-matrix evidence is required for release work,
  not every ordinary pull request. Record unrun checks as `not run`.
- Generated artifacts may be committed only when the installation model
  requires them and the source-to-artifact command is documented.
- Do not rewrite or silently remove an accepted architecture decision. Mark it
  superseded and add the replacement decision.
- Documentation-only changes must still identify which statements were checked
  against current code, manifest, merged issues, and validation records.

## 11. Definition of Done

An ordinary issue is complete when:

- acceptance criteria are verifiably satisfied or explicitly revised with
  owner approval;
- CI is able to pass for the change;
- no tests were added solely to raise coverage;
- native fallback and recovery design remain intact;
- new Firefox internal dependencies are isolated and documented with current
  source references;
- security and privacy effects were reviewed; any safety-rule change has
  explicit project-owner approval;
- README, plans, current documentation, issue #1, and decision records are
  synchronized where affected;
- no high-risk workaround is disguised as a normal abstraction;
- no test result, compatibility claim, completion state, or platform-support
  claim is overstated.

A release is complete only when the mass-test and real Firefox matrices in
`docs/testing-and-recovery.md` have also been run and recorded.
