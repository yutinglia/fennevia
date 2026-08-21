// SPDX-License-Identifier: MPL-2.0
import type { ToolbarWidgetsPopupEvent } from "../../app/toolbar-widgets-state.ts";
import {
  isFirefoxBridgeError,
  type FirefoxBridgeBoundary,
} from "../bridge-boundary.ts";
import {
  ADOPTED_PANEL_POSITION,
  PANEL_SHOWN_TIMEOUT_MS,
  WIDGET_VIEW_PANEL_ID,
  createToolbarWidgetsError,
  isFunction,
  isNativeRecord,
  isNodeConnected,
  isPanelElement,
  readCustomizableUi,
  readShowSubView,
  type NativePanel,
  type NativeRecord,
  type PendingPanelWaiter,
} from "./support.ts";

type ToolbarWidgetRegistry = Readonly<{
  resolve: (handle: string) => object;
}>;

export type ToolbarWidgetPopupActions = Readonly<{
  dispose: () => void;
  invoke: (handle: string, host: unknown) => Promise<boolean>;
  onPopupHidden: (event: unknown) => void;
  onPopupShown: (event: unknown) => void;
}>;

export function createToolbarWidgetPopupActions({
  boundary,
  getWindowOrNull,
  isDisposed,
  onActionDelta,
  popupListeners,
  registry,
  requireProjectHost,
  requireWindow,
}: Readonly<{
  boundary: FirefoxBridgeBoundary;
  getWindowOrNull: () => NativeRecord | null;
  isDisposed: () => boolean;
  onActionDelta: (delta: 1 | -1) => void;
  popupListeners: Set<(event: ToolbarWidgetsPopupEvent) => void>;
  registry: ToolbarWidgetRegistry;
  requireProjectHost: (host: unknown) => NativeRecord;
  requireWindow: () => NativeRecord;
}>): ToolbarWidgetPopupActions {
  let heldPanel: NativePanel | null = null;
  let heldPanelHandle = "";
  let pendingViewWaiter: PendingPanelWaiter | null = null;
  let pendingViewHandle = "";
  let pendingNodeInvoke: Readonly<{
    handle: string;
    host: NativeRecord;
    node: NativeRecord;
    resolve: (opened: boolean) => void;
    timeoutHandle: unknown;
  }> | null = null;

  const publishPopup = (open: boolean): void => {
    const event: ToolbarWidgetsPopupEvent = Object.freeze({
      open,
      type: "widget-popup" as const,
    });
    for (const listener of Array.from(popupListeners)) {
      listener(event);
    }
  };

  const clearPendingViewWaiter = (opened: boolean): void => {
    const waiter = pendingViewWaiter;
    if (!waiter) {
      return;
    }
    pendingViewWaiter = null;
    const ownerWindow = getWindowOrNull();
    if (ownerWindow && isFunction(ownerWindow.clearTimeout)) {
      try {
        Reflect.apply(ownerWindow.clearTimeout, ownerWindow, [
          waiter.timeoutHandle,
        ]);
      } catch {
        // The waiter still settles below.
      }
    }
    waiter.resolve(opened);
  };

  const clearPendingNodeInvoke = (opened: boolean): void => {
    const pending = pendingNodeInvoke;
    if (!pending) {
      return;
    }
    pendingNodeInvoke = null;
    const ownerWindow = getWindowOrNull();
    if (
      pending.timeoutHandle !== undefined &&
      ownerWindow &&
      isFunction(ownerWindow.clearTimeout)
    ) {
      try {
        Reflect.apply(ownerWindow.clearTimeout, ownerWindow, [
          pending.timeoutHandle,
        ]);
      } catch {
        // The waiter still settles below.
      }
    }
    pending.resolve(opened);
  };

  const adoptPanel = (panel: NativePanel, handle: string): void => {
    heldPanel = panel;
    heldPanelHandle = handle;
    publishPopup(true);
  };

  const releaseHeldPanel = (): void => {
    if (!heldPanel) {
      return;
    }
    heldPanel = null;
    heldPanelHandle = "";
    publishPopup(false);
  };

  const getPopupFromEvent = (event: unknown): NativeRecord | null => {
    if (!isNativeRecord(event)) {
      return null;
    }
    if (isNativeRecord(event.originalTarget)) {
      return event.originalTarget;
    }
    return isNativeRecord(event.target) ? event.target : null;
  };

  const nodeContains = (node: NativeRecord, candidate: unknown): boolean => {
    if (candidate === node) {
      return true;
    }
    if (!isFunction(node.contains)) {
      return false;
    }
    try {
      return Reflect.apply(node.contains, node, [candidate]) === true;
    } catch {
      return false;
    }
  };

  const onPopupShown = (event: unknown): void => {
    if (isDisposed()) {
      return;
    }
    const popup = getPopupFromEvent(event);
    if (!popup || !isPanelElement(popup)) {
      return;
    }
    const popupId = typeof popup.id === "string" ? popup.id : "";

    if (pendingViewWaiter && popupId === WIDGET_VIEW_PANEL_ID) {
      const handle = pendingViewHandle;
      clearPendingViewWaiter(true);
      pendingViewHandle = "";
      adoptPanel(popup, handle);
      return;
    }

    if (pendingNodeInvoke) {
      const anchor = popup.anchorNode;
      if (nodeContains(pendingNodeInvoke.node, anchor)) {
        const { handle, host } = pendingNodeInvoke;
        try {
          Reflect.apply(popup.moveToAnchor, popup, [
            host,
            ADOPTED_PANEL_POSITION,
            0,
            0,
          ]);
        } catch {
          // The panel stays Firefox-owned at its original geometry.
        }
        adoptPanel(popup, handle);
        clearPendingNodeInvoke(true);
      }
    }
  };

  const onPopupHidden = (event: unknown): void => {
    if (isDisposed()) {
      return;
    }
    const popup = getPopupFromEvent(event);
    if (!popup) {
      return;
    }
    if (heldPanel && popup === heldPanel) {
      releaseHeldPanel();
      return;
    }
    const popupId = typeof popup.id === "string" ? popup.id : "";
    if (pendingViewWaiter && popupId === WIDGET_VIEW_PANEL_ID) {
      // A failed open removes the transient panel before it is shown.
      clearPendingViewWaiter(false);
      pendingViewHandle = "";
    }
  };

  const waitForViewPanel = (handle: string): Promise<boolean> => {
    const ownerWindow = requireWindow();
    clearPendingViewWaiter(false);
    return new Promise((resolve) => {
      const waiter: PendingPanelWaiter = {
        resolve,
        timeoutHandle: undefined,
      };
      pendingViewWaiter = waiter;
      pendingViewHandle = handle;
      const finishTimeout = (): void => {
        if (pendingViewWaiter !== waiter) {
          return;
        }
        pendingViewWaiter = null;
        pendingViewHandle = "";
        resolve(false);
      };
      const setTimeoutFn = ownerWindow.setTimeout;
      if (isFunction(setTimeoutFn)) {
        waiter.timeoutHandle = Reflect.apply(setTimeoutFn, ownerWindow, [
          finishTimeout,
          PANEL_SHOWN_TIMEOUT_MS,
        ]);
      } else {
        queueMicrotask(finishTimeout);
      }
    });
  };

  const waitForNodePanel = (
    handle: string,
    host: NativeRecord,
    node: NativeRecord,
  ): Promise<boolean> => {
    const ownerWindow = requireWindow();
    clearPendingNodeInvoke(false);
    return new Promise((resolve) => {
      const invokeRecord = {
        handle,
        host,
        node,
        resolve,
        timeoutHandle: undefined as unknown,
      };
      pendingNodeInvoke = invokeRecord;
      const finishTimeout = (): void => {
        if (pendingNodeInvoke !== invokeRecord) {
          return;
        }
        pendingNodeInvoke = null;
        resolve(false);
      };
      const setTimeoutFn = ownerWindow.setTimeout;
      if (isFunction(setTimeoutFn)) {
        invokeRecord.timeoutHandle = Reflect.apply(setTimeoutFn, ownerWindow, [
          finishTimeout,
          PANEL_SHOWN_TIMEOUT_MS,
        ]);
      } else {
        queueMicrotask(finishTimeout);
      }
    });
  };

  const hideHeldPanel = (): void => {
    const panel = heldPanel;
    if (!panel) {
      return;
    }
    try {
      Reflect.apply(panel.hidePopup, panel, []);
    } catch {
      releaseHeldPanel();
    }
  };

  const activateNode = (node: NativeRecord): void => {
    if (isFunction(node.doCommand)) {
      try {
        Reflect.apply(node.doCommand, node, []);
        return;
      } catch {
        // Fall through to the synthetic command event.
      }
    }
    const ownerWindow = requireWindow();
    const CustomEventConstructor = ownerWindow.CustomEvent;
    if (
      !isFunction(CustomEventConstructor) ||
      !isFunction(node.dispatchEvent)
    ) {
      throw createToolbarWidgetsError(
        boundary,
        "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_CAPABILITY_MISSING",
        "firefox-toolbar-widgets-action",
        "toolbar-widgets.node-command",
      );
    }
    const commandEvent = Reflect.construct(CustomEventConstructor, [
      "command",
      Object.freeze({ bubbles: true, cancelable: true }),
    ]);
    Reflect.apply(node.dispatchEvent, node, [commandEvent]);
  };

  const readWidgetViewId = (node: NativeRecord): string => {
    const ownerWindow = requireWindow();
    const customizableUi = readCustomizableUi(ownerWindow);
    const widgetId = typeof node.id === "string" ? node.id : "";
    if (!customizableUi || !widgetId) {
      return "";
    }
    try {
      const wrapper = Reflect.apply(
        customizableUi.getWidget as (...args: unknown[]) => unknown,
        customizableUi,
        [widgetId],
      );
      if (isNativeRecord(wrapper) && typeof wrapper.viewId === "string") {
        return wrapper.viewId;
      }
    } catch {
      return "";
    }
    return "";
  };

  const invoke = async (handle: string, host: unknown): Promise<boolean> => {
    if (typeof handle !== "string" || handle === "") {
      throw createToolbarWidgetsError(
        boundary,
        "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HANDLE_INVALID",
        "firefox-toolbar-widgets-action",
        "toolbar-widgets.handle",
      );
    }
    const resolvedHost = requireProjectHost(host);
    const node = registry.resolve(handle) as NativeRecord;
    if (!isNodeConnected(node)) {
      throw createToolbarWidgetsError(
        boundary,
        "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HANDLE_STALE",
        "firefox-toolbar-widgets-action",
        "toolbar-widgets.native-node",
      );
    }

    onActionDelta(1);
    try {
      // Toggle: activating the widget whose popup is already open closes it.
      if (heldPanel && heldPanelHandle === handle) {
        hideHeldPanel();
        return true;
      }
      hideHeldPanel();

      const ownerWindow = requireWindow();
      const viewId = readWidgetViewId(node);
      const showSubView = readShowSubView(ownerWindow);
      if (viewId && showSubView) {
        // A stale `open` expando left by a failed open blocks showSubView.
        try {
          if (resolvedHost.open === true) {
            resolvedHost.open = false;
          }
        } catch {
          // showSubView revalidates the anchor itself.
        }
        const shown = waitForViewPanel(handle);
        try {
          const result = Reflect.apply(showSubView, ownerWindow.PanelUI, [
            viewId,
            resolvedHost,
          ]);
          void Promise.resolve(result).catch(() => {
            // Open failures settle through the popup listeners or timeout.
          });
        } catch (error) {
          clearPendingViewWaiter(false);
          pendingViewHandle = "";
          throw createToolbarWidgetsError(
            boundary,
            "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED",
            "firefox-toolbar-widgets-action",
            "window.PanelUI.showSubView",
            error,
          );
        }
        return await shown;
      }

      const settled = waitForNodePanel(handle, resolvedHost, node);
      try {
        activateNode(node);
      } catch (error) {
        clearPendingNodeInvoke(false);
        if (isFirefoxBridgeError(error)) {
          throw error;
        }
        throw createToolbarWidgetsError(
          boundary,
          "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED",
          "firefox-toolbar-widgets-action",
          "toolbar-widgets.node-command",
          error,
        );
      }
      return await settled;
    } finally {
      onActionDelta(-1);
    }
  };

  return Object.freeze({
    dispose(): void {
      const panelToHide = heldPanel;
      clearPendingViewWaiter(false);
      pendingViewHandle = "";
      clearPendingNodeInvoke(false);
      heldPanel = null;
      heldPanelHandle = "";
      if (panelToHide) {
        try {
          Reflect.apply(panelToHide.hidePopup, panelToHide, []);
        } catch {
          // Disposal still releases listeners and the window reference.
        }
      }
    },
    invoke,
    onPopupHidden,
    onPopupShown,
  });
}
