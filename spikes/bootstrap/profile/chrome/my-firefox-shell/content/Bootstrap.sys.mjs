const MODULE_STATE_KEY = Symbol.for(
  "my-firefox-shell.bootstrap-module.process-state"
);

if (typeof Services === "undefined" || !Services.appinfo) {
  throw new Error("MFS_BOOTSTRAP_SERVICES_UNAVAILABLE");
}

if (globalThis[MODULE_STATE_KEY]) {
  throw new Error("MFS_BOOTSTRAP_DUPLICATE_MODULE_INITIALIZATION");
}

const result = Object.freeze({
  schemaVersion: 1,
  status: "ready",
  initializationCount: 1,
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
