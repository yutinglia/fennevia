import assert from "node:assert/strict";
import test from "node:test";

import {
  createFirefoxBridgeBoundary,
  isFirefoxBridgeError,
} from "../src/firefox/bridge-boundary.ts";
import {
  createFirefoxTabDragCoordinator,
  createFirefoxTabsBridge,
} from "../src/firefox/tabs.ts";

const BROWSER_URI = "chrome://browser/content/browser.xhtml";
let nextContextSequence = 0;
let nextDragSequence = 0;
const nativeTabOwners = new WeakMap();

function createTestDragCoordinator() {
  return createFirefoxTabDragCoordinator({
    createToken() {
      nextDragSequence += 1;
      return `tab-transfer-${String(nextDragSequence).padStart(8, "0")}`;
    },
  });
}

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
    listenerCount() {
      return listeners.length;
    },
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

function createTab(label, attributes = {}) {
  const values = new Map(Object.entries({ label, ...attributes }));
  const classes = new Set();
  return {
    classList: {
      add(...tokens) {
        for (const token of tokens) {
          classes.add(token);
        }
      },
      contains(token) {
        return classes.has(token);
      },
      remove(...tokens) {
        for (const token of tokens) {
          classes.delete(token);
        }
      },
    },
    closing: false,
    getAttribute(name) {
      return values.get(name) ?? "";
    },
    hasAttribute(name) {
      return values.has(name);
    },
    removeAttribute(name) {
      values.delete(name);
    },
    setAttribute(name, value) {
      values.set(name, String(value));
    },
    toggleMuteAudio() {
      if (values.has("muted")) {
        values.delete("muted");
        return;
      }
      values.set("muted", "true");
      values.delete("soundplaying");
    },
    get userContextId() {
      return values.has("usercontextid")
        ? Number.parseInt(values.get("usercontextid"), 10)
        : 0;
    },
  };
}

