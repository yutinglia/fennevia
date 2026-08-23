import assert from "node:assert/strict";
import test from "node:test";

import {
  createFirefoxBridgeBoundary,
  isFirefoxBridgeError,
} from "../src/firefox/bridge-boundary.ts";
import { createFirefoxBookmarksBridge } from "../src/firefox/bookmarks.ts";
import { maximumBookmarkTitleLength } from "../src/app/bookmark-state.ts";

const BROWSER_URI = "chrome://browser/content/browser.xhtml";
const ROOT_GUIDS = Object.freeze([
  "toolbar_____",
  "menu________",
  "unfiled_____",
  "mobile______",
]);
let nextContextSequence = 0;

function createEventTarget() {
  const listeners = [];
  return {
    addEventListener(type, listener, options) {
      listeners.push({ listener, options, type });
    },
    removeEventListener(type, listener, options) {
      const index = listeners.findIndex(
        (candidate) =>
          candidate.type === type &&
          candidate.listener === listener &&
          candidate.options === options,
      );
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    },
  };
}

function createNativeWindow({ privateWindow = false } = {}) {
  const document = { defaultView: null, documentURI: BROWSER_URI };
  const placesOrganizerCalls = [];
  const window = {
    BROWSER_NEW_TAB_URL: privateWindow
      ? "about:privatebrowsing"
      : "about:newtab",
    document,
    gBrowser: {
      selectedBrowser: { webNavigation: {} },
      selectedTab: { id: "current-tab" },
      tabContainer: createEventTarget(),
      tabs: [],
    },
    PlacesCommandHook: {
      showPlacesOrganizer(item) {
        placesOrganizerCalls.push(item);
      },
    },
    Services: {
      io: {
        newURI(href) {
          return Object.freeze({ spec: href });
        },
      },
    },
    placesOrganizerCalls,
  };
  document.defaultView = window;
  return window;
}

