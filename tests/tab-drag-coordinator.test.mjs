import assert from "node:assert/strict";
import test from "node:test";

import { createFirefoxTabDragCoordinator } from "../src/firefox/tabs.ts";

const createTab = () => ({
  getAttribute() {
    return "";
  },
  hasAttribute() {
    return false;
  },
});

function createCoordinator(tokens = ["tab-transfer-00000001"]) {
  let index = 0;
  return createFirefoxTabDragCoordinator({
    createToken() {
      return (
        tokens[index++] ?? `tab-transfer-${String(index).padStart(8, "0")}`
      );
    },
  });
}

test("the coordinator exposes only ordinary drag metadata across same-kind windows", () => {
  const coordinator = createCoordinator();
  const tab = createTab();
  const dragId = coordinator.begin({
    isActive: () => true,
    pinned: true,
    sourceContextId: "window-source",
    sourceWindowKind: "normal",
    tab,
  });

  assert.equal(dragId, "tab-transfer-00000001");
  assert.deepEqual(
    coordinator.inspect({ contextId: "window-source", windowKind: "normal" }),
    {
      id: dragId,
      pinned: true,
      source: "same-window",
    },
  );
  assert.deepEqual(
    coordinator.inspect({ contextId: "window-target", windowKind: "normal" }),
    {
      id: dragId,
      pinned: true,
      source: "other-window",
    },
  );
  assert.equal(
    coordinator.inspect({ contextId: "window-private", windowKind: "private" }),
    null,
  );
  assert.strictEqual(
    coordinator.resolve({ contextId: "window-target", windowKind: "normal" })
      .tab,
    tab,
  );
  assert.doesNotMatch(JSON.stringify(coordinator.snapshot()), /getAttribute/u);
});

test("consume and cancel make drag completion idempotent", () => {
  const coordinator = createCoordinator([
    "tab-transfer-00000001",
    "tab-transfer-00000002",
  ]);
  const firstId = coordinator.begin({
    isActive: () => true,
    pinned: false,
    sourceContextId: "window-source",
    sourceWindowKind: "normal",
    tab: createTab(),
  });
  assert.throws(
    () =>
      coordinator.begin({
        isActive: () => true,
        pinned: false,
        sourceContextId: "window-other",
        sourceWindowKind: "normal",
        tab: createTab(),
      }),
    /FENNEVIA_TAB_DRAG_ALREADY_ACTIVE/u,
  );
  assert.equal(coordinator.consume(firstId), true);
  assert.equal(coordinator.consume(firstId), false);
  assert.deepEqual(coordinator.resolveForEnd(firstId, "window-source"), {
    status: "consumed",
  });

  const secondId = coordinator.begin({
    isActive: () => true,
    pinned: false,
    sourceContextId: "window-source",
    sourceWindowKind: "normal",
    tab: createTab(),
  });
  assert.equal(coordinator.cancel(secondId, "window-other"), false);
  assert.equal(coordinator.cancelContext("window-source"), true);
  assert.deepEqual(coordinator.resolveForEnd(secondId, "window-source"), {
    status: "cancelled",
  });
});

test("stale native tabs are cleared and token factories are validated", () => {
  let active = true;
  const coordinator = createCoordinator();
  const dragId = coordinator.begin({
    isActive: () => active,
    pinned: false,
    sourceContextId: "window-source",
    sourceWindowKind: "normal",
    tab: createTab(),
  });
  active = false;
  assert.equal(
    coordinator.inspect({ contextId: "window-source", windowKind: "normal" }),
    null,
  );
  assert.deepEqual(coordinator.resolveForEnd(dragId, "window-source"), {
    status: "cancelled",
  });

  const invalid = createCoordinator(["not-a-transfer-token"]);
  assert.throws(
    () =>
      invalid.begin({
        isActive: () => true,
        pinned: false,
        sourceContextId: "window-source",
        sourceWindowKind: "normal",
        tab: createTab(),
      }),
    /FENNEVIA_TAB_DRAG_TOKEN_INVALID/u,
  );
});
