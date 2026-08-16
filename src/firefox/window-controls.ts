import {
  isWindowControlAction,
  type BrowserWindowControlsBridge,
  type WindowControlAction,
  type WindowControlsSnapshot,
} from "../app/window-controls-state.ts";
import {
  FirefoxBridgeError,
  subscribeFirefoxEvent,
  type FirefoxBridgeBoundary,
  type FirefoxBridgeErrorContext,
  type FirefoxCapabilitySnapshot,
  type IdempotentDisposer,
} from "./bridge-boundary.ts";

type NativeRecord = Record<string, unknown>;

type WindowControlsCapabilityEvaluation = Readonly<{
  cause?: unknown;
  snapshot: FirefoxCapabilitySnapshot;
}>;

type WindowControlsCapabilitySpecification = Readonly<{
  isAvailable: (value: unknown) => boolean;
  name: string;
  read: (window: NativeRecord) => unknown;
  symbol: string;
}>;

const isNativeRecord = (value: unknown): value is NativeRecord =>
  typeof value === "object" && value !== null;

const isFunction = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === "function";

const getDocumentElementById = (window: NativeRecord, id: string): unknown => {
  const document = window.document;
  if (!isNativeRecord(document) || !isFunction(document.getElementById)) {
    return undefined;
  }
  return Reflect.apply(document.getElementById, document, [id]);
};

const defineWindowControlsCapability = (
  specification: WindowControlsCapabilitySpecification,
): WindowControlsCapabilitySpecification => Object.freeze(specification);

const windowControlsCapabilitySpecifications: ReadonlyArray<WindowControlsCapabilitySpecification> =
  Object.freeze([
    defineWindowControlsCapability({
      isAvailable: isFunction,
      name: "window-controls.minimize",
      read: (window) => window.minimize,
      symbol: "window.minimize",
    }),
    defineWindowControlsCapability({
      isAvailable: isFunction,
      name: "window-controls.maximize",
      read: (window) => window.maximize,
      symbol: "window.maximize",
    }),
    defineWindowControlsCapability({
      isAvailable: isFunction,
      name: "window-controls.restore",
      read: (window) => window.restore,
      symbol: "window.restore",
    }),
    defineWindowControlsCapability({
      isAvailable: (value) => typeof value === "number",
      name: "window-controls.window-state",
      read: (window) => window.windowState,
      symbol: "window.windowState",
    }),
    defineWindowControlsCapability({
      isAvailable: (value) => typeof value === "number",
      name: "window-controls.state-maximized",
      read: (window) => window.STATE_MAXIMIZED,
      symbol: "window.STATE_MAXIMIZED",
    }),
    defineWindowControlsCapability({
      isAvailable: isFunction,
      name: "window-controls.sizemode-events",
      read: (window) => window.addEventListener,
      symbol: "window.addEventListener",
    }),
    defineWindowControlsCapability({
      isAvailable: (value) =>
        isNativeRecord(value) && isFunction(value.doCommand),
      name: "window-controls.close-command",
      read: (window) => getDocumentElementById(window, "cmd_closeWindow"),
      symbol: "document.cmd_closeWindow.doCommand",
    }),
  ]);

const evaluateWindowControlsCapabilities = (
  window: NativeRecord,
): readonly WindowControlsCapabilityEvaluation[] =>
  Object.freeze(
    windowControlsCapabilitySpecifications.map((specification) => {
      let available = false;
      let cause: unknown;
      try {
        available = specification.isAvailable(specification.read(window));
      } catch (error) {
        cause = error;
      }
      return Object.freeze({
        ...(cause === undefined ? {} : { cause }),
        snapshot: Object.freeze({
          available,
          name: specification.name,
          requirement: "required" as const,
          symbol: specification.symbol,
        }),
      });
    }),
  );

const getErrorContext = (
  boundary: FirefoxBridgeBoundary,
): FirefoxBridgeErrorContext => {
  const snapshot = boundary.snapshot();
  return Object.freeze({
    buildId: snapshot.buildId,
    firefoxVersion: snapshot.firefoxVersion,
    windowKind: snapshot.windowKind,
  });
};

const createWindowControlsError = (
  boundary: FirefoxBridgeBoundary,
  code: string,
  phase: string,
  symbol: string,
  cause?: unknown,
): FirefoxBridgeError =>
  new FirefoxBridgeError({
    cause,
    code,
    context: getErrorContext(boundary),
    phase,
    symbol,
  });

const readSnapshot = (window: NativeRecord): WindowControlsSnapshot => {
  const maximized =
    window.windowState === window.STATE_MAXIMIZED ||
    (typeof window.STATE_FULLSCREEN === "number" &&
      window.windowState === window.STATE_FULLSCREEN);
  return Object.freeze({
    maximized,
  });
};

export type FirefoxWindowControlsBridgeController = Readonly<{
  assertRequiredCapabilities: () => readonly FirefoxCapabilitySnapshot[];
  dispose: () => boolean;
  snapshot: () => Readonly<{
    disposed: boolean;
  }>;
  windowControls: BrowserWindowControlsBridge;
}>;

