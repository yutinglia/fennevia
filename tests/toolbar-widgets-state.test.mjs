import assert from "node:assert/strict";
import test from "node:test";

import {
  copyToolbarWidgetSnapshot,
  copyToolbarWidgetsSnapshot,
  createBrowserToolbarWidgetsState,
  createBrowserToolbarWidgetsStateAdapter,
  isInteractiveToolbarWidget,
  isToolbarWidgetKind,
  reduceBrowserToolbarWidgetsState,
} from "../src/app/toolbar-widgets-state.ts";

const extensionWidget = Object.freeze({
  badgeBackground: "rgb(217, 0, 0)",
  badgeText: "3",
  badgeTextColor: "rgb(255, 255, 255)",
  disabled: false,
  handle: "toolbar-widget-registry-1-handle-1",
  icon: "extension",
  iconUrl: "moz-extension://11111111-2222-3333-4444-555555555555/icon.png",
  kind: "extension-action",
  label: "Test Extension",
  tooltip: "Test Extension tooltip",
});

const springWidget = Object.freeze({
  badgeBackground: "",
  badgeText: "",
  badgeTextColor: "",
  disabled: false,
  handle: "",
  icon: "",
  iconUrl: "",
  kind: "spring",
  label: "",
  tooltip: "",
});

const emptySnapshot = Object.freeze({
  available: false,
  widgets: Object.freeze([]),
});

