import {
  type BrowserToolbarWidgetsBridge,
  type ToolbarWidgetKind,
  type ToolbarWidgetSnapshot,
  type ToolbarWidgetsPopupEvent,
  type ToolbarWidgetsSnapshot,
  type ToolbarWidgetsStateEvent,
} from "../app/toolbar-widgets-state.ts";
import {
  FirefoxBridgeError,
  isFirefoxBridgeError,
  type FirefoxBridgeBoundary,
  type FirefoxBridgeErrorContext,
  type FirefoxCapabilitySnapshot,
  type IdempotentDisposer,
} from "./bridge-boundary.ts";

type NativeRecord = Record<string, unknown>;

type NativeNode = NativeRecord & {
  getAttribute: (...args: unknown[]) => unknown;
};

type NativePanel = NativeRecord & {
  hidePopup: (...args: unknown[]) => unknown;
  moveToAnchor: (...args: unknown[]) => unknown;
};

type ToolbarWidgetCapabilityEvaluation = Readonly<{
  cause?: unknown;
  snapshot: FirefoxCapabilitySnapshot;
}>;

type ToolbarWidgetCapabilitySpecification = Readonly<{
  isAvailable: (value: unknown) => boolean;
  name: string;
  read: (window: NativeRecord) => unknown;
  requirement: "optional" | "required";
  symbol: string;
}>;

type PendingPanelWaiter = {
  resolve: (opened: boolean) => void;
  timeoutHandle: unknown;
};

const NAVBAR_AREA = "nav-bar";
const WIDGET_VIEW_PANEL_ID = "customizationui-widget-panel";
const PANEL_SHOWN_TIMEOUT_MS = 800;
const ADOPTED_PANEL_POSITION = "after_start";
const LABEL_MAX_LENGTH = 200;
const TOOLTIP_MAX_LENGTH = 300;
const BADGE_MAX_LENGTH = 8;
const ICON_URL_MAX_LENGTH = 512;
const LISTENER_OPTIONS = Object.freeze({ capture: true });
const COLOR_PATTERN = /^rgba?\([0-9\s.,%]{1,48}\)$/u;
const CSS_URL_PATTERN = /url\("((?:[^"\\]|\\.){1,512})"\)/u;
const MOZ_EXTENSION_URL_PREFIX = "moz-extension://";

// Placements already represented by fixed Fennevia controls, plus container
// items that cannot be mirrored as buttons.
const SKIPPED_WIDGET_IDS = Object.freeze([
  "back-button",
  "forward-button",
  "stop-reload-button",
  "home-button",
  "urlbar-container",
  "search-container",
  "downloads-button",
  "personal-bookmarks",
  "menubar-items",
  "tabbrowser-tabs",
]);

const skippedWidgetIdSet = new Set<string>(SKIPPED_WIDGET_IDS);

// Curated icon tokens for known built-in widget ids. The raw widget id never
// crosses the bridge; only the fixed token does.
const builtinIconTokenByWidgetId: ReadonlyMap<string, string> = new Map([
  ["bookmarks-menu-button", "bookmark"],
  ["developer-button", "developer"],
  ["edit-controls", "edit"],
  ["firefox-view-button", "firefox-view"],
  ["fullscreen-button", "fullscreen"],
  ["fxa-toolbar-menu-button", "account"],
  ["history-panelmenu", "history"],
  ["ipprotection-button", "shield"],
  ["library-button", "library"],
  ["new-window-button", "new-window"],
  ["print-button", "print"],
  ["privatebrowsing-button", "private"],
  ["reset-pbm-toolbar-button", "private"],
  ["screenshot-button", "screenshot"],
  ["sidebar-button", "sidebar"],
  ["zoom-controls", "zoom"],
]);

const isNativeRecord = (value: unknown): value is NativeRecord =>
  typeof value === "object" && value !== null;

const isFunction = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === "function";

const isNativeNode = (value: unknown): value is NativeNode =>
  isNativeRecord(value) && isFunction(value.getAttribute);

const isPanelElement = (value: unknown): value is NativePanel =>
  isNativeRecord(value) &&
  isFunction(value.hidePopup) &&
  isFunction(value.moveToAnchor);

const boundString = (value: unknown, maxLength: number): string =>
  typeof value === "string" ? value.slice(0, maxLength) : "";

const readColor = (value: string): string => {
  const candidate = value.trim();
  return COLOR_PATTERN.test(candidate) ? candidate : "";
};

const readCustomizableUi = (window: NativeRecord): NativeRecord | null => {
  const candidate = window.CustomizableUI;
  if (
    !isNativeRecord(candidate) ||
    !isFunction(candidate.getWidgetIdsInArea) ||
    !isFunction(candidate.getWidget) ||
    !isFunction(candidate.addListener) ||
    !isFunction(candidate.removeListener)
  ) {
    return null;
  }
  return candidate;
};

