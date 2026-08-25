// SPDX-License-Identifier: MPL-2.0

import type { ToolbarZoneName } from "../../../app/toolbar-widgets-state.ts";

export type WidgetInspectorRect = Readonly<{
  bottom: number;
  left: number;
  right: number;
  top: number;
}>;

export type WidgetInspectorSize = Readonly<{
  height: number;
  width: number;
}>;

export type WidgetInspectorPosition = Readonly<{
  left: number;
  placement: "above" | "below" | "left" | "right";
  top: number;
}>;

const finiteRect = (rect: WidgetInspectorRect): boolean =>
  [rect.bottom, rect.left, rect.right, rect.top].every(Number.isFinite) &&
  rect.right >= rect.left &&
  rect.bottom >= rect.top;

const finiteSize = (size: WidgetInspectorSize): boolean =>
  Number.isFinite(size.width) &&
  Number.isFinite(size.height) &&
  size.width > 0 &&
  size.height > 0;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), Math.max(minimum, maximum));

type Candidate = Readonly<{
  left: number;
  placement: WidgetInspectorPosition["placement"];
  top: number;
}>;

const intersectionArea = (
  left: number,
  top: number,
  inspector: WidgetInspectorSize,
  obstacle: WidgetInspectorRect,
  padding: number,
): number => {
  const width = Math.max(
    0,
    Math.min(left + inspector.width, obstacle.right + padding) -
      Math.max(left, obstacle.left - padding),
  );
  const height = Math.max(
    0,
    Math.min(top + inspector.height, obstacle.bottom + padding) -
      Math.max(top, obstacle.top - padding),
  );
  return width * height;
};

export function resolveWidgetInspectorPosition(
  edge: ToolbarZoneName,
  anchor: WidgetInspectorRect,
  container: WidgetInspectorRect,
  viewport: WidgetInspectorRect,
  inspector: WidgetInspectorSize,
  gap = 8,
  margin = 8,
  obstacles: readonly WidgetInspectorRect[] = [],
): WidgetInspectorPosition | null {
  if (
    !finiteRect(anchor) ||
    !finiteRect(container) ||
    !finiteRect(viewport) ||
    !finiteSize(inspector) ||
    !Number.isFinite(gap) ||
    !Number.isFinite(margin) ||
    gap < 0 ||
    margin < 0 ||
    obstacles.some((obstacle) => !finiteRect(obstacle))
  ) {
    return null;
  }

  const minimumLeft = viewport.left + margin;
  const maximumLeft = viewport.right - margin - inspector.width;
  const minimumTop = viewport.top + margin;
  const maximumTop = viewport.bottom - margin - inspector.height;
  const centeredLeft =
    anchor.left + (anchor.right - anchor.left - inspector.width) / 2;
  const centeredTop =
    anchor.top + (anchor.bottom - anchor.top - inspector.height) / 2;

  const candidatesByPlacement: Readonly<
    Record<WidgetInspectorPosition["placement"], Candidate>
  > = Object.freeze({
    above: Object.freeze({
      left: centeredLeft,
      placement: "above",
      top: anchor.top - gap - inspector.height,
    }),
    below: Object.freeze({
      left: centeredLeft,
      placement: "below",
      top: anchor.bottom + gap,
    }),
    left: Object.freeze({
      left: anchor.left - gap - inspector.width,
      placement: "left",
      top: centeredTop,
    }),
    right: Object.freeze({
      left: anchor.right + gap,
      placement: "right",
      top: centeredTop,
    }),
  });
  const placementOrder: Readonly<
    Record<ToolbarZoneName, readonly WidgetInspectorPosition["placement"][]>
  > = {
    bottom: ["above", "below", "right", "left"],
    left: ["right", "left", "below", "above"],
    right: ["left", "right", "below", "above"],
    top: ["below", "above", "right", "left"],
  };
  const candidates = placementOrder[edge].map((placement, priority) => {
    const candidate = candidatesByPlacement[placement];
    const left = clamp(candidate.left, minimumLeft, maximumLeft);
    const top = clamp(candidate.top, minimumTop, maximumTop);
    return Object.freeze({
      candidate,
      fitsViewport:
        candidate.left >= minimumLeft &&
        candidate.left <= maximumLeft &&
        candidate.top >= minimumTop &&
        candidate.top <= maximumTop,
      left,
      overlap:
        intersectionArea(left, top, inspector, anchor, gap) +
        obstacles.reduce(
          (total, obstacle) =>
            total + intersectionArea(left, top, inspector, obstacle, gap),
          0,
        ),
      priority,
      top,
    });
  });
  const selected =
    candidates.find(
      (candidate) => candidate.fitsViewport && candidate.overlap === 0,
    ) ??
    [...candidates].sort(
      (first, second) =>
        first.overlap - second.overlap ||
        Number(second.fitsViewport) - Number(first.fitsViewport) ||
        first.priority - second.priority,
    )[0];

  if (!selected) {
    return null;
  }

  return Object.freeze({
    left: Math.round(selected.left - container.left),
    placement: selected.candidate.placement,
    top: Math.round(selected.top - container.top),
  });
}
