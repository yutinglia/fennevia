# Windows Firefox Development Setup

This is the normative Phase 0 procedure for creating, launching, inspecting, deleting, and reconstructing the disposable Firefox profile used by this project. It targets Windows and stock Firefox stable only.

The helper in `scripts/firefox-dev.ps1` does not install AutoConfig, modify Firefox's native UI, register a profile, or alter a daily-use profile.

## 1. Safety model

The managed profile has the fixed logical name `fennevia-dev` and lives below this dedicated root:

```text
%LOCALAPPDATA%\fennevia\profiles\fennevia-dev
```

The helper intentionally uses Firefox's direct `--profile <path>` mode instead of adding an entry to `profiles.ini`. Every launch also uses `--no-remote` and `--new-instance`. This ensures the command names the profile path explicitly, cannot forward the request to a daily-use Firefox process, and cannot silently select Firefox's default profile.

The helper enforces these controls:

- profile paths must be absolute and remain below the dedicated managed root;
- registered Firefox profile paths, the user directory, AppData roots, drive roots, files, reparse points, and non-empty unowned directories are rejected;
- initialization writes `.fennevia-dev-profile.json` as an ownership marker;
- recursive deletion requires the valid marker, a closed profile, `-Force`, a path below the managed root, and a tree containing no junction or symbolic-link reparse point;
- `-WhatIf` previews deletion without changing files;
- normal output uses `<FIREFOX_PROGRAM>` and `<FENNEVIA_DEV_PROFILE>` instead of local paths;
- `-RevealPaths` is an explicit local-only diagnostic mode whose output must not be pasted into issues or pull requests.

The Fennevia helper never adopts, mutates, or deletes a profile or marker from
the provisional project identity. Such a directory is unowned from the current
helper's perspective and must be handled manually only after its purpose is
known.

The generated `user.js` changes only the preferences required for browser-chrome inspection and suppresses the default-browser prompt:

```text
devtools.chrome.enabled = true
devtools.debugger.remote-enabled = true
devtools.debugger.prompt-connection = true
devtools.browsertoolbox.scope = parent-process
browser.shell.checkDefaultBrowser = false
```

The remote-debugging confirmation remains enabled. Do not change it to `false` merely to automate the Browser Toolbox prompt.

## 2. Prerequisites

- Windows 11 or another explicitly tested Windows version;
- stock Firefox stable;
- PowerShell 7 (`pwsh`) or Windows PowerShell 5.1;
- nvm-windows with the Node.js version from `.nvmrc` available;
- a clean repository checkout;
- no Firefox process using `<FENNEVIA_DEV_PROFILE>`.

The issue #8 frontend baseline uses Node.js 24.18.0 and npm 11.16.0. Select the
repository version through nvm-windows, then install exactly the committed graph
with package lifecycle scripts disabled:

```powershell
nvm use 24.18.0
node --version
npm --version
npm ci --ignore-scripts --no-fund
npm run dependencies:audit
npm run verify
```

Do not install a separate standalone Node.js. `.npmrc` enforces the engine,
exact lockfile, and scripts-disabled policy. The accepted graph and build-host
binary inventory are in
`docs/dependency-reviews/frontend-toolchain-2026-08-15.md`.

Use an explicit Firefox executable when more than one installation or channel is present. The tested stock 64-bit location was:

```powershell
$firefox = 'C:\Program Files\Mozilla Firefox\firefox.exe'
```

Printing that variable is local-only. Shared records must use `<FIREFOX_PROGRAM>\firefox.exe`.

## 3. Initialize and verify the profile

From the repository root:

```powershell
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Initialize -FirefoxPath $firefox
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Verify -FirefoxPath $firefox -RequireCleanEnvironment
```

`Initialize` is idempotent for a valid marker-owned profile. It refuses to adopt an existing non-empty directory.

`-RequireCleanEnvironment` is the Phase 0 stock-environment check. It rejects:

- a `general.config.filename` AutoConfig declaration in Firefox's `defaults\pref\*.js` files;
- an enterprise-policy registry source or `distribution\policies.json`;
- a profile-installed add-on, a non-empty profile `extensions` directory, or a profile `chrome` customization.

If it reports existing state, do not delete anything automatically. Identify its owner or use a separate clean Firefox installation. `-RequireNoAutoConfig` remains available as the narrower assertion for later phases, when project-owned profile chrome files may be expected. Both switches are verification gates rather than permanent launch requirements.

