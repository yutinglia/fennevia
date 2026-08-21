import assert from "node:assert/strict";
import test from "node:test";

import {
  createFirefoxBridgeBoundary,
  isFirefoxBridgeError,
} from "../src/firefox/bridge-boundary.ts";
import { createFirefoxBrowserToolsBridge } from "../src/firefox/browser-tools.ts";

const BROWSER_URI = "chrome://browser/content/browser.xhtml";
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
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
  };
}

function createNativeWindow() {
  const calls = [];
  const targets = new Map();
  const frameHosts = new Set();
  const documentEvents = createEventTarget();

  function addTarget(id, { visible = true } = {}) {
    const target = {
      checkVisibility() {
        calls.push(["check-visibility", id]);
        return visible;
      },
      click() {
        calls.push(["click", id]);
      },
      focus(options) {
        calls.push(["focus", id, options]);
      },
      id,
      setVisible(nextVisible) {
        visible = nextVisible;
      },
    };
    targets.set(id, target);
    return target;
  }

  function addPanel(id) {
    const panel = {
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
      openPopup(anchor, position) {
        calls.push(["openPopup", id, anchor, position]);
        this.anchorNode = anchor;
        this.state = "open";
        documentEvents.dispatch("popupshown", panel);
      },
      querySelector(selector) {
        if (id === "appMenu-popup" && selector === "panelmultiview") {
          return { id: "appMenu-multiView" };
        }
        return null;
      },
      state: "closed",
    };
    targets.set(id, panel);
    return panel;
  }

  for (const id of [
    "trust-icon-container",
    "identity-icon-box",
    "tracking-protection-icon-container",
    "identity-permission-box",
    "downloads-button",
    "unified-extensions-button",
    "translations-button",
    "PanelUI-menu-button",
    "back-button",
  ]) {
    addTarget(id);
  }

  for (const id of [
    "appMenu-popup",
    "downloadsPanel",
    "identity-popup",
    "permission-popup",
    "protections-popup",
    "trustpanel-popup",
    "unified-extensions-panel",
    "full-page-translations-panel",
  ]) {
    addPanel(id);
  }

  const tabContainer = createEventTarget();
  const selectedBrowser = { webNavigation: {} };
  const document = {
    ...documentEvents,
    defaultView: null,
    documentURI: BROWSER_URI,
    getElementById(id) {
      return targets.get(id) ?? null;
    },
  };
  const frame = {
    hosts: frameHosts,
    contains(node) {
      return this.hosts.has(node);
    },
  };
  const window = {
    DownloadsPanel: {
      initialize() {
        calls.push([
          "method",
          "DownloadsPanel.initialize",
          this === window.DownloadsPanel,
        ]);
      },
      get panel() {
        return targets.get("downloadsPanel");
      },
    },
    PanelUI: {
      async ensureReady() {
        calls.push(["method", "PanelUI.ensureReady", this === window.PanelUI]);
      },
      async show() {
        calls.push(["method", "PanelUI.show", this === window.PanelUI]);
      },
    },
    FullPageTranslationsPanel: {
      async open(event) {
        calls.push([
          "method",
          "FullPageTranslationsPanel.open",
          this === window.FullPageTranslationsPanel,
          event,
        ]);
        event.stopPropagation();
        targets
          .get("full-page-translations-panel")
          .openPopup(targets.get("translations-button"), "after_end");
      },
    },
    document,
    gBrowser: {
      selectedBrowser,
      tabContainer,
      tabs: [],
    },
    gCustomizeMode: {
      async enter() {
        calls.push([
          "method",
          "gCustomizeMode.enter",
          this === window.gCustomizeMode,
        ]);
      },
    },
    gPermissionPanel: {
      async openPopup() {
        calls.push([
          "method",
          "gPermissionPanel.openPopup",
          this === window.gPermissionPanel,
        ]);
        const panel = targets.get("permission-popup");
        panel.openPopup(this._anchor, this._position);
      },
      setAnchor(node, position) {
        calls.push(["setAnchor", node, position]);
        this._anchor = node;
        this._position = position;
      },
    },
    gTrustPanelHandler: {
      async showPopup() {
        calls.push([
          "method",
          "gTrustPanelHandler.showPopup",
          this === window.gTrustPanelHandler,
        ]);
        targets
          .get("trustpanel-popup")
          .openPopup(undefined, "bottomleft topleft");
      },
    },
    gUnifiedExtensions: {
      async togglePanel() {
        calls.push([
          "method",
          "gUnifiedExtensions.togglePanel",
          this === window.gUnifiedExtensions,
        ]);
        const panel = targets.get("unified-extensions-panel");
        panel.openPopup(targets.get("unified-extensions-button"), "after_end");
      },
    },
    async openPreferences() {
      calls.push(["method", "openPreferences", this === window]);
    },
  };
  window.document.defaultView = window;

  return {
    addHost(options = {}) {
      const host = {
        getBoundingClientRect() {
          return {
            bottom: 56,
            height: 32,
            left: 12,
            right: 44,
            top: 24,
            width: 32,
            x: 12,
            y: 24,
          };
        },
        ownerDocument: document,
      };
      if (options.surface === "address-popup") {
        host.closest = (selector) =>
          selector === "[data-fennevia-address-popup]" ? host : null;
      } else if (options.surface === "left") {
        host.closest = (selector) =>
          selector === '[data-fennevia-edge="left"]' ? host : null;
      }
      frameHosts.add(host);
      return host;
    },
    addPanel,
    addTarget,
    calls,
    frame,
    setTrustVisible(value) {
      targets.get("trust-icon-container").setVisible(value);
    },
    targets,
    window,
  };
}

