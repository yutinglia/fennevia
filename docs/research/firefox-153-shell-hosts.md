# Firefox 153 Isolated Shell-Host Research Record

## Environment

- Date: 2026-08-15
- Firefox version: 153.0.4 release
- Build ID: `20260810162159`
- Channel: release
- Operating system: Windows 11 25H2
- Profile: fresh, unregistered, marker-owned Fennevia development profile
- Program: isolated copy of the stock Firefox installation
- Project base commit: `3b62f1fee0a168ba58c248b10bd96e03a81aa601`
- Project work: `codex/issue-6-shell-hosts`, package `0.3.0-dev`
- Official Git mirror tag: `FIREFOX_153_0_4_RELEASE`, commit `c178247e1dfea52241a6b18b18cf3a00f8da935c`

Only Windows and this Firefox release were tested. This record makes no Linux,
macOS, ESR, Beta, Nightly, or later-release support claim.

## Symptom

Issue #6 was a planned compatibility spike rather than a regression with an
existing shell. The unknown was where three project-owned XHTML islands could
join the current `browser.xhtml` tree without moving, replacing, reconciling,
or covering Firefox-owned browser chrome.

The first package-level problem found during the spike was independent of the
DOM: Windows Git converted privileged modules to CRLF while the committed
package SHA-256 values described LF bytes. A fresh checkout could therefore
fail installer verification before Firefox started. The fix is an explicit
repository EOL contract, not platform-specific hashes.

## Minimal reproduction

1. Start the isolated stock program against the clean development profile with
   no Fennevia package installed.
2. Inspect the parent-process chrome document after delayed browser startup.
3. Record namespaces, direct parents, child order, and geometry for
   `document.body`, `#navigator-toolbox`, `#browser`, native sidebar children,
   `#tabbrowser-tabbox`, `#window-modal-dialog`, `#a11y-announcement`, and
   `#fullscr-toggler`.
4. Install package `0.3.0-dev`, cold-start Firefox, and inspect all three hosts
   in normal, second, and private windows.
5. Stop the runtime and verify complete removal. Rename the real tabbox ID for
   one direct initializer call, restore it in `finally`, and verify fail-open
   behavior.
6. Launch the real Browser Toolbox with its connection prompt enabled, accept
   the prompt, select the primary host in the Inspector, and query the host
   boundary through the Inspector walker.

The reusable commands use redacted target placeholders:

```powershell
node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>'

node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>' `
  --browser-toolbox
```

## First causal evidence

### Browser Console

The stock snapshot produced no Fennevia record because no project files were
installed. The installed success matrix produced no unexpected Fennevia error
record or uncaught first-party script exception. The deliberate missing-tabbox
probe produced exactly one expected `shell.hosts-failed` record:

```text
code=FENNEVIA_SHELL_TABBOX_INVALID
domPath=html#main-window>body>#browser>#tabbrowser-tabbox
firefoxVersion=153.0.4
buildId=20260810162159
```

No URL, title, query, profile path, or error message was serialized.

### Stock DOM and Browser Toolbox

The stock parent-process snapshot established:

- the document URI is exactly `chrome://browser/content/browser.xhtml`;
- `html#main-window` and `body` use the XHTML namespace;
- `#navigator-toolbox` and `#browser` are direct XUL children of `body`;
- the toolbox occupied the top 132 CSS pixels in the observed window;
- `#browser` began at y=132 and retained the native content area;
- native sidebar containers, splitters, and `#tabbrowser-tabbox` are direct XUL
  children of `#browser`;
- `#window-modal-dialog`, `#a11y-announcement`, and `#fullscr-toggler` remain
  XHTML children owned by Firefox;
- no Fennevia host existed before installation.

After installation, the Browser Toolbox Inspector selected
`#fennevia-shell-primary-host`. Its walker reported exactly the three expected
host IDs, XHTML namespace on every project element, primary/overlay parents at
`body`, sidebar parent at `#browser`, and native toolbox/browser/tabbox nodes
outside every project host. The normal Browser Toolbox connection prompt was
kept enabled and explicitly accepted.

