// SPDX-License-Identifier: MPL-2.0
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setImmediate as nextTurn } from "node:timers/promises";
import test from "node:test";
import {
  copyLocalExtensionRequest,
  copyLocalExtensionsSnapshot,
} from "../src/app/local-extensions.ts";
import {
  archiveName,
  limits,
  LocalExtensionError,
  parseMetadata,
  parseRegistry,
  sameMetadata,
} from "../src/firefox/local-extensions/model.ts";
import { createLocalExtensionService } from "../src/firefox/local-extensions/service.ts";

const metadata = {
  id: "fixture@example.invalid",
  name: "Fixture",
  version: "1.0",
  required: ["permission:storage"],
  optional: ["permission:bookmarks"],
};
function fixture(initial = null) {
  let raw = initial;
  let enabled = true;
  let listener = null;
  let serial = 0;
  const addons = new Map();
  const payloads = new Map();
  const calls = [];
  const errors = [];
  const port = {
    uuid: randomUUID,
    ready: async () => {},
    allowed: () => true,
    enabled: () => enabled,
    setEnabled: (value) => {
      enabled = value;
    },
    read: async () => raw,
    write: async (text, expected) => {
      assert.equal(expected, raw);
      raw = text;
      calls.push("write");
    },
    choose: async () => "selected",
    stage: async (_source, _kind, key) => {
      const payload = {
        key: key ?? randomUUID(),
        generation: randomUUID(),
        kind: "folder",
        digest: "a".repeat(64),
      };
      payloads.set(payload.generation, payload);
      calls.push("stage");
      return payload;
    },
    inspect: async () => ({ ...metadata }),
    verify: async () => {},
    remove: async (payload) => {
      calls.push("remove");
      payloads.delete(payload.generation);
    },
    uri: (payload) => "file:///managed/" + payload.generation,
    get: async (id) => addons.get(id) ?? null,
    install: async (payload) => {
      const addon = {
        id: metadata.id,
        temporarilyInstalled: true,
        sourceURI: { spec: port.uri(payload) },
        userDisabled: false,
        isActive: true,
        appDisabled: false,
        enable: async () => {
          calls.push("enable");
          addon.userDisabled = false;
          listener?.("enabled", addon);
        },
        disable: async () => {
          calls.push("disable");
          addon.userDisabled = true;
          listener?.("disabled", addon);
        },
        reload: async () => {},
        uninstall: async () => {
          calls.push("uninstall");
          addons.delete(addon.id);
          listener?.("removed", addon);
        },
      };
      calls.push("install");
      listener?.("installing", addon);
      addons.set(addon.id, addon);
      listener?.("installed", addon);
      serial++;
      return addon;
    },
    listen: (fn) => {
      listener = fn;
      return () => {
        listener = null;
        calls.push("unlisten");
      };
    },
    open: (_window, target) => calls.push(target),
  };
  const service = createLocalExtensionService(port, (error) =>
    errors.push(error),
  );
  const abort = new AbortController();
  const bridge = service.session({}, false, abort.signal);
  const ready = async () => {
    for (
      let i = 0;
      i < 20 &&
      (bridge.snapshot().status === "starting" || bridge.snapshot().busy);
      i++
    )
      await nextTurn();
  };
  const add = async () => {
    const preview = await bridge.request({
      type: "prepare",
      source: "folder",
      title: "Add",
    });
    assert.equal(preview.status, "preview");
    return bridge.request({ type: "confirm", token: preview.token });
  };
  return {
    port,
    service,
    bridge,
    abort,
    ready,
    add,
    addons,
    payloads,
    calls,
    errors,
    get raw() {
      return raw;
    },
    get installs() {
      return serial;
    },
    emit: (event, addon) => listener?.(event, addon),
  };
}

