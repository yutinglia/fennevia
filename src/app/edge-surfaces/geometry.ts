// SPDX-License-Identifier: MPL-2.0

import { edgeNames } from "./contracts.ts";
import type { EdgeName } from "./contracts.ts";

type EdgePoint = Readonly<{
  height: number;
  thickness: number;
  width: number;
  x: number;
  y: number;
}>;

const cornerPriority: Readonly<Record<EdgeName, number>> = Object.freeze({
  top: 0,
  left: 1,
  right: 2,
  bottom: 3,
});

export function resolveEdgeAtPoint({
  height,
  thickness,
  width,
  x,
  y,
}: EdgePoint): EdgeName | null {
  if (
    ![height, thickness, width, x, y].every(Number.isFinite) ||
    height <= 0 ||
    width <= 0 ||
    thickness <= 0 ||
    x < 0 ||
    y < 0 ||
    x > width ||
    y > height
  ) {
    return null;
  }

  const distances: Readonly<Record<EdgeName, number>> = {
    top: y,
    left: x,
    right: width - x,
    bottom: height - y,
  };
  const candidates = edgeNames
    .filter((edge) => distances[edge] <= thickness)
    .sort(
      (left, right) =>
        distances[left] - distances[right] ||
        cornerPriority[left] - cornerPriority[right],
    );
  return candidates[0] ?? null;
}

export function getKeyboardRevealEdge(
  event: Readonly<{
    altKey?: boolean;
    code?: string;
    ctrlKey?: boolean;
    key?: string;
    metaKey?: boolean;
    shiftKey?: boolean;
  }>,
): EdgeName | null {
  if (
    event.altKey !== true ||
    event.ctrlKey !== true ||
    event.shiftKey !== true ||
    event.metaKey === true
  ) {
    return null;
  }
  const key = event.code || event.key;
  const edgeByKey: Readonly<Record<string, EdgeName>> = {
    ArrowUp: "top",
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowDown: "bottom",
  };
  return edgeByKey[key ?? ""] ?? null;
}

export const edgeKeyboardBindings = Object.freeze({
  top: "Ctrl+Alt+Shift+ArrowUp",
  left: "Ctrl+Alt+Shift+ArrowLeft",
  right: "Ctrl+Alt+Shift+ArrowRight",
  bottom: "Ctrl+Alt+Shift+ArrowDown",
});
