import type {
  BlockedPermissionIndicatorKind,
  BrowserUrlbarCoverageBridge,
  SharingIndicatorKind,
  UrlbarCoverageSnapshot,
  UrlbarCoverageStateEvent,
  UrlbarItemKind,
} from "../app/urlbar-coverage-state.ts";
import { urlbarItemKinds } from "../app/urlbar-coverage-state.ts";
import {
  FirefoxBridgeError,
  createIdempotentDisposer,
  isFirefoxBridgeError,
  type FirefoxBridgeBoundary,
  type FirefoxBridgeErrorContext,
  type FirefoxCapabilitySnapshot,
} from "./bridge-boundary.ts";

type NativeRecord = Record<string, unknown>;
type NativeElement = NativeRecord & {
  getAttribute: (name: string) => unknown;
  hasAttribute: (name: string) => boolean;
};
type NativeDocument = NativeRecord & {
  getElementById: (id: string) => unknown;
};
type NativeMutationObserver = Readonly<{
  disconnect: () => void;
  observe: (target: object, options: unknown) => void;
}>;
type NativeMutationObserverConstructor = new (
  callback: (records: readonly unknown[]) => void,
) => NativeMutationObserver;

type UrlbarCoverageCapabilityEvaluation = Readonly<{
  cause?: unknown;
  snapshot: FirefoxCapabilitySnapshot;
}>;

type UrlbarCoverageCapabilitySpecification = Readonly<{
  isAvailable: (value: unknown) => boolean;
  name: string;
  read: (window: NativeRecord) => unknown;
  symbol: string;
}>;

const REQUIRED_ELEMENT_IDS = Object.freeze([
  "blocked-permissions-container",
  "identity-permission-box",
  "page-action-buttons",
] as const);

const BLOCKED_PERMISSION_KIND_BY_ID: Readonly<
  Record<string, BlockedPermissionIndicatorKind>
> = Object.freeze({
  "autoplay-media": "autoplay",
  camera: "camera",
  canvas: "canvas",
  install: "install",
  "local-network": "local-network",
  geo: "location",
  "loopback-network": "loopback-network",
  microphone: "microphone",
  midi: "midi",
  "desktop-notification": "notifications",
  "persistent-storage": "persistent-storage",
  popup: "popups",
  screen: "screen",
  serial: "serial",
  xr: "xr",
});

const SHARING_ELEMENT_DEFINITIONS: readonly Readonly<{
  id: string;
  kind: SharingIndicatorKind;
}>[] = Object.freeze([
  Object.freeze({ id: "geo-sharing-icon", kind: "location" }),
  Object.freeze({ id: "webrtc-sharing-icon", kind: "media" }),
  Object.freeze({ id: "serial-sharing-icon", kind: "serial" }),
  Object.freeze({ id: "xr-sharing-icon", kind: "xr" }),
]);

const STATIC_ITEM_DEFINITIONS: readonly Readonly<{
  id: string;
  kind: UrlbarItemKind;
}>[] = Object.freeze([
  Object.freeze({
    id: "contextual-feature-recommendation",
    kind: "recommendation",
  }),
  Object.freeze({ id: "userContext-icons", kind: "container" }),
  Object.freeze({ id: "reader-mode-button", kind: "reader-view" }),
  Object.freeze({
    id: "picture-in-picture-button",
    kind: "picture-in-picture",
  }),
  Object.freeze({ id: "taskbar-tabs-button", kind: "taskbar-tabs" }),
  Object.freeze({ id: "translations-button", kind: "translations" }),
  Object.freeze({ id: "urlbar-zoom-button", kind: "zoom" }),
  Object.freeze({ id: "split-view-button", kind: "split-view" }),
  Object.freeze({ id: "star-button-box", kind: "bookmark" }),
]);

const KNOWN_PAGE_ACTION_ELEMENT_IDS = new Set([
  "contextual-feature-recommendation",
  "pageActionButton",
  "picture-in-picture-button",
  "reader-mode-button",
  "split-view-button",
  "star-button-box",
  "taskbar-tabs-button",
  "translations-button",
  "urlbar-zoom-button",
  "userContext-icons",
]);

