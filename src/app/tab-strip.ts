import type { TabSnapshot } from "./tab-state";
import { interpolate } from "./i18n.ts";

export const untitledTabLabel = "Untitled tab";
export const newTabHighlightDurationMs = 500;

export type TabStripLabels = Readonly<{
  allowMedia: string;
  attention: string;
  cameraInUse: string;
  close: string;
  crashed: string;
  indexOf: string;
  loading: string;
  mediaBlocked: string;
  microphoneInUse: string;
  mute: string;
  muted: string;
  pin: string;
  pinned: string;
  pip: string;
  playing: string;
  screenSharing: string;
  unmute: string;
  unpin: string;
  untitled: string;
}>;

export const defaultTabStripLabels: TabStripLabels = Object.freeze({
  allowMedia: "Allow media for",
  attention: "Attention",
  cameraInUse: "Using camera",
  close: "Close",
  crashed: "Crashed",
  indexOf: "{index} of {total}",
  loading: "Loading",
  mediaBlocked: "Media blocked",
  microphoneInUse: "Using microphone",
  mute: "Mute",
  muted: "Muted",
  pin: "Pin",
  pinned: "Pinned",
  pip: "Picture in picture",
  playing: "Playing",
  screenSharing: "Sharing screen",
  unmute: "Unmute",
  unpin: "Unpin",
  untitled: untitledTabLabel,
});

export type TabStripKeyAction =
  | Readonly<{ tabId: string; type: "close" }>
  | Readonly<{ tabId: string; type: "select" }>;

export type TabDropPreview = Readonly<{
  index: number;
  position: "after" | "before";
}> | null;

export type TabDragShift = "down" | "up" | null;

export function getDisplayTabTitle(
  tab: TabSnapshot,
  labels: TabStripLabels = defaultTabStripLabels,
): string {
  return tab.title.trim().length === 0 ? labels.untitled : tab.title;
}

export function getTabAccessibleName(
  tab: TabSnapshot,
  index: number,
  tabCount: number,
  labels: TabStripLabels = defaultTabStripLabels,
): string {
  const audioLabel =
    tab.audio === "playing"
      ? labels.playing
      : tab.audio === "muted"
        ? labels.muted
        : tab.audio === "blocked"
          ? labels.mediaBlocked
          : undefined;
  const sharingLabel =
    tab.sharing === "camera"
      ? labels.cameraInUse
      : tab.sharing === "microphone"
        ? labels.microphoneInUse
        : tab.sharing === "screen"
          ? labels.screenSharing
          : undefined;
  const states = [
    interpolate(labels.indexOf, { index: index + 1, total: tabCount }),
    tab.pinned ? labels.pinned : undefined,
    tab.crashed ? labels.crashed : undefined,
    tab.loading ? labels.loading : undefined,
    audioLabel,
    sharingLabel,
    tab.attention ? labels.attention : undefined,
    tab.pictureInPicture ? labels.pip : undefined,
    tab.container?.label,
  ].filter((state): state is string => state !== undefined);
  return `${getDisplayTabTitle(tab, labels)}, ${states.join(", ")}`;
}

export function getTabActionAccessibleName(
  action: "close" | "mute" | "pin" | "resume-media" | "unmute" | "unpin",
  tab: TabSnapshot,
  labels: TabStripLabels = defaultTabStripLabels,
): string {
  const verb =
    action === "close"
      ? labels.close
      : action === "pin"
        ? labels.pin
        : action === "unpin"
          ? labels.unpin
          : action === "mute"
            ? labels.mute
            : action === "unmute"
              ? labels.unmute
              : labels.allowMedia;
  return `${verb} ${getDisplayTabTitle(tab, labels)}`;
}

export function getTabAudioAction(
  tab: TabSnapshot,
): "mute" | "resume-media" | "unmute" | null {
  if (tab.audio === "blocked") {
    return "resume-media";
  }
  if (tab.audio === "muted") {
    return "unmute";
  }
  if (tab.audio === "playing") {
    return "mute";
  }
  return null;
}

