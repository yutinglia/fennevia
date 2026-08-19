#requires -Version 5.1

# SPDX-License-Identifier: MPL-2.0

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

function Assert-Equal {
    param(
        [Parameter(Mandatory)]
        [AllowNull()]
        [object] $Actual,

        [Parameter(Mandatory)]
        [AllowNull()]
        [object] $Expected,

        [Parameter(Mandatory)]
        [string] $Message
    )

    if ($Actual -cne $Expected) {
        throw "Assertion failed: $Message Expected '$Expected', got '$Actual'."
    }
}

function Assert-ThrowsCode {
    param(
        [Parameter(Mandatory)]
        [string] $Code,

        [Parameter(Mandatory)]
        [string] $Message,

        [Parameter(Mandatory)]
        [scriptblock] $Operation
    )

    try {
        & $Operation
    }
    catch {
        if ($_.Exception.Message.StartsWith("Assertion failed:", [StringComparison]::Ordinal)) {
            throw
        }
        $actualCode = Get-FenneviaInstallerErrorCode -ErrorRecord $_
        if ($actualCode -cne $Code) {
            throw "Assertion failed: $Message Expected code '$Code', got '$actualCode'. Message: $($_.Exception.Message)"
        }
        return
    }
    throw "Assertion failed: $Message Expected code '$Code', but no exception was thrown."
}

function Write-TestFile {
    param(
        [Parameter(Mandatory)]
        [string] $Path,

        [Parameter(Mandatory)]
        [AllowEmptyString()]
        [string] $Content
    )

    $parent = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    $encoding = New-Object Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($Path, $Content, $encoding)
}

function New-TestFirefoxTarget {
    param(
        [Parameter(Mandatory)]
        [string] $Name,

        [string] $Version = "153.0.4",

        [string] $BuildId = "20260810162159",

        [switch] $RegisterProfile
    )

    $programRoot = Join-Path $script:TestRoot "programs\$Name"
    New-Item -ItemType Directory -Path (Join-Path $programRoot "defaults\pref") -Force | Out-Null
    Write-TestFile -Path (Join-Path $programRoot "firefox.exe") -Content "fixture executable"
    $applicationIni = @(
        "[App]",
        "Name=Firefox",
        "Version=$Version",
        "BuildID=$BuildId"
    ) -join [Environment]::NewLine
    Write-TestFile -Path (Join-Path $programRoot "application.ini") -Content ($applicationIni + [Environment]::NewLine)

    $profileRoot = Join-Path $env:APPDATA "Mozilla\Firefox\Profiles\$Name"
    New-Item -ItemType Directory -Path $profileRoot -Force | Out-Null
    if ($RegisterProfile) {
        Add-TestRegisteredProfile -Name $Name -ProfileRoot $profileRoot
    }

    return [pscustomobject]@{
        FirefoxPath = Join-Path $programRoot "firefox.exe"
        ProgramRoot = $programRoot
        ProfileRoot = $profileRoot
    }
}

function Add-TestRegisteredProfile {
    param(
        [Parameter(Mandatory)]
        [string] $Name,

        [Parameter(Mandatory)]
        [string] $ProfileRoot
    )

    $profilesIni = Join-Path $env:APPDATA "Mozilla\Firefox\profiles.ini"
    $section = @(
        "[Profile$Name]",
        "Name=$Name",
        "IsRelative=0",
        "Path=$ProfileRoot",
        ""
    ) -join [Environment]::NewLine
    $parent = Split-Path -Parent $profilesIni
    if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    [IO.File]::AppendAllText($profilesIni, $section, (New-Object Text.UTF8Encoding($false)))
}

