import { flushSync, mount, unmount } from "svelte";

import {
  createAddressPopupController,
  type AddressPopupController,
  type AddressPopupInvocationSource,
  type AddressPopupSnapshot,
} from "../app/address-popup";
import {
  createCustomizeSessionController,
  customizeActiveAttribute,
  type CustomizeSessionController,
} from "../app/customize-session";
import {
  createEdgeShellController,
  edgeNames,
  edgeSurfaceTiming,
  edgeInsetCssPixels,
  edgeTriggerThicknessCssPixels,
  getKeyboardRevealEdge,
  type EdgeName,
  type EdgeShellController,
} from "../app/edge-surfaces";
import {
  createBrowserBookmarksStateAdapter,
  type BrowserBookmarksBridge,
  type BrowserBookmarksStateAdapter,
} from "../app/bookmark-state";
import {
  createBrowserToolsStateAdapter,
  type BrowserToolAction,
  type BrowserToolsBridge,
  type BrowserToolsStateAdapter,
} from "../app/browser-tools-state";
import {
  createBrowserDownloadsStateAdapter,
  type BrowserDownloadsBridge,
  type BrowserDownloadsStateAdapter,
} from "../app/download-state";
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
import {
  createBrowserToolbarWidgetsStateAdapter,
  type BrowserToolbarWidgetsBridge,
  type BrowserToolbarWidgetsState,
  type BrowserToolbarWidgetsStateAdapter,
  type ToolbarStyleSnapshot,
} from "../app/toolbar-widgets-state";
import {
  createBrowserUrlbarCoverageStateAdapter,
  type BrowserUrlbarCoverageBridge,
  type BrowserUrlbarCoverageStateAdapter,
} from "../app/urlbar-coverage-state";
import {
  createBrowserWindowControlsStateAdapter,
  type BrowserWindowControlsBridge,
  type BrowserWindowControlsStateAdapter,
} from "../app/window-controls-state";
import {
  createBrowserLocaleStateAdapter,
  createStaticLocaleBridge,
  type BrowserLocaleBridge,
  type BrowserLocaleStateAdapter,
} from "../app/locale-state";
import App from "./App.svelte";
import AddressPopup from "./AddressPopup.svelte";
import "./styles/edge-shell.css";

const XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const MOUNT_STATUS_ATTRIBUTE = "data-fennevia-framework-status";
const FRAME_READY_ATTRIBUTE = "data-fennevia-frontend-ready";
const FRAME_ENVIRONMENT_ATTRIBUTE = "data-fennevia-environment";
const ROOT_SELECTOR = "[data-fennevia-surface-root]";
const KEYBOARD_LISTENER_OPTIONS = Object.freeze({ capture: false });
const ADDRESS_POPUP_CLOSE_DELAY_MS = 110;
const OVERLAY_TARGET_ID = "fennevia-shell-address-overlay-mount";

const hasAllowedProjectNamespace = (element: Element): boolean => {
  if (element.namespaceURI === XHTML_NAMESPACE) {
    return true;
  }
  if (element.namespaceURI !== SVG_NAMESPACE) {
    return false;
  }
  const iconRoot = element.closest("svg[data-fennevia-icon]");
  return iconRoot?.namespaceURI === SVG_NAMESPACE;
};

const targetIds: Readonly<Record<EdgeName, string>> = Object.freeze({
  top: "fennevia-shell-top-mount",
  left: "fennevia-shell-left-mount",
  right: "fennevia-shell-right-mount",
  bottom: "fennevia-shell-bottom-mount",
});

export type ShellWindowKind = "normal" | "private";
export type EdgeMountTargets = Readonly<Record<EdgeName, Element>>;

type MountOptions = Readonly<{
  bookmarks: BrowserBookmarksBridge;
  browserTools: BrowserToolsBridge;
  downloads: BrowserDownloadsBridge;
  frame: HTMLElement;
  navigation: BrowserNavigationBridge;
  onFatalError: (error: unknown) => void;
  onUnmountError: (error: unknown) => void;
  overlayTarget: Element;
  tabs: BrowserTabsBridge;
  targets: EdgeMountTargets;
  toolbarWidgets?: BrowserToolbarWidgetsBridge;
  urlbarCoverage: BrowserUrlbarCoverageBridge;
  locale?: BrowserLocaleBridge;
  windowControls: BrowserWindowControlsBridge;
  windowKind: ShellWindowKind;
}>;