const isNativeRecord = (value: unknown): value is NativeRecord =>
  typeof value === "object" && value !== null;

const isFunction = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === "function";

const isNativeElement = (value: unknown): value is NativeElement =>
  isNativeRecord(value) &&
  isFunction(value.getAttribute) &&
  isFunction(value.hasAttribute);

const isNativeDocument = (value: unknown): value is NativeDocument =>
  isNativeRecord(value) && isFunction(value.getElementById);

const readDocument = (window: NativeRecord): NativeDocument | null =>
  isNativeDocument(window.document) ? window.document : null;

const readElement = (window: NativeRecord, id: string): unknown => {
  const document = readDocument(window);
  return document
    ? Reflect.apply(document.getElementById, document, [id])
    : undefined;
};

const readDocumentElement = (window: NativeRecord): unknown => {
  const document = readDocument(window);
  return document?.documentElement;
};

const urlbarCoverageCapabilitySpecifications: readonly UrlbarCoverageCapabilitySpecification[] =
  Object.freeze([
    Object.freeze({
      isAvailable: isFunction,
      name: "firefox.urlbar-coverage-native-access",
      read: (window: NativeRecord) => window.openLocation,
      symbol: "window.openLocation",
    }),
    Object.freeze({
      isAvailable: isFunction,
      name: "firefox.urlbar-coverage-mutation-observer",
      read: (window: NativeRecord) => window.MutationObserver,
      symbol: "window.MutationObserver",
    }),
    Object.freeze({
      isAvailable: isNativeElement,
      name: "firefox.urlbar-coverage-urlbar-state",
      read: (window: NativeRecord) => window.gURLBar,
      symbol: "window.gURLBar.hasAttribute",
    }),
    Object.freeze({
      isAvailable: isNativeElement,
      name: "firefox.urlbar-coverage-window-state",
      read: readDocumentElement,
      symbol: "document.documentElement.hasAttribute",
    }),
    ...REQUIRED_ELEMENT_IDS.map((id) =>
      Object.freeze({
        isAvailable: isNativeElement,
        name: `firefox.urlbar-coverage-${id}`,
        read: (window: NativeRecord) => readElement(window, id),
        symbol: `document.elements[${id}]`,
      }),
    ),
  ]);

