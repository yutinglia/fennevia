import type {
  BrowserDownloadsBridge,
  BrowserDownloadsSnapshot,
  DownloadItemSnapshot,
  DownloadItemState,
  DownloadProgressMode,
} from "../app/download-state.ts";
import {
  maximumDownloadCount,
  maximumDownloadItems,
} from "../app/download-state.ts";
import {
  FirefoxBridgeError,
  createIdempotentDisposer,
  isFirefoxBridgeError,
  type FirefoxBridgeBoundary,
  type FirefoxBridgeErrorContext,
  type FirefoxCapabilitySnapshot,
} from "./bridge-boundary.ts";

const DOWNLOADS_URI = "resource://gre/modules/Downloads.sys.mjs";
const MAXIMUM_RECENT_TERMINAL_DOWNLOADS = 3;

type NativeRecord = Record<string, unknown>;
type NativeModuleLoader = (uri: string) => unknown;
type NativeDownload = NativeRecord & {
  canceled: boolean;
  currentBytes: number;
  error: unknown;
  hasPartialData: boolean;
  hasProgress: boolean;
  progress: number;
  stopped: boolean;
  succeeded: boolean;
  totalBytes: number;
};
type NativeDownloadView = Readonly<{
  onDownloadAdded: (download: unknown) => void;
  onDownloadBatchEnded: () => void;
  onDownloadBatchStarting: () => void;
  onDownloadChanged: (download: unknown) => void;
  onDownloadRemoved: (download: unknown) => void;
}>;
type NativeDownloadList = NativeRecord & {
  addView: (view: NativeDownloadView) => unknown;
  removeView: (view: NativeDownloadView) => unknown;
};
type NativeDownloads = NativeRecord & {
  PRIVATE: unknown;
  PUBLIC: unknown;
  getList: (type: unknown) => Promise<unknown>;
};
type TrackedDownload = {
  currentBytes: number;
  download: NativeDownload;
  hasProgress: boolean;
  id: string;
  order: number;
  progressPercent: number | null;
  state: DownloadItemState;
  totalBytes: number;
};

type DownloadsCapabilityEvaluation = Readonly<{
  cause?: unknown;
  snapshot: FirefoxCapabilitySnapshot;
}>;

type DownloadsCapabilitySpecification = Readonly<{
  isAvailable: (value: unknown) => boolean;
  name: string;
  read: () => unknown;
  symbol: string;
}>;

const isNativeRecord = (value: unknown): value is NativeRecord =>
  typeof value === "object" && value !== null;

const isFunction = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === "function";

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

