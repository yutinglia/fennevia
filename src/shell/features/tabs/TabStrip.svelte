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
    type OpenTabOptions,
    type TabDragSnapshot,
    type TabSharingState,
    type TabSnapshot,
  } from "../../../app/tab-state";
  import {
    findCloseFocusTarget,
    findOpenedTabIds,
    findTabGroupMoveIndex,
    findTabMoveIndex,
    getDisplayTabTitle,
    getTabAccessibleName,
    getTabActionAccessibleName,
    getTabAudioAction,
    getTabStripKeyAction,
    countMultiSelectedTabs,
    hasAccelModifier,
    isDraggedTabMissing,
    isCollapsedDragMember,
    isTabInDragGroup,
    newTabHighlightDurationMs,
    normalizeTabDropPointerY,
    resolveDraggedTabTranslateY,
    resolveRovingTabId,
    resolveTabPointerAction,
    resolveExternalTabDragShift,
    resolveExternalTabDropIndex,
    resolveTabDragShift,
    resolveTabDropIndex,
    resolveTabDropPreview,
    type TabDropPreview,
    type TabPointerAction,
  } from "../../../app/tab-strip";
  import FirefoxIcon, { type FirefoxIconName } from "../../FirefoxIcon.svelte";
  import { createTabStripLabels } from "../../locale-ui";
  import { isPointInsideElement } from "../../runtime/pointer-geometry";

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
  let externalDrag = $state<TabDragSnapshot | null>(null);
  let pendingPointerAction: TabPointerAction | null = null;
  let dragCount = $derived(
    externalDrag === null
      ? draggingTabId
        ? currentTabs.tabs.filter((tab) =>
            isTabInDragGroup(currentTabs.tabs, draggingTabId, tab.id),
          ).length
        : 1
      : externalDrag.count,
  );
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

  const blurOwnedSurfaceControl = () => {
    const surfaceRoot = tabStripElement?.closest<HTMLElement>(
      "[data-fennevia-surface-root]",
    );
    const activeElement = surfaceRoot?.ownerDocument.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      surfaceRoot?.contains(activeElement)
    ) {
      activeElement.blur();
    }
    releaseSurfaceFocus();
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
    releaseIfOutside = true,
  ) => {
    await tick();
    const surfacePanel = tabStripElement?.closest<HTMLElement>(
      `[data-fennevia-edge-panel="${props.edge}"]`,
    );
    if (!surfacePanel?.isConnected) {
      return;
    }
    if (
      !releaseIfOutside ||
      isPointInsideElement(
        surfacePanel,
        interaction.clientX,
        interaction.clientY,
      )
    ) {
      props.shell.setPointerHeld(props.edge, true);
    } else {
      props.shell.releasePointer(props.edge, "inside-window");
    }
    blurOwnedSurfaceControl();
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
        ? restorePointerInteractionAfterMutation(pointerInteraction, false)
        : focusTab(tabId),
    );
  };

  const applyTabPointerAction = (
    tab: TabSnapshot,
    action: TabPointerAction,
    pointerInteraction: PointerInteraction | null,
  ) => {
    cancelDelayedFocus();
    rovingTabId = tab.id;
    if (pointerInteraction) {
      props.shell.setPointerHeld(props.edge, true);
    }
    try {
      if (action === "toggle-multi") {
        props.tabs.toggleMultiSelect(tab.id);
      } else if (action === "range") {
        props.tabs.selectRange(tab.id);
      } else if (action === "activate-keep-multi") {
        props.tabs.activateKeepingMultiSelect(tab.id);
      }
    } catch (error) {
      props.onFatalError(error);
      return;
    }
    reportAsyncError(
      pointerInteraction
        ? restorePointerInteractionAfterMutation(pointerInteraction, false)
        : focusTab(tab.id),
    );
  };

  const handleTabPointerDown = (event: PointerEvent, tab: TabSnapshot) => {
    if (event.button !== 0) {
      pendingPointerAction = null;
      return;
    }
    const action = resolveTabPointerAction(event, tab);
    pendingPointerAction = action;
    if (action === "activate") {
      return;
    }
    event.preventDefault();
    applyTabPointerAction(
      tab,
      action,
      pointerInteractionFromMouseEvent(event),
    );
  };

  const handleTabClick = (event: MouseEvent, tab: TabSnapshot) => {
    if (event.button !== 0) {
      return;
    }
    const pending = pendingPointerAction;
    pendingPointerAction = null;
    if (pending && pending !== "activate") {
      return;
    }
    if (resolveTabPointerAction(event, tab) !== "activate") {
      return;
    }
    selectTab(tab.id, pointerInteractionFromMouseEvent(event));
  };

  const openTab = (
    pointerInteraction: PointerInteraction | null = null,
    options: OpenTabOptions = { selected: true },
  ) => {
    cancelDelayedFocus();
    if (pointerInteraction) {
      props.shell.setPointerHeld(props.edge, true);
    }
    const selected = options.selected ?? true;
    const openedTabId = props.tabs.open(
      options.relatedToCurrent === true
        ? { relatedToCurrent: true, selected }
        : { selected },
    );
    reportAsyncError(
      pointerInteraction
        ? restorePointerInteractionAfterMutation(pointerInteraction, false)
        : focusTab(openedTabId),
    );
  };

  const handleNewTabClick = (event: MouseEvent) => {
    if (event.button !== 0) {
      return;
    }
    const relatedToCurrent = event.ctrlKey || event.metaKey;
    openTab(pointerInteractionFromMouseEvent(event), {
      relatedToCurrent,
      selected: !(relatedToCurrent && event.shiftKey),
    });
  };

  const handleNewTabAuxClick = (event: MouseEvent) => {
    if (event.button !== 1) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    openTab(pointerInteractionFromMouseEvent(event), {
      relatedToCurrent: true,
      selected: !event.shiftKey,
    });
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
      hasAccelModifier(event) &&
      event.shiftKey &&
      !event.altKey &&
      (event.key === "ArrowUp" || event.key === "ArrowDown")
    ) {
      const tab = currentTabs.tabs.find((candidate) => candidate.id === tabId);
      const movingIds =
        tab?.multiselected === true
          ? currentTabs.tabs
              .filter(
                (candidate) =>
                  candidate.multiselected === true &&
                  candidate.pinned === tab.pinned,
              )
              .map((candidate) => candidate.id)
          : [tabId];
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const targetIndex =
        movingIds.length > 1
          ? findTabGroupMoveIndex(currentTabs.tabs, movingIds, delta)
          : findTabMoveIndex(currentTabs.tabs, tabId, delta);
      if (targetIndex === null) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      cancelDelayedFocus();
      try {
        props.tabs.move(movingIds[0] ?? tabId, targetIndex);
        announceTabMove(movingIds[0] ?? tabId, targetIndex);
      } catch (error) {
        props.onFatalError(error);
        return;
      }
      reportAsyncError(focusTab(tabId));
      return;
    }
    if (
      event.shiftKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      (event.key === "ArrowUp" || event.key === "ArrowDown")
    ) {
      const currentIndex = currentTabs.tabs.findIndex(
        (candidate) => candidate.id === tabId,
      );
      const next =
        currentTabs.tabs[
          currentIndex + (event.key === "ArrowDown" ? 1 : -1)
        ];
      if (!next) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      cancelDelayedFocus();
      rovingTabId = next.id;
      try {
        props.tabs.selectRange(next.id);
      } catch (error) {
        props.onFatalError(error);
        return;
      }
      reportAsyncError(focusTab(next.id));
      return;
    }
    if (
      hasAccelModifier(event) &&
      !event.altKey &&
      !event.shiftKey &&
      event.key === " "
    ) {
      event.preventDefault();
      event.stopPropagation();
      cancelDelayedFocus();
      try {
        props.tabs.toggleMultiSelect(tabId);
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
    if (active) {
      dragHoldActive = true;
      props.shell.setPointerHeld(props.edge, true);
      return;
    }
    if (!dragHoldActive) {
      return;
    }
    dragHoldActive = false;
    props.shell.setPointerHeld(props.edge, false);
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

  function clearTabDrag(retainPointer = false) {
    draggingTabId = null;
    sourceDragId = null;
    externalDrag = null;
    clearDropTarget();
    clearDragGeometry();
    if (retainPointer) {
      dragHoldActive = false;
      props.shell.setPointerHeld(props.edge, true);
    } else {
      setDragHold(false);
    }
    blurOwnedSurfaceControl();
  }

  const captureDragGeometry = (
    list: HTMLElement,
    dragId: string,
    localDrag?: Readonly<{
      pointerY: number;
      preservePointerOffset?: boolean;
      tabId: string;
    }>,
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
    let lastVisibleIndex = itemBounds.length - 1;
    while (lastVisibleIndex > 0) {
      const tab = currentTabs.tabs[lastVisibleIndex];
      const height = itemBounds[lastVisibleIndex]?.height ?? 0;
      if (
        !tab ||
        height >= 1 ||
        !isCollapsedDragMember(currentTabs.tabs, draggingTabId, tab.id)
      ) {
        break;
      }
      lastVisibleIndex -= 1;
    }
    dragGeometry.appendTop =
      (itemBounds[lastVisibleIndex]?.bottom ?? listBounds.top) -
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
    if (!localDrag?.preservePointerOffset) {
      dragGeometry.pointerOffsetY =
        localDrag && localDragBounds
          ? Math.min(
              localDragBounds.height,
              Math.max(0, localDrag.pointerY - localDragBounds.top),
            )
          : null;
    }
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
    let visualStart = partitionStart;
    while (visualStart < partitionEnd) {
      const tab = currentTabs.tabs[visualStart];
      const height = dragGeometry.itemHeights[visualStart] ?? 0;
      if (
        tab &&
        (height >= 1 ||
          !isCollapsedDragMember(currentTabs.tabs, tabId, tab.id))
      ) {
        break;
      }
      visualStart += 1;
    }
    let visualEnd = partitionEnd;
    while (visualEnd > visualStart) {
      const tab = currentTabs.tabs[visualEnd];
      const height = dragGeometry.itemHeights[visualEnd] ?? 0;
      if (
        tab &&
        (height >= 1 ||
          !isCollapsedDragMember(currentTabs.tabs, tabId, tab.id))
      ) {
        break;
      }
      visualEnd -= 1;
    }
    const minimumTop = dragGeometry.itemTops[visualStart];
    const finalTop = dragGeometry.itemTops[visualEnd];
    const finalHeight = dragGeometry.itemHeights[visualEnd];
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

  const finishOwnedTabDrag = () => {
    clearTabDrag(true);
    reportAsyncError(
      tick().then(() => {
        props.shell.setPointerHeld(props.edge, true);
      }),
    );
  };

  const endSourceDrag = (event?: DragEvent, cancelled = false) => {
    const dragId = sourceDragId;
    if (!dragId) {
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
      finishOwnedTabDrag();
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
      const startedDragId = props.tabs.beginDrag(tabId);
      dragId = startedDragId;
      transfer.effectAllowed = "move";
      transfer.clearData();
      transfer.setData(TAB_DRAG_MIME_TYPE, "1");
      sourceDragId = startedDragId;
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
          captureDragGeometry(list, startedDragId, {
            pointerY: event.clientY,
            tabId,
          });
          reportAsyncError(
            tick().then(() => {
              if (
                sourceDragId !== startedDragId ||
                draggingTabId !== tabId ||
                !list.isConnected
              ) {
                return;
              }
              captureDragGeometry(list, startedDragId, {
                pointerY: event.clientY,
                preservePointerOffset: true,
                tabId,
              });
            }),
          );
        }
      }
      setDragHold(true);
      blurOwnedSurfaceControl();
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
    const bounds = list.getBoundingClientRect();
    const normalizedPointerY = normalizeTabDropPointerY(
      pointerY,
      bounds.top,
      bounds.bottom,
    );
    if (normalizedPointerY === null) {
      return null;
    }
    return resolveTabDropIndex(
      currentTabs.tabs,
      tabId,
      adjustedItemMids(list),
      normalizedPointerY,
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
    const bounds = list.getBoundingClientRect();
    const normalizedPointerY = normalizeTabDropPointerY(
      pointerY,
      bounds.top,
      bounds.bottom,
    );
    if (normalizedPointerY === null) {
      return null;
    }
    return resolveExternalTabDropIndex(
      currentTabs.tabs,
      adjustedItemMids(list),
      normalizedPointerY,
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

  const updateTabDropAtPointer = (event: DragEvent, list: HTMLElement) => {
    if (!hasTabDragMarker(event.dataTransfer)) {
      return;
    }
    const drag = inspectActiveDrag();
    if (!drag) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    setDragHold(true);
    holdExternalDrag(drag);
    if (
      drag.source === "same-window" &&
      draggingTabId &&
      dragCount > 1 &&
      draggedTabTranslateY === null
    ) {
      captureDragGeometry(list, drag.id, {
        pointerY: event.clientY,
        preservePointerOffset: true,
        tabId: draggingTabId,
      });
    }
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

  const handleTabListDragOver = (event: DragEvent) => {
    const list = event.currentTarget;
    if (!(list instanceof HTMLElement)) {
      clearDropTarget();
      return;
    }
    updateTabDropAtPointer(event, list);
  };

  const handleTabDropZoneDragOver = (event: DragEvent) => {
    const dropZone = event.currentTarget;
    const list =
      dropZone instanceof HTMLElement
        ? dropZone.querySelector<HTMLElement>("[data-fennevia-tab-list]")
        : null;
    if (!list) {
      clearDropTarget();
      return;
    }
    updateTabDropAtPointer(event, list);
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

  const dropTabAtPointer = (event: DragEvent, list: HTMLElement) => {
    if (!hasTabDragMarker(event.dataTransfer)) {
      return;
    }
    const drag = inspectActiveDrag();
    if (!drag) {
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
        finishOwnedTabDrag();
      }
      return;
    }
    try {
      const result = props.tabs.dropDrag(targetIndex);
      finishOwnedTabDrag();
      announceTabMove(result.tabId, result.index);
    } catch (error) {
      if (drag.source === "same-window") {
        endSourceDrag(undefined, true);
      } else {
        finishOwnedTabDrag();
      }
      props.onFatalError(error);
    }
  };

  const handleTabListDrop = (event: DragEvent) => {
    const list = event.currentTarget;
    if (!(list instanceof HTMLElement)) {
      return;
    }
    dropTabAtPointer(event, list);
  };

  const handleTabDropZoneDrop = (event: DragEvent) => {
    const dropZone = event.currentTarget;
    const list =
      dropZone instanceof HTMLElement
        ? dropZone.querySelector<HTMLElement>("[data-fennevia-tab-list]")
        : null;
    if (list) {
      dropTabAtPointer(event, list);
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
    const isInsideTabDropZone = (event: DragEvent): boolean =>
      event
        .composedPath()
        .some(
          (target) =>
            target instanceof Element &&
            target.closest("[data-fennevia-tab-drop-zone]") !== null,
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
        if (isInsideTabDropZone(event)) {
          setDragHold(true);
        } else {
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
  data-fennevia-tab-drop-zone=""
  ondragover={handleTabDropZoneDragOver}
  ondrop={handleTabDropZoneDrop}
  onfocusout={handleFocusOut}
  role="presentation"
>
  <div
    aria-label={t("tab.openHeading")}
    aria-multiselectable="true"
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
      {@const isDraggedTab = isTabInDragGroup(
        currentTabs.tabs,
        draggingTabId,
        tab.id,
      )}
      {@const isDragHandle = tab.id === draggingTabId}
      {@const isCollapsedMember = isCollapsedDragMember(
        currentTabs.tabs,
        draggingTabId,
        tab.id,
      )}
      <div
        class="fennevia-tab-strip__item"
        data-fennevia-attention={tab.attention === true}
        data-fennevia-audio={tab.audio}
        data-fennevia-container-color={tab.container?.color}
        data-fennevia-drag-collapsed={isCollapsedMember ? true : undefined}
        data-fennevia-drag-following={isDragHandle &&
          draggedTabTranslateY !== null}
        data-fennevia-drag-stack={isDragHandle &&
        dragCount > 1 &&
        draggedTabTranslateY !== null
          ? true
          : undefined}
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
        data-fennevia-multiselected={tab.multiselected === true}
        data-fennevia-pinned={tab.pinned}
        data-fennevia-selected={tab.selected}
        data-fennevia-tab-item=""
        onauxclick={(event) => handleTabAuxClick(event, tab.id)}
        oncontextmenu={(event) => handleTabContextMenu(event, tab.id)}
        onmousedown={preventMiddleAutoscroll}
        role="presentation"
        style:transform={isDragHandle && draggedTabTranslateY !== null
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
          aria-selected={tab.selected || tab.multiselected === true}
          class="fennevia-tab-strip__tab"
          data-fennevia-tab=""
          draggable="true"
          onclick={(event) => handleTabClick(event, tab)}
          ondragstart={(event) => handleTabDragStart(event, tab.id)}
          onfocus={() => (rovingTabId = tab.id)}
          onkeydown={(event) => handleTabKeydown(event, tab.id)}
          onpointerdown={(event) => handleTabPointerDown(event, tab)}
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
          aria-label={getTabActionAccessibleName(
            "close",
            tab,
            tabLabels,
            tab.multiselected === true
              ? countMultiSelectedTabs(currentTabs.tabs)
              : 1,
          )}
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
    onauxclick={handleNewTabAuxClick}
    onclick={handleNewTabClick}
    onmousedown={preventMiddleAutoscroll}
    title={t("tab.newTab")}
    type="button"
  >
    <span aria-hidden="true"><FirefoxIcon name="plus" /></span>
    <span>{t("tab.newTab")}</span>
  </button>
</div>
