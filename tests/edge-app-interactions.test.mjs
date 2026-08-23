import assert from "node:assert/strict";
import test from "node:test";

import {
  captureWindowDragPosition,
  createWindowDragCandidateController,
  hasWindowDragMoved,
  minimumWindowDragDistanceCssPixels,
} from "../src/shell/runtime/window-drag.ts";

const viewAt = (screenX, screenY) => ({ screenX, screenY });
const pointerAt = (screenX, screenY) => ({ screenX, screenY });

test("window drag movement keeps click-only presses below the threshold", () => {
  const start = captureWindowDragPosition(pointerAt(100, 120), viewAt(20, 30));
  const stationary = captureWindowDragPosition(
    pointerAt(100, 120),
    viewAt(20, 30),
  );
  const jitter = captureWindowDragPosition(
    pointerAt(100 + minimumWindowDragDistanceCssPixels - 1, 120),
    viewAt(20, 30),
  );

  assert.equal(hasWindowDragMoved(start, stationary), false);
  assert.equal(hasWindowDragMoved(start, jitter), false);
});

test("window drag movement accepts pointer threshold or actual window movement", () => {
  const start = captureWindowDragPosition(pointerAt(100, 120), viewAt(20, 30));
  const pointerMoved = captureWindowDragPosition(
    pointerAt(100 + minimumWindowDragDistanceCssPixels, 120),
    viewAt(20, 30),
  );
  const windowMoved = captureWindowDragPosition(
    pointerAt(100, 120),
    viewAt(21, 30),
  );

  assert.equal(hasWindowDragMoved(start, pointerMoved), true);
  assert.equal(hasWindowDragMoved(start, windowMoved), true);
});

test("window drag movement treats missing pointer coordinates as a stationary click", () => {
  const start = captureWindowDragPosition(undefined, viewAt(20, 30));
  const end = captureWindowDragPosition(undefined, viewAt(20, 30));

  assert.equal(hasWindowDragMoved(start, end), false);
});

test("window drag candidates distinguish click, movement, cancellation, and disposal", () => {
  const outcomes = [];
  const view = viewAt(20, 30);
  const controller = createWindowDragCandidateController({
    canStart: (event) => event.button === 0,
    getView: () => view,
    onEnd: (clickOnly) => outcomes.push(clickOnly ? "click" : "drag"),
    onStart: () => outcomes.push("start"),
  });

  controller.begin({ ...pointerAt(100, 120), button: 1 });
  controller.release(pointerAt(100, 120));
  assert.deepEqual(outcomes, []);

  controller.begin({ ...pointerAt(100, 120), button: 0 });
  controller.release(pointerAt(100, 120));
  assert.deepEqual(outcomes, ["start", "click"]);

  controller.begin({ ...pointerAt(100, 120), button: 0 });
  controller.release(pointerAt(100 + minimumWindowDragDistanceCssPixels, 120));
  assert.deepEqual(outcomes, ["start", "click", "start", "drag"]);

  controller.begin({ ...pointerAt(100, 120), button: 0 });
  controller.release(pointerAt(100, 120), true);
  controller.begin({ ...pointerAt(100, 120), button: 0 });
  controller.dispose();
  assert.deepEqual(outcomes, [
    "start",
    "click",
    "start",
    "drag",
    "start",
    "drag",
    "start",
    "drag",
  ]);
});
