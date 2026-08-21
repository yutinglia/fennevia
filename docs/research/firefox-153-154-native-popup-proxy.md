<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 153/154 hidden-toolbox popup proxy research

Supersession note (2026-08-22): ADR-057 excludes the shared
`#notification-popup` security owner from the generic post-`popupshown` proxy
because Firefox resets its anti-clickjacking timestamps on
`popuppositioned`. This record otherwise remains the historical ADR-056
investigation. Current evidence is in
`firefox-153-154-install-notification-and-translations-widget.md`.

## Scope and observed failure

The project-owner report on 2026-08-22 identified original Firefox chrome
returning for translation and extension-install UI and requested coverage for
other equivalent cases. This pass did not rerun a clean-profile Browser Toolbox
reproduction. The first deterministic project-side cause is the existing
`NativeUi.sys.mjs` popup policy: on `popupshowing` or `popupshown`, any popup
whose `anchorNode`, `triggerNode`, or `document.popupNode` was below the managed
toolbox entered `openPopups`; `reconcile()` then set
`data-fennevia-native-ui-revealed` for the lifetime of that popup.

Research and implementation use Windows x64, project commit `a8e44b3` plus the
current worktree, and the supported source pins below. The supported runtime
records remain Firefox 153.0.4 BuildID `20260810162159` and Firefox 154.0 BuildID
`20260812182057`. Real popup placement and interaction on those builds remain
`not run` for this change.

## Upstream source evidence

Firefox 153 is pinned at
`c178247e1dfea52241a6b18b18cf3a00f8da935c`; Firefox 154 is pinned at
`032a9fc1ac0cc3209f7c142744ba2e40847c8086`.

- [`fullPageTranslationsPanel.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/translations/content/fullPageTranslationsPanel.js)
  selects `#translations-button` for direct and automatic translation offers
  and opens the Firefox-owned panel through `PanelMultiView.openPopup` at
  `bottomright topright`. The same owner, target selection, and open path are
  present at the Firefox 154 pin.
- [`PopupNotifications.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/toolkit/modules/PopupNotifications.sys.mjs)
  resolves each notification's Firefox-owned anchor, falls back to the selected
  tab or a null anchor in a chromeless environment, and calls the shared
  notification panel's `openPopup`. The same visibility fallback and open path
  are present at the Firefox 154 pin.
- [`browser-addons.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/browser-addons.js)
  routes add-on install progress, block, confirmation, failure, and extension
  permission notifications through `PopupNotifications.show`, normally using
  the Unified Extensions button as the anchor owner.
- [`navigator-toolbox.inc.xhtml`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/navigator-toolbox.inc.xhtml)
  owns the translation button, Unified Extensions button, and the complete
  `notification-popup-box` anchor family under the toolbox that Fennevia
  reversibly collapses at active rest.
- [`XULPopupElement.webidl`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/dom/chrome-webidl/XULPopupElement.webidl)
  defines `moveToAnchor()` specifically for moving an open popup to a supplied
  element and position. The contract is unchanged at the Firefox 154 pin.

This shared event/API boundary covers more than the two reported examples:

- automatic and button-opened full-page translation panels;
- add-on install and WebExtension permission doorhangers;
- the shared Firefox notification panel used for location, local-network, XR,
  autoplay, password, web-notification, WebRTC, EME, persistent-storage, MIDI,
  serial, WebAuthn, identity-credential, storage-access, and future notifications
  that continue to use a toolbox anchor;
- built-in bookmark, page-action, recommendation, extension-action, and other
  top-level XUL popups whose current owner anchors them below the collapsed
  toolbox.

The implementation therefore must classify the popup/anchor relationship, not
maintain a list containing only translation and installation panel IDs.

## Compatibility canaries

The required current canaries were checked on 2026-08-22:

- `alice0775/userChrome.js` at
  `8481c32e00f1cf14295322a7a1d59075d419405a`;
- `MrOtherGuy/fx-autoconfig` at
  `dfdab5684faffc112b76ccb1d8cab7f75da0102c`;
- `xiaoxiaoflood/firefox-scripts` at
  `a898ac59fb0ca3886c0c46b184fdbc037c83c037`;
- `aminomancer/uc.css.js` at
  `88514013ddc375f4770f4a35d8d07a91d6dd7d8f`.

No canary supplied a current general hidden-toolbox popup handoff that fits
Fennevia's lifecycle and ownership rules. No canary code, selectors, timers, or
values were copied.

## Selected minimum change

`NativeUi.sys.mjs` owns one non-interactive, `aria-hidden`, 1-by-1 XHTML proxy
anchor at the top inline-end of the existing Fennevia frame. It stores no text,
URL, extension identity, permission state, or popup ID. Its identity, parent,
and fixed inline style are required health state and are observed for mutation.

When active mode is healthy and unsuspended, native chrome is still hidden, and
a non-excluded popup starts from a toolbox-owned anchor, NativeUi records that
popup as pending instead of setting the native reveal marker. After
`popupshown`, it defers one event-loop turn and then:

1. yields if an existing feature bridge has already moved the popup to a more
   specific Fennevia button;
2. otherwise calls the Firefox-owned popup's `moveToAnchor()` with the fixed
   project proxy and logical `after_end` placement;
3. keeps popup contents, focus, commands, security delay, and close behavior
   entirely Firefox-owned;
4. removes every pending timer and popup record on hide, suspension, unload,
   failure, or disposal.

The one-turn defer is required because toolbar-widget activation already has a
more precise `popupshown` re-anchor. Running the generic move first would erase
the original native anchor before that bridge could recognize its popup.

The proxy does not apply to tooltips, tab preview, Firefox popups marked
`nopreventnavboxhide`, token-listed handoffs, popups already anchored in the
Fennevia frame, content-anchored popups, sidebar popups, suspended environments,
or a deliberately revealed native toolbar. If `moveToAnchor` is absent or has
no effect, the existing popup hold reveals Firefox chrome. If it throws,
NativeUi records a fixed `FENNEVIA_NATIVE_UI_POPUP_PROXY_FAILED` boundary and
suspends hiding before lifecycle fallback. Native anchor nodes are never moved,
reparented, clicked, inspected for content, or exposed to Svelte.

## Validation

Focused Node tests cover:

- translation, shared notification, and a third built-in popup through the same
  ID-independent proxy path;
- a feature-specific Fennevia host winning over the deferred generic proxy;
- deliberate native-toolbar and native-sidebar reveal behavior remaining
  intact;
- missing `moveToAnchor` revealing Firefox chrome;
- a thrown move suspending and reporting the fixed fail-open error;
- exact proxy ownership, mutation-observed health, timer cleanup, popup cleanup,
  and idempotent disposal.

The complete `npm run verify` result and generated artifact hashes are recorded
in the delivery summary after this document is updated. Real Firefox 153/154
translation, install, permission, password, WebAuthn, bookmark, page-action,
second-window, private-window, resize, DPI, fullscreen, and failure-injection
placement remain `not run` and belong to the release matrix.
