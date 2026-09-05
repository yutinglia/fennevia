// SPDX-License-Identifier: MPL-2.0
import assert from "node:assert/strict";
import test from "node:test";
import { resolveTabDragScroll } from "../src/app/tab-drag-scroll.ts";
import { createTabDragAutoScroller } from "../src/shell/features/tabs/tab-drag-autoscroll.ts";

const metrics = {
  pointer: 499,
  start: 0,
  end: 500,
  position: 1000,
  viewportSize: 500,
  contentSize: 6000,
  itemSize: 40,
};
const speed = (changes = {}, elapsed = 1000) =>
  resolveTabDragScroll({ ...metrics, ...changes }, elapsed);

test("drag scroll needs finite, visible geometry and available overflow", () => {
  for (const changes of [
    { pointer: NaN },
    { itemSize: 0 },
    { contentSize: Infinity },
    { start: 500 },
    { viewportSize: 0 },
    { pointer: -1 },
    { pointer: 501 },
    { contentSize: 500 },
    { contentSize: 450 },
    { pointer: 250 },
    { position: 5500 },
    { pointer: 0, position: 0 },
  ])
    assert.equal(speed(changes).velocity, 0);
  assert.equal(speed({}, NaN).velocity, 0);
});

test("fine control is identical for short and long overflow; only the outer zone accelerates", () => {
  const short = { position: 0, contentSize: 620 };
  assert.equal(
    speed({ ...short, pointer: 470 }).velocity,
    speed({ pointer: 470 }).velocity,
  );
  assert.equal(
    speed({ pointer: 470 }, 0).velocity,
    speed({ pointer: 470 }, 5000).velocity,
  );
  assert.ok(speed(short).velocity <= 96);
  assert.ok(speed().velocity > speed(short).velocity * 5);
  assert.ok(speed({ pointer: 490 }).velocity < speed().velocity);
});

test("fast scrolling ramps after a short dwell and slows near either end", () => {
  assert.equal(speed({}, 0).velocity, speed({}, 180).velocity);
  assert.ok(speed({}, 400).velocity > speed({}, 180).velocity);
  assert.ok(speed({}, 400).velocity < speed({}, 780).velocity);
  assert.equal(speed({}, 780).velocity, speed({}, 5000).velocity);
  assert.ok(speed({ position: 5480 }).velocity < speed().velocity);
  assert.ok(
    Math.abs(speed({ pointer: 1, position: 20 }).velocity) <
      Math.abs(speed({ pointer: 1 }).velocity),
  );
  assert.equal(
    speed({ pointer: 1, position: 4500 }).velocity,
    -speed().velocity,
  );
});

test("short viewports retain a non-scrolling center", () => {
  assert.equal(speed({ end: 60, viewportSize: 60, pointer: 30 }).velocity, 0);
  assert.ok(speed({ end: 60, viewportSize: 60, pointer: 59 }).velocity > 0);
});

function fixture() {
  const callbacks = new Map();
  let serial = 0;
  let currentTime = 0;
  let active = true;
  let previews = 0;
  const errors = [];
  const view = {
    requestAnimationFrame(callback) {
      callbacks.set(++serial, callback);
      return serial;
    },
    cancelAnimationFrame(id) {
      callbacks.delete(id);
    },
  };
  const document = { defaultView: view, hidden: false };
  const makeElement = (parentElement = null) => {
    const attributes = new Map();
    return {
      attributes,
      parentElement,
      ownerDocument: document,
      isConnected: true,
      scrollTop: 1000,
      scrollLeft: 1000,
      scrollHeight: 6000,
      scrollWidth: 6000,
      clientHeight: 500,
      clientWidth: 500,
      getBoundingClientRect: () => ({
        top: 0,
        left: 0,
        bottom: 500,
        right: 500,
      }),
      getAttribute: (name) => attributes.get(name) ?? null,
      setAttribute: (name, value) => attributes.set(name, value),
      removeAttribute: (name) => attributes.delete(name),
    };
  };
  const native = makeElement();
  const surface = makeElement(native);
  const root = makeElement(surface);
  const partition = makeElement(root);
  const pinned = makeElement(root);
  root.closest = () => surface;
  root.querySelectorAll = () => [partition, pinned];
  root.contains = (element) => element === partition || element === pinned;
  const scroller = createTabDragAutoScroller({
    root,
    isActive: () => active,
    onScroll: () => {
      previews += 1;
    },
    onError: (error) => errors.push(error),
  });
  const update = (point = { clientX: 250, clientY: 499 }, changes = {}) =>
    scroller.update(
      {
        element: partition,
        horizontal: false,
        itemSize: 40,
        dragId: "drag-1",
        ...changes,
      },
      point,
    );
  const frame = (duration = 1000 / 60) => {
    currentTime += duration;
    const pending = Array.from(callbacks.values());
    callbacks.clear();
    for (const callback of pending) callback(currentTime);
  };
  return {
    scroller,
    update,
    frame,
    callbacks,
    document,
    partition,
    pinned,
    native,
    root,
    surface,
    errors,
    previews: () => previews,
    deactivate: () => {
      active = false;
    },
  };
}

