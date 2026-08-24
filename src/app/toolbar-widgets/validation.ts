// SPDX-License-Identifier: MPL-2.0

import { edgeInteractionDefaults } from "../edge-surfaces/contracts.ts";
import {
  toolbarZoneNames,
  toolbarLayoutDirections,
  toolbarLayoutWrapperKinds,
  toolbarStyleBounds,
  toolbarStyleColorInputPattern,
  toolbarStyleColorKeys,
  LABEL_MAX_LENGTH,
  TOOLTIP_MAX_LENGTH,
  BADGE_MAX_LENGTH,
  COLOR_MAX_LENGTH,
  ICON_URL_MAX_LENGTH,
  PALETTE_MAX_ENTRIES,
  WIDGET_PART_MAX_ENTRIES,
  ZONE_MAX_ENTRIES,
  ICON_TOKEN_PATTERN,
  PALETTE_TOKEN_PATTERN,
  isAllowedToolbarWidgetIconUrl,
  toolbarWidgetKindSet,
  toolbarZoneNameSet,
  fenneviaToolbarActionSet,
  toolbarPaletteKindSet,
  toolbarStyleThemeSet,
  toolbarStyleDensitySet,
  sidePanelLayoutSet,
  progressLightSourceSet,
  nonInteractiveKindSet,
  projectWidgetIdSet,
} from "./contracts.ts";
import type {
  ToolbarWidgetKind,
  ToolbarZoneName,
  FenneviaToolbarAction,
  ProjectWidgetId,
  ToolbarPaletteKind,
  ToolbarStyleTheme,
  ToolbarStyleDensity,
  ToolbarStyleColorKey,
  SidePanelLayout,
  ProgressLightSource,
  ShellPanelConfigSnapshot,
  SidePanelEdge,
  SidePanelRole,
  ToolbarWidgetSnapshot,
  ToolbarWidgetPartSnapshot,
  ToolbarPaletteEntrySnapshot,
  ToolbarStyleSnapshot,
  ToolbarWidgetZones,
  ToolbarLayoutDirection,
  ToolbarLayoutWrapperKind,
  ToolbarLayoutNodeSnapshot,
  ToolbarLayoutZonesSnapshot,
  ToolbarLayoutLocation,
  ToolbarWidgetsSnapshot,
  ToolbarWidgetsEditOperation,
} from "./contracts.ts";
import { createToolbarWidgetsStateError } from "./errors.ts";

export function isToolbarWidgetKind(
  candidate: unknown,
): candidate is ToolbarWidgetKind {
  return (
    typeof candidate === "string" &&
    toolbarWidgetKindSet.has(candidate as ToolbarWidgetKind)
  );
}

export function isToolbarZoneName(
  candidate: unknown,
): candidate is ToolbarZoneName {
  return (
    typeof candidate === "string" &&
    toolbarZoneNameSet.has(candidate as ToolbarZoneName)
  );
}

const toolbarLayoutDirectionSet = new Set<ToolbarLayoutDirection>(
  toolbarLayoutDirections,
);

const toolbarLayoutWrapperKindSet = new Set<ToolbarLayoutWrapperKind>(
  toolbarLayoutWrapperKinds,
);

export function isToolbarLayoutDirection(
  candidate: unknown,
): candidate is ToolbarLayoutDirection {
  return (
    typeof candidate === "string" &&
    toolbarLayoutDirectionSet.has(candidate as ToolbarLayoutDirection)
  );
}

export function isToolbarLayoutWrapperKind(
  candidate: unknown,
): candidate is ToolbarLayoutWrapperKind {
  return (
    typeof candidate === "string" &&
    toolbarLayoutWrapperKindSet.has(candidate as ToolbarLayoutWrapperKind)
  );
}

export function isToolbarPaletteToken(candidate: unknown): candidate is string {
  return typeof candidate === "string" && PALETTE_TOKEN_PATTERN.test(candidate);
}

export function isFenneviaToolbarAction(
  candidate: unknown,
): candidate is FenneviaToolbarAction {
  return (
    typeof candidate === "string" &&
    fenneviaToolbarActionSet.has(candidate as FenneviaToolbarAction)
  );
}

export function isToolbarPaletteKind(
  candidate: unknown,
): candidate is ToolbarPaletteKind {
  return (
    typeof candidate === "string" &&
    toolbarPaletteKindSet.has(candidate as ToolbarPaletteKind)
  );
}