const createDownloadsError = (
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

const isValidByteCount = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Number.isSafeInteger(value) &&
  value >= 0;

const asDownload = (
  boundary: FirefoxBridgeBoundary,
  candidate: unknown,
): NativeDownload => {
  if (
    !isNativeRecord(candidate) ||
    typeof candidate.stopped !== "boolean" ||
    typeof candidate.succeeded !== "boolean" ||
    typeof candidate.canceled !== "boolean" ||
    typeof candidate.hasPartialData !== "boolean" ||
    typeof candidate.hasProgress !== "boolean" ||
    !Number.isInteger(candidate.progress) ||
    (candidate.progress as number) < 0 ||
    (candidate.progress as number) > 100 ||
    !isValidByteCount(candidate.currentBytes) ||
    !isValidByteCount(candidate.totalBytes)
  ) {
    throw createDownloadsError(
      boundary,
      "FENNEVIA_FIREFOX_DOWNLOAD_RECORD_INVALID",
      "firefox-downloads-event",
      "Download",
    );
  }
  return candidate as NativeDownload;
};

const classifyDownload = (download: NativeDownload): DownloadItemState => {
  if (!download.stopped) {
    return "active";
  }
  if (download.succeeded) {
    return "succeeded";
  }
  if (download.error) {
    return "failed";
  }
  if (download.canceled) {
    return download.hasPartialData ? "paused" : "canceled";
  }
  return "queued";
};

const isTerminalState = (state: DownloadItemState): boolean =>
  state === "succeeded" || state === "failed" || state === "canceled";

const boundedCount = (value: number): number =>
  Math.min(value, maximumDownloadCount);

const createInitialSnapshot = (): BrowserDownloadsSnapshot =>
  Object.freeze({
    activeCount: 0,
    aggregatePercent: null,
    canceledCount: 0,
    countOverflow: false,
    failedCount: 0,
    items: Object.freeze([]),
    pausedCount: 0,
    phase: "loading",
    progressMode: "none",
    queuedCount: 0,
    revision: 0,
    succeededCount: 0,
    truncated: false,
  });

export type FirefoxDownloadsBridgeController = Readonly<{
  assertRequiredCapabilities: () => readonly FirefoxCapabilitySnapshot[];
  dispose: () => boolean;
  downloads: BrowserDownloadsBridge;
  ready: () => Promise<true>;
  snapshot: () => Readonly<{
    disposed: boolean;
    failed: boolean;
    handleCount: number;
    listKind: "private" | "public";
    ready: boolean;
    revision: number;
    subscriberCount: number;
    viewRegistered: boolean;
  }>;
}>;

export function createFirefoxDownloadsBridge({
  boundary,
  moduleLoader,
  onError,
  window,
}: Readonly<{
  boundary: FirefoxBridgeBoundary;
  moduleLoader: NativeModuleLoader;
  onError: (error: unknown) => void;
  window: unknown;
}>): FirefoxDownloadsBridgeController {
  boundary.assertOwnsWindow(window);
  if (
    !isNativeRecord(window) ||
    typeof moduleLoader !== "function" ||
    typeof onError !== "function"
  ) {
    throw createDownloadsError(
      boundary,
      "FENNEVIA_FIREFOX_DOWNLOADS_OPTIONS_INVALID",
      "firefox-downloads-create",
      "ChromeUtils.importESModule",
    );
  }

  let downloadsModule: unknown;
  try {
    downloadsModule = moduleLoader(DOWNLOADS_URI);
  } catch (error) {
    throw createDownloadsError(
      boundary,
      "FENNEVIA_FIREFOX_DOWNLOADS_MODULE_LOAD_FAILED",
      "firefox-downloads-module-load",
      "ChromeUtils.importESModule",
      error,
    );
  }

  const downloads = isNativeRecord(downloadsModule)
    ? downloadsModule.Downloads
    : undefined;
  const nativeDownloads = downloads as NativeDownloads;
  const listKind =
    boundary.snapshot().windowKind === "private" ? "private" : "public";
  const selectedListType =
    listKind === "private" ? nativeDownloads?.PRIVATE : nativeDownloads?.PUBLIC;
  const capabilitySpecifications: readonly DownloadsCapabilitySpecification[] =
    Object.freeze([
      Object.freeze({
        isAvailable: isNativeRecord,
        name: "firefox.downloads",
        read: () => downloads,
        symbol: "Downloads",
      }),
      Object.freeze({
        isAvailable: isFunction,
        name: "firefox.downloads-get-list",
        read: () => nativeDownloads?.getList,
        symbol: "Downloads.getList",
      }),
      Object.freeze({
        isAvailable: (value: unknown) => typeof value === "string",
        name: `firefox.downloads-${listKind}-list`,
        read: () => selectedListType,
        symbol:
          listKind === "private" ? "Downloads.PRIVATE" : "Downloads.PUBLIC",
      }),
    ]);

  let nativeWindow: NativeRecord | null = window;
  let nativeList: NativeDownloadList | null = null;
  let disposed = false;
  let failedError: FirefoxBridgeError | null = null;
  let initializing = true;
  let batchDepth = 0;
  let pendingPublish = false;
  let ready = false;
  let revision = 0;
  let nextOrder = 0;
  let viewRegistered = false;
  let state = createInitialSnapshot();
  let stateSignature = "";
  const subscribers = new Set<(snapshot: BrowserDownloadsSnapshot) => void>();
  const registry = boundary.createHandleRegistry<NativeDownload>("download");
  const trackedDownloads = new Map<NativeDownload, TrackedDownload>();
  const initialDownloads = new WeakSet<NativeDownload>();
  const recentTerminalDownloads: NativeDownload[] = [];

  const requireWindow = (): NativeRecord => {
    if (disposed || !nativeWindow) {
      throw createDownloadsError(
        boundary,
        "FENNEVIA_FIREFOX_DOWNLOADS_DISPOSED",
        "firefox-downloads-access",
        "window",
      );
    }
    if (failedError) {
      throw failedError;
    }
    boundary.assertOwnsWindow(nativeWindow);
    return nativeWindow;
  };

  const evaluateCapabilities = (): readonly DownloadsCapabilityEvaluation[] => {
    const evaluations = capabilitySpecifications.map((specification) => {
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
    });
    if (nativeList) {
      evaluations.push(
        Object.freeze({
          snapshot: Object.freeze({
            available: isFunction(nativeList.addView),
            name: "firefox.downloads-list-add-view",
            requirement: "required" as const,
            symbol: "DownloadList.addView",
          }),
        }),
        Object.freeze({
          snapshot: Object.freeze({
            available: isFunction(nativeList.removeView),
            name: "firefox.downloads-list-remove-view",
            requirement: "required" as const,
            symbol: "DownloadList.removeView",
          }),
        }),
      );
    }
    return Object.freeze(evaluations);
  };

  const assertRequiredCapabilities = () => {
    requireWindow();
    const evaluations = evaluateCapabilities();
    const missing = evaluations.find(
      (evaluation) => !evaluation.snapshot.available,
    );
    if (missing) {
      throw createDownloadsError(
        boundary,
        "FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING",
        "firefox-downloads-capability",
        missing.snapshot.symbol,
        missing.cause,
      );
    }
    return Object.freeze(evaluations.map((evaluation) => evaluation.snapshot));
  };

  const failFromEvent = (error: unknown): FirefoxBridgeError => {
    if (failedError) {
      return failedError;
    }
    failedError = isFirefoxBridgeError(error)
      ? error
      : createDownloadsError(
          boundary,
          "FENNEVIA_FIREFOX_DOWNLOADS_EVENT_FAILED",
          "firefox-downloads-event",
          "DownloadList.view",
          error,
        );
    onError(failedError);
    return failedError;
  };

  const releaseTracked = (download: NativeDownload): boolean => {
    const tracked = trackedDownloads.get(download);
    if (!tracked) {
      return false;
    }
    trackedDownloads.delete(download);
    const terminalIndex = recentTerminalDownloads.indexOf(download);
    if (terminalIndex !== -1) {
      recentTerminalDownloads.splice(terminalIndex, 1);
    }
    registry.release(tracked.id);
    return true;
  };

  const retainTerminal = (download: NativeDownload): void => {
    const previousIndex = recentTerminalDownloads.indexOf(download);
    if (previousIndex !== -1) {
      recentTerminalDownloads.splice(previousIndex, 1);
    }
    recentTerminalDownloads.unshift(download);
    while (recentTerminalDownloads.length > MAXIMUM_RECENT_TERMINAL_DOWNLOADS) {
      const expired = recentTerminalDownloads.pop();
      if (expired) {
        releaseTracked(expired);
      }
    }
  };

  const reconcileDownload = (candidate: unknown): void => {
    const download = asDownload(boundary, candidate);
    const stateName = classifyDownload(download);
    if (initializing) {
      initialDownloads.add(download);
      if (isTerminalState(stateName)) {
        return;
      }
    }

    let tracked = trackedDownloads.get(download);
    if (
      !tracked &&
      isTerminalState(stateName) &&
      initialDownloads.has(download)
    ) {
      return;
    }
    if (!tracked) {
      tracked = {
        currentBytes: 0,
        download,
        hasProgress: false,
        id: registry.register(download),
        order: ++nextOrder,
        progressPercent: null,
        state: stateName,
        totalBytes: 0,
      };
      trackedDownloads.set(download, tracked);
    }

    tracked.currentBytes = download.currentBytes;
    tracked.hasProgress = download.hasProgress;
    tracked.progressPercent =
      stateName === "succeeded"
        ? 100
        : download.hasProgress
          ? download.progress
          : null;
    tracked.state = stateName;
    tracked.totalBytes = download.totalBytes;

    if (isTerminalState(stateName)) {
      retainTerminal(download);
    } else {
      const terminalIndex = recentTerminalDownloads.indexOf(download);
      if (terminalIndex !== -1) {
        recentTerminalDownloads.splice(terminalIndex, 1);
      }
    }
  };

  const getAggregateProgress = (
    active: readonly TrackedDownload[],
  ): Readonly<{
    mode: DownloadProgressMode;
    percent: number | null;
  }> => {
    if (active.length === 0) {
      return Object.freeze({ mode: "none", percent: null });
    }
    if (active.some((tracked) => !tracked.hasProgress)) {
      return Object.freeze({ mode: "indeterminate", percent: null });
    }

    let currentBytes = 0;
    let totalBytes = 0;
    let zeroTotalPercent = 0;
    let zeroTotalCount = 0;
    for (const tracked of active) {
      if (tracked.totalBytes > 0) {
        totalBytes += tracked.totalBytes;
        currentBytes += Math.min(tracked.currentBytes, tracked.totalBytes);
      } else {
        zeroTotalPercent += tracked.progressPercent ?? 0;
        zeroTotalCount += 1;
      }
    }
    const rawPercent =
      totalBytes > 0
        ? (currentBytes / totalBytes) * 100
        : zeroTotalCount > 0
          ? zeroTotalPercent / zeroTotalCount
          : 0;
    return Object.freeze({
      mode: "determinate",
      percent: Math.max(0, Math.min(100, Math.floor(rawPercent))),
    });
  };

  const createSnapshot = (): BrowserDownloadsSnapshot => {
    const byState: Record<DownloadItemState, TrackedDownload[]> = {
      active: [],
      canceled: [],
      failed: [],
      paused: [],
      queued: [],
      succeeded: [],
    };
    for (const tracked of trackedDownloads.values()) {
      byState[tracked.state].push(tracked);
    }
    for (const stateName of ["active", "paused", "queued"] as const) {
      byState[stateName].sort((left, right) => left.order - right.order);
    }
    const terminal = recentTerminalDownloads
      .map((download) => trackedDownloads.get(download))
      .filter((tracked): tracked is TrackedDownload => Boolean(tracked));
    const ordered = [
      ...byState.active,
      ...byState.paused,
      ...byState.queued,
      ...terminal,
    ];
    const items: DownloadItemSnapshot[] = ordered
      .slice(0, maximumDownloadItems)
      .map((tracked) =>
        Object.freeze({
          id: tracked.id,
          progressPercent: tracked.progressPercent,
          state: tracked.state,
        }),
      );
    const aggregate = getAggregateProgress(byState.active);
    const rawCounts = Object.freeze({
      active: byState.active.length,
      canceled: byState.canceled.length,
      failed: byState.failed.length,
      paused: byState.paused.length,
      queued: byState.queued.length,
      succeeded: byState.succeeded.length,
    });
    const countOverflow = Object.values(rawCounts).some(
      (count) => count > maximumDownloadCount,
    );
    return Object.freeze({
      activeCount: boundedCount(rawCounts.active),
      aggregatePercent: aggregate.percent,
      canceledCount: boundedCount(rawCounts.canceled),
      countOverflow,
      failedCount: boundedCount(rawCounts.failed),
      items: Object.freeze(items),
      pausedCount: boundedCount(rawCounts.paused),
      phase: ready ? "ready" : "loading",
      progressMode: aggregate.mode,
      queuedCount: boundedCount(rawCounts.queued),
      revision: revision + 1,
      succeededCount: boundedCount(rawCounts.succeeded),
      truncated: ordered.length > maximumDownloadItems || countOverflow,
    });
  };

  const publish = (): void => {
    if (disposed || failedError || initializing || batchDepth > 0) {
      pendingPublish = true;
      return;
    }
    pendingPublish = false;
    const candidate = createSnapshot();
    const signature = JSON.stringify({ ...candidate, revision: 0 });
    if (signature === stateSignature) {
      return;
    }
    stateSignature = signature;
    revision += 1;
    state = Object.freeze({ ...candidate, revision });
    for (const listener of Array.from(subscribers)) {
      try {
        listener(state);
      } catch (error) {
        failFromEvent(
          createDownloadsError(
            boundary,
            "FENNEVIA_FIREFOX_DOWNLOADS_SUBSCRIBER_FAILED",
            "firefox-downloads-notify",
            "downloads.subscribe",
            error,
          ),
        );
        return;
      }
    }
  };

  const view: NativeDownloadView = Object.freeze({
    onDownloadAdded(candidate: unknown): void {
      if (disposed || failedError) {
        return;
      }
      try {
        reconcileDownload(candidate);
        publish();
      } catch (error) {
        failFromEvent(error);
      }
    },

    onDownloadBatchEnded(): void {
      if (disposed || failedError) {
        return;
      }
      if (batchDepth > 0) {
        batchDepth -= 1;
      }
      if (batchDepth === 0 && pendingPublish) {
        publish();
      }
    },

    onDownloadBatchStarting(): void {
      if (!disposed && !failedError) {
        batchDepth += 1;
      }
    },

    onDownloadChanged(candidate: unknown): void {
      if (disposed || failedError) {
        return;
      }
      try {
        reconcileDownload(candidate);
        publish();
      } catch (error) {
        failFromEvent(error);
      }
    },

    onDownloadRemoved(candidate: unknown): void {
      if (disposed || failedError) {
        return;
      }
      try {
        const download = asDownload(boundary, candidate);
        releaseTracked(download);
        publish();
      } catch (error) {
        failFromEvent(error);
      }
    },
  });

  const viewDisposer = createIdempotentDisposer(() => {
    if (!viewRegistered || !nativeList) {
      return;
    }
    viewRegistered = false;
    Reflect.apply(nativeList.removeView, nativeList, [view]);
  });

  boundary.assertRequiredCapabilities();
  assertRequiredCapabilities();

  const readyPromise = (async (): Promise<true> => {
    try {
      const candidateList = await Reflect.apply(
        nativeDownloads.getList,
        nativeDownloads,
        [selectedListType],
      );
      if (disposed) {
        return true;
      }
      if (
        !isNativeRecord(candidateList) ||
        !isFunction(candidateList.addView) ||
        !isFunction(candidateList.removeView)
      ) {
        throw createDownloadsError(
          boundary,
          "FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING",
          "firefox-downloads-capability",
          !isNativeRecord(candidateList) || !isFunction(candidateList.addView)
            ? "DownloadList.addView"
            : "DownloadList.removeView",
        );
      }
      nativeList = candidateList as NativeDownloadList;
      viewRegistered = true;
      Reflect.apply(nativeList.addView, nativeList, [view]);
      if (disposed) {
        viewDisposer();
        return true;
      }
      initializing = false;
      batchDepth = 0;
      if (failedError) {
        throw failedError;
      }
      ready = true;
      publish();
      return true;
    } catch (error) {
      if (disposed) {
        return true;
      }
      const failure =
        failedError ??
        failFromEvent(
          isFirefoxBridgeError(error)
            ? error
            : createDownloadsError(
                boundary,
                "FENNEVIA_FIREFOX_DOWNLOADS_INITIALIZATION_FAILED",
                "firefox-downloads-initialize",
                "Downloads.getList",
                error,
              ),
        );
      throw failure;
    }
  })();
  void readyPromise.catch(() => undefined);

  const publicBridge: BrowserDownloadsBridge = Object.freeze({
    ready(): Promise<true> {
      requireWindow();
      return readyPromise;
    },

    snapshot(): BrowserDownloadsSnapshot {
      requireWindow();
      return state;
    },

    subscribe(
      listener: (snapshot: BrowserDownloadsSnapshot) => void,
    ): () => boolean {
      requireWindow();
      if (typeof listener !== "function") {
        throw createDownloadsError(
          boundary,
          "FENNEVIA_FIREFOX_DOWNLOADS_LISTENER_INVALID",
          "firefox-downloads-subscribe",
          "downloads.subscribe",
        );
      }
      subscribers.add(listener);
      return createIdempotentDisposer(() => {
        subscribers.delete(listener);
      });
    },
  });

  return Object.freeze({
    assertRequiredCapabilities,

    dispose(): boolean {
      if (disposed) {
        return false;
      }
      disposed = true;
      nativeWindow = null;
      initializing = false;
      batchDepth = 0;
      pendingPublish = false;
      let firstError: unknown;
      try {
        viewDisposer();
      } catch (error) {
        firstError = error;
      }
      subscribers.clear();
      trackedDownloads.clear();
      recentTerminalDownloads.length = 0;
      try {
        registry.dispose();
      } catch (error) {
        firstError ??= error;
      }
      nativeList = null;
      if (firstError !== undefined) {
        throw createDownloadsError(
          boundary,
          "FENNEVIA_FIREFOX_DOWNLOADS_DISPOSE_FAILED",
          "firefox-downloads-dispose",
          "DownloadList.removeView",
          firstError,
        );
      }
      return true;
    },

    downloads: publicBridge,

    ready(): Promise<true> {
      requireWindow();
      return readyPromise;
    },

    snapshot() {
      return Object.freeze({
        disposed,
        failed: failedError !== null,
        handleCount: registry.snapshot().activeHandleCount,
        listKind,
        ready,
        revision,
        subscriberCount: subscribers.size,
        viewRegistered,
      });
    },
  });
}
