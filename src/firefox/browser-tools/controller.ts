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
  isFirefoxBridgeError,
  type FirefoxBridgeBoundary,
  type FirefoxCapabilitySnapshot,
  type IdempotentDisposer,
} from "../bridge-boundary.ts";
import {
  LISTENER_OPTIONS,
  NATIVE_POPUP_PANEL_IDS,
  nativePopupPanelIdSet,
  popupPanelByAction,
  popupPositionByAction,
  isScreenPlacedPopupPosition,
  isNativeRecord,
  isFunction,
  readPanelMultiViewOwner,
  isEventTarget,
  isPanelElement,
  readFiniteNumber,
  readHostViewportRect,
  readWindowScreenOrigin,
  getDocumentElementById,
  evaluateBrowserToolCapabilities,
  createBrowserToolsError,
  createSnapshot,
  isPanelOpen,
  getPopupFromEvent,
} from "./support.ts";
import type { NativeRecord, NativePanel, PopupHandoff } from "./support.ts";

const TRANSLATIONS_PANEL_OPEN_TIMEOUT_MS = 10_000;

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

  const findOpenPanel = (panelIds: readonly string[]): NativePanel | null => {
    const ownerWindow = requireWindow();
    for (const panelId of panelIds) {
      const panel = getDocumentElementById(ownerWindow, panelId);
      if (isPanelElement(panel) && isPanelOpen(panel)) {
        return panel;
      }
    }
    return null;
  };

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

  const hidePanel = (panel: NativePanel, symbol: string): void => {
    try {
      Reflect.apply(panel.hidePopup, panel, []);
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

  const openPopup = (
    panel: NativePanel,
    host: NativeRecord,
    position: string,
    symbol: string,
  ): void => {
    try {
      Reflect.apply(panel.openPopup, panel, [host, position, 0, 0]);
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

  const moveToAnchor = (
    panel: NativePanel,
    host: NativeRecord,
    position: string,
    symbol: string,
  ): void => {
    try {
      Reflect.apply(panel.moveToAnchor, panel, [host, position, 0, 0]);
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

  const placePanelBesideHost = (
    panel: NativePanel,
    host: NativeRecord,
    position: string,
    symbol: string,
  ): void => {
    if (isScreenPlacedPopupPosition(position)) {
      const viewport = readHostViewportRect(host);
      const screenOrigin = readWindowScreenOrigin(requireWindow());
      const moveTo = panel.moveTo;
      if (viewport && isFunction(moveTo)) {
        try {
          let x = screenOrigin.x + viewport.x;
          const y = screenOrigin.y + viewport.y + viewport.height;
          const getOuterScreenRect = panel.getOuterScreenRect;
          if (isFunction(getOuterScreenRect)) {
            const outer = Reflect.apply(getOuterScreenRect, panel, []);
            if (isNativeRecord(outer)) {
              const width = readFiniteNumber(outer.width);
              if (width !== undefined) {
                x =
                  screenOrigin.x +
                  viewport.x +
                  viewport.width -
                  Math.round(width);
              }
            }
          }
          Reflect.apply(moveTo, panel, [x, y]);
          return;
        } catch {
          // Fall through to moveToAnchor.
        }
      }
    }
    moveToAnchor(panel, host, position, symbol);
  };

  const hideOtherPanels = (keepIds: ReadonlySet<string>): void => {
    const ownerWindow = requireWindow();
    for (const panelId of NATIVE_POPUP_PANEL_IDS) {
      if (keepIds.has(panelId)) {
        continue;
      }
      const panel = getDocumentElementById(ownerWindow, panelId);
      if (isPanelElement(panel) && isPanelOpen(panel)) {
        hidePanel(panel, `document.${panelId}.hidePopup`);
      }
    }
  };

  const resolvePopupPosition = (
    host: NativeRecord,
    action: PopupBrowserToolAction,
  ): string => {
    const closest = host.closest;
    if (isFunction(closest)) {
      try {
        if (
          Reflect.apply(closest, host, ["[data-fennevia-address-popup]"]) !=
          null
        ) {
          return "after_end";
        }
        if (
          Reflect.apply(closest, host, ['[data-fennevia-edge="left"]']) != null
        ) {
          return "end_before";
        }
      } catch {
        // Fall through to the action default.
      }
    }
    return popupPositionByAction[action];
  };

  const resolveActionPanel = (
    action: PopupBrowserToolAction,
  ): NativePanel | null => {
    const ownerWindow = requireWindow();
    for (const panelId of popupPanelByAction[action]) {
      const panel = getDocumentElementById(ownerWindow, panelId);
      if (isPanelElement(panel)) {
        return panel;
      }
    }
    return findOpenPanel(popupPanelByAction[action]);
  };

  const requireActionPanel = (action: PopupBrowserToolAction): NativePanel => {
    const panel = resolveActionPanel(action);
    if (!panel) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING",
        "firefox-browser-tools-action",
        `document.${popupPanelByAction[action][0]}.openPopup.moveToAnchor.hidePopup`,
      );
    }
    return panel;
  };

  const openPanelOnHost = async (
    panel: NativePanel,
    host: NativeRecord,
    position: string,
    symbol: string,
  ): Promise<void> => {
    const ownerWindow = requireWindow();
    const PanelMultiView = readPanelMultiViewOwner(ownerWindow);
    const viewport = readHostViewportRect(host);
    const screenOrigin = readWindowScreenOrigin(ownerWindow);
    let lastError: unknown;

    const finishIfOpen = (): boolean => isPanelOpen(panel);

    const runAttempt = async (
      attempt: () => unknown | Promise<unknown>,
    ): Promise<boolean> => {
      try {
        await attempt();
      } catch (error) {
        lastError = error;
        return finishIfOpen();
      }
      return finishIfOpen();
    };

    const finishPlaced = (): void => {
      if (isScreenPlacedPopupPosition(position)) {
        try {
          placePanelBesideHost(panel, host, position, `${symbol}.moveTo`);
        } catch {
          // The open panel remains Firefox-owned.
        }
      }
    };

    const panelMultiViewOpenPopup =
      PanelMultiView && isFunction(PanelMultiView.openPopup)
        ? PanelMultiView.openPopup
        : undefined;

    const tryMultiView = async (
      anchor: unknown,
      options: unknown,
    ): Promise<boolean> => {
      if (!PanelMultiView || !panelMultiViewOpenPopup) {
        return false;
      }
      return runAttempt(() =>
        Reflect.apply(panelMultiViewOpenPopup, PanelMultiView, [
          panel,
          anchor,
          options,
        ]),
      );
    };

    const tryHostMultiView = (): Promise<boolean> =>
      tryMultiView(host, Object.freeze({ position }));

    const tryHostMultiViewString = (): Promise<boolean> =>
      tryMultiView(host, position);

    const tryDetachedMultiView = (): Promise<boolean> =>
      viewport
        ? tryMultiView(
            null,
            Object.freeze({
              x: viewport.x,
              y: viewport.y + viewport.height,
            }),
          )
        : Promise.resolve(false);

    const tryHostElement = (): Promise<boolean> =>
      runAttempt(() => {
        openPopup(panel, host, position, `${symbol}.openPopup`);
      });

    const tryScreenRect = (): Promise<boolean> => {
      const openPopupAtScreenRect = panel.openPopupAtScreenRect;
      if (!viewport || !isFunction(openPopupAtScreenRect)) {
        return Promise.resolve(false);
      }
      return runAttempt(() =>
        Reflect.apply(openPopupAtScreenRect, panel, [
          position,
          screenOrigin.x + viewport.x,
          screenOrigin.y + viewport.y,
          viewport.width,
          viewport.height,
          false,
          false,
        ]),
      );
    };

    const tryScreenPoint = (): Promise<boolean> => {
      const openPopupAtScreen = panel.openPopupAtScreen;
      if (!viewport || !isFunction(openPopupAtScreen)) {
        return Promise.resolve(false);
      }
      return runAttempt(() =>
        Reflect.apply(openPopupAtScreen, panel, [
          screenOrigin.x + viewport.x,
          screenOrigin.y + viewport.y + viewport.height,
          false,
        ]),
      );
    };

    const panelHasMultiView = (() => {
      const querySelector = panel.querySelector;
      if (!isFunction(querySelector)) {
        return false;
      }
      try {
        return Reflect.apply(querySelector, panel, ["panelmultiview"]) != null;
      } catch {
        return false;
      }
    })();
    const openOnlyThroughMultiView =
      Boolean(panelMultiViewOpenPopup) &&
      (panelHasMultiView || isScreenPlacedPopupPosition(position));

    const tryScreenRectThroughMultiView = async (): Promise<boolean> => {
      const openPopupAtScreenRect = panel.openPopupAtScreenRect;
      const originalOpenPopup = panel.openPopup;
      if (
        !viewport ||
        !panelMultiViewOpenPopup ||
        !isFunction(openPopupAtScreenRect) ||
        !isFunction(originalOpenPopup)
      ) {
        return false;
      }
      const routedOpenPopup = () =>
        Reflect.apply(openPopupAtScreenRect, panel, [
          position,
          screenOrigin.x + viewport.x,
          screenOrigin.y + viewport.y,
          viewport.width,
          viewport.height,
          false,
          false,
        ]);
      try {
        panel.openPopup = routedOpenPopup;
      } catch {
        return false;
      }
      try {
        return await tryMultiView(host, Object.freeze({ position }));
      } finally {
        try {
          panel.openPopup = originalOpenPopup;
        } catch {
          // Restore is best-effort so later attempts still use Firefox's method.
        }
      }
    };

    const attempts = openOnlyThroughMultiView
      ? isScreenPlacedPopupPosition(position)
        ? [
            tryScreenRectThroughMultiView,
            tryDetachedMultiView,
            tryHostMultiView,
            tryHostMultiViewString,
          ]
        : [tryHostMultiView, tryHostMultiViewString, tryDetachedMultiView]
      : isScreenPlacedPopupPosition(position)
        ? [
            tryDetachedMultiView,
            tryScreenRect,
            tryHostMultiView,
            tryHostMultiViewString,
            tryHostElement,
            tryScreenPoint,
          ]
        : [
            tryHostMultiView,
            tryHostMultiViewString,
            tryDetachedMultiView,
            tryHostElement,
            tryScreenRect,
            tryScreenPoint,
          ];

    for (const attempt of attempts) {
      if (await attempt()) {
        finishPlaced();
        return;
      }
      await Promise.resolve();
    }

    if (finishIfOpen()) {
      finishPlaced();
      return;
    }
    if (isFirefoxBridgeError(lastError)) {
      throw lastError;
    }
    throw createBrowserToolsError(
      boundary,
      "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED",
      "firefox-browser-tools-action",
      `${symbol}.openPopup`,
      lastError,
    );
  };

  const openOrMovePanel = async (
    action: PopupBrowserToolAction,
    host: NativeRecord,
    position: string,
  ): Promise<NativePanel> => {
    const panel = requireActionPanel(action);
    const panelId =
      typeof panel.id === "string" && panel.id
        ? panel.id
        : popupPanelByAction[action][0];
    if (isPanelOpen(panel)) {
      moveToAnchor(panel, host, position, `document.${panelId}.moveToAnchor`);
      return panel;
    }
    await openPanelOnHost(panel, host, position, `document.${panelId}`);
    return panel;
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
    const position = resolvePopupPosition(resolvedHost, action);
    hideOtherPanels(new Set(popupPanelByAction[action]));
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
      if (pendingHandoff && isPanelElement(popup)) {
        try {
          placePanelBesideHost(
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
      switch (action) {
        case "site-information":
        case "protections": {
          if (!isNativeRecord(ownerWindow.gTrustPanelHandler)) {
            throw createBrowserToolsError(
              boundary,
              "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING",
              "firefox-browser-tools-action",
              "window.gTrustPanelHandler.showPopup",
            );
          }
          try {
            await invokeMethod(
              ownerWindow.gTrustPanelHandler,
              "showPopup",
              "window.gTrustPanelHandler.showPopup",
            );
          } catch {
            // #anchor() uses checkVisibility() on collapsed navbar nodes, so
            // showPopup can throw after initializing the lazy panel.
          }
          const opened = findOpenPanel(popupPanelByAction[action]);
          if (opened) {
            moveToAnchor(
              opened,
              handoff.host,
              handoff.position,
              `document.${opened.id ?? handoff.panelId}.moveToAnchor`,
            );
            return true;
          }
          await openOrMovePanel(action, handoff.host, handoff.position);
          return true;
        }

        case "site-permissions": {
          if (!isNativeRecord(ownerWindow.gPermissionPanel)) {
            throw createBrowserToolsError(
              boundary,
              "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING",
              "firefox-browser-tools-action",
              "window.gPermissionPanel.setAnchor",
            );
          }
          const setAnchor = ownerWindow.gPermissionPanel.setAnchor;
          if (!isFunction(setAnchor)) {
            throw createBrowserToolsError(
              boundary,
              "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING",
              "firefox-browser-tools-action",
              "window.gPermissionPanel.setAnchor",
            );
          }
          try {
            Reflect.apply(setAnchor, ownerWindow.gPermissionPanel, [
              handoff.host,
              handoff.position,
            ]);
          } catch (error) {
            throw createBrowserToolsError(
              boundary,
              "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED",
              "firefox-browser-tools-action",
              "window.gPermissionPanel.setAnchor",
              error,
            );
          }
          try {
            await invokeMethod(
              ownerWindow.gPermissionPanel,
              "openPopup",
              "window.gPermissionPanel.openPopup",
              [Object.freeze({})],
            );
          } catch {
            // The lazy permission template may still need a host-anchored open.
          }
          const opened = findOpenPanel(popupPanelByAction[action]);
          if (opened) {
            moveToAnchor(
              opened,
              handoff.host,
              handoff.position,
              "document.permission-popup.moveToAnchor",
            );
            return true;
          }
          await openOrMovePanel(action, handoff.host, handoff.position);
          return true;
        }

        case "downloads": {
          if (!isNativeRecord(ownerWindow.DownloadsPanel)) {
            throw createBrowserToolsError(
              boundary,
              "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING",
              "firefox-browser-tools-action",
              "window.DownloadsPanel.initialize",
            );
          }
          await invokeMethod(
            ownerWindow.DownloadsPanel,
            "initialize",
            "window.DownloadsPanel.initialize",
          );
          await openOrMovePanel(action, handoff.host, handoff.position);
          return true;
        }

        case "extensions": {
          const panel = requireActionPanel(action);
          if (isPanelOpen(panel)) {
            hidePanel(panel, "document.unified-extensions-panel.hidePopup");
            pendingHandoff = null;
            for (const id of popupPanelByAction[action]) {
              endHandoff(id);
            }
            publishPopup(false);
            return true;
          }
          if (!isNativeRecord(ownerWindow.gUnifiedExtensions)) {
            throw createBrowserToolsError(
              boundary,
              "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING",
              "firefox-browser-tools-action",
              "window.gUnifiedExtensions.togglePanel",
            );
          }
          const PanelMultiView = readPanelMultiViewOwner(ownerWindow);
          const originalMultiViewOpenPopup =
            PanelMultiView && isFunction(PanelMultiView.openPopup)
              ? PanelMultiView.openPopup
              : undefined;
          // togglePanel fire-and-forgets PanelMultiView.openPopup on the native
          // button. That in-flight open races the host-anchored open and
          // popuphides the panel before popupshown.
          if (PanelMultiView && originalMultiViewOpenPopup) {
            try {
              PanelMultiView.openPopup = (
                candidatePanel: unknown,
                ...rest: unknown[]
              ) => {
                if (
                  isNativeRecord(candidatePanel) &&
                  candidatePanel.id === "unified-extensions-panel"
                ) {
                  return undefined;
                }
                return Reflect.apply(
                  originalMultiViewOpenPopup,
                  PanelMultiView,
                  [candidatePanel, ...rest],
                );
              };
            } catch {
              // Non-writable owners still host-open after togglePanel.
            }
          }
          try {
            await invokeMethod(
              ownerWindow.gUnifiedExtensions,
              "togglePanel",
              "window.gUnifiedExtensions.togglePanel",
            );
          } catch {
            // togglePanel still initializes lazy panel contents.
          } finally {
            if (PanelMultiView && originalMultiViewOpenPopup) {
              try {
                PanelMultiView.openPopup = originalMultiViewOpenPopup;
              } catch {
                // Host-open uses the restored or original owner.
              }
            }
          }
          await openOrMovePanel(action, handoff.host, handoff.position);
          return true;
        }

        case "translate": {
          const translations = ownerWindow.FullPageTranslationsPanel;
          if (!isNativeRecord(translations) || !isFunction(translations.open)) {
            throw createBrowserToolsError(
              boundary,
              "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING",
              "firefox-browser-tools-action",
              "window.FullPageTranslationsPanel.open",
            );
          }
          const panelMultiView = readPanelMultiViewOwner(ownerWindow);
          const originalOpenPopup = panelMultiView?.openPopup;
          let routedOpenPopup:
            ((candidatePanel: unknown, ...rest: unknown[]) => unknown) | null =
            null;
          if (panelMultiView && isFunction(originalOpenPopup)) {
            routedOpenPopup = (candidatePanel, ...rest) => {
              if (
                isNativeRecord(candidatePanel) &&
                candidatePanel.id === "full-page-translations-panel"
              ) {
                const options = isNativeRecord(rest[1])
                  ? Object.freeze({
                      ...rest[1],
                      position: handoff.position,
                    })
                  : Object.freeze({ position: handoff.position });
                const result = Reflect.apply(
                  originalOpenPopup,
                  panelMultiView,
                  [candidatePanel, handoff.host, options],
                );
                return result;
              }
              return Reflect.apply(originalOpenPopup, panelMultiView, [
                candidatePanel,
                ...rest,
              ]);
            };
            try {
              panelMultiView.openPopup = routedOpenPopup;
            } catch {
              routedOpenPopup = null;
            }
          }
          let panelShown = false;
          try {
            await invokeMethod(
              translations,
              "open",
              "window.FullPageTranslationsPanel.open",
              [resolveTranslationTriggerEvent(triggerEvent, handoff.host)],
            );
            // Firefox 153/154's async open() starts its private #openPromise but
            // returns without awaiting it. Keep the narrowly scoped route in
            // place until the lazily materialized panel actually opens.
            panelShown = await waitForPanelShown(
              handoff.panelId,
              TRANSLATIONS_PANEL_OPEN_TIMEOUT_MS,
            );
          } finally {
            if (
              panelMultiView &&
              originalOpenPopup &&
              routedOpenPopup &&
              panelMultiView.openPopup === routedOpenPopup
            ) {
              try {
                panelMultiView.openPopup = originalOpenPopup;
              } catch {
                // The popupshown handoff still places the Firefox-owned panel.
              }
            }
          }
          if (!panelShown) {
            throw createBrowserToolsError(
              boundary,
              "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED",
              "firefox-browser-tools-action",
              "document.full-page-translations-panel.popupshown",
            );
          }
          const opened = resolveActionPanel(action);
          if (!opened || !isPanelOpen(opened)) {
            throw createBrowserToolsError(
              boundary,
              "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED",
              "firefox-browser-tools-action",
              "document.full-page-translations-panel.openPopup",
            );
          }
          if (opened.anchorNode !== handoff.host) {
            placePanelBesideHost(
              opened,
              handoff.host,
              handoff.position,
              "document.full-page-translations-panel.moveToAnchor",
            );
          }
          return true;
        }

        case "application-menu": {
          const panel = requireActionPanel(action);
          if (isPanelOpen(panel)) {
            hidePanel(panel, "document.appMenu-popup.hidePopup");
            pendingHandoff = null;
            for (const id of popupPanelByAction[action]) {
              endHandoff(id);
            }
            publishPopup(false);
            return true;
          }
          if (!isNativeRecord(ownerWindow.PanelUI)) {
            throw createBrowserToolsError(
              boundary,
              "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING",
              "firefox-browser-tools-action",
              "window.PanelUI.ensureReady",
            );
          }
          await invokeMethod(
            ownerWindow.PanelUI,
            "ensureReady",
            "window.PanelUI.ensureReady",
          );
          const ensureShortcuts = ownerWindow.PanelUI._ensureShortcutsShown;
          if (isFunction(ensureShortcuts)) {
            try {
              Reflect.apply(ensureShortcuts, ownerWindow.PanelUI, []);
            } catch {
              // Shortcut labels are optional for opening the panel.
            }
          }
          try {
            await openOrMovePanel(action, handoff.host, handoff.position);
          } catch {
            // Host-open can fail for arrow PanelMultiView; use PanelUI.show().
          }
          const openedOnHost = resolveActionPanel(action);
          if (openedOnHost && isPanelOpen(openedOnHost)) {
            return true;
          }
          beginHandoff("appMenu-popup");
          if (!isFunction(ownerWindow.PanelUI.show)) {
            throw createBrowserToolsError(
              boundary,
              "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING",
              "firefox-browser-tools-action",
              "window.PanelUI.show",
            );
          }
          const shown = waitForPanelShown("appMenu-popup");
          try {
            const result = Reflect.apply(
              ownerWindow.PanelUI.show,
              ownerWindow.PanelUI,
              [],
            );
            void Promise.resolve(result).catch(() => {
              // show() is fire-and-forget; popupshown re-anchors the host.
            });
          } catch (error) {
            throw createBrowserToolsError(
              boundary,
              "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED",
              "firefox-browser-tools-action",
              "window.PanelUI.show",
              error,
            );
          }
          await shown;
          const opened = resolveActionPanel(action);
          if (opened && isPanelOpen(opened)) {
            placePanelBesideHost(
              opened,
              handoff.host,
              handoff.position,
              "document.appMenu-popup.moveTo",
            );
            return true;
          }
          await openOrMovePanel(action, handoff.host, handoff.position);
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
