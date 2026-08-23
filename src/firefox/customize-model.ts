import {
  copyToolbarStyleSnapshot,
  copyShellPanelConfigSnapshot,
  createDefaultShellPanelConfig,
  createDefaultToolbarStyle,
  isFenneviaToolbarAction,
  isToolbarZoneName,
  toolbarZoneNames,
  type FenneviaToolbarAction,
  type ToolbarStyleSnapshot,
  type ShellPanelConfigSnapshot,
  type ToolbarZoneName,
} from "../app/toolbar-widgets-state.ts";

export const customizeSpecialKinds = Object.freeze([
  "separator",
  "spacer",
  "spring",
] as const);

export type CustomizeSpecialKind = (typeof customizeSpecialKinds)[number];

const customizeSpecialKindSet = new Set<CustomizeSpecialKind>(
  customizeSpecialKinds,
);

export type CustomizeLayoutEntry =
  | Readonly<{ id: string; type: "widget" }>
  | Readonly<{ kind: CustomizeSpecialKind; type: "special" }>
  | Readonly<{ id: FenneviaToolbarAction; type: "fennevia" }>;

export type CustomizeLayoutZones = Readonly<
  Record<ToolbarZoneName, readonly CustomizeLayoutEntry[]>
>;

export type CustomizeLayout = Readonly<{
  adopted: readonly string[];
  version: 1;
  zones: CustomizeLayoutZones;
}>;

export type CustomizeStyle = ToolbarStyleSnapshot;
export type CustomizePanels = ShellPanelConfigSnapshot;

export const customizeLayoutBounds = Object.freeze({
  adoptedMaxEntries: 64,
  serializedMaxLength: 16384,
  widgetIdMaxLength: 128,
  zoneMaxEntries: 48,
});

const WIDGET_ID_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/u;

function createModelError(code: string): Error {
  const error = new Error(code);
  error.name = "FenneviaCustomizeModelError";
  Object.defineProperties(error, {
    fenneviaCode: { enumerable: false, value: code },
    fenneviaPhase: { enumerable: false, value: "customize-model" },
  });
  return error;
}

export function isCustomizeSpecialKind(
  candidate: unknown,
): candidate is CustomizeSpecialKind {
  return (
    typeof candidate === "string" &&
    customizeSpecialKindSet.has(candidate as CustomizeSpecialKind)
  );
}

export function isCustomizeWidgetId(candidate: unknown): candidate is string {
  return typeof candidate === "string" && WIDGET_ID_PATTERN.test(candidate);
}

export function copyCustomizeLayoutEntry(
  candidate: unknown,
): CustomizeLayoutEntry {
  if (!candidate || typeof candidate !== "object") {
    throw createModelError("FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID");
  }
  const entry = candidate as Record<string, unknown>;
  if (entry.type === "widget" && isCustomizeWidgetId(entry.id)) {
    return Object.freeze({ id: entry.id, type: "widget" as const });
  }
  if (entry.type === "special" && isCustomizeSpecialKind(entry.kind)) {
    return Object.freeze({ kind: entry.kind, type: "special" as const });
  }
  if (entry.type === "fennevia" && isFenneviaToolbarAction(entry.id)) {
    return Object.freeze({ id: entry.id, type: "fennevia" as const });
  }
  throw createModelError("FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID");
}

