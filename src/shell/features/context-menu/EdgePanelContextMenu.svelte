<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import { onDestroy, tick } from "svelte";

  import type { BrowserBookmarksStateAdapter } from "../../../app/bookmark-state";
  import type { BrowserToolsStateAdapter } from "../../../app/browser-tools-state";
  import type { CustomizeSessionController } from "../../../app/customize-session";
  import type {
    EdgeName,
    EdgeShellController,
  } from "../../../app/edge-surfaces";
  import { translate } from "../../../app/i18n";
  import type { FenneviaLocale } from "../../../app/locale-state";
  import type { BrowserTabsStateAdapter } from "../../../app/tab-state";
  import type { BrowserToolbarWidgetsStateAdapter } from "../../../app/toolbar-widgets-state";

  type Props = Readonly<{
    bookmarks?: BrowserBookmarksStateAdapter;
    browserTools?: BrowserToolsStateAdapter;
    customizeSession?: CustomizeSessionController;
    edge: EdgeName;
    frame: HTMLElement;
    localeId: FenneviaLocale;
    onDismiss: (edge: EdgeName) => void;
    onFatalError: (error: unknown) => void;
    onSetCustomizeOpen: (open: boolean) => void;
    panel?: HTMLDivElement;
    shell: EdgeShellController;
    tabs?: BrowserTabsStateAdapter;
    toolbarWidgets?: BrowserToolbarWidgetsStateAdapter;
    visible: boolean;
  }>;

  type ContextMenuPosition = Readonly<{
    left: number;
    top: number;
  }>;

  type ContextAction =
    | "customize-fennevia"
    | "customize-firefox"
    | "manage-bookmarks"
    | "native-toolbar"
    | "new-tab"
    | "open-downloads"
    | "settings";

  const props: Props = $props();
  const t = (key: Parameters<typeof translate>[1]): string =>
    translate(props.localeId, key);
  let contextMenu: ContextMenuPosition | null = $state(null);
  let contextMenuElement: HTMLDivElement | undefined = $state();
  let restoreTarget: HTMLElement | null = null;
  let contextSequence = 0;
  let browserToolsSnapshot = $derived(props.browserTools?.snapshot());
  let canEditFennevia = $derived(
    Boolean(
      props.customizeSession &&
      props.toolbarWidgets?.snapshot().snapshot.canEdit,
    ),
  );
  let hasPanelAction = $derived(
    props.edge === "left"
      ? Boolean(props.tabs)
      : props.edge === "right"
        ? Boolean(props.bookmarks)
        : props.edge === "bottom"
          ? browserToolsSnapshot?.downloads === true
          : browserToolsSnapshot?.settings === true,
  );
  let hasCommonAction = $derived(
    canEditFennevia ||
      browserToolsSnapshot?.customize === true ||
      browserToolsSnapshot?.nativeToolbar === true,
  );
  let edgeLabel = $derived(t(`surface.${props.edge}`));

  const itemContextOwnerSelector =
    "[data-fennevia-tab-item], [data-fennevia-bookmark-item], [data-fennevia-edge-context-menu], [data-fennevia-bookmark-context-menu]";

  const isItemContextOwner = (target: MouseEvent["target"]): boolean =>
    target instanceof Element &&
    Boolean(target.closest(itemContextOwnerSelector));

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

  const closeContextMenu = (
    restoreFocus: boolean,
    releaseHold = true,
  ): void => {
    if (!contextMenu) {
      return;
    }
    contextSequence += 1;
    const target = restoreTarget;
    if (restoreFocus && target?.isConnected) {
      target.focus({ preventScroll: true });
    } else {
      blurFocusedContextMenuItem();
    }
    contextMenu = null;
    restoreTarget = null;
    if (releaseHold) {
      props.shell.setPopupHeld(props.edge, false);
    }
  };

  const clampCoordinate = (
    value: number,
    minimum: number,
    maximum: number,
  ): number =>
    maximum < minimum ? minimum : Math.min(Math.max(value, minimum), maximum);

  const positionContextMenu = async (
    sequence: number,
    clientX: number,
    clientY: number,
  ): Promise<void> => {
    await tick();
    const panel = props.panel;
    const menu = contextMenuElement;
    if (sequence !== contextSequence || !contextMenu || !panel || !menu) {
      return;
    }
    const frameBounds = props.frame.getBoundingClientRect();
    const panelBounds = panel.getBoundingClientRect();
    const menuBounds = menu.getBoundingClientRect();
    contextMenu = {
      left: clampCoordinate(
        clientX - panelBounds.left,
        frameBounds.left - panelBounds.left + 6,
        frameBounds.right - panelBounds.left - menuBounds.width - 6,
      ),
      top: clampCoordinate(
        clientY - panelBounds.top,
        frameBounds.top - panelBounds.top + 6,
        frameBounds.bottom - panelBounds.top - menuBounds.height - 6,
      ),
    };
    await tick();
    if (sequence !== contextSequence) {
      return;
    }
    contextMenuElement
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
      ?.focus({ preventScroll: true });
  };

  const handlePanelContextMenu = (event: MouseEvent): void => {
    if (event.defaultPrevented || !props.visible) {
      return;
    }
    const target = event.target;
    // This listener is native while descendant Svelte handlers are delegated;
    // return without consuming the event so the delegated item owner receives
    // and handles its more specific context menu.
    if (isItemContextOwner(target)) {
      return;
    }
    const panel = props.panel;
    if (!panel) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const interactiveTarget =
      target instanceof Element
        ? target.closest<HTMLElement>(
            'button, input, select, textarea, [contenteditable="true"], [role="button"], [role="link"], [role="tab"], [tabindex]',
          )
        : null;
    let clientX = event.clientX;
    let clientY = event.clientY;
    if (clientX === 0 && clientY === 0 && interactiveTarget) {
      const targetBounds = interactiveTarget.getBoundingClientRect();
      clientX = targetBounds.left + Math.min(24, targetBounds.width / 2);
      clientY = targetBounds.bottom;
    }
    const panelBounds = panel.getBoundingClientRect();
    restoreTarget =
      event.clientX === 0 && event.clientY === 0 ? interactiveTarget : null;
    contextMenu = {
      left: clientX - panelBounds.left,
      top: clientY - panelBounds.top,
    };
    props.shell.setPopupHeld(props.edge, true);
    const sequence = ++contextSequence;
    void positionContextMenu(sequence, clientX, clientY).catch(
      props.onFatalError,
    );
  };

  const handleMenuKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeContextMenu(true);
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

  const runContextAction = async (action: ContextAction): Promise<void> => {
    try {
      if (action === "open-downloads") {
        const browserTools = props.browserTools;
        const host = props.panel;
        if (!browserTools || !host?.isConnected) {
          throw new Error("FENNEVIA_BROWSER_TOOLS_UNAVAILABLE");
        }
        const opened = await browserTools.invoke("downloads", host);
        closeContextMenu(false, !opened);
        return;
      }

      closeContextMenu(false);
      if (action === "new-tab") {
        if (!props.tabs) {
          throw new Error("FENNEVIA_TABS_UNAVAILABLE");
        }
        props.tabs.open();
        return;
      }
      if (action === "manage-bookmarks") {
        if (!props.bookmarks) {
          throw new Error("FENNEVIA_BOOKMARKS_UNAVAILABLE");
        }
        props.onDismiss(props.edge);
        props.bookmarks.manage();
        return;
      }
      if (action === "customize-fennevia") {
        props.shell.revealProgrammatically("top");
        props.onSetCustomizeOpen(true);
        return;
      }
      const browserTools = props.browserTools;
      if (!browserTools) {
        throw new Error("FENNEVIA_BROWSER_TOOLS_UNAVAILABLE");
      }
      props.onDismiss(props.edge);
      await browserTools.invoke(
        action === "customize-firefox"
          ? "customize"
          : action === "settings"
            ? "settings"
            : "native-toolbar",
      );
    } catch (error) {
      closeContextMenu(false);
      props.shell.setPopupHeld(props.edge, false);
      props.onFatalError(error);
    }
  };

  $effect(() => {
    const panel = props.panel;
    if (!panel) {
      return;
    }
    panel.addEventListener("contextmenu", handlePanelContextMenu);
    return () =>
      panel.removeEventListener("contextmenu", handlePanelContextMenu);
  });

  $effect(() => {
    const panel = props.panel;
    if (!contextMenu || !panel) {
      return;
    }
    const ownerDocument = panel.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    const closeFromPointer = (event: PointerEvent): void => {
      const target = event.target;
      if (target instanceof Node && contextMenuElement?.contains(target)) {
        return;
      }
      closeContextMenu(false);
    };
    const closeFromBlur = (): void => closeContextMenu(false);
    ownerDocument.addEventListener("pointerdown", closeFromPointer, true);
    ownerWindow?.addEventListener("blur", closeFromBlur);
    return () => {
      ownerDocument.removeEventListener("pointerdown", closeFromPointer, true);
      ownerWindow?.removeEventListener("blur", closeFromBlur);
    };
  });

  $effect(() => {
    if (!props.visible && contextMenu) {
      closeContextMenu(false);
    }
  });

  onDestroy(() => closeContextMenu(false));
