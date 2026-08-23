// SPDX-License-Identifier: MPL-2.0
import type { AddressPopupController } from "../../app/address-popup";
import type {
  BrowserBookmarksBridge,
  BrowserBookmarksStateAdapter,
} from "../../app/bookmark-state";
import type {
  BrowserToolsBridge,
  BrowserToolsStateAdapter,
} from "../../app/browser-tools-state";
import type {
  BrowserDownloadsBridge,
  BrowserDownloadsStateAdapter,
} from "../../app/download-state";
import {
  edgeNames,
  type EdgeName,
  type EdgeShellController,
} from "../../app/edge-surfaces";
import type {
  BrowserLocaleBridge,
  BrowserLocaleStateAdapter,
} from "../../app/locale-state";
import type {
  BrowserNavigationBridge,
  BrowserNavigationStateAdapter,
} from "../../app/navigation-state";
import type {
  BrowserTabsBridge,
  BrowserTabsStateAdapter,
} from "../../app/tab-state";
import type {
  BrowserToolbarWidgetsBridge,
  BrowserToolbarWidgetsStateAdapter,
} from "../../app/toolbar-widgets-state";
import type {
  BrowserUrlbarCoverageBridge,
  BrowserUrlbarCoverageStateAdapter,
} from "../../app/urlbar-coverage-state";
import type {
  BrowserUrlbarSuggestionsBridge,
  BrowserUrlbarSuggestionsStateAdapter,
} from "../../app/urlbar-suggestions-state";
import type {
  BrowserWindowControlsBridge,
  BrowserWindowControlsStateAdapter,
} from "../../app/window-controls-state";

export const XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
export const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
export const MOUNT_STATUS_ATTRIBUTE = "data-fennevia-framework-status";
export const FRAME_READY_ATTRIBUTE = "data-fennevia-frontend-ready";
export const FRAME_ENVIRONMENT_ATTRIBUTE = "data-fennevia-environment";
export const ROOT_SELECTOR = "[data-fennevia-surface-root]";
export const KEYBOARD_LISTENER_OPTIONS = Object.freeze({ capture: false });
export const ADDRESS_POPUP_CLOSE_DELAY_MS = 110;
export const OVERLAY_TARGET_ID = "fennevia-shell-address-overlay-mount";

export const hasAllowedProjectNamespace = (element: Element): boolean => {
  if (element.namespaceURI === XHTML_NAMESPACE) {
    return true;
  }
  if (element.namespaceURI !== SVG_NAMESPACE) {
    return false;
  }
  const iconRoot = element.closest("svg[data-fennevia-icon]");
  return iconRoot?.namespaceURI === SVG_NAMESPACE;
};

export const targetIds: Readonly<Record<EdgeName, string>> = Object.freeze({
  top: "fennevia-shell-top-mount",
  left: "fennevia-shell-left-mount",
  right: "fennevia-shell-right-mount",
  bottom: "fennevia-shell-bottom-mount",
});

export type ShellWindowKind = "normal" | "private";
export type EdgeMountTargets = Readonly<Record<EdgeName, Element>>;

export type MountOptions = Readonly<{
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
  urlbarSuggestions: BrowserUrlbarSuggestionsBridge;
  locale?: BrowserLocaleBridge;
  windowControls: BrowserWindowControlsBridge;
  windowKind: ShellWindowKind;
  isChromeWindowActive?: () => boolean;
}>;

export type HealthOptions = Readonly<{
  frame: HTMLElement;
  overlayTarget: Element;
  targets: EdgeMountTargets;
  windowKind: ShellWindowKind;
}>;

export type MountedComponent = Readonly<{
  component: Record<string, unknown>;
  name: EdgeName | "address-popup";
  target: Element;
}>;

export type MountedShell = Readonly<{
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
  urlbarSuggestions: BrowserUrlbarSuggestionsStateAdapter;
  windowControls: BrowserWindowControlsStateAdapter;
}>;

export type FocusableElement = Element &
  Readonly<{
    blur?: () => void;
    focus: (options?: FocusOptions) => void;
    select?: () => void;
  }>;

export const mountedFrames = new WeakMap<Element, MountedShell>();
export const mountedTargets = new WeakSet<Element>();

export function createFrontendError(code: string): Error {
  const error = new Error(code);
  error.name = "FenneviaFrontendError";
  Object.defineProperties(error, {
    fenneviaCode: { enumerable: false, value: code },
    fenneviaPhase: { enumerable: false, value: "shell-frontend" },
  });
  return error;
}

export function isWindowKind(value: string): value is ShellWindowKind {
  return value === "normal" || value === "private";
}

export function validateMounts(
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

export function getFocusableOrigin(
  value: EventTarget | null,
): FocusableElement | null {
  return value instanceof Element &&
    typeof (value as Partial<FocusableElement>).focus === "function"
    ? (value as FocusableElement)
    : null;
}