function createController(native, reveal = () => true) {
  const contextId = `window-browser-tools-${String(
    ++nextContextSequence,
  ).padStart(12, "0")}`;
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260810162159",
    contextId,
    firefoxVersion: "153.0.4",
    window: native.window,
    windowKind: "normal",
  });
  const controller = createFirefoxBrowserToolsBridge({
    beginNativePopupHandoff(panelId) {
      native.calls.push(["handoff-begin", panelId]);
      return true;
    },
    boundary,
    endNativePopupHandoff(panelId) {
      native.calls.push(["handoff-end", panelId]);
    },
    frame: native.frame,
    requestNativeUiReveal: reveal,
    window: native.window,
  });
  return { boundary, controller };
}

function disposePair(pair) {
  pair.controller.dispose();
  pair.boundary.dispose();
}

test("browser tools expose only fixed capabilities and native handoff booleans", () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    const snapshot = pair.controller.browserTools.snapshot();
    assert.deepEqual(snapshot, {
      applicationMenu: true,
      customize: true,
      downloads: true,
      extensions: true,
      nativeToolbar: true,
      protections: true,
      settings: true,
      siteInformation: true,
      sitePermissions: true,
      translate: true,
    });
    assert.ok(Object.isFrozen(snapshot));
    const capabilities = pair.controller.assertRequiredCapabilities();
    assert.equal(capabilities.length, 21);
    assert.ok(capabilities.every((capability) => capability.available));
    assert.doesNotMatch(
      JSON.stringify(snapshot),
      /extensionId|icon|label|nativeNode|url|widget/u,
    );
  } finally {
    disposePair(pair);
  }
});

test("popup actions open Firefox panels beside the project host without toolbar reveal", async () => {
  const native = createNativeWindow();
  let revealCount = 0;
  const pair = createController(native, () => {
    revealCount += 1;
    return true;
  });
  const host = native.addHost();
  const events = [];
  const unsubscribe = pair.controller.browserTools.subscribe((event) => {
    events.push(event);
  });
  try {
    for (const action of [
      "site-information",
      "protections",
      "site-permissions",
      "downloads",
      "extensions",
      "translate",
      "application-menu",
    ]) {
      assert.equal(
        await pair.controller.browserTools.invoke(action, host),
        true,
      );
    }

    assert.equal(revealCount, 0);
    assert.equal(native.calls.filter((call) => call[0] === "focus").length, 0);
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "method" &&
          call[1] === "gTrustPanelHandler.showPopup" &&
          call[2] === true,
      ),
    );
    assert.ok(
      native.calls.some((call) => call[0] === "setAnchor" && call[1] === host),
    );
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "method" &&
          call[1] === "DownloadsPanel.initialize" &&
          call[2] === true,
      ),
    );
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "openPopup" &&
          call[1] === "downloadsPanel" &&
          call[2] === host,
      ),
    );
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "method" &&
          call[1] === "PanelUI.ensureReady" &&
          call[2] === true,
      ),
    );
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "openPopup" &&
          call[1] === "appMenu-popup" &&
          call[2] === host &&
          call[3] === "bottomcenter topright",
      ),
    );
    assert.equal(
      native.calls.filter(
        (call) => call[0] === "method" && call[1] === "PanelUI.show",
      ).length,
      0,
    );
    assert.ok(
      native.calls.some(
        (call) => call[0] === "handoff-begin" && call[1] === "downloadsPanel",
      ),
    );
    assert.ok(events.some((event) => event.open === true));
    assert.equal(pair.controller.snapshot().pendingActionCount, 0);
  } finally {
    unsubscribe();
    disposePair(pair);
  }
});

