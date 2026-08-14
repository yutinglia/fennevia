Set-StrictMode -Version Latest

$script:ProfileName = "my-firefox-shell-dev"
$script:MarkerFileName = ".mfs-dev-profile.json"
$script:MarkerOwner = "my-firefox-shell"
$script:MarkerSchemaVersion = 1

function Get-MfsOptionalPropertyValue {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $InputObject,

        [Parameter(Mandatory)]
        [string] $Name
    )

    $property = $InputObject.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $null
    }

    return $property.Value
}

function ConvertTo-MfsCanonicalPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        throw "A non-empty absolute path is required."
    }

    $expandedPath = [Environment]::ExpandEnvironmentVariables($Path)
    if (-not [IO.Path]::IsPathRooted($expandedPath)) {
        throw "Relative paths are not allowed for Firefox development-profile operations."
    }

    $fullPath = [IO.Path]::GetFullPath($expandedPath)
    $pathRoot = [IO.Path]::GetPathRoot($fullPath)
    if ([string]::Equals($fullPath, $pathRoot, [StringComparison]::OrdinalIgnoreCase)) {
        return $pathRoot
    }

    return $fullPath.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
}

function Get-MfsManagedProfileRoot {
    [CmdletBinding()]
    param()

    if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
        throw "LOCALAPPDATA is unavailable; the managed development-profile root cannot be resolved."
    }

    return ConvertTo-MfsCanonicalPath -Path (Join-Path $env:LOCALAPPDATA "my-firefox-shell\profiles")
}

function Get-MfsDefaultProfilePath {
    [CmdletBinding()]
    param()

    return Join-Path (Get-MfsManagedProfileRoot) $script:ProfileName
}

function Test-MfsPathWithin {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $ChildPath,

        [Parameter(Mandatory)]
        [string] $ParentPath
    )

    $canonicalChild = ConvertTo-MfsCanonicalPath -Path $ChildPath
    $canonicalParent = ConvertTo-MfsCanonicalPath -Path $ParentPath
    $prefix = $canonicalParent + [IO.Path]::DirectorySeparatorChar
    return $canonicalChild.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)
}

function Get-MfsRegisteredFirefoxProfilePaths {
    [CmdletBinding()]
    param()

    if ([string]::IsNullOrWhiteSpace($env:APPDATA)) {
        return @()
    }

    $firefoxDataRoot = Join-Path $env:APPDATA "Mozilla\Firefox"
    $profilesIni = Join-Path $firefoxDataRoot "profiles.ini"
    $sections = @()
    if (Test-Path -LiteralPath $profilesIni -PathType Leaf) {
        $currentSection = $null
        foreach ($line in Get-Content -LiteralPath $profilesIni) {
            $trimmed = $line.Trim()
            if ($trimmed -match "^\[Profile\d+\]$") {
                if ($null -ne $currentSection) {
                    $sections += $currentSection
                }
                $currentSection = @{}
                continue
            }

            if ($null -ne $currentSection -and $trimmed -match "^([^=]+)=(.*)$") {
                $currentSection[$Matches[1].Trim()] = $Matches[2].Trim()
            }
        }

        if ($null -ne $currentSection) {
            $sections += $currentSection
        }
    }

    $paths = @()
    foreach ($section in $sections) {
        if (-not $section.ContainsKey("Path") -or [string]::IsNullOrWhiteSpace($section["Path"])) {
            continue
        }

        $candidate = $section["Path"]
        if ($section.ContainsKey("IsRelative") -and $section["IsRelative"] -eq "1") {
            $candidate = Join-Path $firefoxDataRoot $candidate
        }

        if ([IO.Path]::IsPathRooted($candidate)) {
            $paths += ConvertTo-MfsCanonicalPath -Path $candidate
        }
    }

    $installsIni = Join-Path $firefoxDataRoot "installs.ini"
    if (Test-Path -LiteralPath $installsIni -PathType Leaf) {
        foreach ($line in Get-Content -LiteralPath $installsIni) {
            if ($line.Trim() -notmatch "^Default=(.+)$") {
                continue
            }

            $candidate = $Matches[1].Trim()
            if (-not [IO.Path]::IsPathRooted($candidate)) {
                $candidate = Join-Path $firefoxDataRoot $candidate
            }
            $paths += ConvertTo-MfsCanonicalPath -Path $candidate
        }
    }

    return @($paths | Sort-Object -Unique)
}

