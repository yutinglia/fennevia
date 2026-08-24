import assert from "node:assert/strict";
import test from "node:test";

import {
  composableLayoutBounds,
  composableLayoutContainsFirefoxWidget,
  copyComposableCustomizeLayout,
  copyComposableLayoutTarget,
  countComposableLayoutTarget,
  createComposableCustomizeLayout,
  createDefaultComposableCustomizeLayout,
  findComposableLayoutInstance,
  getComposableLayoutNode,
  insertComposableLayoutContainer,
  insertComposableLayoutTarget,
  insertComposableLayoutWrapper,
  isComposableFirefoxWidgetId,
  isComposableInstanceId,
  isComposableLayoutDirection,
  isComposableLayoutWrapperKind,
  isComposableSingletonTarget,
  isComposableSpecialKind,
  migrateCustomizeLayoutV1,
  moveComposableLayoutNode,
  parseComposableCustomizeLayout,
  removeComposableLayoutNode,
  serializeComposableCustomizeLayout,
  setComposableLayoutItemStyle,
  setComposableMultiplePlacements,
  withComposableAdopted,
  withoutComposableAdopted,
} from "../src/firefox/customize-layout.ts";
import { createCustomizeLayout } from "../src/firefox/customize-model.ts";

const project = (id) => Object.freeze({ id, source: "project" });
const firefox = (id) => Object.freeze({ id, source: "firefox" });
const special = (kind) => Object.freeze({ kind, source: "special" });
const item = (target) => Object.freeze({ target, type: "item" });
const container = (direction, children = []) =>
  Object.freeze({ children, direction, type: "container" });
const wrapper = (kind, children = []) =>
  Object.freeze({ children, kind, type: "wrapper" });

const createDefaultLayout = (options = {}) =>
  createComposableCustomizeLayout(
    {
      left: [
        container("column", [
          item(project("address-launcher")),
          item(project("tabs")),
        ]),
      ],
      right: [item(project("bookmarks"))],
      top: [
        container("row", [
          item(project("back")),
          item(project("customize-shell")),
          item(project("close-window")),
        ]),
      ],
    },
    options,
  );

test("v2 guards accept only bounded fixed targets and structural values", () => {
  assert.equal(isComposableLayoutDirection("row"), true);
  assert.equal(isComposableLayoutDirection("grid"), false);
  assert.equal(isComposableSpecialKind("spring"), true);
  assert.equal(isComposableSpecialKind("gap"), false);
  assert.equal(isComposableLayoutWrapperKind("center"), true);
  assert.equal(isComposableLayoutWrapperKind("flex"), false);
  assert.equal(isComposableFirefoxWidgetId("zoom-controls"), true);
  assert.equal(isComposableFirefoxWidgetId("bad id"), false);
  assert.equal(isComposableInstanceId("layout-1"), true);
  assert.equal(isComposableInstanceId("layout-0"), false);
  assert.equal(isComposableInstanceId("layout-private"), false);

  assert.deepEqual(copyComposableLayoutTarget(project("customize-shell")), {
    id: "customize-shell",
    source: "project",
  });
  assert.deepEqual(copyComposableLayoutTarget(firefox("print-button")), {
    id: "print-button",
    source: "firefox",
  });
  assert.deepEqual(copyComposableLayoutTarget(special("separator")), {
    kind: "separator",
    source: "special",
  });
  assert.equal(isComposableSingletonTarget(project("tabs")), true);
  assert.equal(isComposableSingletonTarget(project("back")), false);
  assert.throws(
    () => copyComposableLayoutTarget(project("unknown")),
    /FENNEVIA_COMPOSABLE_LAYOUT_TARGET_INVALID/u,
  );
  assert.throws(
    () =>
      copyComposableLayoutTarget({
        id: "print-button",
        source: "firefox",
        title: "private",
      }),
    /FENNEVIA_COMPOSABLE_LAYOUT_TARGET_INVALID/u,
  );
});

