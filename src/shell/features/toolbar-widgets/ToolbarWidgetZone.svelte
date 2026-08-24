<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import { onDestroy } from "svelte";

  import {
    isPopupBrowserToolAction,
    type BrowserToolAction,
    type BrowserToolsStateAdapter,
  } from "../../../app/browser-tools-state";
  import type { CustomizeSessionController } from "../../../app/customize-session";
  import type {
    EdgeName,
    EdgeShellController,
  } from "../../../app/edge-surfaces";
  import {
    translate,
    type MessageKey,
    type MessageVars,
  } from "../../../app/i18n";
  import type { FenneviaLocale } from "../../../app/locale-state";
  import {
    clearToolbarWidgetDrag,
    createToolbarWidgetDropEdit,
    getActiveToolbarWidgetDrag,
    resolveWidgetInsertBefore,
    serializeToolbarWidgetDrag,
    startToolbarWidgetDrag,
    toolbarWidgetDragMimeType,
    type ToolbarWidgetDropTarget,
  } from "../../../app/toolbar-widget-drag";
  import {
    createDefaultShellPanelConfig,
    getSidePanelEdge,
    isInteractiveToolbarWidget,
    type BrowserToolbarWidgetsState,
    type BrowserToolbarWidgetsStateAdapter,
    type ToolbarWidgetPartSnapshot,
    type ToolbarWidgetSnapshot,
    type ToolbarWidgetsEditOperation,
    type ToolbarZoneName,
  } from "../../../app/toolbar-widgets-state";
  import {
    localizeWidgetLabel,
    localizeWidgetTooltip,
    zoneDisplayName,
  } from "../../locale-ui";
  import { resolveBrowserToolHost } from "../../browser-tool-host";
  import ToolbarWidgetGlyph from "../../ToolbarWidgetGlyph.svelte";

  type Props = Readonly<{
    browserTools?: BrowserToolsStateAdapter;
    customizeOpen: boolean;
    customizeSession?: CustomizeSessionController;
    edge: EdgeName;
    localeId: FenneviaLocale;
    onDismiss: (edge: EdgeName) => void;
    onFatalError: (error: unknown) => void;
    shell: EdgeShellController;
    state: BrowserToolbarWidgetsState | null;
    toolbarWidgets?: BrowserToolbarWidgetsStateAdapter;
  }>;

  const props: Props = $props();
  const t = (key: MessageKey, vars?: MessageVars): string =>
    translate(props.localeId, key, vars);
  const reportAsyncError = (work: Promise<unknown>): void => {
    void work.catch(props.onFatalError);
  };
  let browserToolsSnapshot = $derived(props.browserTools?.snapshot());
  let bookmarksEdge = $derived(
    getSidePanelEdge(
      props.state?.snapshot.panels ?? createDefaultShellPanelConfig(),
      "bookmarks",
    ),
  );
  let dropPreview: Readonly<{
    insertBefore: number;
    zone: ToolbarZoneName;
  }> | null = $state(null);

  let zoneWidgets = $derived(
    props.customizeOpen
      ? (props.state?.snapshot.zones[props.edge] ?? [])
      : (props.state?.snapshot.zones[props.edge] ?? []).filter(
          (widget) => !widget.missing,
        ),
  );

  const runBrowserToolAction = async (
    action: BrowserToolAction,
    event?: MouseEvent,
  ) => {
    const host = isPopupBrowserToolAction(action)
      ? resolveBrowserToolHost(event)
      : undefined;
    try {
      const browserTools = props.browserTools;
      if (!browserTools) {
        throw new Error("FENNEVIA_BROWSER_TOOLS_UNAVAILABLE");
      }
      if (isPopupBrowserToolAction(action)) {
        props.shell.setPopupHeld(props.edge, true);
        await browserTools.invoke(action, host, event);
        return;
      }
      props.onDismiss(props.edge);
      await browserTools.invoke(action);
    } catch (error) {
      if (isPopupBrowserToolAction(action)) {
        props.shell.setPopupHeld(props.edge, false);
        if (!props.browserTools) {
          props.onFatalError(error);
        }
        return;
      }
      props.onFatalError(error);
    }
  };

  const runFenneviaWidgetAction = (action: string, event?: MouseEvent) => {
    try {
      if (action === "show-bookmarks") {
        props.shell.revealProgrammatically(bookmarksEdge);
        return;
      }
      if (action === "show-downloads") {
        reportAsyncError(runBrowserToolAction("downloads", event));
        return;
      }
      if (action === "show-translate") {
        reportAsyncError(runBrowserToolAction("translate", event));
      }
    } catch (error) {
      props.onFatalError(error);
    }
  };

  const runToolbarWidgetAction = async (
    widget: ToolbarWidgetSnapshot,
    event: MouseEvent,
  ) => {
    if (props.customizeSession?.isOpen()) {
      return;
    }
    if (widget.fenneviaAction !== "") {
      runFenneviaWidgetAction(widget.fenneviaAction, event);
      return;
    }
    if (!props.toolbarWidgets || !isInteractiveToolbarWidget(widget)) {
      return;
    }
    await invokeToolbarWidgetHandle(widget.handle, event);
  };

  const invokeToolbarWidgetHandle = async (
    handle: string,
    event: MouseEvent,
  ) => {
    const toolbarWidgets = props.toolbarWidgets;
    if (!toolbarWidgets) {
      return;
    }
    props.shell.setPopupHeld(props.edge, true);
    try {
      const opened = await toolbarWidgets.invoke(
        handle,
        resolveBrowserToolHost(event),
        event,
      );
      if (!opened) {
        props.shell.setPopupHeld(props.edge, false);
      }
    } catch {
      // Widget placement is optional. Native customization and Unified
      // Extensions remain available when an invocation goes stale.
      props.shell.setPopupHeld(props.edge, false);
    }
  };

  const runToolbarWidgetPartAction = async (
    part: ToolbarWidgetPartSnapshot,
    event: MouseEvent,
  ) => {
    if (
      props.customizeSession?.isOpen() ||
      !props.toolbarWidgets ||
      part.disabled
    ) {
      return;
    }
    await invokeToolbarWidgetHandle(part.handle, event);
  };

  const widgetDisplayLabel = (widget: ToolbarWidgetSnapshot): string =>
    localizeWidgetLabel(props.localeId, widget);

  const toolbarWidgetPartTooltip = (part: ToolbarWidgetPartSnapshot): string =>
    localizeWidgetTooltip(props.localeId, part.tooltip, part.label);

  const toolbarWidgetPartAccessibleLabel = (
    part: ToolbarWidgetPartSnapshot,
  ): string => {
    const tooltip = toolbarWidgetPartTooltip(part);
    return part.valueText === "" || tooltip === part.valueText
      ? part.label
      : `${part.valueText}, ${tooltip}`;
  };

  const runToolbarWidgetEdit = async (
    operation: ToolbarWidgetsEditOperation,
  ) => {
    try {
      await props.toolbarWidgets?.edit(operation);
    } catch {
      // Editing is optional; stale revisions must not fail the shell.
    }
  };

  const collectWidgetInsertBefore = (event: DragEvent): number | null => {
    const list = event.currentTarget;
    if (!(list instanceof HTMLElement)) {
      return null;
    }
    const items = Array.from(
      list.querySelectorAll<HTMLElement>("[data-fennevia-toolbar-widget-item]"),
    );
    const mids = items.map((item) => {
      const bounds = item.getBoundingClientRect();
      return bounds.left + bounds.width / 2;
    });
    return resolveWidgetInsertBefore(mids, event.clientX);
  };

  const applyWidgetDrop = (target: ToolbarWidgetDropTarget) => {
    const source = getActiveToolbarWidgetDrag();
    const revision = props.state?.revision ?? 0;
    const operation = source
      ? createToolbarWidgetDropEdit(source, target, revision)
      : null;
    dropPreview = null;
    clearToolbarWidgetDrag();
    if (operation) {
      reportAsyncError(runToolbarWidgetEdit(operation));
    }
  };

  const handleWidgetZoneDragOver = (event: DragEvent) => {
    if (!props.customizeOpen || !getActiveToolbarWidgetDrag()) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    const insertBefore = collectWidgetInsertBefore(event);
    if (insertBefore === null) {
      return;
    }
    dropPreview = { insertBefore, zone: props.edge };
    props.customizeSession?.setLastFocusedZone(props.edge);
  };

  const handleWidgetZoneDrop = (event: DragEvent) => {
    if (!props.customizeOpen) {
      return;
    }
    event.preventDefault();
    const insertBefore = collectWidgetInsertBefore(event) ?? 0;
    applyWidgetDrop({
      insertBefore,
      type: "zone",
      zone: props.edge,
    });
  };

  const handleWidgetZoneDragLeave = (event: DragEvent) => {
    const current = event.currentTarget;
    const related = event.relatedTarget;
    if (
      current instanceof Node &&
      related instanceof Node &&
      current.contains(related)
    ) {
      return;
    }
    if (dropPreview?.zone === props.edge) {
      dropPreview = null;
    }
  };

  const handleWidgetDragStart = (event: DragEvent, index: number) => {
    if (!props.customizeOpen) {
      event.preventDefault();
      return;
    }
    const transfer = event.dataTransfer;
    if (!transfer) {
      return;
    }
    const source = startToolbarWidgetDrag({
      index,
      type: "zone",
      zone: props.edge,
    });
    transfer.effectAllowed = "move";
    transfer.setData(
      toolbarWidgetDragMimeType,
      serializeToolbarWidgetDrag(source),
    );
    transfer.setData("text/plain", source.type);
    props.customizeSession?.setLastFocusedZone(props.edge);
  };

  const handleWidgetDragEnd = () => {
    dropPreview = null;
    clearToolbarWidgetDrag();
  };

  const handleWidgetItemKeydown = (event: KeyboardEvent, index: number) => {
    if (!props.customizeOpen) {
      return;
    }
    const revision = props.state?.revision ?? 0;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      reportAsyncError(
        runToolbarWidgetEdit({
          index,
          revision,
          type: "remove",
          zone: props.edge,
        }),
      );
      return;
    }
    const earlier = event.key === "ArrowLeft";
    const later = event.key === "ArrowRight";
    if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
      return;
    }
    if (!earlier && !later) {
      return;
    }
    const toIndex = earlier ? index - 1 : index + 1;
    if (toIndex < 0 || toIndex >= zoneWidgets.length) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    reportAsyncError(
      runToolbarWidgetEdit({
        fromIndex: index,
        fromZone: props.edge,
        revision,
        toIndex,
        toZone: props.edge,
        type: "move",
      }),
    );
  };

  onDestroy(() => {
    dropPreview = null;
    clearToolbarWidgetDrag();
  });
