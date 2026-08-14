Set-StrictMode -Version Latest

$script:MaximumScannableTextBytes = 16MB
$script:TextExtensions = @(
    ".cjs",
    ".css",
    ".html",
    ".js",
    ".json",
    ".manifest",
    ".mjs",
    ".svg",
    ".txt",
    ".xhtml"
)
$script:ExecutableBinaryExtensions = @(".dll", ".exe", ".node", ".wasm")

function ConvertTo-FenneviaCanonicalArtifactPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        throw "A non-empty artifact path is required."
    }

    $expandedPath = [Environment]::ExpandEnvironmentVariables($Path)
    if (-not [IO.Path]::IsPathRooted($expandedPath)) {
        $expandedPath = Join-Path (Get-Location).Path $expandedPath
    }

    $fullPath = [IO.Path]::GetFullPath($expandedPath)
    $pathRoot = [IO.Path]::GetPathRoot($fullPath)
    if ([string]::Equals($fullPath, $pathRoot, [StringComparison]::OrdinalIgnoreCase)) {
        return $pathRoot
    }

    return $fullPath.TrimEnd("\", "/")
}

function Assert-FenneviaArtifactPathHasNoReparseAncestor {
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
                throw "Artifact paths must not contain a reparse-point ancestor."
            }
        }

        if ([string]::Equals($currentPath, $pathRoot, [StringComparison]::OrdinalIgnoreCase)) {
            break
        }

        $currentPath = Split-Path -Parent $currentPath
    }
}

function ConvertTo-FenneviaArtifactRelativePath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $ArtifactRoot,

        [Parameter(Mandatory)]
        [string] $FullPath
    )

    $relativePath = $FullPath.Substring($ArtifactRoot.Length).TrimStart("\", "/")
    return $relativePath.Replace("\", "/")
}

function ConvertTo-FenneviaExpectedArtifactPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        throw "Artifact inventory entries must not be empty."
    }

    $normalizedPath = $Path.Replace("\", "/").Trim("/")
    if (
        [IO.Path]::IsPathRooted($Path) -or
        $normalizedPath -match "(^|/)\.\.?(?:/|$)" -or
        $normalizedPath.Contains(":") -or
        $normalizedPath.Contains("//") -or
        $normalizedPath -notmatch '^[A-Za-z0-9._/-]+$'
    ) {
        throw "Artifact inventory entries must be normalized ASCII relative paths without traversal."
    }

    return $normalizedPath
}

function Test-FenneviaArtifactDisplayPathSafe {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    return $Path -match '^[A-Za-z0-9._/-]+$'
}

function ConvertTo-FenneviaArtifactDisplayPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    if (Test-FenneviaArtifactDisplayPathSafe -Path $Path) {
        return $Path
    }

    return "<UNSAFE_ARTIFACT_PATH>"
}

function New-FenneviaArtifactFinding {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Rule,

        [Parameter(Mandatory)]
        [string] $Path,

        [int] $Line = 0
    )

    return [pscustomobject]@{
        Rule = $Rule
        Path = ConvertTo-FenneviaArtifactDisplayPath -Path $Path
        Line = $Line
    }
}

function Get-FenneviaLineNumberAtIndex {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Content,

        [Parameter(Mandatory)]
        [int] $Index
    )

    if ($Index -le 0) {
        return 1
    }

    return ([regex]::Matches($Content.Substring(0, $Index), "`r`n|`n|`r")).Count + 1
}

function Get-FenneviaArtifactInventory {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $InventoryPath
    )

    $canonicalInventory = ConvertTo-FenneviaCanonicalArtifactPath -Path $InventoryPath
    if (-not (Test-Path -LiteralPath $canonicalInventory -PathType Leaf)) {
        throw "The artifact inventory file does not exist."
    }

    try {
        $inventory = Get-Content -Raw -LiteralPath $canonicalInventory | ConvertFrom-Json
    }
    catch {
        throw "The artifact inventory is not valid JSON."
    }

    if ($null -eq $inventory) {
        throw "The artifact inventory is empty."
    }

    $propertyNames = @($inventory.PSObject.Properties.Name)
    if ($propertyNames -notcontains "schemaVersion" -or $propertyNames -notcontains "expectedFiles") {
        throw "The artifact inventory must contain schemaVersion and expectedFiles."
    }

    try {
        $schemaVersion = [int] $inventory.schemaVersion
    }
    catch {
        throw "The artifact inventory schemaVersion must be an integer."
    }

    if ($schemaVersion -ne 1) {
        throw "The artifact inventory schemaVersion is unsupported."
    }

    $expectedFiles = @($inventory.expectedFiles)
    if ($expectedFiles.Count -eq 0) {
        throw "The artifact inventory must contain at least one expected file."
    }

    $normalizedFiles = @(
        $expectedFiles |
            ForEach-Object { ConvertTo-FenneviaExpectedArtifactPath -Path ([string] $_) } |
            Sort-Object -Unique
    )

    if ($normalizedFiles.Count -ne $expectedFiles.Count) {
        throw "The artifact inventory contains duplicate paths."
    }

    return [pscustomobject]@{
        SchemaVersion = $schemaVersion
        ExpectedFiles = $normalizedFiles
    }
}

