import assert from "node:assert/strict";
import test from "node:test";

import {
  createBrowserTabsState,
  createBrowserTabsStateAdapter,
  maximumTabTitleLength,
  reduceBrowserTabsState,
} from "../src/app/tab-state.ts";

const firstTab = Object.freeze({
  id: "tab-registry-1-handle-1",
  loading: false,
  pinned: false,
  selected: true,
  title: "First",
});

test("tab state copies only ordinary fields into frozen ordered snapshots", () => {
  const privilegedHandle = { native: true };
  const state = createBrowserTabsState([
    {
      ...firstTab,
      privilegedHandle,
      title: "x".repeat(maximumTabTitleLength + 20),
    },
  ]);

  assert.equal(state.tabs[0].title.length, maximumTabTitleLength);
  assert.equal("privilegedHandle" in state.tabs[0], false);
  assert.doesNotMatch(JSON.stringify(state), /privilegedHandle|native/u);
  assert.ok(Object.isFrozen(state));
  assert.ok(Object.isFrozen(state.tabs));
  assert.ok(Object.isFrozen(state.tabs[0]));
});

test("the reducer replaces order atomically and ignores stale revisions", () => {
  const initial = createBrowserTabsState([firstTab]);
  const secondTab = Object.freeze({
    id: "tab-registry-1-handle-2",
    loading: true,
    pinned: true,
    selected: false,
    title: "Second",
  });
  const updated = reduceBrowserTabsState(initial, {
    revision: 4,
    tabs: [secondTab, firstTab],
    type: "snapshot",
  });

  assert.deepEqual(
    updated.tabs.map((tab) => tab.id),
    [secondTab.id, firstTab.id],
  );
  assert.equal(updated.revision, 4);
  assert.strictEqual(
    reduceBrowserTabsState(updated, {
      revision: 3,
      tabs: [firstTab],
      type: "snapshot",
    }),
    updated,
  );
});

test("tab state rejects duplicate IDs and malformed events", () => {
  assert.throws(
    () => createBrowserTabsState([firstTab, firstTab]),
    /FENNEVIA_TAB_STATE_ID_DUPLICATE/u,
  );
  assert.throws(
    () =>
      reduceBrowserTabsState(createBrowserTabsState([]), {
        revision: 0,
        tabs: [],
        type: "snapshot",
      }),
    /FENNEVIA_TAB_STATE_EVENT_INVALID/u,
  );
});

test("the adapter forwards actions, publishes reactive state, and disposes once", () => {
  const bridgeListeners = new Set();
  const actions = [];
  let bridgeUnsubscribeCount = 0;
  const bridge = Object.freeze({
    close(tabId) {
      actions.push(["close", tabId]);
    },
    open(options) {
      actions.push(["open", options]);
      return "tab-registry-1-handle-2";
    },
    pin(tabId) {
      actions.push(["pin", tabId]);
    },
    select(tabId) {
      actions.push(["select", tabId]);
    },
    snapshot() {
      return [firstTab];
    },
    subscribe(listener) {
      bridgeListeners.add(listener);
      let active = true;
      return () => {
        if (!active) {
          return false;
        }
        active = false;
        bridgeListeners.delete(listener);
        bridgeUnsubscribeCount += 1;
        return true;
      };
    },
    unpin(tabId) {
      actions.push(["unpin", tabId]);
    },
  });
  const adapter = createBrowserTabsStateAdapter(bridge);
  const observed = [];
  const unsubscribe = adapter.subscribe((state) => observed.push(state));

  for (const listener of bridgeListeners) {
    listener({
      revision: 2,
      tabs: [{ ...firstTab, loading: true }],
      type: "snapshot",
    });
  }
  assert.equal(adapter.snapshot().tabs[0].loading, true);
  assert.equal(observed.length, 1);

  const openedId = adapter.open({ selected: false });
  adapter.select(openedId);
  adapter.pin(openedId);
  adapter.unpin(openedId);
  adapter.close(openedId);
  assert.deepEqual(actions, [
    ["open", { selected: false }],
    ["select", openedId],
    ["pin", openedId],
    ["unpin", openedId],
    ["close", openedId],
  ]);

  assert.equal(unsubscribe(), true);
  assert.equal(unsubscribe(), false);
  assert.equal(adapter.dispose(), true);
  assert.equal(adapter.dispose(), false);
  assert.equal(bridgeUnsubscribeCount, 1);
  assert.deepEqual(adapter.status(), {
    disposed: true,
    revision: 2,
    subscriberCount: 0,
    tabCount: 1,
  });
  assert.throws(
    () => adapter.select(firstTab.id),
    /FENNEVIA_TAB_STATE_DISPOSED/u,
  );
});
