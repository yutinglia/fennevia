// SPDX-License-Identifier: MPL-2.0

export const maximumUrlbarSuggestionCount = 20;
export const maximumUrlbarSuggestionTitleLength = 512;
export const maximumUrlbarSuggestionDescriptionLength = 1_024;
export const maximumUrlbarSuggestionIconLength = 2_048;
export const maximumUrlbarSuggestionTokenLength = 160;

export const urlbarSuggestionResultTypes = Object.freeze([
  "tab-switch",
  "search",
  "url",
  "keyword",
  "omnibox",
  "remote-tab",
  "tip",
  "dynamic",
  "restrict",
  "ai-chat",
  "unknown",
] as const);

export const urlbarSuggestionResultSources = Object.freeze([
  "bookmarks",
  "history",
  "search",
  "tabs",
  "other-local",
  "other-network",
  "addon",
  "actions",
  "unknown",
] as const);

export const urlbarSuggestionExecutionKinds = Object.freeze([
  "direct",
  "native",
] as const);

export const urlbarSuggestionsPhases = Object.freeze([
  "idle",
  "querying",
  "results",
  "empty",
  "failed",
] as const);

export type UrlbarSuggestionResultType =
  (typeof urlbarSuggestionResultTypes)[number];
export type UrlbarSuggestionResultSource =
  (typeof urlbarSuggestionResultSources)[number];
export type UrlbarSuggestionExecutionKind =
  (typeof urlbarSuggestionExecutionKinds)[number];
export type UrlbarSuggestionsPhase = (typeof urlbarSuggestionsPhases)[number];

export type UrlbarSuggestionResult = Readonly<{
  description: string;
  execution: UrlbarSuggestionExecutionKind;
  heuristic: boolean;
  icon: string | null;
  source: UrlbarSuggestionResultSource;
  title: string;
  token: string;
  type: UrlbarSuggestionResultType;
}>;

export type UrlbarSuggestionsSnapshot = Readonly<{
  available: boolean;
  phase: UrlbarSuggestionsPhase;
  queryRevision: number;
  results: readonly UrlbarSuggestionResult[];
}>;

export type UrlbarSuggestionsStateEvent = Readonly<{
  revision: number;
  snapshot: UrlbarSuggestionsSnapshot;
  type: "snapshot";
}>;

export type UrlbarSuggestionGesture = Readonly<{
  altKey: boolean;
  button: 0 | 1;
  ctrlKey: boolean;
  kind: "keyboard" | "pointer";
  metaKey: boolean;
  shiftKey: boolean;
}>;

export type UrlbarSuggestionExecutionResult = Readonly<{
  status: "committed" | "continued" | "native-required" | "rejected";
}>;

export type BrowserUrlbarSuggestionsBridge = Readonly<{
  cancel: () => boolean;
  execute: (
    token: string,
    gesture: UrlbarSuggestionGesture,
  ) => UrlbarSuggestionExecutionResult;
  prepareNativeHandoff: () => boolean;
  query: (value: string) => boolean;
  snapshot: () => UrlbarSuggestionsSnapshot;
  subscribe: (
    listener: (event: UrlbarSuggestionsStateEvent) => void,
  ) => () => boolean;
}>;

export type BrowserUrlbarSuggestionsState = Readonly<{
  revision: number;
  snapshot: UrlbarSuggestionsSnapshot;
}>;

export type BrowserUrlbarSuggestionsStateAdapter = Readonly<{
  cancel: () => boolean;
  dispose: () => boolean;
  execute: (
    token: string,
    gesture: UrlbarSuggestionGesture,
  ) => UrlbarSuggestionExecutionResult;
  prepareNativeHandoff: () => boolean;
  query: (value: string) => boolean;
  snapshot: () => BrowserUrlbarSuggestionsState;
  status: () => Readonly<{
    disposed: boolean;
    revision: number;
    subscriberCount: number;
  }>;
  subscribe: (
    listener: (state: BrowserUrlbarSuggestionsState) => void,
  ) => () => boolean;
}>;

const resultTypeSet = new Set(urlbarSuggestionResultTypes);
const resultSourceSet = new Set(urlbarSuggestionResultSources);
const executionKindSet = new Set(urlbarSuggestionExecutionKinds);
const phaseSet = new Set(urlbarSuggestionsPhases);
const tokenPattern = /^[a-z0-9-]+$/u;

