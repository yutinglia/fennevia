import assert from "node:assert/strict";
import test from "node:test";

import {
  createFirefoxBridgeBoundary,
  isFirefoxBridgeError,
} from "../src/firefox/bridge-boundary.ts";
import { createFirefoxNavigationBridge } from "../src/firefox/navigation.ts";

const BROWSER_URI = "chrome://browser/content/browser.xhtml";
let nextContextSequence = 0;

function createEventTarget() {
  const listeners = [];
  return {
    addEventListener(type, listener, options) {
      listeners.push({ listener, options, type });
    },
    dispatch(type, target, detail = undefined) {
      for (const record of listeners
        .filter((candidate) => candidate.type === type)
        .slice()) {
        record.listener({ detail, target, type });
      }
    },
    listenerCount: () => listeners.length,
    removeEventListener(type, listener, options) {
      const index = listeners.findIndex(
        (candidate) =>
          candidate.type === type &&
          candidate.listener === listener &&
          candidate.options === options,
      );
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    },
  };
}

function createNativeWindow() {
  const tabContainer = createEventTarget();
  const observerRecords = new Set();
  const progressListeners = new Set();
  const actionCalls = [];

  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.targets = new Set();
      observerRecords.add(this);
    }
    disconnect() {
      this.targets.clear();
      observerRecords.delete(this);
    }
    observe(target) {
      this.targets.add(target);
    }
  }

  function createCommand(disabled = false) {
    let isDisabled = disabled;
    const command = {
      hasAttribute(name) {
        return name === "disabled" && isDisabled;
      },
      setDisabled(nextDisabled) {
        if (isDisabled === nextDisabled) {
          return;
        }
        isDisabled = nextDisabled;
        for (const observer of Array.from(observerRecords)) {
          if (observer.targets.has(command)) {
            observer.callback([{ attributeName: "disabled", target: command }]);
          }
        }
      },
    };
    return command;
  }

  const commandsById = new Map([
    ["Browser:Back", createCommand(true)],
    ["Browser:Forward", createCommand(true)],
    ["Browser:Reload", createCommand(false)],
    ["Browser:Stop", createCommand(true)],
    ["cmd_newNavigatorTabNoEvent", createCommand(false)],
  ]);

  function createBrowser(id, uri) {
    return {
      canGoBack: false,
      canGoForward: false,
      currentURI: { displaySpec: uri },
      id,
      webNavigation: {},
    };
  }

  function createTab(id, title, browser) {
    const attributes = new Map([["label", title]]);
    return {
      browser,
      getAttribute(name) {
        return attributes.get(name) ?? "";
      },
      id,
      setAttribute(name, value) {
        attributes.set(name, String(value));
      },
    };
  }

  const browsers = [
    createBrowser("browser-1", "https://example.invalid/one"),
    createBrowser("browser-2", "about:blank"),
  ];
  const tabs = [
    createTab("tab-1", "One", browsers[0]),
    createTab("tab-2", "Two", browsers[1]),
  ];
  let selectedIndex = 0;

  const syncSelectedCommands = () => {
    const browser = browsers[selectedIndex];
    commandsById.get("Browser:Back").setDisabled(!browser.canGoBack);
    commandsById.get("Browser:Forward").setDisabled(!browser.canGoForward);
    commandsById.get("Browser:Stop").setDisabled(!browser.loading);
  };

  const gBrowser = {
    addTabsProgressListener(listener) {
      progressListeners.add(listener);
    },
    removeTabsProgressListener(listener) {
      progressListeners.delete(listener);
    },
    tabContainer,
    tabs,
  };
  Object.defineProperties(gBrowser, {
    selectedBrowser: {
      configurable: true,
      get: () => browsers[selectedIndex],
    },
    selectedTab: {
      configurable: true,
      get: () => tabs[selectedIndex],
      set(tab) {
        const nextIndex = tabs.indexOf(tab);
        if (nextIndex === -1 || nextIndex === selectedIndex) {
          return;
        }
        const previousTab = tabs[selectedIndex];
        selectedIndex = nextIndex;
        syncSelectedCommands();
        tabContainer.dispatch("TabSelect", tab, { previousTab });
      },
    },
  });

  const BrowserCommands = {
    back() {
      actionCalls.push(["back", gBrowser.selectedBrowser.id]);
    },
    forward() {
      actionCalls.push(["forward", gBrowser.selectedBrowser.id]);
    },
    openTab() {
      actionCalls.push(["new-tab", gBrowser.selectedBrowser.id]);
      const index = tabs.length + 1;
      const browser = createBrowser(`browser-${index}`, "about:newtab");
      const tab = createTab(`tab-${index}`, "New Tab", browser);
      browsers.push(browser);
      tabs.push(tab);
      gBrowser.selectedTab = tab;
    },
    reload() {
      actionCalls.push(["reload", gBrowser.selectedBrowser.id]);
    },
    stop() {
      actionCalls.push(["stop", gBrowser.selectedBrowser.id]);
    },
  };

  const window = {
    BrowserCommands,
    MutationObserver: FakeMutationObserver,
    document: {
      defaultView: null,
      documentURI: BROWSER_URI,
      getElementById(id) {
        return commandsById.get(id) ?? null;
      },
    },
    gBrowser,
  };
  window.document.defaultView = window;

  return {
    actionCalls,
    browsers,
    commandsById,
    fireProgress(method, browser = gBrowser.selectedBrowser, topLevel = true) {
      for (const listener of Array.from(progressListeners)) {
        listener[method]?.(browser, { isTopLevel: topLevel }, null, null, 0);
      }
    },
    gBrowser,
    observerCount: () => observerRecords.size,
    progressListenerCount: () => progressListeners.size,
    setState(index, patch, { event = "location" } = {}) {
      const browser = browsers[index];
      const tab = tabs[index];
      if (patch.canGoBack !== undefined) {
        browser.canGoBack = patch.canGoBack;
      }
      if (patch.canGoForward !== undefined) {
        browser.canGoForward = patch.canGoForward;
      }
      if (patch.displayUri !== undefined) {
        browser.currentURI = { displaySpec: patch.displayUri };
      }
      if (patch.loading !== undefined) {
        browser.loading = patch.loading;
      }
      if (patch.title !== undefined) {
        tab.setAttribute("label", patch.title);
      }
      if (index === selectedIndex) {
        syncSelectedCommands();
      }
      if (patch.title !== undefined) {
        tabContainer.dispatch("TabAttrModified", tab, { changed: ["label"] });
      }
      if (event === "location") {
        this.fireProgress("onLocationChange", browser);
      } else if (event === "state") {
        this.fireProgress("onStateChange", browser);
      }
    },
    tabContainer,
    tabs,
    window,
  };
}

