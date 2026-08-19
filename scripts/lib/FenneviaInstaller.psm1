Set-StrictMode -Version Latest

$script:PackageId = "fennevia"
$script:PackageSchemaVersion = 1
$script:OwnershipSchemaVersion = 1
$script:MetadataDirectoryName = ".fennevia"
$script:OwnershipFileName = "ownership.json"
$script:TransactionMarkerName = "transaction.json"
$script:TransactionJournalName = "journal.json"
$script:TransactionMarkerOwner = "fennevia-installer-transaction"
$script:DevelopmentMarkerName = ".fennevia-dev-profile.json"
$script:EnabledPreferencePath = "defaults/pref/fennevia.js"
$script:DisabledPreferencePath = "defaults/pref/fennevia.js.disabled"
$script:ProgramConfigPath = "fennevia.cfg"
$script:ProfilePackagePrefix = "chrome/fennevia/"
$script:ReleaseManifestName = "RELEASE-MANIFEST.json"

function New-FenneviaInstallerException {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Code,

        [Parameter(Mandatory)]
        [string] $Message
    )

    $exception = New-Object InvalidOperationException($Message)
    $exception.Data["FenneviaCode"] = $Code
    return $exception
}

function Throw-FenneviaInstallerError {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Code,

        [Parameter(Mandatory)]
        [string] $Message
    )

    throw (New-FenneviaInstallerException -Code $Code -Message $Message)
}

function Get-FenneviaInstallerErrorCode {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [Management.Automation.ErrorRecord] $ErrorRecord
    )

    $exception = $ErrorRecord.Exception
    while ($null -ne $exception) {
        if ($exception.Data.Contains("FenneviaCode")) {
            return [string] $exception.Data["FenneviaCode"]
        }
        $exception = $exception.InnerException
    }

    return "FENNEVIA_INSTALL_UNEXPECTED"
}

function Write-FenneviaInstallerUtf8NoBom {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path,

        [Parameter(Mandatory)]
        [AllowEmptyString()]
        [string] $Content
    )

    $encoding = New-Object Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($Path, $Content, $encoding)
}

function ConvertTo-FenneviaInstallerCanonicalPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path,

        [string] $Code = "FENNEVIA_INSTALL_INVALID_PATH"
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        Throw-FenneviaInstallerError -Code $Code -Message "An explicit non-empty absolute path is required."
    }

    $expandedPath = [Environment]::ExpandEnvironmentVariables($Path)
    if (-not [IO.Path]::IsPathRooted($expandedPath)) {
        Throw-FenneviaInstallerError -Code $Code -Message "Relative paths are not accepted."
    }

    if ($expandedPath.IndexOfAny([char[]] "*?") -ge 0) {
        Throw-FenneviaInstallerError -Code $Code -Message "Wildcard paths are not accepted."
    }

    try {
        $fullPath = [IO.Path]::GetFullPath($expandedPath)
    }
    catch {
        Throw-FenneviaInstallerError -Code $Code -Message "The path could not be canonicalized."
    }

    $pathRoot = [IO.Path]::GetPathRoot($fullPath)
    if ([string]::Equals($fullPath, $pathRoot, [StringComparison]::OrdinalIgnoreCase)) {
        return $pathRoot
    }

    return $fullPath.TrimEnd("\", "/")
}

function Test-FenneviaInstallerPathWithin {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $ChildPath,

        [Parameter(Mandatory)]
        [string] $ParentPath
    )

    $prefix = $ParentPath.TrimEnd("\", "/") + [IO.Path]::DirectorySeparatorChar
    return $ChildPath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)
}

function Assert-FenneviaInstallerNoReparseAncestor {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path,

        [string] $Code = "FENNEVIA_INSTALL_REPARSE_POINT"
    )

    $currentPath = $Path
    $pathRoot = [IO.Path]::GetPathRoot($Path)

    while (-not [string]::IsNullOrWhiteSpace($currentPath)) {
        if (Test-Path -LiteralPath $currentPath) {
            $item = Get-Item -Force -LiteralPath $currentPath
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                Throw-FenneviaInstallerError -Code $Code -Message "A selected path has a reparse-point ancestor."
            }
        }

        if ([string]::Equals($currentPath, $pathRoot, [StringComparison]::OrdinalIgnoreCase)) {
            break
        }

        $parentPath = Split-Path -Parent $currentPath
        if ([string]::IsNullOrWhiteSpace($parentPath) -or [string]::Equals($parentPath, $currentPath, [StringComparison]::OrdinalIgnoreCase)) {
            break
        }
        $currentPath = $parentPath
    }
}

function Assert-FenneviaInstallerTreeHasNoReparsePoints {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path,

        [string] $Code = "FENNEVIA_INSTALL_REPARSE_POINT"
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        return
    }

    $pending = New-Object "Collections.Generic.Queue[string]"
    $pending.Enqueue($Path)
    while ($pending.Count -gt 0) {
        $directory = $pending.Dequeue()
        foreach ($child in @(Get-ChildItem -Force -LiteralPath $directory)) {
            if (($child.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                Throw-FenneviaInstallerError -Code $Code -Message "A managed tree contains a reparse point."
            }
            if ($child.PSIsContainer) {
                $pending.Enqueue($child.FullName)
            }
        }
    }
}

function ConvertTo-FenneviaInstallerRelativePath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path,

        [string] $Code = "FENNEVIA_INSTALL_MANIFEST_PATH"
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        Throw-FenneviaInstallerError -Code $Code -Message "Manifest paths must not be empty."
    }

    $normalizedPath = $Path.Replace("\", "/").Trim("/")
    if (
        [IO.Path]::IsPathRooted($Path) -or
        $normalizedPath -match "(^|/)\.\.?(?:/|$)" -or
        $normalizedPath.Contains(":") -or
        $normalizedPath.Contains("//") -or
        $normalizedPath -notmatch "^[A-Za-z0-9._/-]+$"
    ) {
        Throw-FenneviaInstallerError -Code $Code -Message "Manifest paths must be normalized ASCII relative paths without traversal or alternate data streams."
    }

    return $normalizedPath
}

function ConvertTo-FenneviaInstallerNativeRelativePath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    return $Path.Replace("/", [IO.Path]::DirectorySeparatorChar)
}

function Join-FenneviaInstallerRootPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Root,

        [Parameter(Mandatory)]
        [string] $RelativePath
    )

    $nativePath = ConvertTo-FenneviaInstallerNativeRelativePath -Path $RelativePath
    $fullPath = ConvertTo-FenneviaInstallerCanonicalPath -Path (Join-Path $Root $nativePath)
    if (-not (Test-FenneviaInstallerPathWithin -ChildPath $fullPath -ParentPath $Root)) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_PATH_ESCAPE" -Message "A managed relative path escaped its selected root."
    }
    return $fullPath
}

function Get-FenneviaInstallerSha256 {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Assert-FenneviaInstallerExactProperties {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $InputObject,

        [Parameter(Mandatory)]
        [string[]] $Properties,

        [Parameter(Mandatory)]
        [string] $Code,

        [Parameter(Mandatory)]
        [string] $Description
    )

    $actualProperties = @($InputObject.PSObject.Properties.Name)
    if ($actualProperties.Count -ne $Properties.Count) {
        Throw-FenneviaInstallerError -Code $Code -Message "$Description has an unexpected property set."
    }

    foreach ($property in $Properties) {
        if ($actualProperties -notcontains $property) {
            Throw-FenneviaInstallerError -Code $Code -Message "$Description is missing a required property."
        }
    }
}

function Assert-FenneviaInstallerHashString {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Hash,

        [Parameter(Mandatory)]
        [string] $Code
    )

    if ($Hash -cnotmatch "^[0-9a-f]{64}$") {
        Throw-FenneviaInstallerError -Code $Code -Message "A manifest SHA-256 value is invalid."
    }
}

function Test-FenneviaInstallerApprovedProgramPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    return $Path -in @($script:EnabledPreferencePath, $script:DisabledPreferencePath, $script:ProgramConfigPath)
}

function Test-FenneviaInstallerApprovedProfilePath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    return $Path.StartsWith($script:ProfilePackagePrefix, [StringComparison]::Ordinal)
}

function Assert-FenneviaInstallerManagedPathApproved {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateSet("program", "profile")]
        [string] $Scope,

        [Parameter(Mandatory)]
        [string] $Path,

        [Parameter(Mandatory)]
        [string] $Code
    )

    $approved = if ($Scope -eq "program") {
        Test-FenneviaInstallerApprovedProgramPath -Path $Path
    }
    else {
        Test-FenneviaInstallerApprovedProfilePath -Path $Path
    }

    if (-not $approved) {
        Throw-FenneviaInstallerError -Code $Code -Message "A manifest path is outside the approved Fennevia package boundaries."
    }
}

function Get-FenneviaInstallerBroadRoots {
    [CmdletBinding()]
    param()

    $candidates = @(
        $env:USERPROFILE,
        $env:APPDATA,
        $env:LOCALAPPDATA,
        [Environment]::GetFolderPath("UserProfile"),
        [Environment]::GetFolderPath("ApplicationData"),
        [Environment]::GetFolderPath("LocalApplicationData"),
        [Environment]::GetFolderPath("CommonApplicationData"),
        [Environment]::GetFolderPath("ProgramFiles"),
        [Environment]::GetFolderPath("ProgramFilesX86"),
        [Environment]::GetFolderPath("Windows")
    )

    $roots = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    foreach ($candidate in $candidates) {
        if ([string]::IsNullOrWhiteSpace($candidate)) {
            continue
        }
        try {
            [void] $roots.Add((ConvertTo-FenneviaInstallerCanonicalPath -Path $candidate))
        }
        catch {
            continue
        }
    }

    foreach ($drive in @(Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue)) {
        if (-not [string]::IsNullOrWhiteSpace($drive.Root)) {
            [void] $roots.Add((ConvertTo-FenneviaInstallerCanonicalPath -Path $drive.Root))
        }
    }

    return @($roots)
}

function Get-FenneviaInstallerFirefoxDataRoot {
    [CmdletBinding()]
    param()

    $applicationData = if (-not [string]::IsNullOrWhiteSpace($env:APPDATA)) { $env:APPDATA } else { [Environment]::GetFolderPath("ApplicationData") }
    if ([string]::IsNullOrWhiteSpace($applicationData)) {
        return ""
    }
    return Join-Path $applicationData "Mozilla\Firefox"
}

function ConvertTo-FenneviaInstallerRegisteredProfilePath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Candidate,

        [Parameter(Mandatory)]
        [string] $FirefoxDataRoot,

        [string] $IsRelative = ""
    )

    $resolved = $Candidate
    if ($IsRelative -eq "1" -or -not [IO.Path]::IsPathRooted($resolved)) {
        $resolved = Join-Path $FirefoxDataRoot $Candidate
    }
    if (-not [IO.Path]::IsPathRooted($resolved)) {
        return ""
    }
    return ConvertTo-FenneviaInstallerCanonicalPath -Path $resolved
}

