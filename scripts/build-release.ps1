#requires -Version 5.1

# SPDX-License-Identifier: MPL-2.0

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string] $OutputDirectory,

    [string] $SourceCommit = "",

    [string] $ExpectedTag = ""
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
Import-Module $modulePath -Force
try {
    $result = New-FenneviaReleaseArtifacts `
        -RepositoryRoot $repositoryRoot `
        -OutputDirectory $resolvedOutput `
        -SourceCommit $SourceCommit `
        -ExpectedTag $ExpectedTag
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