function createNativeWindow({ privateWindow = false } = {}) {
  const tabContainer = createEventTarget();
  const gBrowserEvents = createEventTarget();
  const tabs = [
    createTab("First", {
      image: "chrome://branding/content/icon32.png",
    }),
    createTab("Second", {
      image: "data:image/svg+xml,<svg></svg>",
    }),
  ];
  let selectedTab = tabs[0];
  let openTabsReads = 0;
  const actionCalls = [];
  const selectedBrowser = { webNavigation: {} };
  const gBrowser = {
    ...gBrowserEvents,
    actionCalls,
    addTrustedTab(uri, options) {
      options.triggeringPrincipal ??= { testPrincipal: true };
      actionCalls.push(["addTrustedTab", uri, options]);
      const tab = createTab("New Tab");
      tabs.push(tab);
      nativeTabOwners.set(tab, { gBrowser: this, tabContainer, tabs });
      tabContainer.dispatch("TabOpen", tab, {});
      if (!options?.inBackground) {
        this.selectedTab = tab;
      }
      return tab;
    },
    adoptTab(tab, options) {
      actionCalls.push(["adoptTab", tab, options]);
      const source = nativeTabOwners.get(tab);
      if (!source || source.gBrowser === this) {
        return null;
      }
      const sourceIndex = source.tabs.indexOf(tab);
      if (sourceIndex < 0) {
        return null;
      }
      source.tabs.splice(sourceIndex, 1);
      source.tabContainer.dispatch("TabClose", tab, {});
      const targetIndex = Math.min(Math.max(options.tabIndex, 0), tabs.length);
      tabs.splice(targetIndex, 0, tab);
      nativeTabOwners.set(tab, { gBrowser: this, tabContainer, tabs });
      tabContainer.dispatch("TabOpen", tab, {});
      if (options.selectTab) {
        this.selectedTab = tab;
      }
      return tab;
    },
    moveNativeTab(tab, index) {
      const oldIndex = tabs.indexOf(tab);
      tabs.splice(oldIndex, 1);
      tabs.splice(index, 0, tab);
      tabContainer.dispatch("TabMove", tab, {
        currentIndex: index,
        previousIndex: oldIndex,
      });
    },
    moveTabTo(tab, options) {
      actionCalls.push(["moveTabTo", tab, options]);
      this.moveNativeTab(tab, options.tabIndex);
    },
    pinTab(tab) {
      actionCalls.push(["pinTab", tab]);
      if (tab.hasAttribute("pinned")) {
        return;
      }
      tab.setAttribute("pinned", "true");
      const oldIndex = tabs.indexOf(tab);
      tabs.splice(oldIndex, 1);
      const pinnedCount = tabs.filter((candidate) =>
        candidate.hasAttribute("pinned"),
      ).length;
      tabs.splice(pinnedCount, 0, tab);
      tabContainer.dispatch("TabMove", tab, {});
      tabContainer.dispatch("TabPinned", tab, {});
    },
    removeTab(tab, options) {
      options.skipPermitUnload ??= false;
      actionCalls.push(["removeTab", tab, options]);
      const index = tabs.indexOf(tab);
      if (index === -1 || tab.blockClose) {
        return;
      }
      if (tabs.length === 1) {
        this.addTrustedTab("about:newtab", { inBackground: true });
      }
      if (selectedTab === tab) {
        this.selectedTab =
          tabs[index + 1] ??
          tabs[index - 1] ??
          tabs.find((item) => item !== tab);
      }
      tab.closing = true;
      tabContainer.dispatch("TabClose", tab, {});
      tabs.splice(tabs.indexOf(tab), 1);
    },
    replaceTabWithWindow(tab, options) {
      actionCalls.push(["replaceTabWithWindow", tab, options]);
      const index = tabs.indexOf(tab);
      if (index < 0 || tabs.length === 1) {
        return null;
      }
      tabs.splice(index, 1);
      tabContainer.dispatch("TabClose", tab, {});
      nativeTabOwners.delete(tab);
      return { detachedTab: tab };
    },
    selectedBrowser,
    tabContainer,
    translateTabContextMenu() {
      actionCalls.push(["translateTabContextMenu"]);
      tabContextMenu.translated = true;
    },
    unpinTab(tab) {
      actionCalls.push(["unpinTab", tab]);
      if (!tab.hasAttribute("pinned")) {
        return;
      }
      tab.removeAttribute("pinned");
      const oldIndex = tabs.indexOf(tab);
      tabs.splice(oldIndex, 1);
      const pinnedCount = tabs.filter((candidate) =>
        candidate.hasAttribute("pinned"),
      ).length;
      tabs.splice(pinnedCount, 0, tab);
      tabContainer.dispatch("TabMove", tab, {});
      tabContainer.dispatch("TabUnpinned", tab, {});
    },
    updateAttribute(tab, name, value) {
      if (value === undefined) {
        tab.removeAttribute(name);
      } else {
        tab.setAttribute(name, value);
      }
      tabContainer.dispatch("TabAttrModified", tab, { changed: [name] });
    },
  };
  Object.defineProperties(gBrowser, {
    openTabs: {
      configurable: true,
      get() {
        openTabsReads += 1;
        return tabs.filter((tab) => !tab.closing);
      },
    },
    selectedTab: {
      configurable: true,
      get() {
        return selectedTab;
      },
      set(tab) {
        const previousTab = selectedTab;
        selectedTab = tab;
        if (tab && tab !== previousTab) {
          tabContainer.dispatch("TabSelect", tab, { previousTab });
        }
      },
    },
    tabs: {
      configurable: true,
      get() {
        return tabs.slice();
      },
    },
  });
  for (const tab of tabs) {
    nativeTabOwners.set(tab, { gBrowser, tabContainer, tabs });
  }

  const tabContextMenu = {
    ...createEventTarget(),
    hidePopup() {
      this.dispatch("popuphidden", this);
    },
    id: "tabContextMenu",
    moveTo(screenX, screenY) {
      actionCalls.push(["moveTabContextMenu"]);
      this.lastMoveTo = [screenX, screenY];
    },
    openPopup(triggerNode, position, x, y, isContextMenu) {
      actionCalls.push(["openTabContextMenu"]);
      this.lastOpenPopup = [triggerNode, position, x, y, isContextMenu];
      this.triggerNode = triggerNode;
      this.dispatch("popupshown", this);
    },
  };
  const window = {
    BROWSER_NEW_TAB_URL: privateWindow
      ? "about:privatebrowsing"
      : "about:newtab",
    document: {
      defaultView: null,
      documentURI: BROWSER_URI,
      getElementById(id) {
        return id === "tabContextMenu" ? tabContextMenu : null;
      },
    },
    gBrowser,
  };
  window.document.defaultView = window;
  return {
    gBrowser,
    getOpenTabsReadCount: () => openTabsReads,
    tabContainer,
    tabContextMenu,
    tabs,
    window,
  };
}

function createController(
  native,
  errors = [],
  moduleLoader,
  handoffOverrides = {},
  dragOptions = {},
) {
  const contextId = `window-00000000-0000-4000-8000-${String(
    ++nextContextSequence,
  ).padStart(12, "0")}`;
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260810162159",
    contextId,
    firefoxVersion: "153.0.4",
    window: native.window,
    windowKind: native.window.BROWSER_NEW_TAB_URL.includes("private")
      ? "private"
      : "normal",
  });
  const handoffCalls = [];
  const dragCoordinator =
    dragOptions.dragCoordinator ?? createTestDragCoordinator();
  const controller = createFirefoxTabsBridge({
    beginNativePopupHandoff(panelId) {
      handoffCalls.push(["begin", panelId]);
      return handoffOverrides.begin?.(panelId) ?? true;
    },
    boundary,
    dragCoordinator,
    endNativePopupHandoff(panelId) {
      handoffCalls.push(["end", panelId]);
      handoffOverrides.end?.(panelId);
    },
    isTabDetachAllowed() {
      return dragOptions.detachAllowed ?? true;
    },
    ...(moduleLoader === undefined ? {} : { moduleLoader }),
    onError(error) {
      errors.push(error);
    },
    window: native.window,
  });
  return { boundary, controller, dragCoordinator, handoffCalls };
}

function disposePair(pair) {
  pair.controller.dispose();
  pair.boundary.dispose();
}

