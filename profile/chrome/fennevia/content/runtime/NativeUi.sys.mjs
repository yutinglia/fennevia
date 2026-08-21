const XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const XUL_NAMESPACE =
  "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

const ACTIVE_ATTRIBUTE = "data-fennevia-active";
const REVEALED_ATTRIBUTE = "data-fennevia-native-ui-revealed";
const SUSPENDED_ATTRIBUTE = "data-fennevia-native-ui-suspended";
const STYLE_ID = "fennevia-native-ui-style";
const POPUP_PROXY_ANCHOR_ID = "fennevia-native-popup-anchor";
const POPUP_PROXY_POSITION = "after_end";
const SECURITY_NOTIFICATION_PANEL_ID = "notification-popup";
const POPUP_NOTIFICATIONS_PROPERTY = "PopupNotifications";
const POPUP_NOTIFICATIONS_ANCHOR_CALLBACK = "_getVisibleAnchorElement";
const POPUP_PROXY_ANCHOR_STYLE =
  "position: absolute; inset-block-start: 0; inset-inline-end: 12px; " +
  "inline-size: 1px; block-size: 1px; opacity: 0; pointer-events: none;";
const HIDE_DELAY_MS = 180;
const CONTENT_GUTTER_PX = 7;
const CONTENT_CORNER_RADIUS_PX = 4;
const EXPECTED_STYLE_RULE_COUNT = 7;

const LISTENER_OPTIONS = Object.freeze({ capture: true });
const CHROME_BACKGROUND_PROPERTY = "--fennevia-chrome-background";
const CHROME_BACKGROUND_PATTERN = /^#[0-9a-f]{6}$/u;

const NATIVE_UI_STYLE = `
:root#main-window[data-fennevia-active]:not([data-fennevia-native-ui-suspended])
  #browser {
  box-sizing: border-box !important;
  padding: ${CONTENT_GUTTER_PX}px !important;
  background-color: var(
    --fennevia-chrome-background,
    var(--toolbar-background-color)
  ) !important;
}

:root#main-window[data-fennevia-active]:not([data-fennevia-native-ui-suspended])
  #browser > #tabbrowser-tabbox {
  border: 1px solid var(--chrome-content-separator-color) !important;
  border-radius: var(--chrome-block-radius, ${CONTENT_CORNER_RADIUS_PX}px) !important;
  overflow: clip !important;
}

:root#main-window[data-fennevia-active]:not([data-fennevia-native-ui-revealed]):not([data-fennevia-native-ui-suspended])
  #navigator-toolbox {
  box-sizing: border-box !important;
  min-height: 0 !important;
  height: 0 !important;
  max-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: visible !important;
  background: transparent !important;
  border: 0 !important;
  z-index: 6 !important;
}

:root#main-window[data-fennevia-active]:not([data-fennevia-native-ui-revealed]):not([data-fennevia-native-ui-suspended])
  #navigator-toolbox > :is(#toolbar-menubar, #TabsToolbar, #nav-bar) {
  box-sizing: border-box !important;
  min-height: 0 !important;
  height: 0 !important;
  max-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  border: 0 !important;
}

:root#main-window[data-fennevia-active]:not([data-fennevia-native-ui-revealed]):not([data-fennevia-native-ui-suspended])
  #navigator-toolbox
  > :is(#toolbar-menubar, #TabsToolbar, #nav-bar)
  > :not(.titlebar-buttonbox-container),
:root#main-window[data-fennevia-active]:not([data-fennevia-native-ui-revealed]):not([data-fennevia-native-ui-suspended])
  #navigator-toolbox > #PersonalToolbar,
:root#main-window[data-fennevia-active]:not([data-fennevia-native-ui-revealed]):not([data-fennevia-native-ui-suspended])
  :is(#urlbar, #urlbar-container) {
  visibility: collapse !important;
}

:root#main-window[data-fennevia-active]:not([data-fennevia-native-ui-revealed]):not([data-fennevia-native-ui-suspended])
  #navigator-toolbox
  > :is(#toolbar-menubar, #TabsToolbar, #nav-bar)
  > .titlebar-buttonbox-container {
  visibility: collapse !important;
  pointer-events: none !important;
}

:root#main-window[data-fennevia-active]:not([data-fennevia-native-ui-revealed]):not([data-fennevia-native-ui-suspended])
  :is(
    #sidebar-container,
    #sidebar-launcher-splitter,
    #sidebar-box,
    #sidebar-splitter
  ) {
  visibility: collapse !important;
}
`;

const defineErrorContext = (error, { code, phase, domPath, firefoxSymbol }) => {
  for (const [property, value] of [
    ["fenneviaCode", code],
    ["fenneviaPhase", phase],
    ...(domPath ? [["fenneviaDomPath", domPath]] : []),
    ...(firefoxSymbol ? [["fenneviaSymbol", firefoxSymbol]] : []),
  ]) {
    if (!Object.hasOwn(error, property)) {
      Object.defineProperty(error, property, {
        value,
        enumerable: false,
      });
    }
  }
  return error;
};

const createNativeUiError = (
  code,
  phase,
  { cause, domPath, firefoxSymbol } = {},
) => {
  const error = new Error(code);
  error.name = "FenneviaNativeUiError";
  if (cause !== undefined) {
    Object.defineProperty(error, "cause", {
      value: cause,
      enumerable: false,
    });
  }
  return defineErrorContext(error, {
    code,
    phase,
    domPath,
    firefoxSymbol,
  });
};

const annotateNativeUiError = (value, context) => {
  const error =
    value instanceof Error
      ? value
      : createNativeUiError(context.code, context.phase, {
          cause: value,
          domPath: context.domPath,
          firefoxSymbol: context.firefoxSymbol,
        });
  try {
    return defineErrorContext(error, context);
  } catch {
    return createNativeUiError(context.code, context.phase, {
      cause: error,
      domPath: context.domPath,
      firefoxSymbol: context.firefoxSymbol,
    });
  }
};

const isElement = (value) =>
  value !== null &&
  typeof value === "object" &&
  typeof value.localName === "string" &&
  typeof value.hasAttribute === "function";

const normalizeChromeBackground = (value) => {
  if (typeof value !== "string" || value === "") {
    return "";
  }
  const normalized = value.trim().toLowerCase();
  return CHROME_BACKGROUND_PATTERN.test(normalized) ? normalized : "";
};

const isForcedColorsActive = (view) => {
  try {
    return view?.matchMedia?.("(forced-colors: active)")?.matches === true;
  } catch {
    return false;
  }
};

const elementHasClass = (element, className) => {
  if (typeof element?.classList?.contains === "function") {
    return element.classList.contains(className);
  }
  return String(element?.getAttribute?.("class") ?? "")
    .split(/\s+/u)
    .includes(className);
};

const requireElement = ({
  document,
  id,
  localName,
  namespaceURI,
  parent,
  domPath,
}) => {
  const element = document.getElementById(id);
  if (
    !element ||
    element.localName !== localName ||
    element.namespaceURI !== namespaceURI ||
    element.parentElement !== parent
  ) {
    throw createNativeUiError(
      "FENNEVIA_NATIVE_UI_TARGET_INVALID",
      "native-ui-target-validate",
      { domPath },
    );
  }
  return element;
};

