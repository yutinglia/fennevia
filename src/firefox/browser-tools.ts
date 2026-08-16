import {
  isBrowserToolAction,
  type BrowserToolAction,
  type BrowserToolsBridge,
  type BrowserToolsSnapshot,
} from "../app/browser-tools-state.ts";
import {
  FirefoxBridgeError,
  type FirefoxBridgeBoundary,
  type FirefoxBridgeErrorContext,
  type FirefoxCapabilitySnapshot,
} from "./bridge-boundary.ts";

type NativeRecord = Record<string, unknown>;

type BrowserToolCapabilityEvaluation = Readonly<{
  cause?: unknown;
  snapshot: FirefoxCapabilitySnapshot;
}>;

type BrowserToolCapabilitySpecification = Readonly<{
  isAvailable: (value: unknown) => boolean;
  name: string;
  read: (window: NativeRecord) => unknown;
  symbol: string;
}>;

const isNativeRecord = (value: unknown): value is NativeRecord =>
  typeof value === "object" && value !== null;

const isFunction = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === "function";

const isNativeActionTarget = (value: unknown): value is NativeRecord =>
  isNativeRecord(value) && isFunction(value.click) && isFunction(value.focus);

const getDocumentElementById = (window: NativeRecord, id: string): unknown => {
  const document = window.document;
  if (!isNativeRecord(document) || !isFunction(document.getElementById)) {
    return undefined;
  }
  return Reflect.apply(document.getElementById, document, [id]);
};

const defineBrowserToolCapability = (
  specification: BrowserToolCapabilitySpecification,
): BrowserToolCapabilitySpecification => Object.freeze(specification);

const browserToolCapabilitySpecifications: ReadonlyArray<BrowserToolCapabilitySpecification> =
  Object.freeze([
    defineBrowserToolCapability({
      isAvailable: (value) =>
        isNativeActionTarget(value) && isFunction(value.checkVisibility),
      name: "browser-tools.trust-anchor",
      read: (window) => getDocumentElementById(window, "trust-icon-container"),
      symbol: "document.trust-icon-container.click.focus.checkVisibility",
    }),
    defineBrowserToolCapability({
      isAvailable: isNativeActionTarget,
      name: "browser-tools.identity-anchor",
      read: (window) => getDocumentElementById(window, "identity-icon-box"),
      symbol: "document.identity-icon-box.click.focus",
    }),
    defineBrowserToolCapability({
      isAvailable: isNativeActionTarget,
      name: "browser-tools.protections-anchor",
      read: (window) =>
        getDocumentElementById(window, "tracking-protection-icon-container"),
      symbol: "document.tracking-protection-icon-container.click.focus",
    }),
    defineBrowserToolCapability({
      isAvailable: isNativeActionTarget,
      name: "browser-tools.permissions-anchor",
      read: (window) =>
        getDocumentElementById(window, "identity-permission-box"),
      symbol: "document.identity-permission-box.click.focus",
    }),
    defineBrowserToolCapability({
      isAvailable: isNativeActionTarget,
      name: "browser-tools.downloads-anchor",
      read: (window) => getDocumentElementById(window, "downloads-button"),
      symbol: "document.downloads-button.click.focus",
    }),
    defineBrowserToolCapability({
      isAvailable: isFunction,
      name: "browser-tools.unified-extensions",
      read: (window) =>
        isNativeRecord(window.gUnifiedExtensions)
          ? window.gUnifiedExtensions.togglePanel
          : undefined,
      symbol: "window.gUnifiedExtensions.togglePanel",
    }),
    defineBrowserToolCapability({
      isAvailable: isFunction,
      name: "browser-tools.application-menu",
      read: (window) =>
        isNativeRecord(window.PanelUI) ? window.PanelUI.show : undefined,
      symbol: "window.PanelUI.show",
    }),
    defineBrowserToolCapability({
      isAvailable: isFunction,
      name: "browser-tools.settings",
      read: (window) => window.openPreferences,
      symbol: "window.openPreferences",
    }),
    defineBrowserToolCapability({
      isAvailable: isFunction,
      name: "browser-tools.customize",
      read: (window) =>
        isNativeRecord(window.gCustomizeMode)
          ? window.gCustomizeMode.enter
          : undefined,
      symbol: "window.gCustomizeMode.enter",
    }),
    defineBrowserToolCapability({
      isAvailable: (value) => isNativeRecord(value) && isFunction(value.focus),
      name: "browser-tools.native-toolbar-focus",
      read: (window) => getDocumentElementById(window, "back-button"),
      symbol: "document.back-button.focus",
    }),
    defineBrowserToolCapability({
      isAvailable: isNativeActionTarget,
      name: "browser-tools.extensions-anchor",
      read: (window) =>
        getDocumentElementById(window, "unified-extensions-button"),
      symbol: "document.unified-extensions-button.click.focus",
    }),
    defineBrowserToolCapability({
      isAvailable: isNativeActionTarget,
      name: "browser-tools.application-menu-anchor",
      read: (window) => getDocumentElementById(window, "PanelUI-menu-button"),
      symbol: "document.PanelUI-menu-button.click.focus",
    }),
  ]);

