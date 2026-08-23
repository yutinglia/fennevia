// SPDX-License-Identifier: MPL-2.0
import { flushSync, mount, unmount } from "svelte";

import {
  type AddressPopupInvocationSource,
  type AddressPopupSnapshot,
} from "../../app/address-popup";
import {
  createBrowserBookmarksStateAdapter,
  type BrowserBookmarksStateAdapter,
} from "../../app/bookmark-state";
import {
  createBrowserToolsStateAdapter,
  type BrowserToolAction,
  type BrowserToolsStateAdapter,
} from "../../app/browser-tools-state";
import {
  createCustomizeSessionController,
  customizeActiveAttribute,
  type CustomizeSessionController,
} from "../../app/customize-session";
import {
  createBrowserDownloadsStateAdapter,
  type BrowserDownloadsStateAdapter,
} from "../../app/download-state";
import {
  createEdgeShellController,
  edgeInsetCssPixels,
  edgeNames,
  getKeyboardRevealEdge,
  type EdgeName,
} from "../../app/edge-surfaces";
import {
  createBrowserLocaleStateAdapter,
  createStaticLocaleBridge,
  type BrowserLocaleStateAdapter,
} from "../../app/locale-state";
import {
  createBrowserNavigationStateAdapter,
  type BrowserNavigationStateAdapter,
} from "../../app/navigation-state";
import {
  createBrowserTabsStateAdapter,
  type BrowserTabsStateAdapter,
} from "../../app/tab-state";
import {
  createBrowserToolbarWidgetsStateAdapter,
  getSidePanelEdge,
  type BrowserToolbarWidgetsState,
  type BrowserToolbarWidgetsStateAdapter,
  type SidePanelEdge,
} from "../../app/toolbar-widgets-state";
import {
  createBrowserUrlbarCoverageStateAdapter,
  type BrowserUrlbarCoverageStateAdapter,
} from "../../app/urlbar-coverage-state";
import {
  createBrowserUrlbarSuggestionsStateAdapter,
  type BrowserUrlbarSuggestionsStateAdapter,
} from "../../app/urlbar-suggestions-state";
import {
  createBrowserWindowControlsStateAdapter,
  type BrowserWindowControlsStateAdapter,
} from "../../app/window-controls-state";
import AddressPopup from "../AddressPopup.svelte";
import App from "../App.svelte";
import {
  FRAME_ENVIRONMENT_ATTRIBUTE,
  FRAME_READY_ATTRIBUTE,
  KEYBOARD_LISTENER_OPTIONS,
  MOUNT_STATUS_ATTRIBUTE,
  createFrontendError,
  isWindowKind,
  mountedFrames,
  mountedTargets,
  validateMounts,
  type MountOptions,
  type MountedComponent,
} from "./contracts";
import { applyCustomizeStyle, clearCustomizeStyle } from "./customize-style";
import {
  createAddressPopupCoordinator,
  type AddressPopupCoordinator,
} from "./address-popup-coordinator";
import { createSurfaceFocusCoordinator } from "./surface-focus";
import {
  captureWindowDragPosition,
  hasWindowDragMoved,
  resolveWindowDragEdge,
  type WindowDragPosition,
} from "./edge-app-interactions";
import {
  isPointInsideVisibleEdgePanel,
  isPointInsideWindowViewport,
} from "./pointer-geometry";

const WINDOW_DRAG_START_EVENT = "draggableregionleftmousedown";

