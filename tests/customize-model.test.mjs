import assert from "node:assert/strict";
import test from "node:test";

import {
  addCustomizeLayoutEntry,
  copyCustomizeLayout,
  copyCustomizeLayoutEntry,
  createCustomizeLayout,
  createEmptyCustomizeLayout,
  customizeLayoutBounds,
  customizeLayoutContainsWidget,
  findCustomizeLayoutEntry,
  getCustomizeLayoutEntry,
  isCustomizeSpecialKind,
  isCustomizeWidgetId,
  moveCustomizeLayoutEntry,
  parseCustomizeLayout,
  parseCustomizePanels,
  parseCustomizeStyle,
  removeCustomizeLayoutEntry,
  serializeCustomizeLayout,
  serializeCustomizePanels,
  serializeCustomizeStyle,
  withCustomizeAdopted,
  withoutCustomizeAdopted,
} from "../src/firefox/customize-model.ts";
import {
  createDefaultShellPanelConfig,
  createDefaultToolbarStyle,
} from "../src/app/toolbar-widgets-state.ts";

const widgetEntry = Object.freeze({ id: "print-button", type: "widget" });
const springEntry = Object.freeze({ kind: "spring", type: "special" });
const fenneviaEntry = Object.freeze({ id: "show-bookmarks", type: "fennevia" });

test("entry guards accept only known shapes and bounded ids", () => {
  assert.equal(isCustomizeSpecialKind("spring"), true);
  assert.equal(isCustomizeSpecialKind("gap"), false);
  assert.equal(isCustomizeWidgetId("zoom-controls"), true);
  assert.equal(isCustomizeWidgetId("a".repeat(129)), false);
  assert.equal(isCustomizeWidgetId("bad id"), false);

  assert.deepEqual(copyCustomizeLayoutEntry(widgetEntry), widgetEntry);
  assert.deepEqual(copyCustomizeLayoutEntry(springEntry), springEntry);
  assert.deepEqual(copyCustomizeLayoutEntry(fenneviaEntry), fenneviaEntry);
  assert.throws(
    () => copyCustomizeLayoutEntry({ id: "bad id", type: "widget" }),
    /FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID/u,
  );
  assert.throws(
    () => copyCustomizeLayoutEntry({ id: "unknown", type: "fennevia" }),
    /FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID/u,
  );
  assert.throws(
    () => copyCustomizeLayoutEntry(null),
    /FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID/u,
  );
});

test("layout serialization round-trips and rejects malformed payloads", () => {
  const layout = createCustomizeLayout(
    { left: [fenneviaEntry], top: [widgetEntry, springEntry] },
    ["print-button"],
  );
  const serialized = serializeCustomizeLayout(layout);
  const parsed = parseCustomizeLayout(serialized);
  assert.deepEqual(parsed, layout);
  assert.ok(Object.isFrozen(parsed));
  assert.ok(Object.isFrozen(parsed.zones.top));

  assert.equal(parseCustomizeLayout(""), null);
  assert.equal(parseCustomizeLayout("{not json"), null);
  assert.equal(parseCustomizeLayout('{"version":2}'), null);
  assert.equal(
    parseCustomizeLayout(
      JSON.stringify({ adopted: [], version: 1, zones: { top: [] } }),
    ),
    null,
  );
  assert.equal(
    parseCustomizeLayout(`{"padding":"${"x".repeat(17000)}"}`),
    null,
  );

  assert.throws(
    () =>
      copyCustomizeLayout({
        adopted: ["bad id"],
        version: 1,
        zones: createEmptyCustomizeLayout().zones,
      }),
    /FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID/u,
  );
  assert.throws(
    () =>
      copyCustomizeLayout({
        adopted: [],
        version: 1,
        zones: {
          ...createEmptyCustomizeLayout().zones,
          top: new Array(customizeLayoutBounds.zoneMaxEntries + 1).fill(
            springEntry,
          ),
        },
      }),
    /FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID/u,
  );
});

