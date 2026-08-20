import {
  copyLocaleSnapshot,
  createStaticLocaleBridge,
  defaultFenneviaLocale,
  mapAppLocaleToFennevia,
  type BrowserLocaleBridge,
  type LocaleSnapshot,
} from "../app/locale-state.ts";
import { translate } from "../app/i18n.ts";
import {
  FirefoxBridgeError,
  type FirefoxBridgeBoundary,
  type FirefoxBridgeErrorContext,
  type FirefoxCapabilitySnapshot,
} from "./bridge-boundary.ts";

type NativeRecord = Record<string, unknown>;

type LocaleCapabilityEvaluation = Readonly<{
  cause?: unknown;
  snapshot: FirefoxCapabilitySnapshot;
}>;

type NativeObserverService = NativeRecord & {
  addObserver: (...args: unknown[]) => unknown;
  removeObserver: (...args: unknown[]) => unknown;
};

const APP_LOCALES_CHANGED_TOPIC = "intl:app-locales-changed";

export const shellChromeHostNames = Object.freeze([
  "frame",
  "overlay",
  "top",
  "left",
  "right",
  "bottom",
] as const);

export type ShellChromeHostName = (typeof shellChromeHostNames)[number];

const chromeHostMessageKeys = Object.freeze({
  bottom: "chrome.host.bottom",
  frame: "chrome.host.frame",
  left: "chrome.host.left",
  overlay: "chrome.host.overlay",
  right: "chrome.host.right",
  top: "chrome.host.top",
} as const);

const isNativeRecord = (value: unknown): value is NativeRecord =>
  typeof value === "object" && value !== null;

const isFunction = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === "function";

const readLocaleService = (window: NativeRecord): NativeRecord | null => {
  const services = window.Services;
  if (!isNativeRecord(services)) {
    return null;
  }
  const locale = services.locale;
  if (!isNativeRecord(locale)) {
    return null;
  }
  return locale;
};

const readObserverService = (
  window: NativeRecord,
): NativeObserverService | null => {
  const services = window.Services;
  if (!isNativeRecord(services)) {
    return null;
  }
  const obs = services.obs;
  if (
    !isNativeRecord(obs) ||
    !isFunction(obs.addObserver) ||
    !isFunction(obs.removeObserver)
  ) {
    return null;
  }
  return obs as NativeObserverService;
};

const localeCapabilitySpecifications = Object.freeze([
  Object.freeze({
    isAvailable: (value: unknown) => value !== null,
    name: "locale.app-locale",
    read: (window: NativeRecord) => readLocaleService(window),
    requirement: "optional" as const,
    symbol: "window.Services.locale.appLocaleAsBCP47",
  }),
  Object.freeze({
    isAvailable: (value: unknown) => value !== null,
    name: "locale.app-locales-observer",
    read: (window: NativeRecord) => readObserverService(window),
    requirement: "optional" as const,
    symbol: "window.Services.obs.addObserver.removeObserver",
  }),
]);

