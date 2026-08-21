// SPDX-License-Identifier: MPL-2.0
import type {
  AddressPopupOpenRequest,
  AddressSubmissionResult,
  ConnectionSecurityState,
  NavigationSnapshot,
} from "../../app/navigation-state.ts";
import {
  FirefoxBridgeError,
  type FirefoxBridgeBoundary,
  type FirefoxBridgeErrorContext,
  type FirefoxCapabilitySnapshot,
} from "../bridge-boundary.ts";

export const COMMANDS = Object.freeze({
  back: Object.freeze({ id: "Browser:Back", method: "back" }),
  forward: Object.freeze({ id: "Browser:Forward", method: "forward" }),
  newTab: Object.freeze({
    id: "cmd_newNavigatorTabNoEvent",
    method: "openTab",
  }),
  reload: Object.freeze({ id: "Browser:Reload", method: "reload" }),
  stop: Object.freeze({ id: "Browser:Stop", method: "stop" }),
});
export const NAVIGATION_TAB_EVENT_TYPES = Object.freeze([
  "TabSelect",
  "TabAttrModified",
]);
export const NAVIGATION_TAB_ATTRIBUTES = new Set(["busy", "label", "selected"]);
export const OPEN_LOCATION_COMMAND_ID = "Browser:OpenLocation";
export const OPEN_LOCATION_KEY_ID = "focusURLBar";
export const SHELL_HEALTH_ATTRIBUTE = "data-fennevia-healthy";
export const ADDRESS_POPUP_OPEN_REQUEST: AddressPopupOpenRequest =
  Object.freeze({
    selectAll: true,
    source: "ctrl-l",
    type: "address-popup-open",
  });
export const ACCEPTED_ADDRESS_SUBMISSION: AddressSubmissionResult =
  Object.freeze({
    status: "accepted",
  });
export const EMPTY_ADDRESS_SUBMISSION: AddressSubmissionResult = Object.freeze({
  reason: "empty",
  status: "rejected",
});
export const LONG_ADDRESS_SUBMISSION: AddressSubmissionResult = Object.freeze({
  reason: "too-long",
  status: "rejected",
});
export const UNSAFE_ADDRESS_SUBMISSION: AddressSubmissionResult = Object.freeze(
  {
    reason: "unsafe-scheme",
    status: "rejected",
  },
);
export const EXECUTABLE_SCHEME_PATTERN =
  /^\s*(?:data|javascript|vbscript)\s*:/iu;
export const HIDDEN_COMMITTED_LOCATIONS = new Set([
  "about:blank",
  "about:home",
  "about:newtab",
  "about:privatebrowsing",
]);
export const CONNECTION_SECURITY_MAP: Readonly<
  Record<string, ConnectionSecurityState>
> = Object.freeze({
  associated: "associated",
  "cert-error-page": "certificate-error",
  chrome: "internal",
  extension: "extension",
  file: "local",
  "https-only-error-page": "https-only-error",
  "net-error-page": "network-error",
  "not-secure": "not-secure",
  secure: "secure",
  "secure-cert-user-overridden": "secure-certificate-override",
  "secure-etsi": "secure-qualified-certificate",
  "secure-ev": "secure-verified-organization",
});

export const getCommandSymbol = (id: string): string =>
  `document.commands[${id.replaceAll(":", "-")}]`;

export type NativeRecord = Record<string, unknown>;
export type NativeCommand = NativeRecord & {
  hasAttribute: (name: string) => boolean;
};
export type NativeUrlbar = NativeRecord & {
  getAttribute: (name: string) => unknown;
  handleCommand: () => unknown;
  value: string;
};
export type NativeIdentityHandler = NativeRecord & {
  getConnectionSecurityInformation: () => unknown;
};
export type NativeProtectionsHandler = NativeRecord & {
  anyBlocking?: boolean;
  anyDetected?: boolean;
  hasException?: boolean;
  onContentBlockingEvent: (...args: unknown[]) => unknown;
};
export type NativeContentBlockingAllowList = NativeRecord & {
  canHandle: (browser: unknown) => unknown;
};
export type NativeTab = NativeRecord & {
  getAttribute: (name: string) => unknown;
};
export type NativeMutationObserver = Readonly<{
  disconnect: () => void;
  observe: (target: object, options: unknown) => void;
}>;
export type NativeMutationObserverConstructor = new (
  callback: (records: readonly unknown[]) => void,
) => NativeMutationObserver;

export type NavigationCapabilityEvaluation = Readonly<{
  cause?: unknown;
  snapshot: FirefoxCapabilitySnapshot;
}>;

export type NavigationCapabilitySpecification = Readonly<{
  isAvailable: (value: unknown) => boolean;
  name: string;
  read: (window: NativeRecord) => unknown;
  symbol: string;
}>;

export const isNativeRecord = (value: unknown): value is NativeRecord =>
  typeof value === "object" && value !== null;

export const isFunction = (
  value: unknown,
): value is (...args: unknown[]) => unknown => typeof value === "function";

