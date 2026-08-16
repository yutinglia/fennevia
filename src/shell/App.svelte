<script lang="ts">
  import { onDestroy, tick, untrack } from "svelte";

  import { type AddressPopupController } from "../app/address-popup";
  import type { BrowserBookmarksStateAdapter } from "../app/bookmark-state";
  import type {
    BrowserToolAction,
    BrowserToolsStateAdapter,
  } from "../app/browser-tools-state";
  import type { BrowserDownloadsStateAdapter } from "../app/download-state";
  import {
    edgeKeyboardBindings,
    edgeTriggerThicknessCssPixels,
    resolveEdgeAtPoint,
    type EdgeName,
    type EdgeShellController,
    type EdgeSurfaceController,
  } from "../app/edge-surfaces";
  import {
    createBrowserNavigationState,
    type BrowserNavigationState,
    type BrowserNavigationStateAdapter,
  } from "../app/navigation-state";
  import {
    createBrowserTabsState,
    type BrowserTabsState,
    type BrowserTabsStateAdapter,
    type TabSnapshot,
  } from "../app/tab-state";
  import {
    findCloseFocusTarget,
    getDisplayTabTitle,
    getTabAccessibleName,
    getTabActionAccessibleName,
    getTabStripKeyAction,
    resolveRovingTabId,
  } from "../app/tab-strip";
  import {
    getConnectionSecurityPresentation,
    getTrackingProtectionPresentation,
  } from "./navigation-labels";
  import BookmarksPanel from "./BookmarksPanel.svelte";
  import DownloadsPanel from "./DownloadsPanel.svelte";
  import ShellIcon from "./ShellIcon.svelte";

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
  let delayedFocusTimer: DelayedFocusTimer | undefined;
  let focusReleaseTimer: DelayedFocusTimer | undefined;
  let panelDragCandidate = false;
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
      currentTabs = nextState;
      rovingTabId = resolveRovingTabId(nextState.tabs, rovingTabId);
    });
    return unsubscribe;
  });

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

  const runBrowserToolAction = async (action: BrowserToolAction) => {
    try {
      const browserTools = props.browserTools;
      if (!browserTools) {
        throw new Error("FENNEVIA_TOP_BROWSER_TOOLS_UNAVAILABLE");
      }
      props.onDismiss("top");
      await browserTools.invoke(action);
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

  const dismissPanel = () => {
    props.onDismiss(props.edge);
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
    panelDragCandidate = false;
    tabButtons.length = 0;
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
    {#if props.edge !== "top"}
      <header class="fennevia-edge-panel__header">
        <div class="fennevia-edge-panel__identity">
          <span aria-hidden="true" class="fennevia-edge-panel__mark"></span>
          <div>
            <strong>{surfaceLabels[props.edge]}</strong>
            <span
              >{props.windowKind === "private" ? "Private" : "Fennevia"}</span
            >
          </div>
        </div>
        <button
          aria-label={`Hide ${surfaceLabels[props.edge].toLowerCase()}`}
          class="fennevia-control fennevia-edge-panel__dismiss"
          data-fennevia-default-focus={props.edge === "bottom" ? "" : undefined}
          data-fennevia-dismiss={props.edge}
          onclick={dismissPanel}
          title="Hide surface"
          type="button"
        >
          <ShellIcon name="close" />
        </button>
      </header>
    {/if}

    {#if props.edge === "left"}
      <section
        aria-label="Address and site status"
        class="fennevia-address-launcher"
        data-fennevia-address-launcher-region=""
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
          <span class="fennevia-address-launcher__indicators">
            <span
              aria-label={connectionStatus.label}
              class="fennevia-address-launcher__indicator"
              data-fennevia-connection-status=""
              data-fennevia-status-tone={connectionStatus.tone}
              title={connectionStatus.label}>{connectionStatus.badge}</span
            >
            <span
              aria-label={protectionStatus.label}
              class="fennevia-address-launcher__indicator"
              data-fennevia-protection-status=""
              data-fennevia-status-tone={protectionStatus.tone}
              title={protectionStatus.label}>{protectionStatus.badge}</span
            >
          </span>
        </button>
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
          role="tablist"
        >
          {#each currentTabs.tabs as tab, index (tab.id)}
            <div
              class="fennevia-tab-strip__item"
              data-fennevia-loading={tab.loading}
              data-fennevia-pinned={tab.pinned}
              data-fennevia-selected={tab.selected}
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
                onclick={() => selectTab(tab.id)}
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
              </button>

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
        <div
          aria-label="Primary navigation"
          class="fennevia-navigation__controls"
          role="group"
        >
          <button
            aria-label="Go back"
            class="fennevia-control fennevia-navigation__button"
            data-fennevia-action="back"
            disabled={!currentNavigation.snapshot.canGoBack}
            onclick={() =>
              runNavigationAction((navigation) => navigation.back())}
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
            onclick={() =>
              runNavigationAction((navigation) => navigation.forward())}
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
            onclick={() =>
              runNavigationAction((navigation) => navigation.reloadOrStop())}
            title={currentNavigation.snapshot.loading ? "Stop" : "Reload"}
            type="button"
          >
            <ShellIcon
              name={currentNavigation.snapshot.loading ? "stop" : "reload"}
            />
          </button>
        </div>

        <div
          aria-label="Address and site information"
          class="fennevia-top-address-cluster"
          role="group"
        >
          <button
            aria-label="Open address and search"
            class="fennevia-top-address"
            data-fennevia-default-focus=""
            data-fennevia-top-address-launcher=""
            onclick={() => props.onOpenAddress?.()}
            title="Search or enter address"
            type="button"
          >
            <ShellIcon name="address" />
            <output
              aria-label="Current page"
              aria-live="off"
              class="fennevia-navigation__status"
              data-fennevia-navigation-status=""
            >
              <strong dir="auto"
                >{currentNavigation.snapshot.title || "New tab"}</strong
              >
              <span dir="ltr"
                >{currentNavigation.snapshot.displayUri ||
                  "Search or enter address"}</span
              >
            </output>
            <span
              aria-hidden="true"
              class="fennevia-top-address__loading"
              data-fennevia-loading={currentNavigation.snapshot.loading}
            ></span>
          </button>

          <div class="fennevia-top-address__native-status" role="group">
            <button
              aria-label={`Open Firefox site information: ${connectionStatus.label}`}
              class="fennevia-control fennevia-top-address__status"
              data-fennevia-browser-tool="site-information"
              data-fennevia-status-tone={connectionStatus.tone}
              disabled={!browserToolsSnapshot?.siteInformation}
              onclick={() => void runBrowserToolAction("site-information")}
              title={`${connectionStatus.label} — Open Firefox site information`}
              type="button"
            >
              <ShellIcon name="lock" />
              <span>{connectionStatus.badge}</span>
            </button>
            <button
              aria-label={`Open Firefox protection details: ${protectionStatus.label}`}
              class="fennevia-control fennevia-top-address__status"
              data-fennevia-browser-tool="protections"
              data-fennevia-status-tone={protectionStatus.tone}
              disabled={!browserToolsSnapshot?.protections}
              onclick={() => void runBrowserToolAction("protections")}
              title={`${protectionStatus.label} — Open Firefox protection details`}
              type="button"
            >
              <ShellIcon name="shield" />
              <span>{protectionStatus.badge}</span>
            </button>
            <button
              aria-label="Open Firefox site permissions"
              class="fennevia-control fennevia-top-address__status fennevia-top-address__permissions"
              data-fennevia-browser-tool="site-permissions"
              disabled={!browserToolsSnapshot?.sitePermissions}
              onclick={() => void runBrowserToolAction("site-permissions")}
              title="Site permissions"
              type="button"
            >
              <ShellIcon name="permissions" />
            </button>
          </div>
        </div>

        <div
          aria-label="Page and shell actions"
          class="fennevia-navigation__page-actions"
          role="group"
        >
          <button
            aria-label="Open new tab"
            class="fennevia-control fennevia-navigation__button fennevia-navigation__new-tab"
            data-fennevia-action="new-tab"
            onclick={() =>
              runNavigationAction((navigation) => navigation.newTab())}
            title="New tab"
            type="button"
          >
            <ShellIcon name="plus" />
            <span class="fennevia-navigation__new-tab-label">New tab</span>
          </button>
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
            onclick={() => void runBrowserToolAction("downloads")}
            title="Firefox downloads"
            type="button"
          >
            <ShellIcon name="download" />
          </button>
        </div>

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
            onclick={() => void runBrowserToolAction("extensions")}
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
            aria-label="Show original Firefox toolbar"
            class="fennevia-control fennevia-browser-tools__button fennevia-browser-tools__native"
            data-fennevia-browser-tool="native-toolbar"
            disabled={!browserToolsSnapshot?.nativeToolbar}
            onclick={() => void runBrowserToolAction("native-toolbar")}
            title="Original Firefox toolbar"
            type="button"
          >
            <ShellIcon name="toolbar" />
          </button>
          <button
            aria-label="Open Firefox menu"
            class="fennevia-control fennevia-browser-tools__button"
            data-fennevia-browser-tool="application-menu"
            disabled={!browserToolsSnapshot?.applicationMenu}
            onclick={() => void runBrowserToolAction("application-menu")}
            title="Firefox menu"
            type="button"
          >
            <ShellIcon name="menu" />
          </button>
        </div>

        {#if props.windowKind === "private"}
          <span class="fennevia-navigation__private">Private</span>
        {/if}

        <button
          aria-label="Hide browser toolbar"
          class="fennevia-control fennevia-navigation__dismiss"
          data-fennevia-dismiss="top"
          onclick={dismissPanel}
          title="Hide toolbar"
          type="button"
        >
          <ShellIcon name="close" />
        </button>
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
