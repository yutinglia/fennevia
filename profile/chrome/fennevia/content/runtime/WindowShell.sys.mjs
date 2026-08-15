import {
  annotateShellLifecycleError,
  createShellHealthState,
  createShellLifecycleError,
  emergencyFallbackBinding,
  registerEmergencyFallback,
  runShellHealthCheck,
} from "./HealthState.sys.mjs";
import {
  createFirefoxBridgeBoundary,
  createFirefoxBookmarksBridge,
  createFirefoxDownloadsBridge,
  createFirefoxNavigationBridge,
  createFirefoxTabsBridge,
  createFirefoxUrlbarCoverageBridge,
} from "../firefox/BridgeBoundary.sys.mjs";
import { shellAppCss } from "../shell/ShellStyles.sys.mjs";

const XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const XUL_NAMESPACE =
  "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const BROWSER_DOCUMENT_URI = "chrome://browser/content/browser.xhtml";
const PROJECT_URI = "chrome://fennevia/content/runtime/WindowShell.sys.mjs";
const BRIDGE_PROJECT_URI =
  "chrome://fennevia/content/firefox/BridgeBoundary.sys.mjs";

const EDGE_NAMES = Object.freeze(["top", "left", "right", "bottom"]);
const HOST_IDS = Object.freeze({
  frame: "fennevia-shell-frame-host",
  top: "fennevia-shell-top-host",
  left: "fennevia-shell-left-host",
  right: "fennevia-shell-right-host",
  bottom: "fennevia-shell-bottom-host",
  overlay: "fennevia-shell-address-overlay-host",
});
const MOUNT_IDS = Object.freeze({
  top: "fennevia-shell-top-mount",
  left: "fennevia-shell-left-mount",
  right: "fennevia-shell-right-mount",
  bottom: "fennevia-shell-bottom-mount",
  overlay: "fennevia-shell-address-overlay-mount",
});

const SHELL_STYLE_ID = "fennevia-shell-style";
const SHELL_APP_STYLE_ID = "fennevia-shell-app-style";
const SHELL_APP_SCRIPT_URI = "chrome://fennevia/content/shell/ShellApp.js";
const SHELL_APP_REGISTRATION_KEY = "__fenneviaRegisterShellFrontend";
const DEFAULT_HEALTH_TIMEOUT_MS = 2_000;
const CAPABILITY_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{0,95}$/u;

const STATE_LOG_CODES = Object.freeze({
  active: "FENNEVIA_SHELL_STATE_ACTIVE",
  created: "FENNEVIA_SHELL_STATE_CREATED",
  failed: "FENNEVIA_SHELL_STATE_FAILED",
  healthy: "FENNEVIA_SHELL_STATE_HEALTHY",
  mounted: "FENNEVIA_SHELL_STATE_MOUNTED",
});

const SHELL_STYLE = `
#fennevia-shell-frame-host {
  box-sizing: border-box;
  position: absolute;
  inset: 0;
  z-index: 5;
  min-block-size: 0;
  min-inline-size: 0;
  overflow: visible;
  pointer-events: none;
}

#fennevia-shell-frame-host:not([data-fennevia-environment="normal"]) {
  visibility: hidden;
}

#fennevia-shell-frame-host > [data-fennevia-edge-host],
#fennevia-shell-frame-host [data-fennevia-edge-mount],
#fennevia-shell-frame-host > [data-fennevia-overlay-host],
#fennevia-shell-frame-host [data-fennevia-overlay-mount] {
  box-sizing: border-box;
  position: absolute;
  inset: 0;
  pointer-events: none;
}
`;

const createShellError = (code, domPath) => {
  const error = new Error(code);
  error.name = "FenneviaShellError";
  Object.defineProperties(error, {
    fenneviaCode: {
      value: code,
      enumerable: false,
    },
    fenneviaDomPath: {
      value: domPath,
      enumerable: false,
    },
  });
  return error;
};

const requireElement = ({
  document,
  id,
  localName,
  namespaceURI,
  parent,
  domPath,
  code,
}) => {
  const element = document.getElementById(id);
  if (
    !element ||
    element.localName !== localName ||
    element.namespaceURI !== namespaceURI ||
    element.parentElement !== parent
  ) {
    throw createShellError(code, domPath);
  }
  return element;
};

const validateInsertionPoints = (window) => {
  const document = window?.document;
  if (!document || document.documentURI !== BROWSER_DOCUMENT_URI) {
    throw createShellError(
      "FENNEVIA_SHELL_DOCUMENT_INVALID",
      "html#main-window",
    );
  }

  const root = document.documentElement;
  if (
    root?.id !== "main-window" ||
    root.localName !== "html" ||
    root.namespaceURI !== XHTML_NAMESPACE
  ) {
    throw createShellError("FENNEVIA_SHELL_ROOT_INVALID", "html#main-window");
  }

  const body = document.body;
  if (
    !body ||
    body.localName !== "body" ||
    body.namespaceURI !== XHTML_NAMESPACE ||
    body.parentElement !== root
  ) {
    throw createShellError(
      "FENNEVIA_SHELL_BODY_INVALID",
      "html#main-window>body",
    );
  }

  const navigatorToolbox = requireElement({
    document,
    id: "navigator-toolbox",
    localName: "toolbox",
    namespaceURI: XUL_NAMESPACE,
    parent: body,
    domPath: "html#main-window>body>#navigator-toolbox",
    code: "FENNEVIA_SHELL_TOOLBOX_INVALID",
  });
  const browser = requireElement({
    document,
    id: "browser",
    localName: "hbox",
    namespaceURI: XUL_NAMESPACE,
    parent: body,
    domPath: "html#main-window>body>#browser",
    code: "FENNEVIA_SHELL_BROWSER_INVALID",
  });
  const tabbox = requireElement({
    document,
    id: "tabbrowser-tabbox",
    localName: "tabbox",
    namespaceURI: XUL_NAMESPACE,
    parent: browser,
    domPath: "html#main-window>body>#browser>#tabbrowser-tabbox",
    code: "FENNEVIA_SHELL_TABBOX_INVALID",
  });
  const windowModalDialog = requireElement({
    document,
    id: "window-modal-dialog",
    localName: "dialog",
    namespaceURI: XHTML_NAMESPACE,
    parent: body,
    domPath: "html#main-window>body>#window-modal-dialog",
    code: "FENNEVIA_SHELL_MODAL_DIALOG_INVALID",
  });
  const accessibilityAnnouncement = requireElement({
    document,
    id: "a11y-announcement",
    localName: "div",
    namespaceURI: XHTML_NAMESPACE,
    parent: body,
    domPath: "html#main-window>body>#a11y-announcement",
    code: "FENNEVIA_SHELL_A11Y_ANCHOR_INVALID",
  });
  const fullscreenToggler = requireElement({
    document,
    id: "fullscr-toggler",
    localName: "div",
    namespaceURI: XHTML_NAMESPACE,
    parent: body,
    domPath: "html#main-window>body>#fullscr-toggler",
    code: "FENNEVIA_SHELL_FULLSCREEN_ANCHOR_INVALID",
  });

  const bodyChildren = Array.from(body.children);
  if (
    bodyChildren.indexOf(windowModalDialog) >=
      bodyChildren.indexOf(navigatorToolbox) ||
    bodyChildren.indexOf(navigatorToolbox) >= bodyChildren.indexOf(browser) ||
    bodyChildren.indexOf(browser) >=
      bodyChildren.indexOf(accessibilityAnnouncement) ||
    bodyChildren.indexOf(accessibilityAnnouncement) >=
      bodyChildren.indexOf(fullscreenToggler)
  ) {
    throw createShellError(
      "FENNEVIA_SHELL_BODY_ORDER_INVALID",
      "html#main-window>body",
    );
  }

  for (const id of [
    ...Object.values(HOST_IDS),
    ...Object.values(MOUNT_IDS),
    SHELL_STYLE_ID,
    SHELL_APP_STYLE_ID,
  ]) {
    if (document.getElementById(id)) {
      throw createShellError("FENNEVIA_SHELL_HOST_ALREADY_EXISTS", `#${id}`);
    }
  }

  return Object.freeze({
    accessibilityAnnouncement,
    body,
    browser,
    document,
    root,
    tabbox,
  });
};

