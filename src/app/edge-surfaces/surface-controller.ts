// SPDX-License-Identifier: MPL-2.0

import { edgeNames, edgeSurfaceTiming, holdNames } from "./contracts.ts";
import type {
  EdgeName,
  EdgeSurfacePhase,
  EdgeSurfaceSnapshot,
  EdgeSurfaceController,
  TimerHandle,
  Scheduler,
  ControllerOptions,
  HoldName,
} from "./contracts.ts";

const defaultScheduler: Scheduler = Object.freeze({
  clearTimeout(handle) {
    globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>);
  },
  setTimeout(callback, delayMs) {
    return globalThis.setTimeout(callback, delayMs);
  },
});

export function createEdgeSurfaceError(code: string): Error {
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
