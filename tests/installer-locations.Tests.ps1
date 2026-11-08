#requires -Version 5.1
# SPDX-License-Identifier: MPL-2.0
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '../scripts/lib/FenneviaLocations.psm1') -Force
$original = $env:LOCALAPPDATA
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('fennevia-locations-test-' + [guid]::NewGuid().ToString())
function Assert-LocationTest($Condition, $Message) { if (-not $Condition) { throw $Message } }
function Assert-LocationReject([scriptblock] $Action) {
    $rejected = $false
    try { & $Action | Out-Null } catch { $rejected = $true }
    Assert-LocationTest $rejected 'Unsafe preferences operation was accepted.'
}
try {
    $env:LOCALAPPDATA = $fixture
    [void] [IO.Directory]::CreateDirectory((Join-Path $fixture 'Firefox'))
    [void] [IO.Directory]::CreateDirectory((Join-Path $fixture 'Profile with spaces'))
    $firefox = Join-Path $fixture 'Firefox/firefox.exe'
    $profile = Join-Path $fixture 'Profile with spaces'
    [IO.File]::WriteAllText($firefox, 'fixture')
    $initial = Get-FenneviaSavedLocations
    Assert-LocationTest ($initial.Revision -eq 'absent') 'Initial load must be read-only.'
    Assert-LocationTest (-not (Test-Path (Join-Path $fixture 'Fennevia'))) 'Loading must not create a directory.'
    $saved = Save-FenneviaLocation -FirefoxPath $firefox -ProfilePath $profile -Revision $initial.Revision
    Assert-LocationTest ($saved.Value.targets.Count -eq 1) 'Pair was not saved.'
    Remove-Module FenneviaLocations
    Import-Module (Join-Path $PSScriptRoot '../scripts/lib/FenneviaLocations.psm1') -Force
    $loaded = Get-FenneviaSavedLocations
    Assert-LocationTest ($loaded.Revision -eq $saved.Revision -and $loaded.Value.targets[0].firefoxPath -eq $firefox) 'Saved locations did not survive reloading.'
    Assert-LocationReject { Save-FenneviaLocation -FirefoxPath $firefox -ProfilePath $profile -Revision 'absent' }
    $unchanged = Save-FenneviaLocation -FirefoxPath $firefox -ProfilePath $profile -Revision $loaded.Revision
    Assert-LocationTest ($unchanged.Revision -eq $loaded.Revision) 'Duplicate save should be a no-op.'
    Remove-Item -LiteralPath $firefox
    Assert-LocationTest ((Get-FenneviaSavedLocations).Value.targets.Count -eq 1) 'Stale locations must remain removable.'
    $empty = Remove-FenneviaSavedLocation -Id $loaded.Value.targets[0].id -Revision $loaded.Revision
    Assert-LocationTest ($empty.Value.targets.Count -eq 0) 'Forgetting a stale pair failed.'
    $file = Join-Path $fixture 'Fennevia/Setup/targets.json'
    [IO.File]::WriteAllText($file, '{"schemaVersion":2,"targets":[]}')
    Assert-LocationReject { Get-FenneviaSavedLocations }
    Assert-LocationTest ([IO.File]::ReadAllText($file) -eq '{"schemaVersion":2,"targets":[]}') 'Corrupt data was overwritten.'
    Assert-LocationReject { Clear-FenneviaSavedLocations }
    & (Get-Module FenneviaLocations) {
        param($fixture)
        foreach ($path in @('C:\\invalid', 'C:\safe\..\elsewhere', 'C:\safe\file:stream', 'C:\safe\CON', '\\server\share')) {
            $rejected = $false
            try { Assert-FenneviaLocationPath $path -SyntaxOnly } catch { $rejected = $true }
            if (-not $rejected) { throw 'Ambiguous saved path accepted.' }
        }
        Assert-FenneviaLocationPrivate (Join-Path $fixture 'Fennevia/Setup')
        Assert-FenneviaLocationPrivate (Join-Path $fixture 'Fennevia/Setup/targets.json')
    } $fixture
    Clear-FenneviaSavedLocations -Confirmed
    Assert-LocationTest ((Get-FenneviaSavedLocations).Revision -eq 'absent') 'Explicit clear did not recover the corrupt list.'
    Write-Output 'PASS: saved locations restart, stale revisions, private ACLs, duplicate saves, missing paths, removal, corrupt schema and path rejection.'
} finally {
    $env:LOCALAPPDATA = $original
    $resolved = [IO.Path]::GetFullPath($fixture)
    if ($resolved.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()), [StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolved) -like 'fennevia-locations-test-*') {
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