export function resolveRovingTabId(
  tabs: readonly TabSnapshot[],
  preferredTabId?: string | null,
): string | null {
  if (
    preferredTabId &&
    tabs.some((candidate) => candidate.id === preferredTabId)
  ) {
    return preferredTabId;
  }
  return tabs.find((tab) => tab.selected)?.id ?? tabs[0]?.id ?? null;
}

export function findOpenedTabIds(
  previousTabs: readonly TabSnapshot[],
  nextTabs: readonly TabSnapshot[],
): readonly string[] {
  const previousIds = new Set(previousTabs.map((tab) => tab.id));
  return Object.freeze(
    nextTabs.filter((tab) => !previousIds.has(tab.id)).map((tab) => tab.id),
  );
}

export function isDraggedTabMissing(
  tabs: readonly TabSnapshot[],
  draggingTabId: string | null,
): boolean {
  return (
    draggingTabId !== null &&
    !tabs.some((candidate) => candidate.id === draggingTabId)
  );
}

export function findCloseFocusTarget(
  tabs: readonly TabSnapshot[],
  tabId: string,
): string | null {
  const index = tabs.findIndex((tab) => tab.id === tabId);
  if (index < 0) {
    return resolveRovingTabId(tabs);
  }
  return tabs[index + 1]?.id ?? tabs[index - 1]?.id ?? null;
}

export function findTabMoveIndex(
  tabs: readonly TabSnapshot[],
  tabId: string,
  delta: -1 | 1,
): number | null {
  const index = tabs.findIndex((tab) => tab.id === tabId);
  const tab = index < 0 ? undefined : tabs[index];
  const neighbor = tab === undefined ? undefined : tabs[index + delta];
  if (!tab || !neighbor || neighbor.pinned !== tab.pinned) {
    return null;
  }
  return index + delta;
}

export function resolveTabDropIndex(
  tabs: readonly TabSnapshot[],
  draggingTabId: string,
  itemMids: readonly number[],
  pointerY: number,
): number | null {
  const draggingIndex = tabs.findIndex((tab) => tab.id === draggingTabId);
  if (
    draggingIndex < 0 ||
    itemMids.length !== tabs.length ||
    !Number.isFinite(pointerY)
  ) {
    return null;
  }
  const dragging = tabs[draggingIndex];
  if (!dragging) {
    return null;
  }

  let insertBefore = tabs.length;
  for (const [index, midpoint] of itemMids.entries()) {
    if (pointerY < midpoint) {
      insertBefore = index;
      break;
    }
  }

  let targetIndex =
    insertBefore > draggingIndex ? insertBefore - 1 : insertBefore;
  const pinnedCount = tabs.filter((tab) => tab.pinned).length;
  if (dragging.pinned) {
    targetIndex = Math.min(
      Math.max(targetIndex, 0),
      Math.max(pinnedCount - 1, 0),
    );
  } else {
    targetIndex = Math.min(Math.max(targetIndex, pinnedCount), tabs.length - 1);
  }
  return targetIndex === draggingIndex ? null : targetIndex;
}

export function resolveTabDropPreview(
  tabs: readonly TabSnapshot[],
  draggingTabId: string,
  targetIndex: number | null,
): TabDropPreview {
  const draggingIndex = tabs.findIndex((tab) => tab.id === draggingTabId);
  if (
    draggingIndex < 0 ||
    targetIndex === null ||
    !Number.isSafeInteger(targetIndex) ||
    targetIndex < 0 ||
    targetIndex >= tabs.length ||
    targetIndex === draggingIndex
  ) {
    return null;
  }
  return Object.freeze({
    index: targetIndex,
    position: targetIndex < draggingIndex ? "before" : "after",
  });
}

export function resolveTabDragShift(
  tabs: readonly TabSnapshot[],
  draggingTabId: string,
  targetIndex: number | null,
  itemIndex: number,
): TabDragShift {
  const draggingIndex = tabs.findIndex((tab) => tab.id === draggingTabId);
  if (
    draggingIndex < 0 ||
    targetIndex === null ||
    !Number.isSafeInteger(targetIndex) ||
    targetIndex < 0 ||
    targetIndex >= tabs.length ||
    targetIndex === draggingIndex ||
    !Number.isSafeInteger(itemIndex) ||
    itemIndex < 0 ||
    itemIndex >= tabs.length
  ) {
    return null;
  }
  if (
    targetIndex < draggingIndex &&
    itemIndex >= targetIndex &&
    itemIndex < draggingIndex
  ) {
    return "down";
  }
  if (
    targetIndex > draggingIndex &&
    itemIndex > draggingIndex &&
    itemIndex <= targetIndex
  ) {
    return "up";
  }
  return null;
}

