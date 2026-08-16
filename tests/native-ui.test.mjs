import assert from "node:assert/strict";
import test from "node:test";
import {
  clearTimeout as clearNodeTimeout,
  setTimeout as setNodeTimeout,
} from "node:timers";
import { setTimeout as delay } from "node:timers/promises";

import {
  createNativeUiController,
  nativeUiAttributes,
  nativeUiHideDelayMs,
  nativeUiStyleId,
} from "../profile/chrome/fennevia/content/runtime/NativeUi.sys.mjs";

const XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const XUL_NAMESPACE =
  "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

class FakeElement {
  constructor(ownerDocument, namespaceURI, localName) {
    this.ownerDocument = ownerDocument;
    this.namespaceURI = namespaceURI;
    this.localName = localName;
    this.parentElement = null;
    this.anchorNode = null;
    this.triggerNode = null;
    this._attributes = new Map();
    this._children = [];
    this._listeners = new Map();
    this._textContent = "";
    if (localName === "style") {
      this.sheet = { cssRules: [] };
    }
  }

  get children() {
    return this._children.slice();
  }

  get id() {
    return this.getAttribute("id") ?? "";
  }

  set id(value) {
    this.setAttribute("id", value);
  }

  get className() {
    return this.getAttribute("class") ?? "";
  }

  set className(value) {
    this.setAttribute("class", value);
  }

  get classList() {
    return {
      contains: (className) => this.className.split(/\s+/u).includes(className),
    };
  }

  get hidden() {
    return this.hasAttribute("hidden");
  }

  get isConnected() {
    return (
      this === this.ownerDocument.documentElement ||
      this.parentElement?.isConnected === true
    );
  }

  get textContent() {
    return (
      this._textContent +
      this._children.map((child) => child.textContent).join("")
    );
  }

  set textContent(value) {
    this._children = [];
    this._textContent = String(value);
    if (this.sheet) {
      const matches = this._textContent.match(/\}/gu);
      this.sheet.cssRules = Array.from({ length: matches?.length ?? 0 }, () =>
        Object.freeze({}),
      );
    }
    this.ownerDocument.notify(this, "characterData");
  }

  addEventListener(type, listener) {
    const listeners = this._listeners.get(type) ?? new Set();
    listeners.add(listener);
    this._listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this._listeners.get(type)?.delete(listener);
  }

  dispatch(type, init = {}) {
    const event = {
      type,
      target: this,
      originalTarget: this,
      relatedTarget: null,
      ...init,
    };
    for (const listener of [...(this._listeners.get(type) ?? [])]) {
      listener(event);
    }
  }

  append(...children) {
    for (const child of children) {
      this.insertBefore(child, null);
    }
  }

  insertBefore(child, reference) {
    child.remove();
    const index =
      reference === null
        ? this._children.length
        : this._children.indexOf(reference);
    if (index < 0) {
      throw new Error("reference is not a child");
    }
    this._children.splice(index, 0, child);
    child.parentElement = this;
    this.ownerDocument.notify(this, "childList");
    return child;
  }

  remove() {
    if (!this.parentElement) {
      return;
    }
    const parent = this.parentElement;
    const index = parent._children.indexOf(this);
    parent._children.splice(index, 1);
    this.parentElement = null;
    this.ownerDocument.notify(parent, "childList");
  }

  contains(candidate) {
    for (let current = candidate; current; current = current.parentElement) {
      if (current === this) {
        return true;
      }
    }
    return false;
  }

  setAttribute(name, value) {
    this._attributes.set(name, String(value));
    this.ownerDocument.notify(this, "attributes", name);
  }

  getAttribute(name) {
    return this._attributes.has(name) ? this._attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this._attributes.has(name);
  }

  removeAttribute(name) {
    if (this._attributes.delete(name)) {
      this.ownerDocument.notify(this, "attributes", name);
    }
  }

  toggleAttribute(name, force) {
    const enabled =
      force === undefined ? !this.hasAttribute(name) : Boolean(force);
    if (enabled) {
      this.setAttribute(name, "");
    } else {
      this.removeAttribute(name);
    }
    return enabled;
  }
}

class FakeMutationObserver {
  constructor(callback) {
    this.callback = callback;
    this.registrations = [];
  }

