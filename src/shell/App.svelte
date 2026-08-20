<script lang="ts">
  import { onDestroy, tick, untrack } from "svelte";

  import { type AddressPopupController } from "../app/address-popup";
  import type { BrowserBookmarksStateAdapter } from "../app/bookmark-state";
  import type { CustomizeSessionController } from "../app/customize-session";
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
    type ToolbarWidgetsEditOperation,
    type ToolbarZoneName,
  } from "../app/toolbar-widgets-state";
  import {
    clearToolbarWidgetDrag,
    createToolbarWidgetDropEdit,
    getActiveToolbarWidgetDrag,
    resolveWidgetInsertBefore,
    serializeToolbarWidgetDrag,
    startToolbarWidgetDrag,
    toolbarWidgetDragMimeType,
    type ToolbarWidgetDropTarget,
  } from "../app/toolbar-widget-drag";
  import type {
    BrowserWindowControlsStateAdapter,
    WindowControlAction,
    WindowControlsSnapshot,
  } from "../app/window-controls-state";
  import { translate, type MessageKey, type MessageVars } from "../app/i18n";
  import {
    defaultFenneviaLocale,
    type BrowserLocaleStateAdapter,
    type FenneviaLocale,
  } from "../app/locale-state";
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
  import {
    createTabStripLabels,
    localizeWidgetLabel,
    localizeWidgetTooltip,
    zoneDisplayName,
  } from "./locale-ui";
  import BookmarksPanel from "./BookmarksPanel.svelte";
  import { resolveBrowserToolHost } from "./browser-tool-host";
  import CustomizePanel from "./CustomizePanel.svelte";
  import DownloadsPanel from "./DownloadsPanel.svelte";
  import ProgressLight from "./ProgressLight.svelte";
  import ShellIcon from "./ShellIcon.svelte";
  import ToolbarWidgetGlyph from "./ToolbarWidgetGlyph.svelte";

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

  const closeFocusRetryDelayMs = 200;

  type DelayedFocusTimer = {
    id: number;
    view: Window;
  };

  const props: Props = $props();
  let localeId: FenneviaLocale = $state(defaultFenneviaLocale);
  const t = (key: MessageKey, vars?: MessageVars): string =>
    translate(localeId, key, vars);
  let tabLabels = $derived(createTabStripLabels(localeId));
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
      localeId,
    ),
  );
  let protectionStatus = $derived(
    getTrackingProtectionPresentation(
      currentNavigation.snapshot.trackingProtection,
      localeId,
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

  let surfaceLabels = $derived(
    Object.freeze({
      top: t("surface.top"),
      left: t("surface.left"),
      right: t("surface.right"),
      bottom: t("surface.bottom"),
    }),
  );

  $effect(() => {
    const locale = props.locale;
    localeId = locale.snapshot().id;
    return locale.subscribe((snapshot) => {
      localeId = snapshot.id;
    });
  });

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
    if (!toolbarWidgets) {
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
        await browserTools.invoke(action, host);
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
      // Widget placement is an optional capability; a failed invoke keeps the
      // native path (customize mode, unified extensions panel) fully usable.
      props.shell.setPopupHeld(props.edge, false);
    }
  };

  const runFenneviaWidgetAction = (action: string, event?: MouseEvent) => {
    try {
      if (action === "show-bookmarks") {
        props.shell.revealProgrammatically("right");
        return;
      }
      if (action === "show-downloads") {
        void runBrowserToolAction("downloads", event);
      }
    } catch (error) {
      props.onFatalError(error);
    }
  };

  let customizeOpen = $state(false);
  let dropPreview: Readonly<{
    insertBefore: number;
    zone: ToolbarZoneName;
  }> | null = $state(null);

  $effect(() => {
    const session = props.customizeSession;
    if (!session) {
      customizeOpen = false;
      return;
    }
    customizeOpen = session.isOpen();
    return session.subscribe((snapshot) => {
      const wasOpen = customizeOpen;
      const open = snapshot.open;
      customizeOpen = open;
      if (props.edge !== "top") {
        return;
      }
      void tick().then(() => {
        if (open && !wasOpen) {
          const closeButton = rootElement?.querySelector<HTMLButtonElement>(
            "button[data-fennevia-customize-close]",
          );
          closeButton?.focus();
          return;
        }
        if (!open && wasOpen) {
          const toggle = rootElement?.querySelector<HTMLButtonElement>(
            'button[data-fennevia-action="customize-shell"]',
          );
          toggle?.focus();
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

  const widgetDisplayLabel = (widget: ToolbarWidgetSnapshot): string =>
    localizeWidgetLabel(localeId, widget);

  const runToolbarWidgetEdit = async (
    operation: ToolbarWidgetsEditOperation,
  ) => {
    try {
      await props.toolbarWidgets?.edit(operation);
    } catch {
      // Editing is an optional capability; a stale revision must never take
      // the shell down.
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
    const revision = currentToolbarWidgets?.revision ?? 0;
    const operation = source
      ? createToolbarWidgetDropEdit(source, target, revision)
      : null;
    dropPreview = null;
    clearToolbarWidgetDrag();
    if (!operation) {
      return;
    }
    void runToolbarWidgetEdit(operation);
  };

  const handleWidgetZoneDragOver = (
    event: DragEvent,
    zone: ToolbarZoneName,
  ) => {
    if (!customizeOpen || !getActiveToolbarWidgetDrag()) {
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
    dropPreview = { insertBefore, zone };
    props.customizeSession?.setLastFocusedZone(zone);
  };

  const handleWidgetZoneDrop = (event: DragEvent, zone: ToolbarZoneName) => {
    if (!customizeOpen) {
      return;
    }
    event.preventDefault();
    const insertBefore = collectWidgetInsertBefore(event) ?? 0;
    applyWidgetDrop({ insertBefore, type: "zone", zone });
  };

  const handleWidgetZoneDragLeave = (
    event: DragEvent,
    zone: ToolbarZoneName,
  ) => {
    const current = event.currentTarget;
    const related = event.relatedTarget;
    if (
      current instanceof Node &&
      related instanceof Node &&
      current.contains(related)
    ) {
      return;
    }
    if (dropPreview?.zone === zone) {
      dropPreview = null;
    }
  };

  const handleWidgetDragStart = (
    event: DragEvent,
    zone: ToolbarZoneName,
    index: number,
  ) => {
    if (!customizeOpen) {
      event.preventDefault();
      return;
    }
    const transfer = event.dataTransfer;
    if (!transfer) {
      return;
    }
    const source = startToolbarWidgetDrag({ index, type: "zone", zone });
    transfer.effectAllowed = "move";
    transfer.setData(
      toolbarWidgetDragMimeType,
      serializeToolbarWidgetDrag(source),
    );
    transfer.setData("text/plain", source.type);
    props.customizeSession?.setLastFocusedZone(zone);
  };

  const handleWidgetDragEnd = () => {
    dropPreview = null;
    clearToolbarWidgetDrag();
  };

  const handleWidgetItemKeydown = (
    event: KeyboardEvent,
    zone: ToolbarZoneName,
    index: number,
  ) => {
    if (!customizeOpen) {
      return;
    }
    const widgets = currentToolbarWidgets?.snapshot.zones[zone] ?? [];
    const revision = currentToolbarWidgets?.revision ?? 0;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      void runToolbarWidgetEdit({ index, revision, type: "remove", zone });
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
    if (toIndex < 0 || toIndex >= widgets.length) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    void runToolbarWidgetEdit({
      fromIndex: index,
      fromZone: zone,
      revision,
      toIndex,
      toZone: zone,
      type: "move",
    });
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
    dropPreview = null;
    clearToolbarWidgetDrag();
    if (props.edge === "left") {
      addressPopupVisible = false;
    }
    props.onDisposed(props.edge);
  });
</script>

{#snippet widgetZone(zone: ToolbarZoneName)}
  {@const zoneWidgets = customizeOpen
    ? (currentToolbarWidgets?.snapshot.zones[zone] ?? [])
    : (currentToolbarWidgets?.snapshot.zones[zone] ?? []).filter(
        (widget) => !widget.missing,
      )}
  {#if currentToolbarWidgets?.snapshot.available && (customizeOpen || zoneWidgets.length > 0)}
    <div
      aria-label={customizeOpen
        ? t("widget.droppableAria", { zone: zoneDisplayName(localeId, zone) })
        : t("widget.toolbarShortcuts")}
      class="fennevia-toolbar-widgets"
      class:fennevia-toolbar-widgets--compact={zone !== "top"}
      class:fennevia-toolbar-widgets--editing={customizeOpen}
      data-fennevia-customize-insert={customizeOpen &&
      dropPreview?.zone === zone
        ? String(dropPreview.insertBefore)
        : undefined}
      data-fennevia-drop-end={customizeOpen &&
      dropPreview?.zone === zone &&
      zoneWidgets.length > 0 &&
      dropPreview.insertBefore === zoneWidgets.length
        ? ""
        : undefined}
      data-fennevia-toolbar-widgets={zone}
      ondragleave={(event) => handleWidgetZoneDragLeave(event, zone)}
      ondragover={(event) => handleWidgetZoneDragOver(event, zone)}
      ondrop={(event) => handleWidgetZoneDrop(event, zone)}
      onfocusin={() => props.customizeSession?.setLastFocusedZone(zone)}
      role="group"
    >
      {#if customizeOpen && zoneWidgets.length === 0}
        <span class="fennevia-toolbar-widgets__placeholder"
          >{t("widget.dropHere")}</span
        >
      {/if}
      {#each zoneWidgets as widget, index (`${zone}-${index}-${widget.handle}-${widget.fenneviaAction}`)}
        {#if widget.kind === "separator" || widget.kind === "spacer" || widget.kind === "spring"}
          {#if customizeOpen}
            <button
              aria-label={widgetDisplayLabel(widget)}
              class={`fennevia-toolbar-widgets__item fennevia-toolbar-widgets__${widget.kind}`}
              data-fennevia-drop-before={dropPreview?.zone === zone &&
              dropPreview.insertBefore === index
                ? ""
                : undefined}
              data-fennevia-toolbar-widget-item=""
              draggable="true"
              ondragend={handleWidgetDragEnd}
              ondragstart={(event) => handleWidgetDragStart(event, zone, index)}
              onkeydown={(event) => handleWidgetItemKeydown(event, zone, index)}
              type="button"
            ></button>
          {:else}
            <span
              aria-hidden="true"
              class={`fennevia-toolbar-widgets__item fennevia-toolbar-widgets__${widget.kind}`}
            ></span>
          {/if}
        {:else}
          <button
            aria-label={widgetDisplayLabel(widget)}
            class="fennevia-control fennevia-toolbar-widgets__button fennevia-toolbar-widgets__item"
            data-fennevia-browser-tool="toolbar-widget"
            data-fennevia-drop-before={customizeOpen &&
            dropPreview?.zone === zone &&
            dropPreview.insertBefore === index
              ? ""
              : undefined}
            data-fennevia-toolbar-widget-item=""
            data-fennevia-toolbar-widget-kind={widget.kind}
            disabled={!customizeOpen &&
              (widget.disabled ||
                (widget.fenneviaAction === "show-downloads" &&
                  !browserToolsSnapshot?.downloads))}
            draggable={customizeOpen}
            ondragend={handleWidgetDragEnd}
            ondragstart={(event) => handleWidgetDragStart(event, zone, index)}
            onkeydown={(event) => handleWidgetItemKeydown(event, zone, index)}
            onclick={(event) => void runToolbarWidgetAction(widget, event)}
            title={localizeWidgetTooltip(
              localeId,
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
{/snippet}

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
        aria-label={t("nav.launcherAria")}
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
            aria-label={t("nav.openAddress")}
            class="fennevia-address-launcher__button"
            data-fennevia-address-launcher=""
            data-fennevia-default-focus=""
            onclick={() => props.onOpenAddress?.()}
            title={t("nav.openAddress")}
            type="button"
          >
            <span aria-hidden="true" class="fennevia-address-launcher__glyph"
              >⌁</span
            >
            <span class="fennevia-address-launcher__location" dir="auto">
              {currentNavigation.snapshot.addressValue ||
                t("address.placeholder")}
            </span>
          </button>
          <div class="fennevia-address-launcher__indicators">
            <button
              aria-label={t("nav.openSiteInformation", {
                label: connectionStatus.label,
              })}
              class="fennevia-address-launcher__indicator"
              data-fennevia-browser-tool="site-information"
              data-fennevia-connection-status=""
              data-fennevia-status-tone={connectionStatus.tone}
              disabled={!browserToolsSnapshot?.siteInformation}
              onclick={(event) =>
                void runBrowserToolAction("site-information", event)}
              title={t("nav.openSiteInformation", {
                label: connectionStatus.label,
              })}
              type="button">{connectionStatus.badge}</button
            >
            <button
              aria-label={t("nav.openTrackingProtection", {
                label: protectionStatus.label,
              })}
              class="fennevia-address-launcher__indicator"
              data-fennevia-browser-tool="protections"
              data-fennevia-protection-status=""
              data-fennevia-status-tone={protectionStatus.tone}
              disabled={!browserToolsSnapshot?.protections}
              onclick={(event) =>
                void runBrowserToolAction("protections", event)}
              title={t("nav.openTrackingProtection", {
                label: protectionStatus.label,
              })}
              type="button">{protectionStatus.badge}</button
            >
          </div>
        </div>
      </section>

      <div class="fennevia-tabs-summary">
        <span>{t("tab.openHeading")}</span>
        <output
          aria-label={t("tab.openCount", { count: currentTabs.tabs.length })}
          data-fennevia-tab-count="">{currentTabs.tabs.length}</output
        >
      </div>

      <div class="fennevia-tab-strip">
        <div
          aria-label={t("tab.openHeading")}
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
                  tabLabels,
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
                title={getDisplayTabTitle(tab, tabLabels)}
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
                  {getDisplayTabTitle(tab, tabLabels)}
                </span>
                {#if tab.pictureInPicture}
                  <span class="fennevia-tab-strip__pip" aria-hidden="true"
                    >▭</span
                  >
                {/if}
              </button>

              {#if audioAction}
                <button
                  aria-label={getTabActionAccessibleName(
                    audioAction,
                    tab,
                    tabLabels,
                  )}
                  class="fennevia-control fennevia-tab-strip__action"
                  data-fennevia-action="toggle-mute"
                  onclick={(event) => handleTabAudioAction(event, tab.id)}
                  tabindex={rovingTabId === tab.id ? 0 : -1}
                  title={getTabActionAccessibleName(
                    audioAction,
                    tab,
                    tabLabels,
                  )}
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
                  tabLabels,
                )}
                aria-pressed={tab.pinned}
                class="fennevia-control fennevia-tab-strip__action"
                data-fennevia-action={tab.pinned ? "unpin-tab" : "pin-tab"}
                onclick={(event) => {
                  event.stopPropagation();
                  togglePinned(tab);
                }}
                tabindex={rovingTabId === tab.id ? 0 : -1}
                title={tab.pinned ? t("tab.unpinTab") : t("tab.pinTab")}
                type="button">{tab.pinned ? "◆" : "◇"}</button
              >

              <button
                aria-label={getTabActionAccessibleName(
                  "close",
                  tab,
                  tabLabels,
                )}
                class="fennevia-control fennevia-tab-strip__action"
                data-fennevia-action="close-tab"
                onclick={(event) => {
                  event.stopPropagation();
                  closeTab(tab.id);
                }}
                tabindex={rovingTabId === tab.id ? 0 : -1}
                title={t("tab.closeTab")}
                type="button">×</button
              >
            </div>
          {/each}
        </div>

        <button
          aria-label={t("tab.newTabAria")}
          class="fennevia-control fennevia-tab-strip__new"
          data-fennevia-action="new-tab"
          onclick={openTab}
          title={t("tab.newTab")}
          type="button"
        >
          <span aria-hidden="true">+</span>
          <span>{t("tab.newTab")}</span>
        </button>
      </div>

      {@render widgetZone("left")}
    {:else if props.edge === "top"}
      <div
        aria-label={t("nav.browserToolbar")}
        class="fennevia-navigation"
        data-fennevia-navigation=""
        role="toolbar"
      >
        <div class="fennevia-navigation__leading">
          <div
            aria-label={t("nav.primaryNavigation")}
            class="fennevia-navigation__controls"
            role="group"
          >
            <button
              aria-label={t("nav.backAria")}
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
              title={t("nav.back")}
              type="button"
            >
              <ShellIcon name="back" />
            </button>
            <button
              aria-label={t("nav.forwardAria")}
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
              title={t("nav.forward")}
              type="button"
            >
              <ShellIcon name="forward" />
            </button>
            <button
              aria-busy={currentNavigation.snapshot.loading}
              aria-label={currentNavigation.snapshot.loading
                ? t("nav.stopAria")
                : t("nav.reloadAria")}
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
              title={currentNavigation.snapshot.loading
                ? t("nav.stop")
                : t("nav.reload")}
              type="button"
            >
              <ShellIcon
                name={currentNavigation.snapshot.loading ? "stop" : "reload"}
              />
            </button>
            <button
              aria-label={t("nav.homeAria")}
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
              title={t("nav.home")}
              type="button"
            >
              <ShellIcon name="home" />
            </button>
          </div>
        </div>

        {@render widgetZone("top")}

        <div class="fennevia-navigation__trailing">
          <div
            aria-label={t("nav.firefoxTools")}
            class="fennevia-browser-tools"
            data-fennevia-browser-tools=""
            role="group"
          >
            <button
              aria-label={t("nav.extensionsAria")}
              class="fennevia-control fennevia-browser-tools__button"
              data-fennevia-browser-tool="extensions"
              disabled={!browserToolsSnapshot?.extensions}
              onmousedown={(event) => {
                if (event.button !== 0) {
                  return;
                }
                void runBrowserToolAction("extensions", event);
              }}
              onclick={(event) => {
                if (event.detail !== 0) {
                  return;
                }
                void runBrowserToolAction("extensions", event);
              }}
              title={t("nav.extensions")}
              type="button"
            >
              <ShellIcon name="extensions" />
            </button>
            <button
              aria-label={t("nav.settingsAria")}
              class="fennevia-control fennevia-browser-tools__button fennevia-browser-tools__secondary"
              data-fennevia-browser-tool="settings"
              disabled={!browserToolsSnapshot?.settings}
              onclick={() => void runBrowserToolAction("settings")}
              title={t("nav.settings")}
              type="button"
            >
              <ShellIcon name="settings" />
            </button>
            {#if currentToolbarWidgets?.snapshot.canEdit}
              <button
                aria-expanded={customizeOpen}
                aria-label={t("nav.customizeAria")}
                class="fennevia-control fennevia-browser-tools__button"
                data-fennevia-action="customize-shell"
                onclick={() => setCustomizeOpen(!customizeOpen)}
                title={t("nav.customizeTitle")}
                type="button"
              >
                <ShellIcon name="palette" />
              </button>
            {/if}
            <button
              aria-label={t("nav.firefoxMenuAria")}
              class="fennevia-control fennevia-browser-tools__button"
              data-fennevia-browser-tool="application-menu"
              disabled={!browserToolsSnapshot?.applicationMenu}
              onclick={(event) =>
                void runBrowserToolAction("application-menu", event)}
              title={t("nav.firefoxMenu")}
              type="button"
            >
              <ShellIcon name="menu" />
            </button>
          </div>

          {#if props.windowKind === "private"}
            <span class="fennevia-navigation__private">{t("nav.private")}</span>
          {/if}
        </div>

        <div
          aria-label={t("window.controls")}
          class="fennevia-window-controls"
          data-fennevia-window-controls=""
          role="group"
        >
          <button
            aria-label={t("window.minimizeAria")}
            class="fennevia-control fennevia-window-controls__button"
            data-fennevia-window-control="minimize"
            onclick={() => runWindowControlAction("minimize")}
            title={t("window.minimize")}
            type="button"
          >
            <ShellIcon name="minimize" />
          </button>
          <button
            aria-label={windowControlsSnapshot.maximized
              ? t("window.restoreAria")
              : t("window.maximizeAria")}
            class="fennevia-control fennevia-window-controls__button"
            data-fennevia-window-control="toggle-maximize"
            onclick={() => runWindowControlAction("toggle-maximize")}
            title={windowControlsSnapshot.maximized
              ? t("window.restore")
              : t("window.maximize")}
            type="button"
          >
            <ShellIcon
              name={windowControlsSnapshot.maximized ? "restore" : "maximize"}
            />
          </button>
          <button
            aria-label={t("window.closeAria")}
            class="fennevia-control fennevia-window-controls__button fennevia-window-controls__close"
            data-fennevia-window-control="close"
            onclick={() => runWindowControlAction("close")}
            title={t("window.close")}
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
          localeId={localeId}
          onFatalError={props.onFatalError}
        />
      {/if}

      {@render widgetZone("right")}
    {:else if props.downloads}
      <DownloadsPanel
        downloads={props.downloads}
        localeId={localeId}
        onFatalError={props.onFatalError}
      />

      {@render widgetZone("bottom")}
    {/if}

    <footer aria-label={t("nav.keyboardShortcut")} class="fennevia-edge-panel__footer">
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
      localeId={localeId}
      onClose={() => setCustomizeOpen(false)}
      state={currentToolbarWidgets}
      toolbarWidgets={props.toolbarWidgets}
    />
  {/if}
</div>
