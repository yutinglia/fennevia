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

function Assert-Equal {
    param(
        [Parameter(Mandatory)]
        [AllowNull()]
        [object] $Actual,

        [Parameter(Mandatory)]
        [AllowNull()]
        [object] $Expected,

        [Parameter(Mandatory)]
        [string] $Message
    )

    if ($Actual -cne $Expected) {
        throw "Assertion failed: $Message Expected '$Expected', got '$Actual'."
    }
}

function Assert-ThrowsCode {
    param(
        [Parameter(Mandatory)]
        [string] $Code,

        [Parameter(Mandatory)]
        [string] $Message,

        [Parameter(Mandatory)]
        [scriptblock] $Operation
    )

    try {
        & $Operation
    }
    catch {
        if ($_.Exception.Message.StartsWith("Assertion failed:", [StringComparison]::Ordinal)) {
            throw
        }
        $actualCode = Get-FenneviaInstallerErrorCode -ErrorRecord $_
        if ($actualCode -cne $Code) {
            $exceptionTypes = New-Object "Collections.Generic.List[string]"
            $candidate = $_.Exception
            while ($null -ne $candidate) {
                $exceptionTypes.Add($candidate.GetType().FullName)
                $candidate = $candidate.InnerException
            }
            throw "Assertion failed: $Message Expected code '$Code', got '$actualCode'. Exception chain: $($exceptionTypes -join ' -> '). Message: $($_.Exception.Message)"
        }
        return
    }

    throw "Assertion failed: $Message Expected code '$Code', but no exception was thrown."
}

