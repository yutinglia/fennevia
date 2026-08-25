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

function Invoke-FenneviaGuiControlClick {
    param(
        [Parameter(Mandatory)]
        [object] $Control
    )

    $method = $Control.GetType().GetMethod(
        "OnClick",
        [Reflection.BindingFlags]::Instance -bor [Reflection.BindingFlags]::NonPublic
    )
    if ($null -eq $method) {
        throw "Assertion failed: The test control does not expose an OnClick method."
    }
    try {
        [void] $method.Invoke($Control, @([EventArgs]::Empty))
    }
    catch {
        if ($null -ne $_.Exception.InnerException) {
            throw $_.Exception.InnerException
        }
        throw
    }
}

function Get-FenneviaGuiDescendantControl {
    param(
        [Parameter(Mandatory)]
        [object] $Control,

        [Parameter(Mandatory)]
        [type] $ControlType
    )

    foreach ($child in @($Control.Controls)) {
        if ($ControlType.IsInstanceOfType($child)) {
            Write-Output $child
        }
        Get-FenneviaGuiDescendantControl -Control $child -ControlType $ControlType
    }
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

    $pathError = New-Object IO.FileNotFoundException("Missing C:\hidden\release-file")
    $safePathError = ConvertTo-FenneviaGuiSafeErrorMessage -InputObject $pathError
    Assert-True -Condition ($safePathError -match "FENNEVIA_GUI_LOCAL_PATH_ERROR") -Message "Path-bearing GUI failures should expose a stable privacy-safe code."
    Assert-True -Condition ($safePathError -match "FileNotFoundException") -Message "Path-bearing GUI failures may expose an allowlisted exception class."
    Assert-True -Condition (-not (Test-FenneviaGuiLineHasPath -Line $safePathError)) -Message "The actionable GUI error must not disclose the original local path."

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

    $missingStatePath = Join-Path ([IO.Path]::GetTempPath()) ("fennevia-setup-state-" + [guid]::NewGuid().ToString("N") + ".json")
    $missing = Test-FenneviaGuiElevationState -Path $missingStatePath -ExpectedPackageRoot $canonicalRelease
    Assert-Equal -Actual $missing.Reason -Expected "missing-file" -Message "A missing elevation state should fail closed."

    $outsideStatePath = Join-Path $canonicalTestRoot ("fennevia-setup-state-" + [guid]::NewGuid().ToString("N") + ".json")
    [IO.File]::WriteAllText($outsideStatePath, "{}" + [Environment]::NewLine)
    try {
        $outside = Test-FenneviaGuiElevationState -Path $outsideStatePath -ExpectedPackageRoot $canonicalRelease
        Assert-Equal -Actual $outside.Reason -Expected "invalid-path" -Message "Elevation state outside the direct OS temporary namespace must fail closed."
        Assert-Throws -Message "The exported cleanup helper must reject paths outside its dedicated namespace." -Operation {
            Remove-FenneviaGuiElevationState -Path $outsideStatePath
        }
        Assert-True -Condition (Test-Path -LiteralPath $outsideStatePath -PathType Leaf) -Message "Rejected cleanup paths must remain untouched."
    }
    finally {
        [IO.File]::Delete($outsideStatePath)
    }

    $oversizedStatePath = New-FenneviaGuiElevationState -Session $session
    try {
        [IO.File]::WriteAllText($oversizedStatePath, ("x" * 65537))
        $oversized = Test-FenneviaGuiElevationState -Path $oversizedStatePath -ExpectedPackageRoot $canonicalRelease
        Assert-Equal -Actual $oversized.Reason -Expected "size" -Message "Oversized elevation state must be rejected before parsing."
    }
    finally {
        Remove-FenneviaGuiElevationState -Path $oversizedStatePath
    }

    $lockedStatePath = New-FenneviaGuiElevationState -Session $session
    $stateLock = [IO.File]::Open($lockedStatePath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    try {
        Assert-Throws -Message "Elevation state cleanup failures must not be silently suppressed." -Operation {
            Remove-FenneviaGuiElevationState -Path $lockedStatePath
        }
        Assert-True -Condition (Test-Path -LiteralPath $lockedStatePath -PathType Leaf) -Message "A failed cleanup should leave an explicit file for the caller to handle."
    }
    finally {
        $stateLock.Dispose()
        Remove-FenneviaGuiElevationState -Path $lockedStatePath
    }

    $script:InvokeCount = 0
    $script:LastRequest = $null
    $script:Elevated = New-Object "Collections.Generic.List[string]"
    $previewPlan = [pscustomobject]@{
        Action = "Install"
        Status = "planned"
        DryRun = $true
        Applied = $false
        PackageVersion = "0.16.0-beta.1"
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
                PackageVersion = "0.16.0-beta.1"
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
            PackageVersion = "0.16.0-beta.1"
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

    $guiModule = Get-Module FenneviaGui
    $wizardInvokeCount = $script:InvokeCount
    $wizardUi = & $guiModule {
        param($PackageRoot, $GuiHooks)
        New-FenneviaGuiWizardWindow -PackageRoot $PackageRoot -Hooks $GuiHooks
    } $canonicalRelease $resolved
    $largeUiFont = $null
    try {
        Assert-Equal -Actual $wizardUi.Form.Font.Name -Expected ([System.Drawing.SystemFonts]::MessageBoxFont.Name) -Message "The wizard should use Windows' localized UI font instead of the legacy WinForms default."
        Assert-Equal -Actual $wizardUi.Form.AutoScaleMode -Expected ([System.Windows.Forms.AutoScaleMode]::Dpi) -Message "The wizard should scale its complete layout for the active display DPI."

        $dpiScale = [Math]::Max(1.0, ([double] $wizardUi.Form.DeviceDpi / 96.0))
        $minimumScaledClientWidth = [int] [Math]::Round(520 * $dpiScale)
        $minimumScaledClientHeight = [int] [Math]::Round(380 * $dpiScale)
        Assert-True -Condition ($wizardUi.Form.ClientSize.Width -ge $minimumScaledClientWidth) -Message "The DPI-aware form must scale its client width with its text."
        Assert-True -Condition ($wizardUi.Form.ClientSize.Height -ge $minimumScaledClientHeight) -Message "The DPI-aware form must scale its client height with its text."

        $initialSize = $wizardUi.Form.Size
        $wizardUi.Form.Size = $wizardUi.Form.MinimumSize
        $wizardUi.Next.Text = "Continue as administrator"
        $wizardUi.Form.PerformLayout()
        Assert-True -Condition ($wizardUi.Back.Right -le $wizardUi.Next.Left) -Message "The responsive footer must keep Back separate from the primary action."
        Assert-True -Condition ($wizardUi.Next.Right -le $wizardUi.Cancel.Left) -Message "A long primary action must not overlap Cancel at the minimum window size."
        Assert-True -Condition ($wizardUi.Cancel.Right -le $wizardUi.ButtonRow.ClientSize.Width) -Message "Footer actions must remain inside the window at its minimum size."

        $largeUiFont = New-Object System.Drawing.Font($wizardUi.Form.Font.FontFamily, 14)
        $wizardUi.Form.Font = $largeUiFont
        $wizardUi.Form.PerformLayout()
        $welcomeText = $wizardUi.Body.Controls[0]
        Assert-True -Condition ($welcomeText -is [System.Windows.Forms.RichTextBox]) -Message "Long wizard guidance should use a wrapping, scrollable text surface."
        Assert-True -Condition ([bool] $welcomeText.ReadOnly -and [bool] $welcomeText.WordWrap) -Message "Wizard guidance should wrap without becoming editable."
        Assert-Equal -Actual $welcomeText.ScrollBars -Expected ([System.Windows.Forms.RichTextBoxScrollBars]::Vertical) -Message "Enlarged wizard guidance should retain a complete vertical reading path."
        $wizardUi.Form.Font = [System.Drawing.SystemFonts]::MessageBoxFont
        $largeUiFont.Dispose()
        $largeUiFont = $null
        $wizardUi.Form.Size = $initialSize
        $wizardUi.Form.PerformLayout()

        Invoke-FenneviaGuiControlClick -Control $wizardUi.Next
        Assert-Equal -Actual $wizardUi.Page -Expected "license" -Message "Clicking Next must resolve the module-private wizard handler after window creation returns."
        Invoke-FenneviaGuiControlClick -Control $wizardUi.Back
        Assert-Equal -Actual $wizardUi.Page -Expected "welcome" -Message "Clicking Back must resolve the module-private wizard handler after window creation returns."

        Invoke-FenneviaGuiControlClick -Control $wizardUi.Next
        Invoke-FenneviaGuiControlClick -Control $wizardUi.Next
        Invoke-FenneviaGuiControlClick -Control $wizardUi.Next
        Assert-Equal -Actual $wizardUi.Page -Expected "firefox" -Message "The wizard should reach Firefox selection through real button events."
        $firefoxList = @(Get-FenneviaGuiDescendantControl -Control $wizardUi.Body -ControlType ([System.Windows.Forms.ListBox]))[0]
        $firefoxList.SelectedIndex = 0
        Assert-Equal -Actual $wizardUi.Session.FirefoxPath -Expected "C:\hidden\firefox.exe" -Message "Firefox selection events should update the session in module scope."

        Invoke-FenneviaGuiControlClick -Control $wizardUi.Next
        Assert-Equal -Actual $wizardUi.Page -Expected "profile" -Message "The wizard should reach registered-profile selection."
        $profileList = @(Get-FenneviaGuiDescendantControl -Control $wizardUi.Body -ControlType ([System.Windows.Forms.ListBox]))[0]
        $profileList.SelectedIndex = 0
        Assert-Equal -Actual $wizardUi.Session.ProfileName -Expected "work" -Message "Profile selection events should retain nested console helper access."

        Invoke-FenneviaGuiControlClick -Control $wizardUi.Next
        Assert-Equal -Actual $wizardUi.Page -Expected "action" -Message "The wizard should reach action selection."
        $actionList = @(Get-FenneviaGuiDescendantControl -Control $wizardUi.Body -ControlType ([System.Windows.Forms.ListBox]))[0]
        $installIndex = -1
        for ($index = 0; $index -lt $wizardUi.Actions.Count; $index++) {
            if ([string] $wizardUi.Actions[$index].Id -ceq "install") {
                $installIndex = $index
                break
            }
        }
        Assert-True -Condition ($installIndex -ge 0) -Message "The release wizard should expose Install."
        $actionList.SelectedIndex = $installIndex

        Invoke-FenneviaGuiControlClick -Control $wizardUi.Next
        Assert-Equal -Actual $wizardUi.Page -Expected "support" -Message "Install should require the Firefox support warning."
        $supportCheck = @(Get-FenneviaGuiDescendantControl -Control $wizardUi.Body -ControlType ([System.Windows.Forms.CheckBox]))[0]
        $supportCheck.Checked = $true
        Invoke-FenneviaGuiControlClick -Control $wizardUi.Next
        Assert-Equal -Actual $wizardUi.Page -Expected "plan" -Message "Acknowledging support should reach plan confirmation."
        $planCheck = @(Get-FenneviaGuiDescendantControl -Control $wizardUi.Body -ControlType ([System.Windows.Forms.CheckBox]))[0]
        $planCheck.Checked = $true
        Invoke-FenneviaGuiControlClick -Control $wizardUi.Next
        Assert-Equal -Actual $wizardUi.Page -Expected "result" -Message "A confirmed writable plan should apply and reach the result page."
        Assert-Equal -Actual $script:InvokeCount -Expected ($wizardInvokeCount + 1) -Message "The real wizard event flow should invoke the package action exactly once."
    }
    finally {
        if ($null -ne $largeUiFont) {
            $largeUiFont.Dispose()
        }
        & $guiModule {
            $script:FenneviaGuiUi = $null
        }
        $wizardUi.Form.Dispose()
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
