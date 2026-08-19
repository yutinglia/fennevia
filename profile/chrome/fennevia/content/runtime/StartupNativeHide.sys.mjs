const STARTUP_NATIVE_HIDE_URI =
  "chrome://fennevia/content/runtime/StartupNativeHide.css";
const STARTUP_NATIVE_HIDE_TIMEOUT_MS = 2_000;
const STYLE_SHEET_SERVICE_CONTRACT =
  "@mozilla.org/content/style-sheet-service;1";

const idleRegistration = Object.freeze({
  registered: false,
  dispose() {
    return false;
  },
});

function getDefaultStyleSheetService() {
  try {
    if (typeof Cc === "undefined" || typeof Ci === "undefined") {
      return null;
    }
    return Cc[STYLE_SHEET_SERVICE_CONTRACT].getService(Ci.nsIStyleSheetService);
  } catch {
    return null;
  }
}

function getDefaultIOService() {
  try {
    if (typeof Services === "undefined") {
      return null;
    }
    return Services.io;
  } catch {
    return null;
  }
}

export function registerStartupNativeHide({
  styleSheetService = getDefaultStyleSheetService(),
  io = getDefaultIOService(),
} = {}) {
  if (
    typeof styleSheetService?.loadAndRegisterSheet !== "function" ||
    typeof styleSheetService?.sheetRegistered !== "function" ||
    typeof styleSheetService?.unregisterSheet !== "function" ||
    typeof styleSheetService.AUTHOR_SHEET !== "number" ||
    typeof io?.newURI !== "function"
  ) {
    return idleRegistration;
  }

  const sheetType = styleSheetService.AUTHOR_SHEET;
  const sheetURI = io.newURI(STARTUP_NATIVE_HIDE_URI);
  if (!styleSheetService.sheetRegistered(sheetURI, sheetType)) {
    styleSheetService.loadAndRegisterSheet(sheetURI, sheetType);
  }

  let disposed = false;
  return Object.freeze({
    registered: true,
    dispose() {
      if (disposed) {
        return false;
      }
      disposed = true;
      if (styleSheetService.sheetRegistered(sheetURI, sheetType)) {
        styleSheetService.unregisterSheet(sheetURI, sheetType);
      }
      return true;
    },
  });
}

export const startupNativeHideUri = STARTUP_NATIVE_HIDE_URI;
export const startupNativeHideTimeoutMs = STARTUP_NATIVE_HIDE_TIMEOUT_MS;
