// SPDX-License-Identifier: MPL-2.0

import {
  projectWidgetIdSet,
  singletonProjectWidgetIdSet,
  toolbarZoneNames,
  type ProjectWidgetId,
  type ToolbarZoneName,
} from "../../app/toolbar-widgets-state.ts";
import {
  composableLayoutBounds,
  composableLayoutDirections,
  composableLayoutWrapperKinds,
  composableSpecialKinds,
  type ComposableCustomizeLayout,
  type ComposableLayoutDirection,
  type ComposableLayoutLocation,
  type ComposableLayoutNode,
  type ComposableLayoutSeed,
  type ComposableLayoutSeedZones,
  type ComposableLayoutTarget,
  type ComposableLayoutZones,
  type ComposableLayoutWrapperKind,
  type ComposableSpecialKind,
} from "./contracts.ts";

const WIDGET_ID_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/u;
const INSTANCE_ID_PATTERN = /^layout-([1-9][0-9]{0,5})$/u;
const directionSet = new Set<ComposableLayoutDirection>(
  composableLayoutDirections,
);
const wrapperKindSet = new Set<ComposableLayoutWrapperKind>(
  composableLayoutWrapperKinds,
);
const specialKindSet = new Set<ComposableSpecialKind>(composableSpecialKinds);
const targetKeys = new Set(["id", "kind", "source"]);
const itemKeys = new Set(["instanceId", "target", "type"]);
const containerKeys = new Set(["children", "direction", "instanceId", "type"]);
const wrapperKeys = new Set(["children", "instanceId", "kind", "type"]);
const layoutKeys = new Set([
  "adopted",
  "allowMultiplePlacements",
  "nextInstance",
  "version",
  "zones",
]);
const zoneKeys = new Set<string>(toolbarZoneNames);

type MutableNode =
  | {
      children: MutableNode[];
      direction: ComposableLayoutDirection;
      instanceId: string;
      type: "container";
    }
  | {
      children: MutableNode[];
      instanceId: string;
      kind: ComposableLayoutWrapperKind;
      type: "wrapper";
    }
  | {
      instanceId: string;
      target: ComposableLayoutTarget;
      type: "item";
    };

type MutableLayout = {
  adopted: string[];
  allowMultiplePlacements: boolean;
  nextInstance: number;
  version: 2;
  zones: Record<ToolbarZoneName, MutableNode[]>;
};

function createModelError(code: string): Error {
  const error = new Error(code);
  error.name = "FenneviaComposableLayoutError";
  Object.defineProperties(error, {
    fenneviaCode: { enumerable: false, value: code },
    fenneviaPhase: { enumerable: false, value: "customize-layout" },
  });
  return error;
}

function isRecord(candidate: unknown): candidate is Record<string, unknown> {
  return candidate !== null && typeof candidate === "object";
}

function hasOnlyKeys(
  candidate: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): boolean {
  return Object.keys(candidate).every((key) => allowed.has(key));
}

export function isComposableLayoutDirection(
  candidate: unknown,
): candidate is ComposableLayoutDirection {
  return (
    typeof candidate === "string" &&
    directionSet.has(candidate as ComposableLayoutDirection)
  );
}

export function isComposableSpecialKind(
  candidate: unknown,
): candidate is ComposableSpecialKind {
  return (
    typeof candidate === "string" &&
    specialKindSet.has(candidate as ComposableSpecialKind)
  );
}

export function isComposableLayoutWrapperKind(
  candidate: unknown,
): candidate is ComposableLayoutWrapperKind {
  return (
    typeof candidate === "string" &&
    wrapperKindSet.has(candidate as ComposableLayoutWrapperKind)
  );
}

export function isComposableFirefoxWidgetId(
  candidate: unknown,
): candidate is string {
  return typeof candidate === "string" && WIDGET_ID_PATTERN.test(candidate);
}