function createPlacesFixture({
  faviconDataUri = "data:image/png;base64,iVBORw0KGgo=",
  faviconThrows = false,
  faviconsAvailable = true,
} = {}) {
  const records = new Map();
  const children = new Map(ROOT_GUIDS.map((guid) => [guid, []]));
  const observerRegistrations = [];
  const observerRemovals = [];
  const openCalls = [];
  const fetchCalls = [];
  const faviconCalls = [];
  const rootTitles = new Map([
    ["toolbar_____", "Bookmarks Toolbar"],
    ["menu________", "Bookmarks Menu"],
    ["unfiled_____", "Other Bookmarks"],
    ["mobile______", "Mobile Bookmarks"],
  ]);

  const addRecord = (record) => {
    records.set(record.guid, record);
    if (!children.has(record.guid) && record.type === 2) {
      children.set(record.guid, []);
    }
    if (children.has(record.parentGuid)) {
      const siblings = children.get(record.parentGuid);
      siblings.splice(record.index, 0, record.guid);
      siblings.forEach((guid, index) => {
        records.get(guid).index = index;
      });
    }
  };

  for (const [index, guid] of ROOT_GUIDS.entries()) {
    records.set(guid, {
      childCount: 0,
      guid,
      index,
      parentGuid: "root________",
      title: "",
      type: 2,
    });
  }

  addRecord({
    childCount: 1,
    guid: "folder______",
    index: 0,
    parentGuid: "toolbar_____",
    title: "Folder",
    type: 2,
  });
  addRecord({
    guid: "bookmark0001",
    index: 1,
    parentGuid: "toolbar_____",
    title: "A bookmark",
    type: 1,
    url: new URL("https://example.invalid/one"),
  });
  addRecord({
    guid: "separator001",
    index: 2,
    parentGuid: "toolbar_____",
    title: "",
    type: 3,
  });
  addRecord({
    guid: "bookmark0002",
    index: 0,
    parentGuid: "folder______",
    title: "Nested",
    type: 1,
    url: new URL("about:buildconfig"),
  });
  addRecord({
    guid: "bookmark0003",
    index: 0,
    parentGuid: "menu________",
    title: "Script",
    type: 1,
    url: new URL("javascript:void(0)"),
  });

  const syncChildCounts = () => {
    for (const [guid, childGuids] of children) {
      records.get(guid).childCount = childGuids.length;
    }
  };
  syncChildCounts();

  const bookmarks = {
    TYPE_BOOKMARK: 1,
    TYPE_FOLDER: 2,
    TYPE_SEPARATOR: 3,
    async fetch(input) {
      fetchCalls.push({ ...input });
      let record;
      if ("guid" in input) {
        record = records.get(input.guid);
      } else {
        const guid = children.get(input.parentGuid)?.[input.index];
        record = guid ? records.get(guid) : undefined;
      }
      return record ? { ...record } : null;
    },
    getLocalizedTitle(record) {
      return rootTitles.get(record.guid) ?? record.title;
    },
    userContentRoots: ROOT_GUIDS,
  };
  const observers = {
    addListener(eventTypes, listener) {
      observerRegistrations.push({ eventTypes, listener });
    },
    removeListener(eventTypes, listener) {
      observerRemovals.push({ eventTypes, listener });
    },
  };
  const favicons = {
    async getFaviconForPage(pageUri, preferredWidth) {
      faviconCalls.push({ pageUri, preferredWidth });
      if (pageUri.spec.endsWith("/one")) {
        if (faviconThrows) {
          throw new Error("private favicon failure");
        }
        return Object.freeze({
          dataURI: Object.freeze({
            spec: faviconDataUri,
          }),
        });
      }
      return null;
    },
  };
  const PlacesUIUtils = {
    openNodeIn(node, where, view, isPrivate) {
      openCalls.push({ isPrivate, node, view, where });
      if (where === "tab" && view?.ownerWindow?.gBrowser) {
        view.ownerWindow.gBrowser.selectedTab = { id: "opened-tab" };
      }
    },
    async promiseNodeLikeFromFetchInfo(record) {
      return Object.freeze({
        bookmarkGuid: record.guid,
        parent: Object.freeze({ bookmarkGuid: record.parentGuid, type: 6 }),
        title: record.title,
        type: 0,
        uri: record.url.href,
      });
    },
  };
  const moduleLoader = (uri) => {
    if (uri === "resource://gre/modules/PlacesUtils.sys.mjs") {
      return {
        PlacesUtils: {
          bookmarks,
          ...(faviconsAvailable ? { favicons } : {}),
          observers,
        },
      };
    }
    if (uri === "moz-src:///browser/components/places/PlacesUIUtils.sys.mjs") {
      return { PlacesUIUtils };
    }
    throw new Error("unexpected module");
  };

  return {
    addRecord(record) {
      addRecord(record);
      syncChildCounts();
    },
    bookmarks,
    children,
    dispatch(events) {
      observerRegistrations.at(-1).listener(events);
    },
    fetchCalls,
    faviconCalls,
    moduleLoader,
    observerRegistrations,
    observerRemovals,
    openCalls,
    records,
    remove(guid) {
      const record = records.get(guid);
      if (!record) {
        return;
      }
      const siblings = children.get(record.parentGuid);
      siblings.splice(siblings.indexOf(guid), 1);
      siblings.forEach((siblingGuid, index) => {
        records.get(siblingGuid).index = index;
      });
      records.delete(guid);
      children.delete(guid);
      syncChildCounts();
    },
  };
}

function createController({
  privateWindow = false,
  fixture = createPlacesFixture(),
} = {}) {
  const window = createNativeWindow({ privateWindow });
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260810162159",
    contextId: `window-00000000-0000-4000-8000-${String(
      ++nextContextSequence,
    ).padStart(12, "0")}`,
    firefoxVersion: "153.0.4",
    window,
    windowKind: privateWindow ? "private" : "normal",
  });
  const errors = [];
  const controller = createFirefoxBookmarksBridge({
    boundary,
    moduleLoader: fixture.moduleLoader,
    onError(error) {
      errors.push(error);
    },
    window,
  });
  return { boundary, controller, errors, fixture, window };
}

function disposePair(pair) {
  pair.controller.dispose();
  pair.boundary.dispose();
}

test("roots expose localized bounded ordinary data with opaque IDs only", async () => {
  const pair = createController();
  try {
    const roots = await pair.controller.bookmarks.roots();
    assert.deepEqual(
      roots.map(({ hasChildren, kind, title }) => ({
        hasChildren,
        kind,
        title,
      })),
      [
        { hasChildren: true, kind: "folder", title: "Bookmarks Toolbar" },
        { hasChildren: true, kind: "folder", title: "Bookmarks Menu" },
        { hasChildren: false, kind: "folder", title: "Other Bookmarks" },
        { hasChildren: false, kind: "folder", title: "Mobile Bookmarks" },
      ],
    );
    assert.ok(Object.isFrozen(roots));
    assert.ok(roots.every(Object.isFrozen));
    assert.ok(roots.every((root) => root.id.startsWith("bookmark-registry-")));
    assert.doesNotMatch(
      JSON.stringify(roots),
      /toolbar_____|menu________|unfiled_____|mobile______|https?:/u,
    );
    assert.ok(
      pair.controller
        .assertRequiredCapabilities()
        .every((capability) => capability.available),
    );
  } finally {
    disposePair(pair);
  }
});

