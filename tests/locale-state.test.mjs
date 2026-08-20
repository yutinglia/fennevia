import assert from "node:assert/strict";
import test from "node:test";

import {
  copyLocaleSnapshot,
  createBrowserLocaleStateAdapter,
  createStaticLocaleBridge,
  defaultFenneviaLocale,
  isFenneviaLocale,
  mapAppLocaleToFennevia,
} from "../src/app/locale-state.ts";

test("Firefox UI locales map to en or zh-Hant only", () => {
  assert.equal(defaultFenneviaLocale, "en");
  assert.equal(isFenneviaLocale("en"), true);
  assert.equal(isFenneviaLocale("zh-Hant"), true);
  assert.equal(isFenneviaLocale("zh-TW"), false);

  const traditional = [
    "zh",
    "zh-Hant",
    "zh-hant",
    "zh-Hant-TW",
    "zh-TW",
    "zh_TW",
    "zh-HK",
    "zh-MO",
    "zh-TW-u-nu-latn",
    "zh-CN",
    "zh_CN",
    "zh-CN-u-nu-latn",
    "zh-Hans",
    "zh-Hans-CN",
    "zh-SG",
  ];
  for (const tag of traditional) {
    assert.equal(mapAppLocaleToFennevia(tag), "zh-Hant", tag);
  }

  const english = [
    "en",
    "en-US",
    "en-GB",
    "ja",
    "ja-JP",
    "fr",
    "",
    "  ",
    12,
    null,
    undefined,
  ];
  for (const tag of english) {
    assert.equal(mapAppLocaleToFennevia(tag), "en", String(tag));
  }
});

test("locale snapshots stay frozen ordinary ids", () => {
  const snapshot = copyLocaleSnapshot({ id: "zh-Hant" });
  assert.deepEqual(snapshot, { id: "zh-Hant" });
  assert.ok(Object.isFrozen(snapshot));
  assert.throws(
    () => copyLocaleSnapshot({ id: "zh-TW" }),
    (error) => error?.fenneviaCode === "FENNEVIA_LOCALE_STATE_SNAPSHOT_INVALID",
  );
});

test("locale adapter publishes mapped ids and falls back to a static English bridge", () => {
  let current = { id: "en" };
  const listeners = new Set();
  const adapter = createBrowserLocaleStateAdapter({
    snapshot() {
      return current;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });

  assert.equal(adapter.snapshot().id, "en");
  const seen = [];
  const unsubscribe = adapter.subscribe((snapshot) => {
    seen.push(snapshot.id);
  });
  current = { id: "zh-Hant" };
  for (const listener of listeners) {
    listener(current);
  }
  current = { id: "zh-Hant" };
  for (const listener of listeners) {
    listener(current);
  }
  assert.deepEqual(seen, ["zh-Hant"]);
  assert.equal(unsubscribe(), true);
  assert.equal(adapter.dispose(), true);
  assert.equal(adapter.dispose(), false);
  assert.throws(
    () => adapter.snapshot(),
    (error) => error?.fenneviaCode === "FENNEVIA_LOCALE_STATE_DISPOSED",
  );

  const staticBridge = createStaticLocaleBridge("zh-Hant");
  assert.equal(staticBridge.snapshot().id, "zh-Hant");
  assert.equal(staticBridge.subscribe(() => undefined)(), false);
  const fallback = createBrowserLocaleStateAdapter(staticBridge);
  assert.equal(fallback.snapshot().id, "zh-Hant");
  assert.equal(fallback.subscribe(() => undefined)(), true);
  assert.equal(fallback.dispose(), true);
});
