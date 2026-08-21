#requires -Version 5.1

# SPDX-License-Identifier: MPL-2.0

Set-StrictMode -Version Latest

Import-Module (Join-Path $PSScriptRoot "FenneviaInstaller.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "FenneviaConsole.psm1") -Force

$script:GuiStateSchemaVersion = 1
$script:GuiStateOwner = "fennevia-setup"
$script:GuiStateTtlMinutes = 15
$script:GuiStateFilePattern = "^fennevia-setup-state-[0-9a-f]{32}\.json$"
$script:GuiStateMaximumBytes = 65536
$script:GuiMutatingActions = @("Install", "Update", "Repair", "Disable", "Enable", "Uninstall")
$script:GuiSupportWarningActions = @("Install", "Update", "Repair", "Enable")
$script:FenneviaGuiUi = $null

function ConvertTo-FenneviaGuiCanonicalPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    if ([string]::IsNullOrWhiteSpace($Path) -or -not [IO.Path]::IsPathRooted($Path) -or $Path.IndexOfAny([char[]] "*?") -ge 0) {
        throw "Fennevia Setup paths must be explicit absolute paths without wildcards."
    }
    $fullPath = [IO.Path]::GetFullPath($Path)
    $pathRoot = [IO.Path]::GetPathRoot($fullPath)
    if ([string]::Equals($fullPath, $pathRoot, [StringComparison]::OrdinalIgnoreCase)) {
        return $pathRoot
    }
    return $fullPath.TrimEnd("\", "/")
}

function ConvertTo-FenneviaGuiElevationStatePath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    try {
        $canonical = ConvertTo-FenneviaGuiCanonicalPath -Path $Path
        $parent = [IO.Path]::GetDirectoryName($canonical)
        if ([string]::IsNullOrWhiteSpace($parent)) {
            throw "invalid-parent"
        }
        $canonicalParent = ConvertTo-FenneviaGuiCanonicalPath -Path $parent
        $temporaryRoot = ConvertTo-FenneviaGuiCanonicalPath -Path ([IO.Path]::GetTempPath())
    }
    catch {
        throw "Fennevia Setup elevation state paths must use the dedicated temporary-file namespace."
    }

    $fileName = [IO.Path]::GetFileName($canonical)
    if (-not [string]::Equals($canonicalParent, $temporaryRoot, [StringComparison]::OrdinalIgnoreCase) -or $fileName -cnotmatch $script:GuiStateFilePattern) {
        throw "Fennevia Setup elevation state paths must use the dedicated temporary-file namespace."
    }
    return $canonical
}

function ConvertTo-FenneviaGuiSafeErrorMessage {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        $InputObject
    )

    $message = ""
    $exception = $null
    if ($InputObject -is [System.Management.Automation.ErrorRecord]) {
        $exception = $InputObject.Exception
        $message = [string] $InputObject.Exception.Message
    }
    elseif ($InputObject -is [Exception]) {
        $exception = $InputObject
        $message = [string] $InputObject.Message
    }
    else {
        $message = [string] $InputObject
    }
    if ($message -match '[A-Za-z]:\\' -or $message -match '\\\\') {
        $errorClass = "Exception"
        if ($null -ne $exception) {
            $candidate = [string] $exception.GetType().Name
            if ($candidate -in @(
                    "CommandNotFoundException",
                    "DirectoryNotFoundException",
                    "FileLoadException",
                    "FileNotFoundException",
                    "IOException",
                    "RuntimeException",
                    "SecurityException",
                    "UnauthorizedAccessException"
                )) {
                $errorClass = $candidate
            }
        }
        return "Fennevia Setup could not continue (FENNEVIA_GUI_LOCAL_PATH_ERROR; $errorClass). Local path details were omitted. Verify that the complete release was extracted, then retry."
    }
    if ([string]::IsNullOrWhiteSpace($message)) {
        return "Fennevia Setup failed."
    }
    return $message
}

function Test-FenneviaGuiLineHasPath {
    [CmdletBinding()]
    param(
        [AllowNull()]
        [string] $Line
    )

    if ([string]::IsNullOrWhiteSpace($Line)) {
        return $false
    }
    return ($Line -match '[A-Za-z]:\\' -or $Line -match '\\\\')
}

function Add-FenneviaGuiCopyableLines {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Session,

        [AllowEmptyCollection()]
        [string[]] $Lines
    )

    $existing = @($Session.CopyableLines)
    foreach ($line in @($Lines)) {
        $text = [string] $line
        if (Test-FenneviaGuiLineHasPath -Line $text) {
            continue
        }
        $existing += $text
    }
    $Session.CopyableLines = $existing
}

function Assert-FenneviaGuiReleasePackage {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $PackageRoot
    )

    $canonical = ConvertTo-FenneviaGuiCanonicalPath -Path $PackageRoot
    if ((Get-FenneviaConsoleKind -PackageRoot $canonical) -cne "Release") {
        throw "Fennevia Setup only runs from an extracted release. Use scripts\fennevia.ps1 for the development environment."
    }
    $licensePath = Join-Path $canonical "LICENSE"
    if (-not (Test-Path -LiteralPath $licensePath -PathType Leaf)) {
        throw "The release LICENSE file is missing."
    }
    return $canonical
}

function Get-FenneviaGuiLicenseText {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $PackageRoot
    )

    $canonical = ConvertTo-FenneviaGuiCanonicalPath -Path $PackageRoot
    return [IO.File]::ReadAllText((Join-Path $canonical "LICENSE"))
}

function New-FenneviaGuiSession {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $PackageRoot
    )

    $canonical = ConvertTo-FenneviaGuiCanonicalPath -Path $PackageRoot
    return [pscustomobject]@{
        PackageRoot = $canonical
        Action = ""
        FirefoxPath = ""
        FirefoxLabel = ""
        ProfilePath = ""
        ProfileName = ""
        ProfileIsDefault = $false
        DefaultProfileConfirmed = $false
        SupportWarningAcknowledged = $false
        PlanConfirmed = $false
        Plan = $null
        Status = $null
        CopyableLines = @()
        ElevationStatePath = ""
        Result = $null
        ErrorMessage = ""
        ClosedForElevation = $false
    }
}

function Test-FenneviaGuiActionMutates {
    [CmdletBinding()]
    param(
        [string] $Action
    )

    return $Action -in $script:GuiMutatingActions
}

function Test-FenneviaGuiActionNeedsSupportWarning {
    [CmdletBinding()]
    param(
        [string] $Action
    )

    return $Action -in $script:GuiSupportWarningActions
}

function Test-FenneviaGuiNeedsElevation {
    [CmdletBinding()]
    param(
        [string] $Action,

        [AllowNull()]
        [object] $Status
    )

    if (-not (Test-FenneviaGuiActionMutates -Action $Action)) {
        return $false
    }
    if ($null -eq $Status) {
        return $false
    }
    if ($null -eq $Status.PSObject.Properties["ProgramWritable"]) {
        return $false
    }
    if ($Status.ProgramWritable -eq $true) {
        return $false
    }
    if ($Status.ProgramWritable -eq $false) {
        return $true
    }
    return $false
}

function ConvertTo-FenneviaGuiActionName {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Id
    )

    switch ($Id.ToLowerInvariant()) {
        "status" { return "Status" }
        "install" { return "Install" }
        "update" { return "Update" }
        "repair" { return "Repair" }
        "disable" { return "Disable" }
        "enable" { return "Enable" }
        "uninstall" { return "Uninstall" }
        default { throw "The selected Fennevia Setup action is not recognized." }
    }
}

function ConvertTo-FenneviaGuiFirefoxChoiceLabel {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Candidate
    )

    $label = [string] $Candidate.Label
    if ([string]::IsNullOrWhiteSpace($label)) {
        $label = "Firefox"
    }
    if (-not [string]::IsNullOrWhiteSpace([string] $Candidate.BuildID)) {
        $label += " BuildID $($Candidate.BuildID)"
    }
    return $label
}