test("add operations clamp indexes, dedupe widgets, and enforce capacity", () => {
  const empty = createEmptyCustomizeLayout();
  const added = addCustomizeLayoutEntry(empty, widgetEntry, "top", 99);
  assert.deepEqual(added.zones.top, [widgetEntry]);

  // Re-adding an already-placed widget moves it instead of duplicating it.
  const moved = addCustomizeLayoutEntry(added, widgetEntry, "left", 0);
  assert.deepEqual(moved.zones.top, []);
  assert.deepEqual(moved.zones.left, [widgetEntry]);
  assert.equal(customizeLayoutContainsWidget(moved, "print-button"), true);
  assert.equal(customizeLayoutContainsWidget(moved, "zoom-controls"), false);

  // Specials may repeat freely.
  let specials = addCustomizeLayoutEntry(moved, springEntry, "left", 0);
  specials = addCustomizeLayoutEntry(specials, springEntry, "left", 0);
  assert.equal(specials.zones.left.length, 3);
  assert.equal(findCustomizeLayoutEntry(specials, springEntry), null);

  let full = createEmptyCustomizeLayout();
  for (
    let index = 0;
    index < customizeLayoutBounds.zoneMaxEntries;
    index += 1
  ) {
    full = addCustomizeLayoutEntry(full, springEntry, "bottom", index);
  }
  assert.throws(
    () => addCustomizeLayoutEntry(full, springEntry, "bottom", 0),
    /FENNEVIA_CUSTOMIZE_MODEL_ZONE_FULL/u,
  );
  assert.throws(
    () => addCustomizeLayoutEntry(full, springEntry, "middle", 0),
    /FENNEVIA_CUSTOMIZE_MODEL_ZONE_INVALID/u,
  );
  assert.throws(
    () => addCustomizeLayoutEntry(full, springEntry, "top", -1),
    /FENNEVIA_CUSTOMIZE_MODEL_INDEX_INVALID/u,
  );
});

test("move and remove operations stay bounded and immutable", () => {
  const layout = createCustomizeLayout({
    top: [widgetEntry, springEntry, fenneviaEntry],
  });
  assert.deepEqual(getCustomizeLayoutEntry(layout, "top", 1), springEntry);
  assert.throws(
    () => getCustomizeLayoutEntry(layout, "top", 3),
    /FENNEVIA_CUSTOMIZE_MODEL_INDEX_INVALID/u,
  );

  const moved = moveCustomizeLayoutEntry(layout, "top", 0, "right", 0);
  assert.deepEqual(moved.zones.right, [widgetEntry]);
  assert.deepEqual(moved.zones.top, [springEntry, fenneviaEntry]);
  assert.deepEqual(layout.zones.top, [widgetEntry, springEntry, fenneviaEntry]);

  const reordered = moveCustomizeLayoutEntry(moved, "top", 1, "top", 0);
  assert.deepEqual(reordered.zones.top, [fenneviaEntry, springEntry]);

  const removed = removeCustomizeLayoutEntry(reordered, "top", 0);
  assert.deepEqual(removed.zones.top, [springEntry]);
  assert.throws(
    () => removeCustomizeLayoutEntry(removed, "top", 5),
    /FENNEVIA_CUSTOMIZE_MODEL_INDEX_INVALID/u,
  );
});

test("adopted ids stay unique, bounded, and removable", () => {
  const layout = createEmptyCustomizeLayout();
  const adopted = withCustomizeAdopted(layout, "print-button");
  assert.deepEqual(adopted.adopted, ["print-button"]);
  assert.equal(withCustomizeAdopted(adopted, "print-button"), adopted);

  const released = withoutCustomizeAdopted(adopted, "print-button");
  assert.deepEqual(released.adopted, []);
  assert.equal(withoutCustomizeAdopted(released, "print-button"), released);

  assert.throws(
    () => withCustomizeAdopted(layout, "bad id"),
    /FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID/u,
  );
  let crowded = layout;
  for (
    let index = 0;
    index < customizeLayoutBounds.adoptedMaxEntries;
    index += 1
  ) {
    crowded = withCustomizeAdopted(crowded, `widget-${index}`);
  }
  assert.throws(
    () => withCustomizeAdopted(crowded, "one-more"),
    /FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_TOO_LARGE/u,
  );
});

