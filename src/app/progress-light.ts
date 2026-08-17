import type { DownloadProgressMode } from "./download-state.ts";

export const progressLightKinds = ["load", "download"] as const;

export type ProgressLightKind = (typeof progressLightKinds)[number];

export type ProgressLightMode = "determinate" | "idle" | "indeterminate";

export type ProgressLightPresentation = Readonly<{
  kind: ProgressLightKind;
  mode: ProgressLightMode;
  percent: number | null;
}>;

export type DownloadProgressLightInput = Readonly<{
  activeCount: number;
  aggregatePercent: number | null;
  progressMode: DownloadProgressMode;
}>;

const idleLoad = Object.freeze({
  kind: "load",
  mode: "idle",
  percent: null,
}) satisfies ProgressLightPresentation;

const idleDownload = Object.freeze({
  kind: "download",
  mode: "idle",
  percent: null,
}) satisfies ProgressLightPresentation;

export function resolveLoadProgressLight(
  loading: boolean,
): ProgressLightPresentation {
  if (loading !== true) {
    return idleLoad;
  }
  return Object.freeze({
    kind: "load",
    mode: "indeterminate",
    percent: null,
  });
}

export function resolveDownloadProgressLight(
  snapshot: DownloadProgressLightInput | null | undefined,
): ProgressLightPresentation {
  if (!snapshot || snapshot.activeCount < 1) {
    return idleDownload;
  }
  if (
    snapshot.progressMode === "determinate" &&
    snapshot.aggregatePercent !== null
  ) {
    return Object.freeze({
      kind: "download",
      mode: "determinate",
      percent: snapshot.aggregatePercent,
    });
  }
  return Object.freeze({
    kind: "download",
    mode: "indeterminate",
    percent: null,
  });
}
