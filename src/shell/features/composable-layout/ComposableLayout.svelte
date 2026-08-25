<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import { onDestroy, tick } from "svelte";

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
    resolveToolbarWidgetDragAutoScrollDelta,
    resolveToolbarWidgetDragImageOffset,
    resolveToolbarWidgetDragPreviewSize,
    resolveWidgetInsertBefore,
    serializeToolbarWidgetDrag,
    startToolbarWidgetDrag,
    subscribeToolbarWidgetDrag,
    toolbarWidgetDragMimeType,
    type ToolbarWidgetDragSource,
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
  import LayoutDragPreview from "./LayoutDragPreview.svelte";
  import ProjectWidget from "./ProjectWidget.svelte";
  import { resolveLayoutDragPreview } from "./layout-drag-preview";
  import { localizeLayoutNodeLabel, zoneDisplayName } from "../../locale-ui";

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
    selectedInstanceId: string | null;
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

  type DropGeometry = Readonly<{
    direction: ToolbarLayoutDirection;
    itemMids: readonly number[];
    parentKey: string;
    scrollPosition: number;
  }>;

  const props: Props = $props();
  let root: HTMLDivElement | undefined = $state();
  let activeDrag: ToolbarWidgetDragSource | null = $state(null);
  let dropPreview: DropPreview | null = $state(null);
  let announcement = $state("");
  let dropGeometry: DropGeometry | null = null;
  let autoScrollFrame: number | null = null;
  let autoScrollInline = 0;
  let autoScrollBlock = 0;
  let rootDirection = $derived(defaultToolbarLayoutDirection(props.edge));
  let nodes = $derived(props.state?.snapshot.layout[props.edge] ?? []);
  let revision = $derived(props.state?.revision ?? 0);
  let dragDescriptor = $derived(
    resolveLayoutDragPreview(
      activeDrag,
      props.state?.snapshot ?? null,
      props.localeId,
    ),
  );
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

  const pathKey = (path: readonly number[]): string =>
    path.length === 0 ? "root" : path.join(".");

  const stopAutoScroll = (): void => {
    const view = root?.ownerDocument.defaultView;
    if (autoScrollFrame !== null && view) {
      view.cancelAnimationFrame(autoScrollFrame);
    }
    autoScrollFrame = null;
    autoScrollInline = 0;
    autoScrollBlock = 0;
  };

  const clearDropFeedback = (): void => {
    dropPreview = null;
    dropGeometry = null;
    stopAutoScroll();
  };

  $effect(() =>
    subscribeToolbarWidgetDrag((source) => {
      activeDrag = source;
      clearDropFeedback();
    }),
  );

  $effect(() => {
    if (!props.customizeOpen) {
      clearDropFeedback();
    }
  });

  onDestroy(() => {
    clearDropFeedback();
  });

  const focusEditableNode = (element: HTMLElement | null | undefined): void => {
    const selector = element?.querySelector<HTMLElement>(
      ":scope > [data-fennevia-layout-keyboard-selector]",
    );
    const target =
      selector ??
      (element?.matches("[data-fennevia-composable-layout]") ? element : root);
    target?.focus({ preventScroll: true });
  };

  const runEdit = async (
    operation: ToolbarWidgetsEditOperation,
    focusInstanceId?: string,
    fallbackPath?: readonly number[],
    successMessage = "",
  ): Promise<boolean> => {
    announcement = "";
    try {
      await props.toolbarWidgets?.edit(operation);
      await tick();
      const focusTarget = focusInstanceId
        ? root?.querySelector<HTMLElement>(
            `[data-fennevia-layout-instance="${focusInstanceId}"]`,
          )
        : null;
      const fallback = fallbackPath
        ? root?.querySelector<HTMLElement>(
            `[data-fennevia-layout-path="${pathKey(fallbackPath)}"]`,
          )
        : root;
      focusEditableNode(focusTarget ?? fallback);
      announcement = successMessage;
      return true;
    } catch {
      announcement = translate(props.localeId, "customize.editFailed");
      return false;
    }
  };

  const nodeLabel = (node: ToolbarLayoutNodeSnapshot): string =>
    localizeLayoutNodeLabel(props.localeId, node);

  const selectNode = (node: ToolbarLayoutNodeSnapshot): void => {
    if (!props.customizeOpen || props.selectedInstanceId === node.instanceId) {
      return;
    }
    props.customizeSession?.setSelectedInstance(node.instanceId);
    props.customizeSession?.setLastFocusedZone(props.edge);
    announcement = translate(props.localeId, "customize.nodeSelected", {
      label: nodeLabel(node),
    });
  };

  const clearSelection = (): void => {
    if (!props.selectedInstanceId) {
      return;
    }
    if (props.customizeSession?.clearSelectedInstance()) {
      announcement = translate(
        props.localeId,
        "customize.nodeSelectionCleared",
      );
    }
  };

  const focusInspector = (node: ToolbarLayoutNodeSnapshot): void => {
    selectNode(node);
    void tick()
      .then(() => {
        root?.ownerDocument
          .getElementById(`fennevia-widget-inspector-${node.instanceId}`)
          ?.querySelector<HTMLElement>(
            "[data-fennevia-widget-config-action]:not(:disabled)",
          )
          ?.focus({ preventScroll: true });
      })
      .catch(props.onFatalError);
  };

  const isStructuralItem = (node: ToolbarLayoutNodeSnapshot): boolean =>
    node.type === "item" &&
    (node.widget.kind === "separator" ||
      node.widget.kind === "spacer" ||
      node.widget.kind === "spring");

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

  const beginDrag = (
    event: DragEvent,
    node: ToolbarLayoutNodeSnapshot,
    direction: ToolbarLayoutDirection,
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
    selectNode(node);
    event.stopPropagation();
    const sourceElement =
      event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    const image = sourceElement?.querySelector<HTMLElement>(
      ":scope > [data-fennevia-layout-drag-image]",
    );
    if (sourceElement && image) {
      const size = resolveToolbarWidgetDragPreviewSize(
        isStructuralItem(node)
          ? "space"
          : node.type === "item"
            ? "control"
            : "layout",
        direction,
      );
      const sourceBounds = sourceElement.getBoundingClientRect();
      const offset = resolveToolbarWidgetDragImageOffset(
        event.clientX,
        event.clientY,
        sourceBounds,
        size,
      );
      event.dataTransfer.setDragImage(
        image,
        offset?.x ?? Math.round(size.inlineSize / 2),
        offset?.y ?? Math.round(size.blockSize / 2),
      );
    }
    props.customizeSession?.setLastFocusedZone(props.edge);
  };

  const insertionIndex = (
    event: DragEvent,
    parentPath: readonly number[],
    direction: ToolbarLayoutDirection,
  ): number | null => {
    const currentTarget = event.currentTarget;
    let container = currentTarget;
    if (
      currentTarget === root &&
      baseContainerInstanceId &&
      parentPath.length === 1 &&
      parentPath[0] === 0
    ) {
      container = root.querySelector<HTMLElement>(
        "[data-fennevia-layout-base]",
      );
    }
    if (!(container instanceof HTMLElement)) {
      return null;
    }
    const parentKey = pathKey(parentPath);
    const scrollPosition =
      direction === "row" ? (root?.scrollLeft ?? 0) : (root?.scrollTop ?? 0);
    if (
      !dropGeometry ||
      dropGeometry.parentKey !== parentKey ||
      dropGeometry.direction !== direction
    ) {
      const children = Array.from(container.children).filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement &&
          child.hasAttribute("data-fennevia-layout-node"),
      );
      dropGeometry = Object.freeze({
        direction,
        itemMids: Object.freeze(
          children.map((child) => {
            const bounds = child.getBoundingClientRect();
            return direction === "row"
              ? bounds.left + bounds.width / 2
              : bounds.top + bounds.height / 2;
          }),
        ),
        parentKey,
        scrollPosition,
      });
    }
    const scrollDelta = scrollPosition - dropGeometry.scrollPosition;
    const mids = dropGeometry.itemMids.map(
      (midpoint) => midpoint - scrollDelta,
    );
    return resolveWidgetInsertBefore(
      mids,
      direction === "row" ? event.clientX : event.clientY,
    );
  };

  const runAutoScroll = (): void => {
    const view = root?.ownerDocument.defaultView;
    if (!root || !view || !activeDrag) {
      stopAutoScroll();
      return;
    }
    root.scrollLeft += autoScrollInline;
    root.scrollTop += autoScrollBlock;
    if (autoScrollInline === 0 && autoScrollBlock === 0) {
      stopAutoScroll();
      return;
    }
    autoScrollFrame = view.requestAnimationFrame(runAutoScroll);
  };

  const updateAutoScroll = (event: DragEvent): void => {
    if (!root) {
      return;
    }
    const bounds = root.getBoundingClientRect();
    autoScrollInline = resolveToolbarWidgetDragAutoScrollDelta(
      event.clientX,
      bounds.left,
      bounds.right,
    );
    autoScrollBlock = resolveToolbarWidgetDragAutoScrollDelta(
      event.clientY,
      bounds.top,
      bounds.bottom,
    );
    const view = root.ownerDocument.defaultView;
    if (
      view &&
      autoScrollFrame === null &&
      (autoScrollInline !== 0 || autoScrollBlock !== 0)
    ) {
      autoScrollFrame = view.requestAnimationFrame(runAutoScroll);
    } else if (autoScrollInline === 0 && autoScrollBlock === 0) {
      stopAutoScroll();
    }
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
    updateAutoScroll(event);
    const index = insertionIndex(event, parentPath, direction);
    if (index !== null) {
      const parentKey = pathKey(parentPath);
      if (dropPreview?.index !== index || dropPreview.parentKey !== parentKey) {
        dropPreview = { index, parentKey };
        if (dragDescriptor) {
          announcement = translate(
            props.localeId,
            "customize.dragDestination",
            {
              label: dragDescriptor.label,
              position: index + 1,
              zone: zoneDisplayName(props.localeId, props.edge),
            },
          );
        }
      }
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
    const index = insertionIndex(event, parentPath, direction) ?? 0;
    const droppedLabel = dragDescriptor?.label ?? "";
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
    clearDropFeedback();
    clearToolbarWidgetDrag();
    if (operation) {
      void runEdit(
        operation,
        source?.type === "layout-node" ? source.instanceId : undefined,
        undefined,
        droppedLabel
          ? translate(props.localeId, "customize.dragCompleted", {
              label: droppedLabel,
              zone: zoneDisplayName(props.localeId, props.edge),
            })
          : "",
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
    clearDropFeedback();
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
    if (event.key === "Escape" && props.selectedInstanceId) {
      event.preventDefault();
      event.stopPropagation();
      clearSelection();
      return;
    }
    if (
      event.key === "Enter" &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey
    ) {
      event.preventDefault();
      event.stopPropagation();
      focusInspector(node);
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

{#snippet renderDropSlot(
  parentKey: string,
  index: number,
  direction: ToolbarLayoutDirection,
)}
  {#if dropPreview?.parentKey === parentKey && dropPreview.index === index && dragDescriptor}
    <LayoutDragPreview descriptor={dragDescriptor} {direction} />
  {/if}
{/snippet}

{#snippet renderNodes(
  children: readonly ToolbarLayoutNodeSnapshot[],
  parentPath: readonly number[],
  direction: ToolbarLayoutDirection,
)}
  {#each children as node, index (node.instanceId)}
    {@render renderDropSlot(pathKey(parentPath), index, direction)}
    {@const path = [...parentPath, index]}
    {@const isBaseContainer = node.instanceId === baseContainerInstanceId}
    {@const structuralItem = isStructuralItem(node)}
    {@const dragPreviewKind = structuralItem
      ? "space"
      : node.type === "item"
        ? "control"
        : "layout"}
    {@const dragPreviewSize = resolveToolbarWidgetDragPreviewSize(
      dragPreviewKind,
      direction,
    )}
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
      data-fennevia-layout-selected={props.selectedInstanceId ===
      node.instanceId
        ? true
        : undefined}
      data-fennevia-layout-source={activeDrag?.type === "layout-node" &&
      activeDrag.instanceId === node.instanceId
        ? true
        : undefined}
      data-fennevia-layout-special-kind={structuralItem && node.type === "item"
        ? node.widget.kind
        : undefined}
      data-fennevia-layout-path={pathKey(path)}
      draggable={props.customizeOpen && !isBaseContainer}
      ondragend={() => {
        clearDropFeedback();
        clearToolbarWidgetDrag();
      }}
      ondragstart={(event) => beginDrag(event, node, direction)}
      onkeydown={(event) => handleNodeKeydown(event, node, path, direction)}
      onpointerdown={(event) => {
        if (event.button === 0) {
          event.stopPropagation();
          selectNode(node);
          event.currentTarget
            .querySelector<HTMLButtonElement>(
              ":scope > [data-fennevia-layout-keyboard-selector]",
            )
            ?.focus({ preventScroll: true });
        }
      }}
      role={props.customizeOpen && !isBaseContainer ? "group" : "presentation"}
      tabindex="-1"
    >
      {#if props.customizeOpen && !isBaseContainer}
        <button
          aria-controls={props.selectedInstanceId === node.instanceId
            ? `fennevia-widget-inspector-${node.instanceId}`
            : undefined}
          aria-expanded={props.selectedInstanceId === node.instanceId}
          aria-label={translate(props.localeId, "customize.editNodeWithHint", {
            label: nodeLabel(node),
          })}
          class="fennevia-layout-node__keyboard-selector"
          data-fennevia-layout-keyboard-selector=""
          onclick={() => focusInspector(node)}
          onfocus={() => selectNode(node)}
          type="button"
        ></button>
      {/if}

      {#if props.customizeOpen && !isBaseContainer}
        <div
          aria-hidden="true"
          class="fennevia-layout-drag-image"
          data-fennevia-layout-drag-image={dragPreviewKind}
          lang={props.localeId}
          style:--fennevia-drag-preview-block={`${dragPreviewSize.blockSize}px`}
          style:--fennevia-drag-preview-inline={`${dragPreviewSize.inlineSize}px`}
        >
          <span class="fennevia-layout-drag-image__icon">
            {dragPreviewKind === "space" ? "·" : "⋮⋮"}
          </span>
          <span class="fennevia-layout-drag-image__label"
            >{nodeLabel(node)}</span
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
              ? translate(props.localeId, "customize.rowDropArea")
              : translate(props.localeId, "customize.columnDropArea")
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
          {#if props.customizeOpen && node.children.length === 0 && dropPreview?.parentKey !== pathKey(path)}
            <span class="fennevia-layout-container__placeholder"
              >{translate(props.localeId, "customize.emptyPanelDrop")}</span
            >
          {/if}
          {@render renderNodes(node.children, path, node.direction)}
        </div>
      {:else if node.type === "wrapper"}
        <div
          aria-label={props.customizeOpen
            ? translate(props.localeId, "customize.wrapperDropArea", {
                label: nodeLabel(node),
              })
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
          {#if props.customizeOpen && node.children.length === 0 && dropPreview?.parentKey !== pathKey(path)}
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
              widgetStyle={node.style}
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
  {@render renderDropSlot(pathKey(parentPath), children.length, direction)}
{/snippet}

<div
  bind:this={root}
  aria-label={props.customizeOpen
    ? translate(props.localeId, "customize.panelLayoutAria", {
        zone: zoneDisplayName(props.localeId, props.edge),
      })
    : undefined}
  class="fennevia-composable-layout"
  class:fennevia-composable-layout--column={rootDirection === "column"}
  class:fennevia-composable-layout--row={rootDirection === "row"}
  data-fennevia-composable-layout={props.edge}
  data-fennevia-layout-drag-active={activeDrag ? true : undefined}
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
  {#if props.customizeOpen && nodes.length === 0 && dropPreview?.parentKey !== "root"}
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
