export const maximumTabTitleLength = 256;
export const maximumContainerLabelLength = 80;

export const tabAudioStates = Object.freeze([
  "playing",
  "muted",
  "blocked",
] as const);
export type TabAudioState = (typeof tabAudioStates)[number];

export const tabSharingStates = Object.freeze([
  "camera",
  "microphone",
  "screen",
] as const);
export type TabSharingState = (typeof tabSharingStates)[number];

export const tabContainerColors = Object.freeze([
  "blue",
  "cyan",
  "gray",
  "green",
  "orange",
  "pink",
  "purple",
  "red",
  "violet",
  "yellow",
] as const);
export type TabContainerColor = (typeof tabContainerColors)[number];

const tabAudioStateSet = new Set<string>(tabAudioStates);
const tabContainerColorSet = new Set<string>(tabContainerColors);
const tabSharingStateSet = new Set<string>(tabSharingStates);

export type TabContainerSnapshot = Readonly<{
  color: TabContainerColor;
  label: string;
}>;

export type TabSnapshot = Readonly<{
  attention?: boolean;
  audio?: TabAudioState;
  container?: TabContainerSnapshot;
  crashed?: boolean;
  faviconUrl?: string;
  id: string;
  loading: boolean;
  pictureInPicture?: boolean;
  pinned: boolean;
  selected: boolean;
  sharing?: TabSharingState;
  title: string;
}>;

export type TabSnapshotEvent = Readonly<{
  revision: number;
  tabs: readonly TabSnapshot[];
  type: "snapshot";
}>;

export type TabContextMenuEvent = Readonly<{
  open: boolean;
  type: "context-menu";
}>;

export type TabStateEvent = TabContextMenuEvent | TabSnapshotEvent;

export type OpenTabOptions = Readonly<{
  selected?: boolean;
}>;

export type TabContextMenuPoint = Readonly<{
  screenX: number;
  screenY: number;
}>;

export type BrowserTabsBridge = Readonly<{
  close: (tabId: string) => void;
  move: (tabId: string, index: number) => void;
  open: (options?: OpenTabOptions) => string;
  openContextMenu: (tabId: string, point: TabContextMenuPoint) => void;
  pin: (tabId: string) => void;
  select: (tabId: string) => void;
  snapshot: () => readonly TabSnapshot[];
  subscribe: (listener: (event: TabStateEvent) => void) => () => boolean;
  toggleMute: (tabId: string) => void;
  unpin: (tabId: string) => void;
}>;

export type BrowserTabsState = Readonly<{
  revision: number;
  tabs: readonly TabSnapshot[];
}>;

