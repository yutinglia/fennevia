export const maximumNavigationTitleLength = 256;
export const maximumNavigationDisplayUriLength = 2_048;

export type NavigationSnapshot = Readonly<{
  canGoBack: boolean;
  canGoForward: boolean;
  displayUri: string;
  loading: boolean;
  title: string;
}>;

export type NavigationStateEvent = Readonly<{
  revision: number;
  snapshot: NavigationSnapshot;
  type: "snapshot";
}>;

export type BrowserNavigationBridge = Readonly<{
  back: () => boolean;
  forward: () => boolean;
  newTab: () => boolean;
  reload: () => boolean;
  reloadOrStop: () => "reload" | "stop";
  snapshot: () => NavigationSnapshot;
  stop: () => boolean;
  subscribe: (listener: (event: NavigationStateEvent) => void) => () => boolean;
}>;

export type BrowserNavigationState = Readonly<{
  revision: number;
  snapshot: NavigationSnapshot;
}>;

export type BrowserNavigationStateAdapter = Readonly<{
  back: () => boolean;
  dispose: () => boolean;
  forward: () => boolean;
  newTab: () => boolean;
  reload: () => boolean;
  reloadOrStop: () => "reload" | "stop";
  snapshot: () => BrowserNavigationState;
  status: () => Readonly<{
    disposed: boolean;
    revision: number;
    subscriberCount: number;
  }>;
  stop: () => boolean;
  subscribe: (
    listener: (state: BrowserNavigationState) => void,
  ) => () => boolean;
}>;

const createStateError = (code: string): Error => {
  const error = new Error(code);
  error.name = "FenneviaNavigationStateError";
  Object.defineProperties(error, {
    fenneviaCode: { enumerable: false, value: code },
    fenneviaPhase: { enumerable: false, value: "navigation-state" },
  });
  return error;
};

const copyBoundedString = (value: unknown, maximumLength: number): string => {
  if (typeof value !== "string") {
    throw createStateError("FENNEVIA_NAVIGATION_STATE_SNAPSHOT_INVALID");
  }
  return value.slice(0, maximumLength);
};

export function copyNavigationSnapshot(
  candidate: NavigationSnapshot,
): NavigationSnapshot {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    typeof candidate.canGoBack !== "boolean" ||
    typeof candidate.canGoForward !== "boolean" ||
    typeof candidate.loading !== "boolean"
  ) {
    throw createStateError("FENNEVIA_NAVIGATION_STATE_SNAPSHOT_INVALID");
  }

  return Object.freeze({
    canGoBack: candidate.canGoBack,
    canGoForward: candidate.canGoForward,
    displayUri: copyBoundedString(
      candidate.displayUri,
      maximumNavigationDisplayUriLength,
    ),
    loading: candidate.loading,
    title: copyBoundedString(candidate.title, maximumNavigationTitleLength),
  });
}

export function createBrowserNavigationState(
  snapshot: NavigationSnapshot,
  revision = 0,
): BrowserNavigationState {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw createStateError("FENNEVIA_NAVIGATION_STATE_REVISION_INVALID");
  }
  return Object.freeze({
    revision,
    snapshot: copyNavigationSnapshot(snapshot),
  });
}

export function reduceBrowserNavigationState(
  state: BrowserNavigationState,
  event: NavigationStateEvent,
): BrowserNavigationState {
  if (
    event?.type !== "snapshot" ||
    !Number.isSafeInteger(event.revision) ||
    event.revision < 1
  ) {
    throw createStateError("FENNEVIA_NAVIGATION_STATE_EVENT_INVALID");
  }
  if (event.revision <= state.revision) {
    return state;
  }
  return createBrowserNavigationState(event.snapshot, event.revision);
}

export function createBrowserNavigationStateAdapter(
  bridge: BrowserNavigationBridge,
): BrowserNavigationStateAdapter {
  if (
    !bridge ||
    typeof bridge !== "object" ||
    typeof bridge.back !== "function" ||
    typeof bridge.forward !== "function" ||
    typeof bridge.newTab !== "function" ||
    typeof bridge.reload !== "function" ||
    typeof bridge.reloadOrStop !== "function" ||
    typeof bridge.snapshot !== "function" ||
    typeof bridge.stop !== "function" ||
    typeof bridge.subscribe !== "function"
  ) {
    throw createStateError("FENNEVIA_NAVIGATION_STATE_BRIDGE_INVALID");
  }

  let activeBridge: BrowserNavigationBridge | null = bridge;
  let disposed = false;
  let state = createBrowserNavigationState(bridge.snapshot());
  const listeners = new Set<(state: BrowserNavigationState) => void>();
  const unsubscribeBridge = bridge.subscribe((event) => {
    if (disposed) {
      return;
    }
    const nextState = reduceBrowserNavigationState(state, event);
    if (nextState === state) {
      return;
    }
    state = nextState;
    for (const listener of Array.from(listeners)) {
      listener(state);
    }
  });

  if (typeof unsubscribeBridge !== "function") {
    throw createStateError("FENNEVIA_NAVIGATION_STATE_SUBSCRIPTION_INVALID");
  }

  const requireBridge = (): BrowserNavigationBridge => {
    if (disposed || !activeBridge) {
      throw createStateError("FENNEVIA_NAVIGATION_STATE_DISPOSED");
    }
    return activeBridge;
  };

  return Object.freeze({
    back: () => requireBridge().back(),

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

    forward: () => requireBridge().forward(),
    newTab: () => requireBridge().newTab(),
    reload: () => requireBridge().reload(),
    reloadOrStop: () => requireBridge().reloadOrStop(),

    snapshot(): BrowserNavigationState {
      return state;
    },

    status() {
      return Object.freeze({
        disposed,
        revision: state.revision,
        subscriberCount: listeners.size,
      });
    },

    stop: () => requireBridge().stop(),

    subscribe(
      listener: (state: BrowserNavigationState) => void,
    ): () => boolean {
      requireBridge();
      if (typeof listener !== "function") {
        throw createStateError("FENNEVIA_NAVIGATION_STATE_LISTENER_INVALID");
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
