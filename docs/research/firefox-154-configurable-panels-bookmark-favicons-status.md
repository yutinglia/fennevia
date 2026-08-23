<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 154 configurable panels, bookmark favicons, and status presentation

## Status and scope

Recorded 2026-08-23 for the project-owner request to:

- open bookmark rows in a new tab with the middle button;
- display website favicons in the bookmark surface;
- swap the complete tabs/address and bookmarks side roles;
- disable the bottom downloads panel;
- select loading, downloads, or off for the top and bottom gutter lights; and
- improve Firefox's native corner status presentation while loading.

The implementation was prepared on branch `codex/configurable-edge-panels`
from project commit `292b37eea4850bc11faf6f22a0a2411cc7decc8c`.
The supported-source target is stock Firefox 154.0, BuildID
`20260812182057`, release channel, Windows x64. Firefox source is pinned at
commit `032a9fc1ac0cc3209f7c142744ba2e40847c8086`.
The accepted Firefox 153 boundary was also checked at official tag
`FIREFOX_153_0_4_RELEASE`, commit
`c178247e1dfea52241a6b18b18cf3a00f8da935c`: its favicon-service interface
exposes the same async query and its Places event enum includes
`favicon-changed`. This is source
compatibility evidence only, not a new runtime-validation claim.

This was a feature request, not a failure investigation, so there was no first
root runtime error or stack. Source review and local automated tests used the
repository state above. The clean development-profile real-Firefox visual,
Browser Console, Browser Toolbox, multi-window, theme/DPI, and accessibility
rows are explicitly `not run`; no compatibility or release claim is inferred
from source review.

## Upstream Firefox evidence

### Cached favicons

Firefox 154
[`nsIFaviconService.idl`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/toolkit/components/places/nsIFaviconService.idl)
defines asynchronous `getFaviconForPage(nsIURI, preferredWidth)`. It resolves
with an `nsIFavicon` when the Places database has page or root-domain data,
resolves null when no data exists, and rejects on database failure. The same
interface documents a 65,536-byte in-memory/favicon-protocol buffer limit.
Firefox 153.0.4's official
[`nsIFaviconService.idl`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/toolkit/components/places/nsIFaviconService.idl)
has the same `getFaviconForPage` promise, optional preferred-width argument,
null-on-miss contract, `nsIFavicon.dataURI`, and buffer limit.

