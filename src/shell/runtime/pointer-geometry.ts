// SPDX-License-Identifier: MPL-2.0

export const isPointInsideElement = (
  element: { getBoundingClientRect(): DOMRectReadOnly } | null | undefined,
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
  view: { innerHeight: number; innerWidth: number } | null | undefined,
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
