// SPDX-License-Identifier: MPL-2.0
import type {
  BlockedPermissionIndicatorKind,
  SharingIndicatorKind,
  UrlbarCoverageSnapshot,
  UrlbarItemKind,
} from "../../app/urlbar-coverage-state.ts";
import {
  FirefoxBridgeError,
  type FirefoxBridgeBoundary,
  type FirefoxBridgeErrorContext,
  type FirefoxCapabilitySnapshot,
} from "../bridge-boundary.ts";

export type NativeRecord = Record<string, unknown>;
export type NativeElement = NativeRecord & {
  getAttribute: (name: string) => unknown;
  hasAttribute: (name: string) => boolean;
};
export type NativeDocument = NativeRecord & {
  getElementById: (id: string) => unknown;
};
export type NativeMutationObserver = Readonly<{
  disconnect: () => void;
  observe: (target: object, options: unknown) => void;
}>;
export type NativeMutationObserverConstructor = new (
  callback: (records: readonly unknown[]) => void,
) => NativeMutationObserver;

export type UrlbarCoverageCapabilityEvaluation = Readonly<{
  cause?: unknown;
  snapshot: FirefoxCapabilitySnapshot;
}>;

export type UrlbarCoverageCapabilitySpecification = Readonly<{
  isAvailable: (value: unknown) => boolean;
  name: string;
  read: (window: NativeRecord) => unknown;
  symbol: string;
}>;

export const REQUIRED_ELEMENT_IDS = Object.freeze([
  "blocked-permissions-container",
  "identity-permission-box",
  "page-action-buttons",
] as const);

export const BLOCKED_PERMISSION_KIND_BY_ID: Readonly<
  Record<string, BlockedPermissionIndicatorKind>
> = Object.freeze({
  "autoplay-media": "autoplay",
  camera: "camera",
  canvas: "canvas",
  install: "install",
  "local-network": "local-network",
  geo: "location",
  "loopback-network": "loopback-network",
  microphone: "microphone",
  midi: "midi",
  "desktop-notification": "notifications",
  "persistent-storage": "persistent-storage",
  popup: "popups",
  screen: "screen",
  serial: "serial",
  xr: "xr",
});

export const SHARING_ELEMENT_DEFINITIONS: readonly Readonly<{
  id: string;
  kind: SharingIndicatorKind;
}>[] = Object.freeze([
  Object.freeze({ id: "geo-sharing-icon", kind: "location" }),
  Object.freeze({ id: "webrtc-sharing-icon", kind: "media" }),
  Object.freeze({ id: "serial-sharing-icon", kind: "serial" }),
  Object.freeze({ id: "xr-sharing-icon", kind: "xr" }),
]);

export const STATIC_ITEM_DEFINITIONS: readonly Readonly<{
  id: string;
  kind: UrlbarItemKind;
}>[] = Object.freeze([
  Object.freeze({
    id: "contextual-feature-recommendation",
    kind: "recommendation",
  }),
  Object.freeze({ id: "userContext-icons", kind: "container" }),
  Object.freeze({ id: "reader-mode-button", kind: "reader-view" }),
  Object.freeze({
    id: "picture-in-picture-button",
    kind: "picture-in-picture",
  }),
  Object.freeze({ id: "taskbar-tabs-button", kind: "taskbar-tabs" }),
  Object.freeze({ id: "translations-button", kind: "translations" }),
  Object.freeze({ id: "urlbar-zoom-button", kind: "zoom" }),
  Object.freeze({ id: "split-view-button", kind: "split-view" }),
  Object.freeze({ id: "star-button-box", kind: "bookmark" }),
]);

export const KNOWN_PAGE_ACTION_ELEMENT_IDS = new Set([
  "contextual-feature-recommendation",
  "pageActionButton",
  "picture-in-picture-button",
  "reader-mode-button",
  "split-view-button",
  "star-button-box",
  "taskbar-tabs-button",
  "translations-button",
  "urlbar-zoom-button",
  "userContext-icons",
]);

export const isNativeRecord = (value: unknown): value is NativeRecord =>
  typeof value === "object" && value !== null;

export const isFunction = (
  value: unknown,
): value is (...args: unknown[]) => unknown => typeof value === "function";

export const isNativeElement = (value: unknown): value is NativeElement =>
  isNativeRecord(value) &&
  isFunction(value.getAttribute) &&
  isFunction(value.hasAttribute);

