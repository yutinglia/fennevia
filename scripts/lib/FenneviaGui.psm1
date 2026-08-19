#requires -Version 5.1

# SPDX-License-Identifier: MPL-2.0

Set-StrictMode -Version Latest

Import-Module (Join-Path $PSScriptRoot "FenneviaInstaller.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "FenneviaConsole.psm1") -Force

$script:GuiStateSchemaVersion = 1
$script:GuiStateOwner = "fennevia-setup"
$script:GuiStateTtlMinutes = 15
$script:GuiMutatingActions = @("Install", "Update", "Repair", "Disable", "Enable", "Uninstall")
$script:GuiSupportWarningActions = @("Install", "Update", "Repair", "Enable")

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

function ConvertTo-FenneviaGuiSafeErrorMessage {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        $InputObject
    )

    $message = ""
    if ($InputObject -is [System.Management.Automation.ErrorRecord]) {
        $message = [string] $InputObject.Exception.Message
    }
    elseif ($InputObject -is [Exception]) {
        $message = [string] $InputObject.Message
    }
    else {
        $message = [string] $InputObject
    }
    if ($message -match '[A-Za-z]:\\' -or $message -match '\\\\') {
        return "An unexpected local failure occurred; details are omitted from normal output to avoid path disclosure."
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

    $acl = Get-Acl -LiteralPath $Path
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($rule in @($acl.Access)) {
        try {
            [void] $acl.RemoveAccessRule($rule)
        }
        catch {
        }
    }
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $access = New-Object Security.AccessControl.FileSystemAccessRule(
        $sid,
        "FullControl",
        "Allow"
    )
    $acl.SetAccessRule($access)
    Set-Acl -LiteralPath $Path -AclObject $acl
}

function Test-FenneviaGuiElevationStateAcl {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    $acl = Get-Acl -LiteralPath $Path
    if (-not $acl.AreAccessRulesProtected) {
        return $false
    }
    $currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $rules = @(
        $acl.GetAccessRules($true, $false, [Security.Principal.SecurityIdentifier])
    )
    if ($rules.Count -eq 0) {
        return $false
    }
    foreach ($rule in $rules) {
        if ($rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow) {
            return $false
        }
        if ([string] $rule.IdentityReference.Value -cne $currentSid) {
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
    $path = Join-Path ([IO.Path]::GetTempPath()) ("fennevia-setup-state-" + [guid]::NewGuid().ToString("N") + ".json")
    $encoding = New-Object Text.UTF8Encoding $false
    [IO.File]::WriteAllText($path, (($payload | ConvertTo-Json -Compress) + [Environment]::NewLine), $encoding)
    Protect-FenneviaGuiElevationStateAcl -Path $path
    $Session.ElevationStatePath = $path
    return $path
}

function Remove-FenneviaGuiElevationState {
    [CmdletBinding()]
    param(
        [string] $Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return
    }
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    }
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

    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return & $invalid "missing-file"
    }
    if (-not (Test-FenneviaGuiElevationStateAcl -Path $Path)) {
        return & $invalid "acl"
    }

    try {
        $raw = [IO.File]::ReadAllText($Path)
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
    $check = Test-FenneviaGuiElevationState -Path $ResumeStatePath -ExpectedPackageRoot $canonical
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
    finally {
        Remove-FenneviaGuiElevationState -Path $ResumeStatePath
    }
    return $session
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
    $form.Text = "Fennevia Setup"
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.ShowInTaskbar = $true
    $form.Width = 720
    $form.Height = 520
    $form.Padding = New-Object System.Windows.Forms.Padding(16)

    $label = New-Object System.Windows.Forms.Label
    $label.Dock = "Top"
    $label.Height = 48
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
    $box.Dock = "Fill"
    $box.Font = New-Object System.Drawing.Font("Consolas", 9)
    $box.Text = [string]::Join([Environment]::NewLine, @($Session.CopyableLines))

    $ok = New-Object System.Windows.Forms.Button
    $ok.Text = "Close"
    $ok.Dock = "Bottom"
    $ok.Height = 32
    $ok.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $form.AcceptButton = $ok
    $form.CancelButton = $ok

    $form.Controls.Add($box)
    $form.Controls.Add($ok)
    $form.Controls.Add($label)
    [void] $form.ShowDialog()
    $form.Dispose()
}

function New-FenneviaGuiBodyLabel {
    param(
        [string] $Text,
        [int] $Height = 120
    )
    $item = New-Object System.Windows.Forms.Label
    $item.Left = 0
    $item.Top = 0
    $item.Width = 700
    $item.Height = $Height
    $item.Text = $Text
    return $item
}

function New-FenneviaGuiMultilineBox {
    param(
        [string] $Text,
        [switch] $ReadOnly,
        [int] $Height = 320
    )
    $item = New-Object System.Windows.Forms.TextBox
    $item.Multiline = $true
    $item.ScrollBars = "Vertical"
    $item.Left = 0
    $item.Top = 0
    $item.Width = 700
    $item.Height = $Height
    $item.Text = $Text
    $item.ReadOnly = [bool] $ReadOnly
    $item.Font = New-Object System.Drawing.Font("Consolas", 9)
    return $item
}

function Update-FenneviaGuiWizardPage {
    $ui = $script:FenneviaGuiUi
    $session = $ui.Session
    $body = $ui.Body
    $header = $ui.Header
    $back = $ui.Back
    $next = $ui.Next
    $page = [string] $ui.Page
    $body.Controls.Clear()
    $back.Enabled = $page -ne "welcome" -and $page -ne "result"
    $next.Text = "Next"
    $next.Enabled = $true

    switch ($page) {
        "welcome" {
            $header.Text = "Welcome"
            [void] $body.Controls.Add((New-FenneviaGuiBodyLabel -Text (Get-FenneviaGuiWelcomeText) -Height 220))
        }
        "license" {
            $header.Text = "License"
            [void] $body.Controls.Add((New-FenneviaGuiMultilineBox -Text (Get-FenneviaGuiLicenseText -PackageRoot $session.PackageRoot) -ReadOnly))
        }
        "prepare" {
            $header.Text = "Before you continue"
            [void] $body.Controls.Add((New-FenneviaGuiBodyLabel -Text (Get-FenneviaGuiPrepareText) -Height 180))
        }
        "firefox" {
            $header.Text = "Select firefox.exe"
            if ($ui.FirefoxChoices.Count -eq 0) {
                foreach ($candidate in @(& $ui.Hooks["GetCandidates"])) {
                    [void] $ui.FirefoxChoices.Add($candidate)
                }
            }
            $list = New-Object System.Windows.Forms.ListBox
            $list.Left = 0
            $list.Top = 0
            $list.Width = 700
            $list.Height = 280
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
                if ($list.SelectedIndex -ge 0) {
                    $script:FenneviaGuiUi.Session.FirefoxPath = [string] $script:FenneviaGuiUi.FirefoxChoices[$list.SelectedIndex].FirefoxPath
                    $script:FenneviaGuiUi.Session.FirefoxLabel = [string] $list.SelectedItem
                }
            }.GetNewClosure())
            $browse = New-Object System.Windows.Forms.Button
            $browse.Text = "Browse..."
            $browse.Left = 0
            $browse.Top = 292
            $browse.Width = 120
            $browse.Height = 28
            $browse.Add_Click({
                $dialog = New-Object System.Windows.Forms.OpenFileDialog
                $dialog.Filter = "firefox.exe|firefox.exe"
                $dialog.Title = "Select firefox.exe"
                if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
                    $script:FenneviaGuiUi.Session.FirefoxPath = [string] $dialog.FileName
                    $script:FenneviaGuiUi.Session.FirefoxLabel = "Selected firefox.exe"
                    [void] $script:FenneviaGuiUi.FirefoxChoices.Add([pscustomobject]@{
                            FirefoxPath = $script:FenneviaGuiUi.Session.FirefoxPath
                            Label = $script:FenneviaGuiUi.Session.FirefoxLabel
                            BuildID = ""
                        })
                    [void] $list.Items.Add($script:FenneviaGuiUi.Session.FirefoxLabel)
                    $list.SelectedIndex = $list.Items.Count - 1
                }
            }.GetNewClosure())
            [void] $body.Controls.Add($list)
            [void] $body.Controls.Add($browse)
        }
        "profile" {
            $header.Text = "Select a registered Firefox profile"
            $ui.ProfileChoices = @(& $ui.Hooks["GetProfileChoices"])
            $list = New-Object System.Windows.Forms.ListBox
            $list.Left = 0
            $list.Top = 0
            $list.Width = 700
            $list.Height = 260
            $index = 0
            foreach ($choice in $ui.ProfileChoices) {
                [void] $list.Items.Add((ConvertTo-FenneviaGuiProfileChoiceLabel -Choice $choice))
                if ([string] $choice.Name -ceq [string] $session.ProfileName) {
                    $list.SelectedIndex = $index
                }
                $index++
            }
            $confirmDefault = New-Object System.Windows.Forms.CheckBox
            $confirmDefault.Left = 0
            $confirmDefault.Top = 272
            $confirmDefault.Width = 700
            $confirmDefault.Height = 28
            $confirmDefault.Text = "Use Firefox's default profile anyway"
            $confirmDefault.Enabled = $false
            $confirmDefault.Checked = [bool] $session.DefaultProfileConfirmed
            $confirmDefault.Add_CheckedChanged({
                $script:FenneviaGuiUi.Session.DefaultProfileConfirmed = [bool] $confirmDefault.Checked
            }.GetNewClosure())
            $list.Add_SelectedIndexChanged({
                if ($list.SelectedIndex -ge 0) {
                    $choice = $script:FenneviaGuiUi.ProfileChoices[$list.SelectedIndex]
                    $selection = Resolve-FenneviaConsoleProfileSelection -Choices $script:FenneviaGuiUi.ProfileChoices -SelectedName ([string] $choice.Name)
                    $script:FenneviaGuiUi.Session.ProfileName = [string] $choice.Name
                    $script:FenneviaGuiUi.Session.ProfilePath = [string] $choice.Path
                    $script:FenneviaGuiUi.Session.ProfileIsDefault = [bool] $choice.IsDefault
                    if ($selection.Status -eq "confirm-default") {
                        $confirmDefault.Enabled = $true
                        $script:FenneviaGuiUi.Session.DefaultProfileConfirmed = [bool] $confirmDefault.Checked
                    }
                    else {
                        $confirmDefault.Enabled = $false
                        $confirmDefault.Checked = $false
                        $script:FenneviaGuiUi.Session.DefaultProfileConfirmed = $false
                    }
                }
            }.GetNewClosure())
            [void] $body.Controls.Add($list)
            [void] $body.Controls.Add($confirmDefault)
        }
        "action" {
            $header.Text = "Choose an action"
            $list = New-Object System.Windows.Forms.ListBox
            $list.Left = 0
            $list.Top = 0
            $list.Width = 700
            $list.Height = 280
            $actions = @(Get-FenneviaConsoleMenuItems -Kind Release | Where-Object { $_.Id -ne "quit" })
            $ui.Actions = $actions
            foreach ($item in $actions) {
                [void] $list.Items.Add([string] $item.Label)
                if ([string] $item.Id -ceq $session.Action.ToLowerInvariant()) {
                    $list.SelectedItem = [string] $item.Label
                }
            }
            $list.Add_SelectedIndexChanged({
                if ($list.SelectedIndex -ge 0) {
                    $script:FenneviaGuiUi.Session.Action = ConvertTo-FenneviaGuiActionName -Id ([string] $script:FenneviaGuiUi.Actions[$list.SelectedIndex].Id)
                }
            }.GetNewClosure())
            [void] $body.Controls.Add($list)
        }
        "support" {
            $header.Text = "Firefox support warning"
            $warning = Get-FenneviaConsoleFirefoxSupportWarning -Plan $session.Plan
            $label = New-FenneviaGuiBodyLabel -Text $warning.Warning -Height 160
            $check = New-Object System.Windows.Forms.CheckBox
            $check.Left = 0
            $check.Top = 180
            $check.Width = 700
            $check.Height = 40
            $check.Text = $warning.Title
            $check.Checked = [bool] $session.SupportWarningAcknowledged
            $check.Add_CheckedChanged({
                $script:FenneviaGuiUi.Session.SupportWarningAcknowledged = [bool] $check.Checked
            }.GetNewClosure())
            Add-FenneviaGuiCopyableLines -Session $session -Lines $warning.Lines
            [void] $body.Controls.Add($label)
            [void] $body.Controls.Add($check)
        }
        "plan" {
            $header.Text = "Review the plan"
            $text = ""
            if ($null -ne $session.Plan) {
                $text = [string]::Join([Environment]::NewLine, @(ConvertTo-FenneviaInstallerResultLines -Result $session.Plan))
            }
            $box = New-FenneviaGuiMultilineBox -Text $text -ReadOnly -Height 280
            $check = New-Object System.Windows.Forms.CheckBox
            $check.Left = 0
            $check.Top = 292
            $check.Width = 700
            $check.Height = 36
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
                    $script:FenneviaGuiUi.Session.PlanConfirmed = [bool] $check.Checked
                }.GetNewClosure())
                $next.Text = "Install"
            }
            [void] $body.Controls.Add($box)
            [void] $body.Controls.Add($check)
        }
        "elevation" {
            $header.Text = "Administrator permission"
            [void] $body.Controls.Add((New-FenneviaGuiBodyLabel -Text (Get-FenneviaGuiElevationText) -Height 180))
            $next.Text = "Continue as administrator"
        }
        "result" {
            $header.Text = "Finished"
            $summary = Get-FenneviaGuiKeepFolderText
            if (-not [string]::IsNullOrWhiteSpace([string] $session.ErrorMessage)) {
                $summary = $session.ErrorMessage
            }
            $label = New-FenneviaGuiBodyLabel -Text $summary -Height 64
            $box = New-FenneviaGuiMultilineBox -Text ([string]::Join([Environment]::NewLine, @($session.CopyableLines))) -ReadOnly -Height 280
            $box.Top = 72
            $next.Text = "Close"
            $back.Enabled = $false
            [void] $body.Controls.Add($label)
            [void] $body.Controls.Add($box)
        }
    }
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