export function createFirefoxWindowControlsBridge({
  boundary,
  onError,
  window,
}: Readonly<{
  boundary: FirefoxBridgeBoundary;
  onError: (error: unknown) => void;
  window: unknown;
}>): FirefoxWindowControlsBridgeController {
  boundary.assertOwnsWindow(window);
  if (!isNativeRecord(window) || typeof onError !== "function") {
    throw createWindowControlsError(
      boundary,
      "FENNEVIA_FIREFOX_WINDOW_CONTROLS_OPTIONS_INVALID",
      "firefox-window-controls-create",
      "window",
    );
  }

  let nativeWindow: NativeRecord | null = window;
  let disposed = false;
  const listeners = new Set<(snapshot: WindowControlsSnapshot) => void>();
  let eventDisposer: IdempotentDisposer | undefined;

  const requireWindow = (): NativeRecord => {
    if (disposed || !nativeWindow) {
      throw createWindowControlsError(
        boundary,
        "FENNEVIA_FIREFOX_WINDOW_CONTROLS_DISPOSED",
        "firefox-window-controls-access",
        "window",
      );
    }
    return nativeWindow;
  };

  const assertRequiredCapabilities =
    (): readonly FirefoxCapabilitySnapshot[] => {
      const evaluations = evaluateWindowControlsCapabilities(requireWindow());
      const missing = evaluations.find(
        (evaluation) => !evaluation.snapshot.available,
      );
      if (missing) {
        throw createWindowControlsError(
          boundary,
          "FENNEVIA_FIREFOX_WINDOW_CONTROLS_CAPABILITY_MISSING",
          "firefox-window-controls-capability",
          missing.snapshot.symbol,
          missing.cause,
        );
      }
      return Object.freeze(
        evaluations.map((evaluation) => evaluation.snapshot),
      );
    };

  const notify = (): void => {
    let snapshot: WindowControlsSnapshot;
    try {
      snapshot = readSnapshot(requireWindow());
    } catch (error) {
      onError(error);
      return;
    }
    for (const listener of Array.from(listeners)) {
      try {
        listener(snapshot);
      } catch (error) {
        onError(
          createWindowControlsError(
            boundary,
            "FENNEVIA_FIREFOX_WINDOW_CONTROLS_SUBSCRIBER_FAILED",
            "firefox-window-controls-notify",
            "windowControls.subscribe",
            error,
          ),
        );
      }
    }
  };

  const invoke = (action: WindowControlAction): boolean => {
    if (!isWindowControlAction(action)) {
      throw createWindowControlsError(
        boundary,
        "FENNEVIA_FIREFOX_WINDOW_CONTROLS_ACTION_INVALID",
        "firefox-window-controls-action",
        "windowControls.action",
      );
    }
    assertRequiredCapabilities();
    const current = requireWindow();
    try {
      if (action === "minimize") {
        Reflect.apply(
          current.minimize as (...args: unknown[]) => unknown,
          current,
          [],
        );
        return true;
      }
      if (action === "toggle-maximize") {
        if (readSnapshot(current).maximized) {
          Reflect.apply(
            current.restore as (...args: unknown[]) => unknown,
            current,
            [],
          );
        } else {
          Reflect.apply(
            current.maximize as (...args: unknown[]) => unknown,
            current,
            [],
          );
        }
        return true;
      }
      const command = getDocumentElementById(current, "cmd_closeWindow");
      if (!isNativeRecord(command) || !isFunction(command.doCommand)) {
        throw createWindowControlsError(
          boundary,
          "FENNEVIA_FIREFOX_WINDOW_CONTROLS_CAPABILITY_MISSING",
          "firefox-window-controls-action",
          "document.cmd_closeWindow.doCommand",
        );
      }
      Reflect.apply(command.doCommand, command, []);
      return true;
    } catch (error) {
      if (error instanceof FirefoxBridgeError) {
        throw error;
      }
      throw createWindowControlsError(
        boundary,
        "FENNEVIA_FIREFOX_WINDOW_CONTROLS_ACTION_FAILED",
        "firefox-window-controls-action",
        action === "close"
          ? "document.cmd_closeWindow.doCommand"
          : `window.${action}`,
        error,
      );
    }
  };

  try {
    eventDisposer = subscribeFirefoxEvent({
      listener() {
        notify();
      },
      target: window,
      type: "sizemodechange",
    });
  } catch (error) {
    throw createWindowControlsError(
      boundary,
      "FENNEVIA_FIREFOX_WINDOW_CONTROLS_SUBSCRIBE_FAILED",
      "firefox-window-controls-subscribe",
      "window.addEventListener",
      error,
    );
  }

  const publicBridge: BrowserWindowControlsBridge = Object.freeze({
    invoke,
    snapshot(): WindowControlsSnapshot {
      return readSnapshot(requireWindow());
    },
    subscribe(listener: (snapshot: WindowControlsSnapshot) => void) {
      if (typeof listener !== "function") {
        throw createWindowControlsError(
          boundary,
          "FENNEVIA_FIREFOX_WINDOW_CONTROLS_LISTENER_INVALID",
          "firefox-window-controls-subscribe",
          "windowControls.subscribe",
        );
      }
      requireWindow();
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });

  return Object.freeze({
    assertRequiredCapabilities,
    dispose(): boolean {
      if (disposed) {
        return false;
      }
      disposed = true;
      nativeWindow = null;
      listeners.clear();
      eventDisposer?.();
      eventDisposer = undefined;
      return true;
    },
    snapshot() {
      return Object.freeze({ disposed });
    },
    windowControls: publicBridge,
  });
}
