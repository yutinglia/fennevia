import {
  annotateShellLifecycleError,
  createShellHealthState,
  createShellLifecycleError,
  emergencyFallbackBinding,
  registerEmergencyFallback,
  runShellHealthCheck,
} from "./HealthState.sys.mjs";
import { createFirefoxBridgeBoundary } from "../firefox/BridgeBoundary.sys.mjs";
import { shellAppCss } from "../shell/ShellStyles.sys.mjs";

const XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const XUL_NAMESPACE =
  "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const BROWSER_DOCUMENT_URI = "chrome://browser/content/browser.xhtml";
const PROJECT_URI =
  "chrome://fennevia/content/runtime/WindowShell.sys.mjs";
const BRIDGE_PROJECT_URI =
  "chrome://fennevia/content/firefox/BridgeBoundary.sys.mjs";

const HOST_IDS = Object.freeze({
  overlay: "fennevia-shell-overlay-host",
  primary: "fennevia-shell-primary-host",
  sidebar: "fennevia-shell-sidebar-host",
});

const SHELL_STYLE_ID = "fennevia-shell-style";
const SHELL_APP_MOUNT_ID = "fennevia-shell-app-mount";
const SHELL_APP_STYLE_ID = "fennevia-shell-app-style";
const SHELL_APP_SCRIPT_URI =
  "chrome://fennevia/content/shell/ShellApp.js";
const SHELL_APP_REGISTRATION_KEY =
  "__fenneviaRegisterShellFrontend";
const DEFAULT_HEALTH_TIMEOUT_MS = 2_000;
const CAPABILITY_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{0,95}$/u;

const STATE_LOG_CODES = Object.freeze({
  active: "FENNEVIA_SHELL_STATE_ACTIVE",
  created: "FENNEVIA_SHELL_STATE_CREATED",
  failed: "FENNEVIA_SHELL_STATE_FAILED",
  healthy: "FENNEVIA_SHELL_STATE_HEALTHY",
  mounted: "FENNEVIA_SHELL_STATE_MOUNTED",
});

const APP_METADATA_PATTERN = /^[A-Za-z0-9._+-]{1,64}$/u;

const SHELL_STYLE = `
#fennevia-shell-primary-host {
  --fennevia-shell-surface: var(--toolbar-bgcolor, Canvas);
  --fennevia-shell-text: var(--toolbar-color, CanvasText);
  --fennevia-shell-border: var(--chrome-content-separator-color, GrayText);
  --fennevia-shell-accent: AccentColor;
  box-sizing: border-box;
  display: block;
  flex: 0 0 auto;
  inline-size: 100%;
  min-inline-size: 0;
  color: var(--fennevia-shell-text);
  background: var(--fennevia-shell-surface);
  border-block-end: 1px solid var(--fennevia-shell-border);
  font: menu;
  font-size: 12px;
  line-height: 1.35;
}

#fennevia-shell-primary-host .fennevia-shell-diagnostic {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
  min-block-size: 32px;
  padding: 5px 12px;
}

#fennevia-shell-primary-host .fennevia-shell-identity {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-weight: 600;
}

#fennevia-shell-primary-host .fennevia-shell-status-dot {
  display: inline-block;
  inline-size: 7px;
  block-size: 7px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--fennevia-shell-accent);
}

#fennevia-shell-primary-host[data-fennevia-diagnostic-state="failed"]
  .fennevia-shell-status-dot {
  background: GrayText;
}

#fennevia-shell-primary-host .fennevia-shell-detail-list {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  min-inline-size: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

#fennevia-shell-primary-host .fennevia-shell-detail {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  min-block-size: 20px;
  padding-inline: 7px;
  border: 1px solid color-mix(in srgb, currentColor 24%, transparent);
  border-radius: 999px;
  color: color-mix(in srgb, currentColor 78%, transparent);
  white-space: nowrap;
}

#fennevia-shell-sidebar-host[hidden],
#fennevia-shell-overlay-host[hidden] {
  display: none !important;
}

#fennevia-shell-overlay-host {
  position: fixed;
  inset: 0;
  pointer-events: none;
}

@media (forced-colors: active) {
  #fennevia-shell-primary-host {
    --fennevia-shell-border: CanvasText;
    --fennevia-shell-accent: Highlight;
  }

  #fennevia-shell-primary-host .fennevia-shell-detail {
    border-color: CanvasText;
    color: CanvasText;
  }
}
`;

