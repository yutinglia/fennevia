// SPDX-License-Identifier: MPL-2.0

import {
  edgeInteractionBounds,
  type EdgePanelDodgeMode,
} from "../edge-surfaces/contracts.ts";

export type { EdgePanelDodgeMode } from "../edge-surfaces/contracts.ts";
export {
  defaultEdgePanelDodgeMode,
  edgePanelDodgeModes,
  isEdgePanelDodgeMode,
} from "../edge-surfaces/contracts.ts";

export const toolbarWidgetKinds = Object.freeze([
  "built-in",
  "extension-action",
  "fennevia",
  "project",
  "separator",
  "spacer",
  "spring",
] as const);

export type ToolbarWidgetKind = (typeof toolbarWidgetKinds)[number];

export const toolbarZoneNames = Object.freeze([
  "top",
  "left",
  "right",
  "bottom",
] as const);

export type ToolbarZoneName = (typeof toolbarZoneNames)[number];

export const fenneviaToolbarActions = Object.freeze([
  "show-bookmarks",
  "show-downloads",
  "show-translate",
] as const);

export type FenneviaToolbarAction = (typeof fenneviaToolbarActions)[number];

export const projectWidgetIds = Object.freeze([
  "address-launcher",
  "application-menu",
  "back",
  "bookmarks",
  "close-window",
  "customize-shell",
  "downloads-status",
  "extensions",
  "forward",
  "home",
  "minimize-window",
  "new-tab",
  "private-indicator",
  "reload-stop",
  "settings",
  "show-bookmarks",
  "show-downloads",
  "show-translate",
  "tabs",
  "toggle-maximize-window",
  "trust",
] as const);

export type ProjectWidgetId = (typeof projectWidgetIds)[number];

export const projectWidgetIdSet = new Set<ProjectWidgetId>(projectWidgetIds);

export const toolbarPaletteFeatureGroups = Object.freeze([
  "",
  "address",
  "tabs",
  "bookmarks",
  "downloads",
] as const);

export type ToolbarPaletteFeatureGroup =
  (typeof toolbarPaletteFeatureGroups)[number];

export const featureProjectWidgetIds = Object.freeze([
  "address-launcher",
  "tabs",
  "bookmarks",
  "downloads-status",
] as const satisfies readonly ProjectWidgetId[]);

export const featureProjectWidgetIdSet = new Set<ProjectWidgetId>(
  featureProjectWidgetIds,
);

export const featureCompanionProjectWidgetIds = Object.freeze([
  "trust",
  "new-tab",
  "show-bookmarks",
  "show-downloads",
] as const satisfies readonly ProjectWidgetId[]);

export const featureCompanionProjectWidgetIdSet = new Set<ProjectWidgetId>(
  featureCompanionProjectWidgetIds,
);

export const featurePaletteProjectWidgetIds = Object.freeze([
  "address-launcher",
  "trust",
  "tabs",
  "new-tab",
  "bookmarks",
  "show-bookmarks",
  "downloads-status",
  "show-downloads",
] as const satisfies readonly ProjectWidgetId[]);

export const featurePaletteProjectWidgetIdSet = new Set<ProjectWidgetId>(
  featurePaletteProjectWidgetIds,
);

export const featurePaletteGroupByProjectWidgetId: Readonly<
  Partial<Record<ProjectWidgetId, Exclude<ToolbarPaletteFeatureGroup, "">>>
> = Object.freeze({
  "address-launcher": "address",
  bookmarks: "bookmarks",
  "downloads-status": "downloads",
  "new-tab": "tabs",
  "show-bookmarks": "bookmarks",
  "show-downloads": "downloads",
  tabs: "tabs",
  trust: "address",
});

export const singletonProjectWidgetIds = Object.freeze([
  "address-launcher",
  "bookmarks",
  "customize-shell",
  "downloads-status",
  "private-indicator",
  "tabs",
] as const satisfies readonly ProjectWidgetId[]);

export const singletonProjectWidgetIdSet = new Set<ProjectWidgetId>(
  singletonProjectWidgetIds,
);

export const toolbarPaletteKinds = Object.freeze([
  "built-in",
  "extension-action",
  "feature",
  "feature-companion",
  "fennevia",
  "project",
  "container",
  "wrapper",
  "special",
] as const);

export type ToolbarPaletteKind = (typeof toolbarPaletteKinds)[number];

export const projectWidgetStyleIds = Object.freeze([
  "address-only",
  "with-site-status",
  "tabs-only",
  "with-new-tab",
] as const);