export function isComposableInstanceId(
  candidate: unknown,
): candidate is string {
  if (typeof candidate !== "string") {
    return false;
  }
  const match = INSTANCE_ID_PATTERN.exec(candidate);
  if (!match) {
    return false;
  }
  const sequence = Number(match[1]);
  return (
    Number.isSafeInteger(sequence) &&
    sequence > 0 &&
    sequence <= composableLayoutBounds.instanceMax
  );
}

function instanceSequence(instanceId: string): number {
  const match = INSTANCE_ID_PATTERN.exec(instanceId);
  return match ? Number(match[1]) : 0;
}

export function copyComposableLayoutTarget(
  candidate: unknown,
): ComposableLayoutTarget {
  if (!isRecord(candidate) || !hasOnlyKeys(candidate, targetKeys)) {
    throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_TARGET_INVALID");
  }
  if (
    candidate.source === "firefox" &&
    isComposableFirefoxWidgetId(candidate.id) &&
    candidate.kind === undefined
  ) {
    return Object.freeze({ id: candidate.id, source: "firefox" as const });
  }
  if (
    candidate.source === "project" &&
    typeof candidate.id === "string" &&
    projectWidgetIdSet.has(candidate.id as ProjectWidgetId) &&
    candidate.kind === undefined
  ) {
    return Object.freeze({
      id: candidate.id as ProjectWidgetId,
      source: "project" as const,
    });
  }
  if (
    candidate.source === "special" &&
    isComposableSpecialKind(candidate.kind) &&
    candidate.id === undefined
  ) {
    return Object.freeze({
      kind: candidate.kind,
      source: "special" as const,
    });
  }
  throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_TARGET_INVALID");
}

function targetKey(target: ComposableLayoutTarget): string | null {
  if (target.source === "special") {
    return null;
  }
  return `${target.source}:${target.id}`;
}

function isMandatoryCustomizeTarget(target: ComposableLayoutTarget): boolean {
  return target.source === "project" && target.id === "customize-shell";
}

function isSingletonTarget(target: ComposableLayoutTarget): boolean {
  return (
    target.source === "project" && singletonProjectWidgetIdSet.has(target.id)
  );
}

function validatePath(path: readonly number[]): readonly number[] {
  if (
    !Array.isArray(path) ||
    path.length > composableLayoutBounds.containerMaxDepth + 1 ||
    path.some((index) => !Number.isSafeInteger(index) || index < 0)
  ) {
    throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_PATH_INVALID");
  }
  return path;
}

function copyNodeArray(
  candidate: unknown,
  structuralDepth: number,
  state: {
    customizeCount: number;
    instanceIds: Set<string>;
    maxInstance: number;
    targetCounts: Map<string, number>;
    totalNodes: number;
  },
  directMaxEntries: number = composableLayoutBounds.directMaxEntries,
): readonly ComposableLayoutNode[] {
  if (!Array.isArray(candidate) || candidate.length > directMaxEntries) {
    throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_NODES_INVALID");
  }
  const nodes: ComposableLayoutNode[] = [];
  for (const rawNode of candidate) {
    if (!isRecord(rawNode)) {
      throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_NODE_INVALID");
    }
    state.totalNodes += 1;
    if (state.totalNodes > composableLayoutBounds.totalMaxNodes) {
      throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_TOO_LARGE");
    }
    if (
      !isComposableInstanceId(rawNode.instanceId) ||
      state.instanceIds.has(rawNode.instanceId)
    ) {
      throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_INSTANCE_INVALID");
    }
    state.instanceIds.add(rawNode.instanceId);
    state.maxInstance = Math.max(
      state.maxInstance,
      instanceSequence(rawNode.instanceId),
    );
    if (rawNode.type === "item" && hasOnlyKeys(rawNode, itemKeys)) {
      const target = copyComposableLayoutTarget(rawNode.target);
      const key = targetKey(target);
      if (key) {
        state.targetCounts.set(key, (state.targetCounts.get(key) ?? 0) + 1);
      }
      if (isMandatoryCustomizeTarget(target)) {
        state.customizeCount += 1;
      }
      nodes.push(
        Object.freeze({
          instanceId: rawNode.instanceId,
          target,
          type: "item" as const,
        }),
      );
      continue;
    }
    if (
      rawNode.type === "container" &&
      hasOnlyKeys(rawNode, containerKeys) &&
      isComposableLayoutDirection(rawNode.direction)
    ) {
      const nextDepth = structuralDepth + 1;
      if (nextDepth > composableLayoutBounds.containerMaxDepth) {
        throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_DEPTH_INVALID");
      }
      nodes.push(
        Object.freeze({
          children: copyNodeArray(rawNode.children, nextDepth, state),
          direction: rawNode.direction,
          instanceId: rawNode.instanceId,
          type: "container" as const,
        }),
      );
      continue;
    }
    if (
      rawNode.type === "wrapper" &&
      hasOnlyKeys(rawNode, wrapperKeys) &&
      isComposableLayoutWrapperKind(rawNode.kind)
    ) {
      const nextDepth = structuralDepth + 1;
      if (nextDepth > composableLayoutBounds.containerMaxDepth) {
        throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_DEPTH_INVALID");
      }
      nodes.push(
        Object.freeze({
          children: copyNodeArray(rawNode.children, nextDepth, state, 1),
          instanceId: rawNode.instanceId,
          kind: rawNode.kind,
          type: "wrapper" as const,
        }),
      );
      continue;
    }
    throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_NODE_INVALID");
  }
  return Object.freeze(nodes);
}

