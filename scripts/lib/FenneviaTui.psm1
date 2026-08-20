#requires -Version 5.1

# SPDX-License-Identifier: MPL-2.0

# Fennevia-owned native TUI host. Independently authored for Windows PowerShell
# 5.1 and PowerShell 7. Interaction model (alternate screen, VT SGR mouse,
# dirty redraw, numbered fallback) follows the author's profile picker in
# yutinglia/powershell-profile profile.d/00-tui.ps1 at
# e93dd79180468dec079d6340b21e499f6546f667 as a design reference. That profile
# is not a runtime dependency and is not shipped.

Set-StrictMode -Version Latest

$script:FenneviaTuiState = @{
    Active = $false
    Native = $false
    AlternateScreen = $false
    InputHandle = [IntPtr]::Zero
    OutputHandle = [IntPtr]::Zero
    SavedInputMode = [uint32]0
    SavedOutputMode = [uint32]0
    SavedCursorVisible = $true
    SavedTreatCtrlC = $false
    SavedOutputEncoding = $null
    Log = @()
}

function Get-FenneviaTuiEsc {
    [CmdletBinding()]
    param()

    return [char]27
}

function ConvertTo-FenneviaTuiRgb {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Hex
    )

    return @(
        [Convert]::ToInt32($Hex.Substring(1, 2), 16),
        [Convert]::ToInt32($Hex.Substring(3, 2), 16),
        [Convert]::ToInt32($Hex.Substring(5, 2), 16)
    )
}

function Get-FenneviaTuiSgr {
    [CmdletBinding()]
    param(
        [string] $Fg,
        [string] $Bg,
        [switch] $Bold
    )

    $parts = @()
    if ($Bold) {
        $parts += "1"
    }
    if ($Fg) {
        $rgb = ConvertTo-FenneviaTuiRgb -Hex $Fg
        $parts += "38;2;$($rgb[0]);$($rgb[1]);$($rgb[2])"
    }
    if ($Bg) {
        $rgb = ConvertTo-FenneviaTuiRgb -Hex $Bg
        $parts += "48;2;$($rgb[0]);$($rgb[1]);$($rgb[2])"
    }
    return ((Get-FenneviaTuiEsc) + "[" + ($parts -join ";") + "m")
}

function Limit-FenneviaTuiText {
    [CmdletBinding()]
    param(
        [AllowNull()]
        [string] $Text,

        [Parameter(Mandatory)]
        [int] $Width
    )

    if ($Width -le 0) {
        return ""
    }
    $value = if ($null -eq $Text) { "" } else { [string] $Text }
    $value = $value.Replace("`r", "").Replace("`n", " ").Replace("`t", " ")
    if ($value.Length -le $Width) {
        return $value.PadRight($Width)
    }
    if ($Width -eq 1) {
        return $value.Substring(0, 1)
    }
    return $value.Substring(0, $Width - 1) + [char]0x2026
}

function Test-FenneviaTuiHostActive {
    [CmdletBinding()]
    param()

    return ($null -ne $script:FenneviaTuiState -and [bool] $script:FenneviaTuiState.Active)
}

$script:FenneviaTuiUnread = ""
$script:FenneviaTuiClickArmed = $true

function Add-FenneviaTuiLog {
    [CmdletBinding()]
    param(
        [AllowEmptyCollection()]
        $Lines
    )

    if ($null -eq $script:FenneviaTuiState) {
        $script:FenneviaTuiState = @{
            Active = $false
            Log = @()
        }
    }
    if ($null -eq $script:FenneviaTuiState.Log) {
        $script:FenneviaTuiState.Log = @()
    }
    foreach ($line in @($Lines)) {
        $text = [string] $line
        if ($text -match '[A-Za-z]:\\' -or $text -match '\\\\') {
            continue
        }
        $script:FenneviaTuiState.Log += $text
    }
    if ($script:FenneviaTuiState.Log.Count -gt 80) {
        $script:FenneviaTuiState.Log = @($script:FenneviaTuiState.Log[($script:FenneviaTuiState.Log.Count - 80)..($script:FenneviaTuiState.Log.Count - 1)])
    }
}

function Get-FenneviaTuiLogLines {
    [CmdletBinding()]
    param()

    if ($null -eq $script:FenneviaTuiState -or $null -eq $script:FenneviaTuiState.Log) {
        return @()
    }
    return @($script:FenneviaTuiState.Log)
}

function Get-FenneviaTuiWindowSize {
    [CmdletBinding()]
    param()

    $width = 80
    $height = 24
    try {
        if ([Console]::WindowWidth -gt 0) {
            $width = [Console]::WindowWidth
        }
        if ([Console]::WindowHeight -gt 0) {
            $height = [Console]::WindowHeight
        }
    }
    catch {
    }
    if ($width -lt 40) {
        $width = 40
    }
    if ($height -lt 12) {
        $height = 12
    }
    return [pscustomobject]@{ Width = $width; Height = $height }
}

function Test-FenneviaTuiLiteralMatch {
    [CmdletBinding()]
    param(
        [AllowNull()]
        [AllowEmptyString()]
        [string] $Text,

        [Parameter(Mandatory)]
        [AllowEmptyString()]
        [string] $Query
    )

    if ([string]::IsNullOrEmpty($Query)) {
        return $true
    }
    if ([string]::IsNullOrEmpty($Text)) {
        return $false
    }
    return $Text.IndexOf($Query, [StringComparison]::OrdinalIgnoreCase) -ge 0
}