export type ProjectWidgetStyleId = (typeof projectWidgetStyleIds)[number];

export const toolbarStyleThemes = Object.freeze([
  "auto",
  "light",
  "dark",
] as const);

export type ToolbarStyleTheme = (typeof toolbarStyleThemes)[number];

export const toolbarStyleDensities = Object.freeze([
  "compact",
  "cozy",
  "comfortable",
] as const);

export type ToolbarStyleDensity = (typeof toolbarStyleDensities)[number];

export const sidePanelLayouts = Object.freeze([
  "tabs-left",
  "tabs-right",
] as const);

export type SidePanelLayout = (typeof sidePanelLayouts)[number];

export const progressLightSources = Object.freeze([
  "loading",
  "downloads",
  "off",
] as const);

export type ProgressLightSource = (typeof progressLightSources)[number];

export type SidePanelRole = "bookmarks" | "tabs";
export type SidePanelEdge = "left" | "right";

export const toolbarLayoutDirections = Object.freeze([
  "row",
  "column",
] as const);

export type ToolbarLayoutDirection = (typeof toolbarLayoutDirections)[number];

export const toolbarLayoutWrapperKinds = Object.freeze([
  "center",
  "expanded",
  "padding",
] as const);

export type ToolbarLayoutWrapperKind =
  (typeof toolbarLayoutWrapperKinds)[number];

export type ShellPanelConfigSnapshot = Readonly<{
  allowCompactWindow: boolean;
  bottomPanelEnabled: boolean;
  bottomProgressLight: ProgressLightSource;
  leftPanelEnabled: boolean;
  panelDodgeMode: EdgePanelDodgeMode;
  rightPanelEnabled: boolean;
  /** @deprecated Retained only as a version-1 layout migration hint. */
  sidePanelLayout: SidePanelLayout;
  topProgressLight: ProgressLightSource;
}>;

export const toolbarStyleBounds = Object.freeze({
  autoHideDelay: edgeInteractionBounds.hideDelayMs,
  blur: Object.freeze({ max: 32, min: 0 }),
  edgeTriggerSize: edgeInteractionBounds.triggerThicknessCssPixels,
  fontSize: Object.freeze({ max: 14, min: 11 }),
  motion: Object.freeze({ max: 400, min: 0 }),
  radius: Object.freeze({ max: 16, min: 0 }),
  saturation: Object.freeze({ max: 180, min: 100 }),
  shadow: Object.freeze({ max: 100, min: 0 }),
  shortcutHintDuration: Object.freeze({ max: 10_000, min: 0 }),
  surfaceOpacity: Object.freeze({ max: 100, min: 50 }),
  temporaryRevealDuration: edgeInteractionBounds.programmaticRevealMs,
  windowLeaveHideDelay: edgeInteractionBounds.windowLeaveHideDelayMs,
});

export const toolbarAccentPattern = /^#[0-9a-f]{6}$/u;
export const toolbarStyleColorInputPattern = /^#[0-9A-Fa-f]{6}$/u;

export const toolbarStyleColorKeys = Object.freeze([
  "accent",
  "border",
  "chromeBackground",
  "surface",
  "text",
] as const);

export type ToolbarStyleColorKey = (typeof toolbarStyleColorKeys)[number];