test("registry rejects malformed state, duplicate identities, arbitrary paths and bounds", () => {
  assert.deepEqual(parseRegistry(null), {
    version: 1,
    revision: 0,
    entries: [],
  });
  for (const text of [
    "{",
    JSON.stringify({ version: 2 }),
    "x".repeat(limits.registry + 1),
  ])
    assert.throws(() => parseRegistry(text));
  const entry = {
    ...metadata,
    payload: {
      key: randomUUID(),
      generation: randomUUID(),
      kind: "folder",
      digest: "a".repeat(64),
    },
    enabled: true,
    interrupted: false,
  };
  const value = { version: 1, revision: 1, entries: [entry] };
  assert.deepEqual(parseRegistry(JSON.stringify(value)), value);
  assert.throws(() =>
    parseRegistry(JSON.stringify({ ...value, entries: [entry, entry] })),
  );
  assert.throws(() =>
    parseRegistry(
      JSON.stringify({
        ...value,
        entries: [
          { ...entry, payload: { ...entry.payload, key: "../../outside" } },
        ],
      }),
    ),
  );
  assert.throws(() => parseMetadata({ ...metadata, id: "missing" }));
  assert.throws(() => parseMetadata({ ...metadata, name: "unsafe\nname" }));
  assert.equal(
    sameMetadata(metadata, { ...metadata, optional: ["permission:history"] }),
    false,
  );
});
test("archive names reject traversal, ambiguous names and deep trees", () => {
  assert.equal(archiveName("scripts/main.js"), "scripts/main.js");
  for (const name of [
    "../a",
    "/a",
    "a/../b",
    "C:/a",
    "a\\b",
    "a//b",
    "a. /b",
    "a/./b",
    "x/".repeat(20) + "a",
  ])
    assert.throws(() => archiveName(name));
});
test("bridge copies bounded ordinary rows and validates action discriminators", () => {
  const value = {
    status: "ready",
    enabled: true,
    busy: false,
    rows: [
      {
        token: "row",
        name: "name",
        version: "1",
        enabled: true,
        state: "loaded",
      },
    ],
  };
  const copy = copyLocalExtensionsSnapshot(value);
  value.rows[0].name = "changed";
  assert.equal(copy.rows[0].name, "name");
  assert.ok(Object.isFrozen(copy.rows));
  assert.throws(() =>
    copyLocalExtensionRequest({ type: "arbitrary", token: "row" }),
  );
  assert.throws(() =>
    copyLocalExtensionRequest({ type: "prepare", source: "url", title: "Add" }),
  );
  assert.deepEqual(
    copyLocalExtensionRequest({
      type: "remove",
      token: "row",
      path: "ignored",
    }),
    { type: "remove", token: "row" },
  );
});
test("prepare is non-executing; cancel removes only staged payload", async () => {
  const f = fixture();
  await f.ready();
  const preview = await f.bridge.request({
    type: "prepare",
    source: "folder",
    title: "Add",
  });
  assert.equal(preview.status, "preview");
  assert.equal(f.raw, null);
  assert.equal(f.installs, 0);
  assert.equal(
    (await f.bridge.request({ type: "cancel" })).status,
    "cancelled",
  );
  assert.equal(f.payloads.size, 0);
  await f.service.stop();
});
test("add, disable, enable, local update and removal maintain intent without uninstalling on disable", async () => {
  const f = fixture();
  await f.ready();
  assert.equal((await f.add()).status, "done");
  let row = f.bridge.snapshot().rows[0];
  assert.equal(row.state, "loaded");
  assert.equal(parseRegistry(f.raw).entries[0].interrupted, false);
  const stale = row.token;
  assert.equal(
    (await f.bridge.request({ type: "disable", token: row.token })).status,
    "done",
  );
  assert.ok(!f.calls.includes("uninstall"));
  assert.equal(parseRegistry(f.raw).entries[0].enabled, false);
  assert.equal(
    (await f.bridge.request({ type: "enable", token: stale })).status,
    "changed",
  );
  row = f.bridge.snapshot().rows[0];
  assert.equal(
    (await f.bridge.request({ type: "enable", token: row.token })).status,
    "done",
  );
  row = f.bridge.snapshot().rows[0];
  const preview = await f.bridge.request({
    type: "prepare",
    source: "file",
    title: "Update",
    token: row.token,
  });
  assert.equal(preview.status, "preview");
  assert.equal(preview.update, true);
  assert.equal(
    (await f.bridge.request({ type: "confirm", token: preview.token })).status,
    "done",
  );
  assert.equal(f.payloads.size, 1);
  row = f.bridge.snapshot().rows[0];
  assert.equal(
    (await f.bridge.request({ type: "remove", token: row.token })).status,
    "done",
  );
  assert.equal(f.bridge.snapshot().rows.length, 0);
  assert.ok(f.calls.includes("uninstall"));
  await f.service.stop();
});
test("known foreign installation is rejected without any mutation", async () => {
  const f = fixture();
  await f.ready();
  const foreign = {
    id: metadata.id,
    temporarilyInstalled: false,
    sourceURI: { spec: "foreign" },
  };
  f.addons.set(metadata.id, foreign);
  assert.equal(
    (await f.bridge.request({ type: "prepare", source: "file", title: "Add" }))
      .status,
    "conflict",
  );
  assert.equal(f.installs, 0);
  assert.equal(f.addons.get(metadata.id), foreign);
  assert.equal(f.payloads.size, 0);
  await f.service.stop();
});
test("observed concurrent foreign install disables only our returned result and stops retry intent", async () => {
  const f = fixture();
  await f.ready();
  const install = f.port.install;
  f.port.install = async (payload) => {
    f.emit("installing", { id: metadata.id, sourceURI: { spec: "foreign" } });
    return install(payload);
  };
  assert.equal((await f.add()).status, "conflict");
  assert.ok(f.calls.includes("disable"));
  assert.ok(!f.calls.includes("uninstall"));
  assert.equal(parseRegistry(f.raw).entries[0].enabled, false);
  assert.equal(f.bridge.snapshot().rows[0].state, "conflict");
  await f.service.stop();
});
test("late completion after window close is disabled without reviving disposed session", async () => {
  const f = fixture();
  await f.ready();
  const preview = await f.bridge.request({
    type: "prepare",
    source: "file",
    title: "Add",
  });
  const install = f.port.install;
  let release;
  const paused = new Promise((resolve) => {
    release = resolve;
  });
  let entered;
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  f.port.install = async (payload) => {
    entered();
    await paused;
    return install(payload);
  };
  const result = f.bridge.request({ type: "confirm", token: preview.token });
  await started;
  f.abort.abort();
  release();
  assert.equal((await result).status, "cancelled");
  assert.ok(f.calls.includes("disable"));
  assert.deepEqual(f.bridge.snapshot().rows, []);
  await f.service.stop();
});
test("startup restoration is process-wide, skips interrupted entries and respects private-only startup", async () => {
  const first = fixture();
  await first.ready();
  await first.add();
  const saved = first.raw;
  await first.service.stop(true);
  assert.ok(!first.calls.includes("disable"));
  const second = fixture(saved);
  await second.ready();
  assert.equal(second.installs, 1);
  second.service.session({}, false, new AbortController().signal);
  await nextTurn();
  assert.equal(second.installs, 1);
  await second.service.stop(true);
  const parsed = parseRegistry(saved);
  const interrupted = fixture(
    JSON.stringify({
      ...parsed,
      entries: parsed.entries.map((entry) => ({ ...entry, interrupted: true })),
    }),
  );
  await interrupted.ready();
  assert.equal(interrupted.installs, 0);
  assert.equal(interrupted.bridge.snapshot().rows[0].state, "interrupted");
  await interrupted.service.stop();
  const privateFixture = fixture();
  await privateFixture.ready();
  const privateBridge = privateFixture.service.session(
    {},
    true,
    new AbortController().signal,
  );
  assert.equal(privateBridge.snapshot().status, "private");
  assert.deepEqual(privateBridge.snapshot().rows, []);
  assert.equal(
    (
      await privateBridge.request({
        type: "prepare",
        source: "file",
        title: "Add",
      })
    ).status,
    "unavailable",
  );
  await privateFixture.service.stop();
});
test("native disable persists intent and invalidates another window's preview", async () => {
  const f = fixture();
  await f.ready();
  await f.add();
  const row = f.bridge.snapshot().rows[0];
  const preview = await f.bridge.request({
    type: "prepare",
    source: "folder",
    title: "Update",
    token: row.token,
  });
  const native = f.addons.get(metadata.id);
  native.userDisabled = true;
  f.emit("disabled", native);
  await nextTurn();
  await nextTurn();
  assert.equal(parseRegistry(f.raw).entries[0].enabled, false);
  assert.equal(
    (await f.bridge.request({ type: "confirm", token: preview.token })).status,
    "changed",
  );
  await f.service.stop();
});
test("corrupt registry and failed checkpoint writes prevent installation", async () => {
  const corrupt = fixture("{");
  await corrupt.ready();
  assert.equal(corrupt.bridge.snapshot().status, "recovery");
  assert.equal(corrupt.raw, "{");
  await corrupt.service.stop();
  const f = fixture();
  await f.ready();
  f.port.write = async () => {
    throw new LocalExtensionError("changed");
  };
  assert.equal((await f.add()).status, "changed");
  assert.equal(f.installs, 0);
  assert.equal(f.payloads.size, 0);
  await f.service.stop();
});
test("disable-all changes saved intent; explicit runtime stop disables only owned addons", async () => {
  const f = fixture();
  await f.ready();
  await f.add();
  assert.equal(
    (await f.bridge.request({ type: "disable-all" })).status,
    "done",
  );
  assert.equal(f.port.enabled(), false);
  assert.equal(parseRegistry(f.raw).entries[0].enabled, false);
  assert.equal(
    (await f.bridge.request({ type: "open-addons" })).status,
    "done",
  );
  await f.service.stop();
  assert.ok(f.calls.includes("unlisten"));
});

