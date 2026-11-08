# SPDX-License-Identifier: MPL-2.0
# Loaded inside FenneviaRelease; uses its closed-schema and path validators.
function Get-FenneviaNativeDistributionPaths {
    param([Parameter(Mandatory)] [string] $Root)
    $manifest = Read-FenneviaReleaseJson -Path (Join-FenneviaReleaseRootPath -Root $Root -RelativePath 'INSTALLER-MANIFEST.json') -Description 'The native installer manifest'
    Assert-FenneviaReleaseExactProperties $manifest @('schemaVersion', 'platform', 'architecture', 'webview2Version', 'files') 'The native installer manifest'
    if ($manifest.schemaVersion -ne 1 -or $manifest.platform -cne 'windows' -or $manifest.architecture -cne 'x64' -or $manifest.webview2Version -cne '157.0.4341.42') { throw 'The native installer platform/runtime is unsupported.' }
    $pin = Read-FenneviaReleaseJson -Path (Join-FenneviaReleaseRootPath -Root $Root -RelativePath 'WEBVIEW2-INVENTORY.json') -Description 'The pinned runtime inventory'
    Assert-FenneviaReleaseExactProperties $pin @('version', 'architecture', 'source', 'sha256', 'files') 'The pinned runtime inventory'
    if ($pin.version -cne $manifest.webview2Version -or $pin.architecture -cne 'x64' -or $pin.sha256 -cne 'cedaf8f3d12202c8803bdbae727b01c1be34540b78e8f0a10c6b401c2a8be97d' -or
        $pin.source -cne 'https://msedge.sf.dl.delivery.mp.microsoft.com/filestreamingservice/files/b7b22a57-b321-483e-9855-d260b076f1a7/Microsoft.WebView2.FixedVersionRuntime.157.0.4341.42.x64.cab') { throw 'The native runtime pin is unsupported.' }
    $expected = New-Object 'Collections.Generic.Dictionary[string,object]' ([StringComparer]::Ordinal)
    foreach ($file in @($pin.files)) {
        Assert-FenneviaReleaseExactProperties $file @('path', 'sha256', 'size') 'A pinned runtime file'
        $path = ConvertTo-FenneviaReleaseRelativePath ([string] $file.path)
        if (-not $path.StartsWith('WebView2/', [StringComparison]::Ordinal) -or $expected.ContainsKey($path)) { throw 'The runtime pin contains an invalid or duplicate path.' }
        Assert-FenneviaReleaseHash ([string] $file.sha256)
        $expected.Add($path, $file)
    }
    if ($expected.Count -ne 257) { throw 'The pinned runtime inventory has an unexpected size.' }
    foreach ($path in @('FenneviaSetup.exe', 'fennevia-installer-worker.exe', 'INSTALLER-NOTICES.txt', 'WEBVIEW2-LICENSE.txt', 'WEBVIEW2-INVENTORY.json')) { $expected.Add($path, $null) }
    if (@($manifest.files).Count -ne $expected.Count) { throw 'The native distribution inventory is incomplete.' }
    $seen = New-Object 'Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)
    foreach ($file in @($manifest.files)) {
        Assert-FenneviaReleaseExactProperties $file @('path', 'sha256', 'size') 'A native installer file'
        $path = ConvertTo-FenneviaReleaseRelativePath ([string] $file.path)
        Assert-FenneviaReleaseHash ([string] $file.sha256)
        if (-not $expected.ContainsKey($path) -or -not $seen.Add($path) -or [long] $file.size -lt 0 -or [long] $file.size -gt 512MB) { throw 'A native installer file record is invalid.' }
        $pinned = $expected[$path]
        if ($null -ne $pinned -and ($pinned.sha256 -cne $file.sha256 -or $pinned.size -ne $file.size)) { throw 'A native runtime file differs from the pin.' }
        $source = Join-FenneviaReleaseRootPath -Root $Root -RelativePath $path
        Assert-FenneviaReleaseNoReparseAncestor $source
        if (-not (Test-Path -LiteralPath $source -PathType Leaf) -or (Get-Item -LiteralPath $source).Length -ne [long] $file.size -or (Get-FenneviaReleaseSha256 $source) -cne $file.sha256) { throw 'A native installer file differs from its recorded size or hash.' }
    }
    return @('INSTALLER-MANIFEST.json') + @($seen | Sort-Object)
}
