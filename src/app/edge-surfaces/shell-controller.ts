// SPDX-License-Identifier: MPL-2.0

import {
  edgeInteractionBounds,
  edgeInteractionDefaults,
  edgeNames,
} from "./contracts.ts";
import type {
  EdgeInteractionConfig,
  EdgeName,
  PointerExitLocation,
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

const isBoundedInteger = (
  value: unknown,
  bounds: Readonly<{ max: number; min: number }>,
): value is number =>
  Number.isSafeInteger(value) &&
  (value as number) >= bounds.min &&
  (value as number) <= bounds.max;

function copyInteractionConfig(candidate: unknown): EdgeInteractionConfig {
  if (!candidate || typeof candidate !== "object") {
    throw createEdgeSurfaceError("FENNEVIA_EDGE_INTERACTION_CONFIG_INVALID");
  }
  const config = candidate as Record<string, unknown>;
  if (
    !isBoundedInteger(config.hideDelayMs, edgeInteractionBounds.hideDelayMs) ||
    !isBoundedInteger(
      config.programmaticRevealMs,
      edgeInteractionBounds.programmaticRevealMs,
    ) ||
    !isBoundedInteger(
      config.triggerThicknessCssPixels,
      edgeInteractionBounds.triggerThicknessCssPixels,
    ) ||
    !isBoundedInteger(
      config.windowLeaveHideDelayMs,
      edgeInteractionBounds.windowLeaveHideDelayMs,
    )
  ) {
    throw createEdgeSurfaceError("FENNEVIA_EDGE_INTERACTION_CONFIG_INVALID");
  }
  return Object.freeze({
    hideDelayMs: config.hideDelayMs,
    programmaticRevealMs: config.programmaticRevealMs,
    triggerThicknessCssPixels: config.triggerThicknessCssPixels,
    windowLeaveHideDelayMs: config.windowLeaveHideDelayMs,
  });
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
  let interaction: EdgeInteractionConfig = Object.freeze({
    ...edgeInteractionDefaults,
    hideDelayMs: options.hideDelayMs ?? edgeInteractionDefaults.hideDelayMs,
    windowLeaveHideDelayMs:
      options.windowLeaveHideDelayMs ??
      edgeInteractionDefaults.windowLeaveHideDelayMs,
  });
  let interactionSuppressed = false;
  let windowDragActive = false;

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
  const pointerInteractionsEnabled = (): boolean =>
    interactionsEnabled() && !windowDragActive;

  const syncSurfaceEnabled = (): void => {
    const nextEnabled = interactionsEnabled();
    for (const edge of edgeNames) {
      surfaces[edge].setEnabled(nextEnabled);
    }
  };

  const revealPointer = (edge: EdgeName): boolean => {
    if (!pointerInteractionsEnabled()) {
      return false;
    }
    let changed = false;
    for (const candidate of edgeNames) {
      changed =
        surfaces[candidate].setPointerHeld(candidate === edge) || changed;
    }
    return markActive(edge, changed);
  };

  const releasePointer = (
    edge: EdgeName,
    location: PointerExitLocation,
  ): boolean => requireEdge(edge).setPointerHeld(false, location);

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
      windowDragActive = false;
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

    releasePointer(edge, location) {
      requireUsable();
      return releasePointer(edge, location);
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
        requireEdge(edge).revealProgrammatically(
          durationMs ?? interaction.programmaticRevealMs,
        ),
      );
    },

    setEnabled(nextEnabled) {
      requireUsable();
      if (enabled === nextEnabled) {
        return false;
      }
      enabled = nextEnabled;
      if (!nextEnabled) {
        windowDragActive = false;
      }
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

    setInteractionConfig(config) {
      requireUsable();
      const next = copyInteractionConfig(config);
      if (
        interaction.hideDelayMs === next.hideDelayMs &&
        interaction.programmaticRevealMs === next.programmaticRevealMs &&
        interaction.triggerThicknessCssPixels ===
          next.triggerThicknessCssPixels &&
        interaction.windowLeaveHideDelayMs === next.windowLeaveHideDelayMs
      ) {
        return false;
      }
      if (interaction.hideDelayMs !== next.hideDelayMs) {
        for (const edge of edgeNames) {
          surfaces[edge].setHideDelayMs(next.hideDelayMs);
        }
      }
      if (interaction.windowLeaveHideDelayMs !== next.windowLeaveHideDelayMs) {
        for (const edge of edgeNames) {
          surfaces[edge].setWindowLeaveHideDelayMs(next.windowLeaveHideDelayMs);
        }
      }
      interaction = next;
      return true;
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
      if (nextSuppressed) {
        windowDragActive = false;
      }
      activeEdge = null;
      syncSurfaceEnabled();
      return true;
    },

    setPointerHeld(edge, held) {
      requireUsable();
      if (held && !pointerInteractionsEnabled()) {
        return false;
      }
      if (held) {
        requireEdge(edge);
        return revealPointer(edge);
      }
      return releasePointer(edge, "inside-window");
    },

    setPopupHeld(edge, held) {
      requireUsable();
      if (held && !interactionsEnabled()) {
        return false;
      }
      return markActive(edge, requireEdge(edge).setPopupHeld(held));
    },

    setWindowDragActive(nextActive) {
      requireUsable();
      if (typeof nextActive !== "boolean") {
        throw createEdgeSurfaceError(
          "FENNEVIA_EDGE_WINDOW_DRAG_ACTIVE_INVALID",
        );
      }
      if (windowDragActive === nextActive) {
        return false;
      }
      if (nextActive && !interactionsEnabled()) {
        return false;
      }
      windowDragActive = nextActive;
      if (nextActive) {
        // Firefox's four edge roots are separate Svelte mounts. Keep native
        // window dragging in this shared controller so one root cannot reveal
        // another while Windows is running its native move loop.
        for (const edge of edgeNames) {
          releasePointer(edge, "inside-window");
        }
      }
      return true;
    },

    snapshot() {
      activeEdge = resolveActiveEdge();
      return Object.freeze({
        activeEdge,
        disposed,
        enabled,
        interaction,
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
