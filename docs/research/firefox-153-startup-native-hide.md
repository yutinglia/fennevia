# Firefox 153/154 first-paint native-chrome hide

Recorded: 2026-08-20
Issue: owner-approved implementation of the startup topbar-flash plan
(explicit implement request in the planning conversation).

## Environment

- Date: 2026-08-20
- Firefox version: 153.0.4 release and 154.0 release (source pins below)
- Channel: release
- Operating system: Windows 11 (project Windows-first boundary)
- Profile / program: not launched for this record; source and unit/static
  evidence only
- Real Firefox cold-start flash matrix: **not run**

This record does not claim a measured first-paint screenshot. It records the
upstream contracts that make a first-paint hide possible while keeping
fail-open.

## Symptom

Fennevia waits for `browser-delayed-startup-finished` before mounting the
shell and setting `data-fennevia-active`. Firefox paints `browser.xhtml` before
that topic, so the native toolbox is visible until health completes (up to
2,000 ms). That flash is the current ADR-007/ADR-032 contract, not a missed
stylesheet.

## First causal evidence

1. [`browser-init.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-init.js)
   sets `gBrowserInit.delayedStartupFinished` and notifies
   `browser-delayed-startup-finished` after the window is already in use.
   Fennevia's `WindowManager.sys.mjs` (ADR-019) uses that topic as the
   readiness boundary and must not move full shell initialization earlier.
2. [`NativeUi.sys.mjs`](../../profile/chrome/fennevia/content/runtime/NativeUi.sys.mjs)
   gates every hide rule on `data-fennevia-active`. Inserting that sheet at
   delayed startup cannot participate in the first style resolve.
3. Firefox 153.0.4 and 154.0
   [`ManifestParser.cpp`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/xpcom/components/ManifestParser.cpp)
   `kParsingTable` contains `manifest`, `category`, `content`, `locale`,
   `skin`, `override`, and `resource`. There is no `style` or `overlay`
   directive. A `style chrome://browser/content/browser.xhtml ...` line would
   log `Ignoring unrecognized chrome manifest directive 'style'.` and would
   not apply.
4. [`nsIStyleSheetService.idl`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/layout/style/nsIStyleSheetService.idl)
   `loadAndRegisterSheet` applies to all documents, including already-loaded
   ones, immediately. Registered at AutoConfig/Bootstrap time (before the
   first `navigator:browser` window) it is present for the first paint of
   `browser.xhtml`. `AUTHOR_SHEET` is origin author. Sheets must be scoped
   with `@-moz-document url("chrome://browser/content/browser.xhtml")`.
5. [`browser/app/profile/firefox.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/app/profile/firefox.js)
   on Windows sets `browser.startup.preXulSkeletonUI` default `true`. That
   HWND is painted before libxul/`browser.xhtml` and cannot be styled by a
   chrome sheet.

## Compatibility canaries

Inspected as signals only; no loader code was copied:

- `alice0775/userChrome.js` and `MrOtherGuy/fx-autoconfig` still document
  delayed-startup window work. They do not restore the removed manifest
  `style` directive on Firefox 153/154.
- `aminomancer/uc.css.js` historically used chrome.manifest style overlays
  and agent/user sheets. The overlay instruction is unrecognized in current
  `ManifestParser.cpp`. Fennevia does not adopt global unscoped agent sheets.

## Options considered

1. Chrome Registry `style` overlay on `browser.xhtml`. Rejected: the
   instruction is not parsed on Firefox 153 or 154.
2. Ungated `userChrome.css` or a USER/AUTHOR sheet without a timeout.
   Rejected: AutoConfig failure would still leave the sheet in the profile
   or process, which is fail-closed.
3. `domwindowopened` / `chrome-document-global-created` to run the full
   shell. Rejected: ADR-019; `gBrowser` and hosts stay at delayed startup.
4. `override` of `browser.xhtml` or browser CSS. Rejected: ADR-004 / ADR-008.
5. Process `AUTHOR_SHEET` registered when the runtime starts, scoped to
   `browser.xhtml`, with a 2,000 ms `step-end` animation whose `100%` keyframe
   is empty so fill-mode `forwards` restores Firefox cascade values; cancelled
   immediately by `data-fennevia-active`, `data-fennevia-failed`, or
   `data-fennevia-native-ui-suspended`. Selected.
6. Disable `browser.startup.preXulSkeletonUI` from program defaults. Selected
   as a separate Windows fake-toolbar source. Safe start still shows native
   `browser.xhtml` chrome; it only skips the pre-XUL skeleton.

## Selected minimum change

- Keep `chrome.manifest` as the single `content fennevia content/` line.
- Add `StartupNativeHide.css` and `StartupNativeHide.sys.mjs`.
- Register the sheet from `Runtime.sys.mjs` start, before
  `WindowManager.start()`, and unregister on stop or start failure.
- Align animation duration with `DEFAULT_HEALTH_TIMEOUT_MS` (2,000 ms).
- Do not hide `#notifications-toolbar`; do not `display: none` the toolbox
  or `#browser`; do not `visibility: collapse` the toolbox or `#TabsToolbar`
  themselves.
- Durable rest hiding remains NativeUi's seven `data-fennevia-active` rules.

## Validation performed

- Unit tests for sheet register/unregister, runtime start-before-windows
  ordering, and start-failure cleanup.
- Static PowerShell tokens for the timeout, AUTHOR_SHEET, and fail-open
  selectors.
- Real Firefox cold-start flash, CSS 2 s watchdog restore, and skeleton
  comparison: **not run**.

## Security and privacy

The sheet contains no URLs, titles, or browsing data. `@-moz-document`
prevents matching ordinary web content. Registration failure does not block
runtime start. Unregister is deterministic with process stop.
