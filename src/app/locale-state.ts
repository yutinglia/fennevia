export const fenneviaLocales = Object.freeze(["en", "zh-Hant"] as const);

export type FenneviaLocale = (typeof fenneviaLocales)[number];

export const defaultFenneviaLocale: FenneviaLocale = "en";

export type LocaleSnapshot = Readonly<{
  id: FenneviaLocale;
}>;

export type BrowserLocaleBridge = Readonly<{
  snapshot: () => LocaleSnapshot;
  subscribe: (listener: (snapshot: LocaleSnapshot) => void) => () => boolean;
}>;

export type BrowserLocaleStateAdapter = Readonly<{
  dispose: () => boolean;
  snapshot: () => LocaleSnapshot;
  status: () => Readonly<{
    disposed: boolean;
  }>;
  subscribe: (listener: (snapshot: LocaleSnapshot) => void) => () => boolean;
}>;

const localeSet = new Set<string>(fenneviaLocales);

const createStateError = (code: string): Error => {
  const error = new Error(code);
  error.name = "FenneviaLocaleStateError";
  Object.defineProperties(error, {
    fenneviaCode: { enumerable: false, value: code },
    fenneviaPhase: { enumerable: false, value: "locale-state" },
  });
  return error;
};

const canonicalizeLanguageTag = (value: string): string =>
  value.trim().replaceAll("_", "-").toLowerCase();

const tagMatches = (normalized: string, prefix: string): boolean =>
  normalized === prefix || normalized.startsWith(`${prefix}-`);

export function isFenneviaLocale(value: unknown): value is FenneviaLocale {
  return typeof value === "string" && localeSet.has(value);
}

export function mapAppLocaleToFennevia(value: unknown): FenneviaLocale {
  if (typeof value !== "string" || value.trim().length === 0) {
    return defaultFenneviaLocale;
  }
  const normalized = canonicalizeLanguageTag(value);
  // Temporary: every Chinese UI tag uses Traditional Chinese copy until a
  // dedicated Simplified catalog exists.
  if (tagMatches(normalized, "zh")) {
    return "zh-Hant";
  }
  return defaultFenneviaLocale;
}

export function copyLocaleSnapshot(candidate: LocaleSnapshot): LocaleSnapshot {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    !isFenneviaLocale(candidate.id)
  ) {
    throw createStateError("FENNEVIA_LOCALE_STATE_SNAPSHOT_INVALID");
  }
  return Object.freeze({
    id: candidate.id,
  });
}

export function createStaticLocaleBridge(
  id: FenneviaLocale = defaultFenneviaLocale,
): BrowserLocaleBridge {
  if (!isFenneviaLocale(id)) {
    throw createStateError("FENNEVIA_LOCALE_STATE_SNAPSHOT_INVALID");
  }
  const snapshot = Object.freeze({ id });
  return Object.freeze({
    snapshot(): LocaleSnapshot {
      return snapshot;
    },
    subscribe() {
      return () => false;
    },
  });
}

export function createBrowserLocaleStateAdapter(
  bridge: BrowserLocaleBridge,
): BrowserLocaleStateAdapter {
  if (
    !bridge ||
    typeof bridge !== "object" ||
    typeof bridge.snapshot !== "function" ||
    typeof bridge.subscribe !== "function"
  ) {
    throw createStateError("FENNEVIA_LOCALE_STATE_BRIDGE_INVALID");
  }

  let activeBridge: BrowserLocaleBridge | null = bridge;
  let disposed = false;
  let snapshot = copyLocaleSnapshot(bridge.snapshot());
  const listeners = new Set<(snapshot: LocaleSnapshot) => void>();
  const unsubscribeBridge = bridge.subscribe((nextSnapshot) => {
    if (disposed) {
      return;
    }
    const copied = copyLocaleSnapshot(nextSnapshot);
    if (copied.id === snapshot.id) {
      return;
    }
    snapshot = copied;
    for (const listener of Array.from(listeners)) {
      listener(snapshot);
    }
  });

  if (typeof unsubscribeBridge !== "function") {
    throw createStateError("FENNEVIA_LOCALE_STATE_SUBSCRIPTION_INVALID");
  }

  const requireBridge = (): BrowserLocaleBridge => {
    if (disposed || !activeBridge) {
      throw createStateError("FENNEVIA_LOCALE_STATE_DISPOSED");
    }
    return activeBridge;
  };

  return Object.freeze({
    dispose(): boolean {
      if (disposed) {
        return false;
      }
      disposed = true;
      activeBridge = null;
      listeners.clear();
      unsubscribeBridge();
      return true;
    },

    snapshot(): LocaleSnapshot {
      requireBridge();
      return snapshot;
    },

    status() {
      return Object.freeze({ disposed });
    },

    subscribe(listener: (snapshot: LocaleSnapshot) => void) {
      if (typeof listener !== "function") {
        throw createStateError("FENNEVIA_LOCALE_STATE_LISTENER_INVALID");
      }
      requireBridge();
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}
