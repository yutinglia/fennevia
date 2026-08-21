// SPDX-License-Identifier: MPL-2.0

import { edgeNames } from "./contracts.ts";
import type {
  EdgeName,
  EdgeSurfaceSnapshot,
  EdgeSurfaceController,
  EdgeShellController,
  ControllerOptions,
} from "./contracts.ts";
import {
  createEdgeSurfaceError,
  isEdgeName,
  createEdgeSurfaceController,
} from "./surface-controller.ts";

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
  let interactionSuppressed = false;

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

  const interactionsEnabled = (): boolean => enabled && !interactionSuppressed;

  const syncSurfaceEnabled = (): void => {
    const nextEnabled = interactionsEnabled();
    for (const edge of edgeNames) {
      surfaces[edge].setEnabled(nextEnabled);
    }
  };

  const revealPointer = (edge: EdgeName): boolean => {
    if (!interactionsEnabled()) {
      return false;
    }
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
      interactionSuppressed = false;
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
      if (!interactionsEnabled()) {
        return false;
      }
      return markActive(edge, requireEdge(edge).revealFromKeyboard());
    },

    revealFromPointer(edge) {
      requireUsable();
      requireEdge(edge);
      return revealPointer(edge);
    },

    revealProgrammatically(edge, durationMs) {
      requireUsable();
      if (!interactionsEnabled()) {
        return false;
      }
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
      syncSurfaceEnabled();
      return true;
    },

    setFocusHeld(edge, held) {
      requireUsable();
      if (held && !interactionsEnabled()) {
        return false;
      }
      return markActive(edge, requireEdge(edge).setFocusHeld(held));
    },

    setInteractionSuppressed(nextSuppressed) {
      requireUsable();
      if (
        typeof nextSuppressed !== "boolean" ||
        interactionSuppressed === nextSuppressed
      ) {
        return false;
      }
      interactionSuppressed = nextSuppressed;
      activeEdge = null;
      syncSurfaceEnabled();
      return true;
    },

    setPointerHeld(edge, held) {
      requireUsable();
      if (held && !interactionsEnabled()) {
        return false;
      }
      if (held) {
        requireEdge(edge);
        return revealPointer(edge);
      }
      return requireEdge(edge).setPointerHeld(false);
    },

    setPopupHeld(edge, held) {
      requireUsable();
      if (held && !interactionsEnabled()) {
        return false;
      }
      return markActive(edge, requireEdge(edge).setPopupHeld(held));
    },

    snapshot() {
      activeEdge = resolveActiveEdge();
      return Object.freeze({
        activeEdge,
        disposed,
        enabled,
        interactionSuppressed,
        surfaces: Object.freeze(
          Object.fromEntries(
            edgeNames.map((edge) => [edge, surfaces[edge].snapshot()]),
          ) as Record<EdgeName, EdgeSurfaceSnapshot>,
        ),
      });
    },
  });
}