function Get-FenneviaInstallerRegisteredProfileEntries {
    [CmdletBinding()]
    param()

    $entries = @()
    $firefoxDataRoot = Get-FenneviaInstallerFirefoxDataRoot
    if ([string]::IsNullOrWhiteSpace($firefoxDataRoot) -or -not (Test-Path -LiteralPath $firefoxDataRoot -PathType Container)) {
        return @()
    }

    $profilesIni = Join-Path $firefoxDataRoot "profiles.ini"
    if (Test-Path -LiteralPath $profilesIni -PathType Leaf) {
        $current = @{}
        foreach ($line in Get-Content -LiteralPath $profilesIni) {
            $trimmed = $line.Trim()
            if ($trimmed -match "^\[(.+)\]$") {
                if ($current.ContainsKey("Path")) {
                    $isRelative = ""
                    if ($current.ContainsKey("IsRelative")) {
                        $isRelative = [string] $current["IsRelative"]
                    }
                    $sectionName = ""
                    if ($current.ContainsKey("Name")) {
                        $sectionName = [string] $current["Name"]
                    }
                    $candidate = ConvertTo-FenneviaInstallerRegisteredProfilePath `
                        -Candidate ([string] $current["Path"]) `
                        -FirefoxDataRoot $firefoxDataRoot `
                        -IsRelative $isRelative
                    if (-not [string]::IsNullOrWhiteSpace($candidate)) {
                        $entries += [pscustomobject]@{
                            Name = $sectionName
                            Path = $candidate
                            IsDefault = ($current.ContainsKey("Default") -and $current["Default"] -eq "1")
                        }
                    }
                }
                $current = @{}
                continue
            }
            if ($trimmed -match "^([^=]+)=(.*)$") {
                $current[$Matches[1].Trim()] = $Matches[2].Trim()
            }
        }
        if ($current.ContainsKey("Path")) {
            $isRelative = ""
            if ($current.ContainsKey("IsRelative")) {
                $isRelative = [string] $current["IsRelative"]
            }
            $sectionName = ""
            if ($current.ContainsKey("Name")) {
                $sectionName = [string] $current["Name"]
            }
            $candidate = ConvertTo-FenneviaInstallerRegisteredProfilePath `
                -Candidate ([string] $current["Path"]) `
                -FirefoxDataRoot $firefoxDataRoot `
                -IsRelative $isRelative
            if (-not [string]::IsNullOrWhiteSpace($candidate)) {
                $entries += [pscustomobject]@{
                    Name = $sectionName
                    Path = $candidate
                    IsDefault = ($current.ContainsKey("Default") -and $current["Default"] -eq "1")
                }
            }
        }
    }

    $installsIni = Join-Path $firefoxDataRoot "installs.ini"
    if (Test-Path -LiteralPath $installsIni -PathType Leaf) {
        foreach ($line in Get-Content -LiteralPath $installsIni) {
            $trimmed = $line.Trim()
            if ($trimmed -notmatch "^Default=(.+)$") {
                continue
            }
            $candidate = ConvertTo-FenneviaInstallerRegisteredProfilePath `
                -Candidate $Matches[1].Trim() `
                -FirefoxDataRoot $firefoxDataRoot
            if ([string]::IsNullOrWhiteSpace($candidate)) {
                continue
            }
            $existing = $false
            $updated = @()
            foreach ($entry in $entries) {
                if ([string]::Equals([string] $entry.Path, $candidate, [StringComparison]::OrdinalIgnoreCase)) {
                    $updated += [pscustomobject]@{
                        Name = [string] $entry.Name
                        Path = [string] $entry.Path
                        IsDefault = $true
                    }
                    $existing = $true
                }
                else {
                    $updated += $entry
                }
            }
            if ($existing) {
                $entries = $updated
            }
            else {
                $entries += [pscustomobject]@{
                    Name = ""
                    Path = $candidate
                    IsDefault = $true
                }
            }
        }
    }

    return $entries
}

function Get-FenneviaInstallerRegisteredProfilePaths {
    [CmdletBinding()]
    param()

    $paths = @()
    foreach ($entry in @(Get-FenneviaInstallerRegisteredProfileEntries)) {
        $alreadyPresent = $false
        foreach ($existing in $paths) {
            if ([string]::Equals($existing, [string] $entry.Path, [StringComparison]::OrdinalIgnoreCase)) {
                $alreadyPresent = $true
                break
            }
        }
        if (-not $alreadyPresent) {
            $paths += [string] $entry.Path
        }
    }
    return $paths
}

function Get-FenneviaInstallerRegisteredProfileChoices {
    [CmdletBinding()]
    param()

    $choices = @()
    $usedNames = @()
    $sorted = @(Get-FenneviaInstallerRegisteredProfileEntries | Sort-Object Name, Path)
    foreach ($entry in $sorted) {
        $name = [string] $entry.Name
        if ([string]::IsNullOrWhiteSpace($name)) {
            $name = Split-Path -Leaf ([string] $entry.Path)
        }
        foreach ($used in $usedNames) {
            if ([string]::Equals($used, $name, [StringComparison]::OrdinalIgnoreCase)) {
                $name = "$name ($(Split-Path -Leaf ([string] $entry.Path)))"
                break
            }
        }
        $usedNames += $name
        $choices += [pscustomobject]@{
            Name = $name
            IsDefault = [bool] $entry.IsDefault
            Path = [string] $entry.Path
        }
    }
    return $choices
}

function ConvertTo-FenneviaInstallerProfileChoiceLines {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [object[]] $Choices
    )

    $lines = New-Object "Collections.Generic.List[string]"
    $index = 0
    foreach ($choice in @($Choices)) {
        $label = [string] $choice.Name
        if ([bool] $choice.IsDefault) {
            $label += " (Firefox default)"
        }
        $lines.Add("profile[$index]=$label")
        $index++
    }
    return $lines.ToArray()
}

function Get-FenneviaFirefoxProgramCandidates {
    [CmdletBinding()]
    param()

    $candidates = New-Object "Collections.Generic.List[string]"
    $registryKeys = @(
        "HKLM:\SOFTWARE\Mozilla\Mozilla Firefox",
        "HKLM:\SOFTWARE\WOW6432Node\Mozilla\Mozilla Firefox",
        "HKCU:\SOFTWARE\Mozilla\Mozilla Firefox"
    )
    foreach ($registryKey in $registryKeys) {
        if (-not (Test-Path -LiteralPath $registryKey)) {
            continue
        }
        $registryValues = Get-ItemProperty -LiteralPath $registryKey -ErrorAction SilentlyContinue
        if ($null -eq $registryValues) {
            continue
        }
        $currentVersion = $null
        $versionProperty = $registryValues.PSObject.Properties["CurrentVersion"]
        if ($null -ne $versionProperty) {
            $currentVersion = [string] $versionProperty.Value
        }
        if ([string]::IsNullOrWhiteSpace($currentVersion)) {
            continue
        }
        $mainKey = Join-Path $registryKey "$currentVersion\Main"
        $mainValues = Get-ItemProperty -LiteralPath $mainKey -ErrorAction SilentlyContinue
        if ($null -eq $mainValues) {
            continue
        }
        $pathProperty = $mainValues.PSObject.Properties["PathToExe"]
        if ($null -ne $pathProperty -and -not [string]::IsNullOrWhiteSpace([string] $pathProperty.Value)) {
            $candidates.Add([string] $pathProperty.Value)
        }
    }

    $programFilesX86 = [Environment]::GetEnvironmentVariable("ProgramFiles(x86)")
    $candidates.Add((Join-Path $env:ProgramFiles "Mozilla Firefox\firefox.exe"))
    if (-not [string]::IsNullOrWhiteSpace($programFilesX86)) {
        $candidates.Add((Join-Path $programFilesX86 "Mozilla Firefox\firefox.exe"))
    }

    $resolved = New-Object "Collections.Generic.List[object]"
    $seen = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    foreach ($candidate in $candidates) {
        if ([string]::IsNullOrWhiteSpace($candidate) -or -not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            continue
        }
        try {
            $canonical = ConvertTo-FenneviaInstallerCanonicalPath -Path $candidate -Code "FENNEVIA_INSTALL_INVALID_PROGRAM"
        }
        catch {
            continue
        }
        if ([IO.Path]::GetFileName($canonical) -cne "firefox.exe") {
            continue
        }
        if (-not $seen.Add($canonical)) {
            continue
        }
        $programRoot = Split-Path -Parent $canonical
        $applicationIni = Join-Path $programRoot "application.ini"
        $version = ""
        $buildId = ""
        if (Test-Path -LiteralPath $applicationIni -PathType Leaf) {
            $values = Get-FenneviaInstallerApplicationValues -ApplicationIni $applicationIni
            if ($values.ContainsKey("Version")) {
                $version = [string] $values["Version"]
            }
            if ($values.ContainsKey("BuildID")) {
                $buildId = [string] $values["BuildID"]
            }
        }
        $resolved.Add([pscustomobject]@{
            FirefoxPath = $canonical
            Label = if (-not [string]::IsNullOrWhiteSpace($version)) { "Firefox $version" } else { "Firefox" }
            Version = $version
            BuildID = $buildId
        })
    }
    return @($resolved)
}

function ConvertTo-FenneviaInstallerProgramCandidateLines {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [object[]] $Candidates
    )

    $lines = New-Object "Collections.Generic.List[string]"
    $index = 0
    foreach ($candidate in @($Candidates)) {
        $label = [string] $candidate.Label
        if (-not [string]::IsNullOrWhiteSpace([string] $candidate.BuildID)) {
            $label += " BuildID $($candidate.BuildID)"
        }
        $lines.Add("firefox[$index]=$label")
        $index++
    }
    return $lines.ToArray()
}

function Test-FenneviaInstallerDevelopmentMarker {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $ProfileRoot
    )

    $markerPath = Join-Path $ProfileRoot $script:DevelopmentMarkerName
    if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
        return $false
    }
    $markerItem = Get-Item -Force -LiteralPath $markerPath
    if (($markerItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        return $false
    }

    try {
        $marker = Get-Content -Raw -LiteralPath $markerPath | ConvertFrom-Json
        return (
            [int] $marker.schemaVersion -eq 1 -and
            [string] $marker.owner -ceq $script:PackageId -and
            [string] $marker.profileName -ceq "fennevia-dev"
        )
    }
    catch {
        return $false
    }
}

function Get-FenneviaInstallerApplicationValues {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $ApplicationIni
    )

    $values = @{}
    $section = ""
    foreach ($line in Get-Content -LiteralPath $ApplicationIni) {
        $trimmed = $line.Trim()
        if ($trimmed -match "^\[(.+)\]$") {
            $section = $Matches[1]
            continue
        }
        if ($section -eq "App" -and $trimmed -match "^([^=]+)=(.*)$") {
            $values[$Matches[1].Trim()] = $Matches[2].Trim()
        }
    }
    return $values
}

function Resolve-FenneviaInstallerTargets {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $FirefoxPath,

        [Parameter(Mandatory)]
        [string] $ProfilePath,

        [Parameter(Mandatory)]
        [ValidateSet("Development", "Registered")]
        [string] $ProfileMode
    )

    $canonicalFirefox = ConvertTo-FenneviaInstallerCanonicalPath -Path $FirefoxPath -Code "FENNEVIA_INSTALL_INVALID_PROGRAM"
    if (-not (Test-Path -LiteralPath $canonicalFirefox -PathType Leaf)) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_INVALID_PROGRAM" -Message "The explicitly selected Firefox executable does not exist."
    }
    if ([IO.Path]::GetFileName($canonicalFirefox) -cne "firefox.exe") {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_INVALID_PROGRAM" -Message "The program selection must name firefox.exe explicitly."
    }

    $programRoot = ConvertTo-FenneviaInstallerCanonicalPath -Path (Split-Path -Parent $canonicalFirefox) -Code "FENNEVIA_INSTALL_INVALID_PROGRAM"
    $profileRoot = ConvertTo-FenneviaInstallerCanonicalPath -Path $ProfilePath -Code "FENNEVIA_INSTALL_INVALID_PROFILE"

    foreach ($broadRoot in @(Get-FenneviaInstallerBroadRoots)) {
        if (
            [string]::Equals($programRoot, $broadRoot, [StringComparison]::OrdinalIgnoreCase) -or
            [string]::Equals($profileRoot, $broadRoot, [StringComparison]::OrdinalIgnoreCase)
        ) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_UNSAFE_ROOT" -Message "A selected target is a broad filesystem, user, application-data, program-files, or operating-system root."
        }
    }

    if (-not (Test-Path -LiteralPath $programRoot -PathType Container)) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_INVALID_PROGRAM" -Message "The selected Firefox program directory does not exist."
    }
    if (-not (Test-Path -LiteralPath $profileRoot -PathType Container)) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_INVALID_PROFILE" -Message "The explicitly selected profile directory does not exist."
    }

    Assert-FenneviaInstallerNoReparseAncestor -Path $canonicalFirefox
    Assert-FenneviaInstallerNoReparseAncestor -Path $profileRoot

    if (
        [string]::Equals($programRoot, $profileRoot, [StringComparison]::OrdinalIgnoreCase) -or
        (Test-FenneviaInstallerPathWithin -ChildPath $programRoot -ParentPath $profileRoot) -or
        (Test-FenneviaInstallerPathWithin -ChildPath $profileRoot -ParentPath $programRoot)
    ) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OVERLAPPING_ROOTS" -Message "The program and profile targets must not overlap."
    }

    $applicationIni = Join-Path $programRoot "application.ini"
    $preferenceRoot = Join-Path $programRoot "defaults\pref"
    if (-not (Test-Path -LiteralPath $applicationIni -PathType Leaf) -or -not (Test-Path -LiteralPath $preferenceRoot -PathType Container)) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_INVALID_PROGRAM" -Message "The selected program is missing the required stock Firefox identity files."
    }
    Assert-FenneviaInstallerNoReparseAncestor -Path $applicationIni
    Assert-FenneviaInstallerNoReparseAncestor -Path $preferenceRoot

    $applicationValues = Get-FenneviaInstallerApplicationValues -ApplicationIni $applicationIni
    if (
        -not $applicationValues.ContainsKey("Name") -or
        [string] $applicationValues["Name"] -cne "Firefox" -or
        -not $applicationValues.ContainsKey("Version") -or
        [string]::IsNullOrWhiteSpace([string] $applicationValues["Version"]) -or
        -not $applicationValues.ContainsKey("BuildID") -or
        [string]::IsNullOrWhiteSpace([string] $applicationValues["BuildID"])
    ) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_INVALID_PROGRAM" -Message "The selected program is not a source-identifiable stock Firefox build."
    }

    $applicationDataRoots = @(
        $env:APPDATA,
        $env:LOCALAPPDATA,
        [Environment]::GetFolderPath("ApplicationData"),
        [Environment]::GetFolderPath("LocalApplicationData")
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Sort-Object -Unique
    $firefoxDataRoots = @($applicationDataRoots | ForEach-Object { Join-Path $_ "Mozilla\Firefox" })
    foreach ($dataRootCandidate in $firefoxDataRoots) {
        if ([string]::IsNullOrWhiteSpace($dataRootCandidate)) {
            continue
        }
        $dataRoot = ConvertTo-FenneviaInstallerCanonicalPath -Path $dataRootCandidate
        $profilesRoot = ConvertTo-FenneviaInstallerCanonicalPath -Path (Join-Path $dataRoot "Profiles")
        if (
            [string]::Equals($profileRoot, $dataRoot, [StringComparison]::OrdinalIgnoreCase) -or
            [string]::Equals($profileRoot, $profilesRoot, [StringComparison]::OrdinalIgnoreCase)
        ) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_REGISTERED_PROFILE" -Message "A Firefox profile collection is never an accepted installation target."
        }
        if (
            $ProfileMode -eq "Development" -and
            (Test-FenneviaInstallerPathWithin -ChildPath $profileRoot -ParentPath $profilesRoot)
        ) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_REGISTERED_PROFILE" -Message "Registered-style profile children require the explicit Registered profile mode."
        }
    }

    $isRegisteredProfile = $false
    foreach ($registeredProfile in @(Get-FenneviaInstallerRegisteredProfilePaths)) {
        if ([string]::Equals($profileRoot, $registeredProfile, [StringComparison]::OrdinalIgnoreCase)) {
            $isRegisteredProfile = $true
            break
        }
    }
    if ($ProfileMode -eq "Development" -and $isRegisteredProfile) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_REGISTERED_PROFILE" -Message "The selected path is registered as a Firefox profile and requires the explicit Registered profile mode."
    }

    return [pscustomobject]@{
        FirefoxPath = $canonicalFirefox
        ProgramRoot = $programRoot
        ProfileRoot = $profileRoot
        FirefoxVersion = [string] $applicationValues["Version"]
        FirefoxBuildID = [string] $applicationValues["BuildID"]
        ProfileMode = $ProfileMode
        IsRegisteredProfile = $isRegisteredProfile
        HasDevelopmentMarker = Test-FenneviaInstallerDevelopmentMarker -ProfileRoot $profileRoot
    }
}

function Get-FenneviaInstallerScopeRoot {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets,

        [Parameter(Mandatory)]
        [ValidateSet("program", "profile")]
        [string] $Scope
    )

    if ($Scope -eq "program") {
        return $Targets.ProgramRoot
    }
    return $Targets.ProfileRoot
}

function Get-FenneviaInstallerOwnershipPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Root
    )

    return Join-Path (Join-Path $Root $script:MetadataDirectoryName) $script:OwnershipFileName
}