function ConvertTo-FenneviaGuiProfileChoiceLabel {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Choice
    )

    $label = [string] $Choice.Name
    if ([bool] $Choice.IsDefault) {
        $label += " (Firefox default)"
    }
    return $label
}

function New-FenneviaGuiPackageRequest {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Session
    )

    if ([string]::IsNullOrWhiteSpace([string] $Session.Action) -or -not (Test-FenneviaGuiActionMutates -Action $Session.Action)) {
        return [pscustomobject]@{
            Ready = $false
            Reason = "action-required"
            Action = [string] $Session.Action
            ExpectedPlanSha256 = ""
        }
    }
    if ((Test-FenneviaGuiActionNeedsSupportWarning -Action $Session.Action) -and -not [bool] $Session.SupportWarningAcknowledged) {
        return [pscustomobject]@{
            Ready = $false
            Reason = "firefox-support-unacknowledged"
            Action = $Session.Action
            ExpectedPlanSha256 = ""
        }
    }
    if ($null -ne $Session.Status -and [bool] $Session.Status.SelectedFirefoxRunning) {
        return [pscustomobject]@{
            Ready = $false
            Reason = "firefox-running"
            Action = $Session.Action
            ExpectedPlanSha256 = ""
        }
    }

    $planSha256 = ""
    if ($null -ne $Session.Plan -and $null -ne $Session.Plan.PSObject.Properties["PlanSha256"]) {
        $planSha256 = [string] $Session.Plan.PlanSha256
    }
    return New-FenneviaConsolePackageRequest `
        -Action $Session.Action `
        -FirefoxPath $Session.FirefoxPath `
        -ProfilePath $Session.ProfilePath `
        -ProfileMode Registered `
        -PackageRoot $Session.PackageRoot `
        -PlanSha256 $planSha256 `
        -Confirmed:([bool] $Session.PlanConfirmed)
}

function Invoke-FenneviaGuiStatusQuery {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Session,

        [Parameter(Mandatory)]
        [hashtable] $Hooks
    )

    $status = Invoke-FenneviaConsoleHook -Hooks $Hooks -Name "GetStatus" -Arguments @(
        [string] $Session.FirefoxPath,
        [string] $Session.ProfilePath,
        "Registered"
    )
    $Session.Status = $status
    Add-FenneviaGuiCopyableLines -Session $Session -Lines (ConvertTo-FenneviaInstallerStatusLines -Status $status)
    return $status
}

function Invoke-FenneviaGuiPreview {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Session,

        [Parameter(Mandatory)]
        [hashtable] $Hooks
    )

    $plan = Invoke-FenneviaConsoleHook -Hooks $Hooks -Name "PreviewPackage" -Arguments @(
        [string] $Session.Action,
        [string] $Session.FirefoxPath,
        [string] $Session.ProfilePath,
        "Registered"
    )
    $Session.Plan = $plan
    $Session.PlanConfirmed = $false
    Add-FenneviaGuiCopyableLines -Session $Session -Lines (ConvertTo-FenneviaInstallerResultLines -Result $plan)
    return $plan
}

function Invoke-FenneviaGuiApply {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Session,

        [Parameter(Mandatory)]
        [hashtable] $Hooks
    )

    $request = New-FenneviaGuiPackageRequest -Session $Session
    if (-not [bool] $request.Ready) {
        return $request
    }
    $result = Invoke-FenneviaConsoleHook -Hooks $Hooks -Name "InvokePackage" -Arguments @($request)
    $Session.Result = $result
    Add-FenneviaGuiCopyableLines -Session $Session -Lines (ConvertTo-FenneviaInstallerResultLines -Result $result)
    return $result
}

function Protect-FenneviaGuiElevationStateAcl {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    $canonical = ConvertTo-FenneviaGuiElevationStatePath -Path $Path
    $acl = Get-Acl -LiteralPath $canonical
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($rule in @($acl.Access)) {
        $acl.RemoveAccessRuleSpecific($rule)
    }
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl.SetOwner($sid)
    $access = New-Object Security.AccessControl.FileSystemAccessRule(
        $sid,
        "FullControl",
        "Allow"
    )
    $acl.SetAccessRule($access)
    Set-Acl -LiteralPath $canonical -AclObject $acl
    if (-not (Test-FenneviaGuiElevationStateAcl -Path $canonical)) {
        throw "Fennevia Setup could not protect the administrator continuation state."
    }
}

function Test-FenneviaGuiElevationStateAcl {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    try {
        $canonical = ConvertTo-FenneviaGuiElevationStatePath -Path $Path
        $acl = Get-Acl -LiteralPath $canonical
        $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
        $currentSid = $identity.User.Value
        $ownerSid = $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value
    }
    catch {
        return $false
    }
    if (-not $acl.AreAccessRulesProtected) {
        return $false
    }
    if ($ownerSid -cne $currentSid) {
        return $false
    }
    $rules = @(
        $acl.GetAccessRules($true, $false, [Security.Principal.SecurityIdentifier])
    )
    if ($rules.Count -ne 1) {
        return $false
    }
    foreach ($rule in $rules) {
        if ($rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow) {
            return $false
        }
        if ([string] $rule.IdentityReference.Value -cne $currentSid) {
            return $false
        }
        if ($rule.IsInherited) {
            return $false
        }
        $requiredRights = [Security.AccessControl.FileSystemRights]::FullControl
        if (($rule.FileSystemRights -band $requiredRights) -ne $requiredRights) {
            return $false
        }
    }
    return $true
}

function New-FenneviaGuiElevationState {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Session
    )

    $request = New-FenneviaGuiPackageRequest -Session $Session
    if (-not [bool] $request.Ready) {
        throw "Fennevia Setup cannot request administrator permission before the displayed plan is confirmed."
    }

    $payload = [ordered]@{
        schemaVersion = $script:GuiStateSchemaVersion
        owner = $script:GuiStateOwner
        action = [string] $Session.Action
        firefoxPath = [string] $Session.FirefoxPath
        profilePath = [string] $Session.ProfilePath
        packageRoot = [string] $Session.PackageRoot
        expectedPlanSha256 = [string] $request.ExpectedPlanSha256
        supportWarningAcknowledged = [bool] $Session.SupportWarningAcknowledged
        planConfirmed = $true
        createdUtcTicks = [long] [datetime]::UtcNow.Ticks
    }
    $path = ConvertTo-FenneviaGuiElevationStatePath -Path (Join-Path ([IO.Path]::GetTempPath()) ("fennevia-setup-state-" + [guid]::NewGuid().ToString("N") + ".json"))
    $encoding = New-Object Text.UTF8Encoding $false
    $bytes = $encoding.GetBytes((($payload | ConvertTo-Json -Compress) + [Environment]::NewLine))
    if ($bytes.Length -gt $script:GuiStateMaximumBytes) {
        throw "Fennevia Setup administrator continuation state is too large."
    }

    $stream = $null
    $created = $false
    try {
        $stream = New-Object IO.FileStream(
            $path,
            [IO.FileMode]::CreateNew,
            [IO.FileAccess]::Write,
            [IO.FileShare]::None
        )
        $created = $true
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Flush()
        $stream.Dispose()
        $stream = $null
        Protect-FenneviaGuiElevationStateAcl -Path $path
        $Session.ElevationStatePath = $path
        return $path
    }
    catch {
        $creationError = $_
        if ($null -ne $stream) {
            $stream.Dispose()
        }
        if ($created) {
            try {
                Remove-FenneviaGuiElevationState -Path $path
            }
            catch {
                throw "Fennevia Setup could not securely clean up an administrator continuation state."
            }
        }
        throw $creationError
    }
}

function Remove-FenneviaGuiElevationState {
    [CmdletBinding()]
    param(
        [string] $Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return
    }
    $canonical = ConvertTo-FenneviaGuiElevationStatePath -Path $Path
    if (-not (Test-Path -LiteralPath $canonical -PathType Leaf -ErrorAction Stop)) {
        return
    }
    $item = Get-Item -LiteralPath $canonical -Force -ErrorAction Stop
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Fennevia Setup refused to remove an administrator continuation reparse point."
    }
    Remove-Item -LiteralPath $canonical -Force -ErrorAction Stop
}

function Test-FenneviaGuiElevationState {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path,

        [Parameter(Mandatory)]
        [string] $ExpectedPackageRoot
    )

    $invalid = {
        param($Reason)
        return [pscustomobject]@{
            Valid = $false
            Reason = $Reason
            State = $null
        }
    }

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return & $invalid "missing-file"
    }
    try {
        $canonical = ConvertTo-FenneviaGuiElevationStatePath -Path $Path
    }
    catch {
        return & $invalid "invalid-path"
    }
    try {
        if (-not (Test-Path -LiteralPath $canonical -PathType Leaf -ErrorAction Stop)) {
            return & $invalid "missing-file"
        }
        $item = Get-Item -LiteralPath $canonical -Force -ErrorAction Stop
    }
    catch {
        return & $invalid "missing-file"
    }
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        return & $invalid "reparse"
    }
    if ([long] $item.Length -gt $script:GuiStateMaximumBytes) {
        return & $invalid "size"
    }
    if (-not (Test-FenneviaGuiElevationStateAcl -Path $canonical)) {
        return & $invalid "acl"
    }

    try {
        $raw = [IO.File]::ReadAllText($canonical)
        $state = $raw | ConvertFrom-Json
    }
    catch {
        return & $invalid "invalid-json"
    }

    foreach ($name in @(
            "schemaVersion", "owner", "action", "firefoxPath", "profilePath",
            "packageRoot", "expectedPlanSha256", "supportWarningAcknowledged",
            "planConfirmed", "createdUtcTicks"
        )) {
        if ($null -eq $state.PSObject.Properties[$name]) {
            return & $invalid "schema"
        }
    }
    if ([int] $state.schemaVersion -ne $script:GuiStateSchemaVersion -or [string] $state.owner -cne $script:GuiStateOwner) {
        return & $invalid "schema"
    }
    if ([string] $state.action -notin $script:GuiMutatingActions) {
        return & $invalid "action"
    }
    if ([string]::IsNullOrWhiteSpace([string] $state.firefoxPath) -or [string]::IsNullOrWhiteSpace([string] $state.profilePath)) {
        return & $invalid "empty-target"
    }
    if ([string] $state.expectedPlanSha256 -cnotmatch "^[0-9a-f]{64}$") {
        return & $invalid "plan-invalid"
    }
    if ((Test-FenneviaGuiActionNeedsSupportWarning -Action ([string] $state.action)) -and -not [bool] $state.supportWarningAcknowledged) {
        return & $invalid "support-warning"
    }
    if (-not [bool] $state.planConfirmed) {
        return & $invalid "plan-not-confirmed"
    }

    try {
        $ticks = [long] $state.createdUtcTicks
        $created = [datetime]::SpecifyKind((New-Object datetime $ticks), [datetimekind]::Utc)
    }
    catch {
        return & $invalid "expired"
    }
    $age = ([datetime]::UtcNow - $created).TotalMinutes
    if ($age -lt -1 -or $age -gt $script:GuiStateTtlMinutes) {
        return & $invalid "expired"
    }

    try {
        $stateRoot = ConvertTo-FenneviaGuiCanonicalPath -Path ([string] $state.packageRoot)
        $expectedRoot = ConvertTo-FenneviaGuiCanonicalPath -Path $ExpectedPackageRoot
    }
    catch {
        return & $invalid "package-root-mismatch"
    }
    if (-not [string]::Equals($stateRoot, $expectedRoot, [StringComparison]::OrdinalIgnoreCase)) {
        return & $invalid "package-root-mismatch"
    }

    return [pscustomobject]@{
        Valid = $true
        Reason = "ready"
        State = $state
    }
}

function Complete-FenneviaGuiResume {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $PackageRoot,

        [Parameter(Mandatory)]
        [string] $ResumeStatePath,

        [Parameter(Mandatory)]
        [hashtable] $Hooks
    )

    $canonical = Assert-FenneviaGuiReleasePackage -PackageRoot $PackageRoot
    try {
        $canonicalStatePath = ConvertTo-FenneviaGuiElevationStatePath -Path $ResumeStatePath
    }
    catch {
        throw "Fennevia Setup could not resume the administrator session."
    }
    try {
        $check = Test-FenneviaGuiElevationState -Path $canonicalStatePath -ExpectedPackageRoot $canonical
        if (-not [bool] $check.Valid) {
            throw "Fennevia Setup could not resume the administrator session."
        }

        $session = New-FenneviaGuiSession -PackageRoot $canonical
        $session.Action = [string] $check.State.action
        $session.FirefoxPath = [string] $check.State.firefoxPath
        $session.ProfilePath = [string] $check.State.profilePath
        $session.SupportWarningAcknowledged = [bool] $check.State.supportWarningAcknowledged
        $session.PlanConfirmed = $true

        try {
            $plan = Invoke-FenneviaGuiPreview -Session $session -Hooks $Hooks
            if ([string] $plan.PlanSha256 -cne [string] $check.State.expectedPlanSha256) {
                throw "The package or selected target state changed after preview; review a new dry-run plan."
            }
            $null = Invoke-FenneviaGuiStatusQuery -Session $session -Hooks $Hooks
            $request = New-FenneviaGuiPackageRequest -Session $session
            if (-not [bool] $request.Ready) {
                throw "Fennevia Setup could not apply the confirmed plan ($($request.Reason))."
            }
            $null = Invoke-FenneviaGuiApply -Session $session -Hooks $Hooks
        }
        catch {
            $session.ErrorMessage = ConvertTo-FenneviaGuiSafeErrorMessage -InputObject $_
            throw
        }
        return $session
    }
    finally {
        Remove-FenneviaGuiElevationState -Path $canonicalStatePath
    }
}

function Start-FenneviaGuiElevatedHost {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $PackageRoot,

        [Parameter(Mandatory)]
        [string] $StatePath,

        [hashtable] $Hooks
    )

    if ($null -ne $Hooks -and $Hooks.ContainsKey("StartElevated") -and $null -ne $Hooks["StartElevated"]) {
        return & $Hooks["StartElevated"] $StatePath
    }

    $exe = Join-Path $PackageRoot "FenneviaSetup.exe"
    if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) {
        throw "Fennevia Setup could not find FenneviaSetup.exe in this release tree."
    }

    $startInfo = New-Object Diagnostics.ProcessStartInfo
    $startInfo.FileName = $exe
    $startInfo.Arguments = "--resume-state `"$StatePath`""
    $startInfo.UseShellExecute = $true
    $startInfo.Verb = "runas"
    $startInfo.WorkingDirectory = $PackageRoot
    try {
        $started = [Diagnostics.Process]::Start($startInfo)
        if ($null -eq $started) {
            return [pscustomobject]@{ Started = $false; Cancelled = $true }
        }
        return [pscustomobject]@{ Started = $true; Cancelled = $false }
    }
    catch {
        return [pscustomobject]@{ Started = $false; Cancelled = $true }
    }
}

