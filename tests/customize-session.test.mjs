import assert from "node:assert/strict";
import test from "node:test";

import {
  createCustomizeSessionController,
  customizeActiveAttribute,
} from "../src/app/customize-session.ts";
import {
  createEdgeShellController,
  edgeNames,
} from "../src/app/edge-surfaces.ts";

function createFrame() {
  const attributes = new Map();
  return {
    attributes,
    removeAttribute(name) {
      attributes.delete(name);
    },
    setAttribute(name, value) {
      attributes.set(name, value);
    },
  };
}

function createScheduler() {
  let nextId = 1;
  let now = 0;
  const tasks = new Map();

  return {
    scheduler: {
      clearTimeout(handle) {
        tasks.delete(handle);
      },
      setTimeout(callback, delayMs) {
        const id = nextId++;
        tasks.set(id, { at: now + delayMs, callback });
        return id;
      },
    },
  };
}

test("opening customize holds every edge popup and marks the frame", () => {
  const frame = createFrame();
  const shell = createEdgeShellController({
    scheduler: createScheduler().scheduler,
  });
  const session = createCustomizeSessionController({ frame, shell });

  assert.equal(session.isOpen(), false);
  assert.equal(session.setOpen(true), true);
  assert.equal(session.isOpen(), true);
  assert.equal(session.lastFocusedZone(), "top");
  assert.equal(frame.attributes.get(customizeActiveAttribute), "");
  assert.ok(
    edgeNames.every((edge) => shell.snapshot().surfaces[edge].holds.popup),
  );
  assert.equal(session.setOpen(true), false);

  assert.equal(session.setLastFocusedZone("left"), true);
  assert.equal(session.lastFocusedZone(), "left");
  assert.deepEqual(session.snapshot(), {
    lastFocusedZone: "left",
    open: true,
  });
  assert.equal(session.setLastFocusedZone("left"), false);

  assert.equal(session.setOpen(false), true);
  assert.equal(session.isOpen(), false);
  assert.equal(frame.attributes.has(customizeActiveAttribute), false);
  assert.ok(
    edgeNames.every((edge) => !shell.snapshot().surfaces[edge].holds.popup),
  );
});

test("restoreHolds re-applies popup holds while the session stays open", () => {
  const frame = createFrame();
  const shell = createEdgeShellController({
    scheduler: createScheduler().scheduler,
  });
  const session = createCustomizeSessionController({ frame, shell });

  assert.equal(session.restoreHolds(), false);
  session.setOpen(true);
  shell.setPopupHeld("top", false);
  shell.setPopupHeld("bottom", false);
  assert.equal(shell.snapshot().surfaces.top.holds.popup, false);
  assert.equal(session.restoreHolds(), true);
  assert.ok(
    edgeNames.every((edge) => shell.snapshot().surfaces[edge].holds.popup),
  );
});

test("suppressed or disabled shells cannot open customize", () => {
  const frame = createFrame();
  const shell = createEdgeShellController({
    scheduler: createScheduler().scheduler,
  });
  const session = createCustomizeSessionController({ frame, shell });

  shell.setInteractionSuppressed(true);
  assert.equal(session.setOpen(true), false);
  assert.equal(session.isOpen(), false);

  shell.setInteractionSuppressed(false);
  shell.setEnabled(false);
  assert.equal(session.setOpen(true), false);
  assert.equal(session.isOpen(), false);
});

test("dispose releases holds, clears the frame marker, and rejects later use", () => {
  const frame = createFrame();
  const shell = createEdgeShellController({
    scheduler: createScheduler().scheduler,
  });
  const session = createCustomizeSessionController({ frame, shell });
  const seen = [];
  const unsubscribe = session.subscribe((snapshot) => {
    seen.push(snapshot.open);
  });

  session.setOpen(true);
  assert.deepEqual(seen, [true]);
  assert.equal(session.dispose(), true);
  assert.equal(session.isOpen(), false);
  assert.equal(frame.attributes.has(customizeActiveAttribute), false);
  assert.ok(
    edgeNames.every((edge) => !shell.snapshot().surfaces[edge].holds.popup),
  );
  assert.equal(session.dispose(), false);
  assert.equal(unsubscribe(), false);
  assert.throws(
    () => session.setOpen(true),
    /FENNEVIA_CUSTOMIZE_SESSION_DISPOSED/u,
  );
});

test("subscriber failures reach the reporter without interrupting peers", () => {
  const errors = [];
  const frame = createFrame();
  const shell = createEdgeShellController({
    scheduler: createScheduler().scheduler,
  });
  const session = createCustomizeSessionController({
    frame,
    onError(error) {
      errors.push(error);
    },
    shell,
  });
  const seen = [];
  session.subscribe(() => {
    throw new Error("listener-failed");
  });
  session.subscribe((snapshot) => {
    seen.push(snapshot.open);
  });

  session.setOpen(true);
  assert.equal(errors.length, 1);
  assert.deepEqual(seen, [true]);
});

test("invalid collaborators and arguments fail closed", () => {
  const shell = createEdgeShellController({
    scheduler: createScheduler().scheduler,
  });
  assert.throws(
    () =>
      createCustomizeSessionController({
        frame: {},
        shell,
      }),
    /FENNEVIA_CUSTOMIZE_SESSION_FRAME_INVALID/u,
  );
  assert.throws(
    () =>
      createCustomizeSessionController({
        frame: createFrame(),
        shell: {},
      }),
    /FENNEVIA_CUSTOMIZE_SESSION_SHELL_INVALID/u,
  );

  const session = createCustomizeSessionController({
    frame: createFrame(),
    shell,
  });
  assert.throws(
    () => session.setOpen("yes"),
    /FENNEVIA_CUSTOMIZE_SESSION_OPEN_INVALID/u,
  );
  assert.throws(
    () => session.setLastFocusedZone("middle"),
    /FENNEVIA_CUSTOMIZE_SESSION_ZONE_INVALID/u,
  );
  assert.throws(
    () => session.subscribe(null),
    /FENNEVIA_CUSTOMIZE_SESSION_LISTENER_INVALID/u,
  );
});