export function isToolbarStyleTheme(
  candidate: unknown,
): candidate is ToolbarStyleTheme {
  return (
    typeof candidate === "string" &&
    toolbarStyleThemeSet.has(candidate as ToolbarStyleTheme)
  );
}

export function isToolbarStyleDensity(
  candidate: unknown,
): candidate is ToolbarStyleDensity {
  return (
    typeof candidate === "string" &&
    toolbarStyleDensitySet.has(candidate as ToolbarStyleDensity)
  );
}

export function isSidePanelLayout(
  candidate: unknown,
): candidate is SidePanelLayout {
  return (
    typeof candidate === "string" &&
    sidePanelLayoutSet.has(candidate as SidePanelLayout)
  );
}

export function isProgressLightSource(
  candidate: unknown,
): candidate is ProgressLightSource {
  return (
    typeof candidate === "string" &&
    progressLightSourceSet.has(candidate as ProgressLightSource)
  );
}

export function createDefaultShellPanelConfig(): ShellPanelConfigSnapshot {
  return Object.freeze({
    allowCompactWindow: false,
    bottomPanelEnabled: true,
    bottomProgressLight: "downloads" as const,
    leftPanelEnabled: true,
    rightPanelEnabled: true,
    sidePanelLayout: "tabs-left" as const,
    topProgressLight: "loading" as const,
  });
}

export function copyShellPanelConfigSnapshot(
  candidate: ShellPanelConfigSnapshot,
): ShellPanelConfigSnapshot {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    typeof candidate.allowCompactWindow !== "boolean" ||
    typeof candidate.bottomPanelEnabled !== "boolean" ||
    !isProgressLightSource(candidate.bottomProgressLight) ||
    typeof candidate.leftPanelEnabled !== "boolean" ||
    typeof candidate.rightPanelEnabled !== "boolean" ||
    !isSidePanelLayout(candidate.sidePanelLayout) ||
    !isProgressLightSource(candidate.topProgressLight)
  ) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_PANELS_INVALID",
    );
  }
  return Object.freeze({
    allowCompactWindow: candidate.allowCompactWindow,
    bottomPanelEnabled: candidate.bottomPanelEnabled,
    bottomProgressLight: candidate.bottomProgressLight,
    leftPanelEnabled: candidate.leftPanelEnabled,
    rightPanelEnabled: candidate.rightPanelEnabled,
    sidePanelLayout: candidate.sidePanelLayout,
    topProgressLight: candidate.topProgressLight,
  });
}

export function copyShellPanelConfigPartial(
  candidate: Readonly<Partial<ShellPanelConfigSnapshot>>,
): Readonly<Partial<ShellPanelConfigSnapshot>> {
  if (!candidate || typeof candidate !== "object") {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_PANELS_INVALID",
    );
  }
  const keys = Object.keys(candidate);
  const defaults = createDefaultShellPanelConfig();
  const validated = copyShellPanelConfigSnapshot({
    ...defaults,
    ...candidate,
  });
  if (keys.length === 0 || keys.some((key) => !Object.hasOwn(validated, key))) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_PANELS_INVALID",
    );
  }
  const partial: Partial<ShellPanelConfigSnapshot> = {};
  for (const key of keys) {
    const panelKey = key as keyof ShellPanelConfigSnapshot;
    if (candidate[panelKey] !== validated[panelKey]) {
      throw createToolbarWidgetsStateError(
        "FENNEVIA_TOOLBAR_WIDGETS_STATE_PANELS_INVALID",
      );
    }
    Object.assign(partial, { [panelKey]: validated[panelKey] });
  }
  return Object.freeze(partial);
}

export function getSidePanelRole(
  panels: ShellPanelConfigSnapshot,
  edge: SidePanelEdge,
): SidePanelRole {
  const tabsEdge = panels.sidePanelLayout === "tabs-left" ? "left" : "right";
  return edge === tabsEdge ? "tabs" : "bookmarks";
}

export function getSidePanelEdge(
  panels: ShellPanelConfigSnapshot,
  role: SidePanelRole,
): SidePanelEdge {
  const tabsEdge = panels.sidePanelLayout === "tabs-left" ? "left" : "right";
  return role === "tabs" ? tabsEdge : tabsEdge === "left" ? "right" : "left";
}

export function isInteractiveToolbarWidget(
  widget: ToolbarWidgetSnapshot,
): boolean {
  return (
    !nonInteractiveKindSet.has(widget.kind) &&
    !widget.missing &&
    (widget.handle !== "" || widget.fenneviaAction !== "")
  );
}

