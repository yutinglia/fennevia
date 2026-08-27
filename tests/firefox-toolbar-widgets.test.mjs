import assert from "node:assert/strict";
import test from "node:test";

import {
  createFirefoxBridgeBoundary,
  isFirefoxBridgeError,
} from "../src/firefox/bridge-boundary.ts";
import { createFirefoxToolbarWidgetsBridge } from "../src/firefox/toolbar-widgets.ts";
import { resolvePinnedBuiltinIconUrl } from "../src/firefox/toolbar-widgets/support.ts";
import { createDefaultToolbarStyle } from "../src/app/toolbar-widgets-state.ts";

const BROWSER_URI = "chrome://browser/content/browser.xhtml";
const EXTENSION_ICON_URL =
  "moz-extension://11111111-2222-3333-4444-555555555555/icon-32.png";
const FLUENT_ATTRIBUTE_MESSAGES = Object.freeze({
  "toolbar-button-save-page": {
    label: "Save Page",
    tooltiptext: "Save this page",
  },
  "toolbar-button-email-link": {
    label: "Email Link",
    tooltiptext: "Email a link to this page",
  },
  "toolbar-button-share-tab": {
    label: "Share",
    tooltiptext: "Share this page",
  },
  "toolbar-button-open-file": {
    label: "Open File Fluent",
    tooltiptext: "Open a file",
  },
  "toolbar-button-logins": {
    label: "Passwords",
    tooltiptext: "View and manage your saved passwords",
  },
  "appmenuitem-new-window": {
    label: "New Window",
  },
  "appmenuitem-fullscreen": {
    label: "Full Screen",
  },
  "screenshot-toolbar-button": {
    label: "Screenshot",
    tooltiptext: "Take a screenshot",
  },
  "reset-pbm-toolbar-button2": {
    label: "Clear Private Session",
    tooltiptext: "Clear Private Session",
  },
});
let nextContextSequence = 0;

test("pinned built-in icon fallbacks follow Firefox 153 and 154 resource names", () => {
  assert.equal(
    resolvePinnedBuiltinIconUrl("send-tab-button", "153.0.4"),
    "chrome://browser/skin/send-tab-20.svg",
  );
  assert.equal(
    resolvePinnedBuiltinIconUrl("send-tab-button", "154.0"),
    "chrome://browser/skin/send-tab.svg",
  );
  assert.equal(
    resolvePinnedBuiltinIconUrl("ipprotection-button", "153.0.4"),
    "chrome://browser/content/ipprotection/assets/states/ipprotection-off.svg",
  );
  assert.equal(
    resolvePinnedBuiltinIconUrl("ipprotection-button", "154.0"),
    "chrome://browser/content/ipprotection/assets/states/ipprotection-off.svg",
  );
});

function formatFluentAttributeMessages(keys) {
  const id = keys?.[0]?.id;
  const attributes = FLUENT_ATTRIBUTE_MESSAGES[id];
  if (!attributes) {
    return [{ value: null, attributes: null }];
  }
  return [{ value: null, attributes }];
}

function createEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    dispatch(type, target) {
      const event = { originalTarget: target, target, type };
      for (const listener of [...(listeners.get(type) ?? [])]) {
        listener(event);
      }
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
  };
}