function Remove-TestInstalledScope {
    param(
        [Parameter(Mandatory)]
        [object] $Target,

        [Parameter(Mandatory)]
        [ValidateSet("program", "profile")]
        [string] $Scope
    )

    $survivorPath = if ($Scope -eq "program") {
        Join-Path $Target.ProfileRoot ".fennevia\ownership.json"
    }
    else {
        Join-Path $Target.ProgramRoot ".fennevia\ownership.json"
    }
    $ownership = Get-Content -Raw -LiteralPath $survivorPath | ConvertFrom-Json
    $root = if ($Scope -eq "program") { $Target.ProgramRoot } else { $Target.ProfileRoot }
    foreach ($file in @($ownership.files | Where-Object { $_.scope -eq $Scope })) {
        $filePath = Join-Path $root ([string] $file.installedPath).Replace("/", "\")
        if (Test-Path -LiteralPath $filePath -PathType Leaf) {
            Remove-Item -LiteralPath $filePath -Force
        }
    }
    $metadataRoot = Join-Path $root ".fennevia"
    $ownershipPath = Join-Path $metadataRoot "ownership.json"
    if (Test-Path -LiteralPath $ownershipPath -PathType Leaf) {
        Remove-Item -LiteralPath $ownershipPath -Force
    }
    if (Test-Path -LiteralPath $metadataRoot -PathType Container) {
        Assert-Equal -Actual @(Get-ChildItem -Force -LiteralPath $metadataRoot).Count -Expected 0 -Message "The test may remove only an empty ownership metadata directory."
        Remove-Item -LiteralPath $metadataRoot -Force
    }
    foreach ($directory in @(
        $ownership.createdDirectories |
            Where-Object { $_.scope -eq $Scope } |
            Sort-Object @{ Expression = { (([string] $_.path) -split "/").Count }; Descending = $true }
    )) {
        $directoryPath = Join-Path $root ([string] $directory.path).Replace("/", "\")
        if ((Test-Path -LiteralPath $directoryPath -PathType Container) -and @(Get-ChildItem -Force -LiteralPath $directoryPath).Count -eq 0) {
            Remove-Item -LiteralPath $directoryPath -Force
        }
    }
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$script:TestRoot = Join-Path ([IO.Path]::GetTempPath()) ("fennevia-release-installer-tests-" + [guid]::NewGuid().ToString("N"))
$canonicalTempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd("\", "/")
$canonicalTestRoot = [IO.Path]::GetFullPath($script:TestRoot).TrimEnd("\", "/")
Assert-True -Condition ($canonicalTestRoot.StartsWith($canonicalTempRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) -Message "The installer release test root must remain inside the OS temporary directory."
New-Item -ItemType Directory -Path $canonicalTestRoot | Out-Null

$originalAppData = $env:APPDATA
$originalLocalAppData = $env:LOCALAPPDATA
$originalUserProfile = $env:USERPROFILE
try {
    $env:APPDATA = Join-Path $canonicalTestRoot "roaming"
    $env:LOCALAPPDATA = Join-Path $canonicalTestRoot "local"
    $env:USERPROFILE = Join-Path $canonicalTestRoot "user"
    New-Item -ItemType Directory -Path $env:APPDATA, $env:LOCALAPPDATA, $env:USERPROFILE -Force | Out-Null

    Import-Module (Join-Path $repositoryRoot "scripts\lib\FenneviaRelease.psm1") -Force
    $release = New-FenneviaReleaseArtifacts `
        -RepositoryRoot $repositoryRoot `
        -OutputDirectory (Join-Path $canonicalTestRoot "release output") `
        -SourceCommit "0123456789abcdef0123456789abcdef01234567" `
        -ExpectedTag "v0.10.0-beta.1" `
        -TestAllowDirtySource
    Remove-Module FenneviaRelease -ErrorAction SilentlyContinue
    Import-Module (Join-Path $repositoryRoot "scripts\lib\FenneviaInstaller.psm1") -Force

    $interruptedTarget = New-TestFirefoxTarget -Name "interrupted" -RegisterProfile
    $interruptedRoot = Join-Path $interruptedTarget.ProgramRoot ".fennevia-transaction-test"
    New-Item -ItemType Directory -Path $interruptedRoot | Out-Null
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_INTERRUPTED_TRANSACTION" -Message "The extracted release must refuse a target with interrupted transaction residue." -Operation {
        Invoke-FenneviaPackageAction -Action Install -FirefoxPath $interruptedTarget.FirefoxPath -ProfilePath $interruptedTarget.ProfileRoot -ProfileMode Registered -PackageRoot $release.PackageRoot -DryRun | Out-Null
    }
    Remove-Item -LiteralPath $interruptedRoot -Force

    $registeredTarget = New-TestFirefoxTarget -Name "registered" -RegisterProfile
    Write-TestFile -Path (Join-Path $registeredTarget.ProfileRoot "chrome\unrelated.css") -Content "/* unrelated and preserved */"
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_REGISTERED_PROFILE" -Message "Development mode must reject a registered Firefox profile." -Operation {
        Invoke-FenneviaPackageAction `
            -Action Install `
            -FirefoxPath $registeredTarget.FirefoxPath `
            -ProfilePath $registeredTarget.ProfileRoot `
            -PackageRoot $release.PackageRoot `
            -DryRun | Out-Null
    }
    $registeredPlan = Invoke-FenneviaPackageAction `
        -Action Install `
        -FirefoxPath $registeredTarget.FirefoxPath `
        -ProfilePath $registeredTarget.ProfileRoot `
        -ProfileMode Registered `
        -PackageRoot $release.PackageRoot `
        -DryRun
    Assert-Equal -Actual $registeredPlan.ProfileMode -Expected "Registered" -Message "The reviewed plan must expose registered-profile mode."
    Assert-True -Condition ($registeredPlan.PlannedMutationCount -gt 0) -Message "A supported registered target must produce an install plan."
    $enginePath = (Get-Process -Id $PID).Path
    $releaseCli = Join-Path $release.PackageRoot "scripts\fennevia-package.ps1"
    $priorErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $cliOutput = @(
            & $enginePath `
                -NoProfile `
                -ExecutionPolicy Bypass `
                -File $releaseCli `
                -Action Install `
                -FirefoxPath $registeredTarget.FirefoxPath `
                -ProfilePath $registeredTarget.ProfileRoot `
                -ProfileMode Registered `
                -WhatIf 2>&1
        )
        $cliExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $priorErrorAction
    }
    Assert-Equal -Actual $cliExitCode -Expected 0 -Message "The staged release CLI must preview a registered-profile install."
    $cliText = $cliOutput -join [Environment]::NewLine
    Assert-True -Condition $cliText.Contains("profileMode=registered") -Message "The CLI preview must make registered-profile mode explicit."
    Assert-True -Condition (-not $cliText.Contains($canonicalTestRoot)) -Message "The release CLI must not disclose selected local paths."
    $registeredResult = Invoke-FenneviaPackageAction `
        -Action Install `
        -FirefoxPath $registeredTarget.FirefoxPath `
        -ProfilePath $registeredTarget.ProfileRoot `
        -ProfileMode Registered `
        -PackageRoot $release.PackageRoot
    Assert-True -Condition $registeredResult.Applied -Message "The exact staged release must install to an explicitly registered profile."
    $sameReleaseUpdate = Invoke-FenneviaPackageAction -Action Update -FirefoxPath $registeredTarget.FirefoxPath -ProfilePath $registeredTarget.ProfileRoot -ProfileMode Registered -PackageRoot $release.PackageRoot -DryRun
    Assert-Equal -Actual $sameReleaseUpdate.Status -Expected "already-current" -Message "Updating from the same extracted release must be a deterministic no-op."

    [void] (Invoke-FenneviaPackageAction -Action Disable -FirefoxPath $registeredTarget.FirefoxPath -ProfilePath $registeredTarget.ProfileRoot -ProfileMode Registered -PackageRoot $release.PackageRoot)
    $newerIni = @(
        "[App]",
        "Name=Firefox",
        "Version=154.0",
        "BuildID=20260812182057"
    ) -join [Environment]::NewLine
    Write-TestFile -Path (Join-Path $registeredTarget.ProgramRoot "application.ini") -Content ($newerIni + [Environment]::NewLine)
    $enableOn154 = Invoke-FenneviaPackageAction -Action Enable -FirefoxPath $registeredTarget.FirefoxPath -ProfilePath $registeredTarget.ProfileRoot -ProfileMode Registered -PackageRoot $release.PackageRoot -DryRun
    Assert-Equal -Actual $enableOn154.CompatibilityKind -Expected "tested" -Message "Enable on Firefox 154.0 must be classified as tested."
    Assert-True -Condition ($enableOn154.FirefoxSupportWarning -match "153 and 154") -Message "Enable plans must carry the tested-version support warning."
    $enabledOn154 = Invoke-FenneviaPackageAction -Action Enable -FirefoxPath $registeredTarget.FirefoxPath -ProfilePath $registeredTarget.ProfileRoot -ProfileMode Registered -PackageRoot $release.PackageRoot
    Assert-True -Condition $enabledOn154.Applied -Message "Enable must succeed on owner-confirmed Firefox 154.0."
    [void] (Invoke-FenneviaPackageAction -Action Disable -FirefoxPath $registeredTarget.FirefoxPath -ProfilePath $registeredTarget.ProfileRoot -ProfileMode Registered -PackageRoot $release.PackageRoot)
    $olderIni = @(
        "[App]",
        "Name=Firefox",
        "Version=152.0",
        "BuildID=20260801000000"
    ) -join [Environment]::NewLine
    Write-TestFile -Path (Join-Path $registeredTarget.ProgramRoot "application.ini") -Content ($olderIni + [Environment]::NewLine)
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_FIREFOX_UNSUPPORTED" -Message "Enable must reject Firefox older than the tested baseline." -Operation {
        Invoke-FenneviaPackageAction -Action Enable -FirefoxPath $registeredTarget.FirefoxPath -ProfilePath $registeredTarget.ProfileRoot -ProfileMode Registered -PackageRoot $release.PackageRoot -DryRun | Out-Null
    }
    $disabledPreference = Join-Path $registeredTarget.ProgramRoot "defaults\pref\fennevia.js.disabled"
    Assert-True -Condition (Test-Path -LiteralPath $disabledPreference -PathType Leaf) -Message "A rejected enable must leave the hard-disable preference state unchanged."
    $alreadyDisabled = Invoke-FenneviaPackageAction -Action Disable -FirefoxPath $registeredTarget.FirefoxPath -ProfilePath $registeredTarget.ProfileRoot -ProfileMode Registered -PackageRoot $release.PackageRoot
    Assert-Equal -Actual $alreadyDisabled.Status -Expected "already-disabled" -Message "Disable must remain available on an unsupported Firefox build."
    [void] (Invoke-FenneviaPackageAction -Action Uninstall -FirefoxPath $registeredTarget.FirefoxPath -ProfilePath $registeredTarget.ProfileRoot -ProfileMode Registered -PackageRoot $release.PackageRoot)
    Assert-True -Condition (-not (Test-Path -LiteralPath (Join-Path $registeredTarget.ProgramRoot ".fennevia"))) -Message "Uninstall must remain available on an unsupported Firefox build."
    Assert-True -Condition (Test-Path -LiteralPath (Join-Path $registeredTarget.ProfileRoot "chrome\unrelated.css") -PathType Leaf) -Message "Release uninstall must preserve unrelated profile chrome content."

    $unsupportedTarget = New-TestFirefoxTarget -Name "unsupported" -Version "152.0" -BuildId "20260801000000" -RegisterProfile
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_FIREFOX_UNSUPPORTED" -Message "Install must reject Firefox older than the tested baseline before mutation." -Operation {
        Invoke-FenneviaPackageAction -Action Install -FirefoxPath $unsupportedTarget.FirefoxPath -ProfilePath $unsupportedTarget.ProfileRoot -ProfileMode Registered -PackageRoot $release.PackageRoot -DryRun | Out-Null
    }
    Assert-True -Condition (-not (Test-Path -LiteralPath (Join-Path $unsupportedTarget.ProgramRoot ".fennevia"))) -Message "Unsupported-build rejection must occur before any installer mutation."

    $newerTarget = New-TestFirefoxTarget -Name "untested-newer" -Version "155.0" -BuildId "20260901000000" -RegisterProfile
    $newerPlan = Invoke-FenneviaPackageAction -Action Install -FirefoxPath $newerTarget.FirefoxPath -ProfilePath $newerTarget.ProfileRoot -ProfileMode Registered -PackageRoot $release.PackageRoot -DryRun
    Assert-Equal -Actual $newerPlan.CompatibilityKind -Expected "untested-newer" -Message "Firefox 155 must be installable as untested-newer."
    Assert-True -Condition ($newerPlan.FirefoxSupportWarning -match "does not promise") -Message "Untested Firefox plans must warn that confirming install is not a working promise."
    $newerInstall = Invoke-FenneviaPackageAction -Action Install -FirefoxPath $newerTarget.FirefoxPath -ProfilePath $newerTarget.ProfileRoot -ProfileMode Registered -PackageRoot $release.PackageRoot
    Assert-True -Condition $newerInstall.Applied -Message "Install must apply on Firefox newer than the tested majors after the relaxed gate."
    [void] (Invoke-FenneviaPackageAction -Action Uninstall -FirefoxPath $newerTarget.FirefoxPath -ProfilePath $newerTarget.ProfileRoot -ProfileMode Registered -PackageRoot $release.PackageRoot)

    $unregisteredTarget = New-TestFirefoxTarget -Name "unregistered"
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_UNREGISTERED_PROFILE" -Message "Registered mode must not adopt an unregistered profile without ownership." -Operation {
        Invoke-FenneviaPackageAction -Action Install -FirefoxPath $unregisteredTarget.FirefoxPath -ProfilePath $unregisteredTarget.ProfileRoot -ProfileMode Registered -PackageRoot $release.PackageRoot -DryRun | Out-Null
    }

    $repairTarget = New-TestFirefoxTarget -Name "registered-repair" -RegisterProfile
    [void] (Invoke-FenneviaPackageAction -Action Install -FirefoxPath $repairTarget.FirefoxPath -ProfilePath $repairTarget.ProfileRoot -ProfileMode Registered -PackageRoot $release.PackageRoot)
    Remove-TestInstalledScope -Target $repairTarget -Scope program
    Remove-Item -LiteralPath (Join-Path $env:APPDATA "Mozilla\Firefox\profiles.ini") -Force
    $repairPlan = Invoke-FenneviaPackageAction -Action Repair -FirefoxPath $repairTarget.FirefoxPath -ProfilePath $repairTarget.ProfileRoot -ProfileMode Registered -PackageRoot $release.PackageRoot -DryRun
    Assert-Equal -Actual $repairPlan.Status -Expected "repairable-program" -Message "A surviving ownership side must permit explicit release repair after Firefox registration is lost."
    [void] (Invoke-FenneviaPackageAction -Action Repair -FirefoxPath $repairTarget.FirefoxPath -ProfilePath $repairTarget.ProfileRoot -ProfileMode Registered -PackageRoot $release.PackageRoot)
    [void] (Invoke-FenneviaPackageAction -Action Disable -FirefoxPath $repairTarget.FirefoxPath -ProfilePath $repairTarget.ProfileRoot -ProfileMode Registered -PackageRoot $release.PackageRoot)
    $enabledAfterRepair = Invoke-FenneviaPackageAction -Action Enable -FirefoxPath $repairTarget.FirefoxPath -ProfilePath $repairTarget.ProfileRoot -ProfileMode Registered -PackageRoot $release.PackageRoot
    Assert-True -Condition $enabledAfterRepair.Applied -Message "Enable must succeed from the exact release source after verified one-sided repair."
    [void] (Invoke-FenneviaPackageAction -Action Uninstall -FirefoxPath $repairTarget.FirefoxPath -ProfilePath $repairTarget.ProfileRoot -ProfileMode Registered -PackageRoot $release.PackageRoot)

    $survivorUninstallTarget = New-TestFirefoxTarget -Name "registered-survivor-uninstall" -RegisterProfile
    Write-TestFile -Path (Join-Path $survivorUninstallTarget.ProfileRoot "chrome\unrelated.css") -Content "/* unrelated and preserved */"
    [void] (Invoke-FenneviaPackageAction -Action Install -FirefoxPath $survivorUninstallTarget.FirefoxPath -ProfilePath $survivorUninstallTarget.ProfileRoot -ProfileMode Registered -PackageRoot $release.PackageRoot)
    $missingOwnershipMetadata = Join-Path $survivorUninstallTarget.ProfileRoot ".fennevia"
    Remove-Item -LiteralPath (Join-Path $missingOwnershipMetadata "ownership.json") -Force
    Remove-Item -LiteralPath $missingOwnershipMetadata -Force
    Remove-Item -LiteralPath (Join-Path $env:APPDATA "Mozilla\Firefox\profiles.ini") -Force
    $missingOldPackage = Join-Path $canonicalTestRoot "unavailable old package"
    $survivorUninstallPlan = Invoke-FenneviaPackageAction -Action Uninstall -FirefoxPath $survivorUninstallTarget.FirefoxPath -ProfilePath $survivorUninstallTarget.ProfileRoot -ProfileMode Registered -PackageRoot $missingOldPackage -DryRun
    Assert-Equal -Actual $survivorUninstallPlan.Status -Expected "ready" -Message "A valid surviving ownership side must permit package-independent uninstall."
    Assert-True -Condition ($survivorUninstallPlan.PlannedMutationCount -gt 0) -Message "One-sided uninstall must plan removal of verified surviving owned content."
    [void] (Invoke-FenneviaPackageAction -Action Uninstall -FirefoxPath $survivorUninstallTarget.FirefoxPath -ProfilePath $survivorUninstallTarget.ProfileRoot -ProfileMode Registered -PackageRoot $missingOldPackage)
    Assert-True -Condition (-not (Test-Path -LiteralPath (Join-Path $survivorUninstallTarget.ProgramRoot ".fennevia"))) -Message "One-sided uninstall must remove the surviving ownership metadata."
    Assert-True -Condition (-not (Test-Path -LiteralPath (Join-Path $survivorUninstallTarget.ProgramRoot "fennevia.cfg"))) -Message "One-sided uninstall must remove verified surviving program content."
    Assert-True -Condition (-not (Test-Path -LiteralPath (Join-Path $survivorUninstallTarget.ProfileRoot "chrome\fennevia"))) -Message "One-sided uninstall must remove verified owned content from the side whose ownership file is absent."
    Assert-True -Condition (Test-Path -LiteralPath (Join-Path $survivorUninstallTarget.ProfileRoot "chrome\unrelated.css") -PathType Leaf) -Message "One-sided uninstall must preserve unrelated profile content."

    $modifiedSurvivorTarget = New-TestFirefoxTarget -Name "registered-modified-survivor" -RegisterProfile
    [void] (Invoke-FenneviaPackageAction -Action Install -FirefoxPath $modifiedSurvivorTarget.FirefoxPath -ProfilePath $modifiedSurvivorTarget.ProfileRoot -ProfileMode Registered -PackageRoot $release.PackageRoot)
    Remove-TestInstalledScope -Target $modifiedSurvivorTarget -Scope profile
    [IO.File]::AppendAllText((Join-Path $modifiedSurvivorTarget.ProgramRoot "fennevia.cfg"), "modified")
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_OWNED_FILE_MODIFIED" -Message "One-sided uninstall must reject a modified surviving owned file." -Operation {
        Invoke-FenneviaPackageAction -Action Uninstall -FirefoxPath $modifiedSurvivorTarget.FirefoxPath -ProfilePath $modifiedSurvivorTarget.ProfileRoot -ProfileMode Registered -PackageRoot $missingOldPackage -DryRun | Out-Null
    }

    $metadataSurvivorTarget = New-TestFirefoxTarget -Name "registered-metadata-survivor" -RegisterProfile
    [void] (Invoke-FenneviaPackageAction -Action Install -FirefoxPath $metadataSurvivorTarget.FirefoxPath -ProfilePath $metadataSurvivorTarget.ProfileRoot -ProfileMode Registered -PackageRoot $release.PackageRoot)
    Remove-TestInstalledScope -Target $metadataSurvivorTarget -Scope profile
    Write-TestFile -Path (Join-Path $metadataSurvivorTarget.ProfileRoot ".fennevia\residue.txt") -Content "unexplained residue"
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_METADATA_CONFLICT" -Message "One-sided uninstall must reject metadata residue on the missing ownership side." -Operation {
        Invoke-FenneviaPackageAction -Action Uninstall -FirefoxPath $metadataSurvivorTarget.FirefoxPath -ProfilePath $metadataSurvivorTarget.ProfileRoot -ProfileMode Registered -PackageRoot $missingOldPackage -DryRun | Out-Null
    }

    $tamperedPackage = Join-Path $canonicalTestRoot "tampered release"
    Copy-Item -LiteralPath $release.PackageRoot -Destination $tamperedPackage -Recurse
    [IO.File]::AppendAllText((Join-Path $tamperedPackage "INSTALL.md"), "tampered")
    $tamperTarget = New-TestFirefoxTarget -Name "tampered" -RegisterProfile
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_RELEASE_INVALID" -Message "Installer must reject any changed file in a staged release tree." -Operation {
        Invoke-FenneviaPackageAction -Action Install -FirefoxPath $tamperTarget.FirefoxPath -ProfilePath $tamperTarget.ProfileRoot -ProfileMode Registered -PackageRoot $tamperedPackage -DryRun | Out-Null
    }

    Write-Output "PASS: registered-profile release install, major-version Firefox compatibility, survivor recovery/uninstall, repair, and tamper tests."
}
finally {
    Remove-Module FenneviaInstaller, FenneviaRelease -ErrorAction SilentlyContinue
    $env:APPDATA = $originalAppData
    $env:LOCALAPPDATA = $originalLocalAppData
    $env:USERPROFILE = $originalUserProfile
    if (
        (Test-Path -LiteralPath $canonicalTestRoot) -and
        $canonicalTestRoot.StartsWith($canonicalTempRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)
    ) {
        Remove-Item -LiteralPath $canonicalTestRoot -Recurse -Force
    }
}