function Get-FenneviaTuiLayout {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Title,

        [AllowEmptyCollection()]
        [object[]] $Items = @(),

        [AllowEmptyCollection()]
        [string[]] $LogLines = @(),

        [int] $SelectedIndex = 0,

        [int] $Scroll = 0,

        [string] $Query = "",

        [string] $ListLabel = "Actions",

        [int] $Width = 80,

        [int] $Height = 24
    )

    if ($Width -lt 40) {
        $Width = 40
    }
    if ($Height -lt 12) {
        $Height = 12
    }

    $itemList = @($Items)
    $logList = @($LogLines)
    $inputMode = $itemList.Count -eq 0
    $queryText = if ($null -eq $Query) { "" } else { [string] $Query }

    $view = @($itemList)
    if (-not $inputMode -and $queryText.Length -gt 0) {
        $view = @(
            foreach ($entry in $itemList) {
                $label = [string] $entry.Label
                $id = [string] $entry.Id
                if ((Test-FenneviaTuiLiteralMatch -Text $label -Query $queryText) -or (Test-FenneviaTuiLiteralMatch -Text $id -Query $queryText)) {
                    $entry
                }
            }
        )
    }

    $showDetails = $Width -ge 72
    $detailW = 0
    $listW = $Width
    if ($showDetails) {
        $detailW = [Math]::Max(28, [int][Math]::Floor($Width * 0.40))
        $listW = $Width - $detailW
    }

    $listTop = 4
    $listBottom = $Height - 1
    $logTop = 0
    if (-not $showDetails) {
        $logBudget = [Math]::Min(6, [Math]::Max(2, [int][Math]::Floor($Height / 5)))
        $listBottom = $Height - 1 - $logBudget
        $logTop = $listBottom + 1
        if ($listBottom -lt $listTop) {
            $listBottom = $listTop
            $logTop = $listBottom + 1
        }
    }
    $listHeight = $listBottom - $listTop + 1
    if ($listHeight -lt 1) {
        $listHeight = 1
    }

    $selected = $SelectedIndex
    $scroll = $Scroll
    if ($view.Count -eq 0) {
        $selected = 0
        $scroll = 0
    }
    else {
        if ($selected -lt 0) {
            $selected = 0
        }
        if ($selected -ge $view.Count) {
            $selected = $view.Count - 1
        }
        if ($selected -lt $scroll) {
            $scroll = $selected
        }
        if ($selected -ge ($scroll + $listHeight)) {
            $scroll = $selected - $listHeight + 1
        }
        if ($scroll -lt 0) {
            $scroll = 0
        }
        $maxScroll = [Math]::Max(0, $view.Count - $listHeight)
        if ($scroll -gt $maxScroll) {
            $scroll = $maxScroll
        }
    }

    $hline = [char]0x2500
    $vline = [char]0x2502
    $tl = [char]0x256D
    $tr = [char]0x256E
    $bl = [char]0x2570
    $br = [char]0x256F
    $ml = [char]0x251C
    $mr = [char]0x2524
    $tm = [char]0x252C
    $bm = [char]0x2534
    $pointer = [char]0x25B6
    $innerW = $Width - 2

    $rows = @()
    $hits = @()

    $titleText = " " + $Title.Trim() + " "
    $topFill = $innerW - $titleText.Length
    if ($topFill -lt 0) {
        $titleText = Limit-FenneviaTuiText -Text $titleText -Width $innerW
        $topFill = 0
    }
    $rows += [pscustomobject]@{ Kind = "title"; Text = "$tl$hline$titleText$($hline.ToString() * $topFill)$tr"; ItemIndex = -1; Selected = $false }

    $searchLabel = if ($inputMode) { " Value  " } else { " Search " }
    $ghost = if ($inputMode) { "type a value, then Enter" } else { "type to filter" }
    $shownQuery = $queryText
    $searchRoom = $innerW - $searchLabel.Length - 1
    if ($searchRoom -lt 1) {
        $searchRoom = 1
    }
    if ($shownQuery.Length -gt $searchRoom) {
        $shownQuery = $shownQuery.Substring($shownQuery.Length - $searchRoom)
    }
    $searchPlain = if ($shownQuery) { $shownQuery + "_" } else { $ghost }
    $searchBody = Limit-FenneviaTuiText -Text ($searchLabel + $searchPlain) -Width $innerW
    $rows += [pscustomobject]@{ Kind = "search"; Text = "$vline$searchBody$vline"; ItemIndex = -1; Selected = $false }
    $hits += [pscustomobject]@{ Y = 2; ItemIndex = -1; Kind = "search" }

    $countLabel = if ($inputMode) { " Input " } else { " $ListLabel ($($view.Count)/$($itemList.Count)) " }
    if ($showDetails) {
        $leftInner = $listW - 2
        $rightInner = $detailW - 2
        $leftLabel = Limit-FenneviaTuiText -Text $countLabel -Width $leftInner
        $rightLabel = Limit-FenneviaTuiText -Text " Log " -Width $rightInner
        $rows += [pscustomobject]@{ Kind = "header"; Text = "$ml$hline$($leftLabel.TrimEnd())$($hline.ToString() * ($leftInner - $leftLabel.TrimEnd().Length))$tm$hline$($rightLabel.TrimEnd())$($hline.ToString() * ($rightInner - $rightLabel.TrimEnd().Length))$mr"; ItemIndex = -1; Selected = $false }
    }
    else {
        $label = Limit-FenneviaTuiText -Text $countLabel -Width $innerW
        $rows += [pscustomobject]@{ Kind = "header"; Text = "$ml$hline$($label.TrimEnd())$($hline.ToString() * ($innerW - $label.TrimEnd().Length))$mr"; ItemIndex = -1; Selected = $false }
    }

    $visibleLog = @()
    $logBudget = if ($showDetails) { $listHeight } else { [Math]::Max(0, $Height - $logTop) }
    if ($logList.Count -gt $logBudget) {
        $visibleLog = @($logList[($logList.Count - $logBudget)..($logList.Count - 1)])
    }
    else {
        $visibleLog = $logList
    }

    for ($row = 0; $row -lt $listHeight; $row++) {
        $idx = $scroll + $row
        $leftInner = if ($showDetails) { $listW - 2 } else { $innerW }
        $leftText = ""
        $kind = "empty"
        $itemIndex = -1
        $selectedRow = $false
        if ($inputMode -and $row -eq 0) {
            $leftText = Limit-FenneviaTuiText -Text " Enter confirms. Esc cancels." -Width $leftInner
            $kind = "hint"
        }
        elseif ($view.Count -eq 0 -and $row -eq 0 -and -not $inputMode) {
            $leftText = Limit-FenneviaTuiText -Text " no matches" -Width $leftInner
            $kind = "empty"
        }
        elseif ($idx -lt $view.Count) {
            $mark = if ($idx -eq $selected) { $pointer } else { " " }
            $plain = " $mark $([string] $view[$idx].Label)"
            $leftText = Limit-FenneviaTuiText -Text $plain -Width $leftInner
            $kind = "item"
            $itemIndex = $idx
            $selectedRow = ($idx -eq $selected)
            $hits += [pscustomobject]@{ Y = ($listTop + $row); ItemIndex = $idx; Kind = "item" }
        }
        else {
            $leftText = Limit-FenneviaTuiText -Text "" -Width $leftInner
        }

        if ($showDetails) {
            $rightInner = $detailW - 2
            $detailText = if ($row -lt $visibleLog.Count) { [string] $visibleLog[$row] } else { "" }
            $rightText = Limit-FenneviaTuiText -Text $detailText -Width $rightInner
            $rows += [pscustomobject]@{ Kind = $kind; Text = "$vline$leftText$vline$rightText$vline"; ItemIndex = $itemIndex; Selected = $selectedRow }
        }
        else {
            $rows += [pscustomobject]@{ Kind = $kind; Text = "$vline$leftText$vline"; ItemIndex = $itemIndex; Selected = $selectedRow }
        }
    }

    if (-not $showDetails -and $logTop -gt 0) {
        $logHeader = Limit-FenneviaTuiText -Text " Log " -Width $innerW
        $rows += [pscustomobject]@{ Kind = "header"; Text = "$ml$hline$($logHeader.TrimEnd())$($hline.ToString() * ($innerW - $logHeader.TrimEnd().Length))$mr"; ItemIndex = -1; Selected = $false }
        $narrowLogBudget = $Height - $rows.Count - 1
        if ($narrowLogBudget -lt 0) {
            $narrowLogBudget = 0
        }
        $narrowLog = @()
        if ($logList.Count -gt $narrowLogBudget) {
            $narrowLog = @($logList[($logList.Count - $narrowLogBudget)..($logList.Count - 1)])
        }
        else {
            $narrowLog = $logList
        }
        for ($logRow = 0; $logRow -lt $narrowLogBudget; $logRow++) {
            $logText = if ($logRow -lt $narrowLog.Count) { [string] $narrowLog[$logRow] } else { "" }
            $rows += [pscustomobject]@{ Kind = "log"; Text = "$vline$(Limit-FenneviaTuiText -Text $logText -Width $innerW)$vline"; ItemIndex = -1; Selected = $false }
        }
    }

    $hint = if ($inputMode) {
        " enter confirm · esc cancel "
    }
    else {
        " click/enter select · esc cancel · type to filter "
    }
    $hintText = Limit-FenneviaTuiText -Text $hint -Width $innerW
    if ($showDetails) {
        $leftInner = $listW - 2
        $rightInner = $detailW - 2
        $rows += [pscustomobject]@{ Kind = "footer"; Text = "$bl$($hline.ToString() * $leftInner)$bm$($hline.ToString() * $rightInner)$br"; ItemIndex = -1; Selected = $false }
    }
    else {
        $rows += [pscustomobject]@{ Kind = "footer"; Text = "$bl$hintText$br"; ItemIndex = -1; Selected = $false }
    }
    if ($Height -gt 10) {
        $rows[$rows.Count - 1].Text = "$bl$hintText$br"
        $rows[$rows.Count - 1].Kind = "footer"
    }

    if ($rows.Count -gt $Height) {
        $rows = @($rows[0..($Height - 1)])
    }
    while ($rows.Count -lt $Height) {
        $rows += [pscustomobject]@{ Kind = "empty"; Text = (" " * $Width); ItemIndex = -1; Selected = $false }
    }

    $lines = @()
    foreach ($row in $rows) {
        $lines += Limit-FenneviaTuiText -Text ([string] $row.Text) -Width $Width
    }

    return [pscustomobject]@{
        Title = $Title
        Width = $Width
        Height = $Height
        SelectedIndex = $selected
        Scroll = $scroll
        Query = $queryText
        InputMode = $inputMode
        ShowDetails = $showDetails
        ListTop = $listTop
        ListBottom = $listBottom
        ListLeft = 2
        ListRight = ($listW - 1)
        ListHeight = $listHeight
        View = $view
        Rows = $rows
        Lines = $lines
        Hits = $hits
    }
}