function Read-FenneviaInstallerPackageManifest {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $PackageRoot
    )

    $canonicalPackageRoot = ConvertTo-FenneviaInstallerCanonicalPath -Path $PackageRoot -Code "FENNEVIA_INSTALL_PACKAGE_INVALID"
    if (-not (Test-Path -LiteralPath $canonicalPackageRoot -PathType Container)) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_PACKAGE_INVALID" -Message "The package source root does not exist."
    }
    Assert-FenneviaInstallerNoReparseAncestor -Path $canonicalPackageRoot -Code "FENNEVIA_INSTALL_PACKAGE_INVALID"

    $manifestPath = Join-Path $canonicalPackageRoot "package-manifest.json"
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_PACKAGE_INVALID" -Message "The package manifest is missing."
    }
    Assert-FenneviaInstallerNoReparseAncestor -Path $manifestPath -Code "FENNEVIA_INSTALL_PACKAGE_INVALID"

    try {
        $manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
    }
    catch {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_PACKAGE_INVALID" -Message "The package manifest is not valid JSON."
    }

    Assert-FenneviaInstallerExactProperties -InputObject $manifest -Properties @(
        "schemaVersion", "packageId", "packageVersion", "expectedFiles", "files"
    ) -Code "FENNEVIA_INSTALL_PACKAGE_INVALID" -Description "The package manifest"

    try {
        $schemaVersion = [int] $manifest.schemaVersion
    }
    catch {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_PACKAGE_INVALID" -Message "The package schema version is invalid."
    }
    if ($schemaVersion -ne $script:PackageSchemaVersion -or [string] $manifest.packageId -cne $script:PackageId) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_PACKAGE_INVALID" -Message "The package schema or owner identity is unsupported."
    }

    $packageVersion = [string] $manifest.packageVersion
    if ($packageVersion -cnotmatch "^[0-9A-Za-z][0-9A-Za-z.-]{0,63}$") {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_PACKAGE_INVALID" -Message "The package version is invalid."
    }

    $expectedFiles = @(
        @($manifest.expectedFiles) |
            ForEach-Object { ConvertTo-FenneviaInstallerRelativePath -Path ([string] $_) -Code "FENNEVIA_INSTALL_PACKAGE_INVALID" }
    )
    if ($expectedFiles.Count -eq 0) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_PACKAGE_INVALID" -Message "The package artifact inventory is empty."
    }
    $expectedSet = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    foreach ($expectedFile in $expectedFiles) {
        if (-not $expectedSet.Add($expectedFile)) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_PACKAGE_INVALID" -Message "The package artifact inventory contains duplicate paths."
        }
    }

    $files = New-Object "Collections.Generic.List[object]"
    $logicalKeys = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    foreach ($file in @($manifest.files)) {
        Assert-FenneviaInstallerExactProperties -InputObject $file -Properties @("scope", "path", "sha256") -Code "FENNEVIA_INSTALL_PACKAGE_INVALID" -Description "A package file entry"
        $scope = [string] $file.scope
        if ($scope -notin @("program", "profile")) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_PACKAGE_INVALID" -Message "A package file scope is invalid."
        }
        $relativePath = ConvertTo-FenneviaInstallerRelativePath -Path ([string] $file.path) -Code "FENNEVIA_INSTALL_PACKAGE_INVALID"
        Assert-FenneviaInstallerManagedPathApproved -Scope $scope -Path $relativePath -Code "FENNEVIA_INSTALL_PACKAGE_INVALID"
        $hash = ([string] $file.sha256).ToLowerInvariant()
        Assert-FenneviaInstallerHashString -Hash $hash -Code "FENNEVIA_INSTALL_PACKAGE_INVALID"

        $key = "$scope`:$relativePath"
        if (-not $logicalKeys.Add($key)) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_PACKAGE_INVALID" -Message "The package manifest contains duplicate target paths."
        }

        $sourcePath = Join-FenneviaInstallerRootPath -Root $canonicalPackageRoot -RelativePath "$scope/$relativePath"
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_PACKAGE_INVALID" -Message "A package source file is missing."
        }
        Assert-FenneviaInstallerNoReparseAncestor -Path $sourcePath -Code "FENNEVIA_INSTALL_PACKAGE_INVALID"
        if ((Get-FenneviaInstallerSha256 -Path $sourcePath) -cne $hash) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_SOURCE_HASH_MISMATCH" -Message "A package source file does not match its committed SHA-256."
        }

        $files.Add([pscustomobject]@{
            Scope = $scope
            Path = $relativePath
            Sha256 = $hash
            SourcePath = $sourcePath
        })
    }

    foreach ($requiredKey in @(
        "program:$($script:EnabledPreferencePath)",
        "program:$($script:ProgramConfigPath)",
        "profile:chrome/fennevia/chrome.manifest",
        "profile:chrome/fennevia/content/Bootstrap.sys.mjs"
    )) {
        if (-not $logicalKeys.Contains($requiredKey)) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_PACKAGE_INVALID" -Message "The package manifest is missing a required bootstrap artifact."
        }
    }

    $profileInventory = @(
        $files |
            Where-Object { $_.Scope -eq "profile" } |
            ForEach-Object { $_.Path.Substring($script:ProfilePackagePrefix.Length) } |
            Sort-Object
    )
    $sortedExpected = @($expectedFiles | Sort-Object)
    if ($profileInventory.Count -ne $sortedExpected.Count) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_PACKAGE_INVALID" -Message "The artifact inventory does not match the installable profile package."
    }
    for ($index = 0; $index -lt $profileInventory.Count; $index++) {
        if ($profileInventory[$index] -cne $sortedExpected[$index]) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_PACKAGE_INVALID" -Message "The artifact inventory does not match the installable profile package."
        }
    }

    $scannerModule = Join-Path $PSScriptRoot "SecurityChecks.psm1"
    if (-not (Test-Path -LiteralPath $scannerModule -PathType Leaf)) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_ARTIFACT_POLICY" -Message "The trusted privileged-artifact scanner is missing beside the installer module."
    }
    Assert-FenneviaInstallerNoReparseAncestor -Path $scannerModule -Code "FENNEVIA_INSTALL_ARTIFACT_POLICY"
    $scannerModuleInfo = Import-Module $scannerModule -Force -PassThru
    try {
        $artifactRoot = Join-Path $canonicalPackageRoot "profile\chrome\fennevia"
        Assert-FenneviaInstallerTreeHasNoReparsePoints -Path $artifactRoot -Code "FENNEVIA_INSTALL_ARTIFACT_POLICY"
        $artifactResult = Test-FenneviaProductionArtifacts -ArtifactRoot $artifactRoot -InventoryPath $manifestPath
        if (-not $artifactResult.Passed) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_ARTIFACT_POLICY" -Message "The privileged package failed the production-artifact policy."
        }
    }
    finally {
        Remove-Module $scannerModuleInfo -ErrorAction SilentlyContinue
    }

    $releaseManifest = $null
    $releaseManifestPath = Join-Path $canonicalPackageRoot $script:ReleaseManifestName
    if (Test-Path -LiteralPath $releaseManifestPath -PathType Leaf) {
        Assert-FenneviaInstallerNoReparseAncestor -Path $releaseManifestPath -Code "FENNEVIA_INSTALL_RELEASE_INVALID"
        $releaseModule = Join-Path $PSScriptRoot "FenneviaRelease.psm1"
        if (-not (Test-Path -LiteralPath $releaseModule -PathType Leaf)) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_RELEASE_INVALID" -Message "The trusted release validator is missing beside the installer module."
        }
        Assert-FenneviaInstallerNoReparseAncestor -Path $releaseModule -Code "FENNEVIA_INSTALL_RELEASE_INVALID"
        $releaseModuleInfo = Import-Module $releaseModule -Force -PassThru
        try {
            try {
                $releaseValidation = Test-FenneviaReleaseTree -PackageRoot $canonicalPackageRoot
            }
            catch {
                Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_RELEASE_INVALID" -Message "The release tree failed its strict inventory, digest, or sensitive-data policy."
            }
            $releaseManifest = $releaseValidation.Manifest
        }
        finally {
            Remove-Module $releaseModuleInfo -ErrorAction SilentlyContinue
        }
    }

    return [pscustomobject]@{
        Root = $canonicalPackageRoot
        ManifestPath = $manifestPath
        ManifestSha256 = Get-FenneviaInstallerSha256 -Path $manifestPath
        PackageVersion = $packageVersion
        ExpectedFiles = $sortedExpected
        Files = @($files | Sort-Object Scope, Path)
        ReleaseManifest = $releaseManifest
    }
}

function Assert-FenneviaInstallerPackageCompatibility {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets,

        [Parameter(Mandatory)]
        [object] $Package
    )

    if ($null -eq $Package.ReleaseManifest) {
        return $null
    }

    $releaseModule = Join-Path $PSScriptRoot "FenneviaRelease.psm1"
    $releaseModuleInfo = Import-Module $releaseModule -Force -PassThru
    try {
        $compatibility = Get-FenneviaReleaseFirefoxCompatibility `
            -ReleaseManifest $Package.ReleaseManifest `
            -FirefoxVersion $Targets.FirefoxVersion `
            -FirefoxBuildId $Targets.FirefoxBuildID
    }
    finally {
        Remove-Module $releaseModuleInfo -ErrorAction SilentlyContinue
    }
    if (-not [bool] $compatibility.Allowed) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_FIREFOX_UNSUPPORTED" -Message "This release does not support Firefox versions older than the tested baseline. Disable or uninstall remains available for recovery."
    }
    return $compatibility
}

function ConvertTo-FenneviaInstallerOwnershipJson {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $InstallationId,

        [Parameter(Mandatory)]
        [string] $PackageVersion,

        [Parameter(Mandatory)]
        [ValidateSet("enabled", "disabled")]
        [string] $State,

        [Parameter(Mandatory)]
        [string] $SourceManifestSha256,

        [Parameter(Mandatory)]
        [object[]] $Files,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [object[]] $CreatedDirectories
    )

    $orderedFiles = @(
        $Files |
            Sort-Object Scope, Path |
            ForEach-Object {
                [ordered]@{
                    scope = $_.Scope
                    path = $_.Path
                    installedPath = $_.InstalledPath
                    sha256 = $_.Sha256
                }
            }
    )
    $orderedDirectories = @(
        $CreatedDirectories |
            Sort-Object Scope, Path |
            ForEach-Object {
                [ordered]@{
                    scope = $_.Scope
                    path = $_.Path
                }
            }
    )
    $ownership = [ordered]@{
        schemaVersion = $script:OwnershipSchemaVersion
        owner = $script:PackageId
        packageId = $script:PackageId
        installationId = $InstallationId
        packageVersion = $PackageVersion
        state = $State
        sourceManifestSha256 = $SourceManifestSha256
        files = $orderedFiles
        createdDirectories = $orderedDirectories
    }

    return (($ownership | ConvertTo-Json -Depth 8) + [Environment]::NewLine)
}

function ConvertFrom-FenneviaInstallerOwnershipJson {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Content
    )

    try {
        $ownership = $Content | ConvertFrom-Json
    }
    catch {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID" -Message "An installed ownership manifest is not valid JSON."
    }

    Assert-FenneviaInstallerExactProperties -InputObject $ownership -Properties @(
        "schemaVersion", "owner", "packageId", "installationId", "packageVersion",
        "state", "sourceManifestSha256", "files", "createdDirectories"
    ) -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID" -Description "The installed ownership manifest"

    try {
        $schemaVersion = [int] $ownership.schemaVersion
        [void] [guid]::Parse([string] $ownership.installationId)
    }
    catch {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID" -Message "The installed ownership schema or installation ID is invalid."
    }

    if (
        $schemaVersion -ne $script:OwnershipSchemaVersion -or
        [string] $ownership.owner -cne $script:PackageId -or
        [string] $ownership.packageId -cne $script:PackageId
    ) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID" -Message "The installed ownership identity or schema is unsupported."
    }

    $state = [string] $ownership.state
    if ($state -notin @("enabled", "disabled")) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID" -Message "The installed package state is invalid."
    }
    $packageVersion = [string] $ownership.packageVersion
    if ($packageVersion -cnotmatch "^[0-9A-Za-z][0-9A-Za-z.-]{0,63}$") {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID" -Message "The installed package version is invalid."
    }
    $sourceManifestSha256 = ([string] $ownership.sourceManifestSha256).ToLowerInvariant()
    Assert-FenneviaInstallerHashString -Hash $sourceManifestSha256 -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID"

    $files = New-Object "Collections.Generic.List[object]"
    $logicalKeys = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    $installedKeys = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    foreach ($file in @($ownership.files)) {
        Assert-FenneviaInstallerExactProperties -InputObject $file -Properties @("scope", "path", "installedPath", "sha256") -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID" -Description "An installed file record"
        $scope = [string] $file.scope
        if ($scope -notin @("program", "profile")) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID" -Message "An installed file scope is invalid."
        }
        $path = ConvertTo-FenneviaInstallerRelativePath -Path ([string] $file.path) -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID"
        $installedPath = ConvertTo-FenneviaInstallerRelativePath -Path ([string] $file.installedPath) -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID"
        Assert-FenneviaInstallerManagedPathApproved -Scope $scope -Path $path -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID"
        Assert-FenneviaInstallerManagedPathApproved -Scope $scope -Path $installedPath -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID"

        if ($path -ceq $script:EnabledPreferencePath) {
            $expectedInstalledPath = if ($state -eq "disabled") { $script:DisabledPreferencePath } else { $script:EnabledPreferencePath }
            if ($scope -ne "program" -or $installedPath -cne $expectedInstalledPath) {
                Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID" -Message "The safe-start preference path is inconsistent with the installed state."
            }
        }
        elseif ($installedPath -cne $path) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID" -Message "Only the safe-start preference may move for hard disable."
        }

        $hash = ([string] $file.sha256).ToLowerInvariant()
        Assert-FenneviaInstallerHashString -Hash $hash -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID"
        if (-not $logicalKeys.Add("$scope`:$path") -or -not $installedKeys.Add("$scope`:$installedPath")) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID" -Message "The installed ownership manifest contains duplicate paths."
        }

        $files.Add([pscustomobject]@{
            Scope = $scope
            Path = $path
            InstalledPath = $installedPath
            Sha256 = $hash
        })
    }
    if ($files.Count -eq 0) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID" -Message "The installed ownership manifest contains no files."
    }

    $createdDirectories = New-Object "Collections.Generic.List[object]"
    $directoryKeys = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    foreach ($directory in @($ownership.createdDirectories)) {
        Assert-FenneviaInstallerExactProperties -InputObject $directory -Properties @("scope", "path") -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID" -Description "An installed directory record"
        $scope = [string] $directory.scope
        if ($scope -notin @("program", "profile")) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID" -Message "An installed directory scope is invalid."
        }
        $path = ConvertTo-FenneviaInstallerRelativePath -Path ([string] $directory.path) -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID"
        $approved = $scope -eq "profile" -and (
            $path -ceq "chrome" -or
            $path -ceq "chrome/fennevia" -or
            $path.StartsWith("chrome/fennevia/", [StringComparison]::Ordinal)
        )
        if (-not $approved -or -not $directoryKeys.Add("$scope`:$path")) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID" -Message "An installed directory record is outside the approved removable boundary or duplicated."
        }
        $createdDirectories.Add([pscustomobject]@{ Scope = $scope; Path = $path })
    }

    return [pscustomobject]@{
        SchemaVersion = $schemaVersion
        InstallationId = [string] $ownership.installationId
        PackageVersion = $packageVersion
        State = $state
        SourceManifestSha256 = $sourceManifestSha256
        Files = @($files | Sort-Object Scope, Path)
        CreatedDirectories = @($createdDirectories | Sort-Object Scope, Path)
    }
}

