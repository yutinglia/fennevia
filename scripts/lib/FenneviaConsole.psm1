#requires -Version 5.1

# SPDX-License-Identifier: MPL-2.0

Set-StrictMode -Version Latest

Import-Module (Join-Path $PSScriptRoot "FenneviaTui.psm1") -Force

function Get-FenneviaConsoleKind {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $PackageRoot
    )

    $releaseManifest = Join-Path $PackageRoot "RELEASE-MANIFEST.json"
    if (Test-Path -LiteralPath $releaseManifest -PathType Leaf) {
        return "Release"
    }
    return "Development"
}

function Get-FenneviaConsoleMenuItems {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateSet("Development", "Release")]
        [string] $Kind
    )

    if ($Kind -eq "Release") {
        return @(
            [pscustomobject]@{ Id = "status"; Label = "Status" },
            [pscustomobject]@{ Id = "install"; Label = "Install" },
            [pscustomobject]@{ Id = "update"; Label = "Update" },
            [pscustomobject]@{ Id = "repair"; Label = "Repair" },
            [pscustomobject]@{ Id = "disable"; Label = "Disable" },
            [pscustomobject]@{ Id = "enable"; Label = "Enable" },
            [pscustomobject]@{ Id = "uninstall"; Label = "Uninstall" },
            [pscustomobject]@{ Id = "quit"; Label = "Quit" }
        )
    }

    return @(
        [pscustomobject]@{ Id = "status"; Label = "Status" },
        [pscustomobject]@{ Id = "setup"; Label = "Setup / Install development environment" },
        [pscustomobject]@{ Id = "update"; Label = "Update package" },
        [pscustomobject]@{ Id = "launch"; Label = "Launch Firefox" },
        [pscustomobject]@{ Id = "disable"; Label = "Disable" },
        [pscustomobject]@{ Id = "enable"; Label = "Enable" },
        [pscustomobject]@{ Id = "repair"; Label = "Repair" },
        [pscustomobject]@{ Id = "teardown"; Label = "Uninstall / teardown" },
        [pscustomobject]@{ Id = "quit"; Label = "Quit" }
    )
}

function Test-FenneviaConsoleInteractive {
    [CmdletBinding()]
    param()

    try {
        if ([Console]::IsInputRedirected -or [Console]::IsOutputRedirected) {
            return $false
        }
    }
    catch {
        return $false
    }

    return $true
}

function Resolve-FenneviaConsoleProfileSelection {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [object[]] $Choices,

        [string] $SelectedName = "",

        [switch] $ConfirmDefault
    )

    if ([string]::IsNullOrWhiteSpace($SelectedName)) {
        throw "A registered Firefox profile must be selected explicitly."
    }

    $exact = @($Choices | Where-Object { [string] $_.Name -ceq $SelectedName })
    if ($exact.Count -eq 0) {
        $exact = @($Choices | Where-Object { [string] $_.Name -eq $SelectedName })
    }
    if ($exact.Count -ne 1) {
        throw "The selected Firefox profile name is missing or ambiguous."
    }

    $choice = $exact[0]
    if ([bool] $choice.IsDefault -and -not $ConfirmDefault) {
        return [pscustomobject]@{
            Status = "confirm-default"
            Name = [string] $choice.Name
            Path = [string] $choice.Path
            IsDefault = $true
        }
    }

    return [pscustomobject]@{
        Status = "selected"
        Name = [string] $choice.Name
        Path = [string] $choice.Path
        IsDefault = [bool] $choice.IsDefault
    }
}

function New-FenneviaConsolePackageRequest {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateSet("Install", "Update", "Repair", "Disable", "Enable", "Uninstall")]
        [string] $Action,

        [Parameter(Mandatory)]
        [string] $FirefoxPath,

        [Parameter(Mandatory)]
        [string] $ProfilePath,

        [Parameter(Mandatory)]
        [ValidateSet("Development", "Registered")]
        [string] $ProfileMode,

        [Parameter(Mandatory)]
        [string] $PackageRoot,

        [string] $PlanSha256 = "",

        [switch] $Confirmed
    )

    if (-not $Confirmed) {
        return [pscustomobject]@{
            Ready = $false
            Reason = "confirmation-required"
            Action = $Action
            ExpectedPlanSha256 = ""
        }
    }
    if ($PlanSha256 -notmatch "^[0-9a-f]{64}$") {
        return [pscustomobject]@{
            Ready = $false
            Reason = "plan-required"
            Action = $Action
            ExpectedPlanSha256 = ""
        }
    }

    return [pscustomobject]@{
        Ready = $true
        Reason = "ready"
        Action = $Action
        FirefoxPath = $FirefoxPath
        ProfilePath = $ProfilePath
        ProfileMode = $ProfileMode
        PackageRoot = $PackageRoot
        ExpectedPlanSha256 = $PlanSha256
    }
}

