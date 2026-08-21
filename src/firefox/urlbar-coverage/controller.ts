// SPDX-License-Identifier: MPL-2.0
import type {
  BrowserUrlbarCoverageBridge,
  UrlbarCoverageSnapshot,
  UrlbarCoverageStateEvent,
  UrlbarItemKind,
} from "../../app/urlbar-coverage-state.ts";
import { urlbarItemKinds } from "../../app/urlbar-coverage-state.ts";
import {
  FirefoxBridgeError,
  createIdempotentDisposer,
  isFirefoxBridgeError,
  type FirefoxBridgeBoundary,
  type FirefoxCapabilitySnapshot,
} from "../bridge-boundary.ts";
import {
  BLOCKED_PERMISSION_KIND_BY_ID,
  SHARING_ELEMENT_DEFINITIONS,
  STATIC_ITEM_DEFINITIONS,
  KNOWN_PAGE_ACTION_ELEMENT_IDS,
  isNativeRecord,
  isFunction,
  isNativeElement,
  readElement,
  readDocumentElement,
  evaluateUrlbarCoverageCapabilities,
  createUrlbarCoverageError,
  readAttribute,
  hasAttribute,
  isOwnerVisible,
  readChildren,
  classListContains,
  snapshotsEqual,
} from "./support.ts";
import type {
  NativeRecord,
  NativeElement,
  NativeMutationObserver,
  NativeMutationObserverConstructor,
} from "./support.ts";

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
  requestNativeUiReveal,
  window,
}: Readonly<{
  boundary: FirefoxBridgeBoundary;
  onError: (error: unknown) => void;
  requestNativeUiReveal: () => boolean;
  window: unknown;
}>): FirefoxUrlbarCoverageBridgeController {
  boundary.assertOwnsWindow(window);
  if (
    !isNativeRecord(window) ||
    typeof onError !== "function" ||
    typeof requestNativeUiReveal !== "function"
  ) {
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
    const evaluations = evaluateUrlbarCoverageCapabilities(
      requireWindow(),
      requestNativeUiReveal,
    );
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
        if (requestNativeUiReveal() !== true) {
          throw createUrlbarCoverageError(
            boundary,
            "FENNEVIA_FIREFOX_URLBAR_NATIVE_UI_HANDOFF_REJECTED",
            "firefox-urlbar-native-access",
            "nativeUi.revealForUrlbar",
          );
        }
        Reflect.apply(openLocation, currentWindow, []);
        return true;
      } catch (error) {
        if (isFirefoxBridgeError(error)) {
          throw error;
        }
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
