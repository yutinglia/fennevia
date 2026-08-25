// SPDX-License-Identifier: MPL-2.0

import {
  defaultEdgePanelDodgeMode,
  edgeInteractionBounds,
  edgeInteractionDefaults,
  edgeNames,
  edgeProgrammaticRevealReasons,
  isEdgePanelDodgeMode,
  pointerExitLocations,
} from "./contracts.ts";
import type {
  EdgeInteractionConfig,
  EdgeName,
  EdgePanelDodgeMode,
  EdgeProgrammaticRevealReason,
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
  const edgeEnabled = Object.fromEntries(
    edgeNames.map((edge) => [edge, true]),
  ) as Record<EdgeName, boolean>;
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
  let panelDodgeMode: EdgePanelDodgeMode = defaultEdgePanelDodgeMode;
  let windowDragActive = false;
  let windowDragEdge: EdgeName | null = null;

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
  const singlePanelMode = (): boolean =>
    panelDodgeMode === "single-dynamic" || panelDodgeMode === "single-reserved";

  const syncSurfaceEnabled = (): void => {
    for (const edge of edgeNames) {
      surfaces[edge].setEnabled(interactionsEnabled() && edgeEnabled[edge]);
    }
  };

  const prepareSinglePanelReveal = (
    edge: EdgeName,
    allowConcurrent = false,
    allowPopupReplacement = false,
  ): Readonly<{ allowed: boolean; changed: boolean }> => {
    if (!singlePanelMode() || allowConcurrent) {
      return Object.freeze({ allowed: true, changed: false });
    }
    const blockingPopup = edgeNames.find((candidate) => {
      const snapshot = surfaces[candidate].snapshot();
      return candidate !== edge && snapshot.visible && snapshot.holds.popup;
    });
    if (blockingPopup && !allowPopupReplacement) {
      return Object.freeze({ allowed: false, changed: false });
    }
    let changed = false;
    for (const candidate of edgeNames) {
      if (candidate !== edge) {
        changed = surfaces[candidate].dismiss() || changed;
      }
    }
    return Object.freeze({ allowed: true, changed });
  };

  const convergeSinglePanelVisibility = (): void => {
    if (!singlePanelMode()) {
      return;
    }
    const visibleEdges = edgeNames.filter(
      (edge) => surfaces[edge].snapshot().visible,
    );
    if (visibleEdges.length <= 1) {
      activeEdge = visibleEdges[0] ?? null;
      return;
    }
    const survivor =
      visibleEdges.find((edge) => surfaces[edge].snapshot().holds.popup) ??
      (activeEdge && visibleEdges.includes(activeEdge) ? activeEdge : null) ??
      visibleEdges.at(-1) ??
      null;
    for (const edge of visibleEdges) {
      if (edge !== survivor) {
        surfaces[edge].dismiss();
      }
    }
    activeEdge = survivor;
  };

  const revealPointer = (edge: EdgeName): boolean => {
    if (!pointerInteractionsEnabled()) {
      return false;
    }
    const prepared = prepareSinglePanelReveal(edge);
    if (!prepared.allowed) {
      return false;
    }
    let changed = prepared.changed;
    for (const candidate of edgeNames) {
      changed =
        surfaces[candidate].setPointerHeld(candidate === edge) || changed;
    }
    return markActive(edge, changed);
  };

  const releasePointer = (
    edge: EdgeName,
    location: PointerExitLocation,
  ): boolean => {
    const surface = requireEdge(edge);
    if (!pointerExitLocations.includes(location)) {
      throw createEdgeSurfaceError(
        "FENNEVIA_EDGE_POINTER_EXIT_LOCATION_INVALID",
      );
    }
    if (windowDragActive && windowDragEdge === edge) {
      return false;
    }
    return surface.setPointerHeld(false, location);
  };

  const resolveWindowDragEdge = (edge?: EdgeName): EdgeName | null => {
    const candidate =
      edge ??
      windowDragEdge ??
      edgeNames.find(
        (candidateEdge) => surfaces[candidateEdge].snapshot().holds.pointer,
      ) ??
      null;
    return candidate !== null && edgeEnabled[candidate] ? candidate : null;
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
      windowDragActive = false;
      windowDragEdge = null;
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
      const surface = requireEdge(edge);
      const prepared = prepareSinglePanelReveal(edge);
      if (!prepared.allowed) {
        return false;
      }
      return markActive(edge, surface.revealFromKeyboard() || prepared.changed);
    },

    revealFromPointer(edge) {
      requireUsable();
      requireEdge(edge);
      return revealPointer(edge);
    },

    revealProgrammatically(
      edge,
      durationMs,
      reason: EdgeProgrammaticRevealReason = "default",
    ) {
      requireUsable();
      if (!edgeProgrammaticRevealReasons.includes(reason)) {
        throw createEdgeSurfaceError(
          "FENNEVIA_EDGE_PROGRAMMATIC_REASON_INVALID",
        );
      }
      if (!interactionsEnabled()) {
        return false;
      }
      const surface = requireEdge(edge);
      const prepared = prepareSinglePanelReveal(
        edge,
        reason === "new-tab-highlight",
      );
      if (!prepared.allowed) {
        return false;
      }
      return markActive(
        edge,
        surface.revealProgrammatically(
          durationMs ?? interaction.programmaticRevealMs,
        ) || prepared.changed,
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
        windowDragEdge = null;
      }
      activeEdge = null;
      syncSurfaceEnabled();
      return true;
    },

    setEdgeEnabled(edge, nextEnabled) {
      requireUsable();
      const surface = requireEdge(edge);
      if (typeof nextEnabled !== "boolean") {
        throw createEdgeSurfaceError("FENNEVIA_EDGE_ENABLED_INVALID");
      }
      if (edgeEnabled[edge] === nextEnabled) {
        return false;
      }
      edgeEnabled[edge] = nextEnabled;
      if (!nextEnabled && windowDragEdge === edge) {
        windowDragActive = false;
        windowDragEdge = null;
      }
      if (!nextEnabled && activeEdge === edge) {
        activeEdge = null;
      }
      surface.setEnabled(interactionsEnabled() && nextEnabled);
      return true;
    },

    setFocusHeld(edge, held) {
      requireUsable();
      if (held && !interactionsEnabled()) {
        return false;
      }
      const surface = requireEdge(edge);
      if (!held) {
        return surface.setFocusHeld(false);
      }
      const prepared = prepareSinglePanelReveal(edge);
      if (!prepared.allowed) {
        return false;
      }
      return markActive(edge, surface.setFocusHeld(true) || prepared.changed);
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
        windowDragEdge = null;
      }
      activeEdge = null;
      syncSurfaceEnabled();
      return true;
    },

    setPanelDodgeMode(nextMode) {
      requireUsable();
      if (!isEdgePanelDodgeMode(nextMode)) {
        throw createEdgeSurfaceError("FENNEVIA_EDGE_PANEL_DODGE_MODE_INVALID");
      }
      if (panelDodgeMode === nextMode) {
        return false;
      }
      panelDodgeMode = nextMode;
      convergeSinglePanelVisibility();
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
      const surface = requireEdge(edge);
      if (!held) {
        return surface.setPopupHeld(false);
      }
      const prepared = prepareSinglePanelReveal(edge, false, true);
      return markActive(edge, surface.setPopupHeld(true) || prepared.changed);
    },

    setWindowDragActive(nextActive, edge) {
      requireUsable();
      if (typeof nextActive !== "boolean") {
        throw createEdgeSurfaceError(
          "FENNEVIA_EDGE_WINDOW_DRAG_ACTIVE_INVALID",
        );
      }
      if (edge !== undefined) {
        requireEdge(edge);
      }
      const nextDragEdge = nextActive ? resolveWindowDragEdge(edge) : null;
      if (windowDragActive === nextActive && windowDragEdge === nextDragEdge) {
        return false;
      }
      if (nextActive && !interactionsEnabled()) {
        return false;
      }
      windowDragActive = nextActive;
      windowDragEdge = nextDragEdge;
      if (nextActive) {
        // Firefox's four edge roots are separate Svelte mounts. Keep native
        // window dragging in this shared controller so the source remains
        // visible without allowing another root to reveal during the native
        // Windows move loop.
        for (const candidate of edgeNames) {
          surfaces[candidate].setPointerHeld(candidate === nextDragEdge);
        }
        if (nextDragEdge) {
          activeEdge = nextDragEdge;
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
        panelDodgeMode,
        surfaces: Object.freeze(
          Object.fromEntries(
            edgeNames.map((edge) => [edge, surfaces[edge].snapshot()]),
          ) as Record<EdgeName, EdgeSurfaceSnapshot>,
        ),
      });
    },
  });
}