export function createDefaultToolbarStyle(): ToolbarStyleSnapshot {
  return Object.freeze({
    accent: "",
    autoHideDelay: edgeInteractionDefaults.hideDelayMs,
    blur: 18,
    border: "",
    chromeBackground: "",
    density: "cozy" as const,
    edgeTriggerSize: edgeInteractionDefaults.triggerThicknessCssPixels,
    fontSize: 12,
    motion: 180,
    radius: 4,
    saturation: 145,
    shadow: 50,
    shortcutHintDuration: 600,
    surface: "",
    surfaceOpacity: 94,
    temporaryRevealDuration: edgeInteractionDefaults.programmaticRevealMs,
    text: "",
    theme: "auto" as const,
    windowLeaveHideDelay: edgeInteractionDefaults.windowLeaveHideDelayMs,
  });
}

const isBoundedStyleNumber = (
  value: unknown,
  bounds: Readonly<{ max: number; min: number }>,
): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= bounds.min &&
  value <= bounds.max;

const toolbarStyleColorKeySet = new Set<string>(toolbarStyleColorKeys);

export function isToolbarStyleColorKey(
  candidate: unknown,
): candidate is ToolbarStyleColorKey {
  return (
    typeof candidate === "string" && toolbarStyleColorKeySet.has(candidate)
  );
}

export function normalizeToolbarStyleColor(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  if (value === "") {
    return "";
  }
  if (!toolbarStyleColorInputPattern.test(value)) {
    return null;
  }
  return value.toLowerCase();
}

const readStyleColor = (value: unknown): string | null =>
  normalizeToolbarStyleColor(value);

export function copyToolbarStyleSnapshot(
  candidate: ToolbarStyleSnapshot,
): ToolbarStyleSnapshot {
  if (!candidate || typeof candidate !== "object") {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID",
    );
  }
  const accent = readStyleColor(candidate.accent);
  const border = readStyleColor(candidate.border);
  const chromeBackground = readStyleColor(candidate.chromeBackground);
  const surface = readStyleColor(candidate.surface);
  const text = readStyleColor(candidate.text);
  if (
    accent === null ||
    border === null ||
    chromeBackground === null ||
    surface === null ||
    text === null ||
    !isBoundedStyleNumber(
      candidate.autoHideDelay,
      toolbarStyleBounds.autoHideDelay,
    ) ||
    !isBoundedStyleNumber(candidate.blur, toolbarStyleBounds.blur) ||
    !isToolbarStyleDensity(candidate.density) ||
    !isBoundedStyleNumber(
      candidate.edgeTriggerSize,
      toolbarStyleBounds.edgeTriggerSize,
    ) ||
    !isBoundedStyleNumber(candidate.fontSize, toolbarStyleBounds.fontSize) ||
    !isBoundedStyleNumber(candidate.motion, toolbarStyleBounds.motion) ||
    !isBoundedStyleNumber(candidate.radius, toolbarStyleBounds.radius) ||
    !isBoundedStyleNumber(
      candidate.saturation,
      toolbarStyleBounds.saturation,
    ) ||
    !isBoundedStyleNumber(candidate.shadow, toolbarStyleBounds.shadow) ||
    !isBoundedStyleNumber(
      candidate.shortcutHintDuration,
      toolbarStyleBounds.shortcutHintDuration,
    ) ||
    !isBoundedStyleNumber(
      candidate.surfaceOpacity,
      toolbarStyleBounds.surfaceOpacity,
    ) ||
    !isBoundedStyleNumber(
      candidate.temporaryRevealDuration,
      toolbarStyleBounds.temporaryRevealDuration,
    ) ||
    !isToolbarStyleTheme(candidate.theme) ||
    !isBoundedStyleNumber(
      candidate.windowLeaveHideDelay,
      toolbarStyleBounds.windowLeaveHideDelay,
    )
  ) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID",
    );
  }
  return Object.freeze({
    accent,
    autoHideDelay: candidate.autoHideDelay,
    blur: candidate.blur,
    border,
    chromeBackground,
    density: candidate.density,
    edgeTriggerSize: candidate.edgeTriggerSize,
    fontSize: candidate.fontSize,
    motion: candidate.motion,
    radius: candidate.radius,
    saturation: candidate.saturation,
    shadow: candidate.shadow,
    shortcutHintDuration: candidate.shortcutHintDuration,
    surface,
    surfaceOpacity: candidate.surfaceOpacity,
    temporaryRevealDuration: candidate.temporaryRevealDuration,
    text,
    theme: candidate.theme,
    windowLeaveHideDelay: candidate.windowLeaveHideDelay,
  });
}

