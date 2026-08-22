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

function Complete-BridgeFixture {
    param(
        [Parameter(Mandatory)]
        [string] $Content,

        [Parameter(Mandatory)]
        [string[]] $ArtifactExportNames,

        [Parameter(Mandatory)]
        [string] $SourceModuleName
    )

    $fixtureExports = @(
        [regex]::Matches($Content, '(?m)^\s*export\s+function\s+([A-Za-z_$][A-Za-z0-9_$]*)') |
            ForEach-Object { [string] $_.Groups[1].Value }
    )
    $passthroughExports = @(
        $ArtifactExportNames |
            Where-Object { $fixtureExports -cnotcontains $_ } |
            Sort-Object
    )
    Assert-True -Condition ($passthroughExports.Count -gt 0) -Message "The bridge fixture must retain non-target production exports."
    $exportStatement = "export { $($passthroughExports -join ', ') } from `"./$SourceModuleName`";"
    return $Content + [Environment]::NewLine + $exportStatement + [Environment]::NewLine
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
Assert-True -Condition (@(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'").Count -eq 0) -Message "Every Firefox process must be closed before bridge recovery testing."

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
$relativeTarget = "chrome/fennevia/content/firefox/BridgeBoundary.sys.mjs"
$fileEntry = @($manifest.files | Where-Object { $_.path -ceq $relativeTarget })
Assert-True -Condition ($fileEntry.Count -eq 1) -Message "The bridge recovery target must have one package-manifest entry."
$expectedHash = [string] $fileEntry[0].sha256
$targetPath = [IO.Path]::GetFullPath((Join-Path $canonicalProfile ($relativeTarget.Replace("/", "\"))))
Assert-True -Condition $targetPath.StartsWith($canonicalProfile + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -Message "The bridge recovery target escaped the managed profile."
Assert-True -Condition (Test-Path -LiteralPath $targetPath -PathType Leaf) -Message "The installed bridge artifact is missing."
Assert-True -Condition ((Get-FileHash -Algorithm SHA256 -LiteralPath $targetPath).Hash.ToLowerInvariant() -ceq $expectedHash) -Message "The installed bridge artifact does not match the committed package hash."

$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd("\", "/")
$tempRoot = [IO.Path]::GetFullPath((Join-Path $tempBase ("fennevia-bridge-recovery-" + [guid]::NewGuid().ToString("N"))))
Assert-True -Condition $tempRoot.StartsWith($tempBase + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -Message "The temporary recovery root escaped the operating-system temporary directory."
New-Item -ItemType Directory -Path $tempRoot | Out-Null
$bridgeBackupPath = Join-Path $tempRoot "BridgeBoundary.sys.mjs"
Copy-Item -LiteralPath $targetPath -Destination $bridgeBackupPath
$artifactContent = Get-Content -Raw -LiteralPath $bridgeBackupPath
$artifactExportBlock = [regex]::Match($artifactContent, '(?s)export\s*\{(?<body>[^{}]+)\};\s*$')
Assert-True -Condition $artifactExportBlock.Success -Message "The generated bridge artifact has no terminal static export block."
$artifactExportNames = @(
    $artifactExportBlock.Groups['body'].Value.Split(',') |
        ForEach-Object {
            $entry = $_.Trim()
            $alias = [regex]::Match($entry, '\bas\s+([A-Za-z_$][A-Za-z0-9_$]*)$')
            if ($alias.Success) {
                [string] $alias.Groups[1].Value
            }
            elseif ($entry -match '^[A-Za-z_$][A-Za-z0-9_$]*$') {
                $entry
            }
        } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        Sort-Object -Unique
)
Assert-True -Condition ($artifactExportNames.Count -gt 0) -Message "The generated bridge export allowlist is empty."
$sourceModuleName = "BridgeBoundary.recovery-source.sys.mjs"
$sourceModulePath = [IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $targetPath) $sourceModuleName))
Assert-True -Condition $sourceModulePath.StartsWith($canonicalProfile + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -Message "The bridge recovery source module escaped the managed profile."
Assert-True -Condition (-not (Test-Path -LiteralPath $sourceModulePath)) -Message "A stale bridge recovery source module already exists."
Copy-Item -LiteralPath $bridgeBackupPath -Destination $sourceModulePath

$node = Get-Command node -ErrorAction Stop
$harnessPath = Join-Path $repositoryRoot "tests\firefox-window-lifecycle.mjs"
$testFailure = $null

function New-RecoveryCapabilityBridgeFixture {
    param(
        [Parameter(Mandatory)]
        [string] $FactoryName,

        [Parameter(Mandatory)]
        [string] $Code,

        [Parameter(Mandatory)]
        [string] $Phase,

        [Parameter(Mandatory)]
        [string] $Symbol,

        [Parameter(Mandatory)]
        [string] $SourceModuleName
    )

    return @"
import { $FactoryName as createRecoverySourceBridge } from "./$SourceModuleName";

function createRecoveryCapabilityError(boundary) {
  const context = boundary.snapshot();
  const error = new Error("$Code");
  Object.defineProperties(error, {
    fenneviaBuildId: { value: context.buildId, enumerable: false },
    fenneviaCode: { value: "$Code", enumerable: false },
    fenneviaFirefoxVersion: { value: context.firefoxVersion, enumerable: false },
    fenneviaPhase: { value: "$Phase", enumerable: false },
    fenneviaSymbol: { value: "$Symbol", enumerable: false },
    fenneviaWindowKind: { value: context.windowKind, enumerable: false },
    name: { value: "FenneviaFirefoxRecoveryCapabilityError", enumerable: false },
  });
  return error;
}

export function $FactoryName(options) {
  const bridge = createRecoverySourceBridge(options);
  return Object.freeze({
    ...bridge,
    assertRequiredCapabilities() {
      throw createRecoveryCapabilityError(options.boundary);
    },
  });
}
"@
}

$missingCapabilityBridge = @"
import { createFirefoxBridgeBoundary as createRecoverySourceBridge } from "./$sourceModuleName";

export function createFirefoxBridgeBoundary(options) {
  const bridge = createRecoverySourceBridge(options);
  return Object.freeze({
    ...bridge,
    assertRequiredCapabilities() {
      const context = bridge.snapshot();
      const error = new Error("FENNEVIA_FIREFOX_CAPABILITY_MISSING");
      Object.defineProperties(error, {
        fenneviaBuildId: { value: context.buildId, enumerable: false },
        fenneviaCode: { value: "FENNEVIA_FIREFOX_CAPABILITY_MISSING", enumerable: false },
        fenneviaFirefoxVersion: { value: context.firefoxVersion, enumerable: false },
        fenneviaPhase: { value: "firefox-bridge-capability", enumerable: false },
        fenneviaSymbol: { value: "window.gBrowser", enumerable: false },
        fenneviaWindowKind: { value: context.windowKind, enumerable: false },
        name: { value: "FenneviaFirefoxBridgeRecoveryError", enumerable: false },
      });
      throw error;
    },
  });
}
"@
$missingBookmarksCapabilityBridge = New-RecoveryCapabilityBridgeFixture `
    -FactoryName "createFirefoxBookmarksBridge" `
    -Code "FENNEVIA_FIREFOX_BOOKMARKS_CAPABILITY_MISSING" `
    -Phase "firefox-bookmarks-capability" `
    -Symbol "PlacesUtils.bookmarks.fetch" `
    -SourceModuleName $sourceModuleName
$missingDownloadsCapabilityBridge = New-RecoveryCapabilityBridgeFixture `
    -FactoryName "createFirefoxDownloadsBridge" `
    -Code "FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING" `
    -Phase "firefox-downloads-capability" `
    -Symbol "DownloadList.addView" `
    -SourceModuleName $sourceModuleName
$missingTabsCapabilityBridge = New-RecoveryCapabilityBridgeFixture `
    -FactoryName "createFirefoxTabsBridge" `
    -Code "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING" `
    -Phase "firefox-tabs-capability" `
    -Symbol "window.gBrowser.openTabs" `
    -SourceModuleName $sourceModuleName
$missingNavigationCapabilityBridge = New-RecoveryCapabilityBridgeFixture `
    -FactoryName "createFirefoxNavigationBridge" `
    -Code "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING" `
    -Phase "firefox-navigation-capability" `
    -Symbol "window.gBrowser.removeTabsProgressListener" `
    -SourceModuleName $sourceModuleName
$missingUrlbarCoverageCapabilityBridge = New-RecoveryCapabilityBridgeFixture `
    -FactoryName "createFirefoxUrlbarCoverageBridge" `
    -Code "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING" `
    -Phase "firefox-urlbar-coverage-capability" `
    -Symbol "window.openLocation" `
    -SourceModuleName $sourceModuleName

$missingCapabilityBridge = Complete-BridgeFixture -Content $missingCapabilityBridge -ArtifactExportNames $artifactExportNames -SourceModuleName $sourceModuleName
$missingBookmarksCapabilityBridge = Complete-BridgeFixture -Content $missingBookmarksCapabilityBridge -ArtifactExportNames $artifactExportNames -SourceModuleName $sourceModuleName
$missingDownloadsCapabilityBridge = Complete-BridgeFixture -Content $missingDownloadsCapabilityBridge -ArtifactExportNames $artifactExportNames -SourceModuleName $sourceModuleName
$missingTabsCapabilityBridge = Complete-BridgeFixture -Content $missingTabsCapabilityBridge -ArtifactExportNames $artifactExportNames -SourceModuleName $sourceModuleName
$missingNavigationCapabilityBridge = Complete-BridgeFixture -Content $missingNavigationCapabilityBridge -ArtifactExportNames $artifactExportNames -SourceModuleName $sourceModuleName
$missingUrlbarCoverageCapabilityBridge = Complete-BridgeFixture -Content $missingUrlbarCoverageCapabilityBridge -ArtifactExportNames $artifactExportNames -SourceModuleName $sourceModuleName

try {
    Write-Utf8NoBom -Path $targetPath -Content $missingCapabilityBridge
    & $node.Source $harnessPath --firefox $canonicalFirefox --profile $canonicalProfile --expect-bridge-fail-open
    Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "A missing required bridge capability did not fail open at the shell health boundary."

    Write-Utf8NoBom -Path $targetPath -Content $missingBookmarksCapabilityBridge
    & $node.Source $harnessPath --firefox $canonicalFirefox --profile $canonicalProfile --expect-bookmarks-bridge-fail-open
    Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "A missing required bookmarks capability did not fail open at the shell health boundary."

    Write-Utf8NoBom -Path $targetPath -Content $missingDownloadsCapabilityBridge
    & $node.Source $harnessPath --firefox $canonicalFirefox --profile $canonicalProfile --expect-downloads-bridge-fail-open
    Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "A missing required downloads capability did not fail open at the shell health boundary."

    Write-Utf8NoBom -Path $targetPath -Content $missingTabsCapabilityBridge
    & $node.Source $harnessPath --firefox $canonicalFirefox --profile $canonicalProfile --expect-tabs-bridge-fail-open
    Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "A missing required tabs capability did not fail open at the shell health boundary."

    Write-Utf8NoBom -Path $targetPath -Content $missingNavigationCapabilityBridge
    & $node.Source $harnessPath --firefox $canonicalFirefox --profile $canonicalProfile --expect-navigation-bridge-fail-open
    Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "A missing required navigation capability did not fail open at the shell health boundary."

    Write-Utf8NoBom -Path $targetPath -Content $missingUrlbarCoverageCapabilityBridge
    & $node.Source $harnessPath --firefox $canonicalFirefox --profile $canonicalProfile --expect-urlbar-coverage-bridge-fail-open
    Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "A missing required Urlbar coverage capability did not fail open at the shell health boundary."

    Copy-Item -LiteralPath $bridgeBackupPath -Destination $targetPath -Force
    & $node.Source $harnessPath --firefox $canonicalFirefox --profile $canonicalProfile
    Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "Ordinary bridge startup did not recover after exact artifact restoration."
}
catch {
    $testFailure = $_
}
finally {
    Copy-Item -LiteralPath $bridgeBackupPath -Destination $targetPath -Force
    Assert-True -Condition ((Get-FileHash -Algorithm SHA256 -LiteralPath $targetPath).Hash.ToLowerInvariant() -ceq $expectedHash) -Message "Bridge recovery cleanup did not restore the exact committed artifact."
    if (Test-Path -LiteralPath $sourceModulePath -PathType Leaf) {
        Remove-Item -LiteralPath $sourceModulePath -Force
    }
    Assert-True -Condition (-not (Test-Path -LiteralPath $sourceModulePath)) -Message "The temporary bridge recovery source module remains installed."
    Remove-Item -LiteralPath $bridgeBackupPath -Force
    Assert-True -Condition (@(Get-ChildItem -LiteralPath $tempRoot -Force).Count -eq 0) -Message "The temporary bridge recovery directory is not empty."
    Remove-Item -LiteralPath $tempRoot -Force
}

if ($testFailure) {
    throw $testFailure
}

Assert-True -Condition (@(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'").Count -eq 0) -Message "The bridge recovery matrix left a Firefox process running."
Write-Output "PASS: missing boundary, bookmarks, downloads, tabs, navigation, and Urlbar coverage capabilities failed open, then exact restoration recovered ordinary startup."
