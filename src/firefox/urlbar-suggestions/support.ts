// SPDX-License-Identifier: MPL-2.0
import type {
  UrlbarSuggestionExecutionKind,
  UrlbarSuggestionResult,
  UrlbarSuggestionResultSource,
  UrlbarSuggestionResultType,
} from "../../app/urlbar-suggestions-state.ts";
import {
  maximumUrlbarSuggestionDescriptionLength,
  maximumUrlbarSuggestionIconLength,
  maximumUrlbarSuggestionTitleLength,
} from "../../app/urlbar-suggestions-state.ts";
import {
  FirefoxBridgeError,
  type FirefoxBridgeBoundary,
  type FirefoxBridgeErrorContext,
  type FirefoxCapabilitySnapshot,
} from "../bridge-boundary.ts";

export type NativeRecord = Record<PropertyKey, unknown>;
export type NativeFunction = (...args: unknown[]) => unknown;
export type NativeUrlbarResult = NativeRecord & {
  getDisplayableValueAndHighlights?: NativeFunction;
  heuristic?: boolean;
  icon?: unknown;
  payload?: unknown;
  source?: unknown;
  type?: unknown;
};
export type NativeProvidersManager = NativeRecord & {
  cancelQuery: NativeFunction;
  startQuery: NativeFunction;
};
export type NativeUrlbarController = NativeRecord;
export type NativeUrlbarInput = NativeRecord & {
  controller: NativeUrlbarController;
  handleRevert: NativeFunction;
  pickResult: NativeFunction;
  startQuery: NativeFunction;
  value: string;
  view: NativeRecord;
};
export type UrlbarSuggestionOwners = Readonly<{
  input: NativeUrlbarInput;
  manager: NativeProvidersManager;
  nativeController: NativeUrlbarController;
  parentController: NativeUrlbarController;
  selectedBrowser: NativeRecord;
}>;

export type UrlbarSuggestionsCapabilityEvaluation = Readonly<{
  cause?: unknown;
  snapshot: FirefoxCapabilitySnapshot;
}>;

export const RESULT_TYPE = Object.freeze({
  TAB_SWITCH: 1,
  SEARCH: 2,
  URL: 3,
  KEYWORD: 4,
  OMNIBOX: 5,
  REMOTE_TAB: 6,
  TIP: 7,
  DYNAMIC: 8,
  RESTRICT: 9,
  AI_CHAT: 10,
});

export const RESULT_SOURCE = Object.freeze({
  BOOKMARKS: 1,
  HISTORY: 2,
  SEARCH: 3,
  TABS: 4,
  OTHER_LOCAL: 5,
  OTHER_NETWORK: 6,
  ADDON: 7,
  ACTIONS: 8,
});

const resultTypeByValue: Readonly<Record<number, UrlbarSuggestionResultType>> =
  Object.freeze({
    [RESULT_TYPE.TAB_SWITCH]: "tab-switch",
    [RESULT_TYPE.SEARCH]: "search",
    [RESULT_TYPE.URL]: "url",
    [RESULT_TYPE.KEYWORD]: "keyword",
    [RESULT_TYPE.OMNIBOX]: "omnibox",
    [RESULT_TYPE.REMOTE_TAB]: "remote-tab",
    [RESULT_TYPE.TIP]: "tip",
    [RESULT_TYPE.DYNAMIC]: "dynamic",
    [RESULT_TYPE.RESTRICT]: "restrict",
    [RESULT_TYPE.AI_CHAT]: "ai-chat",
  });

const resultSourceByValue: Readonly<
  Record<number, UrlbarSuggestionResultSource>
> = Object.freeze({
  [RESULT_SOURCE.BOOKMARKS]: "bookmarks",
  [RESULT_SOURCE.HISTORY]: "history",
  [RESULT_SOURCE.SEARCH]: "search",
  [RESULT_SOURCE.TABS]: "tabs",
  [RESULT_SOURCE.OTHER_LOCAL]: "other-local",
  [RESULT_SOURCE.OTHER_NETWORK]: "other-network",
  [RESULT_SOURCE.ADDON]: "addon",
  [RESULT_SOURCE.ACTIONS]: "actions",
});

const directResultTypes = new Set<number>([
  RESULT_TYPE.TAB_SWITCH,
  RESULT_TYPE.SEARCH,
  RESULT_TYPE.URL,
  RESULT_TYPE.KEYWORD,
  RESULT_TYPE.OMNIBOX,
  RESULT_TYPE.REMOTE_TAB,
]);

