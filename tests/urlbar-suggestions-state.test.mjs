import assert from "node:assert/strict";
import test from "node:test";

import {
  createBrowserUrlbarSuggestionsState,
  createBrowserUrlbarSuggestionsStateAdapter,
  maximumUrlbarSuggestionTitleLength,
  reduceBrowserUrlbarSuggestionsState,
} from "../src/app/urlbar-suggestions-state.ts";

const initialSnapshot = Object.freeze({
  available: true,
  phase: "results",
  queryRevision: 2,
  results: Object.freeze([
    Object.freeze({
      description: "Firefox-owned description",
      execution: "direct",
      heuristic: true,
      icon: "chrome://global/skin/icons/search-glass.svg",
      source: "search",
      title: "Firefox-owned suggestion",
      token: "urlbar-result-registry-1-handle-1",
      type: "search",
    }),
  ]),
});

function createBridge() {
  const calls = [];
  const listeners = new Set();
  let snapshot = initialSnapshot;
  return {
    bridge: Object.freeze({
      cancel() {
        calls.push("cancel");
        return true;
      },
      execute(token, gesture) {
        calls.push({ gesture, token });
        return Object.freeze({ status: "committed" });
      },
      prepareNativeHandoff() {
        calls.push("native-handoff");
        return true;
      },
      query(value) {
        calls.push({ queryLength: value.length });
        return true;
      },
      snapshot: () => snapshot,
      subscribe(listener) {
        listeners.add(listener);
        let active = true;
        return () => {
          if (!active) {
            return false;
          }
          active = false;
          listeners.delete(listener);
          return true;
        };
      },
    }),
    calls,
    emit(nextSnapshot, revision) {
      snapshot = Object.freeze(nextSnapshot);
      for (const listener of Array.from(listeners)) {
        listener({ revision, snapshot, type: "snapshot" });
      }
    },
    listenerCount: () => listeners.size,
  };
}

test("Urlbar suggestions state copies only bounded closed result data", () => {
  const state = createBrowserUrlbarSuggestionsState(initialSnapshot, 7);

  assert.equal(state.revision, 7);
  assert.deepEqual(state.snapshot, initialSnapshot);
  assert.ok(Object.isFrozen(state));
  assert.ok(Object.isFrozen(state.snapshot));
  assert.ok(Object.isFrozen(state.snapshot.results));
  assert.ok(Object.isFrozen(state.snapshot.results[0]));
  assert.deepEqual(Object.keys(state.snapshot.results[0]).sort(), [
    "description",
    "execution",
    "heuristic",
    "icon",
    "source",
    "title",
    "token",
    "type",
  ]);

  assert.throws(
    () =>
      createBrowserUrlbarSuggestionsState({
        ...initialSnapshot,
        results: [
          {
            ...initialSnapshot.results[0],
            title: "x".repeat(maximumUrlbarSuggestionTitleLength + 1),
          },
        ],
      }),
    /FENNEVIA_URLBAR_SUGGESTIONS_RESULT_INVALID/u,
  );
  assert.throws(
    () =>
      createBrowserUrlbarSuggestionsState({
        ...initialSnapshot,
        results: [
          {
            ...initialSnapshot.results[0],
            source: "private-provider-name",
          },
        ],
      }),
    /FENNEVIA_URLBAR_SUGGESTIONS_RESULT_INVALID/u,
  );
  assert.throws(
    () =>
      createBrowserUrlbarSuggestionsState({
        ...initialSnapshot,
        phase: "empty",
      }),
    /FENNEVIA_URLBAR_SUGGESTIONS_SNAPSHOT_INVALID/u,
  );
  assert.throws(
    () =>
      createBrowserUrlbarSuggestionsState({
        ...initialSnapshot,
        results: [initialSnapshot.results[0], initialSnapshot.results[0]],
      }),
    /FENNEVIA_URLBAR_SUGGESTIONS_SNAPSHOT_INVALID/u,
  );
});

test("Urlbar suggestions reducer rejects malformed events and ignores stale revisions", () => {
  const state = createBrowserUrlbarSuggestionsState(initialSnapshot, 3);
  assert.equal(
    reduceBrowserUrlbarSuggestionsState(state, {
      revision: 3,
      snapshot: initialSnapshot,
      type: "snapshot",
    }),
    state,
  );
  assert.throws(
    () =>
      reduceBrowserUrlbarSuggestionsState(state, {
        revision: 0,
        snapshot: initialSnapshot,
        type: "snapshot",
      }),
    /FENNEVIA_URLBAR_SUGGESTIONS_EVENT_INVALID/u,
  );

  const next = reduceBrowserUrlbarSuggestionsState(state, {
    revision: 4,
    snapshot: {
      available: true,
      phase: "empty",
      queryRevision: 3,
      results: [],
    },
    type: "snapshot",
  });
  assert.equal(next.revision, 4);
  assert.equal(next.snapshot.phase, "empty");
});

test("Urlbar suggestions adapter validates commands and cleans subscriptions", () => {
  const fixture = createBridge();
  const adapter = createBrowserUrlbarSuggestionsStateAdapter(fixture.bridge);
  const received = [];
  const unsubscribe = adapter.subscribe((state) => received.push(state));
  const gesture = Object.freeze({
    altKey: false,
    button: 0,
    ctrlKey: true,
    kind: "keyboard",
    metaKey: false,
    shiftKey: false,
  });

  assert.equal(adapter.query("bounded query"), true);
  assert.deepEqual(adapter.execute(initialSnapshot.results[0].token, gesture), {
    status: "committed",
  });
  assert.equal(adapter.prepareNativeHandoff(), true);
  assert.equal(adapter.cancel(), true);
  assert.deepEqual(fixture.calls, [
    { queryLength: 13 },
    { gesture, token: initialSnapshot.results[0].token },
    "native-handoff",
    "cancel",
  ]);

  fixture.emit(
    {
      available: true,
      phase: "querying",
      queryRevision: 3,
      results: [],
    },
    1,
  );
  assert.equal(received.length, 1);
  assert.equal(adapter.snapshot().snapshot.phase, "querying");
  assert.equal(adapter.status().subscriberCount, 1);

  assert.throws(
    () =>
      adapter.execute(initialSnapshot.results[0].token, {
        ...gesture,
        button: 1,
        kind: "keyboard",
      }),
    /FENNEVIA_URLBAR_SUGGESTIONS_GESTURE_INVALID/u,
  );
  assert.equal(unsubscribe(), true);
  assert.equal(unsubscribe(), false);
  assert.equal(adapter.dispose(), true);
  assert.equal(adapter.dispose(), false);
  assert.equal(fixture.listenerCount(), 0);
  assert.throws(
    () => adapter.query("after dispose"),
    /FENNEVIA_URLBAR_SUGGESTIONS_DISPOSED/u,
  );
});