function Test-FenneviaGuiCanLeavePage {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Page,

        [Parameter(Mandatory)]
        [object] $Session
    )

    switch ($Page) {
        "welcome" { return $true }
        "license" { return $true }
        "prepare" { return $true }
        "firefox" {
            return -not [string]::IsNullOrWhiteSpace([string] $Session.FirefoxPath)
        }
        "profile" {
            if ([string]::IsNullOrWhiteSpace([string] $Session.ProfilePath) -or [string]::IsNullOrWhiteSpace([string] $Session.ProfileName)) {
                return $false
            }
            if ([bool] $Session.ProfileIsDefault -and -not [bool] $Session.DefaultProfileConfirmed) {
                return $false
            }
            return $true
        }
        "action" {
            return -not [string]::IsNullOrWhiteSpace([string] $Session.Action)
        }
        "support" {
            return [bool] $Session.SupportWarningAcknowledged
        }
        "plan" {
            if ($null -eq $Session.Plan) {
                return $false
            }
            if ([int] $Session.Plan.PlannedMutationCount -eq 0) {
                return $true
            }
            return [bool] $Session.PlanConfirmed
        }
        default { return $false }
    }
}

function Get-FenneviaGuiWelcomeText {
    [CmdletBinding()]
    param()

    return @"
Fennevia adds a content-first shell to stock Firefox. It is not a Firefox fork.

Setup writes a small AutoConfig package into the Firefox program you select and into one registered Firefox profile. It does not install a separate Fennevia application into Program Files.

Keep this extracted release folder. Update, repair, disable, and uninstall need these exact package bytes.
"@
}