function createController(native, errors = []) {
  const contextId = `window-00000000-0000-4000-8000-${String(
    ++nextContextSequence,
  ).padStart(12, "0")}`;
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260810162159",
    contextId,
    firefoxVersion: "153.0.4",
    window: native.window,
    windowKind: "normal",
  });
  const controller = createFirefoxNavigationBridge({
    boundary,
    onError(error) {
      errors.push(error);
    },
    window: native.window,
  });
  return { boundary, controller };
}

function disposePair(pair) {
  pair.controller.dispose();
  pair.boundary.dispose();
}

test("initial navigation snapshot is bounded ordinary data with native command state", () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    const snapshot = pair.controller.navigation.snapshot();
    assert.deepEqual(snapshot, {
      canGoBack: false,
      canGoForward: false,
      displayUri: "https://example.invalid/one",
      loading: false,
      title: "One",
    });
    assert.ok(Object.isFrozen(snapshot));
    assert.doesNotMatch(
      JSON.stringify(snapshot),
      /selectedBrowser|webNavigation|BrowserCommands/u,
    );
    assert.ok(
      pair.controller
        .assertRequiredCapabilities()
        .every((capability) => capability.available),
    );
    assert.equal(native.progressListenerCount(), 1);
    assert.equal(native.observerCount(), 1);
  } finally {
    disposePair(pair);
  }
});

