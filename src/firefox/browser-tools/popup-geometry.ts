// SPDX-License-Identifier: MPL-2.0

export type PopupGeometryRect = Readonly<{
  height: number;
  width: number;
  x: number;
  y: number;
}>;

export type PopupGeometrySize = Readonly<{
  height: number;
  width: number;
}>;

export type PopupGeometryPoint = Readonly<{
  x: number;
  y: number;
}>;

export type PopupPlacementDirection = "auto" | "down" | "left" | "right" | "up";

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

const resolveAlignedStart = (
  anchorStart: number,
  anchorSize: number,
  popupSize: number,
  viewportSize: number,
): number => {
  const towardEnd = anchorStart;
  const towardStart = anchorStart + anchorSize - popupSize;
  const maximum = Math.max(0, viewportSize - popupSize);
  const towardEndFits = towardEnd >= 0 && towardEnd <= maximum;
  const towardStartFits = towardStart >= 0 && towardStart <= maximum;

  if (towardEndFits && towardStartFits) {
    return anchorStart + anchorSize / 2 <= viewportSize / 2
      ? towardEnd
      : towardStart;
  }
  if (towardEndFits) {
    return towardEnd;
  }
  if (towardStartFits) {
    return towardStart;
  }
  return clamp(anchorStart + anchorSize / 2 - popupSize / 2, 0, maximum);
};

const resolveAdjacentStart = (
  anchorStart: number,
  anchorSize: number,
  popupSize: number,
  viewportSize: number,
  preferredAfter?: boolean,
): number => {
  const after = anchorStart + anchorSize;
  const before = anchorStart - popupSize;
  const maximum = Math.max(0, viewportSize - popupSize);
  const afterFits = after >= 0 && after <= maximum;
  const beforeFits = before >= 0 && before <= maximum;

  if (preferredAfter === true && afterFits) {
    return after;
  }
  if (preferredAfter === false && beforeFits) {
    return before;
  }
  if (afterFits) {
    return after;
  }
  if (beforeFits) {
    return before;
  }

  const availableAfter = Math.max(0, viewportSize - after);
  const availableBefore = Math.max(0, anchorStart);
  if (availableAfter === availableBefore && preferredAfter !== undefined) {
    return preferredAfter ? after : before;
  }
  return availableAfter >= availableBefore ? after : before;
};

export function resolveBestAdjacentPopupPoint({
  direction = "auto",
  hostRect,
  popupSize,
  viewportSize,
}: Readonly<{
  direction?: PopupPlacementDirection;
  hostRect: PopupGeometryRect;
  popupSize: PopupGeometrySize;
  viewportSize: PopupGeometrySize;
}>): PopupGeometryPoint | null {
  const values = [
    hostRect.height,
    hostRect.width,
    hostRect.x,
    hostRect.y,
    popupSize.height,
    popupSize.width,
    viewportSize.height,
    viewportSize.width,
  ];
  if (
    !values.every((value) => Number.isFinite(value)) ||
    hostRect.height <= 0 ||
    hostRect.width <= 0 ||
    popupSize.height <= 0 ||
    popupSize.width <= 0 ||
    viewportSize.height <= 0 ||
    viewportSize.width <= 0 ||
    !["auto", "down", "left", "right", "up"].includes(direction)
  ) {
    return null;
  }

  const horizontalAdjacent = direction === "left" || direction === "right";
  return Object.freeze({
    x: Math.round(
      horizontalAdjacent
        ? resolveAdjacentStart(
            hostRect.x,
            hostRect.width,
            popupSize.width,
            viewportSize.width,
            direction === "right",
          )
        : resolveAlignedStart(
            hostRect.x,
            hostRect.width,
            popupSize.width,
            viewportSize.width,
          ),
    ),
    y: Math.round(
      horizontalAdjacent
        ? resolveAlignedStart(
            hostRect.y,
            hostRect.height,
            popupSize.height,
            viewportSize.height,
          )
        : resolveAdjacentStart(
            hostRect.y,
            hostRect.height,
            popupSize.height,
            viewportSize.height,
            direction === "auto" ? undefined : direction === "down",
          ),
    ),
  });
}