test("settings, customize, and original toolbar keep their non-popup paths", async () => {
  const native = createNativeWindow();
  let revealCount = 0;
  const pair = createController(native, () => {
    revealCount += 1;
    return true;
  });
  try {
    assert.equal(await pair.controller.browserTools.invoke("settings"), true);
    assert.equal(await pair.controller.browserTools.invoke("customize"), true);
    assert.equal(
      await pair.controller.browserTools.invoke("native-toolbar"),
      true,
    );
    assert.equal(revealCount, 1);
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "method" &&
          call[1] === "openPreferences" &&
          call[2] === true,
      ),
    );
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "method" &&
          call[1] === "gCustomizeMode.enter" &&
          call[2] === true,
      ),
    );
    assert.ok(
      native.calls.some(
        (call) => call[0] === "focus" && call[1] === "back-button",
      ),
    );
  } finally {
    disposePair(pair);
  }
});

test("popup actions require a project-owned host in this window", async () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    await assert.rejects(
      pair.controller.browserTools.invoke("downloads"),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_BROWSER_TOOLS_HOST_INVALID",
    );
    const foreign = {
      getBoundingClientRect() {
        return {};
      },
      ownerDocument: native.window.document,
    };
    await assert.rejects(
      pair.controller.browserTools.invoke("downloads", foreign),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_BROWSER_TOOLS_HOST_INVALID",
    );
  } finally {
    disposePair(pair);
  }
});

test("popup host containment requires contains to run with the frame as this", async () => {
  const native = createNativeWindow();
  const pair = createController(native);
  const host = native.addHost();
  try {
    assert.throws(() => {
      const unbound = native.frame.contains;
      unbound(host);
    });
    assert.equal(
      await pair.controller.browserTools.invoke("downloads", host),
      true,
    );
  } finally {
    disposePair(pair);
  }
});

test("Trust still opens on the host when showPopup throws after initialize", async () => {
  const native = createNativeWindow();
  native.window.gTrustPanelHandler.showPopup = async function showPopup() {
    native.calls.push([
      "method",
      "gTrustPanelHandler.showPopup",
      this === native.window.gTrustPanelHandler,
    ]);
    throw new Error("native Trust anchor was not visible");
  };
  const pair = createController(native);
  const host = native.addHost();
  try {
    assert.equal(
      await pair.controller.browserTools.invoke("site-information", host),
      true,
    );
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "openPopup" &&
          call[1] === "trustpanel-popup" &&
          call[2] === host,
      ),
    );
    assert.equal(native.targets.get("trustpanel-popup").state, "open");
    assert.equal(native.targets.get("trustpanel-popup").anchorNode, host);
  } finally {
    disposePair(pair);
  }
});

test("permission panel still opens on the host when owner openPopup throws", async () => {
  const native = createNativeWindow();
  native.window.gPermissionPanel.openPopup = async function openPopup() {
    native.calls.push([
      "method",
      "gPermissionPanel.openPopup",
      this === native.window.gPermissionPanel,
    ]);
    throw new Error("permission owner openPopup failed");
  };
  const pair = createController(native);
  const host = native.addHost({ surface: "address-popup" });
  try {
    assert.equal(
      await pair.controller.browserTools.invoke("site-permissions", host),
      true,
    );
    assert.ok(
      native.calls.some((call) => call[0] === "setAnchor" && call[1] === host),
    );
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "openPopup" &&
          call[1] === "permission-popup" &&
          call[2] === host &&
          call[3] === "after_end",
      ),
    );
  } finally {
    disposePair(pair);
  }
});