function validateTargetCounts(
  allowMultiplePlacements: boolean,
  targetCounts: ReadonlyMap<string, number>,
): void {
  for (const [key, count] of targetCounts) {
    if (count <= 1) {
      continue;
    }
    const [source, id] = key.split(":", 2);
    if (
      !allowMultiplePlacements ||
      (source === "project" &&
        singletonProjectWidgetIdSet.has(id as ProjectWidgetId))
    ) {
      throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_DUPLICATE_INVALID");
    }
  }
}

export function copyComposableCustomizeLayout(
  candidate: unknown,
): ComposableCustomizeLayout {
  if (
    !isRecord(candidate) ||
    !hasOnlyKeys(candidate, layoutKeys) ||
    candidate.version !== 2 ||
    typeof candidate.allowMultiplePlacements !== "boolean" ||
    !Number.isSafeInteger(candidate.nextInstance) ||
    (candidate.nextInstance as number) < 1 ||
    (candidate.nextInstance as number) > composableLayoutBounds.instanceMax ||
    !Array.isArray(candidate.adopted) ||
    candidate.adopted.length > composableLayoutBounds.adoptedMaxEntries ||
    candidate.adopted.some((id) => !isComposableFirefoxWidgetId(id)) ||
    new Set(candidate.adopted).size !== candidate.adopted.length ||
    !isRecord(candidate.zones) ||
    !hasOnlyKeys(candidate.zones, zoneKeys) ||
    toolbarZoneNames.some(
      (zone) =>
        !Array.isArray(
          (candidate.zones as Record<string, unknown> | undefined)?.[zone],
        ),
    )
  ) {
    throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_INVALID");
  }
  const state = {
    customizeCount: 0,
    instanceIds: new Set<string>(),
    maxInstance: 0,
    targetCounts: new Map<string, number>(),
    totalNodes: 0,
  };
  const zoneEntries: Array<
    readonly [ToolbarZoneName, readonly ComposableLayoutNode[]]
  > = [];
  for (const zone of toolbarZoneNames) {
    zoneEntries.push([zone, copyNodeArray(candidate.zones[zone], 0, state)]);
  }
  if (state.customizeCount < 1) {
    throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_CUSTOMIZE_REQUIRED");
  }
  validateTargetCounts(candidate.allowMultiplePlacements, state.targetCounts);
  if ((candidate.nextInstance as number) <= state.maxInstance) {
    throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_INSTANCE_INVALID");
  }
  return Object.freeze({
    adopted: Object.freeze([...(candidate.adopted as string[])]),
    allowMultiplePlacements: candidate.allowMultiplePlacements,
    nextInstance: candidate.nextInstance as number,
    version: 2 as const,
    zones: Object.freeze(
      Object.fromEntries(zoneEntries),
    ) as ComposableLayoutZones,
  });
}

