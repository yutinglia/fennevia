// SPDX-License-Identifier: MPL-2.0

import { edgeInteractionBounds } from "../edge-surfaces/contracts.ts";

export const toolbarWidgetKinds = Object.freeze([
  "built-in",
  "extension-action",
  "fennevia",
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

export const toolbarPaletteKinds = Object.freeze([
  "built-in",
  "extension-action",
  "fennevia",
  "special",
] as const);

export type ToolbarPaletteKind = (typeof toolbarPaletteKinds)[number];

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
export const toolbarStyleThemeSet = new Set<ToolbarStyleTheme>(
  toolbarStyleThemes,
);
export const toolbarStyleDensitySet = new Set<ToolbarStyleDensity>(
  toolbarStyleDensities,
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
}>;

export type ToolbarPaletteEntrySnapshot = Readonly<{
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

export type ToolbarWidgetsSnapshot = Readonly<{
  available: boolean;
  canEdit: boolean;
  layoutCustomized: boolean;
  palette: readonly ToolbarPaletteEntrySnapshot[];
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
  | Readonly<{ revision: number; type: "reset-layout" }>
  | Readonly<{
      style: Readonly<Partial<ToolbarStyleSnapshot>>;
      type: "set-style";
    }>
  | Readonly<{ type: "reset-style" }>;

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