export function copyToolbarStylePartial(
  candidate: Readonly<Partial<ToolbarStyleSnapshot>>,
): Readonly<Partial<ToolbarStyleSnapshot>> {
  if (!candidate || typeof candidate !== "object") {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID",
    );
  }
  const keys = Object.keys(candidate);
  const normalized: Partial<ToolbarStyleSnapshot> = {};
  for (const key of keys) {
    if (isToolbarStyleColorKey(key)) {
      const color = readStyleColor(candidate[key]);
      if (color === null) {
        throw createToolbarWidgetsStateError(
          "FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID",
        );
      }
      Object.assign(normalized, { [key]: color });
      continue;
    }
    Object.assign(normalized, {
      [key]: candidate[key as keyof ToolbarStyleSnapshot],
    });
  }
  const merged = {
    ...createDefaultToolbarStyle(),
    ...normalized,
  };
  const validated = copyToolbarStyleSnapshot(merged);
  if (
    keys.length === 0 ||
    keys.some((key) => !Object.hasOwn(validated, key)) ||
    keys.some(
      (key) =>
        normalized[key as keyof ToolbarStyleSnapshot] !==
        validated[key as keyof ToolbarStyleSnapshot],
    )
  ) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID",
    );
  }
  const partial: Partial<ToolbarStyleSnapshot> = {};
  for (const key of keys) {
    const styleKey = key as keyof ToolbarStyleSnapshot;
    Object.assign(partial, { [styleKey]: validated[styleKey] });
  }
  return Object.freeze(partial);
}

const requireBoundedString = (value: unknown, maxLength: number): string => {
  if (typeof value !== "string" || value.length > maxLength) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_TEXT_INVALID",
    );
  }
  return value;
};

export function copyToolbarWidgetPartSnapshot(
  candidate: ToolbarWidgetPartSnapshot,
): ToolbarWidgetPartSnapshot {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    typeof candidate.disabled !== "boolean" ||
    typeof candidate.handle !== "string" ||
    candidate.handle === "" ||
    candidate.kind !== "built-in"
  ) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_WIDGET_INVALID",
    );
  }
  const icon = requireBoundedString(candidate.icon, 32);
  if (icon !== "" && !ICON_TOKEN_PATTERN.test(icon)) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_ICON_INVALID",
    );
  }
  const iconUrl = requireBoundedString(candidate.iconUrl, ICON_URL_MAX_LENGTH);
  if (!isAllowedToolbarWidgetIconUrl(iconUrl)) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_ICON_URL_INVALID",
    );
  }
  const label = requireBoundedString(candidate.label, LABEL_MAX_LENGTH);
  const valueText = requireBoundedString(candidate.valueText, LABEL_MAX_LENGTH);
  if (valueText !== "" && valueText !== label) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_WIDGET_INVALID",
    );
  }
  return Object.freeze({
    disabled: candidate.disabled,
    handle: candidate.handle,
    icon,
    iconUrl,
    kind: "built-in" as const,
    label,
    tooltip: requireBoundedString(candidate.tooltip, TOOLTIP_MAX_LENGTH),
    valueText,
  });
}

