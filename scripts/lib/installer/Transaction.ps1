function Get-FenneviaInstallerPlanSha256 {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Plan
    )

    $operations = @(
        $Plan.Operations |
            ForEach-Object {
                $isOwnershipRecord = $_.Path -ceq "$($script:MetadataDirectoryName)/$($script:OwnershipFileName)"
                [ordered]@{
                    kind = $_.Kind
                    scope = $_.Scope
                    path = $_.Path
                    destinationPath = $_.DestinationPath
                    expectedHash = if ($isOwnershipRecord) { "" } else { $_.ExpectedHash }
                    existingHash = if ($isOwnershipRecord) { "" } else { $_.ExistingHash }
                }
            }
    )
    $packageManifestSha256 = if ($null -eq $Plan.Package) { "" } else { $Plan.Package.ManifestSha256 }
    $ownershipSha256 = if ($null -eq $Plan.OwnershipPair) { "" } else { Get-FenneviaInstallerStringSha256 -Content $Plan.OwnershipPair.Content }
    $identity = [ordered]@{
        schemaVersion = 1
        action = $Plan.Action
        status = $Plan.Status
        profileMode = $Plan.Targets.ProfileMode
        packageVersion = $Plan.PackageVersion
        state = $Plan.State
        packageManifestSha256 = $packageManifestSha256
        ownershipSha256 = $ownershipSha256
        operations = $operations
    }
    return Get-FenneviaInstallerStringSha256 -Content (($identity | ConvertTo-Json -Depth 8) + [Environment]::NewLine)
}

function Get-FenneviaInstallerOperationTarget {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets,

        [Parameter(Mandatory)]
        [object] $Operation,

        [switch] $Destination
    )

    $root = Get-FenneviaInstallerScopeRoot -Targets $Targets -Scope $Operation.Scope
    $relativePath = if ($Destination) { $Operation.DestinationPath } else { $Operation.Path }
    $target = Join-FenneviaInstallerRootPath -Root $root -RelativePath $relativePath
    Assert-FenneviaInstallerNoReparseAncestor -Path $target
    return $target
}

function New-FenneviaInstallerTransactionRoot {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string] $Root,

        [Parameter(Mandatory)]
        [ValidateSet("program", "profile")]
        [string] $Scope,

        [Parameter(Mandatory)]
        [string] $TransactionId
    )

    $name = ".fennevia-transaction-$TransactionId"
    $transactionRoot = Join-FenneviaInstallerRootPath -Root $Root -RelativePath $name
    if (Test-Path -LiteralPath $transactionRoot) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_TRANSACTION_CONFLICT" -Message "The selected root already contains the generated transaction path."
    }

    New-Item -ItemType Directory -Path $transactionRoot | Out-Null
    $marker = [ordered]@{
        schemaVersion = 1
        owner = $script:TransactionMarkerOwner
        transactionId = $TransactionId
        scope = $Scope
    }
    Write-FenneviaInstallerUtf8NoBom -Path (Join-Path $transactionRoot $script:TransactionMarkerName) -Content (($marker | ConvertTo-Json) + [Environment]::NewLine)
    return [pscustomobject]@{
        Scope = $Scope
        Root = $transactionRoot
        TransactionId = $TransactionId
    }
}

function Remove-FenneviaInstallerTransactionRoot {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Transaction
    )

    if (-not (Test-Path -LiteralPath $Transaction.Root)) {
        return
    }
    if (-not (Test-Path -LiteralPath $Transaction.Root -PathType Container)) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_TRANSACTION_CLEANUP" -Message "A transaction root is no longer a directory."
    }

    $markerPath = Join-Path $Transaction.Root $script:TransactionMarkerName
    if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_TRANSACTION_CLEANUP" -Message "A transaction root is missing its ownership marker."
    }
    try {
        $marker = Get-Content -Raw -LiteralPath $markerPath | ConvertFrom-Json
    }
    catch {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_TRANSACTION_CLEANUP" -Message "A transaction marker is invalid."
    }
    if (
        [int] $marker.schemaVersion -ne 1 -or
        [string] $marker.owner -cne $script:TransactionMarkerOwner -or
        [string] $marker.transactionId -cne $Transaction.TransactionId -or
        [string] $marker.scope -cne $Transaction.Scope
    ) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_TRANSACTION_CLEANUP" -Message "A transaction marker does not prove ownership."
    }

    Assert-FenneviaInstallerNoReparseAncestor -Path $Transaction.Root -Code "FENNEVIA_INSTALL_TRANSACTION_CLEANUP"
    Assert-FenneviaInstallerTreeHasNoReparsePoints -Path $Transaction.Root -Code "FENNEVIA_INSTALL_TRANSACTION_CLEANUP"
    Remove-Item -LiteralPath $Transaction.Root -Recurse -Force
}

