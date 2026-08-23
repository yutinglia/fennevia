// SPDX-License-Identifier: MPL-2.0

export const minimumWindowDragDistanceCssPixels = 4;

export type WindowDragPosition = Readonly<{
  pointerScreenX: number | null;
  pointerScreenY: number | null;
  windowScreenX: number | null;
  windowScreenY: number | null;
}>;

const finiteCoordinate = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const captureWindowDragPosition = (
  event: Event | undefined,
  view: Window,
): WindowDragPosition => {
  const pointerEvent = event as Partial<MouseEvent> | undefined;
  return Object.freeze({
    pointerScreenX: finiteCoordinate(pointerEvent?.screenX),
    pointerScreenY: finiteCoordinate(pointerEvent?.screenY),
    windowScreenX: finiteCoordinate(view.screenX),
    windowScreenY: finiteCoordinate(view.screenY),
  });
};

export const hasWindowDragMoved = (
  start: WindowDragPosition,
  end: WindowDragPosition,
): boolean => {
  if (
    start.windowScreenX !== null &&
    start.windowScreenY !== null &&
    end.windowScreenX !== null &&
    end.windowScreenY !== null &&
    (start.windowScreenX !== end.windowScreenX ||
      start.windowScreenY !== end.windowScreenY)
  ) {
    return true;
  }
  if (
    start.pointerScreenX === null ||
    start.pointerScreenY === null ||
    end.pointerScreenX === null ||
    end.pointerScreenY === null
  ) {
    return false;
  }
  return (
    Math.hypot(
      end.pointerScreenX - start.pointerScreenX,
      end.pointerScreenY - start.pointerScreenY,
    ) >= minimumWindowDragDistanceCssPixels
  );
};

export type WindowDragCandidateController = Readonly<{
  begin(event: PointerEvent): void;
  dispose(): void;
  release(event: PointerEvent, cancelled?: boolean): void;
}>;

export const createWindowDragCandidateController = ({
  canStart,
  getView,
  onEnd,
  onStart,
}: Readonly<{
  canStart(event: PointerEvent): boolean;
  getView(): Window | null | undefined;
  onEnd(clickOnly: boolean): void;
  onStart(): void;
}>): WindowDragCandidateController => {
  let candidate: WindowDragPosition | null = null;

  const release = (event: PointerEvent, cancelled = false): void => {
    const start = candidate;
    candidate = null;
    if (!start) {
      return;
    }
    const view = getView();
    onEnd(
      !cancelled &&
        view !== null &&
        view !== undefined &&
        !hasWindowDragMoved(start, captureWindowDragPosition(event, view)),
    );
  };

  return Object.freeze({
    begin(event) {
      candidate = null;
      if (!canStart(event)) {
        return;
      }
      const view = getView();
      if (!view) {
        return;
      }
      const position = captureWindowDragPosition(event, view);
      onStart();
      candidate = position;
    },
    dispose() {
      if (candidate) {
        candidate = null;
        onEnd(false);
      }
    },
    release,
  });
};