const evaluateLocaleCapabilities = (
  window: NativeRecord,
): readonly LocaleCapabilityEvaluation[] =>
  Object.freeze(
    localeCapabilitySpecifications.map((specification) => {
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
          requirement: specification.requirement,
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

const createLocaleError = (
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

const readAppLocaleTag = (window: NativeRecord): string => {
  const locale = readLocaleService(window);
  if (!locale) {
    return "";
  }
  try {
    const value = locale.appLocaleAsBCP47;
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
};

const readSnapshot = (window: NativeRecord): LocaleSnapshot =>
  Object.freeze({
    id: mapAppLocaleToFennevia(readAppLocaleTag(window)),
  });

export const getShellChromeHostLabel = (
  locale: LocaleSnapshot["id"],
  host: ShellChromeHostName,
): string => translate(locale, chromeHostMessageKeys[host]);

export type FirefoxLocaleBridgeController = Readonly<{
  assertRequiredCapabilities: () => readonly FirefoxCapabilitySnapshot[];
  dispose: () => boolean;
  locale: BrowserLocaleBridge;
  snapshot: () => Readonly<{
    disposed: boolean;
  }>;
}>;

export function createFirefoxLocaleBridge({
  boundary,
  onError,
  window,
}: Readonly<{
  boundary: FirefoxBridgeBoundary;
  onError?: (error: unknown) => void;
  window: unknown;
}>): FirefoxLocaleBridgeController {
  boundary.assertOwnsWindow(window);
  if (!isNativeRecord(window)) {
    throw createLocaleError(
      boundary,
      "FENNEVIA_FIREFOX_LOCALE_OPTIONS_INVALID",
      "firefox-locale-create",
      "window",
    );
  }

  const reportError =
    typeof onError === "function"
      ? onError
      : () => {
          // Optional locale never fails the window.
        };

  let nativeWindow: NativeRecord | null = window;
  let disposed = false;
  const listeners = new Set<(snapshot: LocaleSnapshot) => void>();
  let observerAttached = false;
  const observer = Object.freeze({
    observe() {
      notify();
    },
  });

  const requireWindow = (): NativeRecord => {
    if (disposed || !nativeWindow) {
      throw createLocaleError(
        boundary,
        "FENNEVIA_FIREFOX_LOCALE_DISPOSED",
        "firefox-locale-access",
        "window",
      );
    }
    return nativeWindow;
  };

  const notify = (): void => {
    let snapshot: LocaleSnapshot;
    try {
      snapshot = readSnapshot(requireWindow());
    } catch (error) {
      reportError(error);
      return;
    }
    for (const listener of Array.from(listeners)) {
      try {
        listener(snapshot);
      } catch (error) {
        reportError(
          createLocaleError(
            boundary,
            "FENNEVIA_FIREFOX_LOCALE_SUBSCRIBER_FAILED",
            "firefox-locale-notify",
            "locale.subscribe",
            error,
          ),
        );
      }
    }
  };

  const detachObserver = (): void => {
    if (!observerAttached || !nativeWindow) {
      observerAttached = false;
      return;
    }
    const obs = readObserverService(nativeWindow);
    if (obs) {
      try {
        Reflect.apply(obs.removeObserver, obs, [
          observer,
          APP_LOCALES_CHANGED_TOPIC,
        ]);
      } catch {
        // Observer removal is best-effort during dispose.
      }
    }
    observerAttached = false;
  };

  const obs = readObserverService(window);
  if (obs) {
    try {
      Reflect.apply(obs.addObserver, obs, [
        observer,
        APP_LOCALES_CHANGED_TOPIC,
      ]);
      observerAttached = true;
    } catch (error) {
      reportError(
        createLocaleError(
          boundary,
          "FENNEVIA_FIREFOX_LOCALE_SUBSCRIBE_FAILED",
          "firefox-locale-subscribe",
          "window.Services.obs.addObserver",
          error,
        ),
      );
    }
  }

  const publicBridge: BrowserLocaleBridge = Object.freeze({
    snapshot(): LocaleSnapshot {
      return copyLocaleSnapshot(readSnapshot(requireWindow()));
    },
    subscribe(listener: (snapshot: LocaleSnapshot) => void) {
      if (typeof listener !== "function") {
        throw createLocaleError(
          boundary,
          "FENNEVIA_FIREFOX_LOCALE_LISTENER_INVALID",
          "firefox-locale-subscribe",
          "locale.subscribe",
        );
      }
      requireWindow();
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });

  return Object.freeze({
    assertRequiredCapabilities(): readonly FirefoxCapabilitySnapshot[] {
      const evaluations = evaluateLocaleCapabilities(requireWindow());
      const missing = evaluations.find(
        (evaluation) =>
          evaluation.snapshot.requirement === "required" &&
          !evaluation.snapshot.available,
      );
      if (missing) {
        throw createLocaleError(
          boundary,
          "FENNEVIA_FIREFOX_LOCALE_CAPABILITY_MISSING",
          "firefox-locale-capability",
          missing.snapshot.symbol,
          missing.cause,
        );
      }
      return Object.freeze(
        evaluations.map((evaluation) => evaluation.snapshot),
      );
    },
    dispose(): boolean {
      if (disposed) {
        return false;
      }
      disposed = true;
      detachObserver();
      nativeWindow = null;
      listeners.clear();
      return true;
    },
    locale: publicBridge,
    snapshot() {
      return Object.freeze({ disposed });
    },
  });
}

export { createStaticLocaleBridge, defaultFenneviaLocale };