function Read-FenneviaInstallerOwnershipSide {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets,

        [Parameter(Mandatory)]
        [ValidateSet("program", "profile")]
        [string] $Scope
    )

    $root = Get-FenneviaInstallerScopeRoot -Targets $Targets -Scope $Scope
    $metadataPath = Join-Path $root $script:MetadataDirectoryName
    $ownershipPath = Get-FenneviaInstallerOwnershipPath -Root $root
    $metadataExists = Test-Path -LiteralPath $metadataPath
    $ownershipExists = Test-Path -LiteralPath $ownershipPath -PathType Leaf

    if (-not $ownershipExists) {
        if (Test-Path -LiteralPath $ownershipPath) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_METADATA_CONFLICT" -Message "A Fennevia ownership path exists but is not a regular file."
        }
        return [pscustomobject]@{
            Scope = $Scope
            Exists = $false
            MetadataExists = $metadataExists
            Data = $null
            Content = ""
            Path = $ownershipPath
        }
    }

    Assert-FenneviaInstallerNoReparseAncestor -Path $ownershipPath
    $content = Get-Content -Raw -LiteralPath $ownershipPath
    return [pscustomobject]@{
        Scope = $Scope
        Exists = $true
        MetadataExists = $true
        Data = ConvertFrom-FenneviaInstallerOwnershipJson -Content $content
        Content = $content
        Path = $ownershipPath
    }
}

function Read-FenneviaInstallerOwnershipState {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets
    )

    $program = Read-FenneviaInstallerOwnershipSide -Targets $Targets -Scope program
    $profile = Read-FenneviaInstallerOwnershipSide -Targets $Targets -Scope profile

    if (-not $program.Exists -and -not $profile.Exists) {
        if ($program.MetadataExists -or $profile.MetadataExists) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_METADATA_CONFLICT" -Message "A Fennevia metadata path exists without an ownership manifest."
        }
        return [pscustomobject]@{
            Kind = "absent"
            Program = $program
            Profile = $profile
            Pair = $null
            Survivor = $null
            MissingScope = ""
        }
    }

    if ($program.Exists -and $profile.Exists) {
        if ($program.Content -cne $profile.Content) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNERSHIP_MISMATCH" -Message "The program and profile ownership manifests do not match."
        }
        $pair = [pscustomobject]@{
            Data = $program.Data
            Content = $program.Content
            ProgramPath = $program.Path
            ProfilePath = $profile.Path
        }
        return [pscustomobject]@{
            Kind = "complete"
            Program = $program
            Profile = $profile
            Pair = $pair
            Survivor = $null
            MissingScope = ""
        }
    }

    $survivor = if ($program.Exists) { $program } else { $profile }
    $missingScope = if ($program.Exists) { "profile" } else { "program" }
    return [pscustomobject]@{
        Kind = "incomplete-$missingScope"
        Program = $program
        Profile = $profile
        Pair = $null
        Survivor = [pscustomobject]@{
            Data = $survivor.Data
            Content = $survivor.Content
            ProgramPath = if ($program.Exists) { $program.Path } else { "" }
            ProfilePath = if ($profile.Exists) { $profile.Path } else { "" }
        }
        MissingScope = $missingScope
    }
}

function Read-FenneviaInstallerOwnershipPair {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets
    )

    $state = Read-FenneviaInstallerOwnershipState -Targets $Targets
    if ($state.Kind -eq "absent") {
        return $null
    }
    if ($state.Kind -ne "complete") {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNERSHIP_INCOMPLETE" -Message "The program and profile ownership manifests are incomplete. Preview the explicit Repair action before any further package mutation."
    }
    return $state.Pair
}

function Assert-FenneviaInstallerProfileProof {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets,

        [AllowNull()]
        [object] $OwnershipPair
    )

    if ($Targets.ProfileMode -eq "Development") {
        if (-not $Targets.HasDevelopmentMarker -and $null -eq $OwnershipPair) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_UNMARKED_PROFILE" -Message "The selected profile is not a marker-owned Fennevia development profile and has no valid installed ownership pair."
        }
        return
    }

    if (-not $Targets.IsRegisteredProfile -and $null -eq $OwnershipPair) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_UNREGISTERED_PROFILE" -Message "Registered mode requires the explicit profile path to match Firefox registration or an existing valid Fennevia ownership pair."
    }
}

function Get-FenneviaInstallerFileMap {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object[]] $Files,

        [switch] $UseInstalledPath
    )

    $map = @{}
    foreach ($file in $Files) {
        $path = if ($UseInstalledPath) { $file.InstalledPath } else { $file.Path }
        $map["$($file.Scope):$path".ToLowerInvariant()] = $file
    }
    return $map
}

function Test-FenneviaInstallerOwnedFileExists {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets,

        [Parameter(Mandatory)]
        [object] $File,

        [switch] $AllowMissing
    )

    $root = Get-FenneviaInstallerScopeRoot -Targets $Targets -Scope $File.Scope
    $path = Join-FenneviaInstallerRootPath -Root $root -RelativePath $File.InstalledPath
    Assert-FenneviaInstallerNoReparseAncestor -Path $path
    if (-not (Test-Path -LiteralPath $path)) {
        if ($AllowMissing) {
            return $false
        }
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNED_FILE_MISSING" -Message "An ownership-listed installed file is missing."
    }
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNERSHIP_CONFLICT" -Message "An ownership-listed file path is not a regular file."
    }
    if ((Get-FenneviaInstallerSha256 -Path $path) -cne $File.Sha256) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNED_FILE_MODIFIED" -Message "An ownership-listed installed file has an unexplained hash mismatch."
    }
    return $true
}

function Assert-FenneviaInstallerOwnedFiles {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets,

        [Parameter(Mandatory)]
        [object] $Ownership,

        [switch] $AllowMissing
    )

    $existence = @{}
    foreach ($file in $Ownership.Files) {
        $key = "$($file.Scope):$($file.Path)".ToLowerInvariant()
        $existence[$key] = Test-FenneviaInstallerOwnedFileExists -Targets $Targets -File $file -AllowMissing:$AllowMissing
    }
    return $existence
}

function Assert-FenneviaInstallerOwnedFilesForScope {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets,

        [Parameter(Mandatory)]
        [object] $Ownership,

        [Parameter(Mandatory)]
        [ValidateSet("program", "profile")]
        [string] $Scope
    )

    $files = @($Ownership.Files | Where-Object { $_.Scope -eq $Scope })
    if ($files.Count -eq 0) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID" -Message "The surviving ownership manifest has no files for one required scope."
    }
    foreach ($file in $files) {
        [void] (Test-FenneviaInstallerOwnedFileExists -Targets $Targets -File $file)
    }
}

function Assert-FenneviaInstallerNoForeignAutoConfig {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets,

        [AllowNull()]
        [object] $OwnershipPair
    )

    $ownedPreferencePath = $null
    if ($null -ne $OwnershipPair) {
        $preferenceRecord = @($OwnershipPair.Data.Files | Where-Object { $_.Scope -eq "program" -and $_.Path -eq $script:EnabledPreferencePath })
        if ($preferenceRecord.Count -eq 1 -and $preferenceRecord[0].InstalledPath -eq $script:EnabledPreferencePath) {
            $ownedPreferencePath = Join-FenneviaInstallerRootPath -Root $Targets.ProgramRoot -RelativePath $script:EnabledPreferencePath
        }
    }

    $preferenceRoot = Join-Path $Targets.ProgramRoot "defaults\pref"
    foreach ($preferenceFile in @(Get-ChildItem -LiteralPath $preferenceRoot -Filter "*.js" -File)) {
        if ($null -ne $ownedPreferencePath -and [string]::Equals($preferenceFile.FullName, $ownedPreferencePath, [StringComparison]::OrdinalIgnoreCase)) {
            continue
        }
        $content = Get-Content -Raw -LiteralPath $preferenceFile.FullName
        if ($content -match 'general\.config\.filename') {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_AUTOCONFIG_CONFLICT" -Message "Another AutoConfig declaration exists in the selected Firefox program."
        }
    }
}

function Test-FenneviaInstallerSelectedFirefoxRunning {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets
    )

    $processes = @(Get-Process -Name firefox -ErrorAction SilentlyContinue)
    if ($processes.Count -eq 0) {
        return $false
    }

    try {
        $details = @(Get-CimInstance Win32_Process -Filter "Name = 'firefox.exe'")
    }
    catch {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_FIREFOX_RUNNING" -Message "Firefox is running and selected-target process identity could not be inspected safely."
    }

    foreach ($process in $details) {
        if (
            (-not [string]::IsNullOrWhiteSpace([string] $process.ExecutablePath) -and [string]::Equals([string] $process.ExecutablePath, $Targets.FirefoxPath, [StringComparison]::OrdinalIgnoreCase)) -or
            (-not [string]::IsNullOrWhiteSpace([string] $process.CommandLine) -and ([string] $process.CommandLine).IndexOf($Targets.ProfileRoot, [StringComparison]::OrdinalIgnoreCase) -ge 0)
        ) {
            return $true
        }
    }

    return $false
}

function Assert-FenneviaInstallerSelectedFirefoxClosed {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets
    )

    if (Test-FenneviaInstallerSelectedFirefoxRunning -Targets $Targets) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_FIREFOX_RUNNING" -Message "Close the selected Firefox program and profile before applying package changes."
    }
}

function Test-FenneviaInstallerProgramWritable {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $ProgramRoot
    )

    $probePath = Join-Path $ProgramRoot (".fennevia-write-probe-" + [guid]::NewGuid().ToString("N"))
    try {
        $stream = [IO.File]::Open($probePath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        $stream.Dispose()
        return $true
    }
    catch {
        return $false
    }
    finally {
        if (Test-Path -LiteralPath $probePath) {
            Remove-Item -LiteralPath $probePath -Force -ErrorAction SilentlyContinue
        }
    }
}

function Test-FenneviaInstallerInterruptedTransaction {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets
    )

    foreach ($scope in @("program", "profile")) {
        $root = Get-FenneviaInstallerScopeRoot -Targets $Targets -Scope $scope
        if (-not (Test-Path -LiteralPath $root -PathType Container)) {
            continue
        }
        foreach ($entry in @(Get-ChildItem -Force -LiteralPath $root)) {
            if ($entry.Name.StartsWith(".fennevia-transaction-", [StringComparison]::OrdinalIgnoreCase)) {
                return $true
            }
        }
    }
    return $false
}

function New-FenneviaInstallerOperation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateSet("CreateDirectory", "CreateFile", "ReplaceFile", "RemoveFile", "MoveFile", "RemoveDirectoryIfEmpty")]
        [string] $Kind,

        [Parameter(Mandatory)]
        [ValidateSet("program", "profile")]
        [string] $Scope,

        [Parameter(Mandatory)]
        [string] $Path,

        [string] $DestinationPath = "",

        [string] $SourcePath = "",

        [AllowEmptyString()]
        [string] $Content = "",

        [string] $ExpectedHash = "",

        [string] $ExistingHash = "",

        [switch] $ExistingOwned
    )

    return [pscustomobject]@{
        Kind = $Kind
        Scope = $Scope
        Path = $Path
        DestinationPath = $DestinationPath
        SourcePath = $SourcePath
        Content = $Content
        ExpectedHash = $ExpectedHash
        ExistingHash = $ExistingHash
        ExistingOwned = [bool] $ExistingOwned
        StagePath = ""
    }
}

function Get-FenneviaInstallerRequiredDirectories {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets,

        [Parameter(Mandatory)]
        [object[]] $Files
    )

    $required = New-Object "Collections.Generic.List[object]"
    $keys = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    foreach ($file in $Files) {
        $root = Get-FenneviaInstallerScopeRoot -Targets $Targets -Scope $file.Scope
        $relativeParent = [IO.Path]::GetDirectoryName((ConvertTo-FenneviaInstallerNativeRelativePath -Path $file.InstalledPath))
        while (-not [string]::IsNullOrWhiteSpace($relativeParent)) {
            $relativePath = $relativeParent.Replace("\", "/")
            $key = "$($file.Scope):$relativePath"
            if ($keys.Add($key)) {
                $fullPath = Join-FenneviaInstallerRootPath -Root $root -RelativePath $relativePath
                Assert-FenneviaInstallerNoReparseAncestor -Path $fullPath
                if (-not (Test-Path -LiteralPath $fullPath)) {
                    $required.Add([pscustomobject]@{ Scope = $file.Scope; Path = $relativePath })
                }
                elseif (-not (Test-Path -LiteralPath $fullPath -PathType Container)) {
                    Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_FILE_CONFLICT" -Message "A required package directory path is occupied by a file."
                }
            }
            $relativeParent = [IO.Path]::GetDirectoryName($relativeParent)
        }
    }

    return @(
        $required |
            Sort-Object @{ Expression = { ($_.Path -split "/").Count } }, Scope, Path
    )
}

function New-FenneviaInstallerDesiredFiles {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Package,

        [Parameter(Mandatory)]
        [ValidateSet("enabled", "disabled")]
        [string] $State
    )

    return @(
        $Package.Files |
            ForEach-Object {
                $installedPath = $_.Path
                if ($_.Scope -eq "program" -and $_.Path -eq $script:EnabledPreferencePath -and $State -eq "disabled") {
                    $installedPath = $script:DisabledPreferencePath
                }
                [pscustomobject]@{
                    Scope = $_.Scope
                    Path = $_.Path
                    InstalledPath = $installedPath
                    Sha256 = $_.Sha256
                    SourcePath = $_.SourcePath
                }
            } |
            Sort-Object Scope, Path
    )
}

function Get-FenneviaInstallerStringSha256 {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [AllowEmptyString()]
        [string] $Content
    )

    $encoding = New-Object Text.UTF8Encoding($false)
    $bytes = $encoding.GetBytes($Content)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try {
        return (($algorithm.ComputeHash($bytes) | ForEach-Object { $_.ToString("x2") }) -join "")
    }
    finally {
        $algorithm.Dispose()
    }
}

function Merge-FenneviaInstallerCreatedDirectories {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [object[]] $Existing,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [object[]] $Additional
    )

    $result = New-Object "Collections.Generic.List[object]"
    $keys = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    foreach ($directory in @($Existing) + @($Additional)) {
        if ($directory.Scope -ne "profile") {
            continue
        }
        $key = "$($directory.Scope):$($directory.Path)"
        if ($keys.Add($key)) {
            $result.Add([pscustomobject]@{ Scope = $directory.Scope; Path = $directory.Path })
        }
    }
    return @($result | Sort-Object Scope, Path)
}

