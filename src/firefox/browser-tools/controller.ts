// SPDX-License-Identifier: MPL-2.0
import {
  isBrowserToolAction,
  isPopupBrowserToolAction,
  type BrowserToolAction,
  type BrowserToolsBridge,
  type BrowserToolsPopupEvent,
  type BrowserToolsSnapshot,
  type PopupBrowserToolAction,
} from "../../app/browser-tools-state.ts";
import {
  type FirefoxBridgeBoundary,
  type FirefoxCapabilitySnapshot,
  type IdempotentDisposer,
} from "../bridge-boundary.ts";
import { createBrowserToolsPanelPlacement } from "./panel-placement.ts";
import { createBrowserToolsPopupActionInvoker } from "./popup-actions.ts";
import {
  LISTENER_OPTIONS,
  NATIVE_POPUP_PANEL_IDS,
  nativePopupPanelIdSet,
  popupPanelByAction,
  isNativeRecord,
  isFunction,
  isEventTarget,
  isPanelElement,
  getDocumentElementById,
  evaluateBrowserToolCapabilities,
  createBrowserToolsError,
  createSnapshot,
  isPanelOpen,
  getPopupFromEvent,
} from "./support.ts";
import type { NativeRecord, NativePanel, PopupHandoff } from "./support.ts";

export type FirefoxBrowserToolsBridgeController = Readonly<{
  assertRequiredCapabilities: () => readonly FirefoxCapabilitySnapshot[];
  browserTools: BrowserToolsBridge;
  dispose: () => boolean;
  snapshot: () => Readonly<{
    disposed: boolean;
    pendingActionCount: number;
  }>;
}>;

