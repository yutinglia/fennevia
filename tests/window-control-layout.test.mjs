// SPDX-License-Identifier: MPL-2.0
import assert from "node:assert/strict";
import test from "node:test";
import { collectAdjacentWindowControls } from "../src/shell/features/composable-layout/window-control-layout.ts";

const item = (instanceId, projectId) => ({
  type: "item",
  instanceId,
  projectId,
});

test("window controls keep separate runs, saved order and repeated instances", () => {
  const close = item("layout-1", "close-window");
  const minimize = item("layout-2", "minimize-window");
  const spacer = { type: "item", instanceId: "layout-3", widget: {} };
  const repeated = item("layout-4", "close-window");
  const nodes = [close, minimize, spacer, repeated];
  const before = globalThis.structuredClone(nodes);

  assert.deepEqual(collectAdjacentWindowControls(nodes, 0), [close, minimize]);
  assert.deepEqual(collectAdjacentWindowControls(nodes, 1), []);
  assert.deepEqual(collectAdjacentWindowControls(nodes, 2), []);
  assert.deepEqual(collectAdjacentWindowControls(nodes, 3), [repeated]);
  assert.deepEqual(nodes, before);
});

test("window controls never cross a configured parent boundary", () => {
  const minimize = item("layout-1", "minimize-window");
  const close = item("layout-3", "close-window");
  const container = {
    type: "container",
    instanceId: "layout-2",
    direction: "row",
    children: [close],
  };
  assert.deepEqual(collectAdjacentWindowControls([minimize, container], 0), [
    minimize,
  ]);
  assert.deepEqual(collectAdjacentWindowControls([container], 0), []);
  assert.deepEqual(collectAdjacentWindowControls(container.children, 0), [
    close,
  ]);
  assert.deepEqual(collectAdjacentWindowControls([], 0), []);
});
