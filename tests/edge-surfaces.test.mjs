import assert from "node:assert/strict";
import test from "node:test";

import {
  createEdgeShellController,
  createEdgeSurfaceController,
  edgeInteractionDefaults,
  edgeKeyboardBindings,
  edgeNames,
  getKeyboardRevealEdge,
  resolveEdgeAtPoint,
} from "../src/app/edge-surfaces.ts";

function createScheduler() {
  let nextId = 1;
  let now = 0;
  const tasks = new Map();

  const runDue = () => {
    while (true) {
      const due = [...tasks.entries()]
        .filter(([, task]) => task.at <= now)
        .sort((left, right) => left[1].at - right[1].at)[0];
      if (!due) {
        return;
      }
      tasks.delete(due[0]);
      due[1].callback();
    }
  };

  return {
    advance(milliseconds) {
      now += milliseconds;
      runDue();
    },
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
    size() {
      return tasks.size;
    },
  };
}

test("pointer reveal uses one anti-flicker hide timer and cancels it on re-entry", () => {
  const clock = createScheduler();
  const surface = createEdgeSurfaceController("top", {
    hideDelayMs: 50,
    scheduler: clock.scheduler,
  });

  assert.deepEqual(surface.snapshot(), {
    edge: "top",
    enabled: true,
    holds: {
      focus: false,
      keyboard: false,
      pointer: false,
      popup: false,
      programmatic: false,
    },
    phase: "hidden",
    revision: 0,
    visible: false,
  });

  assert.equal(surface.setPointerHeld(true), true);
  assert.equal(surface.snapshot().phase, "pointer-revealed");
  assert.equal(surface.setPointerHeld(false), true);
  assert.equal(surface.snapshot().phase, "pending-hide");
  assert.equal(clock.size(), 1);

  clock.advance(30);
  assert.equal(surface.setPointerHeld(true), true);
  assert.equal(clock.size(), 0);
  assert.equal(surface.snapshot().visible, true);
  surface.setPointerHeld(false);
  clock.advance(50);
  assert.equal(surface.snapshot().phase, "hidden");
  assert.equal(surface.snapshot().visible, false);
});

test("focus, keyboard, and popup holds are explicit and popup vetoes dismissal", () => {
  const clock = createScheduler();
  const surface = createEdgeSurfaceController("left", {
    hideDelayMs: 25,
    scheduler: clock.scheduler,
  });

  surface.revealFromKeyboard();
  assert.equal(surface.snapshot().phase, "keyboard-held");
  surface.setFocusHeld(true);
  assert.equal(surface.snapshot().phase, "focus-held");
  surface.setPopupHeld(true);
  assert.equal(surface.snapshot().phase, "popup-held");

  assert.equal(surface.dismiss(), true);
  assert.equal(surface.snapshot().phase, "popup-held");
  assert.equal(surface.snapshot().holds.popup, true);
  surface.setPopupHeld(false);
  assert.equal(surface.snapshot().phase, "pending-hide");
  clock.advance(25);
  assert.equal(surface.snapshot().phase, "hidden");
});

test("programmatic reveal is bounded, replaced, and fully cleaned on disposal", () => {
  const clock = createScheduler();
  const surface = createEdgeSurfaceController("bottom", {
    hideDelayMs: 20,
    scheduler: clock.scheduler,
  });

  surface.revealProgrammatically(100);
  assert.equal(surface.snapshot().phase, "programmatic-revealed");
  assert.equal(clock.size(), 1);
  clock.advance(60);
  surface.revealProgrammatically(80);
  assert.equal(clock.size(), 1);
  clock.advance(79);
  assert.equal(surface.snapshot().visible, true);
  clock.advance(1);
  assert.equal(surface.snapshot().phase, "pending-hide");
  clock.advance(20);
  assert.equal(surface.snapshot().phase, "hidden");

  assert.throws(
    () => surface.revealProgrammatically(0),
    /FENNEVIA_EDGE_PROGRAMMATIC_DURATION_INVALID/u,
  );
  surface.revealProgrammatically(100);
  assert.equal(surface.dispose(), true);
  assert.equal(surface.dispose(), false);
  assert.equal(clock.size(), 0);
  assert.equal(surface.snapshot().phase, "disposed");
  assert.throws(
    () => surface.setPointerHeld(true),
    /FENNEVIA_EDGE_CONTROLLER_DISPOSED/u,
  );
});

