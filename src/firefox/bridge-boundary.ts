const BROWSER_DOCUMENT_URI = "chrome://browser/content/browser.xhtml";
const APP_METADATA_PATTERN = /^[A-Za-z0-9._+-]{1,64}$/u;
const CONTEXT_ID_PATTERN = /^window-[a-z0-9-]{1,64}$/u;
const ERROR_CODE_PATTERN = /^FENNEVIA_[A-Z0-9_]{1,95}$/u;
const EVENT_TYPE_PATTERN = /^[A-Za-z][A-Za-z0-9:-]{0,63}$/u;
const HANDLE_KIND_PATTERN = /^[a-z][a-z0-9-]{0,31}$/u;
const HANDLE_ID_PATTERN =
  /^[a-z][a-z0-9-]{0,31}-registry-[1-9][0-9]*-handle-[1-9][0-9]*$/u;
const PHASE_PATTERN = /^[a-z][a-z0-9-]{0,95}$/u;
const SYMBOL_PATTERN = /^[A-Za-z][A-Za-z0-9.[\]-]{0,127}$/u;

export type FirefoxWindowKind = "normal" | "private";
export type FirefoxCapabilityRequirement = "required" | "optional";
export type IdempotentDisposer = () => boolean;

export type FirefoxBridgeErrorContext = Readonly<{
  buildId: string;
  firefoxVersion: string;
  windowKind: FirefoxWindowKind;
}>;

export type FirefoxCapabilitySnapshot = Readonly<{
  available: boolean;
  name: string;
  requirement: FirefoxCapabilityRequirement;
  symbol: string;
}>;

export type FirefoxBridgeDiagnostic = Readonly<{
  buildId: string;
  code: string;
  firefoxVersion: string;
  phase: string;
  symbol: string;
  windowKind: FirefoxWindowKind;
}>;

type NativeRecord = Record<string, unknown>;

type CapabilityEvaluation = Readonly<{
  cause?: unknown;
  snapshot: FirefoxCapabilitySnapshot;
}>;

type CapabilitySpecification = Readonly<{
  isAvailable: (value: unknown) => boolean;
  name: string;
  read: (window: NativeRecord) => unknown;
  requirement: FirefoxCapabilityRequirement;
  symbol: string;
}>;

type BridgeEventTarget = Readonly<{
  addEventListener: (
    type: string,
    listener: (event: unknown) => void,
    options?: unknown,
  ) => void;
  removeEventListener: (
    type: string,
    listener: (event: unknown) => void,
    options?: unknown,
  ) => void;
}>;

const activeContextIds = new Set<string>();
const activeWindows = new WeakMap<object, string>();
let nextRegistrySequence = 0;

const isNativeObject = (value: unknown): value is object =>
  (typeof value === "object" && value !== null) || typeof value === "function";

const isNativeRecord = (value: unknown): value is NativeRecord =>
  typeof value === "object" && value !== null;

const isEventTarget = (value: unknown): value is BridgeEventTarget =>
  isNativeRecord(value) &&
  typeof value.addEventListener === "function" &&
  typeof value.removeEventListener === "function";

const normalizeAppMetadata = (value: unknown): string => {
  const candidate = String(value ?? "");
  return APP_METADATA_PATTERN.test(candidate) ? candidate : "unknown";
};

const normalizeErrorContext = (
  context: FirefoxBridgeErrorContext,
): FirefoxBridgeErrorContext =>
  Object.freeze({
    buildId: normalizeAppMetadata(context?.buildId),
    firefoxVersion: normalizeAppMetadata(context?.firefoxVersion),
    windowKind: context?.windowKind === "private" ? "private" : "normal",
  });

export class FirefoxBridgeError extends Error {
  declare readonly fenneviaBuildId: string;
  declare readonly fenneviaCode: string;
  declare readonly fenneviaFirefoxVersion: string;
  declare readonly fenneviaPhase: string;
  declare readonly fenneviaSymbol: string;
  declare readonly fenneviaWindowKind: FirefoxWindowKind;