function allocateSeedNode(
  seed: ComposableLayoutSeed,
  sequence: { value: number },
): ComposableLayoutNode {
  const instanceId = `layout-${sequence.value++}`;
  if (seed.type === "item") {
    return Object.freeze({
      instanceId,
      target: copyComposableLayoutTarget(seed.target),
      type: "item" as const,
    });
  }
  if (
    seed.type === "container" &&
    isComposableLayoutDirection(seed.direction) &&
    Array.isArray(seed.children)
  ) {
    return Object.freeze({
      children: Object.freeze(
        seed.children.map((child) => allocateSeedNode(child, sequence)),
      ),
      direction: seed.direction,
      instanceId,
      type: "container" as const,
    });
  }
  if (
    seed.type === "wrapper" &&
    isComposableLayoutWrapperKind(seed.kind) &&
    Array.isArray(seed.children)
  ) {
    return Object.freeze({
      children: Object.freeze(
        seed.children.map((child) => allocateSeedNode(child, sequence)),
      ),
      instanceId,
      kind: seed.kind,
      type: "wrapper" as const,
    });
  }
  throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_NODE_INVALID");
}

export function createComposableCustomizeLayout(
  zones: ComposableLayoutSeedZones,
  options: Readonly<{
    adopted?: readonly string[];
    allowMultiplePlacements?: boolean;
  }> = {},
): ComposableCustomizeLayout {
  const sequence = { value: 1 };
  const zoneEntries: Array<
    readonly [ToolbarZoneName, readonly ComposableLayoutNode[]]
  > = [];
  for (const zone of toolbarZoneNames) {
    const seeds = zones[zone] ?? [];
    zoneEntries.push([
      zone,
      Object.freeze(seeds.map((seed) => allocateSeedNode(seed, sequence))),
    ]);
  }
  return copyComposableCustomizeLayout({
    adopted: options.adopted ?? [],
    allowMultiplePlacements: options.allowMultiplePlacements ?? false,
    nextInstance: sequence.value,
    version: 2,
    zones: Object.fromEntries(zoneEntries),
  });
}

export function parseComposableCustomizeLayout(
  text: string,
): ComposableCustomizeLayout | null {
  if (
    typeof text !== "string" ||
    text === "" ||
    text.length > composableLayoutBounds.serializedMaxLength
  ) {
    return null;
  }
  try {
    return copyComposableCustomizeLayout(JSON.parse(text));
  } catch {
    return null;
  }
}

export function serializeComposableCustomizeLayout(
  layout: ComposableCustomizeLayout,
): string {
  const serialized = JSON.stringify(copyComposableCustomizeLayout(layout));
  if (serialized.length > composableLayoutBounds.serializedMaxLength) {
    throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_TOO_LARGE");
  }
  return serialized;
}

function toMutableNode(node: ComposableLayoutNode): MutableNode {
  if (node.type === "item") {
    return {
      instanceId: node.instanceId,
      target: node.target,
      type: "item",
    };
  }
  if (node.type === "container") {
    return {
      children: node.children.map(toMutableNode),
      direction: node.direction,
      instanceId: node.instanceId,
      type: "container",
    };
  }
  return {
    children: node.children.map(toMutableNode),
    instanceId: node.instanceId,
    kind: node.kind,
    type: "wrapper",
  };
}

function toMutableLayout(layout: ComposableCustomizeLayout): MutableLayout {
  return {
    adopted: [...layout.adopted],
    allowMultiplePlacements: layout.allowMultiplePlacements,
    nextInstance: layout.nextInstance,
    version: 2,
    zones: Object.fromEntries(
      toolbarZoneNames.map((zone) => [
        zone,
        layout.zones[zone].map(toMutableNode),
      ]),
    ) as Record<ToolbarZoneName, MutableNode[]>,
  };
}