test("bookmark management opens Firefox Library through its retained owner", () => {
  const pair = createController();
  try {
    assert.equal(pair.controller.bookmarks.manage(), true);
    assert.deepEqual(pair.window.placesOrganizerCalls, ["UnfiledBookmarks"]);
  } finally {
    disposePair(pair);
  }
});

test("children query one bounded page by parent position without exposing URLs", async () => {
  const pair = createController();
  try {
    const [toolbar] = await pair.controller.bookmarks.roots();
    const callsBefore = pair.fixture.fetchCalls.length;
    const page = await pair.controller.bookmarks.children(toolbar.id, {
      limit: 2,
      offset: 0,
    });
    assert.equal(page.status, "ok");
    assert.equal(page.items.length, 2);
    assert.equal(page.totalCount, 3);
    assert.equal(page.truncated, true);
    assert.deepEqual(
      page.items.map(({ hasChildren, kind, title }) => ({
        hasChildren,
        kind,
        title,
      })),
      [
        { hasChildren: true, kind: "folder", title: "Folder" },
        { hasChildren: false, kind: "bookmark", title: "A bookmark" },
      ],
    );
    assert.equal(pair.fixture.fetchCalls.length, callsBefore + 3);
    assert.equal(
      page.items[1].faviconUrl,
      "data:image/png;base64,iVBORw0KGgo=",
    );
    assert.equal(pair.fixture.faviconCalls.length, 1);
    assert.equal(pair.fixture.faviconCalls[0].preferredWidth, 16);
    assert.doesNotMatch(JSON.stringify(page), /example\.invalid|bookmark0001/u);
    assert.ok(Object.isFrozen(page));
    assert.ok(Object.isFrozen(page.items));

    const normalizedPage = await pair.controller.bookmarks.children(
      toolbar.id,
      { limit: 2, offset: 32 },
    );
    assert.equal(normalizedPage.status, "ok");
    assert.equal(normalizedPage.offset, 2);
    assert.equal(normalizedPage.items.length, 1);
    assert.equal(normalizedPage.items[0].kind, "separator");
  } finally {
    disposePair(pair);
  }
});

test("missing optional favicon support keeps the packaged fallback", async () => {
  const pair = createController({
    fixture: createPlacesFixture({ faviconsAvailable: false }),
  });
  try {
    const capabilities = pair.controller.assertRequiredCapabilities();
    assert.equal(
      capabilities.find(
        (capability) => capability.name === "firefox.places-favicon-query",
      ).available,
      false,
    );
    const [toolbar] = await pair.controller.bookmarks.roots();
    const page = await pair.controller.bookmarks.children(toolbar.id);
    assert.equal(page.status, "ok");
    assert.equal(
      Object.hasOwn(
        page.items.find((item) => item.kind === "bookmark"),
        "faviconUrl",
      ),
      false,
    );
  } finally {
    disposePair(pair);
  }
});

test("favicon preferred width is clamped for high DPI windows", async () => {
  const pair = createController();
  pair.window.devicePixelRatio = 8;
  try {
    const [toolbar] = await pair.controller.bookmarks.roots();
    await pair.controller.bookmarks.children(toolbar.id);
    assert.equal(pair.fixture.faviconCalls[0].preferredWidth, 64);
  } finally {
    disposePair(pair);
  }
});

