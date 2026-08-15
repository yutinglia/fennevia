const BROWSER_DOCUMENT_URI = "chrome://browser/content/browser.xhtml";
const BROWSER_WINDOW_TYPE = "navigator:browser";
const DELAYED_STARTUP_TOPIC = "browser-delayed-startup-finished";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function createCleanupRegistry(onCleanupError) {
  let disposed = false;
  const callbacks = [];

  const runCleanup = callback => {
    try {
      callback();
    } catch (error) {
      onCleanupError(error);
    }
  };

  return Object.freeze({
    add(callback) {
      if (typeof callback !== "function") {
        throw new TypeError("FENNEVIA_WINDOW_CLEANUP_MUST_BE_FUNCTION");
      }

      if (disposed) {
        runCleanup(callback);
        return () => {};
      }

      let active = true;
      callbacks.push(callback);
      return () => {
        if (!active || disposed) {
          return;
        }
        active = false;
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
          callbacks.splice(index, 1);
        }
      };
    },

    dispose() {
      if (disposed) {
        return false;
      }

      disposed = true;
      while (callbacks.length) {
        runCleanup(callbacks.pop());
      }
      return true;
    },

    get disposed() {
      return disposed;
    },
  });
}

const isExactBrowserWindow = window => {
  try {
    return Boolean(
        window &&
        !window.closed &&
        window.isChromeWindow === true &&
        window.top === window &&
        window.document?.documentURI === BROWSER_DOCUMENT_URI &&
        window.document?.documentElement?.getAttribute("windowtype") ===
          BROWSER_WINDOW_TYPE &&
        window.gBrowserInit?.delayedStartupFinished === true
    );
  } catch {
    return false;
  }
};