test("failed local update retains old generation and bounded pending copy until retry", async () => {
  const f = fixture();
  await f.ready();
  await f.add();
  const old = parseRegistry(f.raw).entries[0];
  const preview = await f.bridge.request({
    type: "prepare",
    source: "file",
    title: "Update",
    token: f.bridge.snapshot().rows[0].token,
  });
  const install = f.port.install;
  f.port.install = async () => {
    throw new LocalExtensionError("failed");
  };
  assert.equal(
    (await f.bridge.request({ type: "confirm", token: preview.token })).status,
    "failed",
  );
  const failed = parseRegistry(f.raw).entries[0];
  assert.deepEqual(failed.payload, old.payload);
  assert.ok(failed.pending);
  assert.equal(failed.enabled, false);
  assert.equal(failed.interrupted, true);
  assert.equal(
    (
      await f.bridge.request({
        type: "prepare",
        source: "file",
        title: "Update",
        token: f.bridge.snapshot().rows[0].token,
      })
    ).status,
    "interrupted",
  );
  f.port.install = install;
  assert.equal(
    (
      await f.bridge.request({
        type: "enable",
        token: f.bridge.snapshot().rows[0].token,
      })
    ).status,
    "done",
  );
  assert.equal(parseRegistry(f.raw).entries[0].pending, undefined);
  assert.equal(f.payloads.size, 1);
  await f.service.stop();
});
test("payload drift before enable is rejected and removes startup consent", async () => {
  const f = fixture();
  await f.ready();
  await f.add();
  const installs = f.installs;
  f.port.inspect = async () => ({ ...metadata, required: ["site:<all_urls>"] });
  assert.equal(
    (
      await f.bridge.request({
        type: "reload",
        token: f.bridge.snapshot().rows[0].token,
      })
    ).status,
    "changed",
  );
  assert.equal(f.installs, installs);
  assert.equal(parseRegistry(f.raw).entries[0].enabled, false);
  assert.equal(f.bridge.snapshot().rows[0].state, "corrupt");
  await f.service.stop();
});
test("closing pending native picker aborts selection and drains process cleanup", async () => {
  const f = fixture();
  await f.ready();
  let entered;
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  f.port.choose = async (_window, _source, _title, signal) =>
    new Promise((resolve) => {
      signal.addEventListener("abort", () => resolve(null), { once: true });
      entered();
    });
  const request = f.bridge.request({
    type: "prepare",
    source: "file",
    title: "Add",
  });
  await started;
  f.abort.abort();
  assert.equal((await request).status, "cancelled");
  await f.service.stop();
  assert.equal(f.installs, 0);
  assert.equal(f.payloads.size, 0);
});
test("foreign replacement during native completion is never disabled or uninstalled", async () => {
  const f = fixture();
  await f.ready();
  const install = f.port.install;
  let foreignDisabled = false;
  f.port.install = async (payload) => {
    const ours = await install(payload);
    const foreign = {
      id: metadata.id,
      sourceURI: { spec: "foreign" },
      disable: async () => {
        foreignDisabled = true;
      },
    };
    f.addons.set(metadata.id, foreign);
    f.emit("installed", foreign);
    return ours;
  };
  assert.equal((await f.add()).status, "conflict");
  await f.service.stop();
  assert.equal(foreignDisabled, false);
  assert.ok(!f.calls.includes("uninstall"));
});