function Resolve-FenneviaTuiMouseHit {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Layout,

        [Parameter(Mandatory)]
        [int] $X,

        [Parameter(Mandatory)]
        [int] $Y
    )

    if ($X -lt 1 -or $Y -lt 1 -or $X -gt [int] $Layout.Width) {
        return $null
    }
    $inList = $Y -ge [int] $Layout.ListTop -and $Y -le [int] $Layout.ListBottom -and $X -ge [int] $Layout.ListLeft -and $X -le [int] $Layout.ListRight
    if (-not $inList) {
        return $null
    }
    foreach ($hit in @($Layout.Hits)) {
        if ([string] $hit.Kind -eq "item" -and [int] $hit.Y -eq $Y) {
            return $hit
        }
    }
    return $null
}

function Resolve-FenneviaTuiClickArm {
    [CmdletBinding()]
    param(
        [bool] $Armed,

        [Parameter(Mandatory)]
        [int] $Button,

        [bool] $Down,

        [int] $ElapsedMs = 0,

        [int] $StaleWindowMs = 150
    )

    $isWheel = (($Button -band 64) -eq 64)
    $isMotion = (-not $isWheel) -and (($Button -band 32) -eq 32)
    $isReleasedMotion = $isMotion -and (($Button -band 3) -eq 3)
    $isLeftPress = ($Button -eq 0) -and $Down
    $isLeftRelease = ($Button -eq 0) -and (-not $Down)

    if ($isWheel) {
        return [pscustomobject]@{ Armed = $Armed; Select = $false; Hover = $false; Stale = $false }
    }
    if ($isLeftRelease -or $isReleasedMotion) {
        return [pscustomobject]@{ Armed = $true; Select = $false; Hover = $isReleasedMotion; Stale = $false }
    }
    if ($isMotion) {
        return [pscustomobject]@{ Armed = $Armed; Select = $false; Hover = $true; Stale = $false }
    }
    if ($isLeftPress) {
        if ($Armed) {
            return [pscustomobject]@{ Armed = $false; Select = $true; Hover = $false; Stale = $false }
        }
        if ($ElapsedMs -ge $StaleWindowMs) {
            return [pscustomobject]@{ Armed = $false; Select = $true; Hover = $false; Stale = $false }
        }
        return [pscustomobject]@{ Armed = $false; Select = $false; Hover = $false; Stale = $true }
    }
    return [pscustomobject]@{ Armed = $Armed; Select = $false; Hover = $false; Stale = $false }
}