function Add-FenneviaInstallerMetadataDirectoryOperations {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [Collections.Generic.List[object]] $Operations
    )

    foreach ($scope in @("program", "profile")) {
        $root = Get-FenneviaInstallerScopeRoot -Targets $Targets -Scope $scope
        $metadataRoot = Join-Path $root $script:MetadataDirectoryName
        if (-not (Test-Path -LiteralPath $metadataRoot)) {
            $Operations.Add((New-FenneviaInstallerOperation -Kind CreateDirectory -Scope $scope -Path $script:MetadataDirectoryName))
        }
        elseif (-not (Test-Path -LiteralPath $metadataRoot -PathType Container)) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_METADATA_CONFLICT" -Message "A Fennevia metadata directory path is occupied by a file."
        }
    }
}

function Add-FenneviaInstallerMetadataDirectoryOperation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [Collections.Generic.List[object]] $Operations,

        [Parameter(Mandatory)]
        [ValidateSet("program", "profile")]
        [string] $Scope
    )

    $root = Get-FenneviaInstallerScopeRoot -Targets $Targets -Scope $Scope
    $metadataRoot = Join-Path $root $script:MetadataDirectoryName
    if (Test-Path -LiteralPath $metadataRoot) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_METADATA_CONFLICT" -Message "Repair requires the missing ownership side to have no metadata residue."
    }
    $Operations.Add((New-FenneviaInstallerOperation -Kind CreateDirectory -Scope $Scope -Path $script:MetadataDirectoryName))
}

function New-FenneviaInstallerInternalPlan {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Action,

        [Parameter(Mandatory)]
        [object] $Targets,

        [AllowNull()]
        [object] $Package,

        [AllowNull()]
        [object] $OwnershipPair,

        [Parameter(Mandatory)]
        [string] $Status,

        [Parameter(Mandatory)]
        [string] $State,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [object[]] $Operations
    )

    $packageVersion = if ($null -ne $Package) {
        $Package.PackageVersion
    }
    elseif ($null -ne $OwnershipPair) {
        $OwnershipPair.Data.PackageVersion
    }
    else {
        "not-installed"
    }

    return [pscustomobject]@{
        Action = $Action
        Targets = $Targets
        Package = $Package
        OwnershipPair = $OwnershipPair
        Status = $Status
        State = $State
        PackageVersion = $packageVersion
        Operations = @($Operations)
    }
}

function Add-FenneviaInstallerPlanCompatibility {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Plan,

        [AllowNull()]
        [object] $Compatibility
    )

    if ($null -ne $Compatibility) {
        Add-Member -InputObject $Plan -NotePropertyName Compatibility -NotePropertyValue $Compatibility -Force
    }
    return $Plan
}

function Assert-FenneviaInstallerTargetPathAvailable {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets,

        [Parameter(Mandatory)]
        [ValidateSet("program", "profile")]
        [string] $Scope,

        [Parameter(Mandatory)]
        [string] $Path
    )

    $root = Get-FenneviaInstallerScopeRoot -Targets $Targets -Scope $Scope
    $targetPath = Join-FenneviaInstallerRootPath -Root $root -RelativePath $Path
    Assert-FenneviaInstallerNoReparseAncestor -Path $targetPath
    if (Test-Path -LiteralPath $targetPath) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_FILE_CONFLICT" -Message "A package target is already occupied by content not proven by the ownership manifest."
    }
}

function New-FenneviaInstallerInstallPlan {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets,

        [Parameter(Mandatory)]
        [object] $Package,

        [AllowNull()]
        [object] $OwnershipPair
    )

    if ($null -ne $OwnershipPair) {
        [void] (Assert-FenneviaInstallerOwnedFiles -Targets $Targets -Ownership $OwnershipPair.Data)
        $desiredFiles = New-FenneviaInstallerDesiredFiles -Package $Package -State $OwnershipPair.Data.State
        $desiredContent = ConvertTo-FenneviaInstallerOwnershipJson `
            -InstallationId $OwnershipPair.Data.InstallationId `
            -PackageVersion $Package.PackageVersion `
            -State $OwnershipPair.Data.State `
            -SourceManifestSha256 $Package.ManifestSha256 `
            -Files $desiredFiles `
            -CreatedDirectories $OwnershipPair.Data.CreatedDirectories
        if ($desiredContent -cne $OwnershipPair.Content) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_REQUIRES_UPDATE" -Message "A different Fennevia package is already installed; use the Update action."
        }
        return New-FenneviaInstallerInternalPlan -Action Install -Targets $Targets -Package $Package -OwnershipPair $OwnershipPair -Status "already-installed" -State $OwnershipPair.Data.State -Operations @()
    }

    Assert-FenneviaInstallerNoForeignAutoConfig -Targets $Targets -OwnershipPair $null
    $desiredFiles = New-FenneviaInstallerDesiredFiles -Package $Package -State enabled
    foreach ($file in $desiredFiles) {
        Assert-FenneviaInstallerTargetPathAvailable -Targets $Targets -Scope $file.Scope -Path $file.InstalledPath
    }
    Assert-FenneviaInstallerTargetPathAvailable -Targets $Targets -Scope program -Path $script:DisabledPreferencePath

    $requiredDirectories = @(Get-FenneviaInstallerRequiredDirectories -Targets $Targets -Files $desiredFiles)
    $createdDirectories = @(Merge-FenneviaInstallerCreatedDirectories -Existing @() -Additional $requiredDirectories)
    $installationId = [guid]::NewGuid().ToString("D")
    $ownershipContent = ConvertTo-FenneviaInstallerOwnershipJson `
        -InstallationId $installationId `
        -PackageVersion $Package.PackageVersion `
        -State enabled `
        -SourceManifestSha256 $Package.ManifestSha256 `
        -Files $desiredFiles `
        -CreatedDirectories $createdDirectories
    $ownershipHash = Get-FenneviaInstallerStringSha256 -Content $ownershipContent

    $operations = New-Object "Collections.Generic.List[object]"
    foreach ($directory in $requiredDirectories) {
        $operations.Add((New-FenneviaInstallerOperation -Kind CreateDirectory -Scope $directory.Scope -Path $directory.Path))
    }
    Add-FenneviaInstallerMetadataDirectoryOperations -Targets $Targets -Operations $operations
    foreach ($file in $desiredFiles) {
        $operations.Add((New-FenneviaInstallerOperation -Kind CreateFile -Scope $file.Scope -Path $file.InstalledPath -SourcePath $file.SourcePath -ExpectedHash $file.Sha256))
    }
    foreach ($scope in @("program", "profile")) {
        $operations.Add((New-FenneviaInstallerOperation -Kind CreateFile -Scope $scope -Path "$($script:MetadataDirectoryName)/$($script:OwnershipFileName)" -Content $ownershipContent -ExpectedHash $ownershipHash))
    }

    return New-FenneviaInstallerInternalPlan -Action Install -Targets $Targets -Package $Package -OwnershipPair $null -Status "ready" -State enabled -Operations $operations.ToArray()
}

function New-FenneviaInstallerUpdatePlan {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets,

        [Parameter(Mandatory)]
        [object] $Package,

        [Parameter(Mandatory)]
        [object] $OwnershipPair
    )

    if ($OwnershipPair.Data.State -eq "enabled") {
        Assert-FenneviaInstallerNoForeignAutoConfig -Targets $Targets -OwnershipPair $OwnershipPair
    }
    $existence = Assert-FenneviaInstallerOwnedFiles -Targets $Targets -Ownership $OwnershipPair.Data -AllowMissing
    $desiredFiles = New-FenneviaInstallerDesiredFiles -Package $Package -State $OwnershipPair.Data.State
    $oldLogicalMap = Get-FenneviaInstallerFileMap -Files $OwnershipPair.Data.Files
    $desiredLogicalMap = Get-FenneviaInstallerFileMap -Files $desiredFiles
    $requiredDirectories = @(Get-FenneviaInstallerRequiredDirectories -Targets $Targets -Files $desiredFiles)
    $createdDirectories = @(Merge-FenneviaInstallerCreatedDirectories -Existing $OwnershipPair.Data.CreatedDirectories -Additional $requiredDirectories)

    $operations = New-Object "Collections.Generic.List[object]"
    foreach ($directory in $requiredDirectories) {
        $operations.Add((New-FenneviaInstallerOperation -Kind CreateDirectory -Scope $directory.Scope -Path $directory.Path))
    }

    foreach ($oldFile in $OwnershipPair.Data.Files) {
        $logicalKey = "$($oldFile.Scope):$($oldFile.Path)".ToLowerInvariant()
        if (-not $desiredLogicalMap.ContainsKey($logicalKey) -and $existence[$logicalKey]) {
            $operations.Add((New-FenneviaInstallerOperation -Kind RemoveFile -Scope $oldFile.Scope -Path $oldFile.InstalledPath -ExpectedHash $oldFile.Sha256 -ExistingOwned))
        }
    }

    foreach ($desiredFile in $desiredFiles) {
        $logicalKey = "$($desiredFile.Scope):$($desiredFile.Path)".ToLowerInvariant()
        if (-not $oldLogicalMap.ContainsKey($logicalKey)) {
            Assert-FenneviaInstallerTargetPathAvailable -Targets $Targets -Scope $desiredFile.Scope -Path $desiredFile.InstalledPath
            $operations.Add((New-FenneviaInstallerOperation -Kind CreateFile -Scope $desiredFile.Scope -Path $desiredFile.InstalledPath -SourcePath $desiredFile.SourcePath -ExpectedHash $desiredFile.Sha256))
            continue
        }

        $oldFile = $oldLogicalMap[$logicalKey]
        if ($oldFile.InstalledPath -cne $desiredFile.InstalledPath) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_STATE_CONFLICT" -Message "The installed file location is inconsistent with the preserved package state."
        }
        if (-not $existence[$logicalKey]) {
            $operations.Add((New-FenneviaInstallerOperation -Kind CreateFile -Scope $desiredFile.Scope -Path $desiredFile.InstalledPath -SourcePath $desiredFile.SourcePath -ExpectedHash $desiredFile.Sha256))
        }
        elseif ($oldFile.Sha256 -cne $desiredFile.Sha256) {
            $operations.Add((New-FenneviaInstallerOperation -Kind ReplaceFile -Scope $desiredFile.Scope -Path $desiredFile.InstalledPath -SourcePath $desiredFile.SourcePath -ExpectedHash $desiredFile.Sha256 -ExistingHash $oldFile.Sha256 -ExistingOwned))
        }
    }

    $ownershipContent = ConvertTo-FenneviaInstallerOwnershipJson `
        -InstallationId $OwnershipPair.Data.InstallationId `
        -PackageVersion $Package.PackageVersion `
        -State $OwnershipPair.Data.State `
        -SourceManifestSha256 $Package.ManifestSha256 `
        -Files $desiredFiles `
        -CreatedDirectories $createdDirectories
    if ($ownershipContent -cne $OwnershipPair.Content) {
        $ownershipHash = Get-FenneviaInstallerStringSha256 -Content $ownershipContent
        $existingOwnershipHash = Get-FenneviaInstallerStringSha256 -Content $OwnershipPair.Content
        foreach ($scope in @("program", "profile")) {
            $operations.Add((New-FenneviaInstallerOperation -Kind ReplaceFile -Scope $scope -Path "$($script:MetadataDirectoryName)/$($script:OwnershipFileName)" -Content $ownershipContent -ExpectedHash $ownershipHash -ExistingHash $existingOwnershipHash -ExistingOwned))
        }
    }

    $status = if ($operations.Count -eq 0) { "already-current" } else { "ready" }
    return New-FenneviaInstallerInternalPlan -Action Update -Targets $Targets -Package $Package -OwnershipPair $OwnershipPair -Status $status -State $OwnershipPair.Data.State -Operations $operations.ToArray()
}

function New-FenneviaInstallerRepairPlan {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets,

        [Parameter(Mandatory)]
        [object] $Package,

        [Parameter(Mandatory)]
        [object] $OwnershipState
    )

    if ($OwnershipState.Kind -eq "absent") {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_NOT_INSTALLED" -Message "Repair requires one valid surviving ownership manifest; use Install when both ownership sides are absent."
    }

    if ($OwnershipState.Kind -eq "complete") {
        [void] (Assert-FenneviaInstallerOwnedFiles -Targets $Targets -Ownership $OwnershipState.Pair.Data)
        return New-FenneviaInstallerInternalPlan -Action Repair -Targets $Targets -Package $Package -OwnershipPair $OwnershipState.Pair -Status "already-complete" -State $OwnershipState.Pair.Data.State -Operations @()
    }

    if ($Targets.ProfileMode -eq "Development" -and -not $Targets.HasDevelopmentMarker) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_UNMARKED_PROFILE" -Message "Repair is limited to the explicitly marker-owned Fennevia development profile."
    }

    $survivor = $OwnershipState.Survivor
    $missingScope = $OwnershipState.MissingScope
    $survivingScope = if ($missingScope -eq "program") { "profile" } else { "program" }
    $missingSide = if ($missingScope -eq "program") { $OwnershipState.Program } else { $OwnershipState.Profile }
    if ($missingSide.MetadataExists) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_METADATA_CONFLICT" -Message "Repair requires the missing ownership side to have no metadata residue."
    }

    Assert-FenneviaInstallerOwnedFilesForScope -Targets $Targets -Ownership $survivor.Data -Scope $survivingScope

    $desiredFiles = New-FenneviaInstallerDesiredFiles -Package $Package -State $survivor.Data.State
    $desiredOwnershipContent = ConvertTo-FenneviaInstallerOwnershipJson `
        -InstallationId $survivor.Data.InstallationId `
        -PackageVersion $Package.PackageVersion `
        -State $survivor.Data.State `
        -SourceManifestSha256 $Package.ManifestSha256 `
        -Files $desiredFiles `
        -CreatedDirectories $survivor.Data.CreatedDirectories
    if ($desiredOwnershipContent -cne $survivor.Content) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_REPAIR_SOURCE_MISMATCH" -Message "The current package source does not exactly match the surviving ownership manifest. Restore that exact source or perform a clean reviewed reinstall instead of reconstructing ownership."
    }

    $missingFiles = @($desiredFiles | Where-Object { $_.Scope -eq $missingScope })
    if ($missingFiles.Count -eq 0) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID" -Message "The surviving ownership manifest has no files for the missing required scope."
    }
    foreach ($file in $missingFiles) {
        $root = Get-FenneviaInstallerScopeRoot -Targets $Targets -Scope $missingScope
        $targetPath = Join-FenneviaInstallerRootPath -Root $root -RelativePath $file.InstalledPath
        Assert-FenneviaInstallerNoReparseAncestor -Path $targetPath
        if (Test-Path -LiteralPath $targetPath) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_REPAIR_RESIDUE" -Message "Repair refuses a partially retained owned-file set on the missing ownership side."
        }
    }

    if ($missingScope -eq "program") {
        $alternatePreferencePath = if ($survivor.Data.State -eq "disabled") { $script:EnabledPreferencePath } else { $script:DisabledPreferencePath }
        $alternatePreference = Join-FenneviaInstallerRootPath -Root $Targets.ProgramRoot -RelativePath $alternatePreferencePath
        Assert-FenneviaInstallerNoReparseAncestor -Path $alternatePreference
        if (Test-Path -LiteralPath $alternatePreference) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_REPAIR_RESIDUE" -Message "Repair refuses an unexplained alternate AutoConfig preference on the missing ownership side."
        }
        if ($survivor.Data.State -eq "enabled") {
            Assert-FenneviaInstallerNoForeignAutoConfig -Targets $Targets -OwnershipPair $null
        }
    }
    else {
        $profilePackageRoot = Join-FenneviaInstallerRootPath -Root $Targets.ProfileRoot -RelativePath "chrome/fennevia"
        if (Test-Path -LiteralPath $profilePackageRoot) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_REPAIR_RESIDUE" -Message "Repair refuses a partially retained profile package without its ownership side."
        }
    }

    $requiredDirectories = @(Get-FenneviaInstallerRequiredDirectories -Targets $Targets -Files $missingFiles)
    $createdDirectoryKeys = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    foreach ($directory in $survivor.Data.CreatedDirectories) {
        [void] $createdDirectoryKeys.Add("$($directory.Scope):$($directory.Path)")
    }
    foreach ($directory in $requiredDirectories) {
        if (-not $createdDirectoryKeys.Contains("$($directory.Scope):$($directory.Path)")) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_REPAIR_DIRECTORY_STATE" -Message "Repair would need to create a directory that the surviving ownership manifest does not prove was project-created."
        }
    }

    $operations = New-Object "Collections.Generic.List[object]"
    foreach ($directory in $requiredDirectories) {
        $operations.Add((New-FenneviaInstallerOperation -Kind CreateDirectory -Scope $directory.Scope -Path $directory.Path))
    }
    Add-FenneviaInstallerMetadataDirectoryOperation -Targets $Targets -Operations $operations -Scope $missingScope
    foreach ($file in $missingFiles) {
        $operations.Add((New-FenneviaInstallerOperation -Kind CreateFile -Scope $file.Scope -Path $file.InstalledPath -SourcePath $file.SourcePath -ExpectedHash $file.Sha256))
    }
    $ownershipHash = Get-FenneviaInstallerStringSha256 -Content $survivor.Content
    $operations.Add((New-FenneviaInstallerOperation -Kind CreateFile -Scope $missingScope -Path "$($script:MetadataDirectoryName)/$($script:OwnershipFileName)" -Content $survivor.Content -ExpectedHash $ownershipHash))

    return New-FenneviaInstallerInternalPlan -Action Repair -Targets $Targets -Package $Package -OwnershipPair $survivor -Status "repairable-$missingScope" -State $survivor.Data.State -Operations $operations.ToArray()
}

