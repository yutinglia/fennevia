# Firefox 153 Urlbar trust, permission, and action coverage research

## Environment

- Date: 2026-08-16
- Firefox version: 153.0.4 release
- Build ID: `20260810162159`
- Channel: release
- Operating system: Windows 11 Pro 25H2, build `26200.9168`
- Profile: marker-owned `fennevia-dev`
- Program: marker-owned copy of the stock Firefox installation
- Project base commit: `af8075411d0925a8991bd0ad03f349c6e3557e66`
  plus the issue #37 worktree
- Package: `0.10.0-dev`
- Official release commit:
  [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)

Only this Firefox release and Windows environment were validated. This record
makes no Linux, macOS, ESR, Beta, Nightly, touch, or later-release support
claim.

## Goal and owner refinement

Issue #37 closes the Urlbar coverage gate before content-only activation. The
owner chose a two-level presentation:

- the left launcher remains short and always shows Firefox-derived
  connection/HTTPS and Enhanced Tracking Protection status;
- the centered popup shows fuller connection and protection text, site
  permission indicators, and a bounded list of applicable Firefox Urlbar
  actions;
- a clear **Open full Firefox address bar** action hands focus directly to
  Firefox for complete panels, prompts, extension actions, suggestions, and
  commands.

Coverage means preserving meaning and a reliable action path. It does not mean
cloning Firefox-owned DOM, reconstructing security panels, or duplicating the
Urlbar provider stack.

## Current Firefox source pins

