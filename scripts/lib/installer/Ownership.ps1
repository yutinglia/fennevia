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

    $scannerModule = Join-Path $script:InstallerModuleRoot "SecurityChecks.psm1"
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
        $releaseModule = Join-Path $script:InstallerModuleRoot "FenneviaRelease.psm1"
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

    $releaseModule = Join-Path $script:InstallerModuleRoot "FenneviaRelease.psm1"
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
