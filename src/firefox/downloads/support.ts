// SPDX-License-Identifier: MPL-2.0
import type {
  BrowserDownloadsSnapshot,
  DownloadItemState,
} from "../../app/download-state.ts";
import { maximumDownloadCount } from "../../app/download-state.ts";
import {
  FirefoxBridgeError,
  type FirefoxBridgeBoundary,
  type FirefoxBridgeErrorContext,
  type FirefoxCapabilitySnapshot,
} from "../bridge-boundary.ts";

export const DOWNLOADS_URI = "resource://gre/modules/Downloads.sys.mjs";
export const MAXIMUM_RECENT_TERMINAL_DOWNLOADS = 3;

export type NativeRecord = Record<string, unknown>;
export type NativeModuleLoader = (uri: string) => unknown;
export type NativeDownload = NativeRecord & {
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
export type NativeDownloadView = Readonly<{
  onDownloadAdded: (download: unknown) => void;
  onDownloadBatchEnded: () => void;
  onDownloadBatchStarting: () => void;
  onDownloadChanged: (download: unknown) => void;
  onDownloadRemoved: (download: unknown) => void;
}>;
export type NativeDownloadList = NativeRecord & {
  addView: (view: NativeDownloadView) => unknown;
  removeView: (view: NativeDownloadView) => unknown;
};
export type NativeDownloads = NativeRecord & {
  PRIVATE: unknown;
  PUBLIC: unknown;
  getList: (type: unknown) => Promise<unknown>;
};
export type TrackedDownload = {
  currentBytes: number;
  download: NativeDownload;
  hasProgress: boolean;
  id: string;
  order: number;
  progressPercent: number | null;
  state: DownloadItemState;
  totalBytes: number;
};

export type DownloadsCapabilityEvaluation = Readonly<{
  cause?: unknown;
  snapshot: FirefoxCapabilitySnapshot;
}>;

export type DownloadsCapabilitySpecification = Readonly<{
  isAvailable: (value: unknown) => boolean;
  name: string;
  read: () => unknown;
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

export const createDownloadsError = (
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

export const isValidByteCount = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Number.isSafeInteger(value) &&
  value >= 0;

export const asDownload = (
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

export const classifyDownload = (
  download: NativeDownload,
): DownloadItemState => {
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

export const isTerminalState = (state: DownloadItemState): boolean =>
  state === "succeeded" || state === "failed" || state === "canceled";

export const boundedCount = (value: number): number =>
  Math.min(value, maximumDownloadCount);

export const createInitialSnapshot = (): BrowserDownloadsSnapshot =>
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