export const isNativeDocument = (value: unknown): value is NativeDocument =>
  isNativeRecord(value) && isFunction(value.getElementById);

export const readDocument = (window: NativeRecord): NativeDocument | null =>
  isNativeDocument(window.document) ? window.document : null;

export const readElement = (window: NativeRecord, id: string): unknown => {
  const document = readDocument(window);
  return document
    ? Reflect.apply(document.getElementById, document, [id])
    : undefined;
};

export const readDocumentElement = (window: NativeRecord): unknown => {
  const document = readDocument(window);
  return document?.documentElement;
};

export const urlbarCoverageCapabilitySpecifications: readonly UrlbarCoverageCapabilitySpecification[] =
  Object.freeze([
    Object.freeze({
      isAvailable: isFunction,
      name: "firefox.urlbar-coverage-native-access",
      read: (window: NativeRecord) => window.openLocation,
      symbol: "window.openLocation",
    }),
    Object.freeze({
      isAvailable: isFunction,
      name: "firefox.urlbar-coverage-mutation-observer",
      read: (window: NativeRecord) => window.MutationObserver,
      symbol: "window.MutationObserver",
    }),
    Object.freeze({
      isAvailable: isNativeElement,
      name: "firefox.urlbar-coverage-urlbar-state",
      read: (window: NativeRecord) => window.gURLBar,
      symbol: "window.gURLBar.hasAttribute",
    }),
    Object.freeze({
      isAvailable: isNativeElement,
      name: "firefox.urlbar-coverage-window-state",
      read: readDocumentElement,
      symbol: "document.documentElement.hasAttribute",
    }),
    ...REQUIRED_ELEMENT_IDS.map((id) =>
      Object.freeze({
        isAvailable: isNativeElement,
        name: `firefox.urlbar-coverage-${id}`,
        read: (window: NativeRecord) => readElement(window, id),
        symbol: `document.elements[${id}]`,
      }),
    ),
  ]);

export const evaluateUrlbarCoverageCapabilities = (
  window: NativeRecord,
  requestNativeUiReveal: () => boolean,
): readonly UrlbarCoverageCapabilityEvaluation[] =>
  Object.freeze([
    ...urlbarCoverageCapabilitySpecifications.map((specification) => {
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
    Object.freeze({
      snapshot: Object.freeze({
        available: isFunction(requestNativeUiReveal),
        name: "firefox.urlbar-coverage-native-ui-handoff",
        requirement: "required" as const,
        symbol: "nativeUi.revealForUrlbar",
      }),
    }),
  ]);

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

export const createUrlbarCoverageError = (
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

export const readAttribute = (
  element: NativeElement,
  name: string,
): string | null => {
  const value = Reflect.apply(element.getAttribute, element, [name]);
  return typeof value === "string" ? value : null;
};

export const hasAttribute = (element: NativeElement, name: string): boolean =>
  Boolean(Reflect.apply(element.hasAttribute, element, [name]));

export const isOwnerVisible = (element: NativeElement): boolean => {
  if (element.hidden === true) {
    return false;
  }
  const hidden = readAttribute(element, "hidden");
  if (hidden !== null && hidden !== "false") {
    return false;
  }
  return readAttribute(element, "collapsed") !== "true";
};

export const readChildren = (element: NativeElement): readonly unknown[] => {
  const children = element.children;
  if (!children || (typeof children !== "object" && !Array.isArray(children))) {
    return Object.freeze([]);
  }
  return Object.freeze(Array.from(children as ArrayLike<unknown>));
};

export const classListContains = (
  element: NativeElement,
  name: string,
): boolean => {
  const classList = element.classList;
  return (
    isNativeRecord(classList) &&
    isFunction(classList.contains) &&
    Boolean(Reflect.apply(classList.contains, classList, [name]))
  );
};

export const snapshotsEqual = (
  left: UrlbarCoverageSnapshot,
  right: UrlbarCoverageSnapshot,
): boolean =>
  left.permissions.available === right.permissions.available &&
  left.permissions.hasPermissions === right.permissions.hasPermissions &&
  left.permissions.blocked.length === right.permissions.blocked.length &&
  left.permissions.blocked.every(
    (kind, index) => kind === right.permissions.blocked[index],
  ) &&
  left.permissions.sharing.length === right.permissions.sharing.length &&
  left.permissions.sharing.every(
    (kind, index) => kind === right.permissions.sharing[index],
  ) &&
  left.items.length === right.items.length &&
  left.items.every((kind, index) => kind === right.items[index]);
