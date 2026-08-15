import type { TabSnapshot } from "./tab-state";

export const untitledTabLabel = "Untitled tab";

export type TabStripKeyAction =
  | Readonly<{ tabId: string; type: "close" }>
  | Readonly<{ tabId: string; type: "select" }>;

export function getDisplayTabTitle(tab: TabSnapshot): string {
  return tab.title.trim().length === 0 ? untitledTabLabel : tab.title;
}

export function getTabAccessibleName(
  tab: TabSnapshot,
  index: number,
  tabCount: number,
): string {
  const states = [
    `${index + 1} of ${tabCount}`,
    tab.pinned ? "Pinned" : undefined,
    tab.loading ? "Loading" : undefined,
  ].filter((state): state is string => state !== undefined);
  return `${getDisplayTabTitle(tab)}, ${states.join(", ")}`;
}

export function getTabActionAccessibleName(
  action: "close" | "pin" | "unpin",
  tab: TabSnapshot,
): string {
  const verb =
    action === "close" ? "Close" : action === "pin" ? "Pin" : "Unpin";
  return `${verb} ${getDisplayTabTitle(tab)}`;
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
