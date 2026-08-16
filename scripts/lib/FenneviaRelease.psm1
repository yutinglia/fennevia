# SPDX-License-Identifier: MPL-2.0

Set-StrictMode -Version Latest

$script:ReleaseSchemaVersion = 1
$script:ReleasePackageId = "fennevia"
$script:ReleaseLicense = "MPL-2.0"
$script:ReleaseRepository = "https://github.com/yutinglia/fennevia"
$script:ReleaseFixedTimestamp = New-Object DateTimeOffset(1980, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
$script:ReleaseTextExtensions = @(
    ".cfg",
    ".css",
    ".html",
    ".js",
    ".json",
    ".manifest",
    ".md",
    ".mjs",
    ".ps1",
    ".psm1",
    ".txt",
    ".xhtml"
)

function Write-FenneviaReleaseUtf8NoBom {
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

function ConvertTo-FenneviaReleaseCanonicalPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        throw "A non-empty absolute path is required."
    }
    $expandedPath = [Environment]::ExpandEnvironmentVariables($Path)
    if (-not [IO.Path]::IsPathRooted($expandedPath) -or $expandedPath.IndexOfAny([char[]] "*?") -ge 0) {
        throw "Release paths must be explicit absolute paths without wildcards."
    }
    try {
        $fullPath = [IO.Path]::GetFullPath($expandedPath)
    }
    catch {
        throw "A release path could not be canonicalized."
    }
    $pathRoot = [IO.Path]::GetPathRoot($fullPath)
    if ([string]::Equals($fullPath, $pathRoot, [StringComparison]::OrdinalIgnoreCase)) {
        return $pathRoot
    }
    return $fullPath.TrimEnd("\", "/")
}

function Test-FenneviaReleasePathWithin {
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

function Assert-FenneviaReleaseNoReparseAncestor {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    $currentPath = $Path
    $pathRoot = [IO.Path]::GetPathRoot($Path)
    while (-not [string]::IsNullOrWhiteSpace($currentPath)) {
        if (Test-Path -LiteralPath $currentPath) {
            $item = Get-Item -Force -LiteralPath $currentPath
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Release paths must not contain a reparse-point ancestor."
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

function ConvertTo-FenneviaReleaseRelativePath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        throw "Release-relative paths must not be empty."
    }
    $normalizedPath = $Path.Replace("\", "/").Trim("/")
    if (
        [IO.Path]::IsPathRooted($Path) -or
        $normalizedPath -match "(^|/)\.\.?(?:/|$)" -or
        $normalizedPath.Contains(":") -or
        $normalizedPath.Contains("//") -or
        $normalizedPath -notmatch "^[A-Za-z0-9._/-]+$"
    ) {
        throw "Release-relative paths must be normalized ASCII paths without traversal or alternate data streams."
    }
    return $normalizedPath
}

function Join-FenneviaReleaseRootPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Root,

        [Parameter(Mandatory)]
        [string] $RelativePath
    )

    $normalizedPath = ConvertTo-FenneviaReleaseRelativePath -Path $RelativePath
    $nativePath = $normalizedPath.Replace("/", [IO.Path]::DirectorySeparatorChar)
    $fullPath = ConvertTo-FenneviaReleaseCanonicalPath -Path (Join-Path $Root $nativePath)
    if (-not (Test-FenneviaReleasePathWithin -ChildPath $fullPath -ParentPath $Root)) {
        throw "A release-relative path escaped its selected root."
    }
    return $fullPath
}

function Get-FenneviaReleaseSha256 {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Test-FenneviaReleaseChecksum {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $ArchivePath,

        [Parameter(Mandatory)]
        [string] $ChecksumPath
    )

    $canonicalArchive = ConvertTo-FenneviaReleaseCanonicalPath -Path $ArchivePath
    $canonicalChecksum = ConvertTo-FenneviaReleaseCanonicalPath -Path $ChecksumPath
    if (
        -not (Test-Path -LiteralPath $canonicalArchive -PathType Leaf) -or
        -not (Test-Path -LiteralPath $canonicalChecksum -PathType Leaf)
    ) {
        throw "The release archive or checksum file is missing."
    }
    Assert-FenneviaReleaseNoReparseAncestor -Path $canonicalArchive
    Assert-FenneviaReleaseNoReparseAncestor -Path $canonicalChecksum
    $checksumText = Get-Content -Raw -LiteralPath $canonicalChecksum
    if ($checksumText -cnotmatch "^(?<hash>[0-9a-f]{64})  (?<name>[A-Za-z0-9._-]+\.zip)\r?\n?$") {
        throw "The release checksum file has an invalid format."
    }
    $archiveName = [IO.Path]::GetFileName($canonicalArchive)
    $expectedHash = $Matches["hash"]
    if ($Matches["name"] -cne $archiveName) {
        throw "The release checksum names a different archive."
    }
    $actualHash = Get-FenneviaReleaseSha256 -Path $canonicalArchive
    if ($actualHash -cne $expectedHash) {
        throw "The release archive does not match its SHA-256 checksum."
    }
    return [pscustomobject]@{
        Passed = $true
        Archive = $archiveName
        Sha256 = $actualHash
    }
}

function Assert-FenneviaReleaseHash {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Hash
    )

    if ($Hash -cnotmatch "^[0-9a-f]{64}$") {
        throw "A release SHA-256 value is invalid."
    }
}

function Assert-FenneviaReleaseExactProperties {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $InputObject,

        [Parameter(Mandatory)]
        [string[]] $Properties,

        [Parameter(Mandatory)]
        [string] $Description
    )

    if ($null -eq $InputObject) {
        throw "$Description is empty."
    }
    $actual = @($InputObject.PSObject.Properties.Name | Sort-Object)
    $expected = @($Properties | Sort-Object)
    if ($actual.Count -ne $expected.Count) {
        throw "$Description contains unsupported or missing properties."
    }
    for ($index = 0; $index -lt $actual.Count; $index++) {
        if ($actual[$index] -cne $expected[$index]) {
            throw "$Description contains unsupported or missing properties."
        }
    }
}