To inspect the actual paths locally:

```powershell
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Verify -FirefoxPath $firefox -RevealPaths
```

Do not share that output.

## 4. Launch without default-profile fallback

Normal launch:

```powershell
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Launch -FirefoxPath $firefox -Page about:support
```

The effective Firefox command is:

```powershell
& '<FIREFOX_PROGRAM>\firefox.exe' --no-remote --new-instance --profile '<FENNEVIA_DEV_PROFILE>' --new-window about:support
```

The helper validates the marker before launch and refuses to start a second process while the managed profile is already running. Open additional windows from the running browser with `Ctrl+N` and `Ctrl+Shift+P`, or use the isolated smoke modes below after closing the prior instance:

```powershell
# Primary normal window plus a second normal window.
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Launch -FirefoxPath $firefox -Page about:support -SecondWindow

# One private-window launch using the same disposable profile directory.
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Launch -FirefoxPath $firefox -Page about:support -PrivateWindow
```

`-SecondWindow` and `-PrivateWindow` are intentionally separate modes because Firefox treats private-window startup as process-wide command-line state. The helper rejects using both switches together.

Open `about:profiles` in the managed browser and compare its active root directory with the local-only `-RevealPaths` result. Never capture or share that page without redacting profile paths.

## 5. Browser Console and Browser Toolbox

Mozilla's current DevTools documentation requires both browser-chrome debugging and remote debugging for the Browser Toolbox. The generated preferences enable both, while retaining the incoming-connection prompt.

### Browser Console

Launch it with the profile:

```powershell
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Launch -FirefoxPath $firefox -Page about:support -BrowserConsole
```

Alternatively, press `Ctrl+Shift+J` in the managed browser. Confirm that a Parent process Browser Console opens and that its command line is available. Use it for startup and privileged-runtime errors, not page browsing data.

### Browser Toolbox

Launch it with the profile:

```powershell
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Launch -FirefoxPath $firefox -Page about:support -BrowserToolbox
```

Alternatively, press `Ctrl+Alt+Shift+I`. Accept the local incoming-connection prompt. In the Browser Toolbox:

1. Keep **Parent process** mode selected.
2. Open the Inspector.
3. Confirm the breadcrumbs expose `html#main-window` from the browser chrome document.
4. Search for `#main-window` if the root is not already selected.
5. Confirm the inspected document is `chrome://browser/content/browser.xhtml` before recording the check as passed.

Do not disable `devtools.debugger.prompt-connection` to bypass the confirmation.

Primary references:

