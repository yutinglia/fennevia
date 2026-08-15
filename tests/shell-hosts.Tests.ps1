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
$healthTestPath = Join-Path $repositoryRoot "tests\health-state.test.mjs"
$testPath = Join-Path $repositoryRoot "tests\shell-hosts.test.mjs"
$firefoxTestPath = Join-Path $repositoryRoot "tests\firefox-window-lifecycle.mjs"

foreach ($requiredFile in @($healthPath, $shellPath, $healthTestPath, $testPath, $firefoxTestPath)) {
    Assert-True -Condition (Test-Path -LiteralPath $requiredFile -PathType Leaf) -Message "A shell-host source or test file is missing."
}

$shellContent = Get-Content -Raw -LiteralPath $shellPath
$firefoxTestContent = Get-Content -Raw -LiteralPath $firefoxTestPath
foreach ($requiredToken in @(
    'http://www\.w3\.org/1999/xhtml',
    'fennevia-shell-frame-host',
    'fennevia-shell-top-host',
    'fennevia-shell-left-host',
    'fennevia-shell-right-host',
    'fennevia-shell-bottom-host',
    'document\.createElementNS\(XHTML_NAMESPACE',
    'insertionPoints\.browser\.insertBefore',
    'tabbrowser-tabbox',
    'window-modal-dialog',
    'a11y-announcement',
    'fullscr-toggler',
    'pointer-events:\s*none',
    'MutationObserver',
    'customizing',
    'inDOMFullscreen',
    'tabDialogShowing'
)) {
    Assert-True -Condition ($shellContent -match $requiredToken) -Message "The shell-host runtime is missing a required ownership, namespace, placement, or accessibility boundary."
}

foreach ($requiredToken in @(
    '--browser-toolbox',
    'gToolbox\.selectTool\("inspector"\)',
    'fennevia-ownership-probe',
    'devtools\.debugger\.prompt-connection',
    'prefs\.js\.fennevia-probe-backup',
    'FENNEVIA_BROWSER_TOOLBOX_PROFILE_MARKER_MISSING'
)) {
    Assert-True -Condition ($firefoxTestContent -match $requiredToken) -Message "The real-Firefox harness is missing a Browser Toolbox ownership or cleanup boundary."
}

foreach ($prohibitedToken in @(
    '\.innerHTML\b',
    '\.outerHTML\b',
    '\.attachShadow\s*\(',
    'data-fennevia-active',
    '\.remove\(\).*navigator-toolbox',
    '\.remove\(\).*tabbrowser-tabbox',
    '\bfetch\s*\(',
    '\bXMLHttpRequest\b',
    '\bWebSocket\b',
    '\beval\s*\(',
    '\bnew\s+Function\s*\('
)) {
    Assert-True -Condition ($shellContent -notmatch $prohibitedToken) -Message "The shell-host runtime contains prohibited native ownership, Shadow DOM, active-gate, remote, or dynamic-code behavior."
}

$nodeCommand = Get-Command node -ErrorAction Stop
& $nodeCommand.Source --test $healthTestPath $testPath
Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "The Node.js shell-host tests must pass."
& $nodeCommand.Source --check $firefoxTestPath
Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "The real-Firefox harness must parse."

Write-Output "PASS: XHTML host ownership, placement, diagnostics, rollback, and disposal checks."
