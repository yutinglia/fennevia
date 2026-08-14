# AGENTS.md

This file applies to every coding, research, review, and documentation agent working in this repository. Do not bypass these rules unless an issue explicitly changes them.

## 1. Required reading order

Before changing code or documentation, read:

1. This file.
2. `plans/000-master-plan.md`.
3. The plan and documentation files relevant to the assigned issue.
4. The complete issue body, its blockers, linked research records, and related decisions.
5. The current implementation and the most recent relevant commits.

If an issue conflicts with an older document, follow the newer explicit decision and update the stale document in the same change. If the conflict cannot be resolved from existing evidence, record the blocker in the issue instead of inventing a new architecture.

## 2. Project identity and support scope

- This project is a custom Chrome package and browser frontend runtime installed on **stock Firefox**.
- It is not a general-purpose userscript loader and must not grow arbitrary `.uc.js` discovery, metadata parsing, sandbox compatibility, or legacy loader behavior.
- Initial support targets the latest Firefox stable available during implementation and a Windows-first development environment.
- Do not add branches, polyfills, or compatibility hacks for old Firefox versions unless an issue explicitly requires them.
- Firefox internal APIs are intentionally used, but those dependencies must be concentrated in the runtime and bridge layers.
- Do not claim Linux or macOS support without real test evidence on those platforms.

## 3. Architecture invariants

1. AutoConfig must remain a minimal bootstrap that locates the manifest, registers the package, imports one privileged entry point, and reports fatal errors.
2. Project-owned resources must use dedicated `chrome://fennevia/` and `resource://fennevia/` namespaces.
3. Svelte components must not directly access `gBrowser`, `Services`, `PlacesUtils`, `SessionStore`, Downloads internals, or Firefox-owned DOM. Access must go through `src/firefox/` bridge modules.
4. The frontend framework may manage only XHTML hosts created and owned by this project. Never mount it into a native container that already owns Firefox children.
5. Do not delete or replace the core `browser.xhtml` DOM, tab content infrastructure, command sets, popup sets, permission UI, or browser content containers.
6. Native visible UI may be hidden only after the custom shell has mounted and passed explicit health checks. Visibility must be controlled by a reversible root-state gate.
7. Startup or runtime failure must fail open: native Firefox UI remains visible and usable.
8. Every observer, event listener, timer, progress listener, stylesheet, mapping, and framework root must have deterministic cleanup.
9. Do not load JavaScript, CSS, fonts, configuration, or executable content from a CDN or network endpoint at runtime.
10. Do not introduce unnecessary `eval`, dynamic code generation, or remote module loading.
11. `override chrome://...` is a last resort. Every override requires a dedicated issue, architecture decision, upstream source pin, regression tests, update procedure, and removal plan.
12. Overriding the complete `browser.xhtml` is prohibited during the initial roadmap.
13. Do not copy large parts of an existing loader. First identify the upstream Firefox change it addresses, separate generic-loader baggage, and implement only the minimum behavior this project needs.

## 4. Required Firefox research workflow

The full procedure is in `docs/research-playbook.md`. At minimum:

1. Record Firefox version, build ID, channel, operating system, profile state, project commit, and the first root error with its stack.
2. Reproduce the problem in the clean development profile and rule out stale artifacts, startup cache, unrelated extensions, policies, or other customizations.
3. Inspect Browser Console and Browser Toolbox before changing code. Fix the first causal error rather than later cascading failures.
4. Check the current compatibility canaries:
   - `alice0775/userChrome.js`
   - `MrOtherGuy/fx-autoconfig`
   - `xiaoxiaoflood/firefox-scripts`
   - `aminomancer/uc.css.js`
5. Inspect their latest relevant commits, current-version directories, issues, pull requests, and concrete fixes. Do not rely only on README files or old snippets.
6. Use Searchfox to inspect the failing symbol, URI, DOM ID, exception text, callers, nearby tests, blame history, and linked Bugzilla issue.
7. When cross-version history is required, inspect the official `mozilla-firefox/firefox` repository and the relevant upstream commits.
8. Record:
   - what changed upstream;
   - how maintained loaders or customizations adapted;
   - which parts of those fixes are loader-specific baggage;
   - the minimum fix selected for this project;
   - the exact validation performed.

Loader repositories are research sources and compatibility signals, not runtime dependencies.

## 5. Source and evidence priority

Use sources in this order:

1. Reproducible local evidence, Browser Console, and Browser Toolbox.
2. Current Firefox source in Searchfox or the official Firefox repository.
3. Firefox Source Docs, Bugzilla, and upstream commits.
4. Maintained loader and customization repositories.
5. Firefox derivatives such as Floorp, Noraneko, and Zen for frontend patterns, while clearly separating fork-only capabilities from stock-Firefox capabilities.
6. Forums, Reddit, and old blog posts only as discovery hints.

