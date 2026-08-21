import assert from "node:assert/strict";
import test from "node:test";

import {
  browserToolActions,
  copyBrowserToolsSnapshot,
  createBrowserToolsStateAdapter,
  isBrowserToolAction,
  isPopupBrowserToolAction,
  popupBrowserToolActions,
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
  translate: true,
});

test("browser tools state accepts only the fixed native handoff contract", () => {
  assert.deepEqual(browserToolActions, [
    "site-information",
    "protections",
    "site-permissions",
    "downloads",
    "extensions",
    "translate",
    "application-menu",
    "settings",
    "customize",
    "native-toolbar",
  ]);
  assert.ok(browserToolActions.every(isBrowserToolAction));
  assert.equal(isBrowserToolAction("arbitrary-widget"), false);
  assert.deepEqual(popupBrowserToolActions, [
    "site-information",
    "protections",
    "site-permissions",
    "downloads",
    "extensions",
    "translate",
    "application-menu",
  ]);
  assert.ok(popupBrowserToolActions.every(isPopupBrowserToolAction));
  assert.equal(isPopupBrowserToolAction("settings"), false);

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
    "translate",
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
    subscribe() {
      return () => true;
    },
  });
  await assert.rejects(
    adapter.invoke("settings"),
    /FENNEVIA_BROWSER_TOOLS_STATE_RESULT_INVALID/u,
  );
  await assert.rejects(
    adapter.invoke("arbitrary-widget"),
    /FENNEVIA_BROWSER_TOOLS_STATE_ACTION_INVALID/u,
  );
  await assert.rejects(
    adapter.invoke("downloads"),
    /FENNEVIA_BROWSER_TOOLS_STATE_HOST_INVALID/u,
  );
});

test("browser tools adapter forwards fixed actions, popup hosts, and popup holds", async () => {
  const calls = [];
  const popupEvents = [];
  let publish;
  const adapter = createBrowserToolsStateAdapter({
    async invoke(action, host, triggerEvent) {
      calls.push([action, host, triggerEvent]);
      return true;
    },
    snapshot: () => availableSnapshot,
    subscribe(listener) {
      publish = listener;
      let active = true;
      return () => {
        if (!active) {
          return false;
        }
        active = false;
        return true;
      };
    },
  });
  const host = {};
  const triggerEvent = {};
  const unsubscribe = adapter.subscribePopup((open) => {
    popupEvents.push(open);
  });

  for (const action of browserToolActions) {
    const extra = isPopupBrowserToolAction(action) ? host : undefined;
    assert.equal(
      await adapter.invoke(
        action,
        extra,
        action === "translate" ? triggerEvent : undefined,
      ),
      true,
    );
  }
  assert.deepEqual(
    calls.map((call) => call[0]),
    browserToolActions,
  );
  assert.equal(
    calls.filter((call) => call[0] === "downloads" && call[1] === host).length,
    1,
  );
  assert.equal(
    calls.filter(
      (call) =>
        call[0] === "translate" && call[1] === host && call[2] === triggerEvent,
    ).length,
    1,
  );
  publish(Object.freeze({ open: true, type: "native-popup" }));
  publish(Object.freeze({ open: false, type: "native-popup" }));
  assert.deepEqual(popupEvents, [true, false]);
  assert.equal(unsubscribe(), true);
  assert.equal(unsubscribe(), false);
  assert.deepEqual(adapter.snapshot(), availableSnapshot);
  assert.equal(adapter.status().disposed, false);
  assert.equal(adapter.status().subscriberCount, 0);
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
