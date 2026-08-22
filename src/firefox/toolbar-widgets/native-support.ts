// SPDX-License-Identifier: MPL-2.0
import { type FenneviaToolbarAction } from "../../app/toolbar-widgets-state.ts";
import {
  FirefoxBridgeError,
  type FirefoxBridgeBoundary,
  type FirefoxBridgeErrorContext,
  type FirefoxCapabilitySnapshot,
} from "../bridge-boundary.ts";

export type NativeRecord = Record<string, unknown>;

export type NativeNode = NativeRecord & {
  getAttribute: (...args: unknown[]) => unknown;
};

export type NativePanel = NativeRecord & {
  hidePopup: (...args: unknown[]) => unknown;
  moveToAnchor: (...args: unknown[]) => unknown;
};

export type NativeMenuPopup = NativePanel & {
  openPopup: (...args: unknown[]) => unknown;
};

export type ToolbarWidgetCapabilityEvaluation = Readonly<{
  cause?: unknown;
  snapshot: FirefoxCapabilitySnapshot;
}>;

export type ToolbarWidgetCapabilitySpecification = Readonly<{
  isAvailable: (value: unknown) => boolean;
  name: string;
  read: (window: NativeRecord) => unknown;
  requirement: "optional" | "required";
  symbol: string;
}>;

export type CompoundToolbarWidgetPartSpecification = Readonly<{
  displayLabel?: true;
  fallbackLabel: string;
  icon: string;
  nodeId: string;
}>;

export type PendingPanelWaiter = {
  resolve: (opened: boolean) => void;
  timeoutHandle: unknown;
};

export const NAVBAR_AREA = "nav-bar";
export const FALLBACK_ADDONS_AREA = "unified-extensions-area";
export const LAYOUT_PREF = "fennevia.customize.layout";
export const STYLE_PREF = "fennevia.customize.style";
export const CUSTOMIZE_PREF_DOMAIN = "fennevia.customize.";
export const PREF_VALUE_MAX_LENGTH = 16384;
export const PALETTE_MAX_ENTRIES = 256;
export const WIDGET_VIEW_PANEL_ID = "customizationui-widget-panel";
export const PANEL_SHOWN_TIMEOUT_MS = 800;
export const ADOPTED_PANEL_POSITION = "after_start";
export const LABEL_MAX_LENGTH = 200;
export const TOOLTIP_MAX_LENGTH = 300;
export const BADGE_MAX_LENGTH = 8;
export const ICON_URL_MAX_LENGTH = 512;
export const LISTENER_OPTIONS = Object.freeze({ capture: true });
export const COLOR_PATTERN = /^rgba?\([0-9\s.,%]{1,48}\)$/u;
export const QUOTED_CSS_URL_PATTERN = /url\(\s*"((?:[^"\\]|\\.){1,512})"\s*\)/u;
export const SINGLE_QUOTED_CSS_URL_PATTERN =
  /url\(\s*'((?:[^'\\]|\\.){1,512})'\s*\)/u;
