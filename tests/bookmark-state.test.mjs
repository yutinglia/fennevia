import assert from "node:assert/strict";
import test from "node:test";

import {
  bookmarkPageSize,
  createBrowserBookmarksStateAdapter,
  getVisibleBookmarkRows,
  resolveBookmarkFocusId,
} from "../src/app/bookmark-state.ts";

const folder = (id, title, hasChildren = true) =>
  Object.freeze({ hasChildren, id, kind: "folder", title });
const bookmark = (id, title) =>
  Object.freeze({ hasChildren: false, id, kind: "bookmark", title });
const separator = (id) =>
  Object.freeze({ hasChildren: false, id, kind: "separator", title: "" });

function createBridge() {
  const roots = Object.freeze([
    folder("root-toolbar", "Bookmarks Toolbar"),
    folder("root-menu", "Bookmarks Menu"),
    folder("root-other", "Other Bookmarks"),
    folder("root-mobile", "Mobile Bookmarks", false),
  ]);
  const children = new Map([
    [
      "root-toolbar",
      [
        folder("folder-news", "News"),
        bookmark("bookmark-one", "One"),
        bookmark("bookmark-two", "Two"),
      ],
    ],
    ["folder-news", [bookmark("bookmark-three", "Three")]],
    ["root-menu", []],
    ["root-other", [bookmark("bookmark-four", "Four")]],
    ["root-mobile", []],
  ]);
  const listeners = new Set();
  const calls = [];
  let revision = 0;

  return {
    bridge: Object.freeze({
      async children(parentId, { limit = bookmarkPageSize, offset = 0 } = {}) {
        calls.push(["children", parentId, offset, limit]);
        const all = children.get(parentId);
        if (!all) {
          return Object.freeze({ parentId, status: "stale" });
        }
        const items = Object.freeze(all.slice(offset, offset + limit));
        return Object.freeze({
          items,
          offset,
          parentId,
          status: "ok",
          totalCount: all.length,
          truncated: offset + items.length < all.length,
        });
      },
      async open(bookmarkId, disposition = "current") {
        calls.push(["open", bookmarkId, disposition]);
        if (bookmarkId === "bookmark-stale") {
          return Object.freeze({ reason: "stale", status: "rejected" });
        }
        if (bookmarkId === "bookmark-script") {
          return Object.freeze({
            reason: "unsupported-scheme",
            status: "rejected",
          });
        }
        return Object.freeze({ status: "opened" });
      },
      manage() {
        calls.push(["manage"]);
        return true;
      },
      async roots() {
        calls.push(["roots"]);
        return roots;
      },
      subscribe(listener) {
        listeners.add(listener);
        let active = true;
        return () => {
          if (!active) {
            return false;
          }
          active = false;
          listeners.delete(listener);
          return true;
        };
      },
    }),
    calls,
    children,
    dispatch(parentIds, scope = "parents") {
      const event = Object.freeze({
        parentIds: Object.freeze([...parentIds]),
        revision: ++revision,
        scope,
        type: "changed",
      });
      for (const listener of Array.from(listeners)) {
        listener(event);
      }
    },
    listenerCount: () => listeners.size,
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("bookmark state initializes immutable roots and one bounded selected-root page", async () => {
  const native = createBridge();
  const adapter = createBrowserBookmarksStateAdapter(native.bridge);
  try {
    await adapter.ready();
    await settle();
    const state = adapter.snapshot();
    assert.equal(state.phase, "ready");
    assert.equal(state.roots.length, 4);
    assert.equal(state.selectedRootId, "root-toolbar");
    assert.deepEqual(
      state.branches["root-toolbar"].items.map((item) => item.title),
      ["News", "One", "Two"],
    );
    assert.ok(Object.isFrozen(state));
    assert.ok(Object.isFrozen(state.roots));
    assert.ok(Object.isFrozen(state.branches));
    assert.ok(Object.isFrozen(state.branches["root-toolbar"].items));
    assert.deepEqual(native.calls.slice(0, 2), [
      ["roots"],
      ["children", "root-toolbar", 0, bookmarkPageSize],
    ]);
  } finally {
    adapter.dispose();
  }
});

test("bookmark state accepts the bridge's full code-point title bound", async () => {
  const native = createBridge();
  const title = "😀".repeat(160);
  native.children.set("root-toolbar", [bookmark("bookmark-emoji", title)]);
  const adapter = createBrowserBookmarksStateAdapter(native.bridge);
  try {
    await adapter.ready();
    assert.equal(
      adapter.snapshot().branches["root-toolbar"].items[0].title,
      title,
    );
  } finally {
    adapter.dispose();
  }
});

test("initial-page failure rejects readiness instead of health-gating stale UI", async () => {
  const native = createBridge();
  native.children.delete("root-toolbar");
  const adapter = createBrowserBookmarksStateAdapter(native.bridge);
  try {
    await assert.rejects(
      () => adapter.ready(),
      /FENNEVIA_BOOKMARK_STATE_INITIAL_PAGE_FAILED/u,
    );
    assert.equal(adapter.snapshot().phase, "error");
  } finally {
    adapter.dispose();
  }
});

test("folders load lazily, flatten with depth, and discard descendants on collapse", async () => {
  const native = createBridge();
  const adapter = createBrowserBookmarksStateAdapter(native.bridge);
  try {
    await adapter.ready();
    await settle();
    assert.equal(adapter.snapshot().branches["folder-news"], undefined);

    await adapter.toggleFolder("folder-news");
    const expanded = adapter.snapshot();
    assert.deepEqual(expanded.expandedFolderIds, ["folder-news"]);
    assert.equal(expanded.branches["folder-news"].depth, 1);
    assert.deepEqual(
      getVisibleBookmarkRows(expanded)
        .filter((row) => row.type === "item")
        .map((row) => [row.node.id, row.depth]),
      [
        ["folder-news", 0],
        ["bookmark-three", 1],
        ["bookmark-one", 0],
        ["bookmark-two", 0],
      ],
    );

    await adapter.toggleFolder("folder-news");
    assert.deepEqual(adapter.snapshot().expandedFolderIds, []);
    assert.equal(adapter.snapshot().branches["folder-news"], undefined);
  } finally {
    adapter.dispose();
  }
});

test("folder paging replaces the bounded page instead of accumulating items", async () => {
  const native = createBridge();
  native.children.set(
    "root-toolbar",
    Array.from({ length: bookmarkPageSize + 5 }, (_, index) =>
      bookmark(
        `bookmark-page-${String(index).padStart(3, "0")}`,
        `Item ${index}`,
      ),
    ),
  );
  const adapter = createBrowserBookmarksStateAdapter(native.bridge);
  try {
    await adapter.ready();
    await settle();
    let branch = adapter.snapshot().branches["root-toolbar"];
    assert.equal(branch.items.length, bookmarkPageSize);
    assert.equal(branch.truncated, true);

    await adapter.page("root-toolbar", "next");
    branch = adapter.snapshot().branches["root-toolbar"];
    assert.equal(branch.offset, bookmarkPageSize);
    assert.equal(branch.items.length, 5);
    assert.equal(branch.truncated, false);

    await adapter.page("root-toolbar", "previous");
    branch = adapter.snapshot().branches["root-toolbar"];
    assert.equal(branch.offset, 0);
    assert.equal(branch.items.length, bookmarkPageSize);
  } finally {
    adapter.dispose();
  }
});

test("native event bursts coalesce and refresh only loaded affected branches", async () => {
  const native = createBridge();
  const queued = [];
  const adapter = createBrowserBookmarksStateAdapter(native.bridge, {
    queueTask(callback) {
      queued.push(callback);
    },
  });
  try {
    await adapter.ready();
    await settle();
    const callsBefore = native.calls.length;
    native.children.get("root-toolbar").push(bookmark("bookmark-five", "Five"));
    native.dispatch(["root-toolbar"]);
    native.dispatch(["root-toolbar"]);
    assert.equal(queued.length, 1);
    queued.shift()();
    await settle();
    assert.equal(native.calls.length, callsBefore + 2);
    assert.equal(
      adapter.snapshot().branches["root-toolbar"].items.at(-1).title,
      "Five",
    );
  } finally {
    adapter.dispose();
  }
});

test("opening reports safe fixed outcomes and keeps only one action in flight", async () => {
  const native = createBridge();
  let resolveOpen;
  const delayedBridge = Object.freeze({
    ...native.bridge,
    open() {
      return new Promise((resolve) => {
        resolveOpen = resolve;
      });
    },
  });
  const adapter = createBrowserBookmarksStateAdapter(delayedBridge);
  try {
    await adapter.ready();
    await settle();
    const opening = adapter.open("bookmark-one", "new-tab");
    assert.equal(adapter.snapshot().openingBookmarkId, "bookmark-one");
    assert.deepEqual(await adapter.open("bookmark-two"), {
      reason: "busy",
      status: "rejected",
    });
    resolveOpen(Object.freeze({ status: "opened" }));
    assert.deepEqual(await opening, { status: "opened" });
    assert.equal(adapter.snapshot().openingBookmarkId, null);

    const staleAdapter = createBrowserBookmarksStateAdapter(native.bridge);
    try {
      await staleAdapter.ready();
      assert.deepEqual(await staleAdapter.open("bookmark-stale"), {
        reason: "stale",
        status: "rejected",
      });
      assert.equal(staleAdapter.snapshot().notice, "stale-bookmark");
      assert.deepEqual(await staleAdapter.open("bookmark-script"), {
        reason: "unsupported-scheme",
        status: "rejected",
      });
      assert.equal(staleAdapter.snapshot().notice, "unsupported-bookmark");
    } finally {
      staleAdapter.dispose();
    }
  } finally {
    adapter.dispose();
  }
});

test("bookmark management delegates through one fixed native action", async () => {
  const native = createBridge();
  const adapter = createBrowserBookmarksStateAdapter(native.bridge);
  try {
    await adapter.ready();
    assert.equal(adapter.manage(), true);
    assert.deepEqual(native.calls.at(-1), ["manage"]);
  } finally {
    adapter.dispose();
  }
});

test("focus resolution stays on stable IDs and picks the nearest surviving row", () => {
  const state = Object.freeze({
    branches: Object.freeze({
      "root-toolbar": Object.freeze({
        depth: 0,
        items: Object.freeze([
          separator("separator-one"),
          bookmark("bookmark-one", "One"),
          bookmark("bookmark-three", "Three"),
        ]),
        offset: 0,
        parentId: "root-toolbar",
        phase: "ready",
        totalCount: 3,
        truncated: false,
      }),
    }),
    expandedFolderIds: Object.freeze([]),
    notice: "none",
    openingBookmarkId: null,
    phase: "ready",
    revision: 1,
    roots: Object.freeze([folder("root-toolbar", "Toolbar")]),
    selectedRootId: "root-toolbar",
  });
  const rows = getVisibleBookmarkRows(state);
  assert.equal(resolveBookmarkFocusId(rows, null), "bookmark-one");
  assert.equal(
    resolveBookmarkFocusId(rows, "bookmark-three"),
    "bookmark-three",
  );
  assert.equal(
    resolveBookmarkFocusId(rows, "bookmark-two", [
      "bookmark-one",
      "bookmark-two",
      "bookmark-three",
    ]),
    "bookmark-three",
  );
});

test("dispose is idempotent and removes bridge state and subscriptions", async () => {
  const native = createBridge();
  const adapter = createBrowserBookmarksStateAdapter(native.bridge);
  await adapter.ready();
  assert.equal(native.listenerCount(), 1);
  const revisionBeforeDispose = adapter.status().revision;
  assert.equal(adapter.dispose(), true);
  const disposedStatus = adapter.status();
  assert.equal(adapter.dispose(), false);
  assert.equal(native.listenerCount(), 0);
  assert.deepEqual(disposedStatus, {
    branchCount: 0,
    disposed: true,
    expandedFolderCount: 0,
    phase: "disposed",
    revision: revisionBeforeDispose + 1,
    subscriberCount: 0,
  });
  assert.deepEqual(adapter.status(), disposedStatus);
  await assert.rejects(
    () => adapter.selectRoot("root-toolbar"),
    /FENNEVIA_BOOKMARK_STATE_DISPOSED/u,
  );
});
