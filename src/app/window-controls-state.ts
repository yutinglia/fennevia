export const windowControlActions = Object.freeze([
  "close",
  "minimize",
  "toggle-maximize",
] as const);

export type WindowControlAction = (typeof windowControlActions)[number];

export type WindowControlsSnapshot = Readonly<{
  maximized: boolean;
}>;

export type BrowserWindowControlsBridge = Readonly<{
  invoke: (action: WindowControlAction) => boolean;
  snapshot: () => WindowControlsSnapshot;
  subscribe: (
    listener: (snapshot: WindowControlsSnapshot) => void,
  ) => () => boolean;
}>;

export type BrowserWindowControlsStateAdapter = Readonly<{
  dispose: () => boolean;
  invoke: (action: WindowControlAction) => boolean;
  snapshot: () => WindowControlsSnapshot;
  status: () => Readonly<{
    disposed: boolean;
  }>;
  subscribe: (
    listener: (snapshot: WindowControlsSnapshot) => void,
  ) => () => boolean;
}>;

const windowControlActionSet = new Set<WindowControlAction>(
  windowControlActions,
);

const createStateError = (code: string): Error => {
  const error = new Error(code);
  error.name = "FenneviaWindowControlsStateError";
  Object.defineProperties(error, {
    fenneviaCode: { enumerable: false, value: code },
    fenneviaPhase: { enumerable: false, value: "window-controls-state" },
  });
  return error;
};

export function isWindowControlAction(
  candidate: unknown,
): candidate is WindowControlAction {
  return (
    typeof candidate === "string" &&
    windowControlActionSet.has(candidate as WindowControlAction)
  );
}

export function copyWindowControlsSnapshot(
  candidate: WindowControlsSnapshot,
): WindowControlsSnapshot {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    typeof candidate.maximized !== "boolean"
  ) {
    throw createStateError("FENNEVIA_WINDOW_CONTROLS_STATE_SNAPSHOT_INVALID");
  }
  return Object.freeze({
    maximized: candidate.maximized,
  });
}

export function createBrowserWindowControlsStateAdapter(
  bridge: BrowserWindowControlsBridge,
): BrowserWindowControlsStateAdapter {
  if (
    !bridge ||
    typeof bridge !== "object" ||
    typeof bridge.invoke !== "function" ||
    typeof bridge.snapshot !== "function" ||
    typeof bridge.subscribe !== "function"
  ) {
    throw createStateError("FENNEVIA_WINDOW_CONTROLS_STATE_BRIDGE_INVALID");
  }

  let activeBridge: BrowserWindowControlsBridge | null = bridge;
  let disposed = false;
  let snapshot = copyWindowControlsSnapshot(bridge.snapshot());
  const listeners = new Set<(snapshot: WindowControlsSnapshot) => void>();
  const unsubscribeBridge = bridge.subscribe((nextSnapshot) => {
    if (disposed) {
      return;
    }
    const copied = copyWindowControlsSnapshot(nextSnapshot);
    if (copied.maximized === snapshot.maximized) {
      return;
    }
    snapshot = copied;
    for (const listener of Array.from(listeners)) {
      listener(snapshot);
    }
  });

  if (typeof unsubscribeBridge !== "function") {
    throw createStateError(
      "FENNEVIA_WINDOW_CONTROLS_STATE_SUBSCRIPTION_INVALID",
    );
  }

  const requireBridge = (): BrowserWindowControlsBridge => {
    if (disposed || !activeBridge) {
      throw createStateError("FENNEVIA_WINDOW_CONTROLS_STATE_DISPOSED");
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

    invoke(action: WindowControlAction): boolean {
      if (!isWindowControlAction(action)) {
        throw createStateError("FENNEVIA_WINDOW_CONTROLS_STATE_ACTION_INVALID");
      }
      const result = requireBridge().invoke(action);
      if (typeof result !== "boolean") {
        throw createStateError("FENNEVIA_WINDOW_CONTROLS_STATE_RESULT_INVALID");
      }
      return result;
    },

    snapshot(): WindowControlsSnapshot {
      requireBridge();
      return snapshot;
    },

    status() {
      return Object.freeze({ disposed });
    },

    subscribe(listener: (snapshot: WindowControlsSnapshot) => void) {
      if (typeof listener !== "function") {
        throw createStateError(
          "FENNEVIA_WINDOW_CONTROLS_STATE_LISTENER_INVALID",
        );
      }
      requireBridge();
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}
