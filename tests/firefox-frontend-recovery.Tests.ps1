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
        [string] $Content
    )

    [IO.File]::WriteAllText($Path, $Content, (New-Object Text.UTF8Encoding($false)))
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
Assert-True -Condition (@(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'").Count -eq 0) -Message "Every Firefox process must be closed before frontend recovery testing."

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

$manifest = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot "package-manifest.json") | ConvertFrom-Json
$relativeTarget = "chrome/fennevia/content/shell/ShellApp.js"
$fileEntry = @($manifest.files | Where-Object { $_.path -ceq $relativeTarget })
Assert-True -Condition ($fileEntry.Count -eq 1) -Message "The frontend recovery target must have one package-manifest entry."
$expectedHash = [string] $fileEntry[0].sha256
$targetPath = [IO.Path]::GetFullPath((Join-Path $canonicalProfile ($relativeTarget.Replace("/", "\"))))
Assert-True -Condition $targetPath.StartsWith($canonicalProfile + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -Message "The frontend recovery target escaped the managed profile."
Assert-True -Condition (Test-Path -LiteralPath $targetPath -PathType Leaf) -Message "The installed frontend bundle is missing."
Assert-True -Condition ((Get-FileHash -Algorithm SHA256 -LiteralPath $targetPath).Hash.ToLowerInvariant() -ceq $expectedHash) -Message "The installed frontend bundle does not match the committed package hash."

$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd("\", "/")
$tempRoot = [IO.Path]::GetFullPath((Join-Path $tempBase ("fennevia-issue8-frontend-recovery-" + [guid]::NewGuid().ToString("N"))))
Assert-True -Condition $tempRoot.StartsWith($tempBase + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -Message "The temporary recovery root escaped the operating-system temporary directory."
New-Item -ItemType Directory -Path $tempRoot | Out-Null
$bundleBackupPath = Join-Path $tempRoot "ShellApp.js"
Copy-Item -LiteralPath $targetPath -Destination $bundleBackupPath

$node = Get-Command node -ErrorAction Stop
$harnessPath = Join-Path $repositoryRoot "tests\firefox-window-lifecycle.mjs"
$testFailure = $null
$throwingBundle = @'
(function () {
  "use strict";
  const registration = globalThis.__fenneviaRegisterShellFrontend;
  if (typeof registration !== "function") {
    throw new Error("FENNEVIA_FRONTEND_REGISTRATION_UNAVAILABLE");
  }
  const mountShellApp = () => {
    const error = new Error("FENNEVIA_TEST_FRONTEND_MOUNT_FAILED");
    error.name = "FenneviaFrontendTestError";
    Object.defineProperties(error, {
      fenneviaCode: {
        enumerable: false,
        value: "FENNEVIA_TEST_FRONTEND_MOUNT_FAILED",
      },
      fenneviaPhase: {
        enumerable: false,
        value: "shell-frontend-mount",
      },
    });
    throw error;
  };
  registration(
    Object.freeze({
      getShellAppCapabilities() {
        return Object.freeze([]);
      },
      mountShellApp,
      verifyShellAppHealth() {
        return true;
      },
    })
  );
})();
'@

try {
    Remove-Item -LiteralPath $targetPath -Force
    & $node.Source $harnessPath --firefox $canonicalFirefox --profile $canonicalProfile --expect-shell-missing-fail-open
    Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "A missing frontend bundle did not fail open at the window boundary."

    Copy-Item -LiteralPath $bundleBackupPath -Destination $targetPath
    Write-Utf8NoBom -Path $targetPath -Content $throwingBundle
    & $node.Source $harnessPath --firefox $canonicalFirefox --profile $canonicalProfile --expect-shell-fail-open
    Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "A throwing frontend bundle did not fail open at the window boundary."

    Copy-Item -LiteralPath $bundleBackupPath -Destination $targetPath -Force
    & $node.Source $harnessPath --firefox $canonicalFirefox --profile $canonicalProfile
    Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "Ordinary frontend startup did not recover after artifact restoration."
}
catch {
    $testFailure = $_
}
finally {
    Copy-Item -LiteralPath $bundleBackupPath -Destination $targetPath -Force
    Assert-True -Condition ((Get-FileHash -Algorithm SHA256 -LiteralPath $targetPath).Hash.ToLowerInvariant() -ceq $expectedHash) -Message "Frontend recovery cleanup did not restore the exact committed bundle."
    Remove-Item -LiteralPath $bundleBackupPath -Force
    Assert-True -Condition (@(Get-ChildItem -LiteralPath $tempRoot -Force).Count -eq 0) -Message "The temporary frontend recovery directory is not empty."
    Remove-Item -LiteralPath $tempRoot -Force
}

if ($testFailure) {
    throw $testFailure
}

Assert-True -Condition (@(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'").Count -eq 0) -Message "The frontend recovery matrix left a Firefox process running."
Write-Output "PASS: missing and throwing frontend bundles failed open, then exact restoration recovered ordinary startup."
