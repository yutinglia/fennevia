import assert from "node:assert/strict";
import test from "node:test";

import {
  copyToolbarStylePartial,
  copyToolbarPaletteEntrySnapshot,
  copyToolbarWidgetPartSnapshot,
  copyToolbarWidgetSnapshot,
  copyToolbarWidgetsEditOperation,
  copyToolbarWidgetsSnapshot,
  createBrowserToolbarWidgetsState,
  createBrowserToolbarWidgetsStateAdapter,
  createDefaultToolbarStyle,
  createEmptyToolbarWidgetZones,
  createUnavailableToolbarWidgetsSnapshot,
  isInteractiveToolbarWidget,
  isToolbarWidgetKind,
  reduceBrowserToolbarWidgetsState,
} from "../src/app/toolbar-widgets-state.ts";

const extensionWidget = Object.freeze({
  badgeBackground: "rgb(217, 0, 0)",
  badgeText: "3",
  badgeTextColor: "rgb(255, 255, 255)",
  disabled: false,
  fenneviaAction: "",
  handle: "toolbar-widget-registry-1-handle-1",
  icon: "extension",
  iconUrl: "moz-extension://11111111-2222-3333-4444-555555555555/icon.png",
  kind: "extension-action",
  label: "Test Extension",
  missing: false,
  parts: Object.freeze([]),
  tooltip: "Test Extension tooltip",
});

const springWidget = Object.freeze({
  badgeBackground: "",
  badgeText: "",
  badgeTextColor: "",
  disabled: false,
  fenneviaAction: "",
  handle: "",
  icon: "",
  iconUrl: "",
  kind: "spring",
  label: "",
  missing: false,
  parts: Object.freeze([]),
  tooltip: "",
});

const fenneviaWidget = Object.freeze({
  badgeBackground: "",
  badgeText: "",
  badgeTextColor: "",
  disabled: false,
  fenneviaAction: "show-bookmarks",
  handle: "",
  icon: "bookmark",
  iconUrl: "",
  kind: "fennevia",
  label: "Show bookmarks panel",
  missing: false,
  parts: Object.freeze([]),
  tooltip: "Reveal the Fennevia bookmarks panel",
});

const missingWidget = Object.freeze({
  badgeBackground: "",
  badgeText: "",
  badgeTextColor: "",
  disabled: true,
  fenneviaAction: "",
  handle: "",
  icon: "generic",
  iconUrl: "",
  kind: "built-in",
  label: "Toolbar item",
  missing: true,
  parts: Object.freeze([]),
  tooltip: "Toolbar item",
});

const zoomOutPart = Object.freeze({
  disabled: false,
  handle: "toolbar-widget-registry-1-handle-3",
  icon: "zoom-out",
  iconUrl: "chrome://global/skin/icons/minus.svg",
  kind: "built-in",
  label: "Zoom out",
  tooltip: "Zoom out (Ctrl+-)",
});

const compoundWidget = Object.freeze({
  ...extensionWidget,
  badgeBackground: "",
  badgeText: "",
  badgeTextColor: "",
  handle: "toolbar-widget-registry-1-handle-2",
  icon: "zoom",
  iconUrl: "",
  kind: "built-in",
  label: "Zoom",
  parts: Object.freeze([zoomOutPart]),
  tooltip: "Zoom controls",
});

const paletteEntry = Object.freeze({
  icon: "print",
  iconUrl: "",
  kind: "built-in",
  label: "Print",
  token: "palette-1",
});

const emptySnapshot = createUnavailableToolbarWidgetsSnapshot();

const makeSnapshot = (topWidgets, overrides = {}) =>
  Object.freeze({
    available: true,
    canEdit: true,
    layoutCustomized: false,
    palette: Object.freeze([paletteEntry]),
    style: createDefaultToolbarStyle(),
    zones: Object.freeze({
      ...createEmptyToolbarWidgetZones(),
      top: Object.freeze(topWidgets),
    }),
    ...overrides,
  });

