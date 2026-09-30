// SPDX-License-Identifier: MPL-2.0
import type {
  ToolbarLayoutNodeSnapshot,
  ToolbarLayoutItemSnapshot,
} from "../../../app/toolbar-widgets-state";

export type WindowControlNode = ToolbarLayoutItemSnapshot &
  Readonly<{
    projectId: "minimize-window" | "toggle-maximize-window" | "close-window";
  }>;

export function isWindowControlNode(
  node: ToolbarLayoutNodeSnapshot | undefined,
): node is WindowControlNode {
  return (
    node?.type === "item" &&
    (node.projectId === "minimize-window" ||
      node.projectId === "toggle-maximize-window" ||
      node.projectId === "close-window")
  );
}

export function collectAdjacentWindowControls(
  nodes: readonly ToolbarLayoutNodeSnapshot[],
  start: number,
): readonly WindowControlNode[] {
  if (isWindowControlNode(nodes[start - 1])) return [];
  const controls: WindowControlNode[] = [];
  for (let index = start; index < nodes.length; index++) {
    const node = nodes[index];
    if (!isWindowControlNode(node)) break;
    controls.push(node);
  }
  return controls;
}
