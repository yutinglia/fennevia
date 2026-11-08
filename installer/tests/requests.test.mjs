// SPDX-License-Identifier: MPL-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { Requests } from "../ui/requests.ts";

test("late completion cannot replace the new target or clear its busy state", async () => {
  const gate = new Requests();
  const first = Promise.withResolvers();
  const second = Promise.withResolvers();
  const values = [];
  const failures = [];
  const pending = gate.run(
    () => first.promise,
    (v) => values.push(v),
    (e) => failures.push(e),
  );
  gate.cancel();
  const latest = gate.run(
    () => second.promise,
    (v) => values.push(v),
    (e) => failures.push(e),
  );
  first.resolve("old");
  await pending;
  assert.equal(gate.busy, true);
  assert.deepEqual(values, []);
  second.resolve("new");
  await latest;
  assert.deepEqual(values, ["new"]);
  assert.deepEqual(failures, []);
});
test("duplicate requests are suppressed and errors cannot expose arbitrary text", async () => {
  const gate = new Requests();
  const task = Promise.withResolvers();
  const failures = [];
  const pending = gate.run(
    () => task.promise,
    () => {},
    (e) => failures.push(e),
  );
  let called = false;
  await gate.run(
    async () => {
      called = true;
    },
    () => {},
    () => {},
  );
  assert.equal(called, false);
  task.reject(new Error("a private local path"));
  await pending;
  assert.deepEqual(failures, ["UNEXPECTED"]);
  assert.equal(gate.busy, false);
  await gate.run(
    async () => {
      throw "STALE";
    },
    () => {},
    (e) => failures.push(e),
  );
  assert.deepEqual(failures, ["UNEXPECTED", "STALE"]);
});
