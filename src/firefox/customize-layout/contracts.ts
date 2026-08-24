// SPDX-License-Identifier: MPL-2.0

import type {
  ProjectWidgetId,
  ProjectWidgetStyleId,
  ToolbarZoneName,
} from "../../app/toolbar-widgets-state.ts";

export const composableLayoutDirections = Object.freeze([
  "row",
  "column",
] as const);

export type ComposableLayoutDirection =
  (typeof composableLayoutDirections)[number];

export const composableLayoutWrapperKinds = Object.freeze([
  "center",
  "expanded",
  "padding",
] as const);

export type ComposableLayoutWrapperKind =
  (typeof composableLayoutWrapperKinds)[number];

export const composableSpecialKinds = Object.freeze([
  "separator",
  "spacer",
  "spring",
] as const);

export type ComposableSpecialKind = (typeof composableSpecialKinds)[number];

export type ComposableLayoutTarget =
  | Readonly<{ id: string; source: "firefox" }>
  | Readonly<{ id: ProjectWidgetId; source: "project" }>
  | Readonly<{ kind: ComposableSpecialKind; source: "special" }>;

export type ComposableLayoutItem = Readonly<{
  instanceId: string;
  style?: ProjectWidgetStyleId;
  target: ComposableLayoutTarget;
  type: "item";
}>;

export type ComposableLayoutContainer = Readonly<{
  children: readonly ComposableLayoutNode[];
  direction: ComposableLayoutDirection;
  instanceId: string;
  type: "container";
}>;

export type ComposableLayoutWrapper = Readonly<{
  children: readonly ComposableLayoutNode[];
  instanceId: string;
  kind: ComposableLayoutWrapperKind;
  type: "wrapper";
}>;

export type ComposableLayoutNode =
  ComposableLayoutContainer | ComposableLayoutItem | ComposableLayoutWrapper;

export type ComposableLayoutZones = Readonly<
  Record<ToolbarZoneName, readonly ComposableLayoutNode[]>
>;

export type ComposableCustomizeLayout = Readonly<{
  adopted: readonly string[];
  allowMultiplePlacements: boolean;
  nextInstance: number;
  version: 2;
  zones: ComposableLayoutZones;
}>;

export type ComposableLayoutSeed =
  | Readonly<{
      children: readonly ComposableLayoutSeed[];
      direction: ComposableLayoutDirection;
      type: "container";
    }>
  | Readonly<{
      children: readonly ComposableLayoutSeed[];
      kind: ComposableLayoutWrapperKind;
      type: "wrapper";
    }>
  | Readonly<{
      style?: ProjectWidgetStyleId;
      target: ComposableLayoutTarget;
      type: "item";
    }>;

export type ComposableLayoutSeedZones = Readonly<
  Partial<Record<ToolbarZoneName, readonly ComposableLayoutSeed[]>>
>;

export type ComposableLayoutLocation = Readonly<{
  path: readonly number[];
  zone: ToolbarZoneName;
}>;

export const composableLayoutBounds = Object.freeze({
  adoptedMaxEntries: 64,
  containerMaxDepth: 3,
  directMaxEntries: 48,
  instanceMax: 1_000_000,
  serializedMaxLength: 16_384,
  totalMaxNodes: 128,
  widgetIdMaxLength: 128,
});
