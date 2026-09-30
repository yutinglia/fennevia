<!-- SPDX-License-Identifier: MPL-2.0 -->

Fennevia `0.19.0-beta.1` is a Windows x64 prerelease following
[`v0.18.0-beta.1`](https://github.com/yutinglia/fennevia/releases/tag/v0.18.0-beta.1).

This release restores floating-panel backgrounds on Firefox 157 and fixes
panel dismissal and native-dialog transitions. It also includes the previously
unreleased Firefox 155 address-bar and tab-interaction improvements.

- **Download widget progress.** The launcher and status widget show aggregate
  progress in a ring, a segmented
  ring for unknown size, and a localized accessible description. Clicking still
  opens Firefox's native Downloads panel.
- **Narrow-window access.** Keep configured window controls outside scrolling
  panel content and allow horizontal scrolling in narrow side panels.
- **Bookmark action visibility.** Middle-click opening no longer makes every
  row's hidden new-tab action visible while actions are temporarily disabled.

- **Visible floating backgrounds on Firefox 157.** Nova's translucent toolbar
  color no longer multiplies panel transparency. One opaque native panel-color
  base feeds Fennevia's existing opacity, custom-color, and accessibility paths.
- **Background panels hide reliably.** Pointer exits release the shared hover
  hold when Firefox is behind another application, even if exit coordinates
  still fall inside a panel. Closing a background surface does not restore
  focus into Firefox. Foreground mutation-noise protection remains intact.
- **Native confirmations without revealing resting chrome.** Known tab,
  content, and window dialogs—including unsaved-tab close—remain Firefox-owned
  while the original toolbar stays hidden and custom surfaces are suppressed.
  Transitional focus and pending handoffs cannot latch native reveal afterward.
  Intentional native access, unknown dialogs, and failures retain fallback.
- **Firefox 155+ address execution.** Adapt to Firefox's current suggestion-pick
  contract and preserve the draft when handing asynchronous search-mode results
  to the full native address bar. Firefox continues to own providers and actions.
- **Better tab interaction.** Keep pinned tabs accessible during overflow,
  restrict pin/audio actions to primary clicks, preserve middle-click close,
  and add progressive drag-edge scrolling with visible native scrollbars and
  updated insertion previews. Ignore stale blocked permission icons.

Current release validation targets stock Firefox 157.0 BuildID
`20260924084938` on Windows x64. Firefox 153.0.4, 154.0, and 154.0.1 retain
historical validation; their full matrices are not newly rerun. The installer
allows Firefox 153+ after its explicit compatibility warning and now records
157 among tested majors. This does not promise compatibility with every newer
Firefox release. Linux, macOS, ESR, Beta, and Nightly are outside this scope.

Download the ZIP and matching checksum, then compare the first checksum field
with:

```powershell
(Get-FileHash -Algorithm SHA256 .\fennevia-0.19.0-beta.1-windows.zip).Hash.ToLowerInvariant()
```

Read `INSTALL.md` and `RELEASE-MANIFEST.json` inside the archive. Installation
requires no Node.js or npm. Keep the exact ZIP for update, hard-disable, repair,
enable, and uninstall. `FenneviaSetup.exe` is unsigned, so Windows may warn.
A dedicated Firefox profile is strongly recommended.

Validation and remaining limits are recorded in
[`docs/research/firefox-157-0.19.0-beta.1-release-validation.md`](https://github.com/yutinglia/fennevia/blob/v0.19.0-beta.1/docs/research/firefox-157-0.19.0-beta.1-release-validation.md).
The publication workflow verifies exact dependencies, ordinary tests,
deterministic double packaging, Unicode extraction, and remote asset digests
before publishing. Physical mouse/user-site, assistive-technology, device,
complete provider/permission, first-paint, and GUI/UAC matrices are not inferred
from automated fixtures.

No dependency, content-accessible resource, remote executable asset, telemetry,
or updater is added. Firefox retains security prompts, permission decisions,
and native recovery. This remains an experimental prerelease using unsupported
privileged Firefox internals, with no independent security-audit or stable
support claim.