function Read-FenneviaReleaseJson {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path,

        [Parameter(Mandatory)]
        [string] $Description
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "$Description is missing."
    }
    Assert-FenneviaReleaseNoReparseAncestor -Path $Path
    try {
        $value = Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
    }
    catch {
        throw "$Description is not valid JSON."
    }
    if ($null -eq $value) {
        throw "$Description is empty."
    }
    return $value
}

function Test-FenneviaReleaseVersion {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Version
    )

    return $Version -cmatch "^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-(?:alpha|beta|rc)\.(?:0|[1-9][0-9]*))?$"
}

function Get-FenneviaReleasePackageVersion {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $RepositoryRoot
    )

    $packagePath = Join-FenneviaReleaseRootPath -Root $RepositoryRoot -RelativePath "package.json"
    $package = Read-FenneviaReleaseJson -Path $packagePath -Description "package.json"
    $version = [string] $package.version
    if (-not (Test-FenneviaReleaseVersion -Version $version)) {
        throw "package.json must contain a stable or alpha/beta/rc release version without build metadata."
    }
    return $version
}

function Get-FenneviaReleaseSourceCommit {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $RepositoryRoot,

        [string] $SourceCommit = "",

        [switch] $TestAllowDirtySource
    )

    $gitOutput = @(& git -C $RepositoryRoot rev-parse HEAD 2>$null)
    if ($LASTEXITCODE -ne 0 -or $gitOutput.Count -ne 1) {
        throw "The source commit could not be resolved from Git."
    }
    $headCommit = ([string] $gitOutput[0]).Trim().ToLowerInvariant()
    if ($headCommit -cnotmatch "^[0-9a-f]{40}$") {
        throw "Git did not return a complete source commit."
    }

    $commit = $SourceCommit.Trim().ToLowerInvariant()
    if ([string]::IsNullOrWhiteSpace($commit)) {
        $commit = $headCommit
    }
    if ($commit -cnotmatch "^[0-9a-f]{40}$") {
        throw "The source commit must be a complete 40-character Git object ID."
    }
    if (-not $TestAllowDirtySource -and $commit -cne $headCommit) {
        throw "The requested source commit does not match the checked-out Git HEAD."
    }
    if (-not $TestAllowDirtySource) {
        $status = @(& git -C $RepositoryRoot status --porcelain=v1 --untracked-files=all 2>$null)
        if ($LASTEXITCODE -ne 0) {
            throw "The source working-tree state could not be read from Git."
        }
        if (@($status | Where-Object { -not [string]::IsNullOrWhiteSpace([string] $_) }).Count -ne 0) {
            throw "Release staging requires a clean Git working tree."
        }
    }
    return $commit
}