function Initialize-FenneviaTuiNative {
    [CmdletBinding()]
    param()

    if ($null -ne ("FenneviaTuiNative" -as [type])) {
        return $true
    }

    try {
        Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class FenneviaTuiNative {
    public const int STD_INPUT_HANDLE = -10;
    public const int STD_OUTPUT_HANDLE = -11;
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr GetStdHandle(int nStdHandle);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool GetConsoleMode(IntPtr hConsoleHandle, out uint lpMode);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool SetConsoleMode(IntPtr hConsoleHandle, uint dwMode);
}
"@
        return $true
    }
    catch {
        return $false
    }
}

function Wait-FenneviaTuiKeyAvailable {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [int] $Milliseconds
    )

    $watch = [Diagnostics.Stopwatch]::StartNew()
    while ($watch.ElapsedMilliseconds -lt $Milliseconds) {
        if ([Console]::KeyAvailable) {
            return $true
        }
    }
    return $false
}

function Test-FenneviaTuiEscapeSeqComplete {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [AllowEmptyString()]
        [string] $Text
    )

    $normalized = $Text
    if ($normalized.Length -gt 0 -and $normalized[0] -eq '[') {
        $normalized = ([char]27).ToString() + $normalized
    }
    $esc = [regex]::Escape(([char]27).ToString())
    if ($normalized -match ('^' + $esc + '\[<\d+;\d+;\d+[Mm]')) {
        return $true
    }
    if ($normalized -match ('^' + $esc + '\[[ABCDFHP]')) {
        return $true
    }
    if ($normalized -match ('^' + $esc + '\[\d+[~ABCDEFHP]')) {
        return $true
    }
    return $false
}

function Resolve-FenneviaTuiEscapeText {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [AllowEmptyString()]
        [string] $Text
    )

    $none = [pscustomobject]@{
        Type = "none"
        Char = ""
        Button = 0
        X = 0
        Y = 0
        Down = $false
        Repeat = 1
        Remainder = ""
        Complete = $true
    }
    if ([string]::IsNullOrEmpty($Text)) {
        return $none
    }

    $normalized = $Text
    if ($normalized[0] -eq '[') {
        $normalized = ([char]27).ToString() + $normalized
    }

    $esc = [char]27
    $mouseRe = [regex]([regex]::Escape([string]$esc) + '\[<(\d+);(\d+);(\d+)([Mm])')
    $mouse = $mouseRe.Match($normalized)
    if ($mouse.Success -and $mouse.Index -eq 0) {
        $remainder = ""
        if ($mouse.Length -lt $normalized.Length) {
            $remainder = $normalized.Substring($mouse.Length)
        }
        return [pscustomobject]@{
            Type = "mouse"
            Char = ""
            Button = [int]$mouse.Groups[1].Value
            X = [int]$mouse.Groups[2].Value
            Y = [int]$mouse.Groups[3].Value
            Down = ($mouse.Groups[4].Value -eq "M")
            Repeat = 1
            Remainder = $remainder
            Complete = $true
        }
    }
    if ($normalized.StartsWith(([string]$esc) + "[A")) {
        $remainder = if ($normalized.Length -gt 3) { $normalized.Substring(3) } else { "" }
        return [pscustomobject]@{ Type = "up"; Char = ""; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1; Remainder = $remainder; Complete = $true }
    }
    if ($normalized.StartsWith(([string]$esc) + "[B")) {
        $remainder = if ($normalized.Length -gt 3) { $normalized.Substring(3) } else { "" }
        return [pscustomobject]@{ Type = "down"; Char = ""; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1; Remainder = $remainder; Complete = $true }
    }
    if ($normalized -eq [string]$esc) {
        return [pscustomobject]@{ Type = "cancel"; Char = ""; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1; Remainder = ""; Complete = $true }
    }
    if ($normalized.StartsWith(([string]$esc) + "[") -and $normalized.Length -ge 2) {
        $last = $normalized.Substring($normalized.Length - 1)
        $looksIncompleteMouse = $normalized.Contains("[<") -and $last -ne "M" -and $last -ne "m"
        $looksShortCsi = $normalized.Length -lt 6
        if ($looksIncompleteMouse -or $looksShortCsi) {
            return [pscustomobject]@{ Type = "incomplete"; Char = ""; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1; Remainder = $normalized; Complete = $false }
        }
    }
    return $none
}

