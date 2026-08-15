import assert from "node:assert/strict";
import test from "node:test";

import {
  createInitialSmokeState,
  maximumSmokeInputLength,
  reduceSmokeState,
} from "../src/app/smoke-state.ts";

test("smoke state handles counter, input, conditional, and event updates immutably", () => {
  const initial = createInitialSmokeState();
  const incremented = reduceSmokeState(initial, { type: "increment" });
  const populated = reduceSmokeState(incremented, {
    type: "input",
    value: "Fennevia",
  });
  const hidden = reduceSmokeState(populated, { type: "toggle-details" });

  assert.deepEqual(initial, {
    count: 0,
    detailsVisible: true,
    eventCount: 0,
    input: "",
  });
  assert.deepEqual(incremented, {
    count: 1,
    detailsVisible: true,
    eventCount: 1,
    input: "",
  });
  assert.deepEqual(populated, {
    count: 1,
    detailsVisible: true,
    eventCount: 2,
    input: "Fennevia",
  });
  assert.equal(hidden.detailsVisible, false);
  assert.equal(hidden.eventCount, 3);
  assert.ok(Object.isFrozen(initial));
  assert.ok(Object.isFrozen(hidden));
});

test("smoke input remains local and bounded", () => {
  const value = "x".repeat(maximumSmokeInputLength + 25);
  const state = reduceSmokeState(createInitialSmokeState(), {
    type: "input",
    value,
  });

  assert.equal(state.input.length, maximumSmokeInputLength);
  assert.equal(state.input, "x".repeat(maximumSmokeInputLength));
});