test("disabled surfaces clear every hold and re-enable hidden", () => {
  const surface = createEdgeSurfaceController("right");
  surface.setPointerHeld(true);
  surface.setFocusHeld(true);
  surface.setPopupHeld(true);
  assert.equal(surface.setEnabled(false), true);
  assert.equal(surface.snapshot().phase, "disabled");
  assert.equal(surface.snapshot().visible, false);
  assert.ok(Object.values(surface.snapshot().holds).every((held) => !held));
  assert.equal(surface.revealFromKeyboard(), false);
  assert.equal(surface.setEnabled(true), true);
  assert.equal(surface.snapshot().phase, "hidden");
});

test("the shared shell keeps pointer reveal exclusive while preserving legitimate holds", () => {
  const clock = createScheduler();
  const shell = createEdgeShellController({
    hideDelayMs: 10,
    scheduler: clock.scheduler,
  });

  shell.revealFromPointer("top");
  shell.revealFromPointer("left");
  assert.equal(shell.snapshot().surfaces.top.holds.pointer, false);
  assert.equal(shell.snapshot().surfaces.left.holds.pointer, true);

  shell.setFocusHeld("top", true);
  shell.setPopupHeld("right", true);
  shell.revealFromKeyboard("bottom");
  assert.deepEqual(
    edgeNames.filter((edge) => shell.snapshot().surfaces[edge].visible),
    ["top", "left", "right", "bottom"],
  );

  assert.equal(shell.dismissActive(), "bottom");
  assert.equal(shell.snapshot().surfaces.bottom.visible, false);
  assert.equal(shell.dismiss("right"), false);
  assert.equal(shell.snapshot().surfaces.right.phase, "popup-held");
  assert.equal(shell.setEnabled(false), true);
  assert.ok(
    edgeNames.every(
      (edge) => shell.snapshot().surfaces[edge].phase === "disabled",
    ),
  );
  assert.equal(clock.size(), 0);
});

test("window dragging suppresses cross-edge pointer reveal without clearing other holds", () => {
  const clock = createScheduler();
  const shell = createEdgeShellController({
    hideDelayMs: 10,
    scheduler: clock.scheduler,
  });

  shell.revealFromPointer("left");
  assert.equal(shell.setWindowDragActive(true), true);
  assert.equal(shell.setWindowDragActive(true), false);
  assert.equal(shell.snapshot().surfaces.left.holds.pointer, false);
  assert.equal(clock.size(), 1);

  assert.equal(shell.revealFromPointer("top"), false);
  assert.equal(shell.setPointerHeld("right", true), false);
  assert.equal(shell.revealFromKeyboard("top"), true);
  assert.equal(shell.setFocusHeld("right", true), true);
  assert.equal(shell.setPopupHeld("bottom", true), true);
  assert.equal(shell.revealProgrammatically("left", 100), true);

  assert.equal(shell.setWindowDragActive(false), true);
  assert.equal(shell.revealFromPointer("top"), true);
  assert.equal(shell.snapshot().surfaces.top.holds.pointer, true);
  assert.equal(shell.snapshot().surfaces.left.holds.programmatic, true);
  assert.equal(shell.snapshot().surfaces.right.holds.focus, true);
  assert.equal(shell.snapshot().surfaces.bottom.holds.popup, true);

  assert.throws(
    () => shell.setWindowDragActive("yes"),
    /FENNEVIA_EDGE_WINDOW_DRAG_ACTIVE_INVALID/u,
  );
  shell.setEnabled(false);
  assert.equal(shell.setWindowDragActive(true), false);
});

