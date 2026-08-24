import assert from "node:assert/strict";
import test from "node:test";

import {
  customizePaletteCategoryForKind,
  filterCustomizePalette,
} from "../src/shell/features/customize/customize-palette.ts";

const entry = (kind, label, token) =>
  Object.freeze({ icon: "", iconUrl: "", kind, label, token });

const palette = Object.freeze([
  entry("project", "Address launcher", "palette-1"),
  entry("fennevia", "Show bookmarks panel", "palette-2"),
  entry("built-in", "Print", "palette-3"),
  entry("extension-action", "Test Extension", "palette-4"),
  entry("container", "Row", "palette-5"),
  entry("wrapper", "Center", "palette-6"),
  entry("special", "Flexible space", "palette-7"),
]);

test("customize palette categories stay closed and deterministic", () => {
  assert.equal(customizePaletteCategoryForKind("project"), "browser");
  assert.equal(customizePaletteCategoryForKind("fennevia"), "browser");
  assert.equal(customizePaletteCategoryForKind("built-in"), "firefox");
  assert.equal(customizePaletteCategoryForKind("extension-action"), "firefox");
  assert.equal(customizePaletteCategoryForKind("container"), "layout");
  assert.equal(customizePaletteCategoryForKind("wrapper"), "layout");
  assert.equal(customizePaletteCategoryForKind("special"), "layout");
});

test("customize palette filters localized labels without changing entries", () => {
  const browser = filterCustomizePalette(palette, "en", "", "browser");
  assert.deepEqual(
    browser.map((candidate) => candidate.token),
    ["palette-1", "palette-2"],
  );
  assert.ok(Object.isFrozen(browser));

  assert.deepEqual(
    filterCustomizePalette(palette, "en", "  ExTENSION  ", "all").map(
      (candidate) => candidate.token,
    ),
    ["palette-4"],
  );
  assert.deepEqual(
    filterCustomizePalette(palette, "zh-Hant", "橫列", "layout").map(
      (candidate) => candidate.token,
    ),
    ["palette-5"],
  );
  assert.deepEqual(
    filterCustomizePalette(palette, "zh-Hant", "列印", "browser"),
    [],
  );
  assert.deepEqual(filterCustomizePalette(palette, "en", "missing", "all"), []);
});
