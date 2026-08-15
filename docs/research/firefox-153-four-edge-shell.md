# Firefox 153 four-edge floating shell research

## Environment

- Date: 2026-08-15
- Firefox version: 153.0.4 release
- Build ID: `20260810162159`
- Channel: release
- Operating system: Windows 11 Pro 25H2, build `26200.9168`
- Profile: marker-owned `fennevia-dev`
- Program: marker-owned copy of the stock Firefox installation
- Project base commit: `992aeb2fd4eb26bb98b2058f871708df718edf18`
  plus the issue #31 worktree
- Package: `0.6.0-dev`
- Firefox release source stamp: `54be19de0e08edff0b797e55fd935dd3978b0a6d`
- Official GitHub tag: `FIREFOX_153_0_4_RELEASE` at
  [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)

Only this Firefox release and Windows environment were validated. This record
makes no Linux, macOS, ESR, Beta, Nightly, touch, or later-release support
claim.

## Goal and minimal reproduction

Issue #31 replaces the initial diagnostic primary/sidebar/overlay shape with a
content-area frame containing independent top, left, right, and bottom XHTML
surfaces. Native Firefox UI remains visible; issue #15 still owns native-shell
hiding.

The repeatable probe is:

1. Build and install the exact package into the marker-owned copied Firefox
   program and development profile.
2. Cold-start an existing normal window and verify one frame immediately
   before `#tabbrowser-tabbox`, four ordered edge hosts, four empty mount
   targets, four Svelte roots, and unchanged Firefox-owned nodes.
3. Reveal every edge with pointer movement and its documented keyboard chord;
   test delayed leave, re-entry, exact corners, window leave, focus retention,
   `Escape`, focus restoration, and simultaneous top/left holds.
4. Toggle the current root attributes for customize mode, browser fullscreen,
   and DOM fullscreen and verify the selected suspension policy.
5. Repeat state and cleanup checks in a second normal window and a private
   window, then trigger emergency fallback, unmount/remount, runtime stop, and
   a missing insertion point.
6. Repeat with Browser Toolbox Inspector, missing/throwing frontend artifacts,
   safe start, bridge-capability failures, and exact artifact restoration.

## First causal evidence

The spike exposed five useful failures:

1. The runtime originally verified edge positions against all frame children.
   Inserting generated CSS before the first edge shifted those indexes. Health
   now compares only children carrying `data-fennevia-edge-host`.
2. `pointerenter` and `pointerleave` produced 32 directly registered listeners
   across two four-root mount/unmount passes. Project subtree removal made the
   detached controls unreachable, but the strict cleanup probe still retained
   those listener registrations. Delegated `pointerover`/`pointerout` plus
   `relatedTarget` boundary checks reduced the result to zero outstanding
   listeners.
3. Closing the selected custom tab intermittently removed the focused Svelte
   button before its replacement existed. The surface treated that transient
   `focusout` as a real exit, hid after 160 ms, and restored `#urlbar-input`
   before the existing 200 ms close-focus retry. The minimum fix defers the
   focusout decision and treats the one bounded close-focus retry as an
   explicit transfer guard. If retry focus still fails, the surface releases
   normally.
4. Browser Toolbox can add enough DevTools messages to evict the oldest records
   from Firefox's finite Console buffer. The harness now captures bootstrap and
   runtime-start evidence immediately after stable startup, then separately
   validates later window, failure, cleanup, and stop records.
5. One post-restoration bridge-recovery run timed out while checking vertical
   ArrowUp wrap. The predicate recomputed `gBrowser.openTabs.at(-1)` throughout
   an asynchronous native-event window instead of retaining the target that was
   last when the key was dispatched. The harness now captures that native
   target once and reports selection and focus timeouts separately. The next
   complete bridge-recovery and ordinary matrix passed with exact artifact
   hashes.

No uncaught Fennevia exception accompanied the successful final matrices.

## Sources checked

### Current Firefox source

- [`browser.xhtml`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser.xhtml): browser-window root,
  native browser/content anchors, modal dialog, accessibility anchor, and
  fullscreen toggler.
- [`content-area.css`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/themes/shared/tabbrowser/content-area.css):
  `#browser { position: relative }`, relative/z-indexed
  `#tabbrowser-tabbox`, browser stacks, dialog stacks, and
  `browser[tabDialogShowing]`.
