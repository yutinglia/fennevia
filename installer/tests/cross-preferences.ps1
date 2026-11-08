#requires -Version 5.1
# SPDX-License-Identifier: MPL-2.0
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '../../scripts/lib/FenneviaLocations.psm1') -Force
$loaded = Get-FenneviaSavedLocations
if ($loaded.Value.targets.Count -ne 1) { throw 'Native preferences were not read.' }
$saved = Save-FenneviaLocation -FirefoxPath $loaded.Value.targets[0].firefoxPath -ProfilePath (Join-Path $env:LOCALAPPDATA 'Second Profile') -Revision $loaded.Revision
if ($saved.Value.targets.Count -ne 2) { throw 'PowerShell preferences did not add the second pair.' }
Write-Output 'preferences-compatible'
