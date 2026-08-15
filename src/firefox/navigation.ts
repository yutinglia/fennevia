import type {
  BrowserNavigationBridge,
  NavigationSnapshot,
  NavigationStateEvent,
} from "../app/navigation-state.ts";
import {
  maximumNavigationDisplayUriLength,
  maximumNavigationTitleLength,
} from "../app/navigation-state.ts";
import {
  FirefoxBridgeError,
  createIdempotentDisposer,
  isFirefoxBridgeError,
  type FirefoxBridgeBoundary,
  type FirefoxBridgeErrorContext,
  type FirefoxCapabilitySnapshot,
  type IdempotentDisposer,
} from "./bridge-boundary.ts";

const COMMANDS = Object.freeze({
  back: Object.freeze({ id: "Browser:Back", method: "back" }),
  forward: Object.freeze({ id: "Browser:Forward", method: "forward" }),
  newTab: Object.freeze({
    id: "cmd_newNavigatorTabNoEvent",
    method: "openTab",
  }),
  reload: Object.freeze({ id: "Browser:Reload", method: "reload" }),
  stop: Object.freeze({ id: "Browser:Stop", method: "stop" }),
});
const NAVIGATION_TAB_EVENT_TYPES = Object.freeze([
  "TabSelect",
  "TabAttrModified",
]);
const NAVIGATION_TAB_ATTRIBUTES = new Set(["busy", "label", "selected"]);

const getCommandSymbol = (id: string): string =>
  `document.commands[${id.replaceAll(":", "-")}]`;

type NativeRecord = Record<string, unknown>;
type NativeCommand = NativeRecord & {
  hasAttribute: (name: string) => boolean;
};
type NativeTab = NativeRecord & {
  getAttribute: (name: string) => unknown;
};
type NativeMutationObserver = Readonly<{
  disconnect: () => void;
  observe: (target: object, options: unknown) => void;
}>;
type NativeMutationObserverConstructor = new (
  callback: (records: readonly unknown[]) => void,
) => NativeMutationObserver;

type NavigationCapabilityEvaluation = Readonly<{
  cause?: unknown;
  snapshot: FirefoxCapabilitySnapshot;
}>;

type NavigationCapabilitySpecification = Readonly<{
  isAvailable: (value: unknown) => boolean;
  name: string;
  read: (window: NativeRecord) => unknown;
  symbol: string;
}>;

const isNativeRecord = (value: unknown): value is NativeRecord =>
  typeof value === "object" && value !== null;

const isFunction = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === "function";

const isEventTarget = (value: unknown): boolean =>
  isNativeRecord(value) &&
  isFunction(value.addEventListener) &&
  isFunction(value.removeEventListener);

const readGBrowser = (window: NativeRecord): unknown => window.gBrowser;

const readGBrowserMember = (window: NativeRecord, member: string): unknown => {
  const browser = readGBrowser(window);
  return isNativeRecord(browser) ? browser[member] : undefined;
};

const readSelectedBrowserMember = (
  window: NativeRecord,
  member: string,
): unknown => {
  const selectedBrowser = readGBrowserMember(window, "selectedBrowser");
  return isNativeRecord(selectedBrowser) ? selectedBrowser[member] : undefined;
};

const readBrowserCommandsMember = (
  window: NativeRecord,
  member: string,
): unknown => {
  const commands = window.BrowserCommands;
  return isNativeRecord(commands) ? commands[member] : undefined;
};

const readDocumentCommand = (window: NativeRecord, id: string): unknown => {
  const document = window.document;
  if (!isNativeRecord(document) || !isFunction(document.getElementById)) {
    return undefined;
  }
  return Reflect.apply(document.getElementById, document, [id]);
};

const isCommand = (value: unknown): value is NativeCommand =>
  isNativeRecord(value) && isFunction(value.hasAttribute);

const isSelectedBrowserNavigationShape = (
  value: unknown,
): value is NativeRecord &
  Readonly<{ canGoBack: boolean; canGoForward: boolean }> =>
  isNativeRecord(value) &&
  typeof value.canGoBack === "boolean" &&
  typeof value.canGoForward === "boolean";

const isCurrentUri = (
  value: unknown,
): value is NativeRecord & Readonly<{ displaySpec?: string; spec?: string }> =>
  isNativeRecord(value) &&
  (typeof value.displaySpec === "string" || typeof value.spec === "string");