const evaluateBrowserToolCapabilities = (
  window: NativeRecord,
): readonly BrowserToolCapabilityEvaluation[] =>
  Object.freeze(
    browserToolCapabilitySpecifications.map((specification) => {
      let available = false;
      let cause: unknown;
      try {
        available = specification.isAvailable(specification.read(window));
      } catch (error) {
        cause = error;
      }
      return Object.freeze({
        ...(cause === undefined ? {} : { cause }),
        snapshot: Object.freeze({
          available,
          name: specification.name,
          requirement: "required" as const,
          symbol: specification.symbol,
        }),
      });
    }),
  );

const getErrorContext = (
  boundary: FirefoxBridgeBoundary,
): FirefoxBridgeErrorContext => {
  const snapshot = boundary.snapshot();
  return Object.freeze({
    buildId: snapshot.buildId,
    firefoxVersion: snapshot.firefoxVersion,
    windowKind: snapshot.windowKind,
  });
};

const createBrowserToolsError = (
  boundary: FirefoxBridgeBoundary,
  code: string,
  phase: string,
  symbol: string,
  cause?: unknown,
): FirefoxBridgeError =>
  new FirefoxBridgeError({
    cause,
    code,
    context: getErrorContext(boundary),
    phase,
    symbol,
  });

const createSnapshot = (
  evaluations: readonly BrowserToolCapabilityEvaluation[],
): BrowserToolsSnapshot => {
  const available = (name: string): boolean =>
    evaluations.some(
      (evaluation) =>
        evaluation.snapshot.name === name && evaluation.snapshot.available,
    );
  return Object.freeze({
    applicationMenu: available("browser-tools.application-menu"),
    customize: available("browser-tools.customize"),
    downloads: available("browser-tools.downloads-anchor"),
    extensions: available("browser-tools.unified-extensions"),
    nativeToolbar: available("browser-tools.native-toolbar-focus"),
    protections:
      available("browser-tools.trust-anchor") &&
      available("browser-tools.protections-anchor"),
    settings: available("browser-tools.settings"),
    siteInformation:
      available("browser-tools.trust-anchor") &&
      available("browser-tools.identity-anchor"),
    sitePermissions: available("browser-tools.permissions-anchor"),
  });
};

export type FirefoxBrowserToolsBridgeController = Readonly<{
  assertRequiredCapabilities: () => readonly FirefoxCapabilitySnapshot[];
  browserTools: BrowserToolsBridge;
  dispose: () => boolean;
  snapshot: () => Readonly<{
    disposed: boolean;
    pendingActionCount: number;
  }>;
}>;

