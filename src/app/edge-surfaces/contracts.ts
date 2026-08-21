// SPDX-License-Identifier: MPL-2.0

export const edgeNames = ["top", "left", "right", "bottom"] as const;

export type EdgeName = (typeof edgeNames)[number];

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

export type EdgeSurfaceController = Readonly<{
  dismiss: () => boolean;
  dispose: () => boolean;
  releaseKeyboard: () => boolean;
  revealFromKeyboard: () => boolean;
  revealProgrammatically: (durationMs?: number) => boolean;
  setEnabled: (enabled: boolean) => boolean;
  setFocusHeld: (held: boolean) => boolean;
  setPointerHeld: (held: boolean) => boolean;
  setPopupHeld: (held: boolean) => boolean;
  snapshot: () => EdgeSurfaceSnapshot;
  subscribe: (
    listener: (snapshot: EdgeSurfaceSnapshot) => void,
  ) => () => boolean;
}>;

export type EdgeShellSnapshot = Readonly<{
  activeEdge: EdgeName | null;
  disposed: boolean;
  enabled: boolean;
  interactionSuppressed: boolean;
  surfaces: Readonly<Record<EdgeName, EdgeSurfaceSnapshot>>;
}>;

export type EdgeShellController = Readonly<{
  dismiss: (edge: EdgeName) => boolean;
  dismissActive: () => EdgeName | null;
  dispose: () => boolean;
  getSurface: (edge: EdgeName) => EdgeSurfaceController;
  releaseKeyboard: (edge: EdgeName) => boolean;
  revealFromKeyboard: (edge: EdgeName) => boolean;
  revealFromPointer: (edge: EdgeName) => boolean;
  revealProgrammatically: (edge: EdgeName, durationMs?: number) => boolean;
  setEnabled: (enabled: boolean) => boolean;
  setFocusHeld: (edge: EdgeName, held: boolean) => boolean;
  setInteractionSuppressed: (suppressed: boolean) => boolean;
  setPointerHeld: (edge: EdgeName, held: boolean) => boolean;
  setPopupHeld: (edge: EdgeName, held: boolean) => boolean;
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
}>;

export const edgeSurfaceTiming = Object.freeze({
  defaultProgrammaticRevealMs: 1_200,
  hideDelayMs: 160,
  maximumProgrammaticRevealMs: 10_000,
});

export const edgeInsetCssPixels = 7;
export const edgeTriggerThicknessCssPixels = 12;
export const progressLightThicknessCssPixels = 2;

export const holdNames = [
  "focus",
  "keyboard",
  "pointer",
  "popup",
  "programmatic",
] as const;

export type HoldName = (typeof holdNames)[number];
