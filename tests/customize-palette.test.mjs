import assert from "node:assert/strict";
import test from "node:test";

import {
  customizePaletteCategoryForKind,
  filterCustomizePalette,
  groupCustomizePaletteEntries,
} from "../src/shell/features/customize/customize-palette.ts";

const entry = (kind, label, token, featureGroup = "") =>
  Object.freeze({ featureGroup, icon: "", iconUrl: "", kind, label, token });

const palette = Object.freeze([
  entry("project", "Back", "palette-1"),
  entry("fennevia", "Show bookmarks panel", "palette-2"),
  entry("built-in", "Print", "palette-3"),
  entry("extension-action", "Test Extension", "palette-4"),
  entry("container", "Row", "palette-5"),
  entry("wrapper", "Center", "palette-6"),
  entry("special", "Flexible space", "palette-7"),
  entry("feature", "Address launcher", "palette-8", "address"),
  entry("feature-companion", "Site trust", "palette-9", "address"),
  entry("feature", "Tabs", "palette-10", "tabs"),
  entry("feature-companion", "New tab", "palette-11", "tabs"),
]);

test("customize palette categories stay closed and deterministic", () => {
  assert.equal(customizePaletteCategoryForKind("feature"), "feature");
  assert.equal(customizePaletteCategoryForKind("feature-companion"), "feature");
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

  const all = filterCustomizePalette(palette, "en", "", "all");
  assert.deepEqual(
    all.map((candidate) => candidate.token),
    [
      "palette-8",
      "palette-9",
      "palette-10",
      "palette-11",
      "palette-1",
      "palette-2",
      "palette-3",
      "palette-4",
      "palette-5",
      "palette-6",
      "palette-7",
    ],
  );
  assert.equal(all[0], palette[7]);
  assert.equal(all[1], palette[8]);
  assert.equal(all[2], palette[9]);
  assert.equal(all[3], palette[10]);
  assert.deepEqual(
    filterCustomizePalette(palette, "en", "", "feature").map(
      (candidate) => candidate.token,
    ),
    ["palette-8", "palette-9", "palette-10", "palette-11"],
  );

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

test("customize palette groups complete and filtered feature pairs without holes", () => {
  const groups = groupCustomizePaletteEntries(
    filterCustomizePalette(palette, "en", "", "all"),
  );
  assert.equal(groups[0]?.layout, "feature-pair");
  assert.equal(groups[0]?.featureGroup, "address");
  assert.deepEqual(
    groups[0]?.entries.map((candidate) => candidate.token),
    ["palette-8", "palette-9"],
  );
  assert.equal(groups[1]?.layout, "feature-pair");
  assert.equal(groups[2]?.layout, "regular");
  assert.ok(Object.isFrozen(groups));
  assert.ok(Object.isFrozen(groups[0]?.entries));

  const primaryOnly = groupCustomizePaletteEntries(
    filterCustomizePalette(palette, "en", "address", "all"),
  );
  assert.equal(primaryOnly[0]?.layout, "feature-primary-only");
  assert.equal(primaryOnly[0]?.entries[0], palette[7]);

  const companionOnly = groupCustomizePaletteEntries(
    filterCustomizePalette(palette, "en", "trust", "all"),
  );
  assert.equal(companionOnly[0]?.layout, "feature-companion-only");
  assert.equal(companionOnly[0]?.entries[0], palette[8]);
});
