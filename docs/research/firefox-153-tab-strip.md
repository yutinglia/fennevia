# Firefox 153 custom tab strip research

## Environment

- Date: 2026-08-15
- Firefox version: 153.0.4 release
- Build ID: `20260810162159`
- Channel: release
- Operating system: Windows 11 Pro 25H2, build `26200.9168`
- Profile: clean, unregistered, marker-owned `fennevia-dev`
- Project commit: `8923ad2e8cfff2cb882f53f6e5df678634b730b1` plus the
  issue #11 worktree
- Firefox release source stamp: `54be19de0e08edff0b797e55fd935dd3978b0a6d`
- Official GitHub tag: `FIREFOX_153_0_4_RELEASE` at
  [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)

## Symptom

Issue #11 needed to turn the ordinary tab state and actions from issue #10 into
the first usable Svelte tab strip. The native tab strip had to remain visible
and unchanged, so the work needed an accessible project-owned composite that
could tolerate long page-derived titles, failed favicons, pinned tabs, many
tabs, native close animation, multiple windows, and complete disposal without
claiming ownership of Firefox's content panels.

Three causal failures appeared during the real-Firefox spike:

1. The first custom new-tab activation reached Firefox but failed because the
   bridge passed a frozen options record to `addTrustedTab`.
2. A selected-tab close could let Firefox's native close animation move focus
   after the Svelte component had already restored it.
3. Browser Toolbox reported XUL descendants below the XHTML tab-strip host when
   horizontal overflow created browser-owned anonymous scrollbars.

## Minimal reproduction

1. Build and install the exact generated package into the marker-owned copied
   Firefox program and development profile.
2. Start one existing normal window, a second normal window, and a private
   window while keeping Firefox's native tab strip visible.
3. In the custom strip, create enough tabs to overflow horizontally; apply a
   long markup-like bidirectional label, loading state, and an invalid raster
   favicon; then pin, unpin, select, and close tabs.
4. Navigate with LTR and RTL Arrow keys, Home, End, Enter, Space, and Delete;
   close both background and selected tabs and inspect the resulting focus.
5. Close windows, trigger emergency fallback, directly unmount/remount the
   frontend, stop the runtime, and verify that hosts, listeners, image handlers,
   timers, and ordinary state are removed.
6. Repeat with Browser Toolbox Inspector and with missing bridge capabilities
   injected before restoring the exact installed artifact.

## First causal evidence

- Browser Console: Firefox 153's `addTrustedTab` threw
  `TypeError: can't define property "triggeringPrincipal": Object is not
  extensible`. The first stack reached
  `window.gBrowser.addTrustedTab`; later UI symptoms were consequences.
- Official source: `addTrustedTab(aURI, options = {})` assigns
  `options.triggeringPrincipal` before forwarding to `addTab`. Native-call
  options therefore have a current writable-object contract even though
  Fennevia's public options and state remain frozen.
- Focus smoke: repeated selected-tab close produced no first-party console
  exception, but the final active element intermittently moved away from the
  intended neighboring tab after immediate focus restoration. One delayed
  recheck after the native close animation removed the race.
- Browser Toolbox: the only unexpected XUL descendants were native-anonymous
  scrollbar nodes generated for the XHTML overflow container. Firefox's
  `NodeFront.isNativeAnonymous` identifies this browser-owned subtree; project
  source still creates XHTML descendants only.

## Sources checked

### Accessibility and platform guidance

- WAI-ARIA Authoring Practices
  [Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) and
  [Tabs with Automatic Activation](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/examples/tabs-actions/):
  `tablist`, `tab`, selected semantics, one tab stop, Arrow/Home/End navigation,
  optional Delete, and focus movement after close.
- WAI-ARIA Authoring Practices
  [Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/):
  visible focus, predictable movement, and persistent focus after an operation
  removes the focused control.

`aria-controls` was deliberately omitted. Fennevia does not own a corresponding
tab panel, and application code must not depend on or expose a Firefox-owned DOM
ID merely to imply ownership it does not have.

### Official Firefox and Searchfox