function Read-FenneviaTuiCompleteEscape {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Prefix
    )

    $builder = New-Object Text.StringBuilder
    [void]$builder.Append($Prefix)
    $watch = [Diagnostics.Stopwatch]::StartNew()
    while ($builder.Length -lt 64) {
        $soFar = $builder.ToString()
        if (Test-FenneviaTuiEscapeSeqComplete -Text $soFar) {
            break
        }
        $isMousePrefix = $soFar.Contains("[<")
        if (-not [Console]::KeyAvailable) {
            $waitMs = 8
            if ($soFar.Length -eq 1) {
                $waitMs = 25
            }
            elseif ($isMousePrefix) {
                $waitMs = 15
            }
            if ($isMousePrefix -and $watch.ElapsedMilliseconds -lt 120) {
                if (-not (Wait-FenneviaTuiKeyAvailable -Milliseconds $waitMs)) {
                    continue
                }
            }
            elseif (-not (Wait-FenneviaTuiKeyAvailable -Milliseconds $waitMs)) {
                break
            }
        }
        if (-not [Console]::KeyAvailable) {
            if ($isMousePrefix -and $watch.ElapsedMilliseconds -lt 120) {
                continue
            }
            break
        }
        $next = [Console]::ReadKey($true)
        [void]$builder.Append($next.KeyChar)
        if ($watch.ElapsedMilliseconds -gt 120) {
            break
        }
    }
    return $builder.ToString()
}

function ConvertFrom-FenneviaTuiParsedInput {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Parsed
    )

    if ([string] $Parsed.Type -eq "incomplete") {
        return [pscustomobject]@{ Type = "none"; Char = ""; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1 }
    }

    if (-not [string]::IsNullOrEmpty([string] $Parsed.Remainder)) {
        $script:FenneviaTuiUnread = [string] $Parsed.Remainder + $script:FenneviaTuiUnread
    }

    return [pscustomobject]@{
        Type = [string] $Parsed.Type
        Char = [string] $Parsed.Char
        Button = [int] $Parsed.Button
        X = [int] $Parsed.X
        Y = [int] $Parsed.Y
        Down = [bool] $Parsed.Down
        Repeat = [int] $Parsed.Repeat
    }
}

function Clear-FenneviaTuiBufferedInput {
    [CmdletBinding()]
    param()

    $script:FenneviaTuiUnread = ""
    $n = 0
    try {
        while ([Console]::KeyAvailable -and $n -lt 512) {
            [void][Console]::ReadKey($true)
            $n++
        }
    }
    catch {
    }
    return $n
}