| Source | Release blob | Relevant ownership |
| --- | --- | --- |
| [`navigator-toolbox.inc.xhtml`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/navigator-toolbox.inc.xhtml) | `7b2ac0dc179b5630a06b11d4472eedb7e8e6d099` | Complete static `moz-urlbar` slot and anchor inventory |
| [`navigator-toolbox.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/navigator-toolbox.js) | `10faff18ca0c6df472de81b5dbdba83309fa2eb8` | Toolbox-owned conditional Urlbar controls |
| [`browser-siteIdentity.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/browser-siteIdentity.js) | `c6d060853cd3dab9d5c02bdc8de707b8fbde4b6d` | Connection classification and identity panel |
| [`browser-siteProtections.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/browser-siteProtections.js) | `b99b442344d3164ea6ef9551455db8a54e61922e` | ETP state and protections panel |
| [`browser-trustPanel.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/browser-trustPanel.js) | `2389349e7cb062a3297df075a29fdf99c8e68cca` | Unified trust-button behavior |
| [`browser-sitePermissionPanel.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/browser-sitePermissionPanel.js) | `f66ebbf42bc687db8e770fdfc7dce44746d9b31e` | Permission icon refresh, sharing state, and native permission panel |
| [`SitePermissions.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/modules/SitePermissions.sys.mjs) | release source | Permission state and browser-scoped `PermissionStateChange` events |
| [`browser-pageActions.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/browser-pageActions.js) | `00da33bc11189db17b6a2e656acb3a778531197c` | Native and extension page-action placement and commands |
| [`PageActions.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/modules/PageActions.sys.mjs) | release source | Page-action registry, ordering, and Urlbar visibility policy |
| [`UrlbarInput.mjs`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/urlbar/content/UrlbarInput.mjs) | `23a4e5c9be70131550b4bfd6fa3e60a500f1e88d` | Search mode, persisted search, view, selection, and native input behavior |
| [`browser.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/base/content/browser.js) | release source | `openLocation(event)` and `UrlbarUtils.getURLBarForFocus(window)` |
| [`urlbar-searchbar.css`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/themes/shared/urlbar-searchbar.css) | `cc595de7e3839f7e688122552bca95f9f9ad3988` | Current owner visibility, overflow, and conditional styling |

Searchfox's current `firefox-main` versions of the same files were also
checked on 2026-08-16. The item families and owner boundaries remained
recognizable, but only Firefox 153.0.4 is a validated target.

## Exact leading and site-information inventory

| Firefox item | State/event and action owner | Private/security classification | Fennevia treatment |
| --- | --- | --- | --- |
| `remote-control-box` | `gRemoteControl` reflects automation state on the browser root | Security-relevant warning; per-window DOM | Fixed `remote-control` warning enum when Firefox sets `remotecontrol`; full native control remains attached |
| `trust-icon-container` / `trust-icon` / `trust-label` | `browser-trustPanel.js` owns the unified trust entry and panel | Security-sensitive; Firefox-owned panel | Connection and ETP meaning is represented from Firefox handlers; the trust panel itself is retained through native Urlbar access |
| `tracking-protection-icon-container` | `gProtectionsHandler` and `ContentBlockingAllowList` own state, exceptions, commands, and panel | Security-sensitive and private-window aware | Existing #13 fixed ETP enum remains in the short launcher and detailed popup; native panel and mutation stay Firefox-owned |
| `identity-box` / `identity-icon-box` | `gIdentityHandler` owns connection classification and the identity/certificate panel | Security-sensitive | Existing #13 fixed connection enum remains in both surfaces; certificate/origin material and native panel never cross the bridge |
| `identity-permission-box` | `gPermissionPanel.refreshPermissionIcons()` owns `hasPermissions`, sharing state, and panel invocation | Permission-sensitive and browser-window scoped | New popup card exposes only availability plus fixed sharing/blocked enums; management remains native |
| `urlbar-label-switchtab` | Urlbar result/provider code marks a selected result as switch-to-tab | Browsing-derived provider state | Intentionally retained, not mirrored; native handoff opens the complete provider UI |
| `urlbar-label-extension` | Urlbar result/provider code marks an extension-owned result | Extension/provider-sensitive | Intentionally retained; no extension name, ID, result, or object crosses |
| `urlbar-search-mode-indicator` and close control | `gURLBar[searchmode]` and `UrlbarInput` own mode and close behavior | Search-derived state | Fixed `search-mode` availability enum only; editing and exit remain native |
| `urlbar-revert-button-container` / `urlbar-revert-button` | `gURLBar[persistsearchterms]` and `UrlbarInput` own persisted-search reversion | Search-derived state | Fixed `persisted-search` availability enum only; command remains native |

The bridge observes only the Firefox-owned root and `gURLBar` attributes needed
for the fixed entries. It does not read trust labels, tooltip text, origin
strings, result payloads, provider names, or panel contents.

## Exact permission-indicator inventory

Firefox 153 keeps the four active-sharing icons below
`identity-permission-box`. `gPermissionPanel.updateSharingIndicator()` sets
their `sharing` attributes and `hasSharingIcon`; the bridge maps only these
fixed kinds:

| Firefox ID | Fennevia fixed kind | Popup meaning |
| --- | --- | --- |
| `webrtc-sharing-icon` | `media` | Camera, microphone, or screen in use |
| `geo-sharing-icon` | `location` | Location in use |
| `xr-sharing-icon` | `xr` | XR device in use |
| `serial-sharing-icon` | `serial` | Serial device in use |

Firefox 153 keeps the following blocked icons below
`blocked-permissions-container`. `refreshPermissionIcons()` reads
`SitePermissions.getAllForBrowser()` and sets `showing`; the bridge reads only
`showing` and the allowlisted static `data-permission-id`.

| Firefox permission ID | Fennevia fixed kind |
| --- | --- |
| `geo` | `location` |
| `xr` | `xr` |
| `desktop-notification` | `notifications` |
| `camera` | `camera` |
| `microphone` | `microphone` |
| `loopback-network` | `loopback-network` |
| `local-network` | `local-network` |
| `screen` | `screen` |
| `persistent-storage` | `persistent-storage` |
| `popup` | `popups` |
| `autoplay-media` | `autoplay` |
| `canvas` | `canvas` |
| `midi` | `midi` |
| `serial` | `serial` |
| `install` | `install` |

Firefox deliberately has no ambiguous icon for blocked speaker selection; the
project does not invent one. Unknown future permission IDs are omitted from
the custom list and remain available through Firefox's panel. Allowed,
prompting, policy, session, temporary, globally blocked, and double-keyed
permission records are not serialized; `hasPermissions` supplies only a
generic indication when no allowlisted blocked icon is active.

The hidden `notification-popup-box` contains Firefox's prompt anchors:
`default`, geolocation, loopback/local network, XR, autoplay, add-on install,
canvas, IndexedDB, password, web notifications, WebRTC device/microphone/screen/
speaker, service install, EME, persistent storage, MIDI, serial, WebAuthn,
identity credential, and storage access. These anchors are prompt routing
infrastructure, not status items. They remain attached and entirely
Firefox-owned; Fennevia does not observe, display, click, move, or clone them.

Permission state follows the selected browser and Firefox's own normal/private
policy. Each Fennevia window has its own observer, immutable snapshot,
subscriber set, and disposer. No private-window marker crosses to the UI.

## Exact trailing and page-action inventory

| Firefox item | Native owner and command | Private/security classification | Fennevia treatment |
| --- | --- | --- | --- |
| `contextual-feature-recommendation` | Firefox CFR owner controls visibility and recommendation action | Browsing-derived recommendation | Fixed `recommendation` availability label; action stays native |
| `userContext-icons` | Container-tab owner controls label/color and container behavior | Contextual identity; hidden where Firefox policy disallows it | Fixed `container` availability label; no container ID/name/color crosses |
| `reader-mode-button` | Reader View owner controls availability and command | Ordinary page action | Fixed `reader-view` availability label; action stays native |
| `picture-in-picture-button` | Picture-in-Picture owner controls availability and command | Media-derived | Fixed `picture-in-picture` availability label; action stays native |
| `taskbar-tabs-button` | Windows taskbar-tab owner controls visibility and command | Platform-conditional | Fixed `taskbar-tabs` availability label; action stays native |
| `translations-button` | Firefox Translations owner controls language state and panel | Page-language derived | Fixed `translations` availability label; locale/language never crosses |
| `urlbar-zoom-button` | `FullZoom`/`ZoomUI` own level and reset command | Ordinary page state | Fixed `zoom` availability label; level and reset remain native |
| `split-view-button` | Split View owner controls availability and command | Page/tab-derived | Fixed `split-view` availability label; action stays native |
| `pageActionButton` | `BrowserPageActions` owns overflow and panel | Aggregated native/extension actions | Fixed `more-page-actions` label only when Firefox marks multiple children; panel remains native |
| `star-button-box` | Places/bookmark UI owns state, editing panel, and command | Browsing URL and bookmark data | Fixed `bookmark` availability label; URL/bookmark data and action remain native |
| dynamic `.urlbar-addon-page-action` children | WebExtension PageActions and `BrowserPageActions` own placement/action | Extension-sensitive and dynamic | One generic `extension-actions` label; no extension ID, name, icon, action ID, object, or command crosses |
| unknown dynamic `.urlbar-page-action[actionid]` children | Current Firefox page-action registry | Future/dynamic owner | One generic `other-page-actions` label; full behavior retained natively |
| `.search-one-offs` | Urlbar providers/SearchService own engines, settings, and result commands | Search/provider-sensitive; private policy owned by Firefox | Intentionally retained, not mirrored; native handoff is the access path |

`BrowserPageActions.placeActionInUrlbar()` and each feature owner remain the
source of truth for visibility. The bridge does not synthesize click events,
invoke private page-action methods, copy localized native labels, or assume a
hidden action is available. Fixed labels describe only current applicability.

## Coverage classification

| Item family | Classification before #15 |
| --- | --- |
| Connection/HTTPS identity | Accurately represented by #13's fixed Firefox-derived enum in both the short launcher and detailed popup; certificate/identity panel retained natively |
| Enhanced Tracking Protection | Accurately represented by #13's fixed Firefox-derived enum in both surfaces; exception mutation and protections panel retained natively |
| Active and blocked permission indicators | Accurately represented by #37 fixed booleans/enums in the detailed popup; all permission records, prompts, management, and panel retained natively |
| Static conditional page actions | Current Firefox-owned applicability represented by #37 fixed labels; commands and panels retained natively |
| Dynamic native/extension page actions | Generic presence represented without identity; complete action list and commands retained natively |
| Remote control, search mode, persisted search | Fixed availability represented; controls remain native |
| Switch-to-tab/extension result labels, suggestions, autofill, providers, one-offs | Intentionally not mirrored because the project does not replace the provider ecosystem; retained through native handoff |
| Notification anchors and security prompts | Intentionally not mirrored or intercepted; retained as Firefox-owned infrastructure |

No child issue was needed: the accepted implementation is one coherent,
read-only fixed-state bridge plus native handoff. It adds no security mutation,
prompt handling, provider stack, or page-action command surface.

## Minimum implementation

- `src/firefox/urlbar-coverage.ts` creates one per-window controller inside the
  existing ADR-023 boundary. Required capabilities are `window.openLocation`,
  `MutationObserver`, `gURLBar`, the document root, and the three fixed owner
  containers.
- One `MutationObserver` watches four existing owner roots. There is no timer,
  polling fallback, process-global mirror, or second edge/popup controller.
- The public snapshot contains only fixed enum arrays and booleans. Application
  validation copies and freezes it again before Svelte receives an adapter.
- The popup adds one full-width permission card and one Firefox-controls
  section. Connection and ETP rows remain; the short launcher remains unchanged.
- The native-access button closes the project popup with an environment reason,
  then calls Firefox's current `window.openLocation()`. Firefox selects the
  current native Urlbar and opens its view according to current policy.
- Missing capability, malformed snapshot/event, observer failure, subscriber
  failure, component failure, or native handoff failure uses the existing
  typed error and ADR-021 fail-open path.
- Disposal disconnects the exact observer, clears subscribers, releases the
  window reference, disposes the application adapter, and remains idempotent.

## Security and privacy effects

- No URL, origin, principal, certificate, permission object, permission scope,
  extension identity, page-action ID, localized Firefox label, search value,
  history item, browser, window, or native DOM node crosses `src/firefox/`.
- Fixed enums and booleans never enter normal diagnostics, persistence, CSS
  variables, or root datasets. UI datasets contain only fixed project markers
  and fixed tone values.
- The observer reads owner-set attributes and child presence only. It never
  modifies Firefox-owned Urlbar DOM.
- Native identity, trust, protections, permission, extension, and page-action
  panels remain authoritative. Fennevia never bypasses their prompts or command
  paths.
- The implementation adds no dependency, runtime network access, telemetry,
  storage, resource mapping, Chrome override, or source map.

## Compatibility canaries

The current heads checked on 2026-08-16 were:

- Alice0775/userChrome.js
  [`5e146e348a56a914e6c016d29733e8ee8d468155`](https://github.com/alice0775/userChrome.js/commit/5e146e348a56a914e6c016d29733e8ee8d468155)
- MrOtherGuy/fx-autoconfig
  [`dfdab5684faffc112b76ccb1d8cab7f75da0102c`](https://github.com/MrOtherGuy/fx-autoconfig/commit/dfdab5684faffc112b76ccb1d8cab7f75da0102c)
- xiaoxiaoflood/firefox-scripts
  [`a898ac59fb0ca3886c0c46b184fdbc037c83c037`](https://github.com/xiaoxiaoflood/firefox-scripts/commit/a898ac59fb0ca3886c0c46b184fdbc037c83c037)
- aminomancer/uc.css.js
  [`88514013ddc375f4770f4a35d8d07a91d6dd7d8f`](https://github.com/aminomancer/uc.css.js/commit/88514013ddc375f4770f4a35d8d07a91d6dd7d8f)

Recent relevant history and current-version files were checked, not only their
README files. Alice's permission customization and xiaoxiaoflood's Urlbar code
are old/deprecated for this purpose; aminomancer's recent Urlbar changes concern
current provider names and screenshot localization rather than a safe generic
coverage layer. The canaries remain compatibility signals only. No code,
selector, DOM strategy, timer, or visual value was copied.

## Validation performed

- `npm run verify` passed formatting, lint, Svelte/TypeScript checks, all 142
  Node tests, dependency audit, deterministic frontend/bridge builds, exact
  manifest synchronization, and the production artifact scan.
- Unit coverage validates fixed-enum snapshots, unknown-value rejection,
  observer-driven permission/page-action changes, native handoff, capability
  failure before surviving observers, subscriber isolation, and exact cleanup.
- The real Firefox lifecycle matrix passed cold startup/restart, existing and
  second normal windows, a private window, frontend unmount/remount, runtime
  disposal, no duplicate observer/root, and no unexpected first-party Browser
  Console error.
- The targeted real-profile matrix compared Firefox's own connection and ETP
  handlers with both Fennevia surfaces for ordinary HTTP, valid HTTPS, a secure
  Firefox internal page, and a real network-error page. It also set and removed
  one browser-scoped temporary blocked-camera permission and added/removed one
  ETP exception, with every test mutation restored in `finally`.
- Firefox's real zoom action appeared and disappeared in the custom list from
  native events. Static owner visibility was compared item by item. The native
  access button closed the custom popup and focused `gURLBar`.
- Browser Toolbox selected the shared project frame, confirmed all five owned
  XHTML boundaries, retained native infrastructure, and completed without a
  first-party script error.
- Real fail-open injection passed a missing
  `FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING` path: all project hosts
  were removed and native browser UI remained usable. Exact bridge restoration
  then passed the complete ordinary matrix. Missing and deliberately throwing
  frontend bundles produced the same native fallback; exact frontend restoration
  again passed the complete ordinary matrix. Every run ended with zero Firefox
  process.

The valid-HTTPS test loads only the fixed public `https://example.com/` fixture
and sends no user or browsing data. Ordinary HTTP, permission, and network-error
fixtures use an ephemeral loopback server. A temporary
`network.dns.localDomains` test preference makes `fennevia.test` resolve locally
so Firefox exercises a genuine `not-secure` origin rather than its special
potentially-trustworthy loopback classification; the original preference is
restored exactly.

## Required #15 handoff

Issue #15 may hide the native navbar only after its active-state CSS and
controller prove all of the following:

1. invoking **Open full Firefox address bar** makes the native navbar/Urlbar
   visible, focused, and usable even while content-only mode is active;
2. leaving the native Urlbar or closing its view returns to the intended
   content-only presentation without removing Firefox-owned state;
3. trust, identity/certificate, protections, permission, extension, bookmark,
   translation, zoom, and overflow panels remain reachable and unobstructed;
4. prompts anchored in `notification-popup-box` remain correctly positioned;
5. customize mode, fullscreen, Browser Toolbox, safe start, emergency fallback,
   missing CSS, and any bridge/component failure immediately retain or restore
   the native surface.

Until those activation checks pass, Firefox's navbar and Urlbar remain visible.
The #37 implementation is a pre-activation coverage proof, not authorization to
hide or remove native chrome by itself.