function Get-FenneviaGuiPrepareText {
    [CmdletBinding()]
    param()

    return @"
Close every Firefox window, Browser Console, and Browser Toolbox that uses the selected program or profile. Fennevia Setup will not quit Firefox for you.

Create a dedicated profile in about:profiles. Fennevia never preselects Firefox's default profile.
"@
}

function Get-FenneviaGuiElevationText {
    [CmdletBinding()]
    param()

    return @"
The selected Firefox program folder is not writable with the current Windows account. System-managed installs under Program Files usually need administrator permission.

Fennevia Setup will not elevate until you continue. After you approve the Windows security prompt, Setup re-checks the same plan digest before writing files.
"@
}

function Get-FenneviaGuiKeepFolderText {
    [CmdletBinding()]
    param()

    return "Keep this extracted release folder or ZIP. You will need it to update, repair, disable, or uninstall Fennevia."
}

function Initialize-FenneviaGuiDpiAwareness {
    [CmdletBinding()]
    param()

    try {
        $code = @"
using System.Runtime.InteropServices;
public static class FenneviaGuiDpi {
    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();
}
"@
        if (-not ("FenneviaGuiDpi" -as [type])) {
            Add-Type -TypeDefinition $code -ErrorAction Stop | Out-Null
        }
        [void][FenneviaGuiDpi]::SetProcessDPIAware()
    }
    catch {
    }
}

function Show-FenneviaGuiMessage {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Text,

        [string] $Caption = "Fennevia Setup",

        [System.Windows.Forms.MessageBoxIcon] $Icon = [System.Windows.Forms.MessageBoxIcon]::Information
    )

    [void][System.Windows.Forms.MessageBox]::Show(
        $Text,
        $Caption,
        [System.Windows.Forms.MessageBoxButtons]::OK,
        $Icon
    )
}

