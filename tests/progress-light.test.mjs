import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveDownloadProgressLight,
  resolveLoadProgressLight,
} from "../src/app/progress-light.ts";

test("load light stays idle unless the selected tab is loading", () => {
  assert.deepEqual(resolveLoadProgressLight(false), {
    kind: "load",
    mode: "idle",
    percent: null,
  });
  assert.deepEqual(resolveLoadProgressLight(true), {
    kind: "load",
    mode: "indeterminate",
    percent: null,
  });
});

test("download light uses anonymous aggregate state and hides when idle", () => {
  assert.deepEqual(resolveDownloadProgressLight(null), {
    kind: "download",
    mode: "idle",
    percent: null,
  });
  assert.deepEqual(
    resolveDownloadProgressLight({
      activeCount: 0,
      aggregatePercent: 40,
      progressMode: "determinate",
    }),
    {
      kind: "download",
      mode: "idle",
      percent: null,
    },
  );
  assert.deepEqual(
    resolveDownloadProgressLight({
      activeCount: 2,
      aggregatePercent: 41,
      progressMode: "determinate",
    }),
    {
      kind: "download",
      mode: "determinate",
      percent: 41,
    },
  );
  assert.deepEqual(
    resolveDownloadProgressLight({
      activeCount: 1,
      aggregatePercent: null,
      progressMode: "indeterminate",
    }),
    {
      kind: "download",
      mode: "indeterminate",
      percent: null,
    },
  );
  assert.deepEqual(
    resolveDownloadProgressLight({
      activeCount: 1,
      aggregatePercent: null,
      progressMode: "none",
    }),
    {
      kind: "download",
      mode: "indeterminate",
      percent: null,
    },
  );
});
