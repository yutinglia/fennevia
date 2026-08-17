<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 153 single-line toolbar and native handoff research

Later ADR-042 superseded toolbar reveal before popup-opening actions. This
record remains the source inventory for the original ADR-037 handoffs. See
`docs/research/firefox-153-native-popup-anchoring.md`.

## Environment and scope

- Date: 2026-08-16
- Supported evidence target: Firefox 153.0.4 release
- Build ID: `20260810162159`
- Official release tag: `FIREFOX_153_0_4_RELEASE`
- Official release commit:
  [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)
- Operating-system target: Windows 11 x64
- Project base commit: `4f5f0bf`
- Implementation branch: `codex/fast-edge-debug`
- Package: `0.10.0-beta.1`

This is a source and focused-build record. At the user's request, this fast pass
did not launch the real Firefox matrix; cold-start, popup placement, drag,
caption-control, narrow-window, fullscreen, second-window, and private-window
checks remain explicitly manual. No support claim is added for another Firefox
version, channel, operating system, or profile.

## Goal and selected product boundary

The top edge becomes one compact browser row while the four edge surfaces stay
hidden at rest. Buttons whose useful details already belong to Firefox open the
current Firefox-owned panel or command instead of rendering copied or inferred
data. In particular, Fennevia keeps only its existing bounded connection and
tracking summaries; Firefox remains authoritative for certificate, HTTPS-only,
site-data, tracker, exception, permission, extension, and download details and
actions.

`yutinglia/my-firefox-custom` was consulted only as a capability inventory and
broad product reference at commit
`7a02f60bb23abe9c191c7fd8cd2a7096bb63aee5`. No `.uc.js` implementation,
selector, ID, class, timer, global flag, numeric value, native-DOM mutation
strategy, module layout, icon, or visual composition was copied or adapted.
The single-row zoning, responsive disclosure, icon geometry, glass tokens,
caption island, and typed handoff boundary were independently selected for
Fennevia.

## Firefox source owners

