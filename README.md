# Fennevia

[繁體中文](README.zh-Hant.md)

![Stylized map of Fennevia's four-edge interface](docs/media/fennevia-overview.svg)

_A stylized interface map, not a Firefox compatibility or validation screenshot._

Fennevia is an experimental, content-first interface for **stock Firefox**. It
keeps the web page in the foreground and places browser controls in four
floating edge panels that stay hidden until you need them.

> [!WARNING]
> Fennevia is a public **prerelease**, not a stable daily-driver product. It runs
> privileged code and depends on unsupported Firefox internals. It has been
> tested only with Firefox **153** and **154**. Later Firefox versions may
> break the shell. If you confirm install on a newer version, there is **no
> promise** that everything will work. Use a dedicated Firefox profile, and
> keep the downloaded release archive so you can disable or remove it later.
> Fennevia follows the current stock Firefox **Release** channel. It does not
> plan to maintain compatibility with every historical Firefox version, and it
> does not target ESR, Beta, or Nightly.

## What Fennevia changes

At rest, Firefox mostly shows the current page. Move the pointer to an edge, or
use the keyboard, to reveal:

- **Top:** the always-enabled primary panel. Its explicit default Row contains
  Back, Forward, Reload/Stop, Home, Trust, an expanded address launcher,
  Firefox handoffs, Customize, and project-owned window controls.
- **Left (default):** a Column containing New Tab and expanded vertical
  tabs—with a bounded pinned area above the independently scrolling regular
  tabs. It is a general widget panel and can be disabled.
- **Right (default):** a Column containing bookmarks with cached site favicons.
  It is independently configurable and can be disabled.
- **Bottom:** a general Row centering anonymous download progress/status in the
  available width by default. Downloads status is a movable widget; Bottom can
  be disabled even after that widget moves elsewhere.
- **Centre:** an address/search popup opened from the launcher or with
  <kbd>Ctrl</kbd>+<kbd>L</kbd>. Its accessible
  result list comes from Firefox's own enabled Urlbar providers and search
  suggestions; Fennevia does not add a search engine or suggestion service.

## Make the browser yours

Full customization is one of Fennevia's main product features—not just a list
of buttons you can reorder. Nearly every visible part is a widget: navigation,
the address launcher, Tabs, Bookmarks, download status, Firefox tools,
extension buttons, the private indicator, window controls, and more. Drag them
between Top, Left, Right, and Bottom to build the browser layout that fits you.

- **Compose real layouts.** Nest Row and Column groups, center a control, add
  padding or separators, and use Expanded or Flexible space only where you
  want the remaining room to go. Children otherwise stay naturally sized and
  ordered from the start.
- **Turn major features.** Tabs, Bookmarks, Downloads, and the address launcher
  adapt to horizontal or vertical placement. For example, keep vertical Tabs
  on the left, or build a horizontal tab strip in Top or Bottom.
- **Reuse the controls that make sense.** With multiple placement enabled, safe
  controls such as window buttons can appear in both Top and Left. Structural
  Row, Column, Center, Expanded, Padding, Separator, Space, and Flexible space
  widgets are always repeatable. Stateful feature areas remain singletons.
- **Choose useful variants.** The address launcher can include the Trust/site
  status action, and Tabs can include New Tab directly after the final tab.
- **Shape how panels meet.** Choose one or several panels at once, then use
  dynamic dodge or stable reserved lanes. Left, Right, and Bottom can be
  disabled independently; Top always remains available.

That makes layouts such as “Bookmarks use the remaining right-panel height,
with a one-row download status underneath” possible: place both in a Column,
wrap Bookmarks with Expanded, and leave the download row naturally sized. You
can also repeat window controls on Top and Left while keeping the address bar
wide only on Top.

Customize mode keeps even an empty enabled panel visible as a full drop target,
shows the exact insertion preview while you drag, and outlines every editable
widget. Selecting a widget opens one floating settings panel at a time, so
move, remove, wrapper, and style controls do not cover the layout with toolbars.
The picker puts large features first and keeps their common actions beside
them—Address with Trust, Tabs with New Tab, Bookmarks with Show Bookmarks, and
Download status with Show Downloads. Its optional Guide explains Rows,
Columns, wrappers, structural spacing, practical recipes, and recovery.
**Clean all panels** asks for confirmation, restores adopted Firefox widgets,
and leaves the required Customize button in Top; **Reset layout** restores the
new Fennevia default. At least one Customize widget must remain on an enabled
panel, and valid saved layouts are never silently replaced.

## A guarded bridge to Firefox

Fennevia's interface does not let every widget reach directly into privileged
Firefox internals. A small, safety-oriented Firefox API bridge is the single
route between the Svelte UI and Firefox. It checks that required capabilities
exist, validates values crossing the boundary, and gives widgets bounded
snapshots plus narrow actions instead of native Firefox objects.

Firefox therefore remains the real owner of tabs, bookmarks, downloads,
security prompts, permissions, certificates, extension installation, native
menus, and window commands. Fennevia does not replace those security-sensitive
flows. If startup or a required feature fails, the project removes its owned
surface and returns to the retained native Firefox interface. The installed
runtime loads no remote scripts, analytics, or telemetry.

This design reduces the amount of privileged code each feature can touch and
makes failures easier to contain and clean up. It is still experimental code
using unsupported Firefox internals—not a sandbox or a completed independent
security audit.

Right-click works across all four edge panels. It offers a useful action for
that edge plus available Fennevia/Firefox customization and original-toolbar
access; tab rows keep Firefox's complete translated tab menu, bookmark rows
offer bounded open/folder/Library actions, middle-click opens a bookmark in a
new tab, and the actual dragged tab follows
the pointer inside its strip while neighboring tabs move aside to preview the
final order. The top and bottom of the list use larger magnetic landing zones,
and the owned New Tab region also accepts a drop at the list end. Entering
another same-kind
Fennevia window also reveals and holds that window's tab strip; the tab can be
dropped at an insertion point there, dropped on that window's browser area to
append it, or released outside Firefox to let Firefox detach it into a window.
The target strip reserves the prospective row in real layout, avoiding a false
scrollbar when it contains only a few tabs, and tab dragging keeps Firefox's
ordinary cursor. The transfer contains no text/URL flavor, and window-level
drag cleanup plus source-tab reconciliation releases the tab panel after every
terminal path.

The thin top and bottom activity lights are independently configurable as page
loading, aggregate downloads, or off. Their defaults remain loading on top and
downloads on the bottom. Firefox's native corner status label keeps its native
content and lifecycle but uses a compact, theme-aware capsule while Fennevia is
active.

Firefox still owns security prompts, permissions, certificates, extension
installation, download safety, DevTools, the full native address bar, and the
window commands behind the custom caption buttons. Native caption nodes stay in
place for fail-open recovery. Fennevia can reveal the complete native Firefox
interface when a feature is unsupported or recovery is needed.
The current Firefox 154 AMO install flow may use that complete native-chrome
fallback; this is an accepted safety behavior rather than a custom prompt.

## Current release

The current public prerelease is
[`v0.17.0-beta.1`](https://github.com/yutinglia/fennevia/releases/tag/v0.17.0-beta.1).
It follows
[`v0.16.0-beta.1`](https://github.com/yutinglia/fennevia/releases/tag/v0.16.0-beta.1).
Its tested environment is intentionally narrow:

| Requirement      | Tested value                                         |
| ---------------- | ---------------------------------------------------- |
| Operating system | Windows x64                                          |
| Firefox          | Stock Firefox 153.0.4, 154.0, and 154.0.1, release channel |
| Firefox Build ID | `20260810162159` / `20260812182057` / `20260824154132` |
| Package          | `fennevia-0.17.0-beta.1-windows.zip`                 |

Install, update, repair, and re-enable reject Firefox older than 153. Firefox
153, 154, and newer majors may be installed after the installer warning: only
153 and 154 are tested, later versions may break the shell, and confirming
install does not promise that everything will work. Disable and uninstall
remain available for recovery. Linux, macOS, Firefox ESR, Beta, and Nightly
are not supported by this release.

Fennevia is developed against the latest stock Firefox stable release available
at implementation time. The 153/154 rows above are evidence for this package,
not a promise to keep every old release working indefinitely. A future Firefox
stable update may require a new Fennevia build; unsupported channels and old
compatibility branches are intentionally outside the product scope.

Installing the prebuilt release does **not** require Node.js, npm, or building
Firefox from source.

## Current progress

Fennevia has moved beyond the first four-edge MVP. The current prerelease also
includes a Fennevia-owned widget editor with live drag-and-drop across all four
edges, a tabbed customize drawer, optional compact windows, Firefox-owned tab
multi-select, a fixed bounded pinned-tabs area, related New Tab insertion after
the current tab, bounded appearance,
panel-role/activity-light, and edge-interaction
controls, cached bookmark favicons with middle-click open, Firefox design-token
defaults, English and Traditional Chinese shell catalogs, first-paint
native-toolbox hiding, generic Firefox-owned popup proxy anchoring, four-panel
context actions, spatial tab drag preview with a visible cross-window target,
same-kind transfer and Firefox-owned detach, native-safe extension-install
prompts, a placeable
Firefox built-in translation widget, and the `FenneviaSetup.exe` Windows setup
wizard.

This release adds ADR-074 through ADR-077's recursive everything-is-a-widget
editor: nested Row/Column layouts, Flutter-style
natural-size children, Center/Expanded/Padding wrappers, axis-aware primary
features, opt-in compatible duplicates, independent Left/Right/Bottom panel
switches, a movable Downloads-status widget, and an always-reachable Customize
widget. A confirmed **Clean all panels** action restores adopted Firefox
widgets and leaves only Customize in Top; Reset layout still restores the
default composition. Empty enabled panels are usable targets during customize,
drag target outlines are cleared on every exit/end path, and one selected
widget opens a single floating inspector for move/remove/layout and eligible
Style controls. The inspector stays outside Row/Column sizing, avoids the
central customize panel when another side fits, and replaces the previous
selection instead of stacking editors. Closing it stays closed while focus
returns to the widget. Every editable widget keeps a blue customize boundary;
hover and selection strengthen it without changing the widget's real size. The
editor also shows one exact insertion preview while
dragging, subdues the source, autoscrolls near panel edges, and provides
localized palette search plus All/Main features/Fennevia/Firefox/Layout
filters, paired primary/action tiles, and an optional layout Guide. Eligible
placed widgets also have closed per-instance variants: Address may include the
existing site-status/Trust action in one capsule, and Tabs may include the New
Tab action after the final tab. These are semantic options, not arbitrary CSS;
standalone Trust and New Tab widgets remain available. In ordinary mode, Space,
Flexible space, separators, empty containers, and other unoccupied project
chrome can drag the Firefox window.

Current source also reflows the four panels before Firefox's ordinary minimum
width becomes difficult to use. Bottom gets a separate full-width lane; one
side grows while preserving a clear content corridor for pointer exit and
auto-hide; and two visible sides split without overlap. Only the ultra-narrow
tier normally reached through the optional compact-window setting lets a lone
side use the full available width. Focused automated coverage is complete; the
real-Firefox narrow-window matrix remains pending.

This release also simplifies the centred address/search popup around the
search task while retaining Trust, permission, Firefox-provider results, and
the complete native Urlbar handoff. The Firefox bridge retries only the first
completed empty zero-prefix query once to cover the observed first-open warm-up
case. Tab dragging now requires a small intentional displacement before an
unconsumed drag may detach into a new window, and nested layout handlers no
longer cancel their child tab's drag session. Known built-in toolbar labels use
their synchronous Fluent mapping before the legacy fallback, reducing avoidable
Browser Console localization noise.

The current prerelease also projects bounded results from Firefox's own
per-window Urlbar provider manager into the centred combobox. Firefox still
owns engines, provider selection, ranking, search-suggestion/private policy,
and result execution. Ordinary rows delegate to Firefox's `pickResult`; rich or
unknown rows open the complete native address bar. This work has focused tests
and Firefox 154 provider-contract, production-panel, failure-injection, and
release-candidate probes, while its representative provider matrix remains
pending.

The last recorded automated Firefox 154 lifecycle, recovery,
performance-control, deterministic archive, and extracted-package installer
matrix is the `0.12.0-beta.1` candidate; this `0.17.0-beta.1` package adds a
current Firefox 154.0.1 candidate run but does not
re-run that matrix. The remaining real-Firefox visual, assistive-technology,
account/device, popup-placement, customize, first-paint, complete GUI installer,
and representative Urlbar-provider rows are still pending. The main remaining
work is therefore
compatibility and release validation rather than a missing core shell feature.
See [Current project status](docs/current-status.md) for the reviewed capability
inventory, evidence boundary, known risks, and recommended priorities.

## Install

### 1. Prepare Firefox

1. Open `about:profiles` in Firefox.
2. Create or choose a **dedicated profile** for Fennevia.
3. Note that profile's **Root Directory**. The profile must be registered with
   Firefox; a profile created through `about:profiles` satisfies this.
4. Locate the `firefox.exe` you intend to use. A common path is
   `C:\Program Files\Mozilla Firefox\firefox.exe`.
5. Close every Firefox window, Browser Console, and Browser Toolbox using that
   program or profile.

A system-managed Firefox installation may require administrator permission to
write AutoConfig files. Fennevia Setup asks for that permission only after you
choose **Continue as administrator**. It does not elevate when you first open
the wizard.

### 2. Download and verify the release

Download both files from the same GitHub Release:

- `fennevia-0.17.0-beta.1-windows.zip`
- `fennevia-0.17.0-beta.1-windows.zip.sha256`

Before extracting the ZIP, run this in PowerShell from the download directory:

```powershell
$expected = (Get-Content -Raw .\fennevia-0.17.0-beta.1-windows.zip.sha256).Split()[0]
$actual = (Get-FileHash -Algorithm SHA256 .\fennevia-0.17.0-beta.1-windows.zip).Hash.ToLowerInvariant()
if ($actual -cne $expected) { throw "Fennevia release checksum mismatch." }
```

Do not continue if the checksum does not match.

### 3. Preview the installation

Extract the ZIP and double-click `FenneviaSetup.exe` in the extracted Fennevia
directory. Select `firefox.exe` and one registered profile **by name**. Fennevia
never preselects Firefox's default profile. Review the Firefox 153/154 testing
warning, then the redacted plan, then confirm. Confirming install on a newer
Firefox is not a promise that the shell will keep working. If the selected
Firefox program folder is not writable, choose **Continue as administrator**
and approve the Windows prompt.

Keep the extracted folder. The PowerShell console remains available as an
advanced host:

```powershell
pwsh -NoProfile -File .\scripts\fennevia.ps1
```

Do not post your real profile path in an issue or public log. The scripted
equivalent is:

```powershell
$firefox = '<FIREFOX_PROGRAM>\firefox.exe'
$profile = '<FIREFOX_PROFILE>'

pwsh -NoProfile -File .\scripts\fennevia-package.ps1 Install `
  -FirefoxPath $firefox -ProfilePath $profile `
  -ProfileMode Registered -WhatIf
```

The examples in this README use PowerShell 7 (`pwsh`). The package is also
validated with Windows PowerShell 5.1. The release's `INSTALL.md` contains the
full update, recovery, and removal instructions.

### 4. Install

After reviewing the preview in Fennevia Setup, confirm the displayed plan. The
scripted equivalent repeats the command without `-WhatIf`:

```powershell
pwsh -NoProfile -File .\scripts\fennevia-package.ps1 Install `
  -FirefoxPath $firefox -ProfilePath $profile `
  -ProfileMode Registered
```

Start Firefox with the selected profile. Keep the exact extracted release
folder or ZIP: update, repair, enable, and some recovery actions verify the
original package bytes.

For update, disable, repair, enable, and uninstall commands, read:

- [Release installation and recovery guide](release/INSTALL.md)
- [Complete package lifecycle reference](docs/installation.md)

## Everyday use and recovery

Move the pointer to the corresponding window edge to reveal a panel.
<kbd>Ctrl</kbd>+<kbd>L</kbd> opens Fennevia's centred address/search popup when
the shell is healthy. Use **Open Firefox address bar** when you need the
complete native address bar, a rich/unsupported provider row, search one-offs,
extension actions, or Firefox panels.

If the custom interface becomes unusable while Firefox is running, press
<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>F12</kbd> to request the
built-in native Firefox fallback. If that does not work, close Firefox and use
the package's `Disable` action from the same release archive. Do not manually
delete unknown files from the Firefox program or profile.

## Interface language

Fennevia follows the language Firefox uses for its own menus and messages, not
the languages sent to websites. The shell currently ships English and
Traditional Chinese. Fennevia does not add its own language picker.

- Any Chinese Firefox UI language (`zh`, `zh-Hant`, `zh-Hans`, `zh-TW`,
  `zh-CN`, and other `zh-*` tags) currently uses Traditional Chinese. There
  is no Simplified Chinese catalog yet.
- Every other Firefox UI language uses English.

Native Firefox menus, notifications, and toolbar widget names still follow
Firefox itself.

## Important limitations

- Fennevia uses Firefox internals that Mozilla can change without notice.
- A normal Firefox update can move your installation onto an untested build.
  Later versions may break the shell. You may keep using Fennevia after the
  installer warning, or leave it disabled / uninstall it. Confirming install
  is not a support promise.
- There is no automatic updater, code signing, build attestation, or completed
  independent security audit.
- The current release is Windows-only and is not presented as a stable support
  promise.
- Bookmark editing, complete Downloads management, advanced native address-bar
  features, and extension integrations remain available through Firefox's full
  native interface.

## Opinionated structure, bounded customization

Fennevia still follows the author's content-first product direction: four fixed
edge hosts, an always-enabled Top recovery/customize path, hidden-at-rest
behavior, the shared reveal model, native-ownership boundaries, and the overall
interaction hierarchy are deliberate product decisions rather than an
arbitrary extension platform.

The interface is no longer accurately described as non-configurable. Fennevia
customize mode can compose supported project features and Firefox toolbar
widgets across all four edges with bounded Row/Column trees, switch feature
orientation, enable Left/Right/Bottom independently, choose one of four closed
single/multiple plus dynamic/reserved panel policies, and opt into safe multiple
placements. The palette puts paired main features first and includes an
optional Guide for base flows, wrappers, recipes, editing, and recovery.
Selected Address and Tabs instances can choose from their closed
semantic style variants, and the widget palette can be searched and filtered.
It can also adjust a bounded set of profile-local panel/window
backgrounds, text, border, saturation, shadow, motion, reveal timing, shortcut-
tip timing, edge-trigger thickness, and top/bottom activity-light sources. It
is intentionally not a general CSS editor, arbitrary command loader, extension
platform, or unlimited geometry builder.

Mirrored Account, Library, All Tabs, and native menu widgets delegate to their
Firefox owners. Compound Zoom, Edit, and Profiler placements stay grouped but
expose their independently actionable controls; Zoom displays the current
percentage on its reset button.

## Documentation

The root README is intentionally limited to public, user-facing information.
More detailed material is organised by audience:

- [Documentation map](docs/README.md)
- [Current project status](docs/current-status.md)
- [Technical overview and current engineering status](docs/technical-overview.md)
- [Architecture](docs/architecture.md)
- [Testing and recovery](docs/testing-and-recovery.md)
- [Firefox update workflow](docs/firefox-update-workflow.md)
- [Security and privacy](docs/security-and-privacy.md)
- [Contributing](CONTRIBUTING.md)

Historical compatibility and validation records are stored under
[`docs/research/`](docs/research/). They describe the milestone that was tested
at the time and are not rewritten to pretend later features already existed.

## License

Fennevia's original source code, documentation, and project-authored generated
output are licensed under [MPL-2.0](LICENSE).

Third-party material keeps its own licence terms. See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the
[licensing and provenance policy](docs/licensing-and-provenance.md).
