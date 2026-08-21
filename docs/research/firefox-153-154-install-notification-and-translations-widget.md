<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 153/154 install notification and translations widget research

Date: 2026-08-22

Status: source analysis and focused automation complete; the owner-observed
Firefox 154 AMO path uses the accepted complete-native-chrome fallback, and a
post-fix real translation-panel smoke test is pending

## Environment and report

- Windows x64, stock Firefox release support boundary.
- Firefox 153.0.4, BuildID `20260810162159`, upstream commit
  `c178247e1dfea52241a6b18b18cf3a00f8da935c`.
- Firefox 154.0, BuildID `20260812182057`, upstream commit
  `032a9fc1ac0cc3209f7c142744ba2e40847c8086`.
- Project base commit `a8e44b3`; the working tree also contains the accepted
  ADR-055/ADR-056 panel and popup changes.
- The marker-owned development Firefox and `fennevia-dev` profile exist. The
  generated and installed `BridgeBoundary.sys.mjs` hashes both equal
  `ef5d7c48837f99ecaf4908a264a4400592b1147ce966c3c74d9b12ff55d1c318`
  after the transactional development-profile update. This pass did not
  independently capture an AMO Browser Console stack, so the owner's
  observation is evidence of current behavior rather than a completed
  release-matrix row.

Owner report: extension installation from the marketplace no longer completes
after the generic hidden-toolbox popup proxy landed. Add a placeable widget that
opens Firefox's built-in full-page translation UI.

Follow-up owner report: the current AMO path reveals complete original Firefox
chrome. The owner accepts that visible fail-open behavior if it cannot safely be
suppressed, so the current security-owner routing and native reveal fallback
remain unchanged. Installation completion is not independently claimed here.
The initial `show-translate` implementation produced no visible panel.

## Firefox source evidence

### Add-on installation and the security delay

Firefox 153
[`browser-addons.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/browser-addons.js)
routes `addon-install-confirmation` and the other add-on installation states
through `PopupNotifications.show()`. WebExtension permission confirmation uses
the same notification owner.

Firefox 153
[`PopupNotifications.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/toolkit/modules/PopupNotifications.sys.mjs)
does all of the following:

- resolves the visible anchor before `openPopup`, falling back to the selected
  tab and finally a null `(0,0)` anchor when the browser is chromeless;
- listens for `popuppositioned` on the shared `#notification-popup`;
- resets each visible notification's `timeShown` and
  `timeShownWithoutClickExtensions` when that event fires;
- documents a popup-positioned re-anchor as a security-delay restart.

The Firefox 154 source at commit
[`032a9fc1`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/toolkit/modules/PopupNotifications.sys.mjs)
retains those same paths. Fennevia's ADR-056 one-turn
`moveToAnchor()` after `popupshown` therefore fires a second
`popuppositioned` after the prompt becomes visible and restarts Firefox's
anti-clickjacking delay. That is unsafe for all families sharing
`#notification-popup`, not only install and extension-permission prompts.

Firefox's browser-window bootstrap supplies PopupNotifications with a
`getVisibleAnchorElement` callback and the owner stores it as
`_getVisibleAnchorElement`. The selected minimum fix wraps that callback before
the first popup position is chosen. It calls Firefox's callback first; only
while Fennevia is healthy, active, hidden, and the requested or resolved anchor
belongs to the toolbox does it return the existing 1px project proxy anchor.
The shared panel therefore receives one normal initial position and no
post-`popupshown` `moveToAnchor()` call. If the callback is unavailable, the
route is ineffective, or native chrome is already deliberately revealed,
`popupshowing` uses the existing complete-native-chrome hold as fail-open.

The owner-observed Firefox 154 AMO flow currently takes that visible native
fallback. This is an accepted known limitation: Fennevia prioritizes Firefox's
security prompt, anti-clickjacking delay, and install actions over suppressing
the original chrome. No additional AMO-specific interception is selected.

`window.PopupNotifications` is lazy in the browser window, so NativeUi wraps
its configurable property getter without reading it. Firefox still decides
when to materialize the owner. NativeUi then installs the callback wrapper and
restores either the untouched lazy descriptor or the materialized owner's
original callback on disposal. Firefox retains its panel, native callback side
effects, anchor fallback, focus, keyboard behavior, security timing,
notification queue, and actions.

### Built-in full-page translations