const evaluateUrlbarCoverageCapabilities = (
  window: NativeRecord,
): readonly UrlbarCoverageCapabilityEvaluation[] =>
  Object.freeze(
    urlbarCoverageCapabilitySpecifications.map((specification) => {
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

const createUrlbarCoverageError = (
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

const readAttribute = (element: NativeElement, name: string): string | null => {
  const value = Reflect.apply(element.getAttribute, element, [name]);
  return typeof value === "string" ? value : null;
};

const hasAttribute = (element: NativeElement, name: string): boolean =>
  Boolean(Reflect.apply(element.hasAttribute, element, [name]));

const isOwnerVisible = (element: NativeElement): boolean => {
  if (element.hidden === true) {
    return false;
  }
  const hidden = readAttribute(element, "hidden");
  if (hidden !== null && hidden !== "false") {
    return false;
  }
  return readAttribute(element, "collapsed") !== "true";
};

const readChildren = (element: NativeElement): readonly unknown[] => {
  const children = element.children;
  if (!children || (typeof children !== "object" && !Array.isArray(children))) {
    return Object.freeze([]);
  }
  return Object.freeze(Array.from(children as ArrayLike<unknown>));
};

const classListContains = (element: NativeElement, name: string): boolean => {
  const classList = element.classList;
  return (
    isNativeRecord(classList) &&
    isFunction(classList.contains) &&
    Boolean(Reflect.apply(classList.contains, classList, [name]))
  );
};

const snapshotsEqual = (
  left: UrlbarCoverageSnapshot,
  right: UrlbarCoverageSnapshot,
): boolean =>
  left.permissions.available === right.permissions.available &&
  left.permissions.hasPermissions === right.permissions.hasPermissions &&
  left.permissions.blocked.length === right.permissions.blocked.length &&
  left.permissions.blocked.every(
    (kind, index) => kind === right.permissions.blocked[index],
  ) &&
  left.permissions.sharing.length === right.permissions.sharing.length &&
  left.permissions.sharing.every(
    (kind, index) => kind === right.permissions.sharing[index],
  ) &&
  left.items.length === right.items.length &&
  left.items.every((kind, index) => kind === right.items[index]);

export type FirefoxUrlbarCoverageBridgeController = Readonly<{
  assertRequiredCapabilities: () => readonly FirefoxCapabilitySnapshot[];
  dispose: () => boolean;
  snapshot: () => Readonly<{
    disposed: boolean;
    failed: boolean;
    revision: number;
    subscriberCount: number;
  }>;
  urlbarCoverage: BrowserUrlbarCoverageBridge;
}>;

export function createFirefoxUrlbarCoverageBridge({
  boundary,
  onError,
  window,
}: Readonly<{
  boundary: FirefoxBridgeBoundary;
  onError: (error: unknown) => void;
  window: unknown;
}>): FirefoxUrlbarCoverageBridgeController {
  boundary.assertOwnsWindow(window);
  if (!isNativeRecord(window) || typeof onError !== "function") {
    throw createUrlbarCoverageError(
      boundary,
      "FENNEVIA_FIREFOX_URLBAR_COVERAGE_OPTIONS_INVALID",
      "firefox-urlbar-coverage-create",
      "window",
    );
  }

  let nativeWindow: NativeRecord | null = window;
  let disposed = false;
  let failedError: FirefoxBridgeError | null = null;
  let revision = 0;
  let observer: NativeMutationObserver | null = null;
  let currentSnapshot: UrlbarCoverageSnapshot = Object.freeze({
    items: Object.freeze([]),
    permissions: Object.freeze({
      available: false,
      blocked: Object.freeze([]),
      hasPermissions: false,
      sharing: Object.freeze([]),
    }),
  });
  const subscribers = new Set<(event: UrlbarCoverageStateEvent) => void>();

  const requireWindow = (): NativeRecord => {
    if (disposed || !nativeWindow) {
      throw createUrlbarCoverageError(
        boundary,
        "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSED",
        "firefox-urlbar-coverage-access",
        "window.gURLBar",
      );
    }
    if (failedError) {
      throw failedError;
    }
    boundary.assertOwnsWindow(nativeWindow);
    return nativeWindow;
  };

  const requireElement = (id: string): NativeElement => {
    const element = readElement(requireWindow(), id);
    if (!isNativeElement(element)) {
      throw createUrlbarCoverageError(
        boundary,
        "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING",
        "firefox-urlbar-coverage-snapshot",
        `document.elements[${id}]`,
      );
    }
    return element;
  };

  const requireUrlbar = (): NativeElement => {
    const urlbar = requireWindow().gURLBar;
    if (!isNativeElement(urlbar)) {
      throw createUrlbarCoverageError(
        boundary,
        "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING",
        "firefox-urlbar-coverage-snapshot",
        "window.gURLBar.hasAttribute",
      );
    }
    return urlbar;
  };

  const requireDocumentElement = (): NativeElement => {
    const root = readDocumentElement(requireWindow());
    if (!isNativeElement(root)) {
      throw createUrlbarCoverageError(
        boundary,
        "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING",
        "firefox-urlbar-coverage-snapshot",
        "document.documentElement.hasAttribute",
      );
    }
    return root;
  };

  const assertRequiredCapabilities = () => {
    const evaluations = evaluateUrlbarCoverageCapabilities(requireWindow());
    const missing = evaluations.find(
      (evaluation) => !evaluation.snapshot.available,
    );
    if (missing) {
      throw createUrlbarCoverageError(
        boundary,
        "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING",
        "firefox-urlbar-coverage-capability",
        missing.snapshot.symbol,
        missing.cause,
      );
    }
    return Object.freeze(evaluations.map((evaluation) => evaluation.snapshot));
  };

  const readPermissionIndicators = () => {
    const urlbar = requireUrlbar();
    const permissionBox = requireElement("identity-permission-box");
    const sharing = Object.freeze(
      SHARING_ELEMENT_DEFINITIONS.flatMap(({ id, kind }) => {
        const element = readElement(requireWindow(), id);
        return isNativeElement(element) && hasAttribute(element, "sharing")
          ? [kind]
          : [];
      }),
    );
    const available =
      readAttribute(urlbar, "pageproxystate") === "valid" ||
      hasAttribute(urlbar, "persistsearchterms") ||
      sharing.length > 0;
    if (!available) {
      return Object.freeze({
        available: false,
        blocked: Object.freeze([]),
        hasPermissions: false,
        sharing: Object.freeze([]),
      });
    }

    const blocked = Object.freeze(
      readChildren(requireElement("blocked-permissions-container")).flatMap(
        (candidate) => {
          if (
            !isNativeElement(candidate) ||
            !hasAttribute(candidate, "showing")
          ) {
            return [];
          }
          const id = readAttribute(candidate, "data-permission-id");
          const kind = id ? BLOCKED_PERMISSION_KIND_BY_ID[id] : undefined;
          return kind ? [kind] : [];
        },
      ),
    );

    return Object.freeze({
      available: true,
      blocked,
      hasPermissions: hasAttribute(permissionBox, "hasPermissions"),
      sharing,
    });
  };

  const readItems = (): readonly UrlbarItemKind[] => {
    const window = requireWindow();
    const urlbar = requireUrlbar();
    const kinds = new Set<UrlbarItemKind>();
    if (hasAttribute(requireDocumentElement(), "remotecontrol")) {
      kinds.add("remote-control");
    }
    if (hasAttribute(urlbar, "searchmode")) {
      kinds.add("search-mode");
    }
    if (hasAttribute(urlbar, "persistsearchterms")) {
      kinds.add("persisted-search");
    }
    for (const { id, kind } of STATIC_ITEM_DEFINITIONS) {
      const element = readElement(window, id);
      if (isNativeElement(element) && isOwnerVisible(element)) {
        kinds.add(kind);
      }
    }

    const mainPageAction = readElement(window, "pageActionButton");
    if (
      isNativeElement(mainPageAction) &&
      hasAttribute(mainPageAction, "multiple-children")
    ) {
      kinds.add("more-page-actions");
    }

    for (const candidate of readChildren(
      requireElement("page-action-buttons"),
    )) {
      if (
        !isNativeElement(candidate) ||
        !isOwnerVisible(candidate) ||
        !classListContains(candidate, "urlbar-page-action")
      ) {
        continue;
      }
      const id = typeof candidate.id === "string" ? candidate.id : "";
      if (KNOWN_PAGE_ACTION_ELEMENT_IDS.has(id)) {
        continue;
      }
      if (classListContains(candidate, "urlbar-addon-page-action")) {
        kinds.add("extension-actions");
      } else if (hasAttribute(candidate, "actionid")) {
        kinds.add("other-page-actions");
      }
    }

    return Object.freeze(urlbarItemKinds.filter((kind) => kinds.has(kind)));
  };

  const readSnapshot = (): UrlbarCoverageSnapshot =>
    Object.freeze({
      items: readItems(),
      permissions: readPermissionIndicators(),
    });

  const notifySubscribers = (): void => {
    const event: UrlbarCoverageStateEvent = Object.freeze({
      revision,
      snapshot: currentSnapshot,
      type: "snapshot",
    });
    for (const listener of Array.from(subscribers)) {
      try {
        listener(event);
      } catch (error) {
        onError(
          createUrlbarCoverageError(
            boundary,
            "FENNEVIA_FIREFOX_URLBAR_COVERAGE_SUBSCRIBER_FAILED",
            "firefox-urlbar-coverage-notify",
            "urlbarCoverage.subscribe",
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

  const reportNativeEventFailure = (error: unknown): void => {
    failedError = isFirefoxBridgeError(error)
      ? error
      : createUrlbarCoverageError(
          boundary,
          "FENNEVIA_FIREFOX_URLBAR_COVERAGE_EVENT_FAILED",
          "firefox-urlbar-coverage-event",
          "window.MutationObserver",
          error,
        );
    onError(failedError);
  };

  const publicBridge: BrowserUrlbarCoverageBridge = Object.freeze({
    openNativeUrlbar(): boolean {
      const currentWindow = requireWindow();
      const openLocation = currentWindow.openLocation;
      if (!isFunction(openLocation)) {
        throw createUrlbarCoverageError(
          boundary,
          "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING",
          "firefox-urlbar-native-access",
          "window.openLocation",
        );
      }
      try {
        Reflect.apply(openLocation, currentWindow, []);
        return true;
      } catch (error) {
        throw createUrlbarCoverageError(
          boundary,
          "FENNEVIA_FIREFOX_URLBAR_NATIVE_ACCESS_FAILED",
          "firefox-urlbar-native-access",
          "window.openLocation",
          error,
        );
      }
    },

    snapshot(): UrlbarCoverageSnapshot {
      requireWindow();
      return currentSnapshot;
    },

    subscribe(listener): () => boolean {
      requireWindow();
      if (typeof listener !== "function") {
        throw createUrlbarCoverageError(
          boundary,
          "FENNEVIA_FIREFOX_URLBAR_COVERAGE_LISTENER_INVALID",
          "firefox-urlbar-coverage-subscribe",
          "urlbarCoverage.subscribe",
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

    const Observer = requireWindow()
      .MutationObserver as NativeMutationObserverConstructor;
    observer = new Observer(() => {
      if (disposed || failedError) {
        return;
      }
      try {
        reconcile(true);
      } catch (error) {
        reportNativeEventFailure(error);
      }
    });
    observer.observe(requireDocumentElement(), {
      attributeFilter: ["remotecontrol"],
      attributes: true,
    });
    observer.observe(requireUrlbar(), {
      attributeFilter: ["pageproxystate", "persistsearchterms", "searchmode"],
      attributes: true,
    });
    observer.observe(requireElement("identity-permission-box"), {
      attributeFilter: [
        "collapsed",
        "hasPermissions",
        "hasSharingIcon",
        "hidden",
        "paused",
        "sharing",
        "showing",
      ],
      attributes: true,
      subtree: true,
    });
    observer.observe(requireElement("page-action-buttons"), {
      attributeFilter: [
        "actionid",
        "class",
        "collapsed",
        "disabled",
        "hidden",
        "multiple-children",
      ],
      attributes: true,
      childList: true,
      subtree: true,
    });
  } catch (error) {
    disposed = true;
    try {
      observer?.disconnect();
    } catch (cleanupError) {
      onError(
        createUrlbarCoverageError(
          boundary,
          "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSE_FAILED",
          "firefox-urlbar-coverage-dispose",
          "window.MutationObserver.disconnect",
          cleanupError,
        ),
      );
    }
    observer = null;
    nativeWindow = null;
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
        observer?.disconnect();
      } catch (error) {
        firstError = error;
      }
      observer = null;
      subscribers.clear();
      nativeWindow = null;
      if (firstError !== undefined) {
        throw createUrlbarCoverageError(
          boundary,
          "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSE_FAILED",
          "firefox-urlbar-coverage-dispose",
          "window.MutationObserver.disconnect",
          firstError,
        );
      }
      return true;
    },

    snapshot() {
      return Object.freeze({
        disposed,
        failed: failedError !== null,
        revision,
        subscriberCount: subscribers.size,
      });
    },

    urlbarCoverage: publicBridge,
  });
}