const navigationCapabilitySpecifications: readonly NavigationCapabilitySpecification[] =
  Object.freeze([
    Object.freeze({
      isAvailable: isSelectedBrowserNavigationShape,
      name: "firefox.navigation-selected-browser",
      read: (window: NativeRecord) =>
        readGBrowserMember(window, "selectedBrowser"),
      symbol: "window.gBrowser.selectedBrowser.canGoBack",
    }),
    Object.freeze({
      isAvailable: isCurrentUri,
      name: "firefox.navigation-current-uri",
      read: (window: NativeRecord) =>
        readSelectedBrowserMember(window, "currentURI"),
      symbol: "window.gBrowser.selectedBrowser.currentURI.displaySpec",
    }),
    Object.freeze({
      isAvailable: (value: unknown) =>
        isNativeRecord(value) && isFunction(value.getAttribute),
      name: "firefox.navigation-selected-tab",
      read: (window: NativeRecord) => readGBrowserMember(window, "selectedTab"),
      symbol: "window.gBrowser.selectedTab.getAttribute",
    }),
    Object.freeze({
      isAvailable: isEventTarget,
      name: "firefox.navigation-tab-events",
      read: (window: NativeRecord) =>
        readGBrowserMember(window, "tabContainer"),
      symbol: "window.gBrowser.tabContainer",
    }),
    ...[
      ["add-progress-listener", "addTabsProgressListener"],
      ["remove-progress-listener", "removeTabsProgressListener"],
    ].map(([name, member]) =>
      Object.freeze({
        isAvailable: isFunction,
        name: `firefox.navigation-${name}`,
        read: (window: NativeRecord) => readGBrowserMember(window, member),
        symbol: `window.gBrowser.${member}`,
      }),
    ),
    Object.freeze({
      isAvailable: isFunction,
      name: "firefox.navigation-mutation-observer",
      read: (window: NativeRecord) => window.MutationObserver,
      symbol: "window.MutationObserver",
    }),
    ...Object.values(COMMANDS).flatMap(({ id, method }) => [
      Object.freeze({
        isAvailable: isCommand,
        name: `firefox.navigation-command-${method}`,
        read: (window: NativeRecord) => readDocumentCommand(window, id),
        symbol: getCommandSymbol(id),
      }),
      Object.freeze({
        isAvailable: isFunction,
        name: `firefox.navigation-action-${method}`,
        read: (window: NativeRecord) =>
          readBrowserCommandsMember(window, method),
        symbol: `window.BrowserCommands.${method}`,
      }),
    ]),
  ]);