test("initial snapshots preserve native order with stable opaque IDs and safe fields", () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    const snapshot = pair.controller.tabs.snapshot();
    assert.deepEqual(
      snapshot.map(({ faviconUrl, loading, pinned, selected, title }) => ({
        faviconUrl,
        loading,
        pinned,
        selected,
        title,
      })),
      [
        {
          faviconUrl: "chrome://branding/content/icon32.png",
          loading: false,
          pinned: false,
          selected: true,
          title: "First",
        },
        {
          faviconUrl: undefined,
          loading: false,
          pinned: false,
          selected: false,
          title: "Second",
        },
      ],
    );
    assert.ok(snapshot.every(Object.isFrozen));
    assert.ok(Object.isFrozen(snapshot));
    assert.equal(new Set(snapshot.map((tab) => tab.id)).size, 2);
    assert.doesNotMatch(
      JSON.stringify(snapshot),
      /gBrowser|closing|blockClose/u,
    );
    assert.ok(
      pair.controller
        .assertRequiredCapabilities()
        .every((capability) => capability.available),
    );
  } finally {
    disposePair(pair);
  }
});

test("native events synchronize title, favicon fallback, loading, selection, pinning, and order", () => {
  const native = createNativeWindow();
  const pair = createController(native);
  const events = [];
  try {
    pair.controller.tabs.subscribe((event) => events.push(event));
    const initial = pair.controller.tabs.snapshot();
    const firstId = initial[0].id;
    const secondId = initial[1].id;
    const secondNativeTab = native.tabs[1];
    const readsBeforeIrrelevantEvent = native.getOpenTabsReadCount();

    native.gBrowser.updateAttribute(native.tabs[0], "fadein", "true");
    assert.equal(native.getOpenTabsReadCount(), readsBeforeIrrelevantEvent);
    native.tabContainer.dispatch("TabAttrModified", native.tabs[0], {
      changed: [42],
    });
    assert.ok(native.getOpenTabsReadCount() > readsBeforeIrrelevantEvent);
    native.gBrowser.updateAttribute(native.tabs[0], "label", "Renamed");
    native.gBrowser.updateAttribute(
      native.tabs[0],
      "image",
      "data:image/png;base64,AA==",
    );
    native.gBrowser.updateAttribute(native.tabs[0], "busy", "true");
    native.gBrowser.selectedTab = secondNativeTab;
    native.gBrowser.moveNativeTab(secondNativeTab, 0);
    native.gBrowser.pinTab(secondNativeTab);

    const updated = pair.controller.tabs.snapshot();
    assert.deepEqual(
      updated.map((tab) => tab.id),
      [secondId, firstId],
    );
    assert.equal(updated[0].selected, true);
    assert.equal(updated[0].pinned, true);
    assert.equal(updated[1].title, "Renamed");
    assert.equal(updated[1].loading, true);
    assert.equal(updated[1].faviconUrl, "data:image/png;base64,AA==");
    assert.ok(events.length >= 6);
    assert.ok(events.every(Object.isFrozen));
    assert.ok(
      events.every(
        (event) => event.type === "snapshot" && Object.isFrozen(event.tabs),
      ),
    );
  } finally {
    disposePair(pair);
  }
});

test("malformed native attribute details enter the typed event-failure path", () => {
  const native = createNativeWindow();
  const errors = [];
  const pair = createController(native, errors);
  try {
    const detail = {};
    Object.defineProperty(detail, "changed", {
      get() {
        throw new Error("private event value C:\\private");
      },
    });

    assert.doesNotThrow(() => {
      native.tabContainer.dispatch("TabAttrModified", native.tabs[0], detail);
    });
    assert.equal(pair.controller.snapshot().failed, true);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].fenneviaCode, "FENNEVIA_FIREFOX_TABS_EVENT_FAILED");
    assert.equal(errors[0].fenneviaPhase, "firefox-tabs-event");
    assert.equal(
      errors[0].fenneviaSymbol,
      "window.gBrowser.tabContainer.TabAttrModified",
    );
    assert.doesNotMatch(
      `${errors[0].message}${JSON.stringify(errors[0])}`,
      /private|[A-Za-z]:\\/u,
    );
  } finally {
    disposePair(pair);
  }
});

test("bridge actions synchronize both directions and reject stale or foreign IDs", () => {
  const firstNative = createNativeWindow();
  const secondNative = createNativeWindow({ privateWindow: true });
  const first = createController(firstNative);
  const second = createController(secondNative);
  try {
    const foreignId = second.controller.tabs.snapshot()[0].id;
    assert.throws(
      () => first.controller.tabs.select(foreignId),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_HANDLE_CONTEXT_MISMATCH",
    );

    const openedId = first.controller.tabs.open({ selected: false });
    assert.equal(first.controller.tabs.snapshot().at(-1).id, openedId);
    assert.equal(firstNative.gBrowser.actionCalls.at(-1)[2].inBackground, true);
    assert.equal(
      firstNative.gBrowser.actionCalls.at(-1)[2].relatedToCurrent,
      undefined,
    );
    assert.equal(
      firstNative.gBrowser.actionCalls.at(-1)[2].triggeringPrincipal
        .testPrincipal,
      true,
    );
    assert.equal(
      Object.isFrozen(firstNative.gBrowser.actionCalls.at(-1)[2]),
      false,
    );
    first.controller.tabs.select(openedId);
    assert.equal(
      first.controller.tabs.snapshot().find((tab) => tab.id === openedId)
        .selected,
      true,
    );
    first.controller.tabs.pin(openedId);
    assert.equal(first.controller.tabs.snapshot()[0].id, openedId);
    assert.equal(first.controller.tabs.snapshot()[0].pinned, true);
    first.controller.tabs.unpin(openedId);
    assert.equal(
      first.controller.tabs.snapshot().find((tab) => tab.id === openedId)
        .pinned,
      false,
    );
    first.controller.tabs.close(openedId);
    const removeCall = firstNative.gBrowser.actionCalls.findLast(
      ([action]) => action === "removeTab",
    );
    assert.equal(removeCall[2].skipPermitUnload, false);
    assert.equal(Object.isFrozen(removeCall[2]), false);
    assert.equal(
      first.controller.tabs.snapshot().some((tab) => tab.id === openedId),
      false,
    );
    assert.throws(
      () => first.controller.tabs.close(openedId),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_HANDLE_STALE",
    );
  } finally {
    disposePair(first);
    disposePair(second);
  }
});

