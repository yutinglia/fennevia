// SPDX-License-Identifier: MPL-2.0
import type { PopupBrowserToolAction } from "../../app/browser-tools-state.ts";
import type { FirefoxBridgeBoundary } from "../bridge-boundary.ts";
import type { BrowserToolsPanelPlacement } from "./panel-placement.ts";
import {
  createBrowserToolsError,
  isFunction,
  isNativeRecord,
  isPanelOpen,
  popupPanelByAction,
  readPanelMultiViewOwner,
  type NativePanel,
  type NativeRecord,
  type PopupHandoff,
} from "./support.ts";

const TRANSLATIONS_PANEL_OPEN_TIMEOUT_MS = 10_000;

type InvokeMethod = (
  owner: NativeRecord,
  methodName: string,
  symbol: string,
  args?: readonly unknown[],
) => Promise<void>;

export type BrowserToolsPopupActionInvoker = Readonly<{
  invoke: (
    action: PopupBrowserToolAction,
    ownerWindow: NativeRecord,
    handoff: PopupHandoff,
    triggerEvent?: unknown,
  ) => Promise<boolean>;
}>;

export function createBrowserToolsPopupActionInvoker({
  beginHandoff,
  boundary,
  closeOpenPanel,
  invokeMethod,
  panelPlacement,
  resolveTranslationTriggerEvent,
  waitForPanelShown,
}: Readonly<{
  beginHandoff: (panelId: string) => void;
  boundary: FirefoxBridgeBoundary;
  closeOpenPanel: (
    action: PopupBrowserToolAction,
    panel: NativePanel,
    symbol: string,
  ) => void;
  invokeMethod: InvokeMethod;
  panelPlacement: BrowserToolsPanelPlacement;
  resolveTranslationTriggerEvent: (
    candidate: unknown,
    host: NativeRecord,
  ) => NativeRecord;
  waitForPanelShown: (panelId: string, timeoutMs?: number) => Promise<boolean>;
}>): BrowserToolsPopupActionInvoker {
  const invokeTrustAction = async (
    action: "site-information" | "protections",
    ownerWindow: NativeRecord,
    handoff: PopupHandoff,
  ): Promise<boolean> => {
    if (!isNativeRecord(ownerWindow.gTrustPanelHandler)) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING",
        "firefox-browser-tools-action",
        "window.gTrustPanelHandler.showPopup",
      );
    }
    const panelMultiView = readPanelMultiViewOwner(ownerWindow);
    const originalOpenPopup = panelMultiView?.openPopup;
    const routedPanelIds = new Set(popupPanelByAction[action]);
    let routedOpenPopup:
      ((candidatePanel: unknown, ...rest: unknown[]) => unknown) | null = null;
    if (panelMultiView && isFunction(originalOpenPopup)) {
      routedOpenPopup = (candidatePanel, ...rest) => {
        if (
          isNativeRecord(candidatePanel) &&
          typeof candidatePanel.id === "string" &&
          routedPanelIds.has(candidatePanel.id)
        ) {
          const options = isNativeRecord(rest[1])
            ? Object.freeze({ ...rest[1], position: handoff.position })
            : Object.freeze({ position: handoff.position });
          return Reflect.apply(originalOpenPopup, panelMultiView, [
            candidatePanel,
            handoff.host,
            options,
          ]);
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
    try {
      await invokeMethod(
        ownerWindow.gTrustPanelHandler,
        "showPopup",
        "window.gTrustPanelHandler.showPopup",
      );
    } catch {
      // #anchor() uses checkVisibility() on collapsed navbar nodes, so
      // showPopup can throw after initializing the lazy panel.
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
          // A host-open fallback still reuses the initialized native panel.
        }
      }
    }
    const opened = panelPlacement.findOpenPanel(popupPanelByAction[action]);
    if (opened && opened.anchorNode !== handoff.host) {
      panelPlacement.placePanelBesideHost(
        opened,
        handoff.host,
        handoff.position,
        `document.${opened.id ?? handoff.panelId}.moveToAnchor`,
      );
      return true;
    }
    await panelPlacement.openOrMovePanel(
      action,
      handoff.host,
      handoff.position,
    );
    return true;
  };

  const invokeSitePermissions = async (
    ownerWindow: NativeRecord,
    handoff: PopupHandoff,
  ): Promise<boolean> => {
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
    const opened = panelPlacement.findOpenPanel(["permission-popup"]);
    if (opened && opened.anchorNode !== handoff.host) {
      panelPlacement.placePanelBesideHost(
        opened,
        handoff.host,
        handoff.position,
        "document.permission-popup.moveToAnchor",
      );
      return true;
    }
    await panelPlacement.openOrMovePanel(
      "site-permissions",
      handoff.host,
      handoff.position,
    );
    return true;
  };

  const invokeDownloads = async (
    ownerWindow: NativeRecord,
    handoff: PopupHandoff,
  ): Promise<boolean> => {
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
    await panelPlacement.openOrMovePanel(
      "downloads",
      handoff.host,
      handoff.position,
    );
    return true;
  };

  const invokeExtensions = async (
    ownerWindow: NativeRecord,
    handoff: PopupHandoff,
  ): Promise<boolean> => {
    const panel = panelPlacement.requireActionPanel("extensions");
    if (isPanelOpen(panel)) {
      closeOpenPanel(
        "extensions",
        panel,
        "document.unified-extensions-panel.hidePopup",
      );
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
    // button. That in-flight open races the host-anchored open and popuphides
    // the panel before popupshown.
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
          return Reflect.apply(originalMultiViewOpenPopup, PanelMultiView, [
            candidatePanel,
            ...rest,
          ]);
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
    await panelPlacement.openOrMovePanel(
      "extensions",
      handoff.host,
      handoff.position,
    );
    return true;
  };

  const invokeTranslate = async (
    ownerWindow: NativeRecord,
    handoff: PopupHandoff,
    triggerEvent?: unknown,
  ): Promise<boolean> => {
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
      ((candidatePanel: unknown, ...rest: unknown[]) => unknown) | null = null;
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
          return Reflect.apply(originalOpenPopup, panelMultiView, [
            candidatePanel,
            handoff.host,
            options,
          ]);
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
    let panelShown: boolean | undefined;
    try {
      await invokeMethod(
        translations,
        "open",
        "window.FullPageTranslationsPanel.open",
        [resolveTranslationTriggerEvent(triggerEvent, handoff.host)],
      );
      // Firefox 153/154's async open() starts its private #openPromise but
      // returns without awaiting it. Keep the narrowly scoped route in place
      // until the lazily materialized panel actually opens.
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
    const opened = panelPlacement.resolveActionPanel("translate");
    if (!opened || !isPanelOpen(opened)) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED",
        "firefox-browser-tools-action",
        "document.full-page-translations-panel.openPopup",
      );
    }
    if (opened.anchorNode !== handoff.host) {
      panelPlacement.placePanelBesideHost(
        opened,
        handoff.host,
        handoff.position,
        "document.full-page-translations-panel.moveToAnchor",
      );
    }
    return true;
  };

  const invokeApplicationMenu = async (
    ownerWindow: NativeRecord,
    handoff: PopupHandoff,
  ): Promise<boolean> => {
    const panel = panelPlacement.requireActionPanel("application-menu");
    if (isPanelOpen(panel)) {
      closeOpenPanel(
        "application-menu",
        panel,
        "document.appMenu-popup.hidePopup",
      );
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
      await panelPlacement.openOrMovePanel(
        "application-menu",
        handoff.host,
        handoff.position,
      );
    } catch {
      // Host-open can fail for arrow PanelMultiView; use PanelUI.show().
    }
    const openedOnHost = panelPlacement.resolveActionPanel("application-menu");
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
    const opened = panelPlacement.resolveActionPanel("application-menu");
    if (opened && isPanelOpen(opened)) {
      panelPlacement.placePanelBesideHost(
        opened,
        handoff.host,
        handoff.position,
        "document.appMenu-popup.moveTo",
      );
      return true;
    }
    await panelPlacement.openOrMovePanel(
      "application-menu",
      handoff.host,
      handoff.position,
    );
    return true;
  };

  const invoke = async (
    action: PopupBrowserToolAction,
    ownerWindow: NativeRecord,
    handoff: PopupHandoff,
    triggerEvent?: unknown,
  ): Promise<boolean> => {
    switch (action) {
      case "site-information":
      case "protections":
        return invokeTrustAction(action, ownerWindow, handoff);
      case "site-permissions":
        return invokeSitePermissions(ownerWindow, handoff);
      case "downloads":
        return invokeDownloads(ownerWindow, handoff);
      case "extensions":
        return invokeExtensions(ownerWindow, handoff);
      case "translate":
        return invokeTranslate(ownerWindow, handoff, triggerEvent);
      case "application-menu":
        return invokeApplicationMenu(ownerWindow, handoff);
    }
    throw createBrowserToolsError(
      boundary,
      "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID",
      "firefox-browser-tools-action",
      "browser-tools.action",
    );
  };

  return Object.freeze({ invoke });
}
