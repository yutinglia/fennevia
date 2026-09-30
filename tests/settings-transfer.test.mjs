// SPDX-License-Identifier: MPL-2.0
import assert from "node:assert/strict";
import test from "node:test";
import { createSettingsFixture } from "./support/settings-transfer-fixture.mjs";
import {
  serializeSettingsFile,
  parseSettingsFile,
} from "../src/firefox/settings/model.ts";
import { createComposableCustomizeLayout } from "../src/firefox/customize-layout.ts";
import {
  applySettingsTransaction,
  captureSettingsPreferences,
} from "../src/firefox/settings/transaction.ts";

const request = (type) => ({ type, title: "Fennevia settings" });
const layoutWith = (ids, adopted = []) =>
  createComposableCustomizeLayout(
    {
      top: [
        { type: "item", target: { source: "project", id: "customize-shell" } },
        ...ids.map((id) => ({
          type: "item",
          target: { source: "firefox", id },
        })),
      ],
    },
    { adopted },
  );
const prepareFile = (f) =>
  f.files.set(f.selection.path, Buffer.from(serializeSettingsFile(f.settings)));

test("export writes a portable file without changing preferences or keeping temporary files", async () => {
  const f = createSettingsFixture();
  assert.deepEqual(await f.transfer.transfer(request("export")), {
    status: "exported",
  });
  assert.deepEqual([...f.files.keys()], [f.selection.path]);
  assert.deepEqual(
    parseSettingsFile(f.files.get(f.selection.path).toString()),
    f.settings,
  );
  assert.equal(f.writes.length, 0);
});

test("export requires explicit overwrite and cleans a failed temporary write", async () => {
  const f = createSettingsFixture();
  f.files.set(f.selection.path, Buffer.from("prior"));
  assert.deepEqual(await f.transfer.transfer(request("export")), {
    status: "failed",
  });
  assert.equal(f.files.get(f.selection.path).toString(), "prior");
  assert.equal(f.files.size, 1);
  f.selection.result = 2;
  assert.deepEqual(await f.transfer.transfer(request("export")), {
    status: "exported",
  });
  assert.equal(f.files.size, 1);
});

test("selecting a backup only prepares a summary; apply is explicit and single-use", async () => {
  const f = createSettingsFixture();
  prepareFile(f);
  const result = await f.transfer.transfer(request("prepare-import"));
  assert.equal(result.status, "ready");
  assert.ok(result.widgetCount > 0);
  assert.equal(f.writes.length, 0);
  assert.deepEqual(
    await f.transfer.transfer({ type: "apply-import", token: result.token }),
    { status: "imported" },
  );
  assert.equal(f.prefs.size, 3);
  assert.equal(f.changed, 1);
  assert.deepEqual(
    await f.transfer.transfer({ type: "apply-import", token: result.token }),
    { status: "changed" },
  );
});

test("file-picker cancel and preview cancel leave all settings intact", async () => {
  const f = createSettingsFixture();
  f.selection.result = 1;
  assert.deepEqual(await f.transfer.transfer(request("prepare-import")), {
    status: "cancelled",
  });
  f.selection.result = 0;
  prepareFile(f);
  const result = await f.transfer.transfer(request("prepare-import"));
  assert.deepEqual(await f.transfer.transfer({ type: "cancel" }), {
    status: "cancelled",
  });
  assert.deepEqual(
    await f.transfer.transfer({ type: "apply-import", token: result.token }),
    { status: "changed" },
  );
  assert.equal(f.writes.length, 0);
});

test("an edit in another window invalidates a prepared import", async () => {
  const f = createSettingsFixture();
  prepareFile(f);
  const result = await f.transfer.transfer(request("prepare-import"));
  f.prefs.set("fennevia.customize.style", "changed elsewhere");
  assert.deepEqual(
    await f.transfer.transfer({ type: "apply-import", token: result.token }),
    { status: "changed" },
  );
  assert.equal(f.writes.length, 0);
});

test("malformed UTF-8, invalid JSON, oversized input and unsupported versions never write", async () => {
  const f = createSettingsFixture();
  for (const [bytes, status] of [
    [Buffer.from([255]), "invalid"],
    [Buffer.from("{"), "invalid"],
    [Buffer.alloc(65537), "too-large"],
    [Buffer.from('{"format":"fennevia-settings","version":99}'), "unsupported"],
  ]) {
    f.files.set(f.selection.path, bytes);
    assert.deepEqual(await f.transfer.transfer(request("prepare-import")), {
      status,
    });
  }
  assert.equal(f.writes.length, 0);
});

test("missing widgets retain layout references without adopting or installing them", async () => {
  const f = createSettingsFixture();
  f.settings.layout = layoutWith(["missing-widget"]);
  prepareFile(f);
  const result = await f.transfer.transfer(request("prepare-import"));
  assert.equal(result.missingCount, 1);
  assert.equal(
    (await f.transfer.transfer({ type: "apply-import", token: result.token }))
      .status,
    "imported",
  );
  const saved = JSON.parse(f.prefs.get("fennevia.customize.layout"));
  assert.equal(saved.zones.top[1].target.id, "missing-widget");
  assert.deepEqual(saved.adopted, []);
  assert.equal(f.placements.length, 0);
});