function Show-FenneviaGuiWizard {
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
    $form.Text = "Fennevia Setup"
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.ShowInTaskbar = $true
    $form.Width = 740
    $form.Height = 560

    $header = New-Object System.Windows.Forms.Label
    $header.Left = 16
    $header.Top = 12
    $header.Width = 700
    $header.Height = 28
    $header.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)

    $body = New-Object System.Windows.Forms.Panel
    $body.Left = 16
    $body.Top = 48
    $body.Width = 700
    $body.Height = 400

    $back = New-Object System.Windows.Forms.Button
    $back.Text = "Back"
    $back.Left = 16
    $back.Top = 464
    $back.Width = 96
    $back.Height = 32

    $next = New-Object System.Windows.Forms.Button
    $next.Text = "Next"
    $next.Left = 520
    $next.Top = 464
    $next.Width = 96
    $next.Height = 32

    $cancel = New-Object System.Windows.Forms.Button
    $cancel.Text = "Cancel"
    $cancel.Left = 624
    $cancel.Top = 464
    $cancel.Width = 96
    $cancel.Height = 32
    $cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    $form.CancelButton = $cancel
    $form.AcceptButton = $next

    $form.Controls.Add($header)
    $form.Controls.Add($body)
    $form.Controls.Add($back)
    $form.Controls.Add($next)
    $form.Controls.Add($cancel)

    $script:FenneviaGuiUi = @{
        Form = $form
        Header = $header
        Body = $body
        Back = $back
        Next = $next
        Session = $session
        Hooks = $Hooks
        Page = "welcome"
        FirefoxChoices = (New-Object "Collections.Generic.List[object]")
        ProfileChoices = @()
        Actions = @()
    }

    $back.Add_Click({ Invoke-FenneviaGuiWizardBack }.GetNewClosure())
    $next.Add_Click({ Invoke-FenneviaGuiWizardNext }.GetNewClosure())
    Update-FenneviaGuiWizardPage
    [void] $form.ShowDialog()
    $form.Dispose()
    $finished = $script:FenneviaGuiUi.Session
    $script:FenneviaGuiUi = $null
    return $finished
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
