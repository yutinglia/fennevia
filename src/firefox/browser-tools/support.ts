// SPDX-License-Identifier: MPL-2.0
import {
  type BrowserToolsSnapshot,
  type PopupBrowserToolAction,
} from "../../app/browser-tools-state.ts";
import {
  FirefoxBridgeError,
  type FirefoxBridgeBoundary,
  type FirefoxBridgeErrorContext,
  type FirefoxCapabilitySnapshot,
} from "../bridge-boundary.ts";

export type NativeRecord = Record<string, unknown>;
export type NativePanel = NativeRecord & {
  hidePopup: (...args: unknown[]) => unknown;
  moveToAnchor: (...args: unknown[]) => unknown;
  openPopup: (...args: unknown[]) => unknown;
};

export type BrowserToolCapabilityEvaluation = Readonly<{
  cause?: unknown;
  snapshot: FirefoxCapabilitySnapshot;
}>;

export type BrowserToolCapabilitySpecification = Readonly<{
  isAvailable: (value: unknown) => boolean;
  name: string;
  read: (window: NativeRecord) => unknown;
  requirement?: "optional" | "required";
  symbol: string;
}>;

export type PopupHandoff = Readonly<{
  host: NativeRecord;
  panelId: string;
  position: string;
}>;

export const LISTENER_OPTIONS = Object.freeze({ capture: true });

export const NATIVE_POPUP_PANEL_IDS = Object.freeze([
  "appMenu-popup",
  "downloadsPanel",
  "identity-popup",
  "permission-popup",
  "protections-popup",
  "trustpanel-popup",
  "unified-extensions-panel",
  "full-page-translations-panel",
]);

export const nativePopupPanelIdSet = new Set<string>(NATIVE_POPUP_PANEL_IDS);

export const popupPanelByAction: Readonly<
  Record<PopupBrowserToolAction, readonly string[]>
> = Object.freeze({
  "application-menu": Object.freeze(["appMenu-popup"]),
  downloads: Object.freeze(["downloadsPanel"]),
  extensions: Object.freeze(["unified-extensions-panel"]),
  translate: Object.freeze(["full-page-translations-panel"]),
  protections: Object.freeze(["trustpanel-popup", "protections-popup"]),
  "site-information": Object.freeze(["trustpanel-popup", "identity-popup"]),
  "site-permissions": Object.freeze(["permission-popup"]),
});

export const APPLICATION_MENU_POSITION = "bottomcenter topright";

export const popupPositionByAction: Readonly<
  Record<PopupBrowserToolAction, string>
> = Object.freeze({
  "application-menu": APPLICATION_MENU_POSITION,
  downloads: "after_start",
  extensions: "after_end",
  translate: "after_end",
  protections: "end_before",
  "site-information": "end_before",
  "site-permissions": "after_end",
});

export const isScreenPlacedPopupPosition = (position: string): boolean =>
  position === APPLICATION_MENU_POSITION;

export const isNativeRecord = (value: unknown): value is NativeRecord =>
  typeof value === "object" && value !== null;

export const isFunction = (
  value: unknown,
): value is (...args: unknown[]) => unknown => typeof value === "function";

export const readPanelMultiViewOwner = (
  window: NativeRecord,
): NativeRecord | null => {
  const candidate = window.PanelMultiView;
  if (typeof candidate === "function") {
    const owner = candidate as unknown as NativeRecord;
    return isFunction(owner.openPopup) ? owner : null;
  }
  if (isNativeRecord(candidate) && isFunction(candidate.openPopup)) {
    return candidate;
  }
  return null;
};

export const isEventTarget = (
  value: unknown,
): value is NativeRecord & {
  addEventListener: (...args: unknown[]) => unknown;
  removeEventListener: (...args: unknown[]) => unknown;
} =>
  isNativeRecord(value) &&
  isFunction(value.addEventListener) &&
  isFunction(value.removeEventListener);

export const isNativeActionTarget = (value: unknown): value is NativeRecord =>
  isNativeRecord(value) && isFunction(value.click) && isFunction(value.focus);

