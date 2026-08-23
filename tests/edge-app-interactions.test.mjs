import assert from "node:assert/strict";
import test from "node:test";

import {
  isPointInsideElement,
  isPointInsideVisibleEdgePanel,
  isPointInsideWindowViewport,
} from "../src/shell/runtime/pointer-geometry.ts";
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

const boxAt = (left, top, right, bottom) => ({
  getBoundingClientRect: () => ({ left, top, right, bottom }),
});

test("point-inside checks use the element border box and ignore invalid input", () => {
  const box = boxAt(10, 20, 110, 220);

  assert.equal(isPointInsideElement(box, 10, 20), true);
  assert.equal(isPointInsideElement(box, 110, 220), true);
  assert.equal(isPointInsideElement(box, 60, 120), true);
  assert.equal(isPointInsideElement(box, 9, 120), false);
  assert.equal(isPointInsideElement(box, 60, 221), false);
  assert.equal(isPointInsideElement(null, 60, 120), false);
  assert.equal(isPointInsideElement(box, Number.NaN, 120), false);
});

test("visible edge-panel point checks require a visible ancestor", () => {
  const hiddenPanel = {
    ...boxAt(0, 0, 80, 400),
    closest: () => null,
  };
  const visiblePanel = {
    ...boxAt(0, 0, 80, 400),
    closest: (selector) =>
      selector === "[data-fennevia-visible='true']" ? {} : null,
  };
  const root = {
    querySelectorAll: (selector) =>
      selector === "[data-fennevia-edge-panel]"
        ? [hiddenPanel, visiblePanel]
        : [],
  };

  assert.equal(isPointInsideVisibleEdgePanel(root, 40, 40), true);
  assert.equal(isPointInsideVisibleEdgePanel(root, 200, 40), false);
  assert.equal(
    isPointInsideVisibleEdgePanel(
      {
        querySelectorAll: () => [hiddenPanel],
      },
      40,
      40,
    ),
    false,
  );
  assert.equal(isPointInsideVisibleEdgePanel(null, 40, 40), false);
});

test("window viewport checks reject coordinates outside the inner box", () => {
  const view = { innerHeight: 800, innerWidth: 1200 };

  assert.equal(isPointInsideWindowViewport(view, 0, 0), true);
  assert.equal(isPointInsideWindowViewport(view, 1200, 800), true);
  assert.equal(isPointInsideWindowViewport(view, 40, 40), true);
  assert.equal(isPointInsideWindowViewport(view, -2, 40), false);
  assert.equal(isPointInsideWindowViewport(view, 40, -1), false);
  assert.equal(isPointInsideWindowViewport(view, 1201, 40), false);
  assert.equal(isPointInsideWindowViewport(null, 40, 40), false);
  assert.equal(isPointInsideWindowViewport(view, Number.NaN, 40), false);
});
