<!-- SPDX-License-Identifier: MPL-2.0 -->
<script lang="ts">
  import {
    isPopupBrowserToolAction,
    type BrowserToolAction,
    type BrowserToolsStateAdapter,
  } from "../../app/browser-tools-state";
  import type { CustomizeSessionController } from "../../app/customize-session";
  import type { EdgeShellController } from "../../app/edge-surfaces";
  import { translate, type MessageKey, type MessageVars } from "../../app/i18n";
  import type { FenneviaLocale } from "../../app/locale-state";
  import {
    copyNavigationPointerGesture,
    createBrowserNavigationState,
    type BrowserNavigationState,
    type BrowserNavigationStateAdapter,
    type NavigationPointerGesture,
  } from "../../app/navigation-state";
  import type {
    BrowserToolbarWidgetsState,
    BrowserToolbarWidgetsStateAdapter,
  } from "../../app/toolbar-widgets-state";
  import type {
    BrowserWindowControlsStateAdapter,
    WindowControlAction,
    WindowControlsSnapshot,
  } from "../../app/window-controls-state";
  import { resolveBrowserToolHost } from "../browser-tool-host";
  import ToolbarWidgetZone from "../features/toolbar-widgets/ToolbarWidgetZone.svelte";
  import FirefoxIcon from "../FirefoxIcon.svelte";
  import ShellIcon from "../ShellIcon.svelte";

  type Props = Readonly<{
    browserTools?: BrowserToolsStateAdapter;
    customizeOpen: boolean;
    customizeSession?: CustomizeSessionController;
    localeId: FenneviaLocale;
    navigation: BrowserNavigationStateAdapter;
    onDismiss: () => void;
    onFatalError: (error: unknown) => void;
    onSetCustomizeOpen: (open: boolean) => void;
    shell: EdgeShellController;
    toolbarWidgets?: BrowserToolbarWidgetsStateAdapter;
    toolbarWidgetsState: BrowserToolbarWidgetsState | null;
    windowControls: BrowserWindowControlsStateAdapter;
    windowKind: "normal" | "private";
  }>;

  const props: Props = $props();
  const t = (key: MessageKey, vars?: MessageVars): string =>
    translate(props.localeId, key, vars);

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
  let windowControlsSnapshot: WindowControlsSnapshot = $state({
    maximized: false,
  });
  let browserToolsSnapshot = $derived(props.browserTools?.snapshot());

  $effect(() => {
    currentNavigation = props.navigation.snapshot();
    return props.navigation.subscribe((nextState) => {
      currentNavigation = nextState;
    });
  });

  $effect(() => {
    windowControlsSnapshot = props.windowControls.snapshot();
    return props.windowControls.subscribe((nextSnapshot) => {
      windowControlsSnapshot = nextSnapshot;
    });
  });

  const runNavigationAction = (
    action: (navigation: BrowserNavigationStateAdapter) => unknown,
  ) => {
    try {
      action(props.navigation);
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
        props.shell.setPopupHeld("top", true);
        await browserTools.invoke(action, host);
        return;
      }
      props.onDismiss();
      await browserTools.invoke(action);
    } catch (error) {
      if (isPopupBrowserToolAction(action)) {
        props.shell.setPopupHeld("top", false);
        if (!props.browserTools) {
          props.onFatalError(error);
        }
        return;
      }
      props.onFatalError(error);
    }
  };

  const runWindowControlAction = (action: WindowControlAction) => {
    try {
      props.windowControls.invoke(action);
    } catch (error) {
      props.onFatalError(error);
    }
  };
</script>

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
        <FirefoxIcon name="back" />
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
        <FirefoxIcon name="forward" />
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
        <FirefoxIcon
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
        <FirefoxIcon name="home" />
      </button>
    </div>
  </div>

  <ToolbarWidgetZone
    browserTools={props.browserTools}
    customizeOpen={props.customizeOpen}
    customizeSession={props.customizeSession}
    edge="top"
    localeId={props.localeId}
    onDismiss={() => props.onDismiss()}
    onFatalError={props.onFatalError}
    shell={props.shell}
    state={props.toolbarWidgetsState}
    toolbarWidgets={props.toolbarWidgets}
  />

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
        <FirefoxIcon name="extensions" />
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
        <FirefoxIcon name="settings" />
      </button>
      {#if props.toolbarWidgetsState?.snapshot.canEdit}
        <button
          aria-expanded={props.customizeOpen}
          aria-label={t("nav.customizeAria")}
          class="fennevia-control fennevia-browser-tools__button"
          data-fennevia-action="customize-shell"
          onclick={() => props.onSetCustomizeOpen(!props.customizeOpen)}
          title={t("nav.customizeTitle")}
          type="button"
        >
          <FirefoxIcon name="customize" />
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
        <FirefoxIcon name="menu" />
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