test("location, title, loading, command, same-document, and selected-tab updates are event driven", () => {
  const native = createNativeWindow();
  const pair = createController(native);
  const events = [];
  try {
    pair.controller.navigation.subscribe((event) => events.push(event));
    native.setState(0, {
      canGoBack: true,
      displayUri: "https://example.invalid/one#same-document",
      loading: true,
      title: "Updated title",
    });
    let snapshot = pair.controller.navigation.snapshot();
    assert.equal(snapshot.canGoBack, true);
    assert.equal(snapshot.loading, true);
    assert.equal(snapshot.title, "Updated title");
    assert.match(snapshot.displayUri, /same-document$/u);

    native.setState(1, {
      canGoForward: true,
      displayUri: "https://example.invalid/redirected",
      loading: false,
      title: "Redirected",
    });
    const revisionBeforeBackgroundProgress =
      pair.controller.snapshot().revision;
    native.fireProgress("onLocationChange", native.browsers[1]);
    assert.equal(
      pair.controller.snapshot().revision,
      revisionBeforeBackgroundProgress,
    );

    native.gBrowser.selectedTab = native.tabs[1];
    snapshot = pair.controller.navigation.snapshot();
    assert.deepEqual(snapshot, {
      canGoBack: false,
      canGoForward: true,
      displayUri: "https://example.invalid/redirected",
      loading: false,
      title: "Redirected",
    });
    assert.ok(events.length >= 3);
    assert.ok(events.every(Object.isFrozen));
    assert.ok(events.every((event) => Object.isFrozen(event.snapshot)));
  } finally {
    disposePair(pair);
  }
});

test("actions re-read the selected tab and reload-or-stop state at invocation", () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    native.setState(0, { canGoBack: true, loading: false });
    const staleUiSnapshot = pair.controller.navigation.snapshot();
    assert.equal(staleUiSnapshot.canGoBack, true);
    native.setState(1, { canGoBack: true, loading: true });
    native.gBrowser.selectedTab = native.tabs[1];

    assert.equal(pair.controller.navigation.back(), true);
    assert.equal(pair.controller.navigation.reloadOrStop(), "stop");
    native.setState(1, { loading: false }, { event: "state" });
    assert.equal(pair.controller.navigation.reloadOrStop(), "reload");
    assert.equal(pair.controller.navigation.forward(), false);
    assert.equal(pair.controller.navigation.newTab(), true);

    assert.deepEqual(native.actionCalls, [
      ["back", "browser-2"],
      ["stop", "browser-2"],
      ["reload", "browser-2"],
      ["new-tab", "browser-2"],
    ]);
    assert.equal(
      pair.controller.navigation.snapshot().displayUri,
      "about:newtab",
    );
  } finally {
    disposePair(pair);
  }
});

test("rapid state transitions publish only changed snapshots", () => {
  const native = createNativeWindow();
  const pair = createController(native);
  let callbackCount = 0;
  try {
    pair.controller.navigation.subscribe(() => {
      callbackCount += 1;
    });
    native.fireProgress("onStateChange");
    native.fireProgress(
      "onLocationChange",
      native.gBrowser.selectedBrowser,
      false,
    );
    assert.equal(callbackCount, 0);

    for (const loading of [true, false, true, false]) {
      native.setState(0, { loading }, { event: "state" });
    }
    assert.equal(pair.controller.navigation.snapshot().loading, false);
    assert.ok(callbackCount >= 4);
  } finally {
    disposePair(pair);
  }
});

