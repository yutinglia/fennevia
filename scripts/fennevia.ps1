#requires -Version 5.1

# SPDX-License-Identifier: MPL-2.0

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$packageRoot = Split-Path -Parent $PSScriptRoot
$modulePath = Join-Path $PSScriptRoot "lib\FenneviaConsole.psm1"
Import-Module $modulePath -Force

try {
    Invoke-FenneviaConsole -PackageRoot $packageRoot
    exit 0
}
catch {
    $safeMessage = $_.Exception.Message
    if ($safeMessage -match '[A-Za-z]:\\' -or $safeMessage -match '\\\\') {
        $safeMessage = "An unexpected local failure occurred; details are omitted from normal output to avoid path disclosure."
    }
    Write-Error "FAIL pathDisclosure=redacted $safeMessage"
    exit 1
}
finally {
    Remove-Module FenneviaConsole, FenneviaTui, FenneviaInstaller, FirefoxDevProfile -ErrorAction SilentlyContinue
}