function createFakeBridge(overrides = {}) {
  const listeners = new Set();
  const popupListeners = new Set();
  const calls = [];
  const bridge = {
    async edit(operation) {
      calls.push(["edit", operation]);
      return true;
    },
    async invoke(handle, host, triggerEvent) {
      calls.push(["invoke", handle, host, triggerEvent]);
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
  assert.equal(isToolbarWidgetKind("fennevia"), true);
  assert.equal(isToolbarWidgetKind("spring"), true);
  assert.equal(isToolbarWidgetKind("navbar"), false);
  assert.equal(isToolbarWidgetKind(7), false);
  assert.equal(isInteractiveToolbarWidget(extensionWidget), true);
  assert.equal(isInteractiveToolbarWidget(fenneviaWidget), true);
  assert.equal(isInteractiveToolbarWidget(springWidget), false);
  assert.equal(isInteractiveToolbarWidget(missingWidget), false);
});

test("copyToolbarWidgetSnapshot enforces bounded privacy-safe fields", () => {
  const copy = copyToolbarWidgetSnapshot(extensionWidget);
  assert.deepEqual(copy, extensionWidget);
  assert.ok(Object.isFrozen(copy));
  assert.deepEqual(copyToolbarWidgetSnapshot(fenneviaWidget), fenneviaWidget);
  assert.deepEqual(copyToolbarWidgetSnapshot(missingWidget), missingWidget);
  const compoundCopy = copyToolbarWidgetSnapshot(compoundWidget);
  assert.deepEqual(compoundCopy, compoundWidget);
  assert.ok(Object.isFrozen(compoundCopy.parts));
  assert.deepEqual(copyToolbarWidgetPartSnapshot(zoomOutPart), zoomOutPart);

  assert.throws(
    () =>
      copyToolbarWidgetSnapshot({
        ...extensionWidget,
        parts: [zoomOutPart],
      }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_WIDGET_INVALID/u,
  );
  assert.throws(
    () =>
      copyToolbarWidgetSnapshot({
        ...compoundWidget,
        parts: [zoomOutPart, zoomOutPart],
      }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_HANDLE_INVALID/u,
  );
  assert.throws(
    () =>
      copyToolbarWidgetSnapshot({
        ...compoundWidget,
        parts: [{ ...zoomOutPart, handle: compoundWidget.handle }],
      }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_HANDLE_INVALID/u,
  );
  assert.throws(
    () => copyToolbarWidgetPartSnapshot({ ...zoomOutPart, handle: "" }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_WIDGET_INVALID/u,
  );

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
        ...fenneviaWidget,
        handle: "toolbar-widget-registry-1-handle-2",
      }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_HANDLE_INVALID/u,
  );
  assert.throws(
    () =>
      copyToolbarWidgetSnapshot({
        ...fenneviaWidget,
        fenneviaAction: "open-shell",
      }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_ACTION_INVALID/u,
  );
  assert.throws(
    () =>
      copyToolbarWidgetSnapshot({
        ...extensionWidget,
        fenneviaAction: "show-bookmarks",
      }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_ACTION_INVALID/u,
  );
  assert.throws(
    () =>
      copyToolbarWidgetSnapshot({
        ...extensionWidget,
        iconUrl: "https://example.test/icon.png",
      }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_ICON_URL_INVALID/u,
  );
  assert.deepEqual(
    copyToolbarWidgetSnapshot({
      ...missingWidget,
      iconUrl: "chrome://browser/skin/save.svg",
      label: "Save Page",
      tooltip: "Save Page",
    }).iconUrl,
    "chrome://browser/skin/save.svg",
  );
  assert.deepEqual(
    copyToolbarWidgetSnapshot({
      ...missingWidget,
      iconUrl: "resource://gre/res/icon.svg",
    }).iconUrl,
    "resource://gre/res/icon.svg",
  );
  assert.throws(
    () =>
      copyToolbarWidgetSnapshot({
        ...extensionWidget,
        iconUrl: "data:image/png;base64,AAAA",
      }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_ICON_URL_INVALID/u,
  );
  assert.throws(
    () =>
      copyToolbarWidgetSnapshot({
        ...missingWidget,
        iconUrl: 'chrome://browser/skin/save".svg',
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
  assert.equal(
    copyToolbarPaletteEntrySnapshot({
      ...paletteEntry,
      iconUrl: "chrome://browser/skin/save.svg",
    }).iconUrl,
    "chrome://browser/skin/save.svg",
  );
  assert.throws(
    () =>
      copyToolbarPaletteEntrySnapshot({
        ...paletteEntry,
        iconUrl: "https://example.test/icon.png",
      }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_ICON_URL_INVALID/u,
  );
});

test("copyToolbarWidgetsSnapshot validates the container shape", () => {
  const copy = copyToolbarWidgetsSnapshot(
    makeSnapshot([extensionWidget, springWidget]),
  );
  assert.equal(copy.available, true);
  assert.equal(copy.canEdit, true);
  assert.equal(copy.zones.top.length, 2);
  assert.equal(copy.palette[0].label, "Print");
  assert.equal(copy.style.theme, "auto");
  assert.ok(Object.isFrozen(copy));
  assert.ok(Object.isFrozen(copy.zones.top));
  assert.ok(Object.isFrozen(copy.palette));

  assert.throws(
    () => copyToolbarWidgetsSnapshot({ ...makeSnapshot([]), available: 1 }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_SNAPSHOT_INVALID/u,
  );
  assert.throws(
    () =>
      copyToolbarWidgetsSnapshot({
        ...makeSnapshot([]),
        zones: { top: [] },
      }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_ZONE_INVALID/u,
  );
  assert.throws(
    () =>
      copyToolbarWidgetsSnapshot({
        ...makeSnapshot([]),
        palette: [{ ...paletteEntry, token: "Bad Token!" }],
      }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_PALETTE_INVALID/u,
  );
  assert.throws(
    () =>
      copyToolbarWidgetsSnapshot({
        ...makeSnapshot([]),
        style: { ...createDefaultToolbarStyle(), accent: "blue" },
      }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID/u,
  );
});

test("style partials validate every provided key", () => {
  assert.equal(createDefaultToolbarStyle().autoHideDelay, 300);
  assert.equal(createDefaultToolbarStyle().shortcutHintDuration, 600);
  assert.equal(createDefaultToolbarStyle().windowLeaveHideDelay, 800);
  assert.deepEqual(
    copyToolbarStylePartial({
      accent: "#3b82f6",
      autoHideDelay: 640,
      blur: 0,
      edgeTriggerSize: 20,
      shortcutHintDuration: 0,
      temporaryRevealDuration: 2_400,
      windowLeaveHideDelay: 1_600,
    }),
    {
      accent: "#3b82f6",
      autoHideDelay: 640,
      blur: 0,
      edgeTriggerSize: 20,
      shortcutHintDuration: 0,
      temporaryRevealDuration: 2_400,
      windowLeaveHideDelay: 1_600,
    },
  );
  assert.deepEqual(copyToolbarStylePartial({ accent: "#3B82F6", text: "" }), {
    accent: "#3b82f6",
    text: "",
  });
  assert.deepEqual(
    copyToolbarStylePartial({
      chromeBackground: "#141A23",
      motion: 0,
      saturation: 100,
      shadow: 0,
      surface: "#F7FAFC",
    }),
    {
      chromeBackground: "#141a23",
      motion: 0,
      saturation: 100,
      shadow: 0,
      surface: "#f7fafc",
    },
  );
  assert.throws(
    () => copyToolbarStylePartial({}),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID/u,
  );
  assert.throws(
    () => copyToolbarStylePartial({ accent: "#GGGGGG" }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID/u,
  );
  assert.throws(
    () => copyToolbarStylePartial({ blur: 200 }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID/u,
  );
  assert.throws(
    () => copyToolbarStylePartial({ saturation: 90 }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID/u,
  );
  assert.throws(
    () => copyToolbarStylePartial({ autoHideDelay: 99 }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID/u,
  );
  assert.throws(
    () => copyToolbarStylePartial({ edgeTriggerSize: 25 }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID/u,
  );
  assert.throws(
    () => copyToolbarStylePartial({ shortcutHintDuration: -1 }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID/u,
  );
  assert.throws(
    () => copyToolbarStylePartial({ temporaryRevealDuration: 399 }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID/u,
  );
  assert.throws(
    () => copyToolbarStylePartial({ windowLeaveHideDelay: 5_001 }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID/u,
  );
  assert.throws(
    () => copyToolbarStylePartial({ sparkle: true }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID/u,
  );
});

test("edit operations validate their shape before crossing the bridge", () => {
  const add = copyToolbarWidgetsEditOperation({
    index: 0,
    revision: 3,
    token: "palette-1",
    type: "add",
    zone: "left",
  });
  assert.equal(add.zone, "left");
  assert.ok(Object.isFrozen(add));

  const move = copyToolbarWidgetsEditOperation({
    fromIndex: 1,
    fromZone: "top",
    revision: 3,
    toIndex: 0,
    toZone: "bottom",
    type: "move",
  });
  assert.equal(move.toZone, "bottom");

  copyToolbarWidgetsEditOperation({
    index: 2,
    revision: 0,
    type: "remove",
    zone: "right",
  });
  copyToolbarWidgetsEditOperation({ revision: 1, type: "reset-layout" });
  copyToolbarWidgetsEditOperation({
    style: { theme: "dark" },
    type: "set-style",
  });
  copyToolbarWidgetsEditOperation({ type: "reset-style" });

  assert.throws(
    () => copyToolbarWidgetsEditOperation(null),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID/u,
  );
  assert.throws(
    () =>
      copyToolbarWidgetsEditOperation({
        index: 0,
        revision: 1,
        token: "Bad Token!",
        type: "add",
        zone: "top",
      }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID/u,
  );
  assert.throws(
    () =>
      copyToolbarWidgetsEditOperation({
        index: 0,
        revision: 1,
        type: "remove",
        zone: "center",
      }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID/u,
  );
  assert.throws(
    () => copyToolbarWidgetsEditOperation({ type: "repaint" }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID/u,
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
    snapshot: makeSnapshot([extensionWidget]),
    type: "snapshot",
  });
  assert.equal(next.revision, 2);
  assert.equal(next.snapshot.zones.top.length, 1);

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
        subscribePopup() {},
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
        snapshot: makeSnapshot([extensionWidget]),
        type: "snapshot",
      });
    }
    assert.equal(states.length, 1);
    assert.equal(states[0].revision, 1);
    assert.equal(states[0].snapshot.zones.top[0].label, "Test Extension");

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
    const triggerEvent = { type: "click" };
    assert.equal(
      await adapter.invoke(
        "toolbar-widget-registry-1-handle-1",
        host,
        triggerEvent,
      ),
      true,
    );
    assert.deepEqual(fake.calls.at(-1), [
      "invoke",
      "toolbar-widget-registry-1-handle-1",
      host,
      triggerEvent,
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

test("adapter edit validates operations and bridge results", async () => {
  const fake = createFakeBridge();
  const adapter = createBrowserToolbarWidgetsStateAdapter(fake.bridge);
  try {
    assert.equal(
      await adapter.edit({
        index: 0,
        revision: 0,
        token: "palette-1",
        type: "add",
        zone: "top",
      }),
      true,
    );
    const [name, operation] = fake.calls.at(-1);
    assert.equal(name, "edit");
    assert.equal(operation.type, "add");
    assert.equal(operation.token, "palette-1");
    assert.ok(Object.isFrozen(operation));

    await assert.rejects(
      adapter.edit({ type: "sparkle" }),
      /FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID/u,
    );
    await assert.rejects(
      adapter.edit({ style: { accent: "red" }, type: "set-style" }),
      /FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID/u,
    );
  } finally {
    adapter.dispose();
  }
  await assert.rejects(
    adapter.edit({ type: "reset-style" }),
    /FENNEVIA_TOOLBAR_WIDGETS_STATE_DISPOSED/u,
  );

  const badResult = createFakeBridge({
    async edit() {
      return "done";
    },
  });
  const badAdapter = createBrowserToolbarWidgetsStateAdapter(badResult.bridge);
  try {
    await assert.rejects(
      badAdapter.edit({ type: "reset-style" }),
      /FENNEVIA_TOOLBAR_WIDGETS_STATE_RESULT_INVALID/u,
    );
  } finally {
    badAdapter.dispose();
  }
});