function Show-FenneviaGuiResultWindow {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Session
    )

    Add-Type -AssemblyName System.Windows.Forms | Out-Null
    Add-Type -AssemblyName System.Drawing | Out-Null
    Initialize-FenneviaGuiDpiAwareness
    [System.Windows.Forms.Application]::EnableVisualStyles()

    $form = New-Object System.Windows.Forms.Form
    $form.SuspendLayout()
    $form.Text = "Fennevia Setup"
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.ShowInTaskbar = $true
    $form.AutoScaleMode = [System.Windows.Forms.AutoScaleMode]::Dpi
    $form.AutoScaleDimensions = New-Object System.Drawing.SizeF(96, 96)
    $form.Font = [System.Drawing.SystemFonts]::MessageBoxFont
    $form.ClientSize = Get-FenneviaGuiInitialClientSize `
        -Form $form `
        -DesiredWidth 680 `
        -DesiredHeight 460 `
        -MinimumWidth 520 `
        -MinimumHeight 360

    $layout = New-Object System.Windows.Forms.TableLayoutPanel
    $layout.Dock = [System.Windows.Forms.DockStyle]::Fill
    $layout.Padding = New-Object System.Windows.Forms.Padding(16)
    $layout.Margin = New-Object System.Windows.Forms.Padding(0)
    $layout.ColumnCount = 1
    $layout.RowCount = 3
    $layout.ColumnStyles.Add((New-FenneviaGuiColumnStyle -SizeType Percent -Size 100)) | Out-Null
    $layout.RowStyles.Add((New-FenneviaGuiRowStyle -SizeType AutoSize)) | Out-Null
    $layout.RowStyles.Add((New-FenneviaGuiRowStyle -SizeType Percent -Size 100)) | Out-Null
    $layout.RowStyles.Add((New-FenneviaGuiRowStyle -SizeType AutoSize)) | Out-Null

    $label = New-Object System.Windows.Forms.Label
    $label.AutoSize = $true
    $label.Dock = [System.Windows.Forms.DockStyle]::Fill
    $label.Margin = New-Object System.Windows.Forms.Padding(0, 0, 0, 12)
    $label.UseMnemonic = $false
    $label.Text = if (-not [string]::IsNullOrWhiteSpace([string] $Session.ErrorMessage)) {
        $Session.ErrorMessage
    }
    else {
        Get-FenneviaGuiKeepFolderText
    }

    $box = New-Object System.Windows.Forms.TextBox
    $box.Multiline = $true
    $box.ReadOnly = $true
    $box.ScrollBars = "Vertical"
    $box.Dock = [System.Windows.Forms.DockStyle]::Fill
    $box.Margin = New-Object System.Windows.Forms.Padding(0)
    $box.Font = New-Object System.Drawing.Font("Consolas", 9)
    $box.Text = [string]::Join([Environment]::NewLine, @($Session.CopyableLines))

    $buttonRow = New-Object System.Windows.Forms.TableLayoutPanel
    $buttonRow.AutoSize = $true
    $buttonRow.AutoSizeMode = [System.Windows.Forms.AutoSizeMode]::GrowAndShrink
    $buttonRow.Dock = [System.Windows.Forms.DockStyle]::Fill
    $buttonRow.Margin = New-Object System.Windows.Forms.Padding(0, 12, 0, 0)
    $buttonRow.ColumnCount = 2
    $buttonRow.RowCount = 1
    $buttonRow.ColumnStyles.Add((New-FenneviaGuiColumnStyle -SizeType Percent -Size 100)) | Out-Null
    $buttonRow.ColumnStyles.Add((New-FenneviaGuiColumnStyle -SizeType AutoSize)) | Out-Null

    $ok = New-FenneviaGuiButton -Text "Close"
    $ok.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $form.AcceptButton = $ok
    $form.CancelButton = $ok

    $buttonRow.Controls.Add($ok, 1, 0)
    $layout.Controls.Add($label, 0, 0)
    $layout.Controls.Add($box, 0, 1)
    $layout.Controls.Add($buttonRow, 0, 2)
    $form.Controls.Add($layout)
    $form.ResumeLayout($false)
    $form.PerformLayout()
    try {
        [void] $form.ShowDialog()
    }
    finally {
        $form.Dispose()
    }
}

function New-FenneviaGuiBodyLabel {
    param(
        [string] $Text
    )
    $item = New-Object System.Windows.Forms.RichTextBox
    $item.BackColor = [System.Drawing.SystemColors]::Control
    $item.BorderStyle = [System.Windows.Forms.BorderStyle]::None
    $item.DetectUrls = $false
    $item.Dock = [System.Windows.Forms.DockStyle]::Fill
    $item.Margin = New-Object System.Windows.Forms.Padding(0)
    $item.ReadOnly = $true
    $item.ScrollBars = [System.Windows.Forms.RichTextBoxScrollBars]::Vertical
    $item.ShortcutsEnabled = $true
    $item.TabStop = $true
    $item.WordWrap = $true
    $item.Text = $Text
    return $item
}

function New-FenneviaGuiMultilineBox {
    param(
        [string] $Text,
        [switch] $ReadOnly
    )
    $item = New-Object System.Windows.Forms.TextBox
    $item.Multiline = $true
    $item.ScrollBars = "Vertical"
    $item.Dock = [System.Windows.Forms.DockStyle]::Fill
    $item.Margin = New-Object System.Windows.Forms.Padding(0)
    $item.Text = $Text
    $item.ReadOnly = [bool] $ReadOnly
    $item.Font = New-Object System.Drawing.Font("Consolas", 9)
    return $item
}

function New-FenneviaGuiColumnStyle {
    param(
        [Parameter(Mandatory)]
        [System.Windows.Forms.SizeType] $SizeType,

        [single] $Size = 0
    )

    $style = New-Object System.Windows.Forms.ColumnStyle
    $style.SizeType = $SizeType
    $style.Width = $Size
    return $style
}

function New-FenneviaGuiRowStyle {
    param(
        [Parameter(Mandatory)]
        [System.Windows.Forms.SizeType] $SizeType,

        [single] $Size = 0
    )

    $style = New-Object System.Windows.Forms.RowStyle
    $style.SizeType = $SizeType
    $style.Height = $Size
    return $style
}

function New-FenneviaGuiPageLayout {
    param(
        [Parameter(Mandatory)]
        [System.Windows.Forms.SizeType[]] $RowSizeTypes,

        [single[]] $RowSizes = @()
    )

    $layout = New-Object System.Windows.Forms.TableLayoutPanel
    $layout.Dock = [System.Windows.Forms.DockStyle]::Fill
    $layout.Margin = New-Object System.Windows.Forms.Padding(0)
    $layout.Padding = New-Object System.Windows.Forms.Padding(0)
    $layout.ColumnCount = 1
    $layout.RowCount = $RowSizeTypes.Count
    $layout.ColumnStyles.Add((New-FenneviaGuiColumnStyle -SizeType Percent -Size 100)) | Out-Null
    for ($index = 0; $index -lt $RowSizeTypes.Count; $index++) {
        $size = 0
        if ($index -lt $RowSizes.Count) {
            $size = $RowSizes[$index]
        }
        $layout.RowStyles.Add((New-FenneviaGuiRowStyle -SizeType $RowSizeTypes[$index] -Size $size)) | Out-Null
    }
    return $layout
}

function Get-FenneviaGuiUiScale {
    $dpi = 96
    if ($null -ne $script:FenneviaGuiUi -and $null -ne $script:FenneviaGuiUi.Form -and -not $script:FenneviaGuiUi.Form.IsDisposed) {
        $dpi = [Math]::Max(96, [int] $script:FenneviaGuiUi.Form.DeviceDpi)
    }
    return ([double] $dpi / 96.0)
}

function ConvertTo-FenneviaGuiDeviceValue {
    param(
        [Parameter(Mandatory)]
        [int] $Value
    )

    return [int] [Math]::Round($Value * (Get-FenneviaGuiUiScale), [MidpointRounding]::AwayFromZero)
}

function New-FenneviaGuiScaledPadding {
    param(
        [int] $Left,
        [int] $Top,
        [int] $Right,
        [int] $Bottom
    )

    return New-Object System.Windows.Forms.Padding(
        (ConvertTo-FenneviaGuiDeviceValue -Value $Left),
        (ConvertTo-FenneviaGuiDeviceValue -Value $Top),
        (ConvertTo-FenneviaGuiDeviceValue -Value $Right),
        (ConvertTo-FenneviaGuiDeviceValue -Value $Bottom)
    )
}

function Get-FenneviaGuiInitialClientSize {
    param(
        [Parameter(Mandatory)]
        [System.Windows.Forms.Form] $Form,

        [int] $DesiredWidth,
        [int] $DesiredHeight,
        [int] $MinimumWidth,
        [int] $MinimumHeight
    )

    $dpiScale = [Math]::Max(1.0, ([double] $Form.DeviceDpi / 96.0))
    $workingArea = [System.Windows.Forms.Screen]::FromPoint([System.Windows.Forms.Cursor]::Position).WorkingArea
    $availableWidth = [int] [Math]::Floor(([double] $workingArea.Width / $dpiScale) - 48)
    $availableHeight = [int] [Math]::Floor(([double] $workingArea.Height / $dpiScale) - 72)
    $width = [Math]::Max($MinimumWidth, [Math]::Min($DesiredWidth, $availableWidth))
    $height = [Math]::Max($MinimumHeight, [Math]::Min($DesiredHeight, $availableHeight))
    return New-Object System.Drawing.Size($width, $height)
}

function New-FenneviaGuiButton {
    param(
        [Parameter(Mandatory)]
        [string] $Text
    )

    $button = New-Object System.Windows.Forms.Button
    $button.Text = $Text
    $button.AutoSize = $true
    $button.AutoSizeMode = [System.Windows.Forms.AutoSizeMode]::GrowAndShrink
    $button.MinimumSize = New-Object System.Drawing.Size(
        (ConvertTo-FenneviaGuiDeviceValue -Value 96),
        (ConvertTo-FenneviaGuiDeviceValue -Value 34)
    )
    $button.Padding = New-FenneviaGuiScaledPadding -Left 12 -Top 0 -Right 12 -Bottom 0
    return $button
}

function Update-FenneviaGuiWizardPage {
    $ui = $script:FenneviaGuiUi
    $session = $ui.Session
    $body = $ui.Body
    $header = $ui.Header
    $back = $ui.Back
    $next = $ui.Next
    $page = [string] $ui.Page
    while ($body.Controls.Count -gt 0) {
        $control = $body.Controls[0]
        $body.Controls.RemoveAt(0)
        $control.Dispose()
    }
    $back.Enabled = $page -ne "welcome" -and $page -ne "result"
    $next.Text = "Next"
    $next.Enabled = $true

    switch ($page) {
        "welcome" {
            $header.Text = "Welcome"
            [void] $body.Controls.Add((New-FenneviaGuiBodyLabel -Text (Get-FenneviaGuiWelcomeText)))
        }
        "license" {
            $header.Text = "License"
            [void] $body.Controls.Add((New-FenneviaGuiMultilineBox -Text (Get-FenneviaGuiLicenseText -PackageRoot $session.PackageRoot) -ReadOnly))
        }
        "prepare" {
            $header.Text = "Before you continue"
            [void] $body.Controls.Add((New-FenneviaGuiBodyLabel -Text (Get-FenneviaGuiPrepareText)))
        }
        "firefox" {
            $header.Text = "Select firefox.exe"
            if ($ui.FirefoxChoices.Count -eq 0) {
                foreach ($candidate in @(& $ui.Hooks["GetCandidates"])) {
                    [void] $ui.FirefoxChoices.Add($candidate)
                }
            }
            $pageLayout = New-FenneviaGuiPageLayout -RowSizeTypes @("Percent", "AutoSize") -RowSizes @(100, 0)
            $list = New-Object System.Windows.Forms.ListBox
            $list.Dock = [System.Windows.Forms.DockStyle]::Fill
            $list.IntegralHeight = $false
            $list.Margin = New-Object System.Windows.Forms.Padding(0)
            $index = 0
            foreach ($candidate in $ui.FirefoxChoices) {
                $label = ConvertTo-FenneviaGuiFirefoxChoiceLabel -Candidate $candidate
                [void] $list.Items.Add($label)
                if ([string] $candidate.FirefoxPath -ceq [string] $session.FirefoxPath) {
                    $list.SelectedIndex = $index
                }
                $index++
            }
            $list.Add_SelectedIndexChanged({
                param($sender, $eventArgs)
                if ($sender.SelectedIndex -ge 0) {
                    $script:FenneviaGuiUi.Session.FirefoxPath = [string] $script:FenneviaGuiUi.FirefoxChoices[$sender.SelectedIndex].FirefoxPath
                    $script:FenneviaGuiUi.Session.FirefoxLabel = [string] $sender.SelectedItem
                }
            })
            $browse = New-FenneviaGuiButton -Text "Browse..."
            $browse.Anchor = [System.Windows.Forms.AnchorStyles]::Left
            $browse.Margin = New-FenneviaGuiScaledPadding -Left 0 -Top 12 -Right 0 -Bottom 0
            $browse.Tag = $list
            $browse.Add_Click({
                param($sender, $eventArgs)
                $targetList = [System.Windows.Forms.ListBox] $sender.Tag
                $dialog = New-Object System.Windows.Forms.OpenFileDialog
                $dialog.Filter = "firefox.exe|firefox.exe"
                $dialog.Title = "Select firefox.exe"
                try {
                    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
                        $script:FenneviaGuiUi.Session.FirefoxPath = [string] $dialog.FileName
                        $script:FenneviaGuiUi.Session.FirefoxLabel = "Selected firefox.exe"
                        [void] $script:FenneviaGuiUi.FirefoxChoices.Add([pscustomobject]@{
                                FirefoxPath = $script:FenneviaGuiUi.Session.FirefoxPath
                                Label = $script:FenneviaGuiUi.Session.FirefoxLabel
                                BuildID = ""
                            })
                        [void] $targetList.Items.Add($script:FenneviaGuiUi.Session.FirefoxLabel)
                        $targetList.SelectedIndex = $targetList.Items.Count - 1
                    }
                }
                finally {
                    $dialog.Dispose()
                }
            })
            $pageLayout.Controls.Add($list, 0, 0)
            $pageLayout.Controls.Add($browse, 0, 1)
            [void] $body.Controls.Add($pageLayout)
        }
        "profile" {
            $header.Text = "Select a registered Firefox profile"
            $ui.ProfileChoices = @(& $ui.Hooks["GetProfileChoices"])
            $pageLayout = New-FenneviaGuiPageLayout -RowSizeTypes @("Percent", "AutoSize") -RowSizes @(100, 0)
            $list = New-Object System.Windows.Forms.ListBox
            $list.Dock = [System.Windows.Forms.DockStyle]::Fill
            $list.IntegralHeight = $false
            $list.Margin = New-Object System.Windows.Forms.Padding(0)
            $index = 0
            foreach ($choice in $ui.ProfileChoices) {
                [void] $list.Items.Add((ConvertTo-FenneviaGuiProfileChoiceLabel -Choice $choice))
                if ([string] $choice.Name -ceq [string] $session.ProfileName) {
                    $list.SelectedIndex = $index
                }
                $index++
            }
            $confirmDefault = New-Object System.Windows.Forms.CheckBox
            $confirmDefault.AutoSize = $true
            $confirmDefault.Dock = [System.Windows.Forms.DockStyle]::Fill
            $confirmDefault.Margin = New-FenneviaGuiScaledPadding -Left 0 -Top 12 -Right 0 -Bottom 0
            $confirmDefault.Text = "Use Firefox's default profile anyway"
            $confirmDefault.Enabled = $false
            $confirmDefault.Checked = [bool] $session.DefaultProfileConfirmed
            $confirmDefault.Add_CheckedChanged({
                param($sender, $eventArgs)
                $script:FenneviaGuiUi.Session.DefaultProfileConfirmed = [bool] $sender.Checked
            })
            $list.Tag = $confirmDefault
            $list.Add_SelectedIndexChanged({
                param($sender, $eventArgs)
                if ($sender.SelectedIndex -ge 0) {
                    $defaultCheckBox = [System.Windows.Forms.CheckBox] $sender.Tag
                    $choice = $script:FenneviaGuiUi.ProfileChoices[$sender.SelectedIndex]
                    $selection = Resolve-FenneviaConsoleProfileSelection -Choices $script:FenneviaGuiUi.ProfileChoices -SelectedName ([string] $choice.Name)
                    $script:FenneviaGuiUi.Session.ProfileName = [string] $choice.Name
                    $script:FenneviaGuiUi.Session.ProfilePath = [string] $choice.Path
                    $script:FenneviaGuiUi.Session.ProfileIsDefault = [bool] $choice.IsDefault
                    if ($selection.Status -eq "confirm-default") {
                        $defaultCheckBox.Enabled = $true
                        $script:FenneviaGuiUi.Session.DefaultProfileConfirmed = [bool] $defaultCheckBox.Checked
                    }
                    else {
                        $defaultCheckBox.Enabled = $false
                        $defaultCheckBox.Checked = $false
                        $script:FenneviaGuiUi.Session.DefaultProfileConfirmed = $false
                    }
                }
            })
            $pageLayout.Controls.Add($list, 0, 0)
            $pageLayout.Controls.Add($confirmDefault, 0, 1)
            [void] $body.Controls.Add($pageLayout)
        }
        "action" {
            $header.Text = "Choose an action"
            $list = New-Object System.Windows.Forms.ListBox
            $list.Dock = [System.Windows.Forms.DockStyle]::Fill
            $list.IntegralHeight = $false
            $list.Margin = New-Object System.Windows.Forms.Padding(0)
            $actions = @(Get-FenneviaConsoleMenuItems -Kind Release | Where-Object { $_.Id -ne "quit" })
            $ui.Actions = $actions
            foreach ($item in $actions) {
                [void] $list.Items.Add([string] $item.Label)
                if ([string] $item.Id -ceq $session.Action.ToLowerInvariant()) {
                    $list.SelectedItem = [string] $item.Label
                }
            }
            $list.Add_SelectedIndexChanged({
                param($sender, $eventArgs)
                if ($sender.SelectedIndex -ge 0) {
                    $script:FenneviaGuiUi.Session.Action = ConvertTo-FenneviaGuiActionName -Id ([string] $script:FenneviaGuiUi.Actions[$sender.SelectedIndex].Id)
                }
            })
            [void] $body.Controls.Add($list)
        }
        "support" {
            $header.Text = "Firefox support warning"
            $warning = Get-FenneviaConsoleFirefoxSupportWarning -Plan $session.Plan
            $pageLayout = New-FenneviaGuiPageLayout -RowSizeTypes @("Percent", "AutoSize") -RowSizes @(100, 0)
            $label = New-FenneviaGuiBodyLabel -Text $warning.Warning
            $check = New-Object System.Windows.Forms.CheckBox
            $check.AutoSize = $true
            $check.Dock = [System.Windows.Forms.DockStyle]::Fill
            $check.Margin = New-FenneviaGuiScaledPadding -Left 0 -Top 12 -Right 0 -Bottom 0
            $check.Text = $warning.Title
            $check.Checked = [bool] $session.SupportWarningAcknowledged
            $check.Add_CheckedChanged({
                param($sender, $eventArgs)
                $script:FenneviaGuiUi.Session.SupportWarningAcknowledged = [bool] $sender.Checked
            })
            Add-FenneviaGuiCopyableLines -Session $session -Lines $warning.Lines
            $pageLayout.Controls.Add($label, 0, 0)
            $pageLayout.Controls.Add($check, 0, 1)
            [void] $body.Controls.Add($pageLayout)
        }
        "plan" {
            $header.Text = "Review the plan"
            $text = ""
            if ($null -ne $session.Plan) {
                $text = [string]::Join([Environment]::NewLine, @(ConvertTo-FenneviaInstallerResultLines -Result $session.Plan))
            }
            $pageLayout = New-FenneviaGuiPageLayout -RowSizeTypes @("Percent", "AutoSize") -RowSizes @(100, 0)
            $box = New-FenneviaGuiMultilineBox -Text $text -ReadOnly
            $check = New-Object System.Windows.Forms.CheckBox
            $check.AutoSize = $true
            $check.Dock = [System.Windows.Forms.DockStyle]::Fill
            $check.Margin = New-FenneviaGuiScaledPadding -Left 0 -Top 12 -Right 0 -Bottom 0
            $check.Text = "Apply the displayed $($session.Action) plan"
            if ($null -ne $session.Plan -and [int] $session.Plan.PlannedMutationCount -eq 0) {
                $check.Enabled = $false
                $check.Checked = $false
                $session.PlanConfirmed = $false
                $next.Text = "Finish"
            }
            else {
                $check.Checked = [bool] $session.PlanConfirmed
                $check.Add_CheckedChanged({
                    param($sender, $eventArgs)
                    $script:FenneviaGuiUi.Session.PlanConfirmed = [bool] $sender.Checked
                })
                $next.Text = "Install"
            }
            $pageLayout.Controls.Add($box, 0, 0)
            $pageLayout.Controls.Add($check, 0, 1)
            [void] $body.Controls.Add($pageLayout)
        }
        "elevation" {
            $header.Text = "Administrator permission"
            [void] $body.Controls.Add((New-FenneviaGuiBodyLabel -Text (Get-FenneviaGuiElevationText)))
            $next.Text = "Continue as administrator"
        }
        "result" {
            $header.Text = "Finished"
            $summary = Get-FenneviaGuiKeepFolderText
            if (-not [string]::IsNullOrWhiteSpace([string] $session.ErrorMessage)) {
                $summary = $session.ErrorMessage
            }
            $pageLayout = New-FenneviaGuiPageLayout -RowSizeTypes @("Percent", "Percent") -RowSizes @(24, 76)
            $label = New-FenneviaGuiBodyLabel -Text $summary
            $label.Margin = New-FenneviaGuiScaledPadding -Left 0 -Top 0 -Right 0 -Bottom 12
            $box = New-FenneviaGuiMultilineBox -Text ([string]::Join([Environment]::NewLine, @($session.CopyableLines))) -ReadOnly
            $next.Text = "Close"
            $back.Enabled = $false
            $pageLayout.Controls.Add($label, 0, 0)
            $pageLayout.Controls.Add($box, 0, 1)
            [void] $body.Controls.Add($pageLayout)
        }
    }
    $body.PerformLayout()
    $ui.Form.PerformLayout()
}

function Invoke-FenneviaGuiWizardBack {
    $ui = $script:FenneviaGuiUi
    $session = $ui.Session
    switch ([string] $ui.Page) {
        "license" { $ui.Page = "welcome" }
        "prepare" { $ui.Page = "license" }
        "firefox" { $ui.Page = "prepare" }
        "profile" { $ui.Page = "firefox" }
        "action" { $ui.Page = "profile" }
        "support" { $ui.Page = "action" }
        "plan" {
            if (Test-FenneviaGuiActionNeedsSupportWarning -Action $session.Action) {
                $ui.Page = "support"
            }
            else {
                $ui.Page = "action"
            }
        }
        "elevation" { $ui.Page = "plan" }
    }
    Update-FenneviaGuiWizardPage
}

function Invoke-FenneviaGuiWizardNext {
    $ui = $script:FenneviaGuiUi
    $session = $ui.Session
    $hooks = $ui.Hooks
    $form = $ui.Form
    $page = [string] $ui.Page
    try {
        switch ($page) {
            "welcome" { $ui.Page = "license"; Update-FenneviaGuiWizardPage; return }
            "license" { $ui.Page = "prepare"; Update-FenneviaGuiWizardPage; return }
            "prepare" { $ui.Page = "firefox"; Update-FenneviaGuiWizardPage; return }
            "firefox" {
                if (-not (Test-FenneviaGuiCanLeavePage -Page "firefox" -Session $session)) {
                    Show-FenneviaGuiMessage -Text "Select firefox.exe." -Icon Error
                    return
                }
                $ui.Page = "profile"
                Update-FenneviaGuiWizardPage
                return
            }
            "profile" {
                if (-not (Test-FenneviaGuiCanLeavePage -Page "profile" -Session $session)) {
                    Show-FenneviaGuiMessage -Text "Select a registered profile. Firefox's default profile needs an extra confirmation." -Icon Error
                    return
                }
                $ui.Page = "action"
                Update-FenneviaGuiWizardPage
                return
            }
            "action" {
                if (-not (Test-FenneviaGuiCanLeavePage -Page "action" -Session $session)) {
                    Show-FenneviaGuiMessage -Text "Choose an action." -Icon Error
                    return
                }
                $null = Invoke-FenneviaGuiStatusQuery -Session $session -Hooks $hooks
                if ($session.Action -ceq "Status") {
                    $ui.Page = "result"
                    Update-FenneviaGuiWizardPage
                    return
                }
                if ([bool] $session.Status.SelectedFirefoxRunning) {
                    Show-FenneviaGuiMessage -Text "Close the selected Firefox, Browser Console, and Browser Toolbox before applying changes." -Icon Warning
                    return
                }
                $null = Invoke-FenneviaGuiPreview -Session $session -Hooks $hooks
                if (Test-FenneviaGuiActionNeedsSupportWarning -Action $session.Action) {
                    $ui.Page = "support"
                }
                else {
                    $ui.Page = "plan"
                }
                Update-FenneviaGuiWizardPage
                return
            }
            "support" {
                if (-not (Test-FenneviaGuiCanLeavePage -Page "support" -Session $session)) {
                    Show-FenneviaGuiMessage -Text "Acknowledge the Firefox testing warning to continue." -Icon Error
                    return
                }
                $ui.Page = "plan"
                Update-FenneviaGuiWizardPage
                return
            }
            "plan" {
                if ($null -ne $session.Plan -and [int] $session.Plan.PlannedMutationCount -eq 0) {
                    $ui.Page = "result"
                    Update-FenneviaGuiWizardPage
                    return
                }
                if (-not (Test-FenneviaGuiCanLeavePage -Page "plan" -Session $session)) {
                    Show-FenneviaGuiMessage -Text "Confirm the displayed plan before applying it." -Icon Error
                    return
                }
                if (Test-FenneviaGuiNeedsElevation -Action $session.Action -Status $session.Status) {
                    $ui.Page = "elevation"
                    Update-FenneviaGuiWizardPage
                    return
                }
                $applied = Invoke-FenneviaGuiApply -Session $session -Hooks $hooks
                if ($applied -is [pscustomobject] -and $null -ne $applied.PSObject.Properties["Ready"] -and -not [bool] $applied.Ready) {
                    Show-FenneviaGuiMessage -Text "The plan could not be applied ($($applied.Reason))." -Icon Error
                    return
                }
                $ui.Page = "result"
                Update-FenneviaGuiWizardPage
                return
            }
            "elevation" {
                $statePath = New-FenneviaGuiElevationState -Session $session
                $elevated = Start-FenneviaGuiElevatedHost -PackageRoot $session.PackageRoot -StatePath $statePath -Hooks $hooks
                if ([bool] $elevated.Started) {
                    $session.ClosedForElevation = $true
                    $form.DialogResult = [System.Windows.Forms.DialogResult]::OK
                    $form.Close()
                    return
                }
                Remove-FenneviaGuiElevationState -Path $statePath
                $session.ElevationStatePath = ""
                Show-FenneviaGuiMessage -Text "Administrator permission was not granted. The plan was not applied." -Icon Warning
                return
            }
            "result" {
                $form.DialogResult = [System.Windows.Forms.DialogResult]::OK
                $form.Close()
                return
            }
        }
    }
    catch {
        $session.ErrorMessage = ConvertTo-FenneviaGuiSafeErrorMessage -InputObject $_
        Show-FenneviaGuiMessage -Text $session.ErrorMessage -Icon Error
    }
}

function New-FenneviaGuiWizardWindow {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $PackageRoot,

        [Parameter(Mandatory)]
        [hashtable] $Hooks
    )

    Add-Type -AssemblyName System.Windows.Forms | Out-Null
    Add-Type -AssemblyName System.Drawing | Out-Null
    Initialize-FenneviaGuiDpiAwareness
    [System.Windows.Forms.Application]::EnableVisualStyles()

    $session = New-FenneviaGuiSession -PackageRoot $PackageRoot
    $form = New-Object System.Windows.Forms.Form
    $form.SuspendLayout()
    $form.Text = "Fennevia Setup"
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::Sizable
    $form.MaximizeBox = $true
    $form.MinimizeBox = $false
    $form.ShowInTaskbar = $true
    $form.AutoScaleMode = [System.Windows.Forms.AutoScaleMode]::Dpi
    $form.AutoScaleDimensions = New-Object System.Drawing.SizeF(96, 96)
    $form.Font = [System.Drawing.SystemFonts]::MessageBoxFont
    $form.ClientSize = Get-FenneviaGuiInitialClientSize `
        -Form $form `
        -DesiredWidth 680 `
        -DesiredHeight 480 `
        -MinimumWidth 520 `
        -MinimumHeight 380
    $form.MinimumSize = New-Object System.Drawing.Size(520, 380)

    $layout = New-Object System.Windows.Forms.TableLayoutPanel
    $layout.Dock = [System.Windows.Forms.DockStyle]::Fill
    $layout.Padding = New-Object System.Windows.Forms.Padding(20, 16, 20, 16)
    $layout.Margin = New-Object System.Windows.Forms.Padding(0)
    $layout.ColumnCount = 1
    $layout.RowCount = 3
    $layout.ColumnStyles.Add((New-FenneviaGuiColumnStyle -SizeType Percent -Size 100)) | Out-Null
    $layout.RowStyles.Add((New-FenneviaGuiRowStyle -SizeType AutoSize)) | Out-Null
    $layout.RowStyles.Add((New-FenneviaGuiRowStyle -SizeType Percent -Size 100)) | Out-Null
    $layout.RowStyles.Add((New-FenneviaGuiRowStyle -SizeType AutoSize)) | Out-Null

    $header = New-Object System.Windows.Forms.Label
    $header.AutoSize = $true
    $header.AutoEllipsis = $false
    $header.Dock = [System.Windows.Forms.DockStyle]::Fill
    $header.Margin = New-Object System.Windows.Forms.Padding(0, 0, 0, 12)
    $header.MinimumSize = New-Object System.Drawing.Size(0, 34)
    $header.Font = New-Object System.Drawing.Font($form.Font.FontFamily, 14, [System.Drawing.FontStyle]::Bold)
    $header.UseMnemonic = $false

    $body = New-Object System.Windows.Forms.Panel
    $body.AutoScroll = $true
    $body.Dock = [System.Windows.Forms.DockStyle]::Fill
    $body.Margin = New-Object System.Windows.Forms.Padding(0)

    $buttonRow = New-Object System.Windows.Forms.TableLayoutPanel
    $buttonRow.AutoSize = $true
    $buttonRow.AutoSizeMode = [System.Windows.Forms.AutoSizeMode]::GrowAndShrink
    $buttonRow.Dock = [System.Windows.Forms.DockStyle]::Fill
    $buttonRow.Margin = New-Object System.Windows.Forms.Padding(0, 12, 0, 0)
    $buttonRow.ColumnCount = 4
    $buttonRow.RowCount = 1
    $buttonRow.ColumnStyles.Add((New-FenneviaGuiColumnStyle -SizeType AutoSize)) | Out-Null
    $buttonRow.ColumnStyles.Add((New-FenneviaGuiColumnStyle -SizeType Percent -Size 100)) | Out-Null
    $buttonRow.ColumnStyles.Add((New-FenneviaGuiColumnStyle -SizeType AutoSize)) | Out-Null
    $buttonRow.ColumnStyles.Add((New-FenneviaGuiColumnStyle -SizeType AutoSize)) | Out-Null

    $back = New-FenneviaGuiButton -Text "Back"
    $back.Margin = New-Object System.Windows.Forms.Padding(0)

    $next = New-FenneviaGuiButton -Text "Next"
    $next.Margin = New-Object System.Windows.Forms.Padding(8, 0, 0, 0)

    $cancel = New-FenneviaGuiButton -Text "Cancel"
    $cancel.Margin = New-Object System.Windows.Forms.Padding(8, 0, 0, 0)
    $cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    $form.CancelButton = $cancel
    $form.AcceptButton = $next

    $buttonRow.Controls.Add($back, 0, 0)
    $buttonRow.Controls.Add($next, 2, 0)
    $buttonRow.Controls.Add($cancel, 3, 0)
    $layout.Controls.Add($header, 0, 0)
    $layout.Controls.Add($body, 0, 1)
    $layout.Controls.Add($buttonRow, 0, 2)
    $form.Controls.Add($layout)

    $ui = @{
        Form = $form
        Layout = $layout
        Header = $header
        Body = $body
        ButtonRow = $buttonRow
        Back = $back
        Next = $next
        Cancel = $cancel
        Session = $session
        Hooks = $Hooks
        Page = "welcome"
        FirefoxChoices = (New-Object "Collections.Generic.List[object]")
        ProfileChoices = @()
        Actions = @()
    }

    $script:FenneviaGuiUi = $ui
    try {
        $back.Add_Click({ Invoke-FenneviaGuiWizardBack })
        $next.Add_Click({ Invoke-FenneviaGuiWizardNext })
        Update-FenneviaGuiWizardPage
        $form.ResumeLayout($false)
        $form.PerformLayout()
        return $ui
    }
    catch {
        $script:FenneviaGuiUi = $null
        $form.Dispose()
        throw
    }
}

