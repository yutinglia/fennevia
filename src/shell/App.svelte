<script lang="ts">
  import { onDestroy, tick, untrack } from "svelte";

  import { type AddressPopupController } from "../app/address-popup";
  import type { BrowserBookmarksStateAdapter } from "../app/bookmark-state";
  import {
    isPopupBrowserToolAction,
    type BrowserToolAction,
    type BrowserToolsStateAdapter,
  } from "../app/browser-tools-state";
  import type {
    BrowserDownloadsState,
    BrowserDownloadsStateAdapter,
  } from "../app/download-state";
  import {
    edgeKeyboardBindings,
    edgeTriggerThicknessCssPixels,
    resolveEdgeAtPoint,
    type EdgeName,
    type EdgeShellController,
    type EdgeSurfaceController,
  } from "../app/edge-surfaces";
  import {
    copyNavigationPointerGesture,
    createBrowserNavigationState,
    type BrowserNavigationState,
    type BrowserNavigationStateAdapter,
    type NavigationPointerGesture,
  } from "../app/navigation-state";
  import {
    createBrowserTabsState,
    type BrowserTabsState,
    type BrowserTabsStateAdapter,
    type TabSnapshot,
  } from "../app/tab-state";
  import {
    isInteractiveToolbarWidget,
    type BrowserToolbarWidgetsState,
    type BrowserToolbarWidgetsStateAdapter,
    type ToolbarWidgetSnapshot,
  } from "../app/toolbar-widgets-state";
  import type {
    BrowserWindowControlsStateAdapter,
    WindowControlAction,
    WindowControlsSnapshot,
  } from "../app/window-controls-state";
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
  } from "../app/tab-strip";
  import {
    resolveDownloadProgressLight,
    resolveLoadProgressLight,
  } from "../app/progress-light";
  import {
    getConnectionSecurityPresentation,
    getTrackingProtectionPresentation,
  } from "./navigation-labels";
  import BookmarksPanel from "./BookmarksPanel.svelte";
  import { resolveBrowserToolHost } from "./browser-tool-host";
  import DownloadsPanel from "./DownloadsPanel.svelte";
  import ProgressLight from "./ProgressLight.svelte";
  import ShellIcon, { type ShellIconName } from "./ShellIcon.svelte";

  type Props = Readonly<{
    addressPopup?: AddressPopupController;
    bookmarks?: BrowserBookmarksStateAdapter;
    browserTools?: BrowserToolsStateAdapter;
    downloads?: BrowserDownloadsStateAdapter;
    edge: EdgeName;
    frame: HTMLElement;
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

  const closeFocusRetryDelayMs = 200;

  type DelayedFocusTimer = {
    id: number;
    view: Window;
  };

  const props: Props = $props();
  let addressPopupVisible = $state(false);
  let currentNavigation: BrowserNavigationState = $state(
    createBrowserNavigationState({
      addressValue: "",
      canGoBack: false,
      canGoForward: false,
      connectionSecurity: "unavailable",
      displayUri: "",
      loading: false,
      title: "",
      trackingProtection: "unavailable",
    }),
  );
  let currentTabs: BrowserTabsState = $state(createBrowserTabsState([]));
  let rootElement: HTMLDivElement | undefined = $state();
  let rovingTabId: string | null = $state(null);
  let surfaceRevision = $state(0);
  let surfaceState = $derived.by(() => {
    void surfaceRevision;
    return props.surface.snapshot();
  });
  let connectionStatus = $derived(
    getConnectionSecurityPresentation(
      currentNavigation.snapshot.connectionSecurity,
    ),
  );
  let protectionStatus = $derived(
    getTrackingProtectionPresentation(
      currentNavigation.snapshot.trackingProtection,
    ),
  );
  let browserToolsSnapshot = $derived(props.browserTools?.snapshot());
  let currentToolbarWidgets: BrowserToolbarWidgetsState | null = $state(null);
  let currentDownloads: BrowserDownloadsState | null = $state(null);
  let windowControlsSnapshot: WindowControlsSnapshot = $state({
    maximized: false,
  });
  let delayedFocusTimer: DelayedFocusTimer | undefined;
  let focusReleaseTimer: DelayedFocusTimer | undefined;
  let highlightTimer: DelayedFocusTimer | undefined;
  let highlightedTabIds: readonly string[] = $state([]);
  let panelDragCandidate = false;
  let draggingTabId: string | null = $state(null);
  const tabButtons: Array<{
    node: HTMLButtonElement;
    tabId: string;
  }> = [];

  const surfaceLabels: Readonly<Record<EdgeName, string>> = {
    top: "Browser controls",
    left: "Tabs and address",
    right: "Bookmarks",
    bottom: "Downloads",
  };

  $effect(() => {
    const unsubscribe = props.surface.subscribe(() => {
      surfaceRevision += 1;
    });
    return unsubscribe;
  });

  $effect(() => {
    const navigation = props.navigation;
    if ((props.edge !== "top" && props.edge !== "left") || !navigation) {
      return;
    }
    currentNavigation = navigation.snapshot();
    return navigation.subscribe((nextState) => {
      currentNavigation = nextState;
    });
  });

  $effect(() => {
    const popup = props.addressPopup;
    if (props.edge !== "left" || !popup) {
      return;
    }
    const updateVisibility = (phase: string) => {
      addressPopupVisible = phase !== "hidden" && phase !== "disposed";
    };
    updateVisibility(popup.snapshot().phase);
    return popup.subscribe((snapshot) => {
      updateVisibility(snapshot.phase);
    });
  });

  $effect(() => {
    const tabs = props.tabs;
    if (props.edge !== "left" || !tabs) {
      return;
    }
    const initialTabs = tabs.snapshot();
    currentTabs = initialTabs;
    rovingTabId = resolveRovingTabId(
      initialTabs.tabs,
      untrack(() => rovingTabId),
    );
    const unsubscribe = tabs.subscribe((nextState) => {
      const openedTabIds = findOpenedTabIds(currentTabs.tabs, nextState.tabs);
      currentTabs = nextState;
      rovingTabId = resolveRovingTabId(nextState.tabs, rovingTabId);
      if (openedTabIds.length > 0) {
        void revealOpenedTabs(openedTabIds);
      }
    });
    return unsubscribe;
  });

  $effect(() => {
    const windowControls = props.windowControls;
    if (props.edge !== "top" || !windowControls) {
      return;
    }
    windowControlsSnapshot = windowControls.snapshot();
    return windowControls.subscribe((nextSnapshot) => {
      windowControlsSnapshot = nextSnapshot;
    });
  });

  $effect(() => {
    const downloads = props.downloads;
    if (props.edge !== "bottom" || !downloads) {
      currentDownloads = null;
      return;
    }
    currentDownloads = downloads.snapshot();
    return downloads.subscribe((nextState) => {
      currentDownloads = nextState;
    });
  });

  $effect(() => {
    const toolbarWidgets = props.toolbarWidgets;
    if (props.edge !== "top" || !toolbarWidgets) {
      currentToolbarWidgets = null;
      return;
    }
    currentToolbarWidgets = toolbarWidgets.snapshot();
    return toolbarWidgets.subscribe((nextState) => {
      currentToolbarWidgets = nextState;
    });
  });

  let loadLight = $derived(
    resolveLoadProgressLight(currentNavigation.snapshot.loading),
  );
  let downloadLight = $derived(resolveDownloadProgressLight(currentDownloads));

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

  const requireTabs = (): BrowserTabsStateAdapter => {
    if (!props.tabs) {
      throw new Error("FENNEVIA_LEFT_SURFACE_TABS_UNAVAILABLE");
    }
    return props.tabs;
  };

  const requireNavigation = (): BrowserNavigationStateAdapter => {
    if (!props.navigation) {
      throw new Error("FENNEVIA_SURFACE_NAVIGATION_UNAVAILABLE");
    }
    return props.navigation;
  };

  const runNavigationAction = (
    action: (navigation: BrowserNavigationStateAdapter) => unknown,
  ) => {
    try {
      action(requireNavigation());
    } catch (error) {
      props.onFatalError(error);
    }
  };

  const pointerGestureFromMouseEvent = (
    event: MouseEvent,
  ): NavigationPointerGesture =>
    copyNavigationPointerGesture({
      altKey: event.altKey,
      button: event.button,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
    });

  const preventMiddleAutoscroll = (event: MouseEvent) => {
    if (event.button === 1) {
      event.preventDefault();
    }
  };

  const handleNavigationAuxClick = (
    event: MouseEvent,
    action: (
      navigation: BrowserNavigationStateAdapter,
      gesture: NavigationPointerGesture,
    ) => unknown,
  ) => {
    if (event.button !== 1) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const gesture = pointerGestureFromMouseEvent(event);
    runNavigationAction((navigation) => action(navigation, gesture));
  };

  const runBrowserToolAction = async (
    action: BrowserToolAction,
    event?: MouseEvent,
  ) => {
    try {
      const browserTools = props.browserTools;
      if (!browserTools) {
        throw new Error("FENNEVIA_BROWSER_TOOLS_UNAVAILABLE");
      }
      if (isPopupBrowserToolAction(action)) {
        props.shell.setPopupHeld(props.edge, true);
        await browserTools.invoke(action, resolveBrowserToolHost(event));
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

  const toolbarWidgetIconNames: ReadonlyMap<string, ShellIconName> = new Map([
    ["account", "account"],
    ["bookmark", "bookmark"],
    ["developer", "developer"],
    ["edit", "edit"],
    ["extension", "extensions"],
    ["firefox-view", "firefox-view"],
    ["fullscreen", "fullscreen"],
    ["history", "history"],
    ["library", "library"],
    ["new-window", "new-window"],
    ["print", "print"],
    ["private", "private"],
    ["screenshot", "screenshot"],
    ["shield", "shield"],
    ["sidebar", "sidebar"],
    ["zoom", "zoom"],
  ]);

  const resolveToolbarWidgetIcon = (
    widget: ToolbarWidgetSnapshot,
  ): ShellIconName => toolbarWidgetIconNames.get(widget.icon) ?? "generic";

  const runToolbarWidgetAction = async (
    widget: ToolbarWidgetSnapshot,
    event: MouseEvent,
  ) => {
    const toolbarWidgets = props.toolbarWidgets;
    if (!toolbarWidgets || !isInteractiveToolbarWidget(widget)) {
      return;
    }
    props.shell.setPopupHeld(props.edge, true);
    try {
      const opened = await toolbarWidgets.invoke(
        widget.handle,
        resolveBrowserToolHost(event),
      );
      if (!opened) {
        props.shell.setPopupHeld(props.edge, false);
      }
    } catch {
      // Widget mirroring is an optional capability; a failed invoke keeps the
      // native path (customize mode, unified extensions panel) fully usable.
      props.shell.setPopupHeld(props.edge, false);
    }
  };

  const runWindowControlAction = (action: WindowControlAction) => {
    try {
      const windowControls = props.windowControls;
      if (!windowControls) {
        throw new Error("FENNEVIA_TOP_WINDOW_CONTROLS_UNAVAILABLE");
      }
      windowControls.invoke(action);
    } catch (error) {
      props.onFatalError(error);
    }
  };

  const revealCompanionSurface = (edge: "right" | "bottom") => {
    try {
      props.shell.revealProgrammatically(edge);
    } catch (error) {
      props.onFatalError(error);
    }
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

  const cancelFocusRelease = () => {
    const timer = focusReleaseTimer;
    if (!timer) {
      return;
    }
    focusReleaseTimer = undefined;
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
    const view = rootElement?.ownerDocument.defaultView;
    if (!view) {
      highlightedTabIds = [];
      return;
    }
    const timer: DelayedFocusTimer = { id: 0, view };
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
    if (
      rootElement?.contains(rootElement.ownerDocument.activeElement ?? null)
    ) {
      return;
    }
    props.shell.setFocusHeld(props.edge, false);
    props.shell.releaseKeyboard(props.edge);
    if (props.edge === "left") {
      rovingTabId = resolveRovingTabId(currentTabs.tabs);
    }
  };

  const restoreFocusAfterClose = (tabId: string | null) => {
    cancelDelayedFocus();
    void focusTab(tabId);
    const view = rootElement?.ownerDocument.defaultView;
    if (!view || !tabId) {
      return;
    }
    const timer: DelayedFocusTimer = { id: 0, view };
    timer.id = view.setTimeout(() => {
      if (delayedFocusTimer !== timer) {
        return;
      }
      delayedFocusTimer = undefined;
      void focusTab(resolveRovingTabId(currentTabs.tabs, tabId)).then(
        releaseSurfaceFocus,
      );
    }, closeFocusRetryDelayMs);
    delayedFocusTimer = timer;
  };

  const selectTab = (tabId: string) => {
    cancelDelayedFocus();
    rovingTabId = tabId;
    requireTabs().select(tabId);
    void focusTab(tabId);
  };

  const openTab = () => {
    cancelDelayedFocus();
    const openedTabId = requireTabs().open({ selected: true });
    void focusTab(openedTabId);
  };

  const closeTab = (tabId: string) => {
    cancelDelayedFocus();
    const focusTarget = findCloseFocusTarget(currentTabs.tabs, tabId);
    rovingTabId = focusTarget;
    requireTabs().close(tabId);
    restoreFocusAfterClose(resolveRovingTabId(currentTabs.tabs, focusTarget));
  };

  const togglePinned = (tab: TabSnapshot) => {
    cancelDelayedFocus();
    rovingTabId = tab.id;
    if (tab.pinned) {
      requireTabs().unpin(tab.id);
    } else {
      requireTabs().pin(tab.id);
    }
    void focusTab(tab.id);
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
        requireTabs().move(tabId, targetIndex);
      } catch (error) {
        props.onFatalError(error);
        return;
      }
      void focusTab(tabId);
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
      requireTabs().openContextMenu(tabId, {
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
      requireTabs().toggleMute(tabId);
    } catch (error) {
      props.onFatalError(error);
      return;
    }
    void focusTab(tabId);
  };

  const handleTabDragStart = (event: DragEvent, tabId: string) => {
    const transfer = event.dataTransfer;
    if (!transfer) {
      return;
    }
    transfer.effectAllowed = "move";
    transfer.setData("application/x-fennevia-tab", tabId);
    transfer.setData("text/plain", tabId);
    draggingTabId = tabId;
    props.shell.setPointerHeld("left", true);
  };

  const handleTabDragEnd = () => {
    draggingTabId = null;
    props.shell.setPointerHeld("left", false);
  };

  const handleTabListDragOver = (event: DragEvent) => {
    if (!draggingTabId) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  };

  const handleTabListDrop = (event: DragEvent) => {
    const tabId =
      event.dataTransfer?.getData("application/x-fennevia-tab") ||
      event.dataTransfer?.getData("text/plain") ||
      draggingTabId;
    if (!tabId) {
      return;
    }
    event.preventDefault();
    const list = event.currentTarget;
    if (!(list instanceof HTMLElement)) {
      return;
    }
    const items = Array.from(
      list.querySelectorAll<HTMLElement>("[data-fennevia-tab-item]"),
    );
    const mids = items.map((item) => {
      const bounds = item.getBoundingClientRect();
      return bounds.top + bounds.height / 2;
    });
    const targetIndex = resolveTabDropIndex(
      currentTabs.tabs,
      tabId,
      mids,
      event.clientY,
    );
    draggingTabId = null;
    props.shell.setPointerHeld("left", false);
    if (targetIndex === null) {
      return;
    }
    try {
      requireTabs().move(tabId, targetIndex);
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

  const handleRootFocusIn = (event: FocusEvent) => {
    cancelFocusRelease();
    props.shell.setFocusHeld(props.edge, true);
    if (props.edge !== "left") {
      return;
    }
    const registration = tabButtons.find(
      (candidate) => candidate.node === event.target,
    );
    if (registration) {
      rovingTabId = registration.tabId;
    }
  };

  onDestroy(() => {
    cancelDelayedFocus();
    cancelFocusRelease();
    cancelHighlight();
    highlightedTabIds = [];
    panelDragCandidate = false;
    tabButtons.length = 0;
    if (draggingTabId) {
      props.shell.setPointerHeld("left", false);
    }
    draggingTabId = null;
    if (props.edge === "left") {
      addressPopupVisible = false;
    }
    props.onDisposed(props.edge);
  });
</script>

<div
  id={`fennevia-shell-${props.edge}-root`}
  bind:this={rootElement}
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

  {#if props.edge === "top"}
    <ProgressLight presentation={loadLight} />
  {:else if props.edge === "bottom"}
    <ProgressLight presentation={downloadLight} />
  {/if}

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
    {#if props.edge === "left"}
      <section
        aria-label="Address and site status"
        class="fennevia-address-launcher"
        data-fennevia-address-launcher-region=""
      >
        <div
          class="fennevia-address-launcher__cluster"
          data-fennevia-address-launcher-cluster=""
        >
          <button
            aria-controls="fennevia-address-popup"
            aria-expanded={addressPopupVisible}
            aria-haspopup="dialog"
            aria-label="Open address and search"
            class="fennevia-address-launcher__button"
            data-fennevia-address-launcher=""
            data-fennevia-default-focus=""
            onclick={() => props.onOpenAddress?.()}
            title="Open address and search"
            type="button"
          >
            <span aria-hidden="true" class="fennevia-address-launcher__glyph"
              >⌁</span
            >
            <span class="fennevia-address-launcher__location" dir="auto">
              {currentNavigation.snapshot.addressValue ||
                "Search or enter address"}
            </span>
          </button>
          <div class="fennevia-address-launcher__indicators">
            <button
              aria-label={`Open Firefox site information. ${connectionStatus.label}`}
              class="fennevia-address-launcher__indicator"
              data-fennevia-browser-tool="site-information"
              data-fennevia-connection-status=""
              data-fennevia-status-tone={connectionStatus.tone}
              disabled={!browserToolsSnapshot?.siteInformation}
              onclick={(event) =>
                void runBrowserToolAction("site-information", event)}
              title={`Open Firefox site information. ${connectionStatus.label}`}
              type="button">{connectionStatus.badge}</button
            >
            <button
              aria-label={`Open Firefox tracking protection. ${protectionStatus.label}`}
              class="fennevia-address-launcher__indicator"
              data-fennevia-browser-tool="protections"
              data-fennevia-protection-status=""
              data-fennevia-status-tone={protectionStatus.tone}
              disabled={!browserToolsSnapshot?.protections}
              onclick={(event) =>
                void runBrowserToolAction("protections", event)}
              title={`Open Firefox tracking protection. ${protectionStatus.label}`}
              type="button">{protectionStatus.badge}</button
            >
          </div>
        </div>
      </section>

      <div class="fennevia-tabs-summary">
        <span>Open tabs</span>
        <output
          aria-label={`${currentTabs.tabs.length} open tabs`}
          data-fennevia-tab-count="">{currentTabs.tabs.length}</output
        >
      </div>

      <div class="fennevia-tab-strip">
        <div
          aria-label="Open tabs"
          aria-orientation="vertical"
          class="fennevia-tab-strip__list"
          data-fennevia-tab-list=""
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
                )}
                aria-selected={tab.selected}
                class="fennevia-tab-strip__tab"
                data-fennevia-tab=""
                draggable="true"
                onclick={() => selectTab(tab.id)}
                ondragend={handleTabDragEnd}
                ondragstart={(event) => handleTabDragStart(event, tab.id)}
                onkeydown={(event) => handleTabKeydown(event, tab.id)}
                role="tab"
                tabindex={rovingTabId === tab.id ? 0 : -1}
                title={getDisplayTabTitle(tab)}
                type="button"
              >
                <span class="fennevia-tab-strip__visual" aria-hidden="true">
                  <span class="fennevia-tab-strip__fallback">□</span>
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
                    <span class="fennevia-tab-strip__loading">↻</span>
                  {/if}
                </span>
                <span class="fennevia-tab-strip__title" dir="auto">
                  {getDisplayTabTitle(tab)}
                </span>
                {#if tab.pictureInPicture}
                  <span class="fennevia-tab-strip__pip" aria-hidden="true"
                    >▭</span
                  >
                {/if}
              </button>

              {#if audioAction}
                <button
                  aria-label={getTabActionAccessibleName(audioAction, tab)}
                  class="fennevia-control fennevia-tab-strip__action"
                  data-fennevia-action="toggle-mute"
                  onclick={(event) => handleTabAudioAction(event, tab.id)}
                  tabindex={rovingTabId === tab.id ? 0 : -1}
                  title={getTabActionAccessibleName(audioAction, tab)}
                  type="button"
                  >{audioAction === "unmute"
                    ? "ø"
                    : audioAction === "resume-media"
                      ? "■"
                      : "♪"}</button
                >
              {/if}

              <button
                aria-label={getTabActionAccessibleName(
                  tab.pinned ? "unpin" : "pin",
                  tab,
                )}
                aria-pressed={tab.pinned}
                class="fennevia-control fennevia-tab-strip__action"
                data-fennevia-action={tab.pinned ? "unpin-tab" : "pin-tab"}
                onclick={(event) => {
                  event.stopPropagation();
                  togglePinned(tab);
                }}
                tabindex={rovingTabId === tab.id ? 0 : -1}
                title={tab.pinned ? "Unpin tab" : "Pin tab"}
                type="button">{tab.pinned ? "◆" : "◇"}</button
              >

              <button
                aria-label={getTabActionAccessibleName("close", tab)}
                class="fennevia-control fennevia-tab-strip__action"
                data-fennevia-action="close-tab"
                onclick={(event) => {
                  event.stopPropagation();
                  closeTab(tab.id);
                }}
                tabindex={rovingTabId === tab.id ? 0 : -1}
                title="Close tab"
                type="button">×</button
              >
            </div>
          {/each}
        </div>

        <button
          aria-label="Open new tab"
          class="fennevia-control fennevia-tab-strip__new"
          data-fennevia-action="new-tab"
          onclick={openTab}
          title="New tab"
          type="button"
        >
          <span aria-hidden="true">+</span>
          <span>New tab</span>
        </button>
      </div>
    {:else if props.edge === "top"}
      <div
        aria-label="Browser toolbar"
        class="fennevia-navigation"
        data-fennevia-navigation=""
        role="toolbar"
      >
        <div class="fennevia-navigation__leading">
          <div
            aria-label="Primary navigation"
            class="fennevia-navigation__controls"
            role="group"
          >
            <button
              aria-label="Go back"
              class="fennevia-control fennevia-navigation__button"
              data-fennevia-action="back"
              data-fennevia-default-focus=""
              disabled={!currentNavigation.snapshot.canGoBack}
              onauxclick={(event) =>
                handleNavigationAuxClick(event, (navigation, gesture) =>
                  navigation.back(gesture),
                )}
              onclick={(event) =>
                runNavigationAction((navigation) =>
                  navigation.back(pointerGestureFromMouseEvent(event)),
                )}
              onmousedown={preventMiddleAutoscroll}
              title="Back"
              type="button"
            >
              <ShellIcon name="back" />
            </button>
            <button
              aria-label="Go forward"
              class="fennevia-control fennevia-navigation__button"
              data-fennevia-action="forward"
              disabled={!currentNavigation.snapshot.canGoForward}
              onauxclick={(event) =>
                handleNavigationAuxClick(event, (navigation, gesture) =>
                  navigation.forward(gesture),
                )}
              onclick={(event) =>
                runNavigationAction((navigation) =>
                  navigation.forward(pointerGestureFromMouseEvent(event)),
                )}
              onmousedown={preventMiddleAutoscroll}
              title="Forward"
              type="button"
            >
              <ShellIcon name="forward" />
            </button>
            <button
              aria-busy={currentNavigation.snapshot.loading}
              aria-label={currentNavigation.snapshot.loading
                ? "Stop loading"
                : "Reload page"}
              class="fennevia-control fennevia-navigation__button"
              data-fennevia-action="reload-stop"
              data-fennevia-loading={currentNavigation.snapshot.loading}
              onauxclick={(event) =>
                handleNavigationAuxClick(event, (navigation, gesture) =>
                  navigation.reload(gesture),
                )}
              onclick={() =>
                runNavigationAction((navigation) => navigation.reloadOrStop())}
              onmousedown={preventMiddleAutoscroll}
              title={currentNavigation.snapshot.loading ? "Stop" : "Reload"}
              type="button"
            >
              <ShellIcon
                name={currentNavigation.snapshot.loading ? "stop" : "reload"}
              />
            </button>
            <button
              aria-label="Go to home page"
              class="fennevia-control fennevia-navigation__button"
              data-fennevia-action="home"
              onauxclick={(event) =>
                handleNavigationAuxClick(event, (navigation, gesture) =>
                  navigation.home(gesture),
                )}
              onclick={(event) =>
                runNavigationAction((navigation) =>
                  navigation.home(pointerGestureFromMouseEvent(event)),
                )}
              onmousedown={preventMiddleAutoscroll}
              title="Home"
              type="button"
            >
              <ShellIcon name="home" />
            </button>
          </div>
        </div>

        <div class="fennevia-navigation__trailing">
          <div
            aria-label="Page and shell actions"
            class="fennevia-navigation__page-actions"
            role="group"
          >
            <button
              aria-label="Show bookmarks"
              class="fennevia-control fennevia-navigation__button fennevia-navigation__secondary"
              data-fennevia-action="show-bookmarks"
              onclick={() => revealCompanionSurface("right")}
              title="Bookmarks"
              type="button"
            >
              <ShellIcon name="bookmark" />
            </button>
            <button
              aria-label="Open Firefox downloads"
              class="fennevia-control fennevia-navigation__button fennevia-navigation__secondary"
              data-fennevia-browser-tool="downloads"
              disabled={!browserToolsSnapshot?.downloads}
              onclick={(event) => void runBrowserToolAction("downloads", event)}
              title="Firefox downloads"
              type="button"
            >
              <ShellIcon name="download" />
            </button>
          </div>

          {#if currentToolbarWidgets?.snapshot.available && currentToolbarWidgets.snapshot.widgets.length > 0}
            <div
              aria-label="Toolbar shortcuts"
              class="fennevia-toolbar-widgets"
              data-fennevia-toolbar-widgets=""
              role="group"
            >
              {#each currentToolbarWidgets.snapshot.widgets as widget, index (`${index}-${widget.handle}`)}
                {#if widget.kind === "separator"}
                  <span
                    aria-hidden="true"
                    class="fennevia-toolbar-widgets__separator"
                  ></span>
                {:else if widget.kind === "spacer"}
                  <span
                    aria-hidden="true"
                    class="fennevia-toolbar-widgets__spacer"
                  ></span>
                {:else if widget.kind === "spring"}
                  <span
                    aria-hidden="true"
                    class="fennevia-toolbar-widgets__spring"
                  ></span>
                {:else}
                  <button
                    aria-label={widget.label}
                    class="fennevia-control fennevia-toolbar-widgets__button"
                    data-fennevia-browser-tool="toolbar-widget"
                    data-fennevia-toolbar-widget-kind={widget.kind}
                    disabled={widget.disabled}
                    onclick={(event) =>
                      void runToolbarWidgetAction(widget, event)}
                    title={widget.tooltip || widget.label}
                    type="button"
                  >
                    {#if widget.kind === "extension-action" && widget.iconUrl}
                      <img
                        alt=""
                        class="fennevia-toolbar-widgets__icon"
                        src={widget.iconUrl}
                      />
                    {:else}
                      <ShellIcon name={resolveToolbarWidgetIcon(widget)} />
                    {/if}
                    {#if widget.badgeText}
                      <span
                        aria-hidden="true"
                        class="fennevia-toolbar-widgets__badge"
                        style:background-color={widget.badgeBackground ||
                          undefined}
                        style:color={widget.badgeTextColor || undefined}
                        >{widget.badgeText}</span
                      >
                    {/if}
                  </button>
                {/if}
              {/each}
            </div>
          {/if}

          <div
            aria-label="Firefox tools"
            class="fennevia-browser-tools"
            data-fennevia-browser-tools=""
            role="group"
          >
            <button
              aria-label="Open Firefox extensions"
              class="fennevia-control fennevia-browser-tools__button"
              data-fennevia-browser-tool="extensions"
              disabled={!browserToolsSnapshot?.extensions}
              onclick={(event) =>
                void runBrowserToolAction("extensions", event)}
              title="Extensions"
              type="button"
            >
              <ShellIcon name="extensions" />
            </button>
            <button
              aria-label="Open Firefox settings"
              class="fennevia-control fennevia-browser-tools__button fennevia-browser-tools__secondary"
              data-fennevia-browser-tool="settings"
              disabled={!browserToolsSnapshot?.settings}
              onclick={() => void runBrowserToolAction("settings")}
              title="Settings"
              type="button"
            >
              <ShellIcon name="settings" />
            </button>
            <button
              aria-label="Customize Firefox toolbar"
              class="fennevia-control fennevia-browser-tools__button fennevia-browser-tools__secondary"
              data-fennevia-browser-tool="customize"
              disabled={!browserToolsSnapshot?.customize}
              onclick={() => void runBrowserToolAction("customize")}
              title="Customize toolbar"
              type="button"
            >
              <ShellIcon name="customize" />
            </button>
            <button
              aria-label="Open Firefox menu"
              class="fennevia-control fennevia-browser-tools__button"
              data-fennevia-browser-tool="application-menu"
              disabled={!browserToolsSnapshot?.applicationMenu}
              onclick={(event) =>
                void runBrowserToolAction("application-menu", event)}
              title="Firefox menu"
              type="button"
            >
              <ShellIcon name="menu" />
            </button>
          </div>

          {#if props.windowKind === "private"}
            <span class="fennevia-navigation__private">Private</span>
          {/if}
        </div>

        <div
          aria-label="Window controls"
          class="fennevia-window-controls"
          data-fennevia-window-controls=""
          role="group"
        >
          <button
            aria-label="Minimize window"
            class="fennevia-control fennevia-window-controls__button"
            data-fennevia-window-control="minimize"
            onclick={() => runWindowControlAction("minimize")}
            title="Minimize"
            type="button"
          >
            <ShellIcon name="minimize" />
          </button>
          <button
            aria-label={windowControlsSnapshot.maximized
              ? "Restore window"
              : "Maximize window"}
            class="fennevia-control fennevia-window-controls__button"
            data-fennevia-window-control="toggle-maximize"
            onclick={() => runWindowControlAction("toggle-maximize")}
            title={windowControlsSnapshot.maximized ? "Restore" : "Maximize"}
            type="button"
          >
            <ShellIcon
              name={windowControlsSnapshot.maximized ? "restore" : "maximize"}
            />
          </button>
          <button
            aria-label="Close window"
            class="fennevia-control fennevia-window-controls__button fennevia-window-controls__close"
            data-fennevia-window-control="close"
            onclick={() => runWindowControlAction("close")}
            title="Close"
            type="button"
          >
            <ShellIcon name="close" />
          </button>
        </div>
      </div>
    {:else if props.edge === "right"}
      {#if props.bookmarks}
        <BookmarksPanel
          bookmarks={props.bookmarks}
          onFatalError={props.onFatalError}
        />
      {/if}
    {:else if props.downloads}
      <DownloadsPanel
        downloads={props.downloads}
        onFatalError={props.onFatalError}
      />
    {/if}

    <footer aria-label="Keyboard shortcut" class="fennevia-edge-panel__footer">
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
</div>