Firefox 153 and 154
[`fullPageTranslationsPanel.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/translations/content/fullPageTranslationsPanel.js)
expose one per-window `FullPageTranslationsPanel.open(event)` owner. It lazily
materializes `#full-page-translations-panel`, builds the current language
lists and view, preserves the initiating event, then calls
`PanelMultiView.openPopup()`. Critically, the Firefox 154 `async open()` stores
`#openImpl()` in a private `#openPromise` but does not await or return that
promise, so its caller resumes before the lazy panel reaches
`PanelMultiView.openPopup()`.
The native panel is an `alertdialog` containing Firefox-owned language menus,
settings, errors, translate/restore/cancel commands, actor state, and telemetry.

The selected bridge adds one optional fixed `translate` browser-tool action.
The placeable Fennevia `show-translate` widget passes its real click event and
exact clicked XHTML host. For only
`#full-page-translations-panel`, the bridge routes `PanelMultiView.openPopup()`
to the project host. It now keeps that narrow route installed until the actual
lazy panel reports `popupshown` or a bounded ten-second failure timeout, then
restores the exact method in `finally`. The existing panel handoff holds the
working edge until the native panel closes. Missing
`FullPageTranslationsPanel.open` disables only this widget and does not fail
shell activation.

No language, page text, URL, title, detected language, translation state,
downloaded model state, menu item, or translation result enters frontend
state, persistence, diagnostics, or logs.

## Compatibility canaries

The required current canaries were checked at these revisions during the
parent hidden-toolbox popup investigation:

- `alice0775/userChrome.js` `8481c32e00f1cf14295322a7a1d59075d419405a`;
- `MrOtherGuy/fx-autoconfig` `dfdab5684faffc112b76ccb1d8cab7f75da0102c`;
- `xiaoxiaoflood/firefox-scripts` `a898ac59fb0ca3886c0c46b184fdbc037c83c037`;
- `aminomancer/uc.css.js` `88514013ddc375f4770f4a35d8d07a91d6dd7d8f`.

They remain startup/loader compatibility evidence, not a source for this
feature. No code, selector, timer, numeric value, or composition was copied.
`yutinglia/my-firefox-custom` was not consulted.

## Rejected alternatives

- Keep moving `#notification-popup` after `popupshown`: rejected because it
  resets Firefox's security timing and reproduced the causal regression.
- Recreate extension or translation UI in Svelte: rejected because Firefox
  owns the security prompt, translation models, language policy, focus,
  commands, telemetry, and updates.
- Eagerly read or replace the lazy PopupNotifications owner: rejected because
  it could change browser startup order or cache a partial owner. The selected
  route wraps the existing configurable lazy descriptor and exact stored
  callback, validates both shapes, invokes Firefox first, and restores exact
  ownership on failure/disposal.
- Click a collapsed native translations button: rejected because its native
  target is hidden and loses the exact clicked Fennevia host. Calling the
  public per-window owner preserves the real initiating event and delegates
  all feature behavior.

## Focused validation

Passed on 2026-08-22:

```text
node --test tests/native-ui.test.mjs tests/browser-tools-state.test.mjs tests/firefox-browser-tools.test.mjs tests/firefox-toolbar-widgets.test.mjs
65 tests passed

npm run typecheck
0 errors, 0 warnings

npm run verify
292 tests passed; line coverage 87.55%; function coverage 95.30%; fixed-list
PowerShell suites, dependency audit, deterministic build, and 14-artifact
production scan passed
```

The focused tests prove that the shared notification panel receives the
project anchor before first open, is never moved after `popupshown`, keeps
native chrome hidden on that healthy route, and reveals native chrome when the
pre-anchor is unavailable or ineffective. They cover an already-materialized
owner, lazy materialization without an eager read, exact callback/getter
restoration, popup cleanup, the optional translation capability, fixed
action/state contract, Firefox-owner delegation, exact host routing, a
Firefox-shaped fire-and-forget private open promise with initially absent panel
markup, trigger-event preservation, popup hold, cleanup, and palette
presentation.

Still not run as a complete matrix: AMO
install/progress/confirmation/failure beyond the owner-observed native reveal,
WebExtension permission confirmation, post-fix translation on
supported/unsupported pages, language/settings nested menus, model
download/error states, keyboard and focus restoration, second/private windows,
fullscreen/high-DPI placement, and injected fail-open behavior on Firefox
153.0.4 and 154.0.