const createElement = (document, localName, options = {}) => {
  const element = document.createElementNS(XHTML_NAMESPACE, localName);
  if (options.id) {
    element.id = options.id;
  }
  if (options.className) {
    element.className = options.className;
  }
  if (options.textContent !== undefined) {
    element.textContent = options.textContent;
  }
  for (const [name, value] of Object.entries(options.attributes ?? {})) {
    element.setAttribute(name, value);
  }
  return element;
};

const EDGE_LABELS = Object.freeze({
  top: "Fennevia top controls surface",
  left: "Fennevia tabs and address surface",
  right: "Fennevia bookmarks surface",
  bottom: "Fennevia downloads surface",
});

const FRAME_ENVIRONMENT_ATTRIBUTE = "data-fennevia-environment";
const FRAME_FULLSCREEN_ATTRIBUTE = "data-fennevia-browser-fullscreen";
const FRAME_LIFECYCLE_ATTRIBUTE = "data-fennevia-lifecycle-state";

const findTabDialog = (browser) => {
  if (typeof browser.querySelector === "function") {
    return browser.querySelector("browser[tabDialogShowing]");
  }
  return descendantsOf(browser).find(
    (element) =>
      element.localName === "browser" &&
      element.hasAttribute?.("tabDialogShowing"),
  );
};

const readFrameEnvironment = ({ root, browser }) => {
  if (root.hasAttribute("customizing")) {
    return "customize-mode";
  }
  if (root.hasAttribute("inDOMFullscreen")) {
    return "dom-fullscreen";
  }
  if (root.hasAttribute("window-modal-open") || findTabDialog(browser)) {
    return "native-dialog";
  }
  return "normal";
};

const createFrameEnvironmentObserver = ({
  window,
  root,
  browser,
  frame,
  onError,
}) => {
  const MutationObserverConstructor = window?.MutationObserver;
  if (typeof MutationObserverConstructor !== "function") {
    throw createShellError(
      "FENNEVIA_SHELL_MUTATION_OBSERVER_UNAVAILABLE",
      "html#main-window",
    );
  }

  let disposed = false;
  const update = () => {
    frame.setAttribute(
      FRAME_ENVIRONMENT_ATTRIBUTE,
      readFrameEnvironment({ root, browser }),
    );
    if (root.hasAttribute("inFullscreen")) {
      frame.setAttribute(FRAME_FULLSCREEN_ATTRIBUTE, "");
    } else {
      frame.removeAttribute(FRAME_FULLSCREEN_ATTRIBUTE);
    }
  };
  const observer = new MutationObserverConstructor(() => {
    if (disposed) {
      return;
    }
    try {
      update();
    } catch (error) {
      try {
        frame.setAttribute(FRAME_ENVIRONMENT_ATTRIBUTE, "controller-failure");
      } finally {
        onError(error);
      }
    }
  });

  update();
  observer.observe(root, {
    attributes: true,
    attributeFilter: [
      "customizing",
      "inDOMFullscreen",
      "inFullscreen",
      "window-modal-open",
    ],
  });
  observer.observe(browser, {
    attributes: true,
    attributeFilter: ["tabDialogShowing"],
    subtree: true,
  });

  return Object.freeze({
    dispose() {
      if (disposed) {
        return false;
      }
      disposed = true;
      observer.disconnect();
      return true;
    },
    snapshot() {
      return Object.freeze({
        environment: frame.getAttribute(FRAME_ENVIRONMENT_ATTRIBUTE),
        registered: !disposed,
      });
    },
  });
};

const createEdgeHostController = ({ document, edge, frame }) => {
  const host = createElement(document, "section", {
    id: HOST_IDS[edge],
    className: `fennevia-shell-edge-host fennevia-shell-edge-host--${edge}`,
    attributes: {
      "aria-label": EDGE_LABELS[edge],
      "data-fennevia-edge-host": edge,
      "data-fennevia-lifecycle-state": "created",
    },
  });
  const target = createElement(document, "div", {
    id: MOUNT_IDS[edge],
    className: `fennevia-shell-edge-mount fennevia-shell-edge-mount--${edge}`,
    attributes: {
      "data-fennevia-edge-mount": edge,
      "data-fennevia-framework-status": "unmounted",
    },
  });
  host.append(target);
  let state = "created";

  return Object.freeze({
    attach() {
      if (state === "attached") {
        return false;
      }
      if (state === "disposed") {
        throw createShellError(
          "FENNEVIA_SHELL_EDGE_ATTACH_STATE_INVALID",
          `#${HOST_IDS[edge]}`,
        );
      }
      frame.append(host);
      state = "attached";
      return true;
    },
    detach() {
      if (state === "disposed" || state === "detached") {
        return false;
      }
      host.remove();
      state = "detached";
      return true;
    },
    dispose() {
      if (state === "disposed") {
        return false;
      }
      host.remove();
      state = "disposed";
      return true;
    },
    getMountPoint() {
      return Object.freeze({ edge, host, target });
    },
    setLifecycleState(nextState) {
      host.setAttribute(FRAME_LIFECYCLE_ATTRIBUTE, nextState);
    },
    snapshot() {
      return Object.freeze({ edge, state });
    },
    verify(expectedIndex) {
      const edgeHosts = Array.from(frame.children).filter((element) =>
        element.hasAttribute("data-fennevia-edge-host"),
      );
      if (
        state !== "attached" ||
        document.getElementById(HOST_IDS[edge]) !== host ||
        document.getElementById(MOUNT_IDS[edge]) !== target ||
        host.parentElement !== frame ||
        target.parentElement !== host ||
        edgeHosts.indexOf(host) !== expectedIndex
      ) {
        throw createShellError(
          "FENNEVIA_SHELL_EDGE_OWNERSHIP_INVALID",
          `#${HOST_IDS.frame}>#${HOST_IDS[edge]}`,
        );
      }
      return true;
    },
  });
};