const readShowSubView = (
  window: NativeRecord,
): ((...args: unknown[]) => unknown) | null => {
  const panelUi = window.PanelUI;
  if (!isNativeRecord(panelUi) || !isFunction(panelUi.showSubView)) {
    return null;
  }
  return panelUi.showSubView;
};

const toolbarWidgetCapabilitySpecifications: ReadonlyArray<ToolbarWidgetCapabilitySpecification> =
  Object.freeze([
    Object.freeze({
      isAvailable: (value: unknown) => value !== null,
      name: "toolbar-widgets.customizable-ui",
      read: (window: NativeRecord) => readCustomizableUi(window),
      requirement: "optional" as const,
      symbol:
        "window.CustomizableUI.getWidgetIdsInArea.getWidget.addListener.removeListener",
    }),
    Object.freeze({
      isAvailable: (value: unknown) => value !== null,
      name: "toolbar-widgets.panel-ui-sub-view",
      read: (window: NativeRecord) => readShowSubView(window),
      requirement: "optional" as const,
      symbol: "window.PanelUI.showSubView",
    }),
    Object.freeze({
      isAvailable: (value: unknown) =>
        isNativeRecord(value) &&
        isFunction(value.addEventListener) &&
        isFunction(value.removeEventListener) &&
        isFunction(value.getElementById),
      name: "toolbar-widgets.document-events",
      read: (window: NativeRecord) => window.document,
      requirement: "required" as const,
      symbol: "document.addEventListener.removeEventListener.getElementById",
    }),
  ]);