test("native v2 defaults use direct base-flow children and explicit wrappers", () => {
  const layout = createDefaultComposableCustomizeLayout();
  assert.equal(layout.version, 2);
  assert.equal(layout.allowMultiplePlacements, false);
  assert.ok(
    Object.values(layout.zones)
      .flatMap((nodes) => nodes)
      .every((node) => node.type !== "container"),
  );

  assert.deepEqual(
    layout.zones.top.map((node) =>
      node.type === "item"
        ? node.target.source === "special"
          ? node.target.kind
          : node.target.id
        : node.kind,
    ),
    [
      "back",
      "forward",
      "reload-stop",
      "home",
      "trust",
      "expanded",
      "show-downloads",
      "extensions",
      "settings",
      "customize-shell",
      "application-menu",
      "private-indicator",
      "minimize-window",
      "toggle-maximize-window",
      "close-window",
    ],
  );
  const address = layout.zones.top[5];
  assert.equal(address.type, "wrapper");
  assert.equal(address.kind, "expanded");
  assert.equal(address.children[0].target.id, "address-launcher");

  assert.equal(layout.zones.left[0].target.id, "new-tab");
  assert.equal(layout.zones.left[1].type, "wrapper");
  assert.equal(layout.zones.left[1].kind, "expanded");
  assert.equal(layout.zones.left[1].children[0].target.id, "tabs");
  assert.equal(layout.zones.right[0].type, "wrapper");
  assert.equal(layout.zones.right[0].children[0].target.id, "bookmarks");

  const bottomExpanded = layout.zones.bottom[0];
  assert.equal(bottomExpanded.type, "wrapper");
  assert.equal(bottomExpanded.kind, "expanded");
  const bottomCenter = bottomExpanded.children[0];
  assert.equal(bottomCenter.type, "wrapper");
  assert.equal(bottomCenter.kind, "center");
  assert.equal(bottomCenter.children[0].target.id, "downloads-status");

  const allTargets = [];
  const visit = (nodes) => {
    for (const node of nodes) {
      if (node.type === "item") {
        allTargets.push(node.target);
      } else {
        visit(node.children);
      }
    }
  };
  Object.values(layout.zones).forEach(visit);
  assert.ok(allTargets.every((target) => target.source !== "firefox"));
});

test("native v2 defaults honor the retained side swap without changing features", () => {
  const layout = createDefaultComposableCustomizeLayout("tabs-right");
  assert.equal(layout.zones.right[0].target.id, "new-tab");
  assert.equal(layout.zones.right[1].children[0].target.id, "tabs");
  assert.equal(layout.zones.left[0].children[0].target.id, "bookmarks");
});

test("v1 migration preserves explicit entries but uses the fixed roots directly", () => {
  const legacy = createCustomizeLayout(
    {
      bottom: [{ id: "print-button", type: "widget" }],
      left: [{ kind: "spacer", type: "special" }],
      right: [{ id: "show-bookmarks", type: "fennevia" }],
      top: [{ id: "history-panelmenu", type: "widget" }],
    },
    ["print-button"],
  );
  const migrated = migrateCustomizeLayoutV1(legacy, "tabs-right");
  assert.deepEqual(migrated.adopted, ["print-button"]);
  assert.ok(
    Object.values(migrated.zones)
      .flatMap((nodes) => nodes)
      .every((node) => node.type !== "container"),
  );
  assert.equal(migrated.zones.left[0].children[0].target.id, "bookmarks");
  assert.equal(migrated.zones.left[1].target.kind, "spacer");
  assert.equal(migrated.zones.right[2].children[0].target.id, "tabs");
  assert.equal(migrated.zones.right[3].target.id, "show-bookmarks");
  assert.ok(
    migrated.zones.top.some(
      (node) => node.type === "item" && node.target.id === "history-panelmenu",
    ),
  );
  assert.equal(migrated.zones.bottom[1].target.id, "print-button");
});

test("v2 layout round-trips as a frozen strict bounded tree", () => {
  const layout = createDefaultLayout({ adopted: ["print-button"] });
  const serialized = serializeComposableCustomizeLayout(layout);
  const parsed = parseComposableCustomizeLayout(serialized);

  assert.deepEqual(parsed, layout);
  assert.ok(Object.isFrozen(parsed));
  assert.ok(Object.isFrozen(parsed.zones.top));
  assert.ok(Object.isFrozen(parsed.zones.top[0].children));
  assert.equal(parsed.version, 2);
  assert.equal(parsed.allowMultiplePlacements, false);
  assert.equal(parsed.adopted[0], "print-button");
  assert.ok(parsed.nextInstance > 1);

  assert.equal(parseComposableCustomizeLayout(""), null);
  assert.equal(parseComposableCustomizeLayout("{not json"), null);
  assert.equal(parseComposableCustomizeLayout('{"version":1}'), null);
  assert.equal(
    parseComposableCustomizeLayout(
      JSON.stringify({ ...layout, unexpected: true }),
    ),
    null,
  );
  assert.equal(
    parseComposableCustomizeLayout(
      JSON.stringify({
        ...layout,
        zones: { ...layout.zones, middle: [] },
      }),
    ),
    null,
  );
  assert.equal(
    parseComposableCustomizeLayout(`{"padding":"${"x".repeat(17000)}"}`),
    null,
  );
});