function New-FenneviaInstallerDisablePlan {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets,

        [Parameter(Mandatory)]
        [object] $OwnershipPair
    )

    if ($OwnershipPair.Data.State -eq "disabled") {
        return New-FenneviaInstallerInternalPlan -Action Disable -Targets $Targets -Package $null -OwnershipPair $OwnershipPair -Status "already-disabled" -State disabled -Operations @()
    }

    $preferenceRecords = @($OwnershipPair.Data.Files | Where-Object { $_.Scope -eq "program" -and $_.Path -eq $script:EnabledPreferencePath })
    if ($preferenceRecords.Count -ne 1) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNERSHIP_INVALID" -Message "The ownership manifest does not contain exactly one hard-disable preference."
    }
    $preferenceRecord = $preferenceRecords[0]
    $preferenceExists = Test-FenneviaInstallerOwnedFileExists -Targets $Targets -File $preferenceRecord -AllowMissing
    Assert-FenneviaInstallerTargetPathAvailable -Targets $Targets -Scope program -Path $script:DisabledPreferencePath

    $newFiles = @(
        $OwnershipPair.Data.Files |
            ForEach-Object {
                [pscustomobject]@{
                    Scope = $_.Scope
                    Path = $_.Path
                    InstalledPath = if ($_.Scope -eq "program" -and $_.Path -eq $script:EnabledPreferencePath) { $script:DisabledPreferencePath } else { $_.InstalledPath }
                    Sha256 = $_.Sha256
                }
            }
    )
    $ownershipContent = ConvertTo-FenneviaInstallerOwnershipJson `
        -InstallationId $OwnershipPair.Data.InstallationId `
        -PackageVersion $OwnershipPair.Data.PackageVersion `
        -State disabled `
        -SourceManifestSha256 $OwnershipPair.Data.SourceManifestSha256 `
        -Files $newFiles `
        -CreatedDirectories $OwnershipPair.Data.CreatedDirectories
    $ownershipHash = Get-FenneviaInstallerStringSha256 -Content $ownershipContent
    $existingOwnershipHash = Get-FenneviaInstallerStringSha256 -Content $OwnershipPair.Content
    $operations = New-Object "Collections.Generic.List[object]"
    if ($preferenceExists) {
        $operations.Add((New-FenneviaInstallerOperation -Kind MoveFile -Scope program -Path $script:EnabledPreferencePath -DestinationPath $script:DisabledPreferencePath -ExpectedHash $preferenceRecord.Sha256 -ExistingOwned))
    }
    foreach ($scope in @("program", "profile")) {
        $operations.Add((New-FenneviaInstallerOperation -Kind ReplaceFile -Scope $scope -Path "$($script:MetadataDirectoryName)/$($script:OwnershipFileName)" -Content $ownershipContent -ExpectedHash $ownershipHash -ExistingHash $existingOwnershipHash -ExistingOwned))
    }

    return New-FenneviaInstallerInternalPlan -Action Disable -Targets $Targets -Package $null -OwnershipPair $OwnershipPair -Status "ready" -State disabled -Operations $operations.ToArray()
}

function New-FenneviaInstallerEnablePlan {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets,

        [Parameter(Mandatory)]
        [object] $OwnershipPair,

        [Parameter(Mandatory)]
        [object] $Package
    )

    if ($OwnershipPair.Data.State -eq "enabled") {
        return New-FenneviaInstallerInternalPlan -Action Enable -Targets $Targets -Package $Package -OwnershipPair $OwnershipPair -Status "already-enabled" -State enabled -Operations @()
    }

    [void] (Assert-FenneviaInstallerOwnedFiles -Targets $Targets -Ownership $OwnershipPair.Data)
    Assert-FenneviaInstallerNoForeignAutoConfig -Targets $Targets -OwnershipPair $OwnershipPair
    Assert-FenneviaInstallerTargetPathAvailable -Targets $Targets -Scope program -Path $script:EnabledPreferencePath
    $preferenceRecord = @($OwnershipPair.Data.Files | Where-Object { $_.Scope -eq "program" -and $_.Path -eq $script:EnabledPreferencePath })[0]

    $newFiles = @(
        $OwnershipPair.Data.Files |
            ForEach-Object {
                [pscustomobject]@{
                    Scope = $_.Scope
                    Path = $_.Path
                    InstalledPath = if ($_.Scope -eq "program" -and $_.Path -eq $script:EnabledPreferencePath) { $script:EnabledPreferencePath } else { $_.InstalledPath }
                    Sha256 = $_.Sha256
                }
            }
    )
    $ownershipContent = ConvertTo-FenneviaInstallerOwnershipJson `
        -InstallationId $OwnershipPair.Data.InstallationId `
        -PackageVersion $OwnershipPair.Data.PackageVersion `
        -State enabled `
        -SourceManifestSha256 $OwnershipPair.Data.SourceManifestSha256 `
        -Files $newFiles `
        -CreatedDirectories $OwnershipPair.Data.CreatedDirectories
    $ownershipHash = Get-FenneviaInstallerStringSha256 -Content $ownershipContent
    $existingOwnershipHash = Get-FenneviaInstallerStringSha256 -Content $OwnershipPair.Content
    $operations = New-Object "Collections.Generic.List[object]"
    $operations.Add((New-FenneviaInstallerOperation -Kind MoveFile -Scope program -Path $script:DisabledPreferencePath -DestinationPath $script:EnabledPreferencePath -ExpectedHash $preferenceRecord.Sha256 -ExistingOwned))
    foreach ($scope in @("program", "profile")) {
        $operations.Add((New-FenneviaInstallerOperation -Kind ReplaceFile -Scope $scope -Path "$($script:MetadataDirectoryName)/$($script:OwnershipFileName)" -Content $ownershipContent -ExpectedHash $ownershipHash -ExistingHash $existingOwnershipHash -ExistingOwned))
    }

    return New-FenneviaInstallerInternalPlan -Action Enable -Targets $Targets -Package $Package -OwnershipPair $OwnershipPair -Status "ready" -State enabled -Operations $operations.ToArray()
}

function New-FenneviaInstallerUninstallPlan {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets,

        [AllowNull()]
        [object] $OwnershipPair
    )

    if ($null -eq $OwnershipPair) {
        $knownPaths = @(
            [pscustomobject]@{ Scope = "program"; Path = $script:EnabledPreferencePath },
            [pscustomobject]@{ Scope = "program"; Path = $script:DisabledPreferencePath },
            [pscustomobject]@{ Scope = "program"; Path = $script:ProgramConfigPath },
            [pscustomobject]@{ Scope = "profile"; Path = "chrome/fennevia" }
        )
        foreach ($knownPath in $knownPaths) {
            $root = Get-FenneviaInstallerScopeRoot -Targets $Targets -Scope $knownPath.Scope
            $path = Join-FenneviaInstallerRootPath -Root $root -RelativePath $knownPath.Path
            if (Test-Path -LiteralPath $path) {
                Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_UNOWNED_RESIDUE" -Message "Fennevia-named installed content exists without a valid ownership pair."
            }
        }
        return New-FenneviaInstallerInternalPlan -Action Uninstall -Targets $Targets -Package $null -OwnershipPair $null -Status "not-installed" -State absent -Operations @()
    }

    $existence = Assert-FenneviaInstallerOwnedFiles -Targets $Targets -Ownership $OwnershipPair.Data -AllowMissing
    $operations = New-Object "Collections.Generic.List[object]"
    foreach ($file in $OwnershipPair.Data.Files) {
        $key = "$($file.Scope):$($file.Path)".ToLowerInvariant()
        if ($existence[$key]) {
            $operations.Add((New-FenneviaInstallerOperation -Kind RemoveFile -Scope $file.Scope -Path $file.InstalledPath -ExpectedHash $file.Sha256 -ExistingOwned))
        }
    }
    foreach ($scope in @("program", "profile")) {
        $ownershipPath = Get-FenneviaInstallerOwnershipPath -Root (Get-FenneviaInstallerScopeRoot -Targets $Targets -Scope $scope)
        if (-not (Test-Path -LiteralPath $ownershipPath)) {
            continue
        }
        if (-not (Test-Path -LiteralPath $ownershipPath -PathType Leaf)) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_METADATA_CONFLICT" -Message "A Fennevia ownership path exists but is not a regular file."
        }
        $ownershipContent = Get-Content -Raw -LiteralPath $ownershipPath
        if ($ownershipContent -cne $OwnershipPair.Content) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNERSHIP_MISMATCH" -Message "An ownership manifest changed after target validation."
        }
        $ownershipHash = Get-FenneviaInstallerSha256 -Path $ownershipPath
        $operations.Add((New-FenneviaInstallerOperation -Kind RemoveFile -Scope $scope -Path "$($script:MetadataDirectoryName)/$($script:OwnershipFileName)" -ExpectedHash $ownershipHash -ExistingOwned))
    }
    foreach ($directory in @($OwnershipPair.Data.CreatedDirectories | Sort-Object @{ Expression = { ($_.Path -split "/").Count }; Descending = $true }, Scope, Path)) {
        $operations.Add((New-FenneviaInstallerOperation -Kind RemoveDirectoryIfEmpty -Scope $directory.Scope -Path $directory.Path -ExistingOwned))
    }
    foreach ($scope in @("program", "profile")) {
        $operations.Add((New-FenneviaInstallerOperation -Kind RemoveDirectoryIfEmpty -Scope $scope -Path $script:MetadataDirectoryName -ExistingOwned))
    }

    return New-FenneviaInstallerInternalPlan -Action Uninstall -Targets $Targets -Package $null -OwnershipPair $OwnershipPair -Status "ready" -State absent -Operations $operations.ToArray()
}

function Assert-FenneviaInstallerMetadataClean {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets,

        [AllowNull()]
        [object] $OwnershipPair
    )

    if ($null -eq $OwnershipPair) {
        return
    }

    foreach ($scope in @("program", "profile")) {
        $root = Get-FenneviaInstallerScopeRoot -Targets $Targets -Scope $scope
        $metadataRoot = Join-Path $root $script:MetadataDirectoryName
        Assert-FenneviaInstallerTreeHasNoReparsePoints -Path $metadataRoot
        $entries = @(Get-ChildItem -Force -LiteralPath $metadataRoot)
        if ($entries.Count -ne 1 -or $entries[0].Name -cne $script:OwnershipFileName -or $entries[0].PSIsContainer) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_METADATA_CONFLICT" -Message "The Fennevia metadata directory contains an unexplained entry or interrupted transaction residue."
        }
    }
}

function Assert-FenneviaInstallerMetadataSideClean {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets,

        [Parameter(Mandatory)]
        [ValidateSet("program", "profile")]
        [string] $Scope
    )

    $root = Get-FenneviaInstallerScopeRoot -Targets $Targets -Scope $Scope
    $metadataRoot = Join-Path $root $script:MetadataDirectoryName
    Assert-FenneviaInstallerTreeHasNoReparsePoints -Path $metadataRoot
    $entries = @(Get-ChildItem -Force -LiteralPath $metadataRoot)
    if ($entries.Count -ne 1 -or $entries[0].Name -cne $script:OwnershipFileName -or $entries[0].PSIsContainer) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_METADATA_CONFLICT" -Message "The surviving Fennevia metadata directory contains an unexplained entry or interrupted transaction residue."
    }
}

function Assert-FenneviaInstallerNoInterruptedTransactions {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets
    )

    if (Test-FenneviaInstallerInterruptedTransaction -Targets $Targets) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_INTERRUPTED_TRANSACTION" -Message "A prior Fennevia transaction requires explicit recovery before another package action can run."
    }
}

