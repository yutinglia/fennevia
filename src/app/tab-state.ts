export const maximumTabTitleLength = 256;

export type TabSnapshot = Readonly<{
  faviconUrl?: string;
  id: string;
  loading: boolean;
  pinned: boolean;
  selected: boolean;
  title: string;
}>;

export type TabStateEvent = Readonly<{
  revision: number;
  tabs: readonly TabSnapshot[];
  type: "snapshot";
}>;

export type OpenTabOptions = Readonly<{
  selected?: boolean;
}>;

export type BrowserTabsBridge = Readonly<{
  close: (tabId: string) => void;
  open: (options?: OpenTabOptions) => string;
  pin: (tabId: string) => void;
  select: (tabId: string) => void;
  snapshot: () => readonly TabSnapshot[];
  subscribe: (listener: (event: TabStateEvent) => void) => () => boolean;
  unpin: (tabId: string) => void;
}>;

export type BrowserTabsState = Readonly<{
  revision: number;
  tabs: readonly TabSnapshot[];
}>;

export type BrowserTabsStateAdapter = Readonly<{
  close: (tabId: string) => void;
  dispose: () => boolean;
  open: (options?: OpenTabOptions) => string;
  pin: (tabId: string) => void;
  select: (tabId: string) => void;
  snapshot: () => BrowserTabsState;
  status: () => Readonly<{
    disposed: boolean;
    revision: number;
    subscriberCount: number;
    tabCount: number;
  }>;
  subscribe: (listener: (state: BrowserTabsState) => void) => () => boolean;
  unpin: (tabId: string) => void;
}>;

const createStateError = (code: string): Error => {
  const error = new Error(code);
  error.name = "FenneviaTabStateError";
  Object.defineProperties(error, {
    fenneviaCode: { enumerable: false, value: code },
    fenneviaPhase: { enumerable: false, value: "tab-state" },
  });
  return error;
};

const copyTabSnapshot = (candidate: TabSnapshot): TabSnapshot => {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    typeof candidate.id !== "string" ||
    candidate.id.length === 0 ||
    candidate.id.length > 160 ||
    typeof candidate.title !== "string" ||
    typeof candidate.loading !== "boolean" ||
    typeof candidate.pinned !== "boolean" ||
    typeof candidate.selected !== "boolean" ||
    (candidate.faviconUrl !== undefined &&
      typeof candidate.faviconUrl !== "string")
  ) {
    throw createStateError("FENNEVIA_TAB_STATE_SNAPSHOT_INVALID");
  }

  return Object.freeze({
    ...(candidate.faviconUrl === undefined
      ? {}
      : { faviconUrl: candidate.faviconUrl }),
    id: candidate.id,
    loading: candidate.loading,
    pinned: candidate.pinned,
    selected: candidate.selected,
    title: candidate.title.slice(0, maximumTabTitleLength),
  });
};

const copyTabs = (tabs: readonly TabSnapshot[]): readonly TabSnapshot[] => {
  if (!Array.isArray(tabs)) {
    throw createStateError("FENNEVIA_TAB_STATE_SNAPSHOT_INVALID");
  }
  const copied = tabs.map(copyTabSnapshot);
  if (new Set(copied.map((tab) => tab.id)).size !== copied.length) {
    throw createStateError("FENNEVIA_TAB_STATE_ID_DUPLICATE");
  }
  return Object.freeze(copied);
};

export function createBrowserTabsState(
  tabs: readonly TabSnapshot[],
  revision = 0,
): BrowserTabsState {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw createStateError("FENNEVIA_TAB_STATE_REVISION_INVALID");
  }
  return Object.freeze({
    revision,
    tabs: copyTabs(tabs),
  });
}

export function reduceBrowserTabsState(
  state: BrowserTabsState,
  event: TabStateEvent,
): BrowserTabsState {
  if (
    event?.type !== "snapshot" ||
    !Number.isSafeInteger(event.revision) ||
    event.revision < 1
  ) {
    throw createStateError("FENNEVIA_TAB_STATE_EVENT_INVALID");
  }
  if (event.revision <= state.revision) {
    return state;
  }
  return createBrowserTabsState(event.tabs, event.revision);
}

export function createBrowserTabsStateAdapter(
  bridge: BrowserTabsBridge,
): BrowserTabsStateAdapter {
  if (
    !bridge ||
    typeof bridge !== "object" ||
    typeof bridge.close !== "function" ||
    typeof bridge.open !== "function" ||
    typeof bridge.pin !== "function" ||
    typeof bridge.select !== "function" ||
    typeof bridge.snapshot !== "function" ||
    typeof bridge.subscribe !== "function" ||
    typeof bridge.unpin !== "function"
  ) {
    throw createStateError("FENNEVIA_TAB_STATE_BRIDGE_INVALID");
  }

  let activeBridge: BrowserTabsBridge | null = bridge;
  let disposed = false;
  let state = createBrowserTabsState(bridge.snapshot());
  const listeners = new Set<(state: BrowserTabsState) => void>();
  const unsubscribeBridge = bridge.subscribe((event) => {
    if (disposed) {
      return;
    }
    const nextState = reduceBrowserTabsState(state, event);
    if (nextState === state) {
      return;
    }
    state = nextState;
    for (const listener of Array.from(listeners)) {
      listener(state);
    }
  });

  if (typeof unsubscribeBridge !== "function") {
    throw createStateError("FENNEVIA_TAB_STATE_SUBSCRIPTION_INVALID");
  }

  const requireBridge = (): BrowserTabsBridge => {
    if (disposed || !activeBridge) {
      throw createStateError("FENNEVIA_TAB_STATE_DISPOSED");
    }
    return activeBridge;
  };

  return Object.freeze({
    close(tabId: string): void {
      requireBridge().close(tabId);
    },

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

    open(options?: OpenTabOptions): string {
      return requireBridge().open(options);
    },

    pin(tabId: string): void {
      requireBridge().pin(tabId);
    },

    select(tabId: string): void {
      requireBridge().select(tabId);
    },

    snapshot(): BrowserTabsState {
      return state;
    },

    status() {
      return Object.freeze({
        disposed,
        revision: state.revision,
        subscriberCount: listeners.size,
        tabCount: state.tabs.length,
      });
    },

    subscribe(listener: (state: BrowserTabsState) => void): () => boolean {
      requireBridge();
      if (typeof listener !== "function") {
        throw createStateError("FENNEVIA_TAB_STATE_LISTENER_INVALID");
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

    unpin(tabId: string): void {
      requireBridge().unpin(tabId);
    },
  });
}