function Assert-MfsPathHasNoReparseAncestor {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    $canonicalPath = ConvertTo-MfsCanonicalPath -Path $Path
    $localAppData = ConvertTo-MfsCanonicalPath -Path $env:LOCALAPPDATA
    $currentPath = $canonicalPath

    while ($true) {
        if (Test-Path -LiteralPath $currentPath) {
            $item = Get-Item -Force -LiteralPath $currentPath
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Reparse points are not allowed in the managed development-profile path."
            }
        }

        if ([string]::Equals($currentPath, $localAppData, [StringComparison]::OrdinalIgnoreCase)) {
            break
        }

        $parentPath = Split-Path -Parent $currentPath
        if (
            [string]::IsNullOrWhiteSpace($parentPath) -or
            -not (
                [string]::Equals($parentPath, $localAppData, [StringComparison]::OrdinalIgnoreCase) -or
                (Test-MfsPathWithin -ChildPath $parentPath -ParentPath $localAppData)
            )
        ) {
            throw "The managed development-profile path could not be traced safely to LOCALAPPDATA."
        }

        $currentPath = ConvertTo-MfsCanonicalPath -Path $parentPath
    }
}

function Assert-MfsProfileTreeHasNoReparsePoints {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $ProfilePath
    )

    $pendingDirectories = @($ProfilePath)
    while ($pendingDirectories.Count -gt 0) {
        $directory = $pendingDirectories[0]
        if ($pendingDirectories.Count -eq 1) {
            $pendingDirectories = @()
        }
        else {
            $pendingDirectories = @($pendingDirectories[1..($pendingDirectories.Count - 1)])
        }

        $directoryItem = Get-Item -Force -LiteralPath $directory
        if (($directoryItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Reparse points are not allowed in a removable development-profile tree."
        }

        foreach ($child in @(Get-ChildItem -Force -LiteralPath $directory)) {
            if (($child.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Reparse points are not allowed in a removable development-profile tree."
            }
            if ($child.PSIsContainer) {
                $pendingDirectories += $child.FullName
            }
        }
    }
}

function Assert-MfsProfilePathSafe {
    [CmdletBinding()]
    param(
        [string] $ProfilePath
    )

    $managedRoot = Get-MfsManagedProfileRoot
    $candidate = if ([string]::IsNullOrWhiteSpace($ProfilePath)) {
        Get-MfsDefaultProfilePath
    }
    else {
        ConvertTo-MfsCanonicalPath -Path $ProfilePath
    }

    if (-not (Test-MfsPathWithin -ChildPath $candidate -ParentPath $managedRoot)) {
        throw "The development profile must remain below the dedicated my-firefox-shell managed root."
    }

    Assert-MfsPathHasNoReparseAncestor -Path $candidate

    $forbiddenPaths = @(
        $managedRoot,
        (ConvertTo-MfsCanonicalPath -Path $env:LOCALAPPDATA),
        (ConvertTo-MfsCanonicalPath -Path $env:APPDATA),
        (ConvertTo-MfsCanonicalPath -Path ([Environment]::GetFolderPath("UserProfile")))
    )

    foreach ($forbiddenPath in $forbiddenPaths) {
        if ([string]::Equals($candidate, $forbiddenPath, [StringComparison]::OrdinalIgnoreCase)) {
            throw "The requested path is too broad for a disposable Firefox development profile."
        }
    }

    foreach ($registeredPath in @(Get-MfsRegisteredFirefoxProfilePaths)) {
        if ([string]::Equals($candidate, $registeredPath, [StringComparison]::OrdinalIgnoreCase)) {
            throw "The requested path is registered as an existing Firefox profile and cannot be managed here."
        }
    }

    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
        throw "The requested development-profile path is an existing file."
    }

    return $candidate
}

function Write-MfsUtf8NoBom {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path,

        [Parameter(Mandatory)]
        [string] $Content
    )

    $encoding = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Get-MfsMarkerPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $ProfilePath
    )

    return Join-Path $ProfilePath $script:MarkerFileName
}

