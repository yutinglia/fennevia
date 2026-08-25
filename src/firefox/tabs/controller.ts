// SPDX-License-Identifier: MPL-2.0
import type {
  BrowserTabsBridge,
  OpenTabOptions,
  TabAudioState,
  TabContainerSnapshot,
  TabContextMenuPoint,
  TabDragDropResult,
  TabDragEndOptions,
  TabDragEndResult,
  TabDragSnapshot,
  TabSnapshot,
  TabStateEvent,
} from "../../app/tab-state.ts";
import {
  maximumContainerLabelLength,
  maximumTabTitleLength,
  tabContainerColors,
} from "../../app/tab-state.ts";
import {
  FirefoxBridgeError,
  createIdempotentDisposer,
  isFirefoxBridgeError,
  type FirefoxBridgeBoundary,
  type FirefoxCapabilitySnapshot,
  type IdempotentDisposer,
} from "../bridge-boundary.ts";
import {
  TAB_EVENT_TYPES,
  GBROWSER_TAB_EVENT_TYPES,
  MAXIMUM_SCREEN_COORDINATE,
  CONTEXTUAL_IDENTITY_URI,
  isNativeRecord,
  isFunction,
  getDocumentElementById,
  isNativeTabContextMenu,
  evaluateTabsCapabilities,
  createTabsError,
  asNativeTab,
  sanitizeFaviconUrl,
  snapshotsEqual,
  isRelevantAttributeEvent,
  resolveContainerColor,
  resolveTabSharingState,
  isTabContextMenuEvent,
} from "./support.ts";
import type {
  NativeRecord,
  NativeModuleLoader,
  NativeTab,
  NativeIdentityService,
} from "./support.ts";
import type { FirefoxTabDragCoordinator } from "./drag-coordinator.ts";
export { createFirefoxTabDragCoordinator } from "./drag-coordinator.ts";

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

const TAB_CONTEXT_MENU_PANEL_ID = "tabContextMenu";