test("popup position follows the host surface and action default without closest", async () => {
  const native = createNativeWindow();
  const pair = createController(native);
  const leftHost = native.addHost({ surface: "left" });
  const addressHost = native.addHost({ surface: "address-popup" });
  const defaultHost = native.addHost();
  try {
    await pair.controller.browserTools.invoke("site-information", leftHost);
    await pair.controller.browserTools.invoke("site-information", addressHost);
    await pair.controller.browserTools.invoke("downloads", defaultHost);
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "moveToAnchor" &&
          call[1] === "trustpanel-popup" &&
          call[2] === leftHost &&
          call[3] === "end_before",
      ),
    );
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "moveToAnchor" &&
          call[1] === "trustpanel-popup" &&
          call[2] === addressHost &&
          call[3] === "after_end",
      ),
    );
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "openPopup" &&
          call[1] === "downloadsPanel" &&
          call[2] === defaultHost &&
          call[3] === "after_start",
      ),
    );
  } finally {
    disposePair(pair);
  }
});

test("extensions host-open ignores togglePanel's native-button PanelMultiView.openPopup", async () => {
  const native = createNativeWindow();
  const panel = native.targets.get("unified-extensions-panel");
  const nativeButton = native.targets.get("unified-extensions-button");
  native.window.PanelMultiView = {
    async openPopup(candidate, anchor, options) {
      native.calls.push([
        "PanelMultiView.openPopup",
        candidate.id,
        anchor === nativeButton ? "native-button" : "host",
        options?.position,
      ]);
      candidate.openPopup(anchor, options?.position);
    },
  };
  native.window.gUnifiedExtensions.togglePanel = async function togglePanel() {
    native.calls.push([
      "method",
      "gUnifiedExtensions.togglePanel",
      this === native.window.gUnifiedExtensions,
    ]);
    void native.window.PanelMultiView.openPopup(panel, nativeButton, {
      position: "bottomright topright",
    });
  };
  const pair = createController(native);
  const host = native.addHost();
  try {
    assert.equal(
      await pair.controller.browserTools.invoke("extensions", host),
      true,
    );
    await Promise.resolve();
    assert.equal(panel.state, "open");
    assert.equal(panel.anchorNode, host);
    assert.equal(
      native.calls.filter(
        (call) =>
          call[0] === "PanelMultiView.openPopup" &&
          call[1] === "unified-extensions-panel" &&
          call[2] === "native-button",
      ).length,
      0,
    );
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "PanelMultiView.openPopup" &&
          call[1] === "unified-extensions-panel" &&
          call[2] === "host",
      ),
    );
  } finally {
    disposePair(pair);
  }
});

test("translate delegates to Firefox and routes its PanelMultiView popup to the clicked host", async () => {
  const native = createNativeWindow();
  const panel = native.targets.get("full-page-translations-panel");
  const nativeButton = native.targets.get("translations-button");
  const triggerEvent = {
    button: 0,
    stopPropagation() {
      native.calls.push(["stopPropagation", "translate-trigger"]);
    },
    type: "click",
  };
  native.window.PanelMultiView = {
    async openPopup(candidate, anchor, options) {
      native.calls.push([
        "PanelMultiView.openPopup",
        candidate.id,
        anchor,
        options?.position,
        options?.triggerEvent,
      ]);
      candidate.openPopup(anchor, options?.position);
    },
  };
  native.window.FullPageTranslationsPanel.open = async function open(event) {
    native.calls.push([
      "method",
      "FullPageTranslationsPanel.open",
      this === native.window.FullPageTranslationsPanel,
      event,
    ]);
    event.stopPropagation();
    await native.window.PanelMultiView.openPopup(panel, nativeButton, {
      position: "bottomright topright",
      triggerEvent: event,
    });
  };
  const pair = createController(native);
  const host = native.addHost();
  try {
    assert.equal(
      await pair.controller.browserTools.invoke(
        "translate",
        host,
        triggerEvent,
      ),
      true,
    );
    assert.equal(panel.state, "open");
    assert.equal(panel.anchorNode, host);
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "PanelMultiView.openPopup" &&
          call[1] === "full-page-translations-panel" &&
          call[2] === host &&
          call[3] === "after_end" &&
          call[4] === triggerEvent,
      ),
    );
    assert.equal(
      native.calls.filter(
        (call) =>
          call[0] === "PanelMultiView.openPopup" && call[2] === nativeButton,
      ).length,
      0,
    );
  } finally {
    disposePair(pair);
  }
});

