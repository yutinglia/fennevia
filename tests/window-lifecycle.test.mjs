import assert from "node:assert/strict";
import test from "node:test";

import { createRuntimeLogger } from "../profile/chrome/fennevia/content/runtime/Logger.sys.mjs";
import {
  createProcessRuntime,
  startProcessRuntime,
} from "../profile/chrome/fennevia/content/runtime/Runtime.sys.mjs";
import { createWindowManager } from "../profile/chrome/fennevia/content/runtime/WindowManager.sys.mjs";

const BROWSER_URI = "chrome://browser/content/browser.xhtml";
const BROWSER_TYPE = "navigator:browser";
const DELAYED_STARTUP_TOPIC = "browser-delayed-startup-finished";
const SHUTDOWN_TOPIC = "quit-application-granted";

function createObserverService() {
  const observers = new Map();

  return {
    addObserver(observer, topic) {
      const topicObservers = observers.get(topic) ?? new Set();
      topicObservers.add(observer);
      observers.set(topic, topicObservers);
    },

    removeObserver(observer, topic) {
      const topicObservers = observers.get(topic);
      if (!topicObservers?.delete(observer)) {
        throw new Error("observer was not registered");
      }
      if (topicObservers.size === 0) {
        observers.delete(topic);
      }
    },

    notify(subject, topic) {
      for (const observer of Array.from(observers.get(topic) ?? [])) {
        if (typeof observer === "function") {
          observer(subject, topic, null);
        } else {
          observer.observe(subject, topic, null);
        }
      }
    },

    count(topic) {
      return observers.get(topic)?.size ?? 0;
    },
  };
}

function createUuidService() {
  let sequence = 0;
  return {
    generateUUID() {
      sequence += 1;
      return `{00000000-0000-4000-8000-${sequence
        .toString(16)
        .padStart(12, "0")}}`;
    },
  };
}

function createServices(existingWindows = []) {
  const obs = createObserverService();
  return {
    obs,
    uuid: createUuidService(),
    wm: {
      getEnumerator(windowType) {
        assert.equal(windowType, BROWSER_TYPE);
        return existingWindows.values();
      },
    },
  };
}

function createRecordingLogger() {
  const entries = [];
  const logger = {};
  for (const level of ["debug", "info", "warn", "error"]) {
    logger[level] = fields => entries.push({ level, ...fields });
  }
  return { entries, logger };
}

class FakeWindow {
  constructor({
    uri = BROWSER_URI,
    windowType = BROWSER_TYPE,
    isChromeWindow = true,
    ready = true,
    isPrivate = false,
    isTopLevel = true,
  } = {}) {
    this.closed = false;
    this.isChromeWindow = isChromeWindow;
    this.isPrivate = isPrivate;
    this.gBrowserInit = { delayedStartupFinished: ready };
    this.document = {
      documentURI: uri,
      documentElement: {
        getAttribute(name) {
          return name === "windowtype" ? windowType : "";
        },
      },
    };
    this.top = isTopLevel ? this : {};
    this.listeners = new Map();
  }

  addEventListener(type, listener, options = {}) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push({ listener, once: options?.once === true });
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      listeners.filter(entry => entry.listener !== listener)
    );
  }

  emit(type) {
    const listeners = Array.from(this.listeners.get(type) ?? []);
    for (const entry of listeners) {
      if (entry.once) {
        this.removeEventListener(type, entry.listener);
      }
      entry.listener.call(this, { target: this, type });
    }
  }

  close() {
    this.closed = true;
    this.emit("unload");
  }

  listenerCount(type) {
    return this.listeners.get(type)?.length ?? 0;
  }
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

