#requires -Version 5.1

# SPDX-License-Identifier: MPL-2.0

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string] $FirefoxPath,

    [Parameter(Mandatory)]
    [string] $ProfilePath,

    [Parameter(Mandatory)]
    [string] $PackageRoot
)

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

$canonicalFirefox = [IO.Path]::GetFullPath($FirefoxPath)
$canonicalProfile = [IO.Path]::GetFullPath($ProfilePath).TrimEnd("\", "/")
$canonicalPackage = [IO.Path]::GetFullPath($PackageRoot).TrimEnd("\", "/")
$programRoot = Split-Path -Parent $canonicalFirefox
$managedRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA "fennevia")).TrimEnd("\", "/")
$profilePrefix = [IO.Path]::GetFullPath((Join-Path $managedRoot "profiles")).TrimEnd("\", "/") + [IO.Path]::DirectorySeparatorChar
$programPrefix = [IO.Path]::GetFullPath((Join-Path $managedRoot "program-spikes")).TrimEnd("\", "/") + [IO.Path]::DirectorySeparatorChar

Assert-True -Condition $canonicalProfile.StartsWith($profilePrefix, [StringComparison]::OrdinalIgnoreCase) -Message "The release recovery profile must remain below the Fennevia managed profile root."
Assert-True -Condition $programRoot.StartsWith($programPrefix, [StringComparison]::OrdinalIgnoreCase) -Message "The release recovery program must remain below the Fennevia copied-program root."
Assert-True -Condition (Test-Path -LiteralPath $canonicalFirefox -PathType Leaf) -Message "The copied Firefox executable is missing."
Assert-True -Condition (Test-Path -LiteralPath $canonicalPackage -PathType Container) -Message "The extracted release package is missing."
Assert-True -Condition (@(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'").Count -eq 0) -Message "Every Firefox process must be closed before release recovery testing."

$profileMarker = Get-Content -Raw -LiteralPath (Join-Path $canonicalProfile ".fennevia-dev-profile.json") | ConvertFrom-Json
$programMarker = Get-Content -Raw -LiteralPath (Join-Path $programRoot ".fennevia-program-spike.json") | ConvertFrom-Json
Assert-True -Condition (
    [int] $profileMarker.schemaVersion -eq 1 -and
    [string] $profileMarker.owner -ceq "fennevia" -and
    [string] $profileMarker.profileName -ceq "fennevia-dev"
) -Message "The development profile marker is not owned by this test."
Assert-True -Condition (
    [int] $programMarker.schemaVersion -eq 1 -and
    [string] $programMarker.owner -ceq "fennevia" -and
    [string] $programMarker.purpose -ceq "firefox-identity-regression" -and
    [string] $programMarker.state -ceq "ready"
) -Message "The copied Firefox program marker is not owned by this test."

$releaseModulePath = Join-Path $canonicalPackage "scripts\lib\FenneviaRelease.psm1"
$installerModulePath = Join-Path $canonicalPackage "scripts\lib\FenneviaInstaller.psm1"
Import-Module $releaseModulePath -Force
try {
    $releaseValidation = Test-FenneviaReleaseTree -PackageRoot $canonicalPackage
    Assert-True -Condition $releaseValidation.Passed -Message "The exact extracted release tree failed validation before recovery testing."
}
finally {
    Remove-Module FenneviaRelease -ErrorAction SilentlyContinue
}
Import-Module $installerModulePath -Force

$programOwnershipPath = Join-Path $programRoot ".fennevia\ownership.json"
$profileOwnershipPath = Join-Path $canonicalProfile ".fennevia\ownership.json"
Assert-True -Condition (Test-Path -LiteralPath $programOwnershipPath -PathType Leaf) -Message "The program ownership record is missing."
Assert-True -Condition (Test-Path -LiteralPath $profileOwnershipPath -PathType Leaf) -Message "The profile ownership record is missing."
$programOwnershipContent = Get-Content -Raw -LiteralPath $programOwnershipPath
$profileOwnershipContent = Get-Content -Raw -LiteralPath $profileOwnershipPath
Assert-True -Condition ($programOwnershipContent -ceq $profileOwnershipContent) -Message "Release recovery requires a byte-identical ownership pair."
$ownership = $profileOwnershipContent | ConvertFrom-Json
Assert-True -Condition ([string] $ownership.packageVersion -ceq [string] $releaseValidation.Version) -Message "Installed ownership does not identify the extracted release version."

$relativeTarget = "chrome/fennevia/content/shell/ShellApp.js"
$ownedRecord = @($ownership.files | Where-Object { $_.scope -ceq "profile" -and $_.path -ceq $relativeTarget })
Assert-True -Condition ($ownedRecord.Count -eq 1) -Message "The frontend failure target must have one ownership record."
$targetPath = [IO.Path]::GetFullPath((Join-Path $canonicalProfile $relativeTarget.Replace("/", "\")))
$sourcePath = [IO.Path]::GetFullPath((Join-Path $canonicalPackage ("profile\" + $relativeTarget.Replace("/", "\"))))
Assert-True -Condition $targetPath.StartsWith($canonicalProfile + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -Message "The failure target escaped the managed profile."
Assert-True -Condition $sourcePath.StartsWith($canonicalPackage + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -Message "The source target escaped the extracted release."
$expectedHash = [string] $ownedRecord[0].sha256
Assert-True -Condition (Test-Path -LiteralPath $targetPath -PathType Leaf) -Message "The installed frontend bundle is missing before failure injection."
Assert-True -Condition ((Get-FileHash -Algorithm SHA256 -LiteralPath $targetPath).Hash.ToLowerInvariant() -ceq $expectedHash) -Message "The installed frontend bundle differs from ownership."
Assert-True -Condition ((Get-FileHash -Algorithm SHA256 -LiteralPath $sourcePath).Hash.ToLowerInvariant() -ceq $expectedHash) -Message "The extracted release source differs from ownership."

$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd("\", "/")
$tempRoot = [IO.Path]::GetFullPath((Join-Path $tempBase ("fennevia-release-recovery-" + [guid]::NewGuid().ToString("N"))))
Assert-True -Condition $tempRoot.StartsWith($tempBase + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -Message "The release recovery temporary root escaped the OS temporary directory."
New-Item -ItemType Directory -Path $tempRoot | Out-Null
$backupPath = Join-Path $tempRoot "ShellApp.js"
Copy-Item -LiteralPath $targetPath -Destination $backupPath

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$harnessPath = Join-Path $repositoryRoot "tests\firefox-window-lifecycle.mjs"
$node = Get-Command node -ErrorAction Stop
$testFailure = $null
try {
    Remove-Item -LiteralPath $targetPath -Force
    $disableResult = Invoke-FenneviaPackageAction `
        -Action Disable `
        -FirefoxPath $canonicalFirefox `
        -ProfilePath $canonicalProfile `
        -PackageRoot $canonicalPackage
    Assert-True -Condition $disableResult.Applied -Message "Hard disable did not apply with the owned frontend bundle missing."

    $updateResult = Invoke-FenneviaPackageAction `
        -Action Update `
        -FirefoxPath $canonicalFirefox `
        -ProfilePath $canonicalProfile `
        -PackageRoot $canonicalPackage
    Assert-True -Condition $updateResult.Applied -Message "Update did not restore the missing exact release byte while preserving disabled state."
    Assert-True -Condition ((Get-FileHash -Algorithm SHA256 -LiteralPath $targetPath).Hash.ToLowerInvariant() -ceq $expectedHash) -Message "Update did not restore the exact release frontend hash."

    & $node.Source $harnessPath `
        --firefox $canonicalFirefox `
        --profile $canonicalProfile `
        --expect-disabled
    Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "The hard-disabled extracted release did not cold-start as stock native Firefox."

    $enableResult = Invoke-FenneviaPackageAction `
        -Action Enable `
        -FirefoxPath $canonicalFirefox `
        -ProfilePath $canonicalProfile `
        -PackageRoot $canonicalPackage
    Assert-True -Condition $enableResult.Applied -Message "Enable did not apply after exact release repair/update."

    & $node.Source $harnessPath --firefox $canonicalFirefox --profile $canonicalProfile
    Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "Ordinary shell startup did not recover after update and enable."
}
catch {
    $testFailure = $_
}
finally {
    Assert-True -Condition (@(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'").Count -eq 0) -Message "Release recovery left a Firefox process running."
    if (-not (Test-Path -LiteralPath $targetPath -PathType Leaf) -or (Get-FileHash -Algorithm SHA256 -LiteralPath $targetPath).Hash.ToLowerInvariant() -cne $expectedHash) {
        Copy-Item -LiteralPath $backupPath -Destination $targetPath -Force
    }
    try {
        $currentOwnership = Get-Content -Raw -LiteralPath $profileOwnershipPath | ConvertFrom-Json
        if ([string] $currentOwnership.state -ceq "disabled") {
            [void] (Invoke-FenneviaPackageAction -Action Update -FirefoxPath $canonicalFirefox -ProfilePath $canonicalProfile -PackageRoot $canonicalPackage)
            [void] (Invoke-FenneviaPackageAction -Action Enable -FirefoxPath $canonicalFirefox -ProfilePath $canonicalProfile -PackageRoot $canonicalPackage)
        }
    }
    catch {
        if ($null -eq $testFailure) {
            $testFailure = $_
        }
    }
    Remove-Item -LiteralPath $backupPath -Force
    Assert-True -Condition (@(Get-ChildItem -Force -LiteralPath $tempRoot).Count -eq 0) -Message "Release recovery temporary content remains."
    Remove-Item -LiteralPath $tempRoot -Force
    Remove-Module FenneviaInstaller, FenneviaRelease -ErrorAction SilentlyContinue
}

if ($null -ne $testFailure) {
    throw $testFailure
}

Assert-True -Condition ((Get-FileHash -Algorithm SHA256 -LiteralPath $targetPath).Hash.ToLowerInvariant() -ceq $expectedHash) -Message "Release recovery did not finish with exact installed bytes."
Write-Output "PASS: exact staged release hard-disable, native cold start, update repair, enable, and recovered lifecycle."
