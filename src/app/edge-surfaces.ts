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
  setPointerHeld: (edge: EdgeName, held: boolean) => boolean;
  setPopupHeld: (edge: EdgeName, held: boolean) => boolean;
  snapshot: () => EdgeShellSnapshot;
}>;

type TimerHandle = unknown;

type Scheduler = Readonly<{
  clearTimeout: (handle: TimerHandle) => void;
  setTimeout: (callback: () => void, delayMs: number) => TimerHandle;
}>;

type ControllerOptions = Readonly<{
  hideDelayMs?: number;
  onError?: (error: unknown) => void;
  scheduler?: Scheduler;
}>;

export const edgeSurfaceTiming = Object.freeze({
  defaultProgrammaticRevealMs: 1_200,
  hideDelayMs: 160,
  maximumProgrammaticRevealMs: 10_000,
});

export const edgeTriggerThicknessCssPixels = 7;

const holdNames = [
  "focus",
  "keyboard",
  "pointer",
  "popup",
  "programmatic",
] as const;

type HoldName = (typeof holdNames)[number];

const defaultScheduler: Scheduler = Object.freeze({
  clearTimeout(handle) {
    globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>);
  },
  setTimeout(callback, delayMs) {
    return globalThis.setTimeout(callback, delayMs);
  },
});

function createEdgeSurfaceError(code: string): Error {
  const error = new Error(code);
  error.name = "FenneviaEdgeSurfaceError";
  Object.defineProperties(error, {
    fenneviaCode: { enumerable: false, value: code },
    fenneviaPhase: { enumerable: false, value: "edge-surface-controller" },
  });
  return error;
}

export function isEdgeName(value: unknown): value is EdgeName {
  return edgeNames.includes(value as EdgeName);
}

function validateDelay(value: number, maximum: number, code: string): void {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw createEdgeSurfaceError(code);
  }
}

function createHolds(): Record<HoldName, boolean> {
  return {
    focus: false,
    keyboard: false,
    pointer: false,
    popup: false,
    programmatic: false,
  };
}

function hasHold(holds: Record<HoldName, boolean>): boolean {
  return holdNames.some((name) => holds[name]);
}

function phaseFromState({
  disposed,
  enabled,
  holds,
  hidePending,
  visible,
}: Readonly<{
  disposed: boolean;
  enabled: boolean;
  hidePending: boolean;
  holds: Record<HoldName, boolean>;
  visible: boolean;
}>): EdgeSurfacePhase {
  if (disposed) {
    return "disposed";
  }
  if (!enabled) {
    return "disabled";
  }
  if (!visible) {
    return "hidden";
  }
  if (hidePending) {
    return "pending-hide";
  }
  if (holds.popup) {
    return "popup-held";
  }
  if (holds.focus) {
    return "focus-held";
  }
  if (holds.keyboard) {
    return "keyboard-held";
  }
  if (holds.pointer) {
    return "pointer-revealed";
  }
  if (holds.programmatic) {
    return "programmatic-revealed";
  }
  return "hidden";
}

