// SPDX-License-Identifier: MPL-2.0
import { edgeNames, type EdgeName } from "../../app/edge-surfaces";
import {
  defaultToolbarLayoutDirection,
  isToolbarOptionalPanelEnabled,
  toolbarLayoutContainsProjectWidget,
  type ProgressLightSource,
  type ProjectWidgetId,
  type ToolbarLayoutDirection,
  type ToolbarLayoutNodeSnapshot,
  type ToolbarWidgetsSnapshot,
} from "../../app/toolbar-widgets-state";
import {
  FRAME_ENVIRONMENT_ATTRIBUTE,
  FRAME_READY_ATTRIBUTE,
  MOUNT_STATUS_ATTRIBUTE,
  ROOT_SELECTOR,
  XHTML_NAMESPACE,
  createFrontendError,
  hasAllowedProjectNamespace,
  isWindowKind,
  mountedFrames,
  type HealthOptions,
  type ShellWindowKind,
} from "./contracts";

const projectWidgetSelectors: Readonly<
  Record<ProjectWidgetId, readonly string[]>
> = Object.freeze({
  "address-launcher": Object.freeze([
    "[data-fennevia-address-launcher-region]",
    "button[data-fennevia-address-launcher]",
  ]),
  "application-menu": Object.freeze([
    'button[data-fennevia-browser-tool="application-menu"]',
  ]),
  back: Object.freeze(['button[data-fennevia-action="back"]']),
  bookmarks: Object.freeze([
    "[data-fennevia-bookmarks]",
    "select[data-fennevia-bookmark-roots]",
    '[role="list"][data-fennevia-bookmark-list]',
    "[data-fennevia-bookmark-status]",
  ]),
  "close-window": Object.freeze([
    'button[data-fennevia-window-control="close"]',
  ]),
  "customize-shell": Object.freeze([
    'button[data-fennevia-action="customize-shell"]',
  ]),
  "downloads-status": Object.freeze([
    "section[data-fennevia-downloads]",
    "[data-fennevia-download-summary]",
    "[data-fennevia-download-progress]",
  ]),
  extensions: Object.freeze([
    'button[data-fennevia-browser-tool="extensions"]',
  ]),
  forward: Object.freeze(['button[data-fennevia-action="forward"]']),
  home: Object.freeze(['button[data-fennevia-action="home"]']),
  "minimize-window": Object.freeze([
    'button[data-fennevia-window-control="minimize"]',
  ]),
  "new-tab": Object.freeze(['button[data-fennevia-action="new-tab"]']),
  "private-indicator": Object.freeze(["[data-fennevia-private-indicator]"]),
  "reload-stop": Object.freeze(['button[data-fennevia-action="reload-stop"]']),
  settings: Object.freeze(['button[data-fennevia-browser-tool="settings"]']),
  "show-bookmarks": Object.freeze([
    'button[data-fennevia-browser-tool="show-bookmarks"]',
  ]),
  "show-downloads": Object.freeze([
    'button[data-fennevia-browser-tool="downloads"]',
  ]),
  "show-translate": Object.freeze([
    'button[data-fennevia-browser-tool="translate"]',
  ]),
  tabs: Object.freeze([
    '[role="tablist"][data-fennevia-tab-list]',
    'button[role="tab"][data-fennevia-tab]',
    "output[data-fennevia-tab-count]",
  ]),
  "toggle-maximize-window": Object.freeze([
    'button[data-fennevia-window-control="toggle-maximize"]',
  ]),
  trust: Object.freeze([
    'button[data-fennevia-trust-status][data-fennevia-browser-tool="site-information"]',
  ]),
});

const orientedProjectWidgets = new Set<ProjectWidgetId>([
  "bookmarks",
  "downloads-status",
  "tabs",
]);

const requiredAddressPopupSelectors = Object.freeze([
  "button[data-fennevia-address-popup-backdrop]",
  'div[role="dialog"][aria-modal="false"][data-fennevia-address-popup]',
  'label[for="fennevia-address-popup-input"]',
  "input#fennevia-address-popup-input[data-fennevia-address-popup-input]",
  "output[data-fennevia-address-popup-status]",
  '[role="listbox"][data-fennevia-urlbar-suggestions]',
  "[data-fennevia-address-popup-details]",
  'button[data-fennevia-trust-detail][data-fennevia-browser-tool="site-information"]',
  'button[data-fennevia-permission-detail][data-fennevia-browser-tool="site-permissions"]',
  "[data-fennevia-urlbar-coverage]",
  "button[data-fennevia-native-urlbar-access]",
  "button[data-fennevia-address-popup-close]",
]);

