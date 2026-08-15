export const maximumDownloadItems = 6;
export const maximumDownloadCount = 999;

export type DownloadItemState =
  "active" | "canceled" | "failed" | "paused" | "queued" | "succeeded";

export type DownloadProgressMode = "determinate" | "indeterminate" | "none";

export type DownloadItemSnapshot = Readonly<{
  id: string;
  progressPercent: number | null;
  state: DownloadItemState;
}>;

export type BrowserDownloadsSnapshot = Readonly<{
  activeCount: number;
  aggregatePercent: number | null;
  canceledCount: number;
  countOverflow: boolean;
  failedCount: number;
  items: readonly DownloadItemSnapshot[];
  pausedCount: number;
  phase: "loading" | "ready";
  progressMode: DownloadProgressMode;
  queuedCount: number;
  revision: number;
  succeededCount: number;
  truncated: boolean;
}>;

export type BrowserDownloadsBridge = Readonly<{
  ready: () => Promise<true>;
  snapshot: () => BrowserDownloadsSnapshot;
  subscribe: (
    listener: (snapshot: BrowserDownloadsSnapshot) => void,
  ) => () => boolean;
}>;

export type BrowserDownloadsState = Readonly<
  Omit<BrowserDownloadsSnapshot, "phase"> & {
    phase: "disposed" | "loading" | "ready";
  }
>;

export type BrowserDownloadsStateAdapter = Readonly<{
  dispose: () => boolean;
  ready: () => Promise<true>;
  snapshot: () => BrowserDownloadsState;
  status: () => Readonly<{
    disposed: boolean;
    phase: BrowserDownloadsState["phase"];
    revision: number;
    subscriberCount: number;
  }>;
  subscribe: (
    listener: (state: BrowserDownloadsState) => void,
  ) => () => boolean;
}>;

const downloadItemStates = new Set<DownloadItemState>([
  "active",
  "canceled",
  "failed",
  "paused",
  "queued",
  "succeeded",
]);
const downloadProgressModes = new Set<DownloadProgressMode>([
  "determinate",
  "indeterminate",
  "none",
]);

const createStateError = (code: string): Error => {
  const error = new Error(code);
  error.name = "FenneviaDownloadStateError";
  Object.defineProperties(error, {
    fenneviaCode: { enumerable: false, value: code },
    fenneviaPhase: { enumerable: false, value: "download-state" },
  });
  return error;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const copyCount = (value: unknown): number => {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < 0 ||
    (value as number) > maximumDownloadCount
  ) {
    throw createStateError("FENNEVIA_DOWNLOAD_STATE_COUNT_INVALID");
  }
  return value as number;
};

const copyPercent = (value: unknown): number | null => {
  if (value === null) {
    return null;
  }
  if (
    !Number.isInteger(value) ||
    (value as number) < 0 ||
    (value as number) > 100
  ) {
    throw createStateError("FENNEVIA_DOWNLOAD_STATE_PROGRESS_INVALID");
  }
  return value as number;
};

const copyItem = (candidate: unknown): DownloadItemSnapshot => {
  if (
    !isRecord(candidate) ||
    typeof candidate.id !== "string" ||
    candidate.id.length < 1 ||
    candidate.id.length > 160 ||
    typeof candidate.state !== "string" ||
    !downloadItemStates.has(candidate.state as DownloadItemState)
  ) {
    throw createStateError("FENNEVIA_DOWNLOAD_STATE_ITEM_INVALID");
  }
  const progressPercent = copyPercent(candidate.progressPercent);
  if (candidate.state === "succeeded" && progressPercent !== 100) {
    throw createStateError("FENNEVIA_DOWNLOAD_STATE_ITEM_INVALID");
  }
  return Object.freeze({
    id: candidate.id,
    progressPercent,
    state: candidate.state as DownloadItemState,
  });
};

