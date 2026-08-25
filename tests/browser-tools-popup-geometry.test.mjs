import assert from "node:assert/strict";
import test from "node:test";

import { resolveBestAdjacentPopupPoint } from "../src/firefox/browser-tools/popup-geometry.ts";

const viewportSize = Object.freeze({ height: 700, width: 1_000 });
const popupSize = Object.freeze({ height: 600, width: 490 });

test("popup geometry expands toward the Firefox window interior", () => {
  assert.deepEqual(
    resolveBestAdjacentPopupPoint({
      direction: "down",
      hostRect: { height: 32, width: 32, x: 120, y: 20 },
      popupSize,
      viewportSize,
    }),
    { x: 120, y: 52 },
  );
  assert.deepEqual(
    resolveBestAdjacentPopupPoint({
      direction: "right",
      hostRect: { height: 32, width: 32, x: 10, y: 20 },
      popupSize,
      viewportSize,
    }),
    { x: 42, y: 20 },
  );
  assert.deepEqual(
    resolveBestAdjacentPopupPoint({
      direction: "left",
      hostRect: { height: 32, width: 32, x: 958, y: 20 },
      popupSize,
      viewportSize,
    }),
    { x: 468, y: 20 },
  );
  assert.deepEqual(
    resolveBestAdjacentPopupPoint({
      direction: "up",
      hostRect: { height: 32, width: 32, x: 500, y: 650 },
      popupSize,
      viewportSize,
    }),
    { x: 42, y: 50 },
  );
});

test("popup geometry flips when only the opposite opening side fits", () => {
  assert.deepEqual(
    resolveBestAdjacentPopupPoint({
      direction: "down",
      hostRect: { height: 32, width: 32, x: 120, y: 600 },
      popupSize: { height: 200, width: 490 },
      viewportSize,
    }),
    { x: 120, y: 400 },
  );
  assert.deepEqual(
    resolveBestAdjacentPopupPoint({
      direction: "right",
      hostRect: { height: 32, width: 32, x: 850, y: 120 },
      popupSize: { height: 300, width: 200 },
      viewportSize,
    }),
    { x: 650, y: 120 },
  );
});

test("popup geometry keeps the popup adjacent when neither opening side fits", () => {
  assert.deepEqual(
    resolveBestAdjacentPopupPoint({
      hostRect: { height: 32, width: 32, x: 450, y: 300 },
      popupSize: { height: 300, width: 900 },
      viewportSize,
    }),
    { x: 16, y: 332 },
  );
  assert.deepEqual(
    resolveBestAdjacentPopupPoint({
      direction: "down",
      hostRect: { height: 32, width: 32, x: 120, y: 20 },
      popupSize: { height: 900, width: 490 },
      viewportSize,
    }),
    { x: 120, y: 52 },
  );
  assert.deepEqual(
    resolveBestAdjacentPopupPoint({
      direction: "down",
      hostRect: { height: 32, width: 32, x: 500, y: 350 },
      popupSize: { height: 400, width: 490 },
      viewportSize,
    }),
    { x: 42, y: -50 },
  );
  assert.deepEqual(
    resolveBestAdjacentPopupPoint({
      direction: "right",
      hostRect: { height: 32, width: 32, x: 500, y: 120 },
      popupSize: { height: 300, width: 600 },
      viewportSize,
    }),
    { x: -100, y: 120 },
  );
});

test("popup geometry rejects malformed measurements", () => {
  assert.equal(
    resolveBestAdjacentPopupPoint({
      hostRect: { height: 32, width: 32, x: Number.NaN, y: 20 },
      popupSize,
      viewportSize,
    }),
    null,
  );
  assert.equal(
    resolveBestAdjacentPopupPoint({
      hostRect: { height: 32, width: 32, x: 120, y: 20 },
      popupSize: { height: 0, width: 490 },
      viewportSize,
    }),
    null,
  );
  assert.equal(
    resolveBestAdjacentPopupPoint({
      direction: "sideways",
      hostRect: { height: 32, width: 32, x: 120, y: 20 },
      popupSize,
      viewportSize,
    }),
    null,
  );
});