export const isPanelElement = (value: unknown): value is NativePanel =>
  isNativeRecord(value) &&
  isFunction(value.hidePopup) &&
  isFunction(value.moveToAnchor) &&
  isFunction(value.openPopup);

export const readFiniteNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

export const readHostViewportRect = (
  host: NativeRecord,
): Readonly<{
  height: number;
  width: number;
  x: number;
  y: number;
}> | null => {
  try {
    const rect = Reflect.apply(
      host.getBoundingClientRect as () => unknown,
      host,
      [],
    );
    if (!isNativeRecord(rect)) {
      return null;
    }
    const x = readFiniteNumber(rect.left) ?? readFiniteNumber(rect.x);
    const y = readFiniteNumber(rect.top) ?? readFiniteNumber(rect.y);
    const width = readFiniteNumber(rect.width);
    const height = readFiniteNumber(rect.height);
    if (
      x === undefined ||
      y === undefined ||
      width === undefined ||
      height === undefined
    ) {
      return null;
    }
    return Object.freeze({
      height: Math.max(1, Math.round(height)),
      width: Math.max(1, Math.round(width)),
      x: Math.round(x),
      y: Math.round(y),
    });
  } catch {
    return null;
  }
};

export const readWindowScreenOrigin = (
  window: NativeRecord,
): Readonly<{ x: number; y: number }> => {
  const x = readFiniteNumber(window.mozInnerScreenX) ?? 0;
  const y = readFiniteNumber(window.mozInnerScreenY) ?? 0;
  return Object.freeze({ x: Math.round(x), y: Math.round(y) });
};

export const getDocumentElementById = (
  window: NativeRecord,
  id: string,
): unknown => {
  const document = window.document;
  if (!isNativeRecord(document) || !isFunction(document.getElementById)) {
    return undefined;
  }
  return Reflect.apply(document.getElementById, document, [id]);
};

export const readOwnerPanel = (owner: unknown): unknown =>
  isNativeRecord(owner) ? owner.panel : undefined;

export const defineBrowserToolCapability = (
  specification: BrowserToolCapabilitySpecification,
): BrowserToolCapabilitySpecification => Object.freeze(specification);