function createNativeWindow({
  extraAreaWidgetIds = [],
  withCustomizableUi = true,
  withPrefs = true,
} = {}) {
  const calls = [];
  const targets = new Map();
  const frameHosts = new Set();
  const observers = [];
  const timers = new Map();
  let nextTimerId = 1;
  const documentEvents = createEventTarget();
  const prefValues = new Map();
  const prefObservers = new Set();

  const prefs = {
    addObserver(domain, observer) {
      calls.push(["prefs-add-observer", domain]);
      prefObservers.add(observer);
    },
    clearUserPref(name) {
      calls.push(["prefs-clear", name]);
      prefValues.delete(name);
      for (const observer of [...prefObservers]) {
        observer.observe(null, "nsPref:changed", name);
      }
    },
    getStringPref(name, fallback) {
      return prefValues.get(name) ?? fallback;
    },
    removeObserver(domain, observer) {
      calls.push(["prefs-remove-observer", domain]);
      prefObservers.delete(observer);
    },
    setStringPref(name, value) {
      calls.push(["prefs-set", name]);
      prefValues.set(name, value);
      for (const observer of [...prefObservers]) {
        observer.observe(null, "nsPref:changed", name);
      }
    },
  };

  const document = {
    ...documentEvents,
    defaultView: null,
    documentURI: BROWSER_URI,
    getElementById(id) {
      return targets.get(id) ?? null;
    },
    querySelectorAll(selector) {
      calls.push(["querySelectorAll", selector]);
      return [];
    },
    l10n: {
      formatMessagesSync(keys) {
        calls.push(["l10n-messages", keys?.[0]?.id]);
        return formatFluentAttributeMessages(keys);
      },
      formatValueSync(id) {
        calls.push(["l10n-format", id]);
        if (id === "navbar-print") {
          return "Print";
        }
        return id;
      },
    },
    styleSheets: {
      0: {
        cssRules: {
          0: {
            selectorText: "#save-page-button",
            style: {
              listStyleImage: 'url("chrome://browser/skin/save.svg")',
            },
          },
          1: {
            selectorText: "#find-button",
            style: {
              listStyleImage:
                'url("chrome://global/skin/icons/search-glass.svg")',
            },
          },
          2: {
            selectorText: "#open-file-button",
            style: {
              listStyleImage: 'url("chrome://browser/skin/open.svg")',
            },
          },
          3: {
            cssRules: {
              0: {
                selectorText: "#print-button",
                style: {
                  listStyleImage: 'url("chrome://global/skin/icons/print.svg")',
                },
              },
              length: 1,
            },
          },
          4: {
            selectorText: "#email-link-button",
            style: {
              listStyleImage: 'url("chrome://browser/skin/mail.svg")',
            },
          },
          5: {
            selectorText: "#share-tab-button",
            cssRules: {
              0: {
                selectorText: "&",
                style: {
                  listStyleImage: 'url("chrome://browser/skin/share.svg")',
                },
              },
              length: 1,
            },
          },
          length: 6,
        },
      },
      length: 1,
    },
  };

  const frame = {
    contains(node) {
      return frameHosts.has(node);
    },
  };

  function createWidgetPanel() {
    const panel = {
      anchorNode: null,
      hidePopup() {
        calls.push(["hidePopup", "customizationui-widget-panel"]);
        this.state = "closed";
        documentEvents.dispatch("popuphidden", panel);
      },
      id: "customizationui-widget-panel",
      moveToAnchor(anchor, position) {
        calls.push(["moveToAnchor", this.id, anchor, position]);
        this.anchorNode = anchor;
      },
      state: "open",
    };
    return panel;
  }

  function createNodePanel(id) {
    const panel = {
      anchorNode: null,
      hidePopup() {
        calls.push(["hidePopup", id]);
        this.state = "closed";
        documentEvents.dispatch("popuphidden", panel);
      },
      id,
      moveToAnchor(anchor, position) {
        calls.push(["moveToAnchor", id, anchor, position]);
        this.anchorNode = anchor;
      },
      state: "closed",
    };
    return panel;
  }

  function createMenuPanel(id) {
    const panel = createNodePanel(id);
    panel.openPopup = function (anchor, options) {
      calls.push(["openPopup", id, anchor, options]);
      this.anchorNode = anchor;
      this.state = "open";
      documentEvents.dispatch("popupshown", panel);
    };
    return panel;
  }

  const extensionActionButton = {
    badge: "3",
    badgeStyle: "background-color: rgb(217, 0, 0); color: rgb(255, 255, 255);",
    disabled: false,
    getAttribute(name) {
      if (name === "badge") {
        return this.badge;
      }
      if (name === "badgeStyle") {
        return this.badgeStyle;
      }
      return null;
    },
    style: {
      getPropertyValue(name) {
        return name === "--webextension-toolbar-image"
          ? `image-set(url("${EXTENSION_ICON_URL}"), url("${EXTENSION_ICON_URL}") 2x)`
          : "";
      },
    },
  };

  const extensionNode = {
    contains(candidate) {
      return candidate === extensionNode;
    },
    getAttribute(name) {
      return name === "tooltiptext" ? "" : null;
    },
    id: "extension-widget_example_com-browser-action",
    isConnected: true,
    querySelector(selector) {
      if (selector === ".unified-extensions-item-action-button") {
        return extensionActionButton;
      }
      if (selector === ".unified-extensions-item-name") {
        return { textContent: "Test Extension" };
      }
      return null;
    },
  };
  targets.set(extensionNode.id, extensionNode);

  const sidebarNode = {
    doCommand() {
      calls.push(["doCommand", "sidebar-button"]);
    },
    getAttribute(name) {
      if (name === "label") {
        return "Sidebar";
      }
      if (name === "tooltiptext") {
        return "Show sidebars";
      }
      return null;
    },
    id: "sidebar-button",
    isConnected: true,
  };
  targets.set(sidebarNode.id, sidebarNode);

  const historyPanel = createNodePanel("history-panel");
  const historyNode = {
    contains(candidate) {
      return candidate === historyNode;
    },
    doCommand() {
      calls.push(["doCommand", "history-panelmenu"]);
      historyPanel.anchorNode = historyNode;
      historyPanel.state = "open";
      documentEvents.dispatch("popupshown", historyPanel);
    },
    getAttribute(name) {
      return name === "tooltiptext" ? "History" : null;
    },
    id: "history-panelmenu",
    isConnected: true,
  };
  targets.set(historyNode.id, historyNode);

  const accountNode = {
    contains(candidate) {
      return candidate === accountNode;
    },
    getAttribute(name) {
      if (name === "label") {
        return "Account";
      }
      if (name === "tooltiptext") {
        return "Manage account";
      }
      return null;
    },
    id: "fxa-toolbar-menu-button",
    isConnected: true,
  };
  targets.set(accountNode.id, accountNode);

  const libraryNode = {
    contains(candidate) {
      return candidate === libraryNode;
    },
    getAttribute(name) {
      return name === "label" ? "Library" : null;
    },
    id: "library-button",
    isConnected: true,
  };
  targets.set(libraryNode.id, libraryNode);

  const allTabsNode = {
    contains(candidate) {
      return candidate === allTabsNode;
    },
    getAttribute(name) {
      return name === "label" ? "List all tabs" : null;
    },
    id: "alltabs-button",
    isConnected: true,
  };
  targets.set(allTabsNode.id, allTabsNode);

  const bookmarksPopup = createMenuPanel("BMB_bookmarksPopup");
  const bookmarksMenuNode = {
    contains(candidate) {
      return candidate === bookmarksMenuNode || candidate === bookmarksPopup;
    },
    getAttribute(name) {
      if (name === "type") {
        return "menu";
      }
      return name === "label" ? "Bookmarks Menu" : null;
    },
    id: "bookmarks-menu-button",
    isConnected: true,
    querySelector(selector) {
      return selector === "menupopup" ? bookmarksPopup : null;
    },
  };
  targets.set(bookmarksMenuNode.id, bookmarksMenuNode);

  function createCompoundPart(id, label, tooltip) {
    const attributes = new Map([
      ["label", label],
      ["tooltiptext", tooltip],
    ]);
    return {
      doCommand() {
        calls.push(["doCommand", id]);
      },
      getAttribute(name) {
        return attributes.get(name) ?? null;
      },
      id,
      isConnected: true,
      setAttribute(name, value) {
        attributes.set(name, String(value));
      },
    };
  }

  const compoundParts = new Map([
    [
      "zoom-out-button",
      createCompoundPart("zoom-out-button", "Zoom out", "Zoom out (Ctrl+-)"),
    ],
    [
      "zoom-reset-button",
      createCompoundPart(
        "zoom-reset-button",
        "100%",
        "Reset zoom level (Ctrl+0)",
      ),
    ],
    [
      "zoom-in-button",
      createCompoundPart("zoom-in-button", "Zoom in", "Zoom in (Ctrl++)"),
    ],
    ["cut-button", createCompoundPart("cut-button", "Cut", "Cut (Ctrl+X)")],
    ["copy-button", createCompoundPart("copy-button", "Copy", "Copy (Ctrl+C)")],
    [
      "paste-button",
      createCompoundPart("paste-button", "Paste", "Paste (Ctrl+V)"),
    ],
    [
      "profiler-button-button",
      createCompoundPart(
        "profiler-button-button",
        "Profiler",
        "Start or capture a profile",
      ),
    ],
    [
      "profiler-button-dropmarker",
      createCompoundPart(
        "profiler-button-dropmarker",
        "Open the profiler panel",
        "Open the profiler panel",
      ),
    ],
  ]);
  for (const [id, part] of compoundParts) {
    targets.set(id, part);
  }
  const createCompoundNode = (id, label, partIds) => {
    const node = {
      contains(candidate) {
        return partIds.some(
          (partId) => compoundParts.get(partId) === candidate,
        );
      },
      getAttribute(name) {
        return name === "label" ? label : null;
      },
      id,
      isConnected: true,
      querySelector(selector) {
        const partId = selector.startsWith("#") ? selector.slice(1) : "";
        return partIds.includes(partId) ? compoundParts.get(partId) : null;
      },
    };
    for (const partId of partIds) {
      compoundParts.get(partId).parentElement = node;
    }
    return node;
  };
  const zoomControlsNode = createCompoundNode("zoom-controls", "Zoom", [
    "zoom-out-button",
    "zoom-reset-button",
    "zoom-in-button",
  ]);
  const editControlsNode = createCompoundNode("edit-controls", "Edit", [
    "cut-button",
    "copy-button",
    "paste-button",
  ]);
  const profilerNode = createCompoundNode("profiler-button", "Profiler", [
    "profiler-button-button",
    "profiler-button-dropmarker",
  ]);
  targets.set(zoomControlsNode.id, zoomControlsNode);
  targets.set(editControlsNode.id, editControlsNode);
  targets.set(profilerNode.id, profilerNode);

  let areaWidgetIds = [
    "back-button",
    "urlbar-container",
    "unified-extensions-button",
    "PanelUI-menu-button",
    "customizableui-special-spring3",
    "sidebar-button",
    "extension-widget_example_com-browser-action",
    "customizableui-special-spacer7",
    "history-panelmenu",
    ...extraAreaWidgetIds,
  ];
  let addonsWidgetIds = ["extension-addons_example_com-browser-action"];

  const wrappers = new Map([
    [
      "extension-widget_example_com-browser-action",
      {
        forWindow() {
          calls.push([
            "forWindow",
            "extension-widget_example_com-browser-action",
          ]);
          throw new Error("forWindow must not be used for presentation");
        },
        label: "Test Extension",
        tooltiptext: "Test Extension tooltip",
        viewId: "PanelUI-webext-widget_example_com-browser-action-view",
        webExtension: true,
      },
    ],
    [
      "extension-addons_example_com-browser-action",
      {
        forWindow() {
          calls.push([
            "forWindow",
            "extension-addons_example_com-browser-action",
          ]);
          throw new Error("forWindow must not be used for presentation");
        },
        label: "Addons Extension",
        showInPrivateBrowsing: false,
        webExtension: true,
      },
    ],
    [
      "print-button",
      {
        forWindow() {
          calls.push(["forWindow", "print-button"]);
          throw new Error("forWindow must not be used for presentation");
        },
      },
    ],
    [
      "sidebar-button",
      {
        forWindow() {
          calls.push(["forWindow", "sidebar-button"]);
          throw new Error("forWindow must not be used for presentation");
        },
        label: "Sidebar wrapper",
      },
    ],
    [
      "history-panelmenu",
      {
        forWindow() {
          calls.push(["forWindow", "history-panelmenu"]);
          throw new Error("forWindow must not be used for presentation");
        },
        label: "History",
        tooltiptext: "history-panelmenu.tooltiptext2",
      },
    ],
    [
      "share-tab-button",
      {
        forWindow() {
          calls.push(["forWindow", "share-tab-button"]);
          throw new Error("forWindow must not be used for presentation");
        },
      },
    ],
    [
      "logins-button",
      {
        forWindow() {
          calls.push(["forWindow", "logins-button"]);
          throw new Error("forWindow must not be used for presentation");
        },
      },
    ],
    [
      "find-button",
      {
        forWindow() {
          calls.push(["forWindow", "find-button"]);
          throw new Error("forWindow must not be used for presentation");
        },
        tooltiptext: "find-button.tooltiptext3",
      },
    ],
    [
      "zoom-controls",
      {
        forWindow() {
          calls.push(["forWindow", "zoom-controls"]);
          throw new Error("forWindow must not be used for presentation");
        },
        tooltiptext: "zoom-controls.tooltiptext2",
      },
    ],
    [
      "edit-controls",
      {
        forWindow() {
          calls.push(["forWindow", "edit-controls"]);
          throw new Error("forWindow must not be used for presentation");
        },
        tooltiptext: "edit-controls.tooltiptext2",
      },
    ],
    [
      "profiler-button",
      {
        label: "Profiler",
        tooltiptext: "Profiler",
        type: "button-and-view",
        viewId: "PanelUI-profiler",
      },
    ],
    [
      "reset-pbm-toolbar-button",
      {
        forWindow() {
          calls.push(["forWindow", "reset-pbm-toolbar-button"]);
          throw new Error("forWindow must not be used for presentation");
        },
      },
    ],
  ]);

  const unusedWidgetIds = [
    "print-button",
    "save-page-button",
    "find-button",
    "open-file-button",
    "email-link-button",
    "share-tab-button",
    "logins-button",
    "new-window-button",
    "fullscreen-button",
    "screenshot-button",
    "zoom-controls",
    "edit-controls",
    "profiler-button",
    "reset-pbm-toolbar-button",
  ];

  const customizableUiListeners = new Set();
  const customizableUi = {
    AREA_ADDONS: "unified-extensions-area",
    addListener(listener) {
      calls.push(["cui-add-listener"]);
      customizableUiListeners.add(listener);
    },
    addWidgetToArea(id, area) {
      calls.push(["cui-add-widget", id, area]);
      areaWidgetIds = areaWidgetIds.filter((candidate) => candidate !== id);
      addonsWidgetIds = addonsWidgetIds.filter((candidate) => candidate !== id);
      if (area === "nav-bar") {
        areaWidgetIds.push(id);
        if (!targets.has(id)) {
          targets.set(id, {
            doCommand() {
              calls.push(["doCommand", id]);
            },
            getAttribute() {
              return null;
            },
            id,
            isConnected: true,
          });
        }
        return;
      }
      if (area === "unified-extensions-area") {
        addonsWidgetIds.push(id);
        targets.delete(id);
      }
    },
    get areas() {
      return ["nav-bar", "unified-extensions-area"];
    },
    getPlacementOfWidget(id) {
      if (areaWidgetIds.includes(id)) {
        return { area: "nav-bar", position: areaWidgetIds.indexOf(id) };
      }
      if (addonsWidgetIds.includes(id)) {
        return {
          area: "unified-extensions-area",
          position: addonsWidgetIds.indexOf(id),
        };
      }
      return null;
    },
    getUnusedWidgets(palette) {
      calls.push(["cui-get-unused", palette === navToolboxPalette]);
      return unusedWidgetIds
        .filter(
          (id) => !areaWidgetIds.includes(id) && !addonsWidgetIds.includes(id),
        )
        .map((id) => ({ id }));
    },
    getWidget(id) {
      return wrappers.get(id) ?? null;
    },
    getLocalizedProperty(id, property) {
      calls.push(["cui-localized", id, property]);
      if (id === "find-button" && property === "label") {
        return "Find in This Page";
      }
      if (id === "zoom-controls" && property === "label") {
        return "Zoom";
      }
      if (id === "edit-controls" && property === "label") {
        return "Edit";
      }
      if (property === "tooltiptext") {
        return `${id}.tooltiptext2`;
      }
      return "";
    },
    getWidgetIdsInArea(area) {
      calls.push(["cui-get-widget-ids", area]);
      if (area === "unified-extensions-area") {
        return [...addonsWidgetIds];
      }
      return [...areaWidgetIds];
    },
    isWebExtensionWidget(id) {
      return id.endsWith("-browser-action");
    },
    removeListener(listener) {
      calls.push(["cui-remove-listener"]);
      customizableUiListeners.delete(listener);
    },
    removeWidgetFromArea(id) {
      calls.push(["cui-remove-widget", id]);
      areaWidgetIds = areaWidgetIds.filter((candidate) => candidate !== id);
      addonsWidgetIds = addonsWidgetIds.filter((candidate) => candidate !== id);
      targets.delete(id);
    },
  };

  const paletteNodes = new Map();
  paletteNodes.set("open-file-button", {
    getAttribute(name) {
      if (name === "label") {
        return "Open File";
      }
      if (name === "tooltiptext") {
        return "Open a file";
      }
      if (name === "title") {
        return "";
      }
      return null;
    },
    id: "open-file-button",
    isConnected: false,
  });
  paletteNodes.set("email-link-button", {
    getAttribute(name) {
      if (name === "data-l10n-id") {
        return "toolbar-button-email-link";
      }
      return null;
    },
    id: "email-link-button",
    isConnected: false,
  });
  paletteNodes.set("new-window-button", {
    getAttribute(name) {
      return name === "data-l10n-id" ? "appmenuitem-new-window" : null;
    },
    id: "new-window-button",
    isConnected: false,
  });
  paletteNodes.set("fullscreen-button", {
    getAttribute(name) {
      return name === "data-l10n-id" ? "appmenuitem-fullscreen" : null;
    },
    id: "fullscreen-button",
    isConnected: false,
  });
  const navToolboxPalette = {
    getElementsByAttribute(name, value) {
      calls.push(["palette-get", name, value]);
      if (name !== "id") {
        return [];
      }
      const node = paletteNodes.get(value);
      return node ? [node] : [];
    },
  };

  const window = {
    CustomEvent: class {
      constructor(type, init) {
        this.type = type;
        this.init = init;
      }
    },
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
        this.disconnected = false;
        this.observed = [];
        observers.push(this);
      }
      disconnect() {
        this.disconnected = true;
      }
      observe(node, options) {
        this.observed.push({ node, options });
      }
      trigger() {
        this.callback([], this);
      }
    },
    PanelUI: {
      showSubView(viewId, anchor, triggerEvent) {
        calls.push(["showSubView", viewId, anchor, triggerEvent]);
        const panel = createWidgetPanel();
        panel.anchorNode = anchor;
        documentEvents.dispatch("popupshown", panel);
        return Promise.resolve();
      },
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    document,
    gBrowser: {
      selectedBrowser: { webNavigation: {} },
      tabContainer: createEventTarget(),
      tabs: [],
    },
    gSync: {
      async toggleAccountPanel(anchor, triggerEvent) {
        calls.push(["toggleAccountPanel", anchor, triggerEvent]);
        await window.PanelUI.showSubView("PanelUI-fxa", anchor, triggerEvent);
      },
    },
    gTabsPanel: {
      allTabsButton: allTabsNode,
      init() {
        calls.push(["all-tabs-init"]);
      },
      showAllTabsPanel(triggerEvent, entrypoint) {
        calls.push([
          "showAllTabsPanel",
          this.allTabsButton,
          triggerEvent,
          entrypoint,
        ]);
        return window.PanelUI.showSubView(
          "allTabsMenu-allTabsView",
          this.allTabsButton,
          triggerEvent,
        );
      },
    },
    gNavToolbox: { palette: navToolboxPalette },
    setTimeout(callback) {
      const id = nextTimerId++;
      timers.set(id, callback);
      return id;
    },
  };
  if (withCustomizableUi) {
    window.CustomizableUI = customizableUi;
  }
  if (withPrefs) {
    window.Services = { prefs };
  }
  window.document.defaultView = window;

  return {
    accountNode,
    addHost() {
      const host = {
        getBoundingClientRect() {
          return { height: 32, width: 32, x: 12, y: 24 };
        },
        ownerDocument: document,
      };
      frameHosts.add(host);
      return host;
    },
    calls,
    bookmarksMenuNode,
    bookmarksPopup,
    compoundParts,
    customizableUiListeners,
    documentEvents,
    extensionActionButton,
    extensionNode,
    frame,
    getAddonsWidgetIds() {
      return [...addonsWidgetIds];
    },
    getAreaWidgetIds() {
      return [...areaWidgetIds];
    },
    getPrefValue(name) {
      return prefValues.get(name);
    },
    historyNode,
    libraryNode,
    observers,
    pendingTimerCount() {
      return timers.size;
    },
    prefObservers,
    profilerNode,
    removeAreaWidget(id) {
      areaWidgetIds = areaWidgetIds.filter((candidate) => candidate !== id);
    },
    runTimers() {
      const due = [...timers.values()];
      timers.clear();
      for (const callback of due) {
        callback();
      }
    },
    setPrefValue(name, value) {
      prefs.setStringPref(name, value);
    },
    sidebarNode,
    targets,
    allTabsNode,
    window,
    zoomControlsNode,
  };
}