test("relatedToCurrent reaches addTrustedTab and invalid open options fail closed", () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    const relatedId = pair.controller.tabs.open({
      relatedToCurrent: true,
      selected: true,
    });
    const relatedCall = native.gBrowser.actionCalls.findLast(
      ([action]) => action === "addTrustedTab",
    );
    assert.equal(pair.controller.tabs.snapshot().at(-1).id, relatedId);
    assert.equal(relatedCall[2].inBackground, false);
    assert.equal(relatedCall[2].relatedToCurrent, true);
    assert.equal(Object.isFrozen(relatedCall[2]), false);

    const backgroundRelatedId = pair.controller.tabs.open({
      relatedToCurrent: true,
      selected: false,
    });
    const backgroundCall = native.gBrowser.actionCalls.findLast(
      ([action]) => action === "addTrustedTab",
    );
    assert.equal(
      pair.controller.tabs.snapshot().at(-1).id,
      backgroundRelatedId,
    );
    assert.equal(backgroundCall[2].inBackground, true);
    assert.equal(backgroundCall[2].relatedToCurrent, true);

    const defaultId = pair.controller.tabs.open();
    const defaultCall = native.gBrowser.actionCalls.findLast(
      ([action]) => action === "addTrustedTab",
    );
    assert.equal(pair.controller.tabs.snapshot().at(-1).id, defaultId);
    assert.equal(defaultCall[2].inBackground, false);
    assert.equal(defaultCall[2].relatedToCurrent, undefined);

    assert.throws(
      () => pair.controller.tabs.open({ selected: "yes" }),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_TAB_OPEN_OPTIONS_INVALID" &&
        error.fenneviaPhase === "firefox-tabs-action" &&
        error.fenneviaSymbol === "tabs.open.options",
    );
    assert.throws(
      () => pair.controller.tabs.open({ relatedToCurrent: 1 }),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_TAB_OPEN_OPTIONS_INVALID",
    );
    assert.throws(
      () =>
        pair.controller.tabs.open({
          relatedToCurrent: true,
          selected: true,
          url: "about:newtab",
        }),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_TAB_OPEN_OPTIONS_INVALID",
    );
  } finally {
    disposePair(pair);
  }
});

test("selected close, last-tab replacement, and rapid lifecycle remain ordered", () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    const [first, second] = pair.controller.tabs.snapshot();
    pair.controller.tabs.close(first.id);
    let snapshot = pair.controller.tabs.snapshot();
    assert.deepEqual(
      snapshot.map((tab) => tab.id),
      [second.id],
    );
    assert.equal(snapshot[0].selected, true);

    const replacementId = pair.controller.tabs.open();
    pair.controller.tabs.close(replacementId);
    pair.controller.tabs.close(second.id);
    snapshot = pair.controller.tabs.snapshot();
    assert.equal(snapshot.length, 1);
    assert.equal(snapshot[0].selected, true);
    assert.notEqual(snapshot[0].id, replacementId);
    assert.notEqual(snapshot[0].id, second.id);
  } finally {
    disposePair(pair);
  }
});

test("disposal removes listeners, clears mappings, and prevents callbacks", () => {
  const native = createNativeWindow();
  const pair = createController(native);
  let callbackCount = 0;
  const staleId = pair.controller.tabs.snapshot()[0].id;
  pair.controller.tabs.subscribe(() => {
    callbackCount += 1;
  });
  assert.equal(native.tabContainer.listenerCount(), 8);
  assert.equal(native.gBrowser.listenerCount(), 2);
  assert.equal(native.tabContextMenu.listenerCount(), 2);

  assert.equal(pair.controller.dispose(), true);
  assert.equal(pair.controller.dispose(), false);
  assert.equal(native.tabContainer.listenerCount(), 0);
  assert.equal(native.gBrowser.listenerCount(), 0);
  assert.equal(native.tabContextMenu.listenerCount(), 0);
  native.gBrowser.updateAttribute(native.tabs[0], "label", "After dispose");
  assert.equal(callbackCount, 0);
  assert.deepEqual(pair.controller.snapshot(), {
    disposed: true,
    failed: false,
    revision: 1,
    subscriberCount: 0,
    tabCount: 0,
  });
  assert.throws(
    () => pair.controller.tabs.select(staleId),
    /FENNEVIA_FIREFOX_TABS_DISPOSED/u,
  );
  pair.boundary.dispose();
});

