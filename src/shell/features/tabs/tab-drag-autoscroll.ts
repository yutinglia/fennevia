// SPDX-License-Identifier: MPL-2.0

import { resolveTabDragScroll } from "../../../app/tab-drag-scroll.ts";

type ScrollTarget = Readonly<{
  element: HTMLElement;
  horizontal: boolean;
  itemSize: number;
  dragId: string;
}>;
type Point = Readonly<{ clientX: number; clientY: number }>;
const ownershipAttribute = "data-fennevia-tab-scroll-owned";

// The transparent drag receiver is a sibling of the scrolling list, so native
// DragScroll cannot reach the partitions. Only its project-owned ancestors
// must yield; keep the real partition/list scrollbars painted throughout.
// Never walk into browser.xhtml.
function claimScrollContainers(root: HTMLElement): () => void {
  const surface = root.closest<HTMLElement>("[data-fennevia-surface-root]");
  if (!surface) return () => {};
  const elements = new Set<HTMLElement>();
  for (
    let element: HTMLElement | null = root;
    element;
    element = element.parentElement
  ) {
    elements.add(element);
    if (element === surface) break;
  }
  const previous = Array.from(elements, (element) => ({
    element,
    value: element.getAttribute(ownershipAttribute),
  }));
  for (const { element } of previous)
    element.setAttribute(ownershipAttribute, "");
  return () => {
    for (const { element, value } of previous) {
      if (value === null) element.removeAttribute(ownershipAttribute);
      else element.setAttribute(ownershipAttribute, value);
    }
  };
}

export function createTabDragAutoScroller(
  options: Readonly<{
    root: HTMLElement;
    isActive: (dragId: string) => boolean;
    onScroll: () => void;
    onError: (error: unknown) => void;
  }>,
) {
  const view = options.root.ownerDocument.defaultView;
  let target: ScrollTarget | null = null;
  let pointer: Point | null = null;
  let frame: number | null = null;
  let previousTime: number | null = null;
  let fastSince: number | null = null;
  let direction = 0;
  let remainder = 0;
  let release: (() => void) | null = null;

  const cancelFrame = () => {
    if (frame !== null) view?.cancelAnimationFrame(frame);
    frame = null;
    previousTime = null;
    fastSince = null;
    direction = 0;
    remainder = 0;
  };
  const stop = () => {
    cancelFrame();
    target = null;
    pointer = null;
    release?.();
    release = null;
  };
  const readMetrics = () => {
    if (!target || !pointer) return null;
    const bounds = target.element.getBoundingClientRect();
    if (
      pointer.clientX < bounds.left ||
      pointer.clientX > bounds.right ||
      pointer.clientY < bounds.top ||
      pointer.clientY > bounds.bottom
    )
      return null;
    return {
      pointer: target.horizontal ? pointer.clientX : pointer.clientY,
      start: target.horizontal ? bounds.left : bounds.top,
      end: target.horizontal ? bounds.right : bounds.bottom,
      position: target.horizontal
        ? target.element.scrollLeft
        : target.element.scrollTop,
      viewportSize: target.horizontal
        ? target.element.clientWidth
        : target.element.clientHeight,
      contentSize: target.horizontal
        ? target.element.scrollWidth
        : target.element.scrollHeight,
      itemSize: target.itemSize,
    };
  };
  const run = (now: number) => {
    frame = null;
    try {
      if (
        !view ||
        !target ||
        !options.root.isConnected ||
        !target.element.isConnected ||
        options.root.ownerDocument.hidden ||
        !options.isActive(target.dragId)
      ) {
        stop();
        return;
      }
      const metrics = readMetrics();
      if (!metrics) {
        cancelFrame();
        return;
      }
      const edge = resolveTabDragScroll(metrics, 0);
      if (edge.direction !== direction) {
        fastSince = null;
        remainder = 0;
      }
      direction = edge.direction;
      fastSince = edge.fast ? (fastSince ?? now) : null;
      if (direction === 0) {
        cancelFrame();
        return;
      }
      const { velocity } = resolveTabDragScroll(
        metrics,
        fastSince === null ? 0 : now - fastSince,
      );
      // Time-based motion is consistent at 60/120 Hz; a stalled frame cannot
      // jump across a screen. Fractional distance survives low-speed frames.
      const elapsed =
        previousTime === null
          ? 0
          : Math.min(50, Math.max(0, now - previousTime));
      previousTime = now;
      remainder += (velocity * elapsed) / 1000;
      const delta = Math.trunc(remainder);
      remainder -= delta;
      const next = Math.min(
        metrics.contentSize - metrics.viewportSize,
        Math.max(0, metrics.position + delta),
      );
      if (next !== metrics.position) {
        if (target.horizontal) target.element.scrollLeft = next;
        else target.element.scrollTop = next;
        options.onScroll();
      }
      if (target) frame = view.requestAnimationFrame(run);
    } catch (error) {
      stop();
      options.onError(error);
    }
  };
  return {
    stop,
    update(nextTarget: ScrollTarget, nextPointer: Point) {
      if (
        !view ||
        !Number.isFinite(nextPointer.clientX) ||
        !Number.isFinite(nextPointer.clientY) ||
        !options.root.contains(nextTarget.element)
      ) {
        stop();
        return;
      }
      if (
        target?.element !== nextTarget.element ||
        target.horizontal !== nextTarget.horizontal ||
        target.dragId !== nextTarget.dragId
      ) {
        cancelFrame();
      }
      target = nextTarget;
      pointer = nextPointer;
      release ??= claimScrollContainers(options.root);
      const metrics = readMetrics();
      const edge = metrics ? resolveTabDragScroll(metrics, 0) : null;
      if (!edge?.direction) {
        cancelFrame();
        return;
      }
      // Entering the precision area or reversing direction resets acceleration
      // immediately, without waiting for another animation frame.
      if (!edge.fast || edge.direction !== direction) {
        fastSince = null;
        remainder = 0;
      }
      direction = edge.direction;
      if (frame === null) frame = view.requestAnimationFrame(run);
    },
  };
}