  observe(target, options) {
    const registration = { observer: this, options, target };
    this.registrations.push(registration);
    target.ownerDocument.observers.add(registration);
  }

  disconnect() {
    for (const registration of this.registrations) {
      registration.target.ownerDocument.observers.delete(registration);
    }
    this.registrations.length = 0;
  }
}

class FakeDocument {
  constructor() {
    this.documentURI = "chrome://browser/content/browser.xhtml";
    this.observers = new Set();
    this._listeners = new Map();
    this.activeElement = null;
    this.commandDispatcher = { focusedElement: null };
    this.popupNode = null;
    this.documentElement = this.createElementNS(XHTML_NAMESPACE, "html");
    this.documentElement.id = "main-window";
    this.body = this.createElementNS(XHTML_NAMESPACE, "body");
    this.documentElement.append(this.body);
  }

  createElementNS(namespaceURI, localName) {
    return new FakeElement(this, namespaceURI, localName);
  }

  getElementById(id) {
    const visit = (element) => {
      if (element.id === id) {
        return element;
      }
      for (const child of element.children) {
        const match = visit(child);
        if (match) {
          return match;
        }
      }
      return null;
    };
    return visit(this.documentElement);
  }

  addEventListener(type, listener) {
    const listeners = this._listeners.get(type) ?? new Set();
    listeners.add(listener);
    this._listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this._listeners.get(type)?.delete(listener);
  }

  dispatch(type, target, init = {}) {
    const event = {
      type,
      target,
      originalTarget: target,
      relatedTarget: null,
      ...init,
    };
    for (const listener of [...(this._listeners.get(type) ?? [])]) {
      listener(event);
    }
  }

  listenerCount() {
    return [...this._listeners.values()].reduce(
      (count, listeners) => count + listeners.size,
      0,
    );
  }

  notify(target, type, attributeName) {
    for (const registration of [...this.observers]) {
      const { options } = registration;
      if (!options[type]) {
        continue;
      }
      if (
        type === "attributes" &&
        options.attributeFilter &&
        !options.attributeFilter.includes(attributeName)
      ) {
        continue;
      }
      const inScope =
        registration.target === target ||
        (options.subtree && registration.target.contains(target));
      if (inScope) {
        registration.observer.callback([{ attributeName, target, type }]);
      }
    }
  }
}

function append(document, parent, namespaceURI, localName, id, className) {
  const element = document.createElementNS(namespaceURI, localName);
  if (id) {
    element.id = id;
  }
  if (className) {
    element.className = className;
  }
  parent.append(element);
  return element;
}

function appendTitlebarControls(document, parent) {
  const container = append(
    document,
    parent,
    XUL_NAMESPACE,
    "hbox",
    null,
    "titlebar-buttonbox-container",
  );
  const box = append(
    document,
    container,
    XUL_NAMESPACE,
    "hbox",
    null,
    "titlebar-buttonbox",
  );
  for (const className of [
    "titlebar-min",
    "titlebar-max",
    "titlebar-restore",
    "titlebar-close",
  ]) {
    append(
      document,
      box,
      XUL_NAMESPACE,
      "toolbarbutton",
      null,
      `titlebar-button ${className}`,
    );
  }
}

