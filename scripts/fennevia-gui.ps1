#requires -Version 5.1

# SPDX-License-Identifier: MPL-2.0

[CmdletBinding()]
param(
    [string] $PackageRoot = "",

    [string] $ResumeStatePath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms | Out-Null

if ([string]::IsNullOrWhiteSpace($PackageRoot)) {
    $PackageRoot = Split-Path -Parent $PSScriptRoot
}

$modulePath = Join-Path $PSScriptRoot "lib\FenneviaGui.psm1"
Import-Module $modulePath -Force

try {
    $null = Invoke-FenneviaGui `
        -PackageRoot $PackageRoot `
        -ResumeStatePath $ResumeStatePath `
        -Show
    exit 0
}
catch {
    $safeMessage = ConvertTo-FenneviaGuiSafeErrorMessage -InputObject $_
    [void][System.Windows.Forms.MessageBox]::Show(
        $safeMessage,
        "Fennevia Setup",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    )
    exit 1
}
finally {
    Remove-Module FenneviaGui, FenneviaConsole, FenneviaTui, FenneviaInstaller -ErrorAction SilentlyContinue
}