function createUrlbarSuggestionsStateError(code: string): Error {
  const error = new Error(code);
  error.name = "FenneviaUrlbarSuggestionsStateError";
  Object.defineProperties(error, {
    fenneviaCode: { enumerable: false, value: code },
    fenneviaPhase: { enumerable: false, value: "urlbar-suggestions-state" },
  });
  return error;
}

function isBoundedString(
  value: unknown,
  maximumLength: number,
): value is string {
  return typeof value === "string" && value.length <= maximumLength;
}

function copyResult(candidate: UrlbarSuggestionResult): UrlbarSuggestionResult {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    !resultTypeSet.has(candidate.type) ||
    !resultSourceSet.has(candidate.source) ||
    !executionKindSet.has(candidate.execution) ||
    typeof candidate.heuristic !== "boolean" ||
    !isBoundedString(candidate.title, maximumUrlbarSuggestionTitleLength) ||
    !isBoundedString(
      candidate.description,
      maximumUrlbarSuggestionDescriptionLength,
    ) ||
    (candidate.icon !== null &&
      !isBoundedString(candidate.icon, maximumUrlbarSuggestionIconLength)) ||
    !isBoundedString(candidate.token, maximumUrlbarSuggestionTokenLength) ||
    !tokenPattern.test(candidate.token)
  ) {
    throw createUrlbarSuggestionsStateError(
      "FENNEVIA_URLBAR_SUGGESTIONS_RESULT_INVALID",
    );
  }
  return Object.freeze({
    description: candidate.description,
    execution: candidate.execution,
    heuristic: candidate.heuristic,
    icon: candidate.icon,
    source: candidate.source,
    title: candidate.title,
    token: candidate.token,
    type: candidate.type,
  });
}

export function copyUrlbarSuggestionGesture(
  candidate: UrlbarSuggestionGesture,
): UrlbarSuggestionGesture {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    (candidate.kind !== "keyboard" && candidate.kind !== "pointer") ||
    (candidate.button !== 0 && candidate.button !== 1) ||
    typeof candidate.altKey !== "boolean" ||
    typeof candidate.ctrlKey !== "boolean" ||
    typeof candidate.metaKey !== "boolean" ||
    typeof candidate.shiftKey !== "boolean" ||
    (candidate.kind === "keyboard" && candidate.button !== 0)
  ) {
    throw createUrlbarSuggestionsStateError(
      "FENNEVIA_URLBAR_SUGGESTIONS_GESTURE_INVALID",
    );
  }
  return Object.freeze({
    altKey: candidate.altKey,
    button: candidate.button,
    ctrlKey: candidate.ctrlKey,
    kind: candidate.kind,
    metaKey: candidate.metaKey,
    shiftKey: candidate.shiftKey,
  });
}

export function copyUrlbarSuggestionsSnapshot(
  candidate: UrlbarSuggestionsSnapshot,
): UrlbarSuggestionsSnapshot {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    typeof candidate.available !== "boolean" ||
    !phaseSet.has(candidate.phase) ||
    !Number.isSafeInteger(candidate.queryRevision) ||
    candidate.queryRevision < 0 ||
    !Array.isArray(candidate.results) ||
    candidate.results.length > maximumUrlbarSuggestionCount
  ) {
    throw createUrlbarSuggestionsStateError(
      "FENNEVIA_URLBAR_SUGGESTIONS_SNAPSHOT_INVALID",
    );
  }
  const results = Object.freeze(candidate.results.map(copyResult));
  if (
    new Set(results.map((result) => result.token)).size !== results.length ||
    (!candidate.available && candidate.phase !== "failed") ||
    (candidate.phase === "results" && results.length === 0) ||
    (candidate.phase !== "results" && results.length > 0)
  ) {
    throw createUrlbarSuggestionsStateError(
      "FENNEVIA_URLBAR_SUGGESTIONS_SNAPSHOT_INVALID",
    );
  }
  return Object.freeze({
    available: candidate.available,
    phase: candidate.phase,
    queryRevision: candidate.queryRevision,
    results,
  });
}

export function createBrowserUrlbarSuggestionsState(
  snapshot: UrlbarSuggestionsSnapshot,
  revision = 0,
): BrowserUrlbarSuggestionsState {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw createUrlbarSuggestionsStateError(
      "FENNEVIA_URLBAR_SUGGESTIONS_REVISION_INVALID",
    );
  }
  return Object.freeze({
    revision,
    snapshot: copyUrlbarSuggestionsSnapshot(snapshot),
  });
}