function ConvertTo-FenneviaConsoleYesNoItems {
    [CmdletBinding()]
    param()

    return @(
        [pscustomobject]@{ Id = "yes"; Label = "Yes" },
        [pscustomobject]@{ Id = "no"; Label = "No" }
    )
}

function Read-FenneviaConsoleChoice {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $QuestionId,

        [Parameter(Mandatory)]
        [string] $Title,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [object[]] $Items,

        [scriptblock] $Reader
    )

    if ($null -ne $Reader) {
        return [string] (& $Reader $QuestionId $Items)
    }

    if (Test-FenneviaTuiHostActive) {
        $picked = Invoke-FenneviaTuiPick -Title $Title -Items @($Items) -ListLabel $Title
        if ($null -eq $picked) {
            return "quit"
        }
        if ($Items.Count -eq 0) {
            return [string] $picked
        }
        return [string] $picked.Id
    }

    if ($Items.Count -eq 0) {
        return [string] (Read-Host $Title)
    }

    for ($itemIndex = 0; $itemIndex -lt $Items.Count; $itemIndex++) {
        Write-Host ("{0}. {1}" -f ($itemIndex + 1), $Items[$itemIndex].Label)
    }
    $selected = Read-Host "Select number (or q to cancel)"
    if ($selected -eq "q") {
        return "quit"
    }
    if ($selected -match "^[0-9]+$") {
        $number = [int] $selected
        if ($number -ge 1 -and $number -le $Items.Count) {
            return [string] $Items[$number - 1].Id
        }
    }
    $named = @($Items | Where-Object { [string] $_.Id -eq $selected -or [string] $_.Label -eq $selected })
    if ($named.Count -eq 1) {
        return [string] $named[0].Id
    }
    throw "The selection was empty or not recognized."
}

function Get-FenneviaConsoleDevModulePath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $PackageRoot
    )

    return Join-Path $PackageRoot "scripts\lib\FirefoxDevProfile.psm1"
}