test("missing required tabs capabilities fail with typed current-build diagnostics", () => {
  const native = createNativeWindow();
  native.gBrowser.unpinTab = undefined;
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260810162159",
    contextId: "window-00000000-0000-4000-8000-999999999999",
    firefoxVersion: "153.0.4",
    window: native.window,
    windowKind: "normal",
  });
  try {
    assert.throws(
      () =>
        createFirefoxTabsBridge({
          beginNativePopupHandoff() {
            return true;
          },
          boundary,
          dragCoordinator: createTestDragCoordinator(),
          endNativePopupHandoff() {},
          isTabDetachAllowed() {
            return true;
          },
          onError() {},
          window: native.window,
        }),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING" &&
        error.fenneviaSymbol === "window.gBrowser.unpinTab" &&
        error.fenneviaBuildId === "20260810162159",
    );
  } finally {
    boundary.dispose();
  }
});

test("missing tab context-menu translation fails before the native popup opens", () => {
  const native = createNativeWindow();
  native.gBrowser.translateTabContextMenu = undefined;
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260810162159",
    contextId: "window-00000000-0000-4000-8000-888888888888",
    firefoxVersion: "153.0.4",
    window: native.window,
    windowKind: "normal",
  });
  try {
    assert.throws(
      () =>
        createFirefoxTabsBridge({
          beginNativePopupHandoff() {
            return true;
          },
          boundary,
          dragCoordinator: createTestDragCoordinator(),
          endNativePopupHandoff() {},
          isTabDetachAllowed() {
            return true;
          },
          onError() {},
          window: native.window,
        }),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING" &&
        error.fenneviaSymbol === "window.gBrowser.translateTabContextMenu" &&
        error.fenneviaBuildId === "20260810162159",
    );
    assert.equal(
      native.gBrowser.actionCalls.some(
        ([action]) => action === "openTabContextMenu",
      ),
      false,
    );
  } finally {
    boundary.dispose();
  }
});

test("subscriber failures are reported without exposing tab data or blocking peers", () => {
  const native = createNativeWindow();
  const errors = [];
  const pair = createController(native, errors);
  let healthySubscriberCount = 0;
  try {
    pair.controller.tabs.subscribe(() => {
      throw new Error("private title and local path C:\\private");
    });
    pair.controller.tabs.subscribe(() => {
      healthySubscriberCount += 1;
    });
    native.gBrowser.updateAttribute(native.tabs[0], "label", "Secret title");

    assert.equal(healthySubscriberCount, 1);
    assert.equal(errors.length, 1);
    assert.equal(
      errors[0].fenneviaCode,
      "FENNEVIA_FIREFOX_TABS_SUBSCRIBER_FAILED",
    );
    assert.equal(JSON.stringify(errors[0]), "{}");
    assert.doesNotMatch(
      `${errors[0].message}${JSON.stringify(errors[0])}`,
      /Secret title|private|[A-Za-z]:\\/u,
    );
  } finally {
    disposePair(pair);
  }
});

test("audio, sharing, crash, picture-in-picture, and container fields reconcile from native attributes", () => {
  const identities = new Map([
    [1, { color: "blue", name: "Personal" }],
    [2, { color: "turquoise", name: "Work" }],
  ]);
  const native = createNativeWindow();
  const pair = createController(native, [], (uri) => {
    assert.equal(
      uri,
      "resource://gre/modules/ContextualIdentityService.sys.mjs",
    );
    return {
      ContextualIdentityService: {
        getPublicIdentityFromId(userContextId) {
          return identities.get(userContextId) ?? null;
        },
      },
    };
  });
  try {
    native.gBrowser.updateAttribute(native.tabs[0], "soundplaying", "true");
    native.gBrowser.updateAttribute(native.tabs[0], "attention", "true");
    native.gBrowser.updateAttribute(native.tabs[0], "pictureinpicture", "true");
    native.gBrowser.updateAttribute(native.tabs[0], "sharing", "microphone");
    native.gBrowser.updateAttribute(native.tabs[0], "usercontextid", "1");
    native.tabs[0].setAttribute("crashed", "true");
    native.gBrowser.dispatch("oop-browser-crashed", native.tabs[0], {
      isTopFrame: true,
    });
    let snapshot = pair.controller.tabs.snapshot();
    assert.equal(snapshot[0].audio, "playing");
    assert.equal(snapshot[0].attention, true);
    assert.equal(snapshot[0].crashed, true);
    assert.equal(snapshot[0].pictureInPicture, true);
    assert.equal(snapshot[0].sharing, "microphone");
    assert.deepEqual(snapshot[0].container, {
      color: "blue",
      label: "Personal",
    });

    native.tabs[0].removeAttribute("crashed");
    native.tabContainer.dispatch("TabRemotenessChange", native.tabs[0], {});
    assert.equal(pair.controller.tabs.snapshot()[0].crashed, undefined);

    native.gBrowser.updateAttribute(native.tabs[0], "muted", "true");
    snapshot = pair.controller.tabs.snapshot();
    assert.equal(snapshot[0].audio, "muted");

    native.tabs[0].removeAttribute("muted");
    native.tabs[0].removeAttribute("soundplaying");
    native.gBrowser.updateAttribute(
      native.tabs[0],
      "activemedia-blocked",
      "true",
    );
    snapshot = pair.controller.tabs.snapshot();
    assert.equal(snapshot[0].audio, "blocked");

    native.gBrowser.updateAttribute(native.tabs[0], "sharing", "camera");
    assert.equal(pair.controller.tabs.snapshot()[0].sharing, "camera");
    native.gBrowser.updateAttribute(native.tabs[0], "sharing", "screen");
    assert.equal(pair.controller.tabs.snapshot()[0].sharing, "screen");
    native.gBrowser.updateAttribute(native.tabs[0], "sharing", "unknown");
    assert.equal(pair.controller.tabs.snapshot()[0].sharing, undefined);

    native.gBrowser.updateAttribute(native.tabs[1], "usercontextid", "2");
    snapshot = pair.controller.tabs.snapshot();
    assert.equal(snapshot[1].container.color, "cyan");
    assert.equal(snapshot[1].container.label, "Work");
    assert.doesNotMatch(
      JSON.stringify(snapshot),
      /userContextId|usercontextid/u,
    );
  } finally {
    disposePair(pair);
  }
});