function Get-FenneviaReleaseConfiguration {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $RepositoryRoot
    )

    $configPath = Join-FenneviaReleaseRootPath -Root $RepositoryRoot -RelativePath "release/release-config.json"
    $config = Read-FenneviaReleaseJson -Path $configPath -Description "The release configuration"
    Assert-FenneviaReleaseExactProperties -InputObject $config -Properties @(
        "schemaVersion",
        "packageId",
        "sourceRepository",
        "supportedOperatingSystems",
        "testedArchitecture",
        "firefoxCompatibility",
        "compatibilityRecord",
        "knownLimitations"
    ) -Description "The release configuration"

    if (
        [int] $config.schemaVersion -ne $script:ReleaseSchemaVersion -or
        [string] $config.packageId -cne $script:ReleasePackageId -or
        [string] $config.sourceRepository -cne $script:ReleaseRepository
    ) {
        throw "The release configuration identity is unsupported."
    }
    $platforms = @($config.supportedOperatingSystems)
    if ($platforms.Count -ne 1 -or [string] $platforms[0] -cne "windows" -or [string] $config.testedArchitecture -cne "x64") {
        throw "The first release configuration must explicitly target only Windows x64."
    }
    $compatibility = @($config.firefoxCompatibility)
    if ($compatibility.Count -eq 0) {
        throw "The release configuration must contain at least one exact Firefox compatibility record."
    }
    $compatibilityKeys = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::Ordinal)
    foreach ($record in $compatibility) {
        Assert-FenneviaReleaseExactProperties -InputObject $record -Properties @("version", "buildId", "channel") -Description "A Firefox compatibility record"
        $version = [string] $record.version
        $buildId = [string] $record.buildId
        $channel = [string] $record.channel
        if ($version -cnotmatch "^[0-9]+(?:\.[0-9]+){1,3}$" -or $buildId -cnotmatch "^[0-9]{14}$" -or $channel -cne "release") {
            throw "A Firefox compatibility record must identify an exact stock release version and BuildID."
        }
        if (-not $compatibilityKeys.Add("$version`:$buildId")) {
            throw "The Firefox compatibility allowlist contains a duplicate record."
        }
    }
    $recordPath = ConvertTo-FenneviaReleaseRelativePath -Path ([string] $config.compatibilityRecord)
    if (-not $recordPath.StartsWith("docs/research/", [StringComparison]::Ordinal) -or -not $recordPath.EndsWith(".md", [StringComparison]::Ordinal)) {
        throw "The compatibility evidence must identify a repository research record."
    }
    $recordSource = Join-FenneviaReleaseRootPath -Root $RepositoryRoot -RelativePath $recordPath
    if (-not (Test-Path -LiteralPath $recordSource -PathType Leaf)) {
        throw "The compatibility evidence record is missing from the source tree."
    }
    $limitations = @($config.knownLimitations)
    if ($limitations.Count -eq 0 -or @($limitations | Where-Object { [string]::IsNullOrWhiteSpace([string] $_) }).Count -gt 0) {
        throw "The release configuration must state its known limitations."
    }
    return $config
}

function Get-FenneviaReleaseSourceEntries {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $RepositoryRoot,

        [Parameter(Mandatory)]
        [object] $PackageManifest
    )

    $entries = New-Object "Collections.Generic.List[object]"
    foreach ($mapping in @(
        [pscustomobject]@{ Source = "package-manifest.json"; Destination = "package-manifest.json" },
        [pscustomobject]@{ Source = "release/INSTALL.md"; Destination = "INSTALL.md" },
        [pscustomobject]@{ Source = "LICENSE"; Destination = "LICENSE" },
        [pscustomobject]@{ Source = "THIRD_PARTY_NOTICES.md"; Destination = "THIRD_PARTY_NOTICES.md" },
        [pscustomobject]@{ Source = "scripts/fennevia.ps1"; Destination = "scripts/fennevia.ps1" },
        [pscustomobject]@{ Source = "scripts/fennevia-package.ps1"; Destination = "scripts/fennevia-package.ps1" },
        [pscustomobject]@{ Source = "scripts/verify-release.ps1"; Destination = "scripts/verify-release.ps1" },
        [pscustomobject]@{ Source = "scripts/lib/FenneviaConsole.psm1"; Destination = "scripts/lib/FenneviaConsole.psm1" },
        [pscustomobject]@{ Source = "scripts/lib/FenneviaTui.psm1"; Destination = "scripts/lib/FenneviaTui.psm1" },
        [pscustomobject]@{ Source = "scripts/lib/FenneviaInstaller.psm1"; Destination = "scripts/lib/FenneviaInstaller.psm1" },
        [pscustomobject]@{ Source = "scripts/lib/FenneviaRelease.psm1"; Destination = "scripts/lib/FenneviaRelease.psm1" },
        [pscustomobject]@{ Source = "scripts/lib/SecurityChecks.psm1"; Destination = "scripts/lib/SecurityChecks.psm1" }
    )) {
        $sourcePath = Join-FenneviaReleaseRootPath -Root $RepositoryRoot -RelativePath $mapping.Source
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
            throw "A required release source file is missing: $($mapping.Source)"
        }
        Assert-FenneviaReleaseNoReparseAncestor -Path $sourcePath
        $entries.Add([pscustomobject]@{
            SourcePath = $sourcePath
            DestinationPath = ConvertTo-FenneviaReleaseRelativePath -Path $mapping.Destination
        })
    }

    foreach ($file in @($PackageManifest.files)) {
        Assert-FenneviaReleaseExactProperties -InputObject $file -Properties @("scope", "path", "sha256") -Description "A package-manifest file record"
        $scope = [string] $file.scope
        if ($scope -notin @("program", "profile")) {
            throw "The package manifest contains an unsupported file scope."
        }
        $relativePath = ConvertTo-FenneviaReleaseRelativePath -Path ([string] $file.path)
        $destinationPath = "$scope/$relativePath"
        $sourcePath = Join-FenneviaReleaseRootPath -Root $RepositoryRoot -RelativePath $destinationPath
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
            throw "A package-manifest source file is missing."
        }
        Assert-FenneviaReleaseHash -Hash ([string] $file.sha256)
        if ((Get-FenneviaReleaseSha256 -Path $sourcePath) -cne [string] $file.sha256) {
            throw "A package-manifest source file does not match its recorded SHA-256."
        }
        $entries.Add([pscustomobject]@{
            SourcePath = $sourcePath
            DestinationPath = $destinationPath
        })
    }

    $keys = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    foreach ($entry in $entries) {
        if (-not $keys.Add($entry.DestinationPath)) {
            throw "The release source inventory contains duplicate destination paths."
        }
    }
    return @($entries | Sort-Object DestinationPath)
}

