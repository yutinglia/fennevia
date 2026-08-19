import {
  isToolbarPaletteToken,
  isToolbarZoneName,
  type ToolbarWidgetsEditOperation,
  type ToolbarZoneName,
} from "./toolbar-widgets-state.ts";

export const toolbarWidgetDragMimeType =
  "application/x-fennevia-toolbar-widget";

const ZONE_MAX_ENTRIES = 48;

export type ToolbarWidgetDragSource =
  | Readonly<{ token: string; type: "palette" }>
  | Readonly<{
      index: number;
      type: "zone";
      zone: ToolbarZoneName;
    }>;

export type ToolbarWidgetDropTarget =
  | Readonly<{ type: "palette" }>
  | Readonly<{
      insertBefore: number;
      type: "zone";
      zone: ToolbarZoneName;
    }>;

let activeDrag: ToolbarWidgetDragSource | null = null;

function isBoundedIndex(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= ZONE_MAX_ENTRIES
  );
}

function isEditRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function copyToolbarWidgetDragSource(
  candidate: unknown,
): ToolbarWidgetDragSource {
  if (!candidate || typeof candidate !== "object") {
    throw new Error("FENNEVIA_TOOLBAR_WIDGET_DRAG_SOURCE_INVALID");
  }
  const source = candidate as Record<string, unknown>;
  if (source.type === "palette" && isToolbarPaletteToken(source.token)) {
    return Object.freeze({ token: source.token, type: "palette" as const });
  }
  if (
    source.type === "zone" &&
    isToolbarZoneName(source.zone) &&
    isBoundedIndex(source.index)
  ) {
    return Object.freeze({
      index: source.index,
      type: "zone" as const,
      zone: source.zone,
    });
  }
  throw new Error("FENNEVIA_TOOLBAR_WIDGET_DRAG_SOURCE_INVALID");
}

export function serializeToolbarWidgetDrag(
  source: ToolbarWidgetDragSource,
): string {
  return JSON.stringify(copyToolbarWidgetDragSource(source));
}

export function parseToolbarWidgetDrag(
  candidate: unknown,
): ToolbarWidgetDragSource | null {
  if (typeof candidate !== "string" || candidate.length === 0) {
    return null;
  }
  try {
    return copyToolbarWidgetDragSource(JSON.parse(candidate) as unknown);
  } catch {
    return null;
  }
}

export function startToolbarWidgetDrag(
  source: ToolbarWidgetDragSource,
): ToolbarWidgetDragSource {
  const copied = copyToolbarWidgetDragSource(source);
  activeDrag = copied;
  return copied;
}

export function getActiveToolbarWidgetDrag(): ToolbarWidgetDragSource | null {
  return activeDrag;
}

export function clearToolbarWidgetDrag(): void {
  activeDrag = null;
}

export function resolveWidgetInsertBefore(
  itemMids: readonly number[],
  pointer: number,
): number | null {
  if (!Array.isArray(itemMids) || !Number.isFinite(pointer)) {
    return null;
  }
  if (itemMids.some((midpoint) => !Number.isFinite(midpoint))) {
    return null;
  }
  let insertBefore = itemMids.length;
  for (const [index, midpoint] of itemMids.entries()) {
    if (pointer < midpoint) {
      insertBefore = index;
      break;
    }
  }
  return insertBefore;
}

export function resolveSameZoneMoveIndex(
  fromIndex: number,
  insertBefore: number,
): number | null {
  if (!isBoundedIndex(fromIndex) || !isBoundedIndex(insertBefore)) {
    return null;
  }
  const toIndex = insertBefore > fromIndex ? insertBefore - 1 : insertBefore;
  return toIndex === fromIndex ? null : toIndex;
}

export function createToolbarWidgetDropEdit(
  source: ToolbarWidgetDragSource,
  target: ToolbarWidgetDropTarget,
  revision: number,
): ToolbarWidgetsEditOperation | null {
  let copiedSource: ToolbarWidgetDragSource;
  try {
    copiedSource = copyToolbarWidgetDragSource(source);
  } catch {
    return null;
  }
  if (!isEditRevision(revision) || !target || typeof target !== "object") {
    return null;
  }

  if (target.type === "palette") {
    if (copiedSource.type !== "zone") {
      return null;
    }
    return Object.freeze({
      index: copiedSource.index,
      revision,
      type: "remove" as const,
      zone: copiedSource.zone,
    });
  }

  if (
    target.type !== "zone" ||
    !isToolbarZoneName(target.zone) ||
    !isBoundedIndex(target.insertBefore)
  ) {
    return null;
  }

  if (copiedSource.type === "palette") {
    return Object.freeze({
      index: target.insertBefore,
      revision,
      token: copiedSource.token,
      type: "add" as const,
      zone: target.zone,
    });
  }

  if (copiedSource.zone === target.zone) {
    const toIndex = resolveSameZoneMoveIndex(
      copiedSource.index,
      target.insertBefore,
    );
    if (toIndex === null) {
      return null;
    }
    return Object.freeze({
      fromIndex: copiedSource.index,
      fromZone: copiedSource.zone,
      revision,
      toIndex,
      toZone: target.zone,
      type: "move" as const,
    });
  }

  return Object.freeze({
    fromIndex: copiedSource.index,
    fromZone: copiedSource.zone,
    revision,
    toIndex: target.insertBefore,
    toZone: target.zone,
    type: "move" as const,
  });
}
