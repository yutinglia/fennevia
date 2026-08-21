# Firefox 153/154 tab status indicator research

## Environment

- Date: 2026-08-22
- Firefox versions: 153.0.4 and 154.0 release
- Build IDs: `20260810162159` and `20260812182057`
- Operating system: Windows 11 Pro 25H2
- Profile: marker-owned `fennevia-dev`; live Browser Toolbox validation for
  this follow-up: **not run**
- Project base commit: `dc14f12` plus the tab-status worktree
- Official Firefox pins:
  - 153.0.4 [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)
  - 154.0 [`032a9fc1ac0cc3209f7c142744ba2e40847c8086`](https://github.com/mozilla-firefox/firefox/commit/032a9fc1ac0cc3209f7c142744ba2e40847c8086)

## Request and symptom

The custom vertical strip already exposed loading, audio, attention,
picture-in-picture, and container state, but used unrelated text glyphs for
several visuals. An optional audio button also participated in an implicit grid
column, which made the trailing controls appear inconsistently placed. The
owner requested stable button positions, an animated loading tab icon, and the
other native tab indicators such as active microphone use.

## First causal evidence

- Firefox 153.0.4 and 154.0
  [`tab.js`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/tabbrowser/content/tab.js)
  inherit `sharing`, `pictureinpicture`, `crashed`, `busy`, audio, pin, and
  selection attributes onto the native icon stack. The native sharing overlay
  is a separate presentation child, not a permission-mutation button.
- Both versions'
  [`tabs.css`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/themes/shared/tabbrowser/tabs.css)
  define exactly `sharing="camera"`, `sharing="microphone"`, and
  `sharing="screen"`, plus a `crashed` icon. Pending/discarded tabs only alter
  favicon filtering under preferences; they do not add another stable status
  action.
- Both versions'
  [`tabbrowser.js`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/tabbrowser/content/tabbrowser.js)
  `updateBrowserSharing()` sets or removes the tab's `sharing` attribute and
  emits `_tabAttrModified(tab, ["sharing"])`. Paused or cleared WebRTC sharing
  removes the indicator.
- Firefox's
  [`browser_tab_sharing_state.js`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/base/content/test/siteIdentity/browser_tab_sharing_state.js)
  exercises microphone and camera state through `updateBrowserSharing()`.
  Firefox may know more detailed WebRTC state, but the tab attribute deliberately
  collapses it to one presentation value.
- Firefox 153.0.4/154.0
  [`ContentCrashHandlers.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/modules/ContentCrashHandlers.sys.mjs)
  sets the native tab's `crashed` attribute from the trusted
  `oop-browser-crashed` or `oop-browser-buildid-mismatch` path. Crash reset
  occurs around remoteness/loading changes; Firefox does not publish
  `TabAttrModified(["crashed"])` on the current path.
- `busy` remains the existing loading boolean. Fennevia needs no second progress
  listener to animate the tab icon.

## Compatibility canaries checked

- Alice0775/userChrome.js head
  [`8481c32e00f1cf14295322a7a1d59075d419405a`](https://github.com/alice0775/userChrome.js/commit/8481c32e00f1cf14295322a7a1d59075d419405a)
  (current head and versioned tab customizations checked).
- MrOtherGuy/fx-autoconfig head
  [`dfdab5684faffc112b76ccb1d8cab7f75da0102c`](https://github.com/MrOtherGuy/fx-autoconfig/commit/dfdab5684faffc112b76ccb1d8cab7f75da0102c)
  (bootstrap/window loading only for this question).
- xiaoxiaoflood/firefox-scripts head
  [`a898ac59fb0ca3886c0c46b184fdbc037c83c037`](https://github.com/xiaoxiaoflood/firefox-scripts/commit/a898ac59fb0ca3886c0c46b184fdbc037c83c037)
  (no reusable ordinary tab-status contract).
- aminomancer/uc.css.js head
  [`88514013ddc375f4770f4a35d8d07a91d6dd7d8f`](https://github.com/aminomancer/uc.css.js/commit/88514013ddc375f4770f4a35d8d07a91d6dd7d8f)
  still mirrors and overrides native tab internals, including sharing/crash
  attributes. That native override strategy is out of scope.
- Repository code search plus current issue/pull-request searches found no
  narrower maintained adapter to adopt. No canary code, selector, timing,
  numeric value, or icon was copied.

## Options considered

1. Copy Firefox's native chrome SVG URLs. Rejected: it would couple the owned
   frontend to theme assets and add provenance/update work for no behavioral
   benefit.
2. Read `browser._sharingState` and expose camera/microphone booleans, paused
   state, screen kind, or device details. Rejected: the private record is
   broader and more sensitive than the tab presentation contract.
3. Make capture indicators clickable. Rejected: Firefox owns permission and
   sharing mutation; a status glyph must not imply an unsupported action.
4. Add the closed `sharing` enum plus `crashed` boolean to the existing tab
   snapshot, render project-authored SVG status badges inside the primary tab
   button, and keep actual actions as sibling controls. Selected.
5. Add experimental tab-note, pending, discarded, tab-group, and split-view
   presentation. Rejected for this change: these are preference-dependent or
   separately deferred models rather than the stable core status set.

## Decision and minimum adaptation

- The ordinary snapshot adds optional `sharing: "camera" | "microphone" |
  "screen"` and `crashed: true`. Unknown sharing values are omitted.
- `TabAttrModified` reconciliation adds `sharing`. Two required `gBrowser`
  crash-event listeners capture crash entry, and `TabRemotenessChange` captures
  reset; existing busy/image events remain harmless equal-snapshot fallbacks.
  No native object or WebRTC record crosses `src/firefox/`.
- Loading, favicon fallback, audio playing/muted/blocked, pin, close,
  picture-in-picture, camera, microphone, screen sharing, and crash use
  project-authored inline SVGs with a shared 24px view box and current-color
  styling.
- Capture/crash/PiP badges are `aria-hidden` visual children. Their localized
  state text is included in the parent tab's accessible name. They are not
  controls.
- The audio action gets its own optional named grid area before fixed `pin` and
  `close` areas. Status badges stay inside the flexible tab area and therefore
  cannot move the trailing controls.
- The existing `busy` boolean rotates only the owned loading icon. Reduced
  motion stops that animation without hiding the loading state.

## Security and privacy effects

- Active capture is browsing-derived privacy state. Only one closed visual
  enum exists in the owning window's transient snapshot, rendered tab subtree,
  and accessible name.
- Origins, URLs, tab titles beyond the existing bounded field, device IDs or
  names, permission records, paused state, `_sharingState`, and WebRTC objects
  remain privileged.
- Sharing/crash state is not persisted, logged, copied between windows, placed
  on the frame root, or sent to a network sink.
- Firefox remains the sole owner of capture permissions, prompts, indicators,
  and stop-sharing actions. Complete native access and fail-open behavior are
  unchanged.
- All SVG geometry is original Fennevia source. No dependency, runtime asset,
  mapping, or third-party notice is added.

## Validation performed

- Firefox 153.0.4/154.0 source and official test comparison: completed.
- Current compatibility-canary heads and relevant code paths: completed.
- Focused bridge/state/UI tests: 28 passed.
- Svelte and TypeScript checks: 0 errors and 0 warnings.
- Complete `npm run verify`: 293 tests passed; line coverage 87.59%, function
  coverage 95.32%, deterministic builds matched, and all 14 production
  artifacts passed the explicit inventory and security rules.
- Real Firefox ordinary/second/private, WebRTC capture, crash, forced-colors,
  reduced-motion, and high-DPI visual matrix: **not run**.

## Remaining risk

- `sharing` and `crashed` are unsupported Firefox internals even though their
  Firefox 153.0.4 and 154.0 behavior matches. Revalidate on every supported
  stable update.
- The source-backed layout and indicators still need visual proof in real
  Firefox, especially simultaneous audio/capture/PiP state and narrow panels.
