<script lang="ts">
  import { onDestroy, tick, untrack } from "svelte";

  import {
    getVisibleBookmarkRows,
    resolveBookmarkFocusId,
    type BookmarkNodeSnapshot,
    type BookmarkOpenDisposition,
    type BookmarkVisibleItemRow,
    type BookmarkVisibleRow,
    type BrowserBookmarksState,
    type BrowserBookmarksStateAdapter,
  } from "../app/bookmark-state";
  import type { EdgeShellController } from "../app/edge-surfaces";
  import { translate, type MessageKey, type MessageVars } from "../app/i18n";
  import {
    defaultFenneviaLocale,
    type FenneviaLocale,
  } from "../app/locale-state";
  import FirefoxIcon from "./FirefoxIcon.svelte";

  type Props = Readonly<{
    bookmarks: BrowserBookmarksStateAdapter;
    edge: "left" | "right";
    localeId?: FenneviaLocale;
    onDismiss: () => void;
    onFatalError: (error: unknown) => void;
    shell: EdgeShellController;
  }>;

  type BookmarkContextMenu = Readonly<{
    bookmarkId: string;
    expanded: boolean;
    kind: "bookmark" | "folder";
    left: number;
    top: number;
  }>;

  const props: Props = $props();
  let localeId: FenneviaLocale = $derived(
    props.localeId ?? defaultFenneviaLocale,
  );
  const t = (key: MessageKey, vars?: MessageVars): string =>
    translate(localeId, key, vars);
  let current: BrowserBookmarksState = $state(
    untrack(() => props.bookmarks.snapshot()),
  );
  let localMessage = $state("");
  let rovingBookmarkId: string | null = $state(null);
  let bookmarkPanel: HTMLElement | undefined = $state();
  let contextMenu: BookmarkContextMenu | null = $state(null);
  let contextMenuElement: HTMLDivElement | undefined = $state();
  let rootSelect: HTMLSelectElement | undefined = $state();
  let contextMenuRestoreTarget: HTMLElement | null = null;
  let contextMenuSequence = 0;
  let rows: readonly BookmarkVisibleRow[] = $derived(
    getVisibleBookmarkRows(current),
  );
  const bookmarkButtons: Array<{
    bookmarkId: string;
    node: HTMLButtonElement;
  }> = [];

  const reportAsyncError = (work: Promise<unknown>): void => {
    void work.catch(props.onFatalError);
  };

  const blurFocusedContextMenuItem = (): void => {
    const menu = contextMenuElement;
    const activeElement = menu?.ownerDocument.activeElement;
    if (
      menu &&
      activeElement instanceof HTMLElement &&
      menu.contains(activeElement)
    ) {
      activeElement.blur();
    }
  };

  const closeBookmarkContextMenu = (restoreFocus: boolean): void => {
    if (!contextMenu) {
      return;
    }
    contextMenuSequence += 1;
    const restoreTarget = contextMenuRestoreTarget;
    if (restoreFocus && restoreTarget?.isConnected) {
      restoreTarget.focus({ preventScroll: true });
    } else {
      blurFocusedContextMenuItem();
    }
    contextMenu = null;
    contextMenuRestoreTarget = null;
    props.shell.setPopupHeld(props.edge, false);
  };

  const openBookmarkContextMenu = async (
    row: BookmarkVisibleItemRow,
    source: HTMLElement,
    clientX: number,
    clientY: number,
    restoreFocus: boolean,
  ): Promise<void> => {
    if (row.node.kind === "separator" || !bookmarkPanel) {
      return;
    }
    const sequence = ++contextMenuSequence;
    const panelBounds = bookmarkPanel.getBoundingClientRect();
    const wasClosed = contextMenu === null;
    contextMenuRestoreTarget = restoreFocus ? source : null;
    rovingBookmarkId = row.node.id;
    contextMenu = {
      bookmarkId: row.node.id,
      expanded: row.expanded,
      kind: row.node.kind,
      left: Math.max(6, clientX - panelBounds.left),
      top: Math.max(6, clientY - panelBounds.top),
    };
    if (wasClosed) {
      props.shell.setPopupHeld(props.edge, true);
    }
    await tick();
    if (
      sequence !== contextMenuSequence ||
      !contextMenu ||
      !contextMenuElement ||
      !bookmarkPanel
    ) {
      return;
    }
    const menuBounds = contextMenuElement.getBoundingClientRect();
    const currentPanelBounds = bookmarkPanel.getBoundingClientRect();
    contextMenu = {
      ...contextMenu,
      left: Math.min(
        Math.max(6, clientX - currentPanelBounds.left),
        Math.max(6, currentPanelBounds.width - menuBounds.width - 6),
      ),
      top: Math.min(
        Math.max(6, clientY - currentPanelBounds.top),
        Math.max(6, currentPanelBounds.height - menuBounds.height - 6),
      ),
    };
    await tick();
    if (sequence !== contextMenuSequence) {
      return;
    }
    contextMenuElement
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
      ?.focus({ preventScroll: true });
  };

  const itemRows = (
    value: readonly BookmarkVisibleRow[] = rows,
  ): readonly BookmarkVisibleItemRow[] =>
    value.filter(
      (row): row is BookmarkVisibleItemRow =>
        row.type === "item" && row.node.kind !== "separator",
    );

  const restoreFocusAfterLiveRemoval = async (
    bookmarkId: string | null,
  ): Promise<void> => {
    await tick();
    const target = bookmarkId
      ? bookmarkButtons.find(
          (registration) => registration.bookmarkId === bookmarkId,
        )?.node
      : rootSelect;
    if (target?.isConnected) {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  };

  $effect(() => {
    const unsubscribe = props.bookmarks.subscribe((nextState) => {
      const priorRows = getVisibleBookmarkRows(current);
      const priorIds = itemRows(priorRows).map((row) => row.node.id);
      const nextRows = getVisibleBookmarkRows(nextState);
      const focusedBookmarkId =
        bookmarkButtons.find(
          (registration) =>
            registration.node.ownerDocument.activeElement === registration.node,
        )?.bookmarkId ?? null;
      current = nextState;
      const nextFocusId = resolveBookmarkFocusId(
        nextRows,
        rovingBookmarkId,
        priorIds,
      );
      rovingBookmarkId = nextFocusId;
      if (focusedBookmarkId && focusedBookmarkId !== nextFocusId) {
        reportAsyncError(restoreFocusAfterLiveRemoval(nextFocusId));
      }
    });
    return unsubscribe;
  });

  const registerBookmarkButton = (
    node: HTMLButtonElement,
    bookmarkId: string,
  ) => {
    const registration = { bookmarkId, node };
    bookmarkButtons.push(registration);
    return {
      destroy() {
        const index = bookmarkButtons.indexOf(registration);
        if (index >= 0) {
          bookmarkButtons.splice(index, 1);
        }
      },
      update(nextBookmarkId: string) {
        registration.bookmarkId = nextBookmarkId;
      },
    };
  };

  const getErrorCode = (error: unknown): string =>
    typeof error === "object" &&
    error !== null &&
    "fenneviaCode" in error &&
    typeof error.fenneviaCode === "string"
      ? error.fenneviaCode
      : "";

  const runAction = async (action: () => Promise<unknown>): Promise<void> => {
    localMessage = "";
    try {
      await action();
    } catch (error) {
      if (getErrorCode(error) === "FENNEVIA_BOOKMARK_STATE_EXPANSION_LIMIT") {
        localMessage = t("bookmarks.collapseLimit");
        return;
      }
      props.onFatalError(error);
    }
  };

  const displayTitle = (node: BookmarkNodeSnapshot): string => {
    if (node.title.trim().length > 0) {
      return node.title;
    }
    return node.kind === "folder"
      ? t("bookmarks.untitledFolder")
      : t("bookmarks.untitledBookmark");
  };

  const focusBookmark = async (bookmarkId: string | null): Promise<void> => {
    if (!bookmarkId) {
      return;
    }
    rovingBookmarkId = bookmarkId;
    await tick();
    const button = bookmarkButtons.find(
      (registration) => registration.bookmarkId === bookmarkId,
    )?.node;
    if (button?.isConnected) {
      button.focus({ preventScroll: true });
      button.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  };

  const chooseRoot = async (rootId: string): Promise<void> => {
    if (!rootId || rootId === current.selectedRootId) {
      return;
    }
    await runAction(() => props.bookmarks.selectRoot(rootId));
    rovingBookmarkId = resolveBookmarkFocusId(
      getVisibleBookmarkRows(props.bookmarks.snapshot()),
      null,
    );
  };

  const handleRootChange = (event: Event): void => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLSelectElement) || !target.value) {
      return;
    }
    reportAsyncError(chooseRoot(target.value));
  };

  const toggleFolder = async (folderId: string): Promise<void> => {
    await runAction(() => props.bookmarks.toggleFolder(folderId));
    await focusBookmark(folderId);
  };

  const openBookmark = async (
    bookmarkId: string,
    disposition: BookmarkOpenDisposition,
  ): Promise<void> => {
    await runAction(() => props.bookmarks.open(bookmarkId, disposition));
  };

  const handleBookmarkClick = (event: MouseEvent, bookmarkId: string): void => {
    if (event.button !== 0) {
      return;
    }
    const disposition = event.ctrlKey || event.metaKey ? "new-tab" : "current";
    reportAsyncError(openBookmark(bookmarkId, disposition));
  };

  const handleBookmarkAuxClick = (
    event: MouseEvent,
    bookmarkId: string,
  ): void => {
    if (event.button !== 1) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    reportAsyncError(openBookmark(bookmarkId, "new-tab"));
  };

  const preventMiddleAutoscroll = (event: MouseEvent): void => {
    if (event.button === 1) {
      event.preventDefault();
    }
  };

  const setFaviconSource = (node: HTMLImageElement, source: string) => {
    const assign = (nextSource: string): void => {
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

  const handleBookmarkContextMenu = (
    event: MouseEvent,
    row: BookmarkVisibleItemRow,
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    const source = event.currentTarget;
    if (!(source instanceof HTMLElement)) {
      return;
    }
    reportAsyncError(
      openBookmarkContextMenu(row, source, event.clientX, event.clientY, false),
    );
  };

  const activateContextMenuAction = (
    action:
      "manage-bookmarks" | "open-current" | "open-new-tab" | "toggle-folder",
  ): void => {
    const target = contextMenu;
    if (!target) {
      return;
    }
    closeBookmarkContextMenu(true);
    if (action === "manage-bookmarks") {
      try {
        props.onDismiss();
        props.bookmarks.manage();
      } catch (error) {
        props.onFatalError(error);
      }
      return;
    }
    if (action === "toggle-folder") {
      reportAsyncError(toggleFolder(target.bookmarkId));
      return;
    }
    reportAsyncError(
      openBookmark(
        target.bookmarkId,
        action === "open-new-tab" ? "new-tab" : "current",
      ),
    );
  };

  const handleContextMenuKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeBookmarkContextMenu(true);
      return;
    }
    if (!contextMenuElement) {
      return;
    }
    const menuItems = Array.from(
      contextMenuElement.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]',
      ),
    );
    const currentIndex = menuItems.findIndex(
      (item) => item === item.ownerDocument.activeElement,
    );
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % menuItems.length;
    } else if (event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + menuItems.length) % menuItems.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = menuItems.length - 1;
    }
    if (nextIndex !== null && menuItems[nextIndex]) {
      event.preventDefault();
      event.stopPropagation();
      menuItems[nextIndex].focus({ preventScroll: true });
    }
  };

  const handleItemKeydown = async (
    event: KeyboardEvent,
    row: BookmarkVisibleItemRow,
  ): Promise<void> => {
    if (
      event.key === "ContextMenu" ||
      (event.shiftKey && event.key === "F10")
    ) {
      event.preventDefault();
      event.stopPropagation();
      const source = event.currentTarget;
      if (source instanceof HTMLElement) {
        const bounds = source.getBoundingClientRect();
        await openBookmarkContextMenu(
          row,
          source,
          bounds.left + Math.min(24, bounds.width / 2),
          bounds.bottom,
          true,
        );
      }
      return;
    }
    const visibleItems = itemRows();
    const currentIndex = visibleItems.findIndex(
      (candidate) => candidate.node.id === row.node.id,
    );
    let targetId: string | null = null;
    if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      if (event.key === "ArrowDown") {
        targetId =
          visibleItems[(currentIndex + 1) % visibleItems.length]?.node.id;
      } else if (event.key === "ArrowUp") {
        targetId =
          visibleItems[
            (currentIndex - 1 + visibleItems.length) % visibleItems.length
          ]?.node.id;
      } else if (event.key === "Home") {
        targetId = visibleItems[0]?.node.id ?? null;
      } else if (event.key === "End") {
        targetId = visibleItems.at(-1)?.node.id ?? null;
      } else if (event.key === "ArrowRight" && row.node.kind === "folder") {
        event.preventDefault();
        event.stopPropagation();
        if (!row.expanded) {
          await toggleFolder(row.node.id);
        } else {
          const next = itemRows()[currentIndex + 1];
          if (next && next.depth > row.depth) {
            await focusBookmark(next.node.id);
          }
        }
        return;
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        event.stopPropagation();
        if (row.node.kind === "folder" && row.expanded) {
          await toggleFolder(row.node.id);
          return;
        }
        const ancestor = visibleItems
          .slice(0, currentIndex)
          .reverse()
          .find(
            (candidate) =>
              candidate.node.kind === "folder" && candidate.depth < row.depth,
          );
        await focusBookmark(ancestor?.node.id ?? null);
        return;
      }
    }
    if (targetId) {
      event.preventDefault();
      event.stopPropagation();
      await focusBookmark(targetId);
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (row.node.kind === "folder") {
      await toggleFolder(row.node.id);
    } else if (row.node.kind === "bookmark") {
      await openBookmark(
        row.node.id,
        event.ctrlKey || event.metaKey ? "new-tab" : "current",
      );
    }
  };

  const noticeText = (): string => {
    if (localMessage) {
      return localMessage;
    }
    if (current.notice === "stale-bookmark") {
      return t("bookmarks.stale");
    }
    if (current.notice === "unsupported-bookmark") {
      return t("bookmarks.unsupported");
    }
    if (current.notice === "open-failed") {
      return t("bookmarks.openFailed");
    }
    return "";
  };

  $effect(() => {
    if (!contextMenu || !bookmarkPanel) {
      return;
    }
    const ownerDocument = bookmarkPanel.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    const closeFromPointer = (event: PointerEvent): void => {
      const target = event.target;
      if (target instanceof Node && contextMenuElement?.contains(target)) {
        return;
      }
      closeBookmarkContextMenu(false);
    };
    const closeFromBlur = (): void => closeBookmarkContextMenu(false);
    ownerDocument.addEventListener("pointerdown", closeFromPointer, true);
    ownerWindow?.addEventListener("blur", closeFromBlur);
    return () => {
      ownerDocument.removeEventListener("pointerdown", closeFromPointer, true);
      ownerWindow?.removeEventListener("blur", closeFromBlur);
    };
  });

  onDestroy(() => {
    closeBookmarkContextMenu(false);
    bookmarkButtons.length = 0;
    bookmarkPanel = undefined;
    contextMenuElement = undefined;
    rootSelect = undefined;
  });
