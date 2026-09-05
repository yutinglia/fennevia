// SPDX-License-Identifier: MPL-2.0

export type TabDragScrollMetrics = Readonly<{
  pointer: number;
  start: number;
  end: number;
  position: number;
  viewportSize: number;
  contentSize: number;
  itemSize: number;
}>;

export function resolveTabDragScroll(
  metrics: TabDragScrollMetrics,
  fastElapsedMs: number,
): Readonly<{ direction: -1 | 0 | 1; fast: boolean; velocity: number }> {
  const idle = { direction: 0 as const, fast: false, velocity: 0 };
  if (
    !Object.values(metrics).every(Number.isFinite) ||
    !Number.isFinite(fastElapsedMs) ||
    metrics.end <= metrics.start ||
    metrics.viewportSize <= 0 ||
    metrics.itemSize <= 0 ||
    metrics.pointer < metrics.start ||
    metrics.pointer > metrics.end
  ) {
    return idle;
  }
  const overflow = Math.max(0, metrics.contentSize - metrics.viewportSize);
  if (overflow === 0) return idle;
  const band = Math.min(
    48,
    Math.max(24, metrics.itemSize),
    (metrics.end - metrics.start) / 4,
  );
  const fromStart = metrics.pointer - metrics.start;
  const fromEnd = metrics.end - metrics.pointer;
  const direction = fromStart < band ? -1 : fromEnd < band ? 1 : 0;
  const position = Math.min(overflow, Math.max(0, metrics.position));
  const remaining = direction === -1 ? position : overflow - position;
  if (direction === 0 || remaining <= 0) return idle;

  const depth = 1 - (direction === -1 ? fromStart : fromEnd) / band;
  const precisionSpeed = metrics.itemSize * 2;
  const speedLimit = Math.max(
    precisionSpeed,
    Math.min(metrics.viewportSize * 1.5, overflow * 0.8, remaining * 3),
  );
  // The inner part always has the same fine control, even in a very long list.
  const fastDepth = Math.max(0, (depth - 0.45) / 0.55);
  const progress = Math.min(1, Math.max(0, (fastElapsedMs - 180) / 600));
  const ramp = progress * progress * (3 - 2 * progress);
  return {
    direction,
    fast: fastDepth > 0,
    velocity:
      direction *
      (precisionSpeed * Math.min(1, depth / 0.45) +
        (speedLimit - precisionSpeed) * fastDepth ** 2 * ramp),
  };
}