function Read-FenneviaTuiInput {
    [CmdletBinding()]
    param()

    if ($null -eq $script:FenneviaTuiUnread) {
        $script:FenneviaTuiUnread = ""
    }
    if ($script:FenneviaTuiUnread.Length -gt 0) {
        $queued = $script:FenneviaTuiUnread
        $script:FenneviaTuiUnread = ""
        if ($queued[0] -eq [char]27 -or $queued.StartsWith("[<") -or $queued.StartsWith("[")) {
            $prefix = $queued
            if ($queued[0] -eq '[') {
                $prefix = ([char]27).ToString() + $queued
            }
            if (-not (Test-FenneviaTuiEscapeSeqComplete -Text $prefix)) {
                $prefix = Read-FenneviaTuiCompleteEscape -Prefix $prefix
            }
            $parsed = Resolve-FenneviaTuiEscapeText -Text $prefix
            return (ConvertFrom-FenneviaTuiParsedInput -Parsed $parsed)
        }
        $ch = [string]$queued[0]
        if ($queued.Length -gt 1) {
            $script:FenneviaTuiUnread = $queued.Substring(1)
        }
        return [pscustomobject]@{ Type = "char"; Char = $ch; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1 }
    }

    $key = [Console]::ReadKey($true)
    $ctrl = [ConsoleModifiers]::Control

    if (
        $key.Key -eq [ConsoleKey]::Enter -or
        $key.KeyChar -eq [char]13 -or
        $key.KeyChar -eq [char]10
    ) {
        return [pscustomobject]@{ Type = "enter"; Char = ""; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1 }
    }
    if (
        $key.Key -eq [ConsoleKey]::Backspace -or
        $key.Key -eq [ConsoleKey]::Delete -or
        $key.KeyChar -eq [char]8 -or
        $key.KeyChar -eq [char]127
    ) {
        return [pscustomobject]@{ Type = "backspace"; Char = ""; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1 }
    }

    $ctrlChar = [int][char]$key.KeyChar
    $withCtrl = [bool]($key.Modifiers -band $ctrl)
    $ctrlLetter = $null
    if ($ctrlChar -ge 1 -and $ctrlChar -le 26) {
        $ctrlLetter = [string][char](64 + $ctrlChar)
    }
    elseif ($withCtrl -and $key.Key -ge [ConsoleKey]::A -and $key.Key -le [ConsoleKey]::Z) {
        $ctrlLetter = $key.Key.ToString()
    }
    if ($ctrlLetter -eq "C") {
        return [pscustomobject]@{ Type = "cancel"; Char = ""; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1 }
    }
    if ($ctrlLetter -eq "U") {
        return [pscustomobject]@{ Type = "clear"; Char = ""; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1 }
    }

    switch ($key.Key) {
        ([ConsoleKey]::UpArrow) { return [pscustomobject]@{ Type = "up"; Char = ""; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1 } }
        ([ConsoleKey]::DownArrow) { return [pscustomobject]@{ Type = "down"; Char = ""; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1 } }
        ([ConsoleKey]::PageUp) { return [pscustomobject]@{ Type = "pageup"; Char = ""; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1 } }
        ([ConsoleKey]::PageDown) { return [pscustomobject]@{ Type = "pagedown"; Char = ""; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1 } }
        ([ConsoleKey]::Home) { return [pscustomobject]@{ Type = "home"; Char = ""; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1 } }
        ([ConsoleKey]::End) { return [pscustomobject]@{ Type = "end"; Char = ""; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1 } }
        ([ConsoleKey]::Tab) { return [pscustomobject]@{ Type = "down"; Char = ""; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1 } }
    }

    $isEsc = ($key.Key -eq [ConsoleKey]::Escape) -or ($key.KeyChar -eq [char]27)
    if ($isEsc) {
        $text = Read-FenneviaTuiCompleteEscape -Prefix ([string][char]27)
        $parsed = Resolve-FenneviaTuiEscapeText -Text $text
        return (ConvertFrom-FenneviaTuiParsedInput -Parsed $parsed)
    }

    if ($key.KeyChar -eq '[') {
        $nextChar = $null
        if ($script:FenneviaTuiUnread.Length -gt 0) {
            $nextChar = $script:FenneviaTuiUnread[0]
            $script:FenneviaTuiUnread = $script:FenneviaTuiUnread.Substring(1)
        }
        elseif ([Console]::KeyAvailable) {
            $nextChar = [Console]::ReadKey($true).KeyChar
        }
        if ($nextChar -eq '<') {
            $text = Read-FenneviaTuiCompleteEscape -Prefix (([char]27).ToString() + "[<")
            $parsed = Resolve-FenneviaTuiEscapeText -Text $text
            return (ConvertFrom-FenneviaTuiParsedInput -Parsed $parsed)
        }
        if ($null -ne $nextChar) {
            $script:FenneviaTuiUnread = ([string]$nextChar) + $script:FenneviaTuiUnread
        }
        return [pscustomobject]@{ Type = "char"; Char = "["; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1 }
    }

    if ($key.KeyChar -and -not [char]::IsControl($key.KeyChar)) {
        return [pscustomobject]@{ Type = "char"; Char = [string]$key.KeyChar; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1 }
    }
    return [pscustomobject]@{ Type = "none"; Char = ""; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1 }
}

function Write-FenneviaTuiLayout {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Layout
    )

    $esc = Get-FenneviaTuiEsc
    $reset = "$esc[0m"
    $bg = "#282a36"
    $fg = "#f8f8f2"
    $current = "#44475a"
    $purple = "#bd93f9"
    $green = "#50fa7b"
    $cyan = "#8be9fd"
    $comment = "#6272a4"
    $sgrBg = Get-FenneviaTuiSgr -Fg $fg -Bg $bg
    $sgrBorder = Get-FenneviaTuiSgr -Fg $comment -Bg $bg
    $sgrTitle = Get-FenneviaTuiSgr -Fg $purple -Bg $bg -Bold
    $sgrSearch = Get-FenneviaTuiSgr -Fg $cyan -Bg $bg
    $sgrSel = Get-FenneviaTuiSgr -Fg $green -Bg $current -Bold
    $sgrItem = Get-FenneviaTuiSgr -Fg $fg -Bg $bg
    $sgrDim = Get-FenneviaTuiSgr -Fg $comment -Bg $bg

    $builder = New-Object Text.StringBuilder
    [void]$builder.Append("$esc[?2026h")
    $rowNumber = 1
    foreach ($row in @($Layout.Rows)) {
        $kind = [string] $row.Kind
        $style = $sgrItem
        if ($kind -eq "title" -or $kind -eq "header" -or $kind -eq "footer") {
            $style = $sgrBorder
        }
        elseif ($kind -eq "search") {
            $style = $sgrSearch
        }
        elseif ($kind -eq "empty" -or $kind -eq "hint" -or $kind -eq "log") {
            $style = $sgrDim
        }
        elseif ($kind -eq "item" -and [bool] $row.Selected) {
            $style = $sgrSel
        }
        if ($kind -eq "title") {
            $style = $sgrTitle
        }
        [void]$builder.Append("$esc[$rowNumber;1H")
        [void]$builder.Append($style)
        [void]$builder.Append([string] $Layout.Lines[$rowNumber - 1])
        [void]$builder.Append("$sgrBg$esc[K$reset")
        $rowNumber++
    }
    if ($rowNumber -le [int] $Layout.Height) {
        [void]$builder.Append("$esc[$rowNumber;1H$sgrBg$esc[J")
    }
    [void]$builder.Append("$esc[?2026l")
    [Console]::Write($builder.ToString())
}

