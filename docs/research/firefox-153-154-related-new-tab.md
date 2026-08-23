<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 153/154 related New Tab from middle-click and accel-click

## Environment and report

- Date: 2026-08-24.
- Supported source targets reviewed: Firefox 153.0.4
  [`FIREFOX_153_0_4_RELEASE`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-commands.js)
  at commit
  [`c178247e1dfea52241a6b18b18cf3a00f8da935c`](https://github.com/mozilla-firefox/firefox/commit/c178247e1dfea52241a6b18b18cf3a00f8da935c)
  and Firefox 154.0 commit
  [`032a9fc1ac0cc3209f7c142744ba2e40847c8086`](https://github.com/mozilla-firefox/firefox/commit/032a9fc1ac0cc3209f7c142744ba2e40847c8086).
- Owner-requested behavior: middle-click the project-owned New Tab control to
  open a new tab under the current tab, matching Firefox original behavior.
- Real Firefox Browser Console / Browser Toolbox validation was `not run`
  during this change. CI unit, type, and generated-artifact checks are the
  required gate.

## First causal evidence

Fennevia's New Tab button called `tabs.open({ selected: true })`, which passed
only `{ inBackground }` to `gBrowser.addTrustedTab`. Without
`relatedToCurrent`, Firefox `addTab` treats the tab as unrelated and appends it
at the end of the strip (`index = this.tabs.length`) unless
`browser.tabs.insertAfterCurrent` is true.

Firefox chrome may also dispatch both `click` and `auxclick` for one physical
middle press. The New Tab control had only `onclick` and no middle-button
autoscroll prevention.

## Current Firefox behavior adopted

| Surface | Firefox 153/154 behavior used by Fennevia |
| --- | --- |
| New Tab command | [`browser-commands.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-commands.js) `BrowserCommands.openTab({ event })` sets `relatedToCurrent = true` when `BrowserUtils.whereToOpenLink` returns `tab` or `tabshifted` (middle-click or accel-click). Ordinary left click stays unrelated. |
| Insertion | [`tabbrowser.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content/tabbrowser.js) `addTab` uses an opener from `relatedToCurrent && selectedTab`, then inserts after that opener or its last related tab when `browser.tabs.insertRelatedAfterCurrent` (default true) or `insertAfterCurrent` is set. Related tabs also inherit the current container. |
| Trusted open | Existing Fennevia `addTrustedTab(BROWSER_NEW_TAB_URL, writableOptions)` remains the new-tab action. The command's `browser-open-newtab-start` observer is still not used; left-click New Tab already skipped it. |
| Empty tab bar | Native `tabs.js` middle-click on empty strip calls `BrowserOpenTab()` with no event, so that path is **not** related. Out of scope. |
| Linux clipboard | `searchclipboardfor.middleclick` / `middlemouse.paste` is Linux-oriented and is not implemented on this Windows-first path. |

## Compatibility canaries

The four required compatibility-canary heads were unchanged from the immediately
preceding research records:

- `alice0775/userChrome.js` at
  [`a39f5cb60d40d01a1ae6d65935db152e7ac23111`](https://github.com/alice0775/userChrome.js/commit/a39f5cb60d40d01a1ae6d65935db152e7ac23111);
- `MrOtherGuy/fx-autoconfig` at
  [`dfdab5684faffc112b76ccb1d8cab7f75da0102c`](https://github.com/MrOtherGuy/fx-autoconfig/commit/dfdab5684faffc112b76ccb1d8cab7f75da0102c);
- `xiaoxiaoflood/firefox-scripts` at
  [`a898ac59fb0ca3886c0c46b184fdbc037c83c037`](https://github.com/xiaoxiaoflood/firefox-scripts/commit/a898ac59fb0ca3886c0c46b184fdbc037c83c037);
- `aminomancer/uc.css.js` at
  [`88514013ddc375f4770f4a35d8d07a91d6dd7d8f`](https://github.com/aminomancer/uc.css.js/commit/88514013ddc375f4770f4a35d8d07a91d6dd7d8f).

No canary supplies Fennevia's `tabs.open` contract. No external code, selector,
timer, or visual composition was copied.

## Minimum Fennevia change selected

1. Extend `OpenTabOptions` with optional `relatedToCurrent`. Invalid keys or
   non-boolean values fail as `FENNEVIA_FIREFOX_TAB_OPEN_OPTIONS_INVALID`.
2. Pass `relatedToCurrent: true` on the existing writable `addTrustedTab`
   options record only when requested. Do not invent a `tabIndex`.
3. On the New Tab button, ignore non-primary `click`, handle middle `auxclick`,
   treat Ctrl/Command+click as related, map Shift+related to background, and
   prevent middle autoscroll on `mousedown`.
4. Keep tab-row middle-click close, panel-context New Tab, and Ctrl+T unchanged.

## Validation

- Focused Node tests in `tests/firefox-tabs.test.mjs` and static strip checks
  in `tests/tab-strip.test.mjs`.
- Real Firefox middle-click / accel-click insertion, Shift+middle background,
  container inheritance, and `insertRelatedAfterCurrent=false` rows: `not run`.