function Get-FenneviaReleaseTreeFiles {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $PackageRoot
    )

    $files = New-Object "Collections.Generic.Dictionary[string,object]" ([StringComparer]::Ordinal)
    $pending = New-Object "Collections.Generic.Queue[string]"
    $pending.Enqueue($PackageRoot)
    while ($pending.Count -gt 0) {
        $directory = $pending.Dequeue()
        foreach ($child in @(Get-ChildItem -Force -LiteralPath $directory | Sort-Object Name)) {
            if (($child.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "The release tree contains a reparse point."
            }
            if ($child.PSIsContainer) {
                $pending.Enqueue($child.FullName)
                continue
            }
            $relativePath = $child.FullName.Substring($PackageRoot.Length).TrimStart("\", "/").Replace("\", "/")
            $files.Add($relativePath, [pscustomobject]@{
                Item = $child
                RelativePath = ConvertTo-FenneviaReleaseRelativePath -Path $relativePath
            })
        }
    }
    $orderedPaths = [string[]] @($files.Keys)
    [Array]::Sort($orderedPaths, [StringComparer]::Ordinal)
    return @($orderedPaths | ForEach-Object { $files[$_] })
}

function Assert-FenneviaReleaseTextPolicy {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object[]] $Files
    )

    $credentialNamePattern = '(?i)(^|/)(?:\.env(?:\.|$)|id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?$|credentials?(?:\.json)?$|secrets?(?:\.|$)|[^/]+\.(?:pfx|p12|pem|key)$)'
    $privateKeyPattern = '(?i)-----BEGIN [A-Z0-9 ]*PRIVATE' + ' KEY-----'
    $githubTokenPattern = '(?i)(?:github' + '_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})'
    $patterns = @(
        $privateKeyPattern,
        $githubTokenPattern,
        '(?i)AKIA[0-9A-Z]{16}',
        '(?i)\b[A-Z]:[\\/](?:Users|works)[\\/]'
    )

    foreach ($file in $Files) {
        if ($file.RelativePath -match $credentialNamePattern) {
            throw "The release tree contains a credential-like file name."
        }
        $extension = [IO.Path]::GetExtension($file.RelativePath).ToLowerInvariant()
        if ($extension -notin $script:ReleaseTextExtensions -and $file.RelativePath -notin @("LICENSE")) {
            continue
        }
        if ($file.Item.Length -gt 16MB) {
            throw "A release text file exceeds the scanner size limit."
        }
        try {
            $content = Get-Content -Raw -LiteralPath $file.Item.FullName
        }
        catch {
            throw "A release text file could not be scanned."
        }
        foreach ($pattern in $patterns) {
            if ($content -match $pattern) {
                throw "The release tree contains a high-confidence secret or local-machine path pattern."
            }
        }
    }
}

