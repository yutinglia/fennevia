import assert from "node:assert/strict";
import test from "node:test";

import {
  browserToolActions,
  copyBrowserToolsSnapshot,
  createBrowserToolsStateAdapter,
  isBrowserToolAction,
} from "../src/app/browser-tools-state.ts";

const availableSnapshot = Object.freeze({
  applicationMenu: true,
  customize: true,
  downloads: true,
  extensions: true,
  nativeToolbar: true,
  protections: true,
  settings: true,
  siteInformation: true,
  sitePermissions: true,
});

test("browser tools state accepts only the fixed native handoff contract", () => {
  assert.deepEqual(browserToolActions, [
    "site-information",
    "protections",
    "site-permissions",
    "downloads",
    "extensions",
    "application-menu",
    "settings",
    "customize",
    "native-toolbar",
  ]);
  assert.ok(browserToolActions.every(isBrowserToolAction));
  assert.equal(isBrowserToolAction("arbitrary-widget"), false);

  const snapshot = copyBrowserToolsSnapshot(availableSnapshot);
  assert.deepEqual(snapshot, availableSnapshot);
  assert.ok(Object.isFrozen(snapshot));
  assert.deepEqual(Object.keys(snapshot).sort(), [
    "applicationMenu",
    "customize",
    "downloads",
    "extensions",
    "nativeToolbar",
    "protections",
    "settings",
    "siteInformation",
    "sitePermissions",
  ]);
  assert.doesNotMatch(
    JSON.stringify(snapshot),
    /extensionId|icon|label|nativeNode|url|widget/u,
  );
});

test("browser tools state rejects malformed snapshots and action results", async () => {
  assert.throws(
    () => copyBrowserToolsSnapshot({ ...availableSnapshot, downloads: "yes" }),
    /FENNEVIA_BROWSER_TOOLS_STATE_SNAPSHOT_INVALID/u,
  );

  const adapter = createBrowserToolsStateAdapter({
    async invoke() {
      return "true";
    },
    snapshot: () => availableSnapshot,
  });
  await assert.rejects(
    adapter.invoke("downloads"),
    /FENNEVIA_BROWSER_TOOLS_STATE_RESULT_INVALID/u,
  );
  await assert.rejects(
    adapter.invoke("arbitrary-widget"),
    /FENNEVIA_BROWSER_TOOLS_STATE_ACTION_INVALID/u,
  );
});

test("browser tools adapter forwards fixed actions and disposes idempotently", async () => {
  const calls = [];
  const adapter = createBrowserToolsStateAdapter({
    async invoke(action) {
      calls.push(action);
      return true;
    },
    snapshot: () => availableSnapshot,
  });

  for (const action of browserToolActions) {
    assert.equal(await adapter.invoke(action), true);
  }
  assert.deepEqual(calls, browserToolActions);
  assert.deepEqual(adapter.snapshot(), availableSnapshot);
  assert.equal(adapter.status().disposed, false);
  assert.equal(adapter.dispose(), true);
  assert.equal(adapter.dispose(), false);
  assert.equal(adapter.status().disposed, true);
  assert.throws(
    () => adapter.snapshot(),
    /FENNEVIA_BROWSER_TOOLS_STATE_DISPOSED/u,
  );
  await assert.rejects(
    adapter.invoke("settings"),
    /FENNEVIA_BROWSER_TOOLS_STATE_DISPOSED/u,
  );
});