test("project widget styles persist per instance and canonicalize defaults", () => {
  const initial = createDefaultComposableCustomizeLayout();
  const addressLocation = { path: [5, 0], zone: "top" };
  const tabsLocation = { path: [1, 0], zone: "left" };
  const initialAddress = getComposableLayoutNode(initial, addressLocation);
  const initialTabs = getComposableLayoutNode(initial, tabsLocation);
  assert.equal(initialAddress.target.id, "address-launcher");
  assert.equal(initialAddress.style, undefined);
  assert.equal(initialTabs.target.id, "tabs");
  assert.equal(initialTabs.style, undefined);

  const addressWithStatus = setComposableLayoutItemStyle(
    initial,
    addressLocation,
    "with-site-status",
  );
  const tabsWithNewTab = setComposableLayoutItemStyle(
    addressWithStatus,
    tabsLocation,
    "with-new-tab",
  );
  assert.equal(
    getComposableLayoutNode(tabsWithNewTab, addressLocation).style,
    "with-site-status",
  );
  assert.equal(
    getComposableLayoutNode(tabsWithNewTab, tabsLocation).style,
    "with-new-tab",
  );
  assert.deepEqual(
    parseComposableCustomizeLayout(
      serializeComposableCustomizeLayout(tabsWithNewTab),
    ),
    tabsWithNewTab,
  );

  const resetAddress = setComposableLayoutItemStyle(
    tabsWithNewTab,
    addressLocation,
    "address-only",
  );
  const resetTabs = setComposableLayoutItemStyle(
    resetAddress,
    tabsLocation,
    "tabs-only",
  );
  assert.equal(
    "style" in getComposableLayoutNode(resetTabs, addressLocation),
    false,
  );
  assert.equal(
    "style" in getComposableLayoutNode(resetTabs, tabsLocation),
    false,
  );
  assert.doesNotMatch(
    serializeComposableCustomizeLayout(resetTabs),
    /"style"/u,
  );

  assert.throws(
    () =>
      setComposableLayoutItemStyle(initial, addressLocation, "with-new-tab"),
    /FENNEVIA_COMPOSABLE_LAYOUT_STYLE_INVALID/u,
  );
  assert.throws(
    () =>
      setComposableLayoutItemStyle(
        initial,
        { path: [5], zone: "top" },
        "with-site-status",
      ),
    /FENNEVIA_COMPOSABLE_LAYOUT_STYLE_INVALID/u,
  );

  const invalidStyle = JSON.parse(serializeComposableCustomizeLayout(initial));
  invalidStyle.zones.top[5].children[0].style = "arbitrary-css";
  assert.equal(
    parseComposableCustomizeLayout(JSON.stringify(invalidStyle)),
    null,
  );
});

test("mandatory Customize and duplicate policies fail safe", () => {
  assert.throws(
    () =>
      createComposableCustomizeLayout({
        top: [item(project("back"))],
      }),
    /FENNEVIA_COMPOSABLE_LAYOUT_CUSTOMIZE_REQUIRED/u,
  );
  assert.throws(
    () =>
      createComposableCustomizeLayout({
        top: [
          item(project("customize-shell")),
          item(project("customize-shell")),
        ],
      }),
    /FENNEVIA_COMPOSABLE_LAYOUT_DUPLICATE_INVALID/u,
  );
  assert.throws(
    () =>
      createComposableCustomizeLayout({
        top: [
          item(project("customize-shell")),
          item(project("back")),
          item(project("back")),
        ],
      }),
    /FENNEVIA_COMPOSABLE_LAYOUT_DUPLICATE_INVALID/u,
  );

  const duplicated = createComposableCustomizeLayout(
    {
      top: [
        item(project("customize-shell")),
        item(project("back")),
        item(project("back")),
        item(firefox("print-button")),
        item(firefox("print-button")),
      ],
    },
    { allowMultiplePlacements: true },
  );
  assert.equal(countComposableLayoutTarget(duplicated, project("back")), 2);
  assert.equal(
    countComposableLayoutTarget(duplicated, firefox("print-button")),
    2,
  );
  assert.throws(
    () => setComposableMultiplePlacements(duplicated, false),
    /FENNEVIA_COMPOSABLE_LAYOUT_DUPLICATE_INVALID/u,
  );
  assert.throws(
    () =>
      createComposableCustomizeLayout(
        {
          top: [
            item(project("customize-shell")),
            item(project("tabs")),
            item(project("tabs")),
          ],
        },
        { allowMultiplePlacements: true },
      ),
    /FENNEVIA_COMPOSABLE_LAYOUT_DUPLICATE_INVALID/u,
  );
});

