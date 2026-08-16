# Firefox 153 home action and new-tab left reveal

## Environment

- Date: 2026-08-17
- Firefox version: 153.0.4 release
- Build ID: `20260810162159`
- Channel: release
- Operating system: Windows 11, build `26200`
- Project branch: `feat/home-button-new-tab-highlight`
- Official GitHub tag: `FIREFOX_153_0_4_RELEASE` at
  [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)

This record documents a source-backed addition to the existing #12 navigation
bridge. Real Firefox Browser Console / Browser Toolbox validation of the new
Home control and new-tab highlight was `not run` during this change. CI unit,
type, and generated-artifact checks are the required gate.

## Goal

Add one top-row Home control that uses Firefox's current homepage policy, and
briefly reveal the left tab strip when a tab is opened after the left surface
already has its initial snapshot.

## Current Firefox behavior adopted

| Surface | Firefox 153 behavior used by Fennevia |
| --- | --- |
| Home action | [`browser-commands.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-commands.js) `BrowserCommands.home()` loads `HomePage.get(window)`, keeps observers/principal/pinned-or-hidden-tab fallback, and focuses content or the Urlbar for blank homepages. |
| Home command element | There is no `Browser:Home` command in this release. Bug 1492417 removed it. The retained `goHome` key in [`browser-sets.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-sets.js) calls `BrowserCommands.home()` with no event, which is the same no-argument path used by the project button. |
| Native toolbar widget | CustomizableUI still owns `home-button`. Fennevia does not click, clone, or require that widget. |
| New-tab detection | Existing #10 `TabOpen` reconciliation already publishes a complete tab snapshot. The left surface compares opaque IDs only and uses the #31 programmatic reveal hold. |

## Minimum Fennevia change selected

1. Require `window.BrowserCommands.home` as a navigation capability. Do not
   invent a `Browser:Home` command observer.
2. Keep homepage URL, `HomePage`, and homepage observers Firefox-owned.
3. Place Home after Reload/Stop in the existing primary cluster.
4. On later-added tab IDs, call `revealProgrammatically("left")` and apply a
   time-bounded `data-fennevia-just-opened` highlight with deterministic timer
   cleanup. Do not steal focus for non-left-surface new-tab paths.
5. Middle-click Back/Forward/Home/Reload copies only `button` and modifier
   booleans into `BrowserCommands.back`, `forward`, `home`, and
   `reloadOrDuplicate`. Firefox's `whereToOpenLink` still chooses current vs
   new-tab. The left-click Reload/Stop control remains `reloadOrStop()`.

## Rejected alternatives

- Clicking the native `home-button` widget. Rejected because the widget may be
  absent from the navbar and because Svelte must not operate Firefox-owned DOM.
- Reconstructing homepage URLs from preferences. Rejected because that would
  copy browsing-adjacent configuration across the bridge.
- A second left-edge hide timer. Rejected by the #31 shared reveal contract.

## Validation

- Unit coverage for `home()` adapter/bridge forwarding, missing
  `BrowserCommands.home`, opened-tab ID detection, and source/CSS contracts.
- Real Firefox Home click, Alt+Home comparison, Ctrl+T left reveal, and
  highlight timing: `not run`.
