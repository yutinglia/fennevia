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

  type Props = Readonly<{
    bookmarks: BrowserBookmarksStateAdapter;
    onFatalError: (error: unknown) => void;
  }>;

  const props: Props = $props();
  let current: BrowserBookmarksState = $state(
    untrack(() => props.bookmarks.snapshot()),
  );
  let localMessage = $state("");
  let rovingBookmarkId: string | null = $state(null);
  let rootSelect: HTMLSelectElement | undefined = $state();
  let rows: readonly BookmarkVisibleRow[] = $derived(
    getVisibleBookmarkRows(current),
  );
  const bookmarkButtons: Array<{
    bookmarkId: string;
    node: HTMLButtonElement;
  }> = [];

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
        void restoreFocusAfterLiveRemoval(nextFocusId);
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
        localMessage = "Collapse a folder before opening another deep branch.";
        return;
      }
      props.onFatalError(error);
    }
  };

  const displayTitle = (node: BookmarkNodeSnapshot): string => {
    if (node.title.trim().length > 0) {
      return node.title;
    }
    return node.kind === "folder" ? "Untitled folder" : "Untitled bookmark";
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
    void chooseRoot(target.value);
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
    const disposition = event.ctrlKey || event.metaKey ? "new-tab" : "current";
    void openBookmark(bookmarkId, disposition);
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
    void openBookmark(bookmarkId, "new-tab");
  };

  const handleItemKeydown = async (
    event: KeyboardEvent,
    row: BookmarkVisibleItemRow,
  ): Promise<void> => {
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
      return "That bookmark was removed or changed. The list is refreshing.";
    }
    if (current.notice === "unsupported-bookmark") {
      return "Executable and data bookmark links are not opened here.";
    }
    if (current.notice === "open-failed") {
      return "Firefox could not open that bookmark.";
    }
    return "Ctrl or Command + Enter opens a bookmark in a new tab.";
  };

  onDestroy(() => {
    bookmarkButtons.length = 0;
    rootSelect = undefined;
  });
</script>

<section
  aria-busy={current.phase === "loading"}
  aria-label="Bookmarks"
  class="fennevia-bookmarks"
  data-fennevia-bookmarks=""
>
  <div class="fennevia-bookmarks__roots">
    <label class="fennevia-bookmarks__roots-label" for="fennevia-bookmark-roots">
      Location
    </label>
    <select
      bind:this={rootSelect}
      aria-controls="fennevia-bookmark-list"
      class="fennevia-control fennevia-bookmarks__root-select"
      data-fennevia-bookmark-roots=""
      data-fennevia-default-focus=""
      disabled={current.roots.length === 0}
      id="fennevia-bookmark-roots"
      onchange={handleRootChange}
      title="Bookmark location"
    >
      {#if current.roots.length === 0}
        <option selected value="">Loading…</option>
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
    aria-label="Bookmarks in selected location"
    class="fennevia-bookmarks__list"
    data-fennevia-bookmark-list=""
    id="fennevia-bookmark-list"
    role="list"
  >
    {#if current.phase === "loading"}
      <div class="fennevia-bookmarks__empty" role="status">
        <span aria-hidden="true">◌</span>
        <span>Loading bookmark locations…</span>
      </div>
    {:else if current.phase === "error"}
      <div class="fennevia-bookmarks__empty" role="alert">
        <span aria-hidden="true">!</span>
        <span
          >Bookmarks are unavailable. Native Firefox tools remain usable.</span
        >
      </div>
    {:else}
      {#each rows as row (row.key)}
        {#if row.type === "item"}
          {#if row.node.kind === "separator"}
            <div
              aria-label="Separator"
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
                onclick={(event) =>
                  row.node.kind === "folder"
                    ? void toggleFolder(row.node.id)
                    : handleBookmarkClick(event, row.node.id)}
                onfocus={() => (rovingBookmarkId = row.node.id)}
                onkeydown={(event) => void handleItemKeydown(event, row)}
                tabindex={rovingBookmarkId === row.node.id ? 0 : -1}
                title={displayTitle(row.node)}
                type="button"
              >
                <span aria-hidden="true" class="fennevia-bookmarks__item-icon">
                  {row.node.kind === "folder"
                    ? row.expanded
                      ? "▾"
                      : "▸"
                    : "•"}
                </span>
                <span class="fennevia-bookmarks__item-title" dir="auto">
                  {displayTitle(row.node)}
                </span>
              </button>
              {#if row.node.kind === "bookmark"}
                <button
                  aria-label={`Open ${displayTitle(row.node)} in a new tab`}
                  class="fennevia-bookmarks__new-tab"
                  data-fennevia-action="open-bookmark-new-tab"
                  disabled={current.openingBookmarkId !== null}
                  onclick={() => void openBookmark(row.node.id, "new-tab")}
                  title="Open in new tab"
                  type="button">↗</button
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
              <span aria-hidden="true">◌</span>
              <span>Loading…</span>
            {:else if row.branch.phase === "error"}
              <span>Couldn’t load this folder.</span>
              <button
                onclick={() =>
                  void runAction(() => props.bookmarks.retry(row.parentId))}
                type="button">Retry</button
              >
            {:else if row.branch.phase === "stale"}
              <span>This folder changed or was removed.</span>
            {:else if row.branch.items.length === 0}
              <span>No bookmarks here.</span>
            {/if}
            {#if row.branch.phase === "ready" && (row.branch.offset > 0 || row.branch.truncated)}
              <div aria-label="Folder pages" class="fennevia-bookmarks__pager">
                <button
                  disabled={row.branch.offset === 0}
                  onclick={() =>
                    void runAction(() =>
                      props.bookmarks.page(row.parentId, "previous"),
                    )}
                  type="button">Previous</button
                >
                <span>
                  {row.branch.offset + 1}–{row.branch.offset +
                    row.branch.items.length} of {row.branch.totalCount}
                </span>
                <button
                  disabled={!row.branch.truncated}
                  onclick={() =>
                    void runAction(() =>
                      props.bookmarks.page(row.parentId, "next"),
                    )}
                  type="button">Next</button
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
</section>