export function copyBrowserDownloadsSnapshot(
  candidate: unknown,
): BrowserDownloadsSnapshot {
  if (
    !isRecord(candidate) ||
    (candidate.phase !== "loading" && candidate.phase !== "ready") ||
    typeof candidate.countOverflow !== "boolean" ||
    typeof candidate.truncated !== "boolean" ||
    typeof candidate.progressMode !== "string" ||
    !downloadProgressModes.has(
      candidate.progressMode as DownloadProgressMode,
    ) ||
    !Number.isSafeInteger(candidate.revision) ||
    (candidate.revision as number) < 0 ||
    !Array.isArray(candidate.items) ||
    candidate.items.length > maximumDownloadItems
  ) {
    throw createStateError("FENNEVIA_DOWNLOAD_STATE_SNAPSHOT_INVALID");
  }

  const activeCount = copyCount(candidate.activeCount);
  const canceledCount = copyCount(candidate.canceledCount);
  const failedCount = copyCount(candidate.failedCount);
  const pausedCount = copyCount(candidate.pausedCount);
  const queuedCount = copyCount(candidate.queuedCount);
  const succeededCount = copyCount(candidate.succeededCount);
  const aggregatePercent = copyPercent(candidate.aggregatePercent);
  const progressMode = candidate.progressMode as DownloadProgressMode;
  const items = candidate.items.map(copyItem);
  const ids = new Set(items.map((item) => item.id));

  if (
    ids.size !== items.length ||
    (progressMode === "determinate") !== (aggregatePercent !== null) ||
    (activeCount === 0 && progressMode !== "none") ||
    (activeCount > 0 && progressMode === "none")
  ) {
    throw createStateError("FENNEVIA_DOWNLOAD_STATE_SNAPSHOT_INVALID");
  }

  const countsByState: Readonly<Record<DownloadItemState, number>> = {
    active: activeCount,
    canceled: canceledCount,
    failed: failedCount,
    paused: pausedCount,
    queued: queuedCount,
    succeeded: succeededCount,
  };
  for (const state of downloadItemStates) {
    if (
      items.filter((item) => item.state === state).length > countsByState[state]
    ) {
      throw createStateError("FENNEVIA_DOWNLOAD_STATE_ITEMS_INVALID");
    }
  }

  return Object.freeze({
    activeCount,
    aggregatePercent,
    canceledCount,
    countOverflow: candidate.countOverflow,
    failedCount,
    items: Object.freeze(items),
    pausedCount,
    phase: candidate.phase,
    progressMode,
    queuedCount,
    revision: candidate.revision as number,
    succeededCount,
    truncated: candidate.truncated,
  });
}

const createDisposedState = (revision: number): BrowserDownloadsState =>
  Object.freeze({
    activeCount: 0,
    aggregatePercent: null,
    canceledCount: 0,
    countOverflow: false,
    failedCount: 0,
    items: Object.freeze([]),
    pausedCount: 0,
    phase: "disposed",
    progressMode: "none",
    queuedCount: 0,
    revision,
    succeededCount: 0,
    truncated: false,
  });

export function createBrowserDownloadsStateAdapter(
  bridge: BrowserDownloadsBridge,
): BrowserDownloadsStateAdapter {
  if (
    !bridge ||
    typeof bridge !== "object" ||
    typeof bridge.ready !== "function" ||
    typeof bridge.snapshot !== "function" ||
    typeof bridge.subscribe !== "function"
  ) {
    throw createStateError("FENNEVIA_DOWNLOAD_STATE_BRIDGE_INVALID");
  }

  let activeBridge: BrowserDownloadsBridge | null = bridge;
  let disposed = false;
  let state: BrowserDownloadsState = copyBrowserDownloadsSnapshot(
    bridge.snapshot(),
  );
  const listeners = new Set<(state: BrowserDownloadsState) => void>();

  const requireBridge = (): BrowserDownloadsBridge => {
    if (disposed || !activeBridge) {
      throw createStateError("FENNEVIA_DOWNLOAD_STATE_DISPOSED");
    }
    return activeBridge;
  };

  const publish = (candidate: unknown): void => {
    if (disposed) {
      return;
    }
    const next = copyBrowserDownloadsSnapshot(candidate);
    if (next.revision <= state.revision) {
      if (next.revision < state.revision) {
        throw createStateError("FENNEVIA_DOWNLOAD_STATE_REVISION_INVALID");
      }
      return;
    }
    state = next;
    for (const listener of Array.from(listeners)) {
      listener(state);
    }
  };

  const unsubscribeBridge = bridge.subscribe(publish);
  if (typeof unsubscribeBridge !== "function") {
    throw createStateError("FENNEVIA_DOWNLOAD_STATE_SUBSCRIPTION_INVALID");
  }

  const readyPromise = (async (): Promise<true> => {
    await requireBridge().ready();
    if (disposed) {
      return true;
    }
    const next = copyBrowserDownloadsSnapshot(requireBridge().snapshot());
    if (next.phase !== "ready") {
      throw createStateError("FENNEVIA_DOWNLOAD_STATE_NOT_READY");
    }
    if (next.revision > state.revision) {
      publish(next);
    }
    return true;
  })();
  void readyPromise.catch(() => undefined);

  return Object.freeze({
    dispose(): boolean {
      if (disposed) {
        return false;
      }
      disposed = true;
      activeBridge = null;
      unsubscribeBridge();
      listeners.clear();
      state = createDisposedState(state.revision + 1);
      return true;
    },

    ready(): Promise<true> {
      requireBridge();
      return readyPromise;
    },

    snapshot(): BrowserDownloadsState {
      return state;
    },

    status() {
      return Object.freeze({
        disposed,
        phase: state.phase,
        revision: state.revision,
        subscriberCount: listeners.size,
      });
    },

    subscribe(listener: (state: BrowserDownloadsState) => void): () => boolean {
      requireBridge();
      if (typeof listener !== "function") {
        throw createStateError("FENNEVIA_DOWNLOAD_STATE_LISTENER_INVALID");
      }
      listeners.add(listener);
      let subscribed = true;
      return Object.freeze(() => {
        if (!subscribed) {
          return false;
        }
        subscribed = false;
        listeners.delete(listener);
        return true;
      });
    },
  });
}