export const LABEL_MAX_LENGTH = 200;
export const TOOLTIP_MAX_LENGTH = 300;
export const BADGE_MAX_LENGTH = 8;
export const COLOR_MAX_LENGTH = 64;
export const ICON_URL_MAX_LENGTH = 512;
export const PALETTE_MAX_ENTRIES = 256;
export const ZONE_MAX_ENTRIES = 48;
export const WIDGET_PART_MAX_ENTRIES = 8;
export const ICON_TOKEN_PATTERN = /^[a-z][a-z0-9-]{0,31}$/u;
export const PALETTE_TOKEN_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;
export const MOZ_EXTENSION_URL_PREFIX = "moz-extension://";
export const CHROME_URL_PREFIX = "chrome://";
export const RESOURCE_URL_PREFIX = "resource://";
export const FORBIDDEN_ICON_URL_CHARACTER_PATTERN = /["'\\<>\s]/u;

export function isAllowedToolbarWidgetIconUrl(value: string): boolean {
  if (value === "") {
    return true;
  }
  if (
    value.length > ICON_URL_MAX_LENGTH ||
    FORBIDDEN_ICON_URL_CHARACTER_PATTERN.test(value)
  ) {
    return false;
  }
  return (
    value.startsWith(MOZ_EXTENSION_URL_PREFIX) ||
    value.startsWith(CHROME_URL_PREFIX) ||
    value.startsWith(RESOURCE_URL_PREFIX)
  );
}

export const toolbarWidgetKindSet = new Set<ToolbarWidgetKind>(
  toolbarWidgetKinds,
);
export const toolbarZoneNameSet = new Set<ToolbarZoneName>(toolbarZoneNames);
export const fenneviaToolbarActionSet = new Set<FenneviaToolbarAction>(
  fenneviaToolbarActions,
);
export const toolbarPaletteKindSet = new Set<ToolbarPaletteKind>(
  toolbarPaletteKinds,
);
export const toolbarPaletteFeatureGroupSet =
  new Set<ToolbarPaletteFeatureGroup>(toolbarPaletteFeatureGroups);
export const toolbarStyleThemeSet = new Set<ToolbarStyleTheme>(
  toolbarStyleThemes,
);
export const toolbarStyleDensitySet = new Set<ToolbarStyleDensity>(
  toolbarStyleDensities,
);
export const sidePanelLayoutSet = new Set<SidePanelLayout>(sidePanelLayouts);
export const progressLightSourceSet = new Set<ProgressLightSource>(
  progressLightSources,
);

export const nonInteractiveToolbarWidgetKinds = Object.freeze([
  "separator",
  "spacer",
  "spring",
] as const);

export const nonInteractiveKindSet = new Set<string>(
  nonInteractiveToolbarWidgetKinds,
);

export type ToolbarWidgetSnapshot = Readonly<{
  badgeBackground: string;
  badgeText: string;
  badgeTextColor: string;
  disabled: boolean;
  fenneviaAction: string;
  handle: string;
  icon: string;
  iconUrl: string;
  kind: ToolbarWidgetKind;
  label: string;
  missing: boolean;
  parts: readonly ToolbarWidgetPartSnapshot[];
  tooltip: string;
}>;

export type ToolbarWidgetPartSnapshot = Readonly<{
  disabled: boolean;
  handle: string;
  icon: string;
  iconUrl: string;
  kind: "built-in";
  label: string;
  tooltip: string;
  valueText: string;
}>;

export type ToolbarPaletteEntrySnapshot = Readonly<{
  featureGroup: ToolbarPaletteFeatureGroup;
  icon: string;
  iconUrl: string;
  kind: ToolbarPaletteKind;
  label: string;
  token: string;
}>;

export type ToolbarStyleSnapshot = Readonly<{
  accent: string;
  autoHideDelay: number;
  blur: number;
  border: string;
  chromeBackground: string;
  density: ToolbarStyleDensity;
  edgeTriggerSize: number;
  fontSize: number;
  motion: number;
  radius: number;
  saturation: number;
  shadow: number;
  shortcutHintDuration: number;
  surface: string;
  surfaceOpacity: number;
  temporaryRevealDuration: number;
  text: string;
  theme: ToolbarStyleTheme;
  windowLeaveHideDelay: number;
}>;

export type ToolbarWidgetZones = Readonly<
  Record<ToolbarZoneName, readonly ToolbarWidgetSnapshot[]>
>;

export type ToolbarLayoutItemSnapshot = Readonly<{
  instanceId: string;
  projectId: ProjectWidgetId | "";
  style: ProjectWidgetStyleId | "";
  type: "item";
  widget: ToolbarWidgetSnapshot;
}>;

export type ToolbarLayoutContainerSnapshot = Readonly<{
  children: readonly ToolbarLayoutNodeSnapshot[];
  direction: ToolbarLayoutDirection;
  instanceId: string;
  type: "container";
}>;

export type ToolbarLayoutWrapperSnapshot = Readonly<{
  children: readonly ToolbarLayoutNodeSnapshot[];
  instanceId: string;
  kind: ToolbarLayoutWrapperKind;
  type: "wrapper";
}>;

export type ToolbarLayoutNodeSnapshot =
  | ToolbarLayoutContainerSnapshot
  | ToolbarLayoutItemSnapshot
  | ToolbarLayoutWrapperSnapshot;

export type ToolbarLayoutZonesSnapshot = Readonly<
  Record<ToolbarZoneName, readonly ToolbarLayoutNodeSnapshot[]>
>;

export type ToolbarLayoutLocation = Readonly<{
  path: readonly number[];
  zone: ToolbarZoneName;
}>;

export type ToolbarWidgetsSnapshot = Readonly<{
  allowMultiplePlacements: boolean;
  available: boolean;
  canEdit: boolean;
  layout: ToolbarLayoutZonesSnapshot;
  layoutCustomized: boolean;
  palette: readonly ToolbarPaletteEntrySnapshot[];
  panels: ShellPanelConfigSnapshot;
  panelsCustomized: boolean;
  style: ToolbarStyleSnapshot;
  zones: ToolbarWidgetZones;
}>;

export type ToolbarWidgetsEditOperation =
  | Readonly<{
      index: number;
      revision: number;
      token: string;
      type: "add";
      zone: ToolbarZoneName;
    }>
  | Readonly<{
      index: number;
      parentPath: readonly number[];
      revision: number;
      token: string;
      type: "add-node";
      zone: ToolbarZoneName;
    }>
  | Readonly<{
      direction: ToolbarLayoutDirection;
      index: number;
      parentPath: readonly number[];
      revision: number;
      type: "add-container";
      zone: ToolbarZoneName;
    }>
  | Readonly<{
      fromIndex: number;
      fromZone: ToolbarZoneName;
      revision: number;
      toIndex: number;
      toZone: ToolbarZoneName;
      type: "move";
    }>
  | Readonly<{
      index: number;
      revision: number;
      type: "remove";
      zone: ToolbarZoneName;
    }>
  | Readonly<{
      from: ToolbarLayoutLocation;
      revision: number;
      to: Readonly<{
        index: number;
        parentPath: readonly number[];
        zone: ToolbarZoneName;
      }>;
      type: "move-node";
    }>
  | Readonly<{
      location: ToolbarLayoutLocation;
      revision: number;
      type: "remove-node";
    }>
  | Readonly<{
      allow: boolean;
      revision: number;
      type: "set-multiple-placements";
    }>
  | Readonly<{
      direction: ToolbarLayoutDirection;
      location: ToolbarLayoutLocation;
      revision: number;
      type: "set-container-direction";
    }>
  | Readonly<{
      location: ToolbarLayoutLocation;
      revision: number;
      style: ProjectWidgetStyleId;
      type: "set-node-style";
    }>
  | Readonly<{ revision: number; type: "clean-layout" }>
  | Readonly<{ revision: number; type: "reset-layout" }>
  | Readonly<{
      style: Readonly<Partial<ToolbarStyleSnapshot>>;
      type: "set-style";
    }>
  | Readonly<{ type: "reset-style" }>
  | Readonly<{
      panels: Readonly<Partial<ShellPanelConfigSnapshot>>;
      type: "set-panels";
    }>
  | Readonly<{ type: "reset-panels" }>;

export type ToolbarWidgetsStateEvent = Readonly<{
  revision: number;
  snapshot: ToolbarWidgetsSnapshot;
  type: "snapshot";
}>;

export type ToolbarWidgetsPopupEvent = Readonly<{
  open: boolean;
  type: "widget-popup";
}>;

export type BrowserToolbarWidgetsBridge = Readonly<{
  edit: (operation: ToolbarWidgetsEditOperation) => Promise<boolean>;
  invoke: (
    handle: string,
    host: unknown,
    triggerEvent?: unknown,
  ) => Promise<boolean>;
  snapshot: () => ToolbarWidgetsSnapshot;
  subscribe: (
    listener: (event: ToolbarWidgetsStateEvent) => void,
  ) => () => boolean;
  subscribePopup: (
    listener: (event: ToolbarWidgetsPopupEvent) => void,
  ) => () => boolean;
}>;

export type BrowserToolbarWidgetsState = Readonly<{
  revision: number;
  snapshot: ToolbarWidgetsSnapshot;
}>;

export type BrowserToolbarWidgetsStateAdapter = Readonly<{
  dispose: () => boolean;
  edit: (operation: ToolbarWidgetsEditOperation) => Promise<boolean>;
  invoke: (
    handle: string,
    host: unknown,
    triggerEvent?: unknown,
  ) => Promise<boolean>;
  snapshot: () => BrowserToolbarWidgetsState;
  status: () => Readonly<{
    disposed: boolean;
    popupSubscriberCount: number;
    revision: number;
    subscriberCount: number;
  }>;
  subscribe: (
    listener: (state: BrowserToolbarWidgetsState) => void,
  ) => () => boolean;
  subscribePopup: (listener: (open: boolean) => void) => () => boolean;
}>;
