<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import { onDestroy, tick } from "svelte";

  import type { AddressPopupController } from "../app/address-popup";
  import type { BrowserBookmarksStateAdapter } from "../app/bookmark-state";
  import type { BrowserToolsStateAdapter } from "../app/browser-tools-state";
  import type { CustomizeSessionController } from "../app/customize-session";
  import type { BrowserDownloadsStateAdapter } from "../app/download-state";
  import {
    edgeKeyboardBindings,
    type EdgeName,
    type EdgeShellController,
    type EdgeSurfaceController,
  } from "../app/edge-surfaces";
  import { translate, type MessageKey, type MessageVars } from "../app/i18n";
  import {
    defaultFenneviaLocale,
    type BrowserLocaleStateAdapter,
    type FenneviaLocale,
  } from "../app/locale-state";
  import type { BrowserNavigationStateAdapter } from "../app/navigation-state";
  import type { BrowserTabsStateAdapter } from "../app/tab-state";
  import { clearToolbarWidgetDrag } from "../app/toolbar-widget-drag";
  import type {
    BrowserToolbarWidgetsState,
    BrowserToolbarWidgetsStateAdapter,
    ProgressLightSource,
    SidePanelRole,
  } from "../app/toolbar-widgets-state";
  import {
    createDefaultShellPanelConfig,
    getSidePanelRole,
  } from "../app/toolbar-widgets-state";
  import type { BrowserWindowControlsStateAdapter } from "../app/window-controls-state";
  import CustomizePanel from "./CustomizePanel.svelte";
  import EdgePanelContextMenu from "./features/context-menu/EdgePanelContextMenu.svelte";
  import * as edgeUi from "./runtime/edge-app-interactions";
  import BottomSurface from "./surfaces/BottomSurface.svelte";
  import EdgeProgressLight from "./surfaces/EdgeProgressLight.svelte";
  import LeftSurface from "./surfaces/LeftSurface.svelte";
  import RightSurface from "./surfaces/RightSurface.svelte";
  import TopSurface from "./surfaces/TopSurface.svelte";

  type Props = Readonly<{
    addressPopup?: AddressPopupController;
    bookmarks?: BrowserBookmarksStateAdapter;
    browserTools?: BrowserToolsStateAdapter;
    customizeSession?: CustomizeSessionController;
    downloads?: BrowserDownloadsStateAdapter;
    edge: EdgeName;
    frame: HTMLElement;
    locale: BrowserLocaleStateAdapter;
    navigation?: BrowserNavigationStateAdapter;
    onDismiss: (edge: EdgeName) => void;
    onDisposed: (edge: EdgeName) => void;
    onFatalError: (error: unknown) => void;
    onOpenAddress?: () => boolean;
    shell: EdgeShellController;
    surface: EdgeSurfaceController;
    tabs?: BrowserTabsStateAdapter;
    toolbarWidgets?: BrowserToolbarWidgetsStateAdapter;
    windowControls?: BrowserWindowControlsStateAdapter;
    windowKind: "normal" | "private";
  }>;

  type DelayedFocusTimer = {
    id: number;
    view: Window;
  };

  const props: Props = $props();
  let localeId: FenneviaLocale = $state(defaultFenneviaLocale);
  const t = (key: MessageKey, vars?: MessageVars): string =>
    translate(localeId, key, vars);
  let rootElement: HTMLDivElement | undefined = $state();
  let surfaceRevision = $state(0);
  let surfaceState = $derived.by(() => {
    void surfaceRevision;
    return props.surface.snapshot();
  });
  let currentToolbarWidgets: BrowserToolbarWidgetsState | null = $state(null);
  let panelConfig = $derived(
    (currentToolbarWidgets ?? props.toolbarWidgets?.snapshot())?.snapshot
      .panels ?? createDefaultShellPanelConfig(),
  );
  let sidePanelRole: SidePanelRole | null = $derived(
    props.edge === "left" || props.edge === "right"
      ? getSidePanelRole(panelConfig, props.edge)
      : null,
  );
  let progressLightSource: ProgressLightSource = $derived(
    props.edge === "top"
      ? panelConfig.topProgressLight
      : props.edge === "bottom"
        ? panelConfig.bottomProgressLight
        : "off",
  );
  let shortcutHintsEnabled = $derived(
    (currentToolbarWidgets ?? props.toolbarWidgets?.snapshot())?.snapshot.style
      .shortcutHintDuration !== 0,
  );
  let customizeOpen = $state(false);
  let panelElement: HTMLDivElement | undefined = $state();
  let focusReleaseTimer: DelayedFocusTimer | undefined;

  const panelWindowDrag = edgeUi.createWindowDragCandidateController({
    canStart: (event) =>
      event.button === 0 && !edgeUi.isInteractivePointerTarget(event.target),
    getView: () => panelElement?.ownerDocument.defaultView,
    onEnd: (clickOnly) => {
      props.shell.setWindowDragActive(false);
      if (clickOnly) {
        props.shell.releasePointer(props.edge, "inside-window");
      }
    },
    onStart: () => props.shell.setWindowDragActive(true, props.edge),
  });

  let surfaceLabel = $derived(t(edgeUi.labelKey(props.edge, sidePanelRole)));

  $effect(() => {
    localeId = props.locale.snapshot().id;
    return props.locale.subscribe((snapshot) => {
      localeId = snapshot.id;
    });
  });

  $effect(() => {
    return props.surface.subscribe(() => {
      surfaceRevision += 1;
    });
  });

  $effect(() => {
    const toolbarWidgets = props.toolbarWidgets;
    if (!toolbarWidgets) {
      currentToolbarWidgets = null;
      return;
    }
    currentToolbarWidgets = toolbarWidgets.snapshot();
    return toolbarWidgets.subscribe((nextState) => {
      currentToolbarWidgets = nextState;
    });
  });

  $effect(() => {
    const session = props.customizeSession;
    if (!session) {
      customizeOpen = false;
      return;
    }
    customizeOpen = session.isOpen();
    return session.subscribe((snapshot) => {
      const wasOpen = customizeOpen;
      customizeOpen = snapshot.open;
      if (props.edge !== "top") {
        return;
      }
      void tick()
        .then(() => {
          if (snapshot.open && !wasOpen) {
            rootElement
              ?.querySelector<HTMLButtonElement>(
                "button[data-fennevia-customize-close]",
              )
              ?.focus();
            return;
          }
          if (!snapshot.open && wasOpen) {
            rootElement
              ?.querySelector<HTMLButtonElement>(
                'button[data-fennevia-action="customize-shell"]',
              )
              ?.focus();
          }
        })
        .catch(props.onFatalError);
    });
  });

  $effect(() => {
    if (props.edge !== "top" || surfaceState.visible || !customizeOpen) {
      return;
    }
    try {
      props.customizeSession?.setOpen(false);
    } catch (error) {
      props.onFatalError(error);
    }
  });

  const setCustomizeOpen = (open: boolean) => {
    const session = props.customizeSession;
    if (!session || session.isOpen() === open) {
      return;
    }
    try {
      session.setOpen(open);
    } catch (error) {
      props.onFatalError(error);
    }
  };

  const handleTriggerPointer = (event: PointerEvent) => {
    if (
      !surfaceState.enabled ||
      !edgeUi.pointerActivatesEdge({
        edge: props.edge,
        event,
        frame: props.frame,
        triggerThickness:
          props.shell.snapshot().interaction.triggerThicknessCssPixels,
      })
    ) {
      return;
    }
    props.shell.revealFromPointer(props.edge);
  };

  const handlePanelPointerOver = (event: PointerEvent) => {
    if (event.buttons === 0 && edgeUi.crossedPointerBoundary(event)) {
      props.shell.setPointerHeld(props.edge, true);
    }
  };

  const handleSurfacePointerOut = (event: PointerEvent) => {
    if (edgeUi.crossedPointerBoundary(event)) {
      props.shell.releasePointer(
        props.edge,
        event.relatedTarget === null ? "outside-window" : "inside-window",
      );
    }
  };

  const cancelFocusRelease = () => {
    const timer = focusReleaseTimer;
    if (!timer) {
      return;
    }
    focusReleaseTimer = undefined;
    timer.view.clearTimeout(timer.id);
  };

  const releaseSurfaceFocus = () => {
    if (
      rootElement?.contains(rootElement.ownerDocument.activeElement ?? null)
    ) {
      return;
    }
    props.shell.setFocusHeld(props.edge, false);
    props.shell.releaseKeyboard(props.edge);
  };

  const handleRootFocusOut = (event: FocusEvent) => {
    const nextTarget = event.relatedTarget;
    if (
      rootElement &&
      (!(nextTarget instanceof Node) || !rootElement.contains(nextTarget))
    ) {
      cancelFocusRelease();
      const view = rootElement.ownerDocument.defaultView;
      if (!view) {
        releaseSurfaceFocus();
        return;
      }
      const timer: DelayedFocusTimer = { id: 0, view };
      timer.id = view.setTimeout(() => {
        if (focusReleaseTimer !== timer) {
          return;
        }
        focusReleaseTimer = undefined;
        releaseSurfaceFocus();
      }, 0);
      focusReleaseTimer = timer;
    }
  };

  const handleRootFocusIn = () => {
    cancelFocusRelease();
    props.shell.setFocusHeld(props.edge, true);
  };

  onDestroy(() => {
    cancelFocusRelease();
    panelWindowDrag.dispose();
    clearToolbarWidgetDrag();
    props.onDisposed(props.edge);
  });
