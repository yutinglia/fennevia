// SPDX-License-Identifier: MPL-2.0

export const edgeNames = ["top", "left", "right", "bottom"] as const;

export type EdgeName = (typeof edgeNames)[number];

export const edgePanelDodgeModes = Object.freeze([
  "single-dynamic",
  "single-reserved",
  "multiple-dynamic",
  "multiple-reserved",
] as const);

export type EdgePanelDodgeMode = (typeof edgePanelDodgeModes)[number];

export const edgeProgrammaticRevealReasons = Object.freeze([
  "default",
  "new-tab-highlight",
] as const);

export type EdgeProgrammaticRevealReason =
  (typeof edgeProgrammaticRevealReasons)[number];

export const pointerExitLocations = [
  "inside-window",
  "outside-window",
] as const;

export type PointerExitLocation = (typeof pointerExitLocations)[number];

export type EdgeSurfacePhase =
  | "hidden"
  | "pointer-revealed"
  | "focus-held"
  | "keyboard-held"
  | "popup-held"
  | "programmatic-revealed"
  | "pending-hide"
  | "disabled"
  | "disposed";

export type EdgeSurfaceHolds = Readonly<{
  focus: boolean;
  keyboard: boolean;
  pointer: boolean;
  popup: boolean;
  programmatic: boolean;
}>;

export type EdgeSurfaceSnapshot = Readonly<{
  edge: EdgeName;
  enabled: boolean;
  holds: EdgeSurfaceHolds;
  phase: EdgeSurfacePhase;
  revision: number;
  visible: boolean;
}>;

export type EdgeInteractionConfig = Readonly<{
  hideDelayMs: number;
  programmaticRevealMs: number;
  triggerThicknessCssPixels: number;
  windowLeaveHideDelayMs: number;
}>;

export type EdgeSurfaceController = Readonly<{
  dismiss: () => boolean;
  dispose: () => boolean;
  releaseKeyboard: () => boolean;
  revealFromKeyboard: () => boolean;
  revealProgrammatically: (durationMs?: number) => boolean;
  setEnabled: (enabled: boolean) => boolean;
  setFocusHeld: (held: boolean) => boolean;
  setHideDelayMs: (delayMs: number) => boolean;
  setPointerHeld: (
    held: boolean,
    releaseLocation?: PointerExitLocation,
  ) => boolean;
  setPopupHeld: (held: boolean) => boolean;
  setWindowLeaveHideDelayMs: (delayMs: number) => boolean;
  snapshot: () => EdgeSurfaceSnapshot;
  subscribe: (
    listener: (snapshot: EdgeSurfaceSnapshot) => void,
  ) => () => boolean;
}>;

export type EdgeShellSnapshot = Readonly<{
  activeEdge: EdgeName | null;
  disposed: boolean;
  enabled: boolean;
  interaction: EdgeInteractionConfig;
  interactionSuppressed: boolean;
  panelDodgeMode: EdgePanelDodgeMode;
  surfaces: Readonly<Record<EdgeName, EdgeSurfaceSnapshot>>;
}>;

export type EdgeShellController = Readonly<{
  dismiss: (edge: EdgeName) => boolean;
  dismissActive: () => EdgeName | null;
  dispose: () => boolean;
  getSurface: (edge: EdgeName) => EdgeSurfaceController;
  releaseKeyboard: (edge: EdgeName) => boolean;
  releasePointer: (edge: EdgeName, location: PointerExitLocation) => boolean;
  revealFromKeyboard: (edge: EdgeName) => boolean;
  revealFromPointer: (edge: EdgeName) => boolean;
  revealProgrammatically: (
    edge: EdgeName,
    durationMs?: number,
    reason?: EdgeProgrammaticRevealReason,
  ) => boolean;
  setEnabled: (enabled: boolean) => boolean;
  setEdgeEnabled: (edge: EdgeName, enabled: boolean) => boolean;
  setFocusHeld: (edge: EdgeName, held: boolean) => boolean;
  setInteractionConfig: (config: EdgeInteractionConfig) => boolean;
  setInteractionSuppressed: (suppressed: boolean) => boolean;
  setPanelDodgeMode: (mode: EdgePanelDodgeMode) => boolean;
  setPointerHeld: (edge: EdgeName, held: boolean) => boolean;
  setPopupHeld: (edge: EdgeName, held: boolean) => boolean;
  setWindowDragActive: (active: boolean, edge?: EdgeName) => boolean;
  snapshot: () => EdgeShellSnapshot;
}>;

export type TimerHandle = unknown;

export type Scheduler = Readonly<{
  clearTimeout: (handle: TimerHandle) => void;
  setTimeout: (callback: () => void, delayMs: number) => TimerHandle;
}>;

export type ControllerOptions = Readonly<{
  hideDelayMs?: number;
  onError?: (error: unknown) => void;
  scheduler?: Scheduler;
  windowLeaveHideDelayMs?: number;
}>;

export const edgeSurfaceTiming = Object.freeze({
  defaultProgrammaticRevealMs: 1_200,
  hideDelayMs: 300,
  maximumProgrammaticRevealMs: 10_000,
  windowLeaveHideDelayMs: 800,
});

export const edgeInsetCssPixels = 7;
export const edgeTriggerThicknessCssPixels = 12;
export const progressLightThicknessCssPixels = 2;

export const edgeInteractionBounds = Object.freeze({
  hideDelayMs: Object.freeze({ max: 5_000, min: 100 }),
  programmaticRevealMs: Object.freeze({ max: 10_000, min: 400 }),
  triggerThicknessCssPixels: Object.freeze({ max: 24, min: 6 }),
  windowLeaveHideDelayMs: Object.freeze({ max: 5_000, min: 100 }),
});

export const edgeInteractionDefaults: EdgeInteractionConfig = Object.freeze({
  hideDelayMs: edgeSurfaceTiming.hideDelayMs,
  programmaticRevealMs: edgeSurfaceTiming.defaultProgrammaticRevealMs,
  triggerThicknessCssPixels: edgeTriggerThicknessCssPixels,
  windowLeaveHideDelayMs: edgeSurfaceTiming.windowLeaveHideDelayMs,
});

export const defaultEdgePanelDodgeMode: EdgePanelDodgeMode = "multiple-dynamic";

export function isEdgePanelDodgeMode(
  value: unknown,
): value is EdgePanelDodgeMode {
  return edgePanelDodgeModes.includes(value as EdgePanelDodgeMode);
}

export const holdNames = [
  "focus",
  "keyboard",
  "pointer",
  "popup",
  "programmatic",
] as const;

export type HoldName = (typeof holdNames)[number];