const createAddressOverlayHostController = ({ document, frame }) => {
  const host = createElement(document, "section", {
    id: HOST_IDS.overlay,
    className:
      "fennevia-shell-overlay-host fennevia-shell-overlay-host--address",
    attributes: {
      "aria-label": "Fennevia address and search popup layer",
      "data-fennevia-overlay-host": "address",
      "data-fennevia-lifecycle-state": "created",
    },
  });
  const target = createElement(document, "div", {
    id: MOUNT_IDS.overlay,
    className:
      "fennevia-shell-overlay-mount fennevia-shell-overlay-mount--address",
    attributes: {
      "data-fennevia-overlay-mount": "address",
      "data-fennevia-framework-status": "unmounted",
    },
  });
  host.append(target);
  let state = "created";

  return Object.freeze({
    attach() {
      if (state === "attached") {
        return false;
      }
      if (state === "disposed") {
        throw createShellError(
          "FENNEVIA_SHELL_OVERLAY_ATTACH_STATE_INVALID",
          `#${HOST_IDS.overlay}`,
        );
      }
      frame.append(host);
      state = "attached";
      return true;
    },
    detach() {
      if (state === "disposed" || state === "detached") {
        return false;
      }
      host.remove();
      state = "detached";
      return true;
    },
    dispose() {
      if (state === "disposed") {
        return false;
      }
      host.remove();
      state = "disposed";
      return true;
    },
    getMountPoint() {
      return Object.freeze({ host, kind: "address", target });
    },
    setLifecycleState(nextState) {
      host.setAttribute(FRAME_LIFECYCLE_ATTRIBUTE, nextState);
    },
    snapshot() {
      return Object.freeze({ kind: "address", state });
    },
    verify() {
      if (
        state !== "attached" ||
        document.getElementById(HOST_IDS.overlay) !== host ||
        document.getElementById(MOUNT_IDS.overlay) !== target ||
        host.parentElement !== frame ||
        target.parentElement !== host ||
        Array.from(frame.children).at(-1) !== host
      ) {
        throw createShellError(
          "FENNEVIA_SHELL_OVERLAY_OWNERSHIP_INVALID",
          `#${HOST_IDS.frame}>#${HOST_IDS.overlay}`,
        );
      }
      return true;
    },
  });
};

const createDetachedHosts = ({ document }) => {
  const frame = createElement(document, "div", {
    id: HOST_IDS.frame,
    className: "fennevia-shell-frame-host",
    attributes: {
      "aria-label": "Fennevia floating browser shell",
      "data-fennevia-host": "frame",
      "data-fennevia-lifecycle-state": "created",
      "data-fennevia-environment": "normal",
    },
  });
  const style = createElement(document, "style", {
    id: SHELL_STYLE_ID,
    textContent: SHELL_STYLE,
  });
  frame.append(style);
  const edges = Object.freeze(
    Object.fromEntries(
      EDGE_NAMES.map((edge) => [
        edge,
        createEdgeHostController({ document, edge, frame }),
      ]),
    ),
  );
  const overlay = createAddressOverlayHostController({ document, frame });
  const mountPoints = Object.freeze({
    frame,
    overlay: overlay.getMountPoint(),
    surfaces: Object.freeze(
      Object.fromEntries(
        EDGE_NAMES.map((edge) => [edge, edges[edge].getMountPoint()]),
      ),
    ),
  });

  return Object.freeze({ edges, frame, mountPoints, overlay, style });
};

const descendantsOf = (element) => [
  element,
  ...Array.from(element.children ?? []).flatMap(descendantsOf),
];