- Firefox 153
  [`tabbox.js` keyboard handling](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/toolkit/content/widgets/tabbox.js#L705-L760):
  direct selection on direction-aware Arrow keys plus Home and End.
- Firefox 153
  [`tabbrowser.js` `addTrustedTab`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tabbrowser.js#L3255-L3258):
  mutates the supplied options record by assigning the system principal.
- Firefox 153
  [`tabbrowser.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tabbrowser.js):
  `removeTab`, selected replacement, pin/unpin, and close animation behavior.
- Firefox 153 DevTools
  [`NodeFront.isNativeAnonymous`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/devtools/client/fronts/node.js):
  the Inspector distinction between author/project nodes and browser-generated
  native-anonymous content.

### Compatibility canaries

- Alice0775/userChrome.js head
  [`5e146e348a56a914e6c016d29733e8ee8d468155`](https://github.com/alice0775/userChrome.js/commit/5e146e348a56a914e6c016d29733e8ee8d468155)
- MrOtherGuy/fx-autoconfig head
  [`dfdab5684faffc112b76ccb1d8cab7f75da0102c`](https://github.com/MrOtherGuy/fx-autoconfig/commit/dfdab5684faffc112b76ccb1d8cab7f75da0102c)
- xiaoxiaoflood/firefox-scripts head
  [`a898ac59fb0ca3886c0c46b184fdbc037c83c037`](https://github.com/xiaoxiaoflood/firefox-scripts/commit/a898ac59fb0ca3886c0c46b184fdbc037c83c037)
- aminomancer/uc.css.js head
  [`88514013ddc375f4770f4a35d8d07a91d6dd7d8f`](https://github.com/aminomancer/uc.css.js/commit/88514013ddc375f4770f4a35d8d07a91d6dd7d8f)

The canaries confirmed that current customizations still consume Firefox's tab
events and native surfaces, but none supplied a smaller accessible owned-shell
contract than the issue #10 bridge. No canary code was copied, so no third-party
runtime code or license obligation was introduced.

## Upstream behavior

| Surface | Firefox 153 behavior relevant to the strip |
|---|---|
| Keyboard tabs | Firefox's tab widget uses orientation and computed direction for Arrow movement, wraps, and directly selects on Arrow/Home/End. |
| `addTrustedTab` | Mutates its supplied options record to add `triggeringPrincipal`; a frozen record fails before tab creation. |
| `removeTab` | May animate and asynchronously finish native tab teardown, so focus can move again after a synchronous close action returns. |
| Overflow | An XHTML `overflow-x: auto` element can receive browser-owned native-anonymous XUL scrollbar descendants. Those nodes are not authored or managed by Svelte. |
| Native tab strip | Remains Firefox-owned and visible; the custom strip is a synchronized comparison/fallback surface, not a replacement in this milestone. |

## Loader-specific baggage identified

- Generic `.uc.js` discovery, metadata, sandboxes, historical Firefox branches,
  and loader compatibility abstractions do not help the owned Svelte strip.
- Mirroring or replacing native tab classes, drag controllers, tab-group DOM,
  context menus, or native panels would expand issue #11 beyond its bridge and
  ownership boundaries.
- Native-anonymous scrollbar nodes are a browser implementation detail to
  exclude from project-authored ownership assertions, not nodes to traverse,
  copy, suppress, or manage.
- No browser.xhtml override, native-tab mutation, or hidden-native-UI gate is
  needed for the MVP.

## Options considered

1. Nest close and pin buttons inside each tab button. Rejected because nested
   interactive content is invalid and can make click and focus behavior
   ambiguous.
2. Make the whole tab item one button and move close/pin to mouse-only gestures.
   Rejected because the actions would not have independently reachable names or
   keyboard behavior.
3. Render one primary `role="tab"` button plus sibling native buttons inside an
   inert presentation wrapper. Selected because the actions remain ordinary,
   named controls without accidental tab selection or invalid nesting.
4. Render all titles and favicons through HTML or CSS interpolation. Rejected.
   Text stays in text nodes/properties, and an allowlisted favicon reaches only
   an `HTMLImageElement.src` property with a failure fallback.
5. Make pinned tabs icon-only without an accessible title. Rejected. The visual
   title is compacted, but the tab and actions retain the bounded title in their
   accessible names and tooltips.
6. Depend only on immediate focus after close. Rejected by the repeated Firefox
   close-animation smoke. A single owned retry is the minimum proven adaptation.

## Decision and minimum adaptation

- `src/app/tab-strip.ts` contains only pure display-label, roving-target,
  close-neighbor, and keyboard-action decisions over ordinary `TabSnapshot`
  data.
- `src/shell/App.svelte` renders native order in a horizontal tablist. The
  selected tab owns the primary roving stop; direction-aware Arrow keys wrap,
  Home/End move and select, Enter/Space select, and Delete closes.
- New-tab, pin/unpin, and close remain sibling buttons. Their handlers stop
  propagation, so a background close or pin action does not first select the
  tab. Ordinary button semantics provide keyboard activation.
- Pinned items use a documented fixed 116-pixel presentation. Regular items use
  a 148-to-220-pixel clamp, long titles use ellipsis plus `dir="auto"` and
  `unicode-bidi: plaintext`, and the strip scrolls horizontally instead of
  changing Firefox-owned layout.
- Favicons render only after the bridge allowlist. A Svelte action assigns the
  value to the image `src` property, removes it on error, and clears both the
  handler and source on destroy. The static fallback remains underneath.
- Root-level focus delegation avoids one listener per tab. Closing restores the
  next tab, then the previous tab, with one tracked 200 ms retry. Every later
  action and component destruction cancels that timer.
- Native API calls receive fresh private writable records. Public bridge inputs,
  snapshots, events, and application state remain validated and frozen.
- The Svelte/app layers import no Firefox global or internal module. Native UI
  remains visible, unmoved, and unchanged.

## Security and privacy effects

- Page-derived titles are capped at 256 characters by the bridge and rendered
  as text or ordinary attribute/property values. No `{@html}`, style URL,
  dataset, persistence, or diagnostic log receives the title.
- Favicon values remain limited by the issue #10 allowlist to bounded Firefox
  internal image schemes or base64 raster data. The UI does not accept raw
  HTTP(S), SVG data, CSS, or markup and sets `referrerpolicy="no-referrer"`.
- Failed favicon loads reveal no source in diagnostics. The local fallback is
  static and requires no new resource mapping or network request.
- The change adds no dependency, CDN, telemetry, storage, content-accessible
  resource, arbitrary navigation input, or remote module.
- Normal and private state remains per-window in memory. Disposal clears the
  adapter subscription, component root, registered element references, favicon
  handlers, and pending focus retry.

## Validation performed

- `npm run verify`: formatting, ESLint, Svelte/TypeScript checks, 73/73 Node
  tests, dependency audit, deterministic builds, package-manifest sync, and all
  11 production-artifact inventory/security checks passed.
- All eight no-argument PowerShell suites passed under PowerShell 7.6.4 and
  Windows PowerShell 5.1. The latter used process-scoped
  `-ExecutionPolicy Bypass`; no system execution policy was changed.
- Firefox 153.0.4 ordinary matrix passed for the existing normal, second normal,
  and private windows. It verified nine-tab overflow, exact order and state,
  safe long/bidirectional text, invalid-favicon fallback, select/new/close/pin/
  unpin, rapid actions, keyboard navigation, focus restoration, direct
  unmount/remount cleanup, emergency fallback, runtime stop, and window close.
- The Browser Toolbox matrix repeated those checks and selected the primary
  XHTML host in Inspector. It confirmed project-authored XHTML ownership while
  excluding only browser-owned native-anonymous scrollbar subtrees. Native tab
  and browser content infrastructure remained outside the host.
- The bridge-recovery matrix injected both a missing base capability and a
  missing tabs capability. Each failed open before healthy, removed every
  project host, and retained native UI. Byte-exact restoration then passed the
  ordinary matrix and left no Firefox process.
- No unexpected first-party Browser Console exception was observed. Test failure
  diagnostics contain only fixed codes, booleans, counts, and listener types;
  no page title, URL, favicon address, profile path, or private-window content is
  recorded.
- Deterministic installed artifacts:
  - `content/shell/ShellApp.js`: 50,443 bytes, SHA-256
    `60f6338557ed05668d1357fab8ded2ac6ee509f75ae3582da9b04fce8e11c94f`
  - `content/shell/ShellStyles.sys.mjs`: 9,697 bytes, SHA-256
    `70f04d2afbbf7b4b98f59c8c88862bde38eab03dd7ac877d0b8969160d460c72`
  - `content/firefox/BridgeBoundary.sys.mjs`: 17,266 bytes, SHA-256
    `3ebe1226a3ec14ef588199fe40e5bcb08a4e1108ae41a98a4c3a2567e0015035`

## Remaining compatibility risk

- All tab bridge symbols and native event/animation behavior remain Firefox
  internals and require revalidation against the next supported stable release.
- The 200 ms focus retry is based on repeated Firefox 153 Windows evidence, not
  a stable Firefox API contract. A future close-animation change may need a
  different event-backed adaptation.
- `NodeFront.isNativeAnonymous` is a DevTools test dependency only. A future
  Inspector protocol change may require the ownership probe to adapt without
  changing production ownership.
- Forced-colors CSS, semantic DOM, and keyboard behavior are automated, but a
  manual screen-reader and OS high-contrast usability pass was not performed.
- Drag reorder, tab groups/workspaces, multi-select, audio state, previews, and
  full context-menu parity remain explicitly deferred.
- Runtime evidence is Windows-only. No Linux or macOS support is claimed.

## Follow-up

- Issue #12 should add selected-browser navigation through a separately
  researched privileged adapter without importing Firefox internals into the
  Svelte/app layers.
- Re-run the source/canary review, complete real-Firefox matrix, Browser Toolbox
  ownership probe, and failure injection whenever the supported Firefox stable
  changes.
