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

function Assert-Match {
    param(
        [Parameter(Mandatory)]
        [AllowEmptyString()]
        [string] $Content,

        [Parameter(Mandatory)]
        [string] $Pattern,

        [Parameter(Mandatory)]
        [string] $Message
    )

    Assert-True -Condition ($Content -match $Pattern) -Message $Message
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$spikeRoot = Join-Path $repositoryRoot "spikes\bootstrap"
$programRoot = Join-Path $spikeRoot "program"
$packageRoot = Join-Path $spikeRoot "profile\chrome\fennevia"
$prefPath = Join-Path $programRoot "defaults\pref\fennevia.js"
$configPath = Join-Path $programRoot "fennevia.cfg"
$manifestPath = Join-Path $packageRoot "chrome.manifest"
$entryPath = Join-Path $packageRoot "content\Bootstrap.sys.mjs"
$inventoryPath = Join-Path $spikeRoot "package-inventory.json"
$contentProbePath = Join-Path $repositoryRoot "tests\bootstrap-content-access.mjs"
$contentFixturePath = Join-Path $repositoryRoot "tests\fixtures\bootstrap-content-access.html"
$scannerModule = Join-Path $repositoryRoot "scripts\lib\SecurityChecks.psm1"

$requiredFiles = @(
    $prefPath,
    $configPath,
    $manifestPath,
    $entryPath,
    $inventoryPath,
    $contentProbePath,
    $contentFixturePath
)
foreach ($requiredFile in $requiredFiles) {
    Assert-True -Condition (Test-Path -LiteralPath $requiredFile -PathType Leaf) -Message "Required bootstrap file is missing."
}

$prefContent = Get-Content -Raw -LiteralPath $prefPath
Assert-Match -Content $prefContent -Pattern 'pref\("general\.config\.obscure_value",\s*0\);' -Message "AutoConfig must disable byte shifting."
Assert-Match -Content $prefContent -Pattern 'pref\("general\.config\.filename",\s*"fennevia\.cfg"\);' -Message "AutoConfig must select the project cfg file."
Assert-Match -Content $prefContent -Pattern 'pref\("general\.config\.sandbox_enabled",\s*false\);' -Message "Release AutoConfig must use the privileged sandbox for the minimal bootstrap."
Assert-Match -Content $prefContent -Pattern 'pref\("fennevia\.safeStart",\s*false\);' -Message "The early safe-start preference must have a default."

$configContent = Get-Content -Raw -LiteralPath $configPath
$firstConfigLine = Get-Content -LiteralPath $configPath -TotalCount 1
Assert-True -Condition $firstConfigLine.StartsWith("//") -Message "Firefox skips the first cfg line, which must remain a comment."
foreach ($requiredToken in @(
    'Services\.dirsvc\.get\("UChrm",\s*Ci\.nsIFile\)',
    'Ci\.nsIComponentRegistrar',
    'registrar\.autoRegister\(manifest\)',
    'chromeRegistry\.convertChromeURL\(entryUri\)',
    'ChromeUtils\.importESModule\(ENTRY_URI\)',
    'bootstrap\.success',
    'bootstrap\.fatal',
    'safeErrorMessage\(error\)',
    'safeStack\(error\)',
    '<REMOTE_URL>',
    '<LOCAL_FILE>',
    '<LOCAL_PATH>',
    '<UNC_PATH>',
    '<OPAQUE_URL>',
    'fennevia\.safeStart'
)) {
    Assert-Match -Content $configContent -Pattern $requiredToken -Message "AutoConfig is missing a required minimal-bootstrap behavior."
}

foreach ($prohibitedToken in @(
    '\.uc\.js',
    'directoryEntries',
    'loadSubScript',
    'contentaccessible\s*=\s*yes',
    '\boverride\s+chrome://',
    '\bresource\s+fennevia',
    '\bfetch\s*\(',
    '\bXMLHttpRequest\b',
    '\beval\s*\(',
    '\bnew\s+Function\s*\('
)) {
    Assert-True -Condition ($configContent -notmatch $prohibitedToken) -Message "AutoConfig contains prohibited loader or remote-runtime behavior."
}

$manifestLines = @(
    Get-Content -LiteralPath $manifestPath |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
)
Assert-True -Condition ($manifestLines.Count -eq 1) -Message "The spike manifest must have exactly one declaration."
Assert-True -Condition ($manifestLines[0] -ceq "content fennevia content/") -Message "The manifest must map only the project content directory."

$entryContent = Get-Content -Raw -LiteralPath $entryPath
Assert-Match -Content $entryContent -Pattern 'typeof\s+Services\s*===\s*"undefined"' -Message "The privileged ESM must validate Firefox's built-in Services global."
Assert-True -Condition ($entryContent -notmatch 'Services\.sys\.mjs') -Message "Firefox 153 no longer packages Services.sys.mjs; the privileged ESM must use the validated global."
Assert-Match -Content $entryContent -Pattern 'export\s+const\s+bootstrapResult\s*=\s*result;' -Message "The privileged ESM must expose its validated result."
Assert-Match -Content $entryContent -Pattern 'initializationCount:\s*1' -Message "The privileged ESM must expose one process initialization."
Assert-Match -Content $entryContent -Pattern 'FENNEVIA_BOOTSTRAP_DUPLICATE_MODULE_INITIALIZATION' -Message "The privileged ESM must reject a second top-level initialization."

$contentProbe = Get-Content -Raw -LiteralPath $contentProbePath
$contentFixture = Get-Content -Raw -LiteralPath $contentFixturePath
Assert-Match -Content $contentProbe -Pattern 'server\.listen\(0,\s*"127\.0\.0\.1"' -Message "The ordinary-content probe must bind only an ephemeral loopback port."
Assert-Match -Content $contentProbe -Pattern 'screenshot target already exists; refusing to overwrite' -Message "The ordinary-content probe must not overwrite an existing screenshot."
Assert-Match -Content $contentProbe -Pattern 'reportResult\s*!==\s*"blocked"' -Message "The ordinary-content probe must fail unless Firefox denies the fetch."
Assert-Match -Content $contentFixture -Pattern 'fetch\(\s*"chrome://fennevia/content/Bootstrap\.sys\.mjs"' -Message "The fixture must test the exact privileged entry URI from ordinary HTTP content."

Import-Module $scannerModule -Force
try {
    $artifactResult = Test-FenneviaProductionArtifacts -ArtifactRoot $packageRoot -InventoryPath $inventoryPath
    Assert-True -Condition $artifactResult.Passed -Message "The exact bootstrap package inventory must pass the privileged-artifact scanner."
}
finally {
    Remove-Module SecurityChecks -ErrorAction SilentlyContinue
}

Write-Output "PASS: minimal AutoConfig, Chrome package, privileged ESM, and exact inventory checks."