test("native app-disabled result is a failure without automatic restart consent", async () => {
  const f = fixture();
  await f.ready();
  const install = f.port.install;
  f.port.install = async (payload) => {
    const addon = await install(payload);
    addon.appDisabled = true;
    return addon;
  };
  assert.equal((await f.add()).status, "incompatible");
  assert.equal(parseRegistry(f.raw).entries[0].enabled, false);
  assert.ok(f.calls.includes("disable"));
  await f.service.stop();
});
test("remove rechecks ownership after the asynchronous intent checkpoint", async () => {
  const f = fixture();
  await f.ready();
  await f.add();
  const write = f.port.write;
  let touched = false;
  f.port.write = async (text, expected) => {
    await write(text, expected);
    const foreign = {
      id: metadata.id,
      sourceURI: { spec: "foreign" },
      uninstall: async () => {
        touched = true;
      },
      disable: async () => {
        touched = true;
      },
    };
    f.addons.set(metadata.id, foreign);
    f.emit("installing", foreign);
  };
  assert.equal(
    (
      await f.bridge.request({
        type: "remove",
        token: f.bridge.snapshot().rows[0].token,
      })
    ).status,
    "conflict",
  );
  await f.service.stop();
  assert.equal(touched, false);
  assert.equal(f.payloads.size, 1);
});
