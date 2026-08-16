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
$runtimeRoot = Join-Path $repositoryRoot "profile\chrome\fennevia\content\runtime"
$loggerPath = Join-Path $runtimeRoot "Logger.sys.mjs"
$windowManagerPath = Join-Path $runtimeRoot "WindowManager.sys.mjs"
$runtimePath = Join-Path $runtimeRoot "Runtime.sys.mjs"
$nodeTestPath = Join-Path $repositoryRoot "tests\window-lifecycle.test.mjs"
$firefoxTestPath = Join-Path $repositoryRoot "tests\firefox-window-lifecycle.mjs"
$failOpenTestPath = Join-Path $repositoryRoot "tests\firefox-fail-open.Tests.ps1"

foreach ($requiredFile in @($loggerPath, $windowManagerPath, $runtimePath, $nodeTestPath, $firefoxTestPath, $failOpenTestPath)) {
    Assert-True -Condition (Test-Path -LiteralPath $requiredFile -PathType Leaf) -Message "A lifecycle source or test file is missing."
}

$loggerContent = Get-Content -Raw -LiteralPath $loggerPath
$windowManagerContent = Get-Content -Raw -LiteralPath $windowManagerPath
$runtimeContent = Get-Content -Raw -LiteralPath $runtimePath
$firefoxTestContent = Get-Content -Raw -LiteralPath $firefoxTestPath

foreach ($requiredToken in @(
    'chrome://browser/content/browser\.xhtml',
    'navigator:browser',
    'browser-delayed-startup-finished',
    'gBrowserInit\?\.delayedStartupFinished\s*===\s*true',
    'PrivateBrowsingUtils|privateBrowsingUtils',
    'new WeakSet\(\)',
    'new AbortController\(\)',
    'addEventListener\("unload"',
    'removeEventListener\("unload"',
    'services\.wm\.getEnumerator\(BROWSER_WINDOW_TYPE\)',
    'services\.uuid\.generateUUID\(\)'
)) {
    Assert-True -Condition ($windowManagerContent -match $requiredToken) -Message "The WindowManager is missing a required lifecycle boundary."
}

foreach ($requiredToken in @(
    'Symbol\.for\("fennevia\.runtime\.process-state"\)',
    'quit-application-granted',
    'windowManager\.start\(\)',
    'windowManager\.stop\(\)',
    'initializationCount\s*=\s*1'
)) {
    Assert-True -Condition ($runtimeContent -match $requiredToken) -Message "The process runtime is missing a required singleton or shutdown boundary."
}

foreach ($requiredToken in @(
    '\[Fennevia runtime\]',
    'schemaVersion:\s*1',
    '<REMOTE_URL>',
    '<LOCAL_FILE>',
    '<LOCAL_PATH>',
    '<UNC_PATH>',
    '<OPAQUE_URL>',
    '<OTHER_URI>',
    '<REDACTED_SUFFIX>',
    'DOM_PATH_PATTERN'
)) {
    Assert-True -Condition ($loggerContent -match $requiredToken) -Message "The runtime logger is missing a required privacy control."
}

foreach ($requiredToken in @(
    '\.fennevia-program-spike\.json',
    'firefox-identity-regression',
    '\.fennevia-dev-profile\.json',
    '--performance-baseline',
    'PERFORMANCE_IDLE_WINDOW_MS\s*=\s*5_000',
    'PERFORMANCE_WINDOW_CYCLES\s*=\s*5',
    'ChromeUtils\.requestProcInfo\(\)',
    'cpuTimeDeltaNs',
    'performanceBaseline='
)) {
    Assert-True -Condition ($firefoxTestContent -match $requiredToken) -Message "The real-Firefox probe is missing a required target-ownership or performance boundary."
}

$resourceSnapshotMatch = [regex]::Match(
    $firefoxTestContent,
    '(?s)async function collectProcessResourceSnapshot\(client\) \{.*?(?=async function measureEdgeRevealLatency)'
)
Assert-True -Condition $resourceSnapshotMatch.Success -Message "The real-Firefox probe is missing its aggregate resource collector."
foreach ($prohibitedField in @('documentURI', 'documentTitle', '\bwindows\b', '\borigin\b')) {
    Assert-True -Condition ($resourceSnapshotMatch.Value -notmatch $prohibitedField) -Message "The resource baseline must not serialize browsing-derived process data."
}

$productionRuntime = $loggerContent + "`n" + $windowManagerContent + "`n" + $runtimeContent
foreach ($prohibitedToken in @(
    '\.uc\.js',
    'directoryEntries',
    'loadSubScript',
    'contentaccessible\s*=\s*yes',
    '\boverride\s+chrome://',
    '\bfetch\s*\(',
    '\bXMLHttpRequest\b',
    '\bWebSocket\b',
    '\beval\s*\(',
    '\bnew\s+Function\s*\('
)) {
    Assert-True -Condition ($productionRuntime -notmatch $prohibitedToken) -Message "The lifecycle runtime contains prohibited generic-loader or remote-runtime behavior."
}

$nodeCommand = Get-Command node -ErrorAction Stop
& $nodeCommand.Source --test $nodeTestPath
Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "The Node.js lifecycle tests must pass."
& $nodeCommand.Source --check $firefoxTestPath
Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "The real-Firefox lifecycle probe must parse."

Write-Output "PASS: process runtime, strict browser-window lifecycle, cleanup, and privacy logging checks."
