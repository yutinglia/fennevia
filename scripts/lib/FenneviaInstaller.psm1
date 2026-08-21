Set-StrictMode -Version Latest

$script:PackageId = "fennevia"
$script:PackageSchemaVersion = 1
$script:OwnershipSchemaVersion = 1
$script:MetadataDirectoryName = ".fennevia"
$script:OwnershipFileName = "ownership.json"
$script:TransactionMarkerName = "transaction.json"
$script:TransactionJournalName = "journal.json"
$script:TransactionMarkerOwner = "fennevia-installer-transaction"
$script:DevelopmentMarkerName = ".fennevia-dev-profile.json"
$script:EnabledPreferencePath = "defaults/pref/fennevia.js"
$script:DisabledPreferencePath = "defaults/pref/fennevia.js.disabled"
$script:ProgramConfigPath = "fennevia.cfg"
$script:ProfilePackagePrefix = "chrome/fennevia/"
$script:ReleaseManifestName = "RELEASE-MANIFEST.json"

$script:InstallerModuleRoot = $PSScriptRoot

$script:InstallerImplementationFiles = @(
    "Common.ps1",
    "Discovery.ps1",
    "Ownership.ps1",
    "Planning.ps1",
    "Transaction.ps1",
    "Public.ps1"
)

foreach ($implementationFile in $script:InstallerImplementationFiles) {
    $implementationPath = Join-Path (Join-Path $script:InstallerModuleRoot "installer") $implementationFile
    if (-not (Test-Path -LiteralPath $implementationPath -PathType Leaf)) {
        throw "A required Fennevia installer implementation file is missing."
    }
    . $implementationPath
}

Export-ModuleMember -Function @(
    "ConvertTo-FenneviaInstallerProfileChoiceLines",
    "ConvertTo-FenneviaInstallerProgramCandidateLines",
    "ConvertTo-FenneviaInstallerResultLines",
    "ConvertTo-FenneviaInstallerStatusLines",
    "Get-FenneviaFirefoxProgramCandidates",
    "Get-FenneviaInstallerErrorCode",
    "Get-FenneviaInstallerInstallationStatus",
    "Get-FenneviaInstallerRegisteredProfileChoices",
    "Invoke-FenneviaPackageAction"
)
