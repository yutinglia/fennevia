# Fennevia

[繁體中文](README.zh-Hant.md)

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

## What Fennevia changes

At rest, Firefox mostly shows the current page. Move the pointer to an edge, or
use the keyboard, to reveal:

- **Top:** Back, Forward, Reload/Stop, Firefox tools, a widget zone that
  follows your Firefox toolbar until you customize it in Fennevia, and
  project-owned window controls. Fennevia customize mode can drag widgets onto
  all four edges; Firefox's native customize mode remains available from the
  Firefox application menu.
- **Left:** vertical tabs, a compact address/status launcher, and any widgets
  placed there.
- **Right:** bookmarks, plus any widgets placed there.
- **Bottom:** download progress and status, plus any widgets placed there.
- **Centre:** an address/search popup opened from the launcher or with
  <kbd>Ctrl</kbd>+<kbd>L</kbd>.

Firefox still owns security prompts, permissions, certificates, extension
installation, download safety, DevTools, the full native address bar, and the
window commands behind the custom caption buttons. Native caption nodes stay in
place for fail-open recovery. Fennevia can reveal the complete native Firefox
interface when a feature is unsupported or recovery is needed.

## Current release

The current public prerelease is
[`v0.11.0-beta.1`](https://github.com/yutinglia/fennevia/releases/tag/v0.11.0-beta.1).
It follows the first public package
[`v0.10.0-beta.1`](https://github.com/yutinglia/fennevia/releases/tag/v0.10.0-beta.1).
Its tested environment is intentionally narrow:

| Requirement      | Tested value                           |
| ---------------- | -------------------------------------- |
| Operating system | Windows x64                            |
| Firefox          | Stock Firefox 153.0.4 and 154.0, release channel |
| Firefox Build ID | `20260810162159` (153.0.4), `20260812182057` (154.0) |
| Package          | `fennevia-0.11.0-beta.1-windows.zip`   |

Install, update, repair, and re-enable reject Firefox older than 153. Firefox
153, 154, and newer majors may be installed after the installer warning: only
153 and 154 are tested, later versions may break the shell, and confirming
install does not promise that everything will work. Disable and uninstall
remain available for recovery. Linux, macOS, Firefox ESR, Beta, and Nightly
are not supported by this release.

Installing the prebuilt release does **not** require Node.js, npm, or building
Firefox from source.

## Current progress

Fennevia has moved beyond the first four-edge MVP. The current prerelease also
includes a Fennevia-owned widget editor with live drag-and-drop across all four
edges, bounded appearance and motion controls, Firefox design-token defaults,
English and Traditional Chinese shell catalogs, first-paint native-toolbox
hiding, and the `FenneviaSetup.exe` Windows setup wizard.

The implementation has focused automated coverage, but the remaining
real-Firefox visual, popup-placement, customize, first-paint, and complete GUI
installer matrices are still pending. The main remaining work is therefore
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

- `fennevia-0.11.0-beta.1-windows.zip`
- `fennevia-0.11.0-beta.1-windows.zip.sha256`

Before extracting the ZIP, run this in PowerShell from the download directory:

```powershell
$expected = (Get-Content -Raw .\fennevia-0.11.0-beta.1-windows.zip.sha256).Split()[0]
$actual = (Get-FileHash -Algorithm SHA256 .\fennevia-0.11.0-beta.1-windows.zip).Hash.ToLowerInvariant()
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
the shell is healthy. Use **Open full Firefox address bar** when you need the
complete native address bar, search providers, extension actions, or Firefox
panels.

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

Fennevia still follows the author's content-first product direction: the four
edge roles, hidden-at-rest behavior, reveal model, native-ownership boundaries,
and overall interaction hierarchy are deliberate product decisions rather than
an arbitrary layout system.

The interface is no longer accurately described as non-configurable. Fennevia
customize mode can place supported Firefox toolbar widgets on any edge and can
adjust a bounded set of profile-local panel/window backgrounds, text, border,
saturation, shadow, and motion values. It is intentionally not a general CSS
editor, extension platform, or unlimited geometry builder.

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
