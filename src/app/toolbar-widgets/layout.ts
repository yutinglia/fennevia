// SPDX-License-Identifier: MPL-2.0

import { toolbarZoneNames } from "./contracts.ts";
import type {
  ProjectWidgetId,
  ToolbarLayoutDirection,
  ToolbarLayoutLocation,
  ToolbarLayoutNodeSnapshot,
  ToolbarLayoutZonesSnapshot,
  ToolbarZoneName,
} from "./contracts.ts";

export function defaultToolbarLayoutDirection(
  zone: ToolbarZoneName,
): ToolbarLayoutDirection {
  return zone === "top" || zone === "bottom" ? "row" : "column";
}

export function isToolbarOptionalPanelEnabled(
  preferenceEnabled: boolean,
  nodeCount: number,
  customizeOpen: boolean,
): boolean {
  return preferenceEnabled && (customizeOpen || nodeCount > 0);
}

export function findToolbarLayoutInstance(
  layout: ToolbarLayoutZonesSnapshot,
  instanceId: string,
): ToolbarLayoutLocation | null {
  if (typeof instanceId !== "string" || instanceId === "") {
    return null;
  }
  const findIn = (
    nodes: readonly ToolbarLayoutNodeSnapshot[],
    zone: ToolbarZoneName,
    parentPath: readonly number[],
  ): ToolbarLayoutLocation | null => {
    for (const [index, node] of nodes.entries()) {
      const path = [...parentPath, index];
      if (node.instanceId === instanceId) {
        return Object.freeze({ path: Object.freeze(path), zone });
      }
      if (node.type !== "item") {
        const found = findIn(node.children, zone, path);
        if (found) {
          return found;
        }
      }
    }
    return null;
  };
  for (const zone of toolbarZoneNames) {
    const found = findIn(layout[zone], zone, []);
    if (found) {
      return found;
    }
  }
  return null;
}

export function toolbarLayoutContainsProjectWidget(
  nodes: readonly ToolbarLayoutNodeSnapshot[],
  projectId: ProjectWidgetId,
): boolean {
  for (const node of nodes) {
    if (node.type !== "item") {
      if (toolbarLayoutContainsProjectWidget(node.children, projectId)) {
        return true;
      }
    } else if (node.projectId === projectId) {
      return true;
    }
  }
  return false;
}

export function toolbarLayoutParent(
  layout: ToolbarLayoutZonesSnapshot,
  location: ToolbarLayoutLocation,
): Readonly<{
  children: readonly ToolbarLayoutNodeSnapshot[];
  direction: ToolbarLayoutDirection;
  parentPath: readonly number[];
}> | null {
  if (location.path.length === 0) {
    return null;
  }
  const parentPath = location.path.slice(0, -1);
  let children = layout[location.zone];
  let direction = defaultToolbarLayoutDirection(location.zone);
  for (const index of parentPath) {
    const node = children[index];
    if (!node || node.type === "item") {
      return null;
    }
    if (node.type === "container") {
      direction = node.direction;
    }
    children = node.children;
  }
  return Object.freeze({
    children,
    direction,
    parentPath: Object.freeze(parentPath),
  });
}