test("translate keeps its route until Firefox lazily creates and opens the panel", async () => {
  const native = createNativeWindow();
  native.window.setTimeout = setTimeout;
  native.window.clearTimeout = clearTimeout;
  native.targets.delete("full-page-translations-panel");
  const nativeButton = native.targets.get("translations-button");
  const triggerEvent = {
    button: 0,
    stopPropagation() {
      native.calls.push(["stopPropagation", "lazy-translate-trigger"]);
    },
    type: "click",
  };
  const originalOpenPopup = async (candidate, anchor, options) => {
    native.calls.push([
      "PanelMultiView.openPopup",
      candidate.id,
      anchor,
      options?.position,
      options?.triggerEvent,
    ]);
    candidate.openPopup(anchor, options?.position);
  };
  native.window.PanelMultiView = { openPopup: originalOpenPopup };
  native.window.FullPageTranslationsPanel.open = async function open(event) {
    native.calls.push([
      "method",
      "FullPageTranslationsPanel.open",
      this === native.window.FullPageTranslationsPanel,
      event,
    ]);
    event.stopPropagation();
    void Promise.resolve().then(async () => {
      const lazyPanel = native.addPanel("full-page-translations-panel");
      await native.window.PanelMultiView.openPopup(lazyPanel, nativeButton, {
        position: "bottomright topright",
        triggerEvent: event,
      });
    });
  };
  const pair = createController(native);
  const host = native.addHost();
  try {
    assert.equal(
      await pair.controller.browserTools.invoke(
        "translate",
        host,
        triggerEvent,
      ),
      true,
    );
    const panel = native.targets.get("full-page-translations-panel");
    assert.equal(panel.state, "open");
    assert.equal(panel.anchorNode, host);
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "PanelMultiView.openPopup" &&
          call[1] === "full-page-translations-panel" &&
          call[2] === host &&
          call[3] === "after_end" &&
          call[4] === triggerEvent,
      ),
    );
    assert.equal(native.window.PanelMultiView.openPopup, originalOpenPopup);
  } finally {
    disposePair(pair);
  }
});

test("PanelMultiView.openPopup is preferred when present and unused handoff tokens are dropped", async () => {
  const native = createNativeWindow();
  native.window.PanelMultiView = {
    async openPopup(panel, anchor, options) {
      native.calls.push([
        "PanelMultiView.openPopup",
        panel.id,
        anchor,
        options.position,
      ]);
      panel.openPopup(anchor, options.position);
    },
  };
  const pair = createController(native);
  const host = native.addHost();
  try {
    await pair.controller.browserTools.invoke("downloads", host);
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "PanelMultiView.openPopup" &&
          call[1] === "downloadsPanel" &&
          call[2] === host &&
          call[3] === "after_start",
      ),
    );
    await pair.controller.browserTools.invoke("site-information", host);
    assert.ok(
      native.calls.some(
        (call) => call[0] === "handoff-begin" && call[1] === "identity-popup",
      ),
    );
    assert.ok(
      native.calls.some(
        (call) => call[0] === "handoff-end" && call[1] === "identity-popup",
      ),
    );
  } finally {
    disposePair(pair);
  }
});

test("application menu opens at the host screen rectangle when element anchoring fails", async () => {
  const native = createNativeWindow();
  native.window.mozInnerScreenX = 10;
  native.window.mozInnerScreenY = 20;
  native.targets.get("appMenu-popup").openPopup = () => {
    throw new Error("html anchor rejected");
  };
  native.targets.get("appMenu-popup").openPopupAtScreenRect =
    function openAtRect(position, x, y, width, height) {
      native.calls.push([
        "openPopupAtScreenRect",
        this.id,
        position,
        x,
        y,
        width,
        height,
      ]);
      this.state = "open";
      native.window.document.dispatch("popupshown", this);
    };
  const pair = createController(native);
  const host = native.addHost();
  try {
    assert.equal(
      await pair.controller.browserTools.invoke("application-menu", host),
      true,
    );
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "openPopupAtScreenRect" &&
          call[1] === "appMenu-popup" &&
          call[2] === "bottomcenter topright" &&
          call[3] === 22 &&
          call[4] === 44 &&
          call[5] === 32 &&
          call[6] === 32,
      ),
    );
    assert.equal(
      native.calls.filter(
        (call) => call[0] === "method" && call[1] === "PanelUI.show",
      ).length,
      0,
    );
    assert.equal(native.targets.get("appMenu-popup").state, "open");
  } finally {
    disposePair(pair);
  }
});