test("invalid or failed cached favicon results use the packaged fallback", async (t) => {
  for (const [name, fixture] of [
    [
      "remote URL",
      createPlacesFixture({
        faviconDataUri: "https://example.invalid/icon.png",
      }),
    ],
    [
      "SVG data",
      createPlacesFixture({ faviconDataUri: "data:image/svg+xml;base64,AAAA" }),
    ],
    [
      "malformed data",
      createPlacesFixture({ faviconDataUri: "data:image/png;base64,***" }),
    ],
    [
      "invalid base64 length",
      createPlacesFixture({ faviconDataUri: "data:image/png;base64,AAAAA" }),
    ],
    ["query failure", createPlacesFixture({ faviconThrows: true })],
  ]) {
    await t.test(name, async () => {
      const pair = createController({ fixture });
      try {
        const [toolbar] = await pair.controller.bookmarks.roots();
        const page = await pair.controller.bookmarks.children(toolbar.id);
        const item = page.items.find(
          (candidate) => candidate.kind === "bookmark",
        );
        assert.equal(Object.hasOwn(item, "faviconUrl"), false);
        assert.deepEqual(pair.errors, []);
      } finally {
        disposePair(pair);
      }
    });
  }
});

test("titles are code-point bounded and separators remain inert ordinary data", async () => {
  const fixture = createPlacesFixture();
  const longTitle = `${"😀".repeat(maximumBookmarkTitleLength)}tail`;
  fixture.addRecord({
    guid: "bookmarklong",
    index: 0,
    parentGuid: "unfiled_____",
    title: longTitle,
    type: 1,
    url: new URL("file:///C:/Fennevia/bookmark-probe.txt"),
  });
  const pair = createController({ fixture });
  try {
    const roots = await pair.controller.bookmarks.roots();
    const unfiledPage = await pair.controller.bookmarks.children(roots[2].id);
    assert.equal(
      Array.from(unfiledPage.items[0].title).length,
      maximumBookmarkTitleLength,
    );
    assert.equal(unfiledPage.items[0].title.endsWith("tail"), false);
    assert.doesNotMatch(JSON.stringify(unfiledPage), /file:|Fennevia/u);
    assert.deepEqual(
      await pair.controller.bookmarks.open(unfiledPage.items[0].id),
      { status: "opened" },
    );
    assert.match(pair.fixture.openCalls[0].node.uri, /^file:/u);

    const toolbarPage = await pair.controller.bookmarks.children(roots[0].id, {
      limit: 1,
      offset: 2,
    });
    assert.deepEqual(
      toolbarPage.items.map(({ hasChildren, kind, title }) => ({
        hasChildren,
        kind,
        title,
      })),
      [{ hasChildren: false, kind: "separator", title: "" }],
    );
  } finally {
    disposePair(pair);
  }
});

test("opening delegates current/new-tab and private behavior to PlacesUIUtils", async () => {
  const normal = createController();
  const privatePair = createController({ privateWindow: true });
  try {
    const normalRoots = await normal.controller.bookmarks.roots();
    const normalPage = await normal.controller.bookmarks.children(
      normalRoots[0].id,
    );
    const bookmarkId = normalPage.items.find(
      (item) => item.kind === "bookmark",
    ).id;
    assert.deepEqual(
      await normal.controller.bookmarks.open(bookmarkId, "current"),
      { status: "opened" },
    );
    assert.deepEqual(
      await normal.controller.bookmarks.open(bookmarkId, "new-tab"),
      { status: "opened" },
    );
    assert.deepEqual(
      normal.fixture.openCalls.map(({ isPrivate, where }) => ({
        isPrivate,
        where,
      })),
      [
        { isPrivate: false, where: "current" },
        { isPrivate: false, where: "tab" },
      ],
    );
    assert.equal(normal.fixture.openCalls[0].view.ownerWindow, normal.window);
    assert.equal(normal.window.gBrowser.selectedTab.id, "current-tab");

    const folderId = normalPage.items.find((item) => item.kind === "folder").id;
    const nestedPage = await normal.controller.bookmarks.children(folderId);
    await normal.controller.bookmarks.open(nestedPage.items[0].id);
    assert.equal(normal.fixture.openCalls.at(-1).node.uri, "about:buildconfig");

    const privateRoots = await privatePair.controller.bookmarks.roots();
    const privatePage = await privatePair.controller.bookmarks.children(
      privateRoots[0].id,
    );
    const privateBookmarkId = privatePage.items.find(
      (item) => item.kind === "bookmark",
    ).id;
    await privatePair.controller.bookmarks.open(privateBookmarkId);
    assert.equal(privatePair.fixture.openCalls[0].isPrivate, true);
  } finally {
    disposePair(normal);
    disposePair(privatePair);
  }
});

