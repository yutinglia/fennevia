import {
  copyToolbarLayoutPath,
  findToolbarLayoutInstance,
  isToolbarPaletteToken,
  isToolbarZoneName,
  type ToolbarLayoutZonesSnapshot,
  type ToolbarWidgetsEditOperation,
  type ToolbarZoneName,
} from "./toolbar-widgets-state.ts";

export const toolbarWidgetDragMimeType =
  "application/x-fennevia-toolbar-widget";

const ZONE_MAX_ENTRIES = 48;
const LAYOUT_INSTANCE_PATTERN = /^layout-[1-9][0-9]{0,5}$/u;

export type ToolbarWidgetDragSource =
  | Readonly<{ token: string; type: "palette" }>
  | Readonly<{ instanceId: string; type: "layout-node" }>
  | Readonly<{
      index: number;
      type: "zone";
      zone: ToolbarZoneName;
    }>;

export type ToolbarWidgetDropTarget =
  | Readonly<{ type: "palette" }>
  | Readonly<{
      insertBefore: number;
      parentPath: readonly number[];
      type: "layout";
      zone: ToolbarZoneName;
    }>
  | Readonly<{
      insertBefore: number;
      type: "zone";
      zone: ToolbarZoneName;
    }>;

let activeDrag: ToolbarWidgetDragSource | null = null;
const dragListeners = new Set<
  (source: ToolbarWidgetDragSource | null) => void
>();

function publishToolbarWidgetDrag(): void {
  for (const listener of dragListeners) {
    listener(activeDrag);
  }
}

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
    source.type === "layout-node" &&
    typeof source.instanceId === "string" &&
    LAYOUT_INSTANCE_PATTERN.test(source.instanceId)
  ) {
    return Object.freeze({
      instanceId: source.instanceId,
      type: "layout-node" as const,
    });
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
  publishToolbarWidgetDrag();
  return copied;
}

export function getActiveToolbarWidgetDrag(): ToolbarWidgetDragSource | null {
  return activeDrag;
}

export function clearToolbarWidgetDrag(): void {
  if (activeDrag === null) {
    return;
  }
  activeDrag = null;
  publishToolbarWidgetDrag();
}

export function subscribeToolbarWidgetDrag(
  listener: (source: ToolbarWidgetDragSource | null) => void,
): () => void {
  dragListeners.add(listener);
  listener(activeDrag);
  return () => {
    dragListeners.delete(listener);
  };
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
  layout?: ToolbarLayoutZonesSnapshot,
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
    if (copiedSource.type === "layout-node") {
      const location = layout
        ? findToolbarLayoutInstance(layout, copiedSource.instanceId)
        : null;
      return location
        ? Object.freeze({
            location,
            revision,
            type: "remove-node" as const,
          })
        : null;
    }
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
    target.type === "layout" &&
    isToolbarZoneName(target.zone) &&
    isBoundedIndex(target.insertBefore)
  ) {
    let parentPath: readonly number[];
    try {
      parentPath = copyToolbarLayoutPath(target.parentPath);
    } catch {
      return null;
    }
    if (copiedSource.type === "palette") {
      return Object.freeze({
        index: target.insertBefore,
        parentPath,
        revision,
        token: copiedSource.token,
        type: "add-node" as const,
        zone: target.zone,
      });
    }
    if (copiedSource.type === "layout-node") {
      const from = layout
        ? findToolbarLayoutInstance(layout, copiedSource.instanceId)
        : null;
      return from
        ? Object.freeze({
            from,
            revision,
            to: Object.freeze({
              index: target.insertBefore,
              parentPath,
              zone: target.zone,
            }),
            type: "move-node" as const,
          })
        : null;
    }
    return null;
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

  if (copiedSource.type !== "zone") {
    return null;
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
