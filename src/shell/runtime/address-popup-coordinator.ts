// SPDX-License-Identifier: MPL-2.0
import { flushSync } from "svelte";

import {
  createAddressPopupController,
  type AddressPopupController,
  type AddressPopupInvocationSource,
  type AddressPopupSnapshot,
} from "../../app/address-popup";
import type { BrowserNavigationStateAdapter } from "../../app/navigation-state";
import type { BrowserTabsStateAdapter } from "../../app/tab-state";
import {
  edgeNames,
  type EdgeName,
  type EdgeShellController,
} from "../../app/edge-surfaces";
import type { BrowserUrlbarCoverageStateAdapter } from "../../app/urlbar-coverage-state";
import {
  ADDRESS_POPUP_CLOSE_DELAY_MS,
  FRAME_ENVIRONMENT_ATTRIBUTE,
  createFrontendError,
  getFocusableOrigin,
  type EdgeMountTargets,
  type FocusableElement,
} from "./contracts";

export type AddressPopupCoordinator = Readonly<{
  closeForEnvironment: () => boolean;
  controller: AddressPopupController;
  dispose: () => boolean;
  isVisible: (snapshot?: AddressPopupSnapshot) => boolean;
  open: (source: AddressPopupInvocationSource) => boolean;
  openNativeUrlbar: () => boolean;
  scheduleClose: (snapshot: AddressPopupSnapshot) => void;
}>;