function Write-FenneviaInstallerTransactionJournal {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Transaction,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [object[]] $FileSnapshots,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [object[]] $DirectorySnapshots,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [object[]] $Operations
    )

    $files = @(
        $FileSnapshots |
            Where-Object { $_.Scope -eq $Transaction.Scope } |
            Sort-Object RelativePath |
            ForEach-Object {
                [ordered]@{
                    path = $_.RelativePath
                    existed = [bool] $_.Existed
                    backup = if ($_.Existed) { $_.BackupRelativePath } else { "" }
                    backupSha256 = if ($_.Existed) { Get-FenneviaInstallerSha256 -Path $_.BackupPath } else { "" }
                }
            }
    )
    $directories = @(
        $DirectorySnapshots |
            Where-Object { $_.Scope -eq $Transaction.Scope } |
            Sort-Object RelativePath |
            ForEach-Object {
                [ordered]@{
                    path = $_.RelativePath
                    existed = [bool] $_.Existed
                }
            }
    )
    $operationsForScope = @(
        $Operations |
            Where-Object { $_.Scope -eq $Transaction.Scope } |
            ForEach-Object {
                [ordered]@{
                    kind = $_.Kind
                    path = $_.Path
                    destinationPath = $_.DestinationPath
                    expectedHash = $_.ExpectedHash
                    existingHash = $_.ExistingHash
                }
            }
    )
    $journal = [ordered]@{
        schemaVersion = 1
        owner = $script:TransactionMarkerOwner
        transactionId = $Transaction.TransactionId
        scope = $Transaction.Scope
        state = "prepared"
        files = $files
        directories = $directories
        operations = $operationsForScope
    }
    $content = ($journal | ConvertTo-Json -Depth 8) + [Environment]::NewLine
    $journalPath = Join-Path $Transaction.Root $script:TransactionJournalName
    $temporaryPath = "$journalPath.tmp"
    Write-FenneviaInstallerUtf8NoBom -Path $temporaryPath -Content $content
    if (Test-Path -LiteralPath $journalPath -PathType Leaf) {
        [IO.File]::Replace($temporaryPath, $journalPath, $null)
    }
    else {
        [IO.File]::Move($temporaryPath, $journalPath)
    }
}

function New-FenneviaInstallerFileSnapshot {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Targets,

        [Parameter(Mandatory)]
        [object] $Transactions,

        [Parameter(Mandatory)]
        [ValidateSet("program", "profile")]
        [string] $Scope,

        [Parameter(Mandatory)]
        [string] $RelativePath,

        [Parameter(Mandatory)]
        [bool] $ExistingOwned,

        [string] $ExpectedExistingHash = "",

        [int] $Index
    )

    $root = Get-FenneviaInstallerScopeRoot -Targets $Targets -Scope $Scope
    $path = Join-FenneviaInstallerRootPath -Root $root -RelativePath $RelativePath
    Assert-FenneviaInstallerNoReparseAncestor -Path $path
    $exists = Test-Path -LiteralPath $path
    if ($exists -and -not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_FILE_CONFLICT" -Message "A managed file target is occupied by a non-file entry."
    }
    if ($exists -and -not $ExistingOwned) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_FILE_CONFLICT" -Message "A transaction would overwrite content not proven project-owned."
    }
    if ($exists -and $ExistingOwned) {
        if ([string]::IsNullOrWhiteSpace($ExpectedExistingHash)) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_TRANSACTION_PLAN_INVALID" -Message "A transaction plan omitted the expected hash for existing project-owned content."
        }
        if ((Get-FenneviaInstallerSha256 -Path $path) -cne $ExpectedExistingHash) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNED_FILE_MODIFIED" -Message "An ownership-listed file changed after preflight."
        }
    }

    $backupPath = ""
    $backupRelativePath = ""
    if ($exists) {
        $transaction = $Transactions[$Scope]
        $backupRoot = Join-Path $transaction.Root "backup"
        New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
        $backupPath = Join-Path $backupRoot ("{0:D4}.bin" -f $Index)
        $backupRelativePath = "backup/$([IO.Path]::GetFileName($backupPath))"
        [IO.File]::Copy($path, $backupPath, $false)
        if ((Get-FenneviaInstallerSha256 -Path $backupPath) -cne (Get-FenneviaInstallerSha256 -Path $path)) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_BACKUP_FAILED" -Message "A transaction backup did not verify."
        }
    }

    return [pscustomobject]@{
        Scope = $Scope
        RelativePath = $RelativePath
        Path = $path
        Existed = $exists
        BackupPath = $backupPath
        BackupRelativePath = $backupRelativePath
    }
}

