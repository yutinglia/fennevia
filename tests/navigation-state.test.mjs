import assert from "node:assert/strict";
import test from "node:test";

import {
  createBrowserNavigationState,
  createBrowserNavigationStateAdapter,
  maximumNavigationDisplayUriLength,
  maximumNavigationTitleLength,
  reduceBrowserNavigationState,
} from "../src/app/navigation-state.ts";

const initialSnapshot = Object.freeze({
  canGoBack: false,
  canGoForward: true,
  displayUri: "https://example.invalid/start",
  loading: false,
  title: "Start",
});

function createBridge() {
  const calls = [];
  const listeners = new Set();
  let snapshot = initialSnapshot;
  return {
    bridge: Object.freeze({
      back() {
        calls.push("back");
        return true;
      },
      forward() {
        calls.push("forward");
        return true;
      },
      newTab() {
        calls.push("new-tab");
        return true;
      },
      reload() {
        calls.push("reload");
        return true;
      },
      reloadOrStop() {
        const action = snapshot.loading ? "stop" : "reload";
        calls.push(action);
        return action;
      },
      snapshot: () => snapshot,
      stop() {
        calls.push("stop");
        return true;
      },
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
      snapshot = nextSnapshot;
      for (const listener of Array.from(listeners)) {
        listener({ revision, snapshot, type: "snapshot" });
      }
    },
    listenerCount: () => listeners.size,
  };
}

test("navigation state copies bounded ordinary data", () => {
  const state = createBrowserNavigationState(
    {
      ...initialSnapshot,
      displayUri: "u".repeat(maximumNavigationDisplayUriLength + 20),
      title: "t".repeat(maximumNavigationTitleLength + 20),
    },
    3,
  );

  assert.equal(state.revision, 3);
  assert.equal(
    state.snapshot.displayUri.length,
    maximumNavigationDisplayUriLength,
  );
  assert.equal(state.snapshot.title.length, maximumNavigationTitleLength);
  assert.ok(Object.isFrozen(state));
  assert.ok(Object.isFrozen(state.snapshot));
  assert.deepEqual(Object.keys(state.snapshot).sort(), [
    "canGoBack",
    "canGoForward",
    "displayUri",
    "loading",
    "title",
  ]);
});

test("navigation reducer rejects malformed events and ignores stale revisions", () => {
  const state = createBrowserNavigationState(initialSnapshot, 2);
  assert.equal(
    reduceBrowserNavigationState(state, {
      revision: 2,
      snapshot: { ...initialSnapshot, loading: true },
      type: "snapshot",
    }),
    state,
  );
  assert.throws(
    () =>
      reduceBrowserNavigationState(state, {
        revision: 0,
        snapshot: initialSnapshot,
        type: "snapshot",
      }),
    /FENNEVIA_NAVIGATION_STATE_EVENT_INVALID/u,
  );
  assert.throws(
    () =>
      createBrowserNavigationState({
        ...initialSnapshot,
        loading: "yes",
      }),
    /FENNEVIA_NAVIGATION_STATE_SNAPSHOT_INVALID/u,
  );
});

test("navigation adapter forwards actions and publishes immutable revisions", () => {
  const fixture = createBridge();
  const adapter = createBrowserNavigationStateAdapter(fixture.bridge);
  const states = [];
  adapter.subscribe((state) => states.push(state));

  assert.equal(adapter.back(), true);
  assert.equal(adapter.forward(), true);
  assert.equal(adapter.reload(), true);
  assert.equal(adapter.stop(), true);
  assert.equal(adapter.newTab(), true);
  assert.equal(adapter.reloadOrStop(), "reload");
  assert.deepEqual(fixture.calls, [
    "back",
    "forward",
    "reload",
    "stop",
    "new-tab",
    "reload",
  ]);

  fixture.emit(
    Object.freeze({
      ...initialSnapshot,
      canGoBack: true,
      loading: true,
      title: "Loading",
    }),
    1,
  );
  assert.equal(states.length, 1);
  assert.equal(states[0].revision, 1);
  assert.equal(states[0].snapshot.loading, true);
  assert.equal(adapter.reloadOrStop(), "stop");
  assert.ok(Object.isFrozen(states[0]));
  assert.ok(Object.isFrozen(states[0].snapshot));
});

test("navigation adapter validates its public contract", () => {
  const fixture = createBridge();
  for (const member of [
    "back",
    "forward",
    "newTab",
    "reload",
    "reloadOrStop",
    "snapshot",
    "stop",
    "subscribe",
  ]) {
    assert.throws(
      () =>
        createBrowserNavigationStateAdapter({
          ...fixture.bridge,
          [member]: undefined,
        }),
      /FENNEVIA_NAVIGATION_STATE_BRIDGE_INVALID/u,
    );
  }
});

test("navigation adapter disposal unsubscribes once and rejects later access", () => {
  const fixture = createBridge();
  const adapter = createBrowserNavigationStateAdapter(fixture.bridge);
  adapter.subscribe(() => {});
  assert.equal(fixture.listenerCount(), 1);

  assert.equal(adapter.dispose(), true);
  assert.equal(adapter.dispose(), false);
  assert.equal(fixture.listenerCount(), 0);
  assert.deepEqual(adapter.status(), {
    disposed: true,
    revision: 0,
    subscriberCount: 0,
  });
  assert.throws(() => adapter.back(), /FENNEVIA_NAVIGATION_STATE_DISPOSED/u);
  assert.throws(
    () => adapter.subscribe(() => {}),
    /FENNEVIA_NAVIGATION_STATE_DISPOSED/u,
  );
});
