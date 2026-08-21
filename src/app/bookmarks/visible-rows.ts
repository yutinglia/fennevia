// SPDX-License-Identifier: MPL-2.0

import { maximumBookmarkDepth } from "./contracts.ts";
import type {
  BrowserBookmarksState,
  BookmarkVisibleItemRow,
  BookmarkVisibleRow,
} from "./contracts.ts";
import { createBranch } from "./validation.ts";

export function getVisibleBookmarkRows(
  state: BrowserBookmarksState,
): readonly BookmarkVisibleRow[] {
  const rows: BookmarkVisibleRow[] = [];
  const expanded = new Set(state.expandedFolderIds);
  const appendBranch = (parentId: string, depth: number): void => {
    if (depth > maximumBookmarkDepth) {
      return;
    }
    const branch = state.branches[parentId];
    if (!branch) {
      rows.push(
        Object.freeze({
          branch: createBranch({ depth, parentId, phase: "idle" }),
          depth,
          key: `branch-${parentId}-${depth}`,
          parentId,
          type: "branch",
        }),
      );
      return;
    }
    for (const node of branch.items) {
      const isExpanded = node.kind === "folder" && expanded.has(node.id);
      rows.push(
        Object.freeze({
          depth,
          expanded: isExpanded,
          key: `item-${node.id}`,
          node,
          parentId,
          type: "item",
        }),
      );
      if (isExpanded) {
        appendBranch(node.id, depth + 1);
      }
    }
    if (
      branch.phase !== "ready" ||
      branch.items.length === 0 ||
      branch.offset > 0 ||
      branch.truncated
    ) {
      rows.push(
        Object.freeze({
          branch,
          depth,
          key: `branch-${parentId}-${depth}`,
          parentId,
          type: "branch",
        }),
      );
    }
  };
  if (state.selectedRootId) {
    appendBranch(state.selectedRootId, 0);
  }
  return Object.freeze(rows);
}

export function resolveBookmarkFocusId(
  rows: readonly BookmarkVisibleRow[],
  currentId: string | null,
  priorItemIds: readonly string[] = [],
): string | null {
  const itemIds = rows
    .filter(
      (row): row is BookmarkVisibleItemRow =>
        row.type === "item" && row.node.kind !== "separator",
    )
    .map((row) => row.node.id);
  if (currentId && itemIds.includes(currentId)) {
    return currentId;
  }
  if (currentId) {
    const priorIndex = priorItemIds.indexOf(currentId);
    if (priorIndex >= 0 && itemIds.length > 0) {
      return itemIds[Math.min(priorIndex, itemIds.length - 1)];
    }
  }
  return itemIds[0] ?? null;
}
