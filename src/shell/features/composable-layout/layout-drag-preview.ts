// SPDX-License-Identifier: MPL-2.0

import type {
  ToolbarWidgetDragPreviewKind,
  ToolbarWidgetDragSource,
} from "../../../app/toolbar-widget-drag.ts";
import type { FenneviaLocale } from "../../../app/locale-state.ts";
import type {
  ToolbarLayoutNodeSnapshot,
  ToolbarPaletteEntrySnapshot,
  ToolbarWidgetSnapshot,
  ToolbarWidgetsSnapshot,
} from "../../../app/toolbar-widgets-state.ts";
import { localizeWidgetLabel } from "../../locale-ui.ts";

export type LayoutDragStructureIcon =
  "center" | "column" | "expanded" | "padding" | "row";

export type LayoutDragPreviewDescriptor = Readonly<{
  glyph: ToolbarPaletteEntrySnapshot | ToolbarWidgetSnapshot | null;
  kind: ToolbarWidgetDragPreviewKind;
  label: string;
  sourceInstanceId: string;
  structureIcon: LayoutDragStructureIcon | null;
}>;

function findNode(
  nodes: readonly ToolbarLayoutNodeSnapshot[],
  instanceId: string,
): ToolbarLayoutNodeSnapshot | null {
  for (const node of nodes) {
    if (node.instanceId === instanceId) {
      return node;
    }
    if (node.type !== "item") {
      const nested = findNode(node.children, instanceId);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

function findLayoutNode(
  snapshot: ToolbarWidgetsSnapshot,
  instanceId: string,
): ToolbarLayoutNodeSnapshot | null {
  return (
    findNode(snapshot.layout.top, instanceId) ??
    findNode(snapshot.layout.left, instanceId) ??
    findNode(snapshot.layout.right, instanceId) ??
    findNode(snapshot.layout.bottom, instanceId)
  );
}

function descriptorFromPalette(
  entry: ToolbarPaletteEntrySnapshot,
  localeId: FenneviaLocale,
): LayoutDragPreviewDescriptor {
  const structureIcon =
    entry.kind === "container" || entry.kind === "wrapper"
      ? (entry.icon as LayoutDragStructureIcon)
      : null;
  return Object.freeze({
    glyph:
      entry.kind === "container" ||
      entry.kind === "wrapper" ||
      entry.kind === "special"
        ? null
        : entry,
    kind:
      entry.kind === "special"
        ? "space"
        : entry.kind === "container" || entry.kind === "wrapper"
          ? "layout"
          : "control",
    label: localizeWidgetLabel(localeId, entry),
    sourceInstanceId: "",
    structureIcon,
  });
}

function descriptorFromNode(
  node: ToolbarLayoutNodeSnapshot,
  localeId: FenneviaLocale,
): LayoutDragPreviewDescriptor {
  if (node.type === "container") {
    return Object.freeze({
      glyph: null,
      kind: "layout",
      label: localizeWidgetLabel(localeId, {
        kind: "container",
        label: node.direction === "row" ? "Row" : "Column",
      }),
      sourceInstanceId: node.instanceId,
      structureIcon: node.direction,
    });
  }
  if (node.type === "wrapper") {
    const label =
      node.kind === "center"
        ? "Center"
        : node.kind === "expanded"
          ? "Expanded"
          : "Padding";
    return Object.freeze({
      glyph: null,
      kind: "layout",
      label: localizeWidgetLabel(localeId, { kind: "wrapper", label }),
      sourceInstanceId: node.instanceId,
      structureIcon: node.kind,
    });
  }
  const structural =
    node.widget.kind === "separator" ||
    node.widget.kind === "spacer" ||
    node.widget.kind === "spring";
  return Object.freeze({
    glyph: structural ? null : node.widget,
    kind: structural ? "space" : "control",
    label: localizeWidgetLabel(localeId, node.widget),
    sourceInstanceId: node.instanceId,
    structureIcon: null,
  });
}

export function resolveLayoutDragPreview(
  source: ToolbarWidgetDragSource | null,
  snapshot: ToolbarWidgetsSnapshot | null,
  localeId: FenneviaLocale,
): LayoutDragPreviewDescriptor | null {
  if (!source || !snapshot) {
    return null;
  }
  if (source.type === "palette") {
    const entry = snapshot.palette.find(
      (candidate) => candidate.token === source.token,
    );
    return entry ? descriptorFromPalette(entry, localeId) : null;
  }
  if (source.type === "layout-node") {
    const node = findLayoutNode(snapshot, source.instanceId);
    return node ? descriptorFromNode(node, localeId) : null;
  }
  const widget = snapshot.zones[source.zone][source.index];
  return widget
    ? Object.freeze({
        glyph: widget,
        kind:
          widget.kind === "separator" ||
          widget.kind === "spacer" ||
          widget.kind === "spring"
            ? "space"
            : "control",
        label: localizeWidgetLabel(localeId, widget),
        sourceInstanceId: "",
        structureIcon: null,
      })
    : null;
}
