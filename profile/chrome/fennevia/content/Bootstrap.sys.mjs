const MODULE_STATE_KEY = Symbol.for(
  "fennevia.bootstrap-module.process-state"
);

if (typeof Services === "undefined" || !Services.appinfo) {
  throw new Error("FENNEVIA_BOOTSTRAP_SERVICES_UNAVAILABLE");
}

if (typeof ChromeUtils === "undefined") {
  throw new Error("FENNEVIA_BOOTSTRAP_CHROME_UTILS_UNAVAILABLE");
}

if (globalThis[MODULE_STATE_KEY]) {
  throw new Error("FENNEVIA_BOOTSTRAP_DUPLICATE_MODULE_INITIALIZATION");
}

const { PrivateBrowsingUtils } = ChromeUtils.importESModule(
  "resource://gre/modules/PrivateBrowsingUtils.sys.mjs"
);
const { createRuntimeLogger } = ChromeUtils.importESModule(
  "chrome://fennevia/content/runtime/Logger.sys.mjs"
);
const { createWindowManager } = ChromeUtils.importESModule(
  "chrome://fennevia/content/runtime/WindowManager.sys.mjs"
);
const { startProcessRuntime } = ChromeUtils.importESModule(
  "chrome://fennevia/content/runtime/Runtime.sys.mjs"
);
const { initializeWindowShell } = ChromeUtils.importESModule(
  "chrome://fennevia/content/runtime/WindowShell.sys.mjs"
);

const logger = createRuntimeLogger({
  consoleService: Services.console,
  appInfo: Services.appinfo,
});
const runtimeState = startProcessRuntime({
  services: Services,
  privateBrowsingUtils: PrivateBrowsingUtils,
  logger,
  createWindowManager,
  initializeWindow(context) {
    return initializeWindowShell({
      context,
      logger,
      appInfo: Services.appinfo,
    });
  },
});

const result = Object.freeze({
  schemaVersion: 1,
  status: runtimeState.result.status,
  initializationCount: runtimeState.result.initializationCount,
  managedWindowCount: runtimeState.result.managedWindowCount,
  firefoxVersion: String(Services.appinfo.version),
  buildId: String(Services.appinfo.appBuildID),
});

Object.defineProperty(globalThis, MODULE_STATE_KEY, {
  value: result,
  configurable: false,
  enumerable: false,
  writable: false,
});

export const bootstrapResult = result;
