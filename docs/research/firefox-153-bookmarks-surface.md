# Firefox 153 right-edge bookmarks research and validation

## 1. Record metadata

- Issue: #14, right-edge bookmarks MVP.
- Research and implementation date: 2026-08-16.
- Firefox: stock Firefox 153.0.4 release, stable channel.
- Build ID: `20260810162159`.
- Installed source stamp: `54be19de0e08edff0b797e55fd935dd3978b0a6d`.
- Official mirror tag: `FIREFOX_153_0_4_RELEASE`.
- Official mirror commit: `c178247e1dfea52241a6b18b18cf3a00f8da935c`.
- Platform: Windows 11 25H2.
- Runtime target: isolated copied Firefox program and marker-owned
  `fennevia-dev` profile.
- Project branch: `codex/issue-14-bookmarks`, based on merge
  `52fad858141b487eefad88c9f43d2eef5c43e6e1`; the pull request records the final
  implementation commit.
- Profile state: native Firefox UI retained and Fennevia production state stops
  at `healthy`.

This record covers current-source research, implementation selection, privacy
and security review, compatibility canaries, product-reference provenance,
first causal failure, and real Firefox evidence. It does not claim Linux,
macOS, an older Firefox release, daily-driver readiness, a complete bookmark
manager, or content-only activation.

## 2. Question and selected outcome

The issue needed a practical bookmark hierarchy in ADR-026's existing right
edge without moving Firefox's sidebar DOM, exposing bookmark URLs to Svelte,
mirroring an unbounded Places database, or reimplementing Firefox's opening
security policy.

The selected design is:

1. one privileged bookmarks controller per managed browser window;
2. four current localized Firefox user-content roots;
3. context-bound opaque IDs and immutable ordinary snapshots;
4. one parent lookup plus at most 32 indexed child fetches per loaded page;
5. lazy folder expansion, replaceable pages, depth 8, and 20 expanded folders;
6. one event-driven Places observer with bounded parent invalidation and no
   polling;
7. current/new-tab opening through current `PlacesUIUtils` after explicit
   executable/data/place scheme rejection;
8. a compact root tablist plus ordinary nested list in the existing right
   surface; and
9. complete per-window cleanup and health/fail-open integration.

ADR-029 is the normative decision. The implementation remains read/open only;
native Firefox owns creation, editing, deletion, moving, sorting, tagging,
Library, dialogs, toolbar, sidebar, and `Ctrl+D`.

## 3. Current Firefox source evidence

All links below resolve at the exact release commit, not the moving default
branch.