function Read-FenneviaReleasePackageManifest {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $PackageRoot
    )

    $manifestPath = Join-FenneviaReleaseRootPath -Root $PackageRoot -RelativePath "package-manifest.json"
    $manifest = Read-FenneviaReleaseJson -Path $manifestPath -Description "The package manifest"
    Assert-FenneviaReleaseExactProperties -InputObject $manifest -Properties @(
        "schemaVersion", "packageId", "packageVersion", "expectedFiles", "files"
    ) -Description "The package manifest"
    if ([int] $manifest.schemaVersion -ne 1 -or [string] $manifest.packageId -cne $script:ReleasePackageId) {
        throw "The package manifest identity is unsupported."
    }
    if (-not (Test-FenneviaReleaseVersion -Version ([string] $manifest.packageVersion))) {
        throw "The package manifest does not contain a release version."
    }

    $expectedFiles = @(
        @($manifest.expectedFiles) |
            ForEach-Object { ConvertTo-FenneviaReleaseRelativePath -Path ([string] $_) }
    )
    if ($expectedFiles.Count -eq 0) {
        throw "The package manifest profile inventory is empty."
    }
    $expectedSet = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    foreach ($expectedFile in $expectedFiles) {
        if (-not $expectedSet.Add($expectedFile)) {
            throw "The package manifest profile inventory contains a duplicate path."
        }
    }

    $logicalKeys = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    $profileInventory = New-Object "Collections.Generic.List[string]"
    foreach ($file in @($manifest.files)) {
        Assert-FenneviaReleaseExactProperties -InputObject $file -Properties @("scope", "path", "sha256") -Description "A package-manifest file record"
        $scope = [string] $file.scope
        if ($scope -notin @("program", "profile")) {
            throw "The package manifest contains an unsupported file scope."
        }
        $relativePath = ConvertTo-FenneviaReleaseRelativePath -Path ([string] $file.path)
        $hash = ([string] $file.sha256).ToLowerInvariant()
        Assert-FenneviaReleaseHash -Hash $hash
        if (-not $logicalKeys.Add("$scope`:$relativePath")) {
            throw "The package manifest contains a duplicate install target."
        }
        $sourcePath = Join-FenneviaReleaseRootPath -Root $PackageRoot -RelativePath "$scope/$relativePath"
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf) -or (Get-FenneviaReleaseSha256 -Path $sourcePath) -cne $hash) {
            throw "An installable package file is missing or differs from package-manifest.json."
        }
        if ($scope -eq "profile") {
            if (-not $relativePath.StartsWith("chrome/fennevia/", [StringComparison]::Ordinal)) {
                throw "A profile package path is outside the fixed Fennevia package root."
            }
            $profileInventory.Add($relativePath.Substring("chrome/fennevia/".Length))
        }
    }
    foreach ($requiredKey in @(
        "program:defaults/pref/fennevia.js",
        "program:fennevia.cfg",
        "profile:chrome/fennevia/chrome.manifest",
        "profile:chrome/fennevia/content/Bootstrap.sys.mjs"
    )) {
        if (-not $logicalKeys.Contains($requiredKey)) {
            throw "The package manifest is missing a required bootstrap artifact."
        }
    }
    $sortedExpected = @($expectedFiles | Sort-Object)
    $sortedProfile = @($profileInventory | Sort-Object)
    if ($sortedExpected.Count -ne $sortedProfile.Count) {
        throw "The package manifest profile inventory is inconsistent."
    }
    for ($index = 0; $index -lt $sortedExpected.Count; $index++) {
        if ($sortedExpected[$index] -cne $sortedProfile[$index]) {
            throw "The package manifest profile inventory is inconsistent."
        }
    }
    return $manifest
}

