# SPDX-License-Identifier: MPL-2.0
# Development only: capture the existing backup engine's actual JSON formatting.
$ErrorActionPreference = 'Stop'
$repository = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$module = Import-Module (Join-Path $repository 'scripts/lib/FenneviaInstaller.psm1') -Force -PassThru
$output = Join-Path (Split-Path $PSScriptRoot -Parent) 'tests/fixtures'
[void][IO.Directory]::CreateDirectory($output)
foreach ($state in @('enabled', 'disabled')) {
    $content = & $module {
        param($State)
        $files = @(
            [pscustomobject]@{ Scope='program'; Path='defaults/pref/fennevia.js'; InstalledPath=$(if ($State -eq 'disabled') { 'defaults/pref/fennevia.js.disabled' } else { 'defaults/pref/fennevia.js' }); Sha256=('a' * 64) },
            [pscustomobject]@{ Scope='profile'; Path='chrome/fennevia/chrome.manifest'; InstalledPath='chrome/fennevia/chrome.manifest'; Sha256=('b' * 64) }
        )
        $directories = @([pscustomobject]@{ Scope='profile'; Path='chrome/fennevia' })
        ConvertTo-FenneviaInstallerOwnershipJson -InstallationId '11111111-2222-4333-8444-555555555555' -PackageVersion '0.19.0-beta.1' -State $State -SourceManifestSha256 ('c' * 64) -Files $files -CreatedDirectories $directories
    } $state
    $name = 'ownership-{0}-ps{1}.json' -f $state, $PSVersionTable.PSVersion.Major
    [IO.File]::WriteAllText((Join-Path $output $name), $content, (New-Object Text.UTF8Encoding($false)))
}