test("application menu falls back to PanelUI.show and re-anchors the host", async () => {
  const native = createNativeWindow();
  native.targets.get("appMenu-popup").openPopup = () => {
    throw new Error("host-anchored appMenu-popup openPopup failed");
  };
  native.window.PanelUI.show = function show() {
    native.calls.push([
      "method",
      "PanelUI.show",
      this === native.window.PanelUI,
    ]);
    const panel = native.targets.get("appMenu-popup");
    panel.anchorNode = native.targets.get("PanelUI-menu-button");
    panel.state = "open";
    native.window.document.dispatch("popupshown", panel);
  };
  native.window.PanelUI._ensureShortcutsShown = function ensureShortcuts() {
    native.calls.push([
      "method",
      "PanelUI._ensureShortcutsShown",
      this === native.window.PanelUI,
    ]);
  };
  const pair = createController(native);
  const host = native.addHost();
  try {
    assert.equal(
      await pair.controller.browserTools.invoke("application-menu", host),
      true,
    );
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "method" &&
          call[1] === "PanelUI._ensureShortcutsShown" &&
          call[2] === true,
      ),
    );
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "method" &&
          call[1] === "PanelUI.show" &&
          call[2] === true,
      ),
    );
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "moveToAnchor" &&
          call[1] === "appMenu-popup" &&
          call[2] === host &&
          call[3] === "bottomcenter topright",
      ),
    );
    assert.equal(native.targets.get("appMenu-popup").state, "open");
  } finally {
    disposePair(pair);
  }
});

test("application menu keeps the NativeUi token when a failed open fires popuphidden", async () => {
  const native = createNativeWindow();
  native.window.mozInnerScreenX = 10;
  native.window.mozInnerScreenY = 20;
  let multiViewCalls = 0;
  native.window.PanelMultiView = {
    async openPopup(panel, anchor, options) {
      multiViewCalls += 1;
      native.calls.push([
        "PanelMultiView.openPopup",
        panel.id,
        anchor,
        options && typeof options === "object"
          ? (options.position ?? options.x)
          : options,
      ]);
      if (multiViewCalls === 1) {
        native.window.document.dispatch("popuphidden", panel);
        return false;
      }
      panel.openPopup(anchor, options);
      return true;
    },
  };
  native.targets.get("appMenu-popup").openPopupAtScreenRect =
    function openAtRect() {
      native.calls.push(["openPopupAtScreenRect", this.id]);
      this.state = "open";
      native.window.document.dispatch("popupshown", this);
    };
  const pair = createController(native);
  const host = native.addHost();
  try {
    assert.equal(
      await pair.controller.browserTools.invoke("application-menu", host),
      true,
    );
    assert.equal(
      native.calls.filter(
        (call) => call[0] === "handoff-end" && call[1] === "appMenu-popup",
      ).length,
      0,
    );
    assert.equal(
      native.calls.filter((call) => call[0] === "openPopupAtScreenRect").length,
      0,
    );
    assert.ok(multiViewCalls >= 2);
    assert.equal(
      native.calls.filter(
        (call) => call[0] === "method" && call[1] === "PanelUI.show",
      ).length,
      0,
    );
    assert.equal(native.targets.get("appMenu-popup").state, "open");
  } finally {
    disposePair(pair);
  }
});