export const browserToolCapabilitySpecifications: ReadonlyArray<BrowserToolCapabilitySpecification> =
  Object.freeze([
    defineBrowserToolCapability({
      isAvailable: (value) =>
        isNativeActionTarget(value) && isFunction(value.checkVisibility),
      name: "browser-tools.trust-anchor",
      read: (window) => getDocumentElementById(window, "trust-icon-container"),
      symbol: "document.trust-icon-container.click.focus.checkVisibility",
    }),
    defineBrowserToolCapability({
      isAvailable: isNativeActionTarget,
      name: "browser-tools.identity-anchor",
      read: (window) => getDocumentElementById(window, "identity-icon-box"),
      symbol: "document.identity-icon-box.click.focus",
    }),
    defineBrowserToolCapability({
      isAvailable: isNativeActionTarget,
      name: "browser-tools.protections-anchor",
      read: (window) =>
        getDocumentElementById(window, "tracking-protection-icon-container"),
      symbol: "document.tracking-protection-icon-container.click.focus",
    }),
    defineBrowserToolCapability({
      isAvailable: isNativeActionTarget,
      name: "browser-tools.permissions-anchor",
      read: (window) =>
        getDocumentElementById(window, "identity-permission-box"),
      symbol: "document.identity-permission-box.click.focus",
    }),
    defineBrowserToolCapability({
      isAvailable: isFunction,
      name: "browser-tools.unified-extensions",
      read: (window) =>
        isNativeRecord(window.gUnifiedExtensions)
          ? window.gUnifiedExtensions.togglePanel
          : undefined,
      symbol: "window.gUnifiedExtensions.togglePanel",
    }),
    defineBrowserToolCapability({
      isAvailable: isFunction,
      name: "browser-tools.full-page-translations",
      read: (window) =>
        isNativeRecord(window.FullPageTranslationsPanel)
          ? window.FullPageTranslationsPanel.open
          : undefined,
      requirement: "optional",
      symbol: "window.FullPageTranslationsPanel.open",
    }),
    defineBrowserToolCapability({
      isAvailable: isFunction,
      name: "browser-tools.application-menu",
      read: (window) =>
        isNativeRecord(window.PanelUI) ? window.PanelUI.show : undefined,
      symbol: "window.PanelUI.show",
    }),
    defineBrowserToolCapability({
      isAvailable: isFunction,
      name: "browser-tools.application-menu-ready",
      read: (window) =>
        isNativeRecord(window.PanelUI) ? window.PanelUI.ensureReady : undefined,
      symbol: "window.PanelUI.ensureReady",
    }),
    defineBrowserToolCapability({
      isAvailable: isFunction,
      name: "browser-tools.settings",
      read: (window) => window.openPreferences,
      symbol: "window.openPreferences",
    }),
    defineBrowserToolCapability({
      isAvailable: isFunction,
      name: "browser-tools.customize",
      read: (window) =>
        isNativeRecord(window.gCustomizeMode)
          ? window.gCustomizeMode.enter
          : undefined,
      symbol: "window.gCustomizeMode.enter",
    }),
    defineBrowserToolCapability({
      isAvailable: (value) => isNativeRecord(value) && isFunction(value.focus),
      name: "browser-tools.native-toolbar-focus",
      read: (window) => getDocumentElementById(window, "back-button"),
      symbol: "document.back-button.focus",
    }),
    defineBrowserToolCapability({
      isAvailable: isNativeActionTarget,
      name: "browser-tools.extensions-anchor",
      read: (window) =>
        getDocumentElementById(window, "unified-extensions-button"),
      symbol: "document.unified-extensions-button.click.focus",
    }),
    defineBrowserToolCapability({
      isAvailable: isNativeActionTarget,
      name: "browser-tools.application-menu-anchor",
      read: (window) => getDocumentElementById(window, "PanelUI-menu-button"),
      symbol: "document.PanelUI-menu-button.click.focus",
    }),
    defineBrowserToolCapability({
      isAvailable: isFunction,
      name: "browser-tools.trust-panel",
      read: (window) =>
        isNativeRecord(window.gTrustPanelHandler)
          ? window.gTrustPanelHandler.showPopup
          : undefined,
      symbol: "window.gTrustPanelHandler.showPopup",
    }),
    defineBrowserToolCapability({
      isAvailable: isFunction,
      name: "browser-tools.permission-set-anchor",
      read: (window) =>
        isNativeRecord(window.gPermissionPanel)
          ? window.gPermissionPanel.setAnchor
          : undefined,
      symbol: "window.gPermissionPanel.setAnchor",
    }),
    defineBrowserToolCapability({
      isAvailable: isFunction,
      name: "browser-tools.permission-open-popup",
      read: (window) =>
        isNativeRecord(window.gPermissionPanel)
          ? window.gPermissionPanel.openPopup
          : undefined,
      symbol: "window.gPermissionPanel.openPopup",
    }),
    defineBrowserToolCapability({
      isAvailable: isFunction,
      name: "browser-tools.downloads-initialize",
      read: (window) =>
        isNativeRecord(window.DownloadsPanel)
          ? window.DownloadsPanel.initialize
          : undefined,
      symbol: "window.DownloadsPanel.initialize",
    }),
    defineBrowserToolCapability({
      isAvailable: isPanelElement,
      name: "browser-tools.downloads-panel",
      read: (window) => {
        const panel = getDocumentElementById(window, "downloadsPanel");
        return isPanelElement(panel)
          ? panel
          : readOwnerPanel(window.DownloadsPanel);
      },
      symbol: "document.downloadsPanel.openPopup.moveToAnchor.hidePopup",
    }),
    defineBrowserToolCapability({
      isAvailable: isPanelElement,
      name: "browser-tools.application-menu-panel",
      read: (window) => {
        const panel = getDocumentElementById(window, "appMenu-popup");
        return isPanelElement(panel) ? panel : readOwnerPanel(window.PanelUI);
      },
      symbol: "document.appMenu-popup.openPopup.moveToAnchor.hidePopup",
    }),
    defineBrowserToolCapability({
      isAvailable: isPanelElement,
      name: "browser-tools.extensions-panel",
      read: (window) => {
        const panel = getDocumentElementById(
          window,
          "unified-extensions-panel",
        );
        return isPanelElement(panel)
          ? panel
          : readOwnerPanel(window.gUnifiedExtensions);
      },
      symbol:
        "document.unified-extensions-panel.openPopup.moveToAnchor.hidePopup",
    }),
    defineBrowserToolCapability({
      isAvailable: isEventTarget,
      name: "browser-tools.document-events",
      read: (window) => window.document,
      symbol: "document.addEventListener.removeEventListener",
    }),
  ]);

