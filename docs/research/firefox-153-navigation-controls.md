# Firefox 153 navigation bridge and top-edge controls research

## Environment

- Date: 2026-08-15 to 2026-08-16
- Firefox version: 153.0.4 release
- Build ID: `20260810162159`
- Channel: release
- Operating system: Windows 11 Pro 25H2, build `26200.9168`
- Profile: marker-owned `fennevia-dev`
- Program: marker-owned copy of the stock Firefox installation
- Project base commit: `b4e3ef67e225ae1c61d0e52cc0a8ebdfc0b75545`
  plus the issue #12 worktree
- Package: `0.7.0-dev`
- Firefox release source stamp: `54be19de0e08edff0b797e55fd935dd3978b0a6d`
- Official GitHub tag: `FIREFOX_153_0_4_RELEASE` at
  [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)

Only this Firefox release and Windows environment were validated. This record
makes no Linux, macOS, ESR, Beta, Nightly, touch, or later-release support
claim.

## Goal and minimal reproduction

Issue #12 needs one per-window ordinary-data navigation contract and usable
Back, Forward, Reload/Stop, and New Tab controls inside issue #31's top edge.
Firefox must continue to own navigation policy, selected-browser identity, new-
tab policy, native command state, and the retained visible navbar.

The repeatable probe is:

1. Build and install the exact package into the marker-owned copied Firefox
   program and development profile.
2. Reveal the top edge by keyboard and verify that its four controls and
   bounded text status exist without an editable address input, tabs, or menu.
3. Navigate between two loopback pages, alternating native and project Back /
   Forward actions while comparing enabled state with Firefox's command
   elements.
4. Reload a delayed loopback page, stop a pending page, reach a deliberately
   broken response, and close a selected tab while progress is pending.
5. Repeat lifecycle, synchronization, cleanup, and ownership checks in the
   initial normal, second normal, and private windows and under Browser Toolbox.
6. Inject base, tabs, and navigation capability failures plus frontend and CSS
   failure paths, restore exact artifact bytes, and repeat ordinary startup.

The loopback HTTP server is test-only, binds an ephemeral `127.0.0.1` port,
serves fixed inert pages, and is absent from the installed package.

## First causal evidence

- Browser Console and Browser Toolbox showed no unexpected first-party
  Fennevia exception in the completed ordinary or toolbox matrices. The
  generated bridge mounted once per managed window and the native navbar,
  Urlbar, toolbox, tabbox, browser content, modal layer, and OS controls
  remained present.
- The first post-restoration frontend-recovery run failed with
  `FENNEVIA_FIREFOX_TEST_NAVIGATION_RELOAD_TIMEOUT`. The harness had waited
  only for Forward to change `currentURI`; Firefox could still expose Stop
  while that page was finishing, so clicking the single Reload/Stop control
  correctly stopped instead of reloading. The minimum test fix waits for the
  forwarded tab to leave `busy`, then loads a dedicated 500 ms delayed reload
  page and requires both progress start/stop and at least two server requests.
  The ordinary and complete frontend-recovery matrices then passed.
- A boundary review found that each command capability originally combined a
  native command element and `BrowserCommands` method but named only the method
  as its failure symbol. The final probe keeps those capabilities separate, so
  a missing `Browser:Back` element reports its fixed command boundary rather
  than inaccurately identifying `BrowserCommands.back`.

No startup-cache action was required.

## Sources checked

### Current Firefox source

- [`browser-sets.inc.xhtml`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-sets.inc.xhtml):
  the retained `Browser:Back`, `Browser:Forward`, `Browser:Stop`,
  `Browser:Reload`, and `cmd_newNavigatorTabNoEvent` command elements.
- [`browser-sets.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-sets.js):
  command dispatch to `BrowserCommands.back`, `forward`, `stop`, `reload`, and
  `openTab`.
- [`browser-commands.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-commands.js):
  current Back/Forward, Reload, Stop, and New Tab behavior. In particular,
  Reload retains Firefox's view-source and cache-bypass decisions, Stop uses
  current web-navigation behavior, and New Tab retains Firefox observers,
  configured new-tab target, triggering principal, and telemetry path.