function Test-FenneviaReleaseTree {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $PackageRoot
    )

    $canonicalRoot = ConvertTo-FenneviaReleaseCanonicalPath -Path $PackageRoot
    if (-not (Test-Path -LiteralPath $canonicalRoot -PathType Container)) {
        throw "The release package root does not exist."
    }
    if ([string]::Equals($canonicalRoot, [IO.Path]::GetPathRoot($canonicalRoot), [StringComparison]::OrdinalIgnoreCase)) {
        throw "The release package root must not be a filesystem root."
    }
    Assert-FenneviaReleaseNoReparseAncestor -Path $canonicalRoot

    $releaseManifestPath = Join-FenneviaReleaseRootPath -Root $canonicalRoot -RelativePath "RELEASE-MANIFEST.json"
    $releaseManifest = Read-FenneviaReleaseJson -Path $releaseManifestPath -Description "The release manifest"
    Assert-FenneviaReleaseExactProperties -InputObject $releaseManifest -Properties @(
        "schemaVersion",
        "packageId",
        "license",
        "version",
        "tag",
        "prerelease",
        "source",
        "release",
        "packageManifestSha256",
        "firefoxCompatibility",
        "compatibilityRecord",
        "knownLimitations",
        "files"
    ) -Description "The release manifest"
    if (
        [int] $releaseManifest.schemaVersion -ne $script:ReleaseSchemaVersion -or
        [string] $releaseManifest.packageId -cne $script:ReleasePackageId -or
        [string] $releaseManifest.license -cne $script:ReleaseLicense
    ) {
        throw "The release manifest identity is unsupported."
    }

    $version = [string] $releaseManifest.version
    if (-not (Test-FenneviaReleaseVersion -Version $version) -or [string] $releaseManifest.tag -cne "v$version") {
        throw "The release manifest version and tag are inconsistent."
    }
    $expectedPrerelease = $version.Contains("-")
    if ($releaseManifest.prerelease -isnot [bool] -or [bool] $releaseManifest.prerelease -ne $expectedPrerelease) {
        throw "The release manifest prerelease flag is inconsistent with its version."
    }

    Assert-FenneviaReleaseExactProperties -InputObject $releaseManifest.source -Properties @("repository", "commit", "archive") -Description "The release source record"
    $sourceCommit = [string] $releaseManifest.source.commit
    if (
        [string] $releaseManifest.source.repository -cne $script:ReleaseRepository -or
        $sourceCommit -cnotmatch "^[0-9a-f]{40}$" -or
        [string] $releaseManifest.source.archive -cne "$($script:ReleaseRepository)/archive/refs/tags/v$version.zip"
    ) {
        throw "The release source record is invalid."
    }

    Assert-FenneviaReleaseExactProperties -InputObject $releaseManifest.release -Properties @("archive", "checksum", "platform", "testedArchitecture") -Description "The release artifact record"
    $archiveName = "fennevia-$version-windows.zip"
    if (
        [string] $releaseManifest.release.archive -cne $archiveName -or
        [string] $releaseManifest.release.checksum -cne "$archiveName.sha256" -or
        [string] $releaseManifest.release.platform -cne "windows" -or
        [string] $releaseManifest.release.testedArchitecture -cne "x64"
    ) {
        throw "The release artifact record is invalid."
    }

    $packageManifest = Read-FenneviaReleasePackageManifest -PackageRoot $canonicalRoot
    if ([string] $packageManifest.packageVersion -cne $version) {
        throw "The release and package manifest versions differ."
    }
    $packageManifestHash = Get-FenneviaReleaseSha256 -Path (Join-FenneviaReleaseRootPath -Root $canonicalRoot -RelativePath "package-manifest.json")
    Assert-FenneviaReleaseHash -Hash ([string] $releaseManifest.packageManifestSha256)
    if ([string] $releaseManifest.packageManifestSha256 -cne $packageManifestHash) {
        throw "The release manifest does not match package-manifest.json."
    }

    $compatibility = @($releaseManifest.firefoxCompatibility)
    if ($compatibility.Count -eq 0) {
        throw "The release manifest has no Firefox compatibility record."
    }
    $compatibilityKeys = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::Ordinal)
    foreach ($record in $compatibility) {
        Assert-FenneviaReleaseExactProperties -InputObject $record -Properties @("version", "buildId", "channel") -Description "A release Firefox compatibility record"
        if (
            [string] $record.version -cnotmatch "^[0-9]+(?:\.[0-9]+){1,3}$" -or
            [string] $record.buildId -cnotmatch "^[0-9]{14}$" -or
            [string] $record.channel -cne "release" -or
            -not $compatibilityKeys.Add("$([string] $record.version)`:$([string] $record.buildId)")
        ) {
            throw "A release Firefox compatibility record is invalid or duplicated."
        }
    }
    $compatibilityRecord = ConvertTo-FenneviaReleaseRelativePath -Path ([string] $releaseManifest.compatibilityRecord)
    if (-not $compatibilityRecord.StartsWith("docs/research/", [StringComparison]::Ordinal) -or -not $compatibilityRecord.EndsWith(".md", [StringComparison]::Ordinal)) {
        throw "The release compatibility evidence record is invalid."
    }
    if (@($releaseManifest.knownLimitations).Count -eq 0) {
        throw "The release manifest must state known limitations."
    }

    $expectedStaticPaths = @(
        "INSTALL.md",
        "LICENSE",
        "THIRD_PARTY_NOTICES.md",
        "package-manifest.json",
        "scripts/fennevia.ps1",
        "scripts/fennevia-package.ps1",
        "scripts/verify-release.ps1",
        "scripts/lib/FenneviaConsole.psm1",
        "scripts/lib/FenneviaTui.psm1",
        "scripts/lib/FenneviaInstaller.psm1",
        "scripts/lib/FenneviaRelease.psm1",
        "scripts/lib/SecurityChecks.psm1"
    )
    $expectedPaths = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    foreach ($path in $expectedStaticPaths) {
        [void] $expectedPaths.Add($path)
    }
    foreach ($file in @($packageManifest.files)) {
        $scope = [string] $file.scope
        if ($scope -notin @("program", "profile")) {
            throw "The package manifest contains an unsupported release scope."
        }
        $path = ConvertTo-FenneviaReleaseRelativePath -Path ([string] $file.path)
        if (-not $expectedPaths.Add("$scope/$path")) {
            throw "The package manifest maps duplicate release paths."
        }
    }

    $recordedPaths = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    $recordedFiles = @($releaseManifest.files)
    if ($recordedFiles.Count -ne $expectedPaths.Count) {
        throw "The release manifest file inventory has an unexpected size."
    }
    foreach ($file in $recordedFiles) {
        Assert-FenneviaReleaseExactProperties -InputObject $file -Properties @("path", "sha256", "size") -Description "A release file record"
        $path = ConvertTo-FenneviaReleaseRelativePath -Path ([string] $file.path)
        $hash = ([string] $file.sha256).ToLowerInvariant()
        Assert-FenneviaReleaseHash -Hash $hash
        try {
            $size = [long] $file.size
        }
        catch {
            throw "A release file size is invalid."
        }
        if ($size -lt 0 -or -not $expectedPaths.Contains($path) -or -not $recordedPaths.Add($path)) {
            throw "The release manifest contains an unexpected or duplicate file record."
        }
        $filePath = Join-FenneviaReleaseRootPath -Root $canonicalRoot -RelativePath $path
        if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
            throw "A release manifest file is missing."
        }
        $item = Get-Item -Force -LiteralPath $filePath
        if ($item.Length -ne $size -or (Get-FenneviaReleaseSha256 -Path $filePath) -cne $hash) {
            throw "A release file does not match its recorded size and SHA-256."
        }
    }

    $treeFiles = @(Get-FenneviaReleaseTreeFiles -PackageRoot $canonicalRoot)
    if ($treeFiles.Count -ne ($expectedPaths.Count + 1)) {
        throw "The release tree contains an unexpected or missing file."
    }
    foreach ($file in $treeFiles) {
        if ($file.RelativePath -ceq "RELEASE-MANIFEST.json") {
            continue
        }
        if (-not $recordedPaths.Contains($file.RelativePath)) {
            throw "The release tree contains a file outside the strict inventory."
        }
    }
    Assert-FenneviaReleaseTextPolicy -Files $treeFiles

    return [pscustomobject]@{
        SchemaVersion = $script:ReleaseSchemaVersion
        Passed = $true
        PackageRoot = "<RELEASE_ROOT>"
        Version = $version
        Tag = "v$version"
        ArchiveName = $archiveName
        PackageManifestSha256 = $packageManifestHash
        FileCount = $treeFiles.Count
        Manifest = $releaseManifest
    }
}

