import assert from "node:assert/strict";
import test from "node:test";

import {
  createFirefoxBridgeBoundary,
  isFirefoxBridgeError,
} from "../src/firefox/bridge-boundary.ts";
import { createFirefoxUrlbarCoverageBridge } from "../src/firefox/urlbar-coverage.ts";

const BROWSER_URI = "chrome://browser/content/browser.xhtml";
let nextContextSequence = 0;

function createEventTarget() {
  const listeners = [];
  return {
    addEventListener(type, listener, options) {
      listeners.push({ listener, options, type });
    },
    removeEventListener(type, listener, options) {
      const index = listeners.findIndex(
        (candidate) =>
          candidate.type === type &&
          candidate.listener === listener &&
          candidate.options === options,
      );
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    },
  };
}

function createNativeWindow({ missingElementId } = {}) {
  const elements = new Map();
  const observerRecords = new Set();
  let nativeOpenCount = 0;

  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.observations = [];
      observerRecords.add(this);
    }
    disconnect() {
      this.observations.length = 0;
      observerRecords.delete(this);
    }
    observe(target, options) {
      this.observations.push({ options, target });
    }
  }

  function notify() {
    for (const observer of Array.from(observerRecords)) {
      observer.callback(Object.freeze([Object.freeze({ type: "attributes" })]));
    }
  }

  function createElement(
    id,
    { attributes = {}, children = [], classes = [], hidden = false } = {},
  ) {
    const attributeMap = new Map(
      Object.entries(attributes).map(([name, value]) => [name, String(value)]),
    );
    const classSet = new Set(classes);
    const element = {
      children,
      classList: {
        contains(name) {
          return classSet.has(name);
        },
      },
      getAttribute(name) {
        return attributeMap.get(name) ?? null;
      },
      hasAttribute(name) {
        return attributeMap.has(name);
      },
      hidden,
      id,
      removeAttribute(name) {
        const changed = attributeMap.delete(name);
        if (changed) {
          notify();
        }
      },
      setAttribute(name, value = "") {
        attributeMap.set(name, String(value));
        notify();
      },
      setClass(name, enabled) {
        if (enabled) {
          classSet.add(name);
        } else {
          classSet.delete(name);
        }
        notify();
      },
      setHidden(nextHidden) {
        hidden = Boolean(nextHidden);
        element.hidden = hidden;
        notify();
      },
    };
    if (id) {
      elements.set(id, element);
    }
    return element;
  }

  const documentElement = createElement("document-element");
  const gURLBar = createElement("urlbar", {
    attributes: { pageproxystate: "valid" },
  });
  const permissionBox = createElement("identity-permission-box");
  const sharingElements = {
    location: createElement("geo-sharing-icon"),
    media: createElement("webrtc-sharing-icon"),
    serial: createElement("serial-sharing-icon"),
    xr: createElement("xr-sharing-icon"),
  };
  const blockedElements = [
    createElement("", { attributes: { "data-permission-id": "camera" } }),
    createElement("", { attributes: { "data-permission-id": "popup" } }),
    createElement("", {
      attributes: { "data-permission-id": "future-unknown" },
    }),
  ];
  createElement("blocked-permissions-container", {
    children: blockedElements,
  });

  const pageActions = {
    bookmark: createElement("star-button-box"),
    container: createElement("userContext-icons", { hidden: true }),
    more: createElement("pageActionButton", {
      attributes: { "multiple-children": "" },
      classes: ["urlbar-page-action"],
    }),
    pictureInPicture: createElement("picture-in-picture-button", {
      hidden: true,
    }),
    reader: createElement("reader-mode-button", { hidden: true }),
    recommendation: createElement("contextual-feature-recommendation", {
      hidden: true,
    }),
    splitView: createElement("split-view-button", { hidden: true }),
    taskbarTabs: createElement("taskbar-tabs-button", { hidden: true }),
    translations: createElement("translations-button", { hidden: true }),
    zoom: createElement("urlbar-zoom-button", { hidden: true }),
  };
  const pageActionContainer = createElement("page-action-buttons", {
    children: Object.values(pageActions),
  });

  if (missingElementId) {
    elements.delete(missingElementId);
  }

  const tabContainer = createEventTarget();
  const selectedBrowser = { webNavigation: {} };
  const gBrowser = {
    selectedBrowser,
    tabContainer,
    tabs: [],
  };
  const nativeWindow = {
    document: {
      defaultView: null,
      documentElement,
      documentURI: BROWSER_URI,
      getElementById(id) {
        return elements.get(id) ?? null;
      },
    },
    gBrowser,
    gURLBar,
    MutationObserver: FakeMutationObserver,
    openLocation() {
      nativeOpenCount += 1;
    },
  };
  nativeWindow.document.defaultView = nativeWindow;

  return {
    blockedElements,
    documentElement,
    gURLBar,
    nativeOpenCount: () => nativeOpenCount,
    nativeWindow,
    observerCount: () => observerRecords.size,
    observerTargetCount: () =>
      Array.from(observerRecords).reduce(
        (total, observer) => total + observer.observations.length,
        0,
      ),
    pageActionContainer,
    pageActions,
    permissionBox,
    sharingElements,
    createElement,
    notify,
  };
}

