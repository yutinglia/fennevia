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

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ("fennevia-installer-discovery-" + [guid]::NewGuid().ToString("N"))
$canonicalTempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd("\", "/")
$canonicalTestRoot = [IO.Path]::GetFullPath($testRoot).TrimEnd("\", "/")
Assert-True -Condition $canonicalTestRoot.StartsWith($canonicalTempRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -Message "The discovery test root must remain inside the OS temporary directory."
New-Item -ItemType Directory -Path $canonicalTestRoot | Out-Null

$originalLocalAppData = $env:LOCALAPPDATA
$originalAppData = $env:APPDATA

try {
    $env:LOCALAPPDATA = Join-Path $canonicalTestRoot "Local"
    $env:APPDATA = Join-Path $canonicalTestRoot "Roaming"
    New-Item -ItemType Directory -Path $env:LOCALAPPDATA -Force | Out-Null
    New-Item -ItemType Directory -Path $env:APPDATA -Force | Out-Null

    Import-Module (Join-Path $repositoryRoot "scripts\lib\FenneviaInstaller.psm1") -Force
    Import-Module (Join-Path $repositoryRoot "scripts\lib\FirefoxDevProfile.psm1") -Force

    $firefoxDataRoot = Join-Path $env:APPDATA "Mozilla\Firefox"
    $workProfile = Join-Path $canonicalTestRoot "profiles\work"
    $defaultProfile = Join-Path $canonicalTestRoot "profiles\default"
    New-Item -ItemType Directory -Path $workProfile -Force | Out-Null
    New-Item -ItemType Directory -Path $defaultProfile -Force | Out-Null
    New-Item -ItemType Directory -Path $firefoxDataRoot -Force | Out-Null
    $profilesIni = @(
        "[Profile0]",
        "Name=work",
        "IsRelative=0",
        "Path=$workProfile",
        "[Profile1]",
        "Name=default",
        "IsRelative=0",
        "Path=$defaultProfile",
        "Default=1"
    ) -join [Environment]::NewLine
    [IO.File]::WriteAllText((Join-Path $firefoxDataRoot "profiles.ini"), $profilesIni)

    $choices = @(Get-FenneviaInstallerRegisteredProfileChoices)
    Assert-Equal -Actual $choices.Count -Expected 2 -Message "Registered profile choices should include both named profiles."
    $defaultChoice = @($choices | Where-Object { $_.Name -eq "default" })[0]
    $workChoice = @($choices | Where-Object { $_.Name -eq "work" })[0]
    Assert-True -Condition ([bool] $defaultChoice.IsDefault) -Message "profiles.ini Default=1 must mark the Firefox default."
    Assert-True -Condition (-not [bool] $workChoice.IsDefault) -Message "A non-default profile must not be marked default."

    $choiceLines = ConvertTo-FenneviaInstallerProfileChoiceLines -Choices $choices
    $joined = $choiceLines -join [Environment]::NewLine
    Assert-True -Condition ($joined -match "profile\[\d+\]=default \(Firefox default\)") -Message "Choice lines should label the Firefox default by name."
    Assert-True -Condition ($joined -notmatch [regex]::Escape($defaultProfile)) -Message "Choice lines must not disclose absolute profile paths."
    Assert-True -Condition ($joined -notmatch [regex]::Escape($workProfile)) -Message "Choice lines must not disclose non-default profile paths."

    $programRoot = Join-Path $canonicalTestRoot "programs\status"
    New-Item -ItemType Directory -Path (Join-Path $programRoot "defaults\pref") -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $programRoot "firefox.exe"), "fixture executable")
    $applicationIni = @(
        "[App]",
        "Name=Firefox",
        "Version=153.0.4",
        "BuildID=20260810162159"
    ) -join [Environment]::NewLine
    [IO.File]::WriteAllText((Join-Path $programRoot "application.ini"), $applicationIni)
    $profileRoot = Join-Path $env:LOCALAPPDATA "fennevia\profiles\status"
    [void] (Initialize-FenneviaFirefoxDevProfile -ProfilePath $profileRoot)

    $status = Get-FenneviaInstallerInstallationStatus `
        -FirefoxPath (Join-Path $programRoot "firefox.exe") `
        -ProfilePath $profileRoot `
        -ProfileMode Development `
        -PackageRoot $repositoryRoot
    Assert-Equal -Actual $status.Kind -Expected "absent" -Message "A clean target should report an absent installation."
    Assert-Equal -Actual $status.State -Expected "not-installed" -Message "A clean target should report not-installed."
    Assert-Equal -Actual $status.Program -Expected "<FIREFOX_PROGRAM>" -Message "Status must keep the program path redacted."
    Assert-Equal -Actual $status.Profile -Expected "<FENNEVIA_PROFILE>" -Message "Status must keep the profile path redacted."
    Assert-True -Condition ([bool] $status.ProgramWritable) -Message "A test program directory should be writable."

    $statusLines = ConvertTo-FenneviaInstallerStatusLines -Status $status
    $statusText = $statusLines -join [Environment]::NewLine
    Assert-True -Condition ($statusText -match "event=installer.status") -Message "Status lines should use the installer.status event."
    Assert-True -Condition ($statusText -notmatch [regex]::Escape($programRoot)) -Message "Status lines must not disclose the program root."
    Assert-True -Condition ($statusText -notmatch [regex]::Escape($profileRoot)) -Message "Status lines must not disclose the profile root."

    Write-Output "PASS: installer discovery, profile-choice redaction, and status tests."
}
finally {
    Remove-Module FenneviaInstaller, FirefoxDevProfile -ErrorAction SilentlyContinue
    $env:LOCALAPPDATA = $originalLocalAppData
    $env:APPDATA = $originalAppData
    if (Test-Path -LiteralPath $canonicalTestRoot) {
        Remove-Item -LiteralPath $canonicalTestRoot -Recurse -Force
    }
}