function createFixture() {
  const document = new FakeDocument();
  const toolbox = append(
    document,
    document.body,
    XUL_NAMESPACE,
    "toolbox",
    "navigator-toolbox",
  );
  const menuBar = append(
    document,
    toolbox,
    XUL_NAMESPACE,
    "toolbar",
    "toolbar-menubar",
  );
  appendTitlebarControls(document, menuBar);
  const tabsToolbar = append(
    document,
    toolbox,
    XUL_NAMESPACE,
    "toolbar",
    "TabsToolbar",
  );
  append(document, tabsToolbar, XUL_NAMESPACE, "hbox", null, "toolbar-items");
  appendTitlebarControls(document, tabsToolbar);
  const navBar = append(document, toolbox, XUL_NAMESPACE, "toolbar", "nav-bar");
  append(document, navBar, XHTML_NAMESPACE, "img", "taskbar-tabs-favicon");
  append(document, navBar, XUL_NAMESPACE, "toolbartabstop");
  const navTarget = append(
    document,
    navBar,
    XUL_NAMESPACE,
    "hbox",
    "nav-bar-customization-target",
  );
  append(
    document,
    navBar,
    XUL_NAMESPACE,
    "toolbarbutton",
    "document-pip-return-to-opener-button",
  );
  append(
    document,
    navBar,
    XUL_NAMESPACE,
    "toolbarbutton",
    "taskbar-tabs-audio",
  );
  append(
    document,
    navBar,
    XUL_NAMESPACE,
    "toolbaritem",
    "smartwindow-ask-button",
  );
  append(
    document,
    navBar,
    XUL_NAMESPACE,
    "toolbarbutton",
    "nav-bar-overflow-button",
  );
  append(document, navBar, XUL_NAMESPACE, "toolbaritem", "PanelUI-button");
  appendTitlebarControls(document, navBar);
  append(document, toolbox, XUL_NAMESPACE, "toolbar", "PersonalToolbar");
  append(document, toolbox, XUL_NAMESPACE, "toolbar", "notifications-toolbar");

  const browser = append(
    document,
    document.body,
    XUL_NAMESPACE,
    "hbox",
    "browser",
  );
  const sidebarContainer = append(
    document,
    browser,
    XUL_NAMESPACE,
    "box",
    "sidebar-container",
  );
  sidebarContainer.setAttribute("hidden", "true");
  const sidebarMain = append(
    document,
    sidebarContainer,
    XHTML_NAMESPACE,
    "sidebar-main",
  );
  append(
    document,
    browser,
    XUL_NAMESPACE,
    "splitter",
    "sidebar-launcher-splitter",
  );
  const sidebarBox = append(
    document,
    browser,
    XUL_NAMESPACE,
    "vbox",
    "sidebar-box",
  );
  sidebarBox.setAttribute("hidden", "true");
  append(document, browser, XUL_NAMESPACE, "splitter", "sidebar-splitter");
  append(document, browser, XUL_NAMESPACE, "tabbox", "tabbrowser-tabbox");
  const frame = append(
    document,
    browser,
    XHTML_NAMESPACE,
    "div",
    "fennevia-shell-frame-host",
  );
  const edgeHost = append(
    document,
    frame,
    XHTML_NAMESPACE,
    "section",
    "fennevia-shell-top-host",
  );
  edgeHost.setAttribute("data-fennevia-edge-host", "top");

  const windowListeners = new Map();
  const animationFrames = new Map();
  const pendingTimers = new Set();
  let animationSequence = 0;
  const window = {
    document,
    MutationObserver: FakeMutationObserver,
    toolbar: { visible: true },
    gURLBar: {
      focused: false,
      hasAttribute: () => false,
    },
    setTimeout(callback, delayMilliseconds) {
      let id;
      id = setNodeTimeout(() => {
        pendingTimers.delete(id);
        callback();
      }, delayMilliseconds);
      pendingTimers.add(id);
      return id;
    },
    clearTimeout(id) {
      pendingTimers.delete(id);
      clearNodeTimeout(id);
    },
    requestAnimationFrame(callback) {
      const id = ++animationSequence;
      animationFrames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      animationFrames.delete(id);
    },
    addEventListener(type, listener) {
      const listeners = windowListeners.get(type) ?? new Set();
      listeners.add(listener);
      windowListeners.set(type, listeners);
    },
    removeEventListener(type, listener) {
      windowListeners.get(type)?.delete(listener);
    },
    dispatch(type, init = {}) {
      const event = { type, target: window, ...init };
      for (const listener of [...(windowListeners.get(type) ?? [])]) {
        listener(event);
      }
    },
    flushAnimationFrames() {
      const pending = [...animationFrames.values()];
      animationFrames.clear();
      for (const callback of pending) {
        callback();
      }
    },
    pendingAnimationFrameCount() {
      return animationFrames.size;
    },
    pendingTimerCount() {
      return pendingTimers.size;
    },
    listenerCount() {
      return [...windowListeners.values()].reduce(
        (count, listeners) => count + listeners.size,
        0,
      );
    },
  };
  document.defaultView = window;

  return {
    browser,
    document,
    frame,
    navBar,
    navTarget,
    sidebarBox,
    sidebarMain,
    toolbox,
    window,
  };
}

const waitForNativeHide = () => delay(nativeUiHideDelayMs + 30);