test("executable bookmarks and non-bookmarks are rejected before native open", async () => {
  const fixture = createPlacesFixture();
  for (const [index, [guid, title, url]] of [
    ["bookmarkdata", "Data", "data:text/plain,blocked"],
    ["bookmarkplac", "Place", "place:parent=menu________"],
    ["bookmarkvbsc", "VBScript", "vbscript:msgbox(1)"],
  ].entries()) {
    fixture.addRecord({
      guid,
      index: index + 1,
      parentGuid: "menu________",
      title,
      type: 1,
      url: new URL(url),
    });
  }
  const pair = createController({ fixture });
  try {
    const roots = await pair.controller.bookmarks.roots();
    const menuPage = await pair.controller.bookmarks.children(roots[1].id);
    for (const item of menuPage.items) {
      assert.deepEqual(await pair.controller.bookmarks.open(item.id), {
        reason: "unsupported-scheme",
        status: "rejected",
      });
    }
    const toolbarPage = await pair.controller.bookmarks.children(roots[0].id);
    assert.deepEqual(
      await pair.controller.bookmarks.open(toolbarPage.items[0].id),
      { reason: "not-bookmark", status: "rejected" },
    );
    assert.equal(pair.fixture.openCalls.length, 0);
  } finally {
    disposePair(pair);
  }
});

test("native changes publish only opaque affected parents and stale removed IDs", async () => {
  const pair = createController();
  const events = [];
  try {
    const roots = await pair.controller.bookmarks.roots();
    const page = await pair.controller.bookmarks.children(roots[0].id);
    const removedId = page.items.find((item) => item.kind === "bookmark").id;
    pair.controller.bookmarks.subscribe((event) => events.push(event));

    pair.fixture.remove("bookmark0001");
    pair.fixture.dispatch([
      {
        guid: "bookmark0001",
        isDescendantRemoval: false,
        isTagging: false,
        parentGuid: "toolbar_____",
        type: "bookmark-removed",
      },
    ]);
    assert.equal(events.length, 1);
    assert.equal(events[0].scope, "parents");
    assert.deepEqual(events[0].parentIds, [roots[0].id]);
    assert.doesNotMatch(
      JSON.stringify(events[0]),
      /toolbar_____|bookmark0001/u,
    );
    assert.deepEqual(await pair.controller.bookmarks.open(removedId), {
      reason: "stale",
      status: "rejected",
    });
  } finally {
    disposePair(pair);
  }
});

test("favicon changes request one all-scope refresh without exposing URLs", async () => {
  const pair = createController();
  const events = [];
  try {
    await pair.controller.bookmarks.roots();
    pair.controller.bookmarks.subscribe((event) => events.push(event));
    pair.fixture.dispatch([
      {
        faviconUrl: "https://private.invalid/favicon.ico",
        type: "favicon-changed",
        url: "https://private.invalid/",
      },
    ]);
    assert.deepEqual(events, [
      {
        parentIds: [],
        revision: 1,
        scope: "all",
        type: "changed",
      },
    ]);
    assert.doesNotMatch(JSON.stringify(events), /private\.invalid/u);
  } finally {
    disposePair(pair);
  }
});

test("descendant removals release every registered opaque handle", async () => {
  const pair = createController();
  try {
    const roots = await pair.controller.bookmarks.roots();
    const toolbarPage = await pair.controller.bookmarks.children(roots[0].id);
    const folder = toolbarPage.items.find((item) => item.kind === "folder");
    const nestedPage = await pair.controller.bookmarks.children(folder.id);
    const nestedId = nestedPage.items[0].id;
    const handlesBefore = pair.controller.snapshot().handleCount;

    pair.fixture.remove("bookmark0002");
    pair.fixture.dispatch([
      {
        guid: "bookmark0002",
        isDescendantRemoval: true,
        isTagging: false,
        parentGuid: "folder______",
        type: "bookmark-removed",
      },
    ]);

    assert.equal(pair.controller.snapshot().handleCount, handlesBefore - 1);
    assert.deepEqual(await pair.controller.bookmarks.open(nestedId), {
      reason: "stale",
      status: "rejected",
    });
  } finally {
    disposePair(pair);
  }
});

test("large observer batches collapse to a bounded all-scope event", async () => {
  const pair = createController();
  const events = [];
  try {
    await pair.controller.bookmarks.roots();
    pair.controller.bookmarks.subscribe((event) => events.push(event));
    pair.fixture.dispatch(
      Array.from({ length: 129 }, () => ({
        guid: "bookmark0001",
        isTagging: false,
        parentGuid: "toolbar_____",
        type: "bookmark-title-changed",
      })),
    );
    assert.deepEqual(events, [
      {
        parentIds: [],
        revision: 1,
        scope: "all",
        type: "changed",
      },
    ]);
  } finally {
    disposePair(pair);
  }
});

