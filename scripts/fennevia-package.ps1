#requires -Version 5.1

[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = "High")]
param(
    [Parameter(Mandatory)]
    [ValidateSet("Install", "Update", "Disable", "Enable", "Uninstall")]
    [string] $Action,

    [Parameter(Mandatory)]
    [string] $FirefoxPath,

    [Parameter(Mandatory)]
    [string] $ProfilePath,

    [switch] $AcceptPlan
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$dryRunOnly = [bool] $WhatIfPreference
$WhatIfPreference = $false

$projectRoot = Split-Path -Parent $PSScriptRoot
$modulePath = Join-Path $PSScriptRoot "lib\FenneviaInstaller.psm1"
Import-Module $modulePath -Force
$plan = $null

try {
    $plan = Invoke-FenneviaPackageAction `
        -Action $Action `
        -FirefoxPath $FirefoxPath `
        -ProfilePath $ProfilePath `
        -PackageRoot $projectRoot `
        -DryRun
    ConvertTo-FenneviaInstallerResultLines -Result $plan | Write-Output

    if ($dryRunOnly -or $plan.PlannedMutationCount -eq 0) {
        exit 0
    }

    $target = "<FIREFOX_PROGRAM> and <FENNEVIA_PROFILE>"
    if (-not $AcceptPlan -and -not $PSCmdlet.ShouldProcess($target, "$Action the Fennevia package using the displayed exact plan")) {
        exit 0
    }

    $result = Invoke-FenneviaPackageAction `
        -Action $Action `
        -FirefoxPath $FirefoxPath `
        -ProfilePath $ProfilePath `
        -PackageRoot $projectRoot `
        -ExpectedPlanSha256 $plan.PlanSha256
    ConvertTo-FenneviaInstallerResultLines -Result $result | Write-Output
    exit 0
}
catch {
    $code = Get-FenneviaInstallerErrorCode -ErrorRecord $_
    $plannedMutationCount = if ($null -eq $plan) { 0 } else { $plan.PlannedMutationCount }
    $safeMessage = if ($code -eq "FENNEVIA_INSTALL_UNEXPECTED") {
        "An unexpected local failure occurred; details are omitted from normal output to avoid path disclosure."
    }
    else {
        $_.Exception.Message
    }
    Write-Error "FAIL [$code] plannedMutationCount=$plannedMutationCount pathDisclosure=redacted $safeMessage"
    exit 1
}
finally {
    Remove-Module FenneviaInstaller -ErrorAction SilentlyContinue
}