- [`browser.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser.js):
  `UpdateBackForwardCommands`, `XULBrowserWindow.onStateChange`, and
  `onLocationChange` update the native command disabled state around selected
  top-level location/network transitions.
- [`tabbrowser.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tabbrowser.js):
  `selectedBrowser`, `selectedTab`, `addTabsProgressListener`,
  `removeTabsProgressListener`, selected-browser listener handoff,
  `TabSelect`, and `TabAttrModified` for label/busy changes.
- Firefox's
  [tabbrowser source documentation](https://searchfox.org/firefox-main/source/browser/base/content/docs/tabbrowser/index.rst):
  one `gBrowser` and one selected browser per browser window.

The release source establishes two distinct boundaries. `BrowserCommands`
owns action semantics, while the retained command elements own the enabled /
disabled state presented by native browser chrome. Fennevia consumes both
inside `src/firefox/`; it does not reconstruct session history or infer loading
from application timers.

### Compatibility canaries

The current heads checked on 2026-08-15 were:

- Alice0775/userChrome.js
  [`5e146e348a56a914e6c016d29733e8ee8d468155`](https://github.com/alice0775/userChrome.js/commit/5e146e348a56a914e6c016d29733e8ee8d468155)
- MrOtherGuy/fx-autoconfig
  [`dfdab5684faffc112b76ccb1d8cab7f75da0102c`](https://github.com/MrOtherGuy/fx-autoconfig/commit/dfdab5684faffc112b76ccb1d8cab7f75da0102c)
- xiaoxiaoflood/firefox-scripts
  [`a898ac59fb0ca3886c0c46b184fdbc037c83c037`](https://github.com/xiaoxiaoflood/firefox-scripts/commit/a898ac59fb0ca3886c0c46b184fdbc037c83c037)
- aminomancer/uc.css.js
  [`88514013ddc375f4770f4a35d8d07a91d6dd7d8f`](https://github.com/aminomancer/uc.css.js/commit/88514013ddc375f4770f4a35d8d07a91d6dd7d8f)

Alice's current-version scripts reinforce selected/top-level progress filtering
and explicit `addTabsProgressListener` / `removeTabsProgressListener` pairing.
xiaoxiaoflood's current scripts also pair listener cleanup. aminomancer has
feature-specific navigation tooltip/progress consumers that read the current
browser, but their multi-tab UI behavior is broader than this bridge.
fx-autoconfig has no relevant navigation-state implementation. Review of the
recent canary changes found no current navigation compatibility patch that
Fennevia needed to adopt.

No canary code was copied. Generic script discovery, metadata, sandboxing,
legacy-version branches, native-widget patching, and loader globals remain
outside this project.

### Design reference boundary

Issue #31 already recorded the permitted visual concepts and provenance for
the four-edge frame. Issue #12 did not inspect a `.uc.js` navigation or topbar
implementation from `my-firefox-custom`. No old selector, event handler,
timer, dimension, CSS value, DOM strategy, command strategy, or layout was
copied or adapted. The controls are a new composition inside ADR-026's owned
top host and use its existing reveal/focus controller and design tokens.

## Current Firefox behavior adopted

| Surface | Firefox 153 behavior used by Fennevia |
| --- | --- |
| Back / Forward state | `UpdateBackForwardCommands` mirrors selected web-navigation history into the `disabled` attributes of `Browser:Back` and `Browser:Forward`. Fennevia reads those command attributes as the native UI truth. |
| Loading state | Selected top-level network start/stop changes the native Stop/Reload command state. Fennevia represents loading as `Browser:Stop` being enabled. |
| Location | Selected top-level `onLocationChange` covers ordinary loads, redirects, same-document transitions, and error-page URI changes. The snapshot reads the current selected browser's bounded `currentURI.displaySpec`. |
| Title | The selected native tab's bounded `label` supplies title text. Relevant selected `TabAttrModified` notifications reconcile it. |
| Selected handoff | Firefox synthesizes selected-browser progress state during handoff and emits `TabSelect`. Fennevia reconciles `TabSelect` and always re-resolves `gBrowser.selectedBrowser` inside an action. |
| Actions | Public actions invoke the current window's `BrowserCommands` methods. Back/Forward/Reload/Stop also honor the corresponding current command disabled state; New Tab invokes `openTab` through the retained no-event command boundary. |
| Cleanup | The controller pairs two tab events, one tabs progress listener, one command-attribute observer, and its application subscribers with deterministic disposal. |

## Loader-specific baggage identified

- Arbitrary `.uc.js` discovery, script metadata, sandbox compatibility,
  delayed arbitrary-script evaluation, and global loader registries are not
  needed.
- Directly moving, hiding, styling, or replacing native navbar controls is not
  needed while issue #15 remains pending.
- Multi-tab progress aggregation, tooltip history menus, custom session
  history, Urlbar providers, and URL/search submission belong to other feature
  scopes.
- Historical Firefox branches and compatibility fallbacks are rejected. A
  missing current symbol is a typed required-capability failure.

## Options considered

1. Call `selectedBrowser.goBack()` / `goForward()` / `reload()` / `stop()`
   directly. Rejected because `BrowserCommands` carries the current native
   command semantics and special cases that the visible native controls use.
2. Dispatch synthetic clicks or `doCommand()` on native buttons. Rejected
   because it makes behavior depend on presentation DOM and event targeting;
   the source-defined command methods are the smaller action boundary.
3. Infer enabled/loading state from `selectedBrowser.canGoBack`, tab `busy`, or
   locally tracked progress alone. Rejected because the native command
   elements are the direct comparison truth required by the issue.
4. Poll URI, title, and command state. Rejected. Two tab events, the selected
   top-level tabs progress listener, and one scoped command-attribute observer
   cover the required transitions without a continuous timer.
5. Retarget listeners directly to each selected browser. Rejected because
   `addTabsProgressListener` already owns selected-browser handoff and exposes
   the browser argument needed to reject background updates.
6. Put an editable URL field, history menu, or fake overflow button in the top
   edge. Rejected because issue #13 owns editing/submission and the current
   issue requires no inert controls.

## Decision and minimum adaptation

- `src/firefox/navigation.ts` creates one navigation controller inside each
  issue #9 boundary. Required capability checks separately validate the
  selected browser/tab, current URI, tab event target, paired tabs progress
  methods, `MutationObserver`, five native command elements, and five
  `BrowserCommands` methods.
- Its frozen public bridge contains one immutable selected-navigation snapshot,
  subscriptions, and Back, Forward, Reload, Stop, Reload-or-Stop, and New Tab
  actions. Native browsers, tabs, commands, events, observers, and windows
  remain private.
- State reconciliation reads the selected browser and tab afresh. Background
  or non-top-level progress is ignored; selected `TabAttrModified` is limited
  to label, busy, and selection changes. Equal snapshots do not publish.
- `src/app/navigation-state.ts` validates and copies exactly five ordinary
  fields, truncates title to 256 characters and display URI to 2,048
  characters, drops unknown values, owns the frontend subscription, and
  rejects all access after disposal.
- `WindowShell.sys.mjs` creates navigation before frontend mount, includes its
  capabilities in the existing health gate, routes event/action failures to
  ADR-021 fail-open, and disposes navigation before tabs and the base boundary.
- The top Svelte surface renders four real buttons and a secondary text-only
  status. It consumes only the application adapter. Disabled, loading, hover,
  active, focus-visible, narrow-window, reduced-motion, transparency, and
  forced-color behavior reuse ADR-026's scoped control/tokens and local CSS.
- The top surface keeps ADR-026's one trigger, one hide timer, focus retention,
  keyboard reveal, `Escape`, corner arbitration, modal/fullscreen policy, and
  disposer. No second visibility controller or native DOM owner is added.

## Security and privacy effects

- The bridge introduces bounded current title and display URI because they are
  required visible status data. They exist only in the owning window's memory
  and text nodes; they are never logged, persisted, put in datasets, included
  in errors, sent to another window, or transmitted.
- Title and URI are rendered through Svelte text interpolation with bidi
  isolation and ellipsis. There is no `{@html}`, CSS interpolation, resource
  load, hyperlink, editable field, submission path, or page-controlled action
  argument.
- Native action failures expose only fixed code, phase, adopted symbol,
  Firefox version/build, and normal/private kind. Native causes remain behind
  the existing redacted stack path.
- The change adds no dependency, remote endpoint, runtime fetch, telemetry,
  storage, content-accessible mapping, Chrome Registry directive, override,
  source map, permission UI, identity UI, or download-safety replacement.
- Each normal, second, and private window owns separate bridge state,
  subscribers, native listeners, observer, Svelte adapter, and text output.
  Disposal clears them synchronously.

## Validation performed

- `npm test`: 97/97 tests passed; the navigation-specific files contributed
  14 passing tests. They cover
  bounded copies, invalid/stale state, native command truth, same-document /
  redirect-style location changes, title/loading/selection updates, fresh
  selected-browser actions, rapid transitions, subscriber and action failure,
  exact missing capability symbols, and complete disposal.
- `npm run lint`, `npm run typecheck`, `npm run build`, and
  `npm run artifacts` passed. The build reproduced the private bridge ESM,
  frontend IIFE, extracted CSS module, and exact eleven-profile-file package.
- The ordinary Firefox 153.0.4 matrix passed top keyboard reveal/focus,
  native/custom Back and Forward alternation, native enabled-state comparison,
  delayed Reload, Stop, New Tab, error-page settlement, selected pending-load
  close/handoff, bounded text-only status, `Escape`, normal/second/private
  isolation, direct unmount/remount, emergency fallback, runtime stop, and no
  unexpected first-party Browser Console error.
- The Browser Toolbox variant repeated the matrix and retained the four XHTML
  ownership boundaries and all Firefox-owned native infrastructure.
- The bridge recovery wrapper passed missing base, tabs, and navigation
  capabilities, exact artifact restoration, and an ordinary recovery run.
- Missing and throwing frontend bundles passed fail-open and exact-restoration
  recovery. Complete and broken-package safe start passed, followed by exact
  restoration and ordinary startup. Every wrapper ended with zero Firefox
  process and no startup-cache action.

## Remaining compatibility risk

- Every command element, `BrowserCommands` method, progress callback, event,
  and selected-browser property is internal and must be revalidated on the
  next supported Firefox stable.
- A command can change between a rendered frame and a click. The bridge reads
  the selected browser, command disabled state, and method synchronously at
  invocation and leaves final navigation policy to Firefox; it does not queue
  or replay an action against stale state.
- Current title and display URI are status text, not a security indicator.
  Firefox's retained native Urlbar and identity/permission surfaces remain the
  authoritative security UI until separately reviewed.
- Forced colors, reduced motion/transparency, responsive bounds, and high-DPI-
  safe CSS-pixel geometry have deterministic style coverage. Additional OS
  visual review remains part of issue #15 before native UI can be hidden.
- Runtime evidence is Windows-only.

## Follow-up

- Issue #13 may consume the selected display URI as initial ordinary data but
  must independently research Firefox URL/search submission, editing state,
  principals, private-window behavior, and `Ctrl+L` routing.
- Issue #15 may hide native navigation UI only after #13 and the other required
  shell slices pass their own security, fallback, fullscreen, customize-mode,
  and recovery gates. The command/controller/native infrastructure remains.
- Re-run source/canary review, capability injection, three-window behavior,
  Browser Toolbox ownership, cleanup, and all recovery wrappers when Firefox
  stable changes.
