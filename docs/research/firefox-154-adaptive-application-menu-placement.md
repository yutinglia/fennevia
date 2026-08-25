<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 154 adaptive application-menu placement

## Environment and report

- Date: 2026-08-25
- Owner report: ordinary Fennevia runtime on Windows, including a restored
  Firefox window and an application-menu widget near the top-left
- Exact Firefox version, Build ID, profile, Browser Console, and Browser
  Toolbox state for the supplied screenshots: not captured
- Supported source comparison target: Firefox 154.0 release, BuildID
  `20260812182057`, official commit
  [`032a9fc1ac0cc3209f7c142744ba2e40847c8086`](https://github.com/mozilla-firefox/firefox/commit/032a9fc1ac0cc3209f7c142744ba2e40847c8086)
- Project baseline: `41caf4d`

The first screenshot showed `#appMenu-popup` expanding left across a restored
Firefox window boundary. The initial correction forced the measured popup into
the owning client rectangle. A later screenshot exposed the resulting error:
when the native menu was almost as tall as the window, the clamp moved it to
the top edge and over the application-menu button.

The owner then clarified that the native panel may extend outside the Firefox
window. Fennevia should choose the better direction and preserve access to the
trigger rather than impose strict containment.

The owner also requested the same automatic direction for other popup widgets
when it could remain a shared implementation. The existing handoff already
funnels the seven Fennevia popup actions through one placement module after
`popupshown`, so no per-panel geometry branches are required.

The first adaptive implementation still opened with Firefox's old position
and called `moveTo()` after `popupshown`. The owner observed the resulting
brief direction jump and requested that the menu open at its final position.

## First causal error

The native panel was opened through the ADR-042 `PanelMultiView.openPopup`
route correctly. The Fennevia post-open geometry was the first causal error.
The old version always calculated `host right - popup width`; the first fix
replaced that with a client-window clamp, but centered/clamped an oversized
popup along its opening axis. That made a tall Top-edge menu intersect its own
button.

Firefox still requires `PanelMultiView.openPopup()` to initialize the current
main view before `popupshown`; a raw `openPopupAtScreenRect()` remains rejected
because it bypasses that owner. The final correction changes the initial
Firefox position and host; measured screen-point movement remains only for an
owner-rejected compatibility fallback.

## Selected minimum correction

1. Keep each Firefox feature's native open owner and the application menu's
   dedicated `PanelMultiView` initialization.
2. Read a strict finite project-host viewport rectangle, Firefox client size,
   Firefox client screen origin, and native panel outer width/height.
3. Before opening, resolve down from Top, up from Bottom, right from Left, and
   left from Right. Choose start/end alignment from the host's half of the
   owning client area.
4. Pass that position and the project host directly to the native open owner.
   Trust's `PanelMultiView.openPopup()` is narrowly routed just like the
   existing Translation handoff, then restored immediately.
5. On `popupshown`, skip movement when `anchorNode` is already the requested
   host. Only an owner-rejected/replaced anchor uses the measured fallback,
   where a sole fitting opposite side or the larger non-fitting side wins.
6. Preserve exact adjacency on the opening axis even when the requested popup
   rectangle extends beyond the Firefox client window. Cross-axis alignment
   may still be clamped to keep as much of the panel aligned with the client as
   practical.
7. Missing, zero, non-finite, or throwing geometry returns to a shared
   edge-directional `moveToAnchor()` fallback. This uses native position
   strings rather than panel-specific code.

Fennevia does not constrain the menu height or style the native panel. Final
monitor/work-area adjustment remains Firefox and platform behavior. No popup
contents, native nodes, geometry, URL, labels, or account state cross the
ordinary bridge or enter persistence/logging. No observer, timer, surface,
dependency, or runtime network path is added.

## Source evidence

- Firefox 154
  [`panelUI.js`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/customizableui/content/panelUI.js):
  `PanelUI.show()`, `ensureReady()`, and the application-menu owner.
- Firefox 154
  [`PanelMultiView.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/customizableui/PanelMultiView.sys.mjs):
  `openPopup()` establishes the main view before `popupshown`.
- Firefox 154
  [`XULPopupElement.webidl`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/dom/chrome-webidl/XULPopupElement.webidl):
  native `openPopup`, `openPopupAtScreenRect`, `getOuterScreenRect`, `moveTo`,
  and `moveToAnchor` remain privileged Firefox-owned operations.

The required maintained-loader canaries were not relevant to this bounded
native-popup routing correction and were not used as implementation templates.
`yutinglia/my-firefox-custom` was not consulted. No external code or assets
were copied.

## Validation

- Pure geometry tests cover every preferred edge direction, opposite-side
  flipping, best-space selection, oversized adjacency, cross-axis alignment,
  and malformed values.
- Browser-tools integration covers all four Fennevia edges and both cross-axis
  halves, all seven actions on the shared initial-position resolver, direct
  final-position `PanelMultiView` opens for application menu and Trust, no
  post-show move for a correctly anchored tall menu, all four directional
  native fallbacks, and the retained `PanelUI.show()` compatibility path.
- Focused geometry/browser-tools tests passed 30/30. Format, lint, and typecheck
  passed with zero Svelte diagnostics.
- The complete `npm run verify` ordinary gate passed on 2026-08-25 with 416/416
  Node tests, 88.29% line coverage, 80.67% branch coverage, 95.51% function
  coverage, every fixed PowerShell 7 suite, dependency audit, deterministic
  frontend/bridge builds, and 14/14 accepted production artifacts. This gate
  also includes the subsequent customize-close focus-hold regression fix.
- Real Firefox 153/154 restored-window, snapped, maximized, 100%/200% scaling,
  all-edge, main/subview, second/private-window, and cleanup matrix: **not
  run**, not passed.

## Remaining risk

- `getOuterScreenRect()` and `moveTo()` remain privileged XUL popup internals
  that must be rechecked on each supported Firefox stable.
- Firefox or the platform may still adjust a requested point against monitor
  work-area limits. The real-browser matrix must cover very tall menus and
  Bookmarks, History, More tools, and Help subviews.