- [Firefox command-line parameters](https://firefox-source-docs.mozilla.org/browser/CommandLineParameters.html)
- [Browser Console](https://firefox-source-docs.mozilla.org/devtools-user/browser_console/index.html)
- [Browser Toolbox](https://firefox-source-docs.mozilla.org/devtools-user/browser_toolbox/index.html)
- [DevTools settings](https://firefox-source-docs.mozilla.org/devtools-user/settings/index.html)

## 6. Privacy-safe environment record

Generate a paste-ready record:

```powershell
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Environment -FirefoxPath $firefox
```

The output records Firefox version, build ID, channel, source stamp, Windows version and build, project commit, helper state, AutoConfig, enterprise-policy, profile-contamination audit states, and the redacted launch command. It deliberately leaves GUI evidence as `not recorded by this command`; fill those fields only after observing the relevant windows.

Append this evidence without screenshots that expose profile paths or browsing data:

```markdown
## Development-profile GUI evidence

- Browser Console: pass / fail / blocked — observed result
- Browser Toolbox: pass / fail / blocked — `browser.xhtml` evidence
- Primary normal window: pass / fail / blocked — observed result
- Second normal window: pass / fail / blocked — observed result
- Private window: pass / fail / blocked — observed result
- Complete profile removal and reconstruction: pass / fail / blocked — observed result
- `profiles.ini` unchanged: pass / fail / blocked — comparison method
```

## 7. Stale state and startup cache

Phase 0 installs no project AutoConfig or browser-chrome artifact. On the validated baseline below, `-RequireCleanEnvironment` found no declaration, policy source, profile add-on, or chrome customization, and no project startup-cache clearing was performed. Clearing a cache without a symptom would not be evidence.

Use this escalation order later:

1. Record the first causal Browser Console error, Firefox build, project commit, and exact installed artifacts.
2. Verify the source artifacts and active profile before blaming cache state.
3. If evidence still indicates stale browser UI or startup code, open `about:support`, use **Clear startup cache**, restart, and record the before-and-after result.
4. Do not manually delete arbitrary Firefox cache directories or another profile's files.
5. For a completely clean Phase 0 profile, perform the marker-guarded full removal and reconstruction below.

The `about:support` operation is Firefox-owned and, according to current Mozilla UI text, does not change settings or remove extensions. Phase 1 testing on Firefox 153.0.4 restored a syntax-broken privileged entry and then loaded the corrected entry on the next cold start without clearing startup cache. It also removed all project startup files and observed a stock startup with no residual project record. Therefore routine AutoConfig or Chrome Registry changes do not currently require cache clearing; keep the evidence-first escalation above for a future observed stale-state symptom.

Residual program-directory AutoConfig files are not owned by the development-profile helper. Do not delete an existing `config.js`, preference file, or other customization merely because the audit detects it. Fennevia program files are managed separately by the dual-root ownership and transaction workflow in `docs/installation.md`; unknown or mismatched files remain a hard conflict.

## 8. Delete and reconstruct the profile

Close the managed browser, Browser Console, and Browser Toolbox first.

Preview deletion:

```powershell
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Remove -WhatIf
```

Delete only the marker-owned profile and recreate it:

```powershell
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Remove -Force
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Initialize -FirefoxPath $firefox
pwsh -NoProfile -File .\scripts\firefox-dev.ps1 Verify -FirefoxPath $firefox -RequireCleanEnvironment
```

The direct-path design means this sequence does not add, remove, rename, or select entries in Firefox's `profiles.ini`. If deletion reports an invalid marker, unsafe path, registered profile, or running profile, stop and investigate instead of bypassing the guard.

## 9. Validated Phase 0 baseline

The following evidence was captured on 2026-08-14 from base project commit
`947be49dcb789f989ecb1fd4f4ece8a33a762c6e` plus the #2 working-tree
implementation under the then-provisional identity. Logical path labels in the
table use the current Fennevia terminology; the observed safety behavior is
unchanged.

| Field | Observed result |
|---|---|
| Firefox | 153.0.4 release |
| Firefox build ID | `20260810162159` |
| Firefox source stamp | `54be19de0e08edff0b797e55fd935dd3978b0a6d` |
| Operating system | Windows 11 25H2, build `26200.8894` |
| PowerShell | PowerShell 7.6.4 and Windows PowerShell 5.1 |
| Stock-program AutoConfig audit | No `general.config.filename` declaration detected |
| Enterprise policy audit | No registry policy source or `distribution\policies.json` detected |
| Profile contamination audit | No profile-installed add-on or profile `chrome` customization detected |
| Explicit profile launch | Pass; running Firefox command line contained `<FENNEVIA_DEV_PROFILE>` |
| Browser Console | Pass; Parent process Browser Console opened |
| Browser Toolbox | Pass; parent-process Inspector exposed `html#main-window` from `browser.xhtml` |
| Second normal window | Pass; two normal Firefox top-level windows observed |
| Private window | Pass; a private Firefox top-level window observed |
| Removal preview | Pass; `-WhatIf` preserved the profile |
| Full removal and reconstruction | Pass; profile absent after removal, valid after initialization, and launched again |
| Daily-profile isolation | Pass; `profiles.ini` SHA-256 was unchanged across removal and reconstruction |
| PowerShell safety tests | Pass in PowerShell 7.6.4 and Windows PowerShell 5.1 |

Window-title inspection and the `profiles.ini` hash comparison were local-only evidence. No profile path, browsing URL, title, query, or private-window browsing state is included here.

## 10. Fennevia identity revalidation

On 2026-08-15, issue #22 repeated the PowerShell safety suites in PowerShell 7
and Windows PowerShell 5.1 and exercised the renamed helper and artifacts in a
fresh marker-owned profile and copied stock Firefox 153.0.4 program. The helper
created only the Fennevia root and marker, did not register a profile, and the
final `Verify -RequireCleanEnvironment` check passed after complete project-file
removal. No provisional profile was adopted or deleted. See
`docs/research/fennevia-identity-migration.md` for the complete regression matrix.