function requireZone(zone: unknown): ToolbarZoneName {
  if (
    typeof zone !== "string" ||
    !toolbarZoneNames.includes(zone as ToolbarZoneName)
  ) {
    throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_ZONE_INVALID");
  }
  return zone as ToolbarZoneName;
}

function mutableChildOwnerAt(
  layout: MutableLayout,
  zone: ToolbarZoneName,
  parentPath: readonly number[],
): Readonly<{ children: MutableNode[]; maxEntries: number }> {
  validatePath(parentPath);
  let children = layout.zones[requireZone(zone)];
  let maxEntries: number = composableLayoutBounds.directMaxEntries;
  for (const index of parentPath) {
    if (index >= children.length) {
      throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_PATH_INVALID");
    }
    const node = children[index];
    if (node.type === "item") {
      throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_PARENT_INVALID");
    }
    children = node.children;
    maxEntries =
      node.type === "wrapper" ? 1 : composableLayoutBounds.directMaxEntries;
  }
  return Object.freeze({ children, maxEntries });
}

function mutableChildrenAt(
  layout: MutableLayout,
  zone: ToolbarZoneName,
  parentPath: readonly number[],
): MutableNode[] {
  return mutableChildOwnerAt(layout, zone, parentPath).children;
}

function requireIndex(index: number, length: number, allowEnd = false): number {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_INDEX_INVALID");
  }
  const maximum = allowEnd ? length : length - 1;
  if (index > maximum) {
    throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_INDEX_INVALID");
  }
  return index;
}

function mutableNodeAt(
  layout: MutableLayout,
  location: ComposableLayoutLocation,
): MutableNode {
  const path = validatePath(location.path);
  if (path.length === 0) {
    throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_PATH_INVALID");
  }
  const parent = mutableChildrenAt(
    layout,
    requireZone(location.zone),
    path.slice(0, -1),
  );
  return parent[requireIndex(path.at(-1) as number, parent.length)];
}

export function getComposableLayoutNode(
  layout: ComposableCustomizeLayout,
  location: ComposableLayoutLocation,
): ComposableLayoutNode {
  const copied = copyComposableCustomizeLayout(layout);
  const node = mutableNodeAt(toMutableLayout(copied), location);
  return copyNodeArray([node], 0, {
    customizeCount: 0,
    instanceIds: new Set<string>(),
    maxInstance: 0,
    targetCounts: new Map<string, number>(),
    totalNodes: 0,
  })[0];
}

function freezeMutableLayout(layout: MutableLayout): ComposableCustomizeLayout {
  return copyComposableCustomizeLayout(layout);
}

function allocateTargetNode(
  layout: MutableLayout,
  target: ComposableLayoutTarget,
): MutableNode {
  if (layout.nextInstance > composableLayoutBounds.instanceMax) {
    throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_TOO_LARGE");
  }
  return {
    instanceId: `layout-${layout.nextInstance++}`,
    target: copyComposableLayoutTarget(target),
    type: "item",
  };
}

function allocateContainerNode(
  layout: MutableLayout,
  direction: ComposableLayoutDirection,
): MutableNode {
  if (
    layout.nextInstance > composableLayoutBounds.instanceMax ||
    !isComposableLayoutDirection(direction)
  ) {
    throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_NODE_INVALID");
  }
  return {
    children: [],
    direction,
    instanceId: `layout-${layout.nextInstance++}`,
    type: "container",
  };
}

function allocateWrapperNode(
  layout: MutableLayout,
  kind: ComposableLayoutWrapperKind,
): MutableNode {
  if (
    layout.nextInstance > composableLayoutBounds.instanceMax ||
    !isComposableLayoutWrapperKind(kind)
  ) {
    throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_NODE_INVALID");
  }
  return {
    children: [],
    instanceId: `layout-${layout.nextInstance++}`,
    kind,
    type: "wrapper",
  };
}

function requireAvailableChildSlot(
  owner: Readonly<{ children: MutableNode[]; maxEntries: number }>,
): void {
  if (owner.children.length >= owner.maxEntries) {
    throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_CONTAINER_FULL");
  }
}

