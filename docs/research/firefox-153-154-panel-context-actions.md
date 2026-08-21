# Firefox 153/154 four-panel context actions and tab drag preview research

## Environment

- Date: 2026-08-21–22
- Firefox versions: 153.0.4 release and 154.0 release
- Build IDs: `20260810162159` and `20260812182057`
- Channel: release
- Operating system: Windows 11 25H2, version `10.0.26200.0`, x64
- Profile state: user-supplied ordinary-runtime screenshot; clean development
  profile and Browser Toolbox reproduction: **not run**
- Project base commit:
  `a8e44b35641ff54485a98447fe958abc2e7635dc`
- Official Firefox commits:
  [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)
  (153.0.4) and
  [`032a9fc1ac0cc3209f7c142744ba2e40847c8086`](https://github.com/mozilla-firefox/firefox/commit/032a9fc1ac0cc3209f7c142744ba2e40847c8086)
  (154.0)

## Symptom and requested scope

The left tab strip opened Firefox's native tab context menu, but many static
labels were blank while dynamic items such as Split View, Mute Tab, and Ask an
AI Chatbot remained visible. Opening the menu also revealed the original
Firefox chrome. The requested scope additionally requires useful right-click
actions on all four Fennevia edge panels and a visible drag-and-drop preview on
the left tab strip.

## First causal evidence

Firefox 153 and 154 install a capture `contextmenu` listener, plus prewarm
`mouseover` and `focus` listeners, on the native tab container. That listener
calls synchronous `gBrowser.translateTabContextMenu()` and then removes itself.
The method inserts `browser/tabContextMenu.ftl`, changes every
`[data-lazy-l10n-id]` below `#tabContextMenu` to `data-l10n-id`, and marks the
menu translated. Fennevia called `#tabContextMenu.openPopup(nativeTab, ...)`
directly, so no event crossed the hidden native tab container and the static
labels stayed lazy and blank. Dynamic labels do not use the lazy attribute,
which exactly matches the supplied screenshot.

The same direct popup was anchored to a Firefox-owned native tab. Fennevia's
NativeUi popup observer classifies a managed native anchor as a reason to
reveal original chrome unless the popup ID has an active handoff token. The
tabs bridge had no `beginPopupHandoff("tabContextMenu")` call, so opening the
menu revealed the hidden toolbar.

The relevant official source pins are:

| Behavior | Firefox 153 | Firefox 154 |
| --- | --- | --- |
| `tabbrowser.js` lazy listener and `translateTabContextMenu()` | blob `c42b1a1a8df6b38886c17f71ea88e5aaa7eebc80` | blob `39b5babee5942427a82a7a64ad69e1b16efebcc1` |
| `main-popupset.inc.xhtml` lazy tab-menu IDs | blob `2338bac0003a2fff81a7dabc6d268e5ff67e8189` | blob `7bc6cd82d4961d3ffc3c8e58b95c3bc8d3bf43c8` |
| `browser-places.js` `PlacesCommandHook.showPlacesOrganizer(item)` | blob `6531738de0282c7608b444d1172b3efd53275503` | blob `f92da6b10e40b861c84f505588f68a9bb6637234` |
| `places-commands.js` `Browser:ShowAllBookmarks` owner | blob `53043c1bf79fb30f36ae0397a5a6fd141d3d3819` | blob `53043c1bf79fb30f36ae0397a5a6fd141d3d3819` |

In both releases, `Browser:ShowAllBookmarks` delegates to
`PlacesCommandHook.showPlacesOrganizer("UnfiledBookmarks")`. This is the
smallest current-window owner for the right panel's fixed Manage Bookmarks
action; it preserves Firefox's Library window reuse and selection behavior.

## Compatibility canaries checked

- Alice0775/userChrome.js head
  [`8481c32e00f1cf14295322a7a1d59075d419405a`](https://github.com/alice0775/userChrome.js/commit/8481c32e00f1cf14295322a7a1d59075d419405a)
- MrOtherGuy/fx-autoconfig head
  [`dfdab5684faffc112b76ccb1d8cab7f75da0102c`](https://github.com/MrOtherGuy/fx-autoconfig/commit/dfdab5684faffc112b76ccb1d8cab7f75da0102c)
- xiaoxiaoflood/firefox-scripts head
  [`a898ac59fb0ca3886c0c46b184fdbc037c83c037`](https://github.com/xiaoxiaoflood/firefox-scripts/commit/a898ac59fb0ca3886c0c46b184fdbc037c83c037)
- aminomancer/uc.css.js head
  [`88514013ddc375f4770f4a35d8d07a91d6dd7d8f`](https://github.com/aminomancer/uc.css.js/commit/88514013ddc375f4770f4a35d8d07a91d6dd7d8f)

Their current code, recent changes, issues, and pull requests did not expose a
smaller Fennevia-specific adaptation. No canary code, selector, timer, visual
composition, or numeric value was copied.

## Options considered

1. Copy every Firefox tab-menu label into Svelte. Rejected because Firefox owns
   dynamic policy and Fluent strings, and the menu changes across releases.
2. Synthesize a native `contextmenu` event on the collapsed tab container.
   Rejected because it adds event-target coupling and is less direct than the
   current synchronous owner method.
3. Call `gBrowser.translateTabContextMenu()`, acquire the existing NativeUi
   token, then open with the real native tab. Selected.
4. Reuse native tab or Places context menus for every Fennevia panel. Rejected:
   their target contracts require native tab/tree nodes and would leak or fake
   privileged ownership.
5. Add broad cloned menus with disabled placeholders. Rejected because actions
   must be useful, capability-backed, and truthful.
6. Use a screenshot thumbnail as the drag preview. Rejected because it would
   capture browsing-derived text and add bitmap lifecycle work. The browser's
   drag image of the existing project-owned tab button plus a CSS insertion
   marker is sufficient.

## Decision and minimum adaptation

- The tabs bridge now requires
  `window.gBrowser.translateTabContextMenu`, calls it before `openPopup`, and
  wraps the native popup lifetime in
  `NativeUi.beginPopupHandoff("tabContextMenu")` /
  `endPopupHandoff("tabContextMenu")`. Open failure, `popuphidden`, and bridge
  disposal all release the token deterministically.
- Tab drag uses the existing opaque tab ID only. `setDragImage()` provides the
  immediate browser drag ghost; one calculated `before`/`after` marker shows
  the valid bounded insertion point. Drag leave, mismatched payload, drop,
  drag end, and component disposal clear both preview state and the existing
  left pointer hold. Keyboard reorder remains available.
- Each project-owned edge panel owns one bounded common context menu:
  - top: Firefox Settings;
  - left blank area: New Tab, while a tab row retains Firefox's complete native
    tab context menu;
  - right blank area: Manage Bookmarks, while a bookmark row adds Open, Open in
    New Tab, or Expand/Collapse plus Manage Bookmarks;
  - bottom: Open Firefox Downloads.
- Available common actions also expose Customize Fennevia, Customize Firefox
  Toolbar, and Show Original Firefox Toolbar. They delegate to existing typed
  adapters and native owners rather than adding another privileged frontend
  path.
- Menus clamp to the project frame, use `role="menu"`/`menuitem`, focus the
  first action, support Arrow/Home/End and Escape, restore keyboard focus, use
  the existing per-edge popup hold, remain open across pointer exit, close on
  outside pointer or window blur, and remove every listener/hold during
  disposal. The panel-level native listener returns without consuming
  tab/bookmark item events so their delegated Svelte owners can stop
  propagation after opening the specific action set. Pointer-origin menus
  explicitly blur their focused menu item before teardown; keyboard dismissal
  alone restores its initiating control.

## Owner-reported runtime regression and correction

On 2026-08-22, the project owner reported that opening any common edge context
menu could leave its panel unable to auto-hide and that tab rows no longer
opened Firefox's native menu. The exact Firefox build was not recaptured, so
this report is runtime evidence for the regression but not a completed
Firefox-version matrix row.

Local event-order inspection found two first causes in the new project-owned
component:

- its native panel listener recognized tab/bookmark descendants but then
  called `preventDefault()` and `stopPropagation()` before Svelte's delegated
  descendant handler ran, suppressing the tab menu entirely;
- it focused the first menu action and then removed that focused node without
  an explicit blur. Releasing only the popup hold did not deterministically
  release the shared root focus hold.

The correction makes the parent guard a non-consuming return, blurs focused
pointer-origin menu content before DOM removal, retains focus restoration for
keyboard dismissal, and applies the same focus correction to the bounded
bookmark-row menu. An initial same-day correction also closed on panel pointer
exit; the owner clarified that this diverged from Firefox's native interaction,
so the final behavior retains both menu and working-panel holds across pointer
movement and dismisses only on an outside press or another explicit close
path. No Firefox internal, privilege boundary, or data flow changed.

## Security and privacy effects

- Fixed menu labels and fixed action names are the only new common-menu state.
- Bookmark titles remain text-only existing row content. The menu carries only
  an opaque bookmark ID; no URL, GUID, Places record, native node, or Library
  window crosses into Svelte or diagnostics.
- Tab drag carries only the existing context-bound opaque tab ID. No title,
  URL, thumbnail, favicon bytes, or private-window state is persisted or
  logged.
- `PlacesCommandHook`, native tabs, `#tabContextMenu`, and NativeUi tokens stay
  inside `src/firefox/` or the privileged runtime boundary.
- No dependency, network resource, preference, remote asset, telemetry, or new
  log field is introduced.

## Validation performed

- Firefox 153/154 official-source and four-canary review: completed.
- `npm run typecheck`: passed with zero errors and warnings.
- `npm run lint`: passed.
- Focused state, bridge, localization, component-contract, context-menu, and
  drag-preview tests: 49 passed after adding the two explicit missing-capability
  cases.
- `npm run verify`: passed; 280/280 Node tests, 87.63% line coverage, 95.29%
  function coverage, formatting, lint, typecheck, fixed PowerShell suites,
  dependency audit, deterministic build, and 14-artifact production scan all
  passed.
- Windows PowerShell 5.1 fixed static suite: passed independently with every
  fixed-list suite successful.
- Real Firefox 153.0.4/154 ordinary, private, second-window, Browser Toolbox,
  popup placement, and failure-injection rows: **not run**.
- The 2026-08-22 owner-reported auto-hide/tab-menu regression was reproduced by
  source event-order analysis and covered by focused routing,
  focus-before-DOM-removal, pointer-exit retention, outside-click cleanup, and
  native-menu bridge contracts. A repeated real-Firefox confirmation remains
  **not run**.

## Remaining compatibility risk

`gBrowser.translateTabContextMenu`, `PlacesCommandHook`, and the exact popup ID
are unsupported Firefox frontend internals. They are required capability checks
with version/build diagnostics and fail open to retained native Firefox UI if
they drift. The source sequence is identical across the supported 153/154
boundary, but the final real-Firefox interaction matrix remains release work.
