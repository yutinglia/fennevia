<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import { tick } from "svelte";

  import type { CustomizeSessionController } from "../../../app/customize-session";
  import { translate } from "../../../app/i18n";
  import type { FenneviaLocale } from "../../../app/locale-state";
  import {
    defaultToolbarLayoutDirection,
    findToolbarLayoutInstance,
    projectWidgetStyleOptions,
    toolbarLayoutNodeAt,
    toolbarLayoutParent,
    type BrowserToolbarWidgetsState,
    type BrowserToolbarWidgetsStateAdapter,
    type ProjectWidgetStyleId,
    type ToolbarLayoutNodeSnapshot,
    type ToolbarWidgetsEditOperation,
  } from "../../../app/toolbar-widgets-state";
  import {
    localizeLayoutNodeLabel,
    localizeProjectWidgetStyle,
  } from "../../locale-ui";
  import { resolveWidgetInspectorPosition } from "./widget-inspector-position";

  type Props = Readonly<{
    anchorRoot: HTMLElement;
    container: HTMLElement;
    customizeSession: CustomizeSessionController;
    localeId: FenneviaLocale;
    onFatalError: (error: unknown) => void;
    selectedInstanceId: string;
    state: BrowserToolbarWidgetsState;
    toolbarWidgets: BrowserToolbarWidgetsStateAdapter;
  }>;

  const props: Props = $props();
  let inspectorElement: HTMLElement | undefined = $state();
  let announcement = $state("");
  let position =
    $state<ReturnType<typeof resolveWidgetInspectorPosition>>(null);
  let location = $derived(
    findToolbarLayoutInstance(
      props.state.snapshot.layout,
      props.selectedInstanceId,
    ),
  );
  let node = $derived(
    location
      ? toolbarLayoutNodeAt(props.state.snapshot.layout, location)
      : null,
  );
  let parent = $derived(
    location
      ? toolbarLayoutParent(props.state.snapshot.layout, location)
      : null,
  );
  let index = $derived(location?.path.at(-1) ?? -1);
  let previous = $derived(parent?.children[index - 1] ?? null);
  let styleOptions = $derived(
    node?.type === "item" && node.projectId !== ""
      ? projectWidgetStyleOptions(node.projectId)
      : [],
  );
  let baseContainerInstanceId = $derived.by(() => {
    if (!location) {
      return null;
    }
    const rootNodes = props.state.snapshot.layout[location.zone];
    const rootDirection = defaultToolbarLayoutDirection(location.zone);
    return rootNodes.length === 1 &&
      rootNodes[0]?.type === "container" &&
      rootNodes[0].direction === rootDirection
      ? rootNodes[0].instanceId
      : null;
  });
  let canMoveOut = $derived(
    Boolean(
      location &&
      location.path.length >= 2 &&
      !(
        location.path.length === 2 &&
        props.state.snapshot.layout[location.zone][0]?.instanceId ===
          baseContainerInstanceId
      ),
    ),
  );

  const pathKey = (path: readonly number[]): string =>
    path.length === 0 ? "root" : path.join(".");

  const canAcceptChild = (candidate: ToolbarLayoutNodeSnapshot): boolean =>
    candidate.type === "container" ||
    (candidate.type === "wrapper" && candidate.children.length === 0);

  const anchorElement = (): HTMLElement | null =>
    props.anchorRoot.querySelector<HTMLElement>(
      `[data-fennevia-layout-instance="${props.selectedInstanceId}"]`,
    );

  const customizePanelElement = (): HTMLElement | null =>
    props.anchorRoot.querySelector<HTMLElement>(".fennevia-customize");

  const focusTargetForNode = (
    element: HTMLElement | null | undefined,
    fallback: HTMLElement | null | undefined = null,
  ): HTMLElement | null =>
    element?.querySelector<HTMLElement>(
      ":scope > [data-fennevia-layout-keyboard-selector]",
    ) ??
    (element?.matches("[data-fennevia-composable-layout]") ? element : null) ??
    fallback;

  const updatePosition = (): void => {
    const anchor = anchorElement();
    const inspector = inspectorElement;
    const view = props.container.ownerDocument.defaultView;
    if (!anchor || !inspector || !view || !location) {
      position = null;
      return;
    }
    const anchorBounds = anchor.getBoundingClientRect();
    const containerBounds = props.container.getBoundingClientRect();
    const customizeBounds = customizePanelElement()?.getBoundingClientRect();
    const nextPosition = resolveWidgetInspectorPosition(
      location.zone,
      anchorBounds,
      containerBounds,
      {
        bottom: view.innerHeight,
        left: 0,
        right: view.innerWidth,
        top: 0,
      },
      { height: inspector.offsetHeight, width: inspector.offsetWidth },
      8,
      8,
      customizeBounds ? [customizeBounds] : [],
    );
    if (
      position?.left === nextPosition?.left &&
      position?.top === nextPosition?.top &&
      position?.placement === nextPosition?.placement
    ) {
      return;
    }
    position = nextPosition;
  };

  $effect(() => {
    void props.state.revision;
    void props.selectedInstanceId;
    const anchorRoot = props.anchorRoot;
    const container = props.container;
    const inspector = inspectorElement;
    const anchor = anchorElement();
    const customizePanel = customizePanelElement();
    const view = container.ownerDocument.defaultView;
    if (!inspector || !anchor || !view) {
      position = null;
      return;
    }

    let active = true;
    const reposition = (): void => {
      if (active) {
        updatePosition();
      }
    };
    void tick().then(reposition).catch(props.onFatalError);
    view.addEventListener("resize", reposition);
    anchorRoot.addEventListener("scroll", reposition, true);
    const observer = new view.ResizeObserver(reposition);
    observer.observe(anchor);
    observer.observe(inspector);
    observer.observe(container);
    if (customizePanel) {
      observer.observe(customizePanel);
    }
    return () => {
      active = false;
      view.removeEventListener("resize", reposition);
      anchorRoot.removeEventListener("scroll", reposition, true);
      observer.disconnect();
    };
  });

  const focusAnchor = (): void => {
    const anchor = anchorElement();
    const focusTarget = focusTargetForNode(anchor);
    try {
      props.customizeSession.clearSelectedInstance();
    } catch (error) {
      props.onFatalError(error);
      return;
    }
    void tick()
      .then(() => {
        if (focusTarget?.isConnected) {
          focusTarget.focus({ preventScroll: true });
        }
      })
      .catch(props.onFatalError);
  };

  const runEdit = async (
    operation: ToolbarWidgetsEditOperation,
    successMessage = "",
  ): Promise<boolean> => {
    announcement = "";
    try {
      await props.toolbarWidgets.edit(operation);
      await tick();
      updatePosition();
      announcement = successMessage;
      return true;
    } catch {
      announcement = translate(props.localeId, "customize.editFailed");
      return false;
    }
  };

  const moveSibling = (delta: -1 | 1): void => {
    if (!location || !parent || index < 0) {
      return;
    }
    if (index + delta < 0 || index + delta >= parent.children.length) {
      return;
    }
    void runEdit({
      from: location,
      revision: props.state.revision,
      to: {
        index: delta < 0 ? index - 1 : index + 2,
        parentPath: parent.parentPath,
        zone: location.zone,
      },
      type: "move-node",
    });
  };

  const moveIntoPrevious = (): void => {
    if (!location || !parent || !previous || !canAcceptChild(previous)) {
      return;
    }
    void runEdit({
      from: location,
      revision: props.state.revision,
      to: {
        index: previous.type === "item" ? 0 : previous.children.length,
        parentPath: [...parent.parentPath, index - 1],
        zone: location.zone,
      },
      type: "move-node",
    });
  };

  const moveOut = (): void => {
    if (!location || !canMoveOut) {
      return;
    }
    const parentPath = location.path.slice(0, -1);
    const parentIndex = parentPath.at(-1) as number;
    void runEdit({
      from: location,
      revision: props.state.revision,
      to: {
        index: parentIndex + 1,
        parentPath: parentPath.slice(0, -1),
        zone: location.zone,
      },
      type: "move-node",
    });
  };

  const toggleDirection = (): void => {
    if (!location || node?.type !== "container") {
      return;
    }
    void runEdit({
      direction: node.direction === "row" ? "column" : "row",
      location,
      revision: props.state.revision,
      type: "set-container-direction",
    });
  };

  const removeNode = async (): Promise<void> => {
    if (!location || !node) {
      return;
    }
    if (node.type === "item" && node.projectId === "customize-shell") {
      announcement = translate(props.localeId, "customize.required");
      return;
    }
    const anchorRoot = props.anchorRoot;
    const zone = location.zone;
    const fallbackPath = location.path.slice(0, -1);
    const removed = await runEdit({
      location,
      revision: props.state.revision,
      type: "remove-node",
    });
    if (!removed) {
      return;
    }
    try {
      props.customizeSession.clearSelectedInstance();
    } catch (error) {
      props.onFatalError(error);
      return;
    }
    await tick();
    const zoneLayout = anchorRoot.querySelector<HTMLElement>(
      `[data-fennevia-composable-layout="${zone}"]`,
    );
    const fallback =
      zoneLayout?.querySelector<HTMLElement>(
        `[data-fennevia-layout-path="${pathKey(fallbackPath)}"]`,
      ) ?? zoneLayout;
    focusTargetForNode(fallback, zoneLayout)?.focus({ preventScroll: true });
  };

  const setNodeStyle = (event: Event): void => {
    if (!location || node?.type !== "item" || node.projectId === "") {
      return;
    }
    const style =
      event.currentTarget instanceof HTMLSelectElement
        ? event.currentTarget.value
        : "";
    if (!styleOptions.includes(style as ProjectWidgetStyleId)) {
      return;
    }
    void runEdit(
      {
        location,
        revision: props.state.revision,
        style: style as ProjectWidgetStyleId,
        type: "set-node-style",
      },
      translate(props.localeId, "customize.widgetStyleChanged", {
        label: localizeLayoutNodeLabel(props.localeId, node),
        style: localizeProjectWidgetStyle(
          props.localeId,
          style as ProjectWidgetStyleId,
        ),
      }),
    );
  };
