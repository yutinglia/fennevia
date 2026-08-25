import assert from "node:assert/strict";
import test from "node:test";

import { resolveWidgetInspectorPosition } from "../src/shell/features/composable-layout/widget-inspector-position.ts";

const viewport = Object.freeze({ bottom: 800, left: 0, right: 1200, top: 0 });
const container = Object.freeze({
  bottom: 100,
  left: 10,
  right: 1190,
  top: 10,
});
const anchor = Object.freeze({ bottom: 70, left: 400, right: 600, top: 30 });
const inspector = Object.freeze({ height: 120, width: 260 });

test("widget inspector prefers the content-facing side of each edge", () => {
  assert.deepEqual(
    resolveWidgetInspectorPosition(
      "top",
      anchor,
      container,
      viewport,
      inspector,
    ),
    { left: 360, placement: "below", top: 68 },
  );
  assert.deepEqual(
    resolveWidgetInspectorPosition(
      "bottom",
      { bottom: 770, left: 400, right: 600, top: 730 },
      { bottom: 790, left: 10, right: 1190, top: 700 },
      viewport,
      inspector,
    ),
    { left: 360, placement: "above", top: -98 },
  );
  assert.deepEqual(
    resolveWidgetInspectorPosition(
      "left",
      { bottom: 400, left: 10, right: 250, top: 300 },
      { bottom: 790, left: 10, right: 250, top: 10 },
      viewport,
      inspector,
    ),
    { left: 248, placement: "right", top: 280 },
  );
  assert.deepEqual(
    resolveWidgetInspectorPosition(
      "right",
      { bottom: 400, left: 950, right: 1190, top: 300 },
      { bottom: 790, left: 950, right: 1190, top: 10 },
      viewport,
      inspector,
    ),
    { left: -268, placement: "left", top: 280 },
  );
});

test("widget inspector flips when the preferred side cannot fit", () => {
  assert.deepEqual(
    resolveWidgetInspectorPosition(
      "top",
      { bottom: 760, left: 400, right: 600, top: 720 },
      container,
      viewport,
      inspector,
    ),
    { left: 360, placement: "above", top: 582 },
  );
  assert.deepEqual(
    resolveWidgetInspectorPosition(
      "left",
      { bottom: 400, left: 900, right: 1160, top: 300 },
      container,
      viewport,
      inspector,
    ),
    { left: 622, placement: "left", top: 280 },
  );
});

test("widget inspector avoids the central customize panel when another side fits", () => {
  assert.deepEqual(
    resolveWidgetInspectorPosition(
      "left",
      { bottom: 360, left: 20, right: 260, top: 280 },
      { bottom: 800, left: 0, right: 1200, top: 0 },
      viewport,
      inspector,
      8,
      8,
      [{ bottom: 700, left: 300, right: 900, top: 120 }],
    ),
    { left: 10, placement: "below", top: 368 },
  );
});

test("widget inspector avoids covering its anchor after viewport clamping", () => {
  assert.deepEqual(
    resolveWidgetInspectorPosition(
      "left",
      { bottom: 400, left: 10, right: 250, top: 300 },
      { bottom: 800, left: 0, right: 300, top: 0 },
      { bottom: 800, left: 0, right: 300, top: 0 },
      inspector,
    ),
    { left: 8, placement: "below", top: 408 },
  );
});

test("widget inspector clamps to small viewports and rejects invalid geometry", () => {
  assert.deepEqual(
    resolveWidgetInspectorPosition(
      "top",
      { bottom: 60, left: 0, right: 40, top: 20 },
      { bottom: 200, left: 0, right: 200, top: 0 },
      { bottom: 200, left: 0, right: 200, top: 0 },
      { height: 80, width: 260 },
    ),
    { left: 8, placement: "below", top: 68 },
  );
  assert.equal(
    resolveWidgetInspectorPosition("top", anchor, container, viewport, {
      height: 0,
      width: 20,
    }),
    null,
  );
  assert.equal(
    resolveWidgetInspectorPosition(
      "top",
      { ...anchor, left: Number.NaN },
      container,
      viewport,
      inspector,
    ),
    null,
  );
  assert.equal(
    resolveWidgetInspectorPosition(
      "top",
      anchor,
      container,
      viewport,
      inspector,
      8,
      8,
      [{ ...anchor, right: Number.POSITIVE_INFINITY }],
    ),
    null,
  );
});
