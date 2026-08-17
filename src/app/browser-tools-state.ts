export const browserToolActions = Object.freeze([
  "site-information",
  "protections",
  "site-permissions",
  "downloads",
  "extensions",
  "application-menu",
  "settings",
  "customize",
  "native-toolbar",
] as const);

export const popupBrowserToolActions = Object.freeze([
  "site-information",
  "protections",
  "site-permissions",
  "downloads",
  "extensions",
  "application-menu",
] as const);

export type BrowserToolAction = (typeof browserToolActions)[number];
export type PopupBrowserToolAction = (typeof popupBrowserToolActions)[number];

export type BrowserToolsSnapshot = Readonly<{
  applicationMenu: boolean;
  customize: boolean;
  downloads: boolean;
  extensions: boolean;
  nativeToolbar: boolean;
  protections: boolean;
  settings: boolean;
  siteInformation: boolean;
  sitePermissions: boolean;
}>;

export type BrowserToolsPopupEvent = Readonly<{
  open: boolean;
  type: "native-popup";
}>;

export type BrowserToolsBridge = Readonly<{
  invoke: (action: BrowserToolAction, host?: unknown) => Promise<boolean>;
  snapshot: () => BrowserToolsSnapshot;
  subscribe: (
    listener: (event: BrowserToolsPopupEvent) => void,
  ) => () => boolean;
}>;

export type BrowserToolsStateAdapter = Readonly<{
  dispose: () => boolean;
  invoke: (action: BrowserToolAction, host?: unknown) => Promise<boolean>;
  snapshot: () => BrowserToolsSnapshot;
  status: () => Readonly<{
    disposed: boolean;
    subscriberCount: number;
  }>;
  subscribePopup: (listener: (open: boolean) => void) => () => boolean;
}>;

const browserToolActionSet = new Set<BrowserToolAction>(browserToolActions);
const popupBrowserToolActionSet = new Set<PopupBrowserToolAction>(
  popupBrowserToolActions,
);

const createStateError = (code: string): Error => {
  const error = new Error(code);
  error.name = "FenneviaBrowserToolsStateError";
  Object.defineProperties(error, {
    fenneviaCode: { enumerable: false, value: code },
    fenneviaPhase: { enumerable: false, value: "browser-tools-state" },
  });
  return error;
};

export function isBrowserToolAction(
  candidate: unknown,
): candidate is BrowserToolAction {
  return (
    typeof candidate === "string" &&
    browserToolActionSet.has(candidate as BrowserToolAction)
  );
}

export function isPopupBrowserToolAction(
  candidate: unknown,
): candidate is PopupBrowserToolAction {
  return (
    typeof candidate === "string" &&
    popupBrowserToolActionSet.has(candidate as PopupBrowserToolAction)
  );
}

export function copyBrowserToolsSnapshot(
  candidate: BrowserToolsSnapshot,
): BrowserToolsSnapshot {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    typeof candidate.applicationMenu !== "boolean" ||
    typeof candidate.customize !== "boolean" ||
    typeof candidate.downloads !== "boolean" ||
    typeof candidate.extensions !== "boolean" ||
    typeof candidate.nativeToolbar !== "boolean" ||
    typeof candidate.protections !== "boolean" ||
    typeof candidate.settings !== "boolean" ||
    typeof candidate.siteInformation !== "boolean" ||
    typeof candidate.sitePermissions !== "boolean"
  ) {
    throw createStateError("FENNEVIA_BROWSER_TOOLS_STATE_SNAPSHOT_INVALID");
  }
  return Object.freeze({
    applicationMenu: candidate.applicationMenu,
    customize: candidate.customize,
    downloads: candidate.downloads,
    extensions: candidate.extensions,
    nativeToolbar: candidate.nativeToolbar,
    protections: candidate.protections,
    settings: candidate.settings,
    siteInformation: candidate.siteInformation,
    sitePermissions: candidate.sitePermissions,
  });
}

export function createBrowserToolsStateAdapter(
  bridge: BrowserToolsBridge,
): BrowserToolsStateAdapter {
  if (
    !bridge ||
    typeof bridge !== "object" ||
    typeof bridge.invoke !== "function" ||
    typeof bridge.snapshot !== "function" ||
    typeof bridge.subscribe !== "function"
  ) {
    throw createStateError("FENNEVIA_BROWSER_TOOLS_STATE_BRIDGE_INVALID");
  }

  let activeBridge: BrowserToolsBridge | null = bridge;
  let disposed = false;
  const snapshot = copyBrowserToolsSnapshot(bridge.snapshot());
  const popupListeners = new Set<(open: boolean) => void>();
  const unsubscribeBridge = bridge.subscribe((event) => {
    if (disposed) {
      return;
    }
    if (event?.type !== "native-popup" || typeof event.open !== "boolean") {
      throw createStateError("FENNEVIA_BROWSER_TOOLS_STATE_EVENT_INVALID");
    }
    for (const listener of Array.from(popupListeners)) {
      listener(event.open);
    }
  });

  if (typeof unsubscribeBridge !== "function") {
    throw createStateError("FENNEVIA_BROWSER_TOOLS_STATE_SUBSCRIPTION_INVALID");
  }

  const requireBridge = (): BrowserToolsBridge => {
    if (disposed || !activeBridge) {
      throw createStateError("FENNEVIA_BROWSER_TOOLS_STATE_DISPOSED");
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
      popupListeners.clear();
      unsubscribeBridge();
      return true;
    },

    async invoke(action: BrowserToolAction, host?: unknown): Promise<boolean> {
      if (!isBrowserToolAction(action)) {
        throw createStateError("FENNEVIA_BROWSER_TOOLS_STATE_ACTION_INVALID");
      }
      if (
        isPopupBrowserToolAction(action) &&
        (host === undefined || host === null || typeof host !== "object")
      ) {
        throw createStateError("FENNEVIA_BROWSER_TOOLS_STATE_HOST_INVALID");
      }
      const result = await requireBridge().invoke(action, host);
      if (typeof result !== "boolean") {
        throw createStateError("FENNEVIA_BROWSER_TOOLS_STATE_RESULT_INVALID");
      }
      return result;
    },

    snapshot(): BrowserToolsSnapshot {
      requireBridge();
      return snapshot;
    },

    status() {
      return Object.freeze({
        disposed,
        subscriberCount: popupListeners.size,
      });
    },

    subscribePopup(listener: (open: boolean) => void): () => boolean {
      requireBridge();
      if (typeof listener !== "function") {
        throw createStateError("FENNEVIA_BROWSER_TOOLS_STATE_LISTENER_INVALID");
      }
      popupListeners.add(listener);
      let subscribed = true;
      return Object.freeze(() => {
        if (!subscribed) {
          return false;
        }
        subscribed = false;
        popupListeners.delete(listener);
        return true;
      });
    },
  });
}