function createController(native, windowKind = "normal") {
  const contextId = `window-toolbar-widgets-${String(
    ++nextContextSequence,
  ).padStart(12, "0")}`;
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260810162159",
    contextId,
    firefoxVersion: "153.0.4",
    window: native.window,
    windowKind,
  });
  const controller = createFirefoxToolbarWidgetsBridge({
    boundary,
    frame: native.frame,
    window: native.window,
  });
  return { boundary, controller };
}

function createLegacyNavbarController(native, windowKind = "normal") {
  const skipped = new Set([
    "back-button",
    "urlbar-container",
    "unified-extensions-button",
    "PanelUI-menu-button",
  ]);
  const top = native
    .getAreaWidgetIds()
    .filter((id) => !skipped.has(id))
    .map((id) => {
      if (id.startsWith("customizableui-special-spring")) {
        return { kind: "spring", type: "special" };
      }
      if (id.startsWith("customizableui-special-spacer")) {
        return { kind: "spacer", type: "special" };
      }
      if (id.startsWith("customizableui-special-separator")) {
        return { kind: "separator", type: "special" };
      }
      return { id, type: "widget" };
    });
  native.setPrefValue(
    "fennevia.customize.layout",
    JSON.stringify({
      adopted: [],
      version: 1,
      zones: { bottom: [], left: [], right: [], top },
    }),
  );
  return createController(native, windowKind);
}

function disposePair(pair) {
  pair.controller.dispose();
  pair.boundary.dispose();
}

function findLayoutItems(layout, predicate) {
  const matches = [];
  const visit = (nodes, zone, parentPath) => {
    for (const [index, node] of nodes.entries()) {
      const path = [...parentPath, index];
      if (node.type !== "item") {
        visit(node.children, zone, path);
      } else if (predicate(node)) {
        matches.push({ node, path, zone });
      }
    }
  };
  for (const zone of ["top", "left", "right", "bottom"]) {
    visit(layout[zone], zone, []);
  }
  return matches;
}

test("default snapshot uses the explicit native-v2 base-flow composition", () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    const snapshot = pair.controller.toolbarWidgets.snapshot();
    assert.equal(snapshot.available, true);
    assert.equal(snapshot.canEdit, true);
    assert.equal(snapshot.layoutCustomized, false);
    assert.deepEqual(
      snapshot.zones.top.map((widget) => widget.kind),
      ["fennevia"],
    );
    assert.deepEqual(
      snapshot.zones.left.map((widget) => widget.kind),
      ["separator"],
    );
    assert.deepEqual(snapshot.zones.right, []);
    assert.deepEqual(snapshot.zones.bottom, []);

    assert.ok(snapshot.layout.top.every((node) => node.type !== "container"));
    assert.equal(snapshot.layout.left[0].type, "container");
    assert.ok(snapshot.layout.right.every((node) => node.type !== "container"));
    assert.ok(
      snapshot.layout.bottom.every((node) => node.type !== "container"),
    );
    assert.deepEqual(
      findLayoutItems(snapshot.layout, (node) => node.projectId !== "")
        .filter((location) => location.zone === "top")
        .map((location) => location.node.projectId),
      [
        "back",
        "forward",
        "reload-stop",
        "home",
        "trust",
        "show-downloads",
        "extensions",
        "settings",
        "customize-shell",
        "application-menu",
        "private-indicator",
        "minimize-window",
        "toggle-maximize-window",
        "close-window",
      ],
    );
    assert.equal(snapshot.layout.top[5].type, "wrapper");
    assert.equal(snapshot.layout.top[5].kind, "expanded");
    assert.deepEqual(snapshot.layout.top[5].children, []);
    assert.equal(snapshot.layout.left[0].type, "container");
    assert.equal(snapshot.layout.left[0].direction, "row");
    assert.equal(snapshot.layout.left[0].padding, "standard");
    assert.equal(snapshot.layout.left[0].children[0].type, "wrapper");
    assert.equal(snapshot.layout.left[0].children[0].kind, "expanded");
    assert.equal(
      snapshot.layout.left[0].children[0].children[0].projectId,
      "address-launcher",
    );
    assert.equal(snapshot.layout.left[1].type, "wrapper");
    assert.equal(snapshot.layout.left[1].kind, "expanded");
    assert.equal(snapshot.layout.left[1].children[0].projectId, "tabs");
    assert.equal(snapshot.layout.left[2].widget.kind, "separator");
    assert.equal(snapshot.layout.right[0].type, "wrapper");
    assert.equal(snapshot.layout.right[0].children[0].projectId, "bookmarks");
    assert.equal(snapshot.layout.bottom[0].kind, "expanded");
    assert.equal(snapshot.layout.bottom[0].children[0].kind, "center");
    assert.equal(
      snapshot.layout.bottom[0].children[0].children[0].projectId,
      "downloads-status",
    );
    assert.equal(
      findLayoutItems(
        snapshot.layout,
        (node) => node.projectId === "address-launcher",
      )[0].node.style,
      "with-site-status",
    );
    assert.equal(
      findLayoutItems(snapshot.layout, (node) => node.projectId === "tabs")[0]
        .node.style,
      "with-new-tab",
    );

    assert.deepEqual(snapshot.style, createDefaultToolbarStyle());

    const paletteLabels = snapshot.palette.map((entry) => entry.label);
    assert.ok(paletteLabels.includes("Show bookmarks panel"));
    assert.ok(!paletteLabels.includes("Open Firefox downloads"));
    assert.ok(paletteLabels.includes("Translate this page"));
    assert.ok(paletteLabels.includes("Print"));
    assert.ok(paletteLabels.includes("Save Page"));
    const orphanCompanion = snapshot.palette.find(
      (entry) => entry.label === "Show bookmarks panel",
    );
    assert.ok(orphanCompanion);
    assert.equal(orphanCompanion.kind, "project");
    assert.equal(orphanCompanion.featureGroup, "");
    assert.ok(paletteLabels.includes("Find in This Page"));
    assert.ok(paletteLabels.includes("Open File"));
    assert.ok(paletteLabels.includes("Email Link"));
    assert.ok(paletteLabels.includes("Share"));
    assert.ok(paletteLabels.includes("Passwords"));
    assert.ok(paletteLabels.includes("New Window"));
    assert.ok(paletteLabels.includes("Full Screen"));
    assert.ok(paletteLabels.includes("Screenshot"));
    assert.ok(paletteLabels.includes("Clear Private Session"));
    assert.ok(paletteLabels.includes("Zoom"));
    assert.ok(paletteLabels.includes("Edit"));
    assert.ok(paletteLabels.includes("Addons Extension"));
    assert.ok(paletteLabels.includes("Sidebar"));
    assert.ok(paletteLabels.includes("Test Extension"));
    assert.ok(paletteLabels.includes("History"));
    assert.ok(paletteLabels.includes("Flexible space"));
    assert.ok(
      snapshot.palette.every((entry) => /^palette-\d+$/u.test(entry.token)),
    );
    assert.ok(
      snapshot.palette.every(
        (entry) => !/\.(?:label|tooltiptext\d*)$/u.test(entry.label),
      ),
    );
    const savePage = snapshot.palette.find(
      (entry) => entry.label === "Save Page",
    );
    assert.equal(savePage.kind, "built-in");
    assert.equal(savePage.iconUrl, "chrome://browser/skin/save.svg");
    const findPage = snapshot.palette.find(
      (entry) => entry.label === "Find in This Page",
    );
    assert.equal(
      findPage.iconUrl,
      "chrome://global/skin/icons/search-glass.svg",
    );
    const zoomControls = snapshot.palette.find(
      (entry) => entry.label === "Zoom",
    );
    assert.equal(zoomControls.icon, "zoom");
    const openFile = snapshot.palette.find(
      (entry) => entry.label === "Open File",
    );
    assert.equal(openFile.iconUrl, "chrome://browser/skin/open.svg");
    const emailLink = snapshot.palette.find(
      (entry) => entry.label === "Email Link",
    );
    assert.equal(emailLink.iconUrl, "chrome://browser/skin/mail.svg");
    const sharePage = snapshot.palette.find((entry) => entry.label === "Share");
    assert.equal(sharePage.iconUrl, "chrome://browser/skin/share.svg");
    const passwords = snapshot.palette.find(
      (entry) => entry.label === "Passwords",
    );
    assert.equal(passwords.iconUrl, "chrome://browser/skin/login.svg");
    const printEntry = snapshot.palette.find(
      (entry) => entry.label === "Print",
    );
    assert.equal(printEntry.iconUrl, "chrome://global/skin/icons/print.svg");
    const newWindow = snapshot.palette.find(
      (entry) => entry.label === "New Window",
    );
    assert.equal(newWindow.iconUrl, "chrome://browser/skin/window.svg");
    const fullScreen = snapshot.palette.find(
      (entry) => entry.label === "Full Screen",
    );
    assert.equal(fullScreen.iconUrl, "chrome://browser/skin/fullscreen.svg");
    const screenshot = snapshot.palette.find(
      (entry) => entry.label === "Screenshot",
    );
    assert.equal(screenshot.iconUrl, "chrome://browser/skin/screenshot.svg");
    assert.ok(!native.calls.some((entry) => entry[0] === "forWindow"));

    const serialized = JSON.stringify(snapshot);
    assert.doesNotMatch(
      serialized,
      /sidebar-button|history-panelmenu|widget_example_com|back-button|urlbar-container|print-button|save-page-button|find-button|open-file-button|email-link-button|share-tab-button|logins-button|new-window-button|fullscreen-button|screenshot-button|zoom-controls|edit-controls|reset-pbm-toolbar-button/u,
    );
  } finally {
    disposePair(pair);
  }
});

