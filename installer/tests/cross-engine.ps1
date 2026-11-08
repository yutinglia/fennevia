# SPDX-License-Identifier: MPL-2.0
# Test harness only. Never used by the native GUI or worker.
param([string] $Action)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '../../scripts/lib/FenneviaInstaller.psm1') -Force -WarningAction SilentlyContinue
try {
    $result = Invoke-FenneviaPackageAction -Action $Action -FirefoxPath $env:FENNEVIA_TEST_PROGRAM -ProfilePath $env:FENNEVIA_TEST_PROFILE -PackageRoot $env:FENNEVIA_TEST_SOURCE -ProfileMode Development
    $result | ConvertTo-Json -Depth 8 -Compress
}
catch {
    Write-Output (Get-FenneviaInstallerErrorCode -ErrorRecord $_)
    exit 1
}