function Initialize-FenneviaConsoleHooks {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $PackageRoot,

        [hashtable] $Hooks
    )

    $resolved = @{}
    if ($null -ne $Hooks) {
        foreach ($key in $Hooks.Keys) {
            $resolved[$key] = $Hooks[$key]
        }
    }

    if (-not $resolved.ContainsKey("Write")) {
        $resolved["Write"] = {
            param($Lines)
            if (Test-FenneviaTuiHostActive) {
                Add-FenneviaTuiLog -Lines $Lines
                return
            }
            foreach ($line in @($Lines)) {
                Write-Output $line
            }
        }
    }
    if (-not $resolved.ContainsKey("GetCandidates")) {
        $resolved["GetCandidates"] = { Get-FenneviaFirefoxProgramCandidates }
    }
    if (-not $resolved.ContainsKey("GetProfileChoices")) {
        $resolved["GetProfileChoices"] = { Get-FenneviaInstallerRegisteredProfileChoices }
    }
    if (-not $resolved.ContainsKey("GetStatus")) {
        $resolved["GetStatus"] = {
            param($FirefoxPath, $ProfilePath, $ProfileMode)
            Get-FenneviaInstallerInstallationStatus -FirefoxPath $FirefoxPath -ProfilePath $ProfilePath -ProfileMode $ProfileMode -PackageRoot $PackageRoot
        }
    }
    if (-not $resolved.ContainsKey("PreviewPackage")) {
        $resolved["PreviewPackage"] = {
            param($Action, $FirefoxPath, $ProfilePath, $ProfileMode)
            Invoke-FenneviaPackageAction -Action $Action -FirefoxPath $FirefoxPath -ProfilePath $ProfilePath -ProfileMode $ProfileMode -PackageRoot $PackageRoot -DryRun
        }
    }
    if (-not $resolved.ContainsKey("InvokePackage")) {
        $resolved["InvokePackage"] = {
            param($Request)
            Invoke-FenneviaPackageAction `
                -Action $Request.Action `
                -FirefoxPath $Request.FirefoxPath `
                -ProfilePath $Request.ProfilePath `
                -ProfileMode $Request.ProfileMode `
                -PackageRoot $Request.PackageRoot `
                -ExpectedPlanSha256 $Request.ExpectedPlanSha256
        }
    }

    $devModule = Get-FenneviaConsoleDevModulePath -PackageRoot $PackageRoot
    if (Test-Path -LiteralPath $devModule -PathType Leaf) {
        if ($null -eq (Get-Module FirefoxDevProfile)) {
            Import-Module $devModule -Force
        }
        if (-not $resolved.ContainsKey("GetDefaultProgramCopyPath")) {
            $resolved["GetDefaultProgramCopyPath"] = { Get-FenneviaDefaultProgramCopyPath }
        }
        if (-not $resolved.ContainsKey("GetDefaultProfilePath")) {
            $resolved["GetDefaultProfilePath"] = { Get-FenneviaDefaultProfilePath }
        }
        if (-not $resolved.ContainsKey("GetStockCandidates")) {
            $resolved["GetStockCandidates"] = { Get-FenneviaFirefoxExecutableCandidates }
        }
        if (-not $resolved.ContainsKey("TestProgramCopy")) {
            $resolved["TestProgramCopy"] = { Test-FenneviaFirefoxProgramCopy }
        }
        if (-not $resolved.ContainsKey("NewProgramCopy")) {
            $resolved["NewProgramCopy"] = {
                param($SourceFirefoxPath)
                New-FenneviaFirefoxProgramCopy -SourceFirefoxPath $SourceFirefoxPath -Confirm:$false
            }
        }
        if (-not $resolved.ContainsKey("RemoveProgramCopy")) {
            $resolved["RemoveProgramCopy"] = {
                Remove-FenneviaFirefoxProgramCopy -Force -Confirm:$false
            }
        }
        if (-not $resolved.ContainsKey("TestProfile")) {
            $resolved["TestProfile"] = { Test-FenneviaFirefoxDevProfile }
        }
        if (-not $resolved.ContainsKey("InitializeProfile")) {
            $resolved["InitializeProfile"] = { Initialize-FenneviaFirefoxDevProfile }
        }
        if (-not $resolved.ContainsKey("RemoveProfile")) {
            $resolved["RemoveProfile"] = {
                Remove-FenneviaFirefoxDevProfile -Force -Confirm:$false
            }
        }
        if (-not $resolved.ContainsKey("GetEnvironment")) {
            $resolved["GetEnvironment"] = {
                param($FirefoxPath)
                Get-FenneviaFirefoxEnvironmentRecord -FirefoxPath $FirefoxPath -ProjectRoot $PackageRoot
            }
        }
        if (-not $resolved.ContainsKey("StartProfile")) {
            $resolved["StartProfile"] = {
                param($FirefoxPath, $Page, $BrowserConsole, $BrowserToolbox, $SecondWindow, $PrivateWindow)
                Start-FenneviaFirefoxDevProfile `
                    -FirefoxPath $FirefoxPath `
                    -Page $Page `
                    -BrowserConsole:$BrowserConsole `
                    -BrowserToolbox:$BrowserToolbox `
                    -SecondWindow:$SecondWindow `
                    -PrivateWindow:$PrivateWindow
            }
        }
        if (-not $resolved.ContainsKey("InvokeBuild")) {
            $resolved["InvokeBuild"] = {
                $npm = Get-Command npm -ErrorAction SilentlyContinue
                if ($null -eq $npm) {
                    throw "npm was not found. Select the Node.js version from .nvmrc before building."
                }
                Push-Location -LiteralPath $PackageRoot
                try {
                    & $npm.Source run build
                    if ($LASTEXITCODE -ne 0) {
                        throw "npm run build failed."
                    }
                }
                finally {
                    Pop-Location
                }
            }
        }
    }

    return $resolved
}

function Invoke-FenneviaConsoleHook {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [hashtable] $Hooks,

        [Parameter(Mandatory)]
        [string] $Name,

        [object[]] $Arguments = @()
    )

    if (-not $Hooks.ContainsKey($Name) -or $null -eq $Hooks[$Name]) {
        throw "The Fennevia console hook '$Name' is not available in this package tree."
    }
    return & $Hooks[$Name] @Arguments
}

