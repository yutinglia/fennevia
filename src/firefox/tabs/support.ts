// SPDX-License-Identifier: MPL-2.0
import type { TabContainerColor, TabSnapshot } from "../../app/tab-state.ts";
import { isTabContainerColor } from "../../app/tab-state.ts";
import {
  FirefoxBridgeError,
  type FirefoxBridgeBoundary,
  type FirefoxBridgeErrorContext,
  type FirefoxCapabilitySnapshot,
} from "../bridge-boundary.ts";

export const TAB_EVENT_TYPES = Object.freeze([
  "TabOpen",
  "TabClose",
  "TabSelect",
  "TabMove",
  "TabPinned",
  "TabUnpinned",
  "TabAttrModified",
]);
export const SNAPSHOT_ATTRIBUTES = new Set([
  "activemedia-blocked",
  "attention",
  "busy",
  "image",
  "label",
  "muted",
  "pictureinpicture",
  "selected",
  "soundplaying",
  "usercontextid",
]);
export const MAX_FAVICON_URL_LENGTH = 262_144;
export const MAXIMUM_SCREEN_COORDINATE = 100_000;
export const CONTEXTUAL_IDENTITY_URI =
  "resource://gre/modules/ContextualIdentityService.sys.mjs";
export const FORBIDDEN_INTERNAL_FAVICON_CHARACTER_PATTERN = /[\s"'<>\\]/u;
export const RASTER_DATA_FAVICON_PATTERN =
  /^data:image\/(?:avif|gif|jpeg|png|vnd\.microsoft\.icon|webp|x-icon);base64,[a-z0-9+/]+={0,2}$/iu;
export const CONTAINER_COLOR_ALIASES: Readonly<
  Record<string, TabContainerColor>
> = Object.freeze({
  toolbar: "gray",
  turquoise: "cyan",
});

export type NativeRecord = Record<string, unknown>;
export type NativeModuleLoader = (uri: string) => unknown;
export type NativeTab = NativeRecord & {
  getAttribute: (name: string) => unknown;
  hasAttribute: (name: string) => boolean;
};
export type NativeIdentityService = NativeRecord & {
  getPublicIdentityFromId: (userContextId: number) => unknown;
  getUserContextLabel?: (userContextId: number) => unknown;
};

export type TabsCapabilityEvaluation = Readonly<{
  cause?: unknown;
  snapshot: FirefoxCapabilitySnapshot;
}>;

export type TabsCapabilitySpecification = Readonly<{
  isAvailable: (value: unknown) => boolean;
  name: string;
  read: (window: NativeRecord) => unknown;
  symbol: string;
}>;

export const isNativeObject = (value: unknown): value is object =>
  (typeof value === "object" && value !== null) || typeof value === "function";

export const isNativeRecord = (value: unknown): value is NativeRecord =>
  typeof value === "object" && value !== null;

export const isFunction = (
  value: unknown,
): value is (...args: unknown[]) => unknown => typeof value === "function";

export const readGBrowser = (window: NativeRecord): unknown => window.gBrowser;

export const readGBrowserMember = (
  window: NativeRecord,
  member: string,
): unknown => {
  const browser = readGBrowser(window);
  return isNativeRecord(browser) ? browser[member] : undefined;
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

export const isNativeTabContextMenu = (value: unknown): value is NativeRecord =>
  isNativeRecord(value) &&
  isFunction(value.openPopup) &&
  isFunction(value.moveTo) &&
  isFunction(value.addEventListener) &&
  isFunction(value.removeEventListener);

export const tabsCapabilitySpecifications: readonly TabsCapabilitySpecification[] =
  Object.freeze([
    Object.freeze({
      isAvailable: Array.isArray,
      name: "firefox.open-tabs",
      read: (window: NativeRecord) => readGBrowserMember(window, "openTabs"),
      symbol: "window.gBrowser.openTabs",
    }),
    Object.freeze({
      isAvailable: isNativeObject,
      name: "firefox.selected-tab",
      read: (window: NativeRecord) => readGBrowserMember(window, "selectedTab"),
      symbol: "window.gBrowser.selectedTab",
    }),
    ...[
      ["add-tab", "addTrustedTab"],
      ["remove-tab", "removeTab"],
      ["pin-tab", "pinTab"],
      ["unpin-tab", "unpinTab"],
      ["move-tab", "moveTabTo"],
      ["translate-tab-context-menu", "translateTabContextMenu"],
    ].map(([name, member]) =>
      Object.freeze({
        isAvailable: isFunction,
        name: `firefox.${name}`,
        read: (window: NativeRecord) => readGBrowserMember(window, member),
        symbol: `window.gBrowser.${member}`,
      }),
    ),
    Object.freeze({
      isAvailable: (value: unknown) =>
        typeof value === "string" && value.length > 0 && value.length <= 2048,
      name: "firefox.new-tab-url",
      read: (window: NativeRecord) => window.BROWSER_NEW_TAB_URL,
      symbol: "window.BROWSER_NEW_TAB_URL",
    }),
    Object.freeze({
      isAvailable: isNativeTabContextMenu,
      name: "firefox.tab-context-menu",
      read: (window: NativeRecord) =>
        getDocumentElementById(window, "tabContextMenu"),
      symbol: "document.tabContextMenu.openPopup.moveTo",
    }),
  ]);

export const evaluateTabsCapabilities = (
  window: NativeRecord,
): readonly TabsCapabilityEvaluation[] =>
  Object.freeze(
    tabsCapabilitySpecifications.map((specification) => {
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
          requirement: "required" as const,
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

export const createTabsError = (
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

export const asNativeTab = (
  boundary: FirefoxBridgeBoundary,
  candidate: unknown,
): NativeTab => {
  if (
    !isNativeRecord(candidate) ||
    typeof candidate.getAttribute !== "function" ||
    typeof candidate.hasAttribute !== "function"
  ) {
    throw createTabsError(
      boundary,
      "FENNEVIA_FIREFOX_TAB_SHAPE_INVALID",
      "firefox-tabs-snapshot",
      "MozTabbrowserTab.getAttribute",
    );
  }
  return candidate as NativeTab;
};

export const sanitizeFaviconUrl = (candidate: unknown): string | undefined => {
  if (typeof candidate !== "string" || candidate.length === 0) {
    return undefined;
  }
  if (
    candidate.length <= 2048 &&
    (candidate.startsWith("chrome://") ||
      candidate.startsWith("resource://") ||
      candidate.startsWith("moz-remote-image:")) &&
    !FORBIDDEN_INTERNAL_FAVICON_CHARACTER_PATTERN.test(candidate)
  ) {
    return candidate;
  }
  if (
    candidate.length <= MAX_FAVICON_URL_LENGTH &&
    RASTER_DATA_FAVICON_PATTERN.test(candidate)
  ) {
    return candidate;
  }
  return undefined;
};

export const snapshotsEqual = (
  left: readonly TabSnapshot[],
  right: readonly TabSnapshot[],
): boolean =>
  left.length === right.length &&
  left.every((tab, index) => {
    const candidate = right[index];
    return (
      candidate !== undefined &&
      tab.id === candidate.id &&
      tab.title === candidate.title &&
      tab.selected === candidate.selected &&
      tab.pinned === candidate.pinned &&
      tab.loading === candidate.loading &&
      tab.faviconUrl === candidate.faviconUrl &&
      tab.audio === candidate.audio &&
      tab.attention === candidate.attention &&
      tab.pictureInPicture === candidate.pictureInPicture &&
      tab.container?.color === candidate.container?.color &&
      tab.container?.label === candidate.container?.label
    );
  });

export const isRelevantAttributeEvent = (event: unknown): boolean => {
  if (!isNativeRecord(event) || !isNativeRecord(event.detail)) {
    return true;
  }
  const changed = event.detail.changed;
  if (
    !Array.isArray(changed) ||
    changed.some((value) => typeof value !== "string")
  ) {
    return true;
  }
  return changed.some((attribute) => SNAPSHOT_ATTRIBUTES.has(attribute));
};

export const resolveContainerColor = (
  value: unknown,
): TabContainerColor | undefined => {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }
  const resolved = CONTAINER_COLOR_ALIASES[value] ?? value;
  return isTabContainerColor(resolved) ? resolved : undefined;
};

export const isTabContextMenuEvent = (
  event: unknown,
  menu: NativeRecord,
): boolean => {
  if (!isNativeRecord(event)) {
    return true;
  }
  if (event.target === undefined) {
    return true;
  }
  return (
    event.target === menu ||
    (isNativeRecord(event.target) && event.target.id === "tabContextMenu")
  );
};
