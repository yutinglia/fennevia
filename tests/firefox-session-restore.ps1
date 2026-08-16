#requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string] $FirefoxPath,

    [Parameter(Mandatory)]
    [string] $ProfilePath
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

function Invoke-SessionRestorePhase {
    param(
        [Parameter(Mandatory)]
        [string] $Mode,

        [Parameter(Mandatory)]
        [string] $FailureMessage
    )

    Write-Output "RUN: persisted session restore $Mode"
    & $script:NodePath $script:HarnessPath `
        --firefox $script:CanonicalFirefox `
        --profile $script:CanonicalProfile `
        --session-restore $Mode
    Assert-True -Condition ($LASTEXITCODE -eq 0) -Message $FailureMessage
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$script:CanonicalFirefox = [IO.Path]::GetFullPath($FirefoxPath)
$script:CanonicalProfile = [IO.Path]::GetFullPath($ProfilePath).TrimEnd("\", "/")
$managedRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA "fennevia")).TrimEnd("\", "/")
$programRoot = Split-Path -Parent $script:CanonicalFirefox
$profilePrefix = [IO.Path]::GetFullPath((Join-Path $managedRoot "profiles")).TrimEnd("\", "/") + [IO.Path]::DirectorySeparatorChar
$programPrefix = [IO.Path]::GetFullPath((Join-Path $managedRoot "program-spikes")).TrimEnd("\", "/") + [IO.Path]::DirectorySeparatorChar

Assert-True -Condition $script:CanonicalProfile.StartsWith($profilePrefix, [StringComparison]::OrdinalIgnoreCase) -Message "The rehearsal profile must remain below the Fennevia managed profile root."
Assert-True -Condition $programRoot.StartsWith($programPrefix, [StringComparison]::OrdinalIgnoreCase) -Message "The rehearsal program must remain below the Fennevia copied-program root."
Assert-True -Condition (Test-Path -LiteralPath $script:CanonicalFirefox -PathType Leaf) -Message "The copied Firefox executable is missing."
Assert-True -Condition (@(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'").Count -eq 0) -Message "Every Firefox process must be closed before the session-restore rehearsal."

$profileMarkerPath = Join-Path $script:CanonicalProfile ".fennevia-dev-profile.json"
$programMarkerPath = Join-Path $programRoot ".fennevia-program-spike.json"
Assert-True -Condition (Test-Path -LiteralPath $profileMarkerPath -PathType Leaf) -Message "The development profile marker is missing."
Assert-True -Condition (Test-Path -LiteralPath $programMarkerPath -PathType Leaf) -Message "The copied-program marker is missing."
$profileMarker = Get-Content -Raw -LiteralPath $profileMarkerPath | ConvertFrom-Json
$programMarker = Get-Content -Raw -LiteralPath $programMarkerPath | ConvertFrom-Json
Assert-True -Condition (
    [int] $profileMarker.schemaVersion -eq 1 -and
    [string] $profileMarker.owner -ceq "fennevia" -and
    [string] $profileMarker.profileName -ceq "fennevia-dev"
) -Message "The development profile marker is not owned by this rehearsal."
Assert-True -Condition (
    [int] $programMarker.schemaVersion -eq 1 -and
    [string] $programMarker.owner -ceq "fennevia" -and
    [string] $programMarker.purpose -ceq "firefox-identity-regression" -and
    [string] $programMarker.state -ceq "ready"
) -Message "The copied Firefox program marker is not owned by this rehearsal."

$statePath = [IO.Path]::GetFullPath((Join-Path $script:CanonicalProfile ".fennevia-session-restore-rehearsal.json"))
Assert-True -Condition $statePath.StartsWith($script:CanonicalProfile + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -Message "The rehearsal state escaped the managed profile."
Assert-True -Condition (-not (Test-Path -LiteralPath $statePath)) -Message "FENNEVIA_SESSION_RESTORE_STATE_STALE; run the documented cleanup mode before starting again."

$manifest = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot "package-manifest.json") | ConvertFrom-Json
$relativeTarget = "chrome/fennevia/content/shell/ShellApp.js"
$fileEntry = @($manifest.files | Where-Object { $_.path -ceq $relativeTarget })
Assert-True -Condition ($fileEntry.Count -eq 1) -Message "The fail-open target must have one package-manifest entry."
$expectedHash = [string] $fileEntry[0].sha256
$targetPath = [IO.Path]::GetFullPath((Join-Path $script:CanonicalProfile ($relativeTarget.Replace("/", "\"))))
Assert-True -Condition $targetPath.StartsWith($script:CanonicalProfile + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -Message "The fail-open target escaped the managed profile."
Assert-True -Condition (Test-Path -LiteralPath $targetPath -PathType Leaf) -Message "The installed frontend bundle is missing."
Assert-True -Condition ((Get-FileHash -Algorithm SHA256 -LiteralPath $targetPath).Hash.ToLowerInvariant() -ceq $expectedHash) -Message "The installed frontend bundle does not match the committed package hash."

$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd("\", "/")
$tempRoot = [IO.Path]::GetFullPath((Join-Path $tempBase ("fennevia-session-restore-" + [guid]::NewGuid().ToString("N"))))
Assert-True -Condition $tempRoot.StartsWith($tempBase + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -Message "The temporary rehearsal root escaped the operating-system temporary directory."
New-Item -ItemType Directory -Path $tempRoot | Out-Null
$bundleBackupPath = Join-Path $tempRoot "ShellApp.js"
Copy-Item -LiteralPath $targetPath -Destination $bundleBackupPath

$node = Get-Command node -ErrorAction Stop
$script:NodePath = $node.Source
$script:HarnessPath = Join-Path $repositoryRoot "tests\firefox-window-lifecycle.mjs"
$testFailure = $null
$cleanupFailure = $null
$bundleRestored = $false

try {
    Invoke-SessionRestorePhase -Mode "prepare" -FailureMessage "Firefox did not persist the fixed synthetic session."
    Invoke-SessionRestorePhase -Mode "verify" -FailureMessage "A new Firefox process did not restore the fixed synthetic session."

    Remove-Item -LiteralPath $targetPath -Force
    Invoke-SessionRestorePhase -Mode "fail-open" -FailureMessage "The restored session did not remain usable during frontend fail-open."
}
catch {
    $testFailure = $_
}
finally {
    try {
        Copy-Item -LiteralPath $bundleBackupPath -Destination $targetPath -Force
        Assert-True -Condition ((Get-FileHash -Algorithm SHA256 -LiteralPath $targetPath).Hash.ToLowerInvariant() -ceq $expectedHash) -Message "Session-restore cleanup did not restore the exact frontend bundle."
        $bundleRestored = $true

        if (Test-Path -LiteralPath $statePath -PathType Leaf) {
            Invoke-SessionRestorePhase -Mode "cleanup" -FailureMessage "The rehearsal did not restore its preference and one-tab baseline."
        }
        Assert-True -Condition (-not (Test-Path -LiteralPath $statePath)) -Message "The rehearsal state marker remains after cleanup."
        Assert-True -Condition (@(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'").Count -eq 0) -Message "The session-restore rehearsal left a Firefox process running."
    }
    catch {
        $cleanupFailure = $_
    }

    if ($bundleRestored) {
        Remove-Item -LiteralPath $bundleBackupPath -Force
        Assert-True -Condition (@(Get-ChildItem -LiteralPath $tempRoot -Force).Count -eq 0) -Message "The temporary rehearsal directory is not empty."
        Remove-Item -LiteralPath $tempRoot -Force
    }
}

if ($testFailure) {
    throw $testFailure
}
if ($cleanupFailure) {
    throw $cleanupFailure
}

Write-Output "PASS: persisted native/Fennevia session restore, lazy tabs, fail-open usability, and exact baseline cleanup passed."