export function copyToolbarWidgetSnapshot(
  candidate: ToolbarWidgetSnapshot,
): ToolbarWidgetSnapshot {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    !isToolbarWidgetKind(candidate.kind) ||
    typeof candidate.disabled !== "boolean" ||
    typeof candidate.missing !== "boolean" ||
    typeof candidate.handle !== "string" ||
    typeof candidate.fenneviaAction !== "string" ||
    !Array.isArray(candidate.parts) ||
    candidate.parts.length > WIDGET_PART_MAX_ENTRIES
  ) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_WIDGET_INVALID",
    );
  }
  const nonInteractive = nonInteractiveKindSet.has(candidate.kind);
  const isFennevia = candidate.kind === "fennevia";
  const isProject = candidate.kind === "project";
  if (
    (nonInteractive || isFennevia || isProject || candidate.missing) &&
    candidate.handle !== ""
  ) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_HANDLE_INVALID",
    );
  }
  if (
    !nonInteractive &&
    !isFennevia &&
    !isProject &&
    !candidate.missing &&
    candidate.handle === ""
  ) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_HANDLE_INVALID",
    );
  }
  if (
    isFennevia
      ? !isFenneviaToolbarAction(candidate.fenneviaAction)
      : candidate.fenneviaAction !== ""
  ) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_ACTION_INVALID",
    );
  }
  if ((isFennevia || isProject) && candidate.missing) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_WIDGET_INVALID",
    );
  }
  if (
    candidate.parts.length > 0 &&
    (candidate.kind !== "built-in" || candidate.missing)
  ) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_WIDGET_INVALID",
    );
  }
  const parts = Object.freeze(
    candidate.parts.map(copyToolbarWidgetPartSnapshot),
  );
  if (
    new Set(parts.map((part) => part.handle)).size !== parts.length ||
    parts.some((part) => part.handle === candidate.handle)
  ) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_HANDLE_INVALID",
    );
  }
  const icon = requireBoundedString(candidate.icon, 32);
  if (icon !== "" && !ICON_TOKEN_PATTERN.test(icon)) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_ICON_INVALID",
    );
  }
  const iconUrl = requireBoundedString(candidate.iconUrl, ICON_URL_MAX_LENGTH);
  if (!isAllowedToolbarWidgetIconUrl(iconUrl)) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_ICON_URL_INVALID",
    );
  }
  return Object.freeze({
    badgeBackground: requireBoundedString(
      candidate.badgeBackground,
      COLOR_MAX_LENGTH,
    ),
    badgeText: requireBoundedString(candidate.badgeText, BADGE_MAX_LENGTH),
    badgeTextColor: requireBoundedString(
      candidate.badgeTextColor,
      COLOR_MAX_LENGTH,
    ),
    disabled: candidate.disabled,
    fenneviaAction: candidate.fenneviaAction,
    handle: candidate.handle,
    icon,
    iconUrl,
    kind: candidate.kind,
    label: requireBoundedString(candidate.label, LABEL_MAX_LENGTH),
    missing: candidate.missing,
    parts,
    tooltip: requireBoundedString(candidate.tooltip, TOOLTIP_MAX_LENGTH),
  });
}

export function copyToolbarPaletteEntrySnapshot(
  candidate: ToolbarPaletteEntrySnapshot,
): ToolbarPaletteEntrySnapshot {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    !isToolbarPaletteKind(candidate.kind) ||
    typeof candidate.token !== "string" ||
    !PALETTE_TOKEN_PATTERN.test(candidate.token)
  ) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_PALETTE_INVALID",
    );
  }
  const icon = requireBoundedString(candidate.icon, 32);
  if (icon !== "" && !ICON_TOKEN_PATTERN.test(icon)) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_ICON_INVALID",
    );
  }
  const iconUrl = requireBoundedString(candidate.iconUrl, ICON_URL_MAX_LENGTH);
  if (!isAllowedToolbarWidgetIconUrl(iconUrl)) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_ICON_URL_INVALID",
    );
  }
  return Object.freeze({
    icon,
    iconUrl,
    kind: candidate.kind,
    label: requireBoundedString(candidate.label, LABEL_MAX_LENGTH),
    token: candidate.token,
  });
}

export function createEmptyToolbarWidgetZones(): ToolbarWidgetZones {
  return Object.freeze({
    bottom: Object.freeze([]),
    left: Object.freeze([]),
    right: Object.freeze([]),
    top: Object.freeze([]),
  });
}

const TOOLBAR_LAYOUT_INSTANCE_PATTERN = /^layout-[1-9][0-9]{0,5}$/u;
const TOOLBAR_LAYOUT_MAX_DEPTH = 3;
const TOOLBAR_LAYOUT_MAX_NODES = 128;

export function copyToolbarLayoutPath(candidate: unknown): readonly number[] {
  if (
    !Array.isArray(candidate) ||
    candidate.length > TOOLBAR_LAYOUT_MAX_DEPTH + 1 ||
    candidate.some(
      (index) =>
        !Number.isSafeInteger(index) || index < 0 || index > ZONE_MAX_ENTRIES,
    )
  ) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_LAYOUT_PATH_INVALID",
    );
  }
  return Object.freeze([...(candidate as number[])]);
}

export function copyToolbarLayoutLocation(
  candidate: ToolbarLayoutLocation,
): ToolbarLayoutLocation {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    !isToolbarZoneName(candidate.zone)
  ) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_LAYOUT_PATH_INVALID",
    );
  }
  return Object.freeze({
    path: copyToolbarLayoutPath(candidate.path),
    zone: candidate.zone,
  });
}

