// SPDX-License-Identifier: MPL-2.0

export {
  edgeNames,
  edgeSurfaceTiming,
  edgeInsetCssPixels,
  edgeTriggerThicknessCssPixels,
  progressLightThicknessCssPixels,
} from "./edge-surfaces/contracts.ts";
export type {
  EdgeName,
  EdgeSurfacePhase,
  EdgeSurfaceHolds,
  EdgeSurfaceSnapshot,
  EdgeSurfaceController,
  EdgeShellSnapshot,
  EdgeShellController,
} from "./edge-surfaces/contracts.ts";
export {
  isEdgeName,
  createEdgeSurfaceController,
} from "./edge-surfaces/surface-controller.ts";
export { createEdgeShellController } from "./edge-surfaces/shell-controller.ts";
export {
  resolveEdgeAtPoint,
  getKeyboardRevealEdge,
  edgeKeyboardBindings,
} from "./edge-surfaces/geometry.ts";