</script>

{#if contextMenu}
  <div
    bind:this={contextMenuElement}
    aria-label={translate(props.localeId, "panelContext.aria", {
      edge: edgeLabel,
    })}
    class="fennevia-edge-context-menu"
    data-fennevia-edge-context-menu={props.edge}
    oncontextmenu={(event) => {
      event.preventDefault();
      event.stopPropagation();
    }}
    onkeydown={handleMenuKeydown}
    role="menu"
    style:left={`${contextMenu.left}px`}
    style:top={`${contextMenu.top}px`}
    tabindex="-1"
  >
    {#if props.edge === "left" && props.tabs}
      <button
        onclick={() => void runContextAction("new-tab")}
        role="menuitem"
        type="button">{t("panelContext.newTab")}</button
      >
    {:else if props.edge === "right" && props.bookmarks}
      <button
        onclick={() => void runContextAction("manage-bookmarks")}
        role="menuitem"
        type="button">{t("bookmarks.manage")}</button
      >
    {:else if props.edge === "bottom" && browserToolsSnapshot?.downloads}
      <button
        onclick={() => void runContextAction("open-downloads")}
        role="menuitem"
        type="button">{t("panelContext.openDownloads")}</button
      >
    {:else if props.edge === "top" && browserToolsSnapshot?.settings}
      <button
        onclick={() => void runContextAction("settings")}
        role="menuitem"
        type="button">{t("panelContext.settings")}</button
      >
    {/if}

    {#if hasPanelAction && hasCommonAction}
      <div class="fennevia-edge-context-menu__separator" role="separator"></div>
    {/if}

    {#if canEditFennevia}
      <button
        onclick={() => void runContextAction("customize-fennevia")}
        role="menuitem"
        type="button">{t("panelContext.customizeFennevia")}</button
      >
    {/if}
    {#if browserToolsSnapshot?.customize}
      <button
        onclick={() => void runContextAction("customize-firefox")}
        role="menuitem"
        type="button">{t("panelContext.customizeFirefox")}</button
      >
    {/if}
    {#if browserToolsSnapshot?.nativeToolbar}
      <button
        onclick={() => void runContextAction("native-toolbar")}
        role="menuitem"
        type="button">{t("panelContext.nativeToolbar")}</button
      >
    {/if}
  </div>
{/if}
