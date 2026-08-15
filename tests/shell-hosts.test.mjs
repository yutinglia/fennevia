import assert from "node:assert/strict";
import test from "node:test";

import {
  createShellHosts,
  initializeWindowShell,
  shellHostIds,
  xhtmlNamespace,
} from "../profile/chrome/fennevia/content/runtime/WindowShell.sys.mjs";

const XUL_NAMESPACE =
  "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const BROWSER_URI = "chrome://browser/content/browser.xhtml";

class FakeElement {
  constructor(ownerDocument, namespaceURI, localName) {
    this.ownerDocument = ownerDocument;
    this.namespaceURI = namespaceURI;
    this.localName = localName;
    this.parentElement = null;
    this._children = [];
    this._attributes = new Map();
    this._textContent = "";
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

  get hidden() {
    return this.hasAttribute("hidden");
  }

  get textContent() {
    return (
      this._textContent +
      this._children.map(child => child.textContent).join("")
    );
  }

  set textContent(value) {
    this._children = [];
    this._textContent = String(value);
  }

  append(...children) {
    for (const child of children) {
      this.insertBefore(child, null);
    }
  }

  appendChild(child) {
    this.insertBefore(child, null);
    return child;
  }

  insertBefore(child, reference) {
    if (!(child instanceof FakeElement)) {
      throw new TypeError("fake DOM accepts only elements");
    }
    if (reference !== null && !this._children.includes(reference)) {
      throw new Error("reference is not a child");
    }
    child.remove();
    const index = reference === null ? this._children.length : this._children.indexOf(reference);
    this._children.splice(index, 0, child);
    child.parentElement = this;
    return child;
  }

  removeChild(child) {
    const index = this._children.indexOf(child);
    if (index === -1) {
      throw new Error("node is not a child");
    }
    this._children.splice(index, 1);
    child.parentElement = null;
    return child;
  }

  remove() {
    this.parentElement?.removeChild(this);
  }

  setAttribute(name, value) {
    this._attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this._attributes.has(name) ? this._attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this._attributes.has(name);
  }
}

class FakeDocument {
  constructor() {
    this.documentURI = BROWSER_URI;
    this.documentElement = this.createElementNS(xhtmlNamespace, "html");
    this.documentElement.id = "main-window";
    this.body = this.createElementNS(xhtmlNamespace, "body");
    this.documentElement.append(this.body);
  }

  createElementNS(namespaceURI, localName) {
    return new FakeElement(this, namespaceURI, localName);
  }