const directChildWithAttribute = (
  host: HTMLElement,
  name: string,
  value?: string,
): HTMLElement | null =>
  (Array.from(host.children).find(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      child.hasAttribute(name) &&
      (value === undefined || child.getAttribute(name) === value),
  ) as HTMLElement | undefined) ?? null;

const verifyProjectWidget = (
  host: HTMLElement,
  id: ProjectWidgetId,
  direction: ToolbarLayoutDirection,
  windowKind: ShellWindowKind,
): boolean => {
  if (id === "private-indicator" && windowKind === "normal") {
    return true;
  }
  if (
    projectWidgetSelectors[id].some((selector) => !host.querySelector(selector))
  ) {
    return false;
  }
  if (!orientedProjectWidgets.has(id)) {
    return true;
  }
  return (
    host.querySelector(
      `[data-fennevia-orientation="${direction === "row" ? "horizontal" : "vertical"}"]`,
    ) !== null
  );
};

const verifyLayoutNodes = (
  root: HTMLElement,
  nodes: readonly ToolbarLayoutNodeSnapshot[],
  direction: ToolbarLayoutDirection,
  windowKind: ShellWindowKind,
): boolean =>
  nodes.every((node) => {
    const matches = root.querySelectorAll<HTMLElement>(
      `[data-fennevia-layout-instance="${node.instanceId}"]`,
    );
    if (matches.length !== 1) {
      return false;
    }
    const host = matches[0];
    if (node.type === "container") {
      return Boolean(
        directChildWithAttribute(
          host,
          "data-fennevia-layout-container",
          node.direction,
        ) && verifyLayoutNodes(root, node.children, node.direction, windowKind),
      );
    }
    if (node.type === "wrapper") {
      return Boolean(
        directChildWithAttribute(
          host,
          "data-fennevia-layout-wrapper",
          node.kind,
        ) && verifyLayoutNodes(root, node.children, direction, windowKind),
      );
    }
    const content = directChildWithAttribute(
      host,
      "data-fennevia-layout-node-content",
    );
    if (!content) {
      return false;
    }
    if (node.projectId !== "") {
      return verifyProjectWidget(
        content,
        node.projectId,
        direction,
        windowKind,
      );
    }
    if (
      node.widget.kind === "separator" ||
      node.widget.kind === "spacer" ||
      node.widget.kind === "spring"
    ) {
      return (
        content.querySelector(
          `[data-fennevia-layout-special="${node.widget.kind}"]`,
        ) !== null
      );
    }
    return (
      content.querySelector(
        '[data-fennevia-toolbar-widget-item], [data-fennevia-browser-tool="toolbar-widget"]',
      ) !== null
    );
  });

const panelEnabledFor = (
  snapshot: ToolbarWidgetsSnapshot | undefined,
  edge: EdgeName,
): boolean => {
  if (edge === "top") {
    return true;
  }
  if (!snapshot) {
    return false;
  }
  return isToolbarOptionalPanelEnabled(
    edge === "left"
      ? snapshot.panels.leftPanelEnabled
      : edge === "right"
        ? snapshot.panels.rightPanelEnabled
        : snapshot.panels.bottomPanelEnabled,
    snapshot.layout[edge].length,
    false,
  );
};

const hasSurfaceFocusTarget = (root: HTMLElement | null): boolean =>
  Boolean(
    root?.querySelector("[data-fennevia-default-focus]") ??
    root?.querySelector(
      'button:not(:disabled):not([tabindex="-1"]), select:not(:disabled):not([tabindex="-1"]), input:not(:disabled):not([tabindex="-1"])',
    ) ??
    root?.querySelector("[data-fennevia-focus-fallback]"),
  );

const hasConfiguredProgressLight = (
  root: HTMLElement | null | undefined,
  source: ProgressLightSource,
): boolean => {
  if (!root) {
    return false;
  }
  const light = root.querySelector<HTMLElement>(
    "[data-fennevia-progress-light]",
  );
  if (source === "off") {
    return light === null;
  }
  return (
    light?.getAttribute("data-fennevia-progress-light") ===
    (source === "loading" ? "load" : "download")
  );
};

