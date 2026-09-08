// SPDX-License-Identifier: MPL-2.0
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

import {
  createEdgeShellController,
  edgeNames,
} from "../src/app/edge-surfaces.ts";

// Shell sources use bundler-style extensionless imports. Resolve only those
// local imports while loading the real coordinator; do not rewrite its logic.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier.startsWith(".") &&
      !/\.[a-z]+$/u.test(specifier) &&
      context.parentURL?.includes("/src/")
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});
let createSurfaceFocusCoordinator;
try {
  ({ createSurfaceFocusCoordinator } =
    await import("../src/shell/runtime/surface-focus.ts"));
} finally {
  hooks.deregister();
}

function createHarness(t, mode = "multiple-dynamic", useChromeActive = true) {
  class TestElement {}
  const previousElement = Object.getOwnPropertyDescriptor(
    globalThis,
    "Element",
  );
  Object.defineProperty(globalThis, "Element", {
    configurable: true,
    value: TestElement,
  });
  t.after(() => {
    if (previousElement) {
      Object.defineProperty(globalThis, "Element", previousElement);
    } else {
      delete globalThis.Element;
    }
  });
  let foreground = true;
  const calls = [];
  const errors = [];
  const pending = new Map();
  let timerId = 0;
  const document = { activeElement: null, hasFocus: () => foreground };
  const element = (name, edge = null) =>
    Object.assign(new TestElement(), {
      isConnected: true,
      edge,
      focus() {
        calls.push({ operation: "focus", name, foreground });
        document.activeElement = this;
      },
      blur() {
        calls.push({ operation: "blur", name, foreground });
        if (document.activeElement === this) document.activeElement = null;
      },
    });
  const origin = element("origin");
  const unrelated = element("unrelated");
  const controls = Object.fromEntries(
    edgeNames.map((edge) => [edge, element(edge, edge)]),
  );
  const targets = Object.fromEntries(
    edgeNames.map((edge) => [
      edge,
      { contains: (node) => node === controls[edge] },
    ]),
  );
  const frame = {
    ownerDocument: document,
    contains: (node) => Object.values(controls).includes(node),
  };
  const focus = createSurfaceFocusCoordinator({
    frame,
    targets,
    ...(useChromeActive ? { isChromeWindowActive: () => foreground } : {}),
  });
  const shell = createEdgeShellController({
    onError(error) {
      errors.push(error);
    },
    scheduler: {
      setTimeout(callback) {
        pending.set(++timerId, callback);
        return timerId;
      },
      clearTimeout(id) {
        pending.delete(id);
      },
    },
  });
  shell.setPanelDodgeMode(mode);
  // Reproduce mount-shell.ts's surface subscription with the address overlay
  // closed. This is component integration, not a mounted browser/OS test.
  const unsubscribers = edgeNames.map((edge) =>
    shell.getSurface(edge).subscribe((snapshot) => {
      if (!snapshot.visible) focus.restoreFocus(edge);
    }),
  );
  t.after(() => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    focus.clear();
    shell.dispose();
    assert.equal(pending.size, 0);
    assert.deepEqual(errors, []);
  });
  return {
    calls,
    controls,
    document,
    focus,
    origin,
    unrelated,
    shell,
    foreground() {
      foreground = true;
    },
    background() {
      // A document's remembered activeElement need not identify the OS's
      // foreground window. Do not simulate any OS activation or flashing.
      foreground = false;
    },
    enterWithFocus(edge) {
      shell.revealFromPointer(edge);
      document.activeElement = controls[edge];
      focus.onFrameFocusIn({ target: controls[edge], relatedTarget: origin });
      shell.setFocusHeld(edge, true);
    },
    expireHideTimers() {
      for (const [id, callback] of [...pending]) {
        pending.delete(id);
        callback();
      }
    },
  };
}

test("background pointer-only reveal and hide does not request focus", (t) => {
  const h = createHarness(t);
  h.document.activeElement = h.origin;
  h.background();
  h.shell.revealFromPointer("left");
  assert.equal(h.shell.snapshot().surfaces.left.visible, true);
  assert.deepEqual(h.calls, []);
  h.shell.releasePointer("left", "outside-window");
  h.expireHideTimers();
  assert.equal(h.shell.snapshot().surfaces.left.visible, false);
  assert.deepEqual(h.calls, []);
});