function Test-FenneviaReleaseFirefoxCompatibility {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $ReleaseManifest,

        [Parameter(Mandatory)]
        [string] $FirefoxVersion,

        [Parameter(Mandatory)]
        [string] $FirefoxBuildId
    )

    foreach ($record in @($ReleaseManifest.firefoxCompatibility)) {
        if (
            [string] $record.version -ceq $FirefoxVersion -and
            [string] $record.buildId -ceq $FirefoxBuildId -and
            [string] $record.channel -ceq "release"
        ) {
            return $true
        }
    }
    return $false
}

function New-FenneviaDeterministicZip {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $PackageRoot,

        [Parameter(Mandatory)]
        [string] $ArchivePath
    )

    Add-Type -AssemblyName System.IO.Compression
    $archiveParent = Split-Path -Parent $ArchivePath
    if (-not (Test-Path -LiteralPath $archiveParent -PathType Container)) {
        throw "The release archive parent directory does not exist."
    }
    if (Test-Path -LiteralPath $ArchivePath) {
        throw "The release archive destination already exists."
    }

    $treeName = Split-Path -Leaf $PackageRoot
    $files = @(Get-FenneviaReleaseTreeFiles -PackageRoot $PackageRoot)
    $entryRecords = @(
        $files |
            ForEach-Object {
                [pscustomobject]@{
                    SourcePath = $_.Item.FullName
                    EntryName = "$treeName/$($_.RelativePath)"
                }
            }
    )
    $fileStream = New-Object IO.FileStream(
        $ArchivePath,
        [IO.FileMode]::CreateNew,
        [IO.FileAccess]::ReadWrite,
        [IO.FileShare]::None
    )
    $archive = $null
    try {
        $archive = New-Object IO.Compression.ZipArchive(
            $fileStream,
            [IO.Compression.ZipArchiveMode]::Create,
            $false,
            [Text.Encoding]::UTF8
        )
        foreach ($record in $entryRecords) {
            $entry = $archive.CreateEntry($record.EntryName, [IO.Compression.CompressionLevel]::NoCompression)
            $entry.LastWriteTime = $script:ReleaseFixedTimestamp
            $sourceStream = New-Object IO.FileStream(
                $record.SourcePath,
                [IO.FileMode]::Open,
                [IO.FileAccess]::Read,
                [IO.FileShare]::Read
            )
            $entryStream = $null
            try {
                $entryStream = $entry.Open()
                $sourceStream.CopyTo($entryStream)
            }
            finally {
                if ($null -ne $entryStream) {
                    $entryStream.Dispose()
                }
                $sourceStream.Dispose()
            }
        }
    }
    finally {
        if ($null -ne $archive) {
            $archive.Dispose()
        }
        $fileStream.Dispose()
    }
}

