<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 153/154 chrome design tokens for the default shell theme

## Environment

- Date: 2026-08-20
- Supported evidence target: Firefox 153.0.4 release and Firefox 154.0
- Build IDs: `20260810162159` (153.0.4), `20260812182057` (154.0)
- Official release tags: `FIREFOX_153_0_4_RELEASE`, `FIREFOX_154_0_RELEASE`
- Official 153 release commit:
  [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)
- Operating-system target: Windows 11 x64
- Package: current development tree after ADR-051

This is a source-mapping record. Real Firefox Light/Dark/System painting,
LWT interaction, reduced-transparency, and forced-colors visual review remain
`not run`. No support claim is added for another Firefox version, channel, or
operating system.

## Goal

Replace the private default glass RGB palette with Firefox's official chrome
color pattern so empty customize style tokens look like stock Firefox Light,
Dark, or System theme.

`yutinglia/my-firefox-custom` was not consulted.

## Upstream sources

| File | 153/154 role |
| --- | --- |
| [`toolkit/themes/shared/design-system/src/tokens/base/color.tokens.json`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/toolkit/themes/shared/design-system/src/tokens/base/color.tokens.json) | Acorn primitives: gray hex, chromatic oklch, `--color-accent-primary` light/dark |
| [`toolkit/themes/shared/design-system/dist/tokens-platform.css`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/toolkit/themes/shared/design-system/dist/tokens-platform.css) | Chrome Light/Dark values for `--panel-*`, `--toolbar-*`, `--color-accent-primary` |
| [`toolkit/themes/shared/design-system/dist/tokens-shared.css`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/toolkit/themes/shared/design-system/dist/tokens-shared.css) | `--focus-outline-color`, `--text-color-error`, `--icon-color-success` / `--icon-color-warning`, `--button-background-color-destructive` |
| [`browser/themes/shared/browser-colors.css`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_154_0_RELEASE/browser/themes/shared/browser-colors.css) | `--chrome-content-separator-color`; LWT focus `#0061e0` / `#00ddff` |
| [`browser/components/storybook/.storybook/theme-light.mjs`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_154_0_RELEASE/browser/components/storybook/.storybook/theme-light.mjs) | Documented `--color-blue-60` hex `#0062f9` |

Firefox 153 and 154 `tokens-platform.css` agree on the Light/Dark in-app
values used here:

- `--toolbar-background-color: light-dark(#f9f9fb, rgb(43, 42, 51))`
- `--toolbar-text-color: light-dark(var(--color-gray-100), var(--color-gray-0))`
- `--panel-background-color: light-dark(var(--color-white), rgb(66, 65, 77))`
- `--color-accent-primary: light-dark(var(--color-blue-60), var(--color-cyan-30))`

Gray primitives from `color.tokens.json`: `#fbfbfe`, `#f0f0f4`, `#bfbfc9`,
`#8f8f9d`, `#5b5b66`, `#23222b`, `#1c1b22`, `#15141a`.

## Selected Fennevia mapping

Runtime CSS `var()` on `#fennevia-shell-frame-host` only. No token JSON, no
`override chrome://`, and no copy of `tokens-platform.css`.

| Fennevia token | Firefox token | Fallback |
| --- | --- | --- |
| `--fennevia-glass-surface` | `--panel-background-color` at 94% | `--toolbar-background-color`, then Light/Dark panel hex |
| `--fennevia-glass-tint` | `--toolbar-background-color` at 82% | `--panel-background-color` |
| `--fennevia-glass-text` | `--toolbar-text-color` | `--panel-text-color`, then gray-100 / gray-0 |
| `--fennevia-glass-muted` | `--toolbarbutton-icon-fill` | `--text-color-deemphasized` |
| `--fennevia-glass-border` | `--panel-border-color` | `--border-color-deemphasized` |
| `--fennevia-glass-separator` | `--chrome-content-separator-color` | `--border-color-deemphasized` |
| `--fennevia-focus-color` | `--focus-outline-color` | `--color-accent-primary`, then `AccentColor` |
| `--fennevia-danger-color` | `--text-color-error` | `--color-red-70` / `--color-red-20` |
| `--fennevia-selected-surface` | `--color-accent-primary` at 20% | `--fennevia-focus-color` |

Status, badge, close, private-window, and field chips consume the matching
`--icon-color-*`, `--button-background-color-destructive`, `--color-purple-*`,
and `--input-text-background-color` tokens. Container-tab stripes stay the
closed ContextualIdentity color names already mapped in issue #60.

Customize swatches use those documented gray hexes plus Acorn step-60 hues
and Storybook `#0062f9`. Empty swatches remain the CSS defaults.

## Rejected alternatives

| Alternative | Why not |
| --- | --- |
| Copy `color.tokens.json` or `tokens-platform.css` into the package | Unnecessary third-party file; chrome already loads the tokens |
| Bind only to LWT `--toolbar-bgcolor` / `--arrowpanel-background` | NativeUi already uses `--toolbar-background-color`; LWT-only colors skip the official Light/Dark Acorn pattern |
| Keep Tailwind-like `#3b82f6` / `#f7fafc` swatches | Those are not Firefox colors |
| Freeze a private hex snapshot of Acorn | Would drift from Light/Dark/System and HCM layers Firefox already maintains |

## Validation

- Static: `tests/tab-strip.test.mjs` and `tests/frontend-build.test.mjs` assert
  the default CSS references `--panel-background-color`,
  `--toolbar-background-color`, `--color-accent-primary`, and
  `--focus-outline-color`, and no longer contains `247 250 252`.
- Generated artifacts: rebuilt `ShellStyles.sys.mjs` / `ShellApp.js`.
- Real Firefox Light/Dark/System, LWT, reduced-transparency, and forced-colors
  painting: `not run`.