export function reduceBrowserUrlbarSuggestionsState(
  state: BrowserUrlbarSuggestionsState,
  event: UrlbarSuggestionsStateEvent,
): BrowserUrlbarSuggestionsState {
  if (
    event?.type !== "snapshot" ||
    !Number.isSafeInteger(event.revision) ||
    event.revision < 1
  ) {
    throw createUrlbarSuggestionsStateError(
      "FENNEVIA_URLBAR_SUGGESTIONS_EVENT_INVALID",
    );
  }
  if (event.revision <= state.revision) {
    return state;
  }
  return createBrowserUrlbarSuggestionsState(event.snapshot, event.revision);
}

function copyExecutionResult(
  candidate: UrlbarSuggestionExecutionResult,
): UrlbarSuggestionExecutionResult {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    (candidate.status !== "committed" &&
      candidate.status !== "continued" &&
      candidate.status !== "native-required" &&
      candidate.status !== "rejected")
  ) {
    throw createUrlbarSuggestionsStateError(
      "FENNEVIA_URLBAR_SUGGESTIONS_EXECUTION_INVALID",
    );
  }
  return Object.freeze({ status: candidate.status });
}

export function createBrowserUrlbarSuggestionsStateAdapter(
  bridge: BrowserUrlbarSuggestionsBridge,
): BrowserUrlbarSuggestionsStateAdapter {
  if (
    !bridge ||
    typeof bridge !== "object" ||
    typeof bridge.cancel !== "function" ||
    typeof bridge.execute !== "function" ||
    typeof bridge.prepareNativeHandoff !== "function" ||
    typeof bridge.query !== "function" ||
    typeof bridge.snapshot !== "function" ||
    typeof bridge.subscribe !== "function"
  ) {
    throw createUrlbarSuggestionsStateError(
      "FENNEVIA_URLBAR_SUGGESTIONS_BRIDGE_INVALID",
    );
  }

  let activeBridge: BrowserUrlbarSuggestionsBridge | null = bridge;
  let disposed = false;
  let state = createBrowserUrlbarSuggestionsState(bridge.snapshot());
  const listeners = new Set<(state: BrowserUrlbarSuggestionsState) => void>();
  const unsubscribeBridge = bridge.subscribe((event) => {
    if (disposed) {
      return;
    }
    const nextState = reduceBrowserUrlbarSuggestionsState(state, event);
    if (nextState === state) {
      return;
    }
    state = nextState;
    for (const listener of Array.from(listeners)) {
      listener(state);
    }
  });
  if (typeof unsubscribeBridge !== "function") {
    throw createUrlbarSuggestionsStateError(
      "FENNEVIA_URLBAR_SUGGESTIONS_SUBSCRIPTION_INVALID",
    );
  }

  const requireBridge = (): BrowserUrlbarSuggestionsBridge => {
    if (disposed || !activeBridge) {
      throw createUrlbarSuggestionsStateError(
        "FENNEVIA_URLBAR_SUGGESTIONS_DISPOSED",
      );
    }
    return activeBridge;
  };

  return Object.freeze({
    cancel: () => requireBridge().cancel(),

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

    execute(token, gesture): UrlbarSuggestionExecutionResult {
      const boundedGesture = copyUrlbarSuggestionGesture(gesture);
      return copyExecutionResult(
        requireBridge().execute(token, boundedGesture),
      );
    },

    prepareNativeHandoff: () => requireBridge().prepareNativeHandoff(),

    query(value): boolean {
      if (typeof value !== "string") {
        throw createUrlbarSuggestionsStateError(
          "FENNEVIA_URLBAR_SUGGESTIONS_QUERY_INVALID",
        );
      }
      return requireBridge().query(value);
    },

    snapshot: () => state,

    status() {
      return Object.freeze({
        disposed,
        revision: state.revision,
        subscriberCount: listeners.size,
      });
    },

    subscribe(listener): () => boolean {
      requireBridge();
      if (typeof listener !== "function") {
        throw createUrlbarSuggestionsStateError(
          "FENNEVIA_URLBAR_SUGGESTIONS_LISTENER_INVALID",
        );
      }
      listeners.add(listener);
      let subscribed = true;
      return Object.freeze(() => {
        if (!subscribed) {
          return false;
        }
        subscribed = false;
        listeners.delete(listener);
        return true;
      });
    },
  });
}