export const isNativeRecord = (value: unknown): value is NativeRecord =>
  (typeof value === "object" && value !== null) || typeof value === "function";

export const isFunction = (value: unknown): value is NativeFunction =>
  typeof value === "function";

const isConstructor = (value: unknown): value is NativeFunction =>
  typeof value === "function";

const isView = (value: unknown): value is NativeRecord =>
  isNativeRecord(value) &&
  isFunction(value.close) &&
  isFunction(value.telemetryTypeFromElement);

const isInput = (value: unknown): value is NativeUrlbarInput =>
  isNativeRecord(value) &&
  typeof value.value === "string" &&
  isNativeRecord(value.controller) &&
  isView(value.view) &&
  isFunction(value.startQuery) &&
  isFunction(value.pickResult) &&
  isFunction(value.handleRevert);

const readParentController = (
  controller: NativeUrlbarController,
): NativeUrlbarController => {
  const candidate = controller.parentController;
  return isNativeRecord(candidate) ? candidate : controller;
};

const isManager = (value: unknown): value is NativeProvidersManager =>
  isNativeRecord(value) &&
  isFunction(value.startQuery) &&
  isFunction(value.cancelQuery);

export const resolveUrlbarSuggestionOwners = (
  window: NativeRecord,
): UrlbarSuggestionOwners | null => {
  const input = window.gURLBar;
  const browser = window.gBrowser;
  if (!isInput(input) || !isNativeRecord(browser)) {
    return null;
  }
  const nativeController = input.controller;
  const parentController = readParentController(nativeController);
  const manager = parentController.manager;
  const selectedBrowser = browser.selectedBrowser;
  if (!isManager(manager) || !isNativeRecord(selectedBrowser)) {
    return null;
  }
  return Object.freeze({
    input,
    manager,
    nativeController,
    parentController,
    selectedBrowser,
  });
};

const capabilityDefinitions = Object.freeze([
  Object.freeze({
    isAvailable: isInput,
    name: "firefox.urlbar-suggestions-input",
    read: (window: NativeRecord) => window.gURLBar,
    symbol: "window.gURLBar.startQuery",
  }),
  Object.freeze({
    isAvailable: (value: unknown) => {
      if (!isNativeRecord(value)) {
        return false;
      }
      const parent = readParentController(value);
      return isManager(parent.manager);
    },
    name: "firefox.urlbar-suggestions-manager",
    read: (window: NativeRecord) =>
      isNativeRecord(window.gURLBar) ? window.gURLBar.controller : undefined,
    symbol: "window.gURLBar.controller.parentController.manager.startQuery",
  }),
  Object.freeze({
    isAvailable: isNativeRecord,
    name: "firefox.urlbar-suggestions-selected-browser",
    read: (window: NativeRecord) =>
      isNativeRecord(window.gBrowser)
        ? window.gBrowser.selectedBrowser
        : undefined,
    symbol: "window.gBrowser.selectedBrowser",
  }),
  Object.freeze({
    isAvailable: isConstructor,
    name: "firefox.urlbar-suggestions-keyboard-event",
    read: (window: NativeRecord) => window.KeyboardEvent,
    symbol: "window.KeyboardEvent",
  }),
  Object.freeze({
    isAvailable: isConstructor,
    name: "firefox.urlbar-suggestions-mouse-event",
    read: (window: NativeRecord) => window.MouseEvent,
    symbol: "window.MouseEvent",
  }),
]);

export const evaluateUrlbarSuggestionsCapabilities = (
  window: NativeRecord,
): readonly UrlbarSuggestionsCapabilityEvaluation[] =>
  Object.freeze(
    capabilityDefinitions.map((definition) => {
      let available = false;
      let cause: unknown;
      try {
        available = definition.isAvailable(definition.read(window));
      } catch (error) {
        cause = error;
      }
      return Object.freeze({
        ...(cause === undefined ? {} : { cause }),
        snapshot: Object.freeze({
          available,
          name: definition.name,
          requirement: "required" as const,
          symbol: definition.symbol,
        }),
      });
    }),
  );