const requireDirectChildByClass = ({
  parent,
  className,
  localName,
  namespaceURI,
  domPath,
}) => {
  const matches = Array.from(parent.children ?? []).filter(
    (element) =>
      element.localName === localName &&
      element.namespaceURI === namespaceURI &&
      elementHasClass(element, className),
  );
  if (matches.length !== 1) {
    throw createNativeUiError(
      "FENNEVIA_NATIVE_UI_TARGET_INVALID",
      "native-ui-target-validate",
      { domPath },
    );
  }
  return matches[0];
};

const requireDirectChildByLocalName = ({
  parent,
  localName,
  namespaceURI,
  domPath,
}) => {
  const matches = Array.from(parent.children ?? []).filter(
    (element) =>
      element.localName === localName && element.namespaceURI === namespaceURI,
  );
  if (matches.length !== 1) {
    throw createNativeUiError(
      "FENNEVIA_NATIVE_UI_TARGET_INVALID",
      "native-ui-target-validate",
      { domPath },
    );
  }
  return matches[0];
};

const requireTitlebarControls = ({ parent, domPath }) => {
  const containers = Array.from(parent.children ?? []).filter((element) =>
    elementHasClass(element, "titlebar-buttonbox-container"),
  );
  if (containers.length !== 1) {
    throw createNativeUiError(
      "FENNEVIA_NATIVE_UI_TITLEBAR_INVALID",
      "native-ui-titlebar-validate",
      { domPath },
    );
  }
  const buttonBox = Array.from(containers[0].children ?? []).find((element) =>
    elementHasClass(element, "titlebar-buttonbox"),
  );
  const buttonClasses = new Set(
    Array.from(buttonBox?.children ?? []).flatMap((element) =>
      [
        "titlebar-min",
        "titlebar-max",
        "titlebar-restore",
        "titlebar-close",
      ].filter((className) => elementHasClass(element, className)),
    ),
  );
  if (!buttonBox || buttonClasses.size !== 4) {
    throw createNativeUiError(
      "FENNEVIA_NATIVE_UI_TITLEBAR_INVALID",
      "native-ui-titlebar-validate",
      { domPath },
    );
  }
  return containers[0];
};

const isDescendantOrSelf = (container, candidate) => {
  if (!container || !candidate) {
    return false;
  }
  if (container === candidate) {
    return true;
  }
  if (typeof container.contains === "function") {
    return container.contains(candidate);
  }
  for (
    let current = candidate.parentElement;
    current;
    current = current.parentElement
  ) {
    if (current === container) {
      return true;
    }
  }
  return false;
};

const findTabDialog = (browser) => {
  if (typeof browser.querySelector === "function") {
    return browser.querySelector("browser[tabDialogShowing]");
  }
  const visit = (element) => {
    for (const child of Array.from(element.children ?? [])) {
      if (
        child.localName === "browser" &&
        child.hasAttribute?.("tabDialogShowing")
      ) {
        return child;
      }
      const nested = visit(child);
      if (nested) {
        return nested;
      }
    }
    return null;
  };
  return visit(browser);
};

const isHtmlWindowModalOpen = (document, root) => {
  const dialog = document?.getElementById?.("window-modal-dialog");
  if (dialog) {
    if (typeof dialog.open === "boolean") {
      return dialog.open === true;
    }
    return dialog.hasAttribute("open");
  }
  return root.hasAttribute("window-modal-open");
};

const validateSupportedWindow = ({ window, root }) => {
  const chromeHidden = String(root.getAttribute("chromehidden") ?? "")
    .split(/\s+/u)
    .filter(Boolean);
  const unsupportedChrome = ["toolbar", "location", "directories"].find(
    (token) => chromeHidden.includes(token),
  );
  if (
    root.hasAttribute("taskbartab") ||
    root.hasAttribute("ai-window") ||
    unsupportedChrome ||
    window.toolbar?.visible === false
  ) {
    throw createNativeUiError(
      "FENNEVIA_NATIVE_UI_WINDOW_UNSUPPORTED",
      "native-ui-window-validate",
      {
        domPath: "html#main-window",
        firefoxSymbol: unsupportedChrome
          ? "document.documentElement[chromehidden]"
          : "window.toolbar.visible",
      },
    );
  }
};

