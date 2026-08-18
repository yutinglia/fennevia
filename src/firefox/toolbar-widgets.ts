import {
  copyToolbarStyleSnapshot,
  copyToolbarWidgetsEditOperation,
  createDefaultToolbarStyle,
  createUnavailableToolbarWidgetsSnapshot,
  fenneviaToolbarActions,
  toolbarZoneNames,
  type BrowserToolbarWidgetsBridge,
  type FenneviaToolbarAction,
  type ToolbarPaletteEntrySnapshot,
  type ToolbarWidgetKind,
  type ToolbarWidgetSnapshot,
  type ToolbarWidgetZones,
  type ToolbarWidgetsEditOperation,
  type ToolbarWidgetsPopupEvent,
  type ToolbarWidgetsSnapshot,
  type ToolbarWidgetsStateEvent,
  type ToolbarZoneName,
} from "../app/toolbar-widgets-state.ts";
import {
  addCustomizeLayoutEntry,
  createCustomizeLayout,
  customizeLayoutContainsWidget,
  getCustomizeLayoutEntry,
  isCustomizeWidgetId,
  moveCustomizeLayoutEntry,
  parseCustomizeLayout,
  parseCustomizeStyle,
  removeCustomizeLayoutEntry,
  serializeCustomizeLayout,
  serializeCustomizeStyle,
  withCustomizeAdopted,
  withoutCustomizeAdopted,
  type CustomizeLayout,
  type CustomizeLayoutEntry,
  type CustomizeSpecialKind,
  type CustomizeStyle,
} from "./customize-model.ts";
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
const FALLBACK_ADDONS_AREA = "unified-extensions-area";
const LAYOUT_PREF = "fennevia.customize.layout";
const STYLE_PREF = "fennevia.customize.style";
const CUSTOMIZE_PREF_DOMAIN = "fennevia.customize.";
const PREF_VALUE_MAX_LENGTH = 16384;
const PALETTE_MAX_ENTRIES = 256;
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
const EXTENSION_WIDGET_SUFFIX = "-browser-action";

