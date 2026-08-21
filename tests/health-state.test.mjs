import assert from "node:assert/strict";
import test from "node:test";

import {
  createShellHealthState,
  emergencyFallbackBinding,
  isEmergencyFallbackEvent,
  registerEmergencyFallback,
  runShellHealthCheck,
  shellHealthAttributes,
} from "../profile/chrome/fennevia/content/runtime/HealthState.sys.mjs";

class AttributeTarget {
  constructor() {
    this.attributes = new Map();
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
}

class RecordingEventTarget {
  constructor() {
    this.listeners = [];
  }

  addEventListener(type, callback, options) {
    this.listeners.push({ type, callback, options });
  }

  removeEventListener(type, callback) {
    const index = this.listeners.findIndex(
      (listener) => listener.type === type && listener.callback === callback,
    );
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  dispatch(event) {
    for (const listener of this.listeners
      .filter((candidate) => candidate.type === event.type)
      .slice()) {
      listener.callback(event);
    }
  }
}

const allHealthAttributes = Object.values(shellHealthAttributes);

const assertExactMarkers = (root, state, expectedMarkers) => {
  assert.equal(root.getAttribute(shellHealthAttributes.rootState), state);
  for (const marker of [
    shellHealthAttributes.created,
    shellHealthAttributes.mounted,
    shellHealthAttributes.healthy,
    shellHealthAttributes.active,
    shellHealthAttributes.failed,
  ]) {
    assert.equal(
      root.hasAttribute(marker),
      expectedMarkers.includes(marker),
      `${marker} should ${
        expectedMarkers.includes(marker) ? "be present" : "be absent"
      } in ${state}`,
    );
  }
};

const createEmergencyEvent = (overrides) => ({
  type: "keydown",
  code: "F12",
  key: "F12",
  keyCode: 0x7b,
  altKey: true,
  ctrlKey: true,
  shiftKey: true,
  metaKey: false,
  ...overrides,
});

test("health states use validated cumulative root markers and clear every marker on disposal", () => {
  const root = new AttributeTarget();
  const state = createShellHealthState({ rootElement: root });

  assert.deepEqual(state.snapshot(), { active: false, state: "created" });
  assertExactMarkers(root, "created", [shellHealthAttributes.created]);

  assert.equal(state.transition("mounted"), true);
  assert.equal(state.transition("mounted"), false);
  assertExactMarkers(root, "mounted", [
    shellHealthAttributes.created,
    shellHealthAttributes.mounted,
  ]);

  assert.equal(state.transition("healthy"), true);
  assertExactMarkers(root, "healthy", [
    shellHealthAttributes.created,
    shellHealthAttributes.mounted,
    shellHealthAttributes.healthy,
  ]);
  assert.equal(state.activate(), true);
  assert.equal(state.activate(), false);
  assertExactMarkers(root, "active", [
    shellHealthAttributes.created,
    shellHealthAttributes.mounted,
    shellHealthAttributes.healthy,
    shellHealthAttributes.active,
  ]);
  assert.deepEqual(state.snapshot(), { active: true, state: "active" });

  assert.equal(state.dispose(), true);
  assert.equal(state.dispose(), false);
  assert.deepEqual(state.snapshot(), { active: false, state: "disposed" });
  assert.ok(
    allHealthAttributes.every((attribute) => !root.hasAttribute(attribute)),
  );
});

test("an illegal transition fails open and removes the active gate", () => {
  const root = new AttributeTarget();
  const state = createShellHealthState({ rootElement: root });

  assert.throws(
    () => state.transition("healthy"),
    /FENNEVIA_SHELL_STATE_TRANSITION_INVALID/u,
  );
  assert.deepEqual(state.snapshot(), { active: false, state: "failed" });
  assertExactMarkers(root, "failed", [shellHealthAttributes.failed]);
  assert.throws(
    () => state.transition("mounted"),
    /FENNEVIA_SHELL_STATE_TRANSITION_INVALID/u,
  );
});

test("stale project state is rejected and cleared without adopting it", () => {
  const root = new AttributeTarget();
  root.setAttribute(shellHealthAttributes.rootState, "active");
  root.setAttribute(shellHealthAttributes.active, "");

  assert.throws(
    () => createShellHealthState({ rootElement: root }),
    /FENNEVIA_SHELL_STATE_ATTRIBUTE_COLLISION/u,
  );
  assert.ok(
    allHealthAttributes.every((attribute) => !root.hasAttribute(attribute)),
  );
});

test("the emergency binding is exact, privileged, synchronous, and removable", () => {
  const eventTarget = new RecordingEventTarget();
  let fallbackCount = 0;
  let errorCount = 0;
  const emergency = registerEmergencyFallback({
    eventTarget,
    onFallback() {
      fallbackCount += 1;
      return true;
    },
    onError() {
      errorCount += 1;
    },
  });

  assert.equal(emergencyFallbackBinding, "Ctrl+Alt+Shift+F12");
  assert.deepEqual(eventTarget.listeners[0].options, {
    capture: true,
    mozSystemGroup: true,
  });
  assert.equal(isEmergencyFallbackEvent(createEmergencyEvent()), true);
  assert.equal(
    isEmergencyFallbackEvent(createEmergencyEvent({ shiftKey: false })),
    false,
  );
  assert.equal(
    isEmergencyFallbackEvent(createEmergencyEvent({ metaKey: true })),
    false,
  );

  eventTarget.dispatch(createEmergencyEvent({ shiftKey: false }));
  assert.equal(fallbackCount, 0);
  let prevented = false;
  let stopped = false;
  eventTarget.dispatch(
    createEmergencyEvent({
      preventDefault() {
        prevented = true;
      },
      stopImmediatePropagation() {
        stopped = true;
      },
    }),
  );
  assert.equal(fallbackCount, 1);
  assert.equal(errorCount, 0);
  assert.equal(prevented, true);
  assert.equal(stopped, true);
  assert.deepEqual(emergency.snapshot(), {
    binding: "Ctrl+Alt+Shift+F12",
    invocationCount: 1,
    registered: true,
  });
  assert.equal(emergency.dispose(), true);
  assert.equal(emergency.dispose(), false);
  assert.equal(eventTarget.listeners.length, 0);
});

test("an asynchronous emergency callback is rejected through the fixed error path", () => {
  const eventTarget = new RecordingEventTarget();
  const errors = [];
  const emergency = registerEmergencyFallback({
    eventTarget,
    onFallback() {
      return Promise.resolve();
    },
    onError(error) {
      errors.push(error);
    },
  });

  eventTarget.dispatch(createEmergencyEvent());
  assert.equal(errors.length, 1);
  assert.equal(errors[0].fenneviaCode, "FENNEVIA_EMERGENCY_FALLBACK_ASYNC");
  assert.equal(errors[0].fenneviaPhase, "shell-emergency-fallback");
  emergency.dispose();
});

test("health checks require literal success and clear timeout and abort resources", async () => {
  const abortController = new AbortController();
  const scheduled = [];
  const cleared = [];
  const result = await runShellHealthCheck({
    check: () => true,
    signal: abortController.signal,
    timeoutMs: 50,
    setTimeoutFunction(callback, timeoutMs) {
      scheduled.push({ callback, timeoutMs });
      return "timer-1";
    },
    clearTimeoutFunction(id) {
      cleared.push(id);
    },
  });

  assert.equal(result, true);
  assert.deepEqual(
    scheduled.map((entry) => entry.timeoutMs),
    [50],
  );
  assert.deepEqual(cleared, ["timer-1"]);
  await assert.rejects(
    runShellHealthCheck({
      check: () => false,
      signal: new AbortController().signal,
      timeoutMs: 50,
    }),
    /FENNEVIA_SHELL_HEALTH_CHECK_FAILED/u,
  );
  await assert.rejects(
    runShellHealthCheck({
      check: () => "yes",
      signal: new AbortController().signal,
      timeoutMs: 50,
    }),
    /FENNEVIA_SHELL_HEALTH_RESULT_INVALID/u,
  );
});

test("health checks fail deterministically on timeout and disposal abort", async () => {
  await assert.rejects(
    runShellHealthCheck({
      check: () => new Promise(() => {}),
      signal: new AbortController().signal,
      timeoutMs: 5,
    }),
    /FENNEVIA_SHELL_HEALTH_TIMEOUT/u,
  );

  const abortController = new AbortController();
  const pending = runShellHealthCheck({
    check: () => new Promise(() => {}),
    signal: abortController.signal,
    timeoutMs: 100,
  });
  abortController.abort();
  await assert.rejects(pending, /FENNEVIA_SHELL_HEALTH_ABORTED/u);
});
