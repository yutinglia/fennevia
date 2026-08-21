import assert from "node:assert/strict";
import test from "node:test";

import {
  getFirefoxTrustPresentation,
  resolveFirefoxTrustIconState,
} from "../src/shell/navigation-labels.ts";

test("Firefox Trust icon state follows the native secure, insecure, inactive, and warning priorities", () => {
  const blockingStates = new Map([
    ["associated", "insecure"],
    ["certificate-error", "insecure"],
    ["extension", "active"],
    ["https-only-error", "insecure"],
    ["internal", "active"],
    ["local", "active"],
    ["network-error", "warning"],
    ["not-secure", "insecure"],
    ["secure", "active"],
    ["secure-certificate-override", "warning"],
    ["secure-qualified-certificate", "active"],
    ["secure-verified-organization", "active"],
    ["unavailable", "disabled"],
  ]);

  for (const [connection, expected] of blockingStates) {
    assert.equal(
      resolveFirefoxTrustIconState(connection, "blocking"),
      expected,
    );
  }

  assert.equal(resolveFirefoxTrustIconState("secure", "exception"), "disabled");
  assert.equal(
    resolveFirefoxTrustIconState("not-secure", "exception"),
    "insecure",
  );
  assert.equal(
    resolveFirefoxTrustIconState("certificate-error", "exception"),
    "insecure",
  );
});

test("Firefox Trust presentation combines connection and protection text without exposing native details", () => {
  const english = getFirefoxTrustPresentation("secure", "blocking", "en");
  assert.deepEqual(english, {
    connectionLabel: "Secure connection",
    iconState: "active",
    label:
      "Secure connection · Enhanced Tracking Protection is blocking known trackers",
    protectionLabel: "Enhanced Tracking Protection is blocking known trackers",
    tone: "positive",
  });
  assert.equal(Object.isFrozen(english), true);

  const traditionalChinese = getFirefoxTrustPresentation(
    "not-secure",
    "exception",
    "zh-Hant",
  );
  assert.equal(traditionalChinese.iconState, "insecure");
  assert.equal(traditionalChinese.tone, "warning");
  assert.match(traditionalChinese.label, /連線不安全/u);
  assert.match(traditionalChinese.label, /已為此網站停用加強型追蹤保護/u);
});