test("layout primitives remain repeatable while duplicate-safe controls are opt-in", () => {
  const structural = createComposableCustomizeLayout({
    top: [
      item(project("customize-shell")),
      container("row"),
      container("row"),
      wrapper("center"),
      wrapper("center"),
      wrapper("expanded"),
      wrapper("expanded"),
      wrapper("padding"),
      wrapper("padding"),
      item(special("separator")),
      item(special("separator")),
      item(special("spacer")),
      item(special("spacer")),
      item(special("spring")),
      item(special("spring")),
    ],
  });
  assert.equal(structural.allowMultiplePlacements, false);

  const duplicatedWindowControls = createComposableCustomizeLayout(
    {
      left: [
        item(project("minimize-window")),
        item(project("toggle-maximize-window")),
        item(project("close-window")),
      ],
      top: [
        item(project("customize-shell")),
        item(project("minimize-window")),
        item(project("toggle-maximize-window")),
        item(project("close-window")),
      ],
    },
    { allowMultiplePlacements: true },
  );
  assert.equal(
    countComposableLayoutTarget(
      duplicatedWindowControls,
      project("close-window"),
    ),
    2,
  );
});

test("one-child wrappers round-trip and reject over-capacity edits", () => {
  const initial = createDefaultLayout();
  const withCenter = insertComposableLayoutWrapper(initial, "center", {
    index: 0,
    parentPath: [],
    zone: "bottom",
  });
  const withPadding = insertComposableLayoutWrapper(withCenter, "padding", {
    index: 0,
    parentPath: [0],
    zone: "bottom",
  });
  const composed = insertComposableLayoutTarget(
    withPadding,
    project("reload-stop"),
    { index: 0, parentPath: [0, 0], zone: "bottom" },
  );

  assert.equal(composed.zones.bottom[0].type, "wrapper");
  assert.equal(composed.zones.bottom[0].kind, "center");
  assert.equal(composed.zones.bottom[0].children[0].kind, "padding");
  assert.deepEqual(
    parseComposableCustomizeLayout(
      serializeComposableCustomizeLayout(composed),
    ),
    composed,
  );
  assert.throws(
    () =>
      insertComposableLayoutTarget(composed, project("home"), {
        index: 1,
        parentPath: [0, 0],
        zone: "bottom",
      }),
    /FENNEVIA_COMPOSABLE_LAYOUT_CONTAINER_FULL/u,
  );
  assert.throws(
    () =>
      moveComposableLayoutNode(
        composed,
        { path: [0, 0], zone: "top" },
        { index: 1, parentPath: [0, 0], zone: "bottom" },
      ),
    /FENNEVIA_COMPOSABLE_LAYOUT_CONTAINER_FULL/u,
  );
});

