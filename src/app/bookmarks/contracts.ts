// SPDX-License-Identifier: MPL-2.0

export const maximumBookmarkTitleLength = 160;
export const bookmarkPageSize = 32;
export const maximumBookmarkDepth = 8;
export const maximumExpandedBookmarkFolders = 20;

export type BookmarkNodeKind = "bookmark" | "folder" | "separator";
export type BookmarkOpenDisposition = "current" | "new-tab";
export type BookmarkOpenRejection =
  "busy" | "failed" | "not-bookmark" | "stale" | "unsupported-scheme";

export type BookmarkNodeSnapshot = Readonly<{
  hasChildren: boolean;
  id: string;
  kind: BookmarkNodeKind;
  title: string;
}>;

export type BookmarkChildrenPage = Readonly<{
  items: readonly BookmarkNodeSnapshot[];
  offset: number;
  parentId: string;
  status: "ok";
  totalCount: number;
  truncated: boolean;
}>;

export type BookmarkChildrenResult =
  | BookmarkChildrenPage
  | Readonly<{
      parentId: string;
      status: "stale";
    }>;

export type BookmarkOpenResult =
  | Readonly<{ status: "opened" }>
  | Readonly<{
      reason: BookmarkOpenRejection;
      status: "rejected";
    }>;

export type BookmarkTreeEvent = Readonly<{
  parentIds: readonly string[];
  revision: number;
  scope: "all" | "parents";
  type: "changed";
}>;

export type BrowserBookmarksBridge = Readonly<{
  children: (
    parentId: string,
    options?: Readonly<{ limit?: number; offset?: number }>,
  ) => Promise<BookmarkChildrenResult>;
  open: (
    bookmarkId: string,
    disposition?: BookmarkOpenDisposition,
  ) => Promise<BookmarkOpenResult>;
  manage: () => boolean;
  roots: () => Promise<readonly BookmarkNodeSnapshot[]>;
  subscribe: (listener: (event: BookmarkTreeEvent) => void) => () => boolean;
}>;

export type BookmarkBranchPhase =
  "error" | "idle" | "loading" | "ready" | "stale";

export type BookmarkBranchSnapshot = Readonly<{
  depth: number;
  items: readonly BookmarkNodeSnapshot[];
  offset: number;
  parentId: string;
  phase: BookmarkBranchPhase;
  totalCount: number;
  truncated: boolean;
}>;

export type BookmarkPanelNotice =
  "none" | "open-failed" | "stale-bookmark" | "unsupported-bookmark";

export type BrowserBookmarksState = Readonly<{
  branches: Readonly<Record<string, BookmarkBranchSnapshot>>;
  expandedFolderIds: readonly string[];
  notice: BookmarkPanelNotice;
  openingBookmarkId: string | null;
  phase: "disposed" | "error" | "loading" | "ready";
  revision: number;
  roots: readonly BookmarkNodeSnapshot[];
  selectedRootId: string | null;
}>;

export type BookmarkVisibleItemRow = Readonly<{
  depth: number;
  expanded: boolean;
  key: string;
  node: BookmarkNodeSnapshot;
  parentId: string;
  type: "item";
}>;

export type BookmarkVisibleBranchRow = Readonly<{
  branch: BookmarkBranchSnapshot;
  depth: number;
  key: string;
  parentId: string;
  type: "branch";
}>;

export type BookmarkVisibleRow =
  BookmarkVisibleBranchRow | BookmarkVisibleItemRow;

export type BrowserBookmarksStateAdapter = Readonly<{
  clearNotice: () => boolean;
  dispose: () => boolean;
  open: (
    bookmarkId: string,
    disposition?: BookmarkOpenDisposition,
  ) => Promise<BookmarkOpenResult>;
  manage: () => boolean;
  page: (parentId: string, direction: "next" | "previous") => Promise<boolean>;
  ready: () => Promise<true>;
  retry: (parentId: string) => Promise<boolean>;
  selectRoot: (rootId: string) => Promise<boolean>;
  snapshot: () => BrowserBookmarksState;
  status: () => Readonly<{
    branchCount: number;
    disposed: boolean;
    expandedFolderCount: number;
    phase: BrowserBookmarksState["phase"];
    revision: number;
    subscriberCount: number;
  }>;
  subscribe: (
    listener: (state: BrowserBookmarksState) => void,
  ) => () => boolean;
  toggleFolder: (folderId: string) => Promise<boolean>;
}>;

export type BookmarkStateAdapterOptions = Readonly<{
  queueTask?: (callback: () => void) => void;
}>;