function New-FenneviaReleaseArtifacts {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $RepositoryRoot,

        [Parameter(Mandatory)]
        [string] $OutputDirectory,

        [string] $SourceCommit = "",

        [string] $ExpectedTag = "",

        [switch] $TestAllowDirtySource
    )

    $canonicalRepository = ConvertTo-FenneviaReleaseCanonicalPath -Path $RepositoryRoot
    if (-not (Test-Path -LiteralPath $canonicalRepository -PathType Container)) {
        throw "The release source repository does not exist."
    }
    Assert-FenneviaReleaseNoReparseAncestor -Path $canonicalRepository

    $version = Get-FenneviaReleasePackageVersion -RepositoryRoot $canonicalRepository
    $tag = "v$version"
    if (-not [string]::IsNullOrWhiteSpace($ExpectedTag) -and $ExpectedTag -cne $tag) {
        throw "The requested release tag does not match package.json."
    }
    $commit = Get-FenneviaReleaseSourceCommit `
        -RepositoryRoot $canonicalRepository `
        -SourceCommit $SourceCommit `
        -TestAllowDirtySource:$TestAllowDirtySource
    $config = Get-FenneviaReleaseConfiguration -RepositoryRoot $canonicalRepository
    $packageManifest = Read-FenneviaReleasePackageManifest -PackageRoot $canonicalRepository
    if (
        [int] $packageManifest.schemaVersion -ne 1 -or
        [string] $packageManifest.packageId -cne $script:ReleasePackageId -or
        [string] $packageManifest.packageVersion -cne $version
    ) {
        throw "The source package manifest is not synchronized with the release version."
    }

    $canonicalOutput = ConvertTo-FenneviaReleaseCanonicalPath -Path $OutputDirectory
    if ([string]::Equals($canonicalOutput, [IO.Path]::GetPathRoot($canonicalOutput), [StringComparison]::OrdinalIgnoreCase)) {
        throw "The release output directory must not be a filesystem root."
    }
    Assert-FenneviaReleaseNoReparseAncestor -Path $canonicalOutput
    if (Test-Path -LiteralPath $canonicalOutput) {
        if (-not (Test-Path -LiteralPath $canonicalOutput -PathType Container)) {
            throw "The release output destination is not a directory."
        }
        if (@(Get-ChildItem -Force -LiteralPath $canonicalOutput).Count -ne 0) {
            throw "The release output directory must be empty to prevent stale artifact publication."
        }
    }
    else {
        New-Item -ItemType Directory -Path $canonicalOutput | Out-Null
    }

    $treeName = "fennevia-$version"
    $treeRoot = Join-Path $canonicalOutput $treeName
    New-Item -ItemType Directory -Path $treeRoot | Out-Null
    $entries = @(Get-FenneviaReleaseSourceEntries -RepositoryRoot $canonicalRepository -PackageManifest $packageManifest)
    foreach ($entry in $entries) {
        $destinationPath = Join-FenneviaReleaseRootPath -Root $treeRoot -RelativePath $entry.DestinationPath
        $destinationParent = Split-Path -Parent $destinationPath
        if (-not (Test-Path -LiteralPath $destinationParent -PathType Container)) {
            New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
        }
        Copy-Item -LiteralPath $entry.SourcePath -Destination $destinationPath
    }

    $releaseFiles = @(
        Get-FenneviaReleaseTreeFiles -PackageRoot $treeRoot |
            ForEach-Object {
                [ordered]@{
                    path = $_.RelativePath
                    sha256 = Get-FenneviaReleaseSha256 -Path $_.Item.FullName
                    size = [long] $_.Item.Length
                }
            }
    )
    $archiveName = "fennevia-$version-windows.zip"
    $manifest = [ordered]@{
        schemaVersion = $script:ReleaseSchemaVersion
        packageId = $script:ReleasePackageId
        license = $script:ReleaseLicense
        version = $version
        tag = $tag
        prerelease = $version.Contains("-")
        source = [ordered]@{
            repository = $script:ReleaseRepository
            commit = $commit
            archive = "$($script:ReleaseRepository)/archive/refs/tags/$tag.zip"
        }
        release = [ordered]@{
            archive = $archiveName
            checksum = "$archiveName.sha256"
            platform = "windows"
            testedArchitecture = [string] $config.testedArchitecture
        }
        packageManifestSha256 = Get-FenneviaReleaseSha256 -Path (Join-FenneviaReleaseRootPath -Root $treeRoot -RelativePath "package-manifest.json")
        firefoxCompatibility = @(
            @($config.firefoxCompatibility) |
                ForEach-Object {
                    [ordered]@{
                        version = [string] $_.version
                        buildId = [string] $_.buildId
                        channel = [string] $_.channel
                    }
                }
        )
        compatibilityRecord = [string] $config.compatibilityRecord
        knownLimitations = @($config.knownLimitations | ForEach-Object { [string] $_ })
        files = $releaseFiles
    }
    $releaseManifestPath = Join-FenneviaReleaseRootPath -Root $treeRoot -RelativePath "RELEASE-MANIFEST.json"
    Write-FenneviaReleaseUtf8NoBom -Path $releaseManifestPath -Content (($manifest | ConvertTo-Json -Depth 10) + "`n")
    $validation = Test-FenneviaReleaseTree -PackageRoot $treeRoot

    $archivePath = Join-Path $canonicalOutput $archiveName
    New-FenneviaDeterministicZip -PackageRoot $treeRoot -ArchivePath $archivePath
    $archiveHash = Get-FenneviaReleaseSha256 -Path $archivePath
    $checksumPath = "$archivePath.sha256"
    Write-FenneviaReleaseUtf8NoBom -Path $checksumPath -Content "$archiveHash  $archiveName`n"
    [void] (Test-FenneviaReleaseChecksum -ArchivePath $archivePath -ChecksumPath $checksumPath)

    return [pscustomobject]@{
        SchemaVersion = $script:ReleaseSchemaVersion
        Version = $version
        Tag = $tag
        Prerelease = $version.Contains("-")
        SourceCommit = $commit
        PackageRoot = $treeRoot
        ManifestPath = $releaseManifestPath
        ArchivePath = $archivePath
        ArchiveName = $archiveName
        ArchiveSha256 = $archiveHash
        ChecksumPath = $checksumPath
        FileCount = $validation.FileCount
    }
}

Export-ModuleMember -Function @(
    "New-FenneviaReleaseArtifacts",
    "Test-FenneviaReleaseChecksum",
    "Test-FenneviaReleaseFirefoxCompatibility",
    "Test-FenneviaReleaseTree"
)
