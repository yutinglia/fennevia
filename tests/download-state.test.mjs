import assert from "node:assert/strict";
import test from "node:test";

import {
  copyBrowserDownloadsSnapshot,
  createBrowserDownloadsStateAdapter,
  maximumDownloadCount,
  maximumDownloadItems,
} from "../src/app/download-state.ts";

function snapshot(overrides = {}) {
  return Object.freeze({
    activeCount: 0,
    aggregatePercent: null,
    canceledCount: 0,
    countOverflow: false,
    failedCount: 0,
    items: Object.freeze([]),
    pausedCount: 0,
    phase: "ready",
    progressMode: "none",
    queuedCount: 0,
    revision: 1,
    succeededCount: 0,
    truncated: false,
    ...overrides,
  });
}

function createBridge(initial = snapshot({ phase: "loading", revision: 0 })) {
  const listeners = new Set();
  let current = initial;
  let ready = initial.phase === "ready";
  let resolveReady;
  const readiness = new Promise((resolve) => {
    resolveReady = resolve;
  });
  if (ready) {
    resolveReady(true);
  }
  return {
    bridge: Object.freeze({
      async ready() {
        await readiness;
        return true;
      },
      snapshot() {
        return current;
      },
      subscribe(listener) {
        listeners.add(listener);
        let subscribed = true;
        return () => {
          if (!subscribed) {
            return false;
          }
          subscribed = false;
          listeners.delete(listener);
          return true;
        };
      },
    }),
    dispatch(next) {
      current = next;
      for (const listener of Array.from(listeners)) {
        listener(next);
      }
    },
    listenerCount() {
      return listeners.size;
    },
    markReady(next = snapshot()) {
      current = next;
      ready = true;
      for (const listener of Array.from(listeners)) {
        listener(next);
      }
      resolveReady(true);
      return ready;
    },
  };
}

test("download state copies immutable bounded anonymous data", () => {
  const input = snapshot({
    activeCount: 1,
    aggregatePercent: 45,
    items: [
      {
        id: "download-registry-1-handle-1",
        progressPercent: 45,
        state: "active",
      },
    ],
    progressMode: "determinate",
  });
  const copy = copyBrowserDownloadsSnapshot(input);
  assert.deepEqual(copy, input);
  assert.notEqual(copy, input);
  assert.notEqual(copy.items, input.items);
  assert.ok(Object.isFrozen(copy));
  assert.ok(Object.isFrozen(copy.items));
  assert.ok(copy.items.every(Object.isFrozen));
});

test("download state rejects malformed progress, counts, IDs, and item overflow", () => {
  const invalid = [
    snapshot({ activeCount: 1, progressMode: "none" }),
    snapshot({
      activeCount: 1,
      aggregatePercent: null,
      progressMode: "determinate",
    }),
    snapshot({ activeCount: maximumDownloadCount + 1 }),
    snapshot({
      items: [{ id: "", progressPercent: null, state: "queued" }],
      queuedCount: 1,
    }),
    snapshot({
      items: [{ id: "one", progressPercent: 99, state: "succeeded" }],
      succeededCount: 1,
    }),
    snapshot({
      activeCount: maximumDownloadItems + 1,
      aggregatePercent: 1,
      items: Array.from({ length: maximumDownloadItems + 1 }, (_, index) => ({
        id: `download-${index}`,
        progressPercent: 1,
        state: "active",
      })),
      progressMode: "determinate",
    }),
  ];
  for (const candidate of invalid) {
    assert.throws(
      () => copyBrowserDownloadsSnapshot(candidate),
      /FENNEVIA_DOWNLOAD_STATE_/u,
    );
  }
});

test("adapter waits for ready, publishes increasing revisions, and copies updates", async () => {
  const native = createBridge();
  const adapter = createBrowserDownloadsStateAdapter(native.bridge);
  const updates = [];
  const unsubscribe = adapter.subscribe((state) => updates.push(state));
  assert.equal(adapter.snapshot().phase, "loading");
  assert.equal(native.listenerCount(), 1);

  native.markReady(
    snapshot({
      activeCount: 1,
      aggregatePercent: null,
      items: [{ id: "download-one", progressPercent: null, state: "active" }],
      progressMode: "indeterminate",
      revision: 1,
    }),
  );
  await adapter.ready();
  assert.equal(adapter.snapshot().phase, "ready");
  assert.equal(updates.length, 1);

  native.dispatch(
    snapshot({
      activeCount: 1,
      aggregatePercent: 80,
      items: [{ id: "download-one", progressPercent: 80, state: "active" }],
      progressMode: "determinate",
      revision: 2,
    }),
  );
  assert.equal(adapter.snapshot().aggregatePercent, 80);
  assert.equal(updates.length, 2);

  native.dispatch(native.bridge.snapshot());
  assert.equal(updates.length, 2);
  assert.equal(unsubscribe(), true);
  assert.equal(unsubscribe(), false);
  assert.equal(adapter.status().subscriberCount, 0);
  adapter.dispose();
});

test("adapter rejects stale or malformed bridge updates", async () => {
  const native = createBridge(snapshot({ revision: 4 }));
  const adapter = createBrowserDownloadsStateAdapter(native.bridge);
  await adapter.ready();
  assert.throws(
    () => native.dispatch(snapshot({ revision: 3 })),
    /FENNEVIA_DOWNLOAD_STATE_REVISION_INVALID/u,
  );
  assert.throws(
    () =>
      native.dispatch(
        snapshot({
          activeCount: 1,
          aggregatePercent: 101,
          progressMode: "determinate",
          revision: 5,
        }),
      ),
    /FENNEVIA_DOWNLOAD_STATE_PROGRESS_INVALID/u,
  );
  adapter.dispose();
});

test("adapter disposal unsubscribes exactly once and blocks active operations", async () => {
  const native = createBridge(snapshot());
  const adapter = createBrowserDownloadsStateAdapter(native.bridge);
  await adapter.ready();
  adapter.subscribe(() => {});
  assert.equal(adapter.dispose(), true);
  assert.equal(adapter.dispose(), false);
  assert.equal(native.listenerCount(), 0);
  assert.equal(adapter.snapshot().phase, "disposed");
  assert.equal(adapter.status().subscriberCount, 0);
  assert.throws(() => adapter.subscribe(() => {}), /DOWNLOAD_STATE_DISPOSED/u);
  assert.throws(() => adapter.ready(), /DOWNLOAD_STATE_DISPOSED/u);
});