test("Fluent labels resolve through a dedicated sync Localization when document.l10n is async", () => {
  const native = createNativeWindow();
  native.window.document.l10n.formatMessagesSync = () => {
    throw new Error("Can't use formatMessagesSync when state is async.");
  };
  native.window.document.l10n.formatValueSync = () => {
    throw new Error("Can't use formatValueSync when state is async.");
  };
  native.window.Localization = class Localization {
    constructor(resourceIds, isSync) {
      native.calls.push(["Localization", [...resourceIds], isSync]);
    }
    formatMessagesSync(keys) {
      native.calls.push(["sync-l10n-messages", keys?.[0]?.id]);
      return formatFluentAttributeMessages(keys);
    }
    formatValueSync(id) {
      native.calls.push(["sync-l10n-format", id]);
      return id === "navbar-print" ? "Print" : id;
    }
  };
  const pair = createController(native);
  try {
    const snapshot = pair.controller.toolbarWidgets.snapshot();
    const paletteLabels = snapshot.palette.map((entry) => entry.label);
    assert.ok(paletteLabels.includes("Email Link"));
    assert.ok(paletteLabels.includes("Share"));
    assert.ok(paletteLabels.includes("Passwords"));
    assert.ok(paletteLabels.includes("Save Page"));
    assert.ok(paletteLabels.includes("Print"));
    assert.ok(paletteLabels.includes("New Window"));
    assert.ok(paletteLabels.includes("Full Screen"));
    assert.ok(paletteLabels.includes("Screenshot"));
    assert.ok(paletteLabels.includes("Clear Private Session"));
    assert.ok(paletteLabels.includes("Zoom"));
    assert.ok(paletteLabels.includes("Edit"));
    assert.ok(!paletteLabels.includes("Toolbar item"));
    const localizationCall = native.calls.find(
      (entry) => entry[0] === "Localization",
    );
    assert.equal(localizationCall?.[2], true);
    assert.ok(localizationCall?.[1].includes("browser/browser.ftl"));
    assert.ok(localizationCall?.[1].includes("browser/sidebar.ftl"));
    assert.ok(localizationCall?.[1].includes("browser/appmenu.ftl"));
    assert.ok(localizationCall?.[1].includes("browser/screenshots.ftl"));
    assert.ok(
      native.calls.some(
        (entry) =>
          entry[0] === "sync-l10n-messages" &&
          entry[1] === "toolbar-button-share-tab",
      ),
    );
    assert.ok(
      native.calls.some(
        (entry) =>
          entry[0] === "sync-l10n-messages" &&
          (entry[1] === "appmenuitem-new-window" ||
            entry[1] === "appmenuitem-fullscreen" ||
            entry[1] === "screenshot-toolbar-button"),
      ),
    );
  } finally {
    disposePair(pair);
  }
});

test("Fluent-mapped built-ins resolve before legacy properties localization", () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    const snapshot = pair.controller.toolbarWidgets.snapshot();
    assert.ok(snapshot.palette.some((entry) => entry.label === "Save Page"));
    assert.ok(snapshot.palette.some((entry) => entry.label === "Print"));
    assert.ok(snapshot.palette.some((entry) => entry.label === "Share"));
    assert.ok(snapshot.palette.some((entry) => entry.label === "Passwords"));
    assert.ok(snapshot.palette.some((entry) => entry.label === "Screenshot"));
    assert.ok(
      snapshot.palette.some((entry) => entry.label === "Clear Private Session"),
    );

    const legacyLocalizationCalls = native.calls.filter(
      (entry) => entry[0] === "cui-localized",
    );
    for (const widgetId of [
      "print-button",
      "save-page-button",
      "share-tab-button",
      "logins-button",
      "screenshot-button",
      "reset-pbm-toolbar-button",
    ]) {
      assert.ok(
        !legacyLocalizationCalls.some((entry) => entry[1] === widgetId),
        `${widgetId} should resolve through Fluent before the legacy bundle`,
      );
    }
    assert.ok(
      legacyLocalizationCalls.some(
        (entry) => entry[1] === "find-button" && entry[2] === "label",
      ),
    );
  } finally {
    disposePair(pair);
  }
});

test("sync Localization includes allowlisted chrome document Fluent resources", () => {
  const native = createNativeWindow();
  native.window.document.querySelectorAll = (selector) => {
    native.calls.push(["querySelectorAll", selector]);
    if (selector !== 'link[rel="localization"]') {
      return [];
    }
    return [
      {
        getAttribute(name) {
          return name === "href" ? "browser/firefoxView.ftl" : null;
        },
      },
      {
        getAttribute(name) {
          return name === "href" ? "https://evil.example/x.ftl" : null;
        },
      },
    ];
  };
  native.window.Localization = class Localization {
    constructor(resourceIds, isSync) {
      native.calls.push(["Localization", [...resourceIds], isSync]);
    }
    formatMessagesSync() {
      return [{ value: null, attributes: null }];
    }
  };
  const pair = createController(native);
  try {
    pair.controller.toolbarWidgets.snapshot();
    const localizationCall = native.calls.find(
      (entry) => entry[0] === "Localization",
    );
    assert.ok(localizationCall?.[1].includes("browser/firefoxView.ftl"));
    assert.ok(localizationCall?.[1].includes("browser/appmenu.ftl"));
    assert.ok(!localizationCall?.[1].includes("https://evil.example/x.ftl"));
  } finally {
    disposePair(pair);
  }
});

test("missing CustomizableUI degrades to an unavailable optional capability", () => {
  const native = createNativeWindow({ withCustomizableUi: false });
  const pair = createController(native);
  try {
    const snapshot = pair.controller.toolbarWidgets.snapshot();
    assert.equal(snapshot.available, false);
    assert.equal(snapshot.canEdit, false);
    assert.deepEqual(snapshot.zones.top, []);
    assert.deepEqual(snapshot.palette, []);

    const capabilities = pair.controller.assertRequiredCapabilities();
    const customizableUiCapability = capabilities.find(
      (capability) => capability.name === "toolbar-widgets.customizable-ui",
    );
    assert.equal(customizableUiCapability.available, false);
    assert.equal(customizableUiCapability.requirement, "optional");
    const prefsCapability = capabilities.find(
      (capability) => capability.name === "toolbar-widgets.prefs",
    );
    assert.equal(prefsCapability.available, true);
    assert.equal(prefsCapability.requirement, "optional");
    const documentCapability = capabilities.find(
      (capability) => capability.name === "toolbar-widgets.document-events",
    );
    assert.equal(documentCapability.available, true);
    assert.equal(documentCapability.requirement, "required");
  } finally {
    disposePair(pair);
  }
});

test("CustomizableUI events and node mutations publish revised snapshots", () => {
  const native = createNativeWindow();
  const pair = createLegacyNavbarController(native);
  const events = [];
  const unsubscribe = pair.controller.toolbarWidgets.subscribe((event) =>
    events.push(event),
  );
  try {
    assert.equal(native.customizableUiListeners.size, 1);
    const [listener] = native.customizableUiListeners;

    listener.onWidgetRemoved();
    listener.onWidgetMoved();
    native.runTimers();
    assert.equal(events.length, 0);

    native.extensionActionButton.badge = "9";
    const activeObserver = native.observers.findLast(
      (observer) => !observer.disconnected,
    );
    assert.ok(activeObserver);
    activeObserver.trigger();
    native.runTimers();
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "snapshot");
    assert.equal(events[0].revision, 1);
    assert.equal(
      events[0].snapshot.zones.top.find(
        (widget) => widget.kind === "extension-action",
      )?.badgeText,
      "9",
    );

    listener.onCustomizeEnd();
    native.runTimers();
    assert.equal(events.length, 1);

    assert.equal(unsubscribe(), true);
    assert.equal(unsubscribe(), false);
  } finally {
    disposePair(pair);
  }
});