test("manages existing, later, normal, and private browser windows exactly once", () => {
  const existing = new FakeWindow();
  const pending = new FakeWindow({ ready: false });
  const toolbox = new FakeWindow({
    uri: "chrome://devtools/content/framework/browser-toolbox/window.html",
  });
  const dialog = new FakeWindow({ windowType: "Browser:Preferences" });
  const nonChrome = new FakeWindow({ isChromeWindow: false });
  const childChromeFrame = new FakeWindow({ isTopLevel: false });
  const services = createServices([
    existing,
    pending,
    toolbox,
    dialog,
    nonChrome,
    childChromeFrame,
  ]);
  const { entries, logger } = createRecordingLogger();
  const initialized = [];
  const disposed = [];
  const manager = createWindowManager({
    services,
    privateBrowsingUtils: {
      isWindowPrivate(window) {
        return window.isPrivate;
      },
    },
    logger,
    initializeWindow(context) {
      initialized.push(context);
      return () => disposed.push(context.opaqueId);
    },
  });

  assert.equal(manager.start(), true);
  assert.equal(services.obs.count(DELAYED_STARTUP_TOPIC), 1);
  assert.deepEqual(
    initialized.map(context => context.window),
    [existing]
  );

  services.obs.notify(existing, DELAYED_STARTUP_TOPIC);
  pending.gBrowserInit.delayedStartupFinished = true;
  services.obs.notify(pending, DELAYED_STARTUP_TOPIC);
  services.obs.notify(pending, DELAYED_STARTUP_TOPIC);

  const secondNormal = new FakeWindow();
  const privateWindow = new FakeWindow({ isPrivate: true });
  services.obs.notify(secondNormal, DELAYED_STARTUP_TOPIC);
  services.obs.notify(secondNormal, DELAYED_STARTUP_TOPIC);
  services.obs.notify(privateWindow, DELAYED_STARTUP_TOPIC);
  for (const excluded of [toolbox, dialog, nonChrome, childChromeFrame]) {
    services.obs.notify(excluded, DELAYED_STARTUP_TOPIC);
  }

  assert.deepEqual(
    initialized.map(context => context.window),
    [existing, pending, secondNormal, privateWindow]
  );
  assert.deepEqual(
    initialized.map(context => context.windowKind),
    ["normal", "normal", "normal", "private"]
  );
  assert.deepEqual(
    initialized.map(context => context.isPrivate),
    [false, false, false, true]
  );
  assert.equal(new Set(initialized.map(context => context.opaqueId)).size, 4);
  for (const context of initialized) {
    assert.match(
      context.opaqueId,
      /^window-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/u
    );
    assert.equal(context.signal.aborted, false);
  }

  const snapshot = manager.snapshot();
  assert.equal(snapshot.state, "started");
  assert.equal(snapshot.managedWindowCount, 4);
  assert.equal(snapshot.initializingWindowCount, 0);
  assert.equal(
    snapshot.windows.filter(window => window.windowKind === "private").length,
    1
  );
  assert.equal(
    entries.filter(entry => entry.event === "window.initialized").length,
    4
  );

  assert.equal(manager.stop(), true);
  assert.equal(manager.stop(), false);
  assert.equal(services.obs.count(DELAYED_STARTUP_TOPIC), 0);
  assert.equal(disposed.length, 4);
  assert.ok(initialized.every(context => context.signal.aborted));
  assert.equal(manager.snapshot().managedWindowCount, 0);

  services.obs.notify(new FakeWindow(), DELAYED_STARTUP_TOPIC);
  assert.equal(initialized.length, 4);
});

test("closing during asynchronous initialization aborts and neutralizes late completion", async () => {
  const window = new FakeWindow();
  const services = createServices([window]);
  const { entries, logger } = createRecordingLogger();
  const deferred = createDeferred();
  let callbackCount = 0;
  let lateDisposerCount = 0;
  let abortCount = 0;
  let context;

  const manager = createWindowManager({
    services,
    privateBrowsingUtils: { isWindowPrivate: () => false },
    logger,
    initializeWindow(initializationContext) {
      context = initializationContext;
      const onActivity = () => {
        callbackCount += 1;
      };
      context.window.addEventListener("activity", onActivity);
      context.addCleanup(() =>
        context.window.removeEventListener("activity", onActivity)
      );
      context.signal.addEventListener(
        "abort",
        () => {
          abortCount += 1;
        },
        { once: true }
      );
      return deferred.promise;
    },
  });

  manager.start();
  assert.equal(manager.snapshot().initializingWindowCount, 1);
  window.emit("activity");
  assert.equal(callbackCount, 1);

  window.close();
  assert.equal(context.isDisposed(), true);
  assert.equal(context.signal.aborted, true);
  assert.equal(abortCount, 1);
  assert.equal(window.listenerCount("activity"), 0);
  assert.equal(manager.snapshot().initializingWindowCount, 0);
  assert.equal(manager.snapshot().managedWindowCount, 0);
  const logCountAfterClose = entries.length;

  window.emit("activity");
  assert.equal(callbackCount, 1);
  deferred.resolve(() => {
    lateDisposerCount += 1;
  });
  await flushPromises();

  assert.equal(lateDisposerCount, 1);
  assert.equal(entries.length, logCountAfterClose);
  assert.equal(
    entries.some(entry => entry.event === "window.initialized"),
    false
  );
  assert.equal(manager.stop(), true);
  assert.equal(abortCount, 1);
});