function createController(options = {}) {
  const fixture = createNativeWindow(options);
  const errors = [];
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260810162159",
    contextId: `window-urlbar-coverage-${++nextContextSequence}`,
    firefoxVersion: "153.0.4",
    window: fixture.nativeWindow,
    windowKind: options.windowKind ?? "normal",
  });
  const controller = createFirefoxUrlbarCoverageBridge({
    boundary,
    onError: (error) => errors.push(error),
    window: fixture.nativeWindow,
  });
  return { boundary, controller, errors, fixture };
}

test("Urlbar coverage bridge exposes only current fixed Firefox-owned state", () => {
  const { boundary, controller, fixture } = createController();

  assert.deepEqual(controller.urlbarCoverage.snapshot(), {
    items: ["bookmark", "more-page-actions"],
    permissions: {
      available: true,
      blocked: [],
      hasPermissions: false,
      sharing: [],
    },
  });
  assert.equal(controller.snapshot().revision, 1);
  assert.equal(fixture.observerCount(), 1);
  assert.equal(fixture.observerTargetCount(), 4);
  assert.ok(Object.isFrozen(controller.urlbarCoverage.snapshot()));
  assert.ok(Object.isFrozen(controller.urlbarCoverage.snapshot().items));

  const capabilities = controller.assertRequiredCapabilities();
  assert.ok(capabilities.every((capability) => capability.available));
  assert.deepEqual(
    capabilities.map((capability) => capability.name),
    [
      "firefox.urlbar-coverage-native-access",
      "firefox.urlbar-coverage-mutation-observer",
      "firefox.urlbar-coverage-urlbar-state",
      "firefox.urlbar-coverage-window-state",
      "firefox.urlbar-coverage-blocked-permissions-container",
      "firefox.urlbar-coverage-identity-permission-box",
      "firefox.urlbar-coverage-page-action-buttons",
    ],
  );

  assert.equal(controller.dispose(), true);
  assert.equal(fixture.observerCount(), 0);
  assert.equal(boundary.dispose(), true);
});

