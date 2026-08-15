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
$healthPath = Join-Path $repositoryRoot "profile\chrome\fennevia\content\runtime\HealthState.sys.mjs"
$shellPath = Join-Path $repositoryRoot "profile\chrome\fennevia\content\runtime\WindowShell.sys.mjs"
$loggerPath = Join-Path $repositoryRoot "profile\chrome\fennevia\content\runtime\Logger.sys.mjs"
$configPath = Join-Path $repositoryRoot "program\fennevia.cfg"
$healthTestPath = Join-Path $repositoryRoot "tests\health-state.test.mjs"
$safeStartTestPath = Join-Path $repositoryRoot "tests\safe-start.test.mjs"
$shellTestPath = Join-Path $repositoryRoot "tests\shell-hosts.test.mjs"
$firefoxHarnessPath = Join-Path $repositoryRoot "tests\firefox-window-lifecycle.mjs"
$recoveryTestPath = Join-Path $repositoryRoot "tests\firefox-shell-recovery.Tests.ps1"

foreach ($requiredFile in @(
    $healthPath,
    $shellPath,
    $loggerPath,
    $configPath,
    $healthTestPath,
    $safeStartTestPath,
    $shellTestPath,
    $firefoxHarnessPath,
    $recoveryTestPath
)) {
    Assert-True -Condition (Test-Path -LiteralPath $requiredFile -PathType Leaf) -Message "A shell-health source or test file is missing."
}

$healthContent = Get-Content -Raw -LiteralPath $healthPath
$shellContent = Get-Content -Raw -LiteralPath $shellPath
$loggerContent = Get-Content -Raw -LiteralPath $loggerPath
$configContent = Get-Content -Raw -LiteralPath $configPath
$firefoxHarnessContent = Get-Content -Raw -LiteralPath $firefoxHarnessPath
$runtimeContent = $healthContent + "`n" + $shellContent + "`n" + $loggerContent

foreach ($requiredToken in @(
    'data-fennevia-state',
    'data-fennevia-created',
    'data-fennevia-mounted',
    'data-fennevia-healthy',
    'data-fennevia-active',
    'data-fennevia-failed',
    'created:\s*"mounted"',
    'mounted:\s*"healthy"',
    'healthy:\s*"active"',
    'mozSystemGroup:\s*true',
    'Ctrl\+Alt\+Shift\+F12',
    'FENNEVIA_SHELL_HEALTH_TIMEOUT',
    'FENNEVIA_EMERGENCY_FALLBACK_INVOKED',
    'DEFAULT_HEALTH_TIMEOUT_MS\s*=\s*2_000',
    'shellState'
)) {
    Assert-True -Condition ($runtimeContent -match $requiredToken) -Message "The runtime is missing a required health, recovery, or logging boundary."
}

foreach ($requiredToken in @(
    'Services\.appinfo\.inSafeMode',
    'Services\.prefs\.getBoolPref\("fennevia\.safeStart", false\)',
    'phase\s*=\s*"preflight"',
    'bootstrap\.skipped',
    'FENNEVIA_BOOTSTRAP_SAFE_START'
)) {
    Assert-True -Condition ($configContent -match $requiredToken) -Message "AutoConfig is missing an early safe-start boundary."
}

foreach ($requiredToken in @(
    '--expect-safe-start',
    'sendNativeKeyEvent',
    '0x00000409',
    '0x0058007b',
    'NATIVE_MODIFIER_SHIFT_LEFT',
    'NATIVE_MODIFIER_CONTROL_LEFT',
    'NATIVE_MODIFIER_ALT_LEFT'
)) {
    Assert-True -Condition ($firefoxHarnessContent -match $requiredToken) -Message "The real-Firefox harness is missing a required recovery probe."
}

foreach ($prohibitedToken in @(
    '#navigator-toolbox\s*\{[^}]*display\s*:\s*none',
    '#browser\s*\{[^}]*display\s*:\s*none',
    'Services\.prefs[^\r\n]*(?:fail|inject|debug)',
    'globalThis\.__fennevia[^\r\n]*(?:fail|inject|debug)',
    '\bfetch\s*\(',
    '\bXMLHttpRequest\b',
    '\bWebSocket\b',
    '\beval\s*\(',
    '\bnew\s+Function\s*\('
)) {
    Assert-True -Condition ($runtimeContent -notmatch $prohibitedToken) -Message "The production health runtime contains a prohibited native-hide, failure hook, network, or dynamic-code behavior."
}

$nodeCommand = Get-Command node -ErrorAction Stop
& $nodeCommand.Source --test $healthTestPath $safeStartTestPath $shellTestPath
Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "The Node.js shell-health matrix must pass."
& $nodeCommand.Source --check $firefoxHarnessPath
Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "The real-Firefox recovery harness must parse."

Write-Output "PASS: lifecycle states, health deadline, safe start, emergency fallback, cleanup, and production-hook boundaries."