function Write-TestFile {
    param(
        [Parameter(Mandatory)]
        [string] $Path,

        [Parameter(Mandatory)]
        [AllowEmptyString()]
        [string] $Content
    )

    $parent = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    $encoding = New-Object Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Get-TestHash {
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function New-TestFirefoxTarget {
    param(
        [Parameter(Mandatory)]
        [string] $Name,

        [switch] $WrongIdentity,

        [switch] $UnmarkedProfile
    )

    $programRoot = Join-Path $script:TestRoot "programs\$Name"
    New-Item -ItemType Directory -Path (Join-Path $programRoot "defaults\pref") -Force | Out-Null
    Write-TestFile -Path (Join-Path $programRoot "firefox.exe") -Content "fixture executable"
    $appName = if ($WrongIdentity) { "NotFirefox" } else { "Firefox" }
    $applicationIni = @(
        "[App]",
        "Name=$appName",
        "Version=153.0.4",
        "BuildID=20260810162159"
    ) -join [Environment]::NewLine
    Write-TestFile -Path (Join-Path $programRoot "application.ini") -Content ($applicationIni + [Environment]::NewLine)

    $profileRoot = Join-Path $env:LOCALAPPDATA "fennevia\profiles\$Name"
    if ($UnmarkedProfile) {
        New-Item -ItemType Directory -Path $profileRoot -Force | Out-Null
    }
    else {
        [void] (Initialize-FenneviaFirefoxDevProfile -ProfilePath $profileRoot)
    }

    return [pscustomobject]@{
        FirefoxPath = Join-Path $programRoot "firefox.exe"
        ProgramRoot = $programRoot
        ProfileRoot = $profileRoot
    }
}

function Get-TestTreeFingerprint {
    param(
        [Parameter(Mandatory)]
        [string[]] $Roots
    )

    $records = New-Object "Collections.Generic.List[string]"
    foreach ($root in $Roots) {
        $rootName = Split-Path -Leaf $root
        if (-not (Test-Path -LiteralPath $root -PathType Container)) {
            $records.Add("$rootName|<absent>")
            continue
        }
        $pending = New-Object "Collections.Generic.Queue[string]"
        $pending.Enqueue($root)
        while ($pending.Count -gt 0) {
            $directory = $pending.Dequeue()
            foreach ($child in @(Get-ChildItem -Force -LiteralPath $directory | Sort-Object Name)) {
                $relative = $child.FullName.Substring($root.Length).TrimStart("\", "/").Replace("\", "/")
                if ($child.PSIsContainer) {
                    $records.Add("$rootName|D|$relative")
                    $pending.Enqueue($child.FullName)
                }
                else {
                    $records.Add("$rootName|F|$relative|$(Get-TestHash -Path $child.FullName)")
                }
            }
        }
    }
    return (@($records | Sort-Object) -join [Environment]::NewLine)
}

function Assert-NoTransactionResidue {
    param(
        [Parameter(Mandatory)]
        [object] $Target,

        [Parameter(Mandatory)]
        [string] $Message
    )

    $residue = @(
        @(Get-ChildItem -Force -LiteralPath $Target.ProgramRoot -Filter ".fennevia-transaction-*" -ErrorAction SilentlyContinue) +
        @(Get-ChildItem -Force -LiteralPath $Target.ProfileRoot -Filter ".fennevia-transaction-*" -ErrorAction SilentlyContinue)
    )
    Assert-True -Condition ($residue.Count -eq 0) -Message $Message
}

function Copy-TestPackage {
    param(
        [Parameter(Mandatory)]
        [string] $Name,

        [Parameter(Mandatory)]
        [string] $Version,

        [Parameter(Mandatory)]
        [string] $BootstrapMarker,

        [switch] $IncludeLegacy
    )

    $packageRoot = Join-Path $script:TestRoot "packages\$Name"
    New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $script:RepositoryRoot "program") -Destination $packageRoot -Recurse
    Copy-Item -LiteralPath (Join-Path $script:RepositoryRoot "profile") -Destination $packageRoot -Recurse
    New-Item -ItemType Directory -Path (Join-Path $packageRoot "scripts\lib") -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $script:RepositoryRoot "scripts\lib\SecurityChecks.psm1") -Destination (Join-Path $packageRoot "scripts\lib\SecurityChecks.psm1")

    $bootstrapPath = Join-Path $packageRoot "profile\chrome\fennevia\content\Bootstrap.sys.mjs"
    [IO.File]::AppendAllText($bootstrapPath, "// $BootstrapMarker" + [Environment]::NewLine)
    if ($IncludeLegacy) {
        Write-TestFile -Path (Join-Path $packageRoot "profile\chrome\fennevia\content\Legacy.sys.mjs") -Content "export const legacy = true;"
    }

    $fileDefinitions = @(
        [pscustomobject]@{ Scope = "program"; Path = "defaults/pref/fennevia.js" },
        [pscustomobject]@{ Scope = "program"; Path = "fennevia.cfg" },
        [pscustomobject]@{ Scope = "profile"; Path = "chrome/fennevia/chrome.manifest" },
        [pscustomobject]@{ Scope = "profile"; Path = "chrome/fennevia/content/Bootstrap.sys.mjs" },
        [pscustomobject]@{ Scope = "profile"; Path = "chrome/fennevia/content/firefox/BridgeBoundary.sys.mjs" },
        [pscustomobject]@{ Scope = "profile"; Path = "chrome/fennevia/content/runtime/HealthState.sys.mjs" },
        [pscustomobject]@{ Scope = "profile"; Path = "chrome/fennevia/content/runtime/Logger.sys.mjs" },
        [pscustomobject]@{ Scope = "profile"; Path = "chrome/fennevia/content/runtime/NativeUi.sys.mjs" },
        [pscustomobject]@{ Scope = "profile"; Path = "chrome/fennevia/content/runtime/Runtime.sys.mjs" },
        [pscustomobject]@{ Scope = "profile"; Path = "chrome/fennevia/content/runtime/StartupNativeHide.css" },
        [pscustomobject]@{ Scope = "profile"; Path = "chrome/fennevia/content/runtime/StartupNativeHide.sys.mjs" },
        [pscustomobject]@{ Scope = "profile"; Path = "chrome/fennevia/content/runtime/WindowManager.sys.mjs" },
        [pscustomobject]@{ Scope = "profile"; Path = "chrome/fennevia/content/runtime/WindowShell.sys.mjs" },
        [pscustomobject]@{ Scope = "profile"; Path = "chrome/fennevia/content/shell/ShellApp.js" },
        [pscustomobject]@{ Scope = "profile"; Path = "chrome/fennevia/content/shell/ShellStyles.sys.mjs" },
        [pscustomobject]@{ Scope = "profile"; Path = "chrome/fennevia/content/shell/THIRD_PARTY_NOTICES.txt" }
    )
    if ($IncludeLegacy) {
        $fileDefinitions += [pscustomobject]@{ Scope = "profile"; Path = "chrome/fennevia/content/Legacy.sys.mjs" }
    }

    $files = @(
        $fileDefinitions |
            ForEach-Object {
                $sourcePath = Join-Path $packageRoot ("$($_.Scope)\" + $_.Path.Replace("/", "\"))
                [ordered]@{
                    scope = $_.Scope
                    path = $_.Path
                    sha256 = Get-TestHash -Path $sourcePath
                }
            }
    )
    $expectedFiles = @(
        $fileDefinitions |
            Where-Object { $_.Scope -eq "profile" } |
            ForEach-Object { $_.Path.Substring("chrome/fennevia/".Length) } |
            Sort-Object
    )
    $manifest = [ordered]@{
        schemaVersion = 1
        packageId = "fennevia"
        packageVersion = $Version
        expectedFiles = $expectedFiles
        files = $files
    }
    Write-TestFile -Path (Join-Path $packageRoot "package-manifest.json") -Content (($manifest | ConvertTo-Json -Depth 6) + [Environment]::NewLine)
    return $packageRoot
}

function Remove-TestInstalledScope {
    param(
        [Parameter(Mandatory)]
        [object] $Target,

        [Parameter(Mandatory)]
        [ValidateSet("program", "profile")]
        [string] $Scope
    )

    $survivingOwnershipPath = if ($Scope -eq "program") {
        Join-Path $Target.ProfileRoot ".fennevia\ownership.json"
    }
    else {
        Join-Path $Target.ProgramRoot ".fennevia\ownership.json"
    }
    $ownership = Get-Content -Raw -LiteralPath $survivingOwnershipPath | ConvertFrom-Json
    $root = if ($Scope -eq "program") { $Target.ProgramRoot } else { $Target.ProfileRoot }
    foreach ($file in @($ownership.files | Where-Object { $_.scope -eq $Scope })) {
        $path = Join-Path $root ([string] $file.installedPath).Replace("/", "\")
        if (Test-Path -LiteralPath $path -PathType Leaf) {
            Remove-Item -LiteralPath $path -Force
        }
    }

    $ownershipPath = Join-Path $root ".fennevia\ownership.json"
    if (Test-Path -LiteralPath $ownershipPath -PathType Leaf) {
        Remove-Item -LiteralPath $ownershipPath -Force
    }
    $metadataPath = Join-Path $root ".fennevia"
    if (Test-Path -LiteralPath $metadataPath -PathType Container) {
        $metadataEntries = @(Get-ChildItem -Force -LiteralPath $metadataPath)
        Assert-Equal -Actual $metadataEntries.Count -Expected 0 -Message "The test may remove only an empty ownership directory."
        Remove-Item -LiteralPath $metadataPath -Force
    }

    foreach ($directory in @(
        $ownership.createdDirectories |
            Where-Object { $_.scope -eq $Scope } |
            Sort-Object @{ Expression = { (([string] $_.path) -split "/").Count }; Descending = $true }
    )) {
        $path = Join-Path $root ([string] $directory.path).Replace("/", "\")
        if (Test-Path -LiteralPath $path -PathType Container) {
            $entries = @(Get-ChildItem -Force -LiteralPath $path)
            if ($entries.Count -eq 0) {
                Remove-Item -LiteralPath $path -Force
            }
        }
    }
}

$script:RepositoryRoot = Split-Path -Parent $PSScriptRoot
$script:TestRoot = Join-Path ([IO.Path]::GetTempPath()) ("fennevia-installer-tests-" + [guid]::NewGuid().ToString("N"))
$canonicalTempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd("\", "/")
$canonicalTestRoot = [IO.Path]::GetFullPath($script:TestRoot).TrimEnd("\", "/")
Assert-True -Condition ($canonicalTestRoot.StartsWith($canonicalTempRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) -Message "The installer test root must remain inside the OS temporary directory."

$originalLocalAppData = $env:LOCALAPPDATA
$originalAppData = $env:APPDATA
$originalUserProfile = $env:USERPROFILE

try {
    $env:LOCALAPPDATA = Join-Path $script:TestRoot "local"
    $env:APPDATA = Join-Path $script:TestRoot "roaming"
    $env:USERPROFILE = Join-Path $script:TestRoot "user"
    New-Item -ItemType Directory -Path $env:LOCALAPPDATA, $env:APPDATA, $env:USERPROFILE -Force | Out-Null

    Import-Module (Join-Path $script:RepositoryRoot "scripts\lib\FirefoxDevProfile.psm1") -Force
    Import-Module (Join-Path $script:RepositoryRoot "scripts\lib\FenneviaInstaller.psm1") -Force

    $unsafeTarget = New-TestFirefoxTarget -Name "unsafe-base"
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_INVALID_PROGRAM" -Message "Relative Firefox paths must be rejected." -Operation {
        Invoke-FenneviaPackageAction -Action Install -FirefoxPath "relative\firefox.exe" -ProfilePath $unsafeTarget.ProfileRoot -PackageRoot $script:RepositoryRoot -DryRun | Out-Null
    }
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_UNSAFE_ROOT" -Message "The user home must be rejected as a profile target." -Operation {
        Invoke-FenneviaPackageAction -Action Install -FirefoxPath $unsafeTarget.FirefoxPath -ProfilePath $env:USERPROFILE -PackageRoot $script:RepositoryRoot -DryRun | Out-Null
    }
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_UNSAFE_ROOT" -Message "The AppData root must be rejected as a profile target." -Operation {
        Invoke-FenneviaPackageAction -Action Install -FirefoxPath $unsafeTarget.FirefoxPath -ProfilePath $env:APPDATA -PackageRoot $script:RepositoryRoot -DryRun | Out-Null
    }
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_UNSAFE_ROOT" -Message "A filesystem root must be rejected as a profile target." -Operation {
        Invoke-FenneviaPackageAction -Action Install -FirefoxPath $unsafeTarget.FirefoxPath -ProfilePath ([IO.Path]::GetPathRoot($script:TestRoot)) -PackageRoot $script:RepositoryRoot -DryRun | Out-Null
    }

    $unmarkedTarget = New-TestFirefoxTarget -Name "unmarked" -UnmarkedProfile
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_UNMARKED_PROFILE" -Message "An unmarked profile must be rejected." -Operation {
        Invoke-FenneviaPackageAction -Action Install -FirefoxPath $unmarkedTarget.FirefoxPath -ProfilePath $unmarkedTarget.ProfileRoot -PackageRoot $script:RepositoryRoot -DryRun | Out-Null
    }

    $wrongProgram = New-TestFirefoxTarget -Name "wrong-program" -WrongIdentity
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_INVALID_PROGRAM" -Message "A non-Firefox program identity must be rejected." -Operation {
        Invoke-FenneviaPackageAction -Action Install -FirefoxPath $wrongProgram.FirefoxPath -ProfilePath $wrongProgram.ProfileRoot -PackageRoot $script:RepositoryRoot -DryRun | Out-Null
    }

    $profileCollection = Join-Path $env:APPDATA "Mozilla\Firefox\Profiles\daily"
    New-Item -ItemType Directory -Path $profileCollection -Force | Out-Null
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_REGISTERED_PROFILE" -Message "The Firefox profile collection must be rejected." -Operation {
        Invoke-FenneviaPackageAction -Action Install -FirefoxPath $unsafeTarget.FirefoxPath -ProfilePath $profileCollection -PackageRoot $script:RepositoryRoot -DryRun | Out-Null
    }

    $junctionTarget = Join-Path $script:TestRoot "junction-target"
    New-Item -ItemType Directory -Path $junctionTarget -Force | Out-Null
    $junctionProfile = Join-Path $env:LOCALAPPDATA "fennevia\profiles\junction"
    New-Item -ItemType Junction -Path $junctionProfile -Target $junctionTarget | Out-Null
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_REPARSE_POINT" -Message "A reparse-point profile must be rejected." -Operation {
        Invoke-FenneviaPackageAction -Action Install -FirefoxPath $unsafeTarget.FirefoxPath -ProfilePath $junctionProfile -PackageRoot $script:RepositoryRoot -DryRun | Out-Null
    }

    $traversalPackage = Copy-TestPackage -Name "traversal" -Version "1.0.0" -BootstrapMarker "traversal fixture"
    $traversalManifestPath = Join-Path $traversalPackage "package-manifest.json"
    $traversalManifest = Get-Content -Raw -LiteralPath $traversalManifestPath | ConvertFrom-Json
    $traversalManifest.files[0].path = "../escape.js"
    Write-TestFile -Path $traversalManifestPath -Content (($traversalManifest | ConvertTo-Json -Depth 6) + [Environment]::NewLine)
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_PACKAGE_INVALID" -Message "A manifest traversal path must be rejected before mutation." -Operation {
        Invoke-FenneviaPackageAction -Action Install -FirefoxPath $unsafeTarget.FirefoxPath -ProfilePath $unsafeTarget.ProfileRoot -PackageRoot $traversalPackage -DryRun | Out-Null
    }

    $collisionTarget = New-TestFirefoxTarget -Name "collision"
    Write-TestFile -Path (Join-Path $collisionTarget.ProgramRoot "fennevia.cfg") -Content "foreign customization"
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_FILE_CONFLICT" -Message "Unknown same-name content must block install." -Operation {
        Invoke-FenneviaPackageAction -Action Install -FirefoxPath $collisionTarget.FirefoxPath -ProfilePath $collisionTarget.ProfileRoot -PackageRoot $script:RepositoryRoot -DryRun | Out-Null
    }
    Assert-True -Condition (-not (Test-Path -LiteralPath (Join-Path $collisionTarget.ProgramRoot ".fennevia"))) -Message "A collision failure must not create program metadata."
    Assert-True -Condition (-not (Test-Path -LiteralPath (Join-Path $collisionTarget.ProfileRoot "chrome\fennevia"))) -Message "A collision failure must not create the profile package."

    $interruptedTarget = New-TestFirefoxTarget -Name "interrupted"
    $interruptedTransaction = Join-Path $interruptedTarget.ProgramRoot ".fennevia-transaction-fixture"
    New-Item -ItemType Directory -Path $interruptedTransaction | Out-Null
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_INTERRUPTED_TRANSACTION" -Message "An interrupted transaction must block every later action before mutation." -Operation {
        Invoke-FenneviaPackageAction -Action Install -FirefoxPath $interruptedTarget.FirefoxPath -ProfilePath $interruptedTarget.ProfileRoot -PackageRoot $script:RepositoryRoot -DryRun | Out-Null
    }
    Remove-Item -LiteralPath $interruptedTransaction

    $permissionTarget = New-TestFirefoxTarget -Name "permission"
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_PERMISSION_DENIED" -Message "A staging permission failure must retain no package mutation." -Operation {
        Invoke-FenneviaPackageAction -Action Install -FirefoxPath $permissionTarget.FirefoxPath -ProfilePath $permissionTarget.ProfileRoot -PackageRoot $script:RepositoryRoot -TestDenyTransactionScope profile | Out-Null
    }
    Assert-NoTransactionResidue -Target $permissionTarget -Message "A staging permission failure must clean the first root's transaction."
    Assert-True -Condition (-not (Test-Path -LiteralPath (Join-Path $permissionTarget.ProgramRoot ".fennevia"))) -Message "A staging permission failure must not install program metadata."
    Assert-True -Condition (-not (Test-Path -LiteralPath (Join-Path $permissionTarget.ProfileRoot "chrome\fennevia"))) -Message "A staging permission failure must not install profile files."

    $planGuardTarget = New-TestFirefoxTarget -Name "plan-guard"
    $guardedPlan = Invoke-FenneviaPackageAction -Action Install -FirefoxPath $planGuardTarget.FirefoxPath -ProfilePath $planGuardTarget.ProfileRoot -PackageRoot $script:RepositoryRoot -DryRun
    New-Item -ItemType Directory -Path (Join-Path $planGuardTarget.ProfileRoot "chrome\fennevia") -Force | Out-Null
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_PLAN_CHANGED" -Message "Actual execution must reject a target state that changed after preview." -Operation {
        Invoke-FenneviaPackageAction -Action Install -FirefoxPath $planGuardTarget.FirefoxPath -ProfilePath $planGuardTarget.ProfileRoot -PackageRoot $script:RepositoryRoot -ExpectedPlanSha256 $guardedPlan.PlanSha256 | Out-Null
    }
    Assert-True -Condition (-not (Test-Path -LiteralPath (Join-Path $planGuardTarget.ProgramRoot ".fennevia"))) -Message "A changed-plan rejection must occur before program mutation."
    Assert-True -Condition (-not (Test-Path -LiteralPath (Join-Path $planGuardTarget.ProfileRoot ".fennevia"))) -Message "A changed-plan rejection must occur before profile metadata mutation."

    $installTarget = New-TestFirefoxTarget -Name "install"
    $beforeDryRun = Get-TestTreeFingerprint -Roots @($installTarget.ProgramRoot, $installTarget.ProfileRoot)
    $installPlan = Invoke-FenneviaPackageAction -Action Install -FirefoxPath $installTarget.FirefoxPath -ProfilePath $installTarget.ProfileRoot -PackageRoot $script:RepositoryRoot -DryRun
    $afterDryRun = Get-TestTreeFingerprint -Roots @($installTarget.ProgramRoot, $installTarget.ProfileRoot)
    Assert-Equal -Actual $afterDryRun -Expected $beforeDryRun -Message "Install dry-run must not change either selected root."
    Assert-True -Condition ($installPlan.PlannedMutationCount -gt 0) -Message "Install dry-run must list exact planned mutations."
    Assert-Equal -Actual $installPlan.PlannedBackupCount -Expected 0 -Message "A clean install must not claim any existing-file backup."
    $planText = (ConvertTo-FenneviaInstallerResultLines -Result $installPlan) -join [Environment]::NewLine
    Assert-True -Condition (-not $planText.Contains($script:TestRoot)) -Message "Normal plan output must not reveal local target paths."
    Assert-True -Condition ($planText.Contains("program=<FIREFOX_PROGRAM>")) -Message "Normal plan output must use the program placeholder."
    Assert-True -Condition ($planText.Contains("profile=<FENNEVIA_PROFILE>")) -Message "Normal plan output must use the profile placeholder."
    Assert-True -Condition ($planText.Contains("plannedBackupCount=0")) -Message "Normal plan output must disclose its exact backup count."

    $installResult = Invoke-FenneviaPackageAction -Action Install -FirefoxPath $installTarget.FirefoxPath -ProfilePath $installTarget.ProfileRoot -PackageRoot $script:RepositoryRoot
    Assert-Equal -Actual $installResult.Status -Expected "applied" -Message "A clean install must apply."
    foreach ($relativePath in @(
        "defaults\pref\fennevia.js",
        "fennevia.cfg",
        ".fennevia\ownership.json"
    )) {
        Assert-True -Condition (Test-Path -LiteralPath (Join-Path $installTarget.ProgramRoot $relativePath) -PathType Leaf) -Message "Install must create every program-owned file."
    }
    foreach ($relativePath in @(
        "chrome\fennevia\chrome.manifest",
        "chrome\fennevia\content\Bootstrap.sys.mjs",
        "chrome\fennevia\content\runtime\HealthState.sys.mjs",
        "chrome\fennevia\content\runtime\Logger.sys.mjs",
        "chrome\fennevia\content\runtime\NativeUi.sys.mjs",
        "chrome\fennevia\content\runtime\Runtime.sys.mjs",
        "chrome\fennevia\content\runtime\StartupNativeHide.css",
        "chrome\fennevia\content\runtime\StartupNativeHide.sys.mjs",
        "chrome\fennevia\content\runtime\WindowManager.sys.mjs",
        "chrome\fennevia\content\runtime\WindowShell.sys.mjs",
        ".fennevia\ownership.json"
    )) {
        Assert-True -Condition (Test-Path -LiteralPath (Join-Path $installTarget.ProfileRoot $relativePath) -PathType Leaf) -Message "Install must create every profile-owned file."
    }
    $programOwnership = Get-Content -Raw -LiteralPath (Join-Path $installTarget.ProgramRoot ".fennevia\ownership.json")
    $profileOwnership = Get-Content -Raw -LiteralPath (Join-Path $installTarget.ProfileRoot ".fennevia\ownership.json")
    Assert-Equal -Actual $profileOwnership -Expected $programOwnership -Message "Program and profile ownership manifests must be identical."
    Assert-NoTransactionResidue -Target $installTarget -Message "Successful install must remove transaction staging."

    $secondInstall = Invoke-FenneviaPackageAction -Action Install -FirefoxPath $installTarget.FirefoxPath -ProfilePath $installTarget.ProfileRoot -PackageRoot $script:RepositoryRoot
    Assert-Equal -Actual $secondInstall.Status -Expected "already-installed" -Message "Install must be idempotent."
    Assert-Equal -Actual $secondInstall.PlannedMutationCount -Expected 0 -Message "A second identical install must plan no mutation."

    $missingEntry = Join-Path $installTarget.ProfileRoot "chrome\fennevia\content\Bootstrap.sys.mjs"
    Remove-Item -LiteralPath $missingEntry -Force
    $beforeDisableDryRun = Get-TestTreeFingerprint -Roots @($installTarget.ProgramRoot, $installTarget.ProfileRoot)
    $disablePlan = Invoke-FenneviaPackageAction -Action Disable -FirefoxPath $installTarget.FirefoxPath -ProfilePath $installTarget.ProfileRoot -PackageRoot $script:RepositoryRoot -DryRun
    Assert-Equal -Actual (Get-TestTreeFingerprint -Roots @($installTarget.ProgramRoot, $installTarget.ProfileRoot)) -Expected $beforeDisableDryRun -Message "Disable dry-run must not mutate a broken installation."
    Assert-True -Condition ($disablePlan.Operations.Kind -contains "MoveFile") -Message "Hard disable must plan an offline preference move."
    Assert-Equal -Actual $disablePlan.PlannedBackupCount -Expected 3 -Message "Hard disable must list the preference and paired ownership backups."
    $disableResult = Invoke-FenneviaPackageAction -Action Disable -FirefoxPath $installTarget.FirefoxPath -ProfilePath $installTarget.ProfileRoot -PackageRoot $script:RepositoryRoot
    Assert-Equal -Actual $disableResult.State -Expected "disabled" -Message "Hard disable must succeed even when the runtime entry is missing."
    Assert-True -Condition (-not (Test-Path -LiteralPath (Join-Path $installTarget.ProgramRoot "defaults\pref\fennevia.js"))) -Message "Hard disable must remove the active AutoConfig declaration name."
    Assert-True -Condition (Test-Path -LiteralPath (Join-Path $installTarget.ProgramRoot "defaults\pref\fennevia.js.disabled") -PathType Leaf) -Message "Hard disable must retain the owned preference under a non-loaded name."
    $secondDisable = Invoke-FenneviaPackageAction -Action Disable -FirefoxPath $installTarget.FirefoxPath -ProfilePath $installTarget.ProfileRoot -PackageRoot $script:RepositoryRoot
    Assert-Equal -Actual $secondDisable.Status -Expected "already-disabled" -Message "Hard disable must be idempotent."

    Write-TestFile -Path (Join-Path $installTarget.ProfileRoot "chrome\another-customization.css") -Content "/* foreign and preserved */"
    $beforeUninstallDryRun = Get-TestTreeFingerprint -Roots @($installTarget.ProgramRoot, $installTarget.ProfileRoot)
    $uninstallPlan = Invoke-FenneviaPackageAction -Action Uninstall -FirefoxPath $installTarget.FirefoxPath -ProfilePath $installTarget.ProfileRoot -PackageRoot $script:RepositoryRoot -DryRun
    Assert-Equal -Actual (Get-TestTreeFingerprint -Roots @($installTarget.ProgramRoot, $installTarget.ProfileRoot)) -Expected $beforeUninstallDryRun -Message "Uninstall dry-run must not mutate either selected root."
    Assert-True -Condition ($uninstallPlan.Operations.Kind -contains "RemoveFile") -Message "Uninstall dry-run must list exact owned-file removals."
    Assert-Equal -Actual $uninstallPlan.PlannedBackupCount -Expected (@($uninstallPlan.Operations | Where-Object { $_.Kind -eq "RemoveFile" }).Count) -Message "Uninstall dry-run must list every existing owned file backup."
    [void] (Invoke-FenneviaPackageAction -Action Uninstall -FirefoxPath $installTarget.FirefoxPath -ProfilePath $installTarget.ProfileRoot -PackageRoot $script:RepositoryRoot)
    Assert-True -Condition (-not (Test-Path -LiteralPath (Join-Path $installTarget.ProgramRoot "fennevia.cfg"))) -Message "Uninstall must remove the owned cfg."
    Assert-True -Condition (-not (Test-Path -LiteralPath (Join-Path $installTarget.ProgramRoot ".fennevia"))) -Message "Uninstall must remove empty program metadata."
    Assert-True -Condition (-not (Test-Path -LiteralPath (Join-Path $installTarget.ProfileRoot "chrome\fennevia"))) -Message "Uninstall must remove the empty project profile package."
    Assert-True -Condition (Test-Path -LiteralPath (Join-Path $installTarget.ProfileRoot "chrome\another-customization.css") -PathType Leaf) -Message "Uninstall must preserve unrelated profile chrome content."
    Assert-NoTransactionResidue -Target $installTarget -Message "Successful uninstall must remove transaction staging."
    $secondUninstall = Invoke-FenneviaPackageAction -Action Uninstall -FirefoxPath $installTarget.FirefoxPath -ProfilePath $installTarget.ProfileRoot -PackageRoot $script:RepositoryRoot
    Assert-Equal -Actual $secondUninstall.Status -Expected "not-installed" -Message "Uninstall must be idempotent when no owned residue remains."

    $versionOnePackage = Copy-TestPackage -Name "version-one" -Version "1.0.0" -BootstrapMarker "version one" -IncludeLegacy
    $versionTwoPackage = Copy-TestPackage -Name "version-two" -Version "2.0.0" -BootstrapMarker "version two"
    $updateTarget = New-TestFirefoxTarget -Name "update"
    [void] (Invoke-FenneviaPackageAction -Action Install -FirefoxPath $updateTarget.FirefoxPath -ProfilePath $updateTarget.ProfileRoot -PackageRoot $versionOnePackage)
    Write-TestFile -Path (Join-Path $updateTarget.ProfileRoot "chrome\preserved.css") -Content "/* preserve across update */"
    $beforeFailedUpdate = Get-TestTreeFingerprint -Roots @($updateTarget.ProgramRoot, $updateTarget.ProfileRoot)
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_INJECTED_FAILURE" -Message "A partial update failure must report the injected failure after rollback." -Operation {
        Invoke-FenneviaPackageAction -Action Update -FirefoxPath $updateTarget.FirefoxPath -ProfilePath $updateTarget.ProfileRoot -PackageRoot $versionTwoPackage -TestFailureAfterMutation 2 | Out-Null
    }
    Assert-Equal -Actual (Get-TestTreeFingerprint -Roots @($updateTarget.ProgramRoot, $updateTarget.ProfileRoot)) -Expected $beforeFailedUpdate -Message "A partial update failure must restore the exact prior managed state."
    Assert-NoTransactionResidue -Target $updateTarget -Message "A successful rollback must remove transaction staging."

    $updatePlan = Invoke-FenneviaPackageAction -Action Update -FirefoxPath $updateTarget.FirefoxPath -ProfilePath $updateTarget.ProfileRoot -PackageRoot $versionTwoPackage -DryRun
    Assert-True -Condition ($updatePlan.Operations.Kind -contains "ReplaceFile") -Message "Update must identify changed owned files."
    Assert-True -Condition ($updatePlan.Operations.Kind -contains "RemoveFile") -Message "Update must identify stale owned files."
    [void] (Invoke-FenneviaPackageAction -Action Update -FirefoxPath $updateTarget.FirefoxPath -ProfilePath $updateTarget.ProfileRoot -PackageRoot $versionTwoPackage)
    Assert-True -Condition (-not (Test-Path -LiteralPath (Join-Path $updateTarget.ProfileRoot "chrome\fennevia\content\Legacy.sys.mjs"))) -Message "Update must remove stale manifest-owned artifacts."
    Assert-True -Condition (Test-Path -LiteralPath (Join-Path $updateTarget.ProfileRoot "chrome\preserved.css") -PathType Leaf) -Message "Update must preserve unrelated profile content."
    $installedBootstrap = Join-Path $updateTarget.ProfileRoot "chrome\fennevia\content\Bootstrap.sys.mjs"
    $sourceBootstrap = Join-Path $versionTwoPackage "profile\chrome\fennevia\content\Bootstrap.sys.mjs"
    Assert-Equal -Actual (Get-TestHash -Path $installedBootstrap) -Expected (Get-TestHash -Path $sourceBootstrap) -Message "Update must install the exact new owned artifact."
    $secondUpdate = Invoke-FenneviaPackageAction -Action Update -FirefoxPath $updateTarget.FirefoxPath -ProfilePath $updateTarget.ProfileRoot -PackageRoot $versionTwoPackage
    Assert-Equal -Actual $secondUpdate.Status -Expected "already-current" -Message "Update must be idempotent."

    $repairAbsentTarget = New-TestFirefoxTarget -Name "repair-absent"
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_NOT_INSTALLED" -Message "Repair must not infer ownership when both ownership manifests are absent." -Operation {
        Invoke-FenneviaPackageAction -Action Repair -FirefoxPath $repairAbsentTarget.FirefoxPath -ProfilePath $repairAbsentTarget.ProfileRoot -PackageRoot $script:RepositoryRoot -DryRun | Out-Null
    }

    $repairProgramTarget = New-TestFirefoxTarget -Name "repair-program"
    [void] (Invoke-FenneviaPackageAction -Action Install -FirefoxPath $repairProgramTarget.FirefoxPath -ProfilePath $repairProgramTarget.ProfileRoot -PackageRoot $script:RepositoryRoot)
    $completeProgramFingerprint = Get-TestTreeFingerprint -Roots @($repairProgramTarget.ProgramRoot, $repairProgramTarget.ProfileRoot)
    Remove-TestInstalledScope -Target $repairProgramTarget -Scope program
    $incompleteProgramFingerprint = Get-TestTreeFingerprint -Roots @($repairProgramTarget.ProgramRoot, $repairProgramTarget.ProfileRoot)
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_OWNERSHIP_INCOMPLETE" -Message "Update must fail closed when one ownership side is missing." -Operation {
        Invoke-FenneviaPackageAction -Action Update -FirefoxPath $repairProgramTarget.FirefoxPath -ProfilePath $repairProgramTarget.ProfileRoot -PackageRoot $script:RepositoryRoot -DryRun | Out-Null
    }
    $repairProgramPlan = Invoke-FenneviaPackageAction -Action Repair -FirefoxPath $repairProgramTarget.FirefoxPath -ProfilePath $repairProgramTarget.ProfileRoot -PackageRoot $script:RepositoryRoot -DryRun
    Assert-Equal -Actual $repairProgramPlan.Status -Expected "repairable-program" -Message "Repair preview must identify the missing program ownership side."
    Assert-Equal -Actual (Get-TestTreeFingerprint -Roots @($repairProgramTarget.ProgramRoot, $repairProgramTarget.ProfileRoot)) -Expected $incompleteProgramFingerprint -Message "Repair dry-run must not mutate either selected root."
    Assert-Equal -Actual $repairProgramPlan.PlannedBackupCount -Expected 0 -Message "A clean one-sided reconstruction must not claim backups."
    Assert-True -Condition (@($repairProgramPlan.Operations | Where-Object { $_.Scope -ne "program" }).Count -eq 0) -Message "Program repair must plan mutations only on the missing program side."
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_INJECTED_FAILURE" -Message "A partial program repair failure must report the injected failure after rollback." -Operation {
        Invoke-FenneviaPackageAction -Action Repair -FirefoxPath $repairProgramTarget.FirefoxPath -ProfilePath $repairProgramTarget.ProfileRoot -PackageRoot $script:RepositoryRoot -TestFailureAfterMutation 2 | Out-Null
    }
    Assert-Equal -Actual (Get-TestTreeFingerprint -Roots @($repairProgramTarget.ProgramRoot, $repairProgramTarget.ProfileRoot)) -Expected $incompleteProgramFingerprint -Message "A partial repair failure must restore the exact incomplete pre-repair state."
    Assert-NoTransactionResidue -Target $repairProgramTarget -Message "A rolled-back repair must remove transaction staging."
    $repairProgramResult = Invoke-FenneviaPackageAction -Action Repair -FirefoxPath $repairProgramTarget.FirefoxPath -ProfilePath $repairProgramTarget.ProfileRoot -PackageRoot $script:RepositoryRoot
    Assert-Equal -Actual $repairProgramResult.Status -Expected "applied" -Message "Program repair must apply the reviewed reconstruction."
    Assert-Equal -Actual (Get-TestTreeFingerprint -Roots @($repairProgramTarget.ProgramRoot, $repairProgramTarget.ProfileRoot)) -Expected $completeProgramFingerprint -Message "Program repair must reconstruct the exact prior installation."
    $repairedProgramOwnership = Get-Content -Raw -LiteralPath (Join-Path $repairProgramTarget.ProgramRoot ".fennevia\ownership.json")
    $survivingProfileOwnership = Get-Content -Raw -LiteralPath (Join-Path $repairProgramTarget.ProfileRoot ".fennevia\ownership.json")
    Assert-Equal -Actual $repairedProgramOwnership -Expected $survivingProfileOwnership -Message "Repair must restore a byte-identical ownership pair."
    $secondRepair = Invoke-FenneviaPackageAction -Action Repair -FirefoxPath $repairProgramTarget.FirefoxPath -ProfilePath $repairProgramTarget.ProfileRoot -PackageRoot $script:RepositoryRoot
    Assert-Equal -Actual $secondRepair.Status -Expected "already-complete" -Message "Repair must be idempotent after reconstruction."
    Assert-Equal -Actual $secondRepair.PlannedMutationCount -Expected 0 -Message "A complete ownership pair must require no repair mutation."

    $repairProfileTarget = New-TestFirefoxTarget -Name "repair-profile"
    [void] (Invoke-FenneviaPackageAction -Action Install -FirefoxPath $repairProfileTarget.FirefoxPath -ProfilePath $repairProfileTarget.ProfileRoot -PackageRoot $script:RepositoryRoot)
    $completeProfileFingerprint = Get-TestTreeFingerprint -Roots @($repairProfileTarget.ProgramRoot, $repairProfileTarget.ProfileRoot)
    Remove-TestInstalledScope -Target $repairProfileTarget -Scope profile
    $incompleteProfileFingerprint = Get-TestTreeFingerprint -Roots @($repairProfileTarget.ProgramRoot, $repairProfileTarget.ProfileRoot)
    $repairProfilePlan = Invoke-FenneviaPackageAction -Action Repair -FirefoxPath $repairProfileTarget.FirefoxPath -ProfilePath $repairProfileTarget.ProfileRoot -PackageRoot $script:RepositoryRoot -DryRun
    Assert-Equal -Actual $repairProfilePlan.Status -Expected "repairable-profile" -Message "Repair preview must identify the missing profile ownership side."
    Assert-Equal -Actual (Get-TestTreeFingerprint -Roots @($repairProfileTarget.ProgramRoot, $repairProfileTarget.ProfileRoot)) -Expected $incompleteProfileFingerprint -Message "Profile repair dry-run must not mutate either selected root."
    Assert-True -Condition (@($repairProfilePlan.Operations | Where-Object { $_.Scope -ne "profile" }).Count -eq 0) -Message "Profile repair must plan mutations only on the missing profile side."
    [void] (Invoke-FenneviaPackageAction -Action Repair -FirefoxPath $repairProfileTarget.FirefoxPath -ProfilePath $repairProfileTarget.ProfileRoot -PackageRoot $script:RepositoryRoot)
    Assert-Equal -Actual (Get-TestTreeFingerprint -Roots @($repairProfileTarget.ProgramRoot, $repairProfileTarget.ProfileRoot)) -Expected $completeProfileFingerprint -Message "Profile repair must reconstruct the exact prior installation."

    $repairMismatchTarget = New-TestFirefoxTarget -Name "repair-source-mismatch"
    [void] (Invoke-FenneviaPackageAction -Action Install -FirefoxPath $repairMismatchTarget.FirefoxPath -ProfilePath $repairMismatchTarget.ProfileRoot -PackageRoot $versionOnePackage)
    Remove-TestInstalledScope -Target $repairMismatchTarget -Scope program
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_REPAIR_SOURCE_MISMATCH" -Message "Repair must require the exact package source recorded by the survivor." -Operation {
        Invoke-FenneviaPackageAction -Action Repair -FirefoxPath $repairMismatchTarget.FirefoxPath -ProfilePath $repairMismatchTarget.ProfileRoot -PackageRoot $versionTwoPackage -DryRun | Out-Null
    }

    $repairResidueTarget = New-TestFirefoxTarget -Name "repair-residue"
    [void] (Invoke-FenneviaPackageAction -Action Install -FirefoxPath $repairResidueTarget.FirefoxPath -ProfilePath $repairResidueTarget.ProfileRoot -PackageRoot $script:RepositoryRoot)
    Remove-TestInstalledScope -Target $repairResidueTarget -Scope program
    Copy-Item -LiteralPath (Join-Path $script:RepositoryRoot "program\fennevia.cfg") -Destination (Join-Path $repairResidueTarget.ProgramRoot "fennevia.cfg")
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_REPAIR_RESIDUE" -Message "Repair must reject a partially retained missing-side file set." -Operation {
        Invoke-FenneviaPackageAction -Action Repair -FirefoxPath $repairResidueTarget.FirefoxPath -ProfilePath $repairResidueTarget.ProfileRoot -PackageRoot $script:RepositoryRoot -DryRun | Out-Null
    }

    $repairUnmarkedTarget = New-TestFirefoxTarget -Name "repair-unmarked"
    [void] (Invoke-FenneviaPackageAction -Action Install -FirefoxPath $repairUnmarkedTarget.FirefoxPath -ProfilePath $repairUnmarkedTarget.ProfileRoot -PackageRoot $script:RepositoryRoot)
    Remove-TestInstalledScope -Target $repairUnmarkedTarget -Scope program
    Remove-Item -LiteralPath (Join-Path $repairUnmarkedTarget.ProfileRoot ".fennevia-dev-profile.json") -Force
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_UNMARKED_PROFILE" -Message "One-sided repair must remain limited to the marker-owned development profile." -Operation {
        Invoke-FenneviaPackageAction -Action Repair -FirefoxPath $repairUnmarkedTarget.FirefoxPath -ProfilePath $repairUnmarkedTarget.ProfileRoot -PackageRoot $script:RepositoryRoot -DryRun | Out-Null
    }

    $installedConfig = Join-Path $updateTarget.ProgramRoot "fennevia.cfg"
    $originalConfig = [IO.File]::ReadAllText($installedConfig)
    Write-TestFile -Path $installedConfig -Content ($originalConfig + "foreign change")
    $beforeConflictUninstall = Get-TestTreeFingerprint -Roots @($updateTarget.ProgramRoot, $updateTarget.ProfileRoot)
    Assert-ThrowsCode -Code "FENNEVIA_INSTALL_OWNED_FILE_MODIFIED" -Message "Uninstall must reject an unexplained owned-file hash mismatch." -Operation {
        Invoke-FenneviaPackageAction -Action Uninstall -FirefoxPath $updateTarget.FirefoxPath -ProfilePath $updateTarget.ProfileRoot -PackageRoot $versionTwoPackage | Out-Null
    }
    Assert-Equal -Actual (Get-TestTreeFingerprint -Roots @($updateTarget.ProgramRoot, $updateTarget.ProfileRoot)) -Expected $beforeConflictUninstall -Message "An ownership conflict must abort uninstall before mutation."
    Copy-Item -LiteralPath (Join-Path $versionTwoPackage "program\fennevia.cfg") -Destination $installedConfig -Force
    [void] (Invoke-FenneviaPackageAction -Action Uninstall -FirefoxPath $updateTarget.FirefoxPath -ProfilePath $updateTarget.ProfileRoot -PackageRoot $versionTwoPackage)
    Assert-True -Condition (Test-Path -LiteralPath (Join-Path $updateTarget.ProfileRoot "chrome\preserved.css") -PathType Leaf) -Message "Final uninstall must still preserve unrelated profile content."

    $cliTarget = New-TestFirefoxTarget -Name "cli"
    $enginePath = (Get-Process -Id $PID).Path
    $cliScript = Join-Path $script:RepositoryRoot "scripts\fennevia-package.ps1"
    $priorErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $cliOutput = @(& $enginePath -NoProfile -ExecutionPolicy Bypass -File $cliScript -Action Install -FirefoxPath $cliTarget.FirefoxPath -ProfilePath $cliTarget.ProfileRoot -WhatIf 2>&1)
        $cliExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $priorErrorAction
    }
    if ($cliExitCode -ne 0) {
        throw "Assertion failed: The CLI WhatIf plan must succeed. Child output: $($cliOutput -join ' ')"
    }
    $cliText = $cliOutput -join [Environment]::NewLine
    Assert-True -Condition (-not $cliText.Contains($script:TestRoot)) -Message "The CLI must redact local program and profile paths."
    Assert-True -Condition ($cliText.Contains("event=installer.plan")) -Message "The CLI must emit a structured dry-run plan."
    Assert-True -Condition ($cliText.Contains("planSha256=")) -Message "The CLI plan must expose its deterministic confirmation digest."
    Assert-True -Condition (-not (Test-Path -LiteralPath (Join-Path $cliTarget.ProgramRoot ".fennevia"))) -Message "The CLI WhatIf mode must not mutate the program target."
    Assert-True -Condition (-not (Test-Path -LiteralPath (Join-Path $cliTarget.ProfileRoot "chrome\fennevia"))) -Message "The CLI WhatIf mode must not mutate the profile target."

    $cliActualTarget = New-TestFirefoxTarget -Name "cli-actual"
    $cliActualOutput = @(& $enginePath -NoProfile -ExecutionPolicy Bypass -File $cliScript -Action Install -FirefoxPath $cliActualTarget.FirefoxPath -ProfilePath $cliActualTarget.ProfileRoot -AcceptPlan 2>&1)
    Assert-Equal -Actual $LASTEXITCODE -Expected 0 -Message "The CLI must execute the exact confirmed plan."
    $cliActualDigests = @($cliActualOutput | ForEach-Object { [string] $_ } | Where-Object { $_.StartsWith("planSha256=", [StringComparison]::Ordinal) })
    Assert-Equal -Actual $cliActualDigests.Count -Expected 2 -Message "The CLI must emit one preview and one applied plan digest."
    Assert-Equal -Actual $cliActualDigests[1] -Expected $cliActualDigests[0] -Message "The applied CLI plan digest must match its preview."
    Remove-TestInstalledScope -Target $cliActualTarget -Scope program
    $cliRepairOutput = @(& $enginePath -NoProfile -ExecutionPolicy Bypass -File $cliScript -Action Repair -FirefoxPath $cliActualTarget.FirefoxPath -ProfilePath $cliActualTarget.ProfileRoot -WhatIf 2>&1)
    Assert-Equal -Actual $LASTEXITCODE -Expected 0 -Message "The CLI must preview an explicit one-sided repair."
    $cliRepairText = $cliRepairOutput -join [Environment]::NewLine
    Assert-True -Condition (-not $cliRepairText.Contains($script:TestRoot)) -Message "The CLI repair preview must redact local target paths."
    Assert-True -Condition ($cliRepairText.Contains("status=repairable-program")) -Message "The CLI repair preview must identify the missing program side."
    Assert-True -Condition (-not (Test-Path -LiteralPath (Join-Path $cliActualTarget.ProgramRoot ".fennevia"))) -Message "The CLI repair preview must not reconstruct ownership."
    [void] (Invoke-FenneviaPackageAction -Action Repair -FirefoxPath $cliActualTarget.FirefoxPath -ProfilePath $cliActualTarget.ProfileRoot -PackageRoot $script:RepositoryRoot)
    [void] (Invoke-FenneviaPackageAction -Action Uninstall -FirefoxPath $cliActualTarget.FirefoxPath -ProfilePath $cliActualTarget.ProfileRoot -PackageRoot $script:RepositoryRoot)

    Write-Output "PASS: installer target validation, dry-run, ownership, idempotency, hard disable, update, repair, uninstall, permission failure, and rollback tests."
}
finally {
    Remove-Module FenneviaInstaller, FirefoxDevProfile -ErrorAction SilentlyContinue
    $env:LOCALAPPDATA = $originalLocalAppData
    $env:APPDATA = $originalAppData
    $env:USERPROFILE = $originalUserProfile
    if (
        (Test-Path -LiteralPath $canonicalTestRoot) -and
        $canonicalTestRoot.StartsWith($canonicalTempRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)
    ) {
        Remove-Item -LiteralPath $canonicalTestRoot -Recurse -Force
    }
}
