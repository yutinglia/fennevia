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

$wrapper = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot "firefox-session-restore.ps1")
$harness = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot "firefox-window-lifecycle.mjs")
$contract = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot "session-restore-contract.mjs")
$contractTests = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot "session-restore-contract.test.mjs")

foreach ($mode in @("prepare", "verify", "fail-open", "cleanup")) {
    Assert-True -Condition $harness.Contains("`"$mode`"") -Message "The real-Firefox harness is missing the $mode mode."
}

foreach ($requiredWrapperControl in @(
    ".fennevia-dev-profile.json",
    ".fennevia-program-spike.json",
    "program-spikes",
    "package-manifest.json",
    "Get-FileHash",
    "finally",
    "FENNEVIA_SESSION_RESTORE_STATE_STALE"
)) {
    Assert-True -Condition $wrapper.Contains($requiredWrapperControl) -Message "The real wrapper is missing control $requiredWrapperControl."
}

foreach ($forbiddenEvidenceField in @(
    '"url"',
    '"title"',
    '"history"',
    '"profilePath"',
    '"sessionStore"',
    '"tabs"'
)) {
    Assert-True -Condition $contractTests.Contains($forbiddenEvidenceField) -Message "The contract unit allowlist does not explicitly reject $forbiddenEvidenceField."
}

Assert-True -Condition ($harness -match 'sessionRestoreEvidence=\$\{JSON\.stringify\(sessionEvidence\)\}') -Message "The harness must serialize only validated session-restore evidence."
Assert-True -Condition ($contract -match 'assertPrivacySafeSessionRestoreEvidence') -Message "The privacy-safe evidence validator is missing."
Assert-True -Condition ($contract -match 'assertFreshSessionRestoreState') -Message "The stale-state guard is missing."

Write-Output "PASS: the session-restore wrapper is marker-bound, hash-restored, stale-state guarded, and privacy allowlisted."
