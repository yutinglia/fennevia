<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import { onDestroy, tick, untrack } from "svelte";

  import type { EdgeShellController } from "../../../app/edge-surfaces";
  import {
    translate,
    type MessageKey,
    type MessageVars,
  } from "../../../app/i18n";
  import type { FenneviaLocale } from "../../../app/locale-state";
  import {
    TAB_DRAG_MIME_TYPE,
    createBrowserTabsState,
    type BrowserTabsState,
    type BrowserTabsStateAdapter,
    type TabDragSnapshot,
    type TabSharingState,
    type TabSnapshot,
  } from "../../../app/tab-state";
  import {
    findCloseFocusTarget,
    findOpenedTabIds,
    findTabMoveIndex,
    getDisplayTabTitle,
    getTabAccessibleName,
    getTabActionAccessibleName,
    getTabAudioAction,
    getTabStripKeyAction,
    isDraggedTabMissing,
    newTabHighlightDurationMs,
    resolveDraggedTabTranslateY,
    resolveRovingTabId,
    resolveExternalTabDragShift,
    resolveExternalTabDropIndex,
    resolveTabDragShift,
    resolveTabDropIndex,
    resolveTabDropPreview,
    type TabDropPreview,
  } from "../../../app/tab-strip";
  import FirefoxIcon, { type FirefoxIconName } from "../../FirefoxIcon.svelte";
  import { createTabStripLabels } from "../../locale-ui";

  type Props = Readonly<{
    edge: "left" | "right";
    localeId: FenneviaLocale;
    onFatalError: (error: unknown) => void;
    shell: EdgeShellController;
    tabs: BrowserTabsStateAdapter;
  }>;

  type DelayedTimer = {
    id: number;
    view: Window;
  };

  type PointerInteraction = Readonly<{
    clientX: number;
    clientY: number;
    focusTarget: HTMLElement | null;
  }>;

  const closeFocusRetryDelayMs = 200;
  const props: Props = $props();
  const t = (key: MessageKey, vars?: MessageVars): string =>
    translate(props.localeId, key, vars);

  let currentTabs: BrowserTabsState = $state(createBrowserTabsState([]));
  let rovingTabId: string | null = $state(null);
  let highlightedTabIds: readonly string[] = $state([]);
  let draggingTabId: string | null = $state(null);
  let sourceDragId: string | null = $state(null);
  let externalDrag: TabDragSnapshot | null = $state(null);
  let dragTargetIndex: number | null = $state(null);
  let draggedTabTranslateY: number | null = $state(null);
  let dropPreview: TabDropPreview = $state(null);
  let dropMarkerTop: number | null = $state(null);
  let reorderAnnouncement = $state("");
  let tabStripElement: HTMLDivElement | undefined = $state();
  let delayedFocusTimer: DelayedTimer | undefined;
  let highlightTimer: DelayedTimer | undefined;
  let dragHoldActive = false;
  const dragGeometry = {
    appendTop: 0,
    dragId: null as string | null,
    itemHeights: [] as readonly number[],
    itemMids: [] as readonly number[],
    itemTops: [] as readonly number[],
    listScrollTop: 0,
    listTop: 0,
    pointerOffsetY: null as number | null,
    tabIds: [] as readonly string[],
  };
  const tabButtons: Array<{
    node: HTMLButtonElement;
    tabId: string;
  }> = [];

  let tabLabels = $derived(createTabStripLabels(props.localeId));
  let externalPreviewTransform = $derived.by(() => {
    if (!externalDrag || dragTargetIndex === null || dropMarkerTop === null) {
      return undefined;
    }
    return dragTargetIndex === currentTabs.tabs.length &&
      currentTabs.tabs.length > 0
      ? `translateY(calc(${dropMarkerTop}px + var(--fennevia-space-1)))`
      : `translateY(${dropMarkerTop}px)`;
  });

  const getAudioIconName = (
    action: "mute" | "resume-media" | "unmute",
  ): FirefoxIconName =>
    action === "unmute"
      ? ("tab-audio-muted" as const)
      : action === "resume-media"
        ? ("tab-audio-blocked" as const)
        : ("tab-audio-playing" as const);

  const getSharingIconName = (sharing: TabSharingState): FirefoxIconName =>
    sharing === "screen" ? ("screen-share" as const) : sharing;

  const reportAsyncError = (work: Promise<unknown>): void => {
    void work.catch(props.onFatalError);
  };

  $effect(() => {
    const initialTabs = props.tabs.snapshot();
    currentTabs = initialTabs;
    rovingTabId = resolveRovingTabId(
      initialTabs.tabs,
      untrack(() => rovingTabId),
    );
    return props.tabs.subscribe((nextState) => {
      const openedTabIds = findOpenedTabIds(currentTabs.tabs, nextState.tabs);
      const sourceTabLeftWindow =
        sourceDragId !== null &&
        isDraggedTabMissing(nextState.tabs, draggingTabId);
      currentTabs = nextState;
      rovingTabId = resolveRovingTabId(nextState.tabs, rovingTabId);
      if (sourceTabLeftWindow) {
        clearTabDrag();
        reportAsyncError(tick().then(releaseSurfaceFocus));
      }
      if (openedTabIds.length > 0) {
        reportAsyncError(revealOpenedTabs(openedTabIds));
      }
    });
  });

  const registerTabButton = (node: HTMLButtonElement, tabId: string) => {
    const registration = { node, tabId };
    tabButtons.push(registration);
    return {
      destroy() {
        const index = tabButtons.indexOf(registration);
        if (index >= 0) {
          tabButtons.splice(index, 1);
        }
      },
      update(nextTabId: string) {
        registration.tabId = nextTabId;
      },
    };
  };

  const focusTab = async (tabId: string | null) => {
    if (!tabId) {
      return;
    }
    rovingTabId = tabId;
    await tick();
    const button = tabButtons.find(
      (registration) => registration.tabId === tabId,
    )?.node;
    if (button?.isConnected) {
      button.focus({ preventScroll: true });
      button.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  };

  const cancelDelayedFocus = () => {
    const timer = delayedFocusTimer;
    if (!timer) {
      return;
    }
    delayedFocusTimer = undefined;
    timer.view.clearTimeout(timer.id);
  };

  const cancelHighlight = () => {
    const timer = highlightTimer;
    if (!timer) {
      return;
    }
    highlightTimer = undefined;
    timer.view.clearTimeout(timer.id);
  };

  async function revealOpenedTabs(tabIds: readonly string[]) {
    cancelHighlight();
    highlightedTabIds = tabIds;
    try {
      props.shell.revealProgrammatically(props.edge, newTabHighlightDurationMs);
    } catch (error) {
      props.onFatalError(error);
      return;
    }
    await tick();
    const preferredTabId =
      tabIds.find((tabId) =>
        currentTabs.tabs.some((tab) => tab.id === tabId && tab.selected),
      ) ?? tabIds.at(-1);
    const button = tabButtons.find(
      (registration) => registration.tabId === preferredTabId,
    )?.node;
    if (button?.isConnected) {
      button.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    const view = tabStripElement?.ownerDocument.defaultView;
    if (!view) {
      highlightedTabIds = [];
      return;
    }
    const timer: DelayedTimer = { id: 0, view };
    timer.id = view.setTimeout(() => {
      if (highlightTimer !== timer) {
        return;
      }
      highlightTimer = undefined;
      highlightedTabIds = [];
    }, newTabHighlightDurationMs);
    highlightTimer = timer;
  }

  const releaseSurfaceFocus = () => {
    if (delayedFocusTimer) {
      return;
    }
    const surfaceRoot = tabStripElement?.closest<HTMLElement>(
      "[data-fennevia-surface-root]",
    );
    if (
      surfaceRoot?.contains(surfaceRoot.ownerDocument.activeElement ?? null)
    ) {
      return;
    }
    props.shell.setFocusHeld(props.edge, false);
    props.shell.releaseKeyboard(props.edge);
    rovingTabId = resolveRovingTabId(currentTabs.tabs);
  };

  const restoreFocusAfterClose = (tabId: string | null) => {
    cancelDelayedFocus();
    reportAsyncError(focusTab(tabId));
    const view = tabStripElement?.ownerDocument.defaultView;
    if (!view || !tabId) {
      return;
    }
    const timer: DelayedTimer = { id: 0, view };
    timer.id = view.setTimeout(() => {
      if (delayedFocusTimer !== timer) {
        return;
      }
      delayedFocusTimer = undefined;
      reportAsyncError(
        focusTab(resolveRovingTabId(currentTabs.tabs, tabId)).then(
          releaseSurfaceFocus,
        ),
      );
    }, closeFocusRetryDelayMs);
    delayedFocusTimer = timer;
  };

  const pointerInteractionFromMouseEvent = (
    event: MouseEvent,
  ): PointerInteraction | null => {
    const pointerType = (event as PointerEvent).pointerType;
    if (
      pointerType === "touch" ||
      (event.button !== 0 && event.button !== 1) ||
      (event.button === 0 &&
        event.detail === 0 &&
        event.clientX === 0 &&
        event.clientY === 0) ||
      !Number.isFinite(event.clientX) ||
      !Number.isFinite(event.clientY)
    ) {
      return null;
    }
    return Object.freeze({
      clientX: event.clientX,
      clientY: event.clientY,
      focusTarget:
        event.currentTarget instanceof HTMLElement ? event.currentTarget : null,
    });
  };

  const restorePointerInteractionAfterMutation = async (
    interaction: PointerInteraction,
  ) => {
    await tick();
    const surfacePanel = tabStripElement?.closest<HTMLElement>(
      `[data-fennevia-edge-panel="${props.edge}"]`,
    );
    if (!surfacePanel?.isConnected) {
      return;
    }
    const pointerTarget = surfacePanel.ownerDocument.elementFromPoint(
      interaction.clientX,
      interaction.clientY,
    );
    if (pointerTarget && surfacePanel.contains(pointerTarget)) {
      props.shell.setPointerHeld(props.edge, true);
    } else {
      props.shell.releasePointer(props.edge, "inside-window");
    }
    if (
      interaction.focusTarget?.isConnected &&
      surfacePanel.ownerDocument.activeElement === interaction.focusTarget
    ) {
      interaction.focusTarget.blur();
    }
    releaseSurfaceFocus();
  };

  const selectTab = (
    tabId: string,
    pointerInteraction: PointerInteraction | null = null,
  ) => {
    cancelDelayedFocus();
    rovingTabId = tabId;
    if (pointerInteraction) {
      props.shell.setPointerHeld(props.edge, true);
    }
    props.tabs.select(tabId);
    reportAsyncError(
      pointerInteraction
        ? restorePointerInteractionAfterMutation(pointerInteraction)
        : focusTab(tabId),
    );
  };

  const openTab = () => {
    cancelDelayedFocus();
    const openedTabId = props.tabs.open({ selected: true });
    reportAsyncError(focusTab(openedTabId));
  };

  const closeTab = (
    tabId: string,
    pointerInteraction: PointerInteraction | null = null,
  ) => {
    cancelDelayedFocus();
    const focusTarget = findCloseFocusTarget(currentTabs.tabs, tabId);
    rovingTabId = focusTarget;
    if (pointerInteraction) {
      props.shell.setPointerHeld(props.edge, true);
    }
    props.tabs.close(tabId);
    if (pointerInteraction) {
      reportAsyncError(
        restorePointerInteractionAfterMutation(pointerInteraction),
      );
    } else {
      restoreFocusAfterClose(resolveRovingTabId(currentTabs.tabs, focusTarget));
    }
  };

  const togglePinned = (tab: TabSnapshot) => {
    cancelDelayedFocus();
    rovingTabId = tab.id;
    if (tab.pinned) {
      props.tabs.unpin(tab.id);
    } else {
      props.tabs.pin(tab.id);
    }
    reportAsyncError(focusTab(tab.id));
  };

  const announceTabMove = (tabId: string, targetIndex: number) => {
    const tab = currentTabs.tabs.find((candidate) => candidate.id === tabId);
    if (!tab) {
      return;
    }
    reorderAnnouncement = t("tab.reordered", {
      index: targetIndex + 1,
      title: getDisplayTabTitle(tab, tabLabels),
      total: currentTabs.tabs.length,
    });
  };

  const handleTabKeydown = (event: KeyboardEvent, tabId: string) => {
    if (
      event.ctrlKey &&
      event.shiftKey &&
      !event.altKey &&
      !event.metaKey &&
      (event.key === "ArrowUp" || event.key === "ArrowDown")
    ) {
      const targetIndex = findTabMoveIndex(
        currentTabs.tabs,
        tabId,
        event.key === "ArrowDown" ? 1 : -1,
      );
      if (targetIndex === null) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      cancelDelayedFocus();
      try {
        props.tabs.move(tabId, targetIndex);
        announceTabMove(tabId, targetIndex);
      } catch (error) {
        props.onFatalError(error);
        return;
      }
      reportAsyncError(focusTab(tabId));
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    const action = getTabStripKeyAction(
      currentTabs.tabs,
      tabId,
      event.key,
      "ltr",
      "vertical",
    );
    if (!action) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (action.type === "close") {
      closeTab(action.tabId);
    } else {
      selectTab(action.tabId);
    }
  };

  const handleTabAuxClick = (event: MouseEvent, tabId: string) => {
    if (event.button !== 1) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    closeTab(tabId, pointerInteractionFromMouseEvent(event));
  };

  const handleTabContextMenu = (event: MouseEvent, tabId: string) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      props.tabs.openContextMenu(tabId, {
        screenX: event.screenX,
        screenY: event.screenY,
      });
    } catch (error) {
      props.onFatalError(error);
    }
  };

  const handleTabAudioAction = (event: MouseEvent, tabId: string) => {
    event.stopPropagation();
    cancelDelayedFocus();
    try {
      props.tabs.toggleMute(tabId);
    } catch (error) {
      props.onFatalError(error);
      return;
    }
    reportAsyncError(focusTab(tabId));
  };

  const setDragHold = (active: boolean) => {
    if (dragHoldActive === active) {
      return;
    }
    dragHoldActive = active;
    props.shell.setPointerHeld(props.edge, active);
  };

  const clearDragGeometry = () => {
    dragGeometry.appendTop = 0;
    dragGeometry.dragId = null;
    dragGeometry.itemHeights = [];
    dragGeometry.itemMids = [];
    dragGeometry.itemTops = [];
    dragGeometry.listScrollTop = 0;
    dragGeometry.listTop = 0;
    dragGeometry.pointerOffsetY = null;
    dragGeometry.tabIds = [];
  };

  const clearDropTarget = () => {
    dragTargetIndex = null;
    draggedTabTranslateY = null;
    dropPreview = null;
    dropMarkerTop = null;
  };

  function clearTabDrag() {
    draggingTabId = null;
    sourceDragId = null;
    externalDrag = null;
    clearDropTarget();
    clearDragGeometry();
    setDragHold(false);
  }

  const captureDragGeometry = (
    list: HTMLElement,
    dragId: string,
    localDrag?: Readonly<{ pointerY: number; tabId: string }>,
  ): boolean => {
    const listBounds = list.getBoundingClientRect();
    const items = Array.from(
      list.querySelectorAll<HTMLElement>("[data-fennevia-tab-item]"),
    );
    if (items.length !== currentTabs.tabs.length) {
      clearDragGeometry();
      return false;
    }
    const itemBounds = items.map((item) => item.getBoundingClientRect());
    const localDragIndex = localDrag
      ? currentTabs.tabs.findIndex((tab) => tab.id === localDrag.tabId)
      : -1;
    if (
      localDrag &&
      (localDragIndex < 0 || !Number.isFinite(localDrag.pointerY))
    ) {
      clearDragGeometry();
      return false;
    }
    dragGeometry.appendTop =
      (itemBounds.at(-1)?.bottom ?? listBounds.top) -
      listBounds.top +
      list.scrollTop;
    dragGeometry.dragId = dragId;
    dragGeometry.itemHeights = itemBounds.map((bounds) => bounds.height);
    dragGeometry.itemMids = itemBounds.map(
      (bounds) => bounds.top + bounds.height / 2,
    );
    dragGeometry.itemTops = itemBounds.map(
      (bounds) => bounds.top - listBounds.top + list.scrollTop,
    );
    dragGeometry.listScrollTop = list.scrollTop;
    dragGeometry.listTop = listBounds.top;
    const localDragBounds = itemBounds[localDragIndex];
    dragGeometry.pointerOffsetY =
      localDrag && localDragBounds
        ? Math.min(
            localDragBounds.height,
            Math.max(0, localDrag.pointerY - localDragBounds.top),
          )
        : null;
    dragGeometry.tabIds = currentTabs.tabs.map((tab) => tab.id);
    return true;
  };

  const geometryMatches = (dragId: string): boolean =>
    dragGeometry.dragId === dragId &&
    dragGeometry.itemHeights.length === currentTabs.tabs.length &&
    dragGeometry.itemMids.length === currentTabs.tabs.length &&
    dragGeometry.itemTops.length === currentTabs.tabs.length &&
    dragGeometry.tabIds.length === currentTabs.tabs.length &&
    dragGeometry.tabIds.every(
      (dragTabId, index) => dragTabId === currentTabs.tabs[index]?.id,
    );

  const adjustedItemMids = (list: HTMLElement): readonly number[] => {
    const listOffset =
      list.getBoundingClientRect().top -
      dragGeometry.listTop +
      dragGeometry.listScrollTop -
      list.scrollTop;
    return dragGeometry.itemMids.map((midpoint) => midpoint + listOffset);
  };

  const resolveLocalDraggedTranslateY = (
    list: HTMLElement,
    tabId: string,
    dragId: string,
    pointerY: number,
  ): number | null => {
    if (!geometryMatches(dragId) || dragGeometry.pointerOffsetY === null) {
      return null;
    }
    const draggingIndex = currentTabs.tabs.findIndex((tab) => tab.id === tabId);
    const dragging = currentTabs.tabs[draggingIndex];
    const draggedHeight = dragGeometry.itemHeights[draggingIndex];
    const originalTop = dragGeometry.itemTops[draggingIndex];
    if (!dragging || draggedHeight === undefined || originalTop === undefined) {
      return null;
    }
    const pinnedCount = currentTabs.tabs.filter((tab) => tab.pinned).length;
    const partitionStart = dragging.pinned ? 0 : pinnedCount;
    const partitionEnd = dragging.pinned
      ? pinnedCount - 1
      : currentTabs.tabs.length - 1;
    const minimumTop = dragGeometry.itemTops[partitionStart];
    const finalTop = dragGeometry.itemTops[partitionEnd];
    const finalHeight = dragGeometry.itemHeights[partitionEnd];
    if (
      minimumTop === undefined ||
      finalTop === undefined ||
      finalHeight === undefined
    ) {
      return null;
    }
    const maximumTop = Math.max(
      minimumTop,
      finalTop + finalHeight - draggedHeight,
    );
    const pointerContentY =
      pointerY - list.getBoundingClientRect().top + list.scrollTop;
    return resolveDraggedTabTranslateY(
      originalTop,
      pointerContentY,
      dragGeometry.pointerOffsetY,
      minimumTop,
      maximumTop,
    );
  };

  const hasTabDragMarker = (transfer: DragEvent["dataTransfer"]): boolean =>
    Boolean(
      transfer && Array.from(transfer.types).includes(TAB_DRAG_MIME_TYPE),
    );

  const inspectActiveDrag = (): TabDragSnapshot | null => {
    try {
      return props.tabs.inspectDrag();
    } catch (error) {
      props.onFatalError(error);
      return null;
    }
  };

  const boundedScreenCoordinate = (coordinate: number): number =>
    Number.isFinite(coordinate)
      ? Math.min(100_000, Math.max(-100_000, coordinate))
      : 0;

  const endSourceDrag = (event?: DragEvent, cancelled = false) => {
    const dragId = sourceDragId;
    if (!dragId) {
      clearTabDrag();
      return;
    }
    const firefoxTransfer = event?.dataTransfer as
      | (NonNullable<DragEvent["dataTransfer"]> & {
          mozUserCancelled?: boolean;
        })
      | null
      | undefined;
    try {
      props.tabs.endDrag(dragId, {
        cancelled: cancelled || firefoxTransfer?.mozUserCancelled === true,
        screenX: boundedScreenCoordinate(event?.screenX ?? 0),
        screenY: boundedScreenCoordinate(event?.screenY ?? 0),
      });
    } catch (error) {
      props.onFatalError(error);
    } finally {
      clearTabDrag();
    }
  };

  const handleTabDragStart = (event: DragEvent, tabId: string) => {
    const transfer = event.dataTransfer;
    if (!transfer) {
      event.preventDefault();
      return;
    }

    let dragId: string | null = null;
    try {
      dragId = props.tabs.beginDrag(tabId);
      transfer.effectAllowed = "move";
      transfer.clearData();
      transfer.setData(TAB_DRAG_MIME_TYPE, "1");
      sourceDragId = dragId;
      draggingTabId = tabId;
      externalDrag = null;
      clearDropTarget();
      const dragImage =
        event.currentTarget instanceof HTMLElement
          ? event.currentTarget.closest<HTMLElement>("[data-fennevia-tab-item]")
          : null;
      if (dragImage instanceof HTMLElement) {
        const bounds = dragImage.getBoundingClientRect();
        transfer.setDragImage(
          dragImage,
          Math.min(bounds.width, Math.max(0, event.clientX - bounds.left)),
          Math.min(bounds.height, Math.max(0, event.clientY - bounds.top)),
        );
        const list = dragImage.closest<HTMLElement>("[data-fennevia-tab-list]");
        if (list) {
          captureDragGeometry(list, dragId, {
            pointerY: event.clientY,
            tabId,
          });
        }
      }
      setDragHold(true);
    } catch (error) {
      event.preventDefault();
      if (dragId) {
        try {
          props.tabs.endDrag(dragId, {
            cancelled: true,
            screenX: 0,
            screenY: 0,
          });
        } catch (cleanupError) {
          props.onFatalError(cleanupError);
        }
      }
      clearTabDrag();
      props.onFatalError(error);
    }
  };

  const resolveLocalDragTargetIndex = (
    list: HTMLElement,
    tabId: string,
    dragId: string,
    pointerY: number,
  ): number | null => {
    if (!geometryMatches(dragId)) {
      return null;
    }
    return resolveTabDropIndex(
      currentTabs.tabs,
      tabId,
      adjustedItemMids(list),
      pointerY,
    );
  };

  const resolveExternalDragTargetIndex = (
    list: HTMLElement,
    drag: TabDragSnapshot,
    pointerY: number,
  ): number | null => {
    if (!geometryMatches(drag.id) && !captureDragGeometry(list, drag.id)) {
      return null;
    }
    return resolveExternalTabDropIndex(
      currentTabs.tabs,
      adjustedItemMids(list),
      pointerY,
      drag.pinned,
    );
  };

  const updateDropPreview = (
    drag: TabDragSnapshot,
    targetIndex: number | null,
  ) => {
    dragTargetIndex = targetIndex;
    if (drag.source === "same-window" && draggingTabId) {
      dropPreview = resolveTabDropPreview(
        currentTabs.tabs,
        draggingTabId,
        targetIndex,
      );
      dropMarkerTop =
        dropPreview === null
          ? null
          : (dragGeometry.itemTops[dropPreview.index] ?? null);
      return;
    }
    if (targetIndex === null) {
      dropPreview = null;
      dropMarkerTop = null;
      return;
    }
    const append = targetIndex === currentTabs.tabs.length;
    dropPreview =
      currentTabs.tabs.length === 0
        ? null
        : Object.freeze({
            index: append ? currentTabs.tabs.length - 1 : targetIndex,
            position: append ? "after" : "before",
          });
    dropMarkerTop = append
      ? dragGeometry.appendTop
      : (dragGeometry.itemTops[targetIndex] ?? null);
  };

  const holdExternalDrag = (drag: TabDragSnapshot): boolean => {
    if (drag.source !== "other-window") {
      return false;
    }
    if (externalDrag?.id !== drag.id) {
      clearDropTarget();
      clearDragGeometry();
    }
    externalDrag = drag;
    setDragHold(true);
    return true;
  };

  const previewExternalDragAtEnd = (drag: TabDragSnapshot): void => {
    if (drag.source !== "other-window") {
      clearDropTarget();
      return;
    }
    const list = tabStripElement?.querySelector<HTMLElement>(
      "[data-fennevia-tab-list]",
    );
    if (
      !list ||
      (!geometryMatches(drag.id) && !captureDragGeometry(list, drag.id))
    ) {
      clearDropTarget();
      return;
    }
    updateDropPreview(drag, currentTabs.tabs.length);
  };

  const handleTabListDragOver = (event: DragEvent) => {
    if (!hasTabDragMarker(event.dataTransfer)) {
      return;
    }
    const drag = inspectActiveDrag();
    if (!drag) {
      return;
    }
    const list = event.currentTarget;
    if (!(list instanceof HTMLElement)) {
      clearDropTarget();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    holdExternalDrag(drag);
    draggedTabTranslateY =
      drag.source === "same-window" && draggingTabId
        ? resolveLocalDraggedTranslateY(
            list,
            draggingTabId,
            drag.id,
            event.clientY,
          )
        : null;
    const targetIndex =
      drag.source === "same-window" && draggingTabId
        ? resolveLocalDragTargetIndex(
            list,
            draggingTabId,
            drag.id,
            event.clientY,
          )
        : resolveExternalDragTargetIndex(list, drag, event.clientY);
    updateDropPreview(drag, targetIndex);
  };

  const handleTabListDragLeave = (event: DragEvent) => {
    const list = event.currentTarget;
    const nextTarget = event.relatedTarget;
    if (
      list instanceof HTMLElement &&
      nextTarget instanceof Node &&
      list.contains(nextTarget)
    ) {
      return;
    }
    clearDropTarget();
  };

  const handleTabListDrop = (event: DragEvent) => {
    if (!hasTabDragMarker(event.dataTransfer)) {
      return;
    }
    const drag = inspectActiveDrag();
    const list = event.currentTarget;
    if (!drag || !(list instanceof HTMLElement)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const targetIndex =
      drag.source === "same-window" && draggingTabId
        ? resolveLocalDragTargetIndex(
            list,
            draggingTabId,
            drag.id,
            event.clientY,
          )
        : resolveExternalDragTargetIndex(list, drag, event.clientY);
    if (targetIndex === null) {
      clearDropTarget();
      if (drag.source === "same-window") {
        endSourceDrag(undefined, true);
      } else {
        clearTabDrag();
      }
      return;
    }
    try {
      const result = props.tabs.dropDrag(targetIndex);
      clearTabDrag();
      announceTabMove(result.tabId, result.index);
    } catch (error) {
      if (drag.source === "same-window") {
        endSourceDrag(undefined, true);
      } else {
        clearTabDrag();
      }
      props.onFatalError(error);
    }
  };

  const manageTabDragWindow = (node: HTMLElement) => {
    const view = node.ownerDocument.defaultView;
    if (!view) {
      return {};
    }
    const isInsideProjectFrame = (event: DragEvent): boolean =>
      event
        .composedPath()
        .some(
          (target) =>
            target instanceof Element &&
            (target.id === "fennevia-shell-frame-host" ||
              target.closest("#fennevia-shell-frame-host") !== null),
        );
    const isInsideTabList = (event: DragEvent): boolean =>
      event
        .composedPath()
        .some(
          (target) =>
            target instanceof Element &&
            target.closest("[data-fennevia-tab-list]") !== null,
        );

    const handleWindowDragEnter = (event: DragEvent) => {
      if (!hasTabDragMarker(event.dataTransfer)) {
        return;
      }
      const drag = inspectActiveDrag();
      if (!drag || !holdExternalDrag(drag)) {
        return;
      }
      if (!isInsideProjectFrame(event)) {
        previewExternalDragAtEnd(drag);
      }
    };

    const handleWindowDragOver = (event: DragEvent) => {
      if (!hasTabDragMarker(event.dataTransfer)) {
        return;
      }
      const drag = inspectActiveDrag();
      if (!drag) {
        return;
      }
      holdExternalDrag(drag);
      if (isInsideProjectFrame(event)) {
        if (!isInsideTabList(event)) {
          clearDropTarget();
        }
        return;
      }
      if (drag.source === "same-window") {
        clearDropTarget();
      } else {
        previewExternalDragAtEnd(drag);
      }
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    };

    const handleWindowDragLeave = (event: DragEvent) => {
      if (!externalDrag || event.relatedTarget !== null) {
        return;
      }
      clearTabDrag();
    };

    const handleWindowDrop = (event: DragEvent) => {
      if (
        isInsideProjectFrame(event) ||
        !hasTabDragMarker(event.dataTransfer)
      ) {
        return;
      }
      const drag = inspectActiveDrag();
      if (!drag) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (drag.source === "same-window") {
        clearDropTarget();
        return;
      }
      try {
        const result = props.tabs.dropDrag(currentTabs.tabs.length);
        clearTabDrag();
        announceTabMove(result.tabId, result.index);
      } catch (error) {
        clearTabDrag();
        props.onFatalError(error);
      }
    };

    const handleWindowDragEnd = (event: DragEvent) => {
      if (sourceDragId) {
        endSourceDrag(event);
      } else if (externalDrag) {
        clearTabDrag();
      }
    };

    view.addEventListener("dragenter", handleWindowDragEnter, true);
    view.addEventListener("dragover", handleWindowDragOver, true);
    view.addEventListener("dragleave", handleWindowDragLeave, true);
    view.addEventListener("drop", handleWindowDrop, true);
    view.addEventListener("dragend", handleWindowDragEnd, true);
    return {
      destroy() {
        view.removeEventListener("dragenter", handleWindowDragEnter, true);
        view.removeEventListener("dragover", handleWindowDragOver, true);
        view.removeEventListener("dragleave", handleWindowDragLeave, true);
        view.removeEventListener("drop", handleWindowDrop, true);
        view.removeEventListener("dragend", handleWindowDragEnd, true);
      },
    };
  };

  const setFaviconSource = (node: HTMLImageElement, source: string) => {
    const assign = (nextSource: string) => {
      node.hidden = true;
      node.removeAttribute("src");
      node.src = nextSource;
    };
    node.onload = () => {
      node.hidden = false;
    };
    node.onerror = () => {
      node.hidden = true;
      node.removeAttribute("src");
    };
    assign(source);
    return {
      destroy() {
        node.onload = null;
        node.onerror = null;
        node.hidden = true;
        node.removeAttribute("src");
      },
      update: assign,
    };
  };

  const preventMiddleAutoscroll = (event: MouseEvent) => {
    if (event.button === 1) {
      event.preventDefault();
    }
  };

  const handleFocusOut = (event: FocusEvent) => {
    const surfaceRoot = tabStripElement?.closest<HTMLElement>(
      "[data-fennevia-surface-root]",
    );
    const nextTarget = event.relatedTarget;
    if (
      surfaceRoot &&
      (!(nextTarget instanceof Node) || !surfaceRoot.contains(nextTarget))
    ) {
      rovingTabId = resolveRovingTabId(currentTabs.tabs);
    }
  };

  onDestroy(() => {
    cancelDelayedFocus();
    cancelHighlight();
    highlightedTabIds = [];
    reorderAnnouncement = "";
    tabButtons.length = 0;
    if (sourceDragId) {
      endSourceDrag(undefined, true);
    } else {
      clearTabDrag();
    }
  });
</script>

<div class="fennevia-tabs-summary">
  <span>{t("tab.openHeading")}</span>
  <output
    aria-label={t("tab.openCount", { count: currentTabs.tabs.length })}
    data-fennevia-tab-count="">{currentTabs.tabs.length}</output
  >
</div>

<div
  use:manageTabDragWindow
  bind:this={tabStripElement}
  class="fennevia-tab-strip"
  onfocusout={handleFocusOut}
>
  <div
    aria-label={t("tab.openHeading")}
    aria-orientation="vertical"
    class="fennevia-tab-strip__list"
    data-fennevia-drag-active={sourceDragId !== null || externalDrag !== null}
    data-fennevia-tab-list=""
    ondragleave={handleTabListDragLeave}
    ondragover={handleTabListDragOver}
    ondrop={handleTabListDrop}
    role="tablist"
    tabindex="-1"
  >
    {#each currentTabs.tabs as tab, index (tab.id)}
      {@const audioAction = getTabAudioAction(tab)}
      {@const isDraggedTab = draggingTabId === tab.id}
      <div
        class="fennevia-tab-strip__item"
        data-fennevia-attention={tab.attention === true}
        data-fennevia-audio={tab.audio}
        data-fennevia-container-color={tab.container?.color}
        data-fennevia-drag-following={isDraggedTab &&
          draggedTabTranslateY !== null}
        data-fennevia-dragging={isDraggedTab}
        data-fennevia-drag-shift={externalDrag
          ? (resolveExternalTabDragShift(
              currentTabs.tabs,
              dragTargetIndex,
              index,
            ) ?? undefined)
          : draggingTabId
            ? (resolveTabDragShift(
                currentTabs.tabs,
                draggingTabId,
                dragTargetIndex,
                index,
              ) ?? undefined)
            : undefined}
        data-fennevia-drop-preview={dropPreview?.index === index
          ? dropPreview.position
          : undefined}
        data-fennevia-just-opened={highlightedTabIds.includes(tab.id)}
        data-fennevia-loading={tab.loading}
        data-fennevia-picture-in-picture={tab.pictureInPicture === true}
        data-fennevia-pinned={tab.pinned}
        data-fennevia-selected={tab.selected}
        data-fennevia-tab-item=""
        onauxclick={(event) => handleTabAuxClick(event, tab.id)}
        oncontextmenu={(event) => handleTabContextMenu(event, tab.id)}
        onmousedown={preventMiddleAutoscroll}
        role="presentation"
        style:transform={isDraggedTab && draggedTabTranslateY !== null
          ? `translateY(${draggedTabTranslateY}px)`
          : undefined}
      >
        {#if tab.container}
          <span
            aria-hidden="true"
            class="fennevia-tab-strip__container-bar"
            data-fennevia-container-bar={tab.container.color}
          ></span>
        {/if}
        <button
          use:registerTabButton={tab.id}
          aria-busy={tab.loading}
          aria-keyshortcuts="Control+Shift+ArrowUp Control+Shift+ArrowDown"
          aria-label={getTabAccessibleName(
            tab,
            index,
            currentTabs.tabs.length,
            tabLabels,
          )}
          aria-selected={tab.selected}
          class="fennevia-tab-strip__tab"
          data-fennevia-tab=""
          draggable="true"
          onclick={(event) =>
            selectTab(tab.id, pointerInteractionFromMouseEvent(event))}
          ondragstart={(event) => handleTabDragStart(event, tab.id)}
          onfocus={() => (rovingTabId = tab.id)}
          onkeydown={(event) => handleTabKeydown(event, tab.id)}
          role="tab"
          tabindex={rovingTabId === tab.id ? 0 : -1}
          title={getDisplayTabTitle(tab, tabLabels)}
          type="button"
        >
          <span class="fennevia-tab-strip__visual" aria-hidden="true">
            {#if tab.faviconUrl}
              <img
                use:setFaviconSource={tab.faviconUrl}
                alt=""
                class="fennevia-tab-strip__favicon"
                decoding="async"
                draggable="false"
                referrerpolicy="no-referrer"
              />
            {/if}
            <span class="fennevia-tab-strip__fallback">
              <FirefoxIcon name="tab" />
            </span>
            {#if tab.loading}
              <span class="fennevia-tab-strip__loading">
                <FirefoxIcon name="loading" />
              </span>
            {/if}
          </span>
          <span class="fennevia-tab-strip__title" dir="auto">
            {getDisplayTabTitle(tab, tabLabels)}
          </span>
          {#if tab.crashed || tab.sharing || tab.pictureInPicture}
            <span class="fennevia-tab-strip__statuses" aria-hidden="true">
              {#if tab.crashed}
                <span
                  class="fennevia-tab-strip__status"
                  data-fennevia-tab-status="crashed"
                >
                  <FirefoxIcon name="crashed" />
                </span>
              {/if}
              {#if tab.sharing}
                <span
                  class="fennevia-tab-strip__status"
                  data-fennevia-tab-status={tab.sharing}
                >
                  <FirefoxIcon name={getSharingIconName(tab.sharing)} />
                </span>
              {/if}
              {#if tab.pictureInPicture}
                <span
                  class="fennevia-tab-strip__status"
                  data-fennevia-tab-status="picture-in-picture"
                >
                  <FirefoxIcon name="picture-in-picture" />
                </span>
              {/if}
            </span>
          {/if}
        </button>

        {#if audioAction}
          <button
            aria-label={getTabActionAccessibleName(audioAction, tab, tabLabels)}
            class="fennevia-control fennevia-tab-strip__action"
            data-fennevia-action="toggle-mute"
            onclick={(event) => handleTabAudioAction(event, tab.id)}
            tabindex={rovingTabId === tab.id ? 0 : -1}
            title={getTabActionAccessibleName(audioAction, tab, tabLabels)}
            type="button"
          >
            <FirefoxIcon name={getAudioIconName(audioAction)} />
          </button>
        {/if}

        <button
          aria-label={getTabActionAccessibleName(
            tab.pinned ? "unpin" : "pin",
            tab,
            tabLabels,
          )}
          aria-pressed={tab.pinned}
          class="fennevia-control fennevia-tab-strip__action"
          data-fennevia-action={tab.pinned ? "unpin-tab" : "pin-tab"}
          onclick={(event) => {
            event.stopPropagation();
            togglePinned(tab);
          }}
          tabindex={rovingTabId === tab.id ? 0 : -1}
          title={tab.pinned ? t("tab.unpinTab") : t("tab.pinTab")}
          type="button"><FirefoxIcon name="pin" /></button
        >

        <button
          aria-label={getTabActionAccessibleName("close", tab, tabLabels)}
          class="fennevia-control fennevia-tab-strip__action"
          data-fennevia-action="close-tab"
          onclick={(event) => {
            event.stopPropagation();
            closeTab(tab.id, pointerInteractionFromMouseEvent(event));
          }}
          tabindex={rovingTabId === tab.id ? 0 : -1}
          title={t("tab.closeTab")}
          type="button"><FirefoxIcon name="tab-close" /></button
        >
      </div>
    {/each}

    {#if externalDrag && dragTargetIndex !== null}
      <span
        aria-hidden="true"
        class="fennevia-tab-strip__external-drop-slot"
        data-fennevia-external-drop-slot=""
      ></span>
    {/if}

    {#if externalDrag && externalPreviewTransform}
      <span
        aria-hidden="true"
        class="fennevia-tab-strip__external-preview"
        data-fennevia-external-preview=""
        data-fennevia-pinned={externalDrag.pinned}
        style:transform={externalPreviewTransform}
      >
        <span class="fennevia-tab-strip__visual">
          <span class="fennevia-tab-strip__fallback">
            <FirefoxIcon name="tab" />
          </span>
        </span>
        <span class="fennevia-tab-strip__title">{t("tab.dragPreview")}</span>
      </span>
    {/if}

    {#if dropMarkerTop !== null}
      <span
        aria-hidden="true"
        class="fennevia-tab-strip__drop-indicator"
        data-fennevia-drop-preview={dropPreview?.position ?? "before"}
        style:inset-block-start={`${dropMarkerTop}px`}
      ></span>
    {/if}
  </div>

  <output
    aria-atomic="true"
    aria-live="polite"
    class="fennevia-tab-strip__announcement">{reorderAnnouncement}</output
  >

  <button
    aria-label={t("tab.newTabAria")}
    class="fennevia-control fennevia-tab-strip__new"
    data-fennevia-action="new-tab"
    onclick={openTab}
    title={t("tab.newTab")}
    type="button"
  >
    <span aria-hidden="true"><FirefoxIcon name="plus" /></span>
    <span>{t("tab.newTab")}</span>
  </button>
</div>
