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
  blur: Object.freeze({ max: 32, min: 0 }),
  fontSize: Object.freeze({ max: 14, min: 11 }),
  radius: Object.freeze({ max: 16, min: 0 }),
  surfaceOpacity: Object.freeze({ max: 100, min: 50 }),
});

export const toolbarAccentPattern = /^#[0-9a-f]{6}$/u;

const LABEL_MAX_LENGTH = 200;
const TOOLTIP_MAX_LENGTH = 300;
const BADGE_MAX_LENGTH = 8;
const COLOR_MAX_LENGTH = 64;
const ICON_URL_MAX_LENGTH = 512;
const PALETTE_MAX_ENTRIES = 256;
const ZONE_MAX_ENTRIES = 48;
const ICON_TOKEN_PATTERN = /^[a-z][a-z0-9-]{0,31}$/u;
const PALETTE_TOKEN_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;
const MOZ_EXTENSION_URL_PREFIX = "moz-extension://";
const CHROME_URL_PREFIX = "chrome://";
const RESOURCE_URL_PREFIX = "resource://";
const FORBIDDEN_ICON_URL_CHARACTER_PATTERN = /["'\\<>\s]/u;

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

const toolbarWidgetKindSet = new Set<ToolbarWidgetKind>(toolbarWidgetKinds);
const toolbarZoneNameSet = new Set<ToolbarZoneName>(toolbarZoneNames);
const fenneviaToolbarActionSet = new Set<FenneviaToolbarAction>(
  fenneviaToolbarActions,
);
const toolbarPaletteKindSet = new Set<ToolbarPaletteKind>(toolbarPaletteKinds);
const toolbarStyleThemeSet = new Set<ToolbarStyleTheme>(toolbarStyleThemes);
const toolbarStyleDensitySet = new Set<ToolbarStyleDensity>(
  toolbarStyleDensities,
);

export const nonInteractiveToolbarWidgetKinds = Object.freeze([
  "separator",
  "spacer",
  "spring",
] as const);

const nonInteractiveKindSet = new Set<string>(nonInteractiveToolbarWidgetKinds);

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
  blur: number;
  density: ToolbarStyleDensity;
  fontSize: number;
  radius: number;
  surfaceOpacity: number;
  theme: ToolbarStyleTheme;
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
  invoke: (handle: string, host: unknown) => Promise<boolean>;
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
  invoke: (handle: string, host: unknown) => Promise<boolean>;
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

const createStateError = (code: string): Error => {
  const error = new Error(code);
  error.name = "FenneviaToolbarWidgetsStateError";
  Object.defineProperties(error, {
    fenneviaCode: { enumerable: false, value: code },
    fenneviaPhase: { enumerable: false, value: "toolbar-widgets-state" },
  });
  return error;
};

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
    blur: 18,
    density: "cozy" as const,
    fontSize: 12,
    radius: 4,
    surfaceOpacity: 94,
    theme: "auto" as const,
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

const isToolbarAccent = (value: unknown): value is string =>
  typeof value === "string" &&
  (value === "" || toolbarAccentPattern.test(value));

export function copyToolbarStyleSnapshot(
  candidate: ToolbarStyleSnapshot,
): ToolbarStyleSnapshot {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    !isToolbarAccent(candidate.accent) ||
    !isBoundedStyleNumber(candidate.blur, toolbarStyleBounds.blur) ||
    !isToolbarStyleDensity(candidate.density) ||
    !isBoundedStyleNumber(candidate.fontSize, toolbarStyleBounds.fontSize) ||
    !isBoundedStyleNumber(candidate.radius, toolbarStyleBounds.radius) ||
    !isBoundedStyleNumber(
      candidate.surfaceOpacity,
      toolbarStyleBounds.surfaceOpacity,
    ) ||
    !isToolbarStyleTheme(candidate.theme)
  ) {
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
  }
  return Object.freeze({
    accent: candidate.accent,
    blur: candidate.blur,
    density: candidate.density,
    fontSize: candidate.fontSize,
    radius: candidate.radius,
    surfaceOpacity: candidate.surfaceOpacity,
    theme: candidate.theme,
  });
}

