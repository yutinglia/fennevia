import { flushSync, mount, unmount } from "svelte";

import {
  createEdgeShellController,
  edgeNames,
  edgeSurfaceTiming,
  edgeTriggerThicknessCssPixels,
  getKeyboardRevealEdge,
  type EdgeName,
  type EdgeShellController,
} from "../app/edge-surfaces";
import {
  createBrowserNavigationStateAdapter,
  type BrowserNavigationBridge,
  type BrowserNavigationStateAdapter,
} from "../app/navigation-state";
import {
  createBrowserTabsStateAdapter,
  type BrowserTabsBridge,
  type BrowserTabsStateAdapter,
} from "../app/tab-state";
import App from "./App.svelte";
import "./styles/edge-shell.css";

const XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const MOUNT_STATUS_ATTRIBUTE = "data-fennevia-framework-status";
const FRAME_READY_ATTRIBUTE = "data-fennevia-frontend-ready";
const FRAME_ENVIRONMENT_ATTRIBUTE = "data-fennevia-environment";
const ROOT_SELECTOR = "[data-fennevia-surface-root]";
const KEYBOARD_LISTENER_OPTIONS = Object.freeze({ capture: false });

const targetIds: Readonly<Record<EdgeName, string>> = Object.freeze({
  top: "fennevia-shell-top-mount",
  left: "fennevia-shell-left-mount",
  right: "fennevia-shell-right-mount",
  bottom: "fennevia-shell-bottom-mount",
});

export type ShellWindowKind = "normal" | "private";
export type EdgeMountTargets = Readonly<Record<EdgeName, Element>>;

type MountOptions = Readonly<{
  frame: HTMLElement;
  navigation: BrowserNavigationBridge;
  onFatalError: (error: unknown) => void;
  onUnmountError: (error: unknown) => void;
  tabs: BrowserTabsBridge;
  targets: EdgeMountTargets;
  windowKind: ShellWindowKind;
}>;

type HealthOptions = Readonly<{
  frame: HTMLElement;
  targets: EdgeMountTargets;
  windowKind: ShellWindowKind;
}>;

type MountedComponent = Readonly<{
  component: Record<string, unknown>;
  edge: EdgeName;
  target: Element;
}>;

type MountedShell = Readonly<{
  components: readonly MountedComponent[];
  navigation: BrowserNavigationStateAdapter;
  shell: EdgeShellController;
  tabs: BrowserTabsStateAdapter;
}>;

type FocusableElement = Element &
  Readonly<{
    blur?: () => void;
    focus: (options?: FocusOptions) => void;
  }>;

const mountedFrames = new WeakMap<Element, MountedShell>();
const mountedTargets = new WeakSet<Element>();

function createFrontendError(code: string): Error {
  const error = new Error(code);
  error.name = "FenneviaFrontendError";
  Object.defineProperties(error, {
    fenneviaCode: { enumerable: false, value: code },
    fenneviaPhase: { enumerable: false, value: "shell-frontend" },
  });
  return error;
}

function isWindowKind(value: string): value is ShellWindowKind {
  return value === "normal" || value === "private";
}

function validateMounts(frame: HTMLElement, targets: EdgeMountTargets): void {
  if (
    frame.namespaceURI !== XHTML_NAMESPACE ||
    frame.id !== "fennevia-shell-frame-host" ||
    mountedFrames.has(frame)
  ) {
    throw createFrontendError("FENNEVIA_FRONTEND_FRAME_INVALID");
  }

  const values = edgeNames.map((edge) => targets?.[edge]);
  const edgeHosts = Array.from(frame.children).filter((element) =>
    element.hasAttribute("data-fennevia-edge-host"),
  );
  if (new Set(values).size !== edgeNames.length) {
    throw createFrontendError("FENNEVIA_FRONTEND_TARGET_INVALID");
  }
  for (const [index, edge] of edgeNames.entries()) {
    const target = targets[edge];
    const host = target?.parentElement;
    if (
      target?.namespaceURI !== XHTML_NAMESPACE ||
      target.id !== targetIds[edge] ||
      target.childNodes.length !== 0 ||
      mountedTargets.has(target) ||
      host?.parentElement !== frame ||
      host.getAttribute("data-fennevia-edge-host") !== edge ||
      edgeHosts.indexOf(host) !== index
    ) {
      throw createFrontendError("FENNEVIA_FRONTEND_TARGET_INVALID");
    }
  }
}