export function createShellHosts({
  window,
  windowKind,
  onEnvironmentError = () => {},
}) {
  if (windowKind !== "normal" && windowKind !== "private") {
    throw createShellError(
      "FENNEVIA_SHELL_WINDOW_KIND_INVALID",
      "html#main-window",
    );
  }

  let insertionPoints = validateInsertionPoints(window);
  if (typeof onEnvironmentError !== "function") {
    throw createShellError(
      "FENNEVIA_SHELL_ENVIRONMENT_CALLBACK_INVALID",
      "html#main-window",
    );
  }
  const hosts = createDetachedHosts({ document: insertionPoints.document });
  let environmentObserver;
  let state = "created";

  const detach = () => {
    if (state === "disposed" || state === "detached") {
      return false;
    }

    let firstError;
    try {
      environmentObserver?.dispose();
    } catch (error) {
      firstError = error;
    }
    environmentObserver = undefined;
    try {
      hosts.overlay.detach();
    } catch (error) {
      firstError ??= error;
    }
    for (const edge of [...EDGE_NAMES].reverse()) {
      try {
        hosts.edges[edge].detach();
      } catch (error) {
        firstError ??= error;
      }
    }
    try {
      hosts.frame.remove();
    } catch (error) {
      firstError ??= error;
    }
    state = "detached";
    if (firstError) {
      throw firstError;
    }
    return true;
  };

  const controller = {
    attach() {
      if (state === "attached") {
        return false;
      }
      if (state === "disposed" || state === "failed") {
        throw createShellError(
          "FENNEVIA_SHELL_ATTACH_STATE_INVALID",
          "html#main-window>body",
        );
      }

      insertionPoints = validateInsertionPoints(window);
      let currentDomPath =
        "html#main-window>body>#browser>#fennevia-shell-frame-host";
      try {
        insertionPoints.browser.insertBefore(
          hosts.frame,
          insertionPoints.tabbox,
        );
        for (const edge of EDGE_NAMES) {
          currentDomPath = `#${HOST_IDS.frame}>#${HOST_IDS[edge]}`;
          hosts.edges[edge].attach();
        }
        currentDomPath = `#${HOST_IDS.frame}>#${HOST_IDS.overlay}`;
        hosts.overlay.attach();
        currentDomPath = `#${HOST_IDS.frame}`;
        environmentObserver = createFrameEnvironmentObserver({
          window,
          root: insertionPoints.root,
          browser: insertionPoints.browser,
          frame: hosts.frame,
          onError: onEnvironmentError,
        });
        state = "attached";
        return true;
      } catch (error) {
        try {
          detach();
        } catch {
          // The initializer reports the causal attachment failure. Window
          // cleanup will make another best-effort pass over exact host nodes.
        }
        state = "failed";
        if (error?.fenneviaCode) {
          throw error;
        }
        throw createShellError(
          "FENNEVIA_SHELL_HOST_ATTACH_FAILED",
          currentDomPath,
        );
      }
    },

    detach,

    getMountPoints() {
      return hosts.mountPoints;
    },

    setDiagnosticState(nextState) {
      if (!Object.hasOwn(STATE_LOG_CODES, nextState)) {
        throw createShellError(
          "FENNEVIA_SHELL_DIAGNOSTIC_STATE_INVALID",
          `#${HOST_IDS.frame}`,
        );
      }
      hosts.frame.setAttribute(FRAME_LIFECYCLE_ATTRIBUTE, nextState);
      for (const edge of EDGE_NAMES) {
        hosts.edges[edge].setLifecycleState(nextState);
      }
      hosts.overlay.setLifecycleState(nextState);
      return true;
    },

    verifyHealth() {
      if (state !== "attached") {
        throw createShellError(
          "FENNEVIA_SHELL_HOSTS_NOT_ATTACHED",
          "html#main-window>body",
        );
      }
      const { document } = insertionPoints;
      if (
        document.getElementById(HOST_IDS.frame) !== hosts.frame ||
        hosts.frame.parentElement !== insertionPoints.browser
      ) {
        throw createShellError(
          "FENNEVIA_SHELL_HOST_OWNERSHIP_INVALID",
          "html#main-window>body",
        );
      }
      const browserChildren = Array.from(insertionPoints.browser.children);
      if (
        browserChildren.indexOf(hosts.frame) + 1 !==
          browserChildren.indexOf(insertionPoints.tabbox) ||
        !environmentObserver?.snapshot().registered ||
        ![
          "normal",
          "customize-mode",
          "dom-fullscreen",
          "native-dialog",
        ].includes(hosts.frame.getAttribute(FRAME_ENVIRONMENT_ATTRIBUTE))
      ) {
        throw createShellError(
          "FENNEVIA_SHELL_HOST_PLACEMENT_INVALID",
          "html#main-window>body",
        );
      }
      if (
        document.getElementById(SHELL_STYLE_ID) !== hosts.style ||
        hosts.style.parentElement !== hosts.frame
      ) {
        throw createShellError(
          "FENNEVIA_SHELL_STYLESHEET_MISSING",
          `#${HOST_IDS.frame}>#${SHELL_STYLE_ID}`,
        );
      }

      let cssRuleCount = 0;
      try {
        cssRuleCount = hosts.style.sheet?.cssRules?.length ?? 0;
      } catch {
        cssRuleCount = 0;
      }
      if (cssRuleCount < 1) {
        throw createShellError(
          "FENNEVIA_SHELL_STYLESHEET_UNAVAILABLE",
          `#${HOST_IDS.frame}>#${SHELL_STYLE_ID}`,
        );
      }

      for (const [index, edge] of EDGE_NAMES.entries()) {
        hosts.edges[edge].verify(index);
      }
      hosts.overlay.verify();
      if (
        descendantsOf(hosts.frame).some(
          (element) => element.namespaceURI !== XHTML_NAMESPACE,
        )
      ) {
        throw createShellError(
          "FENNEVIA_SHELL_HOST_NAMESPACE_INVALID",
          `#${HOST_IDS.frame}`,
        );
      }
      return true;
    },

    dispose() {
      if (state === "disposed") {
        return false;
      }
      try {
        detach();
      } finally {
        try {
          hosts.overlay.dispose();
        } catch {
          // `detach` already surfaces the first exact cleanup failure.
        }
        for (const edge of [...EDGE_NAMES].reverse()) {
          try {
            hosts.edges[edge].dispose();
          } catch {
            // `detach` already surfaces the first exact cleanup failure.
          }
        }
        insertionPoints = null;
        state = "disposed";
      }
      return true;
    },

    snapshot() {
      return Object.freeze({
        edges: Object.freeze(
          Object.fromEntries(
            EDGE_NAMES.map((edge) => [edge, hosts.edges[edge].snapshot()]),
          ),
        ),
        environment: environmentObserver?.snapshot().environment ?? null,
        hostCount: state === "attached" ? EDGE_NAMES.length + 1 : 0,
        overlay: hosts.overlay.snapshot(),
        state,
        windowKind,
      });
    },
  };

  return Object.freeze(controller);
}

const createCleanupStack = (onCleanupError) => {
  const callbacks = [];
  let disposed = false;

  return Object.freeze({
    add(callback) {
      if (typeof callback !== "function") {
        throw createShellLifecycleError(
          "FENNEVIA_SHELL_CLEANUP_INVALID",
          "shell-cleanup-register",
        );
      }
      if (disposed) {
        try {
          callback();
        } catch (error) {
          onCleanupError(error);
        }
        return () => {};
      }

      let active = true;
      callbacks.push(callback);
      return () => {
        if (!active || disposed) {
          return false;
        }
        active = false;
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
          callbacks.splice(index, 1);
        }
        return true;
      };
    },

    dispose() {
      if (disposed) {
        return false;
      }
      disposed = true;
      while (callbacks.length) {
        try {
          callbacks.pop()();
        } catch (error) {
          onCleanupError(error);
        }
      }
      return true;
    },

    get size() {
      return callbacks.length;
    },
  });
};

const validateRequiredCapabilities = (capabilities) => {
  if (!Array.isArray(capabilities)) {
    throw createShellLifecycleError(
      "FENNEVIA_SHELL_CAPABILITIES_INVALID",
      "shell-health-check",
    );
  }
  for (const capability of capabilities) {
    const requirement = capability?.requirement ?? "required";
    if (
      !capability ||
      !CAPABILITY_PATTERN.test(String(capability.name ?? "")) ||
      typeof capability.available !== "boolean" ||
      (requirement !== "required" && requirement !== "optional")
    ) {
      throw createShellLifecycleError(
        "FENNEVIA_SHELL_CAPABILITY_RESULT_INVALID",
        "shell-health-check",
      );
    }
    if (requirement === "required" && !capability.available) {
      throw createShellLifecycleError(
        "FENNEVIA_SHELL_CAPABILITY_MISSING",
        "shell-health-check",
        { capability: capability.name },
      );
    }
  }
  return true;
};

const defaultMountShell = () => undefined;
const defaultCheckHealth = () => true;

const productionShellByFrame = new WeakMap();

const loadProductionFrontend = (target) => {
  const browserWindow = target.ownerDocument?.defaultView;
  if (
    !browserWindow ||
    typeof Services?.scriptloader?.loadSubScript !== "function"
  ) {
    throw createShellLifecycleError(
      "FENNEVIA_FRONTEND_LOADER_UNAVAILABLE",
      "shell-frontend-load",
    );
  }
  if (SHELL_APP_REGISTRATION_KEY in browserWindow) {
    throw createShellLifecycleError(
      "FENNEVIA_FRONTEND_REGISTRATION_COLLISION",
      "shell-frontend-load",
    );
  }

  let frontend;
  let registrationCount = 0;
  Object.defineProperty(browserWindow, SHELL_APP_REGISTRATION_KEY, {
    configurable: true,
    value(candidate) {
      registrationCount += 1;
      frontend = candidate;
    },
  });

  let removed = false;
  let loadError;
  try {
    Services.scriptloader.loadSubScript(
      SHELL_APP_SCRIPT_URI,
      browserWindow,
      "UTF-8",
    );
  } catch (error) {
    loadError = error;
  } finally {
    removed = Reflect.deleteProperty(browserWindow, SHELL_APP_REGISTRATION_KEY);
  }
  if (loadError) {
    throw annotateShellLifecycleError(loadError, {
      code: "FENNEVIA_FRONTEND_SCRIPT_LOAD_FAILED",
      phase: "shell-frontend-load",
    });
  }

  const expectedKeys = [
    "getShellAppCapabilities",
    "mountShellApp",
    "verifyShellAppHealth",
  ];
  if (
    !removed ||
    registrationCount !== 1 ||
    !frontend ||
    !Object.isFrozen(frontend) ||
    JSON.stringify(Object.keys(frontend).sort()) !==
      JSON.stringify(expectedKeys) ||
    expectedKeys.some((key) => typeof frontend[key] !== "function")
  ) {
    throw createShellLifecycleError(
      "FENNEVIA_FRONTEND_REGISTRATION_INVALID",
      "shell-frontend-load",
    );
  }
  return frontend;
};

