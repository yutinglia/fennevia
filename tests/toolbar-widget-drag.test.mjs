import assert from "node:assert/strict";
import test from "node:test";

import {
  clearToolbarWidgetDrag,
  copyToolbarWidgetDragSource,
  createToolbarWidgetDropEdit,
  getActiveToolbarWidgetDrag,
  parseToolbarWidgetDrag,
  resolveSameZoneMoveIndex,
  resolveWidgetInsertBefore,
  serializeToolbarWidgetDrag,
  startToolbarWidgetDrag,
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