test("address popup suppression clears every edge and rejects new interactions", () => {
  const clock = createScheduler();
  const shell = createEdgeShellController({
    hideDelayMs: 10,
    scheduler: clock.scheduler,
  });

  shell.revealFromPointer("top");
  shell.setFocusHeld("left", true);
  shell.setPopupHeld("right", true);
  shell.revealProgrammatically("bottom", 100);
  assert.equal(clock.size(), 1);

  assert.equal(shell.setInteractionSuppressed(true), true);
  const suppressed = shell.snapshot();
  assert.equal(suppressed.enabled, true);
  assert.equal(suppressed.interactionSuppressed, true);
  assert.equal(suppressed.activeEdge, null);
  assert.ok(
    edgeNames.every(
      (edge) =>
        suppressed.surfaces[edge].phase === "disabled" &&
        !suppressed.surfaces[edge].visible &&
        Object.values(suppressed.surfaces[edge].holds).every((held) => !held),
    ),
  );
  assert.equal(clock.size(), 0);
  assert.equal(shell.revealFromPointer("top"), false);
  assert.equal(shell.revealFromKeyboard("left"), false);
  assert.equal(shell.revealProgrammatically("right"), false);
  assert.equal(shell.setFocusHeld("bottom", true), false);
  assert.equal(shell.setPopupHeld("top", true), false);

  assert.equal(shell.setInteractionSuppressed(false), true);
  assert.equal(shell.snapshot().interactionSuppressed, false);
  assert.ok(
    edgeNames.every(
      (edge) => shell.snapshot().surfaces[edge].phase === "hidden",
    ),
  );
  assert.equal(shell.revealFromKeyboard("left"), true);
  assert.equal(shell.snapshot().surfaces.left.phase, "keyboard-held");
});

test("natural hide clears the active edge so an unrelated Escape remains available", () => {
  const clock = createScheduler();
  const shell = createEdgeShellController({
    hideDelayMs: 10,
    scheduler: clock.scheduler,
  });

  const { setPointerHeld } = shell;
  assert.equal(setPointerHeld("top", true), true);
  assert.equal(setPointerHeld("top", false), true);
  assert.equal(shell.snapshot().activeEdge, "top");
  clock.advance(10);
  assert.equal(shell.snapshot().activeEdge, null);
  assert.equal(shell.dismissActive(), null);
});

test("interaction settings rearm the one hide timer and set future temporary reveals", () => {
  const clock = createScheduler();
  const shell = createEdgeShellController({ scheduler: clock.scheduler });

  assert.equal(edgeInteractionDefaults.hideDelayMs, 300);
  assert.equal(edgeInteractionDefaults.windowLeaveHideDelayMs, 800);
  assert.deepEqual(shell.snapshot().interaction, edgeInteractionDefaults);
  shell.setPointerHeld("top", true);
  shell.setPointerHeld("top", false);
  clock.advance(80);

  const config = Object.freeze({
    hideDelayMs: 600,
    programmaticRevealMs: 2_400,
    triggerThicknessCssPixels: 20,
    windowLeaveHideDelayMs: 1_000,
  });
  assert.equal(shell.setInteractionConfig(config), true);
  assert.equal(shell.setInteractionConfig(config), false);
  assert.deepEqual(shell.snapshot().interaction, config);
  assert.equal(clock.size(), 1);
  clock.advance(599);
  assert.equal(shell.snapshot().surfaces.top.visible, true);
  clock.advance(1);
  assert.equal(shell.snapshot().surfaces.top.visible, false);

  shell.revealProgrammatically("right");
  clock.advance(2_399);
  assert.equal(shell.snapshot().surfaces.right.visible, true);
  clock.advance(1);
  assert.equal(shell.snapshot().surfaces.right.phase, "pending-hide");
  clock.advance(600);
  assert.equal(shell.snapshot().surfaces.right.visible, false);

  assert.throws(
    () =>
      shell.setInteractionConfig({
        ...config,
        triggerThicknessCssPixels: 25,
      }),
    /FENNEVIA_EDGE_INTERACTION_CONFIG_INVALID/u,
  );
  assert.throws(
    () =>
      shell.setInteractionConfig({
        ...config,
        windowLeaveHideDelayMs: 5_001,
      }),
    /FENNEVIA_EDGE_INTERACTION_CONFIG_INVALID/u,
  );
  assert.deepEqual(shell.snapshot().interaction, config);
});

