// SPDX-License-Identifier: MPL-2.0
import { createToolbarWidgetPopupActions } from "./popup-actions.ts";
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
  type ToolbarWidgetPartSnapshot,
  type ToolbarWidgetSnapshot,
  type ToolbarWidgetZones,
  type ToolbarWidgetsEditOperation,
  type ToolbarWidgetsPopupEvent,
  type ToolbarWidgetsSnapshot,
  type ToolbarWidgetsStateEvent,
  type ToolbarZoneName,
} from "../../app/toolbar-widgets-state.ts";
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
  type CustomizeStyle,
} from "../customize-model.ts";
import {
  isFirefoxBridgeError,
  type FirefoxBridgeBoundary,
  type FirefoxCapabilitySnapshot,
  type IdempotentDisposer,
} from "../bridge-boundary.ts";
import {
  NAVBAR_AREA,
  LAYOUT_PREF,
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
        for (const part of built.widget.parts) {
          nextHandleIds.add(part.handle);
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
