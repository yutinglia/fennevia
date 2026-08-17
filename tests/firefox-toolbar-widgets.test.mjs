import assert from "node:assert/strict";
import test from "node:test";

import {
  createFirefoxBridgeBoundary,
  isFirefoxBridgeError,
} from "../src/firefox/bridge-boundary.ts";
import { createFirefoxToolbarWidgetsBridge } from "../src/firefox/toolbar-widgets.ts";

const BROWSER_URI = "chrome://browser/content/browser.xhtml";
const EXTENSION_ICON_URL =
  "moz-extension://11111111-2222-3333-4444-555555555555/icon-32.png";
let nextContextSequence = 0;

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

function createNativeWindow({ withCustomizableUi = true } = {}) {
  const calls = [];
  const targets = new Map();
  const frameHosts = new Set();
  const observers = [];
  const timers = new Map();
  let nextTimerId = 1;
  const documentEvents = createEventTarget();

  const document = {
    ...documentEvents,
    defaultView: null,
    documentURI: BROWSER_URI,
    getElementById(id) {
      return targets.get(id) ?? null;
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

  let areaWidgetIds = [
    "back-button",
    "urlbar-container",
    "customizableui-special-spring3",
    "sidebar-button",
    "extension-widget_example_com-browser-action",
    "customizableui-special-spacer7",
    "history-panelmenu",
  ];

  const wrappers = new Map([
    [
      "extension-widget_example_com-browser-action",
      {
        label: "Test Extension",
        tooltiptext: "Test Extension tooltip",
        viewId: "PanelUI-webext-widget_example_com-browser-action-view",
        webExtension: true,
      },
    ],
    ["sidebar-button", { label: "Sidebar wrapper" }],
    ["history-panelmenu", { label: "History" }],
  ]);

  const customizableUiListeners = new Set();
  const customizableUi = {
    addListener(listener) {
      calls.push(["cui-add-listener"]);
      customizableUiListeners.add(listener);
    },
    getWidget(id) {
      return wrappers.get(id) ?? null;
    },
    getWidgetIdsInArea(area) {
      calls.push(["cui-get-widget-ids", area]);
      return [...areaWidgetIds];
    },
    removeListener(listener) {
      calls.push(["cui-remove-listener"]);
      customizableUiListeners.delete(listener);
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
      showSubView(viewId, anchor) {
        calls.push(["showSubView", viewId, anchor]);
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
    setTimeout(callback) {
      const id = nextTimerId++;
      timers.set(id, callback);
      return id;
    },
  };
  if (withCustomizableUi) {
    window.CustomizableUI = customizableUi;
  }
  window.document.defaultView = window;

  return {
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
    customizableUiListeners,
    documentEvents,
    extensionActionButton,
    extensionNode,
    frame,
    historyNode,
    observers,
    pendingTimerCount() {
      return timers.size;
    },
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
    sidebarNode,
    targets,
    window,
  };
}

function createController(native) {
  const contextId = `window-toolbar-widgets-${String(
    ++nextContextSequence,
  ).padStart(12, "0")}`;
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260810162159",
    contextId,
    firefoxVersion: "153.0.4",
    window: native.window,
    windowKind: "normal",
  });
  const controller = createFirefoxToolbarWidgetsBridge({
    boundary,
    frame: native.frame,
    window: native.window,
  });
  return { boundary, controller };
}

function disposePair(pair) {
  pair.controller.dispose();
  pair.boundary.dispose();
}

test("snapshot mirrors nav-bar placements with opaque handles", () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    const snapshot = pair.controller.toolbarWidgets.snapshot();
    assert.equal(snapshot.available, true);
    assert.deepEqual(
      snapshot.widgets.map((widget) => widget.kind),
      ["spring", "built-in", "extension-action", "spacer", "built-in"],
    );

    const [spring, sidebar, extension, spacer, history] = snapshot.widgets;
    assert.equal(spring.handle, "");
    assert.equal(spacer.handle, "");

    assert.equal(sidebar.label, "Sidebar");
    assert.equal(sidebar.icon, "sidebar");
    assert.equal(sidebar.tooltip, "Show sidebars");
    assert.equal(sidebar.iconUrl, "");
    assert.match(sidebar.handle, /^toolbar-widget-registry-\d+-handle-\d+$/u);

    assert.equal(extension.label, "Test Extension");
    assert.equal(extension.tooltip, "Test Extension tooltip");
    assert.equal(extension.icon, "extension");
    assert.equal(extension.iconUrl, EXTENSION_ICON_URL);
    assert.equal(extension.badgeText, "3");
    assert.equal(extension.badgeBackground, "rgb(217, 0, 0)");
    assert.equal(extension.badgeTextColor, "rgb(255, 255, 255)");
    assert.equal(extension.disabled, false);

    assert.equal(history.icon, "history");
    assert.equal(history.label, "History");

    const serialized = JSON.stringify(snapshot);
    assert.doesNotMatch(
      serialized,
      /sidebar-button|history-panelmenu|widget_example_com|back-button|urlbar-container/u,
    );
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
    assert.deepEqual(snapshot.widgets, []);

    const capabilities = pair.controller.assertRequiredCapabilities();
    const customizableUiCapability = capabilities.find(
      (capability) => capability.name === "toolbar-widgets.customizable-ui",
    );
    assert.equal(customizableUiCapability.available, false);
    assert.equal(customizableUiCapability.requirement, "optional");
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
  const pair = createController(native);
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

    native.removeAreaWidget("extension-widget_example_com-browser-action");
    listener.onWidgetRemoved();
    native.runTimers();
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "snapshot");
    assert.equal(events[0].revision, 1);
    assert.equal(events[0].snapshot.widgets.length, 4);
    assert.ok(
      events[0].snapshot.widgets.every(
        (widget) => widget.kind !== "extension-action",
      ),
    );

    native.extensionActionButton.badge = "9";
    const activeObserver = native.observers.findLast(
      (observer) => !observer.disconnected,
    );
    assert.ok(activeObserver);
    activeObserver.trigger();
    native.runTimers();
    assert.equal(events.length, 1);

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
  const pair = createController(native);
  const host = native.addHost();
  const popupEvents = [];
  pair.controller.toolbarWidgets.subscribePopup((event) =>
    popupEvents.push(event.open),
  );
  try {
    const snapshot = pair.controller.toolbarWidgets.snapshot();
    const extension = snapshot.widgets.find(
      (widget) => widget.kind === "extension-action",
    );
    assert.equal(
      await pair.controller.toolbarWidgets.invoke(extension.handle, host),
      true,
    );
    const showCall = native.calls.find(([name]) => name === "showSubView");
    assert.deepEqual(showCall, [
      "showSubView",
      "PanelUI-webext-widget_example_com-browser-action-view",
      host,
    ]);
    assert.deepEqual(popupEvents, [true]);

    // Activating the same widget while its popup is open toggles it closed.
    assert.equal(
      await pair.controller.toolbarWidgets.invoke(extension.handle, host),
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

test("built-in invoke re-anchors node panels and settles without one", async () => {
  const native = createNativeWindow();
  const pair = createController(native);
  const host = native.addHost();
  try {
    const snapshot = pair.controller.toolbarWidgets.snapshot();
    const history = snapshot.widgets.find(
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

    const sidebar = snapshot.widgets.find(
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
  const pair = createController(native);
  const host = native.addHost();
  try {
    const snapshot = pair.controller.toolbarWidgets.snapshot();
    const sidebar = snapshot.widgets.find(
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
  const pair = createController(native);
  const host = native.addHost();
  const snapshot = pair.controller.toolbarWidgets.snapshot();
  const extension = snapshot.widgets.find(
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
  assert.ok(native.calls.some(([name]) => name === "cui-remove-listener"));
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
  const pair = createController(native);
  const events = [];
  pair.controller.toolbarWidgets.subscribe((event) => events.push(event));
  try {
    native.removeAreaWidget("sidebar-button");
    assert.equal(pair.controller.refresh(), true);
    assert.equal(events.length, 1);
    assert.equal(events[0].revision, 1);

    assert.equal(pair.controller.refresh(), true);
    assert.equal(events.length, 1);
  } finally {
    disposePair(pair);
  }
});