test("initialization failure disposes partial registrations without an unhandled rejection", async () => {
  const syncWindow = new FakeWindow();
  const asyncWindow = new FakeWindow();
  const services = createServices([syncWindow]);
  const { entries, logger } = createRecordingLogger();
  const cleanup = [];
  const manager = createWindowManager({
    services,
    privateBrowsingUtils: { isWindowPrivate: () => false },
    logger,
    initializeWindow(context) {
      context.addCleanup(() => cleanup.push(context.window));
      if (context.window === syncWindow) {
        throw new Error("sync failure with https://private.invalid/");
      }
      return Promise.reject(
        new Error("async failure with C:\\Users\\Private Name\\profile")
      );
    },
  });

  manager.start();
  services.obs.notify(asyncWindow, DELAYED_STARTUP_TOPIC);
  await flushPromises();

  assert.deepEqual(cleanup, [syncWindow, asyncWindow]);
  assert.equal(manager.snapshot().managedWindowCount, 0);
  assert.equal(manager.snapshot().initializingWindowCount, 0);
  assert.equal(
    entries.filter(entry => entry.event === "window.initialization-failed").length,
    2
  );
  assert.equal(manager.stop(), true);
});

test("all cleanups run once even when one cleanup throws", () => {
  const window = new FakeWindow();
  const services = createServices([window]);
  const { entries, logger } = createRecordingLogger();
  const order = [];
  const manager = createWindowManager({
    services,
    privateBrowsingUtils: { isWindowPrivate: () => false },
    logger,
    initializeWindow(context) {
      context.addCleanup(() => order.push("first"));
      context.addCleanup(() => {
        order.push("throwing");
        throw new Error("cleanup failure");
      });
      return () => order.push("returned-disposer");
    },
  });

  manager.start();
  window.close();
  window.close();

  assert.deepEqual(order, ["returned-disposer", "throwing", "first"]);
  assert.equal(
    entries.filter(entry => entry.event === "window.cleanup-failed").length,
    1
  );
  assert.equal(manager.stop(), true);
});

test("window-manager startup failure removes its observer and disposes enumerated windows", () => {
  const window = new FakeWindow();
  const services = createServices();
  services.wm.getEnumerator = function* getEnumerator(windowType) {
    assert.equal(windowType, BROWSER_TYPE);
    yield window;
    throw new Error("enumeration failed");
  };
  const { logger } = createRecordingLogger();
  let disposerCount = 0;
  const manager = createWindowManager({
    services,
    privateBrowsingUtils: { isWindowPrivate: () => false },
    logger,
    initializeWindow() {
      return () => {
        disposerCount += 1;
      };
    },
  });

  assert.throws(() => manager.start(), /enumeration failed/u);
  assert.equal(disposerCount, 1);
  assert.equal(services.obs.count(DELAYED_STARTUP_TOPIC), 0);
  assert.equal(manager.snapshot().managedWindowCount, 0);
  assert.equal(manager.snapshot().state, "failed");
  assert.equal(manager.stop(), true);
  assert.equal(manager.stop(), false);
  assert.equal(disposerCount, 1);
});