export function createEdgeSurfaceController(
  edge: EdgeName,
  {
    hideDelayMs = edgeSurfaceTiming.hideDelayMs,
    onError = () => {},
    scheduler = defaultScheduler,
  }: ControllerOptions = {},
): EdgeSurfaceController {
  if (!isEdgeName(edge)) {
    throw createEdgeSurfaceError("FENNEVIA_EDGE_NAME_INVALID");
  }
  validateDelay(
    hideDelayMs,
    edgeSurfaceTiming.maximumProgrammaticRevealMs,
    "FENNEVIA_EDGE_HIDE_DELAY_INVALID",
  );
  if (
    typeof scheduler?.setTimeout !== "function" ||
    typeof scheduler?.clearTimeout !== "function" ||
    typeof onError !== "function"
  ) {
    throw createEdgeSurfaceError("FENNEVIA_EDGE_CONTROLLER_OPTIONS_INVALID");
  }

  const holds = createHolds();
  const listeners = new Set<(snapshot: EdgeSurfaceSnapshot) => void>();
  let disposed = false;
  let enabled = true;
  let hideTimer: TimerHandle | undefined;
  let programmaticTimer: TimerHandle | undefined;
  let revision = 0;
  let visible = false;

  const snapshot = (): EdgeSurfaceSnapshot =>
    Object.freeze({
      edge,
      enabled,
      holds: Object.freeze({ ...holds }),
      phase: phaseFromState({
        disposed,
        enabled,
        hidePending: hideTimer !== undefined,
        holds,
        visible,
      }),
      revision,
      visible,
    });

  const reportError = (error: unknown): void => {
    try {
      onError(error);
    } catch {
      // The caller's fatal-error boundary owns reporting. A reporting failure
      // cannot be allowed to create an unbounded timer exception loop.
    }
  };

  const publish = (): void => {
    revision += 1;
    const current = snapshot();
    for (const listener of Array.from(listeners)) {
      try {
        listener(current);
      } catch (error) {
        reportError(error);
      }
    }
  };

  const clearHideTimer = (): boolean => {
    if (hideTimer === undefined) {
      return false;
    }
    const timer = hideTimer;
    hideTimer = undefined;
    scheduler.clearTimeout(timer);
    return true;
  };

  const clearProgrammaticTimer = (): boolean => {
    if (programmaticTimer === undefined) {
      return false;
    }
    const timer = programmaticTimer;
    programmaticTimer = undefined;
    scheduler.clearTimeout(timer);
    return true;
  };

  const requireUsable = (): void => {
    if (disposed) {
      throw createEdgeSurfaceError("FENNEVIA_EDGE_CONTROLLER_DISPOSED");
    }
  };

  const hideNow = (): boolean => {
    const changed = clearHideTimer() || visible;
    visible = false;
    if (changed) {
      publish();
    }
    return changed;
  };

  const scheduleHide = (): boolean => {
    if (!enabled || disposed || hasHold(holds) || !visible) {
      return false;
    }
    if (hideTimer !== undefined) {
      return false;
    }
    hideTimer = scheduler.setTimeout(() => {
      hideTimer = undefined;
      if (!disposed && enabled && !hasHold(holds) && visible) {
        visible = false;
        publish();
      }
    }, hideDelayMs);
    publish();
    return true;
  };

  const setHold = (name: HoldName, held: boolean): boolean => {
    requireUsable();
    if (!enabled && held) {
      return false;
    }
    if (holds[name] === held) {
      return false;
    }

    holds[name] = held;
    if (held) {
      clearHideTimer();
      visible = true;
      publish();
    } else if (hasHold(holds)) {
      publish();
    } else {
      scheduleHide();
    }
    return true;
  };

  const controller: EdgeSurfaceController = Object.freeze({
    dismiss() {
      requireUsable();
      let changed = clearProgrammaticTimer();
      for (const name of [
        "focus",
        "keyboard",
        "pointer",
        "programmatic",
      ] as const) {
        changed = holds[name] || changed;
        holds[name] = false;
      }
      if (holds.popup) {
        if (changed) {
          publish();
        }
        return changed;
      }
      return hideNow() || changed;
    },

    dispose() {
      if (disposed) {
        return false;
      }
      clearHideTimer();
      clearProgrammaticTimer();
      for (const name of holdNames) {
        holds[name] = false;
      }
      enabled = false;
      visible = false;
      disposed = true;
      publish();
      listeners.clear();
      return true;
    },

    releaseKeyboard() {
      return setHold("keyboard", false);
    },

    revealFromKeyboard() {
      return setHold("keyboard", true);
    },

    revealProgrammatically(
      durationMs = edgeSurfaceTiming.defaultProgrammaticRevealMs,
    ) {
      requireUsable();
      validateDelay(
        durationMs,
        edgeSurfaceTiming.maximumProgrammaticRevealMs,
        "FENNEVIA_EDGE_PROGRAMMATIC_DURATION_INVALID",
      );
      if (!enabled) {
        return false;
      }
      clearProgrammaticTimer();
      const changed = setHold("programmatic", true);
      programmaticTimer = scheduler.setTimeout(() => {
        programmaticTimer = undefined;
        try {
          setHold("programmatic", false);
        } catch (error) {
          reportError(error);
        }
      }, durationMs);
      return changed;
    },

    setEnabled(nextEnabled) {
      requireUsable();
      if (enabled === nextEnabled) {
        return false;
      }
      enabled = nextEnabled;
      clearHideTimer();
      clearProgrammaticTimer();
      for (const name of holdNames) {
        holds[name] = false;
      }
      visible = false;
      publish();
      return true;
    },

    setFocusHeld(held) {
      return setHold("focus", held);
    },

    setPointerHeld(held) {
      return setHold("pointer", held);
    },

    setPopupHeld(held) {
      return setHold("popup", held);
    },

    snapshot,

    subscribe(listener) {
      requireUsable();
      if (typeof listener !== "function") {
        throw createEdgeSurfaceError("FENNEVIA_EDGE_LISTENER_INVALID");
      }
      listeners.add(listener);
      let subscribed = true;
      return () => {
        if (!subscribed) {
          return false;
        }
        subscribed = false;
        listeners.delete(listener);
        return true;
      };
    },
  });

  return controller;
}