</script>

{#if props.state?.snapshot.available && (props.customizeOpen || zoneWidgets.length > 0)}
  <div
    aria-label={props.customizeOpen
      ? t("widget.droppableAria", {
          zone: zoneDisplayName(props.localeId, props.edge),
        })
      : t("widget.toolbarShortcuts")}
    class="fennevia-toolbar-widgets"
    class:fennevia-toolbar-widgets--compact={props.edge !== "top"}
    class:fennevia-toolbar-widgets--editing={props.customizeOpen}
    data-fennevia-customize-insert={props.customizeOpen &&
    dropPreview?.zone === props.edge
      ? String(dropPreview.insertBefore)
      : undefined}
    data-fennevia-drop-end={props.customizeOpen &&
    dropPreview?.zone === props.edge &&
    zoneWidgets.length > 0 &&
    dropPreview.insertBefore === zoneWidgets.length
      ? ""
      : undefined}
    data-fennevia-toolbar-widgets={props.edge}
    ondragleave={handleWidgetZoneDragLeave}
    ondragover={handleWidgetZoneDragOver}
    ondrop={handleWidgetZoneDrop}
    onfocusin={() => props.customizeSession?.setLastFocusedZone(props.edge)}
    role="group"
  >
    {#if props.customizeOpen && zoneWidgets.length === 0}
      <span class="fennevia-toolbar-widgets__placeholder"
        >{t("widget.dropHere")}</span
      >
    {/if}
    {#each zoneWidgets as widget, index (`${props.edge}-${index}-${widget.handle}-${widget.fenneviaAction}`)}
      {#if widget.kind === "separator" || widget.kind === "spacer" || widget.kind === "spring"}
        {#if props.customizeOpen}
          <button
            aria-label={widgetDisplayLabel(widget)}
            class={`fennevia-toolbar-widgets__item fennevia-toolbar-widgets__${widget.kind}`}
            data-fennevia-drop-before={dropPreview?.zone === props.edge &&
            dropPreview.insertBefore === index
              ? ""
              : undefined}
            data-fennevia-toolbar-widget-item=""
            draggable="true"
            ondragend={handleWidgetDragEnd}
            ondragstart={(event) => handleWidgetDragStart(event, index)}
            onkeydown={(event) => handleWidgetItemKeydown(event, index)}
            type="button"
          ></button>
        {:else}
          <span
            aria-hidden="true"
            class={`fennevia-toolbar-widgets__item fennevia-toolbar-widgets__${widget.kind}`}
          ></span>
        {/if}
      {:else if widget.parts.length > 0 && !props.customizeOpen}
        <div
          aria-label={widgetDisplayLabel(widget)}
          class="fennevia-toolbar-widgets__compound fennevia-toolbar-widgets__item"
          data-fennevia-toolbar-widget-item=""
          role="group"
        >
          {#each widget.parts as part (part.handle)}
            <button
              aria-label={toolbarWidgetPartAccessibleLabel(part)}
              class="fennevia-control fennevia-toolbar-widgets__button fennevia-toolbar-widgets__compound-button"
              data-fennevia-browser-tool="toolbar-widget-part"
              disabled={part.disabled}
              onclick={(event) =>
                reportAsyncError(runToolbarWidgetPartAction(part, event))}
              title={toolbarWidgetPartTooltip(part)}
              type="button"
            >
              {#if part.valueText}
                <span
                  aria-hidden="true"
                  class="fennevia-toolbar-widgets__compound-value"
                  >{part.valueText}</span
                >
              {:else}
                <ToolbarWidgetGlyph widget={part} />
              {/if}
            </button>
          {/each}
        </div>
      {:else}
        <button
          aria-label={widgetDisplayLabel(widget)}
          class="fennevia-control fennevia-toolbar-widgets__button fennevia-toolbar-widgets__item"
          data-fennevia-browser-tool="toolbar-widget"
          data-fennevia-drop-before={props.customizeOpen &&
          dropPreview?.zone === props.edge &&
          dropPreview.insertBefore === index
            ? ""
            : undefined}
          data-fennevia-toolbar-widget-item=""
          data-fennevia-toolbar-widget-kind={widget.kind}
          disabled={!props.customizeOpen &&
            (widget.disabled ||
              (widget.fenneviaAction === "show-downloads" &&
                !browserToolsSnapshot?.downloads) ||
              (widget.fenneviaAction === "show-translate" &&
                !browserToolsSnapshot?.translate))}
          draggable={props.customizeOpen}
          ondragend={handleWidgetDragEnd}
          ondragstart={(event) => handleWidgetDragStart(event, index)}
          onkeydown={(event) => handleWidgetItemKeydown(event, index)}
          onclick={(event) =>
            reportAsyncError(runToolbarWidgetAction(widget, event))}
          title={localizeWidgetTooltip(
            props.localeId,
            widget.tooltip,
            widgetDisplayLabel(widget),
          )}
          type="button"
        >
          <ToolbarWidgetGlyph {widget} />
          {#if widget.badgeText}
            <span
              aria-hidden="true"
              class="fennevia-toolbar-widgets__badge"
              style:background-color={widget.badgeBackground || undefined}
              style:color={widget.badgeTextColor || undefined}
              >{widget.badgeText}</span
            >
          {/if}
        </button>
      {/if}
    {/each}
  </div>
{/if}