test("malformed observer data enters one privacy-safe fatal path", async () => {
  const pair = createController();
  try {
    await pair.controller.bookmarks.roots();
    pair.fixture.dispatch([{ privateTitle: "secret", type: "bad" }]);
    assert.equal(pair.errors.length, 1);
    assert.equal(
      pair.errors[0].fenneviaCode,
      "FENNEVIA_FIREFOX_BOOKMARKS_EVENT_INVALID",
    );
    assert.equal(pair.controller.snapshot().failed, true);
    assert.doesNotMatch(
      `${pair.errors[0].message}${JSON.stringify(pair.errors[0])}`,
      /secret|privateTitle/u,
    );
  } finally {
    disposePair(pair);
  }
});

test("foreign IDs fail before Places access and disposal removes the exact observer", async () => {
  const first = createController();
  const second = createController();
  try {
    const secondRoots = await second.controller.bookmarks.roots();
    const fetchesBefore = first.fixture.fetchCalls.length;
    await assert.rejects(
      first.controller.bookmarks.children(secondRoots[0].id),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode === "FENNEVIA_FIREFOX_HANDLE_CONTEXT_MISMATCH",
    );
    assert.equal(first.fixture.fetchCalls.length, fetchesBefore);
    assert.equal(first.fixture.observerRegistrations.length, 1);
    assert.equal(first.controller.dispose(), true);
    assert.equal(first.controller.dispose(), false);
    assert.equal(first.fixture.observerRemovals.length, 1);
    assert.equal(
      first.fixture.observerRemovals[0].listener,
      first.fixture.observerRegistrations[0].listener,
    );
    assert.equal(first.controller.snapshot().handleCount, 0);
    first.boundary.dispose();
  } finally {
    if (!first.controller.snapshot().disposed) {
      disposePair(first);
    }
    disposePair(second);
  }
});

test("a missing opening capability fails creation with current-build diagnostics", () => {
  const fixture = createPlacesFixture();
  const originalLoader = fixture.moduleLoader;
  fixture.moduleLoader = (uri) => {
    const module = originalLoader(uri);
    if ("PlacesUIUtils" in module) {
      return {
        PlacesUIUtils: {
          ...module.PlacesUIUtils,
          openNodeIn: undefined,
        },
      };
    }
    return module;
  };
  const window = createNativeWindow();
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260810162159",
    contextId: `window-00000000-0000-4000-8000-${String(
      ++nextContextSequence,
    ).padStart(12, "0")}`,
    firefoxVersion: "153.0.4",
    window,
    windowKind: "normal",
  });
  try {
    assert.throws(
      () =>
        createFirefoxBookmarksBridge({
          boundary,
          moduleLoader: fixture.moduleLoader,
          onError() {},
          window,
        }),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode ===
          "FENNEVIA_FIREFOX_BOOKMARKS_CAPABILITY_MISSING" &&
        error.fenneviaSymbol === "PlacesUIUtils.openNodeIn" &&
        error.fenneviaBuildId === "20260810162159",
    );
  } finally {
    boundary.dispose();
  }
});

test("a missing Library owner fails creation with current-build diagnostics", () => {
  const fixture = createPlacesFixture();
  const window = createNativeWindow();
  window.PlacesCommandHook.showPlacesOrganizer = undefined;
  const boundary = createFirefoxBridgeBoundary({
    buildId: "20260810162159",
    contextId: `window-00000000-0000-4000-8000-${String(
      ++nextContextSequence,
    ).padStart(12, "0")}`,
    firefoxVersion: "153.0.4",
    window,
    windowKind: "normal",
  });
  try {
    assert.throws(
      () =>
        createFirefoxBookmarksBridge({
          boundary,
          moduleLoader: fixture.moduleLoader,
          onError() {},
          window,
        }),
      (error) =>
        isFirefoxBridgeError(error) &&
        error.fenneviaCode ===
          "FENNEVIA_FIREFOX_BOOKMARKS_CAPABILITY_MISSING" &&
        error.fenneviaSymbol ===
          "window.PlacesCommandHook.showPlacesOrganizer" &&
        error.fenneviaBuildId === "20260810162159",
    );
  } finally {
    boundary.dispose();
  }
});
