import assert from "node:assert/strict";
import test from "node:test";

import {
  createBrowserUrlbarCoverageState,
  createBrowserUrlbarCoverageStateAdapter,
  reduceBrowserUrlbarCoverageState,
} from "../src/app/urlbar-coverage-state.ts";

const initialSnapshot = Object.freeze({
  items: Object.freeze(["reader-view", "bookmark"]),
  permissions: Object.freeze({
    available: true,
    blocked: Object.freeze(["camera", "popups"]),
    hasPermissions: true,
    sharing: Object.freeze(["location"]),
  }),
});

function createBridge() {
  const calls = [];
  const listeners = new Set();
  let snapshot = initialSnapshot;
  return {
    bridge: Object.freeze({
      openNativeUrlbar() {
        calls.push("open-native-urlbar");
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

test("Urlbar coverage state copies only fixed ordinary indicators", () => {
  const state = createBrowserUrlbarCoverageState(initialSnapshot, 4);

  assert.equal(state.revision, 4);
  assert.deepEqual(state.snapshot, initialSnapshot);
  assert.ok(Object.isFrozen(state));
  assert.ok(Object.isFrozen(state.snapshot));
  assert.ok(Object.isFrozen(state.snapshot.items));
  assert.ok(Object.isFrozen(state.snapshot.permissions));
  assert.ok(Object.isFrozen(state.snapshot.permissions.blocked));
  assert.ok(Object.isFrozen(state.snapshot.permissions.sharing));
  assert.deepEqual(Object.keys(state.snapshot).sort(), [
    "items",
    "permissions",
  ]);
  assert.deepEqual(Object.keys(state.snapshot.permissions).sort(), [
    "available",
    "blocked",
    "hasPermissions",
    "sharing",
  ]);

  assert.throws(
    () =>
      createBrowserUrlbarCoverageState({
        ...initialSnapshot,
        items: ["invented-action"],
      }),
    /FENNEVIA_URLBAR_COVERAGE_SNAPSHOT_INVALID/u,
  );
  assert.throws(
    () =>
      createBrowserUrlbarCoverageState({
        ...initialSnapshot,
        items: ["bookmark", "bookmark"],
      }),
    /FENNEVIA_URLBAR_COVERAGE_SNAPSHOT_INVALID/u,
  );
  assert.throws(
    () =>
      createBrowserUrlbarCoverageState({
        items: [],
        permissions: {
          available: false,
          blocked: ["camera"],
          hasPermissions: false,
          sharing: [],
        },
      }),
    /FENNEVIA_URLBAR_COVERAGE_SNAPSHOT_INVALID/u,
  );
  assert.throws(
    () =>
      createBrowserUrlbarCoverageState({
        items: [],
        permissions: {
          available: true,
          blocked: ["camera"],
          hasPermissions: false,
          sharing: [],
        },
      }),
    /FENNEVIA_URLBAR_COVERAGE_SNAPSHOT_INVALID/u,
  );
});

test("Urlbar coverage reducer rejects malformed events and ignores stale revisions", () => {
  const state = createBrowserUrlbarCoverageState(initialSnapshot, 2);
  assert.equal(
    reduceBrowserUrlbarCoverageState(state, {
      revision: 2,
      snapshot: initialSnapshot,
      type: "snapshot",
    }),
    state,
  );
  assert.throws(
    () =>
      reduceBrowserUrlbarCoverageState(state, {
        revision: 0,
        snapshot: initialSnapshot,
        type: "snapshot",
      }),
    /FENNEVIA_URLBAR_COVERAGE_EVENT_INVALID/u,
  );

  const next = reduceBrowserUrlbarCoverageState(state, {
    revision: 3,
    snapshot: {
      items: ["translations"],
      permissions: {
        available: true,
        blocked: [],
        hasPermissions: false,
        sharing: [],
      },
    },
    type: "snapshot",
  });
  assert.equal(next.revision, 3);
  assert.deepEqual(next.snapshot.items, ["translations"]);
});

test("Urlbar coverage adapter forwards native access and cleans subscriptions", () => {
  const fixture = createBridge();
  const adapter = createBrowserUrlbarCoverageStateAdapter(fixture.bridge);
  const received = [];
  const unsubscribe = adapter.subscribe((state) => received.push(state));

  assert.equal(adapter.openNativeUrlbar(), true);
  assert.deepEqual(fixture.calls, ["open-native-urlbar"]);
  fixture.emit(
    {
      items: ["remote-control", "extension-actions"],
      permissions: {
        available: true,
        blocked: ["notifications"],
        hasPermissions: true,
        sharing: ["media"],
      },
    },
    1,
  );
  assert.equal(received.length, 1);
  assert.deepEqual(adapter.snapshot().snapshot.items, [
    "remote-control",
    "extension-actions",
  ]);
  assert.equal(adapter.status().subscriberCount, 1);
  assert.equal(unsubscribe(), true);
  assert.equal(unsubscribe(), false);
  assert.equal(adapter.dispose(), true);
  assert.equal(adapter.dispose(), false);
  assert.equal(fixture.listenerCount(), 0);
  assert.throws(
    () => adapter.openNativeUrlbar(),
    /FENNEVIA_URLBAR_COVERAGE_DISPOSED/u,
  );
});
