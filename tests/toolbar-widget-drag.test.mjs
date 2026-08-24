import assert from "node:assert/strict";
import test from "node:test";

import {
  clearToolbarWidgetDrag,
  copyToolbarWidgetDragSource,
  createToolbarWidgetDropEdit,
  getActiveToolbarWidgetDrag,
  parseToolbarWidgetDrag,
  resolveToolbarWidgetDragAutoScrollDelta,
  resolveToolbarWidgetDragImageOffset,
  resolveToolbarWidgetDragPreviewSize,
  resolveSameZoneMoveIndex,
  resolveWidgetInsertBefore,
  serializeToolbarWidgetDrag,
  startToolbarWidgetDrag,
  subscribeToolbarWidgetDrag,
  toolbarWidgetDragMimeType,
} from "../src/app/toolbar-widget-drag.ts";

test("drag payload is opaque zone or palette state without widget ids", () => {
  const palette = startToolbarWidgetDrag({
    token: "palette-3",
    type: "palette",
  });
  assert.deepEqual(getActiveToolbarWidgetDrag(), palette);
  assert.equal(
    serializeToolbarWidgetDrag(palette),
    JSON.stringify({ token: "palette-3", type: "palette" }),
  );
  assert.deepEqual(
    parseToolbarWidgetDrag(serializeToolbarWidgetDrag(palette)),
    palette,
  );

  const zone = copyToolbarWidgetDragSource({
    index: 2,
    type: "zone",
    zone: "left",
  });
  assert.equal(
    toolbarWidgetDragMimeType,
    "application/x-fennevia-toolbar-widget",
  );
  assert.deepEqual(zone, { index: 2, type: "zone", zone: "left" });
  assert.equal(parseToolbarWidgetDrag(""), null);
  assert.equal(parseToolbarWidgetDrag("{"), null);
  assert.equal(
    parseToolbarWidgetDrag(
      JSON.stringify({ id: "home-button", type: "widget" }),
    ),
    null,
  );
  assert.throws(
    () =>
      copyToolbarWidgetDragSource({ token: "Home-Button", type: "palette" }),
    /FENNEVIA_TOOLBAR_WIDGET_DRAG_SOURCE_INVALID/u,
  );
  clearToolbarWidgetDrag();
  assert.equal(getActiveToolbarWidgetDrag(), null);
});

test("drag lifecycle notifies every target so stale hover feedback can clear", () => {
  clearToolbarWidgetDrag();
  const transitions = [];
  const unsubscribe = subscribeToolbarWidgetDrag((source) => {
    transitions.push(source?.type ?? null);
  });

  startToolbarWidgetDrag({ token: "palette-2", type: "palette" });
  clearToolbarWidgetDrag();
  unsubscribe();
  startToolbarWidgetDrag({ token: "palette-3", type: "palette" });
  clearToolbarWidgetDrag();

  assert.deepEqual(transitions, [null, "palette", null]);
});

test("insert-before uses item midpoints on both axes", () => {
  assert.equal(resolveWidgetInsertBefore([10, 30, 50], 9), 0);
  assert.equal(resolveWidgetInsertBefore([10, 30, 50], 10), 1);
  assert.equal(resolveWidgetInsertBefore([10, 30, 50], 49), 2);
  assert.equal(resolveWidgetInsertBefore([10, 30, 50], 50), 3);
  assert.equal(resolveWidgetInsertBefore([], 0), 0);
  assert.equal(resolveWidgetInsertBefore([10], Number.NaN), null);
  assert.equal(resolveWidgetInsertBefore([Number.NaN], 0), null);
});

test("same-zone moves correct insertBefore and ignore no-ops", () => {
  assert.equal(resolveSameZoneMoveIndex(1, 3), 2);
  assert.equal(resolveSameZoneMoveIndex(1, 4), 3);
  assert.equal(resolveSameZoneMoveIndex(3, 1), 1);
  assert.equal(resolveSameZoneMoveIndex(1, 1), null);
  assert.equal(resolveSameZoneMoveIndex(1, 2), null);
  assert.equal(resolveSameZoneMoveIndex(-1, 1), null);
});

test("drag previews stay bounded and axis-aware", () => {
  assert.deepEqual(resolveToolbarWidgetDragPreviewSize("control", "row"), {
    blockSize: 44,
    inlineSize: 168,
  });
  assert.deepEqual(resolveToolbarWidgetDragPreviewSize("layout", "column"), {
    blockSize: 52,
    inlineSize: 220,
  });
  assert.deepEqual(resolveToolbarWidgetDragPreviewSize("space", "row"), {
    blockSize: 32,
    inlineSize: 32,
  });
});

test("drag image offsets preserve a clamped pointer-relative anchor", () => {
  const bounds = { height: 100, left: 10, top: 20, width: 200 };
  const preview = { blockSize: 50, inlineSize: 100 };
  assert.deepEqual(
    resolveToolbarWidgetDragImageOffset(110, 70, bounds, preview),
    { x: 50, y: 25 },
  );
  assert.deepEqual(
    resolveToolbarWidgetDragImageOffset(-100, 500, bounds, preview),
    { x: 0, y: 50 },
  );
  assert.equal(
    resolveToolbarWidgetDragImageOffset(Number.NaN, 0, bounds, preview),
    null,
  );
  assert.equal(
    resolveToolbarWidgetDragImageOffset(0, 0, { ...bounds, width: 0 }, preview),
    null,
  );
});

