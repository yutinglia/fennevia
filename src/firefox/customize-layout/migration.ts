// SPDX-License-Identifier: MPL-2.0

import type {
  ProjectWidgetId,
  ProjectWidgetStyleId,
  SidePanelLayout,
  ToolbarZoneName,
} from "../../app/toolbar-widgets-state.ts";
import type {
  CustomizeLayout,
  CustomizeLayoutEntry,
} from "../customize-model.ts";
import type {
  ComposableCustomizeLayout,
  ComposableLayoutContainerPadding,
  ComposableLayoutDirection,
  ComposableLayoutSeed,
  ComposableSpecialKind,
  ComposableLayoutTarget,
  ComposableLayoutWrapperKind,
} from "./contracts.ts";
import { createComposableCustomizeLayout } from "./model.ts";

const project = (
  id: ProjectWidgetId,
  style?: ProjectWidgetStyleId,
): ComposableLayoutSeed =>
  Object.freeze({
    ...(style ? { style } : {}),
    target: Object.freeze({ id, source: "project" as const }),
    type: "item" as const,
  });

const wrapper = (
  kind: ComposableLayoutWrapperKind,
  child?: ComposableLayoutSeed,
): ComposableLayoutSeed =>
  Object.freeze({
    children: Object.freeze(child ? [child] : []),
    kind,
    type: "wrapper",
  });

const container = (
  direction: ComposableLayoutDirection,
  padding: ComposableLayoutContainerPadding,
  ...children: readonly ComposableLayoutSeed[]
): ComposableLayoutSeed =>
  Object.freeze({
    children: Object.freeze(children),
    direction,
    padding,
    type: "container",
  });

const special = (kind: ComposableSpecialKind): ComposableLayoutSeed =>
  Object.freeze({
    target: Object.freeze({ kind, source: "special" as const }),
    type: "item" as const,
  });

const legacyTarget = (entry: CustomizeLayoutEntry): ComposableLayoutTarget => {
  if (entry.type === "widget") {
    return Object.freeze({ id: entry.id, source: "firefox" as const });
  }
  if (entry.type === "fennevia") {
    return Object.freeze({ id: entry.id, source: "project" as const });
  }
  return Object.freeze({ kind: entry.kind, source: "special" as const });
};

const legacySeeds = (
  entries: readonly CustomizeLayoutEntry[],
): readonly ComposableLayoutSeed[] =>
  Object.freeze(
    entries.map((entry) =>
      Object.freeze({ target: legacyTarget(entry), type: "item" as const }),
    ),
  );

export function createDefaultComposableCustomizeLayout(
  sidePanelLayout: SidePanelLayout = "tabs-left",
): ComposableCustomizeLayout {
  const tabsEdge: ToolbarZoneName =
    sidePanelLayout === "tabs-left" ? "left" : "right";
  const bookmarksEdge: ToolbarZoneName = tabsEdge === "left" ? "right" : "left";
  const sideSeeds: Record<"left" | "right", readonly ComposableLayoutSeed[]> = {
    left: Object.freeze([]),
    right: Object.freeze([]),
  };
  sideSeeds[tabsEdge] = Object.freeze([
    container(
      "row",
      "standard",
      wrapper("expanded", project("address-launcher", "with-site-status")),
    ),
    wrapper("expanded", project("tabs", "with-new-tab")),
    special("separator"),
  ]);
  sideSeeds[bookmarksEdge] = Object.freeze([
    wrapper("expanded", project("bookmarks")),
  ]);

  return createComposableCustomizeLayout({
    bottom: [
      wrapper("expanded", wrapper("center", project("downloads-status"))),
    ],
    left: sideSeeds.left,
    right: sideSeeds.right,
    top: [
      project("back"),
      project("forward"),
      project("reload-stop"),
      project("home"),
      project("trust"),
      wrapper("expanded"),
      project("show-downloads"),
      project("extensions"),
      project("settings"),
      project("customize-shell"),
      project("application-menu"),
      project("private-indicator"),
      project("minimize-window"),
      project("toggle-maximize-window"),
      project("close-window"),
    ],
  });
}

export function migrateCustomizeLayoutV1(
  layout: CustomizeLayout,
  sidePanelLayout: SidePanelLayout,
): ComposableCustomizeLayout {
  const tabsEdge: ToolbarZoneName =
    sidePanelLayout === "tabs-left" ? "left" : "right";
  const bookmarksEdge: ToolbarZoneName = tabsEdge === "left" ? "right" : "left";
  const sideSeeds: Record<"left" | "right", readonly ComposableLayoutSeed[]> = {
    left: legacySeeds(layout.zones.left),
    right: legacySeeds(layout.zones.right),
  };
  sideSeeds[tabsEdge] = Object.freeze([
    project("trust"),
    project("address-launcher"),
    wrapper("expanded", project("tabs")),
    ...sideSeeds[tabsEdge],
  ]);
  sideSeeds[bookmarksEdge] = Object.freeze([
    wrapper("expanded", project("bookmarks")),
    ...sideSeeds[bookmarksEdge],
  ]);
  return createComposableCustomizeLayout(
    {
      bottom: [
        project("downloads-status"),
        ...legacySeeds(layout.zones.bottom),
      ],
      left: sideSeeds.left,
      right: sideSeeds.right,
      top: [
        project("back"),
        project("forward"),
        project("reload-stop"),
        project("home"),
        ...legacySeeds(layout.zones.top),
        project("extensions"),
        project("settings"),
        project("customize-shell"),
        project("application-menu"),
        project("private-indicator"),
        project("minimize-window"),
        project("toggle-maximize-window"),
        project("close-window"),
      ],
    },
    { adopted: layout.adopted },
  );
}
