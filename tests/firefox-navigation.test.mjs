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
    dispatch(type, target, detail = undefined, properties = {}) {
      for (const record of listeners
        .filter((candidate) => candidate.type === type)
        .slice()) {
        record.listener({ ...properties, detail, target, type });
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
  const actionGestures = [];
  const addressSubmissions = [];
  const focusCalls = [];
  let shellHealthy = false;

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
    const eventTarget = createEventTarget();
    const command = {
      ...eventTarget,
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
    ["Browser:OpenLocation", createCommand(false)],
    ["cmd_newNavigatorTabNoEvent", createCommand(false)],
  ]);

  function createBrowser(id, uri) {
    return {
      canGoBack: false,
      canGoForward: false,
      currentURI: { displaySpec: uri },
      focus() {
        focusCalls.push(id);
      },
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
  const addressValues = ["example.invalid/one", ""];
  const editableAddressValues = ["https://example.invalid/one", ""];
  const proxyStates = ["valid", "valid"];
  const connectionStates = ["secure", "not-secure"];
  const protectionStates = [
    {
      anyBlocking: true,
      anyDetected: true,
      canHandle: true,
      hasException: false,
    },
    {
      anyBlocking: false,
      anyDetected: false,
      canHandle: false,
      hasException: false,
    },
  ];
  let selectedIndex = 0;

  const urlbarEvents = createEventTarget();
  const gURLBar = {
    ...urlbarEvents,
    getAttribute(name) {
      return name === "pageproxystate" ? proxyStates[selectedIndex] : "";
    },
    handleCommand() {
      addressSubmissions.push({
        browserId: gBrowser.selectedBrowser.id,
        value: addressValues[selectedIndex],
      });
    },
    get value() {
      return addressValues[selectedIndex];
    },
    get untrimmedValue() {
      return editableAddressValues[selectedIndex];
    },
    set value(nextValue) {
      const value = String(nextValue);
      addressValues[selectedIndex] = value;
      editableAddressValues[selectedIndex] = value;
      proxyStates[selectedIndex] = "invalid";
      urlbarEvents.dispatch("ValueChange", gURLBar);
    },
  };

  const gIdentityHandler = {
    getConnectionSecurityInformation() {
      return connectionStates[selectedIndex];
    },
  };
  const gProtectionsHandler = {};
  gProtectionsHandler.onContentBlockingEvent = () => {};
  for (const member of ["anyBlocking", "anyDetected", "hasException"]) {
    Object.defineProperty(gProtectionsHandler, member, {
      configurable: true,
      get: () => protectionStates[selectedIndex][member],
    });
  }
  const ContentBlockingAllowList = {
    canHandle(browser) {
      const index = browsers.indexOf(browser);
      return index >= 0 && protectionStates[index].canHandle;
    },
  };

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
    back(event) {
      actionCalls.push(["back", gBrowser.selectedBrowser.id]);
      actionGestures.push(["back", event]);
    },
    forward(event) {
      actionCalls.push(["forward", gBrowser.selectedBrowser.id]);
      actionGestures.push(["forward", event]);
    },
    home(event) {
      actionCalls.push(["home", gBrowser.selectedBrowser.id]);
      actionGestures.push(["home", event]);
      const browser = gBrowser.selectedBrowser;
      browser.currentURI = { displaySpec: "about:home" };
      addressValues[selectedIndex] = "";
      editableAddressValues[selectedIndex] = "";
    },
    openTab() {
      actionCalls.push(["new-tab", gBrowser.selectedBrowser.id]);
      const index = tabs.length + 1;
      const browser = createBrowser(`browser-${index}`, "about:newtab");
      const tab = createTab(`tab-${index}`, "New Tab", browser);
      browsers.push(browser);
      tabs.push(tab);
      addressValues.push("");
      editableAddressValues.push("");
      proxyStates.push("valid");
      connectionStates.push("not-secure");
      protectionStates.push({
        anyBlocking: false,
        anyDetected: false,
        canHandle: false,
        hasException: false,
      });
      gBrowser.selectedTab = tab;
    },
    reload() {
      actionCalls.push(["reload", gBrowser.selectedBrowser.id]);
    },
    reloadOrDuplicate(event) {
      actionCalls.push(["reload-or-duplicate", gBrowser.selectedBrowser.id]);
      actionGestures.push(["reload-or-duplicate", event]);
    },
    stop() {
      actionCalls.push(["stop", gBrowser.selectedBrowser.id]);
    },
  };

  const window = {
    BrowserCommands,
    ContentBlockingAllowList,
    MutationObserver: FakeMutationObserver,
    document: {
      defaultView: null,
      documentElement: {
        hasAttribute(name) {
          return name === "data-fennevia-healthy" && shellHealthy;
        },
      },
      documentURI: BROWSER_URI,
      getElementById(id) {
        return commandsById.get(id) ?? null;
      },
    },
    gBrowser,
    gIdentityHandler,
    gProtectionsHandler,
    gURLBar,
  };
  window.document.defaultView = window;

  return {
    actionCalls,
    actionGestures,
    addressSubmissions,
    browsers,
    commandsById,
    focusCalls,
    fireProgress(method, browser = gBrowser.selectedBrowser, topLevel = true) {
      for (const listener of Array.from(progressListeners)) {
        listener[method]?.(browser, { isTopLevel: topLevel }, null, null, 0);
      }
    },
    gBrowser,
    observerCount: () => observerRecords.size,
    openLocationListenerCount: () =>
      commandsById.get("Browser:OpenLocation")?.listenerCount() ?? 0,
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
        addressValues[index] = patch.displayUri;
        editableAddressValues[index] = patch.displayUri;
        proxyStates[index] = "valid";
      }
      if (patch.addressValue !== undefined) {
        addressValues[index] = patch.addressValue;
      }
      if (patch.editableAddressValue !== undefined) {
        editableAddressValues[index] = patch.editableAddressValue;
      }
      if (patch.proxyState !== undefined) {
        proxyStates[index] = patch.proxyState;
      }
      if (patch.connectionSecurity !== undefined) {
        connectionStates[index] = patch.connectionSecurity;
      }
      if (patch.trackingProtection !== undefined) {
        Object.assign(protectionStates[index], patch.trackingProtection);
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
      } else if (event === "security") {
        this.fireProgress("onSecurityChange", browser);
      } else if (event === "content-blocking") {
        this.fireProgress("onContentBlockingEvent", browser);
      }
    },
    tabContainer,
    tabs,
    dispatchOpenLocation(keyId = "focusURLBar") {
      let prevented = false;
      let stopped = false;
      const command = commandsById.get("Browser:OpenLocation");
      command.dispatch("command", command, undefined, {
        preventDefault() {
          prevented = true;
        },
        sourceEvent: keyId === null ? undefined : { target: { id: keyId } },
        stopPropagation() {
          stopped = true;
        },
      });
      return { prevented, stopped };
    },
    setHealthy(value) {
      shellHealthy = value;
    },
    urlbarListenerCount: () => urlbarEvents.listenerCount(),
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
      addressValue: "example.invalid/one",
      canGoBack: false,
      canGoForward: false,
      connectionSecurity: "secure",
      displayUri: "https://example.invalid/one",
      editableAddressValue: "https://example.invalid/one",
      loading: false,
      title: "One",
      trackingProtection: "blocking",
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
    assert.equal(native.openLocationListenerCount(), 1);
    assert.equal(native.urlbarListenerCount(), 0);
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
      connectionSecurity: "secure-cert-user-overridden",
      displayUri: "https://example.invalid/one#same-document",
      loading: true,
      title: "Updated title",
      trackingProtection: {
        anyBlocking: false,
        anyDetected: true,
        canHandle: true,
      },
    });
    native.setState(0, {}, { event: "security" });
    native.setState(0, {}, { event: "content-blocking" });
    let snapshot = pair.controller.navigation.snapshot();
    assert.equal(snapshot.canGoBack, true);
    assert.equal(snapshot.loading, true);
    assert.equal(snapshot.title, "Updated title");
    assert.equal(snapshot.connectionSecurity, "secure-certificate-override");
    assert.equal(snapshot.trackingProtection, "detected");
    assert.match(snapshot.displayUri, /same-document$/u);

    native.setState(1, {
      addressValue: "example.invalid/redirected",
      canGoForward: true,
      displayUri: "https://example.invalid/redirected",
      editableAddressValue: "https://example.invalid/redirected",
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
      addressValue: "example.invalid/redirected",
      canGoBack: false,
      canGoForward: true,
      connectionSecurity: "not-secure",
      displayUri: "https://example.invalid/redirected",
      editableAddressValue: "https://example.invalid/redirected",
      loading: false,
      title: "Redirected",
      trackingProtection: "unavailable",
    });
    assert.ok(events.length >= 3);
    assert.ok(events.every(Object.isFrozen));
    assert.ok(events.every((event) => Object.isFrozen(event.snapshot)));
  } finally {
    disposePair(pair);
  }
});

