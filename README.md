# Fennevia

[繁體中文](README.zh-Hant.md)

Fennevia is an experimental, content-first interface for **stock Firefox**. It
keeps the web page in the foreground and places browser controls in four
floating edge panels that stay hidden until you need them.

> [!WARNING]
> Fennevia is a public **prerelease**, not a stable daily-driver product. It runs
> privileged code and depends on unsupported Firefox internals. Install it only
> on the exact supported Firefox build, use a dedicated Firefox profile, and
> keep the downloaded release archive so you can disable or remove it later.

## What Fennevia changes

At rest, the browser window shows the current page with almost no persistent
browser chrome. Move the pointer to an edge, or use the keyboard, to reveal:

- **Top:** Back, Forward, Reload/Stop, New Tab, and page status.
- **Left:** vertical tabs and a compact address/status launcher.
- **Right:** bookmarks.
- **Bottom:** download progress and status.
- **Centre:** an address/search popup opened from the launcher or with
  <kbd>Ctrl</kbd>+<kbd>L</kbd>.

Firefox still owns security prompts, permissions, certificates, extension
installation, download safety, DevTools, the native address bar, and the OS
window controls. Fennevia can reveal the full native Firefox interface when a
feature is unsupported or recovery is needed.

## Current release

The first public prerelease is
[`v0.10.0-beta.1`](https://github.com/yutinglia/fennevia/releases/tag/v0.10.0-beta.1).
Its supported environment is intentionally narrow:

| Requirement | Supported value |
| --- | --- |
| Operating system | Windows x64 |
| Firefox | Stock Firefox 153.0.4, release channel |
| Firefox Build ID | `20260810162159` |
| Package | `fennevia-0.10.0-beta.1-windows.zip` |

The installer refuses an unsupported Firefox version or Build ID before making
managed-file changes. Linux, macOS, Firefox ESR, Beta, Nightly, and newer or
older Firefox builds are not supported by this release.

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

A system-managed Firefox installation may require PowerShell to be opened as an
administrator. The Fennevia installer never elevates itself.

### 2. Download and verify the release

Download both files from the same GitHub Release:

- `fennevia-0.10.0-beta.1-windows.zip`
- `fennevia-0.10.0-beta.1-windows.zip.sha256`

Before extracting the ZIP, run this in PowerShell from the download directory:

```powershell
$expected = (Get-Content -Raw .\fennevia-0.10.0-beta.1-windows.zip.sha256).Split()[0]
$actual = (Get-FileHash -Algorithm SHA256 .\fennevia-0.10.0-beta.1-windows.zip).Hash.ToLowerInvariant()
if ($actual -cne $expected) { throw "Fennevia release checksum mismatch." }
```

Do not continue if the checksum does not match.

### 3. Preview the installation

Extract the ZIP, open PowerShell in the extracted Fennevia directory, and set
the two paths locally:

```powershell
$firefox = '<FIREFOX_PROGRAM>\firefox.exe'
$profile = '<FIREFOX_PROFILE>'
```

Do not post your real profile path in an issue or public log.

Preview every planned change first:

```powershell
pwsh -NoProfile -File .\scripts\fennevia-package.ps1 Install `
  -FirefoxPath $firefox -ProfilePath $profile `
  -ProfileMode Registered -WhatIf
```

The commands in this README use PowerShell 7 (`pwsh`). The package is also
validated with Windows PowerShell 5.1; the release's `INSTALL.md` contains the
normative lifecycle and recovery guidance.

### 4. Install

After reviewing the preview, repeat the command without `-WhatIf` and approve
the displayed plan:

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
<kbd>Ctrl</kbd>+<kbd>L</kbd> opens Fennevia's centred address/search window when
the shell is healthy. Use **Open full Firefox address bar** when you need the
complete native Firefox address bar, providers, extension actions, or panels.

If the custom interface becomes unusable while Firefox is running, press
<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>F12</kbd> to request the
Svelte-independent native Firefox fallback. If that does not work, close
Firefox and use the package's `Disable` action from the same release archive.
Do not manually delete random files from the Firefox program or profile.

## Important limitations

- Fennevia uses Firefox internals that Mozilla can change without notice.
- A normal Firefox update can move your installation outside the supported
  build. Leave Fennevia disabled or uninstall it until a compatible release is
  available.
- There is no automatic updater, code signing, attestation, or completed
  independent security audit.
- The current release is Windows-only and is not presented as a stable support
  promise.
- Bookmark management, complete Downloads management, and the full Firefox
  address-bar provider ecosystem remain native Firefox features.

## An intentionally opinionated interface

Fennevia is designed around the author's personal preferences and workflow. Its
core layout, interactions, and visual design are intentionally not configurable
in the current roadmap. The design may still change as the project evolves, and
configurability may be reconsidered later.

## Documentation

The root README is intentionally limited to public, user-facing information.
More detailed material is organised by audience:

- [Documentation map](docs/README.md)
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
