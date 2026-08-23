// SPDX-License-Identifier: MPL-2.0
import {
  isEdgeName,
  resolveEdgeAtPoint,
  type EdgeName,
} from "../../app/edge-surfaces";
import type { MessageKey } from "../../app/i18n";
import type { SidePanelRole } from "../../app/toolbar-widgets-state";
import {
  isIgnoredOwnedSurfacePointerOut,
  isPointInsideElement,
  isPointInsideVisibleEdgePanel,
  isPointInsideWindowViewport,
} from "./pointer-geometry";
export {
  captureWindowDragPosition,
  createWindowDragCandidateController,
  hasWindowDragMoved,
  minimumWindowDragDistanceCssPixels,
} from "./window-drag";
export type {
  WindowDragCandidateController,
  WindowDragPosition,
} from "./window-drag";
export {
  isIgnoredOwnedSurfacePointerOut,
  isPointInsideElement,
  isPointInsideVisibleEdgePanel,
  isPointInsideWindowViewport,
};

export const pointerActivatesEdge = ({
  edge,
  event,
  frame,
  triggerThickness,
}: Readonly<{
  edge: EdgeName;
  event: PointerEvent;
  frame: HTMLElement;
  triggerThickness: number;
}>): boolean => {
  if (event.buttons !== 0) {
    return false;
  }
  const bounds = frame.getBoundingClientRect();
  return (
    resolveEdgeAtPoint({
      height: bounds.height,
      thickness: triggerThickness,
      width: bounds.width,
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    }) === edge
  );
};

export const crossedPointerBoundary = (event: PointerEvent): boolean => {
  const boundary = event.currentTarget;
  const related = event.relatedTarget;
  return (
    boundary instanceof Node &&
    (!(related instanceof Node) || !boundary.contains(related))
  );
};

export const resolveOwnedSurfacePointerOutRelease = (
  event: PointerEvent,
  root: HTMLElement | null | undefined,
  panel: HTMLElement | null | undefined,
): "inside-window" | "outside-window" | null => {
  if (
    !crossedPointerBoundary(event) ||
    isIgnoredOwnedSurfacePointerOut(event, root, panel)
  ) {
    return null;
  }
  return event.relatedTarget === null ? "outside-window" : "inside-window";
};

export const isInteractivePointerTarget = (
  target: PointerEvent["target"],
): boolean =>
  target instanceof Element &&
  Boolean(
    target.closest(
      'a, button, input, select, textarea, [contenteditable="true"], [role="button"], [role="link"], [role="tab"], [tabindex]',
    ),
  );

export const resolveWindowDragEdge = (
  target: EventTarget | null,
): EdgeName | null => {
  if (!(target instanceof Element)) {
    return null;
  }
  const edge = target
    .closest<HTMLElement>("[data-fennevia-edge-panel]")
    ?.getAttribute("data-fennevia-edge-panel");
  return isEdgeName(edge) ? edge : null;
};

export const labelKey = (
  edge: EdgeName,
  sidePanelRole: SidePanelRole | null,
): MessageKey => {
  if (edge === "top") {
    return "surface.top";
  }
  if (edge === "bottom") {
    return "surface.bottom";
  }
  return sidePanelRole === "tabs" ? "surface.tabs" : "surface.bookmarks";
};