test("native identity classes preserve container color when the optional label service fails", () => {
  const native = createNativeWindow();
  native.tabs[0].setAttribute("usercontextid", "1");
  native.tabs[0].classList.add("identity-color-blue");
  const pair = createController(native, [], () => {
    throw new Error("identity module missing");
  });
  try {
    const snapshot = pair.controller.tabs.snapshot();
    assert.deepEqual(snapshot[0].container, {
      color: "blue",
      label: "Container",
    });
    assert.ok(
      pair.controller
        .assertRequiredCapabilities()
        .every((capability) => capability.available),
    );
  } finally {
    disposePair(pair);
  }
});

test("container state stays omitted when neither service nor native color class is available", () => {
  const native = createNativeWindow();
  native.tabs[0].setAttribute("usercontextid", "1");
  const pair = createController(native, [], () => {
    throw new Error("identity module missing");
  });
  try {
    assert.equal(pair.controller.tabs.snapshot()[0].container, undefined);
  } finally {
    disposePair(pair);
  }
});

test("move, mute, and native context-menu handoff stay inside the bridge", () => {
  const native = createNativeWindow();
  const errors = [];
  const pair = createController(native, errors);
  const events = [];
  try {
    pair.controller.tabs.subscribe((event) => events.push(event));
    const [firstId, secondId] = pair.controller.tabs
      .snapshot()
      .map((tab) => tab.id);
    pair.controller.tabs.move(secondId, 0);
    assert.equal(pair.controller.tabs.snapshot()[0].id, secondId);
    assert.equal(native.gBrowser.actionCalls.at(-1)[0], "moveTabTo");
    assert.equal(native.gBrowser.actionCalls.at(-1)[2].isUserTriggered, true);
    assert.equal(native.gBrowser.actionCalls.at(-1)[2].tabIndex, 0);

    native.gBrowser.updateAttribute(native.tabs[0], "soundplaying", "true");
    pair.controller.tabs.toggleMute(secondId);
    assert.equal(pair.controller.tabs.snapshot()[0].audio, "muted");

    pair.controller.tabs.openContextMenu(firstId, { screenX: 24, screenY: 48 });
    assert.equal(native.tabContextMenu.translated, true);
    assert.equal(native.tabContextMenu.triggerNode, native.tabs[1]);
    assert.deepEqual(native.tabContextMenu.lastMoveTo, [24, 48]);
    assert.deepEqual(
      native.gBrowser.actionCalls.slice(-3).map((call) => call[0]),
      ["translateTabContextMenu", "openTabContextMenu", "moveTabContextMenu"],
    );
    assert.deepEqual(pair.handoffCalls, [["begin", "tabContextMenu"]]);
    assert.deepEqual(
      events
        .filter((event) => event.type === "context-menu")
        .map((event) => event.open),
      [true],
    );

    native.tabContextMenu.hidePopup();
    assert.deepEqual(pair.handoffCalls, [
      ["begin", "tabContextMenu"],
      ["end", "tabContextMenu"],
    ]);
    assert.deepEqual(
      events
        .filter((event) => event.type === "context-menu")
        .map((event) => event.open),
      [true, false],
    );
    assert.equal(errors.length, 0);

    assert.throws(
      () => pair.controller.tabs.move(firstId, -1),
      /FENNEVIA_FIREFOX_TAB_MOVE_INDEX_INVALID/u,
    );
    assert.throws(
      () =>
        pair.controller.tabs.openContextMenu(firstId, {
          screenX: Number.NaN,
          screenY: 1,
        }),
      /FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_POINT_INVALID/u,
    );
  } finally {
    disposePair(pair);
  }
});

