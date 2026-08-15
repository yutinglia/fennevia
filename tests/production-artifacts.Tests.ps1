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

function Assert-Throws {
    param(
        [Parameter(Mandatory)]
        [scriptblock] $Operation,

        [Parameter(Mandatory)]
        [string] $Message
    )

    $didThrow = $false
    try {
        & $Operation
    }
    catch {
        $didThrow = $true
    }

    if (-not $didThrow) {
        throw "Assertion failed: $Message"
    }
}

function Write-TestFile {
    param(
        [Parameter(Mandatory)]
        [string] $Path,

        [Parameter(Mandatory)]
        [string] $Content
    )

    $parent = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    [IO.File]::WriteAllText($Path, $Content, (New-Object Text.UTF8Encoding($false)))
}

function Write-Inventory {
    param(
        [Parameter(Mandatory)]
        [string] $Path,

        [Parameter(Mandatory)]
        [string[]] $ExpectedFiles
    )

    $inventory = [ordered]@{
        schemaVersion = 1
        expectedFiles = $ExpectedFiles
    }
    Write-TestFile -Path $Path -Content (($inventory | ConvertTo-Json) + [Environment]::NewLine)
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$modulePath = Join-Path $repositoryRoot "scripts\lib\SecurityChecks.psm1"
$commandPath = Join-Path $repositoryRoot "scripts\check-production-artifacts.ps1"
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ("fennevia-artifact-tests-" + [guid]::NewGuid().ToString("N"))
$canonicalTempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd("\", "/")
$canonicalTestRoot = [IO.Path]::GetFullPath($testRoot).TrimEnd("\", "/")

if (-not $canonicalTestRoot.StartsWith($canonicalTempRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "The test cleanup target did not resolve below the operating-system temporary directory."
}

New-Item -ItemType Directory -Path $testRoot -Force | Out-Null

try {
    Import-Module $modulePath -Force

    $safeRoot = Join-Path $testRoot "safe"
    $safeInventory = Join-Path $testRoot "safe-inventory.json"
    Write-TestFile -Path (Join-Path $safeRoot "runtime\main.mjs") -Content 'import "./local.mjs"; export const state = "ready";'
    Write-TestFile -Path (Join-Path $safeRoot "runtime\local.mjs") -Content @'
export const local = true;
export const xhtmlNamespace = "http://www.w3.org/1999/xhtml";
export const xulNamespace = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
'@
    Write-TestFile -Path (Join-Path $safeRoot "shell\shell.css") -Content '.fennevia-shell { display: block; }'
    Write-Inventory -Path $safeInventory -ExpectedFiles @("runtime/main.mjs", "runtime/local.mjs", "shell/shell.css")

    $safeResult = Test-FenneviaProductionArtifacts -ArtifactRoot $safeRoot -InventoryPath $safeInventory
    Assert-True -Condition $safeResult.Passed -Message "A self-contained artifact set should pass."
    Assert-True -Condition ($safeResult.Findings.Count -eq 0) -Message "A passing artifact set should have no findings."

    $namespaceSuffixRoot = Join-Path $testRoot "namespace-suffix"
    $namespaceSuffixInventory = Join-Path $testRoot "namespace-suffix-inventory.json"
    Write-TestFile -Path (Join-Path $namespaceSuffixRoot "main.mjs") -Content 'export const endpoint = "http://www.w3.org/1999/xhtml?remote=true";'
    Write-Inventory -Path $namespaceSuffixInventory -ExpectedFiles @("main.mjs")
    $namespaceSuffixResult = Test-FenneviaProductionArtifacts -ArtifactRoot $namespaceSuffixRoot -InventoryPath $namespaceSuffixInventory
    Assert-True -Condition ($namespaceSuffixResult.Findings.Rule -contains "ARTIFACT_REMOTE_ENDPOINT") -Message "A namespace-looking URL with any suffix must remain blocked."

    $unsafeRoot = Join-Path $testRoot "unsafe"
    $unsafeInventory = Join-Path $testRoot "unsafe-inventory.json"
    $unsafeContent = @'
import "bare-package";
import "node:fs";
if (import.meta.hot) { import.meta.hot.accept(); }
const chunk = import("./chunk.js");
fetch("https://example.invalid/runtime.js");
eval("privilegedCode()");
debugger;
//# sourceMappingURL=main.js.map
'@
    Write-TestFile -Path (Join-Path $unsafeRoot "main.mjs") -Content $unsafeContent
    Write-TestFile -Path (Join-Path $unsafeRoot "chunk.js") -Content 'export const chunk = true;'
    Write-TestFile -Path (Join-Path $unsafeRoot "main.js.map") -Content '{"version":3}'
    Write-TestFile -Path (Join-Path $unsafeRoot "native.node") -Content 'not a production runtime binary'
    Write-TestFile -Path (Join-Path $unsafeRoot "src\leaked.ts") -Content 'export const source = true;'
    Write-TestFile -Path (Join-Path $unsafeRoot "secret value.js") -Content 'export const unexpected = true;'
    Write-Inventory -Path $unsafeInventory -ExpectedFiles @("main.mjs", "missing.css")

    $unsafeResult = Test-FenneviaProductionArtifacts -ArtifactRoot $unsafeRoot -InventoryPath $unsafeInventory
    $unsafeRules = @($unsafeResult.Findings.Rule | Sort-Object -Unique)
    foreach ($requiredRule in @(
        "ARTIFACT_BARE_IMPORT",
        "ARTIFACT_DEVELOPMENT_FILE",
        "ARTIFACT_DEVELOPMENT_MARKER",
        "ARTIFACT_DYNAMIC_CODE",
        "ARTIFACT_DYNAMIC_IMPORT",
        "ARTIFACT_EXECUTABLE_BINARY",
        "ARTIFACT_HMR_CLIENT",
        "ARTIFACT_MISSING_FILE",
        "ARTIFACT_REMOTE_ENDPOINT",
        "ARTIFACT_RUNTIME_NETWORK_API",
        "ARTIFACT_SOURCE_MAP_FILE",
        "ARTIFACT_SOURCE_MAP_REFERENCE",
        "ARTIFACT_UNSAFE_PATH",
        "ARTIFACT_UNEXPECTED_FILE"
    )) {
        Assert-True -Condition ($unsafeRules -contains $requiredRule) -Message "Unsafe fixtures should report $requiredRule."
    }

    $serializedResult = $unsafeResult | ConvertTo-Json -Depth 5
    Assert-True -Condition (-not $serializedResult.Contains($canonicalTestRoot)) -Message "Findings must not expose the local artifact root."
    Assert-True -Condition (-not $serializedResult.Contains("example.invalid")) -Message "Findings must not echo matched endpoint values."
    Assert-True -Condition (-not $serializedResult.Contains("secret value")) -Message "Findings must redact unsafe artifact names."

    $reparseTarget = Join-Path $testRoot "reparse-target"
    $reparseRoot = Join-Path $testRoot "reparse-root"
    $reparseInventory = Join-Path $testRoot "reparse-inventory.json"
    New-Item -ItemType Directory -Path $reparseTarget, $reparseRoot -Force | Out-Null
    Write-TestFile -Path (Join-Path $reparseTarget "outside.js") -Content 'fetch("https://outside.invalid/");'
    New-Item -ItemType Junction -Path (Join-Path $reparseRoot "linked") -Target $reparseTarget | Out-Null
    Write-TestFile -Path (Join-Path $reparseRoot "main.js") -Content 'export const safe = true;'
    Write-Inventory -Path $reparseInventory -ExpectedFiles @("main.js")
    $reparseResult = Test-FenneviaProductionArtifacts -ArtifactRoot $reparseRoot -InventoryPath $reparseInventory
    Assert-True -Condition ($reparseResult.Findings.Rule -contains "ARTIFACT_REPARSE_POINT") -Message "A reparse point must be reported and not traversed."

    $traversalInventory = Join-Path $testRoot "traversal-inventory.json"
    Write-Inventory -Path $traversalInventory -ExpectedFiles @("../outside.js")
    Assert-Throws -Message "Artifact inventory traversal must be rejected." -Operation {
        Test-FenneviaProductionArtifacts -ArtifactRoot $safeRoot -InventoryPath $traversalInventory | Out-Null
    }

    Assert-Throws -Message "A filesystem root must not be accepted as an artifact root." -Operation {
        Test-FenneviaProductionArtifacts -ArtifactRoot ([IO.Path]::GetPathRoot($safeRoot)) -InventoryPath $safeInventory | Out-Null
    }

    $rootJunction = Join-Path $testRoot "artifact-root-junction"
    New-Item -ItemType Junction -Path $rootJunction -Target $safeRoot | Out-Null
    Assert-Throws -Message "A reparse-point artifact root must be rejected." -Operation {
        Test-FenneviaProductionArtifacts -ArtifactRoot $rootJunction -InventoryPath $safeInventory | Out-Null
    }

    $enginePath = (Get-Process -Id $PID).Path
    $commandOutput = @(& $enginePath -NoProfile -File $commandPath -ArtifactRoot $safeRoot -InventoryPath $safeInventory 2>&1)
    Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "The command wrapper should return zero for passing artifacts."
    Assert-True -Condition (($commandOutput -join "`n") -match "^PASS:") -Message "The command wrapper should print a stable pass record."

    $commandOutput = @(& $enginePath -NoProfile -File $commandPath -ArtifactRoot $unsafeRoot -InventoryPath $unsafeInventory 2>&1)
    Assert-True -Condition ($LASTEXITCODE -eq 1) -Message "The command wrapper should return one for security findings."
    $commandText = $commandOutput -join "`n"
    Assert-True -Condition (-not $commandText.Contains($canonicalTestRoot)) -Message "Command output must not expose the local artifact root."
    Assert-True -Condition (-not $commandText.Contains("example.invalid")) -Message "Command output must not echo matched endpoint values."
    Assert-True -Condition (-not $commandText.Contains("secret value")) -Message "Command output must redact unsafe artifact names."

    $commandOutput = @(& $enginePath -NoProfile -File $commandPath -ArtifactRoot $safeRoot -InventoryPath $traversalInventory 2>&1)
    Assert-True -Condition ($LASTEXITCODE -eq 2) -Message "The command wrapper should return two for invalid policy input."
    Assert-True -Condition (($commandOutput -join "`n") -eq "FAIL [ARTIFACT_POLICY_INPUT] <ARTIFACT_ROOT>:0") -Message "Invalid-input output should be stable and privacy-safe."

    Write-Output "PASS: production artifact inventory, leakage detection, and privacy-safe reporting tests."
}
finally {
    Remove-Module SecurityChecks -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $canonicalTestRoot) {
        Remove-Item -LiteralPath $canonicalTestRoot -Recurse -Force
    }
}