  getElementById(id) {
    const visit = element => {
      if (element.id === id) {
        return element;
      }
      for (const child of element.children) {
        const result = visit(child);
        if (result) {
          return result;
        }
      }
      return null;
    };
    return visit(this.documentElement);
  }
}

function appendElement(document, parent, namespaceURI, localName, id) {
  const element = document.createElementNS(namespaceURI, localName);
  element.id = id;
  parent.append(element);
  return element;
}

function createBrowserWindow() {
  const document = new FakeDocument();
  const modal = appendElement(
    document,
    document.body,
    xhtmlNamespace,
    "dialog",
    "window-modal-dialog"
  );
  const toolbox = appendElement(
    document,
    document.body,
    XUL_NAMESPACE,
    "toolbox",
    "navigator-toolbox"
  );
  const browser = appendElement(
    document,
    document.body,
    XUL_NAMESPACE,
    "hbox",
    "browser"
  );
  const sidebarContainer = appendElement(
    document,
    browser,
    XUL_NAMESPACE,
    "box",
    "sidebar-container"
  );
  const sidebarLauncherSplitter = appendElement(
    document,
    browser,
    XUL_NAMESPACE,
    "splitter",
    "sidebar-launcher-splitter"
  );
  const sidebarBox = appendElement(
    document,
    browser,
    XUL_NAMESPACE,
    "vbox",
    "sidebar-box"
  );
  const sidebarSplitter = appendElement(
    document,
    browser,
    XUL_NAMESPACE,
    "splitter",
    "sidebar-splitter"
  );
  const tabbox = appendElement(
    document,
    browser,
    XUL_NAMESPACE,
    "tabbox",
    "tabbrowser-tabbox"
  );
  const announcement = appendElement(
    document,
    document.body,
    xhtmlNamespace,
    "div",
    "a11y-announcement"
  );
  const fullscreenToggler = appendElement(
    document,
    document.body,
    xhtmlNamespace,
    "div",
    "fullscr-toggler"
  );

  return {
    document,
    elements: {
      announcement,
      browser,
      fullscreenToggler,
      modal,
      sidebarBox,
      sidebarContainer,
      sidebarLauncherSplitter,
      sidebarSplitter,
      tabbox,
      toolbox,
    },
  };
}

function descendants(element) {
  return [
    element,
    ...element.children.flatMap(child => descendants(child)),
  ];
}

function createRecordingLogger() {
  const entries = [];
  return {
    entries,
    logger: {
      info(fields) {
        entries.push({ level: "info", ...fields });
      },
      error(fields) {
        entries.push({ level: "error", ...fields });
      },
    },
  };
}

function createContext(window, windowKind = "normal") {
  const abortController = new AbortController();
  return {
    abortController,
    context: {
      opaqueId: "window-00000000-0000-4000-8000-000000000001",
      window,
      windowKind,
      isPrivate: windowKind === "private",
      signal: abortController.signal,
      isDisposed: () => false,
    },
  };
}

const appInfo = Object.freeze({
  appBuildID: "20260810162159",
  version: "153.0.4",
});

test("attaches three XHTML islands without moving native nodes and disposes cleanly", () => {
  const window = createBrowserWindow();
  const originalBodyChildren = window.document.body.children;
  const originalBrowserChildren = window.elements.browser.children;
  const controller = createShellHosts({
    window,
    windowKind: "normal",
    firefoxVersion: appInfo.version,
    buildId: appInfo.appBuildID,
  });

  assert.deepEqual(controller.snapshot(), {
    hostCount: 0,
    state: "created",
    windowKind: "normal",
  });
  assert.equal(controller.attach(), true);
  assert.equal(controller.attach(), false);

  const primary = window.document.getElementById(shellHostIds.primary);
  const sidebar = window.document.getElementById(shellHostIds.sidebar);
  const overlay = window.document.getElementById(shellHostIds.overlay);
  assert.equal(primary.parentElement, window.document.body);
  assert.equal(sidebar.parentElement, window.elements.browser);
  assert.equal(overlay.parentElement, window.document.body);
  assert.ok(descendants(primary).every(node => node.namespaceURI === xhtmlNamespace));
  assert.ok(descendants(sidebar).every(node => node.namespaceURI === xhtmlNamespace));
  assert.ok(descendants(overlay).every(node => node.namespaceURI === xhtmlNamespace));
  assert.equal(sidebar.hidden, true);
  assert.equal(overlay.hidden, true);
  assert.equal(overlay.hasAttribute("inert"), true);
  assert.match(primary.textContent, /Fennevia host layer ready/u);
  assert.match(primary.textContent, /Normal window/u);
  assert.match(primary.textContent, /Firefox 153\.0\.4/u);
  assert.match(primary.textContent, /Native UI retained/u);

  const bodyChildren = window.document.body.children;
  assert.equal(
    bodyChildren.indexOf(primary) + 1,
    bodyChildren.indexOf(window.elements.browser)
  );
  assert.equal(
    bodyChildren.indexOf(overlay) + 1,
    bodyChildren.indexOf(window.elements.announcement)
  );
  const browserChildren = window.elements.browser.children;
  assert.equal(
    browserChildren.indexOf(sidebar) + 1,
    browserChildren.indexOf(window.elements.tabbox)
  );
  assert.deepEqual(
    bodyChildren.filter(node => !Object.values(shellHostIds).includes(node.id)),
    originalBodyChildren
  );
  assert.deepEqual(
    browserChildren.filter(node => !Object.values(shellHostIds).includes(node.id)),
    originalBrowserChildren
  );

  assert.deepEqual(controller.snapshot(), {
    hostCount: 3,
    state: "attached",
    windowKind: "normal",
  });
  assert.equal(controller.detach(), true);
  assert.equal(controller.detach(), false);
  assert.deepEqual(window.document.body.children, originalBodyChildren);
  assert.deepEqual(window.elements.browser.children, originalBrowserChildren);
  assert.equal(controller.attach(), true);
  assert.equal(controller.dispose(), true);
  assert.equal(controller.dispose(), false);
  assert.equal(window.document.getElementById(shellHostIds.primary), null);
  assert.equal(window.document.getElementById(shellHostIds.sidebar), null);
  assert.equal(window.document.getElementById(shellHostIds.overlay), null);
});

test("normal and private windows receive independent non-sensitive diagnostics", () => {
  const normalWindow = createBrowserWindow();
  const privateWindow = createBrowserWindow();
  const normal = createShellHosts({
    window: normalWindow,
    windowKind: "normal",
    firefoxVersion: "https://private.invalid/version",
    buildId: "C:\\Users\\Private\\build",
  });
  const privateShell = createShellHosts({
    window: privateWindow,
    windowKind: "private",
    firefoxVersion: appInfo.version,
    buildId: appInfo.appBuildID,
  });
  normal.attach();
  privateShell.attach();

  const normalText = normalWindow.document.getElementById(
    shellHostIds.primary
  ).textContent;
  const privateText = privateWindow.document.getElementById(
    shellHostIds.primary
  ).textContent;
  assert.match(normalText, /Normal window/u);
  assert.match(normalText, /Firefox unknown/u);
  assert.match(normalText, /Build unknown/u);
  assert.match(privateText, /Private window/u);
  assert.equal(normalText.includes("private.invalid"), false);
  assert.equal(normalText.includes("Users"), false);
  assert.notStrictEqual(
    normalWindow.document.getElementById(shellHostIds.primary),
    privateWindow.document.getElementById(shellHostIds.primary)
  );

  normal.dispose();
  assert.notEqual(
    privateWindow.document.getElementById(shellHostIds.primary),
    null
  );
  privateShell.dispose();
});

test("window-shell initialization logs readiness and one idempotent disposal", () => {
  const window = createBrowserWindow();
  const { context } = createContext(window);
  const { entries, logger } = createRecordingLogger();
  const dispose = initializeWindowShell({ context, logger, appInfo });

  assert.equal(
    entries.filter(entry => entry.event === "shell.hosts-ready").length,
    1
  );
  assert.equal(typeof dispose, "function");
  dispose();
  dispose();
  assert.equal(
    entries.filter(entry => entry.event === "shell.hosts-disposed").length,
    1
  );
  assert.ok(Object.values(shellHostIds).every(id => !window.document.getElementById(id)));
});

test("a missing insertion point leaves no partial hosts and reports its fixed DOM path", () => {
  const window = createBrowserWindow();
  window.elements.tabbox.remove();
  const { context } = createContext(window);
  const { entries, logger } = createRecordingLogger();

  assert.throws(
    () => initializeWindowShell({ context, logger, appInfo }),
    /FENNEVIA_SHELL_TABBOX_INVALID/u
  );
  assert.ok(Object.values(shellHostIds).every(id => !window.document.getElementById(id)));
  const failure = entries.find(entry => entry.event === "shell.hosts-failed");
  assert.equal(failure.code, "FENNEVIA_SHELL_TABBOX_INVALID");
  assert.equal(
    failure.domPath,
    "html#main-window>body>#browser>#tabbrowser-tabbox"
  );
});

test("an attachment failure rolls back the first host and identifies the failed path", () => {
  const window = createBrowserWindow();
  const originalInsertBefore = window.elements.browser.insertBefore.bind(
    window.elements.browser
  );
  window.elements.browser.insertBefore = (child, reference) => {
    if (child.id === shellHostIds.sidebar) {
      throw new Error("injected insertion failure");
    }
    return originalInsertBefore(child, reference);
  };
  const { context } = createContext(window);
  const { entries, logger } = createRecordingLogger();

  assert.throws(
    () => initializeWindowShell({ context, logger, appInfo }),
    /FENNEVIA_SHELL_HOST_ATTACH_FAILED/u
  );
  assert.ok(Object.values(shellHostIds).every(id => !window.document.getElementById(id)));
  const failure = entries.find(entry => entry.event === "shell.hosts-failed");
  assert.equal(failure.code, "FENNEVIA_SHELL_HOST_ATTACH_FAILED");
  assert.equal(
    failure.domPath,
    "html#main-window>body>#browser>#fennevia-shell-sidebar-host"
  );
});

test("a pre-existing project host blocks the complete set without adopting it", () => {
  const window = createBrowserWindow();
  const collision = window.document.createElementNS(xhtmlNamespace, "div");
  collision.id = shellHostIds.primary;
  window.document.body.insertBefore(collision, window.elements.browser);

  assert.throws(
    () =>
      createShellHosts({
        window,
        windowKind: "normal",
        firefoxVersion: appInfo.version,
        buildId: appInfo.appBuildID,
      }),
    /FENNEVIA_SHELL_HOST_ALREADY_EXISTS/u
  );
  assert.strictEqual(
    window.document.getElementById(shellHostIds.primary),
    collision
  );
  assert.equal(window.document.getElementById(shellHostIds.sidebar), null);
  assert.equal(window.document.getElementById(shellHostIds.overlay), null);
});

test("an already-aborted window context creates no host", () => {
  const window = createBrowserWindow();
  const { abortController, context } = createContext(window, "private");
  const { entries, logger } = createRecordingLogger();
  abortController.abort();

  assert.throws(
    () => initializeWindowShell({ context, logger, appInfo }),
    /FENNEVIA_SHELL_CONTEXT_DISPOSED/u
  );
  assert.ok(Object.values(shellHostIds).every(id => !window.document.getElementById(id)));
  assert.equal(
    entries.find(entry => entry.event === "shell.hosts-failed").windowKind,
    "private"
  );
});
