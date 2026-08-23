// SPDX-License-Identifier: MPL-2.0
import { resolveEdgeAtPoint, type EdgeName } from "../../app/edge-surfaces";
import type { MessageKey } from "../../app/i18n";
import type { SidePanelRole } from "../../app/toolbar-widgets-state";

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

export const isInteractivePointerTarget = (
  target: PointerEvent["target"],
): boolean =>
  target instanceof Element &&
  Boolean(
    target.closest(
      'a, button, input, select, textarea, [contenteditable="true"], [role="button"], [role="link"], [role="tab"], [tabindex]',
    ),
  );

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