</script>

<div
  id={`fennevia-shell-${props.edge}-root`}
  bind:this={rootElement}
  lang={localeId}
  class="fennevia-edge-root"
  data-fennevia-edge={props.edge}
  data-fennevia-enabled={surfaceState.enabled}
  data-fennevia-phase={surfaceState.phase}
  data-fennevia-side-role={sidePanelRole ?? undefined}
  data-fennevia-surface-root=""
  data-fennevia-visible={surfaceState.visible}
  data-fennevia-window-kind={props.windowKind}
  onfocusin={handleRootFocusIn}
  onfocusout={handleRootFocusOut}
  onpointerout={handleSurfacePointerOut}
  role="presentation"
>
  <div
    aria-hidden="true"
    class="fennevia-edge-trigger"
    data-fennevia-edge-trigger={props.edge}
    onpointermove={handleTriggerPointer}
    onpointerover={handleTriggerPointer}
  ></div>

  <EdgeProgressLight
    downloads={props.downloads}
    edge={props.edge}
    navigation={props.navigation}
    source={progressLightSource}
  />

  <div
    bind:this={panelElement}
    aria-hidden={!surfaceState.visible}
    aria-label={surfaceLabel}
    class="fennevia-edge-panel"
    data-fennevia-edge-panel={props.edge}
    inert={!surfaceState.visible}
    onpointercancel={(event) => panelWindowDrag.release(event, true)}
    onpointerdown={panelWindowDrag.begin}
    onpointerover={handlePanelPointerOver}
    onpointerup={panelWindowDrag.release}
    role="region"
  >
    {#if (props.edge === "left" || props.edge === "right") && sidePanelRole === "tabs" && props.addressPopup && props.navigation && props.tabs}
      <LeftSurface
        addressPopup={props.addressPopup}
        browserTools={props.browserTools}
        {customizeOpen}
        customizeSession={props.customizeSession}
        edge={props.edge}
        {localeId}
        navigation={props.navigation}
        onDismiss={() => props.onDismiss(props.edge)}
        onFatalError={props.onFatalError}
        onOpenAddress={() => props.onOpenAddress?.() ?? false}
        shell={props.shell}
        tabs={props.tabs}
        toolbarWidgets={props.toolbarWidgets}
        toolbarWidgetsState={currentToolbarWidgets}
      />
    {:else if props.edge === "top" && props.navigation && props.windowControls}
      <TopSurface
        browserTools={props.browserTools}
        {customizeOpen}
        customizeSession={props.customizeSession}
        {localeId}
        navigation={props.navigation}
        onDismiss={() => props.onDismiss("top")}
        onFatalError={props.onFatalError}
        onSetCustomizeOpen={setCustomizeOpen}
        shell={props.shell}
        toolbarWidgets={props.toolbarWidgets}
        toolbarWidgetsState={currentToolbarWidgets}
        windowControls={props.windowControls}
        windowKind={props.windowKind}
      />
    {:else if (props.edge === "left" || props.edge === "right") && sidePanelRole === "bookmarks" && props.bookmarks}
      <RightSurface
        bookmarks={props.bookmarks}
        browserTools={props.browserTools}
        {customizeOpen}
        customizeSession={props.customizeSession}
        edge={props.edge}
        {localeId}
        onDismiss={() => props.onDismiss(props.edge)}
        onFatalError={props.onFatalError}
        shell={props.shell}
        toolbarWidgets={props.toolbarWidgets}
        toolbarWidgetsState={currentToolbarWidgets}
      />
    {:else if props.edge === "bottom" && props.downloads}
      <BottomSurface
        browserTools={props.browserTools}
        {customizeOpen}
        customizeSession={props.customizeSession}
        downloads={props.downloads}
        {localeId}
        onDismiss={() => props.onDismiss("bottom")}
        onFatalError={props.onFatalError}
        shell={props.shell}
        toolbarWidgets={props.toolbarWidgets}
        toolbarWidgetsState={currentToolbarWidgets}
      />
    {/if}

    <EdgePanelContextMenu
      bookmarks={props.bookmarks}
      browserTools={props.browserTools}
      customizeSession={props.customizeSession}
      edge={props.edge}
      frame={props.frame}
      {localeId}
      onDismiss={props.onDismiss}
      onFatalError={props.onFatalError}
      onSetCustomizeOpen={setCustomizeOpen}
      panel={panelElement}
      shell={props.shell}
      {sidePanelRole}
      tabs={props.tabs}
      toolbarWidgets={props.toolbarWidgets}
      visible={surfaceState.visible}
    />

    {#if shortcutHintsEnabled}
      <footer
        aria-label={t("nav.keyboardShortcut")}
        class="fennevia-edge-panel__footer"
      >
        <kbd>{edgeKeyboardBindings[props.edge]}</kbd>
      </footer>
    {/if}

    {#if props.edge === "top"}
      <template data-fennevia-template="">
        <span data-fennevia-template-content=""
          >Fennevia XHTML template probe</span
        >
      </template>
    {/if}
  </div>

  {#if props.edge === "top" && customizeOpen && props.toolbarWidgets}
    <CustomizePanel
      customizeSession={props.customizeSession}
      {localeId}
      onClose={() => setCustomizeOpen(false)}
      state={currentToolbarWidgets}
      toolbarWidgets={props.toolbarWidgets}
    />
  {/if}
</div>