test("same-window tab drag reorders once and records the transfer as consumed", () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    const secondId = pair.controller.tabs.snapshot()[1].id;
    const dragId = pair.controller.tabs.beginDrag(secondId);
    assert.deepEqual(pair.controller.tabs.inspectDrag(), {
      id: dragId,
      pinned: false,
      source: "same-window",
    });
    assert.deepEqual(pair.controller.tabs.dropDrag(0), {
      index: 0,
      kind: "moved",
      tabId: secondId,
    });
    assert.equal(
      pair.controller.tabs.endDrag(dragId, {
        cancelled: false,
        screenX: 20,
        screenY: 30,
      }),
      "consumed",
    );
    assert.deepEqual(
      pair.controller.tabs.snapshot().map((tab) => tab.title),
      ["Second", "First"],
    );
  } finally {
    disposePair(pair);
  }
});

test("a shared drag coordinator adopts a tab into another same-kind window", () => {
  const coordinator = createTestDragCoordinator();
  const sourceNative = createNativeWindow();
  const targetNative = createNativeWindow();
  const sourcePair = createController(
    sourceNative,
    [],
    undefined,
    {},
    {
      dragCoordinator: coordinator,
    },
  );
  const targetPair = createController(
    targetNative,
    [],
    undefined,
    {},
    {
      dragCoordinator: coordinator,
    },
  );
  try {
    const sourceId = sourcePair.controller.tabs.snapshot()[1].id;
    const dragId = sourcePair.controller.tabs.beginDrag(sourceId);
    assert.deepEqual(targetPair.controller.tabs.inspectDrag(), {
      id: dragId,
      pinned: false,
      source: "other-window",
    });
    const result = targetPair.controller.tabs.dropDrag(2);
    assert.equal(result.kind, "adopted");
    assert.equal(result.index, 2);
    assert.notEqual(result.tabId, sourceId);
    assert.deepEqual(
      targetPair.controller.tabs.snapshot().map((tab) => tab.title),
      ["First", "Second", "Second"],
    );
    assert.equal(sourcePair.controller.tabs.snapshot().length, 1);
    assert.equal(
      sourcePair.controller.tabs.endDrag(dragId, {
        cancelled: false,
        screenX: 40,
        screenY: 50,
      }),
      "consumed",
    );
    assert.equal(
      sourceNative.gBrowser.actionCalls.some(
        ([action]) => action === "replaceTabWithWindow",
      ),
      false,
    );
  } finally {
    disposePair(targetPair);
    disposePair(sourcePair);
  }
});

test("normal and private windows cannot inspect or adopt each other's drag", () => {
  const coordinator = createTestDragCoordinator();
  const sourcePair = createController(
    createNativeWindow(),
    [],
    undefined,
    {},
    {
      dragCoordinator: coordinator,
    },
  );
  const privatePair = createController(
    createNativeWindow({ privateWindow: true }),
    [],
    undefined,
    {},
    { dragCoordinator: coordinator },
  );
  try {
    const sourceId = sourcePair.controller.tabs.snapshot()[0].id;
    const dragId = sourcePair.controller.tabs.beginDrag(sourceId);
    assert.equal(privatePair.controller.tabs.inspectDrag(), null);
    assert.throws(
      () => privatePair.controller.tabs.dropDrag(0),
      /FENNEVIA_FIREFOX_TAB_DRAG_UNAVAILABLE/u,
    );
    assert.equal(
      sourcePair.controller.tabs.endDrag(dragId, {
        cancelled: true,
        screenX: 0,
        screenY: 0,
      }),
      "cancelled",
    );
  } finally {
    disposePair(privatePair);
    disposePair(sourcePair);
  }
});

test("unhandled drag end detaches a tab while cancellation and policy keep it", () => {
  const native = createNativeWindow();
  const pair = createController(native);
  try {
    const firstId = pair.controller.tabs.snapshot()[0].id;
    const firstNativeTab = native.tabs[0];
    const cancelledId = pair.controller.tabs.beginDrag(firstId);
    assert.equal(
      pair.controller.tabs.endDrag(cancelledId, {
        cancelled: true,
        screenX: 200,
        screenY: 300,
      }),
      "cancelled",
    );
    assert.equal(
      native.gBrowser.actionCalls.some(
        ([action]) => action === "replaceTabWithWindow",
      ),
      false,
    );

    const detachedId = pair.controller.tabs.beginDrag(firstId);
    assert.equal(
      pair.controller.tabs.endDrag(detachedId, {
        cancelled: false,
        screenX: 200,
        screenY: 300,
      }),
      "detached",
    );
    assert.deepEqual(native.gBrowser.actionCalls.at(-1), [
      "replaceTabWithWindow",
      firstNativeTab,
      { screenX: 200, screenY: 300, suppressanimation: 1 },
    ]);
  } finally {
    disposePair(pair);
  }

  const blockedNative = createNativeWindow();
  const blockedPair = createController(
    blockedNative,
    [],
    undefined,
    {},
    { detachAllowed: false },
  );
  try {
    const tabId = blockedPair.controller.tabs.snapshot()[0].id;
    const dragId = blockedPair.controller.tabs.beginDrag(tabId);
    assert.equal(
      blockedPair.controller.tabs.endDrag(dragId, {
        cancelled: false,
        screenX: 20,
        screenY: 30,
      }),
      "blocked",
    );
    assert.equal(blockedNative.tabs.length, 2);
  } finally {
    disposePair(blockedPair);
  }
});