function Get-FenneviaConsoleFirefoxSupportWarning {
    [CmdletBinding()]
    param(
        [AllowNull()]
        [object] $Plan
    )

    $testedText = "153 and 154"
    $kind = ""
    $majors = "153,154"
    $warning = "Fennevia is only tested on Firefox 153 and 154. Later Firefox versions may break the shell. Confirming install does not promise that everything will work."
    if ($null -ne $Plan) {
        if ($null -ne $Plan.PSObject.Properties["TestedFirefoxMajors"] -and -not [string]::IsNullOrWhiteSpace([string] $Plan.TestedFirefoxMajors)) {
            $majors = [string] $Plan.TestedFirefoxMajors
            $parts = @(
                $majors.Split(",") |
                    ForEach-Object { $_.Trim() } |
                    Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
            )
            if ($parts.Count -eq 1) {
                $testedText = [string] $parts[0]
            }
            elseif ($parts.Count -eq 2) {
                $testedText = "$($parts[0]) and $($parts[1])"
            }
            elseif ($parts.Count -gt 2) {
                $head = $parts[0..($parts.Count - 2)] -join ", "
                $testedText = "$head, and $($parts[$parts.Count - 1])"
            }
            $warning = "Fennevia is only tested on Firefox $testedText. Later Firefox versions may break the shell. Confirming install does not promise that everything will work."
        }
        elseif ($null -ne $Plan.PSObject.Properties["FirefoxSupportWarning"] -and -not [string]::IsNullOrWhiteSpace([string] $Plan.FirefoxSupportWarning)) {
            $warning = [string] $Plan.FirefoxSupportWarning
        }
        if ($null -ne $Plan.PSObject.Properties["CompatibilityKind"] -and -not [string]::IsNullOrWhiteSpace([string] $Plan.CompatibilityKind)) {
            $kind = [string] $Plan.CompatibilityKind
        }
    }

    $lines = New-Object "Collections.Generic.List[string]"
    $lines.Add("event=console.firefox-support-warning")
    $lines.Add("testedFirefox=$majors")
    if (-not [string]::IsNullOrWhiteSpace($kind)) {
        $lines.Add("compatibilityKind=$kind")
    }
    $lines.Add("warning=$warning")
    return [pscustomobject]@{
        Lines = $lines.ToArray()
        Title = "Tested only on Firefox $testedText. Continue with no working promise?"
        Warning = $warning
    }
}

function Read-FenneviaConsoleConfirmation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $QuestionId,

        [Parameter(Mandatory)]
        [string] $Title,

        [scriptblock] $Reader
    )

    $answer = Read-FenneviaConsoleChoice -QuestionId $QuestionId -Title $Title -Items (ConvertTo-FenneviaConsoleYesNoItems) -Reader $Reader
    return $answer -eq "yes"
}

function Resolve-FenneviaConsoleFirefoxSelection {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [object[]] $Candidates,

        [scriptblock] $Reader
    )

    $items = @()
    $index = 0
    foreach ($candidate in @($Candidates)) {
        $label = [string] $candidate.Label
        if (-not [string]::IsNullOrWhiteSpace([string] $candidate.BuildID)) {
            $label += " BuildID $($candidate.BuildID)"
        }
        $items += [pscustomobject]@{
            Id = "candidate:$index"
            Label = $label
            FirefoxPath = [string] $candidate.FirefoxPath
        }
        $index++
    }
    $items += [pscustomobject]@{ Id = "enter-path"; Label = "Enter a firefox.exe path"; FirefoxPath = "" }

    $selected = Read-FenneviaConsoleChoice -QuestionId "firefox-candidate" -Title "Select firefox.exe" -Items $items -Reader $Reader
    if ($selected -eq "quit") {
        return $null
    }
    if ($selected -eq "enter-path") {
        $entered = Read-FenneviaConsoleChoice -QuestionId "firefox-path" -Title "Enter the absolute firefox.exe path" -Items @() -Reader $Reader
        if ([string]::IsNullOrWhiteSpace($entered) -or $entered -eq "quit") {
            return $null
        }
        return $entered
    }
    $match = @($items | Where-Object { [string] $_.Id -eq $selected })
    if ($match.Count -ne 1 -or [string]::IsNullOrWhiteSpace([string] $match[0].FirefoxPath)) {
        throw "The selected Firefox program was empty or not recognized."
    }
    return [string] $match[0].FirefoxPath
}

function Resolve-FenneviaConsoleRegisteredProfile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [object[]] $Choices,

        [scriptblock] $Reader,

        [hashtable] $Hooks
    )

    if ($Choices.Count -eq 0) {
        throw "No Firefox-registered profiles were found. Create a dedicated profile in about:profiles first."
    }

    Invoke-FenneviaConsoleHook -Hooks $Hooks -Name "Write" -Arguments @(, (ConvertTo-FenneviaInstallerProfileChoiceLines -Choices $Choices))
    $items = @(
        $Choices |
            ForEach-Object {
                $label = [string] $_.Name
                if ([bool] $_.IsDefault) {
                    $label += " (Firefox default)"
                }
                [pscustomobject]@{ Id = [string] $_.Name; Label = $label }
            }
    )
    $selectedName = Read-FenneviaConsoleChoice -QuestionId "profile-name" -Title "Select a registered Firefox profile" -Items $items -Reader $Reader
    if ($selectedName -eq "quit") {
        return $null
    }

    $selection = Resolve-FenneviaConsoleProfileSelection -Choices $Choices -SelectedName $selectedName
    if ($selection.Status -eq "confirm-default") {
        $confirmed = Read-FenneviaConsoleConfirmation -QuestionId "confirm-default-profile" -Title "The selected profile is Firefox's default. Use it anyway?" -Reader $Reader
        if (-not $confirmed) {
            return $null
        }
        $selection = Resolve-FenneviaConsoleProfileSelection -Choices $Choices -SelectedName $selectedName -ConfirmDefault
    }
    return $selection
}