test("malformed native events enter one privacy-safe typed failure path", () => {
  const native = createNativeWindow();
  const errors = [];
  const pair = createController(native, errors);
  try {
    const detail = {};
    Object.defineProperty(detail, "changed", {
      get() {
        throw new Error(
          "https://private.example.invalid C:\\Users\\person\\secret",
        );
      },
    });
    assert.doesNotThrow(() => {
      native.tabContainer.dispatch("TabAttrModified", native.tabs[0], detail);
    });
    assert.equal(pair.controller.snapshot().failed, true);
    assert.equal(errors.length, 1);
    assert.equal(
      errors[0].fenneviaCode,
      "FENNEVIA_FIREFOX_NAVIGATION_EVENT_FAILED",
    );
    assert.equal(errors[0].fenneviaPhase, "firefox-navigation-event");
    assert.equal(
      errors[0].fenneviaSymbol,
      "window.gBrowser.tabContainer.TabAttrModified",
    );
    assert.doesNotMatch(
      `${errors[0].message}${JSON.stringify(errors[0])}`,
      /private\.example|Users|secret/u,
    );
  } finally {
    disposePair(pair);
  }
});

test("action failures are typed without serializing the native cause", () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    native.window.BrowserCommands.reload = () => {
      throw new Error("https://private.example.invalid/secret");
    };
    assert.throws(
      () => pair.controller.navigation.reload(),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_NAVIGATION_ACTION_FAILED" &&
        error.fenneviaSymbol === "window.BrowserCommands.reload" &&
        !error.message.includes("private.example"),
    );
  } finally {
    disposePair(pair);
  }
});

test("disposal removes tab, progress, command, and application listeners", () => {
  const native = createNativeWindow();
  const pair = createController(native);
  let callbackCount = 0;
  pair.controller.navigation.subscribe(() => {
    callbackCount += 1;
  });
  assert.equal(native.tabContainer.listenerCount(), 2);
  assert.equal(native.progressListenerCount(), 1);
  assert.equal(native.observerCount(), 1);

  assert.equal(pair.controller.dispose(), true);
  assert.equal(pair.controller.dispose(), false);
  assert.equal(native.tabContainer.listenerCount(), 0);
  assert.equal(native.progressListenerCount(), 0);
  assert.equal(native.observerCount(), 0);
  native.setState(0, { loading: true, title: "After dispose" });
  assert.equal(callbackCount, 0);
  assert.deepEqual(pair.controller.snapshot(), {
    disposed: true,
    failed: false,
    revision: 1,
    subscriberCount: 0,
  });
  assert.throws(
    () => pair.controller.navigation.back(),
    /FENNEVIA_FIREFOX_NAVIGATION_DISPOSED/u,
  );
  pair.boundary.dispose();
});

test("missing required navigation capabilities fail with build-scoped diagnostics", () => {
  const native = createNativeWindow();
  native.gBrowser.removeTabsProgressListener = undefined;
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260810162159",
    contextId: "window-00000000-0000-4000-8000-999999999998",
    firefoxVersion: "153.0.4",
    window: native.window,
    windowKind: "normal",
  });
  try {
    assert.throws(
      () =>
        createFirefoxNavigationBridge({
          boundary,
          onError() {},
          window: native.window,
        }),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode ===
          "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING" &&
        error.fenneviaSymbol === "window.gBrowser.removeTabsProgressListener" &&
        error.fenneviaBuildId === "20260810162159",
    );
    assert.equal(native.tabContainer.listenerCount(), 0);
    assert.equal(native.progressListenerCount(), 0);
    assert.equal(native.observerCount(), 0);
  } finally {
    boundary.dispose();
  }
});

test("missing native command elements identify the exact command boundary", () => {
  const native = createNativeWindow();
  native.commandsById.delete("Browser:Back");
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260810162159",
    contextId: "window-00000000-0000-4000-8000-999999999997",
    firefoxVersion: "153.0.4",
    window: native.window,
    windowKind: "normal",
  });
  try {
    assert.throws(
      () =>
        createFirefoxNavigationBridge({
          boundary,
          onError() {},
          window: native.window,
        }),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode ===
          "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING" &&
        error.fenneviaSymbol === "document.commands[Browser-Back]",
    );
    assert.equal(native.tabContainer.listenerCount(), 0);
    assert.equal(native.progressListenerCount(), 0);
    assert.equal(native.observerCount(), 0);
  } finally {
    boundary.dispose();
  }
});
