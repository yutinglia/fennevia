// SPDX-License-Identifier: MPL-2.0
import type { BookmarkNodeKind } from "../../app/bookmark-state.ts";
import {
  bookmarkFaviconDataUrlPattern,
  maximumBookmarkFaviconUrlLength,
  maximumBookmarkTitleLength,
} from "../../app/bookmark-state.ts";
import {
  FirefoxBridgeError,
  type FirefoxBridgeBoundary,
  type FirefoxBridgeErrorContext,
  type FirefoxCapabilitySnapshot,
} from "../bridge-boundary.ts";

export const PLACES_UTILS_URI = "resource://gre/modules/PlacesUtils.sys.mjs";
export const PLACES_UI_UTILS_URI =
  "moz-src:///browser/components/places/PlacesUIUtils.sys.mjs";
export const BOOKMARK_EVENT_TYPES = Object.freeze([
  "bookmark-added",
  "bookmark-removed",
  "bookmark-moved",
  "bookmark-title-changed",
  "bookmark-url-changed",
  "favicon-changed",
]);
export const MAXIMUM_EVENT_PARENTS = 16;
export const MAXIMUM_EVENT_BATCH = 128;
export const MAXIMUM_QUERY_OFFSET = 1_000_000;
export const GUID_PATTERN = /^[A-Za-z0-9_-]{12}$/u;
export const UNSUPPORTED_SCHEMES = new Set([
  "data:",
  "javascript:",
  "place:",
  "vbscript:",
]);

export type NativeRecord = Record<string, unknown>;
export type NativeModuleLoader = (uri: string) => unknown;
export type NativeBookmarkHandle = Readonly<{ guid: string }>;
export type NativeBookmarkRecord = NativeRecord & {
  childCount?: unknown;
  guid: string;
  index: number;
  parentGuid: string;
  title: string;
  type: number;
  url?: unknown;
};
export type NativeBookmarks = NativeRecord & {
  TYPE_BOOKMARK: number;
  TYPE_FOLDER: number;
  TYPE_SEPARATOR: number;
  fetch: (...args: unknown[]) => Promise<unknown>;
  getLocalizedTitle: (record: NativeBookmarkRecord) => unknown;
  userContentRoots: readonly string[];
};
export type NativePlacesObservers = NativeRecord & {
  addListener: (
    eventTypes: readonly string[],
    listener: (events: unknown) => void,
  ) => void;
  removeListener: (
    eventTypes: readonly string[],
    listener: (events: unknown) => void,
  ) => void;
};
export type NativePlacesUtils = NativeRecord & {
  bookmarks: NativeBookmarks;
  favicons?: NativeRecord & {
    getFaviconForPage: (...args: unknown[]) => Promise<unknown>;
  };
  observers: NativePlacesObservers;
};
export type NativePlacesUIUtils = NativeRecord & {
  openNodeIn: (
    node: unknown,
    where: "current" | "tab",
    view: NativeRecord,
    isPrivate: boolean,
  ) => unknown;
  promiseNodeLikeFromFetchInfo: (
    record: NativeBookmarkRecord,
  ) => Promise<unknown>;
};

export type BookmarksCapabilityEvaluation = Readonly<{
  cause?: unknown;
  snapshot: FirefoxCapabilitySnapshot;
}>;

export type BookmarksCapabilitySpecification = Readonly<{
  isAvailable: (value: unknown) => boolean;
  name: string;
  read: () => unknown;
  requirement?: "optional" | "required";
  symbol: string;
}>;

export const isNativeRecord = (value: unknown): value is NativeRecord =>
  typeof value === "object" && value !== null;

export const isFunction = (
  value: unknown,
): value is (...args: unknown[]) => unknown => typeof value === "function";

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