function Restore-FenneviaTuiHostMode {
    [CmdletBinding()]
    param(
        [switch] $IncludeAlternateScreen
    )

    $state = $script:FenneviaTuiState
    if ($null -eq $state -or $null -eq ("FenneviaTuiNative" -as [type])) {
        return $false
    }
    if ($state.InputHandle -eq [IntPtr]::Zero -or $state.OutputHandle -eq [IntPtr]::Zero) {
        return $false
    }

    try {
        $inputMode = [uint32]0
        $outputMode = [uint32]0
        if (-not [FenneviaTuiNative]::GetConsoleMode($state.InputHandle, [ref]$inputMode)) {
            return $false
        }
        if (-not [FenneviaTuiNative]::GetConsoleMode($state.OutputHandle, [ref]$outputMode)) {
            return $false
        }

        $desiredInput = $inputMode
        $desiredInput = $desiredInput -bor [uint32]0x0080
        $desiredInput = $desiredInput -bor [uint32]0x0010
        $desiredInput = $desiredInput -bor [uint32]0x0200
        $desiredInput = $desiredInput -band (-bnot [uint32]0x0040)
        $desiredInput = $desiredInput -band (-bnot [uint32]0x0002)
        $desiredInput = $desiredInput -band (-bnot [uint32]0x0004)
        $desiredOutput = $outputMode -bor [uint32]0x0001 -bor [uint32]0x0002 -bor [uint32]0x0004
        [void][FenneviaTuiNative]::SetConsoleMode($state.InputHandle, $desiredInput)
        [void][FenneviaTuiNative]::SetConsoleMode($state.OutputHandle, $desiredOutput)

        [Console]::TreatControlCAsInput = $true
        [Console]::CursorVisible = $false
        [Console]::OutputEncoding = New-Object Text.UTF8Encoding $false
        $esc = Get-FenneviaTuiEsc
        $seq = "$esc[?25l$esc[?7l$esc[?1000h$esc[?1006h$esc[?1003h"
        if ($IncludeAlternateScreen) {
            $seq = "$esc[?1049h" + $seq
        }
        [Console]::Write($seq)
        return $true
    }
    catch {
        return $false
    }
}

function Enter-FenneviaTuiHost {
    [CmdletBinding()]
    param()

    if (Test-FenneviaTuiHostActive) {
        return $true
    }
    if (-not (Initialize-FenneviaTuiNative)) {
        return $false
    }

    $state = $script:FenneviaTuiState
    if ($null -eq $state) {
        $state = @{ Log = @() }
        $script:FenneviaTuiState = $state
    }
    if ($null -eq $state.Log) {
        $state.Log = @()
    }

    try {
        $inputHandle = [FenneviaTuiNative]::GetStdHandle(-10)
        $outputHandle = [FenneviaTuiNative]::GetStdHandle(-11)
        if ($inputHandle -eq [IntPtr]::Zero -or $outputHandle -eq [IntPtr]::Zero) {
            return $false
        }
        $inputMode = [uint32]0
        $outputMode = [uint32]0
        if (-not [FenneviaTuiNative]::GetConsoleMode($inputHandle, [ref]$inputMode)) {
            return $false
        }
        if (-not [FenneviaTuiNative]::GetConsoleMode($outputHandle, [ref]$outputMode)) {
            return $false
        }

        $state.InputHandle = $inputHandle
        $state.OutputHandle = $outputHandle
        $state.SavedInputMode = $inputMode
        $state.SavedOutputMode = $outputMode
        $state.SavedTreatCtrlC = [Console]::TreatControlCAsInput
        $state.SavedCursorVisible = [Console]::CursorVisible
        $state.SavedOutputEncoding = [Console]::OutputEncoding

        $script:FenneviaTuiState = $state
        if (-not (Restore-FenneviaTuiHostMode -IncludeAlternateScreen)) {
            return $false
        }

        $state.Native = $true
        $state.AlternateScreen = $true
        $state.Active = $true
        $script:FenneviaTuiState = $state
        $script:FenneviaTuiUnread = ""
        $script:FenneviaTuiClickArmed = $true
        return $true
    }
    catch {
        return $false
    }
}

function Exit-FenneviaTuiHost {
    [CmdletBinding()]
    param()

    if (-not (Test-FenneviaTuiHostActive)) {
        return
    }

    $state = $script:FenneviaTuiState
    $esc = Get-FenneviaTuiEsc
    try {
        [Console]::Write("$esc[?2026l$esc[?1003l$esc[?1006l$esc[?1000l")
        [void](Clear-FenneviaTuiBufferedInput)
        [Console]::Write("$esc[?7h$esc[?25h$esc[?1049l")
    }
    catch {
    }
    try {
        if ($null -ne $state.SavedOutputEncoding) {
            [Console]::OutputEncoding = $state.SavedOutputEncoding
        }
        [Console]::CursorVisible = [bool] $state.SavedCursorVisible
        [Console]::TreatControlCAsInput = [bool] $state.SavedTreatCtrlC
    }
    catch {
    }
    try {
        if ([bool] $state.Native) {
            if ($state.InputHandle -ne [IntPtr]::Zero) {
                [void][FenneviaTuiNative]::SetConsoleMode($state.InputHandle, [uint32] $state.SavedInputMode)
            }
            if ($state.OutputHandle -ne [IntPtr]::Zero) {
                [void][FenneviaTuiNative]::SetConsoleMode($state.OutputHandle, [uint32] $state.SavedOutputMode)
            }
        }
    }
    catch {
    }
    $state.Active = $false
    $state.AlternateScreen = $false
}

