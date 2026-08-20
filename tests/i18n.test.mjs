import assert from "node:assert/strict";
import test from "node:test";

import {
  countLabel,
  getCatalog,
  interpolate,
  listMessageKeys,
  translate,
} from "../src/app/i18n.ts";
import { en } from "../src/app/messages/en.ts";
import { zhHant } from "../src/app/messages/zh-Hant.ts";

test("English and Traditional Chinese catalogs share the same keys", () => {
  const englishKeys = Object.keys(en).toSorted();
  const traditionalKeys = Object.keys(zhHant).toSorted();
  assert.deepEqual(traditionalKeys, englishKeys);
  assert.deepEqual(listMessageKeys().toSorted(), englishKeys);
  assert.equal(getCatalog("en")["tab.untitled"], "Untitled tab");
  assert.equal(getCatalog("zh-Hant")["tab.untitled"], "未命名分頁");
});

test("translate interpolates named placeholders and falls back to English", () => {
  assert.equal(interpolate("Hello {name}", { name: "Ada" }), "Hello Ada");
  assert.equal(interpolate("Keep {name}", {}), "Keep {name}");
  assert.equal(translate("en", "tab.openCount", { count: 3 }), "3 open tabs");
  assert.equal(
    translate("zh-Hant", "tab.openCount", { count: 3 }),
    "3 個開啟的分頁",
  );
  assert.equal(
    translate("zh-Hant", /** @type {never} */ ("tab.missing-key")),
    "tab.missing-key",
  );
  assert.equal(
    countLabel("en", 1, false, "downloads.activeOne", "downloads.activeOther"),
    "1 download active",
  );
  assert.equal(
    countLabel("en", 999, true, "downloads.activeOne", "downloads.activeOther"),
    "999+ downloads active",
  );
});