test("Firefox mutations reconcile permission indicators and applicable actions", () => {
  const { boundary, controller, errors, fixture } = createController();
  const events = [];
  const unsubscribe = controller.urlbarCoverage.subscribe((event) =>
    events.push(event),
  );

  fixture.documentElement.setAttribute("remotecontrol", "true");
  fixture.gURLBar.setAttribute("searchmode", "");
  fixture.gURLBar.setAttribute("persistsearchterms", "");
  fixture.permissionBox.setAttribute("hasPermissions", "");
  fixture.sharingElements.media.setAttribute("sharing", "camera");
  fixture.blockedElements[0].setAttribute("showing", "true");
  fixture.blockedElements[2].setAttribute("showing", "true");
  fixture.pageActions.reader.setHidden(false);
  const extensionAction = fixture.createElement("pageAction-urlbar-addon", {
    attributes: { actionid: "private-extension-id" },
    classes: ["urlbar-addon-page-action", "urlbar-page-action"],
  });
  fixture.pageActionContainer.children.push(extensionAction);
  fixture.notify();

  const snapshot = controller.urlbarCoverage.snapshot();
  assert.deepEqual(snapshot.items, [
    "remote-control",
    "search-mode",
    "persisted-search",
    "reader-view",
    "bookmark",
    "extension-actions",
    "more-page-actions",
  ]);
  assert.deepEqual(snapshot.permissions, {
    available: true,
    blocked: ["camera"],
    hasPermissions: true,
    sharing: ["media"],
  });
  assert.ok(events.length >= 1);
  assert.ok(events.every((event) => Object.isFrozen(event)));
  assert.deepEqual(errors, []);

  fixture.gURLBar.removeAttribute("persistsearchterms");
  fixture.gURLBar.setAttribute("pageproxystate", "invalid");
  fixture.sharingElements.media.removeAttribute("sharing");
  assert.deepEqual(controller.urlbarCoverage.snapshot().permissions, {
    available: false,
    blocked: [],
    hasPermissions: false,
    sharing: [],
  });

  assert.equal(unsubscribe(), true);
  assert.equal(unsubscribe(), false);
  controller.dispose();
  boundary.dispose();
});

test("native Urlbar access delegates to Firefox openLocation and remains per-window", () => {
  const normal = createController();
  const privateWindow = createController({ windowKind: "private" });

  normal.fixture.pageActions.translations.setHidden(false);
  privateWindow.fixture.pageActions.pictureInPicture.setHidden(false);
  assert.deepEqual(normal.controller.urlbarCoverage.snapshot().items, [
    "translations",
    "bookmark",
    "more-page-actions",
  ]);
  assert.deepEqual(privateWindow.controller.urlbarCoverage.snapshot().items, [
    "picture-in-picture",
    "bookmark",
    "more-page-actions",
  ]);

  assert.equal(normal.controller.urlbarCoverage.openNativeUrlbar(), true);
  assert.equal(normal.fixture.nativeOpenCount(), 1);
  assert.equal(privateWindow.fixture.nativeOpenCount(), 0);

  normal.controller.dispose();
  privateWindow.controller.dispose();
  assert.throws(
    () => normal.controller.urlbarCoverage.openNativeUrlbar(),
    (error) =>
      isFirefoxBridgeError(error) &&
      error.fenneviaCode === "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSED",
  );
  normal.boundary.dispose();
  privateWindow.boundary.dispose();
});

test("missing Urlbar owner capability fails before observers survive", () => {
  const fixture = createNativeWindow({
    missingElementId: "identity-permission-box",
  });
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260810162159",
    contextId: `window-urlbar-coverage-${++nextContextSequence}`,
    firefoxVersion: "153.0.4",
    window: fixture.nativeWindow,
    windowKind: "normal",
  });

  assert.throws(
    () =>
      createFirefoxUrlbarCoverageBridge({
        boundary,
        onError() {},
        window: fixture.nativeWindow,
      }),
    (error) =>
      isFirefoxBridgeError(error) &&
      error.fenneviaCode ===
        "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING" &&
      error.fenneviaSymbol === "document.elements[identity-permission-box]",
  );
  assert.equal(fixture.observerCount(), 0);
  boundary.dispose();
});

test("mutation failures report one privacy-safe bridge error and stop updates", () => {
  const { boundary, controller, errors, fixture } = createController();
  fixture.gURLBar.getAttribute = null;
  fixture.notify();

  assert.equal(errors.length, 1);
  assert.equal(
    errors[0].fenneviaCode,
    "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING",
  );
  assert.equal(errors[0].fenneviaWindowKind, "normal");
  assert.equal(controller.snapshot().failed, true);
  fixture.notify();
  assert.equal(errors.length, 1);

  controller.dispose();
  boundary.dispose();
});
