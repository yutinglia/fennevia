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

type BookmarkStateAdapterOptions = Readonly<{
  queueTask?: (callback: () => void) => void;
}>;

const bookmarkKinds = new Set<BookmarkNodeKind>([
  "bookmark",
  "folder",
  "separator",
]);

const createStateError = (code: string): Error => {
  const error = new Error(code);
  error.name = "FenneviaBookmarkStateError";
  Object.defineProperties(error, {
    fenneviaCode: { enumerable: false, value: code },
    fenneviaPhase: { enumerable: false, value: "bookmark-state" },
  });
  return error;
};

const requireOpaqueId = (value: unknown): string => {
  if (typeof value !== "string" || value.length < 1 || value.length > 160) {
    throw createStateError("FENNEVIA_BOOKMARK_STATE_ID_INVALID");
  }
  return value;
};

const hasAtMostCodePoints = (value: string, maximum: number): boolean => {
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

const copyNode = (candidate: BookmarkNodeSnapshot): BookmarkNodeSnapshot => {
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

const copyNodes = (
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

const copyRoots = (
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

const createBranch = ({
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

const copyPage = (
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

const freezeBranches = (
  branches: Record<string, BookmarkBranchSnapshot>,
): Readonly<Record<string, BookmarkBranchSnapshot>> =>
  Object.freeze({ ...branches });

const createState = ({
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

const defaultQueueTask = (callback: () => void): void => {
  void Promise.resolve().then(callback);
};

export function createBrowserBookmarksStateAdapter(
  bridge: BrowserBookmarksBridge,
  { queueTask = defaultQueueTask }: BookmarkStateAdapterOptions = {},
): BrowserBookmarksStateAdapter {
  if (
    !bridge ||
    typeof bridge !== "object" ||
    typeof bridge.children !== "function" ||
    typeof bridge.open !== "function" ||
    typeof bridge.roots !== "function" ||
    typeof bridge.subscribe !== "function" ||
    typeof queueTask !== "function"
  ) {
    throw createStateError("FENNEVIA_BOOKMARK_STATE_BRIDGE_INVALID");
  }

  let activeBridge: BrowserBookmarksBridge | null = bridge;
  let disposed = false;
  let state = createState({ phase: "loading", revision: 0 });
  let nextRevision = 0;
  let refreshScheduled = false;
  const listeners = new Set<(state: BrowserBookmarksState) => void>();
  const requestSequenceByParent = new Map<string, number>();
  const pendingRefreshIds = new Set<string>();

  const requireBridge = (): BrowserBookmarksBridge => {
    if (disposed || !activeBridge) {
      throw createStateError("FENNEVIA_BOOKMARK_STATE_DISPOSED");
    }
    return activeBridge;
  };

  const publish = (
    changes: Partial<Omit<BrowserBookmarksState, "revision">>,
  ): void => {
    if (disposed) {
      return;
    }
    state = createState({
      branches: { ...state.branches },
      expandedFolderIds: state.expandedFolderIds,
      notice: state.notice,
      openingBookmarkId: state.openingBookmarkId,
      phase: state.phase,
      revision: ++nextRevision,
      roots: state.roots,
      selectedRootId: state.selectedRootId,
      ...changes,
    });
    for (const listener of Array.from(listeners)) {
      listener(state);
    }
  };

  const deleteBranchTree = (
    parentId: string,
    branches: Record<string, BookmarkBranchSnapshot>,
    expanded: Set<string>,
  ): void => {
    const branch = branches[parentId];
    if (branch) {
      for (const item of branch.items) {
        if (item.kind === "folder") {
          deleteBranchTree(item.id, branches, expanded);
        }
      }
    }
    delete branches[parentId];
    expanded.delete(parentId);
    requestSequenceByParent.delete(parentId);
  };

  const reconcileRemovedChildren = (
    previous: BookmarkBranchSnapshot | undefined,
    nextItems: readonly BookmarkNodeSnapshot[],
    branches: Record<string, BookmarkBranchSnapshot>,
    expanded: Set<string>,
  ): void => {
    if (!previous) {
      return;
    }
    const nextIds = new Set(nextItems.map((item) => item.id));
    for (const prior of previous.items) {
      if (prior.kind === "folder" && !nextIds.has(prior.id)) {
        deleteBranchTree(prior.id, branches, expanded);
      }
    }
  };

  const loadBranch = async (
    parentId: string,
    depth: number,
    offset: number,
  ): Promise<boolean> => {
    const currentBridge = requireBridge();
    requireOpaqueId(parentId);
    if (
      !Number.isInteger(depth) ||
      depth < 0 ||
      depth > maximumBookmarkDepth ||
      !Number.isSafeInteger(offset) ||
      offset < 0
    ) {
      throw createStateError("FENNEVIA_BOOKMARK_STATE_QUERY_INVALID");
    }
    const sequence = (requestSequenceByParent.get(parentId) ?? 0) + 1;
    requestSequenceByParent.set(parentId, sequence);
    const previous = state.branches[parentId];
    const loadingBranch = createBranch({
      depth,
      items: previous?.items ?? [],
      offset,
      parentId,
      phase: "loading",
      totalCount: previous?.totalCount ?? 0,
      truncated: previous?.truncated ?? false,
    });
    publish({
      branches: { ...state.branches, [parentId]: loadingBranch },
    });

    try {
      const result = await currentBridge.children(parentId, {
        limit: bookmarkPageSize,
        offset,
      });
      if (disposed || requestSequenceByParent.get(parentId) !== sequence) {
        return false;
      }
      if (result?.status === "stale") {
        if (result.parentId !== parentId) {
          throw createStateError("FENNEVIA_BOOKMARK_STATE_PAGE_INVALID");
        }
        publish({
          branches: {
            ...state.branches,
            [parentId]: createBranch({
              depth,
              offset,
              parentId,
              phase: "stale",
            }),
          },
        });
        return false;
      }

      const page = copyPage(result, parentId);
      const branches = { ...state.branches };
      const expanded = new Set(state.expandedFolderIds);
      reconcileRemovedChildren(previous, page.items, branches, expanded);
      branches[parentId] = createBranch({
        depth,
        items: page.items,
        offset: page.offset,
        parentId,
        phase: "ready",
        totalCount: page.totalCount,
        truncated: page.truncated,
      });
      publish({
        branches,
        expandedFolderIds: Object.freeze([...expanded]),
      });
      return true;
    } catch (error) {
      if (disposed || requestSequenceByParent.get(parentId) !== sequence) {
        return false;
      }
      publish({
        branches: {
          ...state.branches,
          [parentId]: createBranch({
            depth,
            offset,
            parentId,
            phase: "error",
          }),
        },
      });
      void error;
      return false;
    }
  };

  const reloadRoots = async (): Promise<readonly BookmarkNodeSnapshot[]> => {
    const roots = copyRoots(await requireBridge().roots());
    if (disposed) {
      return roots;
    }
    const rootIds = new Set(roots.map((root) => root.id));
    const selectedRootId =
      state.selectedRootId && rootIds.has(state.selectedRootId)
        ? state.selectedRootId
        : roots[0].id;
    publish({ phase: "ready", roots, selectedRootId });
    return roots;
  };

  const refreshPendingBranches = async (): Promise<void> => {
    refreshScheduled = false;
    if (disposed) {
      pendingRefreshIds.clear();
      return;
    }
    const parentIds = Array.from(pendingRefreshIds);
    pendingRefreshIds.clear();
    const rootIds = new Set(state.roots.map((root) => root.id));
    if (parentIds.some((parentId) => rootIds.has(parentId))) {
      try {
        await reloadRoots();
      } catch {
        if (!disposed) {
          publish({ phase: "error" });
        }
        return;
      }
    }
    for (const parentId of parentIds) {
      if (disposed) {
        return;
      }
      const branch = state.branches[parentId];
      if (branch) {
        await loadBranch(parentId, branch.depth, branch.offset);
      }
    }
  };

  const queueRefresh = (event: BookmarkTreeEvent): void => {
    if (
      event?.type !== "changed" ||
      !Number.isSafeInteger(event.revision) ||
      event.revision < 1 ||
      !Array.isArray(event.parentIds) ||
      (event.scope !== "all" && event.scope !== "parents") ||
      (event.scope === "parents" && event.parentIds.length < 1) ||
      (event.scope === "all" && event.parentIds.length !== 0) ||
      event.parentIds.length > 16
    ) {
      throw createStateError("FENNEVIA_BOOKMARK_STATE_EVENT_INVALID");
    }
    if (event.scope === "all") {
      for (const root of state.roots) {
        pendingRefreshIds.add(root.id);
      }
      for (const parentId of Object.keys(state.branches)) {
        pendingRefreshIds.add(parentId);
      }
    }
    for (const parentId of event.parentIds) {
      pendingRefreshIds.add(requireOpaqueId(parentId));
    }
    if (!refreshScheduled) {
      refreshScheduled = true;
      queueTask(() => {
        void refreshPendingBranches();
      });
    }
  };

  const unsubscribeBridge = bridge.subscribe((event) => {
    if (!disposed) {
      queueRefresh(event);
    }
  });
  if (typeof unsubscribeBridge !== "function") {
    throw createStateError("FENNEVIA_BOOKMARK_STATE_SUBSCRIPTION_INVALID");
  }

  const readyPromise = (async (): Promise<true> => {
    try {
      const roots = await reloadRoots();
      if (!disposed && !(await loadBranch(roots[0].id, 0, 0))) {
        if (disposed) {
          return true;
        }
        throw createStateError("FENNEVIA_BOOKMARK_STATE_INITIAL_PAGE_FAILED");
      }
      return true;
    } catch (error) {
      if (!disposed) {
        publish({ phase: "error" });
      }
      throw error;
    }
  })();

  const findLoadedFolder = (
    folderId: string,
  ): Readonly<{ depth: number; node: BookmarkNodeSnapshot }> | null => {
    for (const branch of Object.values(state.branches)) {
      const node = branch.items.find((item) => item.id === folderId);
      if (node?.kind === "folder") {
        return Object.freeze({ depth: branch.depth + 1, node });
      }
    }
    return null;
  };

  const adapter: BrowserBookmarksStateAdapter = Object.freeze({
    clearNotice(): boolean {
      requireBridge();
      if (state.notice === "none") {
        return false;
      }
      publish({ notice: "none" });
      return true;
    },

    dispose(): boolean {
      if (disposed) {
        return false;
      }
      disposed = true;
      activeBridge = null;
      refreshScheduled = false;
      pendingRefreshIds.clear();
      requestSequenceByParent.clear();
      listeners.clear();
      unsubscribeBridge();
      state = createState({
        phase: "disposed",
        revision: ++nextRevision,
      });
      return true;
    },

    async open(
      bookmarkId: string,
      disposition: BookmarkOpenDisposition = "current",
    ): Promise<BookmarkOpenResult> {
      const currentBridge = requireBridge();
      requireOpaqueId(bookmarkId);
      if (disposition !== "current" && disposition !== "new-tab") {
        throw createStateError("FENNEVIA_BOOKMARK_STATE_DISPOSITION_INVALID");
      }
      if (state.openingBookmarkId) {
        return Object.freeze({ reason: "busy", status: "rejected" });
      }
      publish({
        notice: "none",
        openingBookmarkId: bookmarkId,
      });
      let result: BookmarkOpenResult;
      try {
        result = await currentBridge.open(bookmarkId, disposition);
      } catch {
        result = Object.freeze({ reason: "failed", status: "rejected" });
      }
      if (disposed) {
        return result;
      }
      let notice: BookmarkPanelNotice = "none";
      if (result.status === "rejected") {
        if (result.reason === "stale") {
          notice = "stale-bookmark";
        } else if (result.reason === "unsupported-scheme") {
          notice = "unsupported-bookmark";
        } else if (result.reason !== "busy") {
          notice = "open-failed";
        }
      }
      publish({ notice, openingBookmarkId: null });
      return result;
    },

    async page(
      parentId: string,
      direction: "next" | "previous",
    ): Promise<boolean> {
      requireBridge();
      const branch = state.branches[requireOpaqueId(parentId)];
      if (!branch || (direction !== "next" && direction !== "previous")) {
        throw createStateError("FENNEVIA_BOOKMARK_STATE_PAGE_ACTION_INVALID");
      }
      const nextOffset =
        direction === "next"
          ? branch.offset + bookmarkPageSize
          : Math.max(0, branch.offset - bookmarkPageSize);
      if (
        nextOffset === branch.offset ||
        (direction === "next" && nextOffset >= branch.totalCount)
      ) {
        return false;
      }
      return loadBranch(parentId, branch.depth, nextOffset);
    },

    ready(): Promise<true> {
      requireBridge();
      return readyPromise;
    },

    async retry(parentId: string): Promise<boolean> {
      requireBridge();
      const branch = state.branches[requireOpaqueId(parentId)];
      if (!branch) {
        throw createStateError("FENNEVIA_BOOKMARK_STATE_BRANCH_MISSING");
      }
      return loadBranch(parentId, branch.depth, branch.offset);
    },

    async selectRoot(rootId: string): Promise<boolean> {
      requireBridge();
      const id = requireOpaqueId(rootId);
      if (!state.roots.some((root) => root.id === id)) {
        throw createStateError("FENNEVIA_BOOKMARK_STATE_ROOT_INVALID");
      }
      const changed = state.selectedRootId !== id;
      if (changed) {
        publish({ notice: "none", selectedRootId: id });
      }
      const branch = state.branches[id];
      if (!branch || branch.phase === "error" || branch.phase === "stale") {
        await loadBranch(id, 0, branch?.offset ?? 0);
      }
      return changed;
    },

    snapshot(): BrowserBookmarksState {
      return state;
    },

    status() {
      return Object.freeze({
        branchCount: Object.keys(state.branches).length,
        disposed,
        expandedFolderCount: state.expandedFolderIds.length,
        phase: state.phase,
        revision: state.revision,
        subscriberCount: listeners.size,
      });
    },

    subscribe(listener: (state: BrowserBookmarksState) => void): () => boolean {
      requireBridge();
      if (typeof listener !== "function") {
        throw createStateError("FENNEVIA_BOOKMARK_STATE_LISTENER_INVALID");
      }
      listeners.add(listener);
      let subscribed = true;
      return Object.freeze(() => {
        if (!subscribed) {
          return false;
        }
        subscribed = false;
        listeners.delete(listener);
        return true;
      });
    },

    async toggleFolder(folderId: string): Promise<boolean> {
      requireBridge();
      const id = requireOpaqueId(folderId);
      const loaded = findLoadedFolder(id);
      if (!loaded) {
        throw createStateError("FENNEVIA_BOOKMARK_STATE_FOLDER_INVALID");
      }
      const expanded = new Set(state.expandedFolderIds);
      if (expanded.has(id)) {
        expanded.delete(id);
        const branches = { ...state.branches };
        deleteBranchTree(id, branches, expanded);
        publish({
          branches,
          expandedFolderIds: Object.freeze([...expanded]),
        });
        return true;
      }
      if (!loaded.node.hasChildren) {
        return false;
      }
      if (
        loaded.depth > maximumBookmarkDepth ||
        expanded.size >= maximumExpandedBookmarkFolders
      ) {
        throw createStateError("FENNEVIA_BOOKMARK_STATE_EXPANSION_LIMIT");
      }
      expanded.add(id);
      publish({ expandedFolderIds: Object.freeze([...expanded]) });
      await loadBranch(id, loaded.depth, 0);
      return true;
    },
  });

  return adapter;
}

export function getVisibleBookmarkRows(
  state: BrowserBookmarksState,
): readonly BookmarkVisibleRow[] {
  const rows: BookmarkVisibleRow[] = [];
  const expanded = new Set(state.expandedFolderIds);
  const appendBranch = (parentId: string, depth: number): void => {
    if (depth > maximumBookmarkDepth) {
      return;
    }
    const branch = state.branches[parentId];
    if (!branch) {
      rows.push(
        Object.freeze({
          branch: createBranch({ depth, parentId, phase: "idle" }),
          depth,
          key: `branch-${parentId}-${depth}`,
          parentId,
          type: "branch",
        }),
      );
      return;
    }
    for (const node of branch.items) {
      const isExpanded = node.kind === "folder" && expanded.has(node.id);
      rows.push(
        Object.freeze({
          depth,
          expanded: isExpanded,
          key: `item-${node.id}`,
          node,
          parentId,
          type: "item",
        }),
      );
      if (isExpanded) {
        appendBranch(node.id, depth + 1);
      }
    }
    if (
      branch.phase !== "ready" ||
      branch.items.length === 0 ||
      branch.offset > 0 ||
      branch.truncated
    ) {
      rows.push(
        Object.freeze({
          branch,
          depth,
          key: `branch-${parentId}-${depth}`,
          parentId,
          type: "branch",
        }),
      );
    }
  };
  if (state.selectedRootId) {
    appendBranch(state.selectedRootId, 0);
  }
  return Object.freeze(rows);
}

export function resolveBookmarkFocusId(
  rows: readonly BookmarkVisibleRow[],
  currentId: string | null,
  priorItemIds: readonly string[] = [],
): string | null {
  const itemIds = rows
    .filter(
      (row): row is BookmarkVisibleItemRow =>
        row.type === "item" && row.node.kind !== "separator",
    )
    .map((row) => row.node.id);
  if (currentId && itemIds.includes(currentId)) {
    return currentId;
  }
  if (currentId) {
    const priorIndex = priorItemIds.indexOf(currentId);
    if (priorIndex >= 0 && itemIds.length > 0) {
      return itemIds[Math.min(priorIndex, itemIds.length - 1)];
    }
  }
  return itemIds[0] ?? null;
}
