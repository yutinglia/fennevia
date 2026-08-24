import assert from "node:assert/strict";
import test from "node:test";

import { resolveLayoutDragPreview } from "../src/shell/features/composable-layout/layout-drag-preview.ts";

const widget = (kind, label) =>
  Object.freeze({
    badgeBackground: "",
    badgeText: "",
    badgeTextColor: "",
    disabled: false,
    fenneviaAction: "",
    handle: "",
    icon: "generic",
    iconUrl: "",
    kind,
    label,
    missing: false,
    parts: Object.freeze([]),
    tooltip: label,
  });

const paletteEntry = Object.freeze({
  icon: "row",
  iconUrl: "",
  kind: "container",
  label: "Row",
  token: "palette-1",
});
const backWidget = widget("project", "Back");
const snapshot = Object.freeze({
  layout: Object.freeze({
    bottom: Object.freeze([]),
    left: Object.freeze([]),
    right: Object.freeze([]),
    top: Object.freeze([
      Object.freeze({
        children: Object.freeze([
          Object.freeze({
            instanceId: "layout-2",
            projectId: "back",
            style: "",
            type: "item",
            widget: backWidget,
          }),
        ]),
        direction: "row",
        instanceId: "layout-1",
        type: "container",
      }),
    ]),
  }),
  palette: Object.freeze([paletteEntry]),
  zones: Object.freeze({
    bottom: Object.freeze([]),
    left: Object.freeze([]),
    right: Object.freeze([]),
    top: Object.freeze([backWidget]),
  }),
});

test("drag preview derives presentation from opaque palette and layout ids", () => {
  assert.deepEqual(
    resolveLayoutDragPreview(
      { token: "palette-1", type: "palette" },
      snapshot,
      "zh-Hant",
    ),
    {
      glyph: null,
      kind: "layout",
      label: "橫列",
      sourceInstanceId: "",
      structureIcon: "row",
    },
  );
  assert.deepEqual(
    resolveLayoutDragPreview(
      { instanceId: "layout-1", type: "layout-node" },
      snapshot,
      "en",
    ),
    {
      glyph: null,
      kind: "layout",
      label: "Row",
      sourceInstanceId: "layout-1",
      structureIcon: "row",
    },
  );
  assert.deepEqual(
    resolveLayoutDragPreview(
      { instanceId: "layout-2", type: "layout-node" },
      snapshot,
      "en",
    ),
    {
      glyph: backWidget,
      kind: "control",
      label: "Back",
      sourceInstanceId: "layout-2",
      structureIcon: null,
    },
  );
});

test("drag preview rejects stale opaque sources without leaking identities", () => {
  assert.equal(
    resolveLayoutDragPreview(
      { token: "palette-99", type: "palette" },
      snapshot,
      "en",
    ),
    null,
  );
  assert.equal(
    resolveLayoutDragPreview(
      { instanceId: "layout-99", type: "layout-node" },
      snapshot,
      "en",
    ),
    null,
  );
  assert.equal(resolveLayoutDragPreview(null, snapshot, "en"), null);
  assert.equal(
    resolveLayoutDragPreview(
      { index: 4, type: "zone", zone: "top" },
      snapshot,
      "en",
    ),
    null,
  );
});