const normalizeAppMetadata = value => {
  const candidate = String(value ?? "");
  return APP_METADATA_PATTERN.test(candidate) ? candidate : "unknown";
};

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

const validateInsertionPoints = window => {
  const document = window?.document;
  if (!document || document.documentURI !== BROWSER_DOCUMENT_URI) {
    throw createShellError(
      "FENNEVIA_SHELL_DOCUMENT_INVALID",
      "html#main-window"
    );
  }

  const root = document.documentElement;
  if (
    root?.id !== "main-window" ||
    root.localName !== "html" ||
    root.namespaceURI !== XHTML_NAMESPACE
  ) {
    throw createShellError(
      "FENNEVIA_SHELL_ROOT_INVALID",
      "html#main-window"
    );
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
      "html#main-window>body"
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
      "html#main-window>body"
    );
  }

  for (const id of [
    ...Object.values(HOST_IDS),
    SHELL_STYLE_ID,
    SHELL_APP_MOUNT_ID,
    SHELL_APP_STYLE_ID,
  ]) {
    if (document.getElementById(id)) {
      throw createShellError(
        "FENNEVIA_SHELL_HOST_ALREADY_EXISTS",
        `#${id}`
      );
    }
  }

  return Object.freeze({
    accessibilityAnnouncement,
    body,
    browser,
    document,
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

const createDetachedHosts = ({
  document,
  windowKind,
  firefoxVersion,
  buildId,
}) => {
  const primary = createElement(document, "section", {
    id: HOST_IDS.primary,
    className: "fennevia-shell-host fennevia-shell-primary",
    attributes: {
      "aria-label": "Fennevia shell diagnostics",
      "data-fennevia-diagnostic-state": "created",
      "data-fennevia-host": "primary",
    },
  });
  const style = createElement(document, "style", {
    id: SHELL_STYLE_ID,
    textContent: SHELL_STYLE,
  });
  const diagnostic = createElement(document, "div", {
    className: "fennevia-shell-diagnostic",
    attributes: {
      "aria-atomic": "true",
      "aria-live": "polite",
      role: "status",
    },
  });
  const identity = createElement(document, "span", {
    className: "fennevia-shell-identity",
  });
  const statusDot = createElement(document, "span", {
    className: "fennevia-shell-status-dot",
    attributes: { "aria-hidden": "true" },
  });
  const identityText = createElement(document, "span", {
    textContent: "Fennevia host layer ready",
  });
  identity.append(statusDot, identityText);

  const detailList = createElement(document, "ul", {
    className: "fennevia-shell-detail-list",
    attributes: { "aria-label": "Runtime details" },
  });
  for (const detail of [
    windowKind === "private" ? "Private window" : "Normal window",
    `Firefox ${normalizeAppMetadata(firefoxVersion)}`,
    `Build ${normalizeAppMetadata(buildId)}`,
    "3 XHTML hosts",
    "Native UI retained",
    `Recovery ${emergencyFallbackBinding}`,
  ]) {
    const item = createElement(document, "li", {
      className: "fennevia-shell-detail",
      textContent: detail,
    });
    detailList.append(item);
  }
  const stateDetail = createElement(document, "li", {
    className: "fennevia-shell-detail fennevia-shell-state-detail",
    textContent: "State created",
  });
  detailList.append(stateDetail);
  diagnostic.append(identity, detailList);
  const appMount = createElement(document, "div", {
    id: SHELL_APP_MOUNT_ID,
    className: "fennevia-shell-app-mount",
    attributes: {
      "aria-label": "Fennevia Svelte smoke island",
      "data-fennevia-framework-status": "unmounted",
    },
  });
  primary.append(style, diagnostic, appMount);

  const sidebar = createElement(document, "aside", {
    id: HOST_IDS.sidebar,
    className: "fennevia-shell-host fennevia-shell-sidebar",
    attributes: {
      "aria-hidden": "true",
      "data-fennevia-host": "sidebar",
      hidden: "",
    },
  });

  const overlay = createElement(document, "div", {
    id: HOST_IDS.overlay,
    className: "fennevia-shell-host fennevia-shell-overlay",
    attributes: {
      "aria-hidden": "true",
      "data-fennevia-host": "overlay",
      hidden: "",
      inert: "",
    },
  });

  return Object.freeze({
    appMount,
    diagnostic,
    identityText,
    overlay,
    primary,
    sidebar,
    stateDetail,
    style,
  });
};

const descendantsOf = element => [
  element,
  ...Array.from(element.children ?? []).flatMap(descendantsOf),
];

export function createShellHosts({
  window,
  windowKind,
  firefoxVersion,
  buildId,
}) {
  if (windowKind !== "normal" && windowKind !== "private") {
    throw createShellError(
      "FENNEVIA_SHELL_WINDOW_KIND_INVALID",
      "html#main-window"
    );
  }

  let insertionPoints = validateInsertionPoints(window);
  const hosts = createDetachedHosts({
    document: insertionPoints.document,
    windowKind,
    firefoxVersion,
    buildId,
  });
  const mountPoints = Object.freeze({
    overlay: hosts.overlay,
    primary: hosts.primary,
    sidebar: hosts.sidebar,
  });
  let state = "created";

  const detach = () => {
    if (state === "disposed" || state === "detached") {
      return false;
    }

    let firstError;
    for (const host of [hosts.overlay, hosts.sidebar, hosts.primary]) {
      try {
        host.remove();
      } catch (error) {
        firstError ??= error;
      }
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
          "html#main-window>body"
        );
      }

      insertionPoints = validateInsertionPoints(window);
      let currentDomPath =
        "html#main-window>body>#fennevia-shell-primary-host";
      try {
        insertionPoints.body.insertBefore(
          hosts.primary,
          insertionPoints.browser
        );
        currentDomPath =
          "html#main-window>body>#browser>#fennevia-shell-sidebar-host";
        insertionPoints.browser.insertBefore(
          hosts.sidebar,
          insertionPoints.tabbox
        );
        currentDomPath =
          "html#main-window>body>#fennevia-shell-overlay-host";
        insertionPoints.body.insertBefore(
          hosts.overlay,
          insertionPoints.accessibilityAnnouncement
        );
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
          currentDomPath
        );
      }
    },

    detach,

    getMountPoints() {
      return mountPoints;
    },

    setDiagnosticState(nextState) {
      const labels = {
        active: "State active",
        created: "State created",
        failed: "State failed open",
        healthy: "State healthy",
        mounted: "State mounted",
      };
      if (!Object.hasOwn(labels, nextState)) {
        throw createShellError(
          "FENNEVIA_SHELL_DIAGNOSTIC_STATE_INVALID",
          "#fennevia-shell-primary-host"
        );
      }
      hosts.primary.setAttribute(
        "data-fennevia-diagnostic-state",
        nextState
      );
      hosts.stateDetail.textContent = labels[nextState];
      return true;
    },

    verifyHealth() {
      if (state !== "attached") {
        throw createShellError(
          "FENNEVIA_SHELL_HOSTS_NOT_ATTACHED",
          "html#main-window>body"
        );
      }
      const { document } = insertionPoints;
      if (
        document.getElementById(HOST_IDS.primary) !== hosts.primary ||
        hosts.primary.parentElement !== insertionPoints.body ||
        document.getElementById(HOST_IDS.sidebar) !== hosts.sidebar ||
        hosts.sidebar.parentElement !== insertionPoints.browser ||
        document.getElementById(HOST_IDS.overlay) !== hosts.overlay ||
        hosts.overlay.parentElement !== insertionPoints.body
      ) {
        throw createShellError(
          "FENNEVIA_SHELL_HOST_OWNERSHIP_INVALID",
          "html#main-window>body"
        );
      }
      const bodyChildren = Array.from(insertionPoints.body.children);
      const browserChildren = Array.from(insertionPoints.browser.children);
      if (
        bodyChildren.indexOf(hosts.primary) + 1 !==
          bodyChildren.indexOf(insertionPoints.browser) ||
        browserChildren.indexOf(hosts.sidebar) + 1 !==
          browserChildren.indexOf(insertionPoints.tabbox) ||
        bodyChildren.indexOf(hosts.overlay) + 1 !==
          bodyChildren.indexOf(insertionPoints.accessibilityAnnouncement) ||
        !hosts.sidebar.hasAttribute("hidden") ||
        !hosts.overlay.hasAttribute("hidden") ||
        !hosts.overlay.hasAttribute("inert")
      ) {
        throw createShellError(
          "FENNEVIA_SHELL_HOST_PLACEMENT_INVALID",
          "html#main-window>body"
        );
      }
      if (
        document.getElementById(SHELL_STYLE_ID) !== hosts.style ||
        hosts.style.parentElement !== hosts.primary
      ) {
        throw createShellError(
          "FENNEVIA_SHELL_STYLESHEET_MISSING",
          "#fennevia-shell-primary-host>#fennevia-shell-style"
        );
      }

      if (
        document.getElementById(SHELL_APP_MOUNT_ID) !== hosts.appMount ||
        hosts.appMount.parentElement !== hosts.primary ||
        hosts.appMount.namespaceURI !== XHTML_NAMESPACE
      ) {
        throw createShellError(
          "FENNEVIA_SHELL_APP_MOUNT_INVALID",
          "#fennevia-shell-primary-host>#fennevia-shell-app-mount"
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
          "#fennevia-shell-primary-host>#fennevia-shell-style"
        );
      }

      for (const host of Object.values(mountPoints)) {
        if (
          descendantsOf(host).some(
            element => element.namespaceURI !== XHTML_NAMESPACE
          )
        ) {
          throw createShellError(
            "FENNEVIA_SHELL_HOST_NAMESPACE_INVALID",
            `#${host.id}`
          );
        }
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
        insertionPoints = null;
        state = "disposed";
      }
      return true;
    },

    snapshot() {
      return Object.freeze({
        hostCount: state === "attached" ? 3 : 0,
        state,
        windowKind,
      });
    },
  };

  return Object.freeze(controller);
}

