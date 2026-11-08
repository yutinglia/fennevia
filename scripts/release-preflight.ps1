#requires -Version 7.4

# SPDX-License-Identifier: MPL-2.0

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string] $OutputDirectory,

    [string] $ExpectedTag = "",

    [switch] $RequireAnnotatedTag,

    [switch] $SkipDependencyInstall,

    [switch] $SkipProjectVerification
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-FenneviaReleaseCommand {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $FilePath,

        [Parameter(Mandatory)]
        [string[]] $Arguments,

        [Parameter(Mandatory)]
        [string] $FailureMessage
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw $FailureMessage
    }
}

function Get-FenneviaReleaseGitStatus {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $RepositoryRoot
    )

    $status = @(& git -C $RepositoryRoot status --porcelain=v1 --untracked-files=all)
    if ($LASTEXITCODE -ne 0) {
        throw "Git working-tree state could not be read."
    }
    return @($status | Where-Object { -not [string]::IsNullOrWhiteSpace([string] $_) })
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$canonicalRepository = [IO.Path]::GetFullPath($repositoryRoot).TrimEnd("\", "/")
$canonicalOutput = [IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($OutputDirectory)).TrimEnd("\", "/")
if (-not [IO.Path]::IsPathRooted($OutputDirectory) -or [string]::Equals($canonicalOutput, [IO.Path]::GetPathRoot($canonicalOutput), [StringComparison]::OrdinalIgnoreCase)) {
    throw "Preflight output must be an explicit non-root absolute directory."
}
if (Test-Path -LiteralPath $canonicalOutput) {
    if (-not (Test-Path -LiteralPath $canonicalOutput -PathType Container) -or @(Get-ChildItem -Force -LiteralPath $canonicalOutput).Count -ne 0) {
        throw "Preflight output must be an empty directory."
    }
}
else {
    New-Item -ItemType Directory -Path $canonicalOutput | Out-Null
}

$initialStatus = @(Get-FenneviaReleaseGitStatus -RepositoryRoot $canonicalRepository)
if ($initialStatus.Count -ne 0) {
    throw "Release preflight requires a clean Git working tree."
}

$sourceCommitOutput = @(& git -C $canonicalRepository rev-parse HEAD)
if ($LASTEXITCODE -ne 0 -or $sourceCommitOutput.Count -ne 1 -or [string] $sourceCommitOutput[0] -cnotmatch "^[0-9a-f]{40}$") {
    throw "Release preflight could not resolve the complete source commit."
}
$sourceCommit = [string] $sourceCommitOutput[0]

$package = Get-Content -Raw -LiteralPath (Join-Path $canonicalRepository "package.json") | ConvertFrom-Json
$version = [string] $package.version
$tag = "v$version"
if (-not [string]::IsNullOrWhiteSpace($ExpectedTag) -and $ExpectedTag -cne $tag) {
    throw "The release tag does not match package.json."
}
if ($RequireAnnotatedTag) {
    if ([string]::IsNullOrWhiteSpace($ExpectedTag)) {
        throw "An exact expected tag is required when annotated-tag verification is enabled."
    }
    $tagType = @(& git -C $canonicalRepository cat-file -t "refs/tags/$ExpectedTag" 2>$null)
    if ($LASTEXITCODE -ne 0 -or $tagType.Count -ne 1 -or [string] $tagType[0] -cne "tag") {
        throw "Release publication requires an existing annotated tag."
    }
    $tagCommit = @(& git -C $canonicalRepository rev-list -n 1 $ExpectedTag)
    if ($LASTEXITCODE -ne 0 -or $tagCommit.Count -ne 1 -or [string] $tagCommit[0] -cne $sourceCommit) {
        throw "The annotated tag does not resolve to the checked-out source commit."
    }
}

Push-Location $canonicalRepository
try {
    if (-not $SkipDependencyInstall) {
        Invoke-FenneviaReleaseCommand -FilePath "npm" -Arguments @("ci", "--ignore-scripts", "--no-fund") -FailureMessage "The exact dependency installation failed."
        Invoke-FenneviaReleaseCommand -FilePath "npm" -Arguments @('--prefix', 'installer', 'ci', '--ignore-scripts', '--no-fund') -FailureMessage 'Installer dependency installation failed.'
    }
    if (-not $SkipProjectVerification) {
        Invoke-FenneviaReleaseCommand -FilePath "npm" -Arguments @("run", "verify") -FailureMessage "The project verification suite failed."
        Invoke-FenneviaReleaseCommand -FilePath "npm" -Arguments @('--prefix', 'installer', 'run', 'verify') -FailureMessage 'Installer verification failed.'
    }
    else {
        Invoke-FenneviaReleaseCommand -FilePath "npm" -Arguments @('--prefix', 'installer', 'run', 'build') -FailureMessage 'Installer embedded asset build failed.'
    }
}
finally {
    Pop-Location
}

$postVerificationStatus = @(Get-FenneviaReleaseGitStatus -RepositoryRoot $canonicalRepository)
if ($postVerificationStatus.Count -ne 0) {
    throw "Verification changed committed source or generated artifacts."
}

$modulePath = Join-Path $canonicalRepository "scripts\lib\FenneviaRelease.psm1"
Import-Module $modulePath -Force
try {
    $firstOutput = Join-Path $canonicalOutput "first"
    $secondOutput = Join-Path $canonicalOutput "second"
    $nativeFirst = Join-Path $canonicalOutput 'native-first'
    $nativeSecond = Join-Path $canonicalOutput 'native-second'
    # A second checkout path catches embedded source paths as well as timestamps.
    $sourceArchive = Join-Path $canonicalOutput 'second-source.zip'
    $secondSource = Join-Path $canonicalOutput 'second-source'
    Invoke-FenneviaReleaseCommand -FilePath 'git' -Arguments @('-C', $canonicalRepository, 'archive', '--format=zip', "--output=$sourceArchive", $sourceCommit) -FailureMessage 'Second source archive failed.'
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::ExtractToDirectory($sourceArchive, $secondSource)
    $secondInstaller = Join-Path $secondSource 'installer'
    Invoke-FenneviaReleaseCommand -FilePath 'npm' -Arguments @('--prefix', $secondInstaller, 'ci', '--ignore-scripts', '--no-fund') -FailureMessage 'Second installer dependencies failed.'
    Invoke-FenneviaReleaseCommand -FilePath 'npm' -Arguments @('--prefix', $secondInstaller, 'run', 'build') -FailureMessage 'Second embedded frontend failed.'
    $originalTarget = $env:CARGO_TARGET_DIR
    Push-Location (Join-Path $canonicalRepository 'installer')
    try {
        $env:CARGO_TARGET_DIR = Join-Path $canonicalOutput 'cargo-first'
        Invoke-FenneviaReleaseCommand -FilePath 'node' -Arguments @('scripts/prepare-distribution.mjs', $nativeFirst) -FailureMessage 'First native build failed.'
        $env:CARGO_TARGET_DIR = Join-Path $canonicalOutput 'cargo-second'
        $runtimePin = Get-Content -Raw (Join-Path $canonicalRepository 'installer/runtime/webview2.json') | ConvertFrom-Json
        $cabName = "webview2-$($runtimePin.version)-x64.cab"
        [void] [IO.Directory]::CreateDirectory((Join-Path $secondInstaller '.cache'))
        Copy-Item -LiteralPath (Join-Path $canonicalRepository "installer/.cache/$cabName") -Destination (Join-Path $secondInstaller ".cache/$cabName")
        # The second packaging process independently verifies the copied CAB.
        Push-Location $secondInstaller
        try {
            Invoke-FenneviaReleaseCommand -FilePath 'node' -Arguments @('scripts/prepare-distribution.mjs', $nativeSecond) -FailureMessage 'Second native build failed.'
        } finally { Pop-Location }
    } finally { $env:CARGO_TARGET_DIR = $originalTarget; Pop-Location }
    $first = New-FenneviaReleaseArtifacts -RepositoryRoot $canonicalRepository -OutputDirectory $firstOutput -SourceCommit $sourceCommit -ExpectedTag $tag -NativeInstallerDirectory $nativeFirst
    $second = New-FenneviaReleaseArtifacts -RepositoryRoot $canonicalRepository -OutputDirectory $secondOutput -SourceCommit $sourceCommit -ExpectedTag $tag -NativeInstallerDirectory $nativeSecond
    if ($first.ArchiveSha256 -cne $second.ArchiveSha256) {
        throw "Two clean release builds produced different ZIP bytes."
    }
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $first.ManifestPath).Hash -cne (Get-FileHash -Algorithm SHA256 -LiteralPath $second.ManifestPath).Hash) {
        throw "Two clean release builds produced different release manifests."
    }

    $checksumParts = (Get-Content -Raw -LiteralPath $first.ChecksumPath).Trim().Split(@(" "), [StringSplitOptions]::RemoveEmptyEntries)
    if ($checksumParts.Count -ne 2 -or $checksumParts[0] -cne $first.ArchiveSha256 -or $checksumParts[1] -cne $first.ArchiveName) {
        throw "The generated checksum file does not identify the exact release ZIP."
    }
    [void] (Test-FenneviaReleaseChecksum -ArchivePath $first.ArchivePath -ChecksumPath $first.ChecksumPath)

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $extractRoot = Join-Path $canonicalOutput "unicode path 測試"
    [IO.Compression.ZipFile]::ExtractToDirectory($first.ArchivePath, $extractRoot)
    $extractedPackage = Join-Path $extractRoot "fennevia-$version"
    $extracted = Test-FenneviaReleaseTree -PackageRoot $extractedPackage
    if (-not $extracted.Passed) {
        throw "The extracted release tree failed strict validation."
    }
    # Hosted Windows runners are administrators with UAC disabled. The GUI must
    # keep rejecting elevated tokens; do not turn that guard off for CI smoke.
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    try {
        $principal = [Security.Principal.WindowsPrincipal]::new($identity)
        $elevatedBuildHost = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    }
    finally { $identity.Dispose() }
    $nativeSmokeStatus = 'not-run'
    if ($elevatedBuildHost) {
        Write-Output 'event=native.smoke status=not-run reason=elevated-build-host'
    }
    else {
        Invoke-FenneviaReleaseCommand -FilePath 'node' -Arguments @((Join-Path $canonicalRepository 'installer/scripts/smoke-native.mjs'), (Join-Path $extractedPackage 'FenneviaSetup.exe')) -FailureMessage 'The extracted native installer smoke failed.'
        $nativeSmokeStatus = 'passed'
    }
}
finally {
    Remove-Module FenneviaRelease -ErrorAction SilentlyContinue
}

$finalStatus = @(Get-FenneviaReleaseGitStatus -RepositoryRoot $canonicalRepository)
if ($finalStatus.Count -ne 0) {
    throw "Release staging changed the committed source tree."
}

Write-Output "event=release.preflight"
Write-Output "status=passed"
Write-Output "version=$version"
Write-Output "tag=$tag"
Write-Output "sourceCommit=$sourceCommit"
Write-Output "archive=$($first.ArchiveName)"
Write-Output "archiveSha256=$($first.ArchiveSha256)"
Write-Output "nativeSmokeStatus=$nativeSmokeStatus"
Write-Output "firstOutput=first"