function Restore-FenneviaInstallerSnapshots {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [object[]] $FileSnapshots,

        [Parameter(Mandatory)]
        [AllowEmptyCollection()]
        [object[]] $DirectorySnapshots
    )

    $failures = New-Object "Collections.Generic.List[string]"
    foreach ($snapshot in @($FileSnapshots | Sort-Object @{ Expression = { ($_.RelativePath -split "/").Count }; Descending = $true })) {
        try {
            if ($snapshot.Existed) {
                $parent = Split-Path -Parent $snapshot.Path
                if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
                    New-Item -ItemType Directory -Path $parent -Force | Out-Null
                }
                if (Test-Path -LiteralPath $snapshot.Path) {
                    if (-not (Test-Path -LiteralPath $snapshot.Path -PathType Leaf)) {
                        throw "The rollback target is not a regular file."
                    }
                    [IO.File]::Delete($snapshot.Path)
                }
                [IO.File]::Copy($snapshot.BackupPath, $snapshot.Path, $false)
                if ((Get-FenneviaInstallerSha256 -Path $snapshot.Path) -cne (Get-FenneviaInstallerSha256 -Path $snapshot.BackupPath)) {
                    throw "The restored file hash does not match its transaction backup."
                }
            }
            elseif (Test-Path -LiteralPath $snapshot.Path) {
                if (-not (Test-Path -LiteralPath $snapshot.Path -PathType Leaf)) {
                    throw "A newly created rollback target is not a regular file."
                }
                [IO.File]::Delete($snapshot.Path)
            }
        }
        catch {
            $failures.Add("$($snapshot.Scope):$($snapshot.RelativePath)")
        }
    }

    foreach ($snapshot in @($DirectorySnapshots | Sort-Object @{ Expression = { ($_.RelativePath -split "/").Count } })) {
        if (-not $snapshot.Existed -or (Test-Path -LiteralPath $snapshot.Path -PathType Container)) {
            continue
        }
        try {
            New-Item -ItemType Directory -Path $snapshot.Path -Force | Out-Null
        }
        catch {
            $failures.Add("$($snapshot.Scope):$($snapshot.RelativePath)")
        }
    }

    foreach ($snapshot in @($DirectorySnapshots | Sort-Object @{ Expression = { ($_.RelativePath -split "/").Count }; Descending = $true })) {
        if ($snapshot.Existed -or -not (Test-Path -LiteralPath $snapshot.Path -PathType Container)) {
            continue
        }
        try {
            if (@(Get-ChildItem -Force -LiteralPath $snapshot.Path).Count -eq 0) {
                Remove-Item -LiteralPath $snapshot.Path
            }
        }
        catch {
            $failures.Add("$($snapshot.Scope):$($snapshot.RelativePath)")
        }
    }

    return @($failures | Sort-Object -Unique)
}

