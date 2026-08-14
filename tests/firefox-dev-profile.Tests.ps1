#requires -Version 5.1

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-True {
    param(
        [Parameter(Mandatory)]
        [bool] $Condition,

        [Parameter(Mandatory)]
        [string] $Message
    )

    if (-not $Condition) {
        throw "Assertion failed: $Message"
    }
}

function Assert-Throws {
    param(
        [Parameter(Mandatory)]
        [scriptblock] $Operation,

        [Parameter(Mandatory)]
        [string] $Message
    )

    $didThrow = $false
    try {
        & $Operation
    }
    catch {
        $didThrow = $true
    }

    if (-not $didThrow) {
        throw "Assertion failed: $Message"
    }
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$modulePath = Join-Path $repositoryRoot "scripts\lib\FirefoxDevProfile.psm1"
$originalLocalAppData = $env:LOCALAPPDATA
$originalAppData = $env:APPDATA
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ("fennevia-firefox-profile-tests-" + [guid]::NewGuid().ToString("N"))
$canonicalTempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd("\", "/")
$canonicalTestRoot = [IO.Path]::GetFullPath($testRoot).TrimEnd("\", "/")

if (-not $canonicalTestRoot.StartsWith($canonicalTempRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "The test cleanup target did not resolve below the operating-system temporary directory."
}

New-Item -ItemType Directory -Path $testRoot -Force | Out-Null

try {
    $env:LOCALAPPDATA = Join-Path $testRoot "Local"
    $env:APPDATA = Join-Path $testRoot "Roaming"
    New-Item -ItemType Directory -Path $env:LOCALAPPDATA -Force | Out-Null
    New-Item -ItemType Directory -Path $env:APPDATA -Force | Out-Null

    Import-Module $modulePath -Force

    $module = Get-Module FirefoxDevProfile
    $missingOptionalProperty = & $module {
        Get-FenneviaOptionalPropertyValue -InputObject ([pscustomobject]@{ Present = "value" }) -Name "Missing"
    }
    Assert-True -Condition ($null -eq $missingOptionalProperty) -Message "Missing optional registry properties must not fail under StrictMode."

    Assert-Throws -Message "Second-window and private-window smoke modes must be mutually exclusive." -Operation {
        Start-FenneviaFirefoxDevProfile -SecondWindow -PrivateWindow
    }

    $defaultProfile = Get-FenneviaDefaultProfilePath
    $initialized = Initialize-FenneviaFirefoxDevProfile
    Assert-True -Condition $initialized.IsValid -Message "Initialize should produce a valid managed profile."
    Assert-True -Condition (Test-Path -LiteralPath (Join-Path $defaultProfile ".fennevia-dev-profile.json")) -Message "The ownership marker should exist."
    Assert-True -Condition (Test-Path -LiteralPath (Join-Path $defaultProfile "user.js")) -Message "The generated user.js should exist."

    $cleanProfileAudit = Get-FenneviaProfileContaminationAudit -ProfilePath $defaultProfile
    Assert-True -Condition (-not $cleanProfileAudit.HasUnexpectedProfileContent) -Message "A new managed profile should have no add-on or chrome contamination."
    $chromeDirectory = Join-Path $defaultProfile "chrome"
    New-Item -ItemType Directory -Path $chromeDirectory -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $chromeDirectory "userChrome.css"), "/* unrelated customization */")
    $contaminatedProfileAudit = Get-FenneviaProfileContaminationAudit -ProfilePath $defaultProfile
    Assert-True -Condition $contaminatedProfileAudit.HasUnexpectedProfileContent -Message "A chrome customization should fail the clean-profile audit."
    Remove-Item -LiteralPath $chromeDirectory -Recurse -Force

    $fakeProgramRoot = Join-Path $testRoot "fake-firefox-program"
    $distributionDirectory = Join-Path $fakeProgramRoot "distribution"
    New-Item -ItemType Directory -Path $distributionDirectory -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $distributionDirectory "policies.json"), '{"policies":{}}')
    $policyAudit = Get-FenneviaFirefoxPolicyAudit -ProgramRoot $fakeProgramRoot
    Assert-True -Condition $policyAudit.HasPoliciesJson -Message "A distribution policies.json should be detected."

    $initializedAgain = Initialize-FenneviaFirefoxDevProfile
    Assert-True -Condition $initializedAgain.IsValid -Message "Initialize should be idempotent for a marker-owned profile."

    Assert-Throws -Message "Deletion without -Force must be rejected." -Operation {
        Remove-FenneviaFirefoxDevProfile -Confirm:$false
    }

    Remove-FenneviaFirefoxDevProfile -Force -WhatIf -Confirm:$false | Out-Null
    Assert-True -Condition (Test-Path -LiteralPath $defaultProfile) -Message "WhatIf must preserve the profile."

    $profileChildJunctionTarget = Join-Path $testRoot "profile-child-junction-target"
    $profileChildJunction = Join-Path $defaultProfile "linked-directory"
    New-Item -ItemType Directory -Path $profileChildJunctionTarget -Force | Out-Null
    New-Item -ItemType Junction -Path $profileChildJunction -Target $profileChildJunctionTarget | Out-Null
    Assert-Throws -Message "A reparse point inside the profile must block reinitialization." -Operation {
        Initialize-FenneviaFirefoxDevProfile
    }
    Assert-Throws -Message "A reparse point inside the profile must block recursive deletion." -Operation {
        Remove-FenneviaFirefoxDevProfile -Force -Confirm:$false
    }
    Remove-Item -LiteralPath $profileChildJunction -Force

    $removed = Remove-FenneviaFirefoxDevProfile -Force -Confirm:$false
    Assert-True -Condition $removed -Message "A marker-owned profile should be removable with -Force."
    Assert-True -Condition (-not (Test-Path -LiteralPath $defaultProfile)) -Message "The profile should be absent after removal."

    $managedRoot = Split-Path -Parent $defaultProfile
    $unownedProfile = Join-Path $managedRoot "unowned"
    New-Item -ItemType Directory -Path $unownedProfile -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $unownedProfile "foreign.txt"), "not owned")
    Assert-Throws -Message "A non-empty unowned directory must not be initialized." -Operation {
        Initialize-FenneviaFirefoxDevProfile -ProfilePath $unownedProfile
    }
    Assert-Throws -Message "An unowned directory must not be deleted." -Operation {
        Remove-FenneviaFirefoxDevProfile -ProfilePath $unownedProfile -Force -Confirm:$false
    }

    $junctionTarget = Join-Path $testRoot "junction-target"
    $junctionProfile = Join-Path $managedRoot "junction-profile"
    New-Item -ItemType Directory -Path $junctionTarget -Force | Out-Null
    New-Item -ItemType Junction -Path $junctionProfile -Target $junctionTarget | Out-Null
    Assert-Throws -Message "A reparse-point profile path must be rejected." -Operation {
        Initialize-FenneviaFirefoxDevProfile -ProfilePath $junctionProfile
    }

    $invalidMarkerProfile = Join-Path $managedRoot "invalid-marker"
    New-Item -ItemType Directory -Path $invalidMarkerProfile -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $invalidMarkerProfile ".fennevia-dev-profile.json"), '{"owner":"fennevia"}')
    Assert-Throws -Message "A malformed ownership marker must not authorize deletion." -Operation {
        Remove-FenneviaFirefoxDevProfile -ProfilePath $invalidMarkerProfile -Force -Confirm:$false
    }

    $registeredProfile = Join-Path $managedRoot "registered"
    $firefoxDataRoot = Join-Path $env:APPDATA "Mozilla\Firefox"
    New-Item -ItemType Directory -Path $firefoxDataRoot -Force | Out-Null
    $profilesIni = @(
        "[Profile0]",
        "Name=daily-use-test",
        "IsRelative=0",
        "Path=$registeredProfile"
    ) -join [Environment]::NewLine
    [IO.File]::WriteAllText((Join-Path $firefoxDataRoot "profiles.ini"), $profilesIni)
    Assert-Throws -Message "A profiles.ini-registered path must be rejected." -Operation {
        Initialize-FenneviaFirefoxDevProfile -ProfilePath $registeredProfile
    }

    Remove-Item -LiteralPath (Join-Path $firefoxDataRoot "profiles.ini") -Force
    $installsIni = @(
        "[InstallTest]",
        "Default=$registeredProfile",
        "Locked=1"
    ) -join [Environment]::NewLine
    [IO.File]::WriteAllText((Join-Path $firefoxDataRoot "installs.ini"), $installsIni)
    Assert-Throws -Message "An installs.ini-default path must be rejected." -Operation {
        Initialize-FenneviaFirefoxDevProfile -ProfilePath $registeredProfile
    }

    $outsideManagedRoot = Join-Path $testRoot "outside-managed-root"
    Assert-Throws -Message "A path outside the dedicated managed root must be rejected." -Operation {
        Initialize-FenneviaFirefoxDevProfile -ProfilePath $outsideManagedRoot
    }

    Write-Output "PASS: Firefox development-profile path, marker, idempotency, and deletion safety tests."
}
finally {
    Remove-Module FirefoxDevProfile -ErrorAction SilentlyContinue
    $env:LOCALAPPDATA = $originalLocalAppData
    $env:APPDATA = $originalAppData
    if (Test-Path -LiteralPath $canonicalTestRoot) {
        Remove-Item -LiteralPath $canonicalTestRoot -Recurse -Force
    }
}
