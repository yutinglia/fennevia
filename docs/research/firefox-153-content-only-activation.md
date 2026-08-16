# Firefox 153 content-only activation research

## Environment

- Date: 2026-08-16
- Firefox version: 153.0.4 release
- Build ID: `20260810162159`
- Channel: release
- Operating system: Windows 11 Pro 25H2, build `26200.9168`
- Profile: marker-owned `fennevia-dev`
- Program: marker-owned copy of the stock Firefox installation
- Project base commit: `189fd0a8732ae2e66411e8b48c6e7357cd3d362b`
  plus the issue #15 worktree
- Package: `0.10.0-dev`
- Official release commit:
  [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)

Only this Firefox release and Windows environment were validated. This record
makes no Linux, macOS, ESR, Beta, Nightly, touch, or later-release support
claim.

## Goal and observed starting point

Issues #7, #31, #11, #12, #13, #14, #32, and #37 had already passed while
Firefox native UI remained visible. Issue #15 performs the final, explicit
`healthy -> active` transition and makes replaceable native chrome transient.
It does not delete, reparent, clone, or let Svelte reconcile any Firefox-owned
node.

The first active runtime measurement found:

- all five Fennevia roots mounted and healthy;
- all four edge panels hidden and inert at rest;
- the frame still exactly matched `#browser` geometry and reserved no layout;
- horizontal `#TabsToolbar > .toolbar-items` and `#nav-bar` computed to
  `visibility: collapse` under the active gate;
- the bookmarks toolbar and exact native sidebar surfaces were collapsed;
- two current Firefox titlebar close-button instances remained rendered;
- `#notifications-toolbar`, popup infrastructure, `#tabbrowser-tabbox`, and
  the selected browser remained attached and project-untouched.

The first causal runtime defect found during the matrix was a stale native
focus hold after Firefox closed a sidebar panel and focused the selected
content browser. The fix releases the hold on any `focusin` outside the exact
managed native areas. A second teardown-only observation showed Firefox
removing `<sidebar-main>` while a private window closes; structural validation
is therefore coalesced to the next event-loop turn so the owning window
lifecycle can dispose first. Style corruption still fails synchronously.

## Current Firefox source pins

