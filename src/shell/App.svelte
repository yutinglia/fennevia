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
    edgeTriggerThicknessCssPixels,
    resolveEdgeAtPoint,
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
  } from "../app/toolbar-widgets-state";
  import type { BrowserWindowControlsStateAdapter } from "../app/window-controls-state";
  import CustomizePanel from "./CustomizePanel.svelte";
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
  let customizeOpen = $state(false);
  let panelDragCandidate = false;
  let focusReleaseTimer: DelayedFocusTimer | undefined;

  let surfaceLabels = $derived(
    Object.freeze({
      top: t("surface.top"),
      left: t("surface.left"),
      right: t("surface.right"),
      bottom: t("surface.bottom"),
    }),
  );

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
      void tick().then(() => {
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
      });
    });
  });

  // A forced dismissal of the top surface must not leave a floating editor.
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
    const bounds = props.frame.getBoundingClientRect();
    const resolvedEdge = resolveEdgeAtPoint({
      height: bounds.height,
      thickness: edgeTriggerThicknessCssPixels,
      width: bounds.width,
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
    if (resolvedEdge === props.edge) {
      props.shell.revealFromPointer(props.edge);
    }
  };

  const crossedPointerBoundary = (event: PointerEvent): boolean => {
    const boundary = event.currentTarget;
    const related = event.relatedTarget;
    return (
      boundary instanceof Node &&
      (!(related instanceof Node) || !boundary.contains(related))
    );
  };

  const handlePanelPointerOver = (event: PointerEvent) => {
    if (crossedPointerBoundary(event)) {
      props.shell.setPointerHeld(props.edge, true);
    }
  };

  const handleSurfacePointerOut = (event: PointerEvent) => {
    if (crossedPointerBoundary(event)) {
      props.shell.setPointerHeld(props.edge, false);
    }
  };

  const isInteractivePointerTarget = (
    target: PointerEvent["target"],
  ): boolean =>
    target instanceof Element &&
    Boolean(
      target.closest(
        'a, button, input, select, textarea, [contenteditable="true"], [role="button"], [role="link"], [role="tab"], [tabindex]',
      ),
    );

  const handlePanelPointerDown = (event: PointerEvent) => {
    panelDragCandidate =
      event.button === 0 && !isInteractivePointerTarget(event.target);
    if (panelDragCandidate) {
      props.shell.setPointerHeld(props.edge, false);
    }
  };

  const handlePanelPointerRelease = () => {
    if (!panelDragCandidate) {
      return;
    }
    panelDragCandidate = false;
    props.shell.setPointerHeld(props.edge, false);
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
    panelDragCandidate = false;
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
  data-fennevia-phase={surfaceState.phase}
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
  />

  <div
    aria-hidden={!surfaceState.visible}
    aria-label={surfaceLabels[props.edge]}
    class="fennevia-edge-panel"
    data-fennevia-edge-panel={props.edge}
    inert={!surfaceState.visible}
    onpointercancel={handlePanelPointerRelease}
    onpointerdown={handlePanelPointerDown}
    onpointerover={handlePanelPointerOver}
    onpointerup={handlePanelPointerRelease}
    role="region"
  >
    {#if props.edge === "left" && props.addressPopup && props.navigation && props.tabs}
      <LeftSurface
        addressPopup={props.addressPopup}
        browserTools={props.browserTools}
        {customizeOpen}
        customizeSession={props.customizeSession}
        {localeId}
        navigation={props.navigation}
        onDismiss={() => props.onDismiss("left")}
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
    {:else if props.edge === "right" && props.bookmarks}
      <RightSurface
        bookmarks={props.bookmarks}
        browserTools={props.browserTools}
        {customizeOpen}
        customizeSession={props.customizeSession}
        {localeId}
        onDismiss={() => props.onDismiss("right")}
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

    <footer
      aria-label={t("nav.keyboardShortcut")}
      class="fennevia-edge-panel__footer"
    >
      <kbd>{edgeKeyboardBindings[props.edge]}</kbd>
    </footer>

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