export function insertComposableLayoutTarget(
  layout: ComposableCustomizeLayout,
  target: ComposableLayoutTarget,
  location: Readonly<{
    index: number;
    parentPath: readonly number[];
    zone: ToolbarZoneName;
  }>,
): ComposableCustomizeLayout {
  const mutable = toMutableLayout(copyComposableCustomizeLayout(layout));
  const owner = mutableChildOwnerAt(
    mutable,
    requireZone(location.zone),
    location.parentPath,
  );
  const { children } = owner;
  requireIndex(location.index, children.length, true);
  requireAvailableChildSlot(owner);
  children.splice(
    location.index,
    0,
    allocateTargetNode(mutable, copyComposableLayoutTarget(target)),
  );
  return freezeMutableLayout(mutable);
}

export function insertComposableLayoutContainer(
  layout: ComposableCustomizeLayout,
  direction: ComposableLayoutDirection,
  location: Readonly<{
    index: number;
    parentPath: readonly number[];
    zone: ToolbarZoneName;
  }>,
): ComposableCustomizeLayout {
  const mutable = toMutableLayout(copyComposableCustomizeLayout(layout));
  const owner = mutableChildOwnerAt(
    mutable,
    requireZone(location.zone),
    location.parentPath,
  );
  const { children } = owner;
  requireIndex(location.index, children.length, true);
  requireAvailableChildSlot(owner);
  children.splice(location.index, 0, allocateContainerNode(mutable, direction));
  return freezeMutableLayout(mutable);
}

export function insertComposableLayoutWrapper(
  layout: ComposableCustomizeLayout,
  kind: ComposableLayoutWrapperKind,
  location: Readonly<{
    index: number;
    parentPath: readonly number[];
    zone: ToolbarZoneName;
  }>,
): ComposableCustomizeLayout {
  const mutable = toMutableLayout(copyComposableCustomizeLayout(layout));
  const owner = mutableChildOwnerAt(
    mutable,
    requireZone(location.zone),
    location.parentPath,
  );
  const { children } = owner;
  requireIndex(location.index, children.length, true);
  requireAvailableChildSlot(owner);
  children.splice(location.index, 0, allocateWrapperNode(mutable, kind));
  return freezeMutableLayout(mutable);
}

export function removeComposableLayoutNode(
  layout: ComposableCustomizeLayout,
  location: ComposableLayoutLocation,
): ComposableCustomizeLayout {
  const mutable = toMutableLayout(copyComposableCustomizeLayout(layout));
  const path = validatePath(location.path);
  if (path.length === 0) {
    throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_PATH_INVALID");
  }
  const children = mutableChildrenAt(
    mutable,
    requireZone(location.zone),
    path.slice(0, -1),
  );
  children.splice(requireIndex(path.at(-1) as number, children.length), 1);
  return freezeMutableLayout(mutable);
}

function isPathPrefix(
  prefix: readonly number[],
  path: readonly number[],
): boolean {
  return (
    prefix.length <= path.length &&
    prefix.every((value, index) => value === path[index])
  );
}

function adjustParentPathAfterRemoval(
  targetParentPath: readonly number[],
  sourcePath: readonly number[],
): readonly number[] {
  const sourceParent = sourcePath.slice(0, -1);
  if (
    isPathPrefix(sourceParent, targetParentPath) &&
    targetParentPath.length > sourceParent.length
  ) {
    const branchIndex = sourceParent.length;
    if (targetParentPath[branchIndex] > (sourcePath.at(-1) as number)) {
      const adjusted = [...targetParentPath];
      adjusted[branchIndex] -= 1;
      return adjusted;
    }
  }
  return targetParentPath;
}