test("process runtime start, shutdown, and stop are idempotent", () => {
  const services = createServices();
  const { entries, logger } = createRecordingLogger();
  let managerStartCount = 0;
  let managerStopCount = 0;
  const windowManager = {
    start() {
      managerStartCount += 1;
      return true;
    },
    stop() {
      managerStopCount += 1;
      return true;
    },
    snapshot() {
      return {
        initializingWindowCount: 0,
        managedWindowCount: 2,
      };
    },
  };
  const runtime = createProcessRuntime({ services, windowManager, logger });

  assert.equal(runtime.start().initializationCount, 1);
  assert.equal(runtime.start().initializationCount, 1);
  assert.equal(managerStartCount, 1);
  assert.equal(services.obs.count(SHUTDOWN_TOPIC), 1);

  services.obs.notify(null, SHUTDOWN_TOPIC);
  assert.equal(runtime.snapshot().state, "stopped");
  assert.equal(managerStopCount, 1);
  assert.equal(services.obs.count(SHUTDOWN_TOPIC), 0);
  runtime.stop();
  assert.equal(managerStopCount, 1);
  assert.equal(
    entries.filter(entry => entry.event === "runtime.started").length,
    1
  );
  assert.equal(
    entries.filter(entry => entry.event === "runtime.stopped").length,
    1
  );
});

test("process-global startup returns one singleton runtime", () => {
  const services = createServices();
  const { logger } = createRecordingLogger();
  const targetGlobal = {};
  let factoryCount = 0;
  let managerStartCount = 0;

  const factory = () => {
    factoryCount += 1;
    return {
      start() {
        managerStartCount += 1;
      },
      stop() {},
      snapshot() {
        return {
          initializingWindowCount: 0,
          managedWindowCount: 0,
        };
      },
    };
  };

  const first = startProcessRuntime({
    services,
    privateBrowsingUtils: {},
    logger,
    createWindowManager: factory,
    targetGlobal,
  });
  const second = startProcessRuntime({
    services,
    privateBrowsingUtils: {},
    logger,
    createWindowManager: factory,
    targetGlobal,
  });

  assert.strictEqual(second, first);
  assert.equal(first.result.status, "ready");
  assert.equal(first.result.initializationCount, 1);
  assert.equal(factoryCount, 1);
  assert.equal(managerStartCount, 1);
  first.runtime.stop();
});

test("a failed singleton startup is cleaned and cannot be mistaken for readiness", () => {
  const services = createServices();
  const { entries, logger } = createRecordingLogger();
  const targetGlobal = {};
  let stopCount = 0;
  const factory = () => ({
    start() {
      throw new Error("manager startup failed");
    },
    stop() {
      stopCount += 1;
    },
    snapshot() {
      return {
        initializingWindowCount: 0,
        managedWindowCount: 0,
      };
    },
  });

  assert.throws(
    () =>
      startProcessRuntime({
        services,
        privateBrowsingUtils: {},
        logger,
        createWindowManager: factory,
        targetGlobal,
      }),
    /manager startup failed/u
  );
  assert.equal(stopCount, 1);
  assert.equal(services.obs.count(SHUTDOWN_TOPIC), 0);
  assert.equal(
    entries.some(entry => entry.event === "runtime.start-failed"),
    true
  );
  assert.throws(
    () =>
      startProcessRuntime({
        services,
        privateBrowsingUtils: {},
        logger,
        createWindowManager: factory,
        targetGlobal,
      }),
    /FENNEVIA_RUNTIME_PREVIOUSLY_FAILED/u
  );
});