test("native UI activation reserves an edge gutter and hides native toolbox content without hover reveal", () => {
  const fixture = createFixture();
  const errors = [];
  fixture.window.gURLBar.focused = true;
  const controller = createNativeUiController({
    window: fixture.window,
    frame: fixture.frame,
    onError: (error) => errors.push(error),
  });

  const style = fixture.document.getElementById(nativeUiStyleId);
  assert.equal(style.parentElement, fixture.frame);
  assert.equal(style.sheet.cssRules.length, 7);
  assert.match(style.textContent, /#browser > #tabbrowser-tabbox/u);
  assert.match(
    style.textContent,
    /:is\(#toolbar-menubar, #TabsToolbar, #nav-bar\)\s+>\s+\.titlebar-buttonbox-container/u,
  );
  assert.match(style.textContent, /padding: 7px !important/u);
  assert.match(style.textContent, /border-radius: var\(--chrome-block-radius, 4px\) !important/u);
  assert.match(style.textContent, /height: 0 !important/u);
  assert.match(style.textContent, /\.titlebar-buttonbox-container/u);
  assert.doesNotMatch(style.textContent, /data-fennevia-top-visible/u);
  assert.match(style.textContent, /z-index: 6 !important/u);
  assert.doesNotMatch(style.textContent, /#notifications-toolbar/u);
  assert.ok(
    controller
      .assertRequiredCapabilities()
      .every((capability) => capability.available),
  );
  assert.deepEqual(errors, []);

  fixture.document.documentElement.setAttribute("data-fennevia-active", "");
  assert.equal(controller.snapshot().revealed, false);
  fixture.toolbox.dispatch("pointerenter");
  assert.equal(controller.snapshot().revealed, false);
  fixture.window.dispatch("keydown", { key: "Escape" });
  assert.equal(fixture.window.pendingTimerCount(), 0);
  assert.equal(controller.revealForUrlbar(), true);
  assert.equal(controller.revealForToolbar(), true);
  assert.equal(fixture.window.pendingAnimationFrameCount(), 1);

  assert.equal(controller.dispose(), true);
  assert.equal(controller.dispose(), false);
  assert.equal(fixture.document.getElementById(nativeUiStyleId), null);
  assert.equal(fixture.document.observers.size, 0);
  assert.equal(fixture.document.listenerCount(), 0);
  assert.equal(fixture.window.listenerCount(), 0);
  assert.equal(fixture.window.pendingAnimationFrameCount(), 0);
  assert.equal(fixture.window.pendingTimerCount(), 0);
});

test("Urlbar handoff reveals before focus and releases only after native focus leaves", async () => {
  const fixture = createFixture();
  const controller = createNativeUiController({
    window: fixture.window,
    frame: fixture.frame,
    onError: assert.fail,
  });
  fixture.document.documentElement.setAttribute("data-fennevia-active", "");

  assert.equal(controller.revealForUrlbar(), true);
  assert.equal(
    fixture.document.documentElement.hasAttribute(nativeUiAttributes.revealed),
    true,
  );
  fixture.window.gURLBar.focused = true;
  fixture.window.flushAnimationFrames();
  await waitForNativeHide();
  assert.equal(controller.snapshot().revealed, true);

  fixture.window.gURLBar.focused = false;
  fixture.document.dispatch("focusout", fixture.navTarget, {
    relatedTarget: fixture.browser,
  });
  await waitForNativeHide();
  assert.equal(controller.snapshot().revealed, false);

  controller.dispose();
});

test("native popup anchors and an open unsupported sidebar hold the reversible reveal", async () => {
  const fixture = createFixture();
  const controller = createNativeUiController({
    window: fixture.window,
    frame: fixture.frame,
    onError: assert.fail,
  });
  fixture.document.documentElement.setAttribute("data-fennevia-active", "");

  fixture.document.activeElement = fixture.navTarget;
  fixture.document.dispatch("focusin", fixture.navTarget);
  assert.equal(controller.snapshot().revealed, true);
  fixture.document.activeElement = fixture.browser;
  fixture.document.dispatch("focusin", fixture.browser);
  await waitForNativeHide();
  assert.equal(controller.snapshot().revealed, false);

  const panel = append(
    fixture.document,
    fixture.document.body,
    XUL_NAMESPACE,
    "panel",
    "test-native-panel",
  );
  panel.anchorNode = fixture.navTarget;
  panel.setAttribute("state", "showing");
  fixture.document.dispatch("popupshowing", panel);
  assert.equal(controller.snapshot().revealed, true);
  assert.equal(controller.snapshot().openPopupCount, 1);

  panel.setAttribute("state", "closed");
  fixture.document.dispatch("popuphidden", panel);
  await waitForNativeHide();
  assert.equal(controller.snapshot().revealed, false);

  fixture.sidebarBox.removeAttribute("hidden");
  assert.equal(controller.snapshot().revealed, true);
  fixture.sidebarBox.setAttribute("hidden", "true");
  assert.equal(controller.snapshot().revealed, false);

  controller.dispose();
});

test("customize, DOM fullscreen, and native dialogs suspend hiding fail-open", () => {
  const fixture = createFixture();
  const controller = createNativeUiController({
    window: fixture.window,
    frame: fixture.frame,
    onError: assert.fail,
  });
  const root = fixture.document.documentElement;
  root.setAttribute("data-fennevia-active", "");

  fixture.toolbox.dispatch("beforecustomization");
  root.setAttribute("customizing", "");
  assert.equal(controller.snapshot().suspensionReason, "customize-mode");
  root.removeAttribute("customizing");
  assert.equal(controller.snapshot().suspended, true);
  fixture.toolbox.dispatch("aftercustomization");
  assert.equal(controller.snapshot().suspended, false);

  root.setAttribute("inDOMFullscreen", "");
  assert.equal(controller.snapshot().suspensionReason, "dom-fullscreen");
  assert.equal(controller.revealForUrlbar(), false);
  assert.equal(controller.revealForToolbar(), false);
  root.removeAttribute("inDOMFullscreen");
  assert.equal(controller.snapshot().suspended, false);

  root.setAttribute("window-modal-open", "");
  assert.equal(controller.snapshot().suspensionReason, "native-dialog");
  root.removeAttribute("window-modal-open");
  assert.equal(controller.snapshot().suspended, false);

  controller.dispose();
});

test("partial activation CSS suspends native hiding and reports one deterministic failure", () => {
  const fixture = createFixture();
  const errors = [];
  const controller = createNativeUiController({
    window: fixture.window,
    frame: fixture.frame,
    onError: (error) => errors.push(error),
  });
  const root = fixture.document.documentElement;
  root.setAttribute("data-fennevia-active", "");
  const style = fixture.document.getElementById(nativeUiStyleId);

  style.textContent =
    ":root[data-fennevia-active] #PersonalToolbar { visibility: collapse !important; }";

  assert.equal(errors.length, 1);
  assert.equal(errors[0].fenneviaCode, "FENNEVIA_NATIVE_UI_STYLE_PARTIAL");
  assert.equal(root.hasAttribute(nativeUiAttributes.suspended), true);
  assert.equal(root.hasAttribute(nativeUiAttributes.revealed), false);

  controller.dispose();
  assert.equal(root.hasAttribute(nativeUiAttributes.suspended), false);
});

test("stable native structure drift fails open while window teardown does not", async () => {
  const driftFixture = createFixture();
  const driftErrors = [];
  const driftController = createNativeUiController({
    window: driftFixture.window,
    frame: driftFixture.frame,
    onError: (error) => driftErrors.push(error),
  });
  driftFixture.document.documentElement.setAttribute(
    "data-fennevia-active",
    "",
  );
  driftFixture.sidebarMain.remove();
  await delay(20);
  assert.equal(driftErrors.length, 1);
  assert.equal(
    driftErrors[0].fenneviaCode,
    "FENNEVIA_NATIVE_UI_TARGET_INVALID",
  );
  assert.equal(
    driftFixture.document.documentElement.hasAttribute(
      nativeUiAttributes.suspended,
    ),
    true,
  );
  driftController.dispose();

  const teardownFixture = createFixture();
  const teardownErrors = [];
  const teardownController = createNativeUiController({
    window: teardownFixture.window,
    frame: teardownFixture.frame,
    onError: (error) => teardownErrors.push(error),
  });
  teardownFixture.window.dispatch("unload");
  teardownFixture.sidebarMain.remove();
  await delay(20);
  assert.deepEqual(teardownErrors, []);
  assert.equal(teardownController.dispose(), true);
});