export function copyToolbarStylePartial(
  candidate: Readonly<Partial<ToolbarStyleSnapshot>>,
): Readonly<Partial<ToolbarStyleSnapshot>> {
  if (!candidate || typeof candidate !== "object") {
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
  }
  const merged = {
    ...createDefaultToolbarStyle(),
    ...candidate,
  };
  const validated = copyToolbarStyleSnapshot(merged);
  const keys = Object.keys(candidate);
  if (
    keys.length === 0 ||
    keys.some((key) => !(key in validated)) ||
    keys.some(
      (key) =>
        candidate[key as keyof ToolbarStyleSnapshot] !==
        validated[key as keyof ToolbarStyleSnapshot],
    )
  ) {
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
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
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_TEXT_INVALID");
  }
  return value;
};

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
    typeof candidate.fenneviaAction !== "string"
  ) {
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_WIDGET_INVALID");
  }
  const nonInteractive = nonInteractiveKindSet.has(candidate.kind);
  const isFennevia = candidate.kind === "fennevia";
  if (
    (nonInteractive || isFennevia || candidate.missing) &&
    candidate.handle !== ""
  ) {
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_HANDLE_INVALID");
  }
  if (
    !nonInteractive &&
    !isFennevia &&
    !candidate.missing &&
    candidate.handle === ""
  ) {
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_HANDLE_INVALID");
  }
  if (
    isFennevia
      ? !isFenneviaToolbarAction(candidate.fenneviaAction)
      : candidate.fenneviaAction !== ""
  ) {
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_ACTION_INVALID");
  }
  if (isFennevia && candidate.missing) {
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_WIDGET_INVALID");
  }
  const icon = requireBoundedString(candidate.icon, 32);
  if (icon !== "" && !ICON_TOKEN_PATTERN.test(icon)) {
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_ICON_INVALID");
  }
  const iconUrl = requireBoundedString(candidate.iconUrl, ICON_URL_MAX_LENGTH);
  if (!isAllowedToolbarWidgetIconUrl(iconUrl)) {
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_ICON_URL_INVALID");
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
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_PALETTE_INVALID");
  }
  const icon = requireBoundedString(candidate.icon, 32);
  if (icon !== "" && !ICON_TOKEN_PATTERN.test(icon)) {
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_ICON_INVALID");
  }
  const iconUrl = requireBoundedString(candidate.iconUrl, ICON_URL_MAX_LENGTH);
  if (!isAllowedToolbarWidgetIconUrl(iconUrl)) {
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_ICON_URL_INVALID");
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

export function createUnavailableToolbarWidgetsSnapshot(): ToolbarWidgetsSnapshot {
  return Object.freeze({
    available: false,
    canEdit: false,
    layoutCustomized: false,
    palette: Object.freeze([]),
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
    typeof candidate.canEdit !== "boolean" ||
    typeof candidate.layoutCustomized !== "boolean" ||
    !Array.isArray(candidate.palette) ||
    candidate.palette.length > PALETTE_MAX_ENTRIES ||
    !candidate.zones ||
    typeof candidate.zones !== "object"
  ) {
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_SNAPSHOT_INVALID");
  }
  const zoneEntries: Array<
    readonly [ToolbarZoneName, readonly ToolbarWidgetSnapshot[]]
  > = [];
  for (const zone of toolbarZoneNames) {
    const widgets = candidate.zones[zone];
    if (!Array.isArray(widgets) || widgets.length > ZONE_MAX_ENTRIES) {
      throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_ZONE_INVALID");
    }
    zoneEntries.push([
      zone,
      Object.freeze(widgets.map(copyToolbarWidgetSnapshot)),
    ]);
  }
  return Object.freeze({
    available: candidate.available,
    canEdit: candidate.canEdit,
    layoutCustomized: candidate.layoutCustomized,
    palette: Object.freeze(
      candidate.palette.map(copyToolbarPaletteEntrySnapshot),
    ),
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
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
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
        throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
      }
      return Object.freeze({
        index: candidate.index,
        revision: candidate.revision,
        token: candidate.token,
        type: "add" as const,
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
        throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
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
        throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
      }
      return Object.freeze({
        index: candidate.index,
        revision: candidate.revision,
        type: "remove" as const,
        zone: candidate.zone,
      });
    }
    case "reset-layout": {
      if (!isEditRevision(candidate.revision)) {
        throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
      }
      return Object.freeze({
        revision: candidate.revision,
        type: "reset-layout" as const,
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
    default: {
      throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
    }
  }
}

export function createBrowserToolbarWidgetsState(
  snapshot: ToolbarWidgetsSnapshot,
  revision = 0,
): BrowserToolbarWidgetsState {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_REVISION_INVALID");
  }
  return Object.freeze({
    revision,
    snapshot: copyToolbarWidgetsSnapshot(snapshot),
  });
}

export function reduceBrowserToolbarWidgetsState(
  state: BrowserToolbarWidgetsState,
  event: ToolbarWidgetsStateEvent,
): BrowserToolbarWidgetsState {
  if (
    event?.type !== "snapshot" ||
    !Number.isSafeInteger(event.revision) ||
    event.revision < 1
  ) {
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_EVENT_INVALID");
  }
  if (event.revision <= state.revision) {
    return state;
  }
  return createBrowserToolbarWidgetsState(event.snapshot, event.revision);
}

export function createBrowserToolbarWidgetsStateAdapter(
  bridge: BrowserToolbarWidgetsBridge,
): BrowserToolbarWidgetsStateAdapter {
  if (
    !bridge ||
    typeof bridge !== "object" ||
    typeof bridge.edit !== "function" ||
    typeof bridge.invoke !== "function" ||
    typeof bridge.snapshot !== "function" ||
    typeof bridge.subscribe !== "function" ||
    typeof bridge.subscribePopup !== "function"
  ) {
    throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_BRIDGE_INVALID");
  }

  let activeBridge: BrowserToolbarWidgetsBridge | null = bridge;
  let disposed = false;
  let state = createBrowserToolbarWidgetsState(bridge.snapshot());
  const listeners = new Set<(state: BrowserToolbarWidgetsState) => void>();
  const popupListeners = new Set<(open: boolean) => void>();

  const unsubscribeBridge = bridge.subscribe((event) => {
    if (disposed) {
      return;
    }
    const nextState = reduceBrowserToolbarWidgetsState(state, event);
    if (nextState === state) {
      return;
    }
    state = nextState;
    for (const listener of Array.from(listeners)) {
      listener(state);
    }
  });
  if (typeof unsubscribeBridge !== "function") {
    throw createStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_SUBSCRIPTION_INVALID",
    );
  }

  const unsubscribePopupBridge = bridge.subscribePopup((event) => {
    if (disposed) {
      return;
    }
    if (event?.type !== "widget-popup" || typeof event.open !== "boolean") {
      throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_EVENT_INVALID");
    }
    for (const listener of Array.from(popupListeners)) {
      listener(event.open);
    }
  });
  if (typeof unsubscribePopupBridge !== "function") {
    throw createStateError(
      "FENNEVIA_TOOLBAR_WIDGETS_STATE_SUBSCRIPTION_INVALID",
    );
  }

  const requireBridge = (): BrowserToolbarWidgetsBridge => {
    if (disposed || !activeBridge) {
      throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_DISPOSED");
    }
    return activeBridge;
  };

  return Object.freeze({
    dispose(): boolean {
      if (disposed) {
        return false;
      }
      disposed = true;
      activeBridge = null;
      listeners.clear();
      popupListeners.clear();
      unsubscribePopupBridge();
      unsubscribeBridge();
      return true;
    },

    async edit(operation: ToolbarWidgetsEditOperation): Promise<boolean> {
      const validated = copyToolbarWidgetsEditOperation(operation);
      const result = await requireBridge().edit(validated);
      if (typeof result !== "boolean") {
        throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_RESULT_INVALID");
      }
      return result;
    },

    async invoke(handle: string, host: unknown): Promise<boolean> {
      if (typeof handle !== "string" || handle === "") {
        throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_HANDLE_INVALID");
      }
      if (host === undefined || host === null || typeof host !== "object") {
        throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_HOST_INVALID");
      }
      const result = await requireBridge().invoke(handle, host);
      if (typeof result !== "boolean") {
        throw createStateError("FENNEVIA_TOOLBAR_WIDGETS_STATE_RESULT_INVALID");
      }
      return result;
    },

    snapshot(): BrowserToolbarWidgetsState {
      requireBridge();
      return state;
    },

    status() {
      return Object.freeze({
        disposed,
        popupSubscriberCount: popupListeners.size,
        revision: state.revision,
        subscriberCount: listeners.size,
      });
    },

    subscribe(
      listener: (state: BrowserToolbarWidgetsState) => void,
    ): () => boolean {
      requireBridge();
      if (typeof listener !== "function") {
        throw createStateError(
          "FENNEVIA_TOOLBAR_WIDGETS_STATE_LISTENER_INVALID",
        );
      }
      listeners.add(listener);
      let subscribed = true;
      return Object.freeze(() => {
        if (!subscribed) {
          return false;
        }
        subscribed = false;
        listeners.delete(listener);
        return true;
      });
    },

    subscribePopup(listener: (open: boolean) => void): () => boolean {
      requireBridge();
      if (typeof listener !== "function") {
        throw createStateError(
          "FENNEVIA_TOOLBAR_WIDGETS_STATE_LISTENER_INVALID",
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
}