function Show-FenneviaGuiWizard {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $PackageRoot,

        [Parameter(Mandatory)]
        [hashtable] $Hooks
    )

    $ui = New-FenneviaGuiWizardWindow -PackageRoot $PackageRoot -Hooks $Hooks
    try {
        [void] $ui.Form.ShowDialog()
        return $ui.Session
    }
    finally {
        $script:FenneviaGuiUi = $null
        $ui.Form.Dispose()
    }
}

function Invoke-FenneviaGui {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $PackageRoot,

        [string] $ResumeStatePath = "",

        [hashtable] $Hooks,

        [switch] $Show
    )

    $canonical = Assert-FenneviaGuiReleasePackage -PackageRoot $PackageRoot
    $resolvedHooks = Initialize-FenneviaConsoleHooks -PackageRoot $canonical -Hooks $Hooks
    if (-not [string]::IsNullOrWhiteSpace($ResumeStatePath)) {
        $session = Complete-FenneviaGuiResume -PackageRoot $canonical -ResumeStatePath $ResumeStatePath -Hooks $resolvedHooks
        if ($Show) {
            Show-FenneviaGuiResultWindow -Session $session
        }
        return $session
    }
    if ($Show) {
        return Show-FenneviaGuiWizard -PackageRoot $canonical -Hooks $resolvedHooks
    }
    return New-FenneviaGuiSession -PackageRoot $canonical
}