const createCleanupStack = onCleanupError => {
  const callbacks = [];
  let disposed = false;

  return Object.freeze({
    add(callback) {
      if (typeof callback !== "function") {
        throw createShellLifecycleError(
          "FENNEVIA_SHELL_CLEANUP_INVALID",
          "shell-cleanup-register"
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

const validateRequiredCapabilities = capabilities => {
  if (!Array.isArray(capabilities)) {
    throw createShellLifecycleError(
      "FENNEVIA_SHELL_CAPABILITIES_INVALID",
      "shell-health-check"
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
        "shell-health-check"
      );
    }
    if (requirement === "required" && !capability.available) {
      throw createShellLifecycleError(
        "FENNEVIA_SHELL_CAPABILITY_MISSING",
        "shell-health-check",
        { capability: capability.name }
      );
    }
  }
  return true;
};

const defaultMountShell = () => undefined;
const defaultCheckHealth = () => true;

const productionShellByTarget = new WeakMap();

const loadProductionFrontend = target => {
  const browserWindow = target.ownerDocument?.defaultView;
  if (
    !browserWindow ||
    typeof Services?.scriptloader?.loadSubScript !== "function"
  ) {
    throw createShellLifecycleError(
      "FENNEVIA_FRONTEND_LOADER_UNAVAILABLE",
      "shell-frontend-load"
    );
  }
  if (SHELL_APP_REGISTRATION_KEY in browserWindow) {
    throw createShellLifecycleError(
      "FENNEVIA_FRONTEND_REGISTRATION_COLLISION",
      "shell-frontend-load"
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
      "UTF-8"
    );
  } catch (error) {
    loadError = error;
  } finally {
    removed = Reflect.deleteProperty(
      browserWindow,
      SHELL_APP_REGISTRATION_KEY
    );
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
    expectedKeys.some(key => typeof frontend[key] !== "function")
  ) {
    throw createShellLifecycleError(
      "FENNEVIA_FRONTEND_REGISTRATION_INVALID",
      "shell-frontend-load"
    );
  }
  return frontend;
};

const getProductionAppMount = mountPoints => {
  const target = mountPoints.primary.ownerDocument.getElementById(
    SHELL_APP_MOUNT_ID
  );
  if (
    target?.parentElement !== mountPoints.primary ||
    target.namespaceURI !== XHTML_NAMESPACE
  ) {
    throw createShellLifecycleError(
      "FENNEVIA_FRONTEND_TARGET_UNAVAILABLE",
      "shell-frontend-mount"
    );
  }
  return target;
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
}) => {
  if (typeof shellAppCss !== "string" || shellAppCss.trim().length === 0) {
    throw createShellLifecycleError(
      "FENNEVIA_FRONTEND_STYLES_EMPTY",
      "shell-frontend-mount"
    );
  }

  const target = getProductionAppMount(mountPoints);
  if (target.ownerDocument.defaultView !== browserWindow) {
    throw createShellLifecycleError(
      "FENNEVIA_FIREFOX_CONTEXT_WINDOW_MISMATCH",
      "firefox-context-create"
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
  let style;
  try {
    logger.info({
      event: "bridge.boundary-created",
      phase: "firefox-context-create",
      code: "FENNEVIA_FIREFOX_BRIDGE_CREATED",
      windowKind,
      opaqueId: contextId,
      projectUri: BRIDGE_PROJECT_URI,
    });
    style = createElement(target.ownerDocument, "style", {
      id: SHELL_APP_STYLE_ID,
      textContent: shellAppCss,
    });
    mountPoints.primary.insertBefore(style, target);

    const frontend = loadProductionFrontend(target);
    const candidateDisposeApp = frontend.mountShellApp({
      target,
      windowKind,
      onUnmountError(error) {
        reportError(
          annotateShellLifecycleError(error, {
            code: "FENNEVIA_FRONTEND_UNMOUNT_REJECTED",
            phase: "shell-frontend-unmount",
          })
        );
      },
    });
    if (typeof candidateDisposeApp !== "function") {
      throw createShellLifecycleError(
        "FENNEVIA_FRONTEND_DISPOSER_INVALID",
        "shell-frontend-mount"
      );
    }
    disposeApp = candidateDisposeApp;
    productionShellByTarget.set(target, {
      bridge,
      frontend,
      logger,
      readyLogged: false,
    });
  } catch (error) {
    productionShellByTarget.delete(target);
    style?.remove();
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
    productionShellByTarget.delete(target);
    try {
      style?.remove();
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
        code:
          firstError?.fenneviaCode ??
          "FENNEVIA_FRONTEND_UNMOUNT_FAILED",
        phase: firstError?.fenneviaPhase ?? "shell-frontend-unmount",
      });
    }
  };
};

const checkProductionShell = ({ mountPoints, windowKind }) => {
  const target = getProductionAppMount(mountPoints);
  const record = productionShellByTarget.get(target);
  if (!record) {
    throw createShellLifecycleError(
      "FENNEVIA_FRONTEND_INSTANCE_UNAVAILABLE",
      "shell-frontend-health"
    );
  }
  const style = target.ownerDocument.getElementById(SHELL_APP_STYLE_ID);
  if (style?.parentElement !== mountPoints.primary) {
    throw createShellLifecycleError(
      "FENNEVIA_FRONTEND_STYLESHEET_MISSING",
      "shell-frontend-health"
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
      "shell-frontend-health"
    );
  }
  return record.frontend.verifyShellAppHealth({ target, windowKind });
};

const getProductionCapabilities = ({ mountPoints, windowKind }) => {
  const target = getProductionAppMount(mountPoints);
  const record = productionShellByTarget.get(target);
  if (!record) {
    throw createShellLifecycleError(
      "FENNEVIA_FRONTEND_INSTANCE_UNAVAILABLE",
      "shell-frontend-health"
    );
  }
  const bridgeCapabilities = record.bridge.assertRequiredCapabilities();
  const frontendCapabilities = record.frontend.getShellAppCapabilities({
    target,
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
      "shell-lifecycle-create"
    );
  }
  if (
    typeof logger?.info !== "function" ||
    typeof logger?.error !== "function"
  ) {
    throw createShellLifecycleError(
      "FENNEVIA_SHELL_LOGGER_UNAVAILABLE",
      "shell-lifecycle-create"
    );
  }
  if (!appInfo) {
    throw createShellLifecycleError(
      "FENNEVIA_SHELL_APP_INFO_UNAVAILABLE",
      "shell-lifecycle-create"
    );
  }
  if (
    typeof mountShell !== "function" ||
    typeof checkHealth !== "function" ||
    typeof getRequiredCapabilities !== "function"
  ) {
    throw createShellLifecycleError(
      "FENNEVIA_SHELL_COLLABORATOR_INVALID",
      "shell-lifecycle-create"
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

  const logCleanupError = error => {
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

  const logState = state => {
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

  const reportFailure = error => {
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
      code:
        error?.fenneviaCode ?? "FENNEVIA_SHELL_INITIALIZATION_FAILED",
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
                "shell-lifecycle-start"
              );
            }

            context.signal.addEventListener("abort", onContextAbort, {
              once: true,
            });
            contextAbortRegistered = true;

            shell = createShellHosts({
              window: context.window,
              windowKind: context.windowKind,
              firefoxVersion: appInfo.version,
              buildId: appInfo.appBuildID,
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
                  "shell-emergency-fallback"
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
              addCleanup: callback => cleanup.add(callback),
              browserWindow: context.window,
              buildId: appInfo.appBuildID,
              contextId: context.opaqueId,
              firefoxVersion: appInfo.version,
              logger,
              mountPoints: shell.getMountPoints(),
              reportError: error => logCleanupError(error),
              signal: healthAbortController.signal,
              windowKind: context.windowKind,
            });
            if (mountResult && typeof mountResult.then === "function") {
              throw createShellLifecycleError(
                "FENNEVIA_SHELL_MOUNT_ASYNC_UNSUPPORTED",
                phase
              );
            }
            if (typeof mountResult === "function") {
              cleanup.add(mountResult);
            } else if (mountResult !== undefined && mountResult !== null) {
              throw createShellLifecycleError(
                "FENNEVIA_SHELL_MOUNT_RESULT_INVALID",
                phase
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
                    { capability: "recovery.emergency-key" }
                  );
                }
                validateRequiredCapabilities(
                  getRequiredCapabilities({
                    mountPoints: shell.getMountPoints(),
                    signal,
                    windowKind: context.windowKind,
                  })
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
                "shell-health-check"
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
          "shell-activate"
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
          code:
            error?.fenneviaCode ?? "FENNEVIA_SHELL_ACTIVATION_FAILED",
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
            })
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