test("style serialization round-trips with versioning and fails safe", () => {
  const style = Object.freeze({
    ...createDefaultToolbarStyle(),
    accent: "#3b82f6",
    autoHideDelay: 640,
    blur: 28,
    edgeTriggerSize: 20,
    shortcutHintDuration: 0,
    temporaryRevealDuration: 2_400,
    theme: "dark",
    windowLeaveHideDelay: 1_600,
  });
  const serialized = serializeCustomizeStyle(style);
  assert.ok(serialized.includes('"version":1'));
  assert.deepEqual(parseCustomizeStyle(serialized), style);

  assert.deepEqual(
    parseCustomizeStyle(
      JSON.stringify({
        accent: "#3b82f6",
        autoHideDelay: 640,
        blur: 28,
        edgeTriggerSize: 20,
        shortcutHintDuration: 0,
        temporaryRevealDuration: 2_400,
        theme: "dark",
        version: 1,
        windowLeaveHideDelay: 1_600,
      }),
    ),
    {
      ...createDefaultToolbarStyle(),
      accent: "#3b82f6",
      autoHideDelay: 640,
      blur: 28,
      edgeTriggerSize: 20,
      shortcutHintDuration: 0,
      temporaryRevealDuration: 2_400,
      theme: "dark",
      windowLeaveHideDelay: 1_600,
    },
  );

  const previousStyle = parseCustomizeStyle(
    JSON.stringify({ accent: "#3b82f6", blur: 28, theme: "dark", version: 1 }),
  );
  assert.equal(
    previousStyle?.autoHideDelay,
    createDefaultToolbarStyle().autoHideDelay,
  );
  assert.equal(
    previousStyle?.edgeTriggerSize,
    createDefaultToolbarStyle().edgeTriggerSize,
  );
  assert.equal(
    previousStyle?.shortcutHintDuration,
    createDefaultToolbarStyle().shortcutHintDuration,
  );
  assert.equal(
    previousStyle?.temporaryRevealDuration,
    createDefaultToolbarStyle().temporaryRevealDuration,
  );
  assert.equal(
    previousStyle?.windowLeaveHideDelay,
    createDefaultToolbarStyle().windowLeaveHideDelay,
  );

  assert.equal(parseCustomizeStyle(""), null);
  assert.equal(parseCustomizeStyle("{not json"), null);
  assert.equal(parseCustomizeStyle('{"version":2}'), null);
  assert.equal(
    parseCustomizeStyle(JSON.stringify({ accent: "red", version: 1 })),
    null,
  );
  assert.equal(
    parseCustomizeStyle(JSON.stringify({ blur: 999, version: 1 })),
    null,
  );
  assert.equal(
    parseCustomizeStyle(JSON.stringify({ saturation: 90, version: 1 })),
    null,
  );
  assert.equal(
    parseCustomizeStyle(JSON.stringify({ autoHideDelay: 99, version: 1 })),
    null,
  );
  assert.equal(
    parseCustomizeStyle(JSON.stringify({ edgeTriggerSize: 25, version: 1 })),
    null,
  );
  assert.equal(
    parseCustomizeStyle(
      JSON.stringify({ shortcutHintDuration: 10_001, version: 1 }),
    ),
    null,
  );
  assert.equal(
    parseCustomizeStyle(
      JSON.stringify({ temporaryRevealDuration: 399, version: 1 }),
    ),
    null,
  );
  assert.equal(
    parseCustomizeStyle(
      JSON.stringify({ windowLeaveHideDelay: 5_001, version: 1 }),
    ),
    null,
  );
});

test("panel serialization is versioned, bounded, and fails safe", () => {
  const panels = Object.freeze({
    ...createDefaultShellPanelConfig(),
    bottomDownloadsEnabled: false,
    bottomProgressLight: "loading",
    sidePanelLayout: "tabs-right",
    topProgressLight: "off",
  });
  const serialized = serializeCustomizePanels(panels);
  assert.ok(serialized.includes('"version":1'));
  assert.deepEqual(parseCustomizePanels(serialized), panels);
  assert.ok(Object.isFrozen(parseCustomizePanels(serialized)));

  assert.equal(parseCustomizePanels(""), null);
  assert.equal(parseCustomizePanels("{not json"), null);
  assert.equal(parseCustomizePanels('{"version":2}'), null);
  assert.equal(
    parseCustomizePanels(
      JSON.stringify({ ...panels, unexpected: true, version: 1 }),
    ),
    null,
  );
  assert.equal(
    parseCustomizePanels(
      JSON.stringify({ ...panels, topProgressLight: "network", version: 1 }),
    ),
    null,
  );
  assert.equal(
    parseCustomizePanels(
      JSON.stringify({
        bottomDownloadsEnabled: true,
        bottomProgressLight: "downloads",
        sidePanelLayout: "tabs-left",
        topProgressLight: "loading",
        version: 1,
      }),
    )?.allowCompactWindow,
    false,
  );
  assert.equal(
    parseCustomizePanels(
      JSON.stringify({
        allowCompactWindow: true,
        bottomDownloadsEnabled: true,
        bottomProgressLight: "downloads",
        sidePanelLayout: "tabs-left",
        topProgressLight: "loading",
        version: 1,
      }),
    )?.allowCompactWindow,
    true,
  );
});
