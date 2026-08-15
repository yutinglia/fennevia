export const blockedPermissionIndicatorKinds = Object.freeze([
  "autoplay",
  "camera",
  "canvas",
  "install",
  "local-network",
  "location",
  "loopback-network",
  "microphone",
  "midi",
  "notifications",
  "persistent-storage",
  "popups",
  "screen",
  "serial",
  "xr",
] as const);

export const sharingIndicatorKinds = Object.freeze([
  "location",
  "media",
  "serial",
  "xr",
] as const);

export const urlbarItemKinds = Object.freeze([
  "remote-control",
  "search-mode",
  "persisted-search",
  "recommendation",
  "container",
  "reader-view",
  "picture-in-picture",
  "taskbar-tabs",
  "translations",
  "zoom",
  "split-view",
  "bookmark",
  "extension-actions",
  "other-page-actions",
  "more-page-actions",
] as const);

export type BlockedPermissionIndicatorKind =
  (typeof blockedPermissionIndicatorKinds)[number];
export type SharingIndicatorKind = (typeof sharingIndicatorKinds)[number];
export type UrlbarItemKind = (typeof urlbarItemKinds)[number];

export type SitePermissionIndicatorsSnapshot = Readonly<{
  available: boolean;
  blocked: readonly BlockedPermissionIndicatorKind[];
  hasPermissions: boolean;
  sharing: readonly SharingIndicatorKind[];
}>;

export type UrlbarCoverageSnapshot = Readonly<{
  items: readonly UrlbarItemKind[];
  permissions: SitePermissionIndicatorsSnapshot;
}>;

export type UrlbarCoverageStateEvent = Readonly<{
  revision: number;
  snapshot: UrlbarCoverageSnapshot;
  type: "snapshot";
}>;

export type BrowserUrlbarCoverageBridge = Readonly<{
  openNativeUrlbar: () => boolean;
  snapshot: () => UrlbarCoverageSnapshot;
  subscribe: (
    listener: (event: UrlbarCoverageStateEvent) => void,
  ) => () => boolean;
}>;

export type BrowserUrlbarCoverageState = Readonly<{
  revision: number;
  snapshot: UrlbarCoverageSnapshot;
}>;

export type BrowserUrlbarCoverageStateAdapter = Readonly<{
  dispose: () => boolean;
  openNativeUrlbar: () => boolean;
  snapshot: () => BrowserUrlbarCoverageState;
  status: () => Readonly<{
    disposed: boolean;
    revision: number;
    subscriberCount: number;
  }>;
  subscribe: (
    listener: (state: BrowserUrlbarCoverageState) => void,
  ) => () => boolean;
}>;

const blockedPermissionIndicatorKindSet = new Set(
  blockedPermissionIndicatorKinds,
);
const sharingIndicatorKindSet = new Set(sharingIndicatorKinds);
const urlbarItemKindSet = new Set(urlbarItemKinds);

function createUrlbarCoverageStateError(code: string): Error {
  const error = new Error(code);
  error.name = "FenneviaUrlbarCoverageStateError";
  Object.defineProperties(error, {
    fenneviaCode: { enumerable: false, value: code },
    fenneviaPhase: { enumerable: false, value: "urlbar-coverage-state" },
  });
  return error;
}

function copyUniqueKinds<T extends string>(
  candidate: readonly T[],
  allowed: ReadonlySet<T>,
): readonly T[] {
  if (
    !Array.isArray(candidate) ||
    candidate.some((value) => !allowed.has(value)) ||
    new Set(candidate).size !== candidate.length
  ) {
    throw createUrlbarCoverageStateError(
      "FENNEVIA_URLBAR_COVERAGE_SNAPSHOT_INVALID",
    );
  }
  return Object.freeze([...candidate]);
}

