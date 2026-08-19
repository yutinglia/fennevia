import { edgeNames, type EdgeShellController } from "./edge-surfaces.ts";
import {
  isToolbarZoneName,
  type ToolbarZoneName,
} from "./toolbar-widgets-state.ts";

export const customizeActiveAttribute = "data-fennevia-customize-active";

export type CustomizeSessionFrame = Readonly<{
  removeAttribute: (name: string) => void;
  setAttribute: (name: string, value: string) => void;
}>;

export type CustomizeSessionSnapshot = Readonly<{
  lastFocusedZone: ToolbarZoneName;
  open: boolean;
}>;

export type CustomizeSessionController = Readonly<{
  dispose: () => boolean;
  isOpen: () => boolean;
  lastFocusedZone: () => ToolbarZoneName;
  restoreHolds: () => boolean;
  setLastFocusedZone: (zone: ToolbarZoneName) => boolean;
  setOpen: (open: boolean) => boolean;
  snapshot: () => CustomizeSessionSnapshot;
  subscribe: (
    listener: (snapshot: CustomizeSessionSnapshot) => void,
  ) => () => boolean;
}>;

type SessionOptions = Readonly<{
  frame: CustomizeSessionFrame;
  onError?: (error: unknown) => void;
  shell: EdgeShellController;
}>;

function createCustomizeSessionError(code: string): Error {
  const error = new Error(code);
  error.name = "FenneviaCustomizeSessionError";
  Object.defineProperties(error, {
    fenneviaCode: { enumerable: false, value: code },
    fenneviaPhase: { enumerable: false, value: "customize-session" },
  });
  return error;
}

export function createCustomizeSessionController({
  frame,
  onError,
  shell,
}: SessionOptions): CustomizeSessionController {
  if (
    !frame ||
    typeof frame.removeAttribute !== "function" ||
    typeof frame.setAttribute !== "function"
  ) {
    throw createCustomizeSessionError(
      "FENNEVIA_CUSTOMIZE_SESSION_FRAME_INVALID",
    );
  }
  if (!shell || typeof shell.setPopupHeld !== "function") {
    throw createCustomizeSessionError(
      "FENNEVIA_CUSTOMIZE_SESSION_SHELL_INVALID",
    );
  }

  let disposed = false;
  let open = false;
  let focusedZone: ToolbarZoneName = "top";
  const listeners = new Set<(snapshot: CustomizeSessionSnapshot) => void>();

  const reportError = (error: unknown): void => {
    if (typeof onError === "function") {
      onError(error);
    }
  };

  const requireUsable = (): void => {
    if (disposed) {
      throw createCustomizeSessionError("FENNEVIA_CUSTOMIZE_SESSION_DISPOSED");
    }
  };

  const currentSnapshot = (): CustomizeSessionSnapshot =>
    Object.freeze({
      lastFocusedZone: focusedZone,
      open,
    });

  const publish = (): void => {
    const snapshot = currentSnapshot();
    for (const listener of listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        reportError(error);
      }
    }
  };

  const interactionsEnabled = (): boolean => {
    const snapshot = shell.snapshot();
    return snapshot.enabled && !snapshot.interactionSuppressed;
  };

  const holdAllPopup = (held: boolean): boolean => {
    let changed = false;
    for (const edge of edgeNames) {
      changed = shell.setPopupHeld(edge, held) || changed;
    }
    return changed;
  };

  const applyOpen = (nextOpen: boolean): boolean => {
    requireUsable();
    if (nextOpen && !interactionsEnabled()) {
      return false;
    }
    if (open === nextOpen) {
      if (nextOpen) {
        holdAllPopup(true);
      }
      return false;
    }

    open = nextOpen;
    if (nextOpen) {
      focusedZone = "top";
      holdAllPopup(true);
      frame.setAttribute(customizeActiveAttribute, "");
    } else {
      frame.removeAttribute(customizeActiveAttribute);
      holdAllPopup(false);
    }
    publish();
    return true;
  };

  return Object.freeze({
    dispose() {
      if (disposed) {
        return false;
      }
      if (open) {
        open = false;
        try {
          frame.removeAttribute(customizeActiveAttribute);
        } catch (error) {
          reportError(error);
        }
        try {
          holdAllPopup(false);
        } catch (error) {
          reportError(error);
        }
        publish();
      }
      disposed = true;
      listeners.clear();
      return true;
    },

    isOpen() {
      return open;
    },

    lastFocusedZone() {
      return focusedZone;
    },

    restoreHolds() {
      requireUsable();
      if (!open || !interactionsEnabled()) {
        return false;
      }
      holdAllPopup(true);
      return true;
    },

    setLastFocusedZone(zone) {
      requireUsable();
      if (!isToolbarZoneName(zone)) {
        throw createCustomizeSessionError(
          "FENNEVIA_CUSTOMIZE_SESSION_ZONE_INVALID",
        );
      }
      if (focusedZone === zone) {
        return false;
      }
      focusedZone = zone;
      publish();
      return true;
    },

    setOpen(nextOpen) {
      if (typeof nextOpen !== "boolean") {
        throw createCustomizeSessionError(
          "FENNEVIA_CUSTOMIZE_SESSION_OPEN_INVALID",
        );
      }
      return applyOpen(nextOpen);
    },

    snapshot() {
      return currentSnapshot();
    },

    subscribe(listener) {
      requireUsable();
      if (typeof listener !== "function") {
        throw createCustomizeSessionError(
          "FENNEVIA_CUSTOMIZE_SESSION_LISTENER_INVALID",
        );
      }
      listeners.add(listener);
      let subscribed = true;
      return () => {
        if (!subscribed || disposed) {
          return false;
        }
        subscribed = false;
        listeners.delete(listener);
        return true;
      };
    },
  });
}
