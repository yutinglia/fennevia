// SPDX-License-Identifier: MPL-2.0

type PointerGeometryBox = {
  getBoundingClientRect(): DOMRectReadOnly;
};

type PointerGeometryView = {
  innerHeight: number;
  innerWidth: number;
};

export const isPointInsideElement = (
  element: PointerGeometryBox | null | undefined,
  clientX: number,
  clientY: number,
): boolean => {
  if (
    !element ||
    typeof element.getBoundingClientRect !== "function" ||
    !Number.isFinite(clientX) ||
    !Number.isFinite(clientY)
  ) {
    return false;
  }
  const bounds = element.getBoundingClientRect();
  return (
    clientX >= bounds.left &&
    clientX <= bounds.right &&
    clientY >= bounds.top &&
    clientY <= bounds.bottom
  );
};

export const isPointInsideWindowViewport = (
  view: PointerGeometryView | null | undefined,
  clientX: number,
  clientY: number,
): boolean => {
  if (
    !view ||
    !Number.isFinite(clientX) ||
    !Number.isFinite(clientY) ||
    !Number.isFinite(view.innerWidth) ||
    !Number.isFinite(view.innerHeight)
  ) {
    return false;
  }
  return (
    clientX >= 0 &&
    clientY >= 0 &&
    clientX <= view.innerWidth &&
    clientY <= view.innerHeight
  );
};

export const isIgnoredOwnedSurfacePointerOut = (
  event: Readonly<{
    clientX: number;
    clientY: number;
    relatedTarget: unknown;
  }>,
  root:
    | (PointerGeometryBox & {
        ownerDocument?: {
          defaultView: PointerGeometryView | null;
        };
      })
    | null
    | undefined,
  panel: PointerGeometryBox | null | undefined,
): boolean =>
  event.relatedTarget === null &&
  isPointInsideWindowViewport(
    root?.ownerDocument?.defaultView,
    event.clientX,
    event.clientY,
  ) &&
  (isPointInsideElement(root, event.clientX, event.clientY) ||
    isPointInsideElement(panel, event.clientX, event.clientY));

export const isPointInsideVisibleEdgePanel = (
  root: ParentNode | null | undefined,
  clientX: number,
  clientY: number,
): boolean => {
  if (!root || typeof root.querySelectorAll !== "function") {
    return false;
  }
  for (const panel of root.querySelectorAll("[data-fennevia-edge-panel]")) {
    const visibleRoot =
      typeof panel.closest === "function"
        ? panel.closest("[data-fennevia-visible='true']")
        : null;
    if (visibleRoot && isPointInsideElement(panel, clientX, clientY)) {
      return true;
    }
  }
  return false;
};