export function moveComposableLayoutNode(
  layout: ComposableCustomizeLayout,
  from: ComposableLayoutLocation,
  to: Readonly<{
    index: number;
    parentPath: readonly number[];
    zone: ToolbarZoneName;
  }>,
): ComposableCustomizeLayout {
  const copied = copyComposableCustomizeLayout(layout);
  const sourcePath = validatePath(from.path);
  const targetParentPath = validatePath(to.parentPath);
  if (sourcePath.length === 0) {
    throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_PATH_INVALID");
  }
  if (from.zone === to.zone && isPathPrefix(sourcePath, targetParentPath)) {
    throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_CYCLE_INVALID");
  }
  const mutable = toMutableLayout(copied);
  mutableNodeAt(mutable, from);
  mutableChildrenAt(mutable, requireZone(to.zone), targetParentPath);
  const sourceParentPath = sourcePath.slice(0, -1);
  const sourceChildren = mutableChildrenAt(
    mutable,
    requireZone(from.zone),
    sourceParentPath,
  );
  const sourceIndex = requireIndex(
    sourcePath.at(-1) as number,
    sourceChildren.length,
  );
  const [node] = sourceChildren.splice(sourceIndex, 1);
  const adjustedParentPath =
    from.zone === to.zone
      ? adjustParentPathAfterRemoval(targetParentPath, sourcePath)
      : targetParentPath;
  const targetOwner = mutableChildOwnerAt(
    mutable,
    requireZone(to.zone),
    adjustedParentPath,
  );
  const { children: targetChildren } = targetOwner;
  let targetIndex = to.index;
  if (
    from.zone === to.zone &&
    sourceParentPath.length === targetParentPath.length &&
    sourceParentPath.every(
      (value, index) => value === targetParentPath[index],
    ) &&
    sourceIndex < targetIndex
  ) {
    targetIndex -= 1;
  }
  requireIndex(targetIndex, targetChildren.length, true);
  requireAvailableChildSlot(targetOwner);
  targetChildren.splice(targetIndex, 0, node);
  return freezeMutableLayout(mutable);
}

export function setComposableMultiplePlacements(
  layout: ComposableCustomizeLayout,
  allowMultiplePlacements: boolean,
): ComposableCustomizeLayout {
  if (typeof allowMultiplePlacements !== "boolean") {
    throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_MULTIPLE_INVALID");
  }
  return copyComposableCustomizeLayout({
    ...layout,
    allowMultiplePlacements,
  });
}

export function setComposableLayoutContainerDirection(
  layout: ComposableCustomizeLayout,
  location: ComposableLayoutLocation,
  direction: ComposableLayoutDirection,
): ComposableCustomizeLayout {
  if (!isComposableLayoutDirection(direction)) {
    throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_NODE_INVALID");
  }
  const mutable = toMutableLayout(copyComposableCustomizeLayout(layout));
  const node = mutableNodeAt(mutable, location);
  if (node.type !== "container") {
    throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_PARENT_INVALID");
  }
  node.direction = direction;
  return freezeMutableLayout(mutable);
}

function visitNodes(
  nodes: readonly ComposableLayoutNode[],
  visitor: (node: ComposableLayoutNode) => void,
): void {
  for (const node of nodes) {
    visitor(node);
    if (node.type !== "item") {
      visitNodes(node.children, visitor);
    }
  }
}

export function countComposableLayoutTarget(
  layout: ComposableCustomizeLayout,
  target: ComposableLayoutTarget,
): number {
  const copiedTarget = copyComposableLayoutTarget(target);
  const expected = targetKey(copiedTarget);
  let count = 0;
  for (const zone of toolbarZoneNames) {
    visitNodes(layout.zones[zone], (node) => {
      if (
        node.type === "item" &&
        (expected === null
          ? node.target.source === "special" &&
            copiedTarget.source === "special" &&
            node.target.kind === copiedTarget.kind
          : targetKey(node.target) === expected)
      ) {
        count += 1;
      }
    });
  }
  return count;
}

