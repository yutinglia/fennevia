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
