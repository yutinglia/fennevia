// SPDX-License-Identifier: MPL-2.0
import type {
  BookmarkChildrenResult,
  BookmarkNodeSnapshot,
  BookmarkOpenDisposition,
  BookmarkOpenResult,
  BookmarkTreeEvent,
  BrowserBookmarksBridge,
} from "../../app/bookmark-state.ts";
import { bookmarkPageSize } from "../../app/bookmark-state.ts";
import {
  FirefoxBridgeError,
  createIdempotentDisposer,
  isFirefoxBridgeError,
  type FirefoxBridgeBoundary,
  type FirefoxCapabilitySnapshot,
} from "../bridge-boundary.ts";
import {
  PLACES_UTILS_URI,
  PLACES_UI_UTILS_URI,
  BOOKMARK_EVENT_TYPES,
  MAXIMUM_EVENT_PARENTS,
  MAXIMUM_EVENT_BATCH,
  MAXIMUM_QUERY_OFFSET,
  GUID_PATTERN,
  UNSUPPORTED_SCHEMES,
  isNativeRecord,
  isFunction,
  createBookmarksError,
  requireGuid,
  truncateTitle,
  asBookmarkRecord,
  getNodeKind,
  getUrlProtocol,
} from "./support.ts";
import type {
  NativeRecord,
  NativeModuleLoader,
  NativeBookmarkHandle,
  NativeBookmarkRecord,
  NativePlacesUtils,
  NativePlacesUIUtils,
  BookmarksCapabilityEvaluation,
  BookmarksCapabilitySpecification,
} from "./support.ts";

export type FirefoxBookmarksBridgeController = Readonly<{
  assertRequiredCapabilities: () => readonly FirefoxCapabilitySnapshot[];
  bookmarks: BrowserBookmarksBridge;
  dispose: () => boolean;
  snapshot: () => Readonly<{
    disposed: boolean;
    failed: boolean;
    handleCount: number;
    observerRegistered: boolean;
    revision: number;
    subscriberCount: number;
  }>;
}>;

