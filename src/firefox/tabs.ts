import type {
  BrowserTabsBridge,
  OpenTabOptions,
  TabAudioState,
  TabContainerColor,
  TabContainerSnapshot,
  TabContextMenuPoint,
  TabSnapshot,
  TabStateEvent,
} from "../app/tab-state.ts";
import {
  isTabContainerColor,
  maximumContainerLabelLength,
  maximumTabTitleLength,
} from "../app/tab-state.ts";
import {
  FirefoxBridgeError,
  createIdempotentDisposer,
  isFirefoxBridgeError,
  type FirefoxBridgeBoundary,
  type FirefoxBridgeErrorContext,
  type FirefoxCapabilitySnapshot,
  type IdempotentDisposer,
} from "./bridge-boundary.ts";

const TAB_EVENT_TYPES = Object.freeze([
  "TabOpen",
  "TabClose",
  "TabSelect",
  "TabMove",
  "TabPinned",
  "TabUnpinned",
  "TabAttrModified",
]);
const SNAPSHOT_ATTRIBUTES = new Set([
  "activemedia-blocked",
  "attention",
  "busy",
  "image",
  "label",
  "muted",
  "pictureinpicture",
  "selected",
  "soundplaying",
  "usercontextid",
]);
const MAX_FAVICON_URL_LENGTH = 262_144;
const MAXIMUM_SCREEN_COORDINATE = 100_000;
const CONTEXTUAL_IDENTITY_URI =
  "resource://gre/modules/ContextualIdentityService.sys.mjs";