function copyToolbarLayoutNodes(
  candidate: unknown,
  depth: number,
  state: Readonly<{
    instanceIds: Set<string>;
    total: { value: number };
  }>,
): readonly ToolbarLayoutNodeSnapshot[] {
  if (!Array.isArray(candidate) || candidate.length > ZONE_MAX_ENTRIES) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_LAYOUT_INVALID",
    );
  }
  const nodes: ToolbarLayoutNodeSnapshot[] = [];
  for (const rawNode of candidate) {
    if (!rawNode || typeof rawNode !== "object") {
      throw createToolbarWidgetsStateError(
        "FENNEVIA_TOOLBAR_WIDGETS_STATE_LAYOUT_INVALID",
      );
    }
    const node = rawNode as Record<string, unknown>;
    state.total.value += 1;
    if (
      state.total.value > TOOLBAR_LAYOUT_MAX_NODES ||
      typeof node.instanceId !== "string" ||
      !TOOLBAR_LAYOUT_INSTANCE_PATTERN.test(node.instanceId) ||
      state.instanceIds.has(node.instanceId)
    ) {
      throw createToolbarWidgetsStateError(
        "FENNEVIA_TOOLBAR_WIDGETS_STATE_LAYOUT_INVALID",
      );
    }
    state.instanceIds.add(node.instanceId);
    if (node.type === "item") {
      const projectId = node.projectId;
      if (
        typeof projectId !== "string" ||
        (projectId !== "" &&
          !projectWidgetIdSet.has(projectId as ProjectWidgetId))
      ) {
        throw createToolbarWidgetsStateError(
          "FENNEVIA_TOOLBAR_WIDGETS_STATE_LAYOUT_INVALID",
        );
      }
      const widget = copyToolbarWidgetSnapshot(
        node.widget as ToolbarWidgetSnapshot,
      );
      if (
        (projectId === "") === (widget.kind === "project") ||
        Object.keys(node).some(
          (key) => !["instanceId", "projectId", "type", "widget"].includes(key),
        )
      ) {
        throw createToolbarWidgetsStateError(
          "FENNEVIA_TOOLBAR_WIDGETS_STATE_LAYOUT_INVALID",
        );
      }
      nodes.push(
        Object.freeze({
          instanceId: node.instanceId,
          projectId: projectId as ProjectWidgetId | "",
          type: "item" as const,
          widget,
        }),
      );
      continue;
    }
    if (
      node.type === "wrapper" &&
      isToolbarLayoutWrapperKind(node.kind) &&
      depth < TOOLBAR_LAYOUT_MAX_DEPTH &&
      Array.isArray(node.children) &&
      node.children.length <= 1 &&
      !Object.keys(node).some(
        (key) => !["children", "instanceId", "kind", "type"].includes(key),
      )
    ) {
      nodes.push(
        Object.freeze({
          children: copyToolbarLayoutNodes(node.children, depth + 1, state),
          instanceId: node.instanceId,
          kind: node.kind,
          type: "wrapper" as const,
        }),
      );
      continue;
    }
    if (
      node.type !== "container" ||
      !isToolbarLayoutDirection(node.direction) ||
      depth >= TOOLBAR_LAYOUT_MAX_DEPTH ||
      Object.keys(node).some(
        (key) => !["children", "direction", "instanceId", "type"].includes(key),
      )
    ) {
      throw createToolbarWidgetsStateError(
        "FENNEVIA_TOOLBAR_WIDGETS_STATE_LAYOUT_INVALID",
      );
    }
    nodes.push(
      Object.freeze({
        children: copyToolbarLayoutNodes(node.children, depth + 1, state),
        direction: node.direction,
        instanceId: node.instanceId,
        type: "container" as const,
      }),
    );
  }
  return Object.freeze(nodes);
}

export function createEmptyToolbarLayoutZones(): ToolbarLayoutZonesSnapshot {
  return Object.freeze({
    bottom: Object.freeze([]),
    left: Object.freeze([]),
    right: Object.freeze([]),
    top: Object.freeze([]),
  });
}

export function copyToolbarLayoutZonesSnapshot(
  candidate: ToolbarLayoutZonesSnapshot,
): ToolbarLayoutZonesSnapshot {
  if (!candidate || typeof candidate !== "object") {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_LAYOUT_INVALID",
    );
  }
  const state = {
    instanceIds: new Set<string>(),
    total: { value: 0 },
  };
  return Object.freeze(
    Object.fromEntries(
      toolbarZoneNames.map((zone) => [
        zone,
        copyToolbarLayoutNodes(candidate[zone], 0, state),
      ]),
    ),
  ) as ToolbarLayoutZonesSnapshot;
}

