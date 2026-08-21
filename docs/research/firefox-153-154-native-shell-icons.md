# Firefox 153/154 native shell icon research

## Environment

- Date: 2026-08-22
- Operating system: Windows 11, x64
- Installed Firefox inspected: 154.0 release, BuildID `20260812182057`, source
  stamp `9ce1ee6baeb9a3c326dbd180bdece65d8fc2eadc`
- Comparison Firefox: 153.0.4 release, BuildID `20260810162159`
- Profile state: source/package inspection and automated frontend validation;
  live Browser Toolbox visual validation for this follow-up: **not run**
- Project base commit: `ffacf17`
- Official Firefox pins:
  - 153.0.4
    [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)
  - 154.0
    [`032a9fc1ac0cc3209f7c142744ba2e40847c8086`](https://github.com/mozilla-firefox/firefox/commit/032a9fc1ac0cc3209f7c142744ba2e40847c8086)

## Request and first causal evidence

The owner reported that the top-bar Settings icon looked like a sun and asked
whether Fennevia could use Firefox's original icon instead of drawing another
one, then requested a complete project icon audit. There was no runtime
exception. The first causal mismatch was visual: the previous 24 px
project-authored Settings path was a circle with radial strokes, while Firefox
153/154 maps its Settings toolbar button to the filled 16 px gear at
`chrome://global/skin/icons/settings.svg`.

The audit compared current source, generated-facing components, and installed
Firefox resources rather than changing only that one button:

- Firefox 153.0.4 and 154.0
  [`toolbarbutton-icons.css`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/themes/shared/toolbarbutton-icons.css)
  provide the canonical toolbar mappings for Back, Forward, Reload, Stop,
  Home, Settings, menu, bookmarks, and the remaining built-in widgets.
- Both versions'
  [`tabs.css`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/themes/shared/tabbrowser/tabs.css)
  reference Firefox's default favicon, loading, sharing, crash, audio, close,
  and new-tab resources.
- Firefox package manifests and the installed 154.0 `browser/omni.ja` and root
  `omni.ja` were checked for every selected path. The installed archives also
  confirmed `resource://content-accessible/close-12.svg`.
- The same source comparison found a real supported-version difference:
  Firefox 153 uses `send-tab-20.svg`, while Firefox 154 uses `send-tab.svg`.
  The pinned fallback now resolves that path by Firefox major version.
- The former IP Protection pinned fallback was tied to a version-specific
  toolbar fragment. Both supported packages contain the stable panel-state
  resource at
  `chrome://browser/content/ipprotection/assets/states/ipprotection-off.svg`,
  so that is the new fallback when computed style and CSSOM do not provide the
  live URL.

Searchfox was attempted for the same source lookup but its request path was
unavailable in this session. The decision therefore relies on the exact
official Mozilla source commits above and direct inspection of the installed
154.0 package, not on a stale snippet or Searchfox claim.

## Compatibility canaries checked

The required current compatibility canary heads were inspected for relevant
icon/path adaptations:

- Alice0775/userChrome.js
  [`8481c32e00f1cf14295322a7a1d59075d419405a`](https://github.com/alice0775/userChrome.js/commit/8481c32e00f1cf14295322a7a1d59075d419405a)
- MrOtherGuy/fx-autoconfig
  [`dfdab5684faffc112b76ccb1d8cab7f75da0102c`](https://github.com/MrOtherGuy/fx-autoconfig/commit/dfdab5684faffc112b76ccb1d8cab7f75da0102c)
- xiaoxiaoflood/firefox-scripts
  [`a898ac59fb0ca3886c0c46b184fdbc037c83c037`](https://github.com/xiaoxiaoflood/firefox-scripts/commit/a898ac59fb0ca3886c0c46b184fdbc037c83c037)
- aminomancer/uc.css.js
  [`88514013ddc375f4770f4a35d8d07a91d6dd7d8f`](https://github.com/aminomancer/uc.css.js/commit/88514013ddc375f4770f4a35d8d07a91d6dd7d8f)

The first three supplied no narrower Settings resource decision. The last uses
Firefox theme resources in its own customization context, but no selector,
code, value, or asset was copied. Loader behavior and native-DOM mutation remain
out of scope.

## Exact resource mapping selected

| Fennevia concept                          | Installed Firefox resource                                              |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| Back / Forward / Home / menu              | `chrome://browser/skin/{back,forward,home,menu}.svg`                    |
| Reload / Stop / Settings                  | `chrome://global/skin/icons/{reload,close,settings}.svg`                |
| Extensions                                | `chrome://mozapps/skin/extensions/extension.svg`                        |
| Search / external open / arrows           | corresponding `chrome://global/skin/icons/` resources                   |
| Bookmark action / bookmark item           | `bookmark-star-on-tray.svg` / `bookmark.svg`                            |
| Download / error / pause / complete / add | packaged Downloads, global icon, and media resources                    |
| Tab fallback / loading                    | `defaultFavicon.svg` / `loading.svg`                                    |
| Tab audio / sharing / crash / PiP         | packaged `tabbrowser`, `notification-icons`, and media resources        |
| Tab pin / close / new                     | `pin.svg`, `resource://content-accessible/close-12.svg`, and `plus.svg` |
| Customize and popup close                 | `customize.svg` and the global `close.svg`                              |
| Fixed widget fallbacks                    | exact packaged Firefox assets selected by the closed presentation token |

`FirefoxIcon.svelte` is the single fixed allowlist for the exact project-owned
controls. It accepts only a TypeScript union token, emits one decorative XHTML
`span`, and applies both mask properties inline. Shared CSS supplies the 16 px
footprint and `currentColor`; smaller 12–14 px consumers override only size.
No arbitrary resource URL enters that component.

Firefox's own `loading.svg` includes its native animation and reduced-motion
variant. The prior outer CSS rotation was removed to avoid double animation
and to leave the behavior with the original asset.

## Whole-project audit and retained exceptions

- Top surface: every exact navigation/browser-tool action now uses the native
  map. Settings is the requested native gear.
- Tabs: fallback, loading, sharing, crash, PiP, audio, pin, close, and new-tab
  visuals now use Firefox resources. Favicon values remain the existing
  allowlisted dynamic `<img>` data.
- Address popup, bookmarks, downloads, and customize panel: text-symbol or
  project paths with exact semantic equivalents now use Firefox resources.
  The Enter `↵` label remains a keyboard hint, not an icon.
- Toolbar widgets: extension images and computed native resource URLs remain
  dynamic bounded values. A fixed native token is tried before the small
  project fallback set.
- Trust: ADR-059's four-state Firefox resource map remains separate because it
  derives a security state and has stricter precedence rules.
- Window minimize, maximize/restore, and close remain project-authored SVGs.
  They represent Windows caption behavior and state; Firefox styles native
  platform controls rather than exposing one reusable fixed icon family.
- Shield, zoom, and generic widget fallback remain project-owned because no one
  fixed resource is semantically correct for every unresolved owner.
- The customize spacer middle dot remains a non-interactive layout marker,
  not a semantic control icon.

The old broad `ShellIcon` catalog was reduced to those reviewed exceptions.
This keeps one coherent Firefox family where semantics are exact without
mislabeling dynamic or platform-owned visuals as native equivalents.

## Security, privacy, licensing, and failure behavior

- Every new reference is a fixed installed-package URI; none is derived from a
  URL, title, bookmark, download, extension identity, preference, or user
  input.
- The map adds no network request, resource/content mapping, remote fallback,
  dependency, native node, privileged action, persistence, telemetry, or log
  field.
- Firefox SVG bytes are not copied or redistributed. Fennevia only asks the
  installed Firefox chrome registry for its own packaged resources, so no new
  third-party artifact enters the repository and `THIRD_PARTY_NOTICES.md`
  remains unchanged.
- Missing or renamed fixed paths are unsupported-internal compatibility drift.
  There is no generic discovery or URL fallback. Required frontend/resource
  failure continues through the existing health boundary to retained native
  Firefox UI.

## Validation performed

- Firefox 153.0.4/154.0 source and installed-package path comparison: complete.
- Whole-project source audit for inline SVGs, text-symbol icons, masks, and
  image sources: complete.
- `npm run typecheck`: 0 errors and 0 warnings.
- Focused frontend/tab/widget tests: 32 passed.
- `git diff --check`: passed.
- The first complete `npm run verify` reached the deterministic build after all
  earlier gates passed, then stopped at
  `FENNEVIA_BUILD_SVELTE_DIAGNOSTIC_SET_INVALID`. Raw Vite output proved that
  the simplified component graph no longer includes Svelte's
  `props_invalid_value` runtime diagnostic. Removing only that obsolete
  expected slug restored the exact closed diagnostic set; no endpoint or new
  runtime branch was allowlisted.
- Final complete `npm run verify`: passed. It included format, ESLint,
  Svelte/TypeScript, 296 Node tests, 87.60% line coverage, 95.33% function
  coverage, all fixed-list PowerShell suites, dependency audit, two matching
  frontend/bridge builds, and all 14 production artifacts against the explicit
  inventory and security rules.
- Generated shell hashes: `ShellApp.js`
  `db2ceec1ccb065930be94b3316244c837d11cc466b86248af9955d67a75abe04`;
  `ShellStyles.sys.mjs`
  `bf1420e0ae7400997e34c0987d7b8d3ad8e32968e71a67fef6c8ee0df035bac`.
- Real Firefox normal/second/private, light/dark/system theme, reduced motion,
  forced colors, high DPI, missing-resource fail-open, and visual-alignment
  matrix: **not run**.

## Remaining risk

- These `chrome://` and `resource://` paths are unsupported Firefox internals
  and can move between stable releases, as the Send Tab difference already
  demonstrates. Revalidate every URI and version branch for each supported
  Firefox update.
- Source and unit checks do not prove mask rendering, context color, sizing,
  animation, or optical alignment in a real browser. Those rows remain
  explicitly pending.
- Firefox can intentionally redesign its icon family. Fennevia should update
  its fixed map from current source rather than preserve old copied geometry.