const FORBIDDEN_INTERNAL_FAVICON_CHARACTER_PATTERN = /[\s"'<>\\]/u;
const RASTER_DATA_FAVICON_PATTERN =
  /^data:image\/(?:avif|gif|jpeg|png|vnd\.microsoft\.icon|webp|x-icon);base64,[a-z0-9+/]+={0,2}$/iu;
const CONTAINER_COLOR_ALIASES: Readonly<Record<string, TabContainerColor>> =
  Object.freeze({
    toolbar: "gray",
    turquoise: "cyan",
  });

type NativeRecord = Record<string, unknown>;
type NativeModuleLoader = (uri: string) => unknown;
type NativeTab = NativeRecord & {
  getAttribute: (name: string) => unknown;
  hasAttribute: (name: string) => boolean;
};
type NativeIdentityService = NativeRecord & {
  getPublicIdentityFromId: (userContextId: number) => unknown;
  getUserContextLabel?: (userContextId: number) => unknown;
};

type TabsCapabilityEvaluation = Readonly<{
  cause?: unknown;
  snapshot: FirefoxCapabilitySnapshot;
}>;

type TabsCapabilitySpecification = Readonly<{
  isAvailable: (value: unknown) => boolean;
  name: string;
  read: (window: NativeRecord) => unknown;
  symbol: string;
}>;

const isNativeObject = (value: unknown): value is object =>
  (typeof value === "object" && value !== null) || typeof value === "function";

const isNativeRecord = (value: unknown): value is NativeRecord =>
  typeof value === "object" && value !== null;

const isFunction = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === "function";

const readGBrowser = (window: NativeRecord): unknown => window.gBrowser;

const readGBrowserMember = (window: NativeRecord, member: string): unknown => {
  const browser = readGBrowser(window);
  return isNativeRecord(browser) ? browser[member] : undefined;
};

const getDocumentElementById = (window: NativeRecord, id: string): unknown => {
  const document = window.document;
  if (!isNativeRecord(document) || !isFunction(document.getElementById)) {
    return undefined;
  }
  return Reflect.apply(document.getElementById, document, [id]);
};

const isNativeTabContextMenu = (value: unknown): value is NativeRecord =>
  isNativeRecord(value) &&
  isFunction(value.openPopup) &&
  isFunction(value.moveTo) &&
  isFunction(value.addEventListener) &&
  isFunction(value.removeEventListener);

const tabsCapabilitySpecifications: readonly TabsCapabilitySpecification[] =
  Object.freeze([
    Object.freeze({
      isAvailable: Array.isArray,
      name: "firefox.open-tabs",
      read: (window: NativeRecord) => readGBrowserMember(window, "openTabs"),
      symbol: "window.gBrowser.openTabs",
    }),
    Object.freeze({
      isAvailable: isNativeObject,
      name: "firefox.selected-tab",
      read: (window: NativeRecord) => readGBrowserMember(window, "selectedTab"),
      symbol: "window.gBrowser.selectedTab",
    }),
    ...[
      ["add-tab", "addTrustedTab"],
      ["remove-tab", "removeTab"],
      ["pin-tab", "pinTab"],
      ["unpin-tab", "unpinTab"],
      ["move-tab", "moveTabTo"],
    ].map(([name, member]) =>
      Object.freeze({
        isAvailable: isFunction,
        name: `firefox.${name}`,
        read: (window: NativeRecord) => readGBrowserMember(window, member),
        symbol: `window.gBrowser.${member}`,
      }),
    ),
    Object.freeze({
      isAvailable: (value: unknown) =>
        typeof value === "string" && value.length > 0 && value.length <= 2048,
      name: "firefox.new-tab-url",
      read: (window: NativeRecord) => window.BROWSER_NEW_TAB_URL,
      symbol: "window.BROWSER_NEW_TAB_URL",
    }),
    Object.freeze({
      isAvailable: isNativeTabContextMenu,
      name: "firefox.tab-context-menu",
      read: (window: NativeRecord) =>
        getDocumentElementById(window, "tabContextMenu"),
      symbol: "document.tabContextMenu.openPopup.moveTo",
    }),
  ]);

const evaluateTabsCapabilities = (
  window: NativeRecord,
): readonly TabsCapabilityEvaluation[] =>
  Object.freeze(
    tabsCapabilitySpecifications.map((specification) => {
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

const createTabsError = (
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

const asNativeTab = (
  boundary: FirefoxBridgeBoundary,
  candidate: unknown,
): NativeTab => {
  if (
    !isNativeRecord(candidate) ||
    typeof candidate.getAttribute !== "function" ||
    typeof candidate.hasAttribute !== "function"
  ) {
    throw createTabsError(
      boundary,
      "FENNEVIA_FIREFOX_TAB_SHAPE_INVALID",
      "firefox-tabs-snapshot",
      "MozTabbrowserTab.getAttribute",
    );
  }
  return candidate as NativeTab;
};

const sanitizeFaviconUrl = (candidate: unknown): string | undefined => {
  if (typeof candidate !== "string" || candidate.length === 0) {
    return undefined;
  }
  if (
    candidate.length <= 2048 &&
    (candidate.startsWith("chrome://") ||
      candidate.startsWith("resource://") ||
      candidate.startsWith("moz-remote-image:")) &&
    !FORBIDDEN_INTERNAL_FAVICON_CHARACTER_PATTERN.test(candidate)
  ) {
    return candidate;
  }
  if (
    candidate.length <= MAX_FAVICON_URL_LENGTH &&
    RASTER_DATA_FAVICON_PATTERN.test(candidate)
  ) {
    return candidate;
  }
  return undefined;
};

const snapshotsEqual = (
  left: readonly TabSnapshot[],
  right: readonly TabSnapshot[],
): boolean =>
  left.length === right.length &&
  left.every((tab, index) => {
    const candidate = right[index];
    return (
      candidate !== undefined &&
      tab.id === candidate.id &&
      tab.title === candidate.title &&
      tab.selected === candidate.selected &&
      tab.pinned === candidate.pinned &&
      tab.loading === candidate.loading &&
      tab.faviconUrl === candidate.faviconUrl &&
      tab.audio === candidate.audio &&
      tab.attention === candidate.attention &&
      tab.pictureInPicture === candidate.pictureInPicture &&
      tab.container?.color === candidate.container?.color &&
      tab.container?.label === candidate.container?.label
    );
  });

const isRelevantAttributeEvent = (event: unknown): boolean => {
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
  return changed.some((attribute) => SNAPSHOT_ATTRIBUTES.has(attribute));
};

const resolveContainerColor = (
  value: unknown,
): TabContainerColor | undefined => {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }
  const resolved = CONTAINER_COLOR_ALIASES[value] ?? value;
  return isTabContainerColor(resolved) ? resolved : undefined;
};

const isTabContextMenuEvent = (event: unknown, menu: NativeRecord): boolean => {
  if (!isNativeRecord(event)) {
    return true;
  }
  if (event.target === undefined) {
    return true;
  }
  return (
    event.target === menu ||
    (isNativeRecord(event.target) && event.target.id === "tabContextMenu")
  );
};

export type FirefoxTabsBridgeController = Readonly<{
  assertRequiredCapabilities: () => readonly FirefoxCapabilitySnapshot[];
  dispose: () => boolean;
  snapshot: () => Readonly<{
    disposed: boolean;
    failed: boolean;
    revision: number;
    subscriberCount: number;
    tabCount: number;
  }>;
  tabs: BrowserTabsBridge;
}>;

export function createFirefoxTabsBridge({
  boundary,
  moduleLoader,
  onError,
  window,
}: Readonly<{
  boundary: FirefoxBridgeBoundary;
  moduleLoader?: NativeModuleLoader;
  onError: (error: unknown) => void;
  window: unknown;
}>): FirefoxTabsBridgeController {
  boundary.assertOwnsWindow(window);
  if (!isNativeRecord(window) || typeof onError !== "function") {
    throw createTabsError(
      boundary,
      "FENNEVIA_FIREFOX_TABS_OPTIONS_INVALID",
      "firefox-tabs-create",
      "window",
    );
  }

  let nativeWindow: NativeRecord | null = window;
  let disposed = false;
  let failedError: FirefoxBridgeError | null = null;
  let revision = 0;
  let currentTabs: readonly TabSnapshot[] = Object.freeze([]);
  const activeTabIds = new Set<string>();
  const subscribers = new Set<(event: TabStateEvent) => void>();
  const listenerDisposers: IdempotentDisposer[] = [];
  const registry = boundary.createHandleRegistry<NativeTab>("tab");
  let identityService: NativeIdentityService | null = null;
  let tabContextMenu: NativeRecord | null = null;

  if (typeof moduleLoader === "function") {
    try {
      const loaded = moduleLoader(CONTEXTUAL_IDENTITY_URI);
      const candidate = isNativeRecord(loaded)
        ? loaded.ContextualIdentityService
        : undefined;
      if (
        isNativeRecord(candidate) &&
        isFunction(candidate.getPublicIdentityFromId)
      ) {
        identityService = candidate as NativeIdentityService;
      }
    } catch {
      identityService = null;
    }
  }

  const requireWindow = (): NativeRecord => {
    if (disposed || !nativeWindow) {
      throw createTabsError(
        boundary,
        "FENNEVIA_FIREFOX_TABS_DISPOSED",
        "firefox-tabs-access",
        "window.gBrowser.openTabs",
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
      throw createTabsError(
        boundary,
        "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING",
        "firefox-tabs-capability",
        "window.gBrowser",
      );
    }
    return browser;
  };

  const assertRequiredCapabilities = () => {
    const evaluations = evaluateTabsCapabilities(requireWindow());
    const missing = evaluations.find(
      (evaluation) => !evaluation.snapshot.available,
    );
    if (missing) {
      throw createTabsError(
        boundary,
        "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING",
        "firefox-tabs-capability",
        missing.snapshot.symbol,
        missing.cause,
      );
    }
    return Object.freeze(evaluations.map((evaluation) => evaluation.snapshot));
  };

  const readOpenTabs = (): readonly NativeTab[] => {
    const candidate = requireGBrowser().openTabs;
    if (!Array.isArray(candidate)) {
      throw createTabsError(
        boundary,
        "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING",
        "firefox-tabs-snapshot",
        "window.gBrowser.openTabs",
      );
    }
    const tabs = candidate.map((tab) => asNativeTab(boundary, tab));
    if (new Set(tabs).size !== tabs.length) {
      throw createTabsError(
        boundary,
        "FENNEVIA_FIREFOX_TAB_ORDER_INVALID",
        "firefox-tabs-snapshot",
        "window.gBrowser.openTabs",
      );
    }
    return tabs;
  };

  const readAttribute = (tab: NativeTab, name: string): unknown =>
    Reflect.apply(tab.getAttribute, tab, [name]);

  const hasAttribute = (tab: NativeTab, name: string): boolean =>
    Boolean(Reflect.apply(tab.hasAttribute, tab, [name]));

  const readAudio = (tab: NativeTab): TabAudioState | undefined => {
    if (hasAttribute(tab, "activemedia-blocked")) {
      return "blocked";
    }
    if (hasAttribute(tab, "muted")) {
      return "muted";
    }
    if (hasAttribute(tab, "soundplaying")) {
      return "playing";
    }
    return undefined;
  };

  const readContainer = (tab: NativeTab): TabContainerSnapshot | undefined => {
    if (!identityService) {
      return undefined;
    }
    const parsed = Number.parseInt(
      String(readAttribute(tab, "usercontextid") ?? ""),
      10,
    );
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      return undefined;
    }
    let identity: unknown;
    try {
      identity = Reflect.apply(
        identityService.getPublicIdentityFromId,
        identityService,
        [parsed],
      );
    } catch {
      return undefined;
    }
    if (!isNativeRecord(identity)) {
      return undefined;
    }
    const color = resolveContainerColor(identity.color);
    if (!color) {
      return undefined;
    }
    let label = "";
    if (typeof identity.name === "string") {
      label = identity.name;
    }
    if (
      label.trim().length === 0 &&
      isFunction(identityService.getUserContextLabel)
    ) {
      try {
        const candidate = Reflect.apply(
          identityService.getUserContextLabel,
          identityService,
          [parsed],
        );
        if (typeof candidate === "string") {
          label = candidate;
        }
      } catch {
        label = "";
      }
    }
    const trimmed = label.trim();
    return Object.freeze({
      color,
      label: (trimmed.length === 0 ? "Container" : trimmed).slice(
        0,
        maximumContainerLabelLength,
      ),
    });
  };

  const createSnapshot = (
    tab: NativeTab,
    selectedTab: unknown,
  ): TabSnapshot => {
    const title = String(readAttribute(tab, "label") ?? "").slice(
      0,
      maximumTabTitleLength,
    );
    const faviconUrl = sanitizeFaviconUrl(readAttribute(tab, "image"));
    const audio = readAudio(tab);
    const container = readContainer(tab);
    return Object.freeze({
      ...(hasAttribute(tab, "attention") ? { attention: true } : {}),
      ...(audio === undefined ? {} : { audio }),
      ...(container === undefined ? {} : { container }),
      ...(faviconUrl === undefined ? {} : { faviconUrl }),
      ...(hasAttribute(tab, "pictureinpicture")
        ? { pictureInPicture: true }
        : {}),
      id: registry.register(tab),
      loading: hasAttribute(tab, "busy"),
      pinned: hasAttribute(tab, "pinned"),
      selected: selectedTab === tab,
      title,
    });
  };

  const publish = (event: TabStateEvent): void => {
    for (const listener of Array.from(subscribers)) {
      try {
        listener(event);
      } catch (error) {
        onError(
          createTabsError(
            boundary,
            "FENNEVIA_FIREFOX_TABS_SUBSCRIBER_FAILED",
            "firefox-tabs-notify",
            "tabs.subscribe",
            error,
          ),
        );
      }
    }
  };

  const notifySubscribers = (): void => {
    publish(
      Object.freeze({
        revision,
        tabs: currentTabs,
        type: "snapshot",
      }),
    );
  };

  const reconcile = (notify: boolean): boolean => {
    const browser = requireGBrowser();
    const nativeTabs = readOpenTabs();
    const nextTabs = nativeTabs.map((tab) =>
      createSnapshot(tab, browser.selectedTab),
    );
    const nextIds = new Set(nextTabs.map((tab) => tab.id));
    for (const id of Array.from(activeTabIds)) {
      if (!nextIds.has(id)) {
        registry.release(id);
        activeTabIds.delete(id);
      }
    }
    for (const id of nextIds) {
      activeTabIds.add(id);
    }

    const frozenTabs = Object.freeze(nextTabs);
    if (snapshotsEqual(currentTabs, frozenTabs)) {
      return false;
    }
    currentTabs = frozenTabs;
    revision += 1;
    if (notify) {
      notifySubscribers();
    }
    return true;
  };

  const reportNativeEventFailure = (
    error: unknown,
    eventType: string,
  ): void => {
    failedError = isFirefoxBridgeError(error)
      ? error
      : createTabsError(
          boundary,
          "FENNEVIA_FIREFOX_TABS_EVENT_FAILED",
          "firefox-tabs-event",
          `window.gBrowser.tabContainer.${eventType}`,
          error,
        );
    onError(failedError);
  };

  const requireOwnedTab = (tabId: string): NativeTab => {
    requireWindow();
    const tab = registry.resolve(tabId);
    if (!readOpenTabs().includes(tab)) {
      registry.release(tabId);
      activeTabIds.delete(tabId);
      throw createTabsError(
        boundary,
        "FENNEVIA_FIREFOX_TAB_STALE",
        "firefox-tabs-action",
        "tab.opaque-id",
      );
    }
    return tab;
  };

  const callTabMethod = (
    methodName: string,
    args: readonly unknown[],
  ): unknown => {
    const browser = requireGBrowser();
    const method = browser[methodName];
    if (typeof method !== "function") {
      throw createTabsError(
        boundary,
        "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING",
        "firefox-tabs-action",
        `window.gBrowser.${methodName}`,
      );
    }
    return Reflect.apply(method, browser, args);
  };

  const normalizeOpenOptions = (
    options: OpenTabOptions | undefined,
  ): Required<OpenTabOptions> => {
    if (options === undefined) {
      return Object.freeze({ selected: true });
    }
    if (
      !isNativeRecord(options) ||
      Object.keys(options).some((key) => key !== "selected") ||
      (options.selected !== undefined && typeof options.selected !== "boolean")
    ) {
      throw createTabsError(
        boundary,
        "FENNEVIA_FIREFOX_TAB_OPEN_OPTIONS_INVALID",
        "firefox-tabs-action",
        "tabs.open.options",
      );
    }
    return Object.freeze({ selected: options.selected ?? true });
  };

  const normalizeContextMenuPoint = (
    point: TabContextMenuPoint,
  ): TabContextMenuPoint => {
    if (
      !isNativeRecord(point) ||
      Object.keys(point).some(
        (key) => key !== "screenX" && key !== "screenY",
      ) ||
      typeof point.screenX !== "number" ||
      typeof point.screenY !== "number" ||
      !Number.isFinite(point.screenX) ||
      !Number.isFinite(point.screenY) ||
      Math.abs(point.screenX) > MAXIMUM_SCREEN_COORDINATE ||
      Math.abs(point.screenY) > MAXIMUM_SCREEN_COORDINATE
    ) {
      throw createTabsError(
        boundary,
        "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_POINT_INVALID",
        "firefox-tabs-action",
        "tabs.openContextMenu.point",
      );
    }
    return Object.freeze({
      screenX: point.screenX,
      screenY: point.screenY,
    });
  };

  const requireTabContextMenu = (): NativeRecord => {
    requireWindow();
    if (!tabContextMenu || !isNativeTabContextMenu(tabContextMenu)) {
      throw createTabsError(
        boundary,
        "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING",
        "firefox-tabs-action",
        "document.tabContextMenu.openPopup.moveTo",
      );
    }
    return tabContextMenu;
  };

  const publicBridge: BrowserTabsBridge = Object.freeze({
    close(tabId: string): void {
      const tab = requireOwnedTab(tabId);
      callTabMethod("removeTab", [
        tab,
        { animate: true, isUserTriggered: true },
      ]);
      reconcile(true);
    },

    move(tabId: string, index: number): void {
      const tab = requireOwnedTab(tabId);
      if (!Number.isSafeInteger(index) || index < 0 || index > 10_000) {
        throw createTabsError(
          boundary,
          "FENNEVIA_FIREFOX_TAB_MOVE_INDEX_INVALID",
          "firefox-tabs-action",
          "tabs.move.index",
        );
      }
      callTabMethod("moveTabTo", [
        tab,
        { isUserTriggered: true, tabIndex: index },
      ]);
      reconcile(true);
    },

    open(options?: OpenTabOptions): string {
      const normalized = normalizeOpenOptions(options);
      const newTabUrl = requireWindow().BROWSER_NEW_TAB_URL;
      if (typeof newTabUrl !== "string" || newTabUrl.length === 0) {
        throw createTabsError(
          boundary,
          "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING",
          "firefox-tabs-action",
          "window.BROWSER_NEW_TAB_URL",
        );
      }
      const candidate = callTabMethod("addTrustedTab", [
        newTabUrl,
        { inBackground: !normalized.selected },
      ]);
      const tab = asNativeTab(boundary, candidate);
      if (!readOpenTabs().includes(tab)) {
        throw createTabsError(
          boundary,
          "FENNEVIA_FIREFOX_TAB_OPEN_REJECTED",
          "firefox-tabs-action",
          "window.gBrowser.addTrustedTab",
        );
      }
      const id = registry.register(tab);
      reconcile(true);
      if (normalized.selected && requireGBrowser().selectedTab !== tab) {
        throw createTabsError(
          boundary,
          "FENNEVIA_FIREFOX_TAB_SELECT_REJECTED",
          "firefox-tabs-action",
          "window.gBrowser.selectedTab",
        );
      }
      return id;
    },

    openContextMenu(tabId: string, point: TabContextMenuPoint): void {
      const tab = requireOwnedTab(tabId);
      const normalized = normalizeContextMenuPoint(point);
      const menu = requireTabContextMenu();
      const openPopup = menu.openPopup;
      const moveTo = menu.moveTo;
      if (!isFunction(openPopup) || !isFunction(moveTo)) {
        throw createTabsError(
          boundary,
          "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING",
          "firefox-tabs-action",
          "document.tabContextMenu.openPopup.moveTo",
        );
      }
      try {
        Reflect.apply(openPopup, menu, [tab, "after_start", 0, 0, true]);
      } catch (error) {
        throw createTabsError(
          boundary,
          "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_REJECTED",
          "firefox-tabs-action",
          "document.tabContextMenu.openPopup",
          error,
        );
      }
      try {
        Reflect.apply(moveTo, menu, [normalized.screenX, normalized.screenY]);
      } catch (error) {
        onError(
          createTabsError(
            boundary,
            "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_POSITION_FAILED",
            "firefox-tabs-action",
            "document.tabContextMenu.moveTo",
            error,
          ),
        );
      }
    },

    pin(tabId: string): void {
      const tab = requireOwnedTab(tabId);
      if (!hasAttribute(tab, "pinned")) {
        callTabMethod("pinTab", [tab]);
        if (!hasAttribute(tab, "pinned")) {
          throw createTabsError(
            boundary,
            "FENNEVIA_FIREFOX_TAB_PIN_REJECTED",
            "firefox-tabs-action",
            "window.gBrowser.pinTab",
          );
        }
        reconcile(true);
      }
    },

    select(tabId: string): void {
      const tab = requireOwnedTab(tabId);
      const browser = requireGBrowser();
      if (browser.selectedTab !== tab) {
        if (!Reflect.set(browser, "selectedTab", tab)) {
          throw createTabsError(
            boundary,
            "FENNEVIA_FIREFOX_TAB_SELECT_REJECTED",
            "firefox-tabs-action",
            "window.gBrowser.selectedTab",
          );
        }
        if (browser.selectedTab !== tab) {
          throw createTabsError(
            boundary,
            "FENNEVIA_FIREFOX_TAB_SELECT_REJECTED",
            "firefox-tabs-action",
            "window.gBrowser.selectedTab",
          );
        }
        reconcile(true);
      }
    },

    snapshot(): readonly TabSnapshot[] {
      requireWindow();
      return currentTabs;
    },

    subscribe(listener: (event: TabStateEvent) => void): () => boolean {
      requireWindow();
      if (typeof listener !== "function") {
        throw createTabsError(
          boundary,
          "FENNEVIA_FIREFOX_TABS_LISTENER_INVALID",
          "firefox-tabs-subscribe",
          "tabs.subscribe",
        );
      }
      subscribers.add(listener);
      return createIdempotentDisposer(() => {
        subscribers.delete(listener);
      });
    },

    toggleMute(tabId: string): void {
      const tab = requireOwnedTab(tabId);
      const method = tab.toggleMuteAudio;
      if (!isFunction(method)) {
        throw createTabsError(
          boundary,
          "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING",
          "firefox-tabs-action",
          "MozTabbrowserTab.toggleMuteAudio",
        );
      }
      Reflect.apply(method, tab, []);
      reconcile(true);
    },

    unpin(tabId: string): void {
      const tab = requireOwnedTab(tabId);
      if (hasAttribute(tab, "pinned")) {
        callTabMethod("unpinTab", [tab]);
        if (hasAttribute(tab, "pinned")) {
          throw createTabsError(
            boundary,
            "FENNEVIA_FIREFOX_TAB_UNPIN_REJECTED",
            "firefox-tabs-action",
            "window.gBrowser.unpinTab",
          );
        }
        reconcile(true);
      }
    },
  });

  try {
    boundary.assertRequiredCapabilities();
    assertRequiredCapabilities();
    reconcile(false);
    const tabContainer = requireGBrowser().tabContainer;
    for (const eventType of TAB_EVENT_TYPES) {
      listenerDisposers.push(
        boundary.subscribe(tabContainer, eventType, (event) => {
          if (disposed || failedError) {
            return;
          }
          try {
            if (
              eventType === "TabAttrModified" &&
              !isRelevantAttributeEvent(event)
            ) {
              return;
            }
            reconcile(true);
          } catch (error) {
            reportNativeEventFailure(error, eventType);
          }
        }),
      );
    }
    const menu = getDocumentElementById(requireWindow(), "tabContextMenu");
    if (!isNativeTabContextMenu(menu)) {
      throw createTabsError(
        boundary,
        "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING",
        "firefox-tabs-capability",
        "document.tabContextMenu.openPopup.moveTo",
      );
    }
    tabContextMenu = menu;
    listenerDisposers.push(
      boundary.subscribe(menu, "popupshown", (event) => {
        if (disposed || failedError || !isTabContextMenuEvent(event, menu)) {
          return;
        }
        publish(Object.freeze({ open: true, type: "context-menu" }));
      }),
    );
    listenerDisposers.push(
      boundary.subscribe(menu, "popuphidden", (event) => {
        if (disposed || !isTabContextMenuEvent(event, menu)) {
          return;
        }
        publish(Object.freeze({ open: false, type: "context-menu" }));
      }),
    );
  } catch (error) {
    disposed = true;
    nativeWindow = null;
    let cleanupError: unknown;
    for (const disposeListener of listenerDisposers.reverse()) {
      try {
        disposeListener();
      } catch (candidate) {
        cleanupError ??= candidate;
      }
    }
    try {
      registry.dispose();
    } catch (candidate) {
      cleanupError ??= candidate;
    }
    if (cleanupError !== undefined) {
      onError(
        createTabsError(
          boundary,
          "FENNEVIA_FIREFOX_TABS_DISPOSE_FAILED",
          "firefox-tabs-dispose",
          "window.gBrowser.tabContainer",
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
      nativeWindow = null;
      let firstError: unknown;
      const hidePopup = tabContextMenu?.hidePopup;
      if (tabContextMenu && isFunction(hidePopup)) {
        try {
          Reflect.apply(hidePopup, tabContextMenu, []);
        } catch (error) {
          firstError ??= error;
        }
      }
      tabContextMenu = null;
      identityService = null;
      for (const disposeListener of listenerDisposers.reverse()) {
        try {
          disposeListener();
        } catch (error) {
          firstError ??= error;
        }
      }
      listenerDisposers.length = 0;
      subscribers.clear();
      activeTabIds.clear();
      currentTabs = Object.freeze([]);
      try {
        registry.dispose();
      } catch (error) {
        firstError ??= error;
      }
      if (firstError !== undefined) {
        throw createTabsError(
          boundary,
          "FENNEVIA_FIREFOX_TABS_DISPOSE_FAILED",
          "firefox-tabs-dispose",
          "window.gBrowser.tabContainer",
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
        tabCount: currentTabs.length,
      });
    },

    tabs: publicBridge,
  });
}