test("extension invoke anchors the widget subview on the project host", async () => {
  const native = createNativeWindow();
  const pair = createLegacyNavbarController(native);
  const host = native.addHost();
  const popupEvents = [];
  pair.controller.toolbarWidgets.subscribePopup((event) =>
    popupEvents.push(event.open),
  );
  const triggerEvent = {
    button: 0,
    stopPropagation() {},
    type: "click",
  };
  try {
    const snapshot = pair.controller.toolbarWidgets.snapshot();
    const extension = snapshot.zones.top.find(
      (widget) => widget.kind === "extension-action",
    );
    assert.equal(
      await pair.controller.toolbarWidgets.invoke(
        extension.handle,
        host,
        triggerEvent,
      ),
      true,
    );
    const showCall = native.calls.find(([name]) => name === "showSubView");
    assert.deepEqual(showCall, [
      "showSubView",
      "PanelUI-webext-widget_example_com-browser-action-view",
      host,
      triggerEvent,
    ]);
    assert.deepEqual(popupEvents, [true]);

    // Activating the same widget while its popup is open toggles it closed.
    assert.equal(
      await pair.controller.toolbarWidgets.invoke(
        extension.handle,
        host,
        triggerEvent,
      ),
      true,
    );
    assert.deepEqual(popupEvents, [true, false]);
    assert.ok(
      native.calls.some(
        ([name, id]) =>
          name === "hidePopup" && id === "customizationui-widget-panel",
      ),
    );
  } finally {
    disposePair(pair);
  }
});

test("delegated account, Library, and All Tabs widgets use their Firefox owners", async () => {
  const native = createNativeWindow({
    extraAreaWidgetIds: [
      "fxa-toolbar-menu-button",
      "library-button",
      "alltabs-button",
    ],
  });
  const pair = createLegacyNavbarController(native);
  const host = native.addHost();
  const triggerEvent = {
    button: 0,
    stopPropagation() {},
    type: "click",
  };
  const originalShowSubView = native.window.PanelUI.showSubView;
  try {
    const snapshot = pair.controller.toolbarWidgets.snapshot();
    const account = snapshot.zones.top.find(
      (widget) => widget.label === "Account",
    );
    const library = snapshot.zones.top.find(
      (widget) => widget.label === "Library",
    );
    const allTabs = snapshot.zones.top.find(
      (widget) => widget.label === "List all tabs",
    );

    host.open = true;
    assert.equal(
      await pair.controller.toolbarWidgets.invoke(
        account.handle,
        host,
        triggerEvent,
      ),
      true,
    );
    assert.equal(host.open, false);
    assert.ok(
      native.calls.some(
        ([name, anchor, event]) =>
          name === "toggleAccountPanel" &&
          anchor === native.accountNode &&
          event === triggerEvent,
      ),
    );
    assert.ok(
      native.calls.some(
        ([name, viewId, anchor, event]) =>
          name === "showSubView" &&
          viewId === "PanelUI-fxa" &&
          anchor === host &&
          event === triggerEvent,
      ),
    );
    assert.equal(native.window.PanelUI.showSubView, originalShowSubView);

    assert.equal(
      await pair.controller.toolbarWidgets.invoke(
        library.handle,
        host,
        triggerEvent,
      ),
      true,
    );
    assert.ok(
      native.calls.some(
        ([name, viewId, anchor, event]) =>
          name === "showSubView" &&
          viewId === "appMenu-libraryView" &&
          anchor === host &&
          event === triggerEvent,
      ),
    );

    assert.equal(
      await pair.controller.toolbarWidgets.invoke(
        allTabs.handle,
        host,
        triggerEvent,
      ),
      true,
    );
    assert.ok(
      native.calls.some(
        ([name, anchor, event, entrypoint]) =>
          name === "showAllTabsPanel" &&
          anchor === host &&
          event === triggerEvent &&
          entrypoint === "alltabs-button",
      ),
    );
    assert.equal(native.window.gTabsPanel.allTabsButton, native.allTabsNode);
  } finally {
    disposePair(pair);
  }
});

test("native menu widgets open their Firefox-owned menupopup on the project host", async () => {
  const native = createNativeWindow({
    extraAreaWidgetIds: ["bookmarks-menu-button"],
  });
  const pair = createLegacyNavbarController(native);
  const host = native.addHost();
  const popupEvents = [];
  const triggerEvent = {
    button: 0,
    stopPropagation() {},
    type: "click",
  };
  pair.controller.toolbarWidgets.subscribePopup((event) =>
    popupEvents.push(event.open),
  );
  try {
    const widget = pair.controller.toolbarWidgets
      .snapshot()
      .zones.top.find((candidate) => candidate.label === "Bookmarks Menu");
    assert.equal(
      await pair.controller.toolbarWidgets.invoke(
        widget.handle,
        host,
        triggerEvent,
      ),
      true,
    );
    const openCall = native.calls.find(([name]) => name === "openPopup");
    assert.equal(openCall[1], "BMB_bookmarksPopup");
    assert.equal(openCall[2], host);
    assert.equal(openCall[3].position, "after_start");
    assert.equal(openCall[3].triggerEvent, triggerEvent);
    assert.deepEqual(popupEvents, [true]);

    assert.equal(
      await pair.controller.toolbarWidgets.invoke(
        widget.handle,
        host,
        triggerEvent,
      ),
      true,
    );
    assert.deepEqual(popupEvents, [true, false]);
  } finally {
    disposePair(pair);
  }
});

test("compound Zoom, Edit, and Profiler widgets expose every native child action", async () => {
  const native = createNativeWindow({
    extraAreaWidgetIds: ["zoom-controls", "edit-controls", "profiler-button"],
  });
  const pair = createLegacyNavbarController(native);
  const host = native.addHost();
  try {
    const snapshot = pair.controller.toolbarWidgets.snapshot();
    const zoom = snapshot.zones.top.find((widget) => widget.label === "Zoom");
    const edit = snapshot.zones.top.find((widget) => widget.label === "Edit");
    const profiler = snapshot.zones.top.find(
      (widget) => widget.label === "Profiler",
    );
    assert.deepEqual(
      zoom.parts.map((part) => part.label),
      ["Zoom out", "100%", "Zoom in"],
    );
    assert.deepEqual(
      zoom.parts.map((part) => part.valueText),
      ["", "100%", ""],
    );
    assert.deepEqual(
      edit.parts.map((part) => part.label),
      ["Cut", "Copy", "Paste"],
    );
    assert.deepEqual(
      profiler.parts.map((part) => part.label),
      ["Profiler", "Open the profiler panel"],
    );
    assert.equal(zoom.parts[0].iconUrl, "chrome://global/skin/icons/minus.svg");
    assert.equal(
      edit.parts[1].iconUrl,
      "chrome://global/skin/icons/edit-copy.svg",
    );

    const zoomPending = pair.controller.toolbarWidgets.invoke(
      zoom.parts[0].handle,
      host,
    );
    native.runTimers();
    assert.equal(await zoomPending, false);
    const zoomResetPending = pair.controller.toolbarWidgets.invoke(
      zoom.parts[1].handle,
      host,
    );
    native.runTimers();
    assert.equal(await zoomResetPending, false);
    const zoomInPending = pair.controller.toolbarWidgets.invoke(
      zoom.parts[2].handle,
      host,
    );
    native.runTimers();
    assert.equal(await zoomInPending, false);
    const editPending = pair.controller.toolbarWidgets.invoke(
      edit.parts[1].handle,
      host,
    );
    native.runTimers();
    assert.equal(await editPending, false);
    assert.ok(
      native.calls.some(
        ([name, id]) => name === "doCommand" && id === "zoom-out-button",
      ),
    );
    assert.ok(
      native.calls.some(
        ([name, id]) => name === "doCommand" && id === "zoom-reset-button",
      ),
    );
    assert.ok(
      native.calls.some(
        ([name, id]) => name === "doCommand" && id === "zoom-in-button",
      ),
    );
    assert.ok(
      native.calls.some(
        ([name, id]) => name === "doCommand" && id === "copy-button",
      ),
    );

    const profilerPending = pair.controller.toolbarWidgets.invoke(
      profiler.parts[0].handle,
      host,
    );
    native.runTimers();
    assert.equal(await profilerPending, false);
    assert.ok(
      native.calls.some(
        ([name, id]) => name === "doCommand" && id === "profiler-button-button",
      ),
    );

    const triggerEvent = {
      button: 0,
      stopPropagation() {},
      type: "click",
    };
    assert.equal(
      await pair.controller.toolbarWidgets.invoke(
        profiler.parts[1].handle,
        host,
        triggerEvent,
      ),
      true,
    );
    assert.ok(
      native.calls.some(
        ([name, viewId, anchor, event]) =>
          name === "showSubView" &&
          viewId === "PanelUI-profiler" &&
          anchor === host &&
          event === triggerEvent,
      ),
    );

    const events = [];
    const unsubscribe = pair.controller.toolbarWidgets.subscribe((event) =>
      events.push(event),
    );
    native.compoundParts.get("zoom-reset-button").setAttribute("label", "110%");
    const activeObserver = native.observers.findLast(
      (observer) => !observer.disconnected,
    );
    assert.ok(activeObserver);
    activeObserver.trigger();
    native.runTimers();
    assert.equal(events.length, 1);
    const updatedZoom = events[0].snapshot.zones.top.find(
      (widget) => widget.label === "Zoom",
    );
    assert.equal(updatedZoom.parts[1].valueText, "110%");
    assert.equal(unsubscribe(), true);
  } finally {
    disposePair(pair);
  }
});

test("built-in invoke re-anchors node panels and settles without one", async () => {
  const native = createNativeWindow();
  const pair = createLegacyNavbarController(native);
  const host = native.addHost();
  try {
    const snapshot = pair.controller.toolbarWidgets.snapshot();
    const history = snapshot.zones.top.find(
      (widget) => widget.label === "History",
    );
    assert.equal(
      await pair.controller.toolbarWidgets.invoke(history.handle, host),
      true,
    );
    assert.ok(
      native.calls.some(
        ([name, id]) => name === "doCommand" && id === "history-panelmenu",
      ),
    );
    const moveCall = native.calls.find(
      ([name, id]) => name === "moveToAnchor" && id === "history-panel",
    );
    assert.equal(moveCall[2], host);

    const sidebar = snapshot.zones.top.find(
      (widget) => widget.label === "Sidebar",
    );
    const pending = pair.controller.toolbarWidgets.invoke(sidebar.handle, host);
    native.runTimers();
    assert.equal(await pending, false);
    assert.ok(
      native.calls.some(
        ([name, id]) => name === "doCommand" && id === "sidebar-button",
      ),
    );
  } finally {
    disposePair(pair);
  }
});