| Source | Exact blob | Finding used by Fennevia |
| --- | --- | --- |
| [`toolkit/components/places/Bookmarks.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/toolkit/components/places/Bookmarks.sys.mjs) | `acd57c4ab9317d7c9ee24e61546d1cccdc3afe68` | Defines bookmark/folder/separator records, four `userContentRoots`, localized root titles, `fetch()`, insert/update/remove/reorder notifications, and an explicitly unimplemented `fetchTree()`. |
| [`toolkit/components/places/PlacesUtils.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/toolkit/components/places/PlacesUtils.sys.mjs) | `767a6a1ae24b48e4b2847ff3b7f84810631f8558` | Exposes `PlacesUtils.bookmarks` and the paired observers facade at the fixed `resource://gre/modules/PlacesUtils.sys.mjs` URI. |
| [`dom/chrome-webidl/PlacesObservers.webidl`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/dom/chrome-webidl/PlacesObservers.webidl) | `ad4e292ad01b6095ef6e778b382465aed728cce8` | Defines exact `addListener(eventTypes, callback)` and `removeListener(eventTypes, callback)` ownership. |
| [`dom/chrome-webidl/PlacesEvent.webidl`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/dom/chrome-webidl/PlacesEvent.webidl) | `d41de887bdf8a425c84e5364e5f5e4a5a2469fd9` | Defines added/removed/moved/title/URL bookmark event fields, including current/old parent, tagging, and descendant-removal state. |
| [`browser/components/places/PlacesUIUtils.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/places/PlacesUIUtils.sys.mjs) | `7c11a2004c87aa6f0c61cf05ca522c7471c7be71` | Provides fetch-record conversion and `openNodeIn()`, checks node URL security/type, preserves bookmark transition/background/private behavior, and delegates to `openTrustedLinkIn()`. |
| [`browser/base/content/browser.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/browser.js) | `c919cf5c91b39c9b8ed13b25bd8efbfffe25cc52` | Uses the current `moz-src:///browser/components/places/PlacesUIUtils.sys.mjs` module URI in browser chrome. |
| [`browser/modules/URILoadingHelper.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/modules/URILoadingHelper.sys.mjs) | `b0f17c20bcca640c519b547149179cc03a86aa54` | Owns downstream trusted-link opening semantics; Fennevia does not duplicate its principal, container, popup, or private policy. |

### 3.1 Roots and query behavior

`Bookmarks.userContentRoots` is exactly toolbar, menu, unfiled/Other, and
mobile in this release. `getLocalizedTitle(info)` accepts the root record and
returns Firefox's locale title. The implementation requires four valid root
records and preserves this order instead of assuming the toolbar is the entire
bookmark model.

`Bookmarks.fetch()` accepts a GUID query and a positional
`{ parentGuid, index }` query. Output bookmark URLs are `URL` objects; therefore
the complete record must stay privileged. A folder record carries the current
child count used for `hasChildren` and page bounds. `fetchTree()` throws `Not
yet implemented`, so it is neither a supported shortcut nor a fallback.

The chosen page performs:

- one current parent fetch;
- no more than 32 child-position fetches;
- no recursion;
- one retained page per loaded parent;
- replacement, not accumulation, on Previous/Next; and
- descendant page removal on collapse.

The app caps the requested offset at 1,000,000, visible depth at 8, and expanded
folders at 20. This provides deterministic memory/work bounds for a profile
with very large roots while leaving all further content available by explicit
paging and expansion.

Rejected alternatives:

- `fetchTree()`: unavailable in the supported release;
- eager recursive walking: unbounded privileged work and frontend state;
- `PlacesUtils.bookmarks.search()`: wrong product semantics and still
  potentially broad;
- process-global cached tree: conflicts with per-window opaque ownership and
  private-state isolation;
- periodic polling: unnecessary because current observer events cover the
  required changes; and
- moving or querying Firefox's native sidebar/Library DOM: wrong ownership
  boundary and brittle UI dependency.

### 3.2 Observer behavior

The controller registers one callback for:

- `bookmark-added`;
- `bookmark-removed`;
- `bookmark-moved`;
- `bookmark-title-changed`; and
- `bookmark-url-changed`.

`Bookmarks.reorder()` emits moved notifications for reordered children. A move
contains current and old parents, so both loaded branches can be invalidated.
Tagging events are ignored because tags are not part of this MVP. Direct
non-descendant removal releases that item's opaque handle after notifying its
loaded parent.

Only parent GUIDs already known to the controller are converted to opaque IDs.
A batch above 128 records or above 16 affected parents becomes one fixed
all-scope event. Application refreshes coalesce in one microtask, re-fetch only
loaded branches, and never reveal the panel automatically. The exact event-type
array and callback are retained for paired `removeListener()` cleanup.

### 3.3 Opening and private-window behavior

At action time the bridge resolves the context-bound opaque ID and fetches the
current record again. This rejects removed/stale and foreign-window IDs before
opening and avoids targeting a URL captured by an old snapshot. Folders and
separators are not open actions.

The project rejects `javascript:`, `data:`, `vbscript:`, and `place:` before
native opening. Bookmarklets and executable/data collection targets require a
separate security issue. For a remaining bookmark, the bridge calls
`promiseNodeLikeFromFetchInfo()` and then `openNodeIn()` with:

- `current` or `tab`;
- `{ ownerWindow: currentWindow }`; and
- the already-validated normal/private window kind.

Current Firefox then runs its URL security/type check and `openTrustedLinkIn()`
path, records bookmark transition data for ordinary bookmarks, honors its
background-tab preference, and targets private opening correctly. In a private
window Firefox does not mark the page as a followed bookmark and forces private
targeting. Fennevia invents no principal, user-context/container ID, popup
allowance, telemetry call, or `loadURI` shortcut.

Firefox profile bookmarks are natively visible in private windows. Fennevia
does not pretend they are private data, but every view/controller/handle/
selection/expansion/focus/subscription stays per window and in memory. No
private browsing-derived value enters preferences, logs, or another window.

## 4. Compatibility canaries

The required current canaries were inspected at these heads on 2026-08-16:

| Repository | Head inspected | Result |
| --- | --- | --- |
| [`alice0775/userChrome.js`](https://github.com/alice0775/userChrome.js/tree/5e146e348a56a914e6c016d29733e8ee8d468155) | `5e146e348a56a914e6c016d29733e8ee8d468155` | Useful current browser-chrome compatibility signal, including bookmark/sidebar work, but its loader and native-DOM patterns are outside Fennevia's architecture. |
| [`MrOtherGuy/fx-autoconfig`](https://github.com/MrOtherGuy/fx-autoconfig/tree/dfdab5684faffc112b76ccb1d8cab7f75da0102c) | `dfdab5684faffc112b76ccb1d8cab7f75da0102c` | Current loader bootstrap/process compatibility signal; no bookmark bridge architecture was adopted. |
| [`xiaoxiaoflood/firefox-scripts`](https://github.com/xiaoxiaoflood/firefox-scripts/tree/a898ac59fb0ca3886c0c46b184fdbc037c83c037) | `a898ac59fb0ca3886c0c46b184fdbc037c83c037` | Compatibility signal for privileged script loading and Firefox changes; no generic loader or script-discovery behavior was adopted. |
| [`aminomancer/uc.css.js`](https://github.com/aminomancer/uc.css.js/tree/88514013ddc375f4770f4a35d8d07a91d6dd7d8f) | `88514013ddc375f4770f4a35d8d07a91d6dd7d8f` | Older Places/panel customizations helped locate concepts, but current Firefox source remained authoritative and no source or styling was copied. |

Repository README text alone was not treated as evidence. Relevant current
commits, source paths, open issues/pull requests, and concrete Firefox 153
symbols were checked. No canary code became a runtime dependency.

## 5. Product-reference provenance and no-copy boundary

The explicit product reference was
[`yutinglia/my-firefox-custom`](https://github.com/yutinglia/my-firefox-custom/tree/7a02f60bb23abe9c191c7fd8cd2a7096bb63aee5)
at commit `7a02f60bb23abe9c191c7fd8cd2a7096bb63aee5`.
The inspected files were:

- `autohide_rightside_bookmark_bar.uc/AutoHideRightsideBookmarkBar.uc.js`,
  blob `4707c96b5af63b41cdc412c82ac69d1c5a1fd0a6`, 78,130 bytes; and
- `autohide_rightside_bookmark_bar.uc/style.css`, blob
  `18351dbb6c0fba9eebb45af3b1900434a3f81f96`, 11,629 bytes.

The repository's `LICENSE` says MIT for the author's original work, although
GitHub's API reports `NOASSERTION`. Regardless of reuse permission, the issue's
design boundary was followed: the only retained concept is “compact bookmarks
available from the right edge.” No Places controller, observer code, DOM
structure, drag-and-drop logic, handler layout, timer, global flag, selector,
ID, class, icon, dimension, CSS value, native mutation, or visual composition
was copied or adapted.

Fennevia independently uses its typed bridge, opaque registry, ordinary state,
project-owned XHTML, existing ADR-026 controller, fixed bounds, root tablist,
nested list, paging, and frame-scoped glass styles. Drag-and-drop and bookmark
management are explicitly deferred.

## 6. Implementation record

Source owners:

- `src/firefox/bookmarks.ts`: privileged capability checks, root/page
  translation, observer, opaque handles, native opening, and cleanup;
- `src/app/bookmark-state.ts`: validation/copy boundary, immutable state,
  paging, expansion, event coalescing, focus resolution, and disposal;
- `src/shell/BookmarksPanel.svelte`: root selector, nested list, keyboard,
  opening controls, live/error states, and focus recovery;
- `src/shell/index.ts`: per-window adapter creation, mount/unmount, health, and
  capability integration;
- `src/shell/styles/edge-shell.css`: frame-rooted right-panel layout, glass,
  responsive, visible-focus, reduced-motion, and forced-colors styles; and
- `profile/chrome/fennevia/content/runtime/WindowShell.sys.mjs`: fixed module
  loader, per-window controller ownership, fail-open callbacks, health, and
  reverse cleanup.

Fixed limits:

| Control | Limit |
| --- | ---: |
| Title | 160 Unicode code points |
| Children per page | 32 |
| Page offset | 1,000,000 |
| Visible nested depth | 8 |
| Simultaneously expanded folders | 20 |
| Native event records before all-scope collapse | 128 |
| Affected parents before all-scope collapse | 16 |

The right panel uses the existing surface. It adds no host, edge trigger, timer,
window observer, z-index system, popup set, or browser geometry change. The
initial loading root is a temporary accessible tab/focus target; health waits
for four roots and the first bounded page. Root selection is a tablist, while
the partial/paged hierarchy is an ordinary list rather than an ARIA tree that
would falsely imply a complete model.

## 7. Security and privacy review

- Bookmark URLs remain in the privileged bridge and native opening helper.
- GUIDs and native records never cross to Svelte or DOM datasets.
- Titles are bounded, text-only, `dir=auto`, in-memory, and absent from logs.
- No bookmark tree, selection, expansion, scroll, or private state is persisted.
- No remote favicon, thumbnail, metadata, synchronization, analytics, or
  runtime network service was added.
- Executable/data/place schemes are rejected before native opening.
- Other schemes remain subject to Firefox's current native security check.
- Native Library, sidebar, toolbar, dialogs, `Ctrl+D`, and management remain
  visible and unchanged.
- Missing capability, initial page, observer, component, CSS, or bundle failure
  prevents health and leaves native UI usable.
- Generated artifacts remain one fixed IIFE, one CSS module, one notice, and
  one private ESM; no manifest mapping or dependency was added.

## 8. First causal runtime failure

The first real cold start after implementation did not reach a managed window.
The bridge itself emitted `bridge.boundary-ready`, then shell health produced
`FENNEVIA_SHELL_CAPABILITY_MISSING` and correctly disposed the boundary/hosts,
leaving native Firefox available.

The cause was initialization ordering: the synchronous frontend capability
walk required one default focus target for every edge before the asynchronous
bookmark roots had supplied the selected root button. The fix added a temporary
accessible loading tab/focus target. It disappears when the native roots arrive;
health then awaits roots plus the first bounded page and validates the selected
root/list/status. No Firefox API fallback or timing delay was added.

## 9. Automated and real Firefox evidence

Repository verification covers:

- immutable root/page contracts and URL/GUID non-exposure;
- lazy expansion, paging replacement and last-page normalization, event
  coalescing, and collapse cleanup;
- title code-point bounds, empty values, Unicode/bidi hostile text, and
  separators;
- HTTP(S), internal, file, private, current/new-tab, and rejected executable/
  data/place opening policy;
- stale, removed, foreign-window, malformed, missing capability, subscriber,
  event-burst, descendant-handle release, and exact observer-removal behavior;
- focus resolution that excludes separators and recovers after live deletion;
- deterministic frontend/bridge builds and static endpoint/CSS/native-selector
  gates; and
- lifecycle disposal and recovery mocks.

Real commands used placeholders here so no local path enters shared evidence:

```powershell
node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>'

node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>' `
  --browser-toolbox

pwsh -NoProfile -File .\tests\firefox-bridge-recovery.Tests.ps1 `
  -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe' `
  -ProfilePath '<FENNEVIA_DEV_PROFILE>'

pwsh -NoProfile -File .\tests\firefox-frontend-recovery.Tests.ps1 `
  -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe' `
  -ProfilePath '<FENNEVIA_DEV_PROFILE>'

pwsh -NoProfile -File .\tests\firefox-shell-recovery.Tests.ps1 `
  -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe' `
  -ProfilePath '<FENNEVIA_DEV_PROFILE>'
```

Observed results:

- cold/restart, initial normal, second normal, and private windows passed;
- the right panel stayed hidden at rest, used the existing pointer/keyboard/
  focus controller, preserved browser geometry, and dismissed/restored focus;
- native fixture create while hidden and rename/URL change, move, reorder, and
  focused delete while open all reconciled without polling;
- keyboard root selection, folder expansion/traversal, current-tab Enter, and
  Ctrl+Enter new-tab opening passed against loopback-only pages;
- hostile title markup remained literal text, no bookmark URL entered panel DOM,
  and deletion restored focus to the nearest surviving action;
- Browser Toolbox selected the shared frame and confirmed all five roots and
  descendants remained inside Fennevia's XHTML ownership boundary;
- normal logs contained no bookmark title, URL, GUID, folder content, or private
  activity and no unexpected first-party script error;
- missing base, bookmarks, tabs, and navigation capability runs each removed all
  project hosts and retained native browser UI;
- missing/throwing frontend, safe start, exact artifact restoration, and
  ordinary startup recovery passed; and
- every harness closed Firefox and restored/removed its controlled fixture and
  injected artifact in `finally`.

The native mutation fixture uses fixed project-test GUIDs only in the
marker-owned profile, verifies the exact target before use, and removes the
folder/bookmarks afterward. Its HTTP opening target is a loopback-only transient
server; no bookmark test request reaches an external service.

## 10. Remaining risks and update procedure

`PlacesUtils`, `PlacesUIUtils`, event WebIDL, `moz-src:///` module resolution,
fetch record shape, and `openNodeIn()` are Firefox internals. Before claiming a
new stable release:

1. verify the release build/tag and each source/blob dependency above;
2. inspect current call sites, tests, relevant Bugzilla/upstream history, and
   all four compatibility canaries;
3. rerun capability, record-shape, observer-field, reorder, private, and opening
   tests;
4. rebuild/reinstall through the exact package manifest;
5. rerun ordinary, Browser Toolbox, bookmarks capability, frontend, safe-start,
   and cleanup matrices; and
6. update this map through a new dated research record/ADR if semantics change.

Known intentional deferrals are bookmark management, drag-and-drop, search,
tags, keywords, history/smart collections, favicons/previews, sync UI,
bookmarklets, and native Library replacement. None is silently approximated by
the MVP.