  constructor({
    cause,
    code,
    context,
    phase,
    symbol,
  }: Readonly<{
    cause?: unknown;
    code: string;
    context: FirefoxBridgeErrorContext;
    phase: string;
    symbol: string;
  }>) {
    const safeCode = ERROR_CODE_PATTERN.test(code)
      ? code
      : "FENNEVIA_FIREFOX_BRIDGE_ERROR_INVALID";
    super(safeCode);

    const safeContext = normalizeErrorContext(context);
    Object.defineProperties(this, {
      cause: {
        configurable: true,
        enumerable: false,
        value: cause,
      },
      fenneviaBuildId: {
        enumerable: false,
        value: safeContext.buildId,
      },
      fenneviaCode: { enumerable: false, value: safeCode },
      fenneviaFirefoxVersion: {
        enumerable: false,
        value: safeContext.firefoxVersion,
      },
      fenneviaPhase: {
        enumerable: false,
        value: PHASE_PATTERN.test(phase) ? phase : "firefox-bridge-error",
      },
      fenneviaSymbol: {
        enumerable: false,
        value: SYMBOL_PATTERN.test(symbol) ? symbol : "firefox.unknown",
      },
      fenneviaWindowKind: {
        enumerable: false,
        value: safeContext.windowKind,
      },
      name: {
        configurable: true,
        enumerable: false,
        value: "FenneviaFirefoxBridgeError",
      },
    });
  }
}

export function isFirefoxBridgeError(
  error: unknown,
): error is FirefoxBridgeError {
  return (
    error instanceof FirefoxBridgeError ||
    (isNativeRecord(error) &&
      error.name === "FenneviaFirefoxBridgeError" &&
      typeof error.fenneviaCode === "string" &&
      typeof error.fenneviaPhase === "string" &&
      typeof error.fenneviaSymbol === "string")
  );
}

export function toFirefoxBridgeDiagnostic(
  error: FirefoxBridgeError,
): FirefoxBridgeDiagnostic {
  if (!isFirefoxBridgeError(error)) {
    throw new TypeError("FENNEVIA_FIREFOX_DIAGNOSTIC_ERROR_INVALID");
  }
  return Object.freeze({
    buildId: error.fenneviaBuildId,
    code: error.fenneviaCode,
    firefoxVersion: error.fenneviaFirefoxVersion,
    phase: error.fenneviaPhase,
    symbol: error.fenneviaSymbol,
    windowKind: error.fenneviaWindowKind,
  });
}

const createBridgeError = (
  code: string,
  phase: string,
  symbol: string,
  context: FirefoxBridgeErrorContext,
  cause?: unknown,
): FirefoxBridgeError =>
  new FirefoxBridgeError({ cause, code, context, phase, symbol });

export function createIdempotentDisposer(
  callback: () => void,
): IdempotentDisposer {
  if (typeof callback !== "function") {
    throw new TypeError("FENNEVIA_FIREFOX_DISPOSER_INVALID");
  }

  let active = true;
  return Object.freeze(() => {
    if (!active) {
      return false;
    }
    active = false;
    callback();
    return true;
  });
}

export function subscribeFirefoxEvent({
  listener,
  options,
  target,
  type,
}: Readonly<{
  listener: (event: unknown) => void;
  options?: unknown;
  target: unknown;
  type: string;
}>): IdempotentDisposer {
  if (
    !isEventTarget(target) ||
    typeof listener !== "function" ||
    !EVENT_TYPE_PATTERN.test(type)
  ) {
    throw new TypeError("FENNEVIA_FIREFOX_SUBSCRIPTION_INVALID");
  }

  target.addEventListener(type, listener, options);
  return createIdempotentDisposer(() => {
    target.removeEventListener(type, listener, options);
  });
}