function createFakeBridge(overrides = {}) {
  const listeners = new Set();
  const popupListeners = new Set();
  const calls = [];
  const bridge = {
    async invoke(handle, host) {
      calls.push(["invoke", handle, host]);
      return true;
    },
    snapshot() {
      calls.push(["snapshot"]);
      return emptySnapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    subscribePopup(listener) {
      popupListeners.add(listener);
      return () => popupListeners.delete(listener);
    },
    ...overrides,
  };
  return { bridge, calls, listeners, popupListeners };
}

test("toolbar widget kind helpers classify interactivity", () => {
  assert.equal(isToolbarWidgetKind("extension-action"), true);
  assert.equal(isToolbarWidgetKind("built-in"), true);
  assert.equal(isToolbarWidgetKind("spring"), true);
  assert.equal(isToolbarWidgetKind("navbar"), false);
  assert.equal(isToolbarWidgetKind(7), false);
  assert.equal(isInteractiveToolbarWidget(extensionWidget), true);
  assert.equal(isInteractiveToolbarWidget(springWidget), false);
});

test("copyToolbarWidgetSnapshot enforces bounded privacy-safe fields", () => {
  const copy = copyToolbarWidgetSnapshot(extensionWidget);
  assert.deepEqual(copy, extensionWidget);
  assert.ok(Object.isFrozen(copy));

  assert.throws(
    () => copyToolbarWidgetSnapshot({ ...extensionWidget, kind: "custom" }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_WIDGET_INVALID/u,
  );
  assert.throws(
    () => copyToolbarWidgetSnapshot({ ...extensionWidget, handle: "" }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_HANDLE_INVALID/u,
  );
  assert.throws(
    () =>
      copyToolbarWidgetSnapshot({
        ...springWidget,
        handle: "toolbar-widget-registry-1-handle-2",
      }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_HANDLE_INVALID/u,
  );
  assert.throws(
    () =>
      copyToolbarWidgetSnapshot({
        ...extensionWidget,
        iconUrl: "https://example.test/icon.png",
      }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_ICON_URL_INVALID/u,
  );
  assert.throws(
    () => copyToolbarWidgetSnapshot({ ...extensionWidget, icon: "Bad Icon!" }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_ICON_INVALID/u,
  );
  assert.throws(
    () =>
      copyToolbarWidgetSnapshot({
        ...extensionWidget,
        badgeText: "123456789",
      }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_TEXT_INVALID/u,
  );
  assert.throws(
    () =>
      copyToolbarWidgetSnapshot({
        ...extensionWidget,
        label: "x".repeat(201),
      }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_TEXT_INVALID/u,
  );
});

test("copyToolbarWidgetsSnapshot validates the container shape", () => {
  const copy = copyToolbarWidgetsSnapshot({
    available: true,
    widgets: [extensionWidget, springWidget],
  });
  assert.equal(copy.available, true);
  assert.equal(copy.widgets.length, 2);
  assert.ok(Object.isFrozen(copy));
  assert.ok(Object.isFrozen(copy.widgets));

  assert.throws(
    () => copyToolbarWidgetsSnapshot({ available: 1, widgets: [] }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_SNAPSHOT_INVALID/u,
  );
  assert.throws(
    () => copyToolbarWidgetsSnapshot({ available: true, widgets: "none" }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_SNAPSHOT_INVALID/u,
  );
});

test("state reducer applies only newer revisions", () => {
  const initial = createBrowserToolbarWidgetsState(emptySnapshot);
  assert.equal(initial.revision, 0);
  assert.throws(
    () => createBrowserToolbarWidgetsState(emptySnapshot, -1),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_REVISION_INVALID/u,
  );

  const next = reduceBrowserToolbarWidgetsState(initial, {
    revision: 2,
    snapshot: { available: true, widgets: [extensionWidget] },
    type: "snapshot",
  });
  assert.equal(next.revision, 2);
  assert.equal(next.snapshot.widgets.length, 1);

  const stale = reduceBrowserToolbarWidgetsState(next, {
    revision: 1,
    snapshot: emptySnapshot,
    type: "snapshot",
  });
  assert.equal(stale, next);

  assert.throws(
    () =>
      reduceBrowserToolbarWidgetsState(next, {
        revision: 3,
        snapshot: emptySnapshot,
        type: "widgets",
      }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_EVENT_INVALID/u,
  );
  assert.throws(
    () =>
      reduceBrowserToolbarWidgetsState(next, {
        revision: 0,
        snapshot: emptySnapshot,
        type: "snapshot",
      }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_EVENT_INVALID/u,
  );
});

test("adapter validates the bridge contract before use", () => {
  assert.throws(
    () => createBrowserToolbarWidgetsStateAdapter(null),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_BRIDGE_INVALID/u,
  );
  assert.throws(
    () =>
      createBrowserToolbarWidgetsStateAdapter({
        invoke() {},
        snapshot() {},
        subscribe() {},
      }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_BRIDGE_INVALID/u,
  );
  const { bridge } = createFakeBridge({
    subscribe() {
      return undefined;
    },
  });
  assert.throws(
    () => createBrowserToolbarWidgetsStateAdapter(bridge),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_SUBSCRIPTION_INVALID/u,
  );
});

test("adapter forwards snapshot events and popup notifications", () => {
  const fake = createFakeBridge();
  const adapter = createBrowserToolbarWidgetsStateAdapter(fake.bridge);
  const states = [];
  const popupStates = [];
  const unsubscribe = adapter.subscribe((state) => states.push(state));
  const unsubscribePopup = adapter.subscribePopup((open) =>
    popupStates.push(open),
  );
  try {
    assert.equal(adapter.snapshot().revision, 0);
    assert.equal(adapter.snapshot().snapshot.available, false);

    for (const listener of fake.listeners) {
      listener({
        revision: 1,
        snapshot: { available: true, widgets: [extensionWidget] },
        type: "snapshot",
      });
    }
    assert.equal(states.length, 1);
    assert.equal(states[0].revision, 1);
    assert.equal(states[0].snapshot.widgets[0].label, "Test Extension");

    for (const listener of fake.listeners) {
      listener({
        revision: 1,
        snapshot: emptySnapshot,
        type: "snapshot",
      });
    }
    assert.equal(states.length, 1);

    for (const listener of fake.popupListeners) {
      listener({ open: true, type: "widget-popup" });
      listener({ open: false, type: "widget-popup" });
    }
    assert.deepEqual(popupStates, [true, false]);

    assert.throws(() => {
      for (const listener of fake.popupListeners) {
        listener({ open: "yes", type: "widget-popup" });
      }
    }, /FENNEVIA_TOOLBAR_WIDGETS_STATE_EVENT_INVALID/u);

    const status = adapter.status();
    assert.equal(status.disposed, false);
    assert.equal(status.subscriberCount, 1);
    assert.equal(status.popupSubscriberCount, 1);
    assert.equal(status.revision, 1);

    assert.equal(unsubscribe(), true);
    assert.equal(unsubscribe(), false);
    assert.equal(unsubscribePopup(), true);
    assert.equal(unsubscribePopup(), false);
  } finally {
    adapter.dispose();
  }
});

test("adapter invoke validates handle, host, and bridge result", async () => {
  const fake = createFakeBridge();
  const adapter = createBrowserToolbarWidgetsStateAdapter(fake.bridge);
  try {
    const host = { getBoundingClientRect() {} };
    assert.equal(
      await adapter.invoke("toolbar-widget-registry-1-handle-1", host),
      true,
    );
    assert.deepEqual(fake.calls.at(-1), [
      "invoke",
      "toolbar-widget-registry-1-handle-1",
      host,
    ]);

    await assert.rejects(
      adapter.invoke("", host),
      /FENNEVIA_TOOLBAR_WIDGETS_STATE_HANDLE_INVALID/u,
    );
    await assert.rejects(
      adapter.invoke("toolbar-widget-registry-1-handle-1", undefined),
      /FENNEVIA_TOOLBAR_WIDGETS_STATE_HOST_INVALID/u,
    );
  } finally {
    adapter.dispose();
  }

  const badResult = createFakeBridge({
    async invoke() {
      return "opened";
    },
  });
  const badAdapter = createBrowserToolbarWidgetsStateAdapter(badResult.bridge);
  try {
    await assert.rejects(
      badAdapter.invoke("toolbar-widget-registry-1-handle-1", {}),
      /FENNEVIA_TOOLBAR_WIDGETS_STATE_RESULT_INVALID/u,
    );
  } finally {
    badAdapter.dispose();
  }
});

test("adapter dispose is deterministic and idempotent", async () => {
  const fake = createFakeBridge();
  const adapter = createBrowserToolbarWidgetsStateAdapter(fake.bridge);
  adapter.subscribe(() => {});
  adapter.subscribePopup(() => {});

  assert.equal(adapter.dispose(), true);
  assert.equal(adapter.dispose(), false);
  assert.equal(fake.listeners.size, 0);
  assert.equal(fake.popupListeners.size, 0);

  const status = adapter.status();
  assert.equal(status.disposed, true);
  assert.equal(status.subscriberCount, 0);
  assert.equal(status.popupSubscriberCount, 0);

  assert.throws(
    () => adapter.snapshot(),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_DISPOSED/u,
  );
  assert.throws(
    () => adapter.subscribe(() => {}),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_DISPOSED/u,
  );
  await assert.rejects(
    adapter.invoke("toolbar-widget-registry-1-handle-1", {}),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_DISPOSED/u,
  );
});

test("adapter rejects invalid listeners", () => {
  const fake = createFakeBridge();
  const adapter = createBrowserToolbarWidgetsStateAdapter(fake.bridge);
  try {
    assert.throws(
      () => adapter.subscribe("listener"),
      /FENNEVIA_TOOLBAR_WIDGETS_STATE_LISTENER_INVALID/u,
    );
    assert.throws(
      () => adapter.subscribePopup(null),
      /FENNEVIA_TOOLBAR_WIDGETS_STATE_LISTENER_INVALID/u,
    );
  } finally {
    adapter.dispose();
  }
});
