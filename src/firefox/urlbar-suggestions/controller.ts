// SPDX-License-Identifier: MPL-2.0
import type {
  BrowserUrlbarSuggestionsBridge,
  UrlbarSuggestionExecutionResult,
  UrlbarSuggestionGesture,
  UrlbarSuggestionResult,
  UrlbarSuggestionsSnapshot,
  UrlbarSuggestionsStateEvent,
} from "../../app/urlbar-suggestions-state.ts";
import {
  copyUrlbarSuggestionGesture,
  maximumUrlbarSuggestionCount,
} from "../../app/urlbar-suggestions-state.ts";
import { maximumNavigationAddressLength } from "../../app/navigation-state.ts";
import {
  createIdempotentDisposer,
  type FirefoxBridgeBoundary,
  type FirefoxCapabilitySnapshot,
} from "../bridge-boundary.ts";
import {
  createUrlbarSuggestionsError,
  evaluateUrlbarSuggestionsCapabilities,
  isFunction,
  isNativeRecord,
  projectUrlbarSuggestionResult,
  resolveUrlbarSuggestionOwners,
  type NativeProvidersManager,
  type NativeRecord,
  type NativeUrlbarController,
  type NativeUrlbarInput,
  type NativeUrlbarResult,
  type UrlbarSuggestionOwners,
} from "./support.ts";

type ActiveQuery = Readonly<{
  context: NativeRecord;
  input: NativeUrlbarInput;
  manager: NativeProvidersManager;
  retryZeroPrefixOnEmpty: boolean;
  revision: number;
}>;

type RetainedResult = Readonly<{
  execution: "direct" | "native";
  input: NativeUrlbarInput;
  manager: NativeProvidersManager;
  queryRevision: number;
  result: NativeUrlbarResult;
}>;

type NativeEventConstructor = new (
  type: string,
  init?: Record<string, unknown>,
) => unknown;

export type FirefoxUrlbarSuggestionsBridgeController = Readonly<{
  assertRequiredCapabilities: () => readonly FirefoxCapabilitySnapshot[];
  dispose: () => boolean;
  snapshot: () => Readonly<{
    activeQuery: boolean;
    disposed: boolean;
    queryRevision: number;
    resultCount: number;
    revision: number;
    subscriberCount: number;
  }>;
  urlbarSuggestions: BrowserUrlbarSuggestionsBridge;
}>;

