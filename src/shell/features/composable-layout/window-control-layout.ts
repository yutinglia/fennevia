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
  node: ToolbarLayoutNodeSnapshot,
): node is WindowControlNode {
  return (
    node.type === "item" &&
    (node.projectId === "minimize-window" ||
      node.projectId === "toggle-maximize-window" ||
      node.projectId === "close-window")
  );
}

export function collectWindowControls(
  nodes: readonly ToolbarLayoutNodeSnapshot[],
): readonly WindowControlNode[] {
  return nodes.flatMap((node) =>
    isWindowControlNode(node)
      ? [node]
      : node.type === "item"
        ? []
        : collectWindowControls(node.children),
  );
}
