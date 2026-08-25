// SPDX-License-Identifier: MPL-2.0
import { flushSync } from "svelte";

import { edgeNames, type EdgeName } from "../../app/edge-surfaces";
import {
  createFrontendError,
  getFocusableOrigin,
  type EdgeMountTargets,
  type FocusableElement,
} from "./contracts";

export type SurfaceFocusCoordinator = Readonly<{
  activeElementFor: (edge: EdgeName) => FocusableElement | null;
  clear: () => void;
  discardFocusOrigin: (edge: EdgeName) => void;
  focusSurface: (edge: EdgeName, selectText?: boolean) => boolean;
  onFrameFocusIn: (event: FocusEvent) => void;
  restoreFocus: (edge: EdgeName) => void;
}>;

export function createSurfaceFocusCoordinator({
  frame,
  targets,
}: Readonly<{
  frame: HTMLElement;
  targets: EdgeMountTargets;
}>): SurfaceFocusCoordinator {
  const focusOrigins = new Map<EdgeName, FocusableElement>();

  const activeElementFor = (edge: EdgeName): FocusableElement | null => {
    const active = getFocusableOrigin(frame.ownerDocument.activeElement);
    return active && targets[edge].contains(active) ? active : null;
  };

  const restoreFocus = (edge: EdgeName): void => {
    const active = activeElementFor(edge);
    const origin = focusOrigins.get(edge);
    focusOrigins.delete(edge);
    if (origin?.isConnected && !frame.contains(origin)) {
      origin.focus({ preventScroll: true });
    } else {
      active?.blur?.();
    }
  };

  return Object.freeze({
    activeElementFor,

    clear(): void {
      focusOrigins.clear();
    },

    discardFocusOrigin(edge: EdgeName): void {
      focusOrigins.delete(edge);
    },

    focusSurface(edge: EdgeName, selectText = false): boolean {
      const active = getFocusableOrigin(frame.ownerDocument.activeElement);
      if (active && !frame.contains(active)) {
        focusOrigins.set(edge, active);
      } else {
        const focusedEdge = active
          ? edgeNames.find((candidate) => targets[candidate].contains(active))
          : undefined;
        const priorOrigin = focusedEdge
          ? focusOrigins.get(focusedEdge)
          : edgeNames
              .map((candidate) => focusOrigins.get(candidate))
              .find(
                (candidate) =>
                  candidate?.isConnected && !frame.contains(candidate),
              );
        if (priorOrigin) {
          focusOrigins.set(edge, priorOrigin);
        }
        if (focusedEdge && focusedEdge !== edge) {
          focusOrigins.delete(focusedEdge);
        }
      }
      flushSync();
      const focusTarget =
        targets[edge].querySelector<FocusableElement>(
          "[data-fennevia-default-focus]",
        ) ??
        targets[edge].querySelector<FocusableElement>(
          'button:not(:disabled):not([tabindex="-1"]), select:not(:disabled):not([tabindex="-1"]), input:not(:disabled):not([tabindex="-1"])',
        ) ??
        targets[edge].querySelector<FocusableElement>(
          "[data-fennevia-focus-fallback]",
        );
      if (!focusTarget) {
        throw createFrontendError("FENNEVIA_EDGE_FOCUS_TARGET_MISSING");
      }
      focusTarget.focus({ preventScroll: true });
      if (selectText) {
        focusTarget.select?.();
      }
      return targets[edge].contains(frame.ownerDocument.activeElement);
    },

    onFrameFocusIn(event: FocusEvent): void {
      const origin = getFocusableOrigin(event.relatedTarget);
      if (!origin || frame.contains(origin)) {
        return;
      }
      const edge = edgeNames.find((candidate) =>
        targets[candidate].contains(event.target as Node),
      );
      if (edge) {
        focusOrigins.set(edge, origin);
      }
    },

    restoreFocus,
  });
}