test("navigation keeps a trimmed display value and exposes the bounded native editing value", () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    let snapshot = pair.controller.navigation.snapshot();
    assert.equal(snapshot.addressValue, "example.invalid/one");
    assert.equal(snapshot.editableAddressValue, "https://example.invalid/one");

    native.setState(
      0,
      {
        addressValue: "in-progress search",
        editableAddressValue: "private draft that must not win",
        proxyState: "invalid",
      },
      { event: "state" },
    );
    snapshot = pair.controller.navigation.snapshot();
    assert.equal(snapshot.addressValue, "https://example.invalid/one");
    assert.equal(snapshot.editableAddressValue, "https://example.invalid/one");

    native.setState(
      0,
      {
        addressValue: "bounded.invalid",
        editableAddressValue: "e".repeat(4_200),
        proxyState: "valid",
      },
      { event: "state" },
    );
    assert.equal(
      pair.controller.navigation.snapshot().editableAddressValue.length,
      4_096,
    );

    native.setState(0, {
      addressValue: "must-not-display",
      displayUri: "about:home",
      editableAddressValue: "must-not-edit",
    });
    snapshot = pair.controller.navigation.snapshot();
    assert.equal(snapshot.addressValue, "");
    assert.equal(snapshot.editableAddressValue, "");
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
    assert.equal(pair.controller.navigation.home(), true);
    assert.equal(pair.controller.navigation.newTab(), true);

    assert.deepEqual(native.actionCalls, [
      ["back", "browser-2"],
      ["stop", "browser-2"],
      ["reload", "browser-2"],
      ["home", "browser-2"],
      ["new-tab", "browser-2"],
    ]);
    assert.equal(
      pair.controller.navigation.snapshot().displayUri,
      "about:newtab",
    );
    assert.equal(pair.controller.navigation.snapshot().addressValue, "");
    assert.equal(
      pair.controller.navigation.snapshot().editableAddressValue,
      "",
    );
  } finally {
    disposePair(pair);
  }
});