export function createOpaqueHandleRegistry<T extends object>({
  context,
  kind,
}: Readonly<{
  context: FirefoxBridgeErrorContext;
  kind: string;
}>) {
  if (!HANDLE_KIND_PATTERN.test(kind)) {
    throw new TypeError("FENNEVIA_FIREFOX_HANDLE_KIND_INVALID");
  }

  const errorContext = normalizeErrorContext(context);
  const registrySequence = ++nextRegistrySequence;
  const idPrefix = `${kind}-registry-${registrySequence}-handle-`;
  let nextHandleSequence = 0;
  let disposed = false;
  let idByHandle = new WeakMap<T, string>();
  const handleById = new Map<string, T>();

  const assertActive = (phase: string): void => {
    if (disposed) {
      throw createBridgeError(
        "FENNEVIA_FIREFOX_HANDLE_REGISTRY_DISPOSED",
        phase,
        `${kind}.opaque-id`,
        errorContext,
      );
    }
  };

  const requireOwnedId = (id: string, phase: string): T => {
    assertActive(phase);
    if (typeof id !== "string" || !HANDLE_ID_PATTERN.test(id)) {
      throw createBridgeError(
        "FENNEVIA_FIREFOX_HANDLE_ID_INVALID",
        phase,
        `${kind}.opaque-id`,
        errorContext,
      );
    }
    if (!id.startsWith(idPrefix)) {
      throw createBridgeError(
        "FENNEVIA_FIREFOX_HANDLE_CONTEXT_MISMATCH",
        phase,
        `${kind}.opaque-id`,
        errorContext,
      );
    }
    const handle = handleById.get(id);
    if (!handle) {
      throw createBridgeError(
        "FENNEVIA_FIREFOX_HANDLE_STALE",
        phase,
        `${kind}.opaque-id`,
        errorContext,
      );
    }
    return handle;
  };

  return Object.freeze({
    dispose(): boolean {
      if (disposed) {
        return false;
      }
      disposed = true;
      handleById.clear();
      idByHandle = new WeakMap<T, string>();
      return true;
    },

    register(handle: T): string {
      assertActive("firefox-handle-register");
      if (!isNativeObject(handle)) {
        throw createBridgeError(
          "FENNEVIA_FIREFOX_HANDLE_INVALID",
          "firefox-handle-register",
          `${kind}.native-handle`,
          errorContext,
        );
      }

      const existing = idByHandle.get(handle);
      if (existing) {
        return existing;
      }
      const id = `${idPrefix}${++nextHandleSequence}`;
      idByHandle.set(handle, id);
      handleById.set(id, handle);
      return id;
    },

    release(id: string): boolean {
      const handle = requireOwnedId(id, "firefox-handle-release");
      handleById.delete(id);
      idByHandle.delete(handle);
      return true;
    },

    resolve(id: string): T {
      return requireOwnedId(id, "firefox-handle-resolve");
    },

    snapshot() {
      return Object.freeze({
        activeHandleCount: handleById.size,
        disposed,
        kind,
      });
    },
  });
}

const capabilitySpecifications: ReadonlyArray<CapabilitySpecification> =
  Object.freeze([
    Object.freeze({
      isAvailable: isNativeRecord,
      name: "firefox.g-browser",
      read: (window: NativeRecord) => window.gBrowser,
      requirement: "required",
      symbol: "window.gBrowser",
    }),
    Object.freeze({
      isAvailable: Array.isArray,
      name: "firefox.tabs",
      read: (window: NativeRecord) =>
        isNativeRecord(window.gBrowser) ? window.gBrowser.tabs : undefined,
      requirement: "required",
      symbol: "window.gBrowser.tabs",
    }),
    Object.freeze({
      isAvailable: isEventTarget,
      name: "firefox.tab-events",
      read: (window: NativeRecord) =>
        isNativeRecord(window.gBrowser)
          ? window.gBrowser.tabContainer
          : undefined,
      requirement: "required",
      symbol: "window.gBrowser.tabContainer",
    }),
    Object.freeze({
      isAvailable: isNativeObject,
      name: "firefox.selected-browser",
      read: (window: NativeRecord) =>
        isNativeRecord(window.gBrowser)
          ? window.gBrowser.selectedBrowser
          : undefined,
      requirement: "required",
      symbol: "window.gBrowser.selectedBrowser",
    }),
    Object.freeze({
      isAvailable: (value: unknown) => value === true,
      name: "firefox.web-navigation",
      read: (window: NativeRecord) => {
        const selectedBrowser = isNativeRecord(window.gBrowser)
          ? window.gBrowser.selectedBrowser
          : undefined;
        return (
          isNativeObject(selectedBrowser) && "webNavigation" in selectedBrowser
        );
      },
      requirement: "optional",
      symbol: "window.gBrowser.selectedBrowser.webNavigation",
    }),
  ]);