const collectNativeTargets = ({ window, frame }) => {
  const { document } = window;
  const root = document?.documentElement;
  const body = document?.body;
  if (
    document?.documentURI !== "chrome://browser/content/browser.xhtml" ||
    root?.id !== "main-window" ||
    root.localName !== "html" ||
    root.namespaceURI !== XHTML_NAMESPACE ||
    !body ||
    frame?.ownerDocument !== document
  ) {
    throw createNativeUiError(
      "FENNEVIA_NATIVE_UI_DOCUMENT_INVALID",
      "native-ui-target-validate",
      { domPath: "html#main-window" },
    );
  }
  validateSupportedWindow({ window, root });

  const toolbox = requireElement({
    document,
    id: "navigator-toolbox",
    localName: "toolbox",
    namespaceURI: XUL_NAMESPACE,
    parent: body,
    domPath: "html#main-window>body>#navigator-toolbox",
  });
  const menuBar = requireElement({
    document,
    id: "toolbar-menubar",
    localName: "toolbar",
    namespaceURI: XUL_NAMESPACE,
    parent: toolbox,
    domPath: "#navigator-toolbox>#toolbar-menubar",
  });
  const tabsToolbar = requireElement({
    document,
    id: "TabsToolbar",
    localName: "toolbar",
    namespaceURI: XUL_NAMESPACE,
    parent: toolbox,
    domPath: "#navigator-toolbox>#TabsToolbar",
  });
  const tabsToolbarItems = requireDirectChildByClass({
    parent: tabsToolbar,
    className: "toolbar-items",
    localName: "hbox",
    namespaceURI: XUL_NAMESPACE,
    domPath: "#navigator-toolbox>#TabsToolbar>.toolbar-items",
  });
  const navBar = requireElement({
    document,
    id: "nav-bar",
    localName: "toolbar",
    namespaceURI: XUL_NAMESPACE,
    parent: toolbox,
    domPath: "#navigator-toolbox>#nav-bar",
  });
  const taskbarTabsFavicon = requireElement({
    document,
    id: "taskbar-tabs-favicon",
    localName: "img",
    namespaceURI: XHTML_NAMESPACE,
    parent: navBar,
    domPath: "#navigator-toolbox>#nav-bar>#taskbar-tabs-favicon",
  });
  const navBarTabstop = requireDirectChildByLocalName({
    parent: navBar,
    localName: "toolbartabstop",
    namespaceURI: XUL_NAMESPACE,
    domPath: "#navigator-toolbox>#nav-bar>toolbartabstop",
  });
  const navBarCustomizationTarget = requireElement({
    document,
    id: "nav-bar-customization-target",
    localName: "hbox",
    namespaceURI: XUL_NAMESPACE,
    parent: navBar,
    domPath: "#navigator-toolbox>#nav-bar>#nav-bar-customization-target",
  });
  const documentPipReturnButton = requireElement({
    document,
    id: "document-pip-return-to-opener-button",
    localName: "toolbarbutton",
    namespaceURI: XUL_NAMESPACE,
    parent: navBar,
    domPath:
      "#navigator-toolbox>#nav-bar>#document-pip-return-to-opener-button",
  });
  const taskbarTabsAudio = requireElement({
    document,
    id: "taskbar-tabs-audio",
    localName: "toolbarbutton",
    namespaceURI: XUL_NAMESPACE,
    parent: navBar,
    domPath: "#navigator-toolbox>#nav-bar>#taskbar-tabs-audio",
  });
  const smartWindowAskButton = requireElement({
    document,
    id: "smartwindow-ask-button",
    localName: "toolbaritem",
    namespaceURI: XUL_NAMESPACE,
    parent: navBar,
    domPath: "#navigator-toolbox>#nav-bar>#smartwindow-ask-button",
  });
  const navBarOverflowButton = requireElement({
    document,
    id: "nav-bar-overflow-button",
    localName: "toolbarbutton",
    namespaceURI: XUL_NAMESPACE,
    parent: navBar,
    domPath: "#navigator-toolbox>#nav-bar>#nav-bar-overflow-button",
  });
  const panelUiButton = requireElement({
    document,
    id: "PanelUI-button",
    localName: "toolbaritem",
    namespaceURI: XUL_NAMESPACE,
    parent: navBar,
    domPath: "#navigator-toolbox>#nav-bar>#PanelUI-button",
  });
  const personalToolbar = requireElement({
    document,
    id: "PersonalToolbar",
    localName: "toolbar",
    namespaceURI: XUL_NAMESPACE,
    parent: toolbox,
    domPath: "#navigator-toolbox>#PersonalToolbar",
  });
  const notificationsToolbar = requireElement({
    document,
    id: "notifications-toolbar",
    localName: "toolbar",
    namespaceURI: XUL_NAMESPACE,
    parent: toolbox,
    domPath: "#navigator-toolbox>#notifications-toolbar",
  });

  const browser = requireElement({
    document,
    id: "browser",
    localName: "hbox",
    namespaceURI: XUL_NAMESPACE,
    parent: body,
    domPath: "html#main-window>body>#browser",
  });
  const sidebarContainer = requireElement({
    document,
    id: "sidebar-container",
    localName: "box",
    namespaceURI: XUL_NAMESPACE,
    parent: browser,
    domPath: "#browser>#sidebar-container",
  });
  const sidebarMain = Array.from(sidebarContainer.children ?? []).find(
    (element) =>
      element.localName === "sidebar-main" &&
      element.namespaceURI === XHTML_NAMESPACE,
  );
  if (!sidebarMain) {
    throw createNativeUiError(
      "FENNEVIA_NATIVE_UI_TARGET_INVALID",
      "native-ui-target-validate",
      { domPath: "#browser>#sidebar-container>sidebar-main" },
    );
  }
  const sidebarLauncherSplitter = requireElement({
    document,
    id: "sidebar-launcher-splitter",
    localName: "splitter",
    namespaceURI: XUL_NAMESPACE,
    parent: browser,
    domPath: "#browser>#sidebar-launcher-splitter",
  });
  const sidebarBox = requireElement({
    document,
    id: "sidebar-box",
    localName: "vbox",
    namespaceURI: XUL_NAMESPACE,
    parent: browser,
    domPath: "#browser>#sidebar-box",
  });
  const sidebarSplitter = requireElement({
    document,
    id: "sidebar-splitter",
    localName: "splitter",
    namespaceURI: XUL_NAMESPACE,
    parent: browser,
    domPath: "#browser>#sidebar-splitter",
  });
  const tabbox = requireElement({
    document,
    id: "tabbrowser-tabbox",
    localName: "tabbox",
    namespaceURI: XUL_NAMESPACE,
    parent: browser,
    domPath: "#browser>#tabbrowser-tabbox",
  });

  const titlebarControls = Object.freeze({
    menu: requireTitlebarControls({
      parent: menuBar,
      domPath:
        "#navigator-toolbox>#toolbar-menubar>.titlebar-buttonbox-container",
    }),
    tabs: requireTitlebarControls({
      parent: tabsToolbar,
      domPath: "#navigator-toolbox>#TabsToolbar>.titlebar-buttonbox-container",
    }),
    navigation: requireTitlebarControls({
      parent: navBar,
      domPath: "#navigator-toolbox>#nav-bar>.titlebar-buttonbox-container",
    }),
  });

  return Object.freeze({
    body,
    browser,
    documentPipReturnButton,
    document,
    frame,
    menuBar,
    navBar,
    navBarCustomizationTarget,
    navBarOverflowButton,
    navBarTabstop,
    notificationsToolbar,
    personalToolbar,
    panelUiButton,
    root,
    sidebarBox,
    sidebarContainer,
    sidebarLauncherSplitter,
    sidebarMain,
    sidebarSplitter,
    smartWindowAskButton,
    tabbox,
    tabsToolbar,
    tabsToolbarItems,
    taskbarTabsAudio,
    taskbarTabsFavicon,
    titlebarControls,
    toolbox,
  });
};

const capabilitySnapshots = Object.freeze(
  [
    ["fennevia.native-ui-activation-style", `document.styles[${STYLE_ID}]`],
    ["fennevia.native-ui-exact-targets", "browser.xhtml exact native targets"],
    ["fennevia.native-ui-titlebar-retained", "titlebar-buttonbox-container"],
    ["fennevia.native-ui-urlbar-handoff", "nativeUi.revealForUrlbar"],
    ["fennevia.native-ui-toolbar-handoff", "nativeUi.revealForToolbar"],
    ["fennevia.native-ui-popup-handoff", "nativeUi.beginPopupHandoff"],
    ["fennevia.native-ui-popup-hold", "popupshowing/popuphidden"],
    ["fennevia.native-ui-popup-proxy-anchor", `#${POPUP_PROXY_ANCHOR_ID}`],
    [
      "fennevia.native-ui-environment-suspension",
      "customizing/inDOMFullscreen",
    ],
  ].map(([name, symbol]) =>
    Object.freeze({
      available: true,
      name,
      requirement: "required",
      symbol,
    }),
  ),
);