test("nested insertion, lookup, movement, and removal use immutable paths", () => {
  const initial = createDefaultLayout();
  const topRow = initial.zones.top[0];
  assert.equal(topRow.type, "container");
  const customize = topRow.children[1];
  assert.deepEqual(
    findComposableLayoutInstance(initial, customize.instanceId),
    {
      path: [0, 1],
      zone: "top",
    },
  );
  assert.equal(
    getComposableLayoutNode(initial, { path: [0, 1], zone: "top" }).instanceId,
    customize.instanceId,
  );

  const withColumn = insertComposableLayoutContainer(initial, "column", {
    index: 0,
    parentPath: [],
    zone: "bottom",
  });
  const column = withColumn.zones.bottom[0];
  assert.equal(column.type, "container");
  const withReload = insertComposableLayoutTarget(
    withColumn,
    project("reload-stop"),
    { index: 0, parentPath: [0], zone: "bottom" },
  );
  assert.equal(withReload.zones.bottom[0].children.length, 1);

  const moved = moveComposableLayoutNode(
    withReload,
    { path: [0, 0], zone: "top" },
    { index: 1, parentPath: [0], zone: "bottom" },
  );
  assert.equal(moved.zones.top[0].children.length, 2);
  assert.equal(moved.zones.bottom[0].children.length, 2);
  assert.equal(moved.zones.bottom[0].children[1].target.id, "back");
  assert.equal(initial.zones.top[0].children.length, 3);

  const removed = removeComposableLayoutNode(moved, {
    path: [0, 0],
    zone: "bottom",
  });
  assert.equal(removed.zones.bottom[0].children.length, 1);
  assert.throws(
    () =>
      removeComposableLayoutNode(removed, {
        path: [0, 0],
        zone: "top",
      }),
    /FENNEVIA_COMPOSABLE_LAYOUT_CUSTOMIZE_REQUIRED/u,
  );
});

test("same-container moves adjust insertion boundaries and reject cycles", () => {
  const layout = createDefaultLayout();
  const row = layout.zones.top[0];
  assert.deepEqual(
    row.children.map((node) => node.target.id),
    ["back", "customize-shell", "close-window"],
  );
  const moved = moveComposableLayoutNode(
    layout,
    { path: [0, 0], zone: "top" },
    { index: 3, parentPath: [0], zone: "top" },
  );
  assert.deepEqual(
    moved.zones.top[0].children.map((node) => node.target.id),
    ["customize-shell", "close-window", "back"],
  );

  assert.throws(
    () =>
      moveComposableLayoutNode(
        layout,
        { path: [0], zone: "top" },
        { index: 0, parentPath: [0], zone: "top" },
      ),
    /FENNEVIA_COMPOSABLE_LAYOUT_CYCLE_INVALID/u,
  );
});

test("depth, direct-child, total-node, and instance bounds are enforced", () => {
  const customize = item(project("customize-shell"));
  assert.throws(
    () =>
      createComposableCustomizeLayout({
        top: [
          customize,
          container("column", [
            container("column", [
              container("column", [container("column", [])]),
            ]),
          ]),
        ],
      }),
    /FENNEVIA_COMPOSABLE_LAYOUT_DEPTH_INVALID/u,
  );
  assert.throws(
    () =>
      createComposableCustomizeLayout({
        top: [
          customize,
          container(
            "row",
            new Array(composableLayoutBounds.directMaxEntries + 1).fill(
              item(special("spacer")),
            ),
          ),
        ],
      }),
    /FENNEVIA_COMPOSABLE_LAYOUT_NODES_INVALID/u,
  );
  assert.throws(
    () =>
      createComposableCustomizeLayout({
        top: [
          customize,
          wrapper("center", [item(project("back")), item(project("home"))]),
        ],
      }),
    /FENNEVIA_COMPOSABLE_LAYOUT_NODES_INVALID/u,
  );
  assert.throws(
    () =>
      copyComposableCustomizeLayout({
        ...createDefaultLayout(),
        nextInstance: 1,
      }),
    /FENNEVIA_COMPOSABLE_LAYOUT_INSTANCE_INVALID/u,
  );
});

test("adopted Firefox ids stay unique and restore after the final instance", () => {
  const initial = createDefaultLayout();
  const adopted = withComposableAdopted(initial, "print-button");
  assert.deepEqual(adopted.adopted, ["print-button"]);
  assert.equal(withComposableAdopted(adopted, "print-button"), adopted);
  const withPrint = insertComposableLayoutTarget(
    adopted,
    firefox("print-button"),
    { index: 0, parentPath: [], zone: "bottom" },
  );
  assert.equal(
    composableLayoutContainsFirefoxWidget(withPrint, "print-button"),
    true,
  );
  const removed = removeComposableLayoutNode(withPrint, {
    path: [0],
    zone: "bottom",
  });
  assert.equal(
    composableLayoutContainsFirefoxWidget(removed, "print-button"),
    false,
  );
  assert.deepEqual(
    withoutComposableAdopted(removed, "print-button").adopted,
    [],
  );
  assert.throws(
    () => withComposableAdopted(initial, "bad id"),
    /FENNEVIA_COMPOSABLE_LAYOUT_TARGET_INVALID/u,
  );
});