export const evaluateBrowserToolCapabilities = (
  window: NativeRecord,
): readonly BrowserToolCapabilityEvaluation[] =>
  Object.freeze(
    browserToolCapabilitySpecifications.map((specification) => {
      let available = false;
      let cause: unknown;
      try {
        available = specification.isAvailable(specification.read(window));
      } catch (error) {
        cause = error;
      }
      return Object.freeze({
        ...(cause === undefined ? {} : { cause }),
        snapshot: Object.freeze({
          available,
          name: specification.name,
          requirement: specification.requirement ?? ("required" as const),
          symbol: specification.symbol,
        }),
      });
    }),
  );

export const getErrorContext = (
  boundary: FirefoxBridgeBoundary,
): FirefoxBridgeErrorContext => {
  const snapshot = boundary.snapshot();
  return Object.freeze({
    buildId: snapshot.buildId,
    firefoxVersion: snapshot.firefoxVersion,
    windowKind: snapshot.windowKind,
  });
};

export const createBrowserToolsError = (
  boundary: FirefoxBridgeBoundary,
  code: string,
  phase: string,
  symbol: string,
  cause?: unknown,
): FirefoxBridgeError =>
  new FirefoxBridgeError({
    cause,
    code,
    context: getErrorContext(boundary),
    phase,
    symbol,
  });

export const createSnapshot = (
  evaluations: readonly BrowserToolCapabilityEvaluation[],
): BrowserToolsSnapshot => {
  const available = (name: string): boolean =>
    evaluations.some(
      (evaluation) =>
        evaluation.snapshot.name === name && evaluation.snapshot.available,
    );
  return Object.freeze({
    applicationMenu: available("browser-tools.application-menu"),
    customize: available("browser-tools.customize"),
    downloads:
      available("browser-tools.downloads-initialize") &&
      available("browser-tools.downloads-panel"),
    extensions: available("browser-tools.unified-extensions"),
    nativeToolbar: available("browser-tools.native-toolbar-focus"),
    protections:
      available("browser-tools.trust-panel") &&
      available("browser-tools.protections-anchor"),
    settings: available("browser-tools.settings"),
    siteInformation:
      available("browser-tools.trust-panel") &&
      available("browser-tools.identity-anchor"),
    sitePermissions: available("browser-tools.permission-open-popup"),
    translate: available("browser-tools.full-page-translations"),
  });
};

export const isPanelOpen = (panel: NativeRecord): boolean => {
  const state = panel.state;
  if (state === "open" || state === "showing") {
    return true;
  }
  const getAttribute = panel.getAttribute;
  if (!isFunction(getAttribute)) {
    return false;
  }
  const attributed = Reflect.apply(getAttribute, panel, ["state"]);
  return attributed === "open" || attributed === "showing";
};

export const getPopupFromEvent = (event: unknown): NativeRecord | null => {
  if (!isNativeRecord(event)) {
    return null;
  }
  if (isNativeRecord(event.originalTarget)) {
    return event.originalTarget;
  }
  return isNativeRecord(event.target) ? event.target : null;
};