type HealthOptions = Readonly<{
  frame: HTMLElement;
  overlayTarget: Element;
  targets: EdgeMountTargets;
  windowKind: ShellWindowKind;
}>;

type MountedComponent = Readonly<{
  component: Record<string, unknown>;
  name: EdgeName | "address-popup";
  target: Element;
}>;

type MountedShell = Readonly<{
  addressPopup: AddressPopupController;
  bookmarks: BrowserBookmarksStateAdapter;
  browserTools: BrowserToolsStateAdapter;
  components: readonly MountedComponent[];
  downloads: BrowserDownloadsStateAdapter;
  navigation: BrowserNavigationStateAdapter;
  shell: EdgeShellController;
  tabs: BrowserTabsStateAdapter;
  toolbarWidgets: BrowserToolbarWidgetsStateAdapter | undefined;
  locale: BrowserLocaleStateAdapter;
  urlbarCoverage: BrowserUrlbarCoverageStateAdapter;
  windowControls: BrowserWindowControlsStateAdapter;
}>;

type FocusableElement = Element &
  Readonly<{
    blur?: () => void;
    focus: (options?: FocusOptions) => void;
    select?: () => void;
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

function validateMounts(
  frame: HTMLElement,
  overlayTarget: Element,
  targets: EdgeMountTargets,
): void {
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
  const overlayHost = overlayTarget?.parentElement;
  if (
    overlayTarget?.namespaceURI !== XHTML_NAMESPACE ||
    overlayTarget.id !== OVERLAY_TARGET_ID ||
    overlayTarget.childNodes.length !== 0 ||
    mountedTargets.has(overlayTarget) ||
    overlayHost?.parentElement !== frame ||
    overlayHost.getAttribute("data-fennevia-overlay-host") !== "address" ||
    Array.from(frame.children).at(-1) !== overlayHost
  ) {
    throw createFrontendError("FENNEVIA_FRONTEND_OVERLAY_TARGET_INVALID");
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

const CUSTOMIZE_STYLE_PROPERTIES = Object.freeze([
  "color-scheme",
  "font-size",
  "--fennevia-control-height",
  "--fennevia-edge-top-height",
  "--fennevia-focus-color",
  "--fennevia-glass-blur",
  "--fennevia-glass-border",
  "--fennevia-glass-muted",
  "--fennevia-glass-radius",
  "--fennevia-glass-saturation",
  "--fennevia-glass-separator",
  "--fennevia-glass-shadow",
  "--fennevia-glass-surface",
  "--fennevia-glass-text",
  "--fennevia-glass-tint",
  "--fennevia-motion-duration",
  "--fennevia-selected-surface",
]);

const HEX_COLOR_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/u;
const DEFAULT_PANEL_SURFACE =
  "var(--panel-background-color, var(--toolbar-background-color))";
const DEFAULT_TOOLBAR_SURFACE =
  "var(--toolbar-background-color, var(--panel-background-color))";
const DEFAULT_GLASS_BLUR_PX = 18;
const DEFAULT_GLASS_RADIUS_PX = 4;
const DEFAULT_FONT_SIZE_PX = 12;
const DEFAULT_SURFACE_OPACITY = 94;
const DEFAULT_SATURATION = 145;
const DEFAULT_SHADOW = 50;
const DEFAULT_MOTION_MS = 180;

function hexToRgbComponents(hex: string): string | null {
  const match = HEX_COLOR_PATTERN.exec(hex);
  if (!match) {
    return null;
  }
  return [match[1], match[2], match[3]]
    .map((component) => String(parseInt(component, 16)))
    .join(" ");
}

function shadowFromIntensity(intensity: number): string {
  if (intensity === 0) {
    return "none";
  }
  const scale = intensity / DEFAULT_SHADOW;
  const y = Math.round(18 * scale);
  const blur = Math.round(54 * scale);
  const alpha = Math.round(28 * scale);
  const inset = Math.round(22 * scale);
  return `0 ${y}px ${blur}px color-mix(in srgb, var(--color-black, black) ${alpha}%, transparent), inset 0 1px 0 color-mix(in srgb, var(--color-white, white) ${inset}%, transparent)`;
}

function clearCustomizeStyle(frame: HTMLElement): void {
  for (const property of CUSTOMIZE_STYLE_PROPERTIES) {
    frame.style.removeProperty(property);
  }
}

function applyCustomizeStyle(
  frame: HTMLElement,
  style: ToolbarStyleSnapshot,
  options: Readonly<{ forcedColors: boolean; reducedMotion: boolean }>,
): void {
  clearCustomizeStyle(frame);
  if (style.blur !== DEFAULT_GLASS_BLUR_PX) {
    frame.style.setProperty("--fennevia-glass-blur", `${style.blur}px`);
  }
  if (style.radius !== DEFAULT_GLASS_RADIUS_PX) {
    frame.style.setProperty("--fennevia-glass-radius", `${style.radius}px`);
  }
  if (style.fontSize !== DEFAULT_FONT_SIZE_PX) {
    frame.style.setProperty("font-size", `${style.fontSize}px`);
  }
  if (style.density === "compact") {
    frame.style.setProperty("--fennevia-control-height", "28px");
    frame.style.setProperty("--fennevia-edge-top-height", "48px");
  } else if (style.density === "comfortable") {
    frame.style.setProperty("--fennevia-control-height", "36px");
    frame.style.setProperty("--fennevia-edge-top-height", "64px");
  }
  if (!options.reducedMotion && style.motion !== DEFAULT_MOTION_MS) {
    frame.style.setProperty("--fennevia-motion-duration", `${style.motion}ms`);
  }
  if (options.forcedColors) {
    // Forced-colors mode keeps the system palette authoritative.
    return;
  }
  if (style.theme !== "auto") {
    frame.style.setProperty("color-scheme", style.theme);
  }
  const accent = hexToRgbComponents(style.accent);
  if (accent) {
    frame.style.setProperty("--fennevia-focus-color", `rgb(${accent})`);
    frame.style.setProperty(
      "--fennevia-selected-surface",
      `rgb(${accent} / 20%)`,
    );
  }
  const tintOpacity = Math.max(50, style.surfaceOpacity - 10);
  const surface = hexToRgbComponents(style.surface);
  if (surface) {
    frame.style.setProperty(
      "--fennevia-glass-surface",
      `rgb(${surface} / ${style.surfaceOpacity}%)`,
    );
    frame.style.setProperty(
      "--fennevia-glass-tint",
      `rgb(${surface} / ${tintOpacity}%)`,
    );
  } else if (style.surfaceOpacity !== DEFAULT_SURFACE_OPACITY) {
    frame.style.setProperty(
      "--fennevia-glass-surface",
      `color-mix(in srgb, ${DEFAULT_PANEL_SURFACE} ${style.surfaceOpacity}%, transparent)`,
    );
    frame.style.setProperty(
      "--fennevia-glass-tint",
      `color-mix(in srgb, ${DEFAULT_TOOLBAR_SURFACE} ${tintOpacity}%, transparent)`,
    );
  }
  const text = hexToRgbComponents(style.text);
  if (text) {
    frame.style.setProperty("--fennevia-glass-text", `rgb(${text})`);
    frame.style.setProperty("--fennevia-glass-muted", `rgb(${text} / 70%)`);
  }
  const border = hexToRgbComponents(style.border);
  if (border) {
    frame.style.setProperty("--fennevia-glass-border", `rgb(${border})`);
    frame.style.setProperty(
      "--fennevia-glass-separator",
      `rgb(${border} / 20%)`,
    );
  }
  if (style.saturation !== DEFAULT_SATURATION) {
    frame.style.setProperty(
      "--fennevia-glass-saturation",
      `${style.saturation}%`,
    );
  }
  if (style.shadow !== DEFAULT_SHADOW) {
    frame.style.setProperty(
      "--fennevia-glass-shadow",
      shadowFromIntensity(style.shadow),
    );
  }
}

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
  windowControls,
  windowKind,
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
  let addressPopup: AddressPopupController | undefined;
  let addressPopupCloseTimer: number | undefined;
  let addressPopupFocusOrigin: FocusableElement | null = null;
  let addressPopupOriginEdge: EdgeName | null = null;
  let bookmarksState: BrowserBookmarksStateAdapter | undefined;
  let browserToolsState: BrowserToolsStateAdapter | undefined;
  let customizeSession: CustomizeSessionController | undefined;
  let downloadsState: BrowserDownloadsStateAdapter | undefined;
  let localeState: BrowserLocaleStateAdapter | undefined;
  let navigationState: BrowserNavigationStateAdapter | undefined;
  let tabsState: BrowserTabsStateAdapter | undefined;
  let toolbarWidgetsState: BrowserToolbarWidgetsStateAdapter | undefined;
  let urlbarCoverageState: BrowserUrlbarCoverageStateAdapter | undefined;
  let windowControlsState: BrowserWindowControlsStateAdapter | undefined;
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
  customizeSession = createCustomizeSessionController({
    frame,
    onError: onFatalError,
    shell,
  });

  const focusCustomizeToggle = (): void => {
    const toggle = targets.top.querySelector<FocusableElement>(
      'button[data-fennevia-action="customize-shell"]',
    );
    toggle?.focus({ preventScroll: true });
  };

  const closeCustomizeSession = (): boolean => {
    if (!customizeSession?.isOpen()) {
      return false;
    }
    return customizeSession.setOpen(false);
  };

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

  const focusSurface = (edge: EdgeName, selectText = false): boolean => {
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
    const focusTarget = targets[edge].querySelector<FocusableElement>(
      "[data-fennevia-default-focus]",
    );
    if (!focusTarget) {
      throw createFrontendError("FENNEVIA_EDGE_FOCUS_TARGET_MISSING");
    }
    focusTarget.focus({ preventScroll: true });
    if (selectText) {
      focusTarget.select?.();
    }
    return targets[edge].contains(frame.ownerDocument.activeElement);
  };

  const dismissSurface = (edge: EdgeName): void => {
    restoreFocus(edge);
    shell.dismiss(edge);
  };

  const cancelAddressPopupCloseTimer = (): void => {
    if (addressPopupCloseTimer === undefined) {
      return;
    }
    view.clearTimeout(addressPopupCloseTimer);
    addressPopupCloseTimer = undefined;
  };

  const addressPopupIsVisible = (snapshot?: AddressPopupSnapshot): boolean => {
    const current = snapshot ?? addressPopup?.snapshot();
    return Boolean(
      current && current.phase !== "hidden" && current.phase !== "disposed",
    );
  };

  const focusAddressPopup = (): boolean => {
    flushSync();
    const input = overlayTarget.querySelector<FocusableElement>(
      "[data-fennevia-address-popup-input]",
    );
    if (!input) {
      throw createFrontendError("FENNEVIA_ADDRESS_POPUP_FOCUS_TARGET_MISSING");
    }
    input.focus({ preventScroll: true });
    input.select?.();
    return overlayTarget.contains(frame.ownerDocument.activeElement);
  };

  const focusSelectedContent = (): void => {
    try {
      navigationState?.focusContent();
    } catch (error) {
      onFatalError(error);
    }
  };

  const restoreAddressPopupFocus = (snapshot: AddressPopupSnapshot): void => {
    if (
      frame.getAttribute(FRAME_ENVIRONMENT_ATTRIBUTE) !== "normal" ||
      snapshot.closeReason === "environment" ||
      snapshot.closeReason === "focus-failed"
    ) {
      const active = getFocusableOrigin(frame.ownerDocument.activeElement);
      if (active && overlayTarget.contains(active)) {
        active.blur?.();
      }
      return;
    }

    if (
      snapshot.closeReason === "committed" ||
      snapshot.closeReason === "tab-changed"
    ) {
      focusSelectedContent();
      return;
    }

    if (
      snapshot.invocationSource === "left-launcher" ||
      snapshot.invocationSource === "top-launcher"
    ) {
      shell.revealProgrammatically("left");
      flushSync();
      const launcher = targets.left.querySelector<FocusableElement>(
        "[data-fennevia-address-launcher]",
      );
      if (launcher?.isConnected) {
        launcher.focus({ preventScroll: true });
        if (targets.left.contains(frame.ownerDocument.activeElement)) {
          return;
        }
      }
      focusSelectedContent();
      return;
    }

    const origin = addressPopupFocusOrigin;
    if (addressPopupOriginEdge) {
      shell.revealProgrammatically(addressPopupOriginEdge);
      flushSync();
    }
    if (origin?.isConnected && !overlayTarget.contains(origin)) {
      origin.focus({ preventScroll: true });
      return;
    }
    focusSelectedContent();
  };

  const completeAddressPopupClose = (
    closingSnapshot: AddressPopupSnapshot,
  ): void => {
    cancelAddressPopupCloseTimer();
    if (!addressPopup || closingSnapshot.phase !== "closing") {
      return;
    }
    addressPopup.completeClose();
    shell.setInteractionSuppressed(false);
    restoreAddressPopupFocus(closingSnapshot);
    addressPopupFocusOrigin = null;
    addressPopupOriginEdge = null;
  };

  const closeAddressPopupForNativeHandoff = (): boolean => {
    if (
      disposed ||
      !addressPopup ||
      frame.getAttribute(FRAME_ENVIRONMENT_ATTRIBUTE) !== "normal"
    ) {
      return false;
    }
    const snapshot = addressPopup.snapshot();
    if (!addressPopupIsVisible(snapshot)) {
      return false;
    }
    addressPopup.requestClose("environment");
    const closingSnapshot = addressPopup.snapshot();
    if (closingSnapshot.phase !== "closing") {
      return false;
    }
    completeAddressPopupClose(closingSnapshot);
    flushSync();
    return true;
  };

  const openNativeUrlbar = (): boolean => {
    if (!urlbarCoverageState || !closeAddressPopupForNativeHandoff()) {
      return false;
    }
    return urlbarCoverageState.openNativeUrlbar();
  };

  const openNativeBrowserTool = async (
    action: BrowserToolAction,
    host?: unknown,
  ): Promise<boolean> => {
    if (!browserToolsState) {
      return false;
    }
    return browserToolsState.invoke(action, host);
  };

  const scheduleAddressPopupClose = (snapshot: AddressPopupSnapshot): void => {
    if (snapshot.phase !== "closing" || addressPopupCloseTimer !== undefined) {
      return;
    }
    addressPopupCloseTimer = view.setTimeout(() => {
      addressPopupCloseTimer = undefined;
      try {
        completeAddressPopupClose(snapshot);
      } catch (error) {
        onFatalError(error);
      }
    }, ADDRESS_POPUP_CLOSE_DELAY_MS);
  };

  const openAddressPopup = (source: AddressPopupInvocationSource): boolean => {
    if (
      disposed ||
      !addressPopup ||
      frame.getAttribute(FRAME_ENVIRONMENT_ATTRIBUTE) !== "normal"
    ) {
      return false;
    }
    try {
      const previousSnapshot = addressPopup.snapshot();
      const wasVisible = addressPopupIsVisible(previousSnapshot);
      const active = getFocusableOrigin(frame.ownerDocument.activeElement);
      if (!wasVisible) {
        addressPopupFocusOrigin = active;
        addressPopupOriginEdge = active
          ? (edgeNames.find((edge) => targets[edge].contains(active)) ?? null)
          : null;
      }
      cancelAddressPopupCloseTimer();
      addressPopup.requestOpen(source);
      flushSync();
      if (!focusAddressPopup()) {
        addressPopup.requestClose("focus-failed");
        const closingSnapshot = addressPopup.snapshot();
        if (closingSnapshot.phase === "closing") {
          completeAddressPopupClose(closingSnapshot);
        }
        return false;
      }
      addressPopup.confirmOpen();
      closeCustomizeSession();
      shell.setInteractionSuppressed(true);
      return true;
    } catch (error) {
      onFatalError(error);
      return false;
    }
  };

  const syncEnvironment = (): void => {
    if (disposed) {
      return;
    }
    const shouldEnable =
      frame.getAttribute(FRAME_ENVIRONMENT_ATTRIBUTE) === "normal";
    if (!shouldEnable && addressPopupIsVisible()) {
      const popup = addressPopup;
      popup?.requestClose("environment");
      const closingSnapshot = popup?.snapshot();
      if (closingSnapshot?.phase === "closing") {
        completeAddressPopupClose(closingSnapshot);
      }
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
          addressPopup?.requestClose("cancelled");
        } else if (revealEdge) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
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
    cancelAddressPopupCloseTimer();
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
      addressPopup?.dispose();
    } catch (error) {
      firstError ??= error;
    }
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
    focusOrigins.clear();
    addressPopupFocusOrigin = null;
    addressPopupOriginEdge = null;
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
    addressPopup = createAddressPopupController({
      navigation: navigationState,
      tabs: tabsState,
    });
    controllerSubscriptions.push(
      addressPopup.subscribe((snapshot) => {
        frame.toggleAttribute(
          "data-fennevia-address-popup-visible",
          addressPopupIsVisible(snapshot),
        );
        scheduleAddressPopupClose(snapshot);
      }),
      navigationState.subscribeAddressPopupOpen((request) => {
        return openAddressPopup(request.source);
      }),
      tabsState.subscribeContextMenu((open) => {
        shell.setPopupHeld("left", open);
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
      const applyStyleFromState = (state: BrowserToolbarWidgetsState): void => {
        applyCustomizeStyle(frame, state.snapshot.style, {
          forcedColors: forcedColorsQuery?.matches === true,
          reducedMotion: reducedMotionQuery?.matches === true,
        });
      };
      applyStyleFromState(widgetsState.snapshot());
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
        widgetsState.subscribe(applyStyleFromState),
      );
      const mediaQueries = [forcedColorsQuery, reducedMotionQuery].filter(
        (query): query is MediaQueryList => query !== null,
      );
      if (mediaQueries.length > 0) {
        const onMediaChange = (): void => {
          try {
            applyStyleFromState(widgetsState.snapshot());
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
          ...(edge === "top" || edge === "left"
            ? {
                navigation: navigationState,
              }
            : {}),
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
          ...(edge === "left"
            ? {
                addressPopup,
                onOpenAddress: () => openAddressPopup("left-launcher"),
                tabs: tabsState,
              }
            : {}),
          ...(edge === "right" ? { bookmarks: bookmarksState } : {}),
          ...(edge === "bottom" ? { downloads: downloadsState } : {}),
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

export async function verifyShellAppHealth({
  frame,
  overlayTarget,
  targets,
  windowKind,
}: HealthOptions): Promise<true> {
  const mounted = mountedFrames.get(frame);
  await Promise.all([mounted?.bookmarks.ready(), mounted?.downloads.ready()]);
  const roots = edgeNames.map((edge) =>
    targets[edge].querySelector<HTMLElement>(
      `#fennevia-shell-${edge}-root${ROOT_SELECTOR}`,
    ),
  );
  const topRoot = roots[edgeNames.indexOf("top")];
  const leftRoot = roots[edgeNames.indexOf("left")];
  const rightRoot = roots[edgeNames.indexOf("right")];
  const bottomRoot = roots[edgeNames.indexOf("bottom")];
  const addressPopupRoot = overlayTarget.querySelector<HTMLElement>(
    "#fennevia-address-popup-root[data-fennevia-address-popup-root]",
  );
  const template = topRoot?.querySelector<HTMLTemplateElement>(
    "template[data-fennevia-template]",
  );
  const templateConstructor =
    frame.ownerDocument.defaultView?.HTMLTemplateElement;
  const requiredLeftSelectors = [
    "section[data-fennevia-address-launcher-region]",
    "button[data-fennevia-address-launcher]",
    'button[data-fennevia-connection-status][data-fennevia-browser-tool="site-information"]',
    'button[data-fennevia-protection-status][data-fennevia-browser-tool="protections"]',
    '[role="tablist"][aria-orientation="vertical"][data-fennevia-tab-list]',
    'button[role="tab"][data-fennevia-tab]',
    'button[data-fennevia-action="new-tab"]',
    "output[data-fennevia-tab-count]",
  ];
  const requiredTopSelectors = [
    'button[data-fennevia-action="back"]',
    'button[data-fennevia-action="forward"]',
    'button[data-fennevia-action="reload-stop"]',
    'button[data-fennevia-action="home"]',
    'button[data-fennevia-browser-tool="extensions"]',
    'button[data-fennevia-browser-tool="application-menu"]',
    'button[data-fennevia-browser-tool="settings"]',
    'button[data-fennevia-window-control="minimize"]',
    'button[data-fennevia-window-control="toggle-maximize"]',
    'button[data-fennevia-window-control="close"]',
    '[data-fennevia-progress-light="load"]',
  ];
  const requiredRightSelectors = [
    "select[data-fennevia-bookmark-roots]",
    "option[data-fennevia-bookmark-root]",
    '[role="list"][data-fennevia-bookmark-list]',
    "[data-fennevia-bookmark-status]",
  ];
  const requiredBottomSelectors = [
    "section[data-fennevia-downloads]",
    "[data-fennevia-download-summary]",
    "[data-fennevia-download-progress]",
    '[data-fennevia-progress-light="download"]',
  ];
  const requiredAddressPopupSelectors = [
    "button[data-fennevia-address-popup-backdrop]",
    'div[role="dialog"][aria-modal="false"][data-fennevia-address-popup]',
    'label[for="fennevia-address-popup-input"]',
    "input#fennevia-address-popup-input[data-fennevia-address-popup-input]",
    "output[data-fennevia-address-popup-status]",
    "[data-fennevia-address-popup-details]",
    'button[data-fennevia-connection-detail][data-fennevia-browser-tool="site-information"]',
    'button[data-fennevia-protection-detail][data-fennevia-browser-tool="protections"]',
    'button[data-fennevia-permission-detail][data-fennevia-browser-tool="site-permissions"]',
    "[data-fennevia-urlbar-coverage]",
    "button[data-fennevia-native-urlbar-access]",
    "button[data-fennevia-address-popup-close]",
  ];

  if (
    frame.getAttribute(FRAME_READY_ATTRIBUTE) !== "" ||
    !mounted ||
    mounted.components.length !== edgeNames.length + 1 ||
    mounted.addressPopup.status().disposed ||
    mounted.bookmarks.status().disposed ||
    mounted.bookmarks.status().phase !== "ready" ||
    mounted.browserTools.status().disposed ||
    mounted.downloads.status().disposed ||
    mounted.downloads.status().phase !== "ready" ||
    mounted.navigation.status().disposed ||
    mounted.tabs.status().disposed ||
    mounted.urlbarCoverage.status().disposed ||
    mounted.windowControls.status().disposed ||
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
        Array.from(root.querySelectorAll("*")).some(
          (element) => !hasAllowedProjectNamespace(element),
        )
      );
    }) ||
    edgeNames.some(
      (edge) =>
        targets[edge].getAttribute(MOUNT_STATUS_ATTRIBUTE) !== "mounted",
    ) ||
    overlayTarget.getAttribute(MOUNT_STATUS_ATTRIBUTE) !== "mounted" ||
    !leftRoot ||
    requiredLeftSelectors.some(
      (selector) => !leftRoot.querySelector(selector),
    ) ||
    leftRoot.querySelector("input") !== null ||
    !topRoot ||
    requiredTopSelectors.some((selector) => !topRoot.querySelector(selector)) ||
    !rightRoot ||
    requiredRightSelectors.some(
      (selector) => !rightRoot.querySelector(selector),
    ) ||
    !bottomRoot ||
    requiredBottomSelectors.some(
      (selector) => !bottomRoot.querySelector(selector),
    ) ||
    !addressPopupRoot ||
    addressPopupRoot.parentElement !== overlayTarget ||
    addressPopupRoot.namespaceURI !== XHTML_NAMESPACE ||
    addressPopupRoot.getAttribute("data-fennevia-window-kind") !== windowKind ||
    requiredAddressPopupSelectors.some(
      (selector) => !addressPopupRoot.querySelector(selector),
    ) ||
    addressPopupRoot.querySelectorAll("input").length !== 1 ||
    Array.from(addressPopupRoot.querySelectorAll("*")).some(
      (element) => element.namespaceURI !== XHTML_NAMESPACE,
    ) ||
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
  overlayTarget,
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
        ) &&
        overlayTarget.querySelector(
          "#fennevia-address-popup-root[data-fennevia-address-popup-root]",
        ) !== null,
      name: "frontend.svelte-owned-roots",
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
      available: Boolean(
        mounted &&
        !mounted.browserTools.status().disposed &&
        targets.top.querySelector("[data-fennevia-browser-tools]") &&
        targets.top.querySelector(
          '[data-fennevia-browser-tool="extensions"]',
        ) &&
        targets.top.querySelector(
          '[data-fennevia-browser-tool="application-menu"]',
        ),
      ),
      name: "frontend.browser-tools-state",
    }),
    Object.freeze({
      available: Boolean(
        mounted &&
        !mounted.windowControls.status().disposed &&
        targets.top.querySelector(
          '[data-fennevia-window-control="minimize"]',
        ) &&
        targets.top.querySelector(
          '[data-fennevia-window-control="toggle-maximize"]',
        ) &&
        targets.top.querySelector('[data-fennevia-window-control="close"]'),
      ),
      name: "frontend.window-controls-state",
    }),
    Object.freeze({
      available: Boolean(
        mounted &&
        !mounted.urlbarCoverage.status().disposed &&
        overlayTarget.querySelector(
          'button[data-fennevia-permission-detail][data-fennevia-browser-tool="site-permissions"]',
        ) &&
        overlayTarget.querySelector("[data-fennevia-urlbar-coverage]") &&
        overlayTarget.querySelector("[data-fennevia-native-urlbar-access]"),
      ),
      name: "frontend.urlbar-coverage-state",
    }),
    Object.freeze({
      available: Boolean(
        mounted &&
        !mounted.addressPopup.status().disposed &&
        !mounted.navigation.status().disposed &&
        targets.left.querySelector("[data-fennevia-address-launcher]") &&
        overlayTarget.querySelector("[data-fennevia-address-popup-input]"),
      ),
      name: "frontend.address-popup-state",
    }),
    Object.freeze({
      available: Boolean(
        targets.left.querySelector(
          'button[data-fennevia-connection-status][data-fennevia-browser-tool="site-information"]',
        ) &&
        targets.left.querySelector(
          'button[data-fennevia-protection-status][data-fennevia-browser-tool="protections"]',
        ) &&
        overlayTarget.querySelector(
          'button[data-fennevia-connection-detail][data-fennevia-browser-tool="site-information"]',
        ) &&
        overlayTarget.querySelector(
          'button[data-fennevia-protection-detail][data-fennevia-browser-tool="protections"]',
        ) &&
        overlayTarget.querySelector(
          'button[data-fennevia-permission-detail][data-fennevia-browser-tool="site-permissions"]',
        ),
      ),
      name: "frontend.firefox-site-status",
    }),
    Object.freeze({
      available: Boolean(
        mounted &&
        !mounted.bookmarks.status().disposed &&
        targets.right.querySelector("[data-fennevia-bookmark-roots]") &&
        targets.right.querySelector("[data-fennevia-bookmark-list]"),
      ),
      name: "frontend.bookmarks-state",
    }),
    Object.freeze({
      available: Boolean(
        mounted &&
        !mounted.downloads.status().disposed &&
        targets.bottom.querySelector("[data-fennevia-downloads]") &&
        targets.bottom.querySelector("[data-fennevia-download-progress]"),
      ),
      name: "frontend.downloads-state",
    }),
    Object.freeze({
      available: Boolean(
        targets.top.querySelector('[data-fennevia-progress-light="load"]') &&
        targets.bottom.querySelector(
          '[data-fennevia-progress-light="download"]',
        ),
      ),
      name: "frontend.progress-lights",
    }),
    Object.freeze({
      available: edgeNames.every((edge) =>
        targets[edge].querySelector("[data-fennevia-default-focus]"),
      ),
      name: "frontend.edge-keyboard-focus",
    }),
  ]);
}