Export-ModuleMember -Function @(
    "Add-FenneviaGuiCopyableLines",
    "Assert-FenneviaGuiReleasePackage",
    "Complete-FenneviaGuiResume",
    "ConvertTo-FenneviaGuiActionName",
    "ConvertTo-FenneviaGuiFirefoxChoiceLabel",
    "ConvertTo-FenneviaGuiProfileChoiceLabel",
    "ConvertTo-FenneviaGuiSafeErrorMessage",
    "Get-FenneviaGuiElevationText",
    "Get-FenneviaGuiKeepFolderText",
    "Get-FenneviaGuiLicenseText",
    "Get-FenneviaGuiPrepareText",
    "Get-FenneviaGuiWelcomeText",
    "Invoke-FenneviaGui",
    "Invoke-FenneviaGuiApply",
    "Invoke-FenneviaGuiPreview",
    "Invoke-FenneviaGuiStatusQuery",
    "New-FenneviaGuiElevationState",
    "New-FenneviaGuiPackageRequest",
    "New-FenneviaGuiSession",
    "Remove-FenneviaGuiElevationState",
    "Start-FenneviaGuiElevatedHost",
    "Test-FenneviaGuiActionMutates",
    "Test-FenneviaGuiActionNeedsSupportWarning",
    "Test-FenneviaGuiCanLeavePage",
    "Test-FenneviaGuiElevationState",
    "Test-FenneviaGuiLineHasPath",
    "Test-FenneviaGuiNeedsElevation"
)