function New-FenneviaInstallerActionPlan {
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
        [string] $ProfileMode = "Development"
    )

    $targets = Resolve-FenneviaInstallerTargets -FirefoxPath $FirefoxPath -ProfilePath $ProfilePath -ProfileMode $ProfileMode
    Assert-FenneviaInstallerNoInterruptedTransactions -Targets $targets
    $ownershipState = Read-FenneviaInstallerOwnershipState -Targets $targets
    if ($Action -eq "Repair") {
        if ($ownershipState.Kind -eq "complete") {
            Assert-FenneviaInstallerMetadataClean -Targets $targets -OwnershipPair $ownershipState.Pair
        }
        elseif ($ownershipState.Kind -ne "absent") {
            $survivingScope = if ($ownershipState.MissingScope -eq "program") { "profile" } else { "program" }
            Assert-FenneviaInstallerMetadataSideClean -Targets $targets -Scope $survivingScope
        }
        $package = Read-FenneviaInstallerPackageManifest -PackageRoot $PackageRoot
        $compatibility = Assert-FenneviaInstallerPackageCompatibility -Targets $targets -Package $package
        return Add-FenneviaInstallerPlanCompatibility `
            -Plan (New-FenneviaInstallerRepairPlan -Targets $targets -Package $package -OwnershipState $ownershipState) `
            -Compatibility $compatibility
    }

    if ($Action -eq "Uninstall" -and $ownershipState.Kind -notin @("absent", "complete")) {
        $missingSide = if ($ownershipState.MissingScope -eq "program") { $ownershipState.Program } else { $ownershipState.Profile }
        if ($missingSide.MetadataExists) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_METADATA_CONFLICT" -Message "One-sided uninstall requires the missing ownership side to have no metadata residue."
        }
        $survivingScope = if ($ownershipState.MissingScope -eq "program") { "profile" } else { "program" }
        Assert-FenneviaInstallerMetadataSideClean -Targets $targets -Scope $survivingScope
        Assert-FenneviaInstallerProfileProof -Targets $targets -OwnershipPair $ownershipState.Survivor
        return New-FenneviaInstallerUninstallPlan -Targets $targets -OwnershipPair $ownershipState.Survivor
    }

    if ($ownershipState.Kind -notin @("absent", "complete")) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNERSHIP_INCOMPLETE" -Message "The program and profile ownership manifests are incomplete. Preview the explicit Repair action before any further package mutation."
    }
    $ownershipPair = $ownershipState.Pair
    Assert-FenneviaInstallerProfileProof -Targets $targets -OwnershipPair $ownershipPair
    Assert-FenneviaInstallerMetadataClean -Targets $targets -OwnershipPair $ownershipPair

    switch ($Action) {
        "Install" {
            $package = Read-FenneviaInstallerPackageManifest -PackageRoot $PackageRoot
            $compatibility = Assert-FenneviaInstallerPackageCompatibility -Targets $targets -Package $package
            return Add-FenneviaInstallerPlanCompatibility `
                -Plan (New-FenneviaInstallerInstallPlan -Targets $targets -Package $package -OwnershipPair $ownershipPair) `
                -Compatibility $compatibility
        }
        "Update" {
            if ($null -eq $ownershipPair) {
                Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_NOT_INSTALLED" -Message "Update requires a valid existing ownership pair; use Install first."
            }
            $package = Read-FenneviaInstallerPackageManifest -PackageRoot $PackageRoot
            $compatibility = Assert-FenneviaInstallerPackageCompatibility -Targets $targets -Package $package
            return Add-FenneviaInstallerPlanCompatibility `
                -Plan (New-FenneviaInstallerUpdatePlan -Targets $targets -Package $package -OwnershipPair $ownershipPair) `
                -Compatibility $compatibility
        }
        "Disable" {
            if ($null -eq $ownershipPair) {
                Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_NOT_INSTALLED" -Message "Hard disable requires a valid existing ownership pair."
            }
            return New-FenneviaInstallerDisablePlan -Targets $targets -OwnershipPair $ownershipPair
        }
        "Enable" {
            if ($null -eq $ownershipPair) {
                Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_NOT_INSTALLED" -Message "Enable requires a valid existing ownership pair."
            }
            $package = Read-FenneviaInstallerPackageManifest -PackageRoot $PackageRoot
            $compatibility = Assert-FenneviaInstallerPackageCompatibility -Targets $targets -Package $package
            if ($package.ManifestSha256 -cne $ownershipPair.Data.SourceManifestSha256) {
                Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_ENABLE_SOURCE_MISMATCH" -Message "Enable requires the exact package manifest recorded by the installed ownership pair."
            }
            return Add-FenneviaInstallerPlanCompatibility `
                -Plan (New-FenneviaInstallerEnablePlan -Targets $targets -OwnershipPair $ownershipPair -Package $package) `
                -Compatibility $compatibility
        }
        "Uninstall" {
            return New-FenneviaInstallerUninstallPlan -Targets $targets -OwnershipPair $ownershipPair
        }
    }
}

function Get-FenneviaInstallerPlanSha256 {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Plan
    )

    $operations = @(
        $Plan.Operations |
            ForEach-Object {
                $isOwnershipRecord = $_.Path -ceq "$($script:MetadataDirectoryName)/$($script:OwnershipFileName)"
                [ordered]@{
                    kind = $_.Kind
                    scope = $_.Scope
                    path = $_.Path
                    destinationPath = $_.DestinationPath
                    expectedHash = if ($isOwnershipRecord) { "" } else { $_.ExpectedHash }
                    existingHash = if ($isOwnershipRecord) { "" } else { $_.ExistingHash }
                }
            }
    )
    $packageManifestSha256 = if ($null -eq $Plan.Package) { "" } else { $Plan.Package.ManifestSha256 }
    $ownershipSha256 = if ($null -eq $Plan.OwnershipPair) { "" } else { Get-FenneviaInstallerStringSha256 -Content $Plan.OwnershipPair.Content }
    $identity = [ordered]@{
        schemaVersion = 1
        action = $Plan.Action
        status = $Plan.Status
        profileMode = $Plan.Targets.ProfileMode
        packageVersion = $Plan.PackageVersion
        state = $Plan.State
        packageManifestSha256 = $packageManifestSha256
        ownershipSha256 = $ownershipSha256
        operations = $operations
    }
    return Get-FenneviaInstallerStringSha256 -Content (($identity | ConvertTo-Json -Depth 8) + [Environment]::NewLine)
}

function Get-FenneviaInstallerOperationTarget {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets,

        [Parameter(Mandatory)]
        [object] $Operation,

        [switch] $Destination
    )

    $root = Get-FenneviaInstallerScopeRoot -Targets $Targets -Scope $Operation.Scope
    $relativePath = if ($Destination) { $Operation.DestinationPath } else { $Operation.Path }
    $target = Join-FenneviaInstallerRootPath -Root $root -RelativePath $relativePath
    Assert-FenneviaInstallerNoReparseAncestor -Path $target
    return $target
}

function New-FenneviaInstallerTransactionRoot {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Root,

        [Parameter(Mandatory)]
        [ValidateSet("program", "profile")]
        [string] $Scope,

        [Parameter(Mandatory)]
        [string] $TransactionId
    )

    $name = ".fennevia-transaction-$TransactionId"
    $transactionRoot = Join-FenneviaInstallerRootPath -Root $Root -RelativePath $name
    if (Test-Path -LiteralPath $transactionRoot) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_TRANSACTION_CONFLICT" -Message "The selected root already contains the generated transaction path."
    }

    New-Item -ItemType Directory -Path $transactionRoot | Out-Null
    $marker = [ordered]@{
        schemaVersion = 1
        owner = $script:TransactionMarkerOwner
        transactionId = $TransactionId
        scope = $Scope
    }
    Write-FenneviaInstallerUtf8NoBom -Path (Join-Path $transactionRoot $script:TransactionMarkerName) -Content (($marker | ConvertTo-Json) + [Environment]::NewLine)
    return [pscustomobject]@{
        Scope = $Scope
        Root = $transactionRoot
        TransactionId = $TransactionId
    }
}

function Remove-FenneviaInstallerTransactionRoot {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Transaction
    )

    if (-not (Test-Path -LiteralPath $Transaction.Root)) {
        return
    }
    if (-not (Test-Path -LiteralPath $Transaction.Root -PathType Container)) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_TRANSACTION_CLEANUP" -Message "A transaction root is no longer a directory."
    }

    $markerPath = Join-Path $Transaction.Root $script:TransactionMarkerName
    if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_TRANSACTION_CLEANUP" -Message "A transaction root is missing its ownership marker."
    }
    try {
        $marker = Get-Content -Raw -LiteralPath $markerPath | ConvertFrom-Json
    }
    catch {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_TRANSACTION_CLEANUP" -Message "A transaction marker is invalid."
    }
    if (
        [int] $marker.schemaVersion -ne 1 -or
        [string] $marker.owner -cne $script:TransactionMarkerOwner -or
        [string] $marker.transactionId -cne $Transaction.TransactionId -or
        [string] $marker.scope -cne $Transaction.Scope
    ) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_TRANSACTION_CLEANUP" -Message "A transaction marker does not prove ownership."
    }

    Assert-FenneviaInstallerNoReparseAncestor -Path $Transaction.Root -Code "FENNEVIA_INSTALL_TRANSACTION_CLEANUP"
    Assert-FenneviaInstallerTreeHasNoReparsePoints -Path $Transaction.Root -Code "FENNEVIA_INSTALL_TRANSACTION_CLEANUP"
    Remove-Item -LiteralPath $Transaction.Root -Recurse -Force
}

function Write-FenneviaInstallerTransactionJournal {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Transaction,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [object[]] $FileSnapshots,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [object[]] $DirectorySnapshots,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [object[]] $Operations
    )

    $files = @(
        $FileSnapshots |
            Where-Object { $_.Scope -eq $Transaction.Scope } |
            Sort-Object RelativePath |
            ForEach-Object {
                [ordered]@{
                    path = $_.RelativePath
                    existed = [bool] $_.Existed
                    backup = if ($_.Existed) { $_.BackupRelativePath } else { "" }
                    backupSha256 = if ($_.Existed) { Get-FenneviaInstallerSha256 -Path $_.BackupPath } else { "" }
                }
            }
    )
    $directories = @(
        $DirectorySnapshots |
            Where-Object { $_.Scope -eq $Transaction.Scope } |
            Sort-Object RelativePath |
            ForEach-Object {
                [ordered]@{
                    path = $_.RelativePath
                    existed = [bool] $_.Existed
                }
            }
    )
    $operationsForScope = @(
        $Operations |
            Where-Object { $_.Scope -eq $Transaction.Scope } |
            ForEach-Object {
                [ordered]@{
                    kind = $_.Kind
                    path = $_.Path
                    destinationPath = $_.DestinationPath
                    expectedHash = $_.ExpectedHash
                    existingHash = $_.ExistingHash
                }
            }
    )
    $journal = [ordered]@{
        schemaVersion = 1
        owner = $script:TransactionMarkerOwner
        transactionId = $Transaction.TransactionId
        scope = $Transaction.Scope
        state = "prepared"
        files = $files
        directories = $directories
        operations = $operationsForScope
    }
    $content = ($journal | ConvertTo-Json -Depth 8) + [Environment]::NewLine
    $journalPath = Join-Path $Transaction.Root $script:TransactionJournalName
    $temporaryPath = "$journalPath.tmp"
    Write-FenneviaInstallerUtf8NoBom -Path $temporaryPath -Content $content
    if (Test-Path -LiteralPath $journalPath -PathType Leaf) {
        [IO.File]::Replace($temporaryPath, $journalPath, $null)
    }
    else {
        [IO.File]::Move($temporaryPath, $journalPath)
    }
}

function New-FenneviaInstallerFileSnapshot {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets,

        [Parameter(Mandatory)]
        [object] $Transactions,

        [Parameter(Mandatory)]
        [ValidateSet("program", "profile")]
        [string] $Scope,

        [Parameter(Mandatory)]
        [string] $RelativePath,

        [Parameter(Mandatory)]
        [bool] $ExistingOwned,

        [string] $ExpectedExistingHash = "",

        [int] $Index
    )

    $root = Get-FenneviaInstallerScopeRoot -Targets $Targets -Scope $Scope
    $path = Join-FenneviaInstallerRootPath -Root $root -RelativePath $RelativePath
    Assert-FenneviaInstallerNoReparseAncestor -Path $path
    $exists = Test-Path -LiteralPath $path
    if ($exists -and -not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_FILE_CONFLICT" -Message "A managed file target is occupied by a non-file entry."
    }
    if ($exists -and -not $ExistingOwned) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_FILE_CONFLICT" -Message "A transaction would overwrite content not proven project-owned."
    }
    if ($exists -and $ExistingOwned) {
        if ([string]::IsNullOrWhiteSpace($ExpectedExistingHash)) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_TRANSACTION_PLAN_INVALID" -Message "A transaction plan omitted the expected hash for existing project-owned content."
        }
        if ((Get-FenneviaInstallerSha256 -Path $path) -cne $ExpectedExistingHash) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNED_FILE_MODIFIED" -Message "An ownership-listed file changed after preflight."
        }
    }

    $backupPath = ""
    $backupRelativePath = ""
    if ($exists) {
        $transaction = $Transactions[$Scope]
        $backupRoot = Join-Path $transaction.Root "backup"
        New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
        $backupPath = Join-Path $backupRoot ("{0:D4}.bin" -f $Index)
        $backupRelativePath = "backup/$([IO.Path]::GetFileName($backupPath))"
        [IO.File]::Copy($path, $backupPath, $false)
        if ((Get-FenneviaInstallerSha256 -Path $backupPath) -cne (Get-FenneviaInstallerSha256 -Path $path)) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_BACKUP_FAILED" -Message "A transaction backup did not verify."
        }
    }

    return [pscustomobject]@{
        Scope = $Scope
        RelativePath = $RelativePath
        Path = $path
        Existed = $exists
        BackupPath = $backupPath
        BackupRelativePath = $backupRelativePath
    }
}