test("background single-panel hover dismisses a previously focused panel without requesting focus", (t) => {
  const h = createHarness(t, "single-dynamic");
  h.enterWithFocus("right");
  h.background();
  assert.deepEqual(h.calls, []);
  h.shell.revealFromPointer("left");
  assert.equal(h.shell.snapshot().surfaces.left.visible, true);
  assert.equal(h.shell.snapshot().surfaces.right.visible, false);
  assert.deepEqual(h.calls, []);
  // Returning to the app must not revive the discarded focus origin.
  h.foreground();
  h.focus.restoreFocus("right");
  assert.deepEqual(h.calls, [
    { operation: "blur", name: "right", foreground: true },
  ]);
});

test("multiple-panel hover preserves the other focus-held panel without requesting focus", (t) => {
  const h = createHarness(t);
  h.enterWithFocus("right");
  h.background();
  h.shell.revealFromPointer("left");
  assert.equal(h.shell.snapshot().surfaces.right.visible, true);
  assert.deepEqual(h.calls, []);
});

test("delayed background hide preserves focus after focus and pointer holds are released", (t) => {
  const h = createHarness(t);
  h.enterWithFocus("left");
  h.document.activeElement = h.unrelated;
  h.shell.setFocusHeld("left", false);
  h.background();
  h.shell.releasePointer("left", "outside-window");
  assert.deepEqual(h.calls, []);
  h.expireHideTimers();
  assert.equal(h.shell.snapshot().surfaces.left.visible, false);
  assert.deepEqual(h.calls, []);
  assert.equal(h.document.activeElement, h.unrelated);
  // The saved origin is consumed: the same pointer pass is then silent.
  h.calls.length = 0;
  h.shell.revealFromPointer("left");
  h.shell.releasePointer("left", "outside-window");
  h.expireHideTimers();
  assert.deepEqual(h.calls, []);
});

test("foreground dismissal preserves focus that already moved outside the panel", (t) => {
  const h = createHarness(t);
  h.enterWithFocus("left");
  h.document.activeElement = h.unrelated;
  h.shell.dismiss("left");
  assert.deepEqual(h.calls, []);
  assert.equal(h.document.activeElement, h.unrelated);
});

test("foreground dismissal blurs its control when the origin is disconnected", (t) => {
  const h = createHarness(t);
  h.enterWithFocus("left");
  h.origin.isConnected = false;
  h.shell.dismiss("left");
  assert.deepEqual(h.calls, [
    { operation: "blur", name: "left", foreground: true },
  ]);
});

test("chrome activation takes precedence over document focus", (t) => {
  const h = createHarness(t);
  h.enterWithFocus("left");
  h.document.hasFocus = () => false;
  h.shell.dismiss("left");
  assert.deepEqual(h.calls, [
    { operation: "focus", name: "origin", foreground: true },
  ]);
});

test("inactive chrome window never restores focus even with remembered document focus", (t) => {
  const h = createHarness(t);
  h.enterWithFocus("left");
  h.background();
  h.document.hasFocus = () => true;
  h.shell.dismiss("left");
  assert.deepEqual(h.calls, []);
});

for (const foreground of [false, true]) {
  test(`document focus fallback permits restoration only when focused: ${foreground}`, (t) => {
    const h = createHarness(t, "multiple-dynamic", false);
    h.enterWithFocus("left");
    if (!foreground) h.background();
    h.shell.dismiss("left");
    assert.deepEqual(
      h.calls,
      foreground ? [{ operation: "focus", name: "origin", foreground }] : [],
    );
  });
}

test("foreground dismissal restores the saved focus origin", (t) => {
  const h = createHarness(t);
  h.enterWithFocus("left");
  h.shell.dismiss("left");
  assert.deepEqual(h.calls, [
    { operation: "focus", name: "origin", foreground: true },
  ]);
});

test("discarding a saved origin prevents a background focus request", (t) => {
  const h = createHarness(t);
  h.enterWithFocus("left");
  h.document.activeElement = h.unrelated;
  h.focus.discardFocusOrigin("left");
  h.background();
  h.shell.dismiss("left");
  assert.deepEqual(h.calls, []);
});