const getProductionAppMounts = (mountPoints) => {
  const frame = mountPoints?.frame;
  if (
    frame?.id !== HOST_IDS.frame ||
    frame.namespaceURI !== XHTML_NAMESPACE ||
    frame.ownerDocument.getElementById(HOST_IDS.frame) !== frame
  ) {
    throw createShellLifecycleError(
      "FENNEVIA_FRONTEND_FRAME_UNAVAILABLE",
      "shell-frontend-mount",
    );
  }
  const targets = Object.freeze(
    Object.fromEntries(
      EDGE_NAMES.map((edge) => {
        const mountPoint = mountPoints.surfaces?.[edge];
        const target = mountPoint?.target;
        if (
          mountPoint?.edge !== edge ||
          mountPoint.host?.id !== HOST_IDS[edge] ||
          mountPoint.host?.parentElement !== frame ||
          target?.id !== MOUNT_IDS[edge] ||
          target.parentElement !== mountPoint.host ||
          target.namespaceURI !== XHTML_NAMESPACE
        ) {
          throw createShellLifecycleError(
            "FENNEVIA_FRONTEND_TARGET_UNAVAILABLE",
            "shell-frontend-mount",
          );
        }
        return [edge, target];
      }),
    ),
  );
  const overlayMountPoint = mountPoints.overlay;
  const overlayTarget = overlayMountPoint?.target;
  if (
    overlayMountPoint?.kind !== "address" ||
    overlayMountPoint.host?.id !== HOST_IDS.overlay ||
    overlayMountPoint.host?.parentElement !== frame ||
    overlayTarget?.id !== MOUNT_IDS.overlay ||
    overlayTarget.parentElement !== overlayMountPoint.host ||
    overlayTarget.namespaceURI !== XHTML_NAMESPACE
  ) {
    throw createShellLifecycleError(
      "FENNEVIA_FRONTEND_OVERLAY_TARGET_UNAVAILABLE",
      "shell-frontend-mount",
    );
  }
  return Object.freeze({ frame, overlayTarget, targets });
};