test("one frame owner scrolls only the target and refreshes a stationary pointer preview", () => {
  const f = fixture();
  f.update();
  f.update();
  assert.equal(f.callbacks.size, 1);
  for (let i = 0; i < 90; i++) f.frame();
  assert.ok(f.partition.scrollTop > 1500);
  assert.equal(f.pinned.scrollTop, 1000);
  assert.ok(f.previews() > 50);
  assert.equal(f.callbacks.size, 1);
  f.scroller.stop();
});

test("moving inward stops immediately, and returning starts with fine speed", () => {
  const f = fixture();
  f.update();
  for (let i = 0; i < 70; i++) f.frame();
  f.update({ clientX: 250, clientY: 250 });
  const stopped = f.partition.scrollTop;
  f.frame();
  assert.equal(f.partition.scrollTop, stopped);
  assert.equal(f.callbacks.size, 0);
  f.update();
  f.frame();
  f.frame();
  assert.ok(f.partition.scrollTop - stopped <= 2);
  f.update({ clientX: 501, clientY: 499 });
  assert.equal(f.callbacks.size, 0);
  f.scroller.stop();
});

test("scroll speed is frame-rate independent and stalled frames cannot jump", () => {
  const a = fixture();
  const b = fixture();
  a.update();
  b.update();
  a.frame(0);
  b.frame(0);
  for (let i = 0; i < 120; i++) a.frame(1000 / 60);
  for (let i = 0; i < 240; i++) b.frame(1000 / 120);
  assert.ok(Math.abs(a.partition.scrollTop - b.partition.scrollTop) <= 7);
  const previous = a.partition.scrollTop;
  a.frame(5000);
  assert.ok(a.partition.scrollTop - previous <= 38);
  a.scroller.stop();
  b.scroller.stop();
});

test("subpixel fine scrolling accumulates and clamps at the end", () => {
  const f = fixture();
  f.update({ clientX: 250, clientY: 461 });
  for (let i = 0; i < 120; i++) f.frame();
  assert.ok(f.partition.scrollTop > 1000);
  assert.ok(f.partition.scrollTop < 1010);
  f.partition.scrollTop = 5499;
  f.update();
  for (let i = 0; i < 10; i++) f.frame();
  assert.equal(f.partition.scrollTop, 5500);
  assert.equal(f.callbacks.size, 0);
  f.scroller.stop();
});

test("horizontal drag and partition switching use separate positions and reset acceleration", () => {
  const f = fixture();
  f.update({ clientX: 499, clientY: 250 }, { horizontal: true });
  for (let i = 0; i < 60; i++) f.frame();
  assert.ok(f.partition.scrollLeft > 1100);
  assert.equal(f.partition.scrollTop, 1000);
  f.update(undefined, { element: f.pinned });
  f.frame();
  f.frame();
  assert.ok(f.pinned.scrollTop - 1000 <= 2);
  f.scroller.stop();
});

test("stop, invalid authority, hidden documents and detached targets restore only owned nodes", () => {
  for (const terminal of [
    (f) => f.scroller.stop(),
    (f) => f.deactivate(),
    (f) => {
      f.document.hidden = true;
    },
    (f) => {
      f.partition.isConnected = false;
    },
    (f) => f.update({ clientX: NaN, clientY: 499 }),
  ]) {
    const f = fixture();
    f.surface.setAttribute("data-fennevia-tab-scroll-owned", "previous");
    f.update();
    assert.equal(f.root.getAttribute("data-fennevia-tab-scroll-owned"), "");
    assert.equal(
      f.partition.getAttribute("data-fennevia-tab-scroll-owned"),
      null,
    );
    assert.equal(f.pinned.getAttribute("data-fennevia-tab-scroll-owned"), null);
    assert.equal(f.native.attributes.size, 0);
    terminal(f);
    f.frame();
    f.scroller.stop();
    assert.equal(f.callbacks.size, 0);
    assert.equal(f.root.attributes.size, 0);
    assert.equal(f.partition.attributes.size, 0);
    assert.equal(f.pinned.attributes.size, 0);
    assert.equal(
      f.surface.getAttribute("data-fennevia-tab-scroll-owned"),
      "previous",
    );
    assert.deepEqual(f.errors, []);
  }
});

test("frame failures restore scroll ownership before reporting the error", () => {
  const f = fixture();
  f.update();
  const error = new Error("test geometry failure");
  f.partition.getBoundingClientRect = () => {
    throw error;
  };
  f.frame();
  assert.deepEqual(f.errors, [error]);
  assert.equal(f.callbacks.size, 0);
  assert.equal(f.root.attributes.size, 0);
});
