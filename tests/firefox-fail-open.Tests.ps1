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

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$canonicalFirefox = [IO.Path]::GetFullPath($FirefoxPath)
$canonicalProfile = [IO.Path]::GetFullPath($ProfilePath).TrimEnd("\", "/")
$managedRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA "fennevia")).TrimEnd("\", "/")
$programRoot = Split-Path -Parent $canonicalFirefox
$profilePrefix = [IO.Path]::GetFullPath((Join-Path $managedRoot "profiles")).TrimEnd("\", "/") + [IO.Path]::DirectorySeparatorChar
$programPrefix = [IO.Path]::GetFullPath((Join-Path $managedRoot "program-spikes")).TrimEnd("\", "/") + [IO.Path]::DirectorySeparatorChar

Assert-True -Condition $canonicalProfile.StartsWith($profilePrefix, [StringComparison]::OrdinalIgnoreCase) -Message "The failure-injection profile must remain below the Fennevia managed profile root."
Assert-True -Condition $programRoot.StartsWith($programPrefix, [StringComparison]::OrdinalIgnoreCase) -Message "The failure-injection program must remain below the Fennevia copied-program root."
$profileMarkerPath = Join-Path $canonicalProfile ".fennevia-dev-profile.json"
$programMarkerPath = Join-Path $programRoot ".fennevia-program-spike.json"
Assert-True -Condition (Test-Path -LiteralPath $profileMarkerPath -PathType Leaf) -Message "The development profile marker is missing."
Assert-True -Condition (Test-Path -LiteralPath $programMarkerPath -PathType Leaf) -Message "The copied Firefox program marker is missing."
$profileMarker = Get-Content -Raw -LiteralPath $profileMarkerPath | ConvertFrom-Json
$programMarker = Get-Content -Raw -LiteralPath $programMarkerPath | ConvertFrom-Json
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
Assert-True -Condition (@(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'").Count -eq 0) -Message "Every Firefox process must be closed before failure injection."

$manifestPath = Join-Path $repositoryRoot "package-manifest.json"
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$relativeTarget = "chrome/fennevia/content/runtime/WindowManager.sys.mjs"
$fileEntry = @($manifest.files | Where-Object { $_.path -ceq $relativeTarget })
Assert-True -Condition ($fileEntry.Count -eq 1) -Message "The failure-injection target must have one package-manifest entry."
$expectedHash = [string] $fileEntry[0].sha256
$targetPath = [IO.Path]::GetFullPath((Join-Path $canonicalProfile ($relativeTarget.Replace("/", "\"))))
Assert-True -Condition $targetPath.StartsWith($canonicalProfile + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -Message "The failure-injection target escaped the managed profile."
Assert-True -Condition (Test-Path -LiteralPath $targetPath -PathType Leaf) -Message "The installed WindowManager target is missing."
$beforeHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $targetPath).Hash.ToLowerInvariant()
Assert-True -Condition ($beforeHash -ceq $expectedHash) -Message "The installed WindowManager does not match the committed package hash."

$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd("\", "/")
$tempRoot = [IO.Path]::GetFullPath((Join-Path $tempBase ("fennevia-issue5-failure-" + [guid]::NewGuid().ToString("N"))))
Assert-True -Condition $tempRoot.StartsWith($tempBase + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -Message "The temporary failure-injection root escaped the operating-system temporary directory."
New-Item -ItemType Directory -Path $tempRoot | Out-Null
$backupPath = Join-Path $tempRoot "WindowManager.sys.mjs"
$testExitCode = 1

try {
    Move-Item -LiteralPath $targetPath -Destination $backupPath
    $node = Get-Command node -ErrorAction Stop
    & $node.Source `
        (Join-Path $repositoryRoot "tests\firefox-window-lifecycle.mjs") `
        --firefox $canonicalFirefox `
        --profile $canonicalProfile `
        --expect-fail-open
    $testExitCode = $LASTEXITCODE
}
finally {
    if ((Test-Path -LiteralPath $backupPath -PathType Leaf) -and -not (Test-Path -LiteralPath $targetPath)) {
        Move-Item -LiteralPath $backupPath -Destination $targetPath
    }

    if (Test-Path -LiteralPath $backupPath) {
        throw "Failure-injection recovery left the backup file unresolved."
    }
    if (Test-Path -LiteralPath $tempRoot) {
        Assert-True -Condition (@(Get-ChildItem -LiteralPath $tempRoot -Force).Count -eq 0) -Message "The temporary failure-injection directory is not empty."
        Remove-Item -LiteralPath $tempRoot -Force
    }
}

Assert-True -Condition ($testExitCode -eq 0) -Message "The real-Firefox fail-open probe failed."
$afterHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $targetPath).Hash.ToLowerInvariant()
Assert-True -Condition ($afterHash -ceq $expectedHash) -Message "The WindowManager was not restored byte-identically."
Assert-True -Condition (@(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'").Count -eq 0) -Message "The fail-open probe left a Firefox process running."

Write-Output "PASS: missing lifecycle module failed open and the owned artifact was restored byte-identically."
