// SPDX-License-Identifier: MPL-2.0
import { createToolbarWidgetPopupActions } from "./popup-actions.ts";
import {
  copyToolbarStyleSnapshot,
  copyShellPanelConfigSnapshot,
  copyToolbarWidgetsEditOperation,
  createDefaultShellPanelConfig,
  createDefaultToolbarStyle,
  createUnavailableToolbarWidgetsSnapshot,
  projectWidgetIds,
  toolbarZoneNames,
  type BrowserToolbarWidgetsBridge,
  type FenneviaToolbarAction,
  type ProjectWidgetId,
  type ShellPanelConfigSnapshot,
  type ToolbarPaletteEntrySnapshot,
  type ToolbarWidgetKind,
  type ToolbarWidgetPartSnapshot,
  type ToolbarWidgetSnapshot,
  type ToolbarWidgetZones,
  type ToolbarLayoutNodeSnapshot,
  type ToolbarLayoutZonesSnapshot,
  type ToolbarWidgetsEditOperation,
  type ToolbarWidgetsPopupEvent,
  type ToolbarWidgetsSnapshot,
  type ToolbarWidgetsStateEvent,
  type ToolbarZoneName,
} from "../../app/toolbar-widgets-state.ts";
import {
  isCustomizeWidgetId,
  parseCustomizeLayout,
  parseCustomizePanels,
  parseCustomizeStyle,
  serializeCustomizePanels,
  serializeCustomizeStyle,
  type CustomizeLayout,
  type CustomizePanels,
  type CustomizeStyle,
} from "../customize-model.ts";
import {
  composableLayoutContainsFirefoxWidget,
  countComposableLayoutTarget,
  createComposableCustomizeLayout,
  createDefaultComposableCustomizeLayout,
  findComposableLayoutTarget,
  getComposableLayoutNode,
  hasAccessibleComposableCustomize,
  insertComposableLayoutContainer,
  insertComposableLayoutTarget,
  insertComposableLayoutWrapper,
  isComposableSingletonTarget,
  migrateCustomizeLayoutV1,
  moveComposableLayoutNode,
  parseComposableCustomizeLayout,
  removeComposableLayoutNode,
  serializeComposableCustomizeLayout,
  setComposableLayoutContainerDirection,
  setComposableMultiplePlacements,
  withComposableAdopted,
  withoutComposableAdopted,
  type ComposableCustomizeLayout,
  type ComposableLayoutNode,
  type ComposableLayoutTarget,
  type ComposableLayoutWrapperKind,
} from "../customize-layout.ts";
import {
  isFirefoxBridgeError,
  type FirefoxBridgeBoundary,
  type FirefoxCapabilitySnapshot,
  type IdempotentDisposer,
} from "../bridge-boundary.ts";
import {
  NAVBAR_AREA,
  LAYOUT_PREF,
  PANELS_PREF,
  STYLE_PREF,
  CUSTOMIZE_PREF_DOMAIN,
  PALETTE_MAX_ENTRIES,
  LABEL_MAX_LENGTH,
  TOOLTIP_MAX_LENGTH,
  LISTENER_OPTIONS,
  skippedWidgetIdSet,
  builtinIconTokenByWidgetId,
  compoundToolbarWidgetPartsByWidgetId,
  TOOLBAR_FLUENT_RESOURCE_IDS,
  builtinFluentIdByWidgetId,
  resolvePinnedBuiltinIconUrl,
  fenneviaWidgetPresentation,
  isNativeRecord,
  isFunction,
  isNativeNode,
  readCustomizableUi,
  readPrefs,
  readStringPref,
  readAddonsArea,
  isExtensionWidgetId,
  evaluateToolbarWidgetCapabilities,
  createToolbarWidgetsError,
  readSpecialKind,
  readRecordString,
  getDocumentElementById,
  querySelectorOn,
  readAttribute,
  isAllowedPresentationIconUrl,
  readFirstCollectionNode,
  readStyleListStyleImage,
  collectBuiltinIconUrlsFromRule,
  formatFluentFromLocalization,
  collectFluentResourceIds,
  readPresentationText,
  isNodeConnected,
  readExtensionActionButton,
  readExtensionIconUrl,
  readExtensionBadge,
  readExtensionLabel,
  readNodeDisabled,
} from "./support.ts";
import type { NativeRecord, NativeNode, NativePrefs } from "./support.ts";

function isComposableLayoutError(error: unknown): error is Error {
  if (
    !(error instanceof Error) ||
    error.name !== "FenneviaComposableLayoutError"
  ) {
    return false;
  }
  return (
    Reflect.get(error, "fenneviaPhase") === "customize-layout" &&
    typeof Reflect.get(error, "fenneviaCode") === "string"
  );
}

const projectWidgetPresentation: ReadonlyMap<
  ProjectWidgetId,
  Readonly<{ icon: string; label: string; tooltip: string }>