export function copyUrlbarCoverageSnapshot(
  candidate: UrlbarCoverageSnapshot,
): UrlbarCoverageSnapshot {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    !candidate.permissions ||
    typeof candidate.permissions !== "object" ||
    typeof candidate.permissions.available !== "boolean" ||
    typeof candidate.permissions.hasPermissions !== "boolean"
  ) {
    throw createUrlbarCoverageStateError(
      "FENNEVIA_URLBAR_COVERAGE_SNAPSHOT_INVALID",
    );
  }

  const permissions = Object.freeze({
    available: candidate.permissions.available,
    blocked: copyUniqueKinds(
      candidate.permissions.blocked,
      blockedPermissionIndicatorKindSet,
    ),
    hasPermissions: candidate.permissions.hasPermissions,
    sharing: copyUniqueKinds(
      candidate.permissions.sharing,
      sharingIndicatorKindSet,
    ),
  });
  if (
    !permissions.available &&
    (permissions.hasPermissions ||
      permissions.blocked.length > 0 ||
      permissions.sharing.length > 0)
  ) {
    throw createUrlbarCoverageStateError(
      "FENNEVIA_URLBAR_COVERAGE_SNAPSHOT_INVALID",
    );
  }
  if (permissions.blocked.length > 0 && !permissions.hasPermissions) {
    throw createUrlbarCoverageStateError(
      "FENNEVIA_URLBAR_COVERAGE_SNAPSHOT_INVALID",
    );
  }

  return Object.freeze({
    items: copyUniqueKinds(candidate.items, urlbarItemKindSet),
    permissions,
  });
}

export function createBrowserUrlbarCoverageState(
  snapshot: UrlbarCoverageSnapshot,
  revision = 0,
): BrowserUrlbarCoverageState {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw createUrlbarCoverageStateError(
      "FENNEVIA_URLBAR_COVERAGE_REVISION_INVALID",
    );
  }
  return Object.freeze({
    revision,
    snapshot: copyUrlbarCoverageSnapshot(snapshot),
  });
}

export function reduceBrowserUrlbarCoverageState(
  state: BrowserUrlbarCoverageState,
  event: UrlbarCoverageStateEvent,
): BrowserUrlbarCoverageState {
  if (
    event?.type !== "snapshot" ||
    !Number.isSafeInteger(event.revision) ||
    event.revision < 1
  ) {
    throw createUrlbarCoverageStateError(
      "FENNEVIA_URLBAR_COVERAGE_EVENT_INVALID",
    );
  }
  if (event.revision <= state.revision) {
    return state;
  }
  return createBrowserUrlbarCoverageState(event.snapshot, event.revision);
}

export function createBrowserUrlbarCoverageStateAdapter(
  bridge: BrowserUrlbarCoverageBridge,
): BrowserUrlbarCoverageStateAdapter {
  if (
    !bridge ||
    typeof bridge !== "object" ||
    typeof bridge.openNativeUrlbar !== "function" ||
    typeof bridge.snapshot !== "function" ||
    typeof bridge.subscribe !== "function"
  ) {
    throw createUrlbarCoverageStateError(
      "FENNEVIA_URLBAR_COVERAGE_BRIDGE_INVALID",
    );
  }

  let activeBridge: BrowserUrlbarCoverageBridge | null = bridge;
  let disposed = false;
  let state = createBrowserUrlbarCoverageState(bridge.snapshot());
  const listeners = new Set<(state: BrowserUrlbarCoverageState) => void>();
  const unsubscribeBridge = bridge.subscribe((event) => {
    if (disposed) {
      return;
    }
    const nextState = reduceBrowserUrlbarCoverageState(state, event);
    if (nextState === state) {
      return;
    }
    state = nextState;
    for (const listener of Array.from(listeners)) {
      listener(state);
    }
  });
  if (typeof unsubscribeBridge !== "function") {
    throw createUrlbarCoverageStateError(
      "FENNEVIA_URLBAR_COVERAGE_SUBSCRIPTION_INVALID",
    );
  }

  const requireBridge = (): BrowserUrlbarCoverageBridge => {
    if (disposed || !activeBridge) {
      throw createUrlbarCoverageStateError("FENNEVIA_URLBAR_COVERAGE_DISPOSED");
    }
    return activeBridge;
  };

  return Object.freeze({
    dispose(): boolean {
      if (disposed) {
        return false;
      }
      disposed = true;
      activeBridge = null;
      listeners.clear();
      unsubscribeBridge();
      return true;
    },

    openNativeUrlbar: () => requireBridge().openNativeUrlbar(),

    snapshot: () => state,

    status() {
      return Object.freeze({
        disposed,
        revision: state.revision,
        subscriberCount: listeners.size,
      });
    },

    subscribe(listener): () => boolean {
      requireBridge();
      if (typeof listener !== "function") {
        throw createUrlbarCoverageStateError(
          "FENNEVIA_URLBAR_COVERAGE_LISTENER_INVALID",
        );
      }
      listeners.add(listener);
      let subscribed = true;
      return Object.freeze(() => {
        if (!subscribed) {
          return false;
        }
        subscribed = false;
        listeners.delete(listener);
        return true;
      });
    },
  });
}
