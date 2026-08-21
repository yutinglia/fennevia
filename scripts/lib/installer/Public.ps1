function ConvertTo-FenneviaInstallerPublicResult {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Plan,

        [Parameter(Mandatory)]
        [bool] $DryRun,

        [Parameter(Mandatory)]
        [int] $AppliedMutationCount,

        [Parameter(Mandatory)]
        [string] $PlanSha256
    )

    $publicOperations = @(
        $Plan.Operations |
            ForEach-Object {
                [pscustomobject]@{
                    Kind = $_.Kind
                    Scope = $_.Scope
                    Path = $_.Path
                    DestinationPath = $_.DestinationPath
                }
            }
    )
    $backupKeys = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    $publicBackups = New-Object "Collections.Generic.List[object]"
    foreach ($operation in $Plan.Operations) {
        if (-not $operation.ExistingOwned -or $operation.Kind -notin @("ReplaceFile", "RemoveFile", "MoveFile")) {
            continue
        }
        $key = "$($operation.Scope):$($operation.Path)"
        if ($backupKeys.Add($key)) {
            $publicBackups.Add([pscustomobject]@{
                Scope = $operation.Scope
                Path = $operation.Path
            })
        }
    }
    $status = if (-not $DryRun -and $publicOperations.Count -gt 0) { "applied" } else { $Plan.Status }
    $compatibility = $null
    if ($null -ne $Plan.PSObject.Properties["Compatibility"]) {
        $compatibility = $Plan.Compatibility
    }
    $compatibilityKind = ""
    $testedFirefoxMajors = ""
    $firefoxSupportWarning = ""
    if ($null -ne $compatibility) {
        $compatibilityKind = [string] $compatibility.Kind
        $testedFirefoxMajors = (@($compatibility.TestedMajors) -join ",")
        $firefoxSupportWarning = [string] $compatibility.Warning
    }
    return [pscustomobject]@{
        Action = $Plan.Action
        Status = $status
        DryRun = $DryRun
        Applied = -not $DryRun -and $publicOperations.Count -gt 0
        PackageVersion = $Plan.PackageVersion
        State = $Plan.State
        Program = "<FIREFOX_PROGRAM>"
        Profile = "<FENNEVIA_PROFILE>"
        ProfileMode = $Plan.Targets.ProfileMode
        PlannedMutationCount = $publicOperations.Count
        AppliedMutationCount = $AppliedMutationCount
        PlannedBackupCount = $publicBackups.Count
        PlanSha256 = $PlanSha256
        StartupCacheAction = "none"
        CompatibilityKind = $compatibilityKind
        TestedFirefoxMajors = $testedFirefoxMajors
        FirefoxSupportWarning = $firefoxSupportWarning
        Operations = $publicOperations
        Backups = $publicBackups.ToArray()
    }
}

function ConvertTo-FenneviaInstallerResultLines {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Result
    )

    $event = if ($Result.DryRun) { "installer.plan" } else { "installer.result" }
    $lines = New-Object "Collections.Generic.List[string]"
    $lines.Add("event=$event")
    $lines.Add("action=$($Result.Action.ToLowerInvariant())")
    $lines.Add("status=$($Result.Status)")
    $lines.Add("program=$($Result.Program)")
    $lines.Add("profile=$($Result.Profile)")
    $lines.Add("profileMode=$($Result.ProfileMode.ToLowerInvariant())")
    $lines.Add("packageVersion=$($Result.PackageVersion)")
    $lines.Add("state=$($Result.State)")
    $lines.Add("plannedMutationCount=$($Result.PlannedMutationCount)")
    $lines.Add("appliedMutationCount=$($Result.AppliedMutationCount)")
    $lines.Add("plannedBackupCount=$($Result.PlannedBackupCount)")
    $lines.Add("planSha256=$($Result.PlanSha256)")
    $lines.Add("startupCacheAction=$($Result.StartupCacheAction)")
    if ($null -ne $Result.PSObject.Properties["CompatibilityKind"] -and -not [string]::IsNullOrWhiteSpace([string] $Result.CompatibilityKind)) {
        $lines.Add("compatibilityKind=$($Result.CompatibilityKind)")
    }
    if ($null -ne $Result.PSObject.Properties["TestedFirefoxMajors"] -and -not [string]::IsNullOrWhiteSpace([string] $Result.TestedFirefoxMajors)) {
        $lines.Add("testedFirefoxMajors=$($Result.TestedFirefoxMajors)")
    }
    if ($null -ne $Result.PSObject.Properties["FirefoxSupportWarning"] -and -not [string]::IsNullOrWhiteSpace([string] $Result.FirefoxSupportWarning)) {
        $lines.Add("firefoxSupportWarning=$($Result.FirefoxSupportWarning)")
    }
    $backupIndex = 0
    foreach ($backup in $Result.Backups) {
        $lines.Add("backup[$backupIndex]=$($backup.Scope):$($backup.Path)")
        $backupIndex++
    }
    $index = 0
    foreach ($operation in $Result.Operations) {
        $value = "$($operation.Kind.ToLowerInvariant()) $($operation.Scope):$($operation.Path)"
        if (-not [string]::IsNullOrWhiteSpace($operation.DestinationPath)) {
            $value += " -> $($operation.Scope):$($operation.DestinationPath)"
        }
        $lines.Add("operation[$index]=$value")
        $index++
    }
    return $lines.ToArray()
}