test("application menu treats PanelMultiView as a class owner", async () => {
  const native = createNativeWindow();
  native.window.mozInnerScreenX = 10;
  native.window.mozInnerScreenY = 20;
  class PanelMultiView {
    static async openPopup(panel, anchor, options) {
      native.calls.push([
        "PanelMultiView.openPopup",
        panel.id,
        typeof PanelMultiView,
        this === PanelMultiView,
        options && typeof options === "object" ? options.position : options,
      ]);
      panel.openPopup(anchor, options);
    }
  }
  native.window.PanelMultiView = PanelMultiView;
  native.targets.get("appMenu-popup").openPopup = () => {
    throw new Error("html anchor rejected");
  };
  native.targets.get("appMenu-popup").openPopupAtScreenRect =
    function openAtRect(position, x, y, width, height) {
      native.calls.push([
        "openPopupAtScreenRect",
        this.id,
        position,
        x,
        y,
        width,
        height,
      ]);
      this.state = "open";
      native.window.document.dispatch("popupshown", this);
    };
  const pair = createController(native);
  const host = native.addHost();
  try {
    assert.equal(
      await pair.controller.browserTools.invoke("application-menu", host),
      true,
    );
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "PanelMultiView.openPopup" &&
          call[1] === "appMenu-popup" &&
          call[2] === "function" &&
          call[3] === true &&
          call[4] === "bottomcenter topright",
      ),
    );
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "openPopupAtScreenRect" &&
          call[1] === "appMenu-popup" &&
          call[2] === "bottomcenter topright",
      ),
    );
    assert.equal(
      native.calls.filter(
        (call) => call[0] === "method" && call[1] === "PanelUI.show",
      ).length,
      0,
    );
    assert.equal(native.targets.get("appMenu-popup").state, "open");
  } finally {
    disposePair(pair);
  }
});

test("application menu routes PanelMultiView.openPopup through openPopupAtScreenRect", async () => {
  const native = createNativeWindow();
  native.window.mozInnerScreenX = 10;
  native.window.mozInnerScreenY = 20;
  native.window.PanelMultiView = {
    async openPopup(panel, anchor, options) {
      native.calls.push([
        "PanelMultiView.openPopup",
        panel.id,
        anchor,
        options && typeof options === "object" ? options.position : options,
      ]);
      panel.openPopup(anchor, options);
    },
  };
  native.targets.get("appMenu-popup").openPopup = () => {
    throw new Error("html anchor rejected");
  };
  native.targets.get("appMenu-popup").openPopupAtScreenRect =
    function openAtRect(position, x, y, width, height) {
      native.calls.push([
        "openPopupAtScreenRect",
        this.id,
        position,
        x,
        y,
        width,
        height,
      ]);
      this.state = "open";
      native.window.document.dispatch("popupshown", this);
    };
  const pair = createController(native);
  const host = native.addHost();
  try {
    assert.equal(
      await pair.controller.browserTools.invoke("application-menu", host),
      true,
    );
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "PanelMultiView.openPopup" &&
          call[1] === "appMenu-popup" &&
          call[3] === "bottomcenter topright",
      ),
    );
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "openPopupAtScreenRect" &&
          call[1] === "appMenu-popup" &&
          call[2] === "bottomcenter topright" &&
          call[3] === 22 &&
          call[4] === 44 &&
          call[5] === 32 &&
          call[6] === 32,
      ),
    );
    assert.equal(
      native.calls.filter(
        (call) => call[0] === "method" && call[1] === "PanelUI.show",
      ).length,
      0,
    );
    assert.equal(native.targets.get("appMenu-popup").state, "open");
  } finally {
    disposePair(pair);
  }
});

test("Trust panel opens without using collapsed-chrome checkVisibility", async () => {
  const native = createNativeWindow();
  native.setTrustVisible(false);
  const pair = createController(native);
  const host = native.addHost();
  try {
    await pair.controller.browserTools.invoke("site-information", host);
    await pair.controller.browserTools.invoke("protections", host);
    assert.equal(
      native.calls.filter((call) => call[0] === "check-visibility").length,
      0,
    );
    assert.equal(
      native.calls.filter(
        (call) =>
          call[0] === "method" && call[1] === "gTrustPanelHandler.showPopup",
      ).length,
      2,
    );
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "moveToAnchor" &&
          call[1] === "trustpanel-popup" &&
          call[2] === host,
      ),
    );
  } finally {
    disposePair(pair);
  }
});

test("Downloads initialize and open beside the host when the native button is collapsed", async () => {
  const native = createNativeWindow();
  const pair = createController(native);
  const host = native.addHost();
  try {
    const stalePanel = native.targets.get("downloadsPanel");
    stalePanel.openPopup = () => {
      throw new Error("stale native panel was cached");
    };
    const replacement = native.addPanel("downloadsPanel");
    await pair.controller.browserTools.invoke("downloads", host);
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "openPopup" &&
          call[1] === replacement.id &&
          call[2] === host,
      ),
    );
    assert.equal(
      native.calls.filter(
        (call) => call[0] === "click" && call[1] === "downloads-button",
      ).length,
      0,
    );
  } finally {
    disposePair(pair);
  }
});

