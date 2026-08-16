import assert from "node:assert/strict";
import test from "node:test";

import {
  copyWindowControlsSnapshot,
  createBrowserWindowControlsStateAdapter,
  isWindowControlAction,
  windowControlActions,
} from "../src/app/window-controls-state.ts";

test("window controls state accepts only the fixed caption-action contract", () => {
  assert.deepEqual(windowControlActions, [
    "close",
    "minimize",
    "toggle-maximize",
  ]);
  assert.ok(windowControlActions.every(isWindowControlAction));
  assert.equal(isWindowControlAction("titlebar-close"), false);

  const snapshot = copyWindowControlsSnapshot({ maximized: false });
  assert.deepEqual(snapshot, { maximized: false });
  assert.ok(Object.isFrozen(snapshot));
});

test("window controls adapter forwards actions and live maximize state", () => {
  const calls = [];
  let maximized = false;
  const listeners = new Set();
  const adapter = createBrowserWindowControlsStateAdapter({
    invoke(action) {
      calls.push(action);
      if (action === "toggle-maximize") {
        maximized = !maximized;
        for (const listener of listeners) {
          listener({ maximized });
        }
      }
      return true;
    },
    snapshot() {
      return { maximized };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });

  assert.equal(adapter.snapshot().maximized, false);
  const seen = [];
  const unsubscribe = adapter.subscribe((snapshot) => {
    seen.push(snapshot.maximized);
  });
  assert.equal(adapter.invoke("minimize"), true);
  assert.equal(adapter.invoke("toggle-maximize"), true);
  assert.deepEqual(seen, [true]);
  assert.equal(adapter.snapshot().maximized, true);
  assert.equal(unsubscribe(), true);
  assert.equal(adapter.dispose(), true);
  assert.equal(adapter.dispose(), false);
  assert.deepEqual(calls, ["minimize", "toggle-maximize"]);
});
