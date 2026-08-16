#requires -Version 5.1

# SPDX-License-Identifier: MPL-2.0

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string] $PackageRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$modulePath = Join-Path $PSScriptRoot "lib\FenneviaRelease.psm1"
$resolvedPackageRoot = if ([IO.Path]::IsPathRooted($PackageRoot)) {
    [IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($PackageRoot))
}
else {
    [IO.Path]::GetFullPath((Join-Path (Get-Location).Path $PackageRoot))
}
Import-Module $modulePath -Force
try {
    $result = Test-FenneviaReleaseTree -PackageRoot $resolvedPackageRoot
    Write-Output "event=release.verify"
    Write-Output "status=passed"
    Write-Output "version=$($result.Version)"
    Write-Output "tag=$($result.Tag)"
    Write-Output "archive=$($result.ArchiveName)"
    Write-Output "packageManifestSha256=$($result.PackageManifestSha256)"
    Write-Output "fileCount=$($result.FileCount)"
}
finally {
    Remove-Module FenneviaRelease -ErrorAction SilentlyContinue
}