const mountProductionShell = ({
  browserWindow,
  buildId,
  contextId,
  firefoxVersion,
  logger,
  mountPoints,
  windowKind,
  reportError,
  requestFallback,
}) => {
  if (typeof shellAppCss !== "string" || shellAppCss.trim().length === 0) {
    throw createShellLifecycleError(
      "FENNEVIA_FRONTEND_STYLES_EMPTY",
      "shell-frontend-mount",
    );
  }

  const { frame, overlayTarget, targets } = getProductionAppMounts(mountPoints);
  if (frame.ownerDocument.defaultView !== browserWindow) {
    throw createShellLifecycleError(
      "FENNEVIA_FIREFOX_CONTEXT_WINDOW_MISMATCH",
      "firefox-context-create",
    );
  }
  const bridge = createFirefoxBridgeBoundary({
    buildId,
    contextId,
    firefoxVersion,
    window: browserWindow,
    windowKind,
  });

  let disposeApp;
  let bookmarksBridge;
  let downloadsBridge;
  let navigationBridge;
  let style;
  let tabsBridge;
  let urlbarCoverageBridge;
  try {
    logger.info({
      event: "bridge.boundary-created",
      phase: "firefox-context-create",
      code: "FENNEVIA_FIREFOX_BRIDGE_CREATED",
      windowKind,
      opaqueId: contextId,
      projectUri: BRIDGE_PROJECT_URI,
    });
    bookmarksBridge = createFirefoxBookmarksBridge({
      boundary: bridge,
      moduleLoader(uri) {
        return ChromeUtils.importESModule(uri);
      },
      onError(error) {
        requestFallback(
          annotateShellLifecycleError(error, {
            code:
              error?.fenneviaCode ??
              "FENNEVIA_FIREFOX_BOOKMARKS_RUNTIME_FAILED",
            phase: error?.fenneviaPhase ?? "firefox-bookmarks-observer",
          }),
        );
      },
      window: browserWindow,
    });
    downloadsBridge = createFirefoxDownloadsBridge({
      boundary: bridge,
      moduleLoader(uri) {
        return ChromeUtils.importESModule(uri);
      },
      onError(error) {
        requestFallback(
          annotateShellLifecycleError(error, {
            code:
              error?.fenneviaCode ??
              "FENNEVIA_FIREFOX_DOWNLOADS_RUNTIME_FAILED",
            phase: error?.fenneviaPhase ?? "firefox-downloads-event",
          }),
        );
      },
      window: browserWindow,
    });
    tabsBridge = createFirefoxTabsBridge({
      boundary: bridge,
      onError: reportError,
      window: browserWindow,
    });
    navigationBridge = createFirefoxNavigationBridge({
      boundary: bridge,
      onError(error) {
        requestFallback(
          annotateShellLifecycleError(error, {
            code:
              error?.fenneviaCode ??
              "FENNEVIA_FIREFOX_NAVIGATION_RUNTIME_FAILED",
            phase: error?.fenneviaPhase ?? "firefox-navigation-event",
          }),
        );
      },
      window: browserWindow,
    });
    urlbarCoverageBridge = createFirefoxUrlbarCoverageBridge({
      boundary: bridge,
      onError(error) {
        requestFallback(
          annotateShellLifecycleError(error, {
            code:
              error?.fenneviaCode ??
              "FENNEVIA_FIREFOX_URLBAR_COVERAGE_RUNTIME_FAILED",
            phase: error?.fenneviaPhase ?? "firefox-urlbar-coverage-event",
          }),
        );
      },
      window: browserWindow,
    });
    style = createElement(frame.ownerDocument, "style", {
      id: SHELL_APP_STYLE_ID,
      textContent: shellAppCss,
    });
    frame.insertBefore(style, mountPoints.surfaces.top.host);

    const frontend = loadProductionFrontend(targets.top);
    const candidateDisposeApp = frontend.mountShellApp({
      bookmarks: bookmarksBridge.bookmarks,
      downloads: downloadsBridge.downloads,
      frame,
      navigation: navigationBridge.navigation,
      overlayTarget,
      targets,
      tabs: tabsBridge.tabs,
      urlbarCoverage: urlbarCoverageBridge.urlbarCoverage,
      windowKind,
      onFatalError(error) {
        requestFallback(
          annotateShellLifecycleError(error, {
            code:
              error?.fenneviaCode ?? "FENNEVIA_EDGE_CONTROLLER_RUNTIME_FAILED",
            phase: error?.fenneviaPhase ?? "edge-surface-controller",
          }),
        );
      },
      onUnmountError(error) {
        reportError(
          annotateShellLifecycleError(error, {
            code: "FENNEVIA_FRONTEND_UNMOUNT_REJECTED",
            phase: "shell-frontend-unmount",
          }),
        );
      },
    });
    if (typeof candidateDisposeApp !== "function") {
      throw createShellLifecycleError(
        "FENNEVIA_FRONTEND_DISPOSER_INVALID",
        "shell-frontend-mount",
      );
    }
    disposeApp = candidateDisposeApp;
    productionShellByFrame.set(frame, {
      bookmarksBridge,
      bridge,
      downloadsBridge,
      frontend,
      logger,
      navigationBridge,
      readyLogged: false,
      tabsBridge,
      urlbarCoverageBridge,
    });
  } catch (error) {
    productionShellByFrame.delete(frame);
    style?.remove();
    try {
      bookmarksBridge?.dispose();
    } catch (cleanupError) {
      reportError(cleanupError);
    }
    try {
      downloadsBridge?.dispose();
    } catch (cleanupError) {
      reportError(cleanupError);
    }
    try {
      urlbarCoverageBridge?.dispose();
    } catch (cleanupError) {
      reportError(cleanupError);
    }
    try {
      navigationBridge?.dispose();
    } catch (cleanupError) {
      reportError(cleanupError);
    }
    try {
      tabsBridge?.dispose();
    } catch (cleanupError) {
      reportError(cleanupError);
    }
    try {
      if (bridge.dispose()) {
        logger.info({
          event: "bridge.boundary-disposed",
          phase: "firefox-context-dispose",
          code: "FENNEVIA_FIREFOX_BRIDGE_DISPOSED",
          windowKind,
          opaqueId: contextId,
          projectUri: BRIDGE_PROJECT_URI,
        });
      }
    } catch (cleanupError) {
      reportError(cleanupError);
    }
    throw annotateShellLifecycleError(error, {
      code: error?.fenneviaCode ?? "FENNEVIA_FRONTEND_MOUNT_FAILED",
      phase: error?.fenneviaPhase ?? "shell-frontend-mount",
    });
  }

  return () => {
    let firstError;
    try {
      disposeApp();
    } catch (error) {
      firstError = error;
    }
    productionShellByFrame.delete(frame);
    try {
      style?.remove();
    } catch (error) {
      firstError ??= error;
    }
    try {
      bookmarksBridge?.dispose();
    } catch (error) {
      firstError ??= error;
    }
    try {
      downloadsBridge?.dispose();
    } catch (error) {
      firstError ??= error;
    }
    try {
      urlbarCoverageBridge?.dispose();
    } catch (error) {
      firstError ??= error;
    }
    try {
      navigationBridge?.dispose();
    } catch (error) {
      firstError ??= error;
    }
    try {
      tabsBridge?.dispose();
    } catch (error) {
      firstError ??= error;
    }
    try {
      if (bridge.dispose()) {
        logger.info({
          event: "bridge.boundary-disposed",
          phase: "firefox-context-dispose",
          code: "FENNEVIA_FIREFOX_BRIDGE_DISPOSED",
          windowKind,
          opaqueId: contextId,
          projectUri: BRIDGE_PROJECT_URI,
        });
      }
    } catch (error) {
      firstError ??= error;
    }
    if (firstError) {
      throw annotateShellLifecycleError(firstError, {
        code: firstError?.fenneviaCode ?? "FENNEVIA_FRONTEND_UNMOUNT_FAILED",
        phase: firstError?.fenneviaPhase ?? "shell-frontend-unmount",
      });
    }
  };
};

const checkProductionShell = async ({ mountPoints, windowKind }) => {
  const { frame, overlayTarget, targets } = getProductionAppMounts(mountPoints);
  const record = productionShellByFrame.get(frame);
  if (!record) {
    throw createShellLifecycleError(
      "FENNEVIA_FRONTEND_INSTANCE_UNAVAILABLE",
      "shell-frontend-health",
    );
  }
  const style = frame.ownerDocument.getElementById(SHELL_APP_STYLE_ID);
  if (style?.parentElement !== frame) {
    throw createShellLifecycleError(
      "FENNEVIA_FRONTEND_STYLESHEET_MISSING",
      "shell-frontend-health",
    );
  }
  let cssRuleCount = 0;
  try {
    cssRuleCount = style.sheet?.cssRules?.length ?? 0;
  } catch {
    cssRuleCount = 0;
  }
  if (cssRuleCount < 1) {
    throw createShellLifecycleError(
      "FENNEVIA_FRONTEND_STYLESHEET_UNAVAILABLE",
      "shell-frontend-health",
    );
  }
  record.bookmarksBridge.assertRequiredCapabilities();
  await record.downloadsBridge.ready();
  record.downloadsBridge.assertRequiredCapabilities();
  record.navigationBridge.assertRequiredCapabilities();
  record.tabsBridge.assertRequiredCapabilities();
  record.urlbarCoverageBridge.assertRequiredCapabilities();
  return record.frontend.verifyShellAppHealth({
    frame,
    overlayTarget,
    targets,
    windowKind,
  });
};

const getProductionCapabilities = ({ mountPoints, windowKind }) => {
  const { frame, overlayTarget, targets } = getProductionAppMounts(mountPoints);
  const record = productionShellByFrame.get(frame);
  if (!record) {
    throw createShellLifecycleError(
      "FENNEVIA_FRONTEND_INSTANCE_UNAVAILABLE",
      "shell-frontend-health",
    );
  }
  const bridgeCapabilities = record.bridge.assertRequiredCapabilities();
  const bookmarksCapabilities =
    record.bookmarksBridge.assertRequiredCapabilities();
  const downloadsCapabilities =
    record.downloadsBridge.assertRequiredCapabilities();
  const navigationCapabilities =
    record.navigationBridge.assertRequiredCapabilities();
  const tabsCapabilities = record.tabsBridge.assertRequiredCapabilities();
  const urlbarCoverageCapabilities =
    record.urlbarCoverageBridge.assertRequiredCapabilities();
  const frontendCapabilities = record.frontend.getShellAppCapabilities({
    frame,
    overlayTarget,
    targets,
    windowKind,
  });
  if (!record.readyLogged) {
    record.readyLogged = true;
    record.logger.info({
      event: "bridge.boundary-ready",
      phase: "firefox-bridge-capability",
      code: "FENNEVIA_FIREFOX_BRIDGE_READY",
      windowKind,
      opaqueId: record.bridge.snapshot().contextId,
      projectUri: BRIDGE_PROJECT_URI,
    });
  }
  return Object.freeze([
    ...bridgeCapabilities,
    ...bookmarksCapabilities,
    ...downloadsCapabilities,
    ...navigationCapabilities,
    ...tabsCapabilities,
    ...urlbarCoverageCapabilities,
    ...frontendCapabilities,
  ]);
};