function Read-MfsProfileMarker {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $ProfilePath
    )

    $markerPath = Get-MfsMarkerPath -ProfilePath $ProfilePath
    if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
        return $null
    }

    try {
        $marker = Get-Content -Raw -LiteralPath $markerPath | ConvertFrom-Json
    }
    catch {
        return $null
    }

    if ($null -eq $marker) {
        return $null
    }

    $propertyNames = @($marker.PSObject.Properties.Name)
    foreach ($requiredProperty in @("owner", "schemaVersion", "profileName")) {
        if ($propertyNames -notcontains $requiredProperty) {
            return $null
        }
    }

    try {
        $schemaVersion = [int] $marker.schemaVersion
    }
    catch {
        return $null
    }

    if (
        $marker.owner -ne $script:MarkerOwner -or
        $schemaVersion -ne $script:MarkerSchemaVersion -or
        $marker.profileName -ne $script:ProfileName
    ) {
        return $null
    }

    return $marker
}

function Get-MfsRequiredUserPreferences {
    [CmdletBinding()]
    param()

    return @(
        "// Generated by scripts/firefox-dev.ps1. Re-run Initialize to restore this file.",
        "// Keep the remote-debugging confirmation prompt enabled for local safety.",
        "user_pref(`"devtools.chrome.enabled`", true);",
        "user_pref(`"devtools.debugger.remote-enabled`", true);",
        "user_pref(`"devtools.debugger.prompt-connection`", true);",
        "user_pref(`"devtools.browsertoolbox.scope`", `"parent-process`");",
        "user_pref(`"browser.shell.checkDefaultBrowser`", false);"
    )
}

function Test-MfsProfileInUse {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $ProfilePath
    )

    $firefoxProcesses = @(Get-Process -Name firefox -ErrorAction SilentlyContinue)
    if ($firefoxProcesses.Count -eq 0) {
        return $false
    }

    try {
        $processDetails = @(Get-CimInstance Win32_Process -Filter "Name = 'firefox.exe'")
    }
    catch {
        throw "Firefox is running, but its profile command line could not be inspected safely. Close Firefox before continuing."
    }

    foreach ($process in $processDetails) {
        if (
            -not [string]::IsNullOrWhiteSpace($process.CommandLine) -and
            $process.CommandLine.IndexOf($ProfilePath, [StringComparison]::OrdinalIgnoreCase) -ge 0
        ) {
            return $true
        }
    }

    return $false
}

function Test-MfsFirefoxDevProfile {
    [CmdletBinding()]
    param(
        [string] $ProfilePath
    )

    $canonicalProfile = Assert-MfsProfilePathSafe -ProfilePath $ProfilePath
    $problems = @()
    $exists = Test-Path -LiteralPath $canonicalProfile -PathType Container
    $markerValid = $false
    $preferencesValid = $false

    if (-not $exists) {
        $problems += "The managed development profile has not been initialized."
    }
    else {
        Assert-MfsProfileTreeHasNoReparsePoints -ProfilePath $canonicalProfile
        $markerValid = $null -ne (Read-MfsProfileMarker -ProfilePath $canonicalProfile)
        if (-not $markerValid) {
            $problems += "The project ownership marker is missing or invalid."
        }

        $userJsPath = Join-Path $canonicalProfile "user.js"
        if (-not (Test-Path -LiteralPath $userJsPath -PathType Leaf)) {
            $problems += "The generated user.js file is missing."
        }
        else {
            $userJs = Get-Content -Raw -LiteralPath $userJsPath
            $missingPreferences = @(
                Get-MfsRequiredUserPreferences |
                    Where-Object { $_ -like "user_pref*" -and $userJs.IndexOf($_, [StringComparison]::Ordinal) -lt 0 }
            )
            $preferencesValid = $missingPreferences.Count -eq 0
            if (-not $preferencesValid) {
                $problems += "One or more required development preferences are missing."
            }
        }
    }

    return [pscustomobject]@{
        ProfilePath = $canonicalProfile
        Exists = $exists
        MarkerValid = $markerValid
        PreferencesValid = $preferencesValid
        IsValid = $exists -and $markerValid -and $preferencesValid
        Problems = $problems
    }
}

function Initialize-MfsFirefoxDevProfile {
    [CmdletBinding()]
    param(
        [string] $ProfilePath
    )

    $canonicalProfile = Assert-MfsProfilePathSafe -ProfilePath $ProfilePath
    if (Test-MfsProfileInUse -ProfilePath $canonicalProfile) {
        throw "The managed development profile is currently in use. Close its Firefox instance before initializing it."
    }

    if (Test-Path -LiteralPath $canonicalProfile -PathType Container) {
        Assert-MfsProfileTreeHasNoReparsePoints -ProfilePath $canonicalProfile
        $entries = @(Get-ChildItem -Force -LiteralPath $canonicalProfile)
        if ($entries.Count -gt 0 -and $null -eq (Read-MfsProfileMarker -ProfilePath $canonicalProfile)) {
            throw "Refusing to initialize a non-empty directory without a valid project ownership marker."
        }
    }
    else {
        New-Item -ItemType Directory -Path $canonicalProfile -Force | Out-Null
    }

    $markerPath = Get-MfsMarkerPath -ProfilePath $canonicalProfile
    if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
        $marker = [ordered]@{
            schemaVersion = $script:MarkerSchemaVersion
            owner = $script:MarkerOwner
            profileName = $script:ProfileName
            createdUtc = (Get-Date).ToUniversalTime().ToString("o")
        }
        Write-MfsUtf8NoBom -Path $markerPath -Content (($marker | ConvertTo-Json) + [Environment]::NewLine)
    }

    $userJsPath = Join-Path $canonicalProfile "user.js"
    $userJs = (Get-MfsRequiredUserPreferences) -join [Environment]::NewLine
    Write-MfsUtf8NoBom -Path $userJsPath -Content ($userJs + [Environment]::NewLine)

    return Test-MfsFirefoxDevProfile -ProfilePath $canonicalProfile
}

function Get-MfsFirefoxExecutable {
    [CmdletBinding()]
    param(
        [string] $FirefoxPath
    )

    if (-not [string]::IsNullOrWhiteSpace($FirefoxPath)) {
        $canonicalPath = ConvertTo-MfsCanonicalPath -Path $FirefoxPath
        if (-not (Test-Path -LiteralPath $canonicalPath -PathType Leaf)) {
            throw "The explicitly selected Firefox executable does not exist."
        }
        if ([IO.Path]::GetFileName($canonicalPath) -ne "firefox.exe") {
            throw "The explicitly selected executable must be firefox.exe."
        }
        return $canonicalPath
    }

    $candidates = @()
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

        $currentVersion = Get-MfsOptionalPropertyValue -InputObject $registryValues -Name "CurrentVersion"
        if ([string]::IsNullOrWhiteSpace($currentVersion)) {
            continue
        }

        $mainKey = Join-Path $registryKey "$currentVersion\Main"
        $mainValues = Get-ItemProperty -LiteralPath $mainKey -ErrorAction SilentlyContinue
        if ($null -eq $mainValues) {
            continue
        }

        $pathToExe = Get-MfsOptionalPropertyValue -InputObject $mainValues -Name "PathToExe"
        if (-not [string]::IsNullOrWhiteSpace($pathToExe)) {
            $candidates += $pathToExe
        }
    }

    $programFilesX86 = [Environment]::GetEnvironmentVariable("ProgramFiles(x86)")
    $candidates += Join-Path $env:ProgramFiles "Mozilla Firefox\firefox.exe"
    if (-not [string]::IsNullOrWhiteSpace($programFilesX86)) {
        $candidates += Join-Path $programFilesX86 "Mozilla Firefox\firefox.exe"
    }

    $resolvedCandidates = @(
        $candidates |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) -and (Test-Path -LiteralPath $_ -PathType Leaf) } |
            ForEach-Object { ConvertTo-MfsCanonicalPath -Path $_ } |
            Sort-Object -Unique
    )

    if ($resolvedCandidates.Count -eq 0) {
        throw "Firefox was not found. Pass -FirefoxPath with an explicit firefox.exe path."
    }
    if ($resolvedCandidates.Count -gt 1) {
        throw "Multiple Firefox installations were found. Pass -FirefoxPath to select one explicitly."
    }

    return $resolvedCandidates[0]
}

function Get-MfsFirefoxDetails {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $FirefoxPath
    )

    $canonicalFirefox = Get-MfsFirefoxExecutable -FirefoxPath $FirefoxPath
    $programRoot = Split-Path -Parent $canonicalFirefox
    $applicationIni = Join-Path $programRoot "application.ini"
    if (-not (Test-Path -LiteralPath $applicationIni -PathType Leaf)) {
        throw "Firefox application.ini was not found beside the selected executable."
    }

    $appValues = @{}
    $currentSection = ""
    foreach ($line in Get-Content -LiteralPath $applicationIni) {
        $trimmed = $line.Trim()
        if ($trimmed -match "^\[(.+)\]$") {
            $currentSection = $Matches[1]
            continue
        }
        if ($currentSection -eq "App" -and $trimmed -match "^([^=]+)=(.*)$") {
            $appValues[$Matches[1].Trim()] = $Matches[2].Trim()
        }
    }

    $channel = "unknown"
    $channelPrefs = Join-Path $programRoot "defaults\pref\channel-prefs.js"
    if (Test-Path -LiteralPath $channelPrefs -PathType Leaf) {
        $channelContent = Get-Content -Raw -LiteralPath $channelPrefs
        if ($channelContent -match 'pref\(\s*"app\.update\.channel"\s*,\s*"([^"]+)"\s*\)') {
            $channel = $Matches[1]
        }
    }

    return [pscustomobject]@{
        Executable = $canonicalFirefox
        ProgramRoot = $programRoot
        Version = if ($appValues.ContainsKey("Version")) { $appValues["Version"] } else { (Get-Item -LiteralPath $canonicalFirefox).VersionInfo.ProductVersion }
        BuildID = if ($appValues.ContainsKey("BuildID")) { $appValues["BuildID"] } else { "unknown" }
        Channel = $channel
        SourceRepository = if ($appValues.ContainsKey("SourceRepository")) { $appValues["SourceRepository"] } else { "unknown" }
        SourceStamp = if ($appValues.ContainsKey("SourceStamp")) { $appValues["SourceStamp"] } else { "unknown" }
    }
}

function Get-MfsAutoConfigAudit {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $ProgramRoot
    )

    $prefRoot = Join-Path $ProgramRoot "defaults\pref"
    $declarations = @()
    if (Test-Path -LiteralPath $prefRoot -PathType Container) {
        foreach ($prefFile in @(Get-ChildItem -LiteralPath $prefRoot -Filter "*.js" -File)) {
            $content = Get-Content -Raw -LiteralPath $prefFile.FullName
            if ($content -match 'general\.config\.filename') {
                $relativePath = $prefFile.FullName.Substring($ProgramRoot.Length).TrimStart("\", "/")
                $declarations += $relativePath
            }
        }
    }

    return [pscustomobject]@{
        HasDeclarations = $declarations.Count -gt 0
        DeclarationFiles = $declarations
    }
}

function Get-MfsFirefoxPolicyAudit {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $ProgramRoot
    )

    $registryPolicyKeys = @(
        "HKLM:\SOFTWARE\Policies\Mozilla\Firefox",
        "HKCU:\SOFTWARE\Policies\Mozilla\Firefox"
    )
    $presentRegistryKeys = @($registryPolicyKeys | Where-Object { Test-Path -LiteralPath $_ })
    $policiesJson = Join-Path $ProgramRoot "distribution\policies.json"
    $hasPoliciesJson = Test-Path -LiteralPath $policiesJson -PathType Leaf

    return [pscustomobject]@{
        HasPolicySource = $presentRegistryKeys.Count -gt 0 -or $hasPoliciesJson
        RegistryPolicySourceCount = $presentRegistryKeys.Count
        HasPoliciesJson = $hasPoliciesJson
    }
}

function Get-MfsProfileContaminationAudit {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $ProfilePath
    )

    $canonicalProfile = Assert-MfsProfilePathSafe -ProfilePath $ProfilePath
    if (-not (Test-Path -LiteralPath $canonicalProfile -PathType Container)) {
        return [pscustomobject]@{
            HasUnexpectedProfileContent = $false
            ExtensionDirectoryEntryCount = 0
            ChromeCustomizationEntryCount = 0
        }
    }
    Assert-MfsProfileTreeHasNoReparsePoints -ProfilePath $canonicalProfile
    $extensionsDirectory = Join-Path $canonicalProfile "extensions"
    $extensionFileCount = if (Test-Path -LiteralPath $extensionsDirectory -PathType Container) {
        @(Get-ChildItem -Force -LiteralPath $extensionsDirectory).Count
    }
    else {
        0
    }

    $chromeDirectory = Join-Path $canonicalProfile "chrome"
    $chromeCustomizationCount = if (Test-Path -LiteralPath $chromeDirectory -PathType Container) {
        @(Get-ChildItem -Force -LiteralPath $chromeDirectory).Count
    }
    else {
        0
    }

    return [pscustomobject]@{
        HasUnexpectedProfileContent = $extensionFileCount -gt 0 -or $chromeCustomizationCount -gt 0
        ExtensionDirectoryEntryCount = $extensionFileCount
        ChromeCustomizationEntryCount = $chromeCustomizationCount
    }
}

function Get-MfsProjectCommit {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $ProjectRoot
    )

    if ($null -eq (Get-Command git -ErrorAction SilentlyContinue)) {
        return "unknown"
    }

    $commit = (& git -C $ProjectRoot rev-parse HEAD 2>$null).Trim()
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($commit)) {
        return $commit
    }

    return "unknown"
}

function Get-MfsFirefoxEnvironmentRecord {
    [CmdletBinding()]
    param(
        [string] $FirefoxPath,

        [string] $ProfilePath,

        [Parameter(Mandatory)]
        [string] $ProjectRoot,

        [switch] $RevealPaths
    )

    $canonicalProfile = Assert-MfsProfilePathSafe -ProfilePath $ProfilePath
    $firefox = Get-MfsFirefoxDetails -FirefoxPath (Get-MfsFirefoxExecutable -FirefoxPath $FirefoxPath)
    $profileStatus = Test-MfsFirefoxDevProfile -ProfilePath $canonicalProfile
    $autoConfig = Get-MfsAutoConfigAudit -ProgramRoot $firefox.ProgramRoot
    $policyAudit = Get-MfsFirefoxPolicyAudit -ProgramRoot $firefox.ProgramRoot
    $profileAudit = Get-MfsProfileContaminationAudit -ProfilePath $canonicalProfile
    $windows = Get-ItemProperty -LiteralPath "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion"
    $displayVersion = if (-not [string]::IsNullOrWhiteSpace($windows.DisplayVersion)) { $windows.DisplayVersion } else { "unknown" }
    $build = "$($windows.CurrentBuildNumber).$($windows.UBR)"

    $displayExecutable = if ($RevealPaths) { $firefox.Executable } else { "<FIREFOX_PROGRAM>\firefox.exe" }
    $displayProfile = if ($RevealPaths) { $canonicalProfile } else { "<MFS_DEV_PROFILE>" }
    $launchCommand = "& `"$displayExecutable`" --no-remote --new-instance --profile `"$displayProfile`""
    $autoConfigState = if ($autoConfig.HasDeclarations) {
        "detected in " + (($autoConfig.DeclarationFiles | Sort-Object) -join ", ")
    }
    else {
        "none detected"
    }
    $policyState = if ($policyAudit.HasPolicySource) { "detected" } else { "none detected" }
    $profileContentState = if ($profileAudit.HasUnexpectedProfileContent) { "detected" } else { "none detected" }

    $lines = @(
        "## Environment",
        "",
        "- Recorded at (UTC): $((Get-Date).ToUniversalTime().ToString("o"))",
        "- Firefox version: $($firefox.Version)",
        "- Firefox build ID: $($firefox.BuildID)",
        "- Channel: $($firefox.Channel)",
        "- Firefox source stamp: $($firefox.SourceStamp)",
        "- Operating system: Windows $displayVersion (build $build)",
        "- Firefox executable: $displayExecutable",
        "- Profile: dedicated direct-path development profile ($displayProfile)",
        "- Profile helper state: $(if ($profileStatus.IsValid) { "valid" } else { "invalid or not initialized" })",
        "- Project commit: $(Get-MfsProjectCommit -ProjectRoot $ProjectRoot)",
        "- AutoConfig declarations in Firefox program defaults: $autoConfigState",
        "- Firefox enterprise-policy sources: $policyState",
        "- Profile-installed add-ons or chrome customizations: $profileContentState",
        "- Launch command: $launchCommand",
        "- Browser Console verification: not recorded by this command",
        "- Browser Toolbox browser.xhtml verification: not recorded by this command"
    )

    if ($RevealPaths) {
        $lines += "- Path disclosure: local-only output; redact before sharing"
    }
    else {
        $lines += "- Path disclosure: redacted for issue and pull-request sharing"
    }

    return $lines -join [Environment]::NewLine
}