export function createFirefoxBookmarksBridge({
  boundary,
  moduleLoader,
  onError,
  window,
}: Readonly<{
  boundary: FirefoxBridgeBoundary;
  moduleLoader: NativeModuleLoader;
  onError: (error: unknown) => void;
  window: unknown;
}>): FirefoxBookmarksBridgeController {
  boundary.assertOwnsWindow(window);
  if (
    !isNativeRecord(window) ||
    typeof moduleLoader !== "function" ||
    typeof onError !== "function"
  ) {
    throw createBookmarksError(
      boundary,
      "FENNEVIA_FIREFOX_BOOKMARKS_OPTIONS_INVALID",
      "firefox-bookmarks-create",
      "ChromeUtils.importESModule",
    );
  }

  let placesModule: unknown;
  let placesUiModule: unknown;
  try {
    placesModule = moduleLoader(PLACES_UTILS_URI);
    placesUiModule = moduleLoader(PLACES_UI_UTILS_URI);
  } catch (error) {
    throw createBookmarksError(
      boundary,
      "FENNEVIA_FIREFOX_BOOKMARKS_MODULE_LOAD_FAILED",
      "firefox-bookmarks-module-load",
      "ChromeUtils.importESModule",
      error,
    );
  }

  const placesUtils = isNativeRecord(placesModule)
    ? placesModule.PlacesUtils
    : undefined;
  const placesUiUtils = isNativeRecord(placesUiModule)
    ? placesUiModule.PlacesUIUtils
    : undefined;
  const nativePlacesUtils = placesUtils as NativePlacesUtils;
  const nativePlacesUiUtils = placesUiUtils as NativePlacesUIUtils;
  const capabilitySpecifications: readonly BookmarksCapabilitySpecification[] =
    Object.freeze([
      Object.freeze({
        isAvailable: isNativeRecord,
        name: "firefox.places-utils",
        read: () => placesUtils,
        symbol: "PlacesUtils",
      }),
      Object.freeze({
        isAvailable: isNativeRecord,
        name: "firefox.places-bookmarks",
        read: () => nativePlacesUtils?.bookmarks,
        symbol: "PlacesUtils.bookmarks",
      }),
      Object.freeze({
        isAvailable: isFunction,
        name: "firefox.places-bookmarks-fetch",
        read: () => nativePlacesUtils?.bookmarks?.fetch,
        symbol: "PlacesUtils.bookmarks.fetch",
      }),
      Object.freeze({
        isAvailable: (value: unknown) =>
          Array.isArray(value) &&
          value.length === 4 &&
          value.every((guid) =>
            typeof guid === "string" ? GUID_PATTERN.test(guid) : false,
          ),
        name: "firefox.places-bookmark-roots",
        read: () => nativePlacesUtils?.bookmarks?.userContentRoots,
        symbol: "PlacesUtils.bookmarks.userContentRoots",
      }),
      Object.freeze({
        isAvailable: isFunction,
        name: "firefox.places-root-title",
        read: () => nativePlacesUtils?.bookmarks?.getLocalizedTitle,
        symbol: "PlacesUtils.bookmarks.getLocalizedTitle",
      }),
      Object.freeze({
        isAvailable: isNativeRecord,
        name: "firefox.places-observers",
        read: () => nativePlacesUtils?.observers,
        symbol: "PlacesUtils.observers",
      }),
      ...["addListener", "removeListener"].map((member) =>
        Object.freeze({
          isAvailable: isFunction,
          name: `firefox.places-observers-${member.toLowerCase()}`,
          read: () => nativePlacesUtils?.observers?.[member],
          symbol: `PlacesUtils.observers.${member}`,
        }),
      ),
      Object.freeze({
        isAvailable: isNativeRecord,
        name: "firefox.places-ui-utils",
        read: () => placesUiUtils,
        symbol: "PlacesUIUtils",
      }),
      Object.freeze({
        isAvailable: isFunction,
        name: "firefox.places-node-conversion",
        read: () => nativePlacesUiUtils?.promiseNodeLikeFromFetchInfo,
        symbol: "PlacesUIUtils.promiseNodeLikeFromFetchInfo",
      }),
      Object.freeze({
        isAvailable: isFunction,
        name: "firefox.places-open-node",
        read: () => nativePlacesUiUtils?.openNodeIn,
        symbol: "PlacesUIUtils.openNodeIn",
      }),
    ]);

  let nativeWindow: NativeRecord | null = window;
  let disposed = false;
  let failedError: FirefoxBridgeError | null = null;
  let observerRegistered = false;
  let revision = 0;
  const subscribers = new Set<(event: BookmarkTreeEvent) => void>();
  const registry =
    boundary.createHandleRegistry<NativeBookmarkHandle>("bookmark");
  const handleByGuid = new Map<string, NativeBookmarkHandle>();
  const idByGuid = new Map<string, string>();

  const requireWindow = (): NativeRecord => {
    if (disposed || !nativeWindow) {
      throw createBookmarksError(
        boundary,
        "FENNEVIA_FIREFOX_BOOKMARKS_DISPOSED",
        "firefox-bookmarks-access",
        "window",
      );
    }
    if (failedError) {
      throw failedError;
    }
    boundary.assertOwnsWindow(nativeWindow);
    return nativeWindow;
  };

  const evaluateCapabilities = (): readonly BookmarksCapabilityEvaluation[] =>
    Object.freeze(
      capabilitySpecifications.map((specification) => {
        let available = false;
        let cause: unknown;
        try {
          available = specification.isAvailable(specification.read());
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

  const assertRequiredCapabilities = () => {
    requireWindow();
    const evaluations = evaluateCapabilities();
    const missing = evaluations.find(
      (evaluation) => !evaluation.snapshot.available,
    );
    if (missing) {
      throw createBookmarksError(
        boundary,
        "FENNEVIA_FIREFOX_BOOKMARKS_CAPABILITY_MISSING",
        "firefox-bookmarks-capability",
        missing.snapshot.symbol,
        missing.cause,
      );
    }
    return Object.freeze(evaluations.map((evaluation) => evaluation.snapshot));
  };

  const registerGuid = (guid: string): string => {
    requireWindow();
    const validGuid = requireGuid(
      boundary,
      guid,
      "firefox-bookmarks-handle",
      "PlacesUtils.bookmarks.guid",
    );
    const existingId = idByGuid.get(validGuid);
    if (existingId) {
      return existingId;
    }
    const handle = Object.freeze({ guid: validGuid });
    const id = registry.register(handle);
    handleByGuid.set(validGuid, handle);
    idByGuid.set(validGuid, id);
    return id;
  };

  const releaseGuid = (guid: unknown): boolean => {
    if (typeof guid !== "string" || !GUID_PATTERN.test(guid)) {
      return false;
    }
    const id = idByGuid.get(guid);
    if (!id) {
      return false;
    }
    idByGuid.delete(guid);
    handleByGuid.delete(guid);
    try {
      return registry.release(id);
    } catch {
      return false;
    }
  };

  const resolveGuid = (id: string): string => {
    requireWindow();
    return registry.resolve(id).guid;
  };

  const createNodeSnapshot = (
    record: NativeBookmarkRecord,
    title = record.title,
  ): BookmarkNodeSnapshot => {
    const kind = getNodeKind(boundary, record, nativePlacesUtils.bookmarks);
    return Object.freeze({
      hasChildren:
        kind === "folder" &&
        Number.isSafeInteger(record.childCount) &&
        (record.childCount as number) > 0,
      id: registerGuid(record.guid),
      kind,
      title: truncateTitle(title),
    });
  };

  const fetchRecord = async (
    input:
      | Readonly<{ guid: string }>
      | Readonly<{ index: number; parentGuid: string }>,
    phase: string,
  ): Promise<NativeBookmarkRecord | null> => {
    requireWindow();
    let candidate: unknown;
    try {
      candidate = await Reflect.apply(
        nativePlacesUtils.bookmarks.fetch,
        nativePlacesUtils.bookmarks,
        [input],
      );
    } catch (error) {
      throw createBookmarksError(
        boundary,
        "FENNEVIA_FIREFOX_BOOKMARK_QUERY_FAILED",
        phase,
        "PlacesUtils.bookmarks.fetch",
        error,
      );
    }
    requireWindow();
    if (candidate === null) {
      return null;
    }
    return asBookmarkRecord(
      boundary,
      candidate,
      nativePlacesUtils.bookmarks,
      phase,
      "guid" in input ? input.guid : undefined,
    );
  };

  const notifySubscribers = (
    parentIds: readonly string[],
    scope: BookmarkTreeEvent["scope"],
  ): void => {
    revision += 1;
    const event: BookmarkTreeEvent = Object.freeze({
      parentIds: Object.freeze([...parentIds]),
      revision,
      scope,
      type: "changed",
    });
    for (const listener of Array.from(subscribers)) {
      try {
        listener(event);
      } catch (error) {
        onError(
          createBookmarksError(
            boundary,
            "FENNEVIA_FIREFOX_BOOKMARKS_SUBSCRIBER_FAILED",
            "firefox-bookmarks-notify",
            "bookmarks.subscribe",
            error,
          ),
        );
      }
    }
  };

  const failFromObserver = (error: unknown): void => {
    failedError = isFirefoxBridgeError(error)
      ? error
      : createBookmarksError(
          boundary,
          "FENNEVIA_FIREFOX_BOOKMARKS_OBSERVER_FAILED",
          "firefox-bookmarks-observer",
          "PlacesUtils.observers.addListener",
          error,
        );
    onError(failedError);
  };

  const onBookmarkEvents = (candidateEvents: unknown): void => {
    if (disposed || failedError) {
      return;
    }
    try {
      if (!Array.isArray(candidateEvents)) {
        throw createBookmarksError(
          boundary,
          "FENNEVIA_FIREFOX_BOOKMARKS_EVENT_INVALID",
          "firefox-bookmarks-observer",
          "PlacesEventCallback.events",
        );
      }
      if (candidateEvents.length > MAXIMUM_EVENT_BATCH) {
        notifySubscribers(Object.freeze([]), "all");
        return;
      }
      const affectedIds = new Set<string>();
      const removedGuids: string[] = [];
      for (const candidate of candidateEvents) {
        if (
          !isNativeRecord(candidate) ||
          typeof candidate.type !== "string" ||
          !BOOKMARK_EVENT_TYPES.includes(candidate.type) ||
          typeof candidate.parentGuid !== "string" ||
          typeof candidate.isTagging !== "boolean"
        ) {
          throw createBookmarksError(
            boundary,
            "FENNEVIA_FIREFOX_BOOKMARKS_EVENT_INVALID",
            "firefox-bookmarks-observer",
            "PlacesEvent",
          );
        }
        if (candidate.isTagging) {
          continue;
        }
        requireGuid(
          boundary,
          candidate.parentGuid,
          "firefox-bookmarks-observer",
          "PlacesEvent.parentGuid",
        );
        const parentId = idByGuid.get(candidate.parentGuid);
        if (parentId) {
          affectedIds.add(parentId);
        }
        if (candidate.type === "bookmark-moved") {
          const oldParentGuid = requireGuid(
            boundary,
            candidate.oldParentGuid,
            "firefox-bookmarks-observer",
            "PlacesBookmarkMoved.oldParentGuid",
          );
          const oldParentId = idByGuid.get(oldParentGuid);
          if (oldParentId) {
            affectedIds.add(oldParentId);
          }
        }
        if (candidate.type === "bookmark-removed") {
          removedGuids.push(
            requireGuid(
              boundary,
              candidate.guid,
              "firefox-bookmarks-observer",
              "PlacesBookmarkRemoved.guid",
            ),
          );
        }
      }
      const ids = Array.from(affectedIds);
      if (ids.length > MAXIMUM_EVENT_PARENTS) {
        notifySubscribers(Object.freeze([]), "all");
      } else if (ids.length > 0) {
        notifySubscribers(Object.freeze(ids), "parents");
      }
      for (const guid of removedGuids) {
        releaseGuid(guid);
      }
    } catch (error) {
      failFromObserver(error);
    }
  };

  const observerDisposer = createIdempotentDisposer(() => {
    if (!observerRegistered) {
      return;
    }
    observerRegistered = false;
    Reflect.apply(
      nativePlacesUtils.observers.removeListener,
      nativePlacesUtils.observers,
      [BOOKMARK_EVENT_TYPES, onBookmarkEvents],
    );
  });

  const publicBridge: BrowserBookmarksBridge = Object.freeze({
    async children(parentId, options = {}): Promise<BookmarkChildrenResult> {
      let parentGuid: string;
      try {
        parentGuid = resolveGuid(parentId);
      } catch (error) {
        if (
          isFirefoxBridgeError(error) &&
          error.fenneviaCode === "FENNEVIA_FIREFOX_HANDLE_STALE"
        ) {
          return Object.freeze({ parentId, status: "stale" });
        }
        throw error;
      }
      if (
        !isNativeRecord(options) ||
        Object.keys(options).some((key) => key !== "limit" && key !== "offset")
      ) {
        throw createBookmarksError(
          boundary,
          "FENNEVIA_FIREFOX_BOOKMARK_QUERY_OPTIONS_INVALID",
          "firefox-bookmarks-query",
          "bookmarks.children.options",
        );
      }
      const limit = options.limit ?? bookmarkPageSize;
      const offset = options.offset ?? 0;
      if (
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > bookmarkPageSize ||
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        offset > MAXIMUM_QUERY_OFFSET
      ) {
        throw createBookmarksError(
          boundary,
          "FENNEVIA_FIREFOX_BOOKMARK_QUERY_OPTIONS_INVALID",
          "firefox-bookmarks-query",
          "bookmarks.children.options",
        );
      }
      const parent = await fetchRecord(
        { guid: parentGuid },
        "firefox-bookmarks-query-parent",
      );
      if (!parent) {
        releaseGuid(parentGuid);
        return Object.freeze({ parentId, status: "stale" });
      }
      if (parent.type !== nativePlacesUtils.bookmarks.TYPE_FOLDER) {
        return Object.freeze({ parentId, status: "stale" });
      }
      const totalCount = parent.childCount as number;
      const pageOffset =
        totalCount === 0
          ? 0
          : Math.min(offset, Math.floor((totalCount - 1) / limit) * limit);
      const end = Math.min(totalCount, pageOffset + limit);
      const items: BookmarkNodeSnapshot[] = [];
      for (let index = pageOffset; index < end; index += 1) {
        const child = await fetchRecord(
          { index, parentGuid },
          "firefox-bookmarks-query-child",
        );
        if (
          !child ||
          child.parentGuid !== parentGuid ||
          child.index !== index
        ) {
          return Object.freeze({ parentId, status: "stale" });
        }
        items.push(createNodeSnapshot(child));
      }
      return Object.freeze({
        items: Object.freeze(items),
        offset: pageOffset,
        parentId,
        status: "ok",
        totalCount,
        truncated: pageOffset + items.length < totalCount,
      });
    },

    async open(
      bookmarkId: string,
      disposition: BookmarkOpenDisposition = "current",
    ): Promise<BookmarkOpenResult> {
      if (disposition !== "current" && disposition !== "new-tab") {
        throw createBookmarksError(
          boundary,
          "FENNEVIA_FIREFOX_BOOKMARK_DISPOSITION_INVALID",
          "firefox-bookmarks-open",
          "bookmarks.open.disposition",
        );
      }
      let guid: string;
      try {
        guid = resolveGuid(bookmarkId);
      } catch (error) {
        if (
          isFirefoxBridgeError(error) &&
          error.fenneviaCode === "FENNEVIA_FIREFOX_HANDLE_STALE"
        ) {
          return Object.freeze({ reason: "stale", status: "rejected" });
        }
        throw error;
      }
      const record = await fetchRecord(
        { guid },
        "firefox-bookmarks-open-fetch",
      );
      if (!record) {
        releaseGuid(guid);
        return Object.freeze({ reason: "stale", status: "rejected" });
      }
      if (record.type !== nativePlacesUtils.bookmarks.TYPE_BOOKMARK) {
        return Object.freeze({
          reason: "not-bookmark",
          status: "rejected",
        });
      }
      const protocol = getUrlProtocol(record.url);
      if (!protocol || UNSUPPORTED_SCHEMES.has(protocol)) {
        return Object.freeze({
          reason: "unsupported-scheme",
          status: "rejected",
        });
      }
      let node: unknown;
      try {
        node = await Reflect.apply(
          nativePlacesUiUtils.promiseNodeLikeFromFetchInfo,
          nativePlacesUiUtils,
          [record],
        );
        const ownerWindow = requireWindow();
        Reflect.apply(nativePlacesUiUtils.openNodeIn, nativePlacesUiUtils, [
          node,
          disposition === "new-tab" ? "tab" : "current",
          { ownerWindow },
          boundary.snapshot().windowKind === "private",
        ]);
      } catch (error) {
        throw createBookmarksError(
          boundary,
          "FENNEVIA_FIREFOX_BOOKMARK_OPEN_FAILED",
          "firefox-bookmarks-open",
          "PlacesUIUtils.openNodeIn",
          error,
        );
      }
      return Object.freeze({ status: "opened" });
    },

    async roots(): Promise<readonly BookmarkNodeSnapshot[]> {
      requireWindow();
      const rootGuids = nativePlacesUtils.bookmarks.userContentRoots;
      const roots: BookmarkNodeSnapshot[] = [];
      for (const rootGuid of rootGuids) {
        const record = await fetchRecord(
          { guid: rootGuid },
          "firefox-bookmarks-query-roots",
        );
        if (
          !record ||
          record.type !== nativePlacesUtils.bookmarks.TYPE_FOLDER
        ) {
          throw createBookmarksError(
            boundary,
            "FENNEVIA_FIREFOX_BOOKMARK_ROOT_INVALID",
            "firefox-bookmarks-query-roots",
            "PlacesUtils.bookmarks.userContentRoots",
          );
        }
        let localizedTitle: unknown;
        try {
          localizedTitle = Reflect.apply(
            nativePlacesUtils.bookmarks.getLocalizedTitle,
            nativePlacesUtils.bookmarks,
            [record],
          );
        } catch (error) {
          throw createBookmarksError(
            boundary,
            "FENNEVIA_FIREFOX_BOOKMARK_ROOT_TITLE_FAILED",
            "firefox-bookmarks-query-roots",
            "PlacesUtils.bookmarks.getLocalizedTitle",
            error,
          );
        }
        if (typeof localizedTitle !== "string") {
          throw createBookmarksError(
            boundary,
            "FENNEVIA_FIREFOX_BOOKMARK_ROOT_TITLE_INVALID",
            "firefox-bookmarks-query-roots",
            "PlacesUtils.bookmarks.getLocalizedTitle",
          );
        }
        roots.push(createNodeSnapshot(record, localizedTitle));
      }
      return Object.freeze(roots);
    },

    subscribe(listener: (event: BookmarkTreeEvent) => void): () => boolean {
      requireWindow();
      if (typeof listener !== "function") {
        throw createBookmarksError(
          boundary,
          "FENNEVIA_FIREFOX_BOOKMARKS_LISTENER_INVALID",
          "firefox-bookmarks-subscribe",
          "bookmarks.subscribe",
        );
      }
      subscribers.add(listener);
      return createIdempotentDisposer(() => {
        subscribers.delete(listener);
      });
    },
  });

  try {
    boundary.assertRequiredCapabilities();
    assertRequiredCapabilities();
    Reflect.apply(
      nativePlacesUtils.observers.addListener,
      nativePlacesUtils.observers,
      [BOOKMARK_EVENT_TYPES, onBookmarkEvents],
    );
    observerRegistered = true;
  } catch (error) {
    disposed = true;
    nativeWindow = null;
    let cleanupError: unknown;
    try {
      observerDisposer();
    } catch (candidate) {
      cleanupError = candidate;
    }
    try {
      registry.dispose();
    } catch (candidate) {
      cleanupError ??= candidate;
    }
    if (cleanupError !== undefined) {
      onError(
        createBookmarksError(
          boundary,
          "FENNEVIA_FIREFOX_BOOKMARKS_DISPOSE_FAILED",
          "firefox-bookmarks-dispose",
          "PlacesUtils.observers.removeListener",
          cleanupError,
        ),
      );
    }
    throw error;
  }

  return Object.freeze({
    assertRequiredCapabilities,
    bookmarks: publicBridge,

    dispose(): boolean {
      if (disposed) {
        return false;
      }
      disposed = true;
      nativeWindow = null;
      let firstError: unknown;
      try {
        observerDisposer();
      } catch (error) {
        firstError = error;
      }
      subscribers.clear();
      handleByGuid.clear();
      idByGuid.clear();
      try {
        registry.dispose();
      } catch (error) {
        firstError ??= error;
      }
      if (firstError !== undefined) {
        throw createBookmarksError(
          boundary,
          "FENNEVIA_FIREFOX_BOOKMARKS_DISPOSE_FAILED",
          "firefox-bookmarks-dispose",
          "PlacesUtils.observers.removeListener",
          firstError,
        );
      }
      return true;
    },

    snapshot() {
      return Object.freeze({
        disposed,
        failed: failedError !== null,
        handleCount: idByGuid.size,
        observerRegistered,
        revision,
        subscriberCount: subscribers.size,
      });
    },
  });
}