test("runtime logger allowlists fields and redacts browsing and local data", () => {
  const lines = [];
  const logger = createRuntimeLogger({
    consoleService: {
      logStringMessage(line) {
        lines.push(line);
      },
    },
    appInfo: {
      appBuildID: "20260810162159",
      version: "153.0.4",
    },
    projectCommit: "abcdef0",
  });
  const error = new Error(
    "secret title https://private.invalid/page?q=secret-search"
  );
  error.stack = [
    "Error: secret title https://private.invalid/page?q=secret-search",
    "    at remote (https://private.invalid/page?q=secret-search#fragment)",
    "    at windows (C:\\Users\\Private Name\\Profiles\\secret profile\\entry.mjs:1:2)",
    "    at file (file:///C:/Users/Private%20Name/secret.mjs:3:4)",
    "    at local (/Users/private-name/profile/entry.mjs:5:6)",
    "    at system (/usr/lib/firefox/private-profile/entry.mjs:6:7)",
    "    at jar (jar:file:///C:/Users/Private%20Name/runtime.jar!/entry.mjs:7:8)",
    "    at reader (about:reader?url=https%3A%2F%2Fprivate.invalid%2Fsecret)",
    "    at extension (moz-extension://private-extension-id/entry.mjs?secret=query)",
    "    at project (chrome://fennevia/content/runtime/Runtime.sys.mjs?query=secret#private)",
    "    at opaque (data:text/plain,secret-private-content)",
  ].join("\n");

  logger.error({
    event: "window.initialization-failed",
    phase: "window-initialize",
    code: "FENNEVIA_WINDOW_INITIALIZATION_FAILED",
    windowKind: "private",
    opaqueId: "window-00000000-0000-4000-8000-000000000001",
    projectUri: "chrome://fennevia/content/runtime/Runtime.sys.mjs",
    domPath: "html#main-window>body>#browser",
    firefoxSymbol: "window.gBrowser",
    shellState: "failed",
    url: "https://private.invalid/should-not-serialize",
    title: "secret title",
    privateContent: "secret-private-content",
    error,
  });

  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\[Fennevia runtime\] /u);
  const record = JSON.parse(
    lines[0].replace(/^\[Fennevia runtime\] /u, "")
  );
  assert.equal(record.schemaVersion, 1);
  assert.equal(record.windowKind, "private");
  assert.equal(record.errorName, "Error");
  assert.equal(record.url, undefined);
  assert.equal(record.title, undefined);
  assert.equal(record.privateContent, undefined);
  assert.equal(record.domPath, "html#main-window>body>#browser");
  assert.equal(record.firefoxSymbol, "window.gBrowser");
  assert.equal(record.shellState, "failed");
  assert.equal(record.stack.length, 11);
  assert.ok(record.stack.includes("Error: <REDACTED_MESSAGE>"));
  assert.ok(record.stack.some(line => line.includes("<REMOTE_URL>")));
  assert.ok(record.stack.some(line => line.includes("<LOCAL_PATH>")));
  assert.ok(record.stack.some(line => line.includes("<LOCAL_FILE>")));
  assert.ok(record.stack.some(line => line.includes("<OPAQUE_URL>")));
  assert.ok(record.stack.some(line => line.includes("<OTHER_URI>")));
  assert.ok(record.stack.some(line => line.includes("<REDACTED_SUFFIX>")));
  assert.ok(
    record.stack.some(line =>
      line.includes("chrome://fennevia/content/runtime/Runtime.sys.mjs")
    )
  );

  for (const forbidden of [
    "private.invalid",
    "secret-search",
    "secret title",
    "Private Name",
    "private-name",
    "private-profile",
    "private-extension-id",
    "secret profile",
    "secret-private-content",
    "query=secret",
  ]) {
    assert.equal(lines[0].includes(forbidden), false);
  }

  const firefoxError = new Error("private message");
  firefoxError.stack = [
    "beginInitialization@chrome://fennevia/content/runtime/WindowManager.sys.mjs:1:2",
    "pageCallback@https://private.invalid/secret-title:3:4",
  ].join("\n");
  logger.error({
    event: "window.initialization-failed",
    phase: "window-initialize",
    code: "FENNEVIA_WINDOW_INITIALIZATION_FAILED",
    error: firefoxError,
  });
  const firefoxRecord = JSON.parse(
    lines[1].replace(/^\[Fennevia runtime\] /u, "")
  );
  assert.equal(firefoxRecord.stack.length, 2);
  assert.match(
    firefoxRecord.stack[0],
    /^beginInitialization@chrome:\/\//u
  );
  assert.equal(firefoxRecord.stack[1].includes("private.invalid"), false);

  logger.info({
    event: "shell.hosts-ready",
    phase: "shell-host-attach",
    code: "FENNEVIA_SHELL_HOSTS_READY",
    domPath: "https://private.invalid/unsafe-dom-path",
    firefoxSymbol: "window.gBrowser.currentURI.spec?private",
  });
  const unsafePathRecord = JSON.parse(
    lines[2].replace(/^\[Fennevia runtime\] /u, "")
  );
  assert.equal(unsafePathRecord.domPath, undefined);
  assert.equal(unsafePathRecord.firefoxSymbol, undefined);
  assert.equal(lines[2].includes("private.invalid"), false);
});