export const createBookmarksError = (
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

export const requireGuid = (
  boundary: FirefoxBridgeBoundary,
  value: unknown,
  phase: string,
  symbol: string,
): string => {
  if (typeof value !== "string" || !GUID_PATTERN.test(value)) {
    throw createBookmarksError(
      boundary,
      "FENNEVIA_FIREFOX_BOOKMARK_GUID_INVALID",
      phase,
      symbol,
    );
  }
  return value;
};

export const truncateTitle = (value: string): string => {
  let result = "";
  let count = 0;
  for (const character of value) {
    if (count >= maximumBookmarkTitleLength) {
      break;
    }
    result += character;
    count += 1;
  }
  return result;
};

export const sanitizeBookmarkFaviconUrl = (
  candidate: unknown,
): string | undefined =>
  typeof candidate === "string" &&
  candidate.length <= maximumBookmarkFaviconUrlLength &&
  bookmarkFaviconDataUrlPattern.test(candidate)
    ? candidate
    : undefined;

export const asBookmarkRecord = (
  boundary: FirefoxBridgeBoundary,
  candidate: unknown,
  bookmarks: NativeBookmarks,
  phase: string,
  expectedGuid?: string,
): NativeBookmarkRecord => {
  if (
    !isNativeRecord(candidate) ||
    typeof candidate.guid !== "string" ||
    typeof candidate.parentGuid !== "string" ||
    typeof candidate.index !== "number" ||
    !Number.isSafeInteger(candidate.index) ||
    candidate.index < 0 ||
    typeof candidate.type !== "number" ||
    typeof candidate.title !== "string"
  ) {
    throw createBookmarksError(
      boundary,
      "FENNEVIA_FIREFOX_BOOKMARK_RECORD_INVALID",
      phase,
      "PlacesUtils.bookmarks.fetch.result",
    );
  }
  requireGuid(
    boundary,
    candidate.guid,
    phase,
    "PlacesUtils.bookmarks.fetch.result.guid",
  );
  requireGuid(
    boundary,
    candidate.parentGuid,
    phase,
    "PlacesUtils.bookmarks.fetch.result.parentGuid",
  );
  if (
    (expectedGuid !== undefined && candidate.guid !== expectedGuid) ||
    ![
      bookmarks.TYPE_BOOKMARK,
      bookmarks.TYPE_FOLDER,
      bookmarks.TYPE_SEPARATOR,
    ].includes(candidate.type as number) ||
    (candidate.type === bookmarks.TYPE_FOLDER &&
      (!Number.isSafeInteger(candidate.childCount) ||
        (candidate.childCount as number) < 0))
  ) {
    throw createBookmarksError(
      boundary,
      "FENNEVIA_FIREFOX_BOOKMARK_RECORD_INVALID",
      phase,
      "PlacesUtils.bookmarks.fetch.result",
    );
  }
  return candidate as NativeBookmarkRecord;
};

export const getNodeKind = (
  boundary: FirefoxBridgeBoundary,
  record: NativeBookmarkRecord,
  bookmarks: NativeBookmarks,
): BookmarkNodeKind => {
  if (record.type === bookmarks.TYPE_BOOKMARK) {
    return "bookmark";
  }
  if (record.type === bookmarks.TYPE_FOLDER) {
    return "folder";
  }
  if (record.type === bookmarks.TYPE_SEPARATOR) {
    return "separator";
  }
  throw createBookmarksError(
    boundary,
    "FENNEVIA_FIREFOX_BOOKMARK_TYPE_INVALID",
    "firefox-bookmarks-snapshot",
    "PlacesUtils.bookmarks.TYPE_BOOKMARK",
  );
};

export const getUrlProtocol = (value: unknown): string | null => {
  if (!isNativeRecord(value) || typeof value.href !== "string") {
    return null;
  }
  if (typeof value.protocol === "string") {
    return value.protocol.toLowerCase();
  }
  const separator = value.href.indexOf(":");
  return separator > 0
    ? `${value.href.slice(0, separator).toLowerCase()}:`
    : null;
};