test("invoke rejects stale handles and foreign hosts", async () => {
  const native = createNativeWindow();
  const pair = createLegacyNavbarController(native);
  const host = native.addHost();
  try {
    const snapshot = pair.controller.toolbarWidgets.snapshot();
    const sidebar = snapshot.zones.top.find(
      (widget) => widget.label === "Sidebar",
    );

    await assert.rejects(
      pair.controller.toolbarWidgets.invoke(sidebar.handle, {
        getBoundingClientRect() {},
        ownerDocument: native.window.document,
      }),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HOST_INVALID",
    );

    await assert.rejects(
      pair.controller.toolbarWidgets.invoke("", host),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode ===
          "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HANDLE_INVALID",
    );

    native.sidebarNode.isConnected = false;
    await assert.rejects(
      pair.controller.toolbarWidgets.invoke(sidebar.handle, host),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HANDLE_STALE",
    );
  } finally {
    disposePair(pair);
  }
});

test("dispose detaches listeners, observers, timers, and held panels", async () => {
  const native = createNativeWindow();
  const pair = createLegacyNavbarController(native);
  const host = native.addHost();
  const snapshot = pair.controller.toolbarWidgets.snapshot();
  const extension = snapshot.zones.top.find(
    (widget) => widget.kind === "extension-action",
  );
  assert.equal(
    await pair.controller.toolbarWidgets.invoke(extension.handle, host),
    true,
  );

  assert.equal(pair.controller.dispose(), true);
  assert.equal(pair.controller.dispose(), false);
  assert.equal(pair.controller.snapshot().disposed, true);
  assert.equal(native.customizableUiListeners.size, 0);
  assert.equal(native.prefObservers.size, 0);
  assert.ok(native.calls.some(([name]) => name === "cui-remove-listener"));
  assert.ok(native.calls.some(([name]) => name === "prefs-remove-observer"));
  assert.ok(
    native.calls.some(
      ([name, id]) =>
        name === "hidePopup" && id === "customizationui-widget-panel",
    ),
  );
  assert.ok(
    native.observers.every(
      (observer) => observer.disconnected || observer.observed.length === 0,
    ),
  );
  assert.equal(native.documentEvents.listenerCount("popupshown"), 0);
  assert.equal(native.documentEvents.listenerCount("popuphidden"), 0);

  assert.throws(
    () => pair.controller.toolbarWidgets.snapshot(),
    (error) =>
      isFirefoxBridgeError(error) &&
      error.fenneviaCode === "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_DISPOSED",
  );
  await assert.rejects(
    pair.controller.toolbarWidgets.invoke(extension.handle, host),
    (error) => isFirefoxBridgeError(error),
  );
  pair.boundary.dispose();
});

test("refresh publishes at most one coalesced snapshot per change", () => {
  const native = createNativeWindow();
  const pair = createLegacyNavbarController(native);
  const events = [];
  pair.controller.toolbarWidgets.subscribe((event) => events.push(event));
  try {
    native.sidebarNode.isConnected = false;
    assert.equal(pair.controller.refresh(), true);
    assert.equal(events.length, 1);
    assert.equal(events[0].revision, 1);

    assert.equal(pair.controller.refresh(), true);
    assert.equal(events.length, 1);
  } finally {
    disposePair(pair);
  }
});

test("edit adopts a palette widget into the collapsed nav-bar and persists", async () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    const snapshot = pair.controller.toolbarWidgets.snapshot();
    const printEntry = snapshot.palette.find(
      (entry) => entry.label === "Print",
    );
    assert.ok(printEntry);
    assert.equal(
      await pair.controller.toolbarWidgets.edit({
        index: snapshot.zones.top.length,
        revision: pair.controller.snapshot().revision,
        token: printEntry.token,
        type: "add",
        zone: "top",
      }),
      true,
    );
    assert.ok(
      native.calls.some(
        ([name, id, area]) =>
          name === "cui-add-widget" &&
          id === "print-button" &&
          area === "nav-bar",
      ),
    );
    native.runTimers();
    const next = pair.controller.toolbarWidgets.snapshot();
    assert.equal(next.layoutCustomized, true);
    assert.equal(next.zones.top.at(-1).label, "Print");
    assert.equal(next.zones.top.at(-1).kind, "built-in");
    assert.ok(!next.palette.some((entry) => entry.label === "Print"));

    const persisted = native.getPrefValue("fennevia.customize.layout");
    assert.ok(persisted.includes('"version":2'));
    assert.ok(persisted.includes("print-button"));
    // Raw widget ids stay in the privileged pref, never in the snapshot.
    assert.doesNotMatch(JSON.stringify(next), /print-button/u);
  } finally {
    disposePair(pair);
  }
});

test("edit moves entries between zones and restores adopted extensions", async () => {
  const native = createNativeWindow();
  const pair = createController(native);
  const addonsId = "extension-addons_example_com-browser-action";
  try {
    let snapshot = pair.controller.toolbarWidgets.snapshot();
    const addonsEntry = snapshot.palette.find(
      (entry) => entry.label === "Addons Extension",
    );
    await pair.controller.toolbarWidgets.edit({
      index: 0,
      revision: pair.controller.snapshot().revision,
      token: addonsEntry.token,
      type: "add",
      zone: "left",
    });
    assert.ok(native.getAreaWidgetIds().includes(addonsId));
    native.runTimers();
    snapshot = pair.controller.toolbarWidgets.snapshot();
    assert.equal(snapshot.zones.left.length, 2);
    const placedExtension = snapshot.zones.left.find(
      (widget) => widget.kind === "extension-action",
    );
    assert.equal(placedExtension.label, "Addons Extension");

    await pair.controller.toolbarWidgets.edit({
      fromIndex: 0,
      fromZone: "left",
      revision: pair.controller.snapshot().revision,
      toIndex: 0,
      toZone: "bottom",
      type: "move",
    });
    native.runTimers();
    snapshot = pair.controller.toolbarWidgets.snapshot();
    assert.equal(snapshot.zones.left.length, 1);
    assert.equal(snapshot.zones.left[0].kind, "separator");
    assert.equal(snapshot.zones.bottom.length, 1);

    await pair.controller.toolbarWidgets.edit({
      index: 0,
      revision: pair.controller.snapshot().revision,
      type: "remove",
      zone: "bottom",
    });
    assert.ok(native.getAddonsWidgetIds().includes(addonsId));
    assert.ok(!native.getAreaWidgetIds().includes(addonsId));
    native.runTimers();
    snapshot = pair.controller.toolbarWidgets.snapshot();
    assert.equal(snapshot.zones.bottom.length, 0);
    assert.ok(
      snapshot.palette.some((entry) => entry.label === "Addons Extension"),
    );
  } finally {
    disposePair(pair);
  }
});

test("reset-layout clears the pref and restores adopted placements", async () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    const snapshot = pair.controller.toolbarWidgets.snapshot();
    const printEntry = snapshot.palette.find(
      (entry) => entry.label === "Print",
    );
    await pair.controller.toolbarWidgets.edit({
      index: 0,
      revision: pair.controller.snapshot().revision,
      token: printEntry.token,
      type: "add",
      zone: "right",
    });
    native.runTimers();
    assert.equal(
      pair.controller.toolbarWidgets.snapshot().zones.right.length,
      1,
    );

    await pair.controller.toolbarWidgets.edit({
      revision: pair.controller.snapshot().revision,
      type: "reset-layout",
    });
    assert.ok(
      native.calls.some(
        ([name, id]) => name === "cui-remove-widget" && id === "print-button",
      ),
    );
    assert.equal(native.getPrefValue("fennevia.customize.layout"), undefined);
    native.runTimers();
    const next = pair.controller.toolbarWidgets.snapshot();
    assert.equal(next.layoutCustomized, false);
    assert.equal(next.zones.right.length, 0);
    assert.equal(next.zones.top.length, 1);
    assert.equal(
      next.zones.top.find((widget) => widget.kind === "fennevia")
        ?.fenneviaAction,
      "show-downloads",
    );
    assert.ok(next.layout.top.every((node) => node.type !== "container"));
    assert.ok(next.palette.some((entry) => entry.label === "Print"));
  } finally {
    disposePair(pair);
  }
});

test("clean-layout atomically empties every panel and preserves one Top Customize", async () => {
  const native = createNativeWindow();
  const pair = createController(native);
  const addonsId = "extension-addons_example_com-browser-action";
  try {
    let snapshot = pair.controller.toolbarWidgets.snapshot();
    const addonsEntry = snapshot.palette.find(
      (entry) => entry.label === "Addons Extension",
    );
    assert.ok(addonsEntry);
    await pair.controller.toolbarWidgets.edit({
      index: 0,
      revision: pair.controller.snapshot().revision,
      token: addonsEntry.token,
      type: "add",
      zone: "left",
    });
    native.runTimers();
    await pair.controller.toolbarWidgets.edit({
      allow: true,
      revision: pair.controller.snapshot().revision,
      type: "set-multiple-placements",
    });
    await pair.controller.toolbarWidgets.edit({
      panels: { bottomPanelEnabled: false },
      type: "set-panels",
    });

    await pair.controller.toolbarWidgets.edit({
      revision: pair.controller.snapshot().revision,
      type: "clean-layout",
    });
    assert.ok(native.getAddonsWidgetIds().includes(addonsId));
    assert.ok(!native.getAreaWidgetIds().includes(addonsId));
    native.runTimers();

    snapshot = pair.controller.toolbarWidgets.snapshot();
    const allItems = findLayoutItems(snapshot.layout, () => true);
    assert.deepEqual(
      allItems.map(({ node, path, zone }) => ({
        path,
        projectId: node.projectId,
        zone,
      })),
      [{ path: [0], projectId: "customize-shell", zone: "top" }],
    );
    assert.deepEqual(snapshot.zones.left, []);
    assert.deepEqual(snapshot.zones.right, []);
    assert.deepEqual(snapshot.zones.bottom, []);
    assert.equal(snapshot.allowMultiplePlacements, true);
    assert.equal(snapshot.panels.bottomPanelEnabled, false);
    assert.equal(snapshot.layoutCustomized, true);
    assert.ok(
      snapshot.palette.some((entry) => entry.label === "Addons Extension"),
    );
    assert.deepEqual(
      snapshot.palette
        .filter(
          (entry) =>
            entry.kind === "feature" || entry.kind === "feature-companion",
        )
        .map((entry) => ({
          featureGroup: entry.featureGroup,
          kind: entry.kind,
          label: entry.label,
        })),
      [
        {
          featureGroup: "address",
          kind: "feature",
          label: "Address launcher",
        },
        {
          featureGroup: "address",
          kind: "feature-companion",
          label: "Site trust",
        },
        { featureGroup: "tabs", kind: "feature", label: "Tabs" },
        {
          featureGroup: "tabs",
          kind: "feature-companion",
          label: "New tab",
        },
        { featureGroup: "bookmarks", kind: "feature", label: "Bookmarks" },
        {
          featureGroup: "bookmarks",
          kind: "feature-companion",
          label: "Show bookmarks panel",
        },
        {
          featureGroup: "downloads",
          kind: "feature",
          label: "Download status",
        },
        {
          featureGroup: "downloads",
          kind: "feature-companion",
          label: "Open Firefox downloads",
        },
      ],
    );
    const persisted = native.getPrefValue("fennevia.customize.layout");
    assert.match(persisted, /"allowMultiplePlacements":true/u);
    assert.doesNotMatch(persisted, new RegExp(addonsId, "u"));
  } finally {
    disposePair(pair);
  }
});