const evaluateToolbarWidgetCapabilities = (
  window: NativeRecord,
): readonly ToolbarWidgetCapabilityEvaluation[] =>
  Object.freeze(
    toolbarWidgetCapabilitySpecifications.map((specification) => {
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
          requirement: specification.requirement,
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

const createToolbarWidgetsError = (
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

const readSpecialKind = (widgetId: string): ToolbarWidgetKind | null => {
  if (widgetId.startsWith("customizableui-special-")) {
    const match = /^customizableui-special-(spring|spacer|separator)/u.exec(
      widgetId,
    );
    return match ? (match[1] as ToolbarWidgetKind) : null;
  }
  if (
    widgetId === "spring" ||
    widgetId === "spacer" ||
    widgetId === "separator"
  ) {
    return widgetId;
  }
  return widgetId === "vertical-spacer" ? "spacer" : null;
};

const readRecordString = (record: NativeRecord | null, key: string): string => {
  if (!record) {
    return "";
  }
  try {
    const value = record[key];
    return typeof value === "string" ? value : "";
  } catch {
    // Lazy wrapper getters (e.g. l10n-backed labels) may throw.
    return "";
  }
};

const getDocumentElementById = (window: NativeRecord, id: string): unknown => {
  const document = window.document;
  if (!isNativeRecord(document) || !isFunction(document.getElementById)) {
    return undefined;
  }
  return Reflect.apply(document.getElementById, document, [id]);
};

const querySelectorOn = (node: NativeRecord, selector: string): unknown => {
  if (!isFunction(node.querySelector)) {
    return undefined;
  }
  try {
    return Reflect.apply(node.querySelector, node, [selector]);
  } catch {
    return undefined;
  }
};

const readAttribute = (node: NativeNode, name: string): string => {
  try {
    const value = Reflect.apply(node.getAttribute, node, [name]);
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
};

const isNodeConnected = (node: NativeRecord): boolean =>
  node.isConnected === true;

const readExtensionActionButton = (node: NativeRecord): NativeNode | null => {
  const button = querySelectorOn(
    node,
    ".unified-extensions-item-action-button",
  );
  return isNativeNode(button) ? button : null;
};

const readExtensionIconUrl = (actionButton: NativeNode): string => {
  let styleText = "";
  const style = actionButton.style;
  if (isNativeRecord(style) && isFunction(style.getPropertyValue)) {
    try {
      const value = Reflect.apply(style.getPropertyValue, style, [
        "--webextension-toolbar-image",
      ]);
      if (typeof value === "string") {
        styleText = value;
      }
    } catch {
      styleText = "";
    }
  }
  if (!styleText) {
    styleText = readAttribute(actionButton, "style");
  }
  const match = CSS_URL_PATTERN.exec(styleText);
  if (!match) {
    return "";
  }
  const url = match[1].replace(/\\(.)/gu, "$1");
  if (
    !url.startsWith(MOZ_EXTENSION_URL_PREFIX) ||
    url.length > ICON_URL_MAX_LENGTH
  ) {
    return "";
  }
  return url;
};

const readExtensionBadge = (
  actionButton: NativeNode,
): Readonly<{ background: string; text: string; textColor: string }> => {
  const text = boundString(
    readAttribute(actionButton, "badge"),
    BADGE_MAX_LENGTH,
  );
  let background = "";
  let textColor = "";
  const badgeStyle = readAttribute(actionButton, "badgeStyle");
  const backgroundMatch = /background-color:\s*([^;]{1,64})/u.exec(badgeStyle);
  if (backgroundMatch) {
    background = readColor(backgroundMatch[1]);
  }
  const colorMatch = /(?:^|;)\s*color:\s*([^;]{1,64})/u.exec(badgeStyle);
  if (colorMatch) {
    textColor = readColor(colorMatch[1]);
  }
  return Object.freeze({ background, text, textColor });
};

const readExtensionLabel = (node: NativeRecord): string => {
  const nameLabel = querySelectorOn(node, ".unified-extensions-item-name");
  if (isNativeRecord(nameLabel) && typeof nameLabel.textContent === "string") {
    const text = nameLabel.textContent.trim();
    if (text) {
      return boundString(text, LABEL_MAX_LENGTH);
    }
  }
  return "";
};

const readNodeDisabled = (node: NativeNode): boolean =>
  node.disabled === true || readAttribute(node, "disabled") === "true";

export type FirefoxToolbarWidgetsBridgeController = Readonly<{
  assertRequiredCapabilities: () => readonly FirefoxCapabilitySnapshot[];
  dispose: () => boolean;
  refresh: () => boolean;
  snapshot: () => Readonly<{
    disposed: boolean;
    pendingActionCount: number;
    revision: number;
    widgetCount: number;
  }>;
  toolbarWidgets: BrowserToolbarWidgetsBridge;
}>;

export function createFirefoxToolbarWidgetsBridge({
  boundary,
  frame,
  window,
}: Readonly<{
  boundary: FirefoxBridgeBoundary;
  frame: unknown;
  window: unknown;
}>): FirefoxToolbarWidgetsBridgeController {
  boundary.assertOwnsWindow(window);
  if (
    !isNativeRecord(window) ||
    !isNativeRecord(frame) ||
    typeof frame.contains !== "function"
  ) {
    throw createToolbarWidgetsError(
      boundary,
      "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_OPTIONS_INVALID",
      "firefox-toolbar-widgets-create",
      "window",
    );
  }

  const frameContains = (node: unknown): boolean =>
    Reflect.apply(frame.contains as (...args: unknown[]) => unknown, frame, [
      node,
    ]) === true;

  let nativeWindow: NativeRecord | null = window;
  let disposed = false;
  let pendingActionCount = 0;
  let revision = 0;
  let refreshScheduled = false;
  let customizableUiListenerAttached = false;
  let lastSerializedWidgets = "";
  let lastSnapshot: ToolbarWidgetsSnapshot = Object.freeze({
    available: false,
    widgets: Object.freeze([]),
  });
  let mutationObserver: NativeRecord | null = null;
  let heldPanel: NativePanel | null = null;
  let heldPanelHandle = "";
  let pendingViewWaiter: PendingPanelWaiter | null = null;
  let pendingViewHandle = "";
  let pendingNodeInvoke: Readonly<{
    handle: string;
    host: NativeRecord;
    node: NativeRecord;
    resolve: (opened: boolean) => void;
    timeoutHandle: unknown;
  }> | null = null;
  const currentHandleIds = new Set<string>();
  const listenerDisposers: IdempotentDisposer[] = [];
  const snapshotListeners = new Set<
    (event: ToolbarWidgetsStateEvent) => void
  >();
  const popupListeners = new Set<(event: ToolbarWidgetsPopupEvent) => void>();
  const registry = boundary.createHandleRegistry<object>("toolbar-widget");

  const requireWindow = (): NativeRecord => {
    if (disposed || !nativeWindow) {
      throw createToolbarWidgetsError(
        boundary,
        "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_DISPOSED",
        "firefox-toolbar-widgets-access",
        "window",
      );
    }
    return nativeWindow;
  };

  const assertRequiredCapabilities =
    (): readonly FirefoxCapabilitySnapshot[] => {
      const evaluations = evaluateToolbarWidgetCapabilities(requireWindow());
      const missing = evaluations.find(
        (evaluation) =>
          evaluation.snapshot.requirement === "required" &&
          !evaluation.snapshot.available,
      );
      if (missing) {
        throw createToolbarWidgetsError(
          boundary,
          "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_CAPABILITY_MISSING",
          "firefox-toolbar-widgets-capability",
          missing.snapshot.symbol,
          missing.cause,
        );
      }
      return Object.freeze(
        evaluations.map((evaluation) => evaluation.snapshot),
      );
    };

  const requireProjectHost = (host: unknown): NativeRecord => {
    const ownerWindow = requireWindow();
    if (
      !isNativeRecord(host) ||
      !isFunction(host.getBoundingClientRect) ||
      host.ownerDocument !== ownerWindow.document ||
      frameContains(host) !== true
    ) {
      throw createToolbarWidgetsError(
        boundary,
        "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HOST_INVALID",
        "firefox-toolbar-widgets-action",
        "toolbar-widgets.host",
      );
    }
    return host;
  };

  const readWidgetEntries = (): ReadonlyArray<
    Readonly<{ node: NativeRecord | null; widget: ToolbarWidgetSnapshot }>
  > | null => {
    const ownerWindow = requireWindow();
    const customizableUi = readCustomizableUi(ownerWindow);
    if (!customizableUi) {
      return null;
    }
    let widgetIds: unknown;
    try {
      widgetIds = Reflect.apply(
        customizableUi.getWidgetIdsInArea as (...args: unknown[]) => unknown,
        customizableUi,
        [NAVBAR_AREA],
      );
    } catch {
      return null;
    }
    if (!Array.isArray(widgetIds)) {
      return null;
    }

    const entries: Array<
      Readonly<{ node: NativeRecord | null; widget: ToolbarWidgetSnapshot }>
    > = [];
    for (const widgetId of widgetIds) {
      if (typeof widgetId !== "string" || skippedWidgetIdSet.has(widgetId)) {
        continue;
      }
      const specialKind = readSpecialKind(widgetId);
      if (specialKind) {
        entries.push(
          Object.freeze({
            node: null,
            widget: Object.freeze({
              badgeBackground: "",
              badgeText: "",
              badgeTextColor: "",
              disabled: false,
              handle: "",
              icon: "",
              iconUrl: "",
              kind: specialKind,
              label: "",
              tooltip: "",
            }),
          }),
        );
        continue;
      }

      const node = getDocumentElementById(ownerWindow, widgetId);
      if (!isNativeNode(node) || !isNodeConnected(node)) {
        continue;
      }

      let wrapper: NativeRecord | null;
      try {
        const candidate = Reflect.apply(
          customizableUi.getWidget as (...args: unknown[]) => unknown,
          customizableUi,
          [widgetId],
        );
        wrapper = isNativeRecord(candidate) ? candidate : null;
      } catch {
        wrapper = null;
      }

      const isExtension = wrapper?.webExtension === true;
      const handle = registry.register(node);
      const nodeLabel = readAttribute(node, "label");
      const wrapperLabel = readRecordString(wrapper, "label");
      const nodeTooltip = readAttribute(node, "tooltiptext");
      const wrapperTooltip = readRecordString(wrapper, "tooltiptext");

      if (isExtension) {
        const actionButton = readExtensionActionButton(node);
        const badge = actionButton
          ? readExtensionBadge(actionButton)
          : Object.freeze({ background: "", text: "", textColor: "" });
        const label =
          readExtensionLabel(node) ||
          boundString(wrapperLabel || nodeLabel, LABEL_MAX_LENGTH) ||
          "Extension";
        entries.push(
          Object.freeze({
            node,
            widget: Object.freeze({
              badgeBackground: badge.background,
              badgeText: badge.text,
              badgeTextColor: badge.textColor,
              disabled: actionButton
                ? readNodeDisabled(actionButton)
                : readNodeDisabled(node),
              handle,
              icon: "extension",
              iconUrl: actionButton ? readExtensionIconUrl(actionButton) : "",
              kind: "extension-action" as const,
              label,
              tooltip:
                boundString(
                  wrapperTooltip || nodeTooltip,
                  TOOLTIP_MAX_LENGTH,
                ) || label,
            }),
          }),
        );
        continue;
      }

      const label =
        boundString(nodeLabel || wrapperLabel, LABEL_MAX_LENGTH) ||
        boundString(nodeTooltip || wrapperTooltip, LABEL_MAX_LENGTH) ||
        "Toolbar item";
      entries.push(
        Object.freeze({
          node,
          widget: Object.freeze({
            badgeBackground: "",
            badgeText: "",
            badgeTextColor: "",
            disabled: readNodeDisabled(node),
            handle,
            icon: builtinIconTokenByWidgetId.get(widgetId) ?? "generic",
            iconUrl: "",
            kind: "built-in" as const,
            label,
            tooltip: boundString(
              nodeTooltip || wrapperTooltip || label,
              TOOLTIP_MAX_LENGTH,
            ),
          }),
        }),
      );
    }
    return Object.freeze(entries);
  };

  const observeWidgetNodes = (
    nodes: ReadonlyArray<NativeRecord | null>,
  ): void => {
    if (
      isNativeRecord(mutationObserver) &&
      isFunction(mutationObserver.disconnect)
    ) {
      try {
        Reflect.apply(mutationObserver.disconnect, mutationObserver, []);
      } catch {
        // Observation is best-effort; CustomizableUI events still refresh.
      }
    }
    mutationObserver = null;
    const ownerWindow = nativeWindow;
    if (!ownerWindow) {
      return;
    }
    const ObserverConstructor = ownerWindow.MutationObserver;
    if (!isFunction(ObserverConstructor)) {
      return;
    }
    try {
      const observer = Reflect.construct(ObserverConstructor, [
        () => {
          scheduleRefresh();
        },
      ]) as NativeRecord;
      if (!isFunction(observer.observe)) {
        return;
      }
      for (const node of nodes) {
        if (!node) {
          continue;
        }
        Reflect.apply(observer.observe, observer, [
          node,
          Object.freeze({
            attributeFilter: Object.freeze([
              "badge",
              "badgeStyle",
              "disabled",
              "label",
              "style",
              "tooltiptext",
            ]),
            attributes: true,
            subtree: true,
          }),
        ]);
      }
      mutationObserver = observer;
    } catch {
      mutationObserver = null;
    }
  };

  const buildSnapshot = (): Readonly<{
    serialized: string;
    snapshot: ToolbarWidgetsSnapshot;
  }> => {
    const entries = readWidgetEntries();
    if (entries === null) {
      return Object.freeze({
        serialized: "unavailable",
        snapshot: Object.freeze({
          available: false,
          widgets: Object.freeze([]),
        }),
      });
    }
    const widgets = Object.freeze(entries.map((entry) => entry.widget));
    const nextHandleIds = new Set<string>();
    for (const widget of widgets) {
      if (widget.handle !== "") {
        nextHandleIds.add(widget.handle);
      }
    }
    for (const staleId of currentHandleIds) {
      if (!nextHandleIds.has(staleId)) {
        try {
          registry.release(staleId);
        } catch {
          // A stale handle may already be gone; refresh continues.
        }
      }
    }
    currentHandleIds.clear();
    for (const id of nextHandleIds) {
      currentHandleIds.add(id);
    }
    observeWidgetNodes(entries.map((entry) => entry.node));
    return Object.freeze({
      serialized: JSON.stringify(widgets),
      snapshot: Object.freeze({ available: true, widgets }),
    });
  };

  const publishSnapshotIfChanged = (): void => {
    if (disposed) {
      return;
    }
    const built = buildSnapshot();
    if (built.serialized === lastSerializedWidgets) {
      return;
    }
    lastSerializedWidgets = built.serialized;
    lastSnapshot = built.snapshot;
    revision += 1;
    const event: ToolbarWidgetsStateEvent = Object.freeze({
      revision,
      snapshot: lastSnapshot,
      type: "snapshot" as const,
    });
    for (const listener of Array.from(snapshotListeners)) {
      listener(event);
    }
  };

  const scheduleRefresh = (): void => {
    if (disposed || refreshScheduled) {
      return;
    }
    refreshScheduled = true;
    const run = (): void => {
      refreshScheduled = false;
      if (disposed) {
        return;
      }
      publishSnapshotIfChanged();
    };
    const ownerWindow = nativeWindow;
    const setTimeoutFn = ownerWindow?.setTimeout;
    if (ownerWindow && isFunction(setTimeoutFn)) {
      Reflect.apply(setTimeoutFn, ownerWindow, [run, 0]);
      return;
    }
    queueMicrotask(run);
  };

  const customizableUiListener = Object.freeze({
    onAreaReset: () => scheduleRefresh(),
    onCustomizeEnd: () => scheduleRefresh(),
    onWidgetAdded: () => scheduleRefresh(),
    onWidgetCreated: () => scheduleRefresh(),
    onWidgetDestroyed: () => scheduleRefresh(),
    onWidgetInstanceRemoved: () => scheduleRefresh(),
    onWidgetMoved: () => scheduleRefresh(),
    onWidgetOverflow: () => scheduleRefresh(),
    onWidgetRemoved: () => scheduleRefresh(),
    onWidgetReset: () => scheduleRefresh(),
    onWidgetUndoMove: () => scheduleRefresh(),
    onWidgetUnderflow: () => scheduleRefresh(),
  });

  const detachCustomizableUiListener = (): void => {
    if (!customizableUiListenerAttached) {
      return;
    }
    customizableUiListenerAttached = false;
    const ownerWindow = nativeWindow;
    if (!ownerWindow) {
      return;
    }
    const customizableUi = readCustomizableUi(ownerWindow);
    if (!customizableUi) {
      return;
    }
    try {
      Reflect.apply(
        customizableUi.removeListener as (...args: unknown[]) => unknown,
        customizableUi,
        [customizableUiListener],
      );
    } catch {
      // Disposal continues; the listener object is inert once disposed.
    }
  };

  const publishPopup = (open: boolean): void => {
    const event: ToolbarWidgetsPopupEvent = Object.freeze({
      open,
      type: "widget-popup" as const,
    });
    for (const listener of Array.from(popupListeners)) {
      listener(event);
    }
  };

  const clearPendingViewWaiter = (opened: boolean): void => {
    const waiter = pendingViewWaiter;
    if (!waiter) {
      return;
    }
    pendingViewWaiter = null;
    const ownerWindow = nativeWindow;
    if (ownerWindow && isFunction(ownerWindow.clearTimeout)) {
      try {
        Reflect.apply(ownerWindow.clearTimeout, ownerWindow, [
          waiter.timeoutHandle,
        ]);
      } catch {
        // The waiter still settles below.
      }
    }
    waiter.resolve(opened);
  };

  const clearPendingNodeInvoke = (opened: boolean): void => {
    const pending = pendingNodeInvoke;
    if (!pending) {
      return;
    }
    pendingNodeInvoke = null;
    const ownerWindow = nativeWindow;
    if (
      pending.timeoutHandle !== undefined &&
      ownerWindow &&
      isFunction(ownerWindow.clearTimeout)
    ) {
      try {
        Reflect.apply(ownerWindow.clearTimeout, ownerWindow, [
          pending.timeoutHandle,
        ]);
      } catch {
        // The waiter still settles below.
      }
    }
    pending.resolve(opened);
  };

  const adoptPanel = (panel: NativePanel, handle: string): void => {
    heldPanel = panel;
    heldPanelHandle = handle;
    publishPopup(true);
  };

  const releaseHeldPanel = (): void => {
    if (!heldPanel) {
      return;
    }
    heldPanel = null;
    heldPanelHandle = "";
    publishPopup(false);
  };

  const getPopupFromEvent = (event: unknown): NativeRecord | null => {
    if (!isNativeRecord(event)) {
      return null;
    }
    if (isNativeRecord(event.originalTarget)) {
      return event.originalTarget;
    }
    return isNativeRecord(event.target) ? event.target : null;
  };

  const nodeContains = (node: NativeRecord, candidate: unknown): boolean => {
    if (candidate === node) {
      return true;
    }
    if (!isFunction(node.contains)) {
      return false;
    }
    try {
      return Reflect.apply(node.contains, node, [candidate]) === true;
    } catch {
      return false;
    }
  };

  const onPopupShown = (event: unknown): void => {
    if (disposed) {
      return;
    }
    const popup = getPopupFromEvent(event);
    if (!popup || !isPanelElement(popup)) {
      return;
    }
    const popupId = typeof popup.id === "string" ? popup.id : "";

    if (pendingViewWaiter && popupId === WIDGET_VIEW_PANEL_ID) {
      const handle = pendingViewHandle;
      clearPendingViewWaiter(true);
      pendingViewHandle = "";
      adoptPanel(popup, handle);
      return;
    }

    if (pendingNodeInvoke) {
      const anchor = popup.anchorNode;
      if (nodeContains(pendingNodeInvoke.node, anchor)) {
        const { handle, host } = pendingNodeInvoke;
        try {
          Reflect.apply(popup.moveToAnchor, popup, [
            host,
            ADOPTED_PANEL_POSITION,
            0,
            0,
          ]);
        } catch {
          // The panel stays Firefox-owned at its original geometry.
        }
        adoptPanel(popup, handle);
        clearPendingNodeInvoke(true);
      }
    }
  };

  const onPopupHidden = (event: unknown): void => {
    if (disposed) {
      return;
    }
    const popup = getPopupFromEvent(event);
    if (!popup) {
      return;
    }
    if (heldPanel && popup === heldPanel) {
      releaseHeldPanel();
      return;
    }
    const popupId = typeof popup.id === "string" ? popup.id : "";
    if (pendingViewWaiter && popupId === WIDGET_VIEW_PANEL_ID) {
      // A failed open removes the transient panel before it is shown.
      clearPendingViewWaiter(false);
      pendingViewHandle = "";
    }
  };

  const waitForViewPanel = (handle: string): Promise<boolean> => {
    const ownerWindow = requireWindow();
    clearPendingViewWaiter(false);
    return new Promise((resolve) => {
      const waiter: PendingPanelWaiter = {
        resolve,
        timeoutHandle: undefined,
      };
      pendingViewWaiter = waiter;
      pendingViewHandle = handle;
      const finishTimeout = (): void => {
        if (pendingViewWaiter !== waiter) {
          return;
        }
        pendingViewWaiter = null;
        pendingViewHandle = "";
        resolve(false);
      };
      const setTimeoutFn = ownerWindow.setTimeout;
      if (isFunction(setTimeoutFn)) {
        waiter.timeoutHandle = Reflect.apply(setTimeoutFn, ownerWindow, [
          finishTimeout,
          PANEL_SHOWN_TIMEOUT_MS,
        ]);
      } else {
        queueMicrotask(finishTimeout);
      }
    });
  };

  const waitForNodePanel = (
    handle: string,
    host: NativeRecord,
    node: NativeRecord,
  ): Promise<boolean> => {
    const ownerWindow = requireWindow();
    clearPendingNodeInvoke(false);
    return new Promise((resolve) => {
      const invokeRecord = {
        handle,
        host,
        node,
        resolve,
        timeoutHandle: undefined as unknown,
      };
      pendingNodeInvoke = invokeRecord;
      const finishTimeout = (): void => {
        if (pendingNodeInvoke !== invokeRecord) {
          return;
        }
        pendingNodeInvoke = null;
        resolve(false);
      };
      const setTimeoutFn = ownerWindow.setTimeout;
      if (isFunction(setTimeoutFn)) {
        invokeRecord.timeoutHandle = Reflect.apply(setTimeoutFn, ownerWindow, [
          finishTimeout,
          PANEL_SHOWN_TIMEOUT_MS,
        ]);
      } else {
        queueMicrotask(finishTimeout);
      }
    });
  };

  const hideHeldPanel = (): void => {
    const panel = heldPanel;
    if (!panel) {
      return;
    }
    try {
      Reflect.apply(panel.hidePopup, panel, []);
    } catch {
      releaseHeldPanel();
    }
  };

  const activateNode = (node: NativeRecord): void => {
    if (isFunction(node.doCommand)) {
      try {
        Reflect.apply(node.doCommand, node, []);
        return;
      } catch {
        // Fall through to the synthetic command event.
      }
    }
    const ownerWindow = requireWindow();
    const CustomEventConstructor = ownerWindow.CustomEvent;
    if (
      !isFunction(CustomEventConstructor) ||
      !isFunction(node.dispatchEvent)
    ) {
      throw createToolbarWidgetsError(
        boundary,
        "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_CAPABILITY_MISSING",
        "firefox-toolbar-widgets-action",
        "toolbar-widgets.node-command",
      );
    }
    const commandEvent = Reflect.construct(CustomEventConstructor, [
      "command",
      Object.freeze({ bubbles: true, cancelable: true }),
    ]);
    Reflect.apply(node.dispatchEvent, node, [commandEvent]);
  };

  const readWidgetViewId = (node: NativeRecord): string => {
    const ownerWindow = requireWindow();
    const customizableUi = readCustomizableUi(ownerWindow);
    const widgetId = typeof node.id === "string" ? node.id : "";
    if (!customizableUi || !widgetId) {
      return "";
    }
    try {
      const wrapper = Reflect.apply(
        customizableUi.getWidget as (...args: unknown[]) => unknown,
        customizableUi,
        [widgetId],
      );
      if (isNativeRecord(wrapper) && typeof wrapper.viewId === "string") {
        return wrapper.viewId;
      }
    } catch {
      return "";
    }
    return "";
  };

  const invoke = async (handle: string, host: unknown): Promise<boolean> => {
    if (typeof handle !== "string" || handle === "") {
      throw createToolbarWidgetsError(
        boundary,
        "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HANDLE_INVALID",
        "firefox-toolbar-widgets-action",
        "toolbar-widgets.handle",
      );
    }
    const resolvedHost = requireProjectHost(host);
    const node = registry.resolve(handle) as NativeRecord;
    if (!isNodeConnected(node)) {
      throw createToolbarWidgetsError(
        boundary,
        "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HANDLE_STALE",
        "firefox-toolbar-widgets-action",
        "toolbar-widgets.native-node",
      );
    }

    pendingActionCount += 1;
    try {
      // Toggle: activating the widget whose popup is already open closes it.
      if (heldPanel && heldPanelHandle === handle) {
        hideHeldPanel();
        return true;
      }
      hideHeldPanel();

      const ownerWindow = requireWindow();
      const viewId = readWidgetViewId(node);
      const showSubView = readShowSubView(ownerWindow);
      if (viewId && showSubView) {
        // A stale `open` expando left by a failed open blocks showSubView.
        try {
          if (resolvedHost.open === true) {
            resolvedHost.open = false;
          }
        } catch {
          // showSubView revalidates the anchor itself.
        }
        const shown = waitForViewPanel(handle);
        try {
          const result = Reflect.apply(showSubView, ownerWindow.PanelUI, [
            viewId,
            resolvedHost,
          ]);
          void Promise.resolve(result).catch(() => {
            // Open failures settle through the popup listeners or timeout.
          });
        } catch (error) {
          clearPendingViewWaiter(false);
          pendingViewHandle = "";
          throw createToolbarWidgetsError(
            boundary,
            "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED",
            "firefox-toolbar-widgets-action",
            "window.PanelUI.showSubView",
            error,
          );
        }
        return await shown;
      }

      const settled = waitForNodePanel(handle, resolvedHost, node);
      try {
        activateNode(node);
      } catch (error) {
        clearPendingNodeInvoke(false);
        if (isFirefoxBridgeError(error)) {
          throw error;
        }
        throw createToolbarWidgetsError(
          boundary,
          "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED",
          "firefox-toolbar-widgets-action",
          "toolbar-widgets.node-command",
          error,
        );
      }
      return await settled;
    } finally {
      pendingActionCount -= 1;
    }
  };

  const publicBridge: BrowserToolbarWidgetsBridge = Object.freeze({
    invoke,

    snapshot(): ToolbarWidgetsSnapshot {
      requireWindow();
      const built = buildSnapshot();
      lastSerializedWidgets = built.serialized;
      lastSnapshot = built.snapshot;
      return lastSnapshot;
    },

    subscribe(
      listener: (event: ToolbarWidgetsStateEvent) => void,
    ): () => boolean {
      requireWindow();
      if (typeof listener !== "function") {
        throw createToolbarWidgetsError(
          boundary,
          "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_LISTENER_INVALID",
          "firefox-toolbar-widgets-subscribe",
          "toolbar-widgets.subscribe",
        );
      }
      snapshotListeners.add(listener);
      let subscribed = true;
      return Object.freeze(() => {
        if (!subscribed) {
          return false;
        }
        subscribed = false;
        snapshotListeners.delete(listener);
        return true;
      });
    },

    subscribePopup(
      listener: (event: ToolbarWidgetsPopupEvent) => void,
    ): () => boolean {
      requireWindow();
      if (typeof listener !== "function") {
        throw createToolbarWidgetsError(
          boundary,
          "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_LISTENER_INVALID",
          "firefox-toolbar-widgets-subscribe",
          "toolbar-widgets.subscribe",
        );
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

  try {
    assertRequiredCapabilities();
    const document = requireWindow().document as NativeRecord;
    listenerDisposers.push(
      boundary.subscribe(
        document,
        "popupshown",
        onPopupShown,
        LISTENER_OPTIONS,
      ),
      boundary.subscribe(
        document,
        "popuphidden",
        onPopupHidden,
        LISTENER_OPTIONS,
      ),
    );
    const customizableUi = readCustomizableUi(requireWindow());
    if (customizableUi) {
      Reflect.apply(
        customizableUi.addListener as (...args: unknown[]) => unknown,
        customizableUi,
        [customizableUiListener],
      );
      customizableUiListenerAttached = true;
    }
    const built = buildSnapshot();
    lastSerializedWidgets = built.serialized;
    lastSnapshot = built.snapshot;
  } catch (error) {
    disposed = true;
    nativeWindow = null;
    for (const disposeListener of listenerDisposers.reverse()) {
      try {
        disposeListener();
      } catch {
        // The creation error remains causal.
      }
    }
    listenerDisposers.length = 0;
    throw error;
  }

  return Object.freeze({
    assertRequiredCapabilities,

    dispose(): boolean {
      if (disposed) {
        return false;
      }
      const panelToHide = heldPanel;
      disposed = true;
      clearPendingViewWaiter(false);
      pendingViewHandle = "";
      clearPendingNodeInvoke(false);
      detachCustomizableUiListener();
      if (
        isNativeRecord(mutationObserver) &&
        isFunction(mutationObserver.disconnect)
      ) {
        try {
          Reflect.apply(mutationObserver.disconnect, mutationObserver, []);
        } catch {
          // Disposal remains idempotent.
        }
      }
      mutationObserver = null;
      heldPanel = null;
      heldPanelHandle = "";
      if (panelToHide) {
        try {
          Reflect.apply(panelToHide.hidePopup, panelToHide, []);
        } catch {
          // Disposal still releases listeners and the window reference.
        }
      }
      snapshotListeners.clear();
      popupListeners.clear();
      currentHandleIds.clear();
      registry.dispose();
      nativeWindow = null;
      for (const disposeListener of listenerDisposers.reverse()) {
        try {
          disposeListener();
        } catch {
          // Disposal remains idempotent.
        }
      }
      listenerDisposers.length = 0;
      return true;
    },

    refresh(): boolean {
      if (disposed) {
        return false;
      }
      publishSnapshotIfChanged();
      return true;
    },

    snapshot() {
      return Object.freeze({
        disposed,
        pendingActionCount,
        revision,
        widgetCount: lastSnapshot.widgets.length,
      });
    },

    toolbarWidgets: publicBridge,
  });
}
