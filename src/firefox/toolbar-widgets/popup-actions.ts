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
  isMenuPopupElement,
  isNativeRecord,
  isNodeConnected,
  isPanelElement,
  readCustomizableUi,
  readAttribute,
  readShowSubView,
  querySelectorOn,
  type NativeMenuPopup,
  type NativeNode,
  type NativePanel,
  type NativeRecord,
  type PendingPanelWaiter,
} from "./support.ts";

type ToolbarWidgetRegistry = Readonly<{
  resolve: (handle: string) => object;
}>;

const ACCOUNT_WIDGET_ID = "fxa-toolbar-menu-button";
const ACCOUNT_VIEW_ID = "PanelUI-fxa";
const ALL_TABS_WIDGET_ID = "alltabs-button";
const ALL_TABS_ENTRYPOINT = "alltabs-button";
const LIBRARY_WIDGET_ID = "library-button";
const LIBRARY_VIEW_ID = "appMenu-libraryView";

export type ToolbarWidgetPopupActions = Readonly<{
  dispose: () => void;
  invoke: (
    handle: string,
    host: unknown,
    triggerEvent?: unknown,
  ) => Promise<boolean>;
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
    anchor: NativeRecord;
    handle: string;
    host: NativeRecord;
    reanchor: boolean;
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
      if (nodeContains(pendingNodeInvoke.anchor, anchor)) {
        const { handle, host, reanchor } = pendingNodeInvoke;
        if (reanchor) {
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
    anchor: NativeRecord,
    reanchor = true,
  ): Promise<boolean> => {
    const ownerWindow = requireWindow();
    clearPendingNodeInvoke(false);
    return new Promise((resolve) => {
      const invokeRecord = {
        anchor,
        handle,
        host,
        reanchor,
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

  const clearProjectHostOpenState = (host: NativeRecord): void => {
    try {
      if (host.open === true) {
        host.open = false;
      }
    } catch {
      // The Firefox owner revalidates the host and reports any failed open.
    }
  };

  const resolveTriggerEvent = (
    candidate: unknown,
    host: NativeRecord,
  ): NativeRecord => {
    if (
      isNativeRecord(candidate) &&
      isFunction(candidate.stopPropagation) &&
      (candidate.type === "click" ||
        candidate.type === "keypress" ||
        candidate.type === "mousedown")
    ) {
      return candidate;
    }
    const ownerWindow = requireWindow();
    const MouseEventConstructor = ownerWindow.MouseEvent;
    if (isFunction(MouseEventConstructor)) {
      try {
        const event = Reflect.construct(MouseEventConstructor, [
          "click",
          Object.freeze({
            bubbles: true,
            button: 0,
            cancelable: true,
            view: ownerWindow,
          }),
        ]);
        if (isNativeRecord(event) && isFunction(event.stopPropagation)) {
          return event;
        }
      } catch {
        // The bounded event-shaped fallback below still uses the native owner.
      }
    }
    return Object.freeze({
      button: 0,
      stopPropagation() {},
      target: host,
      type: "click",
      view: ownerWindow,
    });
  };

  const showWidgetView = async (
    handle: string,
    host: NativeRecord,
    viewId: string,
    triggerEvent: NativeRecord,
    symbol = "window.PanelUI.showSubView",
  ): Promise<boolean> => {
    const ownerWindow = requireWindow();
    const showSubView = readShowSubView(ownerWindow);
    if (!showSubView || !isNativeRecord(ownerWindow.PanelUI)) {
      throw createToolbarWidgetsError(
        boundary,
        "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_CAPABILITY_MISSING",
        "firefox-toolbar-widgets-action",
        symbol,
      );
    }
    const shown = waitForViewPanel(handle);
    try {
      const result = Reflect.apply(showSubView, ownerWindow.PanelUI, [
        viewId,
        host,
        triggerEvent,
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
        symbol,
        error,
      );
    }
    return await shown;
  };

  const readOwnedMenuPopup = (node: NativeNode): NativeMenuPopup | null => {
    if (readAttribute(node, "type") !== "menu") {
      return null;
    }
    const popup = querySelectorOn(node, "menupopup");
    return isMenuPopupElement(popup) ? popup : null;
  };

  const openOwnedMenu = async (
    handle: string,
    host: NativeRecord,
    popup: NativeMenuPopup,
    triggerEvent: NativeRecord,
  ): Promise<boolean> => {
    const shown = waitForNodePanel(handle, host, host, false);
    try {
      Reflect.apply(popup.openPopup, popup, [
        host,
        Object.freeze({
          position: ADOPTED_PANEL_POSITION,
          triggerEvent,
        }),
      ]);
    } catch (error) {
      clearPendingNodeInvoke(false);
      throw createToolbarWidgetsError(
        boundary,
        "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED",
        "firefox-toolbar-widgets-action",
        "XULPopupElement.openPopup",
        error,
      );
    }
    return await shown;
  };

  const openAccountView = async (
    handle: string,
    host: NativeRecord,
    node: NativeRecord,
    triggerEvent: NativeRecord,
  ): Promise<boolean> => {
    const ownerWindow = requireWindow();
    const syncOwner = ownerWindow.gSync;
    const panelUi = ownerWindow.PanelUI;
    const originalShowSubView = readShowSubView(ownerWindow);
    if (
      !isNativeRecord(syncOwner) ||
      !isFunction(syncOwner.toggleAccountPanel) ||
      !isNativeRecord(panelUi) ||
      !originalShowSubView
    ) {
      throw createToolbarWidgetsError(
        boundary,
        "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_CAPABILITY_MISSING",
        "firefox-toolbar-widgets-action",
        "window.gSync.toggleAccountPanel.PanelUI.showSubView",
      );
    }
    const routedShowSubView = (...args: unknown[]): unknown => {
      const routedArgs = [...args];
      if (routedArgs[0] === ACCOUNT_VIEW_ID && routedArgs[1] === node) {
        routedArgs[1] = host;
      }
      return Reflect.apply(originalShowSubView, panelUi, routedArgs);
    };
    try {
      panelUi.showSubView = routedShowSubView;
    } catch (error) {
      throw createToolbarWidgetsError(
        boundary,
        "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED",
        "firefox-toolbar-widgets-action",
        "window.PanelUI.showSubView.route-account-anchor",
        error,
      );
    }
    const shown = waitForViewPanel(handle);
    try {
      const result = Reflect.apply(syncOwner.toggleAccountPanel, syncOwner, [
        node,
        triggerEvent,
      ]);
      await Promise.resolve(result);
    } catch (error) {
      clearPendingViewWaiter(false);
      pendingViewHandle = "";
      if (isFirefoxBridgeError(error)) {
        throw error;
      }
      throw createToolbarWidgetsError(
        boundary,
        "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED",
        "firefox-toolbar-widgets-action",
        "window.gSync.toggleAccountPanel",
        error,
      );
    } finally {
      if (panelUi.showSubView === routedShowSubView) {
        panelUi.showSubView = originalShowSubView;
      }
    }
    return await shown;
  };

  const openAllTabsView = async (
    handle: string,
    host: NativeRecord,
    triggerEvent: NativeRecord,
  ): Promise<boolean> => {
    const ownerWindow = requireWindow();
    const tabsOwner = ownerWindow.gTabsPanel;
    if (
      !isNativeRecord(tabsOwner) ||
      !isFunction(tabsOwner.init) ||
      !isFunction(tabsOwner.showAllTabsPanel)
    ) {
      throw createToolbarWidgetsError(
        boundary,
        "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_CAPABILITY_MISSING",
        "firefox-toolbar-widgets-action",
        "window.gTabsPanel.init.showAllTabsPanel",
      );
    }
    let originalAnchor: unknown;
    try {
      Reflect.apply(tabsOwner.init, tabsOwner, []);
      originalAnchor = tabsOwner.allTabsButton;
      tabsOwner.allTabsButton = host;
    } catch (error) {
      throw createToolbarWidgetsError(
        boundary,
        "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED",
        "firefox-toolbar-widgets-action",
        "window.gTabsPanel.init.allTabsButton",
        error,
      );
    }
    const shown = waitForViewPanel(handle);
    try {
      Reflect.apply(tabsOwner.showAllTabsPanel, tabsOwner, [
        triggerEvent,
        ALL_TABS_ENTRYPOINT,
      ]);
    } catch (error) {
      clearPendingViewWaiter(false);
      pendingViewHandle = "";
      throw createToolbarWidgetsError(
        boundary,
        "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED",
        "firefox-toolbar-widgets-action",
        "window.gTabsPanel.showAllTabsPanel",
        error,
      );
    } finally {
      tabsOwner.allTabsButton = originalAnchor;
    }
    return await shown;
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
      const parent = node.parentElement;
      const parentId =
        isNativeRecord(parent) && typeof parent.id === "string"
          ? parent.id
          : "";
      if (parentId && widgetId === `${parentId}-dropmarker`) {
        const parentWrapper = Reflect.apply(
          customizableUi.getWidget as (...args: unknown[]) => unknown,
          customizableUi,
          [parentId],
        );
        if (
          isNativeRecord(parentWrapper) &&
          parentWrapper.type === "button-and-view" &&
          typeof parentWrapper.viewId === "string"
        ) {
          return parentWrapper.viewId;
        }
      }
    } catch {
      return "";
    }
    return "";
  };

  const invoke = async (
    handle: string,
    host: unknown,
    triggerEvent?: unknown,
  ): Promise<boolean> => {
    if (typeof handle !== "string" || handle === "") {
      throw createToolbarWidgetsError(
        boundary,
        "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HANDLE_INVALID",
        "firefox-toolbar-widgets-action",
        "toolbar-widgets.handle",
      );
    }
    const resolvedHost = requireProjectHost(host);
    const node = registry.resolve(handle) as NativeNode;
    if (!isNodeConnected(node)) {
      throw createToolbarWidgetsError(
        boundary,
        "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HANDLE_STALE",
        "firefox-toolbar-widgets-action",
        "toolbar-widgets.native-node",
      );
    }
    const resolvedTriggerEvent = resolveTriggerEvent(
      triggerEvent,
      resolvedHost,
    );

    onActionDelta(1);
    try {
      // Toggle: activating the widget whose popup is already open closes it.
      if (heldPanel && heldPanelHandle === handle) {
        hideHeldPanel();
        return true;
      }
      hideHeldPanel();
      clearProjectHostOpenState(resolvedHost);

      const widgetId = typeof node.id === "string" ? node.id : "";
      if (widgetId === ACCOUNT_WIDGET_ID) {
        return await openAccountView(
          handle,
          resolvedHost,
          node,
          resolvedTriggerEvent,
        );
      }
      if (widgetId === LIBRARY_WIDGET_ID) {
        return await showWidgetView(
          handle,
          resolvedHost,
          LIBRARY_VIEW_ID,
          resolvedTriggerEvent,
        );
      }
      if (widgetId === ALL_TABS_WIDGET_ID) {
        return await openAllTabsView(
          handle,
          resolvedHost,
          resolvedTriggerEvent,
        );
      }

      const viewId = readWidgetViewId(node);
      if (viewId) {
        return await showWidgetView(
          handle,
          resolvedHost,
          viewId,
          resolvedTriggerEvent,
        );
      }

      const menuPopup = readOwnedMenuPopup(node);
      if (menuPopup) {
        return await openOwnedMenu(
          handle,
          resolvedHost,
          menuPopup,
          resolvedTriggerEvent,
        );
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