export const UNQUOTED_CSS_URL_PATTERN =
  /url\(\s*((?:[^"')\\]|\\.){1,512})\s*\)/u;
export const MOZ_EXTENSION_URL_PREFIX = "moz-extension://";
export const CHROME_URL_PREFIX = "chrome://";
export const RESOURCE_URL_PREFIX = "resource://";
export const EXTENSION_WIDGET_SUFFIX = "-browser-action";
export const FORBIDDEN_ICON_URL_CHARACTER_PATTERN = /["'\\<>\s]/u;
export const WIDGET_ID_SELECTOR_PATTERN = /#([A-Za-z_][\w-]*)/gu;
export const FLUENT_RESOURCE_ID_MAX_LENGTH = 128;
export const FLUENT_RESOURCE_ID_LIMIT = 48;
export const FLUENT_RESOURCE_ID_PATTERN =
  /^(?:branding|browser|toolkit|preview)\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.ftl$/u;
export const LOCALIZATION_KEY_PATTERN =
  /^(?:[A-Za-z][\w-]*\.)?(?:label|tooltiptext\d*)$/u;
export const INCOMPLETE_BUNDLE_FORMAT_PATTERN = /%[0-9$]*[Ssd]/u;

// Placements already represented by fixed Fennevia controls, the native
// downloads-button (users place the Fennevia show-downloads widget instead),
// plus container items that cannot be mirrored as buttons.
export const SKIPPED_WIDGET_IDS = Object.freeze([
  "back-button",
  "forward-button",
  "stop-reload-button",
  "home-button",
  "urlbar-container",
  "search-container",
  "downloads-button",
  "unified-extensions-button",
  "PanelUI-menu-button",
  "personal-bookmarks",
  "menubar-items",
  "tabbrowser-tabs",
]);

export const skippedWidgetIdSet = new Set<string>(SKIPPED_WIDGET_IDS);

// Firefox exposes these compound CustomizableUI entries as one toolbaritem
// whose children are independently actionable. Fennevia keeps each placement
// grouped while projecting opaque handles for its current Firefox-owned parts.
export const compoundToolbarWidgetPartsByWidgetId: ReadonlyMap<
  string,
  readonly CompoundToolbarWidgetPartSpecification[]
> = new Map<string, readonly CompoundToolbarWidgetPartSpecification[]>([
  [
    "zoom-controls",
    Object.freeze([
      Object.freeze({
        fallbackLabel: "Zoom out",
        icon: "zoom-out",
        nodeId: "zoom-out-button",
      }),
      Object.freeze({
        displayLabel: true,
        fallbackLabel: "Reset zoom",
        icon: "zoom",
        nodeId: "zoom-reset-button",
      }),
      Object.freeze({
        fallbackLabel: "Zoom in",
        icon: "zoom-in",
        nodeId: "zoom-in-button",
      }),
    ]),
  ],
  [
    "edit-controls",
    Object.freeze([
      Object.freeze({
        fallbackLabel: "Cut",
        icon: "cut",
        nodeId: "cut-button",
      }),
      Object.freeze({
        fallbackLabel: "Copy",
        icon: "copy",
        nodeId: "copy-button",
      }),
      Object.freeze({
        fallbackLabel: "Paste",
        icon: "paste",
        nodeId: "paste-button",
      }),
    ]),
  ],
  [
    "profiler-button",
    Object.freeze([
      Object.freeze({
        fallbackLabel: "Profiler",
        icon: "developer",
        nodeId: "profiler-button-button",
      }),
      Object.freeze({
        fallbackLabel: "Open the profiler panel",
        icon: "arrow-down",
        nodeId: "profiler-button-dropmarker",
      }),
    ]),
  ],
]);

// Curated icon tokens for known built-in widget ids. The raw widget id never
// crosses the bridge; only the fixed token does.
export const builtinIconTokenByWidgetId: ReadonlyMap<string, string> = new Map([
  ["bookmarks-menu-button", "bookmark"],
  ["developer-button", "developer"],
  ["edit-controls", "edit"],
  ["firefox-view-button", "firefox-view"],
  ["fullscreen-button", "fullscreen"],
  ["fxa-toolbar-menu-button", "account"],
  ["history-panelmenu", "history"],
  ["ipprotection-button", "shield"],
  ["library-button", "library"],
  ["new-window-button", "new-window"],
  ["print-button", "print"],
  ["profiler-button", "developer"],
  ["privatebrowsing-button", "private"],
  ["reset-pbm-toolbar-button", "private"],
  ["screenshot-button", "screenshot"],
  ["sidebar-button", "sidebar"],
  ["zoom-controls", "zoom"],
]);

// Pinned L10nRegistry resource ids for unused-widget labels. Chrome
// `document.l10n` is a DOMLocalization that calls `setAsync()` after the
// initial translation, so `formatMessagesSync` then throws
// `InvalidStateError`. A dedicated `new Localization(ids, true)` stays
// synchronous. Palette nodes are disconnected and often never receive a
// translated `label` attribute. XUL palette widgets such as New Window and
// Full Screen live in `appmenu.ftl`; Screenshot is registered from
// ScreenshotsUtils with `screenshots.ftl`. Extra ids come from the chrome
// document's `link[rel="localization"]` hrefs.
export const TOOLBAR_FLUENT_RESOURCE_IDS: readonly string[] = Object.freeze([
  "browser/browser.ftl",
  "browser/sidebar.ftl",
  "browser/appmenu.ftl",
  "browser/screenshots.ftl",
]);

// Fluent ids for API-provided and unused XUL built-ins that often have no
// translated label until placed. The group wrapper does not expose l10nId.
// `reset-pbm-toolbar-button` is created by ResetPBMPanel with
// `reset-pbm-toolbar-button2` in browser.ftl, not CustomizableWidgets.
export const builtinFluentIdByWidgetId: ReadonlyMap<string, string> = new Map([
  ["bookmarks-menu-button", "bookmarks-menu-button"],
  ["characterencoding-button", "repair-text-encoding-button"],
  ["email-link-button", "toolbar-button-email-link"],
  ["firefox-view-button", "toolbar-button-firefox-view-2"],
  ["fullscreen-button", "appmenuitem-fullscreen"],
  ["import-button", "browser-import-button2"],
  ["library-button", "navbar-library"],
  ["logins-button", "toolbar-button-logins"],
  ["new-window-button", "appmenuitem-new-window"],
  ["open-file-button", "toolbar-button-open-file"],
  ["preferences-button", "toolbar-settings-button"],
  ["print-button", "navbar-print"],
  ["privatebrowsing-button", "toolbar-button-new-private-window"],
  ["reset-pbm-toolbar-button", "reset-pbm-toolbar-button2"],
  ["save-page-button", "toolbar-button-save-page"],
  ["screenshot-button", "screenshot-toolbar-button"],
  ["send-tab-button", "toolbar-button-send-tab"],
  ["share-tab-button", "toolbar-button-share-tab"],
  ["sidebar-button", "show-sidebars"],
  ["sync-button", "toolbar-button-synced-tabs"],
  ["tab-groups-button", "toolbar-button-tab-groups"],
]);

// Pinned Firefox 153/154 `toolbarbutton-icons.css` URLs for unused API widgets
// when CSSOM cannot see the sheet (nested `&` / `@media -moz-pref`, or a
// blocked sheet). Version-specific paths are resolved below.
export const builtinIconUrlByWidgetId: ReadonlyMap<string, string> = new Map([
  ["bookmarks-menu-button", "chrome://browser/skin/bookmark-star-on-tray.svg"],
  ["characterencoding-button", "chrome://browser/skin/characterEncoding.svg"],
  ["copy-button", "chrome://global/skin/icons/edit-copy.svg"],
  ["cut-button", "chrome://browser/skin/edit-cut.svg"],
  ["developer-button", "chrome://global/skin/icons/developer.svg"],
  ["email-link-button", "chrome://browser/skin/mail.svg"],
  ["find-button", "chrome://global/skin/icons/search-glass.svg"],
  ["firefox-view-button", "chrome://browser/skin/firefox-view.svg"],
  ["fullscreen-button", "chrome://browser/skin/fullscreen.svg"],
  [
    "ipprotection-button",
    "chrome://browser/content/ipprotection/assets/states/ipprotection-off.svg",
  ],
  ["library-button", "chrome://browser/skin/library.svg"],
  ["logins-button", "chrome://browser/skin/login.svg"],
  ["new-window-button", "chrome://browser/skin/window.svg"],
  ["open-file-button", "chrome://browser/skin/open.svg"],
  ["panic-button", "chrome://browser/skin/forget.svg"],
  ["paste-button", "chrome://browser/skin/edit-paste.svg"],
  ["preferences-button", "chrome://global/skin/icons/settings.svg"],
  ["print-button", "chrome://global/skin/icons/print.svg"],
  ["profiler-button-button", "chrome://devtools/skin/images/tool-profiler.svg"],
  ["profiler-button-dropmarker", "chrome://global/skin/icons/arrow-down.svg"],
  ["privatebrowsing-button", "chrome://browser/skin/privateBrowsing.svg"],
  ["reset-pbm-toolbar-button", "chrome://browser/skin/flame.svg"],
  ["save-page-button", "chrome://browser/skin/save.svg"],
  ["screenshot-button", "chrome://browser/skin/screenshot.svg"],
  ["share-tab-button", "chrome://browser/skin/share.svg"],
  ["sidebar-button", "chrome://browser/skin/sidebar-collapsed.svg"],
  ["sync-button", "chrome://browser/skin/synced-tabs.svg"],
  ["tab-groups-button", "chrome://browser/skin/tabbrowser/tab-groups.svg"],
  ["zoom-in-button", "chrome://global/skin/icons/plus.svg"],
  ["zoom-out-button", "chrome://global/skin/icons/minus.svg"],
]);

export const resolvePinnedBuiltinIconUrl = (
  widgetId: string,
  firefoxVersion: string,
): string => {
  if (widgetId === "send-tab-button") {
    const majorVersion = Number.parseInt(
      firefoxVersion.split(".", 1)[0] ?? "",
      10,
    );
    return majorVersion >= 154
      ? "chrome://browser/skin/send-tab.svg"
      : "chrome://browser/skin/send-tab-20.svg";
  }
  return builtinIconUrlByWidgetId.get(widgetId) ?? "";
};

// Fixed presentation for Fennevia-owned placeable widgets. The frontend
// executes these actions itself; no Firefox owner is involved.
export const fenneviaWidgetPresentation: ReadonlyMap<
  FenneviaToolbarAction,
  Readonly<{ icon: string; label: string; tooltip: string }>
> = new Map<
  FenneviaToolbarAction,
  Readonly<{ icon: string; label: string; tooltip: string }>
>([
  [
    "show-bookmarks",
    Object.freeze({
      icon: "bookmark",
      label: "Show bookmarks panel",
      tooltip: "Reveal the Fennevia bookmarks panel",
    }),
  ],
  [
    "show-downloads",
    Object.freeze({
      icon: "download",
      label: "Open Firefox downloads",
      tooltip: "Open the Firefox downloads panel",
    }),
  ],
  [
    "show-translate",
    Object.freeze({
      icon: "translate",
      label: "Translate this page",
      tooltip: "Open Firefox built-in translations",
    }),
  ],
]);

export const isNativeRecord = (value: unknown): value is NativeRecord =>
  typeof value === "object" && value !== null;

export const isFunction = (
  value: unknown,
): value is (...args: unknown[]) => unknown => typeof value === "function";

export const isNativeNode = (value: unknown): value is NativeNode =>
  isNativeRecord(value) && isFunction(value.getAttribute);

export const isPanelElement = (value: unknown): value is NativePanel =>
  isNativeRecord(value) &&
  isFunction(value.hidePopup) &&
  isFunction(value.moveToAnchor);

export const isMenuPopupElement = (value: unknown): value is NativeMenuPopup =>
  isPanelElement(value) && isFunction(value.openPopup);

export const boundString = (value: unknown, maxLength: number): string =>
  typeof value === "string" ? value.slice(0, maxLength) : "";

export const readColor = (value: string): string => {
  const candidate = value.trim();
  return COLOR_PATTERN.test(candidate) ? candidate : "";
};

export const readCustomizableUi = (
  window: NativeRecord,
): NativeRecord | null => {
  const candidate = window.CustomizableUI;
  if (
    !isNativeRecord(candidate) ||
    !isFunction(candidate.getWidgetIdsInArea) ||
    !isFunction(candidate.getWidget) ||
    !isFunction(candidate.addListener) ||
    !isFunction(candidate.removeListener)
  ) {
    return null;
  }
  return candidate;
};

export type NativePrefs = NativeRecord & {
  addObserver: (...args: unknown[]) => unknown;
  clearUserPref: (...args: unknown[]) => unknown;
  getStringPref: (...args: unknown[]) => unknown;
  removeObserver: (...args: unknown[]) => unknown;
  setStringPref: (...args: unknown[]) => unknown;
};

export const readPrefs = (window: NativeRecord): NativePrefs | null => {
  const services = window.Services;
  if (!isNativeRecord(services)) {
    return null;
  }
  const prefs = services.prefs;
  if (
    !isNativeRecord(prefs) ||
    !isFunction(prefs.addObserver) ||
    !isFunction(prefs.clearUserPref) ||
    !isFunction(prefs.getStringPref) ||
    !isFunction(prefs.removeObserver) ||
    !isFunction(prefs.setStringPref)
  ) {
    return null;
  }
  return prefs as NativePrefs;
};

export const readStringPref = (prefs: NativePrefs, name: string): string => {
  try {
    const value = Reflect.apply(prefs.getStringPref, prefs, [name, ""]);
    return typeof value === "string" && value.length <= PREF_VALUE_MAX_LENGTH
      ? value
      : "";
  } catch {
    return "";
  }
};

export const readAddonsArea = (customizableUi: NativeRecord): string => {
  try {
    const value = customizableUi.AREA_ADDONS;
    return typeof value === "string" && value !== ""
      ? value
      : FALLBACK_ADDONS_AREA;
  } catch {
    return FALLBACK_ADDONS_AREA;
  }
};

export const isExtensionWidgetId = (
  customizableUi: NativeRecord,
  widgetId: string,
): boolean => {
  if (isFunction(customizableUi.isWebExtensionWidget)) {
    try {
      return (
        Reflect.apply(customizableUi.isWebExtensionWidget, customizableUi, [
          widgetId,
        ]) === true
      );
    } catch {
      // Fall through to the suffix check below.
    }
  }
  return widgetId.endsWith(EXTENSION_WIDGET_SUFFIX);
};

export const readShowSubView = (
  window: NativeRecord,
): ((...args: unknown[]) => unknown) | null => {
  const panelUi = window.PanelUI;
  if (!isNativeRecord(panelUi) || !isFunction(panelUi.showSubView)) {
    return null;
  }
  return panelUi.showSubView;
};

export const toolbarWidgetCapabilitySpecifications: ReadonlyArray<ToolbarWidgetCapabilitySpecification> =
  Object.freeze([
    Object.freeze({
      isAvailable: (value: unknown) => value !== null,
      name: "toolbar-widgets.customizable-ui",
      read: (window: NativeRecord) => readCustomizableUi(window),
      requirement: "optional" as const,
      symbol:
        "window.CustomizableUI.getWidgetIdsInArea.getWidget.addListener.removeListener",
    }),
    Object.freeze({
      isAvailable: (value: unknown) => value !== null,
      name: "toolbar-widgets.panel-ui-sub-view",
      read: (window: NativeRecord) => readShowSubView(window),
      requirement: "optional" as const,
      symbol: "window.PanelUI.showSubView",
    }),
    Object.freeze({
      isAvailable: (value: unknown) => value !== null,
      name: "toolbar-widgets.prefs",
      read: (window: NativeRecord) => readPrefs(window),
      requirement: "optional" as const,
      symbol:
        "window.Services.prefs.getStringPref.setStringPref.clearUserPref.addObserver.removeObserver",
    }),
    Object.freeze({
      isAvailable: (value: unknown) =>
        isNativeRecord(value) &&
        isFunction(value.addEventListener) &&
        isFunction(value.removeEventListener) &&
        isFunction(value.getElementById),
      name: "toolbar-widgets.document-events",
      read: (window: NativeRecord) => window.document,
      requirement: "required" as const,
      symbol: "document.addEventListener.removeEventListener.getElementById",
    }),
  ]);

export const evaluateToolbarWidgetCapabilities = (
  window: NativeRecord,
): readonly ToolbarWidgetCapabilityEvaluation[] =>
  Object.freeze(
    toolbarWidgetCapabilitySpecifications.map((specification) => {
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
          requirement: specification.requirement,
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

export const createToolbarWidgetsError = (
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