test("XUL wrappers for arbitrary native DOM do not authorize adoption", async () => {
  const f = createSettingsFixture();
  f.settings.layout = layoutWith(["navigator-toolbox"]);
  prepareFile(f);
  const result = await f.transfer.transfer(request("prepare-import"));
  assert.equal(result.missingCount, 1);
  assert.equal(
    (await f.transfer.transfer({ type: "apply-import", token: result.token }))
      .status,
    "imported",
  );
  assert.equal(f.placements.length, 0);
});

test("asynchronous picker failure releases busy state without reading or writing", async () => {
  const f = createSettingsFixture();
  Object.defineProperty(f.selection, "path", {
    get() {
      throw new Error("DENIED");
    },
  });
  assert.deepEqual(await f.transfer.transfer(request("export")), {
    status: "failed",
  });
  assert.deepEqual(await f.transfer.transfer(request("export")), {
    status: "failed",
  });
  assert.equal(f.files.size, 0);
  assert.equal(f.writes.length, 0);
});

test("dispose during selection resolves cancellation and ignores a late native callback", async () => {
  const f = createSettingsFixture();
  f.autoPick = false;
  const pending = f.transfer.transfer(request("export"));
  assert.deepEqual(await f.transfer.transfer(request("export")), {
    status: "busy",
  });
  f.transfer.dispose();
  assert.deepEqual(await pending, { status: "cancelled" });
  f.pickerCallback(0);
  assert.equal(f.files.size, 0);
  assert.deepEqual(await f.transfer.transfer(request("export")), {
    status: "cancelled",
  });
});

test("dispose during file reading prevents a prepared import and later writes", async () => {
  const f = createSettingsFixture();
  prepareFile(f);
  let release;
  f.window.IOUtils.read = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const pending = f.transfer.transfer(request("prepare-import"));
  await new Promise((resolve) => setImmediate(resolve));
  f.transfer.dispose();
  release(Buffer.from(serializeSettingsFile(f.settings)));
  assert.deepEqual(await pending, { status: "cancelled" });
  assert.equal(f.writes.length, 0);
});

test("missing native capability reports unavailability without opening a file", async () => {
  const f = createSettingsFixture();
  delete f.window.Services.prefs.prefHasUserValue;
  assert.deepEqual(await f.transfer.transfer(request("export")), {
    status: "unavailable",
  });
  assert.equal(f.pickerCallback, null);
});

test("dispose during an export write removes its temporary file without replacing the destination", async () => {
  const f = createSettingsFixture();
  f.files.set(f.selection.path, Buffer.from("original"));
  f.selection.result = 2;
  const write = f.window.IOUtils.writeUTF8;
  let release;
  f.window.IOUtils.writeUTF8 = async (...args) => {
    await write(...args);
    if (args[2].mode === "overwrite")
      await new Promise((resolve) => {
        release = resolve;
      });
  };
  const pending = f.transfer.transfer(request("export"));
  await new Promise((resolve) => setImmediate(resolve));
  f.transfer.dispose();
  release();
  assert.deepEqual(await pending, { status: "cancelled" });
  assert.equal(f.files.size, 1);
  assert.equal(f.files.get(f.selection.path).toString(), "original");
});

test("native adoption is recomputed locally while retained ownership stays intact", () => {
  const f = createSettingsFixture();
  f.widgets = new Set(["owned", "removed-browser-action", "new", "placed"]);
  f.areas.set("nav-bar", ["owned", "removed-browser-action"]);
  f.areas.set("another-area", ["placed"]);
  const current = layoutWith(
    ["owned", "removed-browser-action"],
    ["owned", "removed-browser-action"],
  );
  const next = {
    ...f.settings,
    layout: layoutWith(["owned", "new", "placed", "missing"]),
  };
  assert.equal(
    applySettingsTransaction(
      f.store,
      next,
      current,
      captureSettingsPreferences(f.store),
    ),
    "imported",
  );
  assert.deepEqual(
    new Set(JSON.parse(f.prefs.get("fennevia.customize.layout")).adopted),
    new Set(["owned", "new"]),
  );
  assert.equal(
    f.store.placement("removed-browser-action").area,
    "unified-extensions-area",
  );
  assert.equal(f.store.placement("placed").area, "another-area");
});

test("partial preference failure restores user/default values and native sibling order", () => {
  const f = createSettingsFixture();
  f.widgets = new Set(["first", "second", "untouched", "new"]);
  f.areas.set("nav-bar", ["first", "second", "untouched"]);
  f.prefs.set("fennevia.customize.layout", "original value");
  const before = new Map(f.prefs);
  const current = layoutWith(["first", "second"], ["first", "second"]);
  let calls = 0;
  f.beforeWrite = () => {
    if (++calls === 2) throw new Error("WRITE_FAILED");
  };
  assert.equal(
    applySettingsTransaction(
      f.store,
      { ...f.settings, layout: layoutWith(["new"]) },
      current,
      captureSettingsPreferences(f.store),
    ),
    "failed",
  );
  assert.deepEqual(f.prefs, before);
  assert.deepEqual(f.areas.get("nav-bar"), ["first", "second", "untouched"]);
  assert.equal(f.store.placement("new"), null);
});

test("rollback failure is fatal instead of reporting that settings were preserved", () => {
  const f = createSettingsFixture();
  f.beforeWrite = () => {
    throw new Error("DENIED");
  };
  assert.throws(
    () =>
      applySettingsTransaction(
        f.store,
        f.settings,
        f.settings.layout,
        captureSettingsPreferences(f.store),
      ),
    /FENNEVIA_SETTINGS_ROLLBACK_FAILED/u,
  );
});
