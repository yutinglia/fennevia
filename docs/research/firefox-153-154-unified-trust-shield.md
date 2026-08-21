# Firefox 153/154 unified Trust shield research

## Environment

- Date: 2026-08-22
- Firefox versions: 153.0.4 and 154.0 release
- Build IDs: `20260810162159` and `20260812182057`
- Operating system: Windows 11 Pro 25H2
- Profile: marker-owned `fennevia-dev`; live Browser Toolbox validation for
  this follow-up: **not run**
- Project base commit: `3713ad7`
- Pull request: #91
- Official Firefox pins:
  - 153.0.4 [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)
  - 154.0 [`032a9fc1ac0cc3209f7c142744ba2e40847c8086`](https://github.com/mozilla-firefox/firefox/commit/032a9fc1ac0cc3209f7c142744ba2e40847c8086)

## Request and first causal evidence

The compact address launcher and centered popup exposed connection/HTTPS and
Enhanced Tracking Protection as two text-chip buttons even though the
supported Firefox versions expose them through one shield. There was no first
runtime exception: this was a current information-architecture and visual
fidelity mismatch shown in the owner-provided screenshot. The owner further
requested the merged shield at the left, inside the compact address frame like
Firefox's original Urlbar.

- Firefox 153.0.4 and 154.0
  [`UrlbarPrefs.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/urlbar/UrlbarPrefs.sys.mjs)
  describes `trustPanel` as combining the privacy shield and connection icons
  and panels in the Urlbar. Both release sources enable its feature gate.
- Both versions'
  [`navigator-toolbox.inc.xhtml`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/base/content/navigator-toolbox.inc.xhtml)
  contain `#trust-icon-container` / `#trust-icon`; legacy
  `#identity-icon-box` and `#tracking-protection-icon-container` remain for the
  compatibility path rather than defining two current visible entries.
- Both versions'
  [`browser-trustPanel.js`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/base/content/browser-trustPanel.js)
  assigns secure/insecure, inactive, and warning classes to the one Trust
  container. It keeps certificate, HTTPS-only, site-data, tracker, exception,
  breach, and action details inside Firefox's panel owner.
- Both versions'
  [`identity-block.css`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/themes/shared/identity-block/identity-block.css)
  map the current classes to `trust-icon-active.svg`,
  `trust-icon-disabled.svg`, `trust-icon-insecure.svg`, and
  `trust-icon-warning.svg`. Insecure excludes the inactive asset and warning is
  declared last, establishing the relevant precedence.
- Both versions'
  [`jar.inc.mn`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/themes/shared/jar.inc.mn)
  package those four files as fixed `chrome://browser/skin/` resources. The
  assets use Firefox context paint and are designed for native chrome.
- Fennevia's existing browser-tools controller already routes both
  `site-information` and `protections` through
  `gTrustPanelHandler.showPopup()`, with the separate legacy anchors retained
  for validation and fallback. No new privileged action is needed.

## Compatibility canaries checked

The same-day Firefox 153/154 tab-status investigation checked the required
current canary heads and their relevant versioned/source paths:

- Alice0775/userChrome.js
  [`8481c32e00f1cf14295322a7a1d59075d419405a`](https://github.com/alice0775/userChrome.js/commit/8481c32e00f1cf14295322a7a1d59075d419405a)
- MrOtherGuy/fx-autoconfig
  [`dfdab5684faffc112b76ccb1d8cab7f75da0102c`](https://github.com/MrOtherGuy/fx-autoconfig/commit/dfdab5684faffc112b76ccb1d8cab7f75da0102c)
- xiaoxiaoflood/firefox-scripts
  [`a898ac59fb0ca3886c0c46b184fdbc037c83c037`](https://github.com/xiaoxiaoflood/firefox-scripts/commit/a898ac59fb0ca3886c0c46b184fdbc037c83c037)
- aminomancer/uc.css.js
  [`88514013ddc375f4770f4a35d8d07a91d6dd7d8f`](https://github.com/aminomancer/uc.css.js/commit/88514013ddc375f4770f4a35d8d07a91d6dd7d8f)

No canary supplied a narrower ordinary adapter. Native-DOM overrides, copied
selectors, and loader behavior remain out of scope; no canary code or asset was
copied.

## Options considered

1. Keep separate text chips and only replace their glyphs. Rejected: it would
   preserve the information-architecture mismatch and duplicate one current
   Firefox panel entry.
2. Copy Firefox's four SVG files into Fennevia. Rejected: copied theme assets
   would create an unnecessary vendored artifact, update duty, and provenance
   surface.
3. Read `#trust-icon-container.classList` directly from Svelte or add the native
   node to frontend state. Rejected: project components cannot access native
   Firefox DOM, and a node/class bridge is broader and more brittle than the
   existing closed state.
4. Add a new privileged `trust` action and remove the two existing actions.
   Rejected: the current actions already converge on the Trust owner and retain
   useful legacy fallback coverage.
5. Render one semantic control, derive four visual states from the existing
   connection/protection enums, use the four packaged fixed chrome resources
   as masks, and invoke the existing `site-information` action. Selected.

## Decision and minimum adaptation

- `FirefoxTrustIcon.svelte` owns one fixed state-to-URI map. It renders an
  `aria-hidden` span with inline `mask-image` and `-webkit-mask-image`; generated
  CSS therefore retains the production rule that forbids `url(...)`.
- The mask is painted with `currentColor`, which preserves Fennevia hover,
  disabled, forced-color, and status-tone behavior without relying on
  context-fill behavior in an `<img>`.
- `navigation-labels.ts` combines the two existing bounded labels, selects a
  deterministic severity tone, and maps warning, insecure, inactive, and
  active states. Network error and certificate override are warning;
  certificate/HTTPS-only error and ordinary insecure states are insecure.
  Warning/insecure connection meaning takes priority over an ETP exception.
- The left launcher and centered popup each render exactly one fixed-footprint
  Trust button. The icon is decorative; the button's localized accessible name
  includes both connection and protection descriptions.
- The button invokes `site-information`. Both browser-tools actions and their
  legacy anchors remain unchanged so health, fallback, and native recovery do
  not depend on the visual merge.
- The existing frontend health contract now requires one Trust control in each
  owned surface plus the independent permission row.

## Security, privacy, and provenance effects

- The change adds no privileged field. Existing connection and tracking enums
  remain the only site-trust state crossing into ordinary application memory.
- URLs, origins, certificates, HTTPS-only exception details, tracker lists,
  breach state, permission principals, native classes/nodes, and handler
  objects remain privileged and absent from logs, persistence, diagnostics,
  datasets, CSS variables, and network requests.
- Firefox remains the sole panel, security-label, ETP mutation, certificate,
  breach, site-data, and action owner. The custom shield is a bounded summary
  and never claims complete parity.
- The four resources are loaded from the installed Firefox package through
  exact `chrome://browser/skin/` URIs. No bytes are copied into source or build
  artifacts, no new content-accessible mapping or dependency is added, and
  `THIRD_PARTY_NOTICES.md` remains unchanged.
- Missing resource or owner behavior is an update-compatibility risk, not a
  reason to fetch or invent an icon. Required UI/bridge health still fails open
  to retained native Firefox chrome.

## Validation performed

- Firefox 153.0.4/154.0 official source, resource, CSS, and owner comparison:
  completed.
- Current required compatibility-canary heads: completed in the same-day
  related investigation.
- Focused state/i18n tests: 4 passed.
- Svelte and TypeScript checks: 0 errors and 0 warnings.
- Focused ESLint: passed with no diagnostics.
- Complete `npm run verify`: 295 tests passed; line coverage 87.59%, function
  coverage 95.32%, deterministic builds matched, and all 14 production
  artifacts passed the explicit inventory and security rules.
- Real Firefox ordinary/second/private, HTTP/HTTPS/ETP/error, panel placement,
  forced-colors, high-DPI, and resource-rendering matrix: **not run**.

## Remaining risk

- The fixed `chrome://browser/skin/trust-icon-*.svg` paths and Trust Panel
  classes are unsupported Firefox internals. Revalidate them on every supported
  stable update.
- Fennevia's existing state intentionally does not expose Firefox's
  asynchronous breach-alert classification, so the custom button cannot mirror
  the native breached variant. The complete native Trust Panel remains the
  authoritative path.
- Source and automated checks do not prove visual mask rendering, color,
  alignment, native panel anchoring, or state timing in a real browser; those
  rows remain explicitly pending.