function copyLayoutZones(candidate: unknown): CustomizeLayoutZones {
  if (!candidate || typeof candidate !== "object") {
    throw createModelError("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
  }
  const zones = candidate as Record<string, unknown>;
  const entries: Array<
    readonly [ToolbarZoneName, readonly CustomizeLayoutEntry[]]
  > = [];
  for (const zone of toolbarZoneNames) {
    const zoneEntries = zones[zone];
    if (
      !Array.isArray(zoneEntries) ||
      zoneEntries.length > customizeLayoutBounds.zoneMaxEntries
    ) {
      throw createModelError("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
    }
    entries.push([
      zone,
      Object.freeze(zoneEntries.map(copyCustomizeLayoutEntry)),
    ]);
  }
  return Object.freeze(Object.fromEntries(entries)) as CustomizeLayoutZones;
}

export function copyCustomizeLayout(candidate: unknown): CustomizeLayout {
  if (!candidate || typeof candidate !== "object") {
    throw createModelError("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
  }
  const layout = candidate as Record<string, unknown>;
  if (
    layout.version !== 1 ||
    !Array.isArray(layout.adopted) ||
    layout.adopted.length > customizeLayoutBounds.adoptedMaxEntries ||
    layout.adopted.some((id) => !isCustomizeWidgetId(id))
  ) {
    throw createModelError("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
  }
  return Object.freeze({
    adopted: Object.freeze([...(layout.adopted as string[])]),
    version: 1 as const,
    zones: copyLayoutZones(layout.zones),
  });
}

export function createEmptyCustomizeLayout(): CustomizeLayout {
  return Object.freeze({
    adopted: Object.freeze([]),
    version: 1 as const,
    zones: Object.freeze({
      bottom: Object.freeze([]),
      left: Object.freeze([]),
      right: Object.freeze([]),
      top: Object.freeze([]),
    }),
  });
}

export function createCustomizeLayout(
  zones: Readonly<
    Partial<Record<ToolbarZoneName, readonly CustomizeLayoutEntry[]>>
  >,
  adopted: readonly string[] = [],
): CustomizeLayout {
  const empty = createEmptyCustomizeLayout();
  return copyCustomizeLayout({
    adopted,
    version: 1,
    zones: { ...empty.zones, ...zones },
  });
}

export function parseCustomizeLayout(text: string): CustomizeLayout | null {
  if (
    typeof text !== "string" ||
    text === "" ||
    text.length > customizeLayoutBounds.serializedMaxLength
  ) {
    return null;
  }
  try {
    return copyCustomizeLayout(JSON.parse(text));
  } catch {
    return null;
  }
}

export function serializeCustomizeLayout(layout: CustomizeLayout): string {
  const serialized = JSON.stringify(copyCustomizeLayout(layout));
  if (serialized.length > customizeLayoutBounds.serializedMaxLength) {
    throw createModelError("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_TOO_LARGE");
  }
  return serialized;
}

export function parseCustomizeStyle(text: string): CustomizeStyle | null {
  if (
    typeof text !== "string" ||
    text === "" ||
    text.length > customizeLayoutBounds.serializedMaxLength
  ) {
    return null;
  }
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || parsed.version !== 1) {
      return null;
    }
    return copyToolbarStyleSnapshot({
      ...createDefaultToolbarStyle(),
      ...parsed,
      version: undefined,
    } as unknown as ToolbarStyleSnapshot);
  } catch {
    return null;
  }
}

export function serializeCustomizeStyle(style: CustomizeStyle): string {
  return JSON.stringify({ ...copyToolbarStyleSnapshot(style), version: 1 });
}

const customizePanelKeys = new Set([
  "allowCompactWindow",
  "bottomDownloadsEnabled",
  "bottomProgressLight",
  "sidePanelLayout",
  "topProgressLight",
  "version",
]);

export function parseCustomizePanels(text: string): CustomizePanels | null {
  if (
    typeof text !== "string" ||
    text === "" ||
    text.length > customizeLayoutBounds.serializedMaxLength
  ) {
    return null;
  }
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.version !== 1 ||
      Object.keys(parsed).some((key) => !customizePanelKeys.has(key))
    ) {
      return null;
    }
    return copyShellPanelConfigSnapshot({
      ...createDefaultShellPanelConfig(),
      ...parsed,
      version: undefined,
    } as unknown as ShellPanelConfigSnapshot);
  } catch {
    return null;
  }
}

export function serializeCustomizePanels(panels: CustomizePanels): string {
  return JSON.stringify({
    ...copyShellPanelConfigSnapshot(panels),
    version: 1,
  });
}

export function findCustomizeLayoutEntry(
  layout: CustomizeLayout,
  entry: CustomizeLayoutEntry,
): Readonly<{ index: number; zone: ToolbarZoneName }> | null {
  if (entry.type === "special") {
    return null;
  }
  for (const zone of toolbarZoneNames) {
    const zoneEntries = layout.zones[zone];
    for (const [index, candidate] of zoneEntries.entries()) {
      if (candidate.type === entry.type && candidate.id === entry.id) {
        return Object.freeze({ index, zone });
      }
    }
  }
  return null;
}

const requireZone = (zone: unknown): ToolbarZoneName => {
  if (!isToolbarZoneName(zone)) {
    throw createModelError("FENNEVIA_CUSTOMIZE_MODEL_ZONE_INVALID");
  }
  return zone;
};

const clampIndex = (index: number, length: number): number => {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw createModelError("FENNEVIA_CUSTOMIZE_MODEL_INDEX_INVALID");
  }
  return Math.min(index, length);
};