export async function verifyShellAppHealth({
  frame,
  overlayTarget,
  targets,
  windowKind,
}: HealthOptions): Promise<true> {
  const mounted = mountedFrames.get(frame);
  await Promise.all([mounted?.bookmarks.ready(), mounted?.downloads.ready()]);
  const roots = Object.fromEntries(
    edgeNames.map((edge) => [
      edge,
      targets[edge].querySelector<HTMLElement>(
        `#fennevia-shell-${edge}-root${ROOT_SELECTOR}`,
      ),
    ]),
  ) as Record<EdgeName, HTMLElement | null>;
  const toolbarState = mounted?.toolbarWidgets?.snapshot();
  const toolbarSnapshot = toolbarState?.snapshot;
  const shellSnapshot = mounted?.shell.snapshot();
  const customizeEdge = toolbarSnapshot
    ? edgeNames.find(
        (edge) =>
          panelEnabledFor(toolbarSnapshot, edge) &&
          toolbarLayoutContainsProjectWidget(
            toolbarSnapshot.layout[edge],
            "customize-shell",
          ),
      )
    : undefined;
  const addressPopupRoot = overlayTarget.querySelector<HTMLElement>(
    "#fennevia-address-popup-root[data-fennevia-address-popup-root]",
  );
  const template = roots.top?.querySelector<HTMLTemplateElement>(
    "template[data-fennevia-template]",
  );
  const templateConstructor =
    frame.ownerDocument.defaultView?.HTMLTemplateElement;

  if (
    frame.getAttribute(FRAME_READY_ATTRIBUTE) !== "" ||
    !mounted ||
    !toolbarSnapshot ||
    mounted.toolbarWidgets?.status().disposed ||
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
    mounted.urlbarSuggestions.status().disposed ||
    mounted.windowControls.status().disposed ||
    !shellSnapshot ||
    edgeNames.some(
      (edge) =>
        shellSnapshot.surfaces[edge].enabled !==
        panelEnabledFor(toolbarSnapshot, edge),
    ) ||
    edgeNames.some((edge) => {
      const root = roots[edge];
      const enabled = panelEnabledFor(toolbarSnapshot, edge);
      const layoutRoot = root?.querySelector<HTMLElement>(
        `[data-fennevia-composable-layout="${edge}"]`,
      );
      return (
        !root ||
        root.parentElement !== targets[edge] ||
        root.namespaceURI !== XHTML_NAMESPACE ||
        root.getAttribute("data-fennevia-edge") !== edge ||
        root.getAttribute("data-fennevia-enabled") !== String(enabled) ||
        root.getAttribute("data-fennevia-window-kind") !== windowKind ||
        root.querySelector(`[data-fennevia-edge-trigger="${edge}"]`) === null ||
        root.querySelector(
          `[role="region"][data-fennevia-edge-panel="${edge}"]`,
        ) === null ||
        !layoutRoot ||
        !verifyLayoutNodes(
          root,
          toolbarSnapshot.layout[edge],
          defaultToolbarLayoutDirection(edge),
          windowKind,
        ) ||
        Array.from(root.querySelectorAll("*")).some(
          (element) => !hasAllowedProjectNamespace(element),
        ) ||
        (enabled && !hasSurfaceFocusTarget(root))
      );
    }) ||
    edgeNames.some(
      (edge) =>
        targets[edge].getAttribute(MOUNT_STATUS_ATTRIBUTE) !== "mounted",
    ) ||
    overlayTarget.getAttribute(MOUNT_STATUS_ATTRIBUTE) !== "mounted" ||
    !customizeEdge ||
    !roots[customizeEdge]?.querySelector(
      'button[data-fennevia-action="customize-shell"]',
    ) ||
    !hasConfiguredProgressLight(
      roots.top,
      toolbarSnapshot.panels.topProgressLight,
    ) ||
    !hasConfiguredProgressLight(
      roots.bottom,
      toolbarSnapshot.panels.bottomProgressLight,
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
  const shellSnapshot = mounted?.shell.snapshot();
  const toolbarSnapshot = mounted?.toolbarWidgets?.snapshot().snapshot;
  const roots = Object.fromEntries(
    edgeNames.map((edge) => [
      edge,
      targets[edge].querySelector<HTMLElement>(
        `#fennevia-shell-${edge}-root${ROOT_SELECTOR}`,
      ),
    ]),
  ) as Record<EdgeName, HTMLElement | null>;
  const layoutAvailable = Boolean(
    toolbarSnapshot &&
    edgeNames.every(
      (edge) =>
        roots[edge] &&
        verifyLayoutNodes(
          roots[edge] as HTMLElement,
          toolbarSnapshot.layout[edge],
          defaultToolbarLayoutDirection(edge),
          windowKind,
        ),
    ) &&
    edgeNames.some(
      (edge) =>
        panelEnabledFor(toolbarSnapshot, edge) &&
        toolbarLayoutContainsProjectWidget(
          toolbarSnapshot.layout[edge],
          "customize-shell",
        ),
    ),
  );
  return Object.freeze([
    Object.freeze({
      available:
        frame.getAttribute(FRAME_READY_ATTRIBUTE) === "" &&
        edgeNames.every((edge) => roots[edge] !== null) &&
        overlayTarget.querySelector(
          "#fennevia-address-popup-root[data-fennevia-address-popup-root]",
        ) !== null &&
        layoutAvailable,
      name: "frontend.svelte-owned-roots",
    }),
    Object.freeze({
      available: Boolean(
        shellSnapshot &&
        toolbarSnapshot &&
        edgeNames.every(
          (edge) =>
            shellSnapshot.surfaces[edge].phase ===
            (panelEnabledFor(toolbarSnapshot, edge) ? "hidden" : "disabled"),
        ),
      ),
      name: "frontend.edge-controller",
    }),
    Object.freeze({
      available:
        frame.getAttribute(FRAME_ENVIRONMENT_ATTRIBUTE) !== null &&
        shellSnapshot?.enabled ===
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
      available: Boolean(mounted && !mounted.browserTools.status().disposed),
      name: "frontend.browser-tools-state",
    }),
    Object.freeze({
      available: Boolean(mounted && !mounted.windowControls.status().disposed),
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
        !mounted.urlbarSuggestions.status().disposed &&
        overlayTarget.querySelector(
          '[role="listbox"][data-fennevia-urlbar-suggestions]',
        ) &&
        overlayTarget.querySelector(
          'input[role="combobox"][data-fennevia-address-popup-input]',
        ),
      ),
      name: "frontend.urlbar-suggestions-state",
    }),
    Object.freeze({
      available: Boolean(
        mounted &&
        !mounted.addressPopup.status().disposed &&
        !mounted.navigation.status().disposed &&
        overlayTarget.querySelector("[data-fennevia-address-popup-input]"),
      ),
      name: "frontend.address-popup-state",
    }),
    Object.freeze({
      available: Boolean(
        mounted &&
        !mounted.browserTools.status().disposed &&
        overlayTarget.querySelector(
          'button[data-fennevia-trust-detail][data-fennevia-browser-tool="site-information"]',
        ) &&
        overlayTarget.querySelector(
          'button[data-fennevia-permission-detail][data-fennevia-browser-tool="site-permissions"]',
        ),
      ),
      name: "frontend.firefox-site-status",
    }),
    Object.freeze({
      available: Boolean(mounted && !mounted.bookmarks.status().disposed),
      name: "frontend.bookmarks-state",
    }),
    Object.freeze({
      available: Boolean(mounted && !mounted.downloads.status().disposed),
      name: "frontend.downloads-state",
    }),
    Object.freeze({
      available: Boolean(
        toolbarSnapshot &&
        hasConfiguredProgressLight(
          roots.top,
          toolbarSnapshot.panels.topProgressLight,
        ) &&
        hasConfiguredProgressLight(
          roots.bottom,
          toolbarSnapshot.panels.bottomProgressLight,
        ),
      ),
      name: "frontend.progress-lights",
    }),
    Object.freeze({
      available: Boolean(
        toolbarSnapshot &&
        edgeNames.every(
          (edge) =>
            !panelEnabledFor(toolbarSnapshot, edge) ||
            hasSurfaceFocusTarget(roots[edge]),
        ),
      ),
      name: "frontend.edge-keyboard-focus",
    }),
  ]);
}
