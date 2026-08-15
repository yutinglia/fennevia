const PROCESS_STATE_KEY = Symbol.for("fennevia.runtime.process-state");
const SHUTDOWN_TOPIC = "quit-application-granted";

export function createProcessRuntime({ services, windowManager, logger }) {
  if (
    typeof services?.obs?.addObserver !== "function" ||
    typeof services?.obs?.removeObserver !== "function"
  ) {
    throw new Error("FENNEVIA_RUNTIME_OBSERVER_SERVICE_UNAVAILABLE");
  }
  if (
    typeof windowManager?.start !== "function" ||
    typeof windowManager?.stop !== "function" ||
    typeof windowManager?.snapshot !== "function"
  ) {
    throw new Error("FENNEVIA_RUNTIME_WINDOW_MANAGER_UNAVAILABLE");
  }
  if (
    typeof logger?.info !== "function" ||
    typeof logger?.error !== "function"
  ) {
    throw new Error("FENNEVIA_RUNTIME_LOGGER_UNAVAILABLE");
  }

  let state = "created";
  let initializationCount = 0;
  let shutdownObserverRegistered = false;

  const snapshot = () => {
    const windowSnapshot = windowManager.snapshot();
    return Object.freeze({
      state,
      initializationCount,
      managedWindowCount: windowSnapshot.managedWindowCount,
      initializingWindowCount: windowSnapshot.initializingWindowCount,
    });
  };

  const runtime = {
    start() {
      if (state !== "created") {
        return snapshot();
      }

      state = "starting";
      logger.info({
        event: "runtime.starting",
        phase: "runtime-start",
        code: "FENNEVIA_RUNTIME_STARTING",
      });

      try {
        services.obs.addObserver(shutdownObserver, SHUTDOWN_TOPIC);
        shutdownObserverRegistered = true;
        windowManager.start();
        initializationCount = 1;
        state = "started";
        logger.info({
          event: "runtime.started",
          phase: "runtime-ready",
          code: "FENNEVIA_RUNTIME_READY",
        });
        return snapshot();
      } catch (error) {
        state = "failed";
        try {
          windowManager.stop();
        } catch (cleanupError) {
          logger.error({
            event: "runtime.window-cleanup-failed",
            phase: "runtime-start",
            code: "FENNEVIA_RUNTIME_WINDOW_CLEANUP_FAILED",
            error: cleanupError,
          });
        }
        if (shutdownObserverRegistered) {
          try {
            services.obs.removeObserver(shutdownObserver, SHUTDOWN_TOPIC);
          } catch (removeError) {
            logger.error({
              event: "runtime.observer-cleanup-failed",
              phase: "runtime-start",
              code: "FENNEVIA_RUNTIME_OBSERVER_CLEANUP_FAILED",
              error: removeError,
            });
          }
          shutdownObserverRegistered = false;
        }
        logger.error({
          event: "runtime.start-failed",
          phase: "runtime-start",
          code: "FENNEVIA_RUNTIME_START_FAILED",
          error,
        });
        throw error;
      }
    },

    stop(phase = "runtime-stop") {
      if (state === "stopped") {
        return snapshot();
      }

      state = "stopping";
      if (shutdownObserverRegistered) {
        try {
          services.obs.removeObserver(shutdownObserver, SHUTDOWN_TOPIC);
        } catch (error) {
          logger.error({
            event: "runtime.observer-cleanup-failed",
            phase,
            code: "FENNEVIA_RUNTIME_OBSERVER_CLEANUP_FAILED",
            error,
          });
        }
        shutdownObserverRegistered = false;
      }

      windowManager.stop();
      state = "stopped";
      logger.info({
        event: "runtime.stopped",
        phase,
        code: "FENNEVIA_RUNTIME_STOPPED",
      });
      return snapshot();
    },

    snapshot,
  };

  const shutdownObserver = (subject, topic) => {
    if (topic === SHUTDOWN_TOPIC) {
      runtime.stop("application-shutdown");
    }
  };

  return Object.freeze(runtime);
}

export function startProcessRuntime({
  services,
  privateBrowsingUtils,
  logger,
  createWindowManager,
  initializeWindow,
  targetGlobal = globalThis,
}) {
  if (typeof createWindowManager !== "function") {
    throw new Error("FENNEVIA_RUNTIME_WINDOW_MANAGER_FACTORY_UNAVAILABLE");
  }

  const existingState = targetGlobal[PROCESS_STATE_KEY];
  if (existingState) {
    if (existingState.publicState) {
      return existingState.publicState;
    }
    throw new Error(
      existingState.status === "starting"
        ? "FENNEVIA_RUNTIME_START_IN_PROGRESS"
        : "FENNEVIA_RUNTIME_PREVIOUSLY_FAILED"
    );
  }

  const windowManager = createWindowManager({
    services,
    privateBrowsingUtils,
    logger,
    initializeWindow,
  });
  const runtime = createProcessRuntime({ services, windowManager, logger });
  const state = {
    publicState: null,
    runtime,
    status: "starting",
  };
  Object.defineProperty(targetGlobal, PROCESS_STATE_KEY, {
    value: state,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  try {
    const runtimeSnapshot = runtime.start();
    const result = Object.freeze({
      schemaVersion: 1,
      status: "ready",
      initializationCount: runtimeSnapshot.initializationCount,
      managedWindowCount: runtimeSnapshot.managedWindowCount,
    });
    state.publicState = Object.freeze({ runtime, result });
    state.status = "ready";
    return state.publicState;
  } catch (error) {
    state.status = "failed";
    throw error;
  }
}
