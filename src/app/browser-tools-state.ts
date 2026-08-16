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

export type BrowserToolAction = (typeof browserToolActions)[number];

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

export type BrowserToolsBridge = Readonly<{
  invoke: (action: BrowserToolAction) => Promise<boolean>;
  snapshot: () => BrowserToolsSnapshot;
}>;

export type BrowserToolsStateAdapter = Readonly<{
  dispose: () => boolean;
  invoke: (action: BrowserToolAction) => Promise<boolean>;
  snapshot: () => BrowserToolsSnapshot;
  status: () => Readonly<{
    disposed: boolean;
  }>;
}>;

const browserToolActionSet = new Set<BrowserToolAction>(browserToolActions);

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
    typeof bridge.snapshot !== "function"
  ) {
    throw createStateError("FENNEVIA_BROWSER_TOOLS_STATE_BRIDGE_INVALID");
  }

  let activeBridge: BrowserToolsBridge | null = bridge;
  let disposed = false;
  const snapshot = copyBrowserToolsSnapshot(bridge.snapshot());

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
      return true;
    },

    async invoke(action: BrowserToolAction): Promise<boolean> {
      if (!isBrowserToolAction(action)) {
        throw createStateError("FENNEVIA_BROWSER_TOOLS_STATE_ACTION_INVALID");
      }
      const result = await requireBridge().invoke(action);
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
      return Object.freeze({ disposed });
    },
  });
}