function createSurfaceRecord(
  options: ControllerOptions,
): Record<EdgeName, EdgeSurfaceController> {
  return Object.fromEntries(
    edgeNames.map((edge) => [edge, createEdgeSurfaceController(edge, options)]),
  ) as Record<EdgeName, EdgeSurfaceController>;
}

export function createEdgeShellController(
  options: ControllerOptions = {},
): EdgeShellController {
  const surfaces = createSurfaceRecord(options);
  let activeEdge: EdgeName | null = null;
  let disposed = false;
  let enabled = true;

  const requireEdge = (edge: EdgeName): EdgeSurfaceController => {
    if (!isEdgeName(edge)) {
      throw createEdgeSurfaceError("FENNEVIA_EDGE_NAME_INVALID");
    }
    return surfaces[edge];
  };

  const requireUsable = (): void => {
    if (disposed) {
      throw createEdgeSurfaceError("FENNEVIA_EDGE_SHELL_DISPOSED");
    }
  };

  const markActive = (edge: EdgeName, changed: boolean): boolean => {
    if (changed) {
      activeEdge = edge;
    }
    return changed;
  };

  const revealPointer = (edge: EdgeName): boolean => {
    let changed = false;
    for (const candidate of edgeNames) {
      changed =
        surfaces[candidate].setPointerHeld(candidate === edge) || changed;
    }
    return markActive(edge, changed);
  };

  const resolveActiveEdge = (): EdgeName | null => {
    if (activeEdge && surfaces[activeEdge].snapshot().visible) {
      return activeEdge;
    }
    return (
      [...edgeNames]
        .reverse()
        .find((edge) => surfaces[edge].snapshot().visible) ?? null
    );
  };

  return Object.freeze({
    dismiss(edge) {
      requireUsable();
      const changed = requireEdge(edge).dismiss();
      if (activeEdge === edge && !requireEdge(edge).snapshot().visible) {
        activeEdge = null;
      }
      return changed;
    },

    dismissActive() {
      requireUsable();
      const candidates = [
        ...(activeEdge ? [activeEdge] : []),
        ...edgeNames.filter((edge) => edge !== activeEdge).reverse(),
      ];
      const target = candidates.find((edge) => {
        const candidate = surfaces[edge].snapshot();
        return candidate.visible && !candidate.holds.popup;
      });
      if (!target) {
        return null;
      }
      surfaces[target].dismiss();
      if (!surfaces[target].snapshot().visible) {
        activeEdge = null;
      }
      return target;
    },

    dispose() {
      if (disposed) {
        return false;
      }
      disposed = true;
      enabled = false;
      activeEdge = null;
      for (const edge of [...edgeNames].reverse()) {
        surfaces[edge].dispose();
      }
      return true;
    },

    getSurface(edge) {
      requireUsable();
      return requireEdge(edge);
    },

    releaseKeyboard(edge) {
      requireUsable();
      return requireEdge(edge).releaseKeyboard();
    },

    revealFromKeyboard(edge) {
      requireUsable();
      return markActive(edge, requireEdge(edge).revealFromKeyboard());
    },

    revealFromPointer(edge) {
      requireUsable();
      requireEdge(edge);
      return revealPointer(edge);
    },

    revealProgrammatically(edge, durationMs) {
      requireUsable();
      return markActive(
        edge,
        requireEdge(edge).revealProgrammatically(durationMs),
      );
    },

    setEnabled(nextEnabled) {
      requireUsable();
      if (enabled === nextEnabled) {
        return false;
      }
      enabled = nextEnabled;
      activeEdge = null;
      for (const edge of edgeNames) {
        surfaces[edge].setEnabled(nextEnabled);
      }
      return true;
    },

    setFocusHeld(edge, held) {
      requireUsable();
      return markActive(edge, requireEdge(edge).setFocusHeld(held));
    },

    setPointerHeld(edge, held) {
      requireUsable();
      if (held) {
        requireEdge(edge);
        return revealPointer(edge);
      }
      return requireEdge(edge).setPointerHeld(false);
    },

    setPopupHeld(edge, held) {
      requireUsable();
      return markActive(edge, requireEdge(edge).setPopupHeld(held));
    },

    snapshot() {
      activeEdge = resolveActiveEdge();
      return Object.freeze({
        activeEdge,
        disposed,
        enabled,
        surfaces: Object.freeze(
          Object.fromEntries(
            edgeNames.map((edge) => [edge, surfaces[edge].snapshot()]),
          ) as Record<EdgeName, EdgeSurfaceSnapshot>,
        ),
      });
    },
  });
}

