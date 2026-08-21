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
    createBrowserTabsState,
    type BrowserTabsState,
    type BrowserTabsStateAdapter,
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
    newTabHighlightDurationMs,
    resolveRovingTabId,
    resolveTabDropIndex,
    resolveTabDropPreview,
    type TabDropPreview,
  } from "../../../app/tab-strip";
  import ShellIcon, { type ShellIconName } from "../../ShellIcon.svelte";
  import { createTabStripLabels } from "../../locale-ui";

  type Props = Readonly<{
    localeId: FenneviaLocale;
    onFatalError: (error: unknown) => void;
    shell: EdgeShellController;
    tabs: BrowserTabsStateAdapter;
  }>;

  type DelayedTimer = {
    id: number;
    view: Window;
  };

  const closeFocusRetryDelayMs = 200;
  const props: Props = $props();
  const t = (key: MessageKey, vars?: MessageVars): string =>
    translate(props.localeId, key, vars);

  let currentTabs: BrowserTabsState = $state(createBrowserTabsState([]));
  let rovingTabId: string | null = $state(null);
  let highlightedTabIds: readonly string[] = $state([]);
  let draggingTabId: string | null = $state(null);
  let dropPreview: TabDropPreview = $state(null);
  let tabStripElement: HTMLDivElement | undefined = $state();
  let delayedFocusTimer: DelayedTimer | undefined;
  let highlightTimer: DelayedTimer | undefined;
  const tabButtons: Array<{
    node: HTMLButtonElement;
    tabId: string;
  }> = [];

  let tabLabels = $derived(createTabStripLabels(props.localeId));

  const getAudioIconName = (
    action: "mute" | "resume-media" | "unmute",
  ): ShellIconName =>
    action === "unmute"
      ? ("audio-muted" as const)
      : action === "resume-media"
        ? ("media-blocked" as const)
        : ("audio" as const);

  const getSharingIconName = (sharing: TabSharingState): ShellIconName =>
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
      currentTabs = nextState;
      rovingTabId = resolveRovingTabId(nextState.tabs, rovingTabId);
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
      props.shell.revealProgrammatically("left", newTabHighlightDurationMs);
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
    props.shell.setFocusHeld("left", false);
    props.shell.releaseKeyboard("left");
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

  const selectTab = (tabId: string) => {
    cancelDelayedFocus();
    rovingTabId = tabId;
    props.tabs.select(tabId);
    reportAsyncError(focusTab(tabId));
  };

  const openTab = () => {
    cancelDelayedFocus();
    const openedTabId = props.tabs.open({ selected: true });
    reportAsyncError(focusTab(openedTabId));
  };

  const closeTab = (tabId: string) => {
    cancelDelayedFocus();
    const focusTarget = findCloseFocusTarget(currentTabs.tabs, tabId);
    rovingTabId = focusTarget;
    props.tabs.close(tabId);
    restoreFocusAfterClose(resolveRovingTabId(currentTabs.tabs, focusTarget));
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
    closeTab(tabId);
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

  const handleTabDragStart = (event: DragEvent, tabId: string) => {
    const transfer = event.dataTransfer;
    if (!transfer) {
      return;
    }
    transfer.effectAllowed = "move";
    transfer.setData("application/x-fennevia-tab", tabId);
    transfer.setData("text/plain", tabId);
    const dragImage = event.currentTarget;
    if (dragImage instanceof HTMLElement) {
      const bounds = dragImage.getBoundingClientRect();
      transfer.setDragImage(
        dragImage,
        Math.min(24, Math.max(0, bounds.width / 2)),
        Math.max(0, bounds.height / 2),
      );
    }
    draggingTabId = tabId;
    dropPreview = null;
    props.shell.setPointerHeld("left", true);
  };

  const clearTabDrag = () => {
    const wasDragging = draggingTabId !== null;
    draggingTabId = null;
    dropPreview = null;
    if (wasDragging) {
      props.shell.setPointerHeld("left", false);
    }
  };

  const handleTabDragEnd = () => {
    clearTabDrag();
  };

  const resolveDragTargetIndex = (
    list: HTMLElement,
    tabId: string,
    pointerY: number,
  ): number | null => {
    const items = Array.from(
      list.querySelectorAll<HTMLElement>("[data-fennevia-tab-item]"),
    );
    const mids = items.map((item) => {
      const bounds = item.getBoundingClientRect();
      return bounds.top + bounds.height / 2;
    });
    return resolveTabDropIndex(currentTabs.tabs, tabId, mids, pointerY);
  };

  const handleTabListDragOver = (event: DragEvent) => {
    if (!draggingTabId) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    const list = event.currentTarget;
    if (!(list instanceof HTMLElement)) {
      dropPreview = null;
      return;
    }
    const targetIndex = resolveDragTargetIndex(
      list,
      draggingTabId,
      event.clientY,
    );
    dropPreview = resolveTabDropPreview(
      currentTabs.tabs,
      draggingTabId,
      targetIndex,
    );
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
    dropPreview = null;
  };

  const handleTabListDrop = (event: DragEvent) => {
    if (!draggingTabId) {
      return;
    }
    const tabId =
      event.dataTransfer?.getData("application/x-fennevia-tab") ||
      event.dataTransfer?.getData("text/plain") ||
      draggingTabId;
    if (tabId !== draggingTabId) {
      clearTabDrag();
      return;
    }
    event.preventDefault();
    const list = event.currentTarget;
    const targetIndex =
      list instanceof HTMLElement
        ? resolveDragTargetIndex(list, tabId, event.clientY)
        : null;
    clearTabDrag();
    if (targetIndex === null) {
      return;
    }
    try {
      props.tabs.move(tabId, targetIndex);
    } catch (error) {
      props.onFatalError(error);
    }
  };

  const setFaviconSource = (node: HTMLImageElement, source: string) => {
    const assign = (nextSource: string) => {
      node.hidden = false;
      node.src = nextSource;
    };
    node.onerror = () => {
      node.hidden = true;
      node.removeAttribute("src");
    };
    assign(source);
    return {
      destroy() {
        node.onerror = null;
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
    tabButtons.length = 0;
    clearTabDrag();
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
  bind:this={tabStripElement}
  class="fennevia-tab-strip"
  onfocusout={handleFocusOut}
>
  <div
    aria-label={t("tab.openHeading")}
    aria-orientation="vertical"
    class="fennevia-tab-strip__list"
    data-fennevia-tab-list=""
    ondragleave={handleTabListDragLeave}
    ondragover={handleTabListDragOver}
    ondrop={handleTabListDrop}
    role="tablist"
    tabindex="-1"
  >
    {#each currentTabs.tabs as tab, index (tab.id)}
      {@const audioAction = getTabAudioAction(tab)}
      <div
        class="fennevia-tab-strip__item"
        data-fennevia-attention={tab.attention === true}
        data-fennevia-audio={tab.audio}
        data-fennevia-container-color={tab.container?.color}
        data-fennevia-dragging={draggingTabId === tab.id}
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
      >
        <button
          use:registerTabButton={tab.id}
          aria-busy={tab.loading}
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
          onclick={() => selectTab(tab.id)}
          ondragend={handleTabDragEnd}
          ondragstart={(event) => handleTabDragStart(event, tab.id)}
          onfocus={() => (rovingTabId = tab.id)}
          onkeydown={(event) => handleTabKeydown(event, tab.id)}
          role="tab"
          tabindex={rovingTabId === tab.id ? 0 : -1}
          title={getDisplayTabTitle(tab, tabLabels)}
          type="button"
        >
          <span class="fennevia-tab-strip__visual" aria-hidden="true">
            <span class="fennevia-tab-strip__fallback">
              <ShellIcon name="tab" />
            </span>
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
            {#if tab.loading}
              <span class="fennevia-tab-strip__loading">
                <ShellIcon name="reload" />
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
                  <ShellIcon name="crashed" />
                </span>
              {/if}
              {#if tab.sharing}
                <span
                  class="fennevia-tab-strip__status"
                  data-fennevia-tab-status={tab.sharing}
                >
                  <ShellIcon name={getSharingIconName(tab.sharing)} />
                </span>
              {/if}
              {#if tab.pictureInPicture}
                <span
                  class="fennevia-tab-strip__status"
                  data-fennevia-tab-status="picture-in-picture"
                >
                  <ShellIcon name="picture-in-picture" />
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
            <ShellIcon name={getAudioIconName(audioAction)} />
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
          type="button"><ShellIcon name="pin" /></button
        >

        <button
          aria-label={getTabActionAccessibleName("close", tab, tabLabels)}
          class="fennevia-control fennevia-tab-strip__action"
          data-fennevia-action="close-tab"
          onclick={(event) => {
            event.stopPropagation();
            closeTab(tab.id);
          }}
          tabindex={rovingTabId === tab.id ? 0 : -1}
          title={t("tab.closeTab")}
          type="button"><ShellIcon name="close" /></button
        >
      </div>
    {/each}
  </div>

  <button
    aria-label={t("tab.newTabAria")}
    class="fennevia-control fennevia-tab-strip__new"
    data-fennevia-action="new-tab"
    onclick={openTab}
    title={t("tab.newTab")}
    type="button"
  >
    <span aria-hidden="true"><ShellIcon name="plus" /></span>
    <span>{t("tab.newTab")}</span>
  </button>
</div>