export function createWindowManager({
  services,
  privateBrowsingUtils,
  logger,
  initializeWindow = () => undefined,
}) {
  if (
    typeof services?.obs?.addObserver !== "function" ||
    typeof services?.obs?.removeObserver !== "function" ||
    typeof services?.wm?.getEnumerator !== "function" ||
    typeof services?.uuid?.generateUUID !== "function"
  ) {
    throw new Error("FENNEVIA_WINDOW_SERVICES_UNAVAILABLE");
  }
  if (typeof privateBrowsingUtils?.isWindowPrivate !== "function") {
    throw new Error("FENNEVIA_PRIVATE_WINDOW_CAPABILITY_UNAVAILABLE");
  }
  if (typeof AbortController !== "function") {
    throw new Error("FENNEVIA_ABORT_CONTROLLER_UNAVAILABLE");
  }
  if (
    typeof logger?.info !== "function" ||
    typeof logger?.error !== "function"
  ) {
    throw new Error("FENNEVIA_WINDOW_LOGGER_UNAVAILABLE");
  }
  if (typeof initializeWindow !== "function") {
    throw new TypeError("FENNEVIA_WINDOW_INITIALIZER_MUST_BE_FUNCTION");
  }

  let state = "created";
  let observerRegistered = false;
  const attemptedWindows = new WeakSet();
  const records = new Map();

  const nextOpaqueId = () => {
    const generatedUuid = String(services.uuid.generateUUID())
      .replace(/[{}]/gu, "")
      .toLowerCase();
    if (!UUID_PATTERN.test(generatedUuid)) {
      throw new Error("FENNEVIA_WINDOW_UUID_INVALID");
    }
    return `window-${generatedUuid}`;
  };

  const logCleanupError = (record, error) => {
    logger.error({
      event: "window.cleanup-failed",
      phase: "window-cleanup",
      code: "FENNEVIA_WINDOW_CLEANUP_FAILED",
      windowKind: record.windowKind,
      opaqueId: record.opaqueId,
      error,
    });
  };

  const disposeRecord = (record, phase, code) => {
    if (!record || record.status === "disposed") {
      return false;
    }

    record.status = "disposed";
    records.delete(record.window);
    try {
      record.abortController.abort();
    } catch (error) {
      logCleanupError(record, error);
    }
    record.cleanup.dispose();
    record.window = null;

    logger.info({
      event: "window.disposed",
      phase,
      code,
      windowKind: record.windowKind,
      opaqueId: record.opaqueId,
    });
    return true;
  };

  const failRecord = (record, error) => {
    if (record.status === "disposed") {
      return;
    }

    logger.error({
      event: "window.initialization-failed",
      phase: "window-initialize",
      code: "FENNEVIA_WINDOW_INITIALIZATION_FAILED",
      windowKind: record.windowKind,
      opaqueId: record.opaqueId,
      error,
    });
    disposeRecord(
      record,
      "window-initialize-failed",
      "FENNEVIA_WINDOW_FAILED_OPEN"
    );
  };

  const completeInitialization = (record, disposer) => {
    if (typeof disposer === "function") {
      record.cleanup.add(disposer);
    } else if (disposer !== undefined && disposer !== null) {
      failRecord(
        record,
        new TypeError("FENNEVIA_WINDOW_INITIALIZER_RESULT_INVALID")
      );
      return;
    }

    if (record.status === "disposed") {
      return;
    }

    record.status = "managed";
    logger.info({
      event: "window.initialized",
      phase: "window-managed",
      code: "FENNEVIA_WINDOW_READY",
      windowKind: record.windowKind,
      opaqueId: record.opaqueId,
    });
  };

  const beginInitialization = window => {
    if (state !== "starting" && state !== "started") {
      return;
    }
    if (!isExactBrowserWindow(window) || attemptedWindows.has(window)) {
      return;
    }

    attemptedWindows.add(window);
    let opaqueId;
    try {
      opaqueId = nextOpaqueId();
    } catch (error) {
      logger.error({
        event: "window.identity-failed",
        phase: "window-identify",
        code: "FENNEVIA_WINDOW_IDENTITY_FAILED",
        windowKind: "unsupported",
        error,
      });
      return;
    }

    let isPrivate;
    try {
      isPrivate = Boolean(privateBrowsingUtils.isWindowPrivate(window));
    } catch (error) {
      logger.error({
        event: "window.classification-failed",
        phase: "window-classify",
        code: "FENNEVIA_WINDOW_CLASSIFICATION_FAILED",
        windowKind: "unsupported",
        opaqueId,
        error,
      });
      return;
    }

    const record = {
      opaqueId,
      windowKind: isPrivate ? "private" : "normal",
      isPrivate,
      status: "initializing",
      window,
      abortController: new AbortController(),
      cleanup: null,
    };
    record.cleanup = createCleanupRegistry(error =>
      logCleanupError(record, error)
    );
    records.set(window, record);

    const onUnload = () => {
      disposeRecord(
        record,
        "window-unload",
        "FENNEVIA_WINDOW_UNLOADED"
      );
    };

    try {
      window.addEventListener("unload", onUnload, { once: true });
      record.cleanup.add(() =>
        window.removeEventListener("unload", onUnload)
      );

      const context = Object.freeze({
        opaqueId,
        window,
        isPrivate,
        windowKind: record.windowKind,
        signal: record.abortController.signal,
        addCleanup(callback) {
          return record.cleanup.add(callback);
        },
        isDisposed() {
          return record.status === "disposed";
        },
      });
      const initialization = initializeWindow(context);

      if (
        initialization &&
        typeof initialization.then === "function"
      ) {
        Promise.resolve(initialization).then(
          disposer => completeInitialization(record, disposer),
          error => failRecord(record, error)
        );
      } else {
        completeInitialization(record, initialization);
      }
    } catch (error) {
      failRecord(record, error);
    }
  };

  const delayedStartupObserver = (subject, topic) => {
    if (topic === DELAYED_STARTUP_TOPIC) {
      beginInitialization(subject);
    }
  };

  return Object.freeze({
    start() {
      if (state !== "created") {
        return false;
      }

      state = "starting";
      try {
        services.obs.addObserver(
          delayedStartupObserver,
          DELAYED_STARTUP_TOPIC
        );
        observerRegistered = true;

        for (const window of services.wm.getEnumerator(BROWSER_WINDOW_TYPE)) {
          beginInitialization(window);
        }

        state = "started";
        return true;
      } catch (error) {
        state = "failed";
        if (observerRegistered) {
          try {
            services.obs.removeObserver(
              delayedStartupObserver,
              DELAYED_STARTUP_TOPIC
            );
          } catch (removeError) {
            logger.error({
              event: "window.observer-cleanup-failed",
              phase: "window-manager-start",
              code: "FENNEVIA_WINDOW_OBSERVER_CLEANUP_FAILED",
              error: removeError,
            });
          }
          observerRegistered = false;
        }

        for (const record of Array.from(records.values())) {
          disposeRecord(
            record,
            "window-manager-start-failed",
            "FENNEVIA_WINDOW_MANAGER_START_FAILED"
          );
        }
        records.clear();
        throw error;
      }
    },

    stop() {
      if (state === "stopped") {
        return false;
      }

      state = "stopping";
      if (observerRegistered) {
        try {
          services.obs.removeObserver(
            delayedStartupObserver,
            DELAYED_STARTUP_TOPIC
          );
        } catch (error) {
          logger.error({
            event: "window.observer-cleanup-failed",
            phase: "window-manager-stop",
            code: "FENNEVIA_WINDOW_OBSERVER_CLEANUP_FAILED",
            error,
          });
        }
        observerRegistered = false;
      }

      for (const record of Array.from(records.values())) {
        disposeRecord(
          record,
          "runtime-stop",
          "FENNEVIA_WINDOW_RUNTIME_STOPPED"
        );
      }

      records.clear();
      state = "stopped";
      return true;
    },

    snapshot() {
      return Object.freeze({
        state,
        managedWindowCount: Array.from(records.values()).filter(
          record => record.status === "managed"
        ).length,
        initializingWindowCount: Array.from(records.values()).filter(
          record => record.status === "initializing"
        ).length,
        windows: Object.freeze(
          Array.from(records.values(), record =>
            Object.freeze({
              opaqueId: record.opaqueId,
              windowKind: record.windowKind,
              status: record.status,
            })
          )
        ),
      });
    },
  });
}