test("middle-click gestures reach Firefox command methods without inventing URLs", () => {
  const native = createNativeWindow();
  const pair = createController(native);
  const middleClick = Object.freeze({
    altKey: false,
    button: 1,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
  });
  try {
    native.setState(0, { canGoBack: true, canGoForward: true });
    assert.equal(pair.controller.navigation.back(middleClick), true);
    assert.equal(pair.controller.navigation.forward(middleClick), true);
    assert.equal(pair.controller.navigation.home(middleClick), true);
    assert.equal(pair.controller.navigation.reload(middleClick), true);
    assert.deepEqual(
      native.actionGestures.map(([name, event]) => [
        name,
        event?.button,
        event?.ctrlKey,
      ]),
      [
        ["back", 1, false],
        ["forward", 1, false],
        ["home", 1, false],
        ["reload-or-duplicate", 1, false],
      ],
    );
    assert.deepEqual(native.actionCalls.at(-1), [
      "reload-or-duplicate",
      "browser-1",
    ]);
    assert.doesNotMatch(
      JSON.stringify(native.actionGestures),
      /https?:|about:/u,
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

test("address submission delegates bounded current-tab text to native Urlbar semantics", () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    assert.deepEqual(
      pair.controller.navigation.submitAddress("example.invalid/path"),
      { status: "accepted" },
    );
    assert.deepEqual(native.addressSubmissions, [
      { browserId: "browser-1", value: "example.invalid/path" },
    ]);
    assert.equal(
      pair.controller.navigation.snapshot().addressValue,
      "example.invalid/one",
    );

    assert.deepEqual(pair.controller.navigation.submitAddress("   "), {
      reason: "empty",
      status: "rejected",
    });
    assert.deepEqual(
      pair.controller.navigation.submitAddress("x".repeat(4_097)),
      { reason: "too-long", status: "rejected" },
    );
    for (const value of [
      "javascript:document.body.textContent='unsafe'",
      " DATA : text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
    ]) {
      assert.deepEqual(pair.controller.navigation.submitAddress(value), {
        reason: "unsafe-scheme",
        status: "rejected",
      });
    }
    assert.equal(native.addressSubmissions.length, 1);
  } finally {
    disposePair(pair);
  }
});

test("Ctrl+L command redirects only after health and successful custom focus", () => {
  const native = createNativeWindow();
  const pair = createController(native);
  const requests = [];
  const unsubscribe = pair.controller.navigation.subscribeAddressPopupOpen(
    (request) => {
      requests.push(request);
      return true;
    },
  );
  try {
    assert.deepEqual(native.dispatchOpenLocation(), {
      prevented: false,
      stopped: false,
    });
    native.setHealthy(true);
    assert.deepEqual(native.dispatchOpenLocation("focusURLBar2"), {
      prevented: false,
      stopped: false,
    });
    assert.deepEqual(native.dispatchOpenLocation(null), {
      prevented: false,
      stopped: false,
    });
    assert.equal(requests.length, 0);

    assert.deepEqual(native.dispatchOpenLocation(), {
      prevented: true,
      stopped: true,
    });
    assert.deepEqual(requests, [
      {
        selectAll: true,
        source: "ctrl-l",
        type: "address-popup-open",
      },
    ]);
    assert.ok(Object.isFrozen(requests[0]));

    assert.equal(unsubscribe(), true);
    pair.controller.navigation.subscribeAddressPopupOpen(() => false);
    assert.deepEqual(native.dispatchOpenLocation(), {
      prevented: false,
      stopped: false,
    });
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
  assert.equal(native.openLocationListenerCount(), 1);
  assert.equal(native.urlbarListenerCount(), 0);

  assert.equal(pair.controller.dispose(), true);
  assert.equal(pair.controller.dispose(), false);
  assert.equal(native.tabContainer.listenerCount(), 0);
  assert.equal(native.progressListenerCount(), 0);
  assert.equal(native.observerCount(), 0);
  assert.equal(native.openLocationListenerCount(), 0);
  assert.equal(native.urlbarListenerCount(), 0);
  native.setState(0, { loading: true, title: "After dispose" });
  assert.equal(callbackCount, 0);
  assert.deepEqual(pair.controller.snapshot(), {
    addressPopupSubscriberCount: 0,
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

test("missing native Urlbar submission capability fails before listeners attach", () => {
  const native = createNativeWindow();
  native.window.gURLBar.handleCommand = undefined;
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260810162159",
    contextId: "window-00000000-0000-4000-8000-999999999996",
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
        error.fenneviaSymbol === "window.gURLBar.handleCommand",
    );
    assert.equal(native.tabContainer.listenerCount(), 0);
    assert.equal(native.openLocationListenerCount(), 0);
    assert.equal(native.urlbarListenerCount(), 0);
  } finally {
    boundary.dispose();
  }
});

test("missing native Urlbar editing value fails before listeners attach", () => {
  const native = createNativeWindow();
  Object.defineProperty(native.window.gURLBar, "untrimmedValue", {
    configurable: true,
    value: undefined,
  });
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260810162159",
    contextId: "window-00000000-0000-4000-8000-999999999994",
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
        error.fenneviaSymbol === "window.gURLBar.untrimmedValue",
    );
    assert.equal(native.tabContainer.listenerCount(), 0);
    assert.equal(native.openLocationListenerCount(), 0);
    assert.equal(native.urlbarListenerCount(), 0);
  } finally {
    boundary.dispose();
  }
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

test("missing BrowserCommands.home identifies the exact action boundary", () => {
  const native = createNativeWindow();
  native.window.BrowserCommands.home = undefined;
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260810162159",
    contextId: "window-00000000-0000-4000-8000-999999999996",
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
        error.fenneviaSymbol === "window.BrowserCommands.home",
    );
    assert.equal(native.tabContainer.listenerCount(), 0);
    assert.equal(native.progressListenerCount(), 0);
    assert.equal(native.observerCount(), 0);
  } finally {
    boundary.dispose();
  }
});

test("missing BrowserCommands.reloadOrDuplicate identifies the exact action boundary", () => {
  const native = createNativeWindow();
  native.window.BrowserCommands.reloadOrDuplicate = undefined;
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260810162159",
    contextId: "window-00000000-0000-4000-8000-999999999995",
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
        error.fenneviaSymbol === "window.BrowserCommands.reloadOrDuplicate",
    );
    assert.equal(native.tabContainer.listenerCount(), 0);
    assert.equal(native.progressListenerCount(), 0);
    assert.equal(native.observerCount(), 0);
  } finally {
    boundary.dispose();
  }
});