export function findComposableLayoutInstance(
  layout: ComposableCustomizeLayout,
  instanceId: string,
): ComposableLayoutLocation | null {
  if (!isComposableInstanceId(instanceId)) {
    return null;
  }
  const findIn = (
    nodes: readonly ComposableLayoutNode[],
    zone: ToolbarZoneName,
    parentPath: readonly number[],
  ): ComposableLayoutLocation | null => {
    for (const [index, node] of nodes.entries()) {
      const path = [...parentPath, index];
      if (node.instanceId === instanceId) {
        return Object.freeze({ path: Object.freeze(path), zone });
      }
      if (node.type !== "item") {
        const nested = findIn(node.children, zone, path);
        if (nested) {
          return nested;
        }
      }
    }
    return null;
  };
  for (const zone of toolbarZoneNames) {
    const found = findIn(layout.zones[zone], zone, []);
    if (found) {
      return found;
    }
  }
  return null;
}

export function findComposableLayoutTarget(
  layout: ComposableCustomizeLayout,
  target: ComposableLayoutTarget,
): ComposableLayoutLocation | null {
  const copiedTarget = copyComposableLayoutTarget(target);
  const expected = targetKey(copiedTarget);
  const findIn = (
    nodes: readonly ComposableLayoutNode[],
    zone: ToolbarZoneName,
    parentPath: readonly number[],
  ): ComposableLayoutLocation | null => {
    for (const [index, node] of nodes.entries()) {
      const path = [...parentPath, index];
      if (
        node.type === "item" &&
        (expected === null
          ? node.target.source === "special" &&
            copiedTarget.source === "special" &&
            node.target.kind === copiedTarget.kind
          : targetKey(node.target) === expected)
      ) {
        return Object.freeze({ path: Object.freeze(path), zone });
      }
      if (node.type !== "item") {
        const nested = findIn(node.children, zone, path);
        if (nested) {
          return nested;
        }
      }
    }
    return null;
  };
  for (const zone of toolbarZoneNames) {
    const found = findIn(layout.zones[zone], zone, []);
    if (found) {
      return found;
    }
  }
  return null;
}

export function withComposableAdopted(
  layout: ComposableCustomizeLayout,
  id: string,
): ComposableCustomizeLayout {
  if (!isComposableFirefoxWidgetId(id)) {
    throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_TARGET_INVALID");
  }
  if (layout.adopted.includes(id)) {
    return layout;
  }
  if (layout.adopted.length >= composableLayoutBounds.adoptedMaxEntries) {
    throw createModelError("FENNEVIA_COMPOSABLE_LAYOUT_TOO_LARGE");
  }
  return copyComposableCustomizeLayout({
    ...layout,
    adopted: [...layout.adopted, id],
  });
}

export function withoutComposableAdopted(
  layout: ComposableCustomizeLayout,
  id: string,
): ComposableCustomizeLayout {
  if (!layout.adopted.includes(id)) {
    return layout;
  }
  return copyComposableCustomizeLayout({
    ...layout,
    adopted: layout.adopted.filter((candidate) => candidate !== id),
  });
}

export function composableLayoutContainsFirefoxWidget(
  layout: ComposableCustomizeLayout,
  id: string,
): boolean {
  return countComposableLayoutTarget(layout, { id, source: "firefox" }) > 0;
}

export function isComposableSingletonTarget(
  target: ComposableLayoutTarget,
): boolean {
  return isSingletonTarget(copyComposableLayoutTarget(target));
}

export function composableLayoutZoneHasNodes(
  layout: ComposableCustomizeLayout,
  zone: ToolbarZoneName,
): boolean {
  return (
    copyComposableCustomizeLayout(layout).zones[requireZone(zone)].length > 0
  );
}

export function hasAccessibleComposableCustomize(
  layout: ComposableCustomizeLayout,
  enabled: Readonly<Record<ToolbarZoneName, boolean>>,
): boolean {
  const copied = copyComposableCustomizeLayout(layout);
  for (const zone of toolbarZoneNames) {
    if (!enabled[zone]) {
      continue;
    }
    let found = false;
    visitNodes(copied.zones[zone], (node) => {
      if (
        node.type === "item" &&
        node.target.source === "project" &&
        node.target.id === "customize-shell"
      ) {
        found = true;
      }
    });
    if (found) {
      return true;
    }
  }
  return false;
}
