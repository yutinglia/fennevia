# Firefox 153/154 Urlbar editing-value research

Date: 2026-08-27
Status: source research and automated verification complete; real Firefox visual check not run
Project baseline: `ac92f46`
Platform scope: Windows x64, stock Firefox release channel

## 1. Question

Fennevia's compact address launcher intentionally displays Firefox's committed,
trimmed Urlbar value. The centered address panel previously copied that same
string into its focused editable input, so a location such as
`https://www.example.com/` could remain scheme-trimmed while the user edited it.

Determine the smallest Firefox-backed change that restores the protocol at the
editing boundary without reconstructing URLs, changing submission ownership,
or making the compact launcher permanently verbose.

## 2. Pinned source

The current supported source pins are:

- Firefox 153.0.4 tag `FIREFOX_153_0_4_RELEASE`, commit
  `c178247e1dfea52241a6b18b18cf3a00f8da935c`, BuildID
  `20260810162159`;
- Firefox 154.0 tag `FIREFOX_154_0_RELEASE`, commit
  `032a9fc1ac0cc3209f7c142744ba2e40847c8086`, BuildID
  `20260812182057`.

In both versions, `UrlbarInput` exposes separate `value` and
`untrimmedValue` getters. Setting the native value records the full input in
`_untrimmedValue` before applying Firefox's own trimming policy:

- Firefox 153
  [`UrlbarInput.mjs` getters](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/urlbar/content/UrlbarInput.mjs#L2731-L2741)
  and
  [`_setValue`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/urlbar/content/UrlbarInput.mjs#L3227-L3260);
- Firefox 154
  [`UrlbarInput.mjs` getters](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/urlbar/content/UrlbarInput.mjs#L2725-L2735)
  and
  [`setValue`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/urlbar/content/UrlbarInput.mjs#L3205-L3238).

Both versions also retain interaction-specific untrimming. A pointer path
avoids immediately untrimming a complete selection, while keyboard shortcut
focus explicitly allows immediate untrimming. An unchanged untrimmed value is
trimmed again after blur:

- Firefox 153
  [`#maybeUntrimUrl`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/urlbar/content/UrlbarInput.mjs#L4278-L4357)
  and
  [`_on_focus`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/urlbar/content/UrlbarInput.mjs#L5046-L5094);
- Firefox 154
  [`#maybeUntrimUrl`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/urlbar/content/UrlbarInput.mjs#L4257-L4336)
  and
  [`_on_focus`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/urlbar/content/UrlbarInput.mjs#L5136-L5182).

## 3. Selected Fennevia boundary

The compact launcher remains non-editable and keeps the existing bounded
`gURLBar.value` projection while `pageproxystate` is valid. The navigation
bridge additionally requires and copies the public
`gURLBar.untrimmedValue` into a bounded ordinary
`editableAddressValue`. A fresh centered-panel draft uses that field because
the panel immediately focuses and selects its sole input.

When proxy state is invalid, both projected values use the selected browser URI
instead of transient native input. Initial blank/home/new-tab/private locations
remain empty. Reopening an already-active panel only refocuses it and never
replaces its in-progress draft.

Submission is unchanged: the bounded draft is assigned to `gURLBar.value` and
executed through `handleCommand()`. Fennevia does not prepend a scheme, parse or
fix up a URL, call `loadURI`, or alter Firefox's search/principal/disposition
policy.

## 4. Privacy and failure behavior

`editableAddressValue` is page-derived browsing text with the same 4,096-code-
unit cap and prohibitions as the committed address and popup draft. It exists
only in the owning window's in-memory navigation snapshot and the active popup
draft. It must not enter logs, diagnostics, datasets, preferences, clipboard,
project network requests, or another window.

`window.gURLBar.untrimmedValue` is a required Firefox 153/154 capability.
Missing or non-string state fails the required navigation boundary before
listeners attach, preserving the existing native-visible fail-open path.

## 5. Validation

Focused Node tests cover:

- distinct trimmed display and full editing values;
- valid committed, invalid proxy, hidden location, and 4,096-unit bounds;
- popup initialization from the editing value and refocus draft preservation;
- exact missing-capability diagnostics before listener attachment;
- unchanged native `handleCommand()` submission behavior.

The combined focused run passed 92/92 tests. The final `npm run verify` gate
passed under the existing nvm-managed Node 24.18.0 and npm 11.16.0 with 433/433
Node tests, 88.66% line coverage, 81.29% branch coverage, 95.71% function
coverage, every fixed PowerShell 7 suite, dependency audit, deterministic
frontend/bridge output, and 14/14 accepted production artifacts. The complete
fixed-list suite also passed under Windows PowerShell 5.1.

A real Firefox check of launcher-at-rest, mouse open, Ctrl+L open, selection,
blur/close, container alignment, responsive/accessibility environments,
second/private windows, and Browser Console errors is **not run** and must not
be inferred from source or automated tests.