Firefox's current
[`NewTabUtils.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/toolkit/modules/NewTabUtils.sys.mjs)
is a maintained call-site canary: it converts a page string with
`Services.io.newURI()`, scales the preferred small-icon width by device pixel
ratio, calls `PlacesUtils.favicons.getFaviconForPage()`, and converts stored
bytes/MIME data to a data URI for its own consumer. Fennevia independently
selects the smaller boundary of Firefox's returned `dataURI`: no alternate
scheme retry, largest-icon query, cache write, or network fallback.

Firefox 154
[`PlacesEvent.webidl`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/dom/chrome-webidl/PlacesEvent.webidl)
defines `favicon-changed` and exposes page URL, page GUID, and favicon URL on
that native event. Those fields are browsing-derived and are deliberately not
read by Fennevia; only the fixed event type is used to request a bounded
all-scope refresh.
The official Firefox 153.0.4
[`PlacesEvent.webidl`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/dom/chrome-webidl/PlacesEvent.webidl)
also defines the event and the same sensitive fields.

### Native corner status owner

Firefox 154
[`content-area.css`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/themes/shared/tabbrowser/content-area.css)
keeps `#statuspanel` pointer-transparent, absolutely positioned at the bottom
logical corner, mirrored for direction/available space, and responsible for
status/over-link visibility and transitions. The same file gives
`#statuspanel-label` its native color, border, padding, and corner treatment.

The minimum safe presentation change is therefore one active-only label rule
plus one forced-colors override. Fennevia does not replace or reparent the
status panel, hook `StatusPanel`, read/change its label, or alter its native
type, mirroring, transitions, hidden/inactive state, or pointer behavior.

## Compatibility-canary review

The four required maintained customization repositories were inspected on
2026-08-23 through their latest commit, current code search, and relevant
issues/pull requests. They are compatibility signals only; no code, selector
composition, numeric value, or visual design was copied.

- `alice0775/userChrome.js` latest commit
  `a39f5cb60d40d01a1ae6d65935db152e7ac23111` addresses Firefox's explicit
  unsafe-subscript opt-in. Its only `getFaviconForPage` hits are 2015 session-
  history patches last changed at
  `0671494f5a2ac7703639fa5edda9791addf3fb71`; that older synchronous shape is
  not current Firefox 154 evidence and was rejected.
- `MrOtherGuy/fx-autoconfig` latest commit
  `dfdab5684faffc112b76ccb1d8cab7f75da0102c` concerns actor definitions.
  Current code has no `getFaviconForPage` or `statuspanel-label` hit, and the
  issue results contain no concrete current fix relevant to this feature.
- `xiaoxiaoflood/firefox-scripts` latest commit
  `a898ac59fb0ca3886c0c46b184fdbc037c83c037` has a status-bar script whose
  last direct file commit, `a931205688ed45f7d31f1e877e8c421522efe146`,
  only added a toolbar access key. Open issue #404 reports Nightly 156 loader,
  `StatusPanel._label`, and removed-anchor breakage, but its proposed attachment
  is user-provided/unverified and rewrites native status internals and DOM.
  Fennevia does none of those things; this does not establish a Firefox 154
  change or justify adopting loader/status-bar baggage.
- `aminomancer/uc.css.js` latest commit
  `88514013ddc375f4770f4a35d8d07a91d6dd7d8f` and current `uc-misc.css`
  reference `#statuspanel-label`. The latest direct file commit
  `a5210e70ef2d3cb0c6500d7cfe13412c5f259fb1` changed an unrelated menu accel
  selector. It offers no current-version API or ownership evidence beyond the
  selector already established by official Firefox source.

No canary supplied a relevant Firefox 154 favicon/status compatibility fix.
Official source remains the decision basis.

## Selected Fennevia design

### Panel and light policy

One new strict version-1 `fennevia.customize.panels` preference joins the
existing privileged customize preference owner and prefix observer. It contains
only:

- `sidePanelLayout`: `tabs-left` or `tabs-right`;
- `bottomDownloadsEnabled`: boolean;
- `topProgressLight`: `loading`, `downloads`, or `off`; and
- `bottomProgressLight`: the same closed enum.

Defaults preserve the prior behavior. Unknown keys, malformed values, wrong
versions, and oversized strings fail safe. The top role cannot move. Side
features are complete paired roles rather than independently duplicable panel
types. The shared edge controller now owns a per-edge requested-enabled bit so
a disabled bottom edge stays disabled through customize/fullscreen/window-drag
suspension cycles. Role changes restore side focus, dismiss old surfaces, and
move any native tab-context-menu hold before components reconcile.

Each existing top/bottom light subscribes only to its selected existing typed
adapter. No source means no rendered light. The anonymous download bridge keeps
running when the bottom panel is disabled so the top light may still display
downloads and Firefox's native Downloads UI remains authoritative.

### Bookmark favicon and middle button

The optional favicon capabilities do not join activation health. For each
visible bookmark record, the bridge converts its already-private URL locally,
requests a DPI-aware 16–64 px cached icon, and accepts only base64 raster data
URIs (`avif`, `gif`, `jpeg`, `png`, ICO, or `webp`) no longer than 262,144
characters. That character cap safely contains Firefox's documented raw-byte
limit plus base64/data-URI overhead. Missing, null, rejected, SVG, remote, or
malformed output leaves the packaged `bookmark-item` icon visible. Queries for
one bounded 32-item page run concurrently and are awaited before publication;
disposal is checked again afterward.

The XHTML image has empty alt text because the bookmark button's bounded title
is already its accessible name. It uses property-only `src`, no-referrer,
non-draggable behavior, and deterministic error/disposal cleanup. No favicon
value enters HTML interpolation, CSS, a dataset, a log, persistence, drag data,
or a network request.

Middle `mousedown` prevents native autoscroll. Middle `auxclick` calls the
existing opaque-ID `new-tab` action; Firefox's existing bridge still re-fetches
the record, rejects blocked schemes, constructs the native node, and owns
normal/private/background-tab behavior.

### Native status capsule

The active/not-suspended label rule uses a 26 px minimum height, bounded width,
ellipsis, chrome tokens, a one-pixel border, 8 px radius, and restrained shadow.
The forced-colors rule uses `Canvas`, `CanvasText`, and no shadow. Adding those
two top-level rules changes the exact NativeUi health count from seven to nine.
Any partial style still suspends before per-window fail-open. Removing active or
disposing the controller immediately restores Firefox's untouched stylesheet.

## Rejected alternatives

- Arbitrary independent left/right panel types: would permit duplicate or
  missing required roles and complicate health/focus/native ownership.
- Moving the top bar: conflicts with the fixed caption/navigation and recovery
  architecture.
- Unmounting or stopping the Downloads bridge when the bottom panel is off:
  would break a top download light and couple privacy-safe state to presentation.
- Fetching a bookmark site's `/favicon.ico`, using a remote favicon URL, or
  retrying schemes: adds network/privacy behavior and bypasses Firefox's cache.
- Accepting SVG data or arbitrary internal URLs: unnecessarily broadens active
  image content at a system-principal boundary.
- Reimplementing or monkey-patching `StatusPanel`, moving its DOM, or creating a
  project status bar: duplicates a current Firefox owner and increases update
  risk. A narrowly scoped label presentation is sufficient.

## Validation and remaining evidence

Focused evidence completed during implementation:

```text
npm run typecheck
node --test tests/customize-model.test.mjs tests/toolbar-widgets-state.test.mjs tests/firefox-toolbar-widgets.test.mjs tests/edge-surfaces.test.mjs tests/bookmarks-ui.test.mjs tests/firefox-bookmarks.test.mjs
node --test tests/native-ui.test.mjs tests/tab-strip.test.mjs tests/source-structure.test.mjs
npm run verify
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\run-static-powershell-tests.ps1
```

Results at this stage: Svelte/TypeScript reported zero errors or warnings; the
first focused group passed 73/73; the native/tab/structure group passed after
updating the exact rule-count fixture and dynamic-edge assertions. The complete
ordinary gate passed with 351/351 Node tests, 87.51% line coverage, 79.58%
branch coverage, 95.30% function coverage, all fixed PowerShell 7 suites,
dependency review, deterministic frontend and bridge output, and 14/14 accepted
production artifacts. The same fixed PowerShell list passed under Windows
PowerShell 5.1. The build's exact Svelte runtime-diagnostic allowlist was
extended by `select_multiple_invalid_value`, which is now emitted by the
semantic panel-configuration `<select>` controls; all runtime diagnostic URLs
remain replaced by fixed local codes in the generated bundle.

Still `not run`:

- clean-profile Firefox 153 and 154 startup/restart and Browser Console review;
- default/swapped side roles in normal, second-normal, and private windows;
- side-role changes while focus, project menus, native tab menu, and customize
  holds are active;
- bottom disable/re-enable through keyboard, pointer, fullscreen, customize,
  window drag, and restart;
- all nine top/bottom light combinations while the panel is disabled/enabled;
- cached/missing/changed favicon behavior at 100/125/150/200% DPI, light/dark,
  forced colors, private windows, and Places capability failure;
- middle-click background preference and no-autoscroll behavior;
- native status label for loading, over-link, mirror/RTL, narrow/short windows,
  fullscreen/suspension/fail-open, light/dark, and forced colors; and
- Browser Toolbox confirmation that no native node is moved/replaced and all
  new preference observers, subscriptions, image handlers, and holds dispose.

No external implementation, CSS composition, asset, or generated code was
copied. `THIRD_PARTY_NOTICES.md` is unchanged.