export function createFirefoxTabsBridge({
  beginNativePopupHandoff,
  boundary,
  endNativePopupHandoff,
  dragCoordinator,
  isTabDetachAllowed,
  moduleLoader,
  onError,
  window,
}: Readonly<{
  beginNativePopupHandoff: (panelId: string) => boolean;
  boundary: FirefoxBridgeBoundary;
  endNativePopupHandoff: (panelId: string) => void;
  dragCoordinator: FirefoxTabDragCoordinator;
  isTabDetachAllowed: () => boolean;
  moduleLoader?: NativeModuleLoader;
  onError: (error: unknown) => void;
  window: unknown;
}>): FirefoxTabsBridgeController {
  boundary.assertOwnsWindow(window);
  if (
    !isNativeRecord(window) ||
    typeof beginNativePopupHandoff !== "function" ||
    typeof endNativePopupHandoff !== "function" ||
    !dragCoordinator ||
    typeof dragCoordinator.begin !== "function" ||
    typeof dragCoordinator.cancel !== "function" ||
    typeof dragCoordinator.cancelContext !== "function" ||
    typeof dragCoordinator.consume !== "function" ||
    typeof dragCoordinator.inspect !== "function" ||
    typeof dragCoordinator.resolve !== "function" ||
    typeof dragCoordinator.resolveForEnd !== "function" ||
    typeof dragCoordinator.snapshot !== "function" ||
    typeof isTabDetachAllowed !== "function" ||
    typeof onError !== "function"
  ) {
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
  let tabContextMenuHandoffActive = false;
  const boundarySnapshot = boundary.snapshot();
  const contextId = boundarySnapshot.contextId;
  const windowKind = boundarySnapshot.windowKind;

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

  const readUserContextId = (tab: NativeTab): number | undefined => {
    let propertyValue: unknown;
    try {
      propertyValue = tab.userContextId;
    } catch {
      propertyValue = undefined;
    }
    for (const value of [propertyValue, readAttribute(tab, "usercontextid")]) {
      const parsed = Number(value);
      if (Number.isSafeInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return undefined;
  };

  const readNativeContainerColor = (
    tab: NativeTab,
  ): TabContainerSnapshot["color"] | undefined => {
    const classList = tab.classList;
    if (!isNativeRecord(classList)) {
      return undefined;
    }
    const contains = classList.contains;
    if (!isFunction(contains)) {
      return undefined;
    }
    try {
      return tabContainerColors.find((color) =>
        Boolean(
          Reflect.apply(contains, classList, [`identity-color-${color}`]),
        ),
      );
    } catch {
      return undefined;
    }
  };

  const readContainer = (tab: NativeTab): TabContainerSnapshot | undefined => {
    const userContextId = readUserContextId(tab);
    if (userContextId === undefined) {
      return undefined;
    }
    let identity: unknown;
    if (identityService) {
      try {
        identity = Reflect.apply(
          identityService.getPublicIdentityFromId,
          identityService,
          [userContextId],
        );
      } catch {
        identity = undefined;
      }
    }
    const color =
      (isNativeRecord(identity)
        ? resolveContainerColor(identity.color)
        : undefined) ?? readNativeContainerColor(tab);
    if (!color) {
      return undefined;
    }
    let label = "";
    if (isNativeRecord(identity) && typeof identity.name === "string") {
      label = identity.name;
    }
    if (
      label.trim().length === 0 &&
      identityService &&
      isFunction(identityService.getUserContextLabel)
    ) {
      try {
        const candidate = Reflect.apply(
          identityService.getUserContextLabel,
          identityService,
          [userContextId],
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
    const sharing = resolveTabSharingState(readAttribute(tab, "sharing"));
    return Object.freeze({
      ...(hasAttribute(tab, "attention") ? { attention: true } : {}),
      ...(audio === undefined ? {} : { audio }),
      ...(container === undefined ? {} : { container }),
      ...(hasAttribute(tab, "crashed") ? { crashed: true } : {}),
      ...(faviconUrl === undefined ? {} : { faviconUrl }),
      ...(hasAttribute(tab, "pictureinpicture")
        ? { pictureInPicture: true }
        : {}),
      ...(hasAttribute(tab, "multiselected") ? { multiselected: true } : {}),
      id: registry.register(tab),
      loading: hasAttribute(tab, "busy"),
      pinned: hasAttribute(tab, "pinned"),
      selected: selectedTab === tab,
      ...(sharing === undefined ? {} : { sharing }),
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

  const isTabMultiselected = (tab: NativeTab): boolean =>
    hasAttribute(tab, "multiselected");

  const readSelectedTabs = (): NativeTab[] => {
    const candidate = requireGBrowser().selectedTabs;
    if (!Array.isArray(candidate)) {
      throw createTabsError(
        boundary,
        "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING",
        "firefox-tabs-action",
        "window.gBrowser.selectedTabs",
      );
    }
    const tabs: NativeTab[] = [];
    for (const item of candidate) {
      if (
        isNativeRecord(item) &&
        typeof item.hasAttribute === "function" &&
        typeof item.getAttribute === "function"
      ) {
        tabs.push(item as NativeTab);
      }
    }
    return tabs;
  };

  const readSamePinSelectedTabs = (handle: NativeTab): NativeTab[] => {
    if (!isTabMultiselected(handle)) {
      return [handle];
    }
    const pinned = hasAttribute(handle, "pinned");
    const selected = new Set(readSelectedTabs());
    const moving = readOpenTabs().filter(
      (tab) => selected.has(tab) && hasAttribute(tab, "pinned") === pinned,
    );
    return moving.includes(handle) ? moving : [handle];
  };

  const moveNativeTabsToIndex = (
    moving: readonly NativeTab[],
    destStart: number,
  ): readonly NativeTab[] => {
    if (moving.length === 0) {
      return [];
    }
    const movingSet = new Set(moving);
    const openTabs = readOpenTabs();
    const remaining = openTabs.filter((tab) => !movingSet.has(tab));
    const destInRemaining = Math.max(
      0,
      destStart -
        openTabs.slice(0, destStart).filter((tab) => movingSet.has(tab)).length,
    );
    const pinned = hasAttribute(moving[0], "pinned");
    const remainingPinned = remaining.filter((tab) =>
      hasAttribute(tab, "pinned"),
    ).length;
    const clamped = pinned
      ? Math.min(Math.max(destInRemaining, 0), remainingPinned)
      : Math.min(Math.max(destInRemaining, remainingPinned), remaining.length);
    const desired = [
      ...remaining.slice(0, clamped),
      ...moving,
      ...remaining.slice(clamped),
    ];
    for (let index = 0; index < desired.length; index += 1) {
      const tab = desired[index];
      const current = readOpenTabs();
      if (tab && current[index] !== tab) {
        callTabMethod("moveTabTo", [
          tab,
          { isUserTriggered: true, tabIndex: index },
        ]);
      }
    }
    return desired;
  };

  const readLastMultiSelectedTab = (): NativeTab => {
    const browser = requireGBrowser();
    try {
      const anchor = asNativeTab(boundary, browser.lastMultiSelectedTab);
      if (readOpenTabs().includes(anchor)) {
        return anchor;
      }
    } catch {
      // Fall back to the active tab when the native anchor is missing.
    }
    return asNativeTab(boundary, browser.selectedTab);
  };

  const readLiveMovingTabs = (
    transfer: Readonly<{
      movingTabs?: readonly NativeTab[];
      pinned: boolean;
      tab: NativeTab;
    }>,
    presentIn: readonly NativeTab[] | null,
  ): NativeTab[] => {
    const captured = transfer.movingTabs ?? [transfer.tab];
    const live = captured.filter((tab) => {
      if (
        !isNativeRecord(tab) ||
        hasAttribute(tab, "pinned") !== transfer.pinned
      ) {
        return false;
      }
      return presentIn ? presentIn.includes(tab) : true;
    });
    if (presentIn) {
      const ordered = presentIn.filter((tab) => live.includes(tab));
      return ordered.includes(transfer.tab) ? ordered : [];
    }
    return live.length > 0 ? live : [transfer.tab];
  };

  const normalizeOpenOptions = (
    options: OpenTabOptions | undefined,
  ): Required<OpenTabOptions> => {
    if (options === undefined) {
      return Object.freeze({ relatedToCurrent: false, selected: true });
    }
    if (
      !isNativeRecord(options) ||
      Object.keys(options).some(
        (key) => key !== "relatedToCurrent" && key !== "selected",
      ) ||
      (options.relatedToCurrent !== undefined &&
        typeof options.relatedToCurrent !== "boolean") ||
      (options.selected !== undefined && typeof options.selected !== "boolean")
    ) {
      throw createTabsError(
        boundary,
        "FENNEVIA_FIREFOX_TAB_OPEN_OPTIONS_INVALID",
        "firefox-tabs-action",
        "tabs.open.options",
      );
    }
    return Object.freeze({
      relatedToCurrent: options.relatedToCurrent ?? false,
      selected: options.selected ?? true,
    });
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

  const normalizeDragEndOptions = (
    options: TabDragEndOptions,
  ): TabDragEndOptions => {
    if (
      !isNativeRecord(options) ||
      Object.keys(options).some(
        (key) => key !== "cancelled" && key !== "screenX" && key !== "screenY",
      ) ||
      typeof options.cancelled !== "boolean" ||
      typeof options.screenX !== "number" ||
      typeof options.screenY !== "number" ||
      !Number.isFinite(options.screenX) ||
      !Number.isFinite(options.screenY) ||
      Math.abs(options.screenX) > MAXIMUM_SCREEN_COORDINATE ||
      Math.abs(options.screenY) > MAXIMUM_SCREEN_COORDINATE
    ) {
      throw createTabsError(
        boundary,
        "FENNEVIA_FIREFOX_TAB_DRAG_END_OPTIONS_INVALID",
        "firefox-tabs-drag",
        "tabs.endDrag.options",
      );
    }
    return Object.freeze({
      cancelled: options.cancelled,
      screenX: options.screenX,
      screenY: options.screenY,
    });
  };

  const normalizeDragDropIndex = (index: number, tabCount: number): number => {
    if (!Number.isSafeInteger(index) || index < 0 || index > tabCount) {
      throw createTabsError(
        boundary,
        "FENNEVIA_FIREFOX_TAB_DRAG_DROP_INDEX_INVALID",
        "firefox-tabs-drag",
        "tabs.dropDrag.index",
      );
    }
    return index;
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

  const beginTabContextMenuHandoff = (): void => {
    if (tabContextMenuHandoffActive) {
      return;
    }
    let accepted: boolean;
    try {
      accepted = beginNativePopupHandoff(TAB_CONTEXT_MENU_PANEL_ID) === true;
    } catch (error) {
      throw createTabsError(
        boundary,
        "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_HANDOFF_FAILED",
        "firefox-tabs-context-menu-handoff",
        "nativeUi.beginPopupHandoff",
        error,
      );
    }
    if (!accepted) {
      throw createTabsError(
        boundary,
        "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_HANDOFF_REJECTED",
        "firefox-tabs-context-menu-handoff",
        "nativeUi.beginPopupHandoff",
      );
    }
    tabContextMenuHandoffActive = true;
  };

  const endTabContextMenuHandoff = (): FirefoxBridgeError | null => {
    if (!tabContextMenuHandoffActive) {
      return null;
    }
    tabContextMenuHandoffActive = false;
    try {
      endNativePopupHandoff(TAB_CONTEXT_MENU_PANEL_ID);
      return null;
    } catch (error) {
      return createTabsError(
        boundary,
        "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_HANDOFF_RELEASE_FAILED",
        "firefox-tabs-context-menu-handoff",
        "nativeUi.endPopupHandoff",
        error,
      );
    }
  };

  const publicBridge: BrowserTabsBridge = Object.freeze({
    activateKeepingMultiSelect(tabId: string): void {
      const tab = requireOwnedTab(tabId);
      const browser = requireGBrowser();
      callTabMethod("lockClearMultiSelectionOnce", []);
      try {
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
        }
      } finally {
        try {
          callTabMethod("unlockClearMultiSelection", []);
        } catch {
          // Unlock is best-effort so a missing counterpart cannot stick the lock.
        }
      }
      reconcile(true);
    },

    beginDrag(tabId: string): string {
      const tab = requireOwnedTab(tabId);
      try {
        const activeDrag = dragCoordinator.snapshot();
        if (activeDrag.active && activeDrag.sourceContextId === contextId) {
          // A new owned dragstart proves the prior same-window gesture ended.
          dragCoordinator.cancelContext(contextId);
        }
        return dragCoordinator.begin({
          isActive() {
            if (disposed || !nativeWindow) {
              return false;
            }
            try {
              return readOpenTabs().includes(tab);
            } catch {
              return false;
            }
          },
          movingTabs: readSamePinSelectedTabs(tab),
          pinned: hasAttribute(tab, "pinned"),
          sourceContextId: contextId,
          sourceWindowKind: windowKind,
          tab,
        });
      } catch (error) {
        throw createTabsError(
          boundary,
          "FENNEVIA_FIREFOX_TAB_DRAG_BEGIN_REJECTED",
          "firefox-tabs-drag",
          "tabs.beginDrag",
          error,
        );
      }
    },

    close(tabId: string): void {
      const tab = requireOwnedTab(tabId);
      if (isTabMultiselected(tab)) {
        callTabMethod("removeMultiSelectedTabs", []);
      } else {
        callTabMethod("removeTab", [
          tab,
          { animate: true, isUserTriggered: true },
        ]);
      }
      reconcile(true);
    },

    dropDrag(index: number): TabDragDropResult {
      const nativeTabs = readOpenTabs();
      const requestedIndex = normalizeDragDropIndex(index, nativeTabs.length);
      const transfer = dragCoordinator.resolve({ contextId, windowKind });
      if (!transfer) {
        throw createTabsError(
          boundary,
          "FENNEVIA_FIREFOX_TAB_DRAG_UNAVAILABLE",
          "firefox-tabs-drag",
          "tabs.dropDrag.transfer",
        );
      }

      const pinnedCount = nativeTabs.filter((tab) =>
        hasAttribute(tab, "pinned"),
      ).length;
      if (transfer.sourceContextId === contextId) {
        if (!nativeTabs.includes(transfer.tab)) {
          dragCoordinator.cancel(transfer.id, contextId);
          throw createTabsError(
            boundary,
            "FENNEVIA_FIREFOX_TAB_STALE",
            "firefox-tabs-drag",
            "tabs.dropDrag.source-tab",
          );
        }
        const finalMaximum = Math.max(nativeTabs.length - 1, 0);
        const boundedIndex = transfer.pinned
          ? Math.min(Math.max(requestedIndex, 0), Math.max(pinnedCount - 1, 0))
          : Math.min(Math.max(requestedIndex, pinnedCount), finalMaximum);
        const moving = readLiveMovingTabs(transfer, nativeTabs);
        if (moving.length === 0) {
          dragCoordinator.cancel(transfer.id, contextId);
          throw createTabsError(
            boundary,
            "FENNEVIA_FIREFOX_TAB_STALE",
            "firefox-tabs-drag",
            "tabs.dropDrag.source-tab",
          );
        }
        const handleIndex = nativeTabs.indexOf(transfer.tab);
        const destStart =
          boundedIndex > handleIndex ? boundedIndex + 1 : boundedIndex;
        const expectedTabs = moveNativeTabsToIndex(moving, destStart);
        const actualTabs = readOpenTabs();
        const actualIndex = actualTabs.indexOf(transfer.tab);
        if (
          actualIndex < 0 ||
          actualTabs.length !== expectedTabs.length ||
          expectedTabs.some((tab, index) => actualTabs[index] !== tab)
        ) {
          throw createTabsError(
            boundary,
            "FENNEVIA_FIREFOX_TAB_MOVE_REJECTED",
            "firefox-tabs-drag",
            "window.gBrowser.moveTabTo",
          );
        }
        const tabId = registry.register(transfer.tab);
        dragCoordinator.consume(transfer.id);
        reconcile(true);
        return Object.freeze({
          index: actualIndex,
          kind: "moved",
          tabId,
        });
      }

      const boundedIndex = transfer.pinned
        ? Math.min(Math.max(requestedIndex, 0), pinnedCount)
        : Math.min(Math.max(requestedIndex, pinnedCount), nativeTabs.length);
      const moving = readLiveMovingTabs(transfer, null);
      let insertAt = boundedIndex;
      let selectedMover: NativeTab | undefined;
      let selectedDest = boundedIndex;
      let adoptedHandle: NativeTab | undefined;
      const adoptOne = (
        mover: NativeTab,
        tabIndex: number,
        selectTab: boolean,
      ): NativeTab => {
        let adoptedCandidate: unknown;
        try {
          adoptedCandidate = callTabMethod("adoptTab", [
            mover,
            {
              selectTab,
              tabIndex,
            },
          ]);
        } catch (error) {
          throw createTabsError(
            boundary,
            "FENNEVIA_FIREFOX_TAB_ADOPT_REJECTED",
            "firefox-tabs-drag",
            "window.gBrowser.adoptTab",
            error,
          );
        }
        return asNativeTab(boundary, adoptedCandidate);
      };
      for (const mover of moving) {
        if (hasAttribute(mover, "selected") && selectedMover === undefined) {
          selectedMover = mover;
          selectedDest = insertAt;
          continue;
        }
        const adopted = adoptOne(mover, insertAt, false);
        if (mover === transfer.tab) {
          adoptedHandle = adopted;
        }
        insertAt += 1;
      }
      if (selectedMover) {
        const adopted = adoptOne(selectedMover, selectedDest, true);
        if (selectedMover === transfer.tab) {
          adoptedHandle = adopted;
        }
      }
      const adoptedTab =
        adoptedHandle ?? adoptOne(transfer.tab, boundedIndex, true);
      const adoptedTabs = readOpenTabs();
      const actualIndex = adoptedTabs.indexOf(adoptedTab);
      if (actualIndex < 0) {
        throw createTabsError(
          boundary,
          "FENNEVIA_FIREFOX_TAB_ADOPT_REJECTED",
          "firefox-tabs-drag",
          "window.gBrowser.adoptTab",
        );
      }
      const tabId = registry.register(adoptedTab);
      dragCoordinator.consume(transfer.id);
      reconcile(true);
      return Object.freeze({
        index: actualIndex,
        kind: "adopted",
        tabId,
      });
    },

    endDrag(dragId: string, options: TabDragEndOptions): TabDragEndResult {
      requireWindow();
      if (
        typeof dragId !== "string" ||
        dragId.length === 0 ||
        dragId.length > 160
      ) {
        throw createTabsError(
          boundary,
          "FENNEVIA_FIREFOX_TAB_DRAG_ID_INVALID",
          "firefox-tabs-drag",
          "tabs.endDrag.id",
        );
      }
      const normalized = normalizeDragEndOptions(options);
      const resolution = dragCoordinator.resolveForEnd(dragId, contextId);
      if (resolution.status === "consumed") {
        return "consumed";
      }
      if (resolution.status === "cancelled") {
        return "cancelled";
      }
      if (resolution.status === "missing") {
        return "unchanged";
      }
      if (resolution.status !== "active") {
        return "unchanged";
      }
      if (normalized.cancelled) {
        dragCoordinator.cancel(dragId, contextId);
        return "cancelled";
      }

      let detachAllowed: boolean;
      try {
        detachAllowed = isTabDetachAllowed() === true;
      } catch (error) {
        dragCoordinator.cancel(dragId, contextId);
        throw createTabsError(
          boundary,
          "FENNEVIA_FIREFOX_TAB_DETACH_POLICY_FAILED",
          "firefox-tabs-drag",
          "browser.tabs.allowTabDetach",
          error,
        );
      }
      if (!detachAllowed) {
        dragCoordinator.cancel(dragId, contextId);
        return "blocked";
      }

      const sourceTabs = readOpenTabs();
      const moving = readLiveMovingTabs(resolution.transfer, sourceTabs);
      if (
        moving.length === 0 ||
        !sourceTabs.includes(resolution.transfer.tab)
      ) {
        dragCoordinator.cancel(dragId, contextId);
        return "unchanged";
      }
      if (moving.length >= sourceTabs.length) {
        dragCoordinator.consume(dragId);
        return "unchanged";
      }

      const detachMethod =
        moving.length > 1 ? "replaceTabsWithWindow" : "replaceTabWithWindow";
      let replacement: unknown;
      try {
        replacement = callTabMethod(detachMethod, [
          resolution.transfer.tab,
          {
            screenX: normalized.screenX,
            screenY: normalized.screenY,
            suppressanimation: 1,
          },
        ]);
      } catch (error) {
        throw createTabsError(
          boundary,
          "FENNEVIA_FIREFOX_TAB_DETACH_REJECTED",
          "firefox-tabs-drag",
          `window.gBrowser.${detachMethod}`,
          error,
        );
      } finally {
        dragCoordinator.consume(dragId);
      }
      return replacement == null ? "unchanged" : "detached";
    },

    inspectDrag(): TabDragSnapshot | null {
      requireWindow();
      return dragCoordinator.inspect({ contextId, windowKind });
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
      if (isTabMultiselected(tab)) {
        moveNativeTabsToIndex(readSamePinSelectedTabs(tab), index);
      } else {
        callTabMethod("moveTabTo", [
          tab,
          { isUserTriggered: true, tabIndex: index },
        ]);
      }
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
      const nativeOptions: {
        inBackground: boolean;
        relatedToCurrent?: boolean;
      } = { inBackground: !normalized.selected };
      if (normalized.relatedToCurrent) {
        nativeOptions.relatedToCurrent = true;
      }
      const candidate = callTabMethod("addTrustedTab", [
        newTabUrl,
        nativeOptions,
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
        callTabMethod("translateTabContextMenu", []);
      } catch (error) {
        if (isFirefoxBridgeError(error)) {
          throw error;
        }
        throw createTabsError(
          boundary,
          "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_TRANSLATION_FAILED",
          "firefox-tabs-action",
          "window.gBrowser.translateTabContextMenu",
          error,
        );
      }
      beginTabContextMenuHandoff();
      try {
        Reflect.apply(openPopup, menu, [tab, "after_start", 0, 0, true]);
      } catch (error) {
        const handoffError = endTabContextMenuHandoff();
        if (handoffError) {
          onError(handoffError);
        }
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
      if (isTabMultiselected(tab)) {
        callTabMethod("pinMultiSelectedTabs", []);
        reconcile(true);
        return;
      }
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

    clearMultiSelect(): void {
      callTabMethod("clearMultiSelectedTabs", []);
      reconcile(true);
    },

    selectRange(tabId: string): void {
      const tab = requireOwnedTab(tabId);
      const browser = requireGBrowser();
      const anchor = readLastMultiSelectedTab();
      if (browser.selectedTab !== anchor) {
        if (!Reflect.set(browser, "selectedTab", anchor)) {
          throw createTabsError(
            boundary,
            "FENNEVIA_FIREFOX_TAB_SELECT_REJECTED",
            "firefox-tabs-action",
            "window.gBrowser.selectedTab",
          );
        }
        if (browser.selectedTab !== anchor) {
          throw createTabsError(
            boundary,
            "FENNEVIA_FIREFOX_TAB_SELECT_REJECTED",
            "firefox-tabs-action",
            "window.gBrowser.selectedTab",
          );
        }
      }
      callTabMethod("clearMultiSelectedTabs", []);
      callTabMethod("addRangeToMultiSelectedTabs", [anchor, tab]);
      reconcile(true);
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

    toggleMultiSelect(tabId: string): void {
      const tab = requireOwnedTab(tabId);
      const browser = requireGBrowser();
      if (isTabMultiselected(tab)) {
        callTabMethod("removeFromMultiSelectedTabs", [tab]);
      } else if (browser.selectedTab !== tab) {
        callTabMethod("addToMultiSelectedTabs", [tab]);
        Reflect.set(browser, "lastMultiSelectedTab", tab);
      }
      reconcile(true);
    },

    toggleMute(tabId: string): void {
      const tab = requireOwnedTab(tabId);
      if (isTabMultiselected(tab)) {
        callTabMethod("toggleMuteAudioOnMultiSelectedTabs", [tab]);
        reconcile(true);
        return;
      }
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
      if (isTabMultiselected(tab)) {
        callTabMethod("unpinMultiSelectedTabs", []);
        reconcile(true);
        return;
      }
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
    const browser = requireGBrowser();
    const tabContainer = browser.tabContainer;
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
    for (const eventType of GBROWSER_TAB_EVENT_TYPES) {
      listenerDisposers.push(
        boundary.subscribe(browser, eventType, () => {
          if (disposed || failedError) {
            return;
          }
          try {
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
        if (!isTabContextMenuEvent(event, menu)) {
          return;
        }
        const handoffError = endTabContextMenuHandoff();
        if (handoffError) {
          onError(handoffError);
        }
        if (disposed) {
          return;
        }
        publish(Object.freeze({ open: false, type: "context-menu" }));
      }),
    );
  } catch (error) {
    disposed = true;
    nativeWindow = null;
    let cleanupError: unknown;
    try {
      dragCoordinator.cancelContext(contextId);
    } catch (candidate) {
      cleanupError ??= candidate;
    }
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
      let firstError: unknown;
      try {
        dragCoordinator.cancelContext(contextId);
      } catch (error) {
        firstError ??= error;
      }
      nativeWindow = null;
      const hidePopup = tabContextMenu?.hidePopup;
      if (tabContextMenu && isFunction(hidePopup)) {
        try {
          Reflect.apply(hidePopup, tabContextMenu, []);
        } catch (error) {
          firstError ??= error;
        }
      }
      const handoffError = endTabContextMenuHandoff();
      if (handoffError) {
        firstError ??= handoffError;
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