function Invoke-FenneviaTuiPick {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Title,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [object[]] $Items,

        [string] $ListLabel = "Actions"
    )

    $itemList = @($Items)
    $selected = 0
    $scroll = 0
    $queryText = ""
    $dirty = $true
    $lastW = -1
    $lastH = -1
    $lastWheelAt = [datetime]::MinValue
    $pickerStartedAt = [datetime]::UtcNow
    $clickArmed = $true
    if ($null -ne $script:FenneviaTuiClickArmed) {
        $clickArmed = [bool] $script:FenneviaTuiClickArmed
    }
    [void](Restore-FenneviaTuiHostMode)

    while ($true) {
        $size = Get-FenneviaTuiWindowSize
        if ([int] $size.Width -ne $lastW -or [int] $size.Height -ne $lastH) {
            $dirty = $true
            $lastW = [int] $size.Width
            $lastH = [int] $size.Height
        }
        $layout = Get-FenneviaTuiLayout `
            -Title $Title `
            -Items $itemList `
            -LogLines (Get-FenneviaTuiLogLines) `
            -SelectedIndex $selected `
            -Scroll $scroll `
            -Query $queryText `
            -ListLabel $ListLabel `
            -Width $lastW `
            -Height $lastH
        $selected = [int] $layout.SelectedIndex
        $scroll = [int] $layout.Scroll
        if ($dirty) {
            Write-FenneviaTuiLayout -Layout $layout
            $dirty = $false
        }

        $inputEvent = Read-FenneviaTuiInput
        $view = @($layout.View)
        switch ([string] $inputEvent.Type) {
            "cancel" {
                $script:FenneviaTuiClickArmed = $true
                return $null
            }
            "enter" {
                $script:FenneviaTuiClickArmed = $true
                if ([bool] $layout.InputMode) {
                    return $queryText
                }
                if ($view.Count -gt 0) {
                    return $view[$selected]
                }
            }
            "up" {
                $selected--
                $dirty = $true
            }
            "down" {
                $selected++
                $dirty = $true
            }
            "pageup" {
                $selected -= [int] $layout.ListHeight
                $dirty = $true
            }
            "pagedown" {
                $selected += [int] $layout.ListHeight
                $dirty = $true
            }
            "home" {
                $selected = 0
                $dirty = $true
            }
            "end" {
                $selected = [Math]::Max(0, $view.Count - 1)
                $dirty = $true
            }
            "backspace" {
                if ($queryText.Length -gt 0) {
                    $queryText = $queryText.Substring(0, $queryText.Length - 1)
                    $selected = 0
                    $scroll = 0
                    $dirty = $true
                }
            }
            "clear" {
                $queryText = ""
                $selected = 0
                $scroll = 0
                $dirty = $true
            }
            "char" {
                $queryText += [string] $inputEvent.Char
                $selected = 0
                $scroll = 0
                $dirty = $true
            }
            "mouse" {
                if (([int] $inputEvent.Button -band 64) -eq 64) {
                    $repeat = [int] $inputEvent.Repeat
                    if ($repeat -lt 1) {
                        $repeat = 1
                    }
                    $delta = 3 * $repeat
                    if (([int] $inputEvent.Button -band 1) -eq 0) {
                        $scroll -= $delta
                    }
                    else {
                        $scroll += $delta
                    }
                    $lastWheelAt = [datetime]::UtcNow
                    $dirty = $true
                    break
                }
                $elapsedMs = [int]([datetime]::UtcNow - $pickerStartedAt).TotalMilliseconds
                $arm = Resolve-FenneviaTuiClickArm `
                    -Armed $clickArmed `
                    -Button ([int] $inputEvent.Button) `
                    -Down ([bool] $inputEvent.Down) `
                    -ElapsedMs $elapsedMs
                $clickArmed = [bool] $arm.Armed
                $script:FenneviaTuiClickArmed = $clickArmed
                if ([bool] $arm.Stale) {
                    break
                }
                if ([bool] $arm.Hover) {
                    if (([datetime]::UtcNow - $lastWheelAt).TotalMilliseconds -lt 80) {
                        break
                    }
                    $hit = Resolve-FenneviaTuiMouseHit -Layout $layout -X ([int] $inputEvent.X) -Y ([int] $inputEvent.Y)
                    if ($null -ne $hit -and [int] $hit.ItemIndex -ne $selected) {
                        $selected = [int] $hit.ItemIndex
                        $dirty = $true
                    }
                    break
                }
                if (-not [bool] $arm.Select) {
                    break
                }
                $clickHit = Resolve-FenneviaTuiMouseHit -Layout $layout -X ([int] $inputEvent.X) -Y ([int] $inputEvent.Y)
                if ($null -ne $clickHit -and $view.Count -gt 0) {
                    [void](Clear-FenneviaTuiBufferedInput)
                    $script:FenneviaTuiClickArmed = $false
                    $clickArmed = $false
                    return $view[[int] $clickHit.ItemIndex]
                }
            }
        }
    }
}

Export-ModuleMember -Function @(
    "Add-FenneviaTuiLog",
    "Enter-FenneviaTuiHost",
    "Exit-FenneviaTuiHost",
    "Get-FenneviaTuiLayout",
    "Get-FenneviaTuiLogLines",
    "Invoke-FenneviaTuiPick",
    "Resolve-FenneviaTuiClickArm",
    "Resolve-FenneviaTuiEscapeText",
    "Resolve-FenneviaTuiMouseHit",
    "Test-FenneviaTuiHostActive"
)