export function createUnavailableToolbarWidgetsSnapshot(): ToolbarWidgetsSnapshot {
  return Object.freeze({
    allowMultiplePlacements: false,
    available: false,
    canEdit: false,
    layout: createEmptyToolbarLayoutZones(),
    layoutCustomized: false,
    palette: Object.freeze([]),
    panels: createDefaultShellPanelConfig(),
    panelsCustomized: false,
    style: createDefaultToolbarStyle(),
    zones: createEmptyToolbarWidgetZones(),
  });
}

export function copyToolbarWidgetsSnapshot(
  candidate: ToolbarWidgetsSnapshot,
): ToolbarWidgetsSnapshot {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    typeof candidate.available !== "boolean" ||
    typeof candidate.allowMultiplePlacements !== "boolean" ||
    typeof candidate.canEdit !== "boolean" ||
    typeof candidate.layoutCustomized !== "boolean" ||
    typeof candidate.panelsCustomized !== "boolean" ||
    !Array.isArray(candidate.palette) ||
    candidate.palette.length > PALETTE_MAX_ENTRIES ||
    !candidate.layout ||
    typeof candidate.layout !== "object" ||
    !candidate.zones ||
    typeof candidate.zones !== "object"
  ) {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_SNAPSHOT_INVALID",
    );
  }
  const zoneEntries: Array<
    readonly [ToolbarZoneName, readonly ToolbarWidgetSnapshot[]]
  > = [];
  for (const zone of toolbarZoneNames) {
    const widgets = candidate.zones[zone];
    if (!Array.isArray(widgets) || widgets.length > ZONE_MAX_ENTRIES) {
      throw createToolbarWidgetsStateError(
        "FENNEVIA_TOOLBAR_WIDGETS_STATE_ZONE_INVALID",
      );
    }
    zoneEntries.push([
      zone,
      Object.freeze(widgets.map(copyToolbarWidgetSnapshot)),
    ]);
  }
  return Object.freeze({
    allowMultiplePlacements: candidate.allowMultiplePlacements,
    available: candidate.available,
    canEdit: candidate.canEdit,
    layout: copyToolbarLayoutZonesSnapshot(candidate.layout),
    layoutCustomized: candidate.layoutCustomized,
    palette: Object.freeze(
      candidate.palette.map(copyToolbarPaletteEntrySnapshot),
    ),
    panels: copyShellPanelConfigSnapshot(candidate.panels),
    panelsCustomized: candidate.panelsCustomized,
    style: copyToolbarStyleSnapshot(candidate.style),
    zones: Object.freeze(Object.fromEntries(zoneEntries)) as ToolbarWidgetZones,
  });
}

const isBoundedIndex = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= ZONE_MAX_ENTRIES;