function Get-FenneviaArtifactFiles {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $ArtifactRoot,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [Collections.Generic.List[object]] $Findings
    )

    $files = New-Object "Collections.Generic.List[object]"
    $pendingDirectories = New-Object "Collections.Generic.Queue[string]"
    $pendingDirectories.Enqueue($ArtifactRoot)

    while ($pendingDirectories.Count -gt 0) {
        $directory = $pendingDirectories.Dequeue()
        foreach ($child in @(Get-ChildItem -Force -LiteralPath $directory)) {
            $relativePath = ConvertTo-FenneviaArtifactRelativePath -ArtifactRoot $ArtifactRoot -FullPath $child.FullName
            if (-not (Test-FenneviaArtifactDisplayPathSafe -Path $relativePath)) {
                $Findings.Add((New-FenneviaArtifactFinding -Rule "ARTIFACT_UNSAFE_PATH" -Path $relativePath))
            }
            if (($child.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                $Findings.Add((New-FenneviaArtifactFinding -Rule "ARTIFACT_REPARSE_POINT" -Path $relativePath))
                continue
            }

            if ($child.PSIsContainer) {
                $pendingDirectories.Enqueue($child.FullName)
            }
            else {
                $files.Add([pscustomobject]@{
                    Item = $child
                    RelativePath = $relativePath
                })
            }
        }
    }

    return $files.ToArray()
}

function Add-FenneviaPatternFindings {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [AllowEmptyString()]
        [string] $Content,

        [Parameter(Mandatory)]
        [string] $RelativePath,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [Collections.Generic.List[object]] $Findings
    )

    $patterns = @(
        [pscustomobject]@{
            Rule = "ARTIFACT_REMOTE_ENDPOINT"
            Pattern = '(?i)\b(?:https?|wss?):(?:\\?/){2}|(?<![:/])(?:\\?/){2}(?:localhost|127\.0\.0\.1|[a-z0-9.-]+\.[a-z]{2,})(?=[:/\\])'
        },
        [pscustomobject]@{
            Rule = "ARTIFACT_RUNTIME_NETWORK_API"
            Pattern = '(?i)\b(?:fetch|WebSocket|EventSource|XMLHttpRequest|importScripts)\s*\(|navigator\.sendBeacon\s*\('
        },
        [pscustomobject]@{
            Rule = "ARTIFACT_HMR_CLIENT"
            Pattern = '(?i)(?:/@vite/client|/@vite/env|import\.meta\.hot|createHotContext|__VITE_HMR|webpackHotUpdate|module\.hot\b)'
        },
        [pscustomobject]@{
            Rule = "ARTIFACT_DEVELOPMENT_MARKER"
            Pattern = '(?i)(?:import\.meta\.env\.(?:DEV|MODE)|process\.env\.NODE_ENV|__DEV__|localhost|127\.0\.0\.1|debugger\s*;)'
        },
        [pscustomobject]@{
            Rule = "ARTIFACT_SOURCE_MAP_REFERENCE"
            Pattern = '(?i)(?:sourceMappingURL|sourceURL)\s*='
        },
        [pscustomobject]@{
            Rule = "ARTIFACT_DYNAMIC_IMPORT"
            Pattern = '(?i)\bimport\s*\('
        },
        [pscustomobject]@{
            Rule = "ARTIFACT_DYNAMIC_CODE"
            Pattern = '(?i)(?:\beval\s*\(|\bnew\s+Function\s*\()'
        }
    )

    foreach ($definition in $patterns) {
        foreach ($match in [regex]::Matches($Content, $definition.Pattern)) {
            $line = Get-FenneviaLineNumberAtIndex -Content $Content -Index $match.Index
            $Findings.Add((New-FenneviaArtifactFinding -Rule $definition.Rule -Path $RelativePath -Line $line))
        }
    }

    $staticImportPattern = '(?im)\b(?:import|export)\s+(?:[^''"\r\n]*?\s+from\s*)?["''](?<specifier>[^"'']+)["'']'
    foreach ($match in [regex]::Matches($Content, $staticImportPattern)) {
        $specifier = $match.Groups["specifier"].Value
        if (
            -not $specifier.StartsWith(".") -and
            -not $specifier.StartsWith("/") -and
            $specifier -notmatch '^(?i:chrome|resource)://'
        ) {
            $line = Get-FenneviaLineNumberAtIndex -Content $Content -Index $match.Index
            $Findings.Add((New-FenneviaArtifactFinding -Rule "ARTIFACT_BARE_IMPORT" -Path $RelativePath -Line $line))
        }
    }
}