export function createFirefoxBrowserToolsBridge({
  boundary,
  requestNativeUiReveal,
  window,
}: Readonly<{
  boundary: FirefoxBridgeBoundary;
  requestNativeUiReveal: () => boolean;
  window: unknown;
}>): FirefoxBrowserToolsBridgeController {
  boundary.assertOwnsWindow(window);
  if (!isNativeRecord(window) || typeof requestNativeUiReveal !== "function") {
    throw createBrowserToolsError(
      boundary,
      "FENNEVIA_FIREFOX_BROWSER_TOOLS_OPTIONS_INVALID",
      "firefox-browser-tools-create",
      "window",
    );
  }

  let nativeWindow: NativeRecord | null = window;
  let disposed = false;
  let pendingActionCount = 0;

  const requireWindow = (): NativeRecord => {
    if (disposed || !nativeWindow) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_DISPOSED",
        "firefox-browser-tools-access",
        "window",
      );
    }
    return nativeWindow;
  };

  const assertRequiredCapabilities =
    (): readonly FirefoxCapabilitySnapshot[] => {
      const evaluations = evaluateBrowserToolCapabilities(requireWindow());
      const missing = evaluations.find(
        (evaluation) => !evaluation.snapshot.available,
      );
      if (missing) {
        throw createBrowserToolsError(
          boundary,
          "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING",
          "firefox-browser-tools-capability",
          missing.snapshot.symbol,
          missing.cause,
        );
      }
      return Object.freeze(
        evaluations.map((evaluation) => evaluation.snapshot),
      );
    };

  const revealNativeToolbar = (): void => {
    let revealed: boolean;
    try {
      revealed = requestNativeUiReveal() === true;
    } catch (error) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_REVEAL_FAILED",
        "firefox-browser-tools-reveal",
        "nativeUi.revealForToolbar",
        error,
      );
    }
    if (!revealed) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_REVEAL_REJECTED",
        "firefox-browser-tools-reveal",
        "nativeUi.revealForToolbar",
      );
    }
  };

  const invokeMethod = async (
    owner: NativeRecord,
    methodName: string,
    symbol: string,
  ): Promise<void> => {
    const method = owner[methodName];
    if (!isFunction(method)) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING",
        "firefox-browser-tools-action",
        symbol,
      );
    }
    try {
      await Reflect.apply(method, owner, []);
    } catch (error) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED",
        "firefox-browser-tools-action",
        symbol,
        error,
      );
    }
  };

  const requireNativeActionTarget = (
    ownerWindow: NativeRecord,
    id: string,
  ): NativeRecord => {
    const target = getDocumentElementById(ownerWindow, id);
    if (!isNativeActionTarget(target)) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING",
        "firefox-browser-tools-action",
        `document.${id}.click.focus`,
      );
    }
    return target;
  };

  const focusNativeActionTarget = (
    target: NativeRecord,
    symbol: string,
  ): void => {
    try {
      Reflect.apply(target.focus as (...args: unknown[]) => unknown, target, [
        Object.freeze({ preventScroll: true }),
      ]);
    } catch (error) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED",
        "firefox-browser-tools-action",
        symbol,
        error,
      );
    }
  };

  const activateNativeTarget = async (
    ownerWindow: NativeRecord,
    id: string,
  ): Promise<void> => {
    revealNativeToolbar();
    const target = requireNativeActionTarget(ownerWindow, id);
    focusNativeActionTarget(target, `document.${id}.focus`);
    try {
      await Reflect.apply(
        target.click as (...args: unknown[]) => unknown,
        target,
        [],
      );
    } catch (error) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED",
        "firefox-browser-tools-action",
        `document.${id}.click`,
        error,
      );
    }
  };

  const activateTrustOrLegacyTarget = async (
    ownerWindow: NativeRecord,
    legacyTargetId: "identity-icon-box" | "tracking-protection-icon-container",
  ): Promise<void> => {
    revealNativeToolbar();
    const trustTarget = requireNativeActionTarget(
      ownerWindow,
      "trust-icon-container",
    );
    const checkVisibility = trustTarget.checkVisibility;
    if (!isFunction(checkVisibility)) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING",
        "firefox-browser-tools-action",
        "document.trust-icon-container.checkVisibility",
      );
    }
    let trustVisible: boolean;
    try {
      trustVisible = Reflect.apply(checkVisibility, trustTarget, []) === true;
    } catch (error) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED",
        "firefox-browser-tools-action",
        "document.trust-icon-container.checkVisibility",
        error,
      );
    }
    const targetId = trustVisible ? "trust-icon-container" : legacyTargetId;
    const target = trustVisible
      ? trustTarget
      : requireNativeActionTarget(ownerWindow, targetId);
    focusNativeActionTarget(target, `document.${targetId}.focus`);
    try {
      await Reflect.apply(
        target.click as (...args: unknown[]) => unknown,
        target,
        [],
      );
    } catch (error) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED",
        "firefox-browser-tools-action",
        `document.${targetId}.click`,
        error,
      );
    }
  };

  const invoke = async (action: BrowserToolAction): Promise<boolean> => {
    if (!isBrowserToolAction(action)) {
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID",
        "firefox-browser-tools-action",
        "browser-tools.action",
      );
    }
    const ownerWindow = requireWindow();
    pendingActionCount += 1;
    try {
      switch (action) {
        case "site-information": {
          await activateTrustOrLegacyTarget(ownerWindow, "identity-icon-box");
          return true;
        }

        case "protections": {
          await activateTrustOrLegacyTarget(
            ownerWindow,
            "tracking-protection-icon-container",
          );
          return true;
        }

        case "site-permissions": {
          await activateNativeTarget(ownerWindow, "identity-permission-box");
          return true;
        }

        case "downloads": {
          await activateNativeTarget(ownerWindow, "downloads-button");
          return true;
        }

        case "extensions": {
          revealNativeToolbar();
          const anchor = requireNativeActionTarget(
            ownerWindow,
            "unified-extensions-button",
          );
          focusNativeActionTarget(
            anchor,
            "document.unified-extensions-button.focus",
          );
          if (!isNativeRecord(ownerWindow.gUnifiedExtensions)) {
            throw createBrowserToolsError(
              boundary,
              "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING",
              "firefox-browser-tools-action",
              "window.gUnifiedExtensions.togglePanel",
            );
          }
          await invokeMethod(
            ownerWindow.gUnifiedExtensions,
            "togglePanel",
            "window.gUnifiedExtensions.togglePanel",
          );
          return true;
        }

        case "application-menu": {
          revealNativeToolbar();
          const anchor = requireNativeActionTarget(
            ownerWindow,
            "PanelUI-menu-button",
          );
          focusNativeActionTarget(anchor, "document.PanelUI-menu-button.focus");
          if (!isNativeRecord(ownerWindow.PanelUI)) {
            throw createBrowserToolsError(
              boundary,
              "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING",
              "firefox-browser-tools-action",
              "window.PanelUI.show",
            );
          }
          await invokeMethod(
            ownerWindow.PanelUI,
            "show",
            "window.PanelUI.show",
          );
          return true;
        }

        case "settings": {
          await invokeMethod(
            ownerWindow,
            "openPreferences",
            "window.openPreferences",
          );
          return true;
        }

        case "customize": {
          if (!isNativeRecord(ownerWindow.gCustomizeMode)) {
            throw createBrowserToolsError(
              boundary,
              "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING",
              "firefox-browser-tools-action",
              "window.gCustomizeMode.enter",
            );
          }
          await invokeMethod(
            ownerWindow.gCustomizeMode,
            "enter",
            "window.gCustomizeMode.enter",
          );
          return true;
        }

        case "native-toolbar": {
          revealNativeToolbar();
          const focusTarget = getDocumentElementById(
            ownerWindow,
            "back-button",
          );
          if (!isNativeRecord(focusTarget) || !isFunction(focusTarget.focus)) {
            throw createBrowserToolsError(
              boundary,
              "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING",
              "firefox-browser-tools-action",
              "document.back-button.focus",
            );
          }
          try {
            Reflect.apply(focusTarget.focus, focusTarget, [
              Object.freeze({ preventScroll: true }),
            ]);
          } catch (error) {
            throw createBrowserToolsError(
              boundary,
              "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED",
              "firefox-browser-tools-action",
              "document.back-button.focus",
              error,
            );
          }
          return true;
        }
      }
      throw createBrowserToolsError(
        boundary,
        "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID",
        "firefox-browser-tools-action",
        "browser-tools.action",
      );
    } finally {
      pendingActionCount -= 1;
    }
  };

  const publicBridge: BrowserToolsBridge = Object.freeze({
    invoke,
    snapshot(): BrowserToolsSnapshot {
      return createSnapshot(evaluateBrowserToolCapabilities(requireWindow()));
    },
  });

  boundary.assertRequiredCapabilities();
  assertRequiredCapabilities();

  return Object.freeze({
    assertRequiredCapabilities,
    browserTools: publicBridge,

    dispose(): boolean {
      if (disposed) {
        return false;
      }
      disposed = true;
      nativeWindow = null;
      return true;
    },

    snapshot() {
      return Object.freeze({ disposed, pendingActionCount });
    },
  });
}
