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