test("Downloads health does not require the native toolbar button in the document", async () => {
  const native = createNativeWindow();
  native.targets.delete("downloads-button");
  const pair = createController(native);
  const host = native.addHost();
  try {
    assert.equal(pair.controller.browserTools.snapshot().downloads, true);
    await pair.controller.browserTools.invoke("downloads", host);
    assert.ok(
      native.calls.some(
        (call) =>
          call[0] === "method" && call[1] === "DownloadsPanel.initialize",
      ),
    );
    assert.equal(
      native.calls.filter(
        (call) => call[0] === "click" && call[1] === "downloads-button",
      ).length,
      0,
    );
  } finally {
    disposePair(pair);
  }
});

test("missing required native targets fail before activation", () => {
  const native = createNativeWindow();
  native.targets.delete("identity-permission-box");
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260810162159",
    contextId: "window-browser-tools-missing-target",
    firefoxVersion: "153.0.4",
    window: native.window,
    windowKind: "normal",
  });
  try {
    assert.throws(
      () =>
        createFirefoxBrowserToolsBridge({
          beginNativePopupHandoff: () => true,
          boundary,
          endNativePopupHandoff() {},
          frame: native.frame,
          requestNativeUiReveal: () => true,
          window: native.window,
        }),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode ===
          "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING" &&
        error.fenneviaSymbol === "document.identity-permission-box.click.focus",
    );
  } finally {
    boundary.dispose();
  }
});

test("missing optional translations owner disables only the translate action", async () => {
  const native = createNativeWindow();
  delete native.window.FullPageTranslationsPanel;
  const pair = createController(native);
  try {
    assert.equal(pair.controller.browserTools.snapshot().translate, false);
    const capabilities = pair.controller.assertRequiredCapabilities();
    assert.ok(
      capabilities.some(
        (capability) =>
          capability.name === "browser-tools.full-page-translations" &&
          capability.available === false &&
          capability.requirement === "optional",
      ),
    );
    await assert.rejects(
      pair.controller.browserTools.invoke("translate", native.addHost()),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode ===
          "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING" &&
        error.fenneviaSymbol === "window.FullPageTranslationsPanel.open",
    );
  } finally {
    disposePair(pair);
  }
});

test("rejected original-toolbar reveal and native action failures stay typed and privacy safe", async () => {
  const rejectedNative = createNativeWindow();
  const rejectedPair = createController(rejectedNative, () => false);
  try {
    await assert.rejects(
      rejectedPair.controller.browserTools.invoke("native-toolbar"),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_BROWSER_TOOLS_REVEAL_REJECTED",
    );
  } finally {
    disposePair(rejectedPair);
  }

  const failingNative = createNativeWindow();
  failingNative.targets.get("downloadsPanel").openPopup = () => {
    throw new Error(
      "https://private.example.invalid C:\\Users\\person\\secret",
    );
  };
  const failingPair = createController(failingNative);
  try {
    await assert.rejects(
      failingPair.controller.browserTools.invoke(
        "downloads",
        failingNative.addHost(),
      ),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED" &&
        error.fenneviaSymbol === "document.downloadsPanel.openPopup" &&
        !error.message.includes("private.example") &&
        !JSON.stringify(error).includes("private.example"),
    );
  } finally {
    disposePair(failingPair);
  }
});

test("browser tools disposal hides open panels and rejects later access", async () => {
  const native = createNativeWindow();
  const pair = createController(native);
  const host = native.addHost();
  await pair.controller.browserTools.invoke("downloads", host);
  assert.equal(native.targets.get("downloadsPanel").state, "open");
  assert.equal(pair.controller.dispose(), true);
  assert.equal(pair.controller.dispose(), false);
  assert.deepEqual(pair.controller.snapshot(), {
    disposed: true,
    pendingActionCount: 0,
  });
  assert.equal(native.targets.get("downloadsPanel").state, "closed");
  assert.throws(
    () => pair.controller.browserTools.snapshot(),
    /FENNEVIA_FIREFOX_BROWSER_TOOLS_DISPOSED/u,
  );
  await assert.rejects(
    pair.controller.browserTools.invoke("settings"),
    /FENNEVIA_FIREFOX_BROWSER_TOOLS_DISPOSED/u,
  );
  pair.boundary.dispose();
});