const withZoneEntries = (
  layout: CustomizeLayout,
  zone: ToolbarZoneName,
  entries: readonly CustomizeLayoutEntry[],
): CustomizeLayout =>
  Object.freeze({
    adopted: layout.adopted,
    version: 1 as const,
    zones: Object.freeze({
      ...layout.zones,
      [zone]: Object.freeze([...entries]),
    }) as CustomizeLayoutZones,
  });

export function addCustomizeLayoutEntry(
  layout: CustomizeLayout,
  entry: CustomizeLayoutEntry,
  zone: ToolbarZoneName,
  index: number,
): CustomizeLayout {
  const validatedEntry = copyCustomizeLayoutEntry(entry);
  const targetZone = requireZone(zone);
  const existing = findCustomizeLayoutEntry(layout, validatedEntry);
  let base = layout;
  if (existing) {
    base = removeCustomizeLayoutEntry(layout, existing.zone, existing.index);
  }
  const entries = [...base.zones[targetZone]];
  if (entries.length >= customizeLayoutBounds.zoneMaxEntries) {
    throw createModelError("FENNEVIA_CUSTOMIZE_MODEL_ZONE_FULL");
  }
  entries.splice(clampIndex(index, entries.length), 0, validatedEntry);
  return withZoneEntries(base, targetZone, entries);
}

export function removeCustomizeLayoutEntry(
  layout: CustomizeLayout,
  zone: ToolbarZoneName,
  index: number,
): CustomizeLayout {
  const targetZone = requireZone(zone);
  const entries = [...layout.zones[targetZone]];
  if (!Number.isSafeInteger(index) || index < 0 || index >= entries.length) {
    throw createModelError("FENNEVIA_CUSTOMIZE_MODEL_INDEX_INVALID");
  }
  entries.splice(index, 1);
  return withZoneEntries(layout, targetZone, entries);
}

export function getCustomizeLayoutEntry(
  layout: CustomizeLayout,
  zone: ToolbarZoneName,
  index: number,
): CustomizeLayoutEntry {
  const targetZone = requireZone(zone);
  const entries = layout.zones[targetZone];
  if (!Number.isSafeInteger(index) || index < 0 || index >= entries.length) {
    throw createModelError("FENNEVIA_CUSTOMIZE_MODEL_INDEX_INVALID");
  }
  return entries[index];
}

export function moveCustomizeLayoutEntry(
  layout: CustomizeLayout,
  fromZone: ToolbarZoneName,
  fromIndex: number,
  toZone: ToolbarZoneName,
  toIndex: number,
): CustomizeLayout {
  const entry = getCustomizeLayoutEntry(layout, fromZone, fromIndex);
  const removed = removeCustomizeLayoutEntry(layout, fromZone, fromIndex);
  const entries = [...removed.zones[requireZone(toZone)]];
  if (entries.length >= customizeLayoutBounds.zoneMaxEntries) {
    throw createModelError("FENNEVIA_CUSTOMIZE_MODEL_ZONE_FULL");
  }
  entries.splice(clampIndex(toIndex, entries.length), 0, entry);
  return withZoneEntries(removed, toZone, entries);
}

export function withCustomizeAdopted(
  layout: CustomizeLayout,
  id: string,
): CustomizeLayout {
  if (!isCustomizeWidgetId(id)) {
    throw createModelError("FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID");
  }
  if (layout.adopted.includes(id)) {
    return layout;
  }
  if (layout.adopted.length >= customizeLayoutBounds.adoptedMaxEntries) {
    throw createModelError("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_TOO_LARGE");
  }
  return Object.freeze({
    adopted: Object.freeze([...layout.adopted, id]),
    version: 1 as const,
    zones: layout.zones,
  });
}

export function withoutCustomizeAdopted(
  layout: CustomizeLayout,
  id: string,
): CustomizeLayout {
  if (!layout.adopted.includes(id)) {
    return layout;
  }
  return Object.freeze({
    adopted: Object.freeze(layout.adopted.filter((entry) => entry !== id)),
    version: 1 as const,
    zones: layout.zones,
  });
}

export function customizeLayoutContainsWidget(
  layout: CustomizeLayout,
  id: string,
): boolean {
  return (
    findCustomizeLayoutEntry(layout, {
      id,
      type: "widget",
    } as CustomizeLayoutEntry) !== null
  );
}
