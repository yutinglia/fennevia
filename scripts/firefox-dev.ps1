#requires -Version 5.1

[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = "High")]
param(
    [Parameter(Position = 0)]
    [ValidateSet("Initialize", "Verify", "Launch", "Environment", "Remove")]
    [string] $Action = "Verify",

    [string] $FirefoxPath,

    [string] $ProfilePath,

    [ValidateSet("about:blank", "about:profiles", "about:support")]
    [string] $Page = "about:blank",

    [switch] $BrowserConsole,

    [switch] $BrowserToolbox,

    [switch] $SecondWindow,

    [switch] $PrivateWindow,

    [switch] $RevealPaths,

    [switch] $RequireNoAutoConfig,

    [switch] $RequireCleanEnvironment,

    [switch] $Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$modulePath = Join-Path $PSScriptRoot "lib\FirefoxDevProfile.psm1"
Import-Module $modulePath -Force
$projectRoot = Split-Path -Parent $PSScriptRoot

switch ($Action) {
    "Initialize" {
        $selectedFirefox = Get-MfsFirefoxExecutable -FirefoxPath $FirefoxPath
        $status = Initialize-MfsFirefoxDevProfile -ProfilePath $ProfilePath
        Write-Output "Initialized the marker-owned Firefox development profile at <MFS_DEV_PROFILE>."
        Write-Output "DevTools chrome debugging is enabled; the remote connection confirmation remains enabled."
        if ($RevealPaths) {
            Write-Warning "Local-only Firefox executable: $selectedFirefox"
            Write-Warning "Local-only profile path: $($status.ProfilePath). Redact it before sharing output."
        }
    }
    "Verify" {
        $status = Test-MfsFirefoxDevProfile -ProfilePath $ProfilePath
        if (-not $status.IsValid) {
            throw ($status.Problems -join " ")
        }

        $firefox = Get-MfsFirefoxDetails -FirefoxPath (Get-MfsFirefoxExecutable -FirefoxPath $FirefoxPath)
        $autoConfig = Get-MfsAutoConfigAudit -ProgramRoot $firefox.ProgramRoot
        $policyAudit = Get-MfsFirefoxPolicyAudit -ProgramRoot $firefox.ProgramRoot
        $profileAudit = Get-MfsProfileContaminationAudit -ProfilePath $status.ProfilePath
        if (($RequireNoAutoConfig -or $RequireCleanEnvironment) -and $autoConfig.HasDeclarations) {
            throw "AutoConfig declarations were detected in the selected Firefox program directory; the Phase 0 stock-program check failed."
        }
        if ($RequireCleanEnvironment -and $policyAudit.HasPolicySource) {
            throw "Firefox enterprise-policy sources were detected; the Phase 0 clean-environment check failed."
        }
        if ($RequireCleanEnvironment -and $profileAudit.HasUnexpectedProfileContent) {
            throw "Profile-installed add-ons or chrome customizations were detected; the Phase 0 clean-profile check failed."
        }

        Write-Output "PASS: marker, managed path, and required Firefox development preferences are valid."
        Write-Output "Firefox $($firefox.Version), build $($firefox.BuildID), channel $($firefox.Channel)."
        Write-Output "AutoConfig declarations: $(if ($autoConfig.HasDeclarations) { "detected" } else { "none detected" })."
        Write-Output "Enterprise-policy sources: $(if ($policyAudit.HasPolicySource) { "detected" } else { "none detected" })."
        Write-Output "Profile-installed add-ons or chrome customizations: $(if ($profileAudit.HasUnexpectedProfileContent) { "detected" } else { "none detected" })."
        if ($RevealPaths) {
            Write-Warning "Local-only Firefox executable: $($firefox.Executable)"
            Write-Warning "Local-only profile path: $($status.ProfilePath)"
        }
    }
    "Launch" {
        $process = Start-MfsFirefoxDevProfile `
            -FirefoxPath $FirefoxPath `
            -ProfilePath $ProfilePath `
            -Page $Page `
            -BrowserConsole:$BrowserConsole `
            -BrowserToolbox:$BrowserToolbox `
            -SecondWindow:$SecondWindow `
            -PrivateWindow:$PrivateWindow
        Write-Output "Launched Firefox process $($process.Id) with the explicit <MFS_DEV_PROFILE> path and --no-remote."
    }
    "Environment" {
        Get-MfsFirefoxEnvironmentRecord `
            -FirefoxPath $FirefoxPath `
            -ProfilePath $ProfilePath `
            -ProjectRoot $projectRoot `
            -RevealPaths:$RevealPaths
    }
    "Remove" {
        $removed = Remove-MfsFirefoxDevProfile `
            -ProfilePath $ProfilePath `
            -Force:$Force `
            -WhatIf:$WhatIfPreference `
            -Confirm:$false
        if ($removed) {
            Write-Output "Removed the marker-owned Firefox development profile. The operation did not touch registered Firefox profiles."
        }
        elseif (-not $WhatIfPreference) {
            Write-Output "The managed Firefox development profile was already absent."
        }
    }
}
