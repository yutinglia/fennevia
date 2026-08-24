<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import { tick } from "svelte";

  import type { AddressPopupController } from "../../../app/address-popup";
  import type { BrowserBookmarksStateAdapter } from "../../../app/bookmark-state";
  import type { BrowserToolsStateAdapter } from "../../../app/browser-tools-state";
  import type { CustomizeSessionController } from "../../../app/customize-session";
  import type { BrowserDownloadsStateAdapter } from "../../../app/download-state";
  import type {
    EdgeName,
    EdgeShellController,
  } from "../../../app/edge-surfaces";
  import { translate } from "../../../app/i18n";
  import type { FenneviaLocale } from "../../../app/locale-state";
  import type { BrowserNavigationStateAdapter } from "../../../app/navigation-state";
  import type { BrowserTabsStateAdapter } from "../../../app/tab-state";
  import {
    clearToolbarWidgetDrag,
    createToolbarWidgetDropEdit,
    getActiveToolbarWidgetDrag,
    resolveWidgetInsertBefore,
    serializeToolbarWidgetDrag,
    startToolbarWidgetDrag,
    subscribeToolbarWidgetDrag,
    toolbarWidgetDragMimeType,
  } from "../../../app/toolbar-widget-drag";
  import {
    defaultToolbarLayoutDirection,
    toolbarLayoutParent,
    type BrowserToolbarWidgetsState,
    type BrowserToolbarWidgetsStateAdapter,
    type ProjectWidgetId,
    type ToolbarLayoutDirection,
    type ToolbarLayoutNodeSnapshot,
    type ToolbarWidgetsEditOperation,
  } from "../../../app/toolbar-widgets-state";
  import type { BrowserWindowControlsStateAdapter } from "../../../app/window-controls-state";
  import FirefoxToolbarWidget from "./FirefoxToolbarWidget.svelte";
  import ProjectWidget from "./ProjectWidget.svelte";

  type Props = Readonly<{
    addressPopup: AddressPopupController;
    bookmarks: BrowserBookmarksStateAdapter;
    browserTools?: BrowserToolsStateAdapter;
    customizeOpen: boolean;
    customizeSession?: CustomizeSessionController;
    downloads: BrowserDownloadsStateAdapter;
    edge: EdgeName;
    localeId: FenneviaLocale;
    navigation: BrowserNavigationStateAdapter;
    onDismiss: (edge: EdgeName) => void;
    onFatalError: (error: unknown) => void;
    onOpenAddress: () => boolean;
    onRevealProject: (id: ProjectWidgetId) => boolean;
    onSetCustomizeOpen: (open: boolean) => void;
    shell: EdgeShellController;
    state: BrowserToolbarWidgetsState | null;
    tabs: BrowserTabsStateAdapter;
    toolbarWidgets?: BrowserToolbarWidgetsStateAdapter;
    windowControls: BrowserWindowControlsStateAdapter;
    windowKind: "normal" | "private";
  }>;

  type DropPreview = Readonly<{
    index: number;
    parentKey: string;
  }>;

  const props: Props = $props();
  let root: HTMLDivElement | undefined = $state();
  let dropPreview: DropPreview | null = $state(null);
  let announcement = $state("");
  let rootDirection = $derived(defaultToolbarLayoutDirection(props.edge));
  let nodes = $derived(props.state?.snapshot.layout[props.edge] ?? []);
  let revision = $derived(props.state?.revision ?? 0);
  let baseContainerInstanceId = $derived(
    nodes.length === 1 &&
      nodes[0]?.type === "container" &&
      nodes[0].direction === rootDirection
      ? nodes[0].instanceId
      : null,
  );
  let rootDropParentPath = $derived<readonly number[]>(
    baseContainerInstanceId ? Object.freeze([0]) : Object.freeze([]),
  );

  $effect(() =>
    subscribeToolbarWidgetDrag(() => {
      dropPreview = null;
    }),
  );

  $effect(() => {
    if (!props.customizeOpen) {
      dropPreview = null;
    }
  });

  const pathKey = (path: readonly number[]): string =>
    path.length === 0 ? "root" : path.join(".");

  const runEdit = async (
    operation: ToolbarWidgetsEditOperation,
    focusInstanceId?: string,
    fallbackPath?: readonly number[],
  ): Promise<void> => {
    announcement = "";
    try {
      await props.toolbarWidgets?.edit(operation);
      await tick();
      const focusTarget = focusInstanceId
        ? root?.querySelector<HTMLButtonElement>(
            `[data-fennevia-layout-instance="${focusInstanceId}"] [data-fennevia-layout-node-controls] button:not(:disabled)`,
          )
        : null;
      const fallback = fallbackPath
        ? root?.querySelector<HTMLElement>(
            `[data-fennevia-layout-path="${pathKey(fallbackPath)}"]`,
          )
        : root;
      (focusTarget ?? fallback)?.focus({ preventScroll: true });
    } catch {
      announcement = translate(props.localeId, "customize.editFailed");
    }
  };

  const nodeLabel = (node: ToolbarLayoutNodeSnapshot): string =>
    node.type === "container"
      ? node.direction === "row"
        ? translate(props.localeId, "widget.row")
        : translate(props.localeId, "widget.column")
      : node.type === "wrapper"
        ? translate(props.localeId, `widget.${node.kind}`)
        : node.widget.kind === "separator"
          ? translate(props.localeId, "widget.separator")
          : node.widget.kind === "spacer"
            ? translate(props.localeId, "widget.space")
            : node.widget.kind === "spring"
              ? translate(props.localeId, "widget.flexibleSpace")
              : node.widget.label || "Toolbar item";

  const isStructuralItem = (node: ToolbarLayoutNodeSnapshot): boolean =>
    node.type === "item" &&
    (node.widget.kind === "separator" ||
      node.widget.kind === "spacer" ||
      node.widget.kind === "spring");

  const canAcceptChild = (node: ToolbarLayoutNodeSnapshot): boolean =>
    node.type === "container" ||
    (node.type === "wrapper" && node.children.length === 0);

  const selectEmptyPanel = (): void => {
    props.customizeSession?.setLastFocusedZone(props.edge);
    announcement = translate(props.localeId, "customize.emptyPanelSelected");
  };

  const moveSibling = (
    node: ToolbarLayoutNodeSnapshot,
    path: readonly number[],
    delta: -1 | 1,
  ): void => {
    const snapshot = props.state?.snapshot;
    if (!snapshot || path.length === 0) {
      return;
    }
    const location = { path, zone: props.edge } as const;
    const parent = toolbarLayoutParent(snapshot.layout, location);
    const index = path.at(-1) as number;
    if (
      !parent ||
      index + delta < 0 ||
      index + delta >= parent.children.length
    ) {
      return;
    }
    void runEdit(
      {
        from: location,
        revision,
        to: {
          index: delta < 0 ? index - 1 : index + 2,
          parentPath: parent.parentPath,
          zone: props.edge,
        },
        type: "move-node",
      },
      node.instanceId,
    );
  };

  const moveIntoPrevious = (
    node: ToolbarLayoutNodeSnapshot,
    path: readonly number[],
  ): void => {
    const snapshot = props.state?.snapshot;
    if (!snapshot || path.length === 0) {
      return;
    }
    const location = { path, zone: props.edge } as const;
    const parent = toolbarLayoutParent(snapshot.layout, location);
    const index = path.at(-1) as number;
    const previous = parent?.children[index - 1];
    if (
      !parent ||
      !previous ||
      previous.type === "item" ||
      (previous.type === "wrapper" && previous.children.length > 0)
    ) {
      return;
    }
    void runEdit(
      {
        from: location,
        revision,
        to: {
          index: previous.children.length,
          parentPath: [...parent.parentPath, index - 1],
          zone: props.edge,
        },
        type: "move-node",
      },
      node.instanceId,
    );
  };

  const moveOut = (
    node: ToolbarLayoutNodeSnapshot,
    path: readonly number[],
  ): void => {
    if (!canMoveOut(path)) {
      return;
    }
    const parentPath = path.slice(0, -1);
    const parentIndex = parentPath.at(-1) as number;
    void runEdit(
      {
        from: { path, zone: props.edge },
        revision,
        to: {
          index: parentIndex + 1,
          parentPath: parentPath.slice(0, -1),
          zone: props.edge,
        },
        type: "move-node",
      },
      node.instanceId,
    );
  };

  const canMoveOut = (path: readonly number[]): boolean =>
    path.length >= 2 &&
    !(path.length === 2 && nodes[0]?.instanceId === baseContainerInstanceId);

  const removeNode = (
    node: ToolbarLayoutNodeSnapshot,
    path: readonly number[],
  ): void => {
    if (node.type === "item" && node.projectId === "customize-shell") {
      announcement = translate(props.localeId, "customize.required");
      return;
    }
    void runEdit(
      {
        location: { path, zone: props.edge },
        revision,
        type: "remove-node",
      },
      undefined,
      path.slice(0, -1),
    );
  };

  const toggleDirection = (
    node: ToolbarLayoutNodeSnapshot,
    path: readonly number[],
  ): void => {
    if (node.type !== "container") {
      return;
    }
    void runEdit(
      {
        direction: node.direction === "row" ? "column" : "row",
        location: { path, zone: props.edge },
        revision,
        type: "set-container-direction",
      },
      node.instanceId,
    );
  };

  const beginDrag = (
    event: DragEvent,
    node: ToolbarLayoutNodeSnapshot,
  ): void => {
    if (!props.customizeOpen || !event.dataTransfer) {
      event.preventDefault();
      return;
    }
    const source = startToolbarWidgetDrag({
      instanceId: node.instanceId,
      type: "layout-node",
    });
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      toolbarWidgetDragMimeType,
      serializeToolbarWidgetDrag(source),
    );
    event.dataTransfer.setData("text/plain", source.type);
    props.customizeSession?.setLastFocusedZone(props.edge);
  };

  const insertionIndex = (
    event: DragEvent,
    direction: ToolbarLayoutDirection,
  ): number | null => {
    const container = event.currentTarget;
    if (!(container instanceof HTMLElement)) {
      return null;
    }
    const children = Array.from(container.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement &&
        child.hasAttribute("data-fennevia-layout-node"),
    );
    const mids = children.map((child) => {
      const bounds = child.getBoundingClientRect();
      return direction === "row"
        ? bounds.left + bounds.width / 2
        : bounds.top + bounds.height / 2;
    });
    return resolveWidgetInsertBefore(
      mids,
      direction === "row" ? event.clientX : event.clientY,
    );
  };

  const handleDragOver = (
    event: DragEvent,
    parentPath: readonly number[],
    direction: ToolbarLayoutDirection,
  ): void => {
    if (!props.customizeOpen || !getActiveToolbarWidgetDrag()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    const index = insertionIndex(event, direction);
    if (index !== null) {
      dropPreview = { index, parentKey: pathKey(parentPath) };
      props.customizeSession?.setLastFocusedZone(props.edge);
    }
  };

  const handleDrop = (
    event: DragEvent,
    parentPath: readonly number[],
    direction: ToolbarLayoutDirection,
  ): void => {
    if (!props.customizeOpen) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const source = getActiveToolbarWidgetDrag();
    const snapshot = props.state?.snapshot;
    const index = insertionIndex(event, direction) ?? 0;
    const operation =
      source && snapshot
        ? createToolbarWidgetDropEdit(
            source,
            {
              insertBefore: index,
              parentPath,
              type: "layout",
              zone: props.edge,
            },
            revision,
            snapshot.layout,
          )
        : null;
    dropPreview = null;
    clearToolbarWidgetDrag();
    if (operation) {
      void runEdit(
        operation,
        source?.type === "layout-node" ? source.instanceId : undefined,
      );
    }
  };

  const handleDragLeave = (event: DragEvent): void => {
    const current = event.currentTarget;
    const related = event.relatedTarget;
    if (
      current instanceof Node &&
      related instanceof Node &&
      current.contains(related)
    ) {
      return;
    }
    dropPreview = null;
  };

  const handleNodeKeydown = (
    event: KeyboardEvent,
    node: ToolbarLayoutNodeSnapshot,
    path: readonly number[],
    direction: ToolbarLayoutDirection,
  ): void => {
    if (!props.customizeOpen) {
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      removeNode(node, path);
      return;
    }
    if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
      return;
    }
    const previous = direction === "row" ? "ArrowLeft" : "ArrowUp";
    const next = direction === "row" ? "ArrowRight" : "ArrowDown";
    if (event.key === previous || event.key === next) {
      event.preventDefault();
      event.stopPropagation();
      moveSibling(node, path, event.key === previous ? -1 : 1);
    }
  };