const evaluateNavigationCapabilities = (
  window: NativeRecord,
): readonly NavigationCapabilityEvaluation[] =>
  Object.freeze(
    navigationCapabilitySpecifications.map((specification) => {
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

const createNavigationError = (
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

const snapshotsEqual = (
  left: NavigationSnapshot,
  right: NavigationSnapshot,
): boolean =>
  left.canGoBack === right.canGoBack &&
  left.canGoForward === right.canGoForward &&
  left.displayUri === right.displayUri &&
  left.loading === right.loading &&
  left.title === right.title;

const isRelevantTabAttributeEvent = (event: unknown): boolean => {
  if (!isNativeRecord(event) || !isNativeRecord(event.detail)) {
    return true;
  }
  const changed = event.detail.changed;
  if (
    !Array.isArray(changed) ||
    changed.some((value) => typeof value !== "string")
  ) {
    return true;
  }
  return changed.some((attribute) => NAVIGATION_TAB_ATTRIBUTES.has(attribute));
};

export type FirefoxNavigationBridgeController = Readonly<{
  assertRequiredCapabilities: () => readonly FirefoxCapabilitySnapshot[];
  dispose: () => boolean;
  navigation: BrowserNavigationBridge;
  snapshot: () => Readonly<{
    disposed: boolean;
    failed: boolean;
    revision: number;
    subscriberCount: number;
  }>;
}>;

export function createFirefoxNavigationBridge({
  boundary,
  onError,
  window,
}: Readonly<{
  boundary: FirefoxBridgeBoundary;
  onError: (error: unknown) => void;
  window: unknown;
}>): FirefoxNavigationBridgeController {
  boundary.assertOwnsWindow(window);
  if (!isNativeRecord(window) || typeof onError !== "function") {
    throw createNavigationError(
      boundary,
      "FENNEVIA_FIREFOX_NAVIGATION_OPTIONS_INVALID",
      "firefox-navigation-create",
      "window",
    );
  }

  let nativeWindow: NativeRecord | null = window;
  let disposed = false;
  let failedError: FirefoxBridgeError | null = null;
  let revision = 0;
  let currentSnapshot: NavigationSnapshot = Object.freeze({
    canGoBack: false,
    canGoForward: false,
    displayUri: "",
    loading: false,
    title: "",
  });
  let commandObserver: NativeMutationObserver | null = null;
  let progressListenerRegistered = false;
  const listenerDisposers: IdempotentDisposer[] = [];
  const subscribers = new Set<(event: NavigationStateEvent) => void>();

  const requireWindow = (): NativeRecord => {
    if (disposed || !nativeWindow) {
      throw createNavigationError(
        boundary,
        "FENNEVIA_FIREFOX_NAVIGATION_DISPOSED",
        "firefox-navigation-access",
        "window.gBrowser.selectedBrowser",
      );
    }
    if (failedError) {
      throw failedError;
    }
    boundary.assertOwnsWindow(nativeWindow);
    return nativeWindow;
  };

  const requireGBrowser = (): NativeRecord => {
    const browser = requireWindow().gBrowser;
    if (!isNativeRecord(browser)) {
      throw createNavigationError(
        boundary,
        "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING",
        "firefox-navigation-capability",
        "window.gBrowser",
      );
    }
    return browser;
  };

  const requireSelectedBrowser = (): NativeRecord => {
    const selectedBrowser = requireGBrowser().selectedBrowser;
    if (!isSelectedBrowserNavigationShape(selectedBrowser)) {
      throw createNavigationError(
        boundary,
        "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING",
        "firefox-navigation-snapshot",
        "window.gBrowser.selectedBrowser.canGoBack",
      );
    }
    return selectedBrowser;
  };

  const requireSelectedTab = (): NativeTab => {
    const selectedTab = requireGBrowser().selectedTab;
    if (!isNativeRecord(selectedTab) || !isFunction(selectedTab.getAttribute)) {
      throw createNavigationError(
        boundary,
        "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING",
        "firefox-navigation-snapshot",
        "window.gBrowser.selectedTab.getAttribute",
      );
    }
    return selectedTab as NativeTab;
  };

  const requireCommand = (id: string): NativeCommand => {
    const command = readDocumentCommand(requireWindow(), id);
    if (!isCommand(command)) {
      throw createNavigationError(
        boundary,
        "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING",
        "firefox-navigation-command",
        getCommandSymbol(id),
      );
    }
    return command;
  };

  const assertRequiredCapabilities = () => {
    const evaluations = evaluateNavigationCapabilities(requireWindow());
    const missing = evaluations.find(
      (evaluation) => !evaluation.snapshot.available,
    );
    if (missing) {
      throw createNavigationError(
        boundary,
        "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING",
        "firefox-navigation-capability",
        missing.snapshot.symbol,
        missing.cause,
      );
    }
    return Object.freeze(evaluations.map((evaluation) => evaluation.snapshot));
  };

  const readCommandEnabled = (id: string): boolean => {
    const command = requireCommand(id);
    return !Reflect.apply(command.hasAttribute, command, ["disabled"]);
  };

  const readCurrentUri = (selectedBrowser: NativeRecord): string => {
    const uri = selectedBrowser.currentURI;
    if (!isCurrentUri(uri)) {
      throw createNavigationError(
        boundary,
        "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING",
        "firefox-navigation-snapshot",
        "window.gBrowser.selectedBrowser.currentURI.displaySpec",
      );
    }
    const candidate =
      typeof uri.displaySpec === "string" ? uri.displaySpec : uri.spec;
    return String(candidate ?? "").slice(0, maximumNavigationDisplayUriLength);
  };

  const readSnapshot = (): NavigationSnapshot => {
    const selectedBrowser = requireSelectedBrowser();
    const selectedTab = requireSelectedTab();
    return Object.freeze({
      canGoBack: readCommandEnabled(COMMANDS.back.id),
      canGoForward: readCommandEnabled(COMMANDS.forward.id),
      displayUri: readCurrentUri(selectedBrowser),
      loading: readCommandEnabled(COMMANDS.stop.id),
      title: String(
        Reflect.apply(selectedTab.getAttribute, selectedTab, ["label"]) ?? "",
      ).slice(0, maximumNavigationTitleLength),
    });
  };

  const notifySubscribers = (): void => {
    const event: NavigationStateEvent = Object.freeze({
      revision,
      snapshot: currentSnapshot,
      type: "snapshot",
    });
    for (const listener of Array.from(subscribers)) {
      try {
        listener(event);
      } catch (error) {
        onError(
          createNavigationError(
            boundary,
            "FENNEVIA_FIREFOX_NAVIGATION_SUBSCRIBER_FAILED",
            "firefox-navigation-notify",
            "navigation.subscribe",
            error,
          ),
        );
      }
    }
  };

  const reconcile = (notify: boolean): boolean => {
    const nextSnapshot = readSnapshot();
    if (snapshotsEqual(currentSnapshot, nextSnapshot) && revision > 0) {
      return false;
    }
    currentSnapshot = nextSnapshot;
    revision += 1;
    if (notify) {
      notifySubscribers();
    }
    return true;
  };

  const reportNativeEventFailure = (error: unknown, symbol: string): void => {
    failedError = isFirefoxBridgeError(error)
      ? error
      : createNavigationError(
          boundary,
          "FENNEVIA_FIREFOX_NAVIGATION_EVENT_FAILED",
          "firefox-navigation-event",
          symbol,
          error,
        );
    onError(failedError);
  };

  const handleNativeUpdate = (symbol: string): void => {
    if (disposed || failedError) {
      return;
    }
    try {
      reconcile(true);
    } catch (error) {
      reportNativeEventFailure(error, symbol);
    }
  };

  const handleProgressUpdate = (
    browser: unknown,
    webProgress: unknown,
    symbol: string,
  ): void => {
    if (disposed || failedError) {
      return;
    }
    try {
      if (
        browser === requireGBrowser().selectedBrowser &&
        isNativeRecord(webProgress) &&
        webProgress.isTopLevel === true
      ) {
        reconcile(true);
      }
    } catch (error) {
      reportNativeEventFailure(error, symbol);
    }
  };

  const progressListener = Object.freeze({
    onLocationChange(browser: unknown, webProgress: unknown): void {
      handleProgressUpdate(
        browser,
        webProgress,
        "window.gBrowser.onLocationChange",
      );
    },

    onStateChange(browser: unknown, webProgress: unknown): void {
      handleProgressUpdate(
        browser,
        webProgress,
        "window.gBrowser.onStateChange",
      );
    },
  });

  const invokeCommand = (
    action: keyof typeof COMMANDS,
    requireEnabled = true,
  ): boolean => {
    const specification = COMMANDS[action];
    requireSelectedBrowser();
    const command = requireCommand(specification.id);
    if (
      requireEnabled &&
      Boolean(Reflect.apply(command.hasAttribute, command, ["disabled"]))
    ) {
      return false;
    }
    const currentWindow = requireWindow();
    const commands = currentWindow.BrowserCommands;
    const method = isNativeRecord(commands)
      ? commands[specification.method]
      : undefined;
    if (!isFunction(method)) {
      throw createNavigationError(
        boundary,
        "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING",
        "firefox-navigation-action",
        `window.BrowserCommands.${specification.method}`,
      );
    }
    try {
      Reflect.apply(method, commands, []);
      return true;
    } catch (error) {
      throw createNavigationError(
        boundary,
        "FENNEVIA_FIREFOX_NAVIGATION_ACTION_FAILED",
        "firefox-navigation-action",
        `window.BrowserCommands.${specification.method}`,
        error,
      );
    }
  };

  const publicBridge: BrowserNavigationBridge = Object.freeze({
    back: () => invokeCommand("back"),
    forward: () => invokeCommand("forward"),
    newTab: () => invokeCommand("newTab", false),
    reload: () => invokeCommand("reload"),

    reloadOrStop(): "reload" | "stop" {
      const action = readCommandEnabled(COMMANDS.stop.id) ? "stop" : "reload";
      invokeCommand(action);
      return action;
    },

    snapshot(): NavigationSnapshot {
      requireWindow();
      return currentSnapshot;
    },

    stop: () => invokeCommand("stop"),

    subscribe(listener: (event: NavigationStateEvent) => void): () => boolean {
      requireWindow();
      if (typeof listener !== "function") {
        throw createNavigationError(
          boundary,
          "FENNEVIA_FIREFOX_NAVIGATION_LISTENER_INVALID",
          "firefox-navigation-subscribe",
          "navigation.subscribe",
        );
      }
      subscribers.add(listener);
      return createIdempotentDisposer(() => {
        subscribers.delete(listener);
      });
    },
  });

  try {
    boundary.assertRequiredCapabilities();
    assertRequiredCapabilities();
    reconcile(false);

    const tabContainer = requireGBrowser().tabContainer;
    for (const eventType of NAVIGATION_TAB_EVENT_TYPES) {
      listenerDisposers.push(
        boundary.subscribe(tabContainer, eventType, (event) => {
          if (disposed || failedError) {
            return;
          }
          try {
            if (eventType === "TabAttrModified") {
              if (
                isNativeRecord(event) &&
                event.target !== requireGBrowser().selectedTab
              ) {
                return;
              }
              if (!isRelevantTabAttributeEvent(event)) {
                return;
              }
            }
            reconcile(true);
          } catch (error) {
            reportNativeEventFailure(
              error,
              `window.gBrowser.tabContainer.${eventType}`,
            );
          }
        }),
      );
    }

    const browser = requireGBrowser();
    Reflect.apply(
      browser.addTabsProgressListener as (...args: unknown[]) => unknown,
      browser,
      [progressListener],
    );
    progressListenerRegistered = true;

    const Observer = requireWindow()
      .MutationObserver as NativeMutationObserverConstructor;
    commandObserver = new Observer(() => {
      handleNativeUpdate("document.command.disabled");
    });
    for (const { id } of Object.values(COMMANDS)) {
      commandObserver.observe(requireCommand(id), {
        attributeFilter: ["disabled"],
        attributes: true,
      });
    }
  } catch (error) {
    disposed = true;
    let cleanupError: unknown;
    try {
      commandObserver?.disconnect();
    } catch (candidate) {
      cleanupError ??= candidate;
    }
    commandObserver = null;
    if (progressListenerRegistered && nativeWindow) {
      try {
        const browser = isNativeRecord(nativeWindow.gBrowser)
          ? nativeWindow.gBrowser
          : null;
        if (browser && isFunction(browser.removeTabsProgressListener)) {
          Reflect.apply(browser.removeTabsProgressListener, browser, [
            progressListener,
          ]);
        }
      } catch (candidate) {
        cleanupError ??= candidate;
      }
    }
    progressListenerRegistered = false;
    for (const disposeListener of listenerDisposers.reverse()) {
      try {
        disposeListener();
      } catch (candidate) {
        cleanupError ??= candidate;
      }
    }
    nativeWindow = null;
    if (cleanupError !== undefined) {
      onError(
        createNavigationError(
          boundary,
          "FENNEVIA_FIREFOX_NAVIGATION_DISPOSE_FAILED",
          "firefox-navigation-dispose",
          "window.gBrowser.removeTabsProgressListener",
          cleanupError,
        ),
      );
    }
    throw error;
  }

  return Object.freeze({
    assertRequiredCapabilities,

    dispose(): boolean {
      if (disposed) {
        return false;
      }
      disposed = true;
      let firstError: unknown;
      try {
        commandObserver?.disconnect();
      } catch (error) {
        firstError ??= error;
      }
      commandObserver = null;
      if (progressListenerRegistered && nativeWindow) {
        try {
          const browser = isNativeRecord(nativeWindow.gBrowser)
            ? nativeWindow.gBrowser
            : null;
          if (!browser || !isFunction(browser.removeTabsProgressListener)) {
            throw new TypeError(
              "FENNEVIA_FIREFOX_NAVIGATION_PROGRESS_DISPOSER_INVALID",
            );
          }
          Reflect.apply(browser.removeTabsProgressListener, browser, [
            progressListener,
          ]);
        } catch (error) {
          firstError ??= error;
        }
      }
      progressListenerRegistered = false;
      for (const disposeListener of listenerDisposers.reverse()) {
        try {
          disposeListener();
        } catch (error) {
          firstError ??= error;
        }
      }
      listenerDisposers.length = 0;
      subscribers.clear();
      nativeWindow = null;
      if (firstError !== undefined) {
        throw createNavigationError(
          boundary,
          "FENNEVIA_FIREFOX_NAVIGATION_DISPOSE_FAILED",
          "firefox-navigation-dispose",
          "window.gBrowser.removeTabsProgressListener",
          firstError,
        );
      }
      return true;
    },

    navigation: publicBridge,

    snapshot() {
      return Object.freeze({
        disposed,
        failed: failedError !== null,
        revision,
        subscriberCount: subscribers.size,
      });
    },
  });
}