const getErrorContext = (
  boundary: FirefoxBridgeBoundary,
): FirefoxBridgeErrorContext => {
  const snapshot = boundary.snapshot();
  return Object.freeze({
    buildId: snapshot.buildId,
    firefoxVersion: snapshot.firefoxVersion,
    windowKind: snapshot.windowKind,
  });
};

export const createUrlbarSuggestionsError = (
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

const boundText = (value: unknown, maximumLength: number): string => {
  if (typeof value !== "string") {
    return "";
  }
  let bounded = "";
  for (const character of value.slice(0, maximumLength)) {
    const code = character.charCodeAt(0);
    bounded +=
      code <= 8 ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127
        ? " "
        : character;
  }
  return bounded;
};

const readPayload = (result: NativeUrlbarResult): NativeRecord =>
  isNativeRecord(result.payload) ? result.payload : Object.create(null);

const readDisplayValue = (
  result: NativeUrlbarResult,
  name: string,
  isURL = false,
): string => {
  if (!isFunction(result.getDisplayableValueAndHighlights)) {
    return "";
  }
  try {
    const candidate = Reflect.apply(
      result.getDisplayableValueAndHighlights,
      result,
      [name, ...(isURL ? [{ isURL: true }] : [])],
    );
    return isNativeRecord(candidate) ? boundText(candidate.value, 2_048) : "";
  } catch {
    return "";
  }
};

const firstText = (
  values: readonly unknown[],
  maximumLength: number,
): string => {
  for (const value of values) {
    const text = boundText(value, maximumLength);
    if (text.length > 0) {
      return text;
    }
  }
  return "";
};

const readIcon = (result: NativeUrlbarResult): string | null => {
  let candidate: unknown;
  try {
    candidate = result.icon;
  } catch {
    return null;
  }
  if (
    typeof candidate !== "string" ||
    candidate.length === 0 ||
    candidate.length > maximumUrlbarSuggestionIconLength
  ) {
    return null;
  }
  const icon = boundText(candidate, maximumUrlbarSuggestionIconLength);
  if (icon !== candidate) {
    return null;
  }
  if (
    /^(?:chrome|resource|moz-extension|page-icon|moz-page-thumb):/iu.test(
      icon,
    ) ||
    /^data:image\/(?:png|gif|jpeg|webp);base64,[a-z0-9+/=]+$/iu.test(icon)
  ) {
    return icon;
  }
  return null;
};

const mapType = (value: unknown): UrlbarSuggestionResultType =>
  Number.isInteger(value)
    ? (resultTypeByValue[value as number] ?? "unknown")
    : "unknown";

const mapSource = (value: unknown): UrlbarSuggestionResultSource =>
  Number.isInteger(value)
    ? (resultSourceByValue[value as number] ?? "unknown")
    : "unknown";

const classifyExecution = (
  result: NativeUrlbarResult,
  firefoxVersion: string,
): UrlbarSuggestionExecutionKind => {
  // Firefox 155 waits for search-mode application before starting its next
  // query (Bug 2060686). That continuation outlives the synchronous input
  // proxy, so let the complete native Urlbar own the transition and its view.
  if (
    Number.parseInt(firefoxVersion, 10) >= 155 &&
    readPayload(result).providesSearchMode
  ) {
    return "native";
  }
  return Number.isInteger(result.type) &&
    directResultTypes.has(result.type as number)
    ? "direct"
    : "native";
};

export const projectUrlbarSuggestionResult = (
  result: NativeUrlbarResult,
  token: string,
  firefoxVersion: string,
): UrlbarSuggestionResult => {
  const payload = readPayload(result);
  const displayTitle = readDisplayValue(result, "title");
  const displayUrl = readDisplayValue(result, "url", true);
  const title = firstText(
    [
      payload.text,
      displayTitle,
      payload.title,
      payload.suggestion,
      payload.query,
      payload.input,
      displayUrl,
      payload.url,
    ],
    maximumUrlbarSuggestionTitleLength,
  );
  const description = firstText(
    [
      payload.description,
      payload.subtitle,
      payload.device,
      payload.engine,
      payload.content,
      displayUrl !== title ? displayUrl : "",
    ],
    maximumUrlbarSuggestionDescriptionLength,
  );
  return Object.freeze({
    description,
    execution: classifyExecution(result, firefoxVersion),
    heuristic: result.heuristic === true,
    icon: readIcon(result),
    source: mapSource(result.source),
    title,
    token,
    type: mapType(result.type),
  });
};
