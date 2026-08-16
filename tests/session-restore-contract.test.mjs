import assert from "node:assert/strict";
import test from "node:test";

import {
  assertFreshSessionRestoreState,
  assertPrivacySafeSessionRestoreEvidence,
  createSessionRestoreState,
  parseSessionRestoreState,
  sessionRestorePreferenceSpecifications,
} from "./session-restore-contract.mjs";

const preferenceSnapshot = () =>
  sessionRestorePreferenceSpecifications.map((specification, index) => ({
    hadUserValue: index % 2 === 0,
    name: specification.name,
    type: specification.type,
    value: specification.type === "boolean" ? index % 2 === 0 : 1,
  }));

test("session-restore state accepts only the fixed preference allowlist", () => {
  const state = createSessionRestoreState(preferenceSnapshot());
  assert.deepEqual(parseSessionRestoreState(JSON.stringify(state)), state);

  for (const sensitiveField of [
    "url",
    "title",
    "history",
    "profilePath",
    "sessionStore",
    "tabs",
  ]) {
    assert.throws(
      () =>
        parseSessionRestoreState(
          JSON.stringify({ ...state, [sensitiveField]: "sensitive" }),
        ),
      /FENNEVIA_SESSION_RESTORE_STATE_INVALID/u,
    );
  }

  const changedPreference = JSON.parse(JSON.stringify(state));
  changedPreference.preferences[0].name = "browser.unreviewed.preference";
  assert.throws(
    () => parseSessionRestoreState(JSON.stringify(changedPreference)),
    /FENNEVIA_SESSION_RESTORE_PREFERENCES_INVALID/u,
  );
});

test("session-restore preparation rejects a stale rehearsal marker", () => {
  assert.equal(assertFreshSessionRestoreState(null), true);
  assert.throws(
    () => assertFreshSessionRestoreState("{}"),
    /FENNEVIA_SESSION_RESTORE_STATE_STALE/u,
  );
});

test("session-restore shared evidence permits only fixed IDs and primitives", () => {
  const evidence = {
    active: true,
    firstPartyScriptErrorCount: 0,
    fixtureCount: 4,
    frontendOrder: ["pinned", "selected", "lazy-a", "lazy-b"],
    hostCount: 6,
    managedWindowCount: 1,
    nativeOrder: ["pinned", "selected", "lazy-a", "lazy-b"],
    pendingIds: ["pinned", "lazy-a", "lazy-b"],
    phase: "restored",
    pinnedIds: ["pinned"],
    revealObserved: true,
    revealReleased: true,
    runtimeStartCount: 1,
    schemaVersion: 1,
    selectedId: "selected",
    windowInitializedCount: 1,
  };
  assert.equal(assertPrivacySafeSessionRestoreEvidence(evidence), evidence);

  for (const unsafeEvidence of [
    { ...evidence, url: "data:text/html,fixture" },
    { ...evidence, selectedId: "A page title" },
    { ...evidence, selectedId: "restored" },
    { ...evidence, rawState: { windows: [] } },
    { ...evidence, nativeOrder: ["pinned", "unknown"] },
    {
      ...evidence,
      nativeOrder: ["pinned", "selected", "lazy-a", "lazy-b", "pinned"],
    },
  ]) {
    assert.throws(
      () => assertPrivacySafeSessionRestoreEvidence(unsafeEvidence),
      /FENNEVIA_SESSION_RESTORE_EVIDENCE_/u,
    );
  }
});