test("context-menu open failures and disposal release native UI handoffs", () => {
  const failedNative = createNativeWindow();
  failedNative.tabContextMenu.openPopup = () => {
    throw new Error("popup unavailable");
  };
  const failedPair = createController(failedNative);
  try {
    const tabId = failedPair.controller.tabs.snapshot()[0].id;
    assert.throws(
      () =>
        failedPair.controller.tabs.openContextMenu(tabId, {
          screenX: 10,
          screenY: 20,
        }),
      /FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_REJECTED/u,
    );
    assert.deepEqual(failedPair.handoffCalls, [
      ["begin", "tabContextMenu"],
      ["end", "tabContextMenu"],
    ]);
  } finally {
    disposePair(failedPair);
  }

  const openNative = createNativeWindow();
  const openPair = createController(openNative);
  const tabId = openPair.controller.tabs.snapshot()[0].id;
  openPair.controller.tabs.openContextMenu(tabId, {
    screenX: 10,
    screenY: 20,
  });
  assert.equal(openPair.controller.dispose(), true);
  assert.deepEqual(openPair.handoffCalls, [
    ["begin", "tabContextMenu"],
    ["end", "tabContextMenu"],
  ]);
  openPair.boundary.dispose();
});

test("a rejected native UI handoff prevents the tab context menu from opening", () => {
  const native = createNativeWindow();
  const pair = createController(native, [], undefined, {
    begin() {
      return false;
    },
  });
  try {
    const tabId = pair.controller.tabs.snapshot()[0].id;
    assert.throws(
      () =>
        pair.controller.tabs.openContextMenu(tabId, {
          screenX: 10,
          screenY: 20,
        }),
      /FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_HANDOFF_REJECTED/u,
    );
    assert.equal(native.tabContextMenu.triggerNode, undefined);
    assert.deepEqual(pair.handoffCalls, [["begin", "tabContextMenu"]]);
  } finally {
    disposePair(pair);
  }
});

test("missing moveTabTo fails health with a typed current-build diagnostic", () => {
  const native = createNativeWindow();
  native.gBrowser.moveTabTo = undefined;
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260810162159",
    contextId: "window-00000000-0000-4000-8000-888888888888",
    firefoxVersion: "153.0.4",
    window: native.window,
    windowKind: "normal",
  });
  try {
    assert.throws(
      () =>
        createFirefoxTabsBridge({
          beginNativePopupHandoff() {
            return true;
          },
          boundary,
          dragCoordinator: createTestDragCoordinator(),
          endNativePopupHandoff() {},
          isTabDetachAllowed() {
            return true;
          },
          onError() {},
          window: native.window,
        }),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING" &&
        error.fenneviaSymbol === "window.gBrowser.moveTabTo" &&
        error.fenneviaBuildId === "20260810162159",
    );
  } finally {
    boundary.dispose();
  }
});

test("missing cross-window tab APIs fail health at their exact symbols", () => {
  for (const methodName of ["adoptTab", "replaceTabWithWindow"]) {
    const native = createNativeWindow();
    native.gBrowser[methodName] = undefined;
    const boundary = createFirefoxBridgeBoundary({
      buildId: "20260812182057",
      contextId: `window-00000000-0000-4000-8000-${String(
        ++nextContextSequence,
      ).padStart(12, "0")}`,
      firefoxVersion: "154.0",
      window: native.window,
      windowKind: "normal",
    });
    try {
      assert.throws(
        () =>
          createFirefoxTabsBridge({
            beginNativePopupHandoff() {
              return true;
            },
            boundary,
            dragCoordinator: createTestDragCoordinator(),
            endNativePopupHandoff() {},
            isTabDetachAllowed() {
              return true;
            },
            onError() {},
            window: native.window,
          }),
        (error) =>
          isFirefoxBridgeError(error) &&
          error.fenneviaCode === "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING" &&
          error.fenneviaSymbol === `window.gBrowser.${methodName}` &&
          error.fenneviaBuildId === "20260812182057",
      );
    } finally {
      boundary.dispose();
    }
  }
});

test("missing gBrowser event-target capability fails before crash listeners attach", () => {
  const native = createNativeWindow();
  native.gBrowser.removeEventListener = undefined;
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260812182057",
    contextId: "window-00000000-0000-4000-8000-999999999999",
    firefoxVersion: "154.0",
    window: native.window,
    windowKind: "normal",
  });
  try {
    assert.throws(
      () =>
        createFirefoxTabsBridge({
          beginNativePopupHandoff() {
            return true;
          },
          boundary,
          dragCoordinator: createTestDragCoordinator(),
          endNativePopupHandoff() {},
          isTabDetachAllowed() {
            return true;
          },
          onError() {},
          window: native.window,
        }),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING" &&
        error.fenneviaSymbol ===
          "window.gBrowser.addEventListener.removeEventListener" &&
        error.fenneviaBuildId === "20260812182057",
    );
    assert.equal(native.tabContainer.listenerCount(), 0);
    assert.equal(native.gBrowser.listenerCount(), 0);
  } finally {
    boundary.dispose();
  }
});