// Placements already represented by fixed Fennevia controls, the native
// downloads-button (users place the Fennevia show-downloads widget instead),
// plus container items that cannot be mirrored as buttons.
const SKIPPED_WIDGET_IDS = Object.freeze([
  "back-button",
  "forward-button",
  "stop-reload-button",
  "home-button",
  "urlbar-container",
  "search-container",
  "downloads-button",
  "unified-extensions-button",
  "PanelUI-menu-button",
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

// Fixed presentation for Fennevia-owned placeable widgets. The frontend
// executes these actions itself; no Firefox owner is involved.
const fenneviaWidgetPresentation: ReadonlyMap<
  FenneviaToolbarAction,
  Readonly<{ icon: string; label: string; tooltip: string }>
> = new Map<
  FenneviaToolbarAction,
  Readonly<{ icon: string; label: string; tooltip: string }>
>([
  [
    "show-bookmarks",
    Object.freeze({
      icon: "bookmark",
      label: "Show bookmarks panel",
      tooltip: "Reveal the Fennevia bookmarks panel",
    }),
  ],
  [
    "show-downloads",
    Object.freeze({
      icon: "download",
      label: "Open Firefox downloads",
      tooltip: "Open the Firefox downloads panel",
    }),
  ],
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

type NativePrefs = NativeRecord & {
  addObserver: (...args: unknown[]) => unknown;
  clearUserPref: (...args: unknown[]) => unknown;
  getStringPref: (...args: unknown[]) => unknown;
  removeObserver: (...args: unknown[]) => unknown;
  setStringPref: (...args: unknown[]) => unknown;
};

const readPrefs = (window: NativeRecord): NativePrefs | null => {
  const services = window.Services;
  if (!isNativeRecord(services)) {
    return null;
  }
  const prefs = services.prefs;
  if (
    !isNativeRecord(prefs) ||
    !isFunction(prefs.addObserver) ||
    !isFunction(prefs.clearUserPref) ||
    !isFunction(prefs.getStringPref) ||
    !isFunction(prefs.removeObserver) ||
    !isFunction(prefs.setStringPref)
  ) {
    return null;
  }
  return prefs as NativePrefs;
};

const readStringPref = (prefs: NativePrefs, name: string): string => {
  try {
    const value = Reflect.apply(prefs.getStringPref, prefs, [name, ""]);
    return typeof value === "string" && value.length <= PREF_VALUE_MAX_LENGTH
      ? value
      : "";
  } catch {
    return "";
  }
};

const readAddonsArea = (customizableUi: NativeRecord): string => {
  try {
    const value = customizableUi.AREA_ADDONS;
    return typeof value === "string" && value !== ""
      ? value
      : FALLBACK_ADDONS_AREA;
  } catch {
    return FALLBACK_ADDONS_AREA;
  }
};

const isExtensionWidgetId = (
  customizableUi: NativeRecord,
  widgetId: string,
): boolean => {
  if (isFunction(customizableUi.isWebExtensionWidget)) {
    try {
      return (
        Reflect.apply(customizableUi.isWebExtensionWidget, customizableUi, [
          widgetId,
        ]) === true
      );
    } catch {
      // Fall through to the suffix check below.
    }
  }
  return widgetId.endsWith(EXTENSION_WIDGET_SUFFIX);
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
      isAvailable: (value: unknown) => value !== null,
      name: "toolbar-widgets.prefs",
      read: (window: NativeRecord) => readPrefs(window),
      requirement: "optional" as const,
      symbol:
        "window.Services.prefs.getStringPref.setStringPref.clearUserPref.addObserver.removeObserver",
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

const readSpecialKind = (widgetId: string): CustomizeSpecialKind | null => {
  if (widgetId.startsWith("customizableui-special-")) {
    const match = /^customizableui-special-(spring|spacer|separator)/u.exec(
      widgetId,
    );
    return match ? (match[1] as CustomizeSpecialKind) : null;
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
  let prefObserverAttached = false;
  let lastSerializedWidgets = "";
  let lastSnapshot: ToolbarWidgetsSnapshot =
    createUnavailableToolbarWidgetsSnapshot();
  let persistedLayout: CustomizeLayout | null = null;
  let persistedStyle: CustomizeStyle = createDefaultToolbarStyle();
  let nextPaletteTokenSequence = 0;
  const paletteTokenByKey = new Map<string, string>();
  const paletteTargetByToken = new Map<string, CustomizeLayoutEntry>();
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

  const windowKindIsPrivate = boundary.snapshot().windowKind === "private";

  const readWrapper = (
    customizableUi: NativeRecord,
    widgetId: string,
  ): NativeRecord | null => {
    try {
      const candidate = Reflect.apply(
        customizableUi.getWidget as (...args: unknown[]) => unknown,
        customizableUi,
        [widgetId],
      );
      return isNativeRecord(candidate) ? candidate : null;
    } catch {
      return null;
    }
  };

  const widgetSnapshotForSpecial = (
    kind: ToolbarWidgetKind,
  ): ToolbarWidgetSnapshot =>
    Object.freeze({
      badgeBackground: "",
      badgeText: "",
      badgeTextColor: "",
      disabled: false,
      fenneviaAction: "",
      handle: "",
      icon: "",
      iconUrl: "",
      kind,
      label: "",
      missing: false,
      tooltip: "",
    });

  const widgetSnapshotForFennevia = (
    id: FenneviaToolbarAction,
  ): ToolbarWidgetSnapshot => {
    const presentation = fenneviaWidgetPresentation.get(id);
    return Object.freeze({
      badgeBackground: "",
      badgeText: "",
      badgeTextColor: "",
      disabled: false,
      fenneviaAction: id,
      handle: "",
      icon: presentation?.icon ?? "generic",
      iconUrl: "",
      kind: "fennevia" as const,
      label: presentation?.label ?? "Fennevia control",
      missing: false,
      tooltip: presentation?.tooltip ?? presentation?.label ?? "",
    });
  };

  const widgetSnapshotForMissing = (
    customizableUi: NativeRecord,
    widgetId: string,
  ): ToolbarWidgetSnapshot => {
    const wrapper = readWrapper(customizableUi, widgetId);
    const isExtension =
      wrapper?.webExtension === true ||
      isExtensionWidgetId(customizableUi, widgetId);
    const label =
      boundString(readRecordString(wrapper, "label"), LABEL_MAX_LENGTH) ||
      (isExtension ? "Extension" : "Toolbar item");
    return Object.freeze({
      badgeBackground: "",
      badgeText: "",
      badgeTextColor: "",
      disabled: true,
      fenneviaAction: "",
      handle: "",
      icon: isExtension
        ? "extension"
        : (builtinIconTokenByWidgetId.get(widgetId) ?? "generic"),
      iconUrl: "",
      kind: isExtension ? ("extension-action" as const) : ("built-in" as const),
      label,
      missing: true,
      tooltip: label,
    });
  };

  const readWidgetEntryForId = (
    customizableUi: NativeRecord,
    widgetId: string,
  ): Readonly<{ node: NativeRecord | null; widget: ToolbarWidgetSnapshot }> => {
    const ownerWindow = requireWindow();
    const node = getDocumentElementById(ownerWindow, widgetId);
    if (!isNativeNode(node) || !isNodeConnected(node)) {
      return Object.freeze({
        node: null,
        widget: widgetSnapshotForMissing(customizableUi, widgetId),
      });
    }
    const wrapper = readWrapper(customizableUi, widgetId);
    const isExtension =
      wrapper?.webExtension === true ||
      isExtensionWidgetId(customizableUi, widgetId);
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
      return Object.freeze({
        node,
        widget: Object.freeze({
          badgeBackground: badge.background,
          badgeText: badge.text,
          badgeTextColor: badge.textColor,
          disabled: actionButton
            ? readNodeDisabled(actionButton)
            : readNodeDisabled(node),
          fenneviaAction: "",
          handle,
          icon: "extension",
          iconUrl: actionButton ? readExtensionIconUrl(actionButton) : "",
          kind: "extension-action" as const,
          label,
          missing: false,
          tooltip:
            boundString(wrapperTooltip || nodeTooltip, TOOLTIP_MAX_LENGTH) ||
            label,
        }),
      });
    }

    const label =
      boundString(nodeLabel || wrapperLabel, LABEL_MAX_LENGTH) ||
      boundString(nodeTooltip || wrapperTooltip, LABEL_MAX_LENGTH) ||
      "Toolbar item";
    return Object.freeze({
      node,
      widget: Object.freeze({
        badgeBackground: "",
        badgeText: "",
        badgeTextColor: "",
        disabled: readNodeDisabled(node),
        fenneviaAction: "",
        handle,
        icon: builtinIconTokenByWidgetId.get(widgetId) ?? "generic",
        iconUrl: "",
        kind: "built-in" as const,
        label,
        missing: false,
        tooltip: boundString(
          nodeTooltip || wrapperTooltip || label,
          TOOLTIP_MAX_LENGTH,
        ),
      }),
    });
  };

  const readLayoutEntrySnapshot = (
    customizableUi: NativeRecord,
    entry: CustomizeLayoutEntry,
  ): Readonly<{ node: NativeRecord | null; widget: ToolbarWidgetSnapshot }> => {
    if (entry.type === "special") {
      return Object.freeze({
        node: null,
        widget: widgetSnapshotForSpecial(entry.kind),
      });
    }
    if (entry.type === "fennevia") {
      return Object.freeze({
        node: null,
        widget: widgetSnapshotForFennevia(entry.id),
      });
    }
    return readWidgetEntryForId(customizableUi, entry.id);
  };

  const createDefaultLayoutFromNavbar = (
    customizableUi: NativeRecord,
  ): CustomizeLayout => {
    let widgetIds: unknown;
    try {
      widgetIds = Reflect.apply(
        customizableUi.getWidgetIdsInArea as (...args: unknown[]) => unknown,
        customizableUi,
        [NAVBAR_AREA],
      );
    } catch {
      widgetIds = null;
    }
    const entries: CustomizeLayoutEntry[] = [];
    if (Array.isArray(widgetIds)) {
      for (const widgetId of widgetIds) {
        if (typeof widgetId !== "string" || skippedWidgetIdSet.has(widgetId)) {
          continue;
        }
        const specialKind = readSpecialKind(widgetId);
        if (specialKind) {
          entries.push(
            Object.freeze({ kind: specialKind, type: "special" as const }),
          );
          continue;
        }
        if (!isCustomizeWidgetId(widgetId)) {
          continue;
        }
        entries.push(Object.freeze({ id: widgetId, type: "widget" as const }));
      }
    }
    return createCustomizeLayout({ top: entries });
  };

  const paletteTokenFor = (key: string): string => {
    const existing = paletteTokenByKey.get(key);
    if (existing) {
      return existing;
    }
    const token = `palette-${++nextPaletteTokenSequence}`;
    paletteTokenByKey.set(key, token);
    return token;
  };

  const readPlacedWidgetIds = (
    customizableUi: NativeRecord,
  ): readonly string[] => {
    let areas: unknown;
    try {
      areas = customizableUi.areas;
    } catch {
      areas = undefined;
    }
    const areaList = Array.isArray(areas) ? areas : [NAVBAR_AREA];
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const area of areaList) {
      if (typeof area !== "string") {
        continue;
      }
      let widgetIds: unknown;
      try {
        widgetIds = Reflect.apply(
          customizableUi.getWidgetIdsInArea as (...args: unknown[]) => unknown,
          customizableUi,
          [area],
        );
      } catch {
        continue;
      }
      if (!Array.isArray(widgetIds)) {
        continue;
      }
      for (const widgetId of widgetIds) {
        if (typeof widgetId === "string" && !seen.has(widgetId)) {
          seen.add(widgetId);
          ids.push(widgetId);
        }
      }
    }
    return ids;
  };

  const readUnusedWidgetIds = (
    customizableUi: NativeRecord,
  ): readonly string[] => {
    if (!isFunction(customizableUi.getUnusedWidgets)) {
      return [];
    }
    const ownerWindow = nativeWindow;
    const navToolbox = ownerWindow?.gNavToolbox;
    const palette = isNativeRecord(navToolbox) ? navToolbox.palette : undefined;
    if (!isNativeRecord(palette)) {
      return [];
    }
    try {
      const wrappers = Reflect.apply(
        customizableUi.getUnusedWidgets,
        customizableUi,
        [palette],
      );
      if (!Array.isArray(wrappers)) {
        return [];
      }
      const ids: string[] = [];
      for (const wrapper of wrappers) {
        if (isNativeRecord(wrapper) && typeof wrapper.id === "string") {
          ids.push(wrapper.id);
        }
      }
      return ids;
    } catch {
      return [];
    }
  };

  const paletteEntryForWidgetId = (
    customizableUi: NativeRecord,
    widgetId: string,
  ): ToolbarPaletteEntrySnapshot | null => {
    if (
      skippedWidgetIdSet.has(widgetId) ||
      readSpecialKind(widgetId) !== null ||
      !isCustomizeWidgetId(widgetId)
    ) {
      return null;
    }
    const wrapper = readWrapper(customizableUi, widgetId);
    if (windowKindIsPrivate && wrapper?.showInPrivateBrowsing === false) {
      return null;
    }
    const isExtension =
      wrapper?.webExtension === true ||
      isExtensionWidgetId(customizableUi, widgetId);
    const ownerWindow = requireWindow();
    const node = getDocumentElementById(ownerWindow, widgetId);
    const liveNode = isNativeNode(node) && isNodeConnected(node) ? node : null;
    let label: string;
    let iconUrl = "";
    if (isExtension) {
      const actionButton = liveNode
        ? readExtensionActionButton(liveNode)
        : null;
      iconUrl = actionButton ? readExtensionIconUrl(actionButton) : "";
      label =
        (liveNode ? readExtensionLabel(liveNode) : "") ||
        boundString(readRecordString(wrapper, "label"), LABEL_MAX_LENGTH) ||
        "Extension";
    } else {
      label =
        boundString(
          (liveNode ? readAttribute(liveNode, "label") : "") ||
            readRecordString(wrapper, "label"),
          LABEL_MAX_LENGTH,
        ) ||
        boundString(
          (liveNode ? readAttribute(liveNode, "tooltiptext") : "") ||
            readRecordString(wrapper, "tooltiptext"),
          LABEL_MAX_LENGTH,
        ) ||
        "Toolbar item";
    }
    const token = paletteTokenFor(`w:${widgetId}`);
    paletteTargetByToken.set(
      token,
      Object.freeze({ id: widgetId, type: "widget" as const }),
    );
    return Object.freeze({
      icon: isExtension
        ? "extension"
        : (builtinIconTokenByWidgetId.get(widgetId) ?? "generic"),
      iconUrl,
      kind: isExtension ? ("extension-action" as const) : ("built-in" as const),
      label,
      token,
    });
  };

  const buildPalette = (
    customizableUi: NativeRecord,
    layout: CustomizeLayout,
  ): readonly ToolbarPaletteEntrySnapshot[] => {
    paletteTargetByToken.clear();
    const entries: ToolbarPaletteEntrySnapshot[] = [];
    const placedInLayout = new Set<string>();
    const fenneviaPlaced = new Set<string>();
    for (const zone of toolbarZoneNames) {
      for (const entry of layout.zones[zone]) {
        if (entry.type === "widget") {
          placedInLayout.add(entry.id);
        } else if (entry.type === "fennevia") {
          fenneviaPlaced.add(entry.id);
        }
      }
    }
    for (const id of fenneviaToolbarActions) {
      if (fenneviaPlaced.has(id)) {
        continue;
      }
      const presentation = fenneviaWidgetPresentation.get(id);
      const token = paletteTokenFor(`f:${id}`);
      paletteTargetByToken.set(
        token,
        Object.freeze({ id, type: "fennevia" as const }),
      );
      entries.push(
        Object.freeze({
          icon: presentation?.icon ?? "generic",
          iconUrl: "",
          kind: "fennevia" as const,
          label: presentation?.label ?? "Fennevia control",
          token,
        }),
      );
    }
    const candidateIds = [
      ...readPlacedWidgetIds(customizableUi),
      ...readUnusedWidgetIds(customizableUi),
    ];
    const seen = new Set<string>();
    for (const widgetId of candidateIds) {
      if (
        seen.has(widgetId) ||
        placedInLayout.has(widgetId) ||
        entries.length >= PALETTE_MAX_ENTRIES
      ) {
        continue;
      }
      seen.add(widgetId);
      const entry = paletteEntryForWidgetId(customizableUi, widgetId);
      if (entry) {
        entries.push(entry);
      }
    }
    const specialLabels: ReadonlyArray<
      readonly ["separator" | "spacer" | "spring", string]
    > = [
      ["separator", "Separator"],
      ["spacer", "Space"],
      ["spring", "Flexible space"],
    ];
    for (const [kind, label] of specialLabels) {
      const token = paletteTokenFor(`s:${kind}`);
      paletteTargetByToken.set(
        token,
        Object.freeze({ kind, type: "special" as const }),
      );
      entries.push(
        Object.freeze({
          icon: "",
          iconUrl: "",
          kind: "special" as const,
          label,
          token,
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
    const ownerWindow = requireWindow();
    const customizableUi = readCustomizableUi(ownerWindow);
    if (!customizableUi) {
      paletteTargetByToken.clear();
      observeWidgetNodes([]);
      return Object.freeze({
        serialized: "unavailable",
        snapshot: createUnavailableToolbarWidgetsSnapshot(),
      });
    }
    const layout =
      persistedLayout ?? createDefaultLayoutFromNavbar(customizableUi);
    const zoneEntries: Array<
      readonly [ToolbarZoneName, readonly ToolbarWidgetSnapshot[]]
    > = [];
    const nodes: Array<NativeRecord | null> = [];
    const nextHandleIds = new Set<string>();
    for (const zone of toolbarZoneNames) {
      const widgets: ToolbarWidgetSnapshot[] = [];
      for (const entry of layout.zones[zone]) {
        const built = readLayoutEntrySnapshot(customizableUi, entry);
        widgets.push(built.widget);
        nodes.push(built.node);
        if (built.widget.handle !== "") {
          nextHandleIds.add(built.widget.handle);
        }
      }
      zoneEntries.push([zone, Object.freeze(widgets)]);
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
    observeWidgetNodes(nodes);
    const prefs = readPrefs(ownerWindow);
    const snapshot: ToolbarWidgetsSnapshot = Object.freeze({
      available: true,
      canEdit: prefs !== null,
      layoutCustomized: persistedLayout !== null,
      palette: buildPalette(customizableUi, layout),
      style: copyToolbarStyleSnapshot(persistedStyle),
      zones: Object.freeze(
        Object.fromEntries(zoneEntries),
      ) as ToolbarWidgetZones,
    });
    return Object.freeze({
      serialized: JSON.stringify(snapshot),
      snapshot,
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

  const loadPersistedState = (): void => {
    const ownerWindow = nativeWindow;
    if (!ownerWindow) {
      return;
    }
    const prefs = readPrefs(ownerWindow);
    if (!prefs) {
      persistedLayout = null;
      persistedStyle = createDefaultToolbarStyle();
      return;
    }
    persistedLayout = parseCustomizeLayout(readStringPref(prefs, LAYOUT_PREF));
    persistedStyle =
      parseCustomizeStyle(readStringPref(prefs, STYLE_PREF)) ??
      createDefaultToolbarStyle();
  };

  const prefObserver = Object.freeze({
    observe: () => {
      if (disposed) {
        return;
      }
      loadPersistedState();
      scheduleRefresh();
    },
  });

  const detachPrefObserver = (): void => {
    if (!prefObserverAttached) {
      return;
    }
    prefObserverAttached = false;
    const ownerWindow = nativeWindow;
    const prefs = ownerWindow ? readPrefs(ownerWindow) : null;
    if (!prefs) {
      return;
    }
    try {
      Reflect.apply(prefs.removeObserver, prefs, [
        CUSTOMIZE_PREF_DOMAIN,
        prefObserver,
      ]);
    } catch {
      // Disposal continues; the observer object is inert once disposed.
    }
  };

  const requirePrefsForEdit = (): NativePrefs => {
    const prefs = readPrefs(requireWindow());
    if (!prefs) {
      throw createToolbarWidgetsError(
        boundary,
        "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_UNAVAILABLE",
        "firefox-toolbar-widgets-edit",
        "window.Services.prefs",
      );
    }
    return prefs;
  };

  const persistLayout = (layout: CustomizeLayout): void => {
    const prefs = requirePrefsForEdit();
    Reflect.apply(prefs.setStringPref, prefs, [
      LAYOUT_PREF,
      serializeCustomizeLayout(layout),
    ]);
    persistedLayout = layout;
  };

  const persistStyle = (style: CustomizeStyle): void => {
    const prefs = requirePrefsForEdit();
    Reflect.apply(prefs.setStringPref, prefs, [
      STYLE_PREF,
      serializeCustomizeStyle(style),
    ]);
    persistedStyle = style;
  };

  const adoptWidgetForPlacement = (
    customizableUi: NativeRecord,
    layout: CustomizeLayout,
    widgetId: string,
  ): CustomizeLayout => {
    let placementArea = "";
    if (isFunction(customizableUi.getPlacementOfWidget)) {
      try {
        const placement = Reflect.apply(
          customizableUi.getPlacementOfWidget,
          customizableUi,
          [widgetId],
        );
        if (isNativeRecord(placement) && typeof placement.area === "string") {
          placementArea = placement.area;
        }
      } catch {
        placementArea = "";
      }
    }
    const needsAdoption =
      placementArea === "" || placementArea === readAddonsArea(customizableUi);
    if (!needsAdoption) {
      return layout;
    }
    if (!isFunction(customizableUi.addWidgetToArea)) {
      throw createToolbarWidgetsError(
        boundary,
        "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_UNAVAILABLE",
        "firefox-toolbar-widgets-edit",
        "window.CustomizableUI.addWidgetToArea",
      );
    }
    Reflect.apply(customizableUi.addWidgetToArea, customizableUi, [
      widgetId,
      NAVBAR_AREA,
    ]);
    return withCustomizeAdopted(layout, widgetId);
  };

  const restoreAdoptedWidget = (
    customizableUi: NativeRecord,
    layout: CustomizeLayout,
    widgetId: string,
  ): CustomizeLayout => {
    if (!layout.adopted.includes(widgetId)) {
      return layout;
    }
    if (isExtensionWidgetId(customizableUi, widgetId)) {
      // Extension widgets return to the unified extensions area instead of
      // the palette so the Firefox extensions panel keeps listing them.
      if (isFunction(customizableUi.addWidgetToArea)) {
        try {
          Reflect.apply(customizableUi.addWidgetToArea, customizableUi, [
            widgetId,
            readAddonsArea(customizableUi),
          ]);
        } catch {
          // The widget keeps its current native placement.
        }
      }
    } else if (isFunction(customizableUi.removeWidgetFromArea)) {
      try {
        Reflect.apply(customizableUi.removeWidgetFromArea, customizableUi, [
          widgetId,
        ]);
      } catch {
        // The widget keeps its current native placement.
      }
    }
    return withoutCustomizeAdopted(layout, widgetId);
  };

  const requireCustomizableUiForEdit = (): NativeRecord => {
    const customizableUi = readCustomizableUi(requireWindow());
    if (!customizableUi) {
      throw createToolbarWidgetsError(
        boundary,
        "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_UNAVAILABLE",
        "firefox-toolbar-widgets-edit",
        "window.CustomizableUI",
      );
    }
    return customizableUi;
  };

  const edit = async (
    operation: ToolbarWidgetsEditOperation,
  ): Promise<boolean> => {
    requireWindow();
    let validated: ToolbarWidgetsEditOperation;
    try {
      validated = copyToolbarWidgetsEditOperation(operation);
    } catch (error) {
      throw createToolbarWidgetsError(
        boundary,
        "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_INVALID",
        "firefox-toolbar-widgets-edit",
        "toolbar-widgets.edit",
        error,
      );
    }
    pendingActionCount += 1;
    try {
      if (validated.type === "set-style") {
        persistStyle(
          copyToolbarStyleSnapshot({ ...persistedStyle, ...validated.style }),
        );
        publishSnapshotIfChanged();
        return true;
      }
      if (validated.type === "reset-style") {
        const prefs = requirePrefsForEdit();
        try {
          Reflect.apply(prefs.clearUserPref, prefs, [STYLE_PREF]);
        } catch {
          // The pref may already be at its default value.
        }
        persistedStyle = createDefaultToolbarStyle();
        publishSnapshotIfChanged();
        return true;
      }
      const customizableUi = requireCustomizableUiForEdit();
      requirePrefsForEdit();
      if (validated.revision !== revision) {
        throw createToolbarWidgetsError(
          boundary,
          "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_STALE",
          "firefox-toolbar-widgets-edit",
          "toolbar-widgets.edit-revision",
        );
      }
      const base =
        persistedLayout ?? createDefaultLayoutFromNavbar(customizableUi);
      try {
        switch (validated.type) {
          case "add": {
            const target = paletteTargetByToken.get(validated.token);
            if (!target) {
              throw createToolbarWidgetsError(
                boundary,
                "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_INVALID",
                "firefox-toolbar-widgets-edit",
                "toolbar-widgets.palette-token",
              );
            }
            let layout = base;
            if (target.type === "widget") {
              layout = adoptWidgetForPlacement(
                customizableUi,
                layout,
                target.id,
              );
            }
            layout = addCustomizeLayoutEntry(
              layout,
              target,
              validated.zone,
              validated.index,
            );
            persistLayout(layout);
            break;
          }
          case "move": {
            persistLayout(
              moveCustomizeLayoutEntry(
                base,
                validated.fromZone,
                validated.fromIndex,
                validated.toZone,
                validated.toIndex,
              ),
            );
            break;
          }
          case "remove": {
            const entry = getCustomizeLayoutEntry(
              base,
              validated.zone,
              validated.index,
            );
            let layout = removeCustomizeLayoutEntry(
              base,
              validated.zone,
              validated.index,
            );
            if (
              entry.type === "widget" &&
              !customizeLayoutContainsWidget(layout, entry.id)
            ) {
              layout = restoreAdoptedWidget(customizableUi, layout, entry.id);
            }
            persistLayout(layout);
            break;
          }
          case "reset-layout": {
            let layout = base;
            for (const adoptedId of [...base.adopted]) {
              layout = restoreAdoptedWidget(customizableUi, layout, adoptedId);
            }
            const prefs = requirePrefsForEdit();
            try {
              Reflect.apply(prefs.clearUserPref, prefs, [LAYOUT_PREF]);
            } catch {
              // The pref may already be at its default value.
            }
            persistedLayout = null;
            break;
          }
        }
      } catch (error) {
        if (isFirefoxBridgeError(error)) {
          throw error;
        }
        throw createToolbarWidgetsError(
          boundary,
          "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_FAILED",
          "firefox-toolbar-widgets-edit",
          "toolbar-widgets.edit",
          error,
        );
      }
      publishSnapshotIfChanged();
      return true;
    } finally {
      pendingActionCount -= 1;
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
    edit,

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
    const prefs = readPrefs(requireWindow());
    if (prefs) {
      Reflect.apply(prefs.addObserver, prefs, [
        CUSTOMIZE_PREF_DOMAIN,
        prefObserver,
      ]);
      prefObserverAttached = true;
    }
    loadPersistedState();
    const built = buildSnapshot();
    lastSerializedWidgets = built.serialized;
    lastSnapshot = built.snapshot;
  } catch (error) {
    disposed = true;
    detachPrefObserver();
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
      detachPrefObserver();
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
      paletteTokenByKey.clear();
      paletteTargetByToken.clear();
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
        widgetCount: toolbarZoneNames.reduce(
          (count, zone) => count + lastSnapshot.zones[zone].length,
          0,
        ),
      });
    },

    toolbarWidgets: publicBridge,
  });
}
