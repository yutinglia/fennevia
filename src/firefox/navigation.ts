import type {
  AddressPopupOpenRequest,
  AddressSubmissionResult,
  BrowserNavigationBridge,
  ConnectionSecurityState,
  NavigationPointerGesture,
  NavigationSnapshot,
  NavigationStateEvent,
  TrackingProtectionState,
} from "../app/navigation-state.ts";
import {
  copyNavigationPointerGesture,
  maximumNavigationAddressLength,
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
const OPEN_LOCATION_COMMAND_ID = "Browser:OpenLocation";
const OPEN_LOCATION_KEY_ID = "focusURLBar";
const SHELL_HEALTH_ATTRIBUTE = "data-fennevia-healthy";
const ADDRESS_POPUP_OPEN_REQUEST: AddressPopupOpenRequest = Object.freeze({
  selectAll: true,
  source: "ctrl-l",
  type: "address-popup-open",
});
const ACCEPTED_ADDRESS_SUBMISSION: AddressSubmissionResult = Object.freeze({
  status: "accepted",
});
const EMPTY_ADDRESS_SUBMISSION: AddressSubmissionResult = Object.freeze({
  reason: "empty",
  status: "rejected",
});
const LONG_ADDRESS_SUBMISSION: AddressSubmissionResult = Object.freeze({
  reason: "too-long",
  status: "rejected",
});
const UNSAFE_ADDRESS_SUBMISSION: AddressSubmissionResult = Object.freeze({
  reason: "unsafe-scheme",
  status: "rejected",
});
const EXECUTABLE_SCHEME_PATTERN = /^\s*(?:data|javascript|vbscript)\s*:/iu;
const HIDDEN_COMMITTED_LOCATIONS = new Set([
  "about:blank",
  "about:home",
  "about:newtab",
  "about:privatebrowsing",
]);
const CONNECTION_SECURITY_MAP: Readonly<
  Record<string, ConnectionSecurityState>
> = Object.freeze({
  associated: "associated",
  "cert-error-page": "certificate-error",
  chrome: "internal",
  extension: "extension",
  file: "local",
  "https-only-error-page": "https-only-error",
  "net-error-page": "network-error",
  "not-secure": "not-secure",
  secure: "secure",
  "secure-cert-user-overridden": "secure-certificate-override",
  "secure-etsi": "secure-qualified-certificate",
  "secure-ev": "secure-verified-organization",
});

const getCommandSymbol = (id: string): string =>
  `document.commands[${id.replaceAll(":", "-")}]`;

type NativeRecord = Record<string, unknown>;
type NativeCommand = NativeRecord & {
  hasAttribute: (name: string) => boolean;
};
type NativeUrlbar = NativeRecord & {
  getAttribute: (name: string) => unknown;
  handleCommand: () => unknown;
  value: string;
};
type NativeIdentityHandler = NativeRecord & {
  getConnectionSecurityInformation: () => unknown;
};
type NativeProtectionsHandler = NativeRecord & {
  anyBlocking?: boolean;
  anyDetected?: boolean;
  hasException?: boolean;
  onContentBlockingEvent: (...args: unknown[]) => unknown;
};
type NativeContentBlockingAllowList = NativeRecord & {
  canHandle: (browser: unknown) => unknown;
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

const isEventTarget = (
  value: unknown,
): value is NativeRecord &
  Readonly<{
    addEventListener: (...args: unknown[]) => unknown;
    removeEventListener: (...args: unknown[]) => unknown;
  }> =>
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

const readUrlbarMember = (window: NativeRecord, member: string): unknown => {
  const urlbar = window.gURLBar;
  return isNativeRecord(urlbar) ? urlbar[member] : undefined;
};

const readWindowMember = (window: NativeRecord, member: string): unknown =>
  window[member];

const readDocumentElement = (window: NativeRecord): unknown => {
  const document = window.document;
  return isNativeRecord(document) ? document.documentElement : undefined;
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

const isUrlbar = (value: unknown): value is NativeUrlbar =>
  isEventTarget(value) &&
  typeof value.value === "string" &&
  isFunction(value.getAttribute) &&
  isFunction(value.handleCommand);

const isIdentityHandler = (value: unknown): value is NativeIdentityHandler =>
  isNativeRecord(value) && isFunction(value.getConnectionSecurityInformation);

const isProtectionsHandler = (
  value: unknown,
): value is NativeProtectionsHandler =>
  isNativeRecord(value) && isFunction(value.onContentBlockingEvent);

const isContentBlockingAllowList = (
  value: unknown,
): value is NativeContentBlockingAllowList =>
  isNativeRecord(value) && isFunction(value.canHandle);

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
      isAvailable: isFunction,
      name: "firefox.navigation-selected-browser-focus",
      read: (window: NativeRecord) =>
        readSelectedBrowserMember(window, "focus"),
      symbol: "window.gBrowser.selectedBrowser.focus",
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
    Object.freeze({
      isAvailable: (value: unknown) => typeof value === "string",
      name: "firefox.navigation-urlbar-value",
      read: (window: NativeRecord) => readUrlbarMember(window, "value"),
      symbol: "window.gURLBar.value",
    }),
    Object.freeze({
      isAvailable: isFunction,
      name: "firefox.navigation-urlbar-submission",
      read: (window: NativeRecord) => readUrlbarMember(window, "handleCommand"),
      symbol: "window.gURLBar.handleCommand",
    }),
    Object.freeze({
      isAvailable: isFunction,
      name: "firefox.navigation-urlbar-proxy-state",
      read: (window: NativeRecord) => readUrlbarMember(window, "getAttribute"),
      symbol: "window.gURLBar.getAttribute",
    }),
    Object.freeze({
      isAvailable: isIdentityHandler,
      name: "firefox.navigation-connection-security",
      read: (window: NativeRecord) =>
        readWindowMember(window, "gIdentityHandler"),
      symbol: "window.gIdentityHandler.getConnectionSecurityInformation",
    }),
    Object.freeze({
      isAvailable: isProtectionsHandler,
      name: "firefox.navigation-tracking-protection",
      read: (window: NativeRecord) =>
        readWindowMember(window, "gProtectionsHandler"),
      symbol: "window.gProtectionsHandler.onContentBlockingEvent",
    }),
    Object.freeze({
      isAvailable: isContentBlockingAllowList,
      name: "firefox.navigation-tracking-protection-availability",
      read: (window: NativeRecord) =>
        readWindowMember(window, "ContentBlockingAllowList"),
      symbol: "window.ContentBlockingAllowList.canHandle",
    }),
    Object.freeze({
      isAvailable: (value: unknown) => isCommand(value) && isEventTarget(value),
      name: "firefox.navigation-open-location-command",
      read: (window: NativeRecord) =>
        readDocumentCommand(window, OPEN_LOCATION_COMMAND_ID),
      symbol: getCommandSymbol(OPEN_LOCATION_COMMAND_ID),
    }),
    Object.freeze({
      isAvailable: (value: unknown) =>
        isNativeRecord(value) && isFunction(value.hasAttribute),
      name: "firefox.navigation-shell-health-gate",
      read: readDocumentElement,
      symbol: "document.documentElement.hasAttribute",
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
    Object.freeze({
      isAvailable: isFunction,
      name: "firefox.navigation-action-home",
      read: (window: NativeRecord) => readBrowserCommandsMember(window, "home"),
      symbol: "window.BrowserCommands.home",
    }),
    Object.freeze({
      isAvailable: isFunction,
      name: "firefox.navigation-action-reloadOrDuplicate",
      read: (window: NativeRecord) =>
        readBrowserCommandsMember(window, "reloadOrDuplicate"),
      symbol: "window.BrowserCommands.reloadOrDuplicate",
    }),
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
  left.addressValue === right.addressValue &&
  left.canGoBack === right.canGoBack &&
  left.canGoForward === right.canGoForward &&
  left.connectionSecurity === right.connectionSecurity &&
  left.displayUri === right.displayUri &&
  left.loading === right.loading &&
  left.title === right.title &&
  left.trackingProtection === right.trackingProtection;

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
    addressPopupSubscriberCount: number;
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
    addressValue: "",
    canGoBack: false,
    canGoForward: false,
    connectionSecurity: "unavailable",
    displayUri: "",
    loading: false,
    title: "",
    trackingProtection: "unavailable",
  });
  let commandObserver: NativeMutationObserver | null = null;
  let progressListenerRegistered = false;
  const listenerDisposers: IdempotentDisposer[] = [];
  const subscribers = new Set<(event: NavigationStateEvent) => void>();
  const addressPopupSubscribers = new Set<
    (request: AddressPopupOpenRequest) => boolean
  >();

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

  const requireUrlbar = (): NativeUrlbar => {
    const urlbar = requireWindow().gURLBar;
    if (!isUrlbar(urlbar)) {
      throw createNavigationError(
        boundary,
        "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING",
        "firefox-navigation-capability",
        "window.gURLBar.handleCommand",
      );
    }
    return urlbar;
  };

  const requireIdentityHandler = (): NativeIdentityHandler => {
    const handler = requireWindow().gIdentityHandler;
    if (!isIdentityHandler(handler)) {
      throw createNavigationError(
        boundary,
        "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING",
        "firefox-navigation-snapshot",
        "window.gIdentityHandler.getConnectionSecurityInformation",
      );
    }
    return handler;
  };

  const requireProtectionsHandler = (): NativeProtectionsHandler => {
    const handler = requireWindow().gProtectionsHandler;
    if (!isProtectionsHandler(handler)) {
      throw createNavigationError(
        boundary,
        "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING",
        "firefox-navigation-snapshot",
        "window.gProtectionsHandler.onContentBlockingEvent",
      );
    }
    return handler;
  };

  const requireContentBlockingAllowList =
    (): NativeContentBlockingAllowList => {
      const allowList = requireWindow().ContentBlockingAllowList;
      if (!isContentBlockingAllowList(allowList)) {
        throw createNavigationError(
          boundary,
          "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING",
          "firefox-navigation-snapshot",
          "window.ContentBlockingAllowList.canHandle",
        );
      }
      return allowList;
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

  const readAddressValue = (displayUri: string): string => {
    if (HIDDEN_COMMITTED_LOCATIONS.has(displayUri)) {
      return "";
    }
    const urlbar = requireUrlbar();
    const proxyState = Reflect.apply(urlbar.getAttribute, urlbar, [
      "pageproxystate",
    ]);
    const candidate = proxyState === "valid" ? urlbar.value : displayUri;
    return candidate.slice(0, maximumNavigationAddressLength);
  };

  const readConnectionSecurity = (): ConnectionSecurityState => {
    const handler = requireIdentityHandler();
    const nativeState = Reflect.apply(
      handler.getConnectionSecurityInformation,
      handler,
      [],
    );
    return typeof nativeState === "string"
      ? (CONNECTION_SECURITY_MAP[nativeState] ?? "unavailable")
      : "unavailable";
  };

  const readTrackingProtection = (
    selectedBrowser: NativeRecord,
  ): TrackingProtectionState => {
    const allowList = requireContentBlockingAllowList();
    if (
      Reflect.apply(allowList.canHandle, allowList, [selectedBrowser]) !== true
    ) {
      return "unavailable";
    }
    const handler = requireProtectionsHandler();
    if (
      typeof handler.hasException !== "boolean" ||
      typeof handler.anyBlocking !== "boolean" ||
      typeof handler.anyDetected !== "boolean"
    ) {
      return "unavailable";
    }
    if (handler.hasException) {
      return "exception";
    }
    if (handler.anyBlocking) {
      return "blocking";
    }
    return handler.anyDetected ? "detected" : "no-trackers-detected";
  };

  const readSnapshot = (): NavigationSnapshot => {
    const selectedBrowser = requireSelectedBrowser();
    const selectedTab = requireSelectedTab();
    const displayUri = readCurrentUri(selectedBrowser);
    return Object.freeze({
      addressValue: readAddressValue(displayUri),
      canGoBack: readCommandEnabled(COMMANDS.back.id),
      canGoForward: readCommandEnabled(COMMANDS.forward.id),
      connectionSecurity: readConnectionSecurity(),
      displayUri,
      loading: readCommandEnabled(COMMANDS.stop.id),
      title: String(
        Reflect.apply(selectedTab.getAttribute, selectedTab, ["label"]) ?? "",
      ).slice(0, maximumNavigationTitleLength),
      trackingProtection: readTrackingProtection(selectedBrowser),
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

    onSecurityChange(browser: unknown, webProgress: unknown): void {
      handleProgressUpdate(
        browser,
        webProgress,
        "window.gBrowser.onSecurityChange",
      );
    },

    onContentBlockingEvent(browser: unknown, webProgress: unknown): void {
      handleProgressUpdate(
        browser,
        webProgress,
        "window.gBrowser.onContentBlockingEvent",
      );
    },
  });

  const createCommandEvent = (
    gesture: NavigationPointerGesture,
  ): NativeRecord => ({
    altKey: gesture.altKey,
    button: gesture.button,
    ctrlKey: gesture.ctrlKey,
    metaKey: gesture.metaKey,
    preventDefault() {},
    shiftKey: gesture.shiftKey,
  });

  const invokeBrowserCommand = (
    methodName: string,
    gesture?: NavigationPointerGesture,
  ): boolean => {
    const currentWindow = requireWindow();
    const commands = currentWindow.BrowserCommands;
    const method = isNativeRecord(commands) ? commands[methodName] : undefined;
    if (!isFunction(method)) {
      throw createNavigationError(
        boundary,
        "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING",
        "firefox-navigation-action",
        `window.BrowserCommands.${methodName}`,
      );
    }
    try {
      Reflect.apply(
        method,
        commands,
        gesture === undefined ? [] : [createCommandEvent(gesture)],
      );
      return true;
    } catch (error) {
      throw createNavigationError(
        boundary,
        "FENNEVIA_FIREFOX_NAVIGATION_ACTION_FAILED",
        "firefox-navigation-action",
        `window.BrowserCommands.${methodName}`,
        error,
      );
    }
  };

  const invokeCommand = (
    action: keyof typeof COMMANDS,
    requireEnabled = true,
    gesture?: NavigationPointerGesture,
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
    return invokeBrowserCommand(specification.method, gesture);
  };

  const submitAddress = (value: string): AddressSubmissionResult => {
    if (typeof value !== "string") {
      return EMPTY_ADDRESS_SUBMISSION;
    }
    if (value.length > maximumNavigationAddressLength) {
      return LONG_ADDRESS_SUBMISSION;
    }
    if (value.trim().length === 0) {
      return EMPTY_ADDRESS_SUBMISSION;
    }
    if (EXECUTABLE_SCHEME_PATTERN.test(value)) {
      return UNSAFE_ADDRESS_SUBMISSION;
    }
    requireSelectedBrowser();
    const urlbar = requireUrlbar();
    try {
      urlbar.value = value;
      Reflect.apply(urlbar.handleCommand, urlbar, []);
      return ACCEPTED_ADDRESS_SUBMISSION;
    } catch (error) {
      throw createNavigationError(
        boundary,
        "FENNEVIA_FIREFOX_ADDRESS_SUBMISSION_FAILED",
        "firefox-address-submit",
        "window.gURLBar.handleCommand",
        error,
      );
    }
  };

  const isShellHealthy = (): boolean => {
    const root = readDocumentElement(requireWindow());
    return (
      isNativeRecord(root) &&
      isFunction(root.hasAttribute) &&
      Boolean(Reflect.apply(root.hasAttribute, root, [SHELL_HEALTH_ATTRIBUTE]))
    );
  };

  const isCtrlLCommand = (event: unknown): boolean => {
    if (!isNativeRecord(event) || !isNativeRecord(event.sourceEvent)) {
      return false;
    }
    const sourceTarget = event.sourceEvent.target;
    return (
      isNativeRecord(sourceTarget) && sourceTarget.id === OPEN_LOCATION_KEY_ID
    );
  };

  const handleOpenLocationCommand = (event: unknown): void => {
    if (disposed || failedError) {
      return;
    }
    try {
      if (
        !isShellHealthy() ||
        !isCtrlLCommand(event) ||
        addressPopupSubscribers.size === 0
      ) {
        return;
      }
      reconcile(true);
      let handled = false;
      for (const listener of Array.from(addressPopupSubscribers)) {
        handled = listener(ADDRESS_POPUP_OPEN_REQUEST) === true || handled;
      }
      if (!handled || !isNativeRecord(event)) {
        return;
      }
      if (isFunction(event.preventDefault)) {
        Reflect.apply(event.preventDefault, event, []);
      }
      if (isFunction(event.stopPropagation)) {
        Reflect.apply(event.stopPropagation, event, []);
      }
    } catch (error) {
      reportNativeEventFailure(
        error,
        getCommandSymbol(OPEN_LOCATION_COMMAND_ID),
      );
    }
  };

  const publicBridge: BrowserNavigationBridge = Object.freeze({
    back: (gesture?: NavigationPointerGesture) =>
      invokeCommand(
        "back",
        true,
        gesture === undefined
          ? undefined
          : copyNavigationPointerGesture(gesture),
      ),
    focusContent(): boolean {
      const selectedBrowser = requireSelectedBrowser();
      const focus = selectedBrowser.focus;
      if (!isFunction(focus)) {
        throw createNavigationError(
          boundary,
          "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING",
          "firefox-navigation-focus",
          "window.gBrowser.selectedBrowser.focus",
        );
      }
      try {
        Reflect.apply(focus, selectedBrowser, []);
        return true;
      } catch (error) {
        throw createNavigationError(
          boundary,
          "FENNEVIA_FIREFOX_NAVIGATION_FOCUS_FAILED",
          "firefox-navigation-focus",
          "window.gBrowser.selectedBrowser.focus",
          error,
        );
      }
    },
    forward: (gesture?: NavigationPointerGesture) =>
      invokeCommand(
        "forward",
        true,
        gesture === undefined
          ? undefined
          : copyNavigationPointerGesture(gesture),
      ),
    home(gesture?: NavigationPointerGesture): boolean {
      requireSelectedBrowser();
      return invokeBrowserCommand(
        "home",
        gesture === undefined
          ? undefined
          : copyNavigationPointerGesture(gesture),
      );
    },
    newTab: () => invokeCommand("newTab", false),
    reload(gesture?: NavigationPointerGesture): boolean {
      if (gesture !== undefined) {
        requireSelectedBrowser();
        return invokeBrowserCommand(
          "reloadOrDuplicate",
          copyNavigationPointerGesture(gesture),
        );
      }
      return invokeCommand("reload");
    },

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
    submitAddress,

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

    subscribeAddressPopupOpen(
      listener: (request: AddressPopupOpenRequest) => boolean,
    ): () => boolean {
      requireWindow();
      if (typeof listener !== "function") {
        throw createNavigationError(
          boundary,
          "FENNEVIA_FIREFOX_ADDRESS_POPUP_LISTENER_INVALID",
          "firefox-address-popup-subscribe",
          "navigation.subscribeAddressPopupOpen",
        );
      }
      addressPopupSubscribers.add(listener);
      return createIdempotentDisposer(() => {
        addressPopupSubscribers.delete(listener);
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

    listenerDisposers.push(
      boundary.subscribe(
        requireCommand(OPEN_LOCATION_COMMAND_ID),
        "command",
        handleOpenLocationCommand,
      ),
    );

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
      addressPopupSubscribers.clear();
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
        addressPopupSubscriberCount: addressPopupSubscribers.size,
        disposed,
        failed: failedError !== null,
        revision,
        subscriberCount: subscribers.size,
      });
    },
  });
}