const evaluateCapabilities = (
  window: NativeRecord,
): ReadonlyArray<CapabilityEvaluation> =>
  Object.freeze(
    capabilitySpecifications.map((specification) => {
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

export function createFirefoxBridgeBoundary({
  buildId,
  contextId,
  firefoxVersion,
  window,
  windowKind,
}: Readonly<{
  buildId: string;
  contextId: string;
  firefoxVersion: string;
  window: unknown;
  windowKind: FirefoxWindowKind;
}>) {
  const errorContext = normalizeErrorContext({
    buildId,
    firefoxVersion,
    windowKind,
  });
  if (
    !isNativeRecord(window) ||
    !CONTEXT_ID_PATTERN.test(contextId) ||
    (windowKind !== "normal" && windowKind !== "private")
  ) {
    throw createBridgeError(
      "FENNEVIA_FIREFOX_CONTEXT_INVALID",
      "firefox-context-create",
      "window",
      errorContext,
    );
  }

  const document = window.document;
  if (
    !isNativeRecord(document) ||
    document.documentURI !== BROWSER_DOCUMENT_URI ||
    document.defaultView !== window
  ) {
    throw createBridgeError(
      "FENNEVIA_FIREFOX_CONTEXT_DOCUMENT_INVALID",
      "firefox-context-create",
      "window.document.defaultView",
      errorContext,
    );
  }

  if (activeContextIds.has(contextId) || activeWindows.has(window)) {
    throw createBridgeError(
      "FENNEVIA_FIREFOX_CONTEXT_ALREADY_ACTIVE",
      "firefox-context-create",
      "window",
      errorContext,
    );
  }

  activeContextIds.add(contextId);
  activeWindows.set(window, contextId);
  let nativeWindow: NativeRecord | null = window;
  let disposed = false;
  const ownedDisposers = new Set<IdempotentDisposer>();
  const ownedRegistries = new Set<
    ReturnType<typeof createOpaqueHandleRegistry<object>>
  >();

  const assertActive = (): NativeRecord => {
    if (disposed || !nativeWindow) {
      throw createBridgeError(
        "FENNEVIA_FIREFOX_CONTEXT_DISPOSED",
        "firefox-context-access",
        "window",
        errorContext,
      );
    }
    return nativeWindow;
  };

  const getCapabilities = (): ReadonlyArray<FirefoxCapabilitySnapshot> =>
    Object.freeze(
      evaluateCapabilities(assertActive()).map(
        (evaluation) => evaluation.snapshot,
      ),
    );

  return Object.freeze({
    assertRequiredCapabilities(): ReadonlyArray<FirefoxCapabilitySnapshot> {
      const evaluations = evaluateCapabilities(assertActive());
      const missing = evaluations.find(
        (evaluation) =>
          evaluation.snapshot.requirement === "required" &&
          !evaluation.snapshot.available,
      );
      if (missing) {
        throw createBridgeError(
          "FENNEVIA_FIREFOX_CAPABILITY_MISSING",
          "firefox-bridge-capability",
          missing.snapshot.symbol,
          errorContext,
          missing.cause,
        );
      }
      return Object.freeze(
        evaluations.map((evaluation) => evaluation.snapshot),
      );
    },

    createHandleRegistry<T extends object>(kind: string) {
      assertActive();
      const registry = createOpaqueHandleRegistry<T>({
        context: errorContext,
        kind,
      });
      ownedRegistries.add(
        registry as ReturnType<typeof createOpaqueHandleRegistry<object>>,
      );
      return registry;
    },

    dispose(): boolean {
      if (disposed) {
        return false;
      }
      disposed = true;
      activeContextIds.delete(contextId);
      activeWindows.delete(window);
      nativeWindow = null;

      let firstError: unknown;
      for (const disposer of Array.from(ownedDisposers).reverse()) {
        try {
          disposer();
        } catch (error) {
          firstError ??= error;
        }
      }
      ownedDisposers.clear();
      for (const registry of ownedRegistries) {
        try {
          registry.dispose();
        } catch (error) {
          firstError ??= error;
        }
      }
      ownedRegistries.clear();
      if (firstError !== undefined) {
        throw createBridgeError(
          "FENNEVIA_FIREFOX_CONTEXT_DISPOSE_FAILED",
          "firefox-context-dispose",
          "window",
          errorContext,
          firstError,
        );
      }
      return true;
    },

    getCapabilities,

    snapshot() {
      const capabilities = disposed ? [] : getCapabilities();
      return Object.freeze({
        buildId: errorContext.buildId,
        capabilityCount: capabilities.length,
        contextId,
        disposed,
        firefoxVersion: errorContext.firefoxVersion,
        optionalCapabilityCount: capabilities.filter(
          (capability) => capability.requirement === "optional",
        ).length,
        registryCount: ownedRegistries.size,
        requiredCapabilityCount: capabilities.filter(
          (capability) => capability.requirement === "required",
        ).length,
        subscriptionCount: ownedDisposers.size,
        windowKind: errorContext.windowKind,
      });
    },

    subscribe(
      target: unknown,
      type: string,
      listener: (event: unknown) => void,
      options?: unknown,
    ): IdempotentDisposer {
      assertActive();
      const unsubscribe = subscribeFirefoxEvent({
        listener,
        options,
        target,
        type,
      });
      const ownedDispose = createIdempotentDisposer(() => {
        ownedDisposers.delete(ownedDispose);
        unsubscribe();
      });
      ownedDisposers.add(ownedDispose);
      return ownedDispose;
    },
  });
}
