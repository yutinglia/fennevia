// SPDX-License-Identifier: MPL-2.0

import {
  maximumBookmarkTitleLength,
  bookmarkPageSize,
  maximumBookmarkDepth,
} from "./contracts.ts";
import type {
  BookmarkNodeKind,
  BookmarkNodeSnapshot,
  BookmarkChildrenPage,
  BookmarkBranchPhase,
  BookmarkBranchSnapshot,
  BookmarkPanelNotice,
  BrowserBookmarksState,
} from "./contracts.ts";

export const bookmarkKinds = new Set<BookmarkNodeKind>([
  "bookmark",
  "folder",
  "separator",
]);

export const createStateError = (code: string): Error => {
  const error = new Error(code);
  error.name = "FenneviaBookmarkStateError";
  Object.defineProperties(error, {
    fenneviaCode: { enumerable: false, value: code },
    fenneviaPhase: { enumerable: false, value: "bookmark-state" },
  });
  return error;
};

export const requireOpaqueId = (value: unknown): string => {
  if (typeof value !== "string" || value.length < 1 || value.length > 160) {
    throw createStateError("FENNEVIA_BOOKMARK_STATE_ID_INVALID");
  }
  return value;
};

export const hasAtMostCodePoints = (
  value: string,
  maximum: number,
): boolean => {
  let count = 0;
  const iterator = value[Symbol.iterator]();
  while (!iterator.next().done) {
    count += 1;
    if (count > maximum) {
      return false;
    }
  }
  return true;
};

export const copyNode = (
  candidate: BookmarkNodeSnapshot,
): BookmarkNodeSnapshot => {
  if (
    !candidate ||
    typeof candidate !== "object" ||
    !bookmarkKinds.has(candidate.kind) ||
    typeof candidate.title !== "string" ||
    typeof candidate.hasChildren !== "boolean"
  ) {
    throw createStateError("FENNEVIA_BOOKMARK_STATE_NODE_INVALID");
  }
  const id = requireOpaqueId(candidate.id);
  if (
    (candidate.kind !== "folder" && candidate.hasChildren) ||
    !hasAtMostCodePoints(candidate.title, maximumBookmarkTitleLength)
  ) {
    throw createStateError("FENNEVIA_BOOKMARK_STATE_NODE_INVALID");
  }
  return Object.freeze({
    hasChildren: candidate.hasChildren,
    id,
    kind: candidate.kind,
    title: candidate.title,
  });
};

export const copyNodes = (
  candidates: readonly BookmarkNodeSnapshot[],
): readonly BookmarkNodeSnapshot[] => {
  if (!Array.isArray(candidates) || candidates.length > bookmarkPageSize) {
    throw createStateError("FENNEVIA_BOOKMARK_STATE_ITEMS_INVALID");
  }
  const nodes = candidates.map(copyNode);
  if (new Set(nodes.map((node) => node.id)).size !== nodes.length) {
    throw createStateError("FENNEVIA_BOOKMARK_STATE_ID_DUPLICATE");
  }
  return Object.freeze(nodes);
};

export const copyRoots = (
  candidates: readonly BookmarkNodeSnapshot[],
): readonly BookmarkNodeSnapshot[] => {
  if (
    !Array.isArray(candidates) ||
    candidates.length < 1 ||
    candidates.length > 4
  ) {
    throw createStateError("FENNEVIA_BOOKMARK_STATE_ROOTS_INVALID");
  }
  const roots = candidates.map(copyNode);
  if (
    roots.some((root) => root.kind !== "folder") ||
    new Set(roots.map((root) => root.id)).size !== roots.length
  ) {
    throw createStateError("FENNEVIA_BOOKMARK_STATE_ROOTS_INVALID");
  }
  return Object.freeze(roots);
};

export const createBranch = ({
  depth,
  items = [],
  offset = 0,
  parentId,
  phase,
  totalCount = 0,
  truncated = false,
}: Readonly<{
  depth: number;
  items?: readonly BookmarkNodeSnapshot[];
  offset?: number;
  parentId: string;
  phase: BookmarkBranchPhase;
  totalCount?: number;
  truncated?: boolean;
}>): BookmarkBranchSnapshot => {
  if (
    !Number.isInteger(depth) ||
    depth < 0 ||
    depth > maximumBookmarkDepth ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    !Number.isSafeInteger(totalCount) ||
    totalCount < 0 ||
    typeof truncated !== "boolean"
  ) {
    throw createStateError("FENNEVIA_BOOKMARK_STATE_BRANCH_INVALID");
  }
  return Object.freeze({
    depth,
    items: copyNodes(items),
    offset,
    parentId: requireOpaqueId(parentId),
    phase,
    totalCount,
    truncated,
  });
};

export const copyPage = (
  candidate: BookmarkChildrenPage,
  expectedParentId: string,
): BookmarkChildrenPage => {
  if (
    candidate?.status !== "ok" ||
    candidate.parentId !== expectedParentId ||
    !Number.isSafeInteger(candidate.offset) ||
    candidate.offset < 0 ||
    !Number.isSafeInteger(candidate.totalCount) ||
    candidate.totalCount < 0 ||
    typeof candidate.truncated !== "boolean"
  ) {
    throw createStateError("FENNEVIA_BOOKMARK_STATE_PAGE_INVALID");
  }
  const items = copyNodes(candidate.items);
  if (
    candidate.offset > candidate.totalCount ||
    candidate.offset + items.length > candidate.totalCount ||
    candidate.truncated !==
      candidate.offset + items.length < candidate.totalCount
  ) {
    throw createStateError("FENNEVIA_BOOKMARK_STATE_PAGE_INVALID");
  }
  return Object.freeze({
    items,
    offset: candidate.offset,
    parentId: expectedParentId,
    status: "ok",
    totalCount: candidate.totalCount,
    truncated: candidate.truncated,
  });
};

export const freezeBranches = (
  branches: Record<string, BookmarkBranchSnapshot>,
): Readonly<Record<string, BookmarkBranchSnapshot>> =>
  Object.freeze({ ...branches });

export const createState = ({
  branches = {},
  expandedFolderIds = [],
  notice = "none",
  openingBookmarkId = null,
  phase,
  revision,
  roots = [],
  selectedRootId = null,
}: Readonly<{
  branches?: Record<string, BookmarkBranchSnapshot>;
  expandedFolderIds?: readonly string[];
  notice?: BookmarkPanelNotice;
  openingBookmarkId?: string | null;
  phase: BrowserBookmarksState["phase"];
  revision: number;
  roots?: readonly BookmarkNodeSnapshot[];
  selectedRootId?: string | null;
}>): BrowserBookmarksState =>
  Object.freeze({
    branches: freezeBranches(branches),
    expandedFolderIds: Object.freeze([...expandedFolderIds]),
    notice,
    openingBookmarkId,
    phase,
    revision,
    roots: Object.freeze([...roots]),
    selectedRootId,
  });

export const defaultQueueTask = (callback: () => void): void => {
  void Promise.resolve().then(callback);
};
