#requires -Version 5.1

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$testFiles = @(
    "bootstrap-spike.Tests.ps1",
    "firefox-dev-profile.Tests.ps1",
    "fennevia-console.Tests.ps1",
    "fennevia-gui.Tests.ps1",
    "installer.Tests.ps1",
    "installer-discovery.Tests.ps1",
    "production-artifacts.Tests.ps1",
    "project-identity.Tests.ps1",
    "release-packaging.Tests.ps1",
    "release-installer.Tests.ps1",
    "release-workflow.Tests.ps1",
    "session-restore-harness.Tests.ps1",
    "shell-health.Tests.ps1",
    "shell-hosts.Tests.ps1",
    "window-lifecycle.Tests.ps1"
)

foreach ($testFile in $testFiles) {
    $testPath = Join-Path $PSScriptRoot $testFile
    if (-not (Test-Path -LiteralPath $testPath -PathType Leaf)) {
        throw "Required static PowerShell test is missing: $testFile"
    }

    Write-Output "RUN: $testFile"
    & $testPath
}

Write-Output "PASS: all fixed-list static PowerShell tests."
