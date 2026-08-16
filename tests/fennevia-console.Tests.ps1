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

function New-TestAnswerReader {
    param(
        [Parameter(Mandatory)]
        [string[]] $Answers
    )

    $queue = New-Object "Collections.Generic.Queue[string]"
    foreach ($answer in $Answers) {
        $queue.Enqueue($answer)
    }
    return {
        param($QuestionId, $Items)
        if ($queue.Count -eq 0) {
            throw "The test reader has no remaining answer for $QuestionId."
        }
        return $queue.Dequeue()
    }.GetNewClosure()
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$releaseRoot = Join-Path ([IO.Path]::GetTempPath()) ("fennevia-console-release-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $releaseRoot | Out-Null
[IO.File]::WriteAllText((Join-Path $releaseRoot "RELEASE-MANIFEST.json"), "{}")

Import-Module (Join-Path $repositoryRoot "scripts\lib\FenneviaConsole.psm1") -Force
Import-Module (Join-Path $repositoryRoot "scripts\lib\FenneviaInstaller.psm1") -Force

try {
    Assert-Equal -Actual (Get-FenneviaConsoleKind -PackageRoot $repositoryRoot) -Expected "Development" -Message "A source tree without RELEASE-MANIFEST.json is Development."
    Assert-Equal -Actual (Get-FenneviaConsoleKind -PackageRoot $releaseRoot) -Expected "Release" -Message "A tree with RELEASE-MANIFEST.json is Release."

    $devIds = @(Get-FenneviaConsoleMenuItems -Kind Development | ForEach-Object { $_.Id })
    $releaseIds = @(Get-FenneviaConsoleMenuItems -Kind Release | ForEach-Object { $_.Id })
    Assert-True -Condition ($devIds -contains "setup") -Message "Development menu must include setup."
    Assert-True -Condition ($devIds -contains "launch") -Message "Development menu must include launch."
    Assert-True -Condition ($devIds -contains "teardown") -Message "Development menu must include teardown."
    Assert-True -Condition ($releaseIds -contains "install") -Message "Release menu must include install."
    Assert-True -Condition ($releaseIds -notcontains "setup") -Message "Release menu must not include development setup."
    Assert-True -Condition ($releaseIds -notcontains "launch") -Message "Release menu must not include launch."
    Assert-True -Condition ($releaseIds -notcontains "teardown") -Message "Release menu must not include teardown."

    $choices = @(
        [pscustomobject]@{ Name = "work"; IsDefault = $false; Path = "C:\hidden\work" },
        [pscustomobject]@{ Name = "default"; IsDefault = $true; Path = "C:\hidden\default" }
    )
    Assert-Throws -Message "An empty profile selection must fail." -Operation {
        Resolve-FenneviaConsoleProfileSelection -Choices $choices -SelectedName "" | Out-Null
    }
    $pending = Resolve-FenneviaConsoleProfileSelection -Choices $choices -SelectedName "default"
    Assert-Equal -Actual $pending.Status -Expected "confirm-default" -Message "Selecting the Firefox default must require a second confirmation."
    $confirmed = Resolve-FenneviaConsoleProfileSelection -Choices $choices -SelectedName "default" -ConfirmDefault
    Assert-Equal -Actual $confirmed.Status -Expected "selected" -Message "An explicit default confirmation should accept the profile."
    $work = Resolve-FenneviaConsoleProfileSelection -Choices $choices -SelectedName "work"
    Assert-Equal -Actual $work.Status -Expected "selected" -Message "A non-default profile should be accepted without a second prompt."

    $unconfirmed = New-FenneviaConsolePackageRequest `
        -Action Install `
        -FirefoxPath "C:\hidden\firefox.exe" `
        -ProfilePath "C:\hidden\profile" `
        -ProfileMode Registered `
        -PackageRoot $repositoryRoot `
        -PlanSha256 ("a" * 64)
    Assert-True -Condition (-not $unconfirmed.Ready) -Message "A package request without confirmation must not be ready."
    Assert-Equal -Actual $unconfirmed.Reason -Expected "confirmation-required" -Message "Missing confirmation should be explicit."

    $noPlan = New-FenneviaConsolePackageRequest `
        -Action Install `
        -FirefoxPath "C:\hidden\firefox.exe" `
        -ProfilePath "C:\hidden\profile" `
        -ProfileMode Registered `
        -PackageRoot $repositoryRoot `
        -Confirmed
    Assert-True -Condition (-not $noPlan.Ready) -Message "A package request without a plan digest must not be ready."

    $ready = New-FenneviaConsolePackageRequest `
        -Action Install `
        -FirefoxPath "C:\hidden\firefox.exe" `
        -ProfilePath "C:\hidden\profile" `
        -ProfileMode Registered `
        -PackageRoot $repositoryRoot `
        -PlanSha256 ("b" * 64) `
        -Confirmed
    Assert-True -Condition $ready.Ready -Message "A confirmed request with a plan digest should be ready."
    Assert-Equal -Actual $ready.ExpectedPlanSha256 -Expected ("b" * 64) -Message "The displayed plan digest must be passed through."

    $script:InvokeCount = 0
    $script:LastRequest = $null
    $script:Written = New-Object "Collections.Generic.List[string]"
    $hooks = @{
        Write = {
            param($Lines)
            foreach ($line in @($Lines)) {
                $script:Written.Add([string] $line)
            }
        }
        GetCandidates = {
            @(
                [pscustomobject]@{
                    FirefoxPath = "C:\hidden\firefox.exe"
                    Label = "Firefox 153.0.4"
                    Version = "153.0.4"
                    BuildID = "20260810162159"
                }
            )
        }
        GetProfileChoices = {
            @(
                [pscustomobject]@{ Name = "work"; IsDefault = $false; Path = "C:\hidden\work" },
                [pscustomobject]@{ Name = "default"; IsDefault = $true; Path = "C:\hidden\default" }
            )
        }
        PreviewPackage = {
            param($Action, $FirefoxPath, $ProfilePath, $ProfileMode)
            [pscustomobject]@{
                Action = $Action
                Status = "planned"
                DryRun = $true
                Applied = $false
                PackageVersion = "0.10.0-beta.1"
                State = "enabled"
                Program = "<FIREFOX_PROGRAM>"
                Profile = "<FENNEVIA_PROFILE>"
                ProfileMode = $ProfileMode
                PlannedMutationCount = 1
                AppliedMutationCount = 0
                PlannedBackupCount = 0
                PlanSha256 = ("c" * 64)
                StartupCacheAction = "none"
                Operations = @([pscustomobject]@{ Kind = "CreateFile"; Scope = "program"; Path = "fennevia.cfg"; DestinationPath = "" })
                Backups = @()
            }
        }
        InvokePackage = {
            param($Request)
            $script:InvokeCount++
            $script:LastRequest = $Request
            throw "InvokePackage should not run when the plan is rejected."
        }
    }

    Invoke-FenneviaConsole -PackageRoot $releaseRoot -Reader (New-TestAnswerReader -Answers @("install", "candidate:0", "work", "no", "quit")) -Hooks $hooks
    Assert-Equal -Actual $script:InvokeCount -Expected 0 -Message "Rejecting the plan must not apply a package mutation."
    Assert-True -Condition (@($script:Written | Where-Object { $_ -match "event=console.cancelled" }).Count -gt 0) -Message "A cancelled plan should emit a console.cancelled event."
    Assert-True -Condition (@($script:Written | Where-Object { $_ -match "C:\\hidden" }).Count -eq 0) -Message "Console output must not disclose injected absolute paths."

    $script:InvokeCount = 0
    $hooks["InvokePackage"] = {
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
            ProfileMode = $Request.ProfileMode
            PlannedMutationCount = 1
            AppliedMutationCount = 1
            PlannedBackupCount = 0
            PlanSha256 = $Request.ExpectedPlanSha256
            StartupCacheAction = "none"
            Operations = @([pscustomobject]@{ Kind = "CreateFile"; Scope = "program"; Path = "fennevia.cfg"; DestinationPath = "" })
            Backups = @()
        }
    }
    Invoke-FenneviaConsole -PackageRoot $releaseRoot -Reader (New-TestAnswerReader -Answers @("install", "candidate:0", "work", "yes", "quit")) -Hooks $hooks
    Assert-Equal -Actual $script:InvokeCount -Expected 1 -Message "Confirming the plan should apply exactly once."
    Assert-Equal -Actual $script:LastRequest.ExpectedPlanSha256 -Expected ("c" * 64) -Message "Apply must reuse the displayed plan digest."
    Assert-Equal -Actual $script:LastRequest.ProfileMode -Expected "Registered" -Message "Release console actions must stay in Registered mode."

    Assert-Throws -Message "A non-interactive console without a reader must fail closed." -Operation {
        Invoke-FenneviaConsole -PackageRoot $releaseRoot -TreatHostAsNonInteractive | Out-Null
    }

    Import-Module (Join-Path $repositoryRoot "scripts\lib\FenneviaTui.psm1") -Force
    $items = @(
        [pscustomobject]@{ Id = "status"; Label = "Status" },
        [pscustomobject]@{ Id = "install"; Label = "Install" },
        [pscustomobject]@{ Id = "quit"; Label = "Quit" }
    )
    $layout = Get-FenneviaTuiLayout `
        -Title "Fennevia Release" `
        -Items $items `
        -LogLines @("event=console.cancelled action=install", "planSha256=" + ("c" * 64)) `
        -SelectedIndex 1 `
        -Width 80 `
        -Height 24
    Assert-Equal -Actual (@($layout.Lines).Count) -Expected 24 -Message "The TUI layout must fill the window in place without extra scroll lines."
    Assert-Equal -Actual ([int] $layout.ListTop) -Expected 4 -Message "The action list must start on the same row as the profile picker kit."
    Assert-True -Condition ([bool] $layout.ShowDetails) -Message "A wide window must keep the log pane beside the list."
    $itemHits = @($layout.Hits | Where-Object { [string] $_.Kind -eq "item" })
    Assert-Equal -Actual $itemHits.Count -Expected 3 -Message "Each visible action must be a mouse hit target."
    Assert-Equal -Actual ([int] $itemHits[1].Y) -Expected 5 -Message "The second action must occupy the row under the first."
    $hit = Resolve-FenneviaTuiMouseHit -Layout $layout -X 5 -Y 5
    Assert-Equal -Actual ([int] $hit.ItemIndex) -Expected 1 -Message "A click on an action row must resolve to that item."
    $miss = Resolve-FenneviaTuiMouseHit -Layout $layout -X 5 -Y 1
    Assert-True -Condition ($null -eq $miss) -Message "A click on the title bar must not select an action."
    $filtered = Get-FenneviaTuiLayout -Title "Fennevia Release" -Items $items -Query "qui" -Width 80 -Height 24
    Assert-Equal -Actual (@($filtered.View).Count) -Expected 1 -Message "Typing in the TUI must filter actions."
    Assert-Equal -Actual ([string] @($filtered.View)[0].Id) -Expected "quit" -Message "Filter matches must keep the original item identity."

    Add-FenneviaTuiLog -Lines @("event=console.status", "C:\hidden\firefox.exe", "\\hidden\share")
    $logLines = @(Get-FenneviaTuiLogLines)
    Assert-True -Condition ($logLines -contains "event=console.status") -Message "Status events must stay in the in-TUI log."
    Assert-True -Condition (@($logLines | Where-Object { $_ -match "hidden" }).Count -eq 0) -Message "The in-TUI log must drop absolute paths."
    Assert-True -Condition (-not (Test-FenneviaTuiHostActive)) -Message "Layout tests must not open a real console host."

    Write-Output "PASS: console kind, menus, profile picker, confirmation, plan-digest, and TUI layout tests."
}
finally {
    Remove-Module FenneviaConsole, FenneviaTui, FenneviaInstaller -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $releaseRoot) {
        Remove-Item -LiteralPath $releaseRoot -Recurse -Force
    }
}