export function createAddressPopupCoordinator({
  closeCustomizeSession,
  frame,
  navigation,
  onFatalError,
  overlayTarget,
  shell,
  tabs,
  targets,
  urlbarCoverage,
  view,
}: Readonly<{
  closeCustomizeSession: () => boolean;
  frame: HTMLElement;
  navigation: BrowserNavigationStateAdapter;
  onFatalError: (error: unknown) => void;
  overlayTarget: Element;
  shell: EdgeShellController;
  tabs: BrowserTabsStateAdapter;
  targets: EdgeMountTargets;
  urlbarCoverage: BrowserUrlbarCoverageStateAdapter;
  view: Window;
}>): AddressPopupCoordinator {
  const controller = createAddressPopupController({ navigation, tabs });
  let closeTimer: number | undefined;
  let disposed = false;
  let focusOrigin: FocusableElement | null = null;
  let originEdge: EdgeName | null = null;

  const cancelCloseTimer = (): void => {
    if (closeTimer === undefined) {
      return;
    }
    view.clearTimeout(closeTimer);
    closeTimer = undefined;
  };

  const isVisible = (snapshot?: AddressPopupSnapshot): boolean => {
    const current = snapshot ?? controller.snapshot();
    return current.phase !== "hidden" && current.phase !== "disposed";
  };

  const focusPopup = (): boolean => {
    flushSync();
    const input = overlayTarget.querySelector<FocusableElement>(
      "[data-fennevia-address-popup-input]",
    );
    if (!input) {
      throw createFrontendError("FENNEVIA_ADDRESS_POPUP_FOCUS_TARGET_MISSING");
    }
    input.focus({ preventScroll: true });
    input.select?.();
    return overlayTarget.contains(frame.ownerDocument.activeElement);
  };

  const focusSelectedContent = (): void => {
    try {
      navigation.focusContent();
    } catch (error) {
      onFatalError(error);
    }
  };

  const restoreFocus = (snapshot: AddressPopupSnapshot): void => {
    if (
      frame.getAttribute(FRAME_ENVIRONMENT_ATTRIBUTE) !== "normal" ||
      snapshot.closeReason === "environment" ||
      snapshot.closeReason === "focus-failed"
    ) {
      const active = getFocusableOrigin(frame.ownerDocument.activeElement);
      if (active && overlayTarget.contains(active)) {
        active.blur?.();
      }
      return;
    }

    if (
      snapshot.closeReason === "committed" ||
      snapshot.closeReason === "tab-changed"
    ) {
      focusSelectedContent();
      return;
    }

    if (
      snapshot.invocationSource === "left-launcher" ||
      snapshot.invocationSource === "top-launcher"
    ) {
      shell.revealProgrammatically("left");
      flushSync();
      const launcher = targets.left.querySelector<FocusableElement>(
        "[data-fennevia-address-launcher]",
      );
      if (launcher?.isConnected) {
        launcher.focus({ preventScroll: true });
        if (targets.left.contains(frame.ownerDocument.activeElement)) {
          return;
        }
      }
      focusSelectedContent();
      return;
    }

    const priorOrigin = focusOrigin;
    if (originEdge) {
      shell.revealProgrammatically(originEdge);
      flushSync();
    }
    if (priorOrigin?.isConnected && !overlayTarget.contains(priorOrigin)) {
      priorOrigin.focus({ preventScroll: true });
      return;
    }
    focusSelectedContent();
  };

  const completeClose = (snapshot: AddressPopupSnapshot): void => {
    cancelCloseTimer();
    if (snapshot.phase !== "closing") {
      return;
    }
    controller.completeClose();
    shell.setInteractionSuppressed(false);
    restoreFocus(snapshot);
    focusOrigin = null;
    originEdge = null;
  };

  const closeForEnvironment = (): boolean => {
    if (disposed || !isVisible()) {
      return false;
    }
    controller.requestClose("environment");
    const closingSnapshot = controller.snapshot();
    if (closingSnapshot.phase !== "closing") {
      return false;
    }
    completeClose(closingSnapshot);
    return true;
  };

  const closeForNativeHandoff = (): boolean => {
    if (
      frame.getAttribute(FRAME_ENVIRONMENT_ATTRIBUTE) !== "normal" ||
      !closeForEnvironment()
    ) {
      return false;
    }
    flushSync();
    return true;
  };

  return Object.freeze({
    closeForEnvironment,
    controller,

    dispose(): boolean {
      if (disposed) {
        return false;
      }
      disposed = true;
      cancelCloseTimer();
      focusOrigin = null;
      originEdge = null;
      return controller.dispose();
    },

    isVisible,

    open(source: AddressPopupInvocationSource): boolean {
      if (
        disposed ||
        frame.getAttribute(FRAME_ENVIRONMENT_ATTRIBUTE) !== "normal"
      ) {
        return false;
      }
      try {
        const previousSnapshot = controller.snapshot();
        const wasVisible = isVisible(previousSnapshot);
        const active = getFocusableOrigin(frame.ownerDocument.activeElement);
        if (!wasVisible) {
          focusOrigin = active;
          originEdge = active
            ? (edgeNames.find((edge) => targets[edge].contains(active)) ?? null)
            : null;
        }
        cancelCloseTimer();
        controller.requestOpen(source);
        flushSync();
        if (!focusPopup()) {
          controller.requestClose("focus-failed");
          const closingSnapshot = controller.snapshot();
          if (closingSnapshot.phase === "closing") {
            completeClose(closingSnapshot);
          }
          return false;
        }
        controller.confirmOpen();
        closeCustomizeSession();
        shell.setInteractionSuppressed(true);
        return true;
      } catch (error) {
        onFatalError(error);
        return false;
      }
    },

    openNativeUrlbar(): boolean {
      if (!closeForNativeHandoff()) {
        return false;
      }
      return urlbarCoverage.openNativeUrlbar();
    },

    scheduleClose(snapshot: AddressPopupSnapshot): void {
      if (snapshot.phase !== "closing" || closeTimer !== undefined) {
        return;
      }
      closeTimer = view.setTimeout(() => {
        closeTimer = undefined;
        try {
          completeClose(snapshot);
        } catch (error) {
          onFatalError(error);
        }
      }, ADDRESS_POPUP_CLOSE_DELAY_MS);
    },
  });
}
