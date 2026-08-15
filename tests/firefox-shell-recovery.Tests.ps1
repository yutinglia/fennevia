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

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory)]
        [string] $Path,

        [Parameter(Mandatory)]
        [AllowEmptyString()]
        [string] $Content
    )

    [IO.File]::WriteAllText($Path, $Content, (New-Object Text.UTF8Encoding($false)))
}

function Add-UserPreferenceOverride {
    param(
        [Parameter(Mandatory)]
        [string] $OriginalContent,

        [Parameter(Mandatory)]
        [bool] $Enabled
    )

    $prefix = $OriginalContent
    if ($prefix.Length -gt 0 -and -not $prefix.EndsWith("`n") -and -not $prefix.EndsWith("`r")) {
        $prefix += [Environment]::NewLine
    }
    $value = if ($Enabled) { "true" } else { "false" }
    return $prefix + 'user_pref("fennevia.safeStart", ' + $value + ");" + [Environment]::NewLine
}

function Set-PersistedSafeStartFalse {
    param(
        [Parameter(Mandatory)]
        [string] $PrefsPath
    )

    $content = if (Test-Path -LiteralPath $PrefsPath -PathType Leaf) {
        [IO.File]::ReadAllText($PrefsPath)
    }
    else {
        ""
    }
    $pattern = '(?m)^user_pref\("fennevia\.safeStart",\s*(?:true|false)\);\r?\n?'
    $content = [regex]::Replace($content, $pattern, "")
    if ($content.Length -gt 0 -and -not $content.EndsWith("`n") -and -not $content.EndsWith("`r")) {
        $content += [Environment]::NewLine
    }
    $content += 'user_pref("fennevia.safeStart", false);' + [Environment]::NewLine
    Write-Utf8NoBom -Path $PrefsPath -Content $content
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$canonicalFirefox = [IO.Path]::GetFullPath($FirefoxPath)
$canonicalProfile = [IO.Path]::GetFullPath($ProfilePath).TrimEnd("\", "/")
$managedRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA "fennevia")).TrimEnd("\", "/")
$programRoot = Split-Path -Parent $canonicalFirefox
$profilePrefix = [IO.Path]::GetFullPath((Join-Path $managedRoot "profiles")).TrimEnd("\", "/") + [IO.Path]::DirectorySeparatorChar
$programPrefix = [IO.Path]::GetFullPath((Join-Path $managedRoot "program-spikes")).TrimEnd("\", "/") + [IO.Path]::DirectorySeparatorChar

Assert-True -Condition $canonicalProfile.StartsWith($profilePrefix, [StringComparison]::OrdinalIgnoreCase) -Message "The recovery profile must remain below the Fennevia managed profile root."
Assert-True -Condition $programRoot.StartsWith($programPrefix, [StringComparison]::OrdinalIgnoreCase) -Message "The recovery program must remain below the Fennevia copied-program root."
Assert-True -Condition (Test-Path -LiteralPath $canonicalFirefox -PathType Leaf) -Message "The copied Firefox executable is missing."
Assert-True -Condition (@(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'").Count -eq 0) -Message "Every Firefox process must be closed before recovery testing."

$profileMarkerPath = Join-Path $canonicalProfile ".fennevia-dev-profile.json"
$programMarkerPath = Join-Path $programRoot ".fennevia-program-spike.json"
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

$manifestPath = Join-Path $repositoryRoot "package-manifest.json"
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$relativeTarget = "chrome/fennevia/content/runtime/HealthState.sys.mjs"
$fileEntry = @($manifest.files | Where-Object { $_.path -ceq $relativeTarget })
Assert-True -Condition ($fileEntry.Count -eq 1) -Message "The recovery target must have one package-manifest entry."
$expectedHash = [string] $fileEntry[0].sha256
$targetPath = [IO.Path]::GetFullPath((Join-Path $canonicalProfile ($relativeTarget.Replace("/", "\"))))
Assert-True -Condition $targetPath.StartsWith($canonicalProfile + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -Message "The recovery target escaped the managed profile."
Assert-True -Condition (Test-Path -LiteralPath $targetPath -PathType Leaf) -Message "The installed health-state module is missing."
Assert-True -Condition ((Get-FileHash -Algorithm SHA256 -LiteralPath $targetPath).Hash.ToLowerInvariant() -ceq $expectedHash) -Message "The installed health-state module does not match the committed package hash."

$userJsPath = Join-Path $canonicalProfile "user.js"
$prefsJsPath = Join-Path $canonicalProfile "prefs.js"
$hadUserJs = Test-Path -LiteralPath $userJsPath -PathType Leaf
$originalUserJs = if ($hadUserJs) { [IO.File]::ReadAllText($userJsPath) } else { "" }
Assert-True -Condition ($originalUserJs -notmatch 'fennevia\.safeStart') -Message "The existing user.js already owns the safe-start preference; refusing to overwrite its policy."

$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd("\", "/")
$tempRoot = [IO.Path]::GetFullPath((Join-Path $tempBase ("fennevia-issue7-recovery-" + [guid]::NewGuid().ToString("N"))))
Assert-True -Condition $tempRoot.StartsWith($tempBase + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -Message "The temporary recovery root escaped the operating-system temporary directory."
New-Item -ItemType Directory -Path $tempRoot | Out-Null
$moduleBackupPath = Join-Path $tempRoot "HealthState.sys.mjs"
$userJsBackupPath = Join-Path $tempRoot "user.js"
if ($hadUserJs) {
    Copy-Item -LiteralPath $userJsPath -Destination $userJsBackupPath
}

$node = Get-Command node -ErrorAction Stop
$harnessPath = Join-Path $repositoryRoot "tests\firefox-window-lifecycle.mjs"
$testFailure = $null

try {
    Write-Utf8NoBom -Path $userJsPath -Content (Add-UserPreferenceOverride -OriginalContent $originalUserJs -Enabled $true)
    & $node.Source $harnessPath --firefox $canonicalFirefox --profile $canonicalProfile --expect-safe-start
    Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "Safe start with the complete package failed."

    Assert-True -Condition (@(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'").Count -eq 0) -Message "The first safe-start run left a Firefox process running."
    Move-Item -LiteralPath $targetPath -Destination $moduleBackupPath
    & $node.Source $harnessPath --firefox $canonicalFirefox --profile $canonicalProfile --expect-safe-start
    Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "Safe start with a broken package failed."

    Move-Item -LiteralPath $moduleBackupPath -Destination $targetPath
    Write-Utf8NoBom -Path $userJsPath -Content (Add-UserPreferenceOverride -OriginalContent $originalUserJs -Enabled $false)
    & $node.Source $harnessPath --firefox $canonicalFirefox --profile $canonicalProfile
    Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "Ordinary startup did not recover after safe start."
}
catch {
    $testFailure = $_
}
finally {
    if ((Test-Path -LiteralPath $moduleBackupPath -PathType Leaf) -and -not (Test-Path -LiteralPath $targetPath)) {
        Move-Item -LiteralPath $moduleBackupPath -Destination $targetPath
    }
    if (Test-Path -LiteralPath $moduleBackupPath) {
        throw "Recovery cleanup left the health-state backup unresolved."
    }

    if ($hadUserJs) {
        Copy-Item -LiteralPath $userJsBackupPath -Destination $userJsPath -Force
    }
    elseif (Test-Path -LiteralPath $userJsPath) {
        Remove-Item -LiteralPath $userJsPath -Force
    }
    Set-PersistedSafeStartFalse -PrefsPath $prefsJsPath

    if (Test-Path -LiteralPath $userJsBackupPath) {
        Remove-Item -LiteralPath $userJsBackupPath -Force
    }
    Assert-True -Condition (@(Get-ChildItem -LiteralPath $tempRoot -Force).Count -eq 0) -Message "The temporary recovery directory is not empty."
    Remove-Item -LiteralPath $tempRoot -Force
}

if ($testFailure) {
    throw $testFailure
}

Assert-True -Condition ((Get-FileHash -Algorithm SHA256 -LiteralPath $targetPath).Hash.ToLowerInvariant() -ceq $expectedHash) -Message "The health-state module was not restored byte-identically."
Assert-True -Condition ((Get-Content -Raw -LiteralPath $prefsJsPath) -match 'user_pref\("fennevia\.safeStart", false\);') -Message "The development profile did not finish with safe start disabled."
Assert-True -Condition (@(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'").Count -eq 0) -Message "The recovery matrix left a Firefox process running."

Write-Output "PASS: safe start bypassed complete and broken packages, then ordinary startup recovered with exact artifact restoration."
