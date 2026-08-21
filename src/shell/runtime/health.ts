// SPDX-License-Identifier: MPL-2.0
import { edgeNames } from "../../app/edge-surfaces";
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
} from "./contracts";

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