export type BrowserTabsStateAdapter = Readonly<{
  close: (tabId: string) => void;
  dispose: () => boolean;
  move: (tabId: string, index: number) => void;
  open: (options?: OpenTabOptions) => string;
  openContextMenu: (tabId: string, point: TabContextMenuPoint) => void;
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
  subscribeContextMenu: (listener: (open: boolean) => void) => () => boolean;
  toggleMute: (tabId: string) => void;
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

export function isTabAudioState(value: unknown): value is TabAudioState {
  return typeof value === "string" && tabAudioStateSet.has(value);
}

export function isTabContainerColor(
  value: unknown,
): value is TabContainerColor {
  return typeof value === "string" && tabContainerColorSet.has(value);
}

export function isTabSharingState(value: unknown): value is TabSharingState {
  return typeof value === "string" && tabSharingStateSet.has(value);
}

const copyTabContainer = (
  candidate: TabContainerSnapshot | undefined,
): TabContainerSnapshot | undefined => {
  if (candidate === undefined) {
    return undefined;
  }
  if (
    !candidate ||
    typeof candidate !== "object" ||
    !isTabContainerColor(candidate.color) ||
    typeof candidate.label !== "string"
  ) {
    throw createStateError("FENNEVIA_TAB_STATE_SNAPSHOT_INVALID");
  }
  return Object.freeze({
    color: candidate.color,
    label: candidate.label.slice(0, maximumContainerLabelLength),
  });
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
      typeof candidate.faviconUrl !== "string") ||
    (candidate.audio !== undefined && !isTabAudioState(candidate.audio)) ||
    (candidate.attention !== undefined &&
      typeof candidate.attention !== "boolean") ||
    (candidate.crashed !== undefined &&
      typeof candidate.crashed !== "boolean") ||
    (candidate.pictureInPicture !== undefined &&
      typeof candidate.pictureInPicture !== "boolean") ||
    (candidate.sharing !== undefined && !isTabSharingState(candidate.sharing))
  ) {
    throw createStateError("FENNEVIA_TAB_STATE_SNAPSHOT_INVALID");
  }

  const container = copyTabContainer(candidate.container);
  return Object.freeze({
    ...(candidate.attention === true ? { attention: true } : {}),
    ...(candidate.audio === undefined ? {} : { audio: candidate.audio }),
    ...(container === undefined ? {} : { container }),
    ...(candidate.crashed === true ? { crashed: true } : {}),
    ...(candidate.faviconUrl === undefined
      ? {}
      : { faviconUrl: candidate.faviconUrl }),
    ...(candidate.pictureInPicture === true ? { pictureInPicture: true } : {}),
    id: candidate.id,
    loading: candidate.loading,
    pinned: candidate.pinned,
    selected: candidate.selected,
    ...(candidate.sharing === undefined ? {} : { sharing: candidate.sharing }),
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
  if (event?.type === "context-menu") {
    return state;
  }
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
    typeof bridge.move !== "function" ||
    typeof bridge.open !== "function" ||
    typeof bridge.openContextMenu !== "function" ||
    typeof bridge.pin !== "function" ||
    typeof bridge.select !== "function" ||
    typeof bridge.snapshot !== "function" ||
    typeof bridge.subscribe !== "function" ||
    typeof bridge.toggleMute !== "function" ||
    typeof bridge.unpin !== "function"
  ) {
    throw createStateError("FENNEVIA_TAB_STATE_BRIDGE_INVALID");
  }

  let activeBridge: BrowserTabsBridge | null = bridge;
  let disposed = false;
  let state = createBrowserTabsState(bridge.snapshot());
  const listeners = new Set<(state: BrowserTabsState) => void>();
  const contextMenuListeners = new Set<(open: boolean) => void>();
  const unsubscribeBridge = bridge.subscribe((event) => {
    if (disposed) {
      return;
    }
    if (event?.type === "context-menu") {
      if (typeof event.open !== "boolean") {
        throw createStateError("FENNEVIA_TAB_STATE_EVENT_INVALID");
      }
      for (const listener of Array.from(contextMenuListeners)) {
        listener(event.open);
      }
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
      contextMenuListeners.clear();
      unsubscribeBridge();
      return true;
    },

    move(tabId: string, index: number): void {
      requireBridge().move(tabId, index);
    },

    open(options?: OpenTabOptions): string {
      return requireBridge().open(options);
    },

    openContextMenu(tabId: string, point: TabContextMenuPoint): void {
      requireBridge().openContextMenu(tabId, point);
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

    subscribeContextMenu(listener: (open: boolean) => void): () => boolean {
      requireBridge();
      if (typeof listener !== "function") {
        throw createStateError("FENNEVIA_TAB_STATE_LISTENER_INVALID");
      }
      contextMenuListeners.add(listener);
      let subscribed = true;
      return Object.freeze(() => {
        if (!subscribed) {
          return false;
        }
        subscribed = false;
        contextMenuListeners.delete(listener);
        return true;
      });
    },

    toggleMute(tabId: string): void {
      requireBridge().toggleMute(tabId);
    },

    unpin(tabId: string): void {
      requireBridge().unpin(tabId);
    },
  });
}