The automated Inspector bridge uses Firefox's temporary Browser Toolbox test
server only during this probe. Before launch it backs up the child Browser
Toolbox `prefs.js`; after shutdown it restores that file byte-identically,
removes its marker/backup, restores all parent-process test prefs, confirms the
prompt pref remains true, and confirms no port or process remains. The protocol
sequence is based on Mozilla's CC0
[`helpers-browser-toolbox.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/devtools/client/framework/browser-toolbox/test/helpers-browser-toolbox.js).

## Sources checked

### Current Firefox source

- [`browser.xhtml`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser.xhtml): XHTML root/body and tail anchors.
- [`browser-box.inc.xhtml`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-box.inc.xhtml): `#browser`, native sidebar children, splitters, and tabbox order.
- [`navigator-toolbox.inc.xhtml`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/navigator-toolbox.inc.xhtml): navigator toolbox and titlebar/window-control ownership.
- [`titlebar-items.inc.xhtml`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/titlebar-items.inc.xhtml): native minimize, maximize, restore, and close controls.
- [`browser-shared.css`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/themes/shared/browser-shared.css): body flex-column layout used by the primary host.
- [`browser-addons.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser-addons.js): current browser-chrome use of `document.createElementNS(HTML_NS, ...)`.
- [`browser.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/base/content/browser.js): native window-modal dialog use.
- [`content-area.css`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/browser/components/tabbrowser/content-area.css): modal/top-layer behavior around browser content.
- [`Launcher.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/devtools/client/framework/browser-toolbox/Launcher.sys.mjs) and Browser Toolbox [`window.js`](https://github.com/mozilla-firefox/firefox/blob/FIREFOX_153_0_4_RELEASE/devtools/client/framework/browser-toolbox/window.js): separate Browser Toolbox process, Inspector startup, and test-server lifecycle.

Searchfox was used to find the same IDs, namespace creation callers, modal
callers, nearby CSS, and Browser Toolbox code before opening the exact release
files above.

### Maintained compatibility canaries

Heads and relevant issue searches were checked on 2026-08-15:

| Source | Inspected revision or issue | Relevant conclusion |
|---|---|---|
| Alice0775 `userChrome.js` | [`5e146e348a56a914e6c016d29733e8ee8d468155`](https://github.com/alice0775/userChrome.js/commit/5e146e348a56a914e6c016d29733e8ee8d468155) | Current versioned scripts still target native sidebar/tabbox details for individual customizations. That is a compatibility signal, not an ownership model to copy. |
| MrOtherGuy `fx-autoconfig` | [`dfdab5684faffc112b76ccb1d8cab7f75da0102c`](https://github.com/MrOtherGuy/fx-autoconfig/commit/dfdab5684faffc112b76ccb1d8cab7f75da0102c), [issue #92](https://github.com/MrOtherGuy/fx-autoconfig/issues/92), [issue #104](https://github.com/MrOtherGuy/fx-autoconfig/issues/104) | The loader does not own a shell-host abstraction. The sidebar report reinforces clean-profile isolation; the Firefox 153 namespace issue confirms that current chrome mixes XUL and XHTML and selectors/creation must be explicit. |
| xiaoxiaoflood `firefox-scripts` | [`a898ac59fb0ca3886c0c46b184fdbc037c83c037`](https://github.com/xiaoxiaoflood/firefox-scripts/commit/a898ac59fb0ca3886c0c46b184fdbc037c83c037), [issue #393](https://github.com/xiaoxiaoflood/firefox-scripts/issues/393) | Current reports include renamed globals and baseline chrome CSP breakage in legacy overlays/inline handlers. Fennevia uses no inline handlers, legacy overlay loader, or CSP-disabling preference. |
| aminomancer `uc.css.js` | [`88514013ddc375f4770f4a35d8d07a91d6dd7d8f`](https://github.com/aminomancer/uc.css.js/commit/88514013ddc375f4770f4a35d8d07a91d6dd7d8f) | Current customizations contain direct native tab/sidebar styling and broad loader facilities. They were treated as breakage canaries only. |

No production code was copied from these projects. The host implementation was
derived from the stock DOM/source evidence and project invariants.

## Upstream change

This issue did not respond to one newly landed break. The relevant current
state is that `browser.xhtml` is an XHTML document containing both XHTML and
XUL nodes, Firefox's native sidebar/tabbox hierarchy continues to live below
`#browser`, native window-modal UI uses an XHTML dialog/top layer, and the
Browser Toolbox runs in a separate chrome process. Historical all-XUL or old
sidebar snippets are therefore not a reliable insertion contract.

Firefox 153's baseline chrome CSP also makes legacy inline event-handler
patterns an unsuitable foundation. Fennevia creates nodes with DOM APIs, sets
text through `textContent`, and registers no inline script handler.

## Loader-specific baggage identified

The canaries carry behavior Fennevia does not need: arbitrary script discovery,
metadata conventions, general dialog injection, legacy overlays, broad native
subtree patching, historical-version branches, CSP workarounds, and reusable
style loaders. None entered the runtime.

## Options considered

1. Mount directly into `#navigator-toolbox`, `#browser`, the native sidebar, or
   `#tabbrowser-tabbox`. Rejected: a framework root would share ownership with
   Firefox children.
2. Put the primary host before the navigator toolbox. Rejected: it would alter
   the titlebar/toolbox side of the layout and increase OS-control risk.
3. Append the overlay after Firefox's accessibility/fullscreen tail nodes.
   Rejected: those anchors remain Firefox-owned and ordering would be less
   explicit.
4. Replace or move native nodes. Rejected by architecture and fail-open rules.
5. Use Shadow DOM. Rejected because no demonstrated isolation problem requires
   it and it would add theme, focus, accessibility, and Inspector complexity.
6. Override `browser.xhtml`. Prohibited for the initial roadmap.

## Decision and minimum adaptation

`WindowShell.sys.mjs` validates the exact supported document, namespaces,
parents, and source-backed order before creating anything. It creates only:

- an XHTML `section` immediately before `#browser` for the visible diagnostic;
- a hidden XHTML `aside` immediately before `#tabbrowser-tabbox` for a future
  project sidebar mount;
- a hidden, inert, pointer-transparent XHTML `div` immediately before
  `#a11y-announcement` for a future overlay mount.

All IDs, classes, attributes, and CSS variables are Fennevia-prefixed. The
stylesheet is a descendant of the primary host and every selector is rooted at
a project host. The diagnostic is a wrapping, theme-aware `role=status`
surface with a forced-colors fallback. It displays only ready state,
normal/private kind, Firefox version/build, host count, and the explicit fact
that native UI remains retained.

Create, attach, detach, reattach, and dispose are explicit and idempotent.
Attach failure removes exact project node references in reverse order. A
pre-existing project ID is a collision, never a node to adopt. No native node
is moved or removed, no active gate is set, and no Svelte or dependency is
introduced.

## Security and privacy effects

- Runtime network, dynamic code, remote resources, dependencies, resource
  mappings, content accessibility, and native-UI hiding remain unchanged.
- The only `http://` literals in production are the standard XHTML and XUL
  namespace identifiers. The artifact scanner exempts only those exact quoted
  literals; a suffix, path, or query remains a remote-endpoint finding.
- Runtime logs add one allowlisted fixed DOM-path field. Values outside a strict
  ASCII selector/path grammar are dropped.
- Diagnostic metadata is normalized before text rendering and cannot serialize
  a URL or local path. No browsing-derived value enters the module.
- Hidden sidebar/overlay hosts are `aria-hidden`; the overlay is also `inert`,
  hidden, and `pointer-events:none`. The native modal top layer, web content,
  and native window controls remained available in the real probe.
- `.gitattributes` fixes installed byte conventions so package hashes are
  reproducible on Windows without weakening hash verification.

## Validation performed

The following passed:

```powershell
node --test .\tests\shell-hosts.test.mjs .\tests\window-lifecycle.test.mjs
pwsh -NoProfile -File .\tests\shell-hosts.Tests.ps1
pwsh -NoProfile -File .\tests\window-lifecycle.Tests.ps1
pwsh -NoProfile -File .\tests\bootstrap-spike.Tests.ps1
pwsh -NoProfile -File .\tests\production-artifacts.Tests.ps1
pwsh -NoProfile -File .\tests\installer.Tests.ps1
pwsh -NoProfile -File .\scripts\check-production-artifacts.ps1 `
  -ArtifactRoot .\profile\chrome\fennevia `
  -InventoryPath .\package-manifest.json
```

- Seven shell-host unit tests cover ownership, XHTML descendants,
  normal/private separation, hostile metadata, idempotency, missing anchors,
  partial-attach rollback, collision, and aborted context.
- The combined Node lifecycle suites pass 16 tests.
- Package `0.3.0-dev` passes the exact six-artifact scanner and installer
  lifecycle tests.
- Real Firefox passed existing, second, private, close, runtime-stop, post-stop,
  native modal, content hit-testing, OS-control, expected failure-injection,
  and privacy-safe logging checks.
- The Browser Toolbox Inspector selected the host and confirmed the ownership
  boundary. Its child profile hash was identical before and after the probe;
  no test marker, backup, listener, or Firefox process remained.
- Repeated process launches passed without startup-cache clearing.
- Real uninstall backed up the ten ownership-proven files and applied 15 exact
  operations. The following stock process had zero Fennevia record or owned
  residue. A clean 15-operation reinstall restored package `0.3.0-dev` for the
  next milestone.

## Remaining compatibility risk

Every insertion point is an unsupported Firefox internal DOM dependency. A
future rename, namespace change, parent change, or order change intentionally
causes complete host rollback and native fallback. This evidence covers one
Windows release build and does not prove behavior on another platform or
Firefox release. The diagnostic stylesheet is intentionally small, but future
theme and fullscreen/customize-mode work remains required before native UI can
be hidden.

## Follow-up

- Issue #7 owns health state, safe start, and recovery UI. It must consume this
  host lifecycle and may not hide native UI until its separate matrix passes.
- Issue #8 owns Svelte/build feasibility and must mount only inside these
  project-created XHTML hosts.
- Every Firefox stable update repeats the stock hierarchy, Browser Toolbox
  ownership, failure-injection, and cleanup probes before support is claimed.
