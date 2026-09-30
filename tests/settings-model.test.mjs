// SPDX-License-Identifier: MPL-2.0
import assert from "node:assert/strict";
import test from "node:test";
import { createSettingsFixture } from "./support/settings-transfer-fixture.mjs";
import {
  parseSettingsFile,
  serializeSettingsFile,
  settingsFileMaxBytes,
} from "../src/firefox/settings/model.ts";
import {
  copySettingsTransferRequest,
  copySettingsTransferResult,
} from "../src/app/settings-transfer.ts";

test("portable settings round-trip every current layout, panel and style field", () => {
  const f = createSettingsFixture();
  const settings = {
    ...f.settings,
    style: {
      ...f.settings.style,
      theme: "dark",
      autoHideDelay: 900,
      windowLeaveHideDelay: 1300,
      accent: "#123456",
      blur: 12,
    },
    panels: {
      ...f.settings.panels,
      rightPanelEnabled: false,
      allowCompactWindow: true,
    },
  };
  const file = serializeSettingsFile(settings);
  assert.deepEqual(parseSettingsFile(file), settings);
  assert.deepEqual(parseSettingsFile("\uFEFF" + file), settings);
  assert.equal(JSON.parse(file).format, "fennevia-settings");
});

test("portable input rejects malformed, foreign, unknown and oversized files", () => {
  const value = JSON.parse(
    serializeSettingsFile(createSettingsFixture().settings),
  );
  for (const invalid of [
    "{",
    "null",
    "[]",
    JSON.stringify({ ...value, format: "other" }),
    JSON.stringify({ ...value, prefs: {} }),
    JSON.stringify({ ...value, layout: null }),
    JSON.stringify({ ...value, style: { version: 1, blur: -1 } }),
    JSON.stringify({
      ...value,
      panels: { version: 3, rightPanelEnabled: "yes" },
    }),
  ]) {
    assert.throws(
      () => parseSettingsFile(invalid),
      (error) => error.status === "invalid",
    );
  }
  assert.throws(
    () => parseSettingsFile(JSON.stringify({ ...value, version: 99 })),
    (error) => error.status === "unsupported",
  );
  assert.throws(
    () => parseSettingsFile(" ".repeat(settingsFileMaxBytes + 1)),
    (error) => error.status === "too-large",
  );
  assert.throws(
    () => parseSettingsFile("界".repeat(24000)),
    (error) => error.status === "too-large",
  );
});

test("imports cannot disable the only configured Customize access path", () => {
  const value = JSON.parse(
    serializeSettingsFile(createSettingsFixture().settings),
  );
  const index = value.layout.zones.top.findIndex(
    (node) => node.target?.id === "customize-shell",
  );
  value.layout.zones.right.push(value.layout.zones.top.splice(index, 1)[0]);
  value.panels.rightPanelEnabled = false;
  assert.throws(
    () => parseSettingsFile(JSON.stringify(value)),
    (error) => error.status === "invalid",
  );
});

test("a portable file never conveys adopted-widget ownership", () => {
  const f = createSettingsFixture();
  const value = JSON.parse(serializeSettingsFile(f.settings));
  value.layout.adopted = ["foreign-widget"];
  assert.deepEqual(parseSettingsFile(JSON.stringify(value)).layout.adopted, []);
  assert.deepEqual(
    JSON.parse(
      serializeSettingsFile({
        ...f.settings,
        layout: { ...f.settings.layout, adopted: ["foreign-widget"] },
      }),
    ).layout.adopted,
    [],
  );
});

test("the app contract accepts only bounded requests and strips non-public result fields", () => {
  const token = "settings-import-12345678-1234-1234-1234-123456789abc";
  assert.deepEqual(
    copySettingsTransferRequest({
      type: "export",
      title: "Export",
      path: "secret",
    }),
    { type: "export", title: "Export" },
  );
  assert.deepEqual(copySettingsTransferRequest({ type: "cancel" }), {
    type: "cancel",
  });
  assert.deepEqual(
    copySettingsTransferRequest({ type: "apply-import", token }),
    { type: "apply-import", token },
  );
  assert.deepEqual(
    copySettingsTransferResult({
      status: "ready",
      token,
      widgetCount: 12,
      missingCount: 1,
      path: "secret",
      content: "secret",
    }),
    { status: "ready", token, widgetCount: 12, missingCount: 1 },
  );
  assert.deepEqual(
    copySettingsTransferResult({ status: "imported", raw: "secret" }),
    { status: "imported" },
  );
  for (const request of [
    null,
    { type: "other" },
    { type: "export", title: "x".repeat(121) },
    { type: "apply-import", token: "foreign" },
  ])
    assert.throws(() => copySettingsTransferRequest(request));
  for (const result of [
    null,
    { status: "other" },
    { status: "ready", token, widgetCount: 2, missingCount: 3 },
  ])
    assert.throws(() => copySettingsTransferResult(result));
});