test("pointer exits inside and outside the browser use distinct delays on one timer", () => {
  const clock = createScheduler();
  const shell = createEdgeShellController({ scheduler: clock.scheduler });

  shell.setPointerHeld("top", true);
  assert.equal(shell.releasePointer("top", "inside-window"), true);
  assert.equal(clock.size(), 1);
  clock.advance(299);
  assert.equal(shell.snapshot().surfaces.top.visible, true);
  clock.advance(1);
  assert.equal(shell.snapshot().surfaces.top.visible, false);

  shell.setPointerHeld("top", true);
  shell.setPointerHeld("top", false);
  clock.advance(100);
  assert.equal(shell.releasePointer("top", "outside-window"), true);
  assert.equal(clock.size(), 1);
  assert.equal(shell.releasePointer("top", "outside-window"), false);
  clock.advance(799);
  assert.equal(shell.snapshot().surfaces.top.visible, true);
  clock.advance(1);
  assert.equal(shell.snapshot().surfaces.top.visible, false);

  shell.setPointerHeld("right", true);
  shell.releasePointer("right", "outside-window");
  clock.advance(80);
  shell.setInteractionConfig({
    ...edgeInteractionDefaults,
    windowLeaveHideDelayMs: 1_200,
  });
  assert.equal(clock.size(), 1);
  clock.advance(1_199);
  assert.equal(shell.snapshot().surfaces.right.visible, true);
  clock.advance(1);
  assert.equal(shell.snapshot().surfaces.right.visible, false);

  assert.throws(
    () => shell.releasePointer("top", "somewhere-else"),
    /FENNEVIA_EDGE_POINTER_EXIT_LOCATION_INVALID/u,
  );
});

test("corner arbitration follows top, sides, then bottom priority", () => {
  const frame = { height: 600, thickness: 6, width: 1000 };
  assert.equal(resolveEdgeAtPoint({ ...frame, x: 0, y: 0 }), "top");
  assert.equal(resolveEdgeAtPoint({ ...frame, x: 1000, y: 0 }), "top");
  assert.equal(resolveEdgeAtPoint({ ...frame, x: 0, y: 600 }), "left");
  assert.equal(resolveEdgeAtPoint({ ...frame, x: 1000, y: 600 }), "right");
  assert.equal(resolveEdgeAtPoint({ ...frame, x: 500, y: 2 }), "top");
  assert.equal(resolveEdgeAtPoint({ ...frame, x: 500, y: 598 }), "bottom");
  assert.equal(resolveEdgeAtPoint({ ...frame, x: 500, y: 300 }), null);
  assert.equal(
    resolveEdgeAtPoint({ ...frame, thickness: -1, x: 0, y: 0 }),
    null,
  );
});

test("keyboard reveal uses four exact modifier chords and rejects near matches", () => {
  const base = { altKey: true, ctrlKey: true, metaKey: false, shiftKey: true };
  assert.equal(getKeyboardRevealEdge({ ...base, code: "ArrowUp" }), "top");
  assert.equal(getKeyboardRevealEdge({ ...base, key: "ArrowLeft" }), "left");
  assert.equal(getKeyboardRevealEdge({ ...base, code: "ArrowRight" }), "right");
  assert.equal(getKeyboardRevealEdge({ ...base, code: "ArrowDown" }), "bottom");
  assert.equal(
    getKeyboardRevealEdge({ ...base, code: "ArrowUp", shiftKey: false }),
    null,
  );
  assert.equal(
    getKeyboardRevealEdge({ ...base, code: "ArrowUp", metaKey: true }),
    null,
  );
  assert.deepEqual(edgeKeyboardBindings, {
    top: "Ctrl+Alt+Shift+ArrowUp",
    left: "Ctrl+Alt+Shift+ArrowLeft",
    right: "Ctrl+Alt+Shift+ArrowRight",
    bottom: "Ctrl+Alt+Shift+ArrowDown",
  });
});

test("subscriber failures reach the fatal boundary without interrupting peers", () => {
  const errors = [];
  const snapshots = [];
  const surface = createEdgeSurfaceController("top", {
    onError(error) {
      errors.push(error);
    },
  });
  surface.subscribe(() => {
    throw new Error("listener failed");
  });
  surface.subscribe((snapshot) => snapshots.push(snapshot.phase));

  surface.setPointerHeld(true);
  assert.equal(errors.length, 1);
  assert.deepEqual(snapshots, ["pointer-revealed"]);
});
