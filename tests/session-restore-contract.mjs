const stateSchemaVersion = 1;

export const sessionRestoreStateFileName =
  ".fennevia-session-restore-rehearsal.json";

export const sessionRestoreModes = Object.freeze([
  "prepare",
  "verify",
  "fail-open",
  "cleanup",
]);

export const sessionRestorePreferenceSpecifications = Object.freeze([
  Object.freeze({ name: "browser.startup.page", type: "integer" }),
  Object.freeze({
    name: "browser.sessionstore.newTabOnRestore",
    type: "boolean",
  }),
  Object.freeze({
    name: "browser.sessionstore.newTabOnRestore.showSetting",
    type: "boolean",
  }),
  Object.freeze({
    name: "browser.sessionstore.restore_on_demand",
    type: "boolean",
  }),
  Object.freeze({
    name: "browser.sessionstore.restore_pinned_tabs_on_demand",
    type: "boolean",
  }),
  Object.freeze({
    name: "browser.sessionstore.restore_tabs_lazily",
    type: "boolean",
  }),
  Object.freeze({
    name: "browser.sessionstore.resume_session_once",
    type: "boolean",
  }),
]);

const allowedFixtureIds = new Set(["pinned", "selected", "lazy-a", "lazy-b"]);
const evidenceKeysByPhase = Object.freeze({
  prepared: Object.freeze([
    "active",
    "firstPartyScriptErrorCount",
    "fixtureCount",
    "frontendOrder",
    "hostCount",
    "managedWindowCount",
    "nativeOrder",
    "phase",
    "pinnedIds",
    "runtimeStartCount",
    "schemaVersion",
    "selectedId",
    "windowInitializedCount",
  ]),
  restored: Object.freeze([
    "active",
    "firstPartyScriptErrorCount",
    "fixtureCount",
    "frontendOrder",
    "hostCount",
    "managedWindowCount",
    "nativeOrder",
    "pendingIds",
    "phase",
    "pinnedIds",
    "revealObserved",
    "revealReleased",
    "runtimeStartCount",
    "schemaVersion",
    "selectedId",
    "windowInitializedCount",
  ]),
  "fail-open": Object.freeze([
    "active",
    "firstPartyScriptErrorCount",
    "fixtureCount",
    "frontendOrder",
    "hostCount",
    "managedWindowCount",
    "nativeOrder",
    "pendingActivated",
    "pendingIds",
    "phase",
    "pinnedIds",
    "runtimeStartCount",
    "schemaVersion",
    "selectedId",
    "selectionRestored",
    "shellFailureCount",
    "windowInitializedCount",
  ]),
  clean: Object.freeze([
    "active",
    "firstPartyScriptErrorCount",
    "fixtureCount",
    "hostCount",
    "managedWindowCount",
    "phase",
    "preferencesRestored",
    "runtimeStartCount",
    "schemaVersion",
    "stateRemoved",
    "windowInitializedCount",
  ]),
});

const createContractError = (code) => {
  const error = new Error(code);
  error.name = "FenneviaSessionRestoreContractError";
  return error;
};

const isPlainRecord = (value) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const hasExactKeys = (value, expectedKeys) => {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
};

const validatePreferenceSnapshot = (preferences) => {
  if (
    !Array.isArray(preferences) ||
    preferences.length !== sessionRestorePreferenceSpecifications.length
  ) {
    throw createContractError("FENNEVIA_SESSION_RESTORE_PREFERENCES_INVALID");
  }

  const copied = preferences.map((preference, index) => {
    const specification = sessionRestorePreferenceSpecifications[index];
    if (
      !isPlainRecord(preference) ||
      !hasExactKeys(preference, ["hadUserValue", "name", "type", "value"]) ||
      preference.name !== specification.name ||
      preference.type !== specification.type ||
      typeof preference.hadUserValue !== "boolean"
    ) {
      throw createContractError("FENNEVIA_SESSION_RESTORE_PREFERENCES_INVALID");
    }
    if (
      (specification.type === "boolean" &&
        typeof preference.value !== "boolean") ||
      (specification.type === "integer" &&
        (!Number.isSafeInteger(preference.value) ||
          preference.value < 0 ||
          preference.value > 9))
    ) {
      throw createContractError("FENNEVIA_SESSION_RESTORE_PREFERENCES_INVALID");
    }
    return Object.freeze({
      hadUserValue: preference.hadUserValue,
      name: specification.name,
      type: specification.type,
      value: preference.value,
    });
  });
  return Object.freeze(copied);
};

export function assertFreshSessionRestoreState(existingState) {
  if (existingState !== null) {
    throw createContractError("FENNEVIA_SESSION_RESTORE_STATE_STALE");
  }
  return true;
}

export function createSessionRestoreState(preferences) {
  return Object.freeze({
    owner: "fennevia",
    preferences: validatePreferenceSnapshot(preferences),
    purpose: "session-restore-rehearsal",
    schemaVersion: stateSchemaVersion,
  });
}

export function parseSessionRestoreState(serialized) {
  if (typeof serialized !== "string" || serialized.length > 16_384) {
    throw createContractError("FENNEVIA_SESSION_RESTORE_STATE_INVALID");
  }
  let candidate;
  try {
    candidate = JSON.parse(serialized);
  } catch {
    throw createContractError("FENNEVIA_SESSION_RESTORE_STATE_INVALID");
  }
  if (
    !isPlainRecord(candidate) ||
    !hasExactKeys(candidate, [
      "owner",
      "preferences",
      "purpose",
      "schemaVersion",
    ]) ||
    candidate.schemaVersion !== stateSchemaVersion ||
    candidate.owner !== "fennevia" ||
    candidate.purpose !== "session-restore-rehearsal"
  ) {
    throw createContractError("FENNEVIA_SESSION_RESTORE_STATE_INVALID");
  }
  return createSessionRestoreState(candidate.preferences);
}

export function assertPrivacySafeSessionRestoreEvidence(evidence) {
  if (!isPlainRecord(evidence) || typeof evidence.phase !== "string") {
    throw createContractError("FENNEVIA_SESSION_RESTORE_EVIDENCE_INVALID");
  }
  const expectedKeys = evidenceKeysByPhase[evidence.phase];
  if (
    !expectedKeys ||
    !hasExactKeys(evidence, expectedKeys) ||
    evidence.schemaVersion !== stateSchemaVersion
  ) {
    throw createContractError("FENNEVIA_SESSION_RESTORE_EVIDENCE_INVALID");
  }

  for (const [key, value] of Object.entries(evidence)) {
    if (key === "phase") {
      continue;
    }
    if (key === "selectedId") {
      if (typeof value !== "string" || !allowedFixtureIds.has(value)) {
        throw createContractError(
          "FENNEVIA_SESSION_RESTORE_EVIDENCE_SENSITIVE",
        );
      }
      continue;
    }
    if (typeof value === "boolean") {
      continue;
    }
    if (typeof value === "number") {
      if (!Number.isSafeInteger(value) || value < 0 || value > 100) {
        throw createContractError("FENNEVIA_SESSION_RESTORE_EVIDENCE_INVALID");
      }
      continue;
    }
    if (
      Array.isArray(value) &&
      value.length <= allowedFixtureIds.size &&
      new Set(value).size === value.length &&
      value.every(
        (item) => typeof item === "string" && allowedFixtureIds.has(item),
      )
    ) {
      continue;
    }
    throw createContractError("FENNEVIA_SESSION_RESTORE_EVIDENCE_SENSITIVE");
  }
  return evidence;
}