const isEditRevision = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function copyToolbarWidgetsEditOperation(
  candidate: ToolbarWidgetsEditOperation,
): ToolbarWidgetsEditOperation {
  if (!candidate || typeof candidate !== "object") {
    throw createToolbarWidgetsStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID",
    );
  }
  switch (candidate.type) {
    case "add": {
      if (
        typeof candidate.token !== "string" ||
        !PALETTE_TOKEN_PATTERN.test(candidate.token) ||
        !isToolbarZoneName(candidate.zone) ||
        !isBoundedIndex(candidate.index) ||
        !isEditRevision(candidate.revision)
      ) {
        throw createToolbarWidgetsStateError(
          "FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID",
        );
      }
      return Object.freeze({
        index: candidate.index,
        revision: candidate.revision,
        token: candidate.token,
        type: "add" as const,
        zone: candidate.zone,
      });
    }
    case "add-node": {
      if (
        typeof candidate.token !== "string" ||
        !PALETTE_TOKEN_PATTERN.test(candidate.token) ||
        !isToolbarZoneName(candidate.zone) ||
        !isBoundedIndex(candidate.index) ||
        !isEditRevision(candidate.revision)
      ) {
        throw createToolbarWidgetsStateError(
          "FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID",
        );
      }
      return Object.freeze({
        index: candidate.index,
        parentPath: copyToolbarLayoutPath(candidate.parentPath),
        revision: candidate.revision,
        token: candidate.token,
        type: "add-node" as const,
        zone: candidate.zone,
      });
    }
    case "add-container": {
      if (
        !isToolbarLayoutDirection(candidate.direction) ||
        !isToolbarZoneName(candidate.zone) ||
        !isBoundedIndex(candidate.index) ||
        !isEditRevision(candidate.revision)
      ) {
        throw createToolbarWidgetsStateError(
          "FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID",
        );
      }
      return Object.freeze({
        direction: candidate.direction,
        index: candidate.index,
        parentPath: copyToolbarLayoutPath(candidate.parentPath),
        revision: candidate.revision,
        type: "add-container" as const,
        zone: candidate.zone,
      });
    }
    case "move": {
      if (
        !isToolbarZoneName(candidate.fromZone) ||
        !isToolbarZoneName(candidate.toZone) ||
        !isBoundedIndex(candidate.fromIndex) ||
        !isBoundedIndex(candidate.toIndex) ||
        !isEditRevision(candidate.revision)
      ) {
        throw createToolbarWidgetsStateError(
          "FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID",
        );
      }
      return Object.freeze({
        fromIndex: candidate.fromIndex,
        fromZone: candidate.fromZone,
        revision: candidate.revision,
        toIndex: candidate.toIndex,
        toZone: candidate.toZone,
        type: "move" as const,
      });
    }
    case "remove": {
      if (
        !isToolbarZoneName(candidate.zone) ||
        !isBoundedIndex(candidate.index) ||
        !isEditRevision(candidate.revision)
      ) {
        throw createToolbarWidgetsStateError(
          "FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID",
        );
      }
      return Object.freeze({
        index: candidate.index,
        revision: candidate.revision,
        type: "remove" as const,
        zone: candidate.zone,
      });
    }
    case "move-node": {
      const from = copyToolbarLayoutLocation(candidate.from);
      if (
        from.path.length === 0 ||
        !candidate.to ||
        typeof candidate.to !== "object" ||
        !isToolbarZoneName(candidate.to.zone) ||
        !isBoundedIndex(candidate.to.index) ||
        !isEditRevision(candidate.revision)
      ) {
        throw createToolbarWidgetsStateError(
          "FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID",
        );
      }
      return Object.freeze({
        from,
        revision: candidate.revision,
        to: Object.freeze({
          index: candidate.to.index,
          parentPath: copyToolbarLayoutPath(candidate.to.parentPath),
          zone: candidate.to.zone,
        }),
        type: "move-node" as const,
      });
    }
    case "remove-node": {
      const location = copyToolbarLayoutLocation(candidate.location);
      if (location.path.length === 0 || !isEditRevision(candidate.revision)) {
        throw createToolbarWidgetsStateError(
          "FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID",
        );
      }
      return Object.freeze({
        location,
        revision: candidate.revision,
        type: "remove-node" as const,
      });
    }
    case "set-multiple-placements": {
      if (
        typeof candidate.allow !== "boolean" ||
        !isEditRevision(candidate.revision)
      ) {
        throw createToolbarWidgetsStateError(
          "FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID",
        );
      }
      return Object.freeze({
        allow: candidate.allow,
        revision: candidate.revision,
        type: "set-multiple-placements" as const,
      });
    }
    case "set-container-direction": {
      const location = copyToolbarLayoutLocation(candidate.location);
      if (
        location.path.length === 0 ||
        !isToolbarLayoutDirection(candidate.direction) ||
        !isEditRevision(candidate.revision)
      ) {
        throw createToolbarWidgetsStateError(
          "FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID",
        );
      }
      return Object.freeze({
        direction: candidate.direction,
        location,
        revision: candidate.revision,
        type: "set-container-direction" as const,
      });
    }
    case "clean-layout":
    case "reset-layout": {
      if (!isEditRevision(candidate.revision)) {
        throw createToolbarWidgetsStateError(
          "FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID",
        );
      }
      return Object.freeze({
        revision: candidate.revision,
        type: candidate.type,
      });
    }
    case "set-style": {
      return Object.freeze({
        style: copyToolbarStylePartial(candidate.style),
        type: "set-style" as const,
      });
    }
    case "reset-style": {
      return Object.freeze({ type: "reset-style" as const });
    }
    case "set-panels": {
      return Object.freeze({
        panels: copyShellPanelConfigPartial(candidate.panels),
        type: "set-panels" as const,
      });
    }
    case "reset-panels": {
      return Object.freeze({ type: "reset-panels" as const });
    }
    default: {
      throw createToolbarWidgetsStateError(
        "FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID",
      );
    }
  }
}
