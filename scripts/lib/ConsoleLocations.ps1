# SPDX-License-Identifier: MPL-2.0
# Interactive choices only; persistence lives in FenneviaLocations.psm1.
function Select-FenneviaConsoleSavedLocation {
    param([hashtable] $Session, [hashtable] $Hooks, [scriptblock] $Reader, [switch] $Manage)
    try { $snapshot = Invoke-FenneviaConsoleHook -Hooks $Hooks -Name 'GetSavedLocations' }
    catch {
        Invoke-FenneviaConsoleHook -Hooks $Hooks -Name 'Write' -Arguments @(, @('event=console.locations-unavailable saved-file=unchanged'))
        if ($Manage -and (Read-FenneviaConsoleConfirmation -QuestionId 'clear-locations' -Title 'Clear the unreadable saved list? Firefox and profiles will not be changed.' -Reader $Reader)) {
            Invoke-FenneviaConsoleHook -Hooks $Hooks -Name 'ClearSavedLocations'
        }
        return
    }
    if (@($snapshot.Value.targets).Count -eq 0) { return }
    $items = @(); $index = 0
    foreach ($entry in $snapshot.Value.targets) {
        $available = (Test-Path -LiteralPath $entry.firefoxPath -PathType Leaf) -and (Test-Path -LiteralPath $entry.profilePath -PathType Container)
        $items += [pscustomobject]@{ Id = [string] $entry.id; Label = "Saved pair $($index + 1) ($(if ($available) { 'available' } else { 'moved or missing' }))" }
        $index++
    }
    $items += [pscustomobject]@{ Id = 'scan'; Label = 'Scan Firefox and profiles / choose another pair' }
    $items += [pscustomobject]@{ Id = 'show-paths'; Label = 'Show saved paths in this local terminal' }
    $selected = Read-FenneviaConsoleChoice -QuestionId 'saved-location' -Title 'Saved Firefox and profile locations' -Items $items -Reader $Reader
    if ($selected -eq 'show-paths') {
        foreach ($entry in $snapshot.Value.targets) {
            Invoke-FenneviaConsoleHook -Hooks $Hooks -Name 'Write' -Arguments @(, @([string] $entry.firefoxPath, [string] $entry.profilePath))
        }
        return Select-FenneviaConsoleSavedLocation -Session $Session -Hooks $Hooks -Reader $Reader -Manage:$Manage
    }
    if ($selected -eq 'quit') { $Session.LocationCancelled = $true; return }
    if ($selected -eq 'scan') { return }
    $matches = @($snapshot.Value.targets | Where-Object { $_.id -eq $selected })
    if ($matches.Count -ne 1) { throw 'The saved location choice was not recognized.' }
    $entry = $matches[0]
    if ($Manage) {
        if (Read-FenneviaConsoleConfirmation -QuestionId 'forget-location' -Title 'Forget this pair? Firefox and profile files will not be changed.' -Reader $Reader) {
            [void] (Invoke-FenneviaConsoleHook -Hooks $Hooks -Name 'ForgetLocation' -Arguments @($entry.id, $snapshot.Revision))
        }
        return
    }
    $choices = @(Invoke-FenneviaConsoleHook -Hooks $Hooks -Name 'GetProfileChoices')
    $matching = @($choices | Where-Object { $_.Path -ieq $entry.profilePath })
    if ($matching.Count -ne 1 -or -not (Test-Path -LiteralPath $entry.firefoxPath -PathType Leaf) -or -not (Test-Path -LiteralPath $entry.profilePath -PathType Container)) {
        Invoke-FenneviaConsoleHook -Hooks $Hooks -Name 'Write' -Arguments @(, @('event=console.saved-location-stale action=scan-again'))
        return
    }
    if ($matching[0].IsDefault -and -not (Read-FenneviaConsoleConfirmation -QuestionId 'confirm-default-profile' -Title "The saved profile is now Firefox's default. Use it anyway?" -Reader $Reader)) { return }
    $Session.FirefoxPath = [string] $entry.firefoxPath
    $Session.ProfilePath = [string] $entry.profilePath
    $Session.ProfileName = [string] $matching[0].Name
}

function Save-FenneviaConsoleLocation {
    param([hashtable] $Session, [hashtable] $Hooks, [scriptblock] $Reader)
    if (-not (Read-FenneviaConsoleConfirmation -QuestionId 'save-location' -Title 'Remember this Firefox and profile pair for future runs?' -Reader $Reader)) { return }
    try {
        $snapshot = Invoke-FenneviaConsoleHook -Hooks $Hooks -Name 'GetSavedLocations'
        [void] (Invoke-FenneviaConsoleHook -Hooks $Hooks -Name 'SaveLocation' -Arguments @($Session.FirefoxPath, $Session.ProfilePath, $snapshot.Revision))
        Invoke-FenneviaConsoleHook -Hooks $Hooks -Name 'Write' -Arguments @(, @('event=console.locations-saved'))
    } catch {
        Invoke-FenneviaConsoleHook -Hooks $Hooks -Name 'Write' -Arguments @(, @('event=console.locations-save-failed action=scan-again'))
    }
}