export const isEventTarget = (
  value: unknown,
): value is NativeRecord &
  Readonly<{
    addEventListener: (...args: unknown[]) => unknown;
    removeEventListener: (...args: unknown[]) => unknown;
  }> =>
  isNativeRecord(value) &&
  isFunction(value.addEventListener) &&
  isFunction(value.removeEventListener);

export const readGBrowser = (window: NativeRecord): unknown => window.gBrowser;

export const readGBrowserMember = (
  window: NativeRecord,
  member: string,
): unknown => {
  const browser = readGBrowser(window);
  return isNativeRecord(browser) ? browser[member] : undefined;
};

export const readSelectedBrowserMember = (
  window: NativeRecord,
  member: string,
): unknown => {
  const selectedBrowser = readGBrowserMember(window, "selectedBrowser");
  return isNativeRecord(selectedBrowser) ? selectedBrowser[member] : undefined;
};

export const readBrowserCommandsMember = (
  window: NativeRecord,
  member: string,
): unknown => {
  const commands = window.BrowserCommands;
  return isNativeRecord(commands) ? commands[member] : undefined;
};

export const readUrlbarMember = (
  window: NativeRecord,
  member: string,
): unknown => {
  const urlbar = window.gURLBar;
  return isNativeRecord(urlbar) ? urlbar[member] : undefined;
};

export const readWindowMember = (
  window: NativeRecord,
  member: string,
): unknown => window[member];

export const readDocumentElement = (window: NativeRecord): unknown => {
  const document = window.document;
  return isNativeRecord(document) ? document.documentElement : undefined;
};

export const readDocumentCommand = (
  window: NativeRecord,
  id: string,
): unknown => {
  const document = window.document;
  if (!isNativeRecord(document) || !isFunction(document.getElementById)) {
    return undefined;
  }
  return Reflect.apply(document.getElementById, document, [id]);
};

export const isCommand = (value: unknown): value is NativeCommand =>
  isNativeRecord(value) && isFunction(value.hasAttribute);

export const isUrlbar = (value: unknown): value is NativeUrlbar =>
  isEventTarget(value) &&
  typeof value.value === "string" &&
  isFunction(value.getAttribute) &&
  isFunction(value.handleCommand);

export const isIdentityHandler = (
  value: unknown,
): value is NativeIdentityHandler =>
  isNativeRecord(value) && isFunction(value.getConnectionSecurityInformation);

export const isProtectionsHandler = (
  value: unknown,
): value is NativeProtectionsHandler =>
  isNativeRecord(value) && isFunction(value.onContentBlockingEvent);

export const isContentBlockingAllowList = (
  value: unknown,
): value is NativeContentBlockingAllowList =>
  isNativeRecord(value) && isFunction(value.canHandle);

export const isSelectedBrowserNavigationShape = (
  value: unknown,
): value is NativeRecord &
  Readonly<{ canGoBack: boolean; canGoForward: boolean }> =>
  isNativeRecord(value) &&
  typeof value.canGoBack === "boolean" &&
  typeof value.canGoForward === "boolean";

export const isCurrentUri = (
  value: unknown,
): value is NativeRecord & Readonly<{ displaySpec?: string; spec?: string }> =>
  isNativeRecord(value) &&
  (typeof value.displaySpec === "string" || typeof value.spec === "string");

