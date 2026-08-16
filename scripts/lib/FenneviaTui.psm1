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
                if ($label -like "*$queryText*" -or $id -like "*$queryText*") {
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

function Read-FenneviaTuiInput {
    [CmdletBinding()]
    param()

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
        $seq = New-Object Text.StringBuilder
        [void]$seq.Append([char]27)
        if (-not (Wait-FenneviaTuiKeyAvailable -Milliseconds 25)) {
            return [pscustomobject]@{ Type = "cancel"; Char = ""; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1 }
        }
        while ([Console]::KeyAvailable) {
            $next = [Console]::ReadKey($true)
            [void]$seq.Append($next.KeyChar)
            if (-not (Wait-FenneviaTuiKeyAvailable -Milliseconds 8)) {
                break
            }
            if ($seq.Length -ge 512) {
                break
            }
        }
        $text = $seq.ToString()
        $mouseRe = [char]27 + '\[<(\d+);(\d+);(\d+)([Mm])'
        $mouseMatches = [regex]::Matches($text, $mouseRe)
        if ($mouseMatches.Count -gt 0) {
            $wheelDelta = 0
            $lastWheel = $null
            $lastEvent = $null
            foreach ($mouse in $mouseMatches) {
                $lastEvent = $mouse
                $btn = [int]$mouse.Groups[1].Value
                if (($btn -band 64) -eq 64) {
                    $lastWheel = $mouse
                    if (($btn -band 1) -eq 0) {
                        $wheelDelta--
                    }
                    else {
                        $wheelDelta++
                    }
                }
            }
            if ($wheelDelta -ne 0 -and $null -ne $lastWheel) {
                $button = 64
                if ($wheelDelta -gt 0) {
                    $button = 65
                }
                return [pscustomobject]@{
                    Type = "mouse"
                    Char = ""
                    Button = $button
                    Repeat = [Math]::Abs($wheelDelta)
                    X = [int]$lastWheel.Groups[2].Value
                    Y = [int]$lastWheel.Groups[3].Value
                    Down = $true
                }
            }
            return [pscustomobject]@{
                Type = "mouse"
                Char = ""
                Button = [int]$lastEvent.Groups[1].Value
                Repeat = 1
                X = [int]$lastEvent.Groups[2].Value
                Y = [int]$lastEvent.Groups[3].Value
                Down = ($lastEvent.Groups[4].Value -eq "M")
            }
        }
        if ($text.Contains(([char]27).ToString() + "[A")) {
            return [pscustomobject]@{ Type = "up"; Char = ""; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1 }
        }
        if ($text.Contains(([char]27).ToString() + "[B")) {
            return [pscustomobject]@{ Type = "down"; Char = ""; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1 }
        }
        if ($text.Length -eq 1) {
            return [pscustomobject]@{ Type = "cancel"; Char = ""; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1 }
        }
        return [pscustomobject]@{ Type = "none"; Char = ""; Button = 0; X = 0; Y = 0; Down = $false; Repeat = 1 }
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

        $desiredInput = $inputMode
        $desiredInput = $desiredInput -bor [uint32]0x0080
        $desiredInput = $desiredInput -bor [uint32]0x0010
        $desiredInput = $desiredInput -bor [uint32]0x0200
        $desiredInput = $desiredInput -band (-bnot [uint32]0x0040)
        $desiredInput = $desiredInput -band (-bnot [uint32]0x0002)
        $desiredInput = $desiredInput -band (-bnot [uint32]0x0004)
        $desiredOutput = $outputMode -bor [uint32]0x0001 -bor [uint32]0x0002 -bor [uint32]0x0004
        [void][FenneviaTuiNative]::SetConsoleMode($inputHandle, $desiredInput)
        [void][FenneviaTuiNative]::SetConsoleMode($outputHandle, $desiredOutput)

        $esc = Get-FenneviaTuiEsc
        [Console]::TreatControlCAsInput = $true
        [Console]::CursorVisible = $false
        [Console]::OutputEncoding = New-Object Text.UTF8Encoding $false
        [Console]::Write("$esc[?1049h$esc[?25l$esc[?7l$esc[?1000h$esc[?1006h$esc[?1003h")

        $state.Native = $true
        $state.AlternateScreen = $true
        $state.Active = $true
        $script:FenneviaTuiState = $state
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
        [Console]::Write("$esc[?2026l$esc[?1003l$esc[?1006l$esc[?1000l$esc[?7h$esc[?25h$esc[?1049l")
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
            "cancel" { return $null }
            "enter" {
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
                if ([int] $inputEvent.Button -eq 35 -or [int] $inputEvent.Button -eq 32) {
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
                if (-not [bool] $inputEvent.Down) {
                    break
                }
                if ([int] $inputEvent.Button -ne 0) {
                    break
                }
                $clickHit = Resolve-FenneviaTuiMouseHit -Layout $layout -X ([int] $inputEvent.X) -Y ([int] $inputEvent.Y)
                if ($null -ne $clickHit -and $view.Count -gt 0) {
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
    "Resolve-FenneviaTuiMouseHit",
    "Test-FenneviaTuiHostActive"
)