function Invoke-FenneviaInstallerTransaction {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [object] $Plan,

        [int] $FailureAfterMutation = 0,

        [string] $TestDenyTransactionScope = ""
    )

    if ($Plan.Operations.Count -eq 0) {
        return 0
    }
    if ($FailureAfterMutation -lt 0) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_TEST_INPUT" -Message "The test-only failure point must not be negative."
    }
    if ($TestDenyTransactionScope -notin @("", "program", "profile")) {
        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_TEST_INPUT" -Message "The test-only denied transaction scope is invalid."
    }

    Assert-FenneviaInstallerSelectedFirefoxClosed -Targets $Plan.Targets

    $directorySnapshots = New-Object "Collections.Generic.List[object]"
    $directoryKeys = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    foreach ($operation in $Plan.Operations) {
        if ($operation.Kind -notin @("CreateDirectory", "RemoveDirectoryIfEmpty")) {
            continue
        }
        $path = Get-FenneviaInstallerOperationTarget -Targets $Plan.Targets -Operation $operation
        $key = "$($operation.Scope):$($operation.Path)"
        if ($directoryKeys.Add($key)) {
            $exists = Test-Path -LiteralPath $path
            if ($exists -and -not (Test-Path -LiteralPath $path -PathType Container)) {
                Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_FILE_CONFLICT" -Message "A planned directory target is occupied by a file."
            }
            $directorySnapshots.Add([pscustomobject]@{
                Scope = $operation.Scope
                RelativePath = $operation.Path
                Path = $path
                Existed = $exists
            })
        }
    }

    $transactionId = [guid]::NewGuid().ToString("N")
    $transactions = @{}
    $fileSnapshots = New-Object "Collections.Generic.List[object]"
    $snapshotKeys = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    $attemptedFileKeys = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    $attemptedDirectoryKeys = New-Object "Collections.Generic.HashSet[string]" ([StringComparer]::OrdinalIgnoreCase)
    $mutationCount = 0
    $managedMutationAttempted = $false

    try {
        foreach ($scope in @("program", "profile")) {
            if ($scope -eq $TestDenyTransactionScope) {
                throw ([UnauthorizedAccessException]::new("A test-only transaction permission failure was injected."))
            }
            $root = Get-FenneviaInstallerScopeRoot -Targets $Plan.Targets -Scope $scope
            $transactions[$scope] = New-FenneviaInstallerTransactionRoot -Root $root -Scope $scope -TransactionId $transactionId
        }

        $operationIndex = 0
        $replaceIndex = 0
        foreach ($operation in $Plan.Operations) {
            if ($operation.Kind -in @("CreateFile", "ReplaceFile")) {
                $transaction = $transactions[$operation.Scope]
                $stageRoot = Join-Path $transaction.Root "stage"
                New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null
                $stagePath = Join-Path $stageRoot ("{0:D4}.bin" -f $operationIndex)
                if (-not [string]::IsNullOrWhiteSpace($operation.SourcePath)) {
                    [IO.File]::Copy($operation.SourcePath, $stagePath, $false)
                }
                else {
                    Write-FenneviaInstallerUtf8NoBom -Path $stagePath -Content $operation.Content
                }
                if ((Get-FenneviaInstallerSha256 -Path $stagePath) -cne $operation.ExpectedHash) {
                    Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_STAGE_HASH_MISMATCH" -Message "A staged file did not match its expected SHA-256."
                }
                $operation.StagePath = $stagePath
            }
            $operationIndex++
        }

        $snapshotIndex = 0
        foreach ($operation in $Plan.Operations) {
            if ($operation.Kind -in @("CreateFile", "ReplaceFile", "RemoveFile", "MoveFile")) {
                $key = "$($operation.Scope):$($operation.Path)"
                if ($snapshotKeys.Add($key)) {
                    $existingHash = if ($operation.Kind -in @("RemoveFile", "MoveFile")) { $operation.ExpectedHash } else { $operation.ExistingHash }
                    $snapshot = New-FenneviaInstallerFileSnapshot -Targets $Plan.Targets -Transactions $transactions -Scope $operation.Scope -RelativePath $operation.Path -ExistingOwned:$operation.ExistingOwned -ExpectedExistingHash $existingHash -Index $snapshotIndex
                    $fileSnapshots.Add($snapshot)
                    $snapshotIndex++
                }
            }
            if ($operation.Kind -eq "MoveFile") {
                $destinationKey = "$($operation.Scope):$($operation.DestinationPath)"
                if ($snapshotKeys.Add($destinationKey)) {
                    $snapshot = New-FenneviaInstallerFileSnapshot -Targets $Plan.Targets -Transactions $transactions -Scope $operation.Scope -RelativePath $operation.DestinationPath -ExistingOwned:$false -Index $snapshotIndex
                    $fileSnapshots.Add($snapshot)
                    $snapshotIndex++
                }
            }
        }

        foreach ($transaction in @($transactions.Values)) {
            Write-FenneviaInstallerTransactionJournal -Transaction $transaction -FileSnapshots $fileSnapshots.ToArray() -DirectorySnapshots $directorySnapshots.ToArray() -Operations $Plan.Operations
        }

        Assert-FenneviaInstallerSelectedFirefoxClosed -Targets $Plan.Targets

        foreach ($operation in $Plan.Operations) {
            $target = Get-FenneviaInstallerOperationTarget -Targets $Plan.Targets -Operation $operation
            $changed = $false
            switch ($operation.Kind) {
                "CreateDirectory" {
                    if (-not (Test-Path -LiteralPath $target)) {
                        $managedMutationAttempted = $true
                        [void] $attemptedDirectoryKeys.Add("$($operation.Scope):$($operation.Path)")
                        New-Item -ItemType Directory -Path $target | Out-Null
                        $changed = $true
                    }
                }
                "CreateFile" {
                    if (Test-Path -LiteralPath $target) {
                        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_FILE_CONFLICT" -Message "A create target changed after preflight."
                    }
                    $managedMutationAttempted = $true
                    [void] $attemptedFileKeys.Add("$($operation.Scope):$($operation.Path)")
                    [IO.File]::Move($operation.StagePath, $target)
                    $changed = $true
                }
                "ReplaceFile" {
                    if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
                        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNED_FILE_MISSING" -Message "A replace target changed after preflight."
                    }
                    if ((Get-FenneviaInstallerSha256 -Path $target) -cne $operation.ExistingHash) {
                        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNED_FILE_MODIFIED" -Message "A replace target changed after its transaction backup."
                    }
                    $replaceBackupRoot = Join-Path $transactions[$operation.Scope].Root "replace-backup"
                    New-Item -ItemType Directory -Path $replaceBackupRoot -Force | Out-Null
                    $replaceBackupPath = Join-Path $replaceBackupRoot ("{0:D4}.bin" -f $replaceIndex)
                    $managedMutationAttempted = $true
                    [void] $attemptedFileKeys.Add("$($operation.Scope):$($operation.Path)")
                    [IO.File]::Replace($operation.StagePath, $target, $replaceBackupPath)
                    $replaceIndex++
                    $changed = $true
                }
                "RemoveFile" {
                    if (Test-Path -LiteralPath $target -PathType Leaf) {
                        if ((Get-FenneviaInstallerSha256 -Path $target) -cne $operation.ExpectedHash) {
                            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNED_FILE_MODIFIED" -Message "A remove target changed after preflight."
                        }
                        $managedMutationAttempted = $true
                        [void] $attemptedFileKeys.Add("$($operation.Scope):$($operation.Path)")
                        [IO.File]::Delete($target)
                        $changed = $true
                    }
                }
                "MoveFile" {
                    $destination = Get-FenneviaInstallerOperationTarget -Targets $Plan.Targets -Operation $operation -Destination
                    if (-not (Test-Path -LiteralPath $target -PathType Leaf) -or (Test-Path -LiteralPath $destination)) {
                        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_STATE_CONFLICT" -Message "A hard-disable move target changed after preflight."
                    }
                    if ((Get-FenneviaInstallerSha256 -Path $target) -cne $operation.ExpectedHash) {
                        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_OWNED_FILE_MODIFIED" -Message "The hard-disable preference changed after preflight."
                    }
                    $managedMutationAttempted = $true
                    [void] $attemptedFileKeys.Add("$($operation.Scope):$($operation.Path)")
                    [void] $attemptedFileKeys.Add("$($operation.Scope):$($operation.DestinationPath)")
                    [IO.File]::Move($target, $destination)
                    $changed = $true
                }
                "RemoveDirectoryIfEmpty" {
                    if (Test-Path -LiteralPath $target -PathType Container) {
                        if (@(Get-ChildItem -Force -LiteralPath $target).Count -eq 0) {
                            $managedMutationAttempted = $true
                            [void] $attemptedDirectoryKeys.Add("$($operation.Scope):$($operation.Path)")
                            Remove-Item -LiteralPath $target
                            $changed = $true
                        }
                    }
                }
            }

            if ($changed) {
                $mutationCount++
                if ($FailureAfterMutation -gt 0 -and $mutationCount -eq $FailureAfterMutation) {
                    Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_INJECTED_FAILURE" -Message "A test-only transaction failure was injected."
                }
            }
        }

        foreach ($operation in $Plan.Operations) {
            $target = Get-FenneviaInstallerOperationTarget -Targets $Plan.Targets -Operation $operation
            switch ($operation.Kind) {
                { $_ -in @("CreateFile", "ReplaceFile") } {
                    if (-not (Test-Path -LiteralPath $target -PathType Leaf) -or (Get-FenneviaInstallerSha256 -Path $target) -cne $operation.ExpectedHash) {
                        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_COMMIT_HASH_MISMATCH" -Message "A committed file did not match its expected SHA-256."
                    }
                }
                "RemoveFile" {
                    if (Test-Path -LiteralPath $target) {
                        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_COMMIT_STATE_MISMATCH" -Message "A removed project file reappeared before transaction commit."
                    }
                }
                "MoveFile" {
                    $destination = Get-FenneviaInstallerOperationTarget -Targets $Plan.Targets -Operation $operation -Destination
                    if (
                        (Test-Path -LiteralPath $target) -or
                        -not (Test-Path -LiteralPath $destination -PathType Leaf) -or
                        (Get-FenneviaInstallerSha256 -Path $destination) -cne $operation.ExpectedHash
                    ) {
                        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_COMMIT_STATE_MISMATCH" -Message "A hard-disable move did not commit to its exact expected state."
                    }
                }
                "CreateDirectory" {
                    if (-not (Test-Path -LiteralPath $target -PathType Container)) {
                        Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_COMMIT_STATE_MISMATCH" -Message "A required project directory was not present at transaction commit."
                    }
                }
            }
        }
    }
    catch {
        $originalError = $_
        $rollbackFailures = @()
        if ($managedMutationAttempted) {
            $rollbackFileSnapshots = @($fileSnapshots | Where-Object { $attemptedFileKeys.Contains("$($_.Scope):$($_.RelativePath)") })
            $rollbackDirectorySnapshots = @($directorySnapshots | Where-Object { $attemptedDirectoryKeys.Contains("$($_.Scope):$($_.RelativePath)") })
            $rollbackFailures = @(Restore-FenneviaInstallerSnapshots -FileSnapshots $rollbackFileSnapshots -DirectorySnapshots $rollbackDirectorySnapshots)
        }

        if ($rollbackFailures.Count -gt 0) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_ROLLBACK_INCOMPLETE" -Message "Rollback was incomplete. Keep the marker-owned <PROGRAM_TRANSACTION> and <PROFILE_TRANSACTION> directories and follow each retained relative-path journal before changing any listed project path."
        }

        foreach ($transaction in @($transactions.Values)) {
            try {
                Remove-FenneviaInstallerTransactionRoot -Transaction $transaction
            }
            catch {
                Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_TRANSACTION_CLEANUP" -Message "The transaction rolled back, but a marker-owned transaction directory requires manual removal."
            }
        }
        $permissionFailure = $false
        $candidateException = $originalError.Exception
        while ($null -ne $candidateException) {
            if ($candidateException -is [UnauthorizedAccessException]) {
                $permissionFailure = $true
                break
            }
            $candidateException = $candidateException.InnerException
        }
        if ($permissionFailure) {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_PERMISSION_DENIED" -Message "The selected roots denied a transaction operation; the prior managed state was restored."
        }
        if ((Get-FenneviaInstallerErrorCode -ErrorRecord $originalError) -eq "FENNEVIA_INSTALL_UNEXPECTED") {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_TRANSACTION_FAILED" -Message "The package transaction failed unexpectedly and the prior managed state was restored. Inspect the local error record without sharing target paths."
        }
        throw $originalError
    }

    foreach ($transaction in @($transactions.Values)) {
        try {
            Remove-FenneviaInstallerTransactionRoot -Transaction $transaction
        }
        catch {
            Throw-FenneviaInstallerError -Code "FENNEVIA_INSTALL_TRANSACTION_CLEANUP" -Message "The package state committed, but a marker-owned transaction directory requires manual removal."
        }
    }

    return $mutationCount
}