export const navigationCapabilitySpecifications: readonly NavigationCapabilitySpecification[] =
  Object.freeze([
    Object.freeze({
      isAvailable: isSelectedBrowserNavigationShape,
      name: "firefox.navigation-selected-browser",
      read: (window: NativeRecord) =>
        readGBrowserMember(window, "selectedBrowser"),
      symbol: "window.gBrowser.selectedBrowser.canGoBack",
    }),
    Object.freeze({
      isAvailable: isCurrentUri,
      name: "firefox.navigation-current-uri",
      read: (window: NativeRecord) =>
        readSelectedBrowserMember(window, "currentURI"),
      symbol: "window.gBrowser.selectedBrowser.currentURI.displaySpec",
    }),
    Object.freeze({
      isAvailable: isFunction,
      name: "firefox.navigation-selected-browser-focus",
      read: (window: NativeRecord) =>
        readSelectedBrowserMember(window, "focus"),
      symbol: "window.gBrowser.selectedBrowser.focus",
    }),
    Object.freeze({
      isAvailable: (value: unknown) =>
        isNativeRecord(value) && isFunction(value.getAttribute),
      name: "firefox.navigation-selected-tab",
      read: (window: NativeRecord) => readGBrowserMember(window, "selectedTab"),
      symbol: "window.gBrowser.selectedTab.getAttribute",
    }),
    Object.freeze({
      isAvailable: isEventTarget,
      name: "firefox.navigation-tab-events",
      read: (window: NativeRecord) =>
        readGBrowserMember(window, "tabContainer"),
      symbol: "window.gBrowser.tabContainer",
    }),
    ...[
      ["add-progress-listener", "addTabsProgressListener"],
      ["remove-progress-listener", "removeTabsProgressListener"],
    ].map(([name, member]) =>
      Object.freeze({
        isAvailable: isFunction,
        name: `firefox.navigation-${name}`,
        read: (window: NativeRecord) => readGBrowserMember(window, member),
        symbol: `window.gBrowser.${member}`,
      }),
    ),
    Object.freeze({
      isAvailable: isFunction,
      name: "firefox.navigation-mutation-observer",
      read: (window: NativeRecord) => window.MutationObserver,
      symbol: "window.MutationObserver",
    }),
    Object.freeze({
      isAvailable: (value: unknown) => typeof value === "string",
      name: "firefox.navigation-urlbar-value",
      read: (window: NativeRecord) => readUrlbarMember(window, "value"),
      symbol: "window.gURLBar.value",
    }),
    Object.freeze({
      isAvailable: isFunction,
      name: "firefox.navigation-urlbar-submission",
      read: (window: NativeRecord) => readUrlbarMember(window, "handleCommand"),
      symbol: "window.gURLBar.handleCommand",
    }),
    Object.freeze({
      isAvailable: isFunction,
      name: "firefox.navigation-urlbar-proxy-state",
      read: (window: NativeRecord) => readUrlbarMember(window, "getAttribute"),
      symbol: "window.gURLBar.getAttribute",
    }),
    Object.freeze({
      isAvailable: isIdentityHandler,
      name: "firefox.navigation-connection-security",
      read: (window: NativeRecord) =>
        readWindowMember(window, "gIdentityHandler"),
      symbol: "window.gIdentityHandler.getConnectionSecurityInformation",
    }),
    Object.freeze({
      isAvailable: isProtectionsHandler,
      name: "firefox.navigation-tracking-protection",
      read: (window: NativeRecord) =>
        readWindowMember(window, "gProtectionsHandler"),
      symbol: "window.gProtectionsHandler.onContentBlockingEvent",
    }),
    Object.freeze({
      isAvailable: isContentBlockingAllowList,
      name: "firefox.navigation-tracking-protection-availability",
      read: (window: NativeRecord) =>
        readWindowMember(window, "ContentBlockingAllowList"),
      symbol: "window.ContentBlockingAllowList.canHandle",
    }),
    Object.freeze({
      isAvailable: (value: unknown) => isCommand(value) && isEventTarget(value),
      name: "firefox.navigation-open-location-command",
      read: (window: NativeRecord) =>
        readDocumentCommand(window, OPEN_LOCATION_COMMAND_ID),
      symbol: getCommandSymbol(OPEN_LOCATION_COMMAND_ID),
    }),
    Object.freeze({
      isAvailable: (value: unknown) =>
        isNativeRecord(value) && isFunction(value.hasAttribute),
      name: "firefox.navigation-shell-health-gate",
      read: readDocumentElement,
      symbol: "document.documentElement.hasAttribute",
    }),
    ...Object.values(COMMANDS).flatMap(({ id, method }) => [
      Object.freeze({
        isAvailable: isCommand,
        name: `firefox.navigation-command-${method}`,
        read: (window: NativeRecord) => readDocumentCommand(window, id),
        symbol: getCommandSymbol(id),
      }),
      Object.freeze({
        isAvailable: isFunction,
        name: `firefox.navigation-action-${method}`,
        read: (window: NativeRecord) =>
          readBrowserCommandsMember(window, method),
        symbol: `window.BrowserCommands.${method}`,
      }),
    ]),
    Object.freeze({
      isAvailable: isFunction,
      name: "firefox.navigation-action-home",
      read: (window: NativeRecord) => readBrowserCommandsMember(window, "home"),
      symbol: "window.BrowserCommands.home",
    }),
    Object.freeze({
      isAvailable: isFunction,
      name: "firefox.navigation-action-reloadOrDuplicate",
      read: (window: NativeRecord) =>
        readBrowserCommandsMember(window, "reloadOrDuplicate"),
      symbol: "window.BrowserCommands.reloadOrDuplicate",
    }),
  ]);

export const evaluateNavigationCapabilities = (
  window: NativeRecord,
): readonly NavigationCapabilityEvaluation[] =>
  Object.freeze(
    navigationCapabilitySpecifications.map((specification) => {
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

export const createNavigationError = (
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

export const snapshotsEqual = (
  left: NavigationSnapshot,
  right: NavigationSnapshot,
): boolean =>
  left.addressValue === right.addressValue &&
  left.canGoBack === right.canGoBack &&
  left.canGoForward === right.canGoForward &&
  left.connectionSecurity === right.connectionSecurity &&
  left.displayUri === right.displayUri &&
  left.loading === right.loading &&
  left.title === right.title &&
  left.trackingProtection === right.trackingProtection;

export const isRelevantTabAttributeEvent = (event: unknown): boolean => {
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
  return changed.some((attribute) => NAVIGATION_TAB_ATTRIBUTES.has(attribute));
};
