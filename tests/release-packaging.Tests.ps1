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

function Assert-Throws {
    param(
        [Parameter(Mandatory)]
        [scriptblock] $Operation,

        [Parameter(Mandatory)]
        [string] $Message
    )

    try {
        & $Operation
    }
    catch {
        if ($_.Exception.Message.StartsWith("Assertion failed:", [StringComparison]::Ordinal)) {
            throw
        }
        return
    }
    throw "Assertion failed: $Message Expected an exception, but none was thrown."
}

function Get-TestSha256 {
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ("fennevia-release-tests-" + [guid]::NewGuid().ToString("N"))
$canonicalTempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd("\", "/")
$canonicalTestRoot = [IO.Path]::GetFullPath($testRoot).TrimEnd("\", "/")
Assert-True -Condition ($canonicalTestRoot.StartsWith($canonicalTempRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) -Message "The release test root must remain inside the OS temporary directory."
New-Item -ItemType Directory -Path $canonicalTestRoot | Out-Null

Import-Module (Join-Path $repositoryRoot "scripts\lib\FenneviaRelease.psm1") -Force
try {
    $roslynCsc = Get-FenneviaRoslynCscPath
    if (-not [string]::IsNullOrWhiteSpace([string] $roslynCsc)) {
        Assert-True -Condition (Test-Path -LiteralPath $roslynCsc -PathType Leaf) -Message "Discovered Roslyn csc.exe must exist."
        Assert-Equal -Actual ([IO.Path]::GetFileName($roslynCsc)) -Expected "csc.exe" -Message "Roslyn discovery must return csc.exe."
    }

    $sourceCommit = "0123456789abcdef0123456789abcdef01234567"
    $first = New-FenneviaReleaseArtifacts `
        -RepositoryRoot $repositoryRoot `
        -OutputDirectory (Join-Path $canonicalTestRoot "first output") `
        -SourceCommit $sourceCommit `
        -ExpectedTag "v0.11.0-beta.1" `
        -TestAllowDirtySource
    $second = New-FenneviaReleaseArtifacts `
        -RepositoryRoot $repositoryRoot `
        -OutputDirectory (Join-Path $canonicalTestRoot "second output") `
        -SourceCommit $sourceCommit `
        -ExpectedTag "v0.11.0-beta.1" `
        -TestAllowDirtySource

    Assert-Equal -Actual $first.Version -Expected "0.11.0-beta.1" -Message "The canonical package version must drive release staging."
    Assert-Equal -Actual $first.Tag -Expected "v0.11.0-beta.1" -Message "The exact tag must be derived from the package version."
    Assert-True -Condition $first.Prerelease -Message "The public package must remain marked as a prerelease."
    Assert-Equal -Actual $first.ArchiveName -Expected "fennevia-0.11.0-beta.1-windows.zip" -Message "The archive name must be deterministic and versioned."
    Assert-Equal -Actual $first.ArchiveSha256 -Expected $second.ArchiveSha256 -Message "Two clean builds must produce byte-identical ZIP archives."
    Assert-Equal -Actual (Get-TestSha256 -Path $first.ManifestPath) -Expected (Get-TestSha256 -Path $second.ManifestPath) -Message "Two clean builds must produce byte-identical release manifests."

    $validation = Test-FenneviaReleaseTree -PackageRoot $first.PackageRoot
    Assert-True -Condition $validation.Passed -Message "The staged package must pass its strict release policy."
    Assert-Equal -Actual $validation.FileCount -Expected 39 -Message "The strict release tree must have the reviewed file count."
    Assert-True -Condition (Test-Path -LiteralPath (Join-Path $first.PackageRoot "scripts\fennevia.ps1") -PathType Leaf) -Message "The release tree must include the console entry."
    Assert-True -Condition (Test-Path -LiteralPath (Join-Path $first.PackageRoot "scripts\fennevia-gui.ps1") -PathType Leaf) -Message "The release tree must include the GUI entry."
    Assert-True -Condition (Test-Path -LiteralPath (Join-Path $first.PackageRoot "scripts\lib\FenneviaGui.psm1") -PathType Leaf) -Message "The release tree must include the GUI module."
    Assert-True -Condition (Test-Path -LiteralPath (Join-Path $first.PackageRoot "scripts\gui\FenneviaSetup.cs") -PathType Leaf) -Message "The release tree must include the setup launcher source."
    Assert-True -Condition (Test-Path -LiteralPath (Join-Path $first.PackageRoot "FenneviaSetup.exe") -PathType Leaf) -Message "The release tree must include the GUI launcher."
    Assert-True -Condition ((Get-Item -LiteralPath (Join-Path $first.PackageRoot "FenneviaSetup.exe")).Length -gt 0) -Message "The GUI launcher must be a non-empty executable."
    Assert-True -Condition (Test-Path -LiteralPath (Join-Path $first.PackageRoot "scripts\lib\FenneviaConsole.psm1") -PathType Leaf) -Message "The release tree must include the console module."
    Assert-True -Condition (Test-Path -LiteralPath (Join-Path $first.PackageRoot "scripts\lib\FenneviaTui.psm1") -PathType Leaf) -Message "The release tree must include the TUI host."
    Assert-True -Condition (Test-Path -LiteralPath (Join-Path $first.PackageRoot "scripts\lib\installer\Transaction.ps1") -PathType Leaf) -Message "The release tree must include the installer transaction implementation."
    Assert-True -Condition (-not (Test-Path -LiteralPath (Join-Path $first.PackageRoot "scripts\lib\FirefoxDevProfile.psm1"))) -Message "The development-profile helper must not ship in the release ZIP."
    Assert-Equal -Actual ([string] $validation.Manifest.source.commit) -Expected $sourceCommit -Message "The release manifest must record the complete source commit."
    Assert-Equal -Actual ([string] $validation.Manifest.source.archive) -Expected "https://github.com/yutinglia/fennevia/archive/refs/tags/v0.11.0-beta.1.zip" -Message "The release manifest must identify corresponding preferred source."
    Assert-Equal -Actual @($validation.Manifest.firefoxCompatibility).Count -Expected 2 -Message "The release must carry the tested Firefox 153 and 154 compatibility records."
    Assert-Equal -Actual ([string] $validation.Manifest.firefoxCompatibility[0].buildId) -Expected "20260810162159" -Message "Compatibility must still record the Firefox 153.0.4 BuildID."
    Assert-Equal -Actual ([string] $validation.Manifest.firefoxCompatibility[1].version) -Expected "154.0" -Message "Compatibility must record the owner-confirmed Firefox 154.0 version."
    Assert-Equal -Actual ([string] $validation.Manifest.firefoxCompatibility[1].buildId) -Expected "20260812182057" -Message "Compatibility must record the Firefox 154.0 BuildID."

    $tested153 = Get-FenneviaReleaseFirefoxCompatibility -ReleaseManifest $validation.Manifest -FirefoxVersion "153.0.4" -FirefoxBuildId "20260810162159"
    Assert-True -Condition ([bool] $tested153.Allowed) -Message "Firefox 153.0.4 must remain installable."
    Assert-Equal -Actual $tested153.Kind -Expected "tested" -Message "Firefox 153.0.4 must be classified as tested."
    $tested154 = Get-FenneviaReleaseFirefoxCompatibility -ReleaseManifest $validation.Manifest -FirefoxVersion "154.0" -FirefoxBuildId "20260812182057"
    Assert-True -Condition ([bool] $tested154.Allowed) -Message "Firefox 154.0 must be installable."
    Assert-Equal -Actual $tested154.Kind -Expected "tested" -Message "Firefox 154.0 must be classified as tested."
    $newer = Get-FenneviaReleaseFirefoxCompatibility -ReleaseManifest $validation.Manifest -FirefoxVersion "155.0" -FirefoxBuildId "20260901000000"
    Assert-True -Condition ([bool] $newer.Allowed) -Message "Firefox newer than 154 must be installable after the relaxed gate."
    Assert-Equal -Actual $newer.Kind -Expected "untested-newer" -Message "Firefox 155 must be classified as untested-newer."
    Assert-True -Condition ([bool] (Test-FenneviaReleaseFirefoxCompatibility -ReleaseManifest $validation.Manifest -FirefoxVersion "155.0" -FirefoxBuildId "20260901000000")) -Message "The boolean compatibility helper must allow newer-than-tested Firefox."
    $older = Get-FenneviaReleaseFirefoxCompatibility -ReleaseManifest $validation.Manifest -FirefoxVersion "152.0" -FirefoxBuildId "20260801000000"
    Assert-True -Condition (-not [bool] $older.Allowed) -Message "Firefox older than 153 must remain blocked."
    Assert-Equal -Actual $older.Kind -Expected "unsupported-older" -Message "Firefox 152 must be classified as unsupported-older."
    Assert-True -Condition (-not (Test-FenneviaReleaseFirefoxCompatibility -ReleaseManifest $validation.Manifest -FirefoxVersion "152.0" -FirefoxBuildId "20260801000000")) -Message "The boolean compatibility helper must reject older Firefox."
    Assert-True -Condition (@($validation.Manifest.files | Where-Object { $_.path -eq "RELEASE-MANIFEST.json" }).Count -eq 0) -Message "The generated manifest must not claim a recursive self-hash."

    $checksumParts = (Get-Content -Raw -LiteralPath $first.ChecksumPath).Trim().Split(@(" "), [StringSplitOptions]::RemoveEmptyEntries)
    Assert-Equal -Actual $checksumParts.Count -Expected 2 -Message "The checksum file must have one digest and one archive name."
    Assert-Equal -Actual $checksumParts[0] -Expected $first.ArchiveSha256 -Message "The checksum must match the exact ZIP bytes."
    Assert-Equal -Actual $checksumParts[1] -Expected $first.ArchiveName -Message "The checksum must name the exact ZIP."
    $checksumValidation = Test-FenneviaReleaseChecksum -ArchivePath $first.ArchivePath -ChecksumPath $first.ChecksumPath
    Assert-True -Condition $checksumValidation.Passed -Message "The release checksum verifier must accept the generated archive."
    $badChecksumPath = Join-Path $canonicalTestRoot "bad.zip.sha256"
    [IO.File]::WriteAllText($badChecksumPath, ("0" * 64) + "  $($first.ArchiveName)`n", (New-Object Text.UTF8Encoding($false)))
    Assert-Throws -Message "A checksum mismatch must fail verification." -Operation {
        Test-FenneviaReleaseChecksum -ArchivePath $first.ArchivePath -ChecksumPath $badChecksumPath | Out-Null
    }

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($first.ArchivePath)
    try {
        $entryNames = @($archive.Entries | ForEach-Object { $_.FullName })
        $sortedNames = [string[]] @($entryNames)
        [Array]::Sort($sortedNames, [StringComparer]::Ordinal)
        Assert-Equal -Actual ([string]::Join("|", $entryNames)) -Expected ([string]::Join("|", $sortedNames)) -Message "ZIP entries must use deterministic ordinal-style order."
        Assert-True -Condition (@($entryNames | Where-Object { -not $_.StartsWith("fennevia-0.11.0-beta.1/", [StringComparison]::Ordinal) }).Count -eq 0) -Message "Every ZIP entry must remain under one versioned top-level directory."
        Assert-True -Condition (@($entryNames | Where-Object { $_.EndsWith("/", [StringComparison]::Ordinal) }).Count -eq 0) -Message "The deterministic ZIP must not contain platform-dependent directory entries."
        Assert-True -Condition (@($archive.Entries | Where-Object { $_.LastWriteTime.Year -ne 1980 -or $_.LastWriteTime.Month -ne 1 -or $_.LastWriteTime.Day -ne 1 }).Count -eq 0) -Message "Every ZIP entry must use the fixed 1980-01-01 timestamp."
    }
    finally {
        $archive.Dispose()
    }

    $extractRoot = Join-Path $canonicalTestRoot "unicode and spaces 測試"
    [IO.Compression.ZipFile]::ExtractToDirectory($first.ArchivePath, $extractRoot)
    $extractedRoot = Join-Path $extractRoot "fennevia-0.11.0-beta.1"
    $extractedValidation = Test-FenneviaReleaseTree -PackageRoot $extractedRoot
    Assert-True -Condition $extractedValidation.Passed -Message "The exact extracted ZIP must validate from a Unicode and spaces path."

    $tamperedFile = Join-Path $extractedRoot "scripts\lib\FenneviaInstaller.psm1"
    [IO.File]::AppendAllText($tamperedFile, "tampered")
    Assert-Throws -Message "A changed installer module must fail strict digest validation." -Operation {
        Test-FenneviaReleaseTree -PackageRoot $extractedRoot | Out-Null
    }

    $unexpectedPath = Join-Path $second.PackageRoot "unexpected.txt"
    [IO.File]::WriteAllText($unexpectedPath, "unexpected", (New-Object Text.UTF8Encoding($false)))
    Assert-Throws -Message "An unexpected staged file must fail strict inventory validation." -Operation {
        Test-FenneviaReleaseTree -PackageRoot $second.PackageRoot | Out-Null
    }
    Remove-Item -LiteralPath $unexpectedPath -Force
    Remove-Item -LiteralPath (Join-Path $second.PackageRoot "LICENSE") -Force
    Assert-Throws -Message "A missing required staged file must fail strict inventory validation." -Operation {
        Test-FenneviaReleaseTree -PackageRoot $second.PackageRoot | Out-Null
    }

    $versionMismatchRoot = Join-Path $canonicalTestRoot "version mismatch"
    Copy-Item -LiteralPath $first.PackageRoot -Destination $versionMismatchRoot -Recurse
    $versionManifestPath = Join-Path $versionMismatchRoot "RELEASE-MANIFEST.json"
    $versionManifest = Get-Content -Raw -LiteralPath $versionManifestPath | ConvertFrom-Json
    $versionManifest.version = "0.10.0"
    $versionManifest.tag = "v0.10.0"
    $versionManifest.prerelease = $false
    $versionManifest.source.archive = "https://github.com/yutinglia/fennevia/archive/refs/tags/v0.10.0.zip"
    $versionManifest.release.archive = "fennevia-0.10.0-windows.zip"
    $versionManifest.release.checksum = "fennevia-0.10.0-windows.zip.sha256"
    [IO.File]::WriteAllText($versionManifestPath, (($versionManifest | ConvertTo-Json -Depth 10) + "`n"), (New-Object Text.UTF8Encoding($false)))
    Assert-Throws -Message "Release and package-manifest version disagreement must fail validation." -Operation {
        Test-FenneviaReleaseTree -PackageRoot $versionMismatchRoot | Out-Null
    }

    Assert-Throws -Message "A mismatched requested tag must stop release staging." -Operation {
        New-FenneviaReleaseArtifacts `
            -RepositoryRoot $repositoryRoot `
            -OutputDirectory (Join-Path $canonicalTestRoot "wrong tag") `
            -SourceCommit $sourceCommit `
            -ExpectedTag "v0.10.0" `
            -TestAllowDirtySource | Out-Null
    }

    Assert-Throws -Message "A non-empty output directory must stop stale artifact publication." -Operation {
        New-FenneviaReleaseArtifacts `
            -RepositoryRoot $repositoryRoot `
            -OutputDirectory (Split-Path -Parent $first.PackageRoot) `
            -SourceCommit $sourceCommit `
            -TestAllowDirtySource | Out-Null
    }

    Write-Output "PASS: deterministic release staging, manifest, checksum, ZIP, extraction, tamper, and stale-output tests."
}
finally {
    Remove-Module FenneviaRelease -ErrorAction SilentlyContinue
    if (
        (Test-Path -LiteralPath $canonicalTestRoot) -and
        $canonicalTestRoot.StartsWith($canonicalTempRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)
    ) {
        Remove-Item -LiteralPath $canonicalTestRoot -Recurse -Force
    }
}
