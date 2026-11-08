#requires -Version 5.1

# SPDX-License-Identifier: MPL-2.0

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string] $OutputDirectory,

    [string] $SourceCommit = "",

    [string] $ExpectedTag = "",

    [string] $NativeInstallerDirectory = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$resolvedOutput = if ([IO.Path]::IsPathRooted($OutputDirectory)) {
    [IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($OutputDirectory))
}
else {
    [IO.Path]::GetFullPath((Join-Path $repositoryRoot $OutputDirectory))
}
$modulePath = Join-Path $PSScriptRoot "lib\FenneviaRelease.psm1"
if ([string]::IsNullOrWhiteSpace($NativeInstallerDirectory)) {
    $NativeInstallerDirectory = Join-Path $repositoryRoot 'installer/out/native'
}
elseif (-not [IO.Path]::IsPathRooted($NativeInstallerDirectory)) {
    $NativeInstallerDirectory = [IO.Path]::GetFullPath((Join-Path $repositoryRoot $NativeInstallerDirectory))
}
if (-not (Test-Path -LiteralPath (Join-Path $NativeInstallerDirectory 'INSTALLER-MANIFEST.json'))) {
    throw 'Build the native installer first: npm --prefix installer run package:native -- <empty-output-directory>. Pass that directory with -NativeInstallerDirectory.'
}
Import-Module $modulePath -Force
try {
    $result = New-FenneviaReleaseArtifacts `
        -RepositoryRoot $repositoryRoot `
        -OutputDirectory $resolvedOutput `
        -SourceCommit $SourceCommit `
        -ExpectedTag $ExpectedTag `
        -NativeInstallerDirectory $NativeInstallerDirectory
    Write-Output "event=release.build"
    Write-Output "version=$($result.Version)"
    Write-Output "tag=$($result.Tag)"
    Write-Output "archive=$($result.ArchiveName)"
    Write-Output "archiveSha256=$($result.ArchiveSha256)"
    Write-Output "fileCount=$($result.FileCount)"
}
finally {
    Remove-Module FenneviaRelease -ErrorAction SilentlyContinue
}