function Restore-FenneviaInstallerSnapshots {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [object[]] $FileSnapshots,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [object[]] $DirectorySnapshots
    )

    $failures = New-Object "Collections.Generic.List[string]"
    foreach ($snapshot in @($FileSnapshots | Sort-Object @{ Expression = { ($_.RelativePath -split "/").Count }; Descending = $true })) {
        try {
            if ($snapshot.Existed) {
                $parent = Split-Path -Parent $snapshot.Path
                if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
                    New-Item -ItemType Directory -Path $parent -Force | Out-Null
                }
                if (Test-Path -LiteralPath $snapshot.Path) {
                    if (-not (Test-Path -LiteralPath $snapshot.Path -PathType Leaf)) {
                        throw "The rollback target is not a regular file."
                    }
                    [IO.File]::Delete($snapshot.Path)
                }
                [IO.File]::Copy($snapshot.BackupPath, $snapshot.Path, $false)
                if ((Get-FenneviaInstallerSha256 -Path $snapshot.Path) -cne (Get-FenneviaInstallerSha256 -Path $snapshot.BackupPath)) {
                    throw "The restored file hash does not match its transaction backup."
                }
            }
            elseif (Test-Path -LiteralPath $snapshot.Path) {
                if (-not (Test-Path -LiteralPath $snapshot.Path -PathType Leaf)) {
                    throw "A newly created rollback target is not a regular file."
                }
                [IO.File]::Delete($snapshot.Path)
            }
        }
        catch {
            $failures.Add("$($snapshot.Scope):$($snapshot.RelativePath)")
        }
    }

    foreach ($snapshot in @($DirectorySnapshots | Sort-Object @{ Expression = { ($_.RelativePath -split "/").Count } })) {
        if (-not $snapshot.Existed -or (Test-Path -LiteralPath $snapshot.Path -PathType Container)) {
            continue
        }
        try {
            New-Item -ItemType Directory -Path $snapshot.Path -Force | Out-Null
        }
        catch {
            $failures.Add("$($snapshot.Scope):$($snapshot.RelativePath)")
        }
    }

    foreach ($snapshot in @($DirectorySnapshots | Sort-Object @{ Expression = { ($_.RelativePath -split "/").Count }; Descending = $true })) {
        if ($snapshot.Existed -or -not (Test-Path -LiteralPath $snapshot.Path -PathType Container)) {
            continue
        }
        try {
            if (@(Get-ChildItem -Force -LiteralPath $snapshot.Path).Count -eq 0) {
                Remove-Item -LiteralPath $snapshot.Path
            }
        }
        catch {
            $failures.Add("$($snapshot.Scope):$($snapshot.RelativePath)")
        }
    }

    return @($failures | Sort-Object -Unique)
}

function Invoke-FenneviaInstallerTransaction {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Plan,

        [int] $FailureAfterMutation = 0,

        [string] $TestDenyTransactionScope = ""
    )

    if ($Plan.Operations.Count -eq 0) {
        return 0
    }
    if ($FailureAfterMutation -lt 0) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_TEST_INPUT" -Message "The test-only failure point must not be negative."
    }
    if ($TestDenyTransactionScope -notin @("", "program", "profile")) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_TEST_INPUT" -Message "The test-only denied transaction scope is invalid."
    }

    Assert-FenneviaInstallerSelectedFirefoxClosed -Targets $Plan.Targets

    $directorySnapshots = New-Object "Collections.Generic.List[object]"
    $directoryKeys = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    foreach ($operation in $Plan.Operations) {
        if ($operation.Kind -notin @("CreateDirectory", "RemoveDirectoryIfEmpty")) {
            continue
        }
        $path = Get-FenneviaInstallerOperationTarget -Targets $Plan.Targets -Operation $operation
        $key = "$($operation.Scope):$($operation.Path)"
        if ($directoryKeys.Add($key)) {
            $exists = Test-Path -LiteralPath $path
            if ($exists -and -not (Test-Path -LiteralPath $path -PathType Container)) {
                Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_FILE_CONFLICT" -Message "A planned directory target is occupied by a file."
            }
            $directorySnapshots.Add([pscustomobject]@{
                Scope = $operation.Scope
                RelativePath = $operation.Path
                Path = $path
                Existed = $exists
            })
        }
    }

    $transactionId = [guid]::NewGuid().ToString("N")
    $transactions = @{}
    $fileSnapshots = New-Object "Collections.Generic.List[object]"
    $snapshotKeys = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    $attemptedFileKeys = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    $attemptedDirectoryKeys = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    $mutationCount = 0
    $managedMutationAttempted = $false

    try {
        foreach ($scope in @("program", "profile")) {
            if ($scope -eq $TestDenyTransactionScope) {
                throw ([UnauthorizedAccessException]::new("A test-only transaction permission failure was injected."))
            }
            $root = Get-FenneviaInstallerScopeRoot -Targets $Plan.Targets -Scope $scope
            $transactions[$scope] = New-FenneviaInstallerTransactionRoot -Root $root -Scope $scope -TransactionId $transactionId
        }

        $operationIndex = 0
        $replaceIndex = 0
        foreach ($operation in $Plan.Operations) {
            if ($operation.Kind -in @("CreateFile", "ReplaceFile")) {
                $transaction = $transactions[$operation.Scope]
                $stageRoot = Join-Path $transaction.Root "stage"
                New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null
                $stagePath = Join-Path $stageRoot ("{0:D4}.bin" -f $operationIndex)
                if (-not [string]::IsNullOrWhiteSpace($operation.SourcePath)) {
                    [IO.File]::Copy($operation.SourcePath, $stagePath, $false)
                }
                else {
                    Write-FenneviaInstallerUtf8NoBom -Path $stagePath -Content $operation.Content
                }
                if ((Get-FenneviaInstallerSha256 -Path $stagePath) -cne $operation.ExpectedHash) {
                    Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_STAGE_HASH_MISMATCH" -Message "A staged file did not match its expected SHA-256."
                }
                $operation.StagePath = $stagePath
            }
            $operationIndex++
        }

        $snapshotIndex = 0
        foreach ($operation in $Plan.Operations) {
            if ($operation.Kind -in @("CreateFile", "ReplaceFile", "RemoveFile", "MoveFile")) {
                $key = "$($operation.Scope):$($operation.Path)"
                if ($snapshotKeys.Add($key)) {
                    $existingHash = if ($operation.Kind -in @("RemoveFile", "MoveFile")) { $operation.ExpectedHash } else { $operation.ExistingHash }
                    $snapshot = New-FenneviaInstallerFileSnapshot -Targets $Plan.Targets -Transactions $transactions -Scope $operation.Scope -RelativePath $operation.Path -ExistingOwned:$operation.ExistingOwned -ExpectedExistingHash $existingHash -Index $snapshotIndex
                    $fileSnapshots.Add($snapshot)
                    $snapshotIndex++
                }
            }
            if ($operation.Kind -eq "MoveFile") {
                $destinationKey = "$($operation.Scope):$($operation.DestinationPath)"
                if ($snapshotKeys.Add($destinationKey)) {
                    $snapshot = New-FenneviaInstallerFileSnapshot -Targets $Plan.Targets -Transactions $transactions -Scope $operation.Scope -RelativePath $operation.DestinationPath -ExistingOwned:$false -Index $snapshotIndex
                    $fileSnapshots.Add($snapshot)
                    $snapshotIndex++
                }
            }
        }

        foreach ($transaction in @($transactions.Values)) {
            Write-FenneviaInstallerTransactionJournal -Transaction $transaction -FileSnapshots $fileSnapshots.ToArray() -DirectorySnapshots $directorySnapshots.ToArray() -Operations $Plan.Operations
        }

        Assert-FenneviaInstallerSelectedFirefoxClosed -Targets $Plan.Targets

        foreach ($operation in $Plan.Operations) {
            $target = Get-FenneviaInstallerOperationTarget -Targets $Plan.Targets -Operation $operation
            $changed = $false
            switch ($operation.Kind) {
                "CreateDirectory" {
                    if (-not (Test-Path -LiteralPath $target)) {
                        $managedMutationAttempted = $true
                        [void] $attemptedDirectoryKeys.Add("$($operation.Scope):$($operation.Path)")
                        New-Item -ItemType Directory -Path $target | Out-Null
                        $changed = $true
                    }
                }
                "CreateFile" {
                    if (Test-Path -LiteralPath $target) {
                        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_FILE_CONFLICT" -Message "A create target changed after preflight."
                    }
                    $managedMutationAttempted = $true
                    [void] $attemptedFileKeys.Add("$($operation.Scope):$($operation.Path)")
                    [IO.File]::Move($operation.StagePath, $target)
                    $changed = $true
                }
                "ReplaceFile" {
                    if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
                        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNED_FILE_MISSING" -Message "A replace target changed after preflight."
                    }
                    if ((Get-FenneviaInstallerSha256 -Path $target) -cne $operation.ExistingHash) {
                        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNED_FILE_MODIFIED" -Message "A replace target changed after its transaction backup."
                    }
                    $replaceBackupRoot = Join-Path $transactions[$operation.Scope].Root "replace-backup"
                    New-Item -ItemType Directory -Path $replaceBackupRoot -Force | Out-Null
                    $replaceBackupPath = Join-Path $replaceBackupRoot ("{0:D4}.bin" -f $replaceIndex)
                    $managedMutationAttempted = $true
                    [void] $attemptedFileKeys.Add("$($operation.Scope):$($operation.Path)")
                    [IO.File]::Replace($operation.StagePath, $target, $replaceBackupPath)
                    $replaceIndex++
                    $changed = $true
                }
                "RemoveFile" {
                    if (Test-Path -LiteralPath $target -PathType Leaf) {
                        if ((Get-FenneviaInstallerSha256 -Path $target) -cne $operation.ExpectedHash) {
                            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNED_FILE_MODIFIED" -Message "A remove target changed after preflight."
                        }
                        $managedMutationAttempted = $true
                        [void] $attemptedFileKeys.Add("$($operation.Scope):$($operation.Path)")
                        [IO.File]::Delete($target)
                        $changed = $true
                    }
                }
                "MoveFile" {
                    $destination = Get-FenneviaInstallerOperationTarget -Targets $Plan.Targets -Operation $operation -Destination
                    if (-not (Test-Path -LiteralPath $target -PathType Leaf) -or (Test-Path -LiteralPath $destination)) {
                        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_STATE_CONFLICT" -Message "A hard-disable move target changed after preflight."
                    }
                    if ((Get-FenneviaInstallerSha256 -Path $target) -cne $operation.ExpectedHash) {
                        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNED_FILE_MODIFIED" -Message "The hard-disable preference changed after preflight."
                    }
                    $managedMutationAttempted = $true
                    [void] $attemptedFileKeys.Add("$($operation.Scope):$($operation.Path)")
                    [void] $attemptedFileKeys.Add("$($operation.Scope):$($operation.DestinationPath)")
                    [IO.File]::Move($target, $destination)
                    $changed = $true
                }
                "RemoveDirectoryIfEmpty" {
                    if (Test-Path -LiteralPath $target -PathType Container) {
                        if (@(Get-ChildItem -Force -LiteralPath $target).Count -eq 0) {
                            $managedMutationAttempted = $true
                            [void] $attemptedDirectoryKeys.Add("$($operation.Scope):$($operation.Path)")
                            Remove-Item -LiteralPath $target
                            $changed = $true
                        }
                    }
                }
            }

            if ($changed) {
                $mutationCount++
                if ($FailureAfterMutation -gt 0 -and $mutationCount -eq $FailureAfterMutation) {
                    Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_INJECTED_FAILURE" -Message "A test-only transaction failure was injected."
                }
            }
        }

        foreach ($operation in $Plan.Operations) {
            $target = Get-FenneviaInstallerOperationTarget -Targets $Plan.Targets -Operation $operation
            switch ($operation.Kind) {
                { $_ -in @("CreateFile", "ReplaceFile") } {
                    if (-not (Test-Path -LiteralPath $target -PathType Leaf) -or (Get-FenneviaInstallerSha256 -Path $target) -cne $operation.ExpectedHash) {
                        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_COMMIT_HASH_MISMATCH" -Message "A committed file did not match its expected SHA-256."
                    }
                }
                "RemoveFile" {
                    if (Test-Path -LiteralPath $target) {
                        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_COMMIT_STATE_MISMATCH" -Message "A removed project file reappeared before transaction commit."
                    }
                }
                "MoveFile" {
                    $destination = Get-FenneviaInstallerOperationTarget -Targets $Plan.Targets -Operation $operation -Destination
                    if (
                        (Test-Path -LiteralPath $target) -or
                        -not (Test-Path -LiteralPath $destination -PathType Leaf) -or
                        (Get-FenneviaInstallerSha256 -Path $destination) -cne $operation.ExpectedHash
                    ) {
                        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_COMMIT_STATE_MISMATCH" -Message "A hard-disable move did not commit to its exact expected state."
                    }
                }
                "CreateDirectory" {
                    if (-not (Test-Path -LiteralPath $target -PathType Container)) {
                        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_COMMIT_STATE_MISMATCH" -Message "A required project directory was not present at transaction commit."
                    }
                }
            }
        }
    }
    catch {
        $originalError = $_
        $rollbackFailures = @()
        if ($managedMutationAttempted) {
            $rollbackFileSnapshots = @($fileSnapshots | Where-Object { $attemptedFileKeys.Contains("$($_.Scope):$($_.RelativePath)") })
            $rollbackDirectorySnapshots = @($directorySnapshots | Where-Object { $attemptedDirectoryKeys.Contains("$($_.Scope):$($_.RelativePath)") })
            $rollbackFailures = @(Restore-FenneviaInstallerSnapshots -FileSnapshots $rollbackFileSnapshots -DirectorySnapshots $rollbackDirectorySnapshots)
        }

        if ($rollbackFailures.Count -gt 0) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_ROLLBACK_INCOMPLETE" -Message "Rollback was incomplete. Keep the marker-owned <PROGRAM_TRANSACTION> and <PROFILE_TRANSACTION> directories and follow each retained relative-path journal before changing any listed project path."
        }

        foreach ($transaction in @($transactions.Values)) {
            try {
                Remove-FenneviaInstallerTransactionRoot -Transaction $transaction
            }
            catch {
                Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_TRANSACTION_CLEANUP" -Message "The transaction rolled back, but a marker-owned transaction directory requires manual removal."
            }
        }
        $permissionFailure = $false
        $candidateException = $originalError.Exception
        while ($null -ne $candidateException) {
            if ($candidateException -is [UnauthorizedAccessException]) {
                $permissionFailure = $true
                break
            }
            $candidateException = $candidateException.InnerException
        }
        if ($permissionFailure) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_PERMISSION_DENIED" -Message "The selected roots denied a transaction operation; the prior managed state was restored."
        }
        if ((Get-FenneviaInstallerErrorCode -ErrorRecord $originalError) -eq "FENNEVIA_INSTALL_UNEXPECTED") {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_TRANSACTION_FAILED" -Message "The package transaction failed unexpectedly and the prior managed state was restored. Inspect the local error record without sharing target paths."
        }
        throw $originalError
    }

    foreach ($transaction in @($transactions.Values)) {
        try {
            Remove-FenneviaInstallerTransactionRoot -Transaction $transaction
        }
        catch {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_TRANSACTION_CLEANUP" -Message "The package state committed, but a marker-owned transaction directory requires manual removal."
        }
    }

    return $mutationCount
}

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
                    $releaseModule = Join-Path $PSScriptRoot "FenneviaRelease.psm1"
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

Export-ModuleMember -Function @(
    "ConvertTo-FenneviaInstallerProfileChoiceLines",
    "ConvertTo-FenneviaInstallerProgramCandidateLines",
    "ConvertTo-FenneviaInstallerResultLines",
    "ConvertTo-FenneviaInstallerStatusLines",
    "Get-FenneviaFirefoxProgramCandidates",
    "Get-FenneviaInstallerErrorCode",
    "Get-FenneviaInstallerInstallationStatus",
    "Get-FenneviaInstallerRegisteredProfileChoices",
    "Invoke-FenneviaPackageAction"
)
