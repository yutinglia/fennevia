#requires -Version 5.1

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-True {
    param(
        [Parameter(Mandatory)]
        [bool] $Condition,

        [Parameter(Mandatory)]
        [string] $Message
    )

    if (-not $Condition) {
        throw "Assertion failed: $Message"
    }
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$historicalFiles = @(
    "docs/architecture-decisions.md",
    "docs/research/firefox-153-bootstrap.md",
    "docs/research/fennevia-identity-migration.md",
    "tests/project-identity.Tests.ps1"
)
$legacyPatterns = @(
    "my-firefox-shell",
    "myFirefoxShell",
    "MyFirefoxShell",
    "[MFS ",
    "MFS_",
    "data-mfs-",
    ".mfs-",
    "<MFS_",
    "-Mfs"
)

$trackedFiles = @(& git -C $repositoryRoot ls-files)
Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "Tracked files must be available for the identity scan."

$unexpectedLegacyReferences = @()
foreach ($relativePath in $trackedFiles) {
    if ($relativePath -in $historicalFiles) {
        continue
    }

    $fullPath = Join-Path $repositoryRoot $relativePath
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        continue
    }

    $content = [IO.File]::ReadAllText($fullPath)
    foreach ($pattern in $legacyPatterns) {
        if ($content.IndexOf($pattern, [StringComparison]::Ordinal) -ge 0) {
            $unexpectedLegacyReferences += "$relativePath -> $pattern"
        }
    }
}

Assert-True -Condition ($unexpectedLegacyReferences.Count -eq 0) -Message (
    "Legacy identity references must be limited to explicit historical records: " +
    ($unexpectedLegacyReferences -join "; ")
)

$requiredPaths = @(
    "program/defaults/pref/fennevia.js",
    "program/fennevia.cfg",
    "profile/chrome/fennevia/chrome.manifest",
    "profile/chrome/fennevia/content/Bootstrap.sys.mjs",
    "package-manifest.json"
)
foreach ($relativePath in $requiredPaths) {
    Assert-True -Condition (Test-Path -LiteralPath (Join-Path $repositoryRoot $relativePath) -PathType Leaf) -Message "The canonical Fennevia path is missing: $relativePath"
}

$removedPaths = @(
    "spikes/bootstrap/program/defaults/pref/my-firefox-shell.js",
    "spikes/bootstrap/program/my-firefox-shell.cfg",
    "spikes/bootstrap/profile/chrome/my-firefox-shell",
    "spikes/bootstrap/program",
    "spikes/bootstrap/profile",
    "spikes/bootstrap/package-inventory.json"
)
foreach ($relativePath in $removedPaths) {
    Assert-True -Condition (-not (Test-Path -LiteralPath (Join-Path $repositoryRoot $relativePath))) -Message "A legacy bootstrap path is still present: $relativePath"
}

$manifest = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot "profile/chrome/fennevia/chrome.manifest")
$config = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot "program/fennevia.cfg")
Assert-True -Condition ($manifest.Trim() -ceq "content fennevia content/") -Message "The manifest must expose only the Fennevia content package."
Assert-True -Condition ($config.Contains('"chrome://fennevia/content/Bootstrap.sys.mjs"')) -Message "AutoConfig must import the fixed Fennevia Chrome URI."
Assert-True -Condition ($config.Contains('"fennevia.safeStart"')) -Message "AutoConfig must use the Fennevia safe-start preference."
Assert-True -Condition ($config.Contains('"[Fennevia bootstrap]"')) -Message "AutoConfig must use the Fennevia log prefix."

$adr = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot "docs/architecture-decisions.md")
$historicalResearch = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot "docs/research/firefox-153-bootstrap.md")
Assert-True -Condition ($adr.Contains("ADR-017: Adopt the Fennevia project and package identity")) -Message "Historical namespace literals must be superseded by ADR-017."
Assert-True -Condition ($historicalResearch.Contains("Identity note (2026-08-15)")) -Message "The Phase 1 record must explain its legacy identity literals."

Write-Output "PASS: active files use the Fennevia identity and legacy literals are confined to explicit historical records."
