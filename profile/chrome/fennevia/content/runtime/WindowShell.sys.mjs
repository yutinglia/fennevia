const XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const XUL_NAMESPACE =
  "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const BROWSER_DOCUMENT_URI = "chrome://browser/content/browser.xhtml";
const PROJECT_URI =
  "chrome://fennevia/content/runtime/WindowShell.sys.mjs";

const HOST_IDS = Object.freeze({
  overlay: "fennevia-shell-overlay-host",
  primary: "fennevia-shell-primary-host",
  sidebar: "fennevia-shell-sidebar-host",
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

  for (const id of Object.values(HOST_IDS)) {
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
      "data-fennevia-host": "primary",
    },
  });
  const style = createElement(document, "style", {
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
  ]) {
    const item = createElement(document, "li", {
      className: "fennevia-shell-detail",
      textContent: detail,
    });
    detailList.append(item);
  }
  diagnostic.append(identity, detailList);
  primary.append(style, diagnostic);

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

  return Object.freeze({ overlay, primary, sidebar });
};

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

export function initializeWindowShell({ context, logger, appInfo }) {
  if (
    !context ||
    typeof context.isDisposed !== "function" ||
    !context.signal ||
    (context.windowKind !== "normal" && context.windowKind !== "private")
  ) {
    throw new Error("FENNEVIA_SHELL_CONTEXT_INVALID");
  }
  if (
    typeof logger?.info !== "function" ||
    typeof logger?.error !== "function"
  ) {
    throw new Error("FENNEVIA_SHELL_LOGGER_UNAVAILABLE");
  }
  if (!appInfo) {
    throw new Error("FENNEVIA_SHELL_APP_INFO_UNAVAILABLE");
  }

  let shell;
  try {
    if (context.signal.aborted || context.isDisposed()) {
      throw createShellError(
        "FENNEVIA_SHELL_CONTEXT_DISPOSED",
        "html#main-window"
      );
    }
    shell = createShellHosts({
      window: context.window,
      windowKind: context.windowKind,
      firefoxVersion: appInfo.version,
      buildId: appInfo.appBuildID,
    });
    shell.attach();
    if (context.signal.aborted || context.isDisposed()) {
      throw createShellError(
        "FENNEVIA_SHELL_CONTEXT_DISPOSED",
        "html#main-window"
      );
    }

    logger.info({
      event: "shell.hosts-ready",
      phase: "shell-host-attach",
      code: "FENNEVIA_SHELL_HOSTS_READY",
      windowKind: context.windowKind,
      opaqueId: context.opaqueId,
      projectUri: PROJECT_URI,
    });

    return () => {
      const disposed = shell.dispose();
      if (disposed) {
        logger.info({
          event: "shell.hosts-disposed",
          phase: "shell-host-dispose",
          code: "FENNEVIA_SHELL_HOSTS_DISPOSED",
          windowKind: context.windowKind,
          opaqueId: context.opaqueId,
          projectUri: PROJECT_URI,
        });
      }
    };
  } catch (error) {
    try {
      shell?.dispose();
    } catch (cleanupError) {
      logger.error({
        event: "shell.hosts-rollback-failed",
        phase: "shell-host-rollback",
        code: "FENNEVIA_SHELL_HOSTS_ROLLBACK_FAILED",
        windowKind: context.windowKind,
        opaqueId: context.opaqueId,
        projectUri: PROJECT_URI,
        domPath: error?.fenneviaDomPath ?? "html#main-window",
        error: cleanupError,
      });
    }
    logger.error({
      event: "shell.hosts-failed",
      phase: "shell-host-attach",
      code:
        error?.fenneviaCode ?? "FENNEVIA_SHELL_HOSTS_INITIALIZATION_FAILED",
      windowKind: context.windowKind,
      opaqueId: context.opaqueId,
      projectUri: PROJECT_URI,
      domPath: error?.fenneviaDomPath ?? "html#main-window",
      error,
    });
    throw error;
  }
}

export const shellHostIds = HOST_IDS;
export const xhtmlNamespace = XHTML_NAMESPACE;