export function resolveExternalTabDropIndex(
  tabs: readonly TabSnapshot[],
  itemMids: readonly number[],
  pointerY: number,
  pinned: boolean,
): number | null {
  if (itemMids.length !== tabs.length || !Number.isFinite(pointerY)) {
    return null;
  }

  let insertBefore = tabs.length;
  for (const [index, midpoint] of itemMids.entries()) {
    if (!Number.isFinite(midpoint)) {
      return null;
    }
    if (pointerY < midpoint) {
      insertBefore = index;
      break;
    }
  }

  const pinnedCount = tabs.filter((tab) => tab.pinned).length;
  return pinned
    ? Math.min(Math.max(insertBefore, 0), pinnedCount)
    : Math.min(Math.max(insertBefore, pinnedCount), tabs.length);
}

export function resolveExternalTabDragShift(
  tabs: readonly TabSnapshot[],
  targetIndex: number | null,
  itemIndex: number,
): TabDragShift {
  if (
    targetIndex === null ||
    !Number.isSafeInteger(targetIndex) ||
    targetIndex < 0 ||
    targetIndex > tabs.length ||
    !Number.isSafeInteger(itemIndex) ||
    itemIndex < 0 ||
    itemIndex >= tabs.length
  ) {
    return null;
  }
  return itemIndex >= targetIndex ? "down" : null;
}

export function resolveDraggedTabTranslateY(
  originalTop: number,
  pointerY: number,
  pointerOffsetY: number,
  minimumTop: number,
  maximumTop: number,
): number | null {
  if (
    !Number.isFinite(originalTop) ||
    !Number.isFinite(pointerY) ||
    !Number.isFinite(pointerOffsetY) ||
    pointerOffsetY < 0 ||
    !Number.isFinite(minimumTop) ||
    !Number.isFinite(maximumTop) ||
    minimumTop > maximumTop
  ) {
    return null;
  }
  const desiredTop = Math.min(
    Math.max(pointerY - pointerOffsetY, minimumTop),
    maximumTop,
  );
  return desiredTop - originalTop;
}

export function getTabStripKeyAction(
  tabs: readonly TabSnapshot[],
  currentTabId: string,
  key: string,
  direction: "ltr" | "rtl" = "ltr",
  orientation: "horizontal" | "vertical" = "horizontal",
): TabStripKeyAction | null {
  const currentIndex = tabs.findIndex((tab) => tab.id === currentTabId);
  if (currentIndex < 0 || tabs.length === 0) {
    return null;
  }

  if (key === "Delete") {
    return Object.freeze({ tabId: currentTabId, type: "close" });
  }
  if (key === "Enter" || key === " ") {
    return Object.freeze({ tabId: currentTabId, type: "select" });
  }

  let targetIndex: number | undefined;
  if (key === "Home") {
    targetIndex = 0;
  } else if (key === "End") {
    targetIndex = tabs.length - 1;
  } else if (
    orientation === "vertical" &&
    (key === "ArrowUp" || key === "ArrowDown")
  ) {
    const delta = key === "ArrowDown" ? 1 : -1;
    targetIndex = (currentIndex + delta + tabs.length) % tabs.length;
  } else if (
    orientation === "horizontal" &&
    (key === "ArrowLeft" || key === "ArrowRight")
  ) {
    const logicalDelta = key === "ArrowRight" ? 1 : -1;
    const delta = direction === "rtl" ? -logicalDelta : logicalDelta;
    targetIndex = (currentIndex + delta + tabs.length) % tabs.length;
  }

  const target = targetIndex === undefined ? undefined : tabs[targetIndex];
  return target ? Object.freeze({ tabId: target.id, type: "select" }) : null;
}
