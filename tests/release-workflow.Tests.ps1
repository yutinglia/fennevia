#requires -Version 5.1

# SPDX-License-Identifier: MPL-2.0

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
$workflowPath = Join-Path $repositoryRoot ".github\workflows\release.yml"
Assert-True -Condition (Test-Path -LiteralPath $workflowPath -PathType Leaf) -Message "The release workflow must exist."
$workflow = Get-Content -Raw -LiteralPath $workflowPath

Assert-True -Condition ($workflow -match '(?m)^  push:\r?\n    tags:\r?\n      - "v\*"$') -Message "Release automation must be triggered only through a version tag or explicit manual dispatch."
Assert-True -Condition ($workflow -match '(?ms)workflow_dispatch:.*?publish:.*?default: false.*?type: boolean') -Message "Manual publication must be an explicit boolean opt-in that defaults to rehearsal."
Assert-True -Condition ($workflow -match '(?m)^permissions:\r?\n  contents: read$') -Message "The workflow-wide token must default to read-only contents access."
Assert-True -Condition ($workflow -match '(?ms)^  publish:.*?^    permissions:\r?\n      contents: write$') -Message "Only the gated publication job may receive contents write permission."
Assert-True -Condition ($workflow -match "if: github.event_name == 'push' \|\| inputs.publish == true") -Message "The publication job must be gated by a tag push or explicit manual approval."
Assert-True -Condition (@([regex]::Matches($workflow, 'release-preflight\.ps1')).Count -eq 2) -Message "Verification and publication jobs must independently rerun complete preflight."
Assert-True -Condition (@([regex]::Matches($workflow, '-RequireAnnotatedTag')).Count -eq 2) -Message "Both jobs must require an annotated tag resolving to the checked-out commit."

$checkoutPin = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'
$nodePin = 'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020'
Assert-True -Condition (@([regex]::Matches($workflow, [regex]::Escape($checkoutPin))).Count -eq 2) -Message "Both jobs must use the reviewed immutable checkout action pin."
Assert-True -Condition (@([regex]::Matches($workflow, [regex]::Escape($nodePin))).Count -eq 2) -Message "Both jobs must use the reviewed immutable setup-node action pin."
Assert-True -Condition ($workflow -notmatch '(?i)uses:\s+actions/(?:upload|download)-artifact@') -Message "Release bytes must be rebuilt in each job instead of crossing an unverified workflow-artifact boundary."
Assert-True -Condition ($workflow -notmatch '(?i)uses:\s+[^\s]+@(?![0-9a-f]{40}\b)') -Message "Every release workflow action must be pinned to a complete commit SHA."

$draftIndex = $workflow.IndexOf('"--draft"', [StringComparison]::Ordinal)
$digestIndex = $workflow.IndexOf('$asset.digest', [StringComparison]::Ordinal)
$publishIndex = $workflow.IndexOf('--method PATCH', [StringComparison]::Ordinal)
$downloadIndex = $workflow.IndexOf('gh release download', [StringComparison]::Ordinal)
Assert-True -Condition ($draftIndex -ge 0 -and $digestIndex -gt $draftIndex -and $publishIndex -gt $digestIndex -and $downloadIndex -gt $publishIndex) -Message "The workflow must create a draft, verify remote digests, publish, then download and reverify."
Assert-True -Condition ($workflow.Contains('gh release view')) -Message "Publication must refuse to overwrite or reuse an existing release."
Assert-True -Condition ($workflow.Contains('releases?per_page=100')) -Message "Publication must list releases because GitHub's tag lookup does not expose a draft reliably."
Assert-True -Condition ($workflow.Contains('Get-ReleaseDraftByTag')) -Message "Publication must detect and uniquely identify a private draft before retry or publication."
Assert-True -Condition ($workflow.Contains('$remoteRelease.id')) -Message "The verified private draft must be published by its immutable numeric release ID."
Assert-True -Condition ($workflow.Contains('-F draft=false')) -Message "Publication must update only the verified draft ID after digest checks."
Assert-True -Condition ($workflow -notmatch 'releases/tags/\$expectedTag') -Message "Draft validation must not use the tag endpoint that returned 404 for the first real draft."
Assert-True -Condition ($workflow.Contains('"--verify-tag"')) -Message "GitHub release creation must independently verify the remote tag."
Assert-True -Condition ($workflow.Contains('Count -ne $expectedAssets.Count')) -Message "The draft must contain exactly the reviewed asset count."
Assert-True -Condition ($workflow -notmatch '(?i)secrets\.') -Message "The release workflow must not depend on repository secrets."
Assert-True -Condition ($workflow.Contains('GH_TOKEN: ${{ github.token }}')) -Message "Publication must use only the scoped ephemeral GitHub token."
Assert-True -Condition ($workflow -match '(?m)^  cancel-in-progress: false$') -Message "A running release must not be cancelled into an ambiguous draft state."

Write-Output "PASS: least-privilege annotated-tag release rehearsal, draft digest, and publication workflow tests."