</script>

<section
  bind:this={bookmarkPanel}
  aria-busy={current.phase === "loading"}
  aria-label={t("bookmarks.panelAria")}
  lang={localeId}
  class="fennevia-bookmarks"
  data-fennevia-bookmarks=""
>
  <div class="fennevia-bookmarks__roots">
    <select
      bind:this={rootSelect}
      aria-controls="fennevia-bookmark-list"
      aria-label={t("bookmarks.locationTitle")}
      class="fennevia-control fennevia-bookmarks__root-select"
      data-fennevia-bookmark-roots=""
      data-fennevia-default-focus=""
      disabled={current.roots.length === 0}
      id="fennevia-bookmark-roots"
      onchange={handleRootChange}
      title={t("bookmarks.locationTitle")}
    >
      {#if current.roots.length === 0}
        <option selected value="">{t("bookmarks.loadingShort")}</option>
      {/if}
      {#each current.roots as root (root.id)}
        <option
          selected={current.selectedRootId === root.id}
          data-fennevia-bookmark-root=""
          value={root.id}>{root.title}</option
        >
      {/each}
    </select>
  </div>

  <div
    aria-label={t("bookmarks.listAria")}
    class="fennevia-bookmarks__list"
    data-fennevia-bookmark-list=""
    id="fennevia-bookmark-list"
    role="list"
  >
    {#if current.phase === "loading"}
      <div class="fennevia-bookmarks__empty" role="status">
        <FirefoxIcon name="loading" />
        <span>{t("bookmarks.loading")}</span>
      </div>
    {:else if current.phase === "error"}
      <div class="fennevia-bookmarks__empty" role="alert">
        <FirefoxIcon name="error" />
        <span>{t("bookmarks.error")}</span>
      </div>
    {:else}
      {#each rows as row (row.key)}
        {#if row.type === "item"}
          {#if row.node.kind === "separator"}
            <div
              aria-label={t("bookmarks.separator")}
              class="fennevia-bookmarks__separator"
              data-fennevia-bookmark-separator=""
              role="separator"
              style:--fennevia-bookmark-depth={row.depth}
            ></div>
          {:else}
            <div
              class="fennevia-bookmarks__item"
              data-fennevia-bookmark-kind={row.node.kind}
              data-fennevia-expanded={row.expanded}
              role="listitem"
              style:--fennevia-bookmark-depth={row.depth}
            >
              <button
                use:registerBookmarkButton={row.node.id}
                aria-busy={current.openingBookmarkId === row.node.id}
                aria-expanded={row.node.kind === "folder"
                  ? row.expanded
                  : undefined}
                aria-label={displayTitle(row.node)}
                class="fennevia-bookmarks__item-button"
                data-fennevia-bookmark-item=""
                disabled={current.openingBookmarkId !== null}
                onauxclick={(event) =>
                  row.node.kind === "bookmark" &&
                  handleBookmarkAuxClick(event, row.node.id)}
                oncontextmenu={(event) => handleBookmarkContextMenu(event, row)}
                onclick={(event) =>
                  row.node.kind === "folder"
                    ? reportAsyncError(toggleFolder(row.node.id))
                    : handleBookmarkClick(event, row.node.id)}
                onfocus={() => (rovingBookmarkId = row.node.id)}
                onkeydown={(event) =>
                  reportAsyncError(handleItemKeydown(event, row))}
                onmousedown={(event) =>
                  row.node.kind === "bookmark" &&
                  preventMiddleAutoscroll(event)}
                tabindex={rovingBookmarkId === row.node.id ? 0 : -1}
                title={displayTitle(row.node)}
                type="button"
              >
                <span aria-hidden="true" class="fennevia-bookmarks__item-icon">
                  {#if row.node.kind === "bookmark" && row.node.faviconUrl}
                    <img
                      use:setFaviconSource={row.node.faviconUrl}
                      alt=""
                      class="fennevia-bookmarks__item-favicon"
                      decoding="async"
                      draggable="false"
                      referrerpolicy="no-referrer"
                    />
                  {/if}
                  <span class="fennevia-bookmarks__item-fallback">
                    <FirefoxIcon
                      name={row.node.kind === "folder"
                        ? row.expanded
                          ? "arrow-down"
                          : "arrow-right"
                        : "bookmark-item"}
                    />
                  </span>
                </span>
                <span class="fennevia-bookmarks__item-title" dir="auto">
                  {displayTitle(row.node)}
                </span>
              </button>
              {#if row.node.kind === "bookmark"}
                <button
                  aria-label={t("bookmarks.openNewTabAria", {
                    title: displayTitle(row.node),
                  })}
                  class="fennevia-bookmarks__new-tab"
                  data-fennevia-action="open-bookmark-new-tab"
                  disabled={current.openingBookmarkId !== null}
                  onclick={() =>
                    reportAsyncError(openBookmark(row.node.id, "new-tab"))}
                  title={t("bookmarks.openNewTab")}
                  type="button"><FirefoxIcon name="open-in-new" /></button
                >
              {/if}
            </div>
          {/if}
        {:else}
          <div
            class="fennevia-bookmarks__branch"
            data-fennevia-bookmark-branch-phase={row.branch.phase}
            role="status"
            style:--fennevia-bookmark-depth={row.depth}
          >
            {#if row.branch.phase === "idle" || row.branch.phase === "loading"}
              <FirefoxIcon name="loading" />
              <span>{t("bookmarks.loadingShort")}</span>
            {:else if row.branch.phase === "error"}
              <span>{t("bookmarks.folderLoadError")}</span>
              <button
                onclick={() =>
                  reportAsyncError(
                    runAction(() => props.bookmarks.retry(row.parentId)),
                  )}
                type="button">{t("bookmarks.retry")}</button
              >
            {:else if row.branch.phase === "stale"}
              <span>{t("bookmarks.folderChanged")}</span>
            {:else if row.branch.items.length === 0}
              <span>{t("bookmarks.emptyFolder")}</span>
            {/if}
            {#if row.branch.phase === "ready" && (row.branch.offset > 0 || row.branch.truncated)}
              <div
                aria-label={t("bookmarks.folderPages")}
                class="fennevia-bookmarks__pager"
              >
                <button
                  disabled={row.branch.offset === 0}
                  onclick={() =>
                    reportAsyncError(
                      runAction(() =>
                        props.bookmarks.page(row.parentId, "previous"),
                      ),
                    )}
                  type="button">{t("bookmarks.previous")}</button
                >
                <span>
                  {t("bookmarks.pageRange", {
                    start: row.branch.offset + 1,
                    end: row.branch.offset + row.branch.items.length,
                    total: row.branch.totalCount,
                  })}
                </span>
                <button
                  disabled={!row.branch.truncated}
                  onclick={() =>
                    reportAsyncError(
                      runAction(() =>
                        props.bookmarks.page(row.parentId, "next"),
                      ),
                    )}
                  type="button">{t("bookmarks.next")}</button
                >
              </div>
            {/if}
          </div>
        {/if}
      {/each}
    {/if}
  </div>

  <output
    aria-live="polite"
    class="fennevia-bookmarks__status"
    data-fennevia-bookmark-status="">{noticeText()}</output
  >

  {#if contextMenu}
    <div
      bind:this={contextMenuElement}
      aria-label={t("bookmarks.contextMenuAria")}
      class="fennevia-bookmarks__context-menu"
      data-fennevia-bookmark-context-menu=""
      oncontextmenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onkeydown={handleContextMenuKeydown}
      role="menu"
      style:left={`${contextMenu.left}px`}
      style:top={`${contextMenu.top}px`}
      tabindex="-1"
    >
      {#if contextMenu.kind === "bookmark"}
        <button
          onclick={() => activateContextMenuAction("open-current")}
          role="menuitem"
          type="button">{t("bookmarks.openCurrent")}</button
        >
        <button
          onclick={() => activateContextMenuAction("open-new-tab")}
          role="menuitem"
          type="button">{t("bookmarks.openNewTab")}</button
        >
      {:else}
        <button
          onclick={() => activateContextMenuAction("toggle-folder")}
          role="menuitem"
          type="button"
          >{contextMenu.expanded
            ? t("bookmarks.collapseFolder")
            : t("bookmarks.expandFolder")}</button
        >
      {/if}
      <div class="fennevia-bookmarks__context-separator" role="separator"></div>
      <button
        onclick={() => activateContextMenuAction("manage-bookmarks")}
        role="menuitem"
        type="button">{t("bookmarks.manage")}</button
      >
    </div>
  {/if}
</section>