export function createWindowShellLifecycle({
  context,
  logger,
  appInfo,
  mountShell = defaultMountShell,
  checkHealth = defaultCheckHealth,
  getRequiredCapabilities = () => [],
  healthTimeoutMs = DEFAULT_HEALTH_TIMEOUT_MS,
}) {
  if (
    !context ||
    typeof context.isDisposed !== "function" ||
    !context.signal ||
    typeof context.signal.addEventListener !== "function" ||
    typeof context.signal.removeEventListener !== "function" ||
    (context.windowKind !== "normal" && context.windowKind !== "private")
  ) {
    throw createShellLifecycleError(
      "FENNEVIA_SHELL_CONTEXT_INVALID",
      "shell-lifecycle-create",
    );
  }
  if (
    typeof logger?.info !== "function" ||
    typeof logger?.error !== "function"
  ) {
    throw createShellLifecycleError(
      "FENNEVIA_SHELL_LOGGER_UNAVAILABLE",
      "shell-lifecycle-create",
    );
  }
  if (!appInfo) {
    throw createShellLifecycleError(
      "FENNEVIA_SHELL_APP_INFO_UNAVAILABLE",
      "shell-lifecycle-create",
    );
  }
  if (
    typeof mountShell !== "function" ||
    typeof checkHealth !== "function" ||
    typeof getRequiredCapabilities !== "function"
  ) {
    throw createShellLifecycleError(
      "FENNEVIA_SHELL_COLLABORATOR_INVALID",
      "shell-lifecycle-create",
    );
  }

  let shell;
  let healthState;
  let emergencyFallback;
  let startPromise;
  let started = false;
  let disposed = false;
  let failureLogged = false;
  let cancelledDuringStart = false;
  let contextAbortRegistered = false;
  const healthAbortController = new AbortController();

  const logCleanupError = (error) => {
    logger.error({
      event: "shell.cleanup-failed",
      phase: error?.fenneviaPhase ?? "shell-cleanup",
      code: error?.fenneviaCode ?? "FENNEVIA_SHELL_CLEANUP_FAILED",
      windowKind: context.windowKind,
      opaqueId: context.opaqueId,
      projectUri: PROJECT_URI,
      domPath: error?.fenneviaDomPath,
      error,
    });
  };
  const cleanup = createCleanupStack(logCleanupError);

  const logState = (state) => {
    logger.info({
      event: "shell.state-changed",
      phase: `shell-state-${state}`,
      code: STATE_LOG_CODES[state],
      shellState: state,
      windowKind: context.windowKind,
      opaqueId: context.opaqueId,
      projectUri: PROJECT_URI,
    });
  };

  const reportFailure = (error) => {
    if (failureLogged) {
      return error;
    }
    failureLogged = true;

    if (healthState && healthState.snapshot().state !== "disposed") {
      try {
        if (healthState.fail()) {
          shell?.setDiagnosticState("failed");
          logState("failed");
        }
      } catch (stateError) {
        logCleanupError(stateError);
      }
    }

    const phase = error?.fenneviaPhase ?? "shell-lifecycle";
    logger.error({
      event:
        phase === "shell-host-attach"
          ? "shell.hosts-failed"
          : "shell.lifecycle-failed",
      phase,
      code: error?.fenneviaCode ?? "FENNEVIA_SHELL_INITIALIZATION_FAILED",
      windowKind: context.windowKind,
      opaqueId: context.opaqueId,
      projectUri: PROJECT_URI,
      domPath: error?.fenneviaDomPath,
      firefoxSymbol: error?.fenneviaSymbol,
      capability: error?.fenneviaCapability,
      available:
        typeof error?.fenneviaCapability === "string" ? false : undefined,
      error,
    });
    return error;
  };

  const onContextAbort = () => {
    lifecycle.dispose("shell-context-abort");
  };

  const lifecycle = {
    start() {
      if (!startPromise) {
        startPromise = (async () => {
          let phase = "shell-host-attach";
          try {
            if (disposed || context.signal.aborted || context.isDisposed()) {
              throw createShellLifecycleError(
                "FENNEVIA_SHELL_CONTEXT_DISPOSED",
                "shell-lifecycle-start",
              );
            }

            context.signal.addEventListener("abort", onContextAbort, {
              once: true,
            });
            contextAbortRegistered = true;

            shell = createShellHosts({
              window: context.window,
              windowKind: context.windowKind,
              onEnvironmentError(error) {
                const annotated = annotateShellLifecycleError(error, {
                  code: "FENNEVIA_SHELL_ENVIRONMENT_OBSERVER_FAILED",
                  phase: "shell-environment-observer",
                });
                reportFailure(annotated);
                lifecycle.dispose("shell-environment-observer-failed");
              },
            });
            shell.attach();
            cleanup.add(() => {
              if (shell.dispose()) {
                logger.info({
                  event: "shell.hosts-disposed",
                  phase: "shell-host-dispose",
                  code: "FENNEVIA_SHELL_HOSTS_DISPOSED",
                  windowKind: context.windowKind,
                  opaqueId: context.opaqueId,
                  projectUri: PROJECT_URI,
                });
              }
            });

            logger.info({
              event: "shell.hosts-ready",
              phase,
              code: "FENNEVIA_SHELL_HOSTS_READY",
              windowKind: context.windowKind,
              opaqueId: context.opaqueId,
              projectUri: PROJECT_URI,
            });

            healthState = createShellHealthState({
              rootElement: context.window.document.documentElement,
            });
            cleanup.add(() => healthState.dispose());
            shell.setDiagnosticState("created");
            logState("created");

            phase = "shell-emergency-register";
            emergencyFallback = registerEmergencyFallback({
              eventTarget: context.window,
              onFallback() {
                if (disposed) {
                  return false;
                }
                const error = createShellLifecycleError(
                  "FENNEVIA_EMERGENCY_FALLBACK_INVOKED",
                  "shell-emergency-fallback",
                );
                reportFailure(error);
                lifecycle.dispose("shell-emergency-fallback");
                return true;
              },
              onError(error) {
                reportFailure(error);
                lifecycle.dispose("shell-emergency-error");
              },
            });
            cleanup.add(() => emergencyFallback.dispose());

            phase = "shell-mount";
            const mountResult = mountShell({
              addCleanup: (callback) => cleanup.add(callback),
              browserWindow: context.window,
              buildId: appInfo.appBuildID,
              contextId: context.opaqueId,
              firefoxVersion: appInfo.version,
              logger,
              mountPoints: shell.getMountPoints(),
              reportError: (error) => logCleanupError(error),
              requestFallback(error) {
                if (disposed) {
                  return false;
                }
                reportFailure(error);
                lifecycle.dispose("shell-runtime-fallback");
                return true;
              },
              signal: healthAbortController.signal,
              windowKind: context.windowKind,
            });
            if (mountResult && typeof mountResult.then === "function") {
              throw createShellLifecycleError(
                "FENNEVIA_SHELL_MOUNT_ASYNC_UNSUPPORTED",
                phase,
              );
            }
            if (typeof mountResult === "function") {
              cleanup.add(mountResult);
            } else if (mountResult !== undefined && mountResult !== null) {
              throw createShellLifecycleError(
                "FENNEVIA_SHELL_MOUNT_RESULT_INVALID",
                phase,
              );
            }
            healthState.transition("mounted");
            shell.setDiagnosticState("mounted");
            logState("mounted");

            phase = "shell-health-check";
            const windowSetTimeout =
              typeof context.window.setTimeout === "function"
                ? context.window.setTimeout.bind(context.window)
                : globalThis.setTimeout;
            const windowClearTimeout =
              typeof context.window.clearTimeout === "function"
                ? context.window.clearTimeout.bind(context.window)
                : globalThis.clearTimeout;
            await runShellHealthCheck({
              signal: healthAbortController.signal,
              timeoutMs: healthTimeoutMs,
              setTimeoutFunction: windowSetTimeout,
              clearTimeoutFunction: windowClearTimeout,
              check: async ({ signal }) => {
                shell.verifyHealth();
                if (!emergencyFallback.snapshot().registered) {
                  throw createShellLifecycleError(
                    "FENNEVIA_EMERGENCY_FALLBACK_UNAVAILABLE",
                    "shell-health-check",
                    { capability: "recovery.emergency-key" },
                  );
                }
                validateRequiredCapabilities(
                  getRequiredCapabilities({
                    mountPoints: shell.getMountPoints(),
                    signal,
                    windowKind: context.windowKind,
                  }),
                );
                return checkHealth({
                  mountPoints: shell.getMountPoints(),
                  signal,
                  windowKind: context.windowKind,
                });
              },
            });
            if (
              disposed ||
              healthAbortController.signal.aborted ||
              context.signal.aborted ||
              context.isDisposed()
            ) {
              throw createShellLifecycleError(
                "FENNEVIA_SHELL_CONTEXT_DISPOSED",
                "shell-health-check",
              );
            }

            healthState.transition("healthy");
            shell.setDiagnosticState("healthy");
            logState("healthy");
            started = true;
            logger.info({
              event: "shell.lifecycle-ready",
              phase: "shell-healthy",
              code: "FENNEVIA_SHELL_HEALTHY",
              shellState: "healthy",
              windowKind: context.windowKind,
              opaqueId: context.opaqueId,
              projectUri: PROJECT_URI,
            });
            return lifecycle.snapshot();
          } catch (error) {
            const annotated = error?.fenneviaPhase
              ? error
              : annotateShellLifecycleError(error, {
                  code:
                    error?.fenneviaCode ??
                    (phase === "shell-host-attach"
                      ? "FENNEVIA_SHELL_HOSTS_INITIALIZATION_FAILED"
                      : "FENNEVIA_SHELL_INITIALIZATION_FAILED"),
                  phase,
                  capability: error?.fenneviaCapability,
                });
            if (disposed && (failureLogged || cancelledDuringStart)) {
              return lifecycle.snapshot();
            }
            if (!(disposed && context.signal.aborted)) {
              reportFailure(annotated);
            }
            lifecycle.dispose("shell-start-failed");
            throw annotated;
          }
        })();
      }
      return startPromise;
    },

    activate() {
      if (!started || disposed || !healthState) {
        throw createShellLifecycleError(
          "FENNEVIA_SHELL_ACTIVATION_UNAVAILABLE",
          "shell-activate",
        );
      }
      try {
        const changed = healthState.activate();
        shell.setDiagnosticState("active");
        if (changed) {
          logState("active");
        }
        return changed;
      } catch (error) {
        const annotated = annotateShellLifecycleError(error, {
          code: error?.fenneviaCode ?? "FENNEVIA_SHELL_ACTIVATION_FAILED",
          phase: error?.fenneviaPhase ?? "shell-activate",
        });
        reportFailure(annotated);
        lifecycle.dispose("shell-activation-failed");
        throw annotated;
      }
    },

    dispose(phase = "shell-dispose") {
      if (disposed) {
        return false;
      }
      if (startPromise && !started && !failureLogged) {
        cancelledDuringStart = true;
      }
      disposed = true;

      if (healthState) {
        try {
          healthState.clearActive();
        } catch (error) {
          logCleanupError(
            annotateShellLifecycleError(error, {
              code: "FENNEVIA_SHELL_ACTIVE_CLEAR_FAILED",
              phase,
            }),
          );
        }
      }
      try {
        healthAbortController.abort();
      } catch (error) {
        logCleanupError(error);
      }
      if (contextAbortRegistered) {
        try {
          context.signal.removeEventListener("abort", onContextAbort);
        } catch (error) {
          logCleanupError(error);
        }
        contextAbortRegistered = false;
      }

      cleanup.dispose();
      logger.info({
        event: "shell.lifecycle-disposed",
        phase,
        code: "FENNEVIA_SHELL_LIFECYCLE_DISPOSED",
        shellState: "disposed",
        windowKind: context.windowKind,
        opaqueId: context.opaqueId,
        projectUri: PROJECT_URI,
      });
      return true;
    },

    snapshot() {
      return Object.freeze({
        cleanupCount: cleanup.size,
        emergency: emergencyFallback?.snapshot() ?? null,
        hostCount: shell?.snapshot().hostCount ?? 0,
        started,
        state:
          healthState?.snapshot().state ??
          (disposed ? "disposed" : "uninitialized"),
        windowKind: context.windowKind,
      });
    },
  };

  return Object.freeze(lifecycle);
}

export async function initializeWindowShell({ context, logger, appInfo }) {
  const lifecycle = createWindowShellLifecycle({
    context,
    logger,
    appInfo,
    mountShell: mountProductionShell,
    checkHealth: checkProductionShell,
    getRequiredCapabilities: getProductionCapabilities,
  });
  await lifecycle.start();
  return () => lifecycle.dispose();
}

export const shellHealthTimeoutMs = DEFAULT_HEALTH_TIMEOUT_MS;

/*
 * `active` is intentionally never entered by initializeWindowShell. The
 * explicit controller method exists so issue #15 can consume the validated
 * healthy-only gate after replacement UI and its own full recovery matrix.
 */

/*
 * The production initializer above supplies fixed mount and health
 * collaborators. Tests exercise this same lifecycle constructor with ordinary
 * collaborator failures; no preference, DOM global, or installed debug hook
 * can select a failure mode at runtime.
 */

export const shellHostIds = HOST_IDS;
export const xhtmlNamespace = XHTML_NAMESPACE;
