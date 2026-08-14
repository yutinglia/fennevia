#requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string] $ArtifactRoot,

    [Parameter(Mandatory)]
    [string] $InventoryPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$modulePath = Join-Path $PSScriptRoot "lib\SecurityChecks.psm1"
Import-Module $modulePath -Force

try {
    $result = Test-FenneviaProductionArtifacts -ArtifactRoot $ArtifactRoot -InventoryPath $InventoryPath
}
catch {
    Write-Output "FAIL [ARTIFACT_POLICY_INPUT] <ARTIFACT_ROOT>:0"
    exit 2
}

if ($result.Passed) {
    Write-Output "PASS: $($result.DiscoveredFileCount) production artifacts matched the explicit inventory and security rules."
    exit 0
}

foreach ($finding in $result.Findings) {
    Write-Output "FAIL [$($finding.Rule)] $($finding.Path):$($finding.Line)"
}
Write-Output "FAIL: production artifact review found $($result.Findings.Count) finding(s)."
exit 1