</script>

{#snippet renderNodes(
  children: readonly ToolbarLayoutNodeSnapshot[],
  parentPath: readonly number[],
  direction: ToolbarLayoutDirection,
)}
  {#each children as node, index (node.instanceId)}
    {@const path = [...parentPath, index]}
    {@const isBaseContainer = node.instanceId === baseContainerInstanceId}
    {@const structuralItem = isStructuralItem(node)}
    {@const parent = props.state
      ? toolbarLayoutParent(props.state.snapshot.layout, {
          path,
          zone: props.edge,
        })
      : null}
    {@const previous = parent?.children[index - 1]}
    <div
      aria-label={props.customizeOpen && !isBaseContainer
        ? nodeLabel(node)
        : undefined}
      class="fennevia-layout-node"
      class:fennevia-layout-node--base={isBaseContainer}
      class:fennevia-layout-node--container={node.type === "container"}
      class:fennevia-layout-node--expanded={node.type === "wrapper" &&
        node.kind === "expanded"}
      class:fennevia-layout-node--editing={props.customizeOpen &&
        !isBaseContainer}
      class:fennevia-layout-node--special={structuralItem}
      class:fennevia-layout-node--wrapper={node.type === "wrapper"}
      data-fennevia-layout-instance={node.instanceId}
      data-fennevia-layout-node=""
      data-fennevia-layout-node-type={node.type}
      data-fennevia-layout-special-kind={structuralItem && node.type === "item"
        ? node.widget.kind
        : undefined}
      data-fennevia-layout-path={pathKey(path)}
      draggable={props.customizeOpen && !isBaseContainer}
      ondragend={() => {
        dropPreview = null;
        clearToolbarWidgetDrag();
      }}
      ondragstart={(event) => beginDrag(event, node)}
      onkeydown={(event) => handleNodeKeydown(event, node, path, direction)}
      role={props.customizeOpen && !isBaseContainer ? "group" : "presentation"}
    >
      {#if props.customizeOpen && !isBaseContainer}
        <div
          aria-label={`Edit ${nodeLabel(node)}`}
          class="fennevia-layout-node__controls"
          data-fennevia-layout-node-controls=""
          role="group"
        >
          <button
            aria-label="Move before"
            disabled={index === 0}
            onclick={() => moveSibling(node, path, -1)}
            type="button">←</button
          >
          <button
            aria-label="Move after"
            disabled={!parent || index >= parent.children.length - 1}
            onclick={() => moveSibling(node, path, 1)}
            type="button">→</button
          >
          <button
            aria-label="Move into previous layout group"
            disabled={!previous || !canAcceptChild(previous)}
            onclick={() => moveIntoPrevious(node, path)}
            type="button">↳</button
          >
          <button
            aria-label="Move out of container"
            disabled={!canMoveOut(path)}
            onclick={() => moveOut(node, path)}
            type="button">↰</button
          >
          {#if node.type === "container"}
            <button
              aria-label={node.direction === "row"
                ? "Change Row to Column"
                : "Change Column to Row"}
              onclick={() => toggleDirection(node, path)}
              type="button">{node.direction === "row" ? "↕" : "↔"}</button
            >
          {/if}
          <button
            aria-label="Remove"
            onclick={() => removeNode(node, path)}
            type="button">×</button
          >
        </div>
      {/if}

      {#if props.customizeOpen && !isBaseContainer && (node.type !== "item" || structuralItem)}
        <span
          aria-hidden="true"
          class="fennevia-layout-node__structure-label"
          data-fennevia-layout-structure-label="">{nodeLabel(node)}</span
        >
      {/if}

      {#if node.type === "container"}
        <div
          aria-label={props.customizeOpen
            ? node.direction === "row"
              ? "Row drop area"
              : "Column drop area"
            : undefined}
          class="fennevia-layout-container"
          class:fennevia-layout-container--column={node.direction === "column"}
          class:fennevia-layout-container--row={node.direction === "row"}
          data-fennevia-layout-container={node.direction}
          data-fennevia-layout-base={isBaseContainer
            ? node.direction
            : undefined}
          data-fennevia-layout-drop={dropPreview?.parentKey === pathKey(path)
            ? String(dropPreview.index)
            : undefined}
          data-fennevia-window-drag-region=""
          ondragover={(event) => handleDragOver(event, path, node.direction)}
          ondrop={(event) => handleDrop(event, path, node.direction)}
          role={props.customizeOpen ? "group" : "presentation"}
        >
          {#if props.customizeOpen && node.children.length === 0}
            <span class="fennevia-layout-container__placeholder"
              >{translate(props.localeId, "customize.emptyPanelDrop")}</span
            >
          {/if}
          {@render renderNodes(node.children, path, node.direction)}
        </div>
      {:else if node.type === "wrapper"}
        <div
          aria-label={props.customizeOpen
            ? `${nodeLabel(node)} drop area`
            : undefined}
          class="fennevia-layout-wrapper"
          class:fennevia-layout-wrapper--center={node.kind === "center"}
          class:fennevia-layout-wrapper--column={direction === "column"}
          class:fennevia-layout-wrapper--expanded={node.kind === "expanded"}
          class:fennevia-layout-wrapper--padding={node.kind === "padding"}
          class:fennevia-layout-wrapper--row={direction === "row"}
          data-fennevia-layout-drop={dropPreview?.parentKey === pathKey(path)
            ? String(dropPreview.index)
            : undefined}
          data-fennevia-layout-wrapper={node.kind}
          data-fennevia-window-drag-region=""
          ondragover={node.children.length === 0
            ? (event) => handleDragOver(event, path, direction)
            : undefined}
          ondrop={node.children.length === 0
            ? (event) => handleDrop(event, path, direction)
            : undefined}
          role={props.customizeOpen ? "group" : "presentation"}
        >
          {#if props.customizeOpen && node.children.length === 0}
            <span class="fennevia-layout-container__placeholder"
              >{translate(props.localeId, "customize.emptyPanelDrop")}</span
            >
          {/if}
          {@render renderNodes(node.children, path, direction)}
        </div>
      {:else}
        <div
          class="fennevia-layout-node__content"
          data-fennevia-layout-node-content=""
          inert={props.customizeOpen}
        >
          {#if node.projectId}
            <ProjectWidget
              addressPopup={props.addressPopup}
              bookmarks={props.bookmarks}
              browserTools={props.browserTools}
              canEdit={props.state?.snapshot.canEdit ?? false}
              customizeOpen={props.customizeOpen}
              {direction}
              downloads={props.downloads}
              edge={props.edge}
              id={node.projectId}
              localeId={props.localeId}
              navigation={props.navigation}
              onDismiss={props.onDismiss}
              onFatalError={props.onFatalError}
              onOpenAddress={props.onOpenAddress}
              onRevealProject={props.onRevealProject}
              onSetCustomizeOpen={props.onSetCustomizeOpen}
              shell={props.shell}
              tabs={props.tabs}
              windowControls={props.windowControls}
              windowKind={props.windowKind}
            />
          {:else}
            <FirefoxToolbarWidget
              customizeOpen={props.customizeOpen}
              edge={props.edge}
              localeId={props.localeId}
              shell={props.shell}
              toolbarWidgets={props.toolbarWidgets}
              widget={node.widget}
            />
          {/if}
        </div>
      {/if}
    </div>
  {/each}
{/snippet}

<div
  bind:this={root}
  aria-label={props.customizeOpen ? `${props.edge} panel layout` : undefined}
  class="fennevia-composable-layout"
  class:fennevia-composable-layout--column={rootDirection === "column"}
  class:fennevia-composable-layout--row={rootDirection === "row"}
  data-fennevia-composable-layout={props.edge}
  data-fennevia-focus-fallback=""
  data-fennevia-layout-drop={dropPreview?.parentKey === "root"
    ? String(dropPreview.index)
    : undefined}
  data-fennevia-window-drag-region=""
  ondragleave={handleDragLeave}
  ondragover={(event) =>
    handleDragOver(event, rootDropParentPath, rootDirection)}
  ondrop={(event) => handleDrop(event, rootDropParentPath, rootDirection)}
  role={props.customizeOpen ? "group" : "presentation"}
  tabindex="-1"
>
  {#if props.customizeOpen && nodes.length === 0}
    <button
      class="fennevia-layout-container__placeholder fennevia-layout-container__placeholder--root"
      data-fennevia-empty-panel-drop-target=""
      onclick={selectEmptyPanel}
      onfocus={selectEmptyPanel}
      type="button"
      >{translate(props.localeId, "customize.emptyPanelDrop")}</button
    >
  {/if}
  {@render renderNodes(nodes, [], rootDirection)}
  <output aria-live="polite" class="fennevia-layout-announcement"
    >{announcement}</output
  >
</div>
