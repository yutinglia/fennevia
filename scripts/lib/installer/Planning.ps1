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