function Invoke-FenneviaConsolePackageFlow {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Action,

        [Parameter(Mandatory)]
        [string] $FirefoxPath,

        [Parameter(Mandatory)]
        [string] $ProfilePath,

        [Parameter(Mandatory)]
        [string] $ProfileMode,

        [Parameter(Mandatory)]
        [string] $PackageRoot,

        [Parameter(Mandatory)]
        [hashtable] $Hooks,

        [scriptblock] $Reader
    )

    $plan = Invoke-FenneviaConsoleHook -Hooks $Hooks -Name "PreviewPackage" -Arguments @($Action, $FirefoxPath, $ProfilePath, $ProfileMode)
    $planLines = ConvertTo-FenneviaInstallerResultLines -Result $plan
    Invoke-FenneviaConsoleHook -Hooks $Hooks -Name "Write" -Arguments @(, $planLines)
    if ([int] $plan.PlannedMutationCount -eq 0) {
        return
    }

    if ($Action -in @("Install", "Update", "Repair", "Enable")) {
        $supportWarning = Get-FenneviaConsoleFirefoxSupportWarning -Plan $plan
        Invoke-FenneviaConsoleHook -Hooks $Hooks -Name "Write" -Arguments @(, $supportWarning.Lines)
        $acknowledged = Read-FenneviaConsoleConfirmation -QuestionId "confirm-firefox-support" -Title $supportWarning.Title -Reader $Reader
        if (-not $acknowledged) {
            Invoke-FenneviaConsoleHook -Hooks $Hooks -Name "Write" -Arguments @(, @("event=console.cancelled action=$($Action.ToLowerInvariant()) reason=firefox-support-unacknowledged"))
            return
        }
    }

    $confirmed = Read-FenneviaConsoleConfirmation -QuestionId "confirm-plan" -Title "Apply the displayed $Action plan?" -Reader $Reader
    $request = New-FenneviaConsolePackageRequest `
        -Action $Action `
        -FirefoxPath $FirefoxPath `
        -ProfilePath $ProfilePath `
        -ProfileMode $ProfileMode `
        -PackageRoot $PackageRoot `
        -PlanSha256 ([string] $plan.PlanSha256) `
        -Confirmed:$confirmed
    if (-not $request.Ready) {
        Invoke-FenneviaConsoleHook -Hooks $Hooks -Name "Write" -Arguments @(, @("event=console.cancelled action=$($Action.ToLowerInvariant()) reason=$($request.Reason)"))
        return
    }

    $result = Invoke-FenneviaConsoleHook -Hooks $Hooks -Name "InvokePackage" -Arguments @($request)
    Invoke-FenneviaConsoleHook -Hooks $Hooks -Name "Write" -Arguments @(, (ConvertTo-FenneviaInstallerResultLines -Result $result))
}

function Ensure-FenneviaConsoleReleaseTargets {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [hashtable] $Session,

        [Parameter(Mandatory)]
        [hashtable] $Hooks,

        [scriptblock] $Reader
    )

    if ([string]::IsNullOrWhiteSpace([string] $Session.FirefoxPath)) {
        $candidates = @(Invoke-FenneviaConsoleHook -Hooks $Hooks -Name "GetCandidates")
        Invoke-FenneviaConsoleHook -Hooks $Hooks -Name "Write" -Arguments @(, (ConvertTo-FenneviaInstallerProgramCandidateLines -Candidates $candidates))
        $Session.FirefoxPath = Resolve-FenneviaConsoleFirefoxSelection -Candidates $candidates -Reader $Reader
        if ([string]::IsNullOrWhiteSpace([string] $Session.FirefoxPath)) {
            return $false
        }
    }
    if ([string]::IsNullOrWhiteSpace([string] $Session.ProfilePath)) {
        $choices = @(Invoke-FenneviaConsoleHook -Hooks $Hooks -Name "GetProfileChoices")
        $selection = Resolve-FenneviaConsoleRegisteredProfile -Choices $choices -Reader $Reader -Hooks $Hooks
        if ($null -eq $selection) {
            return $false
        }
        $Session.ProfilePath = $selection.Path
        $Session.ProfileName = $selection.Name
    }
    return $true
}

function Ensure-FenneviaConsoleDevelopmentTargets {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [hashtable] $Session,

        [Parameter(Mandatory)]
        [hashtable] $Hooks
    )

    $programCopy = Invoke-FenneviaConsoleHook -Hooks $Hooks -Name "TestProgramCopy"
    if (-not [bool] $programCopy.IsValid) {
        throw "The marker-owned Firefox program copy is not ready. Run Setup / Install first."
    }
    $profile = Invoke-FenneviaConsoleHook -Hooks $Hooks -Name "TestProfile"
    if (-not [bool] $profile.IsValid) {
        throw "The marker-owned Firefox development profile is not ready. Run Setup / Install first."
    }
    $Session.FirefoxPath = [string] $programCopy.FirefoxPath
    $Session.ProfilePath = [string] $profile.ProfilePath
}

function Invoke-FenneviaConsoleDevelopmentSetup {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [hashtable] $Session,

        [Parameter(Mandatory)]
        [hashtable] $Hooks,

        [scriptblock] $Reader,

        [Parameter(Mandatory)]
        [string] $PackageRoot
    )

    $stockCandidates = @(Invoke-FenneviaConsoleHook -Hooks $Hooks -Name "GetStockCandidates")
    $candidateObjects = @(
        $stockCandidates |
            ForEach-Object {
                [pscustomobject]@{
                    FirefoxPath = $_
                    Label = "Stock firefox.exe"
                    BuildID = ""
                }
            }
    )
    $sourceFirefox = Resolve-FenneviaConsoleFirefoxSelection -Candidates $candidateObjects -Reader $Reader
    if ([string]::IsNullOrWhiteSpace($sourceFirefox)) {
        return
    }

    $programCopy = Invoke-FenneviaConsoleHook -Hooks $Hooks -Name "TestProgramCopy"
    if (-not [bool] $programCopy.IsValid) {
        $copyConfirmed = Read-FenneviaConsoleConfirmation -QuestionId "confirm-copy" -Title "Create the marker-owned Firefox program copy?" -Reader $Reader
        if (-not $copyConfirmed) {
            return
        }
        $programCopy = Invoke-FenneviaConsoleHook -Hooks $Hooks -Name "NewProgramCopy" -Arguments @($sourceFirefox)
    }

    $profile = Invoke-FenneviaConsoleHook -Hooks $Hooks -Name "TestProfile"
    if (-not [bool] $profile.IsValid) {
        $profile = Invoke-FenneviaConsoleHook -Hooks $Hooks -Name "InitializeProfile"
    }

    $Session.FirefoxPath = [string] $programCopy.FirefoxPath
    $Session.ProfilePath = [string] $profile.ProfilePath
    Invoke-FenneviaConsoleHook -Hooks $Hooks -Name "Write" -Arguments @(, @("event=console.setup program=<FIREFOX_PROGRAM> profile=<FENNEVIA_PROFILE>"))
    Invoke-FenneviaConsolePackageFlow `
        -Action "Install" `
        -FirefoxPath $Session.FirefoxPath `
        -ProfilePath $Session.ProfilePath `
        -ProfileMode "Development" `
        -PackageRoot $PackageRoot `
        -Hooks $Hooks `
        -Reader $Reader
}