| Firefox 153 source | Current owner used by the handoff |
| --- | --- |
| [`navigator-toolbox.inc.xhtml`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/navigator-toolbox.inc.xhtml) | Original Trust, identity, protection, permission, Downloads, Unified Extensions, application-menu, and navigation anchors |
| [`navigator-toolbox.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/navigator-toolbox.js) | Delegated click routing from Trust/identity/protection/permission and Downloads anchors to their current Firefox handlers |
| [`browser-trustPanel.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/browser-trustPanel.js) | Current Trust Panel, including connection, ETP, cookies/site data, breach, and HTTPS-only presentation |
| [`browser-siteIdentity.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/browser-siteIdentity.js) | Legacy identity panel and certificate/connection details when the Trust Panel feature is not active |
| [`browser-siteProtections.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/browser-siteProtections.js) | Legacy protections panel and exception actions when the Trust Panel feature is not active |
| [`browser-sitePermissionPanel.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/browser-sitePermissionPanel.js) | Current per-site permission panel, list, state controls, and native anchor policy |
| [`browser-unified-extensions.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/browser-unified-extensions.js) | `gUnifiedExtensions.togglePanel()` and Firefox-owned extension identities/actions |
| [`panelUI.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/customizableui/content/panelUI.js) | `PanelUI.show()` and the application menu |
| [`browser.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/browser.js) | `openPreferences()` and current tab-opening behavior for Settings |
| [`browser-customization.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/browser-customization.js) and [`CustomizeMode.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/customizableui/CustomizeMode.sys.mjs) | `gCustomizeMode.enter()` plus Firefox-owned customization lifecycle |
| [`indicator.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/downloads/content/indicator.js) | Native Downloads indicator command and complete Firefox Downloads panel |
| [`titlebar-items.inc.xhtml`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/titlebar-items.inc.xhtml) and [`browser-shared.css`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/themes/shared/browser-shared.css) | Native Windows minimize, maximize/restore, and close controls plus their current placement rules |

Firefox 153 enables the current Trust Panel feature gate by default. The
toolbar controller therefore checks the original `#trust-icon-container` at
action time. When that owner is visible, both the site-information and
protections entries use the Trust Panel. When it is not visible, the actions
fall back to the separate original `#identity-icon-box` and
`#tracking-protection-icon-container` owners. The project does not call either
handler with copied site state.

## Selected implementation

`src/firefox/browser-tools.ts` is one per-window controller behind the existing
Firefox bridge boundary. Creation validates twelve fixed current capabilities
while native UI is still visible. Each action re-resolves its owner at call
time, requests the existing reversible native-toolbar reveal where an anchor
is required, focuses that original anchor, and then delegates to Firefox.

The public contract contains only nine fixed availability booleans and nine
fixed action names:

- site information;
- protections;
- site permissions;
- Downloads;
- Unified Extensions;
- application menu;
- Settings;
- native customization mode;
- complete original toolbar.

The complete-toolbar action reveals Firefox's current navbar and focuses its
original Back button. This is the recovery path for pinned extension widgets
and any current toolbar item that Fennevia does not explicitly expose. It does
not enumerate or clone `CustomizableUI` widgets.

The Svelte row uses project-authored inline SVG glyphs only inside
`svg[data-fennevia-icon]`. Hosts and structural frontend elements remain XHTML;
health and Browser Toolbox probes accept SVG only in that explicit project
subtree. No external icon asset or runtime request was added.

The native caption controls remain Firefox-owned and keep their native
commands. `NativeUi.sys.mjs` styles only the selected existing button box as a
compact segmented island and moves it below the custom top surface while that
surface is visible. It never creates, reparents, clicks, or replaces a caption
button.

## Privacy and security review

The new bridge does not expose or persist:

- URLs, origins, page titles, address text, or search text;
- certificate, HTTPS-only exception, site-data, tracker, or breach details;
- permission IDs, states, scopes, origins, prompts, or native labels;
- extension IDs, names, icons, widget IDs, actions, or commands;
- download names, paths, source URLs, byte records, errors, or native objects;
- Firefox DOM nodes, panels, windows, handlers, preferences, or principals.

Firefox populates and owns every opened panel. Fennevia logs only fixed action,
phase, symbol, Firefox version/build, and window-kind diagnostics through the
existing privacy-safe error boundary. Settings/customization and popup actions
remain unavailable if their required owner is missing; any required capability
loss fails the window open to native Firefox UI.

## Rejected alternatives and deferred work

- Cloning every pinned extension widget was rejected because arbitrary widget
  identity, customization state, icon, command, and panel ownership would cross
  the bridge. Unified Extensions plus complete-toolbar reveal preserves native
  access instead.
- Reimplementing Trust, identity, protections, permissions, Downloads, or the
  application menu was rejected for this pass because it would duplicate
  security-sensitive data and actions without complete contracts.
- Moving native anchors into the custom top row was rejected because it breaks
  Firefox ownership, popup anchoring, and customization assumptions.
- Replacement caption buttons were rejected because the retained Firefox nodes
  already own Windows commands, accessibility, maximized/restored state, and
  platform integration.

A future separately reviewed issue may define project-owned identity and
protection panels. It must first specify complete typed data/action contracts,
source pins, privacy limits, certificate and exception behavior, popup
accessibility, failure recovery, and parity tests. Until then, the native panel
handoffs are normative and the bounded Fennevia labels are summaries only.

## Validation and remaining risk

Focused checks completed during implementation:

```powershell
npm run format:check
npx prettier --plugin=prettier-plugin-svelte --check src/shell/App.svelte src/shell/ShellIcon.svelte
npm run lint
npm run typecheck
npm run build
node --test tests/edge-surfaces.test.mjs tests/frontend-build.test.mjs tests/native-ui.test.mjs tests/browser-tools-state.test.mjs tests/firefox-browser-tools.test.mjs
pwsh -NoProfile -ExecutionPolicy Bypass -File .\tests\shell-health.Tests.ps1
node --check tests/firefox-window-lifecycle.mjs
npm run artifacts
npm run dependencies:audit
node --test tests/license-policy.test.mjs
```

Results: the focused Node matrix passed 32/32; the PowerShell health wrapper's
embedded Node matrix passed 39/39 and its lifecycle syntax probe passed; lint,
format, explicit Svelte format, and type checking passed with zero diagnostics;
all 12 production artifacts matched the inventory/security policy; and the
dependency audit found no installed lifecycle package and no wasm file. The
three licensing/provenance policy tests also passed.

The first build failed with
`FENNEVIA_BUILD_SVELTE_DIAGNOSTIC_SET_INVALID`: adding the first child Svelte
component introduced the pinned `props_invalid_value` runtime diagnostic. The
deterministic build allowlist was updated for that exact slug; the subsequent
double build and package-manifest synchronization passed.

The complete repository and real-Firefox matrices were intentionally not run in
this pass. Consequently, native popup anchoring, the permission panel when its
native indicator is visually collapsed, toolbar reveal lifetime, caption
position in restored/maximized windows, window drag release, and responsive
layout remain manual-test risks rather than claimed passes.