function getFocusableOrigin(
  value: EventTarget | null,
): FocusableElement | null {
  return value instanceof Element &&
    typeof (value as Partial<FocusableElement>).focus === "function"
    ? (value as FocusableElement)
    : null;
}

export function mountShellApp({
  frame,
  navigation,
  onFatalError,
  onUnmountError,
  tabs,
  targets,
  windowKind,
}: MountOptions): () => boolean {
  if (
    typeof onFatalError !== "function" ||
    typeof onUnmountError !== "function" ||
    !isWindowKind(windowKind)
  ) {
    throw createFrontendError("FENNEVIA_FRONTEND_OPTIONS_INVALID");
  }
  validateMounts(frame, targets);

  const view = frame.ownerDocument.defaultView;
  const MutationObserverConstructor = view?.MutationObserver;
  if (!view || typeof MutationObserverConstructor !== "function") {
    throw createFrontendError("FENNEVIA_FRONTEND_WINDOW_INVALID");
  }

  let disposed = false;
  let environmentObserver: MutationObserver | undefined;
  let listenersRegistered = false;
  let navigationState: BrowserNavigationStateAdapter | undefined;
  let tabsState: BrowserTabsStateAdapter | undefined;
  const components: MountedComponent[] = [];
  const controllerSubscriptions: Array<() => boolean> = [];
  const focusOrigins = new Map<EdgeName, FocusableElement>();
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

  const activeElementFor = (edge: EdgeName): FocusableElement | null => {
    const active = getFocusableOrigin(frame.ownerDocument.activeElement);
    return active && targets[edge].contains(active) ? active : null;
  };

  const restoreFocus = (edge: EdgeName): void => {
    const active = activeElementFor(edge);
    const origin = focusOrigins.get(edge);
    focusOrigins.delete(edge);
    if (origin?.isConnected && !frame.contains(origin)) {
      origin.focus({ preventScroll: true });
    } else {
      active?.blur?.();
    }
  };

  const focusSurface = (edge: EdgeName): void => {
    const active = getFocusableOrigin(frame.ownerDocument.activeElement);
    if (active && !frame.contains(active)) {
      focusOrigins.set(edge, active);
    } else {
      const focusedEdge = active
        ? edgeNames.find((candidate) => targets[candidate].contains(active))
        : undefined;
      const priorOrigin = focusedEdge
        ? focusOrigins.get(focusedEdge)
        : edgeNames
            .map((candidate) => focusOrigins.get(candidate))
            .find(
              (candidate) =>
                candidate?.isConnected && !frame.contains(candidate),
            );
      if (priorOrigin) {
        focusOrigins.set(edge, priorOrigin);
      }
      if (focusedEdge && focusedEdge !== edge) {
        focusOrigins.delete(focusedEdge);
      }
    }
    flushSync();
    const focusTarget = targets[edge].querySelector<HTMLElement>(
      "[data-fennevia-default-focus]",
    );
    if (!focusTarget) {
      throw createFrontendError("FENNEVIA_EDGE_FOCUS_TARGET_MISSING");
    }
    focusTarget.focus({ preventScroll: true });
  };

  const dismissSurface = (edge: EdgeName): void => {
    restoreFocus(edge);
    shell.dismiss(edge);
  };

  const syncEnvironment = (): void => {
    if (disposed) {
      return;
    }
    const shouldEnable =
      frame.getAttribute(FRAME_ENVIRONMENT_ATTRIBUTE) === "normal";
    if (shell.snapshot().enabled !== shouldEnable) {
      for (const edge of edgeNames) {
        restoreFocus(edge);
      }
      shell.setEnabled(shouldEnable);
    }
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (disposed || event.defaultPrevented) {
      return;
    }
    try {
      const revealEdge = getKeyboardRevealEdge(event);
      if (revealEdge) {
        event.preventDefault();
        event.stopPropagation();
        shell.revealFromKeyboard(revealEdge);
        focusSurface(revealEdge);
        return;
      }
      if (event.key !== "Escape") {
        return;
      }

      const snapshot = shell.snapshot();
      const focusedEdge = edgeNames.find((edge) => activeElementFor(edge));
      const target =
        focusedEdge ??
        (snapshot.activeEdge && snapshot.surfaces[snapshot.activeEdge].visible
          ? snapshot.activeEdge
          : null);
      if (!target || snapshot.surfaces[target].holds.popup) {
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
      shell.setPointerHeld(edge, false);
    }
  };

  const onPointerOut = (event: PointerEvent): void => {
    if (event.relatedTarget === null) {
      releaseWindowPointer();
    }
  };

  const onFrameFocusIn = (event: FocusEvent): void => {
    const origin = getFocusableOrigin(event.relatedTarget);
    if (!origin || frame.contains(origin)) {
      return;
    }
    const edge = edgeNames.find((candidate) =>
      targets[candidate].contains(event.target as Node),
    );
    if (edge) {
      focusOrigins.set(edge, origin);
    }
  };

  const removeDomListeners = (): void => {
    if (!listenersRegistered) {
      return;
    }
    listenersRegistered = false;
    view.removeEventListener("keydown", onKeyDown, KEYBOARD_LISTENER_OPTIONS);
    view.removeEventListener("pointerout", onPointerOut);
    view.removeEventListener("blur", releaseWindowPointer);
    frame.removeEventListener("focusin", onFrameFocusIn);
  };

  const disposeMountedState = (): unknown => {
    let firstError: unknown;
    environmentObserver?.disconnect();
    environmentObserver = undefined;
    removeDomListeners();
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
    focusOrigins.clear();
    return firstError;
  };

  for (const edge of edgeNames) {
    targets[edge].setAttribute(MOUNT_STATUS_ATTRIBUTE, "mounting");
  }

  try {
    tabsState = createBrowserTabsStateAdapter(tabs);
    navigationState = createBrowserNavigationStateAdapter(navigation);
    for (const edge of edgeNames) {
      const surface = shell.getSurface(edge);
      controllerSubscriptions.push(
        surface.subscribe((snapshot) => {
          frame.toggleAttribute(
            `data-fennevia-${edge}-visible`,
            snapshot.visible,
          );
          if (!snapshot.visible) {
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
          ...(edge === "top" ? { navigation: navigationState } : {}),
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
          ...(edge === "left" ? { tabs: tabsState } : {}),
          windowKind,
        },
        target,
      }) as Record<string, unknown>;
      components.push(Object.freeze({ component, edge, target }));
      mountedTargets.add(target);
      target.setAttribute(MOUNT_STATUS_ATTRIBUTE, "mounted");
    }
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
    view.addEventListener("keydown", onKeyDown, KEYBOARD_LISTENER_OPTIONS);
    view.addEventListener("pointerout", onPointerOut);
    view.addEventListener("blur", releaseWindowPointer);
    frame.addEventListener("focusin", onFrameFocusIn);
    listenersRegistered = true;
    frame.style.setProperty(
      "--fennevia-hide-delay",
      `${edgeSurfaceTiming.hideDelayMs}ms`,
    );
    frame.style.setProperty(
      "--fennevia-edge-trigger-thickness",
      `${edgeTriggerThicknessCssPixels}px`,
    );
    frame.setAttribute(FRAME_READY_ATTRIBUTE, "");

    const record = Object.freeze({
      components: Object.freeze([...components]),
      navigation: navigationState,
      shell,
      tabs: tabsState,
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
    if (cleanupError !== undefined) {
      onUnmountError(cleanupError);
    }
    throw error;
  }
}

export function verifyShellAppHealth({
  frame,
  targets,
  windowKind,
}: HealthOptions): true {
  const mounted = mountedFrames.get(frame);
  const roots = edgeNames.map((edge) =>
    targets[edge].querySelector<HTMLElement>(
      `#fennevia-shell-${edge}-root${ROOT_SELECTOR}`,
    ),
  );
  const topRoot = roots[edgeNames.indexOf("top")];
  const leftRoot = roots[edgeNames.indexOf("left")];
  const template = topRoot?.querySelector<HTMLTemplateElement>(
    "template[data-fennevia-template]",
  );
  const templateConstructor =
    frame.ownerDocument.defaultView?.HTMLTemplateElement;
  const requiredLeftSelectors = [
    '[role="tablist"][aria-orientation="vertical"][data-fennevia-tab-list]',
    'button[role="tab"][data-fennevia-tab]',
    'button[data-fennevia-action="new-tab"]',
    "output[data-fennevia-tab-count]",
  ];
  const requiredTopSelectors = [
    'button[data-fennevia-action="back"]',
    'button[data-fennevia-action="forward"]',
    'button[data-fennevia-action="reload-stop"]',
    'button[data-fennevia-action="new-tab"]',
    "output[data-fennevia-navigation-status]",
  ];

  if (
    frame.getAttribute(FRAME_READY_ATTRIBUTE) !== "" ||
    !mounted ||
    mounted.components.length !== edgeNames.length ||
    mounted.navigation.status().disposed ||
    mounted.tabs.status().disposed ||
    roots.some((root, index) => {
      const edge = edgeNames[index];
      return (
        !root ||
        root.parentElement !== targets[edge] ||
        root.namespaceURI !== XHTML_NAMESPACE ||
        root.getAttribute("data-fennevia-edge") !== edge ||
        root.getAttribute("data-fennevia-window-kind") !== windowKind ||
        root.querySelector(`[data-fennevia-edge-trigger="${edge}"]`) === null ||
        root.querySelector(
          `[role="region"][data-fennevia-edge-panel="${edge}"]`,
        ) === null ||
        root.querySelector(`[data-fennevia-dismiss="${edge}"]`) === null ||
        Array.from(root.querySelectorAll("*")).some(
          (element) => element.namespaceURI !== XHTML_NAMESPACE,
        )
      );
    }) ||
    edgeNames.some(
      (edge) =>
        targets[edge].getAttribute(MOUNT_STATUS_ATTRIBUTE) !== "mounted",
    ) ||
    !leftRoot ||
    requiredLeftSelectors.some(
      (selector) => !leftRoot.querySelector(selector),
    ) ||
    !topRoot ||
    requiredTopSelectors.some((selector) => !topRoot.querySelector(selector)) ||
    !template ||
    typeof templateConstructor !== "function" ||
    !(template instanceof templateConstructor) ||
    template.content.firstElementChild?.namespaceURI !== XHTML_NAMESPACE
  ) {
    throw createFrontendError("FENNEVIA_FRONTEND_HEALTH_INVALID");
  }
  return true;
}

export function getShellAppCapabilities({
  frame,
  targets,
  windowKind,
}: HealthOptions): ReadonlyArray<
  Readonly<{ available: boolean; name: string }>
> {
  const mounted = mountedFrames.get(frame);
  const snapshot = mounted?.shell.snapshot();
  return Object.freeze([
    Object.freeze({
      available:
        frame.getAttribute(FRAME_READY_ATTRIBUTE) === "" &&
        edgeNames.every(
          (edge) =>
            targets[edge].querySelector(
              `#fennevia-shell-${edge}-root${ROOT_SELECTOR}`,
            ) !== null,
        ),
      name: "frontend.svelte-four-roots",
    }),
    Object.freeze({
      available: Boolean(
        snapshot &&
        edgeNames.every(
          (edge) =>
            snapshot.surfaces[edge].phase === "hidden" ||
            snapshot.surfaces[edge].phase === "disabled",
        ),
      ),
      name: "frontend.edge-controller",
    }),
    Object.freeze({
      available:
        frame.getAttribute(FRAME_ENVIRONMENT_ATTRIBUTE) !== null &&
        snapshot?.enabled ===
          (frame.getAttribute(FRAME_ENVIRONMENT_ATTRIBUTE) === "normal"),
      name: "frontend.edge-environment",
    }),
    Object.freeze({
      available: isWindowKind(windowKind),
      name: "frontend.per-window-state",
    }),
    Object.freeze({
      available: Boolean(mounted && !mounted.tabs.status().disposed),
      name: "frontend.tabs-state",
    }),
    Object.freeze({
      available: Boolean(mounted && !mounted.navigation.status().disposed),
      name: "frontend.navigation-state",
    }),
    Object.freeze({
      available: edgeNames.every((edge) =>
        targets[edge].querySelector("[data-fennevia-default-focus]"),
      ),
      name: "frontend.edge-keyboard-focus",
    }),
  ]);
}