test("style edits persist and external pref changes republish", async () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    await pair.controller.toolbarWidgets.edit({
      style: {
        accent: "#3b82f6",
        autoHideDelay: 640,
        chromeBackground: "#141A23",
        edgeTriggerSize: 20,
        shortcutHintDuration: 0,
        temporaryRevealDuration: 2_400,
        theme: "dark",
        windowLeaveHideDelay: 1_600,
      },
      type: "set-style",
    });
    let snapshot = pair.controller.toolbarWidgets.snapshot();
    assert.equal(snapshot.style.accent, "#3b82f6");
    assert.equal(snapshot.style.autoHideDelay, 640);
    assert.equal(snapshot.style.chromeBackground, "#141a23");
    assert.equal(snapshot.style.edgeTriggerSize, 20);
    assert.equal(snapshot.style.shortcutHintDuration, 0);
    assert.equal(snapshot.style.temporaryRevealDuration, 2_400);
    assert.equal(snapshot.style.theme, "dark");
    assert.equal(snapshot.style.windowLeaveHideDelay, 1_600);
    assert.equal(snapshot.style.blur, 18);
    assert.ok(
      native.getPrefValue("fennevia.customize.style").includes('"version":1'),
    );

    // A second window writes the shared pref; the observer republishes here.
    native.setPrefValue(
      "fennevia.customize.style",
      JSON.stringify({
        accent: "",
        autoHideDelay: 900,
        blur: 28,
        density: "compact",
        edgeTriggerSize: 16,
        fontSize: 13,
        radius: 8,
        shortcutHintDuration: 1_500,
        surfaceOpacity: 85,
        temporaryRevealDuration: 3_000,
        theme: "light",
        version: 1,
        windowLeaveHideDelay: 2_000,
      }),
    );
    native.runTimers();
    snapshot = pair.controller.toolbarWidgets.snapshot();
    assert.equal(snapshot.style.autoHideDelay, 900);
    assert.equal(snapshot.style.blur, 28);
    assert.equal(snapshot.style.density, "compact");
    assert.equal(snapshot.style.edgeTriggerSize, 16);
    assert.equal(snapshot.style.chromeBackground, "");
    assert.equal(snapshot.style.saturation, 145);
    assert.equal(snapshot.style.shortcutHintDuration, 1_500);
    assert.equal(snapshot.style.temporaryRevealDuration, 3_000);
    assert.equal(snapshot.style.windowLeaveHideDelay, 2_000);

    // Invalid persisted style falls back to the defaults.
    native.setPrefValue("fennevia.customize.style", "{not json");
    native.runTimers();
    snapshot = pair.controller.toolbarWidgets.snapshot();
    assert.equal(snapshot.style.blur, 18);
    assert.equal(snapshot.style.theme, "auto");

    await pair.controller.toolbarWidgets.edit({ type: "reset-style" });
    assert.equal(native.getPrefValue("fennevia.customize.style"), undefined);

    await assert.rejects(
      pair.controller.toolbarWidgets.edit({
        style: { accent: "not-a-color" },
        type: "set-style",
      }),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_INVALID",
    );
  } finally {
    disposePair(pair);
  }
});

test("panel and progress-light edits persist, observe, and reset", async () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    let snapshot = pair.controller.toolbarWidgets.snapshot();
    assert.equal(snapshot.panelsCustomized, false);
    assert.deepEqual(snapshot.panels, {
      allowCompactWindow: false,
      bottomPanelEnabled: true,
      bottomProgressLight: "downloads",
      leftPanelEnabled: true,
      panelDodgeMode: "multiple-dynamic",
      rightPanelEnabled: true,
      sidePanelLayout: "tabs-left",
      topProgressLight: "loading",
    });

    await pair.controller.toolbarWidgets.edit({
      panels: {
        bottomPanelEnabled: false,
        panelDodgeMode: "single-reserved",
        rightPanelEnabled: false,
        topProgressLight: "downloads",
      },
      type: "set-panels",
    });
    snapshot = pair.controller.toolbarWidgets.snapshot();
    assert.equal(snapshot.panelsCustomized, true);
    assert.equal(snapshot.panels.bottomPanelEnabled, false);
    assert.equal(snapshot.panels.panelDodgeMode, "single-reserved");
    assert.equal(snapshot.panels.rightPanelEnabled, false);
    assert.equal(snapshot.panels.topProgressLight, "downloads");
    assert.ok(
      native.getPrefValue("fennevia.customize.panels").includes('"version":3'),
    );

    native.setPrefValue(
      "fennevia.customize.panels",
      JSON.stringify({
        bottomDownloadsEnabled: true,
        bottomProgressLight: "off",
        sidePanelLayout: "tabs-left",
        topProgressLight: "off",
        version: 1,
      }),
    );
    native.runTimers();
    snapshot = pair.controller.toolbarWidgets.snapshot();
    assert.equal(snapshot.panels.bottomPanelEnabled, true);
    assert.equal(snapshot.panels.bottomProgressLight, "off");
    assert.equal(snapshot.panels.leftPanelEnabled, true);
    assert.equal(snapshot.panels.panelDodgeMode, "multiple-dynamic");
    assert.equal(snapshot.panels.rightPanelEnabled, true);
    assert.equal(snapshot.panels.topProgressLight, "off");

    await pair.controller.toolbarWidgets.edit({ type: "reset-panels" });
    snapshot = pair.controller.toolbarWidgets.snapshot();
    assert.equal(snapshot.panelsCustomized, false);
    assert.equal(snapshot.panels.sidePanelLayout, "tabs-left");
    assert.equal(native.getPrefValue("fennevia.customize.panels"), undefined);
  } finally {
    disposePair(pair);
  }
});

test("project widgets place into any zone and edits require fresh revisions", async () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    const snapshot = pair.controller.toolbarWidgets.snapshot();
    const bookmarksWidget = snapshot.palette.find(
      (entry) =>
        entry.kind === "project" && entry.label === "Show bookmarks panel",
    );
    const translateWidget = snapshot.palette.find(
      (entry) =>
        entry.kind === "project" && entry.label === "Translate this page",
    );
    assert.ok(bookmarksWidget);
    assert.ok(translateWidget);
    assert.equal(translateWidget.icon, "translate");
    await pair.controller.toolbarWidgets.edit({
      index: 0,
      revision: pair.controller.snapshot().revision,
      token: bookmarksWidget.token,
      type: "add",
      zone: "right",
    });
    native.runTimers();
    const next = pair.controller.toolbarWidgets.snapshot();
    assert.equal(next.zones.right[0].kind, "fennevia");
    assert.equal(next.zones.right[0].fenneviaAction, "show-bookmarks");
    assert.equal(next.zones.right[0].handle, "");
    assert.ok(
      !next.palette.some((entry) => entry.label === "Show bookmarks panel"),
    );

    await assert.rejects(
      pair.controller.toolbarWidgets.edit({
        index: 0,
        revision: 999,
        type: "remove",
        zone: "right",
      }),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_STALE",
    );
    await assert.rejects(
      pair.controller.toolbarWidgets.edit({
        index: 0,
        revision: pair.controller.snapshot().revision,
        token: "palette-99999",
        type: "add",
        zone: "top",
      }),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_INVALID",
    );
  } finally {
    disposePair(pair);
  }
});

test("per-instance project widget styles persist through revision-guarded edits", async () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    let snapshot = pair.controller.toolbarWidgets.snapshot();
    const address = findLayoutItems(
      snapshot.layout,
      (node) => node.projectId === "address-launcher",
    )[0];
    const tabs = findLayoutItems(
      snapshot.layout,
      (node) => node.projectId === "tabs",
    )[0];
    const back = findLayoutItems(
      snapshot.layout,
      (node) => node.projectId === "back",
    )[0];
    assert.ok(address);
    assert.ok(tabs);
    assert.ok(back);
    assert.equal(address.node.style, "with-site-status");
    assert.equal(tabs.node.style, "with-new-tab");

    await pair.controller.toolbarWidgets.edit({
      location: { path: address.path, zone: address.zone },
      revision: pair.controller.snapshot().revision,
      style: "address-only",
      type: "set-node-style",
    });
    native.runTimers();
    snapshot = pair.controller.toolbarWidgets.snapshot();
    assert.equal(
      findLayoutItems(
        snapshot.layout,
        (node) => node.projectId === "address-launcher",
      )[0].node.style,
      "address-only",
    );

    await pair.controller.toolbarWidgets.edit({
      location: { path: tabs.path, zone: tabs.zone },
      revision: pair.controller.snapshot().revision,
      style: "tabs-only",
      type: "set-node-style",
    });
    native.runTimers();
    snapshot = pair.controller.toolbarWidgets.snapshot();
    assert.equal(
      findLayoutItems(snapshot.layout, (node) => node.projectId === "tabs")[0]
        .node.style,
      "tabs-only",
    );
    let persisted = JSON.parse(
      native.getPrefValue("fennevia.customize.layout"),
    );
    assert.equal(
      "style" in persisted.zones.left[0].children[0].children[0],
      false,
    );
    assert.equal("style" in persisted.zones.left[1].children[0], false);

    await pair.controller.toolbarWidgets.edit({
      location: { path: address.path, zone: address.zone },
      revision: pair.controller.snapshot().revision,
      style: "with-site-status",
      type: "set-node-style",
    });
    native.runTimers();
    await pair.controller.toolbarWidgets.edit({
      location: { path: tabs.path, zone: tabs.zone },
      revision: pair.controller.snapshot().revision,
      style: "with-new-tab",
      type: "set-node-style",
    });
    native.runTimers();
    persisted = JSON.parse(native.getPrefValue("fennevia.customize.layout"));
    assert.equal(
      persisted.zones.left[0].children[0].children[0].style,
      "with-site-status",
    );
    assert.equal(persisted.zones.left[1].children[0].style, "with-new-tab");

    await assert.rejects(
      pair.controller.toolbarWidgets.edit({
        location: { path: back.path, zone: back.zone },
        revision: pair.controller.snapshot().revision,
        style: "with-site-status",
        type: "set-node-style",
      }),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_INVALID",
    );
    await assert.rejects(
      pair.controller.toolbarWidgets.edit({
        location: { path: tabs.path, zone: tabs.zone },
        revision: 0,
        style: "tabs-only",
        type: "set-node-style",
      }),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_STALE",
    );

    await pair.controller.toolbarWidgets.edit({
      location: { path: address.path, zone: address.zone },
      revision: pair.controller.snapshot().revision,
      style: "address-only",
      type: "set-node-style",
    });
    native.runTimers();
    const resetPersisted = JSON.parse(
      native.getPrefValue("fennevia.customize.layout"),
    );
    assert.equal(
      "style" in resetPersisted.zones.left[0].children[0].children[0],
      false,
    );
  } finally {
    disposePair(pair);
  }
});

