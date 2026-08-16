import assert from "node:assert/strict";
import test from "node:test";

import {
  createFirefoxBridgeBoundary,
  isFirefoxBridgeError,
} from "../src/firefox/bridge-boundary.ts";
import { createFirefoxWindowControlsBridge } from "../src/firefox/window-controls.ts";

const BROWSER_URI = "chrome://browser/content/browser.xhtml";
let nextContextSequence = 0;

function createNativeWindow() {
  const calls = [];
  const listeners = new Map();
  const closeCommand = {
    doCommand() {
      calls.push("close");
    },
  };
  const window = {
    STATE_FULLSCREEN: 4,
    STATE_MAXIMIZED: 3,
    STATE_NORMAL: 1,
    addEventListener(type, listener) {
      const bucket = listeners.get(type) ?? new Set();
      bucket.add(listener);
      listeners.set(type, bucket);
    },
    document: {
      documentURI: BROWSER_URI,
      getElementById(id) {
        return id === "cmd_closeWindow" ? closeCommand : null;
      },
    },
    maximize() {
      calls.push("maximize");
      window.windowState = window.STATE_MAXIMIZED;
      for (const listener of listeners.get("sizemodechange") ?? []) {
        listener();
      }
    },
    minimize() {
      calls.push("minimize");
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    restore() {
      calls.push("restore");
      window.windowState = window.STATE_NORMAL;
      for (const listener of listeners.get("sizemodechange") ?? []) {
        listener();
      }
    },
    windowState: 1,
  };
  window.document.defaultView = window;
  return { calls, window };
}

function createController(window) {
  const errors = [];
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260810162159",
    contextId: `window-window-controls-${++nextContextSequence}`,
    firefoxVersion: "153.0.4",
    window,
    windowKind: "normal",
  });
  return {
    controller: createFirefoxWindowControlsBridge({
      boundary,
      onError(error) {
        errors.push(error);
      },
      window,
    }),
    errors,
  };
}

test("window controls invoke Firefox window commands without native caption clicks", () => {
  const native = createNativeWindow();
  const { controller, errors } = createController(native.window);
  const capabilities = controller.assertRequiredCapabilities();
  assert.equal(
    capabilities.every((capability) => capability.available),
    true,
  );
  assert.equal(controller.windowControls.snapshot().maximized, false);

  const seen = [];
  const unsubscribe = controller.windowControls.subscribe((snapshot) => {
    seen.push(snapshot.maximized);
  });
  assert.equal(controller.windowControls.invoke("minimize"), true);
  assert.equal(controller.windowControls.invoke("toggle-maximize"), true);
  assert.deepEqual(seen, [true]);
  assert.equal(controller.windowControls.snapshot().maximized, true);
  assert.equal(controller.windowControls.invoke("toggle-maximize"), true);
  assert.equal(controller.windowControls.invoke("close"), true);
  assert.equal(unsubscribe(), true);
  assert.equal(controller.dispose(), true);
  assert.deepEqual(native.calls, ["minimize", "maximize", "restore", "close"]);
  assert.deepEqual(errors, []);
});

test("missing close command fails the required capability", () => {
  const native = createNativeWindow();
  native.window.document.getElementById = () => null;
  const { controller } = createController(native.window);
  assert.throws(
    () => controller.assertRequiredCapabilities(),
    (error) =>
      isFirefoxBridgeError(error) &&
      error.fenneviaCode ===
        "FENNEVIA_FIREFOX_WINDOW_CONTROLS_CAPABILITY_MISSING",
  );
  assert.equal(controller.dispose(), true);
});
