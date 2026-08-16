#requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string] $FirefoxPath,

    [Parameter(Mandatory)]
    [string] $ProfilePath
)

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

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory)]
        [string] $Path,

        [Parameter(Mandatory)]
        [string] $Content
    )

    [IO.File]::WriteAllText($Path, $Content, (New-Object Text.UTF8Encoding($false)))
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$canonicalFirefox = [IO.Path]::GetFullPath($FirefoxPath)
$canonicalProfile = [IO.Path]::GetFullPath($ProfilePath).TrimEnd("\", "/")
$managedRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA "fennevia")).TrimEnd("\", "/")
$programRoot = Split-Path -Parent $canonicalFirefox
$profilePrefix = [IO.Path]::GetFullPath((Join-Path $managedRoot "profiles")).TrimEnd("\", "/") + [IO.Path]::DirectorySeparatorChar
$programPrefix = [IO.Path]::GetFullPath((Join-Path $managedRoot "program-spikes")).TrimEnd("\", "/") + [IO.Path]::DirectorySeparatorChar

Assert-True -Condition $canonicalProfile.StartsWith($profilePrefix, [StringComparison]::OrdinalIgnoreCase) -Message "The recovery profile must remain below the Fennevia managed profile root."
Assert-True -Condition $programRoot.StartsWith($programPrefix, [StringComparison]::OrdinalIgnoreCase) -Message "The recovery program must remain below the Fennevia copied-program root."
Assert-True -Condition (Test-Path -LiteralPath $canonicalFirefox -PathType Leaf) -Message "The copied Firefox executable is missing."
Assert-True -Condition (@(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'").Count -eq 0) -Message "Every Firefox process must be closed before bridge recovery testing."

$profileMarker = Get-Content -Raw -LiteralPath (Join-Path $canonicalProfile ".fennevia-dev-profile.json") | ConvertFrom-Json
$programMarker = Get-Content -Raw -LiteralPath (Join-Path $programRoot ".fennevia-program-spike.json") | ConvertFrom-Json
Assert-True -Condition (
    [int] $profileMarker.schemaVersion -eq 1 -and
    [string] $profileMarker.owner -ceq "fennevia" -and
    [string] $profileMarker.profileName -ceq "fennevia-dev"
) -Message "The development profile marker is not owned by this test."
Assert-True -Condition (
    [int] $programMarker.schemaVersion -eq 1 -and
    [string] $programMarker.owner -ceq "fennevia" -and
    [string] $programMarker.purpose -ceq "firefox-identity-regression" -and
    [string] $programMarker.state -ceq "ready"
) -Message "The copied Firefox program marker is not owned by this test."

$manifest = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot "package-manifest.json") | ConvertFrom-Json
$relativeTarget = "chrome/fennevia/content/firefox/BridgeBoundary.sys.mjs"
$fileEntry = @($manifest.files | Where-Object { $_.path -ceq $relativeTarget })
Assert-True -Condition ($fileEntry.Count -eq 1) -Message "The bridge recovery target must have one package-manifest entry."
$expectedHash = [string] $fileEntry[0].sha256
$targetPath = [IO.Path]::GetFullPath((Join-Path $canonicalProfile ($relativeTarget.Replace("/", "\"))))
Assert-True -Condition $targetPath.StartsWith($canonicalProfile + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -Message "The bridge recovery target escaped the managed profile."
Assert-True -Condition (Test-Path -LiteralPath $targetPath -PathType Leaf) -Message "The installed bridge artifact is missing."
Assert-True -Condition ((Get-FileHash -Algorithm SHA256 -LiteralPath $targetPath).Hash.ToLowerInvariant() -ceq $expectedHash) -Message "The installed bridge artifact does not match the committed package hash."

$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd("\", "/")
$tempRoot = [IO.Path]::GetFullPath((Join-Path $tempBase ("fennevia-bridge-recovery-" + [guid]::NewGuid().ToString("N"))))
Assert-True -Condition $tempRoot.StartsWith($tempBase + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -Message "The temporary recovery root escaped the operating-system temporary directory."
New-Item -ItemType Directory -Path $tempRoot | Out-Null
$bridgeBackupPath = Join-Path $tempRoot "BridgeBoundary.sys.mjs"
Copy-Item -LiteralPath $targetPath -Destination $bridgeBackupPath

$node = Get-Command node -ErrorAction Stop
$harnessPath = Join-Path $repositoryRoot "tests\firefox-window-lifecycle.mjs"
$testFailure = $null
$missingCapabilityBridge = @'
export function createFirefoxBridgeBoundary({
  buildId,
  contextId,
  firefoxVersion,
  windowKind,
}) {
  let disposed = false;
  return Object.freeze({
    assertRequiredCapabilities() {
      const error = new Error("FENNEVIA_FIREFOX_CAPABILITY_MISSING");
      Object.defineProperties(error, {
        fenneviaBuildId: { value: String(buildId), enumerable: false },
        fenneviaCode: {
          value: "FENNEVIA_FIREFOX_CAPABILITY_MISSING",
          enumerable: false,
        },
        fenneviaFirefoxVersion: {
          value: String(firefoxVersion),
          enumerable: false,
        },
        fenneviaPhase: {
          value: "firefox-bridge-capability",
          enumerable: false,
        },
        fenneviaSymbol: { value: "window.gBrowser", enumerable: false },
        fenneviaWindowKind: { value: windowKind, enumerable: false },
        name: {
          value: "FenneviaFirefoxBridgeTestError",
          enumerable: false,
        },
      });
      throw error;
    },
    dispose() {
      if (disposed) {
        return false;
      }
      disposed = true;
      return true;
    },
    getCapabilities() {
      return Object.freeze([]);
    },
    snapshot() {
      return Object.freeze({
        buildId: String(buildId),
        contextId,
        disposed,
        firefoxVersion: String(firefoxVersion),
        windowKind,
      });
    },
  });
}

export function createFirefoxNavigationBridge() {
  let disposed = false;
  const navigation = Object.freeze({
    back() { return false; },
    focusContent() { return true; },
    forward() { return false; },
    home() { return true; },
    newTab() { return true; },
    reload() { return true; },
    reloadOrStop() { return "reload"; },
    snapshot() {
      return Object.freeze({
        addressValue: "",
        canGoBack: false,
        canGoForward: false,
        connectionSecurity: "unavailable",
        displayUri: "about:blank",
        loading: false,
        title: "",
        trackingProtection: "unavailable",
      });
    },
    stop() { return false; },
    submitAddress() { return Object.freeze({ status: "accepted" }); },
    subscribe() {
      let active = true;
      return () => {
        if (!active) {
          return false;
        }
        active = false;
        return true;
      };
    },
    subscribeAddressPopupOpen() {
      let active = true;
      return () => {
        if (!active) {
          return false;
        }
        active = false;
        return true;
      };
    },
  });
  return Object.freeze({
    assertRequiredCapabilities() { return Object.freeze([]); },
    dispose() {
      if (disposed) {
        return false;
      }
      disposed = true;
      return true;
    },
    navigation,
  });
}

export function createFirefoxBookmarksBridge() {
  let disposed = false;
  const roots = Object.freeze([
    Object.freeze({ hasChildren: false, id: "root-toolbar", kind: "folder", title: "Toolbar" }),
    Object.freeze({ hasChildren: false, id: "root-menu", kind: "folder", title: "Menu" }),
    Object.freeze({ hasChildren: false, id: "root-unfiled", kind: "folder", title: "Other" }),
    Object.freeze({ hasChildren: false, id: "root-mobile", kind: "folder", title: "Mobile" }),
  ]);
  const bookmarks = Object.freeze({
    async children(parentId, { offset = 0 } = {}) {
      return Object.freeze({ items: Object.freeze([]), offset, parentId, status: "ok", totalCount: 0, truncated: false });
    },
    async open() { return Object.freeze({ reason: "stale", status: "rejected" }); },
    async roots() { return roots; },
    subscribe() { return () => true; },
  });
  return Object.freeze({
    assertRequiredCapabilities() { return Object.freeze([]); },
    bookmarks,
    dispose() {
      if (disposed) { return false; }
      disposed = true;
      return true;
    },
  });
}

export function createFirefoxDownloadsBridge() {
  let disposed = false;
  const state = Object.freeze({
    activeCount: 0,
    aggregatePercent: null,
    canceledCount: 0,
    countOverflow: false,
    failedCount: 0,
    items: Object.freeze([]),
    pausedCount: 0,
    phase: "ready",
    progressMode: "none",
    queuedCount: 0,
    revision: 1,
    succeededCount: 0,
    truncated: false,
  });
  const downloads = Object.freeze({
    async ready() { return true; },
    snapshot() { return state; },
    subscribe() { return () => true; },
  });
  return Object.freeze({
    assertRequiredCapabilities() { return Object.freeze([]); },
    dispose() {
      if (disposed) { return false; }
      disposed = true;
      return true;
    },
    downloads,
    async ready() { return true; },
  });
}

export function createFirefoxTabsBridge() {
  let disposed = false;
  const tabs = Object.freeze({
    close() {},
    move() {},
    open() { return "tab-registry-1-handle-1"; },
    openContextMenu() {},
    pin() {},
    select() {},
    snapshot() { return Object.freeze([]); },
    subscribe() {
      let active = true;
      return () => {
        if (!active) {
          return false;
        }
        active = false;
        return true;
      };
    },
    toggleMute() {},
    unpin() {},
  });
  return Object.freeze({
    assertRequiredCapabilities() { return Object.freeze([]); },
    dispose() {
      if (disposed) {
        return false;
      }
      disposed = true;
      return true;
    },
    tabs,
  });
}
'@

$missingBookmarksCapabilityBridge = @'
export function createFirefoxBridgeBoundary({
  buildId,
  contextId,
  firefoxVersion,
  windowKind,
}) {
  let disposed = false;
  return Object.freeze({
    dispose() {
      if (disposed) {
        return false;
      }
      disposed = true;
      return true;
    },
    snapshot() {
      return Object.freeze({
        buildId: String(buildId),
        contextId,
        disposed,
        firefoxVersion: String(firefoxVersion),
        windowKind,
      });
    },
  });
}

export function createFirefoxBookmarksBridge({ boundary }) {
  const context = boundary.snapshot();
  const error = new Error("FENNEVIA_FIREFOX_BOOKMARKS_CAPABILITY_MISSING");
  Object.defineProperties(error, {
    fenneviaBuildId: { value: context.buildId, enumerable: false },
    fenneviaCode: {
      value: "FENNEVIA_FIREFOX_BOOKMARKS_CAPABILITY_MISSING",
      enumerable: false,
    },
    fenneviaFirefoxVersion: {
      value: context.firefoxVersion,
      enumerable: false,
    },
    fenneviaPhase: {
      value: "firefox-bookmarks-capability",
      enumerable: false,
    },
    fenneviaSymbol: {
      value: "PlacesUtils.bookmarks.fetch",
      enumerable: false,
    },
    fenneviaWindowKind: { value: context.windowKind, enumerable: false },
    name: {
      value: "FenneviaFirefoxBookmarksBridgeTestError",
      enumerable: false,
    },
  });
  throw error;
}

export function createFirefoxDownloadsBridge() {
  throw new Error("FENNEVIA_TEST_DOWNLOADS_SHOULD_NOT_INITIALIZE");
}

export function createFirefoxNavigationBridge() {
  throw new Error("FENNEVIA_TEST_NAVIGATION_SHOULD_NOT_INITIALIZE");
}

export function createFirefoxTabsBridge() {
  throw new Error("FENNEVIA_TEST_TABS_SHOULD_NOT_INITIALIZE");
}
'@

$missingDownloadsCapabilityBridge = @'
export function createFirefoxBridgeBoundary({
  buildId,
  contextId,
  firefoxVersion,
  windowKind,
}) {
  let disposed = false;
  return Object.freeze({
    dispose() {
      if (disposed) {
        return false;
      }
      disposed = true;
      return true;
    },
    snapshot() {
      return Object.freeze({
        buildId: String(buildId),
        contextId,
        disposed,
        firefoxVersion: String(firefoxVersion),
        windowKind,
      });
    },
  });
}

export function createFirefoxBookmarksBridge() {
  let disposed = false;
  const roots = Object.freeze([
    Object.freeze({ hasChildren: false, id: "root-toolbar", kind: "folder", title: "Toolbar" }),
    Object.freeze({ hasChildren: false, id: "root-menu", kind: "folder", title: "Menu" }),
    Object.freeze({ hasChildren: false, id: "root-unfiled", kind: "folder", title: "Other" }),
    Object.freeze({ hasChildren: false, id: "root-mobile", kind: "folder", title: "Mobile" }),
  ]);
  const bookmarks = Object.freeze({
    async children(parentId, { offset = 0 } = {}) {
      return Object.freeze({ items: Object.freeze([]), offset, parentId, status: "ok", totalCount: 0, truncated: false });
    },
    async open() { return Object.freeze({ reason: "stale", status: "rejected" }); },
    async roots() { return roots; },
    subscribe() { return () => true; },
  });
  return Object.freeze({
    assertRequiredCapabilities() { return Object.freeze([]); },
    bookmarks,
    dispose() {
      if (disposed) { return false; }
      disposed = true;
      return true;
    },
  });
}

export function createFirefoxDownloadsBridge({ boundary }) {
  const context = boundary.snapshot();
  const error = new Error("FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING");
  Object.defineProperties(error, {
    fenneviaBuildId: { value: context.buildId, enumerable: false },
    fenneviaCode: {
      value: "FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING",
      enumerable: false,
    },
    fenneviaFirefoxVersion: {
      value: context.firefoxVersion,
      enumerable: false,
    },
    fenneviaPhase: {
      value: "firefox-downloads-capability",
      enumerable: false,
    },
    fenneviaSymbol: {
      value: "DownloadList.addView",
      enumerable: false,
    },
    fenneviaWindowKind: { value: context.windowKind, enumerable: false },
    name: {
      value: "FenneviaFirefoxDownloadsBridgeTestError",
      enumerable: false,
    },
  });
  throw error;
}

export function createFirefoxNavigationBridge() {
  throw new Error("FENNEVIA_TEST_NAVIGATION_SHOULD_NOT_INITIALIZE");
}

export function createFirefoxTabsBridge() {
  throw new Error("FENNEVIA_TEST_TABS_SHOULD_NOT_INITIALIZE");
}
'@

$missingTabsCapabilityBridge = @'
export function createFirefoxBridgeBoundary({
  buildId,
  contextId,
  firefoxVersion,
  windowKind,
}) {
  let disposed = false;
  return Object.freeze({
    dispose() {
      if (disposed) {
        return false;
      }
      disposed = true;
      return true;
    },
    snapshot() {
      return Object.freeze({
        buildId: String(buildId),
        contextId,
        disposed,
        firefoxVersion: String(firefoxVersion),
        windowKind,
      });
    },
  });
}

export function createFirefoxNavigationBridge() {
  throw new Error("FENNEVIA_TEST_NAVIGATION_SHOULD_NOT_INITIALIZE");
}

export function createFirefoxBookmarksBridge() {
  let disposed = false;
  const roots = Object.freeze([
    Object.freeze({ hasChildren: false, id: "root-toolbar", kind: "folder", title: "Toolbar" }),
    Object.freeze({ hasChildren: false, id: "root-menu", kind: "folder", title: "Menu" }),
    Object.freeze({ hasChildren: false, id: "root-unfiled", kind: "folder", title: "Other" }),
    Object.freeze({ hasChildren: false, id: "root-mobile", kind: "folder", title: "Mobile" }),
  ]);
  const bookmarks = Object.freeze({
    async children(parentId, { offset = 0 } = {}) {
      return Object.freeze({ items: Object.freeze([]), offset, parentId, status: "ok", totalCount: 0, truncated: false });
    },
    async open() { return Object.freeze({ reason: "stale", status: "rejected" }); },
    async roots() { return roots; },
    subscribe() { return () => true; },
  });
  return Object.freeze({
    assertRequiredCapabilities() { return Object.freeze([]); },
    bookmarks,
    dispose() {
      if (disposed) { return false; }
      disposed = true;
      return true;
    },
  });
}

export function createFirefoxDownloadsBridge() {
  let disposed = false;
  const state = Object.freeze({
    activeCount: 0,
    aggregatePercent: null,
    canceledCount: 0,
    countOverflow: false,
    failedCount: 0,
    items: Object.freeze([]),
    pausedCount: 0,
    phase: "ready",
    progressMode: "none",
    queuedCount: 0,
    revision: 1,
    succeededCount: 0,
    truncated: false,
  });
  const downloads = Object.freeze({
    async ready() { return true; },
    snapshot() { return state; },
    subscribe() { return () => true; },
  });
  return Object.freeze({
    assertRequiredCapabilities() { return Object.freeze([]); },
    dispose() {
      if (disposed) { return false; }
      disposed = true;
      return true;
    },
    downloads,
    async ready() { return true; },
  });
}
export function createFirefoxTabsBridge({ boundary }) {
  const context = boundary.snapshot();
  const error = new Error("FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING");
  Object.defineProperties(error, {
    fenneviaBuildId: { value: context.buildId, enumerable: false },
    fenneviaCode: {
      value: "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING",
      enumerable: false,
    },
    fenneviaFirefoxVersion: {
      value: context.firefoxVersion,
      enumerable: false,
    },
    fenneviaPhase: {
      value: "firefox-tabs-capability",
      enumerable: false,
    },
    fenneviaSymbol: {
      value: "window.gBrowser.openTabs",
      enumerable: false,
    },
    fenneviaWindowKind: { value: context.windowKind, enumerable: false },
    name: {
      value: "FenneviaFirefoxTabsBridgeTestError",
      enumerable: false,
    },
  });
  throw error;
}
'@

$missingNavigationCapabilityBridge = @'
export function createFirefoxBridgeBoundary({
  buildId,
  contextId,
  firefoxVersion,
  windowKind,
}) {
  let disposed = false;
  return Object.freeze({
    dispose() {
      if (disposed) {
        return false;
      }
      disposed = true;
      return true;
    },
    snapshot() {
      return Object.freeze({
        buildId: String(buildId),
        contextId,
        disposed,
        firefoxVersion: String(firefoxVersion),
        windowKind,
      });
    },
  });
}

export function createFirefoxNavigationBridge({ boundary }) {
  const context = boundary.snapshot();
  const error = new Error("FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING");
  Object.defineProperties(error, {
    fenneviaBuildId: { value: context.buildId, enumerable: false },
    fenneviaCode: {
      value: "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING",
      enumerable: false,
    },
    fenneviaFirefoxVersion: {
      value: context.firefoxVersion,
      enumerable: false,
    },
    fenneviaPhase: {
      value: "firefox-navigation-capability",
      enumerable: false,
    },
    fenneviaSymbol: {
      value: "window.gBrowser.removeTabsProgressListener",
      enumerable: false,
    },
    fenneviaWindowKind: { value: context.windowKind, enumerable: false },
    name: {
      value: "FenneviaFirefoxNavigationBridgeTestError",
      enumerable: false,
    },
  });
  throw error;
}

export function createFirefoxDownloadsBridge() {
  let disposed = false;
  const state = Object.freeze({
    activeCount: 0,
    aggregatePercent: null,
    canceledCount: 0,
    countOverflow: false,
    failedCount: 0,
    items: Object.freeze([]),
    pausedCount: 0,
    phase: "ready",
    progressMode: "none",
    queuedCount: 0,
    revision: 1,
    succeededCount: 0,
    truncated: false,
  });
  const downloads = Object.freeze({
    async ready() { return true; },
    snapshot() { return state; },
    subscribe() { return () => true; },
  });
  return Object.freeze({
    assertRequiredCapabilities() { return Object.freeze([]); },
    dispose() {
      if (disposed) { return false; }
      disposed = true;
      return true;
    },
    downloads,
    async ready() { return true; },
  });
}

export function createFirefoxBookmarksBridge() {
  let disposed = false;
  const roots = Object.freeze([
    Object.freeze({ hasChildren: false, id: "root-toolbar", kind: "folder", title: "Toolbar" }),
    Object.freeze({ hasChildren: false, id: "root-menu", kind: "folder", title: "Menu" }),
    Object.freeze({ hasChildren: false, id: "root-unfiled", kind: "folder", title: "Other" }),
    Object.freeze({ hasChildren: false, id: "root-mobile", kind: "folder", title: "Mobile" }),
  ]);
  const bookmarks = Object.freeze({
    async children(parentId, { offset = 0 } = {}) {
      return Object.freeze({ items: Object.freeze([]), offset, parentId, status: "ok", totalCount: 0, truncated: false });
    },
    async open() { return Object.freeze({ reason: "stale", status: "rejected" }); },
    async roots() { return roots; },
    subscribe() { return () => true; },
  });
  return Object.freeze({
    assertRequiredCapabilities() { return Object.freeze([]); },
    bookmarks,
    dispose() {
      if (disposed) { return false; }
      disposed = true;
      return true;
    },
  });
}

export function createFirefoxTabsBridge() {
  let disposed = false;
  const tabs = Object.freeze({
    close() {},
    move() {},
    open() { return "tab-registry-1-handle-1"; },
    openContextMenu() {},
    pin() {},
    select() {},
    snapshot() { return Object.freeze([]); },
    subscribe() {
      let active = true;
      return () => {
        if (!active) {
          return false;
        }
        active = false;
        return true;
      };
    },
    toggleMute() {},
    unpin() {},
  });
  return Object.freeze({
    assertRequiredCapabilities() { return Object.freeze([]); },
    dispose() {
      if (disposed) {
        return false;
      }
      disposed = true;
      return true;
    },
    tabs,
  });
}
'@

$urlbarCoverageBridgeStub = @'
export function createFirefoxUrlbarCoverageBridge() {
  let disposed = false;
  const state = Object.freeze({
    items: Object.freeze([]),
    permissions: Object.freeze({
      available: false,
      blocked: Object.freeze([]),
      hasPermissions: false,
      sharing: Object.freeze([]),
    }),
  });
  const urlbarCoverage = Object.freeze({
    openNativeUrlbar() { return true; },
    snapshot() { return state; },
    subscribe() {
      let active = true;
      return () => {
        if (!active) { return false; }
        active = false;
        return true;
      };
    },
  });
  return Object.freeze({
    assertRequiredCapabilities() { return Object.freeze([]); },
    dispose() {
      if (disposed) { return false; }
      disposed = true;
      return true;
    },
    snapshot() {
      return Object.freeze({
        disposed,
        failed: false,
        revision: 1,
        subscriberCount: 0,
      });
    },
    urlbarCoverage,
  });
}
'@

$missingUrlbarCoverageCapabilityBridge = $missingCapabilityBridge + [Environment]::NewLine + @'
export function createFirefoxUrlbarCoverageBridge({ boundary }) {
  const context = boundary.snapshot();
  const error = new Error("FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING");
  Object.defineProperties(error, {
    fenneviaBuildId: { value: context.buildId, enumerable: false },
    fenneviaCode: {
      value: "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING",
      enumerable: false,
    },
    fenneviaFirefoxVersion: {
      value: context.firefoxVersion,
      enumerable: false,
    },
    fenneviaPhase: {
      value: "firefox-urlbar-coverage-capability",
      enumerable: false,
    },
    fenneviaSymbol: {
      value: "window.openLocation",
      enumerable: false,
    },
    fenneviaWindowKind: { value: context.windowKind, enumerable: false },
    name: {
      value: "FenneviaFirefoxUrlbarCoverageBridgeTestError",
      enumerable: false,
    },
  });
  throw error;
}
'@

$missingCapabilityBridge = $missingCapabilityBridge + [Environment]::NewLine + $urlbarCoverageBridgeStub
$missingBookmarksCapabilityBridge = $missingBookmarksCapabilityBridge + [Environment]::NewLine + $urlbarCoverageBridgeStub
$missingDownloadsCapabilityBridge = $missingDownloadsCapabilityBridge + [Environment]::NewLine + $urlbarCoverageBridgeStub
$missingTabsCapabilityBridge = $missingTabsCapabilityBridge + [Environment]::NewLine + $urlbarCoverageBridgeStub
$missingNavigationCapabilityBridge = $missingNavigationCapabilityBridge + [Environment]::NewLine + $urlbarCoverageBridgeStub

try {
    Write-Utf8NoBom -Path $targetPath -Content $missingCapabilityBridge
    & $node.Source $harnessPath --firefox $canonicalFirefox --profile $canonicalProfile --expect-bridge-fail-open
    Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "A missing required bridge capability did not fail open at the shell health boundary."

    Write-Utf8NoBom -Path $targetPath -Content $missingBookmarksCapabilityBridge
    & $node.Source $harnessPath --firefox $canonicalFirefox --profile $canonicalProfile --expect-bookmarks-bridge-fail-open
    Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "A missing required bookmarks capability did not fail open at the shell health boundary."

    Write-Utf8NoBom -Path $targetPath -Content $missingDownloadsCapabilityBridge
    & $node.Source $harnessPath --firefox $canonicalFirefox --profile $canonicalProfile --expect-downloads-bridge-fail-open
    Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "A missing required downloads capability did not fail open at the shell health boundary."

    Write-Utf8NoBom -Path $targetPath -Content $missingTabsCapabilityBridge
    & $node.Source $harnessPath --firefox $canonicalFirefox --profile $canonicalProfile --expect-tabs-bridge-fail-open
    Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "A missing required tabs capability did not fail open at the shell health boundary."

    Write-Utf8NoBom -Path $targetPath -Content $missingNavigationCapabilityBridge
    & $node.Source $harnessPath --firefox $canonicalFirefox --profile $canonicalProfile --expect-navigation-bridge-fail-open
    Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "A missing required navigation capability did not fail open at the shell health boundary."

    Write-Utf8NoBom -Path $targetPath -Content $missingUrlbarCoverageCapabilityBridge
    & $node.Source $harnessPath --firefox $canonicalFirefox --profile $canonicalProfile --expect-urlbar-coverage-bridge-fail-open
    Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "A missing required Urlbar coverage capability did not fail open at the shell health boundary."

    Copy-Item -LiteralPath $bridgeBackupPath -Destination $targetPath -Force
    & $node.Source $harnessPath --firefox $canonicalFirefox --profile $canonicalProfile
    Assert-True -Condition ($LASTEXITCODE -eq 0) -Message "Ordinary bridge startup did not recover after exact artifact restoration."
}
catch {
    $testFailure = $_
}
finally {
    Copy-Item -LiteralPath $bridgeBackupPath -Destination $targetPath -Force
    Assert-True -Condition ((Get-FileHash -Algorithm SHA256 -LiteralPath $targetPath).Hash.ToLowerInvariant() -ceq $expectedHash) -Message "Bridge recovery cleanup did not restore the exact committed artifact."
    Remove-Item -LiteralPath $bridgeBackupPath -Force
    Assert-True -Condition (@(Get-ChildItem -LiteralPath $tempRoot -Force).Count -eq 0) -Message "The temporary bridge recovery directory is not empty."
    Remove-Item -LiteralPath $tempRoot -Force
}

if ($testFailure) {
    throw $testFailure
}

Assert-True -Condition (@(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'").Count -eq 0) -Message "The bridge recovery matrix left a Firefox process running."
Write-Output "PASS: missing boundary, bookmarks, downloads, tabs, navigation, and Urlbar coverage capabilities failed open, then exact restoration recovered ordinary startup."