export function createFirefoxUrlbarSuggestionsBridge({
  boundary,
  onError,
  window,
}: Readonly<{
  boundary: FirefoxBridgeBoundary;
  onError: (error: unknown) => void;
  window: unknown;
}>): FirefoxUrlbarSuggestionsBridgeController {
  boundary.assertOwnsWindow(window);
  if (!isNativeRecord(window) || typeof onError !== "function") {
    throw createUrlbarSuggestionsError(
      boundary,
      "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_OPTIONS_INVALID",
      "firefox-urlbar-suggestions-create",
      "window.gURLBar",
    );
  }

  let nativeWindow: NativeRecord | null = window;
  let disposed = false;
  let revision = 0;
  let queryRevision = 0;
  let zeroPrefixWarmupComplete = false;
  let activeQuery: ActiveQuery | null = null;
  let currentSnapshot: UrlbarSuggestionsSnapshot = Object.freeze({
    available: true,
    phase: "idle",
    queryRevision: 0,
    results: Object.freeze([]),
  });
  const subscribers = new Set<(event: UrlbarSuggestionsStateEvent) => void>();
  const resultRegistry =
    boundary.createHandleRegistry<NativeUrlbarResult>("urlbar-result");
  const retainedResults = new Map<string, RetainedResult>();

  const requireWindow = (): NativeRecord => {
    if (disposed || !nativeWindow) {
      throw createUrlbarSuggestionsError(
        boundary,
        "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_DISPOSED",
        "firefox-urlbar-suggestions-access",
        "window.gURLBar",
      );
    }
    boundary.assertOwnsWindow(nativeWindow);
    return nativeWindow;
  };

  const assertRequiredCapabilities = () => {
    const evaluations = evaluateUrlbarSuggestionsCapabilities(requireWindow());
    const missing = evaluations.find(
      (evaluation) => !evaluation.snapshot.available,
    );
    if (missing) {
      throw createUrlbarSuggestionsError(
        boundary,
        "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CAPABILITY_MISSING",
        "firefox-urlbar-suggestions-capability",
        missing.snapshot.symbol,
        missing.cause,
      );
    }
    return Object.freeze(evaluations.map((evaluation) => evaluation.snapshot));
  };

  const requireOwners = (): UrlbarSuggestionOwners => {
    const owners = resolveUrlbarSuggestionOwners(requireWindow());
    if (!owners) {
      throw createUrlbarSuggestionsError(
        boundary,
        "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CAPABILITY_MISSING",
        "firefox-urlbar-suggestions-access",
        "window.gURLBar.controller.parentController.manager",
      );
    }
    return owners;
  };

  const notifySubscribers = (): void => {
    const event: UrlbarSuggestionsStateEvent = Object.freeze({
      revision,
      snapshot: currentSnapshot,
      type: "snapshot",
    });
    for (const listener of Array.from(subscribers)) {
      try {
        listener(event);
      } catch (error) {
        onError(
          createUrlbarSuggestionsError(
            boundary,
            "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_SUBSCRIBER_FAILED",
            "firefox-urlbar-suggestions-notify",
            "urlbarSuggestions.subscribe",
            error,
          ),
        );
      }
    }
  };

  const publish = (
    phase: UrlbarSuggestionsSnapshot["phase"],
    results: readonly UrlbarSuggestionResult[] = Object.freeze([]),
  ): void => {
    currentSnapshot = Object.freeze({
      available: true,
      phase,
      queryRevision,
      results: Object.freeze([...results]),
    });
    revision += 1;
    notifySubscribers();
  };

  const releaseResults = (): void => {
    for (const token of retainedResults.keys()) {
      try {
        resultRegistry.release(token);
      } catch {
        // A prior boundary cleanup may already have invalidated every token.
      }
    }
    retainedResults.clear();
  };

  const cancelContext = (candidate: ActiveQuery | null): boolean => {
    if (!candidate) {
      return false;
    }
    if (activeQuery === candidate) {
      activeQuery = null;
    }
    try {
      Reflect.apply(candidate.manager.cancelQuery, candidate.manager, [
        candidate.context,
      ]);
    } catch (error) {
      onError(
        createUrlbarSuggestionsError(
          boundary,
          "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CANCEL_FAILED",
          "firefox-urlbar-suggestions-cancel",
          "UrlbarProvidersManager.cancelQuery",
          error,
        ),
      );
    }
    return true;
  };

  const failQuery = (
    candidate: ActiveQuery | null,
    code: string,
    phase: string,
    symbol: string,
    cause: unknown,
  ): void => {
    if (candidate && activeQuery !== candidate) {
      return;
    }
    cancelContext(candidate ?? activeQuery);
    releaseResults();
    publish("failed");
    onError(createUrlbarSuggestionsError(boundary, code, phase, symbol, cause));
  };

  const publishResults = (
    context: NativeRecord,
    owners: UrlbarSuggestionOwners,
    expectedRevision: number,
  ): void => {
    const active = activeQuery;
    if (
      disposed ||
      !active ||
      active.context !== context ||
      active.revision !== expectedRevision ||
      queryRevision !== expectedRevision
    ) {
      return;
    }
    const candidates = Array.isArray(context.results)
      ? context.results.slice(0, maximumUrlbarSuggestionCount)
      : [];
    const projected: UrlbarSuggestionResult[] = [];
    const seen = new Set<object>();
    releaseResults();
    for (const candidate of candidates) {
      if (!isNativeRecord(candidate) || seen.has(candidate)) {
        continue;
      }
      seen.add(candidate);
      const result = candidate as NativeUrlbarResult;
      const token = resultRegistry.register(result);
      let projection: UrlbarSuggestionResult;
      try {
        projection = projectUrlbarSuggestionResult(result, token);
      } catch (error) {
        resultRegistry.release(token);
        throw error;
      }
      retainedResults.set(
        token,
        Object.freeze({
          execution: projection.execution,
          input: owners.input,
          manager: owners.manager,
          queryRevision: expectedRevision,
          result,
        }),
      );
      projected.push(projection);
    }
    if (projected.length > 0) {
      publish("results", projected);
    } else {
      publish("querying");
    }
  };

  const createControllerProxy = (
    owners: UrlbarSuggestionOwners,
    context: NativeRecord,
    expectedRevision: number,
  ): NativeUrlbarController => {
    const projectView = Object.freeze({
      get isOpen() {
        return false;
      },
      get selectedElement() {
        return null;
      },
      get selectedResult() {
        return null;
      },
      get visibleResults() {
        return Array.isArray(context.results) ? context.results : [];
      },
    });
    return new Proxy(owners.parentController, {
      get(target, property) {
        if (property === "receiveResults") {
          return (receivedContext: unknown) => {
            if (receivedContext === context) {
              try {
                publishResults(context, owners, expectedRevision);
              } catch (error) {
                failQuery(
                  activeQuery,
                  "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_RESULT_FAILED",
                  "firefox-urlbar-suggestions-result",
                  "UrlbarParentController.receiveResults",
                  error,
                );
              }
            }
          };
        }
        if (property === "view") {
          return projectView;
        }
        const value = Reflect.get(target, property, target);
        return isFunction(value) ? value.bind(target) : value;
      },
    });
  };

  const finishQuery = (candidate: ActiveQuery): void => {
    try {
      Reflect.apply(candidate.manager.cancelQuery, candidate.manager, [
        candidate.context,
      ]);
    } catch (error) {
      onError(
        createUrlbarSuggestionsError(
          boundary,
          "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CANCEL_FAILED",
          "firefox-urlbar-suggestions-finish",
          "UrlbarProvidersManager.cancelQuery",
          error,
        ),
      );
    }
    if (activeQuery !== candidate) {
      return;
    }
    activeQuery = null;
    const retryZeroPrefix =
      candidate.retryZeroPrefixOnEmpty &&
      queryRevision === candidate.revision &&
      currentSnapshot.phase === "querying";
    if (candidate.retryZeroPrefixOnEmpty) {
      zeroPrefixWarmupComplete = true;
    }
    if (retryZeroPrefix) {
      try {
        beginQuery("", false);
      } catch (error) {
        failQuery(
          null,
          "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_QUERY_FAILED",
          "firefox-urlbar-suggestions-query",
          "window.gURLBar.startQuery",
          error,
        );
      }
      return;
    }
    if (
      queryRevision === candidate.revision &&
      currentSnapshot.phase === "querying"
    ) {
      publish("empty");
    }
  };

  const startManagedQuery = (
    context: unknown,
    owners: UrlbarSuggestionOwners,
    expectedRevision: number,
    retryZeroPrefixOnEmpty = false,
  ): void => {
    if (!isNativeRecord(context)) {
      throw createUrlbarSuggestionsError(
        boundary,
        "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CONTEXT_INVALID",
        "firefox-urlbar-suggestions-query",
        "UrlbarQueryContext",
      );
    }
    cancelContext(activeQuery);
    const candidate: ActiveQuery = Object.freeze({
      context,
      input: owners.input,
      manager: owners.manager,
      retryZeroPrefixOnEmpty,
      revision: expectedRevision,
    });
    activeQuery = candidate;
    const controllerProxy = createControllerProxy(
      owners,
      context,
      expectedRevision,
    );
    let result: unknown;
    try {
      result = Reflect.apply(owners.manager.startQuery, owners.manager, [
        context,
        controllerProxy,
      ]);
    } catch (error) {
      failQuery(
        candidate,
        "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_QUERY_FAILED",
        "firefox-urlbar-suggestions-query",
        "UrlbarProvidersManager.startQuery",
        error,
      );
      return;
    }
    void Promise.resolve(result).then(
      () => finishQuery(candidate),
      (error) =>
        failQuery(
          candidate,
          "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_QUERY_FAILED",
          "firefox-urlbar-suggestions-query",
          "UrlbarProvidersManager.startQuery",
          error,
        ),
    );
  };

  const withInputControllerProxy = (
    owners: UrlbarSuggestionOwners,
    onStartQuery: (context: unknown) => void,
    callback: () => unknown,
  ): unknown => {
    const inputProxy = new Proxy(owners.nativeController, {
      get(target, property) {
        if (property === "cancelQuery") {
          return () => cancelContext(activeQuery);
        }
        if (property === "startQuery") {
          return (context: unknown) => onStartQuery(context);
        }
        const value = Reflect.get(target, property, target);
        return isFunction(value) ? value.bind(target) : value;
      },
    });
    let callbackError: unknown;
    let callbackFailed = false;
    let callbackResult: unknown;
    try {
      owners.input.controller = inputProxy;
      if (owners.input.controller !== inputProxy) {
        throw createUrlbarSuggestionsError(
          boundary,
          "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_PROXY_REJECTED",
          "firefox-urlbar-suggestions-proxy",
          "window.gURLBar.controller",
        );
      }
      callbackResult = callback();
    } catch (error) {
      callbackError = error;
      callbackFailed = true;
    }
    let restoreError: unknown;
    let restoreFailed = false;
    try {
      owners.input.controller = owners.nativeController;
      if (owners.input.controller !== owners.nativeController) {
        throw createUrlbarSuggestionsError(
          boundary,
          "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_PROXY_RESTORE_FAILED",
          "firefox-urlbar-suggestions-proxy",
          "window.gURLBar.controller",
        );
      }
    } catch (error) {
      restoreError = error;
      restoreFailed = true;
    }
    if (restoreFailed) {
      throw restoreError;
    }
    if (callbackFailed) {
      throw callbackError;
    }
    return callbackResult;
  };

  function beginQuery(value: string, allowZeroPrefixRetry = true): boolean {
    const owners = requireOwners();
    cancelContext(activeQuery);
    releaseResults();
    queryRevision += 1;
    const expectedRevision = queryRevision;
    publish("querying");
    owners.input.value = value;
    if (typeof owners.input.selectionStart === "number") {
      owners.input.selectionStart = value.length;
    }
    if (typeof owners.input.selectionEnd === "number") {
      owners.input.selectionEnd = value.length;
    }
    let contextStarted = false;
    try {
      withInputControllerProxy(
        owners,
        (context) => {
          contextStarted = true;
          startManagedQuery(
            context,
            owners,
            expectedRevision,
            allowZeroPrefixRetry &&
              !zeroPrefixWarmupComplete &&
              value.length === 0,
          );
        },
        () =>
          Reflect.apply(owners.input.startQuery, owners.input, [
            Object.freeze({
              allowAutofill: value.length > 0,
              searchString: value,
            }),
          ]),
      );
      if (!contextStarted) {
        throw createUrlbarSuggestionsError(
          boundary,
          "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CONTEXT_MISSING",
          "firefox-urlbar-suggestions-query",
          "window.gURLBar.startQuery",
        );
      }
      return true;
    } catch (error) {
      failQuery(
        activeQuery,
        "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_QUERY_FAILED",
        "firefox-urlbar-suggestions-query",
        "window.gURLBar.startQuery",
        error,
      );
      return false;
    }
  }

  const cancelAndClear = (revert: boolean): boolean => {
    const hadState =
      activeQuery !== null ||
      retainedResults.size > 0 ||
      currentSnapshot.phase !== "idle";
    const input = activeQuery?.input;
    cancelContext(activeQuery);
    releaseResults();
    if (revert && hadState) {
      try {
        const ownerInput = input ?? requireOwners().input;
        Reflect.apply(ownerInput.handleRevert, ownerInput, []);
      } catch (error) {
        onError(
          createUrlbarSuggestionsError(
            boundary,
            "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_REVERT_FAILED",
            "firefox-urlbar-suggestions-cancel",
            "window.gURLBar.handleRevert",
            error,
          ),
        );
      }
    }
    if (
      currentSnapshot.phase !== "idle" ||
      currentSnapshot.results.length > 0
    ) {
      publish("idle");
    }
    return hadState;
  };

  const createActivationEvent = (gesture: UrlbarSuggestionGesture): unknown => {
    const currentWindow = requireWindow();
    const init = {
      altKey: gesture.altKey,
      bubbles: true,
      button: gesture.button,
      cancelable: true,
      ctrlKey: gesture.ctrlKey,
      metaKey: gesture.metaKey,
      shiftKey: gesture.shiftKey,
      view: currentWindow,
    };
    if (gesture.kind === "pointer") {
      const MouseEventConstructor = currentWindow.MouseEvent as
        NativeEventConstructor | undefined;
      if (!MouseEventConstructor) {
        throw createUrlbarSuggestionsError(
          boundary,
          "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CAPABILITY_MISSING",
          "firefox-urlbar-suggestions-execute",
          "window.MouseEvent",
        );
      }
      return new MouseEventConstructor("click", init);
    }
    const KeyboardEventConstructor = currentWindow.KeyboardEvent as
      NativeEventConstructor | undefined;
    if (!KeyboardEventConstructor) {
      throw createUrlbarSuggestionsError(
        boundary,
        "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CAPABILITY_MISSING",
        "firefox-urlbar-suggestions-execute",
        "window.KeyboardEvent",
      );
    }
    return new KeyboardEventConstructor("keydown", {
      ...init,
      code: "Enter",
      key: "Enter",
    });
  };

  const execute = (
    token: string,
    gestureCandidate: UrlbarSuggestionGesture,
  ): UrlbarSuggestionExecutionResult => {
    let gesture: UrlbarSuggestionGesture;
    let result: NativeUrlbarResult;
    try {
      gesture = copyUrlbarSuggestionGesture(gestureCandidate);
      result = resultRegistry.resolve(token);
    } catch {
      return Object.freeze({ status: "rejected" });
    }
    const retained = retainedResults.get(token);
    if (
      !retained ||
      retained.result !== result ||
      retained.queryRevision !== queryRevision
    ) {
      return Object.freeze({ status: "rejected" });
    }
    if (retained.execution === "native") {
      return Object.freeze({ status: "native-required" });
    }

    let owners: UrlbarSuggestionOwners;
    try {
      owners = requireOwners();
    } catch (error) {
      failQuery(
        activeQuery,
        "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_EXECUTE_FAILED",
        "firefox-urlbar-suggestions-execute",
        "window.gURLBar.pickResult",
        error,
      );
      return Object.freeze({ status: "native-required" });
    }
    if (
      owners.input !== retained.input ||
      owners.manager !== retained.manager
    ) {
      return Object.freeze({ status: "rejected" });
    }

    cancelContext(activeQuery);
    let followupStarted = false;
    const priorSearchMode = owners.input.searchMode;
    try {
      const activationEvent = createActivationEvent(gesture);
      withInputControllerProxy(
        owners,
        (context) => {
          followupStarted = true;
          releaseResults();
          queryRevision += 1;
          publish("querying");
          startManagedQuery(context, owners, queryRevision);
        },
        () =>
          Reflect.apply(owners.input.pickResult, owners.input, [
            result,
            activationEvent,
            null,
            owners.selectedBrowser,
          ]),
      );
      if (!followupStarted && owners.input.searchMode !== priorSearchMode) {
        const nextValue =
          typeof owners.input.value === "string"
            ? owners.input.value.slice(0, maximumNavigationAddressLength)
            : "";
        releaseResults();
        queryRevision += 1;
        publish("querying");
        withInputControllerProxy(
          owners,
          (context) => {
            followupStarted = true;
            startManagedQuery(context, owners, queryRevision);
          },
          () =>
            Reflect.apply(owners.input.startQuery, owners.input, [
              Object.freeze({
                allowAutofill: nextValue.length > 0,
                searchString: nextValue,
              }),
            ]),
        );
      }
    } catch (error) {
      failQuery(
        activeQuery,
        "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_EXECUTE_FAILED",
        "firefox-urlbar-suggestions-execute",
        "window.gURLBar.pickResult",
        error,
      );
      return Object.freeze({ status: "native-required" });
    }

    if (followupStarted) {
      return Object.freeze({ status: "continued" });
    }
    releaseResults();
    publish("idle");
    return Object.freeze({ status: "committed" });
  };

  const publicBridge: BrowserUrlbarSuggestionsBridge = Object.freeze({
    cancel: () => cancelAndClear(true),

    execute,

    prepareNativeHandoff: () => cancelAndClear(false),

    query(value): boolean {
      requireWindow();
      if (
        typeof value !== "string" ||
        value.length > maximumNavigationAddressLength
      ) {
        throw createUrlbarSuggestionsError(
          boundary,
          "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_QUERY_INVALID",
          "firefox-urlbar-suggestions-query",
          "window.gURLBar.value",
        );
      }
      return beginQuery(value);
    },

    snapshot(): UrlbarSuggestionsSnapshot {
      requireWindow();
      return currentSnapshot;
    },

    subscribe(listener): () => boolean {
      requireWindow();
      if (typeof listener !== "function") {
        throw createUrlbarSuggestionsError(
          boundary,
          "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_LISTENER_INVALID",
          "firefox-urlbar-suggestions-subscribe",
          "urlbarSuggestions.subscribe",
        );
      }
      subscribers.add(listener);
      return createIdempotentDisposer(() => subscribers.delete(listener));
    },
  });

  try {
    boundary.assertRequiredCapabilities();
    assertRequiredCapabilities();
    requireOwners();
  } catch (error) {
    disposed = true;
    retainedResults.clear();
    resultRegistry.dispose();
    nativeWindow = null;
    throw error;
  }

  return Object.freeze({
    assertRequiredCapabilities,

    dispose(): boolean {
      if (disposed) {
        return false;
      }
      subscribers.clear();
      cancelAndClear(true);
      resultRegistry.dispose();
      disposed = true;
      nativeWindow = null;
      return true;
    },

    snapshot() {
      return Object.freeze({
        activeQuery: activeQuery !== null,
        disposed,
        queryRevision,
        resultCount: resultRegistry.snapshot().activeHandleCount,
        revision,
        subscriberCount: subscribers.size,
      });
    },

    urlbarSuggestions: publicBridge,
  });
}