| Source | Relevant ownership |
| --- | --- |
| [`browser.xhtml`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/browser.xhtml) | Main browser document, popup sets, toolbox/browser ordering, commands, dialogs, and retained browser infrastructure |
| [`navigator-toolbox.inc.xhtml`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/navigator-toolbox.inc.xhtml) | Menubar, tab toolbar, navbar, Urlbar trust/permission/page-action slots, bookmarks toolbar, notifications toolbar, and titlebar-control placements |
| [`titlebar-items.inc.xhtml`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/titlebar-items.inc.xhtml) | Native minimize, maximize, restore, and close controls |
| [`browser-box.inc.xhtml`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/browser-box.inc.xhtml) | `#sidebar-container`, both sidebar splitters, `#sidebar-box`, and `#tabbrowser-tabbox` direct ownership |
| [`tabbrowser.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/tabbrowser/content/tabbrowser.js) | `TabBarVisibility`; native vertical tabs collapse `#TabsToolbar` and make `#nav-bar` a titlebar owner |
| [`browser-sidebar.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/sidebar/browser-sidebar.js) | Native sidebar registration, show/hide lifecycle, extension sidebars, launcher state, and panel focus restoration |
| [`CustomizeMode.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/customizableui/CustomizeMode.sys.mjs) | `beforecustomization`, `customizationready`, root `customizing`, and `aftercustomization` transition contract |
| [`fullscreen-and-pointerlock.css`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/themes/shared/tabbrowser/fullscreen-and-pointerlock.css) | Firefox-owned DOM-fullscreen toolbox/sidebar collapse and fullscreen warning behavior |
| [`browser-fullScreenAndPointerLock.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/browser-fullScreenAndPointerLock.js) | Browser-fullscreen autohide, focus and popup holds, and DOM-fullscreen transitions |

The complete Urlbar source inventory remains in
`docs/research/firefox-153-urlbar-coverage.md`. The implementation depends on
these unsupported internals only through `NativeUi.sys.mjs` and the existing
`src/firefox/` bridge boundary.

## Native-UI coverage inventory

“Hidden” below always means reversible CSS under
`:root#main-window[data-fennevia-active]` while neither reveal nor suspension
is present. Clearing `active` restores Firefox CSS participation immediately.

| Native owner/surface | Active resting treatment | Replacement or reason | Retained path and failure behavior | Real evidence |
| --- | --- | --- | --- | --- |
| `#TabsToolbar > .toolbar-items` in horizontal-tab mode | Collapsed; `#TabsToolbar` itself is retained | #11 left vertical tabs and #12 New Tab | Native keyboard/commands remain; toolbox hover/focus reveals native toolbar; any lifecycle failure clears active | Rest geometry, tab actions, second/private isolation, partial-CSS fail-open |
| `#nav-bar` in horizontal-tab mode | Collapsed as one reversible surface | #12 navigation, #13 launcher/popup, #14 bookmarks, #32 status, and #37 fixed detail | Toolbox hover/focus reveals the complete navbar; #37 synchronously reveals before `openLocation()`; native Downloads/App menu and all descendants remain operable | Native Urlbar identity/ETP/permission/page-action matrix, Downloads popup hold, sidebar path |
| Direct nav content while toolbox has `tabs-hidden` | Exact direct nav children collapse; navbar/titlebar owner remains | Same feature set, without hiding native caption controls | Clearing active or native reveal restores every direct child | Source-validated alternate rule; static exact-target test |
| `.titlebar-buttonbox-container` in menubar, tab toolbar, and navbar | Never project-targeted | No replacement | Firefox and Windows retain minimize/maximize/restore/close behavior | Presence and rendered close controls checked in active and fail-open states |
| `#PersonalToolbar` | Collapsed | #14 right-edge bookmark access | `Ctrl+D`, Library, bookmark dialogs, and revealed native navbar/menu remain; fallback restores toolbar state | Bookmark matrix plus active-rest CSS measurement |
| `#notifications-toolbar` | Never project-targeted | Native notification owner | Always retained; Firefox decides its own visibility | Exact target inventory and static selector rejection |
| `#sidebar-container`, `#sidebar-launcher-splitter`, `#sidebar-box`, `#sidebar-splitter` | Collapsed only while no native panel is open | #11 tabs and #14 bookmarks cover only their reviewed functions | F9/revealed toolbar can open native and extension sidebars; an open native sidebar holds the complete native reveal until Firefox hides it; fallback restores immediately | Real History sidebar show/hold/hide and focus-return test |
| Urlbar identity, HTTPS/trust, ETP, permission, notification-anchor, search-mode, page-action, extension-action, and suggestion owners | Remain attached inside transient navbar | Compact left launcher shows Firefox-derived HTTPS/connection and ETP; centered popup shows fixed detail | **Open full Firefox address bar** reveals/focuses native Urlbar before `openLocation()`; the reveal remains for focus/popup and hides after return | HTTP/HTTPS/error/permission/ETP/zoom coverage from #37 plus active handoff owner/geometry test |
| App menu, account/sync, extension, overflow, page-action, and Downloads toolbar controls | Remain attached inside transient navbar | No complete custom replacement | Toolbox pointer/focus, native commands, and Urlbar handoff reveal the owning navbar; anchored popups hold reveal | Real Downloads panel open/hold/close; complete nav ownership check |
| Native sidebar extensions and unsupported sidebar tools | Remain attached; exact sidebar surfaces become visible when open | No replacement | F9 or revealed native controls; opening a panel overrides resting collapse | Real History panel exercises the same native controller/path; extension contents are not inspected or copied |
| Find bar and in-content browser UI | Never project-targeted | No replacement | Native command and content stack remain | Exact selectors omit these owners; `#tabbrowser-tabbox` remains present |
| Permission, authentication, certificate, extension-install, file-picker, download-safety, and browser notification UI | Never project-targeted | No replacement | Firefox popup/dialog/notification infrastructure remains attached and stacks outside the pointer-transparent frame | Native modal hit test, Urlbar/native Downloads paths, Browser Toolbox ownership walk |
| Popup sets and anchored panels | Never hidden or reparented | No replacement | A popup anchored in managed native UI holds reveal through `popuphidden`; Firefox remains popup owner | Unit popup matrix and real Downloads panel hold |
| `#window-modal-dialog` and tab dialogs | Never project-targeted | No replacement | Native-dialog state suspends native hiding and hides Fennevia surfaces | Real modal stacking test and suspension unit matrix |
| Browser DevTools and Browser Toolbox | Never project-targeted | No replacement | Browser Toolbox uses its own process/window; docked DevTools stays in retained browser infrastructure | Browser Toolbox namespace/ownership probe |
| `#tabbrowser-tabbox`, selected browser, commands, controllers, SessionStore, Places, and Downloads backend | Never hidden, removed, or reparented | Required infrastructure | Existing native semantics continue; every adapter failure follows ADR-021 | Complete lifecycle/feature/recovery suites |

## Selected visibility architecture

`NativeUi.sys.mjs` validates one exact Firefox 153 target graph and installs one
project-owned XHTML `<style>` below the Fennevia frame. The sheet has exactly
five rules:

1. horizontal native tab items;
2. horizontal navbar;
3. direct navbar content for native vertical-tab mode;
4. bookmarks toolbar;
5. exact native sidebar container/box/splitters.

Every rule requires the active marker and the absence of both
`data-fennevia-native-ui-revealed` and
`data-fennevia-native-ui-suspended`. The controller rejects unsupported popup,
taskbar-tab, AI, hidden-toolbar, malformed target, or malformed titlebar
windows before activation. It requires exact style identity, text, parent, and
five parsed CSS rules. A missing, changed, or partially parsed sheet requests
the existing per-window fail-open lifecycle; the controller sets suspension
before reporting so native UI is visible even before reverse cleanup finishes.

Reveal is held by native toolbox pointer, current native focus, anchored native
popups, the explicit Urlbar handoff, or an open native sidebar. Holds are
per-window and clear after Firefox focus returns to web content. Customize mode
suspends through `aftercustomization`; native-dialog state also suspends. DOM
fullscreen suspends project hiding while Firefox's own fullscreen stylesheet
continues to suppress browser chrome, so Fennevia cannot violate the page's
fullscreen security presentation. Browser fullscreen keeps the active shell
and Firefox's own autohide policy.

The controller owns every listener, timer, animation frame, observer, root
attribute, and style node and removes them deterministically. Structural
mutation checks are coalesced by one zero-delay timer to distinguish stable
ownership changes from Firefox window teardown. Style character changes remain
immediate. No interval, polling loop, native-node relocation, negative offset,
or complete toolbox rule is used.

## Rejected alternatives

- Hiding `#navigator-toolbox`: rejects notification and titlebar ownership and
  breaks native vertical-tab mode.
- Hiding all of `#TabsToolbar`: removes current Windows caption controls in
  horizontal mode.
- Always hiding all of `#nav-bar`: removes caption controls when Firefox native
  vertical tabs set `tabs-hidden`.
- Moving native Urlbar, sidebar, or caption nodes into project hosts: breaks
  Firefox ownership and customization assumptions.
- Fixed negative offsets or copied userChrome z-index/layout recipes: not tied
  to current source ownership and difficult to restore atomically.
- Rebuilding app menu, extension actions, identity panels, or Urlbar providers:
  exceeds the reviewed bridge and duplicates security-sensitive behavior.

## Compatibility canaries and product reference

The following heads were rechecked on 2026-08-16 as compatibility signals,
not dependencies:

- `alice0775/userChrome.js@5e146e348a56a914e6c016d29733e8ee8d468155`
- `MrOtherGuy/fx-autoconfig@dfdab5684faffc112b76ccb1d8cab7f75da0102c`
- `xiaoxiaoflood/firefox-scripts@a898ac59fb0ca3886c0c46b184fdbc037c83c037`
- `aminomancer/uc.css.js@88514013ddc375f4770f4a35d8d07a91d6dd7d8f`

The canaries support popup/focus/customize holds and current-loader
compatibility, but their generic-loader concerns, complete override sets,
fixed offsets, broad selectors, and compatibility branches were not adopted.

`yutinglia/my-firefox-custom@7a02f60bb23abe9c191c7fd8cd2a7096bb63aee5`
was inspected only for product behavior: content-first edge access and
focus/popup/customize holds. Its GitHub license metadata reports
`NOASSERTION`. No code, selector, timing, offset, z-index, timer, native-DOM
relocation, caption implementation, layout, or visual value was copied or
adapted.

## Validation record

Repository checks:

```powershell
npm run verify
pwsh -NoProfile -File .\tests\shell-health.Tests.ps1
node --check .\tests\firefox-window-lifecycle.mjs
```

Real Firefox checks use local paths represented here by placeholders:

```powershell
node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>'

node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>' `
  --browser-toolbox
```

The ordinary real-Firefox matrix covers active cold start; four hidden resting
surfaces; preserved browser geometry; every edge pointer/keyboard/focus/corner
contract; compact HTTPS/ETP status; centered detail; complete native Urlbar
handoff and release; native Downloads popup hold; native History sidebar
hold; real customize enter/exit; real browser fullscreen enter/exit; simulated
DOM-fullscreen owner attribute; native modal stacking; normal, second-normal,
and private isolation; narrow/short moved resize, maximize, minimize, restore;
emergency fallback; partial activation CSS in an independent window; missing
insertion point; runtime stop; and no unexpected first-party Browser Console
error.

Failure/recovery suites from #7, #12–#14, #32, and #37 remain part of the
evidence for missing entry, frontend bundle, shell CSS, bridge capabilities,
feature callbacks, health timeout, safe start, disable, and uninstall. The PR
records the exact commands and final observed counts. Real hard-disable startup
produced zero Fennevia records/hosts, and real exact uninstall produced stock
startup with no owned-file residue; re-enable/reinstall restored the complete
active matrix without startup-cache clearing.

The final Browser Toolbox variant repeated the complete matrix after the
window-state coverage was added. Inspector selected the shared project frame,
confirmed all four edge roots plus the address-overlay root were project-owned
XHTML, and the run reported no unexpected first-party script errors.

That final rerun used a writable copy of the same stock Firefox 153.0.4 program
tree after the selected system program root no longer retained the program half
of an earlier development-only ownership pair. Source and copy file counts and
total byte counts matched before the copy was marked as a test target. A clean
23-operation install and exact 23-operation uninstall both passed; the copied
program, temporary backup, profile package, ownership metadata, and Firefox
processes were absent afterward. Repair behavior for this Firefox-update case
belongs to hardening issue #16 and does not change the #15 runtime policy.

## Remaining risk and update trigger

All target IDs, direct-parent relations, custom elements, titlebar placements,
global controllers, events, and attributes are unsupported Firefox internals.
The exact validator deliberately fails open after a Firefox layout change.
Revalidate this entire inventory, both tab-layout branches, native focus/popup
holds, and CSS geometry against every newly supported Firefox stable before
claiming compatibility.