- [`CustomizeMode.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/customizableui/CustomizeMode.sys.mjs):
  sets/removes root `customizing`, hides `#browser`, and shows the native
  customization container while customize mode owns the window.
- [`browser-fullScreenAndPointerLock.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-fullScreenAndPointerLock.js):
  sets/removes root `inFullscreen` and `inDOMFullscreen` and owns
  `#fullscr-toggler`.
- [`tabbrowser.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tabbrowser.js):
  selected-tab close behavior and the existing native tab state consumed by
  issue #11.
- [`NodeFront.isNativeAnonymous`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/devtools/client/fronts/node.js) and
  [`Launcher.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/devtools/client/framework/browser-toolbox/Launcher.sys.mjs):
  Browser Toolbox ownership and separate-process validation.

The current layout makes `#browser` the smallest source-backed relative
containing block that can host an absolute, zero-layout frame over the content
area without entering `#tabbrowser-tabbox` or a native browser stack. The frame
is inserted immediately before the tabbox and has `pointer-events: none`;
only seven-CSS-pixel edge triggers and visible project panels receive pointer
events.

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

These repositories remain breakage canaries only. Generic script discovery,
loader metadata, historical compatibility branches, native subtree patching,
and CSP workarounds were not adopted.

### Visual reference boundary

The permitted reference was
[`yutinglia/my-firefox-custom@7a02f60bb23abe9c191c7fd8cd2a7096bb63aee5`](https://github.com/yutinglia/my-firefox-custom/tree/7a02f60bb23abe9c191c7fd8cd2a7096bb63aee5),
dated 2026-08-13 and MIT licensed. Inspection was deliberately limited to the
license, README files, and visual CSS concepts in:

- `global_style_var/style.css`;
- `autohide_topbar.uc/style.css` and `topbar_popup_glass.uc/style.css`;
- `autohide_rightside_bookmark_bar.uc/style.css`;
- `download_progress.uc/style.css`.

No `.uc.js` implementation was inspected or copied. No handler structure,
timer, global flag, selector, ID, class, token name, numeric value, module
layout, native-DOM mutation, or loader assumption was copied or adapted. The
retained concepts are only four functional edges, narrow activation regions,
delayed hiding, inset rounded glass, and common visual rhythm.

## Options considered

1. Keep the visible primary body row and add three more docked hosts. Rejected:
   it permanently reduces page space and cannot represent the content-first
   product direction.
2. Mount Svelte into `#browser`, `#tabbrowser-tabbox`, a browser stack, or the
   native sidebar. Rejected because Firefox already owns those children.
3. Put four Svelte roots directly around unrelated native parents. Rejected
   because collision, suspension, CSS, and health would have no single owned
   coordination boundary.
4. Create one project frame under `#browser`, then four independent XHTML hosts
   and targets below it. Selected because the frame participates in no layout,
   each surface has exact ownership/disposal, and native content remains a
   sibling rather than a framework child.
5. Let all corner triggers fire. Rejected because equal-distance pointer input
   can reveal two surfaces. Side edges own exact corners; top and bottom trigger
   geometry is inset by the same trigger thickness.
6. Poll pointer, popup, or mode state. Rejected. Pointer/focus/keyboard/popup
   holds are explicit events, and one `MutationObserver` watches only known root
   and browser attributes.
7. Keep the frame active during DOM fullscreen, customize mode, and native
   dialogs. Rejected. Customize mode temporarily hides `#browser`; DOM
   fullscreen gives content exclusive presentation; native modal state has
   higher priority. All four surfaces are disabled and hidden in those states.
   Browser fullscreen remains supported because the frame follows browser
   geometry and native OS/window controls remain untouched.
8. Add Tailwind, a component library, or Shadow DOM. Rejected because one
   root-scoped stylesheet and ordinary XHTML controls satisfy the measured
   token, fallback, accessibility, and isolation requirements without another
   privileged dependency or focus boundary.

## Decision and minimum adaptation

- `WindowShell.sys.mjs` creates one absolute frame and ordered top/left/right/
  bottom XHTML hosts, each with one independent mount target and lifecycle
  controller. Attachment is all-or-nothing and health verifies exact ownership,
  ordering, CSSOM, environment observer, and namespaces.
- `src/app/edge-surfaces.ts` owns the framework-independent state contract:
  hidden, pointer, focus, keyboard, popup, programmatic, pending-hide,
  disabled, and disposed states; one 160 ms hide timer; a 1.2-second default and
  10-second maximum programmatic reveal; explicit enable/disable/dispose; and
  deterministic corner arbitration.
- Pointer reveal is exclusive, while legitimate focus, keyboard, popup, and
  programmatic holds remain independent. A surface may therefore coexist with
  another held surface. CSS clearances prevent top/bottom and side panels from
  covering one another.
- Keyboard access uses exact
  `Ctrl+Alt+Shift+ArrowUp|Left|Right|Down` chords. Focus enters a named dismiss
  control, remains while the surface owns focus, and returns to the originating
  HTML or XUL control on `Escape`, disable, or hide. `Ctrl+L` remains issue #13.
- Top, right, and bottom contain meaningful but nonfunctional placeholders;
  left retains issue #11 tabs and changes them to a vertical tablist with
  Up/Down navigation. Navigation, address submission, bookmarks, and Downloads
  data remain their feature issues.
- Project CSS defines local glass, typography, border, blur, radius, elevation,
  inset, trigger, dimensions, spacing, density, motion, focus, and selected
  tokens. A near-solid base works without backdrop filtering; reduced
  transparency disables blur, reduced motion removes translation, and forced
  colors use system colors. Every selector starts below
  `#fennevia-shell-frame-host`.
- Root `customizing`, `inDOMFullscreen`, `inFullscreen`, `window-modal-open`,
  and descendant `tabDialogShowing` mutations update one frame environment.
  There is no periodic scan and no second browser-window lifecycle manager.

## Security and privacy effects

- The change adds no dependency, remote endpoint, runtime fetch, font, storage,
  content-accessible resource, Chrome Registry mapping, override, telemetry, or
  user-controlled CSS/HTML path.
- Trigger and phase datasets contain only fixed edge/lifecycle values. They do
  not contain URLs, titles, queries, paths, private state, native objects, or
  Firefox implementation details.
- Page-derived tab titles and favicons keep the existing issue #10/#11 text and
  image-property boundaries. The controller itself handles no browsing data.
- Native modal, permission, notification, titlebar, DevTools, content, tabbox,
  and window-control infrastructure remains present. Native visible UI is not
  hidden because production still stops at `healthy`.
- Normal, second, and private windows each own a separate frame, controller,
  focus-origin map, observers, listeners, timers, bridge, and four Svelte roots.
  Official disposal clears each resource in reverse order.

## Validation performed

- Pure tests cover anti-flicker re-entry, all hold reasons, popup dismissal
  priority, bounded programmatic reveal, disabled/disposed cleanup, four held
  surfaces, corner arbitration, exact keyboard chords, active-edge expiry, and
  controller exception reporting.
- Static/component tests cover all token classes, four geometries, root
  scoping, solid/backdrop-filter fallbacks, responsive bounds, reduced motion,
  reduced transparency, forced colors, accessible landmarks, vertical tab
  semantics, safe text/image rendering, and zero Firefox globals in Svelte.
- Node runtime tests cover all-or-nothing four-host attach, app-style insertion,
  environment mutation, normal/private isolation, missing anchors, partial
  attachment, mount/health/CSS/capability/timeout failures, emergency fallback,
  and disposal during pending health.
- Firefox 153.0.4 passed repeated ordinary and Browser Toolbox matrices for the
  existing normal, second normal, and private windows. The run exercised all
  pointer/keyboard edges, exact corners, rapid re-entry, delayed hide, window
  leave, focus hold/restoration, two simultaneous non-overlapping surfaces,
  customize/DOM-fullscreen suspension, browser-fullscreen tracking, fourteen-
  tab vertical overflow, native modal top-layer hit testing, emergency fallback,
  direct two-pass unmount/remount, runtime stop, and missing insertion point.
- Browser Toolbox selected `#fennevia-shell-frame-host`, found all four edge
  hosts under it, kept native browser/toolbox/tabbox outside project ownership,
  and confirmed all authored descendants were XHTML after excluding
  browser-owned native-anonymous scrollbar content.
- Missing and throwing frontend bundles failed open and were restored exactly.
  Safe-start and bridge-capability wrappers restore every modified artifact and
  finish without a Firefox process. Full commands and final counts are recorded
  in `docs/testing-and-recovery.md`.

## Remaining boundaries

- Project-owned popup hold APIs are tested but no current placeholder opens a
  popup; each future popup consumer must register and release that hold.
- Forced colors, reduced motion/transparency, light/dark color schemes, narrow
  dimensions, and high-DPI-safe CSS-pixel geometry have deterministic style
  coverage. Visual review on additional OS scaling/theme combinations remains
  part of issue #15 before native UI can be hidden.
- Real native permission, authentication, certificate, extension-install, and
  download-safety prompts remain Firefox-owned and require feature-specific
  tests before any overlapping native surface is hidden.