export function createNativeUiController({ window, frame, onError }) {
  if (
    typeof window?.MutationObserver !== "function" ||
    typeof window?.addEventListener !== "function" ||
    typeof window?.removeEventListener !== "function" ||
    typeof onError !== "function"
  ) {
    throw createNativeUiError(
      "FENNEVIA_NATIVE_UI_OPTIONS_INVALID",
      "native-ui-create",
      { firefoxSymbol: "window.MutationObserver" },
    );
  }

  let targets = collectNativeTargets({ window, frame });
  const { document, root, browser, toolbox, sidebarBox } = targets;
  const windowModalDialog = document.getElementById("window-modal-dialog");
  if (
    typeof document.addEventListener !== "function" ||
    typeof document.removeEventListener !== "function"
  ) {
    throw createNativeUiError(
      "FENNEVIA_NATIVE_UI_EVENT_TARGET_INVALID",
      "native-ui-create",
      { firefoxSymbol: "document.addEventListener" },
    );
  }
  if (document.getElementById(STYLE_ID)) {
    throw createNativeUiError(
      "FENNEVIA_NATIVE_UI_STYLE_COLLISION",
      "native-ui-style-create",
      { domPath: `#${STYLE_ID}` },
    );
  }
  if (document.getElementById(POPUP_PROXY_ANCHOR_ID)) {
    throw createNativeUiError(
      "FENNEVIA_NATIVE_UI_POPUP_PROXY_COLLISION",
      "native-ui-popup-proxy-create",
      { domPath: `#${POPUP_PROXY_ANCHOR_ID}` },
    );
  }

  const style = document.createElementNS(XHTML_NAMESPACE, "style");
  style.id = STYLE_ID;
  style.textContent = NATIVE_UI_STYLE;
  const firstEdgeHost = Array.from(frame.children ?? []).find((element) =>
    element.hasAttribute?.("data-fennevia-edge-host"),
  );
  frame.insertBefore(style, firstEdgeHost ?? null);
  const popupProxyAnchor = document.createElementNS(XHTML_NAMESPACE, "span");
  popupProxyAnchor.id = POPUP_PROXY_ANCHOR_ID;
  popupProxyAnchor.setAttribute("aria-hidden", "true");
  popupProxyAnchor.setAttribute("data-fennevia-native-popup-anchor", "");
  popupProxyAnchor.setAttribute("style", POPUP_PROXY_ANCHOR_STYLE);
  frame.insertBefore(popupProxyAnchor, firstEdgeHost ?? null);

  let disposed = false;
  let failed = false;
  let observer;
  let structuralVerificationTimer;
  let hideTimer;
  let escapeTimer;
  let handoffFrame;
  let handoffTimer;
  let handoffPending = false;
  let focusHeld = false;
  let userInteracted = false;
  let customizationTransition = root.hasAttribute("customizing");
  let windowTearingDown = false;
  let suspensionReason = null;
  const listeners = [];
  const openPopups = new Set();
  const pendingPopupProxies = new Set();
  const proxiedPopups = new Set();
  const popupProxyTimers = new Map();
  const popupHandoffIds = new Set();
  let storedChromeBackground = "";
  let popupNotificationsOwner;
  let popupNotificationsOwnerDescriptor;
  let popupNotificationsAnchorCallbackRouter;
  let popupNotificationsLazyDescriptor;
  let popupNotificationsLazyGetterRouter;

  const clearChromeBackground = () => {
    root.style?.removeProperty?.(CHROME_BACKGROUND_PROPERTY);
  };

  const applyChromeBackground = () => {
    if (
      storedChromeBackground === "" ||
      isForcedColorsActive(window) ||
      typeof root.style?.setProperty !== "function"
    ) {
      clearChromeBackground();
      return;
    }
    root.style.setProperty(CHROME_BACKGROUND_PROPERTY, storedChromeBackground);
  };

  const setChromeBackground = (value) => {
    if (disposed || failed) {
      return false;
    }
    storedChromeBackground = normalizeChromeBackground(value);
    applyChromeBackground();
    return true;
  };

  try {
    const forcedColorsQuery = window.matchMedia?.("(forced-colors: active)");
    if (
      forcedColorsQuery &&
      typeof forcedColorsQuery.addEventListener === "function"
    ) {
      const onForcedColorsChange = () => {
        if (!disposed && !failed) {
          applyChromeBackground();
        }
      };
      forcedColorsQuery.addEventListener("change", onForcedColorsChange);
      listeners.push(() => {
        forcedColorsQuery.removeEventListener("change", onForcedColorsChange);
      });
    }
  } catch {
    // matchMedia is optional in tests and missing-capability windows.
  }

  const clearHideTimer = () => {
    if (hideTimer !== undefined) {
      window.clearTimeout(hideTimer);
      hideTimer = undefined;
    }
  };

  const clearStructuralVerificationTimer = () => {
    if (structuralVerificationTimer !== undefined) {
      window.clearTimeout(structuralVerificationTimer);
      structuralVerificationTimer = undefined;
    }
  };

  const clearEscapeTimer = () => {
    if (escapeTimer !== undefined) {
      window.clearTimeout(escapeTimer);
      escapeTimer = undefined;
    }
  };

  const clearHandoffRelease = () => {
    if (handoffFrame !== undefined) {
      window.cancelAnimationFrame?.(handoffFrame);
      handoffFrame = undefined;
    }
    if (handoffTimer !== undefined) {
      window.clearTimeout(handoffTimer);
      handoffTimer = undefined;
    }
  };

  const clearPopupProxyTimer = (popup) => {
    if (!popupProxyTimers.has(popup)) {
      return false;
    }
    const timer = popupProxyTimers.get(popup);
    popupProxyTimers.delete(popup);
    window.clearTimeout(timer);
    return true;
  };

  const clearPopupProxyTimers = () => {
    for (const popup of [...popupProxyTimers.keys()]) {
      clearPopupProxyTimer(popup);
    }
  };

  const forgetPopup = (popup) => {
    clearPopupProxyTimer(popup);
    pendingPopupProxies.delete(popup);
    proxiedPopups.delete(popup);
    openPopups.delete(popup);
  };

  const isToolboxNode = (candidate) =>
    isElement(candidate) && isDescendantOrSelf(targets.toolbox, candidate);

  const canRoutePopupNotificationAnchor = () =>
    !disposed &&
    !failed &&
    !windowTearingDown &&
    !suspensionReason &&
    root.hasAttribute(ACTIVE_ATTRIBUTE) &&
    !root.hasAttribute(REVEALED_ATTRIBUTE) &&
    popupProxyAnchor.isConnected === true &&
    document.getElementById(POPUP_PROXY_ANCHOR_ID) === popupProxyAnchor;

  const restorePopupNotificationsOwnerRouter = () => {
    if (!popupNotificationsOwner || !popupNotificationsAnchorCallbackRouter) {
      return false;
    }
    const owner = popupNotificationsOwner;
    const currentDescriptor = Object.getOwnPropertyDescriptor(
      owner,
      POPUP_NOTIFICATIONS_ANCHOR_CALLBACK,
    );
    if (currentDescriptor?.value === popupNotificationsAnchorCallbackRouter) {
      if (popupNotificationsOwnerDescriptor) {
        Object.defineProperty(
          owner,
          POPUP_NOTIFICATIONS_ANCHOR_CALLBACK,
          popupNotificationsOwnerDescriptor,
        );
      } else {
        Reflect.deleteProperty(owner, POPUP_NOTIFICATIONS_ANCHOR_CALLBACK);
      }
    }
    popupNotificationsOwner = undefined;
    popupNotificationsOwnerDescriptor = undefined;
    popupNotificationsAnchorCallbackRouter = undefined;
    return true;
  };

  const routePopupNotificationsOwner = (owner) => {
    if (
      (typeof owner !== "object" && typeof owner !== "function") ||
      owner === null
    ) {
      return false;
    }
    if (
      owner === popupNotificationsOwner &&
      owner[POPUP_NOTIFICATIONS_ANCHOR_CALLBACK] ===
        popupNotificationsAnchorCallbackRouter
    ) {
      return true;
    }
    if (popupNotificationsOwner) {
      restorePopupNotificationsOwnerRouter();
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      owner,
      POPUP_NOTIFICATIONS_ANCHOR_CALLBACK,
    );
    if (descriptor && !Object.hasOwn(descriptor, "value")) {
      return false;
    }
    const originalCallback = owner[POPUP_NOTIFICATIONS_ANCHOR_CALLBACK];
    if (
      typeof originalCallback !== "function" ||
      (descriptor &&
        descriptor.configurable !== true &&
        descriptor.writable !== true)
    ) {
      return false;
    }
    const callbackRouter = function (...args) {
      const resolvedAnchor = Reflect.apply(originalCallback, this, args);
      if (!canRoutePopupNotificationAnchor()) {
        return resolvedAnchor;
      }
      const requestedAnchor = args[0];
      return isToolboxNode(requestedAnchor) || isToolboxNode(resolvedAnchor)
        ? popupProxyAnchor
        : resolvedAnchor;
    };
    Object.defineProperty(owner, POPUP_NOTIFICATIONS_ANCHOR_CALLBACK, {
      ...(descriptor ?? {
        configurable: true,
        enumerable: true,
        writable: true,
      }),
      value: callbackRouter,
    });
    popupNotificationsOwner = owner;
    popupNotificationsOwnerDescriptor = descriptor;
    popupNotificationsAnchorCallbackRouter = callbackRouter;
    return true;
  };

  const installPopupNotificationsAnchorRouter = () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      window,
      POPUP_NOTIFICATIONS_PROPERTY,
    );
    if (!descriptor) {
      return false;
    }
    if (Object.hasOwn(descriptor, "value")) {
      return routePopupNotificationsOwner(descriptor.value);
    }
    if (
      typeof descriptor.get !== "function" ||
      descriptor.configurable !== true
    ) {
      return false;
    }
    const originalGetter = descriptor.get;
    const getterRouter = function () {
      const owner = Reflect.apply(originalGetter, this, []);
      try {
        if (!routePopupNotificationsOwner(owner)) {
          reportFailure(
            createNativeUiError(
              "FENNEVIA_NATIVE_UI_POPUP_NOTIFICATIONS_ANCHOR_UNAVAILABLE",
              "native-ui-popup-notifications-anchor",
              {
                firefoxSymbol:
                  "window.PopupNotifications._getVisibleAnchorElement",
              },
            ),
          );
        }
      } catch (error) {
        reportFailure(
          createNativeUiError(
            "FENNEVIA_NATIVE_UI_POPUP_NOTIFICATIONS_ANCHOR_FAILED",
            "native-ui-popup-notifications-anchor",
            {
              cause: error,
              firefoxSymbol:
                "window.PopupNotifications._getVisibleAnchorElement",
            },
          ),
        );
      }
      return owner;
    };
    Object.defineProperty(window, POPUP_NOTIFICATIONS_PROPERTY, {
      ...descriptor,
      get: getterRouter,
    });
    popupNotificationsLazyDescriptor = descriptor;
    popupNotificationsLazyGetterRouter = getterRouter;
    return true;
  };

  const restorePopupNotificationsAnchorRouter = () => {
    let firstError;
    try {
      restorePopupNotificationsOwnerRouter();
    } catch (error) {
      firstError = error;
    }
    try {
      if (popupNotificationsLazyGetterRouter) {
        const currentDescriptor = Object.getOwnPropertyDescriptor(
          window,
          POPUP_NOTIFICATIONS_PROPERTY,
        );
        if (currentDescriptor?.get === popupNotificationsLazyGetterRouter) {
          Object.defineProperty(
            window,
            POPUP_NOTIFICATIONS_PROPERTY,
            popupNotificationsLazyDescriptor,
          );
        }
      }
    } catch (error) {
      firstError ??= error;
    }
    popupNotificationsLazyDescriptor = undefined;
    popupNotificationsLazyGetterRouter = undefined;
    if (firstError) {
      throw firstError;
    }
    return true;
  };

  const isManagedNode = (candidate) =>
    isElement(candidate) &&
    [targets.toolbox, targets.sidebarContainer, targets.sidebarBox].some(
      (container) => isDescendantOrSelf(container, candidate),
    );

  const isNativeSidebarOpen = () =>
    !sidebarBox.hasAttribute("hidden") ||
    sidebarBox.hasAttribute("sidebar-panel-open");

  const isNativeFocusHeld = () => {
    const focusedCandidates = [
      document.activeElement,
      document.commandDispatcher?.focusedElement,
    ];
    if (focusedCandidates.some(isManagedNode)) {
      return true;
    }
    const urlbar = window.gURLBar;
    return Boolean(
      urlbar?.focused === true ||
      urlbar?.hasAttribute?.("focused") ||
      urlbar?.hasAttribute?.("open"),
    );
  };

  const isUrlbarNode = (node) => {
    if (!isElement(node)) {
      return false;
    }
    if (
      node.id === "urlbar" ||
      node.id === "urlbar-container" ||
      node.id === "urlbar-input"
    ) {
      return true;
    }
    const urlbar = window.gURLBar;
    if (!urlbar) {
      return false;
    }
    if (node === urlbar || node === urlbar.inputField) {
      return true;
    }
    return (
      isDescendantOrSelf(urlbar, node) ||
      isDescendantOrSelf(urlbar.inputField, node)
    );
  };

  const markUserInteracted = () => {
    userInteracted = true;
  };

  const focusSelectedBrowser = () => {
    try {
      window.gURLBar?.blur?.();
      window.gURLBar?.inputField?.blur?.();
    } catch {
      // Urlbar blur is best-effort before content focus.
    }
    try {
      const selectedBrowser = window.gBrowser?.selectedBrowser;
      if (typeof selectedBrowser?.focus === "function") {
        selectedBrowser.focus();
      }
    } catch {
      // Content focus restoration is best-effort.
    }
  };

  const prunePopups = () => {
    for (const popup of new Set([
      ...openPopups,
      ...pendingPopupProxies,
      ...proxiedPopups,
    ])) {
      const state = popup.getAttribute?.("state");
      if (
        popup.isConnected === false ||
        state === "closed" ||
        popup.hasAttribute?.("hidden")
      ) {
        forgetPopup(popup);
      }
    }
  };

  const readSuspensionReason = () => {
    if (root.hasAttribute("customizing") || customizationTransition) {
      return "customize-mode";
    }
    if (root.hasAttribute("inDOMFullscreen")) {
      return "dom-fullscreen";
    }
    if (isHtmlWindowModalOpen(document, root) || findTabDialog(browser)) {
      return "native-dialog";
    }
    return null;
  };

  const updateSuspension = () => {
    suspensionReason = readSuspensionReason();
    if (suspensionReason) {
      root.setAttribute(SUSPENDED_ATTRIBUTE, "");
      root.removeAttribute(REVEALED_ATTRIBUTE);
      handoffPending = false;
      focusHeld = false;
      openPopups.clear();
      pendingPopupProxies.clear();
      proxiedPopups.clear();
      clearPopupProxyTimers();
      clearHideTimer();
    } else {
      root.removeAttribute(SUSPENDED_ATTRIBUTE);
    }
  };

  const shouldReveal = () => {
    if (suspensionReason) {
      return false;
    }
    prunePopups();
    return Boolean(
      handoffPending ||
      focusHeld ||
      openPopups.size > 0 ||
      isNativeSidebarOpen(),
    );
  };

  const releaseRestingNativeFocus = () => {
    if (
      disposed ||
      userInteracted ||
      handoffPending ||
      !root.hasAttribute(ACTIVE_ATTRIBUTE) ||
      suspensionReason ||
      shouldReveal() ||
      !isNativeFocusHeld()
    ) {
      return false;
    }
    focusHeld = false;
    focusSelectedBrowser();
    return true;
  };

  const reconcile = () => {
    if (disposed) {
      return false;
    }
    clearHideTimer();
    const revealed = shouldReveal();
    root.toggleAttribute(REVEALED_ATTRIBUTE, revealed);
    return revealed;
  };

  const scheduleHide = () => {
    if (disposed || suspensionReason) {
      return;
    }
    clearHideTimer();
    hideTimer = window.setTimeout(() => {
      hideTimer = undefined;
      try {
        reconcile();
      } catch (error) {
        reportFailure(error, "native-ui-hide");
      }
    }, HIDE_DELAY_MS);
  };

  const verifyStyle = () => {
    if (
      document.getElementById(STYLE_ID) !== style ||
      style.parentElement !== frame
    ) {
      throw createNativeUiError(
        "FENNEVIA_NATIVE_UI_STYLE_INVALID",
        "native-ui-style-validate",
        { domPath: `#${frame.id}>#${STYLE_ID}` },
      );
    }
    if (
      document.getElementById(POPUP_PROXY_ANCHOR_ID) !== popupProxyAnchor ||
      popupProxyAnchor.parentElement !== frame ||
      popupProxyAnchor.getAttribute("aria-hidden") !== "true" ||
      !popupProxyAnchor.hasAttribute("data-fennevia-native-popup-anchor") ||
      popupProxyAnchor.getAttribute("style") !== POPUP_PROXY_ANCHOR_STYLE
    ) {
      throw createNativeUiError(
        "FENNEVIA_NATIVE_UI_POPUP_PROXY_INVALID",
        "native-ui-popup-proxy-validate",
        { domPath: `#${frame.id}>#${POPUP_PROXY_ANCHOR_ID}` },
      );
    }
    let cssRuleCount;
    try {
      cssRuleCount = style.sheet?.cssRules?.length ?? 0;
    } catch {
      cssRuleCount = 0;
    }
    if (cssRuleCount !== EXPECTED_STYLE_RULE_COUNT) {
      throw createNativeUiError(
        "FENNEVIA_NATIVE_UI_STYLE_PARTIAL",
        "native-ui-style-validate",
        { domPath: `#${frame.id}>#${STYLE_ID}` },
      );
    }
    if (style.textContent !== NATIVE_UI_STYLE) {
      throw createNativeUiError(
        "FENNEVIA_NATIVE_UI_STYLE_INVALID",
        "native-ui-style-validate",
        { domPath: `#${frame.id}>#${STYLE_ID}` },
      );
    }
  };

  const verifyTargets = () => {
    const current = collectNativeTargets({ window, frame });
    for (const key of [
      "browser",
      "documentPipReturnButton",
      "menuBar",
      "navBar",
      "navBarCustomizationTarget",
      "navBarOverflowButton",
      "navBarTabstop",
      "notificationsToolbar",
      "personalToolbar",
      "panelUiButton",
      "sidebarBox",
      "sidebarContainer",
      "sidebarLauncherSplitter",
      "sidebarMain",
      "sidebarSplitter",
      "smartWindowAskButton",
      "tabbox",
      "tabsToolbar",
      "tabsToolbarItems",
      "taskbarTabsAudio",
      "taskbarTabsFavicon",
      "toolbox",
    ]) {
      if (current[key] !== targets[key]) {
        throw createNativeUiError(
          "FENNEVIA_NATIVE_UI_OWNERSHIP_CHANGED",
          "native-ui-target-validate",
          { domPath: `native-ui-target:${key}` },
        );
      }
    }
    for (const key of ["menu", "navigation", "tabs"]) {
      if (current.titlebarControls[key] !== targets.titlebarControls[key]) {
        throw createNativeUiError(
          "FENNEVIA_NATIVE_UI_TITLEBAR_CHANGED",
          "native-ui-titlebar-validate",
          { domPath: `titlebar-controls:${key}` },
        );
      }
    }
  };

  const verifyHealth = () => {
    if (disposed) {
      throw createNativeUiError(
        "FENNEVIA_NATIVE_UI_DISPOSED",
        "native-ui-health",
      );
    }
    verifyStyle();
    if (!suspensionReason) {
      verifyTargets();
    }
    if (!observer) {
      throw createNativeUiError(
        "FENNEVIA_NATIVE_UI_OBSERVER_MISSING",
        "native-ui-health",
        { firefoxSymbol: "window.MutationObserver" },
      );
    }
    return true;
  };

  function reportFailure(value, phase = "native-ui-runtime") {
    if (disposed || failed) {
      return false;
    }
    failed = true;
    try {
      root.setAttribute(SUSPENDED_ATTRIBUTE, "");
      root.removeAttribute(REVEALED_ATTRIBUTE);
      clearPopupProxyTimers();
      restorePopupNotificationsAnchorRouter();
    } catch {
      // The lifecycle callback still clears the active health gate.
    }
    const error = annotateNativeUiError(value, {
      code: value?.fenneviaCode ?? "FENNEVIA_NATIVE_UI_RUNTIME_FAILED",
      phase: value?.fenneviaPhase ?? phase,
      domPath: value?.fenneviaDomPath,
      firefoxSymbol: value?.fenneviaSymbol,
    });
    onError(error);
    return true;
  }

  const register = (target, type, listener, options = LISTENER_OPTIONS) => {
    target.addEventListener(type, listener, options);
    listeners.push(() => target.removeEventListener(type, listener, options));
  };

  const onFocusIn = (event) => {
    if (isManagedNode(event.target)) {
      if (!handoffPending && !userInteracted && isUrlbarNode(event.target)) {
        focusHeld = false;
        focusSelectedBrowser();
        scheduleHide();
        return;
      }
      focusHeld = true;
      reconcile();
      return;
    }
    focusHeld = false;
    scheduleHide();
  };
  const onFocusOut = (event) => {
    if (isManagedNode(event.target) && !isManagedNode(event.relatedTarget)) {
      focusHeld = false;
      scheduleHide();
    }
  };
  const onWindowBlur = () => {
    focusHeld = false;
    scheduleHide();
  };
  const onWindowUnload = () => {
    windowTearingDown = true;
    clearHideTimer();
    clearStructuralVerificationTimer();
    clearEscapeTimer();
    clearHandoffRelease();
    handoffPending = false;
    try {
      restorePopupNotificationsAnchorRouter();
    } catch {
      // Window teardown keeps the native popup owner as the safe fallback.
    }
  };
  const onKeyDown = (event) => {
    if (event.key !== "Escape") {
      markUserInteracted();
    }
    if (event.key !== "Escape" || !root.hasAttribute(REVEALED_ATTRIBUTE)) {
      return;
    }
    clearEscapeTimer();
    escapeTimer = window.setTimeout(() => {
      escapeTimer = undefined;
      if (!disposed) {
        focusHeld = false;
        scheduleHide();
      }
    }, 0);
  };

  const popupAnchorCandidates = (popup) => {
    const explicitCandidates = [popup?.anchorNode, popup?.triggerNode].filter(
      isElement,
    );
    return explicitCandidates.length > 0
      ? explicitCandidates
      : [document.popupNode];
  };

  const popupAnchorIsManaged = (popup) =>
    popupAnchorCandidates(popup).some(isManagedNode);

  const popupAnchorIsInToolbox = (popup) =>
    popupAnchorCandidates(popup).some(isToolboxNode);

  const isFenneviaPopupAnchor = (popup) =>
    isDescendantOrSelf(frame, popup?.anchorNode);

  const isIgnoredHandoffPopup = (popup) =>
    (typeof popup?.id === "string" && popupHandoffIds.has(popup.id)) ||
    isFenneviaPopupAnchor(popup);

  const isSecurityNotificationPopup = (popup) =>
    popup?.id === SECURITY_NOTIFICATION_PANEL_ID;

  const canProxyPopup = (popup) =>
    root.hasAttribute(ACTIVE_ATTRIBUTE) &&
    !root.hasAttribute(REVEALED_ATTRIBUTE) &&
    !suspensionReason &&
    !isSecurityNotificationPopup(popup) &&
    popupAnchorIsInToolbox(popup) &&
    typeof popup?.moveToAnchor === "function";

  const proxyPopup = (popup) => {
    pendingPopupProxies.delete(popup);
    if (
      disposed ||
      failed ||
      suspensionReason ||
      !root.hasAttribute(ACTIVE_ATTRIBUTE)
    ) {
      return false;
    }
    if (isIgnoredHandoffPopup(popup)) {
      return true;
    }
    const state = popup.getAttribute?.("state");
    if (
      popup.isConnected === false ||
      state === "closed" ||
      state === "hiding" ||
      popup.hasAttribute?.("hidden")
    ) {
      return false;
    }
    if (isElement(popup.anchorNode) && !isToolboxNode(popup.anchorNode)) {
      return true;
    }
    if (typeof popup.moveToAnchor !== "function") {
      openPopups.add(popup);
      reconcile();
      return false;
    }
    try {
      Reflect.apply(popup.moveToAnchor, popup, [
        popupProxyAnchor,
        POPUP_PROXY_POSITION,
        0,
        0,
      ]);
    } catch (error) {
      reportFailure(
        createNativeUiError(
          "FENNEVIA_NATIVE_UI_POPUP_PROXY_FAILED",
          "native-ui-popup-proxy",
          {
            cause: error,
            firefoxSymbol: "XULPopupElement.moveToAnchor",
          },
        ),
      );
      return false;
    }
    if (popup.anchorNode !== popupProxyAnchor) {
      openPopups.add(popup);
      reconcile();
      return false;
    }
    openPopups.delete(popup);
    proxiedPopups.add(popup);
    reconcile();
    return true;
  };

  const schedulePopupProxy = (popup) => {
    if (popupProxyTimers.has(popup)) {
      return false;
    }
    try {
      const timer = window.setTimeout(() => {
        popupProxyTimers.delete(popup);
        proxyPopup(popup);
      }, 0);
      popupProxyTimers.set(popup, timer);
      return true;
    } catch (error) {
      reportFailure(
        createNativeUiError(
          "FENNEVIA_NATIVE_UI_POPUP_PROXY_SCHEDULE_FAILED",
          "native-ui-popup-proxy",
          { cause: error, firefoxSymbol: "window.setTimeout" },
        ),
      );
      return false;
    }
  };

  const onPopupEvent = (event) => {
    const popup = isElement(event.originalTarget)
      ? event.originalTarget
      : isElement(event.target)
        ? event.target
        : null;
    if (
      !popup ||
      popup.localName === "tooltip" ||
      popup.id === "tab-preview-panel" ||
      popup.getAttribute("nopreventnavboxhide") === "true"
    ) {
      return;
    }

    if (event.type === "popupshowing") {
      if (isSecurityNotificationPopup(popup)) {
        forgetPopup(popup);
        if (popup.anchorNode === popupProxyAnchor) {
          proxiedPopups.add(popup);
        } else {
          openPopups.add(popup);
        }
        reconcile();
        return;
      }
      if (isIgnoredHandoffPopup(popup)) {
        return;
      }
      if (canProxyPopup(popup)) {
        pendingPopupProxies.add(popup);
        return;
      }
      if (
        root.hasAttribute(REVEALED_ATTRIBUTE) ||
        popupAnchorIsManaged(popup)
      ) {
        openPopups.add(popup);
        reconcile();
      }
      return;
    }
    if (event.type === "popupshown") {
      if (isSecurityNotificationPopup(popup)) {
        forgetPopup(popup);
        if (popup.anchorNode === popupProxyAnchor) {
          proxiedPopups.add(popup);
        } else {
          openPopups.add(popup);
        }
        reconcile();
        return;
      }
      if (isIgnoredHandoffPopup(popup)) {
        pendingPopupProxies.delete(popup);
        return;
      }
      if (pendingPopupProxies.has(popup) || canProxyPopup(popup)) {
        pendingPopupProxies.add(popup);
        schedulePopupProxy(popup);
        return;
      }
      if (
        root.hasAttribute(REVEALED_ATTRIBUTE) ||
        popupAnchorIsManaged(popup)
      ) {
        openPopups.add(popup);
        reconcile();
      }
      return;
    }
    forgetPopup(popup);
    scheduleHide();
  };

  const onBeforeCustomization = () => {
    customizationTransition = true;
    updateSuspension();
  };
  const onAfterCustomization = () => {
    customizationTransition = false;
    try {
      updateSuspension();
      verifyStyle();
      verifyTargets();
      reconcile();
    } catch (error) {
      reportFailure(error, "native-ui-customization-resume");
    }
  };

  try {
    updateSuspension();
    installPopupNotificationsAnchorRouter();
    register(document, "focusin", onFocusIn);
    register(document, "focusout", onFocusOut);
    register(window, "blur", onWindowBlur);
    register(window, "unload", onWindowUnload);
    register(window, "keydown", onKeyDown);
    register(document, "mousedown", markUserInteracted);
    for (const type of [
      "popupshowing",
      "popupshown",
      "popuphiding",
      "popuphidden",
    ]) {
      register(document, type, onPopupEvent);
    }
    register(toolbox, "beforecustomization", onBeforeCustomization);
    register(toolbox, "aftercustomization", onAfterCustomization);

    const Observer = window.MutationObserver;
    const isWindowUnavailable = () => {
      if (disposed || failed || windowTearingDown) {
        return true;
      }
      try {
        return window.closed === true && root.isConnected !== true;
      } catch {
        return false;
      }
    };
    const reconcileObservedState = () => {
      if (isWindowUnavailable()) {
        return;
      }
      try {
        updateSuspension();
        verifyStyle();
        if (!suspensionReason) {
          verifyTargets();
          reconcile();
          if (root.hasAttribute(ACTIVE_ATTRIBUTE)) {
            releaseRestingNativeFocus();
          }
        }
      } catch (error) {
        reportFailure(error);
      }
    };
    observer = new Observer((records) => {
      const recordList = Array.from(records ?? []);
      const structuralChange = recordList.some(
        (record) => record.type === "childList" && record.target !== style,
      );
      const modalOpenChanged = recordList.some(
        (record) =>
          record.type === "attributes" &&
          record.attributeName === "open" &&
          record.target === windowModalDialog,
      );
      if (modalOpenChanged) {
        try {
          updateSuspension();
        } catch (error) {
          reportFailure(error);
          return;
        }
      }
      if (!structuralChange) {
        reconcileObservedState();
        return;
      }
      if (structuralVerificationTimer !== undefined) {
        return;
      }
      structuralVerificationTimer = window.setTimeout(() => {
        structuralVerificationTimer = undefined;
        reconcileObservedState();
      }, 0);
    });
    observer.observe(root, {
      attributeFilter: [
        ACTIVE_ATTRIBUTE,
        "customizing",
        "inDOMFullscreen",
        "window-modal-open",
      ],
      attributes: true,
    });
    if (windowModalDialog) {
      observer.observe(windowModalDialog, {
        attributeFilter: ["open"],
        attributes: true,
      });
    }
    observer.observe(browser, {
      attributeFilter: ["hidden", "sidebar-panel-open", "tabDialogShowing"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    observer.observe(toolbox, { childList: true, subtree: true });
    observer.observe(frame, { childList: true });
    observer.observe(popupProxyAnchor, {
      attributeFilter: [
        "aria-hidden",
        "data-fennevia-native-popup-anchor",
        "id",
        "style",
      ],
      attributes: true,
    });
    observer.observe(style, {
      characterData: true,
      childList: true,
      subtree: true,
    });
    const onNativeModalStateChanged = () => {
      try {
        updateSuspension();
      } catch (error) {
        reportFailure(error);
        return;
      }
      if (disposed || failed) {
        return;
      }
      try {
        verifyStyle();
        if (!suspensionReason) {
          verifyTargets();
          reconcile();
          if (root.hasAttribute(ACTIVE_ATTRIBUTE)) {
            releaseRestingNativeFocus();
          }
        }
      } catch (error) {
        reportFailure(error);
      }
    };
    register(window, "DOMModalDialogClosed", onNativeModalStateChanged);
    register(document, "DOMModalDialogClosed", onNativeModalStateChanged);
    if (typeof windowModalDialog?.addEventListener === "function") {
      register(windowModalDialog, "close", onNativeModalStateChanged);
      register(windowModalDialog, "cancel", onNativeModalStateChanged);
    }
    verifyHealth();
    reconcile();
  } catch (error) {
    disposed = true;
    try {
      clearStructuralVerificationTimer();
      observer?.disconnect();
    } catch {
      // The creation error remains causal.
    }
    for (const removeListener of listeners.reverse()) {
      try {
        removeListener();
      } catch {
        // The creation error remains causal.
      }
    }
    try {
      restorePopupNotificationsAnchorRouter();
    } catch {
      // The creation error remains causal.
    }
    try {
      root.removeAttribute(REVEALED_ATTRIBUTE);
      root.removeAttribute(SUSPENDED_ATTRIBUTE);
    } catch {
      // The creation error remains causal.
    }
    popupProxyAnchor.remove();
    style.remove();
    targets = null;
    throw error;
  }

  const revealForNativeHandoff = ({ phase, symbol }) => {
    if (disposed || failed) {
      throw createNativeUiError("FENNEVIA_NATIVE_UI_UNAVAILABLE", phase, {
        firefoxSymbol: symbol,
      });
    }
    updateSuspension();
    if (suspensionReason === "dom-fullscreen") {
      return false;
    }
    clearHandoffRelease();
    handoffPending = true;
    reconcile();
    const release = () => {
      handoffFrame = undefined;
      handoffTimer = undefined;
      handoffPending = false;
      if (isNativeFocusHeld()) {
        focusHeld = true;
        reconcile();
      } else {
        scheduleHide();
      }
    };
    if (typeof window.requestAnimationFrame === "function") {
      handoffFrame = window.requestAnimationFrame(release);
    } else {
      handoffTimer = window.setTimeout(release, 0);
    }
    return true;
  };

  return Object.freeze({
    assertRequiredCapabilities() {
      verifyHealth();
      return capabilitySnapshots;
    },

    dispose() {
      if (disposed) {
        return false;
      }
      disposed = true;
      let firstError;
      try {
        clearHideTimer();
        clearStructuralVerificationTimer();
        clearEscapeTimer();
        clearHandoffRelease();
        clearPopupProxyTimers();
      } catch (error) {
        firstError = error;
      }
      try {
        observer?.disconnect();
      } catch (error) {
        firstError ??= error;
      }
      observer = null;
      try {
        restorePopupNotificationsAnchorRouter();
      } catch (error) {
        firstError ??= error;
      }
      for (const removeListener of listeners.reverse()) {
        try {
          removeListener();
        } catch (error) {
          firstError ??= error;
        }
      }
      listeners.length = 0;
      openPopups.clear();
      pendingPopupProxies.clear();
      proxiedPopups.clear();
      popupHandoffIds.clear();
      try {
        root.removeAttribute(REVEALED_ATTRIBUTE);
        root.removeAttribute(SUSPENDED_ATTRIBUTE);
      } catch (error) {
        firstError ??= error;
      }
      try {
        storedChromeBackground = "";
        clearChromeBackground();
      } catch (error) {
        firstError ??= error;
      }
      try {
        popupProxyAnchor.remove();
      } catch (error) {
        firstError ??= error;
      }
      try {
        style.remove();
      } catch (error) {
        firstError ??= error;
      }
      targets = null;
      if (firstError) {
        throw annotateNativeUiError(firstError, {
          code: "FENNEVIA_NATIVE_UI_DISPOSE_FAILED",
          phase: "native-ui-dispose",
        });
      }
      return true;
    },

    revealForUrlbar() {
      return revealForNativeHandoff({
        phase: "native-ui-urlbar-handoff",
        symbol: "nativeUi.revealForUrlbar",
      });
    },

    setChromeBackground,

    revealForToolbar() {
      return revealForNativeHandoff({
        phase: "native-ui-toolbar-handoff",
        symbol: "nativeUi.revealForToolbar",
      });
    },

    beginPopupHandoff(panelId) {
      if (disposed || failed) {
        throw createNativeUiError(
          "FENNEVIA_NATIVE_UI_UNAVAILABLE",
          "native-ui-popup-handoff",
          { firefoxSymbol: "nativeUi.beginPopupHandoff" },
        );
      }
      if (
        typeof panelId !== "string" ||
        !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/u.test(panelId)
      ) {
        throw createNativeUiError(
          "FENNEVIA_NATIVE_UI_POPUP_HANDOFF_INVALID",
          "native-ui-popup-handoff",
          { firefoxSymbol: "nativeUi.beginPopupHandoff" },
        );
      }
      popupHandoffIds.add(panelId);
      return true;
    },

    endPopupHandoff(panelId) {
      if (typeof panelId === "string") {
        popupHandoffIds.delete(panelId);
      }
      return true;
    },

    snapshot() {
      return Object.freeze({
        disposed,
        failed,
        openPopupCount: openPopups.size,
        pendingPopupProxyCount: pendingPopupProxies.size,
        popupHandoffCount: popupHandoffIds.size,
        proxiedPopupCount: proxiedPopups.size,
        revealed: root.hasAttribute(REVEALED_ATTRIBUTE),
        styleRuleCount: style.sheet?.cssRules?.length ?? 0,
        suspended: root.hasAttribute(SUSPENDED_ATTRIBUTE),
        suspensionReason,
      });
    },

    verifyHealth,
  });
}

export const nativeUiAttributes = Object.freeze({
  revealed: REVEALED_ATTRIBUTE,
  suspended: SUSPENDED_ATTRIBUTE,
});
export const nativeUiHideDelayMs = HIDE_DELAY_MS;
export const nativeUiStyleId = STYLE_ID;
export const nativeUiPopupAnchorId = POPUP_PROXY_ANCHOR_ID;
export const nativeUiChromeBackgroundProperty = CHROME_BACKGROUND_PROPERTY;
