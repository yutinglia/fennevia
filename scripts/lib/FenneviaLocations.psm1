#requires -Version 5.1
# SPDX-License-Identifier: MPL-2.0
Set-StrictMode -Version Latest

function Get-FenneviaLocationRoot {
    if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { throw 'Saved locations are unavailable.' }
    return Join-Path $env:LOCALAPPDATA 'Fennevia\Setup'
}

function Assert-FenneviaLocationPath {
    param([string] $Path, [switch] $SyntaxOnly)
    if ($Path -notmatch '^[A-Za-z]:[\\/]' -or $Path.Length -gt 30000 -or $Path.Substring(2) -match '[:*?"<>|\x00-\x1f]') {
        throw 'A saved location has an invalid path.'
    }
    foreach ($part in $Path.Substring(3).Split([char[]] '\/')) {
        if ($part -eq '' -or $part -in @('.', '..') -or $part -match '[. ]$|^(?i:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)') {
            throw 'A saved location has an ambiguous path.'
        }
    }
    if (-not $SyntaxOnly) {
        $cursor = $Path
        while ($cursor) {
            if (Test-Path -LiteralPath $cursor) {
                if (((Get-Item -Force -LiteralPath $cursor).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                    throw 'Saved locations cannot use reparse points.'
                }
            }
            $cursor = Split-Path -Parent $cursor
        }
    }
}

function Assert-FenneviaLocationPrivate {
    param([string] $Path)
    Assert-FenneviaLocationPath $Path
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = Get-Acl -LiteralPath $Path
    $rules = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
    if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value -or
        $rules.Count -ne 1 -or $rules[0].IdentityReference.Value -ne $sid.Value -or
        $rules[0].AccessControlType -ne 'Allow' -or
        ($rules[0].FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -ne [Security.AccessControl.FileSystemRights]::FullControl) {
        throw 'Saved locations must be private to the current Windows user.'
    }
}

function Set-FenneviaLocationPrivate {
    param([string] $Path, [switch] $Directory)
    Assert-FenneviaLocationPath $Path
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = if ($Directory) { New-Object Security.AccessControl.DirectorySecurity } else { New-Object Security.AccessControl.FileSecurity }
    $acl.SetOwner($sid)
    $acl.SetAccessRuleProtection($true, $false)
    $inherit = if ($Directory) { [Security.AccessControl.InheritanceFlags] 'ContainerInherit, ObjectInherit' } else { [Security.AccessControl.InheritanceFlags]::None }
    $rule = New-Object Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', $inherit, 'None', 'Allow')
    $acl.AddAccessRule($rule)
    Set-Acl -LiteralPath $Path -AclObject $acl
    Assert-FenneviaLocationPrivate $Path
}

function Get-FenneviaLocationHash {
    param([byte[]] $Bytes)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}

function Assert-FenneviaLocationValue {
    param($Value)
    if ((@($Value.PSObject.Properties.Name | Sort-Object) -join ',') -cne 'schemaVersion,targets' -or
        $Value.schemaVersion -isnot [ValueType] -or $Value.schemaVersion -ne 1 -or $Value.targets -isnot [Array] -or $Value.targets.Count -gt 10) {
        throw 'Saved locations have an unsupported schema.'
    }
    $ids = @{}; $pairs = @{}
    foreach ($entry in $Value.targets) {
        if ((@($entry.PSObject.Properties.Name | Sort-Object) -join ',') -cne 'firefoxPath,id,profilePath') { throw 'A saved location has an unsupported schema.' }
        $id = [guid]::Empty
        if (-not [guid]::TryParse([string] $entry.id, [ref] $id) -or $id -eq [guid]::Empty -or $ids.ContainsKey($id.ToString())) { throw 'A saved location has an invalid identifier.' }
        $ids[$id.ToString()] = $true
        foreach ($path in @($entry.firefoxPath, $entry.profilePath)) {
            if ($path -isnot [string]) { throw 'A saved location has an invalid path.' }
            Assert-FenneviaLocationPath $path -SyntaxOnly
        }
        $pair = $entry.firefoxPath.Replace('\', '/').ToLowerInvariant() + "`n" + $entry.profilePath.Replace('\', '/').ToLowerInvariant()
        if ($pairs.ContainsKey($pair)) { throw 'Saved locations contain a duplicate pair.' }
        $pairs[$pair] = $true
    }
}

function Get-FenneviaSavedLocations {
    $root = Get-FenneviaLocationRoot
    Assert-FenneviaLocationPath $root
    $path = Join-Path $root 'targets.json'
    if (Test-Path -LiteralPath $root) { Assert-FenneviaLocationPrivate $root }
    if (-not (Test-Path -LiteralPath $path)) {
        return [pscustomobject]@{ Value = [pscustomobject]@{ schemaVersion = 1; targets = @() }; Revision = 'absent' }
    }
    Assert-FenneviaLocationPrivate $path
    if ((Get-Item -LiteralPath $path).Length -gt 65536) { throw 'Saved locations exceed the size limit.' }
    $bytes = [IO.File]::ReadAllBytes($path)
    if ($bytes.Length -gt 65536) { throw 'Saved locations exceed the size limit.' }
    $utf8 = New-Object Text.UTF8Encoding($false, $true)
    $value = $utf8.GetString($bytes) | ConvertFrom-Json -ErrorAction Stop
    Assert-FenneviaLocationValue $value
    return [pscustomobject]@{ Value = $value; Revision = Get-FenneviaLocationHash $bytes }
}

function Set-FenneviaSavedLocations {
    param([Parameter(Mandatory)] $Value, [Parameter(Mandatory)] [string] $Revision)
    Assert-FenneviaLocationValue $Value
    $utf8 = New-Object Text.UTF8Encoding($false)
    $bytes = $utf8.GetBytes(($Value | ConvertTo-Json -Depth 5))
    if ($bytes.Length -gt 65536) { throw 'Saved locations exceed the size limit.' }
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $name = 'Global\FenneviaInstaller-' + (Get-FenneviaLocationHash $utf8.GetBytes("preferences:$sid"))
    $mutex = New-Object Threading.Mutex($false, $name)
    $held = $false
    try {
        try { $held = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $held = $true; throw 'Saved locations require a fresh read after an interrupted writer.' }
        if (-not $held) { throw 'Saved locations are in use by another installer.' }
        if ((Get-FenneviaSavedLocations).Revision -cne $Revision) { throw 'Saved locations changed. Scan again before saving.' }
        $root = Get-FenneviaLocationRoot
        if (-not (Test-Path -LiteralPath $root)) {
            [void] [IO.Directory]::CreateDirectory($root)
            Set-FenneviaLocationPrivate $root -Directory
        }
        Assert-FenneviaLocationPrivate $root
        $temp = Join-Path $root ('targets-' + [guid]::NewGuid().ToString() + '.tmp')
        $stream = [IO.File]::Open($temp, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        try {
            Set-FenneviaLocationPrivate $temp
            $stream.Write($bytes, 0, $bytes.Length)
            $stream.Flush($true)
        } finally { $stream.Dispose() }
        try {
            $path = Join-Path $root 'targets.json'
            if (Test-Path -LiteralPath $path) { [IO.File]::Replace($temp, $path, [NullString]::Value) }
            else { [IO.File]::Move($temp, $path) }
        } finally { if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Force } }
        return Get-FenneviaSavedLocations
    } finally {
        if ($held) { $mutex.ReleaseMutex() }
        $mutex.Dispose()
    }
}

function Save-FenneviaLocation {
    param([string] $FirefoxPath, [string] $ProfilePath, [string] $Revision)
    foreach ($path in @($FirefoxPath, $ProfilePath)) { Assert-FenneviaLocationPath $path }
    if (-not (Test-Path -LiteralPath $FirefoxPath -PathType Leaf) -or [IO.Path]::GetFileName($FirefoxPath) -ine 'firefox.exe' -or
        -not (Test-Path -LiteralPath $ProfilePath -PathType Container)) { throw 'Only existing Firefox and profile locations can be saved.' }
    $snapshot = Get-FenneviaSavedLocations
    if ($snapshot.Revision -cne $Revision) { throw 'Saved locations changed. Scan again before saving.' }
    foreach ($entry in $snapshot.Value.targets) {
        if ($entry.firefoxPath -ieq $FirefoxPath -and $entry.profilePath -ieq $ProfilePath) { return $snapshot }
    }
    $snapshot.Value.targets = @($snapshot.Value.targets) + [pscustomobject]@{ id = [guid]::NewGuid().ToString(); firefoxPath = $FirefoxPath; profilePath = $ProfilePath }
    return Set-FenneviaSavedLocations -Value $snapshot.Value -Revision $Revision
}

function Remove-FenneviaSavedLocation {
    param([string] $Id, [string] $Revision)
    $snapshot = Get-FenneviaSavedLocations
    if ($snapshot.Revision -cne $Revision) { throw 'Saved locations changed. Scan again before forgetting.' }
    $snapshot.Value.targets = @($snapshot.Value.targets | Where-Object { $_.id -ne $Id })
    return Set-FenneviaSavedLocations -Value $snapshot.Value -Revision $Revision
}

function Clear-FenneviaSavedLocations {
    param([switch] $Confirmed)
    if (-not $Confirmed) { throw 'Clearing saved locations requires confirmation.' }
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $utf8 = New-Object Text.UTF8Encoding($false)
    $name = 'Global\FenneviaInstaller-' + (Get-FenneviaLocationHash $utf8.GetBytes("preferences:$sid"))
    $mutex = New-Object Threading.Mutex($false, $name)
    $held = $false
    try {
        try { $held = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $held = $true; throw 'Saved locations require a fresh read after an interrupted writer.' }
        if (-not $held) { throw 'Saved locations are in use by another installer.' }
        $root = Get-FenneviaLocationRoot
        Assert-FenneviaLocationPath $root
        if (-not (Test-Path -LiteralPath $root)) { return }
        Assert-FenneviaLocationPrivate $root
        $path = Join-Path $root 'targets.json'
        if (Test-Path -LiteralPath $path) {
            Assert-FenneviaLocationPrivate $path
            [IO.File]::Delete($path)
        }
    } finally {
        if ($held) { $mutex.ReleaseMutex() }
        $mutex.Dispose()
    }
}

Export-ModuleMember -Function Get-FenneviaSavedLocations, Save-FenneviaLocation, Remove-FenneviaSavedLocation, Clear-FenneviaSavedLocations