> = new Map([
  [
    "address-launcher",
    {
      icon: "search",
      label: "Address launcher",
      tooltip: "Open address and search",
    },
  ],
  [
    "application-menu",
    {
      icon: "menu",
      label: "Firefox menu",
      tooltip: "Open the Firefox application menu",
    },
  ],
  ["back", { icon: "back", label: "Back", tooltip: "Go back" }],
  [
    "bookmarks",
    { icon: "bookmark", label: "Bookmarks", tooltip: "Browse bookmarks" },
  ],
  [
    "close-window",
    { icon: "close", label: "Close window", tooltip: "Close this window" },
  ],
  [
    "customize-shell",
    {
      icon: "customize",
      label: "Customize Fennevia",
      tooltip: "Customize panels and widgets",
    },
  ],
  [
    "downloads-status",
    {
      icon: "download",
      label: "Download status",
      tooltip: "Show download progress and status",
    },
  ],
  [
    "extensions",
    {
      icon: "extension",
      label: "Extensions",
      tooltip: "Open Unified Extensions",
    },
  ],
  ["forward", { icon: "forward", label: "Forward", tooltip: "Go forward" }],
  ["home", { icon: "home", label: "Home", tooltip: "Open the home page" }],
  [
    "minimize-window",
    {
      icon: "minimize",
      label: "Minimize window",
      tooltip: "Minimize this window",
    },
  ],
  ["new-tab", { icon: "plus", label: "New tab", tooltip: "Open a new tab" }],
  [
    "private-indicator",
    {
      icon: "private",
      label: "Private browsing",
      tooltip: "Private browsing window",
    },
  ],
  [
    "reload-stop",
    {
      icon: "reload",
      label: "Reload or stop",
      tooltip: "Reload or stop loading",
    },
  ],
  [
    "settings",
    { icon: "settings", label: "Settings", tooltip: "Open Firefox settings" },
  ],
  [
    "show-bookmarks",
    {
      icon: "bookmark",
      label: "Show bookmarks panel",
      tooltip: "Reveal the Fennevia bookmarks panel",
    },
  ],
  [
    "show-downloads",
    {
      icon: "download",
      label: "Open Firefox downloads",
      tooltip: "Open the Firefox downloads panel",
    },
  ],
  [
    "show-translate",
    {
      icon: "translate",
      label: "Translate this page",
      tooltip: "Open Firefox built-in translations",
    },
  ],
  ["tabs", { icon: "tab", label: "Tabs", tooltip: "Browse open tabs" }],
  [
    "toggle-maximize-window",
    {
      icon: "maximize",
      label: "Maximize or restore window",
      tooltip: "Maximize or restore this window",
    },
  ],
  [
    "trust",
    {
      icon: "shield",
      label: "Site trust",
      tooltip: "Open site information and protections",
    },
  ],
]);

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
  let persistedLayout: ComposableCustomizeLayout | null = null;
  let persistedLegacyLayout: CustomizeLayout | null = null;
  let persistedPanels: CustomizePanels | null = null;
  let persistedStyle: CustomizeStyle = createDefaultToolbarStyle();
  let nextPaletteTokenSequence = 0;
  const paletteTokenByKey = new Map<string, string>();
  const paletteTargetByToken = new Map<
    string,
    | ComposableLayoutTarget
    | Readonly<{ direction: "column" | "row"; source: "container" }>
    | Readonly<{ kind: ComposableLayoutWrapperKind; source: "wrapper" }>
  >();
  let mutationObserver: NativeRecord | null = null;
  let builtinIconUrlCache: Map<string, string> | null = null;
  let fluentLocalization: NativeRecord | null | undefined;
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

  const popupActions = createToolbarWidgetPopupActions({
    boundary,
    getWindowOrNull: () => nativeWindow,
    isDisposed: () => disposed,
    onActionDelta(delta) {
      pendingActionCount += delta;
    },
    popupListeners,
    registry,
    requireProjectHost,
    requireWindow,
  });
  const { invoke, onPopupHidden, onPopupShown } = popupActions;

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

  const readPaletteNode = (widgetId: string): NativeNode | null => {
    const ownerWindow = nativeWindow;
    if (!ownerWindow) {
      return null;
    }
    const toolbox = ownerWindow.gNavToolbox;
    if (!isNativeRecord(toolbox)) {
      return null;
    }
    const palette = toolbox.palette;
    if (
      !isNativeRecord(palette) ||
      !isFunction(palette.getElementsByAttribute)
    ) {
      return null;
    }
    try {
      const found = Reflect.apply(palette.getElementsByAttribute, palette, [
        "id",
        widgetId,
      ]);
      return readFirstCollectionNode(found);
    } catch {
      return null;
    }
  };

  const readPresentationNode = (widgetId: string): NativeNode | null => {
    const ownerWindow = nativeWindow;
    if (!ownerWindow) {
      return null;
    }
    const inDocument = getDocumentElementById(ownerWindow, widgetId);
    if (isNativeNode(inDocument)) {
      return inDocument;
    }
    return readPaletteNode(widgetId);
  };

  const getSyncFluentLocalization = (): NativeRecord | null => {
    if (fluentLocalization !== undefined) {
      return fluentLocalization;
    }
    fluentLocalization = null;
    const ownerWindow = nativeWindow;
    if (!ownerWindow || !isFunction(ownerWindow.Localization)) {
      return null;
    }
    const document = ownerWindow.document;
    const resourceIds = isNativeRecord(document)
      ? collectFluentResourceIds(document)
      : [...TOOLBAR_FLUENT_RESOURCE_IDS];
    try {
      const created = Reflect.construct(ownerWindow.Localization, [
        resourceIds,
        true,
      ]);
      if (
        !isNativeRecord(created) ||
        (!isFunction(created.formatMessagesSync) &&
          !isFunction(created.formatValueSync))
      ) {
        return null;
      }
      fluentLocalization = created;
      return created;
    } catch {
      return null;
    }
  };

  const formatFluentValue = (l10nId: string): string => {
    if (!l10nId) {
      return "";
    }
    const syncLocalization = getSyncFluentLocalization();
    if (syncLocalization) {
      const fromSync = formatFluentFromLocalization(syncLocalization, l10nId);
      if (fromSync) {
        return fromSync;
      }
    }
    const ownerWindow = nativeWindow;
    if (!ownerWindow) {
      return "";
    }
    const document = ownerWindow.document;
    if (!isNativeRecord(document)) {
      return "";
    }
    const l10n = document.l10n;
    if (!isNativeRecord(l10n)) {
      return "";
    }
    return formatFluentFromLocalization(l10n, l10nId);
  };

  const readLocalizedProperty = (
    customizableUi: NativeRecord,
    widgetId: string,
    property: "label" | "tooltiptext",
  ): string => {
    if (!isFunction(customizableUi.getLocalizedProperty)) {
      return "";
    }
    try {
      const value = Reflect.apply(
        customizableUi.getLocalizedProperty,
        customizableUi,
        [widgetId, property],
      );
      if (typeof value !== "string" || value === "") {
        return "";
      }
      return readPresentationText(value, LABEL_MAX_LENGTH, widgetId);
    } catch {
      return "";
    }
  };

  const resolveWidgetLabel = (
    customizableUi: NativeRecord,
    widgetId: string,
    wrapper: NativeRecord | null,
    node: NativeNode | null,
    isExtension: boolean,
  ): string => {
    const nodeLabel = node
      ? readPresentationText(
          readAttribute(node, "label") || readRecordString(node, "label"),
          LABEL_MAX_LENGTH,
          widgetId,
        )
      : "";
    const nodeTitle = node
      ? readPresentationText(
          readAttribute(node, "title") || readRecordString(node, "title"),
          LABEL_MAX_LENGTH,
          widgetId,
        )
      : "";
    const nodeTooltip = node
      ? readPresentationText(
          readAttribute(node, "tooltiptext") ||
            readRecordString(node, "tooltiptext"),
          LABEL_MAX_LENGTH,
          widgetId,
        )
      : "";
    const wrapperLabel = readPresentationText(
      readRecordString(wrapper, "label"),
      LABEL_MAX_LENGTH,
      widgetId,
    );
    const wrapperTooltip = readPresentationText(
      readRecordString(wrapper, "tooltiptext"),
      LABEL_MAX_LENGTH,
      widgetId,
    );
    const fluentFromNode = node
      ? formatFluentValue(readAttribute(node, "data-l10n-id"))
      : "";
    const fluentFromMap = formatFluentValue(
      builtinFluentIdByWidgetId.get(widgetId) ?? "",
    );
    return (
      nodeLabel ||
      nodeTitle ||
      wrapperLabel ||
      fluentFromNode ||
      readLocalizedProperty(customizableUi, widgetId, "label") ||
      fluentFromMap ||
      nodeTooltip ||
      wrapperTooltip ||
      readLocalizedProperty(customizableUi, widgetId, "tooltiptext") ||
      (isExtension ? "Extension" : "Toolbar item")
    );
  };

  const resolveWidgetTooltip = (
    widgetId: string,
    wrapper: NativeRecord | null,
    node: NativeNode | null,
    label: string,
  ): string => {
    const nodeTooltip = node
      ? readPresentationText(
          readAttribute(node, "tooltiptext") ||
            readRecordString(node, "tooltiptext"),
          TOOLTIP_MAX_LENGTH,
          widgetId,
        )
      : "";
    const nodeTitle = node
      ? readPresentationText(
          readAttribute(node, "title") || readRecordString(node, "title"),
          TOOLTIP_MAX_LENGTH,
          widgetId,
        )
      : "";
    const wrapperTooltip = readPresentationText(
      readRecordString(wrapper, "tooltiptext"),
      TOOLTIP_MAX_LENGTH,
      widgetId,
    );
    return nodeTooltip || nodeTitle || wrapperTooltip || label;
  };

  const collectBuiltinIconUrlsFromDocument = (): Map<string, string> => {
    const collected = new Map<string, string>();
    const ownerWindow = nativeWindow;
    if (!ownerWindow) {
      return collected;
    }
    const document = ownerWindow.document;
    if (!isNativeRecord(document)) {
      return collected;
    }
    const styleSheets = document.styleSheets;
    if (
      !isNativeRecord(styleSheets) ||
      typeof styleSheets.length !== "number"
    ) {
      return collected;
    }
    const length = styleSheets.length;
    for (let index = 0; index < length; index += 1) {
      let sheet: unknown;
      try {
        sheet = styleSheets[index];
      } catch {
        continue;
      }
      if (!isNativeRecord(sheet)) {
        continue;
      }
      let rules: unknown;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      if (!isNativeRecord(rules) || typeof rules.length !== "number") {
        continue;
      }
      const ruleCount = rules.length;
      for (let ruleIndex = 0; ruleIndex < ruleCount; ruleIndex += 1) {
        collectBuiltinIconUrlsFromRule(rules[ruleIndex], collected);
      }
    }
    return collected;
  };

  const readCachedBuiltinIconUrl = (widgetId: string): string => {
    if (!builtinIconUrlCache) {
      builtinIconUrlCache = collectBuiltinIconUrlsFromDocument();
    }
    return builtinIconUrlCache.get(widgetId) ?? "";
  };

  const readComputedBuiltinIconUrl = (node: NativeNode): string => {
    const ownerWindow = nativeWindow;
    if (!ownerWindow || !isFunction(ownerWindow.getComputedStyle)) {
      return "";
    }
    const candidates: NativeRecord[] = [node];
    const nestedButton = querySelectorOn(node, "toolbarbutton");
    if (isNativeNode(nestedButton)) {
      candidates.unshift(nestedButton);
    }
    for (const candidate of candidates) {
      try {
        const style = Reflect.apply(ownerWindow.getComputedStyle, ownerWindow, [
          candidate,
        ]);
        const url = readStyleListStyleImage(style);
        if (isAllowedPresentationIconUrl(url, "builtin")) {
          return url;
        }
      } catch {
        // Disconnected palette nodes may not have computed chrome styles.
      }
    }
    return "";
  };

  const readBuiltinIconUrl = (
    widgetId: string,
    node: NativeNode | null,
  ): string => {
    if (node) {
      const computed = readComputedBuiltinIconUrl(node);
      if (computed) {
        return computed;
      }
    }
    const cached = readCachedBuiltinIconUrl(widgetId);
    if (cached) {
      return cached;
    }
    const pinned = resolvePinnedBuiltinIconUrl(
      widgetId,
      boundary.snapshot().firefoxVersion,
    );
    return isAllowedPresentationIconUrl(pinned, "builtin") ? pinned : "";
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
      parts: Object.freeze([]),
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
      parts: Object.freeze([]),
      tooltip: presentation?.tooltip ?? presentation?.label ?? "",
    });
  };

  const widgetSnapshotForProject = (
    id: ProjectWidgetId,
  ): ToolbarWidgetSnapshot => {
    const presentation = projectWidgetPresentation.get(id);
    return Object.freeze({
      badgeBackground: "",
      badgeText: "",
      badgeTextColor: "",
      disabled: false,
      fenneviaAction: "",
      handle: "",
      icon: presentation?.icon ?? "generic",
      iconUrl: "",
      kind: "project" as const,
      label: presentation?.label ?? "Fennevia widget",
      missing: false,
      parts: Object.freeze([]),
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
    const presentationNode = readPresentationNode(widgetId);
    const label = resolveWidgetLabel(
      customizableUi,
      widgetId,
      wrapper,
      presentationNode,
      isExtension,
    );
    let iconUrl = "";
    if (isExtension && presentationNode) {
      const actionButton = readExtensionActionButton(presentationNode);
      iconUrl = actionButton ? readExtensionIconUrl(actionButton) : "";
    } else if (!isExtension) {
      iconUrl = readBuiltinIconUrl(widgetId, presentationNode);
    }
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
      iconUrl,
      kind: isExtension ? ("extension-action" as const) : ("built-in" as const),
      label,
      missing: true,
      parts: Object.freeze([]),
      tooltip: resolveWidgetTooltip(widgetId, wrapper, presentationNode, label),
    });
  };

  const readCompoundWidgetParts = (
    customizableUi: NativeRecord,
    widgetId: string,
    node: NativeNode,
  ): readonly ToolbarWidgetPartSnapshot[] | null => {
    const specifications = compoundToolbarWidgetPartsByWidgetId.get(widgetId);
    if (!specifications) {
      return Object.freeze([]);
    }
    const resolved: Array<
      Readonly<{
        node: NativeNode;
        specification: (typeof specifications)[number];
      }>
    > = [];
    for (const specification of specifications) {
      const candidate = querySelectorOn(node, `#${specification.nodeId}`);
      if (!isNativeNode(candidate) || !isNodeConnected(candidate)) {
        return null;
      }
      resolved.push(Object.freeze({ node: candidate, specification }));
    }
    return Object.freeze(
      resolved.map(({ node: partNode, specification }) => {
        const nodeLabel = readPresentationText(
          readAttribute(partNode, "label") ||
            readRecordString(partNode, "label"),
          LABEL_MAX_LENGTH,
          specification.nodeId,
        );
        const label =
          resolveWidgetLabel(
            customizableUi,
            specification.nodeId,
            null,
            partNode,
            false,
          ) || specification.fallbackLabel;
        return Object.freeze({
          disabled: readNodeDisabled(node) || readNodeDisabled(partNode),
          handle: registry.register(partNode),
          icon: specification.icon,
          iconUrl: readBuiltinIconUrl(specification.nodeId, partNode),
          kind: "built-in" as const,
          label,
          tooltip: resolveWidgetTooltip(
            specification.nodeId,
            null,
            partNode,
            label,
          ),
          valueText: specification.displayLabel ? nodeLabel : "",
        });
      }),
    );
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
    const compoundParts = isExtension
      ? Object.freeze([])
      : readCompoundWidgetParts(customizableUi, widgetId, node);
    if (compoundParts === null) {
      return Object.freeze({
        node,
        widget: widgetSnapshotForMissing(customizableUi, widgetId),
      });
    }
    const handle = registry.register(node);

    if (isExtension) {
      const actionButton = readExtensionActionButton(node);
      const badge = actionButton
        ? readExtensionBadge(actionButton)
        : Object.freeze({ background: "", text: "", textColor: "" });
      const label =
        readExtensionLabel(node) ||
        resolveWidgetLabel(customizableUi, widgetId, wrapper, node, true);
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
          parts: Object.freeze([]),
          tooltip: resolveWidgetTooltip(widgetId, wrapper, node, label),
        }),
      });
    }

    const label = resolveWidgetLabel(
      customizableUi,
      widgetId,
      wrapper,
      node,
      false,
    );
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
        iconUrl: readBuiltinIconUrl(widgetId, node),
        kind: "built-in" as const,
        label,
        missing: false,
        parts: compoundParts,
        tooltip: resolveWidgetTooltip(widgetId, wrapper, node, label),
      }),
    });
  };

  const resolveComposableLayout = (): ComposableCustomizeLayout => {
    if (persistedLayout) {
      return persistedLayout;
    }
    const sidePanelLayout = (persistedPanels ?? createDefaultShellPanelConfig())
      .sidePanelLayout;
    return persistedLegacyLayout
      ? migrateCustomizeLayoutV1(persistedLegacyLayout, sidePanelLayout)
      : createDefaultComposableCustomizeLayout(sidePanelLayout);
  };

  const readComposableLayoutNodeSnapshot = (
    customizableUi: NativeRecord,
    node: ComposableLayoutNode,
    observedNodes: Array<NativeRecord | null>,
    nextHandleIds: Set<string>,
  ): ToolbarLayoutNodeSnapshot => {
    if (node.type === "container") {
      return Object.freeze({
        children: Object.freeze(
          node.children.map((child) =>
            readComposableLayoutNodeSnapshot(
              customizableUi,
              child,
              observedNodes,
              nextHandleIds,
            ),
          ),
        ),
        direction: node.direction,
        instanceId: node.instanceId,
        type: "container" as const,
      });
    }
    if (node.type === "wrapper") {
      return Object.freeze({
        children: Object.freeze(
          node.children.map((child) =>
            readComposableLayoutNodeSnapshot(
              customizableUi,
              child,
              observedNodes,
              nextHandleIds,
            ),
          ),
        ),
        instanceId: node.instanceId,
        kind: node.kind,
        type: "wrapper" as const,
      });
    }
    let built: Readonly<{
      node: NativeRecord | null;
      widget: ToolbarWidgetSnapshot;
    }>;
    let projectId: ProjectWidgetId | "" = "";
    if (node.target.source === "project") {
      projectId = node.target.id;
      built = Object.freeze({
        node: null,
        widget: widgetSnapshotForProject(node.target.id),
      });
    } else if (node.target.source === "special") {
      built = Object.freeze({
        node: null,
        widget: widgetSnapshotForSpecial(node.target.kind),
      });
    } else {
      built = readWidgetEntryForId(customizableUi, node.target.id);
    }
    observedNodes.push(built.node);
    if (built.widget.handle !== "") {
      nextHandleIds.add(built.widget.handle);
    }
    for (const part of built.widget.parts) {
      nextHandleIds.add(part.handle);
    }
    return Object.freeze({
      instanceId: node.instanceId,
      projectId,
      type: "item" as const,
      widget: built.widget,
    });
  };

  const flattenToolbarLayoutWidgets = (
    nodes: readonly ToolbarLayoutNodeSnapshot[],
  ): readonly ToolbarWidgetSnapshot[] => {
    const widgets: ToolbarWidgetSnapshot[] = [];
    const visit = (children: readonly ToolbarLayoutNodeSnapshot[]): void => {
      for (const child of children) {
        if (child.type !== "item") {
          visit(child.children);
        } else if (child.projectId === "") {
          widgets.push(child.widget);
        } else if (
          child.projectId === "show-bookmarks" ||
          child.projectId === "show-downloads" ||
          child.projectId === "show-translate"
        ) {
          widgets.push(widgetSnapshotForFennevia(child.projectId));
        }
      }
    };
    visit(nodes);
    return Object.freeze(widgets);
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
    const presentationNode = readPresentationNode(widgetId);
    const liveNode =
      isNativeNode(presentationNode) && isNodeConnected(presentationNode)
        ? presentationNode
        : null;
    let label: string;
    let iconUrl: string;
    if (isExtension) {
      const actionButton = liveNode
        ? readExtensionActionButton(liveNode)
        : presentationNode
          ? readExtensionActionButton(presentationNode)
          : null;
      iconUrl = actionButton ? readExtensionIconUrl(actionButton) : "";
      label =
        (liveNode ? readExtensionLabel(liveNode) : "") ||
        resolveWidgetLabel(
          customizableUi,
          widgetId,
          wrapper,
          presentationNode,
          true,
        );
    } else {
      label = resolveWidgetLabel(
        customizableUi,
        widgetId,
        wrapper,
        presentationNode,
        false,
      );
      iconUrl = readBuiltinIconUrl(widgetId, presentationNode);
    }
    const token = paletteTokenFor(`w:${widgetId}`);
    paletteTargetByToken.set(
      token,
      Object.freeze({ id: widgetId, source: "firefox" as const }),
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
    layout: ComposableCustomizeLayout,
  ): readonly ToolbarPaletteEntrySnapshot[] => {
    paletteTargetByToken.clear();
    const entries: ToolbarPaletteEntrySnapshot[] = [];
    const placedInLayout = new Set<string>();
    const visit = (nodes: readonly ComposableLayoutNode[]): void => {
      for (const node of nodes) {
        if (node.type !== "item") {
          visit(node.children);
        } else if (node.target.source === "firefox") {
          placedInLayout.add(node.target.id);
        }
      }
    };
    for (const zone of toolbarZoneNames) {
      visit(layout.zones[zone]);
    }
    for (const id of projectWidgetIds) {
      const target = Object.freeze({ id, source: "project" as const });
      const placed = countComposableLayoutTarget(layout, target) > 0;
      if (
        placed &&
        (!layout.allowMultiplePlacements || isComposableSingletonTarget(target))
      ) {
        continue;
      }
      const presentation = projectWidgetPresentation.get(id);
      const token = paletteTokenFor(`p:${id}`);
      paletteTargetByToken.set(token, target);
      entries.push(
        Object.freeze({
          icon: presentation?.icon ?? "generic",
          iconUrl: "",
          kind: "project" as const,
          label: presentation?.label ?? "Fennevia widget",
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
        (placedInLayout.has(widgetId) && !layout.allowMultiplePlacements) ||
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
        Object.freeze({ kind, source: "special" as const }),
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
    for (const [direction, label] of [
      ["row", "Row"],
      ["column", "Column"],
    ] as const) {
      const token = paletteTokenFor(`c:${direction}`);
      paletteTargetByToken.set(
        token,
        Object.freeze({ direction, source: "container" as const }),
      );
      entries.push(
        Object.freeze({
          icon: direction === "row" ? "row" : "column",
          iconUrl: "",
          kind: "container" as const,
          label,
          token,
        }),
      );
    }
    for (const [kind, label] of [
      ["center", "Center"],
      ["expanded", "Expanded"],
      ["padding", "Padding"],
    ] as const) {
      const token = paletteTokenFor(`r:${kind}`);
      paletteTargetByToken.set(
        token,
        Object.freeze({ kind, source: "wrapper" as const }),
      );
      entries.push(
        Object.freeze({
          icon: kind,
          iconUrl: "",
          kind: "wrapper" as const,
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
    const layout = resolveComposableLayout();
    const zoneEntries: Array<
      readonly [ToolbarZoneName, readonly ToolbarWidgetSnapshot[]]
    > = [];
    const layoutEntries: Array<
      readonly [ToolbarZoneName, readonly ToolbarLayoutNodeSnapshot[]]
    > = [];
    const nodes: Array<NativeRecord | null> = [];
    const nextHandleIds = new Set<string>();
    for (const zone of toolbarZoneNames) {
      const projected = Object.freeze(
        layout.zones[zone].map((node) =>
          readComposableLayoutNodeSnapshot(
            customizableUi,
            node,
            nodes,
            nextHandleIds,
          ),
        ),
      );
      layoutEntries.push([zone, projected]);
      zoneEntries.push([zone, flattenToolbarLayoutWidgets(projected)]);
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
      allowMultiplePlacements: layout.allowMultiplePlacements,
      available: true,
      canEdit: prefs !== null,
      layout: Object.freeze(
        Object.fromEntries(layoutEntries),
      ) as ToolbarLayoutZonesSnapshot,
      layoutCustomized:
        persistedLayout !== null || persistedLegacyLayout !== null,
      palette: buildPalette(customizableUi, layout),
      panels: copyShellPanelConfigSnapshot(
        persistedPanels ?? createDefaultShellPanelConfig(),
      ),
      panelsCustomized: persistedPanels !== null,
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
      persistedLegacyLayout = null;
      persistedPanels = null;
      persistedStyle = createDefaultToolbarStyle();
      return;
    }
    const serializedLayout = readStringPref(prefs, LAYOUT_PREF);
    persistedLayout = parseComposableCustomizeLayout(serializedLayout);
    persistedLegacyLayout = persistedLayout
      ? null
      : parseCustomizeLayout(serializedLayout);
    persistedPanels = parseCustomizePanels(readStringPref(prefs, PANELS_PREF));
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

  const persistLayout = (layout: ComposableCustomizeLayout): void => {
    const prefs = requirePrefsForEdit();
    Reflect.apply(prefs.setStringPref, prefs, [
      LAYOUT_PREF,
      serializeComposableCustomizeLayout(layout),
    ]);
    persistedLayout = layout;
    persistedLegacyLayout = null;
  };

  const persistStyle = (style: CustomizeStyle): void => {
    const prefs = requirePrefsForEdit();
    Reflect.apply(prefs.setStringPref, prefs, [
      STYLE_PREF,
      serializeCustomizeStyle(style),
    ]);
    persistedStyle = style;
  };

  const persistPanels = (panels: CustomizePanels): void => {
    const prefs = requirePrefsForEdit();
    Reflect.apply(prefs.setStringPref, prefs, [
      PANELS_PREF,
      serializeCustomizePanels(panels),
    ]);
    persistedPanels = panels;
  };

  const adoptWidgetForPlacement = (
    customizableUi: NativeRecord,
    layout: ComposableCustomizeLayout,
    widgetId: string,
  ): ComposableCustomizeLayout => {
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
    return withComposableAdopted(layout, widgetId);
  };

  const restoreAdoptedWidget = (
    customizableUi: NativeRecord,
    layout: ComposableCustomizeLayout,
    widgetId: string,
  ): ComposableCustomizeLayout => {
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
    return withoutComposableAdopted(layout, widgetId);
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

  const collectFirefoxTargets = (
    node: ComposableLayoutNode,
  ): readonly string[] => {
    if (node.type === "item") {
      return node.target.source === "firefox"
        ? Object.freeze([node.target.id])
        : Object.freeze([]);
    }
    return Object.freeze(node.children.flatMap(collectFirefoxTargets));
  };

  const isLegacyFlatTarget = (target: ComposableLayoutTarget): boolean =>
    target.source !== "project" ||
    target.id === "show-bookmarks" ||
    target.id === "show-downloads" ||
    target.id === "show-translate";

  const legacyFlatLocations = (
    layout: ComposableCustomizeLayout,
    zone: ToolbarZoneName,
  ): readonly Readonly<{
    path: readonly number[];
    zone: ToolbarZoneName;
  }>[] => {
    const locations: Array<
      Readonly<{ path: readonly number[]; zone: ToolbarZoneName }>
    > = [];
    const visit = (
      nodes: readonly ComposableLayoutNode[],
      parentPath: readonly number[],
    ): void => {
      for (const [index, node] of nodes.entries()) {
        const path = Object.freeze([...parentPath, index]);
        if (node.type !== "item") {
          visit(node.children, path);
        } else if (isLegacyFlatTarget(node.target)) {
          locations.push(Object.freeze({ path, zone }));
        }
      }
    };
    visit(layout.zones[zone], []);
    return Object.freeze(locations);
  };

  const legacyFlatDestination = (
    layout: ComposableCustomizeLayout,
    zone: ToolbarZoneName,
    index: number,
  ): Readonly<{
    index: number;
    parentPath: readonly number[];
    zone: ToolbarZoneName;
  }> => {
    const locations = legacyFlatLocations(layout, zone);
    const before = locations[index];
    if (before) {
      return Object.freeze({
        index: before.path.at(-1) as number,
        parentPath: Object.freeze(before.path.slice(0, -1)),
        zone,
      });
    }
    const last = locations.at(-1);
    if (last && index === locations.length) {
      return Object.freeze({
        index: (last.path.at(-1) as number) + 1,
        parentPath: Object.freeze(last.path.slice(0, -1)),
        zone,
      });
    }
    const root = layout.zones[zone];
    if (index === 0 && root.length === 1 && root[0]?.type === "container") {
      return Object.freeze({
        index: root[0].children.length,
        parentPath: Object.freeze([0]),
        zone,
      });
    }
    if (index === locations.length) {
      return Object.freeze({
        index: root.length,
        parentPath: Object.freeze([]),
        zone,
      });
    }
    throw new Error("FENNEVIA_COMPOSABLE_LAYOUT_INDEX_INVALID");
  };

  const placeComposableTarget = (
    customizableUi: NativeRecord,
    base: ComposableCustomizeLayout,
    target: ComposableLayoutTarget,
    destination: Readonly<{
      index: number;
      parentPath: readonly number[];
      zone: ToolbarZoneName;
    }>,
  ): ComposableCustomizeLayout => {
    const existing = findComposableLayoutTarget(base, target);
    if (
      existing &&
      target.source !== "special" &&
      (!base.allowMultiplePlacements || isComposableSingletonTarget(target))
    ) {
      return moveComposableLayoutNode(base, existing, destination);
    }
    let layout = base;
    if (
      target.source === "firefox" &&
      !composableLayoutContainsFirefoxWidget(layout, target.id)
    ) {
      layout = adoptWidgetForPlacement(customizableUi, layout, target.id);
    }
    return insertComposableLayoutTarget(layout, target, destination);
  };

  const removeComposableNodeAndRestore = (
    customizableUi: NativeRecord,
    base: ComposableCustomizeLayout,
    location: Readonly<{ path: readonly number[]; zone: ToolbarZoneName }>,
  ): ComposableCustomizeLayout => {
    const removed = getComposableLayoutNode(base, location);
    let layout = removeComposableLayoutNode(base, location);
    for (const widgetId of new Set(collectFirefoxTargets(removed))) {
      if (!composableLayoutContainsFirefoxWidget(layout, widgetId)) {
        layout = restoreAdoptedWidget(customizableUi, layout, widgetId);
      }
    }
    return layout;
  };

  const enabledPanelMap = (
    panels: ShellPanelConfigSnapshot,
  ): Readonly<Record<ToolbarZoneName, boolean>> =>
    Object.freeze({
      bottom: panels.bottomPanelEnabled,
      left: panels.leftPanelEnabled,
      right: panels.rightPanelEnabled,
      top: true,
    });

  const persistAccessibleLayout = (layout: ComposableCustomizeLayout): void => {
    const panels = persistedPanels ?? createDefaultShellPanelConfig();
    if (!hasAccessibleComposableCustomize(layout, enabledPanelMap(panels))) {
      throw new Error("FENNEVIA_COMPOSABLE_LAYOUT_CUSTOMIZE_INACCESSIBLE");
    }
    persistLayout(layout);
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
      if (validated.type === "set-panels") {
        const panels = copyShellPanelConfigSnapshot({
          ...(persistedPanels ?? createDefaultShellPanelConfig()),
          ...validated.panels,
        } as ShellPanelConfigSnapshot);
        requireCustomizableUiForEdit();
        if (
          !hasAccessibleComposableCustomize(
            resolveComposableLayout(),
            enabledPanelMap(panels),
          )
        ) {
          throw createToolbarWidgetsError(
            boundary,
            "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_INVALID",
            "firefox-toolbar-widgets-edit",
            "toolbar-widgets.customize-access",
          );
        }
        persistPanels(panels);
        publishSnapshotIfChanged();
        return true;
      }
      if (validated.type === "reset-panels") {
        const prefs = requirePrefsForEdit();
        try {
          Reflect.apply(prefs.clearUserPref, prefs, [PANELS_PREF]);
        } catch {
          // The pref may already be at its default value.
        }
        persistedPanels = null;
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
      const base = resolveComposableLayout();
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
            const destination = legacyFlatDestination(
              base,
              validated.zone,
              validated.index,
            );
            persistAccessibleLayout(
              target.source === "container"
                ? insertComposableLayoutContainer(
                    base,
                    target.direction,
                    destination,
                  )
                : target.source === "wrapper"
                  ? insertComposableLayoutWrapper(
                      base,
                      target.kind,
                      destination,
                    )
                  : placeComposableTarget(
                      customizableUi,
                      base,
                      target,
                      destination,
                    ),
            );
            break;
          }
          case "add-node": {
            const target = paletteTargetByToken.get(validated.token);
            if (!target) {
              throw new Error("FENNEVIA_COMPOSABLE_LAYOUT_PALETTE_INVALID");
            }
            const destination = {
              index: validated.index,
              parentPath: validated.parentPath,
              zone: validated.zone,
            } as const;
            persistAccessibleLayout(
              target.source === "container"
                ? insertComposableLayoutContainer(
                    base,
                    target.direction,
                    destination,
                  )
                : target.source === "wrapper"
                  ? insertComposableLayoutWrapper(
                      base,
                      target.kind,
                      destination,
                    )
                  : placeComposableTarget(
                      customizableUi,
                      base,
                      target,
                      destination,
                    ),
            );
            break;
          }
          case "add-container": {
            persistAccessibleLayout(
              insertComposableLayoutContainer(base, validated.direction, {
                index: validated.index,
                parentPath: validated.parentPath,
                zone: validated.zone,
              }),
            );
            break;
          }
          case "move": {
            const from = legacyFlatLocations(base, validated.fromZone)[
              validated.fromIndex
            ];
            if (!from) {
              throw new Error("FENNEVIA_COMPOSABLE_LAYOUT_INDEX_INVALID");
            }
            persistAccessibleLayout(
              moveComposableLayoutNode(
                base,
                from,
                legacyFlatDestination(
                  base,
                  validated.toZone,
                  validated.toIndex,
                ),
              ),
            );
            break;
          }
          case "move-node": {
            persistAccessibleLayout(
              moveComposableLayoutNode(base, validated.from, validated.to),
            );
            break;
          }
          case "remove": {
            const location = legacyFlatLocations(base, validated.zone)[
              validated.index
            ];
            if (!location) {
              throw new Error("FENNEVIA_COMPOSABLE_LAYOUT_INDEX_INVALID");
            }
            persistAccessibleLayout(
              removeComposableNodeAndRestore(customizableUi, base, location),
            );
            break;
          }
          case "remove-node": {
            persistAccessibleLayout(
              removeComposableNodeAndRestore(
                customizableUi,
                base,
                validated.location,
              ),
            );
            break;
          }
          case "set-multiple-placements": {
            persistAccessibleLayout(
              setComposableMultiplePlacements(base, validated.allow),
            );
            break;
          }
          case "set-container-direction": {
            persistAccessibleLayout(
              setComposableLayoutContainerDirection(
                base,
                validated.location,
                validated.direction,
              ),
            );
            break;
          }
          case "clean-layout": {
            let restored = base;
            for (const adoptedId of [...base.adopted]) {
              restored = restoreAdoptedWidget(
                customizableUi,
                restored,
                adoptedId,
              );
            }
            persistAccessibleLayout(
              createComposableCustomizeLayout(
                {
                  top: [
                    {
                      target: {
                        id: "customize-shell",
                        source: "project",
                      },
                      type: "item",
                    },
                  ],
                },
                {
                  adopted: restored.adopted,
                  allowMultiplePlacements: base.allowMultiplePlacements,
                },
              ),
            );
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
            persistedLegacyLayout = null;
            break;
          }
        }
      } catch (error) {
        if (isFirefoxBridgeError(error)) {
          throw error;
        }
        if (isComposableLayoutError(error)) {
          throw createToolbarWidgetsError(
            boundary,
            "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_INVALID",
            "firefox-toolbar-widgets-edit",
            "toolbar-widgets.composable-layout",
            error,
          );
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
    fluentLocalization = null;
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
      disposed = true;
      popupActions.dispose();
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
      snapshotListeners.clear();
      popupListeners.clear();
      currentHandleIds.clear();
      paletteTokenByKey.clear();
      paletteTargetByToken.clear();
      builtinIconUrlCache = null;
      fluentLocalization = null;
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