test("drag autoscroll accelerates only inside bounded edge bands", () => {
  assert.equal(resolveToolbarWidgetDragAutoScrollDelta(100, 100, 500), -18);
  assert.equal(resolveToolbarWidgetDragAutoScrollDelta(124, 100, 500), -9);
  assert.equal(resolveToolbarWidgetDragAutoScrollDelta(300, 100, 500), 0);
  assert.equal(resolveToolbarWidgetDragAutoScrollDelta(476, 100, 500), 9);
  assert.equal(resolveToolbarWidgetDragAutoScrollDelta(500, 100, 500), 18);
  assert.equal(resolveToolbarWidgetDragAutoScrollDelta(0, 10, 10), 0);
  assert.equal(resolveToolbarWidgetDragAutoScrollDelta(Number.NaN, 0, 100), 0);
});

test("drop mapping produces add, move, and remove edits", () => {
  const revision = 4;
  assert.deepEqual(
    createToolbarWidgetDropEdit(
      { token: "palette-1", type: "palette" },
      { insertBefore: 2, type: "zone", zone: "top" },
      revision,
    ),
    {
      index: 2,
      revision,
      token: "palette-1",
      type: "add",
      zone: "top",
    },
  );
  assert.deepEqual(
    createToolbarWidgetDropEdit(
      { index: 0, type: "zone", zone: "top" },
      { insertBefore: 3, type: "zone", zone: "top" },
      revision,
    ),
    {
      fromIndex: 0,
      fromZone: "top",
      revision,
      toIndex: 2,
      toZone: "top",
      type: "move",
    },
  );
  assert.deepEqual(
    createToolbarWidgetDropEdit(
      { index: 1, type: "zone", zone: "left" },
      { insertBefore: 0, type: "zone", zone: "right" },
      revision,
    ),
    {
      fromIndex: 1,
      fromZone: "left",
      revision,
      toIndex: 0,
      toZone: "right",
      type: "move",
    },
  );
  assert.deepEqual(
    createToolbarWidgetDropEdit(
      { index: 2, type: "zone", zone: "bottom" },
      { type: "palette" },
      revision,
    ),
    {
      index: 2,
      revision,
      type: "remove",
      zone: "bottom",
    },
  );
  assert.equal(
    createToolbarWidgetDropEdit(
      { token: "palette-1", type: "palette" },
      { type: "palette" },
      revision,
    ),
    null,
  );
  assert.equal(
    createToolbarWidgetDropEdit(
      { index: 1, type: "zone", zone: "top" },
      { insertBefore: 2, type: "zone", zone: "top" },
      revision,
    ),
    null,
  );
  assert.equal(
    createToolbarWidgetDropEdit(
      { token: "palette-1", type: "palette" },
      { insertBefore: 0, type: "zone", zone: "top" },
      -1,
    ),
    null,
  );
});

test("recursive layout drags use opaque instance ids and nested paths", () => {
  const layout = Object.freeze({
    bottom: Object.freeze([]),
    left: Object.freeze([]),
    right: Object.freeze([]),
    top: Object.freeze([
      Object.freeze({
        children: Object.freeze([
          Object.freeze({
            instanceId: "layout-2",
            projectId: "back",
            type: "item",
            widget: Object.freeze({}),
          }),
        ]),
        direction: "row",
        instanceId: "layout-1",
        type: "container",
      }),
    ]),
  });
  const source = copyToolbarWidgetDragSource({
    instanceId: "layout-2",
    type: "layout-node",
  });
  assert.equal(
    serializeToolbarWidgetDrag(source),
    JSON.stringify({ instanceId: "layout-2", type: "layout-node" }),
  );
  assert.doesNotMatch(serializeToolbarWidgetDrag(source), /back-button/u);

  assert.deepEqual(
    createToolbarWidgetDropEdit(
      source,
      {
        insertBefore: 0,
        parentPath: [],
        type: "layout",
        zone: "left",
      },
      7,
      layout,
    ),
    {
      from: { path: [0, 0], zone: "top" },
      revision: 7,
      to: { index: 0, parentPath: [], zone: "left" },
      type: "move-node",
    },
  );
  assert.deepEqual(
    createToolbarWidgetDropEdit(
      { token: "palette-3", type: "palette" },
      {
        insertBefore: 1,
        parentPath: [0],
        type: "layout",
        zone: "top",
      },
      7,
      layout,
    ),
    {
      index: 1,
      parentPath: [0],
      revision: 7,
      token: "palette-3",
      type: "add-node",
      zone: "top",
    },
  );
  assert.deepEqual(
    createToolbarWidgetDropEdit(source, { type: "palette" }, 7, layout),
    {
      location: { path: [0, 0], zone: "top" },
      revision: 7,
      type: "remove-node",
    },
  );
  assert.equal(
    createToolbarWidgetDropEdit(
      { instanceId: "layout-99", type: "layout-node" },
      { type: "palette" },
      7,
      layout,
    ),
    null,
  );
});