type EdgePoint = Readonly<{
  height: number;
  thickness: number;
  width: number;
  x: number;
  y: number;
}>;

const cornerPriority: Readonly<Record<EdgeName, number>> = Object.freeze({
  left: 0,
  right: 1,
  top: 2,
  bottom: 3,
});

export function resolveEdgeAtPoint({
  height,
  thickness,
  width,
  x,
  y,
}: EdgePoint): EdgeName | null {
  if (
    ![height, thickness, width, x, y].every(Number.isFinite) ||
    height <= 0 ||
    width <= 0 ||
    thickness <= 0 ||
    x < 0 ||
    y < 0 ||
    x > width ||
    y > height
  ) {
    return null;
  }

  const distances: Readonly<Record<EdgeName, number>> = {
    top: y,
    left: x,
    right: width - x,
    bottom: height - y,
  };
  const candidates = edgeNames
    .filter((edge) => distances[edge] <= thickness)
    .sort(
      (left, right) =>
        distances[left] - distances[right] ||
        cornerPriority[left] - cornerPriority[right],
    );
  return candidates[0] ?? null;
}

export function getKeyboardRevealEdge(
  event: Readonly<{
    altKey?: boolean;
    code?: string;
    ctrlKey?: boolean;
    key?: string;
    metaKey?: boolean;
    shiftKey?: boolean;
  }>,
): EdgeName | null {
  if (
    event.altKey !== true ||
    event.ctrlKey !== true ||
    event.shiftKey !== true ||
    event.metaKey === true
  ) {
    return null;
  }
  const key = event.code || event.key;
  const edgeByKey: Readonly<Record<string, EdgeName>> = {
    ArrowUp: "top",
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowDown: "bottom",
  };
  return edgeByKey[key ?? ""] ?? null;
}

export const edgeKeyboardBindings = Object.freeze({
  top: "Ctrl+Alt+Shift+ArrowUp",
  left: "Ctrl+Alt+Shift+ArrowLeft",
  right: "Ctrl+Alt+Shift+ArrowRight",
  bottom: "Ctrl+Alt+Shift+ArrowDown",
});