function Start-MfsFirefoxDevProfile {
    [CmdletBinding()]
    param(
        [string] $FirefoxPath,

        [string] $ProfilePath,

        [ValidateSet("about:blank", "about:profiles", "about:support")]
        [string] $Page = "about:blank",

        [switch] $BrowserConsole,

        [switch] $BrowserToolbox,

        [switch] $SecondWindow,

        [switch] $PrivateWindow
    )

    if ($PrivateWindow -and $SecondWindow) {
        throw "SecondWindow and PrivateWindow are separate smoke-test modes and cannot be combined."
    }

    $profileStatus = Test-MfsFirefoxDevProfile -ProfilePath $ProfilePath
    if (-not $profileStatus.IsValid) {
        throw "The managed development profile is not valid. Run Initialize before Launch."
    }
    if (Test-MfsProfileInUse -ProfilePath $profileStatus.ProfilePath) {
        throw "The managed development profile is already running. Use that window or close it before launching again."
    }

    $canonicalFirefox = Get-MfsFirefoxExecutable -FirefoxPath $FirefoxPath
    $quotedProfile = '"' + $profileStatus.ProfilePath.Replace('"', '\"') + '"'
    $arguments = @("--no-remote", "--new-instance", "--profile", $quotedProfile)
    if ($BrowserConsole) {
        $arguments += "--jsconsole"
    }
    if ($BrowserToolbox) {
        $arguments += "--jsdebugger"
    }
    if ($PrivateWindow) {
        $arguments += @("--private-window", $Page)
    }
    else {
        $arguments += @("--new-window", $Page)
        if ($SecondWindow) {
            $arguments += @("--new-window", "about:blank")
        }
    }

    return Start-Process -FilePath $canonicalFirefox -ArgumentList $arguments -PassThru
}

