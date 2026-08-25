// SPDX-License-Identifier: MPL-2.0
import type { PopupBrowserToolAction } from "../../app/browser-tools-state.ts";
import {
  isFirefoxBridgeError,
  type FirefoxBridgeBoundary,
} from "../bridge-boundary.ts";
import {
  NATIVE_POPUP_PANEL_IDS,
  createBrowserToolsError,
  getDocumentElementById,
  isFunction,
  isNativeRecord,
  isPanelElement,
  isPanelOpen,
  isScreenPlacedPopupPosition,
  popupPanelByAction,
  popupPositionByAction,
  readFiniteNumber,
  readHostViewportRect,
  readPanelMultiViewOwner,
  readWindowScreenOrigin,
  readWindowViewportSize,
  type NativePanel,
  type NativeRecord,
} from "./support.ts";
import {
  resolveBestAdjacentPopupPoint,
  type PopupPlacementDirection,
} from "./popup-geometry.ts";

const EDGE_POPUP_PLACEMENTS = Object.freeze([
  Object.freeze(["top", "down", "after_start", "after_end"]),
  Object.freeze(["left", "right", "end_before", "end_after"]),
  Object.freeze(["right", "left", "start_before", "start_after"]),
  Object.freeze(["bottom", "up", "before_start", "before_end"]),
] as const satisfies ReadonlyArray<
  readonly [string, PopupPlacementDirection, string, string]
>);

export type BrowserToolsPanelPlacement = Readonly<{
  findOpenPanel: (panelIds: readonly string[]) => NativePanel | null;
  hideOtherPanels: (keepIds: ReadonlySet<string>) => void;
  hidePanel: (panel: NativePanel, symbol: string) => void;
  moveToAnchor: (
    panel: NativePanel,
    host: NativeRecord,
    position: string,
    symbol: string,
  ) => void;
  openOrMovePanel: (
    action: PopupBrowserToolAction,
    host: NativeRecord,
    position: string,
  ) => Promise<NativePanel>;
  placePanelBesideHost: (
    panel: NativePanel,
    host: NativeRecord,
    position: string,
    symbol: string,
  ) => void;
  requireActionPanel: (action: PopupBrowserToolAction) => NativePanel;
  resolveActionPanel: (action: PopupBrowserToolAction) => NativePanel | null;
  resolvePopupPosition: (
    host: NativeRecord,
    action: PopupBrowserToolAction,
  ) => string;
}>;

export function createBrowserToolsPanelPlacement({
  boundary,
  requireWindow,
}: Readonly<{
  boundary: FirefoxBridgeBoundary;
  requireWindow: () => NativeRecord;
}>): BrowserToolsPanelPlacement {
  const resolveHostEdgePlacement = (
    host: NativeRecord,
  ): (typeof EDGE_POPUP_PLACEMENTS)[number] | null => {
    const closest = host.closest;
    if (!isFunction(closest)) {
      return null;
    }
    for (const placement of EDGE_POPUP_PLACEMENTS) {
      const [edge] = placement;
      try {
        if (
          Reflect.apply(closest, host, [`[data-fennevia-edge="${edge}"]`]) !=
          null
        ) {
          return placement;
        }
      } catch {
        return null;
      }
    }
    return null;
  };

  const resolveHostDirection = (host: NativeRecord): PopupPlacementDirection =>
    resolveHostEdgePlacement(host)?.[1] ?? "auto";

  const resolveHostPosition = (
    host: NativeRecord,
    fallback: string,
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
      } catch {
        return fallback;
      }
    }
    const edgePlacement = resolveHostEdgePlacement(host);
    if (!edgePlacement) {
      return fallback;
    }
    const hostRect = readHostViewportRect(host);
    const viewport = readWindowViewportSize(requireWindow());
    if (!hostRect || !viewport) {
      return edgePlacement[2];
    }
    const horizontalEdge =
      edgePlacement[0] === "top" || edgePlacement[0] === "bottom";
    const hostCenter = horizontalEdge
      ? hostRect.x + hostRect.width / 2
      : hostRect.y + hostRect.height / 2;
    const viewportCenter =
      (horizontalEdge ? viewport.width : viewport.height) / 2;
    return hostCenter <= viewportCenter ? edgePlacement[2] : edgePlacement[3];
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
    const ownerWindow = requireWindow();
    const viewport = readHostViewportRect(host);
    const windowViewport = readWindowViewportSize(ownerWindow);
    const screenOrigin = readWindowScreenOrigin(ownerWindow);
    const moveTo = panel.moveTo;
    const getOuterScreenRect = panel.getOuterScreenRect;
    if (
      viewport &&
      windowViewport &&
      isFunction(moveTo) &&
      isFunction(getOuterScreenRect)
    ) {
      try {
        const outer = Reflect.apply(getOuterScreenRect, panel, []);
        if (!isNativeRecord(outer)) {
          throw new TypeError("native popup outer rectangle unavailable");
        }
        const width = readFiniteNumber(outer.width);
        const height = readFiniteNumber(outer.height);
        if (width === undefined || height === undefined) {
          throw new TypeError("native popup dimensions unavailable");
        }
        const point = resolveBestAdjacentPopupPoint({
          direction: resolveHostDirection(host),
          hostRect: viewport,
          popupSize: { height, width },
          viewportSize: windowViewport,
        });
        if (!point) {
          throw new TypeError("native popup geometry invalid");
        }
        Reflect.apply(moveTo, panel, [
          screenOrigin.x + point.x,
          screenOrigin.y + point.y,
        ]);
        return;
      } catch {
        // Fall through to Firefox's anchor placement.
      }
    }
    moveToAnchor(panel, host, resolveHostPosition(host, position), symbol);
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
    return resolveHostPosition(host, popupPositionByAction[action]);
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
      if (panel.anchorNode === host) {
        return panel;
      }
      placePanelBesideHost(
        panel,
        host,
        position,
        `document.${panelId}.moveToAnchor`,
      );
      return panel;
    }
    await openPanelOnHost(panel, host, position, `document.${panelId}`);
    return panel;
  };

  return Object.freeze({
    findOpenPanel,
    hideOtherPanels,
    hidePanel,
    moveToAnchor,
    openOrMovePanel,
    placePanelBesideHost,
    requireActionPanel,
    resolveActionPanel,
    resolvePopupPosition,
  });
}