function Test-FenneviaProductionArtifacts {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $ArtifactRoot,

        [Parameter(Mandatory)]
        [string] $InventoryPath
    )

    $canonicalRoot = ConvertTo-FenneviaCanonicalArtifactPath -Path $ArtifactRoot
    if (-not (Test-Path -LiteralPath $canonicalRoot -PathType Container)) {
        throw "The production artifact root does not exist."
    }
    if ([string]::Equals($canonicalRoot, [IO.Path]::GetPathRoot($canonicalRoot), [StringComparison]::OrdinalIgnoreCase)) {
        throw "The production artifact root must not be a filesystem root."
    }

    Assert-FenneviaArtifactPathHasNoReparseAncestor -Path $canonicalRoot

    $inventory = Get-FenneviaArtifactInventory -InventoryPath $InventoryPath
    $findings = New-Object "Collections.Generic.List[object]"
    $artifactFiles = @(Get-FenneviaArtifactFiles -ArtifactRoot $canonicalRoot -Findings $findings)
    $actualPaths = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    $expectedPaths = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)

    foreach ($expectedPath in $inventory.ExpectedFiles) {
        [void] $expectedPaths.Add($expectedPath)
    }

    foreach ($artifactFile in $artifactFiles) {
        [void] $actualPaths.Add($artifactFile.RelativePath)
        if (-not $expectedPaths.Contains($artifactFile.RelativePath)) {
            $findings.Add((New-FenneviaArtifactFinding -Rule "ARTIFACT_UNEXPECTED_FILE" -Path $artifactFile.RelativePath))
        }
    }

    foreach ($expectedPath in $inventory.ExpectedFiles) {
        if (-not $actualPaths.Contains($expectedPath)) {
            $findings.Add((New-FenneviaArtifactFinding -Rule "ARTIFACT_MISSING_FILE" -Path $expectedPath))
        }
    }

    $scannedTextFileCount = 0
    foreach ($artifactFile in $artifactFiles) {
        $relativePath = $artifactFile.RelativePath
        $extension = [IO.Path]::GetExtension($relativePath).ToLowerInvariant()

        if ($relativePath -match '(?i)(^|/)(?:node_modules|src|test|tests|__tests__|coverage)(?:/|$)' -or $extension -in @(".svelte", ".ts", ".tsx")) {
            $findings.Add((New-FenneviaArtifactFinding -Rule "ARTIFACT_DEVELOPMENT_FILE" -Path $relativePath))
        }
        if ($extension -eq ".map") {
            $findings.Add((New-FenneviaArtifactFinding -Rule "ARTIFACT_SOURCE_MAP_FILE" -Path $relativePath))
        }
        if ($extension -in $script:ExecutableBinaryExtensions) {
            $findings.Add((New-FenneviaArtifactFinding -Rule "ARTIFACT_EXECUTABLE_BINARY" -Path $relativePath))
        }
        if ($extension -notin $script:TextExtensions) {
            continue
        }
        if ($artifactFile.Item.Length -gt $script:MaximumScannableTextBytes) {
            $findings.Add((New-FenneviaArtifactFinding -Rule "ARTIFACT_TEXT_FILE_TOO_LARGE" -Path $relativePath))
            continue
        }

        try {
            $content = Get-Content -Raw -LiteralPath $artifactFile.Item.FullName
        }
        catch {
            $findings.Add((New-FenneviaArtifactFinding -Rule "ARTIFACT_TEXT_READ_FAILED" -Path $relativePath))
            continue
        }

        $scannedTextFileCount += 1
        Add-FenneviaPatternFindings -Content $content -RelativePath $relativePath -Findings $findings
    }

    $orderedFindings = @(
        $findings |
            Sort-Object Path, Line, Rule -Unique
    )

    return [pscustomobject]@{
        SchemaVersion = 1
        Passed = $orderedFindings.Count -eq 0
        ArtifactRoot = "<ARTIFACT_ROOT>"
        ExpectedFileCount = $inventory.ExpectedFiles.Count
        DiscoveredFileCount = $artifactFiles.Count
        ScannedTextFileCount = $scannedTextFileCount
        Findings = $orderedFindings
    }
}

Export-ModuleMember -Function "Test-FenneviaProductionArtifacts"
