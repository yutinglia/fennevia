// SPDX-License-Identifier: MPL-2.0

export {
  maximumBookmarkTitleLength,
  bookmarkPageSize,
  maximumBookmarkDepth,
  maximumExpandedBookmarkFolders,
  maximumBookmarkFaviconUrlLength,
  bookmarkFaviconDataUrlPattern,
} from "./bookmarks/contracts.ts";
export type {
  BookmarkNodeKind,
  BookmarkOpenDisposition,
  BookmarkOpenRejection,
  BookmarkNodeSnapshot,
  BookmarkChildrenPage,
  BookmarkChildrenResult,
  BookmarkOpenResult,
  BookmarkTreeEvent,
  BrowserBookmarksBridge,
  BookmarkBranchPhase,
  BookmarkBranchSnapshot,
  BookmarkPanelNotice,
  BrowserBookmarksState,
  BookmarkVisibleItemRow,
  BookmarkVisibleBranchRow,
  BookmarkVisibleRow,
  BrowserBookmarksStateAdapter,
} from "./bookmarks/contracts.ts";
export { createBrowserBookmarksStateAdapter } from "./bookmarks/adapter.ts";
export {
  getVisibleBookmarkRows,
  resolveBookmarkFocusId,
} from "./bookmarks/visible-rows.ts";