export function mountShellApp({
  bookmarks,
  browserTools,
  downloads,
  frame,
  locale,
  navigation,
  onFatalError,
  onUnmountError,
  overlayTarget,
  tabs,
  targets,
  toolbarWidgets,
  urlbarCoverage,
  urlbarSuggestions,
  windowControls,
  windowKind,
  isChromeWindowActive,
}: MountOptions): () => boolean {
  if (
    typeof onFatalError !== "function" ||
    typeof onUnmountError !== "function" ||
    !isWindowKind(windowKind)
  ) {
    throw createFrontendError("FENNEVIA_FRONTEND_OPTIONS_INVALID");
  }
  validateMounts(frame, overlayTarget, targets);

  const view = frame.ownerDocument.defaultView;
  const MutationObserverConstructor = view?.MutationObserver;
  if (!view || typeof MutationObserverConstructor !== "function") {
    throw createFrontendError("FENNEVIA_FRONTEND_WINDOW_INVALID");
  }

  let disposed = false;
  let environmentObserver: MutationObserver | undefined;
  let listenersRegistered = false;
  let windowDragCandidate:
    | Readonly<{ edge: EdgeName | null; position: WindowDragPosition }>
    | undefined;
  let addressPopupCoordinator: AddressPopupCoordinator | undefined;
  let bookmarksState: BrowserBookmarksStateAdapter | undefined;
  let browserToolsState: BrowserToolsStateAdapter | undefined;
  let customizeSession: CustomizeSessionController | undefined;
  let downloadsState: BrowserDownloadsStateAdapter | undefined;
  let localeState: BrowserLocaleStateAdapter | undefined;
  let navigationState: BrowserNavigationStateAdapter | undefined;
  let tabsState: BrowserTabsStateAdapter | undefined;
  let toolbarWidgetsState: BrowserToolbarWidgetsStateAdapter | undefined;
  let urlbarCoverageState: BrowserUrlbarCoverageStateAdapter | undefined;
  let urlbarSuggestionsState: BrowserUrlbarSuggestionsStateAdapter | undefined;
  let windowControlsState: BrowserWindowControlsStateAdapter | undefined;
  let tabsEdge: SidePanelEdge = "left";
  let bookmarksEdge: SidePanelEdge = "right";
  let bottomDownloadsEnabled = true;
  let tabContextMenuEdge: SidePanelEdge | null = null;
  const components: MountedComponent[] = [];
  const controllerSubscriptions: Array<() => boolean> = [];
  const scheduler = Object.freeze({
    clearTimeout(handle: unknown) {
      view.clearTimeout(handle as number);
    },
    setTimeout(callback: () => void, delayMs: number) {
      return view.setTimeout(callback, delayMs);
    },
  });
  const shell = createEdgeShellController({
    onError: onFatalError,
    scheduler,
  });
  customizeSession = createCustomizeSessionController({
    frame,
    onError: onFatalError,
    shell,
  });

  const surfaceFocus = createSurfaceFocusCoordinator({ frame, targets });
  const {
    activeElementFor,
    discardFocusOrigin,
    focusCustomizeToggle,
    focusSurface,
    restoreFocus,
  } = surfaceFocus;

  const releaseSurfaceFocusIfActive = (edge: EdgeName): void => {
    if (activeElementFor(edge)) {
      restoreFocus(edge);
      return;
    }
    discardFocusOrigin(edge);
  };

  const closeCustomizeSession = (): boolean => {
    if (!customizeSession?.isOpen()) {
      return false;
    }
    return customizeSession.setOpen(false);
  };

  const dismissSurface = (edge: EdgeName): void => {
    restoreFocus(edge);
    shell.dismiss(edge);
  };

  const addressPopupIsVisible = (snapshot?: AddressPopupSnapshot): boolean =>
    addressPopupCoordinator?.isVisible(snapshot) ?? false;

  const openNativeUrlbar = (): boolean =>
    addressPopupCoordinator?.openNativeUrlbar() ?? false;

  const openAddressPopup = (source: AddressPopupInvocationSource): boolean =>
    addressPopupCoordinator?.open(source) ?? false;

  const openNativeBrowserTool = async (
    action: BrowserToolAction,
    host?: unknown,
  ): Promise<boolean> => {
    if (!browserToolsState) {
      return false;
    }
    return browserToolsState.invoke(action, host);
  };

  const syncEnvironment = (): void => {
    if (disposed) {
      return;
    }
    const shouldEnable =
      frame.getAttribute(FRAME_ENVIRONMENT_ATTRIBUTE) === "normal";
    if (!shouldEnable && addressPopupIsVisible()) {
      addressPopupCoordinator?.closeForEnvironment();
    }
    if (!shouldEnable) {
      closeCustomizeSession();
    }
    if (shell.snapshot().enabled !== shouldEnable) {
      for (const edge of edgeNames) {
        restoreFocus(edge);
      }
      shell.setEnabled(shouldEnable);
    }
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (
      disposed ||
      event.defaultPrevented ||
      frame.getAttribute(FRAME_ENVIRONMENT_ATTRIBUTE) !== "normal"
    ) {
      return;
    }
    try {
      const revealEdge = getKeyboardRevealEdge(event);
      if (addressPopupIsVisible()) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          addressPopupCoordinator?.controller.requestClose("cancelled");
        } else if (revealEdge) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (revealEdge) {
        if (!shell.snapshot().surfaces[revealEdge].enabled) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        shell.revealFromKeyboard(revealEdge);
        focusSurface(revealEdge);
        return;
      }
      if (event.key !== "Escape") {
        return;
      }
      if (customizeSession?.isOpen()) {
        event.preventDefault();
        event.stopPropagation();
        closeCustomizeSession();
        focusCustomizeToggle();
        return;
      }

      const snapshot = shell.snapshot();
      const focusedEdge = edgeNames.find((edge) => activeElementFor(edge));
      const target =
        focusedEdge ??
        (snapshot.activeEdge && snapshot.surfaces[snapshot.activeEdge].visible
          ? snapshot.activeEdge
          : null);
      if (!target) {
        return;
      }
      if (snapshot.surfaces[target].holds.popup) {
        return;
      }
      event.preventDefault();
      restoreFocus(target);
      shell.dismiss(target);
    } catch (error) {
      onFatalError(error);
    }
  };

  const releaseWindowPointer = (): void => {
    if (disposed) {
      return;
    }
    for (const edge of edgeNames) {
      shell.releasePointer(edge, "outside-window");
    }
  };

  const beginWindowDrag = (event: Event): void => {
    if (disposed) {
      return;
    }
    const snapshot = shell.snapshot();
    const edge =
      resolveWindowDragEdge(event.target) ??
      edgeNames.find(
        (candidate) => snapshot.surfaces[candidate].holds.pointer,
      ) ??
      null;
    windowDragCandidate = Object.freeze({
      edge,
      position: captureWindowDragPosition(event, view),
    });
    shell.setWindowDragActive(true, edge ?? undefined);
  };

  const releaseWindowDrag = (event?: Event, cancelled = false): void => {
    if (disposed) {
      return;
    }
    const candidate = windowDragCandidate;
    windowDragCandidate = undefined;
    shell.setWindowDragActive(false);
    if (
      candidate &&
      candidate.edge &&
      !cancelled &&
      !hasWindowDragMoved(
        candidate.position,
        captureWindowDragPosition(event, view),
      )
    ) {
      shell.releasePointer(candidate.edge, "inside-window");
    }
  };

  const cancelWindowDrag = (event: Event): void => {
    releaseWindowDrag(event, true);
  };

  const releaseWindowInteraction = (): void => {
    releaseWindowDrag();
    if (typeof isChromeWindowActive === "function" && isChromeWindowActive()) {
      return;
    }
    releaseWindowPointer();
  };

  const onPointerOut = (event: PointerEvent): void => {
    if (event.relatedTarget !== null) {
      return;
    }
    if (
      isPointInsideWindowViewport(view, event.clientX, event.clientY) &&
      isPointInsideVisibleEdgePanel(frame, event.clientX, event.clientY)
    ) {
      return;
    }
    releaseWindowPointer();
  };

  const removeDomListeners = (): void => {
    if (!listenersRegistered) {
      return;
    }
    listenersRegistered = false;
    view.removeEventListener(WINDOW_DRAG_START_EVENT, beginWindowDrag);
    view.removeEventListener("keydown", onKeyDown, KEYBOARD_LISTENER_OPTIONS);
    view.removeEventListener("mouseup", releaseWindowDrag);
    view.removeEventListener("pointerout", onPointerOut);
    view.removeEventListener("pointercancel", cancelWindowDrag);
    view.removeEventListener("pointerup", releaseWindowDrag);
    view.removeEventListener("blur", releaseWindowInteraction);
    frame.removeEventListener("focusin", surfaceFocus.onFrameFocusIn);
  };

  const disposeMountedState = (): unknown => {
    let firstError: unknown;
    environmentObserver?.disconnect();
    environmentObserver = undefined;
    removeDomListeners();
    clearCustomizeStyle(frame);
    frame.removeAttribute(FRAME_READY_ATTRIBUTE);
    for (const unsubscribe of controllerSubscriptions.splice(0).reverse()) {
      try {
        unsubscribe();
      } catch (error) {
        firstError ??= error;
      }
    }
    for (const mounted of components.splice(0).reverse()) {
      let unmountResult: Promise<void> | undefined;
      try {
        unmountResult = unmount(mounted.component, { outro: false });
        flushSync();
      } catch (error) {
        firstError ??= error;
      }
      void unmountResult?.catch(onUnmountError);
      mountedTargets.delete(mounted.target);
      mounted.target.setAttribute(MOUNT_STATUS_ATTRIBUTE, "disposed");
      if (mounted.target.childNodes.length !== 0) {
        firstError ??= createFrontendError(
          "FENNEVIA_FRONTEND_UNMOUNT_INCOMPLETE",
        );
      }
    }
    mountedFrames.delete(frame);
    try {
      customizeSession?.dispose();
    } catch (error) {
      firstError ??= error;
    }
    customizeSession = undefined;
    try {
      addressPopupCoordinator?.dispose();
    } catch (error) {
      firstError ??= error;
    }
    addressPopupCoordinator = undefined;
    try {
      bookmarksState?.dispose();
    } catch (error) {
      firstError ??= error;
    }
    try {
      browserToolsState?.dispose();
    } catch (error) {
      firstError ??= error;
    }
    try {
      downloadsState?.dispose();
    } catch (error) {
      firstError ??= error;
    }
    try {
      toolbarWidgetsState?.dispose();
    } catch (error) {
      firstError ??= error;
    }
    try {
      urlbarSuggestionsState?.dispose();
    } catch (error) {
      firstError ??= error;
    }
    try {
      urlbarCoverageState?.dispose();
    } catch (error) {
      firstError ??= error;
    }
    try {
      windowControlsState?.dispose();
    } catch (error) {
      firstError ??= error;
    }
    try {
      localeState?.dispose();
    } catch (error) {
      firstError ??= error;
    }
    try {
      navigationState?.dispose();
    } catch (error) {
      firstError ??= error;
    }
    try {
      tabsState?.dispose();
    } catch (error) {
      firstError ??= error;
    }
    try {
      shell.dispose();
    } catch (error) {
      firstError ??= error;
    }
    for (const edge of edgeNames) {
      frame.removeAttribute(`data-fennevia-${edge}-visible`);
    }
    frame.removeAttribute("data-fennevia-address-popup-visible");
    frame.removeAttribute(customizeActiveAttribute);
    surfaceFocus.clear();
    return firstError;
  };

  for (const edge of edgeNames) {
    targets[edge].setAttribute(MOUNT_STATUS_ATTRIBUTE, "mounting");
  }
  overlayTarget.setAttribute(MOUNT_STATUS_ATTRIBUTE, "mounting");

  try {
    tabsState = createBrowserTabsStateAdapter(tabs);
    navigationState = createBrowserNavigationStateAdapter(navigation);
    bookmarksState = createBrowserBookmarksStateAdapter(bookmarks);
    browserToolsState = createBrowserToolsStateAdapter(browserTools);
    downloadsState = createBrowserDownloadsStateAdapter(downloads);
    toolbarWidgetsState = toolbarWidgets
      ? createBrowserToolbarWidgetsStateAdapter(toolbarWidgets)
      : undefined;
    urlbarCoverageState =
      createBrowserUrlbarCoverageStateAdapter(urlbarCoverage);
    urlbarSuggestionsState =
      createBrowserUrlbarSuggestionsStateAdapter(urlbarSuggestions);
    windowControlsState =
      createBrowserWindowControlsStateAdapter(windowControls);
    localeState = createBrowserLocaleStateAdapter(
      locale ?? createStaticLocaleBridge(),
    );
    const applyFrameLocale = () => {
      const id = localeState?.snapshot().id ?? "en";
      frame.setAttribute("lang", id);
    };
    applyFrameLocale();
    controllerSubscriptions.push(
      localeState.subscribe(() => {
        applyFrameLocale();
      }),
    );
    addressPopupCoordinator = createAddressPopupCoordinator({
      closeCustomizeSession,
      frame,
      navigation: navigationState,
      onFatalError,
      overlayTarget,
      shell,
      tabs: tabsState,
      targets,
      urlbarCoverage: urlbarCoverageState,
      urlbarSuggestions: urlbarSuggestionsState,
      view,
    });
    const addressPopup = addressPopupCoordinator.controller;
    controllerSubscriptions.push(
      addressPopup.subscribe((snapshot) => {
        frame.toggleAttribute(
          "data-fennevia-address-popup-visible",
          addressPopupIsVisible(snapshot),
        );
        addressPopupCoordinator?.scheduleClose(snapshot);
      }),
      navigationState.subscribeAddressPopupOpen((request) => {
        return openAddressPopup(request.source);
      }),
      tabsState.subscribeContextMenu((open) => {
        if (open) {
          tabContextMenuEdge = tabsEdge;
          shell.setPopupHeld(tabContextMenuEdge, true);
          return;
        }
        if (tabContextMenuEdge) {
          shell.setPopupHeld(tabContextMenuEdge, false);
          tabContextMenuEdge = null;
        }
      }),
      browserToolsState.subscribePopup((open) => {
        if (open) {
          return;
        }
        if (customizeSession?.isOpen()) {
          customizeSession.restoreHolds();
          return;
        }
        for (const edge of edgeNames) {
          shell.setPopupHeld(edge, false);
        }
      }),
    );
    if (toolbarWidgetsState) {
      const widgetsState = toolbarWidgetsState;
      const forcedColorsQuery =
        typeof view.matchMedia === "function"
          ? view.matchMedia("(forced-colors: active)")
          : null;
      const reducedMotionQuery =
        typeof view.matchMedia === "function"
          ? view.matchMedia("(prefers-reduced-motion: reduce)")
          : null;
      const applyCustomizeState = (state: BrowserToolbarWidgetsState): void => {
        const nextTabsEdge = getSidePanelEdge(state.snapshot.panels, "tabs");
        const nextBookmarksEdge = getSidePanelEdge(
          state.snapshot.panels,
          "bookmarks",
        );
        if (nextTabsEdge !== tabsEdge || nextBookmarksEdge !== bookmarksEdge) {
          releaseSurfaceFocusIfActive("left");
          releaseSurfaceFocusIfActive("right");
          shell.dismiss("left");
          shell.dismiss("right");
          if (tabContextMenuEdge) {
            shell.setPopupHeld(tabContextMenuEdge, false);
            tabContextMenuEdge = nextTabsEdge;
            shell.setPopupHeld(tabContextMenuEdge, true);
          }
          tabsEdge = nextTabsEdge;
          bookmarksEdge = nextBookmarksEdge;
        }
        const nextBottomEnabled = state.snapshot.panels.bottomDownloadsEnabled;
        if (bottomDownloadsEnabled !== nextBottomEnabled) {
          if (!nextBottomEnabled) {
            releaseSurfaceFocusIfActive("bottom");
          }
          bottomDownloadsEnabled = nextBottomEnabled;
          shell.setEdgeEnabled("bottom", nextBottomEnabled);
        }
        shell.setInteractionConfig({
          hideDelayMs: state.snapshot.style.autoHideDelay,
          programmaticRevealMs: state.snapshot.style.temporaryRevealDuration,
          triggerThicknessCssPixels: state.snapshot.style.edgeTriggerSize,
          windowLeaveHideDelayMs: state.snapshot.style.windowLeaveHideDelay,
        });
        applyCustomizeStyle(frame, state.snapshot.style, {
          forcedColors: forcedColorsQuery?.matches === true,
          reducedMotion: reducedMotionQuery?.matches === true,
        });
        if (customizeSession?.isOpen()) {
          customizeSession.restoreHolds();
        }
      };
      applyCustomizeState(widgetsState.snapshot());
      controllerSubscriptions.push(
        widgetsState.subscribePopup((open) => {
          if (open) {
            return;
          }
          if (customizeSession?.isOpen()) {
            customizeSession.restoreHolds();
            return;
          }
          shell.setPopupHeld("top", false);
        }),
        widgetsState.subscribe(applyCustomizeState),
      );
      const mediaQueries = [forcedColorsQuery, reducedMotionQuery].filter(
        (query): query is MediaQueryList => query !== null,
      );
      if (mediaQueries.length > 0) {
        const onMediaChange = (): void => {
          try {
            applyCustomizeState(widgetsState.snapshot());
          } catch (error) {
            onFatalError(error);
          }
        };
        for (const query of mediaQueries) {
          query.addEventListener("change", onMediaChange);
        }
        controllerSubscriptions.push(() => {
          for (const query of mediaQueries) {
            query.removeEventListener("change", onMediaChange);
          }
          return true;
        });
      }
    }
    for (const edge of edgeNames) {
      const surface = shell.getSurface(edge);
      controllerSubscriptions.push(
        surface.subscribe((snapshot) => {
          frame.toggleAttribute(
            `data-fennevia-${edge}-visible`,
            snapshot.visible,
          );
          if (!snapshot.visible && !addressPopupIsVisible()) {
            restoreFocus(edge);
          }
        }),
      );
    }
    syncEnvironment();

    for (const edge of edgeNames) {
      const target = targets[edge];
      const component = mount(App, {
        props: {
          edge,
          frame,
          browserTools: browserToolsState,
          addressPopup,
          bookmarks: bookmarksState,
          downloads: downloadsState,
          navigation: navigationState,
          onOpenAddress: () => openAddressPopup("tabs-launcher"),
          tabs: tabsState,
          ...(edge === "top"
            ? {
                windowControls: windowControlsState,
              }
            : {}),
          onDismiss: dismissSurface,
          onFatalError,
          onDisposed(disposedEdge: EdgeName) {
            targets[disposedEdge].setAttribute(
              MOUNT_STATUS_ATTRIBUTE,
              "disposed",
            );
          },
          shell,
          surface: shell.getSurface(edge),
          customizeSession,
          locale: localeState,
          toolbarWidgets: toolbarWidgetsState,
          windowKind,
        },
        target,
      }) as Record<string, unknown>;
      components.push(Object.freeze({ component, name: edge, target }));
      mountedTargets.add(target);
      target.setAttribute(MOUNT_STATUS_ATTRIBUTE, "mounted");
    }

    const addressPopupComponent = mount(AddressPopup, {
      props: {
        browserTools: browserToolsState,
        coverage: urlbarCoverageState,
        navigation: navigationState,
        onOpenBrowserTool: openNativeBrowserTool,
        onOpenNativeUrlbar: openNativeUrlbar,
        onDisposed() {
          overlayTarget.setAttribute(MOUNT_STATUS_ATTRIBUTE, "disposed");
        },
        onFatalError,
        locale: localeState,
        popup: addressPopup,
        suggestions: urlbarSuggestionsState,
        windowKind,
      },
      target: overlayTarget,
    }) as Record<string, unknown>;
    components.push(
      Object.freeze({
        component: addressPopupComponent,
        name: "address-popup",
        target: overlayTarget,
      }),
    );
    mountedTargets.add(overlayTarget);
    overlayTarget.setAttribute(MOUNT_STATUS_ATTRIBUTE, "mounted");
    flushSync();

    environmentObserver = new MutationObserverConstructor(() => {
      try {
        syncEnvironment();
      } catch (error) {
        onFatalError(error);
      }
    });
    environmentObserver.observe(frame, {
      attributes: true,
      attributeFilter: [FRAME_ENVIRONMENT_ATTRIBUTE],
    });
    view.addEventListener(WINDOW_DRAG_START_EVENT, beginWindowDrag);
    view.addEventListener("keydown", onKeyDown, KEYBOARD_LISTENER_OPTIONS);
    view.addEventListener("mouseup", releaseWindowDrag);
    view.addEventListener("pointerout", onPointerOut);
    view.addEventListener("pointercancel", cancelWindowDrag);
    view.addEventListener("pointerup", releaseWindowDrag);
    view.addEventListener("blur", releaseWindowInteraction);
    frame.addEventListener("focusin", surfaceFocus.onFrameFocusIn);
    listenersRegistered = true;
    frame.style.setProperty("--fennevia-edge-inset", `${edgeInsetCssPixels}px`);
    frame.setAttribute(FRAME_READY_ATTRIBUTE, "");

    const record = Object.freeze({
      addressPopup,
      bookmarks: bookmarksState,
      browserTools: browserToolsState,
      components: Object.freeze([...components]),
      downloads: downloadsState,
      locale: localeState,
      navigation: navigationState,
      shell,
      tabs: tabsState,
      toolbarWidgets: toolbarWidgetsState,
      urlbarCoverage: urlbarCoverageState,
      urlbarSuggestions: urlbarSuggestionsState,
      windowControls: windowControlsState,
    });
    mountedFrames.set(frame, record);

    return () => {
      if (disposed) {
        return false;
      }
      disposed = true;
      const firstError = disposeMountedState();
      if (firstError !== undefined) {
        throw firstError;
      }
      return true;
    };
  } catch (error) {
    disposed = true;
    const cleanupError = disposeMountedState();
    for (const edge of edgeNames) {
      targets[edge].replaceChildren();
      targets[edge].setAttribute(MOUNT_STATUS_ATTRIBUTE, "failed");
    }
    overlayTarget.replaceChildren();
    overlayTarget.setAttribute(MOUNT_STATUS_ATTRIBUTE, "failed");
    if (cleanupError !== undefined) {
      onUnmountError(cleanupError);
    }
    throw error;
  }
}