Record an upstream commit SHA, source path, or Firefox build when a decision depends on unstable internals. Never present an assumption as an established Firefox contract.

Before copying external code, verify its license and preserve required attribution and provenance. An implementation being publicly visible does not make it legally reusable.

## 6. Implementation rules

- Keep one issue to one coherent change set. Do not combine unrelated architecture work.
- Prove the smallest spike before building an abstraction around it.
- Create small Firefox adapters that expose ordinary typed data, events, actions, and capability states.
- Perform runtime validation at the privileged boundary; TypeScript declarations alone are not evidence that a Firefox symbol exists.
- Errors for missing or renamed internals must identify the phase, symbol or path, Firefox version, and build ID without exposing unnecessary browsing data.
- Do not swallow exceptions. Only the outer bootstrap boundary may catch a fatal error to restore native UI, and it must still log the complete stack.
- Never assume there is only one browser window. Handle existing windows, later windows, private windows according to policy, and window shutdown.
- Build output is generated. Never hand-edit `dist/`; every installed artifact must be reproducible from source.
- Avoid large service containers, generic Firefox SDK layers, or speculative abstractions without a real consumer.
- If Tailwind is adopted, disable Preflight, use a project-specific prefix, and ensure generated selectors cannot reset native Firefox chrome.
- Keep privileged implementation details out of Svelte stores, DOM datasets, serializable state, and diagnostics.

## 7. Security and privacy rules

Read `docs/security-and-privacy.md` before adding dependencies, logging, resource mappings, installers, or any code that handles URLs or user input.

- Treat every runtime module as system-principal code.
- Keep the dependency graph small, commit the lockfile, and review dependency upgrades.
- Never transmit browsing URLs, history, queries, profile paths, or user input to external services.
- Normal logs must not contain complete URLs, page titles, search text, history entries, or local file paths.
- Do not expose privileged modules or private assets through content-accessible resource mappings.
- Installation and removal scripts must validate paths and fail closed before destructive operations.
- Never print secrets, tokens, cookies, session data, or private-window state.
- Security-sensitive prompts and permission flows remain owned by Firefox unless a separately reviewed issue replaces them.

## 8. Minimum testing requirements

Every runtime or UI issue must verify, as applicable:

- clean cold start and restart;
- successful shell initialization;
- deliberately broken entry or bundle while native UI remains usable;
- a second normal browser window;
- a private window, or an explicitly documented complete native fallback;
- deterministic cleanup after window close or runtime disposal;
- no new unhandled Browser Console exceptions;
- no duplicated hosts, listeners, or process-global initialization;
- exact commands, environment, and observed results recorded in the pull request.

Any issue that hides native UI must additionally test fullscreen, customize mode, Browser Toolbox, emergency fallback, safe start, missing CSS, and OS window controls.

Do not mark a test as passed without evidence. If a test cannot be run, mark it blocked or not run and explain why.

## 9. Documentation and research records

- Long-lived knowledge belongs in `docs/`.
- Ordered implementation work and milestone sequencing belong in `plans/`.
- One-off compatibility incidents may remain in an issue, but must use the research-record structure from `docs/research-playbook.md`.
- Update `docs/architecture-decisions.md` for a new architectural tradeoff.
- Update `docs/firefox-internals-map.md` whenever a Firefox symbol, event, DOM ID, URI, preference, or source path is introduced or changed.
- Update `docs/security-and-privacy.md` when a new privileged data flow, dependency class, installer behavior, or content-accessible resource is introduced.
- Do not write statements such as "Firefox should do this" without source or runtime evidence. Create a research spike when uncertain.

## 10. Git and pull-request discipline

- Work on a dedicated branch unless the user explicitly requests a direct change.
- Reference the issue in commits and the pull request.
- Keep commits reviewable and avoid unrelated formatting churn.
- Pull requests must include environment details, research sources, commands run, results, failure-injection evidence where applicable, documentation changes, and known remaining risks.
- Generated artifacts may be committed only when the installation model requires them and the source-to-artifact command is documented.
- Do not rewrite or silently remove an accepted architecture decision. Mark it superseded and add the replacement decision.

## 11. Definition of Done

An issue is complete only when:

- all acceptance criteria are verifiably satisfied;
- relevant tests and smoke checks were run and recorded;
- native fallback and recovery remain intact;
- new Firefox internal dependencies are isolated and documented with current source references;
- security and privacy effects were reviewed;
- documentation and decision records are synchronized;
- cleanup was verified;
- no high-risk workaround is disguised as a normal abstraction;
- no test result, compatibility claim, or platform-support claim is overstated.