function Get-FenneviaInstallerInstallationStatus {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $FirefoxPath,

        [Parameter(Mandatory)]
        [string] $ProfilePath,

        [ValidateSet("Development", "Registered")]
        [string] $ProfileMode = "Development",

        [string] $PackageRoot = ""
    )

    $status = [ordered]@{
        Program = "<FIREFOX_PROGRAM>"
        Profile = "<FENNEVIA_PROFILE>"
        ProfileMode = $ProfileMode
        Kind = "unavailable"
        State = "unknown"
        PackageVersion = ""
        FirefoxVersion = ""
        FirefoxBuildID = ""
        InterruptedTransaction = $false
        ProgramWritable = $null
        SelectedFirefoxRunning = $false
        Compatible = $null
        CompatibilityKind = ""
        TestedFirefoxMajors = ""
        FirefoxSupportWarning = ""
        ErrorCode = ""
        Problems = @()
    }

    try {
        $targets = Resolve-FenneviaInstallerTargets -FirefoxPath $FirefoxPath -ProfilePath $ProfilePath -ProfileMode $ProfileMode
        $status.FirefoxVersion = $targets.FirefoxVersion
        $status.FirefoxBuildID = $targets.FirefoxBuildID
        $status.InterruptedTransaction = Test-FenneviaInstallerInterruptedTransaction -Targets $targets
        $status.ProgramWritable = Test-FenneviaInstallerProgramWritable -ProgramRoot $targets.ProgramRoot
        try {
            $status.SelectedFirefoxRunning = Test-FenneviaInstallerSelectedFirefoxRunning -Targets $targets
        }
        catch {
            $status.SelectedFirefoxRunning = $true
            $status.Problems += $_.Exception.Message
        }

        if ($status.InterruptedTransaction) {
            $status.Kind = "interrupted"
            $status.State = "blocked"
            $status.Problems += "A prior Fennevia transaction requires explicit recovery before another package action can run."
        }
        else {
            $ownership = Read-FenneviaInstallerOwnershipState -Targets $targets
            $status.Kind = $ownership.Kind
            if ($ownership.Kind -eq "absent") {
                $status.State = "not-installed"
            }
            elseif ($ownership.Kind -eq "complete") {
                $status.State = [string] $ownership.Pair.Data.State
                $status.PackageVersion = [string] $ownership.Pair.Data.PackageVersion
            }
            else {
                $status.State = [string] $ownership.Survivor.Data.State
                $status.PackageVersion = [string] $ownership.Survivor.Data.PackageVersion
            }
        }

        if (-not [string]::IsNullOrWhiteSpace($PackageRoot) -and (Test-Path -LiteralPath $PackageRoot -PathType Container)) {
            try {
                $package = Read-FenneviaInstallerPackageManifest -PackageRoot $PackageRoot
                if ($null -ne $package.ReleaseManifest) {
                    $releaseModule = Join-Path $script:InstallerModuleRoot "FenneviaRelease.psm1"
                    $releaseModuleInfo = Import-Module $releaseModule -Force -PassThru
                    try {
                        $compatibility = Get-FenneviaReleaseFirefoxCompatibility `
                            -ReleaseManifest $package.ReleaseManifest `
                            -FirefoxVersion $targets.FirefoxVersion `
                            -FirefoxBuildId $targets.FirefoxBuildID
                        $status.Compatible = [bool] $compatibility.Allowed
                        $status.CompatibilityKind = [string] $compatibility.Kind
                        $status.TestedFirefoxMajors = (@($compatibility.TestedMajors) -join ",")
                        $status.FirefoxSupportWarning = [string] $compatibility.Warning
                    }
                    finally {
                        Remove-Module $releaseModuleInfo -ErrorAction SilentlyContinue
                    }
                }
            }
            catch {
                $status.Problems += "The package or release manifest could not be read for compatibility status."
            }
        }
    }
    catch {
        $status.ErrorCode = Get-FenneviaInstallerErrorCode -ErrorRecord $_
        $status.Problems += $_.Exception.Message
    }

    return [pscustomobject]$status
}

function ConvertTo-FenneviaInstallerStatusLines {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Status
    )

    $compatible = if ($null -eq $Status.Compatible) { "n/a" } elseif ([bool] $Status.Compatible) { "yes" } else { "no" }
    $writable = if ($null -eq $Status.ProgramWritable) { "unknown" } elseif ([bool] $Status.ProgramWritable) { "yes" } else { "no" }
    $interrupted = if ([bool] $Status.InterruptedTransaction) { "true" } else { "false" }
    $running = if ([bool] $Status.SelectedFirefoxRunning) { "true" } else { "false" }
    $lines = New-Object "Collections.Generic.List[string]"
    $lines.Add("event=installer.status")
    $lines.Add("program=$($Status.Program)")
    $lines.Add("profile=$($Status.Profile)")
    $lines.Add("profileMode=$($Status.ProfileMode.ToLowerInvariant())")
    $lines.Add("kind=$($Status.Kind)")
    $lines.Add("state=$($Status.State)")
    $lines.Add("packageVersion=$($Status.PackageVersion)")
    $lines.Add("firefoxVersion=$($Status.FirefoxVersion)")
    $lines.Add("firefoxBuildId=$($Status.FirefoxBuildID)")
    $lines.Add("interruptedTransaction=$interrupted")
    $lines.Add("programWritable=$writable")
    $lines.Add("selectedFirefoxRunning=$running")
    $lines.Add("compatible=$compatible")
    if (-not [string]::IsNullOrWhiteSpace([string] $Status.CompatibilityKind)) {
        $lines.Add("compatibilityKind=$($Status.CompatibilityKind)")
    }
    if (-not [string]::IsNullOrWhiteSpace([string] $Status.TestedFirefoxMajors)) {
        $lines.Add("testedFirefoxMajors=$($Status.TestedFirefoxMajors)")
    }
    if (-not [string]::IsNullOrWhiteSpace([string] $Status.FirefoxSupportWarning)) {
        $lines.Add("firefoxSupportWarning=$($Status.FirefoxSupportWarning)")
    }
    if (-not [string]::IsNullOrWhiteSpace([string] $Status.ErrorCode)) {
        $lines.Add("errorCode=$($Status.ErrorCode)")
    }
    $problemIndex = 0
    foreach ($problem in @($Status.Problems)) {
        $lines.Add("problem[$problemIndex]=$problem")
        $problemIndex++
    }
    return $lines.ToArray()
}

function Invoke-FenneviaPackageAction {
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
        [string] $PackageRoot,

        [ValidateSet("Development", "Registered")]
        [string] $ProfileMode = "Development",

        [switch] $DryRun,

        [string] $ExpectedPlanSha256 = "",

        [int] $TestFailureAfterMutation = 0,

        [string] $TestDenyTransactionScope = ""
    )

    $plan = New-FenneviaInstallerActionPlan -Action $Action -FirefoxPath $FirefoxPath -ProfilePath $ProfilePath -PackageRoot $PackageRoot -ProfileMode $ProfileMode
    $planSha256 = Get-FenneviaInstallerPlanSha256 -Plan $plan
    if (-not [string]::IsNullOrWhiteSpace($ExpectedPlanSha256)) {
        if ($ExpectedPlanSha256 -cnotmatch "^[0-9a-f]{64}$") {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_PLAN_INVALID" -Message "The expected plan SHA-256 is invalid."
        }
        if ($planSha256 -cne $ExpectedPlanSha256) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_PLAN_CHANGED" -Message "The package or selected target state changed after preview; review a new dry-run plan."
        }
    }
    if ($DryRun -or $plan.Operations.Count -eq 0) {
        return ConvertTo-FenneviaInstallerPublicResult -Plan $plan -DryRun ([bool] $DryRun) -AppliedMutationCount 0 -PlanSha256 $planSha256
    }

    $mutationCount = Invoke-FenneviaInstallerTransaction -Plan $plan -FailureAfterMutation $TestFailureAfterMutation -TestDenyTransactionScope $TestDenyTransactionScope
    return ConvertTo-FenneviaInstallerPublicResult -Plan $plan -DryRun $false -AppliedMutationCount $mutationCount -PlanSha256 $planSha256
}
