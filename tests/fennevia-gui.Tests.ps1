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

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ("fennevia-gui-tests-" + [guid]::NewGuid().ToString("N"))
$canonicalTempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd("\", "/")
$canonicalTestRoot = [IO.Path]::GetFullPath($testRoot).TrimEnd("\", "/")
Assert-True -Condition ($canonicalTestRoot.StartsWith($canonicalTempRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) -Message "The GUI test root must remain inside the OS temporary directory."
New-Item -ItemType Directory -Path $canonicalTestRoot | Out-Null

$releaseRoot = Join-Path $canonicalTestRoot "release"
New-Item -ItemType Directory -Path $releaseRoot | Out-Null
[IO.File]::WriteAllText((Join-Path $releaseRoot "RELEASE-MANIFEST.json"), "{}" + [Environment]::NewLine)
[IO.File]::WriteAllText((Join-Path $releaseRoot "LICENSE"), "Mozilla Public License 2.0" + [Environment]::NewLine)

Import-Module (Join-Path $repositoryRoot "scripts\lib\FenneviaGui.psm1") -Force
Import-Module (Join-Path $repositoryRoot "scripts\lib\FenneviaConsole.psm1") -Force
Import-Module (Join-Path $repositoryRoot "scripts\lib\FenneviaInstaller.psm1") -Force

try {
    Assert-Throws -Message "A source tree without RELEASE-MANIFEST.json must refuse the GUI." -Operation {
        Assert-FenneviaGuiReleasePackage -PackageRoot $repositoryRoot | Out-Null
    }

    $canonicalRelease = Assert-FenneviaGuiReleasePackage -PackageRoot $releaseRoot
    Assert-Equal -Actual (Invoke-FenneviaGui -PackageRoot $canonicalRelease).Action -Expected "" -Message "A non-interactive GUI session must not preselect an action."

    $session = New-FenneviaGuiSession -PackageRoot $canonicalRelease
    $session.Action = "Install"
    $session.FirefoxPath = "C:\hidden\firefox.exe"
    $session.ProfilePath = "C:\hidden\profile"
    $session.ProfileName = "work"
    $session.Plan = [pscustomobject]@{
        PlanSha256 = ("c" * 64)
        PlannedMutationCount = 1
    }
    $session.Status = [pscustomobject]@{
        SelectedFirefoxRunning = $false
        ProgramWritable = $true
    }

    $unacked = New-FenneviaGuiPackageRequest -Session $session
    Assert-True -Condition (-not [bool] $unacked.Ready) -Message "Install without the Firefox warning must not be ready."
    Assert-Equal -Actual $unacked.Reason -Expected "firefox-support-unacknowledged" -Message "Missing support acknowledgement should be explicit."

    $session.SupportWarningAcknowledged = $true
    $unconfirmed = New-FenneviaGuiPackageRequest -Session $session
    Assert-True -Condition (-not [bool] $unconfirmed.Ready) -Message "Install without plan confirmation must not be ready."
    Assert-Equal -Actual $unconfirmed.Reason -Expected "confirmation-required" -Message "Missing plan confirmation should be explicit."

    $session.PlanConfirmed = $true
    $ready = New-FenneviaGuiPackageRequest -Session $session
    Assert-True -Condition ([bool] $ready.Ready) -Message "A confirmed install request should be ready."
    Assert-Equal -Actual $ready.ExpectedPlanSha256 -Expected ("c" * 64) -Message "The displayed plan digest must be passed through."

    $running = New-FenneviaGuiSession -PackageRoot $canonicalRelease
    $running.Action = "Install"
    $running.FirefoxPath = "C:\hidden\firefox.exe"
    $running.ProfilePath = "C:\hidden\profile"
    $running.SupportWarningAcknowledged = $true
    $running.PlanConfirmed = $true
    $running.Plan = $session.Plan
    $running.Status = [pscustomobject]@{
        SelectedFirefoxRunning = $true
        ProgramWritable = $true
    }
    $blocked = New-FenneviaGuiPackageRequest -Session $running
    Assert-Equal -Actual $blocked.Reason -Expected "firefox-running" -Message "A running Firefox must block apply."

    $defaultSession = New-FenneviaGuiSession -PackageRoot $canonicalRelease
    $defaultSession.ProfileName = "default"
    $defaultSession.ProfilePath = "C:\hidden\default"
    $defaultSession.ProfileIsDefault = $true
    Assert-True -Condition (-not (Test-FenneviaGuiCanLeavePage -Page "profile" -Session $defaultSession)) -Message "Firefox's default profile must require a second confirmation."
    $defaultSession.DefaultProfileConfirmed = $true
    Assert-True -Condition (Test-FenneviaGuiCanLeavePage -Page "profile" -Session $defaultSession) -Message "An explicit default confirmation should allow leaving the profile page."

    Assert-True -Condition (-not (Test-FenneviaGuiNeedsElevation -Action "Status" -Status $session.Status)) -Message "Status must never request elevation."
    Assert-True -Condition (-not (Test-FenneviaGuiNeedsElevation -Action "Install" -Status $session.Status)) -Message "A writable program directory must not request elevation."
    $unwritable = [pscustomobject]@{ ProgramWritable = $false; SelectedFirefoxRunning = $false }
    Assert-True -Condition (Test-FenneviaGuiNeedsElevation -Action "Install" -Status $unwritable) -Message "An unwritable program directory should request elevation after confirmation."

    Add-FenneviaGuiCopyableLines -Session $session -Lines @("event=installer.plan", "program=C:\hidden\firefox.exe", "profile=<FENNEVIA_PROFILE>")
    Assert-True -Condition (@($session.CopyableLines | Where-Object { $_ -match "C:\\hidden" }).Count -eq 0) -Message "Copyable GUI lines must not disclose absolute paths."
    Assert-True -Condition (@($session.CopyableLines | Where-Object { $_ -eq "event=installer.plan" }).Count -eq 1) -Message "Redacted plan events should remain copyable."

    $session.Status = $unwritable
    $statePath = New-FenneviaGuiElevationState -Session $session
    try {
        $check = Test-FenneviaGuiElevationState -Path $statePath -ExpectedPackageRoot $canonicalRelease
        Assert-True -Condition ([bool] $check.Valid) -Message "A just-written elevation state should be valid."
        Assert-Equal -Actual $check.Reason -Expected "ready" -Message "A valid elevation state should report ready."

        $mismatch = Test-FenneviaGuiElevationState -Path $statePath -ExpectedPackageRoot $canonicalTestRoot
        Assert-True -Condition (-not [bool] $mismatch.Valid) -Message "A different package root must not resume."
        Assert-Equal -Actual $mismatch.Reason -Expected "package-root-mismatch" -Message "Package-root mismatches should be explicit."

        $expiredRaw = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
        $expiredRaw.createdUtcTicks = [long] [datetime]::UtcNow.AddMinutes(-20).Ticks
        [IO.File]::WriteAllText($statePath, (($expiredRaw | ConvertTo-Json -Compress) + [Environment]::NewLine))
        $expired = Test-FenneviaGuiElevationState -Path $statePath -ExpectedPackageRoot $canonicalRelease
        Assert-Equal -Actual $expired.Reason -Expected "expired" -Message "Elevation state older than 15 minutes must expire."
    }
    finally {
        Remove-FenneviaGuiElevationState -Path $statePath
    }

    $missing = Test-FenneviaGuiElevationState -Path (Join-Path $canonicalTestRoot "missing.json") -ExpectedPackageRoot $canonicalRelease
    Assert-Equal -Actual $missing.Reason -Expected "missing-file" -Message "A missing elevation state should fail closed."

    $script:InvokeCount = 0
    $script:LastRequest = $null
    $script:Elevated = New-Object "Collections.Generic.List[string]"
    $previewPlan = [pscustomobject]@{
        Action = "Install"
        Status = "planned"
        DryRun = $true
        Applied = $false
        PackageVersion = "0.10.0-beta.1"
        State = "enabled"
        Program = "<FIREFOX_PROGRAM>"
        Profile = "<FENNEVIA_PROFILE>"
        ProfileMode = "Registered"
        PlannedMutationCount = 1
        AppliedMutationCount = 0
        PlannedBackupCount = 0
        PlanSha256 = ("c" * 64)
        StartupCacheAction = "none"
        Operations = @([pscustomobject]@{ Kind = "CreateFile"; Scope = "program"; Path = "fennevia.cfg"; DestinationPath = "" })
        Backups = @()
    }
    $hooks = @{
        Write = { param($Lines) }
        GetCandidates = {
            @(
                [pscustomobject]@{
                    FirefoxPath = "C:\hidden\firefox.exe"
                    Label = "Firefox 154.0"
                    Version = "154.0"
                    BuildID = "20260812182057"
                }
            )
        }
        GetProfileChoices = {
            @(
                [pscustomobject]@{ Name = "work"; IsDefault = $false; Path = "C:\hidden\work" },
                [pscustomobject]@{ Name = "default"; IsDefault = $true; Path = "C:\hidden\default" }
            )
        }
        GetStatus = {
            [pscustomobject]@{
                Program = "<FIREFOX_PROGRAM>"
                Profile = "<FENNEVIA_PROFILE>"
                ProfileMode = "Registered"
                Kind = "absent"
                State = "not-installed"
                PackageVersion = ""
                FirefoxVersion = "154.0"
                FirefoxBuildID = "20260812182057"
                InterruptedTransaction = $false
                ProgramWritable = $true
                SelectedFirefoxRunning = $false
                Compatible = $true
                CompatibilityKind = "tested"
                TestedFirefoxMajors = "153,154"
                FirefoxSupportWarning = "Fennevia is only tested on Firefox 153 and 154. Later Firefox versions may break the shell. Confirming install does not promise that everything will work."
                ErrorCode = ""
                Problems = @()
            }
        }
        PreviewPackage = { $previewPlan }
        InvokePackage = {
            param($Request)
            $script:InvokeCount++
            $script:LastRequest = $Request
            [pscustomobject]@{
                Action = $Request.Action
                Status = "applied"
                DryRun = $false
                Applied = $true
                PackageVersion = "0.10.0-beta.1"
                State = "enabled"
                Program = "<FIREFOX_PROGRAM>"
                Profile = "<FENNEVIA_PROFILE>"
                ProfileMode = "Registered"
                PlannedMutationCount = 1
                AppliedMutationCount = 1
                PlannedBackupCount = 0
                PlanSha256 = $Request.ExpectedPlanSha256
                StartupCacheAction = "none"
                Operations = @([pscustomobject]@{ Kind = "CreateFile"; Scope = "program"; Path = "fennevia.cfg"; DestinationPath = "" })
                Backups = @()
            }
        }
        StartElevated = {
            param($StatePath)
            $script:Elevated.Add("started")
            Assert-True -Condition (Test-FenneviaGuiLineHasPath -Line $StatePath) -Message "The elevation hook receives a real state path internally."
            return [pscustomobject]@{ Started = $true; Cancelled = $false }
        }
    }
    $resolved = Initialize-FenneviaConsoleHooks -PackageRoot $canonicalRelease -Hooks $hooks

    $applySession = New-FenneviaGuiSession -PackageRoot $canonicalRelease
    $applySession.Action = "Install"
    $applySession.FirefoxPath = "C:\hidden\firefox.exe"
    $applySession.ProfilePath = "C:\hidden\work"
    $applySession.SupportWarningAcknowledged = $true
    $applySession.PlanConfirmed = $true
    $null = Invoke-FenneviaGuiPreview -Session $applySession -Hooks $resolved
    $null = Invoke-FenneviaGuiStatusQuery -Session $applySession -Hooks $resolved
    $applySession.PlanConfirmed = $true
    $applySession.SupportWarningAcknowledged = $true
    $result = Invoke-FenneviaGuiApply -Session $applySession -Hooks $resolved
    Assert-Equal -Actual $script:InvokeCount -Expected 1 -Message "A confirmed GUI apply should invoke the package action once."
    Assert-Equal -Actual $script:LastRequest.ExpectedPlanSha256 -Expected ("c" * 64) -Message "Apply must pass the previewed plan digest."
    Assert-Equal -Actual $result.Status -Expected "applied" -Message "A successful GUI apply should report applied."
    Assert-True -Condition (@($applySession.CopyableLines | Where-Object { $_ -match "C:\\hidden" }).Count -eq 0) -Message "Preview and apply output must stay redacted."

    $changedPreview = @{}
    foreach ($key in $hooks.Keys) {
        $changedPreview[$key] = $hooks[$key]
    }
    $changedPreview["PreviewPackage"] = {
        [pscustomobject]@{
            Action = "Install"
            Status = "planned"
            DryRun = $true
            Applied = $false
            PackageVersion = "0.10.0-beta.1"
            State = "enabled"
            Program = "<FIREFOX_PROGRAM>"
            Profile = "<FENNEVIA_PROFILE>"
            ProfileMode = "Registered"
            PlannedMutationCount = 1
            AppliedMutationCount = 0
            PlannedBackupCount = 0
            PlanSha256 = ("d" * 64)
            StartupCacheAction = "none"
            Operations = @([pscustomobject]@{ Kind = "CreateFile"; Scope = "program"; Path = "fennevia.cfg"; DestinationPath = "" })
            Backups = @()
        }
    }
    $changedResolved = Initialize-FenneviaConsoleHooks -PackageRoot $canonicalRelease -Hooks $changedPreview
    $resumeSession = New-FenneviaGuiSession -PackageRoot $canonicalRelease
    $resumeSession.Action = "Install"
    $resumeSession.FirefoxPath = "C:\hidden\firefox.exe"
    $resumeSession.ProfilePath = "C:\hidden\work"
    $resumeSession.SupportWarningAcknowledged = $true
    $resumeSession.PlanConfirmed = $true
    $resumeSession.Plan = [pscustomobject]@{ PlanSha256 = ("c" * 64); PlannedMutationCount = 1 }
    $resumeSession.Status = $unwritable
    $resumePath = New-FenneviaGuiElevationState -Session $resumeSession
    Assert-Throws -Message "A changed plan digest after elevation must refuse to apply." -Operation {
        Complete-FenneviaGuiResume -PackageRoot $canonicalRelease -ResumeStatePath $resumePath -Hooks $changedResolved | Out-Null
    }
    Assert-True -Condition (-not (Test-Path -LiteralPath $resumePath -PathType Leaf)) -Message "A failed resume must delete the elevation state file."
    Assert-Equal -Actual $script:InvokeCount -Expected 1 -Message "A changed plan digest must not apply a package mutation."

    $elevSession = New-FenneviaGuiSession -PackageRoot $canonicalRelease
    $elevSession.Action = "Install"
    $elevSession.FirefoxPath = "C:\hidden\firefox.exe"
    $elevSession.ProfilePath = "C:\hidden\work"
    $elevSession.SupportWarningAcknowledged = $true
    $elevSession.PlanConfirmed = $true
    $elevSession.Plan = [pscustomobject]@{ PlanSha256 = ("c" * 64); PlannedMutationCount = 1 }
    $elevSession.Status = $unwritable
    $elevPath = New-FenneviaGuiElevationState -Session $elevSession
    try {
        $started = Start-FenneviaGuiElevatedHost -PackageRoot $canonicalRelease -StatePath $elevPath -Hooks $resolved
        Assert-True -Condition ([bool] $started.Started) -Message "The GUI must invoke the elevation hook instead of self-elevating in tests."
        Assert-Equal -Actual $script:Elevated.Count -Expected 1 -Message "Elevation should be requested once after an explicit continue."
    }
    finally {
        Remove-FenneviaGuiElevationState -Path $elevPath
    }

    $label = ConvertTo-FenneviaGuiFirefoxChoiceLabel -Candidate ([pscustomobject]@{ Label = "Firefox 154.0"; BuildID = "20260812182057" })
    Assert-True -Condition ($label -match "BuildID 20260812182057") -Message "Firefox choices should include the BuildID without a filesystem path."
    Assert-True -Condition (-not (Test-FenneviaGuiLineHasPath -Line $label)) -Message "Firefox choice labels must not include absolute paths."

    Assert-Equal -Actual (ConvertTo-FenneviaGuiActionName -Id "install") -Expected "Install" -Message "GUI actions must use the installer contract names."
    Assert-True -Condition (Test-FenneviaGuiActionNeedsSupportWarning -Action "Repair") -Message "Repair must keep the Firefox support warning."
    Assert-True -Condition (-not (Test-FenneviaGuiActionNeedsSupportWarning -Action "Uninstall")) -Message "Uninstall must remain available without the support warning."

    Write-Output "PASS: GUI installer presentation, confirmation, elevation-state, and resume tests."
}
finally {
    Remove-Module FenneviaGui, FenneviaConsole, FenneviaTui, FenneviaInstaller -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $canonicalTestRoot) {
        Remove-Item -LiteralPath $canonicalTestRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