function Remove-MfsFirefoxDevProfile {
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = "High")]
    param(
        [string] $ProfilePath,

        [switch] $Force
    )

    $canonicalProfile = Assert-MfsProfilePathSafe -ProfilePath $ProfilePath
    if (-not (Test-Path -LiteralPath $canonicalProfile)) {
        return $false
    }
    if (-not (Test-Path -LiteralPath $canonicalProfile -PathType Container)) {
        throw "The managed development-profile target is not a directory."
    }
    Assert-MfsProfileTreeHasNoReparsePoints -ProfilePath $canonicalProfile
    if ($null -eq (Read-MfsProfileMarker -ProfilePath $canonicalProfile)) {
        throw "Refusing to delete a directory without a valid project ownership marker."
    }
    if (Test-MfsProfileInUse -ProfilePath $canonicalProfile) {
        throw "The managed development profile is currently in use. Close it before deletion."
    }
    if (-not $Force -and -not $WhatIfPreference) {
        throw "Profile deletion requires the explicit -Force switch. Run with -WhatIf first."
    }

    if ($PSCmdlet.ShouldProcess("<MFS_DEV_PROFILE>", "Delete the marker-owned disposable Firefox development profile")) {
        Remove-Item -LiteralPath $canonicalProfile -Recurse -Force
        return $true
    }

    return $false
}

Export-ModuleMember -Function @(
    "Get-MfsAutoConfigAudit",
    "Get-MfsDefaultProfilePath",
    "Get-MfsFirefoxDetails",
    "Get-MfsFirefoxEnvironmentRecord",
    "Get-MfsFirefoxExecutable",
    "Get-MfsFirefoxPolicyAudit",
    "Get-MfsProfileContaminationAudit",
    "Initialize-MfsFirefoxDevProfile",
    "Remove-MfsFirefoxDevProfile",
    "Start-MfsFirefoxDevProfile",
    "Test-MfsFirefoxDevProfile"
)