</script>

{#if node && location}
  <div
    bind:this={inspectorElement}
    aria-label={translate(props.localeId, "customize.widgetInspectorAria", {
      label: localizeLayoutNodeLabel(props.localeId, node),
    })}
    class="fennevia-widget-inspector"
    data-fennevia-widget-inspector=""
    data-fennevia-widget-inspector-for={props.selectedInstanceId}
    data-fennevia-widget-inspector-placement={position?.placement}
    data-fennevia-widget-inspector-positioned={position ? true : undefined}
    id={`fennevia-widget-inspector-${props.selectedInstanceId}`}
    ondragstart={(event) => event.preventDefault()}
    onkeydown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        focusAnchor();
      }
    }}
    role="dialog"
    style:--fennevia-widget-inspector-left={`${position?.left ?? 0}px`}
    style:--fennevia-widget-inspector-top={`${position?.top ?? 0}px`}
    tabindex="-1"
  >
    <header class="fennevia-widget-inspector__header">
      <strong>{localizeLayoutNodeLabel(props.localeId, node)}</strong>
      <button
        aria-label={translate(props.localeId, "customize.closeWidgetInspector")}
        class="fennevia-widget-inspector__close"
        onclick={focusAnchor}
        title={translate(props.localeId, "customize.closeWidgetInspector")}
        type="button">×</button
      >
    </header>

    <div
      aria-label={translate(
        props.localeId,
        "customize.widgetInspectorToolbar",
        { label: localizeLayoutNodeLabel(props.localeId, node) },
      )}
      class="fennevia-widget-inspector__toolbar"
      role="toolbar"
    >
      <button
        aria-label={translate(props.localeId, "customize.moveBefore")}
        data-fennevia-widget-config-action="move-before"
        disabled={index === 0}
        onclick={() => moveSibling(-1)}
        title={translate(props.localeId, "customize.moveBefore")}
        type="button">←</button
      >
      <button
        aria-label={translate(props.localeId, "customize.moveAfter")}
        data-fennevia-widget-config-action="move-after"
        disabled={!parent || index >= parent.children.length - 1}
        onclick={() => moveSibling(1)}
        title={translate(props.localeId, "customize.moveAfter")}
        type="button">→</button
      >
      <button
        aria-label={translate(props.localeId, "customize.moveIntoPrevious")}
        data-fennevia-widget-config-action="move-into"
        disabled={!previous || !canAcceptChild(previous)}
        onclick={moveIntoPrevious}
        title={translate(props.localeId, "customize.moveIntoPrevious")}
        type="button">↳</button
      >
      <button
        aria-label={translate(props.localeId, "customize.moveOut")}
        data-fennevia-widget-config-action="move-out"
        disabled={!canMoveOut}
        onclick={moveOut}
        title={translate(props.localeId, "customize.moveOut")}
        type="button">↰</button
      >
      {#if node.type === "container"}
        <button
          aria-label={translate(
            props.localeId,
            node.direction === "row"
              ? "customize.changeToColumn"
              : "customize.changeToRow",
          )}
          data-fennevia-widget-config-action="direction"
          onclick={toggleDirection}
          title={translate(
            props.localeId,
            node.direction === "row"
              ? "customize.changeToColumn"
              : "customize.changeToRow",
          )}
          type="button">{node.direction === "row" ? "↕" : "↔"}</button
        >
      {/if}
      <button
        aria-label={translate(props.localeId, "customize.removeNode")}
        class="fennevia-widget-inspector__remove"
        data-fennevia-widget-config-action="remove"
        onclick={removeNode}
        title={translate(props.localeId, "customize.removeNode")}
        type="button">×</button
      >
    </div>

    {#if node.type === "item" && styleOptions.length > 1}
      <label class="fennevia-widget-inspector__style">
        <span>{translate(props.localeId, "customize.widgetStyle")}</span>
        <select
          aria-label={translate(props.localeId, "customize.widgetStyleFor", {
            label: localizeLayoutNodeLabel(props.localeId, node),
          })}
          class="fennevia-control"
          data-fennevia-widget-config-style=""
          onchange={setNodeStyle}
          value={node.style}
        >
          {#each styleOptions as style (style)}
            <option value={style}
              >{localizeProjectWidgetStyle(props.localeId, style)}</option
            >
          {/each}
        </select>
      </label>
    {/if}

    <output aria-live="polite" class="fennevia-layout-announcement"
      >{announcement}</output
    >
  </div>
{/if}