export function createFirefoxBrowserToolsBridge({
  beginNativePopupHandoff,
  boundary,
  endNativePopupHandoff,
  frame,
  requestNativeUiReveal,
  window,
}: Readonly<{
  beginNativePopupHandoff: (panelId: string) => boolean;
  boundary: FirefoxBridgeBoundary;
  endNativePopupHandoff: (panelId: string) => void;
  frame: unknown;
  requestNativeUiReveal: () => boolean;
  window: unknown;
}>): FirefoxBrowserToolsBridgeController {
  boundary.assertOwnsWindow(window);
  if (
    !isNativeRecord(window) ||
    !isNativeRecord(frame) ||
    typeof frame.contains !== "function" ||
    typeof requestNativeUiReveal !== "function" ||
    typeof beginNativePopupHandoff !== "function" ||
    typeof endNativePopupHandoff !== "function"
  ) {
    throw createBrowserToolsError(
      boundary,
      "FENNEVIA_FIREFOX_BROWSER_TOOLS_OPTIONS_INVALID",
      "firefox-browser-tools-create",
      "window",
    );
  }

  const frameContains = (node: unknown): boolean =>
    Reflect.apply(frame.contains as (...args: unknown[]) => unknown, frame, [
      node,
    ]) === true;

  let nativeWindow: NativeRecord | null = window;
  let disposed = false;
  let pendingActionCount = 0;
  let pendingHandoff: PopupHandoff | null = null;
  const openingPanelIds = new Set<string>();
  const listenerDisposers: IdempotentDisposer[] = [];
  const popupListeners = new Set<(event: BrowserToolsPopupEvent) => void>();
  const panelShownWaiters = new Set<{
    panelId: string;
    resolve: (opened: boolean) => void;
    timeoutHandle: unknown;
  }>();

  const requireWindow = (): NativeRecord => {
    if (disposed || !nativeWindow) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_DISPOSED",
        "firefox-browser-tools-access",
        "window",
      );
    }
    return nativeWindow;
  };

  const assertRequiredCapabilities =
    (): readonly FirefoxCapabilitySnapshot[] => {
      const evaluations = evaluateBrowserToolCapabilities(requireWindow());
      const missing = evaluations.find(
        (evaluation) =>
          evaluation.snapshot.requirement === "required" &&
          !evaluation.snapshot.available,
      );
      if (missing) {
        throw createBrowserToolsError(
          boundary,
          "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING",
          "firefox-browser-tools-capability",
          missing.snapshot.symbol,
          missing.cause,
        );
      }
      return Object.freeze(
        evaluations.map((evaluation) => evaluation.snapshot),
      );
    };

  const revealNativeToolbar = (): void => {
    let revealed: boolean;
    try {
      revealed = requestNativeUiReveal() === true;
    } catch (error) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_REVEAL_FAILED",
        "firefox-browser-tools-reveal",
        "nativeUi.revealForToolbar",
        error,
      );
    }
    if (!revealed) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_REVEAL_REJECTED",
        "firefox-browser-tools-reveal",
        "nativeUi.revealForToolbar",
      );
    }
  };

  const invokeMethod = async (
    owner: NativeRecord,
    methodName: string,
    symbol: string,
    args: readonly unknown[] = [],
  ): Promise<void> => {
    const method = owner[methodName];
    if (!isFunction(method)) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING",
        "firefox-browser-tools-action",
        symbol,
      );
    }
    try {
      await Reflect.apply(method, owner, args);
    } catch (error) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED",
        "firefox-browser-tools-action",
        symbol,
        error,
      );
    }
  };

  const requireProjectHost = (host: unknown): NativeRecord => {
    const ownerWindow = requireWindow();
    if (
      !isNativeRecord(host) ||
      !isFunction(host.getBoundingClientRect) ||
      host.ownerDocument !== ownerWindow.document ||
      frameContains(host) !== true
    ) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_HOST_INVALID",
        "firefox-browser-tools-action",
        "browser-tools.host",
      );
    }
    return host;
  };

  const resolveTranslationTriggerEvent = (
    candidate: unknown,
    host: NativeRecord,
  ): NativeRecord => {
    if (
      isNativeRecord(candidate) &&
      isFunction(candidate.stopPropagation) &&
      (candidate.type === "click" || candidate.type === "keypress")
    ) {
      return candidate;
    }
    const ownerWindow = requireWindow();
    const MouseEvent = ownerWindow.MouseEvent;
    if (isFunction(MouseEvent)) {
      try {
        const event = Reflect.construct(MouseEvent, [
          "click",
          Object.freeze({ bubbles: true, button: 0 }),
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
    });
  };

  const panelPlacement = createBrowserToolsPanelPlacement({
    boundary,
    requireWindow,
  });

  const beginHandoff = (panelId: string): void => {
    let accepted: boolean;
    try {
      accepted = beginNativePopupHandoff(panelId) === true;
    } catch (error) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_HANDOFF_FAILED",
        "firefox-browser-tools-handoff",
        "nativeUi.beginPopupHandoff",
        error,
      );
    }
    if (!accepted) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_HANDOFF_REJECTED",
        "firefox-browser-tools-handoff",
        "nativeUi.beginPopupHandoff",
      );
    }
  };

  const endHandoff = (panelId: string): void => {
    try {
      endNativePopupHandoff(panelId);
    } catch {
      // Popup hide still proceeds; dispose records the first causal error.
    }
  };

  const flushAfterPopupHide = async (): Promise<void> => {
    const ownerWindow = requireWindow();
    const flushed = ownerWindow.promiseDocumentFlushed;
    if (isFunction(flushed)) {
      try {
        await Reflect.apply(flushed, ownerWindow, [() => undefined]);
        return;
      } catch {
        // Fall through to one event-loop turn.
      }
    }
    await Promise.resolve();
  };

  const waitForPanelShown = (
    panelId: string,
    timeoutMs = 800,
  ): Promise<boolean> => {
    const ownerWindow = requireWindow();
    const existing = getDocumentElementById(ownerWindow, panelId);
    if (isPanelElement(existing) && isPanelOpen(existing)) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      let settled = false;
      const finish = (opened: boolean) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(opened);
      };
      const waiter = {
        panelId,
        resolve: finish,
        timeoutHandle: undefined as unknown,
      };
      const setTimeoutFn = ownerWindow.setTimeout;
      if (isFunction(setTimeoutFn)) {
        waiter.timeoutHandle = Reflect.apply(setTimeoutFn, ownerWindow, [
          () => {
            panelShownWaiters.delete(waiter);
            const panel = getDocumentElementById(ownerWindow, panelId);
            finish(isPanelElement(panel) && isPanelOpen(panel));
          },
          timeoutMs,
        ]);
      } else {
        queueMicrotask(() => {
          panelShownWaiters.delete(waiter);
          const panel = getDocumentElementById(ownerWindow, panelId);
          finish(isPanelElement(panel) && isPanelOpen(panel));
        });
      }
      panelShownWaiters.add(waiter);
    });
  };

  const resolveShownWaiters = (panelId: string, opened: boolean): void => {
    const ownerWindow = nativeWindow;
    for (const waiter of Array.from(panelShownWaiters)) {
      if (waiter.panelId !== panelId) {
        continue;
      }
      panelShownWaiters.delete(waiter);
      if (ownerWindow && isFunction(ownerWindow.clearTimeout)) {
        try {
          Reflect.apply(ownerWindow.clearTimeout, ownerWindow, [
            waiter.timeoutHandle,
          ]);
        } catch {
          // The waiter still settles.
        }
      }
      waiter.resolve(opened);
    }
  };

  const preparePopupAction = async (
    action: PopupBrowserToolAction,
    host: unknown,
  ): Promise<PopupHandoff> => {
    const resolvedHost = requireProjectHost(host);
    const panelId = popupPanelByAction[action][0];
    const position = panelPlacement.resolvePopupPosition(resolvedHost, action);
    panelPlacement.hideOtherPanels(new Set(popupPanelByAction[action]));
    await flushAfterPopupHide();
    for (const id of popupPanelByAction[action]) {
      beginHandoff(id);
    }
    pendingHandoff = Object.freeze({
      host: resolvedHost,
      panelId,
      position,
    });
    return pendingHandoff;
  };

  const clearPermissionAnchor = (): void => {
    const ownerWindow = nativeWindow;
    if (!ownerWindow || !isNativeRecord(ownerWindow.gPermissionPanel)) {
      return;
    }
    const setAnchor = ownerWindow.gPermissionPanel.setAnchor;
    if (!isFunction(setAnchor)) {
      return;
    }
    try {
      Reflect.apply(setAnchor, ownerWindow.gPermissionPanel, [
        null,
        "bottomleft topleft",
      ]);
    } catch {
      // Disposal and popuphidden still complete.
    }
  };

  const publishPopup = (open: boolean): void => {
    const event = Object.freeze({
      open,
      type: "native-popup" as const,
    });
    for (const listener of Array.from(popupListeners)) {
      listener(event);
    }
  };

  const onPopupEvent = (event: unknown): void => {
    if (disposed) {
      return;
    }
    const popup = getPopupFromEvent(event);
    const panelId =
      typeof popup?.id === "string"
        ? popup.id
        : typeof popup?.getAttribute === "function"
          ? popup.getAttribute("id")
          : undefined;
    if (typeof panelId !== "string" || !nativePopupPanelIdSet.has(panelId)) {
      return;
    }
    const eventType = isNativeRecord(event) ? event.type : undefined;
    if (eventType === "popupshown") {
      resolveShownWaiters(panelId, true);
      for (const id of NATIVE_POPUP_PANEL_IDS) {
        if (id !== panelId) {
          endHandoff(id);
        }
      }
      if (
        pendingHandoff &&
        isPanelElement(popup) &&
        popup.anchorNode !== pendingHandoff.host
      ) {
        try {
          panelPlacement.placePanelBesideHost(
            popup,
            pendingHandoff.host,
            pendingHandoff.position,
            `document.${panelId}.moveToAnchor`,
          );
        } catch {
          // The open panel remains Firefox-owned; the next action re-resolves.
        }
      }
      publishPopup(true);
      return;
    }
    if (eventType === "popuphidden") {
      if (openingPanelIds.has(panelId)) {
        return;
      }
      pendingHandoff = null;
      if (panelId === "permission-popup") {
        clearPermissionAnchor();
      }
      endHandoff(panelId);
      publishPopup(false);
    }
  };

  const closeOpenPanel = (
    action: PopupBrowserToolAction,
    panel: NativePanel,
    symbol: string,
  ): void => {
    panelPlacement.hidePanel(panel, symbol);
    pendingHandoff = null;
    for (const id of popupPanelByAction[action]) {
      endHandoff(id);
    }
    publishPopup(false);
  };

  const popupActionInvoker = createBrowserToolsPopupActionInvoker({
    beginHandoff,
    boundary,
    closeOpenPanel,
    invokeMethod,
    panelPlacement,
    resolveTranslationTriggerEvent,
    waitForPanelShown,
  });

  const invokePopupAction = async (
    action: PopupBrowserToolAction,
    host: unknown,
    triggerEvent?: unknown,
  ): Promise<boolean> => {
    const ownerWindow = requireWindow();
    const handoff = await preparePopupAction(action, host);
    for (const id of popupPanelByAction[action]) {
      openingPanelIds.add(id);
    }
    try {
      return await popupActionInvoker.invoke(
        action,
        ownerWindow,
        handoff,
        triggerEvent,
      );
    } finally {
      for (const id of popupPanelByAction[action]) {
        openingPanelIds.delete(id);
      }
    }
  };

  const invoke = async (
    action: BrowserToolAction,
    host?: unknown,
    triggerEvent?: unknown,
  ): Promise<boolean> => {
    if (!isBrowserToolAction(action)) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID",
        "firefox-browser-tools-action",
        "browser-tools.action",
      );
    }
    const ownerWindow = requireWindow();
    pendingActionCount += 1;
    try {
      if (isPopupBrowserToolAction(action)) {
        return await invokePopupAction(action, host, triggerEvent);
      }

      switch (action) {
        case "settings": {
          await invokeMethod(
            ownerWindow,
            "openPreferences",
            "window.openPreferences",
          );
          return true;
        }

        case "customize": {
          if (!isNativeRecord(ownerWindow.gCustomizeMode)) {
            throw createBrowserToolsError(
              boundary,
              "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING",
              "firefox-browser-tools-action",
              "window.gCustomizeMode.enter",
            );
          }
          await invokeMethod(
            ownerWindow.gCustomizeMode,
            "enter",
            "window.gCustomizeMode.enter",
          );
          return true;
        }

        case "native-toolbar": {
          revealNativeToolbar();
          const focusTarget = getDocumentElementById(
            ownerWindow,
            "back-button",
          );
          if (!isNativeRecord(focusTarget) || !isFunction(focusTarget.focus)) {
            throw createBrowserToolsError(
              boundary,
              "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING",
              "firefox-browser-tools-action",
              "document.back-button.focus",
            );
          }
          try {
            Reflect.apply(focusTarget.focus, focusTarget, [
              Object.freeze({ preventScroll: true }),
            ]);
          } catch (error) {
            throw createBrowserToolsError(
              boundary,
              "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED",
              "firefox-browser-tools-action",
              "document.back-button.focus",
              error,
            );
          }
          return true;
        }
      }
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID",
        "firefox-browser-tools-action",
        "browser-tools.action",
      );
    } finally {
      pendingActionCount -= 1;
    }
  };

  const publicBridge: BrowserToolsBridge = Object.freeze({
    invoke,
    snapshot(): BrowserToolsSnapshot {
      return createSnapshot(evaluateBrowserToolCapabilities(requireWindow()));
    },
    subscribe(
      listener: (event: BrowserToolsPopupEvent) => void,
    ): () => boolean {
      requireWindow();
      if (typeof listener !== "function") {
        throw createBrowserToolsError(
          boundary,
          "FENNEVIA_FIREFOX_BROWSER_TOOLS_LISTENER_INVALID",
          "firefox-browser-tools-subscribe",
          "browser-tools.subscribe",
        );
      }
      popupListeners.add(listener);
      let subscribed = true;
      return Object.freeze(() => {
        if (!subscribed) {
          return false;
        }
        subscribed = false;
        popupListeners.delete(listener);
        return true;
      });
    },
  });

  try {
    boundary.assertRequiredCapabilities();
    assertRequiredCapabilities();
    const document = requireWindow().document;
    if (!isEventTarget(document)) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING",
        "firefox-browser-tools-capability",
        "document.addEventListener.removeEventListener",
      );
    }
    listenerDisposers.push(
      boundary.subscribe(
        document,
        "popupshown",
        onPopupEvent,
        LISTENER_OPTIONS,
      ),
      boundary.subscribe(
        document,
        "popuphidden",
        onPopupEvent,
        LISTENER_OPTIONS,
      ),
    );
  } catch (error) {
    disposed = true;
    nativeWindow = null;
    for (const disposeListener of listenerDisposers.reverse()) {
      try {
        disposeListener();
      } catch {
        // The creation error remains causal.
      }
    }
    throw error;
  }

  return Object.freeze({
    assertRequiredCapabilities,
    browserTools: publicBridge,

    dispose(): boolean {
      if (disposed) {
        return false;
      }
      disposed = true;
      const ownerWindow = nativeWindow;
      pendingHandoff = null;
      popupListeners.clear();
      for (const waiter of Array.from(panelShownWaiters)) {
        panelShownWaiters.delete(waiter);
        waiter.resolve(false);
      }
      if (ownerWindow) {
        for (const panelId of NATIVE_POPUP_PANEL_IDS) {
          const panel = getDocumentElementById(ownerWindow, panelId);
          if (isPanelElement(panel) && isPanelOpen(panel)) {
            try {
              Reflect.apply(panel.hidePopup, panel, []);
            } catch {
              // Disposal still releases listeners and the window reference.
            }
          }
          endHandoff(panelId);
        }
        clearPermissionAnchor();
      }
      nativeWindow = null;
      for (const disposeListener of listenerDisposers.reverse()) {
        try {
          disposeListener();
        } catch {
          // Disposal remains idempotent.
        }
      }
      listenerDisposers.length = 0;
      return true;
    },

    snapshot() {
      return Object.freeze({ disposed, pendingActionCount });
    },
  });
}