test("container padding persists through one revision-guarded closed edit", async () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    await pair.controller.toolbarWidgets.edit({
      direction: "row",
      index: 0,
      parentPath: [],
      revision: pair.controller.snapshot().revision,
      type: "add-container",
      zone: "top",
    });
    native.runTimers();
    let snapshot = pair.controller.toolbarWidgets.snapshot();
    assert.equal(snapshot.layout.top[0].type, "container");
    assert.equal(snapshot.layout.top[0].padding, "none");

    await pair.controller.toolbarWidgets.edit({
      location: { path: [0], zone: "top" },
      padding: "standard",
      revision: pair.controller.snapshot().revision,
      type: "set-container-padding",
    });
    native.runTimers();
    snapshot = pair.controller.toolbarWidgets.snapshot();
    assert.equal(snapshot.layout.top[0].padding, "standard");
    let persisted = JSON.parse(
      native.getPrefValue("fennevia.customize.layout"),
    );
    assert.equal(persisted.zones.top[0].padding, "standard");

    await pair.controller.toolbarWidgets.edit({
      location: { path: [0], zone: "top" },
      padding: "none",
      revision: pair.controller.snapshot().revision,
      type: "set-container-padding",
    });
    native.runTimers();
    persisted = JSON.parse(native.getPrefValue("fennevia.customize.layout"));
    assert.equal("padding" in persisted.zones.top[0], false);
    assert.equal(
      pair.controller.toolbarWidgets.snapshot().layout.top[0].padding,
      "none",
    );

    await assert.rejects(
      pair.controller.toolbarWidgets.edit({
        location: { path: [1], zone: "top" },
        padding: "standard",
        revision: pair.controller.snapshot().revision,
        type: "set-container-padding",
      }),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_INVALID",
    );
  } finally {
    disposePair(pair);
  }
});

test("repeatable structure stays available and duplicate-safe window controls are opt-in", async () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    let snapshot = pair.controller.toolbarWidgets.snapshot();
    const initialSeparatorCount = findLayoutItems(
      snapshot.layout,
      (node) => node.widget.kind === "separator",
    ).length;
    assert.equal(snapshot.allowMultiplePlacements, false);
    for (const label of [
      "Row",
      "Column",
      "Center",
      "Expanded",
      "Padding",
      "Separator",
      "Space",
      "Flexible space",
    ]) {
      assert.ok(
        snapshot.palette.some((entry) => entry.label === label),
        label,
      );
    }

    for (let count = 0; count < 2; count += 1) {
      const center = snapshot.palette.find(
        (entry) => entry.kind === "wrapper" && entry.label === "Center",
      );
      assert.ok(center);
      await pair.controller.toolbarWidgets.edit({
        index: snapshot.layout.top.length,
        parentPath: [],
        revision: pair.controller.snapshot().revision,
        token: center.token,
        type: "add-node",
        zone: "top",
      });
      native.runTimers();
      snapshot = pair.controller.toolbarWidgets.snapshot();
    }
    assert.equal(
      snapshot.layout.top.filter(
        (node) => node.type === "wrapper" && node.kind === "center",
      ).length,
      2,
    );
    assert.ok(
      snapshot.palette.some(
        (entry) => entry.kind === "wrapper" && entry.label === "Center",
      ),
    );

    for (let count = 0; count < 2; count += 1) {
      const separator = snapshot.palette.find(
        (entry) => entry.label === "Separator",
      );
      assert.ok(separator);
      await pair.controller.toolbarWidgets.edit({
        index: snapshot.layout.top.length,
        parentPath: [],
        revision: pair.controller.snapshot().revision,
        token: separator.token,
        type: "add-node",
        zone: "top",
      });
      native.runTimers();
      snapshot = pair.controller.toolbarWidgets.snapshot();
    }
    assert.equal(
      findLayoutItems(
        snapshot.layout,
        (node) => node.widget.kind === "separator",
      ).length,
      initialSeparatorCount + 2,
    );
    assert.ok(snapshot.palette.some((entry) => entry.label === "Separator"));

    await pair.controller.toolbarWidgets.edit({
      allow: true,
      revision: pair.controller.snapshot().revision,
      type: "set-multiple-placements",
    });
    native.runTimers();
    snapshot = pair.controller.toolbarWidgets.snapshot();
    assert.equal(snapshot.allowMultiplePlacements, true);
    const minimize = snapshot.palette.find(
      (entry) => entry.kind === "project" && entry.label === "Minimize window",
    );
    assert.ok(minimize);
    await pair.controller.toolbarWidgets.edit({
      index: snapshot.layout.left.length,
      parentPath: [],
      revision: pair.controller.snapshot().revision,
      token: minimize.token,
      type: "add-node",
      zone: "left",
    });
    native.runTimers();
    snapshot = pair.controller.toolbarWidgets.snapshot();
    assert.equal(
      findLayoutItems(
        snapshot.layout,
        (node) => node.projectId === "minimize-window",
      ).length,
      2,
    );
    assert.ok(
      findLayoutItems(
        snapshot.layout,
        (node) => node.projectId === "minimize-window",
      ).some((location) => location.zone === "left"),
    );
  } finally {
    disposePair(pair);
  }
});

test("Customize remains reachable while download status moves independently of Bottom", async () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    let snapshot = pair.controller.toolbarWidgets.snapshot();
    const download = findLayoutItems(
      snapshot.layout,
      (node) => node.projectId === "downloads-status",
    )[0];
    assert.ok(download);
    assert.equal(download.zone, "bottom");
    await pair.controller.toolbarWidgets.edit({
      from: { path: download.path, zone: download.zone },
      revision: pair.controller.snapshot().revision,
      to: {
        index: snapshot.layout.top.length,
        parentPath: [],
        zone: "top",
      },
      type: "move-node",
    });
    native.runTimers();
    snapshot = pair.controller.toolbarWidgets.snapshot();
    assert.equal(
      findLayoutItems(
        snapshot.layout,
        (node) => node.projectId === "downloads-status",
      )[0]?.zone,
      "top",
    );
    await pair.controller.toolbarWidgets.edit({
      panels: { bottomPanelEnabled: false },
      type: "set-panels",
    });
    snapshot = pair.controller.toolbarWidgets.snapshot();
    assert.equal(snapshot.panels.bottomPanelEnabled, false);
    assert.equal(
      findLayoutItems(
        snapshot.layout,
        (node) => node.projectId === "downloads-status",
      )[0]?.zone,
      "top",
    );

    const customize = findLayoutItems(
      snapshot.layout,
      (node) => node.projectId === "customize-shell",
    )[0];
    assert.ok(customize);
    await pair.controller.toolbarWidgets.edit({
      from: { path: customize.path, zone: customize.zone },
      revision: pair.controller.snapshot().revision,
      to: {
        index: snapshot.layout.right.length,
        parentPath: [],
        zone: "right",
      },
      type: "move-node",
    });
    native.runTimers();
    snapshot = pair.controller.toolbarWidgets.snapshot();
    const movedCustomize = findLayoutItems(
      snapshot.layout,
      (node) => node.projectId === "customize-shell",
    )[0];
    assert.equal(movedCustomize.zone, "right");

    await assert.rejects(
      pair.controller.toolbarWidgets.edit({
        location: { path: movedCustomize.path, zone: movedCustomize.zone },
        revision: pair.controller.snapshot().revision,
        type: "remove-node",
      }),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_INVALID",
    );
    await assert.rejects(
      pair.controller.toolbarWidgets.edit({
        panels: { rightPanelEnabled: false },
        type: "set-panels",
      }),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_INVALID",
    );
  } finally {
    disposePair(pair);
  }
});

test("missing prefs disable editing while zones stay available", async () => {
  const native = createNativeWindow({ withPrefs: false });
  const pair = createController(native);
  try {
    const snapshot = pair.controller.toolbarWidgets.snapshot();
    assert.equal(snapshot.available, true);
    assert.equal(snapshot.canEdit, false);
    assert.equal(snapshot.zones.top.length, 1);
    await assert.rejects(
      pair.controller.toolbarWidgets.edit({
        style: { theme: "dark" },
        type: "set-style",
      }),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode ===
          "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_UNAVAILABLE",
    );
  } finally {
    disposePair(pair);
  }
});

test("private windows exclude non-private extensions from the palette", () => {
  const native = createNativeWindow();
  const pair = createController(native, "private");
  try {
    const snapshot = pair.controller.toolbarWidgets.snapshot();
    assert.ok(
      !snapshot.palette.some((entry) => entry.label === "Addons Extension"),
    );
    assert.ok(snapshot.palette.some((entry) => entry.label === "Print"));
  } finally {
    disposePair(pair);
  }
});

test("persisted layouts restore for later controllers with missing entries", async () => {
  const native = createNativeWindow();
  const first = createController(native);
  const firstSnapshot = first.controller.toolbarWidgets.snapshot();
  const printEntry = firstSnapshot.palette.find(
    (entry) => entry.label === "Print",
  );
  await first.controller.toolbarWidgets.edit({
    index: 0,
    revision: first.controller.snapshot().revision,
    token: printEntry.token,
    type: "add",
    zone: "bottom",
  });
  disposePair(first);

  const second = createController(native);
  try {
    const snapshot = second.controller.toolbarWidgets.snapshot();
    assert.equal(snapshot.layoutCustomized, true);
    assert.equal(snapshot.zones.bottom.length, 1);
    assert.equal(snapshot.zones.bottom[0].missing, false);
    assert.equal(snapshot.zones.bottom[0].label, "Print");

    // Simulate the widget disappearing while the layout still lists it.
    native.targets.delete("print-button");
    native.removeAreaWidget("print-button");
    assert.equal(second.controller.refresh(), true);
    const next = second.controller.toolbarWidgets.snapshot();
    assert.equal(next.zones.bottom[0].missing, true);
    assert.equal(next.zones.bottom[0].handle, "");
    assert.equal(next.zones.bottom[0].disabled, true);
  } finally {
    disposePair(second);
  }
});