function Invoke-FenneviaConsole {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $PackageRoot,

        [scriptblock] $Reader,

        [hashtable] $Hooks,

        [switch] $TreatHostAsNonInteractive
    )

    if ($null -eq $Reader -and ($TreatHostAsNonInteractive -or -not (Test-FenneviaConsoleInteractive))) {
        throw "The Fennevia console requires an interactive terminal. Use scripts/fennevia-package.ps1 or scripts/firefox-dev.ps1."
    }

    $installerModule = Join-Path $PackageRoot "scripts\lib\FenneviaInstaller.psm1"
    if ($null -eq (Get-Module FenneviaInstaller)) {
        Import-Module $installerModule -Force
    }

    $kind = Get-FenneviaConsoleKind -PackageRoot $PackageRoot
    $resolvedHooks = Initialize-FenneviaConsoleHooks -PackageRoot $PackageRoot -Hooks $Hooks
    $session = @{
        Kind = $kind
        FirefoxPath = ""
        ProfilePath = ""
        ProfileName = ""
        ProfileMode = if ($kind -eq "Release") { "Registered" } else { "Development" }
    }

    $enteredTui = $false
    if ($null -eq $Reader) {
        $enteredTui = [bool] (Enter-FenneviaTuiHost)
    }
    try {
    while ($true) {
        $items = Get-FenneviaConsoleMenuItems -Kind $kind
        $choice = Read-FenneviaConsoleChoice -QuestionId "menu" -Title "Fennevia $kind" -Items $items -Reader $Reader
        if ([string]::IsNullOrWhiteSpace($choice) -or $choice -eq "quit") {
            return
        }

        switch ($choice) {
            "status" {
                if ($kind -eq "Release") {
                    if (-not (Ensure-FenneviaConsoleReleaseTargets -Session $session -Hooks $resolvedHooks -Reader $Reader)) {
                        break
                    }
                    $status = Invoke-FenneviaConsoleHook -Hooks $resolvedHooks -Name "GetStatus" -Arguments @($session.FirefoxPath, $session.ProfilePath, $session.ProfileMode)
                    Invoke-FenneviaConsoleHook -Hooks $resolvedHooks -Name "Write" -Arguments @(, (ConvertTo-FenneviaInstallerStatusLines -Status $status))
                }
                else {
                    $copy = Invoke-FenneviaConsoleHook -Hooks $resolvedHooks -Name "TestProgramCopy"
                    $profile = Invoke-FenneviaConsoleHook -Hooks $resolvedHooks -Name "TestProfile"
                    $lines = @(
                        "event=console.status",
                        "kind=development",
                        "programCopy=$(if ([bool] $copy.IsValid) { 'valid' } else { 'absent-or-invalid' })",
                        "profile=$(if ([bool] $profile.IsValid) { 'valid' } else { 'absent-or-invalid' })"
                    )
                    Invoke-FenneviaConsoleHook -Hooks $resolvedHooks -Name "Write" -Arguments @(, $lines)
                    if ([bool] $copy.IsValid -and [bool] $profile.IsValid) {
                        $status = Invoke-FenneviaConsoleHook -Hooks $resolvedHooks -Name "GetStatus" -Arguments @($copy.FirefoxPath, $profile.ProfilePath, "Development")
                        Invoke-FenneviaConsoleHook -Hooks $resolvedHooks -Name "Write" -Arguments @(, (ConvertTo-FenneviaInstallerStatusLines -Status $status))
                        $environment = Invoke-FenneviaConsoleHook -Hooks $resolvedHooks -Name "GetEnvironment" -Arguments @($copy.FirefoxPath)
                        Invoke-FenneviaConsoleHook -Hooks $resolvedHooks -Name "Write" -Arguments @(, $environment)
                    }
                }
            }
            "setup" {
                if ($kind -ne "Development") {
                    throw "Setup is available only in a source-tree development console."
                }
                Invoke-FenneviaConsoleDevelopmentSetup -Session $session -Hooks $resolvedHooks -Reader $Reader -PackageRoot $PackageRoot
            }
            "install" {
                if ($kind -ne "Release") {
                    throw "Release Install is available only from an extracted release tree."
                }
                if (-not (Ensure-FenneviaConsoleReleaseTargets -Session $session -Hooks $resolvedHooks -Reader $Reader)) {
                    break
                }
                Invoke-FenneviaConsolePackageFlow -Action "Install" -FirefoxPath $session.FirefoxPath -ProfilePath $session.ProfilePath -ProfileMode "Registered" -PackageRoot $PackageRoot -Hooks $resolvedHooks -Reader $Reader
            }
            { $_ -in @("update", "repair", "disable", "enable") } {
                if ($kind -eq "Release") {
                    if (-not (Ensure-FenneviaConsoleReleaseTargets -Session $session -Hooks $resolvedHooks -Reader $Reader)) {
                        break
                    }
                }
                else {
                    Ensure-FenneviaConsoleDevelopmentTargets -Session $session -Hooks $resolvedHooks
                    if ($choice -eq "update") {
                        $buildFirst = Read-FenneviaConsoleConfirmation -QuestionId "build-first" -Title "Run npm run build before Update?" -Reader $Reader
                        if ($buildFirst) {
                            Invoke-FenneviaConsoleHook -Hooks $resolvedHooks -Name "InvokeBuild"
                        }
                    }
                }
                $action = $choice.Substring(0, 1).ToUpperInvariant() + $choice.Substring(1)
                Invoke-FenneviaConsolePackageFlow -Action $action -FirefoxPath $session.FirefoxPath -ProfilePath $session.ProfilePath -ProfileMode $session.ProfileMode -PackageRoot $PackageRoot -Hooks $resolvedHooks -Reader $Reader
            }
            "uninstall" {
                if ($kind -ne "Release") {
                    throw "Use Teardown in the development console."
                }
                if (-not (Ensure-FenneviaConsoleReleaseTargets -Session $session -Hooks $resolvedHooks -Reader $Reader)) {
                    break
                }
                Invoke-FenneviaConsolePackageFlow -Action "Uninstall" -FirefoxPath $session.FirefoxPath -ProfilePath $session.ProfilePath -ProfileMode "Registered" -PackageRoot $PackageRoot -Hooks $resolvedHooks -Reader $Reader
            }
            "teardown" {
                if ($kind -ne "Development") {
                    throw "Teardown is available only in a source-tree development console."
                }
                Ensure-FenneviaConsoleDevelopmentTargets -Session $session -Hooks $resolvedHooks
                Invoke-FenneviaConsolePackageFlow -Action "Uninstall" -FirefoxPath $session.FirefoxPath -ProfilePath $session.ProfilePath -ProfileMode "Development" -PackageRoot $PackageRoot -Hooks $resolvedHooks -Reader $Reader
                if (Read-FenneviaConsoleConfirmation -QuestionId "confirm-remove-profile" -Title "Remove the marker-owned development profile?" -Reader $Reader) {
                    [void] (Invoke-FenneviaConsoleHook -Hooks $resolvedHooks -Name "RemoveProfile")
                    Invoke-FenneviaConsoleHook -Hooks $resolvedHooks -Name "Write" -Arguments @(, @("event=console.removed target=profile"))
                }
                if (Read-FenneviaConsoleConfirmation -QuestionId "confirm-remove-program" -Title "Remove the marker-owned Firefox program copy?" -Reader $Reader) {
                    [void] (Invoke-FenneviaConsoleHook -Hooks $resolvedHooks -Name "RemoveProgramCopy")
                    Invoke-FenneviaConsoleHook -Hooks $resolvedHooks -Name "Write" -Arguments @(, @("event=console.removed target=program"))
                }
                $session.FirefoxPath = ""
                $session.ProfilePath = ""
            }
            "launch" {
                if ($kind -ne "Development") {
                    throw "Launch is available only in a source-tree development console."
                }
                Ensure-FenneviaConsoleDevelopmentTargets -Session $session -Hooks $resolvedHooks
                $page = Read-FenneviaConsoleChoice -QuestionId "launch-page" -Title "Launch page" -Items @(
                    [pscustomobject]@{ Id = "about:blank"; Label = "about:blank" },
                    [pscustomobject]@{ Id = "about:support"; Label = "about:support" },
                    [pscustomobject]@{ Id = "about:profiles"; Label = "about:profiles" }
                ) -Reader $Reader
                if ($page -eq "quit") {
                    break
                }
                $mode = Read-FenneviaConsoleChoice -QuestionId "launch-mode" -Title "Launch mode" -Items @(
                    [pscustomobject]@{ Id = "normal"; Label = "Normal window" },
                    [pscustomobject]@{ Id = "second"; Label = "Second normal window" },
                    [pscustomobject]@{ Id = "private"; Label = "Private window" },
                    [pscustomobject]@{ Id = "console"; Label = "Browser Console" },
                    [pscustomobject]@{ Id = "toolbox"; Label = "Browser Toolbox" }
                ) -Reader $Reader
                if ($mode -eq "quit") {
                    break
                }
                $process = Invoke-FenneviaConsoleHook -Hooks $resolvedHooks -Name "StartProfile" -Arguments @(
                    $session.FirefoxPath,
                    $page,
                    ($mode -eq "console"),
                    ($mode -eq "toolbox"),
                    ($mode -eq "second"),
                    ($mode -eq "private")
                )
                Invoke-FenneviaConsoleHook -Hooks $resolvedHooks -Name "Write" -Arguments @(, @("event=console.launch processId=$($process.Id) profile=<FENNEVIA_DEV_PROFILE>"))
            }
            default {
                throw "The selected console action is not recognized."
            }
        }
    }
    }
    finally {
        if ($enteredTui) {
            Exit-FenneviaTuiHost
        }
    }
}

Export-ModuleMember -Function @(
    "Get-FenneviaConsoleFirefoxSupportWarning",
    "Get-FenneviaConsoleKind",
    "Get-FenneviaConsoleMenuItems",
    "Initialize-FenneviaConsoleHooks",
    "Invoke-FenneviaConsole",
    "Invoke-FenneviaConsoleHook",
    "New-FenneviaConsolePackageRequest",
    "Resolve-FenneviaConsoleProfileSelection",
    "Test-FenneviaConsoleInteractive"
)
